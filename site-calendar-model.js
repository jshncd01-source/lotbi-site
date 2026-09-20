const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertYear(year) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError('year must be between 1 and 9999');
}

function assertMonth(month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('month must be between 1 and 12');
}

function utcCivilDate(year, month, day) {
  const value = new Date(0);
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value;
}

export function formatCivilDate(year, month, day) {
  assertYear(year);
  assertMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError('day must be between 1 and 31');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function validCivilDate(value) {
  const match = DATE_PATTERN.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const date = utcCivilDate(year, month, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function civilDateParts(value) {
  if (!validCivilDate(value)) throw new RangeError('invalid civil date');
  const [year, month, day] = value.split('-').map(Number);
  return {year, month, day};
}

export function addCivilDays(value, days) {
  if (!Number.isInteger(days)) throw new TypeError('days must be an integer');
  const {year, month, day} = civilDateParts(value);
  const date = utcCivilDate(year, month, day + days);
  return formatCivilDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function calendarMonthGrid(year, month) {
  assertYear(year);
  assertMonth(month);
  const first = utcCivilDate(year, month, 1);
  const gridStart = utcCivilDate(year, month, 1 - first.getUTCDay());
  return Object.freeze(Array.from({length: 42}, (_, index) => {
    const date = new Date(gridStart.getTime());
    date.setUTCDate(gridStart.getUTCDate() + index);
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return Object.freeze({
      date: formatCivilDate(cellYear, cellMonth, day),
      year: cellYear,
      month: cellMonth,
      day,
      weekday: date.getUTCDay(),
      inCurrentMonth: cellYear === year && cellMonth === month,
    });
  }));
}

export function monthGridRange(year, month) {
  const cells = calendarMonthGrid(year, month);
  return Object.freeze({start: cells[0].date, end: cells[cells.length - 1].date});
}

export function calendarYearOverview(year) {
  assertYear(year);
  return Object.freeze(Array.from({length: 12}, (_, index) => Object.freeze({
    year,
    month: index + 1,
    label: `${index + 1}월`,
    cells: calendarMonthGrid(year, index + 1),
  })));
}

function eventDate(event) {
  return typeof event?.local_date === 'string' ? event.local_date : '';
}

function eventTime(event) {
  return typeof event?.local_datetime === 'string' ? event.local_datetime : '';
}

export function sortCalendarEvents(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const dateOrder = eventDate(left).localeCompare(eventDate(right));
    if (dateOrder) return dateOrder;
    const leftAllDay = left?.all_day === true || !eventTime(left);
    const rightAllDay = right?.all_day === true || !eventTime(right);
    if (leftAllDay !== rightAllDay) return leftAllDay ? -1 : 1;
    const timeOrder = eventTime(left).localeCompare(eventTime(right));
    if (timeOrder) return timeOrder;
    return String(left?.title || '').localeCompare(String(right?.title || ''), 'ko');
  });
}

export function groupCalendarEvents(items) {
  const groups = new Map();
  for (const event of sortCalendarEvents(items)) {
    const date = eventDate(event);
    if (!validCivilDate(date)) continue;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(event);
  }
  return groups;
}
