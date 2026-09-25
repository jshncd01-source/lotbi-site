import {createLifeActivity} from './site-calendar.js?v=aset-cf022f054579';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-cf022f054579';
import {getCurrentSiteUser, SiteCoreError} from './site-core.js?v=aset-cf022f054579';

const ACTION_ID_RE = /^calact_[0-9a-f]{24}$/;
const CANDIDATE_ID_RE = /^calcand_[0-9a-f]{24}$/;
const WRITE_REQUEST_RE = /^calendar-action:[0-9a-f]{24}$/;
const SOURCE_REF_RE = /^[A-Za-z0-9._:-]{8,160}$/;
const NAMESPACE_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const ACTIVITY_ID_RE = /^activity_[0-9a-f]{32}$/;
const OCCURRENCE_ID_RE = /^occurrence_[0-9a-f]{32}$/;
const GUEST_EVENT_ID_RE = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const TIMEZONE_RE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;
const STATES = new Set(['AVAILABLE', 'IN_FLIGHT', 'SUCCESS', 'UNKNOWN_RESULT', 'DEFINITE_FAILURE', 'DELETED']);
const SCOPES = new Set(['AUTH', 'GUEST']);

function safeError(code, message) {
  return Object.freeze({
    code: String(code || 'CALENDAR_ACTION_FAILED').slice(0, 96),
    message: String(message || '일정을 등록하지 못했습니다.').slice(0, 240),
  });
}

function normalizeCandidate(value) {
  if (!value || typeof value !== 'object') return null;
  const temporal = value.temporal && typeof value.temporal === 'object' ? value.temporal : null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const sourceTurnCreatedAt = typeof value.sourceTurnCreatedAt === 'string' ? value.sourceTurnCreatedAt.trim() : '';
  if (
    value.contractId !== 'CORE-CALENDAR-CANDIDATE-01'
    || value.schemaVersion !== 1
    || value.candidateVersion !== 1
    || !CANDIDATE_ID_RE.test(String(value.candidateId || ''))
    || !ACTION_ID_RE.test(String(value.actionId || ''))
    || !SOURCE_REF_RE.test(String(value.sourceTurnRef || ''))
    || !sourceTurnCreatedAt || !Number.isFinite(Date.parse(sourceTurnCreatedAt))
    || !title || title.length > 240
    || temporal?.kind !== 'LOCAL_DATE_TIME'
    || !LOCAL_DATETIME_RE.test(String(temporal.localDatetime || ''))
    || !TIMEZONE_RE.test(String(temporal.timezoneName || ''))
    || value.temporalSemantics !== 'USER_PLANNED_TIME'
    || value.meaning !== 'PERSONAL_CALENDAR_ACTIVITY'
    || !Array.isArray(value.missingFields) || value.missingFields.length !== 0
    || value.approvalState !== 'NOT_APPROVED'
    || value.executionState !== 'NOT_EXECUTED'
    || !WRITE_REQUEST_RE.test(String(value.writeLogicalRequestId || ''))
  ) return null;
  return Object.freeze({
    contractId: value.contractId,
    schemaVersion: 1,
    candidateId: value.candidateId,
    actionId: value.actionId,
    candidateVersion: 1,
    sourceTurnRef: value.sourceTurnRef,
    sourceTurnCreatedAt,
    title,
    temporal: Object.freeze({
      kind: 'LOCAL_DATE_TIME',
      localDatetime: temporal.localDatetime,
      timezoneName: temporal.timezoneName,
    }),
    temporalSemantics: 'USER_PLANNED_TIME',
    meaning: 'PERSONAL_CALENDAR_ACTIVITY',
    missingFields: Object.freeze([]),
    approvalState: 'NOT_APPROVED',
    executionState: 'NOT_EXECUTED',
    writeLogicalRequestId: value.writeLogicalRequestId,
  });
}

function normalizeResult(scope, value) {
  if (!value || typeof value !== 'object') return null;
  const dateHint = typeof value.dateHint === 'string' ? value.dateHint : '';
  const timezone = typeof value.timezone === 'string' ? value.timezone : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateHint) || !TIMEZONE_RE.test(timezone) || !title) return null;
  if (scope === 'AUTH') {
    if (!ACTIVITY_ID_RE.test(String(value.activityId || '')) || !OCCURRENCE_ID_RE.test(String(value.occurrenceId || ''))) return null;
    return Object.freeze({
      activityId: value.activityId,
      occurrenceId: value.occurrenceId,
      dateHint,
      timezone,
      title,
    });
  }
  if (!GUEST_EVENT_ID_RE.test(String(value.guestEventId || ''))) return null;
  return Object.freeze({guestEventId: value.guestEventId, dateHint, timezone, title});
}

