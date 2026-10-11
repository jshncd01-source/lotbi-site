// REAL-ESTATE-REGION-FAVORITES-P0 — Core client of 지역정보 → 부동산 실거래가.
//
// Public reads (no credentials): GET /v2/life/real-estate/{regions,regions/search,
// locate,apartments,apartment}. Signed-in 관심 아파트: GET/PUT/DELETE
// /v2/life/real-estate/favorites with the Site session (Bearer). Every
// 실거래가 number comes from Core, which reads MOLIT; nothing here talks to a
// public-data host or holds a provider key.
//
// Stored on this device only (never a coordinate):
// * lotbi.site.ux.v1.real-estate.region.<account|guest> — the search region the
//   reader picked (MANUAL) or "follow my location" (AUTO). It is a search
//   region, not the reader's address, and never the LOTBI 기본 생활지역.
// * lotbi.site.ux.v1.real-estate.favorites.guest — 관심 아파트 saved before
//   signing in. It is never merged into an account by itself.
import {CORE_ORIGIN} from './site-core.js?v=aset-f04cc336a932';

export const REAL_ESTATE_PATH = '/v2/life/real-estate';
export const REAL_ESTATE_DEALS = Object.freeze([
  Object.freeze({id: 'SALE', label: '매매'}),
  Object.freeze({id: 'JEONSE', label: '전세'}),
  Object.freeze({id: 'MONTHLY', label: '월세'}),
]);
export const REAL_ESTATE_LIST_MONTHS = Object.freeze([1, 3, 6, 12]);
export const REAL_ESTATE_DETAIL_MONTHS = Object.freeze([6, 12, 24]);
export const REAL_ESTATE_GUEST_FAVORITES_LIMIT = 50;
const STORAGE_PREFIX = 'lotbi.site.ux.v1.real-estate';
const TIMEOUT_MS = 15_000;
const APARTMENT_ID_RE = /^\d{10}-[0-9a-f]{12}$/u;

const text = (value, max = 200) => String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);

export class RealEstateError extends Error {
  constructor(message, {code = 'REAL_ESTATE_ERROR', status = 0} = {}) {
    super(message);
    this.name = 'RealEstateError';
    this.code = code;
    this.status = status;
  }
}

export function isApartmentId(value) {
  return APARTMENT_ID_RE.test(String(value || ''));
}

export function realEstateUrl(path, params = {}, origin = CORE_ORIGIN) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return `${origin}${REAL_ESTATE_PATH}${path}${suffix ? `?${suffix}` : ''}`;
}

// The coordinate goes to Core rounded to ~100 m, only for this one lookup.
export function locateUrl(latitude, longitude, origin = CORE_ORIGIN) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!(lat >= 31 && lat <= 44.5 && lng >= 122 && lng <= 132.5)) return '';
  return realEstateUrl('/locate', {latitude: Math.round(lat * 1000) / 1000, longitude: Math.round(lng * 1000) / 1000}, origin);
}

function failureMessage(status, detail) {
  const message = text(detail?.message, 200);
  if (message) return message;
  if (status === 429) return '요청이 많아요. 잠시 후 다시 해 주세요.';
  if (status === 0) return 'LOTBI 서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.';
  return '요청을 처리하지 못했어요. 잠시 후 다시 해 주세요.';
}

export async function getRealEstate(path, params = {}, {fetchImpl = globalThis.fetch, signal} = {}) {
  if (typeof fetchImpl !== 'function') throw new RealEstateError('브라우저 네트워크 기능을 사용할 수 없어요.', {code: 'FETCH_UNAVAILABLE'});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), {once: true});
  let response;
  try {
    response = await fetchImpl(path.startsWith('http') ? path : realEstateUrl(path, params), {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    if (signal?.aborted) throw new RealEstateError('취소했어요.', {code: 'ABORTED'});
    throw new RealEstateError(failureMessage(0), {code: 'NETWORK_ERROR'});
  }
  clearTimeout(timer);
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const detail = data && typeof data.detail === 'object' && data.detail ? data.detail : {};
    throw new RealEstateError(failureMessage(response.status, detail), {code: text(detail.code, 60) || `HTTP_${response.status}`, status: response.status});
  }
  return data;
}

