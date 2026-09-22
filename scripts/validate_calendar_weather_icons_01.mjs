import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {getCalendarWeather, getCalendarWeatherRegions} = await import('../site-calendar.js?v=20260922-weatherreal2');
const {loadLifeCalendarManagerView, buildCalendarAriaLabel} = await import('../site-calendar-manager.js?v=20260922-weatherreal2');
const {normalizeCalendarWeatherResponse, calendarWeatherByDate, weatherTemperatureLabel} = await import('../site-calendar-weather.js?v=20260922-weatherreal1');
const {readCalendarWeatherPreference, writeCalendarWeatherPreference} = await import('../site-calendar-weather-preference.js?v=20260922-weatherreal1');
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
    {date: '2026-09-22', weather_icon: '☀️', weather_kind: 'CLEAR', source: 'KMA_SHORT', issued_at: '2026-09-22T00:00:00Z', temperature_c: 26, min_temperature_c: 16, max_temperature_c: 28, precipitation_probability: 10, freshness: 'CACHE_VALID'},
    {date: '2026-09-23', weather_icon: '🌧️', weather_kind: 'RAIN', source: 'KMA_SHORT', issued_at: '2026-09-22T00:00:00Z', temperature_c: 22, min_temperature_c: 18, max_temperature_c: 24, precipitation_probability: 80, freshness: 'CACHE_VALID'},
    {date: '2026-09-24', weather_icon: '☁️', weather_kind: 'CLOUDY', source: 'KMA_MID', issued_at: '2026-09-22T09:00:00Z', temperature_c: null, min_temperature_c: null, max_temperature_c: null, precipitation_probability: 30, freshness: 'CACHE_VALID'},
    {date: '2026-09-25', weather_icon: '❄️', weather_kind: 'SNOW', source: 'KMA_MID', issued_at: '2026-09-22T09:00:00Z', temperature_c: null, min_temperature_c: null, max_temperature_c: null, precipitation_probability: 70, freshness: 'CACHE_VALID'},
  ],
  ai_calls: 0,
};

{
  const normalized = normalizeCalendarWeatherResponse(fixture);
  assert.equal(normalized.items.length, 4);
  assert.deepEqual(normalized.items.map(item => item.weatherIcon), ['☀️', '🌧️', '☁️', '❄️']);
  assert.equal(calendarWeatherByDate(normalized.items).get('2026-09-23')?.label, '비');
  assert.equal(normalized.items[0].temperature, 26);
  assert.equal(normalized.items[0].minTemperature, 16);
  assert.equal(normalized.items[0].maxTemperature, 28);
  assert.equal(normalized.items[0].precipitationProbability, 10);
  assert.equal(normalized.items[0].freshness, 'CACHE_VALID');
  assert.equal(weatherTemperatureLabel(normalized.items[0]), '26°');
  assert.throws(() => normalizeCalendarWeatherResponse({
    ...fixture,
    items: [{...fixture.items[0], weather_icon: '25℃'}],
  }), /invalid Calendar weather item/);
}

{
  let request;
  const regions = await getCalendarWeatherRegions(async (url, init) => {
    request = {url, init};
    return jsonResponse({items: [{code: 'KR_JEONJU', label: '전주시'}], ai_calls: 0});
  });
  assert.equal(new URL(request.url).pathname, '/v2/life/weather/regions');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(regions.items, [{code: 'KR_JEONJU', label: '전주시'}]);
}

{
  let request;
  const result = await getCalendarWeather(
    '',
    {
      start: '2026-09-22',
      end: '2026-09-22',
      timezone: 'Asia/Seoul',
      manualRegionCode: 'KR_JEONJU',
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse(fixture);
    },
  );
  const parsed = new URL(request.url);
  assert.equal(parsed.pathname, '/v2/life/weather/public');
  assert.equal(parsed.searchParams.get('manual_region_code'), 'KR_JEONJU');
  assert.equal(request.init.headers.Authorization, undefined);
  assert.equal(result.items[0].temperature, 26);
}

