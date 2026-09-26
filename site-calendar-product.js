// Pure Calendar presentation decisions shared by Week, Month, and Schedule.
// These labels are derived at read time; no inferred kind or state is stored.
import {addCivilDays, civilDateParts, groupCalendarEvents, sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=aset-fe97a0fe9c8c';
import {weatherPrecipitationLabel, weatherTemperatureLabel} from './site-calendar-weather.js?v=aset-fe97a0fe9c8c';

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
