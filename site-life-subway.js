// SUBWAY-LIFE-INFO-P0 — 지역정보 '지하철 정보': 가까운 역 · 역 검색 · 실시간 도착 · 평균 혼잡도.
//
// Its own screens, not a conversation: they read only Core's public, guest-safe
// GET /v2/life/subway/* and never send a question to the chat or call AI.
//
// * Home (#subway): 가까운 역 (the LOTBI location setting decides, like every
//   지역정보 screen: on and allowed → the current position for this one
//   request, never stored; off or refused → 역 이름 검색 / 호선으로 찾기, never a
//   made-up position) and 역 이름 검색. Distances are straight lines to the
//   official station coordinate; a station Core could not place is never
//   listed by distance.
// * Station (#subway-station): one station, one line at a time (서울 1호선 and
//   서울 4호선 never mix), 방향, the official real-time arrivals of Seoul
//   (서울 열린데이터광장 — data.go.kr 15058052 is the same source), the train
//   position Core joined by train number, and 서울교통공사's 30-minute *average*
//   congestion of a past quarter, labelled as such — never as the congestion of
//   a train running now. There is no per-car real-time congestion.
//
// What the arrival says comes from the official answer: the official message
// (arvlMsg2), the official 진입/도착/출발 code, 막차, and the time it was
// generated. The remaining time is Core's barvlDt minus the age; when it has
// passed the screen says so instead of moving the train a station on its own.
import {CORE_ORIGIN} from './site-core.js?v=aset-901119375843';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-901119375843';
import {isLocationUsageEnabled} from './site-location-preference.js?v=aset-901119375843';
import {formatDistanceMeters} from './site-navigation.js?v=aset-901119375843';

export const SUBWAY_MENU_LABEL = '지하철 정보';
export const SUBWAY_STATION_TITLE = '지하철 도착정보';
export const SUBWAY_RADIUS_CHOICES = Object.freeze([1, 2, 3, 5]);
export const SUBWAY_DEFAULT_RADIUS_KM = 2;
export const SUBWAY_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
export const SUBWAY_DAY_CHOICES = Object.freeze([['weekday', '평일'], ['saturday', '토요일'], ['sunday', '일요일']]);
export const SUBWAY_DIRECTION_LABELS = Object.freeze({UP: '상행', DOWN: '하행', INNER: '내선', OUTER: '외선'});
export const SUBWAY_REALTIME_SOURCE = '서울특별시 지하철 실시간 도착정보(서울 열린데이터광장)';
export const SUBWAY_STATIONS_SOURCE = '서울시 실시간도착 역정보 · 서울시 역사마스터 정보(서울 열린데이터광장)';
// Official line colours are only a recognition aid next to the line name.
export const SUBWAY_LINE_COLORS = Object.freeze({
  1001: '#0052A4', 1002: '#00A84D', 1003: '#EF7C1C', 1004: '#00A5DE', 1005: '#996CAC', 1006: '#CD7C2F',
  1007: '#747F00', 1008: '#E6186C', 1009: '#BDB092', 1032: '#9A6292', 1063: '#77C4A3', 1065: '#0090D2',
  1067: '#0C8E72', 1075: '#FABE00', 1077: '#D4003B', 1081: '#0054A6', 1092: '#B0CE18', 1093: '#81A914',
  1094: '#6789CA',
});

const TIMEOUT_MS = 12_000;
const REFRESH_COOLDOWN_MS = 5_000;
const STATION_ID = /^\d{10}$/u;
const LINE_ID = /^\d{4}$/u;
const SLOT = /^\d{2}:\d{2}$/u;
const text = value => (typeof value === 'string' ? value.trim() : '');

export function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 132;
}

// ── Core requests ────────────────────────────────────────────────────────

export function subwayUrl(path, params = {}, coreOrigin = CORE_ORIGIN) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return `${coreOrigin}/v2/life/subway/${path}${query ? `?${query}` : ''}`;
}

