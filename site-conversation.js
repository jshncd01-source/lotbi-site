Warning: truncated output (original token count: 56511)
Total output lines: 4219

import {beginSiteHandoff, markSiteLogoutSuppression} from './site-auth.js?v=aset-6c31fddb37a5';
import * as siteCore from './site-core.js?v=aset-6c31fddb37a5';
import {buildGoogleMapsDirectionsUrl, buildKakaoNaviHandoffUrl, buildNaverMapsWebSearchUrl, buildVerifiedPhoneHref, isPlaceResultFresh, isTmapHandoffAvailable, normalizePlaceResult, openGoogleMapsPlace, openKakaoNaviPlace, openNaverMapsPlace, openTmapPlace} from './site-navigation.js?v=aset-6c31fddb37a5';
import * as siteAttachments from './site-attachments.js?v=aset-6c31fddb37a5';
import {formatConversationTimestamp, millisecondsUntilNextLocalMidnight, shouldShowConversationSeparator, timestampedConversationMessage} from './site-conversation-timeline.js?v=aset-6c31fddb37a5';
import {deterministicReply} from './site-deterministic.js?v=aset-6c31fddb37a5';
import {ensureDurableAnonymousConversationNamespace, guestConversationThreadClaimed, markConversationTabEntry, prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=aset-6c31fddb37a5';
import {executeLifeCalendarCommand, getLifeToday, isExplicitLifeCalendarCommand, previewLifeCalendarCommand} from './site-calendar.js?v=aset-6c31fddb37a5';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-6c31fddb37a5';
import {calendarActionInFlight, createAvailableCalendarAction, normalizePersistedCalendarAction, recoverCalendarActionAfterReload, runCalendarAction} from './site-calendar-actions.js?v=aset-6c31fddb37a5';
import {CALENDAR_DRAFT_WRITE_STATE, registerCalendarDraft} from './site-calendar-draft-write.js?v=aset-6c31fddb37a5';
import {mountLifeCalendarManager} from './site-calendar-ui.js?v=aset-6c31fddb37a5';
import {createIconButton, createSafeMessageBody, enhanceExpandableUserMessage} from './site-message-body.js?v=aset-6c31fddb37a5';
import {createWakeListener, readWakePreference, stripWakePrefix, wakeListeningSupported, writeWakePreference} from './site-voice-wake.js?v=aset-6c31fddb37a5';
import {createThinkingPresentation, selectThinkingKind} from './site-chat-thinking.js?v=aset-6c31fddb37a5';

const {createGuestConversationSession, deleteConversationAttachment, getCurrentSiteUser, getCurrentSubscription, getProductCards, logoutSiteSession, normalizeCalendarPartialCandidate, normalizeSmartCalendarDraft, reviewProductCard, searchProductCards, searchPublicProductCards, sendConversationMessage, sendGuestConversationMessage, updateCurrentSiteProfile, uploadConversationAttachment, SiteCoreError} = siteCore;
const {adoptAttachmentPreviewUrl, attachmentDisplayPresentation, createAttachmentPreviewUrl, isPreviewableImageAttachment, releaseAllAttachmentPreviewUrls, releaseComposerPreviewUrl, releaseRenderedPreviewUrls, validateAttachmentFiles} = siteAttachments;

// SITE-IMAGE-ATTACHMENT-THUMBNAIL-01 — an image-only turn carries this
// placeholder as its conversation text. The composer builds the same sentence
// (its literal form is pinned by validate_attachment_composer_16.mjs), so the
// renderer recognises it and lets the thumbnail be the visible content while
// the sentence stays available to screen readers.
const attachmentOnlyPlaceholder = count => `첨부 파일 ${count}개를 확인해 주세요.`;

// SITE-THEME-AUTO-SCHEDULE-02 — 대표: "시간이 18시 이후에는 다크로 가고 아침
// 07시 되면 화이트로 가는 거"
//
// '자동' is a fourth *preference*, not a fourth theme. What reaches
// body[data-site-theme] and html[data-site-theme-bootstrap] is always one of the
// three states site-theme-tokens.css already paints, so the dark-theme
// stylesheet needs nothing new and cannot be broken from here.
//
// It is deliberately not the same answer as '기기모드', which follows the OS.
// This one follows the clock, which is what 대표 asked for. Both stay on offer.
const AUTO_THEME_DARK_HOUR = 18;
const AUTO_THEME_LIGHT_HOUR = 7;
function resolveScheduledTheme(now = new Date()) {
  const hour = now.getHours();
  return hour >= AUTO_THEME_DARK_HOUR || hour < AUTO_THEME_LIGHT_HOUR ? 'dark' : 'light';
}
// When the next switch is due, so a tab left open overnight turns dark at 18:00
// instead of waiting for a reload.
function millisecondsUntilNextThemeBoundary(now = new Date()) {
  const hour = now.getHours();
  const next = new Date(now.getTime());
  next.setMinutes(0, 0, 0);
  next.setHours(hour < AUTO_THEME_LIGHT_HOUR || hour >= AUTO_THEME_DARK_HOUR ? AUTO_THEME_LIGHT_HOUR : AUTO_THEME_DARK_HOUR);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// SITE-THEME-BOOTSTRAP-FIRST-PAINT-01 — the authoritative copy of this lives
// inline in index.html's <head>, above the stylesheets. It has to: this file is
// loaded as a module, so it defers past first paint and the pre-paint rules in
// site-theme-tokens.css had already missed their chance. Kept here because this
// module also runs on pages that do not carry the inline block, and re-running
// it is harmless — it writes the same attribute from the same value.
try {
  const stored = globalThis.localStorage?.getItem?.('lotbi.site.theme.bootstrap.v1');
  const savedTheme = stored === 'auto' ? resolveScheduledTheme() : stored;
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
    document.documentElement.dataset.siteThemeBootstrap = savedTheme;
  }
} catch {}

// SITE-THEME-NAMESPACE-CARRY-01 — the theme has two stores, and the wrong one
// used to win.
//
// 대표: "다크모드에서 새로고침하면 화이트 화면으로 보인다"
//
// The pre-paint bootstrap above reads the durable, device-wide key and paints
// the first frame correctly. Then this module mounts, switchNamespace() loads
// the per-namespace preferences, and applyPreferences() writes body and html
// from those — overwriting the attribute the bootstrap just set, and
// savePreferences() then writes the result back over the durable key.
//
// Whenever the namespace has no stored theme the old fallback was the literal
// 'system'. So any namespace change — signing in or out, a namespace whose
// preferences were never written because savePreferences() ran before
// stateReady, a second account, cleared per-namespace data — reset the user's
// choice to 'system'. On a light OS that is a white page, and because the
// durable key is rewritten on the way out, the choice is gone for good rather
// than for one load. Measured: bootstrap key 'dark' with no stored namespace
// preferences painted body #151922 at first frame, then settled at
// rgb(255,255,255) with the attribute flipped to 'system'.
//
// So an absent namespace theme now carries the durable value forward instead
// of discarding it. That key is already device-wide by design — it is what the
// first paint reads before any namespace is known — so honouring it here makes
// the two stores agree rather than fight.
const SITE_THEME_BOOTSTRAP_KEY = 'lotbi.site.theme.bootstrap.v1';

// SITE-THEME-AUTO-SCHEDULE-02 landed '자동모드' while this fix was open, and the
// durable key can now hold 'auto' as well. Rather than keep a second list that
// has to be remembered, ask THEME_OPTIONS — the one the settings menu is built
// from. A fifth theme added there is accepted here on the same commit.
// Referenced inside the functions, not at module evaluation, because
// THEME_OPTIONS is declared below this block.
function isSiteTheme(value) {
  return THEME_OPTIONS.some(([key]) => key === value);
}

function durableBootstrapTheme() {
  try {
    return globalThis.localStorage?.getItem?.(SITE_THEME_BOOTSTRAP_KEY) ?? '';
  } catch {
    return '';
  }
}

function resolveNamespaceTheme(storedTheme, durableTheme) {
  if (isSiteTheme(storedTheme)) return storedTheme;
  if (isSiteTheme(durableTheme)) return durableTheme;
  return 'system';
}

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const SIDEBAR_RENDERED_EVENT = 'lotbi:sidebar-auth-rendered';
const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const THREAD_LIMIT = 50;
const MESSAGE_LIMIT = 120;
const THREAD_TITLE_LIMIT = 60;
// PROFILE-MENU: the one account-management destination. 설정 navigates here,
// which is exactly where the profile modal's removed account-management button
// used to point.
const ACCOUNT_MANAGE_URL = 'https://account.lotbiai.com/account';
const PHOTO_BYTES_LIMIT = 20 * 1024 * 1024;
const PHOTO_DIMENSION_LIMIT = 8192;
const PHOTO_PIXEL_LIMIT = 40_000_000;
const PROFILE_PHOTO_SOURCE_OPTIONS = Object.freeze([
  ['camera', '카메라'], ['gallery', '갤러리'], ['files', '내 파일'],
]);
const COLOR_OPTIONS = Object.freeze([
  ['default', '기본'], ['blue', '파랑'], ['purple', '보라'], ['green', '초록'],
  ['orange', '오렌지'], ['pink', '분홍'], ['gray', '회색'],
]);
// SITE-THEME-AUTO-SCHEDULE-02 — the 개인테마 window's offer, in 대표's wording.
// '자동' rides beside '기기모드' rather than replacing it: 기기모드 follows the
// device, 자동 follows the clock, and they are different answers.
const THEME_OPTIONS = Object.freeze([
  ['system', '기기모드'],
  ['light', '라이트모드'],
  ['dark', '다크모드'],
  ['auto', '자동모드'],
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
  link.href = '/site-conversation.css?v=aset-6c31fddb37a5';
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

// SITE-MESSAGE-SHARE-ACTIONS-01 — the icon row LOTBI answers carry.
// Copy is local to the browser. Share hands the answer to the OS share sheet,
// where KakaoTalk appears next to every other installed target, so it needs no
// Kakao app key and no registered JavaScript SDK domain. Desktop browsers have
// no share sheet, so they fall back to copying the answer plus the site link.
// SITE-VOICE-BROWSER-TTS-01 — reading answers aloud, with the voice the
// browser already has. Core's /v2/live/tts still is not reachable from a Site
// session and its provider credentials are not configured, so waiting for it
// means shipping nothing. speechSynthesis needs no key, no network call of our
// own and no new environment variable, and where a browser does not have it the
// control simply is not built — an answer that cannot be read aloud should not
// grow a button that says it can.
//
// When the approved provider does arrive, this is the fallback it falls back
// to, not code to delete.
// (superseding) "소리내어 읽기" was absent while Core's /v2/live/tts was unreachable
// from a Site session; a permanently dead button is worse than no button.
const MESSAGE_ACTION_SHARE_URL = 'https://lotbiai.com/';
const MESSAGE_ACTION_ICON_COPY = 'M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16h-9V7h9v14Z';
const MESSAGE_ACTION_ICON_SHARE = 'M12 2 7.5 6.5l1.4 1.4L11 5.8V16h2V5.8l2.1 2.1 1.4-1.4L12 2ZM5 12v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h-2v8H7v-8H5Z';
const MESSAGE_ACTION_ICON_SPEAK = 'M4 9v6h4l5 4V5L8 9H4Zm11.5 3a4 4 0 0 0-2-3.46v6.92A4 4 0 0 0 15.5 12Zm-2-7.77v2.06A6 6 0 0 1 13.5 18.3v2.06a8 8 0 0 0 0-15.6Z';
const MESSAGE_ACTION_ICON_STOP = 'M6 6h12v12H6V6Z';
const MESSAGE_ACTION_FEEDBACK_MS = 2600;
// Chrome stops a long utterance partway through, so answers are read in
// sentence-sized pieces queued back to back. cancel() still clears the whole
// queue, which keeps the stop control honest.
const SPEECH_CHUNK_LIMIT = 180;

function speechSupported() {
  return typeof globalThis.speechSynthesis !== 'undefined'
    && typeof globalThis.SpeechSynthesisUtterance === 'function';
}

function splitForSpeech(value) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  if (!text) return [];
  const chunks = [];
  let current = '';
  for (const piece of text.split(/(?<=[.!?。？！]|다\.|요\.)\s+/u)) {
    if (!piece) continue;
    if ((current + ' ' + piece).trim().length <= SPEECH_CHUNK_LIMIT) {
      current = (current ? current + ' ' : '') + piece;
      continue;
    }
    if (current) chunks.push(current);
    // A single sentence longer than the limit still has to be broken, or the
    // engine truncates it silently.
    if (piece.length <= SPEECH_CHUNK_LIMIT) { current = piece; continue; }
    for (let i = 0; i < piece.length; i += SPEECH_CHUNK_LIMIT) chunks.push(piece.slice(i, i + SPEECH_CHUNK_LIMIT));
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

async function writeMessageTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older in-app browsers and Android WebView builds have no async clipboard.
  const surrogate = document.createElement('textarea');
  surrogate.value = text;
  surrogate.setAttribute('readonly', '');
  surrogate.style.position = 'fixed';
  surrogate.style.top = '-1000px';
  surrogate.style.opacity = '0';
  document.body.appendChild(surrogate);
  surrogate.select();
  surrogate.setSelectionRange(0, surrogate.value.length);
  const copied = document.execCommand('copy');
  surrogate.remove();
  if (!copied) throw new Error('복사를 완료하지 못했습니다.');
}

function createMessageActions(text, announce) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return undefined;

  const actions = document.createElement('div');
  actions.className = 'chat-message-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'LOTBI 답변 도구');

  const feedback = document.createElement('span');
  feedback.className = 'chat-message-action-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');

  let feedbackTimer;
  const report = (message, tone = '') => {
    feedback.textContent = message;
    if (tone) feedback.dataset.tone = tone; else delete feedback.dataset.tone;
    if (typeof announce === 'function') announce(message);
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = '';
      delete feedback.dataset.tone;
    }, MESSAGE_ACTION_FEEDBACK_MS);
  };

  const shareByClipboard = async () => {
    try {
      await writeMessageTextToClipboard(`${value}\n\n${MESSAGE_ACTION_SHARE_URL}`);
      report('이 브라우저에는 공유 시트가 없어 답변과 링크를 복사했습니다. 카카오톡에 붙여넣어 주세요.');
    } catch {
      report('공유를 완료하지 못했습니다.', 'error');
    }
  };

  const copy = createIconButton({className: 'chat-message-action', label: '복사하기', iconPath: MESSAGE_ACTION_ICON_COPY, dataset: {messageAction: 'copy'}});
  copy.addEventListener('click', async () => {
    try {
      await writeMessageTextToClipboard(value);
      report('답변을 복사했습니다.');
    } catch {
      report('복사하지 못했습니다. 답변을 길게 눌러 직접 선택해 주세요.', 'error');
    }
  });

  const share = createIconButton({className: 'chat-message-action', label: '공유하기', iconPath: MESSAGE_ACTION_ICON_SHARE, dataset: {messageAction: 'share'}});
  share.addEventListener('click', () => {
    // navigator.share has to run inside the click itself — an await before it
    // spends the user gesture and the OS refuses to open the sheet.
    if (typeof navigator.share !== 'function') { void shareByClipboard(); return; }
    navigator.share({title: 'LOTBI', text: value, url: MESSAGE_ACTION_SHARE_URL})
      .then(() => report('공유 앱으로 보냈습니다.'))
      .catch(error => {
        if (error && error.name === 'AbortError') return;
        void shareByClipboard();
      });
  });

  // Built only where the browser can actually speak. No dialog, no disabled
  // button, no promise the page cannot keep — just the copy and share tools.
  if (speechSupported()) {
    const speak = createIconButton({className: 'chat-message-action', label: '읽어주기', iconPath: MESSAGE_ACTION_ICON_SPEAK, dataset: {messageAction: 'speak'}});
    const speakIcon = speak.querySelector('path');
    let speaking = false;
    const setSpeakUi = active => {
      speaking = active;
      speak.setAttribute('aria-label', active ? '읽기 멈추기' : '읽어주기');
      speak.title = active ? '읽기 멈추기' : '읽어주기';
      speak.setAttribute('aria-pressed', String(active));
      speakIcon?.setAttribute('d', active ? MESSAGE_ACTION_ICON_STOP : MESSAGE_ACTION_ICON_SPEAK);
      if (active) speak.dataset.speaking = 'true'; else delete speak.dataset.speaking;
    };
    setSpeakUi(false);
    speak.addEventListener('click', () => {
      // The button is the stop control from the first click onward. Nobody has
      // to sit through a long answer to get it back.
      if (speaking) { globalThis.speechSynthesis.cancel(); setSpeakUi(false); report('읽기를 멈췄습니다.'); return; }
      const chunks = splitForSpeech(value);
      if (!chunks.length) { report('읽을 내용이 없습니다.', 'error'); return; }
      // The API can be present on a device that has no installed voice at all —
      // headless Linux is the obvious one, but it happens on stripped-down
      // handsets too. Saying which thing is missing beats a bare failure.
      let voices = [];
      try { voices = globalThis.speechSynthesis.getVoices() || []; } catch { voices = []; }
      if (!voices.length) { report('이 기기에 설치된 음성이 없어 읽어 드릴 수 없습니다.', 'error'); return; }
      // Whatever else was being read stops first: two answers at once is noise.
      globalThis.speechSynthesis.cancel();
      setSpeakUi(true);
      report('답변을 읽어 드립니다.');
      chunks.forEach((chunk, index) => {
        const utterance = new globalThis.SpeechSynthesisUtterance(chunk);
        utterance.lang = 'ko-KR';
        if (index === chunks.length - 1) utterance.onend = () => setSpeakUi(false);
        utterance.onerror = () => { setSpeakUi(false); report('읽어 드리지 못했습니다.', 'error'); };
        globalThis.speechSynthesis.speak(utterance);
      });
    });
    actions.append(copy, share, speak, feedback);
    return actions;
  }

  actions.append(copy, share, feedback);
  return actions;
}

