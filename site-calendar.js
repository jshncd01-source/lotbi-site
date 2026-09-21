import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=20260921-convcal2';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const LOGICAL_REQUEST_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;
const ACTIVITY_ID_PATTERN = /^activity_[0-9a-f]{32}$/;
const OCCURRENCE_ID_PATTERN = /^occurrence_[0-9a-f]{32}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_PATTERN = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const EXPENSE_CATEGORIES = new Set(['FOOD', 'TRAVEL', 'SHOPPING', 'LIVING', 'UNCLASSIFIED']);
const EXPLICIT_LIFE_CALENDAR_MARKER_PATTERN = /(?:(?:\d{4})년\s*)?\d{1,2}월\s*\d{1,2}일\s*(?:(?:오전|오후)\s*)?\d{1,2}시/gu;
const EXPLICIT_LIFE_CALENDAR_COMMAND_PATTERN = /^\s*(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일\s*(?:(?:오전|오후)\s*)?\d{1,2}시(?:\s*\d{1,2}분)?\s*(?:에)?\s*.+[.!?]?\s*$/u;
const NON_WRITE_LIFE_CALENDAR_PATTERNS = Object.freeze([
  /[?？]/u,
  /(?:^|\s)(?:안|못)\s+\S+/u,
  /(?:가지|오지|먹지|하지|등록하지|추가하지|저장하지)\s*마(?:\s|$)/u,
  /(?:등록|추가|저장)(?:은|는|을|를)?\s*(?:하지\s*마|말아|말자|원하지\s*않)/u,
  /(?:일정|스케줄)(?:이|가|은|는)?\s*(?:있|없)(?:어|나|니|나요|습니까)?(?:\s|$)/u,
  /(?:갈|할|올|먹을|만날|볼|받을|쓸)\s*(?:것|거)\s*같/u,
  /(?:가|하|오|먹|만나|보|받)면(?:\s|$)/u,
  /(?:갈까|할까|올까|먹을까|만날까|볼까|받을까|좋을까|어떨까)(?:\s|$)/u,
  /(?:라고|다고|라며|다며)\s*(?:했|말했|전했|들었)/u,
  /(?:간대|한대|온대|먹는대|만난대|봤대|받는대|했대)(?:요)?(?:\s|$)/u,
  /(?:민수|친구|엄마|아빠|남편|아내|동생|형|누나|언니|오빠|직원|팀원)(?:이|가|은|는)\s+/u,
  /["“”‘’「」『』]/u,
]);

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
}

function bearerToken(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) {
    throw new SiteCoreError('LOTBI Site 로그인이 필요합니다.', {code: 'SITE_SESSION_REQUIRED', status: 401});
  }
  return token;
}

function logicalRequestId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!LOGICAL_REQUEST_PATTERN.test(normalized)) {
    throw new SiteCoreError('일정 요청 식별자가 올바르지 않습니다.', {code: 'LIFE_LOGICAL_REQUEST_ID_INVALID', status: 422});
  }
  return normalized;
}

function isoDate(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!DATE_PATTERN.test(normalized)) {
    throw new SiteCoreError(`${label} 날짜가 올바르지 않습니다.`, {code: 'LIFE_DATE_INVALID', status: 422});
  }
  return normalized;
}

function timezoneName(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!TIMEZONE_PATTERN.test(normalized) || normalized.length > 80) {
    throw new SiteCoreError('시간대가 올바르지 않습니다.', {code: 'LIFE_TIMEZONE_INVALID', status: 422});
  }
  return normalized;
}

function optionalText(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SiteCoreError('일정 입력값이 너무 깁니다.', {code: 'LIFE_ENTRY_INPUT_INVALID', status: 422});
  }
  return normalized;
}

function calendarEntryDetails(value = {}) {
  const rawAmount = value?.amount_minor ?? value?.amountMinor ?? null;
  const amount = rawAmount === '' || rawAmount == null ? null : Number(rawAmount);
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000)) {
    throw new SiteCoreError('비용이 올바르지 않습니다.', {code: 'LIFE_ENTRY_AMOUNT_INVALID', status: 422});
  }
  const categoryRaw = value?.expense_category ?? value?.expenseCategory ?? null;
  const category = typeof categoryRaw === 'string' && categoryRaw ? categoryRaw : null;
  if (category !== null && !EXPENSE_CATEGORIES.has(category)) {
    throw new SiteCoreError('비용 종류가 올바르지 않습니다.', {code: 'LIFE_ENTRY_CATEGORY_INVALID', status: 422});
  }
  const currency = typeof value?.currency === 'string' && value.currency.trim()
    ? value.currency.trim().toUpperCase()
    : 'KRW';
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new SiteCoreError('통화가 올바르지 않습니다.', {code: 'LIFE_ENTRY_CURRENCY_INVALID', status: 422});
  }
  return Object.freeze({
    amount_minor: amount,
    currency,
    expense_category: category,
    memo: optionalText(value?.memo, 2000),
    place: optionalText(value?.place, 240),
    merchant: optionalText(value?.merchant, 240),
  });
}

