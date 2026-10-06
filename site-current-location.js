import {isLocationUsageEnabled, LOCATION_USAGE_EVENT} from './site-location-preference.js?v=aset-18b59f6ede4a';

export const BROWSER_CURRENT_LOCATION_MAX_AGE_MS = 120_000;

export const LOCATION_PERMISSION = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  PROMPT_REQUIRED: 'PROMPT_REQUIRED',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const LOCATION_RESOLUTION = Object.freeze({
  IDLE: 'IDLE',
  REQUESTING: 'REQUESTING',
  RESOLVED: 'RESOLVED',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
});

// LOTBI 위치 공통 계층의 단 하나의 재사용 지점 (§8/§9).
//
// 브라우저 안에서 geolocation 권한은 기능별 권한이 아니라 origin 권한이다(§3).
// 그래서 "방금 읽은 현재 위치" 도 기능별 자산이 아니다: 날씨가 좌표를 읽은
// 직후 축제를 열면 같은 좌표를 그대로 쓰면 되고, GPS 를 다시 부를 이유가 없다.
//
// 저장 위치는 이 모듈 스코프뿐이다 -- 브라우저 저장소도, 서버도, analytics 도
// 아니다(§21). 탭을 닫으면 사라진다. (이 모듈에 저장 API 이름이 등장하는 것
// 자체를 validate_calendar_weather_icons_01.mjs 가 금지한다.)
let recentBrowserLocation = null;

// 같은 순간에 두 기능이 mount 되어도 getCurrentPosition 은 한 번만 부른다(§9).
// 먼저 시작한 요청의 promise 를 뒤이은 요청자들이 함께 기다린다.
let inFlightBrowserLocation = null;
let locationPreferenceGeneration = 0;
globalThis.window?.addEventListener(LOCATION_USAGE_EVENT, () => {
  locationPreferenceGeneration += 1;
  if (!isLocationUsageEnabled()) clearRecentBrowserCurrentLocation();
});

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

// 어떤 브라우저는 geolocation 권한 질의를 지원하지 않는다고 말하지도, 답하지도
// 않는다 -- query() 가 돌려준 promise 가 그냥 끝나지 않는다 (GitHub Actions 의
// headless Chrome 에서 실측). 그 경우에도 권한 확인은 끝나야 한다: 확인이 끝나지
// 않으면 기능은 영원히 "확인 중" 에 머문다 (§23).
const PERMISSION_QUERY_TIMEOUT_MS = 2_000;

const PERMISSION_QUERY_UNANSWERED = Symbol('PERMISSION_QUERY_UNANSWERED');

function queryWithinTimeout(permissions, timeoutMs) {
  const bounded = Math.max(0, Number(timeoutMs) || 0);
  if (!bounded) return permissions.query({name: 'geolocation'});
  let timer;
  return Promise.race([
    permissions.query({name: 'geolocation'}),
    new Promise(resolve => { timer = setTimeout(() => resolve(PERMISSION_QUERY_UNANSWERED), bounded); }),
  ]).finally(() => {
    // 남은 타이머가 페이지나 테스트 프로세스를 붙잡고 있지 않게 한다.
    if (timer !== undefined) clearTimeout(timer);
  });
}

