// ONNURI-MERCHANT-01 — 생활정보 '온누리상품권' 가맹점 찾기.
// ONNURI-MERCHANT-LOCATION-UX-P0 — two ways to search, compact cards, the
// user's own map app and verified phone numbers only.
// ONNURI-REMOVE-RELATION-MAP-01: the tile-less 위치 관계도 sketch is gone (owner
// decision 2026-10-10: it looked like an error). Distance and the map-app links stay.
//
// Reads only Core's public, guest-safe GET /v2/life/onnuri/merchants|regions
// (the PUBLISHED copy of 소상공인시장진흥공단 「전국 온누리상품권 가맹점 현황」,
// placed through 전국전통시장표준데이터 when the shop's own address is only its
// 시·도). No credentials, nothing stored.
//
// 내 주변: the location is asked for only on a user action, goes through the
// shared location layer, is rounded to ~100 m and sent for that one search,
// within the radius the user picked (1/3/5/10/25 km). 지역 선택: 시·도 →
// 시·군·구 → 읍·면·동 (and 시장·상점가), only names the data supports; a level
// the data cannot fill says why instead of showing an empty picker.
//
// Brand: the official 온누리상품권 logo is NOT used until its use is approved.
// The slot below is reserved for it and renders nothing; labels are plain text.
// LOTBI is not presented as an official/partner service of the issuer.
import {CORE_ORIGIN} from './site-core.js?v=aset-976ee65147ba';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-976ee65147ba';
import {isLocationUsageEnabled, readDefaultMapProvider, DEFAULT_MAP_PROVIDER_COOKIE, DEFAULT_MAP_PROVIDERS} from './site-location-preference.js?v=aset-976ee65147ba';
import {buildDefaultMapHref, defaultMapProviderPresentation, formatDistanceMeters} from './site-navigation.js?v=aset-976ee65147ba';

export const ONNURI_MENU_LABEL = '온누리상품권';
export const ONNURI_CARD_LABEL = '온누리 가맹점';
// 12 per page: two or three rows of compact cards; measured in
// scripts/validate_onnuri_location_ux_p0.mjs (render + Core time per page).
export const ONNURI_PAGE_SIZE = 12;
export const ONNURI_RADII = Object.freeze([1000, 3000, 5000, 10000, 25000]);
export const ONNURI_DEFAULT_RADIUS = 5000;
export const ONNURI_CATEGORIES = Object.freeze([
  ['', '전체'], ['FOOD', '식당'], ['CAFE', '카페·간식'], ['GROCERY', '장보기'], ['CLOTHING', '의류·잡화'], ['LIVING', '생활'],
]);
export const ONNURI_ACCEPTS = Object.freeze([['', '전체'], ['PAPER', '지류형'], ['DIGITAL', '디지털형(모바일·카드)']]);
export const ONNURI_DISCLAIMER = '공공데이터에 등록된 가맹점 정보를 보여 드려요. 실시간 결제 가능 여부는 아니니 방문 전 가맹점에 확인해 주세요. '
  + 'LOTBI는 공공데이터를 안내할 뿐, 온누리상품권 발행기관의 공식·제휴 서비스가 아니에요.';
// ONNURI-REGION-FIRST-UX-01 (QA #16): one short line on top; the full notice folds.
export const ONNURI_DISCLAIMER_SUMMARY = '공공데이터 기준 안내예요. 방문 전 가맹점에 확인해 주세요.';
export const ONNURI_REGION_PROMPT = '시·도를 고르거나 [내 주변]으로 찾아 주세요. 지역을 고르기 전에는 가맹점을 보여 드리지 않아요.';
export const ONNURI_DIGITAL_NOTE = '2025년 3월부터 모바일·카드형이 디지털 온누리로 통합돼, 공식 자료는 모바일과 카드를 따로 구분하지 않아요.';
export const ONNURI_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
export const ONNURI_MAP_SETTINGS_URL = 'https://account.lotbiai.com/account#personalization';
// Reserved for the approved official logo file. Empty until approval: no
// image, no emoji, no look-alike icon is drawn in its place.
export const ONNURI_LOGO_ASSET = '';

const TIMEOUT_MS = 12_000;
const text = value => (typeof value === 'string' ? value.trim() : '');
const bool = value => (value === true ? true : value === false ? false : null);
const count = value => (Number.isInteger(value) && value >= 0 ? value : null);
const won = value => value.toLocaleString('ko-KR');

function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 131;
}

export function radiusLabel(meters) {
  return meters >= 1000 ? `${meters / 1000}km` : `${meters}m`;
}

