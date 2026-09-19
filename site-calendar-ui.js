import {getLifeAttention, getLifeToday, getLifeUpcoming} from './site-calendar.js';
import {SiteCoreError} from './site-core.js';

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

function itemNode(item) {
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

function sectionNode(titleText, items, emptyText) {
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
  for (const item of items) list.appendChild(itemNode(item));
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

export async function mountLifeCalendar({
  sessionToken,
  root = document.querySelector('[data-life-calendar-panel]'),
  timezone = resolvedTimezone(),
  now = new Date(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!(root instanceof HTMLElement)) return false;
  if (typeof sessionToken !== 'string' || !sessionToken.trim()) {
    root.hidden = true;
    root.replaceChildren();
    return false;
  }

  root.hidden = false;
  root.setAttribute('aria-busy', 'true');

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

  const loading = document.createElement('p');
  loading.className = 'life-calendar-loading';
  loading.textContent = '일정을 확인하고 있어요.';
  body.appendChild(loading);
  root.replaceChildren(heading, body);

  try {
    const snapshot = await loadLifeCalendarSnapshot(sessionToken, {timezone, now, fetchImpl});
    body.replaceChildren(
      sectionNode('오늘', snapshot.today.items, '오늘 등록된 일정이 없어요.'),
      sectionNode('예정', snapshot.upcoming.items, '앞으로 7일간 등록된 일정이 없어요.'),
      sectionNode('주의 필요', snapshot.attention.items.map(item => ({
        ...item,
        local_datetime: null,
        title: item.title,
      })), '주의가 필요한 마감 일정이 없어요.'),
    );
    root.dataset.calendarState = 'ready';
  } catch (error) {
    body.replaceChildren();
    const message = document.createElement('p');
    message.className = 'life-calendar-error';
    message.textContent = error instanceof SiteCoreError && (error.status === 401 || error.status === 403)
      ? '일정을 보려면 LOTBI에 다시 로그인해 주세요.'
      : '일정을 불러오지 못했습니다.';
    body.appendChild(message);
    root.dataset.calendarState = 'error';
  } finally {
    root.removeAttribute('aria-busy');
  }

  const onSessionState = event => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (detail?.authenticated === false) {
      root.hidden = true;
      root.replaceChildren();
      delete root.dataset.calendarState;
      window.removeEventListener(SESSION_STATE_EVENT, onSessionState);
    }
  };
  window.addEventListener(SESSION_STATE_EVENT, onSessionState);
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
