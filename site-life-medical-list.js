// LIFE-MEDICAL-MERGE-01 — 지역정보 '병원·응급실·약국': 같은 화면 안의 가까운 곳 목록.
//
// One card, one screen, no conversation. Three choices (병원·의원 / 응급실 / 약국)
// sit at the top of the screen; a tap lists the nearest places right below, with
// the same facts the conversation's place cards carry (name, distance, registered
// 진료·운영 hours, verified phone, the reader's map app). It reads only Core's
// public, guest-safe GET /v2/life/medical/nearby — the very search the
// conversation runs for "근처 병원 / 응급실 / 약국 찾아줘" (국립중앙의료원 data, the
// same ranking and wording) — so nothing is typed into the conversation and no AI
// is called.
//
// Location (the LOTBI location setting decides, USER_FIRST_STANDARD #2): setting
// on and the browser already allows it -> the list appears at once from the
// current position, sent for that one request only and never stored. Otherwise a
// region the reader picked before (or the calendar's saved region) is used at
// once; with neither, the two buttons [위치 허용하고 찾기] / [지역 고르기] are the
// screen — never a question typed back. A region the reader picks is remembered
// for next time. The position is asked for only by a tap on [위치 허용하고 찾기]:
// opening the screen (or reloading it) never shows the browser's permission
// prompt.
//
// TODO(site-location-allow.js): the 대화·답변 UX room's shared 위치 허용/지역 선택
// part is not in main yet. This screen implements the same rules itself (the EV
// charger screen's); replace it with the shared part when that lands.
import {CORE_ORIGIN} from './site-core.js?v=aset-fdd47c03ea65';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-fdd47c03ea65';
import {isLocationUsageEnabled, readDefaultMapProvider} from './site-location-preference.js?v=aset-fdd47c03ea65';
import {buildDefaultMapHref, buildNaverPlaceSearchUrl, buildVerifiedPhoneHref, formatDistanceMeters, normalizePlaceResult} from './site-navigation.js?v=aset-fdd47c03ea65';
import {readCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-fdd47c03ea65';
import {savedRegionLabel} from './site-life-location.js?v=aset-fdd47c03ea65';
import {medicalStatusLines} from './site-life-medical.js?v=aset-fdd47c03ea65';
import {EV_MAP_ICON_BASE, EV_MAP_ICON_VERSION, evMapIcon} from './site-life-ev-chargers.js?v=aset-fdd47c03ea65';

export const MEDICAL_MENU_LABEL = '병원·응급실·약국';
export const MEDICAL_CONTRACT_ID = 'CORE-LIFE-MEDICAL-NEARBY-01';
export const MEDICAL_KINDS = Object.freeze([
  Object.freeze({id: 'hospital', label: '병원·의원', noun: '병원·의원'}),
  Object.freeze({id: 'emergency', label: '응급실', noun: '응급실'}),
  Object.freeze({id: 'pharmacy', label: '약국', noun: '약국'}),
]);
export const MEDICAL_SPECIALTIES = Object.freeze([
  Object.freeze({id: 'internal', label: '내과'}),
  Object.freeze({id: 'pediatrics', label: '소아청소년과'}),
  Object.freeze({id: 'ent', label: '이비인후과'}),
  Object.freeze({id: 'orthopedics', label: '정형외과'}),
  Object.freeze({id: 'dermatology', label: '피부과'}),
  Object.freeze({id: 'dentistry', label: '치과'}),
  Object.freeze({id: 'oriental', label: '한의원'}),
  Object.freeze({id: 'ophthalmology', label: '안과'}),
  Object.freeze({id: 'obgyn', label: '산부인과'}),
  Object.freeze({id: 'family', label: '가정의학과'}),
  Object.freeze({id: 'neurology', label: '신경과'}),
  Object.freeze({id: 'psychiatry', label: '정신건강의학과'}),
  Object.freeze({id: 'surgery', label: '외과'}),
  Object.freeze({id: 'neurosurgery', label: '신경외과'}),
  Object.freeze({id: 'urology', label: '비뇨의학과'}),
  Object.freeze({id: 'rehabilitation', label: '재활의학과'}),
  Object.freeze({id: 'plastic_surgery', label: '성형외과'}),
  Object.freeze({id: '', label: '전체'}),
]);
const PRIMARY_SPECIALTY_IDS = new Set(['internal', 'pediatrics', 'ent', 'orthopedics', 'dermatology', 'dentistry', 'oriental']);
// Five at first, five more per tap, up to what one Core read carries.
export const MEDICAL_PAGE_SIZE = 5;
export const MEDICAL_FETCH_LIMIT = 15;
export const MEDICAL_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
export const MEDICAL_SOURCE_LABEL = '국립중앙의료원 공공데이터(전국 병·의원·약국·응급의료기관)';
export const MEDICAL_KIND_STORAGE_KEY = 'lotbi.life.medical-kind.v1';
export const MEDICAL_REGION_STORAGE_KEY = 'lotbi.life.medical-region.v1';
const EMERGENCY_NOTICE_FALLBACK = '생명이 위급하거나 응급 증상이 의심되면 지금 바로 119에 전화하세요.';
const PHONE_ICON = 'phone';
const TIMEOUT_MS = 15_000;
const STATUSES = new Set(['OK', 'EMPTY', 'NEEDS_LOCATION', 'UNAVAILABLE', 'DISABLED']);
const text = value => (typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '');
const kindOf = id => MEDICAL_KINDS.find(item => item.id === id) || MEDICAL_KINDS[0];
const specialtyOf = id => MEDICAL_SPECIALTIES.find(item => item.id === id) || MEDICAL_SPECIALTIES[0];
const round3 = value => Math.round(Number(value) * 1000) / 1000;

// The same Korea box Core's WebConversationClientLocation accepts.
export function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 31 && latitude <= 44.5 && longitude >= 122 && longitude <= 132.5;
}

