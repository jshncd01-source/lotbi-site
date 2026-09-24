import {beginSiteHandoff, clearSiteLogoutSuppression, hasSiteLogoutSuppression, markSiteLogoutSuppression, readAccountSessionStatus} from './site-auth.js?v=aset-d7205f185b12';
import {prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=aset-d7205f185b12';

export const SITE_SESSION_STATE_EVENT = 'lotbi:site-session-state';
export const AUTH_STATE_CHECKING = 'checking';
export const AUTH_STATE_AUTHENTICATED = 'authenticated';
export const AUTH_STATE_UNAUTHENTICATED = 'unauthenticated';
export const AUTH_STATE_UNKNOWN = 'unknown';

const LOGIN_URL = '/auth/start/';
const SIGNUP_URL = 'https://account.lotbiai.com/signup';

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

function markUnknownSidebarAccountUi() {
  for (const slot of sidebarAccountSlots()) {
    const state = document.createElement('span');
    state.className = 'sidebar-account-entry sidebar-account-unknown';
    state.setAttribute('role', 'status');

    const primary = document.createElement('span');
    primary.className = 'sidebar-account-name';
    primary.textContent = '계정 상태 확인 필요';

    const detail = document.createElement('span');
    detail.className = 'sidebar-account-handle';
    detail.textContent = '잠시 후 자동으로 다시 확인합니다.';

    state.append(primary, detail);
    slot.replaceChildren(state);
    setSidebarAuthState(slot, AUTH_STATE_UNKNOWN, false);
  }
  window.dispatchEvent(new CustomEvent('lotbi:sidebar-auth-rendered'));
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
  markCheckingSidebarAccountUi(message);
}

export function markUnknownAccountUi() {
  const actions = accountActions();
  if (actions) {
    const state = document.createElement('span');
    state.className = 'account-auth-unknown';
    state.setAttribute('role', 'status');
    state.textContent = '계정 확인 필요';
    actions.replaceChildren(state);
    setAuthState(actions, AUTH_STATE_UNKNOWN, false);
    delete actions.dataset.siteAuthenticated;
  } else {
    document.body.dataset.siteAuthState = AUTH_STATE_UNKNOWN;
  }
  delete document.body.dataset.siteAuthenticated;
  markUnknownSidebarAccountUi();
  recordTiming('header-auth-unknown', {elapsedMs: Math.round(performanceNow())});
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

    if (authenticated === false) {
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

    redirecting = true;
    recordTiming('auth-start-transition', {elapsedMs: Math.round(performanceNow())});
    await beginSiteHandoff();
  } catch (error) {
    recordTiming('account-status-error', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
      code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
    });
    // SITE-HOME-SAME-URL-STABILITY-01 — transport failure is not evidence of
    // logout. Preserve a verified live Site session; otherwise move to the
    // explicit UNKNOWN presentation. Only authenticated:false above is allowed
    // to render login/signup.
    redirecting = false;
    if (hasLiveSiteSession()) markAuthenticatedAccountUi();
    else markUnknownAccountUi();
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
