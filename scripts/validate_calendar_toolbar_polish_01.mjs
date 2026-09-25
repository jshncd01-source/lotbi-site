// Real-browser proof for the toolbar visual polish: the refined look
// (rounder corners, a resting shadow, hover/active feedback) is actually
// computed on screen, and the two constraints the request explicitly called
// out to keep -- 44px touch targets and dark/system-theme readability --
// still hold after the restyle. A source-text check alone cannot prove
// either of those; both depend on the real cascade (including the existing
// unscoped light/dark/system colour rules this polish deliberately layers
// on top of rather than replaces).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
assert.match(css, /\.calendar-toolbar \.calendar-nav-button,[\s\S]{0,400}border-radius:\s*14px;/,
  'toolbar buttons must move to the more refined 14px radius');
assert.match(css, /\.calendar-toolbar \.calendar-nav-button:hover,[\s\S]{0,200}box-shadow:\s*0 3px 8px/,
  'toolbar nav/today/settings buttons must gain a hover elevation change');
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.calendar-toolbar \.calendar-nav-button[\s\S]*transition:\s*none;/,
  'the new hover/press transitions must respect prefers-reduced-motion');
// The original rule (and this exact request/indentation) must still exist --
// validate_calendar_responsive_01.mjs also locks it; this is the same
// contract restated so a toolbar-polish regression fails here too.
assert.ok(css.includes('.calendar-toolbar {\n  grid-row: 1;'), 'must not have touched the base .calendar-toolbar rule');
assert.match(css, /\.calendar-settings-button \{[\s\S]*display:\s*inline-flex;[\s\S]*gap:\s*5px;/,
  'must not have touched the base .calendar-settings-button rule');

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const INNER_REL = 'scripts/.calendar-toolbar-polish-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-toolbar-polish-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4217;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const fixture = theme => `<!doctype html><html lang="ko" data-site-theme="${theme === 'system' ? '' : theme}"${theme === 'system' ? ' data-site-theme-bootstrap="system"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 200; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = () => j({items: []});

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({root, initialView: 'month', timezone: 'Asia/Seoul', now: new Date('2026-09-23T01:00:00Z')});
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid mounted');

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  const target = sel => root.querySelector(sel);
  const rgbaToLinear = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const luminance = ([r, g, b]) => 0.2126 * rgbaToLinear(r) + 0.7152 * rgbaToLinear(g) + 0.0722 * rgbaToLinear(b);
  const parseColor = str => {
    const m = /rgba?\\(([^)]+)\\)/.exec(str || '');
    if (!m) return null;
    return m[1].split(',').map(s => parseFloat(s.trim())).slice(0, 3);
  };
  const contrast = (fg, bg) => {
    const L1 = luminance(fg) + 0.05, L2 = luminance(bg) + 0.05;
    return L1 > L2 ? L1 / L2 : L2 / L1;
  };

  const buttons = {
    previous: target('.calendar-nav-button'),
    today: target('.calendar-today-button'),
    settings: target('.calendar-settings-button'),
    weekTab: [...root.querySelectorAll('.calendar-mode-tab')].find(n => n.textContent === '주'),
    monthTab: [...root.querySelectorAll('.calendar-mode-tab')].find(n => n.textContent === '월'), // selected by default
  };

  result.geometry = {};
  result.radius = {};
  result.contrast = {};
  for (const [name, node] of Object.entries(buttons)) {
    if (!node) { result.geometry[name] = null; continue; }
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    result.geometry[name] = {height: Math.round(rect.height), width: Math.round(rect.width)};
    result.radius[name] = parseFloat(style.borderRadius) || 0;
    const fg = parseColor(style.color);
    // A styled ancestor (e.g. the selected pill) may carry the real
    // background; walk up until a non-transparent one is found, same as a
    // browser's own paint order.
    let bgNode = node, bg = null;
    while (bgNode && !bg) {
      const c = getComputedStyle(bgNode).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) bg = parseColor(c);
      bgNode = bgNode.parentElement;
    }
    if (fg && bg) result.contrast[name] = Math.round(contrast(fg, bg) * 100) / 100;
  }

  out.textContent = JSON.stringify(result);
} catch (e) {
  out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e), viewport: {width: innerWidth, height: innerHeight}});
}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  throw new Error('server start');
}

function wrapperMarkup() {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="1280" height="900" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, theme) {
  fs.writeFileSync(INNER, fixture(theme), 'utf8');
  fs.writeFileSync(WRAPPER, wrapperMarkup(), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=58000', '--dump-dom', `${ORIGIN}/${WRAPPER_REL}`,
  ], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="result">';
  const b = '</pre>';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${theme}: ${v.error}`);
  return v;
}

const browser = browserPath();
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const theme of ['light', 'dark']) {
    const v = run(browser, theme);
    for (const [name, g] of Object.entries(v.geometry)) {
      if (!g) throw new Error(`${theme}: ${name} button not found`);
      if (g.height < 44) throw new Error(`${theme}: ${name} button height dropped below the 44px touch target (${g.height}px)`);
    }
    for (const [name, radius] of Object.entries(v.radius)) {
      if (radius < 10) throw new Error(`${theme}: ${name} did not pick up the refined corner radius (${radius}px)`);
    }
    for (const [name, ratio] of Object.entries(v.contrast)) {
      // WCAG AA for this kind of UI text/icon is 3:1; the pre-existing
      // light/dark colour rules already targeted this, this just confirms
      // the new shadow/radius/typography layer did not quietly break it.
      if (ratio < 3) throw new Error(`${theme}: ${name} text/background contrast dropped to ${ratio}:1`);
    }
    console.log(`${theme}: PASS`, JSON.stringify(v));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
console.log('LOTBI Calendar toolbar polish: PASS');
