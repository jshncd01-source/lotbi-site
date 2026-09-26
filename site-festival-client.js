// FESTIVAL-EVENT-07 — public "축제·행사" browse client.
//
// FESTIVAL-EVENT-02 (Core) ships the real consumer endpoints this module
// calls: `GET /festivals/browse` (current-location or manual 17-시도 region,
// ALL/ONGOING/THIS_WEEKEND/THIS_MONTH/DATE time filters, Haversine
// distance_km, Core-authoritative ordering, offset pagination) and
// `GET /festivals/regions` (canonical 17 광역시·도 catalog). `GET
// /festivals/{id}` (detail) already existed before FESTIVAL-EVENT-02.
//
// There is no fixture path here and none in production: every exported
// fetcher either returns real, normalized Core data or throws/returns
// null/empty so the UI can show a real loading/empty/error state. A record
// this client cannot verify as PUBLISHED-shaped (missing id/name/dates) is
// dropped, never guessed into existence.
//
// Both listing paths run every record through an allowlist normalizer —
// the public/private boundary: even if a future Core response ever carried
// a stray internal field (a workflow status, a candidate/admin id, a
// confidence score, an internal audit note), this client only ever reads
// the named public fields below and drops everything else.
import {CORE_ORIGIN} from './site-core.js?v=aset-625724e05994';

const FESTIVAL_BROWSE_PATH = '/festivals/browse';
const FESTIVAL_REGIONS_PATH = '/festivals/regions';
const festivalDetailPath = id => `/festivals/${encodeURIComponent(id)}`;

export const FESTIVAL_STATUS = Object.freeze({
  ONGOING: 'ONGOING',
  THIS_WEEKEND: 'THIS_WEEKEND',
  UPCOMING: 'UPCOMING',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
});

// Spaced Korean forms per FESTIVAL-EVENT-07 copy direction — must not
// collide with Core's own filter/status vocabulary (ALL/ONGOING/
// THIS_WEEKEND/THIS_MONTH/DATE, PUBLISHED/ENDED/CANCELLED).
export const FESTIVAL_STATUS_LABEL = Object.freeze({
  ONGOING: '진행 중',
  THIS_WEEKEND: '이번 주말',
  UPCOMING: '곧 시작',
  ENDED: '종료',
  CANCELLED: '취소',
});

export const FESTIVAL_TIME_FILTER = Object.freeze({
  ALL: 'ALL',
  ONGOING: 'ONGOING',
  THIS_WEEKEND: 'THIS_WEEKEND',
  THIS_MONTH: 'THIS_MONTH',
  DATE: 'DATE',
});

export const FESTIVAL_TIME_FILTER_LABEL = Object.freeze({
  ALL: '전체',
  ONGOING: '진행 중',
  THIS_WEEKEND: '이번 주말',
  THIS_MONTH: '이번 달',
  DATE: '날짜 선택',
});

export const FESTIVAL_PROGRAM_CATEGORIES = Object.freeze(['공연', '체험', '먹거리', '가족', '기타']);

export const FESTIVAL_RESERVATION_TYPES = Object.freeze(['ADVANCE', 'ONSITE', 'NONE', 'CHECK_REQUIRED']);

export const FESTIVAL_RESERVATION_TYPE_LABEL = Object.freeze({
  ADVANCE: '사전예약',
  ONSITE: '현장접수',
  NONE: '예약없음',
  CHECK_REQUIRED: '확인필요',
});

// Same 17 시·도 the live Core region contract returns from
// `/festivals/regions` (lotbi-core app/festival_regions.py, reusing
// app.calendar_weather_regions.list_manual_weather_provinces()) — used only
// if that live call fails, so the region picker still has something to show.
const REGION_FALLBACK_PROVINCES = Object.freeze([
  '서울특별시', '인천광역시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '대전광역시', '세종특별자치시', '전북특별자치도', '광주광역시', '전라남도',
  '대구광역시', '경상북도', '부산광역시', '울산광역시', '경상남도', '제주특별자치도',
]);

