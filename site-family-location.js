// FAMILY-LOCATION-01 「우리 가족 위치」 — Core client (app/family_location_api.py).
// Everything answers 404 FAMILY_LOCATION_NOT_ENABLED until the owner turns Core's switch on;
// the care tab is not even shown then. Coordinates are only ever read from Core's answer for a
// person this account may see; nothing here keeps them (no storage, no URL query, no log).
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-673ab6bc5458';

// Owner decision 2026-10-11 (A안): short and true ("연결된 가족": a second guardian joins with the owner's approval).
export const FAMILY_PRIVACY_NOTICE = '내 위치는 연결된 가족만 봐요. 광고·AI 학습에 쓰지 않아요.';
// Shown under [실종 신고로 이어가기], where it applies.
export const FAMILY_MISSING_REPORT_NOTICE = '실종 신고를 하면 보호자가 적은 \'마지막으로 본 장소\'만 담당자가 확인해요.';

function token(value) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new SiteCoreError('가족 위치는 로그인 후 사용할 수 있습니다.', {code: 'SESSION_REQUIRED', status: 401});
  return result;
}

async function request(path, sessionToken, {method = 'GET', body} = {}, fetchImpl = globalThis.fetch) {
  const headers = {Authorization: `Bearer ${token(sessionToken)}`, Accept: 'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/v2/family-location${path}`, {method, mode: 'cors', credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', headers, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  } catch { throw new SiteCoreError('가족 위치 서버에 연결하지 못했습니다.', {code: 'FAMILY_NETWORK_ERROR', retryable: true}); }
  let payload = {}; try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    throw new SiteCoreError('요청을 처리하지 못했습니다.', {code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`, status: response.status});
  }
  return payload;
}

export const getFamilyOverview = (sessionToken, fetchImpl) => request('/overview', sessionToken, {}, fetchImpl);
export const getFamilySharing = async (sessionToken, fetchImpl) => (await request('/sharing', sessionToken, {}, fetchImpl)).sharing;

/** True when Core's FAMILY_LOCATION_ENABLED is on for this signed-in account (the tab shows only then). */
export async function familyLocationAvailable(sessionToken, fetchImpl) {
  if (!sessionToken) return false;
  try { await getFamilySharing(sessionToken, fetchImpl); return true; } catch { return false; }
}

export const createFamilyInvite = (sessionToken, input, fetchImpl) => request('/invites', sessionToken, {method: 'POST', body: {
  role: input.role, ...(input.role === 'SHARER' ? {relation: input.relation} : {}), ...(input.label ? {label: input.label} : {}),
  ...(input.under14 ? {under14: true, guardian_consent_version: input.guardianConsentVersion} : {}),
}}, fetchImpl);
export const previewFamilyInvite = (sessionToken, ref, fetchImpl) => request('/invites/preview', sessionToken, {method: 'POST', body: ref}, fetchImpl);
export const acceptFamilyInvite = (sessionToken, ref, consentVersion, fetchImpl) => request('/invites/accept', sessionToken,
  {method: 'POST', body: {...ref, ...(consentVersion ? {consent_version: consentVersion} : {})}}, fetchImpl);
export const declineFamilyInvite = (sessionToken, ref, fetchImpl) => request('/invites/decline', sessionToken, {method: 'POST', body: ref}, fetchImpl);
export const revokeFamilyInvite = (sessionToken, inviteId, fetchImpl) => request(`/invites/${encodeURIComponent(inviteId)}/revoke`, sessionToken, {method: 'POST'}, fetchImpl);
export const approveFamilyGuardian = (sessionToken, memberId, approve, fetchImpl) => request(`/members/${encodeURIComponent(memberId)}/approve`, sessionToken, {method: 'POST', body: {approve: approve === true}}, fetchImpl);
export const endFamilyMember = (sessionToken, memberId, fetchImpl) => request(`/members/${encodeURIComponent(memberId)}/end`, sessionToken, {method: 'POST'}, fetchImpl);
export const reportFamilyTracking = (sessionToken, memberId, note, fetchImpl) => request(`/members/${encodeURIComponent(memberId)}/report`, sessionToken, {method: 'POST', body: note ? {note} : {}}, fetchImpl);
export const createFamilyRequest = async (sessionToken, memberId, kind, fetchImpl) => (await request(`/members/${encodeURIComponent(memberId)}/requests`, sessionToken, {method: 'POST', body: {kind}}, fetchImpl)).request;
export const getFamilyRequest = async (sessionToken, requestId, fetchImpl) => (await request(`/requests/${encodeURIComponent(requestId)}`, sessionToken, {}, fetchImpl)).request;
export const getFamilyStatusCheck = async (sessionToken, memberId, fetchImpl) => (await request(`/members/${encodeURIComponent(memberId)}/status-check`, sessionToken, {}, fetchImpl)).check;
export const pauseFamilySharing = async (sessionToken, duration, hours, fetchImpl) => (await request('/sharing/pause', sessionToken, {method: 'POST', body: {duration, ...(duration === 'HOUR' ? {hours: hours || 1} : {})}}, fetchImpl)).sharing;
export const resumeFamilySharing = async (sessionToken, fetchImpl) => (await request('/sharing/resume', sessionToken, {method: 'POST'}, fetchImpl)).sharing;
export const reconfirmFamilySharing = async (sessionToken, fetchImpl) => (await request('/sharing/reconfirm', sessionToken, {method: 'POST'}, fetchImpl)).sharing;
export const closeFamilySos = (sessionToken, sosId, fetchImpl) => request(`/sos/${encodeURIComponent(sosId)}/close`, sessionToken, {method: 'POST'}, fetchImpl);
export const familySosMissingReport = (sessionToken, sosId, fetchImpl) => request(`/sos/${encodeURIComponent(sosId)}/missing-report`, sessionToken, {method: 'POST'}, fetchImpl);
export const getFamilyAlertSettings = async (sessionToken, fetchImpl) => (await request('/settings', sessionToken, {}, fetchImpl)).settings;
export const putFamilyAlertSettings = async (sessionToken, settings, fetchImpl) => (await request('/settings', sessionToken, {method: 'PUT', body: {
  quiet_start_hour: settings.quietStartHour, quiet_end_hour: settings.quietEndHour, stale_minutes: settings.staleMinutes, member_kinds: settings.memberKinds || {},
}}, fetchImpl)).settings;

// 도착/출발 places (Core docs/FAMILY-LOCATION-01.md §8): a guardian sets them for a person they see;
// the person's phone decides arrival and departure. Plus 5 / Pro 10 per family.
export const listFamilyPlaces = (sessionToken, memberId, fetchImpl) => request(`/members/${encodeURIComponent(memberId)}/places`, sessionToken, {}, fetchImpl);
export const createFamilyPlace = async (sessionToken, memberId, input, fetchImpl) => (await request(`/members/${encodeURIComponent(memberId)}/places`, sessionToken, {method: 'POST', body: {
  name: input.name, kind: input.kind, radius_m: input.radiusMeters, center: input.center, arrive: input.arrive !== false, depart: input.depart !== false,
  ...(typeof input.holidayOff === 'boolean' ? {holiday_off: input.holidayOff} : {}), ...(input.myChildEntryId ? {my_child_entry_id: input.myChildEntryId} : {}),
}}, fetchImpl)).place;
export const updateFamilyPlace = async (sessionToken, placeId, fields, fetchImpl) => (await request(`/places/${encodeURIComponent(placeId)}`, sessionToken, {method: 'PATCH', body: fields}, fetchImpl)).place;
export const deleteFamilyPlace = (sessionToken, placeId, fetchImpl) => request(`/places/${encodeURIComponent(placeId)}`, sessionToken, {method: 'DELETE'}, fetchImpl);
/** The guardian's own position (site-current-location.js shape) as a place centre; Core refuses a circle over 100 m. */
export function familyPlaceCenterFromFix(fix) {
  return {source: 'MY_LOCATION', latitude: Number(fix.latitude), longitude: Number(fix.longitude),
    accuracy_m: Math.max(0.5, Math.min(5000, Number(fix.accuracyMeters) || 5000))};
}

/** "지금 내 위치 한 번 보내기" from an open page (MANUAL). `fix` comes from site-current-location.js. */
export function sendFamilyLocationOnce(sessionToken, fix, fetchImpl) {
  return request('/beat', sessionToken, {method: 'POST', body: {kind: 'MANUAL', location: wireFix(fix)}}, fetchImpl);
}
/** SOS from an open page: everyone who sees me is told at once, on every plan. */
export function sendFamilySos(sessionToken, fix, fetchImpl) {
  return request('/sos', sessionToken, {method: 'POST', body: fix ? {location: wireFix(fix)} : {}}, fetchImpl);
}
function wireFix(fix) {
  // site-current-location.js shape: {latitude, longitude, accuracyMeters, capturedAtMs}.
  return {latitude: Number(fix.latitude), longitude: Number(fix.longitude),
    accuracy_m: Math.max(0.5, Math.min(5000, Number(fix.accuracyMeters) || 50)),
    captured_at: new Date(Number(fix.capturedAtMs) || Date.now()).toISOString()};
}

/** Invitations: a 6-digit code, or the token of https://lotbiai.com/#family-invite=<token>. */
export function familyInviteRef(input) {
  const value = String(input || '').trim();
  if (/^\d{6}$/u.test(value)) return {code: value};
  const fragment = /#family-invite=([A-Za-z0-9_-]{24,64})$/u.exec(value);
  if (fragment) return {token: fragment[1]};
  return /^[A-Za-z0-9_-]{24,64}$/u.test(value) ? {token: value} : null;
}

function clock(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false});
}

/** "지금" / "n분 전" / "잠시 멈춤(HH:MM까지)" — the last time stays next to the name (기획서 3). */
export function familyPresenceText(member) {
  switch (member?.presence) {
    case 'PAUSED': return member.paused_until ? `위치 공유를 잠시 멈췄어요(${clock(member.paused_until)}까지)` : '위치 공유를 잠시 멈췄어요';
    case 'NO_DATA': return '아직 위치를 받은 적이 없어요';
    case 'LIVE': return Number(member.minutes_ago) >= 1 ? `${member.minutes_ago}분 전` : '지금';
    case 'STALE': return Number.isFinite(Number(member.minutes_ago)) ? `${member.minutes_ago}분 전 마지막 확인` : '확인 안 됨';
    default: return '';
  }
}

export function familyHiddenText(reason) {
  if (reason === 'PLAN_LIVE_REQUIRED') return '실시간 위치는 Plus 요금제부터 볼 수 있어요.';
  if (reason === 'NO_LOCATION') return '아직 받은 위치가 없어요.';
  return '';
}

/** Honest accuracy: "약 50m 범위", and says when a point is not precise (P8). */
export function familyAccuracyText(location) {
  if (!location) return '';
  const meters = Math.round(Number(location.accuracy_m) || 0);
  return `약 ${meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`} 범위${location.precise ? '' : ' · 정확하지 않아요'}`;
}

/** Map and 로드뷰 links (Kakao Map's documented link format; Google Maps when it is the default). */
export function familyMapLinks(member, defaultProvider = '') {
  const location = member?.location;
  if (!location) return null;
  const lat = Number(location.latitude).toFixed(6);
  const lng = Number(location.longitude).toFixed(6);
  const name = encodeURIComponent(String(member.name || '가족').replace(/[,/]/gu, ' '));
  const map = defaultProvider === 'GOOGLE_MAPS'
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://map.kakao.com/link/map/${name},${lat},${lng}`;
  return {map, roadview: `https://map.kakao.com/link/roadview/${lat},${lng}`};
}

export function familyErrorMessage(error, fallback) {
  switch (error?.code) {
    case 'FAMILY_MEMBER_PAUSED': return '상대가 위치 공유를 잠시 멈춘 상태예요.';
    case 'FAMILY_REQUEST_TOO_SOON': return '1분 뒤에 다시 요청할 수 있어요.';
    case 'FAMILY_DAILY_LIMIT': return '오늘 지금 위치 요청을 다 썼어요.';
    case 'FAMILY_PLAN_REQUIRED': return '지금 위치 요청은 Basic 요금제부터 쓸 수 있어요.';
    case 'FAMILY_PLAN_LIMIT': return '요금제의 가족 인원을 다 채웠어요.';
    case 'FAMILY_VIEWER_LIMIT': return '한 사람을 볼 수 있는 보호자는 4명까지예요.';
    case 'FAMILY_INVITE_CODE_EXPIRED': return '코드가 만료됐어요. 초대 링크를 쓰거나 새 코드를 받아 주세요.';
    case 'FAMILY_INVITE_EXPIRED': return '초대가 만료됐어요. 새 초대를 받아 주세요.';
    case 'FAMILY_INVITE_USED': return '이미 사용한 초대예요.';
    case 'FAMILY_INVITE_SELF': return '내가 만든 초대는 받을 수 없어요.';
    case 'FAMILY_ALREADY_MEMBER': return '이미 이 가족에 연결돼 있어요.';
    case 'FAMILY_CHILD_CANNOT_END': return '만 14세 미만은 공유를 끌 수 없어요. 잠시 멈추기를 쓰거나 원치 않는 추적이면 신고해 주세요.';
    case 'FAMILY_RATE_LIMITED': return '잠시 후 다시 시도해 주세요.';
    case 'FAMILY_PLACE_PLAN_REQUIRED': return '도착·출발 알림은 Plus 요금제부터 쓸 수 있어요.';
    case 'FAMILY_PLACE_LIMIT': return '요금제의 장소 수를 다 썼어요(Plus 5곳, Pro 10곳).';
    case 'FAMILY_PLACE_CENTER_UNAVAILABLE': return '지금은 상대 위치를 볼 수 없어 이 방법으로 등록할 수 없어요. 그 장소에서 \'내 지금 위치로\'를 골라 주세요.';
    case 'FAMILY_PLACE_CENTER_UNCERTAIN': return '위치 오차가 100m보다 커서 장소로 쓰지 않았어요. 잠시 뒤 밖에서 다시 해 주세요.';
    case 'FAMILY_PLACE_INVALID': return '장소 이름(20자까지)·종류·반경을 확인해 주세요.';
    case 'FAMILY_PLACE_NOT_FOUND': return '장소를 찾지 못했어요. 새로 고침해 주세요.';
    default: return fallback;
  }
}
