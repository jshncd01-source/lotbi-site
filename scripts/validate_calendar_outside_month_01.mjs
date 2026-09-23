// The month you are looking at must win the page.
//
// Cells outside it already had a recessive background, but the date number kept
// its own colour: the weekend rules and, after the holiday work, the holiday
// rule too, neither of which looked at data-current-month. So a neighbouring
// month's Sunday was the same strong red as this month's, and next month's
// 개천절 lit up a block inside September.
//
// The fix is structural rather than a longer list of overrides: the weekend and
// holiday hues are scoped to the current month, and one `*` rule makes every
// child of an outside cell inherit a single recessive ink -- including children
// another room adds later.
//
// Recessive is not invisible. These dates are clickable, so this measures real
// contrast ratios, not just "is it greyer".
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-outside-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-outside-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4196;
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

  // September 2026 leads with 8/30 (Sunday) and 8/31, and trails with 10/1,
  // 10/2 and 10/3 -- 개천절, the outside-month holiday that started this.
  const HOLIDAYS = [
    {date: '2026-09-25', name: '추석', country: 'KR', holiday_type: 'CHUSEOK', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
    {date: '2026-10-03', name: '개천절', country: 'KR', holiday_type: 'NATIONAL', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
  ];
  const event = (id, title, date) => ({
    projection_id: 'p' + id, activity_id: 'activity_' + String(id).padStart(32, '0'),
    occurrence_id: 'occurrence_' + String(id).padStart(32, '0'),
    title, activity_revision: 1, occurrence_revision: 1, local_date: date, local_datetime: null,
    temporal_kind: 'DATE_ONLY', temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN',
    confirmation_level: 'USER_ATTESTED', provider_verified: false, reminder_configured: false,
    source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
    entry: {amount_minor: null, currency: 'KRW', expense_category: null, memo: null, place: null, merchant: null},
  });
  const ITEMS = [event(0, '이번달 일정', '2026-09-16'), event(1, '다음달 일정', '2026-10-02')];

  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', start_date: '2026-09-01', end_date: '2026-09-30', coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY', entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0, currencies: []});
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: HOLIDAYS, ai_calls: 0, provider_api_calls: 0});
    return j({view: 'AGENDA', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: ITEMS, ai_calls: 0, provider_api_calls: 0});
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-16T01:00:00Z'),
    locationProvider: null, locationPermissions: null,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');
  await wait(() => root.querySelector('.calendar-date-cell[data-calendar-date="2026-10-03"]'), 'trailing cell');

  const cell = date => root.querySelector('.calendar-date-cell[data-calendar-date="' + date + '"]');
  const bg = n => getComputedStyle(n).backgroundColor;
  const numberInk = n => getComputedStyle(n.querySelector('.calendar-date-number')).color;

  const readTheme = () => ({
    // outside the month
    outSundayInk: numberInk(cell('2026-08-30')),   // Sunday, previous month
    outWeekdayInk: numberInk(cell('2026-08-31')),  // Monday, previous month
    outSaturdayInk: numberInk(cell('2026-10-03')), // Saturday AND 개천절, next month
    outSurface: bg(cell('2026-08-31')),
    outHolidaySurface: bg(cell('2026-10-03')),
    // inside the month
    inSundayInk: numberInk(cell('2026-09-20')),
    inWeekdayInk: numberInk(cell('2026-09-17')),
    inHolidayInk: numberInk(cell('2026-09-25')),
    inSurface: bg(cell('2026-09-17')),
    inHolidaySurface: bg(cell('2026-09-25')),
    // an event that lands outside the month must recede with everything else
    outEventInk: (() => {
      const chip = cell('2026-10-02').querySelector('.calendar-event-chip');
      const count = cell('2026-10-02').querySelector('.calendar-mobile-event-count');
      return getComputedStyle(chip || count).color;
    })(),
    outHeight: Math.round(cell('2026-08-31').getBoundingClientRect().height),
    inHeight: Math.round(cell('2026-09-17').getBoundingClientRect().height),
  });

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  result.light = readTheme();
  document.body.dataset.siteTheme = 'dark';
  await sleep(140);
  result.dark = readTheme();
  document.body.dataset.siteTheme = 'light';
  await sleep(80);

  result.outsideAria = cell('2026-10-03').querySelector('.calendar-date-trigger')?.getAttribute('aria-label') || '';
  result.insideAria = cell('2026-09-17').querySelector('.calendar-date-trigger')?.getAttribute('aria-label') || '';

  // Recessive, not disabled: the cell still takes you there.
  const trigger = cell('2026-10-03').querySelector('.calendar-date-trigger');
  result.outsideTriggerDisabled = trigger?.disabled === true;
  trigger?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
  await sleep(900);
  result.monthAfterOutsideClick = root.querySelector('.calendar-title-button')?.textContent || '';

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

