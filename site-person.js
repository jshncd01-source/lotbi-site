// Owner-only Person + SOS Core client. No public person search or contact data.
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-683dba8da5af';

function token(value) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new SiteCoreError('사람 안심케어는 로그인 후 사용할 수 있습니다.', {code: 'SESSION_REQUIRED', status: 401});
  return result;
}
async function request(path, sessionToken, {method = 'GET', body, requestKey = ''} = {}, fetchImpl = globalThis.fetch) {
  const headers = {Authorization: `Bearer ${token(sessionToken)}`, Accept: 'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (requestKey) headers['Idempotency-Key'] = requestKey;
  let response;
  try { response = await fetchImpl(`${CORE_ORIGIN}${path}`, {method, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers, ...(body === undefined ? {} : {body: JSON.stringify(body)})}); }
  catch { throw new SiteCoreError('사람 안심케어 서버에 연결하지 못했습니다.', {code: 'PERSON_NETWORK_ERROR', retryable: true}); }
  let payload = {}; try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    throw new SiteCoreError('요청을 처리하지 못했습니다.', {code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`, status: response.status});
  }
  return payload;
}
function person(row) { return Object.freeze({personId: row.person_id, displayName: row.display_name, nickname: row.nickname || '', relationship: row.relationship, birthYear: row.birth_year == null ? null : Number(row.birth_year), birthMonth: row.birthday_month == null ? null : Number(row.birthday_month), revision: row.revision, hasPhoto: row.has_photo === true, identityPhotoCount: Number(row.identity_photo_count || 0), identityPhotoRequired: Number(row.identity_photo_required || 10), identityPhotoState: row.identity_photo_state || 'INCOMPLETE', identityPhotoExpiresAt: row.identity_photo_expires_at || null, identityPhotoDaysRemaining: row.identity_photo_days_remaining ?? null, identityPhotoRenewalReminderDays: row.identity_photo_renewal_reminder_days ?? null, identityPhotoValidityDays: row.identity_photo_validity_days ?? null, identityPhotoRenewalPolicy: row.identity_photo_renewal_policy || null}); }
function identityPhoto(row) { return Object.freeze({slotIndex: Number(row.slot_index), slotCode: row.slot_code || row.angle_code, revision: Number(row.revision), width: Number(row.width), height: Number(row.height), updatedAt: row.updated_at}); }
function sighting(row) { if (row.automatic_identity_decision !== false || row.contact_details_exposed !== false) throw new SiteCoreError('사람 제보 안전 계약이 올바르지 않습니다.', {code: 'PERSON_RESPONSE_INVALID'}); return Object.freeze({reportId: row.report_id, observedAt: row.observed_at, locationSummary: row.location_summary, description: row.description || '', reviewState: row.review_state, photoCount: Number(row.photo_count), minimumPhotoCount: Number(row.minimum_photo_count), maximumPhotoCount: Number(row.maximum_photo_count), canSubmit: row.can_submit === true, message: row.message}); }
function sos(row) { if (row.matching_scope !== 'ACTIVE_SOS_ONLY' || row.automatic_identity_decision !== false) throw new SiteCoreError('SOS 안전 계약이 올바르지 않습니다.', {code: 'PERSON_RESPONSE_INVALID'}); return Object.freeze({sosId: row.sos_id, personId: row.person_id, displayName: row.display_name, status: row.status, lastSeenAt: row.last_seen_at, lastSeenSummary: row.last_seen_summary, description: row.description || ''}); }
function notice(row) { if (row.automatic_identity_decision !== false || row.contact_details_exposed !== false) throw new SiteCoreError('후보 안전 계약이 올바르지 않습니다.', {code: 'PERSON_RESPONSE_INVALID'}); return Object.freeze({noticeId: row.notice_id, candidateId: row.candidate_id, personId: row.person_id, displayName: row.display_name, status: row.status, response: row.response || '', faceScore: row.face_score, photoPath: row.registered_photo_path}); }
function personRequestKeyRandomHex() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll('-', '').toLowerCase();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
export const personRequestKey = () => `prq_${Date.now()}_${personRequestKeyRandomHex()}`;
export async function listPeople(sessionToken, fetchImpl) { const payload = await request('/v2/person-profiles', sessionToken, {}, fetchImpl); return Object.freeze((payload.people || []).map(person)); }
export async function getPerson(sessionToken, personId, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(personId)}`, sessionToken, {}, fetchImpl); return person(payload.person); }
export async function createPerson(sessionToken, input, fetchImpl) {
  const options = {method: 'POST', requestKey: input.requestKey || personRequestKey('create'), body: {display_name: input.displayName, relationship: input.relationship, birth_year: Number(input.birthYear), birthday_month: Number(input.birthMonth), birthday_day: null, nickname: input.nickname || null}};
  const retryDelays = [250, 750, 1500];
  for (let attempt = 0; ; attempt += 1) {
    try { return person((await request('/v2/person-profiles', sessionToken, options, fetchImpl)).person); }
    catch (error) {
      if (error?.code !== 'PERSON_NETWORK_ERROR' || attempt >= retryDelays.length) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}
export async function updatePerson(sessionToken, input, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(input.personId)}`, sessionToken, {method: 'PATCH', body: {expected_revision: input.revision, display_name: input.displayName, relationship: input.relationship, birth_year: Number(input.birthYear), birthday_month: Number(input.birthMonth), nickname: input.nickname || null}}, fetchImpl); return person(payload.person); }
export async function deletePerson(sessionToken, value, fetchImpl) { await request(`/v2/person-profiles/${encodeURIComponent(value.personId)}?expected_revision=${value.revision}`, sessionToken, {method: 'DELETE'}, fetchImpl); }
export async function putPersonPhoto(sessionToken, input, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(input.personId)}/photo`, sessionToken, {method: 'PUT', requestKey: input.requestKey || personRequestKey('photo'), body: {expected_revision: input.revision, photo_data_uri: input.dataUri}}, fetchImpl); return person(payload.person); }
export async function listPersonIdentityPhotos(sessionToken, personId, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(personId)}/identity-photos`, sessionToken, {}, fetchImpl); return Object.freeze((payload.photos || []).map(identityPhoto)); }
export async function putPersonIdentityPhoto(sessionToken, personId, slotIndex, dataUri, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(personId)}/identity-photos/${slotIndex}`, sessionToken, {method: 'PUT', body: {photo_data_uri: dataUri}}, fetchImpl); return identityPhoto(payload.photo); }
export async function listPersonSos(sessionToken, fetchImpl) { const payload = await request('/v2/person-sos?status=ACTIVE', sessionToken, {}, fetchImpl); return Object.freeze((payload.items || []).map(sos)); }
export async function createPersonSos(sessionToken, input, fetchImpl) { const payload = await request('/v2/person-sos', sessionToken, {method: 'POST', body: {person_id: input.personId, last_seen_at: input.lastSeenAt, last_seen_summary: input.lastSeenSummary, description: input.description || null, matching_consent_confirmed: input.matchingConsentConfirmed === true}}, fetchImpl); return sos(payload.sos); }
export async function closePersonSos(sessionToken, sosId, fetchImpl) { const payload = await request(`/v2/person-sos/${encodeURIComponent(sosId)}/close`, sessionToken, {method: 'PUT'}, fetchImpl); return sos(payload.sos); }
export async function listGuardianNotices(sessionToken, fetchImpl) { const payload = await request('/v2/person-sos/notices/candidates', sessionToken, {}, fetchImpl); return Object.freeze((payload.notices || []).map(notice)); }
export async function respondGuardianNotice(sessionToken, noticeId, response, fetchImpl) { const payload = await request(`/v2/person-sos/notices/${encodeURIComponent(noticeId)}/response`, sessionToken, {method: 'POST', body: {response}}, fetchImpl); return notice(payload.notice); }
export async function listHumanSightings(sessionToken, fetchImpl) { const payload = await request('/v2/safecare/human-sightings', sessionToken, {}, fetchImpl); return Object.freeze((payload.reports || []).map(sighting)); }
export async function createHumanSighting(sessionToken, input, fetchImpl) { const payload = await request('/v2/safecare/human-sightings', sessionToken, {method: 'POST', body: {observed_at: input.observedAt, location_summary: input.locationSummary, description: input.description || null}}, fetchImpl); return sighting(payload.report); }
export async function putHumanSightingPhoto(sessionToken, reportId, slotIndex, dataUri, fetchImpl) { const payload = await request(`/v2/safecare/human-sightings/${encodeURIComponent(reportId)}/photos/${slotIndex}`, sessionToken, {method: 'PUT', body: {photo_data_uri: dataUri}}, fetchImpl); return identityPhoto(payload.photo); }
export async function submitHumanSighting(sessionToken, reportId, fetchImpl) { const payload = await request(`/v2/safecare/human-sightings/${encodeURIComponent(reportId)}/submit`, sessionToken, {method: 'POST'}, fetchImpl); return sighting(payload.report); }
export async function listHumanSightingPhotos(sessionToken, reportId, fetchImpl) { const payload = await request(`/v2/safecare/human-sightings/${encodeURIComponent(reportId)}/photos`, sessionToken, {}, fetchImpl); return Object.freeze((payload.photos || []).map(identityPhoto)); }
export async function deleteHumanSightingPhoto(sessionToken, reportId, slotIndex, fetchImpl) { await request(`/v2/safecare/human-sightings/${encodeURIComponent(reportId)}/photos/${slotIndex}`, sessionToken, {method: 'DELETE'}, fetchImpl); }

