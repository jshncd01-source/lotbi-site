// FESTIVAL-EVENT-08 — consumer detail screen: CTA visibility, internal
// [프로그램] date-tab structure, program ordering, KST weekday correctness,
// and the participation-link security boundary.
//
// Pure-function tests against site-festival-client.js (no DOM/browser — this
// repo's Node validate scripts never spin up jsdom; DOM-shape/CTA-gating
// logic is instead verified as a static-source check against
// site-festival-ui.js, mirroring scripts/validate_festival_nav_wiring_01.mjs).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(path.join(ROOT, 'site-festival-client.js'));
const festivalUiJs = readFileSync(path.join(ROOT, 'site-festival-ui.js'), 'utf8');

const {
  normalizeFestivalProgram,
  normalizePublishedFestival,
  groupProgramsByDate,
  expandProgramDateRange,
  selectInitialProgramDate,
  festivalWeekdayKST,
  formatFestivalDateTabLabel,
  sortFestivalPrograms,
  todayLocalDate,
  addLocalDays,
} = client;

const today = todayLocalDate(new Date());
const at = days => addLocalDays(today, days);

// ---------------------------------------------------- program allowlist ---
const programAllowlist = ['key', 'title', 'category', 'startDate', 'endDate', 'startTime', 'endTime', 'venue', 'price', 'notes', 'participationUrl'];
const normalizedProgram = normalizeFestivalProgram({
  program_name: '개막 공연',
  category: '공연',
  start_date: today,
  end_date: today,
  start_time: '19:00',
  end_time: '21:00',
  venue: '중앙광장',
  price: '무료',
  reservation_type: 'ADVANCE', // must never surface as-is anywhere
  reservation_start: '2026-09-01',
  reservation_end: '2026-09-30',
  capacity: '200',
  reservation_url: 'https://example.com/reserve',
  notes: '우천시 실내로 이동',
}, 0);
assert.deepEqual(Object.keys(normalizedProgram).sort(), programAllowlist.sort(),
  'a normalized program must expose exactly the allowlisted fields — reservation_type/reservation_start/reservation_end/capacity must never leak through');
assert.equal(normalizedProgram.participationUrl, 'https://example.com/reserve');

// program_name missing -> dropped entirely
assert.equal(normalizeFestivalProgram({category: '공연'}), null);

// non-https reservation_url must never become a participation URL
const insecureProgram = normalizeFestivalProgram({program_name: 'X', reservation_url: 'http://example.com/reserve'});
assert.equal(insecureProgram.participationUrl, '', 'a non-https reservation_url must never be exposed as a participation link');

// ------------------------------------------------------------- CTA logic --
// [체험·신청] must resolve to the first ACTIVE program (Core's own order) that
// actually carries a real https reservation_url — never fabricated, never a
// festival-level field that doesn't exist in the real Core contract.
function detailWith(programs) {
  return normalizePublishedFestival({
    festival_id: 'fest_cta', name: '테스트', start_date: today, end_date: today, region_name: '서울특별시',
    programs,
  }, {includePrograms: true});
}

const noPrograms = detailWith([]);
assert.equal(noPrograms.programs.length, 0);
assert.equal(noPrograms.participationUrl, '', 'no programs -> no participation URL -> [체험·신청] must be hidden, and [프로그램] has nothing to show either');

const programsNoReservation = detailWith([
  {program_name: 'A', start_date: today, start_time: '10:00'},
  {program_name: 'B', start_date: today, start_time: '11:00'},
]);
assert.ok(programsNoReservation.programs.length > 0, '[프로그램] must be available — programs exist');
assert.equal(programsNoReservation.participationUrl, '', '[체험·신청] must be hidden — no program carries a reservation_url');

const programsWithReservation = detailWith([
  {program_name: 'A', start_date: today, start_time: '10:00'},
  {program_name: 'B', start_date: today, start_time: '11:00', reservation_url: 'https://example.com/join'},
]);
assert.equal(programsWithReservation.participationUrl, 'https://example.com/join', 'both CTAs available: [프로그램] (programs exist) and [체험·신청] (a real reservation_url exists)');

// buildCtaRow's actual gating conditions, read statically from the UI source
// (no DOM harness in this repo's Node tests — see file header).
assert.match(festivalUiJs, /festival\.programs\.length > 0/, 'the [프로그램] CTA must gate on programs.length > 0');
assert.match(festivalUiJs, /Boolean\(festival\.participationUrl\)/, 'the [체험·신청] CTA must gate on a real participationUrl');
assert.match(festivalUiJs, /if \(!hasPrograms && !hasParticipation\) return null;/,
  'when neither CTA applies, the CTA row must not render at all (no empty shell)');

// -------------------------------------------------------- date-tab grouping
// 3 real days -> exactly 3 tabs, no fake ones.
const threeDayTabs = groupProgramsByDate([
  normalizeFestivalProgram({program_name: 'D1', start_date: at(0), start_time: '10:00'}),
  normalizeFestivalProgram({program_name: 'D2', start_date: at(1), start_time: '10:00'}),
  normalizeFestivalProgram({program_name: 'D3', start_date: at(2), start_time: '10:00'}),
]);
assert.equal(threeDayTabs.length, 3);
assert.deepEqual(threeDayTabs.map(t => t.date), [at(0), at(1), at(2)]);

