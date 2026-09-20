import {sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=20260920-calux1';

export const GUEST_CALENDAR_STORAGE_KEY = 'lotbi.guest.calendar.v1';
const SCHEMA_VERSION = 1;
const DEFAULT_LIMIT = 500;
const GUEST_ID_PATTERN = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

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

function normalizeEventInput(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const localDate = typeof input?.local_date === 'string' ? input.local_date : '';
  const allDay = input?.all_day === true;
  const localDatetime = allDay || input?.local_datetime == null ? null : String(input.local_datetime);
  const match = localDatetime === null ? null : LOCAL_DATETIME_PATTERN.exec(localDatetime);
  if (
    !title
    || title.length > 240
    || !validCivilDate(localDate)
    || (!allDay && (!match || match[1] !== localDate))
  ) throw invalidInput();
  return {title, local_date: localDate, local_datetime: localDatetime, all_day: allDay};
}

function safeStoredEvent(value) {
  if (!value || typeof value !== 'object' || !GUEST_ID_PATTERN.test(String(value.id || ''))) return null;
  let normalized;
  try { normalized = normalizeEventInput(value); } catch { return null; }
  if (typeof value.created_at !== 'string' || typeof value.updated_at !== 'string') return null;
  return Object.freeze({id: value.id, ...normalized, created_at: value.created_at, updated_at: value.updated_at});
}

function readState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(GUEST_CALENDAR_STORAGE_KEY) || 'null');
    if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.events)) return [];
    return parsed.events.map(safeStoredEvent).filter(Boolean);
  } catch {
    return [];
  }
}

function writeState(storage, events) {
  storage.setItem(GUEST_CALENDAR_STORAGE_KEY, JSON.stringify({version: SCHEMA_VERSION, events}));
}

function defaultUuid() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new GuestCalendarError('일정 식별자를 만들 수 없습니다.', 'GUEST_CALENDAR_UUID_UNAVAILABLE');
  return globalThis.crypto.randomUUID();
}

export function createGuestCalendarRepository(
  storage,
  {limit = DEFAULT_LIMIT, uuid = defaultUuid, now = () => new Date()} = {},
) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('storage must implement getItem and setItem');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('limit must be between 1 and 1000');

  const list = () => Object.freeze(sortCalendarEvents(readState(storage)).map(event => Object.freeze({...event})));

  const create = input => {
    const events = readState(storage);
    if (events.length >= limit) {
      throw new GuestCalendarError('이 브라우저에 저장할 수 있는 일정 수에 도달했습니다.', 'GUEST_CALENDAR_LIMIT_REACHED');
    }
    const normalized = normalizeEventInput(input);
    const stamp = now().toISOString();
    const id = `guest_${uuid()}`;
    if (!GUEST_ID_PATTERN.test(id)) throw new GuestCalendarError('일정 식별자가 올바르지 않습니다.', 'GUEST_CALENDAR_UUID_INVALID');
    const event = Object.freeze({id, ...normalized, created_at: stamp, updated_at: stamp});
    writeState(storage, [...events, event]);
    return event;
  };

  const update = (id, input) => {
    const events = readState(storage);
    const index = events.findIndex(event => event.id === id);
    if (index < 0) throw new GuestCalendarError('일정을 찾을 수 없습니다.', 'GUEST_CALENDAR_NOT_FOUND');
    const previous = events[index];
    const event = Object.freeze({
      id: previous.id,
      ...normalizeEventInput(input),
      created_at: previous.created_at,
      updated_at: now().toISOString(),
    });
    events[index] = event;
    writeState(storage, events);
    return event;
  };

  const remove = id => {
    const events = readState(storage);
    const next = events.filter(event => event.id !== id);
    if (next.length === events.length) return false;
    writeState(storage, next);
    return true;
  };

  return Object.freeze({list, create, update, remove});
}
