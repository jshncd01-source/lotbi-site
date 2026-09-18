export const CORE_ORIGIN = 'https://api.lotbiai.com';
export const SITE_AUDIENCE = 'lotbiai.com';
export const SITE_CALLBACK_URI = 'https://lotbiai.com/auth/callback';

const CONVERSATION_PATH = '/v2/conversation/messages';
const HANDOFF_REDEEM_PATH = '/v2/sessions/handoffs/redeem';
const CURRENT_USER_PATH = '/v2/me';
const LOGOUT_PATH = '/v2/sessions/logout';
const SUBSCRIPTION_PATH = '/v2/subscription';
const IANA_TIMEZONE_PATTERN = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

export class SiteCoreError extends Error {
  constructor(message, {
    code = 'SITE_CORE_ERROR',
    status = 0,
    retryable = false,
    correlationId = '',
    l0Available = false,
    upgradeAvailable = false,
    upgradeAction = '',
  } = {}) {
    super(message);
    this.name = 'SiteCoreError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
    this.l0Available = l0Available;
    this.upgradeAvailable = upgradeAvailable;
    this.upgradeAction = upgradeAction;
  }
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorFromResponse(response, payload, fallback) {
  const detail = payload && typeof payload.detail === 'object' ? payload.detail : {};
  return new SiteCoreError(
    typeof detail.message === 'string' && detail.message ? detail.message : fallback,
    {
      code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
      status: response.status,
      retryable: detail.retryable === true,
      correlationId: typeof detail.correlation_id === 'string' ? detail.correlation_id : '',
      l0Available: detail.l0_available === true,
      upgradeAvailable: detail.upgrade_available === true,
      upgradeAction: typeof detail.upgrade_action === 'string' ? detail.upgrade_action : '',
    },
  );
}

function announceInvalidSiteSession(error) {
  if (!(error instanceof SiteCoreError) || (error.status !== 401 && error.status !== 403)) return;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent('lotbi:site-session-state', {
    detail: {authenticated: false},
  }));
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
}

function browserTimezone() {
  try {
    const value = globalThis.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

function safeTimezone(value) {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone || timezone.length > 64 || !IANA_TIMEZONE_PATTERN.test(timezone)) return '';
  if (timezone.split('/').some(segment => segment === '.' || segment === '..')) return '';
  return timezone;
}

function safeIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : '';
}

function safeRecentContext(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value.slice(-6)) {
    if (!item || typeof item !== 'object') continue;
    const role = typeof item.role === 'string' ? item.role.trim().toLowerCase() : '';
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!['user', 'assistant'].includes(role) || !text) continue;
    out.push({role, text: text.slice(0, 500)});
  }
  return out;
}

function conversationTransport(contextOrFetch, fetchOverride) {
  if (typeof contextOrFetch === 'function') {
    return {timezone: '', recentContext: [], fetchImpl: contextOrFetch};
  }
  const context = contextOrFetch && typeof contextOrFetch === 'object' ? contextOrFetch : undefined;
  const hasExplicitTimezone = Boolean(context && Object.prototype.hasOwnProperty.call(context, 'timezone'));
  return {
    timezone: hasExplicitTimezone ? safeTimezone(context.timezone) : safeTimezone(browserTimezone()),
    recentContext: safeRecentContext(context?.recentContext),
    idempotencyKey: safeIdempotencyKey(context?.idempotencyKey),
    fetchImpl: typeof fetchOverride === 'function' ? fetchOverride : globalThis.fetch,
  };
}

export async function redeemSiteHandoff({handoffCode, state, codeVerifier}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  if (typeof handoffCode !== 'string' || handoffCode.length < 32 || handoffCode.length > 256) {
    throw new SiteCoreError('로그인 연결 코드가 올바르지 않습니다.', {code: 'SITE_HANDOFF_CODE_INVALID'});
  }
  if (typeof state !== 'string' || state.length < 16 || state.length > 256) {
    throw new SiteCoreError('로그인 연결 상태값이 올바르지 않습니다.', {code: 'SITE_HANDOFF_STATE_INVALID'});
  }
  if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new SiteCoreError('로그인 연결 검증값이 없습니다.', {code: 'SITE_HANDOFF_VERIFIER_INVALID'});
  }

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${HANDOFF_REDEEM_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        handoff_code: handoffCode,
        audience: SITE_AUDIENCE,
        callback_uri: SITE_CALLBACK_URI,
        state,
        code_verifier: codeVerifier,
      }),
    });
  } catch {
    throw new SiteCoreError('LOTBI 로그인 연결 서버에 접속하지 못했습니다.', {
      code: 'SITE_HANDOFF_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 로그인 연결을 완료하지 못했습니다.');
  }

  const sessionToken = typeof payload.session_token === 'string' ? payload.session_token.trim() : '';
  if (!sessionToken || payload.session_type !== 'Bearer' || payload.assurance_level !== 'FULL' || payload.audience !== SITE_AUDIENCE) {
    throw new SiteCoreError('LOTBI Site 세션 응답이 올바르지 않습니다.', {code: 'SITE_SESSION_CONTRACT_INVALID'});
  }

  return Object.freeze({
    sessionToken,
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : '',
    installationId: typeof payload.installation_id === 'string' ? payload.installation_id : '',
    expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : '',
  });
}

