// Real-browser proof of the phone Week (CALENDAR P0, mobile week vertical 01).
//
// On a touch width the Week is no longer a seven-column hour grid scrolled
// sideways. The seven days run down a rail on the left and the picked day's
// records fill the right as cards in day order:
//   - the rail lists the week top to bottom, Sunday first by default, with the
//     weekday and the date; a day holding records shows dots, the picked day
//     is clearly marked and today keeps its own ring
//   - pressing a day redraws the right side at once, without a new read
//   - cards: timed records by clock, then 시간 없는 기록; amounts stay on the
//     card; an empty day says so in plain words
//   - weather and the public holiday of the picked day stay visible
//   - 이전/다음 주 and 오늘 keep working; 오늘 stays in the phone Week
//   - + 기록 adds to the picked day, a card opens the editor, 삭제 removes it
//   - the month's amount total is shown in Month only
//   - 320-412px: nothing clipped, overlapping or scrolling the page sideways,
//     in Light and Dark
//   - a desk keeps the seven-day hour grid (and 오늘 still opens the day view)
// Geometry claims need a real layout engine.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-week-mobile-vertical-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-week-mobile-vertical-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4302;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The stylesheets exactly as the live page loads them, in its order.
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stylesheets = [...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
if (!stylesheets.includes('site-calendar.css')) throw new Error('index.html no longer links site-calendar.css');

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${stylesheets.map(href => `<link rel="stylesheet" href="/${href}">`).join('\n')}
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal site-calendar-chat-popup" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2><button type="button" class="site-modal-close" aria-label="캘린더 닫기">×</button></header>
<p class="site-modal-description">로그인 없이 캘린더를 확인할 수 있습니다.</p>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
const theme = new URLSearchParams(location.search).get('theme') || 'light';
document.body.dataset.siteTheme = theme;
const rgb = value => (String(value).match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = ([r, g, b]) => {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (fg, bg) => {
  const a = luminance(rgb(fg)), b = luminance(rgb(bg));
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
};
// The first opaque background at or above a node.
const surfaceOf = node => {
  for (let current = node; current; current = current.parentElement) {
    const value = getComputedStyle(current).backgroundColor;
    const parts = String(value).match(/[\\d.]+/g) || [];
    if (parts.length >= 3 && (parts.length < 4 || Number(parts[3]) > 0.95)) return value;
  }
  return 'rgb(255, 255, 255)';
};
try {
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: true}));
  localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '서울특별시 종로구', latitude: 37.57, longitude: 126.98}));
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (_ok, err) => { if (typeof err === 'function') err({code: 1, message: 'denied'}); },
    watchPosition: () => 0, clearWatch: () => {},
  }});
  const requests = [];
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  const WEATHER = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']
    .map((date, index) => ({date, weather_kind: index % 2 ? 'CLOUDY' : 'CLEAR', weather_icon: index % 2 ? '☁️' : '☀️', source: 'KMA_SHORT', issued_at: '2026-09-21T00:00:00Z', min_temperature_c: 14 + index % 3, max_temperature_c: 24 + index % 4}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    requests.push(u.pathname);
    if (u.pathname.includes('/weather/public')) {
      const start = u.searchParams.get('start'), end = u.searchParams.get('end');
      return j({provider_ready: true, items: WEATHER.filter(item => item.date >= start && item.date <= end), ai_calls: 0});
    }
    if (u.pathname.includes('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [{date: '2026-09-21', name: '대체공휴일', country: 'KR', holiday_type: 'PUBLIC', is_substitute: true, source: 'FIXTURE', source_date: '2026-09-21', verified_at: '2026-01-01T00:00:00Z'}], ai_calls: 0, provider_api_calls: 0});
    return j({items: []});
  };

  const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
  const repo = createGuestCalendarRepository(localStorage, {createQuota: 20});
  repo.create({title: '오후 회의', local_date: '2026-09-23', local_datetime: '2026-09-23T15:00:00', local_end_datetime: '2026-09-23T16:00:00', all_day: false});
  repo.create({title: '점심', local_date: '2026-09-23', local_datetime: '2026-09-23T12:30:00', all_day: false, entry: {amount_minor: 12000, currency: 'KRW', expense_category: 'FOOD'}});
  repo.create({title: '정형외과 진료 예약 확인하고 약국에 들러 처방전 약 받아오기', local_date: '2026-09-23', local_datetime: '2026-09-23T09:00:00', local_end_datetime: '2026-09-23T10:00:00', all_day: false});
  repo.create({title: '장보기 목록', local_date: '2026-09-23'});
  repo.create({title: '가족 나들이', local_date: '2026-09-25', all_day: true});
  repo.create({title: '다음 주 일정', local_date: '2026-09-29', local_datetime: '2026-09-29T08:00:00', all_day: false});

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    root, initialView: 'week', guestRepository: repo,
    timezone: 'Asia/Seoul', now: new Date('2026-09-21T01:00:00Z'),
  });
  await wait(() => root.querySelector('.calendar-week-agenda'), 'week mounted');
  const result = {ok: true, theme, viewport: {width: innerWidth, height: innerHeight}};
  const section = () => root.querySelector('.calendar-week-agenda');
  result.layout = section().dataset.weekLayout;
  const amountSlot = root.querySelector('.calendar-amount-slot');
  result.weekAmountHidden = Boolean(amountSlot?.hidden) && !amountSlot?.querySelector('[data-calendar-amount-summary]');

  if (result.layout === 'timegrid') {
    // The desk: unchanged seven-column hour grid.
    await wait(() => root.querySelectorAll('.calendar-week-day').length === 7, 'desk columns');
    const heads = [...root.querySelectorAll('.calendar-week-day')];
    result.desk = {
      columns: heads.length,
      sameRow: heads.every(node => Math.round(node.getBoundingClientRect().top) === Math.round(heads[0].getBoundingClientRect().top)),
      leftToRight: heads.every((node, index) => index === 0 || node.getBoundingClientRect().left > heads[index - 1].getBoundingClientRect().left),
      railCount: root.querySelectorAll('.calendar-week-rail').length,
      gridOverflow: (() => { const grid = root.querySelector('.calendar-week-grid'); return grid.scrollWidth - grid.clientWidth; })(),
      hourLabels: root.querySelectorAll('.calendar-week-hour-label').length,
    };
    root.querySelector('.calendar-today-button[data-calendar-mode="day"]').click();
    await wait(() => root.dataset.calendarManagerView === 'day', 'desk today');
    result.desk.todayOpensDay = Boolean(root.querySelector('.calendar-day-view'));
    out.textContent = JSON.stringify(result);
  } else {
    await wait(() => root.querySelectorAll('.calendar-week-rail-day').length === 7, 'rail');
    await wait(() => root.querySelector('.calendar-week-day-detail .calendar-day-weather'), 'weather');
    await wait(() => root.querySelector('.calendar-week-day-holiday'), 'holiday');
    const rail = () => [...root.querySelectorAll('.calendar-week-rail-day')];
    const detail = () => root.querySelector('.calendar-week-day-detail');
    const days = rail();
    const boxes = days.map(node => node.getBoundingClientRect());
    result.rail = {
      dates: days.map(node => node.dataset.calendarWeekDate),
      weekdays: days.map(node => node.querySelector('.calendar-week-rail-weekday')?.textContent),
      numbers: days.map(node => node.querySelector('.calendar-week-rail-number')?.textContent),
      oneColumn: boxes.every(box => Math.abs(box.left - boxes[0].left) < 1),
      topToBottom: boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom - 0.5),
      minHeight: Math.min(...boxes.map(box => box.height)),
      selected: days.filter(node => node.dataset.selected === 'true').map(node => node.dataset.calendarWeekDate),
      pressed: days.filter(node => node.getAttribute('aria-pressed') === 'true').map(node => node.dataset.calendarWeekDate),
      today: days.filter(node => node.dataset.today === 'true' && node.getAttribute('aria-current') === 'date').map(node => node.dataset.calendarWeekDate),
      holiday: days.filter(node => node.dataset.holiday === 'true').map(node => node.dataset.calendarWeekDate),
      dots: days.map(node => node.querySelectorAll('.calendar-record-dot').length),
      counts: days.map(node => Number(node.dataset.recordCount)),
      gridCount: root.querySelectorAll('.calendar-week-grid, .calendar-week-day').length,
    };
    const selectedNode = days.find(node => node.dataset.selected === 'true');
    const plainNode = days.find(node => node.dataset.selected !== 'true' && node.dataset.weekday !== '0' && node.dataset.weekday !== '6' && node.dataset.holiday !== 'true');
    result.rail.selectedSurface = getComputedStyle(selectedNode).backgroundColor;
    result.rail.plainSurface = surfaceOf(plainNode);
    result.rail.selectedContrast = contrast(getComputedStyle(selectedNode.querySelector('.calendar-week-rail-number')).color, surfaceOf(selectedNode));
    result.rail.plainContrast = contrast(getComputedStyle(plainNode.querySelector('.calendar-week-rail-number')).color, surfaceOf(plainNode));
    result.rail.weekdayContrast = contrast(getComputedStyle(plainNode.querySelector('.calendar-week-rail-weekday')).color, surfaceOf(plainNode));

    // Today is a holiday with no records: heading, holiday, weather, empty state.
    result.initialDetail = {
      date: detail().dataset.selectedDate,
      heading: detail().querySelector('.calendar-week-day-heading')?.textContent || '',
      holiday: detail().querySelector('.calendar-week-day-holiday')?.textContent || '',
      weather: detail().querySelector('.calendar-day-weather')?.getAttribute('aria-label') || '',
      empty: detail().querySelector('.calendar-week-day-empty')?.textContent || '',
    };

    // One tap on Wednesday: the right side follows in the same task, no read.
    const before = requests.length;
    rail().find(node => node.dataset.calendarWeekDate === '2026-09-23').click();
    result.tap = {
      sameTaskDate: detail()?.dataset.selectedDate || '',
      requestsDuringTap: requests.length - before,
    };
    await sleep(60);
    result.tap.focused = document.activeElement?.dataset?.calendarWeekDate || '';
    const cards = [...detail().querySelectorAll('.calendar-life-row')];
    result.cards = {
      titles: cards.map(card => card.querySelector('.calendar-life-title')?.textContent),
      times: cards.map(card => card.querySelector('.calendar-life-time time')?.textContent || ''),
      amount: cards.map(card => card.querySelector('.calendar-life-amount')?.textContent || '').filter(Boolean),
      untimedLabel: detail().querySelector('.calendar-life-section-label')?.textContent || '',
    };
    const detailBox = detail().getBoundingClientRect();
    const railBox = root.querySelector('.calendar-week-rail').getBoundingClientRect();
    result.geometry = {
      railBesideDetail: railBox.right <= detailBox.left + 0.5,
      railWidth: Math.round(railBox.width),
      detailWidth: Math.round(detailBox.width),
      cardsInside: cards.every(card => { const box = card.getBoundingClientRect(); return box.left >= detailBox.left - 0.5 && box.right <= detailBox.right + 0.5; }),
      cardsNoOverflow: cards.every(card => card.scrollWidth <= card.clientWidth + 1),
      cardsNoOverlap: cards.every((card, index) => index === 0 || card.getBoundingClientRect().top >= cards[index - 1].getBoundingClientRect().bottom - 0.5),
      titleBelowTime: cards.filter(card => card.dataset.lifeGroup !== 'UNTIMED').every(card => {
        const time = card.querySelector('.calendar-life-time').getBoundingClientRect();
        const title = card.querySelector('.calendar-life-title').getBoundingClientRect();
        return title.top >= time.bottom - 1;
      }),
      amountInsideCard: cards.every(card => {
        const amount = card.querySelector('.calendar-life-amount');
        if (!amount) return true;
        const a = amount.getBoundingClientRect(), c = card.getBoundingClientRect();
        return a.right <= c.right + 0.5 && a.left >= c.left - 0.5;
      }),
      longTitleLines: (() => {
        const title = cards.map(card => card.querySelector('.calendar-life-title')).find(node => node.textContent.startsWith('정형외과'));
        const lineHeight = parseFloat(getComputedStyle(title).lineHeight) || 20;
        return Math.round(title.getBoundingClientRect().height / lineHeight);
      })(),
      longTitleWhole: (() => {
        const title = cards.map(card => card.querySelector('.calendar-life-title')).find(node => node.textContent.startsWith('정형외과'));
        return title.scrollHeight <= title.clientHeight + 1;
      })(),
      weekTitleWhole: (() => { const t = root.querySelector('.calendar-title-button'); return t.scrollWidth <= t.clientWidth + 1; })(),
      cardTextContrast: contrast(getComputedStyle(cards[0].querySelector('.calendar-life-title')).color, surfaceOf(cards[0])),
      cardMetaContrast: (() => {
        const meta = detail().querySelector('.calendar-life-meta');
        return meta ? contrast(getComputedStyle(meta).color, surfaceOf(meta)) : null;
      })(),
    };
    const content = root.closest('.site-modal-content');
    result.geometry.pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    result.geometry.contentOverflow = content.scrollWidth - content.clientWidth;
    result.geometry.modalInsideViewport = (() => { const box = root.closest('.site-modal').getBoundingClientRect(); return box.left >= -0.5 && box.right <= innerWidth + 0.5; })();
    const toolbarButtons = [...root.querySelectorAll('.calendar-toolbar button')].filter(node => node.getClientRects().length);
    result.geometry.toolbarInside = toolbarButtons.every(node => { const box = node.getBoundingClientRect(); return box.right <= innerWidth + 0.5 && box.left >= -0.5; });

    // Keyboard: ArrowDown moves to the next day.
    const wed = rail().find(node => node.dataset.calendarWeekDate === '2026-09-23');
    wed.focus();
    wed.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
    await sleep(40);
    result.keyboard = detail().dataset.selectedDate;
    result.friday = [...detail().querySelectorAll('.calendar-life-title')].map(node => node.textContent);

    // The record actions sit above the week and land on the picked day.
    rail().find(node => node.dataset.calendarWeekDate === '2026-09-23').click();
    const actionSlot = root.querySelector('.calendar-action-slot');
    result.actions = {
      labels: [...actionSlot.querySelectorAll('.calendar-add-button')].map(node => node.textContent.trim()),
      aboveWeek: actionSlot.getBoundingClientRect().bottom <= section().getBoundingClientRect().top + 1,
    };

    // + 기록 → 저장: a new card on the picked day.
    actionSlot.querySelector('[data-calendar-add]').click();
    await wait(() => root.querySelector('.calendar-editor-dialog'), 'add editor');
    const editor = root.querySelector('.calendar-editor-dialog');
    result.addEditorDate = editor.querySelector('.calendar-editor-date')?.value || '';
    const titleInput = editor.querySelector('.calendar-editor-title');
    titleInput.value = '새로 넣은 기록';
    titleInput.dispatchEvent(new Event('input', {bubbles: true}));
    editor.querySelector('.calendar-editor-save').click();
    await wait(() => !root.querySelector('.calendar-editor-dialog'), 'add saved');
    await wait(() => [...detail().querySelectorAll('.calendar-life-title')].some(node => node.textContent === '새로 넣은 기록'), 'new card');
    result.afterAdd = {
      date: detail().dataset.selectedDate,
      layout: section().dataset.weekLayout,
      count: rail().find(node => node.dataset.calendarWeekDate === '2026-09-23').dataset.recordCount,
    };

    // Card → editor → 삭제 → confirm: the card leaves, the week stays.
    [...detail().querySelectorAll('.calendar-life-row')].find(node => node.textContent.includes('장보기 목록')).click();
    await wait(() => root.querySelector('.calendar-editor-dialog'), 'edit editor');
    result.editTitle = root.querySelector('.calendar-editor-title')?.value || '';
    root.querySelector('.calendar-editor-delete').click();
    await wait(() => root.querySelector('.calendar-delete-confirm-submit'), 'delete confirm');
    root.querySelector('.calendar-delete-confirm-submit').click();
    await wait(() => !root.querySelector('.calendar-editor-dialog') && ![...detail().querySelectorAll('.calendar-life-title')].some(node => node.textContent === '장보기 목록'), 'deleted');
    result.afterDelete = {
      date: detail().dataset.selectedDate,
      titles: [...detail().querySelectorAll('.calendar-life-title')].map(node => node.textContent),
      count: rail().find(node => node.dataset.calendarWeekDate === '2026-09-23').dataset.recordCount,
    };

    // 다음 주 / 이전 주 / 오늘.
    root.querySelector('[data-calendar-navigation="next"]').click();
    await wait(() => rail()[0]?.dataset.calendarWeekDate === '2026-09-27', 'next week');
    await sleep(40);
    result.nextWeek = {
      dates: rail().map(node => node.dataset.calendarWeekDate),
      selected: detail().dataset.selectedDate,
      title: root.querySelector('.calendar-title-button')?.textContent || '',
      dots: rail().map(node => node.querySelectorAll('.calendar-record-dot').length),
    };
    root.querySelector('[data-calendar-navigation="previous"]').click();
    await wait(() => rail()[0]?.dataset.calendarWeekDate === '2026-09-20', 'previous week');
    result.previousWeekSelected = detail().dataset.selectedDate;
    root.querySelector('[data-calendar-navigation="next"]').click();
    await wait(() => rail()[0]?.dataset.calendarWeekDate === '2026-09-27', 'next again');
    root.querySelector('.calendar-today-button[data-calendar-mode="day"]').click();
    await wait(() => detail()?.dataset.selectedDate === '2026-09-21', 'today');
    result.today = {view: root.dataset.calendarManagerView, layout: section()?.dataset.weekLayout, first: rail()[0].dataset.calendarWeekDate};

    // Month keeps its grid and is the one place with the month's total.
    root.querySelector('.calendar-mode-tab[data-calendar-mode="month"]').click();
    await wait(() => root.querySelector('.calendar-month-grid'), 'month');
    await wait(() => root.querySelector('.calendar-amount-slot [data-calendar-amount-summary="ready"]'), 'month total');
    result.month = {
      cells: root.querySelectorAll('.calendar-month-grid .calendar-date-cell').length,
      total: root.querySelector('.calendar-amount-line-amount')?.textContent || '',
      label: root.querySelector('.calendar-amount-line-label')?.textContent || '',
      slotVisible: !root.querySelector('.calendar-amount-slot').hidden,
      titleWhole: (() => { const t = root.querySelector('.calendar-title-button'); return t.scrollWidth <= t.clientWidth + 1; })(),
    };
    root.querySelector('.calendar-mode-tab[data-calendar-mode="agenda"]').click();
    await wait(() => root.dataset.calendarManagerView === 'agenda', 'agenda');
    result.agenda = {amountHidden: root.querySelector('.calendar-amount-slot').hidden, listed: root.textContent.includes('점심')};
    root.querySelector('.calendar-mode-tab[data-calendar-mode="week"]').click();
    await wait(() => root.querySelector('.calendar-week-vertical'), 'week again');
    result.weekAgain = {layout: section().dataset.weekLayout, amountHidden: root.querySelector('.calendar-amount-slot').hidden};
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

function wrapperMarkup(w, h, theme) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}?theme=${theme}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h, theme) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, theme), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1100', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce',
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
  if (!v.ok) throw new Error(`${w}x${h} ${theme}: ${v.error}`);
  return v;
}