// 5 real days -> exactly 5 tabs.
const fiveDayTabs = groupProgramsByDate([0, 1, 2, 3, 4].map(offset =>
  normalizeFestivalProgram({program_name: `D${offset}`, start_date: at(offset), start_time: '10:00'})));
assert.equal(fiveDayTabs.length, 5);

// A program with no start_date at all must never fabricate a tab.
const dateless = groupProgramsByDate([normalizeFestivalProgram({program_name: 'no date'})]);
assert.equal(dateless.length, 0, 'a program without a start_date must never produce a fake date tab');

// Multi-day range program: must appear on every day it actually runs.
const rangeProgram = normalizeFestivalProgram({program_name: '상설 체험', start_date: at(0), end_date: at(2), start_time: '10:00'});
const rangeExpanded = expandProgramDateRange(rangeProgram);
assert.deepEqual(rangeExpanded, [at(0), at(1), at(2)]);
const rangeTabs = groupProgramsByDate([rangeProgram]);
assert.equal(rangeTabs.length, 3, 'a 3-day multi-day program must produce a tab for each of its 3 days');
for (const tab of rangeTabs) {
  assert.equal(tab.programs.length, 1);
  assert.equal(tab.programs[0].title, '상설 체험');
}

// start_time ascending within a day; missing time sorts after; ties keep
// original (Core) order rather than being re-derived alphabetically.
const orderedTabs = groupProgramsByDate([
  normalizeFestivalProgram({program_name: '늦은 시간', start_date: at(0), start_time: '15:00'}, 0),
  normalizeFestivalProgram({program_name: '시간없음', start_date: at(0)}, 1),
  normalizeFestivalProgram({program_name: '이른 시간', start_date: at(0), start_time: '09:00'}, 2),
  normalizeFestivalProgram({program_name: '동시각-B', start_date: at(0), start_time: '09:00'}, 3),
]);
assert.deepEqual(orderedTabs[0].programs.map(p => p.title),
  ['이른 시간', '동시각-B', '늦은 시간', '시간없음'],
  'ascending start_time, ties preserve original order, missing time sorts to the end');

// sortFestivalPrograms: global date+time order, same tie-preservation rule.
const flatSorted = sortFestivalPrograms([
  normalizeFestivalProgram({program_name: 'Z', start_date: at(1), start_time: '09:00'}, 0),
  normalizeFestivalProgram({program_name: 'A', start_date: at(0), start_time: '09:00'}, 1),
]);
assert.deepEqual(flatSorted.map(p => p.title), ['A', 'Z']);

// -------------------------------------------------------------- KST weekday
// Pure calendar-date weekday math must never depend on the caller's runtime
// timezone (only a UTC-instant-to-date derivation could get this wrong, and
// festivalWeekdayKST never takes an instant, only a Y-M-D string).
assert.equal(festivalWeekdayKST('2026-10-08'), '목');
assert.equal(festivalWeekdayKST('2026-10-11'), '일');
assert.equal(formatFestivalDateTabLabel('2026-10-08'), '10/8 목');
assert.equal(formatFestivalDateTabLabel('not-a-date'), '');

// ------------------------------------------------- selected-date priority --
const tabs = [{date: at(0)}, {date: at(1)}, {date: at(2)}];
assert.equal(selectInitialProgramDate(tabs, {selectedDate: at(1), now: new Date()}), at(1),
  'an explicit selectedDate (FESTIVAL-EVENT-10 visit-date hook) must win when it is one of the real tab dates');
assert.equal(selectInitialProgramDate(tabs, {selectedDate: at(99), now: new Date()}), at(0),
  'a selectedDate outside the real tab dates must never be honored — falls back to the earliest tab');
assert.equal(selectInitialProgramDate(tabs), at(0), 'with no context at all, the earliest real program date is selected');
assert.equal(selectInitialProgramDate([]), '', 'no tabs at all must resolve to an empty selection, never throw');

// ---------------------------------------------------- weather-ready hook --
assert.match(festivalUiJs, /data-festival-program-date/,
  'each date tab must carry a stable date identity attribute for FESTIVAL-EVENT-09 (weather) to join on');
assert.doesNotMatch(festivalUiJs, /fetch\([^)]*(?:kma|weather)/i,
  'this room must never fetch weather data — that is FESTIVAL-EVENT-09 only');

// -------------------------------------------------------- loading/error copy
assert.match(festivalUiJs, /축제·행사 정보를 불러오는 중이에요\./);
assert.match(festivalUiJs, /축제·행사 정보를 불러오지 못했어요\./);
assert.match(festivalUiJs, /축제·행사 정보를 찾을 수 없어요\./);

console.log('FESTIVAL-EVENT-08 DETAIL VALIDATION PASS — program allowlist boundary, CTA visibility gating, real date-tab grouping (3/5-day, multi-day range, no fake tabs), start_time ordering with stable ties, KST weekday labels, selected-date priority, weather/calendar hooks structure-only, and loading/error copy verified.');
