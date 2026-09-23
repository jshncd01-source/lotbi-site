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
    if (String(url).includes('/weather')) {
      return jsonResponse({provider_ready: false, items: [], ai_calls: 0});
    }
    if (String(url).includes('/holidays')) {
      return jsonResponse({
        year: 2026,
        country: 'KR',
        coverage_status: 'VERIFIED',
        snapshot_version: 'KR-2026-20260922-v1',
        supported_years: [2026],
        items: [{
          date: '2026-09-25',
          name: '추석',
          country: 'KR',
          holiday_type: 'CHUSEOK',
          is_substitute: false,
          source: 'KASI_2026_ALMANAC',
          source_date: '2026-09-22',
          verified_at: '2026-09-22T06:30:00Z',
        }],
        ai_calls: 0,
        provider_api_calls: 0,
      });
    }
    return jsonResponse({
      view: 'AGENDA', as_of: '2026-09-20T00:00:00Z', timezone: 'Asia/Seoul',
      coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
    });
  },
});
assert.equal(month.key, 'month');
assert.equal(calls.length, 4);
const agendaCall = calls.find(url => String(url).includes('/agenda'));
const weatherCall = calls.find(url => String(url).includes('/weather'));
const holidayCall = calls.find(url => String(url).includes('/holidays'));
assert.ok(agendaCall, 'month view must load agenda');
assert.match(agendaCall, /start=2026-08-30&end=2026-10-03/);
assert.doesNotMatch(agendaCall, /0001|9999/);
assert.ok(weatherCall, 'month view must load weather fail-soft context');
// Not the full grid: Core rejects a span wider than 15 inclusive days, and a
// forecast starts at today (2026-09-20 in Asia/Seoul here), not at the grid's
// leading overflow days. The agenda assertion above keeps the full grid.
assert.match(weatherCall, /start=2026-09-20&end=2026-10-03/);
assert.ok(holidayCall, 'month view must load Korea public holidays');
assert.match(holidayCall, /year=2026&country=KR/);
assert.equal(month.holidays[0].name, '추석');
assert.deepEqual(month.attention, []);
assert.equal(buildCalendarAriaLabel({date: '2026-09-20', weekday: 0}, 2), '2026년 9월 20일 일요일, 일정 2개');
assert.equal(
  buildCalendarAriaLabel(
    {date: '2026-09-20', weekday: 0},
    2,
    {today: true, selected: true, attention: true, holiday: {name: '테스트 공휴일'}},
  ),
  '2026년 9월 20일 일요일, 일정 2개, 오늘, 선택됨, 확인 필요 일정 있음, 대한민국 공휴일 테스트 공휴일',
);
assert.deepEqual(countCalendarEventsByMonth([
  {local_date: '2026-01-02'}, {local_date: '2026-01-30'}, {local_date: '2026-09-20'}, {local_date: '2025-09-20'},
], 2026), [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);

const ROOT = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'site-calendar-ui.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
assert.ok(source.includes("from './site-calendar-manager.js?v=20260923-kmaglyph1'"));
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
assert.ok(manager.includes('const requestGeneration = ++refreshGeneration'), 'manager must version overlapping refresh requests');
assert.ok(manager.includes('requestGeneration !== refreshGeneration'), 'stale manager responses must be ignored');
assert.ok(manager.includes('if (requestGeneration === refreshGeneration) root.removeAttribute'), 'only latest manager request may clear busy state');
assert.ok(manager.includes('calendar-year-event-count'), 'year overview must render monthly event counts');
for (const token of [
  'calendar-delete-confirm-backdrop',
  'calendar-delete-confirm-dialog',
  '이 일정을 삭제하시겠습니까?',
  '삭제한 일정은 복구할 수 없습니다.',
  "button('취소', 'calendar-delete-confirm-cancel')",
  "button('삭제', 'calendar-delete-confirm-submit')",
  'if (deleteRequestInFlight) return',
]) assert.ok(manager.includes(token), `missing delete confirmation contract: ${token}`);
assert.ok(!manager.includes('calendar-editor-confirm-delete'));
assert.ok(!manager.includes('이 일정을 삭제할까요?'));
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
  '.calendar-weather-icon',
  '.calendar-delete-confirm-backdrop',
  '.calendar-delete-confirm-dialog',
  '.calendar-delete-confirm-actions',
  '[data-selected="true"]',
  '[data-today="true"]',
  'grid-template-columns: repeat(7',
  'data-week-count="4"',
  'data-week-count="5"',
  'data-week-count="6"',
]) assert.ok(css.includes(selector), `missing Calendar CSS contract: ${selector}`);

console.log('LOTBI real Calendar month/year/day UI: PASS');
