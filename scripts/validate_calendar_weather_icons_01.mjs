import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {getCalendarWeather} = await import('../site-calendar.js?v=20260922-holiday1');
const {loadLifeCalendarManagerView, buildCalendarAriaLabel} = await import('../site-calendar-manager.js?v=20260922-holiday1');
const {normalizeCalendarWeatherResponse, calendarWeatherByDate, weatherTemperatureLabel} = await import('../site-calendar-weather.js?v=20260923-kmaglyph1');
const {addCivilDays} = await import('../site-calendar-model.js');
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
  assert.equal(calls.length, 4);
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
const weatherModuleSource = fs.readFileSync(path.join(ROOT, 'site-calendar-weather.js'), 'utf8');
for (const token of [
  'const weatherIcon = calendarWeatherIconNode(weather.weatherKind)',
  'calendarWeatherIconNode',
  'state.weather = result.weather || []',
]) assert.ok(manager.includes(token), `missing weather icon UI contract: ${token}`);
// 이모지 회귀 방지. 같은 코드포인트가 OS 마다 다른 모양·색으로 렌더되는 것이
// "날씨가 흐리게 보인다"의 근본 원인이었다.
assert.ok(
  !manager.includes('weatherIcon.textContent = weather.weatherIcon'),
  'the date cell must draw the SVG glyph, not the provider emoji',
);
for (const token of [
  "svg.setAttribute('aria-hidden', 'true')",
  "doc.createElementNS(SVG_NS, 'svg')",
]) assert.ok(weatherModuleSource.includes(token), `missing weather glyph contract: ${token}`);
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
assert.ok(manager.includes('const afterPermission = await getBrowserLocationPermissionState'), 'post-prompt timeout must re-read browser permission');
assert.ok(manager.includes('afterPermission === LOCATION_PERMISSION.GRANTED'), 'post-prompt grant must remain GRANTED when coordinates time out');
assert.ok(manager.includes('void syncLocationPermission().then'), 'browser return/focus must re-sync permission state');
assert.ok(manager.includes("state.locationPermission = LOCATION_PERMISSION.DENIED"), 'only explicit permission denial may become DENIED');
assert.ok(manager.includes("locationButton.textContent = '변경'"), 'resolved current location must remove the current-location CTA label');
assert.ok(manager.includes("locationButton.textContent = '다시 시도'"), 'location failure must expose an explicit retry action');
assert.ok(locationSource.includes('getBrowserLocationPermissionState'), 'browser permission state must be queried when supported');


// Core #287 added the normalized measurements to the Calendar weather reads.
// Site owns parsing them; where they are shown is the Calendar design owner's
// call, so these regressions cover the data contract only.
{
  const base = {
    date: '2026-09-23',
    weather_kind: 'CLEAR',
    weather_icon: '\u2600\ufe0f',
    source: 'KMA_SHORT',
    issued_at: '2026-09-23T02:00:00+00:00',
  };

  const full = normalizeCalendarWeatherResponse({
    provider_ready: true,
    ai_calls: 0,
    items: [{
      ...base,
      temperature_c: 23.4,
      min_temperature_c: 17,
      max_temperature_c: 27.2,
      precipitation_probability: 20,
      freshness: 'CACHE_VALID',
    }],
  });
  const [item] = full.items;
  assert.equal(item.temperature, 23.4, 'temperature_c must be parsed');
  assert.equal(item.minTemperature, 17, 'min_temperature_c must be parsed');
  assert.equal(item.maxTemperature, 27.2, 'max_temperature_c must be parsed');
  assert.equal(item.precipitationProbability, 20, 'precipitation_probability must be parsed');
  assert.equal(item.freshness, 'CACHE_VALID', 'freshness must be parsed');
  assert.equal(weatherTemperatureLabel(item), '23\u00b0', 'a current temperature reads as one rounded value');

  // An older Core, or a date the provider did not cover, simply omits them.
  const bare = normalizeCalendarWeatherResponse({provider_ready: true, ai_calls: 0, items: [{...base}]});
  const [legacy] = bare.items;
  for (const field of ['temperature', 'minTemperature', 'maxTemperature', 'precipitationProbability']) {
    assert.equal(legacy[field], null, `absent ${field} must normalize to null, never 0`);
  }
  assert.equal(legacy.freshness, 'CACHE_VALID', 'absent freshness must default, not throw');
  assert.equal(weatherTemperatureLabel(legacy), '', 'no measurement must render no temperature text');

  // Min/max without a current reading is a real KMA mid-term shape.
  const midTerm = normalizeCalendarWeatherResponse({
    provider_ready: true,
    ai_calls: 0,
    items: [{...base, source: 'KMA_MID', min_temperature_c: 17, max_temperature_c: 27}],
  });
  assert.equal(weatherTemperatureLabel(midTerm.items[0]), '17\u00b0 / 27\u00b0', 'mid-term must read as a range');

  // Garbage is a contract violation, not a silent zero.
  for (const bad of [
    {...base, temperature_c: 'warm'},
    {...base, max_temperature_c: Number.NaN},
    {...base, precipitation_probability: 120},
    {...base, precipitation_probability: 12.5},
    {...base, freshness: 'MADE_UP'},
  ]) {
    assert.throws(
      () => normalizeCalendarWeatherResponse({provider_ready: true, ai_calls: 0, items: [bad]}),
      TypeError,
      'invalid measurements must be rejected',
    );
  }

  // Provider readiness stays environment-driven and never fabricates a reading.
  const notReady = normalizeCalendarWeatherResponse({provider_ready: false, ai_calls: 0, items: []});
  assert.equal(notReady.providerReady, false, 'provider_ready must pass through');
  assert.equal(notReady.items.length, 0, 'a provider that is not ready must yield no days');
  assert.equal(calendarWeatherByDate(notReady.items).size, 0, 'no day may be invented when the provider is not ready');
}