export async function getBrowserLocationPermissionState({
  permissions = globalThis.navigator?.permissions,
  geolocation = globalThis.navigator?.geolocation,
  permissionQueryTimeoutMs = PERMISSION_QUERY_TIMEOUT_MS,
} = {}) {
  if (!isLocationUsageEnabled()) {
    clearRecentBrowserCurrentLocation();
    return LOCATION_PERMISSION.DENIED;
  }
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    clearRecentBrowserCurrentLocation();
    return LOCATION_PERMISSION.UNAVAILABLE;
  }
  if (!permissions || typeof permissions.query !== 'function') {
    return LOCATION_PERMISSION.UNKNOWN;
  }
  try {
    const result = await queryWithinTimeout(permissions, permissionQueryTimeoutMs);
    // 답이 오지 않았다는 것은 알 수 없다는 뜻이고, 허용이라는 뜻이 아니다 (§18).
    if (result === PERMISSION_QUERY_UNANSWERED) return LOCATION_PERMISSION.UNKNOWN;
    if (result?.state === 'granted') return LOCATION_PERMISSION.GRANTED;
    if (result?.state === 'denied') {
      // 권한이 사라진 순간 캐시도 사라진다. 예전에 GPS 가 성공했다는 사실은
      // 지금 권한이 있다는 뜻이 아니고, 캐시가 권한 우회 수단이 되어서도 안 된다(§8).
      clearRecentBrowserCurrentLocation();
      return LOCATION_PERMISSION.DENIED;
    }
    if (result?.state === 'prompt') return LOCATION_PERMISSION.PROMPT_REQUIRED;
    return LOCATION_PERMISSION.UNKNOWN;
  } catch {
    // Safari and older browsers may expose Permissions API without supporting
    // geolocation queries. Geolocation itself remains the fallback authority.
    return LOCATION_PERMISSION.UNKNOWN;
  }
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
  if (!isLocationUsageEnabled()) {
    clearRecentBrowserCurrentLocation();
    return Promise.reject(new BrowserLocationError('LOCATION_USAGE_DISABLED', '설정에서 위치 사용이 꺼져 있어요.'));
  }
  const preferenceGeneration = locationPreferenceGeneration;
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    return Promise.reject(new BrowserLocationError(
      'BROWSER_LOCATION_UNSUPPORTED',
      '이 브라우저에서는 현재 위치를 사용할 수 없습니다.',
    ));
  }
  const usableMaxAgeMs = Math.max(0, Math.min(
    BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
    Number(maxAgeMs) || BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
  ));
  const browserTimeoutMs = Math.max(1_000, Math.min(20_000, Number(timeoutMs) || 8_000));
  const position = new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => {
        try {
          if (!isLocationUsageEnabled() || preferenceGeneration !== locationPreferenceGeneration) {
            throw new BrowserLocationError('LOCATION_USAGE_DISABLED', '설정에서 위치 사용이 변경되었어요.');
          }
          resolve(normalizePosition(position, {now, maxAgeMs}));
        } catch (error) {
          reject(browserLocationFailure(error));
        }
      },
      error => reject(browserLocationFailure(error)),
      {
        enableHighAccuracy: false,
        timeout: browserTimeoutMs,
        maximumAge: usableMaxAgeMs,
      },
    );
  });

  // 브라우저가 자기 timeout 을 지키지 않고 콜백을 아예 부르지 않는 경우에도 요청은
  // 끝나야 한다 (§23: 무한 spinner 금지). 앱의 getCurrentLocationWithTimeout 과 같은
  // 형태다. 브라우저에게 먼저 기회를 주고, 그보다 늦게서야 우리가 끊는다 -- 정상
  // 동작하는 브라우저에서는 이 타이머가 쓰이지 않는다.
  let timer;
  return Promise.race([
    position,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new BrowserLocationError('BROWSER_LOCATION_TIMEOUT', '현재 위치 확인 시간이 초과되었습니다.')),
        browserTimeoutMs + 2_000,
      );
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

// 방금 성공한 현재 위치가 아직 쓸 만하면 그것을 돌려준다. 없으면 null (§8).
//
// 이 함수는 권한을 확인하지 않는다. 권한 확인은 언제나 호출자의 첫걸음이고,
// getBrowserLocationPermissionState 가 DENIED/UNAVAILABLE 을 읽는 순간 여기
// 담긴 값은 지워진다. "캐시가 있으니 권한도 있다" 는 판단은 어디서도 하지 않는다.
export function getRecentBrowserCurrentLocation({
  now = Date.now,
  maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
} = {}) {
  if (!isLocationUsageEnabled()) { clearRecentBrowserCurrentLocation(); return null; }
  if (!recentBrowserLocation) return null;
  return isFreshBrowserCurrentLocation(recentBrowserLocation, {now, maxAgeMs})
    ? recentBrowserLocation
    : null;
}

export function clearRecentBrowserCurrentLocation() {
  recentBrowserLocation = null;
  inFlightBrowserLocation = null;
}

