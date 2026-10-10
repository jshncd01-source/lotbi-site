// LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0 — 생활정보 '온누리상품권·지역화폐'.
//
// One screen, two tabs. [온누리상품권] mounts the existing onnuri module
// (site-life-onnuri.js) exactly as before; [지역화폐] reads Core's public,
// guest-safe GET /v2/life/vouchers/regions|schemes|merchants
// (docs/VOUCHER_UNIFIED_API_CONTRACT.md §1). The two never mix: a local-currency
// card only lists the 지역사랑상품권 links Core published for that shop, and it
// never says 온누리.
//
// No credentials, nothing stored. The current position is used only for
// "가까운 순" and only when the user already allowed location (LOTBI setting on
// and browser permission granted); nothing is ever asked on its own. Without
// it every region can still be browsed by hand.
//
// LOTBI does not issue, sell or take payment for any voucher and is not the
// issuer's partner. The list is the official/staff-checked data, not real-time
// payment availability.
import {CORE_ORIGIN} from './site-core.js?v=aset-65b1ef984229';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-65b1ef984229';
import {isLocationUsageEnabled} from './site-location-preference.js?v=aset-65b1ef984229';
import {buildDefaultMapHref, defaultMapProviderPresentation, formatDistanceMeters} from './site-navigation.js?v=aset-65b1ef984229';
import {mountOnnuriMerchants, readMapPreference, mapPreferenceNote, mapIconName, MAP_ICON_VERSION} from './site-life-onnuri.js?v=aset-65b1ef984229';

export const VOUCHER_HUB_TITLE = '온누리상품권·지역화폐';
export const VOUCHER_TABS = Object.freeze([['onnuri', '온누리상품권'], ['local', '지역화폐']]);
export const VOUCHER_PAGE_SIZE = 12;
export const VOUCHER_DEFAULT_RADIUS = 5000;
export const VOUCHER_SOURCE_LABELS = Object.freeze({
  OFFICIAL_API: '한국조폐공사 공식 공개자료',
  LOCAL_GOV_LIST: '지자체 공개 가맹점 명단',
  OPERATOR_LIST: '승인된 운영기관 자료',
  ADMIN_ENTRY: 'LOTBI 관리자 등록자료',
});
export const VOUCHER_CATEGORIES = Object.freeze([
  ['', '전체'], ['FOOD', '음식점'], ['CAFE', '카페·간식'], ['GROCERY', '장보기'], ['CLOTHING', '의류·잡화'],
  ['LIVING', '생활'], ['HEALTH', '병원·약국'], ['EDU', '학원·교육'], ['OTHER', '기타'],
]);
export const VOUCHER_PAYMENTS = Object.freeze([['', '전체'], ['PAPER', '지류'], ['MOBILE', '모바일'], ['CARD', '카드']]);
export const VOUCHER_DEFAULT_NOTICE = '공식 공개자료·관리자 확인 자료를 안내해요. 실시간 결제 가능 여부가 아니니 방문 전 가맹점에 확인해 주세요.';
export const VOUCHER_NOT_PARTNER = 'LOTBI는 자료를 안내할 뿐, 상품권 발행기관·운영대행사의 공식·제휴 서비스가 아니에요. 상품권 구매·결제·잔액 조회는 하지 않아요.';
export const VOUCHER_NO_DATA_TEXT = '현재 LOTBI에 등록된 가맹점 정보가 없습니다.';
export const VOUCHER_NO_DATA_NOTE = '가맹점이 없다는 뜻은 아니에요. 공식 조회 페이지에서 확인해 주세요.';
export const VOUCHER_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
export const VOUCHER_MAP_SETTINGS_URL = 'https://account.lotbiai.com/account#personalization';
// The real app icons used on place cards: MAP_ICON_VERSION / mapIconName come from
// site-life-onnuri.js so both tabs draw the same icon for the same saved app.
export {MAP_ICON_VERSION};

const TIMEOUT_MS = 12_000;
const PAYMENT_NAMES = Object.freeze([['paper', '지류'], ['mobile', '모바일'], ['card', '카드']]);
const ISSUER_LEVEL_LABELS = Object.freeze({PROVINCE: '광역', CITY: '기초'});
const text = value => (typeof value === 'string' ? value.trim() : '');
const tri = value => (value === true ? true : value === false ? false : null);
const count = value => (Number.isInteger(value) && value >= 0 ? value : null);
const date = value => (/^\d{4}-\d{2}-\d{2}$/u.test(text(value)) ? text(value) : '');
const httpsUrl = value => { const url = text(value); return /^https:\/\/[^\s]+$/u.test(url) ? url : ''; };
const safeId = value => { const id = text(value); return /^[A-Za-z0-9_.:-]{1,80}$/u.test(id) ? id : ''; };
const won = value => value.toLocaleString('ko-KR');
// A local-currency screen never shows 온누리 (contract: the two are never mixed).
const isOnnuriName = value => /온누리/u.test(value);

function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 131;
}

// ── Core responses ───────────────────────────────────────────────────────

function normalizePayments(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({paper: tri(source.paper), mobile: tri(source.mobile), card: tri(source.card)});
}

