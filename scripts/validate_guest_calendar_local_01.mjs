import assert from 'node:assert/strict';

const {GUEST_CALENDAR_STORAGE_KEY, GUEST_CREATE_QUOTA, createGuestCalendarRepository} = await import('../site-calendar-guest.js');

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

// 기타 is one of the six the editor's dropdown offers, and a guest sees the same
// dropdown a signed-in owner does. Without OTHER in this repository's allowlist
// the pick came back as "일정 입력값이 올바르지 않습니다." and nothing saved.
{
  const guest = createGuestCalendarRepository(memoryStorage(), {
    uuid: () => '00000000-0000-4000-8000-0000000000aa',
    now: () => new Date('2026-09-20T04:00:00.000Z'),
  });
  const saved = guest.create({
    title: '병원비',
    local_date: '2026-09-24',
    all_day: true,
    entry: {amount_minor: 48000, currency: 'KRW', expense_category: 'OTHER'},
  });
  assert.equal(saved.entry.expense_category, 'OTHER');
  assert.equal(guest.list()[0].entry.expense_category, 'OTHER');
  // A category nobody offers is still refused: the fix widened the list by one
  // named value, it did not stop checking.
  assert.throws(
    () => guest.create({
      title: '알 수 없는 분류',
      local_date: '2026-09-25',
      all_day: true,
      entry: {amount_minor: 1000, currency: 'KRW', expense_category: 'MISC'},
    }),
    error => error?.code === 'GUEST_CALENDAR_INPUT_INVALID',
  );
}

// ---------------------------------------------------------------------------
// Guest create quota. The rule is a running total of creations, not a count of
// entries held, so deleting must never hand one back.
// ---------------------------------------------------------------------------

