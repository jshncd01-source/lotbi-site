import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deterministicReply} from '../site-deterministic.js';
import './validate_anonymous_conversation_persistence_01.mjs';

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const conversation = read('site-conversation.js');
const core = read('site-core.js');
const conversationCss = read('site-conversation.css');
const sidebarCss = read('site-sidebar-nav.css');
const callback = read('auth-callback.js');
const continuity = read('site-continuity.js');

for (const greeting of ['안녕', '안녕하세요', 'hello', '반가워', '고마워', '감사합니다', '도움말']) {
  assert.ok(deterministicReply(greeting), `${greeting} must use a local deterministic reply`);
}
for (const utility of ['지금 몇 시야', '오늘 날짜', '오늘 무슨 요일이야']) {
  assert.ok(deterministicReply(utility), `${utility} must use browser time deterministically`);
}
for (const general of ['대통령이 누구야', '전주 혁신도시 삼겹살집 추천해줘', '일반 상식 질문', '서울 날씨 알려줘']) {
  assert.equal(deterministicReply(general), undefined, `${general} must remain on authoritative Core/search routing`);
}

const localBranch = conversation.indexOf('const local = attachments.length ? null : deterministicReply(message)');
const calendarAuthBranch = conversation.indexOf('if (!attachments.length && !sessionToken && isExplicitLifeCalendarCommand(message))', localBranch);
const guestBranch = conversation.indexOf('if (!sessionToken) {', calendarAuthBranch);
const guestCall = conversation.indexOf('sendGuestConversationMessage({', guestBranch);
const coreCall = conversation.indexOf('const response = await sendConversationMessage(', guestCall);
const attachmentKey = conversation.indexOf('authenticatedRequestId', coreCall);
assert.ok(
  localBranch > 0
    && calendarAuthBranch > localBranch
    && guestBranch > calendarAuthBranch
    && guestCall > guestBranch
    && coreCall > guestCall
    && attachmentKey > coreCall,
  'deterministic routing must precede account-required Calendar, anonymous guest Core, then stable authenticated Core',
);
assert.ok(conversation.includes("lastPath = 'CORE_GUEST_CONVERSATION'"), 'ordinary anonymous questions must use the guest Core path');
assert.ok(conversation.includes('const local = attachments.length ? null : deterministicReply(message)'), 'selected attachments must bypass local deterministic replies');
assert.ok(conversation.includes('if (!attachments.length && isExplicitLifeCalendarCommand(message))'), 'selected attachments must not execute Calendar commands');
assert.ok(conversation.includes('const guestRequestId = logicalRequestId || newId(\'guest-ai\')'), 'guest provider calls require a stable logical request ID');
assert.ok(conversation.includes('if (isGuestSessionError(caught)) clearGuestSession()'), 'expired guest sessions may be renewed without forcing account login');
assert.ok(!conversation.includes('if (isSessionError(error) || !sessionToken)'), 'anonymous retry must not force account handoff');
assert.ok(conversation.includes("recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0})"));
assert.ok(conversation.includes("lastPath = 'LOCAL_DETERMINISTIC'"));
assert.ok(conversation.includes('[LOTBI deterministic evidence]'));
assert.ok(conversation.includes('data.conversationCoreRequests') || conversation.includes('dataset.conversationCoreRequests'));

assert.equal((index.match(/data-lotbi-avatar-stage/g) || []).length, 1, 'only one Avatar stage is allowed');
assert.ok(index.includes('data-home-avatar-anchor'));
assert.ok(conversation.includes('slot.appendChild(avatar)'), 'the sealed Avatar DOM must be reparented into the answer row');
assert.ok(conversation.includes('homeAvatarAnchor.appendChild(avatar)'), 'new chat must return the same Avatar DOM home');
assert.ok(conversationCss.includes('grid-template-columns: 48px minmax(0, 1fr)'));

