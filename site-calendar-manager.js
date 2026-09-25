Warning: truncated output (original token count: 50049)
Total output lines: 4135

import {createLifeActivity, editLifeActivity, getCalendarWeather, getKoreaHolidays, getLifeActivity, getLifeAgenda, getLifeAttention, getLifeExpenseSummary, getLifeUnscheduled, removeLifeActivity} from './site-calendar.js?v=aset-6c31fddb37a5';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-6c31fddb37a5';
import {
  addCivilDays,
  calendarMonthGrid,
  calendarYearOverview,
  civilDateParts,
  formatCivilDate,
  groupCalendarEvents,
  monthGridRange,
  sortCalendarEvents,
  validCivilDate,
} from './site-calendar-model.js?v=aset-6c31fddb37a5';
import {calendarExpenseSummaryNode, expenseSummaryFromEntries, EXPENSE_CATEGORY_CHOICES} from './site-calendar-expense.js?v=aset-6c31fddb37a5';
// One version string, matching site-calendar.js: a second query string makes a
// second module instance, and then the SiteCoreError this file compares against
// is a different class from the one site-calendar.js throws. site-core.js is
// unchanged here, so it keeps the version the Calendar already loads.
import {CORE_ORIGIN, sendConversationMessage, uploadConversationAttachment, SiteCoreError} from './site-core.js?v=aset-6c31fddb37a5';
import {calendarWeatherAttribution, calendarWeatherByDate, calendarWeatherIconNode} from './site-calendar-weather.js?v=aset-6c31fddb37a5';
import {
  calendarEventPresentation,
  calendarWeatherPresentation,
  calendarWeekDays,
  filterScheduleItems,
  monthCellSummary,
  weekAgendaGroups,
} from './site-calendar-product.js?v=aset-6c31fddb37a5';
import {getPublicCalendarWeather, resolvePublicWeatherRegion} from './site-calendar-public-weather.js?v=aset-6c31fddb37a5';
import {clearCalendarManualWeatherRegion, readCalendarManualWeatherRegion, writeCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-6c31fddb37a5';
import {BROWSER_NOTIFICATION_PERMISSION, getBrowserNotificationPermissionState, requestBrowserNotificationPermissionForFeature} from './site-calendar-notifications.js?v=aset-6c31fddb37a5';
import {getCalendarPushConfig, registerCalendarPushSubscriptionWithCore, registerCalendarPushWorker, subscribeCalendarPush} from './site-calendar-push.js?v=aset-6c31fddb37a5';
import {BrowserLocationError, getBrowserLocationPermissionState, isFreshBrowserCurrentLocation, LOCATION_PERMISSION, LOCATION_RESOLUTION, requestBrowserCurrentLocation} from './site-current-location.js?v=aset-6c31fddb37a5';

// The expense summary covers the calendar month itself, not the 42-cell grid:
// the grid spills into the neighbouring months and those amounts do not belong
// in this month's total.
function civilMonthRange(year, month) {
  const start = formatCivilDate(year, month, 1);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {start, end: addCivilDays(formatCivilDate(nextYear, nextMonth, 1), -1)};
}

const DEFAULT_TIMEZONE = 'Asia/Seoul';
const WEEKDAYS = Object.freeze(['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']);
const WEEKDAY_INITIALS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);

// The seven weekday indices in the order the grid lays them out.
function weekdayOrder(weekStart = 0) {
  const start = Number.isInteger(weekStart) ? ((weekStart % 7) + 7) % 7 : 0;
  return Array.from({length: 7}, (_, index) => (start + index) % 7);
}
// 확인 필요 탭은 없앴다. 그 탭이 모아 보여준 기한 예정·오늘 기한은 월 달력이
// attentionDates 로 이미 같은 날짜에 표시하고 있었고, 남은 하나 -- 지금 달에 없는
// 지난 기한 -- 은 일정 보기의 '기한 지남' 묶음이 이어받는다(renderAgenda). 탭만
// 사라지고 지난 기한이 조용히 사라지지는 않는다.
const MODES = Object.freeze([['week', '주'], ['month', '월'], ['year', '년'], ['agenda', '일정']]);
const CALENDAR_SETTINGS_STORAGE_KEY = 'lotbi.calendar.settings.v1';
const CALENDAR_PUSH_SUBSCRIPTION_STORAGE_KEY = 'lotbi.calendar.push-subscription.v1';
// 저장된 날씨 지역이 어디서 왔는지. 지역 자체는 site-calendar-weather-region.js 가
// 한 키에 담고, 이 값은 그 지역을 화면에서 어떻게 설명할지와 -- 더 중요하게 --
// 자동으로 덮어써도 되는지를 가른다: 사용자가 직접 고른 지역은 현재 위치가
// 자동으로 지우지 않는다.
const CALENDAR_WEATHER_REGION_ORIGIN_STORAGE_KEY = 'lotbi.calendar.weather-region-origin.v1';
const CALENDAR_WEATHER_REGION_SYNC_EVENT = 'lotbi:calendar-weather-region-sync';
// 시·군·구 목록과 그 좌표. 공개 행정구역 정보이며 개인 위치가 아니다.
const CALENDAR_WEATHER_REGION_CATALOG_STORAGE_KEY = 'lotbi.calendar.weather-region-catalog.v1';
const CALENDAR_WEATHER_REGION_CATALOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// 광역시·도 → 시·군·구 목록 자체(이름과 소속만, 좌표 없음). 한 번 받아 두면
// 서버가 잠깐 흔들려도 고를 것이 사라지지 않는다.
const CALENDAR_WEATHER_REGION_LIST_STORAGE_KEY = 'lotbi.calendar.weather-region-list.v1';
const CALENDAR_WEATHER_REGION_LIST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// 목록에서 가장 가까운 시·군·구가 이보다 멀면 현재 위치를 지역으로 옮기지 않는다.
// 국내 어디서든 이 안에 하나는 들어오므로, 걸린다면 그건 국내가 아닌 좌표다.
const CALENDAR_WEATHER_REGION_SNAP_MAX_KM = 200;
// 대표님이 보신 문구는 "브라우저 사이트 설정에서 위치 권한을 허용해 주세요" 한 줄이
// 전부였고, 그래서 어디를 눌러야 하는지 알 수 없었다. 기기별로 실제로 눌러야 하는
// 것의 이름을 적는다. 브라우저 종류를 UA 로 추측하지 않는다: 틀리면 없는 메뉴를
// 찾게 만들고, 그것이 지금보다 나쁘다.
const LOCATION_PERMISSION_STEPS = Object.freeze([
  '안드로이드(삼성 인터넷·크롬): 주소창 왼쪽의 자물쇠 또는 ⓘ 를 누르고 → 권한 → 위치 → 허용으로 바꾼 뒤, 이 화면을 새로고침해 주세요.',
  '그래도 안 되면 휴대폰 설정 → 애플리케이션 → 쓰고 계신 브라우저(삼성 인터넷·Chrome) → 권한 → 위치를 허용으로 바꿔 주세요.',
  '아이폰(사파리): 설정 → Safari → 위치 → 허용으로 바꾸고, 설정 → 개인정보 보호 및 보안 → 위치 서비스가 켜져 있는지 확인해 주세요.',
  '허용하지 않으셔도 됩니다. 아래에서 광역시·도와 시·군·구를 고르시면 같은 날씨가 나옵니다.',
]);

const WEATHER_REGION_ORIGIN = Object.freeze({
  MANUAL: 'MANUAL',
  CURRENT_LOCATION: 'CURRENT_LOCATION',
});

export function calendarWeatherLocationPresentation({
  manualWeatherRegion = null,
  weatherRegionOrigin = null,
  usingBrowserLocation = false,
  locationPermission = LOCATION_PERMISSION.UNKNOWN,
  locationResolution = LOCATION_RESOLUTION.IDLE,
  locationInFlight = false,
  locationMessage = '',
} = {}) {
  const label = typeof manualWeatherRegion?.label === 'string'
    ? manualWeatherRegion.label.trim()
    : '';
  const currentAction = locationInFlight
    ? '위치 확인 중…'
    : usingBrowserLocation
      ? '변경'
      : [LOCATION_RESOLUTION.TIMEOUT, LOCATION_RESOLUTION.ERROR].includes(locationResolution)
        && ![LOCATION_PERMISSION.DENIED, LOCATION_PERMISSION.UNAVAILABLE].includes(locationPermission)
        ? '다시 시도'
        : '현재 위치 사용';

  let currentStatus = '버튼을 누를 때만 위치 권한을 요청합니다.';
  if (locationInFlight) currentStatus = '현재 위치를 확인하는 중…';
  else if (locationPermission === LOCATION_PERMISSION.DENIED) currentStatus = '브라우저 사이트 설정에서 위치 권한을 허용해 주세요.';
  else if (locationPermission === LOCATION_PERMISSION.UNAVAILABLE) currentStatus = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
  else if (usingBrowserLocation) currentStatus = '현재 위치로 날씨를 표시합니다.';
  else if (locationMessage) currentStatus = locationMessage;

  const manualSummary = label
    ? `${weatherRegionOrigin === WEATHER_REGION_ORIGIN.CURRENT_LOCATION ? '현재 지역' : '수동 지역'} · ${label}`
    : '수동 지역이 선택되지 않았습니다.';
  let relationship = '아래에서 광역시·도와 시·군·구를 선택할 수 있습니다.';
  if (usingBrowserLocation && label) {
    relationship = '현재 위치를 우선 사용하고, 사용할 수 없으면 저장된 지역으로 전환합니다.';
  } else if (label) {
    relationship = '현재 위치를 사용할 수 없으면 수동 지역의 날씨를 표시합니다.';
  }

  return {currentAction, currentStatus, manualSummary, relationship};
}

