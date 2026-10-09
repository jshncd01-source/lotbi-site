// 기록 추가 하단 버튼 — 취소가 보이고, 저장은 제목을 쓴 뒤에만 눌린다.
//
// iPhone 카카오톡 인앱 브라우저(기기 설정 = 다크)에서 '기록 추가' 시트의 취소
// 버튼이 흰 배경(#fff)에 다크 테마 글자색(#f5f5f5)으로 그려져 대비 1.09:1,
// 사실상 안 보였다. 하단 버튼에만 다크 규칙이 없었다. 저장 버튼은 다크에서
// 면이 시트 배경과 1.06:1로 구분되지 않았고, 제목이 비어도 눌렸다.
//
// 이 검증기는 실제 index.html 의 스타일시트 전부를 같은 순서로 불러,
//   - 라이트 / 직접 고른 다크 / 기기 설정(system) 다크에서 취소·저장 대비,
//   - 모바일 키보드가 열린 상태(가짜 visualViewport, 레이아웃 축소)에서
//     두 버튼이 보이는 영역 안에 있고 실제 탭이 그 버튼에 닿는지,
//   - 취소는 늘 눌리고 아무것도 저장하지 않는지, 저장은 제목 전에는 꺼져
//     있고 제목 뒤에는 고른 날짜로 저장되는지
// 를 CDP 로 브라우저를 직접 몰아 확인한다. --dump-dom 으로는
// prefers-color-scheme 을 바꿀 수 없다. 에뮬레이션이며 실기기 확인은 아니다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generate, BEGIN, END} from './generate_calendar_system_dark.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-footer-contrast-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const PORT = 4262;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GUEST_KEY = 'lotbi.guest.calendar.v1';
const KEYBOARD = 336;

// --- 1. source contract --------------------------------------------------------
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8').replace(/\r\n/g, '\n');
assert.match(manager, /const refreshSave = \(\) => \{ save\.disabled = saveInFlight \|\| !titleInput\.value\.trim\(\); \};/,
  '저장 is enabled only by a non-blank title and never during a save in flight');
assert.match(manager, /titleInput\.addEventListener\('input', refreshSave\);\n\s*refreshSave\(\);/,
  'the title input drives 저장 from the moment the editor opens');
