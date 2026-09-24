import {beginSiteHandoff, clearSiteLogoutSuppression, hasSiteLogoutSuppression, markSiteLogoutSuppression, readAccountSessionStatus} from './site-auth.js?v=20260920-authux1';
import {prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=20260923-freshentry1';

export const SITE_SESSION_STATE_EVENT = 'lotbi:site-session-state';
export const AUTH_STATE_CHECKING = 'checking';
export const AUTH_STATE_AUTHENTICATED = 'authenticated';
export const AUTH_STATE_UNAUTHENTICATED = 'unauthenticated';

const LOGIN_URL = '/auth/start/';
const SIGNUP_URL = 'https://account.lotbiai.com/signup';
const CONTINUE_LABEL = '이어서 사용하기';
const CONTINUE_DETAIL = '계정이 연결되어 있습니다';

let siteSessionActive = false;
let siteSessionExpiresAt = 0;
let checking = false;
let redirecting = false;
let expiryTimer;
let siteLogoutSuppressed = hasSiteLogoutSuppression();

function performanceNow() {
  return globalThis.performance?.now?.() ?? 0;
}

function recordTiming(name, detail = {}) {
  try {
    globalThis.performance?.mark?.(`lotbi-auth:${name}`, {detail: Object.freeze({...detail})});
  } catch {
    // Timing evidence is diagnostic-only and must never affect authentication.
  }
}

recordTiming('site-boot', {elapsedMs: Math.round(performanceNow())});

function installDirectLoginHandoff(link) {
  link.addEventListener('click', event => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || document.body.dataset.siteAuthState === AUTH_STATE_AUTHENTICATED
    ) return;

    event.preventDefault();
    if (redirecting) return;
    clearSiteLogoutSuppression();
    siteLogoutSuppressed = false;
    redirecting = true;
    recordTiming('login-click', {elapsedMs: Math.round(performanceNow())});
    recordTiming('auth-start-transition', {
      elapsedMs: Math.round(performanceNow()),
      source: 'direct-login',
    });
    void (async () => {
      // Only an explicit guest-auth action is allowed to create a claim intent.
      // Automatic Account continuity restoration below must never do this.
      try { await prepareGuestConversationClaimIntent(); } catch {}
      void beginSiteHandoff().catch(() => {
        recordTiming('auth-start-error', {elapsedMs: Math.round(performanceNow())});
        try {
          window.location.assign(LOGIN_URL);
        } catch {
          redirecting = false;
        }
      });
    })();
  });
  return link;
}

function installDirectSignupClaim(link) {
  link.addEventListener('click', event => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || document.body.dataset.siteAuthState === AUTH_STATE_AUTHENTICATED
    ) return;

    event.preventDefault();
    if (redirecting) return;
    redirecting = true;
    const target = link.href;
    recordTiming('signup-click', {elapsedMs: Math.round(performanceNow())});
    void (async () => {
      try { await prepareGuestConversationClaimIntent(); } catch {}
      try {
        window.location.assign(target);
      } catch {
        redirecting = false;
      }
    })();
  });
  return link;
}

function rootLocation() {
  return window.location.pathname === '/' || window.location.pathname === '/index.html';
}

function accountActions() {
  const node = document.querySelector('.account-actions');
  return node instanceof HTMLElement ? node : undefined;
}

function sidebarAccountSlots() {
  return [...document.querySelectorAll('[data-sidebar-account]')]
    .filter(node => node instanceof HTMLElement);
}

function setAuthState(actions, state, busy) {
  actions.dataset.authState = state;
  document.body.dataset.siteAuthState = state;
  if (busy) actions.setAttribute('aria-busy', 'true');
  else actions.removeAttribute('aria-busy');
}

function setSidebarAuthState(slot, state, busy) {
  slot.dataset.authState = state;
  if (busy) slot.setAttribute('aria-busy', 'true');
  else slot.removeAttribute('aria-busy');
}

function checkingNodes(message) {
  const placeholder = document.createElement('span');
  placeholder.className = 'account-auth-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.textContent = message;
  return [placeholder, status];
}

function sidebarCheckingNodes(message) {
  const placeholder = document.createElement('span');
  placeholder.className = 'sidebar-account-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.textContent = message;
  return [placeholder, status];
}

