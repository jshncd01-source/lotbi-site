export const CORE_ORIGIN = 'https://api.lotbiai.com';
export const SITE_AUDIENCE = 'lotbiai.com';
export const SITE_CALLBACK_URI = 'https://lotbiai.com/auth/callback';

const CONVERSATION_PATH = '/v2/conversation/messages';
const HANDOFF_REDEEM_PATH = '/v2/sessions/handoffs/redeem';
const CURRENT_USER_PATH = '/v2/me';
const LOGOUT_PATH = '/v2/sessions/logout';
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,160}$/u;
const PENDING_CONVERSATION_STORAGE_KEY = 'lotbi.site.conversation.pending.v1';
const PENDING_CONVERSATION_LIMIT = 20;

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

function conversationSessionStorage() {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') return undefined;
    return storage;
  } catch {
    return undefined;
  }
}

function normalizePendingEntry(value) {
  const message = typeof value?.message === 'string' ? value.message.trim() : '';
  const idempotencyKey = typeof value?.idempotencyKey === 'string' ? value.idempotencyKey.trim() : '';
  if (!message || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) return undefined;
  return {message, idempotencyKey};
}

function readPendingConversations() {
  const storage = conversationSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_CONVERSATION_STORAGE_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    const rawEntries = Array.isArray(value?.entries) ? value.entries : [value];
    const entries = rawEntries.map(normalizePendingEntry).filter(Boolean).slice(0, PENDING_CONVERSATION_LIMIT);
    if (!entries.length) storage.removeItem(PENDING_CONVERSATION_STORAGE_KEY);
    return entries;
  } catch {
    try { storage.removeItem(PENDING_CONVERSATION_STORAGE_KEY); } catch {}
    return [];
  }
}

function writePendingConversations(entries) {
  const storage = conversationSessionStorage();
  if (!storage) return;
  const normalized = entries.map(normalizePendingEntry).filter(Boolean).slice(0, PENDING_CONVERSATION_LIMIT);
  try {
    if (!normalized.length) storage.removeItem(PENDING_CONVERSATION_STORAGE_KEY);
    else storage.setItem(PENDING_CONVERSATION_STORAGE_KEY, JSON.stringify({entries: normalized}));
  } catch {}
}

function rememberPendingConversation(message, idempotencyKey) {
  const entry = normalizePendingEntry({message, idempotencyKey});
  if (!entry) return;
  const entries = readPendingConversations().filter(item => item.message !== entry.message);
  writePendingConversations([entry, ...entries]);
}

function clearPendingConversation(message, idempotencyKey) {
  const entries = readPendingConversations();
  const next = entries.filter(item => !(item.message === message && item.idempotencyKey === idempotencyKey));
  if (next.length !== entries.length) writePendingConversations(next);
}

function effectiveConversationKey(message, requestedKey) {
  if (!requestedKey) return '';
  const pending = readPendingConversations().find(item => item.message === message);
  return pending?.idempotencyKey || requestedKey;
}

function responseProvesNoUncertainCharge(error) {
  if (!(error instanceof SiteCoreError)) return false;
  if (error.status > 0 && error.status < 500) return true;
  return error.status === 503 && (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_RESPONSE_UNAVAILABLE');
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

function conversationRequestOptions(optionsOrFetch, fetchImpl) {
  if (typeof optionsOrFetch === 'function') {
    return {idempotencyKey: '', fetchImpl: optionsOrFetch};
  }
  const options = optionsOrFetch && typeof optionsOrFetch === 'object' ? optionsOrFetch : {};
  return {
    idempotencyKey: typeof options.idempotencyKey === 'string' ? options.idempotencyKey.trim() : '',
    fetchImpl,
  };
}

export async function sendConversationMessage(sessionToken, text, optionsOrFetch = {}, fetchImpl = globalThis.fetch) {
  const request = conversationRequestOptions(optionsOrFetch, fetchImpl);
  assertFetch(request.fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  if (!message || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }
  if (request.idempotencyKey && !IDEMPOTENCY_KEY_RE.test(request.idempotencyKey)) {
    throw new SiteCoreError('대화 재시도 식별자가 올바르지 않습니다.', {code: 'INVALID_IDEMPOTENCY_KEY', status: 400});
  }

  const effectiveIdempotencyKey = effectiveConversationKey(message, request.idempotencyKey);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (effectiveIdempotencyKey) headers['Idempotency-Key'] = effectiveIdempotencyKey;
  if (effectiveIdempotencyKey) rememberPendingConversation(message, effectiveIdempotencyKey);

  let response;
  try {
    response = await request.fetchImpl(`${CORE_ORIGIN}${CONVERSATION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
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
    if (responseProvesNoUncertainCharge(error)) clearPendingConversation(message, effectiveIdempotencyKey);
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

  clearPendingConversation(message, effectiveIdempotencyKey);
  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
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

export async function logoutSiteSession(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(LOGOUT_PATH, sessionToken, {method: 'POST'}, fetchImpl);
  if (!payload || typeof payload.session_id !== 'string' || payload.status !== 'REVOKED') {
    throw new SiteCoreError('LOTBI 로그아웃 응답이 올바르지 않습니다.', {code: 'SITE_LOGOUT_CONTRACT_INVALID'});
  }
  return Object.freeze({sessionId: payload.session_id, status: payload.status});
}
