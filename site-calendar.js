import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-e8f1efd3a007';
import {normalizeCalendarWeatherResponse} from './site-calendar-weather.js?v=aset-e8f1efd3a007';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const LOGICAL_REQUEST_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;
const ACTIVITY_ID_PATTERN = /^activity_[0-9a-f]{32}$/;
const OCCURRENCE_ID_PATTERN = /^occurrence_[0-9a-f]{32}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_PATTERN = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const EXPENSE_CATEGORIES = new Set(['FOOD', 'TRAVEL', 'SHOPPING', 'LIVING', 'OTHER', 'UNCLASSIFIED']);
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
  // Festival source link (FESTIVAL-EVENT-10/12): mirrors lotbi-core's
  // app.smart_calendar_entry.CalendarEntryDetails pairing rules exactly, so a
  // malformed combination fails the same way on both sides. source_kind is a
  // closed set of one value today; widen only when a second real caller
  // exists.
  const sourceKindRaw = typeof value?.source_kind === 'string' ? value.source_kind : null;
  if (sourceKindRaw !== null && sourceKindRaw !== 'FESTIVAL') {
    throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_SOURCE_KIND_INVALID', status: 422});
  }
  const sourceRef = optionalText(value?.source_ref, 120);
  const visitScopeRaw = typeof value?.visit_scope === 'string' ? value.visit_scope : null;
  if (visitScopeRaw !== null && visitScopeRaw !== 'DATE' && visitScopeRaw !== 'FULL_RANGE') {
    throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_VISIT_SCOPE_INVALID', status: 422});
  }
  const visitDateRaw = typeof value?.visit_date === 'string' && DATE_PATTERN.test(value.visit_date) ? value.visit_date : null;
  if (typeof value?.visit_date === 'string' && value.visit_date && visitDateRaw === null) {
    throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_VISIT_DATE_INVALID', status: 422});
  }
  if (sourceKindRaw === null) {
    if (sourceRef !== null || visitScopeRaw !== null || visitDateRaw !== null) {
      throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_SOURCE_LINK_INVALID', status: 422});
    }
  } else {
    if (sourceRef === null || visitScopeRaw === null) {
      throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_SOURCE_LINK_INVALID', status: 422});
    }
    if (visitScopeRaw === 'DATE' && visitDateRaw === null) {
      throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_SOURCE_LINK_INVALID', status: 422});
    }
    if (visitScopeRaw === 'FULL_RANGE' && visitDateRaw !== null) {
      throw new SiteCoreError('일정 원본 정보가 올바르지 않습니다.', {code: 'LIFE_ENTRY_SOURCE_LINK_INVALID', status: 422});
    }
  }
  return Object.freeze({
    amount_minor: amount,
    currency,
    expense_category: category,
    memo: optionalText(value?.memo, 2000),
    place: optionalText(value?.place, 240),
    merchant: optionalText(value?.merchant, 240),
    source_kind: sourceKindRaw,
    source_ref: sourceRef,
    visit_scope: visitScopeRaw,
    visit_date: visitDateRaw,
  });
}

function hasCalendarEntryDetails(entry) {
  return entry.amount_minor !== null
    || entry.expense_category !== null
    || entry.memo !== null
    || entry.place !== null
    || entry.merchant !== null
    || entry.source_kind !== null;
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
  // 401 only. A 403 means the server refused this particular route — a scope or
  // permission decision — and that is never evidence the session died. Treating
  // one as the other is what let a single refused Calendar route log the user
  // out of the Calendar.
  if (!(error instanceof SiteCoreError) || error.status !== 401) return;
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {
    detail: {authenticated: false},
  }));
}

