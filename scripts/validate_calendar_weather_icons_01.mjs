import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {getCalendarWeather} = await import('../site-calendar.js?v=20260922-weather1');
const {loadLifeCalendarManagerView, buildCalendarAriaLabel} = await import('../site-calendar-manager.js?v=20260922-weather1');
const {normalizeCalendarWeatherResponse, calendarWeatherByDate} = await import('../site-calendar-weather.js?v=20260922-weather1');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

const fixture = {
  provider_ready: true,
  items: [
    {date: '2026-09-22', weather_icon: '☀️', weather_kind: 'CLEAR', source: 'KMA_SHORT', issued_at: '2026-09-22T00:00:00Z'},
    {date: '2026-09-23', weather_icon: '🌧️', weather_kind: 'RAIN', source: 'KMA_SHORT', issued_at: '2026-09-22T00:00:00Z'},
    {date: '2026-09-24', weather_icon: '☁️', weather_kind: 'CLOUDY', source: 'KMA_MID', issued_at: '2026-09-22T09:00:00Z'},
    {date: '2026-09-25', weather_icon: '❄️', weather_kind: 'SNOW', source: 'KMA_MID', issued_at: '2026-09-22T09:00:00Z'},
  ],
  ai_calls: 0,
};

{
  const normalized = normalizeCalendarWeatherResponse(fixture);
  assert.equal(normalized.items.length, 4);
  assert.deepEqual(normalized.items.map(item => item.weatherIcon), ['☀️', '🌧️', '☁️', '❄️']);
  assert.equal(calendarWeatherByDate(normalized.items).get('2026-09-23')?.label, '비');
  assert.throws(() => normalizeCalendarWeatherResponse({
    ...fixture,
    items: [{...fixture.items[0], weather_icon: '25℃'}],
  }), /invalid Calendar weather item/);
}

{
  let request;
  const result = await getCalendarWeather(
    'site-token',
    {
      start: '2026-09-22',
      end: '2026-09-25',
      timezone: 'Asia/Seoul',
      latitude: 35.8242,
      longitude: 127.148,
      midRegionCode: '11F20000',
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse(fixture);
    },
  );
  const parsed = new URL(request.url);
  assert.equal(parsed.pathname, '/v2/life/weather');
  assert.equal(parsed.searchParams.get('start'), '2026-09-22');
  assert.equal(parsed.searchParams.get('end'), '2026-09-25');
  assert.equal(parsed.searchParams.get('timezone'), 'Asia/Seoul');
  assert.equal(parsed.searchParams.get('latitude'), '35.8242');
  assert.equal(parsed.searchParams.get('longitude'), '127.148');
  assert.equal(parsed.searchParams.get('mid_region_code'), '11F20000');
  assert.equal(request.init.headers.Authorization, 'Bearer site-token');
  assert.equal(result.aiCalls, 0);
  assert.equal(result.items[0].weatherIcon, '☀️');
}

{
  const calls = [];
  const result = await loadLifeCalendarManagerView('site-token', {
    view: 'month',
    date: '2026-09-22',
    timezone: 'Asia/Seoul',
    now: new Date('2026-09-22T00:00:00Z'),
    weatherLocation: {latitude: 35.8242, longitude: 127.148, midRegionCode: '11F20000'},
    fetchImpl: async (url, init) => {
      calls.push({url, init});
      const parsed = new URL(url);
      if (parsed.pathname === '/v2/life/weather') return jsonResponse(fixture);
      if (parsed.pathname === '/v2/life/attention') {
        return jsonResponse({
          view: 'ATTENTION', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
          coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
        });
      }
      if (parsed.pathname === '/v2/life/agenda') {
        return jsonResponse({
          view: 'AGENDA', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
          coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
        });
      }
      throw new Error(`unexpected request ${parsed.pathname}`);
    },
  });
  assert.equal(calls.length, 3);
  assert.ok(calls.some(call => new URL(call.url).pathname === '/v2/life/weather'));
  assert.deepEqual(result.weather.map(item => item.weatherIcon), ['☀️', '🌧️', '☁️', '❄️']);
  assert.equal(result.weatherProviderReady, true);
}

{
  const result = await loadLifeCalendarManagerView('site-token', {
    view: 'month',
    date: '2026-09-22',
    timezone: 'Asia/Seoul',
    now: new Date('2026-09-22T00:00:00Z'),
    weatherLocation: {latitude: 35.8242, longitude: 127.148},
    fetchImpl: async url => {
      const parsed = new URL(url);
      if (parsed.pathname === '/v2/life/weather') throw new Error('weather down');
      if (parsed.pathname === '/v2/life/attention') {
        return jsonResponse({
          view: 'ATTENTION', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
          coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
        });
      }
      return jsonResponse({
        view: 'AGENDA', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
      });
    },
  });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.weather, []);
  assert.equal(result.weatherProviderReady, false);
}

assert.equal(
  buildCalendarAriaLabel(
    {date: '2026-09-22', weekday: 2},
    1,
    {weather: {label: '맑음'}},
  ),
  '2026년 9월 22일 화요일, 일정 1개, 날씨 맑음',
);

const ROOT = path.resolve(import.meta.dirname, '..');
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
for (const token of [
  "weatherIcon.className = 'calendar-weather-icon'",
  'weatherIcon.textContent = weather.weatherIcon',
  "weatherIcon.setAttribute('aria-hidden', 'true')",
  'state.weather = result.weather || []',
]) assert.ok(manager.includes(token), `missing weather icon UI contract: ${token}`);
assert.ok(css.includes('.calendar-weather-icon'), 'weather icon CSS missing');
assert.ok(!manager.includes('temperature'), 'Calendar manager must not render temperature');

console.log('LOTBI Calendar KMA weather icon contract: PASS');
