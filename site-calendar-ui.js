import {getLifeAgenda, getLifeAttention, getLifeToday, getLifeUpcoming, removeLifeActivity, rescheduleLifeActivity} from './site-calendar.js?v=aset-cf022f054579';
import {SiteCoreError} from './site-core.js?v=aset-cf022f054579';
export {buildCalendarAriaLabel, countCalendarEventsByMonth, loadLifeCalendarManagerView, mountLifeCalendarManager} from './site-calendar-manager.js?v=aset-cf022f054579';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const DEFAULT_TIMEZONE = 'Asia/Seoul';

function resolvedTimezone() {
  try {
    const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof value === 'string' && value ? value : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function datePartsInTimezone(now, timezone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    throw new SiteCoreError('시간대가 올바르지 않습니다.', {code: 'LIFE_TIMEZONE_INVALID', status: 422});
  }
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function addDaysDateString({year, month, day}, days) {
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(value.getUTCFullYear()).padStart(4, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function displayTime(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.local_datetime === 'string' && item.local_datetime.length >= 16) {
    return item.local_datetime.slice(11, 16);
  }
  return '종일';
}

function mutationRequestId(kind) {
  return `site.calendar.${kind}.${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

function itemNode(item, context) {
  const li = document.createElement('li');
  li.className = 'life-calendar-item';
  li.dataset.activityId = item.activity_id;

  const time = document.createElement('time');
  time.className = 'life-calendar-item-time';
  time.textContent = displayTime(item);

  const copy = document.createElement('span');
  copy.className = 'life-calendar-item-copy';

  const title = document.createElement('strong');
  title.className = 'life-calendar-item-title';
  title.textContent = item.title;

  const meta = document.createElement('span');
  meta.className = 'life-calendar-item-meta';
  meta.textContent = item.confirmation_level === 'USER_ATTESTED'
    ? '직접 입력한 일정'
    : '확인된 일정';

  copy.append(title, meta);
  li.append(time, copy);
  return li;
}

function sectionNode(titleText, items, emptyText, context) {
  const section = document.createElement('section');
  section.className = 'life-calendar-group';

  const title = document.createElement('h3');
  title.className = 'life-calendar-group-title';
  title.textContent = titleText;
  section.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'life-calendar-empty';
    empty.textContent = emptyText;
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'life-calendar-list';
  for (const item of items) list.appendChild(itemNode(item, context));
  section.appendChild(list);
  return section;
}

export async function loadLifeCalendarSnapshot(
  sessionToken,
  {
    timezone = resolvedTimezone(),
    now = new Date(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const through = addDaysDateString(datePartsInTimezone(now, timezone), 7);
  const [today, upcoming, attention] = await Promise.all([
    getLifeToday(sessionToken, timezone, fetchImpl),
    getLifeUpcoming(sessionToken, {timezone, through}, fetchImpl),
    getLifeAttention(sessionToken, {timezone, horizonDays: 14}, fetchImpl),
  ]);
  return Object.freeze({today, upcoming, attention, timezone, through});
}

const CALENDAR_ALL_START = '0001-01-01';
const CALENDAR_ALL_END = '9999-12-31';
const CALENDAR_ATTENTION_HORIZON_DAYS = 365;
export const LIFE_CALENDAR_MANAGER_VIEWS = Object.freeze([
  ['all', '전체 일정'],
  ['today', '오늘'],
  ['upcoming', '예정된 일정'],
  ['attention', '확인 필요'],
  ['date', '날짜별 보기'],
]);

function normalizedManagerView(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return LIFE_CALENDAR_MANAGER_VIEWS.some(([candidate]) => candidate === key) ? key : 'all';
}

function localDateString(now, timezone) {
  return addDaysDateString(datePartsInTimezone(now, timezone), 0);
}

function validDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function koreanDateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return String(value || '');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  try {
    return new Intl.DateTimeFormat('ko-KR', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC'}).format(date);
  } catch {
    return value;
  }
}

export function loadGuestLifeCalendarManagerView({
  view = 'all',
  date = '',
  timezone = resolvedTimezone(),
  now = new Date(),
} = {}) {
  const key = normalizedManagerView(view);
  const todayDate = localDateString(now, timezone);
  const selectedDate = key === 'date' && validDateString(date) ? date : todayDate;
  const labels = Object.fromEntries(LIFE_CALENDAR_MANAGER_VIEWS);
  const descriptionDate = key === 'date' ? selectedDate : todayDate;

  return Object.freeze({
    key,
    label: labels[key] || labels.all,
    description: `${koreanDateLabel(descriptionDate)} · 로그인 없이 사용하는 캘린더`,
    kind: key === 'attention' ? 'attention' : 'agenda',
    items: Object.freeze([]),
    date: selectedDate,
    guest: true,
  });
}

async function loadLegacyLifeCalendarManagerView(
  sessionToken,
  {
    view = 'all',
    date = '',
    timezone = resolvedTimezone(),
    now = new Date(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const key = normalizedManagerView(view);
  const todayDate = localDateString(now, timezone);

  if (key === 'today') {
    const response = await getLifeToday(sessionToken, timezone, fetchImpl);
    return Object.freeze({
      key,
      label: '오늘',
      description: '오늘 등록된 개인 일정',
      kind: 'agenda',
      items: response.items,
      date: todayDate,
    });
  }

  if (key === 'upcoming') {
    const response = await getLifeUpcoming(sessionToken, {timezone, through: CALENDAR_ALL_END}, fetchImpl);
    return Object.freeze({
      key,
      label: '예정된 일정',
      description: '오늘 이후 등록된 모든 예정 일정',
      kind: 'agenda',
      items: response.items,
      date: todayDate,
    });
  }

  if (key === 'attention') {
    const response = await getLifeAttention(
      sessionToken,
      {timezone, horizonDays: CALENDAR_ATTENTION_HORIZON_DAYS},
      fetchImpl,
    );
    return Object.freeze({
      key,
      label: '확인 필요',
      description: '기한이 지났거나 앞으로 365일 안에 확인이 필요한 일정',
      kind: 'attention',
      items: response.items,
      date: todayDate,
    });
  }

  if (key === 'date') {
    const selectedDate = validDateString(date) ? date : todayDate;
    const response = await getLifeAgenda(
      sessionToken,
      {timezone, start: selectedDate, end: selectedDate},
      fetchImpl,
    );
    return Object.freeze({
      key,
      label: '날짜별 보기',
      description: `${koreanDateLabel(selectedDate)} 일정`,
      kind: 'agenda',
      items: response.items,
      date: selectedDate,
    });
  }

  const response = await getLifeAgenda(
    sessionToken,
    {timezone, start: CALENDAR_ALL_START, end: CALENDAR_ALL_END},
    fetchImpl,
  );
  return Object.freeze({
    key: 'all',
    label: '전체 일정',
    description: 'LOTBI에 등록된 전체 개인 일정',
    kind: 'agenda',
    items: response.items,
    date: todayDate,
  });
}

function attentionItemNode(item) {
  const li = document.createElement('li');
  li.className = 'life-calendar-item life-calendar-attention-item';
  li.dataset.activityId = item.activity_id;

  const due = document.createElement('time');
  due.className = 'life-calendar-item-time';
  due.dateTime = item.due_date;
  due.textContent = item.due_date;

  const copy = document.createElement('span');
  copy.className = 'life-calendar-item-copy';
  const title = document.createElement('strong');
  title.className = 'life-calendar-item-title';
  title.textContent = item.title;
  const meta = document.createElement('span');
  meta.className = 'life-calendar-item-meta';
  meta.textContent = item.state === 'OVERDUE'
    ? '기한 지남'
    : item.state === 'DUE_TODAY'
      ? '오늘 확인 필요'
      : '확인 예정';
  copy.append(title, meta);
  li.append(due, copy);
  return li;
}

function groupedAgendaNodes(items, context) {
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'life-calendar-empty';
    empty.textContent = '표시할 일정이 없어요.';
    return [empty];
  }

  const groups = new Map();
  for (const item of items) {
    const key = typeof item.local_date === 'string' ? item.local_date : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([date, group]) => (
    sectionNode(koreanDateLabel(date), group, '표시할 일정이 없어요.', context)
  ));
}

function attentionNodes(items) {
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'life-calendar-empty';
    empty.textContent = '확인이 필요한 일정이 없어요.';
    return [empty];
  }
  const section = document.createElement('section');
  section.className = 'life-calendar-group';
  const title = document.createElement('h3');
  title.className = 'life-calendar-group-title';
  title.textContent = '확인 필요';
  const list = document.createElement('ul');
  list.className = 'life-calendar-list';
  for (const item of items) list.appendChild(attentionItemNode(item));
  section.append(title, list);
  return [section];
}

async function mountLegacyLifeCalendarManager({
  sessionToken,
  root,
  initialView = 'all',
  timezone = resolvedTimezone(),
  now = new Date(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());

  let activeView = normalizedManagerView(initialView);
  let selectedDate = localDateString(now, timezone);

  const tabs = document.createElement('div');
  tabs.className = 'life-calendar-manager-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '캘린더 보기');

  const buttons = new Map();
  for (const [key, label] of LIFE_CALENDAR_MANAGER_VIEWS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'life-calendar-manager-tab';
    button.dataset.calendarManagerView = key;
    button.setAttribute('role', 'tab');
    button.textContent = label;
    buttons.set(key, button);
    tabs.appendChild(button);
  }

  const dateField = document.createElement('label');
  dateField.className = 'life-calendar-manager-date';
  const dateLabel = document.createElement('span');
  dateLabel.textContent = '날짜 선택';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = selectedDate;
  dateField.append(dateLabel, dateInput);

  const note = document.createElement('p');
  note.className = 'life-calendar-manager-note';

  const body = document.createElement('div');
  body.className = 'life-calendar-manager-body';
  body.setAttribute('aria-live', 'polite');

  root.replaceChildren(tabs, dateField, note, body);

  const refresh = async () => {
    root.setAttribute('aria-busy', 'true');
    const loading = document.createElement('p');
    loading.className = 'life-calendar-loading';
    loading.textContent = '일정을 확인하고 있어요.';
    body.replaceChildren(loading);

    try {
      const result = authenticated
        ? await loadLifeCalendarManagerView(sessionToken, {
            view: activeView,
            date: selectedDate,
            timezone,
            now,
            fetchImpl,
          })
        : loadGuestLifeCalendarManagerView({
            view: activeView,
            date: selectedDate,
            timezone,
            now,
          });
      activeView = result.key;
      selectedDate = result.date || selectedDate;
      dateInput.value = selectedDate;
      dateField.hidden = activeView !== 'date';
      note.textContent = result.description;

      for (const [key, button] of buttons) {
        const selected = key === activeView;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      }

      const context = authenticated
        ? {
            sessionToken,
            timezone,
            refresh: async () => {
              await refresh();
              window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
            },
          }
        : undefined;
      body.replaceChildren(...(
        result.kind === 'attention'
          ? attentionNodes(result.items)
          : groupedAgendaNodes(result.items, context)
      ));
      root.dataset.calendarManagerView = activeView;
      root.dataset.calendarAccess = authenticated ? 'authenticated' : 'guest';
    } catch (error) {
      body.replaceChildren();
      const message = document.createElement('p');
      message.className = 'life-calendar-error';
      message.textContent = error instanceof SiteCoreError && (error.status === 401 || error.status === 403)
        ? '일정을 보려면 LOTBI에 다시 로그인해 주세요.'
        : '일정을 불러오지 못했습니다.';
      body.appendChild(message);
      root.dataset.calendarManagerView = 'error';
    } finally {
      root.removeAttribute('aria-busy');
    }
  };

  for (const [key, button] of buttons) {
    button.addEventListener('click', () => {
      if (activeView === key) return;
      activeView = key;
      void refresh();
    });
  }
  dateInput.addEventListener('change', () => {
    if (!validDateString(dateInput.value)) return;
    selectedDate = dateInput.value;
    if (activeView === 'date') void refresh();
  });

  await refresh();
  return true;
}

const activeCalendarMounts = new WeakMap();

export async function mountLifeCalendar({
  sessionToken,
  root = document.querySelector('[data-life-calendar-panel]'),
  timezone = resolvedTimezone(),
  now = new Date(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  activeCalendarMounts.get(root)?.();
  root.hidden = true;
  root.replaceChildren();
  root.removeAttribute('aria-busy');
  delete root.dataset.calendarState;
  if (typeof sessionToken !== 'string' || !sessionToken.trim()) return false;

  const heading = document.createElement('div');
  heading.className = 'life-calendar-heading';

  const title = document.createElement('h2');
  title.textContent = '오늘과 예정';

  const coverage = document.createElement('p');
  coverage.className = 'life-calendar-coverage';
  coverage.textContent = 'LOTBI에 등록된 개인 일정 기준';

  heading.append(title, coverage);

  const body = document.createElement('div');
  body.className = 'life-calendar-body';

  root.replaceChildren(heading, body);

  let active = true;
  let generation = 0;
  const onRefresh = () => { void refresh(); };
  const dispose = () => {
    active = false;
    generation += 1;
    window.removeEventListener('lotbi:life-calendar-refresh', onRefresh);
    window.removeEventListener(SESSION_STATE_EVENT, onSessionState);
    if (activeCalendarMounts.get(root) === dispose) activeCalendarMounts.delete(root);
  };
  const onSessionState = event => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (detail?.authenticated === false) {
      dispose();
      root.hidden = true;
      root.replaceChildren();
      root.removeAttribute('aria-busy');
      delete root.dataset.calendarState;
    }
  };

  const refresh = async () => {
    if (!active) return;
    const requestGeneration = ++generation;
    root.setAttribute('aria-busy', 'true');
    try {
      const snapshot = await loadLifeCalendarSnapshot(sessionToken, {timezone, now, fetchImpl});
      if (!active || requestGeneration !== generation) return;
      const groups = [snapshot.today?.items, snapshot.upcoming?.items, snapshot.attention?.items];
      if (!groups.every(Array.isArray)) throw new Error('Invalid calendar snapshot');
      if (groups.every(items => items.length === 0)) {
        body.replaceChildren();
        root.hidden = true;
        root.dataset.calendarState = 'empty';
        return;
      }
      const context = {sessionToken, timezone, refresh};
      body.replaceChildren(
        sectionNode('오늘', snapshot.today.items, '오늘 등록된 일정이 없어요.', context),
        sectionNode('예정', snapshot.upcoming.items, '앞으로 7일간 등록된 일정이 없어요.', context),
        sectionNode('주의 필요', snapshot.attention.items.map(item => ({
          ...item,
          local_datetime: null,
          title: item.title,
        })), '주의가 필요한 마감 일정이 없어요.', context),
      );
      root.dataset.calendarState = 'ready';
      root.hidden = false;
    } catch {
      if (!active || requestGeneration !== generation) return;
      root.hidden = true;
      body.replaceChildren();
      root.dataset.calendarState = 'error';
    } finally {
      if (active && requestGeneration === generation) root.removeAttribute('aria-busy');
    }
  };

  activeCalendarMounts.set(root, dispose);
  window.addEventListener('lotbi:life-calendar-refresh', onRefresh);
  window.addEventListener(SESSION_STATE_EVENT, onSessionState);
  await refresh();
  return true;
}

export async function mountLifeCalendarIfEnabled(options = {}) {
  const root = options.root ?? document.querySelector('[data-life-calendar-panel]');
  if (!(root instanceof HTMLElement) || root.dataset.calendarEnabled !== 'true') {
    if (root instanceof HTMLElement) root.hidden = true;
    return false;
  }
  return mountLifeCalendar({...options, root});
}