// 기능들이 현재 위치를 가져오는 자리 (§8/§9).
//
// requestBrowserCurrentLocation 과 같은 계약(같은 값, 같은 BrowserLocationError)을
// 지키지만 두 가지가 다르다: 다른 기능이 방금 읽어 둔 좌표가 아직 신선하면 GPS 를
// 부르지 않고 그것을 쓰고, 같은 순간에 여러 기능이 물어도 실제 요청은 하나다.
//
// 권한 팝업 정책은 바뀌지 않는다: 이 함수도 결국 getCurrentPosition 을 부를 수
// 있으므로, 권한이 GRANTED 가 아닐 때 호출해도 되는지는 호출자가 §5 대로 판단한다.
export function acquireSharedBrowserCurrentLocation({
  geolocation = globalThis.navigator?.geolocation,
  now = Date.now,
  timeoutMs = 8_000,
  maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
} = {}) {
  if (!isLocationUsageEnabled()) {
    clearRecentBrowserCurrentLocation();
    return Promise.reject(new BrowserLocationError('LOCATION_USAGE_DISABLED', '설정에서 위치 사용이 꺼져 있어요.'));
  }
  const preferenceGeneration = locationPreferenceGeneration;
  const reusable = getRecentBrowserCurrentLocation({now, maxAgeMs});
  if (reusable) return Promise.resolve(reusable);

  if (inFlightBrowserLocation) return inFlightBrowserLocation;

  const pending = requestBrowserCurrentLocation({geolocation, now, timeoutMs, maxAgeMs})
    .then(location => {
      if (!isLocationUsageEnabled() || preferenceGeneration !== locationPreferenceGeneration) {
        throw new BrowserLocationError('LOCATION_USAGE_DISABLED', '설정에서 위치 사용이 변경되었어요.');
      }
      recentBrowserLocation = location;
      return location;
    });
  inFlightBrowserLocation = pending;
  // 성공이든 실패든 이 요청이 끝나면 자리를 비운다. 실패한 요청을 뒤에 온
  // 호출자에게 계속 물려주지 않는다. (여기서 결과를 소비하므로 호출자가
  // catch 하지 않아도 unhandled rejection 이 되지 않는다.)
  const release = () => {
    if (inFlightBrowserLocation === pending) inFlightBrowserLocation = null;
  };
  pending.then(release, release);
  return pending;
}

// 향후 위치 기반 기능이 쓰는 단 하나의 입구 (§17).
//
// 순서가 계약이다: 권한 읽기 -> 허용이면 좌표 (§6). 화면을 열었다는 이유만으로
// 권한 팝업이 뜨지 않게, 명시적 사용자 동작이 있을 때만 allowPrompt 를 켠다 (§5).
export async function resolveSharedBrowserCurrentLocation({
  permissions = globalThis.navigator?.permissions,
  geolocation = globalThis.navigator?.geolocation,
  now = Date.now,
  timeoutMs = 8_000,
  maxAgeMs = BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
  allowPrompt = false,
  permissionQueryTimeoutMs,
} = {}) {
  const permission = await getBrowserLocationPermissionState({
    permissions, geolocation, permissionQueryTimeoutMs,
  });

  if (permission === LOCATION_PERMISSION.DENIED) {
    return Object.freeze({
      permission,
      resolution: LOCATION_RESOLUTION.IDLE,
      location: null,
      error: null,
    });
  }
  if (permission === LOCATION_PERMISSION.UNAVAILABLE) {
    return Object.freeze({
      permission,
      resolution: LOCATION_RESOLUTION.ERROR,
      location: null,
      error: new BrowserLocationError(
        'BROWSER_LOCATION_UNSUPPORTED',
        '이 브라우저에서는 현재 위치를 사용할 수 없습니다.',
      ),
    });
  }
  // PROMPT_REQUIRED(미결정) 와 UNKNOWN(Safari 처럼 권한 상태를 알려주지 않는
  // 브라우저) 은 같은 취급이다: 사용자가 누르지 않았으면 좌표를 묻지 않는다.
  // UNKNOWN 을 GRANTED 로 가정하지 않는다 (§18).
  if (permission !== LOCATION_PERMISSION.GRANTED && !allowPrompt) {
    return Object.freeze({
      permission,
      resolution: LOCATION_RESOLUTION.IDLE,
      location: null,
      error: null,
    });
  }

  try {
    const location = await acquireSharedBrowserCurrentLocation({geolocation, now, timeoutMs, maxAgeMs});
    return Object.freeze({
      permission: LOCATION_PERMISSION.GRANTED,
      resolution: LOCATION_RESOLUTION.RESOLVED,
      location,
      error: null,
    });
  } catch (error) {
    const failure = browserLocationFailure(error);
    if (failure.code === 'BROWSER_LOCATION_DENIED') {
      clearRecentBrowserCurrentLocation();
      return Object.freeze({
        permission: LOCATION_PERMISSION.DENIED,
        resolution: LOCATION_RESOLUTION.IDLE,
        location: null,
        error: failure,
      });
    }
    return Object.freeze({
      permission,
      resolution: failure.code === 'BROWSER_LOCATION_TIMEOUT'
        ? LOCATION_RESOLUTION.TIMEOUT
        : LOCATION_RESOLUTION.ERROR,
      location: null,
      error: failure,
    });
  }
}
