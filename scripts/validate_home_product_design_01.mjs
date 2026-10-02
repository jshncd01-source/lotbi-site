import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('home-product.css', 'utf8');
const js = fs.readFileSync('home-product.js', 'utf8');
const shell = fs.readFileSync('home-shell.js', 'utf8');

assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, 'Home must keep one h1');
assert.match(html, /<h1>찾고, 계획하고, 기록하는 일상\./, 'Visible product h1 is required');
assert.doesNotMatch(html, /<h1[^>]*\bsr-only\b/, 'Product h1 must not be visually hidden');

for (const hook of [
  'id="lotbi-prompt"',
  'id="conversation-thread"',
  'data-home-avatar-anchor',
  'data-lotbi-avatar-container',
  'data-mobile-nav-open',
  'data-footer-legal-disclosure',
]) assert.ok(html.includes(hook), `Required runtime hook missing: ${hook}`);

for (const moduleName of [
  'mobile-entry.js',
  'site-avatar.js',
  'site-conversation.js',
  'site-continuity.js',
  'site-footer-legal.js',
]) assert.ok(html.includes(moduleName), `Required runtime module missing: ${moduleName}`);

assert.ok(html.includes('home-product.css'), 'Home product stylesheet must be linked');
assert.ok(html.includes('home-product.js'), 'Home product enhancement must be linked');
assert.ok(html.indexOf('site-conversation.css') < html.indexOf('home-product.css'),
  'Initial-home overrides must load after the conversation stylesheet');

for (const phrase of [
  '일상을 돕는 AI 어시스턴트',
  'LOTBI와 대화로.',
  '하루의 선택을 한곳에서 정리하세요',
  '대화의 맥락을 이어가고 중요한 결정은 다시 확인합니다.',
]) assert.ok(html.includes(phrase), `Approved product message missing: ${phrase}`);

assert.match(css, /body\.chat-home-page:not\(\.conversation-active\) \.chat-composer-stack\s*\{[\s\S]*?position:\s*relative;/,
  'Initial composer must stay in normal document flow');
assert.match(css, /\.conversation-active \.home-use-cases[\s\S]*?display:\s*none;/,
  'Product narrative must leave the active conversation layout');
for (const width of ['1024px', '760px', '390px']) {
  assert.ok(css.includes(`max-width: ${width}`), `Responsive contract missing: ${width}`);
}

assert.match(js, /if \(prompt\.value\.trim\(\)\)/,
  'Example prompts must preserve text already being written');
assert.doesNotMatch(js, /requestAssistant|\.submit\(|send-button.*click/,
  'Product enhancement must never auto-send a prompt');
assert.match(shell, /event\.key !== 'Tab'/, 'Mobile drawer must trap Tab navigation');
assert.match(shell, /appShell\?\.setAttribute\('inert'/, 'Open drawer must make the page shell inert');

console.log('HOME PRODUCT DESIGN VALIDATION PASS — visible product story, preserved runtime hooks, responsive flow, safe examples and drawer focus boundary verified.');
