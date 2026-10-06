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
// Primary actions include link-based login gates, not just form buttons.
assert.match(css, /body\.chat-home-page \.site-button-primary\s*\{[^}]*background: var\(--lotbi-text-primary\);[^}]*color: var\(--lotbi-surface-primary\);/);
assert.match(css, /\.site-button-primary:focus-visible\s*\{[^}]*outline: 2px solid var\(--lotbi-focus-ring\)/);
// Narrow calendar settings must have one scrolling body and shrinkable rows.
assert.match(css, /\.calendar-settings-dialog\s*\{\s*overflow: hidden;/);
assert.match(css, /\.calendar-settings-body\s*\{[^}]*min-width: 0;[^}]*max-height: none;[^}]*overflow-x: hidden; overflow-y: auto;/);
assert.match(css, /\.calendar-settings-select-row\s*\{[^}]*flex-direction: column;/);
assert.match(css, /\.calendar-settings-select\s*\{ width: 100%;/);
assert.match(css, /\.calendar-date-trigger\s*\{ min-width: 0; width: 100%; min-height: 44px;/);
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
const manager = read('site-calendar-manager.js');
// LIFE UX 01: the phone toolbar is two rows (‹ month › 오늘 ⚙ / 월 주 목록); the
// settings control still sits in its own 44px track.
assert.match(read('site-consumer-design.css'), /\.calendar-toolbar \{ grid-template-columns: 44px minmax\(0, 1fr\) 44px auto 44px; gap: 4px; \}/, 'mobile Calendar toolbar must keep a 44px settings track in two rows');
assert.match(read('site-consumer-design.css'), /\.calendar-settings-button\s*\{ width: 44px; min-width: 44px; box-sizing: border-box; padding-inline: 0/, 'mobile settings control must fit its 44px toolbar track');
const yearRenderer = manager.slice(manager.indexOf('function renderYear('), manager.indexOf('function renderYear(') + 2500);
assert.match(yearRenderer, /for \(const weekday of weekdayOrder\(state\.weekStart\)\)/, 'year weekday headings must occupy seven separate cells');
assert.match(yearRenderer, /weekdays\.appendChild\(label\)/);
assert.doesNotMatch(yearRenderer, /weekdays\.textContent\s*=/, 'a single text node wraps into the first grid column');
assert.match(layout, /--lotbi-calendar-week-selected-surface: var\(--lotbi-surface-subtle\)/);
assert.match(layout, /\.calendar-mini-weekdays\s*\{ font-size: 12px/);
assert.match(layout, /\.calendar-year-month\s*\{ display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start/);
assert.match(layout, /\.calendar-mini-grid span\s*\{ min-height: 22px; font-size: 12px/);
// Workspace is the backdrop's class; .site-modal is its child, not its ancestor.
assert.match(layout, /body\.chat-home-page \.consumer-workspace \.site-modal \.consumer-search input\s*\{[^}]*border:\s*0\s*!important;[^}]*background:\s*transparent\s*!important/);
assert.match(layout, /\.consumer-search:focus-within\s*\{[^}]*outline:/);
assert.match(layout, /\.scam-dialog\s*\{[^}]*width:\s*min\(640px, calc\(100vw - 32px\)\)/);
console.log('CONSUMER_DETAIL_SYSTEM_01 PASS — source coverage, not authenticated E2E');
