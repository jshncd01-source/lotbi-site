import {SITE_CALLBACK_URI} from './site-core.js';

export const ACCOUNT_SITE_HANDOFF_URL = 'https://account.lotbiai.com/auth/site-handoff';
export const HANDOFF_CONTEXT_KEY = 'lotbi.site-handoff.v1';
export const HANDOFF_CONTEXT_TTL_MS = 5 * 60 * 1000;
export const SITE_AUTH_CONTINUITY_KEY = 'lotbi.site-auth-continuity.v1';

const STATE_PATTERN = /^[\x21-\x7e]{16,256}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

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

function optionalBrowserStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export async function createSiteHandoffContext(pendingText = '', now = Date.now()) {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle || typeof globalThis.btoa !== 'function') {
    throw new SiteHandoffClientError('이 브라우저에서는 안전한 로그인 연결을 시작할 수 없습니다.', 'SITE_HANDOFF_CRYPTO_UNAVAILABLE');
  }
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
}

export function storeSiteHandoffContext(context, storage = browserStorage()) {
  if (!context || context.version !== 1 || !STATE_PATTERN.test(context.state) || !VERIFIER_PATTERN.test(context.codeVerifier)) {
    throw new SiteHandoffClientError('로그인 연결 정보를 저장할 수 없습니다.', 'SITE_HANDOFF_CONTEXT_INVALID');
  }
  storage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify({
    version: 1,
    state: context.state,
    codeVerifier: context.codeVerifier,
    pendingText: context.pendingText,
    startedAt: context.startedAt,
  }));
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

export function rememberSiteAuthContinuity(expiresAt, storage = optionalBrowserStorage(), now = Date.now()) {
  if (!storage || typeof expiresAt !== 'string') return false;
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    storage.removeItem(SITE_AUTH_CONTINUITY_KEY);
    return false;
  }
  storage.setItem(SITE_AUTH_CONTINUITY_KEY, JSON.stringify({version: 1, expiresAt: expiresAtMs}));
  return true;
}

export function hasSiteAuthContinuity(storage = optionalBrowserStorage(), now = Date.now()) {
  if (!storage) return false;
  const raw = storage.getItem(SITE_AUTH_CONTINUITY_KEY);
  if (!raw) return false;
  try {
    const marker = JSON.parse(raw);
    if (!marker || marker.version !== 1 || typeof marker.expiresAt !== 'number' || marker.expiresAt <= now) {
      storage.removeItem(SITE_AUTH_CONTINUITY_KEY);
      return false;
    }
    return true;
  } catch {
    storage.removeItem(SITE_AUTH_CONTINUITY_KEY);
    return false;
  }
}

export function clearSiteAuthContinuity(storage = optionalBrowserStorage()) {
  if (storage) storage.removeItem(SITE_AUTH_CONTINUITY_KEY);
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

export async function beginSiteHandoff(pendingText = '') {
  const context = await createSiteHandoffContext(pendingText);
  storeSiteHandoffContext(context);
  const target = new URL(ACCOUNT_SITE_HANDOFF_URL);
  target.searchParams.set('state', context.state);
  target.searchParams.set('code_challenge', context.codeChallenge);
  window.location.assign(target.toString());
}

export function callbackPathWithoutQuery() {
  return new URL(SITE_CALLBACK_URI).pathname;
}