function hasCalendarEntryDetails(entry) {
  return entry.amount_minor !== null
    || entry.expense_category !== null
    || entry.memo !== null
    || entry.place !== null
    || entry.merchant !== null;
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function responseError(response, payload) {
  const detail = payload && typeof payload.detail === 'object' ? payload.detail : {};
  return new SiteCoreError(
    typeof detail.message === 'string' && detail.message
      ? detail.message
      : 'LOTBI 일정 요청을 완료하지 못했습니다.',
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
  globalThis.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {
    detail: {authenticated: false},
  }));
}

async function publicCalendarRequest(
  path,
  {method = 'GET', body} = {},
  fetchImpl = globalThis.fetch,
) {
  assertFetch(fetchImpl);
  const headers = {};
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
    throw new SiteCoreError('LOTBI 일정 서버에 접속하지 못했습니다.', {
      code: 'LIFE_CALENDAR_NETWORK_ERROR',
      retryable: true,
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) throw responseError(response, payload);
  return payload;
}

async function calendarRequest(
  path,
  sessionToken,
  {method = 'GET', body, announceSessionFailure = true} = {},
  fetchImpl = globalThis.fetch,
) {
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
    throw new SiteCoreError('LOTBI 일정 서버에 접속하지 못했습니다.', {
      code: 'LIFE_CALENDAR_NETWORK_ERROR',
      retryable: true,
    });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = responseError(response, payload);
    if (announceSessionFailure) announceInvalidSiteSession(error);
    throw error;
  }
  return payload;
}

