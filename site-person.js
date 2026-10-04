// Owner-only Person + SOS Core client. No public person search or contact data.
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-8f7d68845114';

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
function person(row) { return Object.freeze({personId: row.person_id, displayName: row.display_name, nickname: row.nickname || '', relationship: row.relationship, revision: row.revision, hasPhoto: row.has_photo === true}); }
function sos(row) { if (row.matching_scope !== 'ACTIVE_SOS_ONLY' || row.automatic_identity_decision !== false) throw new SiteCoreError('SOS 안전 계약이 올바르지 않습니다.', {code: 'PERSON_RESPONSE_INVALID'}); return Object.freeze({sosId: row.sos_id, personId: row.person_id, displayName: row.display_name, status: row.status, lastSeenAt: row.last_seen_at, lastSeenSummary: row.last_seen_summary, description: row.description || ''}); }
function notice(row) { if (row.automatic_identity_decision !== false || row.contact_details_exposed !== false) throw new SiteCoreError('후보 안전 계약이 올바르지 않습니다.', {code: 'PERSON_RESPONSE_INVALID'}); return Object.freeze({noticeId: row.notice_id, candidateId: row.candidate_id, personId: row.person_id, displayName: row.display_name, status: row.status, response: row.response || '', faceScore: row.face_score, photoPath: row.registered_photo_path}); }
export const personRequestKey = kind => `site.person.${kind}.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
export async function listPeople(sessionToken, fetchImpl) { const payload = await request('/v2/person-profiles', sessionToken, {}, fetchImpl); return Object.freeze((payload.people || []).map(person)); }
export async function createPerson(sessionToken, input, fetchImpl) { const payload = await request('/v2/person-profiles', sessionToken, {method: 'POST', requestKey: input.requestKey || personRequestKey('create'), body: {display_name: input.displayName, relationship: input.relationship, nickname: input.nickname || null}}, fetchImpl); return person(payload.person); }
export async function updatePerson(sessionToken, input, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(input.personId)}`, sessionToken, {method: 'PATCH', body: {expected_revision: input.revision, display_name: input.displayName, relationship: input.relationship, nickname: input.nickname || null}}, fetchImpl); return person(payload.person); }
export async function deletePerson(sessionToken, value, fetchImpl) { await request(`/v2/person-profiles/${encodeURIComponent(value.personId)}?expected_revision=${value.revision}`, sessionToken, {method: 'DELETE'}, fetchImpl); }
export async function putPersonPhoto(sessionToken, input, fetchImpl) { const payload = await request(`/v2/person-profiles/${encodeURIComponent(input.personId)}/photo`, sessionToken, {method: 'PUT', requestKey: input.requestKey || personRequestKey('photo'), body: {expected_revision: input.revision, photo_data_uri: input.dataUri}}, fetchImpl); return person(payload.person); }
export async function listPersonSos(sessionToken, fetchImpl) { const payload = await request('/v2/person-sos?status=ACTIVE', sessionToken, {}, fetchImpl); return Object.freeze((payload.items || []).map(sos)); }
export async function createPersonSos(sessionToken, input, fetchImpl) { const payload = await request('/v2/person-sos', sessionToken, {method: 'POST', body: {person_id: input.personId, last_seen_at: input.lastSeenAt, last_seen_summary: input.lastSeenSummary, description: input.description || null, matching_consent_confirmed: true}}, fetchImpl); return sos(payload.sos); }
export async function closePersonSos(sessionToken, sosId, fetchImpl) { const payload = await request(`/v2/person-sos/${encodeURIComponent(sosId)}/close`, sessionToken, {method: 'PUT'}, fetchImpl); return sos(payload.sos); }
export async function listGuardianNotices(sessionToken, fetchImpl) { const payload = await request('/v2/person-sos/notices/candidates', sessionToken, {}, fetchImpl); return Object.freeze((payload.notices || []).map(notice)); }
export async function respondGuardianNotice(sessionToken, noticeId, response, fetchImpl) { const payload = await request(`/v2/person-sos/notices/${encodeURIComponent(noticeId)}/response`, sessionToken, {method: 'POST', body: {response}}, fetchImpl); return notice(payload.notice); }
