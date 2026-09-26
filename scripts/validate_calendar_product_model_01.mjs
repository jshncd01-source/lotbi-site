import assert from 'node:assert/strict';

const {
  calendarWeekDays,
  weekAgendaGroups,
  monthCellSummary,
  calendarEventPresentation,
  filterScheduleItems,
  calendarWeatherPresentation,
} = await import('../site-calendar-product.js');

// Mutation targets: wrong week start, date rollover, or silently dropping empty days.
assert.deepEqual(calendarWeekDays('2026-09-01').map(day => day.date), [
  '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
  '2026-09-03', '2026-09-04', '2026-09-05',
]);
assert.deepEqual(calendarWeekDays('2026-09-01', 1).map(day => day.date), [
  '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
  '2026-09-04', '2026-09-05', '2026-09-06',
]);
assert.deepEqual(calendarWeekDays('2027-01-01').map(day => day.date).slice(0, 2), ['2026-12-27', '2026-12-28']);
assert.throws(() => calendarWeekDays('2026-02-30'), /date/i);
assert.throws(() => calendarWeekDays('2026-09-01', 7), /weekStart/i);

const day = '2026-09-01';
const event = (id, date = day, more = {}) => ({
  id, title: `일정 ${id}`, local_date: date, local_datetime: null, all_day: true,
  ...more,
});
const packed = Array.from({length: 15}, (_, index) => event(`item-${index}`));
const outside = event('outside', '2026-09-07');
const early = event('early', day, {local_datetime: '2026-09-01T09:00:00', all_day: false});
const late = event('late', day, {local_datetime: '2026-09-01T18:00:00', all_day: false});
const groups = weekAgendaGroups(day, [late, outside, event('monday', '2026-08-31'), early]);
assert.equal(groups.length, 7);
assert.deepEqual(groups.map(group => group.date), calendarWeekDays(day).map(value => value.date));
assert.deepEqual(groups[2].items.map(item => item.id), ['early', 'late']);
assert.equal(groups[0].items.length, 0);
assert.equal(groups[1].items[0].id, 'monday');
assert.equal(groups.some(group => group.items.includes(outside)), false);

for (const count of [0, 1, 7, 15]) {
  const summary = monthCellSummary(packed.slice(0, count));
  assert.equal(summary.count, count);
  assert.equal(summary.visible.length, Math.min(count, 2));
  assert.equal(summary.remaining, Math.max(0, count - 2));
  assert.equal(summary.moreLabel, count > 2 ? `+${count - 2}` : '');
}
assert.deepEqual(monthCellSummary([late, early]).visible.map(item => item.id), ['early', 'late']);
assert.equal(monthCellSummary(packed, {visibleLimit: 0}).moreLabel, '+15');
const clamped = monthCellSummary(packed, {visibleLimit: 9});
assert.deepEqual(
  {visible: clamped.visible.length, remaining: clamped.remaining, moreLabel: clamped.moreLabel},
  {visible: 2, remaining: 13, moreLabel: '+13'},
);
assert.throws(() => monthCellSummary(packed, {visibleLimit: -1}), /visibleLimit/i);

// Mutation targets: inferred category/status from a vague title, false provider
// verification, dropping explicit entry metadata or conflating type and state.
const ordinary = calendarEventPresentation(event('plain', day, {title: '회의'}));
assert.equal(ordinary.kind, 'NORMAL');
assert.equal(ordinary.typeLabel, '일정');
assert.equal(ordinary.statusLabel, '');
assert.equal(calendarEventPresentation(event('vague', day, {title: '예약 확인 필요'})).statusLabel, '');
assert.equal(calendarEventPresentation(event('reservation', day, {title: '호텔 예약', entry: {place: '제주'}})).kind, 'RESERVATION');
assert.equal(calendarEventPresentation(event('medical', day, {title: '치과 진료'})).kind, 'MEDICAL');
const paid = event('paid', day, {title: '장보기', entry: {amount_minor: 12500, currency: 'KRW', merchant: '시장'}});
const paidView = calendarEventPresentation(paid);
assert.equal(paidView.kind, 'PAYMENT');
assert.match(paidView.metaText, /시장/);
assert.match(paidView.metaText, /12,500원/);
const usdView = calendarEventPresentation(event('usd', day,
  {entry: {amount_minor: 1250, currency: 'USD', merchant: 'Shop'}}));
