import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const css = [
  'styles.css',
  'home-chat.css',
  'site-hardening.css',
  'site-avatar.css',
  'site-conversation.css',
  'site-sidebar-nav.css',
].map(read).join('\n\n');
const shell = read('home-shell.js');
const avatar = read('site-avatar.js');
const conversation = read('site-conversation.js');
const controller = read('avatar-runtime/runtime/controller.mjs');

for (const token of [
  "window.visualViewport?.addEventListener('resize', syncMobileViewport",
  "window.visualViewport?.addEventListener('scroll', syncMobileViewport",
  "window.addEventListener('orientationchange'",
  "window.matchMedia('(pointer: coarse)')",
  "navigator.maxTouchPoints",
  "'--lotbi-visible-viewport-height'",
  "'--lotbi-visible-viewport-offset-top'",
  "'--lotbi-keyboard-inset'",
  "'mobile-keyboard-open'",
  "'mobile-keyboard-tight'",
  "keyboardRatio <= 0.84",
  "mobileViewportBaseline * 0.16",
  "window.visualViewport?.height || window.innerHeight",
]) assert.ok(shell.includes(token), `missing keyboard viewport contract: ${token}`);
assert.ok(!shell.includes("matchMedia('(max-width: 760px)')"), 'keyboard detection must not be tied to the old phone-width breakpoint');

for (const token of [
  'body.mobile-keyboard-open .chat-home-footer',
  'display: none !important',
  'body.mobile-keyboard-open .chat-composer',
  'body.mobile-keyboard-open .home-avatar-anchor .chat-character-wrap',
  'body.mobile-keyboard-tight .home-avatar-anchor',
  'body.mobile-keyboard-tight .response-grade-trigger',
  'position: fixed',
  'var(--lotbi-visible-viewport-height, 100dvh)',
  'var(--lotbi-visible-viewport-offset-top, 0px)',
  'scroll-padding-bottom',
]) assert.ok(css.includes(token), `missing compact mobile layout contract: ${token}`);

for (const token of [
  'const isThreadNearBottom = () =>',
  'forceScroll = false',
  'suppressScroll = false',
  "{forceScroll: true}",
  "window.addEventListener('lotbi:keyboard-viewport'",
]) assert.ok(conversation.includes(token), `missing conversation scroll contract: ${token}`);

assert.ok(avatar.includes('runtimeEpochSeconds = monotonicSeconds()'));
assert.ok(avatar.includes('const time = runtimeSeconds()'));
assert.ok(avatar.includes('const now = runtimeSeconds()'));
assert.ok(avatar.includes('controller.setBackground(document.hidden, now)'));
assert.ok(avatar.includes('controller.setReducedMotion(Boolean(event.matches), runtimeSeconds())'));
assert.ok(!avatar.includes('Math.random'), 'Site Avatar host must not randomize initial render');
assert.ok(controller.includes("this.state='idle'"), 'sealed Avatar controller must initialize idle');

function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for mobile Home stability validation.');
}

function fixture(keyboard, visibleHeight) {
  const bodyClass = keyboard ? 'chat-home-page mobile-keyboard-open' : 'chat-home-page';
  return `<!doctype html><html lang="ko" style="--lotbi-mobile-viewport-height:${visibleHeight}px"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.replaceAll('</style>', '<\\/style>')}</style></head>
<body class="${bodyClass}">
<div class="chat-app-shell"><main class="chat-home-shell">
<header class="chat-topbar"><div class="topbar-left"><button class="mobile-menu-button"></button><a class="chat-brand">LOTBI</a></div><nav class="account-actions"><a class="account-action account-login">로그인</a><a class="account-action account-signup">회원가입</a></nav></header>
<section class="chat-hero"><div class="home-avatar-anchor"><div class="chat-character-wrap"><div class="site-avatar-stage"></div><img class="chat-character-logo" alt=""></div></div>
<div class="chat-composer"><textarea class="chat-input" rows="1">테스트</textarea><div class="composer-actions"><div class="response-grade-control"><button class="response-grade-trigger">스탠다드<span class="response-grade-chevron">▾</span></button></div><button class="composer-button mic-button">M</button><button class="composer-button send-button">S</button></div></div><div class="chat-state-banner" hidden></div></section>
<footer class="lotbi-footer chat-home-footer">footer</footer>
</main></div></body></html>`;
}

