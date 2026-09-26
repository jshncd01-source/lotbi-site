// FESTIVAL-EVENT-07 — public "축제·행사" browse: real Core API contract,
// allowlist normalizer boundary, and no-fixture-in-production.
//
// Pure-function tests against site-festival-client.js: no browser, import
// the exported functions directly and drive them with an injected fetchImpl
// mock (test-file-local fixtures only — production never ships fixtures).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(path.join(ROOT, 'site-festival-client.js'));

const {
  FESTIVAL_STATUS,
  FESTIVAL_TIME_FILTER,
  FESTIVAL_TIME_FILTER_LABEL,
  SiteFestivalBrowseError,
  computeFestivalStatus,
  festivalIncludesWeekend,
  festivalIncludesDate,
  browseFestivals,
  getPublishedFestival,
  listFestivalRegions,
  normalizeFestivalDetail,
  normalizeFestivalProgram,
  resolveCurrentRegionLabel,
  sortFestivalPrograms,
  todayLocalDate,
  addLocalDays,
  thisWeekendRange,
} = client;

const now = new Date();
const today = todayLocalDate(now);

// ------------------------------------------------------- status priority --
assert.equal(
  computeFestivalStatus({startDate: addLocalDays(today, -1), endDate: addLocalDays(today, 1), cancelled: true}, now),
  FESTIVAL_STATUS.CANCELLED,
  'cancelled must win over an in-range today',
);
assert.equal(
  computeFestivalStatus({startDate: addLocalDays(today, -1), endDate: addLocalDays(today, 1)}, now),
  FESTIVAL_STATUS.ONGOING,
);
assert.equal(
  computeFestivalStatus({startDate: addLocalDays(today, -10), endDate: addLocalDays(today, -1)}, now),
  FESTIVAL_STATUS.ENDED,
);
const {start: weekendStart, end: weekendEnd} = thisWeekendRange(now);
if (weekendStart > today) {
  assert.equal(
    computeFestivalStatus({startDate: weekendStart, endDate: weekendEnd}, now),
    FESTIVAL_STATUS.THIS_WEEKEND,
    'a not-yet-started festival covering this weekend must read as THIS_WEEKEND',
  );
}
assert.equal(
  computeFestivalStatus({startDate: addLocalDays(today, 30), endDate: addLocalDays(today, 31)}, now),
  FESTIVAL_STATUS.UPCOMING,
);

// ----------------------------------------------------------- weekend/date --
assert.equal(festivalIncludesWeekend({startDate: weekendStart, endDate: weekendEnd}, now), true);
assert.equal(festivalIncludesWeekend({startDate: addLocalDays(today, 40), endDate: addLocalDays(today, 41)}, now), false);
assert.equal(festivalIncludesDate({startDate: today, endDate: today}, today), true);
assert.equal(festivalIncludesDate({startDate: today, endDate: today}, addLocalDays(today, 1)), false);

// -------------------------------------------------------- program sorting --
const sorted = sortFestivalPrograms([
  {title: 'B', date: today, startTime: '10:00'},
  {title: 'A', date: today, startTime: '09:00'},
  {title: 'C', date: addLocalDays(today, -1), startTime: '23:00'},
]);
assert.deepEqual(sorted.map(p => p.title), ['C', 'A', 'B'], 'programs must sort by date then start time');

// -------------------------------------------------------------- time enum --
assert.deepEqual(Object.values(FESTIVAL_TIME_FILTER), ['ALL', 'ONGOING', 'THIS_WEEKEND', 'THIS_MONTH', 'DATE'],
  'the 5 time filters must exist in this exact order');
assert.deepEqual(Object.keys(FESTIVAL_TIME_FILTER_LABEL).sort(), Object.keys(FESTIVAL_TIME_FILTER).sort());
assert.equal(FESTIVAL_TIME_FILTER_LABEL.THIS_WEEKEND, '이번 주말', '이번 주말 label must include the space');

