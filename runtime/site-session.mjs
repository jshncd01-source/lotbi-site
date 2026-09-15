import {webcrypto} from 'node:crypto';

export const SITE_SESSION_COOKIE = '__Host-lotbi_site_session';
const VERSION = 'v1';
const AAD_PREFIX = 'LOTBI_SITE_SESSION';

export class SiteSessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SiteSessionError';
    this.code = code;
  }
}

function cryptoApi() {
  return globalThis.crypto || webcrypto;
}

function decodeKey(value) {
  let bytes;
  try {
    bytes = Buffer.from(String(value || ''), 'base64url');
  } catch {
    throw new SiteSessionError('SITE_SESSION_KEY_INVALID', 'Site session key is invalid');
  }
  if (bytes.length !== 32) {
    throw new SiteSessionError('SITE_SESSION_KEY_INVALID', 'Site session key must decode to exactly 32 bytes');
  }
  return bytes;
}

async function importKey(secret) {
  return cryptoApi().subtle.importKey('raw', decodeKey(secret), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
}

function aad(origin) {
  return new TextEncoder().encode(`${AAD_PREFIX}\n${SITE_SESSION_COOKIE}\n${origin}\n${VERSION}`);
}

function canonicalSession(session, nowMs = Date.now()) {
  const token = String(session?.token || '').trim();
  const assuranceLevel = String(session?.assuranceLevel || '').trim().toUpperCase();
  const expiresAt = String(session?.expiresAt || '').trim();
  const expiryMs = Date.parse(expiresAt);
  if (!token) throw new SiteSessionError('SITE_SESSION_INVALID', 'Core session token is missing');
  if (assuranceLevel !== 'FULL') throw new SiteSessionError('SITE_SESSION_ASSURANCE_INSUFFICIENT', 'FULL consumer session is required');
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) throw new SiteSessionError('SITE_SESSION_EXPIRED', 'Core session is expired');
  return Object.freeze({token, assuranceLevel, expiresAt});
}

export async function sealSiteSession(session, secret, origin, nowMs = Date.now()) {
  const value = canonicalSession(session, nowMs);
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const key = await importKey(secret);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await cryptoApi().subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad(origin)}, key, plaintext));
  return `${VERSION}.${Buffer.from(iv).toString('base64url')}.${Buffer.from(ciphertext).toString('base64url')}`;
}

export async function unsealSiteSession(envelope, secret, origin, nowMs = Date.now()) {
  const raw = String(envelope || '').trim();
  const [version, ivPart, cipherPart, extra] = raw.split('.');
  if (version !== VERSION || !ivPart || !cipherPart || extra !== undefined) {
    throw new SiteSessionError('SITE_SESSION_INVALID', 'Site session envelope is malformed');
  }
  try {
    const iv = Buffer.from(ivPart, 'base64url');
    const ciphertext = Buffer.from(cipherPart, 'base64url');
    if (iv.length !== 12 || ciphertext.length < 17) throw new Error('invalid envelope');
    const key = await importKey(secret);
    const plaintext = await cryptoApi().subtle.decrypt({name: 'AES-GCM', iv, additionalData: aad(origin)}, key, ciphertext);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    return canonicalSession(parsed, nowMs);
  } catch (error) {
    if (error instanceof SiteSessionError) throw error;
    throw new SiteSessionError('SITE_SESSION_INVALID', 'Site session envelope could not be authenticated');
  }
}

export function readCookie(request, name = SITE_SESSION_COOKIE) {
  const header = request.headers.get('cookie') || '';
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length === 0) return undefined;
  if (values.length !== 1) throw new SiteSessionError('SITE_SESSION_INVALID', 'Multiple site session cookies were supplied');
  const encoded = values[0].slice(name.length + 1);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new SiteSessionError('SITE_SESSION_INVALID', 'Site session cookie is malformed');
  }
}

export function serializeSiteSessionCookie(envelope, expiresAt, nowMs = Date.now()) {
  const expiryMs = Date.parse(String(expiresAt || ''));
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) throw new SiteSessionError('SITE_SESSION_EXPIRED', 'Site session expiry is invalid');
  const maxAge = Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
  return `${SITE_SESSION_COOKIE}=${encodeURIComponent(envelope)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Expires=${new Date(expiryMs).toUTCString()}`;
}

export function clearSiteSessionCookie() {
  return `${SITE_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
