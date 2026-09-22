import assert from 'node:assert/strict';
// Reconciled Smart Calendar head validation marker.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {loadGuestLifeCalendarManagerView, loadLifeCalendarManagerView, loadLifeCalendarSnapshot} = await import('../site-calendar-ui.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const responses = {
  '/v2/life/today': {
    view: 'TODAY',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 0,
    provider_api_calls: 0,
  },
  '/v2/life/upcoming': {
    view: 'UPCOMING',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 0,
    provider_api_calls: 0,
  },
  '/v2/life/agenda': {
    view: 'AGENDA',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 0,
    provider_api_calls: 0,
  },
  '/v2/life/unscheduled': {
    view: 'UNSCHEDULED',
    items: [],
    ai_calls: 0,
    provider_api_calls: 0,
  },
  '/v2/life/attention': {
    view: 'ATTENTION',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 0,
    provider_api_calls: 0,
  },
  '/v2/life/weather': {
    provider_ready: false,
    items: [],
    ai_calls: 0,
  },
};

{
  const requests = [];
  const snapshot = await loadLifeCalendarSnapshot(
    'site-token',
    {
      timezone: 'Asia/Seoul',
      now: new Date('2026-09-29T15:30:00Z'),
      fetchImpl: async (url, init) => {
        requests.push({url, init});
        const parsed = new URL(url);
        const payload = responses[parsed.pathname];
        assert.ok(payload, `unexpected Calendar request ${parsed.pathname}`);
        return jsonResponse(payload);
      },
    },
  );

  assert.equal(requests.length, 3);
  assert.ok(requests.some(({url}) => url.includes('/v2/life/today?timezone=Asia%2FSeoul')));
  assert.ok(requests.some(({url}) => url.includes('/v2/life/upcoming?timezone=Asia%2FSeoul&through=2026-10-07')));
  assert.ok(requests.some(({url}) => url.includes('/v2/life/attention?timezone=Asia%2FSeoul&horizon_days=14')));
  for (const {init} of requests) {
    assert.equal(init.headers.Authorization, 'Bearer site-token');
    assert.equal(init.credentials, 'omit');
  }
  assert.equal(snapshot.today.aiCalls, 0);
  assert.equal(snapshot.upcoming.providerApiCalls, 0);
  assert.equal(snapshot.attention.aiCalls, 0);
  assert.equal(snapshot.through, '2026-10-07');

  const utcSnapshot = await loadLifeCalendarSnapshot(
    'site-token',
    {
      timezone: 'UTC',
      now: new Date('2026-09-29T15:30:00Z'),
      fetchImpl: async (url) => {
        const parsed = new URL(url);
        return jsonResponse({
          ...responses[parsed.pathname],
          timezone: 'UTC',
        });
      },
    },
  );
  assert.equal(utcSnapshot.through, '2026-10-06');
}


