// SITE-PET-FAMILY-WEB-01 — PET FAMILY Core client for the official Site.
//
// The Core registry is deliberately conservative: no public visual matching,
// no owner alerts, no contact relay, no AI calls. This client only reads and
// writes the owner's own records. Pet photos are private bytes served from
// an authenticated endpoint, so they are fetched as blobs and never turned
// into a shareable URL.
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-af66d888b137';

const PET_SPECIES = Object.freeze(['DOG', 'CAT']);
const PET_SEXES = Object.freeze(['MALE', 'FEMALE', 'UNKNOWN']);

export const PET_MATCHING_CONSENT_VERSION = 'PET_MATCHING_CONSENT_2026_09_V2';

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

// Core judges the species; these two groupings exist only so the screen can
// name the photo to take next. They mirror ANCHOR_SLOT_CODES and
// CLOSEUP_SLOT_CODES in Core's app/pet_species_gate.py: the nose prints and
// the distinguishing mark are deliberate extreme close-ups, which an image
// classifier cannot read a species off, and everything else frames the whole
// animal. Derived from the one list above rather than retyped, so the slot
// order stays the single contract it already was.
const PET_PHOTO_CLOSEUP_SLOT_PREFIX = 'NOSE_';
const PET_PHOTO_DISTINCTIVE_SLOT = 'DISTINCTIVE';
export const PET_PHOTO_CLOSEUP_SLOT_CODES = Object.freeze(
  PET_PHOTO_SLOT_CODES.filter(
    code => code.startsWith(PET_PHOTO_CLOSEUP_SLOT_PREFIX) || code === PET_PHOTO_DISTINCTIVE_SLOT,
  ),
);
export const PET_PHOTO_ANCHOR_SLOT_CODES = Object.freeze(
  PET_PHOTO_SLOT_CODES.filter(code => !PET_PHOTO_CLOSEUP_SLOT_CODES.includes(code)),
);

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
// 번호가 두 가지이고, 섞이면 사용자가 손해를 봅니다.
//
//   pet_id                        — 롯비가 발급하는 번호. 우리 시스템 안에서만 뜻이 있습니다.
//   official_registration_number  — 국가 동물등록번호. 동물보호법에 따라 국가 시스템이
//                                   발급하며 우리는 발급할 수 없습니다.
//
// 화면에 "식별 번호"라고만 쓰면 사용자는 국가 등록번호를 받은 것으로 오해하고,
// 그 상태로 동물병원이나 지자체에 가면 통하지 않습니다.
export const LOTBI_PET_NUMBER_LABEL = '롯비 반려동물 번호';
export const OFFICIAL_REGISTRATION_LABEL = '국가 동물등록번호';

// 읽고 말할 수 있어야 합니다. PET_KR_0123456789ABCDEF0123 을
// "PET-KR 0123 4567 89AB CDEF 0123" 으로 끊어 줍니다.
export function lotbiPetNumber(petId) {
  const raw = String(petId || '');
  const match = /^PET_KR_([0-9A-F]{20})$/.exec(raw);
  if (!match) return raw;
  const groups = match[1].match(/.{1,4}/g) || [];
  return `PET-KR ${groups.join(' ')}`;
}

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

