import {beginSiteHandoff, readAccountSessionStatus} from './site-auth.js';

export const SITE_SESSION_STATE_EVENT = 'lotbi:site-session-state';
const ACCOUNT_URL = 'https://account.lotbiai.com/account';
const LOGIN_URL = '/auth/start/';
const SIGNUP_URL = 'https://account.lotbiai.com/signup';

let siteSessionActive = false;
let siteSessionExpiresAt = 0;
let checking = false;
let redirecting = false;
let expiryTimer;

function rootLocation() {
  return window.location.pathname === '/' || window.location.pathname === '/index.html';
}

function accountActions() {
  const node = document.querySelector('.account-actions');
  return node instanceof HTMLElement ? node : undefined;
}

export function markAuthenticatedAccountUi() {
  const actions = accountActions();
  if (!actions) return;
  const account = document.createElement('a');
  account.className = 'account-action account-login';
  account.href = ACCOUNT_URL;
  account.textContent = '내 계정';
  actions.replaceChildren(account);
  actions.dataset.siteAuthenticated = 'true';
  document.body.dataset.siteAuthenticated = 'true';
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
  delete actions.dataset.siteAuthenticated;
  delete document.body.dataset.siteAuthenticated;
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
  try {
    const authenticated = await readAccountSessionStatus();
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
    await beginSiteHandoff();
  } catch {
    // Fail closed: cold pages keep their anonymous markup. If a verified Site
    // session is already active, preserve it only until its known expiry.
    if (!hasLiveSiteSession()) markAnonymousAccountUi();
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
