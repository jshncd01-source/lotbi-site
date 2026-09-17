import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deterministicReply} from '../site-deterministic.js';

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const conversation = read('site-conversation.js');
const conversationCss = read('site-conversation.css');
const sidebarCss = read('site-sidebar-nav.css');
const callback = read('auth-callback.js');

for (const greeting of ['안녕', '안녕하세요', 'hello', '반가워', '고마워', '감사합니다', '도움말']) {
  assert.ok(deterministicReply(greeting), `${greeting} must use a local deterministic reply`);
}
for (const utility of ['지금 몇 시야', '오늘 날짜', '오늘 무슨 요일']) {
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
assert.ok(sidebarCss.includes('.sidebar-profile-trigger'));
assert.ok(conversationCss.includes('@media (max-width: 760px)'));
assert.ok(conversationCss.includes('max-height: 88svh'));

console.log('SITE-CONVERSATION-SIDEBAR-UX-01 CONTRACT PASS');
