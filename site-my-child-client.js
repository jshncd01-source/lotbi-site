// MY-CHILD-SCHOOL-01 — Core reads/writes for 생활정보 → 내 아이 학교·유치원.
//
// Core contract (lotbi-core app/my_child_api.py), signed-in reader only:
//   GET    /v2/life/my-children                         saved entries + consent + allergen list
//   POST   /v2/life/my-children                         save (first save carries the consent version)
//   DELETE /v2/life/my-children                         delete everything
//   GET    /v2/life/my-children/schools?name=           NEIS school search
//   PATCH  /v2/life/my-children/{id}                    nickname / allergens
//   DELETE /v2/life/my-children/{id}
//   GET    /v2/life/my-children/{id}/overview           meals · links · schedule, or 유치원 기본정보
//   POST   /v2/life/my-children/{id}/info-requests      ask staff to fill an empty item
// Stored per entry: the institution code, the reader's name for it, NEIS
// allergen numbers. Nothing else about a child is ever sent.
import {CORE_ORIGIN} from './site-core.js?v=aset-4fc7fbc29d89';

const BASE_PATH = '/v2/life/my-children';
const ENTRY_RE = /^mci_[0-9a-f]{20}$/u;
export const NICKNAME_MAX = 20;
export const INFO_ITEM_LABELS = Object.freeze({MEAL: '급식', HOMEPAGE: '학교 홈페이지', SCHEDULE: '학사일정'});

export class MyChildError extends Error {
  constructor(message, {code = 'MY_CHILD_FAILED', status = 0, field = '', consent = null} = {}) {
    super(message);
    this.name = 'MyChildError';
    this.code = code;
    this.status = status;
    this.field = field;
    this.consent = consent;
  }
}

function text(value, max = 200) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/gu, ' ').trim().slice(0, max);
}

export function cleanNickname(value) {
  return text(value, 40);
}

export function safeLink(value) {
  const raw = text(value, 500);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function telHref(phone) {
  const digits = text(phone, 30);
  return /^[0-9][0-9-]{6,18}[0-9]$/u.test(digits) ? `tel:${digits}` : '';
}

function allergens(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => item && Number.isInteger(item.code) && item.code >= 1 && item.code <= 19)
    .map(item => Object.freeze({code: item.code, name: text(item.name, 20)}));
}

function institution(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = text(raw.name, 80);
  if (!name) return null;
  return Object.freeze({
    name,
    kindLabel: text(raw.kind_label || raw.kind, 20),
    region: text(raw.region || raw.area, 40),
    address: text(raw.address, 160),
    establishment: text(raw.establishment, 40),
  });
}

export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || !ENTRY_RE.test(text(raw.id, 30))) return null;
  const kind = raw.kind === 'KINDERGARTEN' ? 'KINDERGARTEN' : raw.kind === 'SCHOOL' ? 'SCHOOL' : '';
  if (!kind) return null;
  return Object.freeze({
    id: raw.id,
    kind,
    nickname: text(raw.nickname, 40),
    allergens: allergens(raw.allergens),
    institution: institution(raw.institution),
    institutionStatus: text(raw.institution_status, 20) || 'OK',
  });
}

export function normalizeListing(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) return null;
  const consent = raw.consent && typeof raw.consent === 'object' ? raw.consent : {};
  return Object.freeze({
    entries: raw.entries.map(normalizeEntry).filter(Boolean),
    maxEntries: Number.isInteger(raw.max_entries) ? raw.max_entries : 10,
    consent: Object.freeze({
      accepted: consent.accepted === true,
      version: text(consent.version, 80),
      text: text(consent.text, 400),
    }),
    allergenCatalog: allergens(raw.allergen_catalog),
    allergyBasis: text(raw.allergy_basis, 40) || '급식표 알레르기 표기 기준',
  });
}