export function paymentLabel(payments) {
  // Only what the official data says; null = not stated, never guessed.
  return PAYMENT_NAMES.filter(([key]) => payments?.[key] === true).map(([, label]) => label).join('·');
}

export function normalizeVoucherScheme(value) {
  if (!value || typeof value !== 'object') return null;
  const id = safeId(value.id);
  const name = text(value.name);
  if (!id || !name || isOnnuriName(name)) return null;
  if (value.status !== undefined && value.status !== 'ACTIVE') return null;
  return Object.freeze({
    id,
    name,
    issuer: text(value.issuer),
    issuerLevel: ISSUER_LEVEL_LABELS[value.issuer_level] ? value.issuer_level : '',
    sido: text(value.sido),
    sigungu: text(value.sigungu),
    usageAreaLabel: text(value.usage_area_label),
    // e.g. 광주상생카드: only the former 광주광역시 area. Shown small when present.
    usageAreaNote: text(value.usage_area_note),
    payments: normalizePayments(value.payment_types),
    officialUrl: httpsUrl(value.official_url),
    officialMerchantSearchUrl: httpsUrl(value.official_merchant_search_url),
    sourceLabel: text(value.source_label),
    lastVerifiedOn: date(value.last_verified_on),
    merchantCount: count(value.merchant_count),
  });
}

export function normalizeVoucherSchemes(value) {
  if (!value || typeof value !== 'object' || value.schema_version !== 1) return null;
  const items = [];
  for (const raw of Array.isArray(value.items) ? value.items : []) {
    const item = normalizeVoucherScheme(raw);
    if (item && !items.some(other => other.id === item.id)) items.push(item);
  }
  // 광역 first, then 기초 (both shown when both apply).
  items.sort((left, right) => (left.issuerLevel === 'PROVINCE' ? 0 : 1) - (right.issuerLevel === 'PROVINCE' ? 0 : 1));
  const catalog = value.catalog && typeof value.catalog === 'object' ? value.catalog : {};
  const sources = (Array.isArray(catalog.sources) ? catalog.sources : [])
    .map(source => ({label: text(source?.label), url: httpsUrl(source?.url)})).filter(source => source.label);
  return Object.freeze({
    items,
    emptyReason: ['REGION_REQUIRED', 'NO_SCHEME_FOR_REGION'].includes(value.empty_reason) ? value.empty_reason : '',
    catalogSource: text(catalog.source),
    checkedOn: date(catalog.checked_on),
    sources,
  });
}

export function normalizeVoucherRegions(value) {
  if (!value || typeof value !== 'object' || value.schema_version !== 1 || !Array.isArray(value.items)) return null;
  const items = [];
  for (const raw of value.items) {
    const name = text(raw?.name);
    if (!name || items.some(item => item.name === name)) continue;
    items.push(Object.freeze({name, schemeCount: count(raw.scheme_count), merchantCount: count(raw.merchant_count)}));
  }
  return Object.freeze({level: text(value.level), items});
}

function normalizeAccept(value) {
  if (!value || typeof value !== 'object') return null;
  const schemeId = safeId(value.scheme_id);
  const schemeName = text(value.scheme_name);
  if (!schemeId || !schemeName || isOnnuriName(schemeName)) return null;
  const kind = text(value.source?.kind);
  const sourceLabel = VOUCHER_SOURCE_LABELS[kind] || '';
  if (!sourceLabel) return null;                       // every published link has a known basis
  return Object.freeze({
    schemeId, schemeName, payments: normalizePayments(value.payment_types),
    sourceKind: kind, sourceLabel, lastVerifiedOn: date(value.last_verified_on),
  });
}

export function normalizeVoucherMerchant(value) {
  if (!value || typeof value !== 'object') return null;
  const id = safeId(value.id);
  const name = text(value.name);
  if (!id || !name) return null;
  const accepts = [];
  for (const raw of Array.isArray(value.accepts) ? value.accepts : []) {
    const accept = normalizeAccept(raw);
    if (accept && !accepts.some(other => other.schemeId === accept.schemeId)) accepts.push(accept);
  }
  if (!accepts.length) return null;                     // nothing published to show
  const location = value.location && typeof value.location === 'object' ? value.location : null;
  const latitude = typeof location?.latitude === 'number' ? location.latitude : Number.NaN;
  const longitude = typeof location?.longitude === 'number' ? location.longitude : Number.NaN;
  const located = inKorea(latitude, longitude) && ['OFFICIAL', 'PROVIDED', 'STAFF_VERIFIED'].includes(location?.precision);
  const distance = typeof value.distance_meters === 'number' ? value.distance_meters : Number.NaN;
  const phoneDigits = text(value.phone).replace(/[^0-9]/gu, '');
  const category = value.category && typeof value.category === 'object' ? value.category : null;
  return Object.freeze({
    id,
    name,
    address: text(value.address),
    sido: text(value.sido),
    sigungu: text(value.sigungu),
    dong: text(value.dong),
    categoryCode: text(category?.code),
    categoryLabel: text(category?.label),
    categoryDetail: text(value.category_detail),
    phone: /^0\d{7,10}$|^1[5-9]\d{6}$/u.test(phoneDigits) ? text(value.phone) : '',
    phoneDigits: /^0\d{7,10}$|^1[5-9]\d{6}$/u.test(phoneDigits) ? phoneDigits : '',
    latitude: located ? latitude : null,
    longitude: located ? longitude : null,
    distanceMeters: located && Number.isInteger(distance) && distance >= 0 && distance <= 300000 ? distance : null,
    businessStatus: ['OPERATING', 'SUSPENDED', 'UNKNOWN'].includes(value.business_status) ? value.business_status : 'UNKNOWN',
    accepts,
    regionOnly: value.address_precision !== 'STREET',
    mapQuery: text(value.map_query) || [text(value.address), name].filter(Boolean).join(' '),
  });
}

