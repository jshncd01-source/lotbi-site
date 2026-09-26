// FESTIVAL-07 — public "축제" browse client.
//
// FESTIVAL-06 (Public Festival read API) does not exist yet — confirmed by
// scanning lotbi-core for any festival read endpoint, PR, or branch (only
// FESTIVAL-01's TourAPI source adapter exists, unmerged, and it only ingests
// candidate rows, it does not serve them). Until FESTIVAL-06 ships, the two
// exported functions below (listPublishedFestivals / getPublishedFestival)
// are backed by the fixture set at the bottom of this file instead of a
// network call.
//
// The call sites in site-festival-ui.js only ever go through these two
// functions and never touch the fixture shape directly, so wiring the real
// API later is a body-only change here: swap FESTIVAL_API_ENABLED to true and
// fill in the fetch call, following the exact pattern
// getPublicCalendarWeather() already uses in site-calendar-public-weather.js
// (`${CORE_ORIGIN}/v2/...`, GET, `credentials: 'omit'`, `mode: 'cors'`).
//
// Both functions run every record through normalizePublishedFestival() /
// normalizeFestivalProgram(), an allowlist normalizer. That allowlist is the
// public/private boundary: even if a future FESTIVAL-06 response ever carried
// a stray internal field (status: DRAFT/REVIEW_REQUIRED, a candidate or admin
// id, confidence, an AI prompt, a private PDF/storage URL, an audit note),
// this client only ever reads the named public fields below and drops
// everything else — nothing else can reach the UI through this module.
import {CORE_ORIGIN} from './site-core.js?v=aset-fc9bce2f643e';

const FESTIVAL_API_ENABLED = false;
const REGION_CATALOG_PATH = '/v2/life/weather/regions';

export const FESTIVAL_STATUS = Object.freeze({
  ONGOING: 'ONGOING',
  THIS_WEEKEND: 'THIS_WEEKEND',
  UPCOMING: 'UPCOMING',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
});

