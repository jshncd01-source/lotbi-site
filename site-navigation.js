const NAVER_MAPS_WEB_APPNAME = 'https://lotbiai.com';
const NAVER_MAPS_ANDROID_PACKAGE = 'com.nhn.android.nmap';
const NAVER_MAPS_WEB_SEARCH_BASE = 'https://map.naver.com/p/search/';
const NAVER_STATIC_MAP_THUMBNAIL_BASE = 'https://api.lotbiai.com/v2/maps/static-place-thumbnail';
const NAVIGATION_TTL_MS = 60 * 60 * 1000;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeHttpsImageUrl(value) {
  const candidate = text(value);
  if (!candidate || candidate.length > 2048) return '';
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
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
    imageUrl: safeHttpsImageUrl(place.image_url),
    phone: verifiedPhone.number,
    phoneHref: verifiedPhone.href,
    phoneVerified: Boolean(verifiedPhone.href),
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

export function buildNaverStaticMapThumbnailUrl(place) {
  if (!place || typeof place !== 'object' || place.navigationCapable !== true) return '';
  const latitude = finiteCoordinate(place.latitude);
  const longitude = finiteCoordinate(place.longitude);
  if (
    latitude === null
    || longitude === null
    || latitude < 31.43
    || latitude > 44.35
    || longitude < 122.37
    || longitude > 132
    || text(place.coordinateSystem).toUpperCase() !== 'WGS84'
    || text(place.coordinateAuthority) !== 'NAVER_MAPS_GEOCODING'
  ) return '';
  const url = new URL(NAVER_STATIC_MAP_THUMBNAIL_BASE);
  url.searchParams.set('latitude', latitude.toFixed(7));
  url.searchParams.set('longitude', longitude.toFixed(7));
  return url.toString();
}

function mobilePlatform(userAgent) {
  const ua = String(userAgent || '');
  return Object.freeze({
    android: /Android/iu.test(ua),
    ios: /iPhone|iPad|iPod/iu.test(ua),
  });
}

export function naverMapsPlaceActionLabel(place, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const {android, ios} = mobilePlatform(userAgent);
  if (!android && !ios) return '네이버지도에서 보기';
  return place?.navigationCapable === true ? '길안내' : '네이버지도에서 찾기';
}

export function openNaverMapsPlace(place, {
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  if (!windowRef || !place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  const {android, ios} = mobilePlatform(userAgent);
  const webUrl = buildNaverMapsWebSearchUrl(place);

  if (android) {
    const uri = buildNaverMapsAndroidIntentUri(place);
    windowRef.location.href = uri;
    return Object.freeze({opened: true, mode: place.navigationCapable ? 'NAVER_NAVIGATION_INTENT' : 'NAVER_SEARCH_INTENT', uri, fallbackUri: webUrl});
  }

  if (ios) {
    const uri = buildNaverMapsMobileUri(place);
    let fallbackTimer = null;
    let fallbackCancelled = false;
    const cancelFallback = () => {
      fallbackCancelled = true;
      if (fallbackTimer !== null) windowRef.clearTimeout?.(fallbackTimer);
    };
    documentRef?.addEventListener?.('visibilitychange', () => {
      if (documentRef.visibilityState === 'hidden') cancelFallback();
    }, {once: true});
    windowRef.addEventListener?.('pagehide', cancelFallback, {once: true});
    fallbackTimer = windowRef.setTimeout?.(() => {
      if (!fallbackCancelled) windowRef.location.href = webUrl;
    }, 1400) ?? null;
    windowRef.location.href = uri;
    return Object.freeze({opened: true, mode: place.navigationCapable ? 'NAVER_NAVIGATION_URL_SCHEME' : 'NAVER_SEARCH_URL_SCHEME', uri, fallbackUri: webUrl});
  }

  let child = null;
  try {
    child = typeof windowRef.open === 'function'
      ? windowRef.open(webUrl, '_blank', 'noopener,noreferrer')
      : null;
  } catch {
    child = null;
  }
  if (child) {
    child.opener = null;
    return Object.freeze({opened: true, mode: 'NAVER_WEB_SEARCH_NEW_TAB', uri: webUrl});
  }
  windowRef.location.href = webUrl;
  return Object.freeze({opened: true, mode: 'NAVER_WEB_SEARCH_SAME_TAB', uri: webUrl});
}
