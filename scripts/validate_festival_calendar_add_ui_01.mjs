// FESTIVAL-EVENT-10 — "내 캘린더에 추가" UI: structural/accessibility
// contract and no-fake-data guarantees. Static source assertions, no
// browser, the same approach as scripts/validate_festival_nav_wiring_01.mjs.
// (A full Chromium-driven interaction test for the date-tab bar and the
// visit-date bottom sheet is not included here — see the room report;
// scripts/validate_festival_calendar_link_01.mjs covers every code path
// this UI calls into.)
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = readFileSync(path.join(ROOT, 'site-festival-ui.js'), 'utf8');

// ---------------------------------------------------------- date tab bar --
assert.match(ui, /tabs\.setAttribute\('role', 'tablist'\)/, 'program dates must be a tablist, not a plain list');
assert.match(ui, /tab\.setAttribute\('role', 'tab'\)/);
assert.match(ui, /tab\.setAttribute\('aria-selected', String\(date === selectedDate\)\)/, 'the selected date tab must be conveyed to assistive tech, not only by color');
assert.match(ui, /event\.key !== 'ArrowRight' && event\.key !== 'ArrowLeft'/, 'the date tab bar must support arrow-key navigation');

// -------------------------------------------------------- utility action --
assert.match(ui, /trigger\.textContent = '\+ 내 캘린더에 추가'/, 'the add-to-Calendar action must exist as its own utility action');
assert.doesNotMatch(ui, /festival-calendar-add-trigger[^\n]*primary/, 'the add-to-Calendar trigger must not be folded into a primary CTA group');
assert.match(ui, /festivalCalendarAddEligible/, 'ENDED/CANCELLED festivals must gate the add action off');
assert.match(ui, /status !== FESTIVAL_STATUS\.ENDED && status !== FESTIVAL_STATUS\.CANCELLED/);

// ------------------------------------------------------------- the sheet --
assert.match(ui, /dialog\.setAttribute\('role', 'dialog'\)/);
assert.match(ui, /dialog\.setAttribute\('aria-modal', 'true'\)/);
assert.match(ui, /optionsList\.setAttribute\('role', 'radiogroup'\)/, 'the date/전체 기간 choice must be a radiogroup');
assert.match(ui, /option\.setAttribute\('aria-checked'/, 'each visit-date choice must expose aria-checked');
assert.match(ui, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); closeSheet\(\); \}/, 'Escape must close the visit-date sheet');
assert.match(ui, /closeButton\.setAttribute\('aria-label', '닫기'\)/);
assert.match(ui, /addOption\('전체 기간', \{scope: VISIT_SCOPE\.FULL_RANGE, date: null\}/, 'the sheet must offer a 전체 기간 option distinct from any single date');

// ----------------------------------------------------------- feedback UX --
assert.match(ui, /'캘린더에 추가했어요\.'/, 'success feedback copy must exist');
assert.match(ui, /'이미 캘린더에 추가되어 있어요\.'/, 'duplicate feedback copy must exist, never a silent second entry');
assert.match(ui, /'캘린더에 추가하지 못했어요\. 다시 시도해 주세요\.'/, 'failure feedback must offer a retry, not just an error');
assert.match(ui, /feedback\.setAttribute\('role', isError \? 'alert' : 'status'\)/, 'success must be role=status and failure must be role=alert');

// ------------------------------------------------------------ no fake data --
assert.doesNotMatch(ui, /entry\s*=\s*\{[^}]*amount_minor:\s*(?!null)/, 'a festival visit must never auto-record a non-null expense amount');
assert.match(ui, /addFestivalVisitToCalendar\(\{festival, visitDate, visitScope, authenticated, sessionToken, guestRepository\}\)/,
  'the UI must delegate the write to site-festival-calendar.js, never invent its own Calendar storage');

console.log('FESTIVAL CALENDAR ADD UI VALIDATION PASS — date-tab tablist a11y, utility-action placement, visit-date sheet a11y/ESC, feedback copy+roles, and no-fake-expense contract verified.');
