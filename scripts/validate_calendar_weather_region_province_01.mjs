// 날씨 위치가 대표님이 겪은 그 반복에서 벗어났는지를 실제 브라우저에서 본다.
//
// 고친 것 네 가지가 한 화면에 얽혀 있어 한 곳에서 같이 본다:
//   1. 위치는 자유 텍스트가 아니라 광역시·도 → 시·군·구 두 단계로 고른다.
//   2. 권한이 이미 허용돼 있으면 버튼을 누르지 않아도 현재 위치를 쓴다.
//   3. 현재 위치는 시·군·구로 저장되어 새로고침 뒤에도 날씨가 남는다(좌표는 저장하지 않는다).
//   4. 권한 미결정 상태에서는 위치·알림 팝업이 저절로 뜨지 않는다.
// 여기에 설정창의 알림 항목(서버가 못 보내면 그리지 않음)과 상단 네 보기,
// 그리고 없어진 확인 필요 탭이 보여주던 기한 지남이 일정 보기에 남아 있는지까지 본다.
//
// 새로고침은 흉내내지 않는다: 같은 프로필(--user-data-dir)로 브라우저를 다시 띄워
// localStorage 만 남은 상태에서 화면을 처음부터 다시 그린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-weather-region-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// 오늘은 고정한다. 날씨는 오늘부터 14일까지만 조회하므로(WEATHER_FORECAST_HORIZON_DAYS)
// 예보가 붙는 칸도 이 날짜에 매여 있다.
const TODAY = '2026-09-23';

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// Core 가 실제로 내려주는 모양 그대로. 임의 필드를 만들지 않는다.
const REGIONS = {
  items: [
    {code: 'KR_SEOUL', label: '서울특별시', province: '서울특별시', latitude: 37.56661, longitude: 126.978388},
    {code: 'KR_SUWON', label: '수원시', province: '경기도', latitude: 37.263476, longitude: 127.028646},
    {code: 'KR_JEONJU', label: '전주시', province: '전북특별자치도', latitude: 35.824171, longitude: 127.14805},
    {code: 'KR_BUSAN', label: '부산광역시', province: '부산광역시', latitude: 35.179816, longitude: 129.075022},
  ],
  provinces: ['서울특별시', '경기도', '전북특별자치도', '부산광역시'],
  ai_calls: 0,
};

