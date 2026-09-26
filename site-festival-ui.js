// FESTIVAL-EVENT-08 — public "축제" browse + detail/program UI.
//
// Mounted on demand into the shared site modal shell (see openFestival() in
// site-conversation.js), exactly like mountPetFamilyManager() is mounted for
// the 반려동물 panel. Renders only what listPublishedFestivals()/
// getPublishedFestival() (site-festival-client.js) return — those two
// functions are the only way this file ever touches festival data, and they
// are the enforced PUBLISHED-only boundary (see the allowlist normalizer
// there). This module never calls any private/internal Core API directly.
//
// Detail screen principle: a quick "언제/어디서/무슨 프로그램/체험·신청
// 가능여부" answer, not a copy of an official info page. At most two primary
// CTAs — [프로그램] (LOTBI's own internal date-tab program screen, never an
// external PROGRAM_PAGE handoff) and [체험·신청] (one unified external
// handoff). The legacy 공식홈페이지/예약안내/주차·셔틀/공식출처 sections are
// gone: homepage_url/transport/notices/telephone are not even present on the
// normalized Site model any more (see site-festival-client.js), so there is
// nothing left here that could render them.
import {
  computeFestivalStatus,
  formatFestivalDateLabel,
  formatFestivalDateTabLabel,
  formatFestivalLocation,
  formatFestivalPeriod,
  getPublishedFestival,
  groupProgramsByDate,
  listFestivalRegions,
  listPublishedFestivals,
  selectInitialProgramDate,
  FESTIVAL_STATUS_LABEL,
} from './site-festival-client.js?v=aset-c4450fb313c4';

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

function statusBadge(status) {
  return el('span', `festival-status-badge festival-status-${status.toLowerCase()}`, FESTIVAL_STATUS_LABEL[status] || status);
}

function heroImage(festival, {compact = false} = {}) {
  const wrap = el('div', compact ? 'festival-hero' : 'festival-hero festival-hero-detail');
  if (festival.imageUrl) {
    const img = document.createElement('img');
    img.src = festival.imageUrl;
    img.alt = `${festival.name} 대표 이미지`;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      // A registered image_url that fails to actually load must degrade to
      // the same neutral placeholder as "no image", never a broken-image icon.
      img.remove();
      wrap.classList.add('festival-hero-placeholder');
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', `${festival.name} 대표 이미지 없음`);
    }, {once: true});
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

  button.appendChild(heroImage(festival, {compact: true}));
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

// -------------------------------------------------------------- CTA row ---

function buildCtaRow(festival, {onOpenPrograms}) {
  const hasPrograms = Array.isArray(festival.programs) && festival.programs.length > 0;
  const hasParticipation = Boolean(festival.participationUrl);
  if (!hasPrograms && !hasParticipation) return null; // no CTA row at all — never an empty shell

  const row = el('div', 'festival-cta-row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '축제 주요 액션');

  if (hasPrograms) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'festival-cta-button festival-cta-program';
    button.textContent = '프로그램';
    button.addEventListener('click', onOpenPrograms);
    row.appendChild(button);
  }

  if (hasParticipation) {
    const link = document.createElement('a');
    link.className = 'festival-cta-button festival-cta-participation';
    link.href = festival.participationUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    link.textContent = '체험·신청';
    link.setAttribute('aria-label', '체험·신청, 공식 외부 사이트가 새 창에서 열립니다');
    row.appendChild(link);
  }

  return row;
}

// ---------------------------------------------------------- program view --

function buildDateTabs(dateTabs, {selected, onSelect}) {
  const nav = el('div', 'festival-date-tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', '프로그램 날짜 선택');

  dateTabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'festival-date-tab';
    button.id = `festival-date-tab-${tab.date}`;
    button.setAttribute('role', 'tab');
    // Stable per-date identity for a later room (weather) to join
    // date -> weatherByDate on; never used for KMA/precipitation logic here.
    button.setAttribute('data-festival-program-date', tab.date);
    button.textContent = formatFestivalDateTabLabel(tab.date);
    const isSelected = tab.date === selected;
    button.setAttribute('aria-selected', String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
    button.addEventListener('click', () => onSelect(tab.date));
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + dateTabs.length) % dateTabs.length;
      onSelect(dateTabs[nextIndex].date, {focus: true});
    });
    nav.appendChild(button);
  });

  return nav;
}

