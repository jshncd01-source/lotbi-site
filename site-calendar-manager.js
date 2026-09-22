import {createLifeActivity, editLifeActivity, getCalendarWeather, getLifeActivity, getLifeAgenda, getLifeAttention, getLifeUnscheduled, removeLifeActivity} from './site-calendar.js?v=20260922-weather1';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=20260921-smartcaldraft1';
import {
  addCivilDays,
  calendarMonthGrid,
  calendarYearOverview,
  civilDateParts,
  groupCalendarEvents,
  monthGridRange,
  sortCalendarEvents,
  validCivilDate,
} from './site-calendar-model.js?v=20260921-smartcaldraft1';
import {SiteCoreError} from './site-core.js?v=20260921-smartcaldraft1';
import {calendarWeatherByDate} from './site-calendar-weather.js?v=20260922-weather1';
import {BrowserLocationError, getBrowserLocationPermissionState, isFreshBrowserCurrentLocation, LOCATION_PERMISSION, LOCATION_RESOLUTION, requestBrowserCurrentLocation} from './site-current-location.js?v=20260922-locationperm1';

const DEFAULT_TIMEZONE = 'Asia/Seoul';
const WEEKDAYS = Object.freeze(['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']);
const MODES = Object.freeze([['month', '월'], ['year', '연도'], ['agenda', '일정'], ['attention', '확인 필요']]);

function resolvedTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE; }
  catch { return DEFAULT_TIMEZONE; }
}