function createAttachmentIcon(attachment) {
  const icon = document.createElement('span');
  icon.className = 'message-attachment-icon';
  icon.setAttribute('aria-hidden', 'true');
  const mediaType = attachment && (attachment.mediaType || attachment.mimeType);
  icon.textContent = String(mediaType || '').startsWith('image/')
    ? '사진'
    : (mediaType === 'application/pdf' ? 'PDF' : '파일');
  return icon;
}

function petConversationAction(text, attachments = []) {
  const value = typeof text === 'string' ? text.trim() : '';
  const hasAnimal = /(강아지|고양이|반려동물|동물|우리\s*개|우리\s*냥)/u.test(value);
  const hasImage = Array.isArray(attachments)
    && attachments.some(item => typeof item?.mimeType === 'string' && item.mimeType.startsWith('image/'));
  const foundIntent = /(길에서|발견했|발견한|주인을\s*찾|보호\s*중|잃어버린\s*애인지\s*찾)/u.test(value);
  if ((hasAnimal || hasImage) && foundIntent) {
    return Object.freeze({target: 'found', label: '발견 제보하기'});
  }
  const sosIntent = /(잃어버렸|잃어버린\s*(?:것\s*같|것\s*같아)|없어졌|사라졌|실종)/u.test(value);
  if (hasAnimal && sosIntent) {
    return Object.freeze({target: 'sos', label: '실종 신고하기'});
  }
  return null;
}

