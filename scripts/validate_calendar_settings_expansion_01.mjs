// 승인된 캘린더 설정 확장: 격자선 표시 · 주 시작 요일.
//
// Two things make this more than adding two switches.
//
// 1. WEEKEND COLOUR WAS POSITIONAL. The Sunday and Saturday hues were
//    :nth-child(7n + 1) and :nth-child(7n) -- "first and last cell of the row".
//    That only ever meant Sunday and Saturday because the week could not start
//    anywhere else. Start it on Monday and those same positions are 월 and 일,
//    so the red would land on Monday. The cells carry data-weekday now and the
//    colours key off the real weekday. This measures that on a Monday-start
//    grid, not just that the rule exists.
//
// 2. THE GRID LINES WERE ALREADY ON. `.calendar-month-grid` paints a 1px gap
//    in the line colour, so the setting turns them OFF. The copy on screen says
//    that; a switch that claims to add something already there reads as broken
//    the first time you use it.
//
// And the round trip is the point of the storage fix that shipped with #229:
// three settings now share one stored object, so writing one must not erase the
// other two. That is asserted through a real reload, not by reading the source.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-settings-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-settings-wrapper.html';
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

// ---------------------------------------------------------------------------
// The model on its own: the grid has to be right before any of it is painted.
// September 2026 starts on a Tuesday, which is the useful case -- both starts
// need leading cells, so neither can pass by accident.
const {calendarMonthGrid, monthGridRange, calendarYearOverview} = await import('../site-calendar-model.js');

const sundayStart = calendarMonthGrid(2026, 9);
const mondayStart = calendarMonthGrid(2026, 9, 1);
assert.equal(sundayStart[0].weekday, 0, 'the default grid must still open on Sunday');
assert.equal(mondayStart[0].weekday, 1, 'a Monday start must open the grid on Monday');
assert.equal(sundayStart[0].date, '2026-08-30');
assert.equal(mondayStart[0].date, '2026-08-31');
for (const cells of [sundayStart, mondayStart]) {
  assert.equal(cells.length % 7, 0, 'the grid must stay whole weeks');
  // Every date of the month is present exactly once, whatever the start.
  const inMonth = cells.filter(cell => cell.inCurrentMonth).map(cell => cell.day);
  assert.deepEqual(inMonth, Array.from({length: 30}, (_, i) => i + 1), 'a week start must not drop or repeat a date');
  // Consecutive, no gaps: each cell is one day after the last.
  for (let i = 1; i < cells.length; i += 1) {
    const previous = Date.UTC(cells[i - 1].year, cells[i - 1].month - 1, cells[i - 1].day);
    const current = Date.UTC(cells[i].year, cells[i].month - 1, cells[i].day);
    assert.equal(current - previous, 86400000, 'the grid must stay a continuous run of days');
    assert.equal(cells[i].weekday, (cells[i - 1].weekday + 1) % 7, 'weekday must advance with the date');
  }
}
assert.deepEqual(monthGridRange(2026, 9, 1), {start: '2026-08-31', end: '2026-10-04'});
assert.equal(calendarYearOverview(2026, 1)[0].cells[0].weekday, 1, 'the year view must follow the same start');
// A start nobody offers is a programming error, not something to render.
assert.throws(() => calendarMonthGrid(2026, 9, 7), /weekStart/i);
assert.throws(() => calendarMonthGrid(2026, 9, 1.5), /weekStart/i);

// The stored settings survive each other. This is the #229 merge fix under load.
const {readCalendarDisplaySettings} = await import('../site-calendar-manager.js');
{
  const store = new Map();
  const storage = {getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v)};
  const defaults = readCalendarDisplaySettings(storage);
  assert.deepEqual({...defaults}, {showKoreaHolidays: true, showGridLines: true, weekStart: 0},
    'an empty store must render exactly the Calendar that shipped');
  // Anything unreadable falls all the way back rather than rendering a guess.
  for (const broken of ['{', '[]', 'null', '"nope"', '{"weekStart":9}', '{"weekStart":"1"}']) {
    const bad = {getItem: () => broken, setItem: () => {}};
    const read = readCalendarDisplaySettings(bad);
    assert.equal(read.weekStart, 0, `a week start of ${broken} must fall back to Sunday`);
    assert.equal(read.showGridLines, true, `${broken} must not silently hide the grid lines`);
  }
  assert.deepEqual({...readCalendarDisplaySettings(null)}, {showKoreaHolidays: true, showGridLines: true, weekStart: 0},
    'no storage at all must not stop the Calendar');
}