function announceSessionEnd() {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
}

export async function favoritesRequest(sessionToken, {method = 'GET', body, apartmentId = ''} = {}, fetchImpl = globalThis.fetch) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) throw new RealEstateError('로그인이 필요해요.', {code: 'SESSION_REQUIRED', status: 401});
  if (typeof fetchImpl !== 'function') throw new RealEstateError('브라우저 네트워크 기능을 사용할 수 없어요.', {code: 'FETCH_UNAVAILABLE'});
  const headers = {Accept: 'application/json', Authorization: `Bearer ${token}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const url = realEstateUrl('/favorites', method === 'DELETE' ? {apartment_id: apartmentId} : {});
  let response;
  try {
    response = await fetchImpl(url, {
      method, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new RealEstateError(failureMessage(0), {code: 'NETWORK_ERROR'});
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const detail = data && typeof data.detail === 'object' && data.detail ? data.detail : {};
    const status = Number(response.status) || 0;
    if (status === 401 || (status === 403 && /^SESSION_|AUDIENCE|FEDERATED/u.test(String(detail.code || '')))) announceSessionEnd();
    throw new RealEstateError(failureMessage(status, detail), {code: text(detail.code, 60) || `HTTP_${status}`, status});
  }
  return data;
}

// ------------------------------------------------------------- formatting --

// 만원 → "23억 5,000만원", "9,900만원", "1억원". Reported amounts only.
export function formatManwon(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return '';
  const whole = Math.round(amount);
  const eok = Math.floor(whole / 10000);
  const rest = whole % 10000;
  if (!eok) return `${rest.toLocaleString('ko-KR')}만원`;
  return rest ? `${eok}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok}억원`;
}

export function formatArea(value) {
  const area = Number(value);
  if (!Number.isFinite(area) || area <= 0) return '';
  return `전용 ${area.toFixed(2).replace(/\.?0+$/u, '')}㎡`;
}

export function formatFloor(value) {
  const floor = Number(value);
  if (!Number.isInteger(floor) || floor === 0) return '';
  return floor < 0 ? `지하 ${Math.abs(floor)}층` : `${floor}층`;
}

export function formatDealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value || ''));
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
}

// "매매 23억원" / "전세 12억원" / "월세 1,000만원 / 250만원".
export function formatDealPrice(deal) {
  if (!deal || typeof deal !== 'object') return '';
  if (deal.type === 'SALE') return `매매 ${formatManwon(deal.amount_manwon)}`;
  if (deal.type === 'JEONSE') return `전세 ${formatManwon(deal.deposit_manwon)}`;
  if (deal.type === 'MONTHLY') return `월세 ${formatManwon(deal.deposit_manwon)} / ${formatManwon(deal.monthly_rent_manwon)}`;
  return '';
}

export function formatDealLine(deal) {
  if (!deal || typeof deal !== 'object') return '';
  return [formatDealPrice(deal), formatArea(deal.area_m2), formatFloor(deal.floor), formatDealDate(deal.date)]
    .filter(Boolean).join(' · ');
}

export function normalizeApartmentItem(raw) {
  if (!raw || typeof raw !== 'object' || !isApartmentId(raw.apartment_id) || !text(raw.name)) return null;
  return Object.freeze({
    apartmentId: raw.apartment_id,
    name: text(raw.name, 80),
    addressLabel: text(raw.address_label, 160),
    dongName: text(raw.dong_name, 40),
    builtYear: Number.isInteger(raw.built_year) ? raw.built_year : null,
    latest: raw.latest && typeof raw.latest === 'object' ? raw.latest : null,
    dealsInPeriod: Number.isInteger(raw.deals_in_period) ? raw.deals_in_period : 0,
    cancelledInPeriod: Number.isInteger(raw.cancelled_in_period) ? raw.cancelled_in_period : 0,
  });
}

// --------------------------------------------------------- device storage --

function safeStorage(storage) {
  try {
    return storage || globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function accountKey(accountId) {
  return /^[A-Za-z0-9_.:-]{1,80}$/u.test(String(accountId || '')) ? String(accountId) : 'guest';
}

export function regionPreferenceKey(accountId) {
  return `${STORAGE_PREFIX}.region.${accountKey(accountId)}`;
}

export function readRegionPreference(accountId, storage) {
  try {
    const raw = safeStorage(storage)?.getItem(regionPreferenceKey(accountId));
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return null;
    if (value.mode === 'AUTO') return {mode: 'AUTO'};
    if (value.mode !== 'MANUAL' || !/^\d{2}$/u.test(String(value.sido || ''))) return null;
    return {
      mode: 'MANUAL',
      sido: String(value.sido),
      sigungu: /^\d{5}$/u.test(String(value.sigungu || '')) ? String(value.sigungu) : '',
      dong: /^\d{10}$/u.test(String(value.dong || '')) ? String(value.dong) : '',
    };
  } catch {
    return null;
  }
}

export function writeRegionPreference(accountId, value, storage) {
  try {
    const target = safeStorage(storage);
    if (!target) return false;
    const record = value?.mode === 'MANUAL'
      ? {mode: 'MANUAL', sido: value.sido || '', sigungu: value.sigungu || '', dong: value.dong || ''}
      : {mode: 'AUTO'};
    target.setItem(regionPreferenceKey(accountId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export const GUEST_FAVORITES_KEY = `${STORAGE_PREFIX}.favorites.guest`;

function normalizeStoredFavorite(raw) {
  if (!raw || typeof raw !== 'object' || !isApartmentId(raw.apartment_id) || !text(raw.name)) return null;
  return {
    apartment_id: raw.apartment_id,
    name: text(raw.name, 80),
    region_label: text(raw.region_label, 120),
    address_label: text(raw.address_label, 160),
    saved_at: text(raw.saved_at, 40),
  };
}

export function readGuestFavorites(storage) {
  try {
    const raw = safeStorage(storage)?.getItem(GUEST_FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.map(normalizeStoredFavorite).filter(item => item && !seen.has(item.apartment_id) && seen.add(item.apartment_id));
  } catch {
    return [];
  }
}

export function writeGuestFavorites(list, storage) {
  try {
    const target = safeStorage(storage);
    if (!target) return false;
    const clean = (Array.isArray(list) ? list : []).map(normalizeStoredFavorite).filter(Boolean)
      .slice(0, REAL_ESTATE_GUEST_FAVORITES_LIMIT);
    if (clean.length) target.setItem(GUEST_FAVORITES_KEY, JSON.stringify(clean));
    else target.removeItem(GUEST_FAVORITES_KEY);
    return true;
  } catch {
    return false;
  }
}

// The detail shown in this tab, so a reload of #real-estate-apartment opens it again.
export const OPEN_APARTMENT_KEY = `${STORAGE_PREFIX}.open-apartment`;

export function readOpenApartment(storage = globalThis.sessionStorage) {
  try {
    const raw = storage?.getItem(OPEN_APARTMENT_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || !isApartmentId(value.apartment_id)) return null;
    return {apartment_id: value.apartment_id, name: text(value.name, 80), address_label: text(value.address_label, 160),
      from: value.from === 'favorites' ? 'favorites' : 'list'};
  } catch {
    return null;
  }
}

export function writeOpenApartment(value, storage = globalThis.sessionStorage) {
  try {
    if (!value) storage?.removeItem(OPEN_APARTMENT_KEY);
    else storage?.setItem(OPEN_APARTMENT_KEY, JSON.stringify({
      apartment_id: value.apartment_id, name: value.name || '', address_label: value.address_label || '', from: value.from || 'list',
    }));
  } catch {
    // Private mode: the detail simply does not survive a reload.
  }
}