// Core answers the authenticated Calendar weather read only for a bounded
// forward window: wider than 15 inclusive days is WEATHER_DATE_WINDOW_INVALID
// (422), and a forecast exists only from today onward. The month grid is 42
// cells, so the unclamped grid range was ~35 days and Production returned 422
// for every signed-in user once the CORS and session gates were cleared.
{
  async function weatherRequestFor(date, now) {
    let weatherUrl = null;
    await loadLifeCalendarManagerView('site-token', {
      view: 'month',
      date,
      timezone: 'Asia/Seoul',
      now: new Date(now),
      weatherLocation: {latitude: 35.8242, longitude: 127.148},
      fetchImpl: async url => {
        const parsed = new URL(url);
        if (parsed.pathname === '/v2/life/weather') {
          weatherUrl = parsed;
          return jsonResponse({provider_ready: false, items: [], ai_calls: 0});
        }
        if (parsed.pathname === '/v2/life/attention') {
          return jsonResponse({
            view: 'ATTENTION', as_of: now, timezone: 'Asia/Seoul',
            coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
          });
        }
        if (parsed.pathname === '/v2/life/agenda') {
          return jsonResponse({
            view: 'AGENDA', as_of: now, timezone: 'Asia/Seoul',
            coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0,
          });
        }
        if (parsed.pathname === '/v2/life/holidays') {
          return jsonResponse({coverage_status: 'VERIFIED', items: [], ai_calls: 0});
        }
        throw new Error(`unexpected request ${parsed.pathname}`);
      },
    });
    return weatherUrl;
  }

  function inclusiveDays(start, end) {
    let days = 1;
    let cursor = start;
    while (cursor < end) {
      cursor = addCivilDays(cursor, 1);
      days += 1;
    }
    return days;
  }

  // The month containing today: the request must start no earlier than today
  // and stay inside what Core accepts.
  const current = await weatherRequestFor('2026-09-23', '2026-09-23T00:00:00Z');
  assert.ok(current, 'the visible current month must still read weather');
  const start = current.searchParams.get('start');
  const end = current.searchParams.get('end');
  assert.equal(start, '2026-09-23', 'the window must not begin before today');
  assert.ok(end <= '2026-10-07', 'the window must not reach past the forecast horizon');
  assert.ok(
    inclusiveDays(start, end) <= 15,
    `the window must fit Core's 15-day limit, got ${inclusiveDays(start, end)} days`,
  );

  // A month already past has no forecastable day: ask for nothing at all rather
  // than for days that cannot exist.
  assert.equal(
    await weatherRequestFor('2026-08-15', '2026-09-23T00:00:00Z'),
    null,
    'a past month must not trigger a weather request',
  );

  // A month beyond the horizon is the same case from the other side.
  assert.equal(
    await weatherRequestFor('2026-12-15', '2026-09-23T00:00:00Z'),
    null,
    'a month beyond the forecast horizon must not trigger a weather request',
  );

  // The month after this one overlaps the horizon only partially; the request
  // must cover that overlap and stop there.
  const next = await weatherRequestFor('2026-10-15', '2026-09-23T00:00:00Z');
  assert.ok(next, 'a month overlapping the horizon must still read weather');
  assert.ok(next.searchParams.get('start') >= '2026-09-23', 'never before today');
  assert.ok(next.searchParams.get('end') <= '2026-10-07', 'never past the horizon');
  assert.ok(
    inclusiveDays(next.searchParams.get('start'), next.searchParams.get('end')) <= 15,
    'the partial-overlap window must fit Core limit too',
  );
}

console.log('LOTBI Calendar KMA weather icon + browser location contract: PASS');
