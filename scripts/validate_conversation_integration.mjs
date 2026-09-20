import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {
  CORE_ORIGIN,
  SITE_AUDIENCE,
  SITE_CALLBACK_URI,
  SiteCoreError,
  createGuestConversationSession,
  getCurrentSiteUser,
  logoutSiteSession,
  redeemSiteHandoff,
  sendConversationMessage,
  sendGuestConversationMessage,
} = await import('../site-core.js?v=20260920-attachments1');
const {
  ACCOUNT_SITE_HANDOFF_URL,
  HANDOFF_CONTEXT_KEY,
  HANDOFF_CONTEXT_TTL_MS,
  SiteHandoffClientError,
  createSiteHandoffContext,
  readAndClearSiteHandoffContext,
  storeSiteHandoffContext,
} = await import('../site-auth.js?v=20260920-authux1');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

{
  const requests = [];
  const fetchMock = async (url, init) => {
    requests.push({url, init});
    if (url.endsWith('/v2/me')) return jsonResponse({
      user: {id: 'user-1', name: '전선혜', account_handle: 'lotbi_user.01'},
      session: {id: 'site-session-1', assurance_level: 'FULL', expires_at: '2030-01-01T00:00:00Z'},
      installation: {id: 'installation-1'},
    });
    return jsonResponse({session_id: 'site-session-1', status: 'REVOKED'});
  };
  const identity = await getCurrentSiteUser('site-memory-token', fetchMock);
  assert.deepEqual(identity, {
    userId: 'user-1', name: '전선혜', accountHandle: 'lotbi_user.01',
    sessionId: 'site-session-1', installationId: 'installation-1', expiresAt: '2030-01-01T00:00:00Z',
  });
  const logout = await logoutSiteSession('site-memory-token', fetchMock);
  assert.deepEqual(logout, {sessionId: 'site-session-1', status: 'REVOKED'});
  assert.equal(requests[0].url, 'https://api.lotbiai.com/v2/me');
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[1].url, 'https://api.lotbiai.com/v2/sessions/logout');
  assert.equal(requests[1].init.method, 'POST');
  for (const request of requests) {
    assert.equal(request.init.credentials, 'omit');
    assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

async function expectReject(promise, code) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `expected rejection ${code}`);
  assert.equal(caught.code, code);
}

assert.equal(CORE_ORIGIN, 'https://api.lotbiai.com');
assert.equal(SITE_AUDIENCE, 'lotbiai.com');
assert.equal(SITE_CALLBACK_URI, 'https://lotbiai.com/auth/callback');
assert.equal(ACCOUNT_SITE_HANDOFF_URL, 'https://account.lotbiai.com/auth/site-handoff');