// Core error code -> a sentence the guardian can act on. The code itself is
// never shown; the screen keeps it on a data attribute for diagnosis.
const PERSON_ERROR_MESSAGES = Object.freeze({
  SESSION_REQUIRED: '로그인 후 사용할 수 있습니다.',
  PERSON_NETWORK_ERROR: '안심케어 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  PERSON_IDENTITY_PHOTO_DUPLICATE: '같은 사진은 여러 각도에 사용할 수 없습니다. 다른 방향에서 찍은 사진을 선택해 주세요.',
  HUMAN_SIGHTING_PHOTO_DUPLICATE: '같은 사진은 여러 장으로 사용할 수 없습니다. 다른 방향에서 찍은 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_TOO_LARGE: '사진 용량이 너무 큽니다. 더 작은 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_UNSUPPORTED: 'JPG, PNG, WEBP 사진만 등록할 수 있습니다.',
  PERSON_IDENTITY_PHOTO_INVALID: '사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.',
  // Identity-photo intake gate (Core decides; nothing is stored on refusal).
  PERSON_IDENTITY_PHOTO_NON_IDENTITY_IMAGE: '사람 식별 사진이 아닙니다. 문서·사물·화면 사진은 등록할 수 없습니다.',
  PERSON_IDENTITY_PHOTO_NO_PERSON: '사람을 확인할 수 없습니다. 안내 그림처럼 등록할 사람이 크게 나온 사진을 다시 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_NO_FACE: '사람 얼굴을 확인할 수 없습니다. 안내 그림에 맞춰 얼굴이 선명하게 보이는 사진을 다시 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_MULTIPLE_FACES: '여러 사람이 함께 나온 사진은 등록할 수 없습니다. 등록할 사람 한 명만 나온 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_WRONG_POSE: '촬영 방향이 맞지 않습니다. 안내 그림과 같은 방향으로 얼굴을 돌려 다시 촬영해 주세요.',
  PERSON_IDENTITY_PHOTO_WRONG_FRAMING: '사진 구도가 이 칸과 맞지 않습니다. 안내 그림처럼 잘리지 않게 다시 촬영해 주세요.',
  PERSON_IDENTITY_PHOTO_TOO_BLURRY: '사진이 너무 흐립니다. 얼굴이 선명하게 보이도록 다시 촬영해 주세요.',
  PERSON_IDENTITY_PHOTO_OCCLUDED: '얼굴이 가려져 있습니다. 마스크·선글라스·손 등으로 가리지 않은 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_SUBJECT_TOO_SMALL: '사람이 너무 작게 나왔습니다. 조금 더 가까이에서 찍은 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE: '지금은 사진을 확인할 수 없어 저장하지 않았습니다. 잠시 후 다시 시도해 주세요.',
  PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON: '등록된 사람과 다른 사람으로 보이는 사진입니다. 같은 사람의 사진을 선택해 주세요.',
  PERSON_IDENTITY_PHOTO_IDENTITY_UNCLEAR: '얼굴을 충분히 확인하기 어렵습니다. 얼굴이 조금 더 잘 보이게 다시 촬영해 주세요.',
  PERSON_REID_PHOTO_INVALID: '사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.',
  PERSON_REID_PHOTO_QUALITY_INSUFFICIENT: '얼굴이나 모습이 선명하게 보이지 않습니다. 밝은 곳에서 다시 찍은 사진을 선택해 주세요.',
  PERSON_BIRTH_INFO_REQUIRED: '출생 연·월을 먼저 입력해 주세요. 사진 갱신 주기를 계산하는 데 필요합니다.',
  BIRTH_INFO_REQUIRED: '출생 연·월을 먼저 입력해 주세요. 사진 갱신 주기를 계산하는 데 필요합니다.',
  PERSON_IDENTITY_PHOTOS_INCOMPLETE: '식별 사진 10장을 모두 등록해야 실종 상태로 전환할 수 있습니다.',
  PERSON_PHOTO_REQUIRED: '식별 사진 10장을 모두 등록해야 실종 상태로 전환할 수 있습니다.',
  PERSON_IDENTITY_PHOTOS_EXPIRED: '식별 사진 유효기간이 지나 실종 상태로 전환할 수 없습니다. 사진을 먼저 갱신해 주세요.',
  PERSON_REID_CONSENT_REQUIRED: '실종 기간 동안 사진을 후보 검색에 사용하는 데 동의해 주세요.',
  PERSON_SOS_LOCATION_INVALID: '마지막으로 본 장소를 확인해 주세요.',
  PERSON_SOS_NOT_FOUND: '실종 정보를 찾지 못했습니다. 화면을 새로 열어 주세요.',
  HUMAN_SIGHTING_LOCATION_INVALID: '발견 장소를 확인해 주세요.',
  HUMAN_SIGHTING_PHOTOS_INCOMPLETE: '서로 다른 방향의 사진 5장 이상이 필요합니다.',
  HUMAN_SIGHTING_ANGLES_INCOMPLETE: '서로 다른 방향의 사진 5장 이상이 필요합니다.',
  HUMAN_SIGHTING_ALREADY_SUBMITTED: '이미 제출한 제보입니다.',
  HUMAN_SIGHTING_NOT_FOUND: '제보를 찾지 못했습니다. 화면을 새로 열어 주세요.',
  HUMAN_SIGHTING_PHOTO_SLOT_INVALID: '사진은 최대 10장까지 등록할 수 있습니다.',
});