// Each 광역시·도's official administrative-center coordinates, used only to
// classify a GPS reading into a display label ("현재 위치 기준 · 전북특별자치도").
// This is nearest-known-point classification, not an invented bounding box:
// Core has no coordinates->region-name route today (see
// site-calendar-manager.js's own note on this same gap), and re-resolving
// through Core's text geocoder here would spend the same per-minute
// geocoding budget the Calendar weather feature depends on. A reading near
// a provincial border can still classify to the neighboring province —
// an inherent limit of nearest-point matching without real reverse geocoding.
const PROVINCE_REFERENCE_POINTS = Object.freeze({
  '서울특별시': [37.5665, 126.9780],
  '부산광역시': [35.1796, 129.0756],
  '대구광역시': [35.8714, 128.6014],
  '인천광역시': [37.4563, 126.7052],
  '광주광역시': [35.1595, 126.8526],
  '대전광역시': [36.3504, 127.3845],
  '울산광역시': [35.5384, 129.3114],
  '세종특별자치시': [36.4801, 127.2890],
  '경기도': [37.4138, 127.5183],
  '강원특별자치도': [37.8228, 128.1555],
  '충청북도': [36.6357, 127.4917],
  '충청남도': [36.5184, 126.8000],
  '전북특별자치도': [35.8242, 127.1480],
  '전라남도': [34.8161, 126.4630],
  '경상북도': [36.4919, 128.8889],
  '경상남도': [35.2383, 128.6924],
  '제주특별자치도': [33.4996, 126.5312],
});

export class SiteFestivalBrowseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SiteFestivalBrowseError';
    this.code = code;
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function civilDate(value) {
  const value_ = text(value);
  return CIVIL_DATE_RE.test(value_) ? value_ : '';
}

function clockTime(value) {
  const value_ = text(value);
  return TIME_RE.test(value_) ? value_ : '';
}

