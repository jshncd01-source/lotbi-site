// Guest month weather must follow the visible date range, not "is this the
// current month".
//
// The guest month/week refresh path used to gate its weather request on
// `currentMonthVisible` (state.year/month === today's year/month). Moving the
// Calendar forward one screen — from September 2026 to October 2026, with
// today fixed at 2026-09-26 — flips that flag false even though October 1-10
// sit squarely inside the 14-day forecast horizon and were already being
// requested and shown as September's trailing spillover. The dates did not
// stop being forecastable; only the screen holding them changed. That made
// the weather disappear on the very screen a user reaches by pressing [다음].
//
// The fix reuses the same `forecastWindow(range, today)` clamp the
// authenticated path already applies (today..today+14, intersected with the
// range actually on screen) for the guest month AND week grids, so which
// dates get weather is a property of the visible range, never of which
// month happens to be "current". This measures that against a real Calendar,
// with a fixed clock, by watching the actual fetch calls it makes.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-guest-month-weather-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-guest-month-weather-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4199;
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
</head><body class="chat-home-page" data-site-auth-state="guest">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
const click = node => node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
let result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false}));

  // Fixed forecast fixture. Real fresh dates would drift with the calendar
  // and stop testing anything; a real bug in the days themselves is caught
  // by the icon/normalization tests, not this one.
  const WEATHER_FIXTURE = [
    {date: '2026-09-26', weather_kind: 'CLEAR', weather_icon: '☀️', source: 'KMA_SHORT', issued_at: '2026-09-26T00:00:00Z'},
    {date: '2026-09-30', weather_kind: 'CLOUDY', weather_icon: '☁️', source: 'KMA_SHORT', issued_at: '2026-09-26T00:00:00Z'},
    {date: '2026-10-01', weather_kind: 'RAIN', weather_icon: '🌧️', source: 'KMA_SHORT', issued_at: '2026-09-26T00:00:00Z', temperature_c: 19},
    {date: '2026-10-05', weather_kind: 'SNOW', weather_icon: '❄️', source: 'KMA_SHORT', issued_at: '2026-09-26T00:00:00Z'},
    {date: '2026-10-10', weather_kind: 'CLEAR', weather_icon: '☀️', source: 'KMA_SHORT', issued_at: '2026-09-26T00:00:00Z'},
  ];

  const weatherRequests = [];
  let weatherShouldFail = false;
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const raw = String(url);
    const u = new URL(raw, location.origin);
    if (u.pathname.includes('/weather/public')) {
      const start = u.searchParams.get('start');
      const end = u.searchParams.get('end');
      weatherRequests.push({start, end, url: raw});
      if (weatherShouldFail) {
        return Promise.resolve(new Response(JSON.stringify({detail: {code: 'HTTP_500', message: '날씨 서버 오류'}}), {status: 500, headers: {'Content-Type': 'application/json'}}));
      }
      const items = WEATHER_FIXTURE.filter(item => item.date >= start && item.date <= end);
      return j({provider_ready: true, items, ai_calls: 0});
    }
    if (u.pathname.includes('/holidays')) {
      return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    }
    return j({ok: true});
  };

  const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
  const guestRepository = createGuestCalendarRepository(localStorage);
  // Proof that a weather failure costs only the weather decoration: this
  // event must still be on screen once the weather fetch is made to fail.
  guestRepository.create({title: '테스트 일정', local_date: '2026-09-15'});

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  // No sessionToken: this is the Guest path, not authenticated.
  await mountLifeCalendarManager({
    root, guestRepository, initialView: 'month', timezone: 'Asia/Seoul',
    now: new Date('2026-09-26T01:00:00Z'),
    // MANUAL_REGION (not BROWSER_CURRENT) so refresh()'s staleness guard for
    // ageing browser coordinates never fires and clears it out from under us.
    weatherLocation: {latitude: 37.5665, longitude: 126.978, source: 'MANUAL_REGION'},
    locationProvider: null, locationPermissions: null,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');

  const title = () => root.querySelector('.calendar-title-button')?.textContent || '';
  const cell = date => root.querySelector('.calendar-date-cell[data-calendar-date="' + date + '"]');
  const weatherOn = date => {
    const icon = cell(date)?.querySelector('.calendar-weather-icon');
    return icon ? {weatherKind: icon.dataset.weatherKind, title: icon.title} : null;
  };
  const drain = () => weatherRequests.splice(0);
  async function navigate(direction) {
    const before = title();
    click(root.querySelector('[data-calendar-navigation="' + direction + '"]'));
    await wait(() => title() !== before, 'title change after ' + direction);
    await sleep(200);
  }

  // 1. September 2026 (the actual current month): the grid's trailing
  // spillover (10/1-10/3) is inside the forecast horizon and must be
  // requested and shown, same as before this fix.
  await wait(() => weatherRequests.length >= 1, 'initial (September) weather request');
  await sleep(150);
  result.septemberTitle = title();
  result.septemberRequests = drain();
  result.septemberOct1 = weatherOn('2026-10-01');

  // 2. PRIMARY: move forward to October 2026. "Not the current month" must
  // no longer suppress the request — 10/1 through the horizon end
  // (2026-10-10) is still forecastable and must be asked for and shown.
  await navigate('next');
  result.octoberTitle = title();
  await wait(() => weatherRequests.length >= 1, 'October weather request (must not vanish)');
  await sleep(150);
  result.octoberRequests = drain();
  result.octoberOct1 = weatherOn('2026-10-01');

  // 3. November 2026 sits entirely beyond the 14-day horizon from
  // 2026-09-26: no weather request, no error, nothing invented.
  await navigate('next');
  result.novemberTitle = title();
  await sleep(300);
  result.novemberRequests = drain();
  result.novemberGridOk = Boolean(root.querySelector('.calendar-month-grid'))
    && root.querySelectorAll('.calendar-date-cell').length >= 28;

  // 4. Walk back through a month already covered (October, September) to a
  // month entirely in the past (August): no future forecast request either.
  await navigate('previous'); // October
  drain();
  await navigate('previous'); // September
  drain();
  await navigate('previous'); // August
  result.augustTitle = title();
  await sleep(300);
  result.augustRequests = drain();

  // Back to today's month for the Week View check. The toolbar's [다음]/[이전]
  // reset selectedDate to the 1st of the target month (only month/year change
  // matters for the guest month case above), so selectedDate is not
  // necessarily "today" any more -- press [오늘] to land exactly back on it.
  await navigate('next'); // September
  const todayButton = [...root.querySelectorAll('.calendar-today-button')].find(b => b.textContent === '오늘');
  click(todayButton);
  await sleep(250);
  result.backToSeptemberTitle = title();
  drain();

  // 5. Week View must still work: switching to the week containing today
  // must still request and show today's weather (this path already worked;
  // the fix must not regress it by making both paths share the clamp).
  click(root.querySelector('[data-calendar-mode="week"]'));
  await wait(() => root.querySelector('.calendar-week-agenda'), 'week agenda');
  await wait(() => weatherRequests.length >= 1, 'week weather request');
  await sleep(150);
  result.weekRequests = drain();
  // Two elements share this dataset (the day-jump strip button and the grid
  // header cell); only the header cell carries the weather line.
  const weekTodayHeader = root.querySelector('.calendar-week-day[data-calendar-week-date="2026-09-26"]');
  result.weekTodayHasWeather = Boolean(weekTodayHeader?.querySelector('.calendar-week-weather'));

  // 6. Fail-soft: a failing weather fetch must not take the schedule down
  // with it, and must not invent a placeholder weather.
  click(root.querySelector('[data-calendar-mode="month"]'));
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid again');
  await sleep(150);
  drain();
  weatherShouldFail = true;
  await navigate('previous'); // August: forces a fresh refresh() cycle
  await navigate('next'); // back to September, re-requests weather (and fails)
  await sleep(300);
  result.failSoftRequests = drain();
  result.failSoftGridOk = Boolean(root.querySelector('.calendar-month-grid'))
    && root.querySelectorAll('.calendar-date-cell').length >= 28;
  result.failSoftNoFakeWeather = root.querySelectorAll('.calendar-weather-icon').length === 0;
  result.failSoftEventStillShown = (cell('2026-09-15')?.textContent || '').includes('테스트 일정');
  result.failSoftNoFatalError = !root.querySelector('.life-calendar-error');

  out.textContent = JSON.stringify(result);
} catch (e) {
  out.textContent = JSON.stringify({...result, ok: false, error: String(e?.stack || e), viewport: {width: innerWidth, height: innerHeight}});
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
  const v = run(browser, 1280, 860);

  // 1. September 2026 (today's actual month): spillover into October that
  // overlaps the forecast horizon must be requested and shown.
  if (!v.septemberTitle.includes('9월')) throw new Error(`expected September first, got ${v.septemberTitle}`);
  if (v.septemberRequests.length !== 1) throw new Error(`September must issue exactly one weather request, got ${JSON.stringify(v.septemberRequests)}`);
  if (v.septemberRequests[0].start !== '2026-09-26' || v.septemberRequests[0].end !== '2026-10-04') {
    throw new Error(`September window must be forecastWindow(monthBounds, today) = 2026-09-26..2026-10-04, got ${JSON.stringify(v.septemberRequests[0])}`);
  }
  if (!v.septemberOct1 || v.septemberOct1.weatherKind !== 'RAIN') {
    throw new Error(`September's 10/1 spillover cell must show the RAIN forecast, got ${JSON.stringify(v.septemberOct1)}`);
  }

  // 2. PRIMARY regression: October 2026 must NOT lose its weather request
  // just because it is not "the current month".
  if (!v.octoberTitle.includes('10월')) throw new Error(`expected October after [다음], got ${v.octoberTitle}`);
  if (v.octoberRequests.length !== 1) {
    throw new Error(`October must still issue a weather request ("현재 달 아님" must not suppress it) — got ${JSON.stringify(v.octoberRequests)}`);
  }
  if (v.octoberRequests[0].start !== '2026-09-27' || v.octoberRequests[0].end !== '2026-10-10') {
    throw new Error(`October window must clamp to forecastWindow(monthBounds, today) = 2026-09-27..2026-10-10 (horizon), got ${JSON.stringify(v.octoberRequests[0])}`);
  }

  // 5 (spillover consistency, checked here since both renders are in hand):
  // the same 10/1 must render the same weather whether it is September's
  // trailing spillover cell or October's own cell.
  if (!v.octoberOct1 || v.octoberOct1.weatherKind !== 'RAIN' || v.octoberOct1.title !== v.septemberOct1.title) {
    throw new Error(`10/1 must render identically in both months, got September=${JSON.stringify(v.septemberOct1)} October=${JSON.stringify(v.octoberOct1)}`);
  }

  // 3. November 2026 is entirely beyond the horizon: no request, no crash.
  if (!v.novemberTitle.includes('11월')) throw new Error(`expected November after a second [다음], got ${v.novemberTitle}`);
  if (v.novemberRequests.length !== 0) throw new Error(`November is entirely beyond the forecast horizon and must not request weather, got ${JSON.stringify(v.novemberRequests)}`);
  if (!v.novemberGridOk) throw new Error('November must still render a full Calendar grid with no weather');

  // 4. August 2026 is entirely in the past: no request either.
  if (!v.augustTitle.includes('8월')) throw new Error(`expected August after walking back, got ${v.augustTitle}`);
  if (v.augustRequests.length !== 0) throw new Error(`August is entirely in the past and must not request a future forecast, got ${JSON.stringify(v.augustRequests)}`);

  if (!v.backToSeptemberTitle.includes('9월')) throw new Error(`expected September again, got ${v.backToSeptemberTitle}`);

  // 6. Week View must be unaffected by sharing the clamp: today's week must
  // still request and show today's weather.
  if (v.weekRequests.length !== 1 || v.weekRequests[0].start !== '2026-09-26' || v.weekRequests[0].end !== '2026-09-26') {
    throw new Error(`Week View for today's week must request exactly 2026-09-26..2026-09-26, got ${JSON.stringify(v.weekRequests)}`);
  }
  if (!v.weekTodayHasWeather) throw new Error("Week View's today column must still show a weather line");

  // 7. Fail-soft: a failing weather fetch costs only the weather decoration.
  if (v.failSoftRequests.length < 1) throw new Error('the fail-soft case must have actually attempted a weather request');
  if (!v.failSoftGridOk) throw new Error('a failed weather fetch must not take the month grid down with it');
  if (!v.failSoftNoFakeWeather) throw new Error('a failed weather fetch must show no weather icon at all, never a stale or invented one');
  if (!v.failSoftEventStillShown) throw new Error("a failed weather fetch must not hide the guest's own schedule");
  if (!v.failSoftNoFatalError) throw new Error('a failed weather fetch must not surface as a fatal Calendar error');

  console.log('CALENDAR GUEST MONTH WEATHER FORECAST WINDOW PASS', JSON.stringify({
    septemberRequests: v.septemberRequests, octoberRequests: v.octoberRequests,
    novemberRequests: v.novemberRequests, augustRequests: v.augustRequests, weekRequests: v.weekRequests,
  }));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
