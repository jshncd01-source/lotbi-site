import {SITE_CALLBACK_URI} from './site-core.js?v=aset-507a59068efd';

export const ACCOUNT_SITE_HANDOFF_URL = 'https://account.lotbiai.com/auth/site-handoff';
export const ACCOUNT_SITE_FALLBACK_URL = 'https://account.lotbiai.com/?site_fallback=1';
export const ACCOUNT_SITE_SESSION_STATUS_URL = 'https://account.lotbiai.com/api/auth/site-session-status';
// SITE-HOME-SAME-URL-STABILITY-01 — Account status is a presentation hint, not
// permission to block the document forever. Five seconds is deliberately above
// the normal same-region response budget while still bounding a stalled mobile
// radio / background-resume request. A timeout is UNKNOWN, never logged-out.
export const ACCOUNT_SESSION_STATUS_TIMEOUT_MS = 5000;
export const HANDOFF_CONTEXT_KEY = 'lotbi.site-handoff.v1';
export const HANDOFF_CONTEXT_TTL_MS = 5 * 60 * 1000;
export const HANDOFF_RECOVERY_KEY = 'lotbi.site-handoff-recovery.v1';
export const HANDOFF_RECOVERY_TTL_MS = 2 * 60 * 1000;

export const SITE_LOGOUT_SUPPRESSION_KEY = 'lotbi.site-logout-suppression.v1';
export const SITE_LOGOUT_SUPPRESSION_TTL_MS = 10 * 60 * 1000;

function optionalSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function markSiteLogoutSuppression(now = Date.now(), storage = optionalSessionStorage()) {
  try {
    storage?.setItem(SITE_LOGOUT_SUPPRESSION_KEY, String(now));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function clearSiteLogoutSuppression(storage = optionalSessionStorage()) {
  try {
    storage?.removeItem(SITE_LOGOUT_SUPPRESSION_KEY);
  } catch {
    // This marker is UX-only. Storage failure must never block logout/login.
  }
}

export function hasSiteLogoutSuppression(now = Date.now(), storage = optionalSessionStorage()) {
  let raw;
  try {
    raw = storage?.getItem(SITE_LOGOUT_SUPPRESSION_KEY);
  } catch {
    return false;
  }
  if (!raw || !/^\d+$/.test(raw)) {
    if (raw) clearSiteLogoutSuppression(storage);
    return false;
  }
  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt) || now < startedAt || now - startedAt > SITE_LOGOUT_SUPPRESSION_TTL_MS) {
    clearSiteLogoutSuppression(storage);
    return false;
  }
  return true;
}

const STATE_PATTERN = /^[\x21-\x7e]{16,256}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

function recordTiming(name) {
  try {
    globalThis.performance?.mark?.(`lotbi-auth:${name}`);
  } catch {
    // Timing evidence is diagnostic-only and must never affect authentication.
  }
}

