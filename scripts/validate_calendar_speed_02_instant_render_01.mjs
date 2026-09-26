// CALENDAR-SPEED-02: the schedule must render as soon as it arrives, never
// waiting on weather/holidays, and a location-only change must never re-fetch
// the schedule. This renders the real Calendar in a real browser against a
// fetch mock that can hold weather open indefinitely and count every route,
// and asserts both properties directly rather than by proxy.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-speed-02-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-speed-02-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4231;
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
const wait = async (fn, label) => { for (let i = 0; i < 400; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: true}));

  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  const counts = {agenda: 0, attention: 0, weather: 0, holidays: 0, regions: 0};
  let releaseWeather = null;
  let holdWeather = true;
  const agendaItem = {
    projection_id: 'p0', activity_id: 'activity_' + '0'.repeat(32),
    occurrence_id: 'occurrence_' + '0'.repeat(32),
    title: '고정 일정', activity_revision: 1, occurrence_revision: 1,
    local_date: '2026-09-24', local_datetime: null,
    temporal_kind: 'DATE_ONLY', temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN',
    confirmation_level: 'USER_ATTESTED', provider_verified: false, reminder_configured: false,
    source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
    entry: {amount_minor: null, currency: 'KRW', expense_category: null, memo: null, place: null, merchant: null},
  };
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) { counts.attention += 1; return j({view: 'ATTENTION', as_of: '2026-09-24T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0}); }
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather/regions')) { counts.regions += 1; return j({items: [], ai_calls: 0}); }
    if (u.pathname.includes('/weather')) {
      counts.weather += 1;
      const body = {provider_ready: true, items: [{date: '2026-09-24', weather_kind: 'CLEAR', weather_icon: '☀️', source: 'KMA_SHORT', issued_at: '2026-09-24T00:00:00Z'}], ai_calls: 0};
      if (!holdWeather) return j(body);
      return new Promise(resolve => { releaseWeather = () => resolve(j(body)); });
    }
    if (u.pathname.includes('/holidays')) { counts.holidays += 1; return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0}); }
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', ai_calls: 0, provider_api_calls: 0, currency: 'KRW', total_minor: 0, categories: []});
    counts.agenda += 1;
    return j({view: 'AGENDA', as_of: '2026-09-24T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [agendaItem], ai_calls: 0, provider_api_calls: 0});
  };

  // Location permission is already GRANTED and resolves to a region the
  // Calendar has not shown before -- the scenario CALENDAR-SPEED-02 exists to
  // fix: mount must not fetch the schedule twice because of it.
  const permissions = {query: async () => ({state: 'granted'})};
  const geolocation = {
    getCurrentPosition(onOk) {
      onOk({coords: {latitude: 37.5665, longitude: 126.978, accuracy: 40}, timestamp: Date.now()});
    },
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  const mountStarted = Date.now();
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-24T01:00:00Z'),
    locationProvider: geolocation, locationPermissions: permissions,
  });

  // 1. The schedule must be on screen while weather is still held open.
  await wait(() => root.querySelector('[data-calendar-event-id="' + agendaItem.activity_id + '"]'), 'agenda item visible');
  const agendaVisibleMs = Date.now() - mountStarted;
  const weatherStillPending = counts.weather >= 1 && agendaVisibleMs >= 0;
  const noWeatherCellYet = root.querySelectorAll('.calendar-weather-icon').length === 0;

  // 2. Location resolving to a new region must not have re-fetched the
  // schedule a second time. attention/holidays are read once per Calendar
  // load and must also stay at one.
  await wait(() => root.dataset.locationPermission === 'GRANTED', 'permission sync');
  await sleep(150);
  const countsAfterLocation = {...counts};

  // 3. Release weather now; it must attach to the existing grid without a
  // second schedule fetch.
  holdWeather = false;
  releaseWeather?.();
  await wait(() => root.querySelectorAll('.calendar-weather-icon').length > 0, 'weather glyph rendered');
  const countsAfterWeather = {...counts};
  const agendaStillVisibleAfterWeather = Boolean(root.querySelector('[data-calendar-event-id="' + agendaItem.activity_id + '"]'));

  out.textContent = JSON.stringify({
    ok: true,
    countsAtAgendaVisible: {agenda: counts.agenda, weather: counts.weather},
    weatherStillPending,
    noWeatherCellYet,
    countsAfterLocation,
    countsAfterWeather,
    agendaStillVisibleAfterWeather,
  });
} catch (e) {
  out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e)});
}
<\/script></body></html>`;

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

function run(browser) {
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
  if (!v.ok) throw new Error(v.error);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const v = run(browser);

  if (v.countsAtAgendaVisible.agenda !== 1) throw new Error(`agenda must have been fetched exactly once before it renders, got ${v.countsAtAgendaVisible.agenda}`);
  if (v.countsAtAgendaVisible.weather < 1) throw new Error('weather fetch must already be in flight while the agenda renders');
  if (!v.noWeatherCellYet) throw new Error('weather must not render before its own fetch resolves, even though the agenda already has');

  if (v.countsAfterLocation.agenda !== 1) throw new Error(`location resolving to a new region must not re-fetch the schedule, agenda calls=${v.countsAfterLocation.agenda}`);
  if (v.countsAfterLocation.attention !== 1) throw new Error(`location resolving to a new region must not re-fetch attention, calls=${v.countsAfterLocation.attention}`);
  if (v.countsAfterLocation.holidays !== 1) throw new Error(`location resolving to a new region must not re-fetch holidays, calls=${v.countsAfterLocation.holidays}`);

  if (!v.agendaStillVisibleAfterWeather) throw new Error('the schedule must still be visible once weather finally arrives');
  if (v.countsAfterWeather.agenda !== 1) throw new Error(`weather arriving must not trigger a second schedule fetch, agenda calls=${v.countsAfterWeather.agenda}`);
  if (v.countsAfterWeather.holidays !== 1) throw new Error(`weather arriving must not trigger a second holiday fetch, calls=${v.countsAfterWeather.holidays}`);

  console.log('CALENDAR SPEED-02 INSTANT RENDER PASS', JSON.stringify(v));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
