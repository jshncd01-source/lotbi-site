import fs from 'node:fs';
import assert from 'node:assert/strict';

const {normalizeCalendarCandidateSet, normalizeCalendarPartialCandidate, SiteCoreError} = await import('../site-core.js');
const {
  createAvailableCalendarAction,
  normalizePersistedCalendarAction,
  recoverCalendarActionAfterReload,
  runCalendarAction,
} = await import('../site-calendar-actions.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const candidate = Object.freeze({
  contractId: 'CORE-CALENDAR-CANDIDATE-01',
  schemaVersion: 1,
  candidateId: 'calcand_0123456789abcdef01234567',
  actionId: 'calact_0123456789abcdef01234567',
  candidateVersion: 1,
  sourceTurnRef: 'auth-ai-0123456789',
  sourceTurnCreatedAt: '2026-09-20T12:00:00+00:00',
  title: '등산',
  temporal: Object.freeze({
    kind: 'LOCAL_DATE_TIME',
    localDatetime: '2026-10-03T09:00:00',
    timezoneName: 'Asia/Seoul',
  }),
  temporalSemantics: 'USER_PLANNED_TIME',
  meaning: 'PERSONAL_CALENDAR_ACTIVITY',
  missingFields: Object.freeze([]),
  approvalState: 'NOT_APPROVED',
  executionState: 'NOT_EXECUTED',
  writeLogicalRequestId: 'calendar-action:0123456789abcdef01234567',
});

const authAction = createAvailableCalendarAction(candidate, {
  scope: 'AUTH',
  ownerNamespace: 'install-user-a',
});
assert.equal(authAction.state, 'AVAILABLE');
assert.equal(authAction.result, null);
assert.equal(authAction.candidate.candidateId, candidate.candidateId);
assert.equal('activityId' in authAction.candidate, false);

