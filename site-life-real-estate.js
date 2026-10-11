// REAL-ESTATE-REGION-FAVORITES-P0 — 지역정보 → 부동산 실거래가, a list screen of its own.
//
// No conversation and no AI: every number is a reported contract that Core read
// from 국토교통부 실거래가 (매매 / 전월세). The screen:
//
// * 검색 지역 — 광역시·도 → 시·군·구 → 읍·면·동 (법정동). With LOTBI 위치 사용 on and
//   the browser already allowing it, the current location fills the three steps
//   as far as Core confirms an official 법정동 code; a reader can change any step
//   at any time, search a region by name, or pick 전체 읍·면·동. A picked region is
//   remembered on this device (MANUAL) and is never replaced by the location
//   until [현재 위치로 다시 설정]. It is a search region only: the LOTBI 기본
//   생활지역 and the reader's address are never touched.
// * 매매 / 전세 / 월세, 기간, 아파트 이름 검색 → a compact list, newest deal first.
// * ♡ / ♥ 관심 아파트 — on the account when signed in (Core), on this device
//   otherwise (never merged into an account without the reader's tap).
// * 아파트 상세 — every reported contract of the complex, newest first, and the
//   reader's default map app opened on the official name + address (no pin).
//
// Navigation: the host (site-conversation.js) owns the route. This module tells
// it which view is on screen (onView 'list' | 'detail') and asks it to go back
// (requestBack) so browser / Android back and the screen's own ← agree.
import {
  formatArea, formatDealDate, formatDealLine, formatFloor, formatManwon, favoritesRequest, getRealEstate, isApartmentId,
  locateUrl, normalizeApartmentItem, readGuestFavorites, readOpenApartment, readRegionPreference, REAL_ESTATE_DEALS,
  REAL_ESTATE_DETAIL_MONTHS, REAL_ESTATE_GUEST_FAVORITES_LIMIT, REAL_ESTATE_LIST_MONTHS, writeGuestFavorites,
  writeOpenApartment, writeRegionPreference,
} from './site-real-estate-client.js?v=aset-5f088337561e';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-5f088337561e';
import {isLocationUsageEnabled, readDefaultMapProvider} from './site-location-preference.js?v=aset-5f088337561e';
import {buildDefaultMapHref, defaultMapProviderPresentation} from './site-navigation.js?v=aset-5f088337561e';

export const REAL_ESTATE_SETTINGS_URL = 'https://account.lotbiai.com/account#privacy';
const MAP_ICON_BASE = '/assets/place-actions/';
const MAP_ICON_VERSION = 'place-icons-20260925';
const LIST_LIMIT = 20;
const SUMMARY_CONCURRENCY = 2;
const DEAL_LABEL = Object.freeze(Object.fromEntries(REAL_ESTATE_DEALS.map(item => [item.id, item.label])));
const MONTH_LABEL = months => (months === 12 ? '최근 1년' : months === 24 ? '최근 2년' : `최근 ${months}개월`);

function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}
function button(label, className = 'consumer-action consumer-action-secondary') {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}
function option(value, label) {
  const node = el('option', '', label);
  node.value = value;
  return node;
}

