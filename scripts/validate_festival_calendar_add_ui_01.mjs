// FESTIVAL-EVENT-10 (revised) — "📅 일정 등록" UI: structural/accessibility
// contract and no-fake-data guarantees. Static source assertions, no
// browser, the same approach as scripts/validate_festival_nav_wiring_01.mjs.
// Only covers this room's own additions to site-festival-ui.js — the
// program date-tab bar (buildDateTabs/tablist) and the [프로그램]/[접수]
// CTA row are FESTIVAL-EVENT-08's, already covered by its own tests.
//
// Revision note: the visit-date picker used to be a day-by-day radiogroup
// (one button per date in the festival's run, up to hundreds for a long
// festival) plus a separate "전체 기간" option. It is now a compact month
// grid (calendarMonthGrid(), the same pure cell generator the main Calendar
// view uses) with prev/next navigation and out-of-range dates disabled —
// see scripts/validate_festival_calendar_link_01.mjs for the underlying
// addFestivalVisitToCalendar()/festivalVisitDateOptions() contract, which
// this UI still delegates to unchanged.
//
// (A full Chromium-driven interaction test for the schedule sheet is not
// included here — see scripts/validate_festival_event_08_responsive_a11y_01.mjs,
// which renders the actual card/detail surfaces, and
// scripts/validate_festival_calendar_link_01.mjs, which covers every write/
// dedup code path this UI calls into.)
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = readFileSync(path.join(ROOT, 'site-festival-ui.js'), 'utf8');

// -------------------------------------------------------- reuse, not a fork --
assert.match(ui, /import \{\s*VISIT_SCOPE,\s*addFestivalVisitToCalendar,\s*festivalVisitDateOptions,\s*\} from '\.\/site-festival-calendar\.js/,
  'the add-to-Calendar UI must delegate the write to site-festival-calendar.js, never invent its own Calendar storage');
