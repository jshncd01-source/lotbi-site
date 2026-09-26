// Turning a Calendar draft read off an attachment into a real Calendar entry.
//
// The owner has already seen what was read and pressed 등록. All that is left is
// to say the same thing to the Calendar that the Calendar screen would say — the
// same POST /v2/life/activities, the same canonical temporal contract — so an
// entry born from a screenshot is in every respect an ordinary entry afterwards.
//
// Two things make this more than a passthrough:
//
//   * A stay, a flight and a rental have two ends, and the draft now carries
//     both. The canonical contract has had TIME_WINDOW and DATE_RANGE all along;
//     this is where a check-in and a check-out become one of them.
//   * The write identity is derived from the booking, not from the moment the
//     button was pressed. Core hashes what it extracted — who, where, from when,
//     until when — and that hash becomes the logical_request_id. Core already
//     replays a repeated logical_request_id instead of writing twice, so a
//     double-tap, a reload-and-retry and the same confirmation photographed
//     again all land on the one entry without any of them knowing about each
//     other.
import {createLifeActivity} from './site-calendar.js?v=aset-e8f1efd3a007';
import {SiteCoreError} from './site-core.js?v=aset-e8f1efd3a007';

const FINGERPRINT_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE_RE = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/;

export const CALENDAR_DRAFT_WRITE_STATE = Object.freeze({
  REGISTERED: 'REGISTERED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
});

/** The write identity for one engagement, stable across retries and re-uploads. */
export function calendarDraftLogicalRequestId(draft) {
  const fingerprint = String(draft?.dedupeFingerprint || '').trim().toLowerCase();
  if (!FINGERPRINT_RE.test(fingerprint)) return null;
  // 7 + 40 = 47 characters, inside Core's 8..80 window and its allowed alphabet.
  return `calimg-${fingerprint.slice(0, 40)}`;
}

/**
 * The canonical temporal value for a draft, or null when there is no date.
 *
 * Nothing here invents a time. A booking that stated only a check-in day is a
 * DATE_ONLY entry, and a booking that stated only a check-in day and a check-out
 * day is a DATE_RANGE — neither acquires a clock time it never had.
 */
export function calendarDraftTemporal(draft, timezone) {
  const zone = String(timezone || '').trim();
  const startDate = String(draft?.localDate || '').trim();
  const startTime = String(draft?.localTime || '').trim();
  const endDate = String(draft?.endLocalDate || '').trim();
  const endTime = String(draft?.endLocalTime || '').trim();
  if (!DATE_RE.test(startDate) || !TIMEZONE_RE.test(zone)) return null;

  const hasStartTime = TIME_RE.test(startTime);
  const hasEnd = DATE_RE.test(endDate) && endDate >= startDate;
  const hasEndTime = hasEnd && TIME_RE.test(endTime);

  if (hasStartTime && hasEndTime) {
    const windowStart = `${startDate}T${startTime}:00`;
    const windowEnd = `${endDate}T${endTime}:00`;
    // Core rejects a window that does not move forward, and it is right to. A
    // same-instant pair is a misread, so it degrades to the one time we are sure
    // of rather than becoming an error the owner cannot act on.
    if (windowEnd > windowStart) {
      return {kind: 'TIME_WINDOW', window_start: windowStart, window_end: windowEnd, timezone_name: zone};
    }
  }
  if (hasStartTime) {
    return {kind: 'LOCAL_DATE_TIME', local_datetime: `${startDate}T${startTime}:00`, timezone_name: zone};
  }
  if (hasEnd && endDate > startDate) {
    return {kind: 'DATE_RANGE', local_date: startDate, date_end: endDate, timezone_name: zone};
  }
  return {kind: 'DATE_ONLY', local_date: startDate};
}

/** The date the entry should make the Calendar jump to. */
export function calendarDraftDateHint(draft) {
  const startDate = String(draft?.localDate || '').trim();
  return DATE_RE.test(startDate) ? startDate : '';
}

