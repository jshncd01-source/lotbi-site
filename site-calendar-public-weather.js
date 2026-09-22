import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=20260921-smartcaldraft1';
import {normalizeCalendarWeatherResponse} from './site-calendar-weather.js?v=20260922-weatherfinal1';

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
  {start, end, timezone = 'Asia/Seoul', latitude, longitude, manualRegionCode = ''},
  fetchImpl = globalThis.fetch,
) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const startDate = isoDate(start, '시작');
  const endDate = isoDate(end, '종료');
  const manualRegion = typeof manualRegionCode === 'string' ? manualRegionCode.trim().toUpperCase() : '';
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  if (
    hasLatitude !== hasLongitude
    || (manualRegion && !/^KR_[A-Z0-9_]{2,24}$/.test(manualRegion))
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
  });
  if (hasLatitude && hasLongitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 31 || lat > 44.5 || lon < 122 || lon > 132.5) {
      throw new SiteCoreError('날씨 위치 정보가 올바르지 않습니다.', {
        code: 'CALENDAR_WEATHER_LOCATION_INVALID',
        status: 422,
      });
    }
    params.set('latitude', String(lat));
    params.set('longitude', String(lon));
  }
  if (manualRegion) params.set('manual_region_code', manualRegion);

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
