import {createLifeActivity, editLifeActivity, getCalendarWeather, getKoreaHolidays, getLifeActivity, getLifeAgenda, getLifeAttention, getLifeExpenseSummary, getLifeUnscheduled, removeLifeActivity} from './site-calendar.js?v=aset-0f9b623eab90';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-0f9b623eab90';
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
} from './site-calendar-model.js?v=aset-0f9b623eab90';
import {calendarExpenseSummaryNode, expenseSummaryFromEntries, EXPENSE_CATEGORY_CHOICES} from './site-calendar-expense.js?v=aset-0f9b623eab90';
// One version string, matching site-calendar.js: a second query string makes a
// second module instance, and then the SiteCoreError this file compares against
// is a different class from the one site-calendar.js throws. site-core.js is
// unchanged here, so it keeps the version the Calendar already loads.
import {CORE_ORIGIN, sendConversationMessage, uploadConversationAttachment, SiteCoreError} from './site-core.js?v=aset-0f9b623eab90';
import {calendarWeatherAttribution, calendarWeatherByDate, calendarWeatherIconNode} from './site-calendar-weather.js?v=aset-0f9b623eab90';
import {lunarDateLabel, solarToLunar} from './site-calendar-lunar.js?v=aset-0f9b623eab90';
import {
  calendarEventPresentation,
  calendarWeatherPresentation,
  calendarWeekDays,
  calendarWeekTimeGrid,
  filterScheduleItems,
  monthCellSummary,
} from './site-calendar-product.js?v=aset-0f9b623eab90';
import {getPublicCalendarWeather, resolvePublicWeatherRegion} from './site-calendar-public-weather.js?v=aset-0f9b623eab90';
import {clearCalendarManualWeatherRegion, readCalendarManualWeatherRegion, writeCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-0f9b623eab90';
import {BROWSER_NOTIFICATION_PERMISSION, getBrowserNotificationPermissionState, requestBrowserNotificationPermissionForFeature} from './site-calendar-notifications.js?v=aset-0f9b623eab90';
import {getCalendarPushConfig, registerCalendarPushSubscriptionWithCore, registerCalendarPushWorker, subscribeCalendarPush} from './site-calendar-push.js?v=aset-0f9b623eab90';
import {BrowserLocationError, getBrowserLocationPermissionState, isFreshBrowserCurrentLocation, LOCATION_PERMISSION, LOCATION_RESOLUTION, requestBrowserCurrentLocation} from './site-current-location.js?v=aset-0f9b623eab90';

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
    // Unlike the two settings above, lunar dates are new screen density on
    // every cell rather than a correction to something already shown, so
    // this one ships off until the owner asks for it.
    showLunarDates: stored.showLunarDates === true,
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
      showLunarDates: settings?.showLunarDates === true,
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
  const guestPayload = (value, temporal) => ({
    title: value.title,
    local_date: value.localDate || null,
    local_datetime: temporal.kind === 'LOCAL_DATE_TIME' ? temporal.local_datetime : temporal.kind === 'TIME_WINDOW' ? temporal.window_start : null,
    local_end_datetime: temporal.kind === 'TIME_WINDOW' ? temporal.window_end : null,
    local_end_date: temporal.kind === 'TIME_WINDOW' ? temporal.window_end.slice(0, 10) : temporal.kind === 'DATE_RANGE' ? temporal.date_end : null,
    all_day: temporal.kind === 'DATE_ONLY' || temporal.kind === 'DATE_RANGE',
    entry: value.entry,
  });
  return Object.freeze({
    async create(input) {
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.create(guestPayload(value, temporal));
      return createLifeActivity(sessionToken, {
        logicalRequestId: requestId('create'), title: value.title, temporal,
        temporalSemantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', entry: value.entry,
      }, fetchImpl);
    },
    async update(item, input) {
      if (!calendarItemActionPolicy(item).canUpdate) {
        throw new SiteCoreError('읽기 전용 일정은 수정할 수 없습니다.', {
          code: 'LIFE_ACTION_NOT_ALLOWED',
          status: 403,
        });
      }
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.update(item.id, guestPayload(value, temporal));
      return editLifeActivity(sessionToken, item.activity_id || item.activityId, {
        logicalRequestId: requestId('edit'),
        expectedActivityRevision: item.activity_revision ?? item.activityRevision,
        expectedOccurrenceRevision: item.occurrence_revision ?? item.occurrenceRevision,
        title: value.title,
        temporal,
        temporalSemantics: 'USER_PLANNED_TIME',
        busy: 'UNKNOWN',
        entry: value.entry,
      }, fetchImpl);
    },
    async remove(item) {
      if (!calendarItemActionPolicy(item).canRemove) {
        throw new SiteCoreError('읽기 전용 일정은 삭제할 수 없습니다.', {
          code: 'LIFE_ACTION_NOT_ALLOWED',
          status: 403,
        });
      }
      if (!authenticated) return guestRepository.remove(item.id);
      return removeLifeActivity(sessionToken, item.activity_id || item.activityId, {
        logicalRequestId: requestId('remove'), expectedRevision: item.activity_revision ?? item.activityRevision,
      }, fetchImpl);
    },
  });
}

function withCalendarShape(item) {
  return Object.freeze({...item, all_day: isAllDay(item)});
}

function withUnscheduledShape(item) {
  return Object.freeze({
    activity_id: item.activityId,
    occurrence_id: item.occurrenceId,
    title: item.title,
    activity_revision: item.activityRevision,
    occurrence_revision: item.occurrenceRevision,
    temporal: item.temporal,
    temporal_kind: item.temporal?.kind || 'UNSCHEDULED',
    temporal_semantics: item.temporalSemantics,
    busy: item.busy,
    confirmation_level: item.confirmationLevel,
    provider_verified: item.providerVerified === true,
    source_kind: 'USER_INPUT',
    entry: item.entry || {},
    local_date: null,
    local_datetime: null,
    all_day: false,
  });
}

export function buildCalendarAriaLabel(cell, count, {today = false, selected = false, attention = false, weather = null, holiday = null} = {}) {
  const {year, month, day} = civilDateParts(cell.date);
  const parts = [`${year}년 ${month}월 ${day}일 ${WEEKDAYS[cell.weekday]}, 일정 ${count}개`];
  // Outside the month on screen the date recedes visually; a screen reader must
  // be told the same thing rather than left to infer it from the spoken month.
  if (cell.inCurrentMonth === false) parts.push('다른 달');
  if (today) parts.push('오늘');
  if (selected) parts.push('선택됨');
  if (attention) parts.push('확인 필요 일정 있음');
  if (holiday?.name) parts.push(`대한민국 공휴일 ${holiday.name}`);
  if (weather?.label) parts.push(`날씨 ${weather.label}`);
  return parts.join(', ');
}

export function countCalendarEventsByMonth(items, year) {
  const counts = Array(12).fill(0);
  for (const item of Array.isArray(items) ? items : []) {
    if (!validCivilDate(item?.local_date)) continue;
    const parts = civilDateParts(item.local_date);
    if (parts.year === year) counts[parts.month - 1] += 1;
  }
  return counts;
}

// Core serves Calendar weather for a bounded forward window: it rejects a span
// wider than 15 inclusive days with WEATHER_DATE_WINDOW_INVALID, and a forecast
// exists only from today onward. The month grid covers 42 cells, so sending the
// grid range straight through asks for ~35 days and is refused every time.
//
// Clamp to the part of the visible grid a forecast can actually cover: never
// before today, never more than 14 days ahead. A month with no such overlap -- a
// past month, or one starting beyond the horizon -- yields no window at all, and
// the caller skips the request rather than asking for days that cannot exist.
const WEATHER_FORECAST_HORIZON_DAYS = 14;

function forecastWindow(range, today) {
  if (!range || !validCivilDate(today)) return null;
  const start = range.start > today ? range.start : today;
  const horizon = addCivilDays(today, WEATHER_FORECAST_HORIZON_DAYS);
  const end = range.end < horizon ? range.end : horizon;
  if (end < start) return null;
  return {start, end};
}

function calendarRangeYears(range) {
  if (!validCivilDate(range?.start) || !validCivilDate(range?.end) || range.end < range.start) return [];
  const startYear = civilDateParts(range.start).year;
  const endYear = civilDateParts(range.end).year;
  return Array.from({length: endYear - startYear + 1}, (_, index) => startYear + index);
}

export async function loadKoreaHolidaysForRange(range, fetchImpl = globalThis.fetch) {
  const years = calendarRangeYears(range);
  if (!years.length) return Object.freeze({coverageStatus: 'UNAVAILABLE', items: Object.freeze([])});
  const results = await Promise.all(years.map(async year => {
    try {
      return await getKoreaHolidays(year, fetchImpl);
    } catch (error) {
      console.warn('[LOTBI 캘린더] 대한민국 공휴일을 불러오지 못했습니다.', error);
      return {coverageStatus: 'UNAVAILABLE', items: []};
    }
  }));
  const unique = new Map();
  for (const item of results.flatMap(result => result?.items || [])) {
    const key = [item.date, item.name, item.holidayType, String(item.isSubstitute)].join('\u0000');
    if (!unique.has(key)) unique.set(key, item);
  }
  const items = [...unique.values()].sort((left, right) =>
    left.date.localeCompare(right.date)
      || left.name.localeCompare(right.name)
      || String(left.holidayType).localeCompare(String(right.holidayType))
      || Number(left.isSubstitute) - Number(right.isSubstitute));
  return Object.freeze({
    coverageStatus: results.every(result => result?.coverageStatus === 'VERIFIED') ? 'VERIFIED' : 'UNAVAILABLE',
    items: Object.freeze(items),
  });
}

// 날씨 자리에 둘 조용한 안내. 없는 날씨를 그럴듯한 값으로 메우지 않고, 실패를
// 실패라고만 적는다.
function weatherFailureCopy(error) {
  if (!error) return '';
  if (error instanceof SiteCoreError && (error.status === 401 || error.status === 403)) {
    return '날씨는 로그인 상태에서 불러옵니다. 일정은 그대로 표시됩니다.';
  }
  if (error instanceof SiteCoreError && error.retryable) {
    return '날씨를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  return '날씨를 지금 표시할 수 없어요. 일정은 그대로 표시됩니다.';
}

export async function loadLifeCalendarManagerView(
  sessionToken,
  {view = 'month', date, timezone = resolvedTimezone(), now = new Date(), fetchImpl = globalThis.fetch, weatherLocation = null, weekStart = 0} = {},
) {
  const selectedDate = validCivilDate(date) ? date : dateInTimezone(now, timezone);
  const key = normalizeMode(view);
  const range = key === 'year'
    ? yearBounds(selectedDate)
    : key === 'week'
      ? {...weekBounds(selectedDate, weekStart), ...civilDateParts(selectedDate)}
      : monthBounds(selectedDate);
  const weatherWindow = key === 'month' || key === 'week'
    ? forecastWindow(range, dateInTimezone(now, timezone))
    : null;
  const weatherRequest = weatherWindow
    ? getCalendarWeather(sessionToken, {
        start: weatherWindow.start,
        end: weatherWindow.end,
        timezone,
        latitude: weatherLocation?.latitude,
        longitude: weatherLocation?.longitude,
        midRegionCode: weatherLocation?.midRegionCode || '',
      }, fetchImpl).catch(error => {
        // 방어는 그대로 둔다 -- 날씨가 실패해도 일정·공휴일·가계부는 나와야 한다.
        // 고치는 것은 침묵이다: 원인을 콘솔에 남기고, 실패했다는 사실을 화면까지
        // 들고 올라간다. 빈 결과와 실패는 서로 다른 일이다.
        console.warn('[LOTBI 캘린더] 날씨를 불러오지 못했습니다.', error);
        return {providerReady: false, items: [], aiCalls: 0, failure: error};
      })
    : Promise.resolve({providerReady: false, items: [], aiCalls: 0});
  const holidayRequest = (key === 'month' || key === 'week' || key === 'year')
    ? loadKoreaHolidaysForRange(range, fetchImpl)
    : Promise.resolve({coverageStatus: 'UNAVAILABLE', items: []});
  const [response, monthAttention, unscheduled, weather, holidays] = await Promise.all([
    getLifeAgenda(sessionToken, {timezone, start: range.start, end: range.end}, fetchImpl),
    // 일정 보기도 함께 읽는다: 확인 필요 탭이 사라진 뒤 지금 달에 없는 지난 기한을
    // 보여줄 유일한 자리가 그곳이다.
    key === 'month' || key === 'week' || key === 'agenda'
      ? getLifeAttention(sessionToken, {timezone, horizonDays: 365}, fetchImpl)
      : Promise.resolve(null),
    key === 'agenda'
      ? getLifeUnscheduled(sessionToken, fetchImpl)
      : Promise.resolve(null),
    weatherRequest,
    holidayRequest,
  ]);
  return Object.freeze({
    key,
    date: selectedDate,
    year: range.year,
    month: range.month,
    range: Object.freeze({start: range.start, end: range.end}),
    kind: 'agenda',
    items: Object.freeze(response.items.map(withCalendarShape)),
    attention: Object.freeze(monthAttention?.items || []),
    unscheduled: Object.freeze((unscheduled?.items || []).map(withUnscheduledShape)),
    weather: Object.freeze(weather?.items || []),
    weatherProviderReady: weather?.providerReady === true,
    weatherFailureMessage: weatherFailureCopy(weather?.failure),
    holidays: Object.freeze(holidays?.items || []),
    holidayCoverageStatus: holidays?.coverageStatus || 'UNAVAILABLE',
  });
}

// Toolbar icons are inline SVG, not emoji: an emoji renders as a different
// shape on every OS (the gear read as a sun on the reporter's screen, which is
// why the settings control was mistaken for a weather button). Inline rather
// than a <use> reference because the sprite lives in index.html and the
// Calendar also mounts from auth/callback/, which has no sprite.
// Shape language is the sidebar's: 24x24 box, stroke-only, 1.8 weight,
// round caps and joins.
const SVG_NS = 'http://www.w3.org/2000/svg';

function toolbarIcon(shapes) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'calendar-toolbar-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    svg.appendChild(node);
  }
  return svg;
}

// Sliders, not a gear. A gear is a circle with radial spokes, and at 19px that
// is the same figure as a sun -- which is precisely the confusion being fixed
// here, and it would collide head-on with the weather glyphs the day cells
// carry. Two tracks with offset handles read as "controls" at this size and
// cannot be mistaken for weather.
const SETTINGS_ICON_SHAPES = Object.freeze([
  ['path', {d: 'M4 9h16M4 15h16'}],
  ['path', {d: 'M9.5 6.5v5M15.5 12.5v5'}],
]);

function button(label, className) {
  const value = document.createElement('button');
  value.type = 'button';
  value.className = className;
  value.textContent = label;
  return value;
}

export function rovingTabTargetIndex(key, currentIndex, length) {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= length || length < 1) return null;
  if (key === 'ArrowRight') return (currentIndex + 1) % length;
  if (key === 'ArrowLeft') return (currentIndex - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return null;
}

