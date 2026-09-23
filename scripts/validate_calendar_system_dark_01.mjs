// 기기 설정 따름 + OS 다크에서 캘린더가 라이트로 남던 결함.
//
// site-calendar.css 의 다크 규칙이 전부 `body[data-site-theme="dark"]` 로만
// 걸려 있었다. 그런데 이 속성은 **고른 값 그대로**(system | light | dark)를
// 담고, 기본값이 system 이다. 테마를 한 번도 건드리지 않은 다크 모드 사용자는
// 그 규칙 중 **어느 것도** 맞지 않는다.
//
// lotbiai.com 에서 실제로 잰 값: 날짜를 눌렀을 때 뜨는 하단 시트가 흰 배경에
// 흰 글자, 대비 1.05:1. "좀 밝다"가 아니라 안 보인다.
//
// 이 검증기는 두 가지를 본다.
//   1) 생성된 미러가 원본과 어긋나지 않았는가 (복사본이 낡는 것을 막는다)
//   2) 실제 브라우저에서 세 가지 테마 상태 전부가 어두운가, 그리고 대비가
//      기준을 넘는가
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generate, BEGIN, END} from './generate_calendar_system_dark.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-sysdark-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-sysdark-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4203;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// --- 1. the mirror must match its source -----------------------------------
{
  const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
  const start = css.indexOf(BEGIN);
  const end = css.indexOf(END);
  assert.ok(start !== -1 && end !== -1, 'the system-dark mirror block is missing from site-calendar.css');
  const present = css.slice(start, end + END.length) + '\n';
  assert.equal(present.trim(), generate(css).trim(),
    'the system-dark mirror is stale -- run: node scripts/generate_calendar_system_dark.mjs');
  // A dark rule that the mirror never reached would be the original bug again.
  const dark = [...generate(css).matchAll(/data-site-theme="system"\]([^,{]*)/g)].map(m => m[1].trim());
  assert.ok(dark.length > 30, `expected the mirror to cover the file's dark rules, covered ${dark.length}`);
}

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// theme is written by the harness; "system" is the default nobody has touched.
const fixture = theme => `<!doctype html><html lang="ko" data-site-theme-bootstrap="${theme}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated" data-site-theme="${theme}">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, l) => { for (let i = 0; i < 300; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + l); };
try {
  localStorage.clear();
  const j = b => Promise.resolve(new Response(JSON.stringify(b), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = u2 => { const u = new URL(String(u2), location.origin);
    if (u.pathname.includes('/attention')) return j({view:'ATTENTION',as_of:'2026-09-16T00:00:00Z',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if (u.pathname.includes('/unscheduled')) return j({view:'UNSCHEDULED',items:[],ai_calls:0,provider_api_calls:0});
    if (u.pathname.includes('/weather')) return j({provider_ready:false,items:[],ai_calls:0});
    if (u.pathname.includes('/expense')) return j({view:'EXPENSE_SUMMARY',as_of:'2026-09-16T00:00:00Z',timezone:'Asia/Seoul',start_date:'2026-09-01',end_date:'2026-09-30',coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',entries_without_amount:0,ai_calls:0,provider_api_calls:0,currencies:[]});
    if (u.pathname.includes('/holidays')) return j({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'f',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    return j({view:'AGENDA',as_of:'2026-09-16T00:00:00Z',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0}); };
  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({sessionToken:'t', root, initialView:'month', timezone:'Asia/Seoul', now:new Date('2026-09-16T01:00:00Z'), locationProvider:null, locationPermissions:null});
  await wait(() => root.querySelector('.calendar-month-grid'), 'grid');
  // open the day panel and the settings dialog: both were failing on the real site
  root.querySelector('.calendar-date-cell[data-current-month="true"]')?.click();
  await sleep(500);
  root.querySelector('.calendar-settings-button')?.click();
  await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings');
  await sleep(300);

  // NOT a spot list. Twice now a list I curated went green while the screen
  // did not: #240 missed the section heading sitting right next to the rows it
  // did check, and #241 was written only after production measured it. So this
  // walks every element that paints its own text on these surfaces.
  const chan = v => { const m = /rgba?\\(([^)]+)\\)/.exec(v); return m ? m[1].split(',').map(n => +n.trim()) : null; };
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = v => { const c = chan(v); return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
  // Walk up for the first surface that actually covers what is behind it: a
  // translucent layer is not the background the eye compares the text against.
  const bgOf = n => { let e = n; while (e) { const c = getComputedStyle(e).backgroundColor; const q = chan(c); if (q && (q[3] === undefined || q[3] > 0.85)) return c; e = e.parentElement; } return 'rgb(255, 255, 255)'; };
  const rows = [];
  const seen = new Set();
  for (const root of document.querySelectorAll('.calendar-product-shell, .calendar-settings-dialog, .calendar-day-panel')) {
    for (const el of root.querySelectorAll('*')) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const key = String(el.className) + '|' + el.tagName;
      if (seen.has(key)) continue;
      seen.add(key);
      const size = parseFloat(cs.fontSize);
      // The expense summary is ⑭ CALENDAR-LEDGER's file. Measured and reported,
      // never asserted here: this room does not get to fail another room's CI,
      // and it does not get to quietly fix their file either.
      rows.push({
        owner: el.closest('[class*="calendar-expense"]') ? 'ledger' : 'calendar',
        what: String(el.className || el.tagName).split(' ')[0],
        text: el.textContent.trim().slice(0, 16),
        ink: cs.color, bg: bgOf(el),
        ratio: Math.round(ratio(cs.color, bgOf(el)) * 100) / 100,
        // WCAG's large-text allowance, and nothing looser than that.
        floor: (size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)) ? 3 : 4.5,
      });
    }
  }
  // "Did the theme apply" is a question about SURFACES, not about every element:
  // a navy-filled primary button is dark on purpose in the light theme, and
  // flagging it was a false alarm in the first draft of this check.
  const surfaces = [];
  for (const sel of ['.site-calendar-modal', '.calendar-day-panel', '.calendar-settings-dialog', '.calendar-date-cell[data-current-month="true"]']) {
    const n = document.querySelector(sel);
    if (n) surfaces.push({sel, bg: getComputedStyle(n).backgroundColor});
  }
  out.textContent = JSON.stringify({ok: true, theme: document.body.dataset.siteTheme, rows, surfaces});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e)}); }
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    if (spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000}).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  throw new Error('server start');
}

// --dump-dom cannot emulate an OS preference, and no flag does it either: the
// only honest way to test `prefers-color-scheme` is to drive the browser and
// set it through CDP. That gap is precisely how this bug reached production --
// every dark test so far either stamped data-site-theme="dark" by hand or just
// grepped the stylesheet for the media query text.
async function run(browser, scheme, theme) {
  fs.writeFileSync(INNER, fixture(theme), 'utf8');
  const port = 9500 + Math.floor(Math.random() * 400);
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hide-scrollbars', `--remote-debugging-port=${port}`, 'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  chrome.stderr.on('data', d => {stderr += d;});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    let wsUrl = '';
    for (let i = 0; i < 80 && !wsUrl; i += 1) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
      catch { await sleep(250); }
    }
    if (!wsUrl) throw new Error('devtools never came up\n' + stderr);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {ws.onopen = res; ws.onerror = rej;});
    let id = 0;
    const pending = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const {res, rej} = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, {res, rej});
      ws.send(JSON.stringify({id: n, method, params, ...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable');
    await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', {width: 390, height: 900, deviceScaleFactor: 1, mobile: true});
    // The whole point of this validator.
    await S('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
    await S('Page.navigate', {url: `${ORIGIN}/${INNER_REL}`});
    let payload = null;
    for (let i = 0; i < 200 && !payload; i += 1) {
      await sleep(250);
      const r = await S('Runtime.evaluate', {
        expression: `(() => { const n = document.getElementById('calendar-result'); return n && n.textContent !== 'pending' ? n.textContent : ''; })()`,
        returnByValue: true,
      });
      if (r.result.value) payload = r.result.value;
    }
    if (!payload) throw new Error('fixture never reported');
    const v = JSON.parse(payload);
    if (!v.ok) throw new Error(v.error);
    // Guard against the emulation silently not applying, which would make every
    // assertion below pass for the wrong reason.
    const applied = await S('Runtime.evaluate', {expression: `matchMedia('(prefers-color-scheme: dark)').matches`, returnByValue: true});
    v.osDark = applied.result.value;
    ws.close();
    return v;
  } finally {
    chrome.kill();
  }
}

const chan = v => /rgba?\(([^)]+)\)/.exec(v)[1].split(',').slice(0, 3).map(n => Number(n.trim()));
const lin = c => (c / 255 <= 0.04045 ? (c / 255) / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
const lum = v => { const [r, g, b] = chan(v); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

const browser = browserPath();
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const report = [];
try {
  waitServer();
  // The case the bug lived in: the preference nobody has touched, on a dark OS.
  for (const theme of ['system', 'dark']) {
    const v = await run(browser, 'dark', theme);
    assert.equal(v.osDark, true, 'the OS dark emulation did not apply -- every assertion below would pass for the wrong reason');
    assert.ok(v.rows.length >= 12, `expected the sweep to reach the surface, saw ${v.rows.length} text elements`);
    const mine = v.rows.filter(r => r.owner === 'calendar');
    for (const r of v.rows.filter(r => r.owner === 'ledger' && r.ratio < r.floor)) {
      console.warn(`  [⑭ 지출 영역 — 이 방이 고치지 않음] ${r.what} "${r.text}" ${r.ratio}:1 (기준 ${r.floor})`);
    }
    const misses = mine.filter(r => r.ratio < r.floor);
    assert.deepEqual(misses, [], `${theme} + OS 다크 기준 미달:\n` + misses.map(r => `  ${r.what} "${r.text}" ${r.ratio}:1 (기준 ${r.floor}) ink=${r.ink} bg=${r.bg}`).join('\n'));
    // The surfaces must actually be dark, or every ratio above is measured
    // against the wrong thing -- which is exactly how the original bug hid.
    assert.ok(v.surfaces.length >= 3, 'the surfaces to check were not all rendered');
    const stillLight = v.surfaces.filter(x => lum(x.bg) > 0.25);
    assert.deepEqual(stillLight, [], `${theme} + OS 다크인데 밝은 면이 남아 있습니다:\n` + stillLight.map(x => `  ${x.sel} bg=${x.bg}`).join('\n'));
    report.push(`${theme}:${mine.length}개 최저 ${Math.min(...mine.map(r => r.ratio))}:1`);
  }

  // And a light OS must be untouched by any of this.
  const light = await run(browser, 'light', 'system');
  assert.equal(light.osDark, false, 'the OS light emulation did not apply');
  const lightMine = light.rows.filter(r => r.owner === 'calendar');
  for (const r of light.rows.filter(r => r.owner === 'ledger' && r.ratio < r.floor)) {
    console.warn(`  [⑭ 지출 영역 — 이 방이 고치지 않음] ${r.what} "${r.text}" ${r.ratio}:1 (기준 ${r.floor})`);
  }
  const lightMisses = lightMine.filter(r => r.ratio < r.floor);
  assert.deepEqual(lightMisses, [], 'system + OS 라이트 기준 미달:\n' + lightMisses.map(r => `  ${r.what} "${r.text}" ${r.ratio}:1`).join('\n'));
  const darkened = light.surfaces.filter(x => lum(x.bg) < 0.5);
  assert.deepEqual(darkened, [], 'OS 라이트인데 어두워진 면이 있습니다:\n' + darkened.map(x => `  ${x.sel} bg=${x.bg}`).join('\n'));
  report.push(`light:${lightMine.length}개`);
  console.log('CALENDAR SYSTEM DARK PASS', report.join(' '));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