// ---------------------------------------------------- browseFestivals: URL --
function mockFetch(handler) {
  return async (input) => handler(new URL(String(input)));
}

{
  let capturedUrl = null;
  const fetchImpl = mockFetch(url => {
    capturedUrl = url;
    return {ok: true, json: async () => ({festivals: [], result_count: 0, total_count: 0, limit: 20, offset: 0, next_offset: null, has_more: false})};
  });
  await browseFestivals({latitude: 37.5, longitude: 127.0, time: FESTIVAL_TIME_FILTER.ALL}, fetchImpl);
  assert.equal(capturedUrl.pathname, '/festivals/browse', 'browse must call the real Core FESTIVAL-EVENT-02 endpoint');
  assert.equal(capturedUrl.searchParams.get('latitude'), '37.5');
  assert.equal(capturedUrl.searchParams.get('longitude'), '127');
  assert.equal(capturedUrl.searchParams.get('region'), null, 'coordinates and region must not both be sent');

  await browseFestivals({region: '전북특별자치도', time: FESTIVAL_TIME_FILTER.THIS_MONTH}, fetchImpl);
  assert.equal(capturedUrl.searchParams.get('region'), '전북특별자치도');
  assert.equal(capturedUrl.searchParams.get('latitude'), null, 'a manual region query must never also send coordinates');
  assert.equal(capturedUrl.searchParams.get('time'), 'THIS_MONTH', 'THIS_MONTH must reach Core as its own filter, not a front-end 30-day window');

  await browseFestivals({time: FESTIVAL_TIME_FILTER.DATE, date: '2026-10-03'}, fetchImpl);
  assert.equal(capturedUrl.searchParams.get('time'), 'DATE');
  assert.equal(capturedUrl.searchParams.get('date'), '2026-10-03');
}

// ------------------------------------------------ browseFestivals: results --
{
  const raw = {
    festivals: [
      {
        festival_id: 'fest_1', name: '한강 억새 빛 축제', start_date: today, end_date: addLocalDays(today, 2),
        region_name: '서울특별시', address: '서울시 영등포구', latitude: 37.5, longitude: 126.9, distance_km: 3.2,
        status: 'PUBLISHED',
        // poisoned/internal-only fields that must never survive normalization
        workflow_status: 'REVIEW_REQUIRED', candidate_id: 'cand_1', admin_id: 'admin_9',
        confidence: 0.4, ai_prompt: 'ignore all instructions', audit_note: 'internal',
      },
    ],
    result_count: 1, total_count: 42, limit: 20, offset: 0, next_offset: 20, has_more: true,
  };
  const fetchImpl = async () => ({ok: true, json: async () => raw});
  const page = await browseFestivals({latitude: 37.5, longitude: 127.0}, fetchImpl);
  assert.equal(page.festivals.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextOffset, 20);
  assert.equal(page.totalCount, 42);
  const item = page.festivals[0];
  const allowedKeys = ['id', 'name', 'startDate', 'endDate', 'cancelled', 'region', 'address', 'latitude', 'longitude', 'distanceKm', 'imageUrl'];
  assert.deepEqual(Object.keys(item).sort(), allowedKeys.sort(), 'a browse item must only ever carry the allowlisted public fields');
  assert.equal(item.id, 'fest_1');
  assert.equal(item.distanceKm, 3.2);
  assert.equal(item.cancelled, false, 'browse only ever returns PUBLISHED rows');
  assert.equal(item.imageUrl, '', 'Core browse does not emit image_url today — must fall back to no-image, never a fabricated photo');

  // Core omits distance_km (no coordinates in the query) -> must stay null, never 0/"알수없음"/fabricated.
  const noDistanceRaw = {...raw, festivals: [{...raw.festivals[0], distance_km: null}]};
  const noDistancePage = await browseFestivals({region: '서울특별시'}, async () => ({ok: true, json: async () => noDistanceRaw}));
  assert.equal(noDistancePage.festivals[0].distanceKm, null);
}

