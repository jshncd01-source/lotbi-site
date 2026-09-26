// FESTIVAL-07 — public "축제" browse UI.
//
// Mounted on demand into the shared site modal shell (see openFestival() in
// site-conversation.js), exactly like mountPetFamilyManager() is mounted for
// the 반려동물 panel. Renders only what listPublishedFestivals()/
// getPublishedFestival() (site-festival-client.js) return — those two
// functions are the only way this file ever touches festival data, and they
// are the enforced PUBLISHED-only boundary (see the allowlist normalizer
// there). This module never calls FESTIVAL-04 or any other private/internal
// API directly.
import {
  FESTIVAL_PROGRAM_CATEGORIES,
  FESTIVAL_RESERVATION_TYPE_LABEL,
  FESTIVAL_STATUS,
  FESTIVAL_STATUS_LABEL,
  computeFestivalStatus,
  getPublishedFestival,
  listFestivalRegions,
  listPublishedFestivals,
  sortFestivalPrograms,
} from './site-festival-client.js?v=aset-2f90dab9cd4a';
import {getFestivalProgramWeather} from './site-festival-weather.js?v=aset-2f90dab9cd4a';
import {
  calendarWeatherAttribution,
  calendarWeatherIconNode,
  weatherTemperatureLabel,
} from './site-calendar-weather.js?v=aset-2f90dab9cd4a';
import {
  VISIT_SCOPE,
  addFestivalVisitToCalendar,
  defaultProgramSelectedDate,
  festivalVisitDateOptions,
} from './site-festival-calendar.js?v=aset-2f90dab9cd4a';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-2f90dab9cd4a';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function chipButton(label, {pressed = false, onClick} = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'festival-chip';
  button.textContent = label;
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
}

export function formatFestivalDateLabel(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  return `${Number(match[2])}.${Number(match[3])}`;
}

export function formatFestivalPeriod(festival) {
  if (!festival?.startDate || !festival?.endDate) return '';
  if (festival.startDate === festival.endDate) return formatFestivalDateLabel(festival.startDate);
  return `${formatFestivalDateLabel(festival.startDate)} ~ ${formatFestivalDateLabel(festival.endDate)}`;
}

export function formatFestivalLocation(festival) {
  return [festival?.region, festival?.venueName].filter(Boolean).join(' · ');
}

export function groupProgramsByDate(programs) {
  const sorted = sortFestivalPrograms(programs);
  const groups = [];
  const byDate = new Map();
  for (const program of sorted) {
    if (!byDate.has(program.date)) {
      const group = {date: program.date, programs: []};
      byDate.set(program.date, group);
      groups.push(group);
    }
    byDate.get(program.date).programs.push(program);
  }
  return groups;
}

export function filterProgramsByCategory(programs, category) {
  if (!category) return programs;
  return programs.filter(program => program.category === category);
}

function statusBadge(status) {
  const badge = el('span', `festival-status-badge festival-status-${status.toLowerCase()}`, FESTIVAL_STATUS_LABEL[status] || status);
  return badge;
}

function heroImage(festival) {
  const wrap = el('div', 'festival-hero');
  if (festival.imageUrl) {
    const img = document.createElement('img');
    img.src = festival.imageUrl;
    img.alt = `${festival.name} 대표 이미지`;
    img.loading = 'lazy';
    wrap.appendChild(img);
  } else {
    wrap.classList.add('festival-hero-placeholder');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `${festival.name} 대표 이미지 없음`);
  }
  return wrap;
}

function buildCard(festival, now, {onOpen}) {
  const status = computeFestivalStatus(festival, now);
  const card = el('article', 'festival-card');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'festival-card-open';
  button.setAttribute('aria-label', `${festival.name} 상세 보기`);
  button.addEventListener('click', () => onOpen(festival.id));

  button.appendChild(heroImage(festival));
  const body = el('div', 'festival-card-body');
  body.appendChild(statusBadge(status));
  body.appendChild(el('h3', 'festival-card-name', festival.name));
  body.appendChild(el('p', 'festival-card-period', formatFestivalPeriod(festival)));
  const location = formatFestivalLocation(festival);
  if (location) body.appendChild(el('p', 'festival-card-location', location));
  button.appendChild(body);
  card.appendChild(button);
  return card;
}

