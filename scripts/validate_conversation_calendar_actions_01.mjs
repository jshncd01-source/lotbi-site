import assert from 'node:assert/strict';

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

const inFlightLive = normalizePersistedCalendarAction({...authAction, state: 'IN_FLIGHT'});
assert.equal(inFlightLive.state, 'IN_FLIGHT');
const inFlightReload = recoverCalendarActionAfterReload(inFlightLive);
assert.equal(inFlightReload.state, 'UNKNOWN_RESULT');
assert.equal(normalizePersistedCalendarAction({...authAction, state: 'SUCCESS', result: null}), null);

console.log('LOTBI Conversation Calendar action state/idempotency: PASS');
