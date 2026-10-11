// CALENDAR-MONTH-TEMPERATURE-01 — the month grid shows each forecast day's
// min/max temperature, not only the weather glyph.
//
// Owner report: "월 캘린더에 온도가 안 나온다". Core was fine (the public and
// signed-in weather endpoints return min/max per day, and the Site already
// clamps the month request to today..today+14, inside Core's 15-day window).
// The temperature was rendered and then hidden by CSS at every width under
// ~900px: phones (<=600px) and narrow tablets (month grid < 680px) showed the
// glyph alone.
//
// Locked here, signed-in (/v2/life/weather) and guest (/v2/life/weather/public),
// light and dark, lunar dates on and off, 351-1280px, plus wide-font passes
// (DejaVu/Verdana, the Linux gate's wider metrics) at every width:
//   - every weather request stays inside today..today+14 (<=15 days), so no
//     month ever asks Core for a window it refuses
//   - each forecast cell shows its min and max as visible text (>=9px)
//   - that text stays inside the cell and clear of the date, lunar label,
//     glyph, record dots, 확인 필요 marker and record titles
//   - min and max each keep >=4.5:1 contrast on the cell behind them
//   - the forecast does not change the row height
//   - days with no forecast (past, beyond the horizon) show no weather at all
//   - the month's 가계부 line (here 0원) and its five 0원 slots stay visible
//     above the grid, on screen (CALENDAR-MONTH-EXPENSE-RESTORE-01)
// Normal blanks: widths <=350px (the forecast stays in the day panel), lunar
// dates at <=357px, and on a phone or narrow tablet grid the lunar
// month-start cell (음9.1): a wrapped lunar label takes that line there.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = process.env.CALENDAR_RENDER_ROOT
  ? path.resolve(process.env.CALENDAR_RENDER_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'validate_calendar_month_temperature_01';
const BASELINE_CAPTURE = process.env.CALENDAR_BASELINE_CAPTURE === '1';

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required');
}

const STYLESHEETS = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .matchAll(/<link rel="stylesheet" href="([^"?]+)\?v=[^"]*"/g)].map(match => match[1]);
if (!STYLESHEETS.includes('site-calendar.css')) throw new Error('index.html no longer links site-calendar.css');