export function medicalNearbyUrl({kind, specialty = '', latitude, longitude, source = 'BROWSER_CURRENT', label = '', limit = MEDICAL_FETCH_LIMIT} = {}, coreOrigin = CORE_ORIGIN) {
  if (!MEDICAL_KINDS.some(item => item.id === kind)) throw new TypeError('unknown medical kind');
  if (!inKorea(Number(latitude), Number(longitude))) throw new TypeError('a location in Korea is required');
  const params = new URLSearchParams();
  params.set('kind', kind);
  if (kind === 'hospital' && specialty) {
    if (!MEDICAL_SPECIALTIES.some(item => item.id === specialty)) throw new TypeError('unknown medical specialty');
    params.set('specialty', specialty);
  }
  // ~100 m: enough for a nearest-first list, no finer than Core keeps.
  params.set('latitude', String(round3(latitude)));
  params.set('longitude', String(round3(longitude)));
  if (source === 'SAVED_REGION') {
    const clean = savedRegionLabel(label);
    if (!clean) throw new TypeError('a region name is required');
    params.set('source', 'SAVED_REGION');
    params.set('label', clean);
  }
  params.set('limit', String(Number.isInteger(limit) && limit >= 1 && limit <= MEDICAL_FETCH_LIMIT ? limit : MEDICAL_FETCH_LIMIT));
  return `${coreOrigin}/v2/life/medical/nearby?${params}`;
}

// One institution once: the same name at the same address (or under the same
// verified phone) is a place listed twice (Core folds NMC rows by id only).
function placeIdentity(value) {
  return String(value || '').toLowerCase().replace(/[\s()[\]·.,-]/gu, '');
}

