import {beginSiteHandoff} from './site-auth.js?v=20260920-fallback4';
import {createGuestConversationSession, getCurrentSiteUser, getCurrentSubscription, getProductCards, logoutSiteSession, reviewProductCard, searchProductCards, searchPublicProductCards, sendConversationMessage, sendGuestConversationMessage, SiteCoreError} from './site-core.js?v=20260920-richcards5';
import {deterministicReply} from './site-deterministic.js';
import {executeLifeCalendarCommand, isExplicitLifeCalendarCommand} from './site-calendar.js';
import {mountLifeCalendarManager} from './site-calendar-ui.js?v=20260920-calnav9';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const SIDEBAR_RENDERED_EVENT = 'lotbi:sidebar-auth-rendered';
const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const THREAD_LIMIT = 50;
const MESSAGE_LIMIT = 120;
const PHOTO_BYTES_LIMIT = 2 * 1024 * 1024;
const PHOTO_DIMENSION_LIMIT = 4096;
const COLOR_OPTIONS = Object.freeze([
  ['default', '기본'], ['blue', '파랑'], ['purple', '보라'], ['green', '초록'],
  ['orange', '오렌지'], ['pink', '분홍'], ['gray', '회색'],
]);
const RESPONSE_GRADE_OPTIONS = Object.freeze([
  ['LIGHT', '라이트'],
  ['STANDARD', '스탠다드'],
  ['PREMIUM', '프리미엄'],
]);
const DEFAULT_RESPONSE_GRADE = 'STANDARD';
// Core Production currently has no authoritative response_grade request field.
// Keep the selector unavailable until that contract is explicit and deployed.
const RESPONSE_GRADE_BACKEND_ENABLED = false;
const diagnostics = {
  deterministicReplies: 0, coreCalls: 0, providerCallsAvoided: 0,
  lastPath: 'idle', lastVisibleAnswerMs: null, lastCoreDurationMs: null,
  lastCoreRequestDelta: null, lastExternalAiRequestDelta: null,
};

function ensureConversationStyles() {
  if (document.querySelector('link[data-site-conversation-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-conversation.css?v=20260920-richcards5';
  link.dataset.siteConversationStyles = 'true';
  document.head.appendChild(link);
}

const performanceNow = () => globalThis.performance?.now?.() ?? Date.now();
function recordTiming(name, detail = {}) {
  try { globalThis.performance?.mark?.(`lotbi-conversation:${name}`, {detail: Object.freeze({...detail})}); } catch {}
}
function resourceCounts() {
  const resources = globalThis.performance?.getEntriesByType?.('resource') || [];
  return {
    core: resources.filter(entry => String(entry.name || '').includes('/v2/conversation/')).length,
    externalAi: resources.filter(entry => /api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com/iu.test(String(entry.name || ''))).length,
  };
}
function publishDiagnostics() {
  document.body.dataset.conversationPath = diagnostics.lastPath;
  document.body.dataset.conversationLatencyMs = String(diagnostics.lastVisibleAnswerMs ?? '');
  document.body.dataset.conversationCoreRequests = String(diagnostics.lastCoreRequestDelta ?? '');
  document.body.dataset.conversationExternalAiRequests = String(diagnostics.lastExternalAiRequestDelta ?? '');
}
function safeStorage() {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_PREFIX}.probe`;
    storage.setItem(probe, '1'); storage.removeItem(probe);
    return storage;
  } catch { return undefined; }
}
function safeSessionStorage() { try { return window.sessionStorage; } catch { return undefined; } }
function safeParse(raw, fallback) { if (!raw) return fallback; try { return JSON.parse(raw); } catch { return fallback; } }
function normalizedNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9._:-]{1,128}$/.test(namespace) ? namespace : '';
}
function browserAnonymousNamespace() {
  const session = safeSessionStorage();
  const key = `${STORAGE_PREFIX}.anonymous-namespace`;
  let value = normalizedNamespace(session?.getItem(key));
  if (!value) {
    value = `anonymous-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    session?.setItem(key, value);
  }
  return value;
}
const storageKey = (namespace, kind) => `${STORAGE_PREFIX}.${kind}.${namespace}`;

function createMessage(role, text, meta = {}) {
  const article = document.createElement('article');
  article.className = `chat-message chat-message-${role}`;
  article.dataset.role = role;
  if (meta.status) article.dataset.status = meta.status;
  if (meta.responseMode) article.dataset.responseMode = meta.responseMode;
  if (meta.correlationId) article.dataset.correlationId = meta.correlationId;
  const body = document.createElement('p');
  body.className = 'chat-message-body'; body.textContent = text;
  article.appendChild(body);
  if (meta.followUpRequired) {
    const note = document.createElement('span');
    note.className = 'chat-message-meta'; note.textContent = '추가 확인이 필요합니다.';
    article.appendChild(note);
  }
  return article;
}
function createLoadingMessage() {
  const article = createMessage('assistant', 'LOTBI가 답변을 준비하고 있습니다…');
  article.classList.add('chat-message-loading');
  article.dataset.transient = 'true'; article.setAttribute('role', 'status');
  return article;
}
function isGuestSessionError(error) {
  return error instanceof SiteCoreError
    && (error.code === 'GUEST_SESSION_INVALID' || error.code === 'GUEST_SESSION_EXPIRED');
}
function isSessionError(error) {
  return error instanceof SiteCoreError
    && !isGuestSessionError(error)
    && (error.status === 401 || error.status === 403 || error.code === 'SITE_SESSION_REQUIRED' || error.code === 'SESSION_INVALID' || error.code === 'SESSION_EXPIRED');
}
function userFacingErrorMessage(error) {
  if (isGuestSessionError(error)) return '익명 대화 세션이 만료되었습니다. 다시 시도하면 새 세션으로 이어집니다.';
  if (isSessionError(error)) return 'LOTBI 로그인이 필요합니다. 다시 연결한 뒤 이 메시지를 보낼 수 있습니다.';
  if (error instanceof SiteCoreError && error.code === 'GUEST_RATE_LIMITED') return '익명 대화 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof SiteCoreError && error.code === 'GUEST_AI_REQUEST_IN_PROGRESS') return '같은 질문을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof SiteCoreError && (error.code === 'GUEST_AI_OUTCOME_UNCERTAIN' || error.code === 'GUEST_AI_RECONCILIATION_REQUIRED')) return '이 요청은 중복 실행을 막기 위해 자동으로 다시 보내지 않습니다. 새 메시지로 다시 질문해 주세요.';
  if (error instanceof SiteCoreError && (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_RESPONSE_UNAVAILABLE')) return 'LOTBI AI 응답을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof Error) return error.message;
  return 'LOTBI 대화를 완료하지 못했습니다.';
}
function voiceErrorMessage(error) {
  const name = error && typeof error === 'object' && typeof error.name === 'string' ? error.name : '';
  const code = error && typeof error === 'object' && typeof error.error === 'string' ? error.error : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || code === 'not-allowed' || code === 'service-not-allowed') return '마이크 권한이 필요합니다. 브라우저의 사이트 권한에서 마이크를 허용해 주세요.';
  if (name === 'NotFoundError' || code === 'audio-capture') return '사용 가능한 마이크를 찾지 못했습니다. 기기 마이크 연결을 확인해 주세요.';
  if (code === 'no-speech') return '음성이 들리지 않았습니다. 마이크 버튼을 눌러 다시 말씀해 주세요.';
  return '음성 입력을 완료하지 못했습니다. 텍스트 입력은 계속 사용할 수 있습니다.';
}
function appendSafeErrorEvidence(wrapper, error) {
  if (!(error instanceof SiteCoreError)) return;
  if (error.code) wrapper.dataset.errorCode = error.code;
  if (error.status) wrapper.dataset.httpStatus = String(error.status);
  if (error.correlationId) wrapper.dataset.correlationId = error.correlationId;
  const evidence = [];
  if (error.code) evidence.push(`오류 코드 ${error.code}`);
  if (error.status) evidence.push(`HTTP ${error.status}`);
  if (error.correlationId) evidence.push(`확인 ID ${error.correlationId}`);
  if (!evidence.length) return;
  const meta = document.createElement('span');
  meta.className = 'chat-message-meta chat-error-evidence'; meta.textContent = evidence.join(' · ');
  wrapper.appendChild(meta);
}
function logSafeConversationFailure(error) {
  if (!(error instanceof SiteCoreError)) return;
  console.error('[LOTBI conversation request failed]', {code: error.code, status: error.status, retryable: error.retryable, correlationId: error.correlationId});
}

