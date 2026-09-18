import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deterministicReply} from '../site-deterministic.js';

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const conversation = read('site-conversation.js');
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

const localBranch = conversation.indexOf('const local = deterministicReply(message)');
const authBranch = conversation.indexOf('if (!sessionToken)', localBranch);
const coreCall = conversation.indexOf('sendConversationMessage(sessionToken, message)', authBranch);
assert.ok(localBranch > 0 && authBranch > localBranch && coreCall > authBranch, 'deterministic routing must precede auth/Core');
assert.ok(conversation.includes("recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0})"));
assert.ok(conversation.includes("lastPath = 'LOCAL_DETERMINISTIC'"));
assert.ok(conversation.includes('[LOTBI deterministic evidence]'));
assert.ok(conversation.includes('data.conversationCoreRequests') || conversation.includes('dataset.conversationCoreRequests'));

assert.equal((index.match(/data-lotbi-avatar-stage/g) || []).length, 1, 'only one Avatar stage is allowed');
assert.ok(index.includes('data-home-avatar-anchor'));
assert.ok(conversation.includes('slot.appendChild(avatar)'), 'the sealed Avatar DOM must be reparented into the answer row');
assert.ok(conversation.includes('homeAvatarAnchor.appendChild(avatar)'), 'new chat must return the same Avatar DOM home');
assert.ok(conversationCss.includes('grid-template-columns: 48px minmax(0, 1fr)'));

assert.equal((index.match(/data-new-conversation/g) || []).length, 2, 'desktop and mobile new-chat controls required');
assert.ok(!index.match(/data-new-conversation[^>]*disabled/), 'new-chat controls must be active');
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
assert.ok(conversation.includes("reason: 'site-logout'"), 'successful logout must transition Site UI to unauthenticated');
assert.ok(conversation.includes('serverIdentity?.accountHandle'), 'profile row must use the server handle when available');
assert.ok(conversation.includes('getCurrentSiteUser(sessionToken)'), 'profile identity must come from Core /v2/me');
assert.ok(conversation.includes('getCurrentSubscription(sessionToken)'), 'profile plan must come from the canonical Core subscription read');
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
assert.ok(conversationCss.includes('@media (max-width: 760px)'));
assert.ok(conversationCss.includes('max-height: 88svh'));

console.log('SITE-CONVERSATION-SIDEBAR-UX-01 CONTRACT PASS');
