import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');
const {sendConversationMessage, SiteCoreError} = await import('../site-core.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function successfulConversation() {
  return {
    contract_id: 'CORE-WEB-CHAT-01',
    schema_version: 1,
    correlation_id: 'req-free-usage-test',
    status: 'ANSWERED',
    assistant_text: 'retry-safe response',
    intent: {action: 'UNKNOWN'},
    response_mode: 'MODEL',
    follow_up: {required: false, action: null, reason: null, automatic_execution: false},
    retry_safe: true,
    safety: {execution_authority: false, external_side_effect: false},
  };
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse(successfulConversation());
  };
  const reply = await sendConversationMessage(
    'site-memory-token',
    '원격 AI 요청',
    {idempotencyKey: 'chat-logical-unit-0001'},
    fetchMock,
  );
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/messages');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.mode, 'cors');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.cache, 'no-store');
  assert.equal(request.init.referrerPolicy, 'no-referrer');
  assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.equal(request.init.headers['Idempotency-Key'], 'chat-logical-unit-0001');
  assert.deepEqual(JSON.parse(request.init.body), {text: '원격 AI 요청'});
}

{
  let fetchCalled = false;
  let caught;
  try {
    await sendConversationMessage(
      'site-memory-token',
      '원격 AI 요청',
      {idempotencyKey: 'bad key'},
      async () => {
        fetchCalled = true;
        return jsonResponse(successfulConversation());
      },
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteCoreError);
  assert.equal(caught.code, 'INVALID_IDEMPOTENCY_KEY');
  assert.equal(caught.status, 400);
  assert.equal(fetchCalled, false, 'invalid logical identity must fail before network I/O');
}

{
  // Preserve the pre-existing third-argument fetchMock contract for older validators/callers.
  let request;
  const reply = await sendConversationMessage('site-memory-token', '호환성 요청', async (url, init) => {
    request = {url, init};
    return jsonResponse(successfulConversation());
  });
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(request.init.headers['Idempotency-Key'], undefined);
}

const core = read('site-core.js');
const conversation = read('site-conversation.js');

for (const token of [
  "const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,160}$/u",
  "headers['Idempotency-Key'] = request.idempotencyKey",
]) assert.ok(core.includes(token), `missing Site Core idempotency contract: ${token}`);

for (const token of [
  "const logicalRequestId = retryIdempotencyKey || newId('chat')",
  'sendConversationMessage(sessionToken, message, {idempotencyKey: logicalRequestId})',
  'showError(caught, message, true, logicalRequestId)',
  'requestAssistant(retryText, !retryWithoutDuplicate, retryIdempotencyKey)',
]) assert.ok(conversation.includes(token), `missing retry identity contract: ${token}`);

assert.ok(
  conversation.indexOf("const local = deterministicReply(message)")
    < conversation.indexOf("const logicalRequestId = retryIdempotencyKey || newId('chat')"),
  'deterministic local replies must be resolved before a billable Core logical identity is created',
);

assert.ok(!conversation.includes('localStorage.setItem') || conversation.includes('STORAGE_PREFIX'));
assert.ok(!core.includes('credentials: \'include\''), 'Site child bearer boundary must continue using credentials=omit');

console.log('SITE-FREE-USAGE-RETRY-IDENTITY-01 CONTRACT PASS');