assert.equal((index.match(/data-new-conversation/g) || []).length, 4, 'desktop/mobile new-chat controls and desktop/mobile LOTBI logos must share the Home reset contract');
assert.ok(
  /<a class="sidebar-brand"[^>]*data-new-conversation/.test(index),
  'desktop LOTBI logo must reuse the existing new-conversation reset path',
);
assert.ok(
  /<a class="chat-brand mobile-header-brand lotbi-official-brand"[^>]*data-new-conversation/.test(index),
  'mobile LOTBI logo must reuse the existing new-conversation reset path',
);
assert.ok(!index.match(/data-new-conversation[^>]*disabled/), 'Home reset controls must be active');
const startNewConversationStart = conversation.indexOf('const startNewConversation = () => {');
const startNewConversationEnd = conversation.indexOf('const ensureThread = firstMessage => {', startNewConversationStart);
assert.ok(startNewConversationStart > 0 && startNewConversationEnd > startNewConversationStart, 'startNewConversation source must remain bounded');
const startNewConversationSource = conversation.slice(startNewConversationStart, startNewConversationEnd);
assert.ok(startNewConversationSource.includes('state.activeThreadId = null'), 'Home reset must deselect the active conversation');
assert.ok(startNewConversationSource.includes("state.draft = ''") && startNewConversationSource.includes("prompt.value = ''"), 'Home reset must clear composer draft and visible prompt');
assert.ok(startNewConversationSource.includes('saveState()') && startNewConversationSource.includes('showBlankHome()') && startNewConversationSource.includes('renderRecent()'), 'Home reset must persist blank Home and re-render preserved recents');
assert.ok(startNewConversationSource.includes('closeMobileDrawer()'), 'Home reset must close the mobile drawer');
assert.ok(!startNewConversationSource.includes('state.threads ='), 'Home reset must not delete or replace conversation history');
for (const token of ['THREAD_LIMIT', 'activeThreadId', 'titleFromMessage', 'renderRecent', 'activateThread', 'startNewConversation']) {
  assert.ok(conversation.includes(token), `thread persistence contract missing: ${token}`);
}
assert.ok(conversation.includes("identityKey || detail.installationId"));
assert.ok(callback.includes('identityKey: session.installationId'));
assert.ok(callback.includes('installationId: session.installationId'));

for (const color of ['default', 'blue', 'purple', 'green', 'orange', 'pink', 'gray']) {
  assert.ok(conversationCss.includes(`data-chat-color="${color}"`), `missing ${color} user-bubble color`);
}
assert.ok(conversation.includes("storageKey(namespace, 'preferences')"));
assert.ok(conversation.includes("storageKey(namespace, 'threads')"));
assert.ok(continuity.includes("window.dispatchEvent(new CustomEvent('lotbi:sidebar-auth-rendered'))"), 'resolved anonymous auth state must notify the conversation mount after asynchronous boot');
assert.ok(conversation.includes("!stateReady && document.body.dataset.siteAuthState === 'unauthenticated'"), 'guest namespace must hydrate after asynchronous unauthenticated state resolution');

