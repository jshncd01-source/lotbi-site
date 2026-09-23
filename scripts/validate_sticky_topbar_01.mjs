// SITE-STICKY-TOPBAR-01 — the Home top bar follows the conversation scroll.
//
// Two things have to hold at once, and the second is the one that breaks:
//   1. scrolling the thread must not carry the bar off the top of the screen, and
//   2. the bar must not take height away from the conversation to do it.
// `position: sticky` satisfies both because the bar keeps the flow box it
// already had. A later switch to `position: fixed` would still pass (1) and
// silently fail (2) on a short screen — a folded cover display, landscape, or a
// phone with the keyboard up — so every assertion below is measured, not read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const css = [
  'styles.css',
  'home-chat.css',
  'site-theme-tokens.css',
  'site-hardening.css',
  'site-conversation.css',
  'site-sidebar-nav.css',
].map(read).join('\n\n');

// The stylesheet is injected with a cache-busting token. A CSS change that
// keeps the old token ships nothing to anyone who has already loaded the page.
const conversationJs = read('site-conversation.js');
const callbackHtml = read('auth/callback/index.html');
const tokenOf = source => source.match(/site-conversation\.css\?v=([A-Za-z0-9._-]+)/)?.[1];
const runtimeToken = tokenOf(conversationJs);
const callbackToken = tokenOf(callbackHtml);
assert.ok(runtimeToken, 'site-conversation.js must load site-conversation.css with a ?v= cache token');
assert.equal(callbackToken, runtimeToken, 'auth callback must request the same site-conversation.css build as the runtime');

function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for sticky top bar validation.');
}

