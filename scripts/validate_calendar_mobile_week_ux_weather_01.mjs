// Real-browser proof of the phone Week UX + weather fix (CALENDAR mobile week
// UX weather 01), reproduced from the 2026-10-09 Samsung Internet captures:
// today 10/9, the week of 10/4-10/10, a 09:00 점심 (기타, 200,000원) on 10/6.
//
//   - the rail keeps the seven days top to bottom, but each day reads "4 일"
//     on one line (date, then weekday) inside a 44px target, with its dots
//   - picked and today stay distinct; Sunday/holiday and Saturday keep their
//     colours
//   - the picked day's records are hairline rows, not framed cards: time,
//     title and amount on the first line of every row -- 1,000,000원 and a
//     long title included -- the category under the title, one clock column
//     width for all rows. Also run with Linux's wide DejaVu Sans metrics
//     forced, where a fixed 38px clock column once ran into the title
//   - weather: the picked day shows its sky, range and rain chance next to
//     its heading, and the 기상청 credit names only that shown forecast. A
//     past day has no forecast (Core returns none), so it says
//     "지난 날짜 날씨 정보 없음" and carries no credit -- the captured bug was
//     a week-wide credit under a past day that showed no weather at all
//   - no weather location: no weather, no credit, no past-day note
//   - a failed weather read says so and never blocks the records
//   - the popup's title row and description take one short block, so all
//     seven days fit the first screen at 320-430px, without sideways scroll
//   - 360px and wider keep ‹ 기간 › 오늘 설정 on one toolbar row
//   - a desk keeps the seven-column hour grid and its week-wide credit
// Geometry claims need a real layout engine.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-mobile-week-ux-weather-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-mobile-week-ux-weather-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4318;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The popup's own words, so the fixture is the page a guest really sees.
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const GUEST_DESCRIPTION = '일정과 생활 기록을 한눈에 관리하세요.';
if (!conversation.includes(`'${GUEST_DESCRIPTION}'`)) throw new Error('the Calendar popup description changed; update this fixture');
if (!conversation.includes(`'${GUEST_DESCRIPTION}'`)) throw new Error('the signed-in Calendar popup description changed; update this check');

