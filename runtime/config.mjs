const CHAT_PATH = '/v2/conversation/messages';
const DEFAULT_SITE_ORIGIN = 'https://lotbiai.com';
const DEFAULT_ACCOUNT_ORIGIN = 'https://account.lotbiai.com';

export class RuntimeConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeConfigError';
    this.code = code;
  }
}

function requiredHttpsOrigin(value, name, fallback = '') {
  const raw = String(value || fallback).trim();
  if (!raw) throw new RuntimeConfigError('RUNTIME_CONFIG_MISSING', `${name} is required`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new RuntimeConfigError('RUNTIME_CONFIG_INVALID', `${name} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new RuntimeConfigError('RUNTIME_CONFIG_INVALID', `${name} must be an HTTPS origin without credentials, query, or fragment`);
  }
  return url.origin;
}

export function runtimeConfig(env = process.env) {
  const siteOrigin = requiredHttpsOrigin(env.LOTBI_SITE_ORIGIN, 'LOTBI_SITE_ORIGIN', DEFAULT_SITE_ORIGIN);
  const accountOrigin = requiredHttpsOrigin(env.LOTBI_ACCOUNT_ORIGIN, 'LOTBI_ACCOUNT_ORIGIN', DEFAULT_ACCOUNT_ORIGIN);
  const coreOrigin = requiredHttpsOrigin(env.LOTBI_CORE_BASE_URL, 'LOTBI_CORE_BASE_URL');
  const sessionKey = String(env.LOTBI_SITE_SESSION_KEY || '').trim();
  if (!sessionKey) {
    throw new RuntimeConfigError('RUNTIME_CONFIG_MISSING', 'LOTBI_SITE_SESSION_KEY is required');
  }
  return Object.freeze({siteOrigin, accountOrigin, coreOrigin, sessionKey, chatPath: CHAT_PATH});
}
