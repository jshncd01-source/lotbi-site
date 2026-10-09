// KINDERGARTEN-OFFICIAL-INFO-01 — 교육부 유치원알리미 공시 reads for the 유치원 screen.
//
// Core contract CORE-KINDERGARTEN-RESULT-01 (lotbi-core app/kindergarten_api.py):
//   GET /v2/life/kindergartens/regions          유치원알리미 시도·시군구 코드표
//   GET /v2/life/kindergartens?sgg_code&q&establishment
//   GET /v2/life/kindergartens/detail?kinder_code&sgg_code
// Public data, no credentials (same shape as the festival reads). Every
// response says its status: DISABLED (Core has the 공시 connection off),
// UNAVAILABLE (the provider failed now — never "no 유치원"), OK, NOT_FOUND.
// Values are shown as Core gives them; nothing is filled in here.
import {CORE_ORIGIN} from './site-core.js?v=aset-976965940207';

export const KINDERGARTEN_CONTRACT_ID = 'CORE-KINDERGARTEN-RESULT-01';
const BASE_PATH = '/v2/life/kindergartens';
const STATUSES = new Set(['OK', 'DISABLED', 'UNAVAILABLE', 'NOT_FOUND', 'DENIED']);
const PART_STATUSES = new Set(['OK', 'NO_DATA', 'DENIED', 'UNAVAILABLE', 'DISABLED']);
const CODE_RE = /^[0-9A-Za-z-]{8,64}$/u;
const SGG_RE = /^\d{5}$/u;
export const ESTABLISHMENT_FILTERS = Object.freeze([
  ['ALL', '전체'], ['PUBLIC', '공립'], ['PRIVATE', '사립'], ['NATIONAL', '국립'],
]);

function text(value, max = 200) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/gu, ' ').trim().slice(0, max);
}
function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

// Only http(s) links, as Core's school link policy already checked them.
export function safeKindergartenLink(value) {
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

export function normalizeKindergartenSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = text(raw.kinder_code, 64);
  const sgg = text(raw.sgg_code, 5);
  const name = text(raw.name, 80);
  if (!CODE_RE.test(code) || !SGG_RE.test(sgg) || !name) return null;
  const totals = key => count(raw[key] && typeof raw[key] === 'object' ? raw[key].total : null);
  return Object.freeze({
    kinderCode: code,
    sggCode: sgg,
    name,
    establishment: text(raw.establishment, 30),
    address: text(raw.address, 160),
    phone: text(raw.phone, 30),
    homepage: safeKindergartenLink(raw.homepage),
    hours: text(raw.hours, 40),
    area: text(raw.area, 40),
    capacity: totals('capacity'),
    enrolled: totals('enrolled'),
    classes: totals('classes'),
    disclosureLabel: text(raw.disclosure_label, 20),
  });
}

function normalizePart(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const status = PART_STATUSES.has(raw.status) ? raw.status : 'UNAVAILABLE';
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(item => (item && typeof item === 'object' ? {label: text(item.label, 60), value: text(item.value, 160)} : null))
    .filter(item => item && item.label && item.value);
  return Object.freeze({label: text(raw.label, 60), status, items: Object.freeze(items),
    disclosureLabel: text(raw.disclosure_label, 20)});
}

export function normalizeKindergartenDetail(payload) {
  if (!payload || payload.contract_id !== KINDERGARTEN_CONTRACT_ID) return null;
  const status = STATUSES.has(payload.status) ? payload.status : 'UNAVAILABLE';
  const categories = (Array.isArray(payload.categories) ? payload.categories : []).map(category => {
    if (!category || typeof category !== 'object') return null;
    const parts = (Array.isArray(category.parts) ? category.parts : []).map(normalizePart).filter(Boolean);
    return Object.freeze({key: text(category.key, 30), label: text(category.label, 40),
      status: text(category.status, 20), parts: Object.freeze(parts)});
  }).filter(category => category && category.key && category.label);
  return Object.freeze({
    status,
    kindergarten: normalizeKindergartenSummary(payload.kindergarten),
    categories: Object.freeze(categories),
    source: normalizeSource(payload.source),
  });
}

function normalizeSource(raw) {
  return Object.freeze({
    label: text(raw?.label, 40) || '교육부 유치원알리미',
    url: safeKindergartenLink(raw?.url) || 'https://e-childschoolinfo.moe.go.kr/',
    fetchedOn: /^\d{4}-\d{2}-\d{2}$/u.test(text(raw?.fetched_on, 10)) ? text(raw.fetched_on, 10) : '',
  });
}

