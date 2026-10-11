// FESTIVAL-CALENDAR-SHEET-PC-01 (QA_화면전수_01 H4/N2) — [일정 등록] on a
// desktop width must open where it was pressed and actually register.
//
// The bug: the shared sheet primitive's INLINE (desktop) presentation has no
// positioning, and the card's [일정 등록] opened it with the primitive's
// default host, document.body. On the real page the body does not scroll, so
// the picker landed after everything else, below the screen (QA measured
// y=900 on a 900px screen) and a desktop press looked like it did nothing.
//
// Real headless-Chromium render of the actual site-festival-ui.js with a
// Core-shaped mocked fetch (same convention as
// validate_festival_event_08_responsive_a11y_01.mjs): a local http.server +
// `--dump-dom`, the page inside an iframe of the measured size, and a body
// that does not scroll with a scrolling main column, as on lotbiai.com.
// Every control is checked with elementFromPoint before it is pressed, so a
// picker that exists but is off screen or covered fails here.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for FESTIVAL-CALENDAR-SHEET-PC-01 render validation.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolve(port));
    });
  });
}

// 2026-10-08 is a Thursday; the festival runs 10-08..10-10.
function innerHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<link rel="stylesheet" href="/site-festival.css" />
<link rel="stylesheet" href="/site-consumer-detail.css" />
<style>
html, body { margin: 0; height: 100%; }
body { overflow: hidden; }
#scroller { height: 100%; overflow: auto; }
/* A tall page head pushes the card's actions near the bottom of the first
   screen, where the old picker would have had no room either. */
#lead { height: 55vh; }
#render-result { position: absolute; left: -99999px; top: 0; visibility: hidden; }
</style>
</head><body class="chat-home-page"><main id="scroller"><div id="lead"></div><div id="host"></div></main><pre id="render-result"></pre>
<script type="module">
const out = document.getElementById('render-result');
const fail = reason => { out.textContent = JSON.stringify({error: String(reason?.stack || reason)}); };
window.addEventListener('error', event => fail(event.error || event.message));
window.addEventListener('unhandledrejection', event => fail(event.reason));
try { localStorage.clear(); } catch {}

const festival = {
  festival_id: 'fest_demo', name: '가을 억새 축제', start_date: '2026-10-08', end_date: '2026-10-10',
  region_name: '서울특별시', address: '서울특별시 마포구 하늘공원로 95', latitude: 37.568, longitude: 126.885,
  homepage_url: 'https://official.example.com/festival', telephone: '02-000-0000', status: 'PUBLISHED',
  programs: [], transport: {}, notices: [], distance_km: null,
};
const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
window.fetch = async url => {
  const target = String(url);
  if (target.includes('/municipalities')) return json({municipalities: []});
  if (target.includes('/festivals/regions')) return json({regions: [{region_name: '서울특별시'}]});
  if (target.includes('/festivals/browse')) return json({festivals: [festival], result_count: 1, total_count: 1, limit: 20, offset: 0, next_offset: null, has_more: false});
  if (/\\/festivals\\/fest_demo$/.test(target)) return json({festival});
  if (target.includes('/festivals')) return json({festivals: [festival], result_count: 1});
  return new Response('{}', {status: 404, headers: {'Content-Type': 'application/json'}});
};
// --dump-dom has no rendered frames for a real IntersectionObserver.
window.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { setTimeout(() => this.callback([{target, isIntersecting: true}], this), 0); }
  unobserve() {}
  disconnect() {}
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (fn, label) => {
  for (let i = 0; i < 100; i += 1) { const value = fn(); if (value) return value; await wait(40); }
  throw new Error('timeout: ' + label);
};
// Pressable means: on screen, and the topmost thing at its centre.
const reach = node => {
  if (!node) return {present: false};
  const r = node.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {present: true, top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height),
    onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    hit: Boolean(hit && (hit === node || node.contains(hit))),
    hitName: hit ? (hit.tagName + '.' + String(hit.className || '')).slice(0, 60) : 'none'};
};

