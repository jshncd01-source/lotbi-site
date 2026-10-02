import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const index = read('index.html');
const homeCss = read('home-product.css');
const publicCss = read('styles.css');
const about = read('about.html');

assert.doesNotMatch(index, /한국 생활을 묻고, 찾고, 기록하고, 실행하세요\./u);
assert.match(index, /<h1>찾고, 계획하고, 기록하는 일상\.<br \/>LOTBI와 대화로\.<\/h1>/u);
assert.match(index, /<section id="home-use-cases" class="home-use-cases" aria-labelledby="home-use-cases-title">/u);
assert.equal((index.match(/data-home-product-prompt=/gu) || []).length, 3, 'Home must expose the three approved product examples');
assert.match(homeCss, /\.conversation-active \.home-use-cases,/u, 'product examples must leave once a conversation starts');
assert.match(homeCss, /\.conversation-active \.home-trust\s*\{\s*display:\s*none;/u, 'trust section must leave once a conversation starts');

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
