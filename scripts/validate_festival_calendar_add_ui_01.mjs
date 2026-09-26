// FESTIVAL-EVENT-10 — "내 캘린더에 추가" UI: structural/accessibility
// contract and no-fake-data guarantees. Static source assertions, no
// browser, the same approach as scripts/validate_festival_nav_wiring_01.mjs.
// Only covers this room's own additions to site-festival-ui.js — the
// program date-tab bar (buildDateTabs/tablist) and the [프로그램]/[체험·신청]
// CTA row are FESTIVAL-EVENT-08's, already covered by its own tests.
//
// (A full Chromium-driven interaction test for the visit-date bottom sheet
// is not included here — see the room report; scripts/validate_festival_
// calendar_link_01.mjs covers every code path this UI calls into.)
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

// -------------------------------------------------------- utility action --
assert.match(ui, /trigger\.textContent = '\+ 내 캘린더에 추가'/, 'the add-to-Calendar action must exist as its own utility action');
const ctaRowMatch = /function buildCtaRow\([\s\S]*?\n\}\n/.exec(ui);
assert.ok(ctaRowMatch, 'buildCtaRow() must exist');
assert.doesNotMatch(ctaRowMatch[0], /festival-calendar-add/, 'the add-to-Calendar trigger must not be folded into buildCtaRow()\'s primary [프로그램]/[체험·신청] CTA group');
assert.match(ui, /function festivalCalendarAddEligible\(festival, now\) \{/, 'ENDED/CANCELLED festivals must gate the add action off');
assert.match(ui, /status !== FESTIVAL_STATUS\.ENDED && status !== FESTIVAL_STATUS\.CANCELLED/);
assert.match(ui, /if \(autoOpenProgram && festival\.programs\.length\) openProgramSurface\(festival, detailToken\);/,
  'Calendar re-entry must land on the program screen, not just the detail with a CTA button to click again');

// ------------------------------------------------------------- the sheet --
assert.match(ui, /dialog\.setAttribute\('role', 'dialog'\)/);
assert.match(ui, /dialog\.setAttribute\('aria-modal', 'true'\)/);
assert.match(ui, /optionsList\.setAttribute\('role', 'radiogroup'\)/, 'the date/전체 기간 choice must be a radiogroup');
assert.match(ui, /option\.setAttribute\('aria-checked'/, 'each visit-date choice must expose aria-checked');
assert.match(ui, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); closeSheet\(\); \}/, 'Escape must close the visit-date sheet');
assert.match(ui, /closeButton\.setAttribute\('aria-label', '닫기'\)/);
assert.match(ui, /addOption\('전체 기간', \{scope: VISIT_SCOPE\.FULL_RANGE, date: null\}/, 'the sheet must offer a 전체 기간 option distinct from any single date');
assert.match(ui, /for \(const date of festivalVisitDateOptions\(festival\)\) \{/, 'the sheet must offer one option per real festival date, never a fabricated one');

// ----------------------------------------------------------- feedback UX --
assert.match(ui, /'캘린더에 추가했어요\.'/, 'success feedback copy must exist');
assert.match(ui, /'이미 캘린더에 추가되어 있어요\.'/, 'duplicate feedback copy must exist, never a silent second entry');
assert.match(ui, /'캘린더에 추가하지 못했어요\. 다시 시도해 주세요\.'/, 'failure feedback must offer a retry, not just an error');
assert.match(ui, /feedback\.setAttribute\('role', isError \? 'alert' : 'status'\)/, 'success must be role=status and failure must be role=alert');

// ------------------------------------------------------------ no fake data --
assert.doesNotMatch(ui, /entry\s*=\s*\{[^}]*amount_minor:\s*(?!null)/, 'a festival visit must never auto-record a non-null expense amount');
assert.match(ui, /addFestivalVisitToCalendar\(\{festival, visitDate, visitScope, authenticated, sessionToken, guestRepository\}\)/,
  'the UI must delegate the write to site-festival-calendar.js, never invent its own Calendar storage');

console.log('FESTIVAL CALENDAR ADD UI VALIDATION PASS — reuse-not-fork imports, utility-action placement/eligibility, re-entry auto-open, visit-date sheet a11y/ESC, feedback copy+roles, and no-fake-expense contract verified.');