export class SiteHandoffClientError extends Error {
  constructor(message, code = 'SITE_HANDOFF_CLIENT_ERROR') {
    super(message);
    this.name = 'SiteHandoffClientError';
    this.code = code;
  }
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function s256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function browserStorage() {
  try {
    return window.sessionStorage;
  } catch {
    throw new SiteHandoffClientError('브라우저의 임시 로그인 연결 저장소를 사용할 수 없습니다.', 'SITE_HANDOFF_STORAGE_UNAVAILABLE');
  }
}

export function clearSiteHandoffRecovery(storage = optionalSessionStorage()) {
  try {
    storage?.removeItem(HANDOFF_RECOVERY_KEY);
  } catch {
    // This marker is UX-only and must never weaken the PKCE boundary.
  }
}

function hasCurrentSiteHandoffRecovery(now, storage) {
  let raw;
  try {
    raw = storage?.getItem(HANDOFF_RECOVERY_KEY);
  } catch {
    return true;
  }
  if (!raw) return false;
  try {
    const marker = JSON.parse(raw);
    const current = marker?.version === 1
      && marker?.attemptCount === 1
      && typeof marker?.startedAt === 'number'
      && now >= marker.startedAt
      && now - marker.startedAt <= HANDOFF_RECOVERY_TTL_MS;
    if (current) return true;
  } catch {
    // Malformed UX-only markers are cleared and never treated as auth proof.
  }
  clearSiteHandoffRecovery(storage);
  return false;
}

export async function recoverMissingSiteHandoffContext(error, {
  storage = optionalSessionStorage(),
  now = Date.now(),
  readStatus = readAccountSessionStatus,
  beginHandoff = pendingText => beginSiteHandoff(pendingText, {recoveryAttempt: true}),
} = {}) {
  if (!(error instanceof SiteHandoffClientError) || error.code !== 'SITE_HANDOFF_CONTEXT_MISSING') return false;
  if (!storage || hasCurrentSiteHandoffRecovery(now, storage)) return false;
  if (!await readStatus()) return false;

  storage.setItem(HANDOFF_RECOVERY_KEY, JSON.stringify({
    version: 1,
    startedAt: now,
    attemptCount: 1,
  }));
  await beginHandoff('');
  return true;
}

export async function createSiteHandoffContext(pendingText = '', now = Date.now()) {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle || typeof globalThis.btoa !== 'function') {
    throw new SiteHandoffClientError('이 브라우저에서는 안전한 사이트 로그인 연결을 사용할 수 없습니다.', 'SITE_HANDOFF_CRYPTO_UNAVAILABLE');
  }
  try {
    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(32);
    const codeChallenge = await s256(codeVerifier);
    const message = typeof pendingText === 'string' ? pendingText.trim().slice(0, 1000) : '';
    return Object.freeze({
      version: 1,
      state,
      codeVerifier,
      codeChallenge,
      pendingText: message,
      startedAt: now,
    });
  } catch (error) {
    if (error instanceof SiteHandoffClientError) throw error;
    throw new SiteHandoffClientError('이 브라우저에서는 안전한 사이트 로그인 연결을 사용할 수 없습니다.', 'SITE_HANDOFF_CRYPTO_UNAVAILABLE');
  }
}

export function storeSiteHandoffContext(context, storage = browserStorage()) {
  if (!context || context.version !== 1 || !STATE_PATTERN.test(context.state) || !VERIFIER_PATTERN.test(context.codeVerifier)) {
    throw new SiteHandoffClientError('로그인 연결 정보를 저장할 수 없습니다.', 'SITE_HANDOFF_CONTEXT_INVALID');
  }
  try {
    storage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify({
      version: 1,
      state: context.state,
      codeVerifier: context.codeVerifier,
      pendingText: context.pendingText,
      startedAt: context.startedAt,
    }));
  } catch {
    throw new SiteHandoffClientError('브라우저의 임시 로그인 연결 저장소를 사용할 수 없습니다.', 'SITE_HANDOFF_STORAGE_UNAVAILABLE');
  }
}

export function readAndClearSiteHandoffContext(returnedState, storage = browserStorage(), now = Date.now()) {
  const raw = storage.getItem(HANDOFF_CONTEXT_KEY);
  storage.removeItem(HANDOFF_CONTEXT_KEY);
  if (!raw) {
    throw new SiteHandoffClientError('로그인 연결 검증값을 찾을 수 없습니다. 홈에서 다시 시도해 주세요.', 'SITE_HANDOFF_CONTEXT_MISSING');
  }

  let context;
  try {
    context = JSON.parse(raw);
  } catch {
    throw new SiteHandoffClientError('로그인 연결 검증값이 손상되었습니다.', 'SITE_HANDOFF_CONTEXT_INVALID');
  }

  if (
    !context
    || context.version !== 1
    || !STATE_PATTERN.test(context.state)
    || !VERIFIER_PATTERN.test(context.codeVerifier)
    || typeof context.startedAt !== 'number'
    || now - context.startedAt < 0
    || now - context.startedAt > HANDOFF_CONTEXT_TTL_MS
    || typeof context.pendingText !== 'string'
    || context.pendingText.length > 1000
  ) {
    throw new SiteHandoffClientError('로그인 연결 검증값이 만료되었거나 올바르지 않습니다.', 'SITE_HANDOFF_CONTEXT_INVALID');
  }

  if (typeof returnedState !== 'string' || returnedState !== context.state) {
    throw new SiteHandoffClientError('로그인 연결 상태값이 일치하지 않습니다.', 'SITE_HANDOFF_STATE_MISMATCH');
  }

  return Object.freeze(context);
}

