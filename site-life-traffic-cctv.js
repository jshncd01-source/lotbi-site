// TRAFFIC-CCTV P0 — 지역정보 '실시간 도로 CCTV': 도로 → 노선 → 방향 → 구간 → CCTV → 영상.
//
// Its own screen, not a conversation: it reads only Core's public, guest-safe
// GET /v2/life/traffic-cctv/{roads,routes,sections,cameras,playback} (ITS
// 국가교통정보센터 CCTV 화상자료; 구간 from 한국도로공사 출입시설 목록). Nothing is
// typed into the conversation, no AI is called and the location is never
// asked for or read: the reader picks the road, the route, the direction and
// the 구간.
//
// One screen, one route (#traffic-cctv, back → 지역정보). The choices stack on
// that screen (each one can be changed in place), so the system back, the
// browser back and the screen's ← all leave it for 지역정보. The player is
// the only extra step: opening it adds one history entry on the same URL, so
// one back closes the video and shows the list as it was.
//
// Video: only the https stream URL Core hands out for one camera id, on the
// ITS CDN. Safari and iOS play HLS themselves; other browsers use the sealed
// hls.js light build (vendor/hls.js-1.6.19, loaded on first need with SRI).
// Closing the player stops the stream and releases the player. Nothing is
// recorded, downloaded or stored, and the stream URL is never logged.
import {CORE_ORIGIN} from './site-core.js?v=aset-f46a0f4224fe';
import {readDefaultMapProvider} from './site-location-preference.js?v=aset-f46a0f4224fe';
import {buildDefaultMapHref, defaultMapProviderPresentation} from './site-navigation.js?v=aset-f46a0f4224fe';

export const CCTV_MENU_LABEL = '실시간 도로 CCTV';
export const CCTV_SCREEN_TITLE = '실시간 도로 CCTV';
export const CCTV_API_PATH = '/v2/life/traffic-cctv';
export const CCTV_ROAD_TYPES = Object.freeze([['expressway', '고속도로'], ['national', '국도']]);
// The ITS 기술기준's CDN. Core checks it too; the page refuses anything else.
export const CCTV_STREAM_HOSTS = Object.freeze(['cctvsec.ktict.co.kr']);
export const HLS_SCRIPT_PATH = './vendor/hls.js-1.6.19/hls.light.min.js';
export const HLS_SCRIPT_INTEGRITY = 'sha384-iLLNHt3V/kPmTJ59eKPOjc+6Qf/z6IObViLeySBT6dkvUuCbmRSU82tfSlI2meV0';
export const CCTV_SELECTION_KEY = 'lotbi.trafficCctv.selection.v1';
export const CCTV_MAP_ICON_BASE = '/assets/place-actions/';
export const CCTV_MAP_ICON_VERSION = 'place-icons-20260925';

const TIMEOUT_MS = 15_000;
const PLAY_TIMEOUT_MS = 20_000;
const MAX_PREPARING_RETRIES = 6;
const ROUTE_ID_RE = /^(?:unknown|[a-z]-[a-f0-9]{10})$/u;
// s0… = an official 출입시설 구간 (고속도로); g-… = a 시·군 named by the cameras (국도).
const SECTION_ID_RE = /^(?:unmapped|s\d{1,4}|g-[a-f0-9]{8})$/u;
const CAMERA_FILTER_MIN = 12;
const CAMERA_ID_RE = /^[a-f0-9]{16}$/u;
const KIND_LABELS = Object.freeze({HLS: '실시간', MP4: '동영상', STILL: '정지영상', UNKNOWN: '형식 확인 불가'});
const UNPLAYABLE_REASONS = Object.freeze({
  STREAM_NOT_HTTPS: '보안 연결(HTTPS) 영상이 제공되지 않아 재생할 수 없습니다.',
  STREAM_HOST_NOT_ALLOWED: '확인된 영상 제공 주소가 아니어서 재생하지 않습니다.',
  STREAM_KIND_UNKNOWN: '영상 형식을 확인할 수 없어 재생하지 않습니다.',
  STREAM_URL_INVALID: '영상 주소를 확인할 수 없어 재생하지 않습니다.',
});
const text = value => (typeof value === 'string' ? value.trim() : '');
const count = value => (Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : 0);

// ── Core answers ─────────────────────────────────────────────────────────

function envelope(value) {
  if (!value || typeof value !== 'object') return null;
  const status = ['OK', 'PREPARING', 'UNAVAILABLE', 'DISABLED', 'NOT_FOUND', 'UNPLAYABLE'].includes(value.status) ? value.status : null;
  if (!status) return null;
  return {
    status,
    code: text(value.code),
    message: text(value.message),
    retryAfterSeconds: Math.min(Math.max(Number.isInteger(value.retry_after_seconds) ? value.retry_after_seconds : 3, 1), 30),
    provider: text(value.provider),
    sectionSource: text(value.section_source),
    fetchedAt: text(value.fetched_at),
  };
}

export function normalizeRoads(value) {
  const base = envelope(value);
  if (!base) return null;
  const roads = (Array.isArray(value.roads) ? value.roads : [])
    .filter(item => item && CCTV_ROAD_TYPES.some(([id]) => id === item.road_type))
    .map(item => Object.freeze({
      roadType: item.road_type,
      label: CCTV_ROAD_TYPES.find(([id]) => id === item.road_type)[1],
      status: text(item.status),
      routeCount: count(item.route_count),
      cameraCount: count(item.camera_count),
    }));
  return Object.freeze({...base, roads});
}

function normalizeDirections(list) {
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || !['forward', 'reverse'].includes(item.direction) || !text(item.label)) continue;
    if (out.some(other => other.direction === item.direction)) continue;
    out.push(Object.freeze({direction: item.direction, label: text(item.label)}));
  }
  return out.length === 2 ? out : [];
}