for (const label of ['개인 맞춤 설정', '프로필', '설정', '도움말', '로그아웃']) {
  assert.ok(conversation.includes(label), `profile menu missing ${label}`);
}
for (const a11y of ["event.key === 'Escape'", "event.key !== 'Tab'", "setAttribute('aria-modal', 'true')", "surfaceRestoreFocus.focus()"] ) {
  assert.ok(conversation.includes(a11y), `overlay accessibility missing ${a11y}`);
}
for (const imageContract of ["image/jpeg", "image/png", "image/webp", 'PHOTO_BYTES_LIMIT', 'PHOTO_DIMENSION_LIMIT', "canvas.toDataURL('image/webp'"]) {
  assert.ok(conversation.includes(imageContract), `profile photo contract missing ${imageContract}`);
}
assert.ok(conversation.includes('logoutSiteSession(sessionToken)'), 'logout must use the authoritative Site child-session contract');
assert.ok(conversation.includes("form.action = 'https://account.lotbiai.com/auth/site-logout'"), 'logout must continue through the fixed Account-origin handoff');
assert.ok(conversation.includes('markSiteLogoutSuppression();'), 'logout must persist tab-scoped suppression before Account navigation');
assert.ok(conversation.indexOf('markSiteLogoutSuppression();') < conversation.indexOf("form.action = 'https://account.lotbiai.com/auth/site-logout'"), 'suppression marker must exist before cross-origin logout navigation');
assert.ok(conversation.includes('previewLifeCalendarCommand'), 'Guest direct Calendar command must use deterministic zero-write preview');
assert.ok(conversation.includes('CORE_CALENDAR_GUEST_DETERMINISTIC'), 'Guest direct Calendar command must persist to the browser Calendar without forced login');
assert.ok(conversation.includes("input.name = 'intent'"), 'logout handoff must carry only the bounded intent field');
assert.ok(conversation.includes("input.value = 'logout'"), 'logout handoff must declare the fixed logout intent');
assert.ok(conversation.indexOf('await logoutSiteSession(sessionToken)') < conversation.indexOf('beginAccountLogoutHandoff()'), 'Account logout handoff must start only after Site child revocation succeeds');
assert.ok(conversation.includes("reason: 'site-logout'"), 'successful logout must transition Site UI to unauthenticated');
assert.ok(conversation.includes('serverIdentity?.publicHandle'), 'profile row must use the canonical public handle when available');
assert.ok(conversation.includes('getCurrentSiteUser(sessionToken)'), 'profile identity must come from Core /v2/me');
assert.ok(conversation.includes('getCurrentSubscription(sessionToken)'), 'profile plan must come from the canonical Core subscription read');
assert.ok(core.includes("const GUEST_SESSION_PATH = '/v2/conversation/guest/sessions'"), 'Site must use the isolated guest session endpoint');
assert.ok(core.includes("const GUEST_CONVERSATION_PATH = '/v2/conversation/guest/messages'"), 'Site must use the isolated guest message endpoint');
assert.ok(core.includes('export async function createGuestConversationSession'), 'Site must issue guest sessions without a consumer bearer');
assert.ok(core.includes('export async function sendGuestConversationMessage'), 'Site must expose a dedicated guest message client');
assert.ok(core.includes("'Idempotency-Key': logicalKey"), 'guest message requests must send stable idempotency');
assert.ok(core.includes("'X-LOTBI-Guest-Token': token"), 'guest message requests must carry only the guest namespace token');
assert.ok(core.includes('payload.safety.execution_authority !== false'), 'guest response parsing must fail closed if execution authority is not explicitly false');
assert.ok(core.includes('payload.safety.external_side_effect !== false'), 'guest response parsing must fail closed if an external side effect is claimed');
assert.ok(core.includes("const SUBSCRIPTION_PATH = '/v2/subscription'"), 'Site must target only the canonical subscription read path');
assert.ok(core.includes('export async function getCurrentSubscription'), 'Site subscription parser must be explicit and read-only');
assert.ok(core.includes("announceSessionFailure = true"), 'session requests must preserve the existing default invalid-session signaling');
assert.ok(core.includes("siteSessionRequest(SUBSCRIPTION_PATH, sessionToken, {announceSessionFailure: false}"), 'optional subscription enrichment must not mutate auth state when unavailable');
assert.ok(conversation.includes('serverSubscription?.plan'), 'profile summary may render only the returned canonical plan');
assert.ok(conversation.includes("openSurfaceTrigger === trigger"), 'repeated profile-trigger click must toggle the popover closed');
assert.ok(conversation.includes("a.sidebar-account-entry[href=\"/auth/start/\"]"), 'stale anonymous footer entry must be detectable');
assert.ok(conversation.includes("if (staleLogin instanceof HTMLElement && sessionToken && document.body.dataset.siteAuthState === 'authenticated')"), 'only a confirmed authenticated Site session may self-heal a stale anonymous footer');
assert.ok(conversation.includes("openSummary.replaceWith(profileSummary())"), 'an already-open popover must receive late server identity/plan hydration');
assert.ok(conversation.includes('profile-popover-summary'), 'profile popover must include server-backed identity summary');
assert.ok(conversationCss.includes('.profile-popover-summary-plan'), 'profile popover plan summary styling missing');
assert.ok(sidebarCss.includes('.sidebar-profile-trigger'));
assert.ok(sidebarCss.includes('white-space: nowrap'), 'recent conversation titles must render on exactly one line');
assert.ok(sidebarCss.includes('.conversation-history-item:hover .conversation-history-actions'), 'desktop conversation actions must reveal on row hover');
assert.ok(sidebarCss.includes('.conversation-history-item:focus-within .conversation-history-actions'), 'conversation actions must remain keyboard accessible');
assert.ok(sidebarCss.includes('position: absolute'), 'conversation actions must overlay instead of reserving a permanent title column');
assert.ok(!sidebarCss.includes('-webkit-line-clamp: 2'), 'old two-line recent-title clamp must be removed');
assert.ok(!sidebarCss.includes('animation: sidebar-account-pulse'), 'auth hydration must not animate the sidebar account placeholder');
assert.equal((index.match(/data-calendar-view="today"/g) || []).length, 0, 'Today quick links must be removed from desktop and mobile sidebars');
assert.equal((index.match(/data-calendar-view="attention"/g) || []).length, 0, 'Needs Attention quick links must be removed from desktop and mobile sidebars');
assert.ok(conversationCss.includes('@media (max-width: 760px)'));
assert.ok(conversationCss.includes('max-height: 88svh'));

console.log('SITE-CONVERSATION-SIDEBAR-UX-01 CONTRACT PASS');
