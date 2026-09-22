export const BROWSER_CURRENT_LOCATION_MAX_AGE_MS = 120_000;

export class BrowserLocationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BrowserLocationError';
    this.code = code;
  }
}

function nowMillis(now) {
  const value = typeof now === 'function' ? Number(now()) : Number(now);
  return Number.isFinite(value) ? value : Date.now();
}

export function isFreshBrowserCurrentLocation(
  value,
  {now = Date.now, maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS} = {},
) {
  if (!value || value.source !== 'BROWSER_CURRENT') return false;
  const capturedAtMs = Number(value.capturedAtMs);
  const current = nowMillis(now);
  if (!Number.isFinite(capturedAtMs) || capturedAtMs <= 0) return false;
  const age = current - capturedAtMs;
  return age >= -30_000 && age <= maxAgeMs;
}

function normalizePosition(position, {now = Date.now, maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS} = {}) {
  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  const accuracyMeters = Number(position?.coords?.accuracy);
  const capturedAtMs = Number(position?.timestamp);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90
    || longitude < -180 || longitude > 180
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters < 0
    || !Number.isFinite(capturedAtMs)
    || capturedAtMs <= 0
  ) {
    throw new BrowserLocationError('BROWSER_LOCATION_INVALID', '브라우저 위치 정보가 올바르지 않습니다.');
  }
  const value = Object.freeze({
    latitude,
    longitude,
    source: 'BROWSER_CURRENT',
    accuracyMeters,
    approximationState: 'UNKNOWN',
    timestamp: new Date(capturedAtMs).toISOString(),
    capturedAtMs,
  });
  if (!isFreshBrowserCurrentLocation(value, {now, maxAgeMs})) {
    throw new BrowserLocationError('BROWSER_LOCATION_STALE', '현재 위치가 오래되어 다시 확인이 필요합니다.');
  }
  return value;
}

function browserLocationFailure(error) {
  if (error instanceof BrowserLocationError) return error;
  const code = Number(error?.code);
  if (code === 1) return new BrowserLocationError('BROWSER_LOCATION_DENIED', '브라우저 위치 권한이 거부되었습니다.');
  if (code === 2) return new BrowserLocationError('BROWSER_LOCATION_UNAVAILABLE', '현재 위치를 확인할 수 없습니다.');
  if (code === 3) return new BrowserLocationError('BROWSER_LOCATION_TIMEOUT', '현재 위치 확인 시간이 초과되었습니다.');
  return new BrowserLocationError('BROWSER_LOCATION_UNAVAILABLE', '현재 위치를 확인할 수 없습니다.');
}

export function requestBrowserCurrentLocation({
  geolocation = globalThis.navigator?.geolocation,
  now = Date.now,
  timeoutMs = 8_000,
  maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
} = {}) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    return Promise.reject(new BrowserLocationError(
      'BROWSER_LOCATION_UNSUPPORTED',
      '이 브라우저에서는 현재 위치를 사용할 수 없습니다.',
    ));
  }
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => {
        try {
          resolve(normalizePosition(position, {now, maxAgeMs}));
        } catch (error) {
          reject(browserLocationFailure(error));
        }
      },
      error => reject(browserLocationFailure(error)),
      {
        enableHighAccuracy: false,
        timeout: Math.max(1_000, Math.min(20_000, Number(timeoutMs) || 8_000)),
        maximumAge: 0,
      },
    );
  });
}