// The stylesheets exactly as the live page loads them, in its order.
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stylesheets = [...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
for (const sheet of ['site-calendar.css', 'site-consumer-design.css']) {
  if (!stylesheets.includes(sheet)) throw new Error(`index.html no longer links ${sheet}`);
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${stylesheets.map(href => `<link rel="stylesheet" href="/${href}">`).join('\n')}
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal site-calendar-chat-popup" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2><button type="button" class="site-modal-close" aria-label="캘린더 닫기">×</button></header>
<p class="site-modal-description">${GUEST_DESCRIPTION}</p>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
const params = new URLSearchParams(location.search);
const theme = params.get('theme') || 'light';
const weatherMode = params.get('weather') || 'on';
document.body.dataset.siteTheme = theme;
// Linux renders the stack with DejaVu Sans, whose digits are far wider than
// Segoe UI's: "09:00" ran a fixed 38px clock column into the title there and
// nowhere on Windows. The wide stage forces those metrics on every platform.
const wideFont = params.get('font') === 'wide';
if (wideFont) {
  const style = document.createElement('style');
  style.textContent = "body, body * { font-family: 'DejaVu Sans', Verdana, 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif !important; }";
  document.head.appendChild(style);
}
const box = node => { if (!node) throw new Error('geometry target missing'); const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: true}));
  if (weatherMode !== 'off') localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전북특별자치도 전주시', latitude: 35.82, longitude: 127.15}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const requests = [];
  const j = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  // KMA as Core serves it: short-range from today, mid-range after; nothing
  // for a day already past.
  const KINDS = [['CLEAR', '☀️'], ['CLOUDY', '☁️'], ['RAIN', '🌧️']];
  const WEATHER = Array.from({length: 11}, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 9 + index)).toISOString().slice(0, 10);
    const [kind, icon] = KINDS[index % 3];
    return {date, weather_kind: kind, weather_icon: icon, source: index < 5 ? 'KMA_SHORT' : 'KMA_MID',
      issued_at: index < 5 ? '2026-10-09T02:00:00Z' : '2026-10-08T21:00:00Z',
      min_temperature_c: 14 + index % 3, max_temperature_c: 24 + index % 4, precipitation_probability: [0, 30, 60][index % 3]};
  });
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    requests.push(u.pathname + u.search);
    if (u.pathname.includes('/weather/public')) {
      if (weatherMode === 'fail') return j({detail: {code: 'WEATHER_PROVIDER_UNAVAILABLE'}}, 503);
      const start = u.searchParams.get('start'), end = u.searchParams.get('end');
      return j({provider_ready: true, items: WEATHER.filter(item => item.date >= start && item.date <= end), ai_calls: 0});
    }
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [
      {date: '2026-10-05', name: '대체공휴일', country: 'KR', holiday_type: 'PUBLIC', is_substitute: true, source: 'FIXTURE', source_date: '2026-10-05', verified_at: '2026-01-01T00:00:00Z'},
      {date: '2026-10-09', name: '한글날', country: 'KR', holiday_type: 'PUBLIC', is_substitute: false, source: 'FIXTURE', source_date: '2026-10-09', verified_at: '2026-01-01T00:00:00Z'},
    ], ai_calls: 0, provider_api_calls: 0});
    return j({items: []});
  };

  const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
  const repo = createGuestCalendarRepository(localStorage, {createQuota: 20});
  repo.create({title: '점심', local_date: '2026-10-06', local_datetime: '2026-10-06T09:00:00', all_day: false, entry: {amount_minor: 200000, currency: 'KRW', expense_category: 'OTHER'}});
  repo.create({title: '정형외과 진료 예약 확인하고 약국에 들러 처방전 약 받아오기', local_date: '2026-10-06', local_datetime: '2026-10-06T14:00:00', local_end_datetime: '2026-10-06T15:00:00', all_day: false});
  repo.create({title: '장보기 목록', local_date: '2026-10-06', entry: {amount_minor: 35000, currency: 'KRW', expense_category: 'FOOD'}});
  // The widest amounts beside a short and a long title.
  repo.create({title: '월세', local_date: '2026-10-06', local_datetime: '2026-10-06T08:00:00', all_day: false, entry: {amount_minor: 1000000, currency: 'KRW', expense_category: 'LIVING'}});
  repo.create({title: '아파트 관리비와 가스요금 자동이체 확인하고 영수증 정리하기', local_date: '2026-10-06', local_datetime: '2026-10-06T18:00:00', all_day: false, entry: {amount_minor: 1000000, currency: 'KRW', expense_category: 'LIVING'}});
  repo.create({title: '가족 저녁', local_date: '2026-10-09', local_datetime: '2026-10-09T19:00:00', all_day: false});

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({root, initialView: 'week', guestRepository: repo, timezone: 'Asia/Seoul', now: new Date('2026-10-09T02:00:00Z')});
  await wait(() => root.querySelector('.calendar-week-agenda'), 'week mounted');
  const section = () => root.querySelector('.calendar-week-agenda');
  const result = {ok: true, theme, weatherMode, wideFont, viewport: {width: innerWidth, height: innerHeight}, layout: section().dataset.weekLayout};
  const credit = () => section().querySelector(':scope > .calendar-weather-credit')?.textContent || '';
  if (weatherMode === 'on') await wait(() => credit(), 'weather credit');
  else await sleep(400);

  if (result.layout === 'timegrid') {
    await wait(() => root.querySelectorAll('.calendar-week-day').length === 7, 'desk columns');
    result.desk = {
      columns: root.querySelectorAll('.calendar-week-day').length,
      rail: root.querySelectorAll('.calendar-week-rail').length,
      credit: credit(),
      headerWeather: root.querySelectorAll('.calendar-week-day .calendar-weather-icon, .calendar-week-grid-header .calendar-weather-icon').length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    out.textContent = JSON.stringify(result);
  } else {
    await wait(() => root.querySelectorAll('.calendar-week-rail-day').length === 7, 'rail');
    const rail = () => [...root.querySelectorAll('.calendar-week-rail-day')];
    const detail = () => root.querySelector('.calendar-week-day-detail');
    const pick = async date => {
      const before = requests.length;
      rail().find(node => node.dataset.calendarWeekDate === date).click();
      const sameTask = detail()?.dataset.selectedDate === date;
      await sleep(60);
      return {sameTask, reads: requests.length - before};
    };
    const weatherOf = () => ({
      weather: detail().querySelector('.calendar-week-day-detail-head .calendar-day-weather')?.textContent || '',
      note: detail().querySelector('[data-calendar-weather-note]')?.textContent || '',
      credit: credit(),
      creditCount: section().querySelectorAll('.calendar-weather-credit').length,
    });

    // Today first: its forecast beside the heading, credited to that forecast.
    result.today = {date: detail().dataset.selectedDate, ...weatherOf(),
      weatherBesideHeading: (() => {
        const w = detail().querySelector('.calendar-week-day-detail-head .calendar-day-weather');
        const h = detail().querySelector('.calendar-week-day-heading');
        return Boolean(w && h) && box(w).top < box(h).bottom + 30;
      })()};

    // The rail.
    const days = rail();
    const content = root.closest('.site-modal-content');
    const contentBottom = box(content).bottom;
    result.rail = {
      dates: days.map(node => node.dataset.calendarWeekDate),
      text: days.map(node => node.querySelector('.calendar-week-rail-line')?.textContent || ''),
      oneLine: days.every(node => {
        const n = box(node.querySelector('.calendar-week-rail-number'));
        const w = box(node.querySelector('.calendar-week-rail-weekday'));
        return n.right <= w.left + 0.5 && Math.abs((n.top + n.bottom) / 2 - (w.top + w.bottom) / 2) < 2;
      }),
      oneColumn: days.every(node => Math.abs(box(node).left - box(days[0]).left) < 1),
      topToBottom: days.every((node, index) => index === 0 || box(node).top >= box(days[index - 1]).bottom - 0.5),
      minHeight: Math.min(...days.map(node => box(node).height)),
      maxHeight: Math.max(...days.map(node => box(node).height)),
      railWidth: Math.round(box(root.querySelector('.calendar-week-rail')).width),
      allVisible: box(days.at(-1)).bottom <= contentBottom + 0.5,
      lastBottom: Math.round(box(days.at(-1)).bottom),
      contentBottom: Math.round(contentBottom),
      dots: days.map(node => node.querySelectorAll('.calendar-record-dot').length),
      selected: days.filter(node => node.dataset.selected === 'true').map(node => node.dataset.calendarWeekDate),
      today: days.filter(node => node.dataset.today === 'true').map(node => node.dataset.calendarWeekDate),
      colors: Object.fromEntries(days.map(node => [node.dataset.calendarWeekDate, getComputedStyle(node.querySelector('.calendar-week-rail-number')).color])),
      todayRing: getComputedStyle(days.find(node => node.dataset.today === 'true').querySelector('.calendar-week-rail-number')).boxShadow,
      selectedSurface: getComputedStyle(days.find(node => node.dataset.selected === 'true')).backgroundColor,
      plainSurface: getComputedStyle(days.find(node => node.dataset.calendarWeekDate === '2026-10-07')).backgroundColor,
    };
    const css = getComputedStyle(document.body);
    result.tokens = {
      sun: getComputedStyle(days[0].querySelector('.calendar-week-rail-number')).color,
      plain: getComputedStyle(days[3].querySelector('.calendar-week-rail-number')).color,
    };

    // The popup frame and toolbar.
    const modal = root.closest('.site-modal');
    const shot = selector => { const node = root.querySelector(selector); return node ? box(node) : null; };
    result.chrome = {
      headerHeight: Math.round(box(modal.querySelector('.site-modal-header')).height),
      descriptionHeight: Math.round(box(modal.querySelector('.site-modal-description')).height),
      weekTop: Math.round(box(section()).top),
      settingsHeader: Boolean(modal.querySelector('.calendar-modal-actions .calendar-settings-button')),
      tabsBelow: shot('.calendar-mode-tabs').top >= shot('.calendar-today-button').bottom - 0.5,
      titleWhole: (() => { const t = root.querySelector('.calendar-title-button'); return t.scrollWidth <= t.clientWidth + 1; })(),
      toolbarTargets: Math.min(...[...root.querySelectorAll('.calendar-toolbar button')].filter(node => node.getClientRects().length).map(node => Math.min(box(node).width, box(node).height))),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      contentOverflow: content.scrollWidth - content.clientWidth,
      modalInside: box(modal).left >= -0.5 && box(modal).right <= innerWidth + 0.5,
    };

    // 10/6, a past day with the captured records.
    result.pickPast = await pick('2026-10-06');
    result.past = weatherOf();
    const rows = () => [...detail().querySelectorAll('.calendar-life-row')];
    const part = (row, selector) => row.querySelector(selector);
    const first = rows().find(row => part(row, '.calendar-life-title')?.textContent === '점심');
    // time | title | amount on one first line, for every row: the clock never
    // runs into the title, the amount never drops under it.
    const firstLineOf = row => {
      const time = part(row, '.calendar-life-time time');
      const amount = part(row, '.calendar-life-amount');
      const n = box(part(row, '.calendar-life-title'));
      const t = time && time.getClientRects().length ? box(time) : null;
      const a = amount ? box(amount) : null;
      return (!t || (t.right <= n.left + 0.5 && Math.abs(t.top - n.top) < 6))
        && (!a || (n.right <= a.left + 0.5 && Math.abs(a.top - n.top) < 6));
    };
    const clockColumns = rows().map(row => part(row, '.calendar-life-time')).filter(node => node.getClientRects().length).map(node => Math.round(box(node).width * 10) / 10);
    result.rows = {
      titles: rows().map(row => part(row, '.calendar-life-title')?.textContent || ''),
      first: {
        time: part(first, '.calendar-life-time time')?.textContent || '',
        title: part(first, '.calendar-life-title')?.textContent || '',
        meta: part(first, '.calendar-life-category')?.textContent || '',
        amount: part(first, '.calendar-life-amount')?.textContent || '',
      },
      firstLine: rows().every(firstLineOf),
      firstLineFailures: rows().filter(row => !firstLineOf(row)).map(row => part(row, '.calendar-life-title').textContent),
      clockColumns,
      longAmountTitleLines: (() => {
        const t = rows().map(row => part(row, '.calendar-life-title')).find(node => node.textContent.startsWith('아파트'));
        return Math.round(box(t).height / (parseFloat(getComputedStyle(t).lineHeight) || 20));
      })(),
      metaUnderTitle: box(part(first, '.calendar-life-category')).top >= box(part(first, '.calendar-life-title')).bottom - 1,
      unframed: rows().every(row => {
        const s = getComputedStyle(row);
        return parseFloat(s.borderLeftWidth) === 0 && parseFloat(s.borderRightWidth) === 0 && parseFloat(s.borderTopWidth) === 0;
      }),
      separated: rows().slice(0, -1).some(row => parseFloat(getComputedStyle(row).borderBottomWidth) >= 1),
      minHeight: Math.min(...rows().map(row => box(row).height)),
      noOverlap: rows().every((row, index) => index === 0 || box(row).top >= box(rows()[index - 1]).bottom - 0.5),
      inside: rows().every(row => box(row).left >= box(detail()).left - 0.5 && box(row).right <= box(detail()).right + 0.5),
      noOverflow: rows().every(row => row.scrollWidth <= row.clientWidth + 1),
      longTitleWhole: (() => { const t = rows().map(row => part(row, '.calendar-life-title')).find(node => node.textContent.startsWith('정형외과')); return t.scrollHeight <= t.clientHeight + 1; })(),
      amountColor: getComputedStyle(part(first, '.calendar-life-amount')).color,
      plainTextColor: getComputedStyle(part(first, '.calendar-life-title')).color,
    };

    // A row opens its record; 취소 brings the same day back.
    first.click();
    await wait(() => root.querySelector('.calendar-editor-dialog'), 'editor');
    result.editor = {
      title: root.querySelector('.calendar-editor-title')?.value || '',
      amount: root.querySelector('.calendar-editor-amount')?.value || '',
      category: root.querySelector('.calendar-editor-category')?.value || '',
    };
    root.querySelector('.calendar-editor-cancel').click();
    await wait(() => !root.querySelector('.calendar-editor-dialog'), 'editor closed');
    result.afterCancel = detail().dataset.selectedDate;

    // 10/10, a forecast day.
    result.pickFuture = await pick('2026-10-10');
    result.future = weatherOf();

    // The two ways to add stay above the week, named for the picked day.
    result.actions = [...root.querySelectorAll('.calendar-action-slot .calendar-add-button')].map(node => node.textContent.trim());
    out.textContent = JSON.stringify(result);
  }
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

function wrapperMarkup(w, h, query) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}?${query}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h, query) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, query), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1100', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce',
    '--virtual-time-budget=58000', '--dump-dom', `${ORIGIN}/${WRAPPER_REL}`,
  ], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="result">';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf('</pre>', i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h} ${query}: ${v.error}`);
  return v;
}