const {mountFestivalManager} = await import('/site-festival-ui.js');
const host = document.getElementById('host');
await mountFestivalManager({root: host, now: new Date('2026-10-08T02:00:00Z'), fetchImpl: window.fetch});
const trigger = await until(() => host.querySelector('.festival-card .festival-calendar-add-trigger'), 'card 일정 등록');
const card = trigger.closest('.festival-card');
const row = trigger.closest('.festival-card-action-row');
const mapButton = () => row.querySelector('.festival-card-map');

const result = {viewport: {width: innerWidth, height: innerHeight}};
result.triggerBefore = reach(trigger);
trigger.click();
const sheet = await until(() => document.querySelector('.lotbi-sheet'), 'picker opened');
await wait(120);
const firstDay = () => document.querySelector('.lotbi-sheet .festival-schedule-date-cell:not([disabled])');
result.opened = {
  presentation: sheet.dataset.presentation,
  parentClass: String(sheet.parentElement?.className || sheet.parentElement?.tagName || ''),
  insideCard: Boolean(card.contains(sheet)),
  afterActionRow: sheet.parentElement?.previousElementSibling === row,
  directChildOfBody: sheet.parentElement === document.body,
  position: getComputedStyle(sheet).position,
  width: Math.round(sheet.getBoundingClientRect().width),
  expanded: trigger.getAttribute('aria-expanded'),
  day: reach(firstDay()),
  close: reach(document.querySelector('.lotbi-sheet .lotbi-sheet-dismiss')),
  mapInRow: Boolean(mapButton() && row.contains(mapButton())),
  mapTopEqualsTrigger: Math.abs(mapButton().getBoundingClientRect().top - trigger.getBoundingClientRect().top) < 1,
};

if (sheet.dataset.presentation === 'INLINE') {
  // A second press closes the picker instead of stacking another one.
  trigger.click();
  await wait(80);
  result.toggled = {
    sheets: document.querySelectorAll('.lotbi-sheet').length,
    anchors: document.querySelectorAll('.festival-calendar-add-desktop-anchor').length,
    expanded: trigger.getAttribute('aria-expanded'),
  };
  trigger.click();
  await until(() => document.querySelector('.lotbi-sheet'), 'picker reopened');
  await wait(80);
}

