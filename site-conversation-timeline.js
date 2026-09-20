export const CONVERSATION_SEGMENT_GAP_MS = 30 * 60 * 1000;

function epoch(value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function shiftedDate(value, offsetMinutes) {
  return new Date(value + offsetMinutes * 60 * 1000);
}

function dayKey(value, offsetMinutes) {
  const date = shiftedDate(value, offsetMinutes);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function localOffsetMinutes(value) {
  return -new Date(value).getTimezoneOffset();
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
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : localOffsetMinutes(current);
  return dayKey(previous, offset) !== dayKey(current, offset) || current - previous >= CONVERSATION_SEGMENT_GAP_MS;
}

export function formatConversationTimestamp(createdAt, {now = Date.now(), offsetMinutes} = {}) {
  const value = epoch(createdAt);
  const reference = epoch(now);
  if (!value || !reference) return '';
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : localOffsetMinutes(value);
  const date = shiftedDate(value, offset);
  const valueDay = dayKey(value, offset);
  const hour = date.getUTCHours();
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  const time = `${period} ${displayHour}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  if (valueDay === dayKey(reference, offset)) return `오늘 ${time}`;
  if (valueDay === dayKey(reference - 24 * 60 * 60 * 1000, offset)) return `어제 ${time}`;
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${time}`;
}
