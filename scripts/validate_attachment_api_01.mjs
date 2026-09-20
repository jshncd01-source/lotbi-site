import assert from 'node:assert/strict';
import {uploadConversationAttachment, sendConversationMessage, sendGuestConversationMessage} from '../site-core.js';

const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], 'receipt.jpg', {type: 'image/jpeg'});
let captured;
const upload = await uploadConversationAttachment({sessionToken: 'bearer-token', file: jpeg}, async (url, options) => {
  captured = {url, options};
  return new Response(JSON.stringify({contract_id: 'CORE-CONVERSATION-ATTACHMENT-01', schema_version: 1, attachment: {id: 'att_12345678', filename: 'receipt.jpg', media_type: 'image/jpeg', size_bytes: 4, status: 'READY'}}), {status: 201, headers: {'content-type': 'application/json'}});
});
assert.equal(captured.url, 'https://api.lotbiai.com/v2/conversation/attachments');
assert.equal(captured.options.headers.Authorization, 'Bearer bearer-token');
assert.ok(captured.options.body instanceof FormData);
assert.equal(upload.id, 'att_12345678');

let authenticatedBody;
await sendConversationMessage('bearer-token', '영수증 정리해줘', async (_url, options) => {
  authenticatedBody = JSON.parse(options.body);
  return new Response(JSON.stringify({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED', assistant_text: '확인했습니다.', response_mode: 'AI_GENERATED_NON_AUTHORITATIVE', correlation_id: 'corr-1', follow_up: {required: false}, safety: {execution_authority: false, external_side_effect: false}}), {status: 200, headers: {'content-type': 'application/json'}});
}, ['att_12345678']);
assert.deepEqual(authenticatedBody.attachment_ids, ['att_12345678']);

let guestBody;
await sendGuestConversationMessage({guestToken: 'g'.repeat(40), text: '', idempotencyKey: 'guest-file-0001', attachmentIds: ['att_87654321']}, async (_url, options) => {
  guestBody = JSON.parse(options.body);
  return new Response(JSON.stringify({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED', assistant_text: '첨부를 확인했습니다.', response_mode: 'AI_GENERATED_NON_AUTHORITATIVE', correlation_id: 'corr-2', follow_up: {required: false}, safety: {execution_authority: false, external_side_effect: false}}), {status: 200, headers: {'content-type': 'application/json'}});
});
assert.equal(guestBody.text, '첨부 파일을 확인해 주세요.');
assert.deepEqual(guestBody.attachment_ids, ['att_87654321']);

console.log('SITE-ATTACHMENT-API-01 PASS');
