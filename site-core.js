export const CORE_ORIGIN = 'https://api.lotbiai.com';
export const SITE_AUDIENCE = 'lotbiai.com';
export const SITE_CALLBACK_URI = 'https://lotbiai.com/auth/callback';

const CONVERSATION_PATH = '/v2/conversation/messages';
const PRODUCT_CARD_SEARCH_PATH = '/v2/product-resolutions/search';
const PUBLIC_PRODUCT_CARD_SEARCH_PATH = '/v2/public/product-cards/search';
const GUEST_SESSION_PATH = '/v2/conversation/guest/sessions';
const GUEST_CONVERSATION_PATH = '/v2/conversation/guest/messages';
const CONVERSATION_ATTACHMENT_PATH = '/v2/conversation/attachments';
const GUEST_CONVERSATION_ATTACHMENT_PATH = '/v2/conversation/guest/attachments';
const ATTACHMENT_ID_RE = /^att_[0-9a-f]{20}$/;
const GUEST_IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,160}$/;
const CALENDAR_CANDIDATE_ID_RE = /^calcand_[0-9a-f]{24}$/;
const CALENDAR_ACTION_ID_RE = /^calact_[0-9a-f]{24}$/;
const CALENDAR_WRITE_REQUEST_RE = /^calendar-action:[0-9a-f]{24}$/;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const TIMEZONE_RE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const HANDOFF_REDEEM_PATH = '/v2/sessions/handoffs/redeem';
const CURRENT_USER_PATH = '/v2/me';
const SUBSCRIPTION_PATH = '/v2/subscription';
const LOGOUT_PATH = '/v2/sessions/logout';

export class SiteCoreError extends Error {
  constructor(message, {code = 'SITE_CORE_ERROR', status = 0, retryable = false, correlationId = ''} = {}) {
    super(message);
    this.name = 'SiteCoreError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }
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
      correlationId: typeof detail.correlation_id === 'string' ? detail.correlation_id : '',
    },
  );
}

function announceInvalidSiteSession(error) {
  if (!(error instanceof SiteCoreError) || (error.status !== 401 && error.status !== 403)) return;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent('lotbi:site-session-state', {
    detail: {authenticated: false},
  }));
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
}

export async function redeemSiteHandoff({handoffCode, state, codeVerifier}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  if (typeof handoffCode !== 'string' || handoffCode.length < 32 || handoffCode.length > 256) {
    throw new SiteCoreError('로그인 연결 코드가 올바르지 않습니다.', {code: 'SITE_HANDOFF_CODE_INVALID'});
  }
  if (typeof state !== 'string' || state.length < 16 || state.length > 256) {
    throw new SiteCoreError('로그인 연결 상태값이 올바르지 않습니다.', {code: 'SITE_HANDOFF_STATE_INVALID'});
  }
  if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new SiteCoreError('로그인 연결 검증값이 없습니다.', {code: 'SITE_HANDOFF_VERIFIER_INVALID'});
  }

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${HANDOFF_REDEEM_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        handoff_code: handoffCode,
        audience: SITE_AUDIENCE,
        callback_uri: SITE_CALLBACK_URI,
        state,
        code_verifier: codeVerifier,
      }),
    });
  } catch {
    throw new SiteCoreError('LOTBI 로그인 연결 서버에 접속하지 못했습니다.', {
      code: 'SITE_HANDOFF_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 로그인 연결을 완료하지 못했습니다.');
  }

  const sessionToken = typeof payload.session_token === 'string' ? payload.session_token.trim() : '';
  if (!sessionToken || payload.session_type !== 'Bearer' || payload.assurance_level !== 'FULL' || payload.audience !== SITE_AUDIENCE) {
    throw new SiteCoreError('LOTBI Site 세션 응답이 올바르지 않습니다.', {code: 'SITE_SESSION_CONTRACT_INVALID'});
  }

  return Object.freeze({
    sessionToken,
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : '',
    installationId: typeof payload.installation_id === 'string' ? payload.installation_id : '',
    expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : '',
  });
}