export function nearbyUrl({latitude, longitude, radiusKm = SUBWAY_DEFAULT_RADIUS_KM}, coreOrigin = CORE_ORIGIN) {
  if (!inKorea(Number(latitude), Number(longitude))) throw new TypeError('a location in Korea is required');
  // ~11 m: enough for "가까운 역", no finer than needed.
  return subwayUrl('nearby', {
    latitude: Math.round(Number(latitude) * 10_000) / 10_000,
    longitude: Math.round(Number(longitude) * 10_000) / 10_000,
    radius_km: SUBWAY_RADIUS_CHOICES.includes(radiusKm) ? radiusKm : SUBWAY_DEFAULT_RADIUS_KM,
    limit: 10,
  }, coreOrigin);
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

// ── Normalizers (nothing Core did not say is shown) ──────────────────────

export function normalizeLine(value) {
  if (!value || typeof value !== 'object') return null;
  const stationId = text(value.station_id);
  const lineId = text(value.line_id);
  const lineName = text(value.line_name);
  if (!STATION_ID.test(stationId) || !LINE_ID.test(lineId) || !lineName || !stationId.startsWith(lineId)) return null;
  const distance = Number.isInteger(value.distance_m) && value.distance_m >= 0 && value.distance_m <= 50_000 ? value.distance_m : null;
  return Object.freeze({
    stationId, lineId, lineName, name: text(value.name),
    hasLocation: value.has_location === true,
    hasAverage: value.has_average_congestion === true,
    distanceMeters: distance,
  });
}

export function normalizeGroup(value) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name);
  const lines = [];
  const seen = new Set();
  for (const raw of Array.isArray(value.lines) ? value.lines : []) {
    const line = normalizeLine(raw);
    if (!line || seen.has(line.stationId)) continue;
    seen.add(line.stationId); lines.push(line);
  }
  if (!name || !lines.length) return null;
  const distance = Number.isInteger(value.distance_m) && value.distance_m >= 0 && value.distance_m <= 50_000 ? value.distance_m : null;
  return Object.freeze({name, lines, distanceMeters: distance});
}

function kstClock(value) {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})\+09:00$/u.exec(text(value));
  return match ? `${match[1]}:${match[2]}:${match[3]}` : '';
}

export function formatSeconds(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return '';
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
}

export function normalizeArrival(value) {
  if (!value || typeof value !== 'object') return null;
  const direction = Object.hasOwn(SUBWAY_DIRECTION_LABELS, value.direction_code) ? value.direction_code : null;
  const lineName = text(value.train_line_name);
  const message = text(value.message);
  if (!direction || !(lineName || message)) return null;
  const eta = Number.isInteger(value.eta_seconds) && value.eta_seconds >= 0 && value.eta_seconds <= 7200 ? value.eta_seconds : null;
  const age = Number.isInteger(value.age_seconds) && value.age_seconds >= 0 && value.age_seconds <= 3600 ? value.age_seconds : null;
  const position = value.position && typeof value.position === 'object' && text(value.position.station_name)
    ? Object.freeze({
      stationName: text(value.position.station_name),
      statusLabel: text(value.position.status_label),
      receivedAt: kstClock(value.position.received_at),
    })
    : null;
  return Object.freeze({
    direction,
    directionLabel: text(value.direction_label) || SUBWAY_DIRECTION_LABELS[direction],
    lineName,
    destination: text(value.destination),
    trainType: text(value.train_type),
    express: value.express === true,
    trainNo: text(value.train_no),
    statusLabel: text(value.status_label),
    message,
    etaSeconds: eta,
    etaElapsed: value.eta_elapsed === true,
    generatedAt: kstClock(value.generated_at),
    ageSeconds: age,
    clockAhead: value.clock_ahead === true,
    lastTrain: value.last_train === true,
    position,
  });
}

// "광운대행 - 시청방면" → "시청방면": the official heading of a direction.
export function headingOf(lineName) {
  const match = /-\s*([^-]+?방면)\s*(?:\(막차\))?$/u.exec(text(lineName));
  return match ? match[1].trim() : '';
}

export function directionChoices(arrivals = [], series = []) {
  const codes = [];
  for (const code of ['UP', 'DOWN', 'INNER', 'OUTER']) {
    if (arrivals.some(item => item.direction === code) || series.some(item => item.direction_code === code)) codes.push(code);
  }
  return codes.map(code => {
    const headings = arrivals.filter(item => item.direction === code).map(item => headingOf(item.lineName)).filter(Boolean);
    const counts = new Map();
    for (const heading of headings) counts.set(heading, (counts.get(heading) || 0) + 1);
    const heading = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return {code, label: SUBWAY_DIRECTION_LABELS[code], heading};
  });
}

export function kstDayType(now = Date.now()) {
  const day = new Date(now + 9 * 3600_000).getUTCDay();
  return day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
}

export function slotLabel(slot) {
  return SLOT.test(slot) ? `${slot} 시간대` : '';
}

// ── DOM helpers ──────────────────────────────────────────────────────────

function el(tag, className = '', value = '', documentRef = document) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function lineBadge(line, documentRef) {
  const badge = el('span', 'subway-line-badge', line.lineName, documentRef);
  badge.dataset.subwayLine = line.lineId;
  const color = SUBWAY_LINE_COLORS[line.lineId];
  if (color) badge.style.setProperty('--subway-line-color', color);
  return badge;
}

function chip(label, pressed, documentRef, data = {}) {
  const button = el('button', 'festival-chip subway-chip', label, documentRef);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(Boolean(pressed)));
  for (const [key, value] of Object.entries(data)) button.dataset[key] = value;
  return button;
}

function statusLine(documentRef) {
  const node = el('p', 'subway-status', '', documentRef);
  node.setAttribute('role', 'status');
  return node;
}

