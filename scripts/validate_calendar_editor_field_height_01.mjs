// Compact editor touch-target geometry, and one setting cannot erase another.
//
// Two things, both reported from a real screen.
//
// 1. Date and primary title remain aligned with the 44px floor; the time
//    control is now LOTBI-owned and hidden entirely for all-day entries.
//    Details open only on request; their controls and the time sheet keep the
//    same reachable touch-target floor in Light, Dark, and System.
// 2. Saving a display setting rewrote the stored object with one key, so any
//    other key in it was discarded. Nothing writes a second key yet, which is
//    the only reason it has not bitten.
//
// Measured in real Chromium where available; no Apple device is present here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-editor-height-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-editor-height-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4198;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// ---------------------------------------------------------------- settings --
// A merge, not a replace. Exercised directly: this is pure logic and deserves a
// real assertion rather than a DOM poke.
const {readCalendarDisplaySettings} = await import('../site-calendar-manager.js');

class MemoryStorage {
  constructor(value = null) { this.value = value; }
  getItem() { return this.value; }
  setItem(_key, value) { this.value = value; }
  removeItem() { this.value = null; }
}

{
  // A key this module does not own survives a write of the one it does.
  const storage = new MemoryStorage(JSON.stringify({showKoreaHolidays: true, weekStartsOn: 'MONDAY'}));
  const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
  assert.match(manager, /\.\.\.readStoredCalendarSettings\(storage\)/, 'a write must merge over what is stored');
  assert.doesNotMatch(
    manager,
    /JSON\.stringify\(\{\n\s*showKoreaHolidays: settings/,
    'a write must never replace the stored object with a single key',
  );
  assert.equal(readCalendarDisplaySettings(storage).showKoreaHolidays, true);
}
{
  // Defaults hold when there is nothing, when the blob is corrupt, when it is
  // the wrong shape, and when storage itself is unusable. A broken setting must
  // never cost the Calendar.
  assert.equal(readCalendarDisplaySettings(new MemoryStorage(null)).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings(new MemoryStorage('{broken')).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings(new MemoryStorage('[1,2,3]')).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings(new MemoryStorage('null')).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings(new MemoryStorage('"text"')).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings({}).showKoreaHolidays, true);
  assert.equal(readCalendarDisplaySettings(undefined).showKoreaHolidays, true);
  // An explicit false is still honoured -- the merge must not resurrect a default.
  assert.equal(readCalendarDisplaySettings(new MemoryStorage(JSON.stringify({showKoreaHolidays: false}))).showKoreaHolidays, false);
}

// ------------------------------------------------------------------- floors --
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
assert.match(css, /min-height: 44px; padding: 9px 10px/, 'the 44px touch-target floor stays');
assert.match(css, /\.calendar-editor-merchant \{ font-size: 16px; \}/, 'the 16px mobile font stays: it is what stops iOS zooming on focus');
assert.match(css, /\.calendar-editor-date::-webkit-date-and-time-value/, 'the iOS-only source of the extra height must be addressed directly');
assert.match(css, /\.calendar-editor-time-trigger/, 'custom LOTBI time control must retain touch targets');
assert.match(css, /\.calendar-editor-details/, 'optional controls must have a compact section');

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated" data-site-theme="light">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
try {
  localStorage.clear();
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', start_date: '2026-09-01', end_date: '2026-09-30', coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY', entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0, currencies: []});
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    return j({view: 'AGENDA', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-23T01:00:00Z'),
    locationProvider: null, locationPermissions: null,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');

  // Open the editor the way a user does.
  root.querySelector('[data-calendar-date-trigger="2026-09-24"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
  await sleep(500);
  root.querySelector('[data-calendar-add]')?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
  await wait(() => root.querySelector('.calendar-editor-date'), 'editor');
  await sleep(200);

  const read = () => {
    const pick = sel => {
      const n = root.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return {h: Math.round(r.height * 100) / 100, align: cs.textAlign, appearance: cs.appearance};
    };
    return {
      title: pick('.calendar-editor-title'),
      date: pick('.calendar-editor-date'),
      timeTrigger: pick('.calendar-editor-time-trigger'),
      endTimeTrigger: pick('.calendar-editor-end-time-trigger'),
      timeInput: pick('.calendar-editor-time'),
      amount: pick('.calendar-editor-amount'),
      place: pick('.calendar-editor-place'),
      merchant: pick('.calendar-editor-merchant'),
      detailsSummary: pick('.calendar-editor-details summary'),
    };
  };

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  // The date carries a value and the time is empty: the reported screen had one
  // of each, and an empty picker must not measure differently.
  result.dateValue = root.querySelector('.calendar-editor-date')?.value || '';
  result.timeValue = root.querySelector('.calendar-editor-time')?.value ?? '(missing)';
  result.collapsed = {details: !root.querySelector('.calendar-editor-details').open,
    time: root.querySelector('.calendar-editor-time-control').hidden};
  root.querySelector('.calendar-editor-all-day input').click();
  root.querySelector('.calendar-editor-details summary').click();
  root.querySelector('.calendar-editor-time-trigger').click();
  result.light = read();
  result.timeType = root.querySelector('.calendar-editor-time').type;
  document.body.dataset.siteTheme = 'dark';
  await sleep(140);
  result.dark = read();
  document.body.dataset.siteTheme = 'system';
  await sleep(140);
  result.system = read();

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

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
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
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}`);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const results = [[360, 780], [1280, 860]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    if (!v.dateValue) throw new Error(`${where}: the date field should carry the selected day`);
    if (v.timeValue !== '') throw new Error(`${where}: the time field should be the empty one, got ${v.timeValue}`);
    if (!v.collapsed.details || !v.collapsed.time) throw new Error(`${where}: optional controls must be collapsed and all-day time hidden`);
    if (v.timeType !== 'text') throw new Error(`${where}: time must be keyboard-safe text, not the native picker`);
    for (const [theme, t] of [['light', v.light], ['dark', v.dark], ['system', v.system]]) {
      const named = Object.entries(t).filter(([, value]) => value);
      if (named.length < 5) throw new Error(`${where} ${theme}: expected the whole form, found ${named.length} fields`);
      for (const [name, value] of named) {
        if (value.h < 44) throw new Error(`${where} ${theme}: ${name} fell below the 44px touch target floor (${value.h})`);
      }
      if (Math.abs(t.date.h - t.title.h) > 0.5) {
        throw new Error(`${where} ${theme}: primary title/date heights diverged (${t.title.h}, ${t.date.h})`);
      }
      for (const [name, value] of named) {
        if (value.align !== 'left' && value.align !== 'start') {
          throw new Error(`${where} ${theme}: ${name} is ${value.align}-aligned; the form reads left`);
        }
      }
      if (t.date.appearance !== 'none') {
        throw new Error(`${where} ${theme}: the date picker must drop its native metrics`);
      }
    }
  }
  console.log('CALENDAR EDITOR FIELD HEIGHT PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
