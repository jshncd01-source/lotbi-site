// Pure Calendar presentation decisions shared by Week, Month, and Schedule.
// These labels are derived at read time; no inferred kind or state is stored.
import {addCivilDays, civilDateParts, groupCalendarEvents, sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=aset-f4726caf5abb';
import {weatherPrecipitationLabel, weatherTemperatureLabel} from './site-calendar-weather.js?v=aset-f4726caf5abb';
import {expenseCategoryLabel, formatExpenseAmount} from './site-calendar-expense.js?v=aset-f4726caf5abb';

function weekStartDate(date, weekStart) {
  const {year, month, day} = civilDateParts(date);
  if (!Number.isInteger(weekStart) || weekStart < 0 || weekStart > 6) {
    throw new RangeError('weekStart must be a weekday index between 0 and 6');
  }
  const clock = new Date(0);
  clock.setUTCHours(12, 0, 0, 0);
  clock.setUTCFullYear(year, month - 1, day);
  return addCivilDays(date, -((clock.getUTCDay() - weekStart + 7) % 7));
}

export function calendarWeekDays(date, weekStart = 0) {
  const first = weekStartDate(date, weekStart);
  return Object.freeze(Array.from({length: 7}, (_, index) => {
    const value = addCivilDays(first, index);
    const {year, month, day} = civilDateParts(value);
    return Object.freeze({date: value, year, month, day, weekday: (weekStart + index) % 7});
  }));
}

export function weekAgendaGroups(date, items, weekStart = 0) {
  const grouped = groupCalendarEvents(items);
  return Object.freeze(calendarWeekDays(date, weekStart).map(day => Object.freeze({
    ...day,
    items: Object.freeze(grouped.get(day.date) || []),
  })));
}

export function monthCellSummary(items, {visibleLimit = 2} = {}) {
  if (!Number.isInteger(visibleLimit) || visibleLimit < 0) {
    throw new RangeError('visibleLimit must be a non-negative integer');
  }
  const sorted = sortCalendarEvents(items);
  const boundedLimit = Math.min(visibleLimit, 2);
  const remaining = Math.max(0, sorted.length - boundedLimit);
  return Object.freeze({
    count: sorted.length,
    visible: Object.freeze(sorted.slice(0, boundedLimit)),
    remaining,
    moreLabel: remaining ? `+${remaining}` : '',
  });
}

function eventKind(item) {
  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  // A recorded amount is evidence of a payment, including a recorded 0 amount.
  if (Number.isSafeInteger(item?.entry?.amount_minor) && item.entry.amount_minor >= 0) return 'PAYMENT';
  // Restrict title inference to explicit domain terms; an arbitrary location,
  // merchant, or vague title does not become a booking or medical appointment.
  if (/(?:병원|의원|치과|내과|외과|안과|피부과|정형외과|소아과|이비인후과|산부인과).*(?:진료|검진|예약)|(?:진료|검진).*(?:병원|의원|치과)/u.test(title)) return 'MEDICAL';
  if (/(?:예약|예매|체크인|숙박)/u.test(title)) return 'RESERVATION';
  return 'NORMAL';
}

const TYPE_LABEL = Object.freeze({NORMAL: '일정', RESERVATION: '예약', PAYMENT: '결제', MEDICAL: '진료'});
const ATTENTION_LABEL = Object.freeze({UPCOMING: '기한 예정', DUE_TODAY: '오늘 기한', OVERDUE: '기한 지남'});

function sourceLabel(item) {
  if (String(item?.id || '').startsWith('guest_')) return '이 기기에 저장';
  if (item?.provider_verified === true && item?.confirmation_level === 'PROVIDER_VERIFIED') return '외부 확인됨';
  if (item?.source_kind === 'USER_INPUT' || item?.confirmation_level === 'USER_ATTESTED') return '직접 입력';
  return '';
}

function eventSpanLabel(item) {
  const startDate = item?.local_date;
  const endDate = validCivilDate(item?.local_end_date)
    ? item.local_end_date : String(item?.local_end_datetime || '').slice(0, 10);
  if (!validCivilDate(startDate) || !validCivilDate(endDate)) return '';
  const stamp = (date, datetime) => {
    const day = `${date.slice(5, 7)}/${date.slice(8, 10)}`;
    return typeof datetime === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(datetime)
      ? `${day} ${datetime.slice(11, 16)}` : day;
  };
  const start = stamp(startDate, item.local_datetime);
  const end = stamp(endDate, item.local_end_datetime);
  return start === end ? '' : `${start} → ${end}`;
}

function amountLabel(entry) {
  if (!Number.isSafeInteger(entry?.amount_minor) || entry.amount_minor < 0) return '';
  // The contract carries *minor* units. Never print that raw integer as a
  // major-unit amount for currencies whose exponent we have not specified.
  if (entry.currency === 'KRW' || !entry.currency) {
    return `${entry.amount_minor.toLocaleString('ko-KR')}원`;
  }
  if (entry.currency === 'USD') {
    const dollars = Math.floor(entry.amount_minor / 100).toLocaleString('en-US');
    const cents = String(entry.amount_minor % 100).padStart(2, '0');
    return `$${dollars}.${cents}`;
  }
  return '';
}

export function calendarEventPresentation(item) {
  const kind = eventKind(item);
  const statusLabel = ATTENTION_LABEL[item?.calendar_attention_state || item?.state] || '';
  const authority = sourceLabel(item);
  const spanLabel = eventSpanLabel(item);
  const entry = item?.entry;
  const secondary = [entry?.place, entry?.merchant, amountLabel(entry)]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim());
  return Object.freeze({
    kind,
    typeLabel: TYPE_LABEL[kind],
    statusLabel,
    sourceLabel: authority,
    spanLabel,
    timeLabel: validCivilDate(item?.local_date)
      ? (typeof item?.local_datetime === 'string' ? item.local_datetime.slice(11, 16) : '종일')
      : '미정',
    metaText: [spanLabel, ...secondary, authority].filter(Boolean).join(' · '),
  });
}