function buildProgramPanel(tab) {
  const panel = el('div', 'festival-program-day-panel');
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `festival-date-tab-${tab.date}`);

  const ul = document.createElement('ul');
  ul.className = 'festival-program-list';
  for (const program of tab.programs) {
    const li = document.createElement('li');
    li.className = 'festival-program-item';
    const timeText = program.startTime
      ? (program.endTime ? `${program.startTime} ~ ${program.endTime}` : program.startTime)
      : '';
    if (timeText) li.appendChild(el('span', 'festival-program-time', timeText));
    li.appendChild(el('span', 'festival-program-title', program.title));
    if (program.venue) li.appendChild(el('span', 'festival-program-venue', program.venue));
    if (program.category) li.appendChild(el('span', 'festival-program-category', program.category));
    if (program.price) li.appendChild(el('span', 'festival-program-price', program.price));
    if (program.notes) li.appendChild(el('p', 'festival-program-note', program.notes));
    ul.appendChild(li);
  }
  panel.appendChild(ul);
  return panel;
}

/**
 * @param {{root: HTMLElement, fetchImpl?: typeof fetch, now?: Date, selectedDate?: string}} options
 */
export async function mountFestivalManager({root, fetchImpl = globalThis.fetch, now = new Date(), selectedDate} = {}) {
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

  const programSurface = el('div', 'festival-program-surface');
  programSurface.hidden = true;

  container.append(listSurface, detailSurface, programSurface);
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

  function showList() {
    programSurface.hidden = true;
    detailSurface.hidden = true;
    listSurface.hidden = false;
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

  function renderProgramSurface(festival) {
    programSurface.replaceChildren();

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = '← 행사 정보로';
    back.addEventListener('click', () => {
      programSurface.hidden = true;
      detailSurface.hidden = false;
    });
    programSurface.appendChild(back);

    const dateTabs = groupProgramsByDate(festival.programs);
    if (!dateTabs.length) {
      programSurface.appendChild(el('p', 'festival-empty-note', '등록된 프로그램 정보가 없습니다.'));
      return;
    }

    const body = el('div', 'festival-program-body');
    programSurface.appendChild(body);

    let selected = selectInitialProgramDate(dateTabs, {selectedDate, now});

    function paint(focusDate) {
      body.replaceChildren();
      const tabsNav = buildDateTabs(dateTabs, {
        selected,
        onSelect: (date, options = {}) => {
          selected = date;
          paint(options.focus ? date : undefined);
        },
      });
      body.appendChild(tabsNav);
      const activeTab = dateTabs.find(tab => tab.date === selected) || dateTabs[0];
      body.appendChild(buildProgramPanel(activeTab));
      if (focusDate) tabsNav.querySelector(`[data-festival-program-date="${focusDate}"]`)?.focus();
    }

    paint();
  }

  function openProgramSurface(festival) {
    listSurface.hidden = true;
    detailSurface.hidden = true;
    programSurface.hidden = false;
    renderProgramSurface(festival);
  }

  async function renderDetail(id) {
    listSurface.hidden = true;
    programSurface.hidden = true;
    detailSurface.hidden = false;
    detailSurface.replaceChildren();

    const loading = el('p', 'festival-status', '축제·행사 정보를 불러오는 중이에요.');
    loading.setAttribute('role', 'status');
    detailSurface.appendChild(loading);

    let festival = null;
    let failed = false;
    try {
      festival = await getPublishedFestival(id, fetchImpl);
    } catch {
      failed = true;
    }

    detailSurface.replaceChildren();

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = '← 목록으로';
    back.addEventListener('click', showList);
    detailSurface.appendChild(back);

    if (failed) {
      const message = el('p', 'festival-error', '축제·행사 정보를 불러오지 못했어요.');
      message.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'festival-retry-button';
      retry.textContent = '다시 시도';
      retry.addEventListener('click', () => renderDetail(id));
      detailSurface.append(message, retry);
      return;
    }

    if (!festival) {
      const message = el('p', 'festival-error', '축제·행사 정보를 찾을 수 없어요.');
      message.setAttribute('role', 'alert');
      const toList = document.createElement('button');
      toList.type = 'button';
      toList.className = 'festival-retry-button';
      toList.textContent = '목록으로 돌아가기';
      toList.addEventListener('click', showList);
      detailSurface.append(message, toList);
      return;
    }

    detailSurface.appendChild(heroImage(festival));

    const header = el('div', 'festival-detail-header');
    header.appendChild(statusBadge(computeFestivalStatus(festival, now)));
    header.appendChild(el('h3', 'festival-detail-name', festival.name));
    header.appendChild(el('p', 'festival-detail-period', formatFestivalPeriod(festival)));
    const location = formatFestivalLocation(festival);
    if (location) header.appendChild(el('p', 'festival-detail-location', location));
    if (festival.summary) header.appendChild(el('p', 'festival-detail-summary', festival.summary));
    detailSurface.appendChild(header);

    const ctaRow = buildCtaRow(festival, {onOpenPrograms: () => openProgramSurface(festival)});
    if (ctaRow) detailSurface.appendChild(ctaRow);
  }

  await loadList();

  return {
    dispose() {
      requestToken += 1;
    },
  };
}

// Exported for tests / potential reuse; kept out of the main render path
// above where not needed directly.
export {formatFestivalDateLabel};