function dish(raw) {
  return Object.freeze({
    name: text(raw?.name, 80),
    allergens: Array.isArray(raw?.allergens) ? raw.allergens.filter(code => Number.isInteger(code) && code >= 1 && code <= 19) : [],
    matched: allergens(raw?.matched_allergens),
    containsText: text(raw?.contains_text, 80),
  });
}

function meal(raw) {
  if (!raw || typeof raw !== 'object' || !/^\d{4}-\d{2}-\d{2}$/u.test(text(raw.date, 10))) return null;
  return Object.freeze({
    date: raw.date,
    mealName: text(raw.meal_name, 20) || '급식',
    dishes: (Array.isArray(raw.dishes) ? raw.dishes : []).map(dish).filter(item => item.name),
    calories: text(raw.calories, 40),
    sourceType: raw.source_type === 'STAFF_FALLBACK' ? 'STAFF_FALLBACK' : 'NEIS',
    sourceLabel: text(raw.source_label, 40),
    sourceUrl: safeLink(raw.source_url),
    allergyText: text(raw.allergy_text, 300),
    numbered: raw.allergen_codes_available === true,
    matched: allergens(raw.matched_allergens),
  });
}

function schedule(raw) {
  if (!raw || typeof raw !== 'object') return Object.freeze({status: 'UNAVAILABLE', items: [], truncated: false, from: '', to: ''});
  const items = (Array.isArray(raw.items) ? raw.items : []).map(item => Object.freeze({
    type: ['VACATION', 'DISCRETIONARY_HOLIDAY', 'SCHOOL_START'].includes(item?.type) ? item.type : '',
    typeLabel: text(item?.type_label, 20),
    name: text(item?.name, 60),
    start: text(item?.start, 10),
    end: text(item?.end, 10),
  })).filter(item => item.type && item.name && /^\d{4}-\d{2}-\d{2}$/u.test(item.start));
  return Object.freeze({
    status: ['OK', 'NONE', 'UNAVAILABLE'].includes(raw.status) ? raw.status : 'UNAVAILABLE',
    items,
    truncated: raw.truncated === true,
    from: text(raw.range?.from, 10),
    to: text(raw.range?.to, 10),
  });
}

export function normalizeOverview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = normalizeEntry(raw.entry);
  if (!entry) return null;
  const source = Object.freeze({
    label: text(raw.source?.label, 40),
    fetchedAt: text(raw.source?.fetched_at, 40),
    stale: raw.source?.stale === true,
  });
  const base = {
    entry,
    status: text(raw.status, 20) || 'UNAVAILABLE',
    today: text(raw.today, 10),
    source,
    infoRequests: Object.freeze(Object.fromEntries(Object.entries(raw.info_requests || {})
      .filter(([item, status]) => item in INFO_ITEM_LABELS && (status === 'PENDING' || status === 'RESOLVED')))),
    requestable: Object.freeze((Array.isArray(raw.requestable) ? raw.requestable : []).filter(item => item in INFO_ITEM_LABELS)),
    allergyBasis: text(raw.allergy_basis, 40) || '급식표 알레르기 표기 기준',
  };
  if (entry.kind === 'KINDERGARTEN') {
    const k = raw.kindergarten && typeof raw.kindergarten === 'object' ? raw.kindergarten : null;
    return Object.freeze({
      ...base,
      kindergarten: k ? Object.freeze({
        name: text(k.name, 80),
        establishment: text(k.establishment, 40),
        address: text(k.address, 160),
        phone: text(k.phone, 30),
        homepage: safeLink(k.homepage),
        hours: text(k.hours, 40),
        area: text(k.area, 40),
        officeEdu: text(k.office_edu, 40),
        disclosureLabel: text(k.disclosure_label, 40),
        classes: Number.isInteger(k.classes_total) ? k.classes_total : null,
        capacity: Number.isInteger(k.capacity_total) ? k.capacity_total : null,
        enrolled: Number.isInteger(k.enrolled_total) ? k.enrolled_total : null,
      }) : null,
    });
  }
  const meals = raw.meals && typeof raw.meals === 'object' ? raw.meals : null;
  return Object.freeze({
    ...base,
    school: institution(raw.school),
    meals: meals ? Object.freeze({
      status: ['OK', 'PARTIAL', 'NONE', 'UNAVAILABLE'].includes(meals.status) ? meals.status : 'UNAVAILABLE',
      from: text(meals.week?.from, 10),
      to: text(meals.week?.to, 10),
      today: (Array.isArray(meals.today) ? meals.today : []).map(meal).filter(Boolean),
      days: (Array.isArray(meals.days) ? meals.days : []).map(day => Object.freeze({
        date: text(day?.date, 10),
        meals: (Array.isArray(day?.meals) ? day.meals : []).map(meal).filter(Boolean),
      })).filter(day => /^\d{4}-\d{2}-\d{2}$/u.test(day.date)),
      truncated: meals.truncated === true,
    }) : null,
    links: Object.freeze({
      homepage: safeLink(raw.links?.homepage_url),
      mealSource: safeLink(raw.links?.meal_source_url),
    }),
    schedule: schedule(raw.schedule),
  });
}

