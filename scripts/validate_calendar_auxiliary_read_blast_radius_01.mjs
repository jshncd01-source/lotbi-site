// Locks which Calendar reads may declare the Site session dead.
//
// announceInvalidSiteSession dispatches the global session-state event.
// site-calendar-ui.js tears the Calendar down on it and site-conversation.js
// closes the surface, so the user is thrown back to Home. That is right when
// the session really is gone and wrong when one request was simply refused:
// it made the Calendar unusable in production once /v2/life/expense-summary
// began answering 403 for Site child sessions.
//
// Two rules keep that from recurring, and both are checked here:
//   - announcing is opt-in. A new Calendar call cannot bring the Calendar down
//     by forgetting to opt out. Only the reads that gate the Calendar opt in.
//   - a 403 never announces, whoever asked. It means the server refused that
//     route, which is not evidence the session died.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';

// The browser globals announceInvalidSiteSession looks for. Without them it
// returns early and every assertion below would pass for the wrong reason.
const bus = new EventTarget();
globalThis.addEventListener = bus.addEventListener.bind(bus);
globalThis.removeEventListener = bus.removeEventListener.bind(bus);
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);
assert.equal(typeof globalThis.CustomEvent, 'function', 'CustomEvent must exist for the announcement path to run');

const {
  getCalendarWeather,
  getLifeAgenda,
  getLifeAttention,
  getLifeActivity,
  getLifeExpenseSummary,
  getLifeToday,
  getLifeUnscheduled,
  getLifeUpcoming,
  editLifeActivity,
} = await import('../site-calendar.js');

function refusingFetch(status) {
  return () => Promise.resolve(new Response(
    JSON.stringify({code: status === 403 ? 'SESSION_AUDIENCE_RESTRICTED' : 'SESSION_REQUIRED'}),
    {status, headers: {'Content-Type': 'application/json'}},
  ));
}

// Returns whether the call announced the session as dead.
async function announcesOn(status, run) {
  let announced = false;
  const listener = () => { announced = true; };
  globalThis.addEventListener(SESSION_STATE_EVENT, listener);
  try {
    await run(refusingFetch(status));
    throw new Error('expected the refused request to throw');
  } catch (error) {
    if (error instanceof Error && error.message === 'expected the refused request to throw') throw error;
  } finally {
    globalThis.removeEventListener(SESSION_STATE_EVENT, listener);
  }
  return announced;
}

const MONTH = {timezone: 'Asia/Seoul', start: '2026-09-01', end: '2026-09-30'};

const A = 'activity_' + '0'.repeat(32);

// Every call the Calendar makes that is not one of the four gating reads. All
// of them stay silent, including the routes Core refuses for a Site session:
// /v2/life/unscheduled and PATCH /v2/life/activities/{id}/entry.
const AUXILIARY = [
  ['expense summary', fetchImpl => getLifeExpenseSummary('tok', MONTH, fetchImpl)],
  ['weather', fetchImpl => getCalendarWeather('tok', {start: MONTH.start, end: MONTH.end, timezone: MONTH.timezone}, fetchImpl)],
  ['unscheduled', fetchImpl => getLifeUnscheduled('tok', fetchImpl)],
  ['activity lookup', fetchImpl => getLifeActivity('tok', A, fetchImpl)],
  ['entry edit', fetchImpl => editLifeActivity('tok', A, {
    logicalRequestId: 'req.blast.radius.0001',
    expectedRevision: 1,
    entry: {amountMinor: 1000, expenseCategory: 'FOOD'},
  }, fetchImpl)],
];

const PRIMARY = [
  ['agenda', fetchImpl => getLifeAgenda('tok', MONTH, fetchImpl)],
  ['attention', fetchImpl => getLifeAttention('tok', {timezone: MONTH.timezone, horizonDays: 365}, fetchImpl)],
  ['today', fetchImpl => getLifeToday('tok', MONTH.timezone, fetchImpl)],
  ['upcoming', fetchImpl => getLifeUpcoming('tok', {timezone: MONTH.timezone, through: MONTH.end}, fetchImpl)],
];

for (const [label, run] of AUXILIARY) {
  for (const status of [401, 403]) {
    assert.equal(
      await announcesOn(status, run),
      false,
      `${label} answered ${status} must not declare the Site session dead — that tears the Calendar down`,
    );
  }
}

for (const [label, run] of PRIMARY) {
  assert.equal(
    await announcesOn(401, run),
    true,
    `${label} answered 401 must still surface the dead session`,
  );
  // A refused route is not a dead session, even on a gating read.
  assert.equal(
    await announcesOn(403, run),
    false,
    `${label} answered 403 must not be treated as a dead session`,
  );
}

const source = fs.readFileSync('site-calendar.js', 'utf8');

// Announcing must stay opt-in, so that a Calendar call added later cannot take
// the Calendar down by saying nothing.
assert.ok(
  /announceSessionFailure = false\b/.test(source),
  'announceSessionFailure must default to false',
);

// And only the four gating reads may opt in.
const optIns = [...source.matchAll(/announceSessionFailure: true/g)].length;
assert.equal(optIns, PRIMARY.length, `exactly ${PRIMARY.length} calls may opt in, found ${optIns}`);
for (const path of ['/v2/life/today', '/v2/life/upcoming', '/v2/life/agenda', '/v2/life/attention']) {
  const index = source.indexOf(path);
  assert.ok(index > 0, `${path} call site missing`);
  assert.ok(
    source.slice(index, index + 400).includes('announceSessionFailure: true'),
    `${path} must keep announcing a dead session`,
  );
}

console.log('validate_calendar_auxiliary_read_blast_radius_01: PASS');
