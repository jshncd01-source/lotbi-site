// Reusable Web Media Upload client.
//
// Owns the client side of a Direct Upload flow: local pre-validation, a
// checksum over the FINAL bytes, a mock/pluggable Core upload-session API,
// a direct PUT to the URL Core hands back (never a hand-rolled one), upload
// progress/cancel, a status-first retry policy, and completion/verification
// polling. It does not talk to any real backend or storage provider — no
// such Core "Direct Upload Session" API exists in this repository or its
// backend (lotbi-core) yet. `api` is fully injectable so this module can be
// pointed at the real thing the day that contract ships, and at
// `createMockCoreApi()` (site-media-upload-mock-core.js) until then.
//
//   import {createMediaUploadClient, MEDIA_UPLOAD_STATE} from './site-media-upload.js?v=aset-bc1900b95b20';
//
//   const client = createMediaUploadClient({api, transport: createXhrTransport()});
//   client.onEvent((event) => { ... });
//   await client.start(file);
//   client.cancel();
//   await client.retry();
//
// SECURITY: the Presigned URL Core issues is a bearer capability for its
// lifetime. This module never persists it (no localStorage/sessionStorage/
// IndexedDB), never logs it whole (see redactUploadUrl), and never lets a
// caller supply their own bucket/key/host — only the exact url + headers
// Core returned are ever used for the PUT.

export const MEDIA_UPLOAD_ALLOWED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export const MEDIA_UPLOAD_ERROR = Object.freeze({
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  CHECKSUM_FAILED: 'CHECKSUM_FAILED',
  UPLOAD_AUTH_EXPIRED: 'UPLOAD_AUTH_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CORS_ERROR: 'CORS_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  VERIFICATION_REJECTED: 'VERIFICATION_REJECTED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNKNOWN: 'UNKNOWN',
});

export const MEDIA_UPLOAD_STATE = Object.freeze({
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  CHECKSUMMING: 'CHECKSUMMING',
  AUTHORIZING: 'AUTHORIZING',
  UPLOADING: 'UPLOADING',
  UPLOADED: 'UPLOADED',
  VERIFYING: 'VERIFYING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
});

const MAX_PUT_RETRIES = 2;

export class MediaUploadError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = 'MediaUploadError';
    this.code = code in MEDIA_UPLOAD_ERROR ? code : MEDIA_UPLOAD_ERROR.UNKNOWN;
    if (cause !== undefined) this.cause = cause;
  }
}

// Strips the query string (where a signature/expiry/access-key-id live) so a
// Presigned URL is never written whole into a log, error report or event.
export function redactUploadUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

export function validateLocalMedia(file, {maxBytes = 10 * 1024 * 1024, allowedTypes = MEDIA_UPLOAD_ALLOWED_TYPES} = {}) {
  if (!file || typeof file.size !== 'number' || typeof file.type !== 'string') {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNKNOWN, '선택한 파일을 읽을 수 없습니다.');
  }
  if (!allowedTypes.includes(file.type)) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNSUPPORTED_TYPE, '지원하지 않는 사진 형식입니다. JPEG, PNG, WebP만 업로드할 수 있습니다.');
  }
  if (file.size <= 0) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNKNOWN, '빈 파일은 업로드할 수 없습니다.');
  }
  if (file.size > maxBytes) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE, `사진 용량이 너무 큽니다 (최대 ${Math.floor(maxBytes / (1024 * 1024))}MB).`);
  }
}

// SHA-256 over the FINAL bytes. Must be called only after any client-side
// processing (resize/compress/EXIF strip) is done — the checksum, and the
// upload session it authorizes, both have to describe the exact bytes that
// will be PUT to storage.
export async function computeChecksum(fileOrBlob) {
  try {
    const buffer = await fileOrBlob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (cause) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.CHECKSUM_FAILED, '사진 정보를 확인하지 못했습니다. 다시 시도해 주세요.', cause);
  }
}

// Browser default transport. Not exercised in Node tests (no XMLHttpRequest
// there) — tests inject a fake transport instead, which is the point: the
// client's retry/cancel/progress logic is transport-agnostic.
export function createXhrTransport() {
  return {
    putWithProgress({url, headers, body, onProgress, signal}) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        for (const [key, value] of Object.entries(headers || {})) xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && typeof onProgress === 'function') onProgress(event.loaded / event.total);
        };
        xhr.onload = () => resolve({ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status});
        xhr.onerror = () => reject(new MediaUploadError(MEDIA_UPLOAD_ERROR.NETWORK_ERROR, '네트워크 오류로 업로드하지 못했습니다.'));
        xhr.onabort = () => reject(new MediaUploadError(MEDIA_UPLOAD_ERROR.UPLOAD_FAILED, '업로드가 취소되었습니다.'));
        if (signal) {
          if (signal.aborted) return xhr.abort();
          signal.addEventListener('abort', () => xhr.abort(), {once: true});
        }
        xhr.send(body);
      });
    },
  };
}

function classifySessionState(session) {
  if (!session) return MEDIA_UPLOAD_ERROR.UNKNOWN;
  if (session.state === 'EXPIRED') return MEDIA_UPLOAD_ERROR.SESSION_EXPIRED;
  if (session.state === 'REJECTED') return MEDIA_UPLOAD_ERROR.VERIFICATION_REJECTED;
  if (session.state === 'RATE_LIMITED') return MEDIA_UPLOAD_ERROR.RATE_LIMITED;
  if (session.state === 'QUOTA_EXCEEDED') return MEDIA_UPLOAD_ERROR.QUOTA_EXCEEDED;
  return MEDIA_UPLOAD_ERROR.UNKNOWN;
}

