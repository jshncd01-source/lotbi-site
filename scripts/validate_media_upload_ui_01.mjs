import assert from 'node:assert/strict';
import {describeUploadState, renderCompactUploadStatus} from '../site-media-upload-ui.js';
import {MEDIA_UPLOAD_STATE, MEDIA_UPLOAD_ERROR} from '../site-media-upload.js';

// A minimal fake DOM: just enough for renderCompactUploadStatus, so this
// stays a plain Node test instead of needing a real browser.
class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  appendChild(child) { this.children.push(child); return child; }
}
const fakeDoc = {createElement: (tag) => new FakeElement(tag)};

// Transfer 100% must never read as "저장 완료" — VERIFYING/UPLOADED get
// their own compact copy distinct from ACCEPTED.
{
  const uploaded = describeUploadState(MEDIA_UPLOAD_STATE.UPLOADED);
  const verifying = describeUploadState(MEDIA_UPLOAD_STATE.VERIFYING);
  const accepted = describeUploadState(MEDIA_UPLOAD_STATE.ACCEPTED);
  assert.notEqual(uploaded.message, accepted.message);
  assert.notEqual(verifying.message, accepted.message);
  assert.equal(accepted.tone, 'success');
  assert.equal(uploaded.busy, true);
  assert.equal(accepted.busy, false);
}

// REJECTED / EXPIRED / cancelled each get a distinct, user-safe message —
// never a raw provider error.
{
  const rejected = describeUploadState(MEDIA_UPLOAD_STATE.REJECTED);
  const expired = describeUploadState(MEDIA_UPLOAD_STATE.EXPIRED);
  const cancelled = describeUploadState(MEDIA_UPLOAD_STATE.CANCELLED);
  assert.equal(rejected.tone, 'error');
  assert.equal(expired.tone, 'error');
  assert.notEqual(rejected.message, expired.message);
  assert.notEqual(rejected.message, cancelled.message);
  assert.match(expired.message, /만료/);
}

// Every declared error code maps to a non-empty Korean message with no raw
// provider text (checked indirectly: message must not contain 'Error' or a
// stack-trace-shaped token).
{
  for (const code of Object.values(MEDIA_UPLOAD_ERROR)) {
    const described = describeUploadState(MEDIA_UPLOAD_STATE.FAILED, {code});
    assert.ok(described.message && described.message.length > 0, `missing copy for ${code}`);
    assert.ok(!/Error|Exception|stack/i.test(described.message), `${code} leaked a raw error shape: ${described.message}`);
  }
}

// Progress renders a compact status chip (accessible, no full-width grey
// placeholder) with a progress bar only while uploading.
{
  const uploading = renderCompactUploadStatus(MEDIA_UPLOAD_STATE.UPLOADING, {progress: 0.42}, fakeDoc);
  assert.equal(uploading.attributes.role, 'status');
  assert.equal(uploading.attributes['aria-live'], 'polite');
  assert.equal(uploading.attributes['aria-busy'], 'true');
  assert.ok(uploading.className.includes('lotbi-media-upload-status'));
  const bar = uploading.children.find((c) => c.tagName === 'progress');
  assert.ok(bar, 'uploading state must render a progress bar');
  assert.equal(bar.value, 0.42);

  const accepted = renderCompactUploadStatus(MEDIA_UPLOAD_STATE.ACCEPTED, {}, fakeDoc);
  assert.equal(accepted.attributes['aria-busy'], 'false');
  assert.ok(!accepted.children.some((c) => c.tagName === 'progress'), 'a settled state renders no progress bar');
}

console.log('SITE-MEDIA-UPLOAD-UI-01 PASS');
