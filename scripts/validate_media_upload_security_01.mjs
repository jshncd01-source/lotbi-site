import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {File} from 'node:buffer';
import {
  createMediaUploadClient,
  redactUploadUrl,
  MEDIA_UPLOAD_STATE,
} from '../site-media-upload.js';
import {createMockCoreApi} from '../site-media-upload-mock-core.js';

// Query strings (where a signature/expiry/access-key-id live) never survive redaction.
{
  const signed = 'https://mock-storage.example.invalid/lotbi-media/chat-media/up_1/photo.jpg?X-Mock-Signature=deadbeef&X-Mock-Expires=300000';
  const redacted = redactUploadUrl(signed);
  assert.equal(redacted, 'https://mock-storage.example.invalid/lotbi-media/chat-media/up_1/photo.jpg');
  assert.ok(!redacted.includes('Signature'));
  assert.ok(!redacted.includes('deadbeef'));
  assert.equal(redactUploadUrl(''), '');
  assert.equal(redactUploadUrl('not a url'), 'not a url');
}

// No client bundle source contains a storage secret / long-lived credential
// shape. This is a source-level guard, not a substitute for real secret
// scanning, but it keeps an obviously wrong pattern from ever landing here.
{
  const forbidden = [
    /secret[_-]?access[_-]?key/i,
    /ncp[_-]?(access|secret)[_-]?key/i,
    /AKIA[0-9A-Z]{16}/,
    /BEGIN (RSA |EC )?PRIVATE KEY/,
  ];
  for (const path of ['../site-media-upload.js', '../site-media-upload-mock-core.js', '../site-media-upload-ui.js']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `${path} must not contain ${pattern}`);
    }
    // Match actual API usage (a property/method access), not this file's own
    // doc comments explaining that those APIs are deliberately never used.
    assert.ok(!/localStorage\s*[.[]/.test(source), `${path} must never persist upload state to localStorage`);
    assert.ok(!/sessionStorage\s*[.[]/.test(source), `${path} must never persist upload state to sessionStorage`);
    assert.ok(!/indexedDB\s*[.[]/i.test(source), `${path} must never persist upload state to indexedDB`);
  }
}

// An error surfaced to the caller must never carry the full signed URL —
// only a code + a user-safe Korean message.
{
  const core = createMockCoreApi();
  const alwaysFails = {async putWithProgress() { throw new Error('down'); }};
  const client = createMediaUploadClient({api: core.api, transport: alwaysFails});
  const events = [];
  client.onEvent((e) => events.push(e));
  await client.start(new File([new Uint8Array(16)], 'trip.jpg', {type: 'image/jpeg'}));
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes('X-Mock-Signature'), 'events must never carry the signed URL query string');
}

// Reload/reopen recovery re-queries Core status; it never re-issues an
// upload from a persisted Presigned URL and never re-uploads a new file.
{
  const core = createMockCoreApi();
  const session = await core.api.createSession({filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10, checksum: 'x'});
  await core.api.completeSession(session.upload_id, {checksum: 'x'});
  let putCalled = false;
  const client = createMediaUploadClient({api: core.api, transport: {async putWithProgress() { putCalled = true; return {ok: true}; }}});
  await client.recover(session.upload_id);
  assert.equal(putCalled, false, 'recover() must never trigger a fresh PUT');
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.ACCEPTED);
}

// Recovering an expired session gives the friendly 72h-style expiry UX, not
// a silent no-op and not a fresh re-upload attempt.
{
  const core = createMockCoreApi();
  const session = await core.api.createSession({filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10, checksum: 'x'});
  core.forceExpire(session.upload_id);
  const client = createMediaUploadClient({api: core.api, transport: {async putWithProgress() { throw new Error('must not be called'); }}});
  await client.recover(session.upload_id);
  assert.equal(client.getState(), MEDIA_UPLOAD_STATE.EXPIRED);
}

console.log('SITE-MEDIA-UPLOAD-SECURITY-01 PASS');
