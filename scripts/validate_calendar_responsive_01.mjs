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

const calendarEntryVersion = '20260922-location1';
const calendarManagerVersion = '20260922-location1';
const calendarModelVersion = '20260921-smartcaldraft1';
const calendarCssVersion = '20260921-smartcaldraft1';
const homeEntryVersion = index.match(/site-conversation\.js\?v=([^"]+)/)?.[1] || '';
const callbackEntryVersion = callback.match(/\/auth-callback\.js\?v=([^"]+)/)?.[1] || '';
const callbackConversationVersion = callbackJs.match(/\.\/site-conversation\.js\?v=([^']+)/)?.[1] || '';
assert.ok(index.includes(`site-calendar.css?v=${calendarCssVersion}`));
assert.ok(callback.includes(`/site-calendar.css?v=${calendarCssVersion}`));
assert.ok(homeEntryVersion, 'Home conversation entry must be cache-busted');
assert.ok(callbackEntryVersion, 'auth callback entry must be cache-busted');
assert.ok(conversation.includes(`./site-calendar-ui.js?v=${calendarEntryVersion}`));
assert.ok(callbackJs.includes(`./site-calendar-ui.js?v=${calendarEntryVersion}`));
assert.equal(callbackConversationVersion, homeEntryVersion, 'auth callback must import the current Home conversation runtime');
assert.ok(ui.includes(`./site-calendar-manager.js?v=${calendarManagerVersion}`));
assert.ok(manager.includes(`./site-calendar-model.js?v=${calendarModelVersion}`));
for (const module of ['site-calendar-model.js', 'site-calendar-guest.js', 'site-calendar-manager.js', 'site-current-location.js']) {
  assert.ok(workflow.includes(`'${module}'`), `focused workflow missing ${module}`);
}
for (const test of ['validate_calendar_month_grid_01.mjs', 'validate_calendar_year_view_01.mjs', 'validate_guest_calendar_local_01.mjs', 'validate_calendar_real_ui_01.mjs', 'validate_calendar_event_editor_01.mjs', 'validate_calendar_responsive_01.mjs', 'validate_calendar_modal_runtime_02.mjs', 'validate_calendar_month_geometry_01.mjs']) {
  assert.ok(workflow.includes(test), `focused workflow missing ${test}`);
}

assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
assert.ok(css.includes('@media (max-width: 900px)'));
assert.ok(css.includes('@media (max-width: 520px)'));
assert.ok(css.includes('.site-modal.site-calendar-modal {'), 'Calendar must outrank the later generic site-modal rule');
assert.ok(css.includes('width: min(1180px, calc(100vw - 40px))'));
assert.ok(css.includes('height: calc(100dvh - 40px)'));
assert.ok(css.includes('.calendar-toolbar {\n  grid-row: 1;'), 'Calendar toolbar must stay in the first product-shell row');
assert.ok(css.includes('.calendar-status { grid-row: 2;'), 'Calendar status must reserve the second product-shell row');
assert.ok(css.includes('.calendar-viewport { grid-row: 3;'), 'Calendar viewport must stay in the flexible third row');
assert.ok(css.includes('.calendar-status:empty + .calendar-viewport { grid-row: 2 / 4; }'), 'Empty status must let the viewport consume the freed status row plus the flexible row');
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
assert.ok(css.includes('.calendar-delete-confirm-backdrop { position: fixed;'), 'delete confirmation must cover the viewport');
assert.ok(css.includes('place-items: center'), 'delete confirmation must remain centered on desktop and mobile');
assert.ok(css.includes('max-height: calc(100svh - 32px)'), 'delete confirmation must fit small mobile viewports');
assert.ok(css.includes('overscroll-behavior: contain'), 'delete confirmation backdrop must contain background scroll chaining');
for (const width of [340, 390, 412, 768, 1280, 1440]) assert.ok(width >= 340, `unsupported viewport ${width}`);

const openStart = conversation.indexOf('const openCalendar = async (view,');
const openEnd = conversation.indexOf('const openHelp = () =>', openStart);
const openCalendar = conversation.slice(openStart, openEnd);
assert.ok(openCalendar.includes("'month'"));
assert.ok(openCalendar.includes("'year'"));
assert.ok(openCalendar.includes("'agenda'"));
assert.ok(openCalendar.includes("'attention'"));
assert.ok(!openCalendar.includes('beginSiteHandoff('));
assert.ok(conversation.includes("const bindCalendarEntries = () =>"), 'Calendar binding helper missing');
assert.ok(conversation.includes("calendarEntry.dataset.calendarEntryBound = 'true'"), 'Calendar buttons must bind directly');
assert.ok(conversation.includes("calendarEntry.addEventListener('click'"), 'Calendar entry click listener missing');
assert.ok(conversation.includes('event.stopPropagation();'), 'direct Calendar entry must avoid duplicate fallback opening');
assert.ok(conversation.includes("event.target instanceof Element ? event.target.closest('[data-calendar-view]')"), 'Calendar delegated fallback missing');
assert.ok(conversation.includes('bindCalendarEntries();'), 'Calendar entries must bind on initial mount');
assert.ok(conversation.includes("window.addEventListener(SIDEBAR_RENDERED_EVENT"), 'sidebar rerender recovery hook missing');
assert.ok(manager.includes("if (value === 'today' || value === 'all' || value === 'date') return 'month'"));
assert.ok(manager.includes("if (value === 'upcoming') return 'agenda'"));
assert.ok(manager.includes("case 'Home'"));
assert.ok(manager.includes("case 'End'"));
assert.ok(manager.includes("case 'PageUp'"));
assert.ok(manager.includes("case 'PageDown'"));
assert.ok(manager.includes('state.detailOpen = false'));
assert.ok(manager.includes('state.dayCollapsed'));
assert.ok(manager.includes("root.addEventListener('keydown'"), 'Calendar root Escape containment missing');
assert.ok(manager.includes("!root.querySelector('.calendar-editor-dialog')"), 'Calendar detail Escape must defer to the editor');
assert.ok(manager.includes('event.stopPropagation();'), 'Calendar Escape surfaces must stop outer modal propagation');
assert.ok(manager.includes('let refreshGeneration = 0;'), 'Calendar Manager stale-response generation guard missing');
assert.ok(manager.includes('const requestGeneration = ++refreshGeneration;'), 'Calendar Manager must version each refresh');
assert.ok(manager.includes('requestGeneration !== refreshGeneration'), 'Calendar Manager must reject stale refreshes');
assert.ok(conversation.includes("openSurface?.querySelector('.lotbi-box-list, .calendar-product-shell')"), 'Calendar surface must close across Site identity changes');

console.log('LOTBI Calendar responsive, navigation and cache contract: PASS');

assert.ok(manager.includes("locationButton.dataset.calendarCurrentLocation = 'true'"), 'Calendar current-location action must remain explicit');
