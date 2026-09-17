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
const continuityCss = read('site-auth-continuity.css');
const footer = read('footer-business-info.css');

assert.ok(index.includes('type="module" src="site-continuity.js"'));
assert.ok(index.includes('href="site-auth-continuity.css"'));
assert.ok(index.includes('data-auth-state="checking" aria-busy="true"'));
assert.ok(index.includes('class="account-auth-placeholder" aria-hidden="true"'));
assert.ok(index.includes('계정 상태 확인 중'));

const staticAccountActions = index.match(/<nav class="account-actions"[\s\S]*?<\/nav>/)?.[0] || '';
assert.ok(staticAccountActions, 'initial account-actions markup must exist');
assert.ok(!staticAccountActions.includes('>로그인<'), 'initial static header must not claim unauthenticated state');
assert.ok(!staticAccountActions.includes('>회원가입<'), 'initial static header must not claim unauthenticated state');
assert.ok(!staticAccountActions.includes('>내 계정<'), 'initial static header must not claim authenticated state');

assert.ok(callbackHtml.includes('type="module" src="/site-continuity.js"'));
assert.ok(callbackHtml.includes('id="auth-callback-shell"'));
assert.ok(callbackHtml.includes('aria-labelledby="auth-callback-title" hidden'));
assert.ok(callbackHtml.includes('LOTBI 연결 오류'));
assert.ok(!callbackHtml.includes('LOTBI 연결 중'), 'normal callback markup must not expose a loading card title');
assert.ok(!callbackHtml.includes('LOTBI Site 세션을 확인하고 있습니다.'), 'normal callback markup must not expose pending copy');
assert.ok(callback.includes("new CustomEvent('lotbi:site-session-state'"));
assert.ok(callback.includes('authenticated: true'));
assert.ok(callback.includes('expiresAt: session.expiresAt'));
assert.ok(callback.includes('showCallbackError'));
assert.ok(callback.includes("document.body.classList.add('auth-callback-error-page')"));
assert.ok(callback.includes('callbackShell.hidden = false'));
assert.ok(callback.includes("retryLink.hidden = false"));
assert.ok(!callback.includes("setStatus('LOTBI Site 세션을 확인하고 있습니다.')"), 'normal callback pending path must remain visually silent');

for (const token of [
  "export const AUTH_STATE_CHECKING = 'checking'",
  "export const AUTH_STATE_AUTHENTICATED = 'authenticated'",
  "export const AUTH_STATE_UNAUTHENTICATED = 'unauthenticated'",
  'markCheckingAccountUi',
  'markAuthenticatedAccountUi',
  'markAnonymousAccountUi',
  'readAccountSessionStatus',
  'beginSiteHandoff',
  "window.addEventListener('pageshow'",
  "window.addEventListener('focus'",
  "document.addEventListener('visibilitychange'",
  "const ACCOUNT_URL = 'https://account.lotbiai.com/account'",
  'account.href = ACCOUNT_URL',
  "const LOGIN_URL = '/auth/start/'",
  'login.href = LOGIN_URL',
  'scheduleExpiry',
  'if (!authenticated)',
  'await beginSiteHandoff()',
]) {
  assert.ok(continuity.includes(token), `missing continuity contract: ${token}`);
}

const syncStart = continuity.indexOf('export async function synchronizeAccountContinuity()');
const syncEnd = continuity.indexOf('\nfunction handleSiteSessionState', syncStart);
const syncBody = continuity.slice(syncStart, syncEnd);
assert.ok(syncBody.indexOf('markCheckingAccountUi();') < syncBody.indexOf('readAccountSessionStatus()'), 'revalidation must enter neutral checking state before Account status resolves');
assert.ok(syncBody.includes("markCheckingAccountUi('계정 상태를 확인하지 못했습니다. 다시 확인 중입니다.')"), '503/network failures must remain neutral instead of claiming logout');
assert.equal((continuity.match(/setTimeout\(/g) || []).length, 1, 'only the real Site-session expiry timer is allowed');
assert.ok(continuity.includes('Math.min(delay, 2_147_000_000)'), 'the sole timer must remain bound to the actual session expiry');
for (const forbiddenDelay of ['sleep(', 'retryDelay', 'AUTH_DELAY', '5000)', '5_000']) {
  assert.ok(!continuity.includes(forbiddenDelay), `fixed auth delay is forbidden: ${forbiddenDelay}`);
  assert.ok(!callback.includes(forbiddenDelay), `fixed callback delay is forbidden: ${forbiddenDelay}`);
}

assert.ok(continuityCss.includes('min-width: 174px'));
assert.ok(continuityCss.includes('min-width: 132px'));
assert.ok(continuityCss.includes('.account-auth-placeholder'));
assert.ok(continuityCss.includes('visibility: hidden'));
assert.ok(continuityCss.includes('body.auth-callback-page:not(.auth-callback-error-page)'));
assert.ok(continuityCss.includes('.auth-callback-page:not(.auth-callback-error-page) .auth-callback-shell'));
assert.ok(!continuityCss.includes('.account-auth-placeholder::before'));
assert.ok(!continuityCss.includes('.account-auth-placeholder::after'));
assert.ok(!continuityCss.includes('#f0f2f7'), 'checking state must not paint the old gray skeleton');

for (const timing of [
  "recordTiming('site-boot'",
  "recordTiming('account-status'",
  "recordTiming('auth-start-transition'",
  "recordTiming('header-authenticated'",
]) {
  assert.ok(continuity.includes(timing), `missing nonpersistent continuity timing marker: ${timing}`);
}
for (const timing of [
  "recordTiming('callback-boot'",
  "recordTiming('account-handoff-return'",
  "recordTiming('core-redeem'",
  "recordTiming('callback-hydrate'",
  "recordTiming('callback-complete'",
]) {
  assert.ok(callback.includes(timing), `missing nonpersistent callback timing marker: ${timing}`);
}

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
  'authenticated=true',
]) {
  assert.ok(!continuityRuntime.includes(forbidden), `continuity runtime must not persist or expose auth truth/bearer: ${forbidden}`);
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

console.log('SITE-AUTH-CONTINUITY-02 / FLASH-01 / SEAMLESS-02 CONTRACT PASS');
