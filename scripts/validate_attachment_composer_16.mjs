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
  'authenticatedRequestId',
  'attachments.map(item => item.id)',
  'clearSentAttachments(attachments, {guest: token})',
  'clearSentAttachments(attachments, {session: activeSessionToken})',
  'const local = attachments.length ? null : deterministicReply(message)',
  'if (!attachments.length && isExplicitLifeCalendarCommand(message))',
]) {
  assert.ok(runtime.includes(token), `missing attachment runtime contract: ${token}`);
}
assert.ok(runtime.includes("timestampedConversationMessage({role: 'user', text: displayMessage, meta: {}}, sourceTurnCreatedAt)"), 'user message timestamp must preserve the original turn time without persisting attachment metadata');
assert.ok(runtime.includes("appendPersistedMessage(userRecord)"));
assert.ok(runtime.includes("meta: {attachments: attachmentMeta}"), 'attachment details may exist only in the live DOM record');
assert.ok(!runtime.includes('persistedAttachments'), 'attachment IDs and filenames must not be persisted in Site state');
assert.doesNotMatch(runtime, /ensureThread\([^\n]*fileName/);
assert.ok(runtime.includes("const displayMessage = message || `첨부 파일 ${attachments.length}개를 확인해 주세요.`"));
assert.doesNotMatch(runtime, /첨부 파일 확인:/);
assert.doesNotMatch(runtime, /localStorage[^\n]*attachment|attachment[^\n]*localStorage/i);

for (const token of [
  '.attachment-preview-strip',
  '.attachment-chip',
  '.attachment-control',
  '.attachment-menu',
  '.attachment-button',
]) assert.ok(css.includes(token), `missing attachment CSS: ${token}`);

console.log('SITE-CONVERSATION-ATTACHMENTS-16 COMPOSER CONTRACT PASS');
