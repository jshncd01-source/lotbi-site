// FESTIVAL-EVENT-10 — Festival -> LOTBI Calendar bridge.
//
// Pure-function / mocked-fetch tests, no browser, following the same
// approach as scripts/validate_festival_public_boundary_01.mjs and
// scripts/validate_life_calendar_client_01.mjs.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridge = await import(path.join(ROOT, 'site-festival-calendar.js'));
const guestModule = await import(path.join(ROOT, 'site-calendar-guest.js'));

const {
  VISIT_SCOPE,
  addFestivalVisitToCalendar,
  defaultProgramSelectedDate,
  festivalLinkFromCalendarItem,
  festivalVisitDateOptions,
  readFestivalCalendarLink,
  writeFestivalCalendarLink,
} = bridge;
const {createGuestCalendarRepository} = guestModule;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
  };
}

const FESTIVAL_3D = Object.freeze({id: 'fest_gimje_horizon', name: '김제 지평선축제', startDate: '2026-10-07', endDate: '2026-10-09', venueName: '김제 벽골제'});
const FESTIVAL_5D = Object.freeze({id: 'fest_five_day', name: '5일 축제', startDate: '2026-10-07', endDate: '2026-10-11', venueName: '테스트 광장'});
const FESTIVAL_1D = Object.freeze({id: 'fest_one_day', name: '하루 축제', startDate: '2026-11-01', endDate: '2026-11-01', address: '테스트 주소'});

