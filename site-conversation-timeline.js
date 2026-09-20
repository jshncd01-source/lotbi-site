export const CONVERSATION_SEGMENT_GAP_MS = 30 * 60 * 1000;

function epoch(value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function shiftedDate(value, offsetMinutes) {
  return new Date(value + offsetMinutes * 60 * 1000);
}

function dayKey(value, offsetMinutes) {
  if (Number.isFinite(offsetMinutes)) {
    const date = shiftedDate(value, offsetMinutes);
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  }
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function previousLocalDay(value, offsetMinutes) {
  if (Number.isFinite(offsetMinutes)) return value - 24 * 60 * 60 * 1000;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  return date.getTime();
}

export function timestampedConversationMessage(message, createdAt = Date.now()) {
  const existing = epoch(message?.createdAt);
  return existing ? {...message, createdAt: existing} : {...message, createdAt: epoch(createdAt) || Date.now()};
}

export function shouldShowConversationSeparator(previousCreatedAt, createdAt, {offsetMinutes} = {}) {
  const current = epoch(createdAt);
  if (!current) return false;
  const previous = epoch(previousCreatedAt);
  if (!previous) return true;
  return dayKey(previous, offsetMinutes) !== dayKey(current, offsetMinutes) || current - previous >= CONVERSATION_SEGMENT_GAP_MS;
}

export function formatConversationTimestamp(createdAt, {now = Date.now(), offsetMinutes} = {}) {
  const value = epoch(createdAt);
  const reference = epoch(now);
  if (!value || !reference) return '';
  const fixedOffset = Number.isFinite(offsetMinutes);
  const date = fixedOffset ? shiftedDate(value, offsetMinutes) : new Date(value);
  const valueDay = dayKey(value, offsetMinutes);
  const hour = fixedOffset ? date.getUTCHours() : date.getHours();
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  const minute = fixedOffset ? date.getUTCMinutes() : date.getMinutes();
  const year = fixedOffset ? date.getUTCFullYear() : date.getFullYear();
  const month = fixedOffset ? date.getUTCMonth() : date.getMonth();
  const day = fixedOffset ? date.getUTCDate() : date.getDate();
  const time = `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
  if (valueDay === dayKey(reference, offsetMinutes)) return `오늘 ${time}`;
  const previousDay = previousLocalDay(reference, offsetMinutes);
  if (valueDay === dayKey(previousDay, offsetMinutes)) return `어제 ${time}`;
  return `${year}년 ${month + 1}월 ${day}일 ${time}`;
}

export function millisecondsUntilNextLocalMidnight(now = Date.now(), {offsetMinutes} = {}) {
  const reference = epoch(now);
  if (!reference) return 0;
  if (Number.isFinite(offsetMinutes)) {
    const local = shiftedDate(reference, offsetMinutes);
    const nextLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
    return Math.max(1, nextLocalMidnight - offsetMinutes * 60 * 1000 - reference);
  }
  const next = new Date(reference);
  next.setHours(24, 0, 0, 0);
  return Math.max(1, next.getTime() - reference);
}