function httpsUrl(value) {
  const value_ = text(value);
  if (!value_) return '';
  try {
    const url = new URL(value_);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function resolvedTimezone() {
  try {
    const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof value === 'string' && value ? value : 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
}

function datePartsInTimezone(now, timezone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {year: Number(values.year), month: Number(values.month), day: Number(values.day)};
}

function addDaysDateString({year, month, day}, days) {
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function weekdayInTimezone(now, timezone) {
  try {
    const label = new Intl.DateTimeFormat('en', {timeZone: timezone, weekday: 'short'}).format(now);
    return {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6}[label] ?? new Date(now).getDay();
  } catch {
    return new Date(now).getDay();
  }
}

export function todayLocalDate(now = new Date(), timezone = resolvedTimezone()) {
  return addDaysDateString(datePartsInTimezone(now, timezone), 0);
}

export function addLocalDays(dateString, days, now = new Date(), timezone = resolvedTimezone()) {
  const base = civilDate(dateString) || todayLocalDate(now, timezone);
  const [year, month, day] = base.split('-').map(Number);
  return addDaysDateString({year, month, day}, days);
}

// The Sat/Sun pair "이번 주말" refers to: if today already is that Saturday or
// Sunday, this is the weekend in progress, not next week's.
export function thisWeekendRange(now = new Date(), timezone = resolvedTimezone()) {
  const today = todayLocalDate(now, timezone);
  const weekday = weekdayInTimezone(now, timezone); // 0=Sun..6=Sat
  const toSaturday = weekday === 6 ? 0 : weekday === 0 ? -1 : 6 - weekday;
  const saturday = addLocalDays(today, toSaturday, now, timezone);
  const sunday = addLocalDays(saturday, 1, now, timezone);
  return Object.freeze({start: saturday, end: sunday});
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function festivalIncludesWeekend(festival, now = new Date(), timezone = resolvedTimezone()) {
  if (!festival || !festival.startDate || !festival.endDate) return false;
  const {start, end} = thisWeekendRange(now, timezone);
  return rangesOverlap(festival.startDate, festival.endDate, start, end);
}

export function festivalIncludesDate(festival, dateString) {
  const date = civilDate(dateString);
  if (!festival || !date || !festival.startDate || !festival.endDate) return false;
  return festival.startDate <= date && date <= festival.endDate;
}

// CANCELLED always wins: a cancelled festival never reads as ONGOING just
// because today falls inside its original dates. ENDED only applies once the
// whole run (including its original cancelled-or-not end date) is in the past.
// This is a display-only label — Core's own ordering/filtering (which record
// counts as ONGOING for the ONGOING time filter, etc.) is authoritative and
// is never re-derived or overridden here.
export function computeFestivalStatus(festival, now = new Date(), timezone = resolvedTimezone()) {
  if (!festival || !festival.startDate || !festival.endDate) return FESTIVAL_STATUS.UPCOMING;
  if (festival.cancelled) return FESTIVAL_STATUS.CANCELLED;
  const today = todayLocalDate(now, timezone);
  if (today > festival.endDate) return FESTIVAL_STATUS.ENDED;
  if (today >= festival.startDate) return FESTIVAL_STATUS.ONGOING;
  return festivalIncludesWeekend(festival, now, timezone) ? FESTIVAL_STATUS.THIS_WEEKEND : FESTIVAL_STATUS.UPCOMING;
}

// Sorted date -> start time, per FESTIVAL-EVENT-07 program-list requirement.
// Core's own detail response already orders programs by (start_date, id);
// this is a stable client-side re-sort by the same date/time, never a
// reordering of the browse LIST itself, which stays exactly Core's order.
export function sortFestivalPrograms(programs) {
  return [...(Array.isArray(programs) ? programs : [])].sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? -1 : 1;
    const leftTime = left.startTime || '99:99';
    const rightTime = right.startTime || '99:99';
    if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
    return left.title.localeCompare(right.title, 'ko');
  });
}

function normalizeProgramPrice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = finiteNumber(raw.amount);
  const unit = text(raw.unit);
  if (amount === null || amount < 0 || !unit) return null;
  const currency = text(raw.currency) || 'KRW';
  // A single program's own price, scoped to its own unit ("1인", "1가족" ...).
  // Never combined with any other program's price into a total anywhere in
  // this client or in site-festival-ui.js — programs can use different units
  // and a summed number would silently misrepresent what it costs.
  return Object.freeze({amount, currency, unit});
}

function normalizeParkingShuttle(raw) {
  const parkingNote = text(raw?.parkingNote);
  const shuttleNote = text(raw?.shuttleNote);
  if (!parkingNote && !shuttleNote) return null;
  return Object.freeze({parkingNote, shuttleNote});
}

// Allowlist normalizer for one canonical program row from `GET
// /festivals/{id}` (`program_name`/`start_date`/`start_time`/... — see
// lotbi-core app/festival_review_models.py::FestivalProgramRecord). `price`
// there is a free-text string, not a structured amount; normalizeProgramPrice
// requires an {amount, unit} object, so a plain string safely normalizes to
// null (price hidden) instead of a fabricated or crashing render.
export function normalizeFestivalProgram(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = text(raw.program_name);
  const date = civilDate(raw.start_date);
  if (!title || !date) return null;
  const category = FESTIVAL_PROGRAM_CATEGORIES.includes(raw.category) ? raw.category : '기타';
  return Object.freeze({
    title,
    date,
    startTime: clockTime(raw.start_time),
    endTime: clockTime(raw.end_time),
    category,
    venue: text(raw.venue),
    note: text(raw.notes),
    price: normalizeProgramPrice(raw.price),
  });
}

// Allowlist normalizer for `GET /festivals/{id}` — the public/private
// boundary for the detail read. Only the fields named here can ever reach
// site-festival-ui.js; an unlisted key on the input is read nowhere below
// and is therefore dropped, not merely unused.
//
// Real Core detail records have no festival-level reservation contract (only
// per-program reservation_type/reservation_url) and no public description or
// image_url, so those fields degrade honestly (a generic "확인필요" reservation
// label, no summary, no-image fallback) rather than fabricating data. The
// official-homepage link is intentionally left unset: FESTIVAL-EVENT-08 owns
// the final detail design, which drops that button.
export function normalizeFestivalDetail(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.festival_id);
  const name = text(raw.name);
  const startDate = civilDate(raw.start_date);
  const endDate = civilDate(raw.end_date);
  if (!id || !name || !startDate || !endDate || startDate > endDate) return null;
  const transport = raw.transport && typeof raw.transport === 'object' ? raw.transport : null;
  return Object.freeze({
    id,
    name,
    startDate,
    endDate,
    cancelled: raw.status === 'CANCELLED',
    region: text(raw.region_name),
    venueName: '',
    address: text(raw.address),
    imageUrl: '',
    summary: '',
    programs: Object.freeze((Array.isArray(raw.programs) ? raw.programs : [])
      .map(normalizeFestivalProgram).filter(Boolean)),
    reservation: Object.freeze({type: 'CHECK_REQUIRED', note: '', reservationUrl: ''}),
    parkingShuttle: normalizeParkingShuttle({parkingNote: transport?.parking, shuttleNote: transport?.shuttle}),
    officialSource: null,
  });
}

/**
 * @param {string} id
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<object|null>} full PUBLISHED-or-later festival detail, or null if not found/unreachable.
 */
export async function getPublishedFestival(id, fetchImpl = globalThis.fetch) {
  const festivalId = text(id);
  if (!festivalId || typeof fetchImpl !== 'function') return null;
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${festivalDetailPath(festivalId)}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    return null;
  }
  if (!response?.ok) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  return normalizeFestivalDetail(payload?.festival);
}