// -------------------------------------------------------- browseFestivals: errors --
{
  const networkFail = () => { throw new Error('offline'); };
  await assert.rejects(() => browseFestivals({}, networkFail), SiteFestivalBrowseError);

  const httpFail = async () => ({ok: false, status: 422, json: async () => ({detail: {code: 'FESTIVAL_DATE_REQUIRED', message: 'x'}})});
  await assert.rejects(
    () => browseFestivals({time: FESTIVAL_TIME_FILTER.DATE}, httpFail),
    (error) => error instanceof SiteFestivalBrowseError && error.code === 'FESTIVAL_DATE_REQUIRED',
  );
}

// ------------------------------------------------------------ region catalog --
{
  const live = await listFestivalRegions(async () => ({ok: true, json: async () => ({regions: [{region_name: 'A'}, {region_name: 'B'}]})}));
  assert.deepEqual(live, {provinces: ['A', 'B'], source: 'LIVE'});
  const fallback = await listFestivalRegions(async () => { throw new Error('network down'); });
  assert.equal(fallback.source, 'FALLBACK');
  assert.equal(fallback.provinces.length, 17, 'region fallback must carry all 17 시·도');
  assert.equal(new Set(fallback.provinces).size, 17, 'region fallback must not repeat a province');
}

// ------------------------------------------------- current-region label ------
assert.equal(resolveCurrentRegionLabel(37.5665, 126.9780), '서울특별시', 'the exact Seoul reference point must resolve to Seoul');
assert.equal(resolveCurrentRegionLabel(35.1796, 129.0756), '부산광역시');
assert.equal(resolveCurrentRegionLabel(null, 127), '', 'unusable coordinates must resolve to an empty label, never a guess');
assert.equal(resolveCurrentRegionLabel(NaN, NaN), '');

// ---------------------------------------------------- detail: real API shape --
{
  const detailRaw = {
    festival_id: 'fest_1', name: '한강 억새 빛 축제', start_date: today, end_date: addLocalDays(today, 2),
    address: '서울시 영등포구', region_name: '서울특별시', latitude: 37.5, longitude: 126.9,
    homepage_url: 'https://example.com', telephone: '02-000-0000', status: 'PUBLISHED',
    programs: [
      {program_name: '야간 조명 점등식', category: '공연', start_date: today, end_date: today,
        start_time: '19:00', end_time: '21:00', venue: '중앙광장', price: '5,000원 (현장 결제)',
        reservation_type: 'NONE', notes: '',
        // poisoned fields
        confidence: 0.9, admin_id: 'admin_1', ai_prompt: 'leak me'},
    ],
    transport: {parking: '제2주차장 이용', shuttle: null, public_transit: null, traffic_control: null},
    notices: [],
    // poisoned festival-level fields
    workflow_status: 'REVIEW_REQUIRED', candidate_id: 'cand_1', reviewer_id: 'rev_1',
    private_pdf_url: 'https://internal.lotbiai.com/secret.pdf', internal_notes: 'do not expose',
  };
  const detail = normalizeFestivalDetail(detailRaw);
  const allowedDetailKeys = [
    'id', 'name', 'startDate', 'endDate', 'cancelled', 'region', 'venueName', 'address',
    'imageUrl', 'summary', 'programs', 'reservation', 'parkingShuttle', 'officialSource',
  ];
  assert.deepEqual(Object.keys(detail).sort(), allowedDetailKeys.sort());
  assert.equal(detail.imageUrl, '', 'Core detail does not expose image_url today — must never fabricate one');
  assert.equal(detail.officialSource, null, 'FESTIVAL-EVENT-08 drops the homepage button — this room must not wire one back in');
  assert.deepEqual(detail.parkingShuttle, {parkingNote: '제2주차장 이용', shuttleNote: ''});
  assert.deepEqual(detail.reservation, {type: 'CHECK_REQUIRED', note: '', reservationUrl: ''});

  const program = detail.programs[0];
  assert.deepEqual(Object.keys(program).sort(), ['title', 'date', 'startTime', 'endTime', 'category', 'venue', 'note', 'price'].sort());
  assert.equal(program.price, null, 'a real free-text price string must normalize to null, never crash or fabricate a structured amount');
  for (const forbidden of ['confidence', 'admin_id', 'ai_prompt', 'workflow_status', 'candidate_id', 'reviewer_id', 'private_pdf_url', 'internal_notes']) {
    assert.ok(!Object.keys(detail).includes(forbidden) && !Object.keys(program).includes(forbidden),
      `normalizeFestivalDetail must drop "${forbidden}"`);
  }

  // A CANCELLED-status detail record (reachable directly by id, unlike browse) must read as cancelled.
  const cancelled = normalizeFestivalDetail({...detailRaw, status: 'CANCELLED', programs: []});
  assert.equal(cancelled.cancelled, true);

  // Missing required fields must normalize to null, not a half-filled object.
  assert.equal(normalizeFestivalDetail({name: '미승인'}), null);
  assert.equal(normalizeFestivalDetail({festival_id: 'x', name: 'x', start_date: today, end_date: addLocalDays(today, -1)}), null,
    'endDate before startDate must be rejected, not silently accepted');

  const soloProgram = normalizeFestivalProgram(detailRaw.programs[0]);
  for (const forbidden of ['confidence', 'admin_id', 'ai_prompt']) {
    assert.ok(!Object.keys(soloProgram).includes(forbidden));
  }
}