export function normalizeSchoolSearch(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.schools)) return null;
  return Object.freeze({
    schools: raw.schools.map(item => {
      const officeCode = text(item?.office_code, 3);
      const schoolCode = text(item?.school_code, 10);
      const name = text(item?.name, 80);
      if (!/^[A-Z][0-9]{2}$/u.test(officeCode) || !/^[0-9]{7,10}$/u.test(schoolCode) || !name) return null;
      return Object.freeze({officeCode, schoolCode, name, kind: text(item.kind, 20), region: text(item.region, 40),
        address: text(item.address, 160)});
    }).filter(Boolean),
    truncated: raw.truncated === true,
  });
}

function announceSessionEnd(status) {
  if (status !== 401 && status !== 403) return;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
}

export async function myChildRequest(path, sessionToken, {method = 'GET', body} = {}, fetchImpl = globalThis.fetch) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) throw new MyChildError('로그인이 필요해요.', {code: 'SESSION_REQUIRED', status: 401});
  if (typeof fetchImpl !== 'function') throw new MyChildError('브라우저 네트워크 기능을 사용할 수 없어요.', {code: 'FETCH_UNAVAILABLE'});
  const headers = {Accept: 'application/json', Authorization: `Bearer ${token}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new MyChildError('LOTBI 서버에 접속하지 못했어요. 잠시 후 다시 해 주세요.', {code: 'NETWORK_ERROR'});
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const detail = data && typeof data.detail === 'object' && data.detail ? data.detail : {};
    const status = Number(response.status) || 0;
    // A 403 for a consent or validation code is not a session problem.
    if (status === 401 || (status === 403 && /^SESSION_|AUDIENCE|FEDERATED/u.test(String(detail.code || '')))) announceSessionEnd(status);
    throw new MyChildError(text(detail.message, 200) || (status === 429 ? '조회가 많아요. 잠시 후 다시 해 주세요.' : '요청을 처리하지 못했어요.'), {
      code: text(detail.code, 60) || `HTTP_${status}`,
      status,
      field: text(detail.field, 30),
      consent: detail.consent && typeof detail.consent === 'object' ? detail.consent : null,
    });
  }
  return data;
}

export async function listMyChildren(sessionToken, fetchImpl) {
  const listing = normalizeListing(await myChildRequest(BASE_PATH, sessionToken, {}, fetchImpl));
  if (!listing) throw new MyChildError('저장한 학교·유치원을 읽지 못했어요.', {code: 'CONTRACT_INVALID'});
  return listing;
}

export async function searchSchools(sessionToken, name, fetchImpl) {
  const params = new URLSearchParams({name: text(name, 40)});
  const found = normalizeSchoolSearch(await myChildRequest(`${BASE_PATH}/schools?${params}`, sessionToken, {}, fetchImpl));
  if (!found) throw new MyChildError('학교 검색 결과를 읽지 못했어요.', {code: 'CONTRACT_INVALID'});
  return found;
}

export function schoolSaveBody({officeCode, schoolCode, nickname, allergenCodes = [], consentVersion = ''}) {
  return {kind: 'SCHOOL', office_code: officeCode, school_code: schoolCode, nickname: cleanNickname(nickname),
    allergens: [...new Set(allergenCodes)].sort((a, b) => a - b), ...(consentVersion ? {consent_version: consentVersion} : {})};
}

export function kindergartenSaveBody({kinderCode, sggCode, nickname, allergenCodes = [], consentVersion = ''}) {
  return {kind: 'KINDERGARTEN', kinder_code: kinderCode, sgg_code: sggCode, nickname: cleanNickname(nickname),
    allergens: [...new Set(allergenCodes)].sort((a, b) => a - b), ...(consentVersion ? {consent_version: consentVersion} : {})};
}

export async function saveMyChild(sessionToken, body, fetchImpl) {
  const data = await myChildRequest(BASE_PATH, sessionToken, {method: 'POST', body}, fetchImpl);
  return normalizeEntry(data?.entry);
}

export async function updateMyChild(sessionToken, entryId, {nickname, allergenCodes}, fetchImpl) {
  if (!ENTRY_RE.test(entryId)) throw new MyChildError('저장한 항목을 찾지 못했어요.', {code: 'MY_CHILD_ENTRY_NOT_FOUND', status: 404});
  const body = {};
  if (nickname !== undefined) body.nickname = cleanNickname(nickname);
  if (allergenCodes !== undefined) body.allergens = [...new Set(allergenCodes)].sort((a, b) => a - b);
  const data = await myChildRequest(`${BASE_PATH}/${entryId}`, sessionToken, {method: 'PATCH', body}, fetchImpl);
  return normalizeEntry(data?.entry);
}

export async function deleteMyChild(sessionToken, entryId, fetchImpl) {
  if (!ENTRY_RE.test(entryId)) throw new MyChildError('저장한 항목을 찾지 못했어요.', {code: 'MY_CHILD_ENTRY_NOT_FOUND', status: 404});
  await myChildRequest(`${BASE_PATH}/${entryId}`, sessionToken, {method: 'DELETE'}, fetchImpl);
  return true;
}

export async function deleteAllMyChildren(sessionToken, fetchImpl) {
  await myChildRequest(BASE_PATH, sessionToken, {method: 'DELETE'}, fetchImpl);
  return true;
}

export async function fetchOverview(sessionToken, entryId, fetchImpl) {
  if (!ENTRY_RE.test(entryId)) throw new MyChildError('저장한 항목을 찾지 못했어요.', {code: 'MY_CHILD_ENTRY_NOT_FOUND', status: 404});
  const overview = normalizeOverview(await myChildRequest(`${BASE_PATH}/${entryId}/overview`, sessionToken, {}, fetchImpl));
  if (!overview) throw new MyChildError('정보를 읽지 못했어요.', {code: 'CONTRACT_INVALID'});
  return overview;
}

export async function requestInfo(sessionToken, entryId, items, fetchImpl) {
  if (!ENTRY_RE.test(entryId)) throw new MyChildError('저장한 항목을 찾지 못했어요.', {code: 'MY_CHILD_ENTRY_NOT_FOUND', status: 404});
  const wanted = [...new Set(items)].filter(item => item in INFO_ITEM_LABELS);
  const data = await myChildRequest(`${BASE_PATH}/${entryId}/info-requests`, sessionToken, {method: 'POST', body: {items: wanted}}, fetchImpl);
  return Object.freeze({results: Object.freeze({...(data?.results || {})}), infoRequests: Object.freeze({...(data?.info_requests || {})})});
}
