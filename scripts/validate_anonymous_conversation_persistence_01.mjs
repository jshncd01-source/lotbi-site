import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ANONYMOUS_CONVERSATION_NAMESPACE_KEY,
  ensureDurableAnonymousConversationNamespace,
} from '../site-conversation-storage.js';

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
}

const durableStorage = new MemoryStorage();
const firstSession = new MemoryStorage();
const createdNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => 'anonymous-focused-test',
});

assert.equal(createdNamespace, 'anonymous-focused-test');
assert.equal(durableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);
assert.equal(firstSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);

const reloadNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => { throw new Error('reload must not create a new namespace'); },
});
assert.equal(reloadNamespace, createdNamespace, 'reload must reuse the same namespace');

const newTabSession = new MemoryStorage();
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage,
    legacySessionStorage: newTabSession,
    createNamespace: () => { throw new Error('new tab must not create a new namespace'); },
  }),
  createdNamespace,
  'new tab/session must restore the durable namespace',
);
assert.equal(newTabSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);

const browserRestartSession = new MemoryStorage();
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage,
    legacySessionStorage: browserRestartSession,
    createNamespace: () => { throw new Error('browser restart must not create a new namespace while local storage survives'); },
  }),
  createdNamespace,
  'browser restart semantics must reuse durable local identity',
);

const legacyDurableStorage = new MemoryStorage();
const legacySessionStorage = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-existing-session'],
]);
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage: legacyDurableStorage,
    legacySessionStorage,
    createNamespace: () => { throw new Error('live legacy session should migrate'); },
  }),
  'anonymous-existing-session',
  'current live legacy namespace must migrate safely',
);
assert.equal(
  legacyDurableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-existing-session',
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
  'durable identity must be authoritative',
);
assert.equal(
  staleSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-durable-authoritative',
);

const conversation = readFileSync('site-conversation.js', 'utf8');
const deterministic = readFileSync('site-deterministic.js', 'utf8');
const storageRuntime = readFileSync('site-conversation-storage.js', 'utf8');

assert.ok(deterministic.includes("import './site-conversation-storage.js';"));
assert.ok(storageRuntime.includes('localStorage'));
assert.ok(!storageRuntime.includes('removeItem('), 'migration must not delete orphaned state');
assert.ok(conversation.includes('const THREAD_LIMIT = 50;'));
assert.ok(conversation.includes('const MESSAGE_LIMIT = 120;'));
assert.ok(conversation.includes("storageKey(namespace, 'threads')"));
assert.ok(conversation.includes('threads: Array.isArray(loadedState.threads)'));
assert.ok(conversation.includes("activeThreadId: typeof loadedState.activeThreadId === 'string'"));
assert.ok(conversation.includes("draft: typeof loadedState.draft === 'string'"));
assert.ok(conversation.includes('record.messages.push(message)'));
assert.ok(conversation.includes('normalizedNamespace(detail.identityKey || detail.installationId)'));
assert.ok(conversation.includes('switchNamespace(browserAnonymousNamespace())'));

console.log('LOTBI ANONYMOUS CONVERSATION PERSISTENCE CONTRACT PASS');