function dateInTimezone(now, timezone) {
  const parts = new Intl.DateTimeFormat('en', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMode(value) {
  if (value === 'today' || value === 'all' || value === 'date') return 'month';
  if (value === 'upcoming') return 'agenda';
  return MODES.some(([mode]) => mode === value) ? value : 'month';
}

function monthBounds(date) {
  const {year, month} = civilDateParts(date);
  return {...monthGridRange(year, month), year, month};
}

function yearBounds(date) {
  const {year} = civilDateParts(date);
  return {year, start: `${year}-01-01`, end: `${year}-12-31`};
}

function koreanDate(value) {
  const {year, month, day} = civilDateParts(value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return `${year}년 ${month}월 ${day}일 ${WEEKDAYS[weekday]}`;
}

function shiftCivilMonth(value, delta) {
  const {year, month, day} = civilDateParts(value);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function eventTime(item) {
  if (!validCivilDate(item?.local_date)) return '미정';
  return typeof item?.local_datetime === 'string' ? item.local_datetime.slice(11, 16) : '종일';
}

function isAllDay(item) {
  return item?.all_day === true || !item?.local_datetime;
}

function canonicalActivityLocalDate(value) {
  const temporal = value?.temporal;
  if (!temporal || typeof temporal !== 'object') return '';
  if (typeof temporal.local_date === 'string' && validCivilDate(temporal.local_date)) return temporal.local_date;
  if (typeof temporal.local_datetime === 'string' && validCivilDate(temporal.local_datetime.slice(0, 10))) return temporal.local_datetime.slice(0, 10);
  return '';
}

function normalizedDeepOpen(value) {
  if (!value || typeof value !== 'object') return null;
  const scope = String(value.scope || '').trim().toUpperCase();
  const dateHint = validCivilDate(value.dateHint) ? value.dateHint : '';
  const timezone = typeof value.timezone === 'string' ? value.timezone.trim() : '';
  if (scope === 'AUTH') {
    const activityId = typeof value.activityId === 'string' ? value.activityId.trim() : '';
    const occurrenceId = typeof value.occurrenceId === 'string' ? value.occurrenceId.trim() : '';
    if (!/^activity_[0-9a-f]{32}$/.test(activityId) || (occurrenceId && !/^occurrence_[0-9a-f]{32}$/.test(occurrenceId))) return null;
    return Object.freeze({scope, activityId, occurrenceId, dateHint, timezone});
  }
  if (scope === 'GUEST') {
    const guestEventId = typeof value.guestEventId === 'string' ? value.guestEventId.trim() : '';
    if (!/^guest_[0-9a-f-]{36}$/i.test(guestEventId)) return null;
    return Object.freeze({scope, guestEventId, dateHint, timezone});
  }
  return null;
}


function usesFlowingDayDetail() {
  if (typeof globalThis.matchMedia === 'function') return globalThis.matchMedia('(max-width: 900px)').matches;
  return globalThis.innerWidth <= 900;
}

function weekBounds(value) {
  const {year, month, day} = civilDateParts(value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const start = addCivilDays(value, -weekday);
  return Object.freeze({start, end: addCivilDays(start, 6)});
}

export function buildCalendarTemporal({localDate, time = '', allDay = false, timezone = DEFAULT_TIMEZONE}) {
  const date = typeof localDate === 'string' ? localDate.trim() : '';
  const clock = typeof time === 'string' ? time.trim() : '';
  if (!date) {
    if (clock) throw new SiteCoreError('날짜 없이 시간만 저장할 수 없습니다.', {code: 'LIFE_DATE_REQUIRED_FOR_TIME', status: 422});
    return Object.freeze({kind: 'UNSCHEDULED'});
  }
  if (!validCivilDate(date)) throw new SiteCoreError('날짜가 올바르지 않습니다.', {code: 'LIFE_DATE_INVALID', status: 422});
  if (allDay || !clock) return Object.freeze({kind: 'DATE_ONLY', local_date: date});
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new SiteCoreError('시간이 올바르지 않습니다.', {code: 'LIFE_TIME_INVALID', status: 422});
  return Object.freeze({kind: 'LOCAL_DATE_TIME', local_datetime: `${date}T${clock}:00`, timezone_name: timezone});
}

function defaultRequestId(kind) {
  return `site.calendar.${kind}.${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function createCalendarMutationController({
  sessionToken = '', timezone = DEFAULT_TIMEZONE, guestRepository, fetchImpl = globalThis.fetch, requestId = defaultRequestId,
} = {}) {
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  if (!authenticated && !guestRepository) throw new TypeError('guestRepository is required for Guest Calendar mutations');
  const normalized = input => {
    const rawAmount = input?.amountMinor;
    const amountMinor = rawAmount === '' || rawAmount == null ? null : Number(rawAmount);
    return {
      title: typeof input?.title === 'string' ? input.title.trim() : '',
      localDate: typeof input?.localDate === 'string' ? input.localDate.trim() : '',
      time: typeof input?.time === 'string' ? input.time.trim() : '',
      allDay: input?.allDay === true,
      entry: {
        amount_minor: amountMinor,
        currency: 'KRW',
        expense_category: input?.expenseCategory || null,
        memo: typeof input?.memo === 'string' ? input.memo : '',
        place: typeof input?.place === 'string' ? input.place : '',
        merchant: typeof input?.merchant === 'string' ? input.merchant : '',
      },
    };
  };
  const guestPayload = (value, temporal) => ({
    title: value.title,
    local_date: value.localDate || null,
    local_datetime: temporal.kind === 'LOCAL_DATE_TIME' ? temporal.local_datetime : null,
    all_day: temporal.kind === 'DATE_ONLY',
    entry: value.entry,
  });
  return Object.freeze({
    async create(input) {
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.create(guestPayload(value, temporal));
      return createLifeActivity(sessionToken, {
        logicalRequestId: requestId('create'), title: value.title, temporal,
        temporalSemantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', entry: value.entry,
      }, fetchImpl);
    },
    async update(item, input) {
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.update(item.id, guestPayload(value, temporal));
      return editLifeActivity(sessionToken, item.activity_id || item.activityId, {
        logicalRequestId: requestId('edit'),
        expectedActivityRevision: item.activity_revision ?? item.activityRevision,
        expectedOccurrenceRevision: item.occurrence_revision ?? item.occurrenceRevision,
        title: value.title,
        temporal,
        temporalSemantics: 'USER_PLANNED_TIME',
        busy: 'UNKNOWN',
        entry: value.entry,
      }, fetchImpl);
    },
    async remove(item) {
      if (!authenticated) return guestRepository.remove(item.id);
      return removeLifeActivity(sessionToken, item.activity_id || item.activityId, {
        logicalRequestId: requestId('remove'), expectedRevision: item.activity_revision ?? item.activityRevision,
      }, fetchImpl);
    },
  });
}

function withCalendarShape(item) {
  return Object.freeze({...item, all_day: isAllDay(item)});
}

function withUnscheduledShape(item) {
  return Object.freeze({
    activity_id: item.activityId,
    occurrence_id: item.occurrenceId,
    title: item.title,
    activity_revision: item.activityRevision,
    occurrence_revision: item.occurrenceRevision,
    temporal: item.temporal,
    temporal_kind: item.temporal?.kind || 'UNSCHEDULED',
    temporal_semantics: item.temporalSemantics,
    busy: item.busy,
    confirmation_level: item.confirmationLevel,
    provider_verified: item.providerVerified === true,
    source_kind: 'USER_INPUT',
    entry: item.entry || {},
    local_date: null,
    local_datetime: null,
    all_day: false,
  });
}

export function buildCalendarAriaLabel(cell, count, {today = false, selected = false, attention = false, weather = null} = {}) {
  const {year, month, day} = civilDateParts(cell.date);
  const parts = [`${year}년 ${month}월 ${day}일 ${WEEKDAYS[cell.weekday]}, 일정 ${count}개`];
  if (today) parts.push('오늘');
  if (selected) parts.push('선택됨');
  if (attention) parts.push('확인 필요 일정 있음');
  if (weather?.label) parts.push(`날씨 ${weather.label}`);
  return parts.join(', ');
}

export function countCalendarEventsByMonth(items, year) {
  const counts = Array(12).fill(0);
  for (const item of Array.isArray(items) ? items : []) {
    if (!validCivilDate(item?.local_date)) continue;
    const parts = civilDateParts(item.local_date);
    if (parts.year === year) counts[parts.month - 1] += 1;
  }
  return counts;
}

export async function loadLifeCalendarManagerView(
  sessionToken,
  {view = 'month', date, timezone = resolvedTimezone(), now = new Date(), fetchImpl = globalThis.fetch, weatherLocation = null} = {},
) {
  const selectedDate = validCivilDate(date) ? date : dateInTimezone(now, timezone);
  const key = normalizeMode(view);
  if (key === 'attention') {
    const response = await getLifeAttention(sessionToken, {timezone, horizonDays: 365}, fetchImpl);
    return Object.freeze({key, date: selectedDate, items: response.items, kind: 'attention'});
  }
  const range = key === 'year' ? yearBounds(selectedDate) : monthBounds(selectedDate);
  const weatherRequest = key === 'month'
    ? getCalendarWeather(sessionToken, {
        start: range.start,
        end: range.end,
        timezone,
        latitude: weatherLocation?.latitude,
        longitude: weatherLocation?.longitude,
        midRegionCode: weatherLocation?.midRegionCode || '',
      }, fetchImpl).catch(() => ({providerReady: false, items: [], aiCalls: 0}))
    : Promise.resolve({providerReady: false, items: [], aiCalls: 0});
  const [response, monthAttention, unscheduled, weather] = await Promise.all([
    getLifeAgenda(sessionToken, {timezone, start: range.start, end: range.end}, fetchImpl),
    key === 'month'
      ? getLifeAttention(sessionToken, {timezone, horizonDays: 365}, fetchImpl)
      : Promise.resolve(null),
    key === 'agenda'
      ? getLifeUnscheduled(sessionToken, fetchImpl)
      : Promise.resolve(null),
    weatherRequest,
  ]);
  return Object.freeze({
    key,
    date: selectedDate,
    year: range.year,
    month: range.month,
    range: Object.freeze({start: range.start, end: range.end}),
    kind: 'agenda',
    items: Object.freeze(response.items.map(withCalendarShape)),
    attention: Object.freeze(monthAttention?.items || []),
    unscheduled: Object.freeze((unscheduled?.items || []).map(withUnscheduledShape)),
    weather: Object.freeze(weather?.items || []),
    weatherProviderReady: weather?.providerReady === true,
  });
}

function button(label, className) {
  const value = document.createElement('button');
  value.type = 'button';
  value.className = className;
  value.textContent = label;
  return value;
}

function emptyMessage(text) {
  const value = document.createElement('p');
  value.className = 'life-calendar-empty';
  value.textContent = text;
  return value;
}

function attentionStateLabel(value) {
  if (value === 'UPCOMING') return '기한 예정';
  if (value === 'DUE_TODAY') return '오늘 기한';
  if (value === 'OVERDUE') return '기한 지남';
  return '';
}

function eventMetaText(item) {
  const parts = [];
  const attention = attentionStateLabel(item?.calendar_attention_state || item?.state);
  if (attention) parts.push(attention);
  if (String(item?.id || '').startsWith('guest_')) parts.push('이 기기에 저장');
  else if (item?.provider_verified === true && item?.confirmation_level === 'PROVIDER_VERIFIED') parts.push('외부 확인됨');
  else if (item?.source_kind === 'USER_INPUT' || item?.confirmation_level === 'USER_ATTESTED') parts.push('직접 입력');
  return parts.join(' · ');
}

function eventList(items, {onSelect} = {}) {
  const list = document.createElement('ul');
  list.className = 'calendar-day-list';
  for (const item of sortCalendarEvents(items)) {
    const li = document.createElement('li');
    li.className = 'calendar-day-event';
    li.dataset.calendarEventId = item.id || item.activity_id || '';
    const time = document.createElement('time');
    time.textContent = eventTime(item);
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('small');
    meta.textContent = eventMetaText(item);
    copy.append(title);
    if (meta.textContent) copy.append(meta);
    li.append(time, copy);
    if (onSelect) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', `${eventTime(item)} ${item.title}${meta.textContent ? `, ${meta.textContent}` : ""}`);
      li.addEventListener('click', () => onSelect(item));
      li.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item); }
      });
    }
    list.appendChild(li);
  }
  return list;
}

function dayPanel(state, groups, actions) {
  const panel = document.createElement('aside');
  panel.className = 'calendar-day-panel';
  panel.dataset.selectedDate = state.selectedDate;
  panel.dataset.collapsed = String(state.dayCollapsed);
  panel.hidden = !state.detailOpen;

  const head = document.createElement('div');
  head.className = 'calendar-day-panel-head';
  const heading = document.createElement('h3');
  heading.className = 'calendar-day-heading';
  heading.textContent = koreanDate(state.selectedDate);
  const controls = document.createElement('div');
  controls.className = 'calendar-day-panel-actions';
  const toggle = button(state.dayCollapsed ? '펼치기' : '접기', 'calendar-day-toggle');
  toggle.setAttribute('aria-expanded', String(!state.dayCollapsed));
  toggle.addEventListener('click', () => actions.toggleDay());
  const close = button('닫기', 'calendar-day-close');
  close.addEventListener('click', () => actions.closeDay());
  controls.append(toggle, close);
  head.append(heading, controls);

  const body = document.createElement('div');
  body.className = 'calendar-day-body';
  body.hidden = state.dayCollapsed;
  const items = groups.get(state.selectedDate) || [];
  body.appendChild(items.length ? eventList(items, {onSelect: actions.onEvent}) : emptyMessage('등록된 일정이 없어요.'));
  const add = button(`${civilDateParts(state.selectedDate).month}월 ${civilDateParts(state.selectedDate).day}일에 일정 추가`, 'calendar-add-button');
  add.dataset.calendarAdd = '';
  add.addEventListener('click', () => actions.onAdd?.(state.selectedDate));
  body.appendChild(add);
  panel.append(head, body);
  return panel;
}

function monthEventRow(item, onSelect) {
  const row = button('', 'calendar-event-chip');
  row.dataset.eventChip = '';
  row.dataset.calendarEventId = item.id || item.activity_id || '';
  if (!isAllDay(item)) {
    const time = document.createElement('span');
    time.className = 'calendar-event-time';
    time.textContent = eventTime(item);
    row.appendChild(time);
  }
  const title = document.createElement('span');
  title.className = 'calendar-event-title';
  title.textContent = item.title;
  row.appendChild(title);
  row.setAttribute('aria-label', `${isAllDay(item) ? "" : `${eventTime(item)} `}${item.title}`);
  row.addEventListener('click', event => {
    event.stopPropagation();
    onSelect(item);
  });
  return row;
}

function fitMonthEventDensity(layout) {
  const desktop = typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(min-width: 901px)').matches
    : globalThis.innerWidth > 900;
  for (const cell of layout.querySelectorAll('.calendar-date-cell')) {
    const stack = cell.querySelector('.calendar-event-stack');
    if (!stack) continue;
    const rows = [...stack.querySelectorAll('.calendar-event-chip')];
    const more = stack.querySelector('.calendar-event-overflow');
    for (const row of rows) row.hidden = !desktop;
    if (more) more.hidden = true;
    if (!desktop || !rows.length) continue;

    for (const row of rows) row.hidden = false;
    const cellStyle = getComputedStyle(cell);
    const paddingY = (parseFloat(cellStyle.paddingTop) || 0) + (parseFloat(cellStyle.paddingBottom) || 0);
    const cellGap = parseFloat(cellStyle.rowGap || cellStyle.gap) || 0;
    const headerHeight = Math.ceil(cell.querySelector('.calendar-date-header')?.getBoundingClientRect().height || 0);
    const available = Math.max(0, Math.floor(cell.getBoundingClientRect().height - paddingY - headerHeight - cellGap));
    const rowHeight = Math.max(24, Math.ceil(rows[0].getBoundingClientRect().height || 24));
    const moreHeight = Math.max(22, Math.ceil(more?.getBoundingClientRect().height || 22));
    const gap = 1;
    const fullCapacity = Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
    if (rows.length <= fullCapacity) continue;

    const visible = Math.max(0, Math.floor((available - moreHeight) / (rowHeight + gap)));
    rows.forEach((row, index) => { row.hidden = index >= visible; });
    if (more) {
      more.hidden = false;
      more.textContent = `${rows.length - visible}개 더 보기`;
      more.dataset.hiddenCount = String(rows.length - visible);
    }
  }
}

function positionDayPopover(layout) {
  const panel = layout.querySelector('.calendar-day-panel');
  if (!panel || panel.hidden) return;
  const desktop = typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(min-width: 901px)').matches
    : globalThis.innerWidth > 900;
  if (!desktop) {
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    return;
  }
  const date = panel.dataset.selectedDate;
  const anchor = layout.querySelector(`.calendar-date-cell[data-calendar-date="${date}"]`);
  if (!anchor) return;
  const bounds = (layout.closest('.site-calendar-modal') || document.documentElement).getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const width = Math.min(panel.offsetWidth || 400, Math.max(320, bounds.width - 24));
  const height = panel.offsetHeight || 320;
  let left = anchorRect.right + 10;
  if (left + width > bounds.right - 12) left = anchorRect.left - width - 10;
  left = Math.max(bounds.left + 12, Math.min(left, bounds.right - width - 12));
  const top = Math.max(bounds.top + 12, Math.min(anchorRect.top, bounds.bottom - height - 12));
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function syncMonthLayout(layout) {
  fitMonthEventDensity(layout);
  positionDayPopover(layout);
}

function renderMonth(state, actions) {
  const layout = document.createElement('div');
  layout.className = 'calendar-month-layout';
  layout.dataset.detailOpen = String(state.detailOpen);
  const calendar = document.createElement('section');
  calendar.className = 'calendar-month';
  const weekdays = document.createElement('div');
  weekdays.className = 'calendar-weekdays';
  weekdays.setAttribute('aria-hidden', 'true');
  for (const label of ['일', '월', '화', '수', '목', '금', '토']) {
    const day = document.createElement('span'); day.textContent = label; weekdays.appendChild(day);
  }
  const grid = document.createElement('div');
  grid.className = 'calendar-month-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `${state.year}년 ${state.month}월`);
  const groups = groupCalendarEvents(state.items);
  const attentionDates = new Set(state.attention.map(item => item?.due_date).filter(validCivilDate));
  const weatherByDate = calendarWeatherByDate(state.weather);
  const cells = calendarMonthGrid(state.year, state.month);
  grid.dataset.weekCount = String(cells.length / 7);

  for (const cell of cells) {
    const events = groups.get(cell.date) || [];
    const selected = cell.date === state.selectedDate;
    const today = cell.date === state.todayDate;
    const hasAttention = attentionDates.has(cell.date);
    const weather = weatherByDate.get(cell.date) || null;

    const cellNode = document.createElement('div');
    cellNode.className = 'calendar-date-cell';
    cellNode.dataset.calendarDate = cell.date;
    cellNode.dataset.currentMonth = String(cell.inCurrentMonth);
    cellNode.dataset.selected = String(selected);
    cellNode.dataset.today = String(today);
    cellNode.dataset.attention = String(hasAttention);
    cellNode.setAttribute('role', 'gridcell');
    cellNode.setAttribute('aria-selected', String(selected));

    const header = document.createElement('div');
    header.className = 'calendar-date-header';
    const date = button(String(cell.day), 'calendar-date-trigger');
    date.dataset.calendarDateTrigger = cell.date;
    date.dataset.selected = String(selected);
    date.setAttribute('aria-label', buildCalendarAriaLabel(cell, events.length, {today, selected, attention: hasAttention, weather}));
    if (today) date.setAttribute('aria-current', 'date');
    date.tabIndex = selected ? 0 : -1;
    const number = document.createElement('span');
    number.className = 'calendar-date-number';
    number.textContent = String(cell.day);
    date.textContent = '';
    date.appendChild(number);
    date.addEventListener('click', event => {
      event.stopPropagation();
      void actions.selectDate(cell.date, {openDetail: true});
    });
    date.addEventListener('keydown', event => actions.onDateKey(event, cell.date));

    const count = document.createElement('span');
    count.className = 'calendar-mobile-event-count';
    count.textContent = events.length ? `${events.length}개` : '';
    count.setAttribute('aria-hidden', 'true');
    header.append(date, count);
    if (weather) {
      const weatherIcon = document.createElement('span');
      weatherIcon.className = 'calendar-weather-icon';
      weatherIcon.dataset.weatherKind = weather.weatherKind;
      weatherIcon.textContent = weather.weatherIcon;
      weatherIcon.title = weather.label;
      weatherIcon.setAttribute('aria-hidden', 'true');
      header.appendChild(weatherIcon);
    }
    if (hasAttention) {
      const marker = document.createElement('span');
      marker.className = 'calendar-attention-marker';
      marker.textContent = '확인 필요';
      marker.setAttribute('aria-hidden', 'true');
      header.appendChild(marker);
    }

    const stack = document.createElement('div');
    stack.className = 'calendar-event-stack';
    for (const item of events) stack.appendChild(monthEventRow(item, actions.onEvent));
    const more = button('', 'calendar-event-overflow');
    more.dataset.eventOverflow = '';
    more.hidden = true;
    more.addEventListener('click', event => {
      event.stopPropagation();
      void actions.selectDate(cell.date, {openDetail: true});
    });
    stack.appendChild(more);

    cellNode.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      void actions.selectDate(cell.date, {openDetail: true});
    });
    cellNode.append(header, stack);
    grid.appendChild(cellNode);
  }

  calendar.append(weekdays, grid);
  layout.append(calendar, dayPanel(state, groups, actions));
  const schedule = globalThis.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 0));
  schedule(() => { if (layout.isConnected) syncMonthLayout(layout); });
  return layout;
}

function renderYear(state, actions) {
  const grid = document.createElement('div');
  grid.className = 'calendar-year-grid';
  grid.setAttribute('aria-label', `${state.year}년 연간 달력`);
  const counts = countCalendarEventsByMonth(state.items, state.year);
  for (const month of calendarYearOverview(state.year)) {
    const card = button('', 'calendar-year-month');
    card.dataset.yearMonth = String(month.month);
    card.dataset.current = String(state.year === civilDateParts(state.todayDate).year && month.month === civilDateParts(state.todayDate).month);
    const title = document.createElement('strong'); title.textContent = month.label;
    const weekdays = document.createElement('span'); weekdays.className = 'calendar-mini-weekdays'; weekdays.textContent = '일 월 화 수 목 금 토';
    const dates = document.createElement('span'); dates.className = 'calendar-mini-grid';
    for (const cell of month.cells) {
      const day = document.createElement('span'); day.textContent = cell.inCurrentMonth ? String(cell.day) : ''; dates.appendChild(day);
    }
    const count = document.createElement('span'); count.className = 'calendar-year-event-count'; count.textContent = `일정 ${counts[month.month - 1]}개`;
    card.append(title, weekdays, dates, count);
    card.setAttribute('aria-label', `${state.year}년 ${month.month}월, 일정 ${counts[month.month - 1]}개, 월간 보기`);
    card.addEventListener('click', () => actions.selectMonth(month.month));
    grid.appendChild(card);
  }
  return grid;
}

function renderAgenda(state, actions) {
  const section = document.createElement('section');
  section.className = 'calendar-agenda-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'calendar-agenda-toolbar';
  toolbar.setAttribute('aria-label', '일정 범위');
  for (const [scope, label] of [['month', '이번 달'], ['today', '오늘'], ['week', '이번 주']]) {
    const control = button(label, 'calendar-agenda-range');
    control.dataset.agendaScope = scope;
    control.setAttribute('aria-pressed', String(state.agendaScope === scope));
    control.addEventListener('click', () => actions.setAgendaScope(scope));
    toolbar.appendChild(control);
  }
  section.appendChild(toolbar);

  let items = sortCalendarEvents(state.items);
  if (state.agendaScope === 'today') {
    items = items.filter(item => item.local_date === state.todayDate);
  } else if (state.agendaScope === 'week') {
    const range = weekBounds(state.todayDate);
    items = items.filter(item => item.local_date >= range.start && item.local_date <= range.end);
  }

  const showUnscheduled = state.agendaScope === 'month' && state.unscheduled.length > 0;
  if (!items.length && !showUnscheduled) {
    section.appendChild(emptyMessage(
      state.agendaScope === 'today' ? '오늘 등록된 일정이 없어요.'
        : state.agendaScope === 'week' ? '이번 주에 등록된 일정이 없어요.'
          : '이 달에는 일정이 없어요.',
    ));
    return section;
  }

  const groups = groupCalendarEvents(items);
  for (const [date, values] of groups) {
    const group = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = koreanDate(date);
    group.append(heading, eventList(values, {onSelect: actions.onEvent}));
    section.appendChild(group);
  }
  if (showUnscheduled) {
    const group = document.createElement('section');
    group.className = 'calendar-unscheduled-group';
    const heading = document.createElement('h3');
    heading.textContent = '날짜 미정';
    const note = document.createElement('p');
    note.className = 'calendar-unscheduled-note';
    note.textContent = '날짜를 정하지 않은 일정입니다. 열어서 날짜를 추가하거나 그대로 둘 수 있어요.';
    group.append(heading, note, eventList(state.unscheduled, {onSelect: actions.onEvent}));
    section.appendChild(group);
  }
  return section;
}

function renderAttention(state) {
  if (!state.attention.length) return emptyMessage('확인이 필요한 일정이 없어요.');
  return eventList(state.attention.map(item => ({
    ...item,
    local_date: item.due_date,
    local_datetime: null,
    calendar_attention_state: item.state,
  })));
}

function calendarEditorDialog({root, item, selectedDate, initialDraft = null, authenticated, controller, onSaved, onStale, onClose = () => {}}) {
  root.querySelector('.calendar-editor-backdrop')?.remove();
  document.body.classList.remove('calendar-editor-open');

  const backdrop = document.createElement('div'); backdrop.className = 'calendar-editor-backdrop';
  const dialog = document.createElement('section'); dialog.className = 'calendar-editor-dialog';
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'calendar-editor-heading');
  const draft = !item && initialDraft && typeof initialDraft === 'object' ? initialDraft : null;
  const heading = document.createElement('h3'); heading.id = 'calendar-editor-heading'; heading.textContent = item ? '일정 수정' : (draft ? '일정 초안 확인' : '일정 추가');
  const editorHeader = document.createElement('div'); editorHeader.className = 'calendar-editor-header';
  const closeButton = button('×', 'calendar-editor-close'); closeButton.setAttribute('aria-label', '닫기');
  editorHeader.append(heading, closeButton);
  const form = document.createElement('form'); form.className = 'calendar-editor-form';
  const editorBody = document.createElement('div'); editorBody.className = 'calendar-editor-body';

  document.body.classList.add('calendar-editor-open');
  let viewportCleanup = () => {};
  if (usesFlowingDayDetail() && globalThis.visualViewport) {
    const viewport = globalThis.visualViewport;
    const syncEditorViewport = () => {
      backdrop.style.setProperty('--calendar-editor-visual-height', `${Math.max(1, Math.round(viewport.height))}px`);
      backdrop.style.setProperty('--calendar-editor-visual-top', `${Math.max(0, Math.round(viewport.offsetTop || 0))}px`);
    };
    syncEditorViewport();
    viewport.addEventListener('resize', syncEditorViewport);
    viewport.addEventListener('scroll', syncEditorViewport);
    viewportCleanup = () => {
      viewport.removeEventListener('resize', syncEditorViewport);
      viewport.removeEventListener('scroll', syncEditorViewport);
    };
  }
  let editorEnvironmentReleased = false;
  const releaseEditorEnvironment = () => {
    if (editorEnvironmentReleased) return;
    editorEnvironmentReleased = true;
    viewportCleanup();
    document.body.classList.remove('calendar-editor-open');
  };

  const titleLabel = document.createElement('label'); titleLabel.textContent = '일정 제목 *';
  const titleInput = document.createElement('input'); titleInput.className = 'calendar-editor-title'; titleInput.name = 'calendar-title'; titleInput.required = true; titleInput.maxLength = 240; titleInput.value = item?.title || draft?.title || '';
  titleLabel.appendChild(titleInput);
  const titleNote = document.createElement('small'); titleNote.id = 'calendar-editor-title-note'; titleNote.textContent = '제목만 있으면 저장할 수 있어요. 나머지는 선택 사항입니다.';

  const dateLabel = document.createElement('label'); dateLabel.textContent = '날짜';
  const dateInput = document.createElement('input'); dateInput.className = 'calendar-editor-date'; dateInput.type = 'date'; dateInput.value = item?.local_date || canonicalActivityLocalDate(item) || (draft ? (draft.localDate || '') : (selectedDate || '')); dateLabel.appendChild(dateInput);

  const allDayLabel = document.createElement('label'); allDayLabel.className = 'calendar-editor-all-day';
  const allDayInput = document.createElement('input'); allDayInput.type = 'checkbox'; allDayInput.checked = item ? isAllDay(item) : !draft?.localTime; allDayLabel.append(allDayInput, document.createTextNode('종일'));

  const timeLabel = document.createElement('label'); timeLabel.textContent = '시간';
  const timeInput = document.createElement('input'); timeInput.className = 'calendar-editor-time'; timeInput.type = 'time'; timeInput.value = item?.local_datetime?.slice(11, 16) || draft?.localTime || '';

  const syncTemporalControls = () => {
    const hasDate = Boolean(dateInput.value);
    allDayInput.disabled = !hasDate;
    timeInput.disabled = !hasDate || allDayInput.checked;
    if (!hasDate) timeInput.value = '';
  };
  dateInput.addEventListener('change', syncTemporalControls);
  allDayInput.addEventListener('change', syncTemporalControls);
  syncTemporalControls();
  timeLabel.appendChild(timeInput);

  const entry = item?.entry && typeof item.entry === 'object'
    ? item.entry
    : draft?.entry && typeof draft.entry === 'object'
      ? {
          amount_minor: draft.entry.amountMinor,
          currency: draft.entry.currency,
          expense_category: draft.entry.expenseCategory,
          memo: draft.entry.memo,
          place: draft.entry.place,
          merchant: draft.entry.merchant,
        }
      : {};
  const amountLabel = document.createElement('label'); amountLabel.textContent = '비용';
  const amountInput = document.createElement('input'); amountInput.className = 'calendar-editor-amount'; amountInput.type = 'number'; amountInput.inputMode = 'numeric'; amountInput.min = '0'; amountInput.step = '1'; amountInput.placeholder = '0'; amountInput.value = Number.isInteger(entry.amount_minor) ? String(entry.amount_minor) : ''; amountLabel.appendChild(amountInput);

  const categoryLabel = document.createElement('label'); categoryLabel.textContent = '비용 종류';
  const categoryInput = document.createElement('select'); categoryInput.className = 'calendar-editor-category';
  for (const [value, label] of [['', '미분류'], ['FOOD', '음식'], ['TRAVEL', '여행'], ['SHOPPING', '쇼핑'], ['LIVING', '기타 / 생활비']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; categoryInput.appendChild(option);
  }
  categoryInput.value = entry.expense_category === 'UNCLASSIFIED' ? '' : (entry.expense_category || '');
  categoryLabel.appendChild(categoryInput);

  const memoLabel = document.createElement('label'); memoLabel.className = 'calendar-editor-wide'; memoLabel.textContent = '메모';
  const memoInput = document.createElement('textarea'); memoInput.className = 'calendar-editor-memo'; memoInput.maxLength = 2000; memoInput.rows = 3; memoInput.value = entry.memo || ''; memoLabel.appendChild(memoInput);

  const placeLabel = document.createElement('label'); placeLabel.className = 'calendar-editor-wide'; placeLabel.textContent = '장소';
  const placeInput = document.createElement('input'); placeInput.className = 'calendar-editor-place'; placeInput.maxLength = 240; placeInput.value = entry.place || ''; placeLabel.appendChild(placeInput);

  const merchantLabel = document.createElement('label'); merchantLabel.className = 'calendar-editor-wide'; merchantLabel.textContent = '상점 · 예약처';
  const merchantInput = document.createElement('input'); merchantInput.className = 'calendar-editor-merchant'; merchantInput.maxLength = 240; merchantInput.value = entry.merchant || ''; merchantLabel.appendChild(merchantInput);

  const error = document.createElement('p'); error.className = 'calendar-editor-error'; error.setAttribute('role', 'alert');
  const actions = document.createElement('div'); actions.className = 'calendar-editor-actions';
  const cancel = button('취소', 'calendar-editor-cancel');
  const save = button('저장', 'calendar-editor-save'); save.type = 'submit';
  actions.append(cancel, save);

  let cleanupDeleteConfirmation = () => {};
  let deleteRequestInFlight = false;

  if (item) {
    const remove = button('삭제', 'calendar-editor-delete');
    actions.prepend(remove);
    remove.addEventListener('click', () => {
      const existing = root.querySelector('.calendar-delete-confirm-backdrop');
      if (existing) {
        existing.querySelector('.calendar-delete-confirm-cancel')?.focus();
        return;
      }

      const confirmationBackdrop = document.createElement('div');
      confirmationBackdrop.className = 'calendar-delete-confirm-backdrop';
      const confirmationDialog = document.createElement('section');
      confirmationDialog.className = 'calendar-delete-confirm-dialog';
      confirmationDialog.setAttribute('role', 'dialog');
      confirmationDialog.setAttribute('aria-modal', 'true');
      confirmationDialog.setAttribute('aria-labelledby', 'calendar-delete-confirm-title');
      confirmationDialog.setAttribute('aria-describedby', 'calendar-delete-confirm-description');

      const confirmationTitle = document.createElement('h4');
      confirmationTitle.id = 'calendar-delete-confirm-title';
      confirmationTitle.textContent = '이 일정을 삭제하시겠습니까?';
      const confirmationDescription = document.createElement('p');
      confirmationDescription.id = 'calendar-delete-confirm-description';
      confirmationDescription.textContent = '삭제한 일정은 복구할 수 없습니다.';
      const confirmationError = document.createElement('p');
      confirmationError.className = 'calendar-delete-confirm-error';
      confirmationError.setAttribute('role', 'alert');

      const confirmationActions = document.createElement('div');
      confirmationActions.className = 'calendar-delete-confirm-actions';
      const cancelDelete = button('취소', 'calendar-delete-confirm-cancel');
      const confirmDelete = button('삭제', 'calendar-delete-confirm-submit');
      confirmationActions.append(cancelDelete, confirmDelete);
      confirmationDialog.append(confirmationTitle, confirmationDescription, confirmationError, confirmationActions);
      confirmationBackdrop.appendChild(confirmationDialog);

      dialog.inert = true;
      dialog.setAttribute('aria-hidden', 'true');

      cleanupDeleteConfirmation = ({restoreFocus = true} = {}) => {
        confirmationBackdrop.remove();
        dialog.inert = false;
        dialog.removeAttribute('aria-hidden');
        deleteRequestInFlight = false;
        cleanupDeleteConfirmation = () => {};
        if (restoreFocus && remove.isConnected) remove.focus();
      };

      const cancelConfirmation = () => {
        if (deleteRequestInFlight) return;
        cleanupDeleteConfirmation();
      };

      cancelDelete.addEventListener('click', cancelConfirmation);
      confirmationBackdrop.addEventListener('click', event => {
        if (event.target === confirmationBackdrop) cancelConfirmation();
      });
      confirmationDialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancelConfirmation();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [cancelDelete, confirmDelete].filter(control => !control.disabled);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      confirmDelete.addEventListener('click', async () => {
        if (deleteRequestInFlight) return;
        deleteRequestInFlight = true;
        confirmationError.textContent = '';
        remove.disabled = true;
        cancelDelete.disabled = true;
        confirmDelete.disabled = true;
        try {
          await controller.remove(item);
          cleanupDeleteConfirmation({restoreFocus: false});
          releaseEditorEnvironment();
          backdrop.remove();
          await onSaved();
        } catch (caught) {
          deleteRequestInFlight = false;
          remove.disabled = false;
          cancelDelete.disabled = false;
          confirmDelete.disabled = false;
          confirmationError.textContent = caught?.code === 'STALE_REVISION'
            ? '일정이 변경되었습니다. 저장 상태를 확인한 뒤 다시 시도해주세요.'
            : '일정을 삭제하지 못했습니다. 다시 시도해주세요.';
          confirmDelete.focus();
        }
      });

      root.appendChild(confirmationBackdrop);
      queueMicrotask(() => cancelDelete.focus());
    });
  }

  editorBody.append(
    titleLabel, titleNote, dateLabel, allDayLabel, timeLabel,
    amountLabel, categoryLabel, memoLabel, placeLabel, merchantLabel,
    error,
  );
  form.append(editorBody, actions);
  dialog.append(editorHeader, form); backdrop.appendChild(dialog); root.appendChild(backdrop);

  const close = () => {
    cleanupDeleteConfirmation({restoreFocus: false});
    releaseEditorEnvironment();
    backdrop.remove();
    onClose();
  };
  closeButton.addEventListener('click', close);
  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  form.addEventListener('focusin', event => {
    if (!usesFlowingDayDetail()) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== 'function') return;
    const reveal = () => target.scrollIntoView({block: 'nearest', inline: 'nearest'});
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(reveal);
    else setTimeout(reveal, 0);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = '';
    const value = {
      title: titleInput.value,
      localDate: dateInput.value,
      time: timeInput.value,
      allDay: allDayInput.checked,
      amountMinor: amountInput.value,
      expenseCategory: categoryInput.value || null,
      memo: memoInput.value,
      place: placeInput.value,
      merchant: merchantInput.value,
    };
    save.disabled = true;
    try {
      if (item) await controller.update(item, value); else await controller.create(value);
      cleanupDeleteConfirmation({restoreFocus: false});
      releaseEditorEnvironment();
      backdrop.remove(); await onSaved();
    } catch (caught) {
      if (caught?.code === 'STALE_REVISION') { error.textContent = '다른 변경이 반영되어 일정을 새로 불러왔어요.'; await onStale(); }
      else error.textContent = caught instanceof Error ? caught.message : '일정을 저장하지 못했습니다.';
      save.disabled = false;
    }
  });
  queueMicrotask(() => titleInput.focus());
}

export async function mountLifeCalendarManager({
  sessionToken,
  root,
  initialView = 'month',
  timezone = resolvedTimezone(),
  now,
  fetchImpl = globalThis.fetch,
  guestRepository,
  deepOpen,
  initialDraft = null,
  weatherLocation = null,
  locationProvider = globalThis.navigator?.geolocation,
  locationPermissions = globalThis.navigator?.permissions,
  locationNow = Date.now,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  const clock = typeof now === 'function'
    ? now
    : now instanceof Date
      ? () => now
      : () => new Date();
  const currentNow = () => {
    const value = clock();
    return value instanceof Date ? value : new Date(value);
  };
  const todayDate = dateInTimezone(currentNow(), timezone);
  const deepOpenTarget = normalizedDeepOpen(deepOpen);
  const initialDate = deepOpenTarget?.dateHint || initialDraft?.localDate || todayDate;
  const initialParts = civilDateParts(initialDate);
  const repository = authenticated ? null : (guestRepository || createGuestCalendarRepository(globalThis.localStorage));
  const mutationController = createCalendarMutationController({sessionToken, timezone, guestRepository: repository, fetchImpl});
  let currentWeatherLocation = weatherLocation;
  const state = {
    mode: normalizeMode(initialView), selectedDate: initialDate, todayDate,
    year: initialParts.year, month: initialParts.month, items: [], attention: [], unscheduled: [], weather: [], loading: false,
    detailOpen: usesFlowingDayDetail(), dayCollapsed: false, agendaScope: 'month',
    locationInFlight: false,
    locationPermission: LOCATION_PERMISSION.UNKNOWN,
    locationResolution: currentWeatherLocation?.source === 'BROWSER_CURRENT' ? LOCATION_RESOLUTION.RESOLVED : LOCATION_RESOLUTION.IDLE,
    locationMessage: '',
  };

  const shell = document.createElement('div'); shell.className = 'calendar-product-shell';
  const toolbar = document.createElement('header'); toolbar.className = 'calendar-toolbar';
  const previous = button('이전', 'calendar-nav-button'); previous.setAttribute('aria-label', '이전 달');
  const title = button('', 'calendar-title-button');
  const next = button('다음', 'calendar-nav-button'); next.setAttribute('aria-label', '다음 달');
  const today = button('오늘', 'calendar-today-button');
  const modes = document.createElement('div'); modes.className = 'calendar-mode-tabs'; modes.setAttribute('role', 'tablist'); modes.setAttribute('aria-label', '캘린더 보기');
  const modeButtons = new Map();
  for (const [mode, label] of MODES) {
    const control = button(label, 'calendar-mode-tab'); control.dataset.calendarMode = mode; control.setAttribute('role', 'tab'); modeButtons.set(mode, control); modes.appendChild(control);
  }
  toolbar.append(previous, title, next, today, modes);
  const status = document.createElement('div'); status.className = 'calendar-status'; status.setAttribute('aria-live', 'polite');
  const locationButton = button('현재 위치 사용', 'calendar-today-button');
  locationButton.dataset.calendarCurrentLocation = 'true';
  locationButton.setAttribute('aria-label', '현재 위치를 캘린더 날씨에 사용');
  const viewport = document.createElement('div'); viewport.className = 'calendar-viewport';
  shell.append(toolbar, status, viewport); root.replaceChildren(shell);

  const updateChrome = () => {
    title.textContent = state.mode === 'year' ? `${state.year}년` : `${state.year}년 ${state.month}월`;
    title.setAttribute('aria-label', state.mode === 'year' ? `${state.year}년 월간 보기` : `${state.year}년 연간 보기`);
    for (const [mode, control] of modeButtons) {
      const selected = state.mode === mode; control.setAttribute('aria-selected', String(selected)); control.tabIndex = selected ? 0 : -1;
    }
    root.dataset.calendarManagerView = state.mode;
    root.dataset.calendarAccess = authenticated ? 'authenticated' : 'guest';
  };

  let openEditor = () => {};
  const actions = {
    selectDate: async (date, {openDetail = false} = {}) => {
      const parts = civilDateParts(date);
      const monthChanged = parts.year !== state.year || parts.month !== state.month;
      state.selectedDate = date;
      state.year = parts.year;
      state.month = parts.month;
      state.detailOpen = openDetail;
      state.dayCollapsed = false;
      if (monthChanged && authenticated) await refresh(); else render();
      queueMicrotask(() => root.querySelector(`[data-calendar-date-trigger="${date}"]`)?.focus());
    },
    selectMonth: async month => {
      state.month = month;
      state.selectedDate = `${state.year}-${String(month).padStart(2, "0")}-01`;
      state.mode = 'month';
      state.detailOpen = usesFlowingDayDetail();
      await refresh();
    },
    onDateKey: (event, date) => {
      const offsets = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};
      switch (event.key) {
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
          event.preventDefault(); void actions.selectDate(addCivilDays(date, offsets[event.key])); break;
        case 'Home': {
          event.preventDefault();
          const {year, month, day} = civilDateParts(date);
          const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
          void actions.selectDate(addCivilDays(date, -weekday));
          break;
        }
        case 'End': {
          event.preventDefault();
          const {year, month, day} = civilDateParts(date);
          const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
          void actions.selectDate(addCivilDays(date, 6 - weekday));
          break;
        }
        case 'PageUp':
          event.preventDefault(); void actions.selectDate(shiftCivilMonth(date, -1)); break;
        case 'PageDown':
          event.preventDefault(); void actions.selectDate(shiftCivilMonth(date, 1)); break;
        case 'Enter': case ' ':
          event.preventDefault(); void actions.selectDate(date, {openDetail: true}); break;
        case 'Escape':
          if (state.detailOpen) { event.preventDefault(); actions.closeDay(); }
          break;
        default: break;
      }
    },
    closeDay: () => {
      const date = state.selectedDate;
      state.detailOpen = false;
      state.dayCollapsed = false;
      render();
      queueMicrotask(() => root.querySelector(`[data-calendar-date-trigger="${date}"]`)?.focus());
    },
    toggleDay: () => {
      state.dayCollapsed = !state.dayCollapsed;
      render();
      queueMicrotask(() => root.querySelector('.calendar-day-toggle')?.focus());
    },
    setAgendaScope: async scope => {
      state.agendaScope = ['month', 'today', 'week'].includes(scope) ? scope : 'month';
      if (state.agendaScope === 'today' || state.agendaScope === 'week') {
        const parts = civilDateParts(state.todayDate);
        const monthChanged = parts.year !== state.year || parts.month !== state.month;
        state.selectedDate = state.todayDate;
        state.year = parts.year;
        state.month = parts.month;
        if (monthChanged && authenticated) await refresh();
        else render();
      } else {
        render();
      }
      queueMicrotask(() => root.querySelector(`[data-agenda-scope="${state.agendaScope}"]`)?.focus());
    },
    onAdd: date => openEditor(null, date),
    onEvent: item => openEditor(item, item.local_date || item.due_date || ''),
  };

  root.addEventListener('keydown', event => {
    if (
      event.key === 'Escape'
      && state.mode === 'month'
      && state.detailOpen
      && !root.querySelector('.calendar-editor-dialog')
    ) {
      event.preventDefault();
      event.stopPropagation();
      actions.closeDay();
    }
  }, true);

  let refreshGeneration = 0;
  let locationRequestGeneration = 0;

  async function syncLocationPermission() {
    const permission = await getBrowserLocationPermissionState({
      permissions: locationPermissions,
      geolocation: locationProvider,
    });
    if (!root.isConnected) return;
    state.locationPermission = permission;
    if (permission === LOCATION_PERMISSION.DENIED) {
      state.locationResolution = LOCATION_RESOLUTION.IDLE;
      state.locationMessage = '위치 권한이 꺼져 있어요.';
    } else if (permission === LOCATION_PERMISSION.UNAVAILABLE) {
      state.locationResolution = LOCATION_RESOLUTION.ERROR;
      state.locationMessage = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    }
  }

  function clearBrowserLocationProvenance() {
    delete root.dataset.locationSource;
    delete root.dataset.locationAccuracyMeters;
    delete root.dataset.locationApproximation;
    delete root.dataset.locationTimestamp;
  }

  function locationErrorCopy(error) {
    if (!(error instanceof BrowserLocationError)) return '현재 위치를 확인하지 못했어요.';
    if (error.code === 'BROWSER_LOCATION_DENIED') return '위치 권한이 꺼져 있어요.';
    if (error.code === 'BROWSER_LOCATION_TIMEOUT') return '현재 위치를 확인하지 못했어요.';
    if (error.code === 'BROWSER_LOCATION_UNSUPPORTED') return '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    if (error.code === 'BROWSER_LOCATION_STALE') return '현재 위치가 오래되어 다시 확인이 필요해요.';
    return '현재 위치를 확인할 수 없어요.';
  }

  function render() {
    updateChrome();
    status.replaceChildren();
    if (state.loading) {
      const loading = document.createElement('div'); loading.className = 'calendar-skeleton'; loading.textContent = '일정을 불러오는 중'; status.appendChild(loading);
    } else if (authenticated) {
      const usingBrowserLocation = currentWeatherLocation?.source === 'BROWSER_CURRENT'
        && state.locationResolution === LOCATION_RESOLUTION.RESOLVED;
      root.dataset.locationPermission = state.locationPermission;
      root.dataset.locationResolution = state.locationResolution;

      if (usingBrowserLocation) {
        const locationLabel = document.createElement('span');
        locationLabel.className = 'calendar-location-status';
        locationLabel.textContent = '📍 현재 위치';
        status.appendChild(locationLabel);
      }

      const canRequestLocation = state.locationPermission !== LOCATION_PERMISSION.DENIED
        && state.locationPermission !== LOCATION_PERMISSION.UNAVAILABLE;
      if (state.locationInFlight || canRequestLocation) {
        locationButton.disabled = state.locationInFlight;
        if (state.locationInFlight) locationButton.textContent = '위치 확인 중…';
        else if (usingBrowserLocation) locationButton.textContent = '변경';
        else if (state.locationResolution === LOCATION_RESOLUTION.TIMEOUT || state.locationResolution === LOCATION_RESOLUTION.ERROR) locationButton.textContent = '다시 시도';
        else locationButton.textContent = '현재 위치 사용';
        locationButton.setAttribute('aria-pressed', String(usingBrowserLocation));
        status.appendChild(locationButton);
      }

      if (state.locationMessage) {
        const locationMessage = document.createElement('span');
        locationMessage.className = 'calendar-location-status';
        locationMessage.textContent = state.locationMessage;
        status.appendChild(locationMessage);
      }
    }
    if (state.mode === 'year') viewport.replaceChildren(renderYear(state, actions));
    else if (state.mode === 'agenda') viewport.replaceChildren(renderAgenda(state, actions));
    else if (state.mode === 'attention') viewport.replaceChildren(renderAttention(state));
    else viewport.replaceChildren(renderMonth(state, actions));
  }

  async function refresh() {
    const requestGeneration = ++refreshGeneration;
    state.loading = true; render(); root.setAttribute('aria-busy', 'true');
    try {
      if (
        currentWeatherLocation?.source === 'BROWSER_CURRENT'
        && !isFreshBrowserCurrentLocation(currentWeatherLocation, {now: locationNow})
      ) {
        currentWeatherLocation = null;
        clearBrowserLocationProvenance();
        state.locationResolution = LOCATION_RESOLUTION.IDLE;
        state.locationMessage = '현재 위치가 오래되어 다시 확인이 필요해요.';
      }
      if (authenticated) {
        const result = await loadLifeCalendarManagerView(sessionToken, {view: state.mode, date: state.selectedDate, timezone, now: currentNow(), fetchImpl, weatherLocation: currentWeatherLocation});
        if (!root.isConnected || requestGeneration !== refreshGeneration) return;
        if (result.kind === 'attention') state.attention = result.items;
        else {
          state.items = result.items;
          state.unscheduled = result.unscheduled || [];
          if (result.key === 'month') {
            state.attention = result.attention || [];
            state.weather = result.weather || [];
          } else {
            state.weather = [];
          }
        }
      } else {
        if (!root.isConnected || requestGeneration !== refreshGeneration) return;
        const guestItems = repository.list();
        state.items = guestItems.filter(item => validCivilDate(item.local_date));
        state.unscheduled = guestItems.filter(item => !validCivilDate(item.local_date));
        state.attention = [];
        state.weather = [];
      }
      state.loading = false; render();
    } catch (error) {
      if (!root.isConnected || requestGeneration !== refreshGeneration) return;
      state.loading = false; render();
      const message = document.createElement('p'); message.className = 'life-calendar-error';
      message.textContent = error instanceof SiteCoreError && (error.status === 401 || error.status === 403)
        ? '일정을 보려면 LOTBI에 다시 로그인해 주세요.' : '일정을 불러오지 못했습니다.';
      const retry = button('다시 시도', 'calendar-retry-button'); retry.addEventListener('click', () => { void refresh(); });
      status.replaceChildren(message, retry);
    } finally {
      if (requestGeneration === refreshGeneration) root.removeAttribute('aria-busy');
    }
  }

  const focusCalendarContext = (origin, item) => {
    queueMicrotask(() => {
      const eventId = item?.id || item?.activity_id || '';
      const eventCandidate = eventId
        ? root.querySelector(`[data-calendar-event-id="${eventId}"]`)
        : null;
      const eventTarget = eventCandidate?.getClientRects?.().length ? eventCandidate : null;
      const dateTarget = origin.mode === 'month'
        ? root.querySelector(`[data-calendar-date-trigger="${origin.selectedDate}"]`)
        : null;
      const agendaTarget = origin.mode === 'agenda'
        ? root.querySelector(`[data-agenda-scope="${origin.agendaScope}"]`)
        : null;
      const modeTarget = modeButtons.get(origin.mode);
      (eventTarget || dateTarget || agendaTarget || modeTarget)?.focus();
    });
  };

  openEditor = (item, date, draft = null) => {
    const origin = Object.freeze({
      mode: state.mode,
      selectedDate: state.selectedDate,
      year: state.year,
      month: state.month,
      agendaScope: state.agendaScope,
      detailOpen: state.detailOpen,
      dayCollapsed: state.dayCollapsed,
    });
    return calendarEditorDialog({
      root, item, selectedDate: date, initialDraft: draft, authenticated, controller: mutationController,
      onSaved: async () => {
        state.mode = origin.mode;
        state.selectedDate = origin.selectedDate;
        state.year = origin.year;
        state.month = origin.month;
        state.agendaScope = origin.agendaScope;
        state.detailOpen = origin.detailOpen;
        state.dayCollapsed = origin.dayCollapsed;
        await refresh();
        focusCalendarContext(origin, item);
        window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh', {detail: {source: root}}));
      },
      onStale: refresh,
      onClose: () => focusCalendarContext(origin, item),
    });
  };

  locationButton.addEventListener('click', async () => {
    if (!authenticated || state.locationInFlight) return;
    const requestGeneration = ++locationRequestGeneration;
    const previousPermission = await getBrowserLocationPermissionState({
      permissions: locationPermissions,
      geolocation: locationProvider,
    });
    if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;

    state.locationPermission = previousPermission;
    if (previousPermission === LOCATION_PERMISSION.DENIED) {
      state.locationResolution = LOCATION_RESOLUTION.IDLE;
      state.locationMessage = '위치 권한이 꺼져 있어요.';
      render();
      return;
    }
    if (previousPermission === LOCATION_PERMISSION.UNAVAILABLE) {
      state.locationResolution = LOCATION_RESOLUTION.ERROR;
      state.locationMessage = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
      render();
      return;
    }

    state.locationInFlight = true;
    state.locationResolution = LOCATION_RESOLUTION.REQUESTING;
    state.locationMessage = '';
    render();
    try {
      const location = await requestBrowserCurrentLocation({
        geolocation: locationProvider,
        now: locationNow,
      });
      if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
      currentWeatherLocation = location;
      state.locationPermission = LOCATION_PERMISSION.GRANTED;
      state.locationResolution = LOCATION_RESOLUTION.RESOLVED;
      root.dataset.locationSource = location.source;
      root.dataset.locationAccuracyMeters = String(location.accuracyMeters);
      root.dataset.locationApproximation = location.approximationState;
      root.dataset.locationTimestamp = location.timestamp;
      state.locationMessage = '';
      await refresh();
    } catch (error) {
      if (!root.isConnected || requestGeneration !== locationRequestGeneration) return;
      currentWeatherLocation = null;
      clearBrowserLocationProvenance();
      if (error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_DENIED') {
        state.locationPermission = LOCATION_PERMISSION.DENIED;
        state.locationResolution = LOCATION_RESOLUTION.IDLE;
      } else if (error instanceof BrowserLocationError && error.code === 'BROWSER_LOCATION_TIMEOUT') {
        // A timeout is a resolution failure, never a permission denial.
        state.locationPermission = previousPermission === LOCATION_PERMISSION.GRANTED
          ? LOCATION_PERMISSION.GRANTED
          : state.locationPermission;
        state.locationResolution = LOCATION_RESOLUTION.TIMEOUT;
      } else {
        state.locationResolution = LOCATION_RESOLUTION.ERROR;
      }
      state.locationMessage = locationErrorCopy(error);
      await refresh();
    } finally {
      if (requestGeneration === locationRequestGeneration) {
        state.locationInFlight = false;
        render();
      }
    }
  });

  previous.addEventListener('click', async () => {
    if (state.mode === 'year') state.year -= 1;
    else { state.month -= 1; if (state.month < 1) { state.month = 12; state.year -= 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    state.detailOpen = false;
    if (state.mode === 'agenda') state.agendaScope = 'month';
    await refresh();
  });
  next.addEventListener('click', async () => {
    if (state.mode === 'year') state.year += 1;
    else { state.month += 1; if (state.month > 12) { state.month = 1; state.year += 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    state.detailOpen = false;
    if (state.mode === 'agenda') state.agendaScope = 'month';
    await refresh();
  });
  today.addEventListener('click', async () => {
    const parts = civilDateParts(state.todayDate);
    state.year = parts.year;
    state.month = parts.month;
    state.selectedDate = state.todayDate;
    state.mode = 'month';
    state.detailOpen = true;
    state.dayCollapsed = false;
    await refresh();
  });
  title.addEventListener('click', async () => {
    state.mode = state.mode === 'year' ? 'month' : 'year';
    state.detailOpen = state.mode === 'month' && usesFlowingDayDetail();
    state.agendaScope = 'month';
    await refresh();
  });
  for (const [mode, control] of modeButtons) control.addEventListener('click', async () => {
    if (state.mode !== mode) {
      state.mode = mode;
      state.detailOpen = mode === 'month' && usesFlowingDayDetail();
      state.dayCollapsed = false;
      if (mode !== 'agenda') state.agendaScope = 'month';
      await refresh();
    }
  });

  const onResize = () => {
    const layout = viewport.querySelector('.calendar-month-layout');
    if (layout) syncMonthLayout(layout);
  };
  window.addEventListener('resize', onResize);

  const refreshTodayIfNeeded = async () => {
    const nextToday = dateInTimezone(currentNow(), timezone);
    if (nextToday === state.todayDate) return;
    const followedToday = state.selectedDate === state.todayDate;
    state.todayDate = nextToday;
    if (followedToday) {
      const parts = civilDateParts(nextToday);
      const monthChanged = parts.year !== state.year || parts.month !== state.month;
      state.selectedDate = nextToday;
      state.year = parts.year;
      state.month = parts.month;
      if (monthChanged && authenticated) await refresh();
      else render();
      return;
    }
    render();
  };

  const cleanupLifecycle = () => {
    locationRequestGeneration += 1;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('focus', onResume);
    window.removeEventListener('pageshow', onResume);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.clearInterval(todayTimer);
    window.removeEventListener('lotbi:life-calendar-refresh', onRefresh);
  };
  const onResume = () => {
    if (!root.isConnected) { cleanupLifecycle(); return; }
    void refreshTodayIfNeeded();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') onResume();
  };
  window.addEventListener('focus', onResume);
  window.addEventListener('pageshow', onResume);
  document.addEventListener('visibilitychange', onVisibilityChange);
  const todayTimer = window.setInterval(() => {
    if (!root.isConnected) { cleanupLifecycle(); return; }
    void refreshTodayIfNeeded();
  }, 60_000);

  const onRefresh = event => {
    if (!root.isConnected) {
      cleanupLifecycle();
      return;
    }
    if (event.detail?.source === root) return;
    void refresh();
  };
  window.addEventListener('lotbi:life-calendar-refresh', onRefresh);

  const showDeepOpenTerminal = (message, stateName) => {
    state.loading = false;
    updateChrome();
    const notice = document.createElement('p');
    notice.className = 'calendar-deep-open-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    status.replaceChildren(notice);
    viewport.replaceChildren();
    root.dataset.calendarDeepOpen = stateName;
  };

  const openDeepTarget = async () => {
    if (!deepOpenTarget) {
      await refresh();
      if (initialDraft && typeof initialDraft === 'object') {
        root.dataset.calendarDraftOpen = 'opened';
        openEditor(null, initialDraft.localDate || '', initialDraft);
      }
      return;
    }
    if ((authenticated && deepOpenTarget.scope !== 'AUTH') || (!authenticated && deepOpenTarget.scope !== 'GUEST')) {
      showDeepOpenTerminal('이 일정은 현재 캘린더 범위에서 열 수 없습니다.', 'scope-mismatch');
      return;
    }

    let targetItem;
    let latestDate = deepOpenTarget.dateHint;
    let moved = false;
    if (authenticated) {
      let canonical;
      try {
        canonical = await getLifeActivity(sessionToken, deepOpenTarget.activityId, fetchImpl);
      } catch (error) {
        if (error instanceof SiteCoreError && error.status === 404) {
          showDeepOpenTerminal('일정을 찾을 수 없거나 현재 계정에서 접근할 수 없습니다.', 'not-found');
          return;
        }
        showDeepOpenTerminal('일정을 확인하지 못했습니다.', 'lookup-failed');
        return;
      }
      latestDate = canonicalActivityLocalDate(canonical);
      const isUnscheduled = !latestDate && canonical.temporal?.kind === 'UNSCHEDULED';
      if (!latestDate && !isUnscheduled) {
        showDeepOpenTerminal('일정 날짜를 확인하지 못했습니다.', 'invalid-date');
        return;
      }
      if (canonical.activityState === 'REMOVED') {
        showDeepOpenTerminal('삭제된 일정입니다.', 'deleted');
        return;
      }
      if (deepOpenTarget.occurrenceId && canonical.occurrenceId !== deepOpenTarget.occurrenceId) {
        showDeepOpenTerminal('일정의 발생 항목이 변경되어 기존 링크로 열 수 없습니다.', 'occurrence-changed');
        return;
      }
      moved = !isUnscheduled && Boolean(deepOpenTarget.dateHint && deepOpenTarget.dateHint !== latestDate);
      if (isUnscheduled) {
        state.mode = 'agenda';
        state.agendaScope = 'month';
        state.detailOpen = false;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.unscheduled.find(item => (
          item.activity_id === deepOpenTarget.activityId
          && (!deepOpenTarget.occurrenceId || item.occurrence_id === deepOpenTarget.occurrenceId)
        ));
      } else {
        const parts = civilDateParts(latestDate);
        state.mode = 'month';
        state.selectedDate = latestDate;
        state.year = parts.year;
        state.month = parts.month;
        state.detailOpen = true;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.items.find(item => (
          item.activity_id === deepOpenTarget.activityId
          && (!deepOpenTarget.occurrenceId || item.occurrence_id === deepOpenTarget.occurrenceId)
        ));
      }
    } else {
      targetItem = repository.list().find(item => item.id === deepOpenTarget.guestEventId);
      if (!targetItem) {
        showDeepOpenTerminal('삭제된 일정입니다.', 'deleted');
        return;
      }
      latestDate = targetItem.local_date;
      const isUnscheduled = !validCivilDate(latestDate);
      moved = !isUnscheduled && Boolean(deepOpenTarget.dateHint && deepOpenTarget.dateHint !== latestDate);
      if (isUnscheduled) {
        state.mode = 'agenda';
        state.agendaScope = 'month';
        state.detailOpen = false;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.unscheduled.find(item => item.id === deepOpenTarget.guestEventId);
      } else {
        const parts = civilDateParts(latestDate);
        state.mode = 'month';
        state.selectedDate = latestDate;
        state.year = parts.year;
        state.month = parts.month;
        state.detailOpen = true;
        state.dayCollapsed = false;
        await refresh();
        targetItem = state.items.find(item => item.id === deepOpenTarget.guestEventId);
      }
    }

    if (!targetItem) {
      showDeepOpenTerminal('일정을 찾지 못했습니다.', 'not-found');
      return;
    }
    root.dataset.calendarDeepOpen = 'opened';
    if (moved) {
      const notice = document.createElement('p');
      notice.className = 'calendar-deep-open-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = '일정이 변경되어 최신 날짜로 열었습니다.';
      status.replaceChildren(notice);
    }
    openEditor(targetItem, latestDate);
  };

  await syncLocationPermission();
  await openDeepTarget();
  return true;
}
