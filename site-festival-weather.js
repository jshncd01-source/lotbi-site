// FESTIVAL-EVENT-09 — festival program-date weather orchestration.
//
// This module never talks to KMA/Core directly and never normalizes a raw
// weather payload itself. It only orchestrates the already-Production
// Calendar weather surface for a festival's own venue coordinates + program
// date range:
//   - HTTP + response normalization: getPublicCalendarWeather() from
//     site-calendar-public-weather.js (same contract Calendar guest reads use)
//   - date join: calendarWeatherByDate() from site-calendar-weather.js
// Duplicating either of those here is exactly what this module exists to
// avoid.
import {getPublicCalendarWeather} from './site-calendar-public-weather.js?v=aset-bb8131a1c21b';
import {calendarWeatherByDate} from './site-calendar-weather.js?v=aset-bb8131a1c21b';

// Core's public Calendar weather read (GET /v2/life/weather/public) accepts a
// maximum 15-day inclusive window (see lotbi-core app/calendar_weather_http.py).
// A festival's own program span is normally 3-5 days and fits without
// clamping; this only protects against an unusually long listed run.
const MAX_WINDOW_DAYS = 15;

function addCivilDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function clampWindow(startDate, endDate) {
  const maxEnd = addCivilDays(startDate, MAX_WINDOW_DAYS - 1);
  return {start: startDate, end: endDate < maxEnd ? endDate : maxEnd};
}

function emptyResult() {
  return Object.freeze({ok: false, providerReady: false, byDate: new Map(), items: Object.freeze([])});
}

// Same Korea-bounds sanity check getPublicCalendarWeather() itself enforces —
// checked here too so an invalid/missing coordinate never reaches a network
// call at all (a caller can skip the request entirely rather than rely on
// catching a rejection).
export function hasUsableFestivalCoordinates(festival) {
  const lat = Number(festival?.latitude);
  const lon = Number(festival?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 31 && lat <= 44.5 && lon >= 122 && lon <= 132.5;
}

// One in-flight request per (festival id + coordinates + date range) is
// shared rather than duplicated — this only dedupes concurrent callers; it is
// not a cache, and nothing here retries on failure or on a schedule. A caller
// that wants a fresh read after a failure calls this again explicitly.
const inFlight = new Map();

function requestKey(festivalId, lat, lon, start, end) {
  return `${festivalId}|${lat}|${lon}|${start}|${end}`;
}

/**
 * @param {{festival: object, fetchImpl?: typeof fetch, timezone?: string}} options
 * @returns {Promise<{ok: boolean, providerReady: boolean, byDate: Map<string, object>, items: ReadonlyArray<object>}>}
 */
export async function getFestivalProgramWeather({festival, fetchImpl = globalThis.fetch, timezone = 'Asia/Seoul'} = {}) {
  if (!festival?.startDate || !festival?.endDate || !hasUsableFestivalCoordinates(festival)) {
    return emptyResult();
  }

  const lat = Number(festival.latitude);
  const lon = Number(festival.longitude);
  const {start, end} = clampWindow(festival.startDate, festival.endDate);
  const key = requestKey(festival.id, lat, lon, start, end);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await getPublicCalendarWeather({start, end, timezone, latitude: lat, longitude: lon}, fetchImpl);
      return Object.freeze({
        ok: true,
        providerReady: response.providerReady,
        byDate: calendarWeatherByDate(response.items),
        items: response.items,
      });
    } catch {
      // Network failure, 429, 5xx, or a malformed contract all fail soft the
      // same way: no weather, never a fabricated reading, and the caller's
      // program/date-tab UI is entirely unaffected by this rejection because
      // this function never throws.
      return emptyResult();
    }
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}