function entryPayload(draft) {
  const entry = draft?.entry || {};
  const payload = {};
  if (typeof entry.place === 'string' && entry.place.trim()) payload.place = entry.place.trim();
  if (typeof entry.merchant === 'string' && entry.merchant.trim()) payload.merchant = entry.merchant.trim();
  if (Number.isSafeInteger(entry.amountMinor) && entry.amountMinor >= 0) {
    payload.amountMinor = entry.amountMinor;
    payload.currency = entry.currency || 'KRW';
    if (entry.expenseCategory) payload.expenseCategory = entry.expenseCategory;
  }
  // memo is deliberately left out of the one-tap write. It is the field a
  // document's own text lands in, so it is both the likeliest place for a
  // booking number or a phone number to survive and the likeliest thing to
  // differ between two photographs of one booking. Whoever wants a note can add
  // one in the editor afterwards.
  return payload;
}

function failure(code, message, state = CALENDAR_DRAFT_WRITE_STATE.FAILED) {
  return Object.freeze({
    state,
    result: null,
    error: Object.freeze({
      code: String(code || 'CALENDAR_DRAFT_WRITE_FAILED').slice(0, 96),
      message: String(message || '일정을 등록하지 못했습니다.').slice(0, 240),
    }),
  });
}

/**
 * Write one reviewed draft to the Calendar.
 *
 * Never throws: the caller is a card inside a conversation, and a conversation
 * that breaks because a save failed is a worse outcome than a save that failed.
 */
export async function registerCalendarDraft(draft, {
  sessionToken = '',
  timezone = '',
  createAuthActivity = createLifeActivity,
  fetchImpl = globalThis.fetch,
} = {}) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) return failure('SITE_SESSION_REQUIRED', 'LOTBI 로그인이 필요합니다.');

  const title = String(draft?.title || '').trim();
  if (!title || title.length > 240) {
    return failure('CALENDAR_DRAFT_TITLE_MISSING', '이미지에서 일정 제목을 읽지 못했습니다.');
  }
  const temporal = calendarDraftTemporal(draft, timezone);
  if (!temporal) {
    return failure('CALENDAR_DRAFT_DATE_MISSING', '이미지에서 날짜를 읽지 못했습니다.');
  }
  const logicalRequestId = calendarDraftLogicalRequestId(draft);
  if (!logicalRequestId) {
    return failure('CALENDAR_DRAFT_IDENTITY_MISSING', '이 초안은 중복 확인을 할 수 없어 등록하지 않았습니다.');
  }

  try {
    const result = await createAuthActivity(token, {
      logicalRequestId,
      title,
      temporal,
      temporalSemantics: 'USER_PLANNED_TIME',
      busy: 'UNKNOWN',
      entry: entryPayload(draft),
    }, fetchImpl);
    if (!result?.readYourWrites || !result.activityId || !result.occurrenceId) {
      return failure('LIFE_MUTATION_CONTRACT_INVALID', '일정 저장 결과를 확인하지 못했습니다.');
    }
    return Object.freeze({
      state: CALENDAR_DRAFT_WRITE_STATE.REGISTERED,
      result: Object.freeze({
        activityId: result.activityId,
        occurrenceId: result.occurrenceId,
        dateHint: calendarDraftDateHint(draft),
        timezone: String(timezone || '').trim(),
        title: result.title || title,
      }),
      error: null,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    const code = String(error?.code || '');
    // 409 on this route means the Calendar already holds this engagement: either
    // the identical write replayed, or the same booking was saved earlier from a
    // screenshot that read one field differently. Both mean the owner has it,
    // and neither is something to apologise for.
    if (status === 409 || code.startsWith('IDEMPOTENCY_')) {
      return Object.freeze({
        state: CALENDAR_DRAFT_WRITE_STATE.ALREADY_REGISTERED,
        result: null,
        error: null,
      });
    }
    if (code === 'LIFE_CALENDAR_NETWORK_ERROR' || status >= 500 || (status === 0 && error?.retryable === true)) {
      return failure(
        code || 'CALENDAR_DRAFT_RESULT_UNKNOWN',
        '등록 결과를 확인하지 못했습니다. 캘린더에서 확인해 주세요.',
        CALENDAR_DRAFT_WRITE_STATE.UNKNOWN,
      );
    }
    return failure(
      code || 'CALENDAR_DRAFT_WRITE_FAILED',
      error instanceof SiteCoreError && error.message ? error.message : '일정을 등록하지 못했습니다.',
    );
  }
}