const WEEK = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkPhone(v) {
  const where = `${v.viewport.width}x${v.viewport.height} ${v.theme}`;
  const fail = message => { throw new Error(`${where}: ${message} ${JSON.stringify(v)}`); };
  if (v.layout !== 'vertical') fail(`the phone Week must use the vertical rail, got "${v.layout}"`);
  if (v.rail.gridCount !== 0) fail('the phone Week must not draw the seven-column hour grid');
  if (!same(v.rail.dates, WEEK)) fail('the rail must list Sunday through Saturday');
  if (!same(v.rail.weekdays, ['일', '월', '화', '수', '목', '금', '토'])) fail('each rail day must name its weekday');
  if (!same(v.rail.numbers, ['20', '21', '22', '23', '24', '25', '26'])) fail('each rail day must show its date');
  if (!v.rail.oneColumn || !v.rail.topToBottom) fail('the seven days must run down one column');
  if (v.rail.minHeight < 44) fail(`each rail day must be a 44px touch target, got ${v.rail.minHeight}`);
  if (!same(v.rail.selected, ['2026-09-21']) || !same(v.rail.pressed, ['2026-09-21'])) fail('the Week must open on today, marked as picked');
  if (!same(v.rail.today, ['2026-09-21'])) fail('today must be marked as the current date');
  if (!same(v.rail.holiday, ['2026-09-21'])) fail('the holiday must be marked on the rail');
  if (!same(v.rail.counts, [0, 0, 0, 4, 0, 1, 0]) || !same(v.rail.dots, [0, 0, 0, 3, 0, 1, 0])) fail('days with records must show dots (at most three)');
  if (v.rail.selectedSurface === v.rail.plainSurface) fail('the picked day must stand out from the other days');
  if (v.rail.selectedContrast < 4.5 || v.rail.plainContrast < 4.5 || v.rail.weekdayContrast < 4.5) fail('rail text must stay readable');
  if (v.initialDetail.date !== '2026-09-21' || !v.initialDetail.heading.includes('9월 21일 월요일') || !v.initialDetail.heading.includes('오늘')) fail('the right side must open on today');
  if (v.initialDetail.holiday !== '대체공휴일 · 공휴일') fail('the picked day must keep its public holiday');
  if (!v.initialDetail.weather.startsWith('날씨')) fail('the picked day must keep its weather');
  if (!v.initialDetail.empty.includes('오늘은 아직 기록이 없어요.')) fail('an empty day must say so in plain words');
  if (v.tap.sameTaskDate !== '2026-09-23' || v.tap.requestsDuringTap !== 0) fail('a tap must switch the day at once without a new read');
  if (v.tap.focused !== '2026-09-23') fail('focus must stay on the picked rail day');
  if (!same(v.cards.titles, ['정형외과 진료 예약 확인하고 약국에 들러 처방전 약 받아오기', '점심', '오후 회의', '장보기 목록'])) fail('cards must follow the day: by clock, then the untimed');
  if (!same(v.cards.times, ['09:00', '12:30', '15:00', ''])) fail('timed cards must show their clock');
  if (!same(v.cards.amount, ['12,000원'])) fail('an amount must stay on its card');
  if (v.cards.untimedLabel !== '시간 없는 기록') fail('untimed records must be labelled');
  const g = v.geometry;
  if (!g.railBesideDetail || !g.cardsInside || !g.cardsNoOverflow || !g.cardsNoOverlap || !g.titleBelowTime || !g.amountInsideCard) fail('cards must sit beside the rail without clipping or overlap');
  if (g.longTitleLines < 1 || g.longTitleLines > 3 || !g.longTitleWhole) fail(`a long title must wrap whole within three lines, got ${g.longTitleLines}`);
  if (!g.weekTitleWhole) fail('the week title must not be cut');
  if (g.cardTextContrast < 4.5 || (g.cardMetaContrast !== null && g.cardMetaContrast < 4.5)) fail('card text must stay readable');
  if (g.pageOverflow > 0 || g.contentOverflow > 0 || !g.modalInsideViewport || !g.toolbarInside) fail('nothing may scroll the page sideways');
  if (v.keyboard !== '2026-09-24') fail('ArrowDown must pick the next day');
  if (!same(v.actions.labels, ['사진에서 기록 읽기', '+ 9월 23일에 기록']) || !v.actions.aboveWeek) fail('the record actions must stay above the week, named for the picked day');
  if (v.addEditorDate !== '2026-09-23') fail('+ 기록 must open on the picked day');
  if (v.afterAdd.date !== '2026-09-23' || v.afterAdd.layout !== 'vertical' || v.afterAdd.count !== '5') fail('a saved record must appear on the picked day in the phone Week');
  if (v.editTitle !== '장보기 목록') fail('a card must open its record in the editor');
  if (v.afterDelete.date !== '2026-09-23' || v.afterDelete.titles.includes('장보기 목록') || v.afterDelete.count !== '4') fail('삭제 must remove the card and keep the day');
  if (!same(v.nextWeek.dates, ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'])) fail('다음 주 must show the next week');
  if (v.nextWeek.selected !== '2026-09-30' || !v.nextWeek.title.includes('9/27') || !same(v.nextWeek.dots, [0, 0, 1, 0, 0, 0, 0])) fail('다음 주 must carry the picked weekday and its records');
  if (v.previousWeekSelected !== '2026-09-23') fail('이전 주 must come back to the same weekday');
  if (v.today.view !== 'week' || v.today.layout !== 'vertical' || v.today.first !== '2026-09-20') fail('오늘 must bring today\'s week into the phone Week');
  if (!v.weekAmountHidden) fail('the month total must not show in Week');
  if (!v.month.titleWhole) fail('the month title must not be cut');
  if (v.month.cells < 35 || !v.month.slotVisible || v.month.label !== '9월 입력 금액 합계' || v.month.total !== '12,000원') fail('Month must keep its grid and the month total');
  if (!v.agenda.amountHidden || !v.agenda.listed) fail('the list view must stay as it was');
  if (v.weekAgain.layout !== 'vertical' || !v.weekAgain.amountHidden) fail('coming back to Week must show the phone Week again');
}

function checkDesk(v) {
  const where = `${v.viewport.width}x${v.viewport.height} ${v.theme}`;
  const fail = message => { throw new Error(`${where}: ${message} ${JSON.stringify(v)}`); };
  if (v.layout !== 'timegrid') fail(`the desk Week must keep the hour grid, got "${v.layout}"`);
  if (v.desk.columns !== 7 || !v.desk.sameRow || !v.desk.leftToRight || v.desk.railCount !== 0 || v.desk.hourLabels !== 24) fail('the desk Week must stay seven date columns over a 24-hour axis');
  if (v.desk.gridOverflow > 1) fail('the desk Week must fit without sideways scroll');
  if (!v.weekAmountHidden) fail('the month total must not show in Week');
  if (!v.desk.todayOpensDay) fail('오늘 on a desk must keep opening the day view');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const phones = [[320, 640, 'light'], [360, 780, 'light'], [375, 667, 'light'], [390, 844, 'light'], [412, 915, 'light'], [360, 780, 'dark'], [412, 915, 'dark']];
  const desks = [[1280, 900, 'light'], [1024, 768, 'dark']];
  const summary = [];
  for (const [w, h, theme] of phones) {
    const v = run(browser, w, h, theme);
    checkPhone(v);
    summary.push({width: w, theme, rail: v.geometry.railWidth, detail: v.geometry.detailWidth, lines: v.geometry.longTitleLines});
  }
  for (const [w, h, theme] of desks) {
    const v = run(browser, w, h, theme);
    checkDesk(v);
    summary.push({width: w, theme, layout: v.layout});
  }
  console.log('CALENDAR WEEK MOBILE VERTICAL PASS', JSON.stringify(summary));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
