// FESTIVAL-07 — public "축제" browse: domain-logic and PUBLISHED-only boundary.
//
// Pure-function tests against site-festival-client.js, following the same
// approach as scripts/validate_calendar_real_ui_01.mjs: no browser, import
// the exported functions directly and assert on their return shape.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(path.join(ROOT, 'site-festival-client.js'));

const {
  FESTIVAL_STATUS,
  computeFestivalStatus,
  festivalIncludesWeekend,
  festivalIncludesDate,
  listPublishedFestivals,
  getPublishedFestival,
  listFestivalRegions,
  normalizePublishedFestival,
  normalizeFestivalProgram,
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
  {id: 'b', date: today, startTime: '10:00', title: 'B'},
  {id: 'a', date: today, startTime: '09:00', title: 'A'},
  {id: 'c', date: addLocalDays(today, -1), startTime: '23:00', title: 'C'},
]);
assert.deepEqual(sorted.map(p => p.id), ['c', 'a', 'b'], 'programs must sort by date then start time');

// ------------------------------------------------- default/explicit lists --
const defaultList = await listPublishedFestivals();
assert.ok(defaultList.length > 0, 'default view must not be empty against the fixture set');
for (const festival of defaultList) {
  assert.notEqual(computeFestivalStatus(festival, now), FESTIVAL_STATUS.ENDED,
    'default (no-filter) view must never include an ENDED festival');
}
assert.ok(defaultList.every((f, i) => i === 0 || f.startDate >= defaultList[i - 1].startDate
  || computeFestivalStatus(f, now) !== computeFestivalStatus(defaultList[i - 1], now)),
  'default list should be date-ordered within each status group');

const farFuture = defaultList.find(f => f.id === 'fest_upcoming_far');
assert.equal(farFuture, undefined, 'a festival >60 days out must be excluded from the default near-term window');

const explicitRegion = await listPublishedFestivals({region: '부산광역시'});
assert.ok(explicitRegion.some(f => f.id === 'fest_upcoming_far'),
  'an explicit region filter must reach beyond the default near-term window');
assert.ok(explicitRegion.every(f => f.region === '부산광역시'), 'region filter must only return that region');

const ongoingOnly = await listPublishedFestivals({status: 'ONGOING'});
assert.ok(ongoingOnly.every(f => computeFestivalStatus(f, now) === FESTIVAL_STATUS.ONGOING));
assert.ok(!ongoingOnly.some(f => f.cancelled), '진행중 filter must never surface a cancelled festival');

const missing = await getPublishedFestival('does-not-exist');
assert.equal(missing, null, 'an unknown id must resolve to null, not throw or leak a partial object');

// ------------------------------------------------ region contract (live) --
const liveRegions = await listFestivalRegions(async () => ({ok: true, json: async () => ({provinces: ['A', 'B']})}));
assert.deepEqual(liveRegions, {provinces: ['A', 'B'], source: 'LIVE'});
const fallbackRegions = await listFestivalRegions(async () => { throw new Error('network down'); });
assert.equal(fallbackRegions.source, 'FALLBACK');
assert.equal(fallbackRegions.provinces.length, 17, 'region fallback must carry all 17 시·도');
assert.equal(new Set(fallbackRegions.provinces).size, 17, 'region fallback must not repeat a province');

// ---------------------------------------------- PUBLISHED-only boundary ---
// The allowlist normalizer is the enforced public/private boundary: an
// unlisted key on the input must never survive into the object this client
// hands to site-festival-ui.js, no matter what a future FESTIVAL-06 response
// happens to include.
const FORBIDDEN_KEYS = [
  'status', 'workflow_status', 'candidate_id', 'admin_id', 'reviewer_id',
  'confidence', 'ai_prompt', 'private_pdf_url', 'storage_key', 'audit_note',
  'source_raw_payload', 'internal_notes',
];
const poisoned = {
  id: 'fest_poisoned',
  name: '테스트 축제',
  startDate: today,
  endDate: today,
  region: '서울특별시',
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
  programs: [{
    id: 'prog_poisoned', title: '프로그램', date: today,
    confidence: 0.9, admin_id: 'admin_1', ai_prompt: 'leak me',
  }],
  reservation: {type: 'NONE', admin_id: 'admin_2'},
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
assert.ok(!Object.keys(normalizedFestival.reservation).includes('admin_id'),
  'reservation normalizer must drop unknown fields too');

// A DRAFT-shaped record missing required PUBLISHED fields (no id/name/dates)
// must normalize to null rather than a half-filled object reaching the UI.
assert.equal(normalizePublishedFestival({status: 'DRAFT', name: '미승인 축제'}), null);
assert.equal(normalizePublishedFestival({id: 'x', name: 'x', startDate: today, endDate: addLocalDays(today, -1), region: '서울특별시'}), null,
  'endDate before startDate must be rejected, not silently accepted');

// ----------------------------------------------------- price non-aggregation
const detail = await getPublishedFestival('fest_ongoing_river');
assert.ok(!('totalPrice' in detail) && !('total_price' in detail) && !('priceTotal' in detail),
  'a festival detail must never carry an aggregated price across programs');
const pricedPrograms = detail.programs.filter(p => p.price);
assert.ok(pricedPrograms.length >= 1, 'fixture must include at least one priced program to exercise this check');
for (const program of detail.programs) {
  assert.ok(!('totalPrice' in program), 'a single program must never carry a cross-program total either');
}

console.log('FESTIVAL PUBLIC BOUNDARY VALIDATION PASS — status/weekend/date logic, default near-term window, region contract fallback, PUBLISHED-only normalizer boundary, and price non-aggregation verified.');
