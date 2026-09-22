import {beginSiteHandoff, markSiteLogoutSuppression} from './site-auth.js?v=20260920-authux1';
import * as siteCore from './site-core.js?v=20260921-guestclaim1';
import {buildNaverMapsWebSearchUrl, buildNaverStaticMapThumbnailUrl, buildVerifiedPhoneHref, isPlaceResultFresh, normalizePlaceResult, openNaverMapsPlace} from './site-navigation.js?v=20260922-mois1';
import * as siteAttachments from './site-attachments.js?v=20260920-attach16prod';
import {formatConversationTimestamp, millisecondsUntilNextLocalMidnight, shouldShowConversationSeparator, timestampedConversationMessage} from './site-conversation-timeline.js?v=20260920-conversationpolish1';
import {deterministicReply} from './site-deterministic.js';
import {ensureDurableAnonymousConversationNamespace, guestConversationThreadClaimed, prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=20260921-guestclaim1';
import {executeLifeCalendarCommand, isExplicitLifeCalendarCommand, previewLifeCalendarCommand} from './site-calendar.js?v=20260921-smartcaldraft1';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=20260921-smartcaldraft1';
import {calendarActionInFlight, createAvailableCalendarAction, normalizePersistedCalendarAction, recoverCalendarActionAfterReload, runCalendarAction} from './site-calendar-actions.js?v=20260921-smartcaldraft1';
import {mountLifeCalendarManager} from './site-calendar-ui.js?v=20260922-locationperm1';
import {createSafeMessageBody, enhanceExpandableUserMessage} from './site-message-body.js?v=20260920-messageux1';

const {createGuestConversationSession, deleteConversationAttachment, getCurrentSiteUser, getCurrentSubscription, getProductCards, logoutSiteSession, normalizeCalendarPartialCandidate, normalizeSmartCalendarDraft, reviewProductCard, searchProductCards, searchPublicProductCards, sendConversationMessage, sendGuestConversationMessage, updateCurrentSiteProfile, uploadConversationAttachment, SiteCoreError} = siteCore;
const {attachmentKindLabel, safeAttachmentName, validateAttachmentFiles} = siteAttachments;

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const SIDEBAR_RENDERED_EVENT = 'lotbi:sidebar-auth-rendered';
const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const THREAD_LIMIT = 50;
const MESSAGE_LIMIT = 120;
const THREAD_TITLE_LIMIT = 60;
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
  link.href = '/site-conversation.css?v=20260921-placecompactactions1';
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
const anonymousConversationNamespace = () => ensureDurableAnonymousConversationNamespace();
const storageKey = (namespace, kind) => `${STORAGE_PREFIX}.${kind}.${namespace}`;

function resolveRestoredActiveThreadId(storedActiveThreadId, threads) {
  if (storedActiveThreadId === null) return null;
  if (typeof storedActiveThreadId === 'string' && threads.some(item => item.id === storedActiveThreadId)) return storedActiveThreadId;
  return threads[0]?.id || null;
}

function resolvePlaceOrbitPointerIndex({
  targetIndex = null,
  activeIndex = 0,
  cardCount = 0,
  clientX = Number.NaN,
  clientY = Number.NaN,
  centerRect = null,
} = {}) {
  const count = Number.isInteger(cardCount) && cardCount > 0 ? cardCount : 0;
  if (!count) return null;
  const active = Number.isInteger(activeIndex) ? ((activeIndex % count) + count) % count : 0;
  const target = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < count ? targetIndex : null;
  if (target !== null && target !== active) return target;

  const left = Number(centerRect?.left);
  const right = Number(centerRect?.right);
  const top = Number(centerRect?.top);
  const bottom = Number(centerRect?.bottom);
  const pointX = Number(clientX);
  const pointY = Number(clientY);
  const usableRect = count > 1
    && [left, right, top, bottom, pointX, pointY].every(Number.isFinite)
    && left <= right
    && top <= bottom
    && pointY >= top
    && pointY <= bottom;

  if (usableRect && pointX < left) return (active - 1 + count) % count;
  if (usableRect && pointX > right) return (active + 1) % count;
  return target;
}

function createMessage(role, text, meta = {}) {
  const article = document.createElement('article');
  article.className = `chat-message chat-message-${role}`;
  article.dataset.role = role;
  if (meta.status) article.dataset.status = meta.status;
  if (meta.responseMode) article.dataset.responseMode = meta.responseMode;
  if (meta.correlationId) article.dataset.correlationId = meta.correlationId;
  const body = createSafeMessageBody(text);
  article.appendChild(body);
  if (Array.isArray(meta.attachments) && meta.attachments.length) {
    const list = document.createElement('div'); list.className = 'message-attachment-list'; list.setAttribute('aria-label', '첨부 파일');
    for (const attachment of meta.attachments) {
      const item = document.createElement('div'); item.className = 'message-attachment-card';
      const name = safeAttachmentName(attachment && attachment.filename);
      const mediaType = attachment && attachment.mediaType ? attachment.mediaType : '';
      if (String(mediaType).startsWith('image/') && attachment && attachment.previewUrl) {
        const image = document.createElement('img'); image.className = 'message-attachment-image'; image.src = attachment.previewUrl; image.alt = name; item.appendChild(image);
      } else {
        const icon = document.createElement('span'); icon.className = 'message-attachment-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = attachment && attachment.mediaType === 'application/pdf' ? 'PDF' : '파일'; item.appendChild(icon);
      }
      const label = document.createElement('span'); label.className = 'message-attachment-name'; label.textContent = name; item.appendChild(label); list.appendChild(item);
    }
    article.appendChild(list);
  }
  if (meta.followUpRequired) {
    const note = document.createElement('span');
    note.className = 'chat-message-meta'; note.textContent = '추가 확인이 필요합니다.';
    article.appendChild(note);
  }
  if (role === 'user') enhanceExpandableUserMessage(article, body, text);
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

function normalizedThreadTitle(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, THREAD_TITLE_LIMIT);
}
function titleFromMessage(text) {
  const value = normalizedThreadTitle(text);
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

function mountConversation({sessionToken: initialSessionToken, initialText = '', autoSend = false, identityKey = ''} = {}) {
  ensureConversationStyles();
  const prompt = document.getElementById('lotbi-prompt');
  const sendButton = document.querySelector('.send-button');
  const attachmentControl = document.querySelector('[data-attachment-control]');
  const attachmentTrigger = document.querySelector('[data-attachment-trigger]');
  const attachmentMenu = document.querySelector('[data-attachment-menu]');
  const attachmentPreview = document.querySelector('[data-attachment-preview]');
  const attachmentInputs = [...document.querySelectorAll('[data-attachment-input]')];
  const micButton = document.querySelector('.mic-button');
  const responseGradeControl = document.querySelector('[data-response-grade-control]');
  const responseGradeTrigger = document.querySelector('[data-response-grade-trigger]');
  const responseGradeMenu = document.querySelector('[data-response-grade-menu]');
  const responseGradeOptions = responseGradeMenu ? [...responseGradeMenu.querySelectorAll('[data-response-grade]')] : [];
  const thread = document.getElementById('conversation-thread');
  const mainScrollHost = document.getElementById('main-content');
  const statusRegion = document.getElementById('chat-status');
  const stateRegion = document.getElementById('chat-state-region');
  const homeAvatarAnchor = document.querySelector('[data-home-avatar-anchor]');
  const avatar = document.querySelector('[data-lotbi-avatar-container]');
  if (
    !(prompt instanceof HTMLTextAreaElement) || !(sendButton instanceof HTMLButtonElement)
    || !(micButton instanceof HTMLButtonElement) || !(attachmentControl instanceof HTMLElement)
    || !(attachmentTrigger instanceof HTMLButtonElement) || !(attachmentMenu instanceof HTMLElement)
    || !(attachmentPreview instanceof HTMLElement) || attachmentInputs.length !== 3
    || attachmentInputs.some(input => !(input instanceof HTMLInputElement))
    || !(responseGradeControl instanceof HTMLElement) || !(responseGradeTrigger instanceof HTMLButtonElement)
    || !(responseGradeMenu instanceof HTMLElement) || responseGradeOptions.length !== RESPONSE_GRADE_OPTIONS.length
    || !(thread instanceof HTMLElement) || !(mainScrollHost instanceof HTMLElement)
    || !(homeAvatarAnchor instanceof HTMLElement) || !(avatar instanceof HTMLElement)
  ) return false;
  if (sendButton.dataset.conversationMounted === 'true') return true;
  sendButton.dataset.conversationMounted = 'true';

  const storage = safeStorage();
  let sessionToken = typeof initialSessionToken === 'string' && initialSessionToken.trim() ? initialSessionToken.trim() : undefined;
  let namespace = normalizedNamespace(identityKey);
  let state = {threads: [], activeThreadId: null, draft: ''};
  let preferences = {color: 'default', theme: 'system', displayName: '', photo: '', responseGrade: DEFAULT_RESPONSE_GRADE};
  let serverIdentity, serverSubscription;
  let stateReady = false, inFlight = false, voiceRequesting = false, voiceListening = false, voiceRecognition;
  let lastRenderedCreatedAt;
  let timestampRefreshTimer;
  let richCardActionInFlight = false;
  let guestSessionToken, guestSessionExpiresAt = 0;
  let avatarSequence = 0, voiceAvatarRequestId;
  const nextAvatarRequestId = kind => `site-${kind}-${Date.now()}-${++avatarSequence}`;
  const driveAvatar = (phase, requestId) => window.dispatchEvent(new CustomEvent('lotbi-avatar-lifecycle', {
    detail: Object.freeze({phase, requestId}),
  }));
  let openSurface, openSurfaceTrigger, surfaceRestoreFocus, surfaceCloseCallback;

  const setStatus = message => { if (statusRegion) statusRegion.textContent = message; };
  const threadRecord = () => state.threads.find(item => item.id === state.activeThreadId);
  const guestSessionStorageKey = () => {
    const owner = normalizedNamespace(namespace) || anonymousConversationNamespace();
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
  const recentConversationContext = () => {
    const messages = threadRecord()?.messages;
    if (!Array.isArray(messages) || !messages.length) return [];
    const normalized = messages.slice(0, -1).flatMap(item => {
      const text = typeof item?.text === 'string' ? item.text.trim() : '';
      if (
        !item
        || (item.role !== 'user' && item.role !== 'assistant')
        || !text
        || text.length > 4000
      ) return [];
      return [{role: item.role, text}];
    });
    const selected = [];
    let usedChars = 0;
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      const item = normalized[index];
      if (selected.length >= 24) break;
      if (usedChars + item.text.length > 16000) break;
      selected.push(item);
      usedChars += item.text.length;
    }
    return selected.reverse();
  };
  const beginGuestClaimingSiteHandoff = async pendingText => {
    // Claim intent creation is explicit-user-action only. Automatic Account
    // continuity restoration must never import old guest history.
    try { await prepareGuestConversationClaimIntent(); } catch {}
    return beginSiteHandoff(pendingText);
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
    restoreAvatarHome(); thread.replaceChildren(); lastRenderedCreatedAt = undefined; thread.hidden = true; document.body.classList.remove('conversation-active');
  };
  const isThreadNearBottom = () => (
    mainScrollHost.scrollHeight - mainScrollHost.scrollTop - mainScrollHost.clientHeight <= 72
  );
  const scrollThread = () => { mainScrollHost.scrollTop = mainScrollHost.scrollHeight; };
  const createConversationSeparator = createdAt => {
    const label = formatConversationTimestamp(createdAt);
    if (!label) return null;
    const separator = document.createElement('time');
    separator.className = 'conversation-time-separator';
    separator.dateTime = new Date(createdAt).toISOString();
    separator.textContent = label;
    return separator;
  };
  const refreshConversationTimeLabels = () => {
    for (const separator of thread.querySelectorAll('time.conversation-time-separator[datetime]')) {
      const label = formatConversationTimestamp(separator.dateTime);
      if (label) separator.textContent = label;
    }
    window.clearTimeout(timestampRefreshTimer);
    timestampRefreshTimer = window.setTimeout(refreshConversationTimeLabels, millisecondsUntilNextLocalMidnight() + 50);
  };
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
  const closeConversationMenus = except => {
    for (const menu of document.querySelectorAll('details[data-conversation-menu][open]')) {
      if (menu !== except) menu.removeAttribute('open');
    }
  };
  const sortThreads = () => {
    state.threads.sort((a, b) => {
      const aPinned = a.pinned === true;
      const bPinned = b.pinned === true;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        const pinDelta = Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0);
        if (pinDelta) return pinDelta;
      }
      return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
  };
  const toggleThreadPin = id => {
    const record = state.threads.find(item => item.id === id); if (!record) return;
    record.pinned = record.pinned !== true;
    record.pinnedAt = record.pinned ? Date.now() : 0;
    sortThreads(); saveState(); renderRecent();
    setStatus(record.pinned ? '대화를 상단에 고정했습니다.' : '대화 고정을 해제했습니다.');
  };
  const renderRecent = () => {
    for (const list of document.querySelectorAll('[data-recent-conversations]')) {
      if (!(list instanceof HTMLElement)) continue;
      const fragment = document.createDocumentFragment();
      for (const item of state.threads) {
        const li = document.createElement('li');
        li.className = 'conversation-history-item';
        li.dataset.threadId = item.id;
        li.dataset.pinned = String(item.pinned === true);

        const button = document.createElement('button');
        button.type = 'button'; button.className = 'conversation-history-open'; button.dataset.threadId = item.id;
        button.title = item.title;
        button.setAttribute('aria-label', `${item.pinned === true ? '고정된 ' : ''}${item.title} 대화 열기`);
        if (item.id === state.activeThreadId) button.setAttribute('aria-current', 'true');
        const title = document.createElement('span');
        title.dataset.conversationTitle = ''; title.textContent = item.title;
        button.appendChild(title);
        if (item.pinned === true) {
          const badge = document.createElement('span');
          badge.className = 'conversation-history-pin'; badge.textContent = '고정'; badge.setAttribute('aria-hidden', 'true');
          button.appendChild(badge);
        }
        button.addEventListener('click', () => activateThread(item.id));

        const actions = document.createElement('details');
        actions.className = 'conversation-history-actions'; actions.dataset.conversationMenu = '';
        const summary = document.createElement('summary');
        summary.className = 'conversation-history-menu-trigger'; summary.dataset.conversationMenuTrigger = '';
        summary.setAttribute('aria-label', `${item.title} 대화 메뉴`); summary.textContent = '⋯';
        const menu = document.createElement('div');
        menu.className = 'conversation-history-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `${item.title} 대화 관리`);

        const action = (name, label, handler, className = '') => {
          const control = document.createElement('button');
          control.type = 'button'; control.dataset.conversationAction = name; control.setAttribute('role', 'menuitem');
          control.className = className; control.textContent = label;
          control.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation(); actions.open = false; handler();
          });
          menu.appendChild(control);
        };
        action('pin', item.pinned === true ? '고정 해제' : '상단에 고정', () => toggleThreadPin(item.id));
        action('rename', '이름 바꾸기', () => openRenameThread(item.id));
        action('delete', '삭제', () => openDeleteThread(item.id), 'conversation-history-delete');
        actions.addEventListener('toggle', () => { if (actions.open) closeConversationMenus(actions); });
        actions.append(summary, menu);
        li.append(button, actions); fragment.appendChild(li);
      }
      list.replaceChildren(fragment);
    }
  };
  const appendPersistedMessage = message => {
    const record = threadRecord(); if (!record) return;
    record.messages.push(message); record.messages = record.messages.slice(-MESSAGE_LIMIT); record.updatedAt = Date.now();
    sortThreads(); saveState(); renderRecent();
  };
  const lotbiBoxKey = () => storageKey(namespace || anonymousConversationNamespace(), 'lotbi-box');
  const loadLotbiBox = () => {
    const parsed = safeParse(storage?.getItem(lotbiBoxKey()), []);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.key === 'string').slice(0, 100) : [];
  };
  const saveLotbiBox = items => {
    if (storage) storage.setItem(lotbiBoxKey(), JSON.stringify(items.slice(0, 100)));
  };
  const removeLotbiBoxItem = key => {
    const normalizedKey = typeof key === 'string' ? key : '';
    const items = loadLotbiBox().filter(item => item.key !== normalizedKey);
    saveLotbiBox(items);
    return items;
  };
  const refreshLotbiBoxControls = () => {
    const keys = new Set(loadLotbiBox().map(item => item.key));
    for (const control of document.querySelectorAll('[data-lotbi-box-toggle-key]')) {
      if (!(control instanceof HTMLButtonElement)) continue;
      const saved = keys.has(control.dataset.lotbiBoxToggleKey || '');
      control.textContent = saved ? '✓ 롯비함' : '+ 롯비함';
      control.setAttribute('aria-pressed', String(saved));
    }
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
      box.dataset.lotbiBoxToggleKey = lotbiBoxItemKey(rich, card);
      const syncBoxLabel = () => {
        const saved = isInLotbiBox(rich, card);
        box.textContent = saved ? '✓ 롯비함' : '+ 롯비함';
        box.setAttribute('aria-pressed', String(saved));
      };
      syncBoxLabel();
      box.addEventListener('click', () => {
        const added = toggleLotbiBox(rich, card);
        refreshLotbiBoxControls();
        setStatus(added ? '롯비함에 담았습니다.' : '롯비함에서 뺐습니다.');
      });
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
            await beginGuestClaimingSiteHandoff(rich.originalText || rich.query || card.title);
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
          const reviewRecord = timestampedConversationMessage({role: 'assistant', text: reviewText, meta});
          appendConversationRecord(reviewRecord); appendPersistedMessage(reviewRecord);
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
  const compactPlaceResultMeta = (value, capturedAt = Date.now()) => {
    const normalized = normalizePlaceResult(value, {capturedAt});
    if (!normalized) return null;
    return {
      contract_id: normalized.contractId,
      schema_version: normalized.schemaVersion,
      result_set_id: normalized.resultSetId,
      provider_code: normalized.providerCode,
      source: normalized.source,
      query: normalized.query,
      captured_at: normalized.capturedAt,
      results: normalized.results.map(place => ({
        result_id: place.resultId,
        place_id: place.placeId,
        name: place.name,
        category: place.category,
        address: place.address,
        road_address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        coordinate_system: place.coordinateSystem,
        coordinate_authority: place.coordinateAuthority,
        source_url: place.sourceUrl,
        image_url: place.imageUrl,
        phone: place.phone,
        phone_verified: place.phoneVerified,
        food_license_verification: place.foodLicenseVerification ? {
          state: place.foodLicenseVerification.state,
          source: 'MOIS_FOOD_LICENSE',
          ai_calls: 0,
          ...(place.foodLicenseVerification.administrativeStatus
            ? {administrative_status: place.foodLicenseVerification.administrativeStatus}
            : {}),
        } : undefined,
        navigation_capability: place.navigationCapable,
      })),
    };
  };
  const normalizedPersistedPlaceResult = value => {
    if (!value || typeof value !== 'object') return null;
    return normalizePlaceResult(value, {capturedAt: Number(value.captured_at)});
  };
  const createPlaceCardRail = placeValue => {
    const placeResult = normalizedPersistedPlaceResult(placeValue);
    if (!placeResult) return null;
    const fresh = isPlaceResultFresh(placeResult);
    const rail = document.createElement('section');
    rail.className = 'lotbi-rich-card-rail lotbi-place-orbit';
    rail.dataset.richCardType = 'PLACE';
    rail.dataset.placeResultSetId = placeResult.resultSetId;
    rail.dataset.cardCount = String(placeResult.results.length);
    rail.dataset.freshness = fresh ? 'fresh' : 'stale';
    rail.setAttribute('aria-label', '장소 검색 결과');
    rail.setAttribute('aria-roledescription', 'carousel');
    rail.tabIndex = 0;

    const setNeutralPlaceholder = media => {
      media.replaceChildren();
      media.classList.remove('lotbi-rich-card-media-loading');
      media.classList.add('lotbi-rich-card-placeholder', 'lotbi-place-photo-placeholder');
      media.dataset.mediaState = 'placeholder';
      media.dataset.mediaSource = 'NEUTRAL_PLACE_PLACEHOLDER';
      const mark = document.createElement('span');
      mark.className = 'lotbi-place-placeholder-mark';
      mark.textContent = 'LOTBI';
      mark.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'lotbi-place-placeholder-label';
      label.textContent = '사진 정보 없음';
      media.append(mark, label);
    };

    const openPlaceInNaverMap = place => {
      const fallbackHref = buildNaverMapsWebSearchUrl(place);
      if (!isPlaceResultFresh(placeResult)) {
        setStatus('결과가 오래됐어요. 같은 장소를 다시 검색한 뒤 열어 주세요.');
        return;
      }
      const opened = openNaverMapsPlace(place);
      if (!opened.opened) {
        globalThis.location.href = fallbackHref;
        setStatus('네이버지도 웹 검색으로 연결합니다.');
        return;
      }
      const navigationMode = opened.mode === 'NAVER_NAVIGATION_INTENT' || opened.mode === 'NAVER_NAVIGATION_URL_SCHEME';
      setStatus(navigationMode ? '선택한 장소를 네이버지도 길안내로 연결합니다.' : '선택한 장소를 네이버지도에서 엽니다.');
    };

    const cards = [];
    for (const [placeIndex, place] of placeResult.results.entries()) {
      const item = document.createElement('article');
      item.className = 'lotbi-rich-card lotbi-rich-card-place lotbi-place-orbit-card';
      item.dataset.candidateIndex = String(place.candidateIndex);
      item.dataset.orbitIndex = String(placeIndex);
      item.setAttribute('role', 'group');
      item.setAttribute('aria-roledescription', 'slide');
      item.setAttribute('aria-label', `${placeIndex + 1} / ${placeResult.results.length} · ${place.name}`);
      item.tabIndex = placeIndex === 0 ? 0 : -1;

      const media = document.createElement('div');
      media.className = 'lotbi-rich-card-media lotbi-rich-card-place-media lotbi-rich-card-media-loading';
      media.dataset.mediaState = 'loading';
      if (place.imageUrl) {
        const image = document.createElement('img');
        image.className = 'lotbi-rich-card-image lotbi-place-photo';
        image.alt = `${place.name} 대표 사진`;
        image.loading = placeIndex === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        const revealImage = async () => {
          try {
            if (typeof image.decode === 'function') await image.decode();
          } catch {}
          if (!image.isConnected) return;
          image.classList.add('is-ready');
          media.classList.remove('lotbi-rich-card-media-loading');
          media.dataset.mediaState = 'loaded';
          media.dataset.mediaSource = 'VERIFIED_PLACE_PHOTO';
        };
        image.addEventListener('load', () => { void revealImage(); }, {once: true});
        image.addEventListener('error', () => setNeutralPlaceholder(media), {once: true});
        image.src = place.imageUrl;
        media.appendChild(image);
      } else {
        setNeutralPlaceholder(media);
      }

      const copy = document.createElement('div');
      copy.className = 'lotbi-rich-card-copy';
      const source = document.createElement('span');
      source.className = 'lotbi-rich-card-source';
      source.textContent = place.category || '장소';
      const title = document.createElement('h3');
      title.className = 'lotbi-rich-card-title';
      title.textContent = place.name;
      const address = document.createElement('span');
      address.className = 'lotbi-rich-card-price';
      address.textContent = place.address;
      copy.append(source, title, address);

      if (place.foodLicenseVerification) {
        const foodLicense = document.createElement('span');
        foodLicense.className = 'lotbi-place-license-evidence';
        const state = place.foodLicenseVerification.state;
        if (state === 'VERIFIED') {
          foodLicense.textContent = place.foodLicenseVerification.administrativeStatus
            ? `행정 인허가 데이터상 확인 · 행정상 상태: ${place.foodLicenseVerification.administrativeStatus}`
            : '행정 인허가 데이터상 확인';
        } else if (state === 'AMBIGUOUS') {
          foodLicense.textContent = '공공 인허가 데이터 일치 후보가 여러 개예요';
        } else if (state === 'CONFLICTING') {
          foodLicense.textContent = '공공 인허가 데이터와 업체 식별 정보가 일치하지 않아요';
        } else if (state === 'NOT_FOUND') {
          foodLicense.textContent = '공공 인허가 데이터에서 일치 기록 미확인';
        } else {
          foodLicense.textContent = '행정 인허가 데이터 확인 불가';
        }
        copy.appendChild(foodLicense);
      }

      const staticMapUrl = buildNaverStaticMapThumbnailUrl(place);
      if (staticMapUrl) {
        const locationSupport = document.createElement('div');
        locationSupport.className = 'lotbi-place-location-support';
        locationSupport.setAttribute('aria-label', `${place.name} 위치 미리보기`);
        const locationImage = document.createElement('img');
        locationImage.className = 'lotbi-place-location-thumbnail';
        locationImage.src = staticMapUrl;
        locationImage.alt = '';
        locationImage.loading = 'lazy';
        locationImage.decoding = 'async';
        locationImage.referrerPolicy = 'no-referrer';
        locationImage.addEventListener('error', () => locationSupport.remove(), {once: true});
        const locationLabel = document.createElement('span');
        locationLabel.textContent = '위치';
        locationSupport.append(locationImage, locationLabel);
        copy.appendChild(locationSupport);
      }

      const actions = document.createElement('div');
      actions.className = 'lotbi-rich-card-actions lotbi-place-card-actions';

      const phoneHref = buildVerifiedPhoneHref(place);
      const phone = document.createElement(phoneHref ? 'a' : 'button');
      phone.className = 'lotbi-rich-card-action lotbi-rich-card-icon-action lotbi-phone-action';
      phone.dataset.action = 'phone';
      phone.dataset.phoneState = phoneHref ? 'VERIFIED' : 'UNAVAILABLE';
      phone.tabIndex = placeIndex === 0 ? 0 : -1;
      if (phoneHref) {
        phone.href = phoneHref;
        phone.setAttribute('aria-label', `${place.name} 전화 걸기`);
        phone.title = '전화 걸기';
        phone.addEventListener('click', () => {
          phone.dataset.handoffState = 'CALL_HANDOFF_STARTED';
          setStatus('전화 앱 연결을 시작합니다.');
        });
      } else {
        phone.type = 'button';
        phone.disabled = true;
        phone.setAttribute('aria-disabled', 'true');
        phone.setAttribute('aria-label', `${place.name} 전화번호 정보 없음`);
        phone.title = '전화번호 정보 없음';
      }
      const phoneLabel = document.createElement('span');
      phoneLabel.className = 'lotbi-place-action-label';
      phoneLabel.textContent = '전화';
      phone.appendChild(phoneLabel);
      actions.appendChild(phone);

      const navigate = document.createElement('a');
      navigate.className = 'lotbi-rich-card-action lotbi-rich-card-icon-action lotbi-naver-map-action';
      navigate.href = buildNaverMapsWebSearchUrl(place);
      navigate.target = '_blank';
      navigate.rel = 'noopener noreferrer';
      navigate.setAttribute('aria-label', `${place.name} 네이버지도에서 열기`);
      navigate.title = '네이버지도에서 열기';
      navigate.dataset.action = 'naver-map';
      navigate.tabIndex = placeIndex === 0 ? 0 : -1;
      const naverIcon = document.createElement('img');
      naverIcon.className = 'lotbi-naver-map-icon';
      naverIcon.src = 'https://navercorp.com/img/pc/service-map-app-4.jpg';
      naverIcon.alt = '';
      naverIcon.width = 28;
      naverIcon.height = 28;
      naverIcon.loading = 'eager';
      naverIcon.decoding = 'async';
      naverIcon.referrerPolicy = 'no-referrer';
      naverIcon.addEventListener('error', () => {
        naverIcon.remove();
        navigate.classList.add('is-icon-fallback');
      }, {once: true});
      navigate.appendChild(naverIcon);
      const mapLabel = document.createElement('span');
      mapLabel.className = 'lotbi-place-action-label';
      mapLabel.textContent = '네이버지도';
      navigate.appendChild(mapLabel);
      navigate.addEventListener('click', event => {
        event.preventDefault();
        openPlaceInNaverMap(place);
      });
      actions.appendChild(navigate);

      item.append(media, copy, actions);
      cards.push(item);
      rail.appendChild(item);
    }

    const status = document.createElement('span');
    status.className = 'lotbi-place-orbit-status';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'lotbi-place-orbit-control lotbi-place-orbit-control-prev';
    previous.setAttribute('aria-label', '이전 장소');
    previous.textContent = '‹';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'lotbi-place-orbit-control lotbi-place-orbit-control-next';
    next.setAttribute('aria-label', '다음 장소');
    next.textContent = '›';

    rail.append(previous, next, status);

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    let activeIndex = 0;
    let suppressClick = false;
    let dragPointerId = null;
    let dragStartX = 0;
    let dragLastX = 0;
    let dragMoved = false;
    let wheelLocked = false;
    let pointerOriginIndex = null;
    let dragCaptured = false;

    const wrapIndex = index => {
      const count = cards.length;
      return count ? ((index % count) + count) % count : 0;
    };

    const orbitSlotFor = (index, centerIndex) => {
      const count = cards.length;
      if (!count || index === centerIndex) return 'CENTER';
      const forward = (index - centerIndex + count) % count;
      const backward = (centerIndex - index + count) % count;
      if (forward < backward) return forward === 1 ? 'RIGHT_FRONT' : 'RIGHT_BACK';
      if (backward < forward) return backward === 1 ? 'LEFT_FRONT' : 'LEFT_BACK';
      return forward === 1 ? 'RIGHT_FRONT' : 'RIGHT_BACK';
    };

    const applyOrbitState = ({announce = false} = {}) => {
      cards.forEach((card, index) => {
        const current = index === activeIndex;
        const slot = orbitSlotFor(index, activeIndex);
        card.dataset.orbitSlot = slot;
        card.classList.toggle('is-primary', current);
        card.setAttribute('aria-current', current ? 'true' : 'false');
        card.tabIndex = current ? 0 : -1;
        for (const control of card.querySelectorAll('a, button')) {
          control.tabIndex = current ? 0 : -1;
        }
      });
      previous.disabled = cards.length < 2;
      next.disabled = cards.length < 2;
      if (announce && cards[activeIndex]) {
        status.textContent = `${activeIndex + 1} / ${cards.length} · ${placeResult.results[activeIndex].name}`;
      }
    };

    const setActiveIndex = (index, {focus = false, announce = true} = {}) => {
      activeIndex = wrapIndex(index);
      rail.style.removeProperty('--lotbi-orbit-drag-x');
      applyOrbitState({announce});
      if (focus) cards[activeIndex]?.focus({preventScroll: true});
    };

    previous.addEventListener('click', () => setActiveIndex(activeIndex - 1));
    next.addEventListener('click', () => setActiveIndex(activeIndex + 1));

    cards.forEach((card, index) => {
      card.addEventListener('click', event => {
        if (suppressClick || event.target?.closest?.('a, button')) return;
        if (index !== activeIndex) {
          setActiveIndex(index);
          return;
        }
        openPlaceInNaverMap(placeResult.results[index]);
      });
    });

    rail.addEventListener('keydown', event => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = activeIndex + 1;
      else if (event.key === 'ArrowLeft') nextIndex = activeIndex - 1;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = cards.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setActiveIndex(nextIndex, {focus: true});
    });

    rail.addEventListener('wheel', event => {
      if (cards.length < 2 || wheelLocked) return;
      if (Math.abs(event.deltaX) < 24 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      wheelLocked = true;
      setActiveIndex(activeIndex + (event.deltaX > 0 ? 1 : -1));
      globalThis.setTimeout?.(() => { wheelLocked = false; }, reducedMotion ? 0 : 180);
    }, {passive: false});

    rail.addEventListener('pointerdown', event => {
      if (cards.length < 2 || (event.pointerType === 'mouse' && event.button !== 0) || event.target?.closest?.('a, button')) return;
      const originCard = event.target?.closest?.('.lotbi-place-orbit-card');
      const originIndex = Number(originCard?.dataset?.orbitIndex);
      const centerRect = cards[activeIndex]?.getBoundingClientRect?.() || null;
      pointerOriginIndex = resolvePlaceOrbitPointerIndex({
        targetIndex: Number.isInteger(originIndex) ? originIndex : null,
        activeIndex,
        cardCount: cards.length,
        clientX: event.clientX,
        clientY: event.clientY,
        centerRect,
      });
      dragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragLastX = event.clientX;
      dragMoved = false;
      dragCaptured = false;
      try {
        if (typeof rail.setPointerCapture === 'function') {
          rail.setPointerCapture(event.pointerId);
          dragCaptured = true;
        }
      } catch {
        dragCaptured = false;
      }
    });

    rail.addEventListener('pointermove', event => {
      if (event.pointerId !== dragPointerId) return;
      dragLastX = event.clientX;
      const delta = dragLastX - dragStartX;
      if (Math.abs(delta) > 4 && !dragMoved) {
        dragMoved = true;
        rail.classList.add('is-dragging');
      }
      if (!dragMoved) return;
      event.preventDefault();
      const visualDelta = Math.max(-72, Math.min(72, delta * 0.45));
      rail.style.setProperty('--lotbi-orbit-drag-x', `${visualDelta}px`);
    });

    const finishDrag = (event, {cancelled = false} = {}) => {
      if (event.pointerId !== dragPointerId) return;
      if (dragCaptured) {
        try {
          rail.releasePointerCapture?.(event.pointerId);
        } catch {}
      }
      rail.classList.remove('is-dragging');
      const delta = dragLastX - dragStartX;
      const crossedDragThreshold = Math.abs(delta) >= 44;
      rail.style.removeProperty('--lotbi-orbit-drag-x');

      const selectedDifferentCard = !cancelled
        && !crossedDragThreshold
        && Number.isInteger(pointerOriginIndex)
        && pointerOriginIndex !== activeIndex;

      if (cancelled) {
        applyOrbitState();
      } else if (crossedDragThreshold) {
        setActiveIndex(activeIndex + (delta < 0 ? 1 : -1));
      } else if (Number.isInteger(pointerOriginIndex)) {
        setActiveIndex(pointerOriginIndex);
      } else {
        applyOrbitState();
      }

      if (!cancelled && (dragMoved || selectedDifferentCard)) {
        suppressClick = true;
        globalThis.setTimeout?.(() => { suppressClick = false; }, 0);
      }
      dragPointerId = null;
      pointerOriginIndex = null;
      dragMoved = false;
      dragCaptured = false;
    };

    rail.addEventListener('pointerup', event => finishDrag(event));
    rail.addEventListener('pointercancel', event => finishDrag(event, {cancelled: true}));

    applyOrbitState();
    return rail;
  };

  const normalizeConversationCalendarResult = value => {
    if (!value || typeof value !== 'object') return null;
    const scope = String(value.scope || '').trim().toUpperCase();
    const stateName = String(value.state || 'REGISTERED').trim().toUpperCase();
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const dateHint = typeof value.dateHint === 'string' ? value.dateHint.trim() : '';
    const timezoneName = typeof value.timezone === 'string' ? value.timezone.trim() : '';
    if (!['AUTH', 'GUEST'].includes(scope) || !['REGISTERED', 'DELETED'].includes(stateName) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(dateHint) || !timezoneName) return null;
    if (scope === 'AUTH') {
      const activityId = typeof value.activityId === 'string' ? value.activityId.trim() : '';
      const occurrenceId = typeof value.occurrenceId === 'string' ? value.occurrenceId.trim() : '';
      if (!/^activity_[0-9a-f]{32}$/.test(activityId) || !/^occurrence_[0-9a-f]{32}$/.test(occurrenceId)) return null;
      return Object.freeze({scope, state: stateName, title, dateHint, timezone: timezoneName, activityId, occurrenceId});
    }
    const guestEventId = typeof value.guestEventId === 'string' ? value.guestEventId.trim() : '';
    if (!/^guest_[0-9a-f-]{36}$/i.test(guestEventId)) return null;
    return Object.freeze({scope, state: stateName, title, dateHint, timezone: timezoneName, guestEventId});
  };

  const calendarResultKey = result => result?.scope === 'AUTH' ? `AUTH:${result.activityId}` : `GUEST:${result?.guestEventId || ''}`;
  const normalizeConversationCalendarDraft = value => {
    if (!value || typeof value !== 'object') return null;
    try {
      return normalizeSmartCalendarDraft({
        contract_id: value.contractId,
        schema_version: value.schemaVersion,
        source_kind: value.sourceKind,
        requires_user_confirmation: value.requiresUserConfirmation,
        automatic_write: value.automaticWrite,
        title: value.title,
        local_date: value.localDate,
        local_time: value.localTime,
        entry: value.entry && typeof value.entry === 'object' ? {
          amount_minor: value.entry.amountMinor,
          currency: value.entry.currency,
          expense_category: value.entry.expenseCategory,
          memo: value.entry.memo,
          place: value.entry.place,
          merchant: value.entry.merchant,
        } : null,
        source_attachment_ids: value.sourceAttachmentIds,
      });
    } catch {
      return null;
    }
  };

  const calendarDraftWhen = draft => {
    if (!draft?.localDate) return '날짜 미정';
    return draft.localTime ? `${draft.localDate} · ${draft.localTime}` : draft.localDate;
  };

  const createConversationCalendarDraft = draftValue => {
    const draft = normalizeConversationCalendarDraft(draftValue);
    if (!draft) return null;
    const row = document.createElement('section');
    row.className = 'conversation-calendar-action conversation-calendar-draft';
    row.dataset.calendarDraft = 'review-required';
    row.setAttribute('aria-label', '저장 전 확인이 필요한 캘린더 초안');

    const summary = document.createElement('div');
    summary.className = 'conversation-calendar-action-summary';
    const icon = document.createElement('span');
    icon.className = 'conversation-calendar-action-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '📅';
    const copy = document.createElement('div');
    copy.className = 'conversation-calendar-action-copy';
    const title = document.createElement('strong');
    title.textContent = draft.title || '제목 확인 필요';
    const when = document.createElement('span');
    when.textContent = calendarDraftWhen(draft);
    const details = [];
    if (Number.isInteger(draft.entry?.amountMinor)) details.push(new Intl.NumberFormat('ko-KR').format(draft.entry.amountMinor) + '원');
    if (draft.entry?.place) details.push(draft.entry.place);
    if (draft.entry?.merchant) details.push(draft.entry.merchant);
    const note = document.createElement('small');
    note.textContent = details.length ? details.join(' · ') : '이미지에서 추출한 편집 가능한 초안';
    copy.append(title, when, note);
    summary.append(icon, copy);

    const status = document.createElement('div');
    status.className = 'conversation-calendar-action-status';
    status.textContent = '저장 전 확인 필요';

    const controls = document.createElement('div');
    controls.className = 'conversation-calendar-action-controls';
    const review = document.createElement('button');
    review.type = 'button';
    review.className = 'conversation-calendar-action-button';
    review.textContent = '초안 확인 · 편집';
    review.addEventListener('click', async () => {
      if (!sessionToken) {
        try {
          await beginGuestClaimingSiteHandoff('캘린더 초안 확인');
        } catch (error) {
          setStatus(error instanceof Error ? error.message : '로그인 연결을 시작하지 못했습니다.');
        }
        return;
      }
      await openCalendar(draft.localDate ? 'month' : 'agenda', {
        initialDraft: draft,
        restoreConversation: true,
      });
    });
    controls.appendChild(review);
    row.append(summary, status, controls);
    return row;
  };


  const persistConversationCalendarResult = value => {
    const result = normalizeConversationCalendarResult(value);
    if (!result) return null;
    const key = calendarResultKey(result);
    let changed = false;
    for (const record of state.threads) {
      if (!Array.isArray(record.messages)) continue;
      record.messages = record.messages.map(message => {
        const current = normalizeConversationCalendarResult(message?.meta?.calendarResult);
        if (!current || calendarResultKey(current) !== key) return message;
        changed = true;
        return {...message, meta: {...message.meta, calendarResult: result}};
      });
      if (changed) record.updatedAt = Date.now();
    }
    if (changed) {
      sortThreads();
      saveState();
      renderRecent();
    }
    return result;
  };

  const normalizeConversationCalendarItem = value => {
    if (!value || typeof value !== 'object') return null;
    if (value.kind === 'ACTION') {
      const action = normalizePersistedCalendarAction(value.action);
      return action ? Object.freeze({kind: 'ACTION', action}) : null;
    }
    if (value.kind === 'PARTIAL') {
      try {
        const candidate = normalizeCalendarPartialCandidate(value.candidate);
        return candidate ? Object.freeze({kind: 'PARTIAL', candidate}) : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const recoverConversationCalendarItemAfterReload = value => {
    const item = normalizeConversationCalendarItem(value);
    if (!item) return null;
    if (item.kind === 'PARTIAL') return item;
    const action = recoverCalendarActionAfterReload(item.action);
    return action ? Object.freeze({kind: 'ACTION', action}) : null;
  };

  const conversationCalendarItemsFromResponse = (response, scope) => {
    const set = response?.calendarCandidateSet;
    if (!set || !Array.isArray(set.candidates)) return [];
    return set.candidates.map(member => {
      if (member?.kind === 'COMPLETE') {
        const action = createAvailableCalendarAction(member.candidate, {scope, ownerNamespace: namespace});
        return action ? Object.freeze({kind: 'ACTION', action}) : null;
      }
      if (member?.kind === 'PARTIAL') {
        try {
          const candidate = normalizeCalendarPartialCandidate(member.candidate);
          return candidate ? Object.freeze({kind: 'PARTIAL', candidate}) : null;
        } catch {
          return null;
        }
      }
      return null;
    }).filter(Boolean).slice(0, 4);
  };

  const persistConversationCalendarAction = actionValue => {
    const action = normalizePersistedCalendarAction(actionValue);
    if (!action) return null;
    let changed = false;
    for (const record of state.threads) {
      if (!Array.isArray(record.messages)) continue;
      let recordChanged = false;
      record.messages = record.messages.map(message => {
        if (!message?.meta || typeof message.meta !== 'object') return message;
        let messageChanged = false;
        const nextMeta = {...message.meta};
        if (nextMeta.calendarAction?.actionId === action.actionId) {
          nextMeta.calendarAction = action;
          messageChanged = true;
        }
        if (Array.isArray(nextMeta.calendarItems)) {
          const nextItems = nextMeta.calendarItems.map(item => {
            if (item?.kind !== 'ACTION' || item?.action?.actionId !== action.actionId) return item;
            messageChanged = true;
            return Object.freeze({kind: 'ACTION', action});
          });
          if (messageChanged) nextMeta.calendarItems = nextItems;
        }
        if (!messageChanged) return message;
        changed = true;
        recordChanged = true;
        return {...message, meta: nextMeta};
      });
      if (recordChanged) record.updatedAt = Date.now();
    }
    if (changed) {
      sortThreads();
      saveState();
      renderRecent();
    }
    return action;
  };

  const calendarPartialCandidateSummary = candidate => {
    const localDate = candidate?.temporal?.localDate || '';
    const localTime = candidate?.temporal?.localTime || '';
    if (localDate) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
      if (match) return `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일 · 시간 필요`;
      return `${localDate} · 시간 필요`;
    }
    if (localTime) {
      const match = /^(\d{2}):(\d{2}):\d{2}$/.exec(localTime);
      if (match) {
        const hour = Number(match[1]);
        const period = hour < 12 ? '오전' : '오후';
        const displayHour = hour % 12 || 12;
        const minute = Number(match[2]);
        return `${period} ${displayHour}시${minute ? ` ${minute}분` : ''} · 날짜 필요`;
      }
      return `${localTime} · 날짜 필요`;
    }
    return '날짜와 시간을 확인해 주세요';
  };

  const calendarCandidateSummary = candidate => {
    const value = candidate?.temporal?.localDatetime || '';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}$/.exec(value);
    if (!match) return value;
    const hour = Number(match[4]);
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour % 12 || 12;
    const minute = Number(match[5]);
    const minuteText = minute ? ` ${minute}분` : '';
    return `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일 ${period} ${displayHour}시${minuteText}`;
  };

  const viewConversationCalendarAction = async (actionValue, row, render) => {
    const action = normalizePersistedCalendarAction(actionValue);
    if (!action || (action.state !== 'SUCCESS' && action.state !== 'DELETED') || !action.result) return;
    if (action.state === 'DELETED') {
      setStatus('삭제된 일정입니다.');
      return;
    }
    const opened = await openCalendar('month', {
      deepOpen: Object.freeze({
        scope: action.scope,
        activityId: action.result.activityId || '',
        occurrenceId: action.result.occurrenceId || '',
        guestEventId: action.result.guestEventId || '',
        dateHint: action.result.dateHint,
        timezone: action.result.timezone,
      }),
      restoreConversation: true,
    });
    if (opened?.deepOpenState === 'deleted') {
      const deleted = Object.freeze({...action, state: 'DELETED'});
      persistConversationCalendarAction(deleted);
      if (row.isConnected) render(deleted);
      setStatus('삭제된 일정입니다.');
    }
  };

  const executeConversationCalendarAction = async (actionValue, row, render) => {
    const current = normalizePersistedCalendarAction(actionValue);
    if (!current || current.state === 'SUCCESS' || current.state === 'DELETED' || current.state === 'IN_FLIGHT') return;
    const inFlightAction = calendarActionInFlight(current);
    if (!inFlightAction) return;
    persistConversationCalendarAction(inFlightAction);
    render(inFlightAction);
    setStatus(current.state === 'UNKNOWN_RESULT' ? '일정 등록 결과를 확인하고 있습니다.' : '일정을 등록하고 있습니다.');
    const result = await runCalendarAction(inFlightAction, {
      sessionToken,
      currentNamespace: namespace,
      storage,
    });
    if (!row.isConnected || !result) return;
    const persisted = persistConversationCalendarAction(result) || result;
    render(persisted);
    if (persisted.state === 'SUCCESS') {
      window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
      setStatus('캘린더에 등록했습니다.');
    } else if (persisted.state === 'UNKNOWN_RESULT') {
      setStatus('등록 결과를 아직 확인하지 못했습니다. 같은 요청으로 결과를 확인할 수 있습니다.');
    } else {
      setStatus(persisted.lastError?.message || '일정을 등록하지 못했습니다.');
    }
  };

  const viewConversationCalendarResult = async (resultValue, row, render) => {
    const result = normalizeConversationCalendarResult(resultValue);
    if (!result) return;
    if (result.state === 'DELETED') {
      setStatus('삭제된 일정입니다.');
      return;
    }
    const opened = await openCalendar('month', {
      deepOpen: Object.freeze({
        scope: result.scope,
        activityId: result.activityId || '',
        occurrenceId: result.occurrenceId || '',
        guestEventId: result.guestEventId || '',
        dateHint: result.dateHint,
        timezone: result.timezone,
      }),
      restoreConversation: true,
    });
    if (opened?.deepOpenState === 'deleted') {
      const deleted = Object.freeze({...result, state: 'DELETED'});
      persistConversationCalendarResult(deleted);
      if (row.isConnected) render(deleted);
      setStatus('삭제된 일정입니다.');
    }
  };

  const createConversationCalendarResult = resultValue => {
    const initial = normalizeConversationCalendarResult(resultValue);
    if (!initial) return null;
    const row = document.createElement('section');
    row.className = 'conversation-calendar-action';
    row.dataset.calendarResult = calendarResultKey(initial);
    row.setAttribute('aria-label', '등록된 캘린더 일정');

    const render = nextValue => {
      const result = normalizeConversationCalendarResult(nextValue);
      if (!result) { row.remove(); return; }
      const summary = document.createElement('div');
      summary.className = 'conversation-calendar-action-summary';
      const icon = document.createElement('span');
      icon.className = 'conversation-calendar-action-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '📅';
      const copy = document.createElement('div');
      copy.className = 'conversation-calendar-action-copy';
      const title = document.createElement('strong'); title.textContent = result.title;
      const when = document.createElement('span'); when.textContent = result.dateHint;
      const zone = document.createElement('small'); zone.textContent = result.timezone;
      copy.append(title, when, zone);
      summary.append(icon, copy);

      const status = document.createElement('div');
      status.className = 'conversation-calendar-action-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const controls = document.createElement('div');
      controls.className = 'conversation-calendar-action-controls';
      if (result.state === 'DELETED') {
        status.textContent = '삭제된 일정입니다';
      } else {
        status.textContent = '✓ 등록됨';
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'conversation-calendar-action-button';
        view.textContent = '캘린더에서 보기';
        view.addEventListener('click', () => void viewConversationCalendarResult(result, row, render));
        controls.appendChild(view);
      }
      row.replaceChildren(summary, status, controls);
    };
    render(initial);
    return row;
  };

  const createConversationCalendarPartial = candidateValue => {
    let candidate;
    try {
      candidate = normalizeCalendarPartialCandidate(candidateValue);
    } catch {
      return null;
    }
    if (!candidate) return null;
    const row = document.createElement('section');
    row.className = 'conversation-calendar-action conversation-calendar-partial';
    row.dataset.calendarCandidateId = candidate.candidateId;
    row.setAttribute('aria-label', '추가 정보가 필요한 캘린더 일정 후보');

    const summary = document.createElement('div');
    summary.className = 'conversation-calendar-action-summary';
    const icon = document.createElement('span');
    icon.className = 'conversation-calendar-action-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '📅';
    const copy = document.createElement('div');
    copy.className = 'conversation-calendar-action-copy';
    const title = document.createElement('strong');
    title.textContent = candidate.title;
    const when = document.createElement('span');
    when.textContent = calendarPartialCandidateSummary(candidate);
    const zone = document.createElement('small');
    zone.textContent = candidate.temporal.timezoneName;
    copy.append(title, when, zone);
    summary.append(icon, copy);

    const status = document.createElement('div');
    status.className = 'conversation-calendar-action-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = candidate.missingFields.includes('time')
      ? '등록하려면 시간을 알려주세요.'
      : '등록하려면 날짜를 알려주세요.';

    const guide = document.createElement('div');
    guide.className = 'conversation-calendar-partial-guide';
    guide.textContent = '빠진 정보를 대화에서 알려주면 일정 후보를 다시 확인할 수 있어요.';
    row.replaceChildren(summary, status, guide);
    return row;
  };

  const createConversationCalendarAction = actionValue => {
    const initial = normalizePersistedCalendarAction(actionValue);
    if (!initial) return null;
    const row = document.createElement('section');
    row.className = 'conversation-calendar-action';
    row.dataset.calendarActionId = initial.actionId;
    row.setAttribute('aria-label', '캘린더 일정 작업');

    const render = nextValue => {
      const action = normalizePersistedCalendarAction(nextValue);
      if (!action) {
        row.remove();
        return;
      }
      row.dataset.calendarActionState = action.state;
      const summary = document.createElement('div');
      summary.className = 'conversation-calendar-action-summary';
      const icon = document.createElement('span');
      icon.className = 'conversation-calendar-action-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '📅';
      const copy = document.createElement('div');
      copy.className = 'conversation-calendar-action-copy';
      const title = document.createElement('strong');
      title.textContent = action.candidate.title;
      const when = document.createElement('span');
      when.textContent = calendarCandidateSummary(action.candidate);
      const zone = document.createElement('small');
      zone.textContent = action.candidate.temporal.timezoneName;
      copy.append(title, when, zone);
      summary.append(icon, copy);

      const status = document.createElement('div');
      status.className = 'conversation-calendar-action-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const controls = document.createElement('div');
      controls.className = 'conversation-calendar-action-controls';

      if (action.state === 'AVAILABLE') {
        const add = document.createElement('button');
        add.type = 'button'; add.className = 'conversation-calendar-action-button';
        add.textContent = '캘린더에 등록';
        add.setAttribute('aria-label', `${action.candidate.title} 일정을 캘린더에 등록`);
        add.addEventListener('click', () => void executeConversationCalendarAction(action, row, render));
        controls.appendChild(add);
      } else if (action.state === 'IN_FLIGHT') {
        status.textContent = '등록 중…';
        row.setAttribute('aria-busy', 'true');
        const pending = document.createElement('button');
        pending.type = 'button'; pending.className = 'conversation-calendar-action-button'; pending.disabled = true; pending.textContent = '등록 중…';
        controls.appendChild(pending);
      } else if (action.state === 'SUCCESS') {
        status.textContent = '✓ 등록됨';
        const view = document.createElement('button');
        view.type = 'button'; view.className = 'conversation-calendar-action-button';
        view.textContent = '캘린더에서 보기';
        view.addEventListener('click', () => void viewConversationCalendarAction(action, row, render));
        controls.appendChild(view);
      } else if (action.state === 'UNKNOWN_RESULT') {
        status.textContent = '등록 결과를 확인하고 있어요';
        const verify = document.createElement('button');
        verify.type = 'button'; verify.className = 'conversation-calendar-action-button';
        verify.textContent = '결과 확인';
        verify.addEventListener('click', () => void executeConversationCalendarAction(action, row, render));
        controls.appendChild(verify);
      } else if (action.state === 'DEFINITE_FAILURE') {
        status.textContent = action.lastError?.message || '일정을 등록하지 못했습니다.';
        const retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'conversation-calendar-action-button';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', () => void executeConversationCalendarAction(action, row, render));
        controls.appendChild(retry);
      } else if (action.state === 'DELETED') {
        status.textContent = '삭제된 일정입니다';
      }
      if (action.state !== 'IN_FLIGHT') row.removeAttribute('aria-busy');
      row.replaceChildren(summary, status, controls);
    };
    render(initial);
    return row;
  };

  const messageNode = message => {
    const node = createMessage(message.role, message.text, message.meta || {});
    const rich = compactRichProductMeta(message.meta?.richProduct);
    const place = normalizedPersistedPlaceResult(message.meta?.placeResult);
    if (message.role === 'assistant' && rich) {
      const rail = createProductCardRail(rich); if (rail) node.appendChild(rail);
    }
    if (message.role === 'assistant' && place) {
      const rail = createPlaceCardRail(message.meta?.placeResult); if (rail) node.appendChild(rail);
    }
    if (message.role === 'assistant' && Array.isArray(message.meta?.calendarItems)) {
      for (const rawItem of message.meta.calendarItems) {
        const item = normalizeConversationCalendarItem(rawItem);
        if (!item) continue;
        const calendarNode = item.kind === 'ACTION'
          ? createConversationCalendarAction(item.action)
          : createConversationCalendarPartial(item.candidate);
        if (calendarNode) node.appendChild(calendarNode);
      }
    } else if (message.role === 'assistant' && message.meta?.calendarAction) {
      const calendarAction = createConversationCalendarAction(message.meta.calendarAction);
      if (calendarAction) node.appendChild(calendarAction);
    }
    if (message.role === 'assistant' && message.meta?.calendarResult) {
      const calendarResult = createConversationCalendarResult(message.meta.calendarResult);
      if (calendarResult) node.appendChild(calendarResult);
    }
    if (message.role === 'assistant' && message.meta?.calendarDraft) {
      const calendarDraft = createConversationCalendarDraft(message.meta.calendarDraft);
      if (calendarDraft) node.appendChild(calendarDraft);
    }
    return node;
  };
  const appendConversationRecord = (message, options = {}) => {
    if (shouldShowConversationSeparator(lastRenderedCreatedAt, message?.createdAt)) {
      const separator = createConversationSeparator(message.createdAt);
      if (separator) appendNode(separator, {suppressScroll: true});
    }
    if (Number.isFinite(Number(message?.createdAt)) && Number(message.createdAt) > 0) {
      lastRenderedCreatedAt = Number(message.createdAt);
    }
    return appendNode(messageNode(message), options);
  };
  const renderActiveThread = () => {
    restoreAvatarHome(); thread.replaceChildren();
    lastRenderedCreatedAt = undefined;
    const record = threadRecord();
    if (!record || !record.messages.length) { showBlankHome(); return; }
    showThread();
    for (const message of record.messages) {
      appendConversationRecord(message, {suppressScroll: true});
    }
    scrollThread();
  };
  const closeMobileDrawer = () => {
    const close = document.querySelector('[data-mobile-nav-close]');
    if (document.body.classList.contains('nav-drawer-open') && close instanceof HTMLButtonElement) close.click();
  };
  const activateThread = id => {
    if (!state.threads.some(item => item.id === id)) return;
    closeConversationMenus();
    state.activeThreadId = id; saveState(); renderActiveThread(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const startNewConversation = () => {
    closeConversationMenus();
    discardPendingAttachments();
    state.activeThreadId = null; state.draft = ''; prompt.value = '';
    prompt.dispatchEvent(new Event('input', {bubbles: true})); saveState(); showBlankHome(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const ensureThread = firstMessage => {
    let record = threadRecord(); if (record) return record;
    record = {id: newId('thread'), title: titleFromMessage(firstMessage), pinned: false, pinnedAt: 0, stateVersion: 0, createdAt: Date.now(), updatedAt: Date.now(), messages: []};
    state.activeThreadId = record.id; state.threads.unshift(record); sortThreads(); state.threads = state.threads.slice(0, THREAD_LIMIT);
    saveState(); renderRecent(); return record;
  };
  const validThread = value => value && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.messages);
  const normalizeStoredMessage = value => {
    if (!value || typeof value !== 'object' || !['user', 'assistant'].includes(value.role) || typeof value.text !== 'string') return null;
    const meta = value.meta && typeof value.meta === 'object' ? {...value.meta} : {};
    if ('calendarAction' in meta) {
      const recovered = recoverCalendarActionAfterReload(meta.calendarAction);
      if (recovered) meta.calendarAction = recovered;
      else delete meta.calendarAction;
    }
    if ('calendarItems' in meta) {
      const items = Array.isArray(meta.calendarItems)
        ? meta.calendarItems.map(recoverConversationCalendarItemAfterReload).filter(Boolean).slice(0, 4)
        : [];
      if (items.length) meta.calendarItems = items;
      else delete meta.calendarItems;
    }
    if ('calendarResult' in meta) {
      const result = normalizeConversationCalendarResult(meta.calendarResult);
      if (result) meta.calendarResult = result;
      else delete meta.calendarResult;
    }
    if ('calendarDraft' in meta) {
      const draft = normalizeConversationCalendarDraft(meta.calendarDraft);
      if (draft) meta.calendarDraft = draft;
      else delete meta.calendarDraft;
    }
    return {...value, meta};
  };
  const normalizeStoredThread = value => {
    if (!validThread(value)) return null;
    return {
      ...value,
      title: normalizedThreadTitle(value.title) || '새 대화',
      pinned: value.pinned === true,
      pinnedAt: value.pinned === true && Number.isFinite(Number(value.pinnedAt)) ? Number(value.pinnedAt) : 0,
      stateVersion: Number.isInteger(value.stateVersion) && value.stateVersion >= 0 ? value.stateVersion : 0,
      messages: value.messages.map(normalizeStoredMessage).filter(Boolean).slice(-MESSAGE_LIMIT),
    };
  };
  const switchNamespace = nextNamespace => {
    const normalized = normalizedNamespace(nextNamespace);
    if (!normalized || (normalized === namespace && stateReady)) return;
    namespace = normalized;
    const loadedState = safeParse(storage?.getItem(storageKey(namespace, 'threads')), {});
    const loadedPreferences = safeParse(storage?.getItem(storageKey(namespace, 'preferences')), {});
    const restoredThreads = Array.isArray(loadedState.threads)
      ? loadedState.threads.map(normalizeStoredThread).filter(Boolean).slice(0, THREAD_LIMIT)
      : [];
    const visibleThreads = normalized === anonymousConversationNamespace()
      ? restoredThreads.filter(item => (
        item.guestClaimConsumed !== true
        && !guestConversationThreadClaimed({
          anonymousNamespace: normalized,
          threadId: item.id,
          durableStorage: storage,
        })
      ))
      : restoredThreads;
    const restoredActiveThreadId = Object.prototype.hasOwnProperty.call(loadedState, 'activeThreadId')
      ? loadedState.activeThreadId
      : undefined;
    state = {
      threads: visibleThreads,
      activeThreadId: null,
      draft: typeof loadedState.draft === 'string' ? loadedState.draft.slice(0, 1000) : '',
    };
    sortThreads();
    state.activeThreadId = resolveRestoredActiveThreadId(restoredActiveThreadId, state.threads);
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
  const canonicalProfileName = () => {
    if (serverIdentity?.name) return serverIdentity.name;
    if (serverIdentity?.publicHandle) return serverIdentity.publicHandle;
    const emailLocalPart = serverIdentity?.email?.split('@', 1)[0]?.trim();
    return emailLocalPart || 'LOTBI 사용자';
  };
  const profileVisual = () => {
    const visual = document.createElement(preferences.photo ? 'img' : 'span');
    visual.className = 'sidebar-profile-avatar';
    if (visual instanceof HTMLImageElement) { visual.src = preferences.photo; visual.alt = ''; }
    else { visual.textContent = initials(canonicalProfileName()); visual.setAttribute('aria-hidden', 'true'); }
    return visual;
  };
  const profileButton = () => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sidebar-account-entry sidebar-profile-trigger';
    button.dataset.profileMenuTrigger = ''; button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '프로필 메뉴 열기');
    const copy = document.createElement('span'); copy.className = 'sidebar-profile-copy';
    const name = document.createElement('span'); name.className = 'sidebar-account-name'; name.textContent = canonicalProfileName();
    copy.appendChild(name);
    if (serverIdentity?.publicHandle) {
      const handle = document.createElement('span'); handle.className = 'sidebar-account-handle'; handle.textContent = `@${serverIdentity.publicHandle}`; copy.appendChild(handle);
    }
    button.append(profileVisual(), copy); return button;
  };
  const profileSummary = () => {
    const summary = document.createElement('div'); summary.className = 'profile-popover-summary'; summary.setAttribute('role', 'presentation');
    const copy = document.createElement('div'); copy.className = 'profile-popover-summary-copy';
    const name = document.createElement('strong'); name.className = 'profile-popover-summary-name'; name.textContent = canonicalProfileName();
    copy.appendChild(name);
    if (serverIdentity?.publicHandle) {
      const handle = document.createElement('span'); handle.className = 'profile-popover-summary-handle'; handle.textContent = `@${serverIdentity.publicHandle}`; copy.appendChild(handle);
    }
    if (serverIdentity?.email) {
      const email = document.createElement('span'); email.className = 'profile-popover-summary-email'; email.textContent = serverIdentity.email; copy.appendChild(email);
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
    const onClose = surfaceCloseCallback;
    openSurface.remove(); openSurface = undefined; openSurfaceTrigger = undefined; surfaceCloseCallback = undefined; document.body.classList.remove('site-overlay-open');
    if (typeof onClose === 'function') {
      try { onClose(); } catch {}
    }
    if (surfaceRestoreFocus instanceof HTMLElement && surfaceRestoreFocus.isConnected) surfaceRestoreFocus.focus();
    surfaceRestoreFocus = undefined;
  };
  const installSurfaceBehavior = (surface, panel, {modal = false, trigger, onClose} = {}) => {
    closeSurface(); openSurface = surface; openSurfaceTrigger = trigger; surfaceRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; surfaceCloseCallback = typeof onClose === 'function' ? onClose : undefined;
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
  const openRenameThread = id => {
    const record = state.threads.find(item => item.id === id); if (!record) return;
    const {backdrop, panel, content} = modalShell('대화 이름 바꾸기', '이 이름은 현재 브라우저의 이 대화에만 저장됩니다.');
    const label = document.createElement('label'); label.className = 'site-field'; label.textContent = '대화 이름';
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = THREAD_TITLE_LIMIT; input.value = record.title; input.autocomplete = 'off'; label.appendChild(input);
    const error = document.createElement('p'); error.className = 'site-field-error'; error.setAttribute('role', 'alert');
    const actions = document.createElement('div'); actions.className = 'conversation-management-modal-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'site-button site-button-secondary'; cancel.textContent = '취소'; cancel.addEventListener('click', closeSurface);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'site-button site-button-primary'; save.textContent = '저장';
    const commit = () => {
      const title = normalizedThreadTitle(input.value);
      if (!title) { error.textContent = '대화 이름을 입력해 주세요.'; input.focus(); return; }
      record.title = title; saveState(); closeSurface(); renderRecent(); setStatus('대화 이름을 바꿨습니다.');
    };
    save.addEventListener('click', commit);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); commit(); }
    });
    actions.append(cancel, save); content.append(label, error, actions); installSurfaceBehavior(backdrop, panel, {modal: true});
    queueMicrotask(() => { input.focus(); input.select(); });
  };
  const openDeleteThread = id => {
    const record = state.threads.find(item => item.id === id); if (!record) return;
    const {backdrop, panel, content} = modalShell('대화 삭제', `“${record.title}” 대화를 이 브라우저에서 삭제합니다. 이 작업은 되돌릴 수 없습니다.`);
    const actions = document.createElement('div'); actions.className = 'conversation-management-modal-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'site-button site-button-secondary'; cancel.textContent = '취소'; cancel.addEventListener('click', closeSurface);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'site-button conversation-delete-confirm'; remove.textContent = '삭제';
    remove.addEventListener('click', () => {
      const deletingActive = state.activeThreadId === id;
      state.threads = state.threads.filter(item => item.id !== id);
      if (deletingActive) {
        state.activeThreadId = null; state.draft = ''; prompt.value = '';
        prompt.dispatchEvent(new Event('input', {bubbles: true}));
      }
      saveState(); closeSurface();
      if (deletingActive) showBlankHome();
      renderRecent(); setStatus('대화를 삭제했습니다.');
      if (deletingActive) prompt.focus();
    });
    actions.append(cancel, remove); content.appendChild(actions); installSurfaceBehavior(backdrop, panel, {modal: true});
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
    const {backdrop, panel, content} = modalShell('프로필', '표시 이름·공개 아이디·이메일은 LOTBI 계정의 canonical 정보이며 모든 기기에서 동일하게 사용됩니다. 사진만 이 브라우저에 저장됩니다.');
    const preview = document.createElement('div'); preview.className = 'profile-photo-preview'; preview.textContent = initials(canonicalProfileName());
    if (preferences.photo) preview.style.backgroundImage = `url(${preferences.photo})`;
    const photoLabel = document.createElement('label'); photoLabel.className = 'site-button site-button-secondary'; photoLabel.textContent = '사진 선택';
    const photo = document.createElement('input'); photo.type = 'file'; photo.accept = 'image/jpeg,image/png,image/webp'; photo.className = 'sr-only'; photoLabel.appendChild(photo);
    const error = document.createElement('p'); error.className = 'site-field-error'; error.setAttribute('role', 'alert');

    const nameLabel = document.createElement('label'); nameLabel.className = 'site-field'; nameLabel.textContent = '표시 이름';
    const name = document.createElement('input'); name.type = 'text'; name.maxLength = 120; name.value = serverIdentity?.name || canonicalProfileName(); name.autocomplete = 'name'; nameLabel.appendChild(name);
    const handleLabel = document.createElement('label'); handleLabel.className = 'site-field'; handleLabel.textContent = '공개 아이디';
    const handle = document.createElement('input'); handle.type = 'text'; handle.minLength = 8; handle.maxLength = 64; handle.value = serverIdentity?.publicHandle || ''; handle.autocomplete = 'off'; handle.autocapitalize = 'none'; handle.spellcheck = false;
    handle.addEventListener('input', () => { handle.value = handle.value.replace(/[^A-Za-z0-9]/g, ''); });
    handleLabel.appendChild(handle);
    const handleHelp = document.createElement('p'); handleHelp.className = 'site-field-help'; handleHelp.textContent = '영문·숫자 8~64자이며 각각 최소 1자를 포함해야 합니다. 이미 사용 중이면 다른 아이디를 선택해야 합니다.';
    const emailField = document.createElement('div'); emailField.className = 'site-readonly-field';
    const emailTitle = document.createElement('strong'); emailTitle.textContent = '이메일';
    const emailValue = document.createElement('span'); emailValue.textContent = serverIdentity?.email || '등록된 이메일 없음'; emailField.append(emailTitle, emailValue);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'site-button site-button-primary'; save.textContent = '프로필 저장';
    save.disabled = !sessionToken;

    photo.addEventListener('change', async () => {
      const file = photo.files?.[0]; if (!file) return; error.textContent = '';
      try {
        preferences.photo = await readProfilePhoto(file);
        savePreferences();
        preview.style.backgroundImage = `url(${preferences.photo})`;
        refreshAuthenticatedProfileSlots();
      } catch (caught) { error.textContent = caught instanceof Error ? caught.message : '이미지를 처리하지 못했습니다.'; }
    });
    save.addEventListener('click', async () => {
      if (!sessionToken || save.disabled) return;
      error.textContent = ''; save.disabled = true; save.textContent = '저장 중…';
      try {
        const normalizedHandle = handle.value.trim().toLowerCase();
        const currentHandle = serverIdentity?.publicHandle || '';
        const updated = await updateCurrentSiteProfile(sessionToken, {
          displayName: name.value,
          ...(normalizedHandle && normalizedHandle !== currentHandle ? {publicHandle: normalizedHandle} : {}),
        });
        serverIdentity = Object.freeze({...serverIdentity, ...updated});
        name.value = serverIdentity.name || canonicalProfileName();
        handle.value = serverIdentity.publicHandle || '';
        emailValue.textContent = serverIdentity.email || '등록된 이메일 없음';
        preview.textContent = initials(canonicalProfileName());
        refreshAuthenticatedProfileSlots();
        save.textContent = '저장됨';
      } catch (caught) {
        if (caught?.code === 'PUBLIC_HANDLE_TAKEN') error.textContent = '이미 사용 중인 공개 아이디입니다. 다른 아이디를 입력해주세요.';
        else if (caught?.code === 'PUBLIC_HANDLE_RESERVED') error.textContent = '사용할 수 없는 공개 아이디입니다. 다른 아이디를 입력해주세요.';
        else error.textContent = caught instanceof Error ? caught.message : '프로필을 저장하지 못했습니다.';
        save.textContent = '프로필 저장';
      } finally {
        save.disabled = false;
      }
    });
    const manage = document.createElement('a'); manage.className = 'site-button site-button-secondary'; manage.href = 'https://account.lotbiai.com/account'; manage.textContent = '계정 페이지에서 관리';
    content.append(preview, photoLabel, error, nameLabel, handleLabel, handleHelp, emailField, save, manage); installSurfaceBehavior(backdrop, panel, {modal: true});
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
  const openCalendar = async (view, {deepOpen, initialDraft = null, restoreConversation = false} = {}) => {
    const allowed = new Set(['month', 'year', 'agenda', 'attention', 'all', 'today', 'upcoming', 'date']);
    const initialView = allowed.has(view) ? view : 'month';
    closeMobileDrawer();

    const returnState = restoreConversation ? Object.freeze({
      namespace,
      threadId: state.activeThreadId,
      scrollTop: mainScrollHost.scrollTop,
      draft: prompt.value,
    }) : null;

    const {backdrop, panel, content} = modalShell(
      '캘린더',
      sessionToken
        ? 'LOTBI에 등록된 개인 일정을 확인하고 관리합니다.'
        : '로그인 없이 캘린더를 확인할 수 있습니다. 계정 동기화는 로그인 후 사용할 수 있어요.',
    );
    panel.classList.add('site-calendar-modal');
    installSurfaceBehavior(backdrop, panel, {
      modal: true,
      onClose: returnState ? () => {
        if (namespace !== returnState.namespace) return;
        if (returnState.threadId && state.threads.some(item => item.id === returnState.threadId)) {
          state.activeThreadId = returnState.threadId;
          state.draft = returnState.draft.slice(0, 1000);
          prompt.value = state.draft;
          prompt.dispatchEvent(new Event('input', {bubbles: true}));
          saveState();
          renderActiveThread();
          requestAnimationFrame(() => { mainScrollHost.scrollTop = returnState.scrollTop; });
        }
      } : undefined,
    });
    const mounted = await mountLifeCalendarManager({
      sessionToken,
      root: content,
      initialView,
      deepOpen,
      initialDraft,
    });
    if (!mounted) {
      const message = document.createElement('p');
      message.className = 'life-calendar-error';
      message.textContent = '캘린더를 열지 못했습니다.';
      content.replaceChildren(message);
    }
    return Object.freeze({
      mounted: Boolean(mounted),
      deepOpenState: content.dataset.calendarDeepOpen || '',
    });
  };

  const bindCalendarEntries = () => {
    for (const calendarEntry of document.querySelectorAll('[data-calendar-view]')) {
      if (!(calendarEntry instanceof HTMLButtonElement) || calendarEntry.dataset.calendarEntryBound === 'true') continue;
      calendarEntry.dataset.calendarEntryBound = 'true';
      calendarEntry.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void openCalendar(calendarEntry.dataset.calendarView || 'all');
      });
    }
  };
  bindCalendarEntries();

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-calendar-view]') : null;
    if (!(target instanceof HTMLButtonElement)) return;
    event.preventDefault();
    void openCalendar(target.dataset.calendarView || 'all');
  });

  const openLotbiBox = trigger => {
    closeMobileDrawer();
    const {backdrop, panel, content} = modalShell('롯비함', '나중에 다시 볼 항목을 모아두는 곳이에요.');
    panel.classList.add('site-lotbi-box-modal');
    const list = document.createElement('div');
    list.className = 'lotbi-box-list';
    list.setAttribute('aria-live', 'polite');

    const render = () => {
      const items = loadLotbiBox();
      if (!items.length) {
        const empty = document.createElement('div'); empty.className = 'lotbi-box-empty';
        const title = document.createElement('strong'); title.textContent = '아직 롯비함에 담은 항목이 없어요.';
        const copy = document.createElement('p'); copy.textContent = '검색 결과에서 “+ 롯비함”을 눌러 저장할 수 있어요.';
        empty.append(title, copy);
        list.replaceChildren(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const item of items) {
        const card = document.createElement('article');
        card.className = 'lotbi-box-card';
        card.dataset.lotbiBoxKey = item.key;

        const media = document.createElement('div'); media.className = 'lotbi-box-card-media';
        const imageUrl = typeof item.image_reference === 'string' && item.image_reference.startsWith('https://') ? item.image_reference : '';
        if (imageUrl) {
          const image = document.createElement('img');
          image.src = imageUrl; image.alt = typeof item.display_title === 'string' ? item.display_title : '저장 상품';
          image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => { image.remove(); media.textContent = '이미지 없음'; media.classList.add('lotbi-box-card-placeholder'); }, {once: true});
          media.appendChild(image);
        } else {
          media.textContent = '이미지 없음'; media.classList.add('lotbi-box-card-placeholder');
        }

        const body = document.createElement('div'); body.className = 'lotbi-box-card-body';
        const source = document.createElement('span'); source.className = 'lotbi-box-card-source';
        source.textContent = typeof item.source === 'string' && item.source.trim() ? item.source.trim() : '판매처';
        const title = document.createElement('h3'); title.className = 'lotbi-box-card-title';
        title.textContent = typeof item.display_title === 'string' && item.display_title.trim() ? item.display_title.trim() : '저장 상품';
        body.append(source, title);
        const priceSnapshot = item.display_price_snapshot;
        if (priceSnapshot && Number.isInteger(priceSnapshot.amount)) {
          const price = document.createElement('strong'); price.className = 'lotbi-box-card-price';
          price.textContent = formatCardMoney(priceSnapshot.amount, priceSnapshot.currency || 'KRW');
          body.appendChild(price);
        }

        const actions = document.createElement('div'); actions.className = 'lotbi-box-card-actions';
        const detailUrl = [item.source_url, item.external_reference].find(value => typeof value === 'string' && value.startsWith('https://')) || '';
        if (detailUrl) {
          const detail = document.createElement('a');
          detail.className = 'lotbi-box-card-action'; detail.href = detailUrl; detail.target = '_blank';
          detail.rel = 'noopener noreferrer'; detail.referrerPolicy = 'no-referrer'; detail.textContent = '상세보기';
          actions.appendChild(detail);
        } else {
          const detail = document.createElement('button'); detail.type = 'button'; detail.className = 'lotbi-box-card-action';
          detail.textContent = '상세보기'; detail.disabled = true; detail.title = '공식 상세 링크를 확인할 수 없습니다.';
          actions.appendChild(detail);
        }
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'lotbi-box-card-action lotbi-box-card-remove';
        remove.textContent = '롯비함에서 제거'; remove.setAttribute('aria-label', `${title.textContent} 롯비함에서 제거`);
        remove.addEventListener('click', () => {
          removeLotbiBoxItem(item.key);
          refreshLotbiBoxControls();
          render();
          setStatus('롯비함에서 제거했습니다.');
        });
        actions.appendChild(remove);
        card.append(media, body, actions);
        fragment.appendChild(card);
      }
      list.replaceChildren(fragment);
    };

    content.appendChild(list);
    render();
    installSurfaceBehavior(backdrop, panel, {modal: true, trigger});
  };

  const openHelp = () => {
    const {backdrop, panel, content} = modalShell('도움말'); const links = document.createElement('nav');
    links.className = 'help-links'; links.setAttribute('aria-label', '도움말 링크');
    for (const [href, label] of [['/contact.html', '도움말 센터 및 버그 신고'], ['/terms.html', '이용약관'], ['/privacy.html', '개인정보처리방침']]) {
      const link = document.createElement('a'); link.href = href; link.textContent = label; links.appendChild(link);
    }
    content.appendChild(links); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const beginAccountLogoutHandoff = () => {
    markSiteLogoutSuppression();
    const form = document.createElement('form');
    form.method = 'post';
    form.action = 'https://account.lotbiai.com/auth/site-logout';
    form.hidden = true;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'intent';
    input.value = 'logout';
    form.appendChild(input);
    document.body.appendChild(form);
    form.requestSubmit();
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
        discardPendingAttachments();
        await logoutSiteSession(sessionToken); sessionToken = undefined; serverIdentity = undefined; serverSubscription = undefined; closeSurface();
        switchNamespace(anonymousConversationNamespace());
        window.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {detail: {authenticated: false, reason: 'site-logout'}}));
        setStatus('LOTBI 계정 로그아웃을 마무리하고 있습니다.');
        beginAccountLogoutHandoff();
      } catch (error) {
        logout.disabled = false; logout.textContent = '로그아웃';
        setStatus(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
      }
    });
    menu.appendChild(logout); layer.appendChild(menu); trigger.setAttribute('aria-expanded', 'true'); installSurfaceBehavior(layer, menu, {trigger});
  };

  let responseGradeOpen = false;
  let selectedAttachments = [];
  let attachmentUploadsInFlight = 0;
  let attachmentMenuOpen = false;
  const attachmentSizeLabel = size => {
    const bytes = Math.max(0, Number(size || 0));
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
    if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
    return `${bytes}B`;
  };
  const closeAttachmentMenu = ({restoreFocus = false} = {}) => {
    attachmentMenuOpen = false;
    attachmentMenu.hidden = true;
    attachmentTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) attachmentTrigger.focus();
  };
  const openAttachmentMenu = () => {
    if (inFlight || attachmentUploadsInFlight) return;
    attachmentMenuOpen = true;
    attachmentMenu.hidden = false;
    attachmentTrigger.setAttribute('aria-expanded', 'true');
    queueMicrotask(() => attachmentMenu.querySelector('[role="menuitem"]')?.focus());
  };
  const renderAttachmentPreview = () => {
    const fragment = document.createDocumentFragment();
    for (const item of selectedAttachments) {
      const chip = document.createElement('span'); chip.className = 'attachment-chip'; chip.dataset.attachmentId = item.id;
      const name = document.createElement('span'); name.className = 'attachment-chip-name'; name.textContent = safeAttachmentName(item.fileName); name.title = safeAttachmentName(item.fileName);
      const meta = document.createElement('span'); meta.className = 'attachment-chip-meta'; meta.textContent = `${attachmentKindLabel(item.mimeType)} · ${attachmentSizeLabel(item.sizeBytes)}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'attachment-chip-remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', `${safeAttachmentName(item.fileName)} 첨부 제거`);
      remove.addEventListener('click', async () => {
        if (inFlight || remove.disabled) return;
        remove.disabled = true;
        try {
          const guestToken = sessionToken ? '' : (readGuestSession() || '');
          await deleteConversationAttachment({sessionToken: sessionToken || '', guestToken, attachmentId: item.id});
          selectedAttachments = selectedAttachments.filter(candidate => candidate.id !== item.id);
          renderAttachmentPreview();
          setStatus('첨부 파일을 제거했습니다.');
        } catch (error) {
          if (error instanceof SiteCoreError && error.status === 404) {
            selectedAttachments = selectedAttachments.filter(candidate => candidate.id !== item.id);
            renderAttachmentPreview();
          } else {
            remove.disabled = false;
            setStatus(error instanceof Error ? error.message : '첨부 파일을 제거하지 못했습니다.');
          }
        }
      });
      chip.append(name, meta, remove); fragment.appendChild(chip);
    }
    if (attachmentUploadsInFlight > 0) {
      const uploading = document.createElement('span'); uploading.className = 'attachment-uploading';
      uploading.textContent = attachmentUploadsInFlight === 1 ? '첨부 업로드 중…' : `첨부 ${attachmentUploadsInFlight}개 업로드 중…`;
      fragment.appendChild(uploading);
    }
    attachmentPreview.replaceChildren(fragment);
    attachmentPreview.hidden = selectedAttachments.length === 0 && attachmentUploadsInFlight === 0;
    if (typeof updateSendState === 'function') updateSendState();
  };
  const uploadAttachmentSelection = async fileList => {
    if (inFlight || attachmentUploadsInFlight) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let validated;
    try {
      validated = await validateAttachmentFiles(files, selectedAttachments);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '첨부 파일을 확인하지 못했습니다.');
      return;
    }
    let guestToken = '';
    try {
      if (!sessionToken) guestToken = await ensureGuestSession();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '첨부 파일 세션을 시작하지 못했습니다.');
      return;
    }
    attachmentUploadsInFlight = validated.length;
    closeAttachmentMenu();
    renderAttachmentPreview();
    for (const file of validated) {
      try {
        const uploaded = await uploadConversationAttachment({
          sessionToken: sessionToken || '',
          guestToken,
          file,
        });
        selectedAttachments = [...selectedAttachments, uploaded];
      } catch (error) {
        if (isSessionError(error)) sessionToken = undefined;
        if (isGuestSessionError(error)) clearGuestSession();
        setStatus(error instanceof Error ? error.message : '첨부 파일을 업로드하지 못했습니다.');
      } finally {
        attachmentUploadsInFlight = Math.max(0, attachmentUploadsInFlight - 1);
        renderAttachmentPreview();
      }
    }
    if (selectedAttachments.length) setStatus(`첨부 ${selectedAttachments.length}개가 준비되었습니다.`);
    prompt.focus();
  };
  const uploadAttachmentFiles = async input => {
    if (!(input instanceof HTMLInputElement)) return;
    const files = Array.from(input.files || []);
    input.value = '';
    await uploadAttachmentSelection(files);
  };
  const selectedAttachmentIds = () => selectedAttachments.map(item => item.id);
  const attachmentSummary = items => items.map(item => safeAttachmentName(item.fileName)).join(', ');
  const clearSentAttachments = (items, {session = '', guest = ''} = {}) => {
    const sent = Array.isArray(items) ? items : [];
    const sentIds = new Set(sent.map(item => item.id));
    selectedAttachments = selectedAttachments.filter(item => !sentIds.has(item.id));
    renderAttachmentPreview();
    if (!sent.length) return;
    void Promise.allSettled(sent.map(item => deleteConversationAttachment({
      sessionToken: session,
      guestToken: guest,
      attachmentId: item.id,
    })));
  };
  const discardPendingAttachments = () => {
    const pending = [...selectedAttachments];
    const session = sessionToken || '';
    const guest = session ? '' : (readGuestSession() || '');
    selectedAttachments = [];
    renderAttachmentPreview();
    if (!pending.length || (!session && !guest)) return;
    void Promise.allSettled(pending.map(item => deleteConversationAttachment({
      sessionToken: session,
      guestToken: guest,
      attachmentId: item.id,
    })));
  };
  const clearLocalAttachments = () => {
    selectedAttachments = [];
    attachmentUploadsInFlight = 0;
    closeAttachmentMenu();
    renderAttachmentPreview();
  };

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
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || anonymousConversationNamespace());
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
    const attachmentBusy = attachmentUploadsInFlight > 0;
    const hasContent = prompt.value.trim().length > 0 || selectedAttachments.length > 0;
    sendButton.disabled = inFlight || attachmentBusy || !hasContent;
    sendButton.setAttribute('aria-label', inFlight ? '전송 중' : '전송');
    sendButton.title = inFlight ? '전송 중' : '전송';
    micButton.disabled = inFlight || attachmentBusy || voiceRequesting;
    attachmentTrigger.disabled = inFlight || attachmentBusy || selectedAttachments.length >= 3;
    if (attachmentTrigger.disabled && attachmentMenuOpen) closeAttachmentMenu();
    for (const input of attachmentInputs) input.disabled = inFlight || attachmentBusy || selectedAttachments.length >= 3;
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
  const showError = (error, retryText, retryWithoutDuplicate, logicalRequestId = '', turnCreatedAt = 0) => {
    const wrapper = document.createElement('article'); wrapper.className = 'chat-message chat-message-error'; wrapper.setAttribute('role', 'alert');
    const body = document.createElement('p'); body.className = 'chat-message-body'; body.textContent = userFacingErrorMessage(error); wrapper.appendChild(body);
    appendSafeErrorEvidence(wrapper, error); logSafeConversationFailure(error);
    const retryable = isSessionError(error) || isGuestSessionError(error) || !(error instanceof SiteCoreError) || error.retryable;
    if (retryable) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'chat-retry-button'; retry.textContent = isSessionError(error) ? '다시 연결' : '다시 시도';
      retry.addEventListener('click', async () => {
        retry.disabled = true;
        if (isSessionError(error)) {
          try { await beginGuestClaimingSiteHandoff(retryText); }
          catch (caught) { retry.disabled = false; body.textContent = caught instanceof Error ? caught.message : '로그인 연결을 시작하지 못했습니다.'; }
          return;
        }
        wrapper.remove(); await requestAssistant(retryText, !retryWithoutDuplicate, logicalRequestId, turnCreatedAt);
      });
      wrapper.appendChild(retry);
    }
    appendNode(wrapper);
  };
  const requestAssistant = async (text, appendUserMessage = true, logicalRequestId = '', turnCreatedAt = 0) => {
    const message = typeof text === 'string' ? text.trim() : '';
    const sourceTurnCreatedAt = Number.isFinite(Number(turnCreatedAt)) && Number(turnCreatedAt) > 0 ? Number(turnCreatedAt) : Date.now();
    const sourceTurnCreatedAtIso = new Date(sourceTurnCreatedAt).toISOString();
    const attachments = [...selectedAttachments];
    if ((!message && !attachments.length) || inFlight || attachmentUploadsInFlight) return;
    const submittedAt = performanceNow(); const requestsBefore = resourceCounts(); recordTiming('T0-submit', {length: message.length, attachmentCount: attachments.length});
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || anonymousConversationNamespace());
    const displayMessage = message || `첨부 파일 ${attachments.length}개를 확인해 주세요.`;
    const activeConversation = ensureThread(displayMessage);
    const activeConversationId = activeConversation?.id || state.activeThreadId || '';
    if (appendUserMessage) {
      const attachmentMeta = attachments.map(item => ({id: item.id, filename: item.fileName, mediaType: item.mimeType, sizeBytes: item.sizeBytes, previewUrl: ''}));
      const userRecord = timestampedConversationMessage({role: 'user', text: displayMessage, meta: {}}, sourceTurnCreatedAt);
      appendConversationRecord({...userRecord, meta: {attachments: attachmentMeta}}, {forceScroll: true});
      appendPersistedMessage(userRecord);
    }
    const local = attachments.length ? null : deterministicReply(message);
    if (local) {
      diagnostics.lastPath = 'LOCAL_DETERMINISTIC'; diagnostics.deterministicReplies += 1; diagnostics.providerCallsAvoided += 1;
      recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0}); await Promise.resolve();
      const record = timestampedConversationMessage({role: 'assistant', text: local, meta: {status: 'ANSWERED', responseMode: 'LOCAL_DETERMINISTIC'}});
      appendConversationRecord(record); appendPersistedMessage(record);
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt));
      const requestsAfter = resourceCounts();
      diagnostics.lastCoreRequestDelta = requestsAfter.core - requestsBefore.core;
      diagnostics.lastExternalAiRequestDelta = requestsAfter.externalAi - requestsBefore.externalAi;
      publishDiagnostics();
      recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: diagnostics.lastCoreRequestDelta, providerCalls: 0, externalAiCalls: diagnostics.lastExternalAiRequestDelta});
      console.info(`[LOTBI deterministic evidence] latencyMs=${diagnostics.lastVisibleAnswerMs} coreRequests=${diagnostics.lastCoreRequestDelta} providerRequests=0 externalAiRequests=${diagnostics.lastExternalAiRequestDelta}`);
      setStatus('LOTBI의 즉시 응답이 도착했습니다.'); prompt.focus(); return;
    }
    if (!attachments.length && !sessionToken && isExplicitLifeCalendarCommand(message)) {
      const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState();
      const calendarRequestId = logicalRequestId || newId('calendar-guest-direct');
      const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
      try {
        if (!storage || !globalThis.navigator?.locks?.request) {
          throw new Error('이 브라우저에서 안전한 일정 중복 방지 기능을 사용할 수 없습니다.');
        }
        const preview = await previewLifeCalendarCommand({
          logicalRequestId: calendarRequestId,
          text: message,
          timezone: timezoneName,
          turnCreatedAt: sourceTurnCreatedAtIso,
        });
        const event = await globalThis.navigator.locks.request(
          `lotbi-calendar-direct:${calendarRequestId}`,
          {mode: 'exclusive'},
          async () => createGuestCalendarRepository(storage).createForRequest(calendarRequestId, {
            title: preview.title,
            local_date: preview.temporal.local_datetime.slice(0, 10),
            local_datetime: preview.temporal.local_datetime,
            all_day: false,
          }),
        );
        loading.parentElement?.remove();
        const meta = {
          status: 'ANSWERED',
          responseMode: preview.parserType,
          calendarResult: {
            scope: 'GUEST',
            state: 'REGISTERED',
            guestEventId: event.id,
            title: event.title,
            dateHint: event.local_date,
            timezone: preview.temporal.timezone_name,
          },
        };
        const calendarRecord = timestampedConversationMessage({
          role: 'assistant',
          text: `${event.local_date} ‘${event.title}’ 일정을 이 브라우저 캘린더에 등록했어요.`,
          meta,
        });
        appendConversationRecord(calendarRecord);
        appendPersistedMessage(calendarRecord);
        diagnostics.lastPath = 'CORE_CALENDAR_GUEST_DETERMINISTIC';
        diagnostics.coreCalls += 1;
        diagnostics.providerCallsAvoided += 1;
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('이 브라우저 캘린더에 일정을 등록했습니다.');
      } catch (caught) {
        loading.parentElement?.remove();
        showError(caught, message, true, calendarRequestId, sourceTurnCreatedAt);
      } finally {
        inFlight = false;
        updateSendState();
        prompt.focus();
      }
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
          recentContext: recentConversationContext(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
          turnCreatedAt: sourceTurnCreatedAtIso,
          attachmentIds: attachments.map(item => item.id),
          conversationId: activeConversationId,
          turnId: guestRequestId,
          logicalRequestId: guestRequestId,
          stateVersion: Number.isInteger(activeConversation?.stateVersion) ? activeConversation.stateVersion : 0,
        });
        diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt));
        recordTiming('T2-core-guest-response', {durationMs: diagnostics.lastCoreDurationMs});
        loading.parentElement?.remove();
        if (Number.isInteger(response.stateVersion) && response.stateVersion >= 0) {
          const currentThread = state.threads.find(item => item.id === activeConversationId);
          if (currentThread && response.stateVersion >= Number(currentThread.stateVersion || 0)) {
            currentThread.stateVersion = response.stateVersion;
            saveState();
          }
        }
        const meta = {status: response.status, responseMode: response.responseMode, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
        const calendarItems = conversationCalendarItemsFromResponse(response, 'GUEST');
        if (calendarItems.length) {
          meta.calendarItems = calendarItems;
        } else if (response.calendarCandidate) {
          const calendarAction = createAvailableCalendarAction(response.calendarCandidate, {scope: 'GUEST', ownerNamespace: namespace});
          if (calendarAction) meta.calendarAction = calendarAction;
        }
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
        const placeResult = compactPlaceResultMeta(response.placeResult);
        if (placeResult) meta.placeResult = placeResult;
        const assistantRecord = timestampedConversationMessage({role: 'assistant', text: response.assistantText, meta});
        appendConversationRecord(assistantRecord); appendPersistedMessage(assistantRecord);
        if (attachments.length) clearSentAttachments(attachments, {guest: token});
        diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 2 : 1});
        setStatus(placeResult ? '로그인 없이 실제 장소 카드와 네이버지도 길안내를 준비했습니다.' : (richProduct ? '로그인 없이 실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.')));
      } catch (caught) {
        loading.parentElement?.remove();
        if (isGuestSessionError(caught)) clearGuestSession();
        showError(caught, message, true, guestRequestId, sourceTurnCreatedAt);
        setStatus('LOTBI 대화를 완료하지 못했습니다.');
      } finally { inFlight = false; updateSendState(); prompt.focus(); }
      return;
    }
    if (!attachments.length && isExplicitLifeCalendarCommand(message)) {
      const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState();
      const calendarRequestId = logicalRequestId || newId('calendar');
      try {
        const calendar = await executeLifeCalendarCommand(sessionToken, {
          logicalRequestId: calendarRequestId, text: message,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
          turnCreatedAt: sourceTurnCreatedAtIso,
        });
        loading.parentElement?.remove();
        const meta = {
          status: 'ANSWERED',
          responseMode: calendar.parserType,
          calendarResult: {
            scope: 'AUTH',
            state: 'REGISTERED',
            activityId: calendar.activity.activityId,
            occurrenceId: calendar.activity.occurrenceId,
            title: calendar.activity.title,
            dateHint: String(calendar.activity.temporal.local_datetime || calendar.activity.temporal.local_date || '').slice(0, 10),
            timezone: calendar.activity.temporal.timezone_name || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'),
          },
        };
        const calendarRecord = timestampedConversationMessage({role: 'assistant', text: calendar.assistantText, meta});
        appendConversationRecord(calendarRecord);
        appendPersistedMessage(calendarRecord);
        diagnostics.lastPath = 'CORE_CALENDAR_DETERMINISTIC'; diagnostics.coreCalls += 1; diagnostics.providerCallsAvoided += 1;
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('일정을 추가하고 달력을 새로 고쳤습니다.');
      } catch (caught) {
        loading.parentElement?.remove(); if (isSessionError(caught)) sessionToken = undefined;
        showError(caught, message, true, calendarRequestId, sourceTurnCreatedAt);
      } finally { inFlight = false; updateSendState(); prompt.focus(); }
      return;
    }
    const authenticatedRequestId = logicalRequestId || newId('auth-ai');
    const avatarRequestId = nextAvatarRequestId('turn'); driveAvatar('response-wait', avatarRequestId);
    const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState(); setVoiceFeedback(''); setStatus('LOTBI 응답을 기다리는 중입니다.');
    diagnostics.lastPath = 'CORE_CONVERSATION'; diagnostics.coreCalls += 1;
    const coreStartedAt = performanceNow(); recordTiming('T1-core-request', {coreCall: diagnostics.coreCalls});
    try {
      const activeSessionToken = sessionToken;
      const response = await sendConversationMessage(
        activeSessionToken,
        message,
        globalThis.fetch,
        attachments.map(item => item.id),
        authenticatedRequestId,
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
        sourceTurnCreatedAtIso,
        recentConversationContext(),
        {
          conversationId: activeConversationId,
          turnId: authenticatedRequestId,
          logicalRequestId: authenticatedRequestId,
          stateVersion: Number.isInteger(activeConversation?.stateVersion) ? activeConversation.stateVersion : 0,
        },
      );
      diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt)); recordTiming('T2-core-response', {durationMs: diagnostics.lastCoreDurationMs});
      loading.parentElement?.remove();
      if (Number.isInteger(response.stateVersion) && response.stateVersion >= 0) {
        const currentThread = state.threads.find(item => item.id === activeConversationId);
        if (currentThread && response.stateVersion >= Number(currentThread.stateVersion || 0)) {
          currentThread.stateVersion = response.stateVersion;
          saveState();
        }
      }
      const meta = {status: response.status, responseMode: response.responseMode, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
      const calendarItems = conversationCalendarItemsFromResponse(response, 'AUTH');
      if (calendarItems.length) {
        meta.calendarItems = calendarItems;
      } else if (response.calendarCandidate) {
        const calendarAction = createAvailableCalendarAction(response.calendarCandidate, {scope: 'AUTH', ownerNamespace: namespace});
        if (calendarAction) meta.calendarAction = calendarAction;
      }
      if (response.calendarDraft) meta.calendarDraft = response.calendarDraft;
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
      const placeResult = compactPlaceResultMeta(response.placeResult);
      if (placeResult) meta.placeResult = placeResult;
      const assistantRecord = timestampedConversationMessage({role: 'assistant', text: response.assistantText, meta});
      appendConversationRecord(assistantRecord); appendPersistedMessage(assistantRecord);
      if (attachments.length) clearSentAttachments(attachments, {session: activeSessionToken});
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 3 : 1});
      setStatus(placeResult ? '실제 장소 카드와 네이버지도 길안내를 준비했습니다.' : (richProduct ? '실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.')));
      driveAvatar('response-complete', avatarRequestId);
    } catch (caught) {
      driveAvatar('cancel', avatarRequestId);
      loading.parentElement?.remove(); if (isSessionError(caught)) sessionToken = undefined;
      showError(caught, message, true, authenticatedRequestId, sourceTurnCreatedAt); setStatus('LOTBI 대화를 완료하지 못했습니다.');
    } finally { inFlight = false; updateSendState(); prompt.focus(); }
  };
  window.addEventListener('lotbi:keyboard-viewport', () => {
    if (!thread.hidden && isThreadNearBottom()) {
      requestAnimationFrame(scrollThread);
    }
  });

  const submitCurrentPrompt = async () => {
    if (inFlight || attachmentUploadsInFlight) return;
    const message = prompt.value.trim();
    if (!message && !selectedAttachments.length) return;
    if (voiceListening && voiceRecognition) voiceRecognition.stop();
    prompt.value = ''; state.draft = ''; saveState();
    prompt.dispatchEvent(new Event('input', {bubbles: true}));
    await requestAssistant(message, true);
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
  attachmentTrigger.addEventListener('click', () => {
    if (attachmentMenuOpen) closeAttachmentMenu({restoreFocus: true});
    else openAttachmentMenu();
  });
  attachmentTrigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); openAttachmentMenu();
    }
  });
  attachmentMenu.addEventListener('keydown', event => {
    const items = [...attachmentMenu.querySelectorAll('[role="menuitem"]')].filter(item => item instanceof HTMLButtonElement);
    const current = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeAttachmentMenu({restoreFocus: true}); return; }
    if (event.key === 'Tab') { closeAttachmentMenu(); return; }
    if (!items.length || current < 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + offset + items.length) % items.length].focus();
    } else if (event.key === 'Home') { event.preventDefault(); items[0].focus(); }
    else if (event.key === 'End') { event.preventDefault(); items[items.length - 1].focus(); }
  });
  for (const action of attachmentMenu.querySelectorAll('[data-attachment-action]')) {
    if (!(action instanceof HTMLButtonElement)) continue;
    action.addEventListener('click', () => {
      const mode = action.dataset.attachmentAction || '';
      const input = attachmentInputs.find(candidate => candidate.dataset.attachmentInput === mode);
      closeAttachmentMenu();
      if (input instanceof HTMLInputElement) input.click();
    });
  }
  for (const input of attachmentInputs) {
    input.addEventListener('change', () => void uploadAttachmentFiles(input));
  }
  const composerStack = attachmentTrigger.closest('.chat-composer-stack');
  if (composerStack) composerStack.addEventListener('dragover', event => {
    if (event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.includes('Files')) {
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    }
  });
  if (composerStack) composerStack.addEventListener('drop', event => {
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      event.preventDefault(); void uploadAttachmentSelection(event.dataTransfer.files);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && attachmentMenuOpen) {
      event.preventDefault(); closeAttachmentMenu({restoreFocus: true});
    }
  });
  micButton.addEventListener('click', () => void startVoiceInput());
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-conversation-menu]')) closeConversationMenus();
    if (attachmentMenuOpen && !target?.closest('[data-attachment-control]')) closeAttachmentMenu();
    if (responseGradeOpen && !target?.closest('[data-response-grade-control]')) closeResponseGradeMenu();
    const lotbiBoxTrigger = target?.closest('[data-lotbi-box-open]');
    if (lotbiBoxTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      openLotbiBox(lotbiBoxTrigger);
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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeConversationMenus();
  });
  window.addEventListener(SESSION_STATE_EVENT, event => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (!detail || typeof detail.authenticated !== 'boolean') return;
    if (selectedAttachments.length || attachmentUploadsInFlight) clearLocalAttachments();
    if (openSurface?.querySelector('.lotbi-box-list, .calendar-product-shell')) closeSurface();
    if (detail.authenticated) {
      const key = normalizedNamespace(detail.identityKey || detail.installationId); if (key) switchNamespace(key);
      refreshAuthenticatedProfileSlots();
    } else if (!sessionToken) switchNamespace(anonymousConversationNamespace());
  });
  window.addEventListener(SIDEBAR_RENDERED_EVENT, () => {
    bindCalendarEntries();
    refreshAuthenticatedProfileSlots();
    if (!stateReady && document.body.dataset.siteAuthState === 'unauthenticated') {
      switchNamespace(anonymousConversationNamespace());
    }
  });
  syncResponseGradeUi();
  refreshConversationTimeLabels();
  updateSendState(); setStatus(sessionToken ? 'LOTBI와 대화할 준비가 되었습니다.' : '로그인 없이도 LOTBI와 바로 대화할 수 있습니다. 계정 기능이 필요할 때만 로그인합니다.');
  if (namespace) switchNamespace(namespace); else if (document.body.dataset.siteAuthState === 'unauthenticated') switchNamespace(anonymousConversationNamespace());
  if (sessionToken) void loadServerProfile();
  if (autoSend && typeof initialText === 'string' && initialText.trim()) queueMicrotask(() => void requestAssistant(initialText, true));
  return true;
}

export {mountConversation};

function autoMount() { if (document.getElementById('lotbi-prompt')) mountConversation(); }
ensureConversationStyles();
Object.defineProperty(window, '__lotbiConversationUx', {value: Object.freeze({snapshot: () => Object.freeze({...diagnostics})}), writable: false, configurable: false});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, {once: true}); else autoMount();