export const FESTIVAL_STATUS_LABEL = Object.freeze({
  ONGOING: '진행중',
  THIS_WEEKEND: '이번주말',
  UPCOMING: '예정',
  ENDED: '종료',
  CANCELLED: '취소',
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
// `/v2/life/weather/regions` (lotbi-core app/calendar_weather_regions.py,
// list_manual_weather_provinces()) — used only if that live call fails, so
// the region filter still has something to show rather than an empty box.
const REGION_FALLBACK_PROVINCES = Object.freeze([
  '서울특별시', '인천광역시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '대전광역시', '세종특별자치시', '전북특별자치도', '광주광역시', '전라남도',
  '대구광역시', '경상북도', '부산광역시', '울산광역시', '경상남도', '제주특별자치도',
]);

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

const DEFAULT_VIEW_STATUS_WEIGHT = Object.freeze({
  ONGOING: 0,
  THIS_WEEKEND: 1,
  UPCOMING: 2,
  CANCELLED: 3,
  ENDED: 4,
});

function sortFestivals(festivals, now, timezone) {
  return [...festivals].sort((left, right) => {
    const leftWeight = DEFAULT_VIEW_STATUS_WEIGHT[computeFestivalStatus(left, now, timezone)] ?? 9;
    const rightWeight = DEFAULT_VIEW_STATUS_WEIGHT[computeFestivalStatus(right, now, timezone)] ?? 9;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    if (left.startDate !== right.startDate) return left.startDate < right.startDate ? -1 : 1;
    return left.name.localeCompare(right.name, 'ko');
  });
}

// Sorted date -> start time, per FESTIVAL-07 program-list requirement.
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

// Exported for validate_festival_public_boundary_01.mjs and for the real
// FESTIVAL-06 fetch path to reuse once wired in (any raw API payload should
// go through the same allowlist normalizer, not just the fixtures).
export function normalizeFestivalProgram(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const title = text(raw.title);
  const date = civilDate(raw.date);
  if (!id || !title || !date) return null;
  const category = FESTIVAL_PROGRAM_CATEGORIES.includes(raw.category) ? raw.category : '기타';
  return Object.freeze({
    id,
    title,
    date,
    startTime: clockTime(raw.startTime),
    endTime: clockTime(raw.endTime),
    category,
    venue: text(raw.venue),
    note: text(raw.note),
    price: normalizeProgramPrice(raw.price),
  });
}

function normalizeReservation(raw) {
  const type = FESTIVAL_RESERVATION_TYPES.includes(raw?.type) ? raw.type : 'CHECK_REQUIRED';
  return Object.freeze({
    type,
    note: text(raw?.note),
    reservationUrl: httpsUrl(raw?.reservationUrl),
  });
}

function normalizeParkingShuttle(raw) {
  const parkingNote = text(raw?.parkingNote);
  const shuttleNote = text(raw?.shuttleNote);
  if (!parkingNote && !shuttleNote) return null;
  return Object.freeze({parkingNote, shuttleNote});
}

function normalizeOfficialSource(raw) {
  const url = httpsUrl(raw?.url);
  if (!url) return null;
  return Object.freeze({label: text(raw?.label) || '공식 출처', url});
}

// Allowlist normalizer — the public/private boundary for this feature. Only
// the fields named here can ever reach site-festival-ui.js; an unlisted key
// on the input (a DRAFT/REVIEW_REQUIRED status, a candidate_id, admin_id,
// confidence score, ai_prompt, a private PDF/storage URL, an internal audit
// note) is read nowhere below and is therefore dropped, not merely unused.
export function normalizePublishedFestival(raw, {includePrograms = false} = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const startDate = civilDate(raw.startDate);
  const endDate = civilDate(raw.endDate);
  const region = text(raw.region);
  if (!id || !name || !startDate || !endDate || !region || startDate > endDate) return null;
  const base = {
    id,
    name,
    startDate,
    endDate,
    cancelled: raw.cancelled === true,
    region,
    venueName: text(raw.venueName),
    address: text(raw.address),
    imageUrl: httpsUrl(raw.imageUrl),
    summary: text(raw.summary),
    // Venue coordinates for FESTIVAL-EVENT-09 (program-date weather), read the
    // same way Core's public festival DTO carries them (float|null on the
    // record — see lotbi-core app/festival_review.py festival_public_view()).
    // Never derived from region/address text and never a browser/user
    // location fallback — null here must mean "no venue weather", not "use
    // something else".
    latitude: finiteNumber(raw.latitude),
    longitude: finiteNumber(raw.longitude),
  };
  if (!includePrograms) return Object.freeze(base);
  return Object.freeze({
    ...base,
    programs: Object.freeze((Array.isArray(raw.programs) ? raw.programs : [])
      .map(normalizeFestivalProgram).filter(Boolean)),
    reservation: normalizeReservation(raw.reservation),
    parkingShuttle: normalizeParkingShuttle(raw.parkingShuttle),
    officialSource: normalizeOfficialSource(raw.officialSource),
  });
}

function withinNearTermWindow(festival, now, timezone, {pastDays = 0, upcomingDays = 60} = {}) {
  const today = todayLocalDate(now, timezone);
  const earliestEnd = addLocalDays(today, -pastDays, now, timezone);
  const latestStart = addLocalDays(today, upcomingDays, now, timezone);
  return festival.endDate >= earliestEnd && festival.startDate <= latestStart;
}

function matchesFilters(festival, filters, now, timezone) {
  const status = computeFestivalStatus(festival, now, timezone);
  if (filters.region && festival.region !== filters.region) return false;
  if (filters.status === 'ONGOING' && status !== FESTIVAL_STATUS.ONGOING) return false;
  if (filters.weekend && !festivalIncludesWeekend(festival, now, timezone)) return false;
  if (filters.date === 'today' && !festivalIncludesDate(festival, todayLocalDate(now, timezone))) return false;
  if (filters.date && filters.date !== 'today' && !festivalIncludesDate(festival, filters.date)) return false;
  return true;
}

function hasExplicitFilter(filters) {
  return Boolean(filters.region || filters.status || filters.weekend || filters.date);
}

async function fixtureListPublishedFestivals(filters, now, timezone) {
  const normalized = FESTIVAL_FIXTURES(now, timezone).map(item => normalizePublishedFestival(item)).filter(Boolean);
  const explicit = hasExplicitFilter(filters);
  const matched = normalized.filter(festival => {
    if (!matchesFilters(festival, filters, now, timezone)) return false;
    if (explicit) return true;
    // Default (no filters at all): 진행중 + 가까운 예정만. ENDED is excluded by
    // construction (endDate >= today); long-since-cancelled items fall out the
    // same way once their original end date has passed.
    return withinNearTermWindow(festival, now, timezone);
  });
  return sortFestivals(matched, now, timezone);
}

async function fixtureGetPublishedFestival(id) {
  const raw = FESTIVAL_FIXTURES(new Date(), resolvedTimezone()).find(item => item.id === text(id));
  return raw ? normalizePublishedFestival(raw, {includePrograms: true}) : null;
}

/**
 * @param {{region?: string, status?: 'ONGOING', weekend?: boolean, date?: string}} filters
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<ReadonlyArray<object>>} PUBLISHED festival summaries, most relevant first.
 */
export async function listPublishedFestivals(filters = {}, fetchImpl = globalThis.fetch) {
  const now = new Date();
  const timezone = resolvedTimezone();
  if (!FESTIVAL_API_ENABLED) return fixtureListPublishedFestivals(filters, now, timezone);
  // FESTIVAL-06 연동 지점 — site-calendar-public-weather.js 의
  // getPublicCalendarWeather() 와 동일한 형태로 fetchImpl 호출을 채워 넣는다.
  void fetchImpl;
  return fixtureListPublishedFestivals(filters, now, timezone);
}

/**
 * @param {string} id
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<object|null>} full PUBLISHED festival detail, or null if not found/not public.
 */
export async function getPublishedFestival(id, fetchImpl = globalThis.fetch) {
  if (!FESTIVAL_API_ENABLED) return fixtureGetPublishedFestival(id);
  void fetchImpl;
  return fixtureGetPublishedFestival(id);
}

/**
 * @returns {Promise<{provinces: ReadonlyArray<string>, source: 'LIVE'|'FALLBACK'}>}
 */
export async function listFestivalRegions(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  try {
    const response = await fetchImpl(`${CORE_ORIGIN}${REGION_CATALOG_PATH}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
    if (!response?.ok) return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
    const payload = await response.json();
    const provinces = Array.isArray(payload?.provinces)
      ? Object.freeze(payload.provinces.map(text).filter(Boolean))
      : null;
    return provinces?.length ? {provinces, source: 'LIVE'} : {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  } catch {
    return {provinces: REGION_FALLBACK_PROVINCES, source: 'FALLBACK'};
  }
}

// ---------------------------------------------------------------- fixtures --
// Placeholder PUBLISHED-shaped festival records standing in for FESTIVAL-06.
// Dates are generated relative to "now" so the demo always shows a sane mix
// of 진행중/이번주말/예정/종료/취소 regardless of when this is opened.
// imageUrl is intentionally left blank — this fixture set does not have a
// licensed representative photo for any of these, and the card/detail views
// render a neutral placeholder whenever imageUrl is empty, which is also the
// correct behavior for a real PUBLISHED record with no image_url.
function FESTIVAL_FIXTURES(now, timezone) {
  const today = todayLocalDate(now, timezone);
  const at = days => addLocalDays(today, days, now, timezone);
  const {start: weekendStart, end: weekendEnd} = thisWeekendRange(now, timezone);
  return [
    {
      id: 'fest_ongoing_river',
      name: '한강 억새 빛 축제',
      startDate: at(-3),
      endDate: at(4),
      region: '서울특별시',
      venueName: '여의도 한강공원',
      address: '서울특별시 영등포구 여의동로 330',
      latitude: 37.5283,
      longitude: 126.9336,
      summary: '해질녘 한강변을 따라 억새와 조명 설치가 이어지는 가을 축제.',
      programs: [
        {id: 'prog_river_1', date: at(0), startTime: '19:00', endTime: '21:00', title: '야간 조명 점등식', category: '공연', venue: '한강공원 중앙광장'},
        {id: 'prog_river_2', date: at(0), startTime: '14:00', endTime: '17:00', title: '가족 갈대공예 체험', category: '체험', venue: '체험존', price: {amount: 5000, currency: 'KRW', unit: '1인'}},
        {id: 'prog_river_3', date: at(1), startTime: '11:00', endTime: '20:00', title: '한강 푸드트럭 존', category: '먹거리', venue: '푸드트럭 존'},
      ],
      reservation: {type: 'NONE', note: '현장 자유 관람, 별도 예약이 필요하지 않습니다.'},
      parkingShuttle: {parkingNote: '여의도 한강공원 제2주차장 이용(유료).', shuttleNote: '여의나루역 5번 출구에서 도보 10분.'},
      officialSource: {label: '서울시 공식 문화행사 안내', url: 'https://culture.seoul.go.kr/festival/hangang-reed-2026'},
    },
    {
      id: 'fest_weekend_night_market',
      name: '수원 야시장 페스티벌',
      startDate: weekendStart,
      endDate: weekendEnd,
      region: '경기도',
      venueName: '수원 화성행궁 광장',
      address: '경기도 수원시 팔달구 정조로 825',
      latitude: 37.2836,
      longitude: 127.0187,
      summary: '이번 주말 이틀간 열리는 야시장·공연 페스티벌.',
      programs: [
        {id: 'prog_night_1', date: weekendStart, startTime: '18:00', endTime: '22:00', title: '개막 공연', category: '공연'},
        {id: 'prog_night_2', date: weekendEnd, startTime: '12:00', endTime: '20:00', title: '전통 먹거리 장터', category: '먹거리'},
      ],
      reservation: {type: 'ADVANCE', note: '주요 공연 좌석은 사전예약자에게 우선 배정됩니다.', reservationUrl: 'https://festival.suwon.go.kr/night-market/reserve'},
      parkingShuttle: {shuttleNote: '수원역 앞에서 30분 간격 셔틀버스 운행.'},
      officialSource: {label: '수원시 축제 공식 페이지', url: 'https://festival.suwon.go.kr/night-market'},
    },
    {
      id: 'fest_ongoing_weekend_overlap',
      name: '경주 벚꽃 야행',
      startDate: at(-1),
      endDate: at(10),
      region: '경상북도',
      venueName: '경주 동궁과 월지',
      summary: '진행 중이면서 이번 주말도 포함하는 장기 야간 개장 행사.',
      programs: [
        {id: 'prog_gyeongju_1', date: weekendStart, startTime: '19:30', endTime: '21:30', title: '월지 야간 음악회', category: '공연', price: {amount: 10000, currency: 'KRW', unit: '1인'}},
      ],
      reservation: {type: 'ONSITE', note: '매표소 현장 접수, 회차별 인원 제한이 있습니다.'},
      officialSource: {label: '경주시 문화관광 공식 페이지', url: 'https://tour.gyeongju.go.kr/donggung-night'},
    },
    {
      id: 'fest_upcoming_soon',
      name: '전주 한지문화 축제',
      startDate: at(20),
      endDate: at(22),
      region: '전북특별자치도',
      venueName: '전주 한옥마을 일원',
      latitude: 35.8151,
      longitude: 127.1535,
      summary: '한지 공예와 전통 체험 위주의 3일간 축제. 축제장 좌표 기준으로 날씨를 표시하는 예시 — 사용자의 현재 위치가 아니라 이 좌표를 씁니다.',
      programs: [
        {id: 'prog_hanji_1', date: at(20), startTime: '10:00', endTime: '18:00', title: '한지 공예 체험', category: '체험', price: {amount: 8000, currency: 'KRW', unit: '1인'}},
        {id: 'prog_hanji_2', date: at(21), startTime: '13:00', endTime: '15:00', title: '어린이 한지 놀이터', category: '가족'},
      ],
      reservation: {type: 'CHECK_REQUIRED', note: '프로그램별 예약 방식이 달라 공식 페이지 확인이 필요합니다.'},
      officialSource: {label: '전주문화재단', url: 'https://jjcf.or.kr/hanji-festival'},
    },
    {
      id: 'fest_upcoming_far',
      name: '부산 바다빛 축제',
      startDate: at(75),
      endDate: at(77),
      region: '부산광역시',
      venueName: '해운대 해수욕장',
      summary: '두 달 이상 남은 예정 축제 — 기본 목록의 "가까운 예정" 창에서는 제외되고 지역/날짜 필터로만 조회됨.',
      programs: [
        {id: 'prog_busan_1', date: at(75), startTime: '20:00', endTime: '20:40', title: '해변 불꽃 공연', category: '공연'},
      ],
      reservation: {type: 'NONE'},
      officialSource: {label: '부산관광공사', url: 'https://bto.or.kr/haeundae-light'},
    },
    {
      id: 'fest_ended_recent',
      name: '인천 개항장 거리 축제',
      startDate: at(-12),
      endDate: at(-5),
      region: '인천광역시',
      venueName: '인천 개항장 거리',
      summary: '최근 종료된 축제 — 기본 목록에서 제외되고 지역/날짜 필터로만 조회됨.',
      programs: [
        {id: 'prog_incheon_1', date: at(-7), startTime: '15:00', endTime: '17:00', title: '근대 거리 공연', category: '공연'},
      ],
      reservation: {type: 'NONE'},
      officialSource: {label: '인천 중구청 문화관광과', url: 'https://tour.icjg.go.kr/gaehangjang-street'},
    },
    {
      id: 'fest_cancelled_near',
      name: '제주 유채꽃 걷기 축제',
      startDate: at(6),
      endDate: at(8),
      region: '제주특별자치도',
      venueName: '제주 서귀포 유채꽃프라자',
      cancelled: true,
      summary: '기상 사정으로 취소된 축제. 근접한 일정이라 기본 목록에서도 취소 표시로 노출됨.',
      programs: [
        {id: 'prog_jeju_1', date: at(6), startTime: '10:00', endTime: '12:00', title: '유채꽃밭 걷기 프로그램', category: '가족'},
      ],
      reservation: {type: 'NONE', note: '행사가 취소되어 예약이 발생하지 않습니다.'},
      officialSource: {label: '서귀포시 공식 공지', url: 'https://seogwipo.go.kr/notice/canola-walk-cancel'},
    },
  ];
}