// Allowlist normalizer for one row of `GET /festivals/browse` (`festival_id`/
// `start_date`/`region_name`/`distance_km`/... — see lotbi-core
// app/festival_browse.py::browse_festivals). `image_url` is read here for
// forward-compatibility, but Core's browse response does not emit it today —
// it normalizes to '' (the card's no-image fallback) until Core adds it;
// never a fabricated or reused photo.
function normalizeBrowseItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.festival_id);
  const name = text(raw.name);
  const startDate = civilDate(raw.start_date);
  const endDate = civilDate(raw.end_date);
  if (!id || !name || !startDate || !endDate) return null;
  return Object.freeze({
    id,
    name,
    startDate,
    endDate,
    cancelled: false, // GET /festivals/browse only ever returns PUBLISHED rows
    region: text(raw.region_name),
    address: text(raw.address),
    latitude: finiteNumber(raw.latitude),
    longitude: finiteNumber(raw.longitude),
    distanceKm: finiteNumber(raw.distance_km),
    imageUrl: httpsUrl(raw.image_url),
  });
}

/**
 * @param {{latitude?: number, longitude?: number, region?: string, time?: string, date?: string, limit?: number, offset?: number}} query
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{festivals: ReadonlyArray<object>, hasMore: boolean, nextOffset: number|null, totalCount: number}>}
 */
export async function browseFestivals({
  latitude,
  longitude,
  region,
  time = FESTIVAL_TIME_FILTER.ALL,
  date,
  limit = 20,
  offset = 0,
} = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteFestivalBrowseError('FETCH_UNAVAILABLE', '브라우저 네트워크 기능을 사용할 수 없습니다.');
  }
  const params = new URLSearchParams();
  if (typeof latitude === 'number' && Number.isFinite(latitude) && typeof longitude === 'number' && Number.isFinite(longitude)) {
    params.set('latitude', String(latitude));
    params.set('longitude', String(longitude));
  }
  if (region) params.set('region', region);
  params.set('time', time || FESTIVAL_TIME_FILTER.ALL);
  if (date) params.set('date', date);
  params.set('limit', String(Math.max(1, Math.min(100, Number(limit) || 20))));
  params.set('offset', String(Math.max(0, Number(offset) || 0)));

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${FESTIVAL_BROWSE_PATH}?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    throw new SiteFestivalBrowseError('FESTIVAL_BROWSE_NETWORK_ERROR', '축제·행사 정보를 불러오지 못했어요.');
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // fall through to the !response.ok branch below with an empty payload
  }
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    throw new SiteFestivalBrowseError(
      typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
      '축제·행사 정보를 불러오지 못했어요.',
    );
  }

  const festivals = Array.isArray(payload?.festivals)
    ? payload.festivals.map(normalizeBrowseItem).filter(Boolean)
    : [];
  return Object.freeze({
    festivals,
    hasMore: payload?.has_more === true,
    nextOffset: finiteNumber(payload?.next_offset),
    totalCount: finiteNumber(payload?.total_count) ?? festivals.length,
  });
}

/**
 * @returns {Promise<{provinces: ReadonlyArray<string>, source: 'LIVE'|'FALLBACK'}>}
 */
export async function listFestivalRegions(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  try {
    const response = await fetchImpl(`${CORE_ORIGIN}${FESTIVAL_REGIONS_PATH}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
    if (!response?.ok) return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
    const payload = await response.json();
    const provinces = Array.isArray(payload?.regions)
      ? Object.freeze(payload.regions.map(row => text(row?.region_name)).filter(Boolean))
      : null;
    return provinces?.length ? {provinces, source: 'LIVE'} : {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  } catch {
    return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371.0088;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * Classifies a GPS reading into one of the 17 광역시·도 for display only
 * (never for filtering/query — the raw coordinates, not this label, are what
 * goes to browseFestivals). Returns '' if the coordinates are unusable.
 */
export function resolveCurrentRegionLabel(latitude, longitude) {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return '';
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return '';
  let best = '';
  let bestDistanceKm = Infinity;
  for (const [province, [refLat, refLon]] of Object.entries(PROVINCE_REFERENCE_POINTS)) {
    const distanceKm = haversineKm(latitude, longitude, refLat, refLon);
    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      best = province;
    }
  }
  return best;
}