export function normalizeKindergartenList(payload) {
  if (!payload || payload.contract_id !== KINDERGARTEN_CONTRACT_ID) return null;
  const status = STATUSES.has(payload.status) ? payload.status : 'UNAVAILABLE';
  const items = (Array.isArray(payload.items) ? payload.items : []).map(normalizeKindergartenSummary).filter(Boolean);
  return Object.freeze({status, items: Object.freeze(items), source: normalizeSource(payload.source),
    regionLabel: text(payload.region?.label, 40)});
}

export function normalizeRegionCatalog(payload) {
  const regions = (Array.isArray(payload?.regions) ? payload.regions : []).map(sido => {
    const sidoCode = text(sido?.sido_code, 2);
    const sidoName = text(sido?.sido_name, 20);
    const sggs = (Array.isArray(sido?.sggs) ? sido.sggs : [])
      .map(sgg => ({code: text(sgg?.sgg_code, 5), name: text(sgg?.sgg_name, 30)}))
      .filter(sgg => SGG_RE.test(sgg.code) && sgg.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return /^\d{2}$/u.test(sidoCode) && sidoName && sggs.length ? Object.freeze({sidoCode, sidoName, sggs}) : null;
  }).filter(Boolean);
  return Object.freeze({regions: Object.freeze(regions), enabled: payload?.enabled === true});
}

// "전북특별자치도 전주시 덕진구" / "전주시 덕진구" (a saved calendar region) → the
// 시군구 the code table lists, or null. Never a guess between two 시도.
export function regionFromLabel(catalog, label) {
  const value = text(label, 80).replace(/[^0-9A-Za-z가-힣 ]/gu, ' ').replace(/\s+/gu, ' ');
  if (!value || !catalog?.regions?.length) return null;
  let best = null;
  for (const sido of catalog.regions) {
    for (const sgg of sido.sggs) {
      if (!value.includes(sgg.name)) continue;
      const sidoMatch = value.includes(sido.sidoName) || value.includes(sido.sidoName.slice(0, 2));
      const score = sgg.name.length * 10 + (sidoMatch ? 5 : 0);
      if (!best || score > best.score) best = {score, sidoCode: sido.sidoCode, sggCode: sgg.code, unique: true};
      else if (score === best.score) best.unique = false;
    }
  }
  return best && best.unique ? {sidoCode: best.sidoCode, sggCode: best.sggCode} : null;
}

async function getJson(pathAndQuery, fetchImpl) {
  if (typeof fetchImpl !== 'function') return {ok: false, status: 0, data: null};
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${pathAndQuery}`, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: {Accept: 'application/json'},
    });
  } catch {
    return {ok: false, status: 0, data: null};
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return {ok: Boolean(response?.ok), status: Number(response?.status) || 0, data};
}

export async function fetchKindergartenRegions(fetchImpl = globalThis.fetch) {
  const result = await getJson(`${BASE_PATH}/regions`, fetchImpl);
  return result.ok ? normalizeRegionCatalog(result.data) : null;
}

export async function searchKindergartens({sggCode, q = '', establishment = 'ALL'} = {}, fetchImpl = globalThis.fetch) {
  if (!SGG_RE.test(text(sggCode, 5))) return {status: 'UNAVAILABLE', items: []};
  const params = new URLSearchParams({sgg_code: sggCode});
  const query = text(q, 30);
  if (query) params.set('q', query);
  if (ESTABLISHMENT_FILTERS.some(([value]) => value === establishment) && establishment !== 'ALL') {
    params.set('establishment', establishment);
  }
  const result = await getJson(`${BASE_PATH}?${params}`, fetchImpl);
  if (result.status === 429) return {status: 'RATE_LIMITED', items: []};
  return normalizeKindergartenList(result.data) || {status: 'UNAVAILABLE', items: []};
}

export async function fetchKindergartenDetail({kinderCode, sggCode} = {}, fetchImpl = globalThis.fetch) {
  if (!CODE_RE.test(text(kinderCode, 64)) || !SGG_RE.test(text(sggCode, 5))) return {status: 'NOT_FOUND', categories: []};
  const params = new URLSearchParams({kinder_code: kinderCode, sgg_code: sggCode});
  const result = await getJson(`${BASE_PATH}/detail?${params}`, fetchImpl);
  if (result.status === 429) return {status: 'RATE_LIMITED', categories: []};
  return normalizeKindergartenDetail(result.data) || {status: 'UNAVAILABLE', categories: []};
}
