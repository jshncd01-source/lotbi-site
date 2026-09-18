import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const conversation = readFileSync('site-conversation.js', 'utf8');
const functionStart = conversation.indexOf('function browserAnonymousNamespace()');
const functionEnd = conversation.indexOf('\nconst storageKey', functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'browserAnonymousNamespace must exist');
const anonymousNamespace = conversation.slice(functionStart, functionEnd);

assert.ok(anonymousNamespace.includes('const storage = safeStorage();'), 'anonymous namespace must use durable local storage');
assert.ok(anonymousNamespace.includes('normalizedNamespace(storage?.getItem(key))'), 'durable namespace must be restored before session fallback');
assert.ok(anonymousNamespace.includes('normalizedNamespace(session?.getItem(key))'), 'current legacy session namespace must remain safely migratable');
assert.ok(anonymousNamespace.includes('storage.setItem(key, value)'), 'resolved anonymous namespace must be persisted durably');
assert.ok(!anonymousNamespace.includes('removeItem('), 'anonymous namespace migration must not delete orphaned conversation data');
assert.ok(anonymousNamespace.indexOf('storage?.getItem(key)') < anonymousNamespace.indexOf('session?.getItem(key)'), 'durable namespace must be authoritative over legacy session state');

assert.ok(conversation.includes('const THREAD_LIMIT = 50;'), 'THREAD_LIMIT must remain 50');
assert.ok(conversation.includes('const MESSAGE_LIMIT = 120;'), 'MESSAGE_LIMIT must remain 120');
assert.ok(conversation.includes("storageKey(namespace, 'threads')"), 'thread storage key contract must remain namespaced');
assert.ok(conversation.includes('threads: Array.isArray(loadedState.threads)'), 'threads must restore from persisted state');
assert.ok(conversation.includes("activeThreadId: typeof loadedState.activeThreadId === 'string'"), 'active thread must restore');
assert.ok(conversation.includes("draft: typeof loadedState.draft === 'string'"), 'draft must restore');
assert.ok(conversation.includes('record.messages.push(message)'), 'messages must remain persisted inside thread state');
assert.ok(conversation.includes('normalizedNamespace(detail.identityKey || detail.installationId)'), 'authenticated namespace isolation must remain');
assert.ok(conversation.includes('switchNamespace(browserAnonymousNamespace())'), 'logout must return to anonymous namespace without merging account state');

console.log('LOTBI ANONYMOUS CONVERSATION PERSISTENCE CONTRACT PASS');
