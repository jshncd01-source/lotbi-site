import {beginSiteHandoff, markSiteLogoutSuppression} from './site-auth.js?v=aset-5fe7088d75dd';
import * as siteCore from './site-core.js?v=aset-5fe7088d75dd';
import './site-scam-shield.js?v=aset-5fe7088d75dd';
import {mountConsumerSection} from './site-consumer-sections.js?v=aset-5fe7088d75dd';
import {buildDefaultMapHref, buildVerifiedPhoneHref, defaultMapProviderPresentation, isPlaceResultFresh, normalizePlaceResult, placeLifeBadges} from './site-navigation.js?v=aset-5fe7088d75dd';
import {readDefaultMapProvider} from './site-location-preference.js?v=aset-5fe7088d75dd';
import * as siteAttachments from './site-attachments.js?v=aset-5fe7088d75dd';
import {formatConversationTimestamp, millisecondsUntilNextLocalMidnight, shouldShowConversationSeparator, timestampedConversationMessage} from './site-conversation-timeline.js?v=aset-5fe7088d75dd';
import {deterministicReply} from './site-deterministic.js?v=aset-5fe7088d75dd';
import {ensureDurableAnonymousConversationNamespace, guestConversationThreadClaimed, markConversationTabEntry, prepareGuestConversationClaimIntent} from './site-conversation-storage.js?v=aset-5fe7088d75dd';
import {executeLifeCalendarCommand, getLifeToday, isExplicitLifeCalendarCommand, previewLifeCalendarCommand} from './site-calendar.js?v=aset-5fe7088d75dd';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-5fe7088d75dd';
import {calendarActionInFlight, createAvailableCalendarAction, normalizePersistedCalendarAction, recoverCalendarActionAfterReload, runCalendarAction} from './site-calendar-actions.js?v=aset-5fe7088d75dd';
import {CALENDAR_DRAFT_WRITE_STATE, registerCalendarDraft} from './site-calendar-draft-write.js?v=aset-5fe7088d75dd';
import {mountLifeCalendarManager} from './site-calendar-ui.js?v=aset-5fe7088d75dd';
import {createIconButton, createSafeMessageBody, enhanceExpandableUserMessage} from './site-message-body.js?v=aset-5fe7088d75dd';
import {createReusableOutputCard} from './site-output-card.js?v=aset-5fe7088d75dd';
import {createWakeListener, readWakePreference, stripWakePrefix, wakeListeningSupported, writeWakePreference} from './site-voice-wake.js?v=aset-5fe7088d75dd';
import {createThinkingPresentation, selectThinkingKind} from './site-chat-thinking.js?v=aset-5fe7088d75dd';
import {createBackdropDismissGuard} from './site-surface-dismiss.js?v=aset-5fe7088d75dd';
import {resolveLifeLocationContext} from './site-life-location.js?v=aset-5fe7088d75dd';
import {clearSchoolPreference, compactSchoolResultMeta, createSchoolResultCard, readSchoolPreference, schoolContextForMessage, writeSchoolPreference} from './site-life-school.js?v=aset-5fe7088d75dd';
import {createEmergencyCallNotice, medicalStatusLines} from './site-life-medical.js?v=aset-5fe7088d75dd';
const {analyzeScamShield, createGuestConversationSession, deleteConversationAttachment, getCurrentSiteUser, getCurrentSubscription, getProductCards, logoutSiteSession, normalizeCalendarPartialCandidate, normalizeReusableOutput, normalizeSmartCalendarDraft, reviewProductCard, searchProductCards, searchPublicProductCards, sendConversationMessage, sendGuestConversationMessage, uploadConversationAttachment, SiteCoreError} = siteCore;
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
const ACCOUNT_MANAGE_ORIGIN = 'https://account.lotbiai.com';
function isProfilePhotoEmbed() {
  return window.parent !== window && (
    new URLSearchParams(window.location.search).get('embed') === 'profile-photo'
    || window.location.hash === '#profile-photo'
  );
}
if (isProfilePhotoEmbed()) document.documentElement.dataset.profilePhotoEmbed = 'true';
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
  link.href = '/site-conversation.css?v=aset-5fe7088d75dd';  link.dataset.siteConversationStyles = 'true';
  document.head.appendChild(link);}

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

// SITE-MESSAGE-SHARE-ACTIONS-02 — the answer share control intentionally has
// exactly two destinations: copy the canonical LOTBI link or open KakaoTalk.
// It never delegates to the operating-system share sheet, whose changing list
// of apps made this control unpredictable.
const MESSAGE_ACTION_SHARE_URL = 'https://lotbiai.com/';
const MESSAGE_ACTION_ICON_COPY = 'M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16h-9V7h9v14Z';
const MESSAGE_ACTION_ICON_SHARE = 'M12 2 7.5 6.5l1.4 1.4L11 5.8V16h2V5.8l2.1 2.1 1.4-1.4L12 2ZM5 12v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h-2v8H7v-8H5Z';
const SHARE_MENU_ICON_LINK = 'M10.59 13.41a2 2 0 0 1 0-2.82l3-3a2 2 0 0 1 2.82 2.82l-1.29 1.3 1.41 1.41 1.3-1.29a4 4 0 0 0-5.66-5.66l-3 3a4 4 0 0 0 0 5.66l.12.12 1.42-1.42-.12-.12Zm2.82-2.82-.12-.12-1.42 1.42.12.12a2 2 0 0 1 0 2.82l-3 3a2 2 0 1 1-2.82-2.82l1.29-1.3-1.41-1.41-1.3 1.29a4 4 0 0 0 5.66 5.66l3-3a4 4 0 0 0 0-5.66Z';
const SHARE_MENU_ICON_KAKAO = 'M12 3C6.48 3 2 6.46 2 10.73c0 2.76 1.86 5.19 4.67 6.56l-.95 3.49a.42.42 0 0 0 .64.46l4.22-2.79c.46.05.93.08 1.42.08 5.52 0 10-3.46 10-7.8S17.52 3 12 3Z';
// SITE-MESSAGE-CALENDAR-ACTION-01 — a footer shortcut into the same editor
// every other Calendar entry point already opens through (openCalendar with
// initialDraft). It never registers by itself: only fields already known to
// this message (a settled calendarDraft, or the first place result's name and
// address) are pre-filled, and a message with neither opens a blank entry.
const MESSAGE_ACTION_ICON_CALENDAR = 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V8h14v11Z';
const MESSAGE_ACTION_FEEDBACK_MS = 2600;
let shareMenuSequence = 0;

// Resolves 'shared' (KakaoTalk opened) or 'copied' (KakaoTalk sharing is not
// configured in Core yet, so the answer and link were copied instead).
async function shareMessageWithKakao(options) {
  const {shareWithKakaoTalk} = await import('./site-kakao-share.js?v=aset-5fe7088d75dd');
  return shareWithKakaoTalk({...options, copyFallback: writeMessageTextToClipboard});
}

// Asks Core once, ahead of the tap, whether KakaoTalk sharing is configured,
// so a tap that falls back to copying still writes inside the user gesture.
function prepareKakaoShare() {
  void import('./site-kakao-share.js?v=aset-5fe7088d75dd')
    .then(module => module.loadKakaoShareConfig())
    .catch(() => {});
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

function createShareMenuItem(label, iconPath, action) {
  const item = createIconButton({className: 'lotbi-share-menu-item', label, iconPath, dataset: {shareAction: action}});
  item.setAttribute('role', 'menuitem');
  const text = document.createElement('span');
  text.textContent = label;
  item.appendChild(text);
  return item;
}

function createMessageActions(text, announce, {calendarDraft = null, openCalendarDraft} = {}) {
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

  // Calendar is a launcher, never a writer: it always opens the same editor
  // dialog every other Calendar entry point uses, pre-filled with only the
  // fields this message already carries, and it never calls a register/save
  // function directly from here.
  const calendar = createIconButton({className: 'chat-message-action', label: '캘린더에 추가', iconPath: MESSAGE_ACTION_ICON_CALENDAR, dataset: {messageAction: 'calendar'}});
  calendar.addEventListener('click', () => {
    if (typeof openCalendarDraft !== 'function') return;
    void openCalendarDraft(calendarDraft).catch(() => report('캘린더를 열지 못했습니다.', 'error'));
  });

  const shareMenu = document.createElement('div');
  shareMenu.className = 'lotbi-share-menu';
  shareMenu.id = `lotbi-share-menu-${++shareMenuSequence}`;
  shareMenu.setAttribute('role', 'menu');
  shareMenu.setAttribute('aria-label', '공유 방법');
  shareMenu.hidden = true;
  share.setAttribute('aria-haspopup', 'menu');
  share.setAttribute('aria-controls', shareMenu.id);
  share.setAttribute('aria-expanded', 'false');

  const linkCopy = createShareMenuItem('링크 복사', SHARE_MENU_ICON_LINK, 'link-copy');
  const kakao = createShareMenuItem('카카오톡 공유하기', SHARE_MENU_ICON_KAKAO, 'kakaotalk');
  shareMenu.append(linkCopy, kakao);

  const menuItems = () => [...shareMenu.querySelectorAll('[role="menuitem"]')];
  const closeShareMenu = ({restoreFocus = false} = {}) => {
    if (shareMenu.hidden) return;
    shareMenu.hidden = true;
    share.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutsideShareMenu);
    if (restoreFocus) share.focus();
  };
  const onOutsideShareMenu = event => {
    if (!actions.contains(event.target)) closeShareMenu();
  };
  const openShareMenu = () => {
    prepareKakaoShare();
    shareMenu.hidden = false;
    share.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutsideShareMenu);
    menuItems()[0]?.focus();
  };
  share.addEventListener('click', () => {
    if (shareMenu.hidden) openShareMenu(); else closeShareMenu({restoreFocus: true});
  });
  shareMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeShareMenu({restoreFocus: true}); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = menuItems();
    const current = Math.max(0, items.indexOf(document.activeElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  });
  linkCopy.addEventListener('click', async () => {
    closeShareMenu();
    try { await writeMessageTextToClipboard(MESSAGE_ACTION_SHARE_URL); report('링크를 복사했습니다.'); }
    catch { report('링크를 복사하지 못했습니다.', 'error'); }
  });
  kakao.addEventListener('click', async () => {
    closeShareMenu();
    try {
      const result = await shareMessageWithKakao({text: value, url: MESSAGE_ACTION_SHARE_URL});
      if (result === 'copied') {
        report('복사했어요. 카카오톡에 붙여넣어 공유해 주세요.');
        return;
      }
      report('카카오톡 공유 화면을 열었습니다.');
    } catch (error) {
      report(
        error?.message === 'KAKAO_SHARE_COPY_FAILED'
          ? '복사하지 못했습니다. 답변을 길게 눌러 직접 선택해 주세요.'
          : '카카오톡 공유 화면을 열지 못했습니다.',
        'error',
      );
    }
  });

  actions.append(copy, share, calendar, feedback, shareMenu);
  return actions;
}

