// Weather location must stop announcing itself once it is settled.
//
// The Calendar's job is the user's schedule. Location is an accessory of an
// accessory (it only feeds the weather decoration), so after the browser has
// granted it there is nothing left to say: the row above the date grid is gone,
// the durable state and both controls live in Settings, and a change is
// announced once, as a toast that reserves no layout.
//
// This renders the real Calendar in a real browser and asserts that.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-quiet-location-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-quiet-location-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4193;
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
</head><body class="chat-home-page" data-site-auth-state="authenticated">
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

  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', ai_calls: 0, provider_api_calls: 0, currency: 'KRW', total_minor: 0, categories: []});
    return j({view: 'AGENDA', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
  };

  // A browser that has already been granted the permission — the exact state the
  // user complained about seeing announced on every open.
  let mode = 'granted';
  const permissions = {query: async () => ({state: mode === 'denied' ? 'denied' : 'granted'})};
  const geolocation = {
    getCurrentPosition(onOk, onErr) {
      if (mode === 'denied') { onErr({code: 1, PERMISSION_DENIED: 1, message: 'denied'}); return; }
      onOk({coords: {latitude: 37.5665, longitude: 126.978, accuracy: 40}, timestamp: Date.now()});
    },
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-23T01:00:00Z'),
    locationProvider: geolocation, locationPermissions: permissions,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');
  await wait(() => root.dataset.locationPermission === 'GRANTED', 'permission sync');

  const shell = root.querySelector('.calendar-product-shell');
  const statusRow = root.querySelector('.calendar-status');
  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};

  // 1. Nothing about location is drawn above the date grid.
  result.statusEmpty = statusRow.childElementCount === 0;
  result.noLocationAboveGrid = !statusRow.querySelector('[data-calendar-current-location]')
    && !statusRow.textContent.includes('현재 위치')
    && !statusRow.textContent.includes('📍');
  result.statusCollapsed = getComputedStyle(statusRow).display === 'none';

  // 2. The permission contract other surfaces read is still published.
  result.permissionPublished = root.dataset.locationPermission === 'GRANTED'
    && typeof root.dataset.locationResolution === 'string';

  // 3. The control exists — in Settings, which is the only place it lives now.
  click(root.querySelector('.calendar-settings-button'));
  await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings dialog');
  const dialog = root.querySelector('.calendar-settings-dialog');
  const locationRow = dialog.querySelector('[data-calendar-location-row]');
  const locationButton = dialog.querySelector('[data-calendar-current-location]');
  result.settingsHasLocation = Boolean(locationRow && locationButton);
  result.settingsHasManualRegion = Boolean(dialog.querySelector('.calendar-settings-region-row'));
  result.locationButtonLabel = locationButton ? locationButton.textContent : '';

  // 4. Using it says so once, as a toast that reserves no layout above the grid.
  // A render swaps the viewport's children, so the grid is always re-queried:
  // the point is where the grid sits, not whether one node survived.
  const gridTop = () => Math.round(root.querySelector('.calendar-month-grid').getBoundingClientRect().top);
  const gridTopBefore = gridTop();
  click(locationButton);
  await wait(() => root.querySelector('.calendar-toast'), 'toast');
  const toast = root.querySelector('.calendar-toast');
  const host = root.querySelector('.calendar-toast-host');
  result.toastText = toast.textContent;
  result.toastFixed = getComputedStyle(host).position === 'fixed';
  result.toastTop = Math.round(toast.getBoundingClientRect().top);
  result.gridTop = gridTop();
  result.toastBelowGrid = result.toastTop > result.gridTop;
  result.gridDidNotMove = Math.abs(result.gridTop - gridTopBefore) < 1;
  result.toastHostIsShellChild = host.parentElement === shell;

  // 5. Reopening is silent: the row never comes back and no second toast fires.
  await wait(() => !root.querySelector('.calendar-toast'), 'toast auto-dismiss');
  result.toastAutoDismissed = !root.querySelector('.calendar-toast');
  result.stillNoStatusRow = root.querySelector('.calendar-status').childElementCount === 0;
  result.changeLabel = root.querySelector('[data-calendar-current-location]')?.textContent || '';

  // 6. Blast radius: a denied location costs the weather decoration and nothing
  //    else. The Calendar must still be standing.
  mode = 'denied';
  click(root.querySelector('[data-calendar-current-location]'));
  await wait(() => root.dataset.locationPermission === 'DENIED', 'denied sync');
  result.calendarSurvivesDenial = Boolean(root.querySelector('.calendar-month-grid'))
    && root.querySelectorAll('.calendar-date-cell').length >= 28;
  result.deniedStaysOutOfGrid = root.querySelector('.calendar-status').childElementCount === 0;
  result.deniedStatusInSettings = (root.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '')
    .includes('위치 권한');

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
  // 360px is where the row cost the most, and the desktop width is the one the
  // screenshot in the report was taken at.
  const results = [[360, 780], [1280, 860]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    if (!v.statusEmpty || !v.noLocationAboveGrid) throw new Error(`${where}: location still renders above the date grid`);
    if (!v.statusCollapsed) throw new Error(`${where}: the emptied status row must collapse, not hold space`);
    if (!v.permissionPublished) throw new Error(`${where}: location permission contract must stay published on the root`);
    if (!v.settingsHasLocation) throw new Error(`${where}: Settings must carry the current-location control`);
    if (!v.settingsHasManualRegion) throw new Error(`${where}: Settings must keep the manual region control beside it`);
    // Permission granted is not the same as coordinates in hand: until the user
    // asks once, the control still offers to fetch them.
    if (v.locationButtonLabel !== '현재 위치 사용') throw new Error(`${where}: an unresolved location must offer 현재 위치 사용, got ${v.locationButtonLabel}`);
    if (v.toastText !== '현재 위치로 날씨를 표시합니다.') throw new Error(`${where}: unexpected toast copy ${v.toastText}`);
    if (!v.toastFixed || !v.toastBelowGrid || !v.gridDidNotMove) throw new Error(`${where}: the toast must not take layout from the date grid (fixed=${v.toastFixed} below=${v.toastBelowGrid} gridStill=${v.gridDidNotMove} toastTop=${v.toastTop} gridTop=${v.gridTop})`);
    if (!v.toastHostIsShellChild) throw new Error(`${where}: the toast host must belong to the Calendar shell`);
    if (!v.toastAutoDismissed) throw new Error(`${where}: the toast must dismiss itself`);
    if (!v.stillNoStatusRow) throw new Error(`${where}: the status row must stay empty after the change`);
    if (v.changeLabel !== '변경') throw new Error(`${where}: a resolved location must settle on 변경, got ${v.changeLabel}`);
    if (!v.calendarSurvivesDenial) throw new Error(`${where}: a denied location must not cost the Calendar`);
    if (!v.deniedStaysOutOfGrid) throw new Error(`${where}: a denial must not reclaim the row above the date grid`);
    if (!v.deniedStatusInSettings) throw new Error(`${where}: a denial must be readable in Settings`);
  }
  console.log('CALENDAR QUIET LOCATION PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
