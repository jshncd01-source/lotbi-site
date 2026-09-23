// SITE-PET-FAMILY-WEB-01 — PET FAMILY Core client for the official Site.
//
// The Core registry is deliberately conservative: no public visual matching,
// no owner alerts, no contact relay, no AI calls. This client only reads and
// writes the owner's own records. Pet photos are private bytes served from
// an authenticated endpoint, so they are fetched as blobs and never turned
// into a shareable URL.
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=20260921-guestclaim1';

const PET_SPECIES = Object.freeze(['DOG', 'CAT']);
const PET_SEXES = Object.freeze(['MALE', 'FEMALE', 'UNKNOWN']);

export const PET_PHOTO_SLOT_CODES = Object.freeze([
  'NOSE_FRONT',
  'NOSE_LEFT',
  'NOSE_RIGHT',
  'FACE_FRONT',
  'FACE_LEFT',
  'FACE_RIGHT',
  'BODY_LEFT',
  'BODY_RIGHT',
  'BACK_REAR',
  'DISTINCTIVE',
]);

export const PET_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PET_PHOTO_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png']);

export function petSpeciesLabel(species) {
  if (species === 'DOG') return '강아지';
  if (species === 'CAT') return '고양이';
  return '';
}

export function petSexLabel(sex) {
  if (sex === 'MALE') return '수컷';
  if (sex === 'FEMALE') return '암컷';
  return '모름';
}

// The official registration number is sensitive. Detail views show it masked
// until the owner explicitly reveals it, and list views never receive it.
export function maskOfficialRegistrationNumber(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (raw.length <= 4) return '•'.repeat(raw.length);
  return `${raw.slice(0, 3)}${'•'.repeat(Math.max(raw.length - 6, 3))}${raw.slice(-3)}`;
}

export function petRequestId(kind) {
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `site.pet.${kind}.${unique}`;
}

function bearerToken(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('반려동물 정보를 보려면 LOTBI 로그인이 필요합니다.', {
      code: 'SITE_SESSION_REQUIRED',
      status: 401,
    });
  }
  return token;
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorFromResponse(response, payload, fallback) {
  const detail = payload && typeof payload.detail === 'object' ? payload.detail : {};
  return new SiteCoreError(
    typeof detail.message === 'string' && detail.message ? detail.message : fallback,
    {
      code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
      status: response.status,
      retryable: detail.retryable === true,
    },
  );
}

// Declaring the session invalid tears down the whole site, so only 401 counts:
// a 403 here means this one action is not permitted for this session — a pet
// somebody else owns, or 발견 신고 asking for an assurance level the session
// does not hold — and the session itself is still perfectly good.
function announceInvalidSiteSession(error) {
  if (!(error instanceof SiteCoreError) || error.status !== 401) return;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
}

// announceSessionFailure defaults to false, the opposite of site-core.js: one
// failing sub-request of this surface — a photo whose bytes 401 while the token
// is being rotated, a single SOS row — must leave the rest of the site standing.
// Only the read that opens the surface opts in.
async function petRequest(path, sessionToken, {
  method = 'GET',
  body = undefined,
  formData = undefined,
  requestId = '',
  raw = false,
  announceSessionFailure = false,
} = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const headers = {Authorization: `Bearer ${bearerToken(sessionToken)}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Core reads the idempotency key from X-Request-ID, matching the app client.
  if (requestId) headers['X-Request-ID'] = requestId;

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
      ...(formData !== undefined ? {body: formData} : {}),
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new SiteCoreError('반려동물 서버에 접속하지 못했습니다.', {
      code: 'PET_NETWORK_ERROR',
      retryable: true,
    });
  }

  if (raw) {
    if (!response.ok) {
      const error = errorFromResponse(response, await readPayload(response), '반려동물 사진을 불러오지 못했습니다.');
      if (announceSessionFailure) announceInvalidSiteSession(error);
      throw error;
    }
    return response;
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, '반려동물 요청을 완료하지 못했습니다.');
    if (announceSessionFailure) announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}

function normalizePet(value) {
  if (!value || typeof value !== 'object') return null;
  const petId = typeof value.pet_id === 'string' ? value.pet_id : '';
  const name = typeof value.name === 'string' ? value.name : '';
  if (!petId || !name) return null;
  return Object.freeze({
    petId,
    name,
    species: PET_SPECIES.includes(value.species) ? value.species : 'DOG',
    sex: PET_SEXES.includes(value.sex) ? value.sex : 'UNKNOWN',
    breed: typeof value.breed === 'string' ? value.breed : '',
    birthDate: typeof value.birth_date === 'string' ? value.birth_date : '',
    approximateAgeMonths: Number.isInteger(value.approximate_age_months) ? value.approximate_age_months : null,
    color: typeof value.color === 'string' ? value.color : '',
    distinctiveMarks: typeof value.distinctive_marks === 'string' ? value.distinctive_marks : '',
    officialRegistrationNumber: typeof value.official_registration_number === 'string'
      ? value.official_registration_number
      : '',
    officialRegistrationVerificationStatus: typeof value.official_registration_verification_status === 'string'
      ? value.official_registration_verification_status
      : '',
    photoCompletionState: value.photo_completion_state === 'UPLOAD_COMPLETE'
      ? 'UPLOAD_COMPLETE'
      : 'UPLOAD_INCOMPLETE',
    visualProfileState: typeof value.visual_profile_state === 'string' ? value.visual_profile_state : '',
    matchingConsentState: value.matching_consent_state === 'GRANTED' ? 'GRANTED' : 'NOT_GRANTED',
    accountState: typeof value.account_state === 'string' ? value.account_state : '',
  });
}

function normalizePhotoManifest(value) {
  const manifest = value && typeof value === 'object' ? value : {};
  const slotCount = Number.isInteger(manifest.slot_count) ? manifest.slot_count : 0;
  return Object.freeze({
    slotCount: Math.min(Math.max(slotCount, 0), PET_PHOTO_SLOT_CODES.length),
    state: manifest.state === 'UPLOAD_COMPLETE' ? 'UPLOAD_COMPLETE' : 'UPLOAD_INCOMPLETE',
    manifestVersion: Number.isInteger(manifest.manifest_version) ? manifest.manifest_version : 0,
  });
}

// The read that opens the surface, and the only one allowed to conclude the
// session is gone.
export async function listPets(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pets', sessionToken, {announceSessionFailure: true}, fetchImpl);
  const rows = Array.isArray(payload?.pets) ? payload.pets : [];
  return Object.freeze(rows.map(normalizePet).filter(Boolean));
}

export async function getPet(sessionToken, petId, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}`, sessionToken, {}, fetchImpl);
  const pet = normalizePet(payload?.pet);
  if (!pet) {
    throw new SiteCoreError('반려동물 정보를 확인하지 못했습니다.', {code: 'PET_NOT_FOUND', status: 404});
  }
  return pet;
}