const authRequests = [];
const authResult = await runCalendarAction(authAction, {
  sessionToken: 'site-token',
  currentNamespace: 'install-user-a',
  verifyIdentity: async () => ({installationId: 'install-user-a'}),
  createAuthActivity: async (_session, input) => {
    authRequests.push(input);
    return {
      activityId: 'activity_0123456789abcdef0123456789abcdef',
      occurrenceId: 'occurrence_0123456789abcdef0123456789abcdef',
      title: '등산',
      activityState: 'ACTIVE',
      temporal: {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-03T09:00:00', timezone_name: 'Asia/Seoul'},
      readYourWrites: true,
    };
  },
});
assert.equal(authResult.state, 'SUCCESS');
assert.equal(authResult.result.activityId, 'activity_0123456789abcdef0123456789abcdef');
assert.equal(authRequests.length, 1);
assert.equal(authRequests[0].logicalRequestId, candidate.writeLogicalRequestId);
assert.deepEqual(authRequests[0].temporal, {
  kind: 'LOCAL_DATE_TIME',
  local_datetime: '2026-10-03T09:00:00',
  timezone_name: 'Asia/Seoul',
});

const unknown = await runCalendarAction(authAction, {
  sessionToken: 'site-token',
  currentNamespace: 'install-user-a',
  verifyIdentity: async () => ({installationId: 'install-user-a'}),
  createAuthActivity: async () => {
    const error = new Error('lost response');
    error.code = 'LIFE_CALENDAR_NETWORK_ERROR';
    error.retryable = true;
    throw error;
  },
});
assert.equal(unknown.state, 'UNKNOWN_RESULT');
assert.equal(unknown.result, null);
const recovered = await runCalendarAction(unknown, {
  sessionToken: 'site-token',
  currentNamespace: 'install-user-a',
  verifyIdentity: async () => ({installationId: 'install-user-a'}),
  createAuthActivity: async (_session, input) => {
    assert.equal(input.logicalRequestId, candidate.writeLogicalRequestId);
    return {
      activityId: 'activity_0123456789abcdef0123456789abcdef',
      occurrenceId: 'occurrence_0123456789abcdef0123456789abcdef',
      title: '등산',
      activityState: 'ACTIVE',
      temporal: {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-03T09:00:00', timezone_name: 'Asia/Seoul'},
      readYourWrites: true,
    };
  },
});
assert.equal(recovered.state, 'SUCCESS');

const mismatch = await runCalendarAction(authAction, {
  sessionToken: 'site-token-b',
  currentNamespace: 'install-user-b',
  verifyIdentity: async () => ({installationId: 'install-user-b'}),
  createAuthActivity: async () => { throw new Error('must not write'); },
});
assert.equal(mismatch.state, 'DEFINITE_FAILURE');
assert.equal(mismatch.lastError.code, 'CALENDAR_ACTION_OWNER_MISMATCH');

const storage = memoryStorage();
let lockCalls = 0;
const lockManager = {
  async request(name, options, callback) {
    lockCalls += 1;
    assert.equal(name, 'lotbi-calendar-action:calact_0123456789abcdef01234567');
    assert.equal(options.mode, 'exclusive');
    return callback();
  },
};
const guestAction = createAvailableCalendarAction(candidate, {
  scope: 'GUEST',
  ownerNamespace: 'anonymous-a',
});
const guest1 = await runCalendarAction(guestAction, {
  currentNamespace: 'anonymous-a',
  storage,
  lockManager,
  guestRepositoryOptions: {
    uuid: () => '00000000-0000-4000-8000-000000000001',
    now: () => new Date('2026-09-20T12:00:00.000Z'),
  },
});
const guest2 = await runCalendarAction(guestAction, {
  currentNamespace: 'anonymous-a',
  storage,
  lockManager,
  guestRepositoryOptions: {
    uuid: () => '00000000-0000-4000-8000-000000000002',
    now: () => new Date('2026-09-20T12:00:01.000Z'),
  },
});
assert.equal(guest1.state, 'SUCCESS');
assert.equal(guest2.state, 'SUCCESS');
assert.equal(guest1.result.guestEventId, guest2.result.guestEventId);
assert.equal(lockCalls, 2);


const raceStorage = memoryStorage();
let serialized = Promise.resolve();
let raceUuid = 0;
const serializedLockManager = {
  request(_name, options, callback) {
    assert.equal(options.mode, 'exclusive');
    const run = serialized.then(callback, callback);
    serialized = run.then(() => undefined, () => undefined);
    return run;
  },
};
const [raceFirst, raceSecond] = await Promise.all([
  runCalendarAction(guestAction, {
    currentNamespace: 'anonymous-a',
    storage: raceStorage,
    lockManager: serializedLockManager,
    guestRepositoryOptions: {
      uuid: () => `00000000-0000-4000-8000-${String(++raceUuid).padStart(12, '0')}`,
      now: () => new Date('2026-09-20T12:00:00.000Z'),
    },
  }),
  runCalendarAction(guestAction, {
    currentNamespace: 'anonymous-a',
    storage: raceStorage,
    lockManager: serializedLockManager,
    guestRepositoryOptions: {
      uuid: () => `00000000-0000-4000-8000-${String(++raceUuid).padStart(12, '0')}`,
      now: () => new Date('2026-09-20T12:00:00.000Z'),
    },
  }),
]);
assert.equal(raceFirst.state, 'SUCCESS');
assert.equal(raceSecond.state, 'SUCCESS');
assert.equal(raceFirst.result.guestEventId, raceSecond.result.guestEventId);

const blockedStorage = {
  getItem() { return null; },
  setItem() { throw new Error('storage blocked'); },
};
const blocked = await runCalendarAction(guestAction, {
  currentNamespace: 'anonymous-a',
  storage: blockedStorage,
  lockManager,
  guestRepositoryOptions: {
    uuid: () => '00000000-0000-4000-8000-000000000009',
    now: () => new Date('2026-09-20T12:00:00.000Z'),
  },
});
assert.equal(blocked.state, 'DEFINITE_FAILURE');
assert.equal(blocked.result, null);

const inFlightLive = normalizePersistedCalendarAction({...authAction, state: 'IN_FLIGHT'});
assert.equal(inFlightLive.state, 'IN_FLIGHT');
const inFlightReload = recoverCalendarActionAfterReload(inFlightLive);
assert.equal(inFlightReload.state, 'UNKNOWN_RESULT');
assert.equal(normalizePersistedCalendarAction({...authAction, state: 'SUCCESS', result: null}), null);


const rawCandidateSet = {
  contract_id: 'CORE-CALENDAR-CANDIDATE-SET-01',
  schema_version: 1,
  source_turn_ref: 'guest-ai-candidates01',
  source_turn_created_at: '2026-09-20T12:00:00+00:00',
  candidates: [
    {
      contract_id: 'CORE-CALENDAR-CANDIDATE-01',
      schema_version: 1,
      candidate_id: 'calcand_111111111111111111111111',
      action_id: 'calact_111111111111111111111111',
      candidate_version: 1,
      source_turn_ref: 'guest-ai-candidates01',
      source_turn_created_at: '2026-09-20T12:00:00+00:00',
      member_index: 0,
      title: '등산',
      temporal: {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-03T09:00:00', timezone_name: 'Asia/Seoul'},
      temporal_semantics: 'USER_PLANNED_TIME',
      meaning: 'PERSONAL_CALENDAR_ACTIVITY',
      missing_fields: [],
      approval_state: 'NOT_APPROVED',
      execution_state: 'NOT_EXECUTED',
      write_logical_request_id: 'calendar-action:111111111111111111111111',
    },
    {
      contract_id: 'CORE-CALENDAR-PARTIAL-CANDIDATE-01',
      schema_version: 1,
      candidate_id: 'calcand_222222222222222222222222',
      candidate_version: 1,
      source_turn_ref: 'guest-ai-candidates01',
      source_turn_created_at: '2026-09-20T12:00:00+00:00',
      member_index: 1,
      title: '병원',
      temporal: {kind: 'PARTIAL_LOCAL_DATE_TIME', local_date: '2026-10-04', local_time: null, timezone_name: 'Asia/Seoul'},
      temporal_semantics: 'USER_PLANNED_TIME',
      meaning: 'PERSONAL_CALENDAR_ACTIVITY',
      missing_fields: ['time'],
      approval_state: 'NOT_APPROVED',
      execution_state: 'NOT_EXECUTED',
    },
  ],
};
const normalizedSet = normalizeCalendarCandidateSet(rawCandidateSet);
assert.equal(normalizedSet.candidates.length, 2);
assert.equal(normalizedSet.candidates[0].kind, 'COMPLETE');
assert.equal(normalizedSet.candidates[1].kind, 'PARTIAL');
assert.deepEqual(normalizedSet.candidates[1].candidate.missingFields, ['time']);
assert.equal('actionId' in normalizedSet.candidates[1].candidate, false);
assert.equal('writeLogicalRequestId' in normalizedSet.candidates[1].candidate, false);

assert.throws(
  () => normalizeCalendarPartialCandidate({
    ...rawCandidateSet.candidates[1],
    action_id: 'calact_222222222222222222222222',
  }),
  error => error instanceof SiteCoreError && error.code === 'WEB_CONVERSATION_CONTRACT_INVALID',
);

const conversationSource = fs.readFileSync('site-conversation.js', 'utf8');
const managerSource = fs.readFileSync('site-calendar-manager.js', 'utf8');
const calendarClientSource = fs.readFileSync('site-calendar.js', 'utf8');
for (const token of [
  "previewLifeCalendarCommand",
  "CORE_CALENDAR_GUEST_DETERMINISTIC",
  "createForRequest(calendarRequestId",
  "turnCreatedAt: sourceTurnCreatedAtIso",
  "calendarResult",
  "calendarAction",
  "calendarItems",
  "createConversationCalendarPartial",
  "conversationCalendarItemsFromResponse",
  "recoverConversationCalendarItemAfterReload",
  "등록하려면 시간을 알려주세요.",
  "등록하려면 날짜를 알려주세요.",
  "restoreConversation: true",
]) assert.ok(conversationSource.includes(token), `missing conversation Calendar token: ${token}`);
for (const token of [
  "getLifeActivity",
  "normalizedDeepOpen",
  "activity-lookups",
  "calendarDeepOpen",
  "occurrence-changed",
]) {
  const source = token === 'activity-lookups' ? calendarClientSource : managerSource;
  assert.ok(source.includes(token), `missing deep-open token: ${token}`);
}
const partialStart = conversationSource.indexOf('const createConversationCalendarPartial = candidateValue =>');
const partialEnd = conversationSource.indexOf('const createConversationCalendarAction = actionValue =>', partialStart);
assert.ok(partialStart >= 0 && partialEnd > partialStart, 'partial Calendar candidate renderer missing');
const partialRenderer = conversationSource.slice(partialStart, partialEnd);
assert.ok(!partialRenderer.includes('캘린더에 등록'), 'partial candidates must never render a register button');
assert.ok(!conversationSource.includes("assistantText.match("), 'assistant free text must not become Calendar authority');
assert.ok(!conversationSource.includes("beginSiteHandoff(message); } catch (caught) { showError(caught, message, false);"), 'Guest direct Calendar command must not force login handoff');

console.log('LOTBI Conversation Calendar action state/idempotency: PASS');
