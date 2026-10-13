// EV-CHARGER-NEARBY-LIST-P0 — 지역정보 '전기차 충전소': 내 주변 충전소 목록.
//
// Its own screen, not a conversation: it reads only Core's public, guest-safe
// GET /v2/life/ev-chargers/nearby (한국환경공단 전기자동차 충전소 정보 via
// data.go.kr) and lists stations nearest first. Nothing is typed into the
// conversation and no AI is called.
//
// Location: the LOTBI location setting decides. With it on, the current
// position is asked for at most once on opening (the browser keeps the
// answer) and sent for that one request only — never stored. With it off, or
// when the position cannot be read, the reader picks a 시·군 (or the saved
// calendar region is used); distances are then labelled from that place's
// center, never presented as the reader's own distance.
//
// Map: the reader's saved map app (readDefaultMapProvider) decides both the
// link (buildDefaultMapHref) and the approved icon image in
// /assets/place-actions — the icon always shows the app that actually opens.
// There is no phone button on a charger card.
import {CORE_ORIGIN} from './site-core.js?v=aset-b895d2ff4742';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-b895d2ff4742';
import {isLocationUsageEnabled, readDefaultMapProvider} from './site-location-preference.js?v=aset-b895d2ff4742';
import {buildDefaultMapHref, defaultMapProviderPresentation, formatDistanceMeters} from './site-navigation.js?v=aset-b895d2ff4742';
import {readCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-b895d2ff4742';

export const EV_MENU_LABEL = '전기차 충전소';
export const EV_SCREEN_TITLE = '내 주변 전기차 충전소';
export const EV_CONTRACT_ID = 'CORE-EV-CHARGER-NEARBY-01';
export const EV_RADIUS_CHOICES = Object.freeze([1, 3, 5, 10, 20]);
export const EV_DEFAULT_RADIUS_KM = 5;
export const EV_PAGE_SIZE = 10;
export const EV_SPEED_FILTERS = Object.freeze([['all', '전체'], ['fast', '급속'], ['slow', '완속']]);
export const EV_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
export const EV_SOURCE_LABEL = '한국환경공단 전기자동차 충전소 정보(공공데이터포털)';
// The approved map-app images (also used by the place cards). Same version
// token as everywhere else they are loaded.
export const EV_MAP_ICON_BASE = '/assets/place-actions/';
export const EV_MAP_ICON_VERSION = 'place-icons-20260925';

const TIMEOUT_MS = 15_000;
const MAX_PREPARING_RETRIES = 6;
const SPEED_LABELS = Object.freeze({FAST: '급속', SLOW: '완속', UNKNOWN: '유형 확인 불가'});
const STATUS_WORDS = new Set(['AVAILABLE', 'CHARGING', 'RESERVED', 'SUSPENDED', 'MAINTENANCE', 'COMM_ERROR', 'UNKNOWN']);
const text = value => (typeof value === 'string' ? value.trim() : '');

export function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 132;
}

function count(value) {
  return Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : 0;
}

