import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {loadLifeCalendarSnapshot} = await import('../site-calendar-ui.js');

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
};

{
  const requests = [];
  const snapshot = await loadLifeCalendarSnapshot(
    'site-token',
    {
      timezone: 'Asia/Seoul',
      now: new Date(2026, 8, 30, 9, 0, 0),
      fetchImpl: async (url, init) => {
        requests.push({url, init});
        const parsed = new URL(url);
        const payload = responses[parsed.pathname];
        assert.ok(payload, `unexpected Calendar request ${parsed.pathname}`);
        return jsonResponse(payload);
      },
    },
  );

  assert.equal(requests.length, 2);
  assert.ok(requests.some(({url}) => url.includes('/v2/life/today?timezone=Asia%2FSeoul')));
  assert.ok(requests.some(({url}) => url.includes('/v2/life/upcoming?timezone=Asia%2FSeoul&through=2026-10-07')));
  for (const {init} of requests) {
    assert.equal(init.headers.Authorization, 'Bearer site-token');
    assert.equal(init.credentials, 'omit');
  }
  assert.equal(snapshot.today.aiCalls, 0);
  assert.equal(snapshot.upcoming.providerApiCalls, 0);
  assert.equal(snapshot.through, '2026-10-07');
}

const index = read('index.html');
const callback = read('auth/callback/index.html');
const ui = read('site-calendar-ui.js');
const css = read('site-calendar.css');

assert.ok(index.includes('href="site-calendar.css"'));
assert.ok(index.includes('data-life-calendar-panel'));
assert.ok(index.includes('aria-label="오늘과 예정" hidden'));
assert.ok(callback.includes('href="/site-calendar.css"'));

for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie']) {
  assert.ok(!ui.includes(forbidden), `calendar UI must not persist bearer state via ${forbidden}`);
}

assert.ok(ui.includes("getLifeToday(sessionToken, timezone, fetchImpl)"));
assert.ok(ui.includes("getLifeUpcoming(sessionToken, {timezone, through}, fetchImpl)"));
assert.ok(ui.includes("coverage.textContent = 'LOTBI에 등록된 개인 일정 기준'"));
assert.ok(ui.includes("'오늘 등록된 일정이 없어요.'"));
assert.ok(ui.includes("'앞으로 7일간 등록된 일정이 없어요.'"));
assert.ok(ui.includes("detail?.authenticated === false"));
assert.ok(css.includes('[data-life-calendar-panel][hidden]'));
assert.ok(css.includes('.life-calendar-panel'));
assert.ok(css.includes('@media (max-width: 720px)'));

console.log('LOTBI Site Life Calendar UI prep contract: PASS');