const INNER = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${STYLESHEETS.map(href => `<link rel="stylesheet" href="/${href}">`).join('\n')}
</head><body class="chat-home-page site-overlay-open">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal site-calendar-chat-popup" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2><button class="site-modal-close" type="button" aria-label="캘린더 닫기">×</button></header>
<p class="site-modal-description">일정과 생활 기록을 한눈에 관리하세요.</p>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="cmt-result" hidden>pending</pre>
<script type="module">
const out = document.getElementById('cmt-result');
const q = new URLSearchParams(location.search);
const AUTH = q.get('auth') === '1', LUNAR = q.get('lunar') === '1', COLD = q.get('fix') === 'cold', FINAL = q.get('final') || '';
const TODAY = FINAL ? '2026-10-11' : (COLD ? '2027-01-05' : '2026-10-10');
document.body.dataset.siteTheme = q.get('theme') || 'light';
document.body.dataset.siteAuthState = AUTH ? 'authenticated' : 'guest';
if (q.get('font') === 'wide') {
  const style = document.createElement('style');
  style.textContent = "body, body * { font-family: 'DejaVu Sans', Verdana, 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif !important; }";
  document.head.appendChild(style);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = (date, kind, icon, min, max, pop = null, t = null) => ({date, weather_kind: kind, weather_icon: icon, source: 'KMA_SHORT',
  issued_at: '2026-10-09T23:00:00Z', temperature_c: t, min_temperature_c: min, max_temperature_c: max, precipitation_probability: pop, freshness: 'CACHE_VALID'});
// Past and beyond-horizon days are in the fixture on purpose: a correct
// request never reaches them, so they must stay blank on screen.
const FIX = COLD ? [
  W('2027-01-02', 'CLEAR', '☀️', -20, -11),
  W('2027-01-06', 'SNOW', '❄️', -12, -3, 80), W('2027-01-07', 'CLEAR', '☀️', -15, -8), W('2027-01-09', 'CLOUDY', '☁️', -9, 1),
  W('2027-01-10', 'CLEAR', '☀️', -10, 2), W('2027-01-11', 'RAIN', '🌧️', 0, 5, 60),
] : [
  W('2026-10-05', 'CLEAR', '☀️', 10, 20),
  W('2026-10-10', 'CLOUDY', '☁️', 18, 27), W('2026-10-11', 'CLEAR', '☀️', 16, 26, null, 21), W('2026-10-12', 'RAIN', '🌧️', 17, 22, 70),
  W('2026-10-13', 'CLOUDY', '☁️', 15, 23, 30), W('2026-10-14', 'CLEAR', '☀️', 12, 24), W('2026-10-15', 'CLEAR', '☀️', 11, 23),
  W('2026-10-16', 'CLOUDY', '☁️', 13, 21), W('2026-10-17', 'RAIN', '🌧️', 14, 19, 60), W('2026-10-18', 'CLEAR', '☀️', 9, 20),
  W('2026-10-19', 'CLEAR', '☀️', 8, 19), W('2026-10-20', 'CLOUDY', '☁️', null, null, null, 17),
  W('2026-10-30', 'RAIN', '🌧️', 7, 15, 40),
];
const pad = n => String(n).padStart(32, '0');
const event = (n, date, extra = {}) => ({projection_id: 'p' + n, activity_id: 'activity_' + pad(n), occurrence_id: 'occurrence_' + pad(n), title: extra.title || ('기록 ' + n + ' 점심 약속'),
  activity_revision: 1, occurrence_revision: 1, local_date: date, local_datetime: extra.time ? date + 'T' + extra.time + ':00' : null, temporal_kind: extra.time ? 'DATE_TIME' : 'DATE_ONLY', temporal_semantics: 'USER_PLANNED_TIME',
  busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, reminder_configured: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
  entry: {amount_minor: extra.amount ?? null, currency: 'KRW', expense_category: extra.category || null, memo: null, place: null, merchant: null}});
const FINAL_SEED = [
  ['09:00', '아침 식사', 'FOOD', 18000], ['11:00', '생활용품 쇼핑', 'SHOPPING', 42000],
  ['13:00', '가족 점심', 'FOOD', 32000], ['15:00', '카페 약속', 'FOOD', 12000],
  ['17:00', '마트 장보기', 'LIVING', 56000], ['19:00', '저녁 식사', 'FOOD', 48000],
];
const RECORD_DATES = FINAL ? (FINAL === 'populated' ? FINAL_SEED.map(() => TODAY) : []) : (COLD ? ['2027-01-07', '2027-01-07', '2027-01-07', '2027-01-10']
  : ['2026-10-10', '2026-10-10', '2026-10-12', '2026-10-12', '2026-10-12', '2026-10-14', '2026-10-17', '2026-10-17', '2026-10-17']);
const EVENTS = RECORD_DATES.map((date, i) => FINAL ? event(i + 1, date, {time: FINAL_SEED[i][0], title: FINAL_SEED[i][1], category: FINAL_SEED[i][2], amount: FINAL_SEED[i][3]}) : event(i + 1, date));
const attention = (n, date) => ({projection_id: 'a' + n, activity_id: 'activity_' + pad(90 + n), occurrence_id: 'occurrence_' + pad(90 + n), title: '기한', due_date: date,
  state: 'UPCOMING', days_until_due: 2, confirmation_level: 'USER_ATTESTED', provider_verified: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE']});
const ATTENTION = FINAL ? [] : (COLD ? [attention(1, '2027-01-07')] : [attention(1, '2026-10-12'), attention(2, '2026-10-15')]);
const requests = [];
const j = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
const fetchImpl = url => {
  const u = new URL(String(url), location.origin);
  if (u.pathname === '/v2/life/weather' || u.pathname === '/v2/life/weather/public') {
    const s = u.searchParams.get('start'), e = u.searchParams.get('end');
    requests.push({path: u.pathname, start: s, end: e});
    // Core's own rule: at most 15 inclusive days.
    if ((Date.parse(e) - Date.parse(s)) / 86400000 + 1 > 15) return j({detail: {code: 'WEATHER_DATE_WINDOW_INVALID', message: 'maximum 15-day inclusive window'}}, 400);
    return j({provider_ready: true, items: FIX.filter(i => i.date >= s && i.date <= e), ai_calls: 0});
  }
  const asOf = TODAY + 'T00:00:00+00:00';
  if (u.pathname === '/v2/life/expense-summary') return j({view: 'EXPENSE_SUMMARY', as_of: asOf, timezone: 'Asia/Seoul', start_date: u.searchParams.get('start'), end_date: u.searchParams.get('end'), coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY', currencies: FINAL === 'populated' ? [{currency: 'KRW', categories: [
    {expense_category: 'FOOD', amount_minor: 310000, entry_count: 5}, {expense_category: 'TRAVEL', amount_minor: 80000, entry_count: 1},
    {expense_category: 'SHOPPING', amount_minor: 112000, entry_count: 2}, {expense_category: 'LIVING', amount_minor: 96000, entry_count: 2},
    {expense_category: 'OTHER', amount_minor: 30000, entry_count: 1}], total_amount_minor: 628000, entry_count: 11}] : [], entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0});
  if (u.pathname === '/v2/life/agenda') return j({view: 'AGENDA', as_of: asOf, timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: EVENTS, ai_calls: 0, provider_api_calls: 0});
  if (u.pathname === '/v2/life/attention') return j({view: 'ATTENTION', as_of: asOf, timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: ATTENTION, ai_calls: 0, provider_api_calls: 0});
  if (u.pathname.includes('/holidays')) return j({year: Number(TODAY.slice(0, 4)), country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026, 2027], items: [], ai_calls: 0, provider_api_calls: 0});
  return j({items: []});
};
globalThis.fetch = fetchImpl;