// `api` = {createSession, completeSession, getStatus} — see
// site-media-upload-mock-core.js for the injected shape until a real Core
// Direct Upload API exists.
export function createMediaUploadClient({api, transport, maxBytes, allowedTypes, pollIntervalMs = 400} = {}) {
  if (!api) throw new Error('createMediaUploadClient requires an api');
  const listeners = new Set();
  let state = MEDIA_UPLOAD_STATE.IDLE;
  let session = null;
  let file = null;
  let checksum = null;
  let abortController = null;

  function emit(event) {
    for (const listener of listeners) listener(event);
  }
  function setState(next, extra) {
    state = next;
    emit({type: 'state', state, ...extra});
  }
  function fail(code, message) {
    setState(MEDIA_UPLOAD_STATE.FAILED, {code, message});
    emit({type: 'error', code, message});
  }

  async function directPut() {
    setState(MEDIA_UPLOAD_STATE.UPLOADING, {progress: 0});
    abortController = typeof AbortController === 'function' ? new AbortController() : null;
    let attempt = 0;
    for (;;) {
      try {
        const result = await transport.putWithProgress({
          url: session.upload_url,
          headers: session.required_headers,
          body: file,
          signal: abortController ? abortController.signal : undefined,
          onProgress: (fraction) => emit({type: 'progress', fraction}),
        });
        if (!result.ok) throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UPLOAD_FAILED, '스토리지 업로드에 실패했습니다.');
        break;
      } catch (err) {
        if (abortController?.signal.aborted) {
          setState(MEDIA_UPLOAD_STATE.CANCELLED);
          return false;
        }
        attempt += 1;
        if (attempt > MAX_PUT_RETRIES) {
          fail(MEDIA_UPLOAD_ERROR.NETWORK_ERROR, '네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
          return false;
        }
        // Status-first: never blindly re-PUT to a URL that may already be
        // expired or already have received the bytes.
        const latest = await api.getStatus(session.upload_id);
        session = latest;
        if (latest.state === 'EXPIRED') {
          fail(MEDIA_UPLOAD_ERROR.SESSION_EXPIRED, '업로드 인증이 만료되었습니다. 새로 시작해 주세요.');
          return false;
        }
        if (latest.state === 'UPLOADED') break; // object already landed; skip re-PUT
        if (!['AUTHORIZING', 'VALID'].includes(latest.state)) {
          fail(classifySessionState(latest), '업로드를 진행할 수 없습니다.');
          return false;
        }
      }
    }
    setState(MEDIA_UPLOAD_STATE.UPLOADED, {progress: 1});
    return true;
  }

  async function completeAndPoll() {
    let completed;
    try {
      completed = await api.completeSession(session.upload_id, {checksum});
    } catch (cause) {
      fail(MEDIA_UPLOAD_ERROR.UPLOAD_FAILED, '업로드 완료 처리에 실패했습니다.', cause);
      return;
    }
    session = completed;
    setState(MEDIA_UPLOAD_STATE.VERIFYING);
    for (;;) {
      if (session.state === 'ACCEPTED') return setState(MEDIA_UPLOAD_STATE.ACCEPTED, {result: session.result});
      if (session.state === 'REJECTED') return setState(MEDIA_UPLOAD_STATE.REJECTED, {reason: session.reason});
      if (session.state === 'EXPIRED') return setState(MEDIA_UPLOAD_STATE.EXPIRED);
      if (session.state !== 'VERIFYING') return fail(classifySessionState(session), '검사 상태를 확인하지 못했습니다.');
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      session = await api.getStatus(session.upload_id);
    }
  }

  return {
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    getSessionId: () => session?.upload_id ?? null,

    async start(inputFile) {
      file = inputFile;
      setState(MEDIA_UPLOAD_STATE.VALIDATING);
      try {
        validateLocalMedia(file, {maxBytes, allowedTypes});
      } catch (err) {
        fail(err.code, err.message);
        return;
      }
      setState(MEDIA_UPLOAD_STATE.CHECKSUMMING);
      try {
        checksum = await computeChecksum(file);
      } catch (err) {
        fail(err.code, err.message);
        return;
      }
      setState(MEDIA_UPLOAD_STATE.AUTHORIZING);
      try {
        session = await api.createSession({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          checksum,
        });
      } catch (cause) {
        fail(MEDIA_UPLOAD_ERROR.UPLOAD_FAILED, '업로드를 준비하지 못했습니다.', cause);
        return;
      }
      const uploaded = await directPut();
      if (!uploaded) return;
      await completeAndPoll();
    },

    cancel() {
      if (abortController) abortController.abort();
      else setState(MEDIA_UPLOAD_STATE.CANCELLED);
    },

    // Re-enter after a reload/reopen: never re-derives a new file, only asks
    // Core what the last known state of this session is.
    async recover(uploadId) {
      session = await api.getStatus(uploadId);
      if (session.state === 'EXPIRED') return setState(MEDIA_UPLOAD_STATE.EXPIRED);
      if (session.state === 'VERIFYING') return completeAndPoll();
      if (session.state === 'ACCEPTED') return setState(MEDIA_UPLOAD_STATE.ACCEPTED, {result: session.result});
      if (session.state === 'REJECTED') return setState(MEDIA_UPLOAD_STATE.REJECTED, {reason: session.reason});
      return setState(MEDIA_UPLOAD_STATE.EXPIRED);
    },

    async retry() {
      if (!session) return;
      const latest = await api.getStatus(session.upload_id);
      session = latest;
      if (latest.state === 'EXPIRED') return fail(MEDIA_UPLOAD_ERROR.SESSION_EXPIRED, '업로드 인증이 만료되었습니다. 새로 시작해 주세요.');
      if (latest.state === 'UPLOADED') return completeAndPoll();
      const uploaded = await directPut();
      if (!uploaded) return;
      await completeAndPoll();
    },
  };
}