function appendAttachmentLabel(item, presentation) {
  const label = document.createElement('span');
  label.className = 'message-attachment-name';
  label.textContent = presentation.label;
  item.appendChild(label);
  return label;
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
    let thumbnailCount = 0;
    for (const attachment of meta.attachments) {
      const item = document.createElement('div'); item.className = 'message-attachment-card';
      const presentation = attachmentDisplayPresentation(attachment);
      const previewUrl = attachment && typeof attachment.previewUrl === 'string' ? attachment.previewUrl : '';
      // The image branch needs a validated image media type AND a browser-local
      // preview; a filename suffix alone never promotes a file to a thumbnail.
      if (previewUrl && isPreviewableImageAttachment(attachment)) {
        item.classList.add('message-attachment-card-image');
        const image = document.createElement('img'); image.className = 'message-attachment-image';
        image.decoding = 'async'; image.loading = 'lazy';
        image.src = previewUrl; image.alt = presentation.imageAlt;
        // A revoked or unreadable preview falls back to the file card instead of
        // leaving a broken image behind.
        image.addEventListener('error', () => {
          item.classList.remove('message-attachment-card-image');
          image.replaceWith(createAttachmentIcon(attachment));
          if (!item.querySelector('.message-attachment-name')) appendAttachmentLabel(item, presentation);
          list.dataset.imageCount = String(Math.max(0, Number(list.dataset.imageCount || 0) - 1));
          // Without a thumbnail there is nothing left to carry the turn, so the
          // placeholder sentence becomes visible again.
          article.classList.remove('chat-message-attachment-only');
          body.classList.remove('sr-only');
        }, {once: true});
        item.appendChild(image);
        thumbnailCount += 1;
      } else {
        item.appendChild(createAttachmentIcon(attachment));
        appendAttachmentLabel(item, presentation);
      }
      list.appendChild(item);
    }
    if (thumbnailCount) list.dataset.imageCount = String(thumbnailCount);
    // §5 — on an image-only turn the thumbnail is the content; the generated
    // sentence stays in the DOM for assistive technology only.
    if (role === 'user' && meta.attachments.length && text === attachmentOnlyPlaceholder(meta.attachments.length)) {
      article.classList.add('chat-message-attachment-only');
      body.classList.add('sr-only');
    }
    article.appendChild(list);
  }
  if (meta.followUpRequired) {
    const note = document.createElement('span');
    note.className = 'chat-message-meta'; note.textContent = '추가 확인이 필요합니다.';
    article.appendChild(note);
  }
  if (role === 'assistant' && meta.completion === 'PARTIAL') {
    const note = document.createElement('span');
    note.className = 'chat-message-meta';
    note.textContent = '일부 최신 자료로 확인된 답변입니다.';
    article.appendChild(note);
  }
  if (role === 'assistant' && Array.isArray(meta.sources) && meta.sources.length) {
    const sources = document.createElement('div');
    sources.className = 'chat-message-sources';
    sources.setAttribute('aria-label', '출처');
    const label = document.createElement('span');
    label.className = 'chat-message-sources-label';
    label.textContent = '출처';
    sources.appendChild(label);
    for (const source of meta.sources) {
      if (!source || typeof source.title !== 'string' || typeof source.url !== 'string') continue;
      const link = document.createElement('a');
      link.className = 'chat-message-source-link';
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title;
      sources.appendChild(link);
    }
    if (sources.querySelector('a')) article.appendChild(sources);
  }
  // An image-only turn keeps its one-sentence placeholder hidden, so there is
  // nothing for a "더 보기" control to expand.
  if (role === 'user' && !article.classList.contains('chat-message-attachment-only')) {
    enhanceExpandableUserMessage(article, body, text);
  }
  return article;
}
function createLoadingMessage(text) {
  const article = createMessage('assistant', text);
  article.classList.add('chat-message-loading');
  article.dataset.transient = 'true';
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
  // Never "come back next month". Telling someone to wait four weeks is the
  // same as telling them to leave, and Core already says an upgrade is the way
  // on — showError turns that into a link they can actually press.
  if (error instanceof SiteCoreError && error.code === 'FREE_LIMIT_REACHED') return '이번 달 무료 AI 답변을 다 쓰셨어요. LOTBI Plus를 시작하면 이어서 물어보실 수 있습니다.';
  if (error instanceof SiteCoreError && error.code === 'GUEST_RATE_LIMITED') return '익명 대화 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof SiteCoreError && error.code === 'GUEST_AI_REQUEST_IN_PROGRESS') return '같은 질문을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof SiteCoreError && (error.code === 'GUEST_AI_OUTCOME_UNCERTAIN' || error.code === 'GUEST_AI_RECONCILIATION_REQUIRED')) return '이 요청은 중복 실행을 막기 위해 자동으로 다시 보내지 않습니다. 새 메시지로 다시 질문해 주세요.';
  if (error instanceof SiteCoreError && (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_RESPONSE_UNAVAILABLE')) return 'LOTBI AI 응답을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof Error) return error.message;
  return 'LOTBI 대화를 완료하지 못했습니다.';
}
// SITE-VOICE-RECOGNITION-TIMEOUT-GUARD-01 — some browsers hand us a working
// SpeechRecognition constructor that then never reports anything: start()
// returns cleanly and no event ever arrives, not onstart, not onerror, not
// onend. Measured here on a Chromium build with no speech backend, and the
// same shape is what in-app WebViews show. The feature test above cannot see
// it, so without a deadline the composer sits on "마이크 권한을 확인하고
// 있습니다." forever. Both waits below are bounded, and every bounded path puts
// the mic button back the way it was before the click.
// SITE-VOICE-AUTOSEND-01 — speech that only lands in the textarea still needs a
// second tap to send, which is most of the reason someone spoke instead of
// typing. So send it — but not blind: the recogniser mishears often enough that
// firing instantly would put the wrong question to LOTBI. A short window lets
// the person stop it, and any move toward the textarea stops it too.
const VOICE_AUTOSEND_DELAY_MS = 2500;
const VOICE_AUTOSEND_PENDING_MESSAGE = '곧 보낼게요.';
const VOICE_AUTOSEND_CANCELLED_MESSAGE = '보내지 않았습니다. 고친 뒤 전송을 눌러 주세요.';
const VOICE_NOTHING_HEARD_MESSAGE = '잘 못 들었어요. 다시 말씀해 주시거나 입력해 주세요.';
const VOICE_WAKE_ONLY_MESSAGE = '네, 듣고 있어요. 마이크를 다시 눌러 무엇을 도와드릴지 말씀해 주세요.';
const VOICE_PERMISSION_TIMEOUT_MS = 10000;
const VOICE_RECOGNITION_START_TIMEOUT_MS = 5000;
const VOICE_ENGINE_SILENT_MESSAGE = '이 브라우저에서는 음성 인식이 동작하지 않네요. 아래에 입력해 주시면 제가 바로 답해 드릴게요.';
const VOICE_PERMISSION_TIMEOUT_MESSAGE = '마이크 권한 확인이 끝나지 않았습니다. 아래에 입력해 주시면 제가 바로 답해 드릴게요.';

