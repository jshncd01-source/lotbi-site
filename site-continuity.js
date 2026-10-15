import {adoptSiteSession, beginSiteHandoff, clearSiteLogoutSuppression, hasSiteLogoutSuppression, markSiteLogoutSuppression, readAccountSessionStatus, renewSiteSessionSilently, SITE_SESSION_RENEWAL_REQUEST_EVENT} from './site-auth.js?v=aset-66255ae7fee8';
import {prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=aset-66255ae7fee8';

export const SITE_SESSION_STATE_EVENT = 'lotbi:site-session-state';
export const AUTH_STATE_CHECKING = 'checking';
export const AUTH_STATE_AUTHENTICATED = 'authenticated';
export const AUTH_STATE_UNAUTHENTICATED = 'unauthenticated';
export const AUTH_STATE_UNKNOWN = 'unknown';
export const ACCOUNT_STATUS_RETRY_DELAYS_MS = Object.freeze([1000, 3000, 10000]);
// AUTH-SESSION-CONTINUITY-P0-02 — the Site child session lives 30 minutes in
// page memory. It is renewed in place this long before it runs out (and on
// return from the background), so a person who keeps LOTBI open, or comes
// back to it, is never sent through the login button or /auth/callback/.
export const SITE_SESSION_RENEW_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
export const SITE_SESSION_RENEWAL_RETRY_MS = 30 * 1000;
export const SITE_SESSION_RENEWAL_MIN_INTERVAL_MS = 20 * 1000;

const LOGIN_URL = '/auth/start/';
const SIGNUP_URL = 'https://account.lotbiai.com/signup';

let siteSessionActive = false;
let siteSessionExpiresAt = 0;
let checking = false;
let redirecting = false;
let expiryTimer;
let unknownRetryTimer;
let unknownRetryAttempt = 0;
let renewalInFlight;
let lastRenewalStartedAt = 0;
// SITE-SESSION-REQUEST-STORM-P0-01 — when the last Account answer was
// "signed out" and the page already shows it, a repeated dead-session
// announcement does not ask Account again within this window.
export const ACCOUNT_STATUS_SIGNED_OUT_RECHECK_MS = 5 * 1000;
let lastSignedOutAnswerAt = 0;
// The installation the page's Site session belongs to, kept across a lapse so
// coming back to the same account after 30 minutes is a renewal, not a new
// sign-in that would close open screens.
let siteSessionInstallationId = '';
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

  // SITE-HEADER-AUTH-QA-23-24-01 (#23) — Account can take a few seconds to
  // answer (8 s and more under load), and a signed-out visitor was left with
  // no way to sign in until it did. 로그인 is here from the start but only
  // shows once the wait has lasted (site-auth-continuity.css), so a quick
  // answer never flashes it, and it is withdrawn the moment Account says the
  // person is signed in (withdrawLoginWhileChecking).
  const login = recoveryLoginLink('account-action account-login account-login-while-checking');
  return [placeholder, status, login];
}

function withdrawLoginWhileChecking() {
  for (const node of document.querySelectorAll('.account-login-while-checking')) node.remove();
}