export function mountRealEstate({
  root,
  fetchImpl = globalThis.fetch,
  sessionToken = '',
  authenticated = false,
  accountId = '',
  onView,
  requestBack,
  storage,
  sessionStore = globalThis.sessionStorage,
  userAgent = globalThis.navigator?.userAgent || '',
} = {}) {
  const signedIn = Boolean(authenticated && sessionToken);
  const owner = signedIn ? accountId : '';
  let disposed = false;
  let listRequest = 0;
  let detailRequest = 0;
  let listController;
  let detailController;
  let searchTimer = 0;
  let savedScroll = 0;
  const state = {
    tab: 'region',
    view: 'list',
    mode: 'NONE',                 // NONE | AUTO | MANUAL
    sido: '', sigungu: '', dong: '',
    deal: 'SALE', months: 3, query: '',
    items: [], total: 0, nextOffset: null,
    favorites: new Map(),         // apartment_id -> favorite
    favoritesLoaded: false,
    apartment: null,              // {apartment_id, name, address_label, from}
    detailMonths: 12,
    permission: LOCATION_PERMISSION.UNKNOWN,
  };

  // ------------------------------------------------------------- skeleton --
  const surface = el('section', 'lotbi-re');
  surface.dataset.realEstate = 'true';
  surface.dataset.reView = 'list';
  const title = el('h3', 'lotbi-re-title', '우리 동네 부동산 실거래가');
  title.tabIndex = -1;

  const tabs = el('div', 'lotbi-re-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '부동산 실거래가 보기');
  const tabButtons = [['region', '지역별 찾기'], ['favorites', '관심 아파트']].map(([id, label]) => {
    const tab = button(label, 'lotbi-re-tab');
    tab.setAttribute('role', 'tab');
    tab.dataset.reTab = id;
    tab.addEventListener('click', () => selectTab(id));
    tabs.append(tab);
    return tab;
  });

  // 지역별 찾기
  const regionPanel = el('div', 'lotbi-re-panel');
  regionPanel.dataset.rePanel = 'region';
  regionPanel.setAttribute('role', 'tabpanel');
  const regionBox = el('fieldset', 'lotbi-re-region');
  const legend = el('legend', 'lotbi-re-legend', '검색 지역');
  const selects = el('div', 'lotbi-re-selects');
  const makeSelect = (name, label) => {
    const wrap = el('label', 'lotbi-re-field');
    wrap.append(el('span', 'lotbi-re-field-label', label));
    const select = el('select');
    select.dataset.reSelect = name;
    select.setAttribute('aria-label', label);
    wrap.append(select);
    selects.append(wrap);
    return select;
  };
  const sidoSelect = makeSelect('sido', '광역시·도');
  const sigunguSelect = makeSelect('sigungu', '시·군·구');
  const dongSelect = makeSelect('dong', '읍·면·동');
  const regionStatus = el('p', 'lotbi-re-region-status');
  regionStatus.dataset.reRegionMode = 'NONE';
  const locationRow = el('div', 'lotbi-re-location');
  const locateButton = button('현재 위치로 설정', 'consumer-action consumer-action-secondary lotbi-re-locate');
  locateButton.dataset.reLocate = 'true';
  locateButton.hidden = true;
  const settingsLink = el('a', 'lotbi-re-settings', 'LOTBI 위치 사용 설정 열기');
  settingsLink.href = REAL_ESTATE_SETTINGS_URL;
  settingsLink.target = '_blank';
  settingsLink.rel = 'noopener noreferrer';
  settingsLink.hidden = true;
  locationRow.append(locateButton, settingsLink);
  const regionSearch = el('div', 'lotbi-re-region-search');
  const regionSearchInput = el('input');
  regionSearchInput.type = 'search';
  regionSearchInput.maxLength = 40;
  regionSearchInput.placeholder = '지역 이름으로 찾기 (예: 역삼동, 송천동1가)';
  regionSearchInput.setAttribute('aria-label', '지역 이름으로 찾기');
  regionSearchInput.dataset.reRegionSearch = 'true';
  const regionResults = el('ul', 'lotbi-re-region-results');
  regionResults.setAttribute('aria-label', '지역 검색 결과');
  regionSearch.append(regionSearchInput, regionResults);
  regionBox.append(legend, selects, regionStatus, locationRow, regionSearch);

  const filters = el('div', 'lotbi-re-filters');
  const deals = el('div', 'lotbi-re-deals');
  deals.setAttribute('role', 'group');
  deals.setAttribute('aria-label', '거래 유형');
  const dealButtons = REAL_ESTATE_DEALS.map(deal => {
    const dealButton = button(deal.label, 'lotbi-re-deal');
    dealButton.dataset.reDeal = deal.id;
    dealButton.addEventListener('click', () => {
      if (disposed || state.deal === deal.id) return;
      state.deal = deal.id;
      paintFilters();
      void loadList();
    });
    deals.append(dealButton);
    return dealButton;
  });
  const periodSelect = el('select', 'lotbi-re-period');
  periodSelect.dataset.rePeriod = 'true';
  periodSelect.setAttribute('aria-label', '기간');
  for (const months of REAL_ESTATE_LIST_MONTHS) periodSelect.append(option(String(months), MONTH_LABEL(months)));
  periodSelect.value = String(state.months);
  const nameForm = el('form', 'lotbi-re-name');
  nameForm.setAttribute('role', 'search');
  const nameInput = el('input');
  nameInput.type = 'search';
  nameInput.maxLength = 40;
  nameInput.placeholder = '아파트 이름 검색';
  nameInput.setAttribute('aria-label', '아파트 이름 검색');
  nameInput.dataset.reName = 'true';
  const nameSubmit = button('찾기', 'consumer-action lotbi-re-name-submit');
  nameSubmit.type = 'submit';
  nameForm.append(nameInput, nameSubmit);
  filters.append(deals, periodSelect, nameForm);

  const basis = el('p', 'lotbi-re-basis');
  const list = el('ul', 'lotbi-re-list');
  list.setAttribute('aria-label', '아파트 실거래가 목록');
  const more = button('더 보기', 'consumer-action consumer-action-secondary lotbi-re-more');
  more.hidden = true;
  const listStatus = el('p', 'lotbi-re-status');
  listStatus.setAttribute('role', 'status');
  listStatus.dataset.reListStatus = 'true';
  const retry = button('다시 시도', 'consumer-action consumer-action-secondary lotbi-re-retry');
  retry.hidden = true;
  const notice = el('p', 'lotbi-re-notice');
  regionPanel.append(regionBox, filters, basis, list, more, listStatus, retry, notice);

  // 관심 아파트
  const favoritesPanel = el('div', 'lotbi-re-panel');
  favoritesPanel.dataset.rePanel = 'favorites';
  favoritesPanel.setAttribute('role', 'tabpanel');
  favoritesPanel.hidden = true;
  const favoritesNote = el('p', 'lotbi-re-fav-note');
  const migrate = el('div', 'lotbi-re-migrate');
  migrate.hidden = true;
  const favoritesList = el('ul', 'lotbi-re-list lotbi-re-fav-list');
  favoritesList.setAttribute('aria-label', '관심 아파트 목록');
  const favoritesStatus = el('p', 'lotbi-re-status');
  favoritesStatus.setAttribute('role', 'status');
  favoritesStatus.dataset.reFavoritesStatus = 'true';
  favoritesPanel.append(favoritesNote, migrate, favoritesList, favoritesStatus);

  // 아파트 상세
  const detail = el('section', 'lotbi-re-detail');
  detail.dataset.reDetail = 'true';
  detail.hidden = true;
  const detailBack = button('← 목록으로', 'consumer-action consumer-action-secondary lotbi-re-detail-back');
  detailBack.dataset.reDetailBack = 'true';
  const detailHead = el('div', 'lotbi-re-detail-head');
  const detailTitle = el('h3', 'lotbi-re-detail-title');
  detailTitle.tabIndex = -1;
  const detailHeart = el('button', 'lotbi-re-heart');
  detailHeart.type = 'button';
  detailHeart.dataset.reHeart = 'detail';
  detailHead.append(detailTitle, detailHeart);
  const detailAddress = el('p', 'lotbi-re-detail-address');
  const detailMeta = el('p', 'lotbi-re-detail-meta');
  const mapSlot = el('div', 'lotbi-re-map');
  const detailPeriods = el('div', 'lotbi-re-deals lotbi-re-detail-periods');
  detailPeriods.setAttribute('role', 'group');
  detailPeriods.setAttribute('aria-label', '상세 기간');
  const detailPeriodButtons = REAL_ESTATE_DETAIL_MONTHS.map(months => {
    const periodButton = button(MONTH_LABEL(months), 'lotbi-re-deal');
    periodButton.dataset.reDetailMonths = String(months);
    periodButton.addEventListener('click', () => {
      if (disposed || state.detailMonths === months) return;
      state.detailMonths = months;
      void loadDetail();
    });
    detailPeriods.append(periodButton);
    return periodButton;
  });
  const salesSection = el('section', 'lotbi-re-deal-section');
  const salesTitle = el('h4', 'lotbi-re-deal-title', '매매');
  const salesList = el('ul', 'lotbi-re-deal-list');
  salesList.dataset.reSales = 'true';
  salesSection.append(salesTitle, salesList);
  const rentsSection = el('section', 'lotbi-re-deal-section');
  const rentsTitle = el('h4', 'lotbi-re-deal-title', '전월세');
  const rentsList = el('ul', 'lotbi-re-deal-list');
  rentsList.dataset.reRents = 'true';
  rentsSection.append(rentsTitle, rentsList);
  const detailStatus = el('p', 'lotbi-re-status');
  detailStatus.setAttribute('role', 'status');
  detailStatus.dataset.reDetailStatus = 'true';
  const detailRetry = button('다시 시도', 'consumer-action consumer-action-secondary lotbi-re-retry');
  detailRetry.hidden = true;
  const detailNotice = el('p', 'lotbi-re-notice');
  detail.append(detailBack, detailHead, detailAddress, detailMeta, mapSlot, detailPeriods, detailStatus, detailRetry,
    salesSection, rentsSection, detailNotice);

  surface.append(title, tabs, regionPanel, favoritesPanel, detail);
  root.replaceChildren(surface);

  const scrollHost = () => root.closest('.site-modal-content') || root.closest('.site-modal') || document.scrollingElement;

  // ---------------------------------------------------------- favorites --
  const isFavorite = apartmentId => state.favorites.has(apartmentId);
  const paintHeart = (heart, apartmentId, name) => {
    const on = isFavorite(apartmentId);
    heart.textContent = on ? '♥' : '♡';
    heart.setAttribute('aria-pressed', String(on));
    heart.setAttribute('aria-label', `${name} ${on ? '관심 아파트 해제' : '관심 아파트 등록'}`);
    heart.title = on ? '관심 아파트 해제' : '관심 아파트 등록';
    heart.dataset.reFavorite = on ? 'on' : 'off';
  };
  const paintAllHearts = () => {
    for (const heart of surface.querySelectorAll('[data-re-heart]')) {
      const id = heart.dataset.reApartment || state.apartment?.apartment_id || '';
      if (id) paintHeart(heart, id, heart.dataset.reName || state.apartment?.name || '');
    }
  };

  async function loadFavorites() {
    if (signedIn) {
      try {
        const data = await favoritesRequest(sessionToken, {}, fetchImpl);
        if (disposed) return;
        state.favorites = new Map((Array.isArray(data?.items) ? data.items : [])
          .filter(item => isApartmentId(item?.apartment_id))
          .map(item => [item.apartment_id, {
            apartment_id: item.apartment_id, name: String(item.name || ''), region_label: String(item.region_label || ''),
            address_label: String(item.address_label || ''), saved_at: String(item.saved_at || ''),
          }]));
        state.favoritesLoaded = true;
      } catch (error) {
        if (disposed) return;
        state.favoritesLoaded = false;
        favoritesStatus.textContent = error?.message || '관심 아파트를 불러오지 못했어요.';
      }
    } else {
      state.favorites = new Map(readGuestFavorites(storage).map(item => [item.apartment_id, item]));
      state.favoritesLoaded = true;
    }
    paintAllHearts();
    if (state.tab === 'favorites') renderFavorites();
  }

  async function toggleFavorite(entry, heart) {
    if (disposed || heart.disabled) return;
    const id = entry.apartment_id;
    const wasOn = isFavorite(id);
    heart.disabled = true;
    try {
      if (signedIn) {
        if (wasOn) await favoritesRequest(sessionToken, {method: 'DELETE', apartmentId: id}, fetchImpl);
        else {
          const saved = await favoritesRequest(sessionToken, {method: 'PUT', body: {apartment_id: id}}, fetchImpl);
          const item = saved?.favorite || {};
          state.favorites.set(id, {apartment_id: id, name: String(item.name || entry.name || ''),
            region_label: String(item.region_label || ''), address_label: String(item.address_label || entry.address_label || ''),
            saved_at: String(item.saved_at || '')});
        }
        if (wasOn) state.favorites.delete(id);
      } else {
        const local = readGuestFavorites(storage);
        if (wasOn) writeGuestFavorites(local.filter(item => item.apartment_id !== id), storage);
        else {
          if (local.length >= REAL_ESTATE_GUEST_FAVORITES_LIMIT) throw new Error(`이 기기에는 관심 아파트를 ${REAL_ESTATE_GUEST_FAVORITES_LIMIT}개까지 저장할 수 있어요.`);
          writeGuestFavorites([{apartment_id: id, name: entry.name, region_label: entry.region_label || '',
            address_label: entry.address_label || '', saved_at: new Date().toISOString()}, ...local], storage);
        }
        state.favorites = new Map(readGuestFavorites(storage).map(item => [item.apartment_id, item]));
      }
      const message = wasOn ? `${entry.name}을(를) 관심 아파트에서 뺐어요.` : `${entry.name}을(를) 관심 아파트에 저장했어요.`;
      (state.view === 'detail' ? detailStatus : state.tab === 'favorites' ? favoritesStatus : listStatus).textContent = message;
    } catch (error) {
      if (disposed) return;
      const message = error?.message || '관심 아파트를 바꾸지 못했어요. 잠시 후 다시 해 주세요.';
      (state.view === 'detail' ? detailStatus : state.tab === 'favorites' ? favoritesStatus : listStatus).textContent = message;
    } finally {
      heart.disabled = false;
    }
    paintAllHearts();
    if (state.tab === 'favorites' && state.view === 'list') renderFavorites();
  }

  function heartFor(entry) {
    const heart = el('button', 'lotbi-re-heart');
    heart.type = 'button';
    heart.dataset.reHeart = 'row';
    heart.dataset.reApartment = entry.apartment_id;
    heart.dataset.reName = entry.name;
    paintHeart(heart, entry.apartment_id, entry.name);
    heart.addEventListener('click', event => { event.stopPropagation(); void toggleFavorite(entry, heart); });
    return heart;
  }

  let summaryQueue = [];
  let summaryActive = 0;
  const pumpSummaries = () => {
    while (!disposed && summaryActive < SUMMARY_CONCURRENCY && summaryQueue.length) {
      const job = summaryQueue.shift();
      summaryActive += 1;
      getRealEstate('/apartment', {id: job.id, months: 6}, {fetchImpl})
        .then(data => { if (!disposed) job.paint(data); })
        .catch(() => { if (!disposed) job.paint(null); })
        .finally(() => { summaryActive -= 1; pumpSummaries(); });
    }
  };

  function renderFavorites() {
    favoritesList.replaceChildren();
    summaryQueue = [];
    favoritesNote.replaceChildren();
    if (signedIn) {
      favoritesNote.textContent = '로그인한 계정에 저장돼요. 다른 기기에서 로그인해도 같은 목록이 보여요.';
    } else {
      favoritesNote.append('이 기기에만 저장돼요. ');
      const login = el('a', 'lotbi-re-login', '로그인');
      login.href = '/auth/start/';
      favoritesNote.append(login, '하면 다른 기기에서도 볼 수 있어요.');
    }
    renderMigration();
    const items = [...state.favorites.values()];
    if (!items.length) {
      favoritesStatus.textContent = state.favoritesLoaded
        ? '아직 관심 아파트가 없어요. 지역별 찾기에서 ♡를 눌러 저장해 보세요.'
        : favoritesStatus.textContent;
      return;
    }
    favoritesStatus.textContent = '';
    for (const item of items) {
      const row = el('li', 'lotbi-re-row');
      row.dataset.reFavoriteRow = item.apartment_id;
      const open = el('button', 'lotbi-re-row-main');
      open.type = 'button';
      open.dataset.reOpen = item.apartment_id;
      const copy = el('span', 'lotbi-re-row-copy');
      copy.append(el('span', 'lotbi-re-row-name', item.name));
      copy.append(el('span', 'lotbi-re-row-address', item.address_label || item.region_label));
      const sale = el('span', 'lotbi-re-row-deal', '최근 거래를 확인하고 있어요.');
      const rent = el('span', 'lotbi-re-row-deal');
      copy.append(sale, rent);
      open.append(copy);
      open.addEventListener('click', () => showDetail({...item, from: 'favorites'}));
      const remove = button('저장 해제', 'lotbi-re-remove');
      remove.dataset.reRemove = item.apartment_id;
      remove.addEventListener('click', () => void toggleFavorite(item, remove));
      row.append(open, remove);
      favoritesList.append(row);
      summaryQueue.push({id: item.apartment_id, paint: data => {
        if (!data || data.status === 'UNAVAILABLE') { sale.textContent = '최근 거래를 지금 불러오지 못했어요.'; rent.textContent = ''; return; }
        sale.textContent = data.latest_sale ? `최근 ${formatDealLine(data.latest_sale)}` : '최근 6개월 매매 신고 없음';
        rent.textContent = data.latest_rent ? `최근 ${formatDealLine(data.latest_rent)}` : '최근 6개월 전월세 신고 없음';
      }});
    }
    pumpSummaries();
  }

  // Saved on this device before signing in: offered, never merged by itself.
  function renderMigration() {
    migrate.replaceChildren();
    const local = signedIn ? readGuestFavorites(storage) : [];
    migrate.hidden = !local.length;
    if (!local.length) return;
    migrate.append(el('p', '', `로그인 전에 이 기기에 저장한 관심 아파트가 ${local.length}개 있어요. 계정 목록에는 아직 들어가지 않았어요.`));
    const add = button('계정 목록에 추가', 'consumer-action lotbi-re-migrate-add');
    add.dataset.reMigrate = 'add';
    const clear = button('이 기기 목록 지우기', 'consumer-action consumer-action-secondary');
    clear.dataset.reMigrate = 'clear';
    add.addEventListener('click', async () => {
      add.disabled = true; clear.disabled = true;
      const left = [];
      for (const item of readGuestFavorites(storage)) {
        try {
          await favoritesRequest(sessionToken, {method: 'PUT', body: {apartment_id: item.apartment_id}}, fetchImpl);
        } catch {
          left.push(item);
        }
      }
      if (disposed) return;
      writeGuestFavorites(left, storage);
      favoritesStatus.textContent = left.length
        ? `${left.length}개는 공식 자료에서 다시 확인하지 못해 이 기기에 남겨 두었어요.`
        : '계정 목록에 추가했어요.';
      await loadFavorites();
    });
    clear.addEventListener('click', () => {
      writeGuestFavorites([], storage);
      favoritesStatus.textContent = '이 기기에 저장한 목록을 지웠어요.';
      renderMigration();
    });
    const actions = el('div', 'lotbi-re-migrate-actions');
    actions.append(add, clear);
    migrate.append(actions);
  }

  // --------------------------------------------------------------- tabs --
  function selectTab(id) {
    if (disposed) return;
    state.tab = id;
    for (const tab of tabButtons) {
      const on = tab.dataset.reTab === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    regionPanel.hidden = id !== 'region';
    favoritesPanel.hidden = id !== 'favorites';
    if (id === 'favorites') renderFavorites();
  }

  // ------------------------------------------------------------- region --
  const regionCache = new Map();
  async function regionItems(params) {
    const key = JSON.stringify(params);
    if (!regionCache.has(key)) regionCache.set(key, getRealEstate('/regions', params, {fetchImpl}).then(data => data?.items || []));
    try {
      return await regionCache.get(key);
    } catch (error) {
      regionCache.delete(key);
      throw error;
    }
  }
  const fillSelect = (select, placeholder, items, valueOf, labelOf) => {
    select.replaceChildren(option('', placeholder), ...items.map(item => option(valueOf(item), labelOf(item))));
  };
  const selectedText = select => (select.value ? select.selectedOptions[0]?.textContent || '' : '');
  const regionLabel = () => [selectedText(sidoSelect), selectedText(sigunguSelect), state.dong ? selectedText(dongSelect) : '']
    .filter(Boolean).join(' ');

  async function setSido(code) {
    state.sido = code; state.sigungu = ''; state.dong = '';
    sidoSelect.value = code;
    fillSelect(sigunguSelect, '시·군·구 선택', [], () => '', () => '');
    fillSelect(dongSelect, '전체 읍·면·동', [], () => '', () => '');
    sigunguSelect.disabled = !code; dongSelect.disabled = true;
    if (!code) return;
    const items = await regionItems({sido: code});
    if (disposed || state.sido !== code) return;
    fillSelect(sigunguSelect, '시·군·구 선택', items, item => item.code, item => item.name);
    sigunguSelect.disabled = false;
  }
  async function setSigungu(code) {
    state.sigungu = code; state.dong = '';
    sigunguSelect.value = code;
    fillSelect(dongSelect, '전체 읍·면·동', [], () => '', () => '');
    dongSelect.disabled = !code;
    if (!code) return;
    const items = await regionItems({sigungu: code});
    if (disposed || state.sigungu !== code) return;
    fillSelect(dongSelect, '전체 읍·면·동', items, item => item.code, item => item.name);
    dongSelect.disabled = false;
  }
  function setDong(code) {
    state.dong = code;
    dongSelect.value = code;
  }
  const remember = () => {
    if (state.mode === 'MANUAL') writeRegionPreference(owner, {mode: 'MANUAL', sido: state.sido, sigungu: state.sigungu, dong: state.dong}, storage);
  };
  function paintRegionStatus(message = '') {
    regionStatus.dataset.reRegionMode = state.mode;
    const label = regionLabel();
    const prefix = state.mode === 'AUTO' ? '현재 위치로 자동 선택' : state.mode === 'MANUAL' ? '직접 선택한 지역' : '';
    regionStatus.textContent = [prefix && label ? `${prefix} · ${label}` : '', message].filter(Boolean).join(' — ');
    locateButton.textContent = state.mode === 'AUTO' ? '현재 위치로 다시 확인' : state.mode === 'MANUAL' ? '현재 위치로 다시 설정' : '현재 위치로 설정';
  }
  async function manualChange(level, value) {
    if (disposed) return;
    state.mode = 'MANUAL';
    try {
      if (level === 'sido') await setSido(value);
      else if (level === 'sigungu') await setSigungu(value);
      else setDong(value);
    } catch (error) {
      paintRegionStatus(error?.message || '지역 목록을 불러오지 못했어요.');
      return;
    }
    if (disposed) return;
    remember();
    paintRegionStatus(state.sigungu ? '' : state.sido ? '시·군·구를 골라 주세요.' : '광역시·도를 골라 주세요.');
    void loadList();
  }
  sidoSelect.addEventListener('change', () => manualChange('sido', sidoSelect.value));
  sigunguSelect.addEventListener('change', () => manualChange('sigungu', sigunguSelect.value));
  dongSelect.addEventListener('change', () => manualChange('dong', dongSelect.value));

  async function applyRegion({sido = '', sigungu = '', dong = ''}) {
    await setSido(sido);
    if (sigungu && state.sido === sido) await setSigungu(sigungu);
    if (dong && state.sigungu === sigungu && [...dongSelect.options].some(item => item.value === dong)) setDong(dong);
  }

  regionSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = regionSearchInput.value.trim();
    if (!query) { regionResults.replaceChildren(); return; }
    searchTimer = setTimeout(async () => {
      try {
        const data = await getRealEstate('/regions/search', {q: query, limit: 8}, {fetchImpl});
        if (disposed || regionSearchInput.value.trim() !== query) return;
        regionResults.replaceChildren();
        const hits = Array.isArray(data?.items) ? data.items : [];
        if (!hits.length) { regionResults.append(el('li', 'lotbi-re-region-empty', '찾는 지역이 없어요.')); return; }
        for (const hit of hits) {
          const item = el('li');
          const pick = button(hit.label, 'lotbi-re-region-hit');
          pick.dataset.reRegionHit = hit.dong?.code || hit.sigungu?.code || '';
          pick.addEventListener('click', async () => {
            state.mode = 'MANUAL';
            regionResults.replaceChildren();
            regionSearchInput.value = '';
            try {
              await applyRegion({sido: hit.sido?.code || '', sigungu: hit.sigungu?.code || '', dong: hit.dong?.code || ''});
            } catch (error) {
              paintRegionStatus(error?.message || '지역 목록을 불러오지 못했어요.');
              return;
            }
            if (disposed) return;
            remember();
            paintRegionStatus();
            void loadList();
          });
          item.append(pick);
          regionResults.append(item);
        }
      } catch {
        if (!disposed) regionResults.replaceChildren(el('li', 'lotbi-re-region-empty', '지역을 찾지 못했어요. 잠시 후 다시 해 주세요.'));
      }
    }, 300);
  });

  // ----------------------------------------------------------- location --
  async function locate(allowPrompt) {
    try {
      const outcome = await resolveSharedBrowserCurrentLocation({allowPrompt});
      state.permission = outcome?.permission || state.permission;
      const location = outcome?.location;
      const url = locateUrl(Number(location?.latitude), Number(location?.longitude));
      if (!url) return null;
      return await getRealEstate(url, {}, {fetchImpl});
    } catch {
      return null;
    }
  }
  async function useLocation(allowPrompt) {
    locateButton.disabled = true;
    paintRegionStatus('현재 위치의 지역을 확인하고 있어요.');
    const found = await locate(allowPrompt);
    if (disposed) return false;
    locateButton.disabled = false;
    paintLocationControls();
    if (!found || found.level === 'NONE' || !found.sido) {
      paintRegionStatus(state.permission === LOCATION_PERMISSION.DENIED
        ? '위치 권한이 없어 지역을 직접 골라 주세요.'
        : '현재 위치의 지역을 확인하지 못했어요. 지역을 직접 골라 주세요.');
      return false;
    }
    state.mode = 'AUTO';
    writeRegionPreference(owner, {mode: 'AUTO'}, storage);
    try {
      await applyRegion({sido: found.sido.code, sigungu: found.sigungu?.code || '', dong: found.dong?.code || ''});
    } catch (error) {
      paintRegionStatus(error?.message || '지역 목록을 불러오지 못했어요.');
      return false;
    }
    if (disposed) return false;
    const partial = found.level === 'SIDO'
      ? `${found.confidence === 'APPROXIMATE' ? '대략적인 위치로 ' : ''}광역시·도까지만 확인했어요. 시·군·구를 골라 주세요.`
      : found.level === 'SIGUNGU' ? '읍·면·동은 확인하지 못해 전체로 보여 드려요.' : '';
    paintRegionStatus(partial);
    void loadList();
    return true;
  }
  function paintLocationControls() {
    const usage = isLocationUsageEnabled();
    settingsLink.hidden = usage;
    locateButton.hidden = !usage || state.permission === LOCATION_PERMISSION.UNAVAILABLE;
  }
  locateButton.addEventListener('click', () => { if (!disposed && !locateButton.disabled) void useLocation(true); });

  // --------------------------------------------------------------- list --
  function paintFilters() {
    for (const dealButton of dealButtons) dealButton.setAttribute('aria-pressed', String(dealButton.dataset.reDeal === state.deal));
    periodSelect.value = String(state.months);
  }
  const setListStatus = (message, {canRetry = false} = {}) => {
    listStatus.textContent = message;
    retry.hidden = !canRetry;
  };
  function renderRows(items, {append = false} = {}) {
    if (!append) list.replaceChildren();
    for (const item of items) {
      const entry = {apartment_id: item.apartmentId, name: item.name, address_label: item.addressLabel, region_label: item.addressLabel};
      const row = el('li', 'lotbi-re-row');
      row.dataset.reApartmentRow = item.apartmentId;
      const open = el('button', 'lotbi-re-row-main');
      open.type = 'button';
      open.dataset.reOpen = item.apartmentId;
      const copy = el('span', 'lotbi-re-row-copy');
      copy.append(el('span', 'lotbi-re-row-name', item.name));
      copy.append(el('span', 'lotbi-re-row-address', item.addressLabel));
      const extra = [item.dealsInPeriod ? `거래 ${item.dealsInPeriod}건` : '', item.cancelledInPeriod ? `해제 ${item.cancelledInPeriod}건` : '']
        .filter(Boolean).join(' · ');
      copy.append(el('span', 'lotbi-re-row-deal', [formatDealLine(item.latest), extra].filter(Boolean).join(' · ')));
      open.append(copy);
      open.addEventListener('click', () => showDetail({...entry, from: 'list'}));
      row.append(open, heartFor(entry));
      list.append(row);
    }
  }
  async function loadList({append = false} = {}) {
    if (disposed) return;
    const current = ++listRequest;
    listController?.abort();
    listController = new AbortController();
    if (!append) { list.replaceChildren(); more.hidden = true; }
    if (!state.sigungu) {
      basis.textContent = '';
      notice.textContent = '';
      surface.dataset.reListState = 'PICK';
      setListStatus(state.sido ? '시·군·구를 고르면 아파트 실거래가를 보여 드려요.' : '광역시·도부터 골라 주세요.');
      return;
    }
    surface.dataset.reListState = 'LOADING';
    surface.setAttribute('aria-busy', 'true');
    setListStatus(append ? '더 불러오고 있어요.' : '국토교통부 실거래가를 불러오고 있어요.');
    let data;
    try {
      data = await getRealEstate('/apartments', {
        sigungu: state.sigungu, dong: state.dong, deal: state.deal, months: state.months, q: state.query,
        offset: append ? state.nextOffset || 0 : 0, limit: LIST_LIMIT,
      }, {fetchImpl, signal: listController.signal});
    } catch (error) {
      if (disposed || current !== listRequest || error?.code === 'ABORTED') return;
      surface.removeAttribute('aria-busy');
      surface.dataset.reListState = 'ERROR';
      setListStatus(error?.message || '실거래가를 불러오지 못했어요.', {canRetry: true});
      return;
    }
    if (disposed || current !== listRequest) return;
    surface.removeAttribute('aria-busy');
    const label = data?.region?.label || regionLabel();
    basis.textContent = `${label} · ${DEAL_LABEL[state.deal]} · ${MONTH_LABEL(state.months)} · 계약일 최신순`;
    notice.textContent = [data?.notice, data?.registry_notice].filter(Boolean).join(' ');
    if (data?.status === 'UNAVAILABLE') {
      surface.dataset.reListState = 'UNAVAILABLE';
      list.replaceChildren();
      setListStatus('국토교통부 실거래가 자료를 지금 불러오지 못했어요. 잠시 후 다시 해 주세요.', {canRetry: true});
      return;
    }
    const items = (Array.isArray(data?.items) ? data.items : []).map(normalizeApartmentItem).filter(Boolean);
    state.total = Number(data?.total) || 0;
    state.nextOffset = Number.isInteger(data?.next_offset) ? data.next_offset : null;
    renderRows(items, {append});
    more.hidden = !data?.has_more;
    const partial = data?.status === 'PARTIAL'
      ? (data?.coverage?.months_stale ? ' 일부 달은 마지막으로 확인한 자료예요.' : ' 일부 달 자료를 불러오지 못했어요.')
      : '';
    if (!list.children.length) {
      surface.dataset.reListState = 'EMPTY';
      setListStatus(data?.empty_reason === 'NAME_NOT_MATCHED'
        ? `이 기간 거래 목록에서 '${state.query}'을(를) 찾지 못했어요. 이름을 줄여 쓰거나 기간을 늘려 보세요.`
        : `${MONTH_LABEL(state.months)} 동안 신고된 ${DEAL_LABEL[state.deal]} 거래가 없어요. 기간을 늘려 보세요. 거래가 없다고 아파트가 없다는 뜻은 아니에요.`);
      return;
    }
    surface.dataset.reListState = 'READY';
    setListStatus(`${state.total}개 단지${partial}`);
  }
  periodSelect.addEventListener('change', () => {
    const months = Number(periodSelect.value);
    if (disposed || !REAL_ESTATE_LIST_MONTHS.includes(months) || months === state.months) return;
    state.months = months;
    void loadList();
  });
  nameForm.addEventListener('submit', event => {
    event.preventDefault();
    if (disposed) return;
    state.query = nameInput.value.trim().slice(0, 40);
    void loadList();
  });
  more.addEventListener('click', () => { if (!disposed && state.nextOffset !== null) void loadList({append: true}); });
  retry.addEventListener('click', () => { if (!disposed) void loadList(); });

  // ------------------------------------------------------------- detail --
  function renderDealList(target, deals, kind) {
    target.replaceChildren();
    if (!deals.length) {
      target.append(el('li', 'lotbi-re-deal-empty', `이 기간에 신고된 ${kind} 거래가 없어요.`));
      return;
    }
    for (const deal of deals) {
      const row = el('li', 'lotbi-re-deal-row');
      const price = el('span', 'lotbi-re-deal-price', deal.type === 'SALE' ? formatManwon(deal.amount_manwon)
        : deal.type === 'MONTHLY' ? `월세 ${formatManwon(deal.deposit_manwon)} / ${formatManwon(deal.monthly_rent_manwon)}`
          : `전세 ${formatManwon(deal.deposit_manwon)}`);
      const meta = [formatDealDate(deal.date), formatArea(deal.area_m2), formatFloor(deal.floor)];
      if (deal.type !== 'SALE') {
        if (deal.contract_type) meta.push(deal.contract_type);
        if (deal.renewal_right_used) meta.push('갱신요구권 사용');
      }
      row.append(price, el('span', 'lotbi-re-deal-meta', meta.filter(Boolean).join(' · ')));
      if (deal.cancelled) {
        row.dataset.reCancelled = 'true';
        row.append(el('span', 'lotbi-re-badge', deal.cancel_date ? `해제 ${formatDealDate(deal.cancel_date)}` : '해제'));
      }
      target.append(row);
    }
  }
  function paintMap(apartment) {
    mapSlot.replaceChildren();
    if (!apartment?.name || !apartment?.address_label) return;
    let provider = 'NAVER_MAP';
    try { provider = readDefaultMapProvider(document.cookie || ''); } catch {}
    const presentation = defaultMapProviderPresentation(provider, {userAgent});
    let href = '';
    try {
      href = buildDefaultMapHref(provider, {name: apartment.name, address: apartment.address_label, navigationCapable: false}, {userAgent});
    } catch {
      href = '';
    }
    if (!href) return;
    const link = el('a', 'lotbi-re-map-link');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.reMap = provider;
    const image = el('img', 'lotbi-re-map-icon');
    image.alt = '';
    image.width = 24;
    image.height = 24;
    image.decoding = 'async';
    image.src = `${MAP_ICON_BASE}${presentation.icon}.png?v=${MAP_ICON_VERSION}`;
    link.append(image, el('span', '', `${presentation.label}에서 찾아보기`));
    mapSlot.append(link, el('p', 'lotbi-re-map-note', '지도는 단지 이름과 주소로 검색해 열어요.'));
  }
  async function loadDetail() {
    const apartment = state.apartment;
    if (disposed || !apartment) return;
    const current = ++detailRequest;
    detailController?.abort();
    detailController = new AbortController();
    for (const periodButton of detailPeriodButtons) {
      periodButton.setAttribute('aria-pressed', String(Number(periodButton.dataset.reDetailMonths) === state.detailMonths));
    }
    detail.dataset.reDetailState = 'LOADING';
    detail.setAttribute('aria-busy', 'true');
    detailStatus.textContent = '계약 내역을 불러오고 있어요.';
    detailRetry.hidden = true;
    salesList.replaceChildren();
    rentsList.replaceChildren();
    let data;
    try {
      data = await getRealEstate('/apartment', {id: apartment.apartment_id, months: state.detailMonths},
        {fetchImpl, signal: detailController.signal});
    } catch (error) {
      if (disposed || current !== detailRequest || error?.code === 'ABORTED') return;
      detail.removeAttribute('aria-busy');
      detail.dataset.reDetailState = 'ERROR';
      detailStatus.textContent = error?.message || '계약 내역을 불러오지 못했어요.';
      detailRetry.hidden = false;
      return;
    }
    if (disposed || current !== detailRequest) return;
    detail.removeAttribute('aria-busy');
    detailNotice.textContent = data?.notice || '';
    if (data?.status === 'UNAVAILABLE') {
      detail.dataset.reDetailState = 'UNAVAILABLE';
      detailStatus.textContent = '국토교통부 실거래가 자료를 지금 불러오지 못했어요. 잠시 후 다시 해 주세요.';
      detailRetry.hidden = false;
      return;
    }
    const official = data?.apartment;
    if (official) {
      apartment.name = official.name || apartment.name;
      apartment.address_label = official.address_label || apartment.address_label;
      detailTitle.textContent = apartment.name;
      detailAddress.textContent = apartment.address_label;
      detailMeta.textContent = official.built_year ? `${official.built_year}년 건축` : '';
      paintMap(apartment);
      writeOpenApartment(apartment, sessionStore);
    }
    const sales = Array.isArray(data?.sales) ? data.sales : [];
    const rents = Array.isArray(data?.rents) ? data.rents : [];
    renderDealList(salesList, sales, '매매');
    renderDealList(rentsList, rents, '전월세');
    detail.dataset.reDetailState = data?.found ? 'READY' : 'EMPTY';
    detailStatus.textContent = data?.found
      ? `${MONTH_LABEL(state.detailMonths)} 매매 ${sales.length}건 · 전월세 ${rents.length}건${data?.status === 'PARTIAL' ? ' · 일부 달 자료는 불러오지 못했어요' : ''}`
      : `${MONTH_LABEL(state.detailMonths)} 동안 신고된 거래가 없어요. 기간을 늘려 보세요.`;
  }
  detailRetry.addEventListener('click', () => { if (!disposed) void loadDetail(); });
  detailHeart.addEventListener('click', () => {
    if (state.apartment) void toggleFavorite({...state.apartment, region_label: state.apartment.address_label}, detailHeart);
  });
  detailBack.addEventListener('click', () => {
    if (disposed) return;
    if (typeof requestBack === 'function') requestBack();
    else showList();
  });

  // ---------------------------------------------------------- view switch --
  function showDetail(apartment) {
    if (disposed || !apartment || !isApartmentId(apartment.apartment_id)) return;
    if (state.view === 'list') savedScroll = scrollHost()?.scrollTop || 0;
    state.apartment = {apartment_id: apartment.apartment_id, name: apartment.name || '', address_label: apartment.address_label || '',
      from: apartment.from === 'favorites' ? 'favorites' : 'list'};
    state.view = 'detail';
    surface.dataset.reView = 'detail';
    writeOpenApartment(state.apartment, sessionStore);
    tabs.hidden = true; regionPanel.hidden = true; favoritesPanel.hidden = true; title.hidden = true;
    detail.hidden = false;
    detailBack.textContent = state.apartment.from === 'favorites' ? '← 관심 아파트로' : '← 목록으로';
    detailTitle.textContent = state.apartment.name || '아파트 실거래가';
    detailAddress.textContent = state.apartment.address_label;
    detailMeta.textContent = '';
    detailHeart.dataset.reName = state.apartment.name;
    paintHeart(detailHeart, state.apartment.apartment_id, state.apartment.name);
    paintMap(state.apartment);
    const host = scrollHost();
    if (host) host.scrollTop = 0;
    onView?.('detail');
    detailTitle.focus();
    void loadDetail();
  }
  function showList() {
    if (disposed) return;
    const from = state.apartment?.from || state.tab;
    state.view = 'list';
    surface.dataset.reView = 'list';
    detailController?.abort();
    detailRequest += 1;
    writeOpenApartment(null, sessionStore);
    detail.hidden = true; tabs.hidden = false; title.hidden = false;
    selectTab(from === 'favorites' ? 'favorites' : 'region');
    paintAllHearts();
    onView?.('list');
    const host = scrollHost();
    if (host) requestAnimationFrame(() => { host.scrollTop = savedScroll; });
    const target = state.apartment ? surface.querySelector(`[data-re-open="${state.apartment.apartment_id}"]`) : null;
    (target || title).focus({preventScroll: true});
  }

  // -------------------------------------------------------------- start --
  paintFilters();
  selectTab('region');
  fillSelect(sigunguSelect, '시·군·구 선택', [], () => '', () => '');
  fillSelect(dongSelect, '전체 읍·면·동', [], () => '', () => '');
  sigunguSelect.disabled = true;
  dongSelect.disabled = true;
  void loadFavorites();
  (async () => {
    try {
      const sidos = await regionItems({});
      if (disposed) return;
      fillSelect(sidoSelect, '광역시·도 선택', sidos, item => item.code, item => item.name);
    } catch (error) {
      if (!disposed) setListStatus(error?.message || '지역 목록을 불러오지 못했어요.', {canRetry: false});
      return;
    }
    const preference = readRegionPreference(owner, storage);
    let permission = LOCATION_PERMISSION.DENIED;
    if (isLocationUsageEnabled()) {
      try { permission = await getBrowserLocationPermissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
    }
    if (disposed) return;
    state.permission = permission;
    paintLocationControls();
    if (preference?.mode === 'MANUAL') {
      // A region the reader picked stays picked: the location never replaces it.
      state.mode = 'MANUAL';
      try { await applyRegion(preference); } catch {}
      if (disposed) return;
      paintRegionStatus();
      void loadList();
      return;
    }
    if (permission === LOCATION_PERMISSION.GRANTED && await useLocation(false)) return;
    if (disposed) return;
    paintRegionStatus(!isLocationUsageEnabled()
      ? 'LOTBI 설정에서 위치 사용이 꺼져 있어요. 지역을 직접 골라 주세요.'
      : permission === LOCATION_PERMISSION.DENIED
        ? '위치 권한이 없어 지역을 직접 골라 주세요.'
        : permission === LOCATION_PERMISSION.UNAVAILABLE
          ? '이 브라우저에서는 현재 위치를 쓸 수 없어요. 지역을 직접 골라 주세요.'
          : '[현재 위치로 설정]을 누르거나 지역을 직접 골라 주세요.');
    void loadList();
  })();

  const reopen = readOpenApartment(sessionStore);
  return {
    get view() { return state.view; },
    hasApartment: () => Boolean(state.apartment || reopen),
    showList,
    showDetail: apartment => showDetail(apartment || state.apartment || reopen),
    focus: () => title.focus(),
    dispose() {
      disposed = true;
      listRequest += 1; detailRequest += 1;
      listController?.abort(); detailController?.abort();
      clearTimeout(searchTimer);
      summaryQueue = [];
    },
  };
}
