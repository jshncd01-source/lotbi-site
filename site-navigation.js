const NAVER_MAPS_WEB_APPNAME = 'https://lotbiai.com';
const NAVER_MAPS_ANDROID_PACKAGE = 'com.nhn.android.nmap';
const NAVER_MAPS_WEB_SEARCH_BASE = 'https://map.naver.com/p/search/';
const NAVIGATION_TTL_MS = 60 * 60 * 1000;
// NAVER geocoding for Place results; 국립중앙의료원 registry WGS84 for the
// LIFE-PUBLIC-DATA-01 medical results. Both are provider-confirmed points.
const NAVIGATION_COORDINATE_AUTHORITIES = new Set(['NAVER_MAPS_GEOCODING', 'NMC_OFFICIAL']);

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

// LIFE-PUBLIC-DATA-01 / NIGHT MEDICAL. 국립중앙의료원 등록 진료시간·응급실 실시간 보고.
// Only what Core sent is kept; ER bed numbers survive only for a FRESH report.
const OPEN_STATES = new Set(['OPEN', 'CLOSED', 'NOT_LISTED', 'LISTED']);
const REALTIME_STATES = new Set(['FRESH', 'STALE', 'UNAVAILABLE', 'NOT_CHECKED']);
const KINDS = new Set(['HOSPITAL', 'PHARMACY', 'EMERGENCY']);
const SAFE_TEXT_RE = /[\u0000-\u001f<>]/gu;

function boundedText(value, max = 80) {
  return typeof value === 'string' ? value.replace(SAFE_TEXT_RE, ' ').replace(/\s+/gu, ' ').trim().slice(0, max) : '';
}

export function normalizeMedicalStatus(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = boundedText(value.kind).toUpperCase();
  const openState = boundedText(value.open_state).toUpperCase();
  if (!KINDS.has(kind) || !OPEN_STATES.has(openState) || value.basis !== 'NMC_REGISTERED_HOURS') return null;
  return Object.freeze({
    kind,
    openState,
    hoursLabel: boundedText(value.hours_label, 60),
    targetLabel: boundedText(value.target_label, 40),
  });
}