const now = 1_800_000_000_000;
const context = await createSiteHandoffContext('첫 실제 메시지', now);
assert.equal(context.version, 1);
assert.match(context.state, /^[A-Za-z0-9_-]{43}$/);
assert.match(context.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
assert.match(context.codeChallenge, /^[A-Za-z0-9_-]{43}$/);
assert.notEqual(context.codeVerifier, context.codeChallenge);

{
  const storage = new MemoryStorage();
  storeSiteHandoffContext(context, storage);
  assert.ok(storage.getItem(HANDOFF_CONTEXT_KEY));
  assert.throws(
    () => readAndClearSiteHandoffContext('different-state-0123456789', storage, now + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_STATE_MISMATCH',
  );
  assert.equal(storage.getItem(HANDOFF_CONTEXT_KEY), null, 'state mismatch must consume local handoff context');
}

{
  const storage = new MemoryStorage();
  storage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify({...context, codeVerifier: ''}));
  assert.throws(
    () => readAndClearSiteHandoffContext(context.state, storage, now + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_CONTEXT_INVALID',
  );
}

{
  const storage = new MemoryStorage();
  storeSiteHandoffContext(context, storage);
  assert.throws(
    () => readAndClearSiteHandoffContext(context.state, storage, now + HANDOFF_CONTEXT_TTL_MS + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_CONTEXT_INVALID',
  );
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse({
      session_token: 'site-session-token-only-for-unit-test',
      session_type: 'Bearer',
      session_id: 'session-1',
      installation_id: 'installation-1',
      assurance_level: 'FULL',
      audience: 'lotbiai.com',
      expires_at: '2030-01-01T00:00:00Z',
    });
  };
  const session = await redeemSiteHandoff({
    handoffCode: 'h'.repeat(43),
    state: context.state,
    codeVerifier: context.codeVerifier,
  }, fetchMock);
  assert.equal(session.sessionToken, 'site-session-token-only-for-unit-test');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/sessions/handoffs/redeem');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(request.init.headers, {'Content-Type': 'application/json'});
  const body = JSON.parse(request.init.body);
  assert.equal(body.audience, 'lotbiai.com');
  assert.equal(body.callback_uri, 'https://lotbiai.com/auth/callback');
  assert.equal(body.handoff_code, 'h'.repeat(43));
  assert.equal(body.code_verifier, context.codeVerifier);
  assert.ok(!('authorization' in Object.fromEntries(Object.entries(request.init.headers).map(([key, value]) => [key.toLowerCase(), value]))));
}

for (const code of ['SITE_HANDOFF_REPLAY_OR_INVALID', 'SITE_HANDOFF_EXPIRED']) {
  await expectReject(
    redeemSiteHandoff({
      handoffCode: 'h'.repeat(43),
      state: context.state,
      codeVerifier: context.codeVerifier,
    }, async () => jsonResponse({detail: {code, message: 'rejected'}}, 400)),
    code,
  );
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_unit_test',
      status: 'ANSWERED',
      assistant_text: '실제 Core 계약 형태의 테스트 응답',
      intent: {action: 'UNKNOWN'},
      response_mode: 'MODEL',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    });
  };
  const reply = await sendConversationMessage('site-memory-token', '안녕하세요', fetchMock);
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(reply.assistantText, '실제 Core 계약 형태의 테스트 응답');
  assert.equal(reply.intent.action, 'UNKNOWN');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/messages');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.init.body), {text: '안녕하세요'});
}

await expectReject(
  sendConversationMessage('site-memory-token', '안녕하세요', async () => jsonResponse({
    detail: {code: 'SESSION_EXPIRED', message: 'expired'},
  }, 401)),
  'SESSION_EXPIRED',
);

{
  let request;
  const issued = await createGuestConversationSession(async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-GUEST-SESSION-01',
      schema_version: 1,
      guest_token: 'g'.repeat(43),
      expires_at: '2030-01-01T00:00:00Z',
    }, 201);
  });
  assert.equal(issued.guestToken, 'g'.repeat(43));
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/guest/sessions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.ok(!request.init.headers?.Authorization);
}

{
  let request;
  const reply = await sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '양자컴퓨터가 뭐야?',
    idempotencyKey: 'guest-request-0001',
    recentContext: [{role: 'user', text: '아까 과학 이야기했지?'}],
    timezone: 'Asia/Seoul',
  }, async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_guest_unit',
      status: 'ANSWERED',
      assistant_text: '양자컴퓨터는 양자 상태를 이용해 계산하는 컴퓨터예요.',
      intent: {action: 'UNKNOWN'},
      response_mode: 'AI_GENERATED_NON_AUTHORITATIVE',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    });
  });
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(reply.intent.action, 'UNKNOWN');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/guest/messages');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.headers['X-LOTBI-Guest-Token'], 'g'.repeat(43));
  assert.equal(request.init.headers['Idempotency-Key'], 'guest-request-0001');
  assert.ok(!request.init.headers.Authorization);
  assert.deepEqual(JSON.parse(request.init.body), {
    text: '양자컴퓨터가 뭐야?',
    recent_context: [{role: 'user', text: '아까 과학 이야기했지?'}],
    client_context: {timezone: 'Asia/Seoul'},
  });
}

