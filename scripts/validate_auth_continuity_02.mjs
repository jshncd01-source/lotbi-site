import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {
  ACCOUNT_SITE_FALLBACK_URL,
  ACCOUNT_SITE_SESSION_STATUS_URL,
  HANDOFF_RECOVERY_KEY,
  HANDOFF_RECOVERY_TTL_MS,
  SITE_LOGOUT_SUPPRESSION_KEY,
  SITE_LOGOUT_SUPPRESSION_TTL_MS,
  SiteHandoffClientError,
  clearSiteLogoutSuppression,
  hasSiteLogoutSuppression,
  markSiteLogoutSuppression,
  readAccountSessionStatus,
  recoverMissingSiteHandoffContext,
  shouldUseAccountSiteFallback,
} = await import('../site-auth.js?v=20260920-authux1');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

assert.equal(ACCOUNT_SITE_SESSION_STATUS_URL, 'https://account.lotbiai.com/api/auth/site-session-status');
assert.equal(ACCOUNT_SITE_FALLBACK_URL, 'https://account.lotbiai.com/?site_fallback=1');
assert.equal(new URL(ACCOUNT_SITE_FALLBACK_URL).searchParams.get('site_fallback'), '1');
assert.equal(new URL(ACCOUNT_SITE_FALLBACK_URL).searchParams.has('state'), false);
assert.equal(new URL(ACCOUNT_SITE_FALLBACK_URL).searchParams.has('code_challenge'), false);
assert.equal(shouldUseAccountSiteFallback(new SiteHandoffClientError('x', 'SITE_HANDOFF_CRYPTO_UNAVAILABLE')), true);
assert.equal(shouldUseAccountSiteFallback(new SiteHandoffClientError('x', 'SITE_HANDOFF_STORAGE_UNAVAILABLE')), true);
assert.equal(shouldUseAccountSiteFallback(new SiteHandoffClientError('x', 'SITE_HANDOFF_STATE_MISMATCH')), false);

assert.equal(HANDOFF_RECOVERY_KEY, 'lotbi.site-handoff-recovery.v1');
assert.equal(HANDOFF_RECOVERY_TTL_MS, 2 * 60 * 1000);
{
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
  let statusChecks = 0;
  let handoffs = 0;
  const recovered = await recoverMissingSiteHandoffContext(
    new SiteHandoffClientError('missing', 'SITE_HANDOFF_CONTEXT_MISSING'),
    {
      storage,
      now: 10_000,
      readStatus: async () => { statusChecks += 1; return true; },
      beginHandoff: async () => { handoffs += 1; },
    },
  );
  assert.equal(recovered, true);
  assert.equal(statusChecks, 1);
  assert.equal(handoffs, 1);
  assert.deepEqual(JSON.parse(data.get(HANDOFF_RECOVERY_KEY)), {
    version: 1,
    startedAt: 10_000,
    attemptCount: 1,
  });

  const second = await recoverMissingSiteHandoffContext(
    new SiteHandoffClientError('missing', 'SITE_HANDOFF_CONTEXT_MISSING'),
    {
      storage,
      now: 10_001,
      readStatus: async () => { statusChecks += 1; return true; },
      beginHandoff: async () => { handoffs += 1; },
    },
  );
  assert.equal(second, false, 'one callback cycle may recover at most once');
  assert.equal(statusChecks, 1);
  assert.equal(handoffs, 1);
}

for (const code of ['SITE_HANDOFF_STATE_MISMATCH', 'SITE_HANDOFF_CONTEXT_INVALID', 'SITE_HANDOFF_CALLBACK_INVALID', 'SITE_HANDOFF_REPLAY_OR_INVALID']) {
  let statusChecks = 0;
  let handoffs = 0;
  const recovered = await recoverMissingSiteHandoffContext(
    new SiteHandoffClientError('fail closed', code),
    {
      storage: {getItem: () => null, setItem() {}, removeItem() {}},
      readStatus: async () => { statusChecks += 1; return true; },
      beginHandoff: async () => { handoffs += 1; },
    },
  );
  assert.equal(recovered, false, `${code} must not auto-recover`);
  assert.equal(statusChecks, 0);
  assert.equal(handoffs, 0);
}