function channels(value) {
  const m = /rgba?\(([^)]+)\)/.exec(value || '');
  if (!m) throw new Error(`unreadable colour ${value}`);
  return m[1].split(',').slice(0, 3).map(n => Number(n.trim()));
}
const linear = c => (c / 255 <= 0.04045 ? (c / 255) / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
const relLuminance = value => {
  const [r, g, b] = channels(value);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const distance = (a, b) => channels(a).reduce((sum, v, i) => sum + Math.abs(v - channels(b)[i]), 0);

// Static guards for the structure, so the fix cannot be unpicked rule by rule.
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
if (!css.includes('.calendar-month-grid .calendar-date-cell[data-current-month="false"] * { color: inherit; }')) {
  throw new Error('the outside-month cell must hand one ink to every child, present and future');
}
for (const scoped of [
  // These were :nth-child(7n + 1) / :nth-child(7n) while the week could only
  // start on Sunday. The 주 시작 요일 setting made position stop meaning weekday,
  // so they key off data-weekday now; the scoping to this month is unchanged.
  '.calendar-date-cell[data-current-month="true"][data-weekday="0"] .calendar-date-number',
  '.calendar-date-cell[data-current-month="true"][data-weekday="6"] .calendar-date-number',
  '.calendar-date-cell[data-current-month="true"][data-holiday="true"]',
]) {
  if (!css.includes(scoped)) throw new Error(`the weekend/holiday hue must be scoped to this month: ${scoped}`);
}
if (!css.includes('--lotbi-calendar-outside-ink') || !css.includes('--lotbi-calendar-outside-surface')) {
  throw new Error('the outside-month colours must be named roles, not per-rule hex');
}
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
if (!manager.includes("cell.inCurrentMonth === false) parts.push('다른 달')")) {
  throw new Error('a screen reader must be told the date is outside the month, not left to infer it');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const results = [[360, 780], [1280, 860]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    for (const [theme, t] of [['light', v.light], ['dark', v.dark]]) {
      const tag = `${where} ${theme}`;
      // One ink outside the month: a neighbouring Sunday, Saturday-holiday and
      // weekday must be indistinguishable from one another.
      if (distance(t.outSundayInk, t.outWeekdayInk) > 2) {
        throw new Error(`${tag}: an outside Sunday still keeps the weekend hue (${t.outSundayInk} vs ${t.outWeekdayInk})`);
      }
      if (distance(t.outSaturdayInk, t.outWeekdayInk) > 2) {
        throw new Error(`${tag}: an outside Saturday/holiday still keeps its own hue (${t.outSaturdayInk} vs ${t.outWeekdayInk})`);
      }
      if (distance(t.outEventInk, t.outWeekdayInk) > 2) {
        throw new Error(`${tag}: an event outside the month must recede with the date (${t.outEventInk} vs ${t.outWeekdayInk})`);
      }
      // ...while this month keeps its own language.
      if (distance(t.inSundayInk, t.inWeekdayInk) < 12) throw new Error(`${tag}: this month's Sunday lost its weekend hue`);
      if (distance(t.inHolidayInk, t.inWeekdayInk) < 12) throw new Error(`${tag}: this month's holiday lost its ink`);

      // Recessive, and measurably so.
      const outRatio = contrast(t.outWeekdayInk, t.outSurface);
      const inRatio = contrast(t.inWeekdayInk, t.inSurface);
      if (outRatio < 4.5) throw new Error(`${tag}: the outside-month ink must stay readable, got ${outRatio.toFixed(2)}:1`);
      if (outRatio > inRatio / 2) throw new Error(`${tag}: the outside month is not weak enough (${outRatio.toFixed(2)}:1 against ${inRatio.toFixed(2)}:1)`);

      // A neighbouring month's holiday keeps a trace, well under this month's.
      const outTint = distance(t.outHolidaySurface, t.outSurface);
      const inTint = distance(t.inHolidaySurface, t.inSurface);
      if (outTint === 0) throw new Error(`${tag}: a neighbouring month's holiday should still hint at itself`);
      if (outTint >= inTint / 2) throw new Error(`${tag}: a neighbouring month's holiday outshines this month's (${outTint} vs ${inTint})`);

      if (t.outHeight !== t.inHeight) throw new Error(`${tag}: receding the outside month changed the cell height`);
    }
    if (!v.outsideAria.includes('다른 달')) throw new Error(`${where}: the outside-month date must say so to a screen reader: ${v.outsideAria}`);
    if (v.insideAria.includes('다른 달')) throw new Error(`${where}: a date inside the month must not claim otherwise`);
    if (v.outsideTriggerDisabled) throw new Error(`${where}: an outside-month date is still a live target, never disabled`);
    if (!v.monthAfterOutsideClick.includes('10월')) {
      throw new Error(`${where}: clicking an outside-month date must still go there, landed on ${v.monthAfterOutsideClick}`);
    }
  }
  console.log('CALENDAR OUTSIDE MONTH PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