// Core answers in English, for operators and logs. A customer who cannot
// register a pet should not be shown "Session is restricted to the LOTBI Site
// audience" — that is our internal wiring, not their problem. So the screen
// gets a Korean sentence chosen by error code, and the code itself rides along
// on the error object (and the DOM) so an engineer can still name the cause.
const PET_ERROR_MESSAGES = Object.freeze({
  // Session and permission.
  SESSION_REQUIRED: '로그인이 필요합니다.',
  SESSION_INVALID: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_AUDIENCE_RESTRICTED: '이 브라우저 세션에서는 아직 반려동물 기능을 쓸 수 없습니다. 잠시 후 다시 시도해 주세요.',
  SESSION_ASSURANCE_INSUFFICIENT: '보안 확인이 더 필요한 기능입니다. 다시 로그인한 뒤 시도해 주세요.',
  FEDERATED_SESSION_LIMITED: '보안 확인이 더 필요한 기능입니다. 다시 로그인한 뒤 시도해 주세요.',
  PET_ACCOUNT_UNAVAILABLE: '계정 상태를 확인하지 못했습니다.',
  PET_CASE_ACCOUNT_UNAVAILABLE: '계정 상태를 확인하지 못했습니다.',

  // Registration fields.
  PET_NAME_INVALID: '이름을 확인해 주세요. 1~120자로 입력합니다.',
  PET_SPECIES_INVALID: '종류를 확인해 주세요.',
  PET_SEX_INVALID: '성별을 확인해 주세요.',
  PET_BIRTH_DATE_INVALID: '생년월일을 확인해 주세요.',
  PET_AGE_INVALID: '나이를 확인해 주세요.',
  PET_FIELD_INVALID: '입력한 내용을 확인해 주세요.',
  PET_CASE_FIELD_INVALID: '입력한 내용을 확인해 주세요.',
  PET_CONSENT_VERSION_INVALID: '동의 정보를 확인하지 못했습니다.',

  // Retry and idempotency.
  PET_REQUEST_ID_INVALID: '요청을 다시 보내 주세요.',
  PET_CASE_REQUEST_ID_INVALID: '요청을 다시 보내 주세요.',
  PET_IDEMPOTENCY_CONFLICT: '같은 요청이 이미 처리 중입니다. 잠시 후 확인해 주세요.',
  PET_CASE_IDEMPOTENCY_CONFLICT: '같은 요청이 이미 처리 중입니다. 잠시 후 확인해 주세요.',
  PET_IDEMPOTENCY_STATE_INVALID: '같은 요청이 이미 처리 중입니다. 잠시 후 확인해 주세요.',
  PET_CASE_IDEMPOTENCY_STATE_INVALID: '같은 요청이 이미 처리 중입니다. 잠시 후 확인해 주세요.',

  // Records.
  PET_NOT_FOUND: '반려동물 정보를 찾지 못했습니다.',
  PET_SOS_NOT_FOUND: '실종 신고를 찾지 못했습니다.',
  FOUND_PET_CASE_NOT_FOUND: '발견 신고를 찾지 못했습니다.',
  PET_SOS_STATE_INVALID: '이미 종료된 신고입니다.',
  FOUND_PET_CASE_STATE_INVALID: '이미 종료된 신고입니다.',
  FOUND_PET_CASE_PHOTO_CLOSED: '종료된 신고에는 사진을 올릴 수 없습니다.',

  // Photos.
  PET_PHOTO_NOT_FOUND: '사진을 찾지 못했습니다.',
  FOUND_PET_PHOTO_NOT_FOUND: '사진을 찾지 못했습니다.',
  PET_PHOTO_SLOT_INVALID: '사진 칸을 확인해 주세요.',
  FOUND_PET_PHOTO_SLOT_INVALID: '사진 칸을 확인해 주세요.',
  PET_PHOTO_TYPE_NOT_ALLOWED: 'JPG 또는 PNG 사진만 올릴 수 있습니다.',
  PET_PHOTO_CONTENT_INVALID: '사진 파일을 읽지 못했습니다. 다른 사진으로 시도해 주세요.',
  PET_PHOTO_CONTENT_MISMATCH: '사진 파일을 읽지 못했습니다. 다른 사진으로 시도해 주세요.',

  // 개·고양이만 등록. Core refuses the photo outright rather than asking the
  // owner to confirm what it is, so every sentence here has to end in
  // something the owner can do next.
  PET_PHOTO_NOT_DOG_OR_CAT: '강아지와 고양이만 등록할 수 있어요. 반려동물이 화면에 꽉 차게 다시 찍어 주세요.',
  PET_PHOTO_SPECIES_UNCERTAIN: '강아지인지 고양이인지 또렷하게 보이지 않았어요. 밝은 곳에서 다른 각도로 다시 찍어 주세요.',
  PET_PHOTO_TOO_BLURRY: '사진이 흐려요. 초점을 맞추고 다시 찍어 주세요.',
  PET_PHOTO_TOO_SMALL: '사진이 너무 작아요. 줄이지 말고 원본 크기로 올려 주세요.',
  PET_PHOTO_ANCHOR_REQUIRED: '코·특징 사진은 얼굴이나 몸 전체 사진을 먼저 올린 뒤에 등록할 수 있어요.',
  PET_PHOTO_SPECIES_CHECK_UNAVAILABLE: '사진 확인 기능이 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.',
  PET_DRAFT_NOT_FOUND: '저장하던 등록 초안을 찾지 못했습니다. 새로 시작해 주세요.',
  PET_DRAFT_NOT_ACTIVE: '이미 마친 등록 초안입니다.',
  PET_DRAFT_FIELD_INVALID: '입력한 내용을 확인해 주세요.',
  PET_DRAFT_STEP_INVALID: '등록 단계를 다시 선택해 주세요.',
  PET_DRAFT_BREED_INVALID: '품종을 선택해 주세요.',
  PET_DRAFT_BREED_OTHER_REQUIRED: '기타 품종 이름을 입력해 주세요.',
  PET_DRAFT_BREED_SPECIES_CONFLICT: '선택한 종과 품종이 맞지 않습니다.',
  PET_DRAFT_COLORS_INVALID: '털색은 여섯 개까지 선택할 수 있습니다.',
  PET_DRAFT_COLOR_INVALID: '털색을 다시 선택해 주세요.',
  PET_DRAFT_COLOR_OTHER_REQUIRED: '기타 털색을 입력해 주세요.',
  PET_DRAFT_PATTERN_INVALID: '무늬를 다시 선택해 주세요.',
  PET_DRAFT_PATTERN_OTHER_REQUIRED: '기타 무늬를 입력해 주세요.',
  PET_DRAFT_PATTERN_SPECIES_CONFLICT: '선택한 종과 무늬가 맞지 않습니다.',
  PET_DRAFT_PHOTOS_INCOMPLETE: '사진 10장을 모두 올려 주세요.',
  PET_DRAFT_PHOTO_REJECTED: '확인하지 못한 사진이 있습니다. 표시된 사진을 다시 올려 주세요.',
  PET_DRAFT_PHOTO_CHECK_PENDING: '사진 확인이 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.',
  PET_DRAFT_PHOTO_NOT_FOUND: '등록 초안의 사진을 찾지 못했습니다.',
  PET_DRAFT_REQUEST_ID_INVALID: '등록을 새로 시작해 주세요.',
  PET_MATCH_NOTICE_NOT_FOUND: '확인할 발견 제보를 찾지 못했습니다.',
  PET_MATCH_PHOTO_NOT_FOUND: '발견 사진을 불러오지 못했습니다.',

  // Location, for the two report forms.
  PET_LOCATION_REQUIRED: '장소를 입력해 주세요.',
  PET_LOCATION_FIELD_INVALID: '장소를 확인해 주세요.',
  PET_LOCATION_SOURCE_INVALID: '장소 정보를 확인하지 못했습니다.',

  // Deliberately off in Core.
  PET_SOS_DISABLED: '실종 신고는 아직 열리지 않았습니다.',
  PET_FOUND_REPORT_DISABLED: '발견 신고는 아직 열리지 않았습니다.',
});

