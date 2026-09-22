import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=20260922-notificationperm1';

function normalizeRegionQuery(value) {
  const query = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (
    query.length < 2
    || query.length > 60
    || /\d/.test(query)
    || !/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ·.\- ]+$/.test(query)
  ) {
    throw new SiteCoreError('시·군·구 또는 동 이름으로 지역을 입력해 주세요.', {
      code: 'WEATHER_REGION_QUERY_INVALID',
      status: 422,
    });
  }
  return query;
}

export async function resolveCalendarWeatherRegion(query, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const normalized = normalizeRegionQuery(query);
  let response;
  try {
    response = await fetchImpl(
      `${CORE_ORIGIN}/v2/life/weather/region/resolve?q=${encodeURIComponent(normalized)}`,
      {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {'Accept': 'application/json'},
      },
    );
  } catch {
    throw new SiteCoreError('날씨 지역을 확인하지 못했습니다.', {
      code: 'CALENDAR_WEATHER_REGION_NETWORK_ERROR',
      retryable: true,
    });
  }

  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    throw new SiteCoreError(
      typeof detail.message === 'string' && detail.message
        ? detail.message
        : '날씨 지역을 확인하지 못했습니다.',
      {
        code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }

  if (
    typeof payload?.provider_ready !== 'boolean'
    || typeof payload?.found !== 'boolean'
    || payload?.ai_calls !== 0
  ) {
    throw new SiteCoreError('날씨 지역 응답 형식이 올바르지 않습니다.', {
      code: 'CALENDAR_WEATHER_REGION_CONTRACT_INVALID',
    });
  }
  if (!payload.provider_ready || !payload.found) {
    return Object.freeze({
      providerReady: payload.provider_ready,
      found: false,
      region: null,
      aiCalls: 0,
    });
  }

  const label = typeof payload.label === 'string' ? payload.label.trim() : '';
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const authority = String(payload.coordinate_authority || '');
  if (
    !label
    || label.length > 80
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < 31
    || latitude > 44.5
    || longitude < 122
    || longitude > 132.5
    || authority !== 'NAVER_MAPS_GEOCODING'
  ) {
    throw new SiteCoreError('날씨 지역 응답 형식이 올바르지 않습니다.', {
      code: 'CALENDAR_WEATHER_REGION_CONTRACT_INVALID',
    });
  }

  return Object.freeze({
    providerReady: true,
    found: true,
    region: Object.freeze({
      label,
      latitude,
      longitude,
      midRegionCode: null,
    }),
    aiCalls: 0,
  });
}
