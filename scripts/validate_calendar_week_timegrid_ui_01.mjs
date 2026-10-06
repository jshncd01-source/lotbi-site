// Real-browser proof of the Week view's two layouts.
//
// LIFE UX 01: Week opens as 생활목록 -- a 7-day strip to jump between days,
// then each day's records in day order -- on every width. A wide screen can
// still switch to 시간표, and that hour grid must be an actual time grid, not
// the list re-skinned: 7 day columns sit side by side, a timed event's
// vertical position is really driven by its clock time (not just DOM order),
// two overlapping events really split into separate lanes instead of
// overlapping on screen, and the all-day/holiday row sits above the scrolling
// hour grid as its own surface. A phone never gets the hour grid (four
// squeezed columns of cut-off titles was what Week used to be there): its
// strip fits the screen, its days stack, and a strip tap brings that day into
// view. Geometry claims like these cannot be proven by reading source text --
// they need a real layout engine.
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
  // Both widths open on the life list, with a 7-day strip on one row.
  result.initialLayout = section.dataset.weekLayout;
  const stripDays = [...root.querySelectorAll('.calendar-week-strip [data-calendar-week-date]')];
  const stripTops = stripDays.map(n => Math.round(n.getBoundingClientRect().top));
  const stripLefts = stripDays.map(n => Math.round(n.getBoundingClientRect().left));
  result.stripCount = stripDays.length;
  result.stripOneRow = stripTops.every(v => v === stripTops[0]) && stripLefts.every((v, i) => i === 0 || v > stripLefts[i - 1]);
  result.stripFits = stripDays.every(n => n.getBoundingClientRect().right <= innerWidth + 1);
  result.toggle = [...root.querySelectorAll('[data-week-layout-option]')].map(n => [n.dataset.weekLayoutOption, n.textContent, n.getAttribute('aria-pressed')]);
  const listRows = [...root.querySelectorAll('[data-calendar-week-group="2026-09-23"] .calendar-day-event')];
  result.listRows = listRows.map(n => [n.querySelector('time')?.textContent || '', n.querySelector('strong')?.textContent || '']);

  if (innerWidth <= 900) {
    // A phone: no hour grid at all, the days stack, nothing scrolls sideways,
    // and a strip tap brings that day's records into view.
    result.mobile = true;
    result.gridPresent = Boolean(root.querySelector('.calendar-week-grid'));
    const groups = [...root.querySelectorAll('.calendar-week-list [data-calendar-week-group]')];
    const groupTops = groups.map(n => Math.round(n.getBoundingClientRect().top));
    result.groupCount = groups.length;
    result.groupsStack = groupTops.every((v, i) => i === 0 || v > groupTops[i - 1]);
    result.sectionOverflow = section.scrollWidth - section.clientWidth;
    // The week's last day starts below the fold; a strip tap must scroll its
    // heading into the visible part of the page (as far as the page can go).
    const scroller = root.closest('.site-modal-content');
    const visibleBox = () => {
      const box = scroller.getBoundingClientRect();
      return {top: Math.max(box.top, 0), bottom: Math.min(box.bottom, innerHeight)};
    };
    const headingVisible = () => {
      const heading = root.querySelector('.calendar-week-list [data-calendar-week-group="2026-09-26"] .calendar-week-day-heading');
      if (!heading) return false;
      const rect = heading.getBoundingClientRect();
      const box = visibleBox();
      return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
    };
    result.lastDayBelowFold = !headingVisible();
    root.querySelector('.calendar-week-strip [data-calendar-week-date="2026-09-26"]').click();
    let revealed = false;
    for (let i = 0; i < 150 && !revealed; i += 1) {
      await sleep(20);
      revealed = headingVisible();
    }
    result.stripTapReveals = revealed;
    result.stripSelected = root.querySelector('.calendar-week-strip [data-calendar-week-date="2026-09-26"]')?.getAttribute('aria-selected');
    out.textContent = JSON.stringify(result);
    throw null;
  }

  // A wide screen: 시간표 is one press away, and it is a real hour grid.
  root.querySelector('[data-week-layout-option="timegrid"]').click();
  await wait(() => root.querySelector('.calendar-week-grid'), 'week grid mounted');
  await wait(() => root.querySelectorAll('.calendar-week-day').length === 7, '7 day columns');
  await sleep(80); // let the post-mount rAF scroll settle
  result.timegridPressed = root.querySelector('[data-week-layout-option="timegrid"]')?.getAttribute('aria-pressed');
  result.layoutAfterToggle = root.querySelector('.calendar-week-agenda')?.dataset.weekLayout;
  const dayHeaders = [...root.querySelectorAll('.calendar-week-day')];
  const lefts = dayHeaders.map(n => Math.round(n.getBoundingClientRect().left));
  result.columnCount = dayHeaders.length;
  result.columnsIncreasing = lefts.every((v, i) => i === 0 || v > lefts[i - 1]);
  const tops = dayHeaders.map(n => Math.round(n.getBoundingClientRect().top));
  result.columnsSameRow = tops.every(v => v === tops[0]);

  const eventRect = title => {
    const node = [...root.querySelectorAll('.calendar-week-grid-event')].find(n => n.textContent.includes(title));
    return node ? node.getBoundingClientRect() : null;
  };
  const morningRect = eventRect('아침 회의'); // 09:00-10:00
  const afternoonRect = eventRect('오후 진료'); // 09:30-10:30 -- overlaps the above
  const dayColumn = root.querySelector('[data-calendar-week-group="2026-09-23"]');
  const columnTop = dayColumn ? dayColumn.getBoundingClientRect().top : null;
  result.eventsFound = Boolean(morningRect && afternoonRect && dayColumn);
  if (result.eventsFound) {
    // A real 30-minute-later start must sit a real, specific amount lower:
    // at 48px/hour over a 1440-minute column, 30 minutes is exactly 24px.
    // This is minute-of-day math driving a real CSS top, not source order in
    // a list, and generous tolerance only covers rounding/border pixels.
    const morningOffset = morningRect.top - columnTop;
    const afternoonOffset = afternoonRect.top - columnTop;
    result.laterIsLower = afternoonOffset > morningOffset;
    const delta = afternoonOffset - morningOffset;
    result.proportional = delta > 16 && delta < 32;
    result.morningOffset = Math.round(morningOffset);
    result.afternoonOffset = Math.round(afternoonOffset);

    // The two are truly overlapping in time (09:00-10:00 vs 09:30-10:30), so
    // the rendered blocks must not overlap horizontally -- proving the lane
    // split is real pixels, not just a data attribute nobody reads.
    result.overlapLanesSeparate = morningRect.right <= afternoonRect.left + 1 || afternoonRect.right <= morningRect.left + 1;
    // And they must still overlap in Y (same time window), otherwise the
    // horizontal-separation check would trivially pass for unrelated reasons.
    result.overlapSameBand = morningRect.top < afternoonRect.bottom && afternoonRect.top < morningRect.bottom;
  }

  const alldayRow = root.querySelector('.calendar-week-allday-row');
  const scroll = root.querySelector('.calendar-week-grid-scroll');
  result.alldayFound = Boolean(alldayRow && alldayRow.textContent.includes('추석'));
  result.alldayAboveScroll = Boolean(alldayRow && scroll) && alldayRow.getBoundingClientRect().bottom <= scroll.getBoundingClientRect().top + 1;

  result.hourLabelCount = root.querySelectorAll('.calendar-week-hour-label').length;

  const grid = root.querySelector('.calendar-week-grid');
  result.horizontalOverflow = grid.scrollWidth - grid.clientWidth;

  out.textContent = JSON.stringify(result);
} catch (e) {
  // \`throw null\` ends the phone case early, after it has written its result.
  if (e !== null) out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e), viewport: {width: innerWidth, height: innerHeight}});
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
  // 1440 desktop (list first, then the full 7-column hour grid) and 360
  // mobile (the life list only).
  const results = [[1440, 900], [360, 780]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    if (v.initialLayout !== 'list') throw new Error(`${where}: Week must open as the life list, got "${v.initialLayout}"`);
    if (v.stripCount !== 7 || !v.stripOneRow) throw new Error(`${where}: the 7-day strip must sit on one row, left to right (count=${v.stripCount})`);
    if (!v.stripFits) throw new Error(`${where}: the 7-day strip must fit the screen width`);
    // Day order: the clock first, in time order; the time-less record after.
    if (JSON.stringify(v.listRows) !== JSON.stringify([['09:00', '아침 회의'], ['09:30', '오후 진료'], ['', '추석']])) {
      throw new Error(`${where}: the 23rd must list 09:00, 09:30, then the time-less record, got ${JSON.stringify(v.listRows)}`);
    }
    if (v.mobile) {
      if (v.toggle.length) throw new Error(`${where}: a phone must not offer the hour grid, got ${JSON.stringify(v.toggle)}`);
      if (v.gridPresent) throw new Error(`${where}: a phone must never render the hour grid`);
      if (v.groupCount !== 7 || !v.groupsStack) throw new Error(`${where}: seven day groups must stack top to bottom (count=${v.groupCount})`);
      if (v.sectionOverflow > 0) throw new Error(`${where}: the week list must not scroll sideways (overflow=${v.sectionOverflow})`);
      if (!v.lastDayBelowFold) throw new Error(`${where}: fixture drift -- the week's last day must start below the fold for the reveal check to mean anything`);
      if (!v.stripTapReveals) throw new Error(`${where}: a strip tap must bring that day's records into view`);
      if (v.stripSelected !== 'true') throw new Error(`${where}: the tapped strip day must become the selected one`);
      continue;
    }
    if (JSON.stringify(v.toggle) !== JSON.stringify([['list', '생활목록', 'true'], ['timegrid', '시간표', 'false']])) {
      throw new Error(`${where}: a wide screen must offer 생활목록 / 시간표 with the list pressed first, got ${JSON.stringify(v.toggle)}`);
    }
    if (v.layoutAfterToggle !== 'timegrid' || v.timegridPressed !== 'true') throw new Error(`${where}: pressing 시간표 must switch to the hour grid`);
    if (v.columnCount !== 7) throw new Error(`${where}: expected 7 day columns, got ${v.columnCount}`);
    if (!v.columnsIncreasing) throw new Error(`${where}: day columns are not laid out side by side left-to-right`);
    if (!v.columnsSameRow) throw new Error(`${where}: day columns are not on one row -- looks like the old stacked agenda`);
    if (!v.eventsFound) throw new Error(`${where}: could not find the seeded timed events in the grid`);
    if (!v.laterIsLower) throw new Error(`${where}: a 09:30 event must render below a 09:00 event on the same day`);
    if (!v.proportional) throw new Error(`${where}: 30 minutes later did not move the event ~24px lower (morning=${v.morningOffset} afternoon=${v.afternoonOffset})`);
    if (!v.overlapSameBand) throw new Error(`${where}: overlap fixture events do not actually share a time band`);
    if (!v.overlapLanesSeparate) throw new Error(`${where}: two truly-overlapping events render on top of each other instead of splitting lanes`);
    if (!v.alldayFound) throw new Error(`${where}: the all-day event did not render in the all-day row`);
    if (!v.alldayAboveScroll) throw new Error(`${where}: the all-day/holiday row must sit above the scrolling hour grid, not inside it`);
    if (v.hourLabelCount !== 24) throw new Error(`${where}: expected a 24-hour axis, got ${v.hourLabelCount}`);
  }
  console.log('CALENDAR WEEK TIME-GRID UI PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
