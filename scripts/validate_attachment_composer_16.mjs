import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const html = read('index.html');
const runtime = read('site-conversation.js');
const css = read('site-conversation.css');

for (const label of ['카메라', '사진·스크린샷', '파일']) assert.ok(html.includes(`>${label}<`), `missing attachment menu label: ${label}`);
assert.match(html, /data-attachment-trigger/);
assert.match(html, /capture="environment"/);
assert.match(html, /data-attachment-input="photos"/);
assert.match(html, /data-attachment-input="files"/);
assert.match(html, /PDF·DOCX·TXT·CSV·JSON/);
assert.doesNotMatch(html, /image\/webp/);

for (const token of [
  'validateAttachmentFiles',
  'uploadConversationAttachment',
  'deleteConversationAttachment',
  'selectedAttachments',
  'attachmentUploadsInFlight',
  'attachmentIds: attachments.map(item => item.id)',
  'sendConversationMessage(sessionToken, message, globalThis.fetch, attachments.map(item => item.id))',
  'const local = attachments.length ? null : deterministicReply(message)',
  'if (!attachments.length && isExplicitLifeCalendarCommand(message))',
]) {
  assert.ok(runtime.includes(token), `missing attachment runtime contract: ${token}`);
}
assert.match(runtime, /if \(attachments\.length\) clearSentAttachments\(\)/);
assert.doesNotMatch(runtime, /localStorage[^\n]*attachment|attachment[^\n]*localStorage/i);

for (const token of [
  '.attachment-preview-strip',
  '.attachment-chip',
  '.attachment-control',
  '.attachment-menu',
  '.attachment-button',
]) assert.ok(css.includes(token), `missing attachment CSS: ${token}`);

console.log('SITE-CONVERSATION-ATTACHMENTS-16 COMPOSER CONTRACT PASS');