await expectReject(
  sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '질문',
    idempotencyKey: 'guest-request-0002',
  }, async () => jsonResponse({
    detail: {code: 'GUEST_SESSION_EXPIRED', message: 'expired'},
  }, 401)),
  'GUEST_SESSION_EXPIRED',
);

const index = read('index.html');
const auth = read('site-auth.js');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const callback = read('auth-callback.js');
const callbackHtml = read('auth/callback/index.html');
const footerCss = read('footer-business-info.css');

for (const token of [
  'id="conversation-thread"',
  'type="module" src="site-conversation.js?v=20260920-conversationpolish1"',
  'maxlength="1000"',
  'aria-label="전송"',
  '유한회사 알에이디홀딩스',
  '대표자: 전선혜',
  '사업자등록번호: 583-88-03679',
  '통신판매업신고번호: 2026-전주덕진-0798',
  '사업자정보확인',
]) assert.ok(index.includes(token), `missing index contract: ${token}`);

assert.ok(auth.includes('sessionStorage'));
assert.ok(auth.includes('code_challenge'));
assert.ok(auth.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(callback.includes('history.replaceState'));
assert.ok(callback.includes('readAndClearSiteHandoffContext'));
assert.ok(callback.includes('redeemSiteHandoff'));
assert.ok(callbackHtml.includes('noindex,nofollow,noarchive'));
assert.ok(conversation.includes("event.key === 'Enter'"));
assert.ok(conversation.includes('!event.shiftKey'));
assert.ok(conversation.includes('beginSiteHandoff'));
assert.ok(conversation.includes('sendConversationMessage'));
assert.ok(conversation.includes('sendGuestConversationMessage'));
assert.ok(conversation.includes('createGuestConversationSession'));
assert.ok(conversation.includes("lastPath = 'CORE_GUEST_CONVERSATION'"));
assert.ok(conversation.includes('getCurrentSiteUser'));
assert.ok(conversation.includes('logoutSiteSession'));
assert.ok(core.includes("Authorization: `Bearer ${token}`"));
assert.ok(core.includes("payload.contract_id !== 'CORE-WEB-CHAT-01'"));
assert.ok(core.includes("const GUEST_SESSION_PATH = '/v2/conversation/guest/sessions'"));
assert.ok(core.includes("const GUEST_CONVERSATION_PATH = '/v2/conversation/guest/messages'"));
assert.ok(core.includes("'Idempotency-Key': logicalKey"));
assert.ok(core.includes("'X-LOTBI-Guest-Token': token"));

const credentialRuntime = `${auth}\n${core}\n${callback}`.toLowerCase();
for (const forbidden of ['localstorage', 'document.cookie', 'client_secret', 'api_key', 'openai_api_key']) {
  assert.ok(!credentialRuntime.includes(forbidden), `forbidden credential runtime token: ${forbidden}`);
}
assert.ok(conversation.includes('window.localStorage'), 'conversation/preferences require explicit browser-local persistence');
assert.ok(conversation.includes('installationId'), 'authenticated local persistence must use the stable installation namespace');
assert.ok(!conversation.includes('storage.setItem(STORAGE_PREFIX, sessionToken'), 'Site bearer must never enter durable storage');
assert.ok(!auth.includes('session_token'), 'handoff storage module must never persist a bearer');
assert.ok(!auth.includes('Authorization'), 'Account bearer must never be handled by Site handoff state module');
assert.ok(!callback.includes('sessionStorage.setItem'), 'callback must not persist the Site bearer');
assert.ok(!conversation.includes('sessionStorage.setItem'), 'conversation must not persist the Site bearer');
assert.ok(!footerCss.includes('conversation'), 'business footer stylesheet must remain unrelated to conversation integration');

for (const forbiddenEffect of ['/orders', '/payments', '/reservations', '/execute', 'payment_attempted']) {
  assert.ok(!conversation.includes(forbiddenEffect), `conversation client must not start external effects: ${forbiddenEffect}`);
}

console.log('SITE-WEB-CONVERSATION-INTEGRATION-01 CONTRACT PASS');