export function monthGridKeyboardTargetDate(date, key, weekStart = 0) {
  if (!validCivilDate(date)) return null;
  if (key !== 'Home' && key !== 'End') return null;
  const {year, month, day} = civilDateParts(date);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const rowOffset = (weekday - normalizeWeekStart(weekStart) + 7) % 7;
  return addCivilDays(date, key === 'Home' ? -rowOffset : 6 - rowOffset);
}

function bindRovingTablist(container, controls) {
  const tabs = Array.from(controls);
  container.addEventListener('keydown', event => {
    const current = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    const currentIndex = tabs.indexOf(current);
    const targetIndex = rovingTabTargetIndex(event.key, currentIndex, tabs.length);
    if (targetIndex === null) return;
    event.preventDefault();
    const target = tabs[targetIndex];
    for (const tab of tabs) {
      const selected = tab === target;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    target.focus();
    target.click();
  });
}

function emptyMessage(text) {
  const value = document.createElement('p');
  value.className = 'life-calendar-empty';
  value.textContent = text;
  return value;
}

function attentionStateLabel(value) {
  if (value === 'UPCOMING') return '기한 예정';
  if (value === 'DUE_TODAY') return '오늘 기한';
  if (value === 'OVERDUE') return '기한 지남';
  return '';
}

// 09/12 15:00 → 09/13 11:00. A stay, a flight and a rental are one entry with
// two ends, and showing only the check-in reads as if the owner never leaves.
// Core sends an ending only when the booking stated one, so an ordinary
// appointment is untouched and keeps showing its single time in the left column.
export function eventSpanText(item) {
  const endDate = typeof item?.local_end_date === 'string' ? item.local_end_date : '';
  const endDatetime = typeof item?.local_end_datetime === 'string' ? item.local_end_datetime : '';
  const resolvedEnd = validCivilDate(endDate) ? endDate : endDatetime.slice(0, 10);
  if (!validCivilDate(item?.local_date) || !validCivilDate(resolvedEnd)) return '';
  const stamp = (date, datetime) => {
    const day = `${date.slice(5, 7)}/${date.slice(8, 10)}`;
    const clock = typeof datetime === 'string' && datetime.length >= 16 ? datetime.slice(11, 16) : '';
    return clock ? `${day} ${clock}` : day;
  };
  const start = stamp(item.local_date, item.local_datetime);
  const finish = stamp(resolvedEnd, endDatetime);
  return start === finish ? '' : `${start} → ${finish}`;
}

function eventMetaText(item) {
  const parts = [];
  const span = eventSpanText(item);
  if (span) parts.push(span);
  const attention = attentionStateLabel(item?.calendar_attention_state || item?.state);
  if (attention) parts.push(attention);
  if (String(item?.id || '').startsWith('guest_')) parts.push('이 기기에 저장');
  else if (item?.provider_verified === true && item?.confirmation_level === 'PROVIDER_VERIFIED') parts.push('외부 확인됨');
  else if (item?.source_kind === 'USER_INPUT' || item?.confirmation_level === 'USER_ATTESTED') parts.push('직접 입력');
  return parts.join(' · ');
}

function eventList(items, {onSelect} = {}) {
  const list = document.createElement('ul');
  list.className = 'calendar-day-list';
  for (const item of sortCalendarEvents(items)) {
    const presentation = calendarEventPresentation(item);
    const li = document.createElement('li');
    li.className = 'calendar-day-event';
    li.dataset.eventKind = presentation.kind;
    li.dataset.calendarEventId = item.id || item.activity_id || '';
    const time = document.createElement('time');
    time.textContent = eventTime(item);
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const badges = document.createElement('span');
    badges.className = 'calendar-event-badges';
    const type = document.createElement('span');
    type.className = 'calendar-event-type';
    type.textContent = presentation.typeLabel;
    badges.appendChild(type);
    if (presentation.statusLabel) {
      const status = document.createElement('span');
      status.className = 'calendar-event-status';
      status.textContent = presentation.statusLabel;
      badges.appendChild(status);
    }
    const meta = document.createElement('small');
    meta.textContent = presentation.metaText || eventMetaText(item);
    copy.append(title, badges);
    if (meta.textContent) copy.append(meta);
    li.append(time, copy);
    if (onSelect) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', `${eventTime(item)} ${item.title}${meta.textContent ? `, ${meta.textContent}` : ""}`);
      li.addEventListener('click', event => onSelect(item, event.currentTarget));
      li.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item, event.currentTarget); }
      });
    }
    list.appendChild(li);
  }
  return list;
}

function dayPanel(state, groups, actions) {
  const panel = document.createElement('aside');
  panel.className = 'calendar-day-panel';
  panel.dataset.selectedDate = state.selectedDate;
  panel.dataset.collapsed = String(state.dayCollapsed);
  panel.dataset.presentation = dayDetailPresentation();
  panel.dataset.reducedMotion = String(prefersReducedMotion());
  panel.hidden = !state.detailOpen;

  const head = document.createElement('div');
  head.className = 'calendar-day-panel-head';
  const heading = document.createElement('h3');
  heading.className = 'calendar-day-heading';
  const selectedParts = civilDateParts(state.selectedDate);
  const selectedWeekday = new Date(Date.UTC(selectedParts.year, selectedParts.month - 1, selectedParts.day, 12)).getUTCDay();
  heading.textContent = `${selectedParts.month}월 ${selectedParts.day}일 ${WEEKDAY_INITIALS[selectedWeekday]}`;
  const controls = document.createElement('div');
  controls.className = 'calendar-day-panel-actions';
  const close = button('×', 'calendar-day-close');
  close.setAttribute('aria-label', '선택한 날짜 일정 닫기');
  close.addEventListener('click', () => actions.closeDay());
  controls.append(close);
  head.append(heading, controls);

  const body = document.createElement('div');
  body.className = 'calendar-day-body';
  body.hidden = state.dayCollapsed;
  const selectedHoliday = state.showKoreaHolidays
    ? holidaysByDate(state.holidays).get(state.selectedDate)
    : null;
  if (selectedHoliday) {
    const holiday = document.createElement('div');
    holiday.className = 'calendar-day-holiday';
    holiday.setAttribute('role', 'note');
    holiday.textContent = `${selectedHoliday.name} · 대한민국 공휴일`;
    body.appendChild(holiday);
  }
  const items = groups.get(state.selectedDate) || [];
  // Entries first when there are any: what is already on the day is what the
  // owner opened it to see. The line that adds one sits under them either way.
  if (items.length) body.appendChild(eventList(items, {onSelect: actions.onEvent}));
  // Neither control repeats the date: the selected day is already in the panel
  // heading, the toolbar title and the highlighted cell. It stays in each
  // accessible name so a screen reader still hears which day.
  const {month: addMonth, day: addDay} = civilDateParts(state.selectedDate);

  if (state.imageMessage) {
    const message = document.createElement('p');
    message.className = 'calendar-add-message';
    message.dataset.calendarAddMessage = '';
    message.setAttribute('role', 'status');
    message.textContent = state.imageMessage;
    body.appendChild(message);
  }

  // The two ways in, and the only controls the panel offers: a picture, or the
  // full form. On an empty day the "nothing here" sentence shares their row
  // rather than taking one of its own -- the panel is small enough that a
  // spare line is felt.
  const addRow = document.createElement('div');
  addRow.className = 'calendar-add-actions';
  if (!items.length) addRow.appendChild(emptyMessage('등록된 일정이 없어요.'));

  const addImage = button('사진에서 일정 추가', 'calendar-add-button calendar-add-image-button');
  addImage.dataset.calendarAddImage = '';
  addImage.setAttribute('aria-label', `${addMonth}월 ${addDay}일에 이미지로 일정 등록`);
  addImage.addEventListener('click', () => actions.onAddFromImage?.(state.selectedDate));

  const add = button('+ 일정 추가', 'calendar-add-button calendar-add-detail-button');
  add.dataset.calendarAdd = '';
  add.setAttribute('aria-label', `${addMonth}월 ${addDay}일 일정을 직접 입력해서 등록`);
  add.addEventListener('click', () => actions.onAdd?.(state.selectedDate));

  addRow.append(addImage, add);
  body.appendChild(addRow);
  // What the compact one-row layout keys off: nothing in the body but this row.
  body.dataset.empty = String(!items.length && !selectedHoliday && !state.imageMessage);
  panel.append(head, body);
  return panel;
}

function monthEventRow(item, onSelect) {
  const row = button('', 'calendar-event-chip');
  row.dataset.eventChip = '';
  row.dataset.calendarEventId = item.id || item.activity_id || '';
  if (!isAllDay(item)) {
    const time = document.createElement('span');
    time.className = 'calendar-event-time';
    time.textContent = eventTime(item);
    row.appendChild(time);
  }
  const title = document.createElement('span');
  title.className = 'calendar-event-title';
  title.textContent = item.title;
  row.appendChild(title);
  row.setAttribute('aria-label', `${isAllDay(item) ? "" : `${eventTime(item)} `}${item.title}`);
  row.addEventListener('click', event => {
    event.stopPropagation();
    onSelect(item, event.currentTarget);
  });
  return row;
}

function fitMonthEventDensity(layout) {
  // monthCellSummary() already caps every cell at two event rows and one +N
  // control. Marking the settled layout keeps the existing render hook stable
  // without measuring every event in a dense month.
  layout.dataset.monthDensity = 'bounded';
}

function syncMonthLayout(layout) {
  fitMonthEventDensity(layout);
}

// A fixed pixel row height (rather than a percentage of the scroller) keeps
// every hour the same visual size regardless of viewport, which is what
// makes a 30-minute block and a 2-hour block read as different lengths.
const CALENDAR_WEEK_HOUR_HEIGHT = 48;
const MINUTES_PER_DAY = 24 * 60;

function renderWeek(state, actions, weatherCredit = null) {
  const section = document.createElement('section');
  section.className = 'calendar-week-agenda';
  section.setAttribute('aria-label', '주간 일정');
  const grid = calendarWeekTimeGrid(state.selectedDate, state.items, state.weekStart);
  const weatherByDate = calendarWeatherByDate(state.weather);
  const holidayMap = state.showKoreaHolidays ? holidaysByDate(state.holidays) : new Map();

  // A quick-jump strip above the grid: most useful once the 7 columns need a
  // horizontal scroll on a narrow screen, where a tap can reach a day that is
  // currently off-screen without swiping there by hand.
  const strip = document.createElement('div');
  strip.className = 'calendar-week-strip';
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', '이번 주 날짜');
  const weekControls = [];
  for (const day of calendarWeekDays(state.selectedDate, state.weekStart)) {
    const selected = day.date === state.selectedDate;
    const control = button('', 'calendar-week-date');
    control.dataset.calendarWeekDate = day.date;
    control.dataset.selected = String(selected);
    control.setAttribute('role', 'tab');
    control.setAttribute('aria-selected', String(selected));
    control.setAttribute('aria-label', koreanDate(day.date));
    control.tabIndex = selected ? 0 : -1;
    const weekday = document.createElement('span');
    weekday.textContent = WEEKDAY_INITIALS[day.weekday];
    const number = document.createElement('strong');
    number.textContent = String(day.day);
    control.append(weekday, number);
    control.addEventListener('click', () => { void actions.selectDate(day.date); });
    weekControls.push(control);
    strip.appendChild(control);
  }
  bindRovingTablist(strip, weekControls);
  section.appendChild(strip);

  const hasAny = grid.some(day => day.timed.length > 0 || day.allDay.length > 0);
  if (!hasAny) section.appendChild(emptyMessage('이번 주에는 일정이 없어요.'));

  const body = document.createElement('div');
  body.className = 'calendar-week-grid';

  // Sticky column headers: weekday, date and (per the weather icon that used
  // to sit in the agenda row heading) the day's forecast.
  const header = document.createElement('div');
  header.className = 'calendar-week-grid-header';
  header.appendChild(document.createElement('div')).className = 'calendar-week-grid-axis-spacer';

  // A row of its own, separate from the timed grid below: an all-day event
  // or a holiday has no clock time, so it never competes for a slot on the
  // hour axis and stays visible without scrolling the grid.
  const alldayRow = document.createElement('div');
  alldayRow.className = 'calendar-week-allday-row';
  alldayRow.appendChild(document.createElement('div')).className = 'calendar-week-grid-axis-spacer';

  const scroll = document.createElement('div');
  scroll.className = 'calendar-week-grid-scroll';
  const hourAxis = document.createElement('div');
  hourAxis.className = 'calendar-week-hour-axis';
  hourAxis.style.height = `${MINUTES_PER_DAY / 60 * CALENDAR_WEEK_HOUR_HEIGHT}px`;
  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement('div');
    label.className = 'calendar-week-hour-label';
    label.style.top = `${hour * CALENDAR_WEEK_HOUR_HEIGHT}px`;
    if (hour > 0) label.textContent = `${String(hour).padStart(2, '0')}:00`;
    hourAxis.appendChild(label);
  }
  scroll.dataset.gridLines = String(state.showGridLines !== false);
  scroll.appendChild(hourAxis);
  const columnHeight = `${MINUTES_PER_DAY / 60 * CALENDAR_WEEK_HOUR_HEIGHT}px`;

  for (const day of grid) {
    const selected = day.date === state.selectedDate;
    const holiday = holidayMap.get(day.date);
    const weather = weatherByDate.get(day.date);

    const headerCell = button('', 'calendar-week-day');
    headerCell.dataset.calendarWeekDate = day.date;
    headerCell.dataset.selected = String(selected);
    headerCell.dataset.holiday = String(Boolean(holiday));
    headerCell.setAttribute('aria-label', koreanDate(day.date));
    const weekdayLabel = document.createElement('span');
    weekdayLabel.className = 'calendar-week-day-weekday';
    weekdayLabel.textContent = WEEKDAY_INITIALS[day.weekday];
    const dayNumber = document.createElement('strong');
    dayNumber.className = 'calendar-week-day-number';
    dayNumber.textContent = String(day.day);
    headerCell.append(weekdayLabel, dayNumber);
    if (state.showLunarDates) {
      const lunarLabel = lunarDateLabel(solarToLunar(day.date));
      if (lunarLabel) {
        const lunar = document.createElement('span');
        lunar.className = 'calendar-week-day-lunar';
        lunar.textContent = lunarLabel;
        headerCell.appendChild(lunar);
        headerCell.setAttribute('aria-label', `${headerCell.getAttribute('aria-label')}, 음력 ${lunarLabel}`);
      }
    }
    if (weather) {
      const weatherLine = document.createElement('span');
      weatherLine.className = 'calendar-week-weather';
      const temperature = calendarWeatherPresentation(weather).weekLabel;
      weatherLine.textContent = [weather.label, temperature].filter(Boolean).join(' · ');
      weatherLine.setAttribute('aria-label', `날씨 ${weatherLine.textContent}`);
      const weatherIcon = calendarWeatherIconNode(weather.weatherKind);
      if (weatherIcon) weatherLine.prepend(weatherIcon);
      headerCell.appendChild(weatherLine);
    }
    headerCell.addEventListener('click', () => { void actions.selectDate(day.date); });
    header.appendChild(headerCell);

    const alldayCell = document.createElement('div');
    alldayCell.className = 'calendar-week-allday-cell';
    alldayCell.dataset.selected = String(selected);
    alldayCell.dataset.holiday = String(Boolean(holiday));
    if (holiday) {
      const holidayLine = document.createElement('span');
      holidayLine.className = 'calendar-week-holiday';
      holidayLine.textContent = holiday.name;
      alldayCell.appendChild(holidayLine);
    }
    for (const item of day.allDay) {
      const chip = button(item.title, 'calendar-week-allday-event');
      chip.dataset.calendarEventId = item.id || item.activity_id || '';
      chip.addEventListener('click', event => actions.onEvent(item, event.currentTarget));
      alldayCell.appendChild(chip);
    }
    alldayRow.appendChild(alldayCell);

    const group = document.createElement('div');
    group.className = 'calendar-week-grid-day';
    group.dataset.calendarWeekGroup = day.date;
    group.dataset.selected = String(selected);
    group.style.height = columnHeight;
    for (const entry of day.timed) {
      const item = entry.item;
      const presentation = calendarEventPresentation(item);
      const block = button('', 'calendar-week-grid-event');
      block.dataset.eventKind = presentation.kind;
      block.dataset.calendarEventId = item.id || item.activity_id || '';
      block.style.top = `${(entry.start / MINUTES_PER_DAY) * 100}%`;
      block.style.height = `${((entry.end - entry.start) / MINUTES_PER_DAY) * 100}%`;
      block.style.setProperty('--calendar-event-lane', String(entry.lane));
      block.style.setProperty('--calendar-event-lane-count', String(entry.laneCount));
      const time = document.createElement('span');
      time.className = 'calendar-week-grid-event-time';
      time.textContent = presentation.timeLabel;
      const title = document.createElement('span');
      title.className = 'calendar-week-grid-event-title';
      title.textContent = item.title;
      block.append(time, title);
      block.setAttribute('aria-label', `${presentation.timeLabel} ${item.title}`);
      block.addEventListener('click', event => actions.onEvent(item, event.currentTarget));
      group.appendChild(block);
    }
    scroll.appendChild(group);
  }

  body.append(header, alldayRow, scroll);
  section.appendChild(body);
  // Land the scroller on the working day rather than midnight; a render is a
  // fresh mount every time (Week has no state of its own to preserve here),
  // so resetting the scroll position on every call is the expected result,
  // not a lost user scroll.
  requestAnimationFrame(() => {
    scroll.scrollTop = Math.max(0, 7 * CALENDAR_WEEK_HOUR_HEIGHT - 24);
  });

  const addActions = document.createElement('div');
  addActions.className = 'calendar-week-add-actions';
  const add = button('+ 일정 추가', 'calendar-add-button');
  add.addEventListener('click', () => actions.onAdd?.(state.selectedDate));
  const addImage = button('사진에서 일정 추가', 'calendar-add-button calendar-add-image-button');
  addImage.addEventListener('click', () => actions.onAddFromImage?.(state.selectedDate));
  addActions.append(add, addImage);
  section.appendChild(addActions);

  if (weatherCredit) {
    const credit = document.createElement('p');
    credit.className = 'calendar-weather-credit';
    credit.textContent = weatherCredit.text;
    section.appendChild(credit);
  } else if (state.weatherMessage) {
    const notice = document.createElement('p');
    notice.className = 'calendar-weather-credit';
    notice.setAttribute('role', 'status');
    notice.textContent = state.weatherMessage;
    section.appendChild(notice);
  }
  return section;
}