// Framing refusals read differently per slot: a face slot needs the whole face,
// the body slots need the upper body or the whole figure.
const IDENTITY_FRAMING_MESSAGES = Object.freeze({
  upper: '상반신이 충분히 보이지 않습니다. 머리부터 허리까지 정면에서 다시 촬영해 주세요.',
  full: '전신이 충분히 보이지 않습니다. 머리부터 발끝까지 한 장에 담기도록 다시 촬영해 주세요.',
});

// SAFECARE-PHOTO-UPLOAD-FIX-03: "촬영 방향이 맞지 않습니다" did not tell a
// guardian whether the head was turned too far, too little or the other way.
// Core returns one code; the slot says which view it needed.
function identityPoseMessage(slot) {
  const side = slot?.direction === 'right' ? '오른쪽' : '왼쪽';
  if (slot?.view === 'turn' && slot?.extra) {
    return `방향이 맞지 않습니다. 사진 속 얼굴이 화면 ${side}을 바라보도록 고개를 돌린 사진을 선택해 주세요. 셀카는 좌우가 바뀌어 저장될 수 있습니다.`;
  }
  if (slot?.view === 'turn') {
    return `45도 각도가 아닙니다. 두 눈·코·입이 모두 보이도록 고개를 반쯤만 돌려 주세요. 눈이 한쪽만 보이면 '${side} 옆면' 칸에 올려 주세요. 셀카는 좌우가 바뀌어 저장될 수 있으니 사진 속 얼굴이 화면 ${side}을 보는지 확인해 주세요.`;
  }
  if (slot?.view === 'profile') {
    return `옆면 사진이 아닙니다. 고개를 완전히 옆으로 돌려 귀와 턱선이 보이게 찍어 주세요. 두 눈이 다 보이면 '${side} 45도' 칸에 올려 주세요.`;
  }
  return '정면 사진이 아닙니다. 카메라를 똑바로 바라본 사진을 선택해 주세요.';
}