// ── 지도앱 설정 ───────────────────────────────────────────────────────────
// The Account setting is the cookie lotbi_default_map_provider_v1 (Domain=lotbiai.com).
// readDefaultMapProvider() keeps its contract (no / several / unknown value →
// NAVER_MAP); this says *why*, so the screen never switches the app silently.
export function readMapPreference(cookieHeader = '') {
  const provider = readDefaultMapProvider(cookieHeader);
  const values = String(cookieHeader || '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${DEFAULT_MAP_PROVIDER_COOKIE}=`))
    .map(part => part.slice(DEFAULT_MAP_PROVIDER_COOKIE.length + 1));
  let state = 'SAVED';
  if (!values.length) state = 'DEFAULT';
  else if (new Set(values).size > 1) state = 'CONFLICT';
  else if (!DEFAULT_MAP_PROVIDERS.includes(values[0])) state = 'UNKNOWN';
  return Object.freeze({provider, state});
}

export function mapPreferenceNote(preference, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const label = defaultMapProviderPresentation(preference.provider, {userAgent}).label;
  if (preference.state === 'CONFLICT') return `지도앱 설정이 둘 이상 저장돼 있어 ${label}로 열어요. 설정에서 다시 골라 주세요.`;
  if (preference.state === 'UNKNOWN') return `저장된 지도앱 설정을 읽지 못해 ${label}로 열어요. 설정에서 다시 골라 주세요.`;
  if (preference.state === 'DEFAULT') return `지도앱: ${label}(기본값). 설정에서 바꿀 수 있어요.`;
  return `지도앱: ${label}(내 설정).`;
}

// ── Core responses ───────────────────────────────────────────────────────

export function normalizeOnnuriMerchant(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const name = text(value.name);
  const address = text(value.address);
  if (!/^[0-9a-f]{40}$/u.test(id) || !name || !address) return null;
  // Number(null) is 0: only real numbers count, so a missing value never
  // becomes a coordinate or a "0m" distance.
  const latitude = typeof value.latitude === 'number' ? value.latitude : Number.NaN;
  const longitude = typeof value.longitude === 'number' ? value.longitude : Number.NaN;
  // The 2026 official file has no street address, so Core places most shops at
  // their market (geo_state MARKET). That point is the market's, never
  // presented as the shop's own building.
  const basis = value.geo_state === 'VERIFIED' ? 'BUILDING' : value.geo_state === 'MARKET' ? 'MARKET' : '';
  const verified = basis !== '' && inKorea(latitude, longitude);
  const distance = typeof value.distance_meters === 'number' ? value.distance_meters : Number.NaN;
  const phone = /^(?:0\d{1,2}|1[5-9]\d{2})-\d{3,4}(?:-\d{4})?$/u.test(text(value.phone)) && value.phone_source === 'STAFF_VERIFIED'
    ? text(value.phone) : '';
  return Object.freeze({
    id,
    name,
    address,
    marketName: text(value.market_name),
    marketAddress: text(value.market_address),
    items: text(value.items),
    sido: text(value.sido),
    sigungu: text(value.sigungu),
    dong: text(value.dong),
    paper: bool(value.paper),
    digital: bool(value.digital),
    latitude: verified ? latitude : null,
    longitude: verified ? longitude : null,
    locationBasis: verified ? basis : '',
    locationSource: verified ? text(value.location_source) : '',
    // A distance only for a verified coordinate; never computed here.
    distanceMeters: verified && Number.isInteger(distance) && distance >= 0 && distance <= 300000 ? distance : null,
    phone,
    phoneVerifiedOn: phone && /^\d{4}-\d{2}-\d{2}$/u.test(text(value.phone_verified_on)) ? text(value.phone_verified_on) : '',
  });
}

function normalizeCoverage(value) {
  if (!value || typeof value !== 'object') return null;
  const total = count(value.total_merchants);
  const located = count(value.located_merchants);
  if (total === null || located === null) return null;
  return Object.freeze({
    total,
    located,
    building: count(value.located_building) ?? 0,
    market: count(value.located_market) ?? 0,
    unlocated: count(value.unlocated_merchants) ?? Math.max(0, total - located),
    regionKnown: count(value.region_known_merchants),
    withRegion: count(value.with_region),
    withoutRegion: count(value.without_region),
    referenceDate: /^\d{4}-\d{2}-\d{2}$/u.test(text(value.market_reference?.source_date)) ? text(value.market_reference.source_date) : '',
  });
}

export function normalizeOnnuriSearch(value) {
  if (!value || value.contract_id !== 'CORE-ONNURI-MERCHANT-SEARCH-01' || value.schema_version !== 1) return null;
  const seen = new Set();
  const items = [];
  for (const raw of Array.isArray(value.items) ? value.items : []) {
    const item = normalizeOnnuriMerchant(raw);
    if (!item || seen.has(item.id)) continue;           // same merchant once
    seen.add(item.id); items.push(item);
  }
  const source = value.data_source && typeof value.data_source === 'object' ? value.data_source : {};
  const radius = ONNURI_RADII.includes(value.radius_meters) ? value.radius_meters : null;
  const nearest = count(value.nearest_distance_meters);
  return Object.freeze({
    availability: value.availability === 'AVAILABLE' ? 'AVAILABLE' : 'NOT_READY',
    mode: text(value.mode),
    items,
    totalCount: Number.isInteger(value.total_count) ? value.total_count : items.length,
    hasMore: value.has_more === true,
    nextOffset: Number.isInteger(value.next_offset) ? value.next_offset : null,
    // Core pages up to offset 600; past that it asks to narrow down instead.
    pageLimitReached: value.page_limit_reached === true,
    radiusMeters: radius,
    radiusFixed: value.radius_mode === 'FIXED',
    coverage: normalizeCoverage(value.coverage),
    emptyReason: ['LOCATION_DATA_UNAVAILABLE', 'NONE_WITHIN_RADIUS', 'NO_MATCH'].includes(value.empty_reason) ? value.empty_reason : '',
    nearestDistanceMeters: nearest,
    suggestedRadiusMeters: ONNURI_RADII.includes(value.suggested_radius_meters) ? value.suggested_radius_meters : null,
    sourceDate: /^\d{4}-\d{2}-\d{2}$/u.test(text(source.source_date)) ? text(source.source_date) : '',
    syncedAt: text(source.synced_at).slice(0, 16).replace('T', ' '),
    sourceLabel: text(source.label) || '소상공인시장진흥공단 전국 온누리상품권 가맹점 현황',
  });
}

export function normalizeOnnuriRegions(value) {
  if (!value || value.contract_id !== 'CORE-ONNURI-MERCHANT-REGIONS-01' || !Array.isArray(value.regions)) return null;
  const regions = [];
  for (const region of value.regions) {
    const name = text(region?.name);
    if (!name || regions.some(item => item.name === name)) continue;
    regions.push(Object.freeze({name, count: count(region.count), sigungu: text(region.sigungu), located: region.located === true}));
  }
  return Object.freeze({
    level: text(value.level),
    regions,
    noSigunguLevel: value.no_sigungu_level === true,
    emptyReason: text(value.empty_reason),
    coverage: normalizeCoverage(value.coverage),
  });
}

export function onnuriSearchUrl({latitude, longitude, radius = ONNURI_DEFAULT_RADIUS, sido = '', sigungu = '', dong = '', market = '', category = '', accept = '', limit = ONNURI_PAGE_SIZE, offset = 0} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (inKorea(Number(latitude), Number(longitude))) {
    // ~100 m: enough for "근처", not a precise position.
    params.set('latitude', String(Math.round(Number(latitude) * 1000) / 1000));
    params.set('longitude', String(Math.round(Number(longitude) * 1000) / 1000));
    params.set('radius_meters', String(ONNURI_RADII.includes(radius) ? radius : ONNURI_DEFAULT_RADIUS));
  } else {
    if (text(sido)) params.set('sido', text(sido));
    if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
    if (text(sido) && text(dong)) params.set('dong', text(dong));
    if (text(sido) && text(market)) params.set('market', text(market));
  }
  if (category) params.set('category', category);
  if (accept) params.set('accept', accept);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return `${origin}/v2/life/onnuri/merchants?${params}`;
}

export function onnuriRegionsUrl({sido = '', sigungu = '', level = ''} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (text(sido)) params.set('sido', text(sido));
  if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
  if (text(sido) && ['DONG', 'MARKET'].includes(level)) params.set('level', level);
  const query = params.toString();
  return `${origin}/v2/life/onnuri/regions${query ? `?${query}` : ''}`;
}

async function getJson(url, {fetchImpl = globalThis.fetch, signal} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), {once: true});
  try {
    const response = await fetchImpl(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok) return {ok: false, status: response.status, data: null};
    return {ok: true, status: response.status, data: await response.json()};
  } catch {
    return {ok: false, status: 0, data: null};
  } finally {
    clearTimeout(timer);
  }
}

