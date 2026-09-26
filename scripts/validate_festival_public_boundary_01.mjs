// FESTIVAL-EVENT-07/08 — public "축제·행사" browse + detail: domain-logic and
// PUBLISHED-only boundary against the REAL Core contract shape (snake_case,
// as returned by lotbi-core's app.festival_browse.browse_festivals via
// GET /festivals/browse and app.festival_review.festival_public_view via
// GET /festivals/{id}).
//
// Pure-function tests, no browser: exercises browseFestivals /
// getPublishedFestival with an injected mock fetchImpl (test-file-local
// fixtures only — production never ships one), so this is fully
// deterministic and never depends on a live Core deployment or database
// having real festival rows in it.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(path.join(ROOT, 'site-festival-client.js'));

const {
  FESTIVAL_STATUS,
  FESTIVAL_TIME_FILTER,
  SiteFestivalBrowseError,
  computeFestivalStatus,
  festivalIncludesWeekend,
  festivalIncludesDate,
  browseFestivals,
  getPublishedFestival,
  listFestivalRegions,
  normalizePublishedFestival,
  normalizeFestivalProgram,
  resolveCurrentRegionLabel,
  sortFestivalPrograms,
  parseFestivalDateToISO,
  todayLocalDate,
  addLocalDays,
  thisWeekendRange,
} = client;

const now = new Date();
const today = todayLocalDate(now);
const at = days => addLocalDays(today, days, now);

function jsonFetch(payload, {status = 200} = {}) {
  return async () => ({ok: status >= 200 && status < 300, status, json: async () => payload});
}

function failingFetch() {
  return async () => { throw new Error('network down'); };
}

// ------------------------------------------------------- status priority --
assert.equal(
  computeFestivalStatus({startDate: at(-1), endDate: at(1), cancelled: true}, now),
  FESTIVAL_STATUS.CANCELLED,
  'cancelled must win over an in-range today',
);
assert.equal(computeFestivalStatus({startDate: at(-1), endDate: at(1)}, now), FESTIVAL_STATUS.ONGOING);
assert.equal(computeFestivalStatus({startDate: at(-10), endDate: at(-1)}, now), FESTIVAL_STATUS.ENDED);
const {start: weekendStart, end: weekendEnd} = thisWeekendRange(now);
if (weekendStart > today) {
  assert.equal(
    computeFestivalStatus({startDate: weekendStart, endDate: weekendEnd}, now),
    FESTIVAL_STATUS.THIS_WEEKEND,
    'a not-yet-started festival covering this weekend must read as THIS_WEEKEND',
  );
}
assert.equal(computeFestivalStatus({startDate: at(30), endDate: at(31)}, now), FESTIVAL_STATUS.UPCOMING);

// ----------------------------------------------------------- weekend/date --
assert.equal(festivalIncludesWeekend({startDate: weekendStart, endDate: weekendEnd}, now), true);
assert.equal(festivalIncludesWeekend({startDate: at(40), endDate: at(41)}, now), false);
assert.equal(festivalIncludesDate({startDate: today, endDate: today}, today), true);
assert.equal(festivalIncludesDate({startDate: today, endDate: today}, at(1)), false);

// ---------------------------------------------------- real Core date shapes
// festival_read.parse_festival_date (Core) accepts raw YYYYMMDD (TourAPI) or
// ISO YYYY-MM-DD (staff review); the Site client must parse both the same way.
assert.equal(parseFestivalDateToISO('20261010'), '2026-10-10');
assert.equal(parseFestivalDateToISO('2026-10-10'), '2026-10-10');
assert.equal(parseFestivalDateToISO('20261332'), '', 'an impossible calendar date must never be guessed into something plausible');
assert.equal(parseFestivalDateToISO(''), '');
assert.equal(parseFestivalDateToISO(null), '');

