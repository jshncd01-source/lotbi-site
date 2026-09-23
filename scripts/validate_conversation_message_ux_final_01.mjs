import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssFiles = [
  'styles.css',
  'home-chat.css',
  'site-hardening.css',
  'site-sidebar-nav.css',
  'site-auth-continuity.css',
  'footer-business-info.css',
  'mobile-entry.css',
  'site-conversation.css',
];
const css = cssFiles.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n\n');
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const messageBody = fs.readFileSync(path.join(ROOT, 'site-message-body.js'), 'utf8');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/site-review.yml'), 'utf8');

assert.ok(!css.includes('#fff1f3'), 'legacy pink default bubble must be removed');
assert.match(css, /body\[data-chat-color="default"\]\s*\{[^}]*--user-bubble:\s*#f5f3f2[^}]*--user-bubble-foreground:\s*#303238/s);
assert.match(css, /\.conversation-thread,[\s\S]*?overflow:\s*visible/);
assert.doesNotMatch(css, /\.conversation-thread[^}]*scrollbar-width:\s*none/s);
assert.doesNotMatch(css, /\.conversation-thread::\-webkit-scrollbar[\s\S]*?display:\s*none/s);
assert.match(css, /\.chat-message-user\.is-collapsible:not\(\.is-expanded\) \.chat-message-body\s*\{[^}]*max-height:[^;}]+;[^}]*overflow:\s*hidden/s);
assert.match(css, /\.chat-message-user\.is-collapsible\.is-expanded \.chat-message-body\s*\{[^}]*max-height:\s*none[^}]*overflow:\s*visible/s);
assert.match(css, /\.chat-code-block\s*\{[\s\S]*?overflow-x:\s*auto[\s\S]*?overflow-y:\s*hidden/);
assert.match(css, /\.chat-message-expand-button\s*\{[^}]*min-height:\s*36px/s);

assert.ok(messageBody.includes('LONG_MESSAGE_CHARACTER_THRESHOLD = 560'));
assert.ok(messageBody.includes('LONG_MESSAGE_LINE_THRESHOLD = 9'));
assert.ok(messageBody.includes("button.type = 'button'"));
assert.ok(messageBody.includes("button.setAttribute('aria-expanded'"));
assert.ok(messageBody.includes("button.textContent = expanded ? '접기' : '더 보기'"));
assert.ok(messageBody.includes("button.addEventListener('click'"));
assert.ok(messageBody.includes("code.textContent = match[2]"));
assert.ok(!messageBody.includes('innerHTML'), 'message renderer must never inject HTML');
assert.ok(conversation.includes("from './site-message-body.js?v=20260923-regionlist1'"));
assert.ok(conversation.includes("if (role === 'user') enhanceExpandableUserMessage(article, body, text);"));
assert.ok(conversation.includes("const displayMessage = message ||"));
assert.ok(conversation.includes("timestampedConversationMessage({role: 'user', text: displayMessage"));
assert.ok(conversation.includes('appendPersistedMessage(userRecord)'), 'full user record must remain the persistence source');
assert.ok(!conversation.includes("text: message.slice("), 'long-message UI must not truncate persisted text');
assert.ok(!conversation.includes("text: message.substring("), 'long-message UI must not truncate persisted text');
assert.ok(workflow.includes('node scripts/validate_conversation_message_ux_final_01.mjs'));
assert.ok(workflow.includes('/site-message-body.js'));

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for conversation message UX geometry validation.');
}

