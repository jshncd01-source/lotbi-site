// FESTIVAL-EVENT-07 — public "축제·행사" browse UI.
//
// Mounted on demand into the shared site modal shell (see openFestival() in
// site-conversation.js), exactly like mountPetFamilyManager() is mounted for
// the 반려동물 panel. Renders only what site-festival-client.js returns —
// that module is the only way this file ever touches festival data, and it
// is the enforced PUBLISHED-only boundary (see its allowlist normalizers).
// This module never calls FESTIVAL-EVENT-01/03/04/05/06 (staff/admin) or any
// other private/internal API directly.
//
// List/location/filter responsibilities (this room) vs. detail (FESTIVAL-
// EVENT-08, which owns the final consumer detail design): the detail-
// rendering functions below (heroImage/statusBadge/buildProgramSection/
// buildReservationSection/buildParkingShuttleSection/buildOfficialSourceSection/
// renderDetail) are left structurally as-is — only fed real, normalized data
// instead of a fixture — so FESTIVAL-EVENT-08 can redesign them without this
// room having pre-empted that work.
import {
  FESTIVAL_PROGRAM_CATEGORIES,
  FESTIVAL_RESERVATION_TYPE_LABEL,
  FESTIVAL_STATUS_LABEL,
  FESTIVAL_TIME_FILTER,
  FESTIVAL_TIME_FILTER_LABEL,
  browseFestivals,
  computeFestivalStatus,
  getPublishedFestival,
  listFestivalRegions,
  resolveCurrentRegionLabel,
  sortFestivalPrograms,
} from './site-festival-client.js?v=aset-625724e05994';
import {createBottomSheet} from './site-bottom-sheet.js?v=aset-625724e05994';
import {
  BrowserLocationError,
  LOCATION_PERMISSION,
  getBrowserLocationPermissionState,
  requestBrowserCurrentLocation,
} from './site-current-location.js?v=aset-625724e05994';

const PAGE_SIZE = 20;

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

function actionButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
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
  const showPlaceholder = () => {
    wrap.replaceChildren();
    wrap.classList.add('festival-hero-placeholder');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `${festival.name} 대표 이미지 없음`);
  };
  if (festival.imageUrl) {
    const img = document.createElement('img');
    img.src = festival.imageUrl;
    img.alt = `${festival.name} 대표 이미지`;
    img.loading = 'lazy';
    img.addEventListener('error', showPlaceholder, {once: true});
    wrap.appendChild(img);
  } else {
    showPlaceholder();
  }
  return wrap;
}

