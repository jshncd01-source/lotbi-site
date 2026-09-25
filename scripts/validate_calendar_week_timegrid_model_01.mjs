import assert from 'node:assert/strict';

const {calendarWeekTimeGrid, layoutTimedEvents} = await import('../site-calendar-product.js');

const day = '2026-09-23'; // a Wednesday
const timed = (id, start, end, more = {}) => ({
  id, title: id, local_date: day, local_datetime: `${day}T${start}:00`,
  local_end_date: day, local_end_datetime: `${day}T${end}:00`, all_day: false, ...more,
});
const allDay = (id, date = day, more = {}) => ({
  id, title: id, local_date: date, local_datetime: null, all_day: true, ...more,
});

// --- layoutTimedEvents: lane packing -----------------------------------

// Two events that only touch (one ends exactly when the other starts) must
// not be forced to split width -- they are never simultaneously visible.
const touching = layoutTimedEvents([{item: 'a', start: 540, end: 600}, {item: 'b', start: 600, end: 660}]);
assert.deepEqual(touching.map(e => [e.item, e.lane, e.laneCount]).sort(), [['a', 0, 1], ['b', 0, 1]]);

// Two truly-overlapping events split into two lanes.
const overlap = layoutTimedEvents([{item: 'a', start: 540, end: 600}, {item: 'b', start: 570, end: 630}]);
const byItem = id => overlap.find(e => e.item === id);
assert.equal(byItem('a').lane, 0);
assert.equal(byItem('b').lane, 1);
assert.equal(byItem('a').laneCount, 2);
assert.equal(byItem('b').laneCount, 2);

// A spans the whole window; B and C sit inside it but never overlap each
// other, so they may share a lane while A keeps its own.
const nested = layoutTimedEvents([
  {item: 'A', start: 540, end: 660}, {item: 'B', start: 570, end: 600}, {item: 'C', start: 630, end: 660},
]);
assert.equal(nested.find(e => e.item === 'A').lane, 0);
assert.equal(nested.find(e => e.item === 'B').lane, 1);
assert.equal(nested.find(e => e.item === 'C').lane, 1);
assert.ok(nested.every(e => e.laneCount === 2));

// Unrelated clusters (different days' worth of gap) do not inflate each
// other's lane counts.
const twoClusters = layoutTimedEvents([
  {item: 'p', start: 540, end: 600}, {item: 'q', start: 570, end: 630},
  {item: 'x', start: 900, end: 960}, {item: 'y', start: 930, end: 990}, {item: 'z', start: 930, end: 990},
]);
assert.equal(twoClusters.find(e => e.item === 'p').laneCount, 2);
assert.equal(twoClusters.find(e => e.item === 'x').laneCount, 3);

// --- calendarWeekTimeGrid: per-day split + minute positioning ----------

const grid = calendarWeekTimeGrid(day, [
  timed('morning', '09:00', '10:00'),
  timed('overlap-a', '09:30', '10:30'),
  allDay('holiday', day),
]);
assert.equal(grid.length, 7);
assert.deepEqual(grid.map(d => d.date), [
  '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
]);
const wednesday = grid.find(d => d.date === day);
assert.equal(wednesday.allDay.length, 1);
assert.equal(wednesday.allDay[0].id, 'holiday');
assert.equal(wednesday.timed.length, 2);
const morning = wednesday.timed.find(e => e.item.id === 'morning');
assert.equal(morning.start, 540); // 09:00
assert.equal(morning.end, 600); // 10:00
assert.equal(morning.laneCount, 2);
assert.ok(grid.find(d => d.date === '2026-09-20').timed.length === 0);
assert.ok(grid.find(d => d.date === '2026-09-20').allDay.length === 0);

// A plain appointment with no end time gets a default one-hour block.
const noEnd = calendarWeekTimeGrid(day, [
  {id: 'no-end', title: 'no-end', local_date: day, local_datetime: `${day}T22:30:00`, all_day: false},
]).find(d => d.date === day);
assert.equal(noEnd.timed[0].start, 1350);
assert.equal(noEnd.timed[0].end, 1410);

// A very short recorded span still gets a minimum-height block so it stays
// tappable, without leaking outside the day.
const short = calendarWeekTimeGrid(day, [timed('short', '23:50', '23:55')]).find(d => d.date === day);
assert.equal(short.timed[0].start, 1430);
assert.equal(short.timed[0].end, 1440);

// A multi-day stay is clipped to each day's 0..1440 range instead of
// running off the grid or vanishing on the far side.
const stayStart = '2026-09-22';
const stayEnd = '2026-09-24';
const stay = calendarWeekTimeGrid(day, [{
  id: 'stay', title: 'stay', local_date: stayStart, local_datetime: `${stayStart}T22:00:00`,
  local_end_date: stayEnd, local_end_datetime: `${stayEnd}T08:00:00`, all_day: false,
}]);
const firstNight = stay.find(d => d.date === stayStart).timed[0];
assert.equal(firstNight.start, 1320); // 22:00
assert.equal(firstNight.end, 1440); // clipped to end of day
const middleDay = stay.find(d => d.date === '2026-09-23').timed[0];
assert.equal(middleDay.start, 0);
assert.equal(middleDay.end, 1440);
const lastMorning = stay.find(d => d.date === stayEnd).timed[0];
assert.equal(lastMorning.start, 0);
assert.equal(lastMorning.end, 480); // 08:00
assert.ok(!stay.find(d => d.date === '2026-09-25').timed.length);

// A multi-day all-day holiday appears on every date it covers, not just the
// first.
const spanHoliday = calendarWeekTimeGrid(day, [{
  id: 'holiday-span', title: 'holiday-span', local_date: '2026-09-21', local_datetime: null, all_day: true,
  local_end_date: '2026-09-22',
}]);
assert.deepEqual(
  spanHoliday.filter(d => d.allDay.some(e => e.id === 'holiday-span')).map(d => d.date),
  ['2026-09-21', '2026-09-22'],
);

console.log('LOTBI Calendar week time-grid model: PASS');
