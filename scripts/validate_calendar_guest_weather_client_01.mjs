import assert from 'node:assert/strict';

const {getPublicCalendarWeather, resolvePublicWeatherRegion} = await import('../site-calendar-public-weather.js?v=20260922-region1');

{
  let request = null;
  const result = await getPublicCalendarWeather({
    start: '2026-09-22',
    end: '2026-09-23',
    timezone: 'Asia/Seoul',
    latitude: 35.8242,
    longitude: 127.148,
  }, async (url, options) => {
    request = {url, options};
    return {
      ok: true,
      status: 200,
      json: async () => ({
        provider_ready: true,
        items: [{
          date: '2026-09-22',
          weather_kind: 'CLEAR',
          weather_icon: '☀️',
          source: 'KMA_SHORT',
          issued_at: '2026-09-21T23:00:00Z',
        }],
        ai_calls: 0,
      }),
    };
  });
  assert.equal(result.providerReady, true);
  assert.equal(result.aiCalls, 0);
  assert.equal(result.items.length, 1);
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.cache, 'no-store');
  assert.equal('Authorization' in request.options.headers, false);
  assert.match(request.url, /\/v2\/life\/weather\/public\?/);
}

{
  let thrown = null;
  try {
    await getPublicCalendarWeather({
      start: '2026-09-22',
      end: '2026-09-22',
      latitude: 0,
      longitude: 0,
    }, async () => { throw new Error('must not call'); });
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown?.code, 'CALENDAR_WEATHER_LOCATION_INVALID');
}

{
  let thrown = null;
  try {
    await getPublicCalendarWeather({
      start: '2026-09-22',
      end: '2026-09-22',
      latitude: 35.8242,
      longitude: 127.148,
    }, async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        detail: {code: 'PUBLIC_WEATHER_RATE_LIMITED', message: 'Too many requests'},
      }),
    }));
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown?.code, 'PUBLIC_WEATHER_RATE_LIMITED');
  assert.equal(thrown?.status, 429);
  assert.equal(thrown?.retryable, true);
}


{
  let request = null;
  const result = await resolvePublicWeatherRegion('전주시 만성동', async (url, options) => {
    request = {url, options};
    return {
      ok: true,
      status: 200,
      json: async () => ({
        provider_ready: true,
        found: true,
        label: '전북특별자치도 전주시 덕진구 만성동',
        latitude: 35.845321,
        longitude: 127.071234,
        coordinate_authority: 'NAVER_MAPS_GEOCODING',
        ai_calls: 0,
      }),
    };
  });
  assert.equal(result.providerReady, true);
  assert.equal(result.found, true);
  assert.equal(result.region.label, '전북특별자치도 전주시 덕진구 만성동');
  assert.equal(result.region.latitude, 35.845321);
  assert.equal(result.region.longitude, 127.071234);
  assert.equal(request.options.credentials, 'omit');
  assert.equal('Authorization' in request.options.headers, false);
  assert.match(request.url, /\/v2\/life\/weather\/region\/resolve\?/);
}

{
  let called = false;
  let thrown = null;
  try {
    await resolvePublicWeatherRegion('전주시 만성동 123-4', async () => {
      called = true;
      throw new Error('must not call');
    });
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown?.code, 'WEATHER_REGION_QUERY_INVALID');
  assert.equal(called, false);
}

{
  const result = await resolvePublicWeatherRegion('없는지역', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      provider_ready: true,
      found: false,
      label: null,
      latitude: null,
      longitude: null,
      coordinate_authority: null,
      ai_calls: 0,
    }),
  }));
  assert.equal(result.providerReady, true);
  assert.equal(result.found, false);
  assert.equal(result.region, null);
}

console.log('LOTBI Guest Calendar public weather client contract: PASS');