assert.equal(usdView.metaText, 'Shop · $12.50');
assert.equal(calendarEventPresentation(event('unsupported-currency', day,
  {entry: {amount_minor: 1250, currency: 'EUR'}})).metaText, '');
assert.equal(calendarEventPresentation(event('zero', day, {entry: {amount_minor: 0}})).kind, 'PAYMENT');
assert.equal(calendarEventPresentation(event('place', day, {entry: {place: '강당'}})).metaText, '강당');
assert.equal(calendarEventPresentation(event('source', day, {source_kind: 'USER_INPUT', confirmation_level: 'USER_ATTESTED'})).sourceLabel, '직접 입력');
assert.equal(calendarEventPresentation(event('guest', day, {id: 'guest_123'})).sourceLabel, '이 기기에 저장');
assert.equal(calendarEventPresentation(event('unverified', day, {confirmation_level: 'PROVIDER_VERIFIED', provider_verified: false})).sourceLabel, '');
assert.equal(calendarEventPresentation(event('verified', day, {confirmation_level: 'PROVIDER_VERIFIED', provider_verified: true})).sourceLabel, '외부 확인됨');
assert.equal(calendarEventPresentation(event('overdue', day, {calendar_attention_state: 'OVERDUE'})).statusLabel, '기한 지남');
assert.equal(calendarEventPresentation(event('window', day, {
  local_datetime: '2026-09-01T15:00:00', all_day: false,
  local_end_date: '2026-09-02', local_end_datetime: '2026-09-02T11:00:00',
})).spanLabel, '09/01 15:00 → 09/02 11:00');

const schedule = [event('previous', '2026-08-30'), paid, event('next', '2026-09-05'),
  event('oct', '2026-10-01'), event('undated', null),
  event('booking', day, {title: '항공권 예약', local_datetime: '2026-09-01T09:00:00', all_day: false}),
  event('exam', day, {title: '내과 진료', local_datetime: '2026-09-01T18:00:00', all_day: false})];
const ids = (scope, opts = {}) => filterScheduleItems(schedule, scope, {today: day, ...opts}).map(item => item.id);
assert.deepEqual(ids('today'), ['paid', 'booking', 'exam']);
assert.deepEqual(ids('week'), ['previous', 'paid', 'booking', 'exam', 'next']);
assert.deepEqual(ids('week', {weekStart: 1}), ['paid', 'booking', 'exam', 'next']);
assert.deepEqual(ids('month'), ['paid', 'booking', 'exam', 'next']);
assert.deepEqual(ids('reservation'), ['booking']);
assert.deepEqual(ids('payment'), ['paid']);
assert.deepEqual(ids('schedule'), ['previous', 'next', 'oct', 'undated']);
assert.deepEqual(ids('all'), schedule.map(item => item.id));
const reverseTimed = [late, early, event('all-day')];
for (const scope of ['today', 'week', 'month']) {
  assert.deepEqual(filterScheduleItems(reverseTimed, scope, {today: day}).map(item => item.id),
    ['all-day', 'early', 'late'], `${scope} keeps the same within-day chronology as Week/Month`);
}

assert.deepEqual(calendarWeatherPresentation(null), {monthLabel: '', weekLabel: '', precipLabel: ''});
assert.deepEqual(calendarWeatherPresentation({temperature: 22.6, minTemperature: 18.1, maxTemperature: 27.8}),
  {monthLabel: '18° / 28°', weekLabel: '18° / 28°', precipLabel: ''});
assert.deepEqual(calendarWeatherPresentation({minTemperature: 0, maxTemperature: 5}),
  {monthLabel: '0° / 5°', weekLabel: '0° / 5°', precipLabel: ''});
assert.deepEqual(calendarWeatherPresentation({temperature: null}), {monthLabel: '', weekLabel: '', precipLabel: ''});
// 0%는 "정보 없음"이 아니라 "비 안 옴"이라 숨긴다; 양의 확률만 표시한다.
assert.deepEqual(calendarWeatherPresentation({minTemperature: 0, maxTemperature: 5, precipitationProbability: 0}),
  {monthLabel: '0° / 5°', weekLabel: '0° / 5°', precipLabel: ''});
assert.deepEqual(calendarWeatherPresentation({minTemperature: 0, maxTemperature: 5, precipitationProbability: 42}),
  {monthLabel: '0° / 5°', weekLabel: '0° / 5°', precipLabel: '💧42%'});

console.log('LOTBI Calendar product model: PASS');