// Carries a message already written for the person, so voiceErrorMessage can
// hand it straight through instead of flattening it to the generic failure.
class VoiceGuardError extends Error {
  constructor(message) { super(message); this.name = 'VoiceGuardError'; }
}

function voiceErrorMessage(error) {
  const name = error && typeof error === 'object' && typeof error.name === 'string' ? error.name : '';
  const code = error && typeof error === 'object' && typeof error.error === 'string' ? error.error : '';
  if (name === 'VoiceGuardError') return error.message;
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
  const first = nodes[0]; const last = node…36511 tokens truncated… = true; micButton.dataset.requesting = 'true'; setVoiceFeedback('마이크 권한을 확인하고 있습니다.');
    try {
      await requestMicrophoneAccess(); const recognition = new SpeechRecognition(); voiceRecognition = recognition;
      recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => { clearVoiceStartDeadline(); voiceAvatarRequestId = nextAvatarRequestId('voice'); driveAvatar('listening-start', voiceAvatarRequestId); setListeningState(true); setVoiceFeedback('듣고 있습니다. 말씀해 주세요.'); };
      recognition.onresult = event => {
        const heard = event?.results?.[0]?.[0]?.transcript?.trim?.() || '';
        // Nothing usable came back. Say so plainly; never send an empty turn and
        // never stand in a guess for words we did not hear.
        if (!heard) { setVoiceFeedback(VOICE_NOTHING_HEARD_MESSAGE); prompt.focus(); return; }
        // "롯비야 내일 날씨" should ask about the weather, not about LOTBI's own
        // name. Drops a leading wake call; text that does not open with one
        // comes back untouched.
        const transcript = stripWakePrefix(heard);
        // A wake call with nothing after it is a call, not a question. Never
        // send an empty turn, and never invent the part that was not said.
        if (!transcript) { setVoiceFeedback(VOICE_WAKE_ONLY_MESSAGE); prompt.focus(); return; }
        const current = prompt.value.trimEnd(); prompt.value = current ? `${current} ${transcript}` : transcript;
        prompt.dispatchEvent(new Event('input', {bubbles: true}));
        beginVoiceAutoSend();
      };
      recognition.onerror = event => { clearVoiceStartDeadline(); setVoiceFeedback(voiceErrorMessage(event)); };
      recognition.onend = () => { clearVoiceStartDeadline(); if (voiceAvatarRequestId) driveAvatar('listening-end', voiceAvatarRequestId); voiceAvatarRequestId = undefined; setListeningState(false); if (voiceRecognition === recognition) voiceRecognition = undefined; updateSendState(); prompt.focus(); };
      recognition.start();
      voiceStartDeadline = setTimeout(() => abandonSilentVoiceEngine(recognition), VOICE_RECOGNITION_START_TIMEOUT_MS);
    } catch (error) { clearVoiceStartDeadline(); voiceRecognition = undefined; setListeningState(false); setVoiceFeedback(voiceErrorMessage(error)); prompt.focus(); }
    finally { voiceRequesting = false; delete micButton.dataset.requesting; updateSendState(); }
  };
  const showError = (error, retryText, retryWithoutDuplicate, logicalRequestId = '', turnCreatedAt = 0) => {
    const wrapper = document.createElement('article'); wrapper.className = 'chat-message chat-message-error'; wrapper.setAttribute('role', 'alert');
    const body = document.createElement('p'); body.className = 'chat-message-body'; body.textContent = userFacingErrorMessage(error); wrapper.appendChild(body);
    appendSafeErrorEvidence(wrapper, error); logSafeConversationFailure(error);
    // Core marks the refusals an owner can clear themselves. Those get the one
    // control that clears them, so the message is a way forward rather than a
    // dead end the owner has to guess their way out of.
    if (error instanceof SiteCoreError && error.upgradeAvailable && error.upgradeAction === 'VIEW_SUBSCRIPTION_OPTIONS') {
      const upgrade = document.createElement('a');
      upgrade.className = 'chat-retry-button chat-upgrade-link';
      upgrade.href = 'https://account.lotbiai.com/account';
      upgrade.textContent = 'LOTBI Plus 살펴보기';
      wrapper.appendChild(upgrade);
    }
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
    const suggestedPetAction = petConversationAction(message, attachments);
    const turnGeneration = ++activeTurnGeneration;
    const turnStillActive = () => turnGeneration === activeTurnGeneration;
    const beginRequestThinking = logicalRequestId => {
      let handle;
      handle = beginThinking({
        attachments,
        text: message,
        onTimeout: () => {
          if (!turnStillActive()) return;
          handle?.stop('timeout');
          activeTurnGeneration += 1;
          inFlight = false;
          updateSendState();
          const timeoutError = new Error('응답 시간이 오래 걸려 중단했어요. 다시 시도해 주세요.');
          showError(timeoutError, message, true, logicalRequestId, sourceTurnCreatedAt);
          setStatus('LOTBI 응답 시간이 초과되었습니다.');
          prompt.focus();
        },
      });
      return handle;
    };
    const submittedAt = performanceNow(); const requestsBefore = resourceCounts(); recordTiming('T0-submit', {length: message.length, attachmentCount: attachments.length});
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || anonymousConversationNamespace());
    const displayMessage = message || `첨부 파일 ${attachments.length}개를 확인해 주세요.`;
    const activeConversation = ensureThread(displayMessage);
    const activeConversationId = activeConversation?.id || state.activeThreadId || '';
    if (appendUserMessage) {
      // previewUrl is ephemeral browser-local UI state: it is never sent to
      // Core, never persisted, and never logged. Ownership moves to the
      // rendered message so composer cleanup cannot revoke it.
      const attachmentMeta = attachments.map(item => {
        const previewUrl = isPreviewableImageAttachment(item) && typeof item.previewUrl === 'string' ? item.previewUrl : '';
        if (previewUrl) adoptAttachmentPreviewUrl(previewUrl);
        return {id: item.id, filename: item.fileName, mediaType: item.mimeType, sizeBytes: item.sizeBytes, previewUrl};
      });
      const persistedAttachments = attachments.map(item => ({
        id: item.id,
        mediaType: item.mimeType,
        sizeBytes: item.sizeBytes,
      }));
      const userRecord = timestampedConversationMessage({role: 'user', text: displayMessage, meta: {}}, sourceTurnCreatedAt);
      appendConversationRecord({...userRecord, meta: {attachments: attachmentMeta}}, {forceScroll: true});
      appendPersistedMessage({...userRecord, meta: {attachments: persistedAttachments}});
    }
    const local = attachments.length ? null : deterministicReply(message);
    if (local) {
      diagnostics.lastPath = 'LOCAL_DETERMINISTIC'; diagnostics.deterministicReplies += 1; diagnostics.providerCallsAvoided += 1;
      recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0}); await Promise.resolve();
      const record = timestampedConversationMessage({
        role: 'assistant',
        text: local,
        meta: {
          status: 'ANSWERED',
          responseMode: 'LOCAL_DETERMINISTIC',
          ...(suggestedPetAction ? {petAction: suggestedPetAction} : {}),
        },
      });
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
      const calendarRequestId = logicalRequestId || newId('calendar-guest-direct');
      const thinking = beginRequestThinking(calendarRequestId); inFlight = true; updateSendState();
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
        if (!turnStillActive()) return;
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
        if (!turnStillActive()) return;
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
        thinking.stop('answer');
        appendConversationRecord(calendarRecord);
        appendPersistedMessage(calendarRecord);
        diagnostics.lastPath = 'CORE_CALENDAR_GUEST_DETERMINISTIC';
        diagnostics.coreCalls += 1;
        diagnostics.providerCallsAvoided += 1;
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('이 브라우저 캘린더에 일정을 등록했습니다.');
      } catch (caught) {
        if (!turnStillActive()) return;
        thinking.stop('error');
        showError(caught, message, true, calendarRequestId, sourceTurnCreatedAt);
      } finally {
        if (turnStillActive()) {
          thinking.stop('cancel');
          inFlight = false;
          updateSendState();
          prompt.focus();
        }
      }
      return;
    }
    if (!sessionToken) {
      const guestRequestId = logicalRequestId || newId('guest-ai');
      const thinking = beginRequestThinking(guestRequestId); inFlight = true; updateSendState(); setVoiceFeedback('');
      diagnostics.lastPath = 'CORE_GUEST_CONVERSATION'; diagnostics.coreCalls += 1;
      const coreStartedAt = performanceNow(); recordTiming('T1-core-guest-request', {coreCall: diagnostics.coreCalls});
      try {
        const token = await ensureGuestSession();
        if (!turnStillActive()) return;
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
        if (!turnStillActive()) return;
        diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt));
        recordTiming('T2-core-guest-response', {durationMs: diagnostics.lastCoreDurationMs});
        if (Number.isInteger(response.stateVersion) && response.stateVersion >= 0) {
          const currentThread = state.threads.find(item => item.id === activeConversationId);
          if (currentThread && response.stateVersion >= Number(currentThread.stateVersion || 0)) {
            currentThread.stateVersion = response.stateVersion;
            saveState();
          }
        }
        const meta = {status: response.status, responseMode: response.responseMode, completion: response.completion, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
        if (suggestedPetAction) meta.petAction = suggestedPetAction;
        if (Array.isArray(response.sources) && response.sources.length) meta.sources = response.sources;
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
            if (!turnStillActive()) return;
            richProduct = compactRichProductMeta({displayId: publicResult.displayId, query: publicResult.query, originalText: message, merchant: publicResult.merchant, sourceMode: publicResult.sourceMode, expired: false, cards: publicResult.cards});
          } catch (cardError) {
            console.info('[LOTBI public rich product cards unavailable]', {code: cardError instanceof SiteCoreError ? cardError.code : 'UNKNOWN'});
          }
        }
        if (richProduct) meta.richProduct = richProduct;
        const placeResult = compactPlaceResultMeta(response.placeResult);
        if (placeResult) meta.placeResult = placeResult;
        const assistantRecord = timestampedConversationMessage({role: 'assistant', text: response.assistantText, meta});
        thinking.stop('answer');
        appendConversationRecord(assistantRecord); appendPersistedMessage(assistantRecord);
        if (attachments.length) clearSentAttachments(attachments, {guest: token});
        diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 2 : 1});
        setStatus(placeResult ? '로그인 없이 실제 장소 카드와 네이버지도 길안내를 준비했습니다.' : (richProduct ? '로그인 없이 실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.')));
      } catch (caught) {
        if (!turnStillActive()) return;
        thinking.stop('error');
        if (isGuestSessionError(caught)) clearGuestSession();
        showError(caught, message, true, guestRequestId, sourceTurnCreatedAt);
        setStatus('LOTBI 대화를 완료하지 못했습니다.');
      } finally {
        if (turnStillActive()) { thinking.stop('cancel'); inFlight = false; updateSendState(); prompt.focus(); }
      }
      return;
    }
    if (!attachments.length && isExplicitLifeCalendarCommand(message)) {
      const calendarRequestId = logicalRequestId || newId('calendar');
      const thinking = beginRequestThinking(calendarRequestId); inFlight = true; updateSendState();
      try {
        const calendar = await executeLifeCalendarCommand(sessionToken, {
          logicalRequestId: calendarRequestId, text: message,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
          turnCreatedAt: sourceTurnCreatedAtIso,
        });
        if (!turnStillActive()) return;
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
        thinking.stop('answer');
        appendConversationRecord(calendarRecord);
        appendPersistedMessage(calendarRecord);
        diagnostics.lastPath = 'CORE_CALENDAR_DETERMINISTIC'; diagnostics.coreCalls += 1; diagnostics.providerCallsAvoided += 1;
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('일정을 추가하고 달력을 새로 고쳤습니다.');
      } catch (caught) {
        if (!turnStillActive()) return;
        thinking.stop('error'); if (isSessionError(caught)) sessionToken = undefined;
        showError(caught, message, true, calendarRequestId, sourceTurnCreatedAt);
      } finally {
        if (turnStillActive()) { thinking.stop('cancel'); inFlight = false; updateSendState(); prompt.focus(); }
      }
      return;
    }
    const authenticatedRequestId = logicalRequestId || newId('auth-ai');
    const thinking = beginRequestThinking(authenticatedRequestId); inFlight = true; updateSendState(); setVoiceFeedback('');
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
      if (!turnStillActive()) return;
      diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt)); recordTiming('T2-core-response', {durationMs: diagnostics.lastCoreDurationMs});
      if (Number.isInteger(response.stateVersion) && response.stateVersion >= 0) {
        const currentThread = state.threads.find(item => item.id === activeConversationId);
        if (currentThread && response.stateVersion >= Number(currentThread.stateVersion || 0)) {
          currentThread.stateVersion = response.stateVersion;
          saveState();
        }
      }
      const meta = {status: response.status, responseMode: response.responseMode, completion: response.completion, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
      if (suggestedPetAction) meta.petAction = suggestedPetAction;
      if (Array.isArray(response.sources) && response.sources.length) meta.sources = response.sources;
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
          if (!turnStillActive()) return;
          const cards = await getProductCards(sessionToken, discovery.resolutionId);
          if (!turnStillActive()) return;
          richProduct = compactRichProductMeta({resolutionId: cards.resolutionId, resolutionHash: cards.resolutionHash, query: cards.query, originalText: message, merchant: discovery.merchant, sourceMode: cards.sourceMode || discovery.sourceMode, expired: cards.expired, cards: cards.cards});
        } catch (cardError) {
          console.info('[LOTBI rich product cards unavailable]', {code: cardError instanceof SiteCoreError ? cardError.code : 'UNKNOWN'});
        }
      }
      if (richProduct) meta.richProduct = richProduct;
      const placeResult = compactPlaceResultMeta(response.placeResult);
      if (placeResult) meta.placeResult = placeResult;
      const assistantRecord = timestampedConversationMessage({role: 'assistant', text: response.assistantText, meta});
      thinking.stop('answer');
      appendConversationRecord(assistantRecord); appendPersistedMessage(assistantRecord);
      if (attachments.length) clearSentAttachments(attachments, {session: activeSessionToken});
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: richProduct ? 3 : 1});
      setStatus(placeResult ? '실제 장소 카드와 네이버지도 길안내를 준비했습니다.' : (richProduct ? '실제 판매처 상품 카드를 확인했습니다.' : (response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.')));
    } catch (caught) {
      if (!turnStillActive()) return;
      thinking.stop('error'); if (isSessionError(caught)) sessionToken = undefined;
      showError(caught, message, true, authenticatedRequestId, sourceTurnCreatedAt); setStatus('LOTBI 대화를 완료하지 못했습니다.');
    } finally {
      if (turnStillActive()) { thinking.stop('cancel'); inFlight = false; updateSendState(); prompt.focus(); }
    }
  };
  window.addEventListener('lotbi:keyboard-viewport', () => {
    if (!thread.hidden && isThreadNearBottom()) {
      requestAnimationFrame(scrollThread);
    }
  });

  const submitCurrentPrompt = async () => {
    cancelVoiceAutoSend();
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
  // Reaching for the textarea means they want to fix the transcript themselves.
  // Bound to real interaction only — never to the synthetic 'input' event the
  // transcript dispatches, which would cancel the send it just scheduled.
  for (const interaction of ['beforeinput', 'keydown', 'pointerdown']) {
    prompt.addEventListener(interaction, () => {
      if (cancelVoiceAutoSend()) setVoiceFeedback(VOICE_AUTOSEND_CANCELLED_MESSAGE);
    });
  }
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

  // SITE-VOICE-WAKE-LISTENER-01 — hands-free calling, within what a browser
  // actually allows. The control stays hidden where the engine cannot do this
  // at all: a toggle that can never work is worse than no toggle.
  if (wakeButton instanceof HTMLButtonElement && wakeListeningSupported()) {
    const setWakeUi = (listening, message = '') => {
      wakeButton.setAttribute('aria-pressed', String(listening));
      wakeButton.setAttribute('aria-label', listening ? '롯비야 듣기 끄기' : '롯비야 듣기 켜기');
      wakeButton.title = listening ? '듣는 중 — 「롯비야」 하고 불러 주세요' : '롯비야 듣기 켜기';
      if (listening) wakeButton.dataset.listening = 'true'; else delete wakeButton.dataset.listening;
      if (message) setVoiceFeedback(message);
    };
    const wakeListener = createWakeListener({
      onCommand: command => {
        // Only the words after the call reach here, and only when there were
        // some. Straight into the composer and through the same auto-send
        // window as the mic button, so a mishearing is still catchable.
        const current = prompt.value.trimEnd();
        prompt.value = current ? `${current} ${command}` : command;
        prompt.dispatchEvent(new Event('input', {bubbles: true}));
        setWakeUi(false);
        beginVoiceAutoSend();
      },
      onState: (state, detail) => {
        if (state === 'listening') { setWakeUi(true, '「롯비야」 하고 불러 주세요.'); return; }
        if (state === 'unavailable') {
          setWakeUi(false);
          writeWakePreference(storage, false);
          setVoiceFeedback(detail === 'permission'
            ? '마이크 권한이 없어 롯비야 듣기를 껐습니다. 브라우저의 사이트 권한에서 마이크를 허용해 주세요.'
            : '이 브라우저에서는 롯비야 듣기가 동작하지 않네요. 마이크 버튼이나 입력창을 써 주세요.');
          return;
        }
        // 'idle' while the preference is still on means the tab went to the
        // background. Say so rather than leaving the button looking broken —
        // no browser keeps a microphone open behind another screen.
        setWakeUi(false, detail === 'hidden' ? '화면이 가려져 있는 동안에는 듣지 못합니다. 돌아오면 다시 듣습니다.' : '');
      },
    });
    wakeButton.hidden = false;
    wakeButton.disabled = false;
    // The markup ships disabled and labelled "준비 중" so it never looks live
    // before this runs. It is live now, so say what it does.
    setWakeUi(false);
    wakeButton.addEventListener('click', async () => {
      if (wakeListener.isEnabled()) {
        wakeListener.disable(); writeWakePreference(storage, false);
        setVoiceFeedback('롯비야 듣기를 껐습니다.');
        return;
      }
      wakeButton.disabled = true;
      try {
        // The permission prompt has to come out of this click, never on its own.
        await requestMicrophoneAccess();
        if (wakeListener.enable()) writeWakePreference(storage, true);
      } catch (error) { setVoiceFeedback(voiceErrorMessage(error)); }
      finally { wakeButton.disabled = false; }
    });
    // A preference set on an earlier visit is remembered, but it does not start
    // a microphone on its own: this page has had no user action yet, and the
    // browser would refuse the permission anyway. The button shows it is armed.
    if (readWakePreference(storage)) {
      wakeButton.title = '롯비야 듣기 켜기 — 눌러서 다시 시작';
    }
  }
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-conversation-menu]')) closeConversationMenus();
    if (attachmentMenuOpen && !target?.closest('[data-attachment-control]')) closeAttachmentMenu();
    if (responseGradeOpen && !target?.closest('[data-response-grade-control]')) closeResponseGradeMenu();
    const homePrompt = target?.closest('[data-home-prompt]');
    if (homePrompt instanceof HTMLButtonElement) {
      event.preventDefault();
      prompt.value = String(homePrompt.dataset.homePrompt || '').slice(0, 1000);
      prompt.dispatchEvent(new Event('input', {bubbles: true}));
      prompt.focus();
      setStatus('예시 요청을 입력창에 넣었습니다. 내용을 바꾸거나 바로 전송할 수 있습니다.');
      return;
    }
    const globalNavAction = target?.closest('[data-global-nav-action]');
    if (globalNavAction instanceof HTMLButtonElement) {
      event.preventDefault();
      closeMobileDrawer();
      const action = globalNavAction.dataset.globalNavAction;
      if (action === 'profile') openProfile();
      else if (action === 'settings') openSettings();
      else if (action === 'help') openHelp();
      return;
    }
    const petFamilyTrigger = target?.closest('[data-pet-family-open]');
    if (petFamilyTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      void openPetFamily();
      return;
    }
    const petChatAction = target?.closest('[data-pet-chat-action]');
    if (petChatAction instanceof HTMLButtonElement) {
      event.preventDefault();
      void openPetFamily(petChatAction.dataset.petChatAction || 'pets');
      return;
    }
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
  // Page teardown releases every object URL. A bfcache-persisted page keeps its
  // previews so a back-navigation does not restore broken images.
  window.addEventListener('pagehide', event => {
    cancelActiveTurn('pagehide');
    if (event instanceof PageTransitionEvent && event.persisted) return;
    releaseAllAttachmentPreviewUrls();
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
    renderNavigationCalendarStatus({count: 0, hasReminder: false});
    void refreshNavigationCalendarStatus();
  });
  window.addEventListener(SIDEBAR_RENDERED_EVENT, () => {
    bindCalendarEntries();
    refreshAuthenticatedProfileSlots();
    if (!stateReady && document.body.dataset.siteAuthState === 'unauthenticated') {
      switchNamespace(anonymousConversationNamespace());
    }
    void refreshNavigationCalendarStatus();
  });
  void refreshNavigationCalendarStatus();
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