function sidebarAccountLink({href, label, primary, secondary}) {
  const link = document.createElement('a');
  link.className = 'sidebar-account-entry';
  link.href = href;
  link.setAttribute('aria-label', label);

  const name = document.createElement('span');
  name.className = 'sidebar-account-name';
  name.textContent = primary;

  const detail = document.createElement('span');
  detail.className = 'sidebar-account-handle';
  detail.textContent = secondary;

  link.append(name, detail);
  return link;
}

function markCheckingSidebarAccountUi(message = '계정 상태 확인 중') {
  for (const slot of sidebarAccountSlots()) {
    slot.replaceChildren(...sidebarCheckingNodes(message));
    setSidebarAuthState(slot, AUTH_STATE_CHECKING, true);
  }
}

function markAuthenticatedSidebarAccountUi() {
  for (const slot of sidebarAccountSlots()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-account-entry sidebar-profile-trigger';
    button.dataset.profileMenuTrigger = '';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '계정 메뉴 열기');
    const primary = document.createElement('span');
    primary.className = 'sidebar-account-name';
    primary.textContent = 'LOTBI 사용자';
    button.append(primary);
    slot.replaceChildren(button);
    setSidebarAuthState(slot, AUTH_STATE_AUTHENTICATED, false);
  }
  window.dispatchEvent(new CustomEvent('lotbi:sidebar-auth-rendered'));
}

function markAnonymousSidebarAccountUi() {
  for (const slot of sidebarAccountSlots()) {
    const isMobileDrawerSlot = Boolean(slot.closest('#mobile-nav-drawer'));
    const login = installDirectLoginHandoff(sidebarAccountLink({
      href: LOGIN_URL,
      label: 'LOTBI 로그인',
      primary: '로그인',
      secondary: isMobileDrawerSlot ? '' : 'LOTBI 계정 연결',
    }));
    if (isMobileDrawerSlot) {
      const actions = document.createElement('div');
      actions.className = 'sidebar-guest-actions';
      const signup = installDirectSignupClaim(sidebarAccountLink({
        href: SIGNUP_URL,
        label: 'LOTBI 회원가입',
        primary: '회원가입',
        secondary: '',
      }));
      actions.append(login, signup);
      slot.replaceChildren(actions);
    } else {
      slot.replaceChildren(login);
    }
    setSidebarAuthState(slot, AUTH_STATE_UNAUTHENTICATED, false);
  }
  window.dispatchEvent(new CustomEvent('lotbi:sidebar-auth-rendered'));
}

// SITE-AUTH-ROOT-ENTRY-CONTINUITY-01 — Account 쿠키는 살아 있지만 Site 세션이
// 없는 상태. Site 세션은 설계상 메모리 전용이라 새 document 마다 반드시 이
// 상태를 지나간다. 여기서 자동으로 cross-origin handoff 를 걸면 로그인한 분이
// 홈 주소를 입력할 때마다 /auth/callback 을 지나가고, 그 왕복이 실패하면 홈을
// 열었을 뿐인 사람이 로그인 오류 화면에 갇힌다. 그래서 자동 왕복 대신 "계정이
// 연결돼 있다" 는 사실만 보여주고, 실제 handoff 는 누를 때 시작한다.
function markAccountLinkedSidebarAccountUi() {
  for (const slot of sidebarAccountSlots()) {
    const entry = installDirectLoginHandoff(sidebarAccountLink({
      href: LOGIN_URL,
      label: 'LOTBI 계정으로 이어서 사용하기',
      primary: CONTINUE_LABEL,
      secondary: slot.closest('#mobile-nav-drawer') ? '' : CONTINUE_DETAIL,
    }));
    slot.replaceChildren(entry);
    setSidebarAuthState(slot, AUTH_STATE_UNAUTHENTICATED, false);
  }
  window.dispatchEvent(new CustomEvent('lotbi:sidebar-auth-rendered'));
}