function kstTime(value) {
  const raw = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?\+09:00$/u.exec(raw);
  return match ? {date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}`} : null;
}

export function normalizeEvCharger(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.charger_id);
  if (!id || id.length > 10) return null;
  const speed = ['FAST', 'SLOW'].includes(value.speed) ? value.speed : 'UNKNOWN';
  const status = STATUS_WORDS.has(value.status) ? value.status : 'UNKNOWN';
  const output = Number.isInteger(value.output_kw) && value.output_kw > 0 && value.output_kw <= 1000 ? value.output_kw : null;
  const current = value.status_current === true && status !== 'UNKNOWN';
  return Object.freeze({
    id,
    speed,
    typeLabel: text(value.type_label) || '유형 확인 불가',
    outputKw: output,
    status,
    current,
    // A status LOTBI could not confirm recently is never shown as its old word.
    statusLabel: current ? (text(value.status_label) || '상태 확인 불가') : '현재 상태 확인 필요',
  });
}

export function normalizeEvStation(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.station_id);
  const name = text(value.name);
  if (!id || id.length > 40 || !name) return null;
  const latitude = typeof value.latitude === 'number' ? value.latitude : Number.NaN;
  const longitude = typeof value.longitude === 'number' ? value.longitude : Number.NaN;
  // A station without an official coordinate is never placed (Core drops it).
  if (!inKorea(latitude, longitude)) return null;
  const distance = Number.isInteger(value.distance_m) && value.distance_m >= 0 && value.distance_m <= 30_000 ? value.distance_m : null;
  if (distance === null) return null;
  const chargers = [];
  const seen = new Set();
  for (const raw of Array.isArray(value.chargers) ? value.chargers : []) {
    const charger = normalizeEvCharger(raw);
    if (!charger || seen.has(charger.id)) continue;          // one charger once
    seen.add(charger.id); chargers.push(charger);
  }
  if (!chargers.length) return null;
  const summary = {};
  for (const charger of chargers) {
    const bucket = summary[charger.speed] || (summary[charger.speed] = {total: 0, checked: 0, available: 0});
    bucket.total += 1;
    if (charger.current) {
      bucket.checked += 1;
      if (charger.status === 'AVAILABLE') bucket.available += 1;
    }
  }
  const floor = value.floor && typeof value.floor === 'object'
    ? [text(value.floor.type), text(value.floor.level) ? `${text(value.floor.level)}층` : ''].filter(Boolean).join(' ')
    : '';
  return Object.freeze({
    id,
    name,
    address: [text(value.address), text(value.address_detail)].filter(Boolean).join(' '),
    locationDetail: text(value.location_detail),
    latitude,
    longitude,
    distanceMeters: distance,
    useTime: text(value.use_time),
    parkingFree: value.parking_free === true ? true : value.parking_free === false ? false : null,
    limited: value.limited === true,
    limitDetail: text(value.limit_detail),
    note: text(value.note),
    floor,
    chargers,
    summary,
    statusCurrent: value.status_current === true,
    checkedAt: kstTime(value.status_checked_at),
  });
}

export function normalizeEvSearch(value) {
  if (!value || value.contract_id !== EV_CONTRACT_ID || value.schema_version !== 1) return null;
  const status = text(value.status);
  if (!['OK', 'NO_RESULTS', 'PARTIAL', 'PREPARING', 'UNAVAILABLE', 'DISABLED', 'OUT_OF_AREA'].includes(status)) return null;
  const stations = [];
  const seen = new Set();
  for (const raw of Array.isArray(value.stations) ? value.stations : []) {
    const station = normalizeEvStation(raw);
    if (!station || seen.has(station.id)) continue;           // one station once
    seen.add(station.id); stations.push(station);
  }
  const freshness = value.freshness && typeof value.freshness === 'object' ? value.freshness : {};
  const names = list => (Array.isArray(list) ? list.map(text).filter(Boolean) : []);
  return Object.freeze({
    status,
    stations,
    totalCount: count(value.total_count),
    hasMore: value.has_more === true,
    nextOffset: Number.isInteger(value.next_offset) ? value.next_offset : null,
    from: value.distance?.from === 'SELECTED_REGION' ? 'SELECTED_REGION' : 'CURRENT_LOCATION',
    reason: text(value.reason),
    statusRefreshError: text(value.status_refresh_error),
    regionsMissing: names(value.regions_missing),
    regionsLoading: names(value.regions_loading),
    retryAfterSeconds: Number.isInteger(value.retry_after_seconds) ? Math.min(Math.max(value.retry_after_seconds, 2), 30) : 5,
    infoFetchedAt: kstTime(freshness.info_fetched_at),
  });
}

export function evChargerSearchUrl({latitude, longitude, radiusKm = EV_DEFAULT_RADIUS_KM, speed = 'all', availableOnly = false, limit = EV_PAGE_SIZE, offset = 0, origin = 'current'} = {}, coreOrigin = CORE_ORIGIN) {
  if (!inKorea(Number(latitude), Number(longitude))) throw new TypeError('a location in Korea is required');
  const params = new URLSearchParams();
  // ~11 m: enough for a nearest-first list, no finer than needed.
  params.set('latitude', String(Math.round(Number(latitude) * 10_000) / 10_000));
  params.set('longitude', String(Math.round(Number(longitude) * 10_000) / 10_000));
  params.set('radius_km', String(EV_RADIUS_CHOICES.includes(radiusKm) ? radiusKm : EV_DEFAULT_RADIUS_KM));
  params.set('charging_speed', ['fast', 'slow'].includes(speed) ? speed : 'all');
  if (availableOnly) params.set('available_only', 'true');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (origin === 'region') params.set('origin', 'region');
  return `${coreOrigin}/v2/life/ev-chargers/nearby?${params}`;
}

async function getJson(url, {fetchImpl = globalThis.fetch, signal} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), {once: true});
  try {
    const response = await fetchImpl(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: {Accept: 'application/json'}, signal: controller.signal,
    });
    if (!response.ok) return {ok: false, status: response.status, data: null};
    return {ok: true, status: response.status, data: await response.json()};
  } catch {
    return {ok: false, status: 0, data: null};
  } finally {
    clearTimeout(timer);
  }
}

// "급속 3대 중 1대 사용 가능" — only what was confirmed is counted.
export function speedSummaryText(speed, bucket) {
  const label = SPEED_LABELS[speed] || SPEED_LABELS.UNKNOWN;
  if (!bucket || !bucket.total) return '';
  if (!bucket.checked) return `${label} ${bucket.total}대 · 현재 상태 확인 필요`;
  const unchecked = bucket.total - bucket.checked;
  return `${label} ${bucket.total}대 중 ${bucket.available}대 사용 가능${unchecked ? ` · ${unchecked}대 상태 확인 필요` : ''}`;
}

// Identical chargers read as one line: "DC콤보 100kW 2대 · 사용 가능 1 · 충전 중 1".
export function chargerGroupLines(chargers) {
  const groups = new Map();
  for (const charger of chargers) {
    const key = `${charger.speed}|${charger.typeLabel}|${charger.outputKw ?? ''}`;
    const group = groups.get(key) || {speed: charger.speed, typeLabel: charger.typeLabel, outputKw: charger.outputKw, total: 0, words: new Map()};
    group.total += 1;
    group.words.set(charger.statusLabel, (group.words.get(charger.statusLabel) || 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    // 급속/완속 leads the line; a charger whose speed the data does not settle
    // says so after its type instead of a misleading word in front.
    const known = group.speed === 'FAST' || group.speed === 'SLOW';
    const head = [known ? SPEED_LABELS[group.speed] : '', group.typeLabel, group.outputKw ? `${group.outputKw}kW` : '']
      .filter(Boolean).join(' ') + (known ? '' : ' (급속·완속 확인 불가)');
    const words = [...group.words.entries()].map(([word, n]) => (group.total === 1 ? word : `${word} ${n}`)).join(' · ');
    return {text: `${head}${group.total > 1 ? ` ${group.total}대` : ''} · ${words}`, available: group.words.has('사용 가능')};
  });
}

function el(tag, className = '', value = '', documentRef = document) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

// The approved image of the app that this link really opens. On a desktop the
// 티맵 choice opens 네이버지도 웹 (티맵 has no web map), so that icon is shown.
export function evMapIcon(provider, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const presentation = defaultMapProviderPresentation(provider, {userAgent});
  const desktopTmap = provider === 'TMAP' && presentation.label !== '티맵';
  return Object.freeze({
    icon: desktopTmap ? 'naver-map' : presentation.icon,
    label: desktopTmap ? '네이버지도 웹(티맵은 모바일 전용)' : presentation.label,
  });
}

// The place the shared map-link builder (buildDefaultMapHref, the one the 장소·
// 의료·온누리 cards use) is given. The official WGS84 point drives every app;
// NAVER's web search cannot find a charger by its name, so its search text is
// the point itself and NAVER resolves it to the address under it (map + pin).
export function evMapPlace(station) {
  return {
    name: station.name,
    address: station.address,
    placeId: `ev:${station.id}`,
    latitude: station.latitude,
    longitude: station.longitude,
    coordinateSystem: 'WGS84',
    coordinateAuthority: 'KECO_EV_CHARGER',
    navigationCapable: true,
    searchText: `${station.latitude.toFixed(6)},${station.longitude.toFixed(6)}`,
  };
}

export function evMapLink(station, provider, {documentRef = document, userAgent = globalThis.navigator?.userAgent || '', origin} = {}) {
  const place = evMapPlace(station);
  let href = '';
  try {
    href = buildDefaultMapHref(provider, place, {userAgent, ...(origin ? {origin} : {})});
  } catch {
    return null;                                              // no link rather than a wrong one
  }
  const {icon, label} = evMapIcon(provider, {userAgent});
  const link = el('a', 'ev-map-link', '', documentRef);
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.dataset.mapProvider = provider;
  link.dataset.mapIcon = icon;
  link.setAttribute('aria-label', `${station.name} 길찾기 (${label})`);
  link.title = `${label}에서 길찾기`;
  const image = el('img', 'ev-map-icon', '', documentRef);
  image.src = `${EV_MAP_ICON_BASE}${icon}.png?v=${EV_MAP_ICON_VERSION}`;
  image.alt = ''; image.width = 32; image.height = 32; image.decoding = 'async';
  const fallback = el('span', 'ev-map-fallback', label.split('(')[0], documentRef);
  fallback.hidden = true;
  image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }, {once: true});
  link.append(image, fallback);
  return link;
}

export function evStationItem(station, {mapProvider, documentRef = document, userAgent, origin, fromRegion = ''} = {}) {
  const item = el('li', 'ev-station', '', documentRef);
  item.dataset.evStation = station.id;
  const body = el('div', 'ev-station-body', '', documentRef);
  const head = el('div', 'ev-station-head', '', documentRef);
  head.append(el('h4', 'ev-station-name', station.name, documentRef));
  const distance = formatDistanceMeters(station.distanceMeters);
  const distanceText = fromRegion ? `${fromRegion} 중심에서 직선 ${distance}` : `직선 ${distance}`;
  head.append(el('span', 'ev-station-distance', distanceText, documentRef));
  body.append(head);
  if (station.address) body.append(el('p', 'ev-station-address', station.address, documentRef));
  const summary = el('p', 'ev-station-summary', '', documentRef);
  for (const speed of ['FAST', 'SLOW', 'UNKNOWN']) {
    const line = speedSummaryText(speed, station.summary[speed]);
    if (!line) continue;
    const badge = el('span', `ev-badge ev-badge-${speed.toLowerCase()}`, line, documentRef);
    if (station.summary[speed].available > 0) badge.dataset.evAvailable = 'true';
    if (!station.summary[speed].checked) badge.dataset.evUnchecked = 'true';
    summary.append(badge);
  }
  body.append(summary);
  const chargers = el('ul', 'ev-chargers', '', documentRef);
  chargers.setAttribute('aria-label', `${station.name} 충전기`);
  for (const line of chargerGroupLines(station.chargers)) {
    const row = el('li', 'ev-charger', line.text, documentRef);
    if (line.available) row.dataset.evAvailable = 'true';
    chargers.append(row);
  }
  body.append(chargers);
  const meta = [
    station.limited ? `이용 제한${station.limitDetail ? `: ${station.limitDetail}` : ''}` : '',
    station.useTime,
    station.parkingFree === true ? '주차 무료' : station.parkingFree === false ? '주차 유료' : '',
    station.floor,
    station.locationDetail,
    station.note,
  ].filter(Boolean).join(' · ');
  if (meta) {
    const metaNode = el('p', 'ev-station-meta', meta, documentRef);
    if (station.limited) metaNode.dataset.evLimited = 'true';
    body.append(metaNode);
  }
  body.append(el('p', 'ev-station-checked', station.statusCurrent && station.checkedAt
    ? `상태 확인 ${station.checkedAt.time}`
    : '현재 상태 확인 필요', documentRef));
  item.append(body);
  const link = evMapLink(station, mapProvider, {documentRef, userAgent, origin});
  if (link) item.append(link);
  return item;
}

function chipRow({documentRef, label, choices, current, attribute, onPick}) {
  const row = el('div', 'festival-chip-row ev-chip-row', '', documentRef);
  row.setAttribute('role', 'group'); row.setAttribute('aria-label', label);
  for (const [value, chipLabel] of choices) {
    const chip = el('button', 'festival-chip', chipLabel, documentRef);
    chip.type = 'button';
    chip.dataset[attribute] = String(value);
    chip.setAttribute('aria-pressed', String(current() === value));
    chip.addEventListener('click', () => {
      onPick(value);
      for (const other of row.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other.dataset[attribute] === String(value)));
    });
    row.append(chip);
  }
  return row;
}

export async function mountEvChargers({
  root,
  fetchImpl = globalThis.fetch,
  documentRef = document,
  storage = globalThis.localStorage,
  resolveCurrent = resolveSharedBrowserCurrentLocation,
  locationUsageEnabled = isLocationUsageEnabled,
  permissionState = getBrowserLocationPermissionState,
  userAgent = globalThis.navigator?.userAgent || '',
  origin,
  showTitle = true,
  // A tap on the card may ask once; a reload or back/forward never asks.
  askLocationOnOpen = true,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = id => globalThis.clearTimeout(id),
} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  let retryTimer = null;
  let preparingRetries = 0;
  let regionCatalog = null;
  const state = {
    mode: 'none',                 // 'location' | 'region' | 'none'
    location: null,               // memory only, this screen only
    region: null,                 // {label, latitude, longitude}
    radiusKm: EV_DEFAULT_RADIUS_KM,
    speed: 'all',
    availableOnly: false,
    offset: 0,
    stations: [],
    requests: 0,
  };
  const mapProvider = readDefaultMapProvider(documentRef.cookie || '');

  root.classList.add('ev-surface');
  const title = el('h3', 'ev-title', EV_SCREEN_TITLE, documentRef); title.tabIndex = -1;
  const basis = el('p', 'ev-basis', '', documentRef);
  const locate = el('button', 'consumer-action ev-locate', '현재 위치로 찾기', documentRef); locate.type = 'button';
  const locationNote = el('p', 'consumer-feature-note ev-location-note', '', documentRef);
  locationNote.setAttribute('role', 'status');
  const regionRow = el('div', 'ev-region-row', '', documentRef);
  const provinceSelect = el('select', '', '', documentRef);
  provinceSelect.dataset.evRegion = 'province'; provinceSelect.setAttribute('aria-label', '시·도');
  const citySelect = el('select', '', '', documentRef);
  citySelect.dataset.evRegion = 'city'; citySelect.setAttribute('aria-label', '시·군'); citySelect.disabled = true;
  for (const [select, labelText] of [[provinceSelect, '시·도'], [citySelect, '시·군']]) {
    const label = el('label', 'consumer-life-field ev-region-field', labelText, documentRef);
    label.append(select); regionRow.append(label);
  }
  regionRow.hidden = true;
  const speedRow = chipRow({
    documentRef, label: '충전 속도', choices: EV_SPEED_FILTERS, current: () => state.speed, attribute: 'evSpeed',
    onPick: value => { state.speed = value; void search({reset: true}); },
  });
  const available = el('button', 'festival-chip ev-available-chip', '충전 가능', documentRef);
  available.type = 'button'; available.dataset.evAvailableOnly = 'true'; available.setAttribute('aria-pressed', 'false');
  available.addEventListener('click', () => {
    state.availableOnly = !state.availableOnly;
    available.setAttribute('aria-pressed', String(state.availableOnly));
    void search({reset: true});
  });
  speedRow.append(available);
  const radiusRow = chipRow({
    documentRef, label: '검색 반경', choices: EV_RADIUS_CHOICES.map(km => [km, `${km}km`]), current: () => state.radiusKm,
    attribute: 'evRadius', onPick: value => { state.radiusKm = value; void search({reset: true}); },
  });
  const status = el('p', 'ev-status', '', documentRef); status.setAttribute('role', 'status');
  const notice = el('p', 'consumer-feature-note ev-notice', '', documentRef); notice.hidden = true;
  const error = el('div', 'ev-error', '', documentRef); error.setAttribute('role', 'alert'); error.hidden = true;
  const list = el('ol', 'ev-results', '', documentRef);
  list.setAttribute('aria-label', '가까운 충전소');
  const more = el('button', 'consumer-action consumer-action-secondary ev-more', '더 보기', documentRef);
  more.type = 'button'; more.hidden = true;
  const source = el('p', 'consumer-feature-note ev-source', '', documentRef);
  root.replaceChildren(...(showTitle ? [title] : []), basis, locate, locationNote, regionRow, speedRow, radiusRow, status, notice, error, list, more, source);

  const regionLabel = () => (state.mode === 'region' && state.region ? state.region.label : '');

  function renderBasis() {
    const where = state.mode === 'location' ? '현재 위치 기준' : state.region ? `${state.region.label} 중심 기준` : '위치를 정하면';
    basis.textContent = `${where} · 반경 ${state.radiusKm}km · 가까운 순(직선거리)`;
  }

  function showError(message, {retry = true, onRetry = () => search({reset: true})} = {}) {
    status.textContent = '';
    error.replaceChildren(el('span', '', message, documentRef));
    if (retry) {
      const again = el('button', 'consumer-action consumer-action-secondary ev-retry', '다시 시도', documentRef);
      again.type = 'button';
      again.addEventListener('click', () => void onRetry());
      error.append(again);
    }
    error.hidden = false;
  }

  async function search({reset = false} = {}) {
    if (disposed) return;
    if (retryTimer !== null) { clearTimer(retryTimer); retryTimer = null; }
    renderBasis();
    const point = state.mode === 'location' ? state.location : state.mode === 'region' ? state.region : null;
    if (!point) {
      list.replaceChildren(); more.hidden = true; error.hidden = true; notice.hidden = true;
      status.textContent = '시·도와 시·군을 고르면 그곳 중심에서 가까운 충전소를 보여 드려요.';
      return;
    }
    if (reset) { state.offset = 0; state.stations = []; list.replaceChildren(); preparingRetries = 0; }
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    status.textContent = '충전소를 찾는 중…'; error.hidden = true; more.hidden = true; notice.hidden = true;
    let url;
    try {
      url = evChargerSearchUrl({
        latitude: point.latitude, longitude: point.longitude, radiusKm: state.radiusKm, speed: state.speed,
        availableOnly: state.availableOnly, limit: EV_PAGE_SIZE, offset: state.offset,
        origin: state.mode === 'region' ? 'region' : 'current',
      });
    } catch {
      showError('국내 위치에서만 충전소를 찾을 수 있어요.', {retry: false});
      return;
    }
    state.requests += 1;
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return;
    const result = response.ok ? normalizeEvSearch(response.data) : null;
    if (!result) {
      showError(response.status === 429
        ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.'
        : '충전소 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
      return;
    }
    if (result.status === 'PREPARING') {
      const where = result.regionsLoading.join(', ');
      if (preparingRetries < MAX_PREPARING_RETRIES) {
        preparingRetries += 1;
        status.textContent = `${where ? `${where} ` : ''}충전소 정보를 공공데이터에서 불러오는 중이에요. 잠시만 기다려 주세요…`;
        retryTimer = setTimer(() => { retryTimer = null; void search(); }, result.retryAfterSeconds * 1000);
      } else {
        showError('충전소 정보를 불러오는 데 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    preparingRetries = 0;
    if (result.status === 'DISABLED') {
      status.textContent = '전기차 충전소 정보를 준비하고 있어요. 준비가 끝나면 이 화면에서 바로 보여 드릴게요.';
      source.textContent = '';
      return;
    }
    if (result.status === 'OUT_OF_AREA') {
      showError('국내 위치에서만 충전소를 찾을 수 있어요.', {retry: false});
      return;
    }
    if (result.status === 'UNAVAILABLE') {
      const message = result.reason === 'PROVIDER_QUOTA'
        ? '오늘 공공데이터 조회 한도에 닿아 충전소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
        : result.reason === 'PROVIDER_ACCESS' || result.reason === 'PROVIDER_NOT_CONFIGURED'
          ? '공공데이터 충전소 정보 연결을 준비하고 있어요. 잠시 후 다시 확인해 주세요.'
          : '공공데이터 충전소 서비스(한국환경공단)가 지금 응답하지 않아요. 잠시 후 다시 시도해 주세요.';
      showError(message);
      return;
    }
    const known = new Set(state.stations.map(item => item.id));
    const fresh = result.stations.filter(item => !known.has(item.id));
    state.stations.push(...fresh);
    for (const station of fresh) list.append(evStationItem(station, {mapProvider, documentRef, userAgent, origin, fromRegion: regionLabel()}));
    state.offset = result.nextOffset ?? state.offset + fresh.length;
    more.hidden = !result.hasMore;
    const notes = [];
    if (result.status === 'PARTIAL' && result.regionsMissing.length) {
      notes.push(`${result.regionsMissing.join(', ')} 충전소 정보를 지금 불러오지 못해 일부만 보여 드려요.`);
    }
    if (result.statusRefreshError) notes.push('충전 상태를 새로 확인하지 못한 곳은 "현재 상태 확인 필요"로 보여 드려요.');
    if (notes.length) { notice.textContent = notes.join(' '); notice.hidden = false; }
    const where = state.mode === 'location' ? '현재 위치' : `${state.region.label} 중심`;
    if (!state.stations.length) {
      const condition = state.availableOnly ? ' 충전 가능 조건을 끄거나' : '';
      const wider = EV_RADIUS_CHOICES.find(km => km > state.radiusKm);
      status.textContent = `${where}에서 반경 ${state.radiusKm}km 안에 조건에 맞는 충전소가 공공데이터에 없어요.${wider ? `${condition} 반경을 넓혀 보세요.` : ''}`;
      if (wider) {
        const widen = el('button', 'consumer-action consumer-action-secondary ev-widen', `반경 ${wider}km로 넓히기`, documentRef);
        widen.type = 'button';
        widen.addEventListener('click', () => {
          state.radiusKm = wider;
          for (const chip of radiusRow.querySelectorAll('button')) chip.setAttribute('aria-pressed', String(chip.dataset.evRadius === String(wider)));
          void search({reset: true});
        });
        list.replaceChildren(el('li', 'ev-empty', '', documentRef));
        list.firstChild.append(widen);
      }
    } else {
      status.textContent = `${where}에서 가까운 충전소 ${result.totalCount.toLocaleString('ko-KR')}곳 중 ${state.stations.length}곳을 보여 드려요.`;
    }
    const fetched = result.infoFetchedAt ? ` · 충전소 정보 ${result.infoFetchedAt.time} 기준` : '';
    source.textContent = `출처: ${EV_SOURCE_LABEL}${fetched}. 거리는 도로 거리가 아니라 직선거리예요. 충전 가능 여부는 현장 상황과 다를 수 있어요.`;
  }

  async function loadRegionCatalog() {
    if (regionCatalog) return regionCatalog;
    const response = await getJson(`${CORE_ORIGIN}/v2/life/weather/regions`, {fetchImpl});
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const regions = items.map(item => ({
      label: text(item?.label), province: text(item?.province), latitude: Number(item?.latitude), longitude: Number(item?.longitude),
    })).filter(item => item.label && item.province && inKorea(item.latitude, item.longitude));
    const provinces = (Array.isArray(response.data?.provinces) ? response.data.provinces.map(text) : [])
      .filter(name => regions.some(item => item.province === name));
    regionCatalog = regions.length ? {regions, provinces: provinces.length ? provinces : [...new Set(regions.map(item => item.province))]} : null;
    return regionCatalog;
  }

  async function enterRegionMode(note) {
    state.mode = 'region'; state.location = null;
    regionRow.hidden = false;
    locate.classList.remove('consumer-action-secondary');
    if (note !== undefined) locationNote.replaceChildren(...(Array.isArray(note) ? note : [note]));
    const saved = readCalendarManualWeatherRegion(storage);
    if (!state.region && saved && inKorea(saved.latitude, saved.longitude)) {
      state.region = {label: saved.label, latitude: saved.latitude, longitude: saved.longitude};
    }
    const catalog = await loadRegionCatalog();
    if (disposed) return;
    provinceSelect.replaceChildren(new Option('시·도 선택', ''));
    if (catalog) {
      for (const province of catalog.provinces) provinceSelect.append(new Option(province, province));
      const chosen = state.region ? catalog.regions.find(item => item.label === state.region.label) : null;
      if (chosen) { provinceSelect.value = chosen.province; fillCities(chosen.province, chosen.label); }
    } else if (!state.region) {
      // Location error and region-list error are told apart: here the reader
      // has no place yet and the 지역 목록 itself could not be read.
      list.replaceChildren(); more.hidden = true;
      showError('지역 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', {
        onRetry: () => { regionCatalog = null; return enterRegionMode(); },
      });
      return;
    }
    await search({reset: true});
  }

  function fillCities(province, selected = '') {
    citySelect.replaceChildren(new Option('시·군 선택', ''));
    for (const item of regionCatalog?.regions || []) {
      if (item.province === province) citySelect.append(new Option(item.label, item.label));
    }
    citySelect.disabled = citySelect.options.length <= 1;
    if (selected) citySelect.value = selected;
  }

  async function useCurrentLocation({prompt = true} = {}) {
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    if (!enabled) {
      const link = el('a', '', '설정에서 위치 켜기', documentRef); link.href = EV_SETTINGS_URL; link.rel = 'noopener';
      return enterRegionMode(['위치 사용이 꺼져 있어 고른 지역 중심에서 찾아 드려요. ', link]);
    }
    locate.disabled = true;
    locationNote.textContent = '현재 위치를 확인하고 있어요…';
    let location = null;
    let denied = false;
    try {
      const outcome = await resolveCurrent({allowPrompt: prompt});
      denied = outcome?.permission === LOCATION_PERMISSION.DENIED;
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
      return enterRegionMode(denied
        ? '위치 권한이 허용되지 않아 고른 지역 중심에서 찾아 드려요.'
        : '현재 위치를 확인하지 못해 고른 지역 중심에서 찾아 드려요.');
    }
    state.mode = 'location'; state.location = location;
    regionRow.hidden = true;
    locate.classList.add('consumer-action-secondary');
    locationNote.textContent = '위치는 이번 검색에만 쓰고 저장하지 않아요.';
    return search({reset: true});
  }

  locate.addEventListener('click', () => void useCurrentLocation({prompt: true}));
  provinceSelect.addEventListener('change', () => {
    fillCities(provinceSelect.value);
  });
  citySelect.addEventListener('change', () => {
    const chosen = regionCatalog?.regions.find(item => item.label === citySelect.value && item.province === provinceSelect.value);
    if (!chosen) return;
    state.mode = 'region'; state.region = {label: chosen.label, latitude: chosen.latitude, longitude: chosen.longitude};
    void search({reset: true});
  });
  more.addEventListener('click', () => void search());

  renderBasis();
  // The LOTBI location setting decides. On: use the position (asked at most
  // once here; a browser that already said no is not asked again). Off or
  // refused: the region picker, never a made-up position.
  let usage = false;
  let permission = LOCATION_PERMISSION.UNKNOWN;
  try { usage = locationUsageEnabled() === true; } catch { usage = false; }
  if (usage) {
    try { permission = await permissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
  }
  if (!disposed) {
    if (!usage) await useCurrentLocation({prompt: false});
    else if (permission === LOCATION_PERMISSION.DENIED || permission === LOCATION_PERMISSION.UNAVAILABLE) {
      await enterRegionMode('위치 권한이 허용되지 않아 고른 지역 중심에서 찾아 드려요.');
    } else if (permission === LOCATION_PERMISSION.GRANTED) {
      await useCurrentLocation({prompt: false});
    } else if (askLocationOnOpen) {
      await useCurrentLocation({prompt: true});
    } else {
      await enterRegionMode('현재 위치로 찾으려면 "현재 위치로 찾기"를 눌러 주세요.');
    }
  }
  return {
    dispose() {
      disposed = true;
      controller?.abort();
      if (retryTimer !== null) clearTimer(retryTimer);
    },
    focus() { (showTitle ? title : basis).focus?.(); },
    state,
  };
}