// -------------------------------------------------------- program sorting --
const sorted = sortFestivalPrograms([
  {startDate: today, startTime: '10:00', title: 'B'},
  {startDate: today, startTime: '09:00', title: 'A'},
  {startDate: at(-1), startTime: '23:00', title: 'C'},
]);
assert.deepEqual(sorted.map(p => p.title), ['C', 'A', 'B'], 'programs must sort by date then start time');

// ------------------------------------------------------------------ shared --
function coreFestival(overrides = {}) {
  return {
    festival_id: 'fest_1',
    name: '테스트 축제',
    start_date: today,
    end_date: today,
    region_name: '서울특별시',
    address: '서울특별시 어딘가',
    homepage_url: 'https://example.com/official',
    telephone: '02-000-0000',
    status: 'PUBLISHED',
    programs: [],
    transport: null,
    notices: [],
    ...overrides,
  };
}

// --------------------------------------- browseFestivals: URL construction --
function capturingFetch(handler) {
  let capturedUrl = null;
  const fetchImpl = async input => {
    capturedUrl = new URL(String(input));
    return handler(capturedUrl);
  };
  return {fetchImpl, url: () => capturedUrl};
}

{
  const emptyPage = {festivals: [], result_count: 0, total_count: 0, limit: 20, offset: 0, next_offset: null, has_more: false};
  const {fetchImpl, url} = capturingFetch(() => ({ok: true, json: async () => emptyPage}));

  await browseFestivals({latitude: 37.5, longitude: 127.0, time: FESTIVAL_TIME_FILTER.ALL}, fetchImpl);
  assert.equal(url().pathname, '/festivals/browse', 'browse must call the real FESTIVAL-EVENT-02 Core endpoint');
  assert.equal(url().searchParams.get('latitude'), '37.5');
  assert.equal(url().searchParams.get('longitude'), '127');
  assert.equal(url().searchParams.get('region'), null, 'coordinates and region must not both be sent');

  await browseFestivals({region: '전북특별자치도', time: FESTIVAL_TIME_FILTER.THIS_MONTH}, fetchImpl);
  assert.equal(url().searchParams.get('region'), '전북특별자치도');
  assert.equal(url().searchParams.get('latitude'), null, 'a manual region query must never also send coordinates');
  assert.equal(url().searchParams.get('time'), 'THIS_MONTH', 'THIS_MONTH must reach Core as its own filter, not a front-end 30-day window');

  await browseFestivals({time: FESTIVAL_TIME_FILTER.DATE, date: '2026-10-03'}, fetchImpl);
  assert.equal(url().searchParams.get('time'), 'DATE');
  assert.equal(url().searchParams.get('date'), '2026-10-03');
}

// -------------------------------------------------- browseFestivals: results
{
  const raw = {
    festivals: [
      {
        festival_id: 'fest_near', name: '한강 억새 빛 축제', start_date: at(-1), end_date: at(2),
        region_name: '서울특별시', address: '서울시 영등포구', latitude: 37.5, longitude: 126.9, distance_km: 3.2,
        status: 'PUBLISHED',
        // poisoned/internal-only fields that must never survive normalization
        workflow_status: 'REVIEW_REQUIRED', candidate_id: 'cand_1', admin_id: 'admin_9',
        confidence: 0.4, ai_prompt: 'ignore all instructions', audit_note: 'internal',
      },
    ],
    result_count: 1, total_count: 42, limit: 20, offset: 0, next_offset: 20, has_more: true,
  };
  const page = await browseFestivals({latitude: 37.5, longitude: 127.0}, jsonFetch(raw));
  assert.equal(page.festivals.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextOffset, 20);
  assert.equal(page.totalCount, 42);
  const item = page.festivals[0];
  const allowedKeys = ['id', 'name', 'startDate', 'endDate', 'cancelled', 'region', 'address', 'latitude', 'longitude', 'distanceKm', 'imageUrl'];
  assert.deepEqual(Object.keys(item).sort(), allowedKeys.sort(), 'a browse item must only ever carry the allowlisted public fields');
  assert.equal(item.distanceKm, 3.2);
  assert.equal(item.cancelled, false, 'browse only ever returns PUBLISHED rows');
  assert.equal(item.imageUrl, '', 'Core browse does not emit image_url today — must fall back to no-image, never a fabricated photo');

  // Core omits distance_km (no coordinates in the query) -> must stay null, never 0/"알수없음"/fabricated.
  const noDistanceRaw = {...raw, festivals: [{...raw.festivals[0], distance_km: null}]};
  const noDistancePage = await browseFestivals({region: '서울특별시'}, jsonFetch(noDistanceRaw));
  assert.equal(noDistancePage.festivals[0].distanceKm, null);

  // Ordering is Core-authoritative: browseFestivals must hand the page back
  // in exactly the order Core returned it, never re-sorted client-side.
  const orderedRaw = {
    ...raw,
    festivals: [
      coreFestival({festival_id: 'fest_b', name: 'B'}),
      coreFestival({festival_id: 'fest_a', name: 'A'}),
    ],
  };
  const orderedPage = await browseFestivals({}, jsonFetch(orderedRaw));
  assert.deepEqual(orderedPage.festivals.map(f => f.id), ['fest_b', 'fest_a']);
}