export function personIdentityPhotoErrorMessage(error, slot, fallback) {
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
  const body = slot?.view === 'upper' || slot?.view === 'full';
  if (code === 'PERSON_IDENTITY_PHOTO_WRONG_POSE' && slot) return identityPoseMessage(slot);
  // A real person whose turned face could not be judged (FIX-03: a head turned
  // a little past the side) hears what to change, not just "no face".
  if (code === 'PERSON_IDENTITY_PHOTO_NO_FACE' && slot?.view === 'profile') {
    return '옆얼굴을 확인할 수 없습니다. 옆보다 더 뒤로 돌리지 말고, 한쪽 눈과 코끝이 보이게 정확히 옆을 보고 다시 찍어 주세요.';
  }
  if (code === 'PERSON_IDENTITY_PHOTO_NO_FACE' && slot?.view === 'turn') {
    return '얼굴을 확인할 수 없습니다. 두 눈·코·입이 모두 보이게 고개를 반쯤만 돌려 다시 찍어 주세요.';
  }
  if (code === 'PERSON_IDENTITY_PHOTO_WRONG_FRAMING') {
    return IDENTITY_FRAMING_MESSAGES[slot?.view] || '얼굴 전체가 화면 안에 들어오지 않았습니다. 이마부터 턱까지 잘리지 않게 다시 촬영해 주세요.';
  }
  if (code === 'PERSON_IDENTITY_PHOTO_SUBJECT_TOO_SMALL' && !body) {
    return '얼굴이 너무 작게 나왔습니다. 얼굴이 화면을 충분히 채우도록 가까이에서 다시 촬영해 주세요.';
  }
  return personErrorMessage(error, fallback);
}

