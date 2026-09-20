import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const callbackHtml = read('auth/callback/index.html');
const callbackJs = read('auth-callback.js');
const conversation = read('site-conversation.js');
const sidebarCss = read('site-sidebar-nav.css');

for (const token of [
  'THREAD_TITLE_LIMIT',
  'normalizedThreadTitle',
  'normalizeStoredThread',
  'sortThreads',
  'toggleThreadPin',
  'openRenameThread',
  'openDeleteThread',
  'dataset.conversationMenu',
  'dataset.conversationAction',
]) {
  assert.ok(conversation.includes(token), `PHASE 10 conversation contract missing: ${token}`);
}

assert.ok(
  conversation.includes("record = {id: newId('thread'), title: titleFromMessage(firstMessage), pinned: false, pinnedAt: 0"),
  'new conversations must initialize pin metadata without changing the existing title source',
);
assert.ok(
  conversation.includes("pinned: value.pinned === true"),
  'legacy stored conversations must hydrate safely with pin=false when metadata is absent',
);
assert.ok(
  conversation.includes("const aPinned = a.pinned === true") && conversation.includes("if (aPinned !== bPinned) return aPinned ? -1 : 1"),
  'pinned conversations must sort before ordinary recent conversations',
);
assert.ok(
  conversation.includes("record.pinned = record.pinned !== true") && conversation.includes("record.pinnedAt = record.pinned ? Date.now() : 0"),
  'pin and unpin must remain browser-local thread metadata mutations',
);
assert.ok(
  conversation.includes("action('pin', item.pinned === true ? '고정 해제' : '상단에 고정'"),
  'conversation menu must expose pin/unpin in Korean',
);
assert.ok(conversation.includes("action('rename', '이름 바꾸기'"), 'conversation menu must expose rename in Korean');
assert.ok(conversation.includes("action('delete', '삭제'"), 'conversation menu must expose delete in Korean');

assert.ok(conversation.includes("modalShell('대화 이름 바꾸기'"), 'rename must reuse the existing accessible modal system');
assert.ok(conversation.includes('input.maxLength = THREAD_TITLE_LIMIT'), 'manual titles must have an explicit bounded length');
assert.ok(conversation.includes("if (!title) { error.textContent = '대화 이름을 입력해 주세요.'"), 'empty manual titles must fail closed');
assert.ok(conversation.includes("record.title = title; saveState(); closeSurface(); renderRecent()"), 'rename must persist only in the existing local thread state');

assert.ok(conversation.includes("modalShell('대화 삭제'"), 'delete must require an explicit confirmation modal');
assert.ok(conversation.includes("state.threads = state.threads.filter(item => item.id !== id)"), 'delete must remove only the selected local thread');
assert.ok(conversation.includes("const deletingActive = state.activeThreadId === id"), 'delete must distinguish the active thread');
assert.ok(conversation.includes("if (deletingActive) showBlankHome()"), 'deleting the active thread must return to a safe blank Home state');

const managementStart = conversation.indexOf('const closeConversationMenus');
const managementEnd = conversation.indexOf('const lotbiBoxKey', managementStart);
const modalStart = conversation.indexOf('const openRenameThread');
const modalEnd = conversation.indexOf('const colorPicker', modalStart);
assert.ok(managementStart > 0 && managementEnd > managementStart && modalStart > 0 && modalEnd > modalStart);
const managementSource = conversation.slice(managementStart, managementEnd) + conversation.slice(modalStart, modalEnd);
for (const forbidden of ['fetch(', 'sendConversationMessage(', 'sendGuestConversationMessage(', 'executeLifeCalendarCommand(', 'logoutSiteSession(']) {
  assert.ok(!managementSource.includes(forbidden), `conversation management must not add server execution: ${forbidden}`);
}

for (const cssToken of [
  '.conversation-history-item',
  '.conversation-history-open',
  '.conversation-history-actions',
  '.conversation-history-menu-trigger',
  '.conversation-history-menu',
  '.conversation-history-pin',
  '.conversation-history-delete',
  '.conversation-management-modal-actions',
  '.conversation-delete-confirm',
]) {
  assert.ok(sidebarCss.includes(cssToken), `PHASE 10 Sidebar CSS missing: ${cssToken}`);
}

assert.ok(index.includes('href="site-sidebar-nav.css?v=20260920-attachments1"'), 'Home must cache-bust PHASE 10 Sidebar CSS');
assert.ok(index.includes('src="site-conversation.js?v=20260920-nav1"'), 'Home must cache-bust the current conversation runtime');
assert.ok(callbackHtml.includes('href="/site-sidebar-nav.css?v=20260920-attachments1"'), 'auth callback must share PHASE 10 Sidebar CSS');
assert.ok(callbackHtml.includes('src="/auth-callback.js?v=20260920-lotbibox2"'), 'auth callback entry must be cache-busted for PHASE 10');
assert.ok(callbackJs.includes("from './site-conversation.js?v=20260920-lotbibox2'"), 'auth callback must import the PHASE 10 conversation runtime');

console.log('SITE-PUBLIC-UX-CONVERSATION-MANAGEMENT-10 CONTRACT PASS');