{
  let handoffs = 0;
  const recovered = await recoverMissingSiteHandoffContext(
    new SiteHandoffClientError('missing', 'SITE_HANDOFF_CONTEXT_MISSING'),
    {
      storage: {getItem: () => null, setItem() {}, removeItem() {}},
      readStatus: async () => false,
      beginHandoff: async () => { handoffs += 1; },
    },
  );
  assert.equal(recovered, false);
  assert.equal(handoffs, 0, 'anonymous Account must render the safe callback error instead of redirecting');
}

assert.equal(SITE_LOGOUT_SUPPRESSION_KEY, 'lotbi.site-logout-suppression.v1');
assert.equal(SITE_LOGOUT_SUPPRESSION_TTL_MS, 10 * 60 * 1000);
{
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
  assert.equal(hasSiteLogoutSuppression(1_000, storage), false);
  assert.equal(markSiteLogoutSuppression(1_000, storage), true);
  assert.equal(hasSiteLogoutSuppression(1_001, storage), true);
  assert.equal(hasSiteLogoutSuppression(1_000 + SITE_LOGOUT_SUPPRESSION_TTL_MS, storage), true);
  assert.equal(hasSiteLogoutSuppression(1_001 + SITE_LOGOUT_SUPPRESSION_TTL_MS, storage), false);
  assert.equal(data.has(SITE_LOGOUT_SUPPRESSION_KEY), false);
  markSiteLogoutSuppression(2_000, storage);
  clearSiteLogoutSuppression(storage);
  assert.equal(hasSiteLogoutSuppression(2_001, storage), false);
}

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

const homeContinuityVersion = index.match(/type="module" src="site-continuity\.js\?v=([^"]+)"/)?.[1] || '';
const callbackContinuityVersion = callbackHtml.match(/type="module" src="\/site-continuity\.js\?v=([^"]+)"/)?.[1] || '';
assert.ok(homeContinuityVersion, 'Home continuity runtime must be cache-busted');
assert.equal(callbackContinuityVersion, homeContinuityVersion, 'callback must load the same current continuity runtime');
assert.ok(index.includes('href="site-auth-continuity.css"'));
assert.ok(index.includes('data-auth-state="checking" aria-busy="true"'));
assert.equal((index.match(/data-sidebar-account data-auth-state="checking" aria-busy="true"/g) || []).length, 2, 'desktop/mobile Sidebar must reserve neutral checking slots');
assert.equal((index.match(/class="sidebar-account-placeholder"/g) || []).length, 2);

const staticAccountActions = index.match(/<nav class="account-actions"[\s\S]*?<\/nav>/)?.[0] || '';
assert.ok(staticAccountActions, 'initial account-actions markup must exist');
assert.ok(staticAccountActions.includes('class="account-auth-placeholder"'), 'initial static header must reserve neutral checking space');
assert.ok(!staticAccountActions.includes('>로그인<'), 'initial static header must not flash login');
assert.ok(!staticAccountActions.includes('>회원가입<'), 'initial static header must not flash signup');
assert.ok(!staticAccountActions.includes('>내 계정<'), 'initial static header must not claim authenticated state');

assert.match(callbackHtml, /src="\/auth-callback\.js\?v=[^"]+"/, 'callback entry runtime must be cache-busted');
assert.ok(callbackHtml.includes('id="auth-callback-shell"'));
assert.ok(callbackHtml.includes('aria-labelledby="auth-callback-title" hidden'));
assert.ok(callbackHtml.includes('LOTBI 연결 오류'));

