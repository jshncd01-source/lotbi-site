import assert from 'node:assert/strict';
import fs from 'node:fs';

const {calendarItemActionPolicy, monthGridKeyboardTargetDate, rovingTabTargetIndex} = await import('../site-calendar-manager.js');

const manager = fs.readFileSync('site-calendar-manager.js', 'utf8');
const css = fs.readFileSync('site-calendar.css', 'utf8');

// A product-view regression must fail this gate: these are four different
// information surfaces, not renamed versions of the former Month/Year/Agenda.
assert.ok(manager.includes("['week', '주'], ['month', '월'], ['year', '년'], ['agenda', '일정']"));
assert.ok(manager.includes('function renderWeek(state, actions'));
assert.ok(manager.includes("strip.className = 'calendar-week-strip'"));
assert.ok(manager.includes("group.dataset.calendarWeekGroup = day.date"));
assert.ok(manager.includes("'이번 주에는 일정이 없어요.'"));

// Month is deliberately bounded regardless of how many events a day has, and
// it exposes measured weather rather than inventing values for missing days.
assert.ok(manager.includes('monthCellSummary(events)'));
assert.ok(manager.includes('summary.visible'));
assert.ok(manager.includes('summary.moreLabel'));
assert.ok(manager.includes("temperature.className = 'calendar-weather-temperature'"));
assert.ok(manager.includes('calendarWeatherPresentation(weather).monthLabel'));

// The selected day belongs in the page on a phone and in a stable side rail on
// desktop. The removed floating pointer must not survive in active CSS.
assert.ok(manager.includes("FLOW: 'FLOW', SIDE: 'SIDE'"));
assert.ok(manager.includes('usesFlowingDayDetail() ? DAY_DETAIL_PRESENTATION.FLOW : DAY_DETAIL_PRESENTATION.SIDE'));
assert.ok(css.includes('.calendar-month-layout[data-day-detail="SIDE"]'));
assert.ok(css.includes('.calendar-day-panel[data-presentation="FLOW"]'));
assert.ok(!css.includes('[data-arrow]::before'));

// Schedule is a searchable/list-like surface with explicit, independent
// filters. Its empty state is not a blank canvas.
for (const scope of ['all', 'today', 'week', 'month', 'reservation', 'payment', 'schedule']) {
  assert.ok(manager.includes(`['${scope}',`), `missing Schedule filter: ${scope}`);
}
assert.ok(manager.includes("'이 기간에는 일정이 없어요.'"));