function petErrorMessage(code, status, fallback) {
  const known = PET_ERROR_MESSAGES[code];
  if (known) return known;
  if (status === 401) return PET_ERROR_MESSAGES.SESSION_INVALID;
  if (status === 403) return '이 작업을 수행할 권한이 없습니다.';
  if (status === 413) return '사진 용량이 너무 큽니다.';
  if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
  return fallback;
}

function errorFromResponse(response, payload, fallback) {
  const detail = payload && typeof payload.detail === 'object' ? payload.detail : {};
  const code = typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`;
  const error = new SiteCoreError(
    petErrorMessage(code, response.status, fallback),
    {
      code,
      status: response.status,
      retryable: detail.retryable === true,
    },
  );
  // A refusal the owner cannot act on is a dead end. Core names the next step
  // and the screen turns it into the button, so it must not be dropped here.
  if (typeof detail.next_action === 'string' && detail.next_action) {
    error.nextAction = detail.next_action;
  }
  return error;
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
  extraHeaders = undefined,
} = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const headers = {Authorization: `Bearer ${bearerToken(sessionToken)}`};
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [name, value] of Object.entries(extraHeaders)) {
      if (name.toLowerCase() === 'authorization') continue;
      if (typeof value === 'string' && value) headers[name] = value;
    }
  }
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
    breedCode: typeof value.breed_code === 'string' ? value.breed_code : '',
    birthDate: typeof value.birth_date === 'string' ? value.birth_date : '',
    approximateAgeMonths: Number.isInteger(value.approximate_age_months) ? value.approximate_age_months : null,
    ageEstimateAsOf: typeof value.age_estimate_as_of === 'string' ? value.age_estimate_as_of : '',
    familyDate: typeof value.family_date === 'string' ? value.family_date : '',
    color: typeof value.color === 'string' ? value.color : '',
    colorCodes: Array.isArray(value.color_codes) ? Object.freeze(value.color_codes.filter(item => typeof item === 'string')) : Object.freeze([]),
    colorOther: typeof value.color_other === 'string' ? value.color_other : '',
    coatPatternCode: typeof value.coat_pattern_code === 'string' ? value.coat_pattern_code : '',
    coatPatternOther: typeof value.coat_pattern_other === 'string' ? value.coat_pattern_other : '',
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

function normalizeCatalogItem(value) {
  if (!value || typeof value !== 'object') return null;
  const code = typeof value.code === 'string' ? value.code : '';
  const displayName = typeof value.display_name === 'string' ? value.display_name : '';
  if (!code || !displayName) return null;
  return Object.freeze({
    code,
    displayName,
    species: PET_SPECIES.includes(value.species) ? value.species : '',
  });
}

function normalizePetCatalog(value) {
  const source = value && typeof value === 'object' ? value : {};
  const breeds = source.breeds && typeof source.breeds === 'object' ? source.breeds : {};
  return Object.freeze({
    breeds: Object.freeze({
      DOG: Object.freeze((Array.isArray(breeds.DOG) ? breeds.DOG : []).map(normalizeCatalogItem).filter(Boolean)),
      CAT: Object.freeze((Array.isArray(breeds.CAT) ? breeds.CAT : []).map(normalizeCatalogItem).filter(Boolean)),
    }),
    colors: Object.freeze((Array.isArray(source.colors) ? source.colors : []).map(normalizeCatalogItem).filter(Boolean)),
    patterns: Object.freeze((Array.isArray(source.patterns) ? source.patterns : []).map(normalizeCatalogItem).filter(Boolean)),
  });
}

function normalizePetDraftPhoto(value) {
  if (!value || typeof value !== 'object' || !PET_PHOTO_SLOT_CODES.includes(value.slot_code)) return null;
  return Object.freeze({
    slotCode: value.slot_code,
    slotIndex: Number.isInteger(value.slot_index) ? value.slot_index : 0,
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    inspectionState: ['PENDING', 'ACCEPTED', 'REJECTED'].includes(value.inspection_state)
      ? value.inspection_state
      : 'PENDING',
    inspectionReasonCode: typeof value.inspection_reason_code === 'string' ? value.inspection_reason_code : '',
  });
}

function normalizePetRegistrationDraft(value) {
  if (!value || typeof value !== 'object' || typeof value.draft_id !== 'string') return null;
  return Object.freeze({
    draftId: value.draft_id,
    status: typeof value.status === 'string' ? value.status : 'ACTIVE',
    currentStep: ['PHOTOS', 'BASIC', 'ADDITIONAL', 'REVIEW'].includes(value.current_step) ? value.current_step : 'PHOTOS',
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    name: typeof value.name === 'string' ? value.name : '',
    species: PET_SPECIES.includes(value.species) ? value.species : '',
    sex: PET_SEXES.includes(value.sex) ? value.sex : '',
    breedCode: typeof value.breed_code === 'string' ? value.breed_code : '',
    breed: typeof value.breed === 'string' ? value.breed : '',
    birthDate: typeof value.birth_date === 'string' ? value.birth_date : '',
    approximateAgeMonths: Number.isInteger(value.approximate_age_months) ? value.approximate_age_months : null,
    ageEstimateAsOf: typeof value.age_estimate_as_of === 'string' ? value.age_estimate_as_of : '',
    familyDate: typeof value.family_date === 'string' ? value.family_date : '',
    colorCodes: Object.freeze(Array.isArray(value.color_codes) ? value.color_codes.filter(item => typeof item === 'string') : []),
    colorOther: typeof value.color_other === 'string' ? value.color_other : '',
    coatPatternCode: typeof value.coat_pattern_code === 'string' ? value.coat_pattern_code : '',
    coatPatternOther: typeof value.coat_pattern_other === 'string' ? value.coat_pattern_other : '',
    distinctiveMarks: typeof value.distinctive_marks === 'string' ? value.distinctive_marks : '',
    officialRegistrationNumber: typeof value.official_registration_number === 'string' ? value.official_registration_number : '',
    matchingConsentState: value.matching_consent_state === 'GRANTED' ? 'GRANTED' : 'NOT_GRANTED',
    matchingConsentVersion: typeof value.matching_consent_version === 'string' ? value.matching_consent_version : '',
    photos: Object.freeze((Array.isArray(value.photos) ? value.photos : []).map(normalizePetDraftPhoto).filter(Boolean)),
    completedPetId: typeof value.completed_pet_id === 'string' ? value.completed_pet_id : '',
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : '',
  });
}

export async function getPetCatalog(fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pet-catalog', 'catalog-public', {}, fetchImpl);
  return normalizePetCatalog(payload);
}

export async function getActivePetRegistrationDraft(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pet-registration-drafts/active', sessionToken, {}, fetchImpl);
  return normalizePetRegistrationDraft(payload?.draft);
}

export async function createPetRegistrationDraft(sessionToken, requestId = '', fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pet-registration-drafts', sessionToken, {
    method: 'POST',
    requestId: requestId || petRequestId('draft'),
  }, fetchImpl);
  const draft = normalizePetRegistrationDraft(payload?.draft);
  if (!draft) throw new SiteCoreError('반려동물 등록을 시작하지 못했습니다.', {code: 'PET_DRAFT_CREATE_FAILED'});
  return draft;
}

export async function updatePetRegistrationDraft(sessionToken, draftId, updates, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pet-registration-drafts/${encodeURIComponent(draftId)}`, sessionToken, {
    method: 'PATCH',
    body: updates && typeof updates === 'object' ? updates : {},
  }, fetchImpl);
  const draft = normalizePetRegistrationDraft(payload?.draft);
  if (!draft) throw new SiteCoreError('등록 초안을 저장하지 못했습니다.', {code: 'PET_DRAFT_SAVE_FAILED'});
  return draft;
}