const COORDINATES = {
  '서울특별시': [37.56661, 126.978388],
  '경기도 수원시': [37.263476, 127.028646],
  '전북특별자치도 전주시': [35.824171, 127.14805],
  '부산광역시': [35.179816, 129.075022],
};

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const phase = new URL(location.href).searchParams.get('phase') || '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
const click = node => node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
const change = node => node.dispatchEvent(new Event('change', {bubbles: true}));
const REGIONS = ${JSON.stringify(REGIONS)};
// 좌표를 안 싣던 예전 Core. 8단계가 이 모양으로 답한다.
const REGIONS_WITHOUT_COORDINATES = {
  items: REGIONS.items.map(({code, label, province}) => ({code, label, province})),
  provinces: REGIONS.provinces,
  ai_calls: 0,
};
const COORDINATES = ${JSON.stringify(COORDINATES)};
const TODAY = '${TODAY}';
const result = {phase, ok: true};
try {
  // 알림 권한 팝업이 저절로 뜨지 않는지 보려면 실제로 세어야 한다.
  let notificationRequests = 0;
  let geolocationCalls = 0;
  let regionListRequests = 0;
  let resolveCalls = 0;
  // 6·7 단계만 서버를 끈다. 나머지 단계의 동작은 그대로다.
  let regionsHealthy = !(phase === '6' || phase === '7');
  const weatherRequests = [];
  if (!globalThis.Notification) globalThis.Notification = {permission: 'default'};
  globalThis.Notification.requestPermission = () => { notificationRequests += 1; return Promise.resolve('denied'); };

  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  const ACTIVITY = 'activity_' + 'a'.repeat(32);
  const OCCURRENCE = 'occurrence_' + 'b'.repeat(32);
  const OVERDUE_ACTIVITY = 'activity_' + 'c'.repeat(32);
  const OVERDUE_OCCURRENCE = 'occurrence_' + 'd'.repeat(32);
  const agendaItem = {
    projection_id: 'p1', activity_id: ACTIVITY, occurrence_id: OCCURRENCE,
    title: '이번 달 일정', activity_revision: 1, occurrence_revision: 1,
    local_date: TODAY, local_datetime: null, confirmation_level: 'USER_ATTESTED',
    provider_verified: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
  };
  // 지난 달 기한. 월 달력에도, 이번 달 일정 목록에도 없는 -- 확인 필요 탭이
  // 유일하게 보여주던 그 항목이다.
  const overdueItem = {
    projection_id: 'p2', activity_id: OVERDUE_ACTIVITY, occurrence_id: OVERDUE_OCCURRENCE,
    title: '지난달에 지난 기한', due_date: '2026-08-11', state: 'OVERDUE', days_until_due: -43,
    confirmation_level: 'USER_ATTESTED', provider_verified: false, source_kind: 'USER_INPUT',
    allowed_actions: ['UPDATE', 'REMOVE'],
  };
  const weatherItem = (date, kind, icon) => ({
    date, weather_icon: icon, weather_kind: kind, source: 'KMA_SHORT',
    issued_at: TODAY + 'T08:00:00Z', temperature_c: 25, min_temperature_c: 20,
    max_temperature_c: 27, precipitation_probability: 20, freshness: 'CACHE_VALID',
  });

  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname === '/app/config.json') {
      // 운영 서버의 실제 값: 서명 키가 없어 알림을 보낼 수 없다. phase 5 만 켜진 서버다.
      const on = phase === '5';
      return j({web_push: {
        enabled: on, ready: on, dispatch_ready: on,
        vapid_public_key: on ? 'BExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKey' : null,
        user_visible_only: true, service_worker_required: true,
      }});
    }
    if (u.pathname === '/v2/life/weather/regions') {
      // 서버가 200 이 아닌 답을 줄 때 화면이 무엇을 하는지 보는 자리다.
      if (!regionsHealthy) return Promise.resolve(new Response('{"detail":{"code":"UPSTREAM"}}', {status: 503, headers: {'Content-Type': 'application/json'}}));
      regionListRequests += 1;
      return j(phase === '8' ? REGIONS_WITHOUT_COORDINATES : REGIONS);
    }
    if (u.pathname === '/v2/life/weather/region/resolve') {
      // 목록이 좌표를 들고 오면 이 왕복은 한 번도 없어야 한다. 이 경로는 날씨
      // 조회와 분당 한도를 나눠 쓰므로, 세는 것 자체가 이 변경의 핵심이다.
      resolveCalls += 1;
      const q = u.searchParams.get('q') || '';
      const found = COORDINATES[q];
      if (!found) return j({provider_ready: true, found: false, ai_calls: 0});
      return j({provider_ready: true, found: true, label: q, latitude: found[0], longitude: found[1],
        coordinate_authority: 'NAVER_MAPS_GEOCODING', ai_calls: 0});
    }
    if (u.pathname === '/v2/life/weather') {
      weatherRequests.push(u.search);
      const hasPlace = u.searchParams.get('latitude') !== null || u.searchParams.get('manual_latitude') !== null;
      // 좌표가 없으면 예보도 없다. 바로 대표님이 새로고침 뒤에 본 빈 화면이다.
      return j({provider_ready: true, items: hasPlace
        ? [weatherItem(TODAY, 'CLOUDY', '☁️'), weatherItem('2026-09-24', 'RAIN', '🌧️')]
        : [], ai_calls: 0});
    }
    if (u.pathname === '/v2/life/attention') {
      return j({view: 'ATTENTION', as_of: TODAY + 'T00:00:00Z', timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY', items: [overdueItem], ai_calls: 0, provider_api_calls: 0});
    }
    if (u.pathname === '/v2/life/unscheduled') {
      return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    }
    if (u.pathname === '/v2/life/holidays') {
      return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture',
        supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    }
    if (u.pathname === '/v2/life/expense-summary') {
      return j({view: 'EXPENSE_SUMMARY', as_of: TODAY + 'T00:00:00Z', timezone: 'Asia/Seoul',
        start_date: '2026-09-01', end_date: '2026-09-30', coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY',
        currencies: [], entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0});
    }
    return j({view: 'AGENDA', as_of: TODAY + 'T00:00:00Z', timezone: 'Asia/Seoul',
      coverage: 'PERSONAL_ACTIVITY_ONLY', items: [agendaItem], ai_calls: 0, provider_api_calls: 0});
  };

  // 권한 상태는 단계마다 다르다. 'prompt' 는 미결정 -- 여기서 좌표를 물으면 팝업이 뜬다.
  let permissionState = {1: 'granted', 2: 'prompt', 3: 'denied', 4: 'denied', 5: 'granted', 6: 'denied', 7: 'denied', 8: 'denied', 9: 'prompt'}[phase];
  const permissions = {query: async () => ({state: permissionState})};
  const geolocation = {
    getCurrentPosition(onOk, onErr) {
      geolocationCalls += 1;
      if (phase === '9') permissionState = 'granted';
      if (permissionState !== 'granted') { onErr({code: 1, PERMISSION_DENIED: 1, message: 'denied'}); return; }
      // 전주 만성동 근처. 저장되는 것은 이 좌표가 아니라 시·군·구여야 한다.
      onOk({coords: {latitude: 35.8345, longitude: 127.1057, accuracy: 55}, timestamp: Date.now()});
    },
  };

  if (phase === '1' || phase === '3' || phase === '6' || phase === '8' || phase === '9') {
    // 1: 처음부터. 3: 저장된 지역 없이 권한이 거부된 상태.
    localStorage.clear();
    localStorage.setItem('lotbi.calendar.settings.v1', JSON.stringify({showKoreaHolidays: false}));
  }

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date(TODAY + 'T01:00:00Z'),
    locationProvider: geolocation, locationPermissions: permissions,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');

  const weatherCells = () => root.querySelectorAll('.calendar-weather-icon[data-weather-kind]').length;
  const storedRegion = () => { try { return JSON.parse(localStorage.getItem('lotbi.calendar.weather-region.v1') || 'null'); } catch { return null; } };
  const storedOrigin = () => localStorage.getItem('lotbi.calendar.weather-region-origin.v1');
  // 날씨 칸의 상태 문구. 위치 행에도 같은 클래스가 있어 마지막 것을 집는다.
  const weatherStatusText = dialog => {
    const select = dialog.querySelector('.calendar-settings-select[aria-label="날씨 지역 광역시·도"]');
    const section = select?.closest('.calendar-settings-section');
    if (!section) return '';
    return [...section.querySelectorAll('.calendar-settings-status')].at(-1)?.textContent || '';
  };
  const weatherOverview = dialog => ({
    summary: dialog.querySelector('.calendar-settings-weather-overview strong')?.textContent || '',
    relationship: dialog.querySelector('.calendar-settings-weather-overview small')?.textContent || '',
    manualClearVisible: !dialog.querySelector('[data-calendar-weather-manual-clear]')?.hidden,
  });
  const openSettings = async () => {
    click(root.querySelector('.calendar-settings-button'));
    await wait(() => root.querySelector('.calendar-settings-dialog'), 'settings dialog');
    return root.querySelector('.calendar-settings-dialog');
  };

  result.modeTabs = [...root.querySelectorAll('.calendar-mode-tab')].map(node => node.textContent);

  if (phase === '1') {
    // 아무것도 누르지 않았는데 날씨가 떠야 한다.
    await wait(() => weatherCells() > 0, 'weather without a press');
    result.weatherCells = weatherCells();
    result.toastShown = Boolean(root.querySelector('.calendar-toast'));
    await wait(() => storedRegion(), 'region stored from current location');
    result.storedRegion = storedRegion();
    result.storedOrigin = storedOrigin();
    // 브라우저가 준 정밀 좌표는 어디에도 남지 않는다.
    const dump = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    result.precisePositionLeaked = dump.includes('35.8345') || dump.includes('127.1057') || dump.includes('capturedAtMs');
    const dialog = await openSettings();
    result.statusText = dialog.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '';
    result.overview = weatherOverview(dialog);
    result.resolveCalls = resolveCalls;
  }

  if (phase === '2') {
    // 새로고침 뒤. 권한은 미결정으로 되돌아갔고(아이폰 Safari 가 권한 상태를 알려주지
    // 못하는 경우와 같은 자리다) 아무도 아무것도 누르지 않았다.
    await wait(() => weatherCells() > 0, 'weather survives a reload');
    result.weatherCells = weatherCells();
    result.geolocationCalls = geolocationCalls;
    result.notificationRequests = notificationRequests;
    result.storedRegion = storedRegion();
    result.storedOrigin = storedOrigin();
    result.weatherRequests = weatherRequests;
    const dialog = await openSettings();
    result.statusText = dialog.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '';
    result.overview = weatherOverview(dialog);
    result.hasTextInput = Boolean(dialog.querySelector('input[type="text"]'));
    result.hasNotificationSection = dialog.textContent.includes('일정 알림');
    result.selectLabels = [...dialog.querySelectorAll('.calendar-settings-select')]
      .map(node => node.getAttribute('aria-label'))
      .filter(label => label && label.startsWith('날씨 지역'));
    // 두 단계 모두 목록이 차 있고, 2단계에는 1단계에 속한 것만 있어야 한다.
    const province = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 광역시·도');
    const city = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 시·군·구');
    await wait(() => province.options.length > 1, 'province options');
    result.provinceOptions = [...province.options].map(o => o.textContent);
    result.preselectedProvince = province.value;
    result.cityOptions = [...city.options].map(o => o.textContent);
    // 지난 기한은 일정 보기에 남아 있다.
    click(root.querySelector('.calendar-settings-close'));
    const agendaTab = [...root.querySelectorAll('.calendar-mode-tab')].find(n => n.textContent === '일정');
    click(agendaTab);
    await wait(() => root.querySelector('[data-calendar-overdue-group]'), 'overdue group');
    const group = root.querySelector('[data-calendar-overdue-group]');
    result.overdueHeading = group.querySelector('h3')?.textContent || '';
    result.overdueTitles = [...group.querySelectorAll('.calendar-day-event strong')].map(n => n.textContent);
  }

  if (phase === '3') {
    // 권한 거부. 유일한 길은 두 단계 선택이고, 그것으로 날씨가 떠야 한다.
    result.weatherBefore = weatherCells();
    result.notificationRequests = notificationRequests;
    const dialog = await openSettings();
    result.hasTextInput = Boolean(dialog.querySelector('input[type="text"]'));
    result.hasNotificationSection = dialog.textContent.includes('일정 알림');
    const province = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 광역시·도');
    const city = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 시·군·구');
    await wait(() => province.options.length > 1, 'province options');
    province.value = '전북특별자치도';
    change(province);
    await wait(() => city.options.length > 1, 'city options');
    result.cityOptions = [...city.options].map(o => o.textContent);
    city.value = 'KR_JEONJU';
    change(city);
    await wait(() => weatherCells() > 0, 'weather from the chosen region');
    result.weatherCells = weatherCells();
    result.storedRegion = storedRegion();
    result.storedOrigin = storedOrigin();
    result.statusText = dialog.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '';
    result.overview = weatherOverview(dialog);
    // 권한이 거부된 사람에게는 어디를 눌러 허용하는지가 화면에 적혀 있어야 한다.
    const help = dialog.querySelector('[data-calendar-location-row] .calendar-settings-location-help');
    result.locationHelpShown = Boolean(help) && !help.hidden;
    result.locationHelpText = help ? help.textContent : '';
    result.resolveCalls = resolveCalls;
  }

  if (phase === '4') {
    // 직접 고른 지역도 새로고침을 넘긴다.
    await wait(() => weatherCells() > 0, 'chosen region survives a reload');
    result.weatherCells = weatherCells();
    result.storedRegion = storedRegion();
    result.storedOrigin = storedOrigin();
    const dialog = await openSettings();
    result.statusText = dialog.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '';
    result.overview = weatherOverview(dialog);
  }

  if (phase === '6') {
    // 목록 서버가 죽었다. 저장해 둔 목록도 없다 -- 대표님이 보신 그 빈 상자다.
    const dialog = await openSettings();
    const province = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 광역시·도');
    const retry = [...dialog.querySelectorAll('button')].find(n => n.textContent === '지역 목록 다시 불러오기');
    await wait(() => !retry.hidden, 'retry button');
    result.failureStatusText = weatherStatusText(dialog);
    result.failurePlaceholder = province.options[0]?.textContent || '';
    result.retryShown = !retry.hidden;
    // 서버가 돌아오면 다시 불러오기 한 번으로 목록이 찬다.
    regionsHealthy = true;
    click(retry);
    await wait(() => province.options.length > 1, 'province options after retry');
    result.provinceOptionsAfterRetry = [...province.options].map(o => o.textContent);
  }

  if (phase === '7') {
    // 서버는 여전히 죽어 있지만, 직전 단계에서 한 번 받아 둔 목록이 있다.
    const dialog = await openSettings();
    const province = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 광역시·도');
    const city = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 시·군·구');
    await wait(() => province.options.length > 1, 'province options from the saved list');
    result.regionListRequests = regionListRequests;
    result.cachedProvinceOptions = [...province.options].map(o => o.textContent);
    result.cachedStatusText = weatherStatusText(dialog);
    // 저장된 목록으로도 끝까지 갈 수 있어야 한다: 고르면 좌표를 묻고 날씨가 뜬다.
    province.value = '전북특별자치도';
    change(province);
    await wait(() => city.options.length > 1, 'city options from the saved list');
    city.value = 'KR_JEONJU';
    change(city);
    await wait(() => weatherCells() > 0, 'weather from the saved list');
    result.weatherCells = weatherCells();
    result.storedRegion = storedRegion();
  }

  if (phase === '8') {
    // 좌표를 안 싣는 예전 Core. 예전 길(지오코더에게 묻기)이 그대로 살아 있어야 한다.
    const dialog = await openSettings();
    const province = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 광역시·도');
    const city = [...dialog.querySelectorAll('.calendar-settings-select')].find(n => n.getAttribute('aria-label') === '날씨 지역 시·군·구');
    await wait(() => province.options.length > 1, 'province options');
    province.value = '전북특별자치도';
    change(province);
    await wait(() => city.options.length > 1, 'city options');
    city.value = 'KR_JEONJU';
    change(city);
    await wait(() => weatherCells() > 0, 'weather on a Core that sends no coordinates');
    result.weatherCells = weatherCells();
    result.storedRegion = storedRegion();
    result.resolveCalls = resolveCalls;
  }

  if (phase === '5') {
    // 서버가 알림을 보낼 수 있게 되면 코드를 고치지 않아도 항목이 돌아온다.
    const dialog = await openSettings();
    await wait(() => dialog.textContent.includes('일정 알림'), 'notification section returns');
    result.hasNotificationSection = true;
    result.notificationRequests = notificationRequests;
  }

  if (phase === '9') {
    // Settings가 열린 채로 현재 위치가 해결되는 경우. overview와 fallback
    // 해제 동작이 닫았다 다시 열지 않아도 같은 상태를 말해야 한다.
    const dialog = await openSettings();
    const currentLocation = dialog.querySelector('[data-calendar-location-row] button');
    click(currentLocation);
    await wait(
      () => weatherOverview(dialog).summary === '현재 지역 · 전북특별자치도 전주시',
      'live current-region overview',
    );
    result.dialogStayedOpen = dialog.isConnected;
    result.overview = weatherOverview(dialog);
    result.statusText = dialog.querySelector('[data-calendar-location-row] .calendar-settings-status')?.textContent || '';
    result.storedRegion = storedRegion();
    result.storedOrigin = storedOrigin();
  }

  out.textContent = JSON.stringify(result);
} catch (error) {
  out.textContent = JSON.stringify({phase, ok: false, error: String(error?.stack || error)});
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

function run(browser, profile, phase, width, height) {
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--force-device-scale-factor=1',
    '--virtual-time-budget=40000', '--dump-dom', `${ORIGIN}/${INNER_REL}?phase=${phase}`,
  ], {encoding: 'utf8', timeout: 180000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="calendar-result">';
  const b = '</pre>';
  const i = r.stdout.indexOf(a);
  const k = r.stdout.indexOf(b, i);
  if (i < 0 || k < 0) throw new Error(`phase ${phase}: result missing`);
  const raw = r.stdout.slice(i + a.length, k)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const value = JSON.parse(raw);
  if (!value.ok) throw new Error(`phase ${phase} (${width}x${height}): ${value.error}`);
  return value;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-weather-region-'));
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const results = {};
try {
  waitServer();
  // 휴대폰 폭에서 본다. 설정창이 제일 좁아지는 자리이고, 두 단계 선택이 넘치면
  // 여기서 넘친다.
  const [width, height] = [390, 844];

  results.granted = run(browser, profile, 1, width, height);
  if (!(results.granted.weatherCells > 0)) throw new Error('허용된 권한에서 버튼 없이 날씨가 뜨지 않았다');
  if (results.granted.toastShown) throw new Error('누르지도 않은 위치 사용을 알리는 토스트가 떴다');
  if (results.granted.storedRegion?.label !== '전북특별자치도 전주시') {
    throw new Error(`현재 위치가 시·군·구로 저장되지 않았다: ${JSON.stringify(results.granted.storedRegion)}`);
  }
  if (results.granted.storedOrigin !== 'CURRENT_LOCATION') throw new Error('저장된 지역의 출처가 현재 위치로 기록되지 않았다');
  if (results.granted.precisePositionLeaked) throw new Error('브라우저가 준 정밀 좌표가 브라우저 저장소에 남았다');
  if (!results.granted.statusText.includes('현재 위치')) throw new Error(`설정 문구가 현재 위치를 말하지 않는다: ${results.granted.statusText}`);
  // 목록이 좌표를 들고 오면 현재 위치를 시·군·구로 되돌리는 데 지오코더가 한 번도
  // 필요 없다. 이 왕복은 날씨 조회와 분당 한도를 나눠 쓰고, 목록이 한도보다 길어지면
  // 그 자리에서 날씨가 429 로 사라진다.
  if (results.granted.resolveCalls !== 0) {
    throw new Error(`목록이 좌표를 줬는데도 지오코더를 ${results.granted.resolveCalls}번 불렀다`);
  }

  // 같은 프로필로 다시 띄운다 = 새로고침. 권한은 미결정, 누르는 사람은 없다.
  results.reloaded = run(browser, profile, 2, width, height);
  if (!(results.reloaded.weatherCells > 0)) throw new Error('새로고침 뒤 날씨가 사라졌다');
  if (results.reloaded.geolocationCalls !== 0) throw new Error('권한 미결정 상태에서 위치를 물었다 -- 팝업이 뜬다');
  if (results.reloaded.notificationRequests !== 0) throw new Error('알림 권한을 저절로 물었다');
  if (results.reloaded.hasTextInput) throw new Error('설정창에 자유 텍스트 입력칸이 남아 있다');
  if (results.reloaded.hasNotificationSection) throw new Error('보낼 수 없는 알림 항목이 설정창에 남아 있다');
  if (results.reloaded.overview.summary !== '현재 지역 · 전북특별자치도 전주시') {
    throw new Error(`저장된 현재 지역 summary가 정확하지 않다: ${results.reloaded.overview.summary}`);
  }
  if (results.reloaded.selectLabels.join('|') !== '날씨 지역 광역시·도|날씨 지역 시·군·구') {
    throw new Error(`2단계 선택이 아니다: ${JSON.stringify(results.reloaded.selectLabels)}`);
  }
  if (results.reloaded.preselectedProvince !== '전북특별자치도') throw new Error('저장된 지역이 목록에서 선택된 채로 열리지 않았다');
  if (!results.reloaded.cityOptions.includes('전주시') || results.reloaded.cityOptions.includes('수원시')) {
    throw new Error(`2단계에 다른 광역시·도의 지역이 섞였다: ${JSON.stringify(results.reloaded.cityOptions)}`);
  }
  if (results.reloaded.modeTabs.join('/') !== '주/월/년/일정') throw new Error(`상단 탭은 주/월/년/일정이다: ${results.reloaded.modeTabs.join('/')}`);
  if (results.reloaded.overdueHeading !== '기한 지남') throw new Error('일정 보기에 기한 지남 묶음이 없다');
  if (!results.reloaded.overdueTitles.includes('지난달에 지난 기한')) {
    throw new Error(`지금 달에 없는 지난 기한이 어디에도 보이지 않는다: ${JSON.stringify(results.reloaded.overdueTitles)}`);
  }

  results.denied = run(browser, profile, 3, width, height);
  if (results.denied.hasTextInput) throw new Error('권한 거부 화면에 자유 텍스트 입력칸이 있다');
  if (results.denied.hasNotificationSection) throw new Error('보낼 수 없는 알림 항목이 설정창에 남아 있다');
  if (results.denied.notificationRequests !== 0) throw new Error('알림 권한을 저절로 물었다');
  if (!results.denied.cityOptions.includes('전주시')) throw new Error('2단계에 전주시가 없다');
  if (!(results.denied.weatherCells > 0)) throw new Error('권한을 거부하면 지역을 골라도 날씨를 볼 수 없다');
  if (results.denied.storedRegion?.label !== '전북특별자치도 전주시') throw new Error('직접 고른 지역이 저장되지 않았다');
  if (results.denied.storedOrigin !== 'MANUAL') throw new Error('직접 고른 지역이 그렇게 기록되지 않았다');
  if (results.denied.resolveCalls !== 0) {
    throw new Error(`목록이 좌표를 줬는데도 지역을 고를 때 지오코더를 불렀다: ${results.denied.resolveCalls}`);
  }
  if (!results.denied.locationHelpShown) throw new Error('권한이 거부됐는데 어디서 허용하는지 안내가 없다');
  for (const needle of ['삼성 인터넷', '자물쇠', '설정']) {
    if (!results.denied.locationHelpText.includes(needle)) {
      throw new Error(`권한 안내가 누를 것의 이름을 말하지 않는다(${needle} 없음): ${results.denied.locationHelpText}`);
    }
  }

  results.deniedReloaded = run(browser, profile, 4, width, height);
  if (!(results.deniedReloaded.weatherCells > 0)) throw new Error('직접 고른 지역이 새로고침을 넘기지 못했다');
  if (results.deniedReloaded.overview.summary !== '수동 지역 · 전북특별자치도 전주시') {
    throw new Error(`직접 고른 지역 summary가 정확하지 않다: ${results.deniedReloaded.overview.summary}`);
  }

  // 서버가 켜지면 코드를 고치지 않아도 알림 항목이 돌아온다 -- 지운 것이 아니라 가린 것이다.
  results.pushReady = run(browser, profile, 5, width, height);
  if (!results.pushReady.hasNotificationSection) throw new Error('서버가 준비됐는데도 알림 항목이 돌아오지 않았다');

  results.liveSettings = run(browser, profile, 9, width, height);
  if (!results.liveSettings.dialogStayedOpen) throw new Error('현재 위치 해결 중 Settings가 닫혔다');
  if (results.liveSettings.overview.summary !== '현재 지역 · 전북특별자치도 전주시') {
    throw new Error(`열린 Settings가 현재 지역을 즉시 반영하지 않았다: ${results.liveSettings.overview.summary}`);
  }
  if (!results.liveSettings.overview.relationship.includes('현재 위치를 우선 사용')) {
    throw new Error(`현재 위치와 fallback 관계가 즉시 갱신되지 않았다: ${results.liveSettings.overview.relationship}`);
  }
  if (!results.liveSettings.overview.manualClearVisible) throw new Error('저장된 fallback 해제 동작이 열린 Settings에 나타나지 않았다');

  // 목록 서버가 죽었을 때. 화면이 이유를 말하고, 다시 불러오기로 되살아나야 한다.
  results.listDown = run(browser, profile, 6, width, height);
  if (!results.listDown.retryShown) throw new Error('목록을 못 불러왔는데 다시 불러오기 버튼이 없다');
  if (results.listDown.failurePlaceholder !== '목록을 불러오지 못했어요') {
    throw new Error(`1단계 칸이 실패를 말하지 않는다: ${results.listDown.failurePlaceholder}`);
  }
  if (!results.listDown.failureStatusText.includes('503')) {
    throw new Error(`실패 이유(응답 코드)를 화면이 말하지 않는다: ${results.listDown.failureStatusText}`);
  }
  if (!results.listDown.provinceOptionsAfterRetry.includes('전북특별자치도')) {
    throw new Error(`서버가 돌아왔는데 다시 불러오기로 목록이 차지 않는다: ${JSON.stringify(results.listDown.provinceOptionsAfterRetry)}`);
  }

  // 서버가 여전히 죽어 있어도, 한 번 받아 둔 목록이 있으면 고를 수 있어야 한다.
  results.listDownCached = run(browser, profile, 7, width, height);
  if (results.listDownCached.regionListRequests !== 0) throw new Error('죽은 서버에서 목록을 받아온 것처럼 셌다 -- 시험이 틀렸다');
  if (!results.listDownCached.cachedProvinceOptions.includes('전북특별자치도')) {
    throw new Error(`저장해 둔 목록이 있는데도 고를 것이 없다: ${JSON.stringify(results.listDownCached.cachedProvinceOptions)}`);
  }
  if (!results.listDownCached.cachedStatusText.includes('전에 받아 둔 목록')) {
    throw new Error(`저장해 둔 목록을 쓰고 있다는 사실을 숨긴다: ${results.listDownCached.cachedStatusText}`);
  }
  if (!(results.listDownCached.weatherCells > 0)) throw new Error('저장해 둔 목록으로 고른 지역의 날씨가 뜨지 않는다');
  if (results.listDownCached.storedRegion?.label !== '전북특별자치도 전주시') {
    throw new Error(`저장해 둔 목록으로 고른 지역이 저장되지 않았다: ${JSON.stringify(results.listDownCached.storedRegion)}`);
  }

  // 좌표를 안 싣는 예전 Core 에서도 예전 길이 그대로 굴러가야 한다.
  results.noCoordinates = run(browser, profile, 8, width, height);
  if (!(results.noCoordinates.weatherCells > 0)) throw new Error('좌표를 안 싣는 서버에서 고른 지역의 날씨가 뜨지 않는다');
  if (results.noCoordinates.storedRegion?.label !== '전북특별자치도 전주시') {
    throw new Error(`좌표를 안 싣는 서버에서 지역이 저장되지 않았다: ${JSON.stringify(results.noCoordinates.storedRegion)}`);
  }
  if (!(results.noCoordinates.resolveCalls > 0)) throw new Error('좌표가 없는데도 지오코더에게 묻지 않았다 -- 좌표를 어디선가 지어냈다');

  console.log('CALENDAR WEATHER REGION PROVINCE PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(profile, {recursive: true, force: true});
}