function normalizeRoute(item) {
  if (!item || !ROUTE_ID_RE.test(text(item.route_id)) || !text(item.name)) return null;
  return Object.freeze({
    routeId: item.route_id,
    name: text(item.name),
    number: /^\d{1,3}$/u.test(text(item.number)) ? text(item.number) : '',
    cameraCount: count(item.camera_count),
    playableCount: count(item.playable_count),
    hasSections: item.has_sections === true,
    directions: normalizeDirections(item.directions),
    unmapped: item.unmapped === true || item.route_id === 'unknown',
  });
}

export function normalizeRoutes(value) {
  const base = envelope(value);
  if (!base) return null;
  const seen = new Set();
  const routes = [];
  for (const raw of Array.isArray(value.routes) ? value.routes : []) {
    const route = normalizeRoute(raw);
    if (!route || seen.has(route.routeId)) continue;
    seen.add(route.routeId); routes.push(route);
  }
  return Object.freeze({...base, roadType: text(value.road_type), routes});
}

export function normalizeSections(value) {
  const base = envelope(value);
  if (!base) return null;
  const seen = new Set();
  const sections = [];
  for (const item of Array.isArray(value.sections) ? value.sections : []) {
    if (!item || !SECTION_ID_RE.test(text(item.section_id)) || item.section_id === 'unmapped' || !text(item.name)) continue;
    if (seen.has(item.section_id)) continue;
    seen.add(item.section_id);
    sections.push(Object.freeze({sectionId: item.section_id, name: text(item.name), part: text(item.part), cameraCount: count(item.camera_count)}));
  }
  return Object.freeze({
    ...base,
    route: normalizeRoute(value.route),
    sections,
    direction: ['forward', 'reverse'].includes(value.direction) ? value.direction : '',
    directionLabel: text(value.direction_label),
    directionNote: text(value.direction_note),
    sectionNote: text(value.section_note),
    sectionKind: value.section_kind === 'region' ? 'region' : 'facility',
    unmappedCount: count(value.unmapped_count),
  });
}

function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 33 && latitude <= 38.7 && longitude >= 124.5 && longitude <= 132;
}

function normalizeCamera(item) {
  if (!item || !CAMERA_ID_RE.test(text(item.camera_id)) || !text(item.name)) return null;
  const kind = ['HLS', 'MP4', 'STILL'].includes(item.stream_kind) ? item.stream_kind : 'UNKNOWN';
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const placed = item.latitude !== null && item.longitude !== null && inKorea(latitude, longitude);
  return Object.freeze({
    cameraId: item.camera_id,
    name: text(item.name),
    location: text(item.location) || text(item.name),
    routeName: text(item.route_name),
    kind,
    playable: item.playable === true && kind !== 'UNKNOWN',
    unplayableReason: text(item.unplayable_reason),
    latitude: placed ? latitude : null,
    longitude: placed ? longitude : null,
  });
}

export function normalizeCameras(value) {
  const base = envelope(value);
  if (!base) return null;
  const seen = new Set();
  const cameras = [];
  for (const raw of Array.isArray(value.cameras) ? value.cameras : []) {
    const camera = normalizeCamera(raw);
    if (!camera || seen.has(camera.cameraId)) continue;
    seen.add(camera.cameraId); cameras.push(camera);
  }
  const section = value.section && typeof value.section === 'object'
    ? Object.freeze({sectionId: text(value.section.section_id), name: text(value.section.name), unmapped: value.section.unmapped === true})
    : null;
  return Object.freeze({...base, route: normalizeRoute(value.route), section, cameras, orderNote: text(value.order_note)});
}

export function streamUrlAllowed(url) {
  let parsed;
  try { parsed = new URL(text(url)); } catch { return false; }
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password
    && (parsed.port === '' || parsed.port === '443') && CCTV_STREAM_HOSTS.includes(parsed.hostname.toLowerCase());
}

export function normalizePlayback(value) {
  const base = envelope(value);
  if (!base) return null;
  const camera = normalizeCamera(value.camera);
  let stream = null;
  if (base.status === 'OK' && value.stream && typeof value.stream === 'object') {
    const kind = ['HLS', 'MP4', 'STILL'].includes(value.stream.kind) ? value.stream.kind : '';
    if (kind && streamUrlAllowed(value.stream.url)) stream = Object.freeze({kind, url: text(value.stream.url), expiresAt: text(value.stream.expires_at)});
  }
  return Object.freeze({...base, status: base.status === 'OK' && !stream ? 'UNPLAYABLE' : base.status, camera, stream, notice: text(value.notice)});
}

export function trafficCctvUrl(endpoint, params = {}, coreOrigin = CORE_ORIGIN) {
  if (!['roads', 'routes', 'sections', 'cameras', 'playback'].includes(endpoint)) throw new Error('unknown endpoint');
  const url = new URL(`${CCTV_API_PATH}/${endpoint}`, coreOrigin);
  const checks = {
    road_type: value => CCTV_ROAD_TYPES.some(([id]) => id === value),
    route_id: value => ROUTE_ID_RE.test(value),
    section_id: value => SECTION_ID_RE.test(value),
    camera_id: value => CAMERA_ID_RE.test(value),
    direction: value => ['forward', 'reverse'].includes(value),
  };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const check = checks[key];
    if (!check || !check(String(value))) throw new Error(`bad ${key}`);
    url.searchParams.set(key, String(value));
  }
  return url.toString();
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

// ── Player engine ────────────────────────────────────────────────────────

