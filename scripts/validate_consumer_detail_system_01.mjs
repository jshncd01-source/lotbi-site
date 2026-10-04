import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const conversation = read('site-conversation.js');
const css = read('site-consumer-detail.css');
assert.match(read('index.html'), /site-consumer-detail\.css/);
for (const [name, hash] of [['openPersonalTheme', 'personalization'], ['openHelp', 'help']]) {
  const block = conversation.slice(conversation.indexOf(`const ${name} =`), conversation.indexOf(`const ${name} =`) + 450);
  assert.ok(block.includes(`window.location.assign(ACCOUNT_MANAGE_URL + '#${hash}')`));
  assert.doesNotMatch(block.split('};')[0], /modalShell|select|createElement/);
}
for (const selector of ['calendar-settings-dialog', 'calendar-editor-dialog', 'calendar-readonly-dialog', 'calendar-delete-confirm-dialog', 'lotbi-sheet', 'pet-draft-body', 'pet-draft-step', 'pet-draft-review', 'pet-photo-source-menu', 'festival-detail-surface', 'festival-program-item', 'data-scam-result', 'lotbi-entry-card']) assert.ok(css.includes(selector), selector);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /font-size: 16px/);
for (const page of ['auth/callback/index.html', 'app/open/auth/social-return/index.html', 'kakao-navi.html']) assert.match(read(page), /site-consumer-transfer\.css/);
// The normal login entry is a silent redirect; style its error inline only.
const authStart = read('auth/start/index.html');
assert.doesNotMatch(authStart, /rel="stylesheet"|<img/);
assert.match(authStart, /color: #212121/);
assert.match(authStart, /max-width: 460px/);
assert.match(authStart, /a:focus-visible/);
assert.match(authStart, /\[hidden\] \{ display: none !important/);
assert.match(read('site-scam-shield.js'), /분석 근거 자세히 보기/);
assert.match(read('site-consumer-sections.js'), /질문 준비하기/);
assert.match(read('site-consumer-sections.js'), /확인 없이 진행하지 않습니다/);
// Conditional scam questions must stay hidden until the user chooses the incident path.
assert.match(read('site-scam-shield.css'), /\.scam-dialog \[hidden\]\s*\{\s*display:\s*none\s*!important/);
const layout = read('site-consumer-layout.css');
// Workspace is the backdrop's class; .site-modal is its child, not its ancestor.
assert.match(layout, /body\.chat-home-page \.consumer-workspace \.site-modal \.consumer-search input\s*\{[^}]*border:\s*0\s*!important;[^}]*background:\s*transparent\s*!important/);
assert.match(layout, /\.consumer-search:focus-within\s*\{[^}]*outline:/);
assert.match(layout, /\.scam-dialog\s*\{[^}]*width:\s*min\(640px, calc\(100vw - 32px\)\)/);
console.log('CONSUMER_DETAIL_SYSTEM_01 PASS — source coverage, not authenticated E2E');