function buildListCard(festival, now, {onOpen, showDistance}) {
  const status = computeFestivalStatus(festival, now);
  const card = el('article', 'festival-list-card');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'festival-list-card-open';
  button.setAttribute('aria-label', `${festival.name} 상세 보기`);
  button.addEventListener('click', () => onOpen(festival.id));

  button.appendChild(heroImage(festival));
  const body = el('div', 'festival-list-card-body');
  body.appendChild(statusBadge(status));
  body.appendChild(el('h3', 'festival-list-card-name', festival.name));
  body.appendChild(el('p', 'festival-list-card-period', formatFestivalPeriod(festival)));
  if (festival.region) body.appendChild(el('p', 'festival-list-card-region', festival.region));
  if (showDistance && typeof festival.distanceKm === 'number') {
    body.appendChild(el('p', 'festival-list-card-distance', `${festival.distanceKm}km`));
  }
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

function emptyMessageFor(state) {
  if (state.region) return `현재 조건에 맞는 축제·행사가 없어요 (${state.region})`;
  if (state.locationMode === 'CURRENT') return '현재 위치 주변에 조건에 맞는 축제·행사가 없어요';
  return '현재 조건에 맞는 축제·행사가 없어요';
}

/**
 * @param {{root: HTMLElement, fetchImpl?: typeof fetch, now?: Date}} options
 */
export async function mountFestivalManager({root, fetchImpl = globalThis.fetch, now = new Date()} = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('root is required');
  root.replaceChildren();

  const state = {
    region: '',
    time: FESTIVAL_TIME_FILTER.ALL,
    customDate: '',
    locationMode: 'NONE', // 'NONE' | 'CURRENT'
    currentPosition: null,
    currentRegionLabel: '',
    locationPermission: LOCATION_PERMISSION.UNKNOWN,
    locationBusy: false,
  };
  let regionProvinces = [];
  let regionProvincesPromise = null;
  let requestToken = 0;
  let currentAbort = null;
  let nextOffset = 0;
  let hasMore = false;
  let regionSheetRef = null;

  const container = el('div', 'festival-manager');
  const locationBanner = el('div', 'festival-location-banner');
  const filterBar = el('div', 'festival-filter-bar');
  filterBar.setAttribute('role', 'group');
  filterBar.setAttribute('aria-label', '시간 필터');
  const timeRow = el('div', 'festival-chip-row festival-time-row');
  timeRow.setAttribute('role', 'group');
  timeRow.setAttribute('aria-label', '시간 필터');
  const dateField = document.createElement('label');
  dateField.className = 'festival-date-field';
  dateField.hidden = true;
  dateField.append(el('span', '', '날짜 선택'));
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateField.appendChild(dateInput);
  filterBar.append(timeRow, dateField);

  const liveRegion = el('p', 'sr-only');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  const status = el('p', 'festival-status');
  status.setAttribute('role', 'status');
  const error = el('p', 'festival-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const retryButton = actionButton('다시 시도', 'festival-retry-button', () => fetchAndRender({reset: true}));
  retryButton.hidden = true;
  const empty = el('p', 'festival-empty');
  empty.hidden = true;
  const grid = el('div', 'festival-list-grid');
  const loadMoreButton = actionButton('더 보기', 'festival-load-more', () => fetchAndRender({reset: false}));
  loadMoreButton.hidden = true;
  const listSurface = el('div', 'festival-list-surface');
  listSurface.append(locationBanner, filterBar, liveRegion, status, error, retryButton, empty, grid, loadMoreButton);

  const detailSurface = el('div', 'festival-detail-surface');
  detailSurface.hidden = true;

  container.append(listSurface, detailSurface);
  root.appendChild(container);

  function ensureRegionProvinces() {
    if (!regionProvincesPromise) {
      regionProvincesPromise = listFestivalRegions(fetchImpl).then(result => {
        regionProvinces = result.provinces;
        return regionProvinces;
      });
    }
    return regionProvincesPromise;
  }
  void ensureRegionProvinces();

  function renderLocationBanner() {
    locationBanner.replaceChildren();
    const label = el('span', 'festival-location-label');
    if (state.region) {
      label.textContent = `📍 ${state.region}`;
    } else if (state.locationMode === 'CURRENT') {
      label.textContent = state.currentRegionLabel
        ? `📍 현재 위치 기준 · ${state.currentRegionLabel}`
        : '📍 현재 위치 기준';
    } else {
      label.textContent = '📍 전국';
    }
    locationBanner.appendChild(label);

    const actions = el('div', 'festival-location-actions');
    if (state.locationBusy) {
      actions.appendChild(el('span', 'festival-location-busy', '현재 위치 확인 중...'));
    } else {
      if (state.locationMode !== 'CURRENT' && state.locationPermission !== LOCATION_PERMISSION.DENIED) {
        actions.appendChild(actionButton('현재 위치로 보기', 'festival-location-button', () => void useCurrentLocation({auto: false})));
      }
      actions.appendChild(actionButton('지역 변경', 'festival-location-button', () => void openRegionSheet()));
    }
    locationBanner.appendChild(actions);
  }

  async function openRegionSheet() {
    await ensureRegionProvinces();
    regionSheetRef = createBottomSheet({
      label: '지역 변경',
      content: () => buildRegionSheetBody(),
      onClose: () => { regionSheetRef = null; },
    });
    regionSheetRef.open();
  }

  function buildRegionSheetBody() {
    const wrap = el('div', 'festival-region-sheet');
    wrap.appendChild(el('h3', 'festival-region-sheet-title', '지역 변경'));
    const list = el('div', 'festival-region-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', '광역시·도 선택');
    for (const province of regionProvinces) {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'festival-region-option';
      optionButton.setAttribute('role', 'option');
      const selected = state.region === province;
      optionButton.setAttribute('aria-selected', String(selected));
      if (selected) optionButton.classList.add('is-selected');
      optionButton.textContent = province;
      optionButton.addEventListener('click', () => {
        selectManualRegion(province);
        regionSheetRef?.close();
      });
      list.appendChild(optionButton);
    }
    wrap.appendChild(list);
    if (state.locationPermission !== LOCATION_PERMISSION.DENIED) {
      wrap.appendChild(actionButton('현재 위치로 돌아가기', 'festival-region-current-button', () => {
        regionSheetRef?.close();
        void useCurrentLocation({auto: false});
      }));
    }
    return wrap;
  }

  function selectManualRegion(province) {
    state.region = province;
    state.locationMode = 'NONE';
    state.currentPosition = null;
    state.currentRegionLabel = '';
    renderLocationBanner();
    void fetchAndRender({reset: true});
  }

  async function useCurrentLocation({auto = false} = {}) {
    state.locationBusy = true;
    renderLocationBanner();
    try {
      const position = await requestBrowserCurrentLocation();
      state.currentPosition = {latitude: position.latitude, longitude: position.longitude};
      state.region = '';
      state.locationMode = 'CURRENT';
      state.currentRegionLabel = resolveCurrentRegionLabel(position.latitude, position.longitude);
      state.locationPermission = LOCATION_PERMISSION.GRANTED;
    } catch (error_) {
      if (error_ instanceof BrowserLocationError && error_.code === 'BROWSER_LOCATION_DENIED') {
        state.locationPermission = LOCATION_PERMISSION.DENIED;
      }
      state.locationMode = 'NONE';
      state.currentPosition = null;
      state.currentRegionLabel = '';
      if (auto) console.warn('[LOTBI 축제·행사] 허용된 위치 권한으로 현재 위치를 확인하지 못했습니다.', error_);
    } finally {
      state.locationBusy = false;
      renderLocationBanner();
    }
    await fetchAndRender({reset: true});
  }

  function selectTimeFilter(key) {
    state.time = key;
    for (const [value, button] of timeButtons) button.setAttribute('aria-pressed', String(value === key));
    dateField.hidden = key !== FESTIVAL_TIME_FILTER.DATE;
    if (key === FESTIVAL_TIME_FILTER.DATE) {
      if (state.customDate) void fetchAndRender({reset: true});
      return;
    }
    void fetchAndRender({reset: true});
  }

  const timeButtons = new Map();
  for (const key of Object.values(FESTIVAL_TIME_FILTER)) {
    const button = chipButton(FESTIVAL_TIME_FILTER_LABEL[key], {
      pressed: state.time === key,
      onClick: () => selectTimeFilter(key),
    });
    timeButtons.set(key, button);
    timeRow.appendChild(button);
  }
  dateInput.addEventListener('change', () => {
    state.customDate = dateInput.value || '';
    if (state.customDate) void fetchAndRender({reset: true});
  });

  function buildQuery(offset) {
    const query = {time: state.time, limit: PAGE_SIZE, offset};
    if (state.time === FESTIVAL_TIME_FILTER.DATE && state.customDate) query.date = state.customDate;
    if (state.region) {
      query.region = state.region;
    } else if (state.locationMode === 'CURRENT' && state.currentPosition) {
      query.latitude = state.currentPosition.latitude;
      query.longitude = state.currentPosition.longitude;
    }
    return query;
  }

  function openDetail(id) {
    void renderDetail(id);
  }

  async function fetchAndRender({reset}) {
    const token = ++requestToken;
    if (currentAbort) currentAbort.abort();
    const controller = new AbortController();
    currentAbort = controller;

    if (reset) {
      nextOffset = 0;
      grid.replaceChildren();
      status.hidden = false;
      status.textContent = '축제·행사를 불러오는 중이에요';
      error.hidden = true;
      retryButton.hidden = true;
      empty.hidden = true;
      loadMoreButton.hidden = true;
    } else {
      loadMoreButton.disabled = true;
      loadMoreButton.textContent = '불러오는 중...';
    }

    const query = buildQuery(reset ? 0 : nextOffset);
    const scopedFetch = (input, init) => fetchImpl(input, {...init, signal: controller.signal});

    try {
      const result = await browseFestivals(query, scopedFetch);
      if (token !== requestToken) return;
      status.hidden = true;
      if (reset) {
        if (!result.festivals.length) {
          empty.hidden = false;
          empty.textContent = emptyMessageFor(state);
        }
      }
      for (const festival of result.festivals) {
        grid.appendChild(buildListCard(festival, now, {onOpen: openDetail, showDistance: state.locationMode === 'CURRENT'}));
      }
      hasMore = result.hasMore;
      nextOffset = result.nextOffset ?? nextOffset + result.festivals.length;
      loadMoreButton.hidden = !hasMore;
      liveRegion.textContent = result.festivals.length
        ? `축제·행사 ${result.totalCount}건 중 ${grid.children.length}건을 보여주고 있어요.`
        : emptyMessageFor(state);
    } catch (fetchError) {
      if (token !== requestToken) return;
      if (fetchError?.name === 'AbortError') return;
      status.hidden = true;
      error.hidden = false;
      error.textContent = '축제·행사 정보를 불러오지 못했어요.';
      retryButton.hidden = false;
    } finally {
      if (token === requestToken) {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = '더 보기';
      }
    }
  }

  async function renderDetail(id) {
    listSurface.hidden = true;
    detailSurface.hidden = false;
    detailSurface.replaceChildren();
    const loading = el('p', 'festival-status', '축제·행사 정보를 불러오는 중이에요');
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
      const notFound = el('p', 'festival-error', '축제·행사 정보를 찾을 수 없습니다.');
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

  renderLocationBanner();
  state.locationPermission = await getBrowserLocationPermissionState();
  if (state.locationPermission === LOCATION_PERMISSION.GRANTED) {
    await useCurrentLocation({auto: true});
  } else {
    renderLocationBanner();
    await fetchAndRender({reset: true});
  }

  return {
    dispose() {
      requestToken += 1;
      currentAbort?.abort();
      regionSheetRef?.close();
    },
  };
}
