// VERIFICATION_DIALOG_DESIGN_01 (SCAM-PHISHING-REDESIGN-02 contract) — the 사기·피싱
// 확인 screen is a page in the workspace, built from one information
// structure: 3 tabs (문자·이메일 / 인터넷 주소 / 사진·파일), the optional
// 이미 눌렀나요? card, one submit. Static source guards; the browser
// validators render it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const ui = read('site-scam-shield.js');
const css = read('site-scam-shield.css');

assert.doesNotMatch(html, /<dialog class="scam-dialog"|data-scam-input-panel/u, 'no popup markup left in index.html');
// Header: ← 대화로 돌아가기 is the workspace header, outside the content.
assert.match(css, /body\.chat-home-page \.consumer-workspace\[data-workspace="scam"\] \.site-modal-close\.scam-back \{/u);
assert.match(css, /body\.chat-home-page \.consumer-workspace\[data-workspace="scam"\] \{ padding: 24px 40px 72px; background: var\(--sp-bg\);/u, 'the whole area right of the menu is the page');
// Tabs: three, equal, text and address first; 사진·파일 holds both pickers.
assert.match(ui, /\{id: 'text', label: '문자·이메일', icon: 'msg'\},\s*\{id: 'url', label: '인터넷 주소', icon: 'link'\},\s*\{id: 'file', label: '사진·파일', icon: 'files'\},/u);
assert.match(ui, /role: 'tab', 'aria-selected': String\(selected\)/u);
assert.match(ui, /role: 'tabpanel'/u);
assert.match(css, /\.scam-page\.sp-root \.sp-tabs \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
assert.match(ui, /'사진·스크린샷 고르기'[\s\S]*'문서·PDF 고르기'/u, 'photo and document are two choices of one upload, not competing features');
assert.match(ui, /'카메라로 찍기'/u);
assert.match(ui, /'사진 JPG·PNG·WEBP'[\s\S]*'문서 PDF·TXT·HTML'[\s\S]*'1개 · 10MB까지'/u);
// Fields keep real labels and the 20,000-character limit.
assert.match(ui, /el\('label', \{className: 'sp-lbl', text: '받은 문자나 이메일 내용', attrs: \{for: 'scam-text'\}\}\)/u);
assert.match(ui, /el\('label', \{className: 'sp-lbl', text: '의심되는 인터넷 주소', attrs: \{for: 'scam-url'\}\}\)/u);
assert.match(ui, /const maxTextLength = 20000;/u);
assert.match(ui, /const maxFileBytes = 10 \* 1024 \* 1024;/u);
assert.match(ui, /'http:\/\/ 또는 https:\/\/로 시작하는 전체 주소를 넣어 주세요\.'/u, 'a wrong address says why the button is off');
// The incident questions are a separate, optional card; follow-ups only after 네.
assert.match(ui, /el\('span', \{className: 'sp-opt', text: '선택'\}\)/u);
assert.match(ui, /state\.incident === 'yes' \? followUp\(\) : null/u);
// No voice input (LOTBI has none).
assert.doesNotMatch(ui, /data-scam-voice|voice-transcription|scamVoice/u, 'no voice input');
// One scroll owner; phone dock sticks inside it.
assert.doesNotMatch(css, /overflow(?:-y)?:\s*(?:auto|scroll)/u);
assert.match(css, /\.scam-page\.sp-root \[hidden\] \{ display: none !important; \}/u);
console.log('VERIFICATION_DIALOG_DESIGN_01 PASS — page structure source guards (scam workspace); not analysis/API E2E');
