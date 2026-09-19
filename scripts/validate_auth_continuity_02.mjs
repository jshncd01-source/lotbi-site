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
const authStart = read('auth-start.js');
const authStartHtml = read('auth/start/index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const continuityCss = read('site-auth-continuity.css');
const sidebarCss = read('site-sidebar-nav.css');
const footer = read('footer-business-info.css');

assert.ok(index.includes('type="module" src="site-continuity.js?v=20260918-profile3"'));
assert.ok(index.includes('href="site-auth-continuity.css"'));
assert.ok(index.includes('data-auth-state="unauthenticated"'));
assert.ok(index.includes('class="account-action account-login" href="/auth/start/">로그인</a>'));
assert.ok(index.includes('class="account-action account-signup" href="https://account.lotbiai.com/signup">회원가입</a>'));
assert.ok(!index.includes('data-auth-state="checking" aria-busy="true"'), 'initial Home must not block account actions behind checking state');
assert.equal((index.match(/data-sidebar-account data-auth-state="unauthenticated"/g) || []).length, 2, 'desktop/mobile Sidebar must expose anonymous login immediately');
assert.ok(index.includes('<span class="sidebar-account-handle">LOTBI 계정 연결</span>'));

const staticAccountActions = index.match(/<nav class="account-actions"[\s\S]*?<\/nav>/)?.[0] || '';
assert.ok(staticAccountActions, 'initial account-actions markup must exist');
assert.ok(staticAccountActions.includes('>로그인<'), 'initial static header must expose login immediately');
assert.ok(staticAccountActions.includes('>회원가입<'), 'initial static header must expose signup immediately');
assert.ok(!staticAccountActions.includes('>내 계정<'), 'initial static header must not claim authenticated state');

assert.ok(callbackHtml.includes('type="module" src="/site-continuity.js"'));
assert.ok(callbackHtml.includes('id="auth-callback-shell"'));
assert.ok(callbackHtml.includes('aria-labelledby="auth-callback-title" hidden'));
assert.ok(callbackHtml.includes('LOTBI 연결 오류'));

assert.ok(authStartHtml.includes('id="auth-start-error-shell"'));
assert.ok(authStartHtml.includes('aria-labelledby="auth-start-error-title" hidden'));
assert.ok(!authStartHtml.includes('LOTBI 연결 중'), 'fallback normal path must not expose a loading title');
assert.ok(!authStartHtml.includes('안전한 계정 연결을 시작하고 있습니다.'), 'removed interstitial copy must not remain in fallback markup');
assert.ok(!authStartHtml.includes('rel="stylesheet"'), 'fallback redirect must not block on Site stylesheets');
assert.ok(!authStartHtml.includes('<img'), 'fallback redirect must not fetch render-only logo imagery');
assert.ok(authStart.includes('void beginSiteHandoff().catch(setError);'));
assert.ok(authStart.includes('errorShell.hidden = false'));
assert.ok(authStart.includes('retryLink.hidden = false'));
assert.ok(authStart.includes("statusNode.textContent = '로그인을 시작하지 못했습니다. 브라우저 설정을 확인한 후 다시 시도해 주세요.'"));

// SITE-SIDEBAR-LOGO-AUTH-HYDRATE-REGRESSION-03 — auth callback transplants
// the complete home body into the callback document. Every home stylesheet must
// already be present there or the transplanted Sidebar can fall back to the
// official image's intrinsic 334px width and clip after history returns to '/'.
const stylesheetHrefs = html => [...html.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
  .map(([, href]) => href.replace(/^\//, ''));
const homeStylesheets = stylesheetHrefs(index);
const callbackStylesheets = stylesheetHrefs(callbackHtml);
for (const href of homeStylesheets) {
  assert.ok(callbackStylesheets.includes(href), `callback hydration missing home stylesheet: ${href}`);
}
assert.ok(callbackHtml.includes('href="/site-sidebar-nav.css?v=20260919-homewordmark5"'));
assert.ok(
  callbackStylesheets.indexOf('site-hardening.css') < callbackStylesheets.indexOf('site-sidebar-nav.css?v=20260919-homewordmark5')
    && callbackStylesheets.indexOf('site-sidebar-nav.css?v=20260919-homewordmark5') < callbackStylesheets.indexOf('site-auth-continuity.css'),
  'callback must preserve the home cascade order around Sidebar and auth styles',
);
assert.ok(sidebarCss.includes('.sidebar-brand-logo'));
assert.ok(sidebarCss.includes('width: auto;'));
assert.ok(sidebarCss.includes('max-width: none;'));
assert.ok(!callbackHtml.includes('LOTBI 연결 중'), 'normal callback markup must not expose a loading card title');
assert.ok(!callbackHtml.includes('LOTBI Site 세션을 확인하고 있습니다.'), 'normal callback markup must not expose pending copy');
assert.ok(callback.includes("new CustomEvent('lotbi:site-session-state'"));
assert.ok(callback.includes('authenticated: true'));
assert.ok(callback.includes('expiresAt: session.expiresAt'));
assert.ok(callback.includes('showCallbackError'));
assert.ok(callback.includes("document.body.classList.add('auth-callback-error-page')"));
assert.ok(callback.includes('callbackShell.hidden = false'));
assert.ok(callback.includes('retryLink.hidden = false'));
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
  "account.dataset.profileMenuTrigger = ''",
  "account.setAttribute('aria-haspopup', 'menu')",
  "const LOGIN_URL = '/auth/start/'",
  'login.href = LOGIN_URL',
  'installDirectLoginHandoff',
  "link.addEventListener('click'",
  "recordTiming('login-click'",
  'window.location.assign(LOGIN_URL)',
  'scheduleExpiry',
  'if (!authenticated)',
  'await beginSiteHandoff()',
]) {
  assert.ok(continuity.includes(token), `missing continuity contract: ${token}`);
}

assert.equal((continuity.match(/installDirectLoginHandoff\(/g) || []).length, 3, 'one direct-login helper plus header/sidebar bindings are required');
assert.ok(continuity.includes('const login = installDirectLoginHandoff(sidebarAccountLink({'), 'sidebar login must use direct handoff');
assert.ok(continuity.includes('installDirectLoginHandoff(login);'), 'header login must use direct handoff');
const directStart = continuity.indexOf('function installDirectLoginHandoff(link)');
const directEnd = continuity.indexOf('\nfunction rootLocation()', directStart);
const directBody = continuity.slice(directStart, directEnd);
assert.ok(directBody.indexOf('event.preventDefault();') < directBody.indexOf('if (redirecting) return;'), 'normal direct click must cancel /auth/start/ navigation before duplicate guard');
assert.ok(directBody.indexOf('redirecting = true;') < directBody.indexOf('void beginSiteHandoff()'), 'duplicate guard must engage before handoff creation');
assert.ok(directBody.includes('document.body.dataset.siteAuthState === AUTH_STATE_AUTHENTICATED'), 'authenticated stale sidebar recovery must remain available');
assert.ok(conversation.includes('[data-sidebar-account] a.sidebar-account-entry[href="/auth/start/"]'), 'authenticated stale sidebar login self-heal selector must remain intact');
assert.ok(auth.includes("recordTiming('account-navigation-start')"), 'handoff must mark cross-origin Account navigation start');

const syncStart = continuity.indexOf('export async function synchronizeAccountContinuity()');
const syncEnd = continuity.indexOf('\nfunction handleSiteSessionState', syncStart);
const syncBody = continuity.slice(syncStart, syncEnd);
assert.ok(syncBody.indexOf('if (!hasLiveSiteSession()) markAnonymousAccountUi();') < syncBody.indexOf('readAccountSessionStatus()'), 'revalidation must keep login/signup visible until authenticated=true is confirmed');
assert.ok(syncBody.includes('redirecting = false;') && syncBody.includes('markAnonymousAccountUi();'), '503/network or handoff failures must keep the anonymous login CTA usable');
assert.equal((continuity.match(/setTimeout\(/g) || []).length, 1, 'only the real Site-session expiry timer is allowed');
assert.ok(continuity.includes('Math.min(delay, 2_147_000_000)'), 'the sole timer must remain bound to the actual session expiry');
for (const forbiddenDelay of ['sleep(', 'retryDelay', 'AUTH_DELAY', '5000)', '5_000']) {
  assert.ok(!continuity.includes(forbiddenDelay), `fixed auth delay is forbidden: ${forbiddenDelay}`);
  assert.ok(!callback.includes(forbiddenDelay), `fixed callback delay is forbidden: ${forbiddenDelay}`);
  assert.ok(!authStart.includes(forbiddenDelay), `fixed fallback delay is forbidden: ${forbiddenDelay}`);
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
