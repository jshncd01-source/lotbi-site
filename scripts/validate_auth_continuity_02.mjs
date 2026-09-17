import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {
  ACCOUNT_SITE_SESSION_STATUS_URL,
  SiteHandoffClientError,
  readAccountSessionStatus,
} = await import('../site-auth.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

assert.equal(ACCOUNT_SITE_SESSION_STATUS_URL, 'https://account.lotbiai.com/api/auth/site-session-status');

{
  let request;
  const authenticated = await readAccountSessionStatus(async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01',
      schema_version: 1,
      authenticated: true,
    });
  });
  assert.equal(authenticated, true);
  assert.equal(request.url, ACCOUNT_SITE_SESSION_STATUS_URL);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.mode, 'cors');
  assert.equal(request.init.credentials, 'include');
  assert.equal(request.init.cache, 'no-store');
  assert.equal(request.init.referrerPolicy, 'no-referrer');
  assert.deepEqual(request.init.headers, {Accept: 'application/json'});
  assert.equal('Authorization' in request.init.headers, false);
}

{
  const authenticated = await readAccountSessionStatus(async () => jsonResponse({
    contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01',
    schema_version: 1,
    authenticated: false,
  }));
  assert.equal(authenticated, false);
}

for (const responseFactory of [
  () => jsonResponse({contract_id: 'wrong', schema_version: 1, authenticated: true}),
  () => jsonResponse({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: 'true'}),
  () => jsonResponse({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false, available: false}, 503),
]) {
  let caught;
  try {
    await readAccountSessionStatus(async () => responseFactory());
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteHandoffClientError);
}

const index = read('index.html');
const auth = read('site-auth.js');
const continuity = read('site-continuity.js');
const callback = read('auth-callback.js');
const callbackHtml = read('auth/callback/index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const footer = read('footer-business-info.css');

assert.ok(index.includes('type="module" src="site-continuity.js"'));
assert.ok(index.includes('class="account-action account-login" href="/auth/start/">로그인</a>'));
assert.ok(callbackHtml.includes('type="module" src="/site-continuity.js"'));
assert.ok(callback.includes("new CustomEvent('lotbi:site-session-state'"));
assert.ok(callback.includes('authenticated: true'));
assert.ok(callback.includes('expiresAt: session.expiresAt'));

assert.ok(continuity.includes('readAccountSessionStatus'));
assert.ok(continuity.includes('beginSiteHandoff'));
assert.ok(continuity.includes("window.addEventListener('pageshow'"));
assert.ok(continuity.includes("window.addEventListener('focus'"));
assert.ok(continuity.includes("document.addEventListener('visibilitychange'"));
assert.ok(continuity.includes("const ACCOUNT_URL = 'https://account.lotbiai.com/account'"));
assert.ok(continuity.includes('account.href = ACCOUNT_URL'));
assert.ok(continuity.includes("const LOGIN_URL = '/auth/start/'"));
assert.ok(continuity.includes('login.href = LOGIN_URL'));
assert.ok(continuity.includes('markAuthenticatedAccountUi'));
assert.ok(continuity.includes('markAnonymousAccountUi'));
assert.ok(continuity.includes('scheduleExpiry'));
assert.ok(continuity.includes('if (!authenticated)'));
assert.ok(continuity.includes('await beginSiteHandoff()'));

assert.ok(core.includes("new CustomEvent('lotbi:site-session-state'"));
assert.ok(core.includes('detail: {authenticated: false}'));
assert.ok(core.includes('error.status !== 401 && error.status !== 403'));
assert.ok(conversation.includes('if (isSessionError(caught)) sessionToken = undefined'));

const continuityRuntime = `${auth}\n${continuity}\n${callback}`.toLowerCase();
for (const forbidden of [
  'localstorage',
  'document.cookie',
  'authorization: `bearer',
  'session_token',
  'sessionstorage.setitem("bearer',
  "sessionstorage.setitem('bearer",
]) {
  assert.ok(!continuityRuntime.includes(forbidden), `continuity runtime must not persist or expose bearer: ${forbidden}`);
}

assert.ok(auth.includes('sessionStorage'), 'PKCE verifier/state remains short-lived in sessionStorage');
assert.ok(!continuity.includes('sessionStorage'), 'refresh continuity must not persist Site bearer or auth truth in browser storage');
assert.ok(!callback.includes('sessionStorage.setItem'), 'callback must keep Site bearer memory-only');
assert.ok(!footer.includes('continuity'), 'Footer scope must remain unrelated');

for (const preserved of [
  'navigator.mediaDevices.getUserMedia',
  'SpeechRecognition',
  "prompt.addEventListener('compositionend'",
  "micButton.addEventListener('click'",
]) {
  assert.ok(conversation.includes(preserved), `composer regression: ${preserved}`);
}

console.log('SITE-AUTH-CONTINUITY-02 CONTRACT PASS');