function renderMonth(state, actions, weatherCredit = null) {
  const layout = document.createElement('div');
  layout.className = 'calendar-month-layout';
  layout.dataset.detailOpen = String(state.detailOpen);
  // The stylesheet needs to know which presentation is in play from the layout
  // itself: the month has to be raised above the sheet's dismiss layer, and
  // that rule cannot reach up from the panel to its parent.
  layout.dataset.dayDetail = dayDetailPresentation();
  const calendar = document.createElement('section');
  calendar.className = 'calendar-month';
  const weekdays = document.createElement('div');
  weekdays.className = 'calendar-weekdays';
  weekdays.setAttribute('aria-hidden', 'true');
  for (const weekday of weekdayOrder(state.weekStart)) {
    const day = document.createElement('span');
    day.textContent = WEEKDAY_INITIALS[weekday];
    // The heading carries its weekday rather than relying on being first or
    // last in the row: with a Monday start those positions hold 월 and 일.
    day.dataset.weekday = String(weekday);
    weekdays.appendChild(day);
  }
  const grid = document.createElement('div');
  grid.className = 'calendar-month-grid';
  grid.dataset.gridLines = String(state.showGridLines !== false);
  grid.dataset.weekStart = String(state.weekStart);
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `${state.year}년 ${state.month}월`);
  const groups = groupCalendarEvents(state.items);
  const attentionDates = new Set(state.attention.map(item => item?.due_date).filter(validCivilDate));
  const weatherByDate = calendarWeatherByDate(state.weather);
  const holidayMap = state.showKoreaHolidays ? holidaysByDate(state.holidays) : new Map();
  const cells = calendarMonthGrid(state.year, state.month, state.weekStart);
  grid.dataset.weekCount = String(cells.length / 7);

  for (const cell of cells) {
    const events = groups.get(cell.date) || [];
    const selected = cell.date === state.selectedDate;
    const today = cell.date === state.todayDate;
    const hasAttention = attentionDates.has(cell.date);
    const weather = weatherByDate.get(cell.date) || null;
    const holiday = holidayMap.get(cell.date) || null;

    const cellNode = document.createElement('div');
    cellNode.className = 'calendar-date-cell';
    cellNode.dataset.calendarDate = cell.date;
    cellNode.dataset.currentMonth = String(cell.inCurrentMonth);
    // Weekend colour keys off the real weekday, not the cell's position in the
    // row. Position only meant Sunday and Saturday while the week could not
    // start anywhere else; with a Monday start it would paint 월 and 일.
    cellNode.dataset.weekday = String(cell.weekday);
    cellNode.dataset.selected = String(selected);
    cellNode.dataset.today = String(today);
    cellNode.dataset.attention = String(hasAttention);
    cellNode.dataset.holiday = String(Boolean(holiday));
    cellNode.setAttribute('role', 'gridcell');
    cellNode.setAttribute('aria-selected', String(selected));

    const header = document.createElement('div');
    header.className = 'calendar-date-header';
    const date = button(String(cell.day), 'calendar-date-trigger');
    date.dataset.calendarDateTrigger = cell.date;
    date.dataset.selected = String(selected);
    date.setAttribute('aria-label', buildCalendarAriaLabel(cell, events.length, {today, selected, attention: hasAttention, weather, holiday}));
    if (today) date.setAttribute('aria-current', 'date');
    date.tabIndex = selected ? 0 : -1;
    const number = document.createElement('span');
    number.className = 'calendar-date-number';
    number.textContent = String(cell.day);
    date.textContent = '';
    date.appendChild(number);
    if (state.showLunarDates) {
      const lunarLabel = lunarDateLabel(solarToLunar(cell.date));
      if (lunarLabel) {
        const lunar = document.createElement('span');
        lunar.className = 'calendar-date-lunar';
        lunar.textContent = lunarLabel;
        lunar.setAttribute('aria-hidden', 'true');
        date.appendChild(lunar);
        date.setAttribute('aria-label', `${date.getAttribute('aria-label')}, 음력 ${lunarLabel}`);
      }
    }
    date.addEventListener('click', event => {
      event.stopPropagation();
      void actions.selectDate(cell.date, {openDetail: true});
    });
    date.addEventListener('keydown', event => actions.onDateKey(event, cell.date));

    const count = document.createElement('span');
    count.className = 'calendar-mobile-event-count';
    count.textContent = events.length ? `${events.length}개` : '';
    count.setAttribute('aria-hidden', 'true');
    header.append(date, count);
    if (weather) {
      const weatherSummary = document.createElement('span');
      weatherSummary.className = 'calendar-weather-summary';
      weatherSummary.setAttribute('aria-hidden', 'true');
      // 글리프 자체는 site-calendar-weather.js 가 만든다 — Core 가 보내는
      // weather_icon 이모지를 그대로 쓴다.
      const weatherIcon = calendarWeatherIconNode(weather.weatherKind);
      if (weatherIcon) {
        weatherIcon.title = weather.label;
        weatherSummary.appendChild(weatherIcon);
      }
      const temperatureLabel = calendarWeatherPresentation(weather).monthLabel;
      if (temperatureLabel) {
        const temperature = document.createElement('span');
        temperature.className = 'calendar-weather-temperature';
        temperature.dataset.compactTemperature = temperatureLabel.replace(/\s+/g, '');
        if (Number.isFinite(weather.minTemperature) && Number.isFinite(weather.maxTemperature)) {
          temperature.classList.add('calendar-weather-temperature-range');
          const minimum = document.createElement('span');
          minimum.className = 'calendar-weather-temperature-min';
          minimum.textContent = `${Math.round(weather.minTemperature)}°`;
          const separator = document.createElement('span');
          separator.className = 'calendar-weather-temperature-separator';
          separator.textContent = '/';
          const maximum = document.createElement('span');
          maximum.className = 'calendar-weather-temperature-max';
          maximum.textContent = `${Math.round(weather.maxTemperature)}°`;
          temperature.append(minimum, separator, maximum);
        } else {
          const value = document.createElement('span');
          value.className = 'calendar-weather-temperature-value';
          value.textContent = temperatureLabel;
          temperature.appendChild(value);
        }
        weatherSummary.appendChild(temperature);
      }
      if (weatherSummary.childElementCount) header.appendChild(weatherSummary);
    }
    if (hasAttention) {
      const marker = document.createElement('span');
      marker.className = 'calendar-attention-marker';
      marker.textContent = '확인 필요';
      marker.setAttribute('aria-hidden', 'true');
      header.appendChild(marker);
    }

    let holidayLabel = null;
    if (holiday) {
      holidayLabel = document.createElement('div');
      holidayLabel.className = 'calendar-holiday-label';
      holidayLabel.dataset.calendarHoliday = holiday.date;
      holidayLabel.textContent = holiday.name;
      holidayLabel.title = `${holiday.name} · 대한민국 공휴일`;
      holidayLabel.setAttribute('aria-hidden', 'true');
    }

    const stack = document.createElement('div');
    stack.className = 'calendar-event-stack';
    const summary = monthCellSummary(events);
    for (const item of summary.visible) stack.appendChild(monthEventRow(item, actions.onEvent));
    const more = button('', 'calendar-event-overflow');
    more.dataset.eventOverflow = '';
    more.hidden = !summary.moreLabel;
    more.textContent = summary.moreLabel;
    more.setAttribute('aria-label', `${cell.month}월 ${cell.day}일 일정 ${summary.remaining}개 더 보기`);
    more.addEventListener('click', event => {
      event.stopPropagation();
      void actions.selectDate(cell.date, {openDetail: true});
    });
    stack.appendChild(more);

    cellNode.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      void actions.selectDate(cell.date, {openDetail: true});
    });
    cellNode.appendChild(header);
    if (holidayLabel) cellNode.appendChild(holidayLabel);
    cellNode.appendChild(stack);
    grid.appendChild(cellNode);
  }

  calendar.append(weekdays, grid);
  // 기상청 출처표시는 날짜 칸에 예보가 실제로 그려졌을 때만, 그 그리드 바로
  // 아래에 붙는다. 셸의 행으로 두면 휴대폰에서 기본으로 열려 있는 날짜 시트에
  // 통째로 가려져서, 의무인 표기가 화면에 없는 것과 같아진다.
  // .calendar-month 의 grid-template-rows(데스크톱)는 건드리지 않는다:
  // 명시적으로 3행에 놓아 암시적 행을 만들어 쓴다.
  if (weatherCredit) {
    const creditLine = document.createElement('p');
    creditLine.className = 'calendar-weather-credit';
    creditLine.dataset.calendarWeatherCredit = '';
    creditLine.textContent = weatherCredit.text;
    calendar.appendChild(creditLine);
  }
  // 날씨를 못 불러왔으면 그 자리에 그렇게 적는다. 출처 줄과 같은 자리·같은 톤:
  // 일정 위로 올라와 달력을 밀어내지 않고, 빈 칸이 원인 없이 남지도 않는다.
  if (!weatherCredit && state.weatherMessage) {
    const notice = document.createElement('p');
    notice.className = 'calendar-weather-credit';
    notice.dataset.calendarWeatherNotice = '';
    notice.setAttribute('role', 'status');
    notice.textContent = state.weatherMessage;
    calendar.appendChild(notice);
  }
  const panel = dayPanel(state, groups, actions);
  // Order matters: existing runtime checks read layout.children[0] as the month and
  // layout.children[1] as the selected-day surface. The sheet backdrop is appended
  // after both so that contract is preserved.
  layout.append(calendar, panel);
  if (usesFlowingDayDetail()) {
    bindMonthSwipe(calendar, {
      onPrevious: () => void actions.shiftMonth?.(-1),
      onNext: () => void actions.shiftMonth?.(1),
      isBusy: () => Boolean(state.loading),
    });
  }
  const schedule = globalThis.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 0));
  schedule(() => { if (layout.isConnected) syncMonthLayout(layout); });
  return layout;
}

function renderYear(state, actions) {
  const grid = document.createElement('div');
  grid.className = 'calendar-year-grid';
  grid.setAttribute('aria-label', `${state.year}년 연간 달력`);
  const counts = countCalendarEventsByMonth(state.items, state.year);
  for (const month of calendarYearOverview(state.year, state.weekStart)) {
    const card = button('', 'calendar-year-month');
    card.dataset.yearMonth = String(month.month);
    card.dataset.current = String(state.year === civilDateParts(state.todayDate).year && month.month === civilDateParts(state.todayDate).month);
    const title = document.createElement('strong'); title.textContent = month.label;
    const weekdays = document.createElement('span'); weekdays.className = 'calendar-mini-weekdays'; weekdays.textContent = weekdayOrder(state.weekStart).map(weekday => WEEKDAY_INITIALS[weekday]).join(' ');
    const dates = document.createElement('span'); dates.className = 'calendar-mini-grid';
    for (const cell of month.cells) {
      const day = document.createElement('span'); day.textContent = cell.inCurrentMonth ? String(cell.day) : ''; dates.appendChild(day);
    }
    const count = document.createElement('span'); count.className = 'calendar-year-event-count'; count.textContent = `일정 ${counts[month.month - 1]}개`;
    card.append(title, weekdays, dates, count);
    card.setAttribute('aria-label', `${state.year}년 ${month.month}월, 일정 ${counts[month.month - 1]}개, 월간 보기`);
    card.addEventListener('click', () => actions.selectMonth(month.month));
    grid.appendChild(card);
  }
  return grid;
}

