import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {
  deleteConversationAttachment,
  sendConversationMessage,
  sendGuestConversationMessage,
  uploadConversationAttachment,
} from '../site-core.js';

const attachmentPayload = {
  contract_id: 'CORE-CONVERSATION-ATTACHMENT-01',
  attachment: {
    attachment_id: 'att_1234567890abcdef1234',
    file_name: 'receipt.png',
    mime_type: 'image/png',
    media_kind: 'IMAGE',
    size_bytes: 8,
    expires_at: '2099-01-01T00:00:00+00:00',
  },
};
const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'receipt.png', {type:'image/png'});

let request;
const userAttachment = await uploadConversationAttachment({sessionToken:'site-token', file:png}, async (url, options) => {
  request = {url, options};
  return new Response(JSON.stringify(attachmentPayload), {status:200, headers:{'content-type':'application/json'}});
});
assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/attachments');
assert.equal(request.options.headers.Authorization, 'Bearer site-token');
assert.ok(request.options.body instanceof FormData);
assert.equal(userAttachment.id, 'att_1234567890abcdef1234');
assert.equal(userAttachment.fileName, 'receipt.png');

await uploadConversationAttachment({guestToken:'g'.repeat(40), file:png}, async (url, options) => {
  assert.equal(url, 'https://api.lotbiai.com/v2/conversation/guest/attachments');
  assert.equal(options.headers['X-LOTBI-Guest-Token'], 'g'.repeat(40));
  assert.equal(options.headers.Authorization, undefined);
  return new Response(JSON.stringify(attachmentPayload), {status:200, headers:{'content-type':'application/json'}});
});

let authBody;
await sendConversationMessage('site-token', '', async (_url, options) => {
  authBody = JSON.parse(options.body);
  return new Response(JSON.stringify({
    contract_id:'CORE-WEB-CHAT-01', schema_version:1, status:'ANSWERED',
    assistant_text:'첨부를 확인했습니다.', response_mode:'AI_GENERATED_NON_AUTHORITATIVE',
    correlation_id:'corr-auth', follow_up:{required:false},
  }), {status:200, headers:{'content-type':'application/json'}});
}, ['att_1234567890abcdef1234']);
assert.equal(authBody.text, '첨부 파일을 확인해 주세요.');
assert.deepEqual(authBody.attachment_ids, ['att_1234567890abcdef1234']);

let guestBody;
await sendGuestConversationMessage({
  guestToken:'g'.repeat(40),
  text:'',
  idempotencyKey:'guest-attach-0001',
  attachmentIds:['att_1234567890abcdef1234'],
}, async (_url, options) => {
  guestBody = JSON.parse(options.body);
  return new Response(JSON.stringify({
    contract_id:'CORE-WEB-CHAT-01', schema_version:1, status:'ANSWERED',
    assistant_text:'첨부를 확인했습니다.', response_mode:'AI_GENERATED_NON_AUTHORITATIVE',
    correlation_id:'corr-guest', follow_up:{required:false},
    safety:{execution_authority:false, external_side_effect:false},
  }), {status:200, headers:{'content-type':'application/json'}});
});
assert.equal(guestBody.text, '첨부 파일을 확인해 주세요.');
assert.deepEqual(guestBody.attachment_ids, ['att_1234567890abcdef1234']);

await deleteConversationAttachment({sessionToken:'site-token', attachmentId:'att_1234567890abcdef1234'}, async (url, options) => {
  assert.equal(url, 'https://api.lotbiai.com/v2/conversation/attachments/att_1234567890abcdef1234');
  assert.equal(options.method, 'DELETE');
  return new Response(null, {status:204});
});
await deleteConversationAttachment({guestToken:'g'.repeat(40), attachmentId:'att_1234567890abcdef1234'}, async (url, options) => {
  assert.equal(url, 'https://api.lotbiai.com/v2/conversation/guest/attachments/att_1234567890abcdef1234');
  assert.equal(options.headers['X-LOTBI-Guest-Token'], 'g'.repeat(40));
  return new Response(null, {status:204});
});

await assert.rejects(
  () => sendConversationMessage('site-token', 'test', globalThis.fetch, ['att_invalid']),
  error => error?.code === 'CONVERSATION_ATTACHMENT_REFERENCE_INVALID',
);

console.log('SITE-CONVERSATION-ATTACHMENTS-16 API CONTRACT PASS');