assert.match(manager, /cancel\.addEventListener\('click', close\);/, '취소 keeps closing the editor exactly as before');
assert.doesNotMatch(manager, /cancel\.disabled/, '취소 is never disabled');
assert.match(manager, /if \(!titleInput\.value\.trim\(\)\) \{\n\s*error\.textContent = '무엇을 남길지 한 단어라도 적어 주세요\.';/,
  'the submit handler still refuses a blank title on its own');
assert.match(css, /\.calendar-editor-save:disabled \{ cursor: not-allowed; opacity: \.45; \}/, 'a disabled 저장 reads as disabled');
assert.match(css, /body\[data-site-theme="dark"\] \.calendar-editor-actions button \{ border-color: #7d8796; background: #121720;/,
  'the footer buttons have a dark fill in the dark theme');
assert.match(css, /body\[data-site-theme="dark"\] \.calendar-editor-save \{ border-color: #edf0f5 !important; background: #edf0f5 !important; color: #212121 !important; \}/,
  'the dark 저장 is emphasised the way the photo confirm 저장 already is');
{
  const start = css.indexOf(BEGIN);
  const end = css.indexOf(END);
  assert.ok(start !== -1 && end !== -1, 'the system-dark mirror block is missing');
  assert.equal(css.slice(start, end + END.length).trim(), generate(css).trim(),
    'the system-dark mirror is stale -- run: node scripts/generate_calendar_system_dark.mjs');
  assert.match(generate(css), /body\[data-site-theme="system"\] \.calendar-editor-actions button,/, 'system dark reaches the footer buttons');
}

// --- 2. browser ----------------------------------------------------------------
function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The real page's cascade, in the real order: the footer is styled by more than
// site-calendar.css, and a fixture with fewer sheets measured a different sheet.
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sheets = [...index.matchAll(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
assert.ok(sheets.includes('site-calendar.css') && sheets.includes('site-consumer-detail.css'), 'index.html stylesheet list not found');

const fixture = theme => `<!doctype html><html lang="ko" data-site-theme-bootstrap="${theme}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${sheets.map(href => `<link rel="stylesheet" href="/${href}">`).join('\n')}
</head><body class="chat-home-page" data-site-auth-state="unauthenticated" data-site-theme="${theme}">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
try {
  localStorage.clear();
  const j = x => Promise.resolve(new Response(JSON.stringify(x), {status: 200, headers: {'Content-Type': 'application/json'}}));
  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({root, sessionToken: '', timezone: 'Asia/Seoul', now: () => new Date('2026-09-24T00:00:00Z'),
    settingsStorage: {getItem: () => JSON.stringify({showKoreaHolidays: false}), setItem() {}},
    locationProvider: null, locationPermissions: null, fetchImpl: () => j({items: []})});
  out.textContent = 'ready';
} catch (e) { out.textContent = 'error ' + String(e?.stack || e); }
</script></body></html>`;

// A keyboard as iOS reports it: the layout viewport stays, the visual one shrinks.
const FAKE_VISUAL_VIEWPORT = `(() => {
  const target = new EventTarget(); let keyboard = 0;
  const fake = {get width() { return innerWidth; }, get height() { return innerHeight - keyboard; }, get offsetTop() { return 0; },
    get offsetLeft() { return 0; }, get pageTop() { return scrollY; }, get pageLeft() { return scrollX; }, get scale() { return 1; },
    onresize: null, onscroll: null, addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target)};
  Object.defineProperty(window, 'visualViewport', {configurable: true, get() { return fake; }});
  window.__keyboard = height => { keyboard = height; target.dispatchEvent(new Event('resize')); };
})();`;

const MEASURE = `(() => {
  const parse = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); const p = m ? m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number) : [0, 0, 0, 0]; return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, under) => { const a = top[3] + under[3] * (1 - top[3]); return a ? [0, 1, 2].map(i => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
  const background = el => { const layers = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; } return layers.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255, 1]); };
  const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const probe = sel => {
    const el = document.querySelector(sel); if (!el) return null;
    const cs = getComputedStyle(el); const sheet = background(el.closest('.calendar-editor-dialog'));
    const bg = background(el); const ink = over(parse(cs.color), bg); const border = over(parse(cs.borderTopColor), sheet);
    const r = el.getBoundingClientRect(); const vv = visualViewport;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {disabled: el.disabled, opacity: Number(cs.opacity), text: ratio(ink, bg), border: ratio(border, sheet),
      fillLuminance: lum(bg), inkLuminance: lum(ink), x: r.left + r.width / 2, y: r.top + r.height / 2,
      inside: r.top >= vv.offsetTop - 0.5 && r.bottom <= vv.offsetTop + vv.height + 0.5, hit: Boolean(hit && (hit === el || el.contains(hit)))};
  };
  let stored = []; try { stored = (JSON.parse(localStorage.getItem('${GUEST_KEY}') || '{}').events || []).map(e => e.title + '@' + e.local_date); } catch {}
  return {open: Boolean(document.querySelector('.calendar-editor-dialog')), heading: document.querySelector('#calendar-editor-heading')?.textContent || '',
    cancel: probe('.calendar-editor-cancel'), save: probe('.calendar-editor-save'), stored,
    error: document.querySelector('.calendar-editor-error')?.textContent || '', osDark: matchMedia('(prefers-color-scheme: dark)').matches};
})()`;

async function run(browser, c) {
  fs.writeFileSync(INNER, fixture(c.theme), 'utf8');
  const port = 9500 + Math.floor(Math.random() * 400);
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  chrome.stderr.on('data', d => { stderr += d; });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    let wsUrl = '';
    for (let i = 0; i < 80 && !wsUrl; i += 1) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
      catch { await sleep(250); }
    }
    if (!wsUrl) throw new Error('devtools never came up\n' + stderr);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const {res, rej} = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    };
    const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const n = ++id; pending.set(n, {res, rej}); ws.send(JSON.stringify({id: n, method, params, ...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
    const S = (m, p) => send(m, p, sessionId);
    const ev = async expression => {
      const r = await S('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const until = async (expression, label) => {
      for (let i = 0; i < 200; i += 1) { if (await ev(expression)) return; await sleep(50); }
      throw new Error(`timeout: ${label}`);
    };
    const metrics = height => S('Emulation.setDeviceMetricsOverride', {width: c.width, height, deviceScaleFactor: 1, mobile: c.mobile});
    await S('Page.enable');
    await S('Runtime.enable');
    await metrics(c.height);
    if (c.mobile) await S('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await S('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: c.scheme}]});
    if (c.keyboard === 'visual') await S('Page.addScriptToEvaluateOnNewDocument', {source: FAKE_VISUAL_VIEWPORT});
    await S('Page.navigate', {url: `${ORIGIN}/${INNER_REL}`});
    await until(`(document.getElementById('calendar-result')?.textContent || 'pending') !== 'pending'`, 'fixture');
    const status = await ev(`document.getElementById('calendar-result').textContent`);
    if (status !== 'ready') throw new Error(status);

    // A real tap (touch on a phone, mouse on a desk) at a point we measured.
    const tap = async ({x, y}) => {
      if (c.mobile) {
        await S('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]});
        await sleep(40);
        await S('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1});
      }
      await sleep(200);
    };
    const keyboard = async open => {
      if (c.keyboard === 'visual') await ev(`window.__keyboard(${open ? KEYBOARD : 0})`);
      if (c.keyboard === 'layout') await metrics(open ? c.height - KEYBOARD : c.height);
      await sleep(200);
    };
    const openEditor = async () => {
      await ev(`(() => { if (document.querySelector('[data-calendar-add]')) return; document.querySelector('[data-calendar-date-trigger="2026-09-24"]').click(); })()`);
      await until(`Boolean(document.querySelector('[data-calendar-add]'))`, 'day panel');
      await ev(`document.querySelector('[data-calendar-add]').click()`);
      await until(`Boolean(document.querySelector('.calendar-editor-dialog'))`, 'editor');
      await sleep(150);
      await keyboard(true);
    };
    const type = async text => { await S('Input.insertText', {text}); await sleep(120); };
    const selectTitle = () => ev(`document.querySelector('.calendar-editor-title').select()`);

    const states = {};
    await openEditor();
    states.empty = await ev(MEASURE);
    await type('피부과');
    states.typed = await ev(MEASURE);
    await selectTitle();
    await type('   ');
    states.blank = await ev(MEASURE);
    await tap(states.blank.save);
    states.blankSaveTapped = await ev(MEASURE);
    await tap(states.blank.cancel);
    states.cancelled = await ev(MEASURE);
    await keyboard(false);
    await openEditor();
    await type('취소할 기록');
    states.typedAgain = await ev(MEASURE);
    await tap(states.typedAgain.cancel);
    states.cancelledTyped = await ev(MEASURE);
    await keyboard(false);
    await openEditor();
    await type('저장할 기록');
    states.ready = await ev(MEASURE);
    await tap(states.ready.save);
    await sleep(300);
    states.saved = await ev(MEASURE);
    ws.close();
    return states;
  } finally {
    chrome.kill();
  }
}

const MOBILE = {width: 390, height: 844, mobile: true};
const DESK = {width: 1280, height: 860, mobile: false};
const CASES = [
  {name: 'phone, light', theme: 'light', scheme: 'light', keyboard: 'none', ...MOBILE},
  {name: 'phone, light, keyboard (iOS)', theme: 'light', scheme: 'light', keyboard: 'visual', ...MOBILE},
  {name: 'phone, chosen dark', theme: 'dark', scheme: 'light', keyboard: 'none', ...MOBILE},
  {name: 'phone, device dark (the report)', theme: 'system', scheme: 'dark', keyboard: 'none', ...MOBILE},
  {name: 'phone, device dark, keyboard (iOS)', theme: 'system', scheme: 'dark', keyboard: 'visual', ...MOBILE},
  {name: 'phone, device dark, keyboard (Android resize)', theme: 'system', scheme: 'dark', keyboard: 'layout', ...MOBILE},
  {name: 'desk, device light', theme: 'system', scheme: 'light', keyboard: 'none', ...DESK},
  {name: 'desk, chosen dark', theme: 'dark', scheme: 'light', keyboard: 'none', ...DESK},
];

const browser = browserPath();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const report = [];
try {
  for (let i = 0; i < 60; i += 1) {
    if (spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000}).status === 0) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  for (const c of CASES) {
    const s = await run(browser, c);
    const where = c.name;
    const dark = c.theme === 'dark' || (c.theme === 'system' && c.scheme === 'dark');
    assert.equal(s.empty.osDark, c.scheme === 'dark', `${where}: prefers-color-scheme emulation did not apply`);
    assert.equal(s.empty.heading, '기록 추가', `${where}: expected the 기록 추가 editor`);
    for (const [state, v] of [['empty', s.empty], ['typed', s.typed], ['blank', s.blank], ['typed again', s.typedAgain], ['ready', s.ready]]) {
      const label = `${where} (${state})`;
      assert.equal(v.cancel.disabled, false, `${label}: 취소 must always be enabled`);
      assert.ok(v.cancel.text >= 4.5, `${label}: 취소 text contrast ${v.cancel.text.toFixed(2)} < 4.5`);
      assert.ok(v.cancel.border >= 3, `${label}: 취소 border against the sheet ${v.cancel.border.toFixed(2)} < 3`);
      assert.ok(v.cancel.inside && v.cancel.hit, `${label}: 취소 must be visible above the keyboard and take the tap`);
      assert.ok(v.save.inside && v.save.hit, `${label}: 저장 must be visible above the keyboard and take the tap`);
      if (dark) {
        assert.ok(v.cancel.fillLuminance < 0.05, `${label}: 취소 needs a dark fill in the dark theme`);
        assert.ok(v.cancel.inkLuminance > 0.8, `${label}: 취소 needs light ink in the dark theme`);
      }
    }
    assert.equal(s.empty.save.disabled, true, `${where}: 저장 must wait for a title`);
    assert.ok(s.empty.save.opacity < 1, `${where}: a disabled 저장 must look disabled`);
    assert.equal(s.typed.save.disabled, false, `${where}: a title enables 저장`);
    assert.equal(s.typed.save.opacity, 1, `${where}: an enabled 저장 keeps its full emphasis`);
    assert.ok(s.typed.save.text >= 4.5, `${where}: 저장 text contrast ${s.typed.save.text.toFixed(2)} < 4.5`);
    assert.ok(s.typed.save.border >= 3, `${where}: the emphasised 저장 must stand out from the sheet (${s.typed.save.border.toFixed(2)})`);
    assert.equal(s.blank.save.disabled, true, `${where}: spaces are not a title`);
    assert.ok(s.blankSaveTapped.open && !s.blankSaveTapped.stored.length, `${where}: tapping a disabled 저장 saves nothing`);
    assert.ok(!s.cancelled.open && !s.cancelled.stored.length, `${where}: 취소 on a blank title closes and saves nothing`);
    assert.ok(!s.cancelledTyped.open && !s.cancelledTyped.stored.length, `${where}: 취소 with a title closes and saves nothing`);
    assert.ok(!s.saved.open, `${where}: 저장 closes the editor`);
    assert.deepEqual(s.saved.stored, ['저장할 기록@2026-09-24'], `${where}: 저장 stores the record on the chosen day`);
    report.push(`${where}: 취소 ${s.empty.cancel.text.toFixed(2)}:1 border ${s.empty.cancel.border.toFixed(2)}:1, 저장 ${s.typed.save.text.toFixed(2)}:1`);
  }
  console.log('CALENDAR EDITOR FOOTER CONTRAST PASS');
  for (const line of report) console.log('  ' + line);
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
}
