import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  expenseSummaryPresentation,
} from '../site-calendar-expense.js';
import {
  calendarWeatherLocationPresentation,
} from '../site-calendar-manager.js';

// Break caught: the old strip rendered six equally loud 0원 category slots
// before the figure people opened the summary to see.
const expense = expenseSummaryPresentation({
  currencies: [{
    currency: 'KRW',
    categories: [
      {expenseCategory: 'FOOD', amountMinor: 42_300, entryCount: 2},
      {expenseCategory: 'TRAVEL', amountMinor: 0, entryCount: 1},
      {expenseCategory: 'LIVING', amountMinor: 180_000, entryCount: 1},
    ],
    totalAmountMinor: 222_300,
    entryCount: 4,
  }],
  entriesWithoutAmount: 1,
}, {local: true});

assert.equal(expense.lines.length, 1);
assert.deepEqual(expense.lines[0], {
  currency: 'KRW',
  totalLabel: '이번 달 지출',
  totalAmount: '222,300원',
  categories: [
    {expenseCategory: 'FOOD', label: '음식', amount: '42,300원'},
    {expenseCategory: 'LIVING', label: '생활비', amount: '180,000원'},
  ],
  note: '금액 없는 일정 1건 제외 · 이 브라우저에만 저장돼요 · 로그인하면 다른 기기에서도',
});

const emptyExpense = expenseSummaryPresentation({currencies: [], entriesWithoutAmount: 0});
assert.equal(emptyExpense.lines[0].totalLabel, '이번 달 지출');
assert.equal(emptyExpense.lines[0].totalAmount, '0원');
assert.deepEqual(emptyExpense.lines[0].categories, [], '0원 categories stay quiet instead of becoming six badges');
assert.equal(emptyExpense.lines[0].note, '이번 달 기록 없음');

const multiCurrency = expenseSummaryPresentation({
  currencies: [
    {currency: 'USD', categories: [{expenseCategory: 'SHOPPING', amountMinor: 12, entryCount: 1}], totalAmountMinor: 12, entryCount: 1},
    {currency: 'KRW', categories: [{expenseCategory: 'FOOD', amountMinor: 5000, entryCount: 1}], totalAmountMinor: 5000, entryCount: 1},
  ],
  entriesWithoutAmount: 0,
});
assert.deepEqual(multiCurrency.lines.map(line => line.currency), ['KRW', 'USD'], 'currencies remain separate with KRW first');
assert.deepEqual(multiCurrency.lines.map(line => line.totalLabel), ['이번 달 지출', '이번 달 지출 · USD']);
assert.deepEqual(multiCurrency.lines.map(line => line.totalAmount), ['5,000원', '12 USD']);

// Break caught: Settings used several long rows without an explicit primary
// source/fallback relationship, so a saved manual region could look active
// while current location was actually authoritative.
assert.deepEqual(calendarWeatherLocationPresentation({
  manualWeatherRegion: {label: '전북특별자치도 전주시'},
  weatherRegionOrigin: 'MANUAL',
  usingBrowserLocation: false,
  locationPermission: 'PROMPT_REQUIRED',
  locationResolution: 'IDLE',
  locationInFlight: false,
  locationMessage: '',
}), {
  currentAction: '현재 위치 사용',
  currentStatus: '버튼을 누를 때만 위치 권한을 요청합니다.',
  manualSummary: '수동 지역 · 전북특별자치도 전주시',
  relationship: '현재 위치를 사용할 수 없으면 수동 지역의 날씨를 표시합니다.',
});

assert.deepEqual(calendarWeatherLocationPresentation({
  manualWeatherRegion: {label: '전북특별자치도 전주시'},
  weatherRegionOrigin: 'CURRENT_LOCATION',
  usingBrowserLocation: true,
  locationPermission: 'GRANTED',
  locationResolution: 'RESOLVED',
  locationInFlight: false,
  locationMessage: '',
}), {
  currentAction: '변경',
  currentStatus: '현재 위치로 날씨를 표시합니다.',
  manualSummary: '현재 지역 · 전북특별자치도 전주시',
  relationship: '현재 위치를 우선 사용하고, 사용할 수 없으면 저장된 지역으로 전환합니다.',
});

assert.deepEqual(calendarWeatherLocationPresentation({
  manualWeatherRegion: null,
  weatherRegionOrigin: null,
  usingBrowserLocation: false,
  locationPermission: 'UNAVAILABLE',
  locationResolution: 'ERROR',
  locationInFlight: false,
  locationMessage: '',
}), {
  currentAction: '현재 위치 사용',
  currentStatus: '이 브라우저에서는 현재 위치를 사용할 수 없어요.',
  manualSummary: '수동 지역이 선택되지 않았습니다.',
  relationship: '아래에서 광역시·도와 시·군·구를 선택할 수 있습니다.',
});

