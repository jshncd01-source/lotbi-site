export const CORE_ORIGIN = 'https://api.lotbiai.com';
export const SITE_AUDIENCE = 'lotbiai.com';
export const SITE_CALLBACK_URI = 'https://lotbiai.com/auth/callback';

const CONVERSATION_PATH = '/v2/conversation/messages';
const PRODUCT_CARD_SEARCH_PATH = '/v2/product-resolutions/search';
const PUBLIC_PRODUCT_CARD_SEARCH_PATH = '/v2/public/product-cards/search';
const GUEST_SESSION_PATH = '/v2/conversation/guest/sessions';
const GUEST_CONVERSATION_PATH = '/v2/conversation/guest/messages';
const CONVERSATION_ATTACHMENT_PATH = '/v2/conversation/attachments';
const GUEST_IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,160}$/;
const HANDOFF_REDEEM_PATH = '/v2/sessions/handoffs/redeem';
const CURRENT_USER_PATH = '/v2/me';
const SUBSCRIPTION_PATH = '/v2/subscription';
const LOGOUT_PATH = '/v2/sessions/logout';

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

function normalizeAttachmentIds(attachmentIds) {
  if (!Array.isArray(attachmentIds)) return [];
  const normalized = attachmentIds.map(value => typeof value === 'string' ? value.trim() : '');
  if (normalized.length > 4 || normalized.some(value => !/^att_[A-Za-z0-9]{8,56}$/.test(value))) {
    throw new SiteCoreError('첨부 파일 참조가 올바르지 않습니다.', {code: 'CONVERSATION_ATTACHMENT_REFERENCE_INVALID', status: 422});
  }
  return normalized;
}

