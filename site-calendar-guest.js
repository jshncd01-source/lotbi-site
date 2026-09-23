import {sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=20260921-smartcaldraft1';

export const GUEST_CALENDAR_STORAGE_KEY = 'lotbi.guest.calendar.v1';
const SCHEMA_VERSION = 2;
const DEFAULT_LIMIT = 500;

// How many entries this browser may create without an account. Change this one
// number and nothing else — it is the only place the figure lives.
//
// It counts creations, not entries held. Deleting an entry does not give the
// count back, so a guest cannot recycle the same three slots forever. What they
// already made stays fully theirs: reading, editing and deleting are untouched.
export const GUEST_CREATE_QUOTA = 3;
const GUEST_ID_PATTERN = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const CALENDAR_ACTION_ID_PATTERN = /^calact_[0-9a-f]{24}$/;
const CALENDAR_CANDIDATE_ID_PATTERN = /^calcand_[0-9a-f]{24}$/;
const CALENDAR_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

class GuestCalendarError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GuestCalendarError';
    this.code = code;
  }
}

function invalidInput() {
  return new GuestCalendarError('일정 입력값이 올바르지 않습니다.', 'GUEST_CALENDAR_INPUT_INVALID');
}

// The same six the editor's dropdown offers. A guest can pick 기타 there, and
// without OTHER here that pick came back as "일정 입력값이 올바르지 않습니다."
const EXPENSE_CATEGORIES = new Set(['FOOD', 'TRAVEL', 'SHOPPING', 'LIVING', 'OTHER', 'UNCLASSIFIED']);

function optionalText(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized.length > maxLength) throw invalidInput();
  return normalized;
}

function normalizeEntry(input) {
  const source = input && typeof input === 'object' ? input : {};
  const rawAmount = source.amount_minor;
  const amount = rawAmount === '' || rawAmount == null ? null : Number(rawAmount);
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000)) throw invalidInput();
  let category = typeof source.expense_category === 'string' && source.expense_category ? source.expense_category : null;
  if (category !== null && !EXPENSE_CATEGORIES.has(category)) throw invalidInput();
  if (amount !== null && category === null) category = 'UNCLASSIFIED';
  const currency = typeof source.currency === 'string' && source.currency.trim() ? source.currency.trim().toUpperCase() : 'KRW';
  if (!/^[A-Z]{3}$/.test(currency)) throw invalidInput();
  return Object.freeze({
    amount_minor: amount,
    currency,
    expense_category: category,
    memo: optionalText(source.memo, 2000),
    place: optionalText(source.place, 240),
    merchant: optionalText(source.merchant, 240),
  });
}

function normalizeEventInput(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const rawDate = typeof input?.local_date === 'string' ? input.local_date.trim() : '';
  const localDate = rawDate || null;
  const allDay = localDate !== null && input?.all_day === true;
  const localDatetime = allDay || input?.local_datetime == null ? null : String(input.local_datetime);
  const match = localDatetime === null ? null : LOCAL_DATETIME_PATTERN.exec(localDatetime);
  if (
    !title
    || title.length > 240
    || (localDate !== null && !validCivilDate(localDate))
    || (localDate === null && localDatetime !== null)
    || (localDatetime !== null && (!match || match[1] !== localDate))
  ) throw invalidInput();
  return {
    title,
    local_date: localDate,
    local_datetime: localDatetime,
    all_day: allDay,
    entry: normalizeEntry(input?.entry),
  };
}

function safeStoredEvent(value) {
  if (!value || typeof value !== 'object' || !GUEST_ID_PATTERN.test(String(value.id || ''))) return null;
  let normalized;
  try { normalized = normalizeEventInput(value); } catch { return null; }
  if (typeof value.created_at !== 'string' || typeof value.updated_at !== 'string') return null;
  const actionId = value.calendar_action_id == null ? '' : String(value.calendar_action_id);
  const candidateId = value.calendar_candidate_id == null ? '' : String(value.calendar_candidate_id);
  const requestId = value.calendar_request_id == null ? '' : String(value.calendar_request_id);
  if ((actionId || candidateId) && (!CALENDAR_ACTION_ID_PATTERN.test(actionId) || !CALENDAR_CANDIDATE_ID_PATTERN.test(candidateId))) return null;
  if (requestId && !CALENDAR_REQUEST_ID_PATTERN.test(requestId)) return null;
  return Object.freeze({
    id: value.id,
    ...normalized,
    ...(actionId ? {calendar_action_id: actionId, calendar_candidate_id: candidateId} : {}),
    ...(requestId ? {calendar_request_id: requestId} : {}),
    created_at: value.created_at,
    updated_at: value.updated_at,
  });
}