assert.match(ui, /import \{createGuestCalendarRepository\} from '\.\/site-calendar-guest\.js/);
assert.match(ui, /import \{calendarMonthGrid\} from '\.\/site-calendar-model\.js/,
  'the month picker must reuse the main Calendar\'s own pure cell generator, never a second date-grid implementation');

// -------------------------------------------------------- utility action --
assert.match(ui, /trigger\.textContent = '📅 일정 등록'/, 'the add-to-Calendar action must exist as its own utility action');
const ctaRowMatch = /function buildCtaRow\([\s\S]*?\r?\n\}\r?\n/.exec(ui);
assert.ok(ctaRowMatch, 'buildCtaRow() must exist');
assert.doesNotMatch(ctaRowMatch[0], /festival-calendar-add/, 'the add-to-Calendar trigger must not be folded into buildCtaRow()\'s primary [접수]/[프로그램] CTA group');
assert.match(ui, /function festivalCalendarAddEligible\(festival, now\) \{/, 'ENDED/CANCELLED festivals must gate the add action off');
assert.match(ui, /status !== FESTIVAL_STATUS\.ENDED && status !== FESTIVAL_STATUS\.CANCELLED/);
assert.match(ui, /if \(autoOpenProgram && festival\.programs\.length\) openProgramSurface\(festival, detailToken\);/,
  'Calendar re-entry must land on the program screen, not just the detail with a CTA button to click again');

// ------------------------------------------------------------- the popup --
assert.match(ui, /createBottomSheet\(\{\s*label: '일정 등록',/, 'the schedule picker must open through the shared bottom-sheet primitive, like every other festival popup');
assert.match(ui, /wrap\.appendChild\(el\('p', 'festival-schedule-sheet-name', festival\.name\)\)/,
  '축제명 자동 입력: the popup must display the festival\'s own name, never a placeholder');
assert.match(ui, /wrap\.appendChild\(el\('p', 'festival-schedule-sheet-period', formatFestivalPeriod\(festival\)\)\)/,
  '축제기간 자동 입력: the popup must display the festival\'s own period, never a placeholder');

// The old per-day radiogroup/전체 기간 option must be gone from the picker
// itself. VISIT_SCOPE.FULL_RANGE and a mention of a pre-existing 전체 기간
// visit are still allowed to exist elsewhere (site-festival-calendar.js still
// supports reading back an old entry saved that way before this change, and
// renderDetail()'s Calendar re-entry comment describes that fallback) — this
// only forbids the *picker* from offering a new 전체 기간 choice again.
const scheduleGridBodyMatch = /function buildScheduleGridBody\([\s\S]*?\r?\n\}\r?\n/.exec(ui);
assert.ok(scheduleGridBodyMatch, 'buildScheduleGridBody() must exist');
const scheduleGridBody = scheduleGridBodyMatch[0];
assert.doesNotMatch(scheduleGridBody, /role', 'radiogroup'/, 'the day-by-day radiogroup picker must be removed');
assert.doesNotMatch(scheduleGridBody, /전체 기간/, 'the picker must not offer a 전체 기간 (whole-range) choice any more');
assert.doesNotMatch(scheduleGridBody, /VISIT_SCOPE\.FULL_RANGE/, 'the picker must only ever produce a single chosen date now, never the whole-range scope');

// Month grid: real cell generator, prev/next navigation, out-of-range dates disabled.
assert.match(ui, /calendarMonthGrid\(viewYear, viewMonth\)/, 'the picker must render real month cells, never a fabricated grid');
assert.match(ui, /prevButton\.disabled = viewYear === startYear && viewMonth === startMonth;/,
  'navigating before the festival\'s first month must be impossible, not just visually discouraged');
assert.match(ui, /nextButton\.disabled = viewYear === endYear && viewMonth === endMonth;/,
  'navigating past the festival\'s last month must be impossible');
assert.match(ui, /const inRange = validDateSet\.has\(cell\.date\);/, 'each cell\'s selectability must be checked against the real festival date set');
assert.match(ui, /button\.disabled = true;\s*button\.setAttribute\('aria-disabled', 'true'\);/,
  'a date outside the festival period must be a real disabled control, not just dimmed styling a screen reader would miss');
assert.match(ui, /grid\.setAttribute\('role', 'grid'\)/, 'the picker must expose a grid role for assistive tech');

// One valid date per cell, never a fabricated one — same underlying set
// festivalVisitDateOptions()/addFestivalVisitToCalendar() itself accepts.
assert.match(ui, /const validDates = festivalVisitDateOptions\(festival\);/,
  'the picker\'s valid-date set must come from the same function addFestivalVisitToCalendar() validates against, never a re-derived range');

// ----------------------------------------------------------- feedback UX --
assert.match(ui, /'일정을 등록했어요\.'/, 'success feedback copy must match the new wording exactly');
assert.doesNotMatch(ui, /'캘린더에 추가했어요\.'/, 'the old success copy must not remain alongside the new one');
assert.match(ui, /'이미 캘린더에 추가되어 있어요\.'/, 'duplicate feedback copy must exist, never a silent second entry');
assert.match(ui, /'캘린더에 추가하지 못했어요\. 다시 시도해 주세요\.'/, 'failure feedback must offer a retry, not just an error');
assert.match(ui, /feedback\.setAttribute\('role', isError \? 'alert' : 'status'\)/, 'success must be role=status and failure must be role=alert');

// ------------------------------------------------------------ no fake data --
assert.doesNotMatch(ui, /entry\s*=\s*\{[^}]*amount_minor:\s*(?!null)/, 'a festival visit must never auto-record a non-null expense amount');
assert.match(ui, /addFestivalVisitToCalendar\(\{festival, visitDate, visitScope: VISIT_SCOPE\.DATE, authenticated, sessionToken, guestRepository\}\)/,
  'the UI must delegate the write to site-festival-calendar.js, never invent its own Calendar storage');

console.log('FESTIVAL CALENDAR ADD UI VALIDATION PASS — reuse-not-fork imports, utility-action placement/eligibility, re-entry auto-open, month-grid picker (real cells, clamped navigation, disabled out-of-range dates, single real valid date per cell), feedback copy+roles, and no-fake-expense contract verified.');
