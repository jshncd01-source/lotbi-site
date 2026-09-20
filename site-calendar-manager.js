import {createLifeActivity, getLifeAgenda, getLifeAttention, removeLifeActivity, rescheduleLifeActivity} from './site-calendar.js?v=20260920-realcal1';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=20260920-realcal1';
import {
  addCivilDays,
  calendarMonthGrid,
  calendarYearOverview,
  civilDateParts,
  groupCalendarEvents,
  monthGridRange,
  sortCalendarEvents,
  validCivilDate,
} from './site-calendar-model.js?v=20260920-realcal1';
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

function eventTime(item) {
  return typeof item?.local_datetime === 'string' ? item.local_datetime.slice(11, 16) : '종일';
}

function isAllDay(item) {
  return item?.all_day === true || !item?.local_datetime;
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

export function buildCalendarAriaLabel(cell, count) {
  const {year, month, day} = civilDateParts(cell.date);
  return `${year}년 ${month}월 ${day}일 ${WEEKDAYS[cell.weekday]}, 일정 ${count}개`;
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
  const response = await getLifeAgenda(sessionToken, {timezone, start: range.start, end: range.end}, fetchImpl);
  return Object.freeze({
    key,
    date: selectedDate,
    year: range.year,
    month: range.month,
    range: Object.freeze({start: range.start, end: range.end}),
    kind: 'agenda',
    items: Object.freeze(response.items.map(withCalendarShape)),
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
    meta.textContent = item.confirmation_level === 'PROVIDER_VERIFIED' ? '확인된 일정' : '직접 입력한 일정';
    copy.append(title, meta);
    li.append(time, copy);
    if (onSelect) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
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
  const heading = document.createElement('h3');
  heading.className = 'calendar-day-heading';
  heading.textContent = koreanDate(state.selectedDate);
  const items = groups.get(state.selectedDate) || [];
  panel.appendChild(heading);
  panel.appendChild(items.length ? eventList(items, {onSelect: actions.onEvent}) : emptyMessage('이날은 일정이 없어요.'));
  const add = button(`${civilDateParts(state.selectedDate).month}월 ${civilDateParts(state.selectedDate).day}일에 일정 추가`, 'calendar-add-button');
  add.dataset.calendarAdd = '';
  add.addEventListener('click', () => actions.onAdd?.(state.selectedDate));
  panel.appendChild(add);
  return panel;
}

function renderMonth(state, actions) {
  const layout = document.createElement('div');
  layout.className = 'calendar-month-layout';
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
  for (const cell of calendarMonthGrid(state.year, state.month)) {
    const events = groups.get(cell.date) || [];
    const date = button(String(cell.day), 'calendar-date-cell');
    date.dataset.calendarDate = cell.date;
    date.dataset.currentMonth = String(cell.inCurrentMonth);
    date.dataset.selected = String(cell.date === state.selectedDate);
    date.dataset.today = String(cell.date === state.todayDate);
    date.setAttribute('role', 'gridcell');
    date.setAttribute('aria-selected', String(cell.date === state.selectedDate));
    date.setAttribute('aria-label', buildCalendarAriaLabel(cell, events.length));
    date.tabIndex = cell.date === state.selectedDate ? 0 : -1;
    const number = document.createElement('span'); number.className = 'calendar-date-number'; number.textContent = String(cell.day);
    date.textContent = ''; date.appendChild(number);
    const chipCount = Math.min(events.length, 2);
    for (const event of events.slice(0, chipCount)) {
      const chip = document.createElement('span');
      chip.className = 'calendar-event-chip';
      chip.dataset.eventChip = '';
      chip.textContent = event.title;
      chip.setAttribute('aria-label', `${eventTime(event)} ${event.title}`);
      date.appendChild(chip);
    }
    if (events.length > chipCount) {
      const more = document.createElement('span');
      more.className = 'calendar-event-overflow';
      more.dataset.eventOverflow = '';
      more.textContent = `+${events.length - chipCount}`;
      date.appendChild(more);
    }
    date.addEventListener('click', () => actions.selectDate(cell.date));
    date.addEventListener('keydown', event => actions.onDateKey(event, cell.date));
    grid.appendChild(date);
  }
  calendar.append(weekdays, grid);
  layout.append(calendar, dayPanel(state, groups, actions));
  return layout;
}

function renderYear(state, actions) {
  const grid = document.createElement('div');
  grid.className = 'calendar-year-grid';
  grid.setAttribute('aria-label', `${state.year}년 연간 달력`);
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
    card.append(title, weekdays, dates);
    card.setAttribute('aria-label', `${state.year}년 ${month.month}월 보기`);
    card.addEventListener('click', () => actions.selectMonth(month.month));
    grid.appendChild(card);
  }
  return grid;
}

function renderAgenda(state, actions) {
  const section = document.createElement('section');
  section.className = 'calendar-agenda-view';
  const items = sortCalendarEvents(state.items);
  if (!items.length) return emptyMessage('이 달에는 일정이 없어요.');
  const groups = groupCalendarEvents(items);
  for (const [date, values] of groups) {
    const group = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = koreanDate(date); group.append(heading, eventList(values, {onSelect: actions.onEvent}));
    section.appendChild(group);
  }
  return section;
}

function renderAttention(state) {
  if (!state.attention.length) return emptyMessage('확인이 필요한 일정이 없어요.');
  return eventList(state.attention.map(item => ({...item, local_date: item.due_date, local_datetime: null})));
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
    selectDate: async date => {
      const parts = civilDateParts(date);
      const monthChanged = parts.year !== state.year || parts.month !== state.month;
      state.selectedDate = date; state.year = parts.year; state.month = parts.month;
      if (monthChanged && authenticated) await refresh(); else render();
      queueMicrotask(() => root.querySelector(`[data-calendar-date="${date}"]`)?.focus());
    },
    selectMonth: async month => {
      state.month = month; state.selectedDate = `${state.year}-${String(month).padStart(2, '0')}-01`; state.mode = 'month'; await refresh();
    },
    onDateKey: (event, date) => {
      const offsets = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};
      switch (event.key) {
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
          event.preventDefault(); void actions.selectDate(addCivilDays(date, offsets[event.key])); break;
        case 'Enter': case ' ': event.preventDefault(); void actions.selectDate(date); break;
        default: break;
      }
    },
    onAdd: date => openEditor(null, date),
    onEvent: item => openEditor(item, item.local_date),
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
        else state.items = result.items;
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
      }
      await refresh();
      window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh', {detail: {source: root}}));
    },
    onStale: refresh,
  });

  previous.addEventListener('click', async () => {
    if (state.mode === 'year') state.year -= 1;
    else { state.month -= 1; if (state.month < 1) { state.month = 12; state.year -= 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`; await refresh();
  });
  next.addEventListener('click', async () => {
    if (state.mode === 'year') state.year += 1;
    else { state.month += 1; if (state.month > 12) { state.month = 1; state.year += 1; } }
    state.selectedDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`; await refresh();
  });
  today.addEventListener('click', async () => {
    const parts = civilDateParts(todayDate); state.year = parts.year; state.month = parts.month; state.selectedDate = todayDate; state.mode = 'month'; await refresh();
  });
  title.addEventListener('click', async () => { state.mode = state.mode === 'year' ? 'month' : 'year'; await refresh(); });
  for (const [mode, control] of modeButtons) control.addEventListener('click', async () => { if (state.mode !== mode) { state.mode = mode; await refresh(); } });

  const onRefresh = event => {
    if (!root.isConnected) {
      window.removeEventListener('lotbi:life-calendar-refresh', onRefresh);
      return;
    }
    if (event.detail?.source === root) return;
    void refresh();
  };
  window.addEventListener('lotbi:life-calendar-refresh', onRefresh);
  await refresh();
  return true;
}