// ------------------------------------------------------- visit date options --
assert.deepEqual(festivalVisitDateOptions(FESTIVAL_3D), ['2026-10-07', '2026-10-08', '2026-10-09'], '3-day festival must offer exactly 3 visit dates');
assert.deepEqual(festivalVisitDateOptions(FESTIVAL_5D), ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'], '5-day festival must offer exactly 5 visit dates');
assert.deepEqual(festivalVisitDateOptions(FESTIVAL_1D), ['2026-11-01']);
assert.deepEqual(festivalVisitDateOptions({startDate: '2026-10-09', endDate: '2026-10-07'}), [], 'an inverted range must never produce dates');
assert.deepEqual(festivalVisitDateOptions({}), []);

// -------------------------------------------------- program default policy --
assert.equal(defaultProgramSelectedDate([]), '', 'no program dates must never invent a selected date');
assert.equal(
  defaultProgramSelectedDate(['2026-10-08', '2026-10-07'], {initialSelectedDate: '2026-10-08', now: new Date('2026-10-07T03:00:00+09:00')}),
  '2026-10-08',
  'a valid initialSelectedDate (Calendar re-entry) must win even when today also has a program',
);
assert.equal(
  defaultProgramSelectedDate(['2026-10-07', '2026-10-08'], {initialSelectedDate: '2026-12-25', now: new Date('2026-10-07T03:00:00+09:00')}),
  '2026-10-07',
  'an initialSelectedDate with no programs must fall back to today',
);
assert.equal(
  defaultProgramSelectedDate(['2026-10-09', '2026-10-10'], {now: new Date('2026-10-07T03:00:00+09:00')}),
  '2026-10-09',
  'no usable initial date and today has no program must pick the nearest upcoming programmed date',
);
assert.equal(
  defaultProgramSelectedDate(['2026-09-01'], {now: new Date('2026-10-07T03:00:00+09:00')}),
  '2026-09-01',
  'no upcoming programmed date must fall back to the earliest one, never today',
);

// --------------------------------------------------------------- Guest path --
{
  const repo = createGuestCalendarRepository(memoryStorage(), {createQuota: 10});
  const created = await addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitDate: '2026-10-08', visitScope: VISIT_SCOPE.DATE, authenticated: false, guestRepository: repo});
  assert.equal(created.status, 'CREATED');
  assert.equal(created.item.title, FESTIVAL_3D.name);
  assert.equal(created.item.local_date, '2026-10-08');
  assert.equal(created.item.local_end_date, null, 'a single-day visit must not carry an end date');
  assert.equal(created.item.all_day, true, 'a visit must never fabricate a time of day');
  assert.equal(created.item.source_kind, 'FESTIVAL');
  assert.equal(created.item.source_ref, FESTIVAL_3D.id);
  assert.equal(created.item.visit_scope, VISIT_SCOPE.DATE);
  assert.equal(created.item.visit_date, '2026-10-08');
  assert.equal(created.item.entry.place, FESTIVAL_3D.venueName, 'the venue name must be stored as the Calendar place');
  assert.equal(created.item.entry.amount_minor, null, 'a festival visit must never auto-record an expense');
  assert.ok(!('place_latitude' in created.item) && !('latitude' in created.item), 'no fabricated coordinate must ever be stored');

  // Round-trips through storage, not just the in-memory return value.
  const stored = repo.list().find(event => event.id === created.item.id);
  assert.equal(stored.source_ref, FESTIVAL_3D.id, 'the festival link must survive the storage round-trip (refresh-safe)');

  // Same festival + same date again -> DUPLICATE, no second entry.
  const duplicate = await addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitDate: '2026-10-08', visitScope: VISIT_SCOPE.DATE, authenticated: false, guestRepository: repo});
  assert.equal(duplicate.status, 'DUPLICATE');
  assert.equal(repo.list().length, 1, 'a duplicate add must never create a second Calendar item');

  // Same festival + a different date -> allowed.
  const otherDate = await addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitDate: '2026-10-09', visitScope: VISIT_SCOPE.DATE, authenticated: false, guestRepository: repo});
  assert.equal(otherDate.status, 'CREATED', 'a different visit date for the same festival must be allowed, not treated as a duplicate');
  assert.equal(repo.list().length, 2);

  // A date outside the festival's own range must be rejected.
  await assert.rejects(
    () => addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitDate: '2026-10-20', visitScope: VISIT_SCOPE.DATE, authenticated: false, guestRepository: repo}),
    RangeError,
    'a visit date outside [startDate, endDate] must be rejected',
  );

  // Full-range scope.
  const full = await addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitScope: VISIT_SCOPE.FULL_RANGE, authenticated: false, guestRepository: repo});
  assert.equal(full.status, 'CREATED');
  assert.equal(full.item.local_date, FESTIVAL_3D.startDate);
  assert.equal(full.item.local_end_date, FESTIVAL_3D.endDate, 'FULL_RANGE must be one DATE_RANGE entry across the whole run, not one entry per day');
  assert.equal(full.item.visit_scope, VISIT_SCOPE.FULL_RANGE);
  assert.ok(!('visit_date' in full.item) || full.item.visit_date == null);

  const fullDuplicate = await addFestivalVisitToCalendar({festival: FESTIVAL_3D, visitScope: VISIT_SCOPE.FULL_RANGE, authenticated: false, guestRepository: repo});
  assert.equal(fullDuplicate.status, 'DUPLICATE', 'adding the same festival as FULL_RANGE twice must not duplicate');
  assert.equal(repo.list().length, 3, '2 dated visits + 1 full-range visit, no more');

  // An ordinary (non-festival) Guest entry must still work, unaffected.
  const plain = repo.create({title: '병원 예약', local_date: '2026-10-15'});
  assert.equal(plain.source_kind, undefined, 'an ordinary entry must carry no festival fields at all');

  // Calendar item -> festival identity round-trip (re-entry).
  const link = festivalLinkFromCalendarItem(stored);
  assert.deepEqual(link, {festivalId: FESTIVAL_3D.id, visitDate: '2026-10-08', visitScope: VISIT_SCOPE.DATE});
  assert.equal(festivalLinkFromCalendarItem(plain), null, 'an ordinary entry must never resolve to a festival link');
}

// -------------------------------------------------------- Guest schema guard --
{
  const repo = createGuestCalendarRepository(memoryStorage());
  assert.throws(() => repo.create({title: 'x', local_date: '2026-10-08', source_ref: 'fest_x'}), 'source_ref without source_kind must be rejected');
  assert.throws(() => repo.create({title: 'x', local_date: '2026-10-08', source_kind: 'FESTIVAL'}), 'FESTIVAL source_kind without source_ref/visit_scope must be rejected');
  assert.throws(
    () => repo.create({title: 'x', local_date: '2026-10-08', source_kind: 'FESTIVAL', source_ref: 'fest_x', visit_scope: 'FULL_RANGE', visit_date: '2026-10-08'}),
    'FULL_RANGE must never carry a visit_date',
  );
  assert.throws(
    () => repo.create({title: 'x', local_date: '2026-10-08', source_kind: 'FESTIVAL', source_ref: 'fest_x', visit_scope: 'DATE'}),
    'DATE scope must require a visit_date',
  );
}

