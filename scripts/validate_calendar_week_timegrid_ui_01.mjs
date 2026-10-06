// Real-browser proof that Week is one vertical list grouped by date.
//
// The week must not duplicate those dates in a horizontal jump strip or offer
// a horizontal hour-grid toggle. Sunday through Saturday stack top-to-bottom
// on every width, retain chronological records inside each date, and use the
// same weekend surfaces as Month. Geometry claims need a real layout engine.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-week-timegrid-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-week-timegrid-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4211;
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
try {
  localStorage.clear();
  // Holidays and location are off-topic for a geometry test; stubbing them
  // out keeps this hermetic instead of depending on the network.
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    return j({items: []});
  };

  const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
  const guestRepo = createGuestCalendarRepository(localStorage);
  // Guest mode allows only 3 events before asking for login, so one Wednesday
  // carries all of it: two truly-overlapping timed events (09:00-10:00 and
  // 09:30-10:30, for the lane-split *and* the proportional-position checks
  // at once -- a 30-minute later start must sit measurably lower) plus one
  // all-day item.
  guestRepo.create({title: '아침 회의', local_date: '2026-09-23', local_datetime: '2026-09-23T09:00:00', local_end_datetime: '2026-09-23T10:00:00', all_day: false});
  guestRepo.create({title: '오후 진료', local_date: '2026-09-23', local_datetime: '2026-09-23T09:30:00', local_end_datetime: '2026-09-23T10:30:00', all_day: false});
  guestRepo.create({title: '추석', local_date: '2026-09-23', local_datetime: null, all_day: true});

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    root, initialView: 'week', guestRepository: guestRepo,
    timezone: 'Asia/Seoul', now: new Date('2026-09-23T01:00:00Z'),
  });
  await wait(() => root.querySelector('.calendar-week-agenda'), 'week mounted');
  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  const section = root.querySelector('.calendar-week-agenda');
  // Both widths open on one date-grouped vertical list.
  result.initialLayout = section.dataset.weekLayout;
  result.stripCount = root.querySelectorAll('.calendar-week-strip').length;
  result.toggleCount = root.querySelectorAll('[data-week-layout-option]').length;
  result.gridPresent = Boolean(root.querySelector('.calendar-week-grid'));
  const groups = [...root.querySelectorAll('.calendar-week-list [data-calendar-week-group]')];
  const groupTops = groups.map(n => Math.round(n.getBoundingClientRect().top));
  result.groupCount = groups.length;
  result.groupsStack = groupTops.every((v, i) => i === 0 || v > groupTops[i - 1]);
  result.groupDates = groups.map(n => n.dataset.calendarWeekGroup);
  result.sectionOverflow = section.scrollWidth - section.clientWidth;
  const sunday = groups.find(n => n.dataset.weekday === '0');
  const monday = groups.find(n => n.dataset.weekday === '1');
  const saturday = groups.find(n => n.dataset.weekday === '6');
  result.weekendSurfaces = {
    sunday: sunday ? getComputedStyle(sunday).backgroundColor : '',
    monday: monday ? getComputedStyle(monday).backgroundColor : '',
    saturday: saturday ? getComputedStyle(saturday).backgroundColor : '',
  };
  const listRows = [...root.querySelectorAll('[data-calendar-week-group="2026-09-23"] .calendar-day-event')];
  result.listRows = listRows.map(n => [n.querySelector('time')?.textContent || '', n.querySelector('strong')?.textContent || '']);
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
    // Reduced motion: a strip tap scrolls instantly. Virtual time does not
    // drive a smooth-scroll animation to its end, so the reveal check would
    // otherwise measure a scroll frozen half-way.
    '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce',
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
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  // The same vertical date list is the Week contract on desktop and mobile.
  const results = [[1440, 900], [360, 780]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    if (v.initialLayout !== 'list') throw new Error(`${where}: Week must open as the life list, got "${v.initialLayout}"`);
    if (v.stripCount !== 0) throw new Error(`${where}: Week must not duplicate dates in a horizontal strip`);
    if (v.toggleCount !== 0) throw new Error(`${where}: Week must not offer a horizontal time-grid toggle`);
    if (v.gridPresent) throw new Error(`${where}: Week must never render the horizontal hour grid`);
    if (v.groupCount !== 7 || !v.groupsStack) throw new Error(`${where}: seven date groups must stack top to bottom (count=${v.groupCount})`);
    if (JSON.stringify(v.groupDates) !== JSON.stringify(['2026-09-20','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26'])) {
      throw new Error(`${where}: Week date order must be Sunday through Saturday, got ${JSON.stringify(v.groupDates)}`);
    }
    if (v.sectionOverflow > 0) throw new Error(`${where}: the vertical Week list must not scroll sideways (overflow=${v.sectionOverflow})`);
    if (v.weekendSurfaces.sunday !== 'rgb(255, 243, 243)' || v.weekendSurfaces.saturday !== 'rgb(242, 247, 255)') {
      throw new Error(`${where}: Sunday/Saturday must use red/blue surfaces, got ${JSON.stringify(v.weekendSurfaces)}`);
    }
    if (v.weekendSurfaces.monday === v.weekendSurfaces.sunday || v.weekendSurfaces.monday === v.weekendSurfaces.saturday) {
      throw new Error(`${where}: weekday surface must stay distinct from weekend surfaces`);
    }
    // Day order: the clock first, in time order; the time-less record after.
    if (JSON.stringify(v.listRows) !== JSON.stringify([['09:00', '아침 회의'], ['09:30', '오후 진료'], ['', '추석']])) {
      throw new Error(`${where}: the 23rd must list 09:00, 09:30, then the time-less record, got ${JSON.stringify(v.listRows)}`);
    }
  }
  console.log('CALENDAR WEEK VERTICAL-BY-DATE UI PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
