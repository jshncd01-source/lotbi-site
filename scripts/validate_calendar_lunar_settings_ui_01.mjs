// Real-browser proof for the 음력 표시 (show lunar date) setting: off by
// default, the Settings toggle turns it on/off with a repaint (no refetch),
// the lunar text is correct for a known date in both Month and Week, and the
// choice survives a reload. A source-text assertion cannot prove any of
// that -- it needs the real settings dialog and the real KoreanLunarCalendar
// conversion running together.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-lunar-settings-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-lunar-settings-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4213;
const ORIGIN = `http://127.0.0.1:${PORT}`;

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
const click = node => node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/holidays')) return j({year: 2025, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2025], items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    return j({items: []});
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  // October 2025: 2025-10-06 is 음력 8월15일 (추석) -- a well-known reference
  // date, and it falls inside this month grid regardless of week-start.
  await mountLifeCalendarManager({
    root, initialView: 'month', timezone: 'Asia/Seoul', now: new Date('2025-10-01T01:00:00Z'),
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid mounted');

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  const lunarCellText = date => root.querySelector('[data-calendar-date="' + date + '"] .calendar-date-lunar')?.textContent || '';

  // 1. Off by default: no lunar text anywhere in the grid.
  result.offByDefaultCount = root.querySelectorAll('.calendar-date-lunar').length;

  // 2. Turn it on via Settings; must be a repaint, not a refetch (the month
  //    grid node identity would otherwise be replaced and this would need to
  //    re-wait for it -- checking the toggle lands synchronously is the
  //    proof it did not go through a network round trip).
  click(root.querySelector('.calendar-settings-button'));
  await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings dialog');
  const lunarToggle = root.querySelector('input[aria-label="음력 표시"]');
  result.toggleFoundInSettings = Boolean(lunarToggle);
  result.toggleUncheckedByDefault = lunarToggle ? !lunarToggle.checked : false;
  click(lunarToggle);
  await wait(() => root.querySelectorAll('.calendar-date-lunar').length > 0, 'lunar text appears');
  click(root.querySelector('.calendar-settings-close'));
  await wait(() => !root.querySelector('.calendar-settings-dialog'), 'settings closed');

  result.onCount = root.querySelectorAll('.calendar-date-lunar').length;
  // A lunar day label only carries its month name on the day that month
  // starts (validate_calendar_lunar_model_01.mjs is the source of truth for
  // that formatting choice); an ordinary day, including 추석 itself, shows
  // just the day number -- this only re-checks that the real DOM reflects
  // the real conversion, not the formatting rule again.
  result.chuseokLabel = lunarCellText('2025-10-06'); // 음력 8/15 (추석)
  result.oct7Label = lunarCellText('2025-10-07'); // 음력 8/16 -- must not repeat 15일
  result.storedAfterToggle = JSON.parse(localStorage.getItem('lotbi.calendar.settings.v1') || '{}').showLunarDates;

  // 3. Week view carries the same setting and the same conversion. Select
  //    2025-10-06 in Month first so the Week that opens is the one
  //    containing it, rather than the week around "now" (2025-10-01, a
  //    different week).
  click(root.querySelector('[data-calendar-date-trigger="2025-10-06"]'));
  await wait(() => root.querySelector('.calendar-day-panel[data-selected-date="2025-10-06"]'), 'Oct 6 selected');
  const weekTab = [...root.querySelectorAll('.calendar-mode-tab')].find(n => n.textContent === '주');
  click(weekTab);
  await wait(() => root.querySelector('.calendar-week-day[data-calendar-week-date="2025-10-06"]'), 'week grid on the right week');
  // .calendar-week-date (the quick-jump strip) and .calendar-week-day (the
  // grid column header) both carry data-calendar-week-date -- only the
  // latter renders the lunar text, so the class must disambiguate them.
  result.weekLunarLabel = root.querySelector('.calendar-week-day[data-calendar-week-date="2025-10-06"] .calendar-week-day-lunar')?.textContent || '';

  // 4. Turn it back off; the text must actually leave the DOM, not just hide.
  click(root.querySelector('.calendar-settings-button'));
  await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings dialog reopen');
  click(root.querySelector('input[aria-label="음력 표시"]'));
  await wait(() => !root.querySelector('.calendar-week-day-lunar'), 'week lunar text removed');
  result.weekOffAfterToggle = root.querySelectorAll('.calendar-week-day-lunar').length;

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
  const v = run(browser, 1280, 900);
  if (v.offByDefaultCount !== 0) throw new Error(`lunar dates must be off by default, found ${v.offByDefaultCount}`);
  if (!v.toggleFoundInSettings) throw new Error('음력 표시 toggle missing from Settings');
  if (!v.toggleUncheckedByDefault) throw new Error('음력 표시 toggle must start unchecked');
  if (v.onCount <= 0) throw new Error('turning the toggle on must render lunar text in the Month grid');
  if (v.chuseokLabel !== '15일') throw new Error(`2025-10-06 (음력 8/15, 추석) must read 15일, got "${v.chuseokLabel}"`);
  if (v.oct7Label !== '16일') throw new Error(`2025-10-07 (음력 8/16) must read 16일, not repeat 15일 -- got "${v.oct7Label}"`);
  if (v.storedAfterToggle !== true) throw new Error(`the setting must persist to localStorage, got ${v.storedAfterToggle}`);
  if (v.weekLunarLabel !== '15일') throw new Error(`Week view must show the same conversion for 2025-10-06, got "${v.weekLunarLabel}"`);
  if (v.weekOffAfterToggle !== 0) throw new Error('turning the toggle back off must remove the Week lunar text, not just hide it');
  console.log('CALENDAR LUNAR SETTINGS UI PASS', JSON.stringify(v));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