function normalizeCalendarCandidate(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new SiteCoreError('LOTBI 일정 후보 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  const temporal = value.temporal && typeof value.temporal === 'object' ? value.temporal : null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const sourceTurnRef = typeof value.source_turn_ref === 'string' ? value.source_turn_ref.trim() : '';
  const sourceTurnCreatedAt = typeof value.source_turn_created_at === 'string' ? value.source_turn_created_at.trim() : '';
  const localDatetime = typeof temporal?.local_datetime === 'string' ? temporal.local_datetime.trim() : '';
  const timezoneName = typeof temporal?.timezone_name === 'string' ? temporal.timezone_name.trim() : '';
  const missingFields = Array.isArray(value.missing_fields) ? value.missing_fields : null;
  if (
    value.contract_id !== 'CORE-CALENDAR-CANDIDATE-01'
    || value.schema_version !== 1
    || value.candidate_version !== 1
    || !CALENDAR_CANDIDATE_ID_RE.test(String(value.candidate_id || ''))
    || !CALENDAR_ACTION_ID_RE.test(String(value.action_id || ''))
    || !GUEST_IDEMPOTENCY_RE.test(sourceTurnRef)
    || !sourceTurnCreatedAt || !Number.isFinite(Date.parse(sourceTurnCreatedAt))
    || !title || title.length > 240
    || temporal?.kind !== 'LOCAL_DATE_TIME'
    || !LOCAL_DATETIME_RE.test(localDatetime)
    || !TIMEZONE_RE.test(timezoneName) || timezoneName.length > 80
    || value.temporal_semantics !== 'USER_PLANNED_TIME'
    || value.meaning !== 'PERSONAL_CALENDAR_ACTIVITY'
    || !missingFields || missingFields.length !== 0
    || value.approval_state !== 'NOT_APPROVED'
    || value.execution_state !== 'NOT_EXECUTED'
    || !CALENDAR_WRITE_REQUEST_RE.test(String(value.write_logical_request_id || ''))
    || 'activity_id' in value || 'occurrence_id' in value
  ) {
    throw new SiteCoreError('LOTBI 일정 후보 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    contractId: value.contract_id,
    schemaVersion: value.schema_version,
    candidateId: value.candidate_id,
    actionId: value.action_id,
    candidateVersion: value.candidate_version,
    sourceTurnRef,
    sourceTurnCreatedAt,
    title,
    temporal: Object.freeze({kind: temporal.kind, localDatetime, timezoneName}),
    temporalSemantics: value.temporal_semantics,
    meaning: value.meaning,
    missingFields: Object.freeze([]),
    approvalState: value.approval_state,
    executionState: value.execution_state,
    writeLogicalRequestId: value.write_logical_request_id,
  });
}

export function normalizeCalendarPartialCandidate(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') {
    throw new SiteCoreError('LOTBI 불완전 일정 후보 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  const temporal = value.temporal && typeof value.temporal === 'object' ? value.temporal : null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const sourceTurnRef = typeof value.source_turn_ref === 'string' ? value.source_turn_ref.trim() : '';
  const sourceTurnCreatedAt = typeof value.source_turn_created_at === 'string' ? value.source_turn_created_at.trim() : '';
  const localDate = typeof temporal?.local_date === 'string' ? temporal.local_date.trim() : '';
  const localTime = typeof temporal?.local_time === 'string' ? temporal.local_time.trim() : '';
  const timezoneName = typeof temporal?.timezone_name === 'string' ? temporal.timezone_name.trim() : '';
  const missingFields = Array.isArray(value.missing_fields) ? value.missing_fields.map(item => String(item || '').trim()) : null;
  const memberIndex = value.member_index == null ? null : Number(value.member_index);
  const missingDate = missingFields?.length === 1 && missingFields[0] === 'date';
  const missingTime = missingFields?.length === 1 && missingFields[0] === 'time';
  if (
    value.contract_id !== 'CORE-CALENDAR-PARTIAL-CANDIDATE-01'
    || value.schema_version !== 1
    || value.candidate_version !== 1
    || !CALENDAR_CANDIDATE_ID_RE.test(String(value.candidate_id || ''))
    || !GUEST_IDEMPOTENCY_RE.test(sourceTurnRef)
    || !sourceTurnCreatedAt || !Number.isFinite(Date.parse(sourceTurnCreatedAt))
    || !title || title.length > 240
    || temporal?.kind !== 'PARTIAL_LOCAL_DATE_TIME'
    || !TIMEZONE_RE.test(timezoneName) || timezoneName.length > 80
    || (!missingDate && !missingTime)
    || (missingDate && (localDate || !LOCAL_TIME_RE.test(localTime)))
    || (missingTime && (!LOCAL_DATE_RE.test(localDate) || localTime))
    || value.temporal_semantics !== 'USER_PLANNED_TIME'
    || value.meaning !== 'PERSONAL_CALENDAR_ACTIVITY'
    || value.approval_state !== 'NOT_APPROVED'
    || value.execution_state !== 'NOT_EXECUTED'
    || (memberIndex !== null && (!Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex > 3))
    || 'action_id' in value
    || 'write_logical_request_id' in value
    || 'activity_id' in value
    || 'occurrence_id' in value
  ) {
    throw new SiteCoreError('LOTBI 불완전 일정 후보 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    contractId: value.contract_id,
    schemaVersion: 1,
    candidateId: value.candidate_id,
    candidateVersion: 1,
    sourceTurnRef,
    sourceTurnCreatedAt,
    memberIndex,
    title,
    temporal: Object.freeze({
      kind: 'PARTIAL_LOCAL_DATE_TIME',
      localDate: localDate || null,
      localTime: localTime || null,
      timezoneName,
    }),
    temporalSemantics: 'USER_PLANNED_TIME',
    meaning: 'PERSONAL_CALENDAR_ACTIVITY',
    missingFields: Object.freeze([...missingFields]),
    approvalState: 'NOT_APPROVED',
    executionState: 'NOT_EXECUTED',
  });
}

export function normalizeCalendarCandidateSet(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') {
    throw new SiteCoreError('LOTBI 일정 후보 묶음 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  const sourceTurnRef = typeof value.source_turn_ref === 'string' ? value.source_turn_ref.trim() : '';
  const sourceTurnCreatedAt = typeof value.source_turn_created_at === 'string' ? value.source_turn_created_at.trim() : '';
  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : null;
  if (
    value.contract_id !== 'CORE-CALENDAR-CANDIDATE-SET-01'
    || value.schema_version !== 1
    || !GUEST_IDEMPOTENCY_RE.test(sourceTurnRef)
    || !sourceTurnCreatedAt || !Number.isFinite(Date.parse(sourceTurnCreatedAt))
    || !rawCandidates || rawCandidates.length < 1 || rawCandidates.length > 4
  ) {
    throw new SiteCoreError('LOTBI 일정 후보 묶음 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }

  const candidates = rawCandidates.map((raw, index) => {
    let candidate;
    let kind;
    if (raw?.contract_id === 'CORE-CALENDAR-CANDIDATE-01') {
      candidate = normalizeCalendarCandidate(raw);
      kind = 'COMPLETE';
    } else if (raw?.contract_id === 'CORE-CALENDAR-PARTIAL-CANDIDATE-01') {
      candidate = normalizeCalendarPartialCandidate(raw);
      kind = 'PARTIAL';
    } else {
      throw new SiteCoreError('LOTBI 일정 후보 종류가 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
    }
    if (
      candidate.sourceTurnRef !== sourceTurnRef
      || candidate.sourceTurnCreatedAt !== sourceTurnCreatedAt
      || (rawCandidates.length > 1 && raw.member_index !== index)
    ) {
      throw new SiteCoreError('LOTBI 일정 후보 출처가 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
    }
    return Object.freeze({kind, candidate});
  });
  if (new Set(candidates.map(item => item.candidate.candidateId)).size !== candidates.length) {
    throw new SiteCoreError('LOTBI 일정 후보 식별자가 중복되었습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    contractId: 'CORE-CALENDAR-CANDIDATE-SET-01',
    schemaVersion: 1,
    sourceTurnRef,
    sourceTurnCreatedAt,
    candidates: Object.freeze(candidates),
  });
}

function validCalendarDraftDate(value) {
  if (!LOCAL_DATE_RE.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

function normalizeCalendarDraftText(value, maxLength) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new SiteCoreError('LOTBI 캘린더 초안 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) throw new SiteCoreError('LOTBI 캘린더 초안 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  return text;
}

export function normalizeSmartCalendarDraft(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') {
    throw new SiteCoreError('LOTBI 캘린더 초안 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  const title = normalizeCalendarDraftText(value.title, 240);
  const localDate = normalizeCalendarDraftText(value.local_date, 10);
  const localTime = normalizeCalendarDraftText(value.local_time, 5);
  const entry = value.entry && typeof value.entry === 'object' ? value.entry : null;
  const sourceIds = Array.isArray(value.source_attachment_ids) ? value.source_attachment_ids.map(item => String(item || '').trim()) : null;
  const amountMinor = entry?.amount_minor == null ? null : Number(entry.amount_minor);
  const currency = normalizeCalendarDraftText(entry?.currency, 3);
  const expenseCategory = normalizeCalendarDraftText(entry?.expense_category, 20);
  const memo = normalizeCalendarDraftText(entry?.memo, 2000);
  const place = normalizeCalendarDraftText(entry?.place, 240);
  const merchant = normalizeCalendarDraftText(entry?.merchant, 240);
  // OTHER is here because Core can now return it on a draft. A draft carrying a
  // category this list does not know is rejected outright, so leaving OTHER out
  // would turn a 기타 spend read off a receipt into a contract error rather than
  // a draft the owner could look at.
  const allowedCategories = new Set(['FOOD', 'TRAVEL', 'SHOPPING', 'LIVING', 'OTHER', 'UNCLASSIFIED']);
  if (
    value.contract_id !== 'CORE-SMART-CALENDAR-DRAFT-01'
    || value.schema_version !== 1
    || value.source_kind !== 'ATTACHMENT_AI_DRAFT'
    || value.requires_user_confirmation !== true
    || value.automatic_write !== false
    || (localDate !== null && !validCalendarDraftDate(localDate))
    || (localTime !== null && (localDate === null || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime)))
    || !entry
    || (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > 1_000_000_000_000))
    || (currency !== null && currency !== 'KRW')
    || ((amountMinor === null) !== (currency === null))
    || (expenseCategory !== null && !allowedCategories.has(expenseCategory))
    || (amountMinor !== null && expenseCategory === null)
    || !sourceIds || sourceIds.length < 1 || sourceIds.length > 3
    || sourceIds.length !== new Set(sourceIds).size
    || sourceIds.some(id => !ATTACHMENT_ID_RE.test(id))
  ) {
    throw new SiteCoreError('LOTBI 캘린더 초안 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    contractId: 'CORE-SMART-CALENDAR-DRAFT-01',
    schemaVersion: 1,
    sourceKind: 'ATTACHMENT_AI_DRAFT',
    requiresUserConfirmation: true,
    automaticWrite: false,
    title,
    localDate,
    localTime,
    entry: Object.freeze({
      amountMinor,
      currency,
      expenseCategory,
      memo,
      place,
      merchant,
    }),
    sourceAttachmentIds: Object.freeze([...sourceIds]),
  });
}

function normalizeConversationReadPlan(intent) {
  if (!intent || typeof intent !== 'object' || intent.read_plan == null) return null;
  const plan = intent.read_plan;
  if (
    intent.response_plan !== 'READ_PLAN'
    || !plan || typeof plan !== 'object'
    || plan.freshness !== 'CURRENT'
    || plan.required_capability !== 'FRESH_SOURCE_READ'
    || plan.coverage_required !== 'FULL_OR_EXPLICIT_PARTIAL'
    || plan.allow_model_only !== false
  ) {
    throw new SiteCoreError('LOTBI 최신정보 조회 계획 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    freshness: plan.freshness,
    requiredCapability: plan.required_capability,
    coverageRequired: plan.coverage_required,
    allowModelOnly: false,
  });
}

function normalizeConversationCompletion(value, status, responseMode) {
  const allowed = new Set(['FULL', 'PARTIAL', 'CLARIFICATION', 'FAILED']);
  if (typeof value === 'string' && allowed.has(value)) return value;
  if (
    responseMode === 'PUBLIC_READ_GROUNDED'
    || responseMode === 'PUBLIC_READ_GROUNDED_PARTIAL'
    || responseMode === 'READ_CAPABILITY_UNAVAILABLE'
  ) {
    throw new SiteCoreError('LOTBI 완료 상태 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return status === 'FOLLOW_UP_REQUIRED' ? 'CLARIFICATION' : 'FULL';
}


function normalizeConversationSources(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 12) {
    throw new SiteCoreError('LOTBI 출처 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  const seen = new Set();
  const sources = value.map(item => {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const url = typeof item?.url === 'string' ? item.url.trim() : '';
    let parsed;
    try { parsed = new URL(url); } catch { parsed = null; }
    if (
      !title || title.length > 240
      || !url || url.length > 2048
      || !parsed || parsed.protocol !== 'https:' || !parsed.hostname
      || seen.has(url)
    ) {
      throw new SiteCoreError('LOTBI 출처 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
    }
    seen.add(url);
    return Object.freeze({title, url});
  });
  return Object.freeze(sources);
}


function normalizeEvidenceCoverage(placeResult) {
  if (!placeResult || typeof placeResult !== 'object' || placeResult.evidence_coverage == null) return null;
  const value = placeResult.evidence_coverage;
  const allowedStatus = new Set(['NOT_REQUIRED', 'FULL', 'PARTIAL', 'NONE', 'CONFLICTING']);
  const allowedVerification = new Set(['NOT_REQUIRED', 'VERIFIED', 'SUPPORTED', 'MIXED', 'UNCONFIRMED', 'CONFLICTING']);
  const allowedFreshness = new Set(['NOT_REQUIRED', 'FRESH', 'PARTIAL', 'UNKNOWN']);
  const allowedLookup = new Set(['NOT_REQUIRED', 'OK', 'DEGRADED', 'UNAVAILABLE', 'NOT_AVAILABLE']);
  const countKeys = [
    'requested_constraint_count',
    'candidate_count',
    'verified_candidate_count',
    'supported_candidate_count',
    'conflicting_candidate_count',
    'unconfirmed_candidate_count',
  ];
  if (
    !value || typeof value !== 'object'
    || !allowedStatus.has(value.status)
    || !allowedVerification.has(value.verification_level)
    || !allowedFreshness.has(value.freshness)
    || !allowedLookup.has(value.lookup_status)
    || countKeys.some(key => !Number.isInteger(value[key]) || value[key] < 0)
  ) {
    throw new SiteCoreError('LOTBI 장소 근거 범위 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  const classifiedCandidates = (
    value.verified_candidate_count
    + value.supported_candidate_count
    + value.conflicting_candidate_count
    + value.unconfirmed_candidate_count
  );
  if (value.status !== 'NOT_REQUIRED' && classifiedCandidates !== value.candidate_count) {
    throw new SiteCoreError('LOTBI 장소 근거 범위 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    status: value.status,
    verificationLevel: value.verification_level,
    freshness: value.freshness,
    lookupStatus: value.lookup_status,
    requestedConstraintCount: value.requested_constraint_count,
    candidateCount: value.candidate_count,
    verifiedCandidateCount: value.verified_candidate_count,
    supportedCandidateCount: value.supported_candidate_count,
    conflictingCandidateCount: value.conflicting_candidate_count,
    unconfirmedCandidateCount: value.unconfirmed_candidate_count,
  });
}

function conversationClientContext(timezone, turnCreatedAt, identity = {}) {
  const timezoneName = typeof timezone === 'string' ? timezone.trim() : '';
  const createdAt = typeof turnCreatedAt === 'string' ? turnCreatedAt.trim() : '';
  const conversationId = typeof identity?.conversationId === 'string' ? identity.conversationId.trim() : '';
  const turnId = typeof identity?.turnId === 'string' ? identity.turnId.trim() : '';
  const logicalRequestId = typeof identity?.logicalRequestId === 'string' ? identity.logicalRequestId.trim() : '';
  const stateVersion = Number.isInteger(identity?.stateVersion) && identity.stateVersion >= 0
    ? identity.stateVersion
    : null;
  const safeIdentity = value => !value || /^[A-Za-z0-9._:-]{1,160}$/.test(value);
  if (!timezoneName && !createdAt && !conversationId && !turnId && !logicalRequestId && stateVersion === null) return null;
  if (!TIMEZONE_RE.test(timezoneName) || timezoneName.length > 64) {
    throw new SiteCoreError('대화 시간대가 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CLIENT_CONTEXT_INVALID', status: 422});
  }
  if (createdAt && !Number.isFinite(Date.parse(createdAt))) {
    throw new SiteCoreError('대화 시각 기준값이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CLIENT_CONTEXT_INVALID', status: 422});
  }
  if (![conversationId, turnId, logicalRequestId].every(safeIdentity)) {
    throw new SiteCoreError('대화 요청 식별값이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CLIENT_CONTEXT_INVALID', status: 422});
  }
  if (identity?.stateVersion != null && stateVersion === null) {
    throw new SiteCoreError('대화 상태 버전이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CLIENT_CONTEXT_INVALID', status: 422});
  }
  return Object.freeze({
    timezone: timezoneName,
    ...(createdAt ? {turn_created_at: createdAt} : {}),
    ...(conversationId ? {conversation_id: conversationId} : {}),
    ...(turnId ? {turn_id: turnId} : {}),
    ...(logicalRequestId ? {logical_request_id: logicalRequestId} : {}),
    ...(stateVersion !== null ? {state_version: stateVersion} : {}),
  });
}

function normalizeAttachmentIds(attachmentIds) {
  if (!Array.isArray(attachmentIds)) return [];
  const normalized = attachmentIds.map(value => typeof value === 'string' ? value.trim() : '');
  if (normalized.length > 3 || normalized.length !== new Set(normalized).size || normalized.some(value => !ATTACHMENT_ID_RE.test(value))) {
    throw new SiteCoreError('첨부 파일 참조가 올바르지 않습니다.', {code: 'CONVERSATION_ATTACHMENT_REFERENCE_INVALID', status: 422});
  }
  return normalized;
}

function attachmentFromPayload(payload) {
  const attachment = payload && typeof payload.attachment === 'object' ? payload.attachment : undefined;
  const id = typeof attachment?.attachment_id === 'string' ? attachment.attachment_id.trim() : '';
  const expiresAt = typeof attachment?.expires_at === 'string' ? attachment.expires_at.trim() : '';
  if (
    payload?.contract_id !== 'CORE-CONVERSATION-ATTACHMENT-01'
    || !ATTACHMENT_ID_RE.test(id)
    || typeof attachment?.file_name !== 'string'
    || typeof attachment?.mime_type !== 'string'
    || !['IMAGE', 'DOCUMENT', 'TEXT'].includes(attachment?.media_kind)
    || !Number.isInteger(attachment?.size_bytes)
    || attachment.size_bytes <= 0
    || !expiresAt
    || !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new SiteCoreError('첨부 파일 응답 형식이 올바르지 않습니다.', {code: 'CONVERSATION_ATTACHMENT_CONTRACT_INVALID'});
  }
  return Object.freeze({
    id,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    mediaKind: attachment.media_kind,
    sizeBytes: attachment.size_bytes,
    expiresAt,
  });
}

export async function uploadConversationAttachment({sessionToken = '', guestToken = '', file}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  if (!(file instanceof Blob) || typeof file.name !== 'string') {
    throw new SiteCoreError('첨부할 파일을 선택해 주세요.', {code: 'CONVERSATION_ATTACHMENT_FILE_REQUIRED', status: 422});
  }
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const guest = typeof guestToken === 'string' ? guestToken.trim() : '';
  const authenticated = Boolean(token);
  if (!authenticated && (guest.length < 32 || guest.length > 256)) {
    throw new SiteCoreError('첨부 파일을 위한 LOTBI 세션이 필요합니다.', {code: 'CONVERSATION_ATTACHMENT_SESSION_REQUIRED', status: 401});
  }
  const form = new FormData();
  form.append('file', file, file.name);
  let response;
  try {
    response = await fetchImpl(
      `${CORE_ORIGIN}${authenticated ? CONVERSATION_ATTACHMENT_PATH : GUEST_CONVERSATION_ATTACHMENT_PATH}`,
      {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: authenticated ? {Authorization: `Bearer ${token}`} : {'X-LOTBI-Guest-Token': guest},
        body: form,
      },
    );
  } catch {
    throw new SiteCoreError('첨부 파일 서버에 접속하지 못했습니다.', {code: 'CONVERSATION_ATTACHMENT_NETWORK_ERROR', retryable: true});
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, '첨부 파일을 업로드하지 못했습니다.');
    if (authenticated) announceInvalidSiteSession(error);
    throw error;
  }
  return attachmentFromPayload(payload);
}

export async function deleteConversationAttachment({sessionToken = '', guestToken = '', attachmentId}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const id = typeof attachmentId === 'string' ? attachmentId.trim() : '';
  if (!ATTACHMENT_ID_RE.test(id)) {
    throw new SiteCoreError('첨부 파일 참조가 올바르지 않습니다.', {code: 'CONVERSATION_ATTACHMENT_REFERENCE_INVALID', status: 422});
  }
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const guest = typeof guestToken === 'string' ? guestToken.trim() : '';
  const authenticated = Boolean(token);
  if (!authenticated && (guest.length < 32 || guest.length > 256)) {
    throw new SiteCoreError('첨부 파일을 위한 LOTBI 세션이 필요합니다.', {code: 'CONVERSATION_ATTACHMENT_SESSION_REQUIRED', status: 401});
  }
  const path = authenticated
    ? `${CONVERSATION_ATTACHMENT_PATH}/${id}`
    : `${GUEST_CONVERSATION_ATTACHMENT_PATH}/${id}`;
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method: 'DELETE',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: authenticated ? {Authorization: `Bearer ${token}`} : {'X-LOTBI-Guest-Token': guest},
    });
  } catch {
    throw new SiteCoreError('첨부 파일 삭제 서버에 접속하지 못했습니다.', {code: 'CONVERSATION_ATTACHMENT_DELETE_NETWORK_ERROR', retryable: true});
  }
  if (response.status === 204) return;
  const payload = await readPayload(response);
  const error = errorFromResponse(response, payload, '첨부 파일을 삭제하지 못했습니다.');
  if (authenticated) announceInvalidSiteSession(error);
  throw error;
}

export async function sendConversationMessage(sessionToken, text, fetchImpl = globalThis.fetch, attachmentIds = [], idempotencyKey = '', timezone = '', turnCreatedAt = '', recentContext = [], turnIdentity = {}) {
  assertFetch(fetchImpl);
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  const attachments = normalizeAttachmentIds(attachmentIds);
  const logicalKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if ((!message && !attachments.length) || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }
  if (attachments.length && !GUEST_IDEMPOTENCY_RE.test(logicalKey)) {
    throw new SiteCoreError('첨부 대화 요청 식별값이 올바르지 않습니다.', {code: 'INVALID_ATTACHMENT_IDEMPOTENCY_KEY', status: 422});
  }
  const body = {text: message || '첨부 파일을 확인해 주세요.'};
  const clientContext = conversationClientContext(timezone, turnCreatedAt, turnIdentity);
  const boundedRecentContext = normalizeConversationRecentContext(recentContext);
  if (clientContext) body.client_context = clientContext;
  if (boundedRecentContext.length) body.recent_context = boundedRecentContext;
  if (attachments.length) body.attachment_ids = attachments;

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${CONVERSATION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(logicalKey ? {'Idempotency-Key': logicalKey} : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SiteCoreError('LOTBI 대화 서버에 접속하지 못했습니다.', {
      code: 'WEB_CONVERSATION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, 'LOTBI 응답을 받지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }

  const status = payload.status;
  const assistantText = typeof payload.assistant_text === 'string' ? payload.assistant_text.trim() : '';
  if (
    payload.contract_id !== 'CORE-WEB-CHAT-01'
    || payload.schema_version !== 1
    || (status !== 'ANSWERED' && status !== 'FOLLOW_UP_REQUIRED')
    || !assistantText
    || typeof payload.response_mode !== 'string'
    || typeof payload.correlation_id !== 'string'
    || !payload.follow_up
    || typeof payload.follow_up !== 'object'
  ) {
    throw new SiteCoreError('LOTBI 대화 응답 형식이 올바르지 않습니다.', {code: 'WEB_CONVERSATION_CONTRACT_INVALID'});
  }

  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    completion: normalizeConversationCompletion(payload.completion, status, payload.response_mode),
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
    stateVersion: Number.isInteger(payload.state_version) && payload.state_version >= 0 ? payload.state_version : null,
    intent: payload.intent && typeof payload.intent === 'object' ? Object.freeze({...payload.intent}) : Object.freeze({action: 'UNKNOWN'}),
    readPlan: normalizeConversationReadPlan(payload.intent),
    sources: normalizeConversationSources(payload.sources),
    placeResult: payload.place_result && typeof payload.place_result === 'object' ? Object.freeze({...payload.place_result}) : null,
    evidenceCoverage: normalizeEvidenceCoverage(payload.place_result),
    selectedPlace: payload.selected_place && typeof payload.selected_place === 'object' ? Object.freeze({...payload.selected_place}) : null,
    calendarCandidate: normalizeCalendarCandidate(payload.calendar_candidate),
    calendarCandidateSet: normalizeCalendarCandidateSet(payload.calendar_candidate_set),
    calendarDraft: normalizeSmartCalendarDraft(payload.calendar_draft),
  });
}

export async function createGuestConversationSession(fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${GUEST_SESSION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new SiteCoreError('LOTBI 익명 대화 세션에 접속하지 못했습니다.', {
      code: 'GUEST_SESSION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 익명 대화 세션을 시작하지 못했습니다.');
  }

  const guestToken = typeof payload.guest_token === 'string' ? payload.guest_token.trim() : '';
  const expiresAt = typeof payload.expires_at === 'string' ? payload.expires_at.trim() : '';
  if (
    payload.contract_id !== 'CORE-GUEST-SESSION-01'
    || payload.schema_version !== 1
    || guestToken.length < 32
    || guestToken.length > 256
    || !expiresAt
    || !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new SiteCoreError('LOTBI 익명 대화 세션 응답이 올바르지 않습니다.', {
      code: 'GUEST_SESSION_CONTRACT_INVALID',
    });
  }

  return Object.freeze({guestToken, expiresAt});
}

const CONVERSATION_RECENT_CONTEXT_MAX_ITEMS = 24;
const CONVERSATION_RECENT_CONTEXT_MAX_ITEM_CHARS = 4000;
const CONVERSATION_RECENT_CONTEXT_MAX_CHARS = 16000;

function normalizeConversationRecentContext(recentContext) {
  if (!Array.isArray(recentContext)) return [];
  const normalized = recentContext.flatMap(item => {
    const role = typeof item?.role === 'string' ? item.role.trim().toLowerCase() : '';
    const text = typeof item?.text === 'string' ? item.text.trim() : '';
    if (
      !['user', 'assistant'].includes(role)
      || !text
      || text.length > CONVERSATION_RECENT_CONTEXT_MAX_ITEM_CHARS
    ) return [];
    return [{role, text}];
  });
  const selected = [];
  let usedChars = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const item = normalized[index];
    if (selected.length >= CONVERSATION_RECENT_CONTEXT_MAX_ITEMS) break;
    if (usedChars + item.text.length > CONVERSATION_RECENT_CONTEXT_MAX_CHARS) break;
    selected.push(item);
    usedChars += item.text.length;
  }
  return selected.reverse();
}

export async function sendGuestConversationMessage({
  guestToken,
  text,
  idempotencyKey,
  recentContext = [],
  timezone = '',
  turnCreatedAt = '',
  attachmentIds = [],
  conversationId = '',
  turnId = '',
  logicalRequestId = '',
  stateVersion = null,
}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const token = typeof guestToken === 'string' ? guestToken.trim() : '';
  const message = typeof text === 'string' ? text.trim() : '';
  const logicalKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  const timezoneName = typeof timezone === 'string' ? timezone.trim() : '';
  if (token.length < 32 || token.length > 256) {
    throw new SiteCoreError('LOTBI 익명 대화 세션이 필요합니다.', {code: 'GUEST_SESSION_INVALID', status: 401});
  }
  const attachments = normalizeAttachmentIds(attachmentIds);
  if ((!message && !attachments.length) || message.length > 1000) {
    throw new SiteCoreError('메시지는 1자 이상 1000자 이하로 입력해 주세요.', {code: 'WEB_CONVERSATION_INVALID_INPUT', status: 422});
  }
  if (!GUEST_IDEMPOTENCY_RE.test(logicalKey)) {
    throw new SiteCoreError('익명 대화 요청 식별값이 올바르지 않습니다.', {code: 'INVALID_GUEST_IDEMPOTENCY_KEY', status: 422});
  }

  const clientContext = conversationClientContext(timezoneName, turnCreatedAt, {
    conversationId,
    turnId,
    logicalRequestId,
    stateVersion,
  });
  const body = {
    text: message || '첨부 파일을 확인해 주세요.',
    recent_context: normalizeConversationRecentContext(recentContext),
  };
  if (attachments.length) body.attachment_ids = attachments;
  if (clientContext) body.client_context = clientContext;

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${GUEST_CONVERSATION_PATH}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': logicalKey,
        'X-LOTBI-Guest-Token': token,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SiteCoreError('LOTBI 익명 대화 서버에 접속하지 못했습니다.', {
      code: 'GUEST_CONVERSATION_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, 'LOTBI 익명 대화 응답을 받지 못했습니다.');
  }

  const status = payload.status;
  const assistantText = typeof payload.assistant_text === 'string' ? payload.assistant_text.trim() : '';
  if (
    payload.contract_id !== 'CORE-WEB-CHAT-01'
    || payload.schema_version !== 1
    || (status !== 'ANSWERED' && status !== 'FOLLOW_UP_REQUIRED')
    || !assistantText
    || typeof payload.response_mode !== 'string'
    || typeof payload.correlation_id !== 'string'
    || !payload.follow_up
    || typeof payload.follow_up !== 'object'
    || !payload.safety
    || payload.safety.execution_authority !== false
    || payload.safety.external_side_effect !== false
  ) {
    throw new SiteCoreError('LOTBI 익명 대화 응답 형식이 올바르지 않습니다.', {code: 'GUEST_CONVERSATION_CONTRACT_INVALID'});
  }

  return Object.freeze({
    status,
    assistantText,
    responseMode: payload.response_mode,
    completion: normalizeConversationCompletion(payload.completion, status, payload.response_mode),
    followUp: payload.follow_up,
    correlationId: payload.correlation_id,
    retrySafe: payload.retry_safe === true,
    stateVersion: Number.isInteger(payload.state_version) && payload.state_version >= 0 ? payload.state_version : null,
    intent: payload.intent && typeof payload.intent === 'object' ? Object.freeze({...payload.intent}) : Object.freeze({action: 'UNKNOWN'}),
    readPlan: normalizeConversationReadPlan(payload.intent),
    sources: normalizeConversationSources(payload.sources),
    placeResult: payload.place_result && typeof payload.place_result === 'object' ? Object.freeze({...payload.place_result}) : null,
    evidenceCoverage: normalizeEvidenceCoverage(payload.place_result),
    selectedPlace: payload.selected_place && typeof payload.selected_place === 'object' ? Object.freeze({...payload.selected_place}) : null,
    calendarCandidate: normalizeCalendarCandidate(payload.calendar_candidate),
    calendarCandidateSet: normalizeCalendarCandidateSet(payload.calendar_candidate_set),
  });
}

function bearerToken(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  return token;
}

async function siteSessionRequest(path, sessionToken, {method = 'GET', announceSessionFailure = true, body = undefined} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const headers = {Authorization: `Bearer ${bearerToken(sessionToken)}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${path}`, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new SiteCoreError('LOTBI 계정 서버에 접속하지 못했습니다.', {
      code: 'SITE_SESSION_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, 'LOTBI Site 세션 요청을 완료하지 못했습니다.');
    if (announceSessionFailure) announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}

function assertRichProductCard(card) {
  return card
    && Number.isInteger(card.candidate_index)
    && typeof card.title === 'string'
    && card.title.trim().length > 0
    && (card.price === null || card.price === undefined || Number.isInteger(card.price))
    && typeof card.currency === 'string';
}

async function authenticatedJsonRequest(path, sessionToken, {method = 'GET', body = undefined} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const headers = {Authorization: 'Bearer ' + bearerToken(sessionToken)};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(CORE_ORIGIN + path, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new SiteCoreError('LOTBI 상품 검색 서버에 접속하지 못했습니다.', {
      code: 'RICH_PRODUCT_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromResponse(response, payload, '상품 정보를 확인하지 못했습니다.');
    announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}


export async function searchPublicProductCards({
  query,
  merchantCode = '',
  merchantExplicit = false,
  maxResults = 6,
} = {}, fetchImpl = globalThis.fetch) {
  assertFetch(fetchImpl);
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 500) {
    throw new SiteCoreError('상품 검색어를 확인해 주세요.', {code: 'RICH_PRODUCT_QUERY_INVALID'});
  }
  const params = new URLSearchParams({
    query: normalizedQuery,
    max_results: String(Number.isInteger(maxResults) ? Math.min(6, Math.max(1, maxResults)) : 6),
  });
  if (typeof merchantCode === 'string' && merchantCode.trim()) params.set('merchant_code', merchantCode.trim());
  if (merchantExplicit === true) params.set('merchant_explicit', 'true');

  let response;
  try {
    response = await fetchImpl(CORE_ORIGIN + PUBLIC_PRODUCT_CARD_SEARCH_PATH + '?' + params.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {},
    });
  } catch {
    throw new SiteCoreError('LOTBI 상품 검색 서버에 접속하지 못했습니다.', {
      code: 'RICH_PRODUCT_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, '상품 정보를 확인하지 못했습니다.');
  }
  if (
    payload.contract_id !== 'CORE-PUBLIC-RICH-PRODUCT-DISCOVERY-01'
    || payload.schema_version !== 1
    || typeof payload.display_id !== 'string'
    || !Array.isArray(payload.cards)
    || payload.cards.some(card => !assertRichProductCard(card))
    || payload.purchase_requires_login !== true
    || payload.selection_available !== false
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.transaction_created !== false
    || payload.order_created !== false
    || payload.payment_attempted !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('공개 상품 카드 응답 형식이 올바르지 않습니다.', {code: 'PUBLIC_RICH_PRODUCT_CONTRACT_INVALID'});
  }
  return Object.freeze({
    displayId: payload.display_id,
    status: payload.status,
    query: typeof payload.query === 'string' ? payload.query : normalizedQuery,
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    sourceMode: typeof payload.source_mode === 'string' ? payload.source_mode : '',
    cards: Object.freeze(payload.cards.slice(0, 6).map(card => Object.freeze({...card}))),
    purchaseRequiresLogin: true,
  });
}

export async function searchProductCards(sessionToken, {
  query,
  originalText = '',
  merchantCode = '',
  merchantExplicit = false,
  brand = '',
  maxPrice = null,
  preferences = [],
  maxResults = 6,
} = {}, fetchImpl = globalThis.fetch) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 500) {
    throw new SiteCoreError('상품 검색어를 확인해 주세요.', {code: 'RICH_PRODUCT_QUERY_INVALID'});
  }
  const payload = await authenticatedJsonRequest(PRODUCT_CARD_SEARCH_PATH, sessionToken, {
    method: 'POST',
    body: {
      query: normalizedQuery,
      original_text: typeof originalText === 'string' && originalText.trim() ? originalText.trim().slice(0, 1000) : normalizedQuery,
      merchant_code: typeof merchantCode === 'string' && merchantCode.trim() ? merchantCode.trim() : null,
      merchant_explicit: merchantExplicit === true,
      brand: typeof brand === 'string' && brand.trim() ? brand.trim().slice(0, 120) : null,
      max_price: Number.isInteger(maxPrice) && maxPrice >= 0 ? maxPrice : null,
      preferences: Array.isArray(preferences) ? preferences.filter(value => typeof value === 'string').slice(0, 12) : [],
      max_results: Number.isInteger(maxResults) ? Math.min(6, Math.max(1, maxResults)) : 6,
    },
  }, fetchImpl);
  if (
    payload.contract_id !== 'CORE-RICH-PRODUCT-DISCOVERY-01'
    || payload.schema_version !== 1
    || typeof payload.resolution_id !== 'string'
    || !/^[0-9a-f]{64}$/.test(String(payload.resolution_hash || ''))
    || typeof payload.cards_path !== 'string'
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('상품 검색 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_SEARCH_CONTRACT_INVALID'});
  }
  return Object.freeze({
    commandId: payload.command_id,
    resolutionId: payload.resolution_id,
    resolutionHash: payload.resolution_hash,
    status: payload.status,
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    sourceMode: payload.source_mode,
    candidateCount: Number.isInteger(payload.candidate_count) ? payload.candidate_count : 0,
    cardsPath: payload.cards_path,
  });
}

export async function getProductCards(sessionToken, resolutionId, fetchImpl = globalThis.fetch) {
  const id = typeof resolutionId === 'string' ? resolutionId.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) {
    throw new SiteCoreError('상품 후보 식별자가 올바르지 않습니다.', {code: 'RICH_PRODUCT_RESOLUTION_INVALID'});
  }
  const payload = await authenticatedJsonRequest('/v2/product-resolutions/' + encodeURIComponent(id) + '/cards', sessionToken, {}, fetchImpl);
  if (
    payload.contract_id !== 'CORE-SHOP-UI-01A'
    || payload.schema_version !== 1
    || payload.resolution_id !== id
    || !/^[0-9a-f]{64}$/.test(String(payload.resolution_hash || ''))
    || !Array.isArray(payload.cards)
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.cards.some(card => !assertRichProductCard(card))
  ) {
    throw new SiteCoreError('상품 카드 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_CARDS_CONTRACT_INVALID'});
  }
  return Object.freeze({
    resolutionId: payload.resolution_id,
    resolutionHash: payload.resolution_hash,
    status: payload.status,
    query: typeof payload.query === 'string' ? payload.query : '',
    sourceMode: typeof payload.source_mode === 'string' ? payload.source_mode : '',
    expired: payload.expired === true,
    cards: Object.freeze(payload.cards.map(card => Object.freeze({...card}))),
  });
}

export async function reviewProductCard(sessionToken, {
  resolutionId,
  resolutionHash,
  candidateIndex,
} = {}, fetchImpl = globalThis.fetch) {
  const id = typeof resolutionId === 'string' ? resolutionId.trim() : '';
  const hash = typeof resolutionHash === 'string' ? resolutionHash.trim() : '';
  if (!id || !/^[0-9a-f]{64}$/.test(hash) || !Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex > 19) {
    throw new SiteCoreError('구매 검토 대상이 올바르지 않습니다.', {code: 'RICH_PRODUCT_REVIEW_INPUT_INVALID'});
  }
  const payload = await authenticatedJsonRequest('/v2/product-resolutions/' + encodeURIComponent(id) + '/review', sessionToken, {
    method: 'POST',
    body: {candidate_index: candidateIndex, expected_resolution_hash: hash},
  }, fetchImpl);
  if (
    payload.contract_id !== 'CORE-RICH-PRODUCT-REVIEW-01'
    || payload.schema_version !== 1
    || payload.resolution_id !== id
    || payload.resolution_hash !== hash
    || payload.candidate_index !== candidateIndex
    || !assertRichProductCard(payload.card)
    || payload.review_required !== true
    || payload.external_side_effect !== false
    || payload.execution_authority !== false
    || payload.transaction_created !== false
    || payload.order_created !== false
    || payload.payment_attempted !== false
    || payload.live_money !== false
  ) {
    throw new SiteCoreError('구매 검토 응답 형식이 올바르지 않습니다.', {code: 'RICH_PRODUCT_REVIEW_CONTRACT_INVALID'});
  }
  return Object.freeze({
    card: Object.freeze({...payload.card}),
    merchant: payload.merchant && typeof payload.merchant === 'object' ? Object.freeze({...payload.merchant}) : Object.freeze({}),
    priceChanged: payload.price_changed === true,
    nextStep: payload.next_step,
  });
}

const SYNTHETIC_EMAIL_FIRST_HANDLE_RE = /^e1[0-9a-f]{20}$/;

function optionalIdentityText(value, field) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || !value.trim()) {
    throw new SiteCoreError('LOTBI 사용자 정보 응답이 올바르지 않습니다.', {
      code: 'SITE_IDENTITY_CONTRACT_INVALID',
    });
  }
  return value.trim();
}

function userFacingIdentity(user) {
  const name = optionalIdentityText(user?.name, 'user.name');
  const email = optionalIdentityText(user?.email, 'user.email');
  const rawAccountHandle = optionalIdentityText(user?.account_handle, 'user.account_handle');
  const canonicalPublicHandle = optionalIdentityText(user?.public_handle, 'user.public_handle');
  const synthetic = user?.account_handle_is_synthetic === true
    || Boolean(rawAccountHandle && email && SYNTHETIC_EMAIL_FIRST_HANDLE_RE.test(rawAccountHandle));
  const publicHandle = canonicalPublicHandle || (!synthetic ? rawAccountHandle : '');
  return Object.freeze({
    name,
    email,
    publicHandle,
    accountHandle: publicHandle,
  });
}

export async function getCurrentSiteUser(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(CURRENT_USER_PATH, sessionToken, {}, fetchImpl);
  const user = payload && typeof payload.user === 'object' ? payload.user : {};
  const session = payload && typeof payload.session === 'object' ? payload.session : {};
  const installation = payload && typeof payload.installation === 'object' ? payload.installation : {};
  const userId = typeof user.id === 'string' ? user.id.trim() : '';
  const sessionId = typeof session.id === 'string' ? session.id.trim() : '';
  const installationId = typeof installation.id === 'string' ? installation.id.trim() : '';
  if (!userId || !sessionId || !installationId || session.assurance_level !== 'FULL') {
    throw new SiteCoreError('LOTBI 사용자 정보 응답이 올바르지 않습니다.', {code: 'SITE_IDENTITY_CONTRACT_INVALID'});
  }
  return Object.freeze({
    userId,
    ...userFacingIdentity(user),
    sessionId,
    installationId,
    expiresAt: typeof session.expires_at === 'string' ? session.expires_at : '',
  });
}

export async function updateCurrentSiteProfile(sessionToken, {
  displayName = '',
  publicHandle = '',
} = {}, fetchImpl = globalThis.fetch) {
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedPublicHandle = typeof publicHandle === 'string' ? publicHandle.trim().toLowerCase() : '';
  if (!normalizedDisplayName && !normalizedPublicHandle) {
    throw new SiteCoreError('표시 이름 또는 공개 아이디를 입력해 주세요.', {code: 'SITE_PROFILE_UPDATE_REQUIRED'});
  }
  const payload = await siteSessionRequest('/v2/account/profile', sessionToken, {
    method: 'PUT',
    body: {
      ...(normalizedDisplayName ? {display_name: normalizedDisplayName} : {}),
      ...(normalizedPublicHandle ? {public_handle: normalizedPublicHandle} : {}),
    },
  }, fetchImpl);
  const user = payload && typeof payload.user === 'object' ? payload.user : {};
  const userId = typeof user.id === 'string' ? user.id.trim() : '';
  if (!userId) {
    throw new SiteCoreError('LOTBI 프로필 응답이 올바르지 않습니다.', {code: 'SITE_IDENTITY_CONTRACT_INVALID'});
  }
  return Object.freeze({
    userId,
    ...userFacingIdentity(user),
  });
}

export async function getCurrentSubscription(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(SUBSCRIPTION_PATH, sessionToken, {announceSessionFailure: false}, fetchImpl);
  const plan = typeof payload?.plan === 'string' ? payload.plan.trim() : '';
  const status = typeof payload?.status === 'string' ? payload.status.trim() : '';
  const freeUnits = Number.isInteger(payload?.free_units) ? payload.free_units : null;
  const usedFreeUnits = Number.isInteger(payload?.used_free_units) ? payload.used_free_units : null;
  const remainingFreeUnits = Number.isInteger(payload?.remaining_free_units) ? payload.remaining_free_units : null;
  if (
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(plan)
    || !/^[A-Z][A-Z0-9_]{0,63}$/.test(status)
    || typeof payload?.entitled !== 'boolean'
    || freeUnits === null || freeUnits < 0
    || usedFreeUnits === null || usedFreeUnits < 0
    || remainingFreeUnits === null || remainingFreeUnits < 0
  ) {
    throw new SiteCoreError('LOTBI 구독 정보 응답이 올바르지 않습니다.', {code: 'SITE_SUBSCRIPTION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    plan,
    status,
    entitled: payload.entitled,
    freeUnits,
    usedFreeUnits,
    remainingFreeUnits,
  });
}

export async function logoutSiteSession(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await siteSessionRequest(LOGOUT_PATH, sessionToken, {method: 'POST'}, fetchImpl);
  if (!payload || typeof payload.session_id !== 'string' || payload.status !== 'REVOKED') {
    throw new SiteCoreError('LOTBI 로그아웃 응답이 올바르지 않습니다.', {code: 'SITE_LOGOUT_CONTRACT_INVALID'});
  }
  return Object.freeze({sessionId: payload.session_id, status: payload.status});
}
