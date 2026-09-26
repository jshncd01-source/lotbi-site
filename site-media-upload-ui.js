// Compact status copy/rendering for the Web Media Upload client
// (site-media-upload.js). Deliberately small: "전송 100%" is not "저장
// 완료" — the caller shows this alongside its own attachment UI rather than
// blocking on it, and a failure collapses to one line rather than a grey
// placeholder block (LOTBI's existing UX rule for failed/unloaded media).
//
// Not wired into site-conversation.js / site-attachments.js yet: Core has
// no Direct Upload contract for this client to speak to in production, so
// wiring it into the live Chat composer would be dead UI. This module is
// the reusable piece ready for that integration once STRUCTURE-03/05 (or
// whatever Core actually ships) exists and its owner reconciles it in.

import {MEDIA_UPLOAD_STATE, MEDIA_UPLOAD_ERROR} from './site-media-upload.js?v=aset-3da93cec543f';

const ERROR_COPY = Object.freeze({
  [MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE]: '사진 용량이 너무 큽니다.',
  [MEDIA_UPLOAD_ERROR.UNSUPPORTED_TYPE]: '지원하지 않는 사진 형식입니다.',
  [MEDIA_UPLOAD_ERROR.CHECKSUM_FAILED]: '사진 정보를 확인하지 못했습니다.',
  [MEDIA_UPLOAD_ERROR.UPLOAD_AUTH_EXPIRED]: '업로드 인증이 만료되었습니다. 새로 시작해 주세요.',
  [MEDIA_UPLOAD_ERROR.NETWORK_ERROR]: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
  [MEDIA_UPLOAD_ERROR.CORS_ERROR]: '지금은 업로드할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  [MEDIA_UPLOAD_ERROR.UPLOAD_FAILED]: '업로드에 실패했습니다. 다시 시도해 주세요.',
  [MEDIA_UPLOAD_ERROR.VERIFICATION_REJECTED]: '이 사진은 저장할 수 없어요.',
  [MEDIA_UPLOAD_ERROR.SESSION_EXPIRED]: '저장하지 않은 임시 사진이 만료되었습니다.',
  [MEDIA_UPLOAD_ERROR.RATE_LIMITED]: '잠시 후 다시 시도해 주세요.',
  [MEDIA_UPLOAD_ERROR.QUOTA_EXCEEDED]: '업로드 용량 한도를 넘었습니다.',
  [MEDIA_UPLOAD_ERROR.UNKNOWN]: '문제가 발생했습니다. 다시 시도해 주세요.',
});

// {message, tone, busy} — `tone` is one of 'progress' | 'success' | 'error',
// for the caller's own compact status chip; this module renders no DOM by
// itself so it never needs to know the caller's markup.
export function describeUploadState(state, meta = {}) {
  switch (state) {
    case MEDIA_UPLOAD_STATE.IDLE:
      return {message: '', tone: 'progress', busy: false};
    case MEDIA_UPLOAD_STATE.VALIDATING:
    case MEDIA_UPLOAD_STATE.CHECKSUMMING:
    case MEDIA_UPLOAD_STATE.AUTHORIZING:
      return {message: '준비 중', tone: 'progress', busy: true};
    case MEDIA_UPLOAD_STATE.UPLOADING: {
      const pct = Math.round((meta.progress ?? 0) * 100);
      return {message: `업로드 중 ${pct}%`, tone: 'progress', busy: true};
    }
    case MEDIA_UPLOAD_STATE.UPLOADED:
      return {message: '업로드 완료, 확인 준비 중', tone: 'progress', busy: true};
    case MEDIA_UPLOAD_STATE.VERIFYING:
      return {message: '사진을 확인하고 있어요', tone: 'progress', busy: true};
    case MEDIA_UPLOAD_STATE.ACCEPTED:
      return {message: '저장 완료', tone: 'success', busy: false};
    case MEDIA_UPLOAD_STATE.REJECTED:
      return {message: ERROR_COPY[MEDIA_UPLOAD_ERROR.VERIFICATION_REJECTED], tone: 'error', busy: false};
    case MEDIA_UPLOAD_STATE.EXPIRED:
      return {message: ERROR_COPY[MEDIA_UPLOAD_ERROR.SESSION_EXPIRED], tone: 'error', busy: false};
    case MEDIA_UPLOAD_STATE.CANCELLED:
      return {message: '업로드를 취소했어요', tone: 'error', busy: false};
    case MEDIA_UPLOAD_STATE.FAILED:
      return {message: ERROR_COPY[meta.code] || ERROR_COPY[MEDIA_UPLOAD_ERROR.UNKNOWN], tone: 'error', busy: false};
    default:
      return {message: '', tone: 'progress', busy: false};
  }
}

// A minimal, dependency-injected DOM builder (so it is testable without a
// browser/JSDOM: pass a fake `doc` with a `createElement`). Compact by
// design — no full-width grey placeholder, just a line + a thin bar.
export function renderCompactUploadStatus(state, meta = {}, doc = globalThis.document) {
  const {message, tone, busy} = describeUploadState(state, meta);
  const root = doc.createElement('div');
  root.className = `lotbi-media-upload-status lotbi-media-upload-status--${tone.toLowerCase()}`;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', String(!!busy));
  const text = doc.createElement('span');
  text.className = 'lotbi-media-upload-status__text';
  text.textContent = message;
  root.appendChild(text);
  if (state === MEDIA_UPLOAD_STATE.UPLOADING) {
    const bar = doc.createElement('progress');
    bar.className = 'lotbi-media-upload-status__bar';
    bar.max = 1;
    bar.value = meta.progress ?? 0;
    root.appendChild(bar);
  }
  return root;
}