const rgba = text => { const m = String(text).match(/rgba?\\(([^)]+)\\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
function backgroundBehind(node) {
  const chain = [];
  for (let n = node; n; n = n.parentElement) chain.push(rgba(getComputedStyle(n).backgroundColor));
  let color = [255, 255, 255];
  for (const [r, g, b, a] of chain.reverse()) color = [r * a + color[0] * (1 - a), g * a + color[1] * (1 - a), b * a + color[2] * (1 - a)];
  return color;
}
const contrast = node => { const fg = rgba(getComputedStyle(node).color), bg = backgroundBehind(node); const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const box = n => { if (!n) return null; const b = n.getBoundingClientRect(); return {left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height}; };
const shown = n => n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().width > 0;

try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false, showLunarDates: LUNAR}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {getCurrentPosition: (_o, err) => err && err({code: 1}), watchPosition: () => 0, clearWatch() {}}});
  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  const opts = {root, initialView: 'month', timezone: 'Asia/Seoul', now: () => new Date(TODAY + 'T12:00:00+09:00'), fetchImpl,
    weatherLocation: {latitude: 37.5665, longitude: 126.978, source: 'MANUAL_REGION', label: '서울'}, locationProvider: null, locationPermissions: null,
    settingsStorage: {getItem: () => JSON.stringify({showKoreaHolidays: false, showLunarDates: LUNAR}), setItem() {}}};
  if (AUTH) opts.sessionToken = 'tok_month_temperature';
  else {
    const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
    const repo = createGuestCalendarRepository(localStorage);
    // A guest may create three records (GUEST_CREATE_QUOTA): the three-dot day.
    for (const date of RECORD_DATES.slice(-3)) repo.create({title: '기록 점심 약속', local_date: date});
    opts.guestRepository = repo;
  }
  await mountLifeCalendarManager(opts);
  const want = FIX.filter(i => i.date >= TODAY).length - (COLD ? 0 : 1);
  for (let i = 0; i < 400 && root.querySelectorAll('.calendar-month-grid .calendar-weather-icon').length < want; i += 1) await sleep(25);
  for (let i = 0; i < 400 && root.querySelector('[data-calendar-amount-summary]')?.dataset.calendarAmountSummary !== 'ready'; i += 1) await sleep(25);
  if (FINAL === 'populated') for (let i = 0; i < 400 && root.querySelectorAll('.calendar-day-event.calendar-life-row').length < 6; i += 1) await sleep(25);
  await sleep(300);
  const cells = [...root.querySelectorAll('.calendar-month-grid .calendar-date-cell')].map(cell => {
    const temp = cell.querySelector('.calendar-weather-temperature');
    const parts = temp ? [...temp.children].filter(shown).map(s => ({cls: s.className, text: s.textContent, box: box(s), fontSize: parseFloat(getComputedStyle(s).fontSize), contrast: contrast(s)})) : [];
    const others = [...cell.querySelectorAll('.calendar-event-stack *, .calendar-attention-marker, .calendar-record-dot, .calendar-holiday-label, .calendar-mobile-event-count, .calendar-event-overflow')]
      .filter(n => shown(n) && !(temp && n.contains(temp))).map(n => ({cls: String(n.className), box: box(n)}));
    return {
      date: cell.dataset.calendarDate, row: Math.round(cell.getBoundingClientRect().top), height: cell.getBoundingClientRect().height,
      lunarKind: cell.querySelector('.calendar-date-line')?.dataset.lunarKind || '',
      hasSummary: Boolean(cell.querySelector('.calendar-weather-summary')), cell: box(cell),
      tempShown: shown(temp), tempText: temp && shown(temp) ? temp.innerText.replace(/\\s+/g, '') : '', temp: shown(temp) ? box(temp) : null, parts,
      number: box(cell.querySelector('.calendar-date-number')), lunar: shown(cell.querySelector('.calendar-date-lunar')) ? box(cell.querySelector('.calendar-date-lunar')) : null,
      glyph: shown(cell.querySelector('.calendar-weather-icon')) ? box(cell.querySelector('.calendar-weather-icon')) : null, others,
    };
  });
  const gridWidth = root.querySelector('.calendar-month-grid')?.clientWidth || 0;
  const amountLine = root.querySelector('[data-calendar-amount-summary]');
  const amount = {
    state: amountLine?.dataset.calendarAmountSummary || 'absent', shown: shown(amountLine),
    label: amountLine?.querySelector('.calendar-amount-line-label')?.textContent || '',
    total: amountLine?.querySelector('.calendar-amount-line-amount')?.textContent || '',
    box: shown(amountLine) ? box(amountLine) : null, grid: box(root.querySelector('.calendar-month-grid')),
    slots: [...root.querySelectorAll('.calendar-amount-category')].filter(shown).map(n => [n.dataset.expenseCategory, n.querySelector('dd')?.textContent || '', box(n)]),
  };
  const selectedCell = root.querySelector('[data-calendar-date="' + TODAY + '"]');
  const panel = root.querySelector('.calendar-day-panel');
  const finalState = FINAL ? {
    kind: FINAL,
    heading: panel?.querySelector('.calendar-day-heading')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    lunar: panel?.querySelector('.calendar-day-lunar')?.textContent?.trim() || '',
    weather: panel?.querySelector('.calendar-day-weather-card')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    empty: panel?.querySelector('.calendar-day-empty')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    visibleChips: [...(selectedCell?.querySelectorAll('.calendar-event-chip') || [])].filter(shown).length,
    overflow: selectedCell?.querySelector('.calendar-event-overflow')?.textContent?.trim() || '',
    cell: box(selectedCell),
    overflowBox: shown(selectedCell?.querySelector('.calendar-event-overflow')) ? box(selectedCell.querySelector('.calendar-event-overflow')) : null,
    cellAmount: selectedCell?.querySelector('.calendar-cell-day-amount')?.textContent?.trim() || '',
    cellAmountBox: shown(selectedCell?.querySelector('.calendar-cell-day-amount')) ? box(selectedCell.querySelector('.calendar-cell-day-amount')) : null,
    rows: [...(panel?.querySelectorAll('.calendar-day-event.calendar-life-row') || [])].map(row => ({
      time: row.querySelector('time')?.textContent?.trim() || '', title: row.querySelector('.calendar-life-title')?.textContent?.trim() || '',
      category: row.querySelector('.calendar-life-category')?.textContent?.trim() || '', amount: row.querySelector('.calendar-life-amount')?.textContent?.trim() || '',
    })),
    dailyLabel: panel?.querySelector('.calendar-day-expense-label')?.textContent?.trim() || '',
    dailyAmount: panel?.querySelector('.calendar-day-expense-value')?.textContent?.trim() || '',
    categoryAmountsClipped: [...(panel?.querySelectorAll('.calendar-amount-category dd') || [])].some(node => node.scrollWidth > node.clientWidth + 1),
    panelOverflow: panel ? getComputedStyle(panel.querySelector('.calendar-day-body')).overflowY : '',
    topAdd: document.querySelector('.calendar-modal-actions .calendar-primary-add-button')?.textContent?.trim() || '',
    settings: document.querySelector('.calendar-modal-actions .calendar-settings-button')?.getAttribute('aria-label') || '',
    close: document.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    modes: [...root.querySelectorAll('.calendar-mode-tab')].map(node => node.textContent.trim()),
    noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1,
  } : null;
  if (FINAL) {
    const settingsButton = document.querySelector('.calendar-modal-actions .calendar-settings-button');
    settingsButton?.click();
    for (let i = 0; i < 100 && !root.querySelector('.calendar-settings-dialog'); i += 1) await sleep(20);
    finalState.settingsOpened = Boolean(root.querySelector('.calendar-settings-dialog'));
    root.querySelector('.calendar-settings-close')?.click();
    const addButton = document.querySelector('.calendar-modal-actions .calendar-primary-add-button');
    addButton?.click();
    for (let i = 0; i < 100 && !root.querySelector('.calendar-editor-dialog'); i += 1) await sleep(20);
    finalState.addOpened = Boolean(root.querySelector('.calendar-editor-dialog'));
    root.querySelector('.calendar-editor-cancel')?.click();
    for (let i = 0; i < 100 && root.querySelector('.calendar-editor-dialog'); i += 1) await sleep(20);
    for (const mode of ['week', 'agenda', 'month']) {
      root.querySelector('[data-calendar-mode="' + mode + '"]')?.click();
      for (let i = 0; i < 200 && root.dataset.calendarManagerView !== mode; i += 1) await sleep(20);
    }
    finalState.viewSwitchReturnedToMonth = root.dataset.calendarManagerView === 'month';
  }
  out.textContent = JSON.stringify({ok: true, width: innerWidth, gridWidth, today: TODAY, requests, fixture: FIX, cells, amount, finalState});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e), requests}); }
