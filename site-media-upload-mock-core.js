// In-memory Fake Core for the Web Media Upload client
// (site-media-upload.js) to run against until a real Core Direct Upload
// Session API exists. Used by both local dev and the CI validate_media_
// upload_*.mjs scripts — never a real network call, never a real
// Ncloud/storage credential, never anything that could reach Production.
//
//   const core = createMockCoreApi({verifyResult: () => 'ACCEPTED'});
//   const client = createMediaUploadClient({api: core.api, transport: fakeTransport});
//
// `core.api` is what site-media-upload.js consumes. The rest of `core` is
// test-only surface for inspecting/forcing session state.

let counter = 0;

export function createMockCoreApi({
  expiresInMs = 5 * 60 * 1000,
  verifyDelayMs = 0,
  verifyResult = () => 'ACCEPTED',
  now = () => Date.now(),
} = {}) {
  const sessions = new Map();

  function session(id) {
    const record = sessions.get(id);
    if (!record) throw new Error(`unknown upload session: ${id}`);
    if (record.state === 'VALID' && record.expiresAt <= now()) record.state = 'EXPIRED';
    return record;
  }

  function toPublic(record) {
    return {
      upload_id: record.id,
      state: record.state,
      method: 'PUT',
      upload_url: record.uploadUrl,
      required_headers: record.requiredHeaders,
      expires_at: new Date(record.expiresAt).toISOString(),
      reason: record.reason,
      result: record.result,
    };
  }

  const api = {
    async createSession({filename, mimeType, sizeBytes, checksum}) {
      counter += 1;
      const id = `up_${counter}`;
      const key = `chat-media/${id}/${encodeURIComponent(filename || 'upload.bin')}`;
      const record = {
        id,
        state: 'VALID',
        filename,
        mimeType,
        sizeBytes,
        checksum,
        uploadedBytesChecksum: null,
        expiresAt: now() + expiresInMs,
        // A real Presigned URL carries a signature/expiry in its query string.
        // The mock shapes one the same way so redaction/no-log tests are real.
        uploadUrl: `https://mock-storage.example.invalid/lotbi-media/${key}?X-Mock-Signature=deadbeef&X-Mock-Expires=${expiresInMs}`,
        requiredHeaders: {'Content-Type': mimeType},
        reason: null,
        result: null,
      };
      sessions.set(id, record);
      return toPublic(record);
    },

    async completeSession(id, {checksum} = {}) {
      const record = session(id);
      if (record.state === 'EXPIRED') return toPublic(record);
      if (checksum !== record.checksum) {
        record.state = 'REJECTED';
        record.reason = 'CHECKSUM_MISMATCH';
        return toPublic(record);
      }
      record.state = 'VERIFYING';
      const resolve = () => {
        record.state = verifyResult(record) === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
        if (record.state === 'REJECTED') record.reason = 'CONTENT_REJECTED';
        else record.result = {mediaId: record.id};
      };
      if (verifyDelayMs > 0) setTimeout(resolve, verifyDelayMs);
      else resolve();
      return toPublic(record);
    },

    async getStatus(id) {
      return toPublic(session(id));
    },
  };

  return {
    api,
    // Test-only helpers, never called by site-media-upload.js itself.
    markUploaded(id) {
      session(id).state = 'UPLOADED';
    },
    forceExpire(id) {
      session(id).expiresAt = now() - 1;
    },
    forceState(id, state) {
      session(id).state = state;
    },
    peek(id) {
      return toPublic(session(id));
    },
  };
}