export function normalizeMedicalNearby(value, {capturedAt = Date.now()} = {}) {
  if (!value || typeof value !== 'object' || value.contract_id !== MEDICAL_CONTRACT_ID || value.schema_version !== 1) return null;
  if (!MEDICAL_KINDS.some(item => item.id === value.kind)) return null;
  const status = text(value.status);
  if (!STATUSES.has(status)) return null;
  const specialty = text(value.specialty);
  if (specialty && !MEDICAL_SPECIALTIES.some(item => item.id === specialty)) return null;
  let places = [];
  if (status === 'OK') {
    const placeResult = normalizePlaceResult(value.place_result, {capturedAt, limit: MEDICAL_FETCH_LIMIT});
    const seen = new Set();
    for (const place of placeResult?.results || []) {
      const keys = [`${placeIdentity(place.name)}@${placeIdentity(place.address)}`];
      if (place.phoneHref) keys.push(`${placeIdentity(place.name)}@${place.phoneHref}`);
      if (keys.some(key => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      const medicalPhoto = place.photoEvidence
        && ['EXACT_NAME_AND_ADDRESS', 'EXACT_NAME_AND_PHONE'].includes(place.photoEvidence.matchBasis)
        ? place
        : Object.freeze({...place, imageUrl: '', photoEvidence: null});
      places.push(medicalPhoto);
    }
    return Object.freeze({
      kind: value.kind, specialty, status, places: Object.freeze(places.slice(0, MEDICAL_FETCH_LIMIT)), query: placeResult?.query || '',
      message: text(value.message), basisLabel: text(value.basis_label), sortBasis: text(value.sort_basis),
      emergencyNotice: text(value.emergency_call_notice),
      partial: value.medical_result?.coverage === 'PARTIAL',
    });
  }
  return Object.freeze({
    kind: value.kind, specialty, status, places: Object.freeze([]), query: '',
    message: text(value.message), basisLabel: '', sortBasis: '',
    emergencyNotice: text(value.emergency_call_notice), partial: false,
  });
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

function el(tag, className = '', value = '', documentRef = document) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function actionIcon(name, documentRef) {
  const image = el('img', 'medical-action-icon', '', documentRef);
  image.src = `${EV_MAP_ICON_BASE}${name}.png?v=${EV_MAP_ICON_VERSION}`;
  image.alt = ''; image.width = 28; image.height = 28; image.decoding = 'async';
  image.addEventListener('error', () => { image.hidden = true; }, {once: true});
  return image;
}

function safeHttps(value) {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function photoAttribution(place, documentRef) {
  const evidence = place.photoEvidence;
  if (!evidence || evidence.provider !== 'GOOGLE_PLACES') return null;
  const line = el('p', 'medical-photo-attribution', '사진: ', documentRef);
  const google = el('a', '', 'Google Maps', documentRef);
  const placeId = text(evidence.providerPlaceId);
  const params = new URLSearchParams({api: '1', query: place.name});
  if (placeId) params.set('query_place_id', placeId);
  google.href = `https://www.google.com/maps/search/?${params}`;
  google.target = '_blank'; google.rel = 'noopener noreferrer';
  line.append(google);
  for (const raw of Array.isArray(evidence.attributions) ? evidence.attributions : []) {
    const name = text(raw?.display_name || raw?.displayName);
    if (!name) continue;
    line.append(documentRef.createTextNode(' · '));
    const uri = safeHttps(raw?.uri);
    if (uri) {
      const author = el('a', '', name, documentRef);
      author.href = uri; author.target = '_blank'; author.rel = 'noopener noreferrer';
      line.append(author);
    } else {
      line.append(documentRef.createTextNode(name));
    }
  }
  return line;
}

function institutionGlyph(place) {
  const category = `${place.category || ''} ${place.name || ''}`;
  if (/응급/u.test(category)) return '🚑';
  if (/약국/u.test(category)) return '⚕';
  if (/치과/u.test(category)) return '🦷';
  if (/한의/u.test(category)) return '十';
  return '✚';
}

function medicalBadges(place) {
  const status = place.medicalStatus;
  if (!status) return [{state: 'UNKNOWN', label: '운영시간 확인 필요'}];
  const out = [];
  if (status.openState === 'OPEN') out.push({state: 'OPEN', label: status.kind === 'PHARMACY' ? '영업 중' : '진료 중'});
  else if (status.openState === 'NOT_LISTED') out.push({state: 'UNKNOWN', label: '운영시간 확인 필요'});
  const labels = {NIGHT: '야간진료', HOLIDAY: '휴일진료', ALL_DAY: '24시간', CLOSING_SOON: '곧 마감'};
  for (const state of status.badges || []) if (labels[state]) out.push({state, label: labels[state]});
  return out;
}

// One place, the way a conversation place card says it: name (opens the NAVER
// search for the place), kind and address, the registered-hours lines, and the
// two actions — a verified phone and the map app the reader saved.
export function medicalPlaceItem(place, {query = '', partial = false, mapProvider, documentRef = document, userAgent, origin, fromRegion = ''} = {}) {
  const item = el('li', 'medical-place', '', documentRef);
  item.dataset.medicalPlace = place.resultId;
  // A photo only when Core sent a verified exact-identity match. Missing or failed
  // photos keep a stable institution placeholder so the card never collapses.
  const media = el('div', 'medical-place-media', '', documentRef);
  const placeholder = el('span', 'medical-place-placeholder', institutionGlyph(place), documentRef);
  placeholder.setAttribute('aria-hidden', 'true');
  media.append(placeholder);
  if (place.imageUrl) {
    const image = el('img', 'medical-place-photo', '', documentRef);
    image.alt = `${place.name} 대표 사진`;
    image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => { placeholder.hidden = true; }, {once: true});
    image.addEventListener('error', () => { image.remove(); placeholder.hidden = false; }, {once: true});
    image.src = place.imageUrl;
    media.append(image);
    const attribution = photoAttribution(place, documentRef);
    if (attribution) media.append(attribution);
  }
  item.append(media);
  const head = el('div', 'medical-place-head', '', documentRef);
  const heading = el('h4', 'medical-place-name', '', documentRef);
  const nameLink = el('a', 'medical-place-link', place.name, documentRef);
  nameLink.href = buildNaverPlaceSearchUrl(place, {searchContext: query});
  nameLink.target = '_blank'; nameLink.rel = 'noopener noreferrer';
  nameLink.dataset.placeSearch = 'NAVER_SEARCH';
  nameLink.setAttribute('aria-label', `네이버에서 ${place.name} 검색`);
  heading.append(nameLink);
  head.append(heading);
  item.append(head);
  const categoryRow = el('div', 'medical-place-category-row', '', documentRef);
  if (place.category) categoryRow.append(el('p', 'medical-place-category', place.category, documentRef));
  for (const badge of medicalBadges(place)) {
    const node = el('span', 'medical-place-badge', badge.label, documentRef);
    node.dataset.medicalBadge = badge.state;
    categoryRow.append(node);
  }
  if (categoryRow.childElementCount) item.append(categoryRow);
  if (place.address) item.append(el('p', 'medical-place-address', place.address, documentRef));
  const lines = medicalStatusLines(place, {partial});
  const hours = el('div', 'medical-place-lines', '', documentRef);
  for (const [index, line] of lines.entries()) {
    const distance = index === 0 && Number.isInteger(place.distanceMeters)
      ? `${fromRegion ? `${fromRegion} 중심에서 ` : ''}직선 ${formatDistanceMeters(place.distanceMeters)}`
      : '';
    const node = el('p', index === 0 && ['OPEN', 'CLOSED'].includes(line.state) ? 'medical-place-state' : 'medical-place-note', line.text, documentRef);
    if (distance) node.append(documentRef.createTextNode(' · '), el('span', 'medical-place-distance', distance, documentRef));
    node.dataset.medicalState = line.state;
    hours.append(node);
  }
  if (hours.childElementCount) item.append(hours);

  const actions = el('div', 'medical-place-actions', '', documentRef);
  const phoneHref = buildVerifiedPhoneHref(place);
  if (phoneHref) {
    const phone = el('a', 'medical-action medical-action-phone', '', documentRef);
    phone.href = phoneHref;
    phone.dataset.medicalAction = 'phone';
    phone.setAttribute('aria-label', `${place.name} 전화하기`);
    phone.title = '전화하기';
    phone.append(actionIcon(PHONE_ICON, documentRef), el('span', 'medical-action-label', '전화하기', documentRef));
    actions.append(phone);
  }
  let mapHref = '';
  try {
    mapHref = buildDefaultMapHref(mapProvider, place, {userAgent, ...(origin ? {origin} : {})});
  } catch {
    mapHref = '';                                             // no link rather than a wrong one
  }
  if (mapHref) {
    const {icon, label} = evMapIcon(mapProvider, {userAgent});
    const map = el('a', 'medical-action medical-action-map', '', documentRef);
    map.href = mapHref; map.target = '_blank'; map.rel = 'noopener noreferrer';
    map.dataset.medicalAction = 'map';
    map.dataset.mapProvider = mapProvider;
    map.dataset.mapIcon = icon;
    map.setAttribute('aria-label', `${place.name} 길찾기 (${label})`);
    map.title = `${label}에서 길찾기`;
    map.append(actionIcon(icon, documentRef), el('span', 'medical-action-label', '길찾기', documentRef));
    actions.append(map);
  }
  if (actions.childElementCount) item.append(actions);
  return item;
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try { storage?.setItem?.(key, JSON.stringify(value)); } catch { /* the screen works without remembering */ }
}

function normalizeRegion(value) {
  if (!value || typeof value !== 'object') return null;
  const label = savedRegionLabel(value.label);
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  return label && inKorea(latitude, longitude) ? {label, latitude, longitude} : null;
}

export async function mountMedicalList({
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
  initialKind = '',
} = {}) {
  let disposed = false;
  let requestToken = 0;
  let controller = null;
  let regionCatalog = null;
  let catalogError = false;
  const rememberedKind = readJson(storage, MEDICAL_KIND_STORAGE_KEY);
  const state = {
    kind: kindOf(initialKind || (typeof rememberedKind === 'string' ? rememberedKind : '')).id,
    specialty: '',
    mode: 'none',                 // 'location' | 'region' | 'none'
    location: null,               // memory only, this screen only
    region: normalizeRegion(readJson(storage, MEDICAL_REGION_STORAGE_KEY)) || normalizeRegion(readCalendarManualWeatherRegion(storage)),
    places: [],
    allPlaces: [],
    shown: 0,
    statusOnly: false,
    query: '',
    partial: false,
    basisLabel: '',               // Core's own words for the place it searched from
    sourceBase: '',
    requests: 0,
  };
  const mapProvider = readDefaultMapProvider(documentRef.cookie || '');

  root.classList.add('medical-surface');
  const title = el('h3', 'medical-title', MEDICAL_MENU_LABEL, documentRef); title.tabIndex = -1;
  const kindRow = el('div', 'festival-chip-row medical-kind-row', '', documentRef);
  kindRow.setAttribute('role', 'group'); kindRow.setAttribute('aria-label', '찾을 곳');
  const kindButtons = new Map();
  for (const kind of MEDICAL_KINDS) {
    const chip = el('button', 'festival-chip medical-kind', kind.label, documentRef);
    chip.type = 'button'; chip.dataset.medicalKind = kind.id;
    chip.addEventListener('click', () => pickKind(kind.id));
    kindButtons.set(kind.id, chip); kindRow.append(chip);
  }
  const specialtySection = el('section', 'medical-specialty', '', documentRef);
  specialtySection.setAttribute('aria-label', '진료과 선택');
  const specialtyHeading = el('h4', 'medical-specialty-title', '진료과 선택', documentRef);
  const specialtyPrimary = el('div', 'festival-chip-row medical-specialty-row', '', documentRef);
  specialtyPrimary.setAttribute('role', 'group'); specialtyPrimary.setAttribute('aria-label', '주요 진료과');
  const specialtyMore = el('div', 'festival-chip-row medical-specialty-row medical-specialty-more-list', '', documentRef);
  specialtyMore.setAttribute('role', 'group'); specialtyMore.setAttribute('aria-label', '다른 진료과'); specialtyMore.hidden = true;
  const specialtyButtons = new Map();
  let allSpecialtyButton = null;
  for (const specialty of MEDICAL_SPECIALTIES) {
    const chip = el('button', 'festival-chip medical-specialty-chip', specialty.label, documentRef);
    chip.type = 'button'; chip.dataset.medicalSpecialty = specialty.id || 'all';
    chip.addEventListener('click', () => pickSpecialty(specialty.id));
    specialtyButtons.set(specialty.id, chip);
    if (!specialty.id) allSpecialtyButton = chip;
    else (PRIMARY_SPECIALTY_IDS.has(specialty.id) ? specialtyPrimary : specialtyMore).append(chip);
  }
  const specialtyMoreToggle = el('button', 'medical-specialty-more', '더보기⌄', documentRef);
  specialtyMoreToggle.type = 'button'; specialtyMoreToggle.dataset.medicalSpecialtyMore = 'true';
  specialtyMoreToggle.setAttribute('aria-expanded', 'false');
  specialtyMoreToggle.addEventListener('click', () => {
    const open = specialtyMore.hidden;
    specialtyMore.hidden = !open;
    specialtyMoreToggle.setAttribute('aria-expanded', String(open));
    specialtyMoreToggle.textContent = open ? '접기⌃' : '더보기⌄';
  });
  specialtyPrimary.append(specialtyMoreToggle, allSpecialtyButton);
  specialtySection.append(specialtyHeading, specialtyPrimary, specialtyMore);
  const statusFilter = el('label', 'medical-status-filter', '', documentRef);
  const statusCheckbox = el('input', 'medical-status-filter-input', '', documentRef);
  statusCheckbox.type = 'checkbox'; statusCheckbox.dataset.medicalStatusOnly = 'true';
  statusCheckbox.checked = state.statusOnly;
  const statusFilterText = el('span', 'medical-status-filter-text', '지금 진료 중만', documentRef);
  statusFilter.append(statusCheckbox, statusFilterText);
  specialtySection.append(statusFilter);
  const emergency = el('div', 'medical-emergency', '', documentRef);
  emergency.dataset.medicalEmergency = 'true';
  const emergencyText = el('span', 'medical-emergency-text', EMERGENCY_NOTICE_FALLBACK, documentRef);
  const call119 = el('a', 'medical-call', '119 전화', documentRef);
  call119.href = 'tel:119'; call119.setAttribute('aria-label', '119에 전화하기'); call119.dataset.medicalAction = 'call-119';
  emergency.append(emergencyText, call119);
  emergency.hidden = true;
  const whereRow = el('div', 'medical-where-row', '', documentRef);
  const locate = el('button', 'consumer-action medical-locate', '위치 허용하고 찾기', documentRef);
  locate.type = 'button'; locate.dataset.medicalLocate = 'true';
  const regionToggle = el('button', 'consumer-action consumer-action-secondary medical-region-toggle', '지역 고르기', documentRef);
  regionToggle.type = 'button'; regionToggle.dataset.medicalRegionToggle = 'true'; regionToggle.setAttribute('aria-pressed', 'false');
  whereRow.append(locate, regionToggle);
  const locationNote = el('p', 'consumer-feature-note medical-location-note', '', documentRef);
  locationNote.setAttribute('role', 'status');
  const regionRow = el('div', 'medical-region-row', '', documentRef);
  const provinceSelect = el('select', '', '', documentRef);
  provinceSelect.dataset.medicalRegion = 'province'; provinceSelect.setAttribute('aria-label', '시·도');
  const citySelect = el('select', '', '', documentRef);
  citySelect.dataset.medicalRegion = 'city'; citySelect.setAttribute('aria-label', '시·군'); citySelect.disabled = true;
  for (const [select, labelText] of [[provinceSelect, '시·도'], [citySelect, '시·군']]) {
    const label = el('label', 'consumer-life-field medical-region-field', labelText, documentRef);
    label.append(select); regionRow.append(label);
  }
  regionRow.hidden = true;
  const basis = el('p', 'medical-basis', '', documentRef);
  const status = el('p', 'medical-status', '', documentRef); status.setAttribute('role', 'status');
  const notice = el('p', 'consumer-feature-note medical-notice', '', documentRef); notice.hidden = true;
  const error = el('div', 'medical-error', '', documentRef); error.setAttribute('role', 'alert'); error.hidden = true;
  const list = el('ol', 'medical-results', '', documentRef);
  const more = el('button', 'consumer-action consumer-action-secondary medical-more', '더 보기', documentRef);
  more.type = 'button'; more.hidden = true; more.dataset.medicalMore = 'true';
  const source = el('p', 'consumer-feature-note medical-source', '', documentRef);
  root.replaceChildren(...(showTitle ? [title] : []), kindRow, whereRow, locationNote, specialtySection, emergency, regionRow, basis, status, notice, error, list, more, source);

  const kind = () => kindOf(state.kind);
  const regionLabel = () => (state.mode === 'region' && state.region ? state.region.label : '');
  const point = () => (state.mode === 'location' ? state.location : state.mode === 'region' ? state.region : null);

  function renderKinds() {
    for (const [id, button] of kindButtons) button.setAttribute('aria-pressed', String(id === state.kind));
    for (const [id, button] of specialtyButtons) button.setAttribute('aria-pressed', String(id === state.specialty));
    specialtySection.hidden = state.kind !== 'hospital';
    statusFilterText.textContent = state.kind === 'pharmacy' ? '지금 영업 중만' : state.kind === 'emergency' ? '현재 진료 가능 우선' : '지금 진료 중만';
    emergency.hidden = state.kind !== 'emergency';
  }

  function renderWhere() {
    regionToggle.setAttribute('aria-pressed', String(!regionRow.hidden));
    const fallback = state.mode === 'location' ? '현재 위치' : state.region && state.mode === 'region' ? state.region.label : '';
    const where = state.basisLabel && fallback ? state.basisLabel : fallback;
    const area = (state.mode === 'region' ? String(state.region?.label || '') : String(where || ''))
      .replace(/^현재 위치\s*[(:：]?\s*/u, '')
      .replace(/[)]$/u, '')
      .trim();
    locate.textContent = state.mode === 'none'
      || (state.mode === 'location' && !state.location)
      || (state.mode === 'region' && !state.region)
      ? '📍 내 위치 찾기'
      : `📍 현재 위치${area && area !== '현재 위치' ? ` · ${area}` : ''}`;
    locate.classList.add('consumer-action-secondary');
    basis.textContent = where ? `${where} 기준` : '';
    basis.hidden = !where;
  }

  function setRegionRowOpen(open) {
    regionRow.hidden = !open;
    renderWhere();
  }

  function clearResults() {
    list.replaceChildren(); more.hidden = true; error.hidden = true; notice.hidden = true; source.textContent = '';
    delete status.dataset.medicalReady;
    state.places = []; state.allPlaces = []; state.shown = 0;
  }

  // Never a dead end: every problem names what happened and offers the next tap.
  function showProblem(message, {retry = true, pickRegion = true, onRetry = () => search({reset: true})} = {}) {
    delete status.dataset.medicalReady;
    status.textContent = '';
    const row = [el('span', 'medical-error-text', message, documentRef)];
    const buttons = el('div', 'medical-error-actions', '', documentRef);
    if (retry) {
      const again = el('button', 'consumer-action consumer-action-secondary medical-retry', '다시 시도', documentRef);
      again.type = 'button'; again.dataset.medicalRetry = 'true';
      again.addEventListener('click', () => void onRetry());
      buttons.append(again);
    }
    if (pickRegion) {
      const pick = el('button', 'consumer-action consumer-action-secondary medical-pick-region', '지역 고르기', documentRef);
      pick.type = 'button'; pick.dataset.medicalPickRegion = 'true';
      pick.addEventListener('click', () => void openRegionPicker());
      buttons.append(pick);
    }
    if (kind().id === 'emergency') {
      const call = el('a', 'consumer-action medical-call medical-call-inline', '119 전화', documentRef);
      call.href = 'tel:119'; call.dataset.medicalAction = 'call-119'; call.setAttribute('aria-label', '119에 전화하기');
      buttons.append(call);
    }
    error.replaceChildren(...row, buttons);
    error.hidden = false;
  }

  function renderMore() {
    const rest = state.places.length - state.shown;
    more.hidden = rest <= 0;
    if (rest > 0) more.textContent = `더 보기 (${Math.min(rest, MEDICAL_PAGE_SIZE)}곳)`;
  }

  function appendPlaces(count) {
    const next = state.places.slice(state.shown, state.shown + count);
    for (const place of next) {
      list.append(medicalPlaceItem(place, {query: state.query, partial: state.partial, mapProvider, documentRef, userAgent, origin, fromRegion: regionLabel()}));
    }
    state.shown += next.length;
    renderMore();
    renderCount();
  }

  function applyStatusFilter() {
    if (!state.statusOnly) state.places = [...state.allPlaces];
    else if (state.kind === 'emergency') {
      state.places = [...state.allPlaces].sort((a, b) => {
        const available = place => place.emergencyStatus?.realtimeState === 'FRESH'
          && (place.emergencyStatus.erOperating === true || place.emergencyStatus.beds.some(item => item.label === '응급실' && item.available > 0));
        return Number(available(b)) - Number(available(a));
      });
    } else {
      state.places = state.allPlaces.filter(place => ['OPEN', 'ALL_DAY'].includes(place.medicalStatus?.openState));
    }
    list.replaceChildren(); state.shown = 0;
    if (state.places.length) appendPlaces(MEDICAL_PAGE_SIZE);
    else { renderMore(); renderCount(); }
  }

  function renderCount() {
    const noun = state.kind === 'hospital' && state.specialty ? specialtyOf(state.specialty).label : kind().noun;
    const where = state.mode === 'location' ? '내 주변' : `${state.region?.label || ''}`;
    const total = state.places.length;
    const heading = state.mode === 'location' ? `가까운 ${noun}` : `${where} ${noun}`.replace(/\s+/gu, ' ').trim();
    const label = el('span', 'medical-status-heading', heading, documentRef);
    const count = el('strong', 'medical-status-count', `${total}곳`, documentRef);
    status.replaceChildren(label, documentRef.createTextNode(' '), count);
    status.dataset.medicalReady = 'true';
    // One Core read carries at most MEDICAL_FETCH_LIMIT places: say so rather
    // than let the list read as "all there is".
    source.textContent = state.shown >= total && total >= MEDICAL_FETCH_LIMIT
      ? `${state.sourceBase} 가까운 ${MEDICAL_FETCH_LIMIT}곳까지 보여 드려요.`
      : state.sourceBase;
  }

  async function search({reset = true} = {}) {
    if (disposed) return;
    renderKinds(); renderWhere();
    controller?.abort(); controller = new AbortController();
    const token = ++requestToken;
    const target = point();
    if (!target) {
      clearResults();
      status.textContent = `내 위치나 지역을 알려 주시면 가까운 ${kind().noun}을 바로 보여 드려요.`;
      return;
    }
    if (reset) clearResults();
    state.basisLabel = '';
    renderWhere();
    delete status.dataset.medicalReady;
    status.textContent = `${kind().noun}을 찾는 중…`;
    let url;
    try {
      url = medicalNearbyUrl({
        kind: state.kind, specialty: state.kind === 'hospital' ? state.specialty : '', latitude: target.latitude, longitude: target.longitude,
        source: state.mode === 'region' ? 'SAVED_REGION' : 'BROWSER_CURRENT', label: state.mode === 'region' ? target.label : '',
      });
    } catch {
      showProblem('국내 위치에서만 찾을 수 있어요. 지역을 골라 주세요.', {retry: false});
      return;
    }
    state.requests += 1;
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || token !== requestToken) return;
    const result = response.ok ? normalizeMedicalNearby(response.data) : null;
    if (!result || result.kind !== state.kind || result.specialty !== (state.kind === 'hospital' ? state.specialty : '')) {
      showProblem(response.status === 429
        ? '조회가 잠시 많았어요. 1분 뒤에 다시 시도해 주세요.'
        : `${kind().noun} 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.`);
      return;
    }
    const noun = state.kind === 'hospital' && state.specialty ? specialtyOf(state.specialty).label : kind().noun;
    // An emergency room that cannot be listed still has a next step: 119.
    const help = state.kind === 'emergency' ? ' 급하면 119에 전화하세요.' : '';
    state.sourceBase = `운영시간은 등록된 정보예요. 방문 전 전화로 확인해 주세요. 출처: ${MEDICAL_SOURCE_LABEL}. 거리는 직선거리예요.`;
    if (result.emergencyNotice) emergencyText.textContent = result.emergencyNotice;
    if (result.status === 'DISABLED') {
      showProblem(`${noun} 정보 연결을 준비하고 있어요. 준비가 끝나면 이 화면에서 바로 보여 드릴게요.${help}`, {pickRegion: false});
      return;
    }
    if (result.status === 'NEEDS_LOCATION') {
      showProblem('위치를 알려 주시면 가까운 곳을 찾아 드려요.', {retry: false});
      return;
    }
    if (result.status === 'UNAVAILABLE') {
      // "No result" and "could not check" are told apart: Core's words say the
      // second is not the first.
      showProblem(`공공데이터 ${noun} 정보를 지금 확인하지 못했어요. 가까운 ${noun}이 없다는 뜻은 아니에요. 잠시 후 다시 시도해 주세요.${help}`);
      return;
    }
    if (result.status === 'EMPTY' || !result.places.length) {
      if (result.status === 'OK') {
        showProblem(`${noun} 목록을 읽지 못했어요. 다시 시도해 주세요.`);
        return;
      }
      const where = state.mode === 'location' ? '내 주변' : state.region?.label || '이 지역';
      showProblem(`${where}에서 ${noun}을 찾지 못했어요. 다른 지역을 골라 보세요.${help}`, {retry: false});
      return;
    }
    state.allPlaces = [...result.places]; state.places = [...result.places]; state.shown = 0;
    state.query = result.query; state.partial = result.partial; state.basisLabel = result.basisLabel;
    renderWhere();
    const notes = [];
    if (result.sortBasis) notes.push(state.kind === 'emergency'
      ? (state.mode === 'location' ? '현재 진료 가능 우선 · 가까운 순' : '이름 순')
      : `${state.kind === 'pharmacy' ? '영업' : '진료'} 중 우선 · ${state.mode === 'location' ? '가까운 순' : '이름 순'}`);
    if (result.partial) notes.push('일부 기관만 확인');
    if (notes.length) { notice.textContent = notes.join(' '); notice.hidden = false; }
    applyStatusFilter();
  }

  function pickKind(id) {
    if (id === state.kind && state.places.length) return;
    state.kind = id;
    writeJson(storage, MEDICAL_KIND_STORAGE_KEY, id);
    void search({reset: true});
  }

  function pickSpecialty(id) {
    if (state.kind !== 'hospital' || specialtyOf(id).id !== id) return;
    state.specialty = id && id === state.specialty ? '' : id;
    void search({reset: true});
  }

  statusCheckbox.addEventListener('change', () => {
    state.statusOnly = statusCheckbox.checked;
    applyStatusFilter();
  });

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

  function fillCities(province, selected = '') {
    citySelect.replaceChildren(new Option('시·군 선택', ''));
    for (const item of regionCatalog?.regions || []) {
      if (item.province === province) citySelect.append(new Option(item.label, item.label));
    }
    citySelect.disabled = citySelect.options.length <= 1;
    if (selected) citySelect.value = selected;
  }

  // Opens the 시·도 / 시·군 picker (filled from the catalog, preselecting the
  // remembered region). It never searches by itself.
  async function openRegionPicker() {
    setRegionRowOpen(true);
    const catalog = await loadRegionCatalog();
    if (disposed) return false;
    provinceSelect.replaceChildren(new Option('시·도 선택', ''));
    if (catalog) {
      for (const province of catalog.provinces) provinceSelect.append(new Option(province, province));
      const chosen = state.region ? catalog.regions.find(item => item.label === state.region.label) : null;
      if (chosen) { provinceSelect.value = chosen.province; fillCities(chosen.province, chosen.label); }
      if (catalogError) {
        // The 지역 목록 came back: the message about it goes, the picker is the way on.
        catalogError = false; error.hidden = true;
        status.textContent = `시·도와 시·군을 고르면 그곳의 ${kind().noun}을 보여 드려요.`;
      }
      return true;
    }
    // The 지역 목록 itself could not be read: say so and let the reader retry.
    // A region already remembered still searches (enterRegionMode).
    if (!state.region) {
      clearResults();
      catalogError = true;
      showProblem('지역 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', {
        pickRegion: false, onRetry: () => { regionCatalog = null; return openRegionPicker(); },
      });
    }
    return false;
  }

  async function enterRegionMode(note) {
    state.mode = 'region'; state.location = null;
    if (note !== undefined) locationNote.replaceChildren(...(Array.isArray(note) ? note : [note]));
    const listed = await openRegionPicker();
    if (disposed) return;
    if (state.region) await search({reset: true});
    else if (listed) { clearResults(); renderKinds(); renderWhere(); status.textContent = `시·도와 시·군을 고르면 그곳의 ${kind().noun}을 보여 드려요.`; }
  }

  async function useCurrentLocation({prompt = true} = {}) {
    let enabled = false;
    try { enabled = locationUsageEnabled() === true; } catch { enabled = false; }
    if (!enabled) {
      const link = el('a', '', '설정에서 위치 켜기', documentRef); link.href = MEDICAL_SETTINGS_URL; link.rel = 'noopener';
      link.dataset.medicalSettings = 'true';
      return enterRegionMode(['위치 사용이 꺼져 있어 고른 지역에서 찾아 드려요. ', link]);
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
        ? '위치 권한이 허용되지 않아 고른 지역에서 찾아 드려요.'
        : '현재 위치를 확인하지 못해 고른 지역에서 찾아 드려요.');
    }
    state.mode = 'location'; state.location = location;
    setRegionRowOpen(false);
    locationNote.textContent = '위치는 이번 검색에만 쓰고 저장하지 않아요.';
    return search({reset: true});
  }

  locate.addEventListener('click', () => void useCurrentLocation({prompt: true}));
  regionToggle.addEventListener('click', () => {
    if (regionRow.hidden) void openRegionPicker();
    else setRegionRowOpen(false);
  });
  provinceSelect.addEventListener('change', () => {
    fillCities(provinceSelect.value);
    if (provinceSelect.value) citySelect.focus?.();
  });
  citySelect.addEventListener('change', () => {
    const chosen = regionCatalog?.regions.find(item => item.label === citySelect.value && item.province === provinceSelect.value);
    if (!chosen) return;
    state.mode = 'region'; state.location = null;
    state.region = {label: chosen.label, latitude: chosen.latitude, longitude: chosen.longitude};
    // Remembered: the next opening starts from this region.
    writeJson(storage, MEDICAL_REGION_STORAGE_KEY, state.region);
    locationNote.textContent = '';
    void search({reset: true});
  });
  more.addEventListener('click', () => appendPlaces(MEDICAL_PAGE_SIZE));

  renderKinds(); renderWhere();
  // The LOTBI location setting decides; nothing here shows the browser's
  // permission prompt by itself.
  let usage = false;
  let permission = LOCATION_PERMISSION.UNKNOWN;
  try { usage = locationUsageEnabled() === true; } catch { usage = false; }
  if (usage) {
    try { permission = await permissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
  }
  if (!disposed) {
    if (usage && permission === LOCATION_PERMISSION.GRANTED) {
      await useCurrentLocation({prompt: false});
    } else if (!usage) {
      await useCurrentLocation({prompt: false});               // says why, opens the region picker
    } else if (permission === LOCATION_PERMISSION.DENIED || permission === LOCATION_PERMISSION.UNAVAILABLE) {
      await enterRegionMode('위치 권한이 허용되지 않아 고른 지역에서 찾아 드려요.');
    } else if (state.region) {
      await enterRegionMode('현재 위치로 찾으려면 "위치 허용하고 찾기"를 눌러 주세요.');
    } else {
      // Nothing to start from: the two buttons are the screen.
      await openRegionPicker();
      if (!disposed) {
        locationNote.textContent = '"위치 허용하고 찾기"를 누르거나 지역을 골라 주세요.';
        await search({reset: true});
      }
    }
  }
  return {
    dispose() {
      disposed = true;
      controller?.abort();
    },
    focus() { (showTitle ? title : kindRow.querySelector('button')).focus?.(); },
    state,
  };
}