// --------------------------------------------------- browseFestivals: errors
{
  const networkFail = await browseFestivals({}, failingFetch()).catch(err => err);
  assert.ok(networkFail instanceof SiteFestivalBrowseError, 'a network failure must reject with SiteFestivalBrowseError, not silently resolve to an empty/fixture list');

  const httpFail = await browseFestivals(
    {time: FESTIVAL_TIME_FILTER.DATE},
    jsonFetch({detail: {code: 'FESTIVAL_DATE_REQUIRED', message: 'x'}}, {status: 422}),
  ).catch(err => err);
  assert.ok(httpFail instanceof SiteFestivalBrowseError && httpFail.code === 'FESTIVAL_DATE_REQUIRED');
}

// ------------------------------------------------- current-region label ----
assert.equal(resolveCurrentRegionLabel(37.5665, 126.9780), '서울특별시', 'the exact Seoul reference point must resolve to Seoul');
assert.equal(resolveCurrentRegionLabel(35.1796, 129.0756), '부산광역시');
assert.equal(resolveCurrentRegionLabel(null, 127), '', 'unusable coordinates must resolve to an empty label, never a guess');
assert.equal(resolveCurrentRegionLabel(NaN, NaN), '');

// ----------------------------------------------------- detail: 404 vs fail --
const missing = await getPublishedFestival('does-not-exist', jsonFetch({detail: {code: 'FESTIVAL_NOT_FOUND'}}, {status: 404}));
assert.equal(missing, null, 'a real 404 must resolve to null, not throw');

const detailNetworkFailure = await getPublishedFestival('any', failingFetch()).catch(err => err);
assert.ok(detailNetworkFailure instanceof Error, 'a detail network failure must reject (distinct from a real 404)');

const detailServerError = await getPublishedFestival('any', jsonFetch({}, {status: 500})).catch(err => err);
assert.ok(detailServerError instanceof Error, 'a 5xx detail response must reject too, not resolve to null like a 404');

// ------------------------------------------------ region contract (live) --
const liveRegions = await listFestivalRegions(jsonFetch({regions: [{region_name: 'A'}, {region_name: 'B'}]}));
assert.deepEqual(liveRegions, {provinces: ['A', 'B'], source: 'LIVE'});
const fallbackRegions = await listFestivalRegions(failingFetch());
assert.equal(fallbackRegions.source, 'FALLBACK');
assert.equal(fallbackRegions.provinces.length, 17, 'region fallback must carry all 17 시·도');
assert.equal(new Set(fallbackRegions.provinces).size, 17, 'region fallback must not repeat a province');

