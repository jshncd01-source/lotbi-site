import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const index = read('index.html');
const homeCss = read('home-bare-white.css');
const publicCss = read('styles.css');
const conversation = read('site-conversation.js');
const about = read('about.html');

assert.match(index, /한국 생활을 묻고, 찾고, 기록하고, 실행하세요\./u);
assert.match(index, /장소·날씨·일정·생활기록을 대화로 도와드려요\./u);
assert.equal((index.match(/data-home-prompt=/gu) || []).length, 3, 'Home must expose exactly three example prompts');
assert.match(conversation, /closest\('\[data-home-prompt\]'\)/u, 'example prompts must be wired to the composer');
assert.match(conversation, /prompt\.focus\(\)/u, 'example prompts must return focus to the composer');
assert.match(homeCss, /\.conversation-active \.home-value-proposition\s*\{\s*display:\s*none;/u, 'value proposition must leave once a conversation starts');

const hiddenInputs = [...index.matchAll(/<input class="sr-only" type="file"[^>]*data-attachment-input="[^"]+"[^>]*>/gu)].map(match => match[0]);
assert.equal(hiddenInputs.length, 3, 'three internal attachment inputs must remain');
for (const input of hiddenInputs) {
  assert.match(input, /tabindex="-1"/u, 'internal picker input must not be a tab stop');
  assert.match(input, /aria-hidden="true"/u, 'internal picker input must not duplicate the visible menu in the accessibility tree');
}

assert.match(publicCss, /\.skip-link\s*\{[^}]*position:\s*fixed;/su, 'skip link must be positioned against the viewport');
assert.match(publicCss, /\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\);/su, 'focused skip link must be fully returned into the viewport');
assert.equal((index.match(/>저장한 항목<\/span>/gu) || []).length, 2, 'desktop and mobile navigation must use the understandable saved-items label');

assert.doesNotMatch(about, /개발·검증 중/u, 'public About copy must not advertise an internal development state');
assert.match(about, /소비자 중심 AI 생활 서비스/u);

console.log('SITE-UIUX-PHASE1-01 PASS');
