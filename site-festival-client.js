// FESTIVAL-EVENT-07/08 — public "축제·행사" browse/detail client.
//
// Wired to the real, merged Core contract: `GET /festivals` (plain list,
// used only as a fallback shape reference) and `GET /festivals/{festival_id}`
// (detail), both served by `app.festival_review.festival_public_view` in
// lotbi-core, plus FESTIVAL-EVENT-02's additive `GET /festivals/browse`
// (current-location or manual 17-시도 region, ALL/ONGOING/THIS_WEEKEND/
// THIS_MONTH/DATE time filters, Core-authoritative distance/ordering, offset
// pagination) and `GET /festivals/regions` (canonical 17 광역시·도 catalog) —
// confirmed by reading lotbi-core directly (2026-09-26, lotbi-core main
// f0492a7, post FESTIVAL-EVENT-02 merge). There is no fixture layer left in
// this client — every record, browse or detail, goes through the fetch +
// normalize path below.
//
// The exported read functions (browseFestivals / getPublishedFestival) run
// every record through an allowlist normalizer (normalizeBrowseItem /
// normalizePublishedFestival / normalizeFestivalProgram): even if a future
// response ever carried a stray internal field (a DRAFT/REVIEW status, a
// candidate/admin id, confidence, an AI prompt, a private PDF/storage URL, an
// audit note, homepage_url, telephone, transport, notices), this client only
// ever reads the named public fields below and drops everything else.
//
// Two Core fields intentionally never reach the Site model at all:
// `homepage_url` (an official-homepage button is legacy UI FESTIVAL-EVENT-08
// removes) and `transport`/`notices`/`telephone` (legacy 예약안내·주차셔틀
// sections FESTIVAL-EVENT-08 removes) — dropping them at the normalizer means
// no later UI code can accidentally resurrect them. List ordering/filtering
// (region, time window, distance) is Core-authoritative via browseFestivals;
// nothing here re-sorts or re-filters a browse page.
import {CORE_ORIGIN} from './site-core.js?v=aset-5cf91ee9df1d';

const FESTIVAL_REGIONS_PATH = '/festivals/regions';
const FESTIVAL_BROWSE_PATH = '/festivals/browse';
const FESTIVAL_DETAIL_PATH = '/festivals';

export const FESTIVAL_STATUS = Object.freeze({
  ONGOING: 'ONGOING',
  THIS_WEEKEND: 'THIS_WEEKEND',
  UPCOMING: 'UPCOMING',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
});

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

// Same 17 시·도 FESTIVAL-EVENT-02's `/festivals/regions` returns — used only
// if that live call fails, so the region picker still has something to show.
const REGION_FALLBACK_PROVINCES = Object.freeze([
  '서울특별시', '인천광역시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '대전광역시', '세종특별자치시', '전북특별자치도', '광주광역시', '전라남도',
  '대구광역시', '경상북도', '부산광역시', '울산광역시', '경상남도', '제주특별자치도',
]);

// Each 광역시·도's official administrative-center coordinates, used only to
// classify a GPS reading into a display label ("현재 위치 기준 · 전북특별자치도").
// This is nearest-known-point classification, not an invented bounding box:
// Core has no coordinates->region-name route today, and re-resolving through
// Core's text geocoder here would spend the same per-minute geocoding budget
// the Calendar weather feature depends on. A reading near a provincial border
// can still classify to the neighboring province — an inherent limit of
// nearest-point matching without real reverse geocoding.
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

function isValidYMD(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const stamp = new Date(Date.UTC(year, month - 1, day));
  return stamp.getUTCFullYear() === year && stamp.getUTCMonth() === month - 1 && stamp.getUTCDate() === day;
}