// Common controls stay visually compact while retaining a full touch target.
assert.ok(css.includes('min-height: 44px'));
assert.ok(manager.includes("previous.dataset.calendarNavigation = 'previous'"));
assert.ok(manager.includes("next.dataset.calendarNavigation = 'next'"));
assert.ok(css.includes('.calendar-nav-button[data-calendar-navigation="next"]::before'));
assert.ok(css.includes('.calendar-week-agenda'));
assert.ok(css.includes('.calendar-week-day'));
assert.match(css, /@media \(min-width: 901px\)[\s\S]*\.calendar-week-days\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
assert.ok(!css.includes('.calendar-week-days { grid-template-columns: repeat(2'));
assert.ok(css.includes('.calendar-week-add-actions .calendar-add-button { width: auto;'));
assert.ok(manager.includes("loading.textContent = '일정을 불러오는 중'"));
assert.ok(manager.includes("'일정을 불러오지 못했습니다.'"));

// Both tablists use the same wrapping keyboard contract and activate the
// focused destination, rather than moving DOM focus without changing state.
assert.equal(typeof rovingTabTargetIndex, 'function');
assert.equal(rovingTabTargetIndex('ArrowRight', 3, 4), 0);
assert.equal(rovingTabTargetIndex('ArrowLeft', 0, 4), 3);
assert.equal(rovingTabTargetIndex('Home', 2, 4), 0);
assert.equal(rovingTabTargetIndex('End', 1, 4), 3);
assert.equal(rovingTabTargetIndex('Enter', 1, 4), null);
assert.ok(manager.includes('bindRovingTablist(modes'));
assert.ok(manager.includes('bindRovingTablist(strip'));

// Month Home/End must follow the visual row owned by the configured week start.
assert.equal(monthGridKeyboardTargetDate('2026-09-24', 'Home', 0), '2026-09-20');
assert.equal(monthGridKeyboardTargetDate('2026-09-24', 'End', 0), '2026-09-26');
assert.equal(monthGridKeyboardTargetDate('2026-09-24', 'Home', 1), '2026-09-21');
assert.equal(monthGridKeyboardTargetDate('2026-09-24', 'End', 1), '2026-09-27');
assert.equal(monthGridKeyboardTargetDate('2026-09-27', 'End', 1), '2026-09-27');
assert.equal(monthGridKeyboardTargetDate('2026-09-24', 'PageUp', 1), null);

// Core-owned LIFE_RESULT rows are not silently turned into editable USER_INPUT.
assert.deepEqual(calendarItemActionPolicy({
  source_kind: 'LIFE_RESULT',
  allowed_actions: ['VIEW_SOURCE', 'HIDE', 'REMINDER_SETTINGS'],
}), {
  canUpdate: false,
  canRemove: false,
  readOnly: true,
  allowedActions: ['VIEW_SOURCE', 'HIDE', 'REMINDER_SETTINGS'],
});
assert.deepEqual(calendarItemActionPolicy({
  source_kind: 'USER_INPUT',
  allowed_actions: ['UPDATE', 'REMOVE'],
}), {
  canUpdate: true,
  canRemove: true,
  readOnly: false,
  allowedActions: ['UPDATE', 'REMOVE'],
});

// Selection restores focus only to a target guaranteed by the active view.
assert.ok(manager.includes('function focusSelectedCalendarTarget'));
assert.ok(manager.includes("state.mode === 'week'"));
assert.ok(manager.includes('data-calendar-week-date'));
assert.ok(manager.includes("state.mode === 'month'"));
assert.ok(manager.includes("selector = '.calendar-day-close'"));

// A Fold crossing the product breakpoint swaps FLOW/SIDE immediately.
assert.ok(manager.includes('let lastDayDetailPresentation = dayDetailPresentation()'));
assert.ok(manager.includes('nextDayDetailPresentation !== lastDayDetailPresentation'));
assert.ok(manager.includes('if (state.mode === \'month\') render()'));

// The semantic date button itself, not only the enclosing cell, is a full
// touch target at every width.
assert.match(css, /\.calendar-date-trigger\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
assert.match(css, /\.calendar-date-number\s*\{[^}]*font-size:\s*17px;/);
assert.ok(!css.includes('.calendar-date-trigger { min-width: 25px; min-height: 25px; }'));

// A 49–55px narrow cell gets three explicit rows: the 44px date target,
// event density, then weather + compact temperature. No sibling competes for
// horizontal space with the semantic date button.
assert.ok(manager.includes("temperature.dataset.compactTemperature = temperatureLabel.replace(/\\s+/g, '')"));
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.calendar-date-header\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*44px 12px 14px;/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.calendar-date-trigger\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*1;/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.calendar-mobile-event-count\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.calendar-weather-icon\s*\{[^}]*grid-row:\s*3;/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.calendar-weather-temperature\s*\{[^}]*grid-row:\s*3;/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.site-modal\.site-calendar-modal > \.site-modal-content\s*\{[^}]*padding-inline:\s*8px;/);
assert.ok(css.includes('grid-template-columns: minmax(0, 12px) minmax(0, 1fr);'));
assert.ok(!css.includes('grid-template-columns: 12px minmax(0, 34px);'));
// The later weather stylesheet uses svg.calendar-weather-icon (0,1,1).
// The narrow 12px rule needs the header class too (0,2,1), otherwise the
// later 14px dimensions overflow the icon track and crowd the temperature.
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*\.calendar-date-header\s*>\s*svg\.calendar-weather-icon\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;/.test(css),
  'narrow Month weather dimensions must outrank the later svg.calendar-weather-icon rule'
);

console.log('LOTBI Calendar cross-platform view UX: PASS');