function sidebarCheckingNodes(message) {
  const placeholder = document.createElement('span');
  placeholder.className = 'sidebar-account-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.textContent = message;

  // SITE-HEADER-AUTH-QA-23-24-01 FIX 03 (#23 on a PC and in the phone drawer) —
  // the sidebar account row is where "계정 확인 중" is on screen on a PC (the
  // Header account area only exists on a phone). Same delayed 로그인 as the
  // Header's: hidden for 0.8 s so a quick answer never flashes it, withdrawn
  // when Account answers signed-in (withdrawLoginWhileChecking). It reuses the
  // sidebar's own recovery-button look.
  const login = recoveryLoginLink('sidebar-account-recovery-action account-login-while-checking');
  return [placeholder, status, login];
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

function clearUnknownRetry({resetAttempt = true} = {}) {
  if (unknownRetryTimer !== undefined) {
    clearTimeout(unknownRetryTimer);
    unknownRetryTimer = undefined;
  }
  if (resetAttempt) unknownRetryAttempt = 0;
}

function scheduleUnknownRetry() {
  if (
    !rootLocation()
    || redirecting
    || unknownRetryTimer !== undefined
    || unknownRetryAttempt >= ACCOUNT_STATUS_RETRY_DELAYS_MS.length
  ) return;

  const attempt = unknownRetryAttempt + 1;
  const delayMs = ACCOUNT_STATUS_RETRY_DELAYS_MS[unknownRetryAttempt];
  unknownRetryAttempt = attempt;
  unknownRetryTimer = setTimeout(() => {
    unknownRetryTimer = undefined;
    if (!rootLocation() || redirecting) return;
    recordTiming('account-status-auto-retry', {attempt, delayMs});
    void synchronizeAccountContinuity({preserveUnknownUi: true});
  }, delayMs);
}

function requestAccountContinuityRetry() {
  if (!rootLocation() || checking || redirecting) return;
  clearUnknownRetry({resetAttempt: true});
  recordTiming('account-status-manual-retry', {elapsedMs: Math.round(performanceNow())});
  void synchronizeAccountContinuity();
}

function recoveryRetryButton(className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = '다시 확인';
  button.addEventListener('click', requestAccountContinuityRetry);
  return button;
}

function recoveryLoginLink(className) {
  const link = document.createElement('a');
  link.className = className;
  link.href = LOGIN_URL;
  link.textContent = '로그인';
  return installDirectLoginHandoff(link);
}

function markCheckingSidebarAccountUi(message = '계정 상태 확인 중') {
  for (const slot of sidebarAccountSlots()) {
    slot.replaceChildren(...sidebarCheckingNodes(message));
    setSidebarAuthState(slot, AUTH_STATE_CHECKING, true);
  }
}

function markUnknownSidebarAccountUi() {
  for (const slot of sidebarAccountSlots()) {
    const state = document.createElement('div');
    state.className = 'sidebar-account-entry sidebar-account-unknown';

    const primary = document.createElement('span');
    primary.className = 'sidebar-account-name';
    primary.textContent = '계정 상태를 확인하지 못했어요.';

    const detail = document.createElement('span');
    detail.className = 'sidebar-account-handle';
    detail.setAttribute('role', 'status');
    detail.textContent = '다시 확인하거나 로그인해 주세요.';

    const controls = document.createElement('span');
    controls.className = 'sidebar-account-recovery-actions';
    controls.append(
      recoveryRetryButton('sidebar-account-recovery-action'),
      recoveryLoginLink('sidebar-account-recovery-action sidebar-account-recovery-login'),
    );

    state.append(primary, detail, controls);
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
    primary.textContent = '내 프로필';
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

    const status = document.createElement('span');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    status.textContent = '계정 상태를 확인하지 못했어요. 다시 확인하거나 로그인해 주세요.';

    state.append(
      status,
      recoveryRetryButton('account-auth-retry'),
      recoveryLoginLink('account-auth-login'),
    );
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

// One timer serves the Site session: it fires shortly before the bearer runs
// out to renew it in place, and again at the real expiry if renewal could not
// finish. Running out never paints the login button first — Account decides.
function armSessionTimer(delay) {
  clearExpiryTimer();
  expiryTimer = setTimeout(() => {
    expiryTimer = undefined;
    void handleSessionTimer();
  }, Math.min(delay, 2_147_000_000));
}

function scheduleExpiry(expiresAt) {
  clearExpiryTimer();
  const milliseconds = Date.parse(expiresAt);
  if (!Number.isFinite(milliseconds)) return;
  siteSessionExpiresAt = milliseconds;
  const delay = Math.max(0, milliseconds - SITE_SESSION_RENEW_BEFORE_EXPIRY_MS - Date.now());
  armSessionTimer(delay);
}

function hasLiveSiteSession() {
  return siteSessionActive
    && (siteSessionExpiresAt === 0 || siteSessionExpiresAt > Date.now());
}

function siteSessionNearExpiry() {
  return siteSessionExpiresAt > 0 && siteSessionExpiresAt - Date.now() <= SITE_SESSION_RENEW_BEFORE_EXPIRY_MS;
}

function siteLogoutInEffect() {
  return siteLogoutSuppressed || hasSiteLogoutSuppression();
}

// AUTH-SESSION-CONTINUITY-P0-02 — renew (or first restore) the Site session
// without leaving the page. PKCE, state and one-time redeem are the same as the
// redirect handoff (site-auth.js renewSiteSessionSilently). Outcomes:
//   RESTORED   the conversation holds the new bearer
//   SIGNED_OUT Account itself has no session — the only route to login UI
//   FAILED     anything transient; callers keep the current state and retry,
//              or fall back to the redirect handoff
function restoreSiteSessionInPlace(reason) {
  if (renewalInFlight) return renewalInFlight;
  const renewingLiveSession = hasLiveSiteSession();
  const previousInstallationId = siteSessionInstallationId;
  const startedAt = performanceNow();
  lastRenewalStartedAt = Date.now();
  renewalInFlight = (async () => {
    let outcome = 'FAILED';
    let code = '';
    try {
      const result = await renewSiteSessionSilently();
      if (result.status === 'SIGNED_OUT') {
        outcome = 'SIGNED_OUT';
      } else if (adoptSiteSession(result.session)) {
        outcome = 'RESTORED';
        const sameInstallation = Boolean(previousInstallationId)
          && previousInstallationId === result.session.installationId;
        if ((renewingLiveSession && hasLiveSiteSession()) || sameInstallation) {
          // Same person, same page: only the bearer and its timer change, so
          // nothing on screen closes or reloads.
          siteSessionActive = true;
          scheduleExpiry(result.session.expiresAt);
          if (!renewingLiveSession) {
            clearUnknownRetry({resetAttempt: true});
            markAuthenticatedAccountUi();
          }
        } else {
          window.dispatchEvent(new CustomEvent(SITE_SESSION_STATE_EVENT, {
            detail: {
              authenticated: true,
              expiresAt: result.session.expiresAt,
              installationId: result.session.installationId,
            },
          }));
        }
      } else {
        code = 'SITE_SESSION_NOT_ADOPTED';
      }
    } catch (error) {
      code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
    } finally {
      renewalInFlight = undefined;
    }
    recordTiming('site-session-renewal', {
      reason,
      outcome,
      code,
      durationMs: Math.round(Math.max(0, performanceNow() - startedAt)),
    });
    return outcome;
  })();
  return renewalInFlight;
}

function showAccountSignedOut() {
  siteSessionInstallationId = '';
  clearUnknownRetry({resetAttempt: true});
  clearSiteLogoutSuppression();
  siteLogoutSuppressed = false;
  siteSessionActive = false;
  siteSessionExpiresAt = 0;
  clearExpiryTimer();
  markAnonymousAccountUi();
}

async function renewLiveSiteSession(reason) {
  if (!rootLocation() || redirecting || siteLogoutInEffect()) return;
  // focus/visibility/pageshow can fire together on resume; one attempt per window.
  if (reason === 'resume' && Date.now() - lastRenewalStartedAt < SITE_SESSION_RENEWAL_MIN_INTERVAL_MS) return;
  const outcome = await restoreSiteSessionInPlace(reason);
  if (outcome === 'RESTORED') return;
  if (outcome === 'SIGNED_OUT') {
    showAccountSignedOut();
    return;
  }
  // The bearer this page holds is still good until it runs out; try again.
  if (hasLiveSiteSession()) {
    armSessionTimer(Math.max(1000, Math.min(SITE_SESSION_RENEWAL_RETRY_MS, siteSessionExpiresAt - Date.now())));
  }
}

async function handleSessionTimer() {
  if (!hasLiveSiteSession()) {
    // It really ran out (renewal kept failing, or the tab slept through it).
    // Neutral "checking" first; synchronizeAccountContinuity asks Account.
    siteSessionActive = false;
    siteSessionExpiresAt = 0;
    void synchronizeAccountContinuity();
    return;
  }
  if (document.visibilityState === 'hidden') {
    // A hidden tab renews on its way back (visibilitychange); keep a timer
    // for the real expiry only.
    armSessionTimer(Math.max(0, siteSessionExpiresAt - Date.now()));
    return;
  }
  await renewLiveSiteSession('timer');
}

// Core refused the Site bearer mid-use (site-conversation.js dropped it).
async function renewAfterCoreRefusal() {
  const outcome = await restoreSiteSessionInPlace('core-refused');
  if (outcome === 'RESTORED') return;
  if (outcome === 'SIGNED_OUT') {
    showAccountSignedOut();
    return;
  }
  siteSessionActive = false;
  siteSessionExpiresAt = 0;
  clearExpiryTimer();
  void synchronizeAccountContinuity();
}

export async function synchronizeAccountContinuity({preserveUnknownUi = false} = {}) {
  if (!rootLocation() || checking || redirecting) return;
  checking = true;
  if (
    !hasLiveSiteSession()
    && !(preserveUnknownUi && document.body.dataset.siteAuthState === AUTH_STATE_UNKNOWN)
  ) markCheckingAccountUi();
  const statusStartedAt = performanceNow();
  try {
    const authenticated = await readAccountSessionStatus();
    recordTiming('account-status', {
      durationMs: Math.round(Math.max(0, performanceNow() - statusStartedAt)),
      authenticated,
    });
    // Signed in: the 로그인 offered while waiting must not show any more.
    if (authenticated !== false) withdrawLoginWhileChecking();

    if (authenticated === false) {
      lastSignedOutAnswerAt = Date.now();
      clearUnknownRetry({resetAttempt: true});
      clearSiteLogoutSuppression();
      siteLogoutSuppressed = false;
      siteSessionActive = false;
      siteSessionExpiresAt = 0;
      clearExpiryTimer();
      markAnonymousAccountUi();
      return;
    }

    if (siteLogoutSuppressed || hasSiteLogoutSuppression()) {
      clearUnknownRetry({resetAttempt: true});
      siteLogoutSuppressed = true;
      siteSessionActive = false;
      siteSessionExpiresAt = 0;
      clearExpiryTimer();
      markAnonymousAccountUi();
      return;
    }

    if (hasLiveSiteSession()) {
      clearUnknownRetry({resetAttempt: true});
      markAuthenticatedAccountUi();
      // Back from the background close to (or past) the renewal point.
      if (siteSessionNearExpiry()) void renewLiveSiteSession('resume');
      return;
    }

    clearUnknownRetry({resetAttempt: true});
    // AUTH-SESSION-CONTINUITY-P0-02 — refresh, tab restore, reopened browser
    // or a 30-minute lapse: restore in place first. Only if that cannot finish
    // (Account route unreachable, older Account deploy) does the page fall
    // back to the redirect handoff below.
    const restored = await restoreSiteSessionInPlace('restore');
    if (restored === 'RESTORED') return;
    if (restored === 'SIGNED_OUT') {
      showAccountSignedOut();
      return;
    }
    // SITE-LOGIN-HANDOFF-REPEAT-01 — one miss on a phone network (a timeout, a
    // dropped request) sent a signed-in person on the full Account round trip
    // at once. The in-place restore gets one more go first.
    const retried = await restoreSiteSessionInPlace('restore-retry');
    if (retried === 'RESTORED') return;
    if (retried === 'SIGNED_OUT') {
      showAccountSignedOut();
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
    if (hasLiveSiteSession()) {
      clearUnknownRetry({resetAttempt: true});
      markAuthenticatedAccountUi();
    } else {
      markUnknownAccountUi();
      scheduleUnknownRetry();
    }
  } finally {
    checking = false;
  }
}

function handleSiteSessionState(event) {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (!detail || typeof detail.authenticated !== 'boolean') return;

  if (detail.authenticated) {
    clearUnknownRetry({resetAttempt: true});
    clearSiteLogoutSuppression();
    siteLogoutSuppressed = false;
    siteSessionActive = true;
    if (typeof detail.installationId === 'string' && detail.installationId) siteSessionInstallationId = detail.installationId;
    markAuthenticatedAccountUi();
    if (typeof detail.expiresAt === 'string') scheduleExpiry(detail.expiresAt);
    return;
  }

  siteSessionActive = false;
  siteSessionExpiresAt = 0;
  clearExpiryTimer();
  clearUnknownRetry({resetAttempt: true});
  if (detail.reason === 'site-logout') {
    siteSessionInstallationId = '';
    markSiteLogoutSuppression();
    siteLogoutSuppressed = true;
    markAnonymousAccountUi();
    return;
  }
  // AUTH-SESSION-CONTINUITY-P0-02 — Core refusing the Site bearer (401/403,
  // site-core.js) is not proof of a logout: the 30-minute child ran out, or a
  // background tab slept through it. On Home, Account decides — the neutral
  // "checking" state is shown, never the login button first.
  // SITE-SESSION-REQUEST-STORM-P0-01 — Account has just answered "signed out"
  // and the Home already shows it: another refused request on the page does
  // not ask Account again (one tab asked ~10 times a second, 2026-10-10).
  if (
    rootLocation()
    && document.body.dataset.siteAuthState === AUTH_STATE_UNAUTHENTICATED
    && Date.now() - lastSignedOutAnswerAt < ACCOUNT_STATUS_SIGNED_OUT_RECHECK_MS
  ) return;
  if (rootLocation()) {
    void synchronizeAccountContinuity();
    return;
  }
  markAnonymousAccountUi();
}

window.addEventListener(SITE_SESSION_STATE_EVENT, handleSiteSessionState);
window.addEventListener('pageshow', event => {
  // AUTH-SESSION-CONTINUITY-P0-02 — a page restored from the back/forward
  // cache comes back exactly as it left: mid-handoff, with the redirect guard
  // still set, which used to block every later check on that page.
  if (event?.persisted) {
    redirecting = false;
    checking = false;
  }
  if (!rootLocation()) return;
  // SITE-LOGIN-HANDOFF-REPEAT-01 — an ordinary load also fires pageshow, right
  // after load. The check started at DOMContentLoaded already covers that
  // load; when it had already finished, this asked Account (and renewed) a
  // second time for the same page. Only a page brought back from the
  // back/forward cache needs a fresh check here.
  if (!event?.persisted) return;
  clearUnknownRetry({resetAttempt: true});
  void synchronizeAccountContinuity();
});
window.addEventListener('online', () => {
  if (!rootLocation()) return;
  clearUnknownRetry({resetAttempt: true});
  void synchronizeAccountContinuity({preserveUnknownUi: true});
});
window.addEventListener(SITE_SESSION_RENEWAL_REQUEST_EVENT, () => {
  if (!rootLocation() || redirecting || siteLogoutInEffect()) return;
  const sinceLast = Date.now() - lastRenewalStartedAt;
  if (sinceLast < SITE_SESSION_RENEWAL_MIN_INTERVAL_MS) {
    if (hasLiveSiteSession()) armSessionTimer(SITE_SESSION_RENEWAL_MIN_INTERVAL_MS - sinceLast);
    return;
  }
  void renewAfterCoreRefusal();
});
window.addEventListener('focus', () => {
  if (!rootLocation()) return;
  clearUnknownRetry({resetAttempt: true});
  void synchronizeAccountContinuity();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !rootLocation()) return;
  clearUnknownRetry({resetAttempt: true});
  void synchronizeAccountContinuity();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (rootLocation()) void synchronizeAccountContinuity();
  }, {once: true});
} else if (rootLocation()) {
  void synchronizeAccountContinuity();
}
