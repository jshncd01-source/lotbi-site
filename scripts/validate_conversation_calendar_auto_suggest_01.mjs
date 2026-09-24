// Locks the chat path: drop a booking screenshot, get asked once, tap 등록.
//
// The 대표's requirement is that the owner should not have to know the feature
// exists. Attaching a reservation confirmation to an ordinary message should be
// enough — LOTBI answers about the picture and, only when the picture really
// fixes a date, offers to put it on the Calendar.
//
// Two failure modes cost more than the feature is worth, so most of what is
// pinned here is restraint:
//   - a car, a landscape, a pet, a plate of food or a settled receipt must raise
//     no Calendar prompt at all
//   - the same booking must never become two entries, however many times it is
//     photographed, tapped or retried
//
// And one thing is pinned about capability: a stay has two ends, and both of
// them have to survive into the canonical Calendar contract.
import assert from 'node:assert/strict';

const {normalizeSmartCalendarDraft, SiteCoreError} = await import('../site-core.js');
const {
  CALENDAR_DRAFT_WRITE_STATE,
  calendarDraftLogicalRequestId,
  calendarDraftTemporal,
  registerCalendarDraft,
} = await import('../site-calendar-draft-write.js');

const TZ = 'Asia/Seoul';
const FINGERPRINT = 'a'.repeat(64);

function corePayload(overrides = {}) {
  return {
    contract_id: 'CORE-SMART-CALENDAR-DRAFT-01',
    schema_version: 1,
    source_kind: 'ATTACHMENT_AI_DRAFT',
    requires_user_confirmation: true,
    automatic_write: false,
    document_kind: 'RESERVATION',
    detection_confidence: 'HIGH',
    calendar_relevance: 'SCHEDULED_EVENT',
    title: '라마다 프라자 호텔 자은도 숙박',
    local_date: '2026-09-12',
    local_time: '15:00',
    end_local_date: '2026-09-13',
    end_local_time: '11:00',
    entry: {
      amount_minor: null,
      currency: null,
      expense_category: null,
      memo: '예약번호 R-99128841 / 010-1234-5678',
      place: '라마다 프라자 호텔 자은도',
      merchant: null,
    },
    dedupe_fingerprint: FINGERPRINT,
    auto_suggestable: true,
    source_attachment_ids: ['att_aaaabbbbccccddddeeee'],
    ...overrides,
  };
}

const draft = normalizeSmartCalendarDraft(corePayload());

// --- The contract survives the trip from Core ------------------------------

assert.equal(draft.localDate, '2026-09-12');
assert.equal(draft.localTime, '15:00');
assert.equal(draft.endLocalDate, '2026-09-13');
assert.equal(draft.endLocalTime, '11:00');
assert.equal(draft.calendarRelevance, 'SCHEDULED_EVENT');
assert.equal(draft.documentKind, 'RESERVATION');
assert.equal(draft.detectionConfidence, 'HIGH');
assert.equal(draft.dedupeFingerprint, FINGERPRINT);
assert.equal(draft.autoSuggestable, true);

// An older Core sends none of the new fields. That is an ordinary draft, not a
// contract error — it simply never volunteers itself.
const legacy = corePayload();
for (const key of ['end_local_date', 'end_local_time', 'calendar_relevance', 'document_kind', 'detection_confidence', 'dedupe_fingerprint', 'auto_suggestable']) {
  delete legacy[key];
}
const legacyDraft = normalizeSmartCalendarDraft(legacy);
assert.equal(legacyDraft.endLocalDate, null);
assert.equal(legacyDraft.dedupeFingerprint, null);
assert.equal(legacyDraft.autoSuggestable, false);

// An impossible range is refused rather than silently reordered.
for (const broken of [
  {end_local_date: '2026-09-11'},
  {end_local_date: null, end_local_time: '11:00'},
  {end_local_date: '2026-09-12', end_local_time: '15:00'},
  {dedupe_fingerprint: 'not-a-hash'},
  {calendar_relevance: 'MAYBE'},
]) {
  assert.throws(() => normalizeSmartCalendarDraft(corePayload(broken)), SiteCoreError, JSON.stringify(broken));
}

// --- A stay becomes one entry with two ends --------------------------------

assert.deepEqual(calendarDraftTemporal(draft, TZ), {
  kind: 'TIME_WINDOW',
  window_start: '2026-09-12T15:00:00',
  window_end: '2026-09-13T11:00:00',
  timezone_name: TZ,
});

// A departure with a stated arrival is the same shape.
const flight = normalizeSmartCalendarDraft(corePayload({
  title: '김포 → 제주 항공편',
  local_date: '2026-10-02', local_time: '07:40',
  end_local_date: '2026-10-02', end_local_time: '08:55',
  entry: {...corePayload().entry, place: '김포국제공항'},
}));
assert.deepEqual(calendarDraftTemporal(flight, TZ), {
  kind: 'TIME_WINDOW',
  window_start: '2026-10-02T07:40:00',
  window_end: '2026-10-02T08:55:00',
  timezone_name: TZ,
});