export function filterScheduleItems(items, scope, {today, weekStart = 0} = {}) {
  const source = Array.isArray(items) ? items : [];
  if (scope === 'all') return [...source];
  if (scope === 'reservation' || scope === 'payment' || scope === 'schedule') {
    const kind = {reservation: 'RESERVATION', payment: 'PAYMENT', schedule: 'NORMAL'}[scope];
    return source.filter(item => eventKind(item) === kind);
  }
  if (!['today', 'week', 'month'].includes(scope)) throw new RangeError('unknown schedule filter');
  const {year, month} = civilDateParts(today);
  const first = scope === 'week' ? weekStartDate(today, weekStart) : '';
  const last = scope === 'week' ? addCivilDays(first, 6) : '';
  return sortCalendarEvents(source.filter(item => {
    const date = item?.local_date;
    if (!validCivilDate(date)) return false;
    if (scope === 'today') return date === today;
    if (scope === 'week') return date >= first && date <= last;
    return date.slice(0, 7) === `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  }));
}

const DEFAULT_TIMED_EVENT_MINUTES = 60;
const MIN_TIMED_EVENT_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;

function minutesFromDatetime(value) {
  const match = typeof value === 'string' ? /^\d{4}-\d\d-\d\dT(\d\d):(\d\d)/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isAllDayItem(item) {
  return item?.all_day === true || typeof item?.local_datetime !== 'string';
}

function eventDateSpan(item) {
  const startDate = item?.local_date;
  const endDateRaw = validCivilDate(item?.local_end_date)
    ? item.local_end_date : String(item?.local_end_datetime || '').slice(0, 10);
  const endDate = validCivilDate(endDateRaw) ? endDateRaw : startDate;
  return {startDate, endDate};
}

// Packs a day's overlapping timed events into side-by-side lanes: a standard
// greedy interval layout. Entries are handled in start order and a cluster of
// mutually-overlapping entries shares one lane count, so two events that only
// touch (one ends exactly when the other starts) land in separate clusters
// and each keeps the full column width instead of splitting for no reason.
export function layoutTimedEvents(entries) {
  const sorted = [...entries].sort((a, b) => a.start - b.start || a.end - b.end);
  const clusters = [];
  let current = [];
  let currentEnd = -Infinity;
  for (const entry of sorted) {
    if (current.length && entry.start >= currentEnd) {
      clusters.push(current);
      current = [];
      currentEnd = -Infinity;
    }
    current.push(entry);
    currentEnd = Math.max(currentEnd, entry.end);
  }
  if (current.length) clusters.push(current);

  const placed = [];
  for (const cluster of clusters) {
    const laneEnds = [];
    for (const entry of cluster) {
      let lane = laneEnds.findIndex(end => end <= entry.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(entry.end); }
      else laneEnds[lane] = entry.end;
      placed.push({...entry, lane, laneCount: 0});
    }
    for (let index = placed.length - cluster.length; index < placed.length; index += 1) {
      placed[index] = {...placed[index], laneCount: laneEnds.length};
    }
  }
  return Object.freeze(placed);
}

// Per-day all-day/timed split for a time-grid Week view. All-day items
// (including a multi-day span with no clock time) go in `allDay` for every
// date they cover; a timed item gets a start/end clipped to this day's
// 0..1440 minute range, plus a lane from layoutTimedEvents so events that
// truly overlap render side by side instead of stacking illegibly.
export function calendarWeekTimeGrid(date, items, weekStart = 0) {
  const source = Array.isArray(items) ? items : [];
  return Object.freeze(calendarWeekDays(date, weekStart).map(day => {
    const allDay = [];
    const timedEntries = [];
    for (const item of source) {
      if (!validCivilDate(item?.local_date)) continue;
      const {startDate, endDate} = eventDateSpan(item);
      if (!validCivilDate(startDate) || !validCivilDate(endDate)) continue;
      if (day.date < startDate || day.date > endDate) continue;
      if (isAllDayItem(item)) { allDay.push(item); continue; }
      const start = day.date === startDate ? (minutesFromDatetime(item.local_datetime) ?? 0) : 0;
      // A day that is not the end date always runs to midnight here, even
      // when it is also the start date -- only a truly single-day item (no
      // separate end date at all) falls back to a default duration.
      let end;
      if (day.date === endDate) {
        end = minutesFromDatetime(item.local_end_datetime);
        if (end === null) end = startDate === endDate ? start + DEFAULT_TIMED_EVENT_MINUTES : MINUTES_PER_DAY;
      } else {
        end = MINUTES_PER_DAY;
      }
      end = Math.min(MINUTES_PER_DAY, Math.max(end, start + MIN_TIMED_EVENT_MINUTES));
      timedEntries.push({item, start, end});
    }
    return Object.freeze({
      ...day,
      allDay: Object.freeze(sortCalendarEvents(allDay)),
      timed: Object.freeze(layoutTimedEvents(timedEntries)),
    });
  }));
}

export function calendarWeatherPresentation(weather) {
  const monthLabel = weatherTemperatureLabel(weather);
  const min = weather?.minTemperature;
  const max = weather?.maxTemperature;
  const weekLabel = Number.isFinite(min) && Number.isFinite(max)
    ? `${Math.round(min)}° / ${Math.round(max)}°` : monthLabel;
  const precipLabel = weatherPrecipitationLabel(weather);
  return Object.freeze({monthLabel, weekLabel, precipLabel});
}

// ── Life timeline ────────────────────────────────────────────────────────
// What a date holds, read the way a day is lived: the things that frame the
// whole day first, then the clock, then what was noted without a time. Shared
// by the selected-day detail, the week list and the list view so one record
// reads the same everywhere. Read-time only: nothing here is stored, and no
// time, kind or amount is invented for a record that did not state one.

// The last civil date a record covers. A stay or a trip states its ending; an
// ordinary record ends on the day it starts.
export function calendarItemEndDate(item) {
  const start = item?.local_date;
  if (!validCivilDate(start)) return '';
  const stated = validCivilDate(item?.local_end_date)
    ? item.local_end_date
    : String(item?.local_end_datetime || '').slice(0, 10);
  return validCivilDate(stated) && stated > start ? stated : start;
}

export function calendarItemSpansDays(item) {
  const start = item?.local_date;
  return validCivilDate(start) && calendarItemEndDate(item) > start;
}

// Every loaded record that covers `date` -- a three-night stay belongs to each
// of its nights. Only records the current read actually returned can appear:
// a span whose start fell outside the fetched window is not reconstructed.
export function calendarItemsOnDate(items, date) {
  if (!validCivilDate(date)) return [];
  return (Array.isArray(items) ? items : []).filter(item => {
    const start = item?.local_date;
    if (!validCivilDate(start) || start > date) return false;
    return start === date || calendarItemEndDate(item) >= date;
  });
}

export const LIFE_TIMELINE_GROUP = Object.freeze({
  SPAN: 'SPAN',
  DEADLINE: 'DEADLINE',
  TIMED: 'TIMED',
  UNTIMED: 'UNTIMED',
});

function hasClockTime(item) {
  return item?.all_day !== true
    && typeof item?.local_datetime === 'string'
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(item.local_datetime);
}

// Core names a due date with DEADLINE semantics; nothing else is read as one.
// A record without a clock time is "time-less", not "all day": the contract has
// no field that tells the two apart, so neither is claimed.
// A stay that starts at a stated hour sits at that hour on the day it begins
// (check-in 15:00 is part of that day's flow); every later day it frames the
// day as a 기간.
export function lifeTimelineGroup(item, date = item?.local_date) {
  if (calendarItemSpansDays(item)) {
    return date === item?.local_date && hasClockTime(item) ? LIFE_TIMELINE_GROUP.TIMED : LIFE_TIMELINE_GROUP.SPAN;
  }
  if (item?.temporal_semantics === 'DEADLINE') return LIFE_TIMELINE_GROUP.DEADLINE;
  if (hasClockTime(item)) return LIFE_TIMELINE_GROUP.TIMED;
  return LIFE_TIMELINE_GROUP.UNTIMED;
}

const byTitle = (left, right) => String(left?.title || '').localeCompare(String(right?.title || ''), 'ko');

export function lifeTimelineForDate(items, date) {
  const groups = {SPAN: [], DEADLINE: [], TIMED: [], UNTIMED: []};
  const onDate = calendarItemsOnDate(items, date);
  for (const item of onDate) groups[lifeTimelineGroup(item, date)].push(item);
  groups.SPAN.sort((left, right) => String(left.local_date).localeCompare(String(right.local_date))
    || calendarItemEndDate(right).localeCompare(calendarItemEndDate(left))
    || byTitle(left, right));
  groups.DEADLINE.sort(byTitle);
  groups.TIMED.sort((left, right) => String(left.local_datetime).localeCompare(String(right.local_datetime)) || byTitle(left, right));
  groups.UNTIMED.sort(byTitle);
  return Object.freeze({
    // 기간 · 마감: what frames the whole day.
    top: Object.freeze([...groups.SPAN, ...groups.DEADLINE]),
    // 시간순.
    timed: Object.freeze(groups.TIMED),
    // 시간 없는 기록: never given a 00:00 or "now" it did not have.
    untimed: Object.freeze(groups.UNTIMED),
    count: onDate.length,
  });
}

// "09/12 15:00": the same stamp the Calendar has always used for a stay's two ends.
function shortStamp(date, datetime) {
  const day = `${date.slice(5, 7)}/${date.slice(8, 10)}`;
  return typeof datetime === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(datetime)
    ? `${day} ${datetime.slice(11, 16)}`
    : day;
}

function rowAmountLabel(entry) {
  const amount = entry?.amount_minor;
  if (!Number.isSafeInteger(amount) || amount < 0) return '';
  const currency = typeof entry?.currency === 'string' && /^[A-Z]{3}$/.test(entry.currency) ? entry.currency : 'KRW';
  return formatExpenseAmount(amount, currency);
}

function memoExcerpt(memo) {
  const line = typeof memo === 'string' ? memo.trim().split(/\r?\n/u)[0].trim() : '';
  if (!line) return '';
  return line.length > 40 ? `${line.slice(0, 39)}…` : line;
}

// One row's words. `today` only decides how a deadline reads ("기한 지남").
export function lifeRowPresentation(item, {date = item?.local_date, today = ''} = {}) {
  const group = lifeTimelineGroup(item, date);
  const start = item?.local_date;
  const end = calendarItemEndDate(item);
  const spans = calendarItemSpansDays(item);
  // "09/12 15:00 → 09/13 11:00": every day of a span says where it starts and ends.
  const spanText = spans ? `${shortStamp(start, item.local_datetime)} → ${shortStamp(end, item.local_end_datetime)}` : '';
  let timeLabel = '';
  let timeDetail = '';
  let statusLabel = '';
  if (group === LIFE_TIMELINE_GROUP.SPAN) {
    timeLabel = '기간';
  } else if (group === LIFE_TIMELINE_GROUP.DEADLINE) {
    timeLabel = '마감';
    if (validCivilDate(today) && validCivilDate(start)) {
      if (start < today) statusLabel = '기한 지남';
      else if (start === today) statusLabel = '오늘 마감';
    }
  } else if (group === LIFE_TIMELINE_GROUP.TIMED) {
    timeLabel = item.local_datetime.slice(11, 16);
    const endClock = typeof item?.local_end_datetime === 'string' && /T\d\d:\d\d/.test(item.local_end_datetime)
      ? item.local_end_datetime.slice(11, 16) : '';
    if (endClock && !spans) timeDetail = `~${endClock}`;
  } else if (!validCivilDate(start)) {
    // 날짜 미정: the list view's own group; it has no day to belong to yet.
    timeLabel = '미정';
  }
  // An attention projection may carry its own state (list view's 기한 지남).
  const attention = ATTENTION_LABEL[item?.calendar_attention_state] || '';
  if (attention) statusLabel = attention;

  const entry = item?.entry && typeof item.entry === 'object' ? item.entry : {};
  const amountLabel = rowAmountLabel(entry);
  // A category only means something next to an amount; 미분류 says nothing.
  const categoryLabel = amountLabel && entry.expense_category && entry.expense_category !== 'UNCLASSIFIED'
    ? expenseCategoryLabel(entry.expense_category) : '';
  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  const place = typeof entry.place === 'string' ? entry.place.trim() : '';
  const merchant = typeof entry.merchant === 'string' ? entry.merchant.trim() : '';
  const secondary = [
    spanText,
    place,
    merchant && merchant !== title && merchant !== place ? merchant : '',
    categoryLabel,
    memoExcerpt(entry.memo),
    item?.provider_verified === true && item?.confirmation_level === 'PROVIDER_VERIFIED' ? '외부 확인됨' : '',
  ].filter(Boolean);
  const continued = spans && validCivilDate(date) && date !== start;
  return Object.freeze({
    group,
    timeLabel,
    timeDetail,
    statusLabel,
    title,
    amountLabel,
    categoryLabel,
    secondaryText: secondary.join(' · '),
    // A stay's second night shows the stay, but its price belongs to the day
    // it was recorded on; the row says so instead of repeating the amount.
    amountOnThisDay: Boolean(amountLabel) && !continued,
    continued,
  });
}

// What a day's records add up to, per currency, in the shape the editor wrote
// them. A record counts once, on the day it starts: a three-night stay is not
// three payments. Currencies are never summed together.
export function dayAmountTotals(items, date) {
  const totals = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.local_date !== date) continue;
    const amount = item?.entry?.amount_minor;
    if (!Number.isSafeInteger(amount) || amount < 0) continue;
    const currency = /^[A-Z]{3}$/.test(String(item.entry.currency || '')) ? item.entry.currency : 'KRW';
    totals.set(currency, (totals.get(currency) || 0) + amount);
  }
  return Object.freeze([...totals.entries()]
    .sort(([left], [right]) => (left === 'KRW' ? -1 : right === 'KRW' ? 1 : left.localeCompare(right)))
    .map(([currency, amountMinor]) => Object.freeze({currency, amountMinor, label: formatExpenseAmount(amountMinor, currency)})));
}

// Desktop month: a multi-day record is one bar across the days it covers. Each
// week row hands out lanes so the same bar stays on the same line from day to
// day; a bar that continues into the next row starts a new segment there and
// repeats its title.
export function monthSpanSegments(cells, items) {
  const byDate = new Map();
  const laneCountByRow = [];
  const spans = (Array.isArray(items) ? items : []).filter(calendarItemSpansDays);
  for (let row = 0; row * 7 < cells.length; row += 1) {
    const rowCells = cells.slice(row * 7, row * 7 + 7);
    const rowStart = rowCells[0].date;
    const rowEnd = rowCells[rowCells.length - 1].date;
    const inRow = spans
      .filter(item => item.local_date <= rowEnd && calendarItemEndDate(item) >= rowStart)
      .sort((left, right) => String(left.local_date).localeCompare(String(right.local_date))
        || calendarItemEndDate(right).localeCompare(calendarItemEndDate(left))
        || byTitle(left, right));
    const laneEnds = [];
    for (const item of inRow) {
      const start = item.local_date;
      const end = calendarItemEndDate(item);
      const segmentStart = start > rowStart ? start : rowStart;
      const segmentEnd = end < rowEnd ? end : rowEnd;
      let lane = laneEnds.findIndex(laneEnd => laneEnd < segmentStart);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(segmentEnd); } else laneEnds[lane] = segmentEnd;
      for (const cell of rowCells) {
        if (cell.date < segmentStart || cell.date > segmentEnd) continue;
        if (!byDate.has(cell.date)) byDate.set(cell.date, []);
        byDate.get(cell.date).push(Object.freeze({
          item,
          lane,
          showTitle: cell.date === segmentStart,
          startsHere: cell.date === start,
          endsHere: cell.date === end,
          segmentStart: cell.date === segmentStart,
          segmentEnd: cell.date === segmentEnd,
        }));
      }
    }
    laneCountByRow.push(laneEnds.length);
  }
  return Object.freeze({byDate, laneCountByRow: Object.freeze(laneCountByRow)});
}
