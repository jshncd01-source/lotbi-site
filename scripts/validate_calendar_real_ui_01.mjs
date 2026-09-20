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
    return jsonResponse({
      view: 'AGENDA', as_of: '2026-09-20T00:00:00Z', timezone: 'Asia/Seoul',
      coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
    });
  },
});
assert.equal(month.key, 'month');
assert.equal(calls.length, 1);
assert.match(calls[0], /start=2026-08-30&end=2026-10-10/);
assert.doesNotMatch(calls[0], /0001|9999/);
assert.equal(buildCalendarAriaLabel({date: '2026-09-20', weekday: 0}, 2), '2026년 9월 20일 일요일, 일정 2개');
assert.deepEqual(countCalendarEventsByMonth([
  {local_date: '2026-01-02'}, {local_date: '2026-01-30'}, {local_date: '2026-09-20'}, {local_date: '2025-09-20'},
], 2026), [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

const ROOT = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'site-calendar-ui.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
assert.ok(source.includes("from './site-calendar-manager.js?v=20260920-realcal1'"));
for (const required of ['calendarMonthGrid', 'calendarYearOverview', "case 'ArrowLeft'", "case 'ArrowRight'", "case 'ArrowUp'", "case 'ArrowDown'", 'date.dataset.calendarDate', "grid.setAttribute('role', 'grid')", 'buildCalendarAriaLabel(cell, events.length)', 'events.slice(0, chipCount)', 'calendar-event-overflow']) {
  assert.ok(manager.includes(required), `missing Calendar UI contract: ${required}`);
}
assert.ok(manager.includes('calendar-year-event-count'), 'year overview must render monthly event counts');
assert.ok(manager.includes('if (!root.isConnected)'), 'detached Calendar mounts must dispose their global refresh listener');
assert.ok(manager.includes('event.detail?.source === root'), 'a Calendar mount must ignore its own refresh broadcast');
for (const selector of ['.calendar-month-grid', '.calendar-year-grid', '.calendar-day-panel', '[data-selected="true"]', '[data-today="true"]', 'grid-template-columns: repeat(7', 'grid-template-columns: repeat(3']) assert.ok(css.includes(selector), `missing Calendar CSS contract: ${selector}`);

console.log('LOTBI real Calendar month/year/day UI: PASS');
