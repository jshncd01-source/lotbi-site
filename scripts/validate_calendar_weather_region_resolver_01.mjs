import assert from 'node:assert/strict';

const {resolveCalendarWeatherRegion} = await import('../site-calendar-region-resolver.js?v=20260922-regionresolve1');

{
  let request = null;
  const result = await resolveCalendarWeatherRegion('전주시 만성동', async (url, options) => {
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
  assert.equal(result.found, true);
  assert.equal(result.region.label, '전북특별자치도 전주시 덕진구 만성동');
  assert.equal(request.options.credentials, 'omit');
  assert.equal('Authorization' in request.options.headers, false);
  assert.match(request.url, /\/v2\/life\/weather\/region\/resolve\?q=/);
}

{
  let called = false;
  let error = null;
  try {
    await resolveCalendarWeatherRegion('전주시 만성동 123-4', async () => {
      called = true;
      throw new Error('must not fetch');
    });
  } catch (value) {
    error = value;
  }
  assert.equal(called, false);
  assert.equal(error?.code, 'WEATHER_REGION_QUERY_INVALID');
}

{
  const result = await resolveCalendarWeatherRegion('서울 강남구', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      provider_ready: false,
      found: false,
      label: null,
      latitude: null,
      longitude: null,
      coordinate_authority: null,
      ai_calls: 0,
    }),
  }));
  assert.deepEqual(result, {
    providerReady: false,
    found: false,
    region: null,
    aiCalls: 0,
  });
}

console.log('LOTBI Calendar manual weather region resolver contract: PASS');
