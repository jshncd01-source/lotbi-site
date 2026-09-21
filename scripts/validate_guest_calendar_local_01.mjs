import assert from 'node:assert/strict';

const {GUEST_CALENDAR_STORAGE_KEY, createGuestCalendarRepository} = await import('../site-calendar-guest.js');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

const storage = memoryStorage({'lotbi.session.token': 'never-touch'});
let uuidIndex = 0;
const repository = createGuestCalendarRepository(storage, {
  uuid: () => `00000000-0000-4000-8000-${String(++uuidIndex).padStart(12, '0')}`,
  now: () => new Date('2026-09-20T04:00:00.000Z'),
});

assert.deepEqual(repository.list(), []);
const created = repository.create({
  title: '치과',
  local_date: '2026-09-24',
  local_datetime: '2026-09-24T15:00:00',
  all_day: false,
  bearer: 'must-not-persist',
});
assert.match(created.id, /^guest_[0-9a-f-]{36}$/);
assert.equal(created.title, '치과');
assert.equal(created.created_at, '2026-09-20T04:00:00.000Z');
assert.equal(created.updated_at, created.created_at);
assert.equal('bearer' in created, false);
assert.equal(storage.getItem('lotbi.session.token'), 'never-touch');

const reloaded = createGuestCalendarRepository(storage);
assert.deepEqual(reloaded.list(), [created]);
const updated = reloaded.update(created.id, {
  title: '치과 검진',
  local_date: '2026-09-25',
  local_datetime: null,
  all_day: true,
});
assert.equal(updated.id, created.id);
assert.equal(updated.created_at, created.created_at);
assert.equal(updated.title, '치과 검진');
assert.equal(updated.local_date, '2026-09-25');
assert.equal(updated.all_day, true);
assert.equal(reloaded.remove(created.id), true);
assert.deepEqual(reloaded.list(), []);
assert.equal(reloaded.remove(created.id), false);

const actionCreated = reloaded.createForAction(
  'calact_0123456789abcdef01234567',
  'calcand_89abcdef0123456701234567',
  {
    title: '대화에서 등록한 치과',
    local_date: '2026-09-26',
    local_datetime: '2026-09-26T14:00:00',
    all_day: false,
  },
);
const actionReplay = reloaded.createForAction(
  'calact_0123456789abcdef01234567',
  'calcand_89abcdef0123456701234567',
  {
    title: '대화에서 등록한 치과',
    local_date: '2026-09-26',
    local_datetime: '2026-09-26T14:00:00',
    all_day: false,
  },
);
assert.equal(actionReplay.id, actionCreated.id);
assert.equal(actionReplay.calendar_action_id, 'calact_0123456789abcdef01234567');
assert.equal(actionReplay.calendar_candidate_id, 'calcand_89abcdef0123456701234567');
assert.equal(reloaded.list().filter(item => item.calendar_action_id === 'calact_0123456789abcdef01234567').length, 1);
assert.throws(
  () => reloaded.createForAction(
    'calact_0123456789abcdef01234567',
    'calcand_ffffffffffffffffffffffff',
    {title: '다른 payload', local_date: '2026-09-27', all_day: true},
  ),
  error => error?.code === 'GUEST_CALENDAR_ACTION_CONFLICT',
);
const actionUpdated = reloaded.update(actionCreated.id, {
  title: '대화에서 등록한 치과 변경',
  local_date: '2026-09-27',
  local_datetime: '2026-09-27T14:00:00',
  all_day: false,
});
assert.equal(actionUpdated.calendar_action_id, actionCreated.calendar_action_id);
assert.equal(actionUpdated.calendar_candidate_id, actionCreated.calendar_candidate_id);

const directCreated = reloaded.createForRequest('calendar-guest-direct-0123456789', {
  title: '직접 명령 치과',
  local_date: '2026-09-28',
  local_datetime: '2026-09-28T11:00:00',
  all_day: false,
});
const directReplay = reloaded.createForRequest('calendar-guest-direct-0123456789', {
  title: '직접 명령 치과',
  local_date: '2026-09-28',
  local_datetime: '2026-09-28T11:00:00',
  all_day: false,
});
assert.equal(directReplay.id, directCreated.id);
assert.equal(directReplay.calendar_request_id, 'calendar-guest-direct-0123456789');
assert.equal(reloaded.list().filter(item => item.calendar_request_id === 'calendar-guest-direct-0123456789').length, 1);
assert.throws(
  () => reloaded.createForRequest('calendar-guest-direct-0123456789', {
    title: '변경된 직접 명령',
    local_date: '2026-09-29',
    all_day: true,
  }),
  error => error?.code === 'GUEST_CALENDAR_REQUEST_CONFLICT',
);

const corrupt = createGuestCalendarRepository(memoryStorage({[GUEST_CALENDAR_STORAGE_KEY]: '{broken'}));
assert.deepEqual(corrupt.list(), []);
const oldVersion = createGuestCalendarRepository(memoryStorage({
  [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({version: 0, events: [{title: 'old'}]}),
}));
assert.deepEqual(oldVersion.list(), []);

const v1Compatible = createGuestCalendarRepository(memoryStorage({
  [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({
    version: 1,
    events: [{
      id: 'guest_00000000-0000-4000-8000-000000000777',
      title: '기존 v1 일정',
      local_date: '2026-09-23',
      local_datetime: null,
      all_day: true,
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
    }],
  }),
}));
assert.equal(v1Compatible.list().length, 1);
assert.equal(v1Compatible.list()[0].title, '기존 v1 일정');
assert.deepEqual(v1Compatible.list()[0].entry, {
  amount_minor: null,
  currency: 'KRW',
  expense_category: null,
  memo: null,
  place: null,
  merchant: null,
});

const limited = createGuestCalendarRepository(memoryStorage(), {
  limit: 2,
  uuid: () => crypto.randomUUID(),
});
limited.create({title: '하나', local_date: '2026-09-20', all_day: true});
limited.create({title: '둘', local_date: '2026-09-21', all_day: true});
assert.throws(
  () => limited.create({title: '셋', local_date: '2026-09-22', all_day: true}),
  error => error?.code === 'GUEST_CALENDAR_LIMIT_REACHED',
);

const persisted = JSON.parse(storage.getItem(GUEST_CALENDAR_STORAGE_KEY));
assert.equal(persisted.version, 2);
assert.ok(!JSON.stringify(persisted).match(/bearer|session|token|credential|password/i));
assert.deepEqual(Object.keys(storage.dump()).sort(), [GUEST_CALENDAR_STORAGE_KEY, 'lotbi.session.token']);

assert.throws(
  () => repository.create({title: ' ', local_date: '2026-09-20', all_day: true}),
  error => error?.code === 'GUEST_CALENDAR_INPUT_INVALID',
);
assert.throws(
  () => repository.create({title: '잘못된 날짜', local_date: '2026-02-30', all_day: true}),
  error => error?.code === 'GUEST_CALENDAR_INPUT_INVALID',
);

console.log('LOTBI Guest Calendar local repository: PASS');