function isoFromYMD(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// The canonical Core schema stores whatever a source adapter wrote verbatim
// (app.festival_ingest does not normalize format): TourAPI's own adapter
// uses raw YYYYMMDD; ISO YYYY-MM-DD (what staff review writes) is also
// accepted. Mirrors lotbi-core's app.festival_read.parse_festival_date so a
// PUBLISHED row with either shape still produces a real, KST-stable civil
// date rather than an empty/garbled one. An unparseable or impossible date
// (e.g. month 13) resolves to '' rather than a guessed value.
export function parseFestivalDateToISO(value) {
  const raw = text(value);
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) {
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    return isValidYMD(year, month, day) ? isoFromYMD(year, month, day) : '';
  }
  const candidate = raw.slice(0, 10);
  if (!CIVIL_DATE_RE.test(candidate)) return '';
  const [year, month, day] = candidate.split('-').map(Number);
  return isValidYMD(year, month, day) ? candidate : '';
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

// A plain calendar date's weekday never depends on timezone conversion of an
// instant — it is pure Y/M/D arithmetic. This is what keeps date-tab weekday
// labels correct regardless of the viewer's browser timezone (the "KST civil
// date" requirement is about not deriving the date itself from a UTC
// instant, which addLocalDays/todayLocalDate already handle upstream).
export function festivalWeekdayKST(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  const [, y, m, d] = match.map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ['일', '월', '화', '수', '목', '금', '토'][day];
}

export function formatFestivalDateTabLabel(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  const weekday = festivalWeekdayKST(dateString);
  return `${Number(match[2])}/${Number(match[3])}${weekday ? ` ${weekday}` : ''}`;
}

// The Sat/Sun pair "이번주말" refers to: if today already is that Saturday or
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
export function computeFestivalStatus(festival, now = new Date(), timezone = resolvedTimezone()) {
  if (!festival || !festival.startDate || !festival.endDate) return FESTIVAL_STATUS.UPCOMING;
  if (festival.cancelled) return FESTIVAL_STATUS.CANCELLED;
  const today = todayLocalDate(now, timezone);
  if (today > festival.endDate) return FESTIVAL_STATUS.ENDED;
  if (today >= festival.startDate) return FESTIVAL_STATUS.ONGOING;
  return festivalIncludesWeekend(festival, now, timezone) ? FESTIVAL_STATUS.THIS_WEEKEND : FESTIVAL_STATUS.UPCOMING;
}

// Global date+time ordering across an arbitrary set of programs (used by
// callers that want a single flat, deterministic order; date-tab grouping
// below uses its own within-day time-only stable sort instead, since a
// multi-day program's own startDate would otherwise misorder same-day peers).
export function sortFestivalPrograms(programs) {
  const list = Array.isArray(programs) ? programs.slice() : [];
  return list
    .map((program, index) => ({program, index}))
    .sort((left, right) => {
      const leftDate = left.program.startDate || '9999-99-99';
      const rightDate = right.program.startDate || '9999-99-99';
      if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
      const leftTime = left.program.startTime || '99:99';
      const rightTime = right.program.startTime || '99:99';
      if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
      return left.index - right.index; // stable: never re-derive order from title
    })
    .map(entry => entry.program);
}

// A program's [start_date, end_date] range, expanded to every civil date it
// covers (bounded to 62 days so a malformed multi-year range can never hang
// the UI) — this is what lets a multi-day program appear under every date
// tab it actually runs on, not just its first day.
export function expandProgramDateRange(program) {
  if (!program?.startDate) return [];
  const end = program.endDate && program.endDate >= program.startDate ? program.endDate : program.startDate;
  const dates = [];
  let cursor = program.startDate;
  let guard = 0;
  while (cursor <= end && guard < 62) {
    dates.push(cursor);
    if (cursor === end) break;
    cursor = addLocalDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

function sortByStartTimeStable(programs) {
  return programs
    .map((program, index) => ({program, index}))
    .sort((left, right) => {
      const leftTime = left.program.startTime || '99:99';
      const rightTime = right.program.startTime || '99:99';
      if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
      return left.index - right.index;
    })
    .map(entry => entry.program);
}

// Real dates only: a date tab exists if and only if at least one program's
// [start_date, end_date] range actually covers it. A program with no
// start_date at all cannot be placed on any tab (no fake tabs either way).
export function groupProgramsByDate(programs) {
  const list = Array.isArray(programs) ? programs : [];
  const byDate = new Map();
  for (const program of list) {
    for (const date of expandProgramDateRange(program)) {
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(program);
    }
  }
  return [...byDate.keys()].sort().map(date => ({date, programs: sortByStartTimeStable(byDate.get(date))}));
}

// Selection priority (structure only — no live Calendar/weather wiring here):
//   1. an explicit selectedDate handed in (FESTIVAL-EVENT-10's visit-date hook)
//   2. today, if the festival is running today AND today has a program
//   3. otherwise the earliest date that actually has a program
export function selectInitialProgramDate(dateTabs, {selectedDate, now = new Date(), timezone = resolvedTimezone()} = {}) {
  if (!dateTabs.length) return '';
  const dates = dateTabs.map(tab => tab.date);
  const explicit = civilDate(selectedDate);
  if (explicit && dates.includes(explicit)) return explicit;
  const today = todayLocalDate(now, timezone);
  if (dates.includes(today)) return today;
  return dates[0];
}

export function formatFestivalDateLabel(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  return `${Number(match[2])}.${Number(match[3])}`;
}

export function formatFestivalPeriod(festival) {
  if (!festival?.startDate || !festival?.endDate) return '';
  if (festival.startDate === festival.endDate) return formatFestivalDateLabel(festival.startDate);
  return `${formatFestivalDateLabel(festival.startDate)} ~ ${formatFestivalDateLabel(festival.endDate)}`;
}

export function formatFestivalLocation(festival) {
  // Core's canonical schema has no separate venue-name column at the
  // festival level (see app/festival_models.py) — region + address is the
  // real available location signal.
  return [festival?.region, festival?.address].filter(Boolean).join(' · ');
}

// Allowlist normalizer for one program row from `festival.programs[]`
// (app.festival_review.festival_public_view). Core does not send a program
// identifier, so `key` here is a DOM-only synthetic value, never sent
// anywhere. `participationUrl` is this program's own reservation_url; the
// festival-level participation CTA (below) picks the first one in Core's own
// order. `reservation_type`/`reservation_start`/`reservation_end`/`capacity`
// are read nowhere — this room never exposes the internal reservation-type
// enum to consumers (that legacy UI is removed).
export function normalizeFestivalProgram(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const title = text(raw.program_name);
  if (!title) return null;
  const startDate = parseFestivalDateToISO(raw.start_date);
  const endDateRaw = parseFestivalDateToISO(raw.end_date);
  return Object.freeze({
    key: `festival-program-${index}-${startDate || 'nodate'}-${text(raw.start_time) || 'notime'}`,
    title,
    category: text(raw.category),
    startDate,
    endDate: endDateRaw || startDate,
    startTime: clockTime(raw.start_time),
    endTime: clockTime(raw.end_time),
    venue: text(raw.venue),
    price: text(raw.price),
    notes: text(raw.notes),
    participationUrl: httpsUrl(raw.reservation_url),
  });
}

// The single [체험·신청] CTA maps to whichever program (in Core's own
// start_date/id order — festival_public_view already orders programs that
// way) carries a real https reservation_url first. Never fabricated: if no
// ACTIVE program has one, this is '' and the CTA is hidden entirely.
function firstParticipationUrl(programs) {
  for (const program of programs) {
    if (program.participationUrl) return program.participationUrl;
  }
  return '';
}

// Allowlist normalizer — the public/private boundary for this feature. Only
// the fields named here can ever reach site-festival-ui.js; an unlisted key
// on the input (a DRAFT/REVIEW status, a candidate_id, admin_id, confidence
// score, ai_prompt, a private PDF/storage URL, an internal audit note) is
// read nowhere below and is therefore dropped, not merely unused.
// `homepage_url`/`telephone`/`transport`/`notices` are also intentionally
// never read here — this room removes the legacy 공식홈페이지/예약안내/
// 주차셔틀/출처 sections built on top of them.
export function normalizePublishedFestival(raw, {includePrograms = false} = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.festival_id);
  const name = text(raw.name);
  const startDate = parseFestivalDateToISO(raw.start_date);
  const endDate = parseFestivalDateToISO(raw.end_date);
  if (!id || !name || !startDate || !endDate || startDate > endDate) return null;
  const base = {
    id,
    name,
    startDate,
    endDate,
    cancelled: raw.status === 'CANCELLED',
    region: text(raw.region_name),
    address: text(raw.address),
    latitude: finiteNumber(raw.latitude),
    longitude: finiteNumber(raw.longitude),
    imageUrl: httpsUrl(raw.image_url),
    summary: text(raw.short_description),
  };
  if (!includePrograms) return Object.freeze(base);
  const programs = Object.freeze((Array.isArray(raw.programs) ? raw.programs : [])
    .map((item, index) => normalizeFestivalProgram(item, index)).filter(Boolean));
  return Object.freeze({
    ...base,
    programs,
    participationUrl: firstParticipationUrl(programs),
  });
}

async function coreFetchJson(pathAndQuery, fetchImpl) {
  if (typeof fetchImpl !== 'function') return {ok: false, status: 0, data: null};
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${pathAndQuery}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    return {ok: false, status: 0, data: null};
  }
  if (!response) return {ok: false, status: 0, data: null};
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return {ok: Boolean(response.ok), status: Number(response.status) || 0, data};
}

async function apiGetPublishedFestival(id, fetchImpl) {
  const result = await coreFetchJson(`${FESTIVAL_DETAIL_PATH}/${encodeURIComponent(text(id))}`, fetchImpl);
  if (result.status === 404) return null; // real 404 — not a fetch failure
  if (!result.ok) throw new Error('FESTIVAL_DETAIL_FETCH_FAILED');
  const raw = result.data?.festival;
  if (!raw) return null;
  return normalizePublishedFestival(raw, {includePrograms: true});
}

/**
 * @param {string} id
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<object|null>} full PUBLISHED festival detail, or null if not found/not public.
 */
export async function getPublishedFestival(id, fetchImpl = globalThis.fetch) {
  return apiGetPublishedFestival(id, fetchImpl);
}

/**
 * @returns {Promise<{provinces: ReadonlyArray<string>, source: 'LIVE'|'FALLBACK'}>}
 */
export async function listFestivalRegions(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  const result = await coreFetchJson(FESTIVAL_REGIONS_PATH, fetchImpl);
  if (!result.ok) return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  const provinces = Array.isArray(result.data?.regions)
    ? Object.freeze(result.data.regions.map(row => text(row?.region_name)).filter(Boolean))
    : null;
  return provinces?.length ? {provinces, source: 'LIVE'} : {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
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
  const startDate = parseFestivalDateToISO(raw.start_date);
  const endDate = parseFestivalDateToISO(raw.end_date);
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

  const result = await coreFetchJson(`${FESTIVAL_BROWSE_PATH}?${params.toString()}`, fetchImpl);
  if (!result.ok) {
    const detail = result.data?.detail && typeof result.data.detail === 'object' ? result.data.detail : {};
    throw new SiteFestivalBrowseError(
      typeof detail.code === 'string' ? detail.code : (result.status ? `HTTP_${result.status}` : 'FESTIVAL_BROWSE_NETWORK_ERROR'),
      '축제·행사 정보를 불러오지 못했어요.',
    );
  }

  const festivals = Array.isArray(result.data?.festivals)
    ? result.data.festivals.map(normalizeBrowseItem).filter(Boolean)
    : [];
  return Object.freeze({
    festivals,
    hasMore: result.data?.has_more === true,
    nextOffset: finiteNumber(result.data?.next_offset),
    totalCount: finiteNumber(result.data?.total_count) ?? festivals.length,
  });
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
