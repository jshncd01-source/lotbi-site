import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-de88e6e1b0a7';

const BASE = '/v2/person-profiles';

function token(value) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new SiteCoreError('사람 정보를 보려면 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  return result;
}

function requestKey() {
  const id = globalThis.crypto?.randomUUID?.()?.replaceAll('-', '')
    || `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, '0').slice(0, 32);
  return `prq_${Date.now().toString().padStart(13, '0')}_${id.slice(0, 32)}`;
}

const MESSAGES = Object.freeze({
  PERSON_CARE_PROFILE_LIMIT_REACHED: '안심케어 프로필 한도에 도달했습니다. 기존 프로필을 정리하거나 플랜을 확인해 주세요.',
  PERSON_FIELD_INVALID: '이름과 입력 내용을 확인해 주세요.',
  PERSON_RELATIONSHIP_INVALID: '관계를 다시 선택해 주세요.',
  PERSON_PHOTO_TOO_LARGE: '사진은 2MB 이하로 선택해 주세요.',
  PERSON_PHOTO_UNSUPPORTED: 'JPG, PNG 또는 WEBP 사진을 선택해 주세요.',
  PERSON_PHOTO_INVALID: '사진을 읽지 못했습니다. 다른 사진으로 다시 시도해 주세요.',
  PERSON_PHOTO_BOUNDS_INVALID: '사진 크기가 너무 큽니다. 다른 사진으로 다시 시도해 주세요.',
  SESSION_REQUIRED: '로그인이 필요합니다.',
  SESSION_INVALID: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_AUDIENCE_RESTRICTED: '이 브라우저에서는 아직 사람 등록을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
});

async function payload(response) {
  try { return await response.json(); } catch { return {}; }
}

function apiError(response, body, fallback) {
  const detail = body && typeof body.detail === 'object' ? body.detail : {};
  const code = typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`;
  const message = MESSAGES[code]
    || (response.status >= 500 ? '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.' : fallback);
  return new SiteCoreError(message, {code, status: response.status, retryable: response.status >= 500});
}

async function jsonRequest(path, sessionToken, {method = 'GET', body, idempotent = false} = {}, fetchImpl = globalThis.fetch) {
  const headers = {Authorization: `Bearer ${token(sessionToken)}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotent) headers['Idempotency-Key'] = requestKey();
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method, mode: 'cors', credentials: 'omit', headers,
      ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
    });
  } catch {
    throw new SiteCoreError('안심케어 서버에 연결하지 못했습니다.', {code: 'PERSON_NETWORK_ERROR', retryable: true});
  }
  const data = response.status === 204 ? {} : await payload(response);
  if (!response.ok) throw apiError(response, data, '요청을 완료하지 못했습니다.');
  return data;
}

export async function listPersonProfiles(sessionToken, fetchImpl = globalThis.fetch) {
  const data = await jsonRequest(BASE, sessionToken, {}, fetchImpl);
  return Array.isArray(data.people) ? data.people : [];
}

export async function createPersonProfile(sessionToken, input, fetchImpl = globalThis.fetch) {
  const data = await jsonRequest(BASE, sessionToken, {method: 'POST', body: input, idempotent: true}, fetchImpl);
  if (!data.person?.person_id) throw new SiteCoreError('사람 등록 응답이 올바르지 않습니다.', {code: 'PERSON_CONTRACT_INVALID'});
  return data.person;
}

export async function uploadPersonPhoto(sessionToken, personId, revision, photoDataUri, fetchImpl = globalThis.fetch) {
  const data = await jsonRequest(`${BASE}/${encodeURIComponent(personId)}/photo`, sessionToken, {
    method: 'PUT', body: {expected_revision: revision, photo_data_uri: photoDataUri}, idempotent: true,
  }, fetchImpl);
  return data.person;
}

export async function deletePersonProfile(sessionToken, personId, revision, fetchImpl = globalThis.fetch) {
  await jsonRequest(`${BASE}/${encodeURIComponent(personId)}?expected_revision=${revision}`, sessionToken, {method: 'DELETE'}, fetchImpl);
}

export async function personThumbnailUrl(sessionToken, personId, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${CORE_ORIGIN}${BASE}/${encodeURIComponent(personId)}/photo/thumbnail`, {
    method: 'GET', mode: 'cors', credentials: 'omit', headers: {Authorization: `Bearer ${token(sessionToken)}`},
  });
  if (!response.ok) throw apiError(response, await payload(response), '사진을 불러오지 못했습니다.');
  return URL.createObjectURL(await response.blob());
}