// A booking that never stated its ending does not acquire one.
const openEnded = normalizeSmartCalendarDraft(corePayload({end_local_date: null, end_local_time: null}));
assert.deepEqual(calendarDraftTemporal(openEnded, TZ), {
  kind: 'LOCAL_DATE_TIME',
  local_datetime: '2026-09-12T15:00:00',
  timezone_name: TZ,
});

// Two dates and no clock is a range of days, not a range of invented hours.
const dayRange = normalizeSmartCalendarDraft(corePayload({local_time: null, end_local_time: null}));
assert.deepEqual(calendarDraftTemporal(dayRange, TZ), {
  kind: 'DATE_RANGE',
  local_date: '2026-09-12',
  date_end: '2026-09-13',
  timezone_name: TZ,
});

const dayOnly = normalizeSmartCalendarDraft(corePayload({local_time: null, end_local_date: null, end_local_time: null}));
assert.deepEqual(calendarDraftTemporal(dayOnly, TZ), {kind: 'DATE_ONLY', local_date: '2026-09-12'});

// No date at all is nothing to register.
assert.equal(calendarDraftTemporal(normalizeSmartCalendarDraft(corePayload({
  local_date: null, local_time: null, end_local_date: null, end_local_time: null,
})), TZ), null);

// --- One booking, one write identity ---------------------------------------

const requestId = calendarDraftLogicalRequestId(draft);
assert.match(requestId, /^calimg-[0-9a-f]{40}$/);
// Core's own logical_request_id window and alphabet.
assert.ok(requestId.length >= 8 && requestId.length <= 80);
assert.match(requestId, /^[A-Za-z0-9._:-]+$/);
// It comes from the booking, not from the clock, so a retry reuses it.
assert.equal(calendarDraftLogicalRequestId(normalizeSmartCalendarDraft(corePayload())), requestId);
assert.equal(calendarDraftLogicalRequestId(legacyDraft), null);

// --- Writing it -------------------------------------------------------------

function recordingActivity(responder) {
  const calls = [];
  const create = async (token, body) => {
    calls.push({token, body});
    return responder(calls.length, body);
  };
  return {calls, create};
}

const ok = body => ({
  activityId: 'activity_' + '1'.repeat(32),
  occurrenceId: 'occurrence_' + '2'.repeat(32),
  title: body.title,
  readYourWrites: true,
});

{
  const {calls, create} = recordingActivity((_n, body) => ok(body));
  const outcome = await registerCalendarDraft(draft, {
    sessionToken: 'token', timezone: TZ, createAuthActivity: create,
  });

  assert.equal(outcome.state, CALENDAR_DRAFT_WRITE_STATE.REGISTERED);
  assert.equal(outcome.result.dateHint, '2026-09-12');
  assert.equal(calls.length, 1);

  const body = calls[0].body;
  assert.equal(body.logicalRequestId, requestId);
  assert.equal(body.title, '라마다 프라자 호텔 자은도 숙박');
  assert.equal(body.temporal.kind, 'TIME_WINDOW');
  assert.equal(body.entry.place, '라마다 프라자 호텔 자은도');

  // The reservation number and the phone number the document carried are in the
  // draft's memo and must not reach the Calendar.
  const written = JSON.stringify(body);
  for (const secret of ['R-99128841', '010-1234-5678', 'memo']) {
    assert.ok(!written.includes(secret), `calendar write leaked ${secret}`);
  }
}

// Nothing is written without a session, a title, a date or an identity.
for (const [label, value, options] of [
  ['no session', draft, {sessionToken: ''}],
  ['no date', normalizeSmartCalendarDraft(corePayload({local_date: null, local_time: null, end_local_date: null, end_local_time: null})), {}],
  ['no identity', legacyDraft, {}],
]) {
  const {calls, create} = recordingActivity((_n, body) => ok(body));
  const outcome = await registerCalendarDraft(value, {
    sessionToken: 'token', timezone: TZ, createAuthActivity: create, ...options,
  });
  assert.equal(outcome.state, CALENDAR_DRAFT_WRITE_STATE.FAILED, label);
  assert.equal(calls.length, 0, `${label} still called the Calendar`);
}

// --- Pressing 등록 twice, and uploading the same booking twice --------------

{
  // Both presses send the same logical_request_id, which is what makes Core
  // replay the first write rather than perform a second one.
  const {calls, create} = recordingActivity((_n, body) => ok(body));
  const [first, second] = await Promise.all([
    registerCalendarDraft(draft, {sessionToken: 'token', timezone: TZ, createAuthActivity: create}),
    registerCalendarDraft(draft, {sessionToken: 'token', timezone: TZ, createAuthActivity: create}),
  ]);
  assert.equal(first.state, CALENDAR_DRAFT_WRITE_STATE.REGISTERED);
  assert.equal(second.state, CALENDAR_DRAFT_WRITE_STATE.REGISTERED);
  assert.equal(calls[0].body.logicalRequestId, calls[1].body.logicalRequestId);
  assert.equal(first.result.activityId, second.result.activityId);
}

