import assert from 'node:assert/strict';

const {getPublicCalendarWeather} = await import('../site-calendar-public-weather.js?v=20260922-guestweather1');

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
          forecast_date: '2026-09-22',
          kind: 'CLEAR',
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

console.log('LOTBI Guest Calendar public weather client contract: PASS');
