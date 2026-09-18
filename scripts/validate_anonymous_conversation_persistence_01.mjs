import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ANONYMOUS_CONVERSATION_NAMESPACE_KEY,
  ensureDurableAnonymousConversationNamespace,
} from '../site-auth.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const durableStorage = new MemoryStorage();
const firstSession = new MemoryStorage();
const createdNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => 'anonymous-focused-test',
});

assert.equal(createdNamespace, 'anonymous-focused-test', 'first anonymous visit must create one namespace');
assert.equal(durableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace, 'namespace must be durable in local storage');
assert.equal(firstSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace, 'legacy session key stays compatible for current code');

const reloadNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => { throw new Error('reload must not create a new namespace'); },
});
assert.equal(reloadNamespace, createdNamespace, 'reload must reuse the same anonymous namespace');

const newTabSession = new MemoryStorage();
const newTabNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: newTabSession,
  createNamespace: () => { throw new Error('new tab must not create a new namespace'); },
});
assert.equal(newTabNamespace, createdNamespace, 'new tab/session must restore the durable namespace');
assert.equal(newTabSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace, 'new session receives the durable namespace');

const browserRestartSession = new MemoryStorage();
const browserRestartNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: browserRestartSession,
  createNamespace: () => { throw new Error('browser restart must not create a new namespace while local storage survives'); },
});
assert.equal(browserRestartNamespace, createdNamespace, 'browser restart semantics must reuse durable local storage identity');

const legacyDurableStorage = new MemoryStorage();
const legacySessionStorage = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-existing-session'],
]);
const migratedNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage: legacyDurableStorage,
  legacySessionStorage,
  createNamespace: () => { throw new Error('live legacy session should migrate instead of generating a new namespace'); },
});
assert.equal(migratedNamespace, 'anonymous-existing-session', 'current live legacy session namespace must migrate safely');
assert.equal(
  legacyDurableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-existing-session',
  'legacy current-session namespace must become durable',
);

const durableWins = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-durable-authoritative'],
]);
const staleSession = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-stale-session'],
]);
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage: durableWins,
    legacySessionStorage: staleSession,
    createNamespace: () => { throw new Error('durable identity exists'); },
  }),
  'anonymous-durable-authoritative',
  'durable anonymous identity must be authoritative once established',
);
assert.equal(
  staleSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-durable-authoritative',
  'session compatibility key must converge to durable identity',
);

const conversation = readFileSync('site-conversation.js', 'utf8');
assert.ok(conversation.includes('const THREAD_LIMIT = 50;'), 'THREAD_LIMIT must remain 50');
assert.ok(conversation.includes('const MESSAGE_LIMIT = 120;'), 'MESSAGE_LIMIT must remain 120');
assert.ok(conversation.includes("storageKey(namespace, 'threads')"), 'thread storage remains namespace-scoped');
assert.ok(conversation.includes('threads: Array.isArray(loadedState.threads)'), 'threads must restore from persisted state');
assert.ok(conversation.includes("activeThreadId: typeof loadedState.activeThreadId === 'string'"), 'active thread must restore');
assert.ok(conversation.includes("draft: typeof loadedState.draft === 'string'"), 'draft must restore');
assert.ok(conversation.includes('record.messages.push(message)'), 'messages must remain persisted in thread state');
assert.ok(conversation.includes('normalizedNamespace(detail.identityKey || detail.installationId)'), 'authenticated namespace isolation must remain');
assert.ok(conversation.includes('switchNamespace(browserAnonymousNamespace())'), 'logout must return to anonymous namespace without account/anonymous merge');

console.log('LOTBI ANONYMOUS CONVERSATION PERSISTENCE CONTRACT PASS');