const PRODUCT_MERCHANT_HINTS = Object.freeze([
  ['COUPANG_CONSUMER', /(?:쿠팡|coupang)/iu],
  ['RAD_GODOMALL', /(?:알에이디|\\brad\\b|carcare\\s*rad|carcarerad)/iu],
  ['CAFE24_MCP', /(?:카페24|cafe24)/iu],
  ['SHOPIFY_STOREFRONT', /(?:쇼피파이|shopify)/iu],
]);

function productMerchantHint(text, intent = {}) {
  const source = String(text || '');
  const explicit = PRODUCT_MERCHANT_HINTS.find(([, pattern]) => pattern.test(source));
  if (explicit) return {merchantCode: explicit[0], merchantExplicit: true};
  const intentMerchant = typeof intent.merchant_code === 'string' ? intent.merchant_code : '';
  if (intent.merchant_explicit === true && intentMerchant) {
    return {merchantCode: intentMerchant, merchantExplicit: true};
  }
  return {merchantCode: intentMerchant, merchantExplicit: false};
}


function compactRichProductMeta(value) {
  if (!value || typeof value !== 'object') return null;
  const resolutionId = typeof value.resolutionId === 'string' ? value.resolutionId.slice(0, 80) : '';
  const resolutionHash = typeof value.resolutionHash === 'string' && /^[0-9a-f]{64}$/.test(value.resolutionHash) ? value.resolutionHash : '';
  const displayId = typeof value.displayId === 'string' && /^pdc_[0-9a-f]{24}$/.test(value.displayId) ? value.displayId : '';
  const cards = Array.isArray(value.cards) ? value.cards.slice(0, 6).filter(card => card && typeof card.title === 'string').map(card => ({
    candidate_index: Number.isInteger(card.candidate_index) ? card.candidate_index : 0,
    merchant_code: typeof card.merchant_code === 'string' ? card.merchant_code.slice(0, 60) : '',
    source: typeof card.source === 'string' ? card.source.slice(0, 80) : '',
    title: card.title.slice(0, 255),
    price: Number.isInteger(card.price) ? card.price : null,
    currency: typeof card.currency === 'string' ? card.currency.slice(0, 8) : 'KRW',
    available: card.available === true,
    brand: typeof card.brand === 'string' ? card.brand.slice(0, 80) : '',
    product_url: typeof card.product_url === 'string' && card.product_url.startsWith('https://') ? card.product_url.slice(0, 2048) : '',
    image_url: typeof card.image_url === 'string' && card.image_url.startsWith('https://') ? card.image_url.slice(0, 2048) : '',
    shipping_eta_days: Number.isInteger(card.shipping_eta_days) ? card.shipping_eta_days : null,
    rating: typeof card.rating === 'number' && Number.isFinite(card.rating) ? card.rating : null,
    review_count: Number.isInteger(card.review_count) ? card.review_count : null,
    shipping_fee: Number.isInteger(card.shipping_fee) ? card.shipping_fee : null,
    shipping_fee_basis: typeof card.shipping_fee_basis === 'string' ? card.shipping_fee_basis.slice(0, 80) : '',
    recommendation_reasons: Array.isArray(card.recommendation_reasons) ? card.recommendation_reasons.filter(reason => typeof reason === 'string').slice(0, 3) : [],
  })) : [];
  const resolutionBound = Boolean(resolutionId && resolutionHash);
  if ((!resolutionBound && !displayId) || !cards.length) return null;
  return {
    resolutionId,
    resolutionHash,
    displayId,
    query: typeof value.query === 'string' ? value.query.slice(0, 500) : '',
    originalText: typeof value.originalText === 'string' ? value.originalText.slice(0, 1000) : '',
    merchant: value.merchant && typeof value.merchant === 'object' ? {
      code: typeof value.merchant.code === 'string' ? value.merchant.code.slice(0, 60) : '',
      name: typeof value.merchant.name === 'string' ? value.merchant.name.slice(0, 120) : '',
    } : {},
    sourceMode: typeof value.sourceMode === 'string' ? value.sourceMode.slice(0, 80) : '',
    expired: value.expired === true,
    cards,
  };
}

function formatCardMoney(amount, currency = 'KRW') {
  if (!Number.isInteger(amount)) return '가격 확인 필요';
  if (currency === 'KRW') return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  return new Intl.NumberFormat('ko-KR', {style: 'currency', currency}).format(amount);
}