// Safari / iOS: native HLS. Elsewhere hls.js on Media Source Extensions; a
// browser with neither cannot play the live stream and says so.
export function choosePlaybackEngine(kind, {nativeHls = false, mediaSource = false, userAgent = '', maxTouchPoints = 0} = {}) {
  if (kind === 'STILL') return 'image';
  if (kind === 'MP4') return 'native';
  if (kind !== 'HLS') return 'none';
  const ios = /iP(?:hone|ad|od)/u.test(userAgent) || (/Macintosh/u.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari/u.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android|SamsungBrowser/u.test(userAgent);
  if (nativeHls && (ios || safari)) return 'native';
  if (mediaSource) return 'hlsjs';
  if (nativeHls) return 'native';
  return 'none';
}

let hlsLoader = null;
export function loadHlsLibrary({documentRef = document, windowRef = globalThis} = {}) {
  if (windowRef.Hls) return Promise.resolve(windowRef.Hls);
  if (hlsLoader) return hlsLoader;
  hlsLoader = new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = new URL(HLS_SCRIPT_PATH, import.meta.url).toString();
    script.integrity = HLS_SCRIPT_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.dataset.trafficCctvHls = 'true';
    script.addEventListener('load', () => (windowRef.Hls ? resolve(windowRef.Hls) : reject(new Error('hls.js missing'))), {once: true});
    script.addEventListener('error', () => reject(new Error('hls.js load failed')), {once: true});
    documentRef.head.append(script);
  }).catch(error => { hlsLoader = null; throw error; });
  return hlsLoader;
}

// ── DOM helpers ──────────────────────────────────────────────────────────

function el(tag, className = '', value = '', documentRef = document) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function button(className, label, documentRef) {
  const node = el('button', className, label, documentRef);
  node.type = 'button';
  return node;
}

export function cctvMapIcon(provider, {userAgent = globalThis.navigator?.userAgent || ''} = {}) {
  const presentation = defaultMapProviderPresentation(provider, {userAgent});
  const desktopTmap = provider === 'TMAP' && presentation.label !== '티맵';
  return Object.freeze({
    icon: desktopTmap ? 'naver-map' : presentation.icon,
    label: desktopTmap ? '네이버지도 웹(티맵은 모바일 전용)' : presentation.label,
  });
}

export function cctvMapLink(camera, provider, {documentRef = document, userAgent = globalThis.navigator?.userAgent || '', origin} = {}) {
  if (camera.latitude === null || camera.longitude === null) return null;
  const place = {
    name: camera.location,
    address: '',
    placeId: `cctv:${camera.cameraId}`,
    latitude: camera.latitude,
    longitude: camera.longitude,
    coordinateSystem: 'WGS84',
    coordinateAuthority: 'ITS_CCTV',
    navigationCapable: true,
  };
  let href = '';
  try {
    href = buildDefaultMapHref(provider, place, {userAgent, ...(origin ? {origin} : {})});
  } catch {
    return null;
  }
  const {icon, label} = cctvMapIcon(provider, {userAgent});
  const link = el('a', 'cctv-map-link', '', documentRef);
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.dataset.mapProvider = provider;
  link.dataset.mapIcon = icon;
  link.setAttribute('aria-label', `${camera.location} 위치를 ${label}에서 열기`);
  const image = el('img', 'cctv-map-icon', '', documentRef);
  image.src = `${CCTV_MAP_ICON_BASE}${icon}.png?v=${CCTV_MAP_ICON_VERSION}`;
  image.alt = ''; image.width = 28; image.height = 28; image.decoding = 'async';
  const caption = el('span', 'cctv-map-caption', `${label.split('(')[0]}에서 위치 보기`, documentRef);
  image.addEventListener('error', () => { image.hidden = true; }, {once: true});
  link.append(image, caption);
  return link;
}

function readSelection(storage) {
  try {
    const value = JSON.parse(storage?.getItem(CCTV_SELECTION_KEY) || 'null');
    if (!value || typeof value !== 'object') return null;
    return {
      roadType: CCTV_ROAD_TYPES.some(([id]) => id === value.roadType) ? value.roadType : '',
      routeId: ROUTE_ID_RE.test(text(value.routeId)) ? value.routeId : '',
      direction: ['forward', 'reverse'].includes(value.direction) ? value.direction : '',
      sectionId: SECTION_ID_RE.test(text(value.sectionId)) ? value.sectionId : '',
    };
  } catch {
    return null;
  }
}

function writeSelection(storage, selection) {
  try { storage?.setItem(CCTV_SELECTION_KEY, JSON.stringify(selection)); } catch { /* private mode */ }
}

function kstClock(value) {
  const match = /T(\d{2}):(\d{2})/u.exec(text(value));
  return match ? `${match[1]}:${match[2]}` : '';
}

// ── Screen ───────────────────────────────────────────────────────────────

