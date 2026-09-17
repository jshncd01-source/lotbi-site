import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');
const {sendConversationMessage, SiteCoreError} = await import('../site-core.js');

const memorySession = new Map();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem(key) { return memorySession.has(key) ? memorySession.get(key) : null; },
    setItem(key, value) { memorySession.set(key, String(value)); },
    removeItem(key) { memorySession.delete(key); },
  },
});

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
  assert.equal(memorySession.size, 0, 'validated 200 contract must clear pending retry identity');
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

{
  // A transport failure has no trustworthy server outcome. Preserve the old key so an
  // F5/re-created UI that supplies a fresh key for the same message still reuses the
  // uncertain logical identity rather than risking a second FREE charge.
  let caught;
  try {
    await sendConversationMessage(
      'site-memory-token',
      'F5 네트워크 불확실 요청',
      {idempotencyKey: 'chat-refresh-original-0001'},
      async () => { throw new TypeError('network lost after request'); },
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteCoreError);
  assert.equal(caught.code, 'WEB_CONVERSATION_NETWORK_ERROR');
  assert.equal(caught.retryable, true);

  let retriedRequest;
  const reply = await sendConversationMessage(
    'site-memory-token',
    'F5 네트워크 불확실 요청',
    {idempotencyKey: 'chat-refresh-new-0002'},
    async (url, init) => {
      retriedRequest = {url, init};
      return jsonResponse(successfulConversation());
    },
  );
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(retriedRequest.init.headers['Idempotency-Key'], 'chat-refresh-original-0001');
  assert.equal(memorySession.size, 0);
}

{
  // A syntactically successful HTTP response with an invalid LOTBI contract remains
  // uncertain: Core may have completed/charged before an intermediary corrupted the
  // payload. Keep the original key for the next same-message attempt.
  let caught;
  try {
    await sendConversationMessage(
      'site-memory-token',
      '계약 파손 불확실 요청',
      {idempotencyKey: 'chat-contract-original-0001'},
      async () => jsonResponse({contract_id: 'BROKEN'}),
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteCoreError);
  assert.equal(caught.code, 'WEB_CONVERSATION_CONTRACT_INVALID');

  let retriedRequest;
  await sendConversationMessage(
    'site-memory-token',
    '계약 파손 불확실 요청',
    {idempotencyKey: 'chat-contract-new-0002'},
    async (url, init) => {
      retriedRequest = {url, init};
      return jsonResponse(successfulConversation());
    },
  );
  assert.equal(retriedRequest.init.headers['Idempotency-Key'], 'chat-contract-original-0001');
  assert.equal(memorySession.size, 0);
}

{
  // A structured Core provider failure is explicitly zero-unit. It is safe to clear
  // the pending key; a later new submission may have its own fresh logical identity.
  let caught;
  try {
    await sendConversationMessage(
      'site-memory-token',
      '명확한 provider 실패 요청',
      {idempotencyKey: 'chat-provider-failed-0001'},
      async () => jsonResponse({
        detail: {
          code: 'AI_PROVIDER_UNAVAILABLE',
          message: 'temporarily unavailable',
          retryable: true,
          correlation_id: 'req-provider-failed',
        },
      }, 503),
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteCoreError);
  assert.equal(caught.code, 'AI_PROVIDER_UNAVAILABLE');
  assert.equal(memorySession.size, 0);

  let newRequest;
  await sendConversationMessage(
    'site-memory-token',
    '명확한 provider 실패 요청',
    {idempotencyKey: 'chat-provider-fresh-0002'},
    async (url, init) => {
      newRequest = {url, init};
      return jsonResponse(successfulConversation());
    },
  );
  assert.equal(newRequest.init.headers['Idempotency-Key'], 'chat-provider-fresh-0002');
}

{
  // Multiple unresolved messages must not overwrite one another. Each later same-text
  // attempt recovers its own original key and clears only that entry after success.
  const failNetwork = async () => { throw new TypeError('uncertain network'); };
  for (const [message, key] of [
    ['첫 번째 unresolved 요청', 'chat-multi-original-a-0001'],
    ['두 번째 unresolved 요청', 'chat-multi-original-b-0001'],
  ]) {
    let caught;
    try {
      await sendConversationMessage('site-memory-token', message, {idempotencyKey: key}, failNetwork);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof SiteCoreError);
    assert.equal(caught.code, 'WEB_CONVERSATION_NETWORK_ERROR');
  }

  assert.equal(memorySession.size, 1, 'bounded pending entries share one sessionStorage record');
  const pending = JSON.parse([...memorySession.values()][0]);
  assert.equal(pending.entries.length, 2);

  let firstRetry;
  await sendConversationMessage(
    'site-memory-token',
    '첫 번째 unresolved 요청',
    {idempotencyKey: 'chat-multi-new-a-0002'},
    async (url, init) => {
      firstRetry = {url, init};
      return jsonResponse(successfulConversation());
    },
  );
  assert.equal(firstRetry.init.headers['Idempotency-Key'], 'chat-multi-original-a-0001');
  const afterFirst = JSON.parse([...memorySession.values()][0]);
  assert.equal(afterFirst.entries.length, 1);
  assert.equal(afterFirst.entries[0].idempotencyKey, 'chat-multi-original-b-0001');

  let secondRetry;
  await sendConversationMessage(
    'site-memory-token',
    '두 번째 unresolved 요청',
    {idempotencyKey: 'chat-multi-new-b-0002'},
    async (url, init) => {
      secondRetry = {url, init};
      return jsonResponse(successfulConversation());
    },
  );
  assert.equal(secondRetry.init.headers['Idempotency-Key'], 'chat-multi-original-b-0001');
  assert.equal(memorySession.size, 0);
}

const core = read('site-core.js');
const conversation = read('site-conversation.js');

for (const token of [
  "const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,160}$/u",
  "const PENDING_CONVERSATION_STORAGE_KEY = 'lotbi.site.conversation.pending.v1'",
  'const PENDING_CONVERSATION_LIMIT = 20',
  "headers['Idempotency-Key'] = effectiveIdempotencyKey",
  'rememberPendingConversation(message, effectiveIdempotencyKey)',
  'clearPendingConversation(message, effectiveIdempotencyKey)',
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
assert.ok(!core.includes('sessionStorage.setItem'), 'retry persistence must never write through an unguarded global sessionStorage reference');

console.log('SITE-FREE-USAGE-RETRY-IDENTITY-01 CONTRACT PASS');
