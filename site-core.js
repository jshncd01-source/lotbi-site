export const CORE_ORIGIN = 'https://api.lotbiai.com';
export const SITE_AUDIENCE = 'lotbiai.com';
export const SITE_CALLBACK_URI = 'https://lotbiai.com/auth/callback';

const CONVERSATION_PATH = '/v2/conversation/messages';
const HANDOFF_REDEEM_PATH = '/v2/sessions/handoffs/redeem';
const SUBSCRIPTION_PATH = '/v2/subscription';

export class SiteCoreError extends Error {
  constructor(message, {code = 'SITE_CORE_ERROR', status = 0, retryable = false, correlationId = ''} = {}) {
    super(message);
    this.name = 'SiteCoreError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
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

function subscriptionContractError() {
  return new SiteCoreError('LOTBI 구독 응답 형식이 올바르지 않습니다.', {code: 'SUBSCRIPTION_CONTRACT_INVALID'});
}

function subscriptionRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw subscriptionContractError();
  return value;
}

function subscriptionEnum(value, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw subscriptionContractError();
  return value;
}

function subscriptionInteger(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw subscriptionContractError();
  return value;
}

function subscriptionBoolean(value) {
  if (typeof value !== 'boolean') throw subscriptionContractError();
  return value;
}

function subscriptionPeriod(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || Number.isNaN(Date.parse(value))) {
    throw subscriptionContractError();
  }
  return value;
}

function parseSubscriptionState(value) {
  const payload = subscriptionRecord(value);
  const plan = subscriptionEnum(payload.plan, ['FREE', 'LOTBI_PLUS']);
  const status = subscriptionEnum(payload.status, ['FREE', 'ACTIVE', 'GRACE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END', 'EXPIRED']);
  const provider = payload.provider === null ? null : subscriptionEnum(payload.provider, ['TOSS', 'APPLE', 'GOOGLE_PLAY']);
  if (payload.price !== 9900 || payload.currency !== 'KRW' || payload.free_units !== 3) throw subscriptionContractError();

  const usedFreeUnits = subscriptionInteger(payload.used_free_units);
  const remainingFreeUnits = subscriptionInteger(payload.remaining_free_units);
  if (remainingFreeUnits > 3) throw subscriptionContractError();

  const entitled = subscriptionBoolean(payload.entitled);
  if (plan === 'FREE' && (status !== 'FREE' || entitled)) throw subscriptionContractError();
  if (plan === 'LOTBI_PLUS' && status === 'FREE') throw subscriptionContractError();

  if (!Array.isArray(payload.web_payment_methods)) throw subscriptionContractError();
  const seenMethods = new Set();
  const webPaymentMethods = payload.web_payment_methods.map(item => {
    const method = subscriptionRecord(item);
    const code = subscriptionEnum(method.code, ['CARD', 'BANK_ACCOUNT']);
    if (seenMethods.has(code) || typeof method.display_name !== 'string' || !method.display_name.trim()) {
      throw subscriptionContractError();
    }
    seenMethods.add(code);
    return {code, displayName: method.display_name};
  });

  return {
    plan,
    status,
    price: 9900,
    currency: 'KRW',
    provider,
    currentPeriodEnd: subscriptionPeriod(payload.current_period_end),
    cancelAtPeriodEnd: subscriptionBoolean(payload.cancel_at_period_end),
    freeUnits: 3,
    usedFreeUnits,
    remainingFreeUnits,
    entitled,
    webPaymentMethods,
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

export async function readSubscriptionState(sessionToken, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${SUBSCRIPTION_PATH}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new SiteCoreError('LOTBI 구독 서버에 접속하지 못했습니다.', {
      code: 'SUBSCRIPTION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, 'LOTBI 구독 상태를 확인하지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }

  return Object.freeze(parseSubscriptionState(payload));
}

export async function sendConversationMessage(sessionToken, text, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  if (!message || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }

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
      },
      body: JSON.stringify({text: message}),
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

  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
  });
}