export function parseSiteHandoffCallback(url) {
  const params = url.searchParams;
  const allowed = new Set(['code', 'state']);
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      throw new SiteHandoffClientError('허용되지 않은 로그인 연결 파라미터가 있습니다.', 'SITE_HANDOFF_CALLBACK_INVALID');
    }
  }
  const codes = params.getAll('code');
  const states = params.getAll('state');
  if (codes.length !== 1 || states.length !== 1) {
    throw new SiteHandoffClientError('로그인 연결 파라미터가 올바르지 않습니다.', 'SITE_HANDOFF_CALLBACK_INVALID');
  }
  const code = codes[0];
  const state = states[0];
  if (code.length < 32 || code.length > 256 || !STATE_PATTERN.test(state)) {
    throw new SiteHandoffClientError('로그인 연결 코드 또는 상태값이 올바르지 않습니다.', 'SITE_HANDOFF_CALLBACK_INVALID');
  }
  return Object.freeze({code, state});
}

export async function readAccountSessionStatus(
  fetchImpl = globalThis.fetch,
  {timeoutMs = ACCOUNT_SESSION_STATUS_TIMEOUT_MS} = {},
) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteHandoffClientError('LOTBI 계정 상태를 확인할 수 없습니다.', 'ACCOUNT_SESSION_STATUS_FETCH_UNAVAILABLE');
  }

  const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(Math.max(Math.round(timeoutMs), 250), 30_000)
    : ACCOUNT_SESSION_STATUS_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      // Reject the timeout result before aborting the underlying request so an
      // AbortError cannot win the Promise.race and be misclassified as a plain
      // network failure.
      reject(new SiteHandoffClientError(
        'LOTBI 계정 상태 확인 시간이 초과되었습니다.',
        'ACCOUNT_SESSION_STATUS_TIMEOUT',
      ));
      try { controller?.abort(); } catch {}
    }, boundedTimeout);
  });

  let response;
  try {
    const request = Promise.resolve().then(() => fetchImpl(ACCOUNT_SITE_SESSION_STATUS_URL, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
      ...(controller ? {signal: controller.signal} : {}),
    }));
    response = await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof SiteHandoffClientError) throw error;
    throw new SiteHandoffClientError('LOTBI 계정 상태 서버에 접속하지 못했습니다.', 'ACCOUNT_SESSION_STATUS_NETWORK_ERROR');
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    throw new SiteHandoffClientError('LOTBI 계정 상태 응답을 확인하지 못했습니다.', 'ACCOUNT_SESSION_STATUS_CONTRACT_INVALID');
  }

  if (!response.ok) {
    throw new SiteHandoffClientError('LOTBI 계정 상태를 확인하지 못했습니다.', 'ACCOUNT_SESSION_STATUS_UNAVAILABLE');
  }

  if (
    payload?.contract_id !== 'ACCOUNT-SITE-SESSION-STATUS-01'
    || payload?.schema_version !== 1
    || typeof payload?.authenticated !== 'boolean'
  ) {
    throw new SiteHandoffClientError('LOTBI 계정 상태 응답 형식이 올바르지 않습니다.', 'ACCOUNT_SESSION_STATUS_CONTRACT_INVALID');
  }

  return payload.authenticated;
}

export function shouldUseAccountSiteFallback(error) {
  return error instanceof SiteHandoffClientError
    && (error.code === 'SITE_HANDOFF_CRYPTO_UNAVAILABLE' || error.code === 'SITE_HANDOFF_STORAGE_UNAVAILABLE');
}

export async function beginSiteHandoff(pendingText = '', {recoveryAttempt = false} = {}) {
  if (!recoveryAttempt) clearSiteHandoffRecovery();
  let context;
  try {
    context = await createSiteHandoffContext(pendingText);
    storeSiteHandoffContext(context);
  } catch (error) {
    if (!shouldUseAccountSiteFallback(error)) throw error;
    recordTiming('account-navigation-fallback');
    window.location.assign(ACCOUNT_SITE_FALLBACK_URL);
    return;
  }

  const target = new URL(ACCOUNT_SITE_HANDOFF_URL);
  target.searchParams.set('state', context.state);
  target.searchParams.set('code_challenge', context.codeChallenge);
  recordTiming('account-navigation-start');
  window.location.assign(target.toString());
}

export function callbackPathWithoutQuery() {
  return new URL(SITE_CALLBACK_URI).pathname;
}