export async function deletePetRegistrationDraft(sessionToken, draftId, fetchImpl = globalThis.fetch) {
  return petRequest(`/v2/pet-registration-drafts/${encodeURIComponent(draftId)}`, sessionToken, {
    method: 'DELETE',
  }, fetchImpl);
}

export async function uploadPetRegistrationDraftPhoto(sessionToken, draftId, slotCode, file, fetchImpl = globalThis.fetch) {
  const rejection = petPhotoRejection(file);
  if (rejection) throw new SiteCoreError(rejection, {code: 'PET_PHOTO_REJECTED_LOCALLY', status: 0});
  const formData = new FormData();
  formData.append('file', file, file.name || 'pet-photo');
  const payload = await petRequest(
    `/v2/pet-registration-drafts/${encodeURIComponent(draftId)}/photos/${encodeURIComponent(slotCode)}`,
    sessionToken,
    {method: 'PUT', formData},
    fetchImpl,
  );
  const photo = normalizePetDraftPhoto(payload?.photo);
  if (!photo) throw new SiteCoreError('등록 사진을 저장하지 못했습니다.', {code: 'PET_DRAFT_PHOTO_SAVE_FAILED'});
  return photo;
}

export async function deletePetRegistrationDraftPhoto(sessionToken, draftId, slotCode, fetchImpl = globalThis.fetch) {
  return petRequest(
    `/v2/pet-registration-drafts/${encodeURIComponent(draftId)}/photos/${encodeURIComponent(slotCode)}`,
    sessionToken,
    {method: 'DELETE'},
    fetchImpl,
  );
}