export async function uploadConversationAttachment({sessionToken = '', guestToken = '', file}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  if (!(file instanceof Blob) || typeof file.name !== 'string') {
    throw new SiteCoreError('첨부할 파일을 선택해 주세요.', {code: 'CONVERSATION_ATTACHMENT_FILE_REQUIRED', status: 422});
  }
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const guest = typeof guestToken === 'string' ? guestToken.trim() : '';
  if (!token && (guest.length < 32 || guest.length > 256)) {
    throw new SiteCoreError('첨부 파일을 위한 LOTBI 세션이 필요합니다.', {code: 'CONVERSATION_ATTACHMENT_SESSION_REQUIRED', status: 401});
  }
  const form = new FormData();
  form.append('file', file, file.name);
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${CONVERSATION_ATTACHMENT_PATH}`, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: token ? {Authorization: `Bearer ${token}`} : {'X-LOTBI-Guest-Token': guest},
      body: form,
    });
  } catch {
    throw new SiteCoreError('첨부 파일 서버에 접속하지 못했습니다.', {code: 'CONVERSATION_ATTACHMENT_NETWORK_ERROR', retryable: true});
  }
  const payload = await readPayload(response);
  if (!response.ok) throw errorFromResponse(response, payload, '첨부 파일을 업로드하지 못했습니다.');
  const attachment = payload && payload.attachment;
  if (payload.contract_id !== 'CORE-CONVERSATION-ATTACHMENT-01' || payload.schema_version !== 1 || !attachment || !/^att_[A-Za-z0-9]{8,56}$/.test(String(attachment.id || '')) || attachment.status !== 'READY') {
    throw new SiteCoreError('첨부 파일 응답 형식이 올바르지 않습니다.', {code: 'CONVERSATION_ATTACHMENT_CONTRACT_INVALID'});
  }
  return Object.freeze({...attachment});
}

export async function sendConversationMessage(sessionToken, text, fetchImpl = globalThis.fetch, attachmentIds = []) {
  assertFetch(fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  const attachments = normalizeAttachmentIds(attachmentIds);
  if ((!message && !attachments.length) || message.length > 1000) {
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
      body: JSON.stringify(attachments.length
        ? {text: message || '첨부 파일을 확인해 주세요.', attachment_ids: attachments}
        : {text: message}),
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
    intent: payload.intent && typeof payload.intent === 'object' ? Object.freeze({...payload.intent}) : Object.freeze({action: 'UNKNOWN'}),
    placeResult: payload.place_result && typeof payload.place_result === 'object' ? Object.freeze({...payload.place_result}) : null,
  });
}

export async function createGuestConversationSession(fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${GUEST_SESSION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new SiteCoreError('LOTBI 익명 대화 세션에 접속하지 못했습니다.', {
      code: 'GUEST_SESSION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 익명 대화 세션을 시작하지 못했습니다.');
  }

  const guestToken = typeof payload.guest_token === 'string' ? payload.guest_token.trim() : '';
  const expiresAt = typeof payload.expires_at === 'string' ? payload.expires_at.trim() : '';
  if (
    payload.contract_id !== 'CORE-GUEST-SESSION-01'
    || payload.schema_version !== 1
    || guestToken.length < 32
    || guestToken.length > 256
    || !expiresAt
    || !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new SiteCoreError('LOTBI 익명 대화 세션 응답이 올바르지 않습니다.', {
      code: 'GUEST_SESSION_CONTRACT_INVALID',
    });
  }

  return Object.freeze({guestToken, expiresAt});
}

function normalizeGuestRecentContext(recentContext) {
  if (!Array.isArray(recentContext)) return [];
  return recentContext.slice(-6).flatMap(item => {
    const role = typeof item?.role === 'string' ? item.role.trim().toLowerCase() : '';
    const text = typeof item?.text === 'string' ? item.text.trim() : '';
    if (!['user', 'assistant'].includes(role) || !text || text.length > 500) return [];
    return [{role, text}];
  });
}

export async function sendGuestConversationMessage({
  guestToken,
  text,
  idempotencyKey,
  recentContext = [],
  timezone = '',
  attachmentIds = [],
}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const token = typeof guestToken === 'string' ? guestToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  const logicalKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  const timezoneName = typeof timezone === 'string' ? timezone.trim() : '';
  if (token.length < 32 || token.length > 256) {
    throw new SiteCoreError('LOTBI 익명 대화 세션이 필요합니다.', {code: 'GUEST_SESSION_INVALID', status: 401});
  }
  const attachments = normalizeAttachmentIds(attachmentIds);
  if ((!message && !attachments.length) || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }
  if (!GUEST_IDEMPOTENCY_RE.test(logicalKey)) {
    throw new SiteCoreError('익명 대화 요청 식별값이 올바르지 않습니다.', {code: 'INVALID_GUEST_IDEMPOTENCY_KEY', status: 422});
  }

  const body = {text: message || '첨부 파일을 확인해 주세요.', recent_context: normalizeGuestRecentContext(recentContext)};
  if (attachments.length) body.attachment_ids = attachments;
  if (timezoneName && timezoneName.length <= 64) body.client_context = {timezone: timezoneName};

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${GUEST_CONVERSATION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': logicalKey,
        'X-LOTBI-Guest-Token': token,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SiteCoreError('LOTBI 익명 대화 서버에 접속하지 못했습니다.', {
      code: 'GUEST_CONVERSATION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 익명 대화 응답을 받지 못했습니다.');
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
    || !payload.safety
    || payload.safety.execution_authority !== false
    || payload.safety.external_side_effect !== false
  ) {
    throw new SiteCoreError('LOTBI 익명 대화 응답 형식이 올바르지 않습니다.', {code: 'GUEST_CONVERSATION_CONTRACT_INVALID'});
  }

  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
    intent: payload.intent && typeof payload.intent === 'object' ? Object.freeze({...payload.intent}) : Object.freeze({action: 'UNKNOWN'}),
    placeResult: payload.place_result && typeof payload.place_result === 'object' ? Object.freeze({...payload.place_result}) : null,
  });
}

function bearerToken(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  return token;
}

async function siteSessionRequest(path, sessionToken, {method = 'GET', announceSessionFailure = true} = {}, fetchImpl = globalThis.fetch) {
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
    if (announceSessionFailure) announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}

function assertRichProductCard(card) {
  return card
    && Number.isInteger(card.candidate_index)
    && typeof card.title === 'string'
    && card.title.trim().length > 0
    && (card.price === null || card.price === undefined || Number.isInteger(card.price))
    && typeof card.currency === 'string';
}

async function authenticatedJsonRequest(path, sessionToken, {method = 'GET', body = undefined} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const headers = {Authorization: 'Bearer ' + bearerToken(sessionToken)};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(CORE_ORIGIN + path, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new SiteCoreError('LOTBI 상품 검색 서버에 접속하지 못했습니다.', {
      code: 'RICH_PRODUCT_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, '상품 정보를 확인하지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}


export async function searchPublicProductCards({
  query,
  merchantCode = '',
  merchantExplicit = false,
  maxResults = 6,
} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 500) {
    throw new SiteCoreError('상품 검색어를 확인해 주세요.', {code: 'RICH_PRODUCT_QUERY_INVALID'});
  }
  const params = new URLSearchParams({
    query: normalizedQuery,
    max_results: String(Number.isInteger(maxResults) ? Math.min(6, Math.max(1, maxResults)) : 6),
  });
  if (typeof merchantCode === 'string' && merchantCode.trim()) params.set('merchant_code', merchantCode.trim());
  if (merchantExplicit === true) params.set('merchant_explicit', 'true');

  let response;
  try {
    response = await fetchImpl(CORE_ORIGIN + PUBLIC_PRODUCT_CARD_SEARCH_PATH + '?' + params.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {},
    });
  } catch {
    throw new SiteCoreError('LOTBI 상품 검색 서버에 접속하지 못했습니다.', {
      code: 'RICH_PRODUCT_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, '상품 정보를 확인하지 못했습니다.');
  }
  if (
    payload.contract_id !== 'CORE-PUBLIC-RICH-PRODUCT-DISCOVERY-01'
    || payload.schema_version !== 1
    || typeof payload.display_id !== 'string'
    || !Array.isArray(payload.cards)
    || payload.cards.some(card => !assertRichProductCard(card))
    || payload.purchase_requires_login !== true
    || payload.selection_available !== false
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.transaction_created !== false
    || payload.order_created !== false
    || payload.payment_attempted !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('공개 상품 카드 응답 형식이 올바르지 않습니다.', {code: 'PUBLIC_RICH_PRODUCT_CONTRACT_INVALID'});
  }
  return Object.freeze({
    displayId: payload.display_id,
    status: payload.status,
    query: typeof payload.query === 'string' ? payload.query : normalizedQuery,
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    sourceMode: typeof payload.source_mode === 'string' ? payload.source_mode : '',
    cards: Object.freeze(payload.cards.slice(0, 6).map(card => Object.freeze({...card}))),
    purchaseRequiresLogin: true,
  });
}

export async function searchProductCards(sessionToken, {
  query,
  originalText = '',
  merchantCode = '',
  merchantExplicit = false,
  brand = '',
  maxPrice = null,
  preferences = [],
  maxResults = 6,
} = {}, fetchImpl = globalThis.fetch) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 500) {
    throw new SiteCoreError('상품 검색어를 확인해 주세요.', {code: 'RICH_PRODUCT_QUERY_INVALID'});
  }
  const payload = await authenticatedJsonRequest(PRODUCT_CARD_SEARCH_PATH, sessionToken, {
    method: 'POST',
    body: {
      query: normalizedQuery,
      original_text: typeof originalText === 'string' && originalText.trim() ? originalText.trim().slice(0, 1000) : normalizedQuery,
      merchant_code: typeof merchantCode === 'string' && merchantCode.trim() ? merchantCode.trim() : null,
      merchant_explicit: merchantExplicit === true,
      brand: typeof brand === 'string' && brand.trim() ? brand.trim().slice(0, 120) : null,
      max_price: Number.isInteger(maxPrice) && maxPrice >= 0 ? maxPrice : null,
      preferences: Array.isArray(preferences) ? preferences.filter(value => typeof value === 'string').slice(0, 12) : [],
      max_results: Number.isInteger(maxResults) ? Math.min(6, Math.max(1, maxResults)) : 6,
    },
  }, fetchImpl);
  if (
    payload.contract_id !== 'CORE-RICH-PRODUCT-DISCOVERY-01'
    || payload.schema_version !== 1
    || typeof payload.resolution_id !== 'string'
    || !/^[0-9a-f]{64}$/.test(String(payload.resolution_hash || ''))
    || typeof payload.cards_path !== 'string'
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('상품 검색 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_SEARCH_CONTRACT_INVALID'});
  }
  return Object.freeze({
    commandId: payload.command_id,
    resolutionId: payload.resolution_id,
    resolutionHash: payload.resolution_hash,
    status: payload.status,
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    sourceMode: payload.source_mode,
    candidateCount: Number.isInteger(payload.candidate_count) ? payload.candidate_count : 0,
    cardsPath: payload.cards_path,
  });
}

export async function getProductCards(sessionToken, resolutionId, fetchImpl = globalThis.fetch) {
  const id = typeof resolutionId === 'string' ? resolutionId.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) {
    throw new SiteCoreError('상품 후보 식별자가 올바르지 않습니다.', {code: 'RICH_PRODUCT_RESOLUTION_INVALID'});
  }
  const payload = await authenticatedJsonRequest('/v2/product-resolutions/' + encodeURIComponent(id) + '/cards', sessionToken, {}, fetchImpl);
  if (
    payload.contract_id !== 'CORE-SHOP-UI-01A'
    || payload.schema_version !== 1
    || payload.resolution_id !== id
    || !/^[0-9a-f]{64}$/.test(String(payload.resolution_hash || ''))
    || !Array.isArray(payload.cards)
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.cards.some(card => !assertRichProductCard(card))
  ) {
    throw new SiteCoreError('상품 카드 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_CARDS_CONTRACT_INVALID'});
  }
  return Object.freeze({
    resolutionId: payload.resolution_id,
    resolutionHash: payload.resolution_hash,
    status: payload.status,
    query: typeof payload.query === 'string' ? payload.query : '',
    sourceMode: typeof payload.source_mode === 'string' ? payload.source_mode : '',
    expired: payload.expired === true,
    cards: Object.freeze(payload.cards.map(card => Object.freeze({...card}))),
  });
}

export async function reviewProductCard(sessionToken, {
  resolutionId,
  resolutionHash,
  candidateIndex,
} = {}, fetchImpl = globalThis.fetch) {
  const id = typeof resolutionId === 'string' ? resolutionId.trim() : '';
  const hash = typeof resolutionHash === 'string' ? resolutionHash.trim() : '';
  if (!id || !/^[0-9a-f]{64}$/.test(hash) || !Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex > 19) {
    throw new SiteCoreError('구매 검토 대상이 올바르지 않습니다.', {code: 'RICH_PRODUCT_REVIEW_INPUT_INVALID'});
  }
  const payload = await authenticatedJsonRequest('/v2/product-resolutions/' + encodeURIComponent(id) + '/review', sessionToken, {
    method: 'POST',
    body: {candidate_index: candidateIndex, expected_resolution_hash: hash},
  }, fetchImpl);
  if (
    payload.contract_id !== 'CORE-RICH-PRODUCT-REVIEW-01'
    || payload.schema_version !== 1
    || payload.resolution_id !== id
    || payload.resolution_hash !== hash
    || payload.candidate_index !== candidateIndex
    || !assertRichProductCard(payload.card)
    || payload.review_required !== true
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.transaction_created !== false
    || payload.order_created !== false
    || payload.payment_attempted !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('구매 검토 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_REVIEW_CONTRACT_INVALID'});
  }
  return Object.freeze({
    card: Object.freeze({...payload.card}),
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    priceChanged: payload.price_changed === true,
    nextStep: payload.next_step,
  });
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

export async function getCurrentSubscription(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(SUBSCRIPTION_PATH, sessionToken, {announceSessionFailure: false}, fetchImpl);
  const plan = typeof payload?.plan === 'string' ? payload.plan.trim() : '';
  const status = typeof payload?.status === 'string' ? payload.status.trim() : '';
  const freeUnits = Number.isInteger(payload?.free_units) ? payload.free_units : null;
  const usedFreeUnits = Number.isInteger(payload?.used_free_units) ? payload.used_free_units : null;
  const remainingFreeUnits = Number.isInteger(payload?.remaining_free_units) ? payload.remaining_free_units : null;
  if (
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(plan)
    || !/^[A-Z][A-Z0-9_]{0,63}$/.test(status)
    || typeof payload?.entitled !== 'boolean'
    || freeUnits === null || freeUnits < 0
    || usedFreeUnits === null || usedFreeUnits < 0
    || remainingFreeUnits === null || remainingFreeUnits < 0
  ) {
    throw new SiteCoreError('LOTBI 구독 정보 응답이 올바르지 않습니다.', {code: 'SITE_SUBSCRIPTION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    plan,
    status,
    entitled: payload.entitled,
    freeUnits,
    usedFreeUnits,
    remainingFreeUnits,
  });
}

export async function logoutSiteSession(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(LOGOUT_PATH, sessionToken, {method: 'POST'}, fetchImpl);
  if (!payload || typeof payload.session_id !== 'string' || payload.status !== 'REVOKED') {
    throw new SiteCoreError('LOTBI 로그아웃 응답이 올바르지 않습니다.', {code: 'SITE_LOGOUT_CONTRACT_INVALID'});
  }
  return Object.freeze({sessionId: payload.session_id, status: payload.status});
}
