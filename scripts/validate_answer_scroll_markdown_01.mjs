// SITE-ANSWER-SCROLL-FOLLOW-01 / SITE-ANSWER-MARKDOWN-01
//
// 대표: "모델추천해달라고 하면 답변이오고 스크롤이 위로 올라가있어서 답변을
// 확인하려면 스크롤을 다시 내려야해"
//
// Reproduced at 390x844 before changing anything, which ruled out two of the
// three candidates rather than guessing between them:
//
//   distance from bottom when the reader is pinned there   0px  (threshold 72)
//   after removing the loading bubble                      0px  → shouldStick true
//   after appending a long answer and scrolling            0px  → the scroll works
//   after an image inside that answer finishes loading   139px  → the reader is
//                                                                 left above it
//
// So neither the 72px threshold nor the synchronous scroll was wrong. What was
// wrong is that a single scroll at append time cannot account for content that
// grows afterwards, and product cards — which is what "모델 추천" returns —
// carry images that grow exactly then.
//
// The same screen also showed ** reaching the reader as literal asterisks,
// because the answer renderer only understood code fences and backticks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const conversation = read('site-conversation.js');
const messageBody = read('site-message-body.js');

// ── 1. Staying at the bottom survives later growth ────────────────────────
assert.ok(
  /new ResizeObserver\(\(\) => \{ if \(followThreadBottom\) scrollThread\(\); \}\)\.observe\(thread\)/.test(conversation),
  'the thread must keep following the bottom while an answer is still growing',
);

// ── 2. A reader who scrolled up is never pulled down ──────────────────────
// The flag is refreshed from the reader's own scrolling. Growth does not move
// scrollTop and so fires no scroll event, which is what lets the pre-growth
// answer survive long enough to act on.
assert.ok(
  /mainScrollHost\.addEventListener\('scroll', \(\) => \{\s*followThreadBottom = isThreadNearBottom\(\);/.test(conversation),
  'the follow-the-bottom intent must be refreshed by the reader’s own scrolling',
);
assert.ok(
  conversation.includes('if (followThreadBottom) scrollThread();'),
  'growth must only scroll when the reader was already at the bottom',
);
// The threshold that decides "was at the bottom" stays where it was; this
// change was never about widening it.
assert.ok(
  /mainScrollHost\.scrollHeight - mainScrollHost\.scrollTop - mainScrollHost\.clientHeight <= 72/.test(conversation),
  'the near-bottom threshold must stay at 72px',
);

// ── 3. The answer renders Markdown, and never as parsed markup ────────────
for (const [label, needle] of [
  ['bold', 'const strong = document.createElement(\'strong\')'],
  ['lists', "list = document.createElement('ul')"],
  ['paragraphs', "paragraph = document.createElement('p')"],
]) {
  assert.ok(messageBody.includes(needle), `the answer renderer must handle ${label}`);
}
assert.ok(
  messageBody.includes('function appendEmphasis') && messageBody.includes('function appendRichText'),
  'the answer renderer must keep its Markdown helpers',
);

// Security. Model output is untrusted; it may only ever become text nodes and
// elements this file creates itself. A parsed-markup sink would turn an answer
// into script.
for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'createContextualFragment']) {
  assert.ok(
    !messageBody.includes(sink),
    `the answer renderer must not reach for ${sink} — model output is untrusted`,
  );
}

// Code fences keep their own path: they must stay verbatim, not run through
// the emphasis pass.
assert.ok(
  messageBody.includes("const pre = document.createElement('pre')") && messageBody.includes('code.textContent = match[2]'),
  'fenced code must still render verbatim',
);

// ── 4. The blocks the renderer emits are styled ───────────────────────────
// .chat-message-body is pre-wrap; a list inheriting that puts every marker on
// its own line.
const css = read('site-conversation.css');
assert.ok(/\.chat-message-list\s*\{[^}]*white-space:\s*normal/.test(css),
  '.chat-message-list must opt out of the body’s pre-wrap');
assert.ok(/\.chat-message-list\s*\{[^}]*padding-left/.test(css),
  '.chat-message-list must leave room for its markers');
assert.ok(css.includes('.chat-message-paragraph'), 'paragraphs must carry their own spacing');

console.log('SITE-ANSWER-SCROLL-FOLLOW-01 / SITE-ANSWER-MARKDOWN-01 OK — the thread follows growing answers, Markdown renders as nodes');
