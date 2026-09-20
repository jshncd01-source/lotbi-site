import assert from 'node:assert/strict';

const {calendarMonthGrid, calendarYearOverview} = await import('../site-calendar-model.js');

const year = calendarYearOverview(2026);
assert.equal(year.length, 12);
assert.deepEqual(year.map(month => month.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
for (const month of year) {
  assert.equal(month.year, 2026);
  assert.equal(month.cells.length, 42);
  assert.deepEqual(month.cells, calendarMonthGrid(2026, month.month));
}
assert.equal(year[8].label, '9월');
assert.equal(year[8].cells.find(cell => cell.date === '2026-09-01')?.weekday, 2);
assert.throws(() => calendarYearOverview(0), /year/i);

console.log('LOTBI Calendar year-grid model: PASS');