// ── Home: 가까운 역 · 역 이름 검색 · 호선으로 찾기 ───────────────────────────

export function groupItem(group, {documentRef = document, onPick} = {}) {
  const item = el('li', 'subway-group', '', documentRef);
  const button = el('button', 'subway-group-button', '', documentRef);
  button.type = 'button';
  button.dataset.subwayStation = group.lines[0].stationId;
  const name = el('span', 'subway-group-name', group.name, documentRef);
  const lines = el('span', 'subway-group-lines', '', documentRef);
  for (const line of group.lines) lines.append(lineBadge(line, documentRef));
  const copy = el('span', 'subway-group-copy', '', documentRef);
  copy.append(name, lines);
  button.append(copy);
  if (group.distanceMeters !== null) {
    const distance = el('span', 'subway-group-distance', formatDistanceMeters(group.distanceMeters), documentRef);
    distance.setAttribute('aria-label', `직선거리 ${formatDistanceMeters(group.distanceMeters)}`);
    button.append(distance);
  }
  button.setAttribute('aria-label', `${group.name}역 ${group.lines.map(line => line.lineName).join(', ')}${group.distanceMeters !== null ? `, 직선거리 ${formatDistanceMeters(group.distanceMeters)}` : ''}`);
  button.addEventListener('click', () => onPick?.(group, group.lines[0]));
  item.append(button);
  return item;
}