function renderAgenda(state, actions) {
  const section = document.createElement('section');
  section.className = 'calendar-agenda-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'calendar-agenda-toolbar';
  toolbar.setAttribute('aria-label', '일정 필터');
  for (const [scope, label] of [
    ['all', '전체'],
    ['today', '오늘'],
    ['week', '이번 주'],
    ['month', '이번 달'],
    ['reservation', '예약'],
    ['payment', '결제'],
    ['schedule', '일정'],
  ]) {
    const control = button(label, 'calendar-agenda-range');
    control.dataset.agendaScope = scope;
    control.setAttribute('aria-pressed', String(state.agendaScope === scope));
    control.addEventListener('click', () => actions.setAgendaScope(scope));
    toolbar.appendChild(control);
  }
  section.appendChild(toolbar);

  const filterAnchor = state.agendaScope === 'month'
    ? `${state.year}-${String(state.month).padStart(2, '0')}-01`
    : state.todayDate;
  const items = filterScheduleItems(state.items, state.agendaScope, {
    today: filterAnchor,
    weekStart: state.weekStart,
  });

  // 확인 필요 탭이 유일하게 하던 일 -- 지금 달에 없는 지난 기한 -- 을 여기서
  // 이어받는다. 달력 칸의 기한 표시(attentionDates)는 그대로 두고, 이 묶음은
  // 이번 달 범위에서만 나온다: '오늘'·'이번 주' 는 그 날짜의 일정을 보는 자리다.
  const overdue = (state.agendaScope === 'month' || state.agendaScope === 'all')
    ? (state.attention || []).filter(item => item?.state === 'OVERDUE' && validCivilDate(item.due_date))
    : [];
  const showUnscheduled = ['all', 'month', 'schedule'].includes(state.agendaScope) && state.unscheduled.length > 0;
  if (overdue.length) {
    const group = document.createElement('section');
    group.className = 'calendar-overdue-group';
    group.dataset.calendarOverdueGroup = '';
    const heading = document.createElement('h3');
    heading.textContent = '기한 지남';
    const note = document.createElement('p');
    note.className = 'calendar-unscheduled-note';
    note.textContent = '기한이 지난 일입니다. 이번 달 달력에 없는 것도 여기 남습니다.';
    group.append(heading, note, eventList(overdue.map(item => ({
      ...item,
      local_date: item.due_date,
      local_datetime: null,
      calendar_attention_state: item.state,
    }))));
    section.appendChild(group);
  }
  if (!items.length && !showUnscheduled && !overdue.length) {
    section.appendChild(emptyMessage('이 기간에는 일정이 없어요.'));
    return section;
  }

  const groups = groupCalendarEvents(items);
  for (const [date, values] of groups) {
    const group = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = koreanDate(date);
    group.append(heading, eventList(values, {onSelect: actions.onEvent}));
    section.appendChild(group);
  }
  if (showUnscheduled) {
    const group = document.createElement('section');
    group.className = 'calendar-unscheduled-group';
    const heading = document.createElement('h3');
    heading.textContent = '날짜 미정';
    const note = document.createElement('p');
    note.className = 'calendar-unscheduled-note';
    note.textContent = '날짜를 정하지 않은 일정입니다. 열어서 날짜를 추가하거나 그대로 둘 수 있어요.';
    group.append(heading, note, eventList(state.unscheduled, {onSelect: actions.onEvent}));
    section.appendChild(group);
  }
  return section;
}

function calendarSettingsDialog({root, state, storage, onChange, onRedraw = () => {}, onWeatherRegionChange, buildLocationRow, getWeatherLocationPresentation, authenticated, sessionToken, fetchImpl}) {
  const opener = document.activeElement;
  root.querySelector('.calendar-settings-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'calendar-settings-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'calendar-settings-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'calendar-settings-heading');

  const header = document.createElement('div');
  header.className = 'calendar-settings-header';
  const heading = document.createElement('h3');
  heading.id = 'calendar-settings-heading';
  heading.textContent = '캘린더 설정';
  const close = button('×', 'calendar-settings-close');
  close.setAttribute('aria-label', '캘린더 설정 닫기');
  header.append(heading, close);

  const body = document.createElement('div');
  body.className = 'calendar-settings-body';
  const section = document.createElement('section');
  const sectionTitle = document.createElement('h4');
  sectionTitle.textContent = '표시';
  const row = document.createElement('label');
  row.className = 'calendar-settings-toggle-row';
  const copy = document.createElement('span');
  const label = document.createElement('strong');
  label.textContent = '대한민국 공휴일 표시';
  const description = document.createElement('small');
  description.textContent = '대한민국 공휴일을 개인 일정과 구분해 표시합니다.';
  copy.append(label, description);
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = state.showKoreaHolidays;
  toggle.setAttribute('aria-label', '대한민국 공휴일 표시');
  row.append(copy, toggle);

  // 격자선: the lines are already on today, so this switch turns them OFF for a
  // flatter month. Framed that way on screen too -- a setting that claims to add
  // something already there reads as broken the first time it is toggled.
  const gridRow = document.createElement('label');
  gridRow.className = 'calendar-settings-toggle-row';
  const gridCopy = document.createElement('span');
  const gridLabel = document.createElement('strong');
  gridLabel.textContent = '격자선 표시';
  const gridDescription = document.createElement('small');
  gridDescription.textContent = '날짜 칸 사이의 선을 표시합니다. 끄면 달력이 더 단순해 보여요.';
  gridCopy.append(gridLabel, gridDescription);
  const gridToggle = document.createElement('input');
  gridToggle.type = 'checkbox';
  gridToggle.checked = state.showGridLines !== false;
  gridToggle.setAttribute('aria-label', '격자선 표시');
  gridRow.append(gridCopy, gridToggle);

  // Pure display, like 격자선 above: no fetch depends on it, so toggling it
  // only ever needs a repaint.
  const lunarRow = document.createElement('label');
  lunarRow.className = 'calendar-settings-toggle-row';
  const lunarCopy = document.createElement('span');
  const lunarLabel = document.createElement('strong');
  lunarLabel.textContent = '음력 표시';
  const lunarDescription = document.createElement('small');
  lunarDescription.textContent = '날짜 칸에 음력 날짜를 함께 표시합니다.';
  lunarCopy.append(lunarLabel, lunarDescription);
  const lunarToggle = document.createElement('input');
  lunarToggle.type = 'checkbox';
  lunarToggle.checked = state.showLunarDates === true;
  lunarToggle.setAttribute('aria-label', '음력 표시');
  lunarRow.append(lunarCopy, lunarToggle);

  const weekStartRow = document.createElement('div');
  weekStartRow.className = 'calendar-settings-select-row';
  const weekStartCopy = document.createElement('span');
  const weekStartLabel = document.createElement('strong');
  weekStartLabel.textContent = '주 시작 요일';
  const weekStartDescription = document.createElement('small');
  weekStartDescription.textContent = '달력의 첫 칸을 어느 요일로 둘지 정합니다.';
  weekStartCopy.append(weekStartLabel, weekStartDescription);
  const weekStartSelect = document.createElement('select');
  weekStartSelect.className = 'calendar-settings-select';
  weekStartSelect.id = 'calendar-settings-week-start';
  weekStartSelect.setAttribute('aria-label', '주 시작 요일');
  for (const option of CALENDAR_WEEK_STARTS) {
    const node = document.createElement('option');
    node.value = String(option.value);
    node.textContent = option.label;
    weekStartSelect.appendChild(node);
  }
  weekStartSelect.value = String(state.weekStart);
  weekStartLabel.id = 'calendar-settings-week-start-label';
  weekStartRow.append(weekStartCopy, weekStartSelect);

  section.append(sectionTitle, row, gridRow, lunarRow, weekStartRow);
  body.appendChild(section);

  const weatherSection = document.createElement('section');
  weatherSection.className = 'calendar-settings-section';
  const weatherTitle = document.createElement('h4');
  weatherTitle.textContent = '날씨';
  const weatherOverview = document.createElement('div');
  weatherOverview.className = 'calendar-settings-weather-overview';
  const weatherRegionSummary = document.createElement('strong');
  const weatherRelationship = document.createElement('small');
  const syncWeatherOverview = () => {
    const presentation = typeof getWeatherLocationPresentation === 'function'
      ? getWeatherLocationPresentation()
      : calendarWeatherLocationPresentation({
        manualWeatherRegion: state.manualWeatherRegion,
        weatherRegionOrigin: state.weatherRegionOrigin,
      });
    weatherRegionSummary.textContent = presentation.manualSummary;
    weatherRelationship.textContent = presentation.relationship;
  };
  weatherOverview.append(weatherRegionSummary, weatherRelationship);
  syncWeatherOverview();
  // Current location first, manual region as its fallback: the same order the
  // weather read applies them in.
  const locationRow = typeof buildLocationRow === 'function' ? buildLocationRow() : null;

  // 직접 입력은 없앴다. 자기 위치를 문장으로 적어 넣는 사람은 없고, 오타 하나가
  // 날씨를 통째로 사라지게 만들었다. 대신 Core 가 내려주는 목록 그대로
  // 광역시·도 → 시·군·구 두 단계로 고른다: 2단계에는 1단계에 속한 것만 나온다.
  const provinceRow = document.createElement('div');
  provinceRow.className = 'calendar-settings-select-row';
  const provinceCopy = document.createElement('span');
  const provinceLabel = document.createElement('strong');
  provinceLabel.textContent = '광역시·도';
  const provinceDescription = document.createElement('small');
  provinceDescription.textContent = '먼저 광역시·도를 고르세요.';
  provinceCopy.append(provinceLabel, provinceDescription);
  const provinceSelect = document.createElement('select');
  provinceSelect.className = 'calendar-settings-select';
  provinceSelect.setAttribute('aria-label', '날씨 지역 광역시·도');
  provinceRow.append(provinceCopy, provinceSelect);

  const cityRow = document.createElement('div');
  cityRow.className = 'calendar-settings-select-row';
  const cityCopy = document.createElement('span');
  const cityLabel = document.createElement('strong');
  cityLabel.textContent = '시·군·구';
  const cityDescription = document.createElement('small');
  cityDescription.textContent = '고른 광역시·도에 속한 지역만 나옵니다.';
  cityCopy.append(cityLabel, cityDescription);
  const citySelect = document.createElement('select');
  citySelect.className = 'calendar-settings-select';
  citySelect.setAttribute('aria-label', '날씨 지역 시·군·구');
  cityRow.append(cityCopy, citySelect);

  const weatherRow = document.createElement('div');
  weatherRow.className = 'calendar-settings-region-row';
  const weatherClear = button('수동 지역 해제', 'calendar-settings-action-button');
  weatherClear.dataset.calendarWeatherManualClear = '';
  weatherClear.hidden = !state.manualWeatherRegion;
  const weatherRetry = button('지역 목록 다시 불러오기', 'calendar-settings-action-button');
  weatherRetry.hidden = true;
  weatherRow.append(weatherClear, weatherRetry);
  const weatherStatus = document.createElement('small');
  weatherStatus.className = 'calendar-settings-status';
  const storedRegionStatusText = () => (typeof getWeatherLocationPresentation === 'function'
    ? getWeatherLocationPresentation()
    : calendarWeatherLocationPresentation({
      manualWeatherRegion: state.manualWeatherRegion,
      weatherRegionOrigin: state.weatherRegionOrigin,
    })).manualSummary;
  weatherStatus.textContent = storedRegionStatusText();
  weatherSection.append(weatherTitle, weatherOverview);
  if (locationRow) weatherSection.appendChild(locationRow);
  weatherSection.append(provinceRow, cityRow, weatherRow, weatherStatus);
  body.appendChild(weatherSection);

  const setOptions = (select, options, placeholder) => {
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.appendChild(first);
    for (const option of options) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    }
    select.value = '';
  };

  setOptions(provinceSelect, [], '불러오는 중…');
  setOptions(citySelect, [], '광역시·도를 먼저 고르세요');
  provinceSelect.disabled = true;
  citySelect.disabled = true;

  let regionCatalog = null;
  const fillCities = province => {
    const items = (regionCatalog?.items || []).filter(item => item.province === province);
    if (!province || !items.length) {
      setOptions(citySelect, [], '광역시·도를 먼저 고르세요');
      citySelect.disabled = true;
      return;
    }
    setOptions(citySelect, items.map(item => ({value: item.code, label: item.label})), '시·군·구 선택');
    citySelect.disabled = false;
    const selected = (regionCatalog?.items || []).find(item => item.displayLabel === state.manualWeatherRegion?.label);
    if (selected && selected.province === province) citySelect.value = selected.code;
  };

  const showProvinceOptions = () => {
    setOptions(
      provinceSelect,
      regionCatalog.provinces.map(province => ({value: province, label: province})),
      '광역시·도 선택',
    );
    provinceSelect.disabled = false;
    // 이미 저장된 지역이 있으면 그것이 어디에 속한 것인지 그대로 보여준다.
    const selected = regionCatalog.items.find(item => item.displayLabel === state.manualWeatherRegion?.label);
    if (selected) {
      provinceSelect.value = selected.province;
      fillCities(selected.province);
    } else {
      fillCities('');
    }
  };

  // 현재 위치가 해결되는 동안에도 Settings는 열린 채로 남는다. 그 경우 overview
  // 문구만 바꾸면 아래 두 선택칸은 빈 값으로 남아, 위치가 적용되지 않은 것처럼
  // 보인다. 같은 catalog 항목을 찾아 두 칸도 즉시 현재 지역으로 맞춘다.
  const syncWeatherRegionSelects = () => {
    if (!regionCatalog) return;
    const selected = regionCatalog.items.find(
      item => item.displayLabel === state.manualWeatherRegion?.label,
    );
    if (!selected) return;
    provinceSelect.value = selected.province;
    fillCities(selected.province);
    citySelect.value = selected.code;
    weatherStatus.textContent = storedRegionStatusText();
  };
  root.addEventListener(CALENDAR_WEATHER_REGION_SYNC_EVENT, syncWeatherRegionSelects);

  const loadRegionOptions = async () => {
    weatherRetry.hidden = true;
    provinceSelect.disabled = true;
    citySelect.disabled = true;
    setOptions(provinceSelect, [], '불러오는 중…');
    const {catalog, failure} = await readCalendarWeatherRegions(fetchImpl);
    if (!backdrop.isConnected) return;
    if (catalog) {
      regionCatalog = catalog;
      writeCalendarWeatherRegionList(storage, catalog);
      showProvinceOptions();
      weatherStatus.textContent = storedRegionStatusText();
      return;
    }
    // 서버가 답하지 않는다고 해서 고를 것이 하나도 없는 빈 상자를 내밀지는 않는다.
    // 전에 받아 둔 목록이 있으면 그것으로 고를 수 있게 하고, 그것이 어제 것임을
    // 숨기지 않는다.
    const cached = readCalendarWeatherRegionList(storage);
    if (cached) {
      regionCatalog = cached;
      showProvinceOptions();
      weatherRetry.hidden = false;
      weatherStatus.textContent = `${weatherRegionListFailureCopy(failure)} 지금은 전에 받아 둔 목록으로 고를 수 있어요.`;
      return;
    }
    setOptions(provinceSelect, [], '목록을 불러오지 못했어요');
    weatherRetry.hidden = false;
    weatherStatus.textContent = `${weatherRegionListFailureCopy(failure)} 다시 불러오거나 현재 위치를 사용해 주세요.`;
  };

  provinceSelect.addEventListener('change', () => { fillCities(provinceSelect.value); });
  weatherRetry.addEventListener('click', () => { void loadRegionOptions(); });

  // 설정창을 연 것은 사용자의 명시적인 동작이다. 목록은 그때 읽고, 좌표를 묻는
  // 지오코딩은 사용자가 시·군·구를 고른 뒤에만 한다 -- 마운트에서는 어느 것도 없다.
  void loadRegionOptions();

  citySelect.addEventListener('change', async () => {
    const chosen = (regionCatalog?.items || []).find(item => item.code === citySelect.value);
    if (!chosen) return;
    provinceSelect.disabled = true;
    citySelect.disabled = true;
    weatherStatus.textContent = '지역을 확인하는 중…';
    try {
      // 목록이 좌표를 들고 왔으면 그것이 곧 답이다. 같은 좌표를 지오코더에게 다시
      // 묻는 것은 왕복 한 번을 더 쓰는 일이고, 그 왕복은 날씨 조회와 분당 한도를
      // 나눠 쓴다.
      const listed = Number.isFinite(chosen.latitude) && Number.isFinite(chosen.longitude)
        ? {latitude: chosen.latitude, longitude: chosen.longitude, midRegionCode: null}
        : null;
      const result = listed
        ? {providerReady: true, found: true, region: listed}
        : await resolvePublicWeatherRegion(chosen.displayLabel, fetchImpl);
      if (!result.providerReady) {
        weatherStatus.textContent = '현재 지역 검색 기능을 준비 중이에요.';
        return;
      }
      if (!result.found || !result.region) {
        weatherStatus.textContent = '이 지역의 좌표를 확인하지 못했어요. 다른 지역을 골라 주세요.';
        return;
      }
      // 이름은 우리가 보여준 목록의 이름을 그대로 쓴다. 지오코더가 돌려주는 이름은
      // 사용자가 고르지 않은 이름일 수 있고, 고른 것과 다른 이름을 적으면 거짓말이다.
      const region = {
        label: chosen.displayLabel,
        latitude: result.region.latitude,
        longitude: result.region.longitude,
        midRegionCode: result.region.midRegionCode || null,
      };
      if (!writeCalendarManualWeatherRegion(region, storage)) {
        weatherStatus.textContent = '이 브라우저에 지역 설정을 저장하지 못했어요.';
        return;
      }
      writeWeatherRegionOrigin(storage, WEATHER_REGION_ORIGIN.MANUAL);
      state.manualWeatherRegion = region;
      state.weatherRegionOrigin = WEATHER_REGION_ORIGIN.MANUAL;
      weatherClear.hidden = false;
      syncWeatherOverview();
      weatherStatus.textContent = storedRegionStatusText();
      await onWeatherRegionChange(region);
    } catch (error) {
      console.warn('[LOTBI 캘린더] 날씨 지역을 확인하지 못했습니다.', error);
      weatherStatus.textContent = error instanceof SiteCoreError
        ? error.message
        : '날씨 지역을 확인하지 못했어요.';
    } finally {
      if (backdrop.isConnected) {
        provinceSelect.disabled = false;
        citySelect.disabled = false;
      }
    }
  });

  weatherClear.addEventListener('click', async () => {
    clearCalendarManualWeatherRegion(storage);
    writeWeatherRegionOrigin(storage, null);
    state.manualWeatherRegion = null;
    state.weatherRegionOrigin = null;
    citySelect.value = '';
    weatherClear.hidden = true;
    syncWeatherOverview();
    weatherStatus.textContent = '저장된 지역을 해제했습니다. 현재 위치를 다시 사용할 수 있어요.';
    await onWeatherRegionChange(null);
  });

  const notificationSection = document.createElement('section');
  notificationSection.className = 'calendar-settings-section';
  const notificationTitle = document.createElement('h4');
  notificationTitle.textContent = '알림';
  const notificationRow = document.createElement('div');
  notificationRow.className = 'calendar-settings-action-row';
  const notificationCopy = document.createElement('span');
  const notificationLabel = document.createElement('strong');
  notificationLabel.textContent = '일정 알림';
  const notificationStatus = document.createElement('small');
  notificationStatus.className = 'calendar-settings-status';
  const notificationButton = button('알림 사용', 'calendar-settings-action-button');
  notificationButton.setAttribute('aria-label', '일정 알림 사용');
  notificationCopy.append(notificationLabel, notificationStatus);
  notificationRow.append(notificationCopy, notificationButton);
  notificationSection.append(notificationTitle, notificationRow);
  // 이 절은 아직 화면에 붙이지 않는다. 서버에 알림 서명 키가 없으면 버튼은
  // 껍데기이고, 껍데기를 비활성 상태로 남겨 두는 것도 설명이 필요한 잔재다.
  // 붙일지는 아래에서 config 를 읽어 결정한다 -- 지우는 것이 아니라 조건부 렌더링이므로
  // 서버가 켜지면 이 코드가 그대로 다시 항목을 그린다.

  const currentNotificationPermission = () => getBrowserNotificationPermissionState();
  const renderNotificationState = (message = '') => {
    const permission = currentNotificationPermission();
    notificationButton.disabled = !authenticated
      || permission === BROWSER_NOTIFICATION_PERMISSION.DENIED
      || permission === BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;
    if (!authenticated) {
      notificationButton.textContent = '로그인 후 사용';
      notificationStatus.textContent = '로그인된 계정에서 일정 알림을 연결할 수 있어요.';
      return;
    }
    if (message) {
      notificationStatus.textContent = message;
    } else if (permission === BROWSER_NOTIFICATION_PERMISSION.GRANTED) {
      notificationStatus.textContent = '브라우저 알림 권한이 허용되어 있어요.';
    } else if (permission === BROWSER_NOTIFICATION_PERMISSION.DENIED) {
      notificationStatus.textContent = '브라우저 사이트 설정에서 알림을 허용해 주세요.';
    } else if (permission === BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE) {
      notificationStatus.textContent = '이 브라우저에서는 알림 기능을 사용할 수 없어요.';
    } else {
      notificationStatus.textContent = '버튼을 누를 때만 브라우저가 알림 권한을 요청합니다.';
    }
    notificationButton.textContent = permission === BROWSER_NOTIFICATION_PERMISSION.GRANTED
      ? '알림 연결'
      : '알림 사용';
  };

  notificationButton.addEventListener('click', async () => {
    if (!authenticated || notificationButton.disabled) return;
    notificationButton.disabled = true;
    notificationStatus.textContent = '알림 준비 상태를 확인하는 중…';
    try {
      const config = await getCalendarPushConfig(fetchImpl);
      if (!config.ready || !config.dispatchReady) {
        renderNotificationState('현재 알림 전송 기능을 준비 중이에요.');
        return;
      }
      const permission = await requestBrowserNotificationPermissionForFeature();
      if (permission !== BROWSER_NOTIFICATION_PERMISSION.GRANTED) {
        renderNotificationState(
          permission === BROWSER_NOTIFICATION_PERMISSION.DENIED
            ? '브라우저 사이트 설정에서 알림을 허용해 주세요.'
            : '알림 권한을 사용할 수 없어요.',
        );
        return;
      }
      const registration = await registerCalendarPushWorker();
      const subscription = await subscribeCalendarPush({
        registration,
        vapidPublicKey: config.vapidPublicKey,
      });
      const coreSubscription = await registerCalendarPushSubscriptionWithCore({
        sessionToken,
        subscription,
        fetchImpl,
      });
      try {
        storage?.setItem?.(CALENDAR_PUSH_SUBSCRIPTION_STORAGE_KEY, JSON.stringify({
          pushSubscriptionId: coreSubscription.push_subscription_id,
          updatedAt: new Date().toISOString(),
        }));
      } catch {
        // Push registration remains authoritative even when local metadata cannot be persisted.
      }
      renderNotificationState('일정 알림을 사용할 준비가 됐어요.');
    } catch (error) {
      const copy = error instanceof SiteCoreError && error.retryable
        ? '알림 연결을 완료하지 못했어요. 다시 시도해 주세요.'
        : '알림 연결을 완료하지 못했어요.';
      renderNotificationState(copy);
    } finally {
      if (backdrop.isConnected && currentNotificationPermission() !== BROWSER_NOTIFICATION_PERMISSION.DENIED) {
        notificationButton.disabled = false;
      }
    }
  });

  // 알림 항목은 서버가 실제로 보낼 수 있을 때만 존재한다. web_push 가 꺼져 있거나
  // 서명 키가 없으면 제목·버튼·설명문 전체를 그리지 않는다. 조회가 실패해도 감춘다:
  // 보낼 수 있는지 모르는 상태에서 "알림 사용" 을 내밀면 약속이 된다.
  void (async () => {
    let dispatchable = false;
    try {
      const config = await getCalendarPushConfig(fetchImpl);
      dispatchable = config.enabled === true && config.ready === true && config.dispatchReady === true;
    } catch (error) {
      console.warn('[LOTBI 캘린더] 알림 준비 상태를 확인하지 못해 알림 항목을 감춥니다.', error);
      dispatchable = false;
    }
    if (!dispatchable || !backdrop.isConnected) return;
    body.appendChild(notificationSection);
    renderNotificationState();
  })();

  dialog.append(header, body);
  backdrop.appendChild(dialog);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    root.removeEventListener(CALENDAR_WEATHER_REGION_SYNC_EVENT, syncWeatherRegionSelects);
    backdrop.remove();
    const focusTarget = opener instanceof HTMLElement && opener.isConnected
      ? opener
      : root.querySelector('.calendar-settings-button');
    focusTarget?.focus();
  };
  close.addEventListener('click', dismiss);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) dismiss(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('button, input, select, summary')]
        .filter(control => !control.disabled && !control.hidden && !control.closest('[hidden]'));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  toggle.addEventListener('change', () => {
    state.showKoreaHolidays = toggle.checked;
    writeCalendarDisplaySettings(storage, state);
    void onChange(toggle.checked);
  });

  // Neither of these needs new data, so they repaint rather than refetch. If the
  // write fails the screen still follows the switch -- the setting is lost on
  // the next load, the Calendar is not lost now.
  gridToggle.addEventListener('change', () => {
    state.showGridLines = gridToggle.checked;
    writeCalendarDisplaySettings(storage, state);
    onRedraw();
  });

  lunarToggle.addEventListener('change', () => {
    state.showLunarDates = lunarToggle.checked;
    writeCalendarDisplaySettings(storage, state);
    onRedraw();
  });

  weekStartSelect.addEventListener('change', () => {
    state.weekStart = normalizeWeekStart(Number(weekStartSelect.value));
    weekStartSelect.value = String(state.weekStart);
    writeCalendarDisplaySettings(storage, state);
    onRedraw();
  });

  root.appendChild(backdrop);
  queueMicrotask(() => toggle.focus());
}