function fixture({keyboard, theme}) {
  const bodyClass = ['chat-home-page', 'conversation-active', keyboard ? 'mobile-keyboard-open' : ''].filter(Boolean).join(' ');
  const turns = Array.from({length: 24}, (_, i) => `
<div class="chat-message chat-message-user">사용자 메시지 ${i + 1} — 스크롤을 만들기 위한 문장입니다.</div>
<div class="chat-assistant-row"><div class="chat-message chat-message-assistant">LOTBI 응답 ${i + 1} — 스레드가 충분히 길어야 상단바가 따라오는지 볼 수 있습니다.</div></div>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.replaceAll('</style>', '<\\/style>')}</style></head>
<body class="${bodyClass}" data-site-theme="${theme}">
<div class="chat-app-shell"><main class="chat-home-shell">
<header class="chat-topbar"><div class="topbar-left"><button class="mobile-menu-button"></button><a class="chat-brand">LOTBI</a></div><nav class="account-actions"><a class="account-action account-login">로그인</a><a class="account-action account-signup">회원가입</a></nav></header>
<section class="chat-hero"><div class="home-avatar-anchor"><div class="chat-character-wrap"><div class="site-avatar-stage"></div><img class="chat-character-logo" alt=""></div></div>
<div id="conversation-thread" class="conversation-thread">${turns}</div>
<div class="chat-composer-stack"><div class="chat-composer"><textarea class="chat-input" rows="1"></textarea><div class="composer-actions"><button class="composer-button mic-button">M</button><button class="composer-button send-button">S</button></div></div></div>
</section>
</main></div></body></html>`;
}

// `unstick` forces the bar back to static so the run reports the layout the
// page had before this contract existed. That baseline is what proves the
// sticky bar costs the conversation no height.
function render(width, height, {keyboard = false, theme = 'light', unstick = false} = {}) {
  const markup = JSON.stringify(fixture({keyboard, theme}));
  const override = unstick ? '<style>.chat-topbar{position:static !important;}</style>' : '';
  const html = `<!doctype html><html><body><iframe id="f" style="display:block;width:${width}px;height:${height}px;border:0"></iframe><pre id="r"></pre><script>
const frame=document.getElementById('f'); const doc=frame.contentDocument; doc.open(); doc.write(${markup}); doc.close();
doc.head.insertAdjacentHTML('beforeend', ${JSON.stringify(override)});
const win=frame.contentWindow;
const shell=doc.querySelector('.chat-home-shell');
const bar=doc.querySelector('.chat-topbar');
const barStyle=win.getComputedStyle(bar);
const probe=()=>{
  const s=shell.getBoundingClientRect(); const b=bar.getBoundingClientRect();
  return {barTop:Math.round(b.top-s.top), barHeight:Math.round(b.height), scrollTop:Math.round(shell.scrollTop)};
};
const atTop=probe();
shell.scrollTop=Math.round((shell.scrollHeight-shell.clientHeight)*0.45); const atMid=probe();
shell.scrollTop=shell.scrollHeight; const atBottom=probe();
shell.scrollTop=0;
document.getElementById('r').textContent=JSON.stringify({
  position:barStyle.position, top:barStyle.top, zIndex:barStyle.zIndex, background:barStyle.backgroundColor,
  clientHeight:shell.clientHeight, scrollRange:Math.round(shell.scrollHeight-shell.clientHeight),
  threadHeight:Math.round(doc.getElementById('conversation-thread').getBoundingClientRect().height),
  atTop, atMid, atBottom
});</script></body></html>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-sticky-topbar-'));
  const file = path.join(tmp, 'fixture.html');
  fs.writeFileSync(file, html);
  const run = spawnSync(browserPath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1400,1000', '--virtual-time-budget=400', '--dump-dom', `file://${file}`], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  fs.rmSync(tmp, {recursive: true, force: true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(run.stderr || `browser failed: ${run.status}`);
  const match = run.stdout.match(/<pre id="r">([^<]+)<\/pre>/);
  if (!match) throw new Error('sticky top bar render result missing');
  return JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
}

const TRANSPARENT = /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/;

// Short screens first: these are the ones a fixed bar would quietly eat.
const VIEWPORTS = [
  ['desktop', 1280, 800, {}],
  ['phone', 390, 844, {}],
  ['fold-cover-folded', 344, 700, {}],
  ['short-phone', 360, 560, {}],
  ['landscape', 740, 360, {}],
  ['keyboard-open', 390, 330, {keyboard: true}],
  ['phone-dark', 390, 844, {theme: 'dark'}],
];

for (const [label, width, height, options] of VIEWPORTS) {
  const result = render(width, height, options);
  const baseline = render(width, height, {...options, unstick: true});
  console.log(label, JSON.stringify(result));

  assert.equal(result.position, 'sticky', `${label}: top bar must be sticky, not ${result.position}`);
  assert.equal(result.top, '0px', `${label}: sticky top bar must pin to the top of the scroller`);
  assert.ok(Number(result.zIndex) > 0, `${label}: sticky top bar needs a stacking order above the thread`);
  assert.ok(!TRANSPARENT.test(result.background), `${label}: the thread scrolls under the bar, so it must be opaque (got ${result.background})`);

  // (1) it follows.
  assert.ok(result.atMid.scrollTop > 0, `${label}: fixture did not produce a scrollable thread`);
  for (const [where, probe] of [['top', result.atTop], ['mid', result.atMid], ['bottom', result.atBottom]]) {
    assert.ok(Math.abs(probe.barTop) <= 1, `${label}: top bar left the top of the screen at ${where} (offset ${probe.barTop}px)`);
    assert.ok(probe.barHeight > 0, `${label}: top bar collapsed at ${where}`);
  }

  // (2) it costs the conversation nothing. Same visible height, same reachable
  // range, same thread box as the non-sticky baseline.
  assert.equal(result.clientHeight, baseline.clientHeight, `${label}: sticky bar changed the conversation viewport height`);
  assert.equal(result.scrollRange, baseline.scrollRange, `${label}: sticky bar changed how much of the thread is reachable`);
  assert.equal(result.threadHeight, baseline.threadHeight, `${label}: sticky bar changed the thread's own height`);
}

console.log('SITE-STICKY-TOPBAR-01 PASS');