export async function mountTrafficCctv({
  root,
  fetchImpl = globalThis.fetch,
  documentRef = document,
  windowRef = globalThis,
  storage = globalThis.sessionStorage,
  userAgent = globalThis.navigator?.userAgent || '',
  origin,
  showTitle = true,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = id => globalThis.clearTimeout(id),
} = {}) {
  let disposed = false;
  let controller = null;
  let token = 0;
  let retryTimer = null;
  let preparingRetries = 0;
  const routesByRoad = new Map();
  const state = {
    roadType: '', roads: null,
    route: null, routes: [], routeFilter: '',
    direction: '', sections: null,
    section: null, cameras: null,
    requests: [],
  };
  const mapProvider = readDefaultMapProvider(documentRef.cookie || '');

  root.classList.add('cctv-surface');
  const title = el('h3', 'cctv-title', CCTV_SCREEN_TITLE, documentRef); title.tabIndex = -1;
  const intro = el('p', 'cctv-intro', '도로와 노선, 구간을 고르면 그 구간의 교통 CCTV를 보여 드려요.', documentRef);
  const roadRow = el('div', 'cctv-road-row', '', documentRef);
  roadRow.setAttribute('role', 'group'); roadRow.setAttribute('aria-label', '도로 종류');
  const roadButtons = new Map();
  for (const [roadType, label] of CCTV_ROAD_TYPES) {
    const choice = button('cctv-road', '', documentRef);
    choice.dataset.cctvRoad = roadType;
    choice.setAttribute('aria-pressed', 'false');
    choice.append(el('span', 'cctv-road-label', label, documentRef), el('span', 'cctv-road-meta', '', documentRef));
    choice.addEventListener('click', () => void chooseRoad(roadType));
    roadButtons.set(roadType, choice);
    roadRow.append(choice);
  }
  const routeBlock = el('div', 'cctv-block cctv-route-block', '', documentRef);
  const sectionBlock = el('div', 'cctv-block cctv-section-block', '', documentRef);
  const cameraBlock = el('div', 'cctv-block cctv-camera-block', '', documentRef);
  const status = el('p', 'cctv-status', '', documentRef); status.setAttribute('role', 'status');
  const error = el('div', 'cctv-error', '', documentRef); error.setAttribute('role', 'alert'); error.hidden = true;
  const source = el('p', 'consumer-feature-note cctv-source', '', documentRef);
  root.replaceChildren(...(showTitle ? [title] : []), intro, roadRow, status, error, routeBlock, sectionBlock, cameraBlock, source);
  for (const block of [routeBlock, sectionBlock, cameraBlock]) block.hidden = true;

  const remember = () => writeSelection(storage, {
    roadType: state.roadType, routeId: state.route?.routeId || '', direction: state.direction,
    sectionId: state.section?.sectionId || '',
  });

  function showError(message, onRetry) {
    status.textContent = '';
    error.replaceChildren(el('span', '', message, documentRef));
    if (onRetry) {
      const again = button('consumer-action consumer-action-secondary cctv-retry', '다시 시도', documentRef);
      again.addEventListener('click', () => void onRetry());
      error.append(again);
    }
    error.hidden = false;
  }

  function renderSource(result) {
    const parts = [];
    if (result?.provider) parts.push(`제공: ${result.provider}`);
    if (result?.sectionSource) parts.push(`구간: ${result.sectionSource}`);
    const clock = kstClock(result?.fetchedAt);
    if (clock) parts.push(`목록 갱신 ${clock}`);
    if (parts.length) source.textContent = parts.join(' · ');
  }

  // One request at a time; a newer choice cancels the older request.
  async function load(endpoint, params, normalize, {onReady, onRetry}) {
    if (retryTimer !== null) { clearTimer(retryTimer); retryTimer = null; }
    controller?.abort(); controller = new AbortController();
    const mine = ++token;
    error.hidden = true;
    let url;
    try { url = trafficCctvUrl(endpoint, params); } catch { showError('선택을 다시 해 주세요.'); return null; }
    state.requests.push({endpoint, params: {...params}});
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || mine !== token) return null;
    const result = response.ok ? normalize(response.data) : null;
    if (!result) {
      showError(response.status === 429
        ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.'
        : 'CCTV 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', onRetry);
      return null;
    }
    if (result.status === 'PREPARING') {
      if (preparingRetries < MAX_PREPARING_RETRIES) {
        preparingRetries += 1;
        status.textContent = result.message || 'CCTV 목록을 불러오고 있어요. 잠시만 기다려 주세요…';
        retryTimer = setTimer(() => { retryTimer = null; void onRetry(); }, result.retryAfterSeconds * 1000);
      } else {
        showError('CCTV 목록을 불러오는 데 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.', onRetry);
      }
      return null;
    }
    preparingRetries = 0;
    if (result.status === 'DISABLED') {
      status.textContent = result.message || '실시간 도로 CCTV를 준비하고 있어요. 준비가 끝나면 이 화면에서 바로 보여 드릴게요.';
      return null;
    }
    if (result.status === 'UNAVAILABLE') {
      showError(result.message || '제공기관에서 CCTV 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.', onRetry);
      return null;
    }
    status.textContent = '';
    renderSource(result);
    return onReady(result);
  }

  function summaryRow(label, value, changeLabel, onChange, attribute) {
    const row = el('div', 'cctv-summary', '', documentRef);
    row.dataset.cctvSummary = attribute;
    const body = el('p', 'cctv-summary-text', '', documentRef);
    body.append(el('span', 'cctv-summary-label', label, documentRef), el('strong', 'cctv-summary-value', value, documentRef));
    const change = button('consumer-action consumer-action-secondary cctv-change', changeLabel, documentRef);
    change.dataset.cctvChange = attribute;
    change.addEventListener('click', onChange);
    row.append(body, change);
    return row;
  }

  // ── road ──
  function renderRoads() {
    for (const [roadType, choice] of roadButtons) {
      const info = state.roads?.roads.find(item => item.roadType === roadType);
      choice.setAttribute('aria-pressed', String(state.roadType === roadType));
      const meta = choice.querySelector('.cctv-road-meta');
      meta.textContent = info && info.status === 'OK' ? `노선 ${info.routeCount}개 · CCTV ${info.cameraCount}대` : '';
    }
  }

  async function loadRoads() {
    return load('roads', {}, normalizeRoads, {
      onRetry: loadRoads,
      onReady: result => { state.roads = result; renderRoads(); return result; },
    });
  }

  async function chooseRoad(roadType, {restore = null} = {}) {
    if (disposed) return;
    const changed = state.roadType !== roadType;
    state.roadType = roadType;
    if (changed || !restore) { state.route = null; state.direction = ''; state.section = null; state.sections = null; state.cameras = null; }
    renderRoads();
    sectionBlock.hidden = true; cameraBlock.hidden = true;
    const cached = routesByRoad.get(roadType);
    const ready = cached ? cached : await load('routes', {road_type: roadType}, normalizeRoutes, {
      onRetry: () => chooseRoad(roadType, {restore}),
      onReady: result => { routesByRoad.set(roadType, result.routes); return result.routes; },
    });
    if (!ready || disposed || state.roadType !== roadType) return;
    state.routes = ready;
    remember();
    const wanted = restore?.routeId ? ready.find(route => route.routeId === restore.routeId) : null;
    if (wanted) { await chooseRoute(wanted, {restore}); return; }
    renderRouteList();
  }

  // ── route ──
  function renderRouteList() {
    routeBlock.hidden = false; sectionBlock.hidden = true; cameraBlock.hidden = true;
    const heading = el('h4', 'cctv-block-title', `${CCTV_ROAD_TYPES.find(([id]) => id === state.roadType)[1]} 노선 선택`, documentRef);
    const search = el('input', 'cctv-route-search', '', documentRef);
    search.type = 'search'; search.placeholder = '노선 이름 찾기 (예: 경부)'; search.autocomplete = 'off';
    search.setAttribute('aria-label', '노선 이름 찾기'); search.value = state.routeFilter; search.enterKeyHint = 'search';
    const list = el('ul', 'cctv-list cctv-route-list', '', documentRef);
    list.setAttribute('aria-label', '노선');
    const fill = () => {
      const needle = search.value.replace(/\s+/gu, '');
      state.routeFilter = search.value;
      const items = state.routes.filter(route => !needle || route.name.replace(/\s+/gu, '').includes(needle) || route.number === needle);
      list.replaceChildren(...items.map(route => {
        const item = el('li', '', '', documentRef);
        const choice = button('cctv-row cctv-route', '', documentRef);
        choice.dataset.cctvRoute = route.routeId;
        const name = route.unmapped ? '노선 미확인 CCTV' : route.name;
        choice.append(el('span', 'cctv-row-title', name, documentRef));
        // 고속도로 numbers read "제1호" (not a subway line); a 국도 name already says its number.
        const meta = [route.number && state.roadType === 'expressway' ? `제${route.number}호` : '', `CCTV ${route.cameraCount}대`,
          route.playableCount < route.cameraCount ? `재생 가능 ${route.playableCount}대` : ''].filter(Boolean).join(' · ');
        choice.append(el('span', 'cctv-row-meta', meta, documentRef));
        choice.addEventListener('click', () => void chooseRoute(route));
        item.append(choice);
        return item;
      }));
      if (!items.length) list.append(el('li', 'cctv-empty', state.routes.length ? '찾는 노선이 없어요.' : '지금 확인되는 CCTV 노선이 없어요.', documentRef));
    };
    search.addEventListener('input', fill);
    fill();
    routeBlock.replaceChildren(heading, search, list);
  }

  async function chooseRoute(route, {restore = null} = {}) {
    if (disposed) return;
    state.route = route; state.section = null; state.cameras = null;
    state.direction = route.directions.length
      ? (restore?.direction && route.directions.some(d => d.direction === restore.direction) ? restore.direction : route.directions[0].direction)
      : '';
    routeBlock.hidden = false;
    routeBlock.replaceChildren(summaryRow('노선', route.unmapped ? '노선 미확인 CCTV' : route.name, '노선 변경', () => {
      state.route = null; state.section = null; state.direction = ''; remember(); renderRouteList();
    }, 'route'));
    cameraBlock.hidden = true;
    await loadSections({restore});
  }

  async function loadSections({restore = null} = {}) {
    const route = state.route;
    if (!route) return;
    const result = await load('sections', {road_type: state.roadType, route_id: route.routeId, direction: state.direction}, normalizeSections, {
      onRetry: () => loadSections({restore}),
      onReady: value => value,
    });
    if (!result || disposed || state.route !== route) return;
    if (result.status === 'NOT_FOUND') { resetToRoutes(result.message); return; }
    state.sections = result;
    remember();
    const wanted = restore?.sectionId;
    if (!result.sections.length) {
      // No official 구간 for this route: its cameras are listed as they are.
      await chooseSection({sectionId: 'unmapped', name: '구간 미확인 CCTV', cameraCount: result.unmappedCount, unmapped: true}, {skipSections: true});
      return;
    }
    if (wanted) {
      const section = wanted === 'unmapped'
        ? {sectionId: 'unmapped', name: '구간 미확인 CCTV', cameraCount: result.unmappedCount, unmapped: true}
        : result.sections.find(item => item.sectionId === wanted);
      if (section) { await chooseSection(section); return; }
    }
    renderSectionList();
  }

  function resetToRoutes(message) {
    state.route = null; state.section = null; state.direction = ''; remember();
    routesByRoad.delete(state.roadType);
    void chooseRoad(state.roadType).then(() => { if (message) status.textContent = message; });
  }

  function directionRow() {
    const route = state.route;
    if (!route?.directions.length) return null;
    const row = el('div', 'festival-chip-row cctv-direction-row', '', documentRef);
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', '진행 방향');
    for (const {direction, label} of route.directions) {
      const chip = button('festival-chip cctv-direction', label, documentRef);
      chip.dataset.cctvDirection = direction;
      chip.setAttribute('aria-pressed', String(state.direction === direction));
      chip.addEventListener('click', () => {
        if (state.direction === direction) return;
        state.direction = direction;
        void loadSections({restore: state.section ? {sectionId: state.section.sectionId} : null});
      });
      row.append(chip);
    }
    return row;
  }

  function renderSectionList() {
    const result = state.sections;
    sectionBlock.hidden = false; cameraBlock.hidden = true;
    const nodes = [el('h4', 'cctv-block-title', state.route.directions.length ? '방향과 구간 선택' : '구간 선택', documentRef)];
    const directions = directionRow();
    if (directions) nodes.push(directions);
    for (const note of [result.sectionNote, result.directionNote].filter(Boolean)) {
      nodes.push(el('p', 'consumer-feature-note cctv-note', note, documentRef));
    }
    const list = el('ul', 'cctv-list cctv-section-list', '', documentRef);
    const regional = result.sectionKind === 'region';
    list.setAttribute('aria-label', regional ? '구간 (시·군)' : '구간 (IC·JC)');
    let part = null;
    for (const section of result.sections) {
      if (section.part && section.part !== part) {
        part = section.part;
        list.append(el('li', 'cctv-part', part, documentRef));
      }
      const item = el('li', '', '', documentRef);
      const choice = button('cctv-row cctv-section', '', documentRef);
      choice.dataset.cctvSection = section.sectionId;
      if (!section.cameraCount) choice.dataset.cctvEmpty = 'true';
      choice.append(el('span', 'cctv-row-title', section.name, documentRef),
        el('span', 'cctv-row-meta', section.cameraCount ? `CCTV ${section.cameraCount}대` : 'CCTV 없음', documentRef));
      choice.addEventListener('click', () => void chooseSection(section));
      item.append(choice); list.append(item);
    }
    if (result.unmappedCount) {
      const item = el('li', '', '', documentRef);
      const choice = button('cctv-row cctv-section cctv-section-unmapped', '', documentRef);
      choice.dataset.cctvSection = 'unmapped';
      choice.append(el('span', 'cctv-row-title', '구간 미확인 CCTV', documentRef),
        el('span', 'cctv-row-meta', `CCTV ${result.unmappedCount}대 · ${regional ? '이름에 시·군이 없음' : '공식 IC·JC 이름과 연결되지 않음'}`, documentRef));
      choice.addEventListener('click', () => void chooseSection({sectionId: 'unmapped', name: '구간 미확인 CCTV', cameraCount: result.unmappedCount, unmapped: true}));
      item.append(choice); list.append(item);
    }
    nodes.push(list);
    sectionBlock.replaceChildren(...nodes);
  }

  // ── section → cameras ──
  async function chooseSection(section, {skipSections = false} = {}) {
    if (disposed || !state.route) return;
    state.section = section;
    remember();
    sectionBlock.hidden = false;
    const nodes = [];
    const directions = directionRow();
    if (directions && !skipSections) nodes.push(directions);
    if (skipSections) {
      if (state.sections?.sectionNote) nodes.push(el('p', 'consumer-feature-note cctv-note', state.sections.sectionNote, documentRef));
    } else {
      nodes.push(summaryRow('구간', section.name, '구간 변경', () => {
        state.section = null; state.cameras = null; remember(); renderSectionList();
      }, 'section'));
      if (state.sections?.directionNote) nodes.push(el('p', 'consumer-feature-note cctv-note', state.sections.directionNote, documentRef));
    }
    sectionBlock.replaceChildren(...nodes);
    const route = state.route;
    // The direction orders 구간 미확인 CCTV along the route too.
    const result = await load('cameras', {road_type: state.roadType, route_id: route.routeId, section_id: section.sectionId, direction: state.direction}, normalizeCameras, {
      onRetry: () => chooseSection(section, {skipSections}),
      onReady: value => value,
    });
    if (!result || disposed || state.route !== route || state.section !== section) return;
    if (result.status === 'NOT_FOUND') {
      if (result.code === 'CCTV_ROUTE_NOT_FOUND') { resetToRoutes(result.message); return; }
      state.section = null; remember(); renderSectionList(); status.textContent = result.message; return;
    }
    state.cameras = result.cameras;
    renderCameras(section, result.orderNote);
  }

  function renderCameras(section, orderNote = '') {
    cameraBlock.hidden = false;
    const heading = el('h4', 'cctv-block-title', `${section.name} CCTV`, documentRef);
    const list = el('ul', 'cctv-list cctv-camera-list', '', documentRef);
    list.setAttribute('aria-label', `${section.name} CCTV`);
    const nodes = [heading];
    if (orderNote) nodes.push(el('p', 'consumer-feature-note cctv-note', orderNote, documentRef));
    // A long list (구간 미확인 on a long road) can be narrowed by name.
    if (state.cameras.length > CAMERA_FILTER_MIN) {
      const filter = el('input', 'cctv-route-search cctv-camera-search', '', documentRef);
      filter.type = 'search'; filter.placeholder = 'CCTV 이름 찾기 (예: 양재)'; filter.autocomplete = 'off';
      filter.setAttribute('aria-label', 'CCTV 이름 찾기'); filter.enterKeyHint = 'search';
      const none = el('li', 'cctv-empty', '찾는 CCTV가 없어요.', documentRef); none.hidden = true;
      filter.addEventListener('input', () => {
        const needle = filter.value.replace(/\s+/gu, '');
        let shown = 0;
        for (const item of list.querySelectorAll(':scope > li[data-cctv-name]')) {
          const match = !needle || item.dataset.cctvName.includes(needle);
          item.hidden = !match;
          if (match) shown += 1;
        }
        none.hidden = shown > 0;
      });
      nodes.push(filter);
      list.append(none);
    }
    for (const camera of state.cameras) {
      const item = el('li', '', '', documentRef);
      item.dataset.cctvName = camera.name.replace(/\s+/gu, '');
      const choice = button('cctv-row cctv-camera', '', documentRef);
      choice.dataset.cctvCamera = camera.cameraId;
      choice.dataset.cctvKind = camera.kind;
      const head = el('span', 'cctv-camera-head', '', documentRef);
      head.append(el('span', 'cctv-row-title', camera.location, documentRef));
      const badge = el('span', `cctv-badge cctv-badge-${camera.kind.toLowerCase()}`, KIND_LABELS[camera.kind], documentRef);
      head.append(badge);
      choice.append(head);
      if (camera.routeName && camera.location !== camera.name) choice.append(el('span', 'cctv-row-meta', camera.name, documentRef));
      if (camera.playable) {
        choice.append(el('span', 'cctv-play-label', camera.kind === 'STILL' ? '정지영상 보기' : '영상 보기', documentRef));
        choice.addEventListener('click', () => void openPlayer(camera, choice));
      } else {
        choice.disabled = true;
        choice.dataset.cctvUnplayable = 'true';
        choice.append(el('span', 'cctv-row-meta cctv-unplayable', UNPLAYABLE_REASONS[camera.unplayableReason] || '이 CCTV는 지금 재생할 수 없습니다.', documentRef));
      }
      item.append(choice); list.append(item);
    }
    if (!state.cameras.length) {
      list.append(el('li', 'cctv-empty', section.unmapped
        ? '구간을 확인할 수 없는 CCTV가 없어요.'
        : '이 구간에는 지금 확인되는 공식 CCTV가 없어요. 다른 구간을 골라 보세요.', documentRef));
    }
    nodes.push(list);
    cameraBlock.replaceChildren(...nodes);
  }

  // ── player ──
  const player = {open: false, key: '', overlay: null, video: null, hls: null, timer: null, camera: null, trigger: null};

  function releasePlayback() {
    if (player.timer !== null) { clearTimer(player.timer); player.timer = null; }
    try { player.hls?.destroy(); } catch { /* already gone */ }
    player.hls = null;
    const video = player.video;
    if (video) {
      try { video.pause(); } catch { /* not started */ }
      video.removeAttribute('src');
      try { video.load(); } catch { /* detached */ }
    }
  }

  function closePlayer({fromHistory = false} = {}) {
    if (!player.open) return;
    const ownEntry = windowRef.history?.state && windowRef.history.state.lotbiCctvPlayer === player.key;
    if (!fromHistory && ownEntry) {
      // The entry this player added goes first; popstate then closes it, so
      // the button, the system back and the browser back do the same thing.
      windowRef.history.back();
      return;
    }
    releasePlayback();
    player.overlay?.remove();
    player.open = false; player.overlay = null; player.video = null; player.camera = null;
    root.dataset.cctvPlayer = 'closed';
    const trigger = player.trigger; player.trigger = null;
    if (trigger?.isConnected) trigger.focus({preventScroll: true});
  }

  const onPopState = () => {
    if (player.open && windowRef.history?.state?.lotbiCctvPlayer !== player.key) closePlayer({fromHistory: true});
  };
  windowRef.addEventListener?.('popstate', onPopState);

  async function openPlayer(camera, trigger) {
    if (player.open || disposed) return;
    player.open = true; player.camera = camera; player.trigger = trigger;
    player.key = `cctv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    root.dataset.cctvPlayer = 'open';
    try {
      const current = windowRef.history.state && typeof windowRef.history.state === 'object' ? windowRef.history.state : {};
      windowRef.history.pushState({lotbiRoute: current.lotbiRoute || 'traffic-cctv', lotbiCctvPlayer: player.key}, '', windowRef.location.href);
    } catch { /* history unavailable: the close button still works */ }

    const overlay = el('div', 'cctv-player', '', documentRef);
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `${camera.location} CCTV 영상`);
    overlay.dataset.cctvPlayerFor = camera.cameraId;
    const header = el('div', 'cctv-player-header', '', documentRef);
    const heading = el('h4', 'cctv-player-title', camera.location, documentRef);
    const close = button('cctv-player-close', '목록으로', documentRef);
    close.setAttribute('aria-label', '영상 닫고 CCTV 목록으로');
    close.addEventListener('click', () => closePlayer());
    header.append(close, heading);
    const stage = el('div', 'cctv-player-stage', '', documentRef);
    const loading = el('p', 'cctv-player-loading', '영상을 불러오는 중…', documentRef); loading.setAttribute('role', 'status');
    const failure = el('div', 'cctv-player-error', '', documentRef); failure.setAttribute('role', 'alert'); failure.hidden = true;
    const meta = el('p', 'cctv-player-meta', `${camera.routeName ? `${camera.routeName} · ` : ''}${KIND_LABELS[camera.kind]}`, documentRef);
    const actions = el('div', 'cctv-player-actions', '', documentRef);
    const notice = el('p', 'consumer-feature-note cctv-player-notice', '', documentRef);
    overlay.append(header, stage, loading, failure, meta, actions, notice);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePlayer(); }
    });
    const host = root.closest('.site-modal') || root;
    host.append(overlay);
    player.overlay = overlay;
    close.focus({preventScroll: true});

    const fail = (message, {retry = true} = {}) => {
      releasePlayback();
      loading.hidden = true;
      failure.replaceChildren(el('span', '', message, documentRef));
      if (retry) {
        const again = button('consumer-action consumer-action-secondary cctv-player-retry', '다시 시도', documentRef);
        again.addEventListener('click', () => void start());
        failure.append(again);
      }
      failure.hidden = false;
      overlay.dataset.cctvPlayback = 'failed';
    };

    const start = async () => {
      if (!player.open || player.overlay !== overlay) return;
      releasePlayback();
      failure.hidden = true; loading.hidden = false; loading.textContent = '영상을 불러오는 중…';
      overlay.dataset.cctvPlayback = 'loading';
      let url;
      try { url = trafficCctvUrl('playback', {road_type: state.roadType, camera_id: camera.cameraId}); } catch { fail('이 CCTV를 다시 골라 주세요.', {retry: false}); return; }
      state.requests.push({endpoint: 'playback', params: {road_type: state.roadType, camera_id: camera.cameraId}});
      const response = await getJson(url, {fetchImpl});
      if (!player.open || player.overlay !== overlay) return;
      const result = response.ok ? normalizePlayback(response.data) : null;
      if (!result) { fail(response.status === 429 ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.' : '영상 주소를 받지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
      if (result.notice) notice.textContent = result.notice;
      if (result.status === 'PREPARING') { fail(result.message || 'CCTV 목록을 불러오고 있어요. 잠시 후 다시 시도해 주세요.'); return; }
      if (result.status === 'NOT_FOUND') { fail(result.message || '이 CCTV를 지금은 찾을 수 없습니다. 목록을 다시 열어 주세요.', {retry: false}); return; }
      if (result.status === 'UNPLAYABLE' || !result.stream) {
        fail(UNPLAYABLE_REASONS[result.code] || result.message || '이 CCTV는 지금 재생할 수 없습니다.', {retry: false});
        return;
      }
      if (result.status !== 'OK') { fail(result.message || '제공기관에서 영상을 받지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
      const engine = choosePlaybackEngine(result.stream.kind, {
        nativeHls: Boolean(documentRef.createElement('video').canPlayType?.('application/vnd.apple.mpegurl')),
        mediaSource: Boolean(windowRef.MediaSource || windowRef.ManagedMediaSource),
        userAgent, maxTouchPoints: Number(windowRef.navigator?.maxTouchPoints) || 0,
      });
      overlay.dataset.cctvEngine = engine;
      if (engine === 'none') { fail('이 브라우저에서는 실시간 영상을 재생할 수 없어요. 최신 브라우저에서 열어 주세요.', {retry: false}); return; }
      if (engine === 'image') {
        const image = el('img', 'cctv-player-image', '', documentRef);
        image.alt = `${camera.location} 정지영상`;
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('load', () => { loading.hidden = true; overlay.dataset.cctvPlayback = 'playing'; }, {once: true});
        image.addEventListener('error', () => fail('정지영상을 불러오지 못했어요.'), {once: true});
        image.src = result.stream.url;
        stage.replaceChildren(image);
        return;
      }
      const video = el('video', 'cctv-player-video', '', documentRef);
      video.muted = true; video.defaultMuted = true; video.playsInline = true; video.controls = true;
      video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
      video.setAttribute('disablepictureinpicture', ''); video.setAttribute('controlslist', 'nodownload noremoteplayback');
      video.preload = 'auto';
      stage.replaceChildren(video);
      player.video = video;
      const playing = () => { loading.hidden = true; failure.hidden = true; overlay.dataset.cctvPlayback = 'playing'; if (player.timer !== null) { clearTimer(player.timer); player.timer = null; } };
      video.addEventListener('playing', playing);
      video.addEventListener('waiting', () => { if (player.video === video) { loading.textContent = '영상을 기다리는 중…'; loading.hidden = false; } });
      video.addEventListener('error', () => { if (player.video === video && engine === 'native') fail('영상을 재생하지 못했어요. 제공기관 영상이 잠시 끊겼을 수 있어요.'); });
      player.timer = setTimer(() => { player.timer = null; if (player.video === video && overlay.dataset.cctvPlayback !== 'playing') fail('영상이 응답하지 않아요. 잠시 후 다시 시도해 주세요.'); }, PLAY_TIMEOUT_MS);
      if (engine === 'native') {
        video.src = result.stream.url;
      } else {
        let Hls;
        try { Hls = await loadHlsLibrary({documentRef, windowRef}); } catch { fail('영상 재생 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
        if (!player.open || player.video !== video) return;
        if (!Hls.isSupported()) { fail('이 브라우저에서는 실시간 영상을 재생할 수 없어요. 최신 브라우저에서 열어 주세요.', {retry: false}); return; }
        const hls = new Hls({
          enableWorker: true, lowLatencyMode: false, liveDurationInfinity: true,
          maxBufferLength: 12, backBufferLength: 6, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 3,
          xhrSetup: xhr => { xhr.withCredentials = false; },
        });
        player.hls = hls;
        let recovered = false;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data?.fatal || player.hls !== hls) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); return; }
          fail(data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? '제공기관 영상에 연결하지 못했어요. 영상이 잠시 끊겼을 수 있어요.'
            : '영상을 재생하지 못했어요. 다시 시도해 주세요.');
        });
        hls.loadSource(result.stream.url);
        hls.attachMedia(video);
      }
      const attempt = video.play?.();
      attempt?.catch?.(() => {
        if (player.video === video && overlay.dataset.cctvPlayback !== 'playing') {
          loading.textContent = '재생 버튼을 눌러 영상을 시작해 주세요.';
        }
      });
    };

    const fullscreen = button('consumer-action consumer-action-secondary cctv-fullscreen', '전체화면', documentRef);
    fullscreen.addEventListener('click', () => {
      const video = player.video;
      if (!video) return;
      if (video.requestFullscreen) void video.requestFullscreen().catch(() => {});
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    });
    if (camera.kind !== 'STILL') actions.append(fullscreen);
    const mapLink = cctvMapLink(camera, mapProvider, {documentRef, userAgent, origin});
    if (mapLink) actions.append(mapLink);
    await start();
  }

  // ── start ──
  const restore = readSelection(storage);
  const roads = await loadRoads();
  if (!disposed && roads && restore?.roadType) {
    await chooseRoad(restore.roadType, {restore});
  } else if (!disposed && roads) {
    status.textContent = '먼저 고속도로 또는 국도를 골라 주세요.';
  }
  return {
    dispose() {
      disposed = true;
      controller?.abort();
      if (retryTimer !== null) clearTimer(retryTimer);
      windowRef.removeEventListener?.('popstate', onPopState);
      if (player.open) {
        releasePlayback();
        player.overlay?.remove();
        player.open = false;
      }
    },
    focus() { (showTitle ? title : intro).focus?.(); },
    state,
    player,
  };
}
