import {createLifeActivity, getLifeAgenda, getLifeAttention, removeLifeActivity, rescheduleLifeActivity} from './site-calendar.js?v=20260920-calux1';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=20260920-calux1';
import {
  addCivilDays,
  calendarMonthGrid,
  calendarYearOverview,
  civilDateParts,
  groupCalendarEvents,
  monthGridRange,
  sortCalendarEvents,
  validCivilDate,
} from './site-calendar-model.js?v=20260920-calux1';
import {SiteCoreError} from './site-core.js?v=20260920-guest3';

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
  return typeof item?.local_datetime === 'string' ? item.local_datetime.slice(11, 16) : '종일';
}

function isAllDay(item) {
  return item?.all_day === true || !item?.local_datetime;
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
  if (!validCivilDate(localDate)) throw new SiteCoreError('날짜가 올바르지 않습니다.', {code: 'LIFE_DATE_INVALID', status: 422});
  if (allDay) return Object.freeze({kind: 'DATE_ONLY', local_date: localDate});
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new SiteCoreError('시간이 올바르지 않습니다.', {code: 'LIFE_TIME_INVALID', status: 422});
  return Object.freeze({kind: 'LOCAL_DATE_TIME', local_datetime: `${localDate}T${time}:00`, timezone_name: timezone});
}