export function normalizeVoucherSearch(value) {
  if (!value || typeof value !== 'object' || value.schema_version !== 1) return null;
  const items = [];
  for (const raw of Array.isArray(value.items) ? value.items : []) {
    const item = normalizeVoucherMerchant(raw);
    if (item && !items.some(other => other.id === item.id)) items.push(item);
  }
  const limit = count(value.limit) || VOUCHER_PAGE_SIZE;
  const offset = count(value.offset) ?? 0;
  return Object.freeze({
    mode: value.mode === 'NEARBY' ? 'NEARBY' : 'REGION',
    scheme: normalizeVoucherScheme(value.scheme),
    totalCount: count(value.total_count) ?? items.length,
    limit,
    offset,
    hasMore: value.has_more === true,
    items,
    emptyReason: ['NO_DATA_REGISTERED', 'NO_MATCH', 'NO_LOCATED_NEARBY'].includes(value.empty_reason) ? value.empty_reason : '',
    officialMerchantSearchUrl: httpsUrl(value.official_merchant_search_url),
    notice: text(value.notice) && !/현재\s*결제\s*가능/u.test(value.notice) ? text(value.notice) : VOUCHER_DEFAULT_NOTICE,
  });
}

// ── URLs ─────────────────────────────────────────────────────────────────

export function voucherRegionsUrl({sido = '', sigungu = '', level = ''} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (text(sido)) params.set('sido', text(sido));
  if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
  if (text(sido) && text(sigungu) && level === 'DONG') params.set('level', 'DONG');
  const query = params.toString();
  return `${origin}/v2/life/vouchers/regions${query ? `?${query}` : ''}`;
}

export function voucherSchemesUrl({sido = '', sigungu = ''} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (text(sido)) params.set('sido', text(sido));
  if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
  return `${origin}/v2/life/vouchers/schemes?${params}`;
}

