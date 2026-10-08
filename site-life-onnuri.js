// ONNURI-MERCHANT-01 — 생활정보 '온누리상품권' 가맹점 찾기.
//
// Reads only Core's public, guest-safe GET /v2/life/onnuri/merchants|regions
// (the PUBLISHED copy of 소상공인시장진흥공단 「전국 온누리상품권 가맹점 현황」).
// No credentials, nothing stored. The current location is asked for only when
// the user presses "현재 위치로 찾기", goes through the shared location layer
// and is sent for that one request; without it the screen falls back to
// 시·도 / 시·군·구 / 동 selection and never shows a made-up distance.
//
// Brand: the official 온누리상품권 logo is NOT used until its use is approved.
// The slot below is reserved for it and renders nothing; labels are plain text.
// LOTBI is not presented as an official/partner service of the issuer.
import {CORE_ORIGIN} from './site-core.js?v=aset-59bd0e16056a';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-59bd0e16056a';
import {isLocationUsageEnabled, readDefaultMapProvider} from './site-location-preference.js?v=aset-59bd0e16056a';
import {buildDefaultMapHref, defaultMapProviderPresentation, formatDistanceMeters} from './site-navigation.js?v=aset-59bd0e16056a';

export const ONNURI_MENU_LABEL = '온누리상품권';
export const ONNURI_CARD_LABEL = '온누리 가맹점';
export const ONNURI_PAGE_SIZE = 3;
export const ONNURI_CATEGORIES = Object.freeze([
  ['', '전체'], ['FOOD', '식당'], ['CAFE', '카페·간식'], ['GROCERY', '장보기'], ['CLOTHING', '의류·잡화'], ['LIVING', '생활'],
]);
export const ONNURI_ACCEPTS = Object.freeze([['', '전체'], ['PAPER', '지류형'], ['DIGITAL', '디지털형(모바일·카드)']]);
export const ONNURI_DISCLAIMER = '공공데이터에 등록된 가맹점 정보를 보여 드려요. 실시간 결제 가능 여부는 아니니 방문 전 가맹점에 확인해 주세요. '
  + 'LOTBI는 공공데이터를 안내할 뿐, 온누리상품권 발행기관의 공식·제휴 서비스가 아니에요.';
export const ONNURI_DIGITAL_NOTE = '2025년 3월부터 모바일·카드형이 디지털 온누리로 통합돼, 공식 자료는 모바일과 카드를 따로 구분하지 않아요.';
export const ONNURI_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
// Reserved for the approved official logo file. Empty until approval: no
// image, no emoji, no look-alike icon is drawn in its place.
export const ONNURI_LOGO_ASSET = '';

const TIMEOUT_MS = 12_000;
const text = value => (typeof value === 'string' ? value.trim() : '');
const bool = value => (value === true ? true : value === false ? false : null);