function readWeatherRegionOrigin(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(CALENDAR_WEATHER_REGION_ORIGIN_STORAGE_KEY);
    return raw === WEATHER_REGION_ORIGIN.MANUAL || raw === WEATHER_REGION_ORIGIN.CURRENT_LOCATION
      ? raw
      : null;
  } catch {
    return null;
  }
}

function writeWeatherRegionOrigin(storage, origin) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    if (origin === null) storage.removeItem?.(CALENDAR_WEATHER_REGION_ORIGIN_STORAGE_KEY);
    else storage.setItem(CALENDAR_WEATHER_REGION_ORIGIN_STORAGE_KEY, origin);
  } catch {
    // 지역 자체는 저장됐다. 출처를 못 적으면 문구가 덜 구체적일 뿐이다.
  }
}

// 목록을 못 불러왔을 때 화면이 이유를 말할 수 있게 갈래를 나눈다. 전에는 네 가지
// 원인이 모두 "불러오지 못했어요" 한 문장으로 뭉개졌고, 그래서 요청이 안 나간 것인지
// 나갔는데 거절당한 것인지 화면만 보고는 아무도 알 수 없었다.
const WEATHER_REGION_LIST_FAILURE = Object.freeze({
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  HTTP: 'HTTP',
  CONTRACT: 'CONTRACT',
  UNSUPPORTED: 'UNSUPPORTED',
});
const WEATHER_REGION_LIST_TIMEOUT_MS = 10_000;

function weatherRegionListFailureCopy(failure) {
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.TIMEOUT) {
    return '지역 목록 서버가 제때 응답하지 않았어요.';
  }
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.HTTP) {
    return `지역 목록 서버가 요청을 받아주지 않았어요 (응답 코드 ${failure.status}).`;
  }
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.CONTRACT) {
    return '지역 목록의 형식이 이 화면이 아는 것과 달라요.';
  }
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.UNSUPPORTED) {
    return '이 브라우저에서는 지역 목록을 불러올 수 없어요.';
  }
  return '지역 목록 서버에 연결하지 못했어요. 인터넷 연결이나 광고·추적 차단 기능을 확인해 주세요.';
}

// 한 번 더 걸어 볼 가치가 있는 실패인지. 형식이 어긋난 응답은 다시 물어도 같은
// 답이 오므로 되묻지 않는다.
function retryableWeatherRegionListFailure(failure) {
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.NETWORK) return true;
  if (failure?.kind === WEATHER_REGION_LIST_FAILURE.TIMEOUT) return true;
  return failure?.kind === WEATHER_REGION_LIST_FAILURE.HTTP && Number(failure.status) >= 500;
}

// 날씨 조회가 받아 주는 범위와 같은 범위다(site-calendar-public-weather.js).
// 여기서 통과시킨 좌표가 저기서 422 로 거절당하면 지역은 저장됐는데 날씨만
// 없는 상태가 된다.
function koreaCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < 31 || lat > 44.5
    || lon < 122 || lon > 132.5
  ) return {};
  return {latitude: lat, longitude: lon};
}

// 목록에 좌표가 없는 서버를 만났을 때, 행마다 지오코더에게 물어도 되는 최대 행
// 수. /v2/life/weather/region/resolve 는 /v2/life/weather/public 과 같은 창
// (클라이언트당 분당 30회)을 쓴다. 행마다 묻다가 한도를 넘기면 정작 날씨 조회가
// 429 로 막혀 화면에서 날씨가 사라진다. 그럴 바에는 현재 위치를 시·군·구로
// 되돌리지 않고 저장된 지역을 그대로 쓰는 편이 낫다.
const CALENDAR_WEATHER_REGION_GEOCODE_MAX = 16;

function weatherRegionCatalogFromItems(rawItems, rawProvinces) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter(item => (
      item
      && typeof item === 'object'
      && typeof item.code === 'string'
      && item.code.trim()
      && typeof item.label === 'string'
      && item.label.trim()
      && typeof item.province === 'string'
      && item.province.trim()
    ))
    .map(item => Object.freeze({
      code: item.code.trim(),
      label: item.label.trim(),
      province: item.province.trim(),
      // 화면과 저장에는 이 이름을 쓴다. 지오코더가 돌려주는 이름은 통합 개편안처럼
      // 사용자가 고르지 않은 이름일 수 있어(광주광역시 → 전남광주통합특별시)
      // 고른 것과 다른 이름을 보여주게 된다.
      displayLabel: item.province === item.label ? item.label.trim() : `${item.province.trim()} ${item.label.trim()}`,
      // Core 가 목록에 좌표를 실어 보내면 그것을 쓴다. 안 보내는 서버(예전 배포)
      // 라면 undefined 로 남고, 고른 뒤에 지오코더에게 묻는 예전 길로 간다.
      ...koreaCoordinates(item.latitude, item.longitude),
    }));
  if (!items.length) return null;
  const provinces = Array.isArray(rawProvinces)
    ? rawProvinces.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
    : [];
  // 1단계에서 고를 수 있는데 2단계가 비는 광역시·도는 막다른 골목이다. 서버가 보낸
  // 순서는 지키되, 실제로 갈 곳이 있는 것만 남긴다.
  const reachable = new Set(items.map(item => item.province));
  const ordered = (provinces.length ? provinces : [...reachable]).filter(province => reachable.has(province));
  return Object.freeze({
    items: Object.freeze(items),
    provinces: Object.freeze([...new Set(ordered)]),
  });
}

// 광역시·도 → 시·군·구 2단계 선택의 원본. Core 가 두 단계를 모두 내려준다:
// items[].province 가 1단계, items[].label 이 2단계다.
//
// 실패해도 catalog 를 null 로 뭉개 버리지 않고 왜 실패했는지 함께 돌려준다.
// 화면은 그 이유를 사람에게 그대로 적어 주고, 우리는 다음에 같은 신고를 받았을 때
// 코드를 읽는 대신 그 문장을 읽는다.
async function readCalendarWeatherRegions(fetchImpl = globalThis.fetch, {attempts = 2} = {}) {
  if (typeof fetchImpl !== 'function') {
    return {catalog: null, failure: {kind: WEATHER_REGION_LIST_FAILURE.UNSUPPORTED, status: 0}};
  }
  let last = {catalog: null, failure: {kind: WEATHER_REGION_LIST_FAILURE.NETWORK, status: 0}};
  const total = Math.max(1, Math.min(3, Number(attempts) || 1));
  for (let attempt = 0; attempt < total; attempt += 1) {
    last = await requestCalendarWeatherRegions(fetchImpl);
    if (last.catalog) return last;
    if (!retryableWeatherRegionListFailure(last.failure)) return last;
  }
  return last;
}

