// CALENDAR-SPEED-02: lets a Calendar re-entry show weather immediately, before
// the network responds, by keeping the last successful forecast per coarse
// region. What is stored is deliberately thin -- provider result, date, and
// when it was issued -- never precise GPS, never anything about the user's
// schedule. site-calendar-weather-region.js already owns the manual region
// itself; this is only the forecast that region produced.
const STORAGE_KEY = 'lotbi.calendar.weather-cache.v1';

// KMA 단기예보는 하루에도 여러 차례 갱신된다. 이 값보다 오래된 항목은 "최신"인
// 것처럼 보여주지 않는다 -- readCalendarWeatherCache가 걸러내므로, 여기를 지나
// 화면에 닿는 캐시는 전부 이 시간 이내에 실제로 받아 온 것이다.
export const CALENDAR_WEATHER_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_CACHED_DATES = 40;

function safeParseObject(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// 지역 신원 정도로만 쓰는 키다. label(예: "전주시 만성동")이 있으면 그것으로
// 충분하고, 좌표만 있는 경우에도 소수점 첫 자리(약 11km)까지만 남겨 정밀 위치가
// 캐시 키에 실리지 않게 한다.
export function calendarWeatherRegionCacheKey(location) {
  if (!location || typeof location !== 'object') return '';
  const label = typeof location.label === 'string' ? location.label.trim() : '';
  if (label) return `L:${label}`;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `C:${latitude.toFixed(1)},${longitude.toFixed(1)}`;
}

export function readCalendarWeatherCache(regionKey, {storage = globalThis.localStorage, now = Date.now()} = {}) {
  if (!regionKey || !storage || typeof storage.getItem !== 'function') return null;
  let payload;
  try {
    payload = safeParseObject(storage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
  if (!payload || payload.version !== 1 || payload.regionKey !== regionKey || !payload.items || typeof payload.items !== 'object') {
    return null;
  }
  const items = [];
  for (const [date, entry] of Object.entries(payload.items)) {
    if (!entry || typeof entry !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const issuedAt = Date.parse(String(entry.issuedAt || ''));
    if (!Number.isFinite(issuedAt) || now - issuedAt > CALENDAR_WEATHER_CACHE_MAX_AGE_MS) continue;
    items.push(Object.freeze({...entry, date}));
  }
  if (!items.length) return null;
  return Object.freeze({items: Object.freeze(items)});
}

// 전체 응답을 통째로 저장하지 않는다: 날짜별로 저장해 두어야, 일부만 겹치는 새
// 화면(예: 9/26~10/4 캐시 위에 9/27~10/10을 열었을 때)도 겹치는 날짜만큼은
// 즉시 쓸 수 있다. 같은 지역의 기존 항목과 합치고, 개수가 넘치면 오래된 날짜부터
// 버린다.
export function writeCalendarWeatherCache(regionKey, items, {storage = globalThis.localStorage} = {}) {
  if (!regionKey || !storage || typeof storage.setItem !== 'function' || typeof storage.getItem !== 'function') return;
  if (!Array.isArray(items) || !items.length) return;
  try {
    const existing = safeParseObject(storage.getItem(STORAGE_KEY));
    const sameRegion = existing?.version === 1 && existing.regionKey === regionKey && existing.items && typeof existing.items === 'object';
    const merged = sameRegion ? {...existing.items} : {};
    for (const item of items) {
      const date = typeof item?.date === 'string' ? item.date : '';
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      // 이 자리에 실리는 필드는 provider 결과와 날짜뿐이다 -- 사용자 일정 제목·
      // 메모·비용은 여기 온 적이 없다.
      merged[date] = {
        weatherKind: item.weatherKind,
        weatherIcon: item.weatherIcon,
        source: item.source,
        issuedAt: item.issuedAt,
        label: item.label,
        temperature: item.temperature ?? null,
        minTemperature: item.minTemperature ?? null,
        maxTemperature: item.maxTemperature ?? null,
        precipitationProbability: item.precipitationProbability ?? null,
        freshness: item.freshness,
      };
    }
    const dates = Object.keys(merged).sort();
    while (dates.length > MAX_CACHED_DATES) delete merged[dates.shift()];
    storage.setItem(STORAGE_KEY, JSON.stringify({version: 1, regionKey, items: merged}));
  } catch {
    // 캐시 저장 실패는 화면에 아무 영향도 주지 않는다 -- 다음 번에도 네트워크로
    // 받으면 그만이다.
  }
}
