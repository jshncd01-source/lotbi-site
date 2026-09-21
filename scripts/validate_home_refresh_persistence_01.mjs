import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const conversation = readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const resolverStart = conversation.indexOf('function resolveRestoredActiveThreadId(');
const resolverEnd = conversation.indexOf('\nfunction createMessage(', resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, 'restore resolver must remain independently testable');
const resolverSource = conversation.slice(resolverStart, resolverEnd);
const context = {};
vm.runInNewContext(`${resolverSource}\nthis.resolveRestoredActiveThreadId = resolveRestoredActiveThreadId;`, context);
const resolveRestoredActiveThreadId = context.resolveRestoredActiveThreadId;

const thread = (id, updatedAt = 1) => ({id, title: id, createdAt: updatedAt, updatedAt, messages: [{role: 'user', text: id}]});
const ids = threads => threads.map(item => item.id);

for (const scope of ['GUEST', 'AUTH']) {
  const conversationA = thread(`${scope}-A`, 100);

  // CASE 1 / CASE 3: explicit Home/new-chat state survives reload and history is preserved.
  const blankHome = {threads: [conversationA], activeThreadId: null, draft: ''};
  const beforeHistory = ids(blankHome.threads);
  assert.equal(resolveRestoredActiveThreadId(blankHome.activeThreadId, blankHome.threads), null, `${scope}: explicit blank Home must remain blank after reload`);
  assert.deepEqual(ids(blankHome.threads), beforeHistory, `${scope}: blank Home reload must preserve recent history`);

  // CASE 2: an explicitly active existing thread remains active after reload.
  const activeA = {threads: [conversationA], activeThreadId: conversationA.id, draft: ''};
  assert.equal(resolveRestoredActiveThreadId(activeA.activeThreadId, activeA.threads), conversationA.id, `${scope}: active conversation must restore itself`);

  // CASE 4: first message creates B, and the explicitly active B remains selected on reload.
  const conversationB = thread(`${scope}-B`, 200);
  const afterFirstMessage = {threads: [conversationB, conversationA], activeThreadId: conversationB.id, draft: ''};
  assert.equal(resolveRestoredActiveThreadId(afterFirstMessage.activeThreadId, afterFirstMessage.threads), conversationB.id, `${scope}: newly created conversation must restore after reload`);

  // CASE 5: explicit Home resolution is selection-only and cannot create a phantom thread.
  const phantomGuard = [conversationA];
  const countBefore = phantomGuard.length;
  assert.equal(resolveRestoredActiveThreadId(null, phantomGuard), null, `${scope}: Home refresh must not select a thread`);
  assert.equal(phantomGuard.length, countBefore, `${scope}: Home refresh must not create a phantom thread`);
}

// Preserve the historical compatibility fallback only when a stored selection is absent/stale.
const legacyThreads = [thread('legacy-most-recent', 300), thread('legacy-older', 100)];
assert.equal(resolveRestoredActiveThreadId(undefined, legacyThreads), 'legacy-most-recent', 'legacy state without activeThreadId may still restore the recent thread');
assert.equal(resolveRestoredActiveThreadId('missing-thread', legacyThreads), 'legacy-most-recent', 'stale active thread ids may still fall back to the recent thread');

const start = conversation.indexOf('const startNewConversation = () => {');
const ensure = conversation.indexOf('const ensureThread = firstMessage => {', start);
assert.ok(start >= 0 && ensure > start, 'new conversation source must remain bounded');
const startSource = conversation.slice(start, ensure);
assert.ok(startSource.includes('state.activeThreadId = null'), 'logo/new-chat reset must persist explicit Home selection');
assert.ok(startSource.includes('saveState()'), 'logo/new-chat reset must persist Home state');
assert.ok(startSource.includes('showBlankHome()') && startSource.includes('renderRecent()'), 'reset must show blank Home while preserving recent UI');
assert.ok(!startSource.includes('state.threads ='), 'reset must not delete or replace conversation history');
assert.ok(!startSource.includes('newId('), 'reset must not create a phantom thread');

const ensureEnd = conversation.indexOf('const validThread =', ensure);
const ensureSource = conversation.slice(ensure, ensureEnd);
assert.ok(ensureSource.includes("newId('thread')"), 'a real first message must remain the point where a new thread is created');
assert.ok(ensureSource.includes('state.activeThreadId = record.id'), 'newly created conversation must become active');

const switchStart = conversation.indexOf('const switchNamespace = nextNamespace => {');
const switchEnd = conversation.indexOf('const canonicalProfileName', switchStart);
const switchSource = conversation.slice(switchStart, switchEnd);
assert.ok(switchSource.includes("Object.prototype.hasOwnProperty.call(loadedState, 'activeThreadId')"), 'reload must distinguish explicit null from legacy missing selection');
assert.ok(switchSource.includes('resolveRestoredActiveThreadId(restoredActiveThreadId, state.threads)'), 'reload must use the explicit Home-aware resolver');
assert.ok(!switchSource.includes("if (!state.threads.some(item => item.id === state.activeThreadId)) state.activeThreadId = state.threads[0]?.id || null"), 'old null-overwriting recent fallback must not return');

assert.equal((index.match(/data-new-conversation/g) || []).length, 4, 'desktop/mobile logos and new-chat controls must share reset path');
assert.match(index, /<a class="sidebar-brand"[^>]*data-new-conversation/, 'desktop LOTBI logo must reset to Home');
assert.match(index, /<a class="chat-brand mobile-header-brand lotbi-official-brand"[^>]*data-new-conversation/, 'mobile LOTBI logo must reset to Home');
assert.ok(conversation.includes("const newChat = target?.closest('[data-new-conversation]');"), 'delegated reset handler must remain active');
assert.ok(conversation.includes('if (newChat) { event.preventDefault(); startNewConversation(); return; }'), 'logo/new-chat clicks must use startNewConversation');
assert.ok(index.includes('site-conversation.js?v=20260921-placebodymap4'), 'Production HTML must cache-bust the fixed conversation runtime');

console.log('LOTBI blank Home refresh persistence regression: PASS');