// FESTIVAL-EVENT-08 gap-fill: a date-tab bar, not a plain heading list, so a
// visit-date selection (from Calendar re-entry, or picked here directly) can
// jump straight to that day's programs. Arrow-key roving tabindex, one tab
// stop for the whole bar — the standard tablist keyboard contract.
function buildDateTabBar(dates, {selectedDate, onSelect}) {
  const tabs = el('div', 'festival-date-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '프로그램 날짜 선택');
  const nodes = new Map();
  dates.forEach((date, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'festival-date-tab';
    tab.id = `festival-date-tab-${date}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(date === selectedDate));
    tab.tabIndex = date === selectedDate ? 0 : -1;
    tab.textContent = formatFestivalDateLabel(date);
    tab.addEventListener('click', () => onSelect(date));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const nextIndex = event.key === 'ArrowRight' ? (index + 1) % dates.length
        : event.key === 'ArrowLeft' ? (index - 1 + dates.length) % dates.length
        : event.key === 'Home' ? 0 : dates.length - 1;
      const nextDate = dates[nextIndex];
      onSelect(nextDate);
      nodes.get(nextDate)?.focus();
    });
    nodes.set(date, tab);
    tabs.appendChild(tab);
  });
  return tabs;
}

// Full Korean weekday date label for the selected date's accessible name,
// e.g. "10월 10일 토요일" — independent of formatFestivalDateLabel()'s short
// visual "10.10", which drops the weekday a screen reader still needs.
function weekdayDateLabelKo(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  try {
    return new Intl.DateTimeFormat('ko-KR', {timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long'}).format(date);
  } catch {
    return '';
  }
}

// One accessible sentence for the selected date's weather so a screen reader
// gets the full forecast once, instead of the visual icon (aria-hidden) being
// read as a separate, meaningless glyph. A date with no weather (no forecast
// yet, or out of range) never claims a percentage or temperature it does not
// have.
function buildProgramDateAriaLabel(dateString, weatherItem) {
  const dateLabel = weekdayDateLabelKo(dateString);
  if (!weatherItem) return dateLabel;
  const segments = [dateLabel];
  if (weatherItem.label) segments.push(weatherItem.label);
  const hasMin = Number.isFinite(weatherItem.minTemperature);
  const hasMax = Number.isFinite(weatherItem.maxTemperature);
  if (hasMin && hasMax) segments.push(`최저 ${Math.round(weatherItem.minTemperature)}도 최고 ${Math.round(weatherItem.maxTemperature)}도`);
  else if (hasMax) segments.push(`최고 ${Math.round(weatherItem.maxTemperature)}도`);
  else if (hasMin) segments.push(`최저 ${Math.round(weatherItem.minTemperature)}도`);
  else if (Number.isFinite(weatherItem.temperature)) segments.push(`${Math.round(weatherItem.temperature)}도`);
  if (Number.isInteger(weatherItem.precipitationProbability)) segments.push(`강수확률 ${weatherItem.precipitationProbability}퍼센트`);
  return segments.join(', ');
}

// Visual-only weather badge for the selected date. precipitationProbability
// is only ever rendered when Core actually sent an integer — a missing value
// hides the "강수 N%" segment entirely rather than showing a fabricated 0%.
function buildProgramDateWeatherBadge(weatherItem) {
  const badge = el('span', 'festival-program-weather');
  badge.setAttribute('aria-hidden', 'true');
  const icon = calendarWeatherIconNode(weatherItem.weatherKind, document);
  if (icon) badge.appendChild(icon);
  const parts = [];
  const tempLabel = weatherTemperatureLabel(weatherItem);
  if (tempLabel) parts.push(tempLabel);
  if (Number.isInteger(weatherItem.precipitationProbability)) parts.push(`강수 ${weatherItem.precipitationProbability}%`);
  if (parts.length) badge.appendChild(el('span', 'festival-program-weather-text', parts.join(' · ')));
  return badge;
}

// FESTIVAL-EVENT-10 note: this now shows one selected date's programs at a
// time (buildDateTabBar above) instead of every date-group at once, so a
// Calendar visit-date re-entry (or a direct pick here) can jump straight to
// that day. FESTIVAL-EVENT-09's weather badge/attribution moves with it —
// the badge now sits on the selected date's own row instead of on each
// date-group heading, since there is only ever one visible at a time.
function buildProgramSection(festival, {initialSelectedDate = '', now = new Date()} = {}) {
  const section = el('section', 'festival-section festival-programs');
  section.appendChild(el('h4', 'festival-section-title', '주요 프로그램'));
  if (!festival.programs.length) {
    section.appendChild(el('p', 'festival-empty-note', '등록된 프로그램 정보가 없습니다.'));
    return {section, applyWeather() {}};
  }

  const programDates = [...new Set(sortFestivalPrograms(festival.programs).map(program => program.date))];
  let selectedDate = defaultProgramSelectedDate(programDates, {initialSelectedDate, now});

  const tabHost = el('div', 'festival-date-tab-host');
  const categoryRow = el('div', 'festival-chip-row');
  categoryRow.setAttribute('role', 'group');
  categoryRow.setAttribute('aria-label', '프로그램 카테고리 필터');
  const list = el('div', 'festival-program-groups');
  list.setAttribute('role', 'tabpanel');
  const weatherAttribution = el('p', 'festival-weather-attribution');
  weatherAttribution.hidden = true;
  section.append(tabHost, categoryRow, list, weatherAttribution);

  let activeCategory = '';
  let weatherByDate = null;
  const categories = ['전체', ...FESTIVAL_PROGRAM_CATEGORIES];
  const chips = new Map();

  const renderTabs = () => {
    const bar = buildDateTabBar(programDates, {
      selectedDate,
      onSelect: date => {
        if (date === selectedDate) return;
        selectedDate = date;
        renderTabs();
        renderPrograms();
      },
    });
    list.setAttribute('aria-labelledby', `festival-date-tab-${selectedDate}`);
    tabHost.replaceChildren(bar);
  };

  const renderPrograms = () => {
    list.replaceChildren();
    const onDate = festival.programs.filter(program => program.date === selectedDate);
    const filtered = filterProgramsByCategory(onDate, activeCategory);
    const weatherItem = weatherByDate?.get(selectedDate) || null;
    if (weatherItem) {
      const dateRow = el('div', 'festival-program-date-row');
      dateRow.setAttribute('aria-label', buildProgramDateAriaLabel(selectedDate, weatherItem));
      dateRow.appendChild(buildProgramDateWeatherBadge(weatherItem));
      list.appendChild(dateRow);
    }
    if (!filtered.length) {
      list.appendChild(el('p', 'festival-empty-note', '선택한 날짜·카테고리의 프로그램이 없습니다.'));
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'festival-program-list';
    for (const program of sortFestivalPrograms(filtered)) {
      const li = document.createElement('li');
      li.className = 'festival-program-item';
      const time = [program.startTime, program.endTime].filter(Boolean).join(' ~ ');
      if (time) li.appendChild(el('span', 'festival-program-time', time));
      li.appendChild(el('span', 'festival-program-category', program.category));
      li.appendChild(el('span', 'festival-program-title', program.title));
      if (program.venue) li.appendChild(el('span', 'festival-program-venue', program.venue));
      if (program.price) {
        li.appendChild(el('span', 'festival-program-price',
          `${program.price.amount.toLocaleString('ko-KR')}${program.price.currency === 'KRW' ? '원' : ` ${program.price.currency}`} (${program.price.unit})`));
      }
      if (program.note) li.appendChild(el('p', 'festival-program-note', program.note));
      ul.appendChild(li);
    }
    list.appendChild(ul);
  };

  for (const category of categories) {
    const value = category === '전체' ? '' : category;
    const chip = chipButton(category, {
      pressed: value === activeCategory,
      onClick: () => {
        activeCategory = value;
        for (const [chipValue, chipNode] of chips) chipNode.setAttribute('aria-pressed', chipValue === value ? 'true' : 'false');
        renderPrograms();
      },
    });
    chips.set(value, chip);
    categoryRow.appendChild(chip);
  }
  renderTabs();
  renderPrograms();

  return {
    section,
    // Called once the async weather read (site-festival-weather.js) resolves.
    // The program list is already visible by then; this only re-renders the
    // selected date's weather badge and shows the 기상청 attribution line
    // once, at the bottom of this section.
    applyWeather({byDate, items} = {}) {
      weatherByDate = byDate instanceof Map && byDate.size ? byDate : null;
      renderPrograms();
      const attribution = weatherByDate ? calendarWeatherAttribution(items) : null;
      weatherAttribution.hidden = !attribution;
      weatherAttribution.textContent = attribution ? attribution.text : '';
    },
  };
}

function buildReservationSection(festival) {
  const section = el('section', 'festival-section festival-reservation');
  section.appendChild(el('h4', 'festival-section-title', '예약 안내'));
  const typeLine = el('p', 'festival-reservation-type', FESTIVAL_RESERVATION_TYPE_LABEL[festival.reservation.type] || '확인필요');
  section.appendChild(typeLine);
  if (festival.reservation.note) section.appendChild(el('p', 'festival-reservation-note', festival.reservation.note));
  if (festival.reservation.reservationUrl) {
    const link = document.createElement('a');
    link.className = 'festival-reservation-link';
    link.href = festival.reservation.reservationUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    link.append('공식예약', el('span', 'festival-external-note', ' (외부 사이트 새 창으로 이동)'));
    link.setAttribute('aria-label', '공식 예약 페이지로 이동, 외부 사이트가 새 창에서 열립니다');
    section.appendChild(link);
  }
  return section;
}

function buildParkingShuttleSection(festival) {
  if (!festival.parkingShuttle) return null;
  const section = el('section', 'festival-section festival-parking-shuttle');
  section.appendChild(el('h4', 'festival-section-title', '주차·셔틀'));
  if (festival.parkingShuttle.parkingNote) section.appendChild(el('p', 'festival-parking-note', festival.parkingShuttle.parkingNote));
  if (festival.parkingShuttle.shuttleNote) section.appendChild(el('p', 'festival-shuttle-note', festival.parkingShuttle.shuttleNote));
  return section;
}

function buildOfficialSourceSection(festival) {
  if (!festival.officialSource) return null;
  const section = el('section', 'festival-section festival-official-source');
  section.appendChild(el('h4', 'festival-section-title', '공식 출처'));
  const link = document.createElement('a');
  link.className = 'festival-official-source-link';
  link.href = festival.officialSource.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.append(festival.officialSource.label, el('span', 'festival-external-note', ' (외부 사이트 새 창으로 이동)'));
  link.setAttribute('aria-label', `${festival.officialSource.label}, 외부 사이트가 새 창에서 열립니다`);
  section.appendChild(link);
  return section;
}

// PUBLISHED-only is already structural (every festival here came through
// getPublishedFestival()/listPublishedFestivals()). This gate is the other
// half of rule 33: ENDED/CANCELLED never offer a *new* visit registration —
// the visit already happened, or the event will not.
function festivalCalendarAddEligible(festival, now) {
  const status = computeFestivalStatus(festival, now);
  return status !== FESTIVAL_STATUS.ENDED && status !== FESTIVAL_STATUS.CANCELLED;
}

// "내 캘린더에 추가" — a personalization utility action, deliberately not a
// third primary CTA alongside [프로그램]/[체험·신청]. It writes through the
// existing LOTBI Calendar (site-festival-calendar.js -> site-calendar.js /
// site-calendar-guest.js); this module never stores a festival visit itself.
function buildCalendarAddSection(root, festival, {authenticated, sessionToken, guestRepository, now = new Date()}) {
  const wrap = el('div', 'festival-calendar-add');
  if (!festivalCalendarAddEligible(festival, now)) return wrap;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'festival-calendar-add-trigger';
  trigger.textContent = '+ 내 캘린더에 추가';
  wrap.appendChild(trigger);

  const feedback = el('p', 'festival-calendar-add-feedback');
  feedback.hidden = true;
  wrap.appendChild(feedback);

  const announce = (message, {isError = false} = {}) => {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.setAttribute('role', isError ? 'alert' : 'status');
  };

  let disposeSheet = null;
  const closeSheet = ({restoreFocus = true} = {}) => {
    if (!disposeSheet) return;
    const dispose = disposeSheet;
    disposeSheet = null;
    dispose();
    if (restoreFocus) trigger.focus();
  };

  const submit = async (visitScope, visitDate) => {
    trigger.disabled = true;
    try {
      const result = await addFestivalVisitToCalendar({festival, visitDate, visitScope, authenticated, sessionToken, guestRepository});
      if (result.status === 'CREATED') {
        announce('캘린더에 추가했어요.');
        closeSheet();
      } else if (result.status === 'DUPLICATE') {
        announce('이미 캘린더에 추가되어 있어요.');
        closeSheet();
      } else {
        announce('캘린더에 추가하지 못했어요. 다시 시도해 주세요.', {isError: true});
      }
    } catch {
      announce('캘린더에 추가하지 못했어요. 다시 시도해 주세요.', {isError: true});
    } finally {
      trigger.disabled = false;
    }
  };

  const openSheet = () => {
    closeSheet({restoreFocus: false});
    const backdrop = el('div', 'festival-visit-sheet-backdrop');
    const dialog = el('div', 'festival-visit-sheet');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'festival-visit-sheet-title');

    const header = el('div', 'festival-visit-sheet-header');
    const title = el('h4', 'festival-visit-sheet-title', '방문할 날짜를 선택하세요');
    title.id = 'festival-visit-sheet-title';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'festival-visit-sheet-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', '닫기');
    header.append(title, closeButton);

    const optionsList = el('div', 'festival-visit-sheet-options');
    optionsList.setAttribute('role', 'radiogroup');
    optionsList.setAttribute('aria-label', '방문 날짜');
    const optionButtons = [];
    let selected = null;

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'festival-visit-sheet-confirm';
    confirmButton.textContent = '추가';
    confirmButton.disabled = true;

    const selectOption = (node, value) => {
      selected = value;
      for (const optionNode of optionButtons) optionNode.setAttribute('aria-checked', String(optionNode === node));
      confirmButton.disabled = false;
    };

    const addOption = (label, value, className = 'festival-visit-option') => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = className;
      option.setAttribute('role', 'radio');
      option.setAttribute('aria-checked', 'false');
      option.textContent = label;
      option.addEventListener('click', () => selectOption(option, value));
      optionButtons.push(option);
      optionsList.appendChild(option);
      return option;
    };

    for (const date of festivalVisitDateOptions(festival)) {
      addOption(formatFestivalDateLabel(date), {scope: VISIT_SCOPE.DATE, date});
    }
    addOption('전체 기간', {scope: VISIT_SCOPE.FULL_RANGE, date: null}, 'festival-visit-option festival-visit-option-full');

    confirmButton.addEventListener('click', () => {
      if (!selected) return;
      void submit(selected.scope, selected.date);
    });

    const onKeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeSheet(); }
    };
    closeButton.addEventListener('click', () => closeSheet());
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeSheet(); });
    dialog.addEventListener('keydown', onKeydown);

    dialog.append(header, optionsList, confirmButton);
    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
    disposeSheet = () => backdrop.remove();
    (optionButtons[0] || closeButton).focus();
  };

  trigger.addEventListener('click', openSheet);
  return wrap;
}

/**
 * @param {{
 *   root: HTMLElement, fetchImpl?: typeof fetch, now?: Date,
 *   sessionToken?: string, guestRepository?: object,
 *   initialFestivalId?: string, initialSelectedDate?: string,
 * }} options
 */
export async function mountFestivalManager({
  root, fetchImpl = globalThis.fetch, now = new Date(),
  sessionToken = '', guestRepository = null,
  initialFestivalId = '', initialSelectedDate = '',
} = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('root is required');
  root.replaceChildren();

  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  const repository = authenticated ? null : (guestRepository || createGuestCalendarRepository(globalThis.localStorage));

  const state = {region: '', ongoing: false, weekend: false, dateMode: '', customDate: ''};
  let regionProvinces = [];
  let requestToken = 0;

  const container = el('div', 'festival-manager');
  const filterBar = el('div', 'festival-filter-bar');
  filterBar.setAttribute('role', 'group');
  filterBar.setAttribute('aria-label', '축제 필터');
  const quickRow = el('div', 'festival-chip-row festival-quick-row');
  const regionRow = el('div', 'festival-chip-row festival-region-row');
  regionRow.setAttribute('role', 'group');
  regionRow.setAttribute('aria-label', '지역별 필터');
  const dateRow = el('div', 'festival-date-row');
  filterBar.append(quickRow, regionRow, dateRow);

  const status = el('p', 'festival-status');
  status.setAttribute('role', 'status');
  const error = el('p', 'festival-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const empty = el('p', 'festival-empty');
  empty.hidden = true;
  empty.textContent = '조건에 맞는 축제가 없습니다.';
  const grid = el('div', 'festival-card-grid');
  const listSurface = el('div', 'festival-list-surface');
  listSurface.append(filterBar, status, error, empty, grid);

  const detailSurface = el('div', 'festival-detail-surface');
  detailSurface.hidden = true;

  container.append(listSurface, detailSurface);
  root.appendChild(container);

  const weekendChip = chipButton('이번주말', {
    onClick: () => { state.weekend = !state.weekend; weekendChip.setAttribute('aria-pressed', String(state.weekend)); loadList(); },
  });
  const ongoingChip = chipButton('진행중', {
    onClick: () => { state.ongoing = !state.ongoing; ongoingChip.setAttribute('aria-pressed', String(state.ongoing)); loadList(); },
  });
  quickRow.append(weekendChip, ongoingChip);

  const todayButton = chipButton('오늘', {
    onClick: () => {
      state.dateMode = state.dateMode === 'today' ? '' : 'today';
      state.customDate = '';
      dateInput.value = '';
      todayButton.setAttribute('aria-pressed', String(state.dateMode === 'today'));
      loadList();
    },
  });
  const dateLabel = document.createElement('label');
  dateLabel.className = 'festival-date-field';
  dateLabel.append(el('span', '', '날짜 선택'));
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.addEventListener('change', () => {
    state.customDate = dateInput.value || '';
    state.dateMode = state.customDate ? 'custom' : '';
    todayButton.setAttribute('aria-pressed', 'false');
    loadList();
  });
  dateLabel.appendChild(dateInput);
  dateRow.append(todayButton, dateLabel);

  function activeFilters() {
    const filters = {};
    if (state.region) filters.region = state.region;
    if (state.ongoing) filters.status = 'ONGOING';
    if (state.weekend) filters.weekend = true;
    if (state.dateMode === 'today') filters.date = 'today';
    else if (state.dateMode === 'custom' && state.customDate) filters.date = state.customDate;
    return filters;
  }

  function renderRegionChips() {
    regionRow.replaceChildren();
    const allChip = chipButton('전체', {
      pressed: !state.region,
      onClick: () => selectRegion(''),
    });
    regionRow.appendChild(allChip);
    for (const province of regionProvinces) {
      const chip = chipButton(province, {
        pressed: state.region === province,
        onClick: () => selectRegion(province),
      });
      regionRow.appendChild(chip);
    }
  }

  function selectRegion(province) {
    state.region = province;
    for (const chip of regionRow.querySelectorAll('.festival-chip')) {
      chip.setAttribute('aria-pressed', chip.textContent === (province || '전체') ? 'true' : 'false');
    }
    loadList();
  }

  function openDetail(id, selectedDate = '') {
    void renderDetail(id, selectedDate);
  }

  let listLoaded = false;
  async function loadList() {
    listLoaded = true;
    const token = ++requestToken;
    status.hidden = false;
    status.textContent = '축제 정보를 불러오는 중입니다.';
    error.hidden = true;
    empty.hidden = true;
    grid.replaceChildren();
    try {
      const [festivals, regions] = await Promise.all([
        listPublishedFestivals(activeFilters(), fetchImpl),
        regionProvinces.length ? Promise.resolve({provinces: regionProvinces}) : listFestivalRegions(fetchImpl),
      ]);
      if (token !== requestToken) return;
      if (!regionProvinces.length) {
        regionProvinces = regions.provinces;
        renderRegionChips();
      }
      status.hidden = true;
      if (!festivals.length) {
        empty.hidden = false;
        return;
      }
      for (const festival of festivals) grid.appendChild(buildCard(festival, now, {onOpen: openDetail}));
    } catch {
      if (token !== requestToken) return;
      status.hidden = true;
      error.hidden = false;
      error.textContent = '축제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  async function renderDetail(id, selectedDate = '') {
    // Shares requestToken with loadList(): opening festival B's detail before
    // festival A's weather read resolves must never let A's late response
    // land on B's now-visible date groups.
    const detailToken = ++requestToken;
    listSurface.hidden = true;
    detailSurface.hidden = false;
    detailSurface.replaceChildren();
    const loading = el('p', 'festival-status', '축제 정보를 불러오는 중입니다.');
    loading.setAttribute('role', 'status');
    detailSurface.appendChild(loading);
    let festival;
    try {
      festival = await getPublishedFestival(id, fetchImpl);
    } catch {
      festival = null;
    }
    if (detailToken !== requestToken) return;
    detailSurface.replaceChildren();
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = '← 목록으로';
    back.addEventListener('click', () => {
      detailSurface.hidden = true;
      listSurface.hidden = false;
      if (!listLoaded) void loadList();
    });
    detailSurface.appendChild(back);

    if (!festival) {
      const notFound = el('p', 'festival-error', '축제 정보를 찾을 수 없습니다.');
      notFound.setAttribute('role', 'alert');
      detailSurface.appendChild(notFound);
      return;
    }

    detailSurface.appendChild(heroImage(festival));
    const header = el('div', 'festival-detail-header');
    header.appendChild(statusBadge(computeFestivalStatus(festival, now)));
    header.appendChild(el('h3', 'festival-detail-name', festival.name));
    header.appendChild(el('p', 'festival-detail-period', formatFestivalPeriod(festival)));
    const location = formatFestivalLocation(festival);
    if (location) header.appendChild(el('p', 'festival-detail-location', location));
    if (festival.address) header.appendChild(el('p', 'festival-detail-address', festival.address));
    if (festival.summary) header.appendChild(el('p', 'festival-detail-summary', festival.summary));
    detailSurface.appendChild(header);
    detailSurface.appendChild(buildCalendarAddSection(detailSurface, festival, {authenticated, sessionToken, guestRepository: repository, now}));

    const programSection = buildProgramSection(festival, {initialSelectedDate: selectedDate, now});
    detailSurface.appendChild(programSection.section);
    detailSurface.appendChild(buildReservationSection(festival));
    const parkingShuttle = buildParkingShuttleSection(festival);
    if (parkingShuttle) detailSurface.appendChild(parkingShuttle);
    const officialSource = buildOfficialSourceSection(festival);
    if (officialSource) detailSurface.appendChild(officialSource);

    // Program stays visible immediately; weather (venue coordinates only,
    // never the visitor's own location) fills in the date-group headings once
    // it resolves, or never, if there is no usable venue coordinate, no
    // program, or the read fails — the program section is never blocked or
    // hidden on this.
    if (festival.programs.length && Number.isFinite(festival.latitude) && Number.isFinite(festival.longitude)) {
      getFestivalProgramWeather({festival, fetchImpl}).then(result => {
        if (detailToken !== requestToken) return;
        if (result.ok) programSection.applyWeather(result);
      });
    }
  }

  if (initialFestivalId) await renderDetail(initialFestivalId, initialSelectedDate);
  else await loadList();

  return {
    dispose() {
      requestToken += 1;
    },
  };
}