// --------------------------------------------------------- Authenticated path --
{
  const storage = memoryStorage();
  const calls = [];
  const activityId = `activity_${'a'.repeat(32)}`;
  const fetchImpl = async (url, options) => {
    calls.push({url, body: JSON.parse(options.body)});
    return {
      ok: true,
      json: async () => ({
        activity_id: activityId,
        occurrence_id: `occurrence_${'b'.repeat(32)}`,
        title: FESTIVAL_1D.name,
        activity_revision: 1,
        occurrence_revision: 1,
        confirmation_level: 'USER_ATTESTED',
        provider_verified: false,
        read_your_writes: true,
        temporal: {kind: 'DATE_ONLY', local_date: '2026-11-01'},
      }),
    };
  };

  const created = await addFestivalVisitToCalendar({
    festival: FESTIVAL_1D, visitDate: '2026-11-01', visitScope: VISIT_SCOPE.DATE,
    authenticated: true, sessionToken: 'test-session-token', fetchImpl, storage,
  });
  assert.equal(created.status, 'CREATED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.logical_request_id, `festival.${FESTIVAL_1D.id}.2026-11-01`, 'the idempotency key must be deterministic per festival+date');
  assert.equal(calls[0].body.entry.place, FESTIVAL_1D.address, 'without a venueName the address must be used as the Calendar place');
  assert.equal(calls[0].body.entry.amount_minor, null);
  assert.equal(calls[0].body.temporal.kind, 'DATE_ONLY');

  // Same festival + same date again: the same-browser link index must catch
  // this as a duplicate WITHOUT a second network call.
  const duplicate = await addFestivalVisitToCalendar({
    festival: FESTIVAL_1D, visitDate: '2026-11-01', visitScope: VISIT_SCOPE.DATE,
    authenticated: true, sessionToken: 'test-session-token', fetchImpl, storage,
  });
  assert.equal(duplicate.status, 'DUPLICATE');
  assert.equal(calls.length, 1, 'a duplicate add must never re-hit the network');

  // Re-entry: the activity_id written by the create above must resolve back
  // to the festival, and survive a fresh read of the same storage (refresh).
  const link = readFestivalCalendarLink(activityId, storage);
  assert.deepEqual(link, {festivalId: FESTIVAL_1D.id, visitDate: '2026-11-01', visitScope: VISIT_SCOPE.DATE});
  const itemLink = festivalLinkFromCalendarItem({activity_id: activityId}, storage);
  assert.deepEqual(itemLink, link);
  assert.equal(festivalLinkFromCalendarItem({activity_id: `activity_${'c'.repeat(32)}`}, storage), null, 'an unrelated activity_id must never resolve to a link');

  // A network failure must surface as ERROR, not a silent fake success.
  const failing = await addFestivalVisitToCalendar({
    festival: FESTIVAL_5D, visitDate: '2026-10-07', visitScope: VISIT_SCOPE.DATE,
    authenticated: true, sessionToken: 'test-session-token',
    fetchImpl: async () => { throw new Error('network down'); },
    storage,
  });
  assert.equal(failing.status, 'ERROR');
  assert.ok(failing.error instanceof Error);
}

// direct index read/write helpers, including overwrite behavior used by
// activity edits elsewhere.
{
  const storage = memoryStorage();
  writeFestivalCalendarLink('activity_x', {festivalId: 'fest_a', visitDate: '2026-01-01', visitScope: VISIT_SCOPE.DATE}, storage);
  assert.deepEqual(readFestivalCalendarLink('activity_x', storage), {festivalId: 'fest_a', visitDate: '2026-01-01', visitScope: VISIT_SCOPE.DATE});
  assert.equal(readFestivalCalendarLink('activity_missing', storage), null);
}

console.log('FESTIVAL CALENDAR LINK VALIDATION PASS — visit-date options, program default-date policy, Guest create/duplicate/full-range, Guest schema guards, authenticated create/duplicate/re-entry/error, and link-index round-trip verified.');