// `created_count` is added to the stored shape without moving SCHEMA_VERSION.
// That is deliberate. A browser still running the previous bundle checks the
// version, finds 2, reads the events exactly as before and ignores the extra
// key. Bumping to 3 would have made every stored entry unreadable to that
// bundle — a guest would open the calendar and find their schedule gone, which
// is the single worst thing this change could do.
function storedCreatedCount(raw, eventCount) {
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : eventCount;
  // Storage written before the counter existed carries no count. The honest
  // floor for it is what is sitting there now: you cannot be holding more
  // entries than you ever created.
  return Math.max(value, eventCount);
}

// Never throws. A storage that cannot be read reports an empty calendar with a
// spent count of zero, so a broken read fails towards letting the guest work
// rather than towards telling them they are out of entries.
function readState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(GUEST_CALENDAR_STORAGE_KEY) || 'null');
    if (!parsed || ![1, SCHEMA_VERSION].includes(parsed.version) || !Array.isArray(parsed.events)) {
      return {events: [], createdCount: 0};
    }
    const events = parsed.events.map(safeStoredEvent).filter(Boolean);
    return {events, createdCount: storedCreatedCount(parsed.created_count, events.length)};
  } catch {
    return {events: [], createdCount: 0};
  }
}

function writeState(storage, events, createdCount) {
  storage.setItem(GUEST_CALENDAR_STORAGE_KEY, JSON.stringify({
    version: SCHEMA_VERSION,
    created_count: createdCount,
    events,
  }));
}

function defaultUuid() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new GuestCalendarError('일정 식별자를 만들 수 없습니다.', 'GUEST_CALENDAR_UUID_UNAVAILABLE');
  return globalThis.crypto.randomUUID();
}

