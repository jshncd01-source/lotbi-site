// Real-browser proof for the compact Month-cell lunar label ('음28' right of
// the solar day number): across phone, tablet and desktop widths, inside the
// real Calendar chat popup with weather glyphs, record dots, holidays, the
// today ring and 확인 필요 markers all present, the lunar text
//   - sits on the number's line (or, in a rare too-narrow cell, right under it),
//   - never leaves its cell (no clipping) and never overlaps the number, the
//     weather glyph, the record dots or the attention marker,
//   - and turning 음력 표시 on leaves every month cell exactly as tall as off.
// One Chrome launch measures every case: each width is its own iframe, so the
// page's media/container queries see that width.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-lunar-compact-layout-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-lunar-compact-layout-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4263;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The production stylesheet set, in index.html's order, so the popup's own
// sizing rules (site-consumer-design.css) shape the grid exactly as on the site.
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stylesheets = [...index.matchAll(/<link rel="stylesheet" href="([^"?]+)[^"]*"/g)]
  .map(match => `<link rel="stylesheet" href="/${match[1]}">`).join('\n');

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${stylesheets}
<style>body{margin:0}</style>
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal site-calendar-chat-popup" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = new URLSearchParams(location.search);
const lunarOn = q.get('lunar') === '1';
const nowIso = q.get('now');
const month = nowIso.slice(0, 8);
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: true, showLunarDates: lunarOn, weekStart: 0}));
  const ICON = {CLEAR: '\\u2600\\ufe0f', CLOUDY: '\\u2601\\ufe0f', RAIN: '\\u{1f327}\\ufe0f', SNOW: '\\u2744\\ufe0f'};
  const KINDS = ['CLEAR', 'CLOUDY', 'RAIN', 'CLOUDY', 'CLEAR', 'SNOW', 'CLOUDY', 'CLEAR', 'RAIN', 'CLEAR'];
  const base = Date.parse(nowIso.slice(0, 10) + 'T00:00:00Z');
  const WEATHER = KINDS.map((kind, i) => ({
    date: new Date(base + i * 86400000).toISOString().slice(0, 10), weather_kind: kind, weather_icon: ICON[kind],
    source: 'KMA_SHORT', issued_at: nowIso, temperature_c: 18, min_temperature_c: 11, max_temperature_c: 22, precipitation_probability: 30,
  }));
  const holiday = (date, name) => ({date, name, country: 'KR', holiday_type: 'NATIONAL', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'});
  const HOLIDAYS = [holiday(month + '03', '공휴일'), holiday(month + '09', '공휴일')];
  const id = (prefix, n) => prefix + String(n).padStart(32, '0');
  const event = (n, date) => ({
    projection_id: 'p' + n, activity_id: id('activity_', n), occurrence_id: id('occurrence_', n), title: '기록 ' + n,
    activity_revision: 1, occurrence_revision: 1, local_date: date, local_datetime: null, temporal_kind: 'DATE_ONLY',
    temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false,
    reminder_configured: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
    entry: {amount_minor: null, currency: 'KRW', expense_category: null, memo: null, place: null, merchant: null},
  });
  // Three-plus records on weather days (the widest dot row next to a glyph),
  // on today, and on the leap-month start when there is one.
  const EVENTS = [1, 2, 3, 4].map(n => event(n, month + '10')).concat([5, 6, 7].map(n => event(n, nowIso.slice(0, 10))), [8, 9, 10].map(n => event(n, month + '23')), [event(11, month + '28')]);
  const attention = (n, date) => ({projection_id: 'a' + n, activity_id: id('activity_', 90 + n), occurrence_id: id('occurrence_', 90 + n), title: '기한', due_date: date, state: 'UPCOMING', days_until_due: 2, confirmation_level: 'USER_ATTESTED', provider_verified: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE']});
  const ATTENTION = [attention(1, month + '10'), attention(2, nowIso.slice(0, 10)), attention(3, month + '23')];
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: nowIso, timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: ATTENTION, ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: true, items: WEATHER, ai_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', ai_calls: 0, provider_api_calls: 0, currency: 'KRW', total_minor: 0, categories: []});
    if (u.pathname.includes('/holidays')) return j({year: Number(nowIso.slice(0, 4)), country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [Number(nowIso.slice(0, 4))], items: HOLIDAYS, ai_calls: 0, provider_api_calls: 0});
    return j({view: 'AGENDA', as_of: nowIso, timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: EVENTS, ai_calls: 0, provider_api_calls: 0});
  };
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({sessionToken: 'site-token', root, initialView: 'month', timezone: 'Asia/Seoul', now: new Date(nowIso), locationProvider: null, locationPermissions: null});
  const ready = () => root.querySelector('.calendar-month-grid .calendar-weather-summary')
    && root.querySelector('.calendar-record-dot') && root.querySelector('.calendar-attention-marker')
    && (!lunarOn || root.querySelector('.calendar-date-lunar'));
  for (let i = 0; i < 300 && !ready(); i += 1) await sleep(20);
  if (!ready()) throw new Error('calendar data never rendered');
  await sleep(150);

  const rect = node => node.getBoundingClientRect();
  const shown = node => node && getComputedStyle(node).display !== 'none' && rect(node).width > 0;
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const result = {ok: true, width: innerWidth, heights: {}, labels: {}, problems: [], wrapped: [], sameLine: 0, lunarCells: 0};
  for (const cell of root.querySelectorAll('.calendar-month-grid .calendar-date-cell')) {
    const date = cell.dataset.calendarDate;
    const box = rect(cell);
    result.heights[date] = Math.round(box.height * 10) / 10;
    const inside = r => r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
    const number = rect(cell.querySelector('.calendar-date-number'));
    if (!inside(number)) result.problems.push(date + ' number leaves its cell');
    const others = {
      weather: [...cell.querySelectorAll('.calendar-weather-summary > *')].filter(shown).map(rect),
      dots: [...cell.querySelectorAll('.calendar-record-dot')].filter(shown).map(rect),
      attention: [...cell.querySelectorAll('.calendar-attention-marker')].filter(shown).map(rect),
    };
    for (const glyph of others.weather) {
      if (!inside(glyph)) result.problems.push(date + ' weather glyph leaves its cell');
      if (hit(glyph, number)) result.problems.push(date + ' weather glyph over the number');
      for (const other of [...others.dots, ...others.attention]) if (hit(glyph, other)) result.problems.push(date + ' weather glyph over a dot/marker');
    }
    const lunarNode = cell.querySelector('.calendar-date-lunar');
    if (!lunarNode) continue;
    result.lunarCells += 1;
    result.labels[date] = lunarNode.textContent;
    const lunar = rect(lunarNode);
    if (!inside(lunar)) result.problems.push(date + ' lunar ' + lunarNode.textContent + ' leaves its cell');
    if (hit(lunar, number)) result.problems.push(date + ' lunar over the number');
    for (const [name, list] of Object.entries(others)) for (const other of list) if (hit(lunar, other)) result.problems.push(date + ' lunar over ' + name);
    if (lunar.left >= number.right - 0.5 && lunar.top < number.bottom) result.sameLine += 1;
    else if (lunar.top >= number.bottom - 2) result.wrapped.push(date + ' ' + lunarNode.textContent);
    else result.problems.push(date + ' lunar is neither right of nor under the number');
    const size = parseFloat(getComputedStyle(lunarNode).fontSize);
    if (size < 9 || size > 10) result.problems.push(date + ' lunar font ' + size + 'px');
  }
  out.textContent = JSON.stringify(result);
} catch (error) {
  out.textContent = JSON.stringify({ok: false, error: String(error?.stack || error), width: innerWidth});
}
</script></body></html>`;

// [viewport width, height, the month's "now"]. 2026-10: an ordinary month
// (음9.1 on a two-digit date). 2027-12: 음11.1/음12.1 month starts, today on
// one. 2028-06: a leap month starts (음윤5.1) three days after today.
const WIDTHS = [[320, 700], [344, 780], [360, 800], [375, 812], [390, 844], [412, 915], [600, 900], [700, 900], [768, 1024], [1024, 900], [1280, 900]];
const MONTHS = ['2026-10-08T01:00:00Z', '2027-12-28T01:00:00Z', '2028-06-20T01:00:00Z'];
const CASES = [];
for (const [w, h] of WIDTHS) for (const now of MONTHS) for (const lunar of ['0', '1']) CASES.push({w, h, now, lunar});

function wrapperMarkup() {
  return `<!doctype html><html><body style="margin:0"><div id="host"></div><pre id="result">pending</pre><script>
  const cases = ${JSON.stringify(CASES)};
  const host = document.getElementById('host'), out = document.getElementById('result');
  const results = [];
  (async () => {
    for (const c of cases) {
      const frame = document.createElement('iframe');
      frame.width = c.w; frame.height = c.h; frame.style.cssText = 'display:block;border:0';
      frame.src = '/${INNER_REL}?lunar=' + c.lunar + '&now=' + encodeURIComponent(c.now);
      host.replaceChildren(frame);
      let value = null;
      for (let i = 0; i < 600 && !value; i += 1) {
        await new Promise(r => setTimeout(r, 25));
        try { const node = frame.contentDocument?.getElementById('calendar-result'); if (node && node.textContent !== 'pending') value = JSON.parse(node.textContent); } catch (e) { value = {ok: false, error: String(e)}; }
      }
      results.push({...c, ...(value || {ok: false, error: 'case timeout'})});
    }
    out.textContent = JSON.stringify(results);
  })();
  <\/script></body></html>`;
}

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  throw new Error('server start');
}

function run(browser) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1200', '--force-device-scale-factor=1',
    '--virtual-time-budget=240000', '--dump-dom', `${ORIGIN}/${WRAPPER_REL}`,
  ], {encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="result">';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf('</pre>', i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  if (raw === 'pending') throw new Error('wrapper never finished');
  return JSON.parse(raw);
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const results = run(browser);
  const failures = [];
  const summary = [];
  let preexistingOff = 0;
  for (const [w] of WIDTHS) {
    for (const now of MONTHS) {
      const off = results.find(c => c.w === w && c.now === now && c.lunar === '0');
      const on = results.find(c => c.w === w && c.now === now && c.lunar === '1');
      const tag = `${w}px ${now.slice(0, 7)}`;
      if (!off?.ok || !on?.ok) { failures.push(`${tag}: ${(off?.ok ? on : off)?.error}`); continue; }
      if (on.lunarCells === 0) failures.push(`${tag}: no lunar labels rendered`);
      for (const problem of on.problems) failures.push(`${tag}: ${problem}`);
      // 음력을 끈 화면은 이 작업이 바꾸지 않았다(높이 비교만 한다). 그 화면의
      // 기존 겹침은 참고로만 센다.
      preexistingOff += off.problems.length;
      for (const [date, height] of Object.entries(off.heights)) {
        if (Math.abs((on.heights[date] ?? -1) - height) > 0.5) failures.push(`${tag}: ${date} cell is ${on.heights[date]}px with 음력 on, ${height}px off`);
      }
      // Above the narrow-phone breakpoint the label must be on the number's
      // line in all but the rare long month-start labels.
      if (w >= 360 && on.wrapped.some(entry => !/\.1$/.test(entry))) failures.push(`${tag}: ordinary labels dropped under the number: ${on.wrapped.join(', ')}`);
      summary.push(`${tag} sameLine=${on.sameLine}/${on.lunarCells} wrapped=${on.wrapped.length}`);
    }
  }
  const oct = results.find(c => c.w === 1280 && c.now.startsWith('2026-10') && c.lunar === '1');
  if (oct?.labels?.['2026-10-08'] !== '음28') failures.push(`2026-10-08 must read 음28, got ${oct?.labels?.['2026-10-08']}`);
  if (oct?.labels?.['2026-10-11'] !== '음9.1') failures.push(`2026-10-11 (음력 9/1) must read 음9.1, got ${oct?.labels?.['2026-10-11']}`);
  const leap = results.find(c => c.w === 1280 && c.now.startsWith('2028-06') && c.lunar === '1');
  if (leap?.labels?.['2028-06-23'] !== '음윤5.1') failures.push(`2028-06-23 (윤5월 1일) must read 음윤5.1, got ${leap?.labels?.['2028-06-23']}`);
  if (failures.length) throw new Error(`CALENDAR LUNAR COMPACT LAYOUT FAIL\n${failures.join('\n')}`);
  console.log('CALENDAR LUNAR COMPACT LAYOUT PASS', summary.join(' | '), `| 음력 끔 화면의 기존 겹침(참고)=${preexistingOff}`);
} finally {
  server.kill('SIGTERM');
  try { fs.rmSync(INNER, {force: true}); } catch {}
  try { fs.rmSync(WRAPPER, {force: true}); } catch {}
}