export function markAccountLinkedAccountUi() {
  const actions = accountActions();
  if (actions) {
    const resume = document.createElement('a');
    resume.className = 'account-action account-continue';
    resume.href = LOGIN_URL;
    resume.textContent = CONTINUE_LABEL;
    installDirectLoginHandoff(resume);
    actions.replaceChildren(resume);
    setAuthState(actions, AUTH_STATE_UNAUTHENTICATED, false);
    delete actions.dataset.siteAuthenticated;
  } else {
    document.body.dataset.siteAuthState = AUTH_STATE_UNAUTHENTICATED;
  }
  delete document.body.dataset.siteAuthenticated;
  // Site 세션은 진짜로 없다. 그러므로 'unauthenticated' 를 보는 모든 소비자
  // (guest namespace, guest conversation) 가 그대로 동작해야 한다. 이 표식은
  // Account 쿠키가 살아 있다는 사실만 말하며, 그래서 이미 로그인한 분에게
  // 다시 "로그인" 을 요구하지 않고 이어서 쓰도록 권할 수 있다. 세션이 있는
  // 척하지는 않는다.
  document.body.dataset.siteAccountLinked = 'true';
  markAccountLinkedSidebarAccountUi();
  recordTiming('account-linked', {elapsedMs: Math.round(performanceNow())});
}

export function markCheckingAccountUi(message = '계정 상태 확인 중') {
  const actions = accountActions();
  if (actions) {
    actions.replaceChildren(...checkingNodes(message));
    setAuthState(actions, AUTH_STATE_CHECKING, true);
    delete actions.dataset.siteAuthenticated;
  } else {
    document.body.dataset.siteAuthState = AUTH_STATE_CHECKING;
  }
  delete document.body.dataset.siteAuthenticated;
  delete document.body.dataset.siteAccountLinked;
  markCheckingSidebarAccountUi(message);
}

export function markAuthenticatedAccountUi() {
  const actions = accountActions();
  if (actions) {
    // SITE-NAV-SINGLE-PROFILE-ENTRY-01 — the Header no longer carries a second
    // profile entry point. The sidebar/drawer account row is the only one, and
    // it opens the same menu through the same [data-profile-menu-trigger]
    // contract. The reserved Header slot collapses instead of rendering a
    // duplicate control; anonymous 로그인/회원가입 is untouched below.
    actions.replaceChildren();
    setAuthState(actions, AUTH_STATE_AUTHENTICATED, false);
    actions.dataset.siteAuthenticated = 'true';
  } else {
    document.body.dataset.siteAuthState = AUTH_STATE_AUTHENTICATED;
  }
  document.body.dataset.siteAuthenticated = 'true';
  delete document.body.dataset.siteAccountLinked;
  markAuthenticatedSidebarAccountUi();
  recordTiming('header-authenticated', {elapsedMs: Math.round(performanceNow())});
}

export function markAnonymousAccountUi() {
  const actions = accountActions();
  if (actions) {
    const login = document.createElement('a');
    login.className = 'account-action account-login';
    login.href = LOGIN_URL;
    login.textContent = '로그인';
    installDirectLoginHandoff(login);

    const signup = document.createElement('a');
    signup.className = 'account-action account-signup';
    signup.href = SIGNUP_URL;
    signup.textContent = '회원가입';
    installDirectSignupClaim(signup);

    actions.replaceChildren(login, signup);
    setAuthState(actions, AUTH_STATE_UNAUTHENTICATED, false);
    delete actions.dataset.siteAuthenticated;
  } else {
    document.body.dataset.siteAuthState = AUTH_STATE_UNAUTHENTICATED;
  }
  delete document.body.dataset.siteAuthenticated;
  delete document.body.dataset.siteAccountLinked;
  markAnonymousSidebarAccountUi();
  recordTiming('header-unauthenticated', {elapsedMs: Math.round(performanceNow())});
}

function clearExpiryTimer() {
  if (expiryTimer !== undefined) {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
  }
}

function scheduleExpiry(expiresAt) {
  clearExpiryTimer();
  const milliseconds = Date.parse(expiresAt);
  if (!Number.isFinite(milliseconds)) return;
  siteSessionExpiresAt = milliseconds;
  const delay = Math.max(0, milliseconds - Date.now());
  expiryTimer = setTimeout(() => {
    siteSessionActive = false;
    siteSessionExpiresAt = 0;
    markAnonymousAccountUi();
    void synchronizeAccountContinuity();
  }, Math.min(delay, 2_147_000_000));
}