function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 131;
}

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
  const verified = value.geo_state === 'VERIFIED' && inKorea(latitude, longitude);
  const distance = typeof value.distance_meters === 'number' ? value.distance_meters : Number.NaN;
  return Object.freeze({
    id,
    name,
    address,
    marketName: text(value.market_name),
    items: text(value.items),
    paper: bool(value.paper),
    digital: bool(value.digital),
    latitude: verified ? latitude : null,
    longitude: verified ? longitude : null,
    // A distance only for a verified coordinate; never computed here.
    distanceMeters: verified && Number.isInteger(distance) && distance >= 0 && distance <= 300000 ? distance : null,
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
  return Object.freeze({
    availability: value.availability === 'AVAILABLE' ? 'AVAILABLE' : 'NOT_READY',
    mode: text(value.mode),
    items,
    totalCount: Number.isInteger(value.total_count) ? value.total_count : items.length,
    hasMore: value.has_more === true,
    nextOffset: Number.isInteger(value.next_offset) ? value.next_offset : null,
    sourceDate: /^\d{4}-\d{2}-\d{2}$/u.test(text(source.source_date)) ? text(source.source_date) : '',
    syncedAt: text(source.synced_at).slice(0, 16).replace('T', ' '),
    sourceLabel: text(source.label) || '소상공인시장진흥공단 전국 온누리상품권 가맹점 현황',
  });
}

export function onnuriSearchUrl({latitude, longitude, sido = '', sigungu = '', dong = '', category = '', accept = '', limit = ONNURI_PAGE_SIZE, offset = 0} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (inKorea(Number(latitude), Number(longitude))) {
    params.set('latitude', String(Math.round(Number(latitude) * 1000) / 1000));
    params.set('longitude', String(Math.round(Number(longitude) * 1000) / 1000));
  } else {
    if (text(sido)) params.set('sido', text(sido));
    if (text(sigungu)) params.set('sigungu', text(sigungu));
    if (text(dong)) params.set('dong', text(dong));
  }
  if (category) params.set('category', category);
  if (accept) params.set('accept', accept);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return `${origin}/v2/life/onnuri/merchants?${params}`;
}

export function onnuriRegionsUrl({sido = '', sigungu = ''} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (text(sido)) params.set('sido', text(sido));
  if (text(sido) && text(sigungu)) params.set('sigungu', text(sigungu));
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

function merchantCard(item, {mapProvider}) {
  const card = el('article', 'onnuri-card');
  card.dataset.onnuriMerchant = item.id;
  const head = el('div', 'onnuri-card-head');
  const label = el('span', 'onnuri-card-label', ONNURI_CARD_LABEL);
  label.prepend(createOnnuriLogoSlot());
  head.append(label);
  const distance = item.distanceMeters !== null ? formatDistanceMeters(item.distanceMeters) : '';
  if (distance) head.append(el('span', 'onnuri-card-distance', distance));
  const title = el('h4', 'onnuri-card-title', item.name);
  const meta = el('p', 'onnuri-card-meta', [item.marketName, item.items].filter(Boolean).join(' · '));
  const address = el('p', 'onnuri-card-address', item.address);
  const accept = el('p', 'onnuri-card-accept', acceptanceLabel(item));
  card.append(head, title);
  if (meta.textContent) card.append(meta);
  card.append(address, accept);
  const place = {
    name: item.name, address: item.address, placeId: `onnuri:${item.id}`,
    latitude: item.latitude, longitude: item.longitude,
    coordinateSystem: item.latitude !== null ? 'WGS84' : '', coordinateAuthority: item.latitude !== null ? 'NAVER_MAPS_GEOCODING' : '',
    navigationCapable: item.latitude !== null,
  };
  try {
    const href = buildDefaultMapHref(mapProvider, place);
    const presentation = defaultMapProviderPresentation(mapProvider);
    const link = el('a', 'consumer-action consumer-action-secondary onnuri-card-map', item.latitude !== null ? '길찾기' : '지도에서 찾기');
    link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${presentation?.label || '지도'}에서 ${item.name} ${item.latitude !== null ? '길찾기' : '찾기'}`);
    card.append(link);
  } catch {
    // No map link rather than a wrong one.
  }
  return card;
}

export async function mountOnnuriMerchants({root, fetchImpl = globalThis.fetch, documentRef = document, resolveCurrent = resolveSharedBrowserCurrentLocation, locationUsageEnabled = isLocationUsageEnabled, permissionState = getBrowserLocationPermissionState} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  const state = {mode: 'region', location: null, sido: '', sigungu: '', dong: '', category: '', accept: '', offset: 0, items: []};
  const mapProvider = readDefaultMapProvider(documentRef.cookie || '');

  root.classList.add('onnuri-surface');
  const intro = el('div', 'onnuri-intro');
  const brand = el('div', 'onnuri-brand');
  brand.append(createOnnuriLogoSlot(documentRef), el('strong', 'onnuri-brand-label', `${ONNURI_MENU_LABEL} 가맹점 찾기`));
  intro.append(brand, el('p', 'consumer-feature-note onnuri-disclaimer', ONNURI_DISCLAIMER));

  const locate = button('현재 위치로 찾기', 'consumer-action onnuri-locate');
  const locationNote = el('p', 'consumer-feature-note onnuri-location-note');
  locationNote.setAttribute('role', 'status');

  const regionRow = el('div', 'onnuri-region-row');
  const selects = {};
  for (const [key, labelText] of [['sido', '시·도'], ['sigungu', '시·군·구'], ['dong', '동·읍·면']]) {
    const label = el('label', 'consumer-life-field onnuri-region-field', labelText);
    const select = el('select'); select.dataset.onnuriRegion = key; select.setAttribute('aria-label', labelText);
    select.append(new Option('전체', ''));
    if (key !== 'sido') select.disabled = true;
    label.append(select); regionRow.append(label); selects[key] = select;
  }

  const chipGroup = (items, key, labelText) => {
    const row = el('div', 'festival-chip-row onnuri-chip-row');
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', labelText);
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
    return row;
  };
  const digitalNote = el('p', 'consumer-feature-note onnuri-digital-note', ONNURI_DIGITAL_NOTE);
  digitalNote.hidden = true;
  const categoryRow = chipGroup(ONNURI_CATEGORIES, 'category', '업종');
  const acceptRow = chipGroup(ONNURI_ACCEPTS, 'accept', '상품권 종류');

  const status = el('p', 'onnuri-status'); status.setAttribute('role', 'status');
  const error = el('div', 'onnuri-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const list = el('div', 'onnuri-results');
  const more = button('더 보기', 'consumer-action consumer-action-secondary onnuri-more'); more.hidden = true;
  const source = el('p', 'consumer-feature-note onnuri-source');

  root.replaceChildren(intro, locate, locationNote, regionRow, categoryRow, acceptRow, digitalNote, status, error, list, more, source);

  async function loadRegions(level) {
    const target = level === 'sido' ? selects.sido : level === 'sigungu' ? selects.sigungu : selects.dong;
    target.replaceChildren(new Option('전체', ''));
    const response = await getJson(onnuriRegionsUrl({sido: level === 'sido' ? '' : state.sido, sigungu: level === 'dong' ? state.sigungu : ''}), {fetchImpl});
    if (disposed || !response.ok || !Array.isArray(response.data?.regions)) { target.disabled = level !== 'sido'; return; }
    for (const region of response.data.regions) {
      const name = text(region?.name);
      if (name) target.append(new Option(name, name));
    }
    target.disabled = target.options.length <= 1 && level !== 'sido';
  }

  async function search({reset = false} = {}) {
    if (disposed) return;
    if (reset) { state.offset = 0; state.items = []; list.replaceChildren(); }
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    status.textContent = '찾는 중…'; error.hidden = true; more.hidden = true;
    const useLocation = state.mode === 'location' && state.location;
    const response = await getJson(onnuriSearchUrl({
      ...(useLocation ? state.location : {sido: state.sido, sigungu: state.sigungu, dong: state.dong}),
      category: state.category, accept: state.accept, limit: ONNURI_PAGE_SIZE, offset: state.offset,
    }), {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return;
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
    const known = new Set(state.items.map(item => item.id));
    const fresh = result.items.filter(item => !known.has(item.id));
    state.items.push(...fresh);
    for (const item of fresh) list.append(merchantCard(item, {mapProvider}));
    state.offset = result.nextOffset ?? state.offset + fresh.length;
    more.hidden = !result.hasMore;
    const scope = useLocation ? '현재 위치 근처' : ([state.sido, state.sigungu, state.dong].filter(Boolean).join(' ') || '전국');
    if (!state.items.length) {
      status.textContent = `${scope}에서 조건에 맞는 가맹점을 공공데이터에서 찾지 못했어요. 공공데이터에 없다고 해서 가맹점이 아니라는 뜻은 아니에요.`;
    } else {
      status.textContent = useLocation
        ? `${scope} 가맹점 ${state.items.length}곳을 가까운 순서로 보여 드려요.`
        : `${scope} 가맹점 ${result.totalCount.toLocaleString('ko-KR')}곳 중 ${state.items.length}곳을 보여 드려요. 거리는 현재 위치를 쓸 때만 표시해요.`;
    }
    source.textContent = `출처: ${result.sourceLabel}${result.sourceDate ? `(${result.sourceDate} 기준)` : ''}${result.syncedAt ? ` · LOTBI 반영 ${result.syncedAt}` : ''}`;
  }

  async function useCurrentLocation() {
    locationNote.replaceChildren();
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    if (!enabled) {
      locationNote.append('위치 사용이 꺼져 있어 지역을 골라 찾아 드려요. ');
      const link = el('a', '', '설정에서 위치 켜기'); link.href = ONNURI_SETTINGS_URL; link.rel = 'noopener';
      locationNote.append(link);
      state.mode = 'region';
      return search({reset: true});
    }
    locate.disabled = true;
    locationNote.textContent = '현재 위치를 확인하고 있어요…';
    let location = null;
    try {
      const outcome = await resolveCurrent({allowPrompt: true});
      const latitude = Number(outcome?.location?.latitude);
      const longitude = Number(outcome?.location?.longitude);
      if (inKorea(latitude, longitude)) location = {latitude, longitude};
    } catch {
      location = null;
    } finally {
      locate.disabled = false;
    }
    if (disposed) return undefined;
    if (!location) {
      state.mode = 'region'; state.location = null;
      locationNote.textContent = '현재 위치를 확인하지 못해 지역을 골라 찾아 드려요. 거리는 표시하지 않아요.';
      return search({reset: true});
    }
    state.mode = 'location'; state.location = location;
    locationNote.textContent = '현재 위치 기준으로 가까운 가맹점을 찾았어요. 위치는 이번 검색에만 쓰고 저장하지 않아요.';
    return search({reset: true});
  }

  locate.addEventListener('click', () => void useCurrentLocation());
  selects.sido.addEventListener('change', () => {
    state.mode = 'region'; state.sido = selects.sido.value; state.sigungu = ''; state.dong = '';
    selects.sigungu.replaceChildren(new Option('전체', '')); selects.dong.replaceChildren(new Option('전체', '')); selects.dong.disabled = true;
    locationNote.textContent = '';
    if (state.sido) void loadRegions('sigungu'); else selects.sigungu.disabled = true;
    void search({reset: true});
  });
  selects.sigungu.addEventListener('change', () => {
    state.mode = 'region'; state.sigungu = selects.sigungu.value; state.dong = '';
    selects.dong.replaceChildren(new Option('전체', ''));
    if (state.sigungu) void loadRegions('dong'); else selects.dong.disabled = true;
    void search({reset: true});
  });
  selects.dong.addEventListener('change', () => { state.mode = 'region'; state.dong = selects.dong.value; void search({reset: true}); });
  more.addEventListener('click', () => void search());

  await loadRegions('sido');
  // Like the festival screen: only an already-granted permission starts with
  // the current location; otherwise nothing is asked until the button is pressed.
  let granted = false;
  try { granted = locationUsageEnabled() === true && (await permissionState()) === LOCATION_PERMISSION.GRANTED; } catch { granted = false; }
  if (disposed) return {dispose() {}, state};
  if (granted) await useCurrentLocation();
  else await search({reset: true});
  return {
    dispose() { disposed = true; controller?.abort(); },
    state,
  };
}
