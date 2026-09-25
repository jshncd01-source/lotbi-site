const NAVER_MAPS_WEB_APPNAME = 'https://lotbiai.com';
const NAVER_MAPS_ANDROID_PACKAGE = 'com.nhn.android.nmap';
const NAVER_MAPS_WEB_SEARCH_BASE = 'https://map.naver.com/p/search/';
const NAVIGATION_TTL_MS = 60 * 60 * 1000;

// SITE-PLACE-CARD-MAP-DEEPLINK-01 — KakaoMap과 티맵 손잡이.
//
// NAVER 가 이 카드의 primary identity 다. 아래 두 개는 같은 장소를 사용자가 이미
// 쓰는 지도 앱에서 열어 주는 handoff 일 뿐, 장소를 정하지 않는다. 좌표도 이름도
// 전부 NAVER 가 확정한 값을 그대로 넘긴다 — 여기서 다시 검색하거나 보정하지
// 않는다.
//
// 새 API 키도, 과금도, SDK 도 없다. URL scheme 과 Android intent 뿐이다.
// Core 에 있는 카카오내비 SDK 경로는 구 라이프플랜 전용이고 이 카드와 무관하다 —
// 이번 작업은 딥링크지 내비 SDK 연동이 아니므로 그 경로를 켜지 않는다.
const KAKAO_NAVI_HANDOFF_PATH = '/kakao-navi.html';
const TMAP_SCHEME = 'tmap';
const TMAP_ANDROID_PACKAGE = 'com.skt.tmap.ku';
const TMAP_ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${TMAP_ANDROID_PACKAGE}`;
const TMAP_IOS_STORE_URL = 'https://apps.apple.com/kr/app/id431589174';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeVerifiedPhoto(place) {
  const candidate = text(place?.image_url);
  const evidence = place?.photo_evidence;
  if (!candidate || candidate.length > 2048 || !evidence || typeof evidence !== 'object') {
    return Object.freeze({url: '', evidence: null});
  }
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.searchParams.has('key')
      || !(host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com'))
      || evidence.provider !== 'GOOGLE_PLACES'
      || evidence.verification_state !== 'VERIFIED'
      || !['EXACT_NAME_AND_ADDRESS', 'EXACT_NAME_AND_80M_COORDINATE'].includes(text(evidence.match_basis))
      || !text(evidence.provider_place_id)
      || !Number.isFinite(Date.parse(text(evidence.fetched_at)))
    ) return Object.freeze({url: '', evidence: null});
    return Object.freeze({
      url: url.href,
      evidence: Object.freeze({
        provider: 'GOOGLE_PLACES',
        providerPlaceId: text(evidence.provider_place_id),
        matchBasis: text(evidence.match_basis),
        fetchedAt: text(evidence.fetched_at),
        verificationState: 'VERIFIED',
        attributions: Object.freeze(Array.isArray(evidence.attributions) ? evidence.attributions.slice(0, 8) : []),
      }),
    });
  } catch {
    return Object.freeze({url: '', evidence: null});
  }
}

function normalizeVerifiedPhone(place) {
  if (place?.phone_verified !== true) return Object.freeze({number: '', href: ''});
  const number = text(place?.phone);
  if (!number || number.length > 32 || !/^[+()0-9][+()0-9 .-]{6,31}$/u.test(number)) {
    return Object.freeze({number: '', href: ''});
  }
  const compact = number.replace(/[^\d+]/gu, '');
  if (!/^\+?\d{7,15}$/u.test(compact) || (compact.match(/\+/gu) || []).length > 1) {
    return Object.freeze({number: '', href: ''});
  }
  return Object.freeze({number, href: `tel:${compact}`});
}

export function buildVerifiedPhoneHref(place) {
  if (!place || typeof place !== 'object') return '';
  const number = text(place.phone);
  const verified = place.phoneVerified === true || place.phone_verified === true;
  if (!verified) return '';
  return normalizeVerifiedPhone({phone: number, phone_verified: true}).href;
}

const FOOD_LICENSE_STATES = new Set(['VERIFIED', 'AMBIGUOUS', 'NOT_FOUND', 'CONFLICTING', 'UNAVAILABLE']);

function normalizeFoodLicenseVerification(value) {
  if (!value || typeof value !== 'object') return null;
  const state = text(value.state).toUpperCase();
  if (!FOOD_LICENSE_STATES.has(state)) return null;
  if (text(value.source) !== 'MOIS_FOOD_LICENSE' || value.ai_calls !== 0) return null;
  return Object.freeze({
    state,
    source: 'MOIS_FOOD_LICENSE',
    administrativeStatus: state === 'VERIFIED' ? text(value.administrative_status) : '',
  });
}

function coordinateReady(place) {
  const latitude = finiteCoordinate(place?.latitude);
  const longitude = finiteCoordinate(place?.longitude);
  return latitude !== null
    && longitude !== null
    && latitude >= 31.43
    && latitude <= 44.35
    && longitude >= 122.37
    && longitude <= 132
    && text(place?.coordinate_system).toUpperCase() === 'WGS84'
    && text(place?.coordinate_authority) === 'NAVER_MAPS_GEOCODING'
    && place?.navigation_capability === true;
}

function normalizePlace(place, index) {
  if (!place || typeof place !== 'object') return null;
  const name = text(place.name);
  const address = text(place.road_address) || text(place.address);
  if (!name || !address) return null;
  const latitude = finiteCoordinate(place.latitude);
  const longitude = finiteCoordinate(place.longitude);
  const sourceUrl = text(place.source_url);
  const verifiedPhone = normalizeVerifiedPhone(place);
  const verifiedPhoto = normalizeVerifiedPhoto(place);
  const foodLicenseVerification = normalizeFoodLicenseVerification(place.food_license_verification);
  return Object.freeze({
    candidateIndex: index,
    resultId: text(place.result_id) || `place-${index + 1}`,
    placeId: text(place.place_id),
    name,
    category: text(place.category),
    address,
    latitude,
    longitude,
    coordinateSystem: text(place.coordinate_system).toUpperCase(),
    coordinateAuthority: text(place.coordinate_authority),
    sourceUrl: sourceUrl.startsWith('https://') ? sourceUrl : '',
    imageUrl: verifiedPhoto.url,
    photoEvidence: verifiedPhoto.evidence,
    phone: verifiedPhone.number,
    phoneHref: verifiedPhone.href,
    phoneVerified: Boolean(verifiedPhone.href),
    foodLicenseVerification,
    navigationCapable: coordinateReady(place),
  });
}

export function normalizePlaceResult(value, {capturedAt = Date.now()} = {}) {
  if (!value || typeof value !== 'object') return null;
  if (value.contract_id !== 'CORE-PLACE-RESULT-01' || value.schema_version !== 1) return null;
  const resultSetId = text(value.result_set_id);
  if (!/^plrs_[0-9a-f]{20}$/u.test(resultSetId) || !Array.isArray(value.results)) return null;
  const results = value.results.slice(0, 5).map(normalizePlace).filter(Boolean);
  if (!results.length) return null;
  return Object.freeze({
    contractId: value.contract_id,
    schemaVersion: value.schema_version,
    resultSetId,
    providerCode: text(value.provider_code) || 'NAVER',
    source: text(value.source) || 'NAVER_LOCAL_SEARCH',
    query: text(value.query),
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
    results: Object.freeze(results),
  });
}

export function isPlaceResultFresh(placeResult, now = Date.now()) {
  return !!placeResult
    && Number.isFinite(placeResult.capturedAt)
    && Number.isFinite(now)
    && now >= placeResult.capturedAt
    && now - placeResult.capturedAt <= NAVIGATION_TTL_MS;
}

function localityHint(address) {
  return text(address).split(/\s+/u).filter(Boolean).slice(0, 2).join(' ');
}

function searchQuery(place) {
  const name = text(place?.name);
  const locality = localityHint(place?.address);
  return [name, locality].filter(Boolean).join(' ').slice(0, 120);
}

function navigationParams(place, appname) {
  const params = new URLSearchParams();
  params.set('dlat', Number(place.latitude).toFixed(7));
  params.set('dlng', Number(place.longitude).toFixed(7));
  params.set('dname', place.name);
  params.set('appname', appname);
  return params.toString();
}

function searchParams(place, appname) {
  const params = new URLSearchParams();
  params.set('query', searchQuery(place));
  params.set('appname', appname);
  return params.toString();
}

export function buildNaverMapsMobileUri(place, {appname = NAVER_MAPS_WEB_APPNAME} = {}) {
  if (!place || typeof place !== 'object') throw new TypeError('place is required');
  if (place.navigationCapable === true) {
    return `nmap://navigation?${navigationParams(place, appname)}`;
  }
  const query = searchQuery(place);
  if (!query) throw new TypeError('place search query is required');
  return `nmap://search?${searchParams(place, appname)}`;
}