export function personErrorMessage(error, fallback) {
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
  if (PERSON_ERROR_MESSAGES[code]) return PERSON_ERROR_MESSAGES[code];
  const status = error && typeof error === 'object' ? error.status : 0;
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 413) return '사진 용량이 너무 큽니다. 더 작은 사진을 선택해 주세요.';
  if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
  return fallback;
}

// Private photo bytes for an on-screen preview only. Same bearer session, no
// cookies, no referrer; the object URL never leaves this tab.
async function privateObjectUrl(path, sessionToken, fetchImpl = globalThis.fetch) {
  let response;
  try { response = await fetchImpl(`${CORE_ORIGIN}${path}`, {method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: {Authorization: `Bearer ${token(sessionToken)}`}}); }
  catch { throw new SiteCoreError('사진을 불러오지 못했습니다.', {code: 'PERSON_NETWORK_ERROR', retryable: true}); }
  if (!response.ok) throw new SiteCoreError('사진을 불러오지 못했습니다.', {code: `HTTP_${response.status}`, status: response.status});
  return URL.createObjectURL(await response.blob());
}
export function fetchPersonIdentityPhotoObjectUrl(sessionToken, personId, slotIndex, fetchImpl) { return privateObjectUrl(`/v2/person-profiles/${encodeURIComponent(personId)}/identity-photos/${slotIndex}/content`, sessionToken, fetchImpl); }
export function fetchHumanSightingPhotoObjectUrl(sessionToken, reportId, slotIndex, fetchImpl) { return privateObjectUrl(`/v2/safecare/human-sightings/${encodeURIComponent(reportId)}/photos/${slotIndex}/content`, sessionToken, fetchImpl); }