function defaultRequestId(kind) {
  return `site.calendar.${kind}.${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function createCalendarMutationController({
  sessionToken = '', timezone = DEFAULT_TIMEZONE, guestRepository, fetchImpl = globalThis.fetch, requestId = defaultRequestId,
} = {}) {
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  if (!authenticated && !guestRepository) throw new TypeError('guestRepository is required for Guest Calendar mutations');
  const normalized = input => ({
    title: typeof input?.title === 'string' ? input.title.trim() : '',
    localDate: input?.localDate,
    time: input?.time || '',
    allDay: input?.allDay === true,
  });
  return Object.freeze({
    async create(input) {
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.create({
        title: value.title, local_date: value.localDate,
        local_datetime: temporal.kind === 'LOCAL_DATE_TIME' ? temporal.local_datetime : null, all_day: value.allDay,
      });
      return createLifeActivity(sessionToken, {
        logicalRequestId: requestId('create'), title: value.title, temporal,
        temporalSemantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN',
      }, fetchImpl);
    },
    async update(item, input) {
      const value = normalized(input);
      const temporal = buildCalendarTemporal({...value, timezone});
      if (!authenticated) return guestRepository.update(item.id, {
        title: value.title, local_date: value.localDate,
        local_datetime: temporal.kind === 'LOCAL_DATE_TIME' ? temporal.local_datetime : null, all_day: value.allDay,
      });
      return rescheduleLifeActivity(sessionToken, item.activity_id, {
        logicalRequestId: requestId('reschedule'), expectedRevision: item.occurrence_revision, temporal,
      }, fetchImpl);
    },
    async remove(item) {
      if (!authenticated) return guestRepository.remove(item.id);
      return removeLifeActivity(sessionToken, item.activity_id, {
        logicalRequestId: requestId('remove'), expectedRevision: item.activity_revision,
      }, fetchImpl);
    },
  });
}

function withCalendarShape(item) {
  return Object.freeze({...item, all_day: isAllDay(item)});
}

export function buildCalendarAriaLabel(cell, count, {today = false, selected = false, attention = false} = {}) {
  const {year, month, day} = civilDateParts(cell.date);
  const parts = [`${year}년 ${month}월 ${day}일 ${WEEKDAYS[cell.weekday]}, 일정 ${count}개`];
  if (today) parts.push('오늘');
  if (selected) parts.push('선택됨');
  if (attention) parts.push('확인 필요 일정 있음');
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
  {view = 'month', date, timezone = resolvedTimezone(), now = new Date(), fetchImpl = globalThis.fetch} = {},
) {
  const selectedDate = validCivilDate(date) ? date : dateInTimezone(now, timezone);
  const key = normalizeMode(view);
  if (key === 'attention') {
    const response = await getLifeAttention(sessionToken, {timezone, horizonDays: 365}, fetchImpl);
    return Object.freeze({key, date: selectedDate, items: response.items, kind: 'attention'});
  }
  const range = key === 'year' ? yearBounds(selectedDate) : monthBounds(selectedDate);
  const [response, monthAttention] = await Promise.all([
    getLifeAgenda(sessionToken, {timezone, start: range.start, end: range.end}, fetchImpl),
    key === 'month'
      ? getLifeAttention(sessionToken, {timezone, horizonDays: 365}, fetchImpl)
      : Promise.resolve(null),
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
    const available = stack.clientHeight;
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
  const cells = calendarMonthGrid(state.year, state.month);
  grid.dataset.weekCount = String(cells.length / 7);

  for (const cell of cells) {
    const events = groups.get(cell.date) || [];
    const selected = cell.date === state.selectedDate;
    const today = cell.date === state.todayDate;
    const hasAttention = attentionDates.has(cell.date);

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
    date.setAttribute('aria-label', buildCalendarAriaLabel(cell, events.length, {today, selected, attention: hasAttention}));
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

  if (!items.length) {
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

function calendarEditorDialog({root, item, selectedDate, authenticated, controller, onSaved, onStale}) {
  root.querySelector('.calendar-editor-backdrop')?.remove();
  const backdrop = document.createElement('div'); backdrop.className = 'calendar-editor-backdrop';
  const dialog = document.createElement('section'); dialog.className = 'calendar-editor-dialog';
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'calendar-editor-heading');
  const heading = document.createElement('h3'); heading.id = 'calendar-editor-heading'; heading.textContent = item ? '일정 수정' : '일정 추가';
  const form = document.createElement('form'); form.className = 'calendar-editor-form';
  const titleLabel = document.createElement('label'); titleLabel.textContent = '일정 제목';
  const titleInput = document.createElement('input'); titleInput.className = 'calendar-editor-title'; titleInput.name = 'calendar-title'; titleInput.required = true; titleInput.maxLength = 240; titleInput.value = item?.title || '';
  if (authenticated && item) { titleInput.readOnly = true; titleInput.setAttribute('aria-describedby', 'calendar-editor-title-note'); }
  titleLabel.appendChild(titleInput);
  const titleNote = document.createElement('small'); titleNote.id = 'calendar-editor-title-note'; titleNote.textContent = authenticated && item ? '회원 일정의 제목은 유지되고 날짜와 시간을 변경할 수 있어요.' : '';
  const dateLabel = document.createElement('label'); dateLabel.textContent = '날짜';
  const dateInput = document.createElement('input'); dateInput.className = 'calendar-editor-date'; dateInput.type = 'date'; dateInput.required = true; dateInput.value = item?.local_date || selectedDate; dateLabel.appendChild(dateInput);
  const allDayLabel = document.createElement('label'); allDayLabel.className = 'calendar-editor-all-day';
  const allDayInput = document.createElement('input'); allDayInput.type = 'checkbox'; allDayInput.checked = isAllDay(item || {}); allDayLabel.append(allDayInput, document.createTextNode('종일'));
  const timeLabel = document.createElement('label'); timeLabel.textContent = '시간';
  const timeInput = document.createElement('input'); timeInput.className = 'calendar-editor-time'; timeInput.type = 'time'; timeInput.value = item?.local_datetime?.slice(11, 16) || '09:00'; timeInput.disabled = allDayInput.checked; timeLabel.appendChild(timeInput);
  allDayInput.addEventListener('change', () => { timeInput.disabled = allDayInput.checked; });
  const error = document.createElement('p'); error.className = 'calendar-editor-error'; error.setAttribute('role', 'alert');
  const actions = document.createElement('div'); actions.className = 'calendar-editor-actions';
  const cancel = button('취소', 'calendar-editor-cancel');
  const save = button('저장', 'calendar-editor-save'); save.type = 'submit';
  actions.append(cancel, save);
  if (item) {
    const remove = button('삭제', 'calendar-editor-delete'); actions.prepend(remove);
    remove.addEventListener('click', () => {
      const confirmation = document.createElement('div'); confirmation.className = 'calendar-editor-confirm-delete';
      const copy = document.createElement('p'); copy.textContent = '이 일정을 삭제할까요?';
      const keep = button('유지', 'calendar-editor-cancel-delete');
      const confirm = button('삭제 확인', 'calendar-editor-confirm-delete-button');
      keep.addEventListener('click', () => confirmation.remove());
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        try { await controller.remove(item); backdrop.remove(); await onSaved(item.local_date); }
        catch (caught) {
          if (caught?.code === 'STALE_REVISION') { error.textContent = '다른 변경이 반영되어 일정을 새로 불러왔어요.'; await onStale(); }
          else error.textContent = caught instanceof Error ? caught.message : '일정을 삭제하지 못했습니다.';
          confirm.disabled = false;
        }
      });
      confirmation.append(copy, keep, confirm); form.appendChild(confirmation); confirm.focus();
    });
  }
  form.append(titleLabel, titleNote, dateLabel, allDayLabel, timeLabel, error, actions);
  dialog.append(heading, form); backdrop.appendChild(dialog); root.appendChild(backdrop);
  const close = () => backdrop.remove();
  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = '';
    const value = {title: titleInput.value, localDate: dateInput.value, time: timeInput.value, allDay: allDayInput.checked};
    save.disabled = true;
    try {
      if (item) await controller.update(item, value); else await controller.create(value);
      backdrop.remove(); await onSaved(value.localDate);
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
  now = new Date(),
  fetchImpl = globalThis.fetch,
  guestRepository,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  const todayDate = dateInTimezone(now, timezone);
  const initialDate = todayDate;
  const initialParts = civilDateParts(initialDate);
  const repository = authenticated ? null : (guestRepository || createGuestCalendarRepository(globalThis.localStorage));
  const mutationController = createCalendarMutationController({sessionToken, timezone, guestRepository: repository, fetchImpl});
  const state = {
    mode: normalizeMode(initialView), selectedDate: initialDate, todayDate,
    year: initialParts.year, month: initialParts.month, items: [], attention: [], loading: false,
    detailOpen: usesFlowingDayDetail(), dayCollapsed: false, agendaScope: 'month',
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
    onAdd: date => {
      state.detailOpen = false;
      render();
      queueMicrotask(() => openEditor(null, date));
    },
    onEvent: item => {
      state.detailOpen = false;
      render();
      queueMicrotask(() => openEditor(item, item.local_date || item.due_date));
    },
  };

  function render() {
    updateChrome();
    status.replaceChildren();
    if (state.loading) {
      const loading = document.createElement('div'); loading.className = 'calendar-skeleton'; loading.textContent = '일정을 불러오는 중'; status.appendChild(loading);
    }
    if (state.mode === 'year') viewport.replaceChildren(renderYear(state, actions));
    else if (state.mode === 'agenda') viewport.replaceChildren(renderAgenda(state, actions));
    else if (state.mode === 'attention') viewport.replaceChildren(renderAttention(state));
    else viewport.replaceChildren(renderMonth(state, actions));
  }

  async function refresh() {
    state.loading = true; render(); root.setAttribute('aria-busy', 'true');
    try {
      if (authenticated) {
        const result = await loadLifeCalendarManagerView(sessionToken, {view: state.mode, date: state.selectedDate, timezone, now, fetchImpl});
        if (result.kind === 'attention') state.attention = result.items;
        else {
          state.items = result.items;
          if (result.key === 'month') state.attention = result.attention || [];
        }
      } else {
        state.items = repository.list(); state.attention = [];
      }
      state.loading = false; render();
    } catch (error) {
      state.loading = false; render();
      const message = document.createElement('p'); message.className = 'life-calendar-error';
      message.textContent = error instanceof SiteCoreError && (error.status === 401 || error.status === 403)
        ? '일정을 보려면 LOTBI에 다시 로그인해 주세요.' : '일정을 불러오지 못했습니다.';
      const retry = button('다시 시도', 'calendar-retry-button'); retry.addEventListener('click', () => { void refresh(); });
      status.replaceChildren(message, retry);
    } finally { root.removeAttribute('aria-busy'); }
  }

  openEditor = (item, date) => calendarEditorDialog({
    root, item, selectedDate: date, authenticated, controller: mutationController,
    onSaved: async nextDate => {
      if (validCivilDate(nextDate)) {
        const parts = civilDateParts(nextDate); state.selectedDate = nextDate; state.year = parts.year; state.month = parts.month; state.mode = 'month';
        state.detailOpen = true; state.dayCollapsed = false;
      }
      await refresh();
      window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh', {detail: {source: root}}));
    },
    onStale: refresh,
  });

  previous.addEventListener('click', async () => {
    if (state.mode === 'year') state.year -= 1;
    else { state.month -= 1; if (state.month < 1) { state.month = 12; state.year -= 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`; state.detailOpen = false; await refresh();
  });
  next.addEventListener('click', async () => {
    if (state.mode === 'year') state.year += 1;
    else { state.month += 1; if (state.month > 12) { state.month = 1; state.year += 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`; state.detailOpen = false; await refresh();
  });
  today.addEventListener('click', async () => {
    const parts = civilDateParts(todayDate); state.year = parts.year; state.month = parts.month; state.selectedDate = todayDate; state.mode = 'month'; state.detailOpen = true; state.dayCollapsed = false; await refresh();
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

  const onRefresh = event => {
    if (!root.isConnected) {
      window.removeEventListener('lotbi:life-calendar-refresh', onRefresh);
      window.removeEventListener('resize', onResize);
      return;
    }
    if (event.detail?.source === root) return;
    void refresh();
  };
  window.addEventListener('lotbi:life-calendar-refresh', onRefresh);
  await refresh();
  return true;
}