{
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    const parsed = new URL(url);
    const payload = responses[parsed.pathname];
    assert.ok(payload, `unexpected Calendar manager request ${parsed.pathname}`);
    return jsonResponse(payload);
  };
  const base = {
    timezone: 'Asia/Seoul',
    now: new Date('2026-09-29T15:30:00Z'),
    fetchImpl,
  };

  calls.length = 0;
  const month = await loadLifeCalendarManagerView('site-token', {...base, view: 'month'});
  assert.equal(month.key, 'month');
  assert.equal(month.kind, 'agenda');
  assert.equal(calls.length, 3);
  assert.ok(calls.some(call => call.url.includes('/v2/life/agenda?timezone=Asia%2FSeoul&start=2026-08-30&end=2026-10-03')));
  assert.ok(calls.some(call => call.url.includes('/v2/life/attention?timezone=Asia%2FSeoul&horizon_days=365')));
  assert.ok(calls.some(call => call.url.includes('/v2/life/weather?start=2026-08-30&end=2026-10-03&timezone=Asia%2FSeoul')));

  calls.length = 0;
  const today = await loadLifeCalendarManagerView('site-token', {...base, view: 'today'});
  assert.equal(today.key, 'month');
  assert.equal(calls.length, 3);
  assert.ok(calls.some(call => call.url.includes('/v2/life/agenda?timezone=Asia%2FSeoul&start=2026-08-30&end=2026-10-03')));
  assert.ok(calls.some(call => call.url.includes('/v2/life/attention?timezone=Asia%2FSeoul&horizon_days=365')));
  assert.ok(calls.some(call => call.url.includes('/v2/life/weather?start=2026-08-30&end=2026-10-03&timezone=Asia%2FSeoul')));

  calls.length = 0;
  const year = await loadLifeCalendarManagerView('site-token', {...base, view: 'year'});
  assert.equal(year.key, 'year');
  assert.ok(calls[0].url.includes('/v2/life/agenda?timezone=Asia%2FSeoul&start=2026-01-01&end=2026-12-31'));

  calls.length = 0;
  const attention = await loadLifeCalendarManagerView('site-token', {...base, view: 'attention'});
  assert.equal(attention.key, 'attention');
  assert.equal(attention.kind, 'attention');
  assert.ok(calls[0].url.includes('/v2/life/attention?timezone=Asia%2FSeoul&horizon_days=365'));

  calls.length = 0;
  const agenda = await loadLifeCalendarManagerView('site-token', {...base, view: 'agenda', date: '2026-10-02'});
  assert.equal(agenda.key, 'agenda');
  assert.equal(agenda.date, '2026-10-02');
  assert.equal(calls.length, 2);
  assert.ok(calls.some(call => call.url.includes('/v2/life/agenda?timezone=Asia%2FSeoul&start=2026-09-27&end=2026-10-31')));
  assert.ok(calls.some(call => call.url.includes('/v2/life/unscheduled')));
  assert.deepEqual(agenda.unscheduled, []);

  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer site-token');
    assert.equal(call.init.credentials, 'omit');
  }
}


{
  const guestBase = {
    timezone: 'Asia/Seoul',
    now: new Date('2026-09-29T15:30:00Z'),
  };
  for (const [view, expectedKind] of [['all', 'agenda'], ['today', 'agenda'], ['attention', 'attention']]) {
    const result = loadGuestLifeCalendarManagerView({...guestBase, view});
    assert.equal(result.key, view);
    assert.equal(result.kind, expectedKind);
    assert.equal(result.date, '2026-09-30');
    assert.equal(result.guest, true);
    assert.deepEqual(result.items, []);
    assert.match(result.description, /로그인 없이 사용하는 캘린더/);
  }
  const dated = loadGuestLifeCalendarManagerView({...guestBase, view: 'date', date: '2026-10-03'});
  assert.equal(dated.key, 'date');
  assert.equal(dated.date, '2026-10-03');
  assert.deepEqual(dated.items, []);
}

const index = read('index.html');
const callback = read('auth/callback/index.html');
const ui = read('site-calendar-ui.js');
const manager = read('site-calendar-manager.js');
const css = read('site-calendar.css');
const conversation = read('site-conversation.js');
const openCalendarStart = conversation.indexOf('const openCalendar = async (view,');
const openCalendarEnd = conversation.indexOf('const openHelp = () =>', openCalendarStart);
assert.ok(openCalendarStart >= 0 && openCalendarEnd > openCalendarStart, 'Calendar open handler missing');
const openCalendar = conversation.slice(openCalendarStart, openCalendarEnd);
assert.ok(!openCalendar.includes('beginSiteHandoff('), 'anonymous Calendar entry must not start Account handoff');
assert.ok(!openCalendar.includes('clearSiteLogoutSuppression('), 'anonymous Calendar entry must not alter logout suppression');
assert.ok(openCalendar.includes('mountLifeCalendarManager({'), 'Calendar entry must mount the manager for guest and authenticated users');
assert.match(openCalendar, /sessionToken\s*\?/, 'Calendar copy must distinguish authenticated and guest entry without gating');