export function acceptanceLabel(item) {
  const parts = [];
  if (item.paper === true) parts.push('지류');
  if (item.digital === true) parts.push('디지털(모바일·카드)');
  return parts.length ? `${parts.join(' · ')} 가맹` : '취급 형태 정보 없음';
}

function el(tag, className = '', value = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function button(label, className = 'consumer-action consumer-action-secondary') {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

export function createOnnuriLogoSlot(documentRef = document) {
  const slot = documentRef.createElement('i');
  slot.className = 'onnuri-logo-slot';
  slot.dataset.brandLogoSlot = 'onnuri';
  slot.dataset.logoState = ONNURI_LOGO_ASSET ? 'APPROVED' : 'PENDING_APPROVAL';
  slot.setAttribute('aria-hidden', 'true');
  if (ONNURI_LOGO_ASSET) {
    const image = documentRef.createElement('img');
    image.src = ONNURI_LOGO_ASSET; image.alt = ''; image.decoding = 'async';
    slot.append(image);
  }
  return slot;
}

// Where a pin/route goes: the shop's building, or its market (said so).
function placeFor(item) {
  const atMarket = item.locationBasis === 'MARKET';
  const target = atMarket && item.marketName ? item.marketName : item.name;
  const located = item.latitude !== null;
  return {
    target,
    atMarket,
    place: {
      name: target, address: item.marketAddress || item.address, placeId: `onnuri:${item.id}`,
      latitude: item.latitude, longitude: item.longitude,
      coordinateSystem: located ? 'WGS84' : '',
      coordinateAuthority: located ? (item.locationSource === 'PUBLIC_MARKET_STANDARD' ? 'PUBLIC_MARKET_STANDARD' : 'NAVER_MAPS_GEOCODING') : '',
      navigationCapable: located,
    },
  };
}

// The real app icons used on place and medical cards (assets/place-actions).
export const MAP_ICON_VERSION = 'place-icons-20260925';

export function mapIconName(provider, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const presentation = defaultMapProviderPresentation(provider, {userAgent});
  // Desktop 티맵 opens NAVER Map web instead (said in the label): show that app's icon.
  if (provider === 'TMAP' && /네이버지도/u.test(presentation.label)) return 'naver-map';
  return presentation.icon;
}

export function mapAppIcon(provider, {userAgent = globalThis.navigator?.userAgent || '', className = 'onnuri-map-icon'} = {}) {
  const iconName = mapIconName(provider, {userAgent});
  const icon = el('img', className);
  icon.src = `/assets/place-actions/${iconName}.png?v=${MAP_ICON_VERSION}`;
  icon.alt = '';
  icon.width = 22; icon.height = 22;
  icon.decoding = 'async';
  icon.dataset.mapIcon = iconName;
  return icon;
}

// ONNURI-REMOVE-RELATION-MAP-01 (owner, 2026-10-10): ONE map button per card --
// '길찾기' and '지도에서 보기' did the same thing. It opens the user's saved map app
// with that app's icon; a market-based location is said in the card body, not on
// the button.
export function onnuriMapActions(item, {mapProvider, userAgent = globalThis.navigator?.userAgent || ''}) {
  const {target, place} = placeFor(item);
  const app = defaultMapProviderPresentation(mapProvider, {userAgent}).label;
  let link;
  try {
    // 길찾기 only to a point the data really has (building or market); no point:
    // a name search in the chosen app, never a route.
    const route = place.navigationCapable;
    link = el('a', 'consumer-action onnuri-card-map');
    link.href = buildDefaultMapHref(mapProvider, place, {userAgent});
    link.dataset.mapAction = route ? 'route' : 'search';
    link.dataset.mapProvider = mapProvider;
    link.append(mapAppIcon(mapProvider, {userAgent}), el('span', 'onnuri-card-map-label', route ? `${app} 길찾기` : `${app}에서 찾기`));
    link.setAttribute('aria-label', route ? `${app}에서 ${target} 길찾기` : `${app}에서 ${target} 이름으로 찾기`);
  } catch {
    return [];                                           // no map link rather than a wrong one
  }
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  return [link];
}

export function onnuriMerchantCard(item, {mapProvider, userAgent = globalThis.navigator?.userAgent || ''}) {
  const card = el('article', 'onnuri-card');
  card.dataset.onnuriMerchant = item.id;
  if (item.latitude !== null) card.dataset.onnuriPoint = `${item.latitude.toFixed(6)},${item.longitude.toFixed(6)}`;
  const head = el('div', 'onnuri-card-head');
  const label = el('span', 'onnuri-card-label', ONNURI_CARD_LABEL);
  label.prepend(createOnnuriLogoSlot());
  head.append(label);
  const distance = item.distanceMeters !== null ? formatDistanceMeters(item.distanceMeters) : '';
  const atMarket = item.locationBasis === 'MARKET';
  if (distance) head.append(el('span', 'onnuri-card-distance', atMarket ? `시장까지 ${distance}` : distance));
  const title = el('h4', 'onnuri-card-title', item.name);
  title.title = item.name;
  const meta = el('p', 'onnuri-card-meta', [item.items, item.marketName].filter(Boolean).join(' · '));
  // The official 소재지 may be only "서울"; the market's address says where to go.
  const address = el('p', 'onnuri-card-address', item.marketAddress ? `시장 주소 ${item.marketAddress}` : item.address);
  const accept = el('p', 'onnuri-card-accept', acceptanceLabel(item));
  card.append(head, title);
  if (meta.textContent) card.append(meta);
  card.append(address);
  if (atMarket) {
    const basis = el('p', 'onnuri-card-basis', '위치·거리는 소속 시장 기준');
    basis.title = '가게 위치는 시장 안에서 확인해 주세요.';
    card.append(basis);
  } else if (item.latitude === null) {
    card.append(el('p', 'onnuri-card-basis', '공식 자료에 상세 위치 없음'));
  }
  card.append(accept);
  const actions = el('div', 'onnuri-card-actions');
  if (item.phone) {
    const call = el('a', 'consumer-action consumer-action-secondary onnuri-card-phone', `전화 ${item.phone}`);
    call.href = `tel:${item.phone.replaceAll('-', '')}`;
    call.setAttribute('aria-label', `${item.name}에 전화 걸기 ${item.phone}`);
    actions.append(call);
  }
  actions.append(...onnuriMapActions(item, {mapProvider, userAgent}));
  if (actions.children.length) card.append(actions);
  return card;
}

// ── 화면 ─────────────────────────────────────────────────────────────────

function locationFailureText(outcome) {
  const code = outcome?.error?.code || '';
  if (outcome?.permission === LOCATION_PERMISSION.DENIED || code === 'BROWSER_LOCATION_DENIED') {
    return '브라우저의 위치 권한이 꺼져 있어 현재 위치를 쓸 수 없어요. 브라우저 설정에서 허용하거나 지역을 골라 찾아 주세요.';
  }
  if (code === 'BROWSER_LOCATION_UNSUPPORTED') return '이 브라우저에서는 현재 위치를 쓸 수 없어요. 지역을 골라 찾아 주세요.';
  if (code === 'BROWSER_LOCATION_TIMEOUT') return '현재 위치 확인 시간이 지나 위치를 받지 못했어요. 다시 시도하거나 지역을 골라 찾아 주세요.';
  if (code === 'OUTSIDE_KOREA') return '현재 위치가 국내가 아니라 근처 가맹점을 찾을 수 없어요. 지역을 골라 찾아 주세요.';
  return '현재 위치를 확인하지 못했어요. 다시 시도하거나 지역을 골라 찾아 주세요.';
}

export async function mountOnnuriMerchants({
  root, fetchImpl = globalThis.fetch, documentRef = document, windowRef = globalThis.window,
  resolveCurrent = resolveSharedBrowserCurrentLocation, locationUsageEnabled = isLocationUsageEnabled,
  permissionState = getBrowserLocationPermissionState,
} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  const regionTokens = {sigungu: 0, dong: 0, market: 0};
  const state = {
    mode: 'region', location: null, radius: ONNURI_DEFAULT_RADIUS, sido: '', sigungu: '', dong: '', market: '',
    category: '', accept: '', offset: 0, items: [], result: null, noSigungu: false,
  };
  let preference = readMapPreference(documentRef.cookie || '');

  root.classList.add('onnuri-surface');
  const intro = el('div', 'onnuri-intro');
  const brand = el('div', 'onnuri-brand');
  brand.append(createOnnuriLogoSlot(documentRef), el('strong', 'onnuri-brand-label', `${ONNURI_MENU_LABEL} 가맹점 찾기`));
  // ONNURI-REGION-FIRST-UX-01 (QA #16): the long notice no longer pushes the
  // results down -- one line, the rest under 자세히.
  const notice = el('details', 'onnuri-disclaimer-box');
  const noticeSummary = el('summary', 'consumer-feature-note onnuri-disclaimer-summary');
  noticeSummary.append(el('span', '', ONNURI_DISCLAIMER_SUMMARY), el('span', 'onnuri-disclaimer-more', '자세히'));
  notice.append(noticeSummary, el('p', 'consumer-feature-note onnuri-disclaimer', ONNURI_DISCLAIMER));
  intro.append(brand, notice);

  // Mode switch: 내 주변 / 지역 선택.
  const modes = el('div', 'onnuri-modes'); modes.setAttribute('role', 'tablist'); modes.setAttribute('aria-label', '찾는 방법');
  const modeButtons = {};
  for (const [key, labelText] of [['location', '내 주변'], ['region', '지역 선택']]) {
    const tab = button(labelText, 'onnuri-mode'); tab.dataset.onnuriMode = key; tab.setAttribute('role', 'tab');
    modes.append(tab); modeButtons[key] = tab;
  }

  const nearbyPanel = el('div', 'onnuri-nearby-panel');
  const locate = button('현재 위치로 찾기', 'consumer-action onnuri-locate');
  const radiusRow = el('div', 'festival-chip-row onnuri-chip-row onnuri-radius-row');
  radiusRow.setAttribute('role', 'group'); radiusRow.setAttribute('aria-label', '검색 반경');
  for (const meters of ONNURI_RADII) {
    const chip = button(radiusLabel(meters), 'festival-chip'); chip.dataset.onnuriRadius = String(meters);
    chip.addEventListener('click', () => {
      if (state.radius === meters) return;
      state.radius = meters; paintRadius();
      if (state.mode === 'location' && state.location) void search({reset: true});
    });
    radiusRow.append(chip);
  }
  const locationNote = el('p', 'consumer-feature-note onnuri-location-note');
  locationNote.setAttribute('role', 'status');
  nearbyPanel.append(locate, radiusRow, locationNote);

  const regionPanel = el('div', 'onnuri-region-panel');
  const regionRow = el('div', 'onnuri-region-row');
  const selects = {};
  const fields = {};
  for (const [key, labelText] of [['sido', '시·도'], ['sigungu', '시·군·구'], ['dong', '읍·면·동'], ['market', '시장·상점가']]) {
    const label = el('label', 'consumer-life-field onnuri-region-field', labelText);
    const select = el('select'); select.dataset.onnuriRegion = key; select.setAttribute('aria-label', labelText);
    select.append(new Option('전체', ''));
    label.append(select); regionRow.append(label); selects[key] = select; fields[key] = label;
    if (key !== 'sido') label.hidden = true;               // shown only with real choices
  }
  const regionNote = el('p', 'consumer-feature-note onnuri-region-note'); regionNote.setAttribute('role', 'status');
  regionPanel.append(regionRow, regionNote);

  // ONNURI-REGION-FIRST-UX-01 (QA #16): each chip row says what it filters, so
  // the two '전체' chips are told apart ('업종' / '종류').
  const chipGroup = (items, key, labelText, visibleLabel = labelText) => {
    const field = el('div', 'onnuri-chip-field');
    field.dataset.onnuriChipField = key;
    const name = el('span', 'onnuri-chip-name', visibleLabel);
    name.id = `onnuri-chip-name-${key}`;
    const row = el('div', 'festival-chip-row onnuri-chip-row');
    row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', name.id);
    field.append(name, row);
    for (const [value, chipLabel] of items) {
      const chip = button(chipLabel, 'festival-chip'); chip.dataset.onnuriFilter = key; chip.dataset.value = value;
      chip.setAttribute('aria-pressed', String(state[key] === value));
      chip.addEventListener('click', () => {
        state[key] = value;
        for (const other of row.children) other.setAttribute('aria-pressed', String(other.dataset.value === value));
        digitalNote.hidden = state.accept !== 'DIGITAL';
        void search({reset: true});
      });
      row.append(chip);
    }
    return field;
  };
  const digitalNote = el('p', 'consumer-feature-note onnuri-digital-note', ONNURI_DIGITAL_NOTE);
  digitalNote.hidden = true;
  const categoryRow = chipGroup(ONNURI_CATEGORIES, 'category', '업종');
  const acceptRow = chipGroup(ONNURI_ACCEPTS, 'accept', '상품권 종류', '종류');

  const scopeLine = el('p', 'onnuri-scope');
  const status = el('p', 'onnuri-status'); status.setAttribute('role', 'status');
  const coverageNote = el('p', 'consumer-feature-note onnuri-coverage');
  const emptyActions = el('div', 'onnuri-empty-actions'); emptyActions.hidden = true;
  const error = el('div', 'onnuri-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const appNote = el('p', 'consumer-feature-note onnuri-map-app');
  const list = el('div', 'onnuri-results');
  const more = button('더 보기', 'consumer-action consumer-action-secondary onnuri-more'); more.hidden = true;
  const source = el('p', 'consumer-feature-note onnuri-source');

  root.replaceChildren(intro, modes, nearbyPanel, regionPanel, categoryRow, acceptRow, digitalNote, scopeLine, status,
    coverageNote, emptyActions, error, appNote, list, more, source);

  function paintMode() {
    for (const [key, tab] of Object.entries(modeButtons)) {
      const on = state.mode === key;
      tab.setAttribute('aria-selected', String(on));
      tab.classList.toggle('is-active', on);
    }
    nearbyPanel.hidden = state.mode !== 'location';
    regionPanel.hidden = state.mode !== 'region';
  }

  function paintRadius() {
    for (const chip of radiusRow.children) chip.setAttribute('aria-pressed', String(Number(chip.dataset.onnuriRadius) === state.radius));
  }

  function paintAppNote() {
    appNote.replaceChildren(mapPreferenceNote(preference));
    if (preference.state !== 'SAVED') {
      const link = el('a', '', ' 지도앱 설정'); link.href = ONNURI_MAP_SETTINGS_URL; link.rel = 'noopener';
      appNote.append(link);
    }
  }

  function scopeText() {
    if (state.mode === 'location') return `내 주변 · 반경 ${radiusLabel(state.radius)} · 가까운 순`;
    const parts = [state.sido, state.sigungu, state.dong].filter(Boolean);
    const where = parts.length ? parts.join(' ') : '전국';
    return state.market ? `${where} · ${state.market}` : `${where} 전체`;
  }

  function renderCards() {
    list.replaceChildren(...state.items.map(item => onnuriMerchantCard(item, {mapProvider: preference.provider})));
  }

  function paintCoverage(result) {
    const coverage = result?.coverage;
    if (!coverage) { coverageNote.textContent = ''; return; }
    // QA-02 E1: data-quality counts (확인/확인 안 됨 n곳) are not shown to customers.
    // Only what the reader can act on stays, in words.
    if (state.mode === 'location') {
      coverageNote.textContent = coverage.unlocated
        ? '공식 자료에 위치가 없는 가맹점은 거리로 찾을 수 없어요. 지역 선택으로 찾아 주세요.'
        : '';
      return;
    }
    coverageNote.textContent = '';
  }

  function showEmpty(result) {
    emptyActions.replaceChildren(); emptyActions.hidden = true;
    const scope = scopeText();
    if (state.mode === 'location' && result.emptyReason === 'LOCATION_DATA_UNAVAILABLE') {
      status.textContent = '위치가 확인된 가맹점 자료가 아직 없어 거리로 찾을 수 없어요. 주변에 가맹점이 없다는 뜻은 아니에요.';
      const toRegion = button('지역 선택으로 찾기'); toRegion.addEventListener('click', () => switchMode('region'));
      emptyActions.append(toRegion); emptyActions.hidden = false;
      return;
    }
    if (state.mode === 'location') {
      const nearest = result.nearestDistanceMeters !== null ? ` 가장 가까운 확인된 곳은 약 ${formatDistanceMeters(result.nearestDistanceMeters)}예요.` : '';
      status.textContent = `반경 ${radiusLabel(state.radius)} 안에서 위치가 확인된 가맹점을 찾지 못했어요.${nearest} 위치가 없는 가맹점은 거리 검색에서 빠지니, 없다고 단정하지는 말아 주세요.`;
      const wider = result.suggestedRadiusMeters ?? ONNURI_RADII.find(radius => radius > state.radius);
      if (wider) {
        const expand = button(`${radiusLabel(wider)}로 넓히기`); expand.dataset.onnuriExpand = String(wider);
        expand.addEventListener('click', () => { state.radius = wider; paintRadius(); void search({reset: true}); });
        emptyActions.append(expand);
      }
      const toRegion = button('지역 선택으로 찾기'); toRegion.addEventListener('click', () => switchMode('region'));
      emptyActions.append(toRegion); emptyActions.hidden = false;
      return;
    }
    status.textContent = `${scope}에서 조건에 맞는 가맹점을 공공데이터에서 찾지 못했어요. 공공데이터에 없다고 해서 가맹점이 아니라는 뜻은 아니에요.`;
  }

  async function search({reset = false} = {}) {
    if (disposed) return;
    if (reset) { state.offset = 0; state.items = []; list.replaceChildren(); }
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    scopeLine.textContent = scopeText();
    status.textContent = '찾는 중…'; error.hidden = true; more.hidden = true; emptyActions.hidden = true;
    const useLocation = state.mode === 'location' && state.location;
    if (state.mode === 'location' && !state.location) { status.textContent = ''; return; }
    // ONNURI-REGION-FIRST-UX-01 (QA #16): no nationwide list in arbitrary order --
    // a region (or 내 주변) comes first.
    if (state.mode === 'region' && !state.sido) {
      controller.abort();
      state.items = []; state.result = null; list.replaceChildren(); coverageNote.textContent = ''; source.textContent = '';
      scopeLine.textContent = '';
      status.textContent = ONNURI_REGION_PROMPT;
      root.dataset.onnuriAwaitingRegion = 'true';
      return;
    }
    delete root.dataset.onnuriAwaitingRegion;
    const startedAt = globalThis.performance?.now?.() ?? 0;
    const response = await getJson(onnuriSearchUrl({
      ...(useLocation ? {...state.location, radius: state.radius}
        : {sido: state.sido, sigungu: state.sigungu, dong: state.dong, market: state.market}),
      category: state.category, accept: state.accept, limit: ONNURI_PAGE_SIZE, offset: state.offset,
    }), {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return;             // a newer search owns the screen
    const result = response.ok ? normalizeOnnuriSearch(response.data) : null;
    if (!result) {
      status.textContent = '';
      error.replaceChildren(el('span', '', '온누리상품권 가맹점 정보를 불러오지 못했어요.'));
      const retry = button('다시 시도'); retry.addEventListener('click', () => void search({reset: state.items.length === 0}));
      error.append(retry); error.hidden = false;
      return;
    }
    if (result.availability !== 'AVAILABLE') {
      status.textContent = '온누리상품권 가맹점 정보를 준비하고 있어요. 잠시 후 다시 확인해 주세요.';
      source.textContent = '';
      return;
    }
    state.result = result;
    const known = new Set(state.items.map(item => item.id));
    const fresh = result.items.filter(item => !known.has(item.id));
    state.items.push(...fresh);
    renderCards();
    root.dataset.onnuriRenderMs = String(Math.round((globalThis.performance?.now?.() ?? 0) - startedAt));
    state.offset = result.nextOffset ?? state.offset + fresh.length;
    more.hidden = !result.hasMore;
    paintCoverage(result);
    if (!state.items.length) {
      showEmpty(result);
    } else if (useLocation) {
      status.textContent = `가까운 순으로 ${state.items.length}곳을 보여 드려요(반경 안 ${won(result.totalCount)}곳). `
        + '거리는 확인된 가게 위치 또는 소속 시장 위치까지예요.';
    } else {
      status.textContent = `가맹점 ${won(result.totalCount)}곳 중 ${state.items.length}곳을 보여 드려요. 거리는 내 주변 검색에서만 표시해요.`;
    }
    if (result.pageLimitReached && state.items.length) {
      status.textContent += ' 목록은 여기까지 보여 드려요. 지역·시장·업종으로 좁혀 찾아 주세요.';
    }
    const reference = result.coverage?.referenceDate ? ` · 시장 위치: 소상공인시장진흥공단 전국전통시장표준데이터(${result.coverage.referenceDate} 기준)` : '';
    source.textContent = `출처: ${result.sourceLabel}${result.sourceDate ? `(${result.sourceDate} 기준)` : ''}${result.syncedAt ? ` · LOTBI 반영 ${result.syncedAt}` : ''}${reference}`;
  }

  async function loadRegions(level) {
    // level: 'sido' | 'sigungu' | 'dong' | 'market'
    const target = selects[level];
    const token = level === 'sido' ? 0 : ++regionTokens[level];
    target.replaceChildren(new Option('전체', ''));
    if (level !== 'sido') fields[level].hidden = true;
    const response = await getJson(onnuriRegionsUrl({
      sido: level === 'sido' ? '' : state.sido,
      sigungu: level === 'dong' || level === 'market' ? state.sigungu : '',
      level: level === 'dong' && state.noSigungu ? 'DONG' : level === 'market' ? 'MARKET' : '',
    }), {fetchImpl});
    if (disposed || (level !== 'sido' && token !== regionTokens[level])) return null;
    const regions = response.ok ? normalizeOnnuriRegions(response.data) : null;
    if (!regions) return null;
    for (const region of regions.regions) {
      const suffix = region.count !== null ? ` (${won(region.count)})` : '';
      target.append(new Option(`${region.name}${suffix}`, region.name));
    }
    if (level !== 'sido') fields[level].hidden = target.options.length <= 1;
    return regions;
  }

  async function afterSido() {
    regionNote.textContent = '';
    for (const key of ['sigungu', 'dong', 'market']) { selects[key].replaceChildren(new Option('전체', '')); fields[key].hidden = true; }
    state.noSigungu = false;
    if (!state.sido) return;
    const cities = await loadRegions('sigungu');
    if (disposed || !cities) return;
    state.noSigungu = cities.noSigunguLevel;
    const notes = [];
    if (cities.noSigunguLevel) {
      notes.push(`${state.sido}는 시·군·구 없이 읍·면·동으로 나뉘어요.`);
      await loadRegions('dong');
    } else if (!cities.regions.length) {
      notes.push(`${state.sido}는 공식 자료에 시·군·구가 확인된 가맹점이 없어 시·군·구로 나눠 볼 수 없어요. 시·도 전체나 시장·상점가로 찾아 주세요.`);
    }
    regionNote.textContent = notes.join(' ');
    await loadRegions('market');
  }

  function switchMode(mode) {
    if (state.mode === mode && (mode === 'region' || state.location)) return;
    if (mode === 'location') { void useCurrentLocation(); return; }
    state.mode = 'region';
    paintMode();
    void search({reset: true});
  }

  async function useCurrentLocation() {
    locationNote.replaceChildren();
    state.mode = 'location'; paintMode();
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    if (!enabled) {
      state.location = null;
      locationNote.append('LOTBI 설정에서 위치 사용이 꺼져 있어 현재 위치를 쓰지 않아요. ');
      const link = el('a', '', '설정에서 위치 켜기'); link.href = ONNURI_SETTINGS_URL; link.rel = 'noopener';
      locationNote.append(link);
      const toRegion = button('지역 선택으로 찾기', 'consumer-action consumer-action-secondary onnuri-to-region');
      toRegion.addEventListener('click', () => switchMode('region'));
      locationNote.append(toRegion);
      list.replaceChildren(); more.hidden = true; status.textContent = ''; scopeLine.textContent = '';
      coverageNote.textContent = ''; emptyActions.hidden = true;
      return undefined;
    }
    locate.disabled = true;
    locationNote.textContent = '현재 위치를 확인하고 있어요…';
    let location = null;
    let outcome = null;
    try {
      outcome = await resolveCurrent({allowPrompt: true});
      const latitude = Number(outcome?.location?.latitude);
      const longitude = Number(outcome?.location?.longitude);
      if (inKorea(latitude, longitude)) location = {latitude, longitude};
      else if (Number.isFinite(latitude) && Number.isFinite(longitude)) outcome = {error: {code: 'OUTSIDE_KOREA'}};
    } catch {
      location = null;
    } finally {
      locate.disabled = false;
    }
    if (disposed) return undefined;
    if (!location) {
      // Never a guessed region: say why and offer the region picker.
      state.location = null;
      locationNote.replaceChildren(locationFailureText(outcome));
      const toRegion = button('지역 선택으로 찾기', 'consumer-action consumer-action-secondary onnuri-to-region');
      toRegion.addEventListener('click', () => switchMode('region'));
      locationNote.append(toRegion);
      list.replaceChildren(); more.hidden = true; status.textContent = ''; scopeLine.textContent = '';
      coverageNote.textContent = ''; emptyActions.hidden = true; state.items = [];
      return undefined;
    }
    state.location = location;
    locationNote.textContent = '현재 위치 기준으로 찾아요. 위치는 이번 검색에만 쓰고 저장하지 않아요.';
    return search({reset: true});
  }

  // The Account setting may change while this screen is open (another tab):
  // read it again whenever the page comes back and redraw the map links.
  function refreshPreference() {
    if (disposed) return;
    const next = readMapPreference(documentRef.cookie || '');
    if (next.provider === preference.provider && next.state === preference.state) return;
    preference = next;
    paintAppNote();
    if (state.items.length) renderCards();
  }
  const onVisible = () => { if (documentRef.visibilityState !== 'hidden') refreshPreference(); };
  documentRef.addEventListener('visibilitychange', onVisible);
  windowRef?.addEventListener?.('focus', refreshPreference);
  windowRef?.addEventListener?.('pageshow', refreshPreference);

  modeButtons.location.addEventListener('click', () => switchMode('location'));
  modeButtons.region.addEventListener('click', () => switchMode('region'));
  locate.addEventListener('click', () => void useCurrentLocation());
  selects.sido.addEventListener('change', () => {
    state.mode = 'region'; state.sido = selects.sido.value; state.sigungu = ''; state.dong = ''; state.market = '';
    void afterSido();
    void search({reset: true});
  });
  selects.sigungu.addEventListener('change', () => {
    state.mode = 'region'; state.sigungu = selects.sigungu.value; state.dong = ''; state.market = '';
    selects.dong.replaceChildren(new Option('전체', '')); fields.dong.hidden = true;
    if (state.sigungu) void loadRegions('dong');
    void loadRegions('market');
    void search({reset: true});
  });
  selects.dong.addEventListener('change', () => { state.mode = 'region'; state.dong = selects.dong.value; void search({reset: true}); });
  selects.market.addEventListener('change', () => { state.mode = 'region'; state.market = selects.market.value; void search({reset: true}); });
  more.addEventListener('click', () => void search());

  paintMode(); paintRadius(); paintAppNote();
  await loadRegions('sido');
  // Like the festival screen: only an already-granted permission starts with
  // the current location; otherwise nothing is asked until a button is pressed.
  let granted = false;
  try { granted = locationUsageEnabled() === true && (await permissionState()) === LOCATION_PERMISSION.GRANTED; } catch { granted = false; }
  if (disposed) return {dispose() {}, state};
  if (granted) await useCurrentLocation();
  else await search({reset: true});
  return {
    dispose() {
      disposed = true; controller?.abort();
      documentRef.removeEventListener('visibilitychange', onVisible);
      windowRef?.removeEventListener?.('focus', refreshPreference);
      windowRef?.removeEventListener?.('pageshow', refreshPreference);
    },
    state,
  };
}