async function publicCalendarRequest(
  path,
  {method = 'GET', body, cache = 'no-store'} = {},
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
      cache,
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

// announceSessionFailure decides whether this request may declare the whole Site
// session dead. That announcement tears the Calendar down and returns the user
// Home, so it defaults to off: a request has to know the session really died
// before it may claim so, and most do not. Only the reads that gate the Calendar
// opt in, right below. Adding a Calendar call therefore cannot bring the
// Calendar down by forgetting to opt out — a refused side request now costs that
// strip its contents and nothing else.
async function calendarRequest(
  path,
  sessionToken,
  {method = 'GET', body, announceSessionFailure = false} = {},
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
    || !['PERSONAL_ACTIVITY_ONLY', 'PERSONAL_ACTIVITY_AND_LIFE_RESULT'].includes(payload.coverage)
    || !Array.isArray(payload.items)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
  ) {
    throw new SiteCoreError('LOTBI 일정 조회 응답 형식이 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
  }

  const items = payload.items.map(item => {
    if (
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
      || !['UNKNOWN', 'USER_ATTESTED', 'PROVIDER_VERIFIED'].includes(item.confirmation_level)
      || typeof item.provider_verified !== 'boolean'
      || (item.reminder_configured !== undefined && typeof item.reminder_configured !== 'boolean')
      || !['USER_INPUT', 'LIFE_RESULT'].includes(item.source_kind)
      || !Array.isArray(item.allowed_actions)
    ) {
      throw new SiteCoreError('LOTBI 일정 조회 응답 형식이 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
    }

    const reminderConfigured = item.reminder_configured === true;
    if (
      item.source_kind === 'USER_INPUT'
      && (
        item.confirmation_level !== 'USER_ATTESTED'
        || item.provider_verified !== false
        || reminderConfigured
        || item.allowed_actions.some(action => action !== 'UPDATE' && action !== 'REMOVE')
      )
    ) {
      throw new SiteCoreError('LOTBI 개인 일정 권한 정보가 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
    }
    if (
      item.source_kind === 'LIFE_RESULT'
      && item.allowed_actions.some(action => !['HIDE', 'REMINDER_SETTINGS', 'VIEW_SOURCE'].includes(action))
    ) {
      throw new SiteCoreError('LOTBI 결과 일정 권한 정보가 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
    }

    return Object.freeze({
      ...item,
      reminder_configured: reminderConfigured,
      entry: calendarEntryDetails(item.entry || {}),
    });
  });

  const expectedCoverage = items.some(item => item.source_kind === 'LIFE_RESULT')
    ? 'PERSONAL_ACTIVITY_AND_LIFE_RESULT'
    : 'PERSONAL_ACTIVITY_ONLY';
  if (payload.coverage !== expectedCoverage) {
    throw new SiteCoreError('LOTBI 일정 조회 범위 정보가 올바르지 않습니다.', {code: 'LIFE_READ_CONTRACT_INVALID'});
  }

  return Object.freeze({
    view: payload.view,
    asOf: payload.as_of,
    timezone: payload.timezone,
    coverage: expectedCoverage,
    items: Object.freeze(items),
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

function normalizeKoreaHolidayResponse(payload) {
  if (
    !payload
    || !Number.isInteger(payload.year)
    || payload.country !== 'KR'
    || !['VERIFIED', 'UNAVAILABLE'].includes(payload.coverage_status)
    || !Array.isArray(payload.supported_years)
    || !Array.isArray(payload.items)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
    || payload.items.some(item => (
      !item
      || typeof item !== 'object'
      || !DATE_PATTERN.test(item.date)
      || typeof item.name !== 'string'
      || !item.name.trim()
      || item.country !== 'KR'
      || typeof item.holiday_type !== 'string'
      || typeof item.is_substitute !== 'boolean'
      || typeof item.source !== 'string'
      || !DATE_PATTERN.test(item.source_date)
      || typeof item.verified_at !== 'string'
      || !Number.isFinite(Date.parse(item.verified_at))
    ))
  ) {
    throw new SiteCoreError('대한민국 공휴일 응답 형식이 올바르지 않습니다.', {
      code: 'CALENDAR_HOLIDAY_CONTRACT_INVALID',
    });
  }
  if (payload.coverage_status === 'VERIFIED' && typeof payload.snapshot_version !== 'string') {
    throw new SiteCoreError('대한민국 공휴일 버전 정보가 올바르지 않습니다.', {
      code: 'CALENDAR_HOLIDAY_CONTRACT_INVALID',
    });
  }
  if (payload.coverage_status === 'UNAVAILABLE' && payload.items.length) {
    throw new SiteCoreError('검증되지 않은 공휴일 데이터가 포함되어 있습니다.', {
      code: 'CALENDAR_HOLIDAY_CONTRACT_INVALID',
    });
  }
  return Object.freeze({
    year: payload.year,
    country: payload.country,
    coverageStatus: payload.coverage_status,
    snapshotVersion: payload.snapshot_version || null,
    supportedYears: Object.freeze([...payload.supported_years]),
    items: Object.freeze(payload.items.map(item => Object.freeze({
      date: item.date,
      name: item.name.trim(),
      country: item.country,
      holidayType: item.holiday_type,
      isSubstitute: item.is_substitute,
      source: item.source,
      sourceDate: item.source_date,
      verifiedAt: item.verified_at,
    }))),
    aiCalls: 0,
    providerApiCalls: 0,
  });
}

export async function getKoreaHolidays(year, fetchImpl = globalThis.fetch) {
  if (!Number.isInteger(year) || year < 2004 || year > 2100) {
    throw new SiteCoreError('공휴일 조회 연도가 올바르지 않습니다.', {
      code: 'CALENDAR_HOLIDAY_YEAR_INVALID',
      status: 422,
    });
  }
  const payload = await publicCalendarRequest(
    `/v2/life/holidays?year=${year}&country=KR`,
    {cache: 'no-store'},
    fetchImpl,
  );
  return normalizeKoreaHolidayResponse(payload);
}

export async function getCalendarWeather(
  sessionToken,
  {start, end, timezone = 'Asia/Seoul', latitude, longitude, midRegionCode = ''},
  fetchImpl = globalThis.fetch,
) {
  const startDate = isoDate(start, '시작');
  const endDate = isoDate(end, '종료');
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  const region = typeof midRegionCode === 'string' ? midRegionCode.trim() : '';
  if (hasLatitude !== hasLongitude || (region && !/^[A-Za-z0-9]{1,16}$/.test(region))) {
    throw new SiteCoreError('날씨 위치 정보가 올바르지 않습니다.', {
      code: 'CALENDAR_WEATHER_LOCATION_INVALID',
      status: 422,
    });
  }
  const params = new URLSearchParams({
    start: startDate,
    end: endDate,
    timezone: String(timezone || 'Asia/Seoul'),
  });
  if (hasLatitude && hasLongitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 31 || lat > 44.5 || lon < 122 || lon > 132.5) {
      throw new SiteCoreError('날씨 위치 정보가 올바르지 않습니다.', {
        code: 'CALENDAR_WEATHER_LOCATION_INVALID',
        status: 422,
      });
    }
    params.set('latitude', String(lat));
    params.set('longitude', String(lon));
    if (region) params.set('mid_region_code', region);
  }
  const payload = await calendarRequest(
    `/v2/life/weather?${params.toString()}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return normalizeCalendarWeatherResponse(payload);
}

export async function getLifeToday(sessionToken, timezone, fetchImpl = globalThis.fetch) {
  const zone = timezoneName(timezone);
  const payload = await calendarRequest(
    `/v2/life/today?timezone=${encodeURIComponent(zone)}`,
    sessionToken,
    {announceSessionFailure: true},
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
    {announceSessionFailure: true},
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
    {announceSessionFailure: true},
    fetchImpl,
  );
  return assertReadResponse(payload, 'AGENDA');
}

function assertExpenseSummaryResponse(payload) {
  if (
    !payload
    || payload.view !== 'EXPENSE_SUMMARY'
    || typeof payload.as_of !== 'string'
    || typeof payload.timezone !== 'string'
    || typeof payload.start_date !== 'string'
    || typeof payload.end_date !== 'string'
    || payload.coverage !== 'RECORDED_CALENDAR_ENTRIES_ONLY'
    || !Array.isArray(payload.currencies)
    || !Number.isInteger(payload.entries_without_amount)
    || payload.ai_calls !== 0
    || payload.provider_api_calls !== 0
  ) {
    throw new SiteCoreError('LOTBI 지출 합계 응답 형식이 올바르지 않습니다.', {code: 'LIFE_EXPENSE_SUMMARY_CONTRACT_INVALID'});
  }

  const currencies = payload.currencies.map(row => {
    if (
      !row
      || typeof row !== 'object'
      || typeof row.currency !== 'string'
      || !/^[A-Z]{3}$/.test(row.currency)
      || !Array.isArray(row.categories)
      || !Number.isInteger(row.total_amount_minor)
      || !Number.isInteger(row.entry_count)
    ) {
      throw new SiteCoreError('LOTBI 지출 합계 응답 형식이 올바르지 않습니다.', {code: 'LIFE_EXPENSE_SUMMARY_CONTRACT_INVALID'});
    }
    const categories = row.categories.map(category => {
      if (
        !category
        || typeof category !== 'object'
        || !EXPENSE_CATEGORIES.has(category.expense_category)
        || !Number.isInteger(category.amount_minor)
        || !Number.isInteger(category.entry_count)
      ) {
        throw new SiteCoreError('LOTBI 지출 합계 응답 형식이 올바르지 않습니다.', {code: 'LIFE_EXPENSE_SUMMARY_CONTRACT_INVALID'});
      }
      return {
        expenseCategory: category.expense_category,
        amountMinor: category.amount_minor,
        entryCount: category.entry_count,
      };
    });
    return {
      currency: row.currency,
      categories,
      totalAmountMinor: row.total_amount_minor,
      entryCount: row.entry_count,
    };
  });

  return {
    startDate: payload.start_date,
    endDate: payload.end_date,
    currencies,
    entriesWithoutAmount: payload.entries_without_amount,
  };
}

export async function getLifeExpenseSummary(sessionToken, {timezone, start, end}, fetchImpl = globalThis.fetch) {
  const zone = timezoneName(timezone);
  const startDate = isoDate(start, '시작');
  const endDate = isoDate(end, '종료');
  const payload = await calendarRequest(
    `/v2/life/expense-summary?timezone=${encodeURIComponent(zone)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
    sessionToken,
    {},
    fetchImpl,
  );
  return assertExpenseSummaryResponse(payload);
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
    {announceSessionFailure: true},
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