assert.ok(authStartHtml.includes('id="auth-start-error-shell"'));
assert.ok(authStartHtml.includes('src="/auth-start.js?v=20260920-authux1"'));
assert.ok(authStartHtml.includes('href="https://account.lotbiai.com/?site_fallback=1"'));
assert.ok(authStartHtml.includes('>계정 로그인으로 이동</a>'));
assert.ok(!authStartHtml.includes('href="/auth/start/" hidden>다시 시도</a>'), 'fallback error recovery must not recurse into /auth/start/');
assert.ok(authStartHtml.includes('aria-labelledby="auth-start-error-title" hidden'));
assert.ok(!authStartHtml.includes('LOTBI 연결 중'), 'fallback normal path must not expose a loading title');
assert.ok(!authStartHtml.includes('안전한 계정 연결을 시작하고 있습니다.'), 'removed interstitial copy must not remain in fallback markup');
assert.ok(!authStartHtml.includes('rel="stylesheet"'), 'fallback redirect must not block on Site stylesheets');
assert.ok(!authStartHtml.includes('<img'), 'fallback redirect must not fetch render-only logo imagery');
assert.ok(authStart.includes('clearSiteLogoutSuppression();'));
assert.ok(authStart.indexOf('clearSiteLogoutSuppression();') < authStart.indexOf('void beginSiteHandoff().catch(setError);'), 'explicit /auth/start fallback must clear logout suppression first');
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
const sidebarStylesheet = homeStylesheets.find(href => href.startsWith('site-sidebar-nav.css?v='));
assert.ok(sidebarStylesheet, 'home Sidebar stylesheet must be cache-busted');
assert.ok(callbackStylesheets.includes(sidebarStylesheet), 'callback must share the current Home Sidebar stylesheet');
assert.ok(
  callbackStylesheets.indexOf('site-hardening.css?v=20260920-attachments1') < callbackStylesheets.indexOf(sidebarStylesheet)
    && callbackStylesheets.indexOf(sidebarStylesheet) < callbackStylesheets.indexOf('site-auth-continuity.css'),
  'callback must preserve the home cascade order around Sidebar and auth styles',
);
assert.ok(sidebarCss.includes('.sidebar-brand-logo'));
assert.ok(sidebarCss.includes('width: auto;'));
assert.ok(sidebarCss.includes('max-width: 100%;'));
assert.ok(!callbackHtml.includes('LOTBI 연결 중'), 'normal callback markup must not expose a loading card title');
assert.ok(!callbackHtml.includes('LOTBI Site 세션을 확인하고 있습니다.'), 'normal callback markup must not expose pending copy');
assert.ok(callback.includes("new CustomEvent('lotbi:site-session-state'"));
assert.ok(callback.includes('authenticated: true'));
assert.ok(callback.includes('expiresAt: session.expiresAt'));
assert.ok(callback.includes('showCallbackError'));
assert.ok(callback.includes('recoverMissingSiteHandoffContext'));
assert.ok(callback.includes("error.code === 'SITE_HANDOFF_CONTEXT_MISSING'"));
assert.ok(callback.includes('if (await recoverMissingSiteHandoffContext(error)) return;'));
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
  "const LOGIN_URL = '/auth/start/'",
  'login.href = LOGIN_URL',
  'installDirectLoginHandoff',
  "link.addEventListener('click'",
  "recordTiming('login-click'",
  'window.location.assign(LOGIN_URL)',
  'scheduleExpiry',
  'if (!authenticated)',
  // SITE-AUTH-ROOT-ENTRY-CONTINUITY-01 — 예전 계약은 여기서
  // 'await beginSiteHandoff()' 를 요구했다. 그것이 바로 결함이었다: 홈 주소를
  // 입력한 것만으로 cross-origin 왕복이 시작돼 /auth/callback 이 주소창에
  // 노출됐다. 이제 자동 continuity 는 handoff 를 시작하지 않고, handoff 는
  // 사용자가 누르는 경로에만 남는다. 아래 syncBody 검사가 그것을 강제한다.
  'void beginSiteHandoff()',
  'markAccountLinkedAccountUi',
  'hasSiteLogoutSuppression',
  'clearSiteLogoutSuppression',
  'markSiteLogoutSuppression',
]) {
  assert.ok(continuity.includes(token), `missing continuity contract: ${token}`);
}