function hasLiveSiteSession() {
  return siteSessionActive
    && (siteSessionExpiresAt === 0 || siteSessionExpiresAt > Date.now());
}

export async function synchronizeAccountContinuity() {
  if (!rootLocation() || checking || redirecting) return;
  checking = true;
  if (!hasLiveSiteSession()) markCheckingAccountUi();
  const statusStartedAt = performanceNow();
  try {
    const authenticated = await readAccountSessionStatus();
    recordTiming('account-status', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
      authenticated,
    });

    if (!authenticated) {
      clearSiteLogoutSuppression();
      siteLogoutSuppressed = false;
      siteSessionActive = false;
      siteSessionExpiresAt = 0;
      clearExpiryTimer();
      markAnonymousAccountUi();
      return;
    }

    if (siteLogoutSuppressed || hasSiteLogoutSuppression()) {
      siteLogoutSuppressed = true;
      siteSessionActive = false;
      siteSessionExpiresAt = 0;
      clearExpiryTimer();
      markAnonymousAccountUi();
      return;
    }

    if (hasLiveSiteSession()) {
      markAuthenticatedAccountUi();
      return;
    }

    // 홈 주소를 입력한 것만으로는 cross-origin auth 왕복을 시작하지 않는다.
    // 예전에는 여기서 곧바로 Site handoff 를 걸었고, Site 세션이 메모리
    // 전용이라 새 document 마다 이 지점에 도달했다. 그래서 로그인한 분이 홈을
    // 열 때마다 account.lotbiai.com 을 거쳐 /auth/callback 으로 돌아왔다 —
    // 대표님이 주소창에서 보신 그 주소다. 게다가 그 왕복의 실패(state 불일치,
    // 5분 컨텍스트 만료, redeem replay, 홈 셸 hydrate 실패)가 홈을 열었을 뿐인
    // 사람을 로그인 오류 화면에 갇히게 만들었다.
    //
    // 이제 계정이 연결돼 있다는 사실만 표시하고, handoff 는 사용자가 누를 때
    // 시작한다 — 명시적 로그인과 완전히 같은 경로다. 세션이 있는 척하지
    // 않으므로 fake login state 도 아니다.
    //
    // 이 함수 안에 handoff 시작이나 navigation 을 되돌려 놓으면
    // validate_auth_continuity_02.mjs 의 syncBody 검사가 떨어진다. 일부러 그렇게
    // 묶어 두었다.
    markAccountLinkedAccountUi();
  } catch {
    recordTiming('account-status-error', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
    });
    // The anonymous CTA is the safe default: a transient Account/Core failure
    // must never hide login/signup or leave the account slot as a placeholder.
    redirecting = false;
    markAnonymousAccountUi();
  } finally {
    checking = false;
  }
}

function handleSiteSessionState(event) {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (!detail || typeof detail.authenticated !== 'boolean') return;

  if (detail.authenticated) {
    clearSiteLogoutSuppression();
    siteLogoutSuppressed = false;
    siteSessionActive = true;
    markAuthenticatedAccountUi();
    if (typeof detail.expiresAt === 'string') scheduleExpiry(detail.expiresAt);
    return;
  }

  siteSessionActive = false;
  siteSessionExpiresAt = 0;
  clearExpiryTimer();
  if (detail.reason === 'site-logout') {
    markSiteLogoutSuppression();
    siteLogoutSuppressed = true;
    markAnonymousAccountUi();
    return;
  }
  markAnonymousAccountUi();
  if (rootLocation()) void synchronizeAccountContinuity();
}

window.addEventListener(SITE_SESSION_STATE_EVENT, handleSiteSessionState);
window.addEventListener('pageshow', () => {
  if (rootLocation()) void synchronizeAccountContinuity();
});
window.addEventListener('focus', () => {
  if (rootLocation()) void synchronizeAccountContinuity();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && rootLocation()) void synchronizeAccountContinuity();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (rootLocation()) void synchronizeAccountContinuity();
  }, {once: true});
} else if (rootLocation()) {
  void synchronizeAccountContinuity();
}