const WEEK = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkPhone(v) {
  const where = `${v.viewport.width}x${v.viewport.height} ${v.theme} weather=${v.weatherMode}${v.wideFont ? ' wide-font' : ''}`;
  const fail = message => { throw new Error(`${where}: ${message} ${JSON.stringify(v)}`); };
  if (v.layout !== 'vertical') fail(`the phone Week must use the rail, got "${v.layout}"`);
  const r = v.rail;
  if (!same(r.dates, WEEK)) fail('the rail must list Sunday through Saturday');
  if (!same(r.text, ['4일', '5월', '6화', '7수', '8목', '9금', '10토'])) fail('each rail day must read date then weekday');
  if (!r.oneLine) fail('a rail day\'s date and weekday must share one line');
  if (!r.oneColumn || !r.topToBottom) fail('the seven days must run down one column');
  if (r.minHeight < 44) fail(`each rail day must be a 44px target, got ${r.minHeight}`);
  if (r.maxHeight > 50) fail(`a rail day must not grow back to the two-line height, got ${r.maxHeight}`);
  if (r.railWidth > 60) fail(`the rail must stay narrow, got ${r.railWidth}px`);
  if (v.viewport.height >= 780 && !r.allVisible) fail(`all seven days must fit a 780px-or-taller first screen (last ${r.lastBottom} > ${r.contentBottom})`);
  if (v.viewport.height < 780 && r.lastBottom - r.contentBottom > 44) fail(`a short screen may scroll by at most one day target (${r.lastBottom} > ${r.contentBottom})`);
  if (!same(r.dots, [0, 0, 3, 0, 0, 1, 0])) fail('days with records keep their dots');
  if (!same(r.selected, ['2026-10-09']) || !same(r.today, ['2026-10-09'])) fail('the Week opens on today');
  if (r.selectedSurface === r.plainSurface) fail('the picked day must stand out');
  if (!/inset/.test(r.todayRing)) fail('today keeps its own ring, apart from the picked fill');
  if (r.colors['2026-10-04'] === r.colors['2026-10-07'] || r.colors['2026-10-10'] === r.colors['2026-10-07'] || r.colors['2026-10-05'] === r.colors['2026-10-07']) fail('Sunday, holidays and Saturday keep their colours');

  const c = v.chrome;
  if (c.headerHeight > 110) fail(`the popup title/actions block is too tall, got ${c.headerHeight}px`);
  if (!c.titleWhole) fail('the toolbar title must stay whole');
  if (c.toolbarTargets < 44) fail(`toolbar controls must stay 44px targets, got ${c.toolbarTargets}`);
  if (!c.tabsBelow) fail('주/월/목록 sit on the row under the navigation');
  if (!c.settingsHeader) fail('설정 must stay in the confirmed modal header beside 일정 추가');
  if (c.pageOverflow > 0 || c.contentOverflow > 0 || !c.modalInside) fail('nothing may scroll the page sideways');

  if (v.pickPast.sameTask !== true || v.pickPast.reads !== 0 || v.pickFuture.sameTask !== true || v.pickFuture.reads !== 0) fail('a tap must switch the day at once without a new read');
  const rows = v.rows;
  if (!same(rows.titles, ['월세', '점심', '정형외과 진료 예약 확인하고 약국에 들러 처방전 약 받아오기', '아파트 관리비와 가스요금 자동이체 확인하고 영수증 정리하기', '장보기 목록'])) fail('rows must follow the day');
  if (!same(rows.first, {time: '오전 9:00', title: '점심', meta: '기타', amount: '200,000원'})) fail('the 오전 9:00 점심 row keeps its time, category and amount');
  if (!rows.firstLine && !(v.viewport.width < 360 && v.wideFont)) fail(`time, title and amount must share the first line (${rows.firstLineFailures.join(', ')})`);
  if (Math.max(...rows.clockColumns) - Math.min(...rows.clockColumns) > 0.5) fail('every row keeps the same clock column');
  if (rows.longAmountTitleLines < 1 || rows.longAmountTitleLines > 4) fail(`a long title beside a large amount stays within four lines, got ${rows.longAmountTitleLines}`);
  if (!rows.metaUnderTitle) fail('the category sits under the title');
  if (!rows.unframed || !rows.separated) fail('records are hairline rows, not framed cards');
  if (rows.minHeight < 44) fail(`each row must stay a 44px target, got ${rows.minHeight}`);
  if (!rows.noOverlap || !rows.inside || !rows.noOverflow || (!rows.longTitleWhole && !(v.viewport.width < 360 && v.wideFont))) fail('rows must not clip, overflow or overlap');
  if (rows.amountColor !== rows.plainTextColor) fail('a large amount must not be coloured as a warning');
  if (!same(v.editor, {title: '점심', amount: '200,000', category: 'OTHER'}) && !(v.editor.title === '점심' && v.editor.amount.replace(/\D/g, '') === '200000' && v.editor.category === 'OTHER')) fail('a row must open its record unchanged');
  if (v.afterCancel !== '2026-10-06') fail('closing the editor keeps the picked day');
  if (!same(v.actions, ['사진으로 추가', '+ 10월 10일 일정 추가'])) fail('사진으로 추가 and + 일정 추가 stay, named for the picked day');

  if (v.weatherMode === 'on') {
    if (!/맑음/.test(v.today.weather) || !/14° \/ 24°/.test(v.today.weather) || !v.today.weatherBesideHeading) fail('today shows its sky and range beside the heading');
    if (!/^날씨 출처: .+ · 11:00 발표$/.test(v.today.credit) || v.today.note) fail('today\'s credit names the shown forecast');
    if (v.past.weather || v.past.credit || v.past.creditCount !== 0) fail('a past day must not carry weather or a credit it does not show');
    if (v.past.note !== '지난 날짜 날씨 정보 없음') fail('a past day says it has no weather');
    if (!/흐림/.test(v.future.weather) || !/💧30%/.test(v.future.weather) || !/11:00 발표$/.test(v.future.credit) || v.future.note) fail('a forecast day shows its weather, rain chance and credit');
  } else if (v.weatherMode === 'off') {
    for (const day of [v.today, v.past, v.future]) {
      if (day.weather || day.credit || day.note || day.creditCount) fail('with no weather location, no weather, credit or note appears');
    }
  } else {
    if (v.today.weather || v.past.weather) fail('a failed read must not draw weather');
    if (!/날씨를 불러오지 못했어요/.test(v.today.credit) || /출처/.test(v.today.credit)) fail('a failed read says so, without a credit');
    if (v.past.note) fail('a failed read is not explained away as a past day');
  }
}