export function normalizeEmergencyStatus(value) {
  if (!value || typeof value !== 'object') return null;
  const realtimeState = boundedText(value.realtime_state).toUpperCase();
  if (!REALTIME_STATES.has(realtimeState) || value.acceptance_guaranteed !== false) return null;
  const fresh = realtimeState === 'FRESH';
  const beds = fresh && Array.isArray(value.beds)
    ? value.beds
      .filter(item => item && typeof item === 'object' && Number.isInteger(item.available) && boundedText(item.label))
      .slice(0, 9)
      .map(item => Object.freeze({label: boundedText(item.label, 20), available: item.available}))
    : [];
  return Object.freeze({
    realtimeState,
    updatedAtLabel: boundedText(value.updated_at_label, 20),
    beds: Object.freeze(beds),
    erOperating: value.er_operating === true ? true : (value.er_operating === false ? false : null),
    severeAcceptanceReported: Object.freeze(
      (Array.isArray(value.severe_acceptance_reported) ? value.severe_acceptance_reported : []).map(item => boundedText(item, 20)).filter(Boolean).slice(0, 12),
    ),
    messages: Object.freeze((Array.isArray(value.messages) ? value.messages : []).map(item => boundedText(item, 120)).filter(Boolean).slice(0, 2)),
  });
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

// LIFE-PUBLIC-DATA-01 / ANIMAL HOSPITAL. 행정안전부 동물병원 등록 대조 결과.
// "공식 등록"은 Core 가 공공 대조에 성공했다고 밝힌 경우(VERIFIED + true)에만
// 말한다. NAVER 에 나온다는 사실만으로는 등록 병원이라고 하지 않는다.
const ANIMAL_HOSPITAL_STATES = new Set(['VERIFIED', 'INACTIVE', 'AMBIGUOUS', 'NOT_FOUND', 'CONFLICTING', 'UNAVAILABLE']);

function normalizeAnimalHospitalVerification(value) {
  if (!value || typeof value !== 'object') return null;
  const state = text(value.state).toUpperCase();
  if (!ANIMAL_HOSPITAL_STATES.has(state)) return null;
  if (text(value.source) !== 'MOIS_ANIMAL_HOSPITAL' || value.ai_calls !== 0) return null;
  return Object.freeze({
    state,
    source: 'MOIS_ANIMAL_HOSPITAL',
    officialRegistered: state === 'VERIFIED' && value.official_registered === true,
    administrativeStatus: ['VERIFIED', 'INACTIVE'].includes(state) ? text(value.administrative_status) : '',
  });
}

function normalizeDistanceMeters(value) {
  return Number.isInteger(value) && value >= 0 && value <= 300_000 ? value : null;
}

export function formatDistanceMeters(meters) {
  if (!Number.isInteger(meters)) return '';
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

// One short status line under the address. Empty when the result itself states
// nothing — no line is ever invented for an ordinary place.
export function placeLifeBadges(place) {
  const badges = [];
  const verification = place?.animalHospitalVerification;
  if (verification) {
    if (verification.officialRegistered) badges.push({kind: 'registration', state: 'OFFICIAL_REGISTERED', label: '공식 등록 동물병원'});
    else if (verification.state === 'INACTIVE') badges.push({kind: 'registration', state: 'INACTIVE', label: '등록 상태 확인 필요'});
    else badges.push({kind: 'registration', state: 'UNVERIFIED', label: '공식 등록 확인 안 됨'});
  }
  const distance = formatDistanceMeters(place?.distanceMeters);
  if (distance) badges.push({kind: 'distance', state: 'DISTANCE', label: distance});
  return badges;
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
    && NAVIGATION_COORDINATE_AUTHORITIES.has(text(place?.coordinate_authority))
    && place?.navigation_capability === true;
}

function normalizePlace(place, index) {
  if (!place || typeof place !== 'object') return null;
  const name = text(place.name);
  const address = text(place.road_address) || text(place.address);
  if (!name || !address) return null;
  const medicalStatus = normalizeMedicalStatus(place.medical_status);
  const emergencyStatus = normalizeEmergencyStatus(place.emergency_status);
  const latitude = finiteCoordinate(place.latitude);
  const longitude = finiteCoordinate(place.longitude);
  const sourceUrl = text(place.source_url);
  const verifiedPhone = normalizeVerifiedPhone(place);
  const verifiedPhoto = normalizeVerifiedPhoto(place);
  const foodLicenseVerification = normalizeFoodLicenseVerification(place.food_license_verification);
  const animalHospitalVerification = normalizeAnimalHospitalVerification(place.animal_hospital_verification);
  const distanceMeters = normalizeDistanceMeters(place.distance_meters);
  return Object.freeze({
    candidateIndex: index,
    resultId: text(place.result_id) || `place-${index + 1}`,
    medicalStatus,
    emergencyStatus,
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
    animalHospitalVerification,
    distanceMeters,
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

// Full name + full address, never truncated to a leading fragment (e.g. a
// "서울특별시 종로구"-only slice) — a partial address routinely matches the
// wrong place in NAVER/TMAP search. The 120-char cap is a defensive upper
// bound for the URL, not an address truncation; real Korean addresses stay
// far under it even combined with a venue/festival name.
function searchQuery(place) {
  const name = text(place?.name);
  const address = text(place?.address);
  return [name, address].filter(Boolean).join(' ').slice(0, 120);
}

// PLACE-CARD-NAVER-SEARCH-CLICK-01 — 카드 본문은 지도가 아니라 네이버 "검색"
// 결과(메뉴·사진·리뷰·영업정보·블로그)로 연다. 검색어는 장소 이름 그대로에
// 지역 하나만 앞에 붙인다. 지역은 사용자가 검색에 쓴 말(Core query) 중 이
// 장소 주소의 행정구역과 맞는 것을 먼저 쓰고, 없으면 주소의 시·군(구)을 쓴다.
// 이름에 이미 그 지역이 들어 있으면 붙이지 않는다. 주소 전체나 query 의 다른
// 단어("메뉴" 등)는 절대 넣지 않는다.
const NAVER_SEARCH_URL = 'https://search.naver.com/search.naver';
const ADMIN_AREA_SUFFIX_RE = /(특별자치도|특별자치시|특별시|광역시|도|시|군|구|읍|면|동)$/u;
const MUNICIPAL_RE = /^[가-힣]{2,}(특별자치시|특별시|광역시|시|군)$/u;
const DISTRICT_RE = /^[가-힣]{1,}구$/u;

function compactText(value) {
  return text(value).replace(/\s+/gu, '');
}

function shortAreaName(token) {
  const short = token.replace(ADMIN_AREA_SUFFIX_RE, '');
  return short.length >= 2 ? short : token;
}

function addressAreaTokens(address) {
  return text(address).split(/\s+/u).slice(0, 4).filter(token => /^[가-힣]+$/u.test(token) && ADMIN_AREA_SUFFIX_RE.test(token));
}

function regionFromSearchContext(searchContext, address) {
  const forms = new Set();
  for (const token of addressAreaTokens(address)) {
    forms.add(token);
    forms.add(shortAreaName(token));
  }
  for (const token of text(searchContext).split(/\s+/u)) {
    if (forms.has(token)) return token;
  }
  return '';
}

function regionFromAddress(address) {
  const tokens = addressAreaTokens(address).slice(0, 3);
  const municipal = tokens.find(token => MUNICIPAL_RE.test(token));
  if (municipal) return shortAreaName(municipal);
  return tokens.find(token => DISTRICT_RE.test(token)) || '';
}

export function buildNaverPlaceSearchQuery(place, {searchContext = ''} = {}) {
  // Control characters out, whitespace collapsed. Nothing else is stripped: the
  // query only ever travels URL-encoded in a search parameter.
  const name = text(place?.name).replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 80);
  if (!name) return '';
  const address = text(place?.address) || text(place?.road_address);
  const region = regionFromSearchContext(searchContext, address) || regionFromAddress(address);
  const compactName = compactText(name);
  if (!region || compactName.includes(compactText(region)) || compactName.includes(shortAreaName(region))) return name;
  return `${region} ${name}`;
}

export function buildNaverPlaceSearchUrl(place, options = {}) {
  const query = buildNaverPlaceSearchQuery(place, options);
  if (!query) throw new TypeError('place search query is required');
  const url = new URL(NAVER_SEARCH_URL);
  url.searchParams.set('query', query);
  return url.href;
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
  const destination = destinationCoordinates(place);
  const exactNaverPlace = destination && text(place?.placeId).startsWith('naver:');
  const query = exactNaverPlace ? text(place?.name) : searchQuery(place);
  if (!query) throw new TypeError('place search query is required');
  const searchUrl = NAVER_MAPS_WEB_SEARCH_BASE + encodeURIComponent(query);
  return exactNaverPlace
    ? `${searchUrl}?c=${destination.longitude},${destination.latitude},15,0,0,0,dh`
    : searchUrl;
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

export function buildKakaoMapsDirectionsUrl(place) {
  const payload = buildKakaoNaviSdkPayload(place);
  return `https://map.kakao.com/link/to/${encodeURIComponent(payload.name)},${payload.y},${payload.x}`;
}

export function buildKakaoMapsSearchUrl(place) {
  const query = searchQuery(place);
  if (!query) throw new TypeError('place search query is required');
  const url = new URL('https://map.kakao.com/');
  url.searchParams.set('q', query);
  return url.href;
}

export function buildIosMapHandoffUrl(provider, place, {origin = 'https://lotbiai.com'} = {}) {
  if (provider !== 'NAVER_MAP' && provider !== 'TMAP') throw new TypeError('unsupported iOS handoff provider');
  const nativeUri = provider === 'NAVER_MAP' ? buildNaverMapsMobileUri(place) : buildTmapMobileUri(place);
  const fallbackUri = buildNaverMapsWebSearchUrl(place);
  const url = new URL('/map-handoff.html', origin);
  url.searchParams.set('provider', provider);
  url.searchParams.set('native', nativeUri);
  url.searchParams.set('fallback', fallbackUri);
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

function openNewBrowsingContext(windowRef, uri, {preloadUri = ''} = {}) {
  if (!windowRef || typeof windowRef.open !== 'function') {
    return Object.freeze({opened: false, child: null});
  }
  try {
    const child = windowRef.open(preloadUri || uri, '_blank', 'noopener,noreferrer');
    if (!child) return Object.freeze({opened: false, child: null});
    child.opener = null;
    if (preloadUri && child.location) child.location.href = uri;
    return Object.freeze({opened: true, child});
  } catch {
    return Object.freeze({opened: false, child: null});
  }
}

export function openKakaoNaviPlace(place, {
  windowRef = globalThis.window,
  origin = globalThis.location?.origin || 'https://lotbiai.com',
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  if (!place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  let uri = '';
  let fallbackUri = '';
  try {
    const {android, ios} = mobilePlatform(userAgent);
    const mobile = android || ios;
    fallbackUri = place.navigationCapable === true
      ? buildKakaoMapsDirectionsUrl(place)
      : buildKakaoMapsSearchUrl(place);
    uri = mobile && place.navigationCapable === true
      ? buildKakaoNaviHandoffUrl(place, {origin})
      : fallbackUri;
  } catch {
    return Object.freeze({opened: false, mode: 'BLOCKED'});
  }
  const result = openNewBrowsingContext(windowRef, uri);
  const web = uri === fallbackUri;
  return Object.freeze({
    opened: result.opened,
    mode: result.opened ? (web ? 'KAKAO_MAPS_WEB_NEW_TAB' : 'KAKAO_NAVI_OFFICIAL_SDK_NEW_TAB') : 'BLOCKED',
    uri,
    fallbackUri,
  });
}

export function openTmapPlace(place, {
  windowRef = globalThis.window,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  if (!windowRef || !place || typeof place !== 'object') return Object.freeze({opened: false, mode: 'BLOCKED'});
  const {android, ios} = mobilePlatform(userAgent);
  const webFallback = buildNaverMapsWebSearchUrl(place);
  const uri = !android && !ios
    ? buildNaverMapsWebSearchUrl(place)
    : android
      ? buildTmapAndroidIntentUri(place)
      : buildTmapMobileUri(place);
  const result = openNewBrowsingContext(windowRef, uri, {preloadUri: ios ? webFallback : ''});
  return Object.freeze({
    opened: result.opened,
    mode: result.opened
      ? (!android && !ios
        ? 'TMAP_DESKTOP_NAVER_WEB_FALLBACK'
        : place.navigationCapable
        ? (android ? 'TMAP_ROUTE_INTENT_NEW_TAB' : 'TMAP_ROUTE_URL_SCHEME_NEW_TAB')
        : (android ? 'TMAP_SEARCH_INTENT_NEW_TAB' : 'TMAP_SEARCH_URL_SCHEME_NEW_TAB'))
      : 'BLOCKED',
    uri,
    fallbackUri: android ? TMAP_ANDROID_STORE_URL : webFallback,
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
  return Object.freeze({opened: result.opened, mode: result.opened ? 'GOOGLE_MAPS_NEW_TAB' : 'BLOCKED', uri, fallbackUri: uri});
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
  const result = openNewBrowsingContext(windowRef, uri, {preloadUri: ios ? webUrl : ''});
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

const DEFAULT_MAP_PRESENTATION = Object.freeze({
  NAVER_MAP: Object.freeze({action: 'naver-map', icon: 'naver-map', label: '네이버지도', success: '선택한 장소를 네이버지도에서 엽니다.'}),
  KAKAO_NAVI: Object.freeze({action: 'kakao-navi', icon: 'kakao-map', label: '카카오내비', success: '선택한 장소를 카카오내비 길안내로 연결합니다.'}),
  TMAP: Object.freeze({action: 'tmap', icon: 'tmap', label: '티맵', success: '선택한 장소를 티맵 길안내로 연결합니다.'}),
  GOOGLE_MAPS: Object.freeze({action: 'google-maps', icon: 'google-maps', label: 'Google Maps', success: '선택한 장소를 Google Maps에서 엽니다.'}),
});

export function defaultMapProviderPresentation(provider, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const {android, ios} = mobilePlatform(userAgent);
  if (provider === 'TMAP' && !android && !ios) return Object.freeze({
    ...DEFAULT_MAP_PRESENTATION.TMAP,
    label: '티맵 대신 네이버지도 웹',
    success: '티맵은 모바일 전용이라 네이버지도 웹에서 엽니다.',
  });
  return DEFAULT_MAP_PRESENTATION[provider] || DEFAULT_MAP_PRESENTATION.NAVER_MAP;
}

export function buildDefaultMapHref(provider, place, {userAgent = globalThis.navigator?.userAgent || '', origin = globalThis.location?.origin || 'https://lotbiai.com'} = {}) {
  if (provider === 'KAKAO_NAVI') {
    const {android, ios} = mobilePlatform(userAgent);
    if ((android || ios) && place?.navigationCapable === true) return buildKakaoNaviHandoffUrl(place, {origin});
    return place?.navigationCapable === true ? buildKakaoMapsDirectionsUrl(place) : buildKakaoMapsSearchUrl(place);
  }
  if (provider === 'TMAP') {
    const {android, ios} = mobilePlatform(userAgent);
    if (android) return buildTmapAndroidIntentUri(place);
    if (ios) return buildIosMapHandoffUrl('TMAP', place, {origin});
    return buildNaverMapsWebSearchUrl(place);
  }
  if (provider === 'GOOGLE_MAPS') return buildGoogleMapsDirectionsUrl(place);
  const {android, ios} = mobilePlatform(userAgent);
  if (android) return buildNaverMapsAndroidIntentUri(place);
  if (ios) return buildIosMapHandoffUrl('NAVER_MAP', place, {origin});
  return buildNaverMapsWebSearchUrl(place);
}

export function openDefaultMapPlace(provider, place, options = {}) {
  if (provider === 'KAKAO_NAVI') return openKakaoNaviPlace(place, options);
  if (provider === 'TMAP') return openTmapPlace(place, options);
  if (provider === 'GOOGLE_MAPS') return openGoogleMapsPlace(place, options);
  return openNaverMapsPlace(place, options);
}
