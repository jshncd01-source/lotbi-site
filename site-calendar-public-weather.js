import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-2d31b05088c1';
import {normalizeCalendarWeatherResponse} from './site-calendar-weather.js?v=aset-2d31b05088c1';

function isoDate(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new SiteCoreError(`${label} 날짜가 올바르지 않습니다.`, {
      code: 'CALENDAR_WEATHER_DATE_INVALID',
      status: 422,
    });
  }
  return text;
}

export async function getPublicCalendarWeather(
  {start, end, timezone = 'Asia/Seoul', latitude, longitude},
  fetchImpl = globalThis.fetch,
) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const startDate = isoDate(start, '시작');
  const endDate = isoDate(end, '종료');
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < 31 || lat > 44.5
    || lon < 122 || lon > 132.5
  ) {
    throw new SiteCoreError('날씨 위치 정보가 올바르지 않습니다.', {
      code: 'CALENDAR_WEATHER_LOCATION_INVALID',
      status: 422,
    });
  }

  const params = new URLSearchParams({
    start: startDate,
    end: endDate,
    timezone: String(timezone || 'Asia/Seoul'),
    latitude: String(lat),
    longitude: String(lon),
  });

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/v2/life/weather/public?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    throw new SiteCoreError('LOTBI 날씨 서버에 접속하지 못했습니다.', {
      code: 'CALENDAR_WEATHER_NETWORK_ERROR',
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
        : 'LOTBI 날씨를 불러오지 못했습니다.',
      {
        code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }
  return normalizeCalendarWeatherResponse(payload);
}


export async function resolvePublicWeatherRegion(
  query,
  fetchImpl = globalThis.fetch,
) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const q = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
  if (q.length < 2 || q.length > 60 || /\d/.test(q)) {
    throw new SiteCoreError('시·군·구 또는 동 이름처럼 상세 번지 없는 지역명을 입력해 주세요.', {
      code: 'WEATHER_REGION_QUERY_INVALID',
      status: 422,
    });
  }

  const params = new URLSearchParams({q});
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/v2/life/weather/region/resolve?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    throw new SiteCoreError('LOTBI 지역 검색 서버에 접속하지 못했습니다.', {
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
      providerReady: payload.provider_ready === true,
      found: false,
      region: null,
      aiCalls: 0,
    });
  }

  const label = typeof payload.label === 'string' ? payload.label.trim() : '';
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (
    !label
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < 31
    || latitude > 44.5
    || longitude < 122
    || longitude > 132.5
    || payload.coordinate_authority !== 'NAVER_MAPS_GEOCODING'
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