export function voucherMerchantsUrl({
  schemeId, sido = '', sigungu = '', dong = '', q = '', category = '', payment = '', latitude, longitude,
  radius = VOUCHER_DEFAULT_RADIUS, limit = VOUCHER_PAGE_SIZE, offset = 0,
} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  params.set('scheme_id', text(schemeId));
  if (text(sido)) params.set('sido', text(sido));
  if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
  if (text(sido) && text(sigungu) && text(dong)) params.set('dong', text(dong));
  const query = text(q).slice(0, 40);
  if (query) params.set('q', query);
  if (VOUCHER_CATEGORIES.some(([code]) => code && code === category)) params.set('category', category);
  if (VOUCHER_PAYMENTS.some(([code]) => code && code === payment)) params.set('payment', payment);
  if (inKorea(Number(latitude), Number(longitude))) {
    // ~100 m: enough for "가까운 순", not a precise position.
    params.set('latitude', String(Math.round(Number(latitude) * 1000) / 1000));
    params.set('longitude', String(Math.round(Number(longitude) * 1000) / 1000));
    params.set('radius_meters', String([1000, 3000, 5000, 10000, 25000].includes(radius) ? radius : VOUCHER_DEFAULT_RADIUS));
  }
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return `${origin}/v2/life/vouchers/merchants?${params}`;
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

// ── DOM helpers (textContent only) ───────────────────────────────────────

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

function externalLink(label, href, className = '') {
  const link = el('a', className, label);
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}

// ── Map app ──────────────────────────────────────────────────────────────

export {mapIconName};

export function voucherMapAction(item, {mapProvider, userAgent = globalThis.navigator?.userAgent || ''}) {
  const located = item.latitude !== null && item.longitude !== null;
  // With a checked point: that point. Without: an address search in the same
  // app (map_query), never an invented pin.
  const place = located
    ? {name: item.name, address: item.address, placeId: `voucher:${item.id}`, latitude: item.latitude, longitude: item.longitude,
      coordinateSystem: 'WGS84', coordinateAuthority: 'LOTBI_VOUCHER', navigationCapable: true}
    : {name: item.mapQuery, address: '', placeId: `voucher:${item.id}`, latitude: null, longitude: null, navigationCapable: false};
  const app = defaultMapProviderPresentation(mapProvider, {userAgent}).label;
  let href = '';
  try { href = buildDefaultMapHref(mapProvider, place, {userAgent}); } catch { return null; }
  const link = el('a', 'consumer-action consumer-action-secondary voucher-card-map');
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.dataset.mapAction = located ? 'route' : 'search';
  link.dataset.mapProvider = mapProvider;
  const icon = el('img', 'voucher-map-icon');
  const iconName = mapIconName(mapProvider, {userAgent});
  icon.src = `/assets/place-actions/${iconName}.png?v=${MAP_ICON_VERSION}`;
  icon.alt = ''; icon.width = 24; icon.height = 24; icon.decoding = 'async';
  icon.dataset.mapIcon = iconName;
  link.append(icon, el('span', '', located ? `${app} 길찾기` : `${app}에서 주소로 찾기`));
  link.setAttribute('aria-label', located ? `${app}에서 ${item.name} 길찾기` : `${app}에서 ${item.name} 주소로 찾기`);
  return link;
}

// ── 가맹점 카드 ───────────────────────────────────────────────────────────

export function voucherMerchantCard(item, {mapProvider, userAgent = globalThis.navigator?.userAgent || ''}) {
  const card = el('article', 'voucher-card');
  card.dataset.voucherMerchant = item.id;
  const head = el('div', 'voucher-card-head');
  if (item.categoryLabel) head.append(el('span', 'voucher-card-category', item.categoryLabel));
  if (item.businessStatus === 'SUSPENDED') head.append(el('span', 'voucher-card-status', '휴업 중(공식 자료)'));
  if (item.distanceMeters !== null) head.append(el('span', 'voucher-card-distance', formatDistanceMeters(item.distanceMeters)));
  if (head.children.length) card.append(head);
  const title = el('h4', 'voucher-card-title', item.name);
  title.title = item.name;
  card.append(title);
  if (item.categoryDetail) card.append(el('p', 'voucher-card-meta', item.categoryDetail));
  if (item.address) card.append(el('p', 'voucher-card-address', item.address));
  if (item.regionOnly) card.append(el('p', 'voucher-card-basis', '상세 위치는 확인되지 않았어요. 지역까지만 확인된 정보예요.'));
  else if (item.latitude === null) card.append(el('p', 'voucher-card-basis', '좌표가 확인되지 않아 주소로만 안내해요.'));

  const accepts = el('ul', 'voucher-accepts');
  accepts.setAttribute('aria-label', '등록된 상품권');
  for (const accept of item.accepts) {
    const row = el('li', 'voucher-accept');
    row.dataset.schemeId = accept.schemeId;
    const name = el('span', 'voucher-accept-name', accept.schemeName);
    row.append(name);
    const payments = paymentLabel(accept.payments);
    if (payments) row.append(el('span', 'voucher-accept-payment', payments));
    const source = el('span', 'voucher-accept-source', accept.sourceLabel);
    source.dataset.sourceKind = accept.sourceKind;
    row.append(source);
    if (accept.lastVerifiedOn) row.append(el('span', 'voucher-accept-date', `마지막 확인 ${accept.lastVerifiedOn}`));
    accepts.append(row);
  }
  card.append(accepts);

  const actions = el('div', 'voucher-card-actions');
  if (item.phone) {
    const call = el('a', 'consumer-action consumer-action-secondary voucher-card-phone', `전화 ${item.phone}`);
    call.href = `tel:${item.phoneDigits}`;
    call.setAttribute('aria-label', `${item.name}에 전화 걸기 ${item.phone}`);
    actions.append(call);
  }
  const map = voucherMapAction(item, {mapProvider, userAgent});
  if (map) actions.append(map);
  if (actions.children.length) card.append(actions);
  return card;
}

function schemeChip(scheme) {
  const chip = button('', 'voucher-scheme');
  chip.dataset.voucherScheme = scheme.id;
  chip.setAttribute('aria-pressed', 'false');
  const top = el('span', 'voucher-scheme-top');
  top.append(el('strong', 'voucher-scheme-name', scheme.name));
  if (scheme.issuerLevel) {
    const badge = el('span', 'voucher-scheme-level', ISSUER_LEVEL_LABELS[scheme.issuerLevel]);
    badge.dataset.issuerLevel = scheme.issuerLevel;
    top.append(badge);
  }
  chip.append(top);
  const meta = [scheme.issuer ? `발행 ${scheme.issuer}` : '', paymentLabel(scheme.payments)].filter(Boolean).join(' · ');
  if (meta) chip.append(el('span', 'voucher-scheme-meta', meta));
  if (scheme.usageAreaNote) chip.append(el('span', 'voucher-scheme-area', scheme.usageAreaNote));
  return chip;
}

// ── 지역화폐 화면 ─────────────────────────────────────────────────────────

export async function mountLocalVoucherMerchants({
  root, fetchImpl = globalThis.fetch, documentRef = document, windowRef = globalThis.window,
  resolveCurrent = resolveSharedBrowserCurrentLocation, locationUsageEnabled = isLocationUsageEnabled,
  permissionState = getBrowserLocationPermissionState,
} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  const regionTokens = {sigungu: 0, dong: 0, schemes: 0};
  const state = {
    sido: '', sigungu: '', dong: '', schemes: [], scheme: null, q: '', category: '', payment: '',
    nearby: false, location: null, offset: 0, items: [], result: null, sigunguLevel: true,
  };
  let preference = readMapPreference(documentRef.cookie || '');

  root.classList.add('voucher-surface');
  const intro = el('div', 'voucher-intro');
  intro.append(el('strong', 'voucher-intro-title', '지역화폐(지역사랑상품권) 가맹점 찾기'));
  const notice = el('p', 'consumer-feature-note voucher-notice', VOUCHER_DEFAULT_NOTICE);
  notice.setAttribute('data-voucher-notice', '');
  intro.append(notice, el('p', 'consumer-feature-note voucher-not-partner', VOUCHER_NOT_PARTNER));

  const regionRow = el('div', 'voucher-region-row');
  const selects = {}; const fields = {};
  for (const [key, labelText] of [['sido', '광역시·도'], ['sigungu', '시·군·구'], ['dong', '읍·면·동']]) {
    const label = el('label', 'consumer-life-field voucher-region-field', labelText);
    const select = el('select'); select.dataset.voucherRegion = key; select.setAttribute('aria-label', labelText);
    select.append(new Option(key === 'sido' ? '선택해 주세요' : key === 'sigungu' ? '선택해 주세요' : '전체', ''));
    label.append(select); regionRow.append(label); selects[key] = select; fields[key] = label;
    if (key !== 'sido') label.hidden = true;
  }
  const regionNote = el('p', 'consumer-feature-note voucher-region-note'); regionNote.setAttribute('role', 'status');

  const schemeBox = el('section', 'voucher-schemes'); schemeBox.hidden = true;
  schemeBox.setAttribute('aria-label', '이 지역에서 쓰는 지역화폐');
  const schemeTitle = el('p', 'voucher-schemes-title', '이 지역에서 쓰는 지역화폐');
  const schemeList = el('div', 'voucher-scheme-list'); schemeList.setAttribute('role', 'group'); schemeList.setAttribute('aria-label', '지역화폐 고르기');
  const schemeNote = el('p', 'consumer-feature-note voucher-schemes-note'); schemeNote.setAttribute('role', 'status');
  const catalogNote = el('p', 'consumer-feature-note voucher-catalog');
  schemeBox.append(schemeTitle, schemeList, schemeNote, catalogNote);

  const filters = el('section', 'voucher-filters'); filters.hidden = true; filters.setAttribute('aria-label', '가맹점 조건');
  const searchForm = el('form', 'voucher-search'); searchForm.setAttribute('role', 'search');
  const searchLabel = el('label', 'voucher-search-label', '가맹점 이름');
  const searchInput = el('input', 'voucher-search-input'); searchInput.type = 'search'; searchInput.maxLength = 40;
  searchInput.placeholder = '가게 이름으로 찾기'; searchInput.autocomplete = 'off'; searchInput.dataset.voucherQuery = '';
  searchLabel.append(searchInput);
  const searchButton = button('찾기', 'consumer-action voucher-search-button'); searchButton.type = 'submit';
  searchForm.append(searchLabel, searchButton);

  const chipGroup = (items, key, labelText) => {
    const wrap = el('div', 'voucher-chip-group');
    wrap.append(el('span', 'voucher-chip-label', labelText));
    const row = el('div', 'festival-chip-row voucher-chip-row');
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', labelText);
    for (const [value, chipLabel] of items) {
      const chip = button(chipLabel, 'festival-chip'); chip.dataset.voucherFilter = key; chip.dataset.value = value;
      chip.setAttribute('aria-pressed', String(state[key] === value));
      chip.addEventListener('click', () => {
        if (state[key] === value) return;
        state[key] = value;
        for (const other of row.children) other.setAttribute('aria-pressed', String(other.dataset.value === value));
        void search({reset: true});
      });
      row.append(chip);
    }
    wrap.append(row);
    return wrap;
  };
  const categoryRow = chipGroup(VOUCHER_CATEGORIES, 'category', '업종');
  const paymentRow = chipGroup(VOUCHER_PAYMENTS, 'payment', '결제유형');
  const nearbyRow = el('div', 'voucher-nearby-row'); nearbyRow.hidden = true;
  const nearbyButton = button('내 위치 가까운 순', 'festival-chip voucher-nearby');
  nearbyButton.setAttribute('aria-pressed', 'false');
  const nearbyNote = el('p', 'consumer-feature-note voucher-nearby-note'); nearbyNote.setAttribute('role', 'status');
  nearbyRow.append(nearbyButton, nearbyNote);
  filters.append(searchForm, categoryRow, paymentRow, nearbyRow);

  const scopeLine = el('p', 'voucher-scope');
  const status = el('p', 'voucher-status'); status.setAttribute('role', 'status');
  const emptyBox = el('div', 'voucher-empty'); emptyBox.hidden = true;
  const error = el('div', 'voucher-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const appNote = el('p', 'consumer-feature-note voucher-map-app');
  const list = el('div', 'voucher-results');
  const more = button('더 보기', 'consumer-action consumer-action-secondary voucher-more'); more.hidden = true;

  root.replaceChildren(intro, regionRow, regionNote, schemeBox, filters, scopeLine, status, emptyBox, error, appNote, list, more);

  function paintAppNote() {
    appNote.replaceChildren(mapPreferenceNote(preference));
    if (preference.state !== 'SAVED') {
      const link = el('a', '', ' 지도앱 설정'); link.href = VOUCHER_MAP_SETTINGS_URL; link.rel = 'noopener';
      appNote.append(link);
    }
  }

  function clearResults() {
    controller?.abort(); requestToken += 1;
    state.items = []; state.offset = 0; state.result = null;
    list.replaceChildren(); more.hidden = true; status.textContent = ''; scopeLine.textContent = '';
    emptyBox.replaceChildren(); emptyBox.hidden = true; error.hidden = true;
  }

  function scopeText() {
    const where = [state.sido, state.sigungu, state.dong].filter(Boolean).join(' ');
    const parts = [state.scheme?.name, where].filter(Boolean);
    if (state.nearby && state.location) parts.push('가까운 순');
    return parts.join(' · ');
  }

  function renderCards() {
    list.replaceChildren(...state.items.map(item => voucherMerchantCard(item, {mapProvider: preference.provider})));
  }

  function showEmpty(result) {
    emptyBox.replaceChildren();
    if (result.emptyReason === 'NO_DATA_REGISTERED' || (!result.emptyReason && !state.q && !state.category && !state.payment && !state.nearby)) {
      emptyBox.dataset.emptyReason = 'NO_DATA_REGISTERED';
      emptyBox.append(el('p', 'voucher-empty-title', VOUCHER_NO_DATA_TEXT), el('p', 'consumer-feature-note', VOUCHER_NO_DATA_NOTE));
      const official = result.officialMerchantSearchUrl || state.scheme?.officialMerchantSearchUrl || state.scheme?.officialUrl || '';
      if (official) {
        const link = externalLink(`${state.scheme?.name || '지역화폐'} 공식 가맹점 조회 페이지`, official, 'consumer-action consumer-action-secondary voucher-official-link');
        link.dataset.voucherOfficial = '';
        emptyBox.append(link);
      }
    } else if (result.emptyReason === 'NO_LOCATED_NEARBY') {
      emptyBox.dataset.emptyReason = 'NO_LOCATED_NEARBY';
      emptyBox.append(el('p', 'voucher-empty-title', '가까운 곳에서 위치가 확인된 가맹점을 찾지 못했어요.'),
        el('p', 'consumer-feature-note', '주소만 등록된 가맹점은 거리 순서에서 빠져요. 가까운 순을 끄고 지역 목록으로 확인해 주세요.'));
      const off = button('가까운 순 끄기'); off.addEventListener('click', () => setNearby(false));
      emptyBox.append(off);
    } else {
      emptyBox.dataset.emptyReason = 'NO_MATCH';
      emptyBox.append(el('p', 'voucher-empty-title', '고른 조건에 맞는 가맹점을 찾지 못했어요.'),
        el('p', 'consumer-feature-note', '등록된 가맹점 정보는 있지만 이름·업종·결제유형 조건과 맞는 곳이 없어요. 조건을 바꿔 다시 찾아 주세요.'));
    }
    emptyBox.hidden = false;
  }

  async function search({reset = false} = {}) {
    if (disposed || !state.scheme) return;
    if (reset) { state.offset = 0; state.items = []; list.replaceChildren(); }
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    scopeLine.textContent = scopeText();
    status.textContent = '찾는 중…'; error.hidden = true; more.hidden = true; emptyBox.hidden = true;
    const useLocation = state.nearby && state.location;
    const response = await getJson(voucherMerchantsUrl({
      schemeId: state.scheme.id, sido: state.sido, sigungu: state.sigungu, dong: state.dong,
      q: state.q, category: state.category, payment: state.payment,
      ...(useLocation ? state.location : {}), limit: VOUCHER_PAGE_SIZE, offset: state.offset,
    }), {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return;
    const result = response.ok ? normalizeVoucherSearch(response.data) : null;
    if (!result) {
      status.textContent = '';
      error.replaceChildren(el('span', '', response.status === 429
        ? '요청이 많아 잠시 쉬고 있어요. 잠시 후 다시 시도해 주세요.'
        : '지역화폐 가맹점 정보를 불러오지 못했어요.'));
      const retry = button('다시 시도'); retry.addEventListener('click', () => void search({reset: state.items.length === 0}));
      error.append(retry); error.hidden = false;
      return;
    }
    state.result = result;
    notice.textContent = result.notice;
    const known = new Set(state.items.map(item => item.id));
    const fresh = result.items.filter(item => !known.has(item.id));
    state.items.push(...fresh);
    renderCards();
    state.offset = result.offset + Math.max(result.items.length, 0);
    if (!result.items.length && result.hasMore) state.offset = result.offset + result.limit;
    more.hidden = !result.hasMore;
    if (!state.items.length) {
      status.textContent = '';
      showEmpty(result);
    } else {
      status.textContent = `등록된 가맹점 ${won(result.totalCount)}곳 중 ${state.items.length}곳을 보여 드려요.`
        + (useLocation ? ' 위치가 확인된 곳만 가까운 순으로 보여 드려요.' : '');
    }
  }

  async function loadRegions(level) {
    const target = selects[level];
    const token = level === 'sido' ? 0 : ++regionTokens[level];
    target.replaceChildren(new Option(level === 'dong' ? '전체' : '선택해 주세요', ''));
    if (level !== 'sido') fields[level].hidden = true;
    const response = await getJson(voucherRegionsUrl({
      sido: level === 'sido' ? '' : state.sido,
      sigungu: level === 'dong' ? state.sigungu : '',
      level: level === 'dong' ? 'DONG' : '',
    }), {fetchImpl});
    if (disposed || (level !== 'sido' && token !== regionTokens[level])) return null;
    const regions = response.ok ? normalizeVoucherRegions(response.data) : null;
    if (!regions) {
      if (level !== 'dong') regionNote.textContent = '지역 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.';
      return null;
    }
    for (const region of regions.items) target.append(new Option(region.name, region.name));
    if (level !== 'sido') fields[level].hidden = target.options.length <= 1;
    return regions;
  }

  async function loadSchemes() {
    const token = ++regionTokens.schemes;
    schemeList.replaceChildren(); schemeNote.textContent = '불러오는 중…'; catalogNote.replaceChildren();
    schemeBox.hidden = false; filters.hidden = true; state.scheme = null; clearResults();
    const response = await getJson(voucherSchemesUrl({sido: state.sido, sigungu: state.sigungu}), {fetchImpl});
    if (disposed || token !== regionTokens.schemes) return;
    const result = response.ok ? normalizeVoucherSchemes(response.data) : null;
    if (!result) {
      schemeNote.textContent = '지역화폐 목록을 불러오지 못했어요. 지역을 다시 골라 주세요.';
      return;
    }
    state.schemes = result.items;
    const where = [state.sido, state.sigungu].filter(Boolean).join(' ');
    if (!result.items.length) {
      schemeNote.textContent = result.emptyReason === 'REGION_REQUIRED'
        ? '시·군·구까지 골라 주세요.'
        : `${where}에서 쓰는 지역사랑상품권이 공식 목록에 등록돼 있지 않아요.`;
    } else {
      schemeNote.textContent = result.items.length > 1
        ? `${where}에서는 ${result.items.length}가지 지역화폐를 쓸 수 있다고 공식 목록에 나와 있어요. 하나를 골라 가맹점을 찾아 주세요.`
        : '지역화폐를 골라 가맹점을 찾아 주세요.';
      for (const scheme of result.items) {
        const chip = schemeChip(scheme);
        chip.addEventListener('click', () => chooseScheme(scheme.id));
        schemeList.append(chip);
      }
    }
    if (result.sources.length) {
      catalogNote.append(`상품권 목록 출처${result.checkedOn ? `(${result.checkedOn} 확인)` : ''}: `);
      result.sources.forEach((source, index) => {
        if (index) catalogNote.append(' · ');
        catalogNote.append(source.url ? externalLink(source.label, source.url) : source.label);
      });
    }
    if (result.items.length === 1) chooseScheme(result.items[0].id);
  }

  function chooseScheme(id) {
    const scheme = state.schemes.find(item => item.id === id);
    if (!scheme) return;
    state.scheme = scheme;
    for (const chip of schemeList.children) chip.setAttribute('aria-pressed', String(chip.dataset.voucherScheme === id));
    filters.hidden = false;
    void search({reset: true});
  }

  async function setNearby(on) {
    nearbyNote.replaceChildren();
    if (!on) {
      state.nearby = false; state.location = null;
      nearbyButton.setAttribute('aria-pressed', 'false');
      if (state.scheme) void search({reset: true});
      return;
    }
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    let granted = false;
    try { granted = enabled && (await permissionState()) === LOCATION_PERMISSION.GRANTED; } catch { granted = false; }
    if (disposed) return;
    if (!granted) {
      // Never asked from here: only an already-allowed location is used.
      nearbyRow.hidden = true; state.nearby = false; state.location = null;
      return;
    }
    nearbyButton.disabled = true;
    nearbyNote.textContent = '현재 위치를 확인하고 있어요…';
    let location = null;
    try {
      const outcome = await resolveCurrent({allowPrompt: false});
      const latitude = Number(outcome?.location?.latitude);
      const longitude = Number(outcome?.location?.longitude);
      if (inKorea(latitude, longitude)) location = {latitude, longitude};
    } catch {
      location = null;
    } finally {
      nearbyButton.disabled = false;
    }
    if (disposed) return;
    if (!location) {
      nearbyNote.textContent = '현재 위치를 확인하지 못해 지역 목록으로 보여 드려요.';
      state.nearby = false; state.location = null; nearbyButton.setAttribute('aria-pressed', 'false');
      return;
    }
    state.nearby = true; state.location = location;
    nearbyButton.setAttribute('aria-pressed', 'true');
    nearbyNote.textContent = '현재 위치는 이번 검색에만 쓰고 저장하지 않아요.';
    if (state.scheme) void search({reset: true});
  }

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

  selects.sido.addEventListener('change', async () => {
    state.sido = selects.sido.value; state.sigungu = ''; state.dong = ''; state.schemes = []; state.scheme = null;
    regionNote.textContent = '';
    for (const key of ['sigungu', 'dong']) { selects[key].replaceChildren(new Option(key === 'dong' ? '전체' : '선택해 주세요', '')); fields[key].hidden = true; }
    schemeBox.hidden = true; filters.hidden = true; clearResults();
    if (!state.sido) return;
    const cities = await loadRegions('sigungu');
    if (disposed || !cities || selects.sido.value !== state.sido) return;
    state.sigunguLevel = cities.items.length > 0;
    // A 시·도 without 시·군·구 (세종): its vouchers are read at the 시·도 level.
    if (!state.sigunguLevel) await loadSchemes();
  });
  selects.sigungu.addEventListener('change', () => {
    state.sigungu = selects.sigungu.value; state.dong = '';
    selects.dong.replaceChildren(new Option('전체', '')); fields.dong.hidden = true;
    if (!state.sigungu) { schemeBox.hidden = true; filters.hidden = true; clearResults(); return; }
    void loadRegions('dong');
    void loadSchemes();
  });
  selects.dong.addEventListener('change', () => { state.dong = selects.dong.value; void search({reset: true}); });
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    state.q = searchInput.value.trim().slice(0, 40);
    void search({reset: true});
  });
  nearbyButton.addEventListener('click', () => void setNearby(!state.nearby));
  more.addEventListener('click', () => void search());

  paintAppNote();
  await loadRegions('sido');
  // 가까운 순 is offered only when location is already allowed; nothing is asked.
  let allowed = false;
  try { allowed = locationUsageEnabled() === true && (await permissionState()) === LOCATION_PERMISSION.GRANTED; } catch { allowed = false; }
  if (!disposed) nearbyRow.hidden = !allowed;
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

// ── 통합 화면: [온누리상품권] [지역화폐] ───────────────────────────────────

export async function mountVoucherHub({
  root, documentRef = document, mountOnnuri = mountOnnuriMerchants, mountLocal = mountLocalVoucherMerchants, ...options
} = {}) {
  let disposed = false;
  let active = '';
  const mounted = {};
  root.classList.add('voucher-hub');
  const tablist = el('div', 'voucher-tabs');
  tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', '상품권 종류');
  const tabs = {}; const panels = {};
  const prefix = `voucher-hub-${Math.random().toString(36).slice(2, 8)}`;
  for (const [key, label] of VOUCHER_TABS) {
    const tab = button(label, 'voucher-tab');
    tab.id = `${prefix}-tab-${key}`; tab.dataset.voucherTab = key;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${prefix}-panel-${key}`);
    const panel = el('div', 'voucher-tabpanel');
    panel.id = `${prefix}-panel-${key}`; panel.dataset.voucherPanel = key;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id); panel.tabIndex = 0;
    panel.hidden = true;
    tablist.append(tab); tabs[key] = tab; panels[key] = panel;
  }
  root.replaceChildren(tablist, ...Object.values(panels));

  async function activate(key, {focus = false} = {}) {
    if (disposed || !tabs[key]) return;
    active = key;
    root.dataset.voucherActiveTab = key;
    for (const [name, tab] of Object.entries(tabs)) {
      const on = name === key;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-active', on);
      panels[name].hidden = !on;
    }
    if (focus) tabs[key].focus();
    // Each tab mounts once and keeps its state while the modal stays open.
    if (!mounted[key]) {
      mounted[key] = {pending: true};
      const host = el('div', key === 'onnuri' ? 'voucher-onnuri-host' : 'voucher-local-host');
      panels[key].replaceChildren(host);
      try {
        const result = key === 'onnuri'
          ? await mountOnnuri({root: host, documentRef, ...options})
          : await mountLocal({root: host, documentRef, ...options});
        if (disposed) { result?.dispose?.(); return; }
        mounted[key] = result || {};
      } catch {
        if (disposed) return;
        host.replaceChildren(el('p', key === 'onnuri' ? 'onnuri-error' : 'voucher-error',
          key === 'onnuri' ? '온누리상품권 가맹점 화면을 열지 못했습니다.' : '지역화폐 가맹점 화면을 열지 못했습니다.'));
        mounted[key] = {};
      }
    }
  }

  for (const [key, tab] of Object.entries(tabs)) {
    tab.addEventListener('click', () => { if (active !== key) void activate(key); });
    tab.addEventListener('keydown', event => {
      const keys = VOUCHER_TABS.map(([name]) => name);
      const index = keys.indexOf(key);
      let next = '';
      if (event.key === 'ArrowRight') next = keys[(index + 1) % keys.length];
      else if (event.key === 'ArrowLeft') next = keys[(index - 1 + keys.length) % keys.length];
      else if (event.key === 'Home') next = keys[0];
      else if (event.key === 'End') next = keys[keys.length - 1];
      if (!next) return;
      event.preventDefault();
      void activate(next, {focus: true});
    });
  }

  await activate('onnuri');
  return {
    dispose() {
      disposed = true;
      for (const value of Object.values(mounted)) value?.dispose?.();
    },
    get activeTab() { return active; },
    activate,
  };
}