export function createAvailableCalendarAction(candidateValue, {scope, ownerNamespace} = {}) {
  const candidate = normalizeCandidate(candidateValue);
  const normalizedScope = String(scope || '').trim().toUpperCase();
  const namespace = String(ownerNamespace || '').trim();
  if (!candidate || !SCOPES.has(normalizedScope) || !NAMESPACE_RE.test(namespace)) return null;
  return Object.freeze({
    schemaVersion: 1,
    actionId: candidate.actionId,
    candidateVersion: candidate.candidateVersion,
    scope: normalizedScope,
    ownerNamespace: namespace,
    state: 'AVAILABLE',
    candidate,
    result: null,
    lastError: null,
  });
}

export function normalizePersistedCalendarAction(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return null;
  const candidate = normalizeCandidate(value.candidate);
  const scope = String(value.scope || '').trim().toUpperCase();
  const ownerNamespace = String(value.ownerNamespace || '').trim();
  let state = String(value.state || '').trim().toUpperCase();
  if (
    !candidate
    || !SCOPES.has(scope)
    || !NAMESPACE_RE.test(ownerNamespace)
    || !STATES.has(state)
    || value.actionId !== candidate.actionId
    || value.candidateVersion !== candidate.candidateVersion
  ) return null;

  const result = value.result == null ? null : normalizeResult(scope, value.result);
  if ((state === 'SUCCESS' || state === 'DELETED') && !result) return null;
  if (state !== 'SUCCESS' && state !== 'DELETED' && value.result != null && !result) return null;
  const lastError = value.lastError && typeof value.lastError === 'object'
    ? safeError(value.lastError.code, value.lastError.message)
    : null;
  return Object.freeze({
    schemaVersion: 1,
    actionId: candidate.actionId,
    candidateVersion: candidate.candidateVersion,
    scope,
    ownerNamespace,
    state,
    candidate,
    result,
    lastError,
  });
}

export function recoverCalendarActionAfterReload(actionValue) {
  const action = normalizePersistedCalendarAction(actionValue);
  if (!action || action.state !== 'IN_FLIGHT') return action;
  return Object.freeze({...action, state: 'UNKNOWN_RESULT', lastError: safeError('CALENDAR_ACTION_RESULT_UNKNOWN', '등록 결과를 확인하고 있어요.')});
}

export function calendarActionInFlight(actionValue) {
  const action = normalizePersistedCalendarAction(actionValue);
  if (!action || action.state === 'SUCCESS' || action.state === 'DELETED') return action;
  return Object.freeze({...action, state: 'IN_FLIGHT', lastError: null});
}

function unknownWrite(error) {
  const status = Number(error?.status || 0);
  return error?.code === 'LIFE_CALENDAR_NETWORK_ERROR'
    || status >= 500
    || (status === 0 && error?.retryable === true);
}

function failed(action, code, message, {unknown = false} = {}) {
  return Object.freeze({
    ...action,
    state: unknown ? 'UNKNOWN_RESULT' : 'DEFINITE_FAILURE',
    result: null,
    lastError: safeError(code, message),
  });
}

