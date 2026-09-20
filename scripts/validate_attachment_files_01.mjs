import assert from 'node:assert/strict';
import {validateAttachmentFiles} from '../site-attachments.js';

const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, {type});
const valid = await validateAttachmentFiles([
  file([0xff, 0xd8, 0xff, 0xdb], 'receipt.jpg', 'image/jpeg'),
  file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'booking.png', 'image/png'),
  file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'ticket.webp', 'image/webp'),
  file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 'reservation.pdf', 'application/pdf'),
]);
assert.equal(valid.length, 4);

await assert.rejects(() => validateAttachmentFiles([file([0x3c, 0x73, 0x76, 0x67], 'bad.jpg', 'image/jpeg')]), /파일 내용/);
await assert.rejects(() => validateAttachmentFiles([file([0x3c, 0x68, 0x74, 0x6d, 0x6c], 'page.html', 'text\/html')]), /지원하지 않는/);
await assert.rejects(() => validateAttachmentFiles(Array.from({length: 5}, (_, i) => file([0xff, 0xd8, 0xff], `${i}.jpg`, 'image/jpeg'))), /최대 4개/);
await assert.rejects(() => validateAttachmentFiles([new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.pdf', {type: 'application/pdf'})]), /8MB/);

console.log('SITE-ATTACHMENT-FILES-01 PASS');