function calendarReadonlyDetailDialog({root, item, opener = null, onClose = () => {}}) {
  root.querySelector('.calendar-readonly-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'calendar-readonly-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'calendar-readonly-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'calendar-readonly-heading');

  const header = document.createElement('div');
  header.className = 'calendar-readonly-header';
  const heading = document.createElement('h3');
  heading.id = 'calendar-readonly-heading';
  heading.textContent = '일정 상세';
  const close = button('×', 'calendar-readonly-close');
  close.setAttribute('aria-label', '읽기 전용 일정 닫기');
  header.append(heading, close);

  const title = document.createElement('strong');
  title.className = 'calendar-readonly-title';
  title.textContent = item?.title || '일정';
  const notice = document.createElement('p');
  notice.className = 'calendar-readonly-notice';
  notice.textContent = '읽기 전용 일정';
  const details = document.createElement('dl');
  details.className = 'calendar-readonly-details';
  const presentation = calendarEventPresentation(item);
  const entry = item?.entry && typeof item.entry === 'object' ? item.entry : {};
  const rows = [
    ['시간', eventTime(item)],
    ['종류 · 상태', [presentation.typeLabel, presentation.statusLabel].filter(Boolean).join(' · ')],
    ['장소', entry.place || ''],
    ['예약처', entry.merchant || ''],
    ['메모', entry.memo || ''],
    ['출처', item?.source_kind === 'LIFE_RESULT' ? '연결된 결과' : '직접 입력'],
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = String(value);
    details.append(term, description);
  }

  const footer = document.createElement('div');
  footer.className = 'calendar-readonly-actions';
  const done = button('닫기', 'calendar-readonly-done');
  footer.append(done);
  dialog.append(header, title, notice, details, footer);
  backdrop.append(dialog);
  root.append(backdrop);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    backdrop.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    else onClose();
  };
  close.addEventListener('click', dismiss);
  done.addEventListener('click', dismiss);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) dismiss(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [close, done].filter(control => !control.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  queueMicrotask(() => close.focus());
  return dialog;
}

function calendarEditorDialog({root, item, selectedDate, initialDraft = null, authenticated, controller, onSaved, onStale, onClose = () => {}}) {
  root.querySelector('.calendar-editor-backdrop')?.remove();
  document.body.classList.remove('calendar-editor-open');

  const backdrop = document.createElement('div'); backdrop.className = 'calendar-editor-backdrop';
  const dialog = document.createElement('section'); dialog.className = 'calendar-editor-dialog';
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'calendar-editor-heading');
  const draft = !item && initialDraft && typeof initialDraft === 'object' ? initialDraft : null;
  const itemPolicy = calendarItemActionPolicy(item);
  const heading = document.createElement('h3'); heading.id = 'calendar-editor-heading'; heading.textContent = item ? '일정 수정' : (draft ? '일정 초안 확인' : '일정 등록');
  const editorHeader = document.createElement('div'); editorHeader.className = 'calendar-editor-header';
  const closeButton = button('×', 'calendar-editor-close'); closeButton.setAttribute('aria-label', '닫기');
  editorHeader.append(heading, closeButton);
  const form = document.createElement('form'); form.className = 'calendar-editor-form';
  const editorBody = document.createElement('div'); editorBody.className = 'calendar-editor-body';

  document.body.classList.add('calendar-editor-open');
  let viewportCleanup = () => {};
  if (usesFlowingDayDetail()) {
    viewportCleanup = bindVisualViewport(backdrop, {
      heightVar: '--calendar-editor-visual-height',
      topVar: '--calendar-editor-visual-top',
    });
  }
  let editorEnvironmentReleased = false;
  const releaseEditorEnvironment = () => {
    if (editorEnvironmentReleased) return;
    editorEnvironmentReleased = true;
    viewportCleanup();
    document.body.classList.remove('calendar-editor-open');
  };

  const titleLabel = document.createElement('label'); titleLabel.textContent = '일정 제목 *';
  const titleInput = document.createElement('input'); titleInput.className = 'calendar-editor-title'; titleInput.name = 'calendar-title'; titleInput.required = true; titleInput.maxLength = 240; titleInput.value = item?.title || draft?.title || '';
  titleLabel.appendChild(titleInput);
  const titleNote = document.createElement('small'); titleNote.id = 'calendar-editor-title-note'; titleNote.textContent = '제목만 있으면 저장할 수 있어요. 나머지는 선택 사항입니다.';

  const dateLabel = document.createElement('label'); dateLabel.textContent = '날짜';
  const dateInput = document.createElement('input'); dateInput.className = 'calendar-editor-date'; dateInput.type = 'date'; dateInput.value = item?.local_date || canonicalActivityLocalDate(item) || (draft ? (draft.localDate || '') : (selectedDate || '')); dateLabel.appendChild(dateInput);

  const allDayLabel = document.createElement('label'); allDayLabel.className = 'calendar-editor-all-day';
  const allDayInput = document.createElement('input'); allDayInput.type = 'checkbox'; allDayInput.checked = item ? isAllDay(item) : !draft?.localTime; allDayLabel.append(allDayInput, document.createTextNode('종일'));

  const primary = document.createElement('div'); primary.className = 'calendar-editor-primary';
  const details = document.createElement('details'); details.className = 'calendar-editor-details';
  const detailsSummary = document.createElement('summary'); detailsSummary.textContent = '상세 입력 (선택)';
  details.append(detailsSummary);

  const timeControl = document.createElement('div'); timeControl.className = 'calendar-editor-time-control';
  const timeLabel = document.createElement('span'); timeLabel.textContent = '시작 시간';
  const timeInput = document.createElement('input'); timeInput.className = 'calendar-editor-time'; timeInput.type = 'text'; timeInput.inputMode = 'numeric'; timeInput.maxLength = 5; timeInput.placeholder = 'HH:mm'; timeInput.setAttribute('aria-label', '시작 시간 네 자리 숫자 또는 HH:mm'); timeInput.value = item?.local_datetime?.slice(11, 16) || draft?.localTime || '';
  const endTimeInput = document.createElement('input'); endTimeInput.className = 'calendar-editor-end-time'; endTimeInput.type = 'text'; endTimeInput.inputMode = 'numeric'; endTimeInput.maxLength = 5; endTimeInput.placeholder = 'HH:mm'; endTimeInput.setAttribute('aria-label', '종료 시간 네 자리 숫자 또는 HH:mm'); endTimeInput.value = item?.local_end_datetime?.slice(11, 16) || draft?.endLocalTime || '';
  const existingEndDate = item?.local_end_date || item?.local_end_datetime?.slice(0, 10) || draft?.endLocalDate || '';
  const hasMultiDayEnd = Boolean(existingEndDate && existingEndDate !== dateInput.value);
  const endDateLabel = document.createElement('label'); endDateLabel.className = 'calendar-editor-end-date-label'; endDateLabel.textContent = '종료 날짜';
  const endDateInput = document.createElement('input'); endDateInput.className = 'calendar-editor-end-date'; endDateInput.type = 'date'; endDateInput.value = hasMultiDayEnd ? existingEndDate : '';
  endDateLabel.append(endDateInput);
  endDateLabel.hidden = !hasMultiDayEnd;
  const timeTrigger = button('', 'calendar-editor-time-trigger');
  const endTimeTrigger = button('', 'calendar-editor-end-time-trigger');
  const timeSheet = document.createElement('div'); timeSheet.className = 'calendar-editor-time-sheet'; timeSheet.hidden = true; timeSheet.setAttribute('role', 'group'); timeSheet.setAttribute('aria-label', '시간 선택');
  timeSheet.id = 'calendar-editor-time-sheet';
  for (const trigger of [timeTrigger, endTimeTrigger]) {
    trigger.setAttribute('aria-controls', timeSheet.id);
    trigger.setAttribute('aria-expanded', 'false');
  }
  const quickTimes = document.createElement('div'); quickTimes.className = 'calendar-editor-time-quick';
  for (const time of ['09:00', '12:00', '18:00']) {
    const quick = button(time, 'calendar-editor-time-quick-choice'); quick.dataset.quickTime = time; quickTimes.appendChild(quick);
  }
  const clearTime = button('시간 지우기', 'calendar-editor-time-clear');
  const doneTime = button('완료', 'calendar-editor-time-done');
  const sheetActions = document.createElement('div'); sheetActions.className = 'calendar-editor-time-actions'; sheetActions.append(clearTime, doneTime);
  timeSheet.append(quickTimes, timeInput, endTimeInput, sheetActions);
  timeControl.append(timeLabel, timeTrigger, endTimeTrigger, timeSheet);
  let activeTimeInput = timeInput;
  let activeTimeTrigger = timeTrigger;
  const refreshTimeLabels = () => {
    timeTrigger.textContent = timeInput.value || '시작 시간 선택';
    endTimeTrigger.textContent = endTimeInput.value ? `종료 ${endTimeInput.value}` : '종료 시간 추가 (선택)';
  };
  const closeTimeSheet = ({restoreFocus = true} = {}) => {
    timeSheet.hidden = true;
    timeTrigger.setAttribute('aria-expanded', 'false'); endTimeTrigger.setAttribute('aria-expanded', 'false');
    timeInput.setAttribute('aria-invalid', 'false'); endTimeInput.setAttribute('aria-invalid', 'false');
    refreshTimeLabels();
    if (restoreFocus) activeTimeTrigger.focus();
  };
  const openTimeSheet = (input, trigger) => {
    closeCategorySheet({restoreFocus: false});
    activeTimeInput = input; activeTimeTrigger = trigger;
    timeInput.hidden = input !== timeInput; endTimeInput.hidden = input !== endTimeInput;
    timeSheet.hidden = false;
    timeTrigger.setAttribute('aria-expanded', String(trigger === timeTrigger));
    endTimeTrigger.setAttribute('aria-expanded', String(trigger === endTimeTrigger));
    input.focus();
  };
  timeTrigger.addEventListener('click', () => openTimeSheet(timeInput, timeTrigger));
  endTimeTrigger.addEventListener('click', () => openTimeSheet(endTimeInput, endTimeTrigger));
  quickTimes.addEventListener('click', event => {
    const quick = event.target.closest('[data-quick-time]');
    if (!quick) return;
    activeTimeInput.value = quick.dataset.quickTime;
    activeTimeInput.setAttribute('aria-invalid', 'false');
    activeTimeInput.focus();
  });
  clearTime.addEventListener('click', () => {
    activeTimeInput.value = '';
    if (activeTimeInput === timeInput) endTimeInput.value = '';
    closeTimeSheet();
  });
  doneTime.addEventListener('click', () => {
    const normalized = normalizeCalendarClockInput(activeTimeInput.value);
    if (normalized === null) {
      activeTimeInput.setAttribute('aria-invalid', 'true'); activeTimeInput.focus(); return;
    }
    activeTimeInput.value = normalized;
    closeTimeSheet();
  });
  refreshTimeLabels();

  const syncTemporalControls = () => {
    const hasDate = Boolean(dateInput.value);
    allDayInput.disabled = !hasDate;
    timeControl.hidden = !hasDate || allDayInput.checked;
    timeInput.disabled = !hasDate || allDayInput.checked;
    endTimeInput.disabled = !hasDate || allDayInput.checked;
    timeTrigger.disabled = !hasDate || allDayInput.checked;
    endTimeTrigger.disabled = !hasDate || allDayInput.checked;
    if (timeControl.hidden) closeTimeSheet({restoreFocus: false});
    if (!hasDate) {timeInput.value = ''; endTimeInput.value = ''; refreshTimeLabels();}
  };
  dateInput.addEventListener('change', syncTemporalControls);
  allDayInput.addEventListener('change', syncTemporalControls);
  syncTemporalControls();

  const entry = item?.entry && typeof item.entry === 'object'
    ? item.entry
    : draft?.entry && typeof draft.entry === 'object'
      ? {
          amount_minor: draft.entry.amountMinor,
          currency: draft.entry.currency,
          expense_category: draft.entry.expenseCategory,
          memo: draft.entry.memo,
          place: draft.entry.place,
          merchant: draft.entry.merchant,
        }
      : {};
  // Not placeholder="0": an empty box showing a grey 0 reads as "0원 recorded"
  // when it actually means "no amount recorded", and the two are different
  // things in the totals bar — one is a zero, the other is excluded and
  // counted. The 대표 read a blank 여행 entry as a saved 0 because of it.
  const amountLabel = document.createElement('label'); amountLabel.textContent = '비용';
  const amountInput = document.createElement('input'); amountInput.className = 'calendar-editor-amount'; amountInput.type = 'number'; amountInput.inputMode = 'numeric'; amountInput.min = '0'; amountInput.step = '1'; amountInput.value = Number.isInteger(entry.amount_minor) ? String(entry.amount_minor) : ''; amountLabel.appendChild(amountInput);

  const categoryLabel = document.createElement('div'); categoryLabel.className = 'calendar-editor-category-field';
  const categoryHeading = document.createElement('span'); categoryHeading.textContent = '비용 종류'; categoryLabel.append(categoryHeading);
  const categoryInput = document.createElement('select'); categoryInput.className = 'calendar-editor-category';
  categoryInput.hidden = true; categoryInput.setAttribute('aria-hidden', 'true'); categoryInput.tabIndex = -1;
  for (const [value, label] of EXPENSE_CATEGORY_CHOICES) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; categoryInput.appendChild(option);
  }
  categoryInput.value = entry.expense_category === 'UNCLASSIFIED' ? '' : (entry.expense_category || '');
  categoryLabel.appendChild(categoryInput);
  const categoryTrigger = button('', 'calendar-editor-category-trigger');
  const categorySheet = document.createElement('div'); categorySheet.className = 'calendar-editor-category-sheet'; categorySheet.hidden = true;
  categorySheet.setAttribute('role', 'group'); categorySheet.setAttribute('aria-label', '비용 종류 선택');
  categorySheet.id = 'calendar-editor-category-sheet';
  categoryTrigger.setAttribute('aria-controls', categorySheet.id); categoryTrigger.setAttribute('aria-expanded', 'false');
  const closeCategorySheet = ({restoreFocus = true} = {}) => {
    categorySheet.hidden = true;
    categoryTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) categoryTrigger.focus();
  };
  const refreshCategoryLabel = () => {
    categoryTrigger.textContent = EXPENSE_CATEGORY_CHOICES.find(([value]) => value === categoryInput.value)?.[1] || '비용 종류 선택';
  };
  for (const [value, label] of EXPENSE_CATEGORY_CHOICES) {
    const choice = button(label, 'calendar-editor-category-choice'); choice.dataset.category = value;
    choice.addEventListener('click', () => {
      categoryInput.value = value; closeCategorySheet(); refreshCategoryLabel();
    });
    categorySheet.append(choice);
  }
  categoryTrigger.addEventListener('click', () => {
    closeTimeSheet({restoreFocus: false});
    categorySheet.hidden = false; categoryTrigger.setAttribute('aria-expanded', 'true'); categorySheet.querySelector('button')?.focus();
  });
  detailsSummary.addEventListener('click', () => {
    if (details.open) {
      const categoryHadFocus = categorySheet.contains(document.activeElement);
      closeCategorySheet({restoreFocus: false});
      if (categoryHadFocus) detailsSummary.focus();
    }
  });
  details.addEventListener('toggle', () => {
    if (!details.open) {
      const categoryHadFocus = categorySheet.contains(document.activeElement);
      closeCategorySheet({restoreFocus: false});
      if (categoryHadFocus) detailsSummary.focus();
    }
  });
  categoryLabel.append(categoryTrigger, categorySheet);
  refreshCategoryLabel();

  const memoLabel = document.createElement('label'); memoLabel.className = 'calendar-editor-wide'; memoLabel.textContent = '메모';
  const memoInput = document.createElement('textarea'); memoInput.className = 'calendar-editor-memo'; memoInput.maxLength = 2000; memoInput.rows = 3; memoInput.value = entry.memo || ''; memoLabel.appendChild(memoInput);

  const placeLabel = document.createElement('label'); placeLabel.className = 'calendar-editor-wide'; placeLabel.textContent = '장소';
  const placeInput = document.createElement('input'); placeInput.className = 'calendar-editor-place'; placeInput.maxLength = 240; placeInput.value = entry.place || ''; placeLabel.appendChild(placeInput);

  const merchantLabel = document.createElement('label'); merchantLabel.className = 'calendar-editor-wide'; merchantLabel.textContent = '상점 · 예약처';
  const merchantInput = document.createElement('input'); merchantInput.className = 'calendar-editor-merchant'; merchantInput.maxLength = 240; merchantInput.value = entry.merchant || ''; merchantLabel.appendChild(merchantInput);

  const error = document.createElement('p'); error.className = 'calendar-editor-error'; error.setAttribute('role', 'alert');
  const actions = document.createElement('div'); actions.className = 'calendar-editor-actions';
  const cancel = button('취소', 'calendar-editor-cancel');
  const save = button('저장', 'calendar-editor-save'); save.type = 'submit';
  actions.append(cancel);
  if (!item || itemPolicy.canUpdate) actions.prepend(save);

  let cleanupDeleteConfirmation = () => {};
  let deleteRequestInFlight = false;

  if (item && itemPolicy.canRemove) {
    const remove = button('삭제', 'calendar-editor-delete');
    actions.prepend(remove);
    remove.addEventListener('click', () => {
      const existing = root.querySelector('.calendar-delete-confirm-backdrop');
      if (existing) {
        existing.querySelector('.calendar-delete-confirm-cancel')?.focus();
        return;
      }

      const confirmationBackdrop = document.createElement('div');
      confirmationBackdrop.className = 'calendar-delete-confirm-backdrop';
      const confirmationDialog = document.createElement('section');
      confirmationDialog.className = 'calendar-delete-confirm-dialog';
      confirmationDialog.setAttribute('role', 'dialog');
      confirmationDialog.setAttribute('aria-modal', 'true');
      confirmationDialog.setAttribute('aria-labelledby', 'calendar-delete-confirm-title');
      confirmationDialog.setAttribute('aria-describedby', 'calendar-delete-confirm-description');

      const confirmationTitle = document.createElement('h4');
      confirmationTitle.id = 'calendar-delete-confirm-title';
      confirmationTitle.textContent = '이 일정을 삭제하시겠습니까?';
      const confirmationDescription = document.createElement('p');
      confirmationDescription.id = 'calendar-delete-confirm-description';
      confirmationDescription.textContent = '삭제한 일정은 복구할 수 없습니다.';
      const confirmationError = document.createElement('p');
      confirmationError.className = 'calendar-delete-confirm-error';
      confirmationError.setAttribute('role', 'alert');

      const confirmationActions = document.createElement('div');
      confirmationActions.className = 'calendar-delete-confirm-actions';
      const cancelDelete = button('취소', 'calendar-delete-confirm-cancel');
      const confirmDelete = button('삭제', 'calendar-delete-confirm-submit');
      confirmationActions.append(cancelDelete, confirmDelete);
      confirmationDialog.append(confirmationTitle, confirmationDescription, confirmationError, confirmationActions);
      confirmationBackdrop.appendChild(confirmationDialog);

      dialog.inert = true;
      dialog.setAttribute('aria-hidden', 'true');

      cleanupDeleteConfirmation = ({restoreFocus = true} = {}) => {
        confirmationBackdrop.remove();
        dialog.inert = false;
        dialog.removeAttribute('aria-hidden');
        deleteRequestInFlight = false;
        cleanupDeleteConfirmation = () => {};
        if (restoreFocus && remove.isConnected) remove.focus();
      };

      const cancelConfirmation = () => {
        if (deleteRequestInFlight) return;
        cleanupDeleteConfirmation();
      };

      cancelDelete.addEventListener('click', cancelConfirmation);
      confirmationBackdrop.addEventListener('click', event => {
        if (event.target === confirmationBackdrop) cancelConfirmation();
      });
      confirmationDialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancelConfirmation();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [cancelDelete, confirmDelete].filter(control => !control.disabled);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      confirmDelete.addEventListener('click', async () => {
        if (deleteRequestInFlight) return;
        deleteRequestInFlight = true;
        confirmationError.textContent = '';
        remove.disabled = true;
        cancelDelete.disabled = true;
        confirmDelete.disabled = true;
        try {
          await controller.remove(item);
          cleanupDeleteConfirmation({restoreFocus: false});
          releaseEditorEnvironment();
          backdrop.remove();
          await onSaved();
        } catch (caught) {
          deleteRequestInFlight = false;
          remove.disabled = false;
          cancelDelete.disabled = false;
          confirmDelete.disabled = false;
          confirmationError.textContent = caught?.code === 'STALE_REVISION'
            ? '일정이 변경되었습니다. 저장 상태를 확인한 뒤 다시 시도해주세요.'
            : '일정을 삭제하지 못했습니다. 다시 시도해주세요.';
          confirmDelete.focus();
        }
      });

      root.appendChild(confirmationBackdrop);
      queueMicrotask(() => cancelDelete.focus());
    });
  }

  primary.append(titleLabel, titleNote, dateLabel, allDayLabel, timeControl);
  details.append(placeLabel, merchantLabel, memoLabel, amountLabel, categoryLabel);
  if (hasMultiDayEnd) detailsSummary.after(endDateLabel);
  editorBody.append(primary, details, error);
  form.append(editorBody, actions);
  dialog.append(editorHeader, form); backdrop.appendChild(dialog); root.appendChild(backdrop);

  const close = () => {
    cleanupDeleteConfirmation({restoreFocus: false});
    releaseEditorEnvironment();
    backdrop.remove();
    onClose();
  };
  closeButton.addEventListener('click', close);
  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  dialog.addEventListener('keydown', event => {
    if (!details.open && !categorySheet.hidden) closeCategorySheet({restoreFocus: false});
    const activeSheet = !timeSheet.hidden && !timeControl.hidden ? timeSheet
      : !categorySheet.hidden && details.open ? categorySheet : dialog;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (activeSheet === timeSheet) {closeTimeSheet(); return;}
      if (activeSheet === categorySheet) {closeCategorySheet(); return;}
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...activeSheet.querySelectorAll('button, input, select, textarea, summary')]
      .filter(control => !control.disabled && !control.hidden && control.getClientRects().length && control.tabIndex !== -1);
    if (!focusable.length) {event.preventDefault(); return;}
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    else if (!activeSheet.contains(document.activeElement)) {event.preventDefault(); first.focus();}
  });
  form.addEventListener('focusin', event => {
    if (!usesFlowingDayDetail()) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== 'function') return;
    const reveal = () => target.scrollIntoView({block: 'nearest', inline: 'nearest'});
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(reveal);
    else setTimeout(reveal, 0);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = '';
    if (item && !itemPolicy.canUpdate) {
      error.textContent = '읽기 전용 일정은 수정할 수 없습니다.';
      return;
    }
    const startClock = normalizeCalendarClockInput(timeInput.value);
    const endClock = normalizeCalendarClockInput(endTimeInput.value);
    if (!allDayInput.checked && (startClock === null || endClock === null)) {
      error.textContent = '시간을 HH:mm 형식으로 입력해 주세요.';
      openTimeSheet(startClock === null ? timeInput : endTimeInput,
        startClock === null ? timeTrigger : endTimeTrigger);
      return;
    }
    if (!allDayInput.checked) { timeInput.value = startClock; endTimeInput.value = endClock; refreshTimeLabels(); }
    const value = {
      title: titleInput.value,
      localDate: dateInput.value,
      time: timeInput.value,
      endTime: endTimeInput.value,
      endDate: endDateInput.value,
      allDay: allDayInput.checked,
      amountMinor: amountInput.value,
      expenseCategory: categoryInput.value || null,
      memo: memoInput.value,
      place: placeInput.value,
      merchant: merchantInput.value,
    };
    save.disabled = true;
    try {
      if (item) await controller.update(item, value); else await controller.create(value);
      cleanupDeleteConfirmation({restoreFocus: false});
      releaseEditorEnvironment();
      backdrop.remove(); await onSaved();
    } catch (caught) {
      if (caught?.code === 'STALE_REVISION') { error.textContent = '다른 변경이 반영되어 일정을 새로 불러왔어요.'; await onStale(); }
      else error.textContent = caught instanceof Error ? caught.message : '일정을 저장하지 못했습니다.';
      save.disabled = false;
    }
  });
  queueMicrotask(() => titleInput.focus());
}