export function buildNaverMapsAndroidIntentUri(place, {appname = NAVER_MAPS_WEB_APPNAME} = {}) {
  if (!place || typeof place !== 'object') throw new TypeError('place is required');
  const action = place.navigationCapable === true ? 'navigation' : 'search';
  const params = action === 'navigation' ? navigationParams(place, appname) : searchParams(place, appname);
  const fallbackUrl = encodeURIComponent(buildNaverMapsWebSearchUrl(place));
  return `intent://${action}?${params}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${NAVER_MAPS_ANDROID_PACKAGE};S.browser_fallback_url=${fallbackUrl};end`;
}

export function buildNaverMapsWebSearchUrl(place) {
  const query = searchQuery(place);
  if (!query) throw new TypeError('place search query is required');
  return NAVER_MAPS_WEB_SEARCH_BASE + encodeURIComponent(query);
}

// 좌표는 navigation_capability 가 참일 때만 쓴다. NAVER 버튼이 지키는 규칙과
// 같다 — 출처가 확인되지 않은 좌표로 길안내를 걸어 엉뚱한 곳에 보내느니 이름으로
// 검색시키는 편이 맞다.
function destinationCoordinates(place) {
  if (place?.navigationCapable !== true) return null;
  const latitude = finiteCoordinate(place.latitude);
  const longitude = finiteCoordinate(place.longitude);
  if (latitude === null || longitude === null) return null;
  return Object.freeze({
    latitude: latitude.toFixed(7),
    longitude: longitude.toFixed(7),
  });
}