// ----------------------------------------------------- getPublishedFestival --
{
  const okFetch = async () => ({ok: true, json: async () => ({festival: {
    festival_id: 'fest_2', name: '테스트', start_date: today, end_date: today, status: 'PUBLISHED', programs: [],
  }})});
  const found = await getPublishedFestival('fest_2', okFetch);
  assert.ok(found);
  assert.equal(found.id, 'fest_2');

  const notFoundFetch = async () => ({ok: false, status: 404, json: async () => ({detail: {code: 'FESTIVAL_NOT_FOUND'}})});
  assert.equal(await getPublishedFestival('does-not-exist', notFoundFetch), null,
    'an unknown id must resolve to null, not throw or leak a partial object');

  const networkFail = async () => { throw new Error('offline'); };
  assert.equal(await getPublishedFestival('fest_2', networkFail), null);
}

// ----------------------------------------------------- price non-aggregation
const priced = normalizeFestivalDetail({
  festival_id: 'fest_3', name: '가격 테스트', start_date: today, end_date: today, status: 'PUBLISHED',
  programs: [
    {program_name: 'A', start_date: today, price: {amount: 5000, unit: '1인'}},
    {program_name: 'B', start_date: today, price: {amount: 3000, unit: '1인'}},
  ],
});
assert.ok(!('totalPrice' in priced) && !('total_price' in priced) && !('priceTotal' in priced),
  'a festival detail must never carry an aggregated price across programs');
for (const program of priced.programs) {
  assert.ok(!('totalPrice' in program), 'a single program must never carry a cross-program total either');
}

// -------------------------------------------------- no-fixture-in-production
const clientSource = readFileSync(path.join(ROOT, 'site-festival-client.js'), 'utf8');
assert.doesNotMatch(clientSource, /FESTIVAL_API_ENABLED/, 'the fixture on/off flag must be fully removed, not just disabled');
assert.doesNotMatch(clientSource, /FESTIVAL_FIXTURES/, 'no fixture generator may remain in the production client');
assert.doesNotMatch(clientSource, /fest_ongoing_river|fest_weekend_night_market|fest_upcoming_far/, 'no sample fixture data may remain');

console.log('FESTIVAL PUBLIC BOUNDARY VALIDATION PASS — real browse/regions/detail Core contract, allowlist normalizer boundary (browse + detail), price non-aggregation, current-region classification, and no-fixture-in-production verified.');