{
  const calls = [];
  await loadLifeCalendarManagerView('site-token', {
    view: 'month',
    date: '2026-09-22',
    timezone: 'Asia/Seoul',
    now: new Date('2026-09-22T00:00:00Z'),
    weatherEnabled: false,
    fetchImpl: async url => {
      calls.push(url);
      const parsed = new URL(url);
      if (parsed.pathname === '/v2/life/attention') return jsonResponse({
        view: 'ATTENTION', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
      });
      if (parsed.pathname === '/v2/life/agenda') return jsonResponse({
        view: 'AGENDA', as_of: '2026-09-22T00:00:00Z', timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
      });
      throw new Error(`unexpected Weather OFF request ${parsed.pathname}`);
    },
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => new URL(url).pathname !== '/v2/life/weather'));
}

{
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
  };
  assert.deepEqual(readCalendarWeatherPreference(storage), {enabled: true, manualRegionCode: ''});
  writeCalendarWeatherPreference({enabled: false, manualRegionCode: 'KR_JEONJU'}, storage);
  assert.deepEqual(readCalendarWeatherPreference(storage), {enabled: false, manualRegionCode: 'KR_JEONJU'});
  assert.ok(!String(memory.values().next().value).match(/latitude|longitude|accuracy|token/i));
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
    {weather: {label: '맑음', temperature: 26}},
  ),
  '2026년 9월 22일 화요일, 일정 1개, 날씨 맑음, 26도',
);

const ROOT = path.resolve(import.meta.dirname, '..');
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const locationSource = fs.readFileSync(path.join(ROOT, 'site-current-location.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
for (const token of [
  "weatherCompact.className = 'calendar-weather-compact'",
  "symbol.className = 'calendar-weather-symbol'",
  "temperature.className = 'calendar-weather-temperature'",
  'weatherTemperatureLabel(weather)',
  'state.weatherEnabled',
  'state.manualRegionCode',
  "weatherToggle.addEventListener('click'",
  "regionSelect.addEventListener('change'",
]) assert.ok(manager.includes(token), `missing weather UI contract: ${token}`);
assert.ok(css.includes('.calendar-weather-compact'), 'compact weather CSS missing');
assert.ok(css.includes('.calendar-weather-controls'), 'weather control CSS missing');
assert.ok(css.includes('body[data-site-theme="dark"] .calendar-weather-compact'), 'dark weather contrast CSS missing');
assert.ok(!manager.includes('weatherIcon.textContent = weather.weatherIcon'), 'OS color emoji must not be the rendered Calendar weather symbol');
assert.ok(manager.includes("locationButton.addEventListener('click'"), 'current location must be a user action');
assert.ok(manager.includes('requestBrowserCurrentLocation({'), 'Calendar must request location only from the explicit button path');
assert.ok(manager.includes('weatherLocation: state.manualRegionCode ? null : currentWeatherLocation'), 'manual region must outrank browser current-location fallback');
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
assert.ok(manager.includes('const afterPermission = await getBrowserLocationPermissionState'), 'post-prompt timeout must re-read browser permission');
assert.ok(manager.includes('afterPermission === LOCATION_PERMISSION.GRANTED'), 'post-prompt grant must remain GRANTED when coordinates time out');
assert.ok(manager.includes('void syncLocationPermission().then'), 'browser return/focus must re-sync permission state');
assert.ok(manager.includes("state.locationPermission = LOCATION_PERMISSION.DENIED"), 'only explicit permission denial may become DENIED');
assert.ok(manager.includes("locationButton.textContent = '변경'"), 'resolved current location must remove the current-location CTA label');
assert.ok(manager.includes("locationButton.textContent = '다시 시도'"), 'location failure must expose an explicit retry action');
assert.ok(locationSource.includes('getBrowserLocationPermissionState'), 'browser permission state must be queried when supported');
assert.ok(manager.includes("getCalendarWeather('', {"), 'Guest Calendar must use public Core weather when location/manual region is available');
assert.ok(manager.includes("if (!state.weatherEnabled || state.manualRegionCode || state.locationInFlight) return;"), 'Weather OFF/manual region must block unnecessary current-location requests');
assert.ok(manager.includes("regionSelect.setAttribute('aria-label', '날씨 지역 직접 선택')"), 'manual region selector must be accessible');


console.log('LOTBI Calendar KMA weather icon + browser location contract: PASS');