export function createGuestCalendarRepository(
  storage,
  {limit = DEFAULT_LIMIT, createQuota = GUEST_CREATE_QUOTA, uuid = defaultUuid, now = () => new Date()} = {},
) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('storage must implement getItem and setItem');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('limit must be between 1 and 1000');
  if (!Number.isInteger(createQuota) || createQuota < 1 || createQuota > 1000) {
    throw new RangeError('createQuota must be between 1 and 1000');
  }

  const list = () => Object.freeze(sortCalendarEvents(readState(storage).events).map(event => Object.freeze({...event})));

  // What the composer needs to decide whether to warn, and what to say once
  // there is nothing left. Reading it costs nothing and never throws.
  const quotaStatus = () => {
    const {createdCount} = readState(storage);
    return Object.freeze({
      quota: createQuota,
      createdCount,
      remaining: Math.max(0, createQuota - createdCount),
      exhausted: createdCount >= createQuota,
    });
  };

  const createEvent = (state, input, metadata = {}) => {
    // Validate first. A malformed entry is malformed whether or not there is
    // room for it, and saying "you are out of entries" to someone whose title
    // was blank sends them chasing the wrong problem. It also means garbage
    // can never spend one of the three.
    const normalized = normalizeEventInput(input);

    // Two guards that are not the same thing, and neither replaces the other.
    //
    // createQuota is the product rule: how many entries this browser has EVER
    // created. It only ever rises, so deleting does not buy another create.
    if (state.createdCount >= createQuota) {
      throw new GuestCalendarError(
        `로그인 없이 등록할 수 있는 일정 ${createQuota}개를 모두 사용했어요. 로그인하면 계속 등록할 수 있습니다.`,
        'GUEST_CALENDAR_CREATE_QUOTA_REACHED',
      );
    }
    // limit is a storage safety valve: how many entries are HELD at once, so a
    // runaway writer cannot fill the browser's storage. It is not a product
    // rule and it is not the thing a guest normally meets.
    if (state.events.length >= limit) {
      throw new GuestCalendarError('이 브라우저에 저장할 수 있는 일정 수에 도달했습니다.', 'GUEST_CALENDAR_LIMIT_REACHED');
    }

    const stamp = now().toISOString();
    const id = `guest_${uuid()}`;
    if (!GUEST_ID_PATTERN.test(id)) throw new GuestCalendarError('일정 식별자가 올바르지 않습니다.', 'GUEST_CALENDAR_UUID_INVALID');
    const event = Object.freeze({id, ...normalized, ...metadata, created_at: stamp, updated_at: stamp});
    // The count rises in the same write that stores the event: a write that
    // fails spends nothing, and one that succeeds cannot be replayed for free.
    writeState(storage, [...state.events, event], state.createdCount + 1);
    return event;
  };

  const create = input => createEvent(readState(storage), input);

  const createForAction = (actionId, candidateId, input) => {
    const normalizedActionId = String(actionId || '').trim();
    const normalizedCandidateId = String(candidateId || '').trim();
    if (!CALENDAR_ACTION_ID_PATTERN.test(normalizedActionId) || !CALENDAR_CANDIDATE_ID_PATTERN.test(normalizedCandidateId)) {
      throw new GuestCalendarError('일정 액션 식별자가 올바르지 않습니다.', 'GUEST_CALENDAR_ACTION_INVALID');
    }
    const state = readState(storage);
    const previous = state.events.find(event => event.calendar_action_id === normalizedActionId);
    // A replay of the same action is the entry that already exists, not a new
    // one. It returns before createEvent, so it neither spends a create nor
    // fails once the three are gone — a reloaded page must still resolve it.
    if (previous) {
      if (previous.calendar_candidate_id !== normalizedCandidateId) {
        throw new GuestCalendarError('같은 일정 액션의 내용이 달라졌습니다.', 'GUEST_CALENDAR_ACTION_CONFLICT');
      }
      const normalized = normalizeEventInput(input);
      if (
        previous.title !== normalized.title
        || previous.local_date !== normalized.local_date
        || previous.local_datetime !== normalized.local_datetime
        || previous.all_day !== normalized.all_day
        || JSON.stringify(previous.entry || {}) !== JSON.stringify(normalized.entry)
      ) {
        throw new GuestCalendarError('같은 일정 액션의 저장 내용이 달라졌습니다.', 'GUEST_CALENDAR_ACTION_CONFLICT');
      }
      return previous;
    }
    return createEvent(state, input, {
      calendar_action_id: normalizedActionId,
      calendar_candidate_id: normalizedCandidateId,
    });
  };

  const createForRequest = (requestId, input) => {
    const normalizedRequestId = String(requestId || '').trim();
    if (!CALENDAR_REQUEST_ID_PATTERN.test(normalizedRequestId)) {
      throw new GuestCalendarError('일정 요청 식별자가 올바르지 않습니다.', 'GUEST_CALENDAR_REQUEST_INVALID');
    }
    const state = readState(storage);
    const previous = state.events.find(event => event.calendar_request_id === normalizedRequestId);
    // Same shape as createForAction: a repeat of the same request is the entry
    // already stored, so it costs nothing and keeps working when the quota is
    // spent.
    if (previous) {
      const normalized = normalizeEventInput(input);
      if (
        previous.title !== normalized.title
        || previous.local_date !== normalized.local_date
        || previous.local_datetime !== normalized.local_datetime
        || previous.all_day !== normalized.all_day
        || JSON.stringify(previous.entry || {}) !== JSON.stringify(normalized.entry)
      ) {
        throw new GuestCalendarError('같은 일정 요청의 저장 내용이 달라졌습니다.', 'GUEST_CALENDAR_REQUEST_CONFLICT');
      }
      return previous;
    }
    return createEvent(state, input, {calendar_request_id: normalizedRequestId});
  };

  const update = (id, input) => {
    const {events, createdCount} = readState(storage);
    const index = events.findIndex(event => event.id === id);
    if (index < 0) throw new GuestCalendarError('일정을 찾을 수 없습니다.', 'GUEST_CALENDAR_NOT_FOUND');
    const previous = events[index];
    const event = Object.freeze({
      id: previous.id,
      ...normalizeEventInput(input),
      ...(previous.calendar_action_id ? {
        calendar_action_id: previous.calendar_action_id,
        calendar_candidate_id: previous.calendar_candidate_id,
      } : {}),
      ...(previous.calendar_request_id ? {calendar_request_id: previous.calendar_request_id} : {}),
      created_at: previous.created_at,
      updated_at: now().toISOString(),
    });
    events[index] = event;
    // Editing carries the count across unchanged. Rewriting an entry is not a
    // new one, and it is not a refund either.
    writeState(storage, events, createdCount);
    return event;
  };

  const remove = id => {
    const {events, createdCount} = readState(storage);
    const next = events.filter(event => event.id !== id);
    if (next.length === events.length) return false;
    // The count is carried over on purpose. Deleting frees the slot in storage
    // but not the create that was spent to fill it — otherwise three entries
    // could be recycled without end.
    writeState(storage, next, createdCount);
    return true;
  };

  return Object.freeze({list, quotaStatus, create, createForAction, createForRequest, update, remove});
}