// ---------------------------------------------------------------------------
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
const wait = async (fn, label) => { for (let i = 0; i < 300; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
try {
  localStorage.clear();
  const HOLIDAYS = [
    {date: '2026-09-25', name: '추석', country: 'KR', holiday_type: 'CHUSEOK', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
  ];
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', start_date: '2026-09-01', end_date: '2026-09-30', coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY', entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0, currencies: []});
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: HOLIDAYS, ai_calls: 0, provider_api_calls: 0});
    return j({view: 'AGENDA', as_of: '2026-09-16T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  const mount = () => mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-16T01:00:00Z'),
    locationProvider: null, locationPermissions: null,
  });
  await mount();
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');

  const grid = () => root.querySelector('.calendar-month-grid');
  const cells = () => [...root.querySelectorAll('.calendar-date-cell')];
  const headings = () => [...root.querySelectorAll('.calendar-weekdays span')];
  const cell = date => root.querySelector('.calendar-date-cell[data-calendar-date="' + date + '"]');
  const numberInk = node => getComputedStyle(node.querySelector('.calendar-date-number')).color;

  const readGrid = () => ({
    weekStart: grid().dataset.weekStart,
    gridLines: grid().dataset.gridLines,
    gap: getComputedStyle(grid()).rowGap,
    gridBg: getComputedStyle(grid()).backgroundColor,
    headings: headings().map(n => n.textContent),
    headingWeekdays: headings().map(n => n.dataset.weekday),
    firstCellDate: cells()[0].dataset.calendarDate,
    firstCellWeekday: cells()[0].dataset.weekday,
    cellCount: cells().length,
    // The colours, read off real weekdays inside the month.
    sundayInk: numberInk(cell('2026-09-20')),
    saturdayInk: numberInk(cell('2026-09-19')),
    mondayInk: numberInk(cell('2026-09-21')),
    weekdayInk: numberInk(cell('2026-09-17')),
    holidaySurface: getComputedStyle(cell('2026-09-25')).backgroundColor,
    plainSurface: getComputedStyle(cell('2026-09-17')).backgroundColor,
    cellHeight: Math.round(cell('2026-09-17').getBoundingClientRect().height),
    // Column position of the 1st, which is what the user actually sees move.
    firstOfMonthIndex: cells().findIndex(n => n.dataset.calendarDate === '2026-09-01'),
  });

  const openSettings = async () => {
    root.querySelector('.calendar-settings-backdrop')?.remove();
    root.querySelector('.calendar-settings-button').click();
    await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings dialog');
  };

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  result.initial = readGrid();

  // --- the settings controls themselves ------------------------------------
  await openSettings();
  const select = root.querySelector('.calendar-settings-select');
  const gridToggle = [...root.querySelectorAll('.calendar-settings-toggle-row')]
    .find(row => row.querySelector('strong')?.textContent === '격자선 표시')?.querySelector('input');
  if (!select) throw new Error('the 주 시작 요일 control is missing');
  if (!gridToggle) throw new Error('the 격자선 표시 switch is missing');
  result.controls = {
    options: [...select.options].map(o => ({value: o.value, label: o.textContent})),
    selectHeight: Math.round(select.getBoundingClientRect().height * 100) / 100,
    selectMinHeight: getComputedStyle(select).minHeight,
    selectAria: select.getAttribute('aria-label') || '',
    gridToggleChecked: gridToggle.checked,
    gridToggleAria: gridToggle.getAttribute('aria-label') || '',
    gridDescription: [...root.querySelectorAll('.calendar-settings-toggle-row')]
      .find(row => row.querySelector('strong')?.textContent === '격자선 표시')?.querySelector('small')?.textContent || '',
    dialogStillOpen: true,
  };

  // --- 격자선 off ------------------------------------------------------------
  gridToggle.checked = false;
  gridToggle.dispatchEvent(new Event('change', {bubbles: true}));
  await sleep(220);
  result.linesOff = readGrid();
  // The dialog must survive its own switch: a setting that closes the panel
  // makes you reopen it for the next one.
  result.linesOffDialogOpen = Boolean(root.querySelector('.calendar-settings-dialog'));

  // --- 주 시작 요일 = 월요일 -------------------------------------------------
  const select2 = root.querySelector('.calendar-settings-select');
  select2.value = '1';
  select2.dispatchEvent(new Event('change', {bubbles: true}));
  await sleep(260);
  result.mondayStart = readGrid();
  result.mondayDialogOpen = Boolean(root.querySelector('.calendar-settings-dialog'));

  // --- dark, with both settings changed ------------------------------------
  document.body.dataset.siteTheme = 'dark';
  await sleep(160);
  result.mondayDark = readGrid();
  result.darkSelectBg = getComputedStyle(root.querySelector('.calendar-settings-select')).backgroundColor;
  result.darkSelectInk = getComputedStyle(root.querySelector('.calendar-settings-select')).color;
  document.body.dataset.siteTheme = 'light';
  await sleep(120);

  // --- 새로고침해도 유지되는가 (the DoD item) --------------------------------
  result.stored = localStorage.getItem('lotbi.calendar.settings.v1');
  root.replaceChildren();
  await mount();
  await wait(() => root.querySelector('.calendar-month-grid'), 'remount grid');
  result.afterReload = readGrid();

  // --- 본체는 살아야 한다: a corrupt store still renders a month -------------
  localStorage.setItem('lotbi.calendar.settings.v1', '{"weekStart":');
  root.replaceChildren();
  await mount();
  await wait(() => root.querySelector('.calendar-month-grid'), 'corrupt-store grid');
  result.afterCorrupt = readGrid();

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
  if (!m) return null;
  return m[1].split(',').slice(0, 3).map(n => Number(n.trim()));
}
const distance = (a, b) => {
  const [x, y] = [channels(a), channels(b)];
  if (!x || !y) return Infinity;
  return x.reduce((sum, v, i) => sum + Math.abs(v - y[i]), 0);
};