assert.ok(index.includes('href="site-calendar.css?v=20260921-smartcaldraft1"'));
assert.ok(index.includes('data-life-calendar-panel'));
assert.ok(index.includes('data-calendar-enabled="true"'));
assert.ok(index.includes('aria-label="오늘과 예정" hidden'));
assert.equal((index.match(/data-calendar-view="/g) || []).length, 2, 'Desktop + Mobile must each expose only the Calendar root action');
assert.ok(index.includes('>캘린더</button>'), 'missing Korean Calendar root navigation label');
assert.equal((index.match(/data-calendar-view="today"/g) || []).length, 0, 'Sidebar must not duplicate the Calendar Today quick view');
assert.equal((index.match(/data-calendar-view="attention"/g) || []).length, 0, 'Sidebar must not duplicate the Calendar Needs Attention quick view');
for (const hiddenNavLabel of ['전체 일정', '예정된 일정', '날짜별 보기']) {
  assert.ok(!index.includes(`>${hiddenNavLabel}<`), `Calendar navigation must not expose ${hiddenNavLabel}`);
}
for (const forbidden of ['>Today<', '>Upcoming<', '>Needs Attention<']) {
  assert.ok(!index.includes(forbidden), `internal Calendar term leaked into user UI: ${forbidden}`);
}
assert.ok(callback.includes('href="/site-calendar.css?v=20260921-smartcaldraft1"'));
const callbackJs = read('auth-callback.js');
assert.ok(callbackJs.includes("import {mountLifeCalendarIfEnabled} from './site-calendar-ui.js?v=20260921-smartcaldraft1';"));
assert.ok(callbackJs.includes('await mountLifeCalendarIfEnabled({sessionToken: session.sessionToken});'));

for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie']) {
  assert.ok(!ui.includes(forbidden), `calendar UI must not persist bearer state via ${forbidden}`);
}

assert.ok(ui.includes("getLifeToday(sessionToken, timezone, fetchImpl)"));
assert.ok(ui.includes("getLifeAgenda("));
assert.ok(ui.includes("from './site-calendar-manager.js?v=20260922-weather1'"));
assert.ok(ui.includes("export function loadGuestLifeCalendarManagerView"));
assert.ok(ui.includes("root.dataset.calendarAccess = authenticated ? 'authenticated' : 'guest'"));
assert.ok(ui.includes('mountLifeCalendarManager'));
assert.ok(ui.includes("horizonDays: CALENDAR_ATTENTION_HORIZON_DAYS"));
assert.ok(ui.includes("getLifeUpcoming(sessionToken, {timezone, through}, fetchImpl)"));
assert.ok(ui.includes("getLifeAttention(sessionToken, {timezone, horizonDays: 14}, fetchImpl)"));
assert.ok(ui.includes("sectionNode('주의 필요'"));
assert.ok(ui.includes("coverage.textContent = 'LOTBI에 등록된 개인 일정 기준'"));
assert.ok(ui.includes("'오늘 등록된 일정이 없어요.'"));
assert.ok(ui.includes("'앞으로 7일간 등록된 일정이 없어요.'"));
assert.ok(ui.includes("detail?.authenticated === false"));
assert.ok(ui.includes("root.dataset.calendarState = 'empty'"));
assert.ok(ui.includes('root.hidden = false'));
assert.ok(ui.includes('const onRefresh = () => { void refresh(); }'));
assert.ok(ui.includes('const requestGeneration = ++generation'));
assert.ok(ui.includes("root.dataset.calendarEnabled !== 'true'"));
assert.ok(manager.includes("removeLifeActivity(sessionToken"));
assert.ok(manager.includes("editLifeActivity(sessionToken"));
assert.ok(manager.includes("'날짜 미정'"));
assert.ok(manager.includes('state.unscheduled'));
assert.ok(ui.includes('return mountLifeCalendar({...options, root});'));
assert.ok(css.includes('[data-life-calendar-panel][hidden]'));
assert.ok(css.includes('.life-calendar-panel'));
assert.ok(css.includes('.sidebar-calendar-nav'));
assert.ok(css.includes('.site-calendar-modal'));
assert.ok(css.includes('.life-calendar-manager-tabs'));
assert.ok(css.includes('.life-calendar-manager-date'));
assert.ok(css.includes('@media (max-width: 720px)'));

console.log('LOTBI Site Life Calendar UI prep contract: PASS');