async function requestCalendarWeatherRegions(fetchImpl) {
  // 응답이 오지 않는 요청은 실패보다 나쁘다: 화면이 '불러오는 중…' 에 영원히 멈춰
  // 서서 다시 불러오기 버튼조차 나오지 않는다.
  let controller = null;
  let timer = null;
  try { controller = typeof AbortController === 'function' ? new AbortController() : null; } catch { controller = null; }
  if (controller) {
    timer = globalThis.setTimeout?.(() => { try { controller.abort(); } catch {} }, WEATHER_REGION_LIST_TIMEOUT_MS);
  }
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/v2/life/weather/regions`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
      ...(controller ? {signal: controller.signal} : {}),
    });
  } catch (error) {
    console.warn('[LOTBI 캘린더] 날씨 지역 목록을 불러오지 못했습니다.', error);
    const aborted = error?.name === 'AbortError';
    return {
      catalog: null,
      failure: {kind: aborted ? WEATHER_REGION_LIST_FAILURE.TIMEOUT : WEATHER_REGION_LIST_FAILURE.NETWORK, status: 0},
    };
  } finally {
    if (timer !== null) globalThis.clearTimeout?.(timer);
  }
  if (!response?.ok) {
    console.warn('[LOTBI 캘린더] 날씨 지역 목록 응답이 실패했습니다.', response?.status);
    return {catalog: null, failure: {kind: WEATHER_REGION_LIST_FAILURE.HTTP, status: Number(response?.status) || 0}};
  }
  let payload = {};
  try { payload = await response.json(); } catch {}
  // 계약이 어긋나면 임의로 채우지 않고 없는 것으로 둔다.
  if (!Array.isArray(payload?.items) || payload.ai_calls !== 0) {
    console.warn('[LOTBI 캘린더] 날씨 지역 목록 형식이 올바르지 않습니다.');
    return {catalog: null, failure: {kind: WEATHER_REGION_LIST_FAILURE.CONTRACT, status: Number(response.status) || 0}};
  }
  const catalog = weatherRegionCatalogFromItems(payload.items, payload.provinces);
  if (!catalog) {
    return {catalog: null, failure: {kind: WEATHER_REGION_LIST_FAILURE.CONTRACT, status: Number(response.status) || 0}};
  }
  return {catalog, failure: null};
}

// 현재 위치 경로는 이유까지는 쓸 데가 없다. 목록이 있으면 쓰고 없으면 그만이다.
async function fetchCalendarWeatherRegions(fetchImpl = globalThis.fetch, storage = null) {
  const {catalog} = await readCalendarWeatherRegions(fetchImpl);
  if (catalog && storage) writeCalendarWeatherRegionList(storage, catalog);
  return catalog;
}

// 한 번 받아 둔 목록은 남겨 둔다. 서버가 잠깐 흔들려도 -- 지하철에서 신호가
// 끊겨도 -- 고를 것이 하나도 없는 빈 상자를 보여주지 않기 위해서다. 좌표는 여기
// 없다: 이름과 소속뿐이고, 좌표는 고른 뒤에 Core 에게 다시 묻는다.
function readCalendarWeatherRegionList(storage, now = Date.now) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const parsed = JSON.parse(storage.getItem(CALENDAR_WEATHER_REGION_LIST_STORAGE_KEY) || 'null');
    const savedAtMs = Number(parsed?.savedAtMs);
    if (!Number.isFinite(savedAtMs)) return null;
    const current = typeof now === 'function' ? Number(now()) : Number(now);
    if (!Number.isFinite(current) || current - savedAtMs > CALENDAR_WEATHER_REGION_LIST_MAX_AGE_MS) return null;
    return weatherRegionCatalogFromItems(parsed?.items, parsed?.provinces);
  } catch {
    return null;
  }
}

function writeCalendarWeatherRegionList(storage, catalog, now = Date.now) {
  if (!storage || typeof storage.setItem !== 'function' || !catalog?.items?.length) return;
  try {
    storage.setItem(CALENDAR_WEATHER_REGION_LIST_STORAGE_KEY, JSON.stringify({
      savedAtMs: typeof now === 'function' ? Number(now()) : Number(now),
      items: catalog.items.map(item => ({
        code: item.code,
        label: item.label,
        province: item.province,
        ...koreaCoordinates(item.latitude, item.longitude),
      })),
      provinces: [...catalog.provinces],
    }));
  } catch {
    // 저장에 실패해도 이번 화면은 이미 목록을 들고 있다.
  }
}

// 목록이 좌표를 들고 왔으면 지오코더를 한 번도 부르지 않는다. 좌표를 한 행이라도
// 빠뜨린 목록은 반쪽으로 쓰지 않고 통째로 없는 것으로 본다: 빠진 행이 하필 그
// 사람의 동네면, 가장 가까운 곳을 고른 결과가 엉뚱한 곳이 된다.
function catalogEntriesFromListedCoordinates(catalog) {
  const items = catalog?.items || [];
  if (!items.length) return null;
  const entries = items
    .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map(item => Object.freeze({
      code: item.code,
      province: item.province,
      label: item.displayLabel,
      latitude: item.latitude,
      longitude: item.longitude,
    }));
  return entries.length === items.length ? entries : null;
}

// 좌표는 Core 의 지오코딩이 유일한 권위다. 여기서 만들어 내지 않는다.
async function resolveCatalogRegionCoordinates(item, fetchImpl) {
  try {
    const result = await resolvePublicWeatherRegion(item.displayLabel, fetchImpl);
    if (!result?.providerReady || !result.found || !result.region) return null;
    return Object.freeze({
      code: item.code,
      province: item.province,
      label: item.displayLabel,
      latitude: result.region.latitude,
      longitude: result.region.longitude,
    });
  } catch (error) {
    console.warn(`[LOTBI 캘린더] 지역 좌표를 확인하지 못했습니다: ${item.displayLabel}`, error);
    return null;
  }
}

function readCalendarWeatherRegionCatalog(storage, now = Date.now) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const parsed = JSON.parse(storage.getItem(CALENDAR_WEATHER_REGION_CATALOG_STORAGE_KEY) || 'null');
    const savedAtMs = Number(parsed?.savedAtMs);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : null;
    if (!entries?.length || !Number.isFinite(savedAtMs)) return null;
    const current = typeof now === 'function' ? Number(now()) : Number(now);
    if (!Number.isFinite(current) || current - savedAtMs > CALENDAR_WEATHER_REGION_CATALOG_MAX_AGE_MS) return null;
    const usable = entries.filter(entry => (
      entry
      && typeof entry.label === 'string'
      && entry.label
      && Number.isFinite(Number(entry.latitude))
      && Number.isFinite(Number(entry.longitude))
    ));
    return usable.length ? usable : null;
  } catch {
    return null;
  }
}

function writeCalendarWeatherRegionCatalog(storage, entries, now = Date.now) {
  if (!storage || typeof storage.setItem !== 'function' || !entries?.length) return;
  try {
    storage.setItem(CALENDAR_WEATHER_REGION_CATALOG_STORAGE_KEY, JSON.stringify({
      savedAtMs: typeof now === 'function' ? Number(now()) : Number(now),
      entries,
    }));
  } catch {
    // 캐시가 없으면 다음에 다시 물어보면 된다.
  }
}

function distanceKilometres(from, to) {
  const radius = 6371;
  const toRadians = value => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestCatalogRegion(entries, coordinates) {
  let best = null;
  for (const entry of entries || []) {
    const distanceKm = distanceKilometres(coordinates, {
      latitude: Number(entry.latitude),
      longitude: Number(entry.longitude),
    });
    if (!Number.isFinite(distanceKm)) continue;
    if (!best || distanceKm < best.distanceKm) best = {entry, distanceKm};
  }
  if (!best || best.distanceKm > CALENDAR_WEATHER_REGION_SNAP_MAX_KM) return null;
  return best;
}

// Everything the Calendar stores about display lives under one key, so a write
// has to merge rather than replace: a setting this function does not know about
// -- one a later feature adds, or one another surface wrote -- must survive
// someone toggling the holidays switch.
function readStoredCalendarSettings(storage) {
  if (!storage || typeof storage.getItem !== 'function') return {};
  try {
    const raw = storage.getItem(CALENDAR_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // A corrupt blob, a bare array, a stored null: all the same as no settings.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Only the two starts Korean calendars actually offer. Anything else stored --
// by hand, by a bug, by an older build -- falls back to Sunday rather than
// rotating the grid to something nobody chose.
export const CALENDAR_WEEK_STARTS = Object.freeze([
  {value: 0, label: '일요일'},
  {value: 1, label: '월요일'},
]);

function normalizeWeekStart(value) {
  return CALENDAR_WEEK_STARTS.some(option => option.value === value) ? value : 0;
}

export function readCalendarDisplaySettings(storage = globalThis.localStorage) {
  const stored = readStoredCalendarSettings(storage);
  return Object.freeze({
    // Every display setting defaults to what the Calendar shipped with, so an
    // empty or unreadable store renders exactly today's screen.
    showKoreaHolidays: stored.showKoreaHolidays !== false,
    showGridLines: stored.showGridLines !== false,
    weekStart: normalizeWeekStart(stored.weekStart),
  });
}

function writeCalendarDisplaySettings(storage, settings) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify({
      // Keep what is already stored...
      ...readStoredCalendarSettings(storage),
      // ...and write only the keys this module owns. The caller hands over the
      // live Calendar state, so nothing else from that object may leak in here.
      showKoreaHolidays: settings?.showKoreaHolidays !== false,
      showGridLines: settings?.showGridLines !== false,
      weekStart: normalizeWeekStart(settings?.weekStart),
    }));
  } catch {
    // Device/browser storage failure must not block Calendar.
  }
}

function holidaysByDate(items) {
  const out = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!validCivilDate(item?.date) || typeof item?.name !== 'string') continue;
    out.set(item.date, item);
  }
  return out;
}

function resolvedTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE; }
  catch { return DEFAULT_TIMEZONE; }
}

function dateInTimezone(now, timezone) {
  const parts = new Intl.DateTimeFormat('en', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMode(value) {
  if (value === 'today' || value === 'all' || value === 'date') return 'month';
  // 'attention' 은 다른 표면(사이드바·딥링크)이 아직 보낼 수 있는 옛 이름이다.
  // 탭이 없어졌으니 그 링크는 기한 지남을 이어받은 일정 보기로 보낸다.
  if (value === 'upcoming' || value === 'attention') return 'agenda';
  return MODES.some(([mode]) => mode === value) ? value : 'month';
}

// The fetch range deliberately covers BOTH week starts at once. Changing the
// setting then never leaves a cell on screen that the last read did not ask
// for, and no fetch path has to be told which start is in force -- worth at
// most six extra days of events.
function monthBounds(date) {
  const {year, month} = civilDateParts(date);
  const ranges = CALENDAR_WEEK_STARTS.map(option => monthGridRange(year, month, option.value));
  return {
    start: ranges.map(range => range.start).sort()[0],
    end: ranges.map(range => range.end).sort().at(-1),
    year,
    month,
  };
}

function yearBounds(date) {
  const {year} = civilDateParts(date);
  return {year, start: `${year}-01-01`, end: `${year}-12-31`};
}

function koreanDate(value) {
  const {year, month, day} = civilDateParts(value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return `${year}년 ${month}월 ${day}일 ${WEEKDAYS[weekday]}`;
}

function shiftCivilMonth(value, delta) {
  const {year, month, day} = civilDateParts(value);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function eventTime(item) {
  if (!validCivilDate(item?.local_date)) return '미정';
  return typeof item?.local_datetime === 'string' ? item.local_datetime.slice(11, 16) : '종일';
}

function isAllDay(item) {
  return item?.all_day === true || !item?.local_datetime;
}

function canonicalActivityLocalDate(value) {
  const temporal = value?.temporal;
  if (!temporal || typeof temporal !== 'object') return '';
  if (typeof temporal.local_date === 'string' && validCivilDate(temporal.local_date)) return temporal.local_date;
  if (typeof temporal.local_datetime === 'string' && validCivilDate(temporal.local_datetime.slice(0, 10))) return temporal.local_datetime.slice(0, 10);
  return '';
}

function normalizedDeepOpen(value) {
  if (!value || typeof value !== 'object') return null;
  const scope = String(value.scope || '').trim().toUpperCase();
  const dateHint = validCivilDate(value.dateHint) ? value.dateHint : '';
  const timezone = typeof value.timezone === 'string' ? value.timezone.trim() : '';
  if (scope === 'AUTH') {
    const activityId = typeof value.activityId === 'string' ? value.activityId.trim() : '';
    const occurrenceId = typeof value.occurrenceId === 'string' ? value.occurrenceId.trim() : '';
    if (!/^activity_[0-9a-f]{32}$/.test(activityId) || (occurrenceId && !/^occurrence_[0-9a-f]{32}$/.test(occurrenceId))) return null;
    return Object.freeze({scope, activityId, occurrenceId, dateHint, timezone});
  }
  if (scope === 'GUEST') {
    const guestEventId = typeof value.guestEventId === 'string' ? value.guestEventId.trim() : '';
    if (!/^guest_[0-9a-f-]{36}$/i.test(guestEventId)) return null;
    return Object.freeze({scope, guestEventId, dateHint, timezone});
  }
  return null;
}


function usesFlowingDayDetail() {
  if (typeof globalThis.matchMedia === 'function') return globalThis.matchMedia('(max-width: 900px)').matches;
  return globalThis.innerWidth <= 900;
}

export const DAY_DETAIL_PRESENTATION = Object.freeze({FLOW: 'FLOW', SIDE: 'SIDE'});

// Touch widths keep the selected day in document flow; desktop gives it a
// stable side rail. Neither presentation covers the month grid.
let dayDetailPresentationOverride = null;

export function setDayDetailPresentation(value) {
  dayDetailPresentationOverride = DAY_DETAIL_PRESENTATION[value] || null;
  return dayDetailPresentation();
}

export function dayDetailPresentation() {
  return dayDetailPresentationOverride
    || (usesFlowingDayDetail() ? DAY_DETAIL_PRESENTATION.FLOW : DAY_DETAIL_PRESENTATION.SIDE);
}

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Shared by the event editor and the day sheet so a raised software keyboard never
// covers their controls. Returns a cleanup function.
function bindVisualViewport(node, {heightVar, topVar, bottomGapVar = ''}) {
  const viewport = globalThis.visualViewport;
  if (!viewport || !node) return () => {};
  const sync = () => {
    const height = Math.max(1, Math.round(viewport.height));
    const top = Math.max(0, Math.round(viewport.offsetTop || 0));
    node.style.setProperty(heightVar, `${height}px`);
    node.style.setProperty(topVar, `${top}px`);
    if (bottomGapVar) {
      // How much of the layout viewport the keyboard (or browser chrome) covers.
      const gap = Math.max(0, Math.round((globalThis.innerHeight || height) - (top + height)));
      node.style.setProperty(bottomGapVar, `${gap}px`);
    }
  };
  sync();
  viewport.addEventListener('resize', sync);
  viewport.addEventListener('scroll', sync);
  return () => {
    viewport.removeEventListener('resize', sync);
    viewport.removeEventListener('scroll', sync);
  };
}

// Horizontal swipe -> month navigation, touch layouts only.
// Deliberately conservative: the axis is decided once per gesture, and a gesture that
// reads as vertical is left completely alone so the month keeps scrolling normally.
const SWIPE_AXIS_LOCK_PX = 12;   // movement needed before we commit to an axis
const SWIPE_COMMIT_PX = 56;      // horizontal distance needed to change month
const SWIPE_AXIS_RATIO = 1.4;    // horizontal must clearly dominate vertical
const SWIPE_MAX_DURATION_MS = 900;

export function bindMonthSwipe(node, {onPrevious, onNext, isBusy = () => false} = {}) {
  if (!node || typeof node.addEventListener !== 'function') return () => {};
  let startX = 0, startY = 0, startedAt = 0;
  let tracking = false, axis = '';

  const reset = () => { tracking = false; axis = ''; };

  const onTouchStart = event => {
    // Ignore multi-touch (pinch zoom) entirely.
    if (!event.touches || event.touches.length !== 1) { reset(); return; }
    const touch = event.touches[0];
    startX = touch.clientX; startY = touch.clientY; startedAt = Date.now();
    tracking = true; axis = '';
  };

  const onTouchMove = event => {
    if (!tracking) return;
    if (!event.touches || event.touches.length !== 1) { reset(); return; }
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!axis) {
      if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) return;
      axis = Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y';
    }
    // Only a committed horizontal gesture suppresses the default; vertical intent
    // keeps native scrolling untouched.
    if (axis === 'x' && event.cancelable) event.preventDefault();
  };

  const onTouchEnd = event => {
    if (!tracking) return;
    const wasHorizontal = axis === 'x';
    const touch = event.changedTouches && event.changedTouches[0];
    const dx = touch ? touch.clientX - startX : 0;
    const duration = Date.now() - startedAt;
    reset();
    if (!wasHorizontal || !touch) return;
    if (Math.abs(dx) < SWIPE_COMMIT_PX) return;
    if (duration > SWIPE_MAX_DURATION_MS) return;
    // One month per gesture, and never while a month load is still in flight, so
    // fast repeated swipes cannot skip a month.
    if (isBusy()) return;
    if (dx < 0) onNext?.(); else onPrevious?.();
  };

  node.addEventListener('touchstart', onTouchStart, {passive: true});
  node.addEventListener('touchmove', onTouchMove, {passive: false});
  node.addEventListener('touchend', onTouchEnd, {passive: true});
  node.addEventListener('touchcancel', reset, {passive: true});
  return () => {
    node.removeEventListener('touchstart', onTouchStart);
    node.removeEventListener('touchmove', onTouchMove);
    node.removeEventListener('touchend', onTouchEnd);
    node.removeEventListener('touchcancel', reset);
  };
}

function weekBounds(value, weekStart = 0) {
  const {year, month, day} = civilDateParts(value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const start = addCivilDays(value, -((weekday - weekStart + 7) % 7));
  return Object.freeze({start, end: addCivilDays(start, 6)});
}

export function buildCalendarTemporal({localDate, time = '', endDate = '', endTime = '', allDay = false, timezone = DEFAULT_TIMEZONE}) {
  const date = typeof localDate === 'string' ? localDate.trim() : '';
  const clock = typeof time === 'string' ? time.trim() : '';
  const endingDate = typeof endDate === 'string' && endDate.trim() ? endDate.trim() : date;
  const end = typeof endTime === 'string' ? endTime.trim() : '';
  if (!date) {
    if (clock || end) throw new SiteCoreError('날짜 없이 시간만 저장할 수 없습니다.', {code: 'LIFE_DATE_REQUIRED_FOR_TIME', status: 422});
    return Object.freeze({kind: 'UNSCHEDULED'});
  }
  if (!validCivilDate(date)) throw new SiteCoreError('날짜가 올바르지 않습니다.', {code: 'LIFE_DATE_INVALID', status: 422});
  if (allDay) {
    if (endDate && (!validCivilDate(endingDate) || endingDate < date)) throw new SiteCoreError('종료 날짜가 올바르지 않습니다.', {code: 'LIFE_END_DATE_INVALID', status: 422});
    if (endingDate > date) return Object.freeze({kind: 'DATE_RANGE', local_date: date, date_end: endingDate, timezone_name: timezone});
    return Object.freeze({kind: 'DATE_ONLY', local_date: date});
  }
  if (end && !clock) throw new SiteCoreError('종료 시간에는 시작 시간이 필요합니다.', {code: 'LIFE_START_TIME_REQUIRED', status: 422});
  if (!clock) return Object.freeze({kind: 'DATE_ONLY', local_date: date});
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new SiteCoreError('시간이 올바르지 않습니다.', {code: 'LIFE_TIME_INVALID', status: 422});
  if (end) {
    if (!validCivilDate(endingDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || `${endingDate}T${end}` <= `${date}T${clock}`) {
      throw new SiteCoreError('종료 시간은 시작 시간보다 늦어야 합니다.', {code: 'LIFE_END_TIME_INVALID', status: 422});
    }
    return Object.freeze({kind: 'TIME_WINDOW', window_start: `${date}T${clock}:00`, window_end: `${endingDate}T${end}:00`, timezone_name: timezone});
  }
  return Object.freeze({kind: 'LOCAL_DATE_TIME', local_datetime: `${date}T${clock}:00`, timezone_name: timezone});
}

export function normalizeCalendarClockInput(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const clock = /^\d{4}$/.test(raw) ? `${raw.slice(0, 2)}:${raw.slice(2)}` : raw;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : null;
}

function defaultRequestId(kind) {
  return `site.calendar.${kind}.${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function calendarItemActionPolicy(item = {}) {
  const explicitActions = Array.isArray(item?.allowed_actions);
  const allowedActions = explicitActions ? item.allowed_actions : [];
  const sourceKind = item?.source_kind || 'USER_INPUT';
  const mutableByDefault = sourceKind !== 'LIFE_RESULT' && !explicitActions;
  const canUpdate = mutableByDefault || allowedActions.includes('UPDATE');
  const canRemove = mutableByDefault || allowedActions.includes('REMOVE');
  return Object.freeze({
    canUpdate,
    canRemove,
    readOnly: !canUpdate && !canRemove,
    allowedActions: Object.freeze([...allowedActions]),
  });
}

export function createCalendarMutationController({
  sessionToken = '', timezone = DEFAULT_TIMEZONE, guestRepository, fetchImpl = globalThis.fetch, requestId = defaultRequestId,
} = {}) {
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  if (!authenticated && !guestRepository) throw new TypeError('guestRepository is required for Guest Calendar mutations');
  const normalized = input => {
    const rawAmount = input?.amountMinor;
    const amountMinor = rawAmount === '' || rawAmount == null ? null : Number(rawAmount);
    return {
      title: typeof input?.title === 'string' ? input.title.trim() : '',
      localDate: typeof input?.localDate === 'string' ? input.localDate.trim() : '',
      time: typeof input?.time === 'string' ? input.time.trim() : '',
      endTime: typeof input?.endTime === 'string' ? input.endTime.trim() : '',
      endDate: typeof input?.endDate === 'string' ? input.endDate.trim() : '',
      allDay: input?.allDay === true,
      entry: {
        amount_minor: amountMinor,
        currency: 'KRW',
        expense_category: input?.expenseCategory || null,
        memo: typeof input?.memo === 'string' ? input.memo : '',
        place: typeof input?.place === 'string' ? input.place : '',
        merchant: typeof input?.merchant === 'string' ? input.merchant : '',
      },
    };
  };
  const guestPayload = (value, temporal) =>…30049 tokens truncated…in -- but waiting for it here
      // meant the panel drew once wherever the flow put it and then jumped to
      // the date it belongs to. One frame on a phone; enough to be seen, and
      // enough to make a geometry check land on the wrong box.
      syncMonthLayout(layout);
    }

    if (state.mode === 'month') {
      const monthKey = `${state.year}-${state.month}`;
      // Totals belonging to another month are never shown under this month's
      // heading: until the bar catches up it reads as loading.
      const settled = state.expense.status === 'guest' || state.expense.monthKey === monthKey;
      expenseSlot.hidden = false;
      expenseSlot.replaceChildren(calendarExpenseSummaryNode({
        state: settled ? state.expense.status : 'loading',
        summary: settled ? state.expense.summary : null,
        monthLabel: `${state.year}년 ${state.month}월`,
        errorMessage: settled ? state.expense.message : '',
        // Signed out, the numbers come from this browser alone. The bar says so
        // rather than letting them read as kept somewhere safe.
        local: state.expense.local === true,
      }));
    } else {
      expenseSlot.hidden = true;
      expenseSlot.replaceChildren();
    }
  }

  const imagePicker = document.createElement('input');
  imagePicker.type = 'file';
  imagePicker.accept = 'image/*';
  imagePicker.hidden = true;
  imagePicker.dataset.calendarImagePicker = '';
  root.appendChild(imagePicker);

  // The picture becomes a draft the owner reviews — never a saved entry. The
  // editor opens prefilled with whatever was legible and blank everywhere else;
  // nothing is guessed, and nothing is written until they press save.
  async function addFromImage(date) {
    const say = text => { state.imageMessage = text; render(); };
    if (!authenticated) {
      say('이미지로 일정을 만들려면 LOTBI에 로그인해 주세요.');
      return;
    }
    say('');
    const file = await new Promise(resolve => {
      const onChange = () => {
        imagePicker.removeEventListener('change', onChange);
        const picked = imagePicker.files?.[0] || null;
        imagePicker.value = '';
        resolve(picked);
      };
      imagePicker.addEventListener('change', onChange);
      imagePicker.click();
    });
    if (!file) return;
    say('이미지에서 일정을 읽는 중…');

    try {
      // The upload contract names it `id`, not `attachmentId`.
      const {id: attachmentId} = await uploadConversationAttachment({sessionToken, file}, fetchImpl);
      const requestId = `cal-image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      // The wording matters: it is what tells Core this attachment is meant for
      // the Calendar, and it is exactly what the owner just asked for.
      const response = await sendConversationMessage(
        sessionToken,
        '이 이미지로 캘린더에 일정 등록',
        fetchImpl,
        [attachmentId],
        requestId,
        timezone,
        currentNow().toISOString(),
        [],
        {logicalRequestId: requestId, turnId: requestId},
      );
      if (!root.isConnected) return;
      const draft = response?.calendarDraft || null;
      if (!draft) {
        say('이미지에서 일정을 읽지 못했습니다. 아래 직접 등록으로 입력해 주세요.');
        return;
      }
      say('');
      // A draft, not an entry: the editor opens with whatever was legible and
      // blank everywhere else, and nothing is written until the owner saves.
      openEditor(null, draft.localDate || date || state.selectedDate, draft);
    } catch (error) {
      if (!root.isConnected) return;
      // A 401 is the session itself, and site-core.js already announces that —
      // the Calendar closes and the owner signs in again. A 403 is this one
      // route being refused, which is not the owner's doing and not a reason to
      // send them to a login screen, so it says what they can do instead.
      const refused = error instanceof SiteCoreError && error.status === 403;
      say(refused
        ? '지금은 이미지로 일정을 만들 수 없습니다. 아래 직접 등록으로 입력해 주세요.'
        : '이미지를 읽지 못했습니다. 다시 시도하거나 직접 입력해 주세요.');
    }
  }

  // A signed-in owner re-fetches the month; a signed-out one already holds every
  // entry, so only the totals need recomputing. Both paths go through here, so a
  // month change can never leave the bar showing another month's numbers — or,
  // with the monthKey guard, a loader that never resolves.
  async function afterMonthChange() {
    if (authenticated) { await refresh(); return; }
    render();
    await refreshExpenseSummary();
  }

  let expenseGeneration = 0;

  async function refreshExpenseSummary() {
    if (!authenticated) {
      // A signed-out owner already records amounts — the guest repository keeps
      // entry.amount_minor and entry.expense_category like any other entry. The
      // only thing missing was somewhere to add them up, so they are added up
      // here, in this browser. No request is made and nothing is uploaded.
      //
      // Wrapped because the month grid has to outlive this: a totals bar that
      // cannot compute is a missing bar, never a broken Calendar.
      const monthKey = `${state.year}-${state.month}`;
      try {
        const {start, end} = civilMonthRange(state.year, state.month);
        const inMonth = (repository?.list() || []).filter(event => {
          const date = event?.local_date;
          return typeof date === 'string' && date >= start && date <= end;
        });
        state.expense = {
          status: 'ready',
          summary: expenseSummaryFromEntries(inMonth, {startDate: start, endDate: end}),
          message: '',
          monthKey,
          local: true,
        };
      } catch {
        // Not a login wall — signing in would not fix an unreadable local store,
        // so it says what happened and leaves the month alone.
        state.expense = {
          status: 'error',
          summary: null,
          message: '이 브라우저의 기록을 읽지 못해 합계를 낼 수 없어요.',
          monthKey,
          local: true,
        };
      }
      render();
      return;
    }
    const generation = ++expenseGeneration;
    const monthKey = `${state.year}-${state.month}`;
    const {start, end} = civilMonthRange(state.year, state.month);
    state.expense = {...state.expense, status: 'loading', message: '', monthKey: ''};
    render();
    try {
      const summary = await getLifeExpenseSummary(sessionToken, {timezone, start, end}, fetchImpl);
      if (!root.isConnected || generation !== expenseGeneration) return;
      state.expense = {status: 'ready', summary, message: '', monthKey, local: false};
    } catch (error) {
      if (!root.isConnected || generation !== expenseGeneration) return;
      state.expense = {
        status: 'error',
        summary: null,
        monthKey,
        // Only an expired session is worth sending the user back to sign in.
        // A 403 here is the server refusing this route, which signing in again
        // does not fix, so it gets the plain failure line.
        message: error instanceof SiteCoreError && error.status === 401
          ? '지출 합계를 보려면 LOTBI에 다시 로그인해 주세요.'
          : '지출 합계를 불러오지 못했습니다.',
      };
    }
    // A delayed accessory response must not discard the Calendar focus chosen
    // by someone who navigated while an editor save was waiting for it. An open
    // day detail owns focus through its close control; a closed detail uses the
    // selected date trigger.
    const focusedDayDetail = state.mode === 'month'
      && state.detailOpen
      && Boolean(document.activeElement?.closest?.('.calendar-day-panel'));
    const focusedCalendarDate = document.activeElement?.getAttribute('data-calendar-date-trigger');
    render();
    if (focusedDayDetail && state.mode === 'month' && state.detailOpen) {
      root.querySelector('.calendar-day-close')?.focus();
    } else if (state.mode === 'month' && focusedCalendarDate === state.selectedDate) {
      root.querySelector(`[data-calendar-date-trigger="${focusedCalendarDate}"]`)?.focus();
    }
  }

  async function refresh({settleExpense = false} = {}) {
    const requestGeneration = ++refreshGeneration;
    let expenseRefresh = null;
    state.loading = true; render(); root.setAttribute('aria-busy', 'true');
    try {
      if (
        currentWeatherLocation?.source === 'BROWSER_CURRENT'
        && !isFreshBrowserCurrentLocation(currentWeatherLocation, {now: locationNow})
      ) {
        // 좌표는 2분이면 늙는다. 늙은 좌표를 버리는 것은 맞지만, 그렇다고 위치가
        // 아무것도 없는 상태로 떨어뜨리면 날씨가 통째로 사라진다 -- 저장된 지역으로
        // 내려앉는다.
        currentWeatherLocation = storedRegionWeatherLocation();
        clearBrowserLocationProvenance();
        state.locationResolution = LOCATION_RESOLUTION.IDLE;
        state.locationMessage = currentWeatherLocation ? '' : '현재 위치가 오래되어 다시 확인이 필요해요.';
      }
      if (authenticated) {
        const result = await loadLifeCalendarManagerView(sessionToken, {view: state.mode, date: state.selectedDate, timezone, now: currentNow(), fetchImpl, weatherLocation: currentWeatherLocation, weekStart: state.weekStart});
        if (!root.isConnected || requestGeneration !== refreshGeneration) return;
        state.items = result.items;
        state.unscheduled = result.unscheduled || [];
        if (result.key === 'month' || result.key === 'week' || result.key === 'agenda') {
          state.attention = result.attention || [];
        }
        if (result.key === 'month' || result.key === 'week') {
          state.weather = result.weather || [];
          state.weatherMessage = result.weatherFailureMessage || '';
        } else {
          state.weather = [];
          state.weatherMessage = '';
        }
        if (result.key === 'month' || result.key === 'week' || result.key === 'year') {
          state.holidays = result.holidays || [];
        }
      } else {
        if (!root.isConnected || requestGeneration !== refreshGeneration) return;
        const guestItems = repository.list();
        state.items = guestItems.filter(item => validCivilDate(item.local_date));
        state.unscheduled = guestItems.filter(item => !validCivilDate(item.local_date));
        state.attention = [];
        state.weather = [];
        state.weatherMessage = '';

        // Guest Calendar is device-local and must remain immediately usable even
        // when public enrichment is slow or unavailable. Render local data first,
        // then decorate it with weather/holiday data fail-soft.
        state.loading = false;
        render();

        const todayParts = civilDateParts(state.todayDate);
        const currentMonthVisible = state.mode === 'month'
          && state.year === todayParts.year
          && state.month === todayParts.month;
        const selectedWeekRange = state.mode === 'week' ? weekBounds(state.selectedDate, state.weekStart) : null;
        const forecastHorizon = addCivilDays(state.todayDate, 14);
        const weekForecastVisible = selectedWeekRange
          && selectedWeekRange.end >= state.todayDate
          && selectedWeekRange.start <= forecastHorizon;
        const visibleWeatherRange = currentMonthVisible
          ? monthBounds(state.selectedDate)
          : weekForecastVisible
            ? selectedWeekRange
            : null;
        const guestWeatherStart = visibleWeatherRange
          ? [visibleWeatherRange.start, state.todayDate].sort().at(-1)
          : null;
        const guestWeatherEnd = visibleWeatherRange
          ? [visibleWeatherRange.end, forecastHorizon].sort()[0]
          : null;
        const weatherRequest = visibleWeatherRange && currentWeatherLocation?.latitude != null && currentWeatherLocation?.longitude != null
          ? getPublicCalendarWeather({
              start: guestWeatherStart,
              end: guestWeatherEnd,
              timezone,
              latitude: currentWeatherLocation.latitude,
              longitude: currentWeatherLocation.longitude,
            }, fetchImpl).catch(error => {
              console.warn('[LOTBI 캘린더] 날씨를 불러오지 못했습니다.', error);
              return {providerReady: false, items: [], aiCalls: 0, failure: error};
            })
          : Promise.resolve({providerReady: false, items: [], aiCalls: 0});
        const holidayRange = state.mode === 'year'
          ? yearBounds(state.selectedDate)
          : state.mode === 'week'
            ? weekBounds(state.selectedDate, state.weekStart)
            : monthBounds(state.selectedDate);
        const holidayRequest = (state.mode === 'month' || state.mode === 'week' || state.mode === 'year') && state.showKoreaHolidays
          ? loadKoreaHolidaysForRange(holidayRange, fetchImpl)
          : Promise.resolve({coverageStatus: 'UNAVAILABLE', items: []});
        const [guestWeather, holidayResult] = await Promise.all([weatherRequest, holidayRequest]);
        if (!root.isConnected || requestGeneration !== refreshGeneration) return;
        state.weather = guestWeather.items || [];
        state.weatherMessage = weatherFailureCopy(guestWeather.failure);
        if (state.mode === 'month' || state.mode === 'week' || state.mode === 'year') {
          state.holidays = holidayResult.items || [];
        }
      }
      state.loading = false; render();
      if (state.mode === 'month') expenseRefresh = refreshExpenseSummary();
    } catch (error) {
      if (!root.isConnected || requestGeneration !== refreshGeneration) return;
      state.loading = false; render();
      const message = document.createElement('p'); message.className = 'life-calendar-error';
      message.textContent = error instanceof SiteCoreError && (error.status === 401 || error.status === 403)
        ? '일정을 보려면 LOTBI에 다시 로그인해 주세요.' : '일정을 불러오지 못했습니다.';
      const retry = button('다시 시도', 'calendar-retry-button'); retry.addEventListener('click', () => { void refresh(); });
      status.replaceChildren(message, retry);
      // refresh() reads the guest repository before the totals are ever
      // computed, so a failure here would leave the bar loading forever.
      if (state.expense.status === 'loading') {
        state.expense = {
          status: 'error',
          summary: null,
          message: '지출 합계를 불러오지 못했습니다.',
          monthKey: `${state.year}-${state.month}`,
          local: !authenticated,
        };
        render();
      }
    } finally {
      if (requestGeneration === refreshGeneration) root.removeAttribute('aria-busy');
    }
    // The authoritative schedule and its busy state finish first. Only an
    // editor save needs to wait for the auxiliary expense render before placing
    // final focus; other refreshes stay fail-soft and independently responsive.
    if (settleExpense && authenticated && expenseRefresh) await expenseRefresh;
  }

  const focusCalendarContext = (origin, item, isCurrent = () => true) => {
    queueMicrotask(() => {
      if (!isCurrent()) return;
      const eventId = item?.id || item?.activity_id || '';
      const eventCandidate = eventId
        ? root.querySelector(`[data-calendar-event-id="${eventId}"]`)
        : null;
      const dateTarget = origin.mode === 'month'
        ? root.querySelector(`[data-calendar-date-trigger="${origin.selectedDate}"]`)
        : null;
      const agendaTarget = origin.mode === 'agenda'
        ? root.querySelector(`[data-agenda-scope="${origin.agendaScope}"]`)
        : null;
      const modeTarget = modeButtons.get(origin.mode);
      const weekTarget = origin.mode === 'week'
        ? root.querySelector(`[data-calendar-week-date="${origin.selectedDate}"]`)
        : null;
      const target = [eventCandidate, dateTarget, weekTarget, agendaTarget, modeTarget]
        .find(candidate => candidate?.isConnected && candidate.getClientRects().length);
      target?.focus();
    });
  };

  openEditor = (item, date, draft = null, opener = document.activeElement) => {
    const origin = Object.freeze({
      mode: state.mode,
      selectedDate: state.selectedDate,
      year: state.year,
      month: state.month,
      agendaScope: state.agendaScope,
      detailOpen: state.detailOpen,
      dayCollapsed: state.dayCollapsed,
      generation: calendarContextGeneration,
    });
    const sameCalendarContext = context => calendarContextGeneration === context.generation
      && state.mode === context.mode
      && state.selectedDate === context.selectedDate
      && state.year === context.year
      && state.month === context.month
      && state.agendaScope === context.agendaScope
      && state.detailOpen === context.detailOpen
      && state.dayCollapsed === context.dayCollapsed;
    if (item && calendarItemActionPolicy(item).readOnly) {
      return calendarReadonlyDetailDialog({
        root,
        item,
        opener,
        onClose: () => focusCalendarContext(origin, item),
      });
    }
    return calendarEditorDialog({
      root, item, selectedDate: date, initialDraft: draft, authenticated, controller: mutationController,
      onSaved: async () => {
        state.mode = origin.mode;
        state.selectedDate = origin.selectedDate;
        state.year = origin.year;
        state.month = origin.month;
        state.agendaScope = origin.agendaScope;
        state.detailOpen = origin.detailOpen;
        state.dayCollapsed = origin.dayCollapsed;
        await refresh({settleExpense: authenticated && origin.mode === 'month'});
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh', {detail: {source: root}}));
        // Expense may have taken time to settle; a newer navigation owns focus.
        if (sameCalendarContext(origin)) focusCalendarContext(origin, item, () => sameCalendarContext(origin));
      },
      onStale: refresh,
      onClose: () => focusCalendarContext(origin, item),
    });
  };

  settingsButton.addEventListener('click', () => actions.openSettings());

  // One path for "use my current location", shared by the Settings control and
  // any future entry point. Location is an accessory of an accessory: every exit
  // below leaves the Calendar itself untouched and costs at most the weather
  // decoration.
  //
  // auto: true 는 권한이 이미 허용된 상태에서 화면이 스스로 부른 경우다. 사용자가
  // 아무것도 누르지 않았으므로 알릴 것도 없다 -- 토스트도, 실패 문구도 내지 않는다.
  async function useCurrentLocation({auto = false} = {}) {
    if (state.locationInFlight) return;
    // 자동 호출은 끼어들지 않는다. 사용자가 누른 요청이 진행 중일 때 자동 호출이
    // 세대 번호를 올리면, 진행 중이던 그 요청이 자기 차례가 지난 줄 알고 조용히
    // 물러난다 -- 누른 사람에게는 버튼이 먹지 않은 것으로 보인다.
    if (auto && locationRequestActive) return;
    locationRequestActive = true;
    const requestGeneration = ++locationRequestGeneration;
    try {
      await runCurrentLocationRequest({auto, requestGeneration});
    } finally {
      // 사용자의 요청이 이 요청을 밀어냈다면 잠금은 그쪽 것이다.
      if (requestGeneration === locationRequestGeneration) locationRequestActive = false;
    }
  }

  async function runCurrentLocationRequest({auto, requestGeneration}) {
    const previousPermission = await getBrowserLocationPermissionState({
      permissions: locationPermissions,
      geolocation: locationProvider,
    });
    if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;

    state.locationPermission = previousPermission;
    if (previousPermission === LOCATION_PERMISSION.DENIED) {
      state.locationResolution = LOCATION_RESOLUTION.IDLE;
      state.locationMessage = '위치 권한이 꺼져 있어요.';
      if (!auto) announceLocation(state.locationMessage);
      render();
      return;
    }
    if (previousPermission === LOCATION_PERMISSION.UNAVAILABLE) {
      state.locationResolution = LOCATION_RESOLUTION.ERROR;
      state.locationMessage = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
      if (!auto) announceLocation(state.locationMessage);
      render();
      return;
    }
    // 자동 호출은 허용된 권한에만 붙는다. 다시 읽은 값이 허용이 아니면 그냥 물러난다:
    // 미결정 상태에서 좌표를 물으면 그 순간 권한 팝업이 뜬다.
    if (auto && previousPermission !== LOCATION_PERMISSION.GRANTED) {
      render();
      return;
    }

    // 사용자가 누른 경우에만 "확인 중" 을 보여주고 버튼을 잠근다. 자동 호출은
    // 화면에 아무 흔적도 남기지 않는다 -- 누르지도 않은 버튼이 잠겨 있으면 그것도
    // 고장으로 읽힌다.
    if (!auto) {
      state.locationInFlight = true;
      state.locationResolution = LOCATION_RESOLUTION.REQUESTING;
      state.locationMessage = '';
      render();
    }
    try {
      const location = await requestBrowserCurrentLocation({
        geolocation: locationProvider,
        now: locationNow,
      });
      if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
      if (auto) {
        // 자동 경로는 정밀 좌표를 화면에 쓰지 않는다. 좌표는 어느 시·군·구인지
        // 알아내는 데만 쓰고 그대로 버린다. 그리고 그 지역이 이미 날씨를 그리고 있는
        // 지역이면 달력을 다시 읽지도 않는다 -- 화면을 켤 때마다 같은 달을 두 번
        // 불러올 이유가 없다.
        state.locationPermission = LOCATION_PERMISSION.GRANTED;
        const region = await regionForCurrentLocation(location);
        if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
        if (!region) return;
        const alreadyShowing = currentWeatherLocation?.source === 'MANUAL_REGION'
          && currentWeatherLocation.label === region.label;
        storeCurrentLocationRegion(region);
        if (!alreadyShowing) {
          currentWeatherLocation = {...region, source: 'MANUAL_REGION'};
          clearBrowserLocationProvenance();
          state.locationMessage = '';
          await refresh();
        }
        return;
      }
      currentWeatherLocation = location;
      state.locationPermission = LOCATION_PERMISSION.GRANTED;
      state.locationResolution = LOCATION_RESOLUTION.RESOLVED;
      root.dataset.locationSource = location.source;
      root.dataset.locationAccuracyMeters = String(location.accuracyMeters);
      root.dataset.locationApproximation = location.approximationState;
      root.dataset.locationTimestamp = location.timestamp;
      state.locationMessage = '';
      // Said once, when it changes. Never again on reopen.
      announceLocation('현재 위치로 날씨를 표시합니다.');
      await refresh();
      // 새로고침 뒤에도 날씨가 남아 있게 하는 유일한 장치. 좌표는 저장하지 않는다:
      // 정밀 좌표는 개인정보이고, 날씨에는 시·군·구면 충분하다.
      void persistRegionForCurrentLocation(location, requestGeneration);
    } catch (error) {
      if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
      // 실패했다고 저장된 지역까지 잃지는 않는다. 돌아갈 자리를 남겨 둔다.
      currentWeatherLocation = storedRegionWeatherLocation();
      clearBrowserLocationProvenance();
      if (error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_DENIED') {
        state.locationPermission = LOCATION_PERMISSION.DENIED;
        state.locationResolution = LOCATION_RESOLUTION.IDLE;
      } else if (error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_TIMEOUT') {
        // A browser may grant the prompt and still fail to resolve coordinates.
        // Re-read permission after the request so PROMPT_REQUIRED + timeout becomes
        // GRANTED + TIMEOUT when the browser can report the new permission state.
        const afterPermission = await getBrowserLocationPermissionState({
          permissions: locationPermissions,
          geolocation: locationProvider,
        });
        if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
        state.locationPermission = afterPermission === LOCATION_PERMISSION.GRANTED
          || previousPermission === LOCATION_PERMISSION.GRANTED
          ? LOCATION_PERMISSION.GRANTED
          : afterPermission;
        state.locationResolution = LOCATION_RESOLUTION.TIMEOUT;
      } else {
        state.locationResolution = LOCATION_RESOLUTION.ERROR;
      }
      state.locationMessage = locationErrorCopy(error);
      if (auto) {
        // 아무도 누르지 않았으므로 아무 말도 하지 않는다. 다만 조용히 삼키지도
        // 않는다: 원인은 콘솔에 남고, 저장된 지역이 있으면 날씨는 그대로 나온다.
        console.warn('[LOTBI 캘린더] 허용된 위치 권한으로 현재 위치를 확인하지 못했습니다.', error);
        if (state.manualWeatherRegion) state.locationMessage = '';
      } else {
        announceLocation(state.locationMessage);
      }
      await refresh();
    } finally {
      if (!auto && requestGeneration === locationRequestGeneration) {
        state.locationInFlight = false;
        render();
      }
    }
  }

  // 브라우저가 준 좌표가 어느 시·군·구인지 고른다. Core 에는 좌표를 지역명으로
  // 되돌리는 경로가 없으므로(regions·region/resolve 두 개뿐이다), 목록에 있는
  // 시·군·구의 좌표를 Core 에게 물어 두고 그중 가장 가까운 곳을 고른다. 좌표를
  // 만들어 내지 않고, 목록에 없는 지역을 있는 것처럼 꾸미지도 않는다.
  async function regionForCurrentLocation(location) {
    try {
      let entries = readCalendarWeatherRegionCatalog(settingsStorage, locationNow);
      if (!entries) {
        const catalog = await fetchCalendarWeatherRegions(fetchImpl, settingsStorage);
        if (!catalog) return null;
        entries = catalogEntriesFromListedCoordinates(catalog);
        if (!entries) {
          // 목록이 좌표를 안 보내는 서버다. 행마다 물어야 하는데, 그 왕복은 날씨
          // 조회와 분당 한도를 나눠 쓴다. 목록이 길면 묻다가 한도를 태워 날씨를
          // 통째로 없애므로, 그럴 때는 현재 위치를 시·군·구로 되돌리지 않는다.
          if (catalog.items.length > CALENDAR_WEATHER_REGION_GEOCODE_MAX) {
            console.warn('[LOTBI 캘린더] 지역 목록에 좌표가 없고 목록이 길어 현재 위치를 시·군·구로 되돌리지 않습니다.');
            return null;
          }
          const resolved = await Promise.all(
            catalog.items.map(item => resolveCatalogRegionCoordinates(item, fetchImpl)),
          );
          entries = resolved.filter(Boolean);
        }
        if (!entries.length) return null;
        writeCalendarWeatherRegionCatalog(settingsStorage, entries, locationNow);
      }
      const nearest = nearestCatalogRegion(entries, location);
      if (!nearest) {
        console.warn('[LOTBI 캘린더] 현재 위치에 해당하는 시·군·구를 찾지 못했습니다.');
        return null;
      }
      return {
        label: nearest.entry.label,
        latitude: Number(nearest.entry.latitude),
        longitude: Number(nearest.entry.longitude),
        midRegionCode: null,
      };
    } catch (error) {
      console.warn('[LOTBI 캘린더] 현재 위치의 시·군·구를 확인하지 못했습니다.', error);
      return null;
    }
  }

  // 저장하는 것은 시·군·구 이름과 Core 가 준 그 지역의 좌표뿐이다. 브라우저가 준
  // 정밀 좌표는 이 화면을 벗어나지 않는다.
  function storeCurrentLocationRegion(region) {
    if (!writeCalendarManualWeatherRegion(region, settingsStorage)) return false;
    writeWeatherRegionOrigin(settingsStorage, WEATHER_REGION_ORIGIN.CURRENT_LOCATION);
    state.manualWeatherRegion = region;
    state.weatherRegionOrigin = WEATHER_REGION_ORIGIN.CURRENT_LOCATION;
    // 설정창이 열려 있으면 문구가 바로 사실을 따라가게 한다.
    syncLocationSettingsControl();
    root.dispatchEvent(new Event(CALENDAR_WEATHER_REGION_SYNC_EVENT));
    return true;
  }

  // 버튼을 눌러 잡은 좌표는 화면에 바로 쓰고(정확하다), 지역 저장은 뒤에서 따라온다.
  // 직접 고른 지역은 자동 호출이 여기까지 오지 않게 막아 둔다
  // (maybeUseGrantedCurrentLocation). 버튼을 눌렀다면 그것은 명시적인 교체다.
  async function persistRegionForCurrentLocation(location, requestGeneration) {
    const region = await regionForCurrentLocation(location);
    // 그 사이 새 위치 요청이 끼어들었거나 화면이 사라졌으면 그쪽이 권위다.
    if (!region || !root.isConnected || requestGeneration !== locationRequestGeneration) return;
    storeCurrentLocationRegion(region);
  }

  locationButton.addEventListener('click', () => { void useCurrentLocation(); });

  // One navigation path, with the unit owned by the active product view.
  async function shiftMonth(delta) {
    if (!Number.isInteger(delta) || delta === 0) return;
    if (monthShiftInFlight) return;
    monthShiftInFlight = true;
    try {
      markCalendarContextNavigation();
      if (state.mode === 'year') {
        state.year += delta;
        state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
      } else if (state.mode === 'week') {
        state.selectedDate = addCivilDays(state.selectedDate, delta * 7);
        const parts = civilDateParts(state.selectedDate);
        state.year = parts.year;
        state.month = parts.month;
      } else {
        state.month += delta;
        while (state.month < 1) { state.month += 12; state.year -= 1; }
        while (state.month > 12) { state.month -= 12; state.year += 1; }
        state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
      }
      state.detailOpen = false;
      if (state.mode === 'agenda') state.agendaScope = 'month';
      await refresh();
    } finally {
      monthShiftInFlight = false;
    }
  }
  actions.shiftMonth = shiftMonth;

  previous.addEventListener('click', () => { void shiftMonth(-1); });
  next.addEventListener('click', () => { void shiftMonth(1); });
  today.addEventListener('click', async () => {
    markCalendarContextNavigation();
    const parts = civilDateParts(state.todayDate);
    state.year = parts.year;
    state.month = parts.month;
    state.selectedDate = state.todayDate;
    state.detailOpen = state.mode === 'month';
    state.dayCollapsed = false;
    await refresh();
  });
  title.addEventListener('click', async () => {
    markCalendarContextNavigation();
    state.mode = state.mode === 'year' ? 'month' : 'year';
    state.detailOpen = false;
    state.agendaScope = 'month';
    await refresh();
  });
  for (const [mode, control] of modeButtons) control.addEventListener('click', async () => {
    if (state.mode !== mode) {
      markCalendarContextNavigation();
      state.mode = mode;
      state.detailOpen = false;
      state.dayCollapsed = false;
      if (mode !== 'agenda') state.agendaScope = 'month';
      await refresh();
    }
  });

  let lastDayDetailPresentation = dayDetailPresentation();
  const onResize = () => {
    const nextDayDetailPresentation = dayDetailPresentation();
    if (nextDayDetailPresentation !== lastDayDetailPresentation) {
      lastDayDetailPresentation = nextDayDetailPresentation;
      const detailOwnedFocus = state.detailOpen
        && Boolean(document.activeElement?.closest?.('.calendar-day-panel'));
      if (state.mode === 'month') render();
      if (detailOwnedFocus) focusSelectedCalendarTarget({detail: true});
      return;
    }
    const layout = viewport.querySelector('.calendar-month-layout');
    if (layout) syncMonthLayout(layout);
  };
  window.addEventListener('resize', onResize);

  const refreshTodayIfNeeded = async () => {
    const nextToday = dateInTimezone(currentNow(), timezone);
    if (nextToday === state.todayDate) return;
    const followedToday = state.selectedDate === state.todayDate;
    state.todayDate = nextToday;
    if (followedToday) {
      const parts = civilDateParts(nextToday);
      const monthChanged = parts.year !== state.year || parts.month !== state.month;
      state.selectedDate = nextToday;
      state.year = parts.year;
      state.month = parts.month;
      if (monthChanged) await afterMonthChange();
      else render();
      return;
    }
    render();
  };

  const cleanupLifecycle = () => {
    locationRequestGeneration += 1;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('focus', onResume);
    window.removeEventListener('pageshow', onResume);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.clearInterval(todayTimer);
    window.removeEventListener('lotbi:life-calendar-refresh', onRefresh);
  };
  const onResume = () => {
    if (!root.isConnected) { cleanupLifecycle(); return; }
    void refreshTodayIfNeeded();
    void syncLocationPermission().then(() => {
      if (root.isConnected) render();
    });
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onResume();
  };
  window.addEventListener('focus', onResume);
  window.addEventListener('pageshow', onResume);
  document.addEventListener('visibilitychange', onVisibilityChange);
  const todayTimer = window.setInterval(() => {
    if (!root.isConnected) { cleanupLifecycle(); return; }
    void refreshTodayIfNeeded();
  }, 60_000);

  const onRefresh = event => {
    if (!root.isConnected) {
      cleanupLifecycle();
      return;
    }
    if (event.detail?.source === root) return;
    void refresh();
  };
  window.addEventListener('lotbi:life-calendar-refresh', onRefresh);

  const showDeepOpenTerminal = (message, stateName) => {
    state.loading = false;
    updateChrome();
    const notice = document.createElement('p');
    notice.className = 'calendar-deep-open-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    status.replaceChildren(notice);
    viewport.replaceChildren();
    root.dataset.calendarDeepOpen = stateName;
  };

  const openDeepTarget = async () => {
    if (!deepOpenTarget) {
      await refresh();
      if (initialDraft && typeof initialDraft === 'object') {
        root.dataset.calendarDraftOpen = 'opened';
        openEditor(null, initialDraft.localDate || '', initialDraft);
      }
      return;
    }
    if ((authenticated && deepOpenTarget.scope !== 'AUTH') || (!authenticated && deepOpenTarget.scope !== 'GUEST')) {
      showDeepOpenTerminal('이 일정은 현재 캘린더 범위에서 열 수 없습니다.', 'scope-mismatch');
      return;
    }

    let targetItem;
    let latestDate = deepOpenTarget.dateHint;
    let moved = false;
    if (authenticated) {
      let canonical;
      try {
        canonical = await getLifeActivity(sessionToken, deepOpenTarget.activityId, fetchImpl);
      } catch (error) {
        if (error instanceof SiteCoreError && error.status === 404) {
          showDeepOpenTerminal('일정을 찾을 수 없거나 현재 계정에서 접근할 수 없습니다.', 'not-found');
          return;
        }
        showDeepOpenTerminal('일정을 확인하지 못했습니다.', 'lookup-failed');
        return;
      }
      latestDate = canonicalActivityLocalDate(canonical);
      const isUnscheduled = !latestDate && canonical.temporal?.kind === 'UNSCHEDULED';
      if (!latestDate && !isUnscheduled) {
        showDeepOpenTerminal('일정 날짜를 확인하지 못했습니다.', 'invalid-date');
        return;
      }
      if (canonical.activityState === 'REMOVED') {
        showDeepOpenTerminal('삭제된 일정입니다.', 'deleted');
        return;
      }
      if (deepOpenTarget.occurrenceId && canonical.occurrenceId !== deepOpenTarget.occurrenceId) {
        showDeepOpenTerminal('일정의 발생 항목이 변경되어 기존 링크로 열 수 없습니다.', 'occurrence-changed');
        return;
      }
      moved = !isUnscheduled && Boolean(deepOpenTarget.dateHint && deepOpenTarget.dateHint !== latestDate);
      if (isUnscheduled) {
        state.mode = 'agenda';
        state.agendaScope = 'month';
        state.detailOpen = false;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.unscheduled.find(item => (
          item.activity_id === deepOpenTarget.activityId
          && (!deepOpenTarget.occurrenceId || item.occurrence_id === deepOpenTarget.occurrenceId)
        ));
      } else {
        const parts = civilDateParts(latestDate);
        state.mode = 'month';
        state.selectedDate = latestDate;
        state.year = parts.year;
        state.month = parts.month;
        state.detailOpen = true;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.items.find(item => (
          item.activity_id === deepOpenTarget.activityId
          && (!deepOpenTarget.occurrenceId || item.occurrence_id === deepOpenTarget.occurrenceId)
        ));
      }
    } else {
      targetItem = repository.list().find(item => item.id === deepOpenTarget.guestEventId);
      if (!targetItem) {
        showDeepOpenTerminal('삭제된 일정입니다.', 'deleted');
        return;
      }
      latestDate = targetItem.local_date;
      const isUnscheduled = !validCivilDate(latestDate);
      moved = !isUnscheduled && Boolean(deepOpenTarget.dateHint && deepOpenTarget.dateHint !== latestDate);
      if (isUnscheduled) {
        state.mode = 'agenda';
        state.agendaScope = 'month';
        state.detailOpen = false;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.unscheduled.find(item => item.id === deepOpenTarget.guestEventId);
      } else {
        const parts = civilDateParts(latestDate);
        state.mode = 'month';
        state.selectedDate = latestDate;
        state.year = parts.year;
        state.month = parts.month;
        state.detailOpen = true;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.items.find(item => item.id === deepOpenTarget.guestEventId);
      }
    }

    if (!targetItem) {
      showDeepOpenTerminal('일정을 찾지 못했습니다.', 'not-found');
      return;
    }
    root.dataset.calendarDeepOpen = 'opened';
    if (moved) {
      const notice = document.createElement('p');
      notice.className = 'calendar-deep-open-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = '일정이 변경되어 최신 날짜로 열었습니다.';
      status.replaceChildren(notice);
    }
    openEditor(targetItem, latestDate);
  };

  await openDeepTarget();
  // 화면을 켤 때 권한 상태를 읽는다. 읽기만 하는 조회이므로 팝업은 뜨지 않고,
  // 이미 허용된 권한이면 여기서 곧바로 현재 위치를 쓴다 -- 버튼을 누를 필요가 없다.
  // 로그인 여부와 무관하게 필요하다: 손님 캘린더도 같은 날씨를 본다.
  void syncLocationPermission().then(() => {
    if (root.isConnected) render();
  });
  return true;
}