function render(width, height, keyboard) {
  const markup = JSON.stringify(fixture(keyboard, height));
  const html = `<!doctype html><html><body><iframe id="f" style="display:block;width:${width}px;height:${height}px;border:0"></iframe><pre id="r"></pre><script>
const frame=document.getElementById('f'); const doc=frame.contentDocument; doc.open(); doc.write(${markup}); doc.close();
const rect=s=>{const r=doc.querySelector(s).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
const win=frame.contentWindow;
document.getElementById('r').textContent=JSON.stringify({
  viewport:{width:win.innerWidth,height:win.innerHeight,scrollHeight:doc.documentElement.scrollHeight},
  topbar:rect('.chat-topbar'), avatar:rect('.chat-character-wrap'), composer:rect('.chat-composer'),
  input:rect('.chat-input'), grade:rect('.response-grade-trigger'), mic:rect('.mic-button'), send:rect('.send-button'),
  accountDisplay:win.getComputedStyle(doc.querySelector('.account-actions')).display,
  footerDisplay:win.getComputedStyle(doc.querySelector('.chat-home-footer')).display
});</script></body></html>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-mobile-home-'));
  const file = path.join(tmp, 'fixture.html'); fs.writeFileSync(file, html);
  const run = spawnSync(browserPath(), ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1400,1000','--virtual-time-budget=300','--dump-dom',`file://${file}`], {encoding:'utf8', timeout:30000, maxBuffer:8*1024*1024});
  fs.rmSync(tmp,{recursive:true,force:true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(run.stderr || `browser failed: ${run.status}`);
  const match = run.stdout.match(/<pre id="r">([^<]+)<\/pre>/);
  if (!match) throw new Error('mobile Home render result missing');
  return JSON.parse(match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
}

for (const [label,width,height] of [
  ['fold-cover',344,420],
  ['phone',390,420],
  ['large-phone',600,520],
  ['near-old-breakpoint',761,430],
  ['fold-unfolded',884,430],
]) {
  const result = render(width,height,true);
  console.log(label, JSON.stringify(result));
  assert.equal(result.footerDisplay,'none',`${label}: footer intrudes into keyboard viewport`);
  assert.ok(result.composer.top >= 0 && result.composer.bottom <= height + 2, `${label}: composer clipped`);
  assert.ok(result.input.height > 0 && result.input.bottom <= result.composer.bottom + 2, `${label}: textarea clipped`);
  assert.ok(result.grade.width > 0 && result.grade.bottom <= result.composer.bottom + 2, `${label}: response grade clipped`);
  assert.ok(result.mic.width > 0 && result.mic.bottom <= height + 2, `${label}: mic clipped`);
  assert.ok(result.send.width > 0 && result.send.bottom <= height + 2, `${label}: send clipped`);
  assert.ok(result.avatar.top >= -2 && result.avatar.bottom <= result.composer.top + 2, `${label}: Avatar clipped or overlaps composer`);
  assert.ok(result.viewport.scrollHeight <= height + 2, `${label}: keyboard layout introduced body scroll/blank space`);
}

for (const [label,width,height] of [
  ['normal-mobile',390,844],
  ['fold-cover-closed',344,720],
  ['fold-unfolded-closed',884,720],
  ['desktop',1280,800],
]) {
  const result = render(width,height,false);
  assert.notEqual(result.footerDisplay,'none',`${label}: normal closed-keyboard footer must remain available`);
  assert.ok(result.composer.width > 0, `${label}: composer missing when keyboard closed`);
}

console.log('SITE-MOBILE-HOME-UX-STABILITY-01 PASS');