async function runAuthenticated(action, {
  sessionToken,
  currentNamespace,
  verifyIdentity,
  createAuthActivity,
  fetchImpl,
}) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) return failed(action, 'SITE_SESSION_REQUIRED', 'LOTBI 로그인이 필요합니다.');
  if (currentNamespace !== action.ownerNamespace) {
    return failed(action, 'CALENDAR_ACTION_OWNER_MISMATCH', '이 대화와 현재 로그인 계정이 일치하지 않습니다.');
  }
  try {
    const identity = await verifyIdentity(token, fetchImpl);
    if (!identity || identity.installationId !== action.ownerNamespace) {
      return failed(action, 'CALENDAR_ACTION_OWNER_MISMATCH', '이 대화와 현재 로그인 계정이 일치하지 않습니다.');
    }
  } catch (error) {
    return failed(action, error?.code || 'CALENDAR_ACTION_OWNER_CHECK_FAILED', '현재 로그인 계정을 확인하지 못했습니다.');
  }

  const candidate = action.candidate;
  try {
    const result = await createAuthActivity(token, {
      logicalRequestId: candidate.writeLogicalRequestId,
      title: candidate.title,
      temporal: {
        kind: 'LOCAL_DATE_TIME',
        local_datetime: candidate.temporal.localDatetime,
        timezone_name: candidate.temporal.timezoneName,
      },
      temporalSemantics: candidate.temporalSemantics,
      busy: 'UNKNOWN',
    }, fetchImpl);
    if (!result?.readYourWrites || !ACTIVITY_ID_RE.test(String(result.activityId || '')) || !OCCURRENCE_ID_RE.test(String(result.occurrenceId || ''))) {
      return failed(action, 'LIFE_MUTATION_CONTRACT_INVALID', '일정 저장 결과를 확인하지 못했습니다.');
    }
    return Object.freeze({
      ...action,
      state: 'SUCCESS',
      result: Object.freeze({
        activityId: result.activityId,
        occurrenceId: result.occurrenceId,
        dateHint: candidate.temporal.localDatetime.slice(0, 10),
        timezone: candidate.temporal.timezoneName,
        title: result.title || candidate.title,
      }),
      lastError: null,
    });
  } catch (error) {
    if (unknownWrite(error)) {
      return failed(
        action,
        error?.code || 'CALENDAR_ACTION_RESULT_UNKNOWN',
        '등록 결과를 확인하고 있어요.',
        {unknown: true},
      );
    }
    return failed(action, error?.code || 'CALENDAR_ACTION_WRITE_FAILED', error instanceof Error ? error.message : '일정을 등록하지 못했습니다.');
  }
}

async function runGuest(action, {
  currentNamespace,
  storage,
  lockManager,
  guestRepositoryOptions,
}) {
  if (currentNamespace !== action.ownerNamespace) {
    return failed(action, 'CALENDAR_ACTION_OWNER_MISMATCH', '이 대화와 현재 브라우저 일정 범위가 일치하지 않습니다.');
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return failed(action, 'GUEST_CALENDAR_STORAGE_UNAVAILABLE', '이 브라우저에서 일정 저장소를 사용할 수 없습니다.');
  }
  if (!lockManager || typeof lockManager.request !== 'function') {
    return failed(action, 'GUEST_CALENDAR_LOCK_UNAVAILABLE', '이 브라우저에서 안전한 중복 방지 기능을 사용할 수 없습니다.');
  }

  const candidate = action.candidate;
  try {
    const event = await lockManager.request(
      `lotbi-calendar-action:${candidate.actionId}`,
      {mode: 'exclusive'},
      async () => {
        const repository = createGuestCalendarRepository(storage, guestRepositoryOptions);
        return repository.createForAction(candidate.actionId, candidate.candidateId, {
          title: candidate.title,
          local_date: candidate.temporal.localDatetime.slice(0, 10),
          local_datetime: candidate.temporal.localDatetime,
          all_day: false,
        });
      },
    );
    if (!event || !GUEST_EVENT_ID_RE.test(String(event.id || ''))) {
      return failed(action, 'GUEST_CALENDAR_RESULT_INVALID', '일정 저장 결과를 확인하지 못했습니다.');
    }
    return Object.freeze({
      ...action,
      state: 'SUCCESS',
      result: Object.freeze({
        guestEventId: event.id,
        dateHint: event.local_date,
        timezone: candidate.temporal.timezoneName,
        title: event.title,
      }),
      lastError: null,
    });
  } catch (error) {
    return failed(action, error?.code || 'GUEST_CALENDAR_WRITE_FAILED', error instanceof Error ? error.message : '이 브라우저에 일정을 저장하지 못했습니다.');
  }
}

export async function runCalendarAction(actionValue, {
  sessionToken = '',
  currentNamespace = '',
  storage = globalThis.localStorage,
  lockManager = globalThis.navigator?.locks,
  verifyIdentity = getCurrentSiteUser,
  createAuthActivity = createLifeActivity,
  fetchImpl = globalThis.fetch,
  guestRepositoryOptions,
} = {}) {
  const action = normalizePersistedCalendarAction(actionValue);
  if (!action) return null;
  if (action.state === 'SUCCESS' || action.state === 'DELETED') return action;
  if (action.scope === 'AUTH') {
    return runAuthenticated(action, {
      sessionToken,
      currentNamespace,
      verifyIdentity,
      createAuthActivity,
      fetchImpl,
    });
  }
  return runGuest(action, {
    currentNamespace,
    storage,
    lockManager,
    guestRepositoryOptions,
  });
}

export {normalizeCandidate as normalizeCalendarCandidateForAction};
