import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {
  createMediaUploadClient,
  MEDIA_UPLOAD_STATE,
  MEDIA_UPLOAD_ERROR,
  validateLocalMedia,
} from '../site-media-upload.js';
import {createMockCoreApi} from '../site-media-upload-mock-core.js';

function jpeg(bytes = 32) {
  return new File([new Uint8Array(bytes)], 'trip.jpg', {type: 'image/jpeg'});
}

function okTransport() {
  return {async putWithProgress({onProgress}) { onProgress(1); return {ok: true, status: 200}; }};
}

// Local pre-validation UX: unsupported type / oversize are classified, not
// generic — and they are surfaced before any network call is ever made.
{
  assert.throws(
    () => validateLocalMedia(new File([new Uint8Array(4)], 'a.gif', {type: 'image/gif'})),
    (err) => err.code === MEDIA_UPLOAD_ERROR.UNSUPPORTED_TYPE,
  );
  assert.throws(
    () => validateLocalMedia(new File([new Uint8Array(20)], 'a.jpg', {type: 'image/jpeg'}), {maxBytes: 10}),
    (err) => err.code === MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE,
  );

  const core = createMockCoreApi();
  let sessionsCreated = 0;
  const spyApi = {...core.api, createSession: (...args) => { sessionsCreated += 1; return core.api.createSession(...args); }};
  const client = createMediaUploadClient({api: spyApi, transport: okTransport()});
  const events = [];
  client.onEvent((e) => events.push(e));
  await client.start(new File([new Uint8Array(4)], 'a.gif', {type: 'image/gif'}));
  assert.equal(sessionsCreated, 0, 'unsupported file must never reach the upload-session API');
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.FAILED);
  assert.ok(events.some((e) => e.type === 'error' && e.code === MEDIA_UPLOAD_ERROR.UNSUPPORTED_TYPE));
}

// Upload cancel: aborting mid-transfer lands on CANCELLED, not FAILED, and
// Core's session is left exactly as-is (cancel does not assume the object is
// absent from storage — that's Core's cleanup to own).
{
  const core = createMockCoreApi();
  const hangingTransport = {
    putWithProgress({signal}) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('upload aborted')));
      });
    },
  };
  const client = createMediaUploadClient({api: core.api, transport: hangingTransport});
  const events = [];
  client.onEvent((e) => events.push(e));
  const started = client.start(jpeg());
  // let it reach UPLOADING before cancelling
  while (client.getState() !== MEDIA_UPLOAD_STATE.UPLOADING) {
    await new Promise((r) => setTimeout(r, 1));
  }
  client.cancel();
  await started;
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.CANCELLED);
}

// Cancel during VERIFYING (after the PUT already succeeded) must actually
// stop the completion poll loop and land on CANCELLED — not silently keep
// polling to ACCEPTED/REJECTED behind the caller's back.
{
  const core = createMockCoreApi({verifyDelayMs: 200});
  const client = createMediaUploadClient({api: core.api, transport: okTransport(), pollIntervalMs: 20});
  const states = [];
  client.onEvent((e) => { if (e.type === 'state') states.push(e.state); });
  const started = client.start(jpeg());
  while (client.getState() !== MEDIA_UPLOAD_STATE.VERIFYING) {
    await new Promise((r) => setTimeout(r, 5));
  }
  client.cancel();
  await started;
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.CANCELLED);
  // Wait past when verification would otherwise have resolved, to prove the
  // poll loop actually stopped rather than overwriting CANCELLED later.
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.CANCELLED, 'a stopped poll loop must not resurface later as ACCEPTED/REJECTED');
  assert.equal(states.at(-1), MEDIA_UPLOAD_STATE.CANCELLED);
}

// Retry contract: a transient network failure re-checks status first; if the
// session is still valid it retries the PUT and succeeds.
{
  const core = createMockCoreApi();
  let attempts = 0;
  const flaky = {
    async putWithProgress({onProgress}) {
      attempts += 1;
      if (attempts === 1) throw new Error('ECONNRESET');
      onProgress(1);
      return {ok: true, status: 200};
    },
  };
  const client = createMediaUploadClient({api: core.api, transport: flaky});
  await client.start(jpeg());
  assert.equal(attempts, 2);
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.ACCEPTED);
}

// Retry contract: if Core reports the object already landed, the client
// skips re-PUTting entirely and moves straight to completion. The fake
// transport marks the session UPLOADED itself, right before failing, to
// deterministically simulate "the bytes landed but the ack was lost" without
// racing a timer against the client's own (all-microtask) retry path.
{
  const core = createMockCoreApi();
  let putCalls = 0;
  let client;
  const failsOnce = {
    async putWithProgress() {
      putCalls += 1;
      if (putCalls === 1) {
        core.markUploaded(client.getSessionId());
        throw new Error('network blip after the PUT actually landed');
      }
      throw new Error('must not be called again');
    },
  };
  client = createMediaUploadClient({api: core.api, transport: failsOnce});
  await client.start(jpeg());
  assert.equal(putCalls, 1, 'must not re-PUT once Core says the object already landed');
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.ACCEPTED);
}

// Expired auth is never endlessly retried: SESSION_EXPIRED is terminal.
{
  const core = createMockCoreApi();
  let putCalls = 0;
  let client;
  const alwaysFails = {
    async putWithProgress() {
      putCalls += 1;
      core.forceExpire(client.getSessionId());
      throw new Error('down');
    },
  };
  client = createMediaUploadClient({api: core.api, transport: alwaysFails});
  await client.start(jpeg());
  assert.equal(putCalls, 1, 'an expired session must not be retried');
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.FAILED);
}

// After exhausting retries on a genuine network failure (session still
// valid), the client stops and reports NETWORK_ERROR rather than looping.
{
  const core = createMockCoreApi();
  let attempts = 0;
  const alwaysNetworkError = {async putWithProgress() { attempts += 1; throw new Error('down'); }};
  const client = createMediaUploadClient({api: core.api, transport: alwaysNetworkError});
  const events = [];
  client.onEvent((e) => events.push(e));
  await client.start(jpeg());
  assert.ok(attempts <= 3, `must not retry forever, saw ${attempts} attempts`);
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.FAILED);
  assert.ok(events.some((e) => e.type === 'error' && e.code === MEDIA_UPLOAD_ERROR.NETWORK_ERROR));
}

console.log('SITE-MEDIA-UPLOAD-ERRORS-01 PASS');
