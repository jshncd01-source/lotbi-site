// CALENDAR-DESIGN-04 — 소유자 확정 시안 04(2026-10-14)의 캘린더 작업 공간 계약.
//
// 실제 작업 공간 모양(consumer-workspace > site-calendar-page)에 캘린더를 띄우고
// 넓은 화면·휴대폰 폭에서 확인한다:
//   - 같은 역할의 버튼은 한 화면에 하나: 보이는 '일정 추가' 1개(선택한 날짜 문구),
//     보이는 '사진으로 추가' 1개.
//   - 날짜 띠: 공휴일 이름 · 음력 · 날씨(오늘 '지금' 실황 / 다른 날 '예보', 기상청 출처).
//   - 주: 같은 시각 일정은 한 칸('같은 시간 N개'), 빈 시간은 한 줄('비어 있음').
//   - 가계부: 실제 지출만 합계, 예정은 따로. '실제 지출로 기록'은 합계에 한 번만 더한다.
//   - 편집기: 제목이 먼저, 지출 연결은 접힌 줄, 휴대폰은 머리글 '저장'.
//   - 사진 확인: 날짜가 같으면 한 건, 다르면 일정·지출 두 건. 등록 전에는 저장하지 않는다.
//   - 가로 넘침 0, 다크 모드에서 카드가 흰 바탕으로 남지 않는다.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = '/scripts/.calendar-design-04-fixture.html';

const fixtureHtml = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-hardening.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
<link rel="stylesheet" href="/site-calendar-weather.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-consumer-design.css">
<link rel="stylesheet" href="/site-consumer-layout.css">
<link rel="stylesheet" href="/site-consumer-detail.css">
</head><body class="chat-home-page site-workspace-open" data-site-theme="light">
<div class="consumer-workspace" data-workspace="calendar">
  <section class="site-modal site-calendar-modal site-calendar-chat-popup site-calendar-page" role="region">
    <div class="site-modal-header"><button class="site-modal-close" type="button" aria-label="대화로 돌아가기">←</button><h2>캘린더</h2></div>
    <p class="site-modal-description">로그인 없이 쓸 수 있어요.</p>
    <div class="site-modal-content" id="calendar-root"></div>
  </section>