// Only fields this message already has, never a guess: a settled calendar
// draft wins outright (it already went through CHATPERF-05's own contract),
// otherwise the first place result lends its name and address and nothing
// else — no date, no time, nothing this message never said.
//
// Always an object, never null: openCalendar's editor only opens itself when
// initialDraft is an object (site-calendar-manager.js's openDeepTarget), so a
// message with nothing to pre-fill still has to reach the blank 일정 등록
// editor rather than silently landing on the plain calendar view.
function calendarDraftHintFromMessage(message, place) {
  const draft = message?.meta?.calendarDraft;
  if (draft && typeof draft === 'object' && (draft.title || draft.localDate)) {
    return {title: draft.title, localDate: draft.localDate, localTime: draft.localTime, entry: draft.entry};
  }
  const primaryPlace = place?.results?.[0];
  if (primaryPlace?.name) {
    return {title: primaryPlace.name, entry: primaryPlace.address ? {place: primaryPlace.address} : undefined};
  }
  return {};
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

const ANIMAL_HOSPITAL_NEARBY_PROMPT = '근처 동물병원 찾아줘';

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
const PUBLIC_SITE_VOICE_RELEASE_ENABLED = false;

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
  const wakeButton = document.querySelector('[data-wake-toggle]');
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
    || !(attachmentControl instanceof HTMLElement)
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
  let stateReady = false, inFlight = false, voiceRequesting = false, voiceListening = false, voiceRecognition, voiceStartDeadline, voiceAutoSendTimer, activeVoiceConsumer;
  let lastRenderedCreatedAt;
  let timestampRefreshTimer;
  let themeBoundaryTimer;
  let richCardActionInFlight = false;
  let guestSessionToken, guestSessionExpiresAt = 0;
  let avatarSequence = 0, voiceAvatarRequestId, activeThinking, activeTurnGeneration = 0;
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
  window.addEventListener('lotbi:scam-shield-request', async event => {
    const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail : {};
    const resolve = typeof detail.resolve === 'function' ? detail.resolve : () => {};
    const reject = typeof detail.reject === 'function' ? detail.reject : () => {};
    try {
      if (!sessionToken) throw new SiteCoreError('진위확인은 개인정보 보호를 위해 로그인 후 사용할 수 있습니다.', {code: 'SCAM_SHIELD_SESSION_REQUIRED', status: 401});
      resolve(await analyzeScamShield(sessionToken, detail.formData));
    } catch (error) {
      if (error instanceof SiteCoreError && isSessionError(error)) sessionToken = undefined;
      reject(error);
    }
  });
  window.addEventListener('lotbi:scam-shield-session-request', event => {
    const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail : {};
    if (typeof detail.resolve === 'function') detail.resolve(Boolean(sessionToken));
  });
  window.addEventListener('lotbi:scam-shield-login-request', event => {
    const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail : {};
    const resolve = typeof detail.resolve === 'function' ? detail.resolve : () => {};
    const reject = typeof detail.reject === 'function' ? detail.reject : () => {};
    void beginSiteHandoff().then(resolve, reject);
  });
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
  const savePreferences = () => {
    if (storage && namespace && stateReady) storage.setItem(storageKey(namespace, 'preferences'), JSON.stringify(preferences));
    try { globalThis.localStorage?.setItem?.(SITE_THEME_BOOTSTRAP_KEY, preferences.theme); } catch {}
  };
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
  // SITE-THEME-AUTO-SCHEDULE-02 — only armed while '자동모드' is selected, and
  // always re-armed from the clock rather than a fixed interval, so a machine
  // that slept through 18:00 corrects itself on the next tick instead of drifting.
  const scheduleThemeBoundary = storedTheme => {
    if (themeBoundaryTimer) { clearTimeout(themeBoundaryTimer); themeBoundaryTimer = undefined; }
    if (storedTheme !== 'auto' || typeof setTimeout !== 'function') return;
    themeBoundaryTimer = setTimeout(() => { themeBoundaryTimer = undefined; applyPreferences(); }, millisecondsUntilNextThemeBoundary());
  };
  const applyPreferences = () => {
    document.body.dataset.chatColor = COLOR_OPTIONS.some(([key]) => key === preferences.color) ? preferences.color : 'default';
    // The stored preference may be '자동'; what reaches the document is always
    // one of the three states the theme tokens style.
    const storedTheme = THEME_OPTIONS.some(([key]) => key === preferences.theme) ? preferences.theme : 'system';
    const resolvedTheme = storedTheme === 'auto' ? resolveScheduledTheme() : storedTheme;
    document.body.dataset.siteThemePreference = storedTheme;
    document.body.dataset.siteTheme = resolvedTheme;
    document.documentElement.dataset.siteThemeBootstrap = resolvedTheme;
    scheduleThemeBoundary(storedTheme);
    const systemDark = resolvedTheme === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', resolvedTheme === 'dark' || systemDark ? '#212121' : '#ffffff');
    syncResponseGradeUi();
    document.body.dataset.responseGrade = preferences.responseGrade;
  };
  const restoreAvatarHome = () => { if (avatar.parentElement !== homeAvatarAnchor) homeAvatarAnchor.appendChild(avatar); };
  const showThread = () => { thread.hidden = false; document.body.classList.add('conversation-active'); };
  const resetBlankHomeScroll = () => {
    if (document.body.classList.contains('conversation-active')) return;
    mainScrollHost.scrollTop = 0;
    requestAnimationFrame(() => {
      if (!document.body.classList.contains('conversation-active')) mainScrollHost.scrollTop = 0;
    });
  };
  const showBlankHome = () => {
    restoreAvatarHome(); thread.replaceChildren(); lastRenderedCreatedAt = undefined; thread.hidden = true; document.body.classList.remove('conversation-active');
    resetBlankHomeScroll();
  };
  window.addEventListener('pageshow', resetBlankHomeScroll);
  const isThreadNearBottom = () => (
    mainScrollHost.scrollHeight - mainScrollHost.scrollTop - mainScrollHost.clientHeight <= 72
  );
  const scrollThread = () => { mainScrollHost.scrollTop = mainScrollHost.scrollHeight; };

  // SITE-ANSWER-SCROLL-FOLLOW-01 — a single scroll at append time is not enough
  // when the answer keeps growing afterwards. Measured at 390x844: appending a
  // long answer and scrolling synchronously lands exactly at the bottom (0px),
  // and then an image inside it finishes loading and the reader is 139px above
  // it. Product cards carry images, and "모델 추천해줘" is the request that
  // brings them, which is why that one felt like the scroll had not moved.
  //
  // So the intent to stay at the bottom outlives the append: it is held until
  // the reader scrolls away from the bottom themselves. Someone reading further
  // up is never pulled down — that is the whole reason this is a held intent
  // rather than an unconditional scroll on every resize.
  // The flag answers "was the reader at the bottom before this growth?", so it
  // is refreshed on every scroll and never by the growth itself: content
  // getting taller does not move scrollTop and so fires no scroll event, which
  // is exactly what makes the pre-growth answer survive long enough to act on.
  let followThreadBottom = true;
  mainScrollHost.addEventListener('scroll', () => {
    followThreadBottom = isThreadNearBottom();
  }, {passive: true});
  const stickThreadToBottom = () => { scrollThread(); followThreadBottom = true; };
  if (typeof ResizeObserver === 'function') {
    // Fires for the thread's own growth and for any descendant that changes
    // size later — a loaded image, an expanded card, a late rich result.
    new ResizeObserver(() => { if (followThreadBottom) scrollThread(); }).observe(thread);
  }
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
    if (!suppressScroll && shouldStick) stickThreadToBottom();
    return node;
  };
  const stopThinking = (handle, reason = 'cancel') => {
    if (!handle || handle !== activeThinking) return;
    handle.presentation.stop(reason);
    if (handle.avatarVisible) {
      if (reason === 'answer') driveAvatar('response-complete', handle.requestId);
      else driveAvatar('cancel', handle.requestId);
    }
    if (handle.node) {
      handle.node.closest('.chat-assistant-row')?.remove();
      handle.node.remove();
      handle.node = undefined;
      restoreAvatarHome();
    }
    activeThinking = undefined;
  };
  const beginThinking = ({attachments = [], text = '', onTimeout = () => {}} = {}) => {
    if (activeThinking) stopThinking(activeThinking, 'replaced');
    const handle = {
      avatarVisible: false,
      node: undefined,
      presentation: undefined,
      requestId: nextAvatarRequestId('turn'),
    };
    const updateCopy = state => {
      if (activeThinking !== handle || !handle.node) return;
      const body = handle.node.querySelector('.chat-message-body');
      if (body) body.textContent = state.text;
    };
    handle.presentation = createThinkingPresentation({
      onVisible: state => {
        if (activeThinking !== handle) return;
        handle.node = appendNode(createLoadingMessage(state.text));
        handle.avatarVisible = true;
        driveAvatar('response-wait', handle.requestId);
      },
      onLongWait: updateCopy,
      onTimeout,
    });
    activeThinking = handle;
    handle.presentation.start(selectThinkingKind({attachments, text}));
    return Object.freeze({stop: reason => stopThinking(handle, reason)});
  };
  const cancelActiveTurn = reason => {
    activeTurnGeneration += 1;
    if (activeThinking) stopThinking(activeThinking, reason);
    if (inFlight) {
      inFlight = false;
      updateSendState();
    }
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
    const groups = [
      ['[data-pinned-conversations]', state.threads.filter(item => item.pinned === true)],
      ['[data-recent-conversations]', state.threads.filter(item => item.pinned !== true)],
    ];
    for (const section of document.querySelectorAll('[data-pinned-conversations-section]')) {
      if (section instanceof HTMLElement) section.hidden = groups[0][1].length === 0;
    }
    for (const [selector, items] of groups) {
      for (const list of document.querySelectorAll(selector)) {
        if (!(list instanceof HTMLElement)) continue;
        const fragment = document.createDocumentFragment();
        for (const item of items) {
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
    }
  };
  const appendPersistedMessage = message => {
    const record = threadRecord(); if (!record) return;
    record.messages.push(message); record.messages = record.messages.slice(-MESSAGE_LIMIT); record.updatedAt = Date.now();
    sortThreads(); saveState(); renderRecent();
  };
  const lotbiBoxKey = () => storageKey(namespace || anonymousConversationNamespace(), 'lotbi-box');
  // LIFE-PUBLIC-DATA-01 / NEIS: the chosen school lives with this namespace's settings.
  const lifeSchoolKey = () => storageKey(namespace || anonymousConversationNamespace(), 'life-school');
  const rememberSchoolPreferencePatch = schoolResult => {
    const patch = schoolResult?.save_preference;
    if (!patch || !Number.isInteger(patch.grade)) return;
    const saved = readSchoolPreference(lifeSchoolKey(), storage);
    if (saved) writeSchoolPreference(lifeSchoolKey(), {...saved, grade: patch.grade, class_name: String(patch.class_name || '')}, storage);
  };
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
        ...(place.medicalStatus ? {medical_status: {
          kind: place.medicalStatus.kind,
          open_state: place.medicalStatus.openState,
          hours_label: place.medicalStatus.hoursLabel,
          target_label: place.medicalStatus.targetLabel,
          basis: 'NMC_REGISTERED_HOURS',
        }} : {}),
        ...(place.emergencyStatus ? {emergency_status: {
          realtime_state: place.emergencyStatus.realtimeState,
          updated_at_label: place.emergencyStatus.updatedAtLabel,
          beds: place.emergencyStatus.beds.map(item => ({label: item.label, available: item.available})),
          er_operating: place.emergencyStatus.erOperating,
          severe_acceptance_reported: [...place.emergencyStatus.severeAcceptanceReported],
          messages: [...place.emergencyStatus.messages],
          acceptance_guaranteed: false,
        }} : {}),
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
        photo_evidence: place.photoEvidence ? {
          provider: place.photoEvidence.provider,
          provider_place_id: place.photoEvidence.providerPlaceId,
          match_basis: place.photoEvidence.matchBasis,
          fetched_at: place.photoEvidence.fetchedAt,
          verification_state: place.photoEvidence.verificationState,
          attributions: Array.isArray(place.photoEvidence.attributions)
            ? place.photoEvidence.attributions.map(attribution => ({...attribution}))
            : [],
        } : undefined,
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
        animal_hospital_verification: place.animalHospitalVerification ? {
          state: place.animalHospitalVerification.state,
          source: 'MOIS_ANIMAL_HOSPITAL',
          ai_calls: 0,
          official_registered: place.animalHospitalVerification.officialRegistered ? true : 'UNVERIFIED',
          ...(place.animalHospitalVerification.administrativeStatus
            ? {administrative_status: place.animalHospitalVerification.administrativeStatus}
            : {}),
        } : undefined,
        ...(Number.isInteger(place.distanceMeters) ? {distance_meters: place.distanceMeters} : {}),
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
    const defaultMapProvider = readDefaultMapProvider(document.cookie);
    const mapPresentation = defaultMapProviderPresentation(defaultMapProvider);
    const rail = document.createElement('section');
    rail.className = 'lotbi-rich-card-rail lotbi-place-orbit';
    rail.classList.toggle('has-place-photo', placeResult.results.some(place => Boolean(place.imageUrl)));
    rail.classList.add('has-place-banner');
    rail.dataset.richCardType = 'PLACE';
    rail.dataset.placeResultSetId = placeResult.resultSetId;
    rail.dataset.cardCount = String(placeResult.results.length);
    rail.dataset.freshness = fresh ? 'fresh' : 'stale';
    rail.setAttribute('aria-label', '장소 검색 결과');
    rail.setAttribute('aria-roledescription', 'carousel');
    rail.tabIndex = 0;

    const preserveEmptyMedia = media => {
      media.replaceChildren();
      media.classList.remove('lotbi-rich-card-media-loading');
      media.classList.add('lotbi-rich-card-media-empty');
      media.hidden = false;
      media.setAttribute('aria-hidden', 'true');
      media.dataset.mediaState = 'empty-no-photo';
      media.dataset.mediaSource = 'NONE';
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
        image.addEventListener('error', () => preserveEmptyMedia(media), {once: true});
        image.src = place.imageUrl;
        media.appendChild(image);
      } else {
        preserveEmptyMedia(media);
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
      const lifeBadges = placeLifeBadges(place);
      if (lifeBadges.length) {
        const badges = document.createElement('span');
        badges.className = 'lotbi-place-badges lotbi-place-life-badges';
        for (const badge of lifeBadges) {
          const item = document.createElement('span');
          item.className = badge.kind === 'registration' ? 'lotbi-place-license-status' : 'lotbi-place-license-evidence';
          item.dataset.lifeBadge = badge.state;
          item.textContent = badge.label;
          badges.appendChild(item);
        }
        copy.appendChild(badges);
      }

      const actions = document.createElement('div');
      actions.className = 'lotbi-rich-card-actions lotbi-place-card-actions';

      const addActionIcon = (control, iconName) => {
        const icon = document.createElement('span');
        icon.className = 'lotbi-place-action-icon';
        icon.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.className = 'lotbi-place-action-icon-image';
        image.src = `/assets/place-actions/${iconName}.png?v=place-icons-20260925`;
        image.alt = '';
        image.width = 32;
        image.height = 32;
        image.decoding = 'async';
        icon.appendChild(image);
        control.appendChild(icon);
      };

      const phoneHref = buildVerifiedPhoneHref(place);
      if (phoneHref) {
        const phone = document.createElement('a');
        phone.className = 'lotbi-rich-card-action lotbi-rich-card-icon-action lotbi-phone-action';
        phone.dataset.action = 'phone';
        phone.dataset.phoneState = 'VERIFIED';
        phone.href = phoneHref;
        phone.tabIndex = placeIndex === 0 ? 0 : -1;
        phone.setAttribute('aria-label', `${place.name} 전화 걸기`);
        phone.title = '전화 걸기';
        addActionIcon(phone, 'phone');
        phone.addEventListener('click', () => {
          phone.dataset.handoffState = 'CALL_HANDOFF_STARTED';
          setStatus('전화 앱 연결을 시작합니다.');
        });
        actions.appendChild(phone);
      }

      const mapAction = document.createElement('a');
      mapAction.className = `lotbi-rich-card-action lotbi-rich-card-icon-action lotbi-${mapPresentation.action}-action`;
      mapAction.href = buildDefaultMapHref(defaultMapProvider, place);
      mapAction.target = '_blank';
      mapAction.rel = 'noopener noreferrer';
      mapAction.setAttribute('aria-label', `${place.name} ${mapPresentation.label}에서 길찾기`);
      mapAction.title = `${mapPresentation.label}에서 길찾기`;
      mapAction.dataset.action = mapPresentation.action;
      mapAction.dataset.mapProvider = defaultMapProvider;
      mapAction.tabIndex = placeIndex === 0 ? 0 : -1;
      addActionIcon(mapAction, mapPresentation.icon);
      mapAction.addEventListener('click', event => {
        if (!isPlaceResultFresh(placeResult)) {
          event.preventDefault();
          setStatus('결과가 오래됐어요. 같은 장소를 다시 검색한 뒤 열어 주세요.');
          return;
        }
        setStatus(mapPresentation.success);
      });
      actions.appendChild(mapAction);

      for (const line of medicalStatusLines(place)) {
        const status = document.createElement('span');
        status.className = 'lotbi-place-license-note lotbi-place-medical-line';
        status.dataset.medicalState = line.state;
        status.textContent = line.text;
        copy.appendChild(status);
      }
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
          control.setAttribute('aria-disabled', current ? 'false' : 'true');
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
        cards[index].querySelector('[data-map-provider]')?.click();
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
    const rawTimeHint = typeof value.timeHint === 'string' ? value.timeHint.trim() : '';
    const timeHint = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rawTimeHint) ? rawTimeHint : '';
    const timezoneName = typeof value.timezone === 'string' ? value.timezone.trim() : '';
    if (!['AUTH', 'GUEST'].includes(scope) || !['REGISTERED', 'DELETED'].includes(stateName) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(dateHint) || !timezoneName) return null;
    if (scope === 'AUTH') {
      const activityId = typeof value.activityId === 'string' ? value.activityId.trim() : '';
      const occurrenceId = typeof value.occurrenceId === 'string' ? value.occurrenceId.trim() : '';
      if (!/^activity_[0-9a-f]{32}$/.test(activityId) || !/^occurrence_[0-9a-f]{32}$/.test(occurrenceId)) return null;
      return Object.freeze({scope, state: stateName, title, dateHint, timeHint, timezone: timezoneName, activityId, occurrenceId});
    }
    const guestEventId = typeof value.guestEventId === 'string' ? value.guestEventId.trim() : '';
    if (!/^guest_[0-9a-f-]{36}$/i.test(guestEventId)) return null;
    return Object.freeze({scope, state: stateName, title, dateHint, timeHint, timezone: timezoneName, guestEventId});
  };

  // The registered card only ever carried the date: dateHint is date-only by
  // contract (it also drives the Calendar deep-link), so a 오후 2시 command
  // rendered with no time at all. timeHint is the HH:MM sibling, shown but
  // never used for navigation, so a missing/invalid value just falls back to
  // the all-day look this card has always had.
  const formatCalendarResultWhen = (dateHint, timeHint) => {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateHint || '');
    if (!dateMatch) return dateHint || '';
    const dateLabel = `${Number(dateMatch[1])}년 ${Number(dateMatch[2])}월 ${Number(dateMatch[3])}일`;
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeHint || '');
    if (!timeMatch) return dateLabel;
    const hour = Number(timeMatch[1]);
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour % 12 || 12;
    const minute = Number(timeMatch[2]);
    return `${dateLabel} ${period} ${displayHour}시${minute ? ` ${minute}분` : ''}`;
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
        end_local_date: value.endLocalDate,
        end_local_time: value.endLocalTime,
        calendar_relevance: value.calendarRelevance,
        document_kind: value.documentKind,
        detection_confidence: value.detectionConfidence,
        dedupe_fingerprint: value.dedupeFingerprint,
        auto_suggestable: value.autoSuggestable === true,
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

  const calendarDraftClock = (date, time) => {
    const [, month, day] = String(date).split('-');
    const stamp = `${month}월 ${Number(day)}일`;
    return time ? `${stamp} ${time}` : stamp;
  };

  const calendarDraftWhen = draft => {
    if (!draft?.localDate) return '날짜 미정';
    const start = calendarDraftClock(draft.localDate, draft.localTime);
    // A stay reads as one line with two ends — 9월 12일 15:00 → 9월 13일 11:00 —
    // because that is the shape of the thing the owner is confirming.
    if (!draft.endLocalDate) return start;
    return `${start} → ${calendarDraftClock(draft.endLocalDate, draft.endLocalTime)}`;
  };

  const draftLocalTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
    } catch {
      return 'Asia/Seoul';
    }
  };

  /** Record what the owner decided about a draft, so a reload does not re-ask. */
  const settleConversationCalendarDraft = (fingerprint, result) => {
    const key = String(fingerprint || '');
    if (!key) return;
    let changed = false;
    for (const record of state.threads) {
      if (!Array.isArray(record.messages)) continue;
      record.messages = record.messages.map(message => {
        if (message?.meta?.calendarDraft?.dedupeFingerprint !== key) return message;
        changed = true;
        const meta = {...message.meta};
        delete meta.calendarDraft;
        if (result) meta.calendarResult = result;
        return {...message, meta};
      });
      if (changed) record.updatedAt = Date.now();
    }
    if (changed) {
      sortThreads();
      saveState();
      renderRecent();
    }
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
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const controls = document.createElement('div');
    controls.className = 'conversation-calendar-action-controls';

    const openEditor = async () => {
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
    };

    // No date means there is nothing to register — the owner has to supply the
    // one thing the image never said, and the editor is where that happens.
    const registerable = Boolean(draft.localDate && draft.title && draft.dedupeFingerprint);
    if (!registerable) {
      status.textContent = '저장 전 확인 필요';
      const review = document.createElement('button');
      review.type = 'button';
      review.className = 'conversation-calendar-action-button';
      review.textContent = '초안 확인 · 편집';
      review.addEventListener('click', () => void openEditor());
      controls.appendChild(review);
      row.append(summary, status, controls);
      return row;
    }

    status.textContent = '캘린더에 등록할까요?';
    const register = document.createElement('button');
    register.type = 'button';
    register.className = 'conversation-calendar-action-button conversation-calendar-action-button-primary';
    register.textContent = '등록';
    register.setAttribute('aria-label', `${draft.title} 일정을 캘린더에 등록`);
    const decline = document.createElement('button');
    decline.type = 'button';
    decline.className = 'conversation-calendar-action-button';
    decline.textContent = '아니요';
    decline.setAttribute('aria-label', `${draft.title} 일정을 캘린더에 등록하지 않음`);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'conversation-calendar-action-button';
    edit.textContent = '편집';
    edit.setAttribute('aria-label', `${draft.title} 일정을 편집해서 등록`);

    let submitting = false;
    const settle = text => {
      row.dataset.calendarDraft = 'settled';
      status.textContent = text;
      controls.replaceChildren();
    };

    register.addEventListener('click', async () => {
      if (!sessionToken) {
        try {
          await beginGuestClaimingSiteHandoff('캘린더 등록');
        } catch (error) {
          setStatus(error instanceof Error ? error.message : '로그인 연결을 시작하지 못했습니다.');
        }
        return;
      }
      // Disabling the buttons is courtesy, not the duplicate guard: the write
      // identity is derived from the booking, so a second press that slips
      // through replays the first one instead of writing a second entry.
      if (submitting) return;
      submitting = true;
      register.disabled = true;
      decline.disabled = true;
      edit.disabled = true;
      status.textContent = '캘린더에 등록하는 중…';

      const timezone = draftLocalTimezone();
      const outcome = await registerCalendarDraft(draft, {sessionToken, timezone});

      if (outcome.state === CALENDAR_DRAFT_WRITE_STATE.REGISTERED) {
        const result = {
          scope: 'AUTH',
          state: 'REGISTERED',
          title: outcome.result.title,
          dateHint: outcome.result.dateHint,
          timezone: outcome.result.timezone,
          activityId: outcome.result.activityId,
          occurrenceId: outcome.result.occurrenceId,
        };
        settleConversationCalendarDraft(draft.dedupeFingerprint, result);
        const registered = createConversationCalendarResult(result);
        if (registered && row.isConnected) row.replaceWith(registered);
        else settle('✓ 캘린더에 등록했습니다');
        // Whatever Calendar surface is mounted refreshes itself, so the day the
        // owner just saved onto is already right when they look at it.
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('캘린더에 일정을 등록했습니다.');
        return;
      }

      if (outcome.state === CALENDAR_DRAFT_WRITE_STATE.ALREADY_REGISTERED) {
        settleConversationCalendarDraft(draft.dedupeFingerprint, null);
        settle('이미 등록된 일정입니다');
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
        setStatus('같은 일정이 이미 캘린더에 있습니다.');
        return;
      }

      // A failed save is a failed save — the conversation and the reply the
      // owner actually asked for stay exactly as they were.
      submitting = false;
      register.disabled = false;
      decline.disabled = false;
      edit.disabled = false;
      status.textContent = outcome.error?.message || '일정을 등록하지 못했습니다.';
    });

    decline.addEventListener('click', () => {
      if (submitting) return;
      settleConversationCalendarDraft(draft.dedupeFingerprint, null);
      settle('등록하지 않았습니다');
    });

    edit.addEventListener('click', () => {
      if (submitting) return;
      void openEditor();
    });

    controls.append(register, decline, edit);
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
      const when = document.createElement('span'); when.textContent = formatCalendarResultWhen(result.dateHint, result.timeHint);
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
    const reusableOutput = message.role === 'assistant' ? message.meta?.reusableOutput : null;
    if (reusableOutput) {
      prepareKakaoShare();
      const card = createReusableOutputCard(reusableOutput, {
        copyText: writeMessageTextToClipboard,
        // 'copied' while KakaoTalk sharing is not configured, 'shared' once it is.
        shareText: text => shareMessageWithKakao({text, url: MESSAGE_ACTION_SHARE_URL}),
        editText: text => {
          prompt.value = text;
          state.draft = text.slice(0, 1000);
          saveState();
          prompt.dispatchEvent(new Event('input', {bubbles: true}));
          prompt.focus();
          if (text.length > 1000) setStatus('긴 결과물 전체를 입력창에 넣었습니다. 전송하려면 1000자 이하로 편집해 주세요.');
        },
        announce: setStatus,
      });
      if (card) node.appendChild(card);
    }
    const rich = compactRichProductMeta(message.meta?.richProduct);
    const place = normalizedPersistedPlaceResult(message.meta?.placeResult);
    if (message.role === 'assistant' && rich) {
      const rail = createProductCardRail(rich); if (rail) node.appendChild(rail);
    }
    if (message.role === 'assistant' && message.meta?.emergencyCall === true) {
      node.appendChild(createEmergencyCallNotice(document));
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
    if (message.role === 'assistant' && message.meta?.schoolResult) {
      const schoolCard = createSchoolResultCard(message.meta.schoolResult, {
        document,
        onSelectSchool: (school, resumeText) => {
          if (!writeSchoolPreference(lifeSchoolKey(), school, storage)) return;
          setStatus(`${school.name}을(를) 자녀 학교로 저장했어요.`);
          if (resumeText && !inFlight) void requestAssistant(resumeText, true);
        },
        onAddToCalendar: draft => openCalendar(draft?.localDate ? 'month' : 'agenda', {initialDraft: draft, restoreConversation: true}),
        onChangeSchool: () => {
          clearSchoolPreference(lifeSchoolKey(), storage);
          setStatus('저장된 학교를 지웠어요. 학교 이름을 말씀해 주시면 다시 찾아볼게요.');
        },
      });
      if (schoolCard) node.appendChild(schoolCard);
    }
    if (message.role === 'assistant' && ['sos', 'found'].includes(message.meta?.petAction?.target)) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'conversation-pet-action-button';
      action.dataset.petChatAction = message.meta.petAction.target;
      action.textContent = typeof message.meta.petAction.label === 'string'
        ? message.meta.petAction.label
        : (message.meta.petAction.target === 'sos' ? '실종 신고하기' : '발견 제보하기');
      node.appendChild(action);
      if (message.meta.petAction.target === 'found') {
        // LIFE-PUBLIC-DATA-01: 발견·구조 상황 → 근처 동물병원 → 전화 → 길찾기.
        // The Pet SOS flow itself is untouched; this only asks LOTBI.
        const vet = document.createElement('button');
        vet.type = 'button';
        vet.className = 'conversation-pet-action-button conversation-life-action-button';
        vet.dataset.lifePrompt = ANIMAL_HOSPITAL_NEARBY_PROMPT;
        vet.textContent = '근처 동물병원 찾기';
        node.appendChild(vet);
      }
    }
    if (message.role === 'assistant' && !reusableOutput) {
      const actions = createMessageActions(message.text, setStatus, {
        calendarDraft: calendarDraftHintFromMessage(message, place),
        openCalendarDraft: draft => openCalendar(draft?.localDate ? 'month' : 'agenda', {initialDraft: draft, restoreConversation: true}),
      });
      if (actions) node.appendChild(actions);
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
    // Thumbnails live only in the document that rendered them; rebuilding the
    // transcript drops those nodes, so their object URLs are released here.
    releaseRenderedPreviewUrls();
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
    closeSurface();
    cancelActiveTurn('conversation-switch');
    closeConversationMenus();
    state.activeThreadId = id; saveState(); renderActiveThread(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const startNewConversation = () => {
    cancelActiveTurn('new-conversation');
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
    if ('attachments' in meta) {
      const attachments = Array.isArray(meta.attachments)
        ? meta.attachments.flatMap(item => {
          if (!item || typeof item !== 'object') return [];
          const mediaType = typeof item.mediaType === 'string' ? item.mediaType.trim().slice(0, 128) : '';
          if (!mediaType) return [];
          return [{
            id: typeof item.id === 'string' ? item.id.trim().slice(0, 128) : '',
            mediaType,
            sizeBytes: Number.isFinite(Number(item.sizeBytes)) ? Math.max(0, Number(item.sizeBytes)) : 0,
          }];
        }).slice(0, 3)
        : [];
      if (attachments.length) meta.attachments = attachments;
      else delete meta.attachments;
    }
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
    if ('reusableOutput' in meta) {
      try {
        const output = normalizeReusableOutput(meta.reusableOutput);
        if (output) meta.reusableOutput = output;
        else delete meta.reusableOutput;
      } catch {
        delete meta.reusableOutput;
      }
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
    // SITE-HOME-FRESH-ENTRY-01 — 대표: "자동 로그인으로 들어가면 첫화면이 기존에
    // 대화창으로 뜨는데 새창으로 뜨도록 해"
    //
    // The obvious discriminator — "did we come back through the auth handoff?"
    // — does not work, and that was measured rather than assumed. site-
    // continuity.js holds the site session in a module variable, so every load
    // of / while signed in finds no live session, runs beginSiteHandoff(), and
    // returns through /auth/callback/. A mid-conversation refresh takes that
    // same road, so the handoff separates nothing. The tab does: sessionStorage
    // survives a reload and the redirect out to Account and back, but not a
    // newly opened tab — which is what "들어가면" means.
    //
    // Narrow on purpose, as 총괄방 asked. The anonymous namespace keeps the
    // behaviour it had, so nothing ⑱ GUEST-ACCESS owns changes shape, and an
    // entry carrying text to send is the reader continuing, not arriving.
    // Selection only: the threads themselves are never touched either way.
    const freshTabEntry = !markConversationTabEntry({namespace})
      && normalized !== anonymousConversationNamespace()
      && !(autoSend && typeof initialText === 'string' && initialText.trim());
    if (freshTabEntry) state.activeThreadId = null;
    preferences = {
      color: COLOR_OPTIONS.some(([key]) => key === loadedPreferences.color) ? loadedPreferences.color : 'default',
      theme: resolveNamespaceTheme(loadedPreferences.theme, durableBootstrapTheme()),
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
  const profileButton = ({includePlan = true} = {}) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sidebar-account-entry sidebar-profile-trigger';
    button.dataset.profileMenuTrigger = ''; button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `${canonicalProfileName()} 계정 메뉴 열기`);
    const copy = document.createElement('span'); copy.className = 'sidebar-profile-copy';
    const name = document.createElement('span'); name.className = 'sidebar-account-name'; name.textContent = canonicalProfileName();
    copy.appendChild(name);
    if (includePlan && serverSubscription?.plan) {
      const planLabels = {FREE: 'LOTBI Free', BASIC: 'LOTBI Basic', PLUS: 'LOTBI Plus', PRO: 'LOTBI Pro', LOTBI_PLUS: 'LOTBI Plus'};
      const plan = document.createElement('span');
      plan.className = 'sidebar-account-plan';
      plan.textContent = planLabels[serverSubscription.plan] || serverSubscription.plan;
      copy.appendChild(plan);
    }
    if (serverIdentity?.publicHandle) {
      const detail = document.createElement('span');
      detail.className = 'sidebar-account-handle';
      detail.textContent = `@${serverIdentity.publicHandle}`;
      copy.appendChild(detail);
    }
    const chevron = document.createElement('span');
    chevron.className = 'sidebar-profile-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    button.append(profileVisual(), copy, chevron); return button;
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
      const planLabels = {FREE: 'LOTBI Free', BASIC: 'LOTBI Basic', PLUS: 'LOTBI Plus', PRO: 'LOTBI Pro', LOTBI_PLUS: 'LOTBI Plus'};
      const planName = planLabels[serverSubscription.plan] || serverSubscription.plan;
      const plan = document.createElement('span'); plan.className = 'profile-popover-summary-plan'; plan.textContent = `현재 이용 등급 · ${planName}`; copy.appendChild(plan);
    }
    summary.append(profileVisual(), copy); return summary;
  };
  const profileMenuIcon = name => {
    const svgNamespace = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');
    const paths = {
      profile: ['M20 21a8 8 0 0 0-16 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
      theme: ['M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-1.2a2 2 0 0 1-2-2V6.8c0-1.1-.9-2-2-2H12Z', 'M7.5 11.5h.01', 'M10 7.5h.01', 'M7.5 16h.01'],
      settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.3h-3v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04H5.3v-3h.14A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7V4.6h3v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.14v3h-.14A1.7 1.7 0 0 0 19.4 15Z'],
      connected: ['M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1', 'M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1'],
      help: ['M9.1 9a3 3 0 1 1 5.1 2.1c-1.2 1.2-2.2 1.6-2.2 3.4', 'M12 18h.01', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z'],
      logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4'],
    };
    const icon = document.createElementNS(svgNamespace, 'svg');
    icon.classList.add('profile-menu-icon'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    for (const pathValue of paths[name] || []) {
      const path = document.createElementNS(svgNamespace, 'path'); path.setAttribute('d', pathValue); icon.appendChild(path);
    }
    return icon;
  };
  const decorateProfileMenuItem = (item, label, iconName) => {
    item.classList.add('profile-menu-item');
    const text = document.createElement('span'); text.className = 'profile-menu-label'; text.textContent = label;
    const chevron = document.createElement('span'); chevron.className = 'profile-menu-chevron'; chevron.setAttribute('aria-hidden', 'true');
    item.replaceChildren(profileMenuIcon(iconName), text, chevron);
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
      openProfilePhotoFromHash();
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
    if (openSurface.dataset.workspace) {
      mainScrollHost.inert = false;
      for (const entry of document.querySelectorAll('[data-workspace-current]')) {
        entry.removeAttribute('aria-current'); entry.removeAttribute('data-workspace-current');
      }
    }
    for (const trigger of document.querySelectorAll('[data-profile-menu-trigger]')) trigger.setAttribute('aria-expanded', 'false');
    const onClose = surfaceCloseCallback;
    openSurface.remove(); openSurface = undefined; openSurfaceTrigger = undefined; surfaceCloseCallback = undefined; document.body.classList.remove('site-overlay-open', 'site-workspace-open');
    if (typeof onClose === 'function') {
      try { onClose(); } catch {}
    }
    if (surfaceRestoreFocus instanceof HTMLElement && surfaceRestoreFocus.isConnected) surfaceRestoreFocus.focus();
    surfaceRestoreFocus = undefined;
  };
  const installSurfaceBehavior = (surface, panel, {modal = false, workspace = '', trigger, onClose, onBack, backLabel = '대화로 돌아가기'} = {}) => {
    const initiatingFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    closeSurface(); openSurface = surface; openSurfaceTrigger = trigger; surfaceRestoreFocus = initiatingFocus; surfaceCloseCallback = typeof onClose === 'function' ? onClose : undefined;
    document.body.appendChild(surface); document.body.classList.add(workspace ? 'site-workspace-open' : 'site-overlay-open');
    if (workspace) {
      surface.dataset.workspace = workspace;
      surface.classList.add('consumer-workspace'); panel.setAttribute('role', 'region');
      mainScrollHost.inert = true;
      const back = panel.querySelector('.site-modal-close');
      if (back) {
        back.textContent = '←'; back.title = backLabel;
        back.setAttribute('aria-label', backLabel);
        if (typeof onBack === 'function') {
          back.removeEventListener('click', closeSurface);
          back.addEventListener('click', () => { closeSurface(); onBack(); });
        }
        panel.querySelector('.site-modal-header')?.prepend(back);
      }
      for (const entry of document.querySelectorAll('.consumer-primary-nav button')) {
        if (entry.dataset.consumerSection === workspace || (workspace === 'calendar' && entry.hasAttribute('data-calendar-view'))) {
          entry.setAttribute('aria-current', 'page'); entry.dataset.workspaceCurrent = '';
        }
      }
    }
    const backdropDismiss = createBackdropDismissGuard(surface);
    surface.addEventListener('pointerdown', event => backdropDismiss.notePointerDown(event));
    surface.addEventListener('click', event => { if (backdropDismiss.shouldDismiss(event)) closeSurface(); });
    surface.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSurface(); if (typeof onBack === 'function') onBack(); } else if (!workspace) trapFocus(panel, event);
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
  // Active 실종 SOS count on the sidebar entry, mirroring the Calendar badge.
  // Nothing is shown until the surface has actually counted the cases.
  const renderPetSosBadge = ({activeSos = 0, locked = false, lockLabel = '', lockHint = ''} = {}) => {
    for (const slot of document.querySelectorAll('[data-pet-sos-count]')) {
      if (!(slot instanceof HTMLElement)) continue;
      if (Number.isInteger(activeSos) && activeSos > 0) {
        slot.textContent = String(activeSos);
        slot.hidden = false;
      } else {
        slot.textContent = '';
        slot.hidden = true;
      }
    }
    // 유료 게이트가 켜졌을 때의 비활성 표시. 스위치가 꺼져 있으면 locked 가
    // 항상 false 라 아무 표시도 붙지 않습니다.
    //
    // 항목을 지우거나 누르지 못하게 만들지 않습니다. 눌렀을 때 아무 일도
    // 일어나지 않으면 고장으로 보이므로, 패널은 그대로 열리고 왜 비활성인지
    // 안에서 설명합니다. 등록한 기록도 그대로 보입니다.
    for (const nav of document.querySelectorAll('[data-pet-nav]')) {
      if (!(nav instanceof HTMLElement)) continue;
      nav.dataset.petLocked = locked ? 'true' : 'false';
      const trigger = nav.querySelector('[data-pet-family-open]');
      if (!(trigger instanceof HTMLElement)) continue;
      let note = nav.querySelector('[data-pet-lock-note]');
      if (locked && lockLabel) {
        if (!note) {
          note = document.createElement('span');
          note.className = 'pet-nav-lock';
          note.dataset.petLockNote = '';
          trigger.appendChild(note);
        }
        note.textContent = lockLabel;
        if (lockHint) trigger.title = lockHint;
      } else {
        if (note) note.remove();
        trigger.removeAttribute('title');
      }
    }
  };

  const openPetFamily = async (initialSurface = 'pets') => {
    closeMobileDrawer();
    const {backdrop, panel, content} = modalShell(
      '반려동물',
      sessionToken
        ? '등록한 반려동물 정보와 사진은 계정에 비공개로 저장됩니다.'
        : '반려동물 등록은 로그인 후 사용할 수 있습니다.',
    );
    panel.classList.add('site-pet-modal');
    // Pet photos are held as object URLs while the panel is open; closing it
    // must release them rather than leak the private bytes into the page.
    let releasePetSurface = null;
    installSurfaceBehavior(backdrop, panel, {
      workspace: 'care', backLabel: '안심케어로 돌아가기', onBack: () => openConsumerSection('care'),
      onClose: () => { releasePetSurface?.(); releasePetSurface = null; },
    });
    try {
      // Loaded on demand: the PET FAMILY surface pulls in its Core client and
      // ten slot schematics, which no visit needs until this panel is opened.
      const {mountPetFamilyManager} = await import('./site-pet-ui.js?v=aset-5fe7088d75dd');      const mounted = await mountPetFamilyManager({
        sessionToken,        root: content,
        onCountChange: renderPetSosBadge,
        subscription: serverSubscription,
        initialSurface,
      });
      if (!backdrop.isConnected) { mounted?.dispose?.(); return; }
      releasePetSurface = typeof mounted?.dispose === 'function' ? mounted.dispose : null;
    } catch {
      content.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'pet-error',
        textContent: '반려동물 화면을 열지 못했습니다.',
      }));
    }
  };

  const openFestival = async ({festivalId = '', selectedDate = ''} = {}) => {
    closeMobileDrawer();
    const {backdrop, panel, content} = modalShell('축제·행사', '내 주변부터 이번 주말·이번 달 전국 축제와 행사를 찾아보세요.');
    panel.classList.add('site-festival-modal');
    let releaseFestivalSurface = null;
    installSurfaceBehavior(backdrop, panel, {
      workspace: 'life', backLabel: '생활정보로 돌아가기', onBack: () => openConsumerSection('life'),
      onClose: () => { releaseFestivalSurface?.(); releaseFestivalSurface = null; },
    });
    try {
      // Loaded on demand, like the 반려동물 panel: no visit needs the festival
      // client/UI bundle until this panel is opened.
      const {mountFestivalManager} = await import('./site-festival-ui.js?v=aset-5fe7088d75dd');
      const mounted = await mountFestivalManager({        root: content,
        sessionToken,
        initialFestivalId: festivalId,
        selectedDate,
      });
      if (!backdrop.isConnected) { mounted?.dispose?.(); return; }
      releaseFestivalSurface = typeof mounted?.dispose === 'function' ? mounted.dispose : null;
    } catch {
      content.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'festival-error',
        textContent: '축제·행사 화면을 열지 못했습니다.',
      }));
    }
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
  const readProfilePhoto = file => new Promise((resolve, reject) => {
    const mime = typeof file?.type === 'string' ? file.type.split(';', 1)[0].trim().toLowerCase() : '';
    // The chooser is image-only, but a provider can still return stale or spoofed
    // metadata. Fail closed on MIME first, then require the browser image decoder
    // to successfully decode the bytes before anything is persisted.
    if (!mime.startsWith('image/') || mime === 'image/svg+xml') return reject(new Error('프로필에는 사진만 사용할 수 있어요.'));
    if (file.size > PHOTO_BYTES_LIMIT) return reject(new Error('프로필 사진은 20MB 이하여야 합니다.'));
    const objectUrl = URL.createObjectURL(file); const image = new Image();
    image.onload = () => {
      try {
        if (
          image.naturalWidth <= 0
          || image.naturalHeight <= 0
          || image.naturalWidth > PHOTO_DIMENSION_LIMIT
          || image.naturalHeight > PHOTO_DIMENSION_LIMIT
          || image.naturalWidth * image.naturalHeight > PHOTO_PIXEL_LIMIT
        ) throw new Error('사진 크기가 너무 큽니다. 다른 사진을 선택해 주세요.');
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
  // Account owns canonical name/email editing. The Site owns only its local photo.
  const openProfile = () => { window.location.assign(ACCOUNT_MANAGE_URL + '#profile'); };
  const openProfilePhoto = () => {
    if (!sessionToken || !serverIdentity) return;
    const profilePhotoEmbed = isProfilePhotoEmbed();
    if (profilePhotoEmbed) document.documentElement.dataset.profilePhotoEmbed = 'true';
    const {backdrop, panel, content} = modalShell('프로필 사진');
    const preview = document.createElement('div'); preview.className = 'profile-photo-preview'; preview.textContent = initials(canonicalProfileName());
    if (preferences.photo) preview.style.backgroundImage = `url(${preferences.photo})`;
    const error = document.createElement('p'); error.className = 'site-field-error'; error.setAttribute('role', 'alert');
    const photoPicker = document.createElement('div'); photoPicker.className = 'profile-photo-picker';
    const photoTrigger = document.createElement('button'); photoTrigger.type = 'button'; photoTrigger.className = 'site-button site-button-secondary'; photoTrigger.textContent = '사진 선택';
    photoTrigger.setAttribute('aria-haspopup', 'menu'); photoTrigger.setAttribute('aria-expanded', 'false');
    const photoMenu = document.createElement('div'); photoMenu.className = 'profile-photo-source-menu'; photoMenu.id = 'profile-photo-source-menu'; photoMenu.setAttribute('role', 'menu'); photoMenu.setAttribute('aria-label', '프로필 사진 가져오기'); photoMenu.hidden = true;
    photoTrigger.setAttribute('aria-controls', photoMenu.id);
    const setPhotoMenuOpen = open => { photoMenu.hidden = !open; photoTrigger.setAttribute('aria-expanded', String(open)); };
    function applyProfilePhoto(file) {
      if (!file) return Promise.resolve();
      error.textContent = '';
      return readProfilePhoto(file).then(value => {
        preferences.photo = value;
        savePreferences();
        preview.style.backgroundImage = `url(${preferences.photo})`;
        refreshAuthenticatedProfileSlots();
        if (profilePhotoEmbed) window.parent.postMessage({type: 'lotbi:profile-photo-updated'}, ACCOUNT_MANAGE_ORIGIN);
      }).catch(caught => { error.textContent = caught instanceof Error ? caught.message : '이미지를 처리하지 못했습니다.'; });
    }
    for (const [source, label] of PROFILE_PHOTO_SOURCE_OPTIONS) {
      const option = document.createElement('button'); option.type = 'button'; option.className = 'profile-photo-source-option'; option.textContent = label; option.setAttribute('role', 'menuitem'); option.dataset.profilePhotoSource = source;
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = false; input.className = 'sr-only'; input.dataset.profilePhotoInput = source;
      if (source === 'camera') input.setAttribute('capture', 'environment');
      photoMenu.appendChild(option); photoPicker.appendChild(input);
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        try { await applyProfilePhoto(file); } finally { input.value = ''; }
      });
      option.addEventListener('click', async () => {
        setPhotoMenuOpen(false); input.value = '';
        if (source !== 'files' || typeof globalThis.showOpenFilePicker !== 'function') { input.click(); return; }
        try {
          const [selectedFile] = await globalThis.showOpenFilePicker({multiple: false, excludeAcceptAllOption: true, types: [{description: '이미지 파일', accept: {'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']}}]});
          const file = await selectedFile?.getFile?.();
          await applyProfilePhoto(file);
        } catch (caught) {
          if (caught?.name === 'AbortError') return;
          input.click();
        }
      });
    }
    photoTrigger.addEventListener('click', () => setPhotoMenuOpen(photoMenu.hidden));
    photoMenu.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); setPhotoMenuOpen(false); photoTrigger.focus(); } });
    photoPicker.prepend(photoTrigger, photoMenu);

    const accountLink = document.createElement('a'); accountLink.className = 'site-button site-button-secondary';
    accountLink.href = ACCOUNT_MANAGE_URL + '#profile'; accountLink.textContent = '이름 · 이메일 관리';
    content.append(preview, photoPicker, error);
    if (!profilePhotoEmbed) content.append(accountLink);
    installSurfaceBehavior(backdrop, panel, {
      modal: true,
      onClose: profilePhotoEmbed
        ? () => {
          window.parent.postMessage({type: 'lotbi:profile-photo-close'}, ACCOUNT_MANAGE_ORIGIN);
        }
        : undefined,
    });
    if (profilePhotoEmbed) {
      window.parent.postMessage({type: 'lotbi:profile-photo-ready'}, ACCOUNT_MANAGE_ORIGIN);
    }
  };
  const openProfilePhotoFromHash = () => {
    if (window.location.hash !== '#profile-photo' || !sessionToken || !serverIdentity || !stateReady) return;
    openProfilePhoto();
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  };
  window.addEventListener('hashchange', openProfilePhotoFromHash);
  // One settings owner: display modes are edited in Account. Existing Site
  // theme bootstrap and synchronization are unchanged.
  const openPersonalTheme = () => {
    window.location.assign(ACCOUNT_MANAGE_URL + '#personalization');
  };
  // 설정 — no intermediate modal. It leaves for the account page directly, the
  // same destination the profile modal's removed button used.
  const openSettings = () => { window.location.assign(ACCOUNT_MANAGE_URL); };
  // Keep feature ownership in the existing managers. These entry points never
  // submit a request or imply that an unconnected feature is available.
  const openConsumerSection = async section => {
    closeMobileDrawer();
    // The provider catalogue already owns connection state, permissions and
    // disconnect. Enter it directly instead of adding an extra menu-board.
    if (section === 'mall') { window.location.assign('https://account.lotbiai.com/connected-services'); return; }
    const definitions = {
      wallet: ['Life Wallet', '신분·자격·증명 자료를 보관하는 생활지갑입니다. 결제카드 지갑은 아니에요.'],
      care: ['안심케어', '사람과 반려동물을 함께 챙기는 안전 공간입니다.'],
      life: ['생활정보', '내 주변의 생활정보를 찾고, 필요한 일정을 챙겨 보세요.'],
      mall: ['제휴몰', '업체와 연결하고, 롯비에서 필요한 서비스를 이용하세요.'],
    };
    const definition = definitions[section];
    if (!definition) return;
    if (section === 'wallet' && sessionToken) {
      const tokenAtStart = sessionToken;
      setStatus('Life Wallet 계정을 확인하고 있습니다.');
      try {
        const identity = await getCurrentSiteUser(tokenAtStart);
        if (tokenAtStart !== sessionToken) return;
        serverIdentity = identity;
      } catch (error) {
        if (isSessionError(error)) sessionToken = undefined;
        serverIdentity = undefined;
      }
    }
    const {backdrop, panel, content} = modalShell(...definition);
    panel.classList.add('consumer-section-panel');
    const draft = text => {
      prompt.value = text.slice(0, 1000); prompt.dispatchEvent(new Event('input', {bubbles: true})); prompt.focus();
      setStatus('요청을 입력창에 넣었어요. 내용을 확인한 뒤 전송하세요.');
    };
    let mounted;
    installSurfaceBehavior(backdrop, panel, {workspace: section, onClose: () => mounted?.dispose()});
    mounted = mountConsumerSection({
      section, root: content, authenticated: Boolean(sessionToken),
      accountId: serverIdentity?.userId || '',
      sessionExpiresAt: serverIdentity?.expiresAt || '',
      onDraft: text => { closeSurface(); draft(text); },
      onFestival: () => { closeSurface(); void openFestival(); },
      onSaved: () => { closeSurface(); openLotbiBox(); },
      loadCareCounts: async () => {
        const [{listPeople}, {listPets}] = await Promise.all([
          import('./site-person.js?v=aset-5fe7088d75dd'),
          import('./site-pet.js?v=aset-5fe7088d75dd'),
        ]);
        const [people, pets] = await Promise.allSettled([listPeople(sessionToken), listPets(sessionToken)]);
        return {
          ...(people.status === 'fulfilled' ? {people: people.value.length} : {}),
          ...(pets.status === 'fulfilled' ? {pets: pets.value.length} : {}),
        };
      },
      mountPeople: async (root, initialSurface, reportCounts) => {
        const {mountPersonCareManager} = await import('./site-person-ui.js?v=aset-5fe7088d75dd');
        return mountPersonCareManager({sessionToken, root, initialSurface, onCountChange: reportCounts});
      },
      mountPets: async (root, initialSurface, reportCounts) => {
        const {mountPetFamilyManager} = await import('./site-pet-ui.js?v=aset-5fe7088d75dd');
        return mountPetFamilyManager({sessionToken, root, subscription: serverSubscription, initialSurface,
          onCountChange: counts => { renderPetSosBadge(counts); reportCounts(counts); }});
      },
    });
  };
  const openCalendar = async (view, {deepOpen, initialDraft = null} = {}) => {
    const allowed = new Set(['month', 'year', 'agenda', 'attention', 'all', 'today', 'upcoming', 'date']);
    const initialView = allowed.has(view) ? view : 'month';
    closeMobileDrawer();

    const {backdrop, panel, content} = modalShell(
      '캘린더',
      sessionToken
        ? 'LOTBI에 등록된 개인 일정을 확인하고 관리합니다.'
        : '로그인 없이 캘린더를 확인할 수 있습니다. 계정 동기화는 로그인 후 사용할 수 있어요.',
    );
    panel.classList.add('site-calendar-modal', 'site-calendar-chat-popup');
    installSurfaceBehavior(backdrop, panel, {
      modal: true,
    });
    const mounted = await mountLifeCalendarManager({
      sessionToken,
      root: content,
      initialView,
      deepOpen,
      initialDraft,
      onOpenFestival: ({festivalId, visitDate}) => { void openFestival({festivalId, selectedDate: visitDate || ''}); },
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

  let navigationCalendarStatusTimer;
  let navigationCalendarStatusGeneration = 0;
  const navigationCalendarEntries = () => [...document.querySelectorAll('[data-calendar-view="all"]')]
    .filter(entry => entry instanceof HTMLButtonElement);
  const navigationCalendarTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
    } catch {
      return 'Asia/Seoul';
    }
  };
  const navigationCalendarLocalDate = (now = new Date(), timezone = navigationCalendarTimezone()) => {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const hasConfiguredReminder = item => (
    item?.reminder_configured === true
    || item?.has_reminder === true
  );
  const navigationCalendarStatus = async () => {
    const timezone = navigationCalendarTimezone();
    const todayDate = navigationCalendarLocalDate(new Date(), timezone);
    if (sessionToken) {
      const today = await getLifeToday(sessionToken, timezone, globalThis.fetch);
      const items = Array.isArray(today?.items) ? today.items : [];
      return Object.freeze({
        count: items.length,
        hasReminder: items.some(hasConfiguredReminder),
      });
    }
    if (!storage) return Object.freeze({count: 0, hasReminder: false});
    const items = createGuestCalendarRepository(storage).list()
      .filter(item => item.local_date === todayDate);
    return Object.freeze({
      count: items.length,
      hasReminder: items.some(hasConfiguredReminder),
    });
  };
  const renderNavigationCalendarStatus = ({count = 0, hasReminder = false} = {}) => {
    const safeCount = Number.isInteger(count) && count > 0 ? count : 0;
    const reminder = safeCount > 0 && hasReminder === true;
    for (const entry of navigationCalendarEntries()) {
      const badge = entry.querySelector('[data-calendar-count]');
      const bell = entry.querySelector('[data-calendar-reminder]');
      if (badge instanceof HTMLElement) {
        badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
        badge.hidden = safeCount === 0;
      }
      if (bell instanceof SVGElement) bell.hidden = !reminder;
      const parts = ['캘린더'];
      if (safeCount > 0) parts.push(`오늘 일정 ${safeCount}개`);
      if (reminder) parts.push('알림 설정 일정 있음');
      entry.setAttribute('aria-label', parts.join(', '));
      entry.dataset.todayEventCount = String(safeCount);
      entry.dataset.hasTodayReminder = String(reminder);
    }
  };
  const scheduleNavigationCalendarMidnightRefresh = () => {
    window.clearTimeout(navigationCalendarStatusTimer);
    navigationCalendarStatusTimer = window.setTimeout(() => {
      void refreshNavigationCalendarStatus();
    }, millisecondsUntilNextLocalMidnight() + 100);
  };
  const refreshNavigationCalendarStatus = async () => {
    if (navigationCalendarEntries().length === 0) return;
    const generation = ++navigationCalendarStatusGeneration;
    const tokenAtStart = sessionToken;
    const namespaceAtStart = namespace;
    try {
      const status = await navigationCalendarStatus();
      if (
        generation !== navigationCalendarStatusGeneration
        || tokenAtStart !== sessionToken
        || namespaceAtStart !== namespace
      ) return;
      renderNavigationCalendarStatus(status);
    } catch (error) {
      if (generation === navigationCalendarStatusGeneration) {
        renderNavigationCalendarStatus({count: 0, hasReminder: false});
        if (error instanceof SiteCoreError && isSessionError(error)) sessionToken = undefined;
      }
    } finally {
      if (generation === navigationCalendarStatusGeneration) scheduleNavigationCalendarMidnightRefresh();
    }
  };
  const onNavigationCalendarRefresh = () => void refreshNavigationCalendarStatus();
  window.addEventListener('lotbi:life-calendar-refresh', onNavigationCalendarRefresh);
  window.addEventListener('pageshow', onNavigationCalendarRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { void refreshNavigationCalendarStatus(); return; }
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
    installSurfaceBehavior(backdrop, panel, {workspace: 'life', trigger, backLabel: '생활정보로 돌아가기', onBack: () => openConsumerSection('life')});
  };

  const openHelp = () => {
    window.location.assign(ACCOUNT_MANAGE_URL + '#help');
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
    const menuIconNames = {프로필: 'profile', 개인테마: 'theme', 설정: 'settings'};
    for (const [label, action] of [['프로필', openProfile], ['개인테마', openPersonalTheme], ['설정', openSettings]]) {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); decorateProfileMenuItem(button, label, menuIconNames[label]);
      button.addEventListener('click', () => { closeSurface(); action(); }); menu.appendChild(button);
    }
    const connectedServices = document.createElement('a');
    connectedServices.href = 'https://account.lotbiai.com/connected-services';
    connectedServices.setAttribute('role', 'menuitem');
    connectedServices.textContent = '연결 서비스'; decorateProfileMenuItem(connectedServices, '연결 서비스', 'connected');
    connectedServices.addEventListener('click', () => closeSurface());
    menu.appendChild(connectedServices);
    const help = document.createElement('button'); help.type = 'button'; help.setAttribute('role', 'menuitem'); help.textContent = '도움말'; decorateProfileMenuItem(help, '도움말', 'help');
    help.addEventListener('click', () => { closeSurface(); openHelp(); }); menu.appendChild(help);
    const logout = document.createElement('button'); logout.type = 'button'; logout.setAttribute('role', 'menuitem');
    logout.className = 'profile-menu-logout'; logout.textContent = '로그아웃'; decorateProfileMenuItem(logout, '로그아웃', 'logout'); logout.disabled = !sessionToken;
    if (!sessionToken) logout.title = 'Site child session 연결 후 사용할 수 있습니다.';
    logout.addEventListener('click', async () => {
      if (!sessionToken) return;
      logout.disabled = true; logout.querySelector('.profile-menu-label').textContent = '로그아웃 중…';
      try {
        discardPendingAttachments();
        await logoutSiteSession(sessionToken); sessionToken = undefined; serverIdentity = undefined; serverSubscription = undefined; closeSurface();
        switchNamespace(anonymousConversationNamespace());
        window.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {detail: {authenticated: false, reason: 'site-logout'}}));
        setStatus('LOTBI 계정 로그아웃을 마무리하고 있습니다.');
        beginAccountLogoutHandoff();
      } catch (error) {
        logout.disabled = false; logout.querySelector('.profile-menu-label').textContent = '로그아웃';
        setStatus(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
      }
    });
    menu.appendChild(logout);
    menu.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
      if (!items.length) return;
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowUp' ? (current <= 0 ? items.length - 1 : current - 1)
        : (current < 0 || current === items.length - 1 ? 0 : current + 1);
      event.preventDefault(); items[next].focus();
    });
    layer.appendChild(menu); trigger.setAttribute('aria-expanded', 'true'); installSurfaceBehavior(layer, menu, {trigger});
  };

  let responseGradeOpen = false;
  let selectedAttachments = [];
  let pendingAttachmentPreviews = [];
  let attachmentUploadsInFlight = 0;
  let attachmentMenuOpen = false;
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
  const appendChipFallbackLabel = (chip, item) => {
    if (chip.querySelector('.attachment-chip-name')) return;
    const label = document.createElement('span');
    label.className = 'attachment-chip-name';
    label.textContent = attachmentDisplayPresentation(item).label;
    chip.insertBefore(label, chip.querySelector('.attachment-chip-meta, .attachment-chip-remove'));
  };
  const appendChipThumbnail = (chip, item) => {
    if (!item || !item.previewUrl || !isPreviewableImageAttachment(item)) return false;
    const thumb = document.createElement('img');
    thumb.className = 'attachment-chip-thumb';
    thumb.decoding = 'async';
    thumb.src = item.previewUrl;
    thumb.alt = attachmentDisplayPresentation(item).imageAlt;
    thumb.addEventListener('error', () => {
      thumb.remove();
      appendChipFallbackLabel(chip, item);
      chip.classList.remove('attachment-chip-with-thumb');
    }, {once: true});
    chip.appendChild(thumb);
    chip.classList.add('attachment-chip-with-thumb');
    return true;
  };
  const renderAttachmentPreview = () => {
    const fragment = document.createDocumentFragment();
    for (const item of selectedAttachments) {
      const chip = document.createElement('span'); chip.className = 'attachment-chip'; chip.dataset.attachmentId = item.id;
      const presentation = attachmentDisplayPresentation(item);
      const hasThumbnail = appendChipThumbnail(chip, item);
      if (!hasThumbnail) {
        const name = document.createElement('span'); name.className = 'attachment-chip-name'; name.textContent = presentation.label;
        chip.appendChild(name);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'attachment-chip-remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', presentation.removeLabel);
      remove.addEventListener('click', async () => {
        if (inFlight || remove.disabled) return;
        remove.disabled = true;
        try {
          const guestToken = sessionToken ? '' : (readGuestSession() || '');
          await deleteConversationAttachment({sessionToken: sessionToken || '', guestToken, attachmentId: item.id});
          selectedAttachments = selectedAttachments.filter(candidate => candidate.id !== item.id);
          releaseComposerPreviewUrl(item.previewUrl);
          renderAttachmentPreview();
          setStatus('첨부 파일을 제거했습니다.');
        } catch (error) {
          if (error instanceof SiteCoreError && error.status === 404) {
            selectedAttachments = selectedAttachments.filter(candidate => candidate.id !== item.id);
            releaseComposerPreviewUrl(item.previewUrl);
            renderAttachmentPreview();
          } else {
            remove.disabled = false;
            setStatus(error instanceof Error ? error.message : '첨부 파일을 제거하지 못했습니다.');
          }
        }
      });
      chip.appendChild(remove); fragment.appendChild(chip);
    }
    // A chosen image shows its thumbnail while the original is still uploading.
    for (const pending of pendingAttachmentPreviews) {
      const chip = document.createElement('span'); chip.className = 'attachment-chip attachment-chip-pending';
      const presentation = attachmentDisplayPresentation(pending);
      const hasThumbnail = appendChipThumbnail(chip, pending);
      if (!hasThumbnail) {
        const name = document.createElement('span'); name.className = 'attachment-chip-name'; name.textContent = presentation.label;
        chip.appendChild(name);
      }
      const meta = document.createElement('span'); meta.className = 'attachment-chip-meta'; meta.textContent = '업로드 중…';
      chip.appendChild(meta); fragment.appendChild(chip);
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
    // Browser-local previews are created from the validated File before upload
    // so the thumbnail is on screen the moment the photo is chosen.
    const queued = validated.map(file => ({
      file,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      previewUrl: createAttachmentPreviewUrl(file),
    }));
    pendingAttachmentPreviews = [...queued];
    closeAttachmentMenu();
    renderAttachmentPreview();
    for (const entry of queued) {
      try {
        const uploaded = await uploadConversationAttachment({
          sessionToken: sessionToken || '',
          guestToken,
          file: entry.file,
        });
        selectedAttachments = [...selectedAttachments, Object.freeze({...uploaded, previewUrl: entry.previewUrl})];
      } catch (error) {
        // A failed upload leaves no half-ready attachment and no stale preview.
        releaseComposerPreviewUrl(entry.previewUrl);
        if (isSessionError(error)) sessionToken = undefined;
        if (isGuestSessionError(error)) clearGuestSession();
        setStatus(error instanceof Error ? error.message : '첨부 파일을 업로드하지 못했습니다.');
      } finally {
        pendingAttachmentPreviews = pendingAttachmentPreviews.filter(candidate => candidate !== entry);
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
  // The server-side attachment binary and the browser-local visual preview have
  // separate lifecycles: clearing the composer (and deleting the uploaded file)
  // must never blank a thumbnail the sent message is still showing.
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
    for (const item of pending) releaseComposerPreviewUrl(item.previewUrl);
    renderAttachmentPreview();
    if (!pending.length || (!session && !guest)) return;
    void Promise.allSettled(pending.map(item => deleteConversationAttachment({
      sessionToken: session,
      guestToken: guest,
      attachmentId: item.id,
    })));
  };
  const clearLocalAttachments = () => {
    for (const item of selectedAttachments) releaseComposerPreviewUrl(item.previewUrl);
    for (const item of pendingAttachmentPreviews) releaseComposerPreviewUrl(item.previewUrl);
    selectedAttachments = [];
    pendingAttachmentPreviews = [];
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
    if (micButton instanceof HTMLButtonElement) micButton.disabled = inFlight || attachmentBusy || voiceRequesting;
    attachmentTrigger.disabled = inFlight || attachmentBusy || selectedAttachments.length >= 3;
    if (attachmentTrigger.disabled && attachmentMenuOpen) closeAttachmentMenu();
    for (const input of attachmentInputs) input.disabled = inFlight || attachmentBusy || selectedAttachments.length >= 3;
  };
  const setListeningState = listening => {
    voiceListening = listening;
    if (!(micButton instanceof HTMLButtonElement)) return;
    micButton.setAttribute('aria-pressed', String(listening));
    micButton.setAttribute('aria-label', listening ? '음성 입력 중지' : '음성 입력'); micButton.title = listening ? '듣는 중 — 눌러서 종료' : '음성 입력';
    if (listening) micButton.dataset.listening = 'true'; else delete micButton.dataset.listening;
  };
  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') throw new Error('음성 입력을 지원하지 않는 브라우저입니다.');
    const pending = navigator.mediaDevices.getUserMedia({audio: true});
    let settled = false;
    // A prompt that never resolves would strand the mic button disabled,
    // because the finally below would never run. If the deadline wins the race
    // the permission may still be granted later, so stop that late stream too —
    // an open track leaves the tab's recording indicator lit.
    pending.then(
      late => { if (settled) for (const track of late.getTracks()) track.stop(); },
      () => {},
    );
    let deadline;
    try {
      const stream = await Promise.race([
        pending,
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new VoiceGuardError(VOICE_PERMISSION_TIMEOUT_MESSAGE)), VOICE_PERMISSION_TIMEOUT_MS); }),
      ]);
      for (const track of stream.getTracks()) track.stop();
    } finally { settled = true; clearTimeout(deadline); }
  };
  const cancelVoiceAutoSend = () => {
    if (voiceAutoSendTimer === undefined) return false;
    clearTimeout(voiceAutoSendTimer); voiceAutoSendTimer = undefined; return true;
  };
  const beginVoiceAutoSend = () => {
    cancelVoiceAutoSend();
    setVoiceFeedback(VOICE_AUTOSEND_PENDING_MESSAGE);
    // A real control, not just a hint. Someone who hears the banner read out
    // has to be able to stop the send without racing to the textarea.
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.dataset.voiceAutoSendCancel = 'true'; cancel.textContent = '취소';
    // Inherits the banner's own colour, so it follows light and dark without
    // adding a rule to a stylesheet another change is already moving.
    cancel.style.cssText = 'margin-inline-start:.4em;padding:0;border:0;background:none;font:inherit;color:inherit;text-decoration:underline;cursor:pointer';
    cancel.addEventListener('click', () => {
      cancelVoiceAutoSend(); setVoiceFeedback(VOICE_AUTOSEND_CANCELLED_MESSAGE); prompt.focus();
    });
    if (stateRegion instanceof HTMLElement) stateRegion.appendChild(cancel);
    voiceAutoSendTimer = setTimeout(() => {
      voiceAutoSendTimer = undefined;
      // Nothing left to send: the text was cleared or a turn is already going.
      if (inFlight || !prompt.value.trim()) { setVoiceFeedback(''); return; }
      void submitCurrentPrompt();
    }, VOICE_AUTOSEND_DELAY_MS);
  };
  const clearVoiceStartDeadline = () => {
    if (voiceStartDeadline === undefined) return;
    clearTimeout(voiceStartDeadline); voiceStartDeadline = undefined;
  };
  // The engine accepted start() and then reported nothing at all. Put the
  // composer back exactly as it was before the click and say so in plain words.
  // Never stand in a blank or invented transcript for speech we did not hear.
  const abandonSilentVoiceEngine = (recognition, consumer) => {
    voiceStartDeadline = undefined;
    if (voiceRecognition !== recognition) return;
    try { recognition.abort(); } catch { /* an engine that never started may refuse to stop */ }
    voiceRecognition = undefined;
    if (voiceAvatarRequestId) { driveAvatar('listening-end', voiceAvatarRequestId); voiceAvatarRequestId = undefined; }
    setListeningState(false);
    consumer?.onListening?.(false);
    voiceRequesting = false; if (micButton instanceof HTMLButtonElement) delete micButton.dataset.requesting; updateSendState();
    if (consumer) {
      if (!consumer.__lotbiSettled) {
        consumer.__lotbiSettled = true;
        consumer.reject?.(new Error(VOICE_ENGINE_SILENT_MESSAGE));
      }
    } else {
      setVoiceFeedback(VOICE_ENGINE_SILENT_MESSAGE);
      prompt.focus();
    }
  };
  // One recognition owner serves both the conversation composer and
  // 진위확인's review-before-submit field. The caller decides where the
  // transcript lands; only the conversation path keeps its existing delayed
  // auto-send. 진위확인 never sends from recognition callbacks.
  const startVoiceInput = async options => {
    const consumer = options?.reviewOnly === true ? options : null;
    const feedback = message => {
      if (consumer) consumer.onStatus?.(message);
      else setVoiceFeedback(message);
    };
    const focusComposer = () => { if (!consumer) prompt.focus(); };
    cancelVoiceAutoSend();
    if (inFlight || voiceRequesting) {
      consumer?.reject?.(new Error('다른 음성 입력이 끝난 뒤 다시 눌러 주세요.'));
      return;
    }
    if (voiceListening && voiceRecognition) {
      voiceRecognition.stop();
      consumer?.reject?.(new Error('듣기를 멈췄어요. 다시 눌러 말씀해 주세요.'));
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof SpeechRecognition !== 'function') {
      const message = '음성 입력을 지원하지 않는 브라우저입니다. 직접 입력해 주세요.';
      if (consumer) consumer.reject?.(new Error(message)); else setVoiceFeedback(message);
      focusComposer();
      return;
    }
    // A recogniser left over from a silent engine is still holding the mic.
    if (voiceRecognition) { const stale = voiceRecognition; voiceRecognition = undefined; clearVoiceStartDeadline(); try { stale.abort(); } catch { /* already gone */ } }
    activeVoiceConsumer = consumer;
    voiceRequesting = true;
    if (micButton instanceof HTMLButtonElement) { micButton.disabled = true; micButton.dataset.requesting = 'true'; }
    feedback('마이크 권한을 확인하고 있습니다.');
    try {
      await requestMicrophoneAccess(); const recognition = new SpeechRecognition(); voiceRecognition = recognition;
      recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        clearVoiceStartDeadline();
        voiceAvatarRequestId = nextAvatarRequestId('voice');
        driveAvatar('listening-start', voiceAvatarRequestId);
        setListeningState(true);
        consumer?.onListening?.(true);
        feedback('듣고 있어요. 확인할 내용을 말씀해 주세요.');
      };
      recognition.onresult = event => {
        const heard = event?.results?.[0]?.[0]?.transcript?.trim?.() || '';
        // Nothing usable came back. Say so plainly; never send an empty turn and
        // never stand in a guess for words we did not hear.
        if (!heard) {
          recognition.__lotbiDone = true;
          if (consumer) { consumer.__lotbiSettled = true; consumer.reject?.(new Error(VOICE_NOTHING_HEARD_MESSAGE)); }
          else setVoiceFeedback(VOICE_NOTHING_HEARD_MESSAGE);
          focusComposer();
          return;
        }
        // "롯비야 내일 날씨" should ask about the weather, not about LOTBI's own
        // name. Drops a leading wake call; text that does not open with one
        // comes back untouched.
        const transcript = stripWakePrefix(heard);
        // A wake call with nothing after it is a call, not a question. Never
        // send an empty turn, and never invent the part that was not said.
        if (!transcript) {
          recognition.__lotbiDone = true;
          if (consumer) { consumer.__lotbiSettled = true; consumer.reject?.(new Error(VOICE_WAKE_ONLY_MESSAGE)); }
          else setVoiceFeedback(VOICE_WAKE_ONLY_MESSAGE);
          focusComposer();
          return;
        }
        recognition.__lotbiDone = true;
        if (consumer) {
          consumer.__lotbiSettled = true;
          consumer.resolve?.(transcript);
          return;
        }
        const current = prompt.value.trimEnd(); prompt.value = current ? `${current} ${transcript}` : transcript;
        prompt.dispatchEvent(new Event('input', {bubbles: true}));
        beginVoiceAutoSend();
      };
      recognition.onerror = event => {
        clearVoiceStartDeadline();
        recognition.__lotbiDone = true;
        const message = voiceErrorMessage(event);
        if (consumer) { consumer.__lotbiSettled = true; consumer.reject?.(new Error(message)); }
        else setVoiceFeedback(message);
      };
      recognition.onend = () => {
        clearVoiceStartDeadline();
        if (voiceAvatarRequestId) driveAvatar('listening-end', voiceAvatarRequestId);
        voiceAvatarRequestId = undefined;
        setListeningState(false);
        consumer?.onListening?.(false);
        if (consumer && !recognition.__lotbiDone && !consumer.__lotbiSettled) {
          consumer.__lotbiSettled = true;
          consumer.reject?.(new Error(VOICE_NOTHING_HEARD_MESSAGE));
        }
        if (voiceRecognition === recognition) voiceRecognition = undefined;
        if (activeVoiceConsumer === consumer) activeVoiceConsumer = undefined;
        updateSendState();
        focusComposer();
      };
      recognition.start();
      voiceStartDeadline = setTimeout(() => abandonSilentVoiceEngine(recognition, consumer), VOICE_RECOGNITION_START_TIMEOUT_MS);
    } catch (error) {
      clearVoiceStartDeadline(); voiceRecognition = undefined; setListeningState(false);
      const message = voiceErrorMessage(error);
      if (consumer) { consumer.__lotbiSettled = true; consumer.reject?.(new Error(message)); }
      else setVoiceFeedback(message);
      focusComposer();
    }
    finally { voiceRequesting = false; if (micButton instanceof HTMLButtonElement) delete micButton.dataset.requesting; updateSendState(); }
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
            timeHint: typeof preview.temporal.local_datetime === 'string' && preview.temporal.local_datetime.length >= 16
              ? preview.temporal.local_datetime.slice(11, 16)
              : '',
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
        const lifeSchool = schoolContextForMessage(message, readSchoolPreference(lifeSchoolKey(), storage));
        const token = await ensureGuestSession();
        if (!turnStillActive()) return;
        const lifeLocation = await resolveLifeLocationContext(message).catch(() => null);
        if (!turnStillActive()) return;
        const response = await sendGuestConversationMessage({
          guestToken: token,
          ...(lifeSchool ? {school: lifeSchool} : {}),
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
          ...(lifeLocation ? {location: lifeLocation} : {}),
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
        if (response.medicalNotice?.emergencyCall === true) meta.emergencyCall = true;
        if (Array.isArray(response.sources) && response.sources.length) meta.sources = response.sources;
      if (response.reusableOutput) meta.reusableOutput = response.reusableOutput;
        if (response.reusableOutput) meta.reusableOutput = response.reusableOutput;
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
        const schoolMeta = compactSchoolResultMeta(response.schoolResult);
        if (schoolMeta) { meta.schoolResult = schoolMeta; rememberSchoolPreferencePatch(schoolMeta); }
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
            timeHint: typeof calendar.activity.temporal.local_datetime === 'string' && calendar.activity.temporal.local_datetime.length >= 16
              ? calendar.activity.temporal.local_datetime.slice(11, 16)
              : '',
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
    const lifeSchool = schoolContextForMessage(message, readSchoolPreference(lifeSchoolKey(), storage));
    try {
      const activeSessionToken = sessionToken;
      const lifeLocation = await resolveLifeLocationContext(message).catch(() => null);
      if (!turnStillActive()) return;
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
          ...(lifeSchool ? {school: lifeSchool} : {}),
          conversationId: activeConversationId,
          turnId: authenticatedRequestId,
          logicalRequestId: authenticatedRequestId,
          stateVersion: Number.isInteger(activeConversation?.stateVersion) ? activeConversation.stateVersion : 0,
          ...(lifeLocation ? {location: lifeLocation} : {}),
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
      if (response.medicalNotice?.emergencyCall === true) meta.emergencyCall = true;
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
      const schoolMeta = compactSchoolResultMeta(response.schoolResult);
      if (schoolMeta) { meta.schoolResult = schoolMeta; rememberSchoolPreferencePatch(schoolMeta); }
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

  if (PUBLIC_SITE_VOICE_RELEASE_ENABLED && micButton instanceof HTMLButtonElement) {
    micButton.disabled = false; micButton.setAttribute('aria-pressed', 'false'); micButton.setAttribute('aria-label', '음성 입력'); micButton.title = '음성 입력';
  }
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
  if (PUBLIC_SITE_VOICE_RELEASE_ENABLED && micButton instanceof HTMLButtonElement) {
    micButton.addEventListener('click', () => void startVoiceInput());
  }

  // SITE-VOICE-WAKE-LISTENER-01 — hands-free calling, within what a browser
  // actually allows. The control stays hidden where the engine cannot do this
  // at all: a toggle that can never work is worse than no toggle.
  if (PUBLIC_SITE_VOICE_RELEASE_ENABLED && wakeButton instanceof HTMLButtonElement && wakeListeningSupported()) {
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
    const consumerSection = target?.closest('[data-consumer-section]');
    if (consumerSection instanceof HTMLButtonElement) {
      event.preventDefault(); void openConsumerSection(consumerSection.dataset.consumerSection); return;
    }
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
    const festivalTrigger = target?.closest('[data-festival-open]');
    if (festivalTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      void openFestival();
      return;
    }
    const petChatAction = target?.closest('[data-pet-chat-action]');
    if (petChatAction instanceof HTMLButtonElement) {
      event.preventDefault();
      void openPetFamily(petChatAction.dataset.petChatAction || 'pets');
      return;
    }
    const lifePrompt = target?.closest('[data-life-prompt]');
    if (lifePrompt instanceof HTMLButtonElement) {
      event.preventDefault();
      if (lifePrompt.dataset.lifePrompt === ANIMAL_HOSPITAL_NEARBY_PROMPT && !inFlight) {
        void requestAssistant(ANIMAL_HOSPITAL_NEARBY_PROMPT, true);
      }
      return;
    }
    const lotbiBoxTrigger = target?.closest('[data-lotbi-box-open]');
    if (lotbiBoxTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      openLotbiBox(lotbiBoxTrigger);
      return;
    }
    const newChat = target?.closest('[data-new-conversation]');
    if (newChat) { event.preventDefault(); closeSurface(); startNewConversation(); return; }
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
    if (event.key === 'Escape') {
      closeConversationMenus();
      if (openSurface?.dataset.workspace) closeSurface();
    }
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
    if (openSurface?.querySelector('.lotbi-box-list, .calendar-product-shell, .profile-photo-picker')) closeSurface();
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
