import assert from 'node:assert/strict';
import fs from 'node:fs';

const {createGuestCalendarRepository} = await import('../site-calendar-guest.js');
const {buildCalendarTemporal, createCalendarMutationController} = await import('../site-calendar-manager.js');

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
}

assert.deepEqual(buildCalendarTemporal({localDate: '', time: '', allDay: false, timezone: 'Asia/Seoul'}), {
  kind: 'UNSCHEDULED',
});
assert.deepEqual(buildCalendarTemporal({localDate: '2026-09-24', time: '', allDay: false, timezone: 'Asia/Seoul'}), {
  kind: 'DATE_ONLY', local_date: '2026-09-24',
});
assert.deepEqual(buildCalendarTemporal({localDate: '2026-09-24', allDay: true, timezone: 'Asia/Seoul'}), {
  kind: 'DATE_ONLY', local_date: '2026-09-24',
});
assert.deepEqual(buildCalendarTemporal({localDate: '2026-09-24', time: '15:30', allDay: false, timezone: 'Asia/Seoul'}), {
  kind: 'LOCAL_DATE_TIME', local_datetime: '2026-09-24T15:30:00', timezone_name: 'Asia/Seoul',
});

let guestUuidIndex = 0;
const guestRepository = createGuestCalendarRepository(memoryStorage(), {
  uuid: () => `00000000-0000-4000-8000-${String(++guestUuidIndex).padStart(12, '0')}`,
  now: () => new Date('2026-09-20T04:00:00.000Z'),
});
const guest = createCalendarMutationController({guestRepository, timezone: 'Asia/Seoul'});
const guestCreated = await guest.create({
  title: '치과', localDate: '2026-09-24', time: '15:00', allDay: false,
  amountMinor: '12000', expenseCategory: 'FOOD', memo: '정기 검진',
});
assert.equal(guestCreated.title, '치과');
assert.equal(guestCreated.entry.amount_minor, 12000);
assert.equal(guestCreated.entry.expense_category, 'FOOD');
const guestTitleOnly = await guest.create({title: '보험 서류 확인', localDate: '', time: '', allDay: false});
assert.equal(guestTitleOnly.local_date, null);
assert.equal(guestTitleOnly.entry.amount_minor, null);
const guestUpdated = await guest.update(guestCreated, {title: '치과 검진', localDate: '2026-09-25', allDay: true});
assert.equal(guestUpdated.id, guestCreated.id);
assert.equal(guestUpdated.title, '치과 검진');
assert.equal(await guest.remove(guestUpdated), true);
assert.equal(guestRepository.list().length, 1);
assert.equal(guestRepository.list()[0].title, '보험 서류 확인');

const requests = [];
const mutation = {
  activity_id: 'activity_0123456789abcdef0123456789abcdef',
  occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef', title: '병원', activity_state: 'ACTIVE',
  activity_revision: 3, occurrence_revision: 4,
  temporal: {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-09-24T15:00:00', timezone_name: 'Asia/Seoul'},
  entry: {amount_minor: 12000, currency: 'KRW', expense_category: 'FOOD', memo: '점심', place: null, merchant: null},
  temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, read_your_writes: true,
};
const fetchImpl = async (url, init) => {
  requests.push({url, init, body: JSON.parse(init.body)});
  return new Response(JSON.stringify(mutation), {status: init.method === 'POST' && url.endsWith('/activities') ? 201 : 200, headers: {'Content-Type': 'application/json'}});
};
let requestIndex = 0;
const auth = createCalendarMutationController({
  sessionToken: 'site-token', timezone: 'Asia/Seoul', fetchImpl,
  requestId: kind => `req.calendar.${kind}.${++requestIndex}`,
});
await auth.create({title: '병원', localDate: '2026-09-24', time: '15:00', allDay: false});
assert.equal(requests[0].init.method, 'POST');
assert.deepEqual(requests[0].body.temporal, mutation.temporal);
await auth.update(
  {activity_id: mutation.activity_id, activity_revision: 3, occurrence_revision: 4, title: '병원'},
  {title: '병원 검진', localDate: '2026-09-25', allDay: true, amountMinor: '', expenseCategory: '', memo: '변경'},
);
assert.equal(requests[1].init.method, 'PATCH');
assert.match(requests[1].url, /\/entry$/);
assert.equal(requests[1].body.expected_activity_revision, 3);
assert.equal(requests[1].body.expected_occurrence_revision, 4);
assert.equal(requests[1].body.title, '병원 검진');
assert.equal(requests[1].body.entry.amount_minor, null);
assert.equal(requests[1].body.entry.expense_category, null);
assert.deepEqual(requests[1].body.temporal, {kind: 'DATE_ONLY', local_date: '2026-09-25'});
await auth.remove({activity_id: mutation.activity_id, activity_revision: 3});
assert.equal(requests[2].init.method, 'POST');
assert.match(requests[2].url, /\/remove$/);
assert.equal(requests[2].body.expected_revision, 3);

const manager = fs.readFileSync('site-calendar-manager.js', 'utf8');
const legacy = fs.readFileSync('site-calendar-ui.js', 'utf8');
const css = fs.readFileSync('site-calendar.css', 'utf8');
for (const token of [
  'calendar-editor-dialog',
  "setAttribute('role', 'dialog')",
  'calendar-editor-title',
  'calendar-editor-date',
  'calendar-editor-time',
  'calendar-editor-all-day',
  'calendar-editor-amount',
  'calendar-editor-category',
  'calendar-editor-memo',
  'calendar-editor-place',
  'calendar-editor-merchant',
  'calendar-delete-confirm-backdrop',
  'calendar-delete-confirm-dialog',
  "confirmationDialog.setAttribute('aria-modal', 'true')",
  "confirmationDialog.setAttribute('aria-labelledby', 'calendar-delete-confirm-title')",
  "confirmationDialog.setAttribute('aria-describedby', 'calendar-delete-confirm-description')",
  '이 일정을 삭제하시겠습니까?',
  '삭제한 일정은 복구할 수 없습니다.',
  'if (deleteRequestInFlight) return',
  'dialog.inert = true',
  'STALE_REVISION',
]) assert.ok(manager.includes(token), `missing editor contract: ${token}`);
for (const removed of ['calendar-editor-confirm-delete', '이 일정을 삭제할까요?', "button('유지'", "button('삭제 확인'"]) {
  assert.ok(!manager.includes(removed), `legacy inline delete confirmation must be removed: ${removed}`);
}
assert.ok(!manager.includes('prompt('));
assert.ok(!legacy.includes('prompt('));
assert.ok(css.includes('.calendar-editor-dialog'));
assert.ok(css.includes('.calendar-delete-confirm-backdrop'));
assert.ok(css.includes('.calendar-delete-confirm-dialog'));
assert.ok(css.includes('.calendar-delete-confirm-actions button { min-width: 84px; min-height: 44px;'));
assert.ok(!css.includes('.calendar-editor-confirm-delete'));

console.log('LOTBI Calendar event editor and mutation contract: PASS');
