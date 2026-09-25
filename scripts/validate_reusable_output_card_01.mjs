import assert from 'node:assert/strict';
import fs from 'node:fs';

const card = fs.readFileSync(new URL('../site-output-card.js', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../site-core.js', import.meta.url), 'utf8');
const conversation = fs.readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../site-conversation.css', import.meta.url), 'utf8');

assert.match(core, /function normalizeReusableOutput\(/);
assert.match(core, /variants\.length > 3/);
assert.match(core, /reusableOutput: normalizeReusableOutput\(payload\.reusable_output\)/);
assert.match(conversation, /meta\.reusableOutput = response\.reusableOutput/);
assert.match(conversation, /createReusableOutputCard\(message\.meta\?\.reusableOutput/);
assert.match(conversation, /shareMessageText\(text, \{includeUrl = true\}/);
assert.match(card, /createSafeMessageBody\(variant\.text\)/);
assert.match(card, /variants\[index\]\.text/);
assert.match(card, /variants\.length > 1/);
assert.doesNotMatch(card, /innerHTML/);
assert.match(css, /\.reusable-output-page[^}]*overflow:\s*visible/s);
assert.match(css, /touch-action:\s*pan-y/);
console.log('SITE-REUSABLE-OUTPUT-CARD-01 PASS');