// Break caught: an entry HTML, callback HTML, and nested module with different
// query keys can keep one generation of the Calendar UI indefinitely. Derive
// the desired token from the public Calendar CSS and require the whole changed
// entry chain to agree with it.
const read = file => fs.readFileSync(file, 'utf8');
const index = read('index.html');
const callbackHtml = read('auth/callback/index.html');
const callbackJs = read('auth-callback.js');
const conversation = read('site-conversation.js');
const ui = read('site-calendar-ui.js');
const manager = read('site-calendar-manager.js');
const calendarCss = read('site-calendar.css');
const workflow = read('.github/workflows/site-universal-life-calendar-01.yml');
const modalRuntime = read('scripts/validate_calendar_modal_runtime_02.mjs');
const touchRuntime = read('scripts/validate_calendar_touch_monthnav_daysheet_01.mjs');
const dayPanelRuntime = read('scripts/validate_calendar_day_panel_two_buttons_01.mjs');
const monthGeometry = read('scripts/validate_calendar_month_geometry_01.mjs');

const token = index.match(/site-calendar\.css\?v=([^"']+)/)?.[1] || '';
assert.ok(token, 'the public Calendar stylesheet must be cache-busted');
const refs = [
  ['Home expense CSS', index, /site-calendar-expense\.css\?v=([^"']+)/],
  ['Home weather CSS', index, /site-calendar-weather\.css\?v=([^"']+)/],
  ['Home conversation entry', index, /site-conversation\.js\?v=([^"']+)/],
  ['callback Calendar CSS', callbackHtml, /site-calendar\.css\?v=([^"']+)/],
  ['callback expense CSS', callbackHtml, /site-calendar-expense\.css\?v=([^"']+)/],
  ['callback weather CSS', callbackHtml, /site-calendar-weather\.css\?v=([^"']+)/],
  ['callback entry', callbackHtml, /auth-callback\.js\?v=([^"']+)/],
  ['callback conversation import', callbackJs, /site-conversation\.js\?v=([^"']+)/],
  ['conversation Calendar UI import', conversation, /site-calendar-ui\.js\?v=([^"']+)/],
  ['conversation Calendar CSS', conversation, /site-conversation\.css\?v=([^"']+)/],
  ['Calendar manager import', ui, /site-calendar-manager\.js\?v=([^"']+)/],
  ['manager expense import', manager, /site-calendar-expense\.js\?v=([^"']+)/],
  ['manager product import', manager, /site-calendar-product\.js\?v=([^"']+)/],
  ['manager location import', manager, /site-current-location\.js\?v=([^"']+)/],
];
for (const [label, source, pattern] of refs) {
  const actual = source.match(pattern)?.[1] || '';
  assert.equal(actual, token, `${label} must use the same Calendar generation (${token}), got ${actual || 'none'}`);
}
for (const [label, source, pattern] of [
  ['conversation Calendar imports', conversation, /from ['"]\.\/(site-calendar[^?'" ]+)\?v=([^'" ]+)/g],
  ['manager Calendar imports', manager, /from ['"]\.\/(site-calendar[^?'" ]+|site-current-location\.js)\?v=([^'" ]+)/g],
]) {
  const versions = [...source.matchAll(pattern)].map(match => match[2]);
  assert.ok(versions.length > 0, `${label} must exist`);
  assert.deepEqual([...new Set(versions)], [token], `${label} must stay on one cache generation`);
}
assert.match(workflow, /validate_calendar_secondary_surfaces_01\.mjs/, 'focused Calendar workflow must run this contract');

// Break caught: the focused workflow previously skipped the pure model and all
// three redesign contracts, so an exact-head GREEN could miss the new IA.
for (const path of [
  'site-calendar-product.js',
  'scripts/validate_calendar_product_model_01.mjs',
  'scripts/validate_calendar_cross_platform_ux_01.mjs',
  'scripts/validate_calendar_compact_editor_01.mjs',
  'scripts/validate_calendar_modal_runtime_02.mjs',
  'scripts/validate_calendar_touch_monthnav_daysheet_01.mjs',
  'scripts/validate_calendar_day_panel_two_buttons_01.mjs',
  'scripts/validate_calendar_month_geometry_01.mjs',
]) {
  assert.ok(workflow.includes(`- '${path}'`), `focused workflow path filter missing ${path}`);
}
for (const command of [
  'node --check site-calendar-product.js',
  'node scripts/validate_calendar_product_model_01.mjs',
  'node scripts/validate_calendar_cross_platform_ux_01.mjs',
  'node scripts/validate_calendar_compact_editor_01.mjs',
]) {
  assert.ok(workflow.includes(command), `focused workflow command missing: ${command}`);
}
assert.ok(!workflow.includes('validate_calendar_compact_editor_01.mjs --contracts-only'),
  'focused CI must execute the compact editor browser interaction, not contracts only');

// Break caught: Settings was modal in ARIA only. Tab could escape into the
// Calendar, Escape bubbled into selected-day handling, and close discarded the
// keyboard user's place.
const settingsStart = manager.indexOf('function calendarSettingsDialog(');
const settingsEnd = manager.indexOf('\nfunction calendarEditorDialog(', settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, 'Settings dialog source boundary missing');
const settingsSource = manager.slice(settingsStart, settingsEnd);
assert.match(settingsSource, /const opener = document\.activeElement/);
assert.match(settingsSource, /event\.key === 'Tab'[\s\S]*event\.shiftKey[\s\S]*last\.focus\(\)[\s\S]*first\.focus\(\)/,
  'Settings must trap forward and backward Tab');
assert.match(settingsSource, /event\.key === 'Escape'[\s\S]*event\.stopPropagation\(\)[\s\S]*dismiss\(\)/,
  'Settings Escape must close only the top dialog');
assert.match(settingsSource, /opener\.isConnected[\s\S]*calendar-settings-button[\s\S]*\.focus\(\)/,
  'Settings close must restore a connected opener or the current settings button');
assert.match(calendarCss, /\.calendar-settings-close \{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/,
  'Settings close target must be 44x44');
assert.match(calendarCss, /\.calendar-settings-action-button \{[\s\S]*min-height:\s*44px;/,
  'Settings actions must meet the 44px touch floor');
assert.match(calendarCss, /\.calendar-settings-location-help > summary \{[\s\S]*min-height:\s*44px;/,
  'weather permission help control must meet the 44px touch floor');

const rootEscapeStart = manager.indexOf("root.addEventListener('keydown'");
const rootEscapeEnd = manager.indexOf('\n  let refreshGeneration', rootEscapeStart);
assert.ok(rootEscapeStart >= 0 && rootEscapeEnd > rootEscapeStart, 'root Escape capture handler source boundary missing');
const rootEscapeSource = manager.slice(rootEscapeStart, rootEscapeEnd);
assert.match(rootEscapeSource, /calendar-settings-(?:dialog|backdrop)[\s\S]*return/,
  'root capture must defer Escape to the open Settings top layer before day-detail handling');

// Break caught: focused browser fixtures still asserted the retired overlay
// variants or rendered every Month event, so CI would reject the final IA.
assert.doesNotMatch(touchRuntime, /setDayDetailPresentation\(|presentation\s*!==\s*'POPOVER'|presentation\s*!==\s*'SHEET'/,
  'touch runtime must test the authoritative FLOW/SIDE detail only');
assert.match(touchRuntime, /presentation\s*!==\s*'FLOW'[\s\S]*position\s*!==\s*'static'/,
  'touch runtime must assert an in-flow, non-overlay mobile detail');
assert.doesNotMatch(dayPanelRuntime, /toggleLabel|\[접기\]|presentation\s*!==\s*'POPOVER'/,
  'day-panel runtime must not require the retired collapse/overlay UI');
assert.ok(dayPanelRuntime.includes('/^\\d+월 \\d+일 [일월화수목금토]$/'),
  'day-panel runtime must keep the compact selected-date heading contract');
assert.match(monthGeometry, /rows\.length\s*!==\s*2[\s\S]*more\.textContent\s*!==\s*'\+3'/,
  'Month geometry must lock two mounted rows plus a visible +3 overflow summary');
assert.match(modalRuntime, /visible\s*!==\s*expectedRows[\s\S]*overflowVisible/,
  'modal density must assert actual row and overflow visibility');

// Break caught: current-location resolution changed state while the open
// Settings overview and manual-clear action remained stale.
assert.match(manager, /function syncOpenWeatherLocationSettings\(\)/,
  'open Settings weather controls need one live synchronization path');
assert.match(manager, /calendar-settings-weather-overview[\s\S]*manualSummary[\s\S]*relationship/,
  'live synchronization must refresh both overview lines');
assert.match(manager, /data-calendar-weather-manual-clear[\s\S]*hidden = !state\.manualWeatherRegion/,
  'live synchronization must refresh manual-clear visibility');
assert.match(manager, /syncOpenWeatherLocationSettings\(\);[\s\S]*locationButton\.setAttribute/,
  'every location control sync must refresh the open overview too');

console.log('LOTBI Calendar secondary expense/settings/cache contract: PASS');
