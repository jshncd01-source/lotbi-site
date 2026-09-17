import {beginSiteHandoff, readAccountSessionStatus} from './site-auth.js';

export const SITE_SESSION_STATE_EVENT = 'lotbi:site-session-state';
export const AUTH_STATE_CHECKING = 'checking';
export const AUTH_STATE_AUTHENTICATED = 'authenticated';
export const AUTH_STATE_UNAUTHENTICATED = 'unauthenticated';

const ACCOUNT_URL = 'https://account.lotbiai.com/account';
const LOGIN_URL = '/auth/start/';
const SIGNUP_URL = 'https://account.lotbiai.com/signup';

let siteSessionActive = false;
let siteSessionExpiresAt = 0;
let checking = false;
let redirecting = false;
let expiryTimer;

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

function rootLocation() {
  return window.location.pathname === '/' || window.location.pathname === '/index.html';
}

function accountActions() {
  const node = document.querySelector('.account-actions');
  return node instanceof HTMLElement ? node : undefined;
}

function setAuthState(actions, state, busy) {
  actions.dataset.authState = state;
  document.body.dataset.siteAuthState = state;
  if (busy) actions.setAttribute('aria-busy', 'true');
  else actions.removeAttribute('aria-busy');
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

export function markCheckingAccountUi(message = '계정 상태 확인 중') {
  const actions = accountActions();
  if (!actions) return;
  actions.replaceChildren(...checkingNodes(message));
  setAuthState(actions, AUTH_STATE_CHECKING, true);
  delete actions.dataset.siteAuthenticated;
  delete document.body.dataset.siteAuthenticated;
}

export function markAuthenticatedAccountUi() {
  const actions = accountActions();
  if (!actions) return;
  const account = document.createElement('a');
  account.className = 'account-action account-login';
  account.href = ACCOUNT_URL;
  account.textContent = '내 계정';
  actions.replaceChildren(account);
  setAuthState(actions, AUTH_STATE_AUTHENTICATED, false);
  actions.dataset.siteAuthenticated = 'true';
  document.body.dataset.siteAuthenticated = 'true';
  recordTiming('header-authenticated', {elapsedMs: Math.round(performanceNow())});
}

export function markAnonymousAccountUi() {
  const actions = accountActions();
  if (!actions) return;
  const login = document.createElement('a');
  login.className = 'account-action account-login';
  login.href = LOGIN_URL;
  login.textContent = '로그인';

  const signup = document.createElement('a');
  signup.className = 'account-action account-signup';
  signup.href = SIGNUP_URL;
  signup.textContent = '회원가입';

  actions.replaceChildren(login, signup);
  setAuthState(actions, AUTH_STATE_UNAUTHENTICATED, false);
  delete actions.dataset.siteAuthenticated;
  delete document.body.dataset.siteAuthenticated;
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
    markCheckingAccountUi('계정 상태 다시 확인 중');
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
  markCheckingAccountUi();
  const statusStartedAt = performanceNow();
  try {
    const authenticated = await readAccountSessionStatus();
    recordTiming('account-status', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
      authenticated,
    });

    if (!authenticated) {
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
  } catch {
    recordTiming('account-status-error', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
    });
    // Fail closed without lying about logout or login. A transient Account/Core
    // verification failure remains neutral until a later explicit recheck.
    markCheckingAccountUi('계정 상태를 확인하지 못했습니다. 다시 확인 중입니다.');
  } finally {
    checking = false;
  }
}

function handleSiteSessionState(event) {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (!detail || typeof detail.authenticated !== 'boolean') return;

  if (detail.authenticated) {
    siteSessionActive = true;
    markAuthenticatedAccountUi();
    if (typeof detail.expiresAt === 'string') scheduleExpiry(detail.expiresAt);
    return;
  }

  siteSessionActive = false;
  siteSessionExpiresAt = 0;
  clearExpiryTimer();
  markCheckingAccountUi('계정 상태 다시 확인 중');
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