// ---------------------------------------------------------------------------
// Static guards: the structure, so it cannot be unpicked rule by rule later.
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
if (/nth-child\(7n/.test(css)) {
  throw new Error('weekend colour must not go back to being positional -- with a Monday start :nth-child(7n) is 일, not 토');
}
for (const rule of [
  '.calendar-weekdays span[data-weekday="0"]',
  '.calendar-weekdays span[data-weekday="6"]',
  '.calendar-date-cell[data-current-month="true"][data-weekday="0"] .calendar-date-number',
  '.calendar-date-cell[data-current-month="true"][data-weekday="6"] .calendar-date-number',
  '.calendar-month-grid[data-grid-lines="false"]',
]) {
  if (!css.includes(rule)) throw new Error(`missing rule: ${rule}`);
}
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
if (!manager.includes("cellNode.dataset.weekday = String(cell.weekday);")) {
  throw new Error('every date cell must publish its real weekday');
}
if (!manager.includes('격자선 표시') || !manager.includes('주 시작 요일')) {
  throw new Error('both approved settings must be on screen');
}
// 보류 목록을 슬쩍 되살리지 않는다. 주 보기는 이제 제품의 primary view라서
// 예전의 "주간 보기 보류" 조건에는 포함되지 않는다.
for (const held of ['음력', '할 일', '24시간', '외부 캘린더']) {
  if (manager.includes(held)) throw new Error(`held setting must not appear: ${held}`);
}
if (!manager.includes("['week', '주']")) throw new Error('Week must remain a primary Calendar view');

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const results = [[360, 900], [1280, 900]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;

    // --- shipped default is unchanged --------------------------------------
    assert.equal(v.initial.weekStart, '0', `${where}: the Calendar must still open on Sunday by default`);
    assert.equal(v.initial.gridLines, 'true', `${where}: the grid lines must still be on by default`);
    assert.deepEqual(v.initial.headings, ['일', '월', '화', '수', '목', '금', '토'], `${where}: default headings`);
    assert.equal(v.initial.firstCellDate, '2026-08-30', `${where}: default grid must lead with the Sunday`);
    if (parseFloat(v.initial.gap) < 1) throw new Error(`${where}: the default grid lost its 1px lines (${v.initial.gap})`);

    // --- 격자선 off actually removes the lines -----------------------------
    if (parseFloat(v.linesOff.gap) !== 0) throw new Error(`${where}: 격자선 off must close the gap, got ${v.linesOff.gap}`);
    if (distance(v.linesOff.gridBg, v.initial.gridBg) < 8) {
      throw new Error(`${where}: 격자선 off must stop painting the line colour (${v.linesOff.gridBg})`);
    }
    // The cells keep their own surfaces, so nothing becomes unreadable.
    if (distance(v.linesOff.plainSurface, v.initial.plainSurface) > 2) {
      throw new Error(`${where}: turning lines off must not repaint the cells`);
    }
    if (distance(v.linesOff.holidaySurface, v.linesOff.plainSurface) < 8) {
      throw new Error(`${where}: a holiday must still read as a day off with the lines off`);
    }
    if (!v.linesOffDialogOpen) throw new Error(`${where}: the settings panel must survive its own switch`);

    // --- 주 시작 요일 = 월요일 ----------------------------------------------
    assert.equal(v.mondayStart.weekStart, '1', `${where}: the grid must follow the setting`);
    assert.deepEqual(v.mondayStart.headings, ['월', '화', '수', '목', '금', '토', '일'], `${where}: Monday-start headings`);
    assert.deepEqual(v.mondayStart.headingWeekdays, ['1', '2', '3', '4', '5', '6', '0'], `${where}: headings must carry their weekday`);
    assert.equal(v.mondayStart.firstCellDate, '2026-08-31', `${where}: Monday-start grid must lead with the Monday`);
    assert.equal(v.mondayStart.firstCellWeekday, '1', `${where}`);
    if (v.mondayStart.firstOfMonthIndex === v.initial.firstOfMonthIndex) {
      throw new Error(`${where}: the 1st did not move column, so the setting did nothing visible`);
    }
    if (!v.mondayDialogOpen) throw new Error(`${where}: the settings panel must survive the week-start change`);

    // THE REGRESSION THIS WHOLE REFACTOR EXISTS FOR: on a Monday-start grid the
    // weekend hues must still be on 일 and 토 -- not on whatever now sits in the
    // first and last column.
    for (const [label, t] of [['light', v.mondayStart], ['dark', v.mondayDark]]) {
      const tag = `${where} monday-start ${label}`;
      if (distance(t.sundayInk, t.weekdayInk) < 12) throw new Error(`${tag}: Sunday lost its hue when the week started on Monday`);
      if (distance(t.saturdayInk, t.weekdayInk) < 12) throw new Error(`${tag}: Saturday lost its hue when the week started on Monday`);
      if (distance(t.mondayInk, t.weekdayInk) > 2) {
        throw new Error(`${tag}: Monday was painted as a weekend because it now sits in the first column (${t.mondayInk})`);
      }
      if (distance(t.holidaySurface, t.plainSurface) < 8) throw new Error(`${tag}: the holiday surface did not survive the week start`);
    }
    // The two hues stay distinguishable from each other in both themes.
    if (distance(v.mondayStart.sundayInk, v.mondayStart.saturdayInk) < 20) {
      throw new Error(`${where}: 일 and 토 must not collapse into one colour`);
    }

    // --- no layout damage ---------------------------------------------------
    assert.equal(v.mondayStart.cellCount % 7, 0, `${where}: whole weeks only`);
    if (Math.abs(v.mondayStart.cellHeight - v.linesOff.cellHeight) > 1) {
      throw new Error(`${where}: changing only the week start resized the cells (${v.linesOff.cellHeight} -> ${v.mondayStart.cellHeight})`);
    }

    // --- the controls -------------------------------------------------------
    assert.deepEqual(v.controls.options, [{value: '0', label: '일요일'}, {value: '1', label: '월요일'}], `${where}: week start options`);
    if (v.controls.selectHeight < 44) throw new Error(`${where}: the 주 시작 요일 control is under the 44px floor (${v.controls.selectHeight})`);
    assert.equal(v.controls.selectMinHeight, '44px', `${where}: the 44px floor must be declared, not incidental`);
    assert.equal(v.controls.selectAria, '주 시작 요일', `${where}`);
    assert.equal(v.controls.gridToggleAria, '격자선 표시', `${where}`);
    assert.equal(v.controls.gridToggleChecked, true, `${where}: the switch must open showing the state it is in`);
    // The copy has to match reality: the lines are already on, so this turns them off.
    if (!v.controls.gridDescription.includes('끄면')) {
      throw new Error(`${where}: the 격자선 copy must say what turning it OFF does, got: ${v.controls.gridDescription}`);
    }
    // Dark: the control must not stay a white box on a dark panel.
    if (distance(v.darkSelectBg, 'rgb(255, 255, 255)') < 60) {
      throw new Error(`${where}: the 주 시작 요일 control stayed light in the dark theme (${v.darkSelectBg})`);
    }

    // --- 새로고침해도 유지 (the approved DoD item) --------------------------
    const stored = JSON.parse(v.stored);
    assert.equal(stored.weekStart, 1, `${where}: the week start must be stored`);
    assert.equal(stored.showGridLines, false, `${where}: the grid-lines switch must be stored`);
    assert.equal(stored.showKoreaHolidays, true, `${where}: writing two settings must not erase the third`);
    assert.equal(v.afterReload.weekStart, '1', `${where}: the week start must survive a reload`);
    assert.equal(v.afterReload.gridLines, 'false', `${where}: the grid-lines setting must survive a reload`);
    assert.deepEqual(v.afterReload.headings, ['월', '화', '수', '목', '금', '토', '일'], `${where}: reloaded headings`);

    // --- 네가 실패해도 본체는 살아야 한다 ------------------------------------
    assert.equal(v.afterCorrupt.weekStart, '0', `${where}: a corrupt store must fall back to Sunday, not break`);
    assert.equal(v.afterCorrupt.gridLines, 'true', `${where}: a corrupt store must fall back to the shipped grid`);
    assert.equal(v.afterCorrupt.cellCount % 7, 0, `${where}: the Calendar must still render whole weeks on a corrupt store`);
  }
  console.log('CALENDAR SETTINGS EXPANSION PASS', JSON.stringify(results.map(v => ({
    at: `${v.viewport.width}x${v.viewport.height}`,
    defaultFirst: v.initial.firstCellDate,
    mondayFirst: v.mondayStart.firstCellDate,
    gapOn: v.initial.gap,
    gapOff: v.linesOff.gap,
    stored: v.stored,
  }))));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