export async function fetchPetRegistrationDraftPhotoObjectUrl(sessionToken, draftId, slotCode, fetchImpl = globalThis.fetch) {
  const response = await petRequest(
    `/v2/pet-registration-drafts/${encodeURIComponent(draftId)}/photos/${encodeURIComponent(slotCode)}/content`,
    sessionToken,
    {raw: true},
    fetchImpl,
  );
  return URL.createObjectURL(await response.blob());
}

export async function finalizePetRegistrationDraft(sessionToken, draftId, requestId = '', fetchImpl = globalThis.fetch) {
  const payload = await petRequest(
    `/v2/pet-registration-drafts/${encodeURIComponent(draftId)}/finalize`,
    sessionToken,
    {method: 'POST', requestId: requestId || petRequestId('finalize')},
    fetchImpl,
  );
  const pet = normalizePet(payload?.pet);
  if (!pet) throw new SiteCoreError('반려동물 등록을 마치지 못했습니다.', {code: 'PET_DRAFT_FINALIZE_FAILED'});
  return Object.freeze({pet, draft: normalizePetRegistrationDraft(payload?.draft)});
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

function normalizePetProfile(value) {
  if (!value || typeof value !== 'object') return null;
  const petId = typeof value.pet_id === 'string' ? value.pet_id : '';
  const name = typeof value.name === 'string' ? value.name : '';
  if (!petId || !name) return null;
  const thumbnail = value.thumbnail && typeof value.thumbnail === 'object' ? value.thumbnail : {};
  const visual = value.visual_identity && typeof value.visual_identity === 'object' ? value.visual_identity : {};
  const sos = value.sos && typeof value.sos === 'object' ? value.sos : {};
  const age = value.age && typeof value.age === 'object' ? value.age : {};
  const family = value.family_duration && typeof value.family_duration === 'object' ? value.family_duration : null;
  const birthday = value.birthday && typeof value.birthday === 'object' ? value.birthday : null;
  return Object.freeze({
    petId,
    name,
    species: PET_SPECIES.includes(value.species) ? value.species : 'DOG',
    isPrimary: value.is_primary === true,
    ageLabel: typeof age.label === 'string' ? age.label : '나이 미등록',
    ageMode: typeof age.mode === 'string' ? age.mode : 'UNKNOWN',
    familyLabel: typeof family?.label === 'string' ? family.label : '',
    birthday: birthday ? Object.freeze({
      date: typeof birthday.date === 'string' ? birthday.date : '',
      daysUntil: Number.isInteger(birthday.days_until) ? birthday.days_until : null,
      state: typeof birthday.state === 'string' ? birthday.state : '',
      reminderDue: birthday.reminder_due === true,
    }) : null,
    photoCount: Number.isInteger(value.photo_count) ? value.photo_count : 0,
    photoTotal: Number.isInteger(value.photo_total) ? value.photo_total : PET_PHOTO_SLOT_CODES.length,
    thumbnailSlot: PET_PHOTO_SLOT_CODES.includes(thumbnail.slot_code) ? thumbnail.slot_code : '',
    visualStatus: typeof visual.status === 'string' ? visual.status : 'UNAVAILABLE',
    visualLabel: typeof visual.label === 'string' ? visual.label : '식별정보 준비 중',
    activeSos: sos.active === true,
    recentlyResolved: sos.recently_resolved === true,
    lastSeenAt: typeof sos.last_seen_at === 'string' ? sos.last_seen_at : '',
    lastSeenLocation: sos.last_seen_location && typeof sos.last_seen_location === 'object'
      ? Object.freeze({...sos.last_seen_location})
      : Object.freeze({}),
    candidateNoticeCount: Number.isInteger(value.candidate_notice_count) ? value.candidate_notice_count : 0,
    candidateLabel: typeof value.candidate_label === 'string' ? value.candidate_label : '',
    timeline: Object.freeze((Array.isArray(value.timeline) ? value.timeline : []).flatMap(item => {
      if (!item || typeof item !== 'object' || typeof item.label !== 'string') return [];
      return [Object.freeze({
        type: typeof item.type === 'string' ? item.type : '',
        at: typeof item.at === 'string' ? item.at : '',
        label: item.label,
      })];
    })),
    birthdayRemindersEnabled: value.birthday_reminders_enabled !== false,
    familyAnniversaryRemindersEnabled: value.family_anniversary_reminders_enabled === true,
  });
}

export async function getPetProfileHub(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pets/profile-hub', sessionToken, {}, fetchImpl);
  const rows = Array.isArray(payload?.pets) ? payload.pets : [];
  return Object.freeze(rows.map(normalizePetProfile).filter(Boolean));
}

export async function updatePetProfilePreferences(sessionToken, petId, updates, fetchImpl = globalThis.fetch) {
  const body = {};
  for (const key of ['is_primary', 'birthday_reminders_enabled', 'family_anniversary_reminders_enabled']) {
    if (typeof updates?.[key] === 'boolean') body[key] = updates[key];
  }
  const payload = await petRequest(`/v2/pets/${encodeURIComponent(petId)}/profile-preferences`, sessionToken, {
    method: 'PUT',
    body,
  }, fetchImpl);
  return normalizePet(payload?.pet);
}

function normalizePetMatchNotice(value) {
  if (!value || typeof value !== 'object') return null;
  const candidateId = typeof value.candidate_id === 'string' ? value.candidate_id : '';
  const petId = typeof value.pet_id === 'string' ? value.pet_id : '';
  if (!candidateId || !petId) return null;
  const location = value.found_location && typeof value.found_location === 'object' ? value.found_location : {};
  return Object.freeze({
    noticeId: typeof value.notice_id === 'string' ? value.notice_id : '',
    candidateId,
    petId,
    status: typeof value.status === 'string' ? value.status : 'UNREAD',
    ownerResponse: typeof value.owner_response === 'string' ? value.owner_response : '',
    message: typeof value.message === 'string' ? value.message : '유사한 발견 제보가 접수되었습니다.',
    visualSimilarity: Number.isInteger(value.visual_similarity) ? value.visual_similarity : null,
    visualSimilarityLabel: typeof value.visual_similarity_label === 'string' ? value.visual_similarity_label : '',
    scoreIsIdentityProbability: value.score_is_identity_probability === true,
    evidenceCoverage: typeof value.evidence_coverage === 'string' ? value.evidence_coverage : '',
    foundAt: typeof value.found_at === 'string' ? value.found_at : '',
    foundLocation: Object.freeze({...location}),
    reporterContactReturned: value.reporter_contact_returned === true,
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
  });
}

export async function listPetMatchNotices(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pets/match-notices', sessionToken, {}, fetchImpl);
  const rows = Array.isArray(payload?.notices) ? payload.notices : [];
  return Object.freeze(rows.map(normalizePetMatchNotice).filter(Boolean));
}

export async function fetchPetMatchNoticePhotoObjectUrl(sessionToken, candidateId, fetchImpl = globalThis.fetch) {
  const response = await petRequest(
    `/v2/pets/match-notices/${encodeURIComponent(candidateId)}/found-photo`,
    sessionToken,
    {raw: true},
    fetchImpl,
  );
  return URL.createObjectURL(await response.blob());
}

export async function respondToPetMatchNotice(sessionToken, candidateId, response, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(
    `/v2/pets/match-notices/${encodeURIComponent(candidateId)}/response`,
    sessionToken,
    {method: 'POST', body: {response}},
    fetchImpl,
  );
  return Object.freeze({
    candidateId: typeof payload?.candidate_id === 'string' ? payload.candidate_id : candidateId,
    response: typeof payload?.response === 'string' ? payload.response : '',
    contactRelayStarted: payload?.contact_relay_started === true,
    reporterContactReturned: payload?.reporter_contact_returned === true,
  });
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

// Checked before the request so an obviously wrong file fails immediately with
// a readable message instead of a 413/415 round trip. Core re-checks the bytes.
export function petPhotoRejection(file) {
  if (!file) return '사진 파일을 선택해 주세요.';
  if (!PET_PHOTO_MIME_TYPES.includes(file.type)) return 'JPG 또는 PNG 사진만 올릴 수 있습니다.';
  if (file.size > PET_PHOTO_MAX_BYTES) return '사진 용량은 10MB까지 올릴 수 있습니다.';
  return '';
}

// What the owner can be told to do about a refusal, in the words of a button.
export function petPhotoNextActionLabel(nextAction) {
  if (nextAction === 'UPLOAD_FACE_OR_BODY_FIRST') return '얼굴 사진부터 올리기';
  if (nextAction === 'RETRY_LATER') return '다시 시도하기';
  return '다시 찍기';
}

// Below this Core cannot judge the photo at all: normalising would have to
// enlarge it, and a frame that small is no use to a nose print either.
export const PET_PHOTO_MIN_EDGE = 256;

// The screen's own quick look, and only that. Core takes the decision that
// counts — it has the classifier, and the browser can be skipped entirely.
// This exists so a frame that is obviously unusable fails in the viewfinder
// instead of after a round trip.
//
// It is deliberately slacker than Core: the blur floor here is 60 against
// Core's 100, because a browser resamples differently than Core does and an
// over-eager local check would refuse photos Core would have taken. A photo
// this lets through may still be refused; a photo this refuses would have been
// refused anyway.
const LOCAL_SHARPNESS_FLOOR = 60;

function petPhotoCanvas(size) {
  if (typeof globalThis.OffscreenCanvas === 'function') return new globalThis.OffscreenCanvas(size, size);
  const document = globalThis.document;
  if (!document || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

// Short side to 256, centre crop 224 — the same framing Core measures on, so
// the two numbers mean the same thing.
async function petPhotoQuickLook(file) {
  if (typeof globalThis.createImageBitmap !== 'function') return null;
  let bitmap;
  try {
    bitmap = await globalThis.createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const shortEdge = Math.min(bitmap.width, bitmap.height);
    if (!shortEdge) return null;
    if (shortEdge < PET_PHOTO_MIN_EDGE) return {tooSmall: true, sharpness: 0};

    const scale = 256 / shortEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = petPhotoCanvas(224);
    const context = canvas?.getContext('2d', {willReadFrequently: true});
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height,
      -Math.floor((width - 224) / 2), -Math.floor((height - 224) / 2), width, height);

    const {data} = context.getImageData(0, 0, 224, 224);
    const grey = new Float32Array(224 * 224);
    for (let i = 0, p = 0; i < grey.length; i += 1, p += 4) {
      grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let y = 1; y < 223; y += 1) {
      for (let x = 1; x < 223; x += 1) {
        const i = y * 224 + x;
        const value = -4 * grey[i] + grey[i - 224] + grey[i + 224] + grey[i - 1] + grey[i + 1];
        sum += value;
        sumSquares += value * value;
        count += 1;
      }
    }
    const mean = sum / count;
    return {tooSmall: false, sharpness: sumSquares / count - mean * mean};
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}

// Returns {code, message} to show, or null when this screen has no opinion.
export async function inspectPetPhotoLocally(file) {
  const looked = await petPhotoQuickLook(file);
  if (!looked) return null;
  if (looked.tooSmall) {
    return {code: 'PET_PHOTO_TOO_SMALL', message: PET_ERROR_MESSAGES.PET_PHOTO_TOO_SMALL};
  }
  if (looked.sharpness < LOCAL_SHARPNESS_FLOOR) {
    return {code: 'PET_PHOTO_TOO_BLURRY', message: PET_ERROR_MESSAGES.PET_PHOTO_TOO_BLURRY};
  }
  return null;
}

export async function uploadPetPhoto(sessionToken, petId, slotCode, file, fetchImpl = globalThis.fetch) {
  const rejection = petPhotoRejection(file);
  if (rejection) {
    throw new SiteCoreError(rejection, {code: 'PET_PHOTO_REJECTED_LOCALLY', status: 0});
  }
  const formData = new FormData();
  formData.append('file', file, file.name || 'pet-photo');
  const payload = await petRequest(
    `/v2/pets/${encodeURIComponent(petId)}/photos/${encodeURIComponent(slotCode)}`,
    sessionToken,
    {method: 'PUT', formData},
    fetchImpl,
  );
  return Object.freeze({manifest: normalizePhotoManifest(payload?.manifest)});
}

export async function deletePetPhoto(sessionToken, petId, slotCode, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(
    `/v2/pets/${encodeURIComponent(petId)}/photos/${encodeURIComponent(slotCode)}`,
    sessionToken,
    {method: 'DELETE'},
    fetchImpl,
  );
  return Object.freeze({manifest: normalizePhotoManifest(payload?.manifest)});
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

// ---------------------------------------------------------------- SOS cases
//
// A case records what the owner saw and when. Core does no public matching and
// sends no owner alerts, so nothing here notifies anyone: it is the owner's own
// record, which they close themselves.

const CASE_STATUSES = Object.freeze(['ACTIVE', 'RESOLVED', 'CANCELLED', 'EXPIRED']);

function normalizeCase(value, idKey) {
  if (!value || typeof value !== 'object') return null;
  const caseId = typeof value[idKey] === 'string' ? value[idKey] : '';
  if (!caseId) return null;
  const location = value.last_seen_location || value.found_location || {};
  return Object.freeze({
    caseId,
    petId: typeof value.pet_id === 'string' ? value.pet_id : '',
    species: PET_SPECIES.includes(value.species) ? value.species : '',
    locationLabel: typeof location.label === 'string' ? location.label : '',
    occurredAt: typeof value.last_seen_at === 'string'
      ? value.last_seen_at
      : (typeof value.found_at === 'string' ? value.found_at : ''),
    note: typeof value.note === 'string' ? value.note : '',
    description: typeof value.description === 'string' ? value.description : '',
    photoCount: Number.isInteger(value.photo_count) ? value.photo_count : null,
    status: CASE_STATUSES.includes(value.status) ? value.status : 'ACTIVE',
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
  });
}

export async function createPetSOS(sessionToken, input, fetchImpl = globalThis.fetch) {
  const body = {
    pet_id: String(input?.petId || ''),
    location_source: 'USER_ENTERED',
    last_seen_at: String(input?.lastSeenAt || ''),
  };
  const label = String(input?.locationLabel || '').trim();
  if (label) body.last_seen_location = {label};
  const note = String(input?.note || '').trim();
  if (note) body.note = note;

  const payload = await petRequest('/v2/pets/sos', sessionToken, {
    method: 'POST',
    body,
    requestId: input?.requestId || petRequestId('sos'),
  }, fetchImpl);
  const record = normalizeCase(payload?.sos, 'sos_case_id');
  if (!record) throw new SiteCoreError('실종 신고를 저장하지 못했습니다.', {code: 'PET_SOS_FAILED'});
  return record;
}

export async function listPetSOS(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pets/sos', sessionToken, {}, fetchImpl);
  const rows = Array.isArray(payload?.cases) ? payload.cases : [];
  return Object.freeze(rows.map(row => normalizeCase(row, 'sos_case_id')).filter(Boolean));
}

export async function closePetSOS(sessionToken, caseId, resolved, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/sos/${encodeURIComponent(caseId)}/close`, sessionToken, {
    method: 'PUT',
    body: {resolved: resolved === true},
  }, fetchImpl);
  const record = normalizeCase(payload?.sos, 'sos_case_id');
  if (!record) throw new SiteCoreError('실종 신고를 종료하지 못했습니다.', {code: 'PET_SOS_CLOSE_FAILED'});
  return record;
}

// -------------------------------------------------------------- Found cases
//
// Reporting an animal someone else found needs no registered pet, but Core
// still requires a signed-in session, so the surface asks for login first.

export async function createFoundPet(sessionToken, input, fetchImpl = globalThis.fetch) {
  const body = {
    species: PET_SPECIES.includes(input?.species) ? input.species : 'DOG',
    location_source: 'USER_ENTERED',
    found_at: String(input?.foundAt || ''),
  };
  const label = String(input?.locationLabel || '').trim();
  if (label) body.found_location = {label};
  const description = String(input?.description || '').trim();
  if (description) body.description = description;

  const payload = await petRequest('/v2/pets/found', sessionToken, {
    method: 'POST',
    body,
    requestId: input?.requestId || petRequestId('found'),
  }, fetchImpl);
  const record = normalizeCase(payload?.found, 'found_case_id');
  if (!record) throw new SiteCoreError('발견 신고를 저장하지 못했습니다.', {code: 'PET_FOUND_FAILED'});
  return record;
}

export async function listFoundPets(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await petRequest('/v2/pets/found', sessionToken, {}, fetchImpl);
  const rows = Array.isArray(payload?.cases) ? payload.cases : [];
  return Object.freeze(rows.map(row => normalizeCase(row, 'found_case_id')).filter(Boolean));
}

export async function closeFoundPet(sessionToken, caseId, resolved, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(`/v2/pets/found/${encodeURIComponent(caseId)}/close`, sessionToken, {
    method: 'PUT',
    body: {resolved: resolved === true},
  }, fetchImpl);
  const record = normalizeCase(payload?.found, 'found_case_id');
  if (!record) throw new SiteCoreError('발견 신고를 종료하지 못했습니다.', {code: 'PET_FOUND_CLOSE_FAILED'});
  return record;
}

export const FOUND_PHOTO_SLOT_MAX = 10;
// A single found-animal photo should be useful by itself. Start with a broad
// face/body view and only then consume close-up slots; the reporter never has
// to understand or select these internal semantic labels.
export const FOUND_PHOTO_SEMANTIC_SLOT_CODES = Object.freeze(
  [3, 4, 5, 6, 7, 8, 0, 1, 2, 9].map(index => PET_PHOTO_SLOT_CODES[index]),
);

export async function listFoundPetPhotos(sessionToken, caseId, fetchImpl = globalThis.fetch) {
  const payload = await petRequest(
    `/v2/pets/found/${encodeURIComponent(caseId)}/photos`,
    sessionToken,
    {},
    fetchImpl,
  );
  const rows = Array.isArray(payload?.photos) ? payload.photos : [];
  return Object.freeze(
    rows
      .map(row => (Number.isInteger(row?.slot_index) ? row.slot_index : 0))
      .filter(index => index >= 1 && index <= FOUND_PHOTO_SLOT_MAX)
      .sort((a, b) => a - b),
  );
}

export async function uploadFoundPetPhoto(sessionToken, caseId, slotIndex, file, semanticSlotCode = '', fetchImpl = globalThis.fetch) {
  const rejection = petPhotoRejection(file);
  if (rejection) {
    throw new SiteCoreError(rejection, {code: 'PET_PHOTO_REJECTED_LOCALLY', status: 0});
  }
  const formData = new FormData();
  formData.append('file', file, file.name || 'found-photo');
  const payload = await petRequest(
    `/v2/pets/found/${encodeURIComponent(caseId)}/photos/${encodeURIComponent(slotIndex)}`,
    sessionToken,
    {
      method: 'PUT',
      formData,
      extraHeaders: PET_PHOTO_SLOT_CODES.includes(semanticSlotCode)
        ? {'X-Pet-Photo-Slot-Code': semanticSlotCode}
        : undefined,
    },
    fetchImpl,
  );
  return Number.isInteger(payload?.photo_count) ? payload.photo_count : 0;
}

export async function deleteFoundPetPhoto(sessionToken, caseId, slotIndex, fetchImpl = globalThis.fetch) {
  await petRequest(
    `/v2/pets/found/${encodeURIComponent(caseId)}/photos/${encodeURIComponent(slotIndex)}`,
    sessionToken,
    {method: 'DELETE'},
    fetchImpl,
  );
}

export async function fetchFoundPetPhotoObjectUrl(sessionToken, caseId, slotIndex, fetchImpl = globalThis.fetch) {
  const response = await petRequest(
    `/v2/pets/found/${encodeURIComponent(caseId)}/photos/${encodeURIComponent(slotIndex)}/content`,
    sessionToken,
    {raw: true},
    fetchImpl,
  );
  return URL.createObjectURL(await response.blob());
}