</script></body></html>`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

// [label, width, query]. Phones first (the report), then the tablet widths
// that also hid the temperature, then desk widths that must not regress.
const ALL_CASES = [
  ['351-auth', 351, 'auth=1'],
  ['360-guest', 360, 'auth=0'],
  ['360-auth-dark', 360, 'auth=1&theme=dark'],
  ['360-auth-lunar', 360, 'auth=1&lunar=1'],
  ['360-guest-lunar-dark', 360, 'auth=0&lunar=1&theme=dark'],
  ['360-auth-cold', 360, 'auth=1&fix=cold'],
  ['360-auth-lunar-wide', 360, 'auth=1&lunar=1&font=wide'],
  ['360-auth-cold-wide', 360, 'auth=1&fix=cold&font=wide'],
  ['375-auth-wide', 375, 'auth=1&font=wide'],
  ['375-auth-cold-wide', 375, 'auth=1&fix=cold&font=wide'],
  ['412-guest-lunar', 412, 'auth=0&lunar=1'],
  ['600-auth-dark', 600, 'auth=1&theme=dark'],
  ['610-auth', 610, 'auth=1'],
  ['610-auth-wide', 610, 'auth=1&font=wide'],
  ['610-auth-lunar-dark', 610, 'auth=1&lunar=1&theme=dark'],
  ['610-auth-cold-wide', 610, 'auth=1&fix=cold&font=wide'],
  ['700-auth-lunar', 700, 'auth=1&lunar=1'],
  ['700-auth-lunar-wide', 700, 'auth=1&lunar=1&font=wide'],
  ['768-auth-dark', 768, 'auth=1&theme=dark'],
  ['768-guest-lunar', 768, 'auth=0&lunar=1'],
  ['1024-auth', 1024, 'auth=1'],
  ['1280-auth-lunar-dark', 1280, 'auth=1&lunar=1&theme=dark'],
  // Wide fonts with lunar dates at every width: the gate's Linux fonts made
  // the 610px lunar label reach under the glyph (SITE-T52 return).
  ['375-guest-lunar-dark-wide', 375, 'auth=0&lunar=1&theme=dark&font=wide'],
  ['412-auth-lunar-wide', 412, 'auth=1&lunar=1&font=wide'],
  ['600-auth-lunar-wide', 600, 'auth=1&lunar=1&font=wide'],
  ['610-auth-lunar-wide', 610, 'auth=1&lunar=1&font=wide'],
  ['610-auth-lunar-dark-wide', 610, 'auth=1&lunar=1&theme=dark&font=wide'],
  ['610-guest-lunar-cold-wide', 610, 'auth=0&lunar=1&fix=cold&font=wide'],
  ['650-auth-lunar-wide', 650, 'auth=1&lunar=1&font=wide'],
  ['768-auth-lunar-wide', 768, 'auth=1&lunar=1&font=wide'],
  ['768-auth-wide', 768, 'auth=1&font=wide'],
  ['1024-auth-lunar-wide', 1024, 'auth=1&lunar=1&font=wide'],
  ['1280-auth-wide', 1280, 'auth=1&font=wide'],
  ['final-empty-pc-light', 1280, 'auth=1&lunar=1&final=empty', 900],
  ['final-empty-pc-dark', 1280, 'auth=1&lunar=1&final=empty&theme=dark', 900],
  ['final-populated-pc-light', 1280, 'auth=1&lunar=1&final=populated', 900],
  ['final-populated-pc-dark', 1280, 'auth=1&lunar=1&final=populated&theme=dark', 900],
  ['final-empty-mobile-light', 360, 'auth=1&lunar=1&final=empty', 780],
  ['final-empty-mobile-dark', 360, 'auth=1&lunar=1&final=empty&theme=dark', 780],
  ['final-populated-mobile-light', 360, 'auth=1&lunar=1&final=populated', 780],
  ['final-populated-mobile-dark', 360, 'auth=1&lunar=1&final=populated&theme=dark', 780],
];
const CASES = BASELINE_CAPTURE ? ALL_CASES.filter(([label]) => label.startsWith('final-')) : ALL_CASES;

const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const hit = (a, b) => a && b && a.width > 0 && b.width > 0 && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const inside = (a, c) => Boolean(a && c && a.left >= c.left - 0.5 && a.right <= c.right + 0.5 && a.top >= c.top - 0.5 && a.bottom <= c.bottom + 0.5);

function check(label, width, query, value) {
  const problems = [];
  const lunar = query.includes('lunar=1');
  const auth = query.includes('auth=1');
  const final = query.includes('final=');
  const populated = query.includes('final=populated');
  const horizon = addDays(value.today, 14);
  if (!value.requests.length) problems.push('no weather request was made');
  for (const request of value.requests) {
    if (request.path !== (auth ? '/v2/life/weather' : '/v2/life/weather/public')) problems.push(`wrong weather endpoint ${request.path}`);
    if (request.start < value.today || request.end > horizon) problems.push(`request ${request.start}..${request.end} leaves today..today+14`);
  }
  const gridHidden = width <= 350 || (lunar && width <= 357);
  const forecast = new Map(value.fixture.filter(item => item.date >= value.today && item.date <= horizon).map(item => [item.date, item]));
  let shownCount = 0;
  for (const cell of value.cells) {
    const item = forecast.get(cell.date);
    if (!item) {
      if (cell.hasSummary) problems.push(`${cell.date} has weather with no forecast for it (past or beyond the horizon)`);
      continue;
    }
    if (!cell.glyph && width > 350) problems.push(`${cell.date} lost its weather glyph`);
    // A lunar month start (음9.1) may fold under the date on a phone or a
    // narrow tablet grid (<680px) and take the temperature's line: that one
    // cell keeps the glyph alone.
    const narrowGrid = width <= 600 || value.gridWidth < 680;
    const expectHidden = gridHidden || (lunar && narrowGrid && cell.lunarKind === 'month-start');
    if (expectHidden) {
      if (cell.tempShown) problems.push(`${cell.date} shows a temperature where the cell has no room for it`);
      continue;
    }
    if (!cell.tempShown) { problems.push(`${cell.date} hides its temperature`); continue; }
    shownCount += 1;
    const expected = Number.isFinite(item.min_temperature_c) ? [`${item.min_temperature_c}°`, `${item.max_temperature_c}°`] : [`${item.temperature_c}°`];
    for (const text of expected) if (!cell.tempText.includes(text)) problems.push(`${cell.date} temperature "${cell.tempText}" lacks ${text}`);
    for (const part of cell.parts) {
      if (part.cls.includes('separator')) continue;
      if (part.fontSize < 9) problems.push(`${cell.date} ${part.cls} is ${part.fontSize}px (<9px)`);
      if (part.contrast < 4.5) problems.push(`${cell.date} ${part.cls} contrast ${part.contrast.toFixed(2)}:1 (<4.5)`);
      if (!inside(part.box, cell.cell)) problems.push(`${cell.date} ${part.cls} leaves its cell`);
      for (const [name, other] of [['date', cell.number], ['lunar', cell.lunar], ['glyph', cell.glyph]]) if (hit(part.box, other)) problems.push(`${cell.date} ${part.cls} overlaps the ${name}`);
      for (const other of cell.others) if (hit(part.box, other.box)) problems.push(`${cell.date} ${part.cls} overlaps ${other.cls}`);
    }
  }
  // A forecast must not grow its week's row: every cell in a row keeps one height.
  const rows = new Map();
  for (const cell of value.cells) rows.set(cell.row, [...(rows.get(cell.row) || []), cell.height]);
  for (const [row, heights] of rows) if (Math.max(...heights) - Math.min(...heights) > 0.5) problems.push(`row at ${row}px has uneven heights ${[...new Set(heights.map(h => h.toFixed(1)))].join('/')}`);
  // The month's 생활비 table stays in the selected-date rail/flow and never
  // overlays the month grid. Final populated cases carry the exact approved
  // screenshot fixture; every other case is deliberately empty.
  const month = Number(value.today.slice(5, 7));
  const amount = value.amount;
  if (amount.state !== 'ready' || !amount.shown) problems.push(`the month's amount line is ${amount.state}${amount.shown ? '' : ' and hidden'}`);
  else {
    const expectedTotal = populated ? '628,000원' : '0원';
    if (amount.label !== `${month}월 생활비 합계` || amount.total !== expectedTotal) problems.push(`amount line reads "${amount.label} ${amount.total}"`);
    if (hit(amount.box, amount.grid)) problems.push('the amount table overlaps the month grid');
    if (amount.box.right > width + 0.5 || amount.box.left < -0.5) problems.push('the amount line leaves the screen');
    const slots = amount.slots.map(([category, text]) => `${category}:${text}`).join(',');
    const expectedSlots = populated
      ? 'FOOD:310,000원,TRAVEL:80,000원,SHOPPING:112,000원,LIVING:96,000원,OTHER:30,000원'
      : 'FOOD:0원,TRAVEL:0원,SHOPPING:0원,LIVING:0원,OTHER:0원';
    if (slots !== expectedSlots) problems.push(`amount slots are ${slots}`);
    for (const [category, , slot] of amount.slots) if (hit(slot, amount.grid) || slot.right > width + 0.5 || slot.left < -0.5) problems.push(`${category} slot overlaps the grid or leaves the screen`);
  }
  if (final) {
    const state = value.finalState;
    if (!state) problems.push('missing approved-design state probe');
    else {
      if (!state.heading.includes('10월 11일 일요일') || !state.heading.includes('오늘')) problems.push(`selected-day heading is "${state.heading}"`);
      if (!state.lunar) problems.push('selected-day lunar date is missing');
      for (const token of ['서울', '21', '16', '26']) if (!state.weather.includes(token)) problems.push(`weather card lacks ${token}: "${state.weather}"`);
      if (state.topAdd !== '+ 일정 추가' || state.settings !== '캘린더 설정' || state.close !== '캘린더 닫기') problems.push('top actions do not match the approved hierarchy');
      if (state.modes.join(',') !== '주,월,목록') problems.push(`view controls are ${state.modes.join(',')}`);
      if (!state.settingsOpened || !state.addOpened || !state.viewSwitchReturnedToMonth) problems.push(`controls did not operate: ${JSON.stringify({settingsOpened: state.settingsOpened, addOpened: state.addOpened, viewSwitchReturnedToMonth: state.viewSwitchReturnedToMonth})}`);
      if (!state.noHorizontalOverflow) problems.push('final layout has page-level horizontal overflow');
      if (populated) {
        if (state.visibleChips !== 3 || state.overflow !== '+3개 더') problems.push(`month cell shows ${state.visibleChips} chips and "${state.overflow}"`);
        if (!inside(state.overflowBox, state.cell)) problems.push('the +3 overflow line is clipped by its date cell');
        if (width > 900 && (state.cellAmount !== '208,000원' || !inside(state.cellAmountBox, state.cell))) problems.push(`the day amount is clipped or reads "${state.cellAmount}"`);
        if (state.rows.length !== 6) problems.push(`detail lists ${state.rows.length} events, not 6`);
        const times = state.rows.map(row => row.time).join(',');
        if (times !== '오전 9:00,오전 11:00,오후 1:00,오후 3:00,오후 5:00,오후 7:00') problems.push(`detail order is ${times}`);
        if (state.rows.some(row => !row.category || !row.amount)) problems.push('detail row lost a category or amount');
        if (state.dailyLabel !== '오늘 지출' || state.dailyAmount !== '208,000원') problems.push(`daily expense is "${state.dailyLabel} ${state.dailyAmount}"`);
        if (state.categoryAmountsClipped) problems.push('a monthly category amount is clipped');
        if (state.empty) problems.push('populated day also renders the empty state');
        if (width > 900 && state.panelOverflow !== 'auto') problems.push(`desktop detail body scroll is ${state.panelOverflow}`);
      } else {
        if (!state.empty.includes('등록된 일정이 없습니다.') || !state.empty.includes('이 날짜에 일정 추가')) problems.push(`empty state is "${state.empty}"`);
        if (state.rows.length || state.visibleChips || state.overflow) problems.push('empty fixture renders schedule rows or overflow');
        if (state.dailyLabel !== '오늘 지출' || state.dailyAmount !== '0원') problems.push(`empty daily expense is "${state.dailyLabel} ${state.dailyAmount}"`);
      }
    }
  }
  if (!gridHidden && shownCount < 5) problems.push(`only ${shownCount} forecast cells showed a temperature`);
  if (problems.length) throw new Error(`${label}: ${problems.slice(0, 8).join('; ')}`);
  return shownCount;
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.calendar-month-temperature-'));
const server = startServer();
let cdp = null;
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), INNER, 'utf8');
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
  const origin = `http://127.0.0.1:${port}`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  cdp = await openBrowser(browser, profile);
  const {targetInfos} = await cdp.send('Target.getTargets');
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: targetInfos.find(item => item.type === 'page').targetId, flatten: true});
  const page = (method, params) => cdp.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
    return result.result.value;
  };
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  const shots = process.env.CALENDAR_MONTH_TEMPERATURE_SHOTS || '';
  const summary = [];
  for (const [label, width, query, height = 900] of CASES) {
    await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width <= 600});
    await page('Page.navigate', {url: `${origin}/scripts/${path.basename(dir)}/inner.html?${query}`});
    await sleep(200);
    const text = await waitFor(async () => {
      const value = await evaluate("document.getElementById('cmt-result')?.textContent || 'pending'").catch(() => 'pending');
      return value !== 'pending' ? value : null;
    }, `${label}: harness`, 60000);
    const value = JSON.parse(text);
    if (!value.ok) throw new Error(`${label}: ${value.error}`);
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      if (query.includes('final=') && width <= 600) {
        await evaluate("window.scrollTo(0,0); const m=document.querySelector('.site-modal-content'); if(m)m.scrollTop=0; true");
        await sleep(100);
      }
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(shots, `${label}.png`), Buffer.from(data, 'base64'));
      if (query.includes('final=') && width <= 600) {
        await evaluate("document.querySelector('.calendar-day-panel')?.scrollIntoView({block:'start'}); true");
        await sleep(150);
        const {data: detailData} = await page('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(shots, `${label}-detail.png`), Buffer.from(detailData, 'base64'));
      }
      if (query.includes('final=')) {
        await evaluate("document.querySelector('.calendar-day-expense-card')?.scrollIntoView({block:'center'}); const b=document.querySelector('.calendar-day-body'); if(b)b.scrollTop=b.scrollHeight; true");
        await sleep(150);
        const {data: totalData} = await page('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(shots, `${label}-totals.png`), Buffer.from(totalData, 'base64'));
      }
    }
    summary.push(`${label}:${BASELINE_CAPTURE ? 'baseline-captured' : check(label, width, query, value)}`);
  }
  console.log(`${NAME}: PASS (${summary.join(', ')})`);
} finally {
  if (cdp) cdp.close();
  server.kill();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}