function quotaRepository(initial = {}) {
  let index = 0;
  const store = memoryStorage(initial);
  const repo = createGuestCalendarRepository(store, {
    uuid: () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`,
    now: () => new Date('2026-09-23T00:00:00.000Z'),
  });
  return {store, repo};
}

const entry = (title, day) => ({title, local_date: `2026-09-${day}`, all_day: true});
const quotaReached = error => error?.code === 'GUEST_CALENDAR_CREATE_QUOTA_REACHED';

// The quota the product actually ships. If this figure ever moves, it moves in
// one place and this assertion is what notices.
assert.equal(GUEST_CREATE_QUOTA, 3);

// 1. Three creations, then the fourth is refused.
{
  const {repo} = quotaRepository();
  assert.deepEqual(repo.quotaStatus(), {quota: 3, createdCount: 0, remaining: 3, exhausted: false});
  for (let n = 1; n <= GUEST_CREATE_QUOTA; n += 1) {
    repo.create(entry(`일정 ${n}`, String(10 + n)));
    assert.equal(repo.quotaStatus().createdCount, n);
  }
  assert.deepEqual(repo.quotaStatus(), {quota: 3, createdCount: 3, remaining: 0, exhausted: true});
  assert.throws(() => repo.create(entry('네 번째', '20')), quotaReached);
  // The refusal says what happened and what to do, and blames nobody.
  assert.throws(() => repo.create(entry('네 번째', '20')), error => (
    error.message.includes('로그인') && !error.message.includes('오류')
  ));
  assert.equal(repo.list().length, 3);
}

// 2. Deleting does not restore a create. This is the hole the rule exists to
//    close: use all three, delete all three, and there is still nothing left.
{
  const {repo} = quotaRepository();
  const made = [1, 2, 3].map(n => repo.create(entry(`지울 일정 ${n}`, String(10 + n))));
  for (const item of made) assert.equal(repo.remove(item.id), true);
  assert.deepEqual(repo.list(), []);
  assert.deepEqual(repo.quotaStatus(), {quota: 3, createdCount: 3, remaining: 0, exhausted: true});
  assert.throws(() => repo.create(entry('삭제 후 재시도', '21')), quotaReached);
}

// 3. Idempotent replays are the entry that already exists, so they cost
//    nothing — and they keep working after the quota is spent, because a
//    reloaded page still has to resolve them.
{
  const {repo} = quotaRepository();
  const action = ['calact_0123456789abcdef01234567', 'calcand_89abcdef0123456701234567'];
  const first = repo.createForAction(...action, entry('대화 일정', '11'));
  assert.equal(repo.quotaStatus().createdCount, 1);
  for (let n = 0; n < 5; n += 1) {
    assert.equal(repo.createForAction(...action, entry('대화 일정', '11')).id, first.id);
  }
  assert.equal(repo.quotaStatus().createdCount, 1, 'replaying one action must spend one create, not six');

  const requestId = 'calendar-guest-quota-0123456789';
  const direct = repo.createForRequest(requestId, entry('요청 일정', '12'));
  assert.equal(repo.quotaStatus().createdCount, 2);
  for (let n = 0; n < 5; n += 1) {
    assert.equal(repo.createForRequest(requestId, entry('요청 일정', '12')).id, direct.id);
  }
  assert.equal(repo.quotaStatus().createdCount, 2);

  repo.create(entry('세 번째', '13'));
  assert.equal(repo.quotaStatus().exhausted, true);
  // Exhausted, yet both replays still resolve rather than throwing.
  assert.equal(repo.createForAction(...action, entry('대화 일정', '11')).id, first.id);
  assert.equal(repo.createForRequest(requestId, entry('요청 일정', '12')).id, direct.id);
  // A genuinely new one is refused on every path.
  assert.throws(() => repo.create(entry('새 일정', '14')), quotaReached);
  assert.throws(
    () => repo.createForAction('calact_ffffffffffffffffffffffff', 'calcand_ffffffffffffffffffffffff', entry('새 액션', '15')),
    quotaReached,
  );
  assert.throws(() => repo.createForRequest('calendar-guest-quota-9876543210', entry('새 요청', '16')), quotaReached);
}

// 4. Only creating is capped. Reading, editing and deleting stay open, because
//    what a guest already made is theirs.
{
  const {repo} = quotaRepository();
  const made = [1, 2, 3].map(n => repo.create(entry(`보유 일정 ${n}`, String(10 + n))));
  assert.equal(repo.quotaStatus().exhausted, true);
  assert.equal(repo.list().length, 3);
  const edited = repo.update(made[0].id, entry('제목을 바꿔도 된다', '19'));
  assert.equal(edited.title, '제목을 바꿔도 된다');
  assert.equal(edited.created_at, made[0].created_at);
  // Editing is neither a new create nor a refund.
  assert.equal(repo.quotaStatus().createdCount, 3);
  assert.equal(repo.remove(made[2].id), true);
  assert.equal(repo.list().length, 2);
  assert.equal(repo.quotaStatus().createdCount, 3);
}

// 5. Guests who were already using the calendar before the quota existed keep
//    everything. Their stored entries have no count, so the count starts at
//    what they are holding.
{
  const legacyEvents = [1, 2, 3, 4, 5].map(n => ({
    id: `guest_00000000-0000-4000-8000-${String(700 + n).padStart(12, '0')}`,
    title: `예전에 만든 일정 ${n}`,
    local_date: `2026-09-${10 + n}`,
    local_datetime: null,
    all_day: true,
    created_at: '2026-09-19T00:00:00.000Z',
    updated_at: '2026-09-19T00:00:00.000Z',
  }));
  const {repo} = quotaRepository({
    [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({version: 2, events: legacyEvents}),
  });
  // Nothing hidden, nothing dropped — five stored, five readable.
  assert.equal(repo.list().length, 5);
  assert.deepEqual(repo.list().map(item => item.title), legacyEvents.map(item => item.title));
  assert.deepEqual(repo.quotaStatus(), {quota: 3, createdCount: 5, remaining: 0, exhausted: true});
  // Over the quota already, so no new ones — but the five stay usable.
  assert.throws(() => repo.create(entry('새로 추가', '25')), quotaReached);
  assert.equal(repo.update(legacyEvents[0].id, entry('예전 일정 수정', '26')).title, '예전 일정 수정');
  assert.equal(repo.remove(legacyEvents[4].id), true);
  assert.equal(repo.list().length, 4);
  // Deleting one did not drop them back under the quota.
  assert.throws(() => repo.create(entry('삭제 후 추가', '27')), quotaReached);
}

// A legacy guest under the quota keeps the creates they have not used.
{
  const {repo} = quotaRepository({
    [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({
      version: 1,
      events: [{
        id: 'guest_00000000-0000-4000-8000-000000000999',
        title: '예전 v1 일정 하나',
        local_date: '2026-09-23',
        local_datetime: null,
        all_day: true,
        created_at: '2026-09-19T00:00:00.000Z',
        updated_at: '2026-09-19T00:00:00.000Z',
      }],
    }),
  });
  assert.deepEqual(repo.quotaStatus(), {quota: 3, createdCount: 1, remaining: 2, exhausted: false});
  repo.create(entry('두 번째', '24'));
  repo.create(entry('세 번째', '25'));
  assert.throws(() => repo.create(entry('네 번째', '26')), quotaReached);
  assert.equal(repo.list().length, 3);
}

// 6. A count that disagrees with what is stored cannot read below the number of
//    entries actually held.
{
  const {repo} = quotaRepository({
    [GUEST_CALENDAR_STORAGE_KEY]: JSON.stringify({
      version: 2,
      created_count: 0,
      events: [1, 2, 3].map(n => ({
        id: `guest_00000000-0000-4000-8000-${String(800 + n).padStart(12, '0')}`,
        title: `보유 ${n}`,
        local_date: `2026-09-${10 + n}`,
        local_datetime: null,
        all_day: true,
        created_at: '2026-09-19T00:00:00.000Z',
        updated_at: '2026-09-19T00:00:00.000Z',
      })),
    }),
  });
  assert.equal(repo.quotaStatus().createdCount, 3);
  assert.throws(() => repo.create(entry('0으로 되돌린 뒤 추가', '28')), quotaReached);
}

// 7. The body must not fall over. A storage that cannot be read reports an
//    empty calendar the guest can still use — never "you are out of entries".
{
  for (const broken of ['{broken', 'null', JSON.stringify({version: 9, events: []})]) {
    const repo = createGuestCalendarRepository(memoryStorage({[GUEST_CALENDAR_STORAGE_KEY]: broken}), {
      uuid: () => crypto.randomUUID(),
    });
    assert.deepEqual(repo.list(), []);
    assert.equal(repo.quotaStatus().exhausted, false, 'an unreadable store must not present as an exhausted quota');
    assert.equal(repo.create(entry('복구 후 첫 일정', '22')).title, '복구 후 첫 일정');
  }
}

// 8. The stored shape stays on version 2 on purpose, so a browser still running
//    the previous bundle reads these entries instead of finding nothing.
{
  const {store, repo} = quotaRepository();
  repo.create(entry('버전 확인', '23'));
  const persisted = JSON.parse(store.getItem(GUEST_CALENDAR_STORAGE_KEY));
  assert.equal(persisted.version, 2);
  assert.equal(persisted.created_count, 1);
  assert.equal(persisted.events.length, 1);
  assert.ok(!JSON.stringify(persisted).match(/bearer|session|token|credential|password/i));
  // What the previous bundle does with this payload: same version check, same
  // events array, extra key ignored.
  assert.ok([1, 2].includes(persisted.version) && Array.isArray(persisted.events));
}

// 9. An invalid entry is reported as invalid even with nothing left, so a guest
//    is not sent chasing the quota over a blank title — and garbage never
//    spends one of the three.
{
  const {repo} = quotaRepository();
  assert.throws(() => repo.create({title: ' ', local_date: '2026-09-20', all_day: true}),
    error => error?.code === 'GUEST_CALENDAR_INPUT_INVALID');
  assert.equal(repo.quotaStatus().createdCount, 0, 'a rejected entry must not spend a create');
  [1, 2, 3].forEach(n => repo.create(entry(`채우기 ${n}`, String(10 + n))));
  assert.throws(() => repo.create({title: ' ', local_date: '2026-09-20', all_day: true}),
    error => error?.code === 'GUEST_CALENDAR_INPUT_INVALID');
}

// 10. The holding cap is a separate safety valve and still reports separately.
{
  const store = memoryStorage();
  const repo = createGuestCalendarRepository(store, {limit: 2, createQuota: 9, uuid: () => crypto.randomUUID()});
  repo.create(entry('하나', '11'));
  repo.create(entry('둘', '12'));
  assert.throws(() => repo.create(entry('셋', '13')), error => error?.code === 'GUEST_CALENDAR_LIMIT_REACHED');
  assert.equal(repo.quotaStatus().remaining, 7);
}

// 11. The browser's id generator is not a precondition for saving.
//
// Samsung Internet before 16 and older Android WebViews have no
// crypto.randomUUID. The repository used to throw there, so a signed-out writer
// filled the whole form, pressed 저장, and was told "일정 식별자를 만들 수
// 없습니다." — an internal word they could do nothing with. Every tier below
// must save, and must produce the same v4 shape GUEST_ID_PATTERN accepts.
{
  const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const realCrypto = globalThis.crypto;
  const getRandomValues = realCrypto.getRandomValues.bind(realCrypto);
  const withCrypto = async (label, value) => {
    Object.defineProperty(globalThis, 'crypto', {value, configurable: true, writable: true});
    try {
      // A fresh module instance per tier: the tiers are chosen at call time, but
      // importing again keeps each case independent of the others.
      const module = await import(`../site-calendar-guest.js?tier=${encodeURIComponent(label)}`);
      const repo = module.createGuestCalendarRepository(memoryStorage(), {createQuota: 1000, limit: 1000});

      // 대표님's exact entry: 종일 checked, a cost, and every optional field.
      const full = repo.create({
        title: 'Ejejeie',
        local_date: '2026-09-10',
        local_datetime: null,
        all_day: true,
        entry: {
          amount_minor: 2626,
          currency: 'KRW',
          expense_category: 'UNCLASSIFIED',
          memo: 'Nejej',
          place: 'Kekeke',
          merchant: 'Ekekke',
        },
      });
      assert.match(full.id, GUEST_ID, `${label}: id must keep the v4 shape`);
      assert.equal(full.title, 'Ejejeie');
      assert.equal(full.all_day, true);
      assert.equal(full.entry.amount_minor, 2626);
      assert.equal(full.entry.merchant, 'Ekekke');

      // The rule the editor states: a title alone is enough.
      const titleOnly = repo.create({title: '제목만'});
      assert.match(titleOnly.id, GUEST_ID, `${label}: a title alone must save`);
      assert.equal(titleOnly.local_date, null);

      // A fallback id is worthless if it repeats. 1000 in a row, all distinct.
      const ids = new Set([full.id, titleOnly.id]);
      for (let index = 0; index < 998; index += 1) ids.add(repo.create({title: `대량 ${index}`}).id);
      assert.equal(ids.size, 1000, `${label}: ids must not collide`);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {value: realCrypto, configurable: true, writable: true});
    }
  };

  await withCrypto('randomUUID', realCrypto);
  await withCrypto('getRandomValues-only', {getRandomValues});
  await withCrypto('no-web-crypto', undefined);
  // Some WebViews expose randomUUID outside a secure context and throw on call.
  await withCrypto('randomUUID-throws', {
    randomUUID() { throw new Error('not a secure context'); },
    getRandomValues,
  });
}

// 12. A storage that refuses the write says so in words the writer can act on.
//
// Secret mode, blocked site data and a full origin all arrive as a DOMException
// whose message is English and about quotas. That is not something to put on
// screen under the 저장 button.
{
  const refusing = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError: storage is full'); },
  };
  const repo = createGuestCalendarRepository(refusing);
  assert.throws(
    () => repo.create({title: '시크릿 모드'}),
    error => error?.code === 'GUEST_CALENDAR_STORAGE_UNAVAILABLE'
      && !/Quota|Error:/.test(error.message)
      && error.message.includes('로그인'),
    'a refused write must explain itself in Korean and offer the way forward',
  );
}

console.log('LOTBI Guest Calendar local repository: PASS');