// ---------------------------------------------- PUBLISHED-only boundary ---
// The allowlist normalizer is the enforced public/private boundary: an
// unlisted key on the input must never survive into the object this client
// hands to site-festival-ui.js, no matter what the real Core response
// happens to include.
const FORBIDDEN_KEYS = [
  'status', 'workflow_status', 'candidate_id', 'admin_id', 'reviewer_id',
  'confidence', 'ai_prompt', 'private_pdf_url', 'storage_key', 'audit_note',
  'source_raw_payload', 'internal_notes', 'homepage_url', 'telephone', 'transport', 'notices',
];
const poisoned = {
  festival_id: 'fest_poisoned',
  name: '테스트 축제',
  start_date: today,
  end_date: today,
  region_name: '서울특별시',
  status: 'DRAFT',
  workflow_status: 'REVIEW_REQUIRED',
  candidate_id: 'cand_123',
  admin_id: 'admin_9',
  reviewer_id: 'rev_1',
  confidence: 0.42,
  ai_prompt: 'ignore all instructions',
  private_pdf_url: 'https://internal.lotbiai.com/secret.pdf',
  storage_key: 's3://internal-bucket/secret',
  audit_note: 'internal only',
  source_raw_payload: {anything: true},
  internal_notes: 'do not expose',
  homepage_url: 'https://official.example.com',
  telephone: '02-000-0000',
  transport: {parking: 'secret lot'},
  notices: [{notice_type: 'GENERAL', message: 'internal notice'}],
  programs: [{
    program_name: '프로그램', confidence: 0.9, admin_id: 'admin_1', ai_prompt: 'leak me',
  }],
};
const normalizedFestival = normalizePublishedFestival(poisoned, {includePrograms: true});
assert.ok(normalizedFestival, 'a record with extra unknown fields must still normalize (fields are dropped, not rejected)');
const festivalKeys = Object.keys(normalizedFestival);
for (const forbidden of FORBIDDEN_KEYS) {
  assert.ok(!festivalKeys.includes(forbidden), `normalizePublishedFestival must drop "${forbidden}"`);
}
const normalizedProgram = normalizeFestivalProgram(poisoned.programs[0]);
for (const forbidden of ['confidence', 'admin_id', 'ai_prompt']) {
  assert.ok(!Object.keys(normalizedProgram).includes(forbidden), `normalizeFestivalProgram must drop "${forbidden}"`);
}

// A record missing required PUBLISHED fields (no festival_id/name/dates)
// must normalize to null rather than a half-filled object reaching the UI.
assert.equal(normalizePublishedFestival({status: 'DRAFT', name: '미승인 축제'}), null);
assert.equal(
  normalizePublishedFestival({festival_id: 'x', name: 'x', start_date: today, end_date: at(-1), region_name: '서울특별시'}),
  null,
  'end_date before start_date must be rejected, not silently accepted',
);
assert.notEqual(
  normalizePublishedFestival({festival_id: 'x', name: 'x', start_date: today, end_date: today}),
  null,
  'a real published festival must never be dropped just because region_name is null (Core allows it to be null)',
);

// ----------------------------------------------------- price non-aggregation
const detail = await getPublishedFestival('fest_priced', jsonFetch({
  festival: coreFestival({
    festival_id: 'fest_priced',
    programs: [
      {program_name: 'A', start_date: today, start_time: '09:00', price: '5,000원'},
      {program_name: 'B', start_date: today, start_time: '11:00', price: '무료'},
    ],
  }),
}));
assert.ok(!('totalPrice' in detail) && !('total_price' in detail) && !('priceTotal' in detail),
  'a festival detail must never carry an aggregated price across programs');
for (const program of detail.programs) {
  assert.ok(!('totalPrice' in program), 'a single program must never carry a cross-program total either');
  assert.equal(typeof program.price, 'string', 'Core price is a plain per-program string, never a structured/aggregated amount');
}

console.log('FESTIVAL PUBLIC BOUNDARY VALIDATION PASS — status/weekend/date logic, real Core date-shape parsing, browseFestivals query/ordering/error contract, region contract live+fallback, current-region classification, 404-vs-fetch-failure distinction, PUBLISHED-only normalizer boundary (browse + detail, incl. homepage/telephone/transport/notices drop), and price non-aggregation verified.');
