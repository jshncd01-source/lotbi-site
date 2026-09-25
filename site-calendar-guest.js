import {sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=aset-cd3ebf85a56e';

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
  constructor(message, code, options) {
    super(message, options);
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
  const localEndDatetime = allDay || input?.local_end_datetime == null ? null : String(input.local_end_datetime);
  const endMatch = localEndDatetime === null ? null : LOCAL_DATETIME_PATTERN.exec(localEndDatetime);
  const localEndDate = typeof input?.local_end_date === 'string' && input.local_end_date ? input.local_end_date : localEndDatetime?.slice(0, 10) || null;
  if (
    !title
    || title.length > 240
    || (localDate !== null && !validCivilDate(localDate))
    || (localDate === null && localDatetime !== null)
    || (localDatetime !== null && (!match || match[1] !== localDate))
    || (localEndDatetime !== null && (!endMatch || localDatetime === null || localEndDatetime <= localDatetime))
    || (localEndDate !== null && (!validCivilDate(localEndDate) || localDate === null || localEndDate < localDate || (localEndDatetime !== null && localEndDate !== endMatch?.[1])))
  ) throw invalidInput();
  return {
    title,
    local_date: localDate,
    local_datetime: localDatetime,
    local_end_datetime: localEndDatetime,
    local_end_date: localEndDate,
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

// A signed-out calendar lives in this browser's storage, and that storage can
// refuse the write: secret/private mode on some Android browsers, site data
// blocked, or the origin simply full. The refusal arrives as a DOMException
// whose message is English and about quotas, which is no help to someone who
// just wants their entry kept. Say what happened and what they can do instead.
function writeState(storage, events, createdCount) {
  try {
    storage.setItem(GUEST_CALENDAR_STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      created_count: createdCount,
      events,
    }));
  } catch (cause) {
    throw new GuestCalendarError(
      '이 브라우저에 일정을 저장하지 못했어요. 시크릿 모드를 끄거나 저장 공간을 비운 뒤 다시 시도해 주세요. 로그인하면 계정에 바로 저장됩니다.',
      'GUEST_CALENDAR_STORAGE_UNAVAILABLE',
      {cause},
    );
  }
}

// Every guest entry needs a v4-shaped id, and for a while the only way we made
// one was crypto.randomUUID(). That method does not exist in Samsung Internet
// before 16 or in older Android WebViews, so on those browsers a guest filled
// the whole form, pressed 저장, and got "일정 식별자를 만들 수 없습니다." —
// an internal word for a problem they had no way to act on. Making the id is
// our job, not theirs, so it now falls back instead of failing.
//
// Three tiers, best first. Every tier returns the same v4 shape, so the id is
// indistinguishable downstream and GUEST_ID_PATTERN accepts all of them.
let uuidCounter = Math.floor(Math.random() * 0x10000);

function randomBytes16() {
  const bytes = new Uint8Array(16);
  // Tier 2: no randomUUID, but getRandomValues has been everywhere since long
  // before it. Same entropy, just spelled out by hand.
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  // Tier 3: no Web Crypto at all. Math.random is not cryptographic, and this id
  // is not a secret — it only has to not collide. Time and a per-page counter
  // are mixed in so two ids made in the same millisecond still differ even if
  // Math.random is seeded badly.
  const stamp = Date.now();
  const seq = (uuidCounter = (uuidCounter + 1) & 0xffff);
  for (let index = 0; index < 16; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[0] ^= (stamp / 0x1000000) & 0xff;
  bytes[1] ^= (stamp >>> 16) & 0xff;
  bytes[2] ^= (stamp >>> 8) & 0xff;
  bytes[3] ^= stamp & 0xff;
  bytes[4] ^= (seq >>> 8) & 0xff;
  bytes[5] ^= seq & 0xff;
  return bytes;
}

function uuidV4FromBytes(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [];
  for (let index = 0; index < 16; index += 1) hex.push(bytes[index].toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function defaultUuid() {
  // Tier 1: the browser's own generator, when it has one.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Some WebViews expose randomUUID outside a secure context and throw on
      // call. Falling through is better than surfacing that to the writer.
    }
  }
  return uuidV4FromBytes(randomBytes16());
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
    if (!GUEST_ID_PATTERN.test(id)) {
      throw new GuestCalendarError(
        '일정을 저장하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
        'GUEST_CALENDAR_UUID_INVALID',
      );
    }
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
        || (previous.local_end_datetime ?? null) !== normalized.local_end_datetime
        || (previous.local_end_date ?? null) !== normalized.local_end_date
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
        || (previous.local_end_datetime ?? null) !== normalized.local_end_datetime
        || (previous.local_end_date ?? null) !== normalized.local_end_date
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
