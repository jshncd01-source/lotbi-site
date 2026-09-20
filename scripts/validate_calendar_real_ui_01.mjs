import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {buildCalendarAriaLabel, countCalendarEventsByMonth, loadLifeCalendarManagerView} = await import('../site-calendar-ui.js');

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
}

const calls = [];
const month = await loadLifeCalendarManagerView('site-token', {
  view: 'month',
  date: '2026-09-20',
  timezone: 'Asia/Seoul',
  now: new Date('2026-09-19T15:00:00Z'),
  fetchImpl: async url => {
    calls.push(url);
    if (String(url).includes('/attention')) {
      return jsonResponse({
        view: 'ATTENTION', as_of: '2026-09-20T00:00:00Z', timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
      });
    }
    return jsonResponse({
      view: 'AGENDA', as_of: '2026-09-20T00:00:00Z', timezone: 'Asia/Seoul',
      coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
    });
  },
});
assert.equal(month.key, 'month');
assert.equal(calls.length, 2);
const agendaCall = calls.find(url => String(url).includes('/agenda'));
assert.ok(agendaCall, 'month view must load agenda');
assert.match(agendaCall, /start=2026-08-30&end=2026-10-03/);
assert.doesNotMatch(agendaCall, /0001|9999/);
assert.deepEqual(month.attention, []);
assert.equal(buildCalendarAriaLabel({date: '2026-09-20', weekday: 0}, 2), '2026년 9월 20일 일요일, 일정 2개');
assert.equal(
  buildCalendarAriaLabel({date: '2026-09-20', weekday: 0}, 2, {today: true, selected: true, attention: true}),
  '2026년 9월 20일 일요일, 일정 2개, 오늘, 선택됨, 확인 필요 일정 있음',
);
assert.deepEqual(countCalendarEventsByMonth([
  {local_date: '2026-01-02'}, {local_date: '2026-01-30'}, {local_date: '2026-09-20'}, {local_date: '2025-09-20'},
], 2026), [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

const ROOT = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'site-calendar-ui.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
assert.ok(source.includes("from './site-calendar-manager.js?v=20260920-calfocus1'"));
for (const required of [
  'calendarMonthGrid',
  'calendarYearOverview',
  "case 'ArrowLeft'",
  "case 'ArrowRight'",
  "case 'ArrowUp'",
  "case 'ArrowDown'",
  "case 'Home'",
  "case 'End'",
  "case 'PageUp'",
  "case 'PageDown'",
  'cellNode.dataset.calendarDate',
  "grid.setAttribute('role', 'grid')",
  'buildCalendarAriaLabel(cell, events.length',
  'fitMonthEventDensity',
  'monthEventRow',
  'calendar-event-overflow',
]) {
  assert.ok(manager.includes(required), `missing Calendar UI contract: ${required}`);
}
assert.ok(!manager.includes('Math.min(events.length, 2)'), 'fixed two-event limit must not return');
assert.ok(manager.includes('calendar-year-event-count'), 'year overview must render monthly event counts');
assert.ok(manager.includes('if (!root.isConnected)'), 'detached Calendar mounts must dispose their global refresh listener');
assert.ok(manager.includes('event.detail?.source === root'), 'a Calendar mount must ignore its own refresh broadcast');
for (const lifecycleToken of ["visibilitychange", "pageshow", "window.addEventListener('focus'", 'refreshTodayIfNeeded', '60_000']) {
  assert.ok(manager.includes(lifecycleToken), `missing Calendar Today lifecycle contract: ${lifecycleToken}`);
}
for (const selector of [
  '.calendar-month-grid',
  '.calendar-year-grid',
  '.calendar-day-panel',
  '.calendar-event-stack',
  '.calendar-mobile-event-count',
  '[data-selected="true"]',
  '[data-today="true"]',
  'grid-template-columns: repeat(7',
  'data-week-count="4"',
  'data-week-count="5"',
  'data-week-count="6"',
]) assert.ok(css.includes(selector), `missing Calendar CSS contract: ${selector}`);

console.log('LOTBI real Calendar month/year/day UI: PASS');
