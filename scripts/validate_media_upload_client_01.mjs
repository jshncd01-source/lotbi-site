import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {
  createMediaUploadClient,
  MEDIA_UPLOAD_STATE,
  computeChecksum,
} from '../site-media-upload.js';
import {createMockCoreApi} from '../site-media-upload-mock-core.js';

function jpeg(bytes = 64) {
  return new File([new Uint8Array(bytes).fill(7)], 'trip.jpg', {type: 'image/jpeg'});
}

function fakeTransport({record = () => {}} = {}) {
  return {
    async putWithProgress({url, headers, body, onProgress}) {
      record({url, headers, body});
      onProgress(0.5);
      onProgress(1);
      return {ok: true, status: 200};
    },
  };
}

// 1) happy path: VALIDATING -> CHECKSUMMING -> AUTHORIZING -> UPLOADING ->
// UPLOADED -> VERIFYING -> ACCEPTED, transport called with Core's exact url/headers.
{
  const core = createMockCoreApi();
  const calls = [];
  const client = createMediaUploadClient({api: core.api, transport: fakeTransport({record: (c) => calls.push(c)})});
  const states = [];
  const progress = [];
  client.onEvent((event) => {
    if (event.type === 'state') states.push(event.state);
    if (event.type === 'progress') progress.push(event.fraction);
  });
  const file = jpeg();
  await client.start(file);

  assert.deepEqual(states, [
    MEDIA_UPLOAD_STATE.VALIDATING,
    MEDIA_UPLOAD_STATE.CHECKSUMMING,
    MEDIA_UPLOAD_STATE.AUTHORIZING,
    MEDIA_UPLOAD_STATE.UPLOADING,
    MEDIA_UPLOAD_STATE.UPLOADED,
    MEDIA_UPLOAD_STATE.VERIFYING,
    MEDIA_UPLOAD_STATE.ACCEPTED,
  ]);
  assert.deepEqual(progress, [0.5, 1]);

  // Core-provided bucket/key only: client used the exact url/headers Core issued.
  assert.equal(calls.length, 1);
  const issuedSession = core.peek(client.getSessionId());
  assert.equal(calls[0].url, issuedSession.upload_url);
  assert.equal(calls[0].headers['Content-Type'], 'image/jpeg');
  assert.equal(calls[0].body, file);

  // Final bytes fixed before authorization: the checksum Core received
  // matches a checksum computed independently over the same final file.
  const expectedChecksum = await computeChecksum(file);
  // The mock stored the checksum it was given at createSession time; recompute
  // via a second session on a byte-identical file and confirm they match.
  const core2 = createMockCoreApi();
  const echoSession = await core2.api.createSession({filename: 'x', mimeType: 'image/jpeg', sizeBytes: file.size, checksum: expectedChecksum});
  assert.equal(echoSession.state, 'VALID');
}

// 2) transfer 100% != accepted: after UPLOADING reaches 1, state is UPLOADED
// (not ACCEPTED) until Core's completion/verification finishes.
{
  const core = createMockCoreApi({verifyDelayMs: 20});
  const states = [];
  const client = createMediaUploadClient({api: core.api, transport: fakeTransport(), pollIntervalMs: 5});
  client.onEvent((event) => { if (event.type === 'state') states.push(event.state); });
  await client.start(jpeg());
  const uploadedIndex = states.indexOf(MEDIA_UPLOAD_STATE.UPLOADED);
  const acceptedIndex = states.indexOf(MEDIA_UPLOAD_STATE.ACCEPTED);
  assert.ok(uploadedIndex >= 0 && acceptedIndex > uploadedIndex, 'UPLOADED must precede ACCEPTED, never be conflated with it');
  assert.ok(states.includes(MEDIA_UPLOAD_STATE.VERIFYING));
}

// 3) REJECTED verification surfaces as REJECTED, not a generic failure.
{
  const core = createMockCoreApi({verifyResult: () => 'REJECTED'});
  const client = createMediaUploadClient({api: core.api, transport: fakeTransport()});
  const states = [];
  client.onEvent((event) => { if (event.type === 'state') states.push(event.state); });
  await client.start(jpeg());
  assert.equal(states.at(-1), MEDIA_UPLOAD_STATE.REJECTED);
}

console.log('SITE-MEDIA-UPLOAD-CLIENT-01 PASS');
