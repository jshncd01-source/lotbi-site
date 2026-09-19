import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const core = read('site-core.js');
const conversation = read('site-conversation.js');
const index = read('index.html');

assert.match(index, /site-conversation\.js\?v=20260919-corepredeploy1/);
assert.match(conversation, /site-core\.js\?v=20260919-idem1/);

assert.match(core, /AI_IDEMPOTENCY_KEY_PATTERN\s*=\s*\/\^\[A-Za-z0-9\._:-\]\{8,160\}\$\//);
assert.match(core, /headers\['Idempotency-Key'\]\s*=\s*idempotencyKey/);
assert.match(core, /SITE_AI_IDEMPOTENCY_INVALID/);
assert.match(core, /body:\s*JSON\.stringify\(\{text: message\}\)/);

assert.match(conversation, /logicalRequestId\s*=\s*''/);
assert.match(conversation, /stableLogicalRequestId\s*=\s*logicalRequestId\s*\|\|\s*newId\('site-ai'\)/);
assert.match(conversation, /sendConversationMessage\(sessionToken, message, \{idempotencyKey: stableLogicalRequestId\}\)/);
assert.match(conversation, /requestAssistant\(retryText, !retryWithoutDuplicate, logicalRequestId\)/);
assert.match(conversation, /showError\(caught, message, true, stableLogicalRequestId\)/);

assert.match(index, /data-response-grade="LIGHT"/);
assert.match(index, /data-response-grade="STANDARD"/);
assert.match(index, /data-response-grade="PREMIUM"/);

// Core currently publishes no stable response-grade request field. Keep the
// selected grade local-only until an explicit authoritative Core contract exists.
assert.doesNotMatch(core, /response_grade|responseGrade|LIGHT|STANDARD|PREMIUM/);
assert.doesNotMatch(core, /provider|model_override|openai|anthropic|gemini/iu);

console.log('SITE RESPONSE GRADE CORE PREDEPLOY CONTRACT PASS');
