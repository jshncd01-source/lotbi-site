import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');

assert.match(
  index,
  /<body class="chat-home-page" data-conversation-restore="pending">/,
  'initial HTML must start conversation restore in PENDING state',
);
assert.match(
  index,
  /site-conversation\.js\?v=20260920-convcalentry1/,
  'hotfix must use a fresh conversation asset cache key',
);

const pendingStyle = index.match(
  /body\[data-conversation-restore="pending"\]\s+\[data-home-avatar-anchor\]\s*\{[^}]*\}/s,
)?.[0] || '';
assert.ok(pendingStyle, 'critical first-paint pending style must be present in initial HTML');
assert.match(pendingStyle, /visibility:\s*hidden\s*;/, 'PENDING must hide the Home Avatar before first paint');
assert.doesNotMatch(pendingStyle, /display\s*:/, 'PENDING must preserve Avatar layout dimensions for the sealed WebGL runtime');

const switchStart = conversation.indexOf('const switchNamespace = nextNamespace => {');
const switchEnd = conversation.indexOf('const profileVisual = () => {', switchStart);
assert.ok(switchStart >= 0 && switchEnd > switchStart, 'namespace restore block must remain present');
const restoreBlock = conversation.slice(switchStart, switchEnd);

const storageRead = restoreBlock.indexOf("storage?.getItem(storageKey(namespace, 'threads'))");
const render = restoreBlock.indexOf('renderActiveThread();');
const ready = restoreBlock.indexOf("document.body.dataset.conversationRestore = 'ready';");
assert.ok(storageRead >= 0, 'persisted thread state must be read before restore completes');
assert.ok(render > storageRead, 'persisted state must render after storage restore');
assert.ok(ready > render, 'restore may become READY only after the initial visual state is rendered');

assert.match(
  restoreBlock,
  /if \(!state\.threads\.some\(item => item\.id === state\.activeThreadId\)\) state\.activeThreadId = state\.threads\[0\]\?\.id \|\| null;/,
  'stale or missing active thread must resolve before READY',
);
assert.match(conversation, /const showBlankHome = \(\) => \{[\s\S]*?restoreAvatarHome\(\);[\s\S]*?thread\.hidden = true;/);
assert.match(conversation, /const startNewConversation = \(\) => \{[\s\S]*?showBlankHome\(\);/);
assert.match(conversation, /slot\.appendChild\(avatar\)/, 'existing assistant Avatar reparent behavior must remain intact');
assert.match(conversation, /switchNamespace\(browserAnonymousNamespace\(\)\)/, 'anonymous restore path must remain intact');
assert.match(conversation, /normalizedNamespace\(detail\.identityKey \|\| detail\.installationId\)/, 'authenticated namespace restore path must remain intact');

console.log('SITE AVATAR REFRESH FLASH 01 CONTRACT PASS');