function titleFromMessage(text) {
  const value = text.replace(/\s+/gu, ' ').trim();
  return value.length <= 36 ? value : `${value.slice(0, 35).trimEnd()}…`;
}
function newId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`; }
function initials(name) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return 'L';
  return words.slice(0, 2).map(word => [...word][0]).join('').toUpperCase();
}
function focusableNodes(root) {
  return [...root.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(node => node instanceof HTMLElement && !node.hidden);
}
function trapFocus(container, event) {
  if (event.key !== 'Tab') return;
  const nodes = focusableNodes(container);
  if (!nodes.length) return;
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function mountConversation({sessionToken: initialSessionToken, initialText = '', autoSend = false, identityKey = ''} = {}) {
  ensureConversationStyles();
  const prompt = document.getElementById('lotbi-prompt');
  const sendButton = document.querySelector('.send-button');
  const micButton = document.querySelector('.mic-button');
  const responseGradeControl = document.querySelector('[data-response-grade-control]');
  const responseGradeTrigger = document.querySelector('[data-response-grade-trigger]');
  const responseGradeMenu = document.querySelector('[data-response-grade-menu]');
  const responseGradeOptions = responseGradeMenu ? [...responseGradeMenu.querySelectorAll('[data-response-grade]')] : [];
  const thread = document.getElementById('conversation-thread');
  const statusRegion = document.getElementById('chat-status');
  const stateRegion = document.getElementById('chat-state-region');
  const homeAvatarAnchor = document.querySelector('[data-home-avatar-anchor]');
  const avatar = document.querySelector('[data-lotbi-avatar-container]');
  if (!(prompt instanceof HTMLTextAreaElement) || !(sendButton instanceof HTMLButtonElement) || !(micButton instanceof HTMLButtonElement)
    || !(responseGradeControl instanceof HTMLElement) || !(responseGradeTrigger instanceof HTMLButtonElement)
    || !(responseGradeMenu instanceof HTMLElement) || responseGradeOptions.length !== RESPONSE_GRADE_OPTIONS.length
    || !(thread instanceof HTMLElement) || !(homeAvatarAnchor instanceof HTMLElement) || !(avatar instanceof HTMLElement)) return false;
  if (sendButton.dataset.conversationMounted === 'true') return true;
  sendButton.dataset.conversationMounted = 'true';

  const storage = safeStorage();
  let sessionToken = typeof initialSessionToken === 'string' && initialSessionToken.trim() ? initialSessionToken.trim() : undefined;
  let namespace = normalizedNamespace(identityKey);
  let state = {threads: [], activeThreadId: null, draft: ''};
  let preferences = {color: 'default', theme: 'system', displayName: '', photo: '', responseGrade: DEFAULT_RESPONSE_GRADE};
  let serverIdentity, serverSubscription;
  let stateReady = false, inFlight = false, voiceRequesting = false, voiceListening = false, voiceRecognition;
  let richCardActionInFlight = false;
  let guestSessionToken, guestSessionExpiresAt = 0;
  let avatarSequence = 0, voiceAvatarRequestId;
  const nextAvatarRequestId = kind => `site-${kind}-${Date.now()}-${++avatarSequence}`;
  const driveAvatar = (phase, requestId) => window.dispatchEvent(new CustomEvent('lotbi-avatar-lifecycle', {
    detail: Object.freeze({phase, requestId}),
  }));
  let openSurface, openSurfaceTrigger, surfaceRestoreFocus;

  const setStatus = message => { if (statusRegion) statusRegion.textContent = message; };
  const threadRecord = () => state.threads.find(item => item.id === state.activeThreadId);
  const guestSessionStorageKey = () => {
    const owner = normalizedNamespace(namespace) || browserAnonymousNamespace();
    return storageKey(owner, 'guest-session');
  };
  const clearGuestSession = () => {
    guestSessionToken = undefined;
    guestSessionExpiresAt = 0;
    try { safeSessionStorage()?.removeItem(guestSessionStorageKey()); } catch {}
  };
  const readGuestSession = () => {
    if (guestSessionToken && guestSessionExpiresAt > Date.now() + 5000) return guestSessionToken;
    const stored = safeParse(safeSessionStorage()?.getItem(guestSessionStorageKey()), {});
    const token = typeof stored.guestToken === 'string' ? stored.guestToken.trim() : '';
    const expiresAt = typeof stored.expiresAt === 'string' ? Date.parse(stored.expiresAt) : NaN;
    if (token.length >= 32 && token.length <= 256 && Number.isFinite(expiresAt) && expiresAt > Date.now() + 5000) {
      guestSessionToken = token; guestSessionExpiresAt = expiresAt; return token;
    }
    clearGuestSession();
    return undefined;
  };
  const ensureGuestSession = async () => {
    const current = readGuestSession();
    if (current) return current;
    const issued = await createGuestConversationSession();
    guestSessionToken = issued.guestToken;
    guestSessionExpiresAt = Date.parse(issued.expiresAt);
    try {
      safeSessionStorage()?.setItem(guestSessionStorageKey(), JSON.stringify({
        guestToken: issued.guestToken,
        expiresAt: issued.expiresAt,
      }));
    } catch {}
    return issued.guestToken;
  };
  const guestRecentContext = () => {
    const messages = threadRecord()?.messages;
    if (!Array.isArray(messages) || !messages.length) return [];
    return messages.slice(0, -1).filter(item =>
      item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string' && item.text.trim()
    ).slice(-6).map(item => ({role: item.role, text: item.text.trim().slice(0, 500)}));
  };
  const saveState = () => { if (storage && namespace && stateReady) storage.setItem(storageKey(namespace, 'threads'), JSON.stringify(state)); };
  const savePreferences = () => { if (storage && namespace && stateReady) storage.setItem(storageKey(namespace, 'preferences'), JSON.stringify(preferences)); };
  const responseGradeLabel = grade => RESPONSE_GRADE_OPTIONS.find(([key]) => key === grade)?.[1] || '스탠다드';
  const responseGradeAvailable = () => RESPONSE_GRADE_BACKEND_ENABLED && Boolean(sessionToken);
  const syncResponseGradeUi = () => {
    const available = responseGradeAvailable();
    const grade = available && RESPONSE_GRADE_OPTIONS.some(([key]) => key === preferences.responseGrade)
      ? preferences.responseGrade
      : DEFAULT_RESPONSE_GRADE;
    preferences.responseGrade = grade;
    responseGradeControl.hidden = !available;
    responseGradeControl.setAttribute('aria-hidden', String(!available));
    if (available) responseGradeControl.removeAttribute('inert');
    else responseGradeControl.setAttribute('inert', '');
    responseGradeTrigger.disabled = !available;
    for (const option of responseGradeOptions) {
      if (option instanceof HTMLButtonElement) option.disabled = !available;
    }
    if (!available) {
      responseGradeMenu.hidden = true;
      responseGradeTrigger.setAttribute('aria-expanded', 'false');
    }
    const label = responseGradeLabel(grade);
    const labelNode = responseGradeTrigger.querySelector('[data-response-grade-label]');
    if (labelNode) labelNode.textContent = label;
    responseGradeTrigger.setAttribute('aria-label', `응답 등급: ${label}`);
    for (const option of responseGradeOptions) {
      const selected = option.dataset.responseGrade === grade;
      option.setAttribute('aria-checked', String(selected));
      option.tabIndex = available && selected ? 0 : -1;
    }
  };
  const applyPreferences = () => {
    document.body.dataset.chatColor = COLOR_OPTIONS.some(([key]) => key === preferences.color) ? preferences.color : 'default';
    document.body.dataset.siteTheme = ['system', 'light', 'dark'].includes(preferences.theme) ? preferences.theme : 'system';
    syncResponseGradeUi();
    document.body.dataset.responseGrade = preferences.responseGrade;
  };
  const restoreAvatarHome = () => { if (avatar.parentElement !== homeAvatarAnchor) homeAvatarAnchor.appendChild(avatar); };
  const showThread = () => { thread.hidden = false; document.body.classList.add('conversation-active'); };
  const showBlankHome = () => {
    restoreAvatarHome(); thread.replaceChildren(); thread.hidden = true; document.body.classList.remove('conversation-active');
  };
  const isThreadNearBottom = () => (
    thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 72
  );
  const scrollThread = () => { thread.scrollTop = thread.scrollHeight; };
  const appendNode = (node, {forceScroll = false, suppressScroll = false} = {}) => {
    const shouldStick = forceScroll || (!suppressScroll && isThreadNearBottom());
    showThread();
    if (node instanceof HTMLElement && node.dataset.role === 'assistant') {
      const row = document.createElement('div'); row.className = 'chat-assistant-row';
      const slot = document.createElement('div'); slot.className = 'assistant-avatar-slot'; slot.setAttribute('aria-hidden', 'true');
      slot.appendChild(avatar); row.append(slot, node); thread.appendChild(row);
    } else thread.appendChild(node);
    if (!suppressScroll && shouldStick) scrollThread();
    return node;
  };
  const renderRecent = () => {
    for (const list of document.querySelectorAll('[data-recent-conversations]')) {
      if (!(list instanceof HTMLElement)) continue;
      const fragment = document.createDocumentFragment();
      for (const item of state.threads) {
        const li = document.createElement('li'); const button = document.createElement('button');
        button.type = 'button'; button.dataset.conversationTitle = ''; button.dataset.threadId = item.id;
        button.textContent = item.title; button.title = item.title; button.setAttribute('aria-label', `${item.title} 대화 열기`);
        if (item.id === state.activeThreadId) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => activateThread(item.id)); li.appendChild(button); fragment.appendChild(li);
      }
      list.replaceChildren(fragment);
    }
  };
  const appendPersistedMessage = message => {
    const record = threadRecord(); if (!record) return;
    record.messages.push(message); record.messages = record.messages.slice(-MESSAGE_LIMIT); record.updatedAt = Date.now();
    state.threads.sort((a, b) => b.updatedAt - a.updatedAt); saveState(); renderRecent();
  };
  const lotbiBoxKey = () => storageKey(namespace || browserAnonymousNamespace(), 'lotbi-box');
  const loadLotbiBox = () => {
    const parsed = safeParse(storage?.getItem(lotbiBoxKey()), []);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.key === 'string').slice(0, 100) : [];
  };
  const saveLotbiBox = items => {
    if (storage) storage.setItem(lotbiBoxKey(), JSON.stringify(items.slice(0, 100)));
  };
  const lotbiBoxItemKey = (rich, card) => [rich.resolutionId || rich.displayId, card.candidate_index, card.merchant_code || ''].join(':');
  const isInLotbiBox = (rich, card) => loadLotbiBox().some(item => item.key === lotbiBoxItemKey(rich, card));
  const toggleLotbiBox = (rich, card) => {
    const key = lotbiBoxItemKey(rich, card);
    const items = loadLotbiBox();
    const existing = items.findIndex(item => item.key === key);
    if (existing >= 0) {
      items.splice(existing, 1);
      saveLotbiBox(items);
      return false;
    }
    items.unshift({
      key,
      type: 'PRODUCT',
      source: rich.merchant?.code || card.merchant_code || card.source || '',
      external_reference: card.product_url || '',
      display_title: card.title,
      image_reference: card.image_url || '',
      display_price_snapshot: Number.isInteger(card.price) ? {amount: card.price, currency: card.currency || 'KRW'} : null,
      source_url: card.product_url || '',
      resolution_id: rich.resolutionId || '',
      resolution_hash: rich.resolutionHash || '',
      display_id: rich.displayId || '',
      candidate_index: card.candidate_index,
      created_at: new Date().toISOString(),
    });
    saveLotbiBox(items);
    return true;
  };
  const sourceLabel = (rich, card) => rich.merchant?.name || rich.merchant?.code || card.merchant_code || card.source || '판매처';
  const createProductCardRail = richValue => {
    const rich = compactRichProductMeta(richValue);
    if (!rich) return null;
    const rail = document.createElement('section');
    rail.className = 'lotbi-rich-card-rail';
    rail.dataset.richCardType = 'PRODUCT';
    rail.setAttribute('aria-label', '상품 검색 결과');
    for (const card of rich.cards) {
      const item = document.createElement('article');
      item.className = 'lotbi-rich-card lotbi-rich-card-product';
      item.dataset.candidateIndex = String(card.candidate_index);
      const media = document.createElement('div');
      media.className = 'lotbi-rich-card-media';
      if (card.image_url) {
        const image = document.createElement('img');
        image.className = 'lotbi-rich-card-image';
        image.src = card.image_url;
        image.alt = card.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => {
          image.remove(); media.classList.add('lotbi-rich-card-placeholder'); media.textContent = '이미지 없음';
        }, {once: true});
        media.appendChild(image);
      } else {
        media.classList.add('lotbi-rich-card-placeholder'); media.textContent = '이미지 없음';
      }
      const copy = document.createElement('div'); copy.className = 'lotbi-rich-card-copy';
      const source = document.createElement('span'); source.className = 'lotbi-rich-card-source'; source.textContent = sourceLabel(rich, card);
      const title = document.createElement('h3'); title.className = 'lotbi-rich-card-title'; title.textContent = card.title;
      const price = document.createElement('strong'); price.className = 'lotbi-rich-card-price'; price.textContent = formatCardMoney(card.price, card.currency);
      copy.append(source, title, price);
      const evidence = document.createElement('div'); evidence.className = 'lotbi-rich-card-evidence';
      if (typeof card.rating === 'number') {
        const rating = document.createElement('span');
        rating.textContent = '★ ' + card.rating.toFixed(1) + (Number.isInteger(card.review_count) ? ' · 리뷰 ' + new Intl.NumberFormat('ko-KR').format(card.review_count) : '');
        evidence.appendChild(rating);
      }
      if (Number.isInteger(card.shipping_eta_days)) {
        const eta = document.createElement('span'); eta.textContent = '배송 예상 ' + card.shipping_eta_days + '일'; evidence.appendChild(eta);
      }
      if (Number.isInteger(card.shipping_fee)) {
        const fee = document.createElement('span'); fee.textContent = card.shipping_fee === 0 ? '배송비 무료' : '배송비 ' + formatCardMoney(card.shipping_fee, card.currency); evidence.appendChild(fee);
      }
      if (!evidence.childElementCount) {
        const note = document.createElement('span'); note.textContent = '판매처에서 상세 정보 확인'; evidence.appendChild(note);
      }
      copy.appendChild(evidence);
      const actions = document.createElement('div'); actions.className = 'lotbi-rich-card-actions';
      if (card.product_url) {
        const detail = document.createElement('a'); detail.className = 'lotbi-rich-card-action'; detail.href = card.product_url;
        detail.target = '_blank'; detail.rel = 'noopener noreferrer'; detail.referrerPolicy = 'no-referrer'; detail.textContent = '상세보기'; actions.appendChild(detail);
      } else {
        const detail = document.createElement('button'); detail.type = 'button'; detail.className = 'lotbi-rich-card-action'; detail.disabled = true;
        detail.textContent = '상세보기'; detail.title = '공식 상세 링크를 확인할 수 없습니다.'; actions.appendChild(detail);
      }
      const box = document.createElement('button'); box.type = 'button'; box.className = 'lotbi-rich-card-action';
      const syncBoxLabel = () => { box.textContent = isInLotbiBox(rich, card) ? '✓ 롯비함' : '+ 롯비함'; };
      syncBoxLabel();
      box.addEventListener('click', () => { const added = toggleLotbiBox(rich, card); syncBoxLabel(); setStatus(added ? '롯비함에 담았습니다.' : '롯비함에서 뺐습니다.'); });
      actions.appendChild(box);
      const buy = document.createElement('button'); buy.type = 'button'; buy.className = 'lotbi-rich-card-action lotbi-rich-card-action-primary'; buy.textContent = '구매하기';
      buy.disabled = rich.expired || card.available === false;
      if (rich.expired) buy.title = '검색 결과가 만료되어 다시 검색해야 합니다.';
      else if (card.available === false) buy.title = '현재 판매 가능 상태가 아닙니다.';
      buy.addEventListener('click', async () => {
        if (richCardActionInFlight) return;
        if (!sessionToken) {
          richCardActionInFlight = true; buy.disabled = true; buy.textContent = '로그인 연결…';
          try {
            await beginSiteHandoff(rich.originalText || rich.query || card.title);
          } catch (error) {
            buy.disabled = false; buy.textContent = '구매하기'; setStatus(userFacingErrorMessage(error));
          } finally { richCardActionInFlight = false; }
          return;
        }
        if (!rich.resolutionId || !rich.resolutionHash) {
          setStatus('구매 전 상품을 다시 검색해 최신 판매처 정보를 확인해야 합니다.');
          return;
        }
        richCardActionInFlight = true; buy.disabled = true; buy.textContent = '확인 중…';
        try {
          const review = await reviewProductCard(sessionToken, {resolutionId: rich.resolutionId, resolutionHash: rich.resolutionHash, candidateIndex: card.candidate_index});
          const currentPrice = formatCardMoney(review.card.price, review.card.currency);
          const reviewText = review.priceChanged
            ? '판매처의 현재 가격이 바뀌어 ' + currentPrice + '으로 다시 확인했습니다. 아직 주문·결제는 실행하지 않았습니다.'
            : '판매처에서 현재 가격 ' + currentPrice + '과 상품 상태를 다시 확인했습니다. 아직 주문·결제는 실행하지 않았습니다.';
          const meta = {status: 'PURCHASE_REVIEW_REQUIRED', responseMode: 'RICH_PRODUCT_REVIEW'};
          appendNode(createMessage('assistant', reviewText, meta)); appendPersistedMessage({role: 'assistant', text: reviewText, meta});
          buy.textContent = '구매 검토됨'; setStatus('구매 전 최신 상품 정보를 확인했습니다. 결제는 실행하지 않았습니다.');
        } catch (error) {
          buy.textContent = '다시 확인'; buy.disabled = false; setStatus(userFacingErrorMessage(error));
        } finally { richCardActionInFlight = false; }
      });
      actions.appendChild(buy);
      item.append(media, copy, actions); rail.appendChild(item);
    }
    return rail;
  };
  const messageNode = message => {
    const node = createMessage(message.role, message.text, message.meta || {});
    const rich = compactRichProductMeta(message.meta?.richProduct);
    if (message.role === 'assistant' && rich) {
      const rail = createProductCardRail(rich); if (rail) node.appendChild(rail);
    }
    return node;
  };
  const renderActiveThread = () => {
    restoreAvatarHome(); thread.replaceChildren();
    const record = threadRecord();
    if (!record || !record.messages.length) { showBlankHome(); return; }
    showThread();
    for (const message of record.messages) {
      appendNode(messageNode(message), {suppressScroll: true});
    }
    scrollThread();
  };
  const closeMobileDrawer = () => {
    const close = document.querySelector('[data-mobile-nav-close]');
    if (document.body.classList.contains('nav-drawer-open') && close instanceof HTMLButtonElement) close.click();
  };
  const activateThread = id => {
    if (!state.threads.some(item => item.id === id)) return;
    state.activeThreadId = id; saveState(); renderActiveThread(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const startNewConversation = () => {
    state.activeThreadId = null; state.draft = ''; prompt.value = '';
    prompt.dispatchEvent(new Event('input', {bubbles: true})); saveState(); showBlankHome(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const ensureThread = firstMessage => {
    let record = threadRecord(); if (record) return record;
    record = {id: newId('thread'), title: titleFromMessage(firstMessage), createdAt: Date.now(), updatedAt: Date.now(), messages: []};
    state.activeThreadId = record.id; state.threads.unshift(record); state.threads = state.threads.slice(0, THREAD_LIMIT);
    saveState(); renderRecent(); return record;
  };
  const validThread = value => value && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.messages);
  const switchNamespace = nextNamespace => {
    const normalized = normalizedNamespace(nextNamespace);
    if (!normalized || (normalized === namespace && stateReady)) return;
    namespace = normalized;
    const loadedState = safeParse(storage?.getItem(storageKey(namespace, 'threads')), {});
    const loadedPreferences = safeParse(storage?.getItem(storageKey(namespace, 'preferences')), {});
    state = {
      threads: Array.isArray(loadedState.threads) ? loadedState.threads.filter(validThread).slice(0, THREAD_LIMIT) : [],
      activeThreadId: typeof loadedState.activeThreadId === 'string' ? loadedState.activeThreadId : null,
      draft: typeof loadedState.draft === 'string' ? loadedState.draft.slice(0, 1000) : '',
    };
    if (!state.threads.some(item => item.id === state.activeThreadId)) state.activeThreadId = state.threads[0]?.id || null;
    preferences = {
      color: COLOR_OPTIONS.some(([key]) => key === loadedPreferences.color) ? loadedPreferences.color : 'default',
      theme: ['system', 'light', 'dark'].includes(loadedPreferences.theme) ? loadedPreferences.theme : 'system',
      displayName: typeof loadedPreferences.displayName === 'string' ? loadedPreferences.displayName.slice(0, 40) : '',
      photo: typeof loadedPreferences.photo === 'string' && loadedPreferences.photo.startsWith('data:image/') ? loadedPreferences.photo : '',
      responseGrade: RESPONSE_GRADE_OPTIONS.some(([key]) => key === loadedPreferences.responseGrade) ? loadedPreferences.responseGrade : DEFAULT_RESPONSE_GRADE,
    };
    stateReady = true; prompt.value = state.draft; prompt.dispatchEvent(new Event('input', {bubbles: true}));
    applyPreferences(); renderActiveThread(); renderRecent();
    document.body.dataset.conversationRestore = 'ready';
    refreshAuthenticatedProfileSlots();
  };
  const profileVisual = () => {
    const visual = document.createElement(preferences.photo ? 'img' : 'span');
    visual.className = 'sidebar-profile-avatar';
    if (visual instanceof HTMLImageElement) { visual.src = preferences.photo; visual.alt = ''; }
    else { visual.textContent = initials(serverIdentity?.name || preferences.displayName || 'LOTBI'); visual.setAttribute('aria-hidden', 'true'); }
    return visual;
  };
  const profileButton = () => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sidebar-account-entry sidebar-profile-trigger';
    button.dataset.profileMenuTrigger = ''; button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '프로필 메뉴 열기');
    const copy = document.createElement('span'); copy.className = 'sidebar-profile-copy';
    const name = document.createElement('span'); name.className = 'sidebar-account-name'; name.textContent = serverIdentity?.name || preferences.displayName || '로그인된 사용자';
    const handle = document.createElement('span'); handle.className = 'sidebar-account-handle'; handle.textContent = serverIdentity?.accountHandle ? `@${serverIdentity.accountHandle}` : '프로필 메뉴';
    copy.append(name, handle); button.append(profileVisual(), copy); return button;
  };
  const profileSummary = () => {
    const summary = document.createElement('div'); summary.className = 'profile-popover-summary'; summary.setAttribute('role', 'presentation');
    const copy = document.createElement('div'); copy.className = 'profile-popover-summary-copy';
    const name = document.createElement('strong'); name.className = 'profile-popover-summary-name'; name.textContent = serverIdentity?.name || preferences.displayName || '로그인된 사용자';
    copy.appendChild(name);
    if (serverIdentity?.accountHandle) {
      const handle = document.createElement('span'); handle.className = 'profile-popover-summary-handle'; handle.textContent = `@${serverIdentity.accountHandle}`; copy.appendChild(handle);
    }
    if (serverSubscription?.plan) {
      const planLabels = {FREE: 'LOTBI Free', LOTBI_PLUS: 'LOTBI Plus'};
      const planName = planLabels[serverSubscription.plan] || serverSubscription.plan;
      const plan = document.createElement('span'); plan.className = 'profile-popover-summary-plan'; plan.textContent = `현재 이용 등급 · ${planName}`; copy.appendChild(plan);
    }
    summary.append(profileVisual(), copy); return summary;
  };
  const refreshAuthenticatedProfileSlots = () => {
    if (document.body.dataset.siteAuthState !== 'authenticated' && !sessionToken) return;
    for (const slot of document.querySelectorAll('[data-sidebar-account]')) {
      if (!(slot instanceof HTMLElement)) continue;
      const existingTrigger = slot.querySelector('[data-profile-menu-trigger]');
      const button = profileButton();
      if (openSurface?.classList?.contains('profile-popover-layer') && openSurfaceTrigger === existingTrigger) {
        button.setAttribute('aria-expanded', 'true');
        openSurfaceTrigger = button;
        if (surfaceRestoreFocus === existingTrigger) surfaceRestoreFocus = button;
      }
      slot.replaceChildren(button); slot.dataset.authState = 'authenticated'; slot.removeAttribute('aria-busy');
    }
    const openSummary = openSurface?.querySelector?.('.profile-popover-summary');
    if (openSummary instanceof HTMLElement) openSummary.replaceWith(profileSummary());
  };
  const loadServerProfile = async () => {
    if (!sessionToken) return;
    try {
      const identity = await getCurrentSiteUser(sessionToken);
      if (namespace && identity.installationId !== namespace) throw new SiteCoreError('Site 사용자 namespace가 일치하지 않습니다.', {code: 'SITE_IDENTITY_NAMESPACE_MISMATCH'});
      serverIdentity = identity; refreshAuthenticatedProfileSlots();
    } catch (error) {
      if (isSessionError(error)) sessionToken = undefined;
      return;
    }
    try {
      serverSubscription = await getCurrentSubscription(sessionToken);
      refreshAuthenticatedProfileSlots();
    } catch {
      serverSubscription = undefined;
    }
  };

  const closeSurface = () => {
    if (!openSurface) return;
    for (const trigger of document.querySelectorAll('[data-profile-menu-trigger]')) trigger.setAttribute('aria-expanded', 'false');
    openSurface.remove(); openSurface = undefined; openSurfaceTrigger = undefined; document.body.classList.remove('site-overlay-open');
    if (surfaceRestoreFocus instanceof HTMLElement && surfaceRestoreFocus.isConnected) surfaceRestoreFocus.focus();
    surfaceRestoreFocus = undefined;
  };
  const installSurfaceBehavior = (surface, panel, {modal = false, trigger} = {}) => {
    closeSurface(); openSurface = surface; openSurfaceTrigger = trigger; surfaceRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    document.body.appendChild(surface); document.body.classList.add('site-overlay-open');
    surface.addEventListener('click', event => { if (event.target === surface) closeSurface(); });
    surface.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeSurface(); } else trapFocus(panel, event);
    });
    if (modal) panel.setAttribute('aria-modal', 'true');
    queueMicrotask(() => focusableNodes(panel)[0]?.focus());
  };
  const modalShell = (title, description = '') => {
    const backdrop = document.createElement('div'); backdrop.className = 'site-modal-backdrop';
    const panel = document.createElement('section'); panel.className = 'site-modal'; panel.setAttribute('role', 'dialog');
    const titleId = newId('site-modal-title'); panel.setAttribute('aria-labelledby', titleId);
    const header = document.createElement('header'); header.className = 'site-modal-header';
    const heading = document.createElement('h2'); heading.id = titleId; heading.textContent = title;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'site-modal-close'; close.setAttribute('aria-label', `${title} 닫기`); close.textContent = '×'; close.addEventListener('click', closeSurface);
    header.append(heading, close); panel.appendChild(header);
    if (description) { const copy = document.createElement('p'); copy.className = 'site-modal-description'; copy.textContent = description; panel.appendChild(copy); }
    const content = document.createElement('div'); content.className = 'site-modal-content'; panel.appendChild(content); backdrop.appendChild(panel);
    return {backdrop, panel, content};
  };
  const colorPicker = () => {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'color-picker';
    const legend = document.createElement('legend'); legend.textContent = '대화 색상'; fieldset.appendChild(legend);
    for (const [key, label] of COLOR_OPTIONS) {
      const option = document.createElement('button'); option.type = 'button'; option.className = 'color-option'; option.dataset.color = key;
      option.setAttribute('aria-pressed', String(preferences.color === key));
      const swatch = document.createElement('span'); swatch.className = 'color-swatch'; swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = label; option.append(swatch, text);
      option.addEventListener('click', () => {
        preferences.color = key; applyPreferences(); savePreferences();
        for (const node of fieldset.querySelectorAll('.color-option')) node.setAttribute('aria-pressed', String(node === option));
      });
      fieldset.appendChild(option);
    }
    return fieldset;
  };
  const readProfilePhoto = file => new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('JPEG, PNG, WebP 이미지만 선택할 수 있습니다.'));
    if (file.size > PHOTO_BYTES_LIMIT) return reject(new Error('프로필 이미지는 2MB 이하여야 합니다.'));
    const objectUrl = URL.createObjectURL(file); const image = new Image();
    image.onload = () => {
      try {
        if (image.naturalWidth > PHOTO_DIMENSION_LIMIT || image.naturalHeight > PHOTO_DIMENSION_LIMIT) throw new Error('이미지 크기는 가로·세로 4096px 이하여야 합니다.');
        const size = Math.min(image.naturalWidth, image.naturalHeight); const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256; const context = canvas.getContext('2d', {alpha: false});
        if (!context) throw new Error('프로필 이미지를 처리하지 못했습니다.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
        resolve(canvas.toDataURL('image/webp', .86));
      } catch (error) { reject(error); } finally { URL.revokeObjectURL(objectUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 파일을 읽지 못했습니다.')); };
    image.src = objectUrl;
  });
  const openProfile = () => {
    const {backdrop, panel, content} = modalShell('프로필', '계정 이름과 handle은 Core /v2/me에서 읽고, 사진과 로컬 표시 이름은 이 브라우저에만 저장됩니다.');
    const preview = document.createElement('div'); preview.className = 'profile-photo-preview'; preview.textContent = initials(preferences.displayName || 'LOTBI');
    if (preferences.photo) preview.style.backgroundImage = `url(${preferences.photo})`;
    const photoLabel = document.createElement('label'); photoLabel.className = 'site-button site-button-secondary'; photoLabel.textContent = '사진 선택';
    const photo = document.createElement('input'); photo.type = 'file'; photo.accept = 'image/jpeg,image/png,image/webp'; photo.className = 'sr-only'; photoLabel.appendChild(photo);
    const error = document.createElement('p'); error.className = 'site-field-error'; error.setAttribute('role', 'alert');
    const nameLabel = document.createElement('label'); nameLabel.className = 'site-field'; nameLabel.textContent = '표시 이름';
    const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40; name.value = preferences.displayName; name.autocomplete = 'off'; nameLabel.appendChild(name);
    const handle = document.createElement('div'); handle.className = 'site-readonly-field';
    const handleTitle = document.createElement('strong'); handleTitle.textContent = '@handle';
    const handleValue = document.createElement('span'); handleValue.textContent = serverIdentity?.accountHandle ? `@${serverIdentity.accountHandle}` : '등록된 handle 없음'; handle.append(handleTitle, handleValue);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'site-button site-button-primary'; save.textContent = '저장';
    photo.addEventListener('change', async () => {
      const file = photo.files?.[0]; if (!file) return; error.textContent = '';
      try { preferences.photo = await readProfilePhoto(file); preview.style.backgroundImage = `url(${preferences.photo})`; }
      catch (caught) { error.textContent = caught instanceof Error ? caught.message : '이미지를 처리하지 못했습니다.'; }
    });
    save.addEventListener('click', () => {
      preferences.displayName = name.value.trim().slice(0, 40); savePreferences(); refreshAuthenticatedProfileSlots(); closeSurface();
    });
    content.append(preview, photoLabel, error, nameLabel, handle, save); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openPersonalization = () => {
    const {backdrop, panel, content} = modalShell('개인 맞춤 설정', '선택한 대화 색상은 현재 사용자 설치의 이 브라우저에 저장됩니다.');
    content.appendChild(colorPicker()); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openSettings = () => {
    const {backdrop, panel, content} = modalShell('설정');
    const themeLabel = document.createElement('label'); themeLabel.className = 'site-field'; themeLabel.textContent = '테마';
    const select = document.createElement('select');
    for (const [value, label] of [['system', '기기 설정'], ['light', '라이트'], ['dark', '다크']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = preferences.theme === value; select.appendChild(option);
    }
    select.addEventListener('change', () => { preferences.theme = select.value; applyPreferences(); savePreferences(); });
    themeLabel.appendChild(select); content.append(themeLabel, colorPicker()); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openCalendar = async view => {
    const allowed = new Set(['all', 'today', 'upcoming', 'attention', 'date']);
    const initialView = allowed.has(view) ? view : 'all';
    closeMobileDrawer();

    if (!sessionToken) {
      try {
        await beginSiteHandoff();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '캘린더를 열기 위한 로그인 연결을 시작하지 못했습니다.');
      }
      return;
    }

    const {backdrop, panel, content} = modalShell(
      '캘린더',
      'LOTBI에 등록된 개인 일정을 확인하고 관리합니다.',
    );
    panel.classList.add('site-calendar-modal');
    installSurfaceBehavior(backdrop, panel, {modal: true});
    const mounted = await mountLifeCalendarManager({
      sessionToken,
      root: content,
      initialView,
    });
    if (!mounted) {
      const message = document.createElement('p');
      message.className = 'life-calendar-error';
      message.textContent = '캘린더를 열지 못했습니다.';
      content.replaceChildren(message);
    }
  };

  const openHelp = () => {
    const {backdrop, panel, content} = modalShell('도움말'); const links = document.createElement('nav');
    links.className = 'help-links'; links.setAttribute('aria-label', '도움말 링크');
    for (const [href, label] of [['/contact.html', '도움말 센터 및 버그 신고'], ['/terms.html', '이용약관'], ['/privacy.html', '개인정보처리방침']]) {
      const link = document.createElement('a'); link.href = href; link.textContent = label; links.appendChild(link);
    }
    content.appendChild(links); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openProfileMenu = trigger => {
    if (openSurface && openSurfaceTrigger === trigger) { closeSurface(); return; }
    const layer = document.createElement('div'); layer.className = 'profile-popover-layer';
    const menu = document.createElement('div'); menu.className = 'profile-popover'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '프로필 메뉴');
    menu.appendChild(profileSummary());
    for (const [label, action] of [['프로필', openProfile], ['개인 맞춤 설정', openPersonalization], ['설정', openSettings], ['도움말', openHelp]]) {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.textContent = label;
      button.addEventListener('click', () => { closeSurface(); action(); }); menu.appendChild(button);
    }
    const logout = document.createElement('button'); logout.type = 'button'; logout.setAttribute('role', 'menuitem');
    logout.className = 'profile-menu-logout'; logout.textContent = '로그아웃'; logout.disabled = !sessionToken;
    if (!sessionToken) logout.title = 'Site child session 연결 후 사용할 수 있습니다.';
    logout.addEventListener('click', async () => {
      if (!sessionToken) return;
      logout.disabled = true; logout.textContent = '로그아웃 중…';
      try {
        await logoutSiteSession(sessionToken); sessionToken = undefined; serverIdentity = undefined; serverSubscription = undefined; closeSurface();
        switchNamespace(browserAnonymousNamespace());
        window.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {detail: {authenticated: false, reason: 'site-logout'}}));
        setStatus('LOTBI Site에서 로그아웃했습니다. 이 브라우저의 계정별 대화는 분리 보존됩니다.');
      } catch (error) {
        logout.disabled = false; logout.textContent = '로그아웃';
        setStatus(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
      }
    });
    menu.appendChild(logout); layer.appendChild(menu); trigger.setAttribute('aria-expanded', 'true'); installSurfaceBehavior(layer, menu, {trigger});
  };

  let responseGradeOpen = false;
  const closeResponseGradeMenu = ({restoreFocus = false} = {}) => {
    responseGradeMenu.hidden = true;
    responseGradeTrigger.setAttribute('aria-expanded', 'false');
    responseGradeOpen = false;
    if (restoreFocus) responseGradeTrigger.focus();
  };
  const openResponseGradeMenu = ({edge = ''} = {}) => {
    if (!responseGradeAvailable()) return;
    responseGradeMenu.hidden = false;
    responseGradeTrigger.setAttribute('aria-expanded', 'true');
    responseGradeOpen = true;
    queueMicrotask(() => {
      const items = responseGradeOptions.filter(option => option instanceof HTMLButtonElement);
      if (!items.length) return;
      if (edge === 'first') { items[0].focus(); return; }
      if (edge === 'last') { items[items.length - 1].focus(); return; }
      (items.find(option => option.dataset.responseGrade === preferences.responseGrade) || items[0]).focus();
    });
  };
  const selectResponseGrade = grade => {
    if (!responseGradeAvailable()) return;
    if (!RESPONSE_GRADE_OPTIONS.some(([key]) => key === grade)) return;
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || browserAnonymousNamespace());
    preferences.responseGrade = grade;
    applyPreferences();
    savePreferences();
    setStatus(`응답 등급을 ${responseGradeLabel(grade)}로 설정했습니다.`);
    closeResponseGradeMenu({restoreFocus: true});
  };
  const moveResponseGradeFocus = offset => {
    const items = responseGradeOptions.filter(option => option instanceof HTMLButtonElement);
    const current = items.indexOf(document.activeElement);
    if (!items.length || current < 0) return;
    items[(current + offset + items.length) % items.length].focus();
  };

  const setVoiceFeedback = (message = '') => {
    setStatus(message || (sessionToken ? 'LOTBI와 대화할 준비가 되었습니다.' : '메시지를 보내면 안전한 LOTBI 계정 연결이 필요한 경우 로그인으로 이동합니다.'));
    if (!(stateRegion instanceof HTMLElement)) return;
    if (!message) {
      if (stateRegion.dataset.composerVoice === 'true') { stateRegion.hidden = true; stateRegion.textContent = ''; delete stateRegion.dataset.composerVoice; }
      return;
    }
    stateRegion.dataset.composerVoice = 'true'; stateRegion.textContent = message; stateRegion.hidden = false;
  };
  const updateSendState = () => {
    sendButton.disabled = inFlight || prompt.value.trim().length === 0;
    sendButton.setAttribute('aria-label', inFlight ? '전송 중' : '전송'); sendButton.title = inFlight ? '전송 중' : '전송';
    micButton.disabled = inFlight || voiceRequesting;
  };
  const setListeningState = listening => {
    voiceListening = listening; micButton.setAttribute('aria-pressed', String(listening));
    micButton.setAttribute('aria-label', listening ? '음성 입력 중지' : '음성 입력'); micButton.title = listening ? '듣는 중 — 눌러서 종료' : '음성 입력';
    if (listening) micButton.dataset.listening = 'true'; else delete micButton.dataset.listening;
  };
  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') throw new Error('음성 입력을 지원하지 않는 브라우저입니다.');
    const stream = await navigator.mediaDevices.getUserMedia({audio: true}); for (const track of stream.getTracks()) track.stop();
  };
  const startVoiceInput = async () => {
    if (inFlight || voiceRequesting) return;
    if (voiceListening && voiceRecognition) { voiceRecognition.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof SpeechRecognition !== 'function') { setVoiceFeedback('음성 입력을 지원하지 않는 브라우저입니다. 텍스트로 입력해 주세요.'); prompt.focus(); return; }
    voiceRequesting = true; micButton.disabled = true; micButton.dataset.requesting = 'true'; setVoiceFeedback('마이크 권한을 확인하고 있습니다.');
    try {
      await requestMicrophoneAccess(); const recognition = new SpeechRecognition(); voiceRecognition = recognition;
      recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => { voiceAvatarRequestId = nextAvatarRequestId('voice'); driveAvatar('listening-start', voiceAvatarRequestId); setListeningState(true); setVoiceFeedback('듣고 있습니다. 말씀해 주세요.'); };
      recognition.onresult = event => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.() || ''; if (!transcript) return;
        const current = prompt.value.trimEnd(); prompt.value = current ? `${current} ${transcript}` : transcript;
        prompt.dispatchEvent(new Event('input', {bubbles: true})); setVoiceFeedback('음성 입력이 텍스트로 변환되었습니다. 확인 후 전송해 주세요.'); prompt.focus();
      };
      recognition.onerror = event => setVoiceFeedback(voiceErrorMessage(event));
      recognition.onend = () => { if (voiceAvatarRequestId) driveAvatar('listening-end', voiceAvatarRequestId); voiceAvatarRequestId = undefined; setListeningState(false); if (voiceRecognition === recognition) voiceRecognition = undefined; updateSendState(); prompt.focus(); };
      recognition.start();
    } catch (error) { setListeningState(false); setVoiceFeedback(voiceErrorMessage(error)); prompt.focus(); }
    finally { voiceRequesting = false; delete micButton.dataset.requesting; updateSendState(); }
  };
  const showError = (error, retryText, retryWithoutDuplicate, logicalRequestId = '') => {
    const wrapper = document.createElement('article'); wrapper.className = 'chat-message chat-message-error'; wrapper.setAttribute('role', 'alert');
    const body = document.createElement('p'); body.className = 'chat-message-body'; body.textContent = userFacingErrorMessage(error); wrapper.appendChild(body);
    appendSafeErrorEvidence(wrapper, error); logSafeConversationFailure(error);
    const retryable = isSessionError(error) || isGuestSessionError(error) || !(error instanceof SiteCoreError) || error.retryable;
    if (retryable) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'chat-retry-button'; retry.textContent = isSessionError(error) ? '다시 연결' : '다시 시도';
      retry.addEventListener('click', async () => {
        retry.disabled = true;
        if (isSessionError(error)) {
          try { await beginSiteHandoff(retryText); }
          catch (caught) { retry.disabled = false; body.textContent = caught instanceof Error ? caught.message : '로그인 연결을 시작하지 못했습니다.'; }
          return;
        }
        wrapper.remove(); await requestAssistant(retryText, !retryWithoutDuplicate, logicalRequestId);
      });
      wrapper.appendChild(retry);
    }
    appendNode(wrapper);
  };
  const requestAssistant = async (text, appendUserMessage = true, logicalRequestId = '') => {
    const message = typeof text === 'string' ? text.trim() : ''; if (!message || inFlight) return;
    const submittedAt = performanceNow(); const requestsBefore = resourceCounts(); recordTiming('T0-submit', {length: message.length});
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || browserAnonymousNamespace());
    ensureThread(message);
    if (appendUserMessage) {
      appendNode(createMessage('user', message), {forceScroll: true}); appendPersistedMessage({role: 'user', text: message, meta: {}});
    }
    const local = deterministicReply(message);
    if (local) {
      diagnostics.lastPath = 'LOCAL_DETERMINISTIC'; diagnostics.deterministicReplies += 1; diagnostics.providerCallsAvoided += 1;
      recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0}); await Promise.resolve();
      const record = {role: 'assistant', text: local, meta: {status: 'ANSWERED', responseMode: 'LOCAL_DETERMINISTIC'}};
      appendNode(createMessage('assistant', local, record.meta)); appendPersistedMessage(record);
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt));
      const requestsAfter = resourceCounts();
      diagnostics.lastCoreRequestDelta = requestsAfter.core - requestsBefore.core;
      diagnostics.lastExternalAiRequestDelta = requestsAfter.externalAi - requestsBefore.externalAi;
      publishDiagnostics();
      recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: diagnostics.lastCoreRequestDelta, providerCalls: 0, externalAiCalls: diagnostics.lastExternalAiRequestDelta});
      console.info(`[LOTBI deterministic evidence] latencyMs=${diagnostics.lastVisibleAnswerMs} coreRequests=${diagnostics.lastCoreRequestDelta} providerRequests=0 externalAiRequests=${diagnostics.lastExternalAiRequestDelta}`);
      setStatus('LOTBI의 즉시 응답이 도착했습니다.'); prompt.focus(); return;
    }
    if (!sessionToken && isExplicitLifeCalendarCommand(message)) {
      try { await beginSiteHandoff(message); } catch (caught) { showError(caught, message, false); }
      return;
    }
    if (!sessionToken) {
      const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState(); setVoiceFeedback(''); setStatus('LOTBI 응답을 기다리는 중입니다.');
      const guestRequestId = logicalRequestId || newId('guest-ai');
      diagnostics.lastPath = 'CORE_GUEST_CONVERSATION'; diagnostics.coreCalls += 1;
      const coreStartedAt = performanceNow(); recordTiming('T1-core-guest-request', {coreCall: diagnostics.coreCalls});
      try {
        const token = await ensureGuestSession();
        const response = await sendGuestConversationMessage({
          guestToken: token,
          text: message,
          idempotencyKey: guestRequestId,
          recentContext: guestRecentContext(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
        });
        diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt));
        recordTiming('T2-core-guest-response', {durationMs: diagnostics.lastCoreDurationMs});
        loading.parentElement?.remove();
        const meta = {status: response.status, responseMode: response.responseMode, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
        let richProduct = null;
        const guestPurchase = response.intent?.action === 'PURCHASE' || response.followUp?.action === 'PURCHASE';
        if (guestPurchase && typeof response.intent?.product_query === 'string' && response.intent.product_query.trim()) {
          try {
            const merchantHint = productMerchantHint(message, response.intent);
            const publicResult = await searchPublicProductCards({query: response.intent.product_query, merchantCode: merchantHint.merchantCode, merchantExplicit: merchantHint.merchantExplicit, maxResults: 6});
            richProduct = compactRichProductMeta({displayId: publicResult.displayId, query: publicResult.query, originalText: message, merchant: publicResult.merchant, sourceMode: publicResult.sourceMode, expired: false, cards: publicResult.cards});
          } catch (cardError) {
            console.info('[LOTBI public rich product cards unavailable]', {code: cardError instanceof SiteCoreError ? cardError.code : 'UNKNOWN'});
          }
        }
        if (richProduct) meta.richProduct = richProduct;
        const assistantNode = createMessage('assistant', response.assistantText, meta);
        if (richProduct) { const rail = createProductCardRail(richProduct); if (rail) assistantNode.appendChild(rail); }
        appendNode(assistantNode); appendPersistedMessage({role: 'assistant', text: response.assistantText, meta});
        diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 2 : 1});
        setStatus(richProduct ? '로그인 없이 실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.'));
      } catch (caught) {
        loading.parentElement?.remove();
        if (isGuestSessionError(caught)) clearGuestSession();
        showError(caught, message, true, guestRequestId);
        setStatus('LOTBI 대화를 완료하지 못했습니다.');
      } finally { inFlight = false; updateSendState(); prompt.focus(); }
      return;
    }
    if (isExplicitLifeCalendarCommand(message)) {
      const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState();
      const calendarRequestId = logicalRequestId || newId('calendar');
      try {
        const calendar = await executeLifeCalendarCommand(sessionToken, {
          logicalRequestId: calendarRequestId, text: message,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
        });
        loading.parentElement?.remove();
        const meta = {status: 'ANSWERED', responseMode: calendar.parserType};
        appendNode(createMessage('assistant', calendar.assistantText, meta));
        appendPersistedMessage({role: 'assistant', text: calendar.assistantText, meta});
        diagnostics.lastPath = 'CORE_CALENDAR_DETERMINISTIC'; diagnostics.coreCalls += 1; diagnostics.providerCallsAvoided += 1;
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('일정을 추가하고 달력을 새로 고쳤습니다.');
      } catch (caught) {
        loading.parentElement?.remove(); if (isSessionError(caught)) sessionToken = undefined;
        showError(caught, message, true, calendarRequestId);
      } finally { inFlight = false; updateSendState(); prompt.focus(); }
      return;
    }
    const avatarRequestId = nextAvatarRequestId('turn'); driveAvatar('response-wait', avatarRequestId);
    const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState(); setVoiceFeedback(''); setStatus('LOTBI 응답을 기다리는 중입니다.');
    diagnostics.lastPath = 'CORE_CONVERSATION'; diagnostics.coreCalls += 1;
    const coreStartedAt = performanceNow(); recordTiming('T1-core-request', {coreCall: diagnostics.coreCalls});
    try {
      const response = await sendConversationMessage(sessionToken, message);
      diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt)); recordTiming('T2-core-response', {durationMs: diagnostics.lastCoreDurationMs});
      loading.parentElement?.remove();
      const meta = {status: response.status, responseMode: response.responseMode, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
      let richProduct = null;
      const authenticatedPurchase = response.intent?.action === 'PURCHASE' || response.followUp?.action === 'PURCHASE';
      if (authenticatedPurchase && typeof response.intent?.product_query === 'string' && response.intent.product_query.trim()) {
        try {
          const merchantHint = productMerchantHint(message, response.intent);
          const discovery = await searchProductCards(sessionToken, {query: response.intent.product_query, originalText: message, merchantCode: merchantHint.merchantCode, merchantExplicit: merchantHint.merchantExplicit, brand: typeof response.intent.brand === 'string' ? response.intent.brand : '', maxPrice: Number.isInteger(response.intent.max_price) ? response.intent.max_price : null, preferences: Array.isArray(response.intent.preferences) ? response.intent.preferences : [], maxResults: 6});
          const cards = await getProductCards(sessionToken, discovery.resolutionId);
          richProduct = compactRichProductMeta({resolutionId: cards.resolutionId, resolutionHash: cards.resolutionHash, query: cards.query, originalText: message, merchant: discovery.merchant, sourceMode: cards.sourceMode || discovery.sourceMode, expired: cards.expired, cards: cards.cards});
        } catch (cardError) {
          console.info('[LOTBI rich product cards unavailable]', {code: cardError instanceof SiteCoreError ? cardError.code : 'UNKNOWN'});
        }
      }
      if (richProduct) meta.richProduct = richProduct;
      const assistantNode = createMessage('assistant', response.assistantText, meta);
      if (richProduct) { const rail = createProductCardRail(richProduct); if (rail) assistantNode.appendChild(rail); }
      appendNode(assistantNode); appendPersistedMessage({role: 'assistant', text: response.assistantText, meta});
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 3 : 1});
      setStatus(richProduct ? '실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.'));
      driveAvatar('response-complete', avatarRequestId);
    } catch (caught) {
      driveAvatar('cancel', avatarRequestId);
      loading.parentElement?.remove(); if (isSessionError(caught)) sessionToken = undefined;
      showError(caught, message, true); setStatus('LOTBI 대화를 완료하지 못했습니다.');
    } finally { inFlight = false; updateSendState(); prompt.focus(); }
  };
  window.addEventListener('lotbi:keyboard-viewport', () => {
    if (!thread.hidden && isThreadNearBottom()) {
      requestAnimationFrame(scrollThread);
    }
  });

  const submitCurrentPrompt = async () => {
    if (inFlight) return; const message = prompt.value.trim(); if (!message) return;
    if (voiceListening && voiceRecognition) voiceRecognition.stop();
    prompt.value = ''; state.draft = ''; saveState(); prompt.dispatchEvent(new Event('input', {bubbles: true})); await requestAssistant(message, true);
  };

  micButton.disabled = false; micButton.setAttribute('aria-pressed', 'false'); micButton.setAttribute('aria-label', '음성 입력'); micButton.title = '음성 입력';
  if (RESPONSE_GRADE_BACKEND_ENABLED) {
    responseGradeTrigger.addEventListener('click', () => {
      if (responseGradeOpen) closeResponseGradeMenu({restoreFocus: true});
      else openResponseGradeMenu();
    });
    responseGradeTrigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); openResponseGradeMenu({edge: 'first'}); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); openResponseGradeMenu({edge: 'last'}); }
    });
    responseGradeMenu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeResponseGradeMenu({restoreFocus: true}); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); moveResponseGradeFocus(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveResponseGradeFocus(-1); }
      else if (event.key === 'Home') { event.preventDefault(); responseGradeOptions[0]?.focus(); }
      else if (event.key === 'End') { event.preventDefault(); responseGradeOptions[responseGradeOptions.length - 1]?.focus(); }
      else if (event.key === 'Tab') closeResponseGradeMenu();
    });
    for (const option of responseGradeOptions) {
      option.addEventListener('click', () => selectResponseGrade(option.dataset.responseGrade || ''));
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && responseGradeOpen) { event.preventDefault(); closeResponseGradeMenu({restoreFocus: true}); }
    });
  }
  prompt.addEventListener('input', () => { updateSendState(); if (stateReady) { state.draft = prompt.value.slice(0, 1000); saveState(); } });
  prompt.addEventListener('compositionend', updateSendState);
  prompt.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void submitCurrentPrompt(); } });
  sendButton.addEventListener('click', () => void submitCurrentPrompt());
  micButton.addEventListener('click', () => void startVoiceInput());
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (responseGradeOpen && !target?.closest('[data-response-grade-control]')) closeResponseGradeMenu();
    const calendarView = target?.closest('[data-calendar-view]');
    if (calendarView instanceof HTMLButtonElement) {
      event.preventDefault();
      void openCalendar(calendarView.dataset.calendarView || 'all');
      return;
    }
    const newChat = target?.closest('[data-new-conversation]');
    if (newChat) { event.preventDefault(); startNewConversation(); return; }
    const staleLogin = target?.closest('[data-sidebar-account] a.sidebar-account-entry[href="/auth/start/"]');
    if (staleLogin instanceof HTMLElement && sessionToken && document.body.dataset.siteAuthState === 'authenticated') {
      const slot = staleLogin.closest('[data-sidebar-account]');
      event.preventDefault();
      refreshAuthenticatedProfileSlots();
      const healedTrigger = slot?.querySelector('[data-profile-menu-trigger]');
      if (healedTrigger instanceof HTMLElement) openProfileMenu(healedTrigger);
      return;
    }
    const trigger = target?.closest('[data-profile-menu-trigger]');
    if (trigger instanceof HTMLElement) { event.preventDefault(); openProfileMenu(trigger); }
  });
  window.addEventListener(SESSION_STATE_EVENT, event => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (!detail || typeof detail.authenticated !== 'boolean') return;
    if (detail.authenticated) {
      const key = normalizedNamespace(detail.identityKey || detail.installationId); if (key) switchNamespace(key);
      refreshAuthenticatedProfileSlots();
    } else if (!sessionToken) switchNamespace(browserAnonymousNamespace());
  });
  window.addEventListener(SIDEBAR_RENDERED_EVENT, () => {
    refreshAuthenticatedProfileSlots();
    if (!stateReady && document.body.dataset.siteAuthState === 'unauthenticated') {
      switchNamespace(browserAnonymousNamespace());
    }
  });
  syncResponseGradeUi();
  updateSendState(); setStatus(sessionToken ? 'LOTBI와 대화할 준비가 되었습니다.' : '로그인 없이도 LOTBI와 바로 대화할 수 있습니다. 계정 기능이 필요할 때만 로그인합니다.');
  if (namespace) switchNamespace(namespace); else if (document.body.dataset.siteAuthState === 'unauthenticated') switchNamespace(browserAnonymousNamespace());
  if (sessionToken) void loadServerProfile();
  if (autoSend && typeof initialText === 'string' && initialText.trim()) queueMicrotask(() => void requestAssistant(initialText, true));
  return true;
}

function autoMount() { if (document.getElementById('lotbi-prompt')) mountConversation(); }
ensureConversationStyles();
Object.defineProperty(window, '__lotbiConversationUx', {value: Object.freeze({snapshot: () => Object.freeze({...diagnostics})}), writable: false, configurable: false});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, {once: true}); else autoMount();
