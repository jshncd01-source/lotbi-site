import assert from 'node:assert/strict';

const {
  calendarMonthGrid,
  formatCivilDate,
  groupCalendarEvents,
  monthGridRange,
  sortCalendarEvents,
} = await import('../site-calendar-model.js');

const february = calendarMonthGrid(2026, 2);
assert.equal(february.length, 28);
assert.deepEqual(february[0], {
  date: '2026-02-01', year: 2026, month: 2, day: 1, weekday: 0, inCurrentMonth: true,
});
assert.equal(february[27].date, '2026-02-28');
assert.deepEqual(monthGridRange(2026, 2), {start: '2026-02-01', end: '2026-02-28'});

const fiveWeekMonth = calendarMonthGrid(2026, 9);
assert.equal(fiveWeekMonth.length, 35);
assert.equal(fiveWeekMonth[0].date, '2026-08-30');
assert.equal(fiveWeekMonth[34].date, '2026-10-03');
assert.deepEqual(monthGridRange(2026, 9), {start: '2026-08-30', end: '2026-10-03'});

const leap = calendarMonthGrid(2024, 2);
assert.equal(leap.find(cell => cell.date === '2024-02-29')?.inCurrentMonth, true);

const saturdayStart = calendarMonthGrid(2026, 8);
assert.equal(saturdayStart.length, 42);
assert.equal(saturdayStart[0].date, '2026-07-26');
assert.equal(saturdayStart[6].date, '2026-08-01');
assert.deepEqual(monthGridRange(2026, 8), {start: '2026-07-26', end: '2026-09-05'});

assert.equal(formatCivilDate(2026, 9, 3), '2026-09-03');
assert.throws(() => calendarMonthGrid(2026, 13), /month/i);

const events = [
  {id: 'late', local_date: '2026-09-20', local_datetime: '2026-09-20T18:30:00', all_day: false},
  {id: 'all-day', local_date: '2026-09-20', local_datetime: null, all_day: true},
  {id: 'early', local_date: '2026-09-20', local_datetime: '2026-09-20T09:00:00', all_day: false},
  {id: 'next-day', local_date: '2026-09-21', local_datetime: null, all_day: true},
];
assert.deepEqual(sortCalendarEvents(events).map(event => event.id), ['all-day', 'early', 'late', 'next-day']);
const grouped = groupCalendarEvents(events);
assert.deepEqual(grouped.get('2026-09-20').map(event => event.id), ['all-day', 'early', 'late']);
assert.deepEqual(grouped.get('2026-09-21').map(event => event.id), ['next-day']);

console.log('LOTBI Calendar month-grid model: PASS');