export async function mountLifeCalendarManager({
  sessionToken,
  root,
  initialView = 'month',
  timezone = resolvedTimezone(),
  now,
  fetchImpl = globalThis.fetch,
  guestRepository,
  deepOpen,
  initialDraft = null,
  weatherLocation = null,
  locationProvider = globalThis.navigator?.geolocation,
  locationPermissions = globalThis.navigator?.permissions,
  locationNow = Date.now,
  settingsStorage = globalThis.localStorage,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  const clock = typeof now === 'function'
    ? now
    : now instanceof Date
      ? () => now
      : () => new Date();
  const currentNow = () => {
    const value = clock();
    return value instanceof Date ? value : new Date(value);
  };
  const todayDate = dateInTimezone(currentNow(), timezone);
  const deepOpenTarget = normalizedDeepOpen(deepOpen);
  const initialDate = deepOpenTarget?.dateHint || initialDraft?.localDate || todayDate;
  const initialParts = civilDateParts(initialDate);
  const repository = authenticated ? null : (guestRepository || createGuestCalendarRepository(globalThis.localStorage));
  const mutationController = createCalendarMutationController({sessionToken, timezone, guestRepository: repository, fetchImpl});
  const storedManualWeatherRegion = readCalendarManualWeatherRegion(settingsStorage);
  const storedWeatherRegionOrigin = storedManualWeatherRegion
    ? (readWeatherRegionOrigin(settingsStorage) || WEATHER_REGION_ORIGIN.MANUAL)
    : null;
  // 저장된 지역은 사용자가 직접 고른 것일 수도, 현재 위치에서 옮겨 적은 것일 수도
  // 있다. 날씨를 부르는 방식은 둘이 같으므로 source 는 하나로 두고(MANUAL_REGION =
  // 이 브라우저에 저장된 지역), 어느 쪽인지는 weatherRegionOrigin 이 들고 있다.
  // 화면 문구가 갈리는 곳이 그 하나다.
  let currentWeatherLocation = weatherLocation || (storedManualWeatherRegion
    ? {
        ...storedManualWeatherRegion,
        source: 'MANUAL_REGION',
      }
    : null);
  const displaySettings = readCalendarDisplaySettings(settingsStorage);
  const state = {
    mode: normalizeMode(initialView), selectedDate: initialDate, todayDate,
    year: initialParts.year, month: initialParts.month, items: [], attention: [], unscheduled: [], weather: [], holidays: [], loading: false,
    showKoreaHolidays: displaySettings.showKoreaHolidays,
    showGridLines: displaySettings.showGridLines,
    showLunarDates: displaySettings.showLunarDates,
    weekStart: displaySettings.weekStart,
    manualWeatherRegion: storedManualWeatherRegion,
    weatherRegionOrigin: storedWeatherRegionOrigin,
    // 날씨 읽기가 실패했을 때 날씨 자리에 남기는 한 줄. 빈 문자열이면 아무 말도 없다.
    weatherMessage: '',
    // Closed on mount, on every width. A phone used to open the Calendar with
    // the day panel already up for whatever date happened to be selected --
    // a window for a date nobody had pressed. Opening the Calendar shows the
    // Calendar; only selectDate({openDetail: true}) raises this panel.
    detailOpen: false, dayCollapsed: false, agendaScope: 'month',
    locationInFlight: false,
    locationPermission: LOCATION_PERMISSION.UNKNOWN,
    locationResolution: currentWeatherLocation?.source === 'BROWSER_CURRENT' ? LOCATION_RESOLUTION.RESOLVED : LOCATION_RESOLUTION.IDLE,
    locationMessage: '',
    // Owned by the 이미지로 등록 flow. It renders in the day panel rather than the
    // status strip because the location flow rewrites that strip on its own
    // schedule and swallowed this message a moment after it appeared.
    imageMessage: '',
    expense: {
      // Signed out there is nothing to wait for: the entries are already here,
      // so the first paint computes rather than showing a loader.
      status: 'loading',
      summary: null,
      message: '',
      monthKey: '',
      local: !authenticated,
    },
  };

  const shell = document.createElement('div'); shell.className = 'calendar-product-shell';
  const toolbar = document.createElement('header'); toolbar.className = 'calendar-toolbar';
  const previous = button('이전', 'calendar-nav-button'); previous.setAttribute('aria-label', '이전 달');
  previous.dataset.calendarNavigation = 'previous';
  const title = button('', 'calendar-title-button');
  const next = button('다음', 'calendar-nav-button'); next.setAttribute('aria-label', '다음 달');
  next.dataset.calendarNavigation = 'next';
  const today = button('오늘', 'calendar-today-button');
  const settingsButton = button('', 'calendar-settings-button');
  settingsButton.appendChild(toolbarIcon(SETTINGS_ICON_SHAPES));
  const settingsLabel = document.createElement('span');
  settingsLabel.className = 'calendar-settings-label';
  settingsLabel.textContent = '설정';
  settingsButton.appendChild(settingsLabel);
  settingsButton.setAttribute('aria-label', '캘린더 설정');
  settingsButton.title = '캘린더 설정';
  const modes = document.createElement('div'); modes.className = 'calendar-mode-tabs'; modes.setAttribute('role', 'tablist'); modes.setAttribute('aria-label', '캘린더 보기');
  const modeButtons = new Map();
  for (const [mode, label] of MODES) {
    const control = button(label, 'calendar-mode-tab'); control.dataset.calendarMode = mode; control.setAttribute('role', 'tab'); modeButtons.set(mode, control); modes.appendChild(control);
  }
  bindRovingTablist(modes, modeButtons.values());
  toolbar.append(previous, title, next, today, settingsButton, modes);
  const status = document.createElement('div'); status.className = 'calendar-status'; status.setAttribute('aria-live', 'polite');
  const locationButton = button('현재 위치 사용', 'calendar-today-button');
  locationButton.dataset.calendarCurrentLocation = 'true';
  locationButton.setAttribute('aria-label', '현재 위치를 캘린더 날씨에 사용');
  const viewport = document.createElement('div'); viewport.className = 'calendar-viewport';
  // The expense bar is a shell row, not a viewport child: the month view clips
  // its content box, so anything trailing the month grid inside the viewport is
  // invisible on desktop.
  const expenseSlot = document.createElement('div'); expenseSlot.className = 'calendar-expense-slot';
  shell.append(toolbar, status, viewport, expenseSlot); root.replaceChildren(shell);

  const updateChrome = () => {
    if (state.mode === 'year') {
      title.textContent = `${state.year}년`;
      title.setAttribute('aria-label', `${state.year}년 연간 보기`);
    } else if (state.mode === 'week') {
      const days = calendarWeekDays(state.selectedDate, state.weekStart);
      const first = days[0];
      const last = days.at(-1);
      title.textContent = `${first.month}월 ${first.day}일–${last.month}월 ${last.day}일`;
      title.setAttribute('aria-label', `${first.year}년 ${first.month}월 ${first.day}일부터 ${last.month}월 ${last.day}일까지 주간 보기`);
    } else {
      title.textContent = `${state.year}년 ${state.month}월`;
      title.setAttribute('aria-label', `${state.year}년 ${state.month}월 월간 보기`);
    }
    const navigationUnit = state.mode === 'year' ? '해' : state.mode === 'week' ? '주' : '달';
    previous.setAttribute('aria-label', `이전 ${navigationUnit}`);
    next.setAttribute('aria-label', `다음 ${navigationUnit}`);
    for (const [mode, control] of modeButtons) {
      const selected = state.mode === mode; control.setAttribute('aria-selected', String(selected)); control.tabIndex = selected ? 0 : -1;
    }
    root.dataset.calendarManagerView = state.mode;
    root.dataset.calendarAccess = authenticated ? 'authenticated' : 'guest';
  };

  function focusSelectedCalendarTarget({detail = false, date = state.selectedDate} = {}) {
    queueMicrotask(() => {
      let selector = '';
      let preventFocusScroll = false;
      if (detail && state.mode === 'month') {
        const panel = root.querySelector('.calendar-day-panel');
        if (panel instanceof HTMLElement && panel.dataset.presentation === DAY_DETAIL_PRESENTATION.FLOW) {
          panel.scrollIntoView({block: 'nearest', inline: 'nearest'});
          preventFocusScroll = true;
        }
        selector = '.calendar-day-close';
      } else if (state.mode === 'week') {
        selector = `[data-calendar-week-date="${date}"]`;
      } else if (state.mode === 'month') {
        selector = `[data-calendar-date-trigger="${date}"]`;
      }
      if (!selector) return;
      const target = root.querySelector(selector);
      if (target instanceof HTMLElement) target.focus(preventFocusScroll ? {preventScroll: true} : undefined);
    });
  }

  let openEditor = () => {};
  // Guards month navigation so a burst of fast swipes cannot skip months.
  let monthShiftInFlight = false;
  // State equality cannot distinguish "never moved" from "moved away and
  // returned" while an editor save waits for an accessory request. User-owned
  // Calendar navigation advances this token; renders and data refreshes do not.
  let calendarContextGeneration = 0;
  const markCalendarContextNavigation = () => { calendarContextGeneration += 1; };
  const actions = {
    selectDate: async (date, {openDetail = false} = {}) => {
      markCalendarContextNavigation();
      const parts = civilDateParts(date);
      const monthChanged = parts.year !== state.year || parts.month !== state.month;
      state.selectedDate = date;
      state.year = parts.year;
      state.month = parts.month;
      state.detailOpen = openDetail;
      state.dayCollapsed = false;
      if (monthChanged) await afterMonthChange(); else render();
      focusSelectedCalendarTarget({detail: openDetail, date});
    },
    selectMonth: async month => {
      markCalendarContextNavigation();
      state.month = month;
      state.selectedDate = `${state.year}-${String(month).padStart(2, "0")}-01`;
      state.mode = 'month';
      state.detailOpen = false;
      await refresh();
    },
    onDateKey: (event, date) => {
      const offsets = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};
      switch (event.key) {
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
          event.preventDefault(); void actions.selectDate(addCivilDays(date, offsets[event.key])); break;
        case 'Home': case 'End': {
          const targetDate = monthGridKeyboardTargetDate(date, event.key, state.weekStart);
          if (!targetDate) break;
          event.preventDefault();
          void actions.selectDate(targetDate);
          break;
        }
        case 'PageUp':
          event.preventDefault(); void actions.selectDate(shiftCivilMonth(date, -1)); break;
        case 'PageDown':
          event.preventDefault(); void actions.selectDate(shiftCivilMonth(date, 1)); break;
        case 'Enter': case ' ':
          event.preventDefault(); void actions.selectDate(date, {openDetail: true}); break;
        case 'Escape':
          if (state.detailOpen) { event.preventDefault(); actions.closeDay(); }
          break;
        default: break;
      }
    },
    closeDay: () => {
      markCalendarContextNavigation();
      const date = state.selectedDate;
      state.detailOpen = false;
      state.dayCollapsed = false;
      render();
      focusSelectedCalendarTarget({date});
    },
    toggleDay: () => {
      markCalendarContextNavigation();
      state.dayCollapsed = !state.dayCollapsed;
      render();
      queueMicrotask(() => root.querySelector('.calendar-day-toggle')?.focus());
    },
    setAgendaScope: async scope => {
      markCalendarContextNavigation();
      state.agendaScope = ['all', 'month', 'today', 'week', 'reservation', 'payment', 'schedule'].includes(scope) ? scope : 'month';
      if (state.agendaScope === 'today' || state.agendaScope === 'week') {
        const parts = civilDateParts(state.todayDate);
        const monthChanged = parts.year !== state.year || parts.month !== state.month;
        state.selectedDate = state.todayDate;
        state.year = parts.year;
        state.month = parts.month;
        if (monthChanged) await afterMonthChange();
        else render();
      } else {
        render();
      }
      queueMicrotask(() => root.querySelector(`[data-agenda-scope="${state.agendaScope}"]`)?.focus());
    },
    // 직접 등록 opens the full form on the day the panel is showing; the picture
    // route and an existing entry go to the same dialog.
    onAdd: date => openEditor(null, date),
    onAddFromImage: date => { void addFromImage(date); },
    onEvent: (item, opener) => openEditor(item, item.local_date || item.due_date || '', null, opener),
    openSettings: () => calendarSettingsDialog({
      root,
      state,
      storage: settingsStorage,
      authenticated,
      sessionToken,
      fetchImpl,
      buildLocationRow: buildLocationSettingsRow,
      getWeatherLocationPresentation: weatherLocationPresentation,
      onWeatherRegionChange: async region => {
        // 지역을 직접 고르면 그것이 화면의 권위다: 방금 잡아 둔 현재 위치 좌표보다
        // 사용자가 고른 지역이 앞선다. 해제하면 좌표가 없는 상태로 돌아간다.
        currentWeatherLocation = region
          ? {...region, source: 'MANUAL_REGION'}
          : null;
        clearBrowserLocationProvenance();
        if (state.locationResolution === LOCATION_RESOLUTION.RESOLVED) {
          state.locationResolution = LOCATION_RESOLUTION.IDLE;
        }
        if (region) {
          state.locationMessage = '';
        }
        await refresh();
      },
      onChange: async enabled => {
        if (enabled) await refresh();
        else render();
      },
      onRedraw: () => { render(); },
    }),
  };

  root.addEventListener('keydown', event => {
    // Settings is the top layer. This listener runs in capture phase, before
    // the Settings dialog can consume Escape itself, so explicitly defer to it
    // instead of closing the selected-day detail underneath.
    if (event.key === 'Escape' && root.querySelector('.calendar-settings-dialog')) return;
    if (
      event.key === 'Escape'
      && state.mode === 'month'
      && state.detailOpen
      && !root.querySelector('.calendar-editor-dialog')
    ) {
      event.preventDefault();
      event.stopPropagation();
      actions.closeDay();
    }
  }, true);

  let refreshGeneration = 0;
  let locationRequestGeneration = 0;
  // 위치 요청이 하나라도 돌고 있는지. state.locationInFlight 은 "사용자가 누른 것이
  // 진행 중" 이라는 화면용 상태이고, 이쪽은 자동 호출까지 포함한다. 두 개가 필요한
  // 이유는 하나다: 화면이 스스로 부른 요청이 사용자가 누른 요청을 밀어내서는 안 된다.
  // 자동은 진행 중인 요청을 보면 물러나고, 사용자의 요청은 자동을 밀어낸다.
  let locationRequestActive = false;

  // 저장된 지역으로 돌아갈 자리. 현재 위치가 만료되거나 권한이 꺼져도 날씨가
  // 통째로 사라지지 않게 하는 것이 이 함수의 전부다.
  function storedRegionWeatherLocation() {
    return state.manualWeatherRegion
      ? {...state.manualWeatherRegion, source: 'MANUAL_REGION'}
      : null;
  }

  async function syncLocationPermission() {
    const permission = await getBrowserLocationPermissionState({
      permissions: locationPermissions,
      geolocation: locationProvider,
    });
    if (!root.isConnected) return;
    state.locationPermission = permission;
    if (permission === LOCATION_PERMISSION.DENIED) {
      if (currentWeatherLocation?.source === 'BROWSER_CURRENT') {
        currentWeatherLocation = storedRegionWeatherLocation();
        clearBrowserLocationProvenance();
      }
      state.locationResolution = LOCATION_RESOLUTION.IDLE;
      state.locationMessage = state.manualWeatherRegion ? '' : '위치 권한이 꺼져 있어요.';
    } else if (permission === LOCATION_PERMISSION.UNAVAILABLE) {
      if (currentWeatherLocation?.source === 'BROWSER_CURRENT') {
        currentWeatherLocation = storedRegionWeatherLocation();
        clearBrowserLocationProvenance();
      }
      state.locationResolution = state.manualWeatherRegion ? LOCATION_RESOLUTION.IDLE : LOCATION_RESOLUTION.ERROR;
      state.locationMessage = state.manualWeatherRegion ? '' : '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    } else if (
      state.locationMessage === '위치 권한이 꺼져 있어요.'
      || state.locationMessage === '이 브라우저에서는 현재 위치를 사용할 수 없어요.'
    ) {
      state.locationMessage = '';
      if (state.locationResolution === LOCATION_RESOLUTION.ERROR) {
        state.locationResolution = LOCATION_RESOLUTION.IDLE;
      }
    }
    await maybeUseGrantedCurrentLocation();
  }

  // 권한이 이미 허용돼 있으면 버튼을 누르게 하지 않는다. 다만 허용일 때만이다.
  //
  // PROMPT_REQUIRED(미결정)·UNKNOWN(Safari 처럼 권한 상태를 알려주지 않는 브라우저)
  // 에서는 절대 호출하지 않는다: getCurrentPosition 을 부르는 순간 권한 팝업이 뜨고,
  // 화면에 적어 둔 "버튼을 누를 때만 브라우저가 위치 권한을 요청합니다" 가 거짓이 된다.
  async function maybeUseGrantedCurrentLocation() {
    if (state.locationPermission !== LOCATION_PERMISSION.GRANTED) return;
    if (state.locationInFlight) return;
    // 사용자가 설정에서 직접 고른 지역은 자동으로 덮어쓰지 않는다.
    if (state.weatherRegionOrigin === WEATHER_REGION_ORIGIN.MANUAL) return;
    if (
      currentWeatherLocation?.source === 'BROWSER_CURRENT'
      && isFreshBrowserCurrentLocation(currentWeatherLocation, {now: locationNow})
    ) return;
    await useCurrentLocation({auto: true});
  }

  function clearBrowserLocationProvenance() {
    delete root.dataset.locationSource;
    delete root.dataset.locationAccuracyMeters;
    delete root.dataset.locationApproximation;
    delete root.dataset.locationTimestamp;
  }

  function locationErrorCopy(error) {
    if (!(error instanceof BrowserLocationError)) return '현재 위치를 확인하지 못했어요.';
    if (error.code === 'BROWSER_LOCATION_DENIED') return '위치 권한이 꺼져 있어요.';
    if (error.code === 'BROWSER_LOCATION_TIMEOUT') return '현재 위치를 확인하지 못했어요.';
    if (error.code === 'BROWSER_LOCATION_UNSUPPORTED') return '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    if (error.code === 'BROWSER_LOCATION_STALE') return '현재 위치가 오래되어 다시 확인이 필요해요.';
    return '현재 위치를 확인할 수 없어요.';
  }

  // A transient, non-blocking notice. Deliberately not the bottom-sheet
  // primitive: a one-line confirmation must not take focus, trap it, or dim the
  // Calendar behind a backdrop.
  const toastHost = document.createElement('div');
  toastHost.className = 'calendar-toast-host';
  toastHost.setAttribute('role', 'status');
  toastHost.setAttribute('aria-live', 'polite');
  shell.appendChild(toastHost);
  let toastTimer = null;

  function announceLocation(message) {
    if (!message) return;
    try {
      const node = document.createElement('p');
      node.className = 'calendar-toast';
      node.dataset.reducedMotion = String(prefersReducedMotion());
      node.textContent = message;
      toastHost.replaceChildren(node);
      if (toastTimer) globalThis.clearTimeout(toastTimer);
      toastTimer = globalThis.setTimeout(() => {
        toastTimer = null;
        if (toastHost.isConnected) toastHost.replaceChildren();
      }, 3600);
    } catch {
      // A missing toast must never cost the Calendar anything.
    }
  }

  // The Settings dialog is rebuilt on every open, so this holds only the live
  // status node; a detached one is simply written to and dropped.
  let locationStatusNode = null;
  let locationHelpNode = null;

  function weatherLocationPresentation() {
    return calendarWeatherLocationPresentation({
      manualWeatherRegion: state.manualWeatherRegion,
      weatherRegionOrigin: state.weatherRegionOrigin,
      usingBrowserLocation: currentWeatherLocation?.source === 'BROWSER_CURRENT'
        && state.locationResolution === LOCATION_RESOLUTION.RESOLVED,
      locationPermission: state.locationPermission,
      locationResolution: state.locationResolution,
      locationInFlight: state.locationInFlight,
      locationMessage: state.locationMessage,
    });
  }

  function syncOpenWeatherLocationSettings() {
    const presentation = weatherLocationPresentation();
    const overview = root.querySelector('.calendar-settings-weather-overview');
    if (overview) {
      const summary = overview.querySelector('strong');
      const relationship = overview.querySelector('small');
      if (summary) summary.textContent = presentation.manualSummary;
      if (relationship) relationship.textContent = presentation.relationship;
    }
    const manualClear = root.querySelector('[data-calendar-weather-manual-clear]');
    if (manualClear) manualClear.hidden = !state.manualWeatherRegion;
  }

  function locationSettingsStatusText() {
    const presentation = weatherLocationPresentation();
    if (state.manualWeatherRegion && !presentation.currentStatus.includes('현재 위치로 날씨')) {
      return `${presentation.currentStatus} ${presentation.manualSummary}`;
    }
    return presentation.currentStatus;
  }

  function syncLocationSettingsControl() {
    const usingBrowserLocation = currentWeatherLocation?.source === 'BROWSER_CURRENT'
      && state.locationResolution === LOCATION_RESOLUTION.RESOLVED;
    const blocked = state.locationPermission === LOCATION_PERMISSION.DENIED
      || state.locationPermission === LOCATION_PERMISSION.UNAVAILABLE;
    locationButton.disabled = state.locationInFlight || blocked;
    locationButton.textContent = weatherLocationPresentation().currentAction;
    syncOpenWeatherLocationSettings();
    locationButton.setAttribute('aria-pressed', String(usingBrowserLocation));
    if (locationStatusNode) locationStatusNode.textContent = locationSettingsStatusText();
    // 브라우저가 아예 위치를 제공하지 않는 경우(UNAVAILABLE)에는 사이트 권한을
    // 바꿔도 달라지는 것이 없다. 안내는 거부된 상태에서만 내민다.
    if (locationHelpNode) locationHelpNode.hidden = state.locationPermission !== LOCATION_PERMISSION.DENIED;
  }

  // The Calendar owns this control; Settings only hosts it. Building it here
  // keeps every location transition in one scope.
  function buildLocationSettingsRow() {
    const row = document.createElement('div');
    row.className = 'calendar-settings-action-row';
    row.dataset.calendarLocationRow = 'true';
    const copy = document.createElement('span');
    const label = document.createElement('strong');
    label.textContent = '현재 위치';
    const status = document.createElement('small');
    status.className = 'calendar-settings-status';
    // "브라우저 사이트 설정에서 허용해 주세요" 만으로는 어디를 눌러야 하는지 아무도
    // 모른다. 권한이 막혀 있을 때만, 실제로 누를 것의 이름으로 적어 둔다.
    const help = document.createElement('details');
    help.className = 'calendar-settings-location-help';
    help.hidden = true;
    const helpSummary = document.createElement('summary');
    helpSummary.textContent = '위치 권한, 어디서 허용하나요?';
    const helpList = document.createElement('ul');
    for (const line of LOCATION_PERMISSION_STEPS) {
      const item = document.createElement('li');
      item.textContent = line;
      helpList.appendChild(item);
    }
    help.append(helpSummary, helpList);
    copy.append(label, status, help);
    row.append(copy, locationButton);
    locationStatusNode = status;
    locationHelpNode = help;
    syncLocationSettingsControl();
    return row;
  }


  function render() {
    updateChrome();
    // Release the previous day-sheet visualViewport listeners before the node is
    // replaced, so repeated renders cannot accumulate them.
    const staleSheet = viewport.querySelector('.calendar-day-panel[data-visual-viewport-bound="true"], .calendar-day-panel[data-day-panel-bound="true"]');
    if (staleSheet) staleSheet.dispatchEvent(new CustomEvent('lotbi:day-sheet-release'));
    status.replaceChildren();
    if (state.loading) {
      const loading = document.createElement('div'); loading.className = 'calendar-skeleton'; loading.textContent = '일정을 불러오는 중'; status.appendChild(loading);
    } else {
      // Weather location is an accessory of an accessory. Once the browser has
      // granted it, repeating that on every open is noise that sits above the
      // user's own schedule, so nothing about location is drawn in this row any
      // more: the durable state and both controls live in Settings, and a change
      // is announced once as a toast. The dataset attributes stay -- they are the
      // location contract other surfaces read.
      root.dataset.locationPermission = state.locationPermission;
      root.dataset.locationResolution = state.locationResolution;
      syncLocationSettingsControl();
    }
    if (state.mode === 'year') viewport.replaceChildren(renderYear(state, actions));
    else if (state.mode === 'week') viewport.replaceChildren(renderWeek(state, actions, calendarWeatherAttribution(state.weather, {timezone})));
    else if (state.mode === 'agenda') viewport.replaceChildren(renderAgenda(state, actions));
    else {
      const layout = renderMonth(state, actions, calendarWeatherAttribution(state.weather, {timezone}));
      viewport.replaceChildren(layout);
      // Synchronously, before this frame is painted. renderMonth also schedules
      // the same sync on an animation frame -- that one is for metrics that
      // settle later, such as a webfont swapping in -- but waiting for it here
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

        // Which dates the guest month/week grid can show weather for is a
        // property of the visible date range intersected with the forecast
        // horizon (see forecastWindow above), never of whether that range
        // happens to fall in "the current month" -- a month grid's spillover
        // days, or an entirely future month within the horizon, are just as
        // visible and just as forecastable.
        const rawWeatherRange = state.mode === 'month'
          ? monthBounds(state.selectedDate)
          : state.mode === 'week'
            ? weekBounds(state.selectedDate, state.weekStart)
            : null;
        const visibleWeatherRange = forecastWindow(rawWeatherRange, state.todayDate);
        const weatherRequest = visibleWeatherRange && currentWeatherLocation?.latitude != null && currentWeatherLocation?.longitude != null
          ? getPublicCalendarWeather({
              start: visibleWeatherRange.start,
              end: visibleWeatherRange.end,
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