// SITE-NAV-SINGLE-PROFILE-ENTRY-01 — the authenticated Header used to mount its
// own [data-profile-menu-trigger], duplicating the sidebar/drawer account row.
// The contract is now the inverse: the Header clears its reserved slot and the
// account row is the only trigger. Auth continuity itself is unchanged, so the
// checking/authenticated/anonymous states above still have to hold.
const authenticatedHeader = continuity.slice(
  continuity.indexOf('export function markAuthenticatedAccountUi'),
  continuity.indexOf('export function markAnonymousAccountUi'),
);
assert.ok(
  !authenticatedHeader.includes('profileMenuTrigger'),
  'authenticated Header must not mount a duplicate profile trigger',
);
assert.ok(
  authenticatedHeader.includes('actions.replaceChildren();'),
  'authenticated Header must clear its reserved slot',
);

// 하나의 helper 정의 + 네 개의 바인딩. 익명(헤더·사이드바) 둘, 그리고
// SITE-AUTH-ROOT-ENTRY-CONTINUITY-01 이 더한 account-linked(헤더·사이드바) 둘.
// account-linked 는 Account 쿠키는 살아 있고 Site 세션만 없는 상태이며, 자동
// 왕복을 대신해 사용자가 누르는 같은 handoff 경로를 쓴다.
assert.equal((continuity.match(/installDirectLoginHandoff\(/g) || []).length, 5, 'one direct-login helper plus anonymous and account-linked header/sidebar bindings are required');
assert.ok(continuity.includes('const login = installDirectLoginHandoff(sidebarAccountLink({'), 'sidebar login must use direct handoff');
assert.ok(continuity.includes('installDirectLoginHandoff(login);'), 'header login must use direct handoff');
assert.ok(continuity.includes('const entry = installDirectLoginHandoff(sidebarAccountLink({'), 'account-linked sidebar must use the same explicit handoff path');
assert.ok(continuity.includes('installDirectLoginHandoff(resume);'), 'account-linked header must use the same explicit handoff path');
const directStart = continuity.indexOf('function installDirectLoginHandoff(link)');
const directEnd = continuity.indexOf('\nfunction rootLocation()', directStart);
const directBody = continuity.slice(directStart, directEnd);
assert.ok(directBody.indexOf('event.preventDefault();') < directBody.indexOf('if (redirecting) return;'), 'normal direct click must cancel /auth/start/ navigation before duplicate guard');
assert.ok(directBody.indexOf('redirecting = true;') < directBody.indexOf('void beginSiteHandoff()'), 'duplicate guard must engage before handoff creation');
assert.ok(directBody.indexOf('clearSiteLogoutSuppression();') < directBody.indexOf('void beginSiteHandoff()'), 'explicit login must clear logout suppression before starting handoff');
assert.ok(directBody.includes('document.body.dataset.siteAuthState === AUTH_STATE_AUTHENTICATED'), 'authenticated stale sidebar recovery must remain available');
assert.ok(conversation.includes('[data-sidebar-account] a.sidebar-account-entry[href="/auth/start/"]'), 'authenticated stale sidebar login self-heal selector must remain intact');
assert.ok(auth.includes("recordTiming('account-navigation-start')"), 'normal handoff must mark cross-origin Account navigation start');
assert.ok(auth.includes("recordTiming('account-navigation-fallback')"), 'fallback must be separately observable');
assert.ok(auth.includes('window.location.assign(ACCOUNT_SITE_FALLBACK_URL)'), 'crypto/storage failure must navigate to the Account-only fallback');
assert.ok(auth.includes("error.code === 'SITE_HANDOFF_CRYPTO_UNAVAILABLE'"));
assert.ok(auth.includes("error.code === 'SITE_HANDOFF_STORAGE_UNAVAILABLE'"));

const syncStart = continuity.indexOf('export async function synchronizeAccountContinuity()');
const syncEnd = continuity.indexOf('\nfunction handleSiteSessionState', syncStart);
const syncBody = continuity.slice(syncStart, syncEnd);
assert.ok(syncBody.indexOf('if (!hasLiveSiteSession()) markCheckingAccountUi();') < syncBody.indexOf('readAccountSessionStatus()'), 'revalidation must remain neutral until Account status resolves');
assert.ok(!syncBody.includes('if (!hasLiveSiteSession()) markAnonymousAccountUi();'), 'normal boot must not paint anonymous actions before authoritative status');
assert.ok(syncBody.includes('redirecting = false;') && syncBody.includes('markAnonymousAccountUi();'), '503/network or handoff failures must keep the anonymous login CTA usable');
assert.ok(syncBody.includes('siteLogoutSuppressed || hasSiteLogoutSuppression()'), 'fresh Home must honor the tab-scoped logout suppression marker');
assert.ok(syncBody.includes('clearSiteLogoutSuppression();'), 'confirmed anonymous Account state must clear logout suppression');

// SITE-AUTH-ROOT-ENTRY-CONTINUITY-01 — 이것이 이 파일에서 가장 중요한 줄이다.
// 홈 진입 동기화는 어떤 경로로도 cross-origin handoff 나 top-level navigation
// 을 시작하지 못한다. 예전에는 바로 이 함수가 beginSiteHandoff() 를 걸어서,
// 로그인한 분이 홈 주소를 입력할 때마다 /auth/callback 을 지나갔다. 그리고 그
// 왕복이 실패하면 홈을 열었을 뿐인 사람이 로그인 오류 화면에 갇혔다.
// 여기에 handoff 를 되돌려 놓으면 그 결함이 그대로 돌아온다.
for (const forbidden of ['beginSiteHandoff(', 'location.assign', 'location.replace', 'location.href =']) {
  assert.ok(!syncBody.includes(forbidden), `automatic Home continuity must not navigate: ${forbidden}`);
}
assert.ok(
  syncBody.includes('markAccountLinkedAccountUi();'),
  'authenticated Account without a Site session must render the explicit continue CTA instead of navigating',
);
assert.ok(
  syncBody.indexOf('siteLogoutSuppressed || hasSiteLogoutSuppression()') < syncBody.indexOf('markAccountLinkedAccountUi();'),
  'logout suppression must be honored before the account-linked CTA is offered',
);

// account-linked 는 세션이 있는 척해서는 안 된다. Site 세션은 진짜로 없으므로
// data-site-auth-state 는 'unauthenticated' 로 남고, guest namespace 를 보는
// site-conversation.js 소비자들이 그대로 동작해야 한다.
const linkedStart = continuity.indexOf('export function markAccountLinkedAccountUi');
const linkedEnd = continuity.indexOf('export function markCheckingAccountUi', linkedStart);
const linkedBody = continuity.slice(linkedStart, linkedEnd);
assert.ok(linkedStart >= 0 && linkedEnd > linkedStart, 'markAccountLinkedAccountUi must exist');
assert.ok(
  linkedBody.includes('setAuthState(actions, AUTH_STATE_UNAUTHENTICATED, false);'),
  'account-linked must stay Site-unauthenticated — the Site session really is absent',
);
assert.ok(
  !linkedBody.includes('AUTH_STATE_AUTHENTICATED') && !linkedBody.includes("dataset.siteAuthenticated = 'true'"),
  'account-linked must never claim an authenticated Site session (no fake login state)',
);
assert.ok(
  linkedBody.includes("document.body.dataset.siteAccountLinked = 'true';"),
  'account-linked must be observable through its own marker, not by faking the auth state',
);
for (const cleared of ['markAuthenticatedAccountUi', 'markAnonymousAccountUi', 'markCheckingAccountUi']) {
  const start = continuity.indexOf(`export function ${cleared}`);
  const body = continuity.slice(start, continuity.indexOf('\n}', start));
  assert.ok(
    body.includes('delete document.body.dataset.siteAccountLinked;'),
    `${cleared} must clear the account-linked marker so it cannot go stale`,
  );
}
// guest namespace 소비자는 'unauthenticated' 문자열을 본다. 새 상태가 그
// 문자열을 대체해버리면 guest 대화 namespace 가 서지 않는다.
assert.ok(
  conversation.includes("document.body.dataset.siteAuthState === 'unauthenticated'"),
  'guest conversation namespace still keys off the unauthenticated state',
);
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