function checkDesk(v) {
  const where = `${v.viewport.width}x${v.viewport.height} ${v.theme}`;
  const fail = message => { throw new Error(`${where}: ${message} ${JSON.stringify(v)}`); };
  if (v.layout !== 'timegrid' || v.desk.columns !== 7 || v.desk.rail !== 0) fail('the desk Week keeps its seven-column hour grid');
  if (!/^날씨 출처: .+ · 11:00 발표$/.test(v.desk.credit) || v.desk.headerWeather < 2) fail('the desk Week keeps every column\'s forecast and the week\'s credit');
  if (v.desk.pageOverflow > 0) fail('the desk must not scroll sideways');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const phones = [
    [320, 640, 'theme=light'], [360, 640, 'theme=light'], [390, 844, 'theme=light'], [430, 932, 'theme=light'],
    [360, 780, 'theme=dark'], [360, 780, 'theme=light&weather=off'], [390, 844, 'theme=light&weather=fail'],
    // Linux font metrics on every platform (the 2026-10-09 gate failure).
    [320, 640, 'theme=light&font=wide'], [320, 640, 'theme=dark&font=wide&weather=off'], [360, 640, 'theme=light&font=wide'],
  ];
  const desks = [[1280, 900, 'theme=light'], [1024, 768, 'theme=dark']];
  const summary = [];
  for (const [w, h, query] of phones) {
    const v = run(browser, w, h, query);
    checkPhone(v);
    summary.push({width: w, height: h, query, weekTop: v.chrome.weekTop, lastDay: v.rail.lastBottom, rail: v.rail.railWidth, clock: v.rows.clockColumns[0]});
  }
  for (const [w, h, query] of desks) {
    const v = run(browser, w, h, query);
    checkDesk(v);
    summary.push({width: w, height: h, query, layout: v.layout});
  }
  console.log('CALENDAR MOBILE WEEK UX WEATHER PASS', JSON.stringify(summary));
} finally {
  server.kill('SIGTERM');
  if (process.env.CALENDAR_KEEP_FIXTURE !== '1') {
    fs.rmSync(INNER, {force: true});
    fs.rmSync(WRAPPER, {force: true});
  }
}