export async function registerPet(sessionToken, input, fetchImpl = globalThis.fetch) {
  const body = {
    name: String(input?.name || '').trim(),
    species: PET_SPECIES.includes(input?.species) ? input.species : 'DOG',
  };
  if (PET_SEXES.includes(input?.sex)) body.sex = input.sex;
  for (const [key, field] of [
    ['breed', 'breed'],
    ['color', 'color'],
    ['distinctiveMarks', 'distinctive_marks'],
    ['officialRegistrationNumber', 'official_registration_number'],
    ['birthDate', 'birth_date'],
  ]) {
    const value = String(input?.[key] || '').trim();
    if (value) body[field] = value;
  }
  if (Number.isInteger(input?.approximateAgeMonths)) {
    body.approximate_age_months = input.approximateAgeMonths;
  }
  const payload = await petRequest('/v2/pets', sessionToken, {
    method: 'POST',
    body,
    requestId: input?.requestId || petRequestId('register'),
  }, fetchImpl);
  const pet = normalizePet(payload?.pet);
  if (!pet) {
    throw new SiteCoreError('반려동물을 등록하지 못했습니다.', {code: 'PET_REGISTER_FAILED'});
  }
  return pet;
}

export async function renamePet(sessionToken, petId, name, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}/nickname`, sessionToken, {
    method: 'PUT',
    body: {name: String(name || '').trim()},
  }, fetchImpl);
  const pet = normalizePet(payload?.pet);
  if (!pet) {
    throw new SiteCoreError('이름을 바꾸지 못했습니다.', {code: 'PET_RENAME_FAILED'});
  }
  return pet;
}

export async function setPetMatchingConsent(sessionToken, petId, {enabled, consentVersion}, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}/matching-consent`, sessionToken, {
    method: 'PUT',
    body: {enabled: enabled === true, consent_version: String(consentVersion || '').trim()},
  }, fetchImpl);
  const pet = normalizePet(payload?.pet);
  if (!pet) {
    throw new SiteCoreError('매칭 동의 상태를 바꾸지 못했습니다.', {code: 'PET_CONSENT_FAILED'});
  }
  return pet;
}

export async function deletePet(sessionToken, petId, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}`, sessionToken, {
    method: 'DELETE',
  }, fetchImpl);
  return Object.freeze({
    petId: typeof payload?.pet_id === 'string' ? payload.pet_id : petId,
    accountState: typeof payload?.account_state === 'string' ? payload.account_state : '',
  });
}

export async function getPetPhotoManifest(sessionToken, petId, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}/photos`, sessionToken, {}, fetchImpl);
  const rows = Array.isArray(payload?.photos) ? payload.photos : [];
  const slots = new Set(
    rows
      .map(row => (row && typeof row.slot_code === 'string' ? row.slot_code : ''))
      .filter(code => PET_PHOTO_SLOT_CODES.includes(code)),
  );
  return Object.freeze({
    manifest: normalizePhotoManifest(payload?.manifest),
    filledSlots: Object.freeze([...slots]),
  });
}

// Private bytes: fetched with the session bearer and handed back as an object
// URL the caller must revoke. Never rendered from a public link or CDN.
export async function fetchPetPhotoObjectUrl(sessionToken, petId, slotCode, fetchImpl = globalThis.fetch) {
  const response = await petRequest(
    `/v2/pets/${encodeURIComponent(petId)}/photos/${encodeURIComponent(slotCode)}/content`,
    sessionToken,
    {raw: true},
    fetchImpl,
  );
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