const day = firstDay();
result.pickedDay = day.textContent;
result.dayReachableWhenPressed = reach(day).hit;
day.click();
const confirm = document.querySelector('.lotbi-sheet .festival-schedule-confirm');
result.confirm = reach(confirm);
result.confirmEnabled = !confirm.disabled;
confirm.click();
await until(() => !document.querySelector('.lotbi-sheet'), 'picker closed after 등록');
await wait(80);
const feedback = card.querySelector('.festival-calendar-add-feedback');
const stored = (() => { try { return JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1') || '{}').events || []; } catch { return []; } })();
result.after = {
  feedback: feedback && !feedback.hidden ? feedback.textContent : '',
  anchors: document.querySelectorAll('.festival-calendar-add-desktop-anchor').length,
  stored: stored.map(event => event.title + '@' + (event.local_date || String(event.local_datetime || '').slice(0, 10))),
  mapTopEqualsTrigger: Math.abs(mapButton().getBoundingClientRect().top - trigger.getBoundingClientRect().top) < 1,
};
out.textContent = JSON.stringify(result);
</script></body></html>`;
}

function outerHtml(innerName, width, height) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="fixture-frame" title="FESTIVAL-CALENDAR-SHEET-PC-01 viewport" src="/${innerName}" style="display:block;width:${width}px;height:${height}px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const out = document.getElementById('render-result');
const deadline = Date.now() + 15000;
const poll = () => {
  const doc = frame.contentDocument;
  const raw = doc && doc.getElementById('render-result') ? doc.getElementById('render-result').textContent : '';
  if (raw && raw.trim()) { out.textContent = raw; return; }
  if (Date.now() > deadline) { out.textContent = JSON.stringify({error: 'inner fixture never rendered'}); return; }
  setTimeout(poll, 100);
};
poll();
</script></body></html>`;
}

async function render(width, height) {
  const port = await freePort();
  const innerName = `.festival-calendar-add-pc-inner-${process.pid}-${width}.html`;
  const outerName = `.festival-calendar-add-pc-outer-${process.pid}-${width}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerHtml(), 'utf8');
  fs.writeFileSync(path.join(ROOT, outerName), outerHtml(innerName, width, height), 'utf8');
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/${outerName}`);
        if (probe.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const run = spawnSync(browserPath(), [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--window-size=1600,1100', '--virtual-time-budget=10000', '--dump-dom',
      `http://127.0.0.1:${port}/${outerName}`,
    ], {encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024});
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
    const match = run.stdout.match(/<pre id="render-result">([^<]*)<\/pre>/);
    if (!match || !match[1].trim()) throw new Error(`no render result at ${width}x${height}`);
    const parsed = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    if (parsed.error) throw new Error(`render failed at ${width}x${height}: ${parsed.error}`);
    return parsed;
  } finally {
    server.kill();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    fs.rmSync(path.join(ROOT, outerName), {force: true});
  }
}

const summary = [];
for (const [width, height] of [[1280, 900], [1024, 768], [390, 844]]) {
  const v = await render(width, height);
  const where = `${width}x${height}`;
  const desktop = width > 900;
  assert.equal(v.opened.presentation, desktop ? 'INLINE' : 'SHEET', `${where}: presentation`);
  if (desktop) {
    assert.equal(v.opened.directChildOfBody, false, `${where}: the desktop picker must not be appended to <body> (the H4 bug)`);
    assert.equal(v.opened.insideCard, true, `${where}: the desktop picker must open inside the pressed card`);
    assert.equal(v.opened.afterActionRow, true, `${where}: the desktop picker must sit under the whole action row, not between its buttons`);
    assert.equal(v.opened.parentClass, 'festival-calendar-add-desktop-anchor', `${where}: picker host`);
    assert.ok(v.opened.width <= 420, `${where}: the desktop picker stays a compact month (≤420px), got ${v.opened.width}px`);
    assert.equal(v.opened.expanded, 'true', `${where}: [일정 등록] must say it is expanded`);
    assert.equal(v.opened.mapInRow && v.opened.mapTopEqualsTrigger, true, `${where}: 지도 button stays in the action row beside [일정 등록]`);
    assert.deepEqual(v.toggled, {sheets: 0, anchors: 0, expanded: 'false'}, `${where}: a second press closes the picker`);
  } else {
    assert.equal(v.opened.directChildOfBody, true, `${where}: the phone keeps its overlay sheet on <body>`);
    assert.equal(v.opened.position, 'fixed', `${where}: the phone sheet is a fixed overlay`);
  }
  assert.equal(v.opened.day.onScreen && v.opened.day.hit, true, `${where}: the first open day must be on screen and pressable, got ${JSON.stringify(v.opened.day)}`);
  assert.ok(v.opened.day.height >= 48 && v.opened.day.width >= 48, `${where}: a day is at least 48px, got ${v.opened.day.width}x${v.opened.day.height}`);
  assert.equal(v.opened.close.onScreen && v.opened.close.hit, true, `${where}: 닫기 must be on screen and pressable, got ${JSON.stringify(v.opened.close)}`);
  assert.equal(v.dayReachableWhenPressed, true, `${where}: the picked day was pressable when pressed`);
  assert.equal(v.confirmEnabled, true, `${where}: 등록 is enabled once a day is picked`);
  assert.equal(v.confirm.onScreen && v.confirm.hit, true, `${where}: 등록 must be on screen and pressable, got ${JSON.stringify(v.confirm)}`);
  assert.equal(v.after.feedback, '일정을 등록했어요.', `${where}: the card says it was registered`);
  assert.deepEqual(v.after.stored, [`가을 억새 축제@2026-10-0${v.pickedDay}`], `${where}: exactly the picked day is in the Calendar`);
  assert.equal(v.after.anchors, 0, `${where}: no empty picker host is left behind`);
  assert.equal(v.after.mapTopEqualsTrigger, true, `${where}: the 지도 button stays level with [일정 등록] under the saved message`);
  summary.push({where, presentation: v.opened.presentation, day: `${v.opened.day.width}x${v.opened.day.height}`, dayTop: v.opened.day.top, stored: v.after.stored[0]});
}
console.log('FESTIVAL CALENDAR SHEET PC 01 PASS', JSON.stringify(summary));