export function buildKakaoNaviSdkPayload(place) {
  const destination = destinationCoordinates(place);
  const name = text(place?.name);
  if (!destination || !name) throw new TypeError('verified destination is required');
  return Object.freeze({
    name,
    x: Number(destination.longitude),
    y: Number(destination.latitude),
    coordType: 'wgs84',
  });
}

export function buildKakaoNaviHandoffUrl(place, {origin = 'https://lotbiai.com'} = {}) {
  const payload = buildKakaoNaviSdkPayload(place);
  const url = new URL(KAKAO_NAVI_HANDOFF_PATH, origin);
  url.searchParams.set('name', payload.name);
  url.searchParams.set('x', String(payload.x));
  url.searchParams.set('y', String(payload.y));
  url.searchParams.set('coordType', 'wgs84');
  return url.href;
}

export function buildTmapMobileUri(place) {
  if (!place || typeof place !== 'object') throw new TypeError('place is required');
  const destination = destinationCoordinates(place);
  // 티맵은 x 가 경도, y 가 위도다. 순서를 뒤집으면 바다 한가운데로 간다.
  if (destination) {
    const name = encodeURIComponent(text(place.name));
    return `${TMAP_SCHEME}://route?goalname=${name}&goalx=${destination.longitude}&goaly=${destination.latitude}`;
  }
  const query = searchQuery(place);
  if (!query) throw new TypeError('place search query is required');
  return `${TMAP_SCHEME}://search?name=${encodeURIComponent(query)}`;
}

export function buildTmapAndroidIntentUri(place) {
  const scheme = `${TMAP_SCHEME}://`;
  const path = buildTmapMobileUri(place).slice(scheme.length);
  // 티맵에는 장소를 여는 웹 화면이 없다. 앱이 없으면 설치 안내로 보내는 것이
  // 이 앱에서 할 수 있는 전부이고, 네이버·카카오처럼 웹 지도로 떨어뜨릴 수 없다.
  const fallbackUrl = encodeURIComponent(TMAP_ANDROID_STORE_URL);
  return `intent://${path}#Intent;scheme=${TMAP_SCHEME};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${TMAP_ANDROID_PACKAGE};S.browser_fallback_url=${fallbackUrl};end`;
}

function mobilePlatform(userAgent) {
  const ua = String(userAgent || '');
  return Object.freeze({
    android: /Android/iu.test(ua),
    ios: /iPhone|iPad|iPod/iu.test(ua),
  });
}

