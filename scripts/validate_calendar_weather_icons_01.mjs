import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {getCalendarWeather} = await import('../site-calendar.js?v=20260922-weather1');
const {loadLifeCalendarManagerView, buildCalendarAriaLabel} = await import('../site-calendar-manager.js?v=20260922-weather1');
const {normalizeCalendarWeatherResponse, calendarWeatherByDate} = await import('../site-calendar-weather.js?v=20260922-weather1');
const {
  BrowserLocationError,
  BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
  getBrowserLocationPermissionState,
  isFreshBrowserCurrentLocation,
  LOCATION_PERMISSION,
  requestBrowserCurrentLocation,
} = await import('../site-current-location.js?v=20260922-locationperm1');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

{
  let locationCalls = 0;
  let requestedOptions;
  const geolocation = {
    getCurrentPosition(success, _failure, options) {
      locationCalls += 1;
      requestedOptions = options;
      success({
        coords: {latitude: 35.8242, longitude: 127.148, accuracy: 850},
        timestamp: 1_800_000_000_000,
      });
    },
  };
  assert.equal(locationCalls, 0, 'browser location must not be requested eagerly');
  const location = await requestBrowserCurrentLocation({
    geolocation,
    now: () => 1_800_000_010_000,
  });
  assert.equal(locationCalls, 1);
  assert.equal(location.source, 'BROWSER_CURRENT');
  assert.equal(location.accuracyMeters, 850);
  assert.equal(location.approximationState, 'UNKNOWN');
  assert.equal(location.timestamp, new Date(1_800_000_000_000).toISOString());
  assert.equal(requestedOptions.enableHighAccuracy, false);
  assert.equal(requestedOptions.maximumAge, BROWSER_CURRENT_LOCATION_MAX_AGE_MS);
  assert.ok(requestedOptions.timeout >= 1000 && requestedOptions.timeout <= 20000);
  assert.equal(isFreshBrowserCurrentLocation(location, {now: () => 1_800_000_010_000}), true);
  assert.equal(
    isFreshBrowserCurrentLocation(location, {
      now: () => 1_800_000_000_000 + BROWSER_CURRENT_LOCATION_MAX_AGE_MS + 1,
    }),
    false,
  );
}

for (const [browserCode, expectedCode] of [
  [1, 'BROWSER_LOCATION_DENIED'],
  [2, 'BROWSER_LOCATION_UNAVAILABLE'],
  [3, 'BROWSER_LOCATION_TIMEOUT'],
]) {
  const geolocation = {
    getCurrentPosition(_success, failure) { failure({code: browserCode}); },
  };
  await assert.rejects(
    requestBrowserCurrentLocation({geolocation}),
    error => error instanceof BrowserLocationError && error.code === expectedCode,
  );
}

await assert.rejects(
  requestBrowserCurrentLocation({geolocation: null}),
  error => error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_UNSUPPORTED',
);

{
  const geolocation = {getCurrentPosition() {}};
  for (const [browserState, expected] of [
    ['granted', LOCATION_PERMISSION.GRANTED],
    ['prompt', LOCATION_PERMISSION.PROMPT_REQUIRED],
    ['denied', LOCATION_PERMISSION.DENIED],
  ]) {
    const permissions = {query: async () => ({state: browserState})};
    assert.equal(
      await getBrowserLocationPermissionState({permissions, geolocation}),
      expected,
    );
  }
  assert.equal(
    await getBrowserLocationPermissionState({permissions: null, geolocation}),
    LOCATION_PERMISSION.UNKNOWN,
  );
  assert.equal(
    await getBrowserLocationPermissionState({
      permissions: {query: async () => { throw new Error('unsupported query'); }},
      geolocation,
    }),
    LOCATION_PERMISSION.UNKNOWN,
  );
  assert.equal(
    await getBrowserLocationPermissionState({permissions: null, geolocation: null}),
    LOCATION_PERMISSION.UNAVAILABLE,
  );
}

await assert.rejects(
  requestBrowserCurrentLocation({
    geolocation: {
      getCurrentPosition(success) {
        success({
          coords: {latitude: 35.8242, longitude: 127.148, accuracy: 25},
          timestamp: 1_800_000_000_000,
        });
      },
    },
    now: () => 1_800_000_000_000 + BROWSER_CURRENT_LOCATION_MAX_AGE_MS + 1,
  }),
  error => error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_STALE',
);

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
  let request;
  await getCalendarWeather(
    'site-token',
    {
      start: '2026-09-22',
      end: '2026-09-22',
      timezone: 'Asia/Seoul',
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse({provider_ready: true, items: [], ai_calls: 0});
    },
  );
  const parsed = new URL(request.url);
  assert.equal(parsed.pathname, '/v2/life/weather');
  assert.equal(parsed.searchParams.get('latitude'), null);
  assert.equal(parsed.searchParams.get('longitude'), null);
  assert.equal(parsed.searchParams.get('timezone'), 'Asia/Seoul');
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
const locationSource = fs.readFileSync(path.join(ROOT, 'site-current-location.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
for (const token of [
  "weatherIcon.className = 'calendar-weather-icon'",
  'weatherIcon.textContent = weather.weatherIcon',
  "weatherIcon.setAttribute('aria-hidden', 'true')",
  'state.weather = result.weather || []',
]) assert.ok(manager.includes(token), `missing weather icon UI contract: ${token}`);
assert.ok(css.includes('.calendar-weather-icon'), 'weather icon CSS missing');
assert.ok(!manager.includes('temperature'), 'Calendar manager must not render temperature');
assert.ok(manager.includes("locationButton.addEventListener('click'"), 'current location must be a user action');
assert.ok(manager.includes('requestBrowserCurrentLocation({'), 'Calendar must request location only from the explicit button path');
assert.ok(manager.includes('weatherLocation: currentWeatherLocation'), 'fresh browser location must feed only the Core weather fallback');
assert.ok(manager.includes("currentWeatherLocation?.source === 'BROWSER_CURRENT'"), 'browser provenance must be explicit');
assert.ok(manager.includes('isFreshBrowserCurrentLocation'), 'stale current location must be rejected before reuse');
assert.ok(locationSource.includes('maximumAge: usableMaxAgeMs'), 'browser current location may reuse only the bounded recent fix');
assert.ok(locationSource.includes('enableHighAccuracy: false'), 'weather must not force precise browser location');
assert.ok(locationSource.includes("approximationState: 'UNKNOWN'"), 'browser approximation state must stay explicit and non-invented');
assert.ok(!locationSource.includes('localStorage'), 'current location must not be persisted across reload');
assert.ok(!locationSource.includes('sessionStorage'), 'current location must not be persisted across reload');
assert.ok(manager.includes('locationPermission: LOCATION_PERMISSION.UNKNOWN'), 'permission state must remain independent from resolution');
assert.ok(manager.includes('locationResolution: currentWeatherLocation'), 'resolution state must remain explicit');
assert.ok(manager.includes("state.locationResolution = LOCATION_RESOLUTION.TIMEOUT"), 'timeout must remain a location-resolution state');
assert.ok(manager.includes("state.locationPermission = LOCATION_PERMISSION.DENIED"), 'only explicit permission denial may become DENIED');
assert.ok(manager.includes("locationButton.textContent = '변경'"), 'resolved current location must remove the current-location CTA label');
assert.ok(manager.includes("locationButton.textContent = '다시 시도'"), 'location failure must expose an explicit retry action');
assert.ok(locationSource.includes('getBrowserLocationPermissionState'), 'browser permission state must be queried when supported');


console.log('LOTBI Calendar KMA weather icon + browser location contract: PASS');