export async function mountSubwayHome({
  root,
  fetchImpl = globalThis.fetch,
  documentRef = document,
  resolveCurrent = resolveSharedBrowserCurrentLocation,
  locationUsageEnabled = isLocationUsageEnabled,
  permissionState = getBrowserLocationPermissionState,
  // A tap on the 지역정보 card may ask once; a reload or back/forward never asks.
  askLocationOnOpen = true,
  initialState = null,
  onState,
  onPickStation,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = id => globalThis.clearTimeout(id),
} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  let debounce = null;
  const saved = initialState && typeof initialState === 'object' ? initialState : {};
  const state = {
    mode: ['nearby', 'search', 'line'].includes(saved.mode) ? saved.mode : 'nearby',
    query: typeof saved.query === 'string' ? saved.query.slice(0, 40) : '',
    lineId: LINE_ID.test(saved.lineId || '') ? saved.lineId : '',
    radiusKm: SUBWAY_RADIUS_CHOICES.includes(saved.radiusKm) ? saved.radiusKm : SUBWAY_DEFAULT_RADIUS_KM,
    location: null,       // memory only, this screen only
    lines: [],
    requests: 0,
  };
  const remember = () => onState?.({mode: state.mode, query: state.query, lineId: state.lineId, radiusKm: state.radiusKm});

  root.classList.add('subway-surface');
  const intro = el('p', 'subway-intro', '가까운 역이나 역 이름으로 찾으면 실시간 도착정보와 시간대별 평균 혼잡도를 바로 보여 드려요.', documentRef);
  const locate = el('button', 'consumer-action subway-locate', '가까운 역 찾기', documentRef); locate.type = 'button';
  const locationNote = el('p', 'consumer-feature-note subway-location-note', '', documentRef);
  locationNote.setAttribute('role', 'status');
  const form = el('form', 'subway-search', '', documentRef);
  form.setAttribute('role', 'search');
  const searchLabel = el('label', 'subway-search-label', '역 이름 검색', documentRef);
  const input = el('input', 'subway-search-input', '', documentRef);
  input.type = 'search'; input.name = 'q'; input.maxLength = 40; input.autocomplete = 'off';
  input.enterKeyHint = 'search'; input.placeholder = '예: 강남, 서울역, 이수';
  input.value = state.query; input.id = `subway-search-${Math.random().toString(36).slice(2, 9)}`;
  searchLabel.htmlFor = input.id;
  const submit = el('button', 'consumer-action consumer-action-secondary subway-search-submit', '검색', documentRef);
  submit.type = 'submit';
  const searchRow = el('div', 'subway-search-row', '', documentRef);
  searchRow.append(input, submit);
  form.append(searchLabel, searchRow);
  const lineField = el('label', 'consumer-life-field subway-line-field', '호선으로 찾기', documentRef);
  const lineSelect = el('select', 'subway-line-select', '', documentRef);
  lineSelect.dataset.subwayLineSelect = 'true';
  lineSelect.append(new Option('호선 선택', ''));
  lineField.append(lineSelect);
  const radiusRow = el('div', 'festival-chip-row subway-radius-row', '', documentRef);
  radiusRow.setAttribute('role', 'group'); radiusRow.setAttribute('aria-label', '가까운 역 반경');
  for (const km of SUBWAY_RADIUS_CHOICES) {
    const button = chip(`${km}km`, km === state.radiusKm, documentRef, {subwayRadius: String(km)});
    button.addEventListener('click', () => {
      state.radiusKm = km;
      for (const other of radiusRow.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
      remember();
      if (state.location) void loadNearby();
    });
    radiusRow.append(button);
  }
  radiusRow.hidden = true;
  const status = statusLine(documentRef);
  const list = el('ol', 'subway-groups', '', documentRef);
  list.setAttribute('aria-label', '지하철역');
  const coverage = el('p', 'consumer-feature-note subway-coverage', '', documentRef);
  const source = el('p', 'consumer-feature-note subway-source', `출처: ${SUBWAY_STATIONS_SOURCE}. 거리는 공식 역 좌표까지의 직선거리예요.`, documentRef);
  root.replaceChildren(intro, locate, locationNote, radiusRow, form, lineField, status, list, coverage, source);

  const pick = (group, line) => onPickStation?.({stationId: line.stationId, name: group.name, lineId: line.lineId});

  function render(groups, {empty = '', coverageNote = ''} = {}) {
    list.replaceChildren(...groups.map(group => groupItem(group, {documentRef, onPick: pick})));
    if (!groups.length && empty) status.textContent = empty;
    coverage.textContent = coverageNote;
  }

  async function request(url) {
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    state.requests += 1;
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return null;
    return response;
  }

  function failure(response) {
    status.textContent = response?.status === 429
      ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.'
      : '지하철역 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    list.replaceChildren();
  }

  function fillLines(lines) {
    if (!Array.isArray(lines) || state.lines.length) return;
    state.lines = lines.filter(line => LINE_ID.test(text(line?.line_id)) && text(line?.line_name));
    for (const line of state.lines) lineSelect.append(new Option(line.line_name, line.line_id));
    if (state.lineId) lineSelect.value = state.lineId;
  }

  async function search(query) {
    const value = text(query).slice(0, 40);
    state.mode = 'search'; state.query = value; remember();
    if (!value) { status.textContent = '역 이름을 입력해 주세요.'; list.replaceChildren(); return; }
    status.textContent = `'${value}' 역을 찾는 중…`;
    const response = await request(subwayUrl('stations', {q: value, limit: 20}));
    if (!response) return;
    if (!response.ok) { failure(response); return; }
    const data = response.data || {};
    fillLines(data.lines);
    if (data.status === 'DISABLED') { status.textContent = '지하철 정보를 준비하고 있어요.'; list.replaceChildren(); return; }
    const groups = (Array.isArray(data.groups) ? data.groups : []).map(normalizeGroup).filter(Boolean);
    status.textContent = groups.length ? `'${value}' 검색 결과 ${groups.length}곳` : '';
    render(groups, {empty: text(data.message) || `'${value}'에 맞는 역이 없어요.`,
      coverageNote: data.status === 'NOT_FOUND' ? '' : text(data.coverage?.note)});
  }

  async function browseLine(lineId) {
    if (!LINE_ID.test(lineId)) return;
    state.mode = 'line'; state.lineId = lineId; remember();
    status.textContent = '노선의 역을 불러오는 중…';
    const response = await request(subwayUrl('stations', {line_id: lineId}));
    if (!response) return;
    if (!response.ok) { failure(response); return; }
    const data = response.data || {};
    fillLines(data.lines);
    const lines = (Array.isArray(data.stations) ? data.stations : []).map(normalizeLine).filter(Boolean);
    const groups = lines.map(line => Object.freeze({name: line.name, lines: [line], distanceMeters: null}));
    status.textContent = groups.length ? `${text(data.line?.line_name)} 역 ${groups.length}곳` : text(data.message) || '이 노선의 역을 찾지 못했어요.';
    render(groups, {coverageNote: ''});
  }

  async function loadNearby() {
    if (!state.location) return;
    state.mode = 'nearby'; remember();
    let url;
    try { url = nearbyUrl({...state.location, radiusKm: state.radiusKm}); } catch {
      status.textContent = '국내 위치에서만 가까운 역을 찾을 수 있어요.'; return;
    }
    status.textContent = '가까운 역을 찾는 중…';
    const response = await request(url);
    if (!response) return;
    if (!response.ok) { failure(response); return; }
    const data = response.data || {};
    if (data.status === 'DISABLED') { status.textContent = '지하철 정보를 준비하고 있어요.'; list.replaceChildren(); return; }
    const groups = (Array.isArray(data.groups) ? data.groups : []).map(normalizeGroup).filter(Boolean);
    status.textContent = groups.length ? `현재 위치에서 반경 ${state.radiusKm}km 안의 역 ${groups.length}곳 (가까운 순)` : '';
    render(groups, {empty: text(data.message) || `반경 ${state.radiusKm}km 안에 위치가 확인된 역이 없어요.`,
      coverageNote: groups.length ? '' : ''});
  }

  async function useCurrentLocation({prompt = true} = {}) {
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    if (!enabled) {
      const link = el('a', '', '설정에서 위치 켜기', documentRef); link.href = SUBWAY_SETTINGS_URL; link.rel = 'noopener';
      locationNote.replaceChildren('위치 사용이 꺼져 있어 가까운 역은 찾지 않아요. 역 이름이나 호선으로 찾아 주세요. ', link);
      return;
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
    if (disposed) return;
    if (!location) {
      locationNote.textContent = denied
        ? '위치 권한이 허용되지 않아 가까운 역은 찾지 않아요. 역 이름이나 호선으로 찾아 주세요.'
        : prompt ? '현재 위치를 확인하지 못했어요. 역 이름이나 호선으로 찾아 주세요.'
          : '가까운 역을 찾으려면 "가까운 역 찾기"를 눌러 주세요.';
      return;
    }
    state.location = location;
    radiusRow.hidden = false;
    locate.classList.add('consumer-action-secondary');
    locationNote.textContent = '위치는 이번 검색에만 쓰고 저장하지 않아요.';
    await loadNearby();
  }

  locate.addEventListener('click', () => void useCurrentLocation({prompt: true}));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (debounce !== null) { clearTimer(debounce); debounce = null; }
    input.blur();                         // the phone keyboard closes on 검색
    void search(input.value);
  });
  input.addEventListener('input', () => {
    if (debounce !== null) clearTimer(debounce);
    const value = input.value;
    debounce = setTimer(() => { debounce = null; if (text(value)) void search(value); }, 400);
  });
  lineSelect.addEventListener('change', () => { if (lineSelect.value) void browseLine(lineSelect.value); });

  // The line list comes with any stations answer; ask for it once up front.
  void (async () => {
    const response = await getJson(subwayUrl('stations'), {fetchImpl});
    if (!disposed && response.ok) {
      fillLines(response.data?.lines);
      if (!coverage.textContent && state.mode !== 'search') coverage.textContent = text(response.data?.coverage?.note);
    }
  })();

  // Restore what this history entry showed (back from a station, reload).
  if (state.mode === 'search' && state.query) await search(state.query);
  else if (state.mode === 'line' && state.lineId) await browseLine(state.lineId);

  // The LOTBI location setting decides 가까운 역, like the other 지역정보 screens.
  if (!disposed && state.mode === 'nearby') {
    let usage = false;
    let permission = LOCATION_PERMISSION.UNKNOWN;
    try { usage = locationUsageEnabled() === true; } catch { usage = false; }
    if (usage) {
      try { permission = await permissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
    }
    if (!usage) await useCurrentLocation({prompt: false});
    else if (permission === LOCATION_PERMISSION.DENIED || permission === LOCATION_PERMISSION.UNAVAILABLE) {
      locationNote.textContent = '위치 권한이 허용되지 않아 가까운 역은 찾지 않아요. 역 이름이나 호선으로 찾아 주세요.';
    } else if (permission === LOCATION_PERMISSION.GRANTED) await useCurrentLocation({prompt: false});
    else if (askLocationOnOpen) await useCurrentLocation({prompt: true});
    else locationNote.textContent = '가까운 역을 찾으려면 "가까운 역 찾기"를 눌러 주세요.';
  }
  return {
    dispose() {
      disposed = true;
      controller?.abort();
      if (debounce !== null) clearTimer(debounce);
    },
    state,
    search,
    browseLine,
  };
}

// ── Station: 호선 · 방향 · 실시간 도착 · 열차 위치 · 평균 혼잡도 ─────────────

export function arrivalItem(arrival, {documentRef = document} = {}) {
  const item = el('li', 'subway-arrival', '', documentRef);
  item.dataset.direction = arrival.direction;
  if (arrival.trainNo) item.dataset.trainNo = arrival.trainNo;
  const head = el('div', 'subway-arrival-head', '', documentRef);
  head.append(el('span', 'subway-arrival-direction', arrival.directionLabel, documentRef));
  head.append(el('strong', 'subway-arrival-line', arrival.lineName || `${arrival.destination}행`, documentRef));
  if (arrival.express && arrival.trainType) head.append(el('span', 'subway-tag subway-tag-express', arrival.trainType, documentRef));
  if (arrival.lastTrain) head.append(el('span', 'subway-tag subway-tag-last', '막차', documentRef));
  const message = el('p', 'subway-arrival-message', arrival.message || arrival.statusLabel, documentRef);
  message.dataset.statusLabel = arrival.statusLabel || '';
  const meta = el('p', 'subway-arrival-meta', '', documentRef);
  const parts = [];
  if (arrival.etaElapsed) parts.push('공식 예정 시간이 지났어요');
  else if (arrival.etaSeconds !== null && arrival.etaSeconds > 0) parts.push(`지금 기준 약 ${formatSeconds(arrival.etaSeconds)} 남음`);
  if (arrival.clockAhead) parts.push(`정보 생성 ${arrival.generatedAt} (제공처 시각이 지금보다 앞서 경과 시간을 계산하지 않았어요)`);
  else if (arrival.generatedAt) parts.push(`정보 생성 ${arrival.generatedAt}${arrival.ageSeconds !== null ? ` (${formatSeconds(arrival.ageSeconds)} 전)` : ''}`);
  meta.textContent = parts.join(' · ');
  item.append(head, message, meta);
  if (arrival.position) {
    const where = [arrival.position.stationName, arrival.position.statusLabel].filter(Boolean).join(' ');
    item.append(el('p', 'subway-arrival-position', `열차 위치: ${where}${arrival.position.receivedAt ? ` · ${arrival.position.receivedAt} 수신` : ''}`, documentRef));
  }
  return item;
}

const REALTIME_MESSAGES = Object.freeze({
  NOT_READY: '실시간 도착정보는 서울시 연결을 준비하고 있어요. 지금은 역 정보와 시간대별 평균 혼잡도를 볼 수 있어요.',
  DISABLED: '지하철 정보를 준비하고 있어요.',
  NOT_COVERED: '이 역은 아직 LOTBI 지하철 정보의 제공 범위에 없어요.',
});

export async function mountSubwayStation({
  root,
  fetchImpl = globalThis.fetch,
  documentRef = document,
  initialState = null,
  onState,
  onTitle,
  now = () => Date.now(),
} = {}) {
  let disposed = false;
  let arrivalToken = 0;
  let congestionToken = 0;
  let arrivalController = null;
  let congestionController = null;
  let lastRefresh = 0;
  const saved = initialState && typeof initialState === 'object' ? initialState : {};
  const state = {
    stationId: STATION_ID.test(saved.stationId || '') ? saved.stationId : '',
    name: text(saved.name),
    direction: Object.hasOwn(SUBWAY_DIRECTION_LABELS, saved.direction) ? saved.direction : '',
    day: SUBWAY_DAY_CHOICES.some(([value]) => value === saved.day) ? saved.day : kstDayType(now()),
    slot: SLOT.test(saved.slot || '') ? saved.slot : '',
    lines: [],
    arrivals: [],
    series: [],
    slots: [],
    realtimeStatus: '',
    requests: 0,
  };
  const remember = () => onState?.({stationId: state.stationId, name: state.name, direction: state.direction,
    day: state.day, slot: state.slot});

  root.classList.add('subway-surface', 'subway-station');
  const title = el('h3', 'subway-station-name', state.name ? `${state.name}역` : '지하철역', documentRef);
  title.tabIndex = -1;
  const lineRow = el('div', 'festival-chip-row subway-line-row', '', documentRef);
  lineRow.setAttribute('role', 'group'); lineRow.setAttribute('aria-label', '호선 선택');
  const directionRow = el('div', 'festival-chip-row subway-direction-row', '', documentRef);
  directionRow.setAttribute('role', 'group'); directionRow.setAttribute('aria-label', '방향 선택');

  const realtime = el('section', 'subway-block subway-realtime', '', documentRef);
  const realtimeHead = el('div', 'subway-block-head', '', documentRef);
  const realtimeTitle = el('h4', 'subway-block-title', '실시간 도착', documentRef);
  const refresh = el('button', 'consumer-action consumer-action-secondary subway-refresh', '새로고침', documentRef);
  refresh.type = 'button';
  realtimeHead.append(realtimeTitle, refresh);
  const checked = el('p', 'subway-checked', '', documentRef);
  const realtimeStatus = statusLine(documentRef);
  const arrivals = el('ol', 'subway-arrivals', '', documentRef);
  arrivals.setAttribute('aria-label', '도착 예정 열차');
  const realtimeSource = el('p', 'consumer-feature-note subway-source', `출처: ${SUBWAY_REALTIME_SOURCE}. 서울시가 보낸 정보만 보여 드리며, 실제 운행과 다를 수 있어요.`, documentRef);
  realtime.append(realtimeHead, checked, realtimeStatus, arrivals, realtimeSource);

  const average = el('section', 'subway-block subway-average', '', documentRef);
  const averageTitle = el('h4', 'subway-block-title', '시간대별 평균 혼잡도 (과거 자료)', documentRef);
  const averageNotice = el('p', 'subway-average-notice', '', documentRef);
  const dayRow = el('div', 'festival-chip-row subway-day-row', '', documentRef);
  dayRow.setAttribute('role', 'group'); dayRow.setAttribute('aria-label', '요일 구분');
  for (const [value, label] of SUBWAY_DAY_CHOICES) {
    const button = chip(label, value === state.day, documentRef, {subwayDay: value});
    button.addEventListener('click', () => {
      state.day = value;
      for (const other of dayRow.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
      remember();
      void loadAverage();
    });
    dayRow.append(button);
  }
  const slotField = el('label', 'consumer-life-field subway-slot-field', '시간대 (30분 단위)', documentRef);
  const slotSelect = el('select', 'subway-slot-select', '', documentRef);
  slotSelect.dataset.subwaySlot = 'true';
  slotField.append(slotSelect);
  const averageStatus = statusLine(documentRef);
  const averageRows = el('ul', 'subway-average-rows', '', documentRef);
  const averageScale = el('p', 'consumer-feature-note subway-average-scale', '', documentRef);
  const averageSource = el('p', 'consumer-feature-note subway-source', '', documentRef);
  average.append(averageTitle, averageNotice, dayRow, slotField, averageStatus, averageRows, averageScale, averageSource);

  // The screen's own header already names the station (onTitle); the heading
  // here is for screen readers and focus only.
  title.classList.add('subway-visually-hidden');
  root.replaceChildren(title, lineRow, directionRow, realtime, average);

  function renderLines() {
    lineRow.replaceChildren();
    for (const line of state.lines) {
      const button = chip(line.lineName, line.stationId === state.stationId, documentRef, {subwayLineChoice: line.lineId});
      const color = SUBWAY_LINE_COLORS[line.lineId];
      if (color) button.style.setProperty('--subway-line-color', color);
      button.classList.add('subway-line-chip');
      button.addEventListener('click', () => {
        if (line.stationId === state.stationId) return;
        state.stationId = line.stationId; state.direction = '';
        remember();
        renderLines();
        void loadAll();
      });
      lineRow.append(button);
    }
    lineRow.hidden = state.lines.length < 2;
  }

  function renderDirections() {
    const choices = directionChoices(state.arrivals, state.series);
    if (state.direction && !choices.some(choice => choice.code === state.direction)) state.direction = '';
    directionRow.replaceChildren();
    const all = chip('전체 방향', !state.direction, documentRef, {subwayDirection: ''});
    all.addEventListener('click', () => { state.direction = ''; remember(); renderDirections(); renderArrivals(); renderAverage(); });
    directionRow.append(all);
    for (const choice of choices) {
      const label = choice.heading ? `${choice.label} · ${choice.heading}` : choice.label;
      const button = chip(label, state.direction === choice.code, documentRef, {subwayDirection: choice.code});
      button.addEventListener('click', () => {
        state.direction = choice.code; remember(); renderDirections(); renderArrivals(); renderAverage();
      });
      directionRow.append(button);
    }
    directionRow.hidden = !choices.length;
  }

  function renderArrivals() {
    const shown = state.arrivals.filter(item => !state.direction || item.direction === state.direction);
    arrivals.replaceChildren(...shown.map(item => arrivalItem(item, {documentRef})));
    if (state.realtimeStatus === 'OK' && !shown.length) realtimeStatus.textContent = '이 방향의 도착 예정 열차가 서울시 응답에 없어요.';
  }

  function renderAverage() {
    averageRows.replaceChildren();
    const index = state.slots.indexOf(state.slot);
    if (index < 0) return;
    const shown = state.series.filter(item => !state.direction || item.direction_code === state.direction);
    for (const series of shown) {
      const row = el('li', 'subway-average-row', '', documentRef);
      row.dataset.direction = series.direction_code || '';
      const value = Array.isArray(series.values) ? series.values[index] : null;
      const sourceName = text(series.source_station_name);
      const label = el('span', 'subway-average-label', '', documentRef);
      label.append(text(series.direction_label) || text(series.direction));
      if (sourceName && sourceName !== state.name) label.append(el('small', '', ` (${sourceName})`, documentRef));
      const reading = el('span', 'subway-average-value', '', documentRef);
      const bar = el('span', 'subway-average-bar', '', documentRef);
      bar.setAttribute('aria-hidden', 'true');
      if (series.all_zero === true) {
        reading.textContent = '원본 값이 모든 시간대 0.0%';
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        reading.textContent = `${value.toFixed(1)}%`;
        const fill = el('span', 'subway-average-fill', '', documentRef);
        fill.style.width = `${Math.min(100, (value / 150) * 100).toFixed(1)}%`;
        bar.append(fill);
      } else {
        reading.textContent = '원본 값 없음';
      }
      row.append(label, reading, bar);
      averageRows.append(row);
    }
  }

  async function loadArrivals({force = false} = {}) {
    if (!state.stationId) return;
    arrivalController?.abort(); arrivalController = new AbortController();
    const token = ++arrivalToken;
    realtimeStatus.textContent = '서울시 실시간 도착정보를 확인하는 중…';
    arrivals.replaceChildren();
    state.requests += 1;
    const response = await getJson(subwayUrl('arrivals', {station_id: state.stationId}), {fetchImpl, signal: arrivalController.signal});
    if (disposed || token !== arrivalToken) return;
    if (!response.ok) {
      state.arrivals = []; state.realtimeStatus = 'ERROR';
      realtimeStatus.textContent = response.status === 429
        ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.'
        : '도착정보를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.';
      renderDirections();
      return;
    }
    const data = response.data || {};
    const station = normalizeLine(data.station);
    const lines = (Array.isArray(data.same_place_lines) ? data.same_place_lines : []).map(normalizeLine).filter(Boolean);
    if (station) {
      state.name = station.name || state.name;
      title.textContent = `${state.name}역`;
      onTitle?.(`${state.name}역`);
      state.lines = lines.length ? lines : [station];
      renderLines();
    }
    state.realtimeStatus = text(data.status);
    state.arrivals = (Array.isArray(data.arrivals) ? data.arrivals : []).map(normalizeArrival).filter(Boolean);
    const checkedAt = kstClock(data.checked_at);
    checked.textContent = checkedAt ? `마지막 확인 ${checkedAt}${force ? ' · 새로고침함' : ''}` : '';
    if (state.realtimeStatus === 'OK') {
      realtimeStatus.textContent = state.arrivals.length ? '' : '도착 예정 열차가 서울시 응답에 없어요.';
      const positions = data.positions && typeof data.positions === 'object' ? data.positions : {};
      if (positions.status && !['OK', 'EMPTY', 'NOT_REQUESTED'].includes(positions.status)) {
        realtimeStatus.textContent = '열차 위치정보는 지금 확인할 수 없어요. 도착정보는 그대로 보여 드려요.';
      }
    } else if (REALTIME_MESSAGES[state.realtimeStatus]) {
      realtimeStatus.textContent = REALTIME_MESSAGES[state.realtimeStatus];
    } else {
      const latest = kstClock(data.latest_generated_at);
      realtimeStatus.textContent = `${text(data.message) || '실시간 도착정보를 지금 확인할 수 없어요.'}${latest ? ` (마지막 공식 정보 생성 ${latest})` : ''}`;
    }
    refresh.hidden = ['NOT_READY', 'DISABLED', 'NOT_COVERED'].includes(state.realtimeStatus);
    renderDirections();
    renderArrivals();
  }

  async function loadAverage() {
    if (!state.stationId) return;
    congestionController?.abort(); congestionController = new AbortController();
    const token = ++congestionToken;
    averageStatus.textContent = '평균 혼잡도를 불러오는 중…';
    const response = await getJson(subwayUrl('congestion-average', {station_id: state.stationId, day: state.day}),
      {fetchImpl, signal: congestionController.signal});
    if (disposed || token !== congestionToken) return;
    if (!response.ok) {
      state.series = [];
      averageStatus.textContent = '평균 혼잡도를 불러오지 못했어요.';
      averageRows.replaceChildren();
      renderDirections();
      return;
    }
    const data = response.data || {};
    averageNotice.textContent = text(data.notice);
    averageScale.textContent = text(data.scale) ? `${text(data.scale)} 막대의 세로 눈금은 34%와 100%예요.` : '';
    const source = data.source && typeof data.source === 'object' ? data.source : {};
    averageSource.textContent = source.dataset
      ? `출처: ${text(source.dataset)}(${text(source.provider)}) · ${text(source.period)} 자료 · 공공데이터포털`
      : '';
    state.slots = Array.isArray(data.slots) ? data.slots.filter(slot => SLOT.test(slot)) : [];
    if (!state.slot || !state.slots.includes(state.slot)) {
      state.slot = SLOT.test(data.current_slot || '') && state.slots.includes(data.current_slot) ? data.current_slot : state.slots[0] || '';
    }
    slotSelect.replaceChildren(...state.slots.map(slot => new Option(slotLabel(slot), slot)));
    slotSelect.value = state.slot;
    slotField.hidden = !state.slots.length || data.status !== 'OK';
    dayRow.hidden = data.status !== 'OK';
    if (data.status === 'OK') {
      state.series = Array.isArray(data.series) ? data.series.filter(item => item && typeof item === 'object') : [];
      averageStatus.textContent = data.current_slot ? '' : '지금은 원본 자료의 시간대(05:30~00:30) 밖이에요. 시간대를 골라 보세요.';
    } else {
      state.series = [];
      averageStatus.textContent = text(data.message) || '이 역의 평균 혼잡도 자료가 없어요.';
    }
    remember();
    renderDirections();
    renderAverage();
  }

  async function loadAll() {
    await Promise.all([loadArrivals(), loadAverage()]);
  }

  refresh.addEventListener('click', () => {
    const at = now();
    if (at - lastRefresh < REFRESH_COOLDOWN_MS) return;
    lastRefresh = at;
    void loadArrivals({force: true});
  });
  slotSelect.addEventListener('change', () => { state.slot = slotSelect.value; remember(); renderAverage(); });

  if (!state.stationId) {
    realtimeStatus.textContent = '역을 다시 골라 주세요.';
    return {dispose() { disposed = true; }, focus() { title.focus(); }, state};
  }
  await loadAll();
  return {
    dispose() {
      disposed = true;
      arrivalController?.abort();
      congestionController?.abort();
    },
    focus() { title.focus?.(); },
    state,
    refresh: () => loadArrivals({force: true}),
  };
}
