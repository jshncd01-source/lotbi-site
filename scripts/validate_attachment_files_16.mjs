import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_TOTAL_BYTES,
  ATTACHMENT_TEXT_MAX_BYTES,
  validateAttachmentFiles,
} from '../site-attachments.js';

const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, {type});

const valid = await validateAttachmentFiles([
  file([0xff,0xd8,0xff,0xdb], 'receipt.jpg', 'image/jpeg'),
  file([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], 'booking.png', 'image/png'),
  file([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x37], 'reservation.pdf', 'application/pdf'),
]);
assert.equal(valid.length, 3);
assert.equal(ATTACHMENT_MAX_COUNT, 3);
assert.equal(ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024);
assert.equal(ATTACHMENT_TEXT_MAX_BYTES, 2 * 1024 * 1024);
assert.equal(ATTACHMENT_MAX_TOTAL_BYTES, 20 * 1024 * 1024);

await assert.rejects(
  () => validateAttachmentFiles([file([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50], 'legacy.webp', 'image/webp')]),
  /지원하지 않는/,
);
await assert.rejects(
  () => validateAttachmentFiles([file([0x3c,0x73,0x76,0x67], 'fake.png', 'image/png')]),
  /파일 내용/,
);
await assert.rejects(
  () => validateAttachmentFiles(Array.from({length: 4}, (_, i) => file([0xff,0xd8,0xff], `${i}.jpg`, 'image/jpeg'))),
  /최대 3개/,
);
await assert.rejects(
  () => validateAttachmentFiles([new File([new Uint8Array(ATTACHMENT_MAX_BYTES + 1)], 'large.pdf', {type: 'application/pdf'})]),
  /10MB/,
);
await assert.rejects(
  () => validateAttachmentFiles([new File([new Uint8Array(ATTACHMENT_TEXT_MAX_BYTES + 1)], 'large.txt', {type: 'text/plain'})]),
  /2MB/,
);
await assert.rejects(
  () => validateAttachmentFiles([new File([new TextEncoder().encode('{bad json')], 'bad.json', {type: 'application/json'})]),
  /JSON/,
);
const text = await validateAttachmentFiles([
  new File([new TextEncoder().encode('예약 시간은 오후 7시입니다.')], 'note.txt', {type:'text/plain'}),
]);
assert.equal(text.length, 1);

console.log('SITE-CONVERSATION-ATTACHMENTS-16 FILE CONTRACT PASS');
