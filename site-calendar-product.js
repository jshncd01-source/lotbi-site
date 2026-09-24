// Pure Calendar presentation decisions shared by Week, Month, and Schedule.
// These labels are derived at read time; no inferred kind or state is stored.
import {addCivilDays, civilDateParts, groupCalendarEvents, sortCalendarEvents, validCivilDate} from './site-calendar-model.js?v=aset-94aa2ef13701';
import {weatherTemperatureLabel} from './site-calendar-weather.js?v=aset-94aa2ef13701';

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

export function calendarWeatherPresentation(weather) {
  const monthLabel = weatherTemperatureLabel(weather);
  const min = weather?.minTemperature;
  const max = weather?.maxTemperature;
  const weekLabel = Number.isFinite(min) && Number.isFinite(max)
    ? `${Math.round(min)}° / ${Math.round(max)}°` : monthLabel;
  return Object.freeze({monthLabel, weekLabel});
}