function assertReadResponse(payload, expectedView) {
  if (
    !payload
    || payload.view !== expectedView
    || typeof payload.as_of !== 'string'
    || typeof payload.timezone !== 'string'
    || payload.coverage !== 'PERSONAL_ACTIVITY_ONLY'
    || !Array.isArray(payload.items)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
    || payload.items.some(item => (
      !item
      || typeof item !== 'object'
      || typeof item.projection_id !== 'string'
      || typeof item.activity_id !== 'string'
      || !ACTIVITY_ID_PATTERN.test(item.activity_id)
      || typeof item.occurrence_id !== 'string'
      || !OCCURRENCE_ID_PATTERN.test(item.occurrence_id)
      || typeof item.title !== 'string'
      || !Number.isInteger(item.activity_revision)
      || !Number.isInteger(item.occurrence_revision)
      || typeof item.local_date !== 'string'
      || (item.local_datetime !== null && typeof item.local_datetime !== 'string')
      || item.confirmation_level !== 'USER_ATTESTED'
      || item.provider_verified !== false
      || item.source_kind !== 'USER_INPUT'
      || !Array.isArray(item.allowed_actions)
      || item.allowed_actions.some(action => action !== 'UPDATE' && action !== 'REMOVE')
    ))
  ) {
    throw new SiteCoreError('LOTBI 일정 조회 응답 형식이 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
  }
  return Object.freeze({
    view: payload.view,
    asOf: payload.as_of,
    timezone: payload.timezone,
    coverage: payload.coverage,
    items: Object.freeze(payload.items.map(item => Object.freeze({
      ...item,
      entry: calendarEntryDetails(item.entry || {}),
    }))),
    aiCalls: 0,
    providerApiCalls: 0,
  });
}

function assertUnscheduledResponse(payload) {
  if (
    !payload
    || payload.view !== 'UNSCHEDULED'
    || !Array.isArray(payload.items)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
  ) {
    throw new SiteCoreError('LOTBI 날짜 미정 일정 응답 형식이 올바르지 않습니다.', {code: 'LIFE_UNSCHEDULED_CONTRACT_INVALID'});
  }
  return Object.freeze({
    view: 'UNSCHEDULED',
    items: Object.freeze(payload.items.map(item => assertMutationResponse(item))),
    aiCalls: 0,
    providerApiCalls: 0,
  });
}

function assertAttentionResponse(payload) {
  if (
    !payload
    || payload.view !== 'ATTENTION'
    || typeof payload.as_of !== 'string'
    || typeof payload.timezone !== 'string'
    || payload.coverage !== 'PERSONAL_ACTIVITY_ONLY'
    || !Array.isArray(payload.items)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
    || payload.items.some(item => (
      !item
      || typeof item !== 'object'
      || typeof item.projection_id !== 'string'
      || !ACTIVITY_ID_PATTERN.test(item.activity_id)
      || !OCCURRENCE_ID_PATTERN.test(item.occurrence_id)
      || typeof item.title !== 'string'
      || !DATE_PATTERN.test(item.due_date)
      || !['UPCOMING', 'DUE_TODAY', 'OVERDUE'].includes(item.state)
      || !Number.isInteger(item.days_until_due)
      || item.confirmation_level !== 'USER_ATTESTED'
      || item.provider_verified !== false
      || item.source_kind !== 'USER_INPUT'
      || !Array.isArray(item.allowed_actions)
      || item.allowed_actions.some(action => action !== 'UPDATE' && action !== 'REMOVE')
    ))
  ) {
    throw new SiteCoreError('LOTBI 주의 일정 응답 형식이 올바르지 않습니다.', {code: 'LIFE_ATTENTION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    view: 'ATTENTION',
    asOf: payload.as_of,
    timezone: payload.timezone,
    coverage: payload.coverage,
    items: Object.freeze(payload.items.map(item => Object.freeze({...item}))),
    aiCalls: 0,
    providerApiCalls: 0,
  });
}

function assertMutationResponse(payload) {
  if (
    !payload
    || typeof payload.activity_id !== 'string'
    || !ACTIVITY_ID_PATTERN.test(payload.activity_id)
    || typeof payload.occurrence_id !== 'string'
    || !OCCURRENCE_ID_PATTERN.test(payload.occurrence_id)
    || typeof payload.title !== 'string'
    || !Number.isInteger(payload.activity_revision)
    || !Number.isInteger(payload.occurrence_revision)
    || payload.confirmation_level !== 'USER_ATTESTED'
    || payload.provider_verified !== false
    || payload.read_your_writes !== true
    || !payload.temporal
    || typeof payload.temporal !== 'object'
  ) {
    throw new SiteCoreError('LOTBI 일정 변경 응답 형식이 올바르지 않습니다.', {code: 'LIFE_MUTATION_CONTRACT_INVALID'});
  }
  return Object.freeze({
    activityId: payload.activity_id,
    occurrenceId: payload.occurrence_id,
    title: payload.title,
    entry: calendarEntryDetails(payload.entry || {}),
    activityState: payload.activity_state,
    activityRevision: payload.activity_revision,
    occurrenceRevision: payload.occurrence_revision,
    temporal: Object.freeze({...payload.temporal}),
    temporalSemantics: payload.temporal_semantics,
    busy: payload.busy,
    confirmationLevel: payload.confirmation_level,
    providerVerified: false,
    readYourWrites: true,
  });
}

function assertCommandPreviewResponse(payload) {
  if (
    !payload
    || typeof payload.title !== 'string'
    || !payload.title.trim()
    || !payload.temporal
    || typeof payload.temporal !== 'object'
    || payload.temporal.kind !== 'LOCAL_DATE_TIME'
    || typeof payload.temporal.local_datetime !== 'string'
    || typeof payload.temporal.timezone_name !== 'string'
    || payload.temporal_semantics !== 'USER_PLANNED_TIME'
    || payload.parser_type !== 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1'
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
  ) {
    throw new SiteCoreError('LOTBI 일정 명령 미리보기 형식이 올바르지 않습니다.', {code: 'LIFE_COMMAND_PREVIEW_CONTRACT_INVALID'});
  }
  return Object.freeze({
    title: payload.title.trim(),
    temporal: Object.freeze({...payload.temporal}),
    temporalSemantics: payload.temporal_semantics,
    parserType: payload.parser_type,
    aiCalls: 0,
    providerApiCalls: 0,
  });
}

function assertCommandResponse(payload) {
  if (
    !payload
    || typeof payload.assistant_text !== 'string'
    || payload.parser_type !== 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1'
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
    || payload.confirmation_level !== 'USER_ATTESTED'
  ) {
    throw new SiteCoreError('LOTBI 일정 명령 응답 형식이 올바르지 않습니다.', {code: 'LIFE_COMMAND_CONTRACT_INVALID'});
  }
  return Object.freeze({activity: assertMutationResponse(payload.activity), assistantText: payload.assistant_text, parserType: payload.parser_type, aiCalls: 0, providerApiCalls: 0});
}

export function isExplicitLifeCalendarCommand(text) {
  const source = String(text || '').trim();
  const markers = source.match(EXPLICIT_LIFE_CALENDAR_MARKER_PATTERN) || [];
  if (markers.length !== 1 || !EXPLICIT_LIFE_CALENDAR_COMMAND_PATTERN.test(source)) return false;
  return !NON_WRITE_LIFE_CALENDAR_PATTERNS.some(pattern => pattern.test(source));
}

export async function executeLifeCalendarCommand(sessionToken, {logicalRequestId: requestId, text, timezone, turnCreatedAt = ''}, fetchImpl = globalThis.fetch) {
  const commandText = typeof text === 'string' ? text.trim() : '';
  const createdAt = typeof turnCreatedAt === 'string' ? turnCreatedAt.trim() : '';
  if (!commandText || commandText.length > 1000 || (createdAt && !Number.isFinite(Date.parse(createdAt)))) {
    throw new SiteCoreError('일정 명령이 올바르지 않습니다.', {code: 'LIFE_COMMAND_INPUT_INVALID', status: 422});
  }
  const payload = await calendarRequest('/v2/life/commands', sessionToken, {
    method: 'POST',
    body: {
      logical_request_id: logicalRequestId(requestId),
      text: commandText,
      timezone: timezoneName(timezone),
      ...(createdAt ? {turn_created_at: createdAt} : {}),
    },
  }, fetchImpl);
  return assertCommandResponse(payload);
}

export async function previewLifeCalendarCommand({logicalRequestId: requestId, text, timezone, turnCreatedAt}, fetchImpl = globalThis.fetch) {
  const commandText = typeof text === 'string' ? text.trim() : '';
  const createdAt = typeof turnCreatedAt === 'string' ? turnCreatedAt.trim() : '';
  if (!commandText || commandText.length > 1000 || !createdAt || !Number.isFinite(Date.parse(createdAt))) {
    throw new SiteCoreError('일정 명령 미리보기 입력이 올바르지 않습니다.', {code: 'LIFE_COMMAND_INPUT_INVALID', status: 422});
  }
  const payload = await publicCalendarRequest('/v2/life/commands/preview', {
    method: 'POST',
    body: {
      logical_request_id: logicalRequestId(requestId),
      text: commandText,
      timezone: timezoneName(timezone),
      turn_created_at: createdAt,
    },
  }, fetchImpl);
  return assertCommandPreviewResponse(payload);
}

export async function getLifeToday(sessionToken, timezone, fetchImpl = globalThis.fetch) {
  const zone = timezoneName(timezone);
  const payload = await calendarRequest(
    `/v2/life/today?timezone=${encodeURIComponent(zone)}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertReadResponse(payload, 'TODAY');
}

export async function getLifeUpcoming(sessionToken, {timezone, through}, fetchImpl = globalThis.fetch) {
  const zone = timezoneName(timezone);
  const throughDate = isoDate(through, '종료');
  const payload = await calendarRequest(
    `/v2/life/upcoming?timezone=${encodeURIComponent(zone)}&through=${encodeURIComponent(throughDate)}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertReadResponse(payload, 'UPCOMING');
}

export async function getLifeAgenda(sessionToken, {timezone, start, end}, fetchImpl = globalThis.fetch) {
  const zone = timezoneName(timezone);
  const startDate = isoDate(start, '시작');
  const endDate = isoDate(end, '종료');
  const payload = await calendarRequest(
    `/v2/life/agenda?timezone=${encodeURIComponent(zone)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertReadResponse(payload, 'AGENDA');
}

export async function getLifeUnscheduled(sessionToken, fetchImpl = globalThis.fetch) {
  const payload = await calendarRequest(
    '/v2/life/unscheduled',
    sessionToken,
    {},
    fetchImpl,
  );
  return assertUnscheduledResponse(payload);
}

export async function getLifeAttention(
  sessionToken,
  {timezone, horizonDays = 14} = {},
  fetchImpl = globalThis.fetch,
) {
  const zone = timezoneName(timezone);
  if (!Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 365) {
    throw new SiteCoreError('주의 일정 조회 범위가 올바르지 않습니다.', {code: 'LIFE_ATTENTION_HORIZON_INVALID', status: 422});
  }
  const payload = await calendarRequest(
    `/v2/life/attention?timezone=${encodeURIComponent(zone)}&horizon_days=${horizonDays}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertAttentionResponse(payload);
}

export async function getLifeActivity(sessionToken, activityId, fetchImpl = globalThis.fetch) {
  const id = typeof activityId === 'string' ? activityId.trim() : '';
  if (!ACTIVITY_ID_PATTERN.test(id)) {
    throw new SiteCoreError('일정 식별자가 올바르지 않습니다.', {code: 'LIFE_ACTIVITY_ID_INVALID', status: 422});
  }
  const payload = await calendarRequest(
    `/v2/life/activity-lookups/${encodeURIComponent(id)}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertMutationResponse(payload);
}

export async function createLifeActivity(
  sessionToken,
  {logicalRequestId: requestId, title, temporal, temporalSemantics = 'USER_PLANNED_TIME', busy = 'UNKNOWN', entry = {}},
  fetchImpl = globalThis.fetch,
) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  if (!normalizedTitle || normalizedTitle.length > 240 || !temporal || typeof temporal !== 'object') {
    throw new SiteCoreError('일정 입력값이 올바르지 않습니다.', {code: 'LIFE_ACTIVITY_INPUT_INVALID', status: 422});
  }
  const details = calendarEntryDetails(entry);
  const payload = await calendarRequest(
    '/v2/life/activities',
    sessionToken,
    {
      method: 'POST',
      body: {
        logical_request_id: logicalRequestId(requestId),
        title: normalizedTitle,
        temporal,
        temporal_semantics: temporalSemantics,
        busy,
        ...(hasCalendarEntryDetails(details) ? {entry: details} : {}),
      },
    },
    fetchImpl,
  );
  return assertMutationResponse(payload);
}

export async function editLifeActivity(
  sessionToken,
  activityId,
  {
    logicalRequestId: requestId,
    expectedActivityRevision,
    expectedOccurrenceRevision,
    title,
    temporal,
    temporalSemantics = 'USER_PLANNED_TIME',
    busy = 'UNKNOWN',
    entry = {},
  },
  fetchImpl = globalThis.fetch,
) {
  const id = typeof activityId === 'string' ? activityId.trim() : '';
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  if (
    !ACTIVITY_ID_PATTERN.test(id)
    || !Number.isInteger(expectedActivityRevision)
    || expectedActivityRevision < 1
    || !Number.isInteger(expectedOccurrenceRevision)
    || expectedOccurrenceRevision < 1
    || !normalizedTitle
    || normalizedTitle.length > 240
    || !temporal
    || typeof temporal !== 'object'
  ) {
    throw new SiteCoreError('일정 변경값이 올바르지 않습니다.', {code: 'LIFE_ACTIVITY_EDIT_INPUT_INVALID', status: 422});
  }
  const payload = await calendarRequest(
    `/v2/life/activities/${encodeURIComponent(id)}/entry`,
    sessionToken,
    {
      method: 'PATCH',
      body: {
        logical_request_id: logicalRequestId(requestId),
        expected_activity_revision: expectedActivityRevision,
        expected_occurrence_revision: expectedOccurrenceRevision,
        title: normalizedTitle,
        temporal,
        temporal_semantics: temporalSemantics,
        busy,
        entry: calendarEntryDetails(entry),
      },
    },
    fetchImpl,
  );
  return assertMutationResponse(payload);
}

export async function rescheduleLifeActivity(
  sessionToken,
  activityId,
  {logicalRequestId: requestId, expectedRevision, temporal},
  fetchImpl = globalThis.fetch,
) {
  const id = typeof activityId === 'string' ? activityId.trim() : '';
  if (!ACTIVITY_ID_PATTERN.test(id) || !Number.isInteger(expectedRevision) || expectedRevision < 1 || !temporal || typeof temporal !== 'object') {
    throw new SiteCoreError('일정 변경값이 올바르지 않습니다.', {code: 'LIFE_RESCHEDULE_INPUT_INVALID', status: 422});
  }
  const payload = await calendarRequest(
    `/v2/life/activities/${encodeURIComponent(id)}`,
    sessionToken,
    {
      method: 'PATCH',
      body: {
        logical_request_id: logicalRequestId(requestId),
        expected_revision: expectedRevision,
        temporal,
      },
    },
    fetchImpl,
  );
  return assertMutationResponse(payload);
}

export async function removeLifeActivity(
  sessionToken,
  activityId,
  {logicalRequestId: requestId, expectedRevision},
  fetchImpl = globalThis.fetch,
) {
  const id = typeof activityId === 'string' ? activityId.trim() : '';
  if (!ACTIVITY_ID_PATTERN.test(id) || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new SiteCoreError('일정 삭제값이 올바르지 않습니다.', {code: 'LIFE_REMOVE_INPUT_INVALID', status: 422});
  }
  const payload = await calendarRequest(
    `/v2/life/activities/${encodeURIComponent(id)}/remove`,
    sessionToken,
    {
      method: 'POST',
      body: {
        logical_request_id: logicalRequestId(requestId),
        expected_revision: expectedRevision,
      },
    },
    fetchImpl,
  );
  return assertMutationResponse(payload);
}