function fixtureMarkup() {
  const escapedCss = css.replaceAll('</style>', '<\\/style>');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${escapedCss}</style></head>
<body class="chat-home-page conversation-active" data-chat-color="default">
<div style="width:100%;min-height:700px">
  <div id="conversation-thread" class="conversation-thread">
    <article id="short" class="chat-message chat-message-user"><div class="chat-message-body">짧은 메시지</div></article>
    <article id="long" class="chat-message chat-message-user is-collapsible">
      <div class="chat-message-body">${'긴 사용자 메시지 내용입니다. 화면을 과도하게 차지하지 않도록 접힌 상태의 실제 높이를 검증합니다. '.repeat(42)}</div>
      <button type="button" class="chat-message-expand-button" aria-expanded="false">더 보기</button>
    </article>
    <article id="code" class="chat-message chat-message-user is-collapsible">
      <div class="chat-message-body"><pre class="chat-code-block"><code>${'const value = "안전한 코드 표시"; // 매우 긴 코드 줄 검증 '.repeat(28)}</code></pre></div>
      <button type="button" class="chat-message-expand-button" aria-expanded="false">더 보기</button>
    </article>
    <article class="chat-message chat-message-assistant"><div class="chat-message-body">LOTBI assistant regression guard.</div></article>
    ${'<article class="chat-message chat-message-assistant"><div class="chat-message-body">scroll filler response</div></article>'.repeat(24)}
  </div>
</div>
</body></html>`;
}

function htmlFor(width, height) {
  const markup = JSON.stringify(fixtureMarkup());
  return `<!doctype html><html lang="ko"><body>
<iframe id="fixture-frame" title="LOTBI message UX fixture" style="display:block;width:${width}px;height:${height}px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const doc = frame.contentDocument;
doc.open(); doc.write(${markup}); doc.close();
const win = frame.contentWindow;
const thread = doc.querySelector('.conversation-thread');
const short = doc.getElementById('short');
const long = doc.getElementById('long');
const longBody = long.querySelector('.chat-message-body');
const longButton = long.querySelector('button');
const code = doc.getElementById('code');
const codeBody = code.querySelector('.chat-message-body');
const codeBlock = code.querySelector('.chat-code-block');
const collapsedHeight = long.getBoundingClientRect().height;
const collapsedBodyHeight = longBody.getBoundingClientRect().height;
const collapsedScrollHeight = longBody.scrollHeight;
const collapsedOverflow = win.getComputedStyle(longBody).overflowY;
long.classList.add('is-expanded');
longButton.setAttribute('aria-expanded', 'true');
longButton.textContent = '접기';
const expandedHeight = long.getBoundingClientRect().height;
const threadStyle = win.getComputedStyle(thread);
const userStyle = win.getComputedStyle(short);
const result = {
  viewportWidth: win.innerWidth,
  horizontalOverflow: doc.documentElement.scrollWidth > doc.documentElement.clientWidth,
  shortCollapsible: short.classList.contains('is-collapsible'),
  collapsedHeight,
  collapsedBodyHeight,
  collapsedScrollHeight,
  collapsedOverflow,
  expandedHeight,
  expandedOverflow: win.getComputedStyle(longBody).overflowY,
  expandedLabel: longButton.textContent,
  expandedAria: longButton.getAttribute('aria-expanded'),
  codeOverflowY: win.getComputedStyle(codeBlock).overflowY,
  codeBodyOverflowY: win.getComputedStyle(codeBody).overflowY,
  codeWidth: code.getBoundingClientRect().width,
  threadWidth: thread.getBoundingClientRect().width,
  threadOverflowY: threadStyle.overflowY,
  threadScrollHeight: thread.scrollHeight,
  threadClientHeight: thread.clientHeight,
  userBackground: userStyle.backgroundColor,
  userForeground: userStyle.color,
  userFontSize: win.getComputedStyle(short.querySelector('.chat-message-body')).fontSize,
  assistantFontSize: win.getComputedStyle(doc.querySelector('.chat-message-assistant .chat-message-body')).fontSize,
};
document.getElementById('render-result').textContent = JSON.stringify(result);
</script></body></html>`;
}

function render(width, height) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-message-ux-'));
  const fixture = path.join(tmp, 'fixture.html');
  fs.writeFileSync(fixture, htmlFor(width, height), 'utf8');
  const run = spawnSync(browserPath(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1600,1000',
    '--virtual-time-budget=500',
    '--dump-dom',
    `file://${fixture}`,
  ], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  fs.rmSync(tmp, {recursive: true, force: true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const match = run.stdout.match(/<pre id="render-result">([^<]+)<\/pre>/);
  if (!match) throw new Error('render result not found');
  return JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
}

for (const width of [340, 390, 412, 768, 1280, 1440]) {
  const value = render(width, 844);
  assert.ok(Math.abs(value.viewportWidth - width) <= 1.5, `${width}px iframe viewport mismatch: ${value.viewportWidth}`);
  assert.equal(value.horizontalOverflow, false, `${width}px must have no global horizontal overflow`);
  assert.equal(value.shortCollapsible, false, `${width}px short message must not collapse`);
  assert.ok(value.collapsedScrollHeight > value.collapsedBodyHeight + 20, `${width}px long message must be visibly clipped in preview`);
  assert.equal(value.collapsedOverflow, 'hidden', `${width}px collapsed message must not expose an inner vertical scrollbar`);
  assert.ok(value.expandedHeight > value.collapsedHeight + 80, `${width}px expanded message must become taller`);
  assert.equal(value.expandedOverflow, 'visible', `${width}px expanded message must flow in transcript`);
  assert.equal(value.expandedLabel, '접기');
  assert.equal(value.expandedAria, 'true');
  assert.equal(value.codeOverflowY, 'hidden', `${width}px code surface must not vertically scroll`);
  assert.ok(value.codeWidth <= value.threadWidth + 1.5, `${width}px code bubble must stay inside transcript`);
  assert.equal(value.threadOverflowY, 'visible', `${width}px transcript must flow into the main pane`);
  assert.equal(value.threadScrollHeight, value.threadClientHeight, `${width}px transcript must expand to its full content height`);
  assert.equal(value.userBackground, 'rgb(245, 243, 242)', `${width}px default bubble must be low-saturation warm neutral`);
  assert.equal(value.userForeground, 'rgb(48, 50, 56)', `${width}px default text must stay dark charcoal`);
  assert.equal(value.userFontSize, value.assistantFontSize, `${width}px user/assistant typography must match`);
  assert.equal(value.userFontSize, width <= 760 ? '16px' : '17px', `${width}px responsive typography`);
}

console.log('SITE-CONVERSATION-MESSAGE-UX-FINAL-01 PASS');
