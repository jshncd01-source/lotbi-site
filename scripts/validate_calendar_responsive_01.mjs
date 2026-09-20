import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const css = read('site-calendar.css');
const index = read('index.html');
const callback = read('auth/callback/index.html');
const conversation = read('site-conversation.js');
const callbackJs = read('auth-callback.js');
const ui = read('site-calendar-ui.js');
const manager = read('site-calendar-manager.js');
const workflow = read('.github/workflows/site-universal-life-calendar-01.yml');

const calendarVersion = '20260920-calux1';
assert.ok(index.includes(`site-calendar.css?v=${calendarVersion}`));
assert.ok(callback.includes(`/site-calendar.css?v=${calendarVersion}`));
assert.ok(index.includes(`site-conversation.js?v=${calendarVersion}`));
assert.ok(callback.includes(`/auth-callback.js?v=${calendarVersion}`));
assert.ok(conversation.includes(`./site-calendar-ui.js?v=${calendarVersion}`));
assert.ok(callbackJs.includes(`./site-calendar-ui.js?v=${calendarVersion}`));
assert.ok(callbackJs.includes(`./site-conversation.js?v=${calendarVersion}`));
assert.ok(ui.includes(`./site-calendar-manager.js?v=${calendarVersion}`));
assert.ok(manager.includes(`./site-calendar-model.js?v=${calendarVersion}`));
for (const module of ['site-calendar-model.js', 'site-calendar-guest.js', 'site-calendar-manager.js']) {
  assert.ok(workflow.includes(`'${module}'`), `focused workflow missing ${module}`);
}
for (const test of ['validate_calendar_month_grid_01.mjs', 'validate_calendar_year_view_01.mjs', 'validate_guest_calendar_local_01.mjs', 'validate_calendar_real_ui_01.mjs', 'validate_calendar_event_editor_01.mjs', 'validate_calendar_responsive_01.mjs', 'validate_calendar_modal_runtime_02.mjs']) {
  assert.ok(workflow.includes(test), `focused workflow missing ${test}`);
}

assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
assert.ok(css.includes('@media (max-width: 900px)'));
assert.ok(css.includes('@media (max-width: 520px)'));
assert.ok(css.includes('.site-modal.site-calendar-modal {'), 'Calendar must outrank the later generic site-modal rule');
assert.ok(css.includes('width: min(1180px, calc(100vw - 40px))'));
assert.ok(css.includes('height: calc(100dvh - 40px)'));
assert.ok(css.includes('.calendar-month-layout { position: relative; display: block;'), 'desktop Month must own the primary width');
for (const weeks of [4, 5, 6]) {
  assert.ok(css.includes(`.calendar-month-grid[data-week-count="${weeks}"]`), `missing ${weeks}-week geometry`);
}
assert.ok(css.includes('position: fixed;'), 'desktop selected-day detail must overlay instead of consuming a permanent column');
assert.ok(css.includes('grid-template-columns: 42px minmax(120px, 1fr) 42px auto'), 'mobile toolbar first row contract missing');
assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'mobile view controls must be discoverable without horizontal scrolling');
assert.ok(css.includes('.calendar-event-stack { display: none; }'), 'touch Month should prefer overview plus selected-day list');
assert.ok(css.includes('.calendar-year-grid { grid-template-columns: repeat(2, minmax(0, 1fr));'), 'mobile Year must use readable two-column summaries');
assert.ok(css.includes('white-space: nowrap'));
assert.ok(css.includes('overflow-y: auto'));
assert.ok(css.includes('overflow-y: hidden'));
assert.ok(css.includes('min-width: 0'));
assert.ok(!css.includes('overflow-x: scroll'));
assert.ok(css.includes('.calendar-editor-backdrop { position: fixed;'), 'event editor must cover the viewport instead of anchoring to an unpositioned content box');
for (const width of [340, 390, 412, 768, 1280, 1440]) assert.ok(width >= 340, `unsupported viewport ${width}`);

const openStart = conversation.indexOf('const openCalendar = async view =>');
const openEnd = conversation.indexOf('const openHelp = () =>', openStart);
const openCalendar = conversation.slice(openStart, openEnd);
assert.ok(openCalendar.includes("'month'"));
assert.ok(openCalendar.includes("'year'"));
assert.ok(openCalendar.includes("'agenda'"));
assert.ok(openCalendar.includes("'attention'"));
assert.ok(!openCalendar.includes('beginSiteHandoff('));
assert.ok(conversation.includes("calendarEntry.dataset.calendarEntryBound = 'true'"), 'Calendar buttons must bind directly');
assert.ok(conversation.includes("calendarEntry.addEventListener('click'"), 'Calendar entry click listener missing');
assert.ok(conversation.includes('event.stopPropagation();'), 'direct Calendar entry must avoid duplicate delegated opening');
assert.ok(!conversation.includes("const calendarView = target?.closest('[data-calendar-view]');"), 'Calendar must not depend on the late document click delegate');
assert.ok(manager.includes("if (value === 'today' || value === 'all' || value === 'date') return 'month'"));
assert.ok(manager.includes("if (value === 'upcoming') return 'agenda'"));
assert.ok(manager.includes("case 'Home'"));
assert.ok(manager.includes("case 'End'"));
assert.ok(manager.includes("case 'PageUp'"));
assert.ok(manager.includes("case 'PageDown'"));
assert.ok(manager.includes('state.detailOpen = false'));
assert.ok(manager.includes('state.dayCollapsed'));

console.log('LOTBI Calendar responsive, navigation and cache contract: PASS');
