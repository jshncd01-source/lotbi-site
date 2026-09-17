import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cssFiles = [
  'styles.css',
  'home-chat.css',
  'site-hardening.css',
  'site-sidebar-nav.css',
  'site-auth-continuity.css',
  'footer-business-info.css',
  'mobile-entry.css',
  // Runtime appends this stylesheet last; keep the production cascade order.
  'site-conversation.css',
];

const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n\n');

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
  throw new Error('Chrome/Chromium is required for user-bubble render validation.');
}

const cases = [
  '안녕',
  '오늘 뭐 도와줄 수 있어?',
  '지금 몇시야',
  '123',
  'Can you help me find something nearby?',
  'https://example.com/this/is/a/very/long/url/that/must/wrap/inside/the/user/message/bubble/without/overflow',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '이 문장은 사용자 메시지가 충분히 길어졌을 때 최대 폭까지 자연스럽게 늘어난 뒤 정상적으로 여러 줄로 줄바꿈되고, 각 줄 수만큼 높이가 증가하는지 확인하기 위한 긴 한글 질문입니다. 추가 문장을 이어서 데스크톱과 모바일 양쪽에서 동일한 content-fit 높이 계약을 검증합니다.',
];

function htmlFor() {
  const escapedCss = css.replaceAll('</style>', '<\\/style>');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${escapedCss}</style></head>
<body class="chat-home-page conversation-active">
<div class="chat-app-shell">
  <aside class="chat-sidebar chat-sidebar-desktop"></aside>
  <main class="chat-home-shell">
    <header class="chat-topbar"><div class="topbar-left"></div><nav class="account-actions"></nav></header>
    <section class="chat-hero">
      <div class="chat-character-wrap"><div class="chat-character-logo"></div></div>
      <div id="conversation-thread" class="conversation-thread">
        <article class="chat-message chat-message-user"><p class="chat-message-body"></p></article>
        <article class="chat-message chat-message-assistant"><p class="chat-message-body">LOTBI assistant regression guard.</p></article>
      </div>
      <div class="chat-composer"><textarea class="chat-input"></textarea><div class="composer-actions"></div></div>
    </section>
  </main>
</div>
<pre id="render-result"></pre>
<script>
const samples = ${JSON.stringify(cases)};
const bubble = document.querySelector('.chat-message-user');
const body = bubble.querySelector('.chat-message-body');
const assistant = document.querySelector('.chat-message-assistant');
const thread = document.querySelector('.conversation-thread');
const rows = [];
for (const text of samples) {
  body.textContent = text;
  const br = bubble.getBoundingClientRect();
  const tr = body.getBoundingClientRect();
  const cs = getComputedStyle(bubble);
  rows.push({
    text,
    textWidth: tr.width,
    textHeight: tr.height,
    bubbleWidth: br.width,
    bubbleHeight: br.height,
    verticalPadding: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom),
    horizontalPadding: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
    alignSelf: cs.alignSelf,
    justifySelf: cs.justifySelf,
    height: cs.height,
    minHeight: cs.minHeight,
    maxWidth: cs.maxWidth,
    blockSize: cs.blockSize,
    minBlockSize: cs.minBlockSize,
    aspectRatio: cs.aspectRatio,
  });
}
const tcs = getComputedStyle(thread);
const acs = getComputedStyle(assistant);
document.getElementById('render-result').textContent = JSON.stringify({
  viewport: {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
  },
  rows,
  thread: {
    width: thread.getBoundingClientRect().width,
    height: thread.getBoundingClientRect().height,
    display: tcs.display,
    gridAutoRows: tcs.gridAutoRows,
    alignItems: tcs.alignItems,
    alignContent: tcs.alignContent,
  },
  assistant: {
    width: assistant.getBoundingClientRect().width,
    borderTopWidth: acs.borderTopWidth,
    backgroundColor: acs.backgroundColor,
    fontSize: getComputedStyle(assistant.querySelector('.chat-message-body')).fontSize,
    lineHeight: getComputedStyle(assistant.querySelector('.chat-message-body')).lineHeight,
  },
});
</script></body></html>`;
}

function render(width, height) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-user-bubble-'));
  const fixture = path.join(tmp, 'fixture.html');
  fs.writeFileSync(fixture, htmlFor(), 'utf8');
  const browser = browserPath();
  const run = spawnSync(browser, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=500',
    '--dump-dom',
    `file://${fixture}`,
  ], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  fs.rmSync(tmp, {recursive: true, force: true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const match = run.stdout.match(/<pre id="render-result">([^<]+)<\/pre>/);
  if (!match) throw new Error('render result not found in headless browser output');
  return JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
}

function assertContentFit(label, result, expectedViewportWidth) {
  const tolerance = 1.5;
  if (Math.abs(result.viewport.innerWidth - expectedViewportWidth) > tolerance) {
    throw new Error(`${label}: expected ${expectedViewportWidth}px viewport, got ${result.viewport.innerWidth}px`);
  }
  for (const row of result.rows) {
    const expected = row.textHeight + row.verticalPadding;
    if (row.bubbleHeight > expected + tolerance) {
      throw new Error(`${label} ${JSON.stringify(row.text)}: bubble ${row.bubbleHeight}px exceeds content-fit ${expected}px; align-self=${row.alignSelf}`);
    }
    if (row.bubbleWidth > result.thread.width + tolerance) {
      throw new Error(`${label} ${JSON.stringify(row.text)}: bubble overflows conversation thread`);
    }
  }
  const shortRows = result.rows.slice(0, 4);
  for (const row of shortRows) {
    if (row.textHeight > 30) throw new Error(`${label} short message wrapped unexpectedly: ${JSON.stringify(row.text)}`);
  }
  if (result.assistant.borderTopWidth !== '0px') throw new Error(`${label}: assistant border regression`);
  if (result.assistant.backgroundColor !== 'rgba(0, 0, 0, 0)') throw new Error(`${label}: assistant background regression`);
  if (result.assistant.fontSize !== '16px') throw new Error(`${label}: assistant typography regression`);
}

const desktop = render(1440, 900);
const mobile = render(390, 844);
console.log('SITE-USER-BUBBLE-CONTENT-FIT-02 desktop', JSON.stringify(desktop));
console.log('SITE-USER-BUBBLE-CONTENT-FIT-02 mobile', JSON.stringify(mobile));
assertContentFit('desktop', desktop, 1440);
assertContentFit('mobile', mobile, 390);
console.log('SITE-USER-BUBBLE-CONTENT-FIT-02 PASS');
