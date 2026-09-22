// Locks which Calendar reads may declare the Site session dead.
//
// A 401/403 answered by announceInvalidSiteSession dispatches the global
// session-state event. site-calendar-ui.js tears the Calendar down on that
// event and site-conversation.js closes the surface, so the user is thrown
// back to Home. That is correct when the session really is gone, and wrong
// when a side panel simply could not load: it made the Calendar unusable in
// production once /v2/life/expense-summary started answering 403 for Site
// child sessions.
//
// So: the reads the Calendar cannot exist without may announce. The auxiliary
// reads — the expense totals, the weather — must not, no matter what they are
// answered with.
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
  getLifeExpenseSummary,
  getLifeToday,
  getLifeUpcoming,
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

const AUXILIARY = [
  ['expense summary', fetchImpl => getLifeExpenseSummary('tok', MONTH, fetchImpl)],
  ['weather', fetchImpl => getCalendarWeather('tok', {start: MONTH.start, end: MONTH.end, timezone: MONTH.timezone}, fetchImpl)],
];

const PRIMARY = [
  ['agenda', fetchImpl => getLifeAgenda('tok', MONTH, fetchImpl)],
  ['attention', fetchImpl => getLifeAttention('tok', {timezone: MONTH.timezone, horizonDays: 365}, fetchImpl)],
  ['today', fetchImpl => getLifeToday('tok', MONTH.timezone, fetchImpl)],
  ['upcoming', fetchImpl => getLifeUpcoming('tok', {timezone: MONTH.timezone, through: MONTH.end}, fetchImpl)],
];

for (const status of [401, 403]) {
  for (const [label, run] of AUXILIARY) {
    const announced = await announcesOn(status, run);
    assert.equal(
      announced,
      false,
      `${label} answered ${status} must not declare the Site session dead — that tears the Calendar down`,
    );
  }

  for (const [label, run] of PRIMARY) {
    const announced = await announcesOn(status, run);
    assert.equal(
      announced,
      true,
      `${label} answered ${status} must still surface the dead session`,
    );
  }
}

// The opt-out has to be spelled at the call site, not left to the default.
const source = fs.readFileSync('site-calendar.js', 'utf8');
for (const path of ['/v2/life/expense-summary', '/v2/life/weather']) {
  const index = source.indexOf(path);
  assert.ok(index > 0, `${path} call site missing`);
  const window = source.slice(index, index + 400);
  assert.ok(
    window.includes('announceSessionFailure: false'),
    `${path} must pass announceSessionFailure: false`,
  );
}

console.log('validate_calendar_auxiliary_read_blast_radius_01: PASS');
