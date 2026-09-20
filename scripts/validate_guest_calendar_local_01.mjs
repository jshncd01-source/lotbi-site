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

const corrupt = createGuestCalendarRepository(memoryStorage({[GUEST_CALENDAR_STORAGE_KEY]: '{broken'}));
assert.deepEqual(corrupt.list(), []);
const oldVersion = createGuestCalendarRepository(memoryStorage({
  [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({version: 0, events: [{title: 'old'}]}),
}));
assert.deepEqual(oldVersion.list(), []);

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
assert.equal(persisted.version, 1);
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