// 티맵은 모바일 앱 전용이다. 데스크톱에는 열어 줄 대상이 아예 없으므로 버튼을
// 눌리게 두지 않는다 — 눌러도 아무 일이 없는 버튼이 제일 나쁘다.
export function isTmapHandoffAvailable({userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const {android, ios} = mobilePlatform(userAgent);
  return android || ios;
}

function openNewBrowsingContext(windowRef, uri) {
  if (!windowRef || typeof windowRef.open !== 'function') {
    return Object.freeze({opened: false, child: null});
  }
  try {
    const child = windowRef.open(uri, '_blank', 'noopener,noreferrer');
    if (!child) return Object.freeze({opened: false, child: null});
    child.opener = null;
    return Object.freeze({opened: true, child});
  } catch {
    return Object.freeze({opened: false, child: null});
  }
}

export function openKakaoNaviPlace(place, {
  windowRef = globalThis.window,
  origin = globalThis.location?.origin || 'https://lotbiai.com',
} = {}) {
  if (!place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  let uri = '';
  try {
    uri = buildKakaoNaviHandoffUrl(place, {origin});
  } catch {
    return Object.freeze({opened: false, mode: 'BLOCKED'});
  }
  const result = openNewBrowsingContext(windowRef, uri);
  return Object.freeze({opened: result.opened, mode: result.opened ? 'KAKAO_NAVI_OFFICIAL_SDK_NEW_TAB' : 'BLOCKED', uri});
}

export function openTmapPlace(place, {
  windowRef = globalThis.window,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  if (!windowRef || !place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  const {android, ios} = mobilePlatform(userAgent);
  if (!android && !ios) return Object.freeze({opened: false, mode: 'TMAP_MOBILE_ONLY'});
  const uri = android ? buildTmapAndroidIntentUri(place) : buildTmapMobileUri(place);
  const result = openNewBrowsingContext(windowRef, uri);
  return Object.freeze({
    opened: result.opened,
    mode: result.opened
      ? (place.navigationCapable
        ? (android ? 'TMAP_ROUTE_INTENT_NEW_TAB' : 'TMAP_ROUTE_URL_SCHEME_NEW_TAB')
        : (android ? 'TMAP_SEARCH_INTENT_NEW_TAB' : 'TMAP_SEARCH_URL_SCHEME_NEW_TAB'))
      : 'BLOCKED',
    uri,
    fallbackUri: android ? TMAP_ANDROID_STORE_URL : TMAP_IOS_STORE_URL,
  });
}

export function buildGoogleMapsDirectionsUrl(place) {
  if (!place || typeof place !== 'object') throw new TypeError('place is required');
  const destination = destinationCoordinates(place);
  const query = destination ? `${destination.latitude},${destination.longitude}` : searchQuery(place);
  if (!query) throw new TypeError('place destination is required');
  const params = new URLSearchParams({api: '1', destination: query});
  if (destination) params.set('travelmode', 'driving');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleMapsPlace(place, {windowRef = globalThis.window} = {}) {
  let uri = '';
  try {
    uri = buildGoogleMapsDirectionsUrl(place);
  } catch {
    return Object.freeze({opened: false, mode: 'BLOCKED'});
  }
  const result = openNewBrowsingContext(windowRef, uri);
  return Object.freeze({opened: result.opened, mode: result.opened ? 'GOOGLE_MAPS_NEW_TAB' : 'BLOCKED', uri});
}

export function naverMapsPlaceActionLabel(place, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const {android, ios} = mobilePlatform(userAgent);
  if (!android && !ios) return '네이버지도에서 보기';
  return place?.navigationCapable === true ? '길안내' : '네이버지도에서 찾기';
}

export function openNaverMapsPlace(place, {
  windowRef = globalThis.window,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  if (!windowRef || !place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  const {android, ios} = mobilePlatform(userAgent);
  const webUrl = buildNaverMapsWebSearchUrl(place);
  const uri = android
    ? buildNaverMapsAndroidIntentUri(place)
    : ios
      ? buildNaverMapsMobileUri(place)
      : webUrl;
  const result = openNewBrowsingContext(windowRef, uri);
  return Object.freeze({
    opened: result.opened,
    mode: result.opened
      ? android
        ? (place.navigationCapable ? 'NAVER_NAVIGATION_INTENT_NEW_TAB' : 'NAVER_SEARCH_INTENT_NEW_TAB')
        : ios
          ? (place.navigationCapable ? 'NAVER_NAVIGATION_URL_SCHEME_NEW_TAB' : 'NAVER_SEARCH_URL_SCHEME_NEW_TAB')
          : 'NAVER_WEB_SEARCH_NEW_TAB'
      : 'BLOCKED',
    uri,
    fallbackUri: webUrl,
  });
}