</div>
<script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = node => Boolean(node) && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
const text = node => (node?.textContent || '').replace(/\\s+/g, ' ').trim();
const until = async (check, label, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (check()) return; await sleep(30); } throw new Error('timeout: ' + label); };
const fail = message => { throw new Error(message); };
try {
  const day = d => '2026-10-' + String(d).padStart(2, '0');
  const uuid = () => 'guest_' + crypto.randomUUID();
  const at = '2026-10-14T00:00:00.000Z';
  const ev = (d, title, o = {}) => ({id: uuid(), title, local_date: day(d), local_datetime: o.s ? day(d) + 'T' + o.s : null,
    local_end_datetime: o.s && o.e ? day(d) + 'T' + o.e : null, local_end_date: o.s && o.e ? day(d) : null, all_day: !o.s,
    entry: {amount_minor: o.a ?? null, currency: 'KRW', expense_category: o.a == null ? null : (o.c || 'UNCLASSIFIED'), expense_status: o.a == null ? null : (o.k || 'PAID'), memo: null, place: null, merchant: null},
    created_at: at, updated_at: at});
  const events = [
    ev(1, '가스·전기 요금', {s: '19:00', a: 32000, c: 'LIVING'}),
    ev(9, '한글날 나들이', {a: 48000, c: 'FOOD'}),
    ev(14, '가족 아침 식사', {s: '09:00', e: '10:00', a: 18000, c: 'FOOD'}),
    ev(14, '강릉 숙소 예약', {s: '09:00', e: '11:00', a: 120000, c: 'TRAVEL', k: 'PLANNED'}),
    ev(14, '친구 점심', {s: '12:00', e: '13:00', a: 28000, c: 'FOOD', k: 'PLANNED'}),
    ev(14, '영어학원 상담', {s: '15:30', e: '16:30'}),
    ev(15, '엄마 생신 저녁', {s: '19:00', a: 80000, c: 'FOOD', k: 'PLANNED'}),
  ];
  localStorage.clear();
  localStorage.setItem('lotbi.guest.calendar.v1', JSON.stringify({version: 2, created_count: events.length, events}));
  localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전주시 만성동', latitude: 35.8461, longitude: 127.0957, midRegionCode: '11F10201'}));
  localStorage.setItem('lotbi.calendar.weather-region-origin.v1', 'MANUAL');
  const icons = {CLEAR: '☀️', CLOUDY: '☁️', RAIN: '🌧️', SNOW: '❄️'};
  const forecast = {14: ['CLEAR', 12, 24], 15: ['CLOUDY', 13, 22], 16: ['CLEAR', 12, 23], 17: ['RAIN', 11, 17]};
  const fetchImpl = async input => {
    const url = new URL(String(input));
    const ok = body => new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}});
    if (url.pathname === '/v2/life/holidays') {
      return ok({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], ai_calls: 0, provider_api_calls: 0,
        items: [['2026-10-03', '개천절'], ['2026-10-09', '한글날']].map(([date, name]) => ({date, name, country: 'KR', holiday_type: 'PUBLIC', is_substitute: false, source: 'FIXTURE', source_date: '2026-01-01', verified_at: '2026-01-01T00:00:00Z'}))});
    }
    if (url.pathname === '/v2/life/weather/public') {
      const start = url.searchParams.get('start'); const end = url.searchParams.get('end');
      const items = Object.entries(forecast).map(([d, [kind, lo, hi]]) => ({date: day(Number(d)), weather_kind: kind, weather_icon: icons[kind], source: 'KMA_SHORT', issued_at: '2026-10-14T17:00:00+09:00', temperature_c: null, min_temperature_c: lo, max_temperature_c: hi, precipitation_probability: 0, freshness: 'LIVE'}))
        .filter(item => item.date >= start && item.date <= end);
      return ok({provider_ready: true, found: true, items, current: start <= day(14) && end >= day(14) ? {temperature_c: 16.4, precipitation_kind: 'NONE', observed_at: '2026-10-14T20:00:00+09:00', source: 'KMA_NOWCAST'} : null, ai_calls: 0});
    }
    return new Response('{}', {status: 404, headers: {'content-type': 'application/json'}});
  };
  const manager = await import('/site-calendar-manager.js');
  const {createGuestCalendarRepository} = await import('/site-calendar-guest.js');
  const root = document.getElementById('calendar-root');
  const mounted = await manager.mountLifeCalendarManager({
    root, initialView: 'week', timezone: 'Asia/Seoul', now: new Date('2026-10-14T11:00:00+09:00'), fetchImpl,
    guestRepository: createGuestCalendarRepository(localStorage), settingsStorage: localStorage, locationProvider: null, locationPermissions: null,
  });
  if (!mounted) fail('calendar did not mount');
  const page = document.querySelector('.site-calendar-page');
  const shell = () => root.querySelector('.calendar-product-shell[data-design="c4"]');
  await until(() => shell() && root.querySelector('.c4-wk') && root.querySelector('.c4-strip [data-weather-status="ready"]'), 'week view with weather');
  const wide = innerWidth > 900;
  const result = {viewport: {width: innerWidth, height: innerHeight}, wide};
  const visibleAll = selector => [...document.querySelectorAll(selector)].filter(visible);
  const tab = async mode => { root.querySelector('.calendar-mode-tab[data-calendar-mode="' + mode + '"]').click(); await sleep(250); };
  const overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

  // 1) 같은 역할 버튼은 하나
  const adds = visibleAll('[data-calendar-add]');
  if (adds.length !== 1 || text(adds[0]) !== '10월 14일 일정 추가') fail('one add button with the selected date: ' + JSON.stringify(adds.map(text)));
  if (visibleAll('[data-calendar-add-image]').length !== 1) fail('one photo button');
  if (page.dataset.calendarDesign !== 'c4') fail('workspace page is not marked c4');
  result.oneAdd = true;

  // 2) 날짜 띠: 오늘은 '지금' 실황, 다른 날은 '예보', 기상청 출처, 음력
  const strip = () => root.querySelector('.c4-strip');
  if (!/지금/.test(text(strip())) || !/16°/.test(text(strip())) || !/기상청 실황/.test(text(strip()))) fail('today strip shows the nowcast: ' + text(strip()));
  if (!/음력 9월 4일/.test(text(strip()))) fail('lunar date in the strip: ' + text(strip()));
  root.querySelector('.c4-rd[data-calendar-week-date="2026-10-16"]').click();
  await until(() => /10월 16일 금요일/.test(text(strip())), 'strip follows the selected day');
  if (!/예보/.test(text(strip())) || /지금/.test(text(strip())) || !/기상청 예보/.test(text(strip()))) fail('future strip shows the forecast: ' + text(strip()));
  if (text(visibleAll('[data-calendar-add]')[0]) !== '10월 16일 일정 추가') fail('add label follows the date');
  if (!/일정이 없어요/.test(text(root.querySelector('.c4-dayv')))) fail('empty day guidance');
  root.querySelector('.c4-rd[data-calendar-week-date="2026-10-14"]').click();
  await until(() => /10월 14일 수요일/.test(text(strip())), 'back to today');
  result.strip = true;

  // 3) 주: 같은 시각 한 칸, 빈 시간 한 줄
  if (!/같은 시간 2개/.test(text(root.querySelector('.c4-dayv')))) fail('same-time slot note');
  if (!root.querySelector('.c4-gap') || !/비어 있음/.test(text(root.querySelector('.c4-gap')))) fail('collapsed empty hours');
  if (root.querySelectorAll('.c4-dayv .c4-ev').length !== 4) fail('four cards on the 14th');
  result.week = true;

  // 4) 가계부: 실제 지출만 합계(18,000 + 48,000 + 32,000), 예정은 따로(120,000 + 28,000 + 80,000)
  const ledgerTotal = () => text(root.querySelector(wide ? '.c4-ledger .c4-lc-num' : '.c4-dock .c4-dock-v'));
  await until(() => ledgerTotal() === '98,000원', 'paid-only total');
  if (wide && !/228,000원/.test(text(root.querySelector('.c4-ledger .c4-lc-plan')))) fail('planned shown apart');
  result.ledger = ledgerTotal();

  // 5) 상세 → 실제 지출로 기록: 합계에 한 번만 더한다
  [...root.querySelectorAll('.c4-ev')].find(card => /친구 점심/.test(text(card))).click();
  await until(() => root.querySelector('.c4-detail [data-calendar-mark-paid]'), 'detail dialog');
  if (!/예정 지출/.test(text(root.querySelector('.c4-detail .c4-pay')))) fail('planned money box');
  root.querySelector('.c4-detail [data-calendar-mark-paid]').click();
  await until(() => !root.querySelector('.c4-detail') && ledgerTotal() === '126,000원', 'paid total moves once');
  const stored = JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1')).events.find(item => item.title === '친구 점심');
  if (stored.entry.expense_status !== 'PAID' || stored.entry.amount_minor !== 28000) fail('stored as paid');
  result.markPaid = ledgerTotal();

  // 6) 편집기: 제목이 먼저, 지출 연결은 접힌 줄, 휴대폰은 머리글 저장
  visibleAll('[data-calendar-add]')[0].click();
  await until(() => root.querySelector('.c4-editor'), 'editor');
  await sleep(60);
  const editor = root.querySelector('.c4-editor');
  if (document.activeElement !== editor.querySelector('.calendar-editor-title')) fail('title is focused first');
  if (!/선택한 날짜/.test(text(editor.querySelector('.c4-when-date')))) fail('selected date filled');
  const amountRow = editor.querySelector('[data-editor-chip="amount"]');
  if (!/지출 연결/.test(text(amountRow)) || !editor.querySelector('.calendar-editor-amount-control').hidden) fail('money row starts folded');
  if (wide ? !visible(editor.querySelector('.calendar-editor-save')) : !visible(editor.querySelector('[data-calendar-editor-save-top]'))) fail('save stays reachable');
  amountRow.click();
  await sleep(60);
  if (editor.querySelector('.calendar-editor-amount-control').hidden || !editor.querySelector('.calendar-editor-expense-status [aria-pressed="true"]')) fail('money row opens with a status');
  editor.querySelector('.calendar-editor-expense-status [data-expense-status="PLANNED"]').click();
  if (!/월 합계에 넣지 않아요/.test(text(editor.querySelector('.calendar-editor-money-hint')))) fail('planned hint');
  editor.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  await until(() => !root.querySelector('.c4-editor'), 'editor closes');
  result.editor = true;

  // 7) 월: 공휴일 이름, 선택한 날, 넓은 화면은 오른쪽 카드 · 휴대폰은 아래 목록
  await tab('month');
  await until(() => root.querySelector('.c4-mo'), 'month');
  const holidayCell = root.querySelector('.c4-mc[data-calendar-date-trigger="2026-10-09"]');
  if (!/한글날/.test(text(holidayCell.querySelector('.c4-mc-hol')))) fail('holiday name in the cell');
  holidayCell.click();
  await until(() => /한글날 · 공휴일/.test(text(strip())), 'holiday name in the strip');
  const dayList = root.querySelector(wide ? '.c4-daycard' : '.c4-agenda');
  if (!visible(dayList) || !/한글날 나들이/.test(text(dayList))) fail('selected day list');
  if (root.querySelector('.calendar-day-detail-backdrop')) fail('no overlay day detail');
  if (visibleAll('[data-calendar-add]').length !== 1 || text(visibleAll('[data-calendar-add]')[0]) !== '10월 9일 일정 추가') fail('one add button in month');
  result.month = true;

  // 8) 년 · 일정 목록
  await tab('year');
  await until(() => root.querySelectorAll('.c4-ym').length === 12 && root.querySelector('.c4-yr-chart'), 'year');
  await tab('agenda');
  await until(() => root.querySelectorAll('.c4-chip[data-agenda-scope]').length === 4, 'agenda chips');
  await until(() => ledgerTotal() === '126,000원', 'agenda keeps the month total');
  if (visibleAll('[data-calendar-add]').length !== 1 || visibleAll('[data-calendar-add-image]').length !== 1) fail('one add + one photo in agenda');
  result.yearAgenda = true;
  result.overflow = overflow();
  if (result.overflow > 1) fail('horizontal overflow ' + result.overflow);

  // 9) 사진 확인: 날짜가 다르면 두 건, 같으면 한 건. 누르기 전에는 저장하지 않는다.
  const creates = [];
  const controller = {create: async value => { creates.push(value); return {}; }};
  const draft = {title: '현장체험학습', localDate: '2026-10-23', localTime: '08:30', endLocalDate: null, endLocalTime: null, documentKind: 'RECEIPT', reviewNotices: [],
    dedupeFingerprint: 'a'.repeat(64), entry: {amountMinor: 25000, currency: 'KRW', expenseCategory: 'OTHER', expenseStatus: 'PLANNED', memo: null, place: null, merchant: '체험비 납부'}};
  let saved = '';
  const photo = manager.c4PhotoConfirmDialog({root, draft, previewUrl: '', fallbackDate: '2026-10-14', todayDate: '2026-10-14', controller, onSaved: async date => { saved = date; }});
  const save = photo.querySelector('[data-calendar-photo-save]');
  if (creates.length) fail('nothing saved before 등록');
  if (text(save) !== '등록') fail('same date reads as one entry: ' + text(save));
  const expenseDate = photo.querySelectorAll('.c4-fc')[1].querySelector('input[type="date"]');
  expenseDate.value = '2026-10-20';
  expenseDate.dispatchEvent(new Event('change', {bubbles: true}));
  if (text(save) !== '2건 등록') fail('different dates make two entries: ' + text(save));
  save.click();
  await until(() => saved === '2026-10-23', 'photo save');
  if (creates.length !== 2 || creates[0].amountMinor !== '' || creates[1].amountMinor !== 25000 || creates[1].expenseStatus !== 'PLANNED' || creates[1].localDate !== '2026-10-20') fail('split photo save ' + JSON.stringify(creates));
  if (creates[0].photoLogicalRequestId !== 'calimg-' + 'a'.repeat(40) || creates[1].photoLogicalRequestId !== 'calimg-' + 'a'.repeat(40) + '.x') fail('stable request ids');
  creates.length = 0; saved = '';
  const photo2 = manager.c4PhotoConfirmDialog({root, draft, previewUrl: '', fallbackDate: '2026-10-14', todayDate: '2026-10-14', controller, onSaved: async date => { saved = date; }});
  photo2.querySelector('[data-calendar-photo-save]').click();
  await until(() => saved === '2026-10-23', 'photo save same day');
  if (creates.length !== 1 || creates[0].amountMinor !== 25000 || creates[0].expenseCategory !== 'OTHER') fail('same-day photo is one entry with the amount');
  result.photo = true;

  // 10) 다크 모드: 카드가 흰 바탕으로 남지 않는다
  document.body.dataset.siteTheme = 'dark';
  await sleep(50);
  const cardBackground = getComputedStyle(root.querySelector('.c4-cal')).backgroundColor;
  if (cardBackground === 'rgb(255, 255, 255)') fail('dark card stays white');
  result.dark = cardBackground;
  result.ok = true;
  window.__c4result = JSON.stringify(result);
} catch (error) {
  window.__c4result = JSON.stringify({ok: false, error: String(error?.stack || error), viewport: {width: innerWidth, height: innerHeight}});
}
</script></body></html>`;

const cases = [
  {width: 1440, height: 1000},
  {width: 1280, height: 900},
  {width: 390, height: 844, touch: true},
  {width: 360, height: 780, touch: true},
];
const results = [];
for (const viewport of cases) {
  const value = await runFixturePage({
    root: ROOT,
    fixturePath: FIXTURE_PATH,
    fixtureHtml,
    resultExpression: 'window.__c4result || ""',
    viewport: {width: viewport.width, height: viewport.height},
    touch: Boolean(viewport.touch),
    timeoutMs: 120_000,
  });
  if (!value.ok) throw new Error(`CALENDAR DESIGN 04 FAIL ${viewport.width}x${viewport.height}: ${value.error}`);
  results.push(value);
}
console.log('CALENDAR DESIGN 04 PASS', JSON.stringify(results));
