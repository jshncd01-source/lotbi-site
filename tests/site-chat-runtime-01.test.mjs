import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../api/chat.mjs';
import {sealSiteSession, serializeSiteSessionCookie, unsealSiteSession} from '../runtime/site-session.mjs';

const SITE = 'https://lotbiai.com';
const CORE = 'https://core.example.test';
const ACCOUNT = 'https://account.lotbiai.com';
const KEY = Buffer.alloc(32, 7).toString('base64url');
const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

function setEnv() {
  process.env.LOTBI_SITE_ORIGIN = SITE;
  process.env.LOTBI_ACCOUNT_ORIGIN = ACCOUNT;
  process.env.LOTBI_CORE_BASE_URL = CORE;
  process.env.LOTBI_SITE_SESSION_KEY = KEY;
}

function request(body, headers = {}) {
  return new Request(`${SITE}/api/chat`, {
    method: 'POST',
    headers: {'Origin': SITE, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', ...headers},
    body: JSON.stringify(body),
  });
}

test('site session is opaque, FULL-only, host-only and round-trips', async () => {
  const session = {token: 'core-secret-token', assuranceLevel: 'FULL', expiresAt: future()};
  const envelope = await sealSiteSession(session, KEY, SITE);
  assert.equal(envelope.includes('core-secret-token'), false);
  const decoded = await unsealSiteSession(envelope, KEY, SITE);
  assert.equal(decoded.token, session.token);
  assert.equal(decoded.assuranceLevel, 'FULL');
  const cookie = serializeSiteSessionCookie(envelope, session.expiresAt);
  assert.match(cookie, /^__Host-lotbi_site_session=/);
  assert.match(cookie, /; Path=\//);
  assert.match(cookie, /; HttpOnly;/);
  assert.match(cookie, /; Secure;/);
  assert.match(cookie, /; SameSite=Lax;/);
  assert.equal(/Domain=/i.test(cookie), false);
});

test('chat BFF rejects cross-origin requests before Core', async () => {
  setEnv();
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not run'); };
  try {
    const response = await POST(request({text: 'hello'}, {'Origin': 'https://evil.example'}));
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('chat BFF requires site session and never invents anonymous session', async () => {
  setEnv();
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not run'); };
  try {
    const response = await POST(request({text: '안녕 LOTBI 123'}));
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_REQUIRED');
    assert.equal(body.error.login_url, `${ACCOUNT}/`);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('valid site session is forwarded to exact Core contract only from server', async () => {
  setEnv();
  const session = {token: 'full-core-token', assuranceLevel: 'FULL', expiresAt: future()};
  const envelope = await sealSiteSession(session, KEY, SITE);
  const cookie = serializeSiteSessionCookie(envelope, session.expiresAt).split(';', 1)[0];
  const previous = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = {url: String(url), init};
    return Response.json({
      contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, correlation_id: 'cid-test', status: 'ANSWERED',
      assistant_text: '테스트 응답', intent: {action: 'UNKNOWN'}, response_mode: 'TEST',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false}, retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false, transaction_created: false, order_created: false, payment_attempted: false, reservation_created: false, merchant_execution_started: false},
    });
  };
  try {
    const response = await POST(request({text: '  한글 English 456  '}, {'Cookie': cookie}));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.contract_id, 'CORE-WEB-CHAT-01');
    assert.equal(seen.url, `${CORE}/v2/conversation/messages`);
    assert.equal(seen.init.headers.Authorization, 'Bearer full-core-token');
    assert.deepEqual(JSON.parse(seen.init.body), {text: '한글 English 456'});
  } finally {
    globalThis.fetch = previous;
  }
});

test('Core 401 clears site session cookie', async () => {
  setEnv();
  const session = {token: 'expired-core-token', assuranceLevel: 'FULL', expiresAt: future()};
  const envelope = await sealSiteSession(session, KEY, SITE);
  const cookie = serializeSiteSessionCookie(envelope, session.expiresAt).split(';', 1)[0];
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({detail: {code: 'SESSION_EXPIRED', correlation_id: 'cid-expired'}}, {status: 401});
  try {
    const response = await POST(request({text: 'hello'}, {'Cookie': cookie}));
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_SESSION_EXPIRED');
    assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);
  } finally {
    globalThis.fetch = previous;
  }
});
