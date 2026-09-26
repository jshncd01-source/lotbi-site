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
  FESTIVAL_STATUS_LABEL,
  computeFestivalStatus,
  getPublishedFestival,
  listFestivalRegions,
  listPublishedFestivals,
  sortFestivalPrograms,
} from './site-festival-client.js?v=aset-0f9b623eab90';

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

function buildProgramSection(festival) {
  const section = el('section', 'festival-section festival-programs');
  section.appendChild(el('h4', 'festival-section-title', '주요 프로그램'));
  if (!festival.programs.length) {
    section.appendChild(el('p', 'festival-empty-note', '등록된 프로그램 정보가 없습니다.'));
    return section;
  }

  const categoryRow = el('div', 'festival-chip-row');
  categoryRow.setAttribute('role', 'group');
  categoryRow.setAttribute('aria-label', '프로그램 카테고리 필터');
  const list = el('div', 'festival-program-groups');
  section.append(categoryRow, list);

  let activeCategory = '';
  const categories = ['전체', ...FESTIVAL_PROGRAM_CATEGORIES];
  const chips = new Map();

  const renderPrograms = () => {
    list.replaceChildren();
    const filtered = filterProgramsByCategory(festival.programs, activeCategory);
    if (!filtered.length) {
      list.appendChild(el('p', 'festival-empty-note', '선택한 카테고리의 프로그램이 없습니다.'));
      return;
    }
    for (const group of groupProgramsByDate(filtered)) {
      const groupEl = el('div', 'festival-program-group');
      groupEl.appendChild(el('h5', 'festival-program-date', formatFestivalDateLabel(group.date)));
      const ul = document.createElement('ul');
      ul.className = 'festival-program-list';
      for (const program of group.programs) {
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
      groupEl.appendChild(ul);
      list.appendChild(groupEl);
    }
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
  renderPrograms();
  return section;
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

/**
 * @param {{root: HTMLElement, fetchImpl?: typeof fetch, now?: Date}} options
 */
export async function mountFestivalManager({root, fetchImpl = globalThis.fetch, now = new Date()} = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('root is required');
  root.replaceChildren();

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

  function openDetail(id) {
    void renderDetail(id);
  }

  async function loadList() {
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

  async function renderDetail(id) {
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
    detailSurface.replaceChildren();
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = '← 목록으로';
    back.addEventListener('click', () => {
      detailSurface.hidden = true;
      listSurface.hidden = false;
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

    detailSurface.appendChild(buildProgramSection(festival));
    detailSurface.appendChild(buildReservationSection(festival));
    const parkingShuttle = buildParkingShuttleSection(festival);
    if (parkingShuttle) detailSurface.appendChild(parkingShuttle);
    const officialSource = buildOfficialSourceSection(festival);
    if (officialSource) detailSurface.appendChild(officialSource);
  }

  await loadList();

  return {
    dispose() {
      requestToken += 1;
    },
  };
}