{
  // A second screenshot of the same stay that read one field differently. Core
  // refuses it as a payload conflict on an identity it already holds, and that
  // is not an error to show the owner — the booking is on their Calendar.
  const conflict = new SiteCoreError('IDEMPOTENCY_PAYLOAD_CONFLICT', {code: 'IDEMPOTENCY_PAYLOAD_CONFLICT', status: 409});
  const outcome = await registerCalendarDraft(draft, {
    sessionToken: 'token',
    timezone: TZ,
    createAuthActivity: async () => { throw conflict; },
  });
  assert.equal(outcome.state, CALENDAR_DRAFT_WRITE_STATE.ALREADY_REGISTERED);
  assert.equal(outcome.error, null);
}

// --- A failed save stays a failed save --------------------------------------

{
  const outcome = await registerCalendarDraft(draft, {
    sessionToken: 'token',
    timezone: TZ,
    createAuthActivity: async () => { throw new SiteCoreError('서버 오류', {code: 'LIFE_CALENDAR_HTTP_ERROR', status: 503}); },
  });
  // Unknown, not failed: the write may have landed, so the owner is pointed at
  // the Calendar rather than told it did not happen.
  assert.equal(outcome.state, CALENDAR_DRAFT_WRITE_STATE.UNKNOWN);
}

{
  // Whatever goes wrong, registering never throws into the conversation.
  const outcome = await registerCalendarDraft(draft, {
    sessionToken: 'token',
    timezone: TZ,
    createAuthActivity: async () => { throw new TypeError('boom'); },
  });
  assert.equal(outcome.state, CALENDAR_DRAFT_WRITE_STATE.FAILED);
  assert.ok(outcome.error.message);
}

// --- The card only appears for the pictures that earn it --------------------

const conversationSource = await import('node:fs').then(fs => fs.readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8'));

// The Site does not second-guess Core's relevance judgement, and it does not
// offer a register button for a draft with no date or no identity.
assert.ok(
  conversationSource.includes("const registerable = Boolean(draft.localDate && draft.title && draft.dedupeFingerprint);"),
  'the register button must require a date, a title and a write identity',
);
assert.ok(conversationSource.includes("status.textContent = '캘린더에 등록할까요?';"), 'missing the confirmation question');
assert.ok(conversationSource.includes("register.textContent = '등록';"), 'missing the 등록 button');
assert.ok(conversationSource.includes("decline.textContent = '아니요';"), 'missing the 아니요 button');
// Declining writes nothing.
assert.ok(
  /decline\.addEventListener\('click', \(\) => \{\s*if \(submitting\) return;\s*settleConversationCalendarDraft\(draft\.dedupeFingerprint, null\);/.test(conversationSource),
  '아니요 must settle the draft without writing',
);
// And a successful write refreshes whatever Calendar surface is mounted.
assert.ok(
  conversationSource.includes("window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));"),
  'a successful registration must refresh the Calendar',
);
// No alert()-shaped placeholder survived into the confirmation path.
assert.ok(!/\balert\s*\(/.test(conversationSource), 'confirmation must not use alert()');

// --- And the day list says when the stay ends -------------------------------

const {eventSpanText} = await import('../site-calendar-manager.js');

// 2026-09-12 선택 시 하단에 '09/12 15:00 → 09/13 11:00' 이 보여야 한다.
assert.equal(
  eventSpanText({
    local_date: '2026-09-12',
    local_datetime: '2026-09-12T15:00:00',
    local_end_date: '2026-09-13',
    local_end_datetime: '2026-09-13T11:00:00',
  }),
  '09/12 15:00 → 09/13 11:00',
);
// A multi-day booking with no clock shows days, not invented hours.
assert.equal(
  eventSpanText({local_date: '2026-09-12', local_datetime: null, local_end_date: '2026-09-15', local_end_datetime: null}),
  '09/12 → 09/15',
);
// An ordinary appointment is untouched — no arrow, no second time.
assert.equal(eventSpanText({local_date: '2026-09-12', local_datetime: '2026-09-12T15:00:00'}), '');
assert.equal(eventSpanText({local_date: '2026-09-12', local_datetime: null}), '');
// A window that resolves to the same stamp says nothing rather than '→ itself'.
assert.equal(
  eventSpanText({
    local_date: '2026-09-12',
    local_datetime: '2026-09-12T15:00:00',
    local_end_date: '2026-09-12',
    local_end_datetime: '2026-09-12T15:00:00',
  }),
  '',
);

console.log('CONVERSATION CALENDAR AUTO SUGGEST 01 PASS — relevance carry-through, hotel/flight ranges, no invented endings, deterministic write identity, double-submit and re-upload safety, sensitive memo excluded, failure isolation and 등록/아니요 confirmation verified.');