export async function sendConversationMessage(sessionToken, text, contextOrFetch, fetchOverride) {
  const {timezone, recentContext, idempotencyKey, fetchImpl} = conversationTransport(contextOrFetch, fetchOverride);
  assertFetch(fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  if (!message || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }

  const requestBody = {text: message};
  if (timezone) requestBody.client_context = {timezone};
  if (recentContext.length) requestBody.recent_context = recentContext;

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${CONVERSATION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? {'Idempotency-Key': idempotencyKey} : {}),
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    throw new SiteCoreError('LOTBI 대화 서버에 접속하지 못했습니다.', {
      code: 'WEB_CONVERSATION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, 'LOTBI 응답을 받지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }

  const status = payload.status;
  const assistantText = typeof payload.assistant_text === 'string' ? payload.assistant_text.trim() : '';
  if (
    payload.contract_id !== 'CORE-WEB-CHAT-01'
    || payload.schema_version !== 1
    || (status !== 'ANSWERED' && status !== 'FOLLOW_UP_REQUIRED')
    || !assistantText
    || typeof payload.response_mode !== 'string'
    || typeof payload.correlation_id !== 'string'
    || !payload.follow_up
    || typeof payload.follow_up !== 'object'
  ) {
    throw new SiteCoreError('LOTBI 대화 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }

  const routing = payload.routing && typeof payload.routing === 'object'
    ? Object.freeze({...payload.routing})
    : undefined;

  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
    routing,
  });
}

function bearerToken(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  return token;
}

async function siteSessionRequest(path, sessionToken, {method = 'GET'} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {Authorization: `Bearer ${bearerToken(sessionToken)}`},
    });
  } catch {
    throw new SiteCoreError('LOTBI 계정 서버에 접속하지 못했습니다.', {
      code: 'SITE_SESSION_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, 'LOTBI Site 세션 요청을 완료하지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}

export async function getCurrentSiteUser(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(CURRENT_USER_PATH, sessionToken, {}, fetchImpl);
  const user = payload && typeof payload.user === 'object' ? payload.user : {};
  const session = payload && typeof payload.session === 'object' ? payload.session : {};
  const installation = payload && typeof payload.installation === 'object' ? payload.installation : {};
  const userId = typeof user.id === 'string' ? user.id.trim() : '';
  const sessionId = typeof session.id === 'string' ? session.id.trim() : '';
  const installationId = typeof installation.id === 'string' ? installation.id.trim() : '';
  if (!userId || !sessionId || !installationId || session.assurance_level !== 'FULL') {
    throw new SiteCoreError('LOTBI 사용자 정보 응답이 올바르지 않습니다.', {code: 'SITE_IDENTITY_CONTRACT_INVALID'});
  }
  return Object.freeze({
    userId,
    name: typeof user.name === 'string' ? user.name.trim() : '',
    accountHandle: typeof user.account_handle === 'string' ? user.account_handle.trim() : '',
    sessionId,
    installationId,
    expiresAt: typeof session.expires_at === 'string' ? session.expires_at : '',
  });
}

export async function getSubscriptionState(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(SUBSCRIPTION_PATH, sessionToken, {}, fetchImpl);
  const plan = typeof payload.plan === 'string' ? payload.plan.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status.trim() : '';
  const currency = typeof payload.currency === 'string' ? payload.currency.trim() : '';
  const price = Number(payload.price);
  const freeUnits = Number(payload.free_units);
  const usedFreeUnits = Number(payload.used_free_units);
  const remainingFreeUnits = Number(payload.remaining_free_units);
  const methods = Array.isArray(payload.web_payment_methods)
    ? payload.web_payment_methods
        .filter(item => item && typeof item.code === 'string' && typeof item.display_name === 'string')
        .map(item => Object.freeze({code: item.code.trim(), displayName: item.display_name.trim()}))
        .filter(item => item.code && item.displayName)
    : [];
  if (
    !plan || !status || !currency
    || !Number.isInteger(price) || price < 0
    || !Number.isInteger(freeUnits) || freeUnits < 0
    || !Number.isInteger(usedFreeUnits) || usedFreeUnits < 0
    || !Number.isInteger(remainingFreeUnits) || remainingFreeUnits < 0
    || typeof payload.entitled !== 'boolean'
  ) {
    throw new SiteCoreError('LOTBI 구독 정보 응답이 올바르지 않습니다.', {code: 'SITE_SUBSCRIPTION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    plan,
    status,
    price,
    currency,
    freeUnits,
    usedFreeUnits,
    remainingFreeUnits,
    entitled: payload.entitled,
    webPaymentMethods: Object.freeze(methods),
  });
}

export async function logoutSiteSession(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(LOGOUT_PATH, sessionToken, {method: 'POST'}, fetchImpl);
  if (!payload || typeof payload.session_id !== 'string' || payload.status !== 'REVOKED') {
    throw new SiteCoreError('LOTBI 로그아웃 응답이 올바르지 않습니다.', {code: 'SITE_LOGOUT_CONTRACT_INVALID'});
  }
  return Object.freeze({sessionId: payload.session_id, status: payload.status});
}
