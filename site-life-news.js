// REGIONAL-NEWS-SCREEN-LIST-01 — 지역정보 → 지역뉴스 lists news titles itself.
// Reads only Core's public, guest-safe GET /v2/life/news (no credentials,
// nothing stored). Core reads every region at 광역시·도 level
// (REGIONAL-NEWS-PROVINCE-ONLY-01) and keeps only related, de-duplicated
// articles, so the list shows what Core found — three articles stay three.
//
// Region: the current location when location use is on and the browser already
// allows it, else the saved region, else the reader picks one of 17 시·도.
// REGIONAL-NEWS-CITY-SELECT-01 (QA #13): two ways to choose, [현재 위치] and
// the 시·도 button — [현재 위치] is also what asks the browser for permission,
// so there is no separate 위치 허용 button and no 지역 변경 icon. The 시·도 button
// says what is read ("전북 · 전주시 ▾") and opens one chip per 시·도 (one tap,
// no dropdown); once picked the chips fold away and a single row of 시·군·구
// chips (전체 first, the list Core sends) narrows the news to that place:
// 지역뉴스 → 시·도 → 시·군·구 is three taps and the first article stays near the top. A title opens the article itself; a failed read says so
// and offers 다시 시도 — nothing old or made up is shown in its place.
//
// REGIONAL-NEWS-CATEGORIES-01: Core's view=feed adds 분야 tabs (a 분야 with no
// story is hidden), 오늘 in pages of 20 with 더보기 (Core's order: under 전체
// sports and photo items come last) and 1주일 as one heading per day with up
// to ten representative stories.
import {CORE_ORIGIN} from './site-core.js?v=aset-d129cb890eb0';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-d129cb890eb0';
import {isLocationUsageEnabled} from './site-location-preference.js?v=aset-d129cb890eb0';
import {savedLifeRegionLabel} from './site-life-location.js?v=aset-d129cb890eb0';

export const NEWS_PROVINCES = Object.freeze([
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]);
export const NEWS_PERIODS = Object.freeze([
  Object.freeze({id: 'today', label: '오늘'}),
  Object.freeze({id: 'week', label: '1주일'}),
]);
export const NEWS_LIST_LIMIT = 20;
const PROVINCE_SHORT = Object.freeze({
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주',
  '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '강원특별자치도': '강원',
  '충청북도': '충북', '충청남도': '충남', '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북',
  '경상남도': '경남', '제주특별자치도': '제주',
});
const TIMEOUT_MS = 12_000;
const KST = 'Asia/Seoul';
const SVG_NS = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');
const ICONS = Object.freeze({
  news: ['M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5Z', 'M17 9h3v10a2 2 0 0 1-2 2', 'M7 9h7M7 12h7M7 15h4'],
  open: ['M14 4h6v6', 'M20 4 11 13', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
});

const inKorea = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= 31 && latitude <= 44.5 && longitude >= 122 && longitude <= 132.5;
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
export const provinceShort = name => PROVINCE_SHORT[name] || text(name);

export function newsListUrl({latitude, longitude, region = '', city = '', period = 'today', category = 'all', offset = 0, limit = NEWS_LIST_LIMIT} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (inKorea(Number(latitude), Number(longitude))) {
    params.set('latitude', String(Math.round(Number(latitude) * 1000) / 1000));
    params.set('longitude', String(Math.round(Number(longitude) * 1000) / 1000));
  } else if (text(region)) {
    params.set('region', text(region).slice(0, 40));
    if (text(city)) params.set('city', text(city).slice(0, 12));
  }
  params.set('period', NEWS_PERIODS.some(item => item.id === period) ? period : 'today');
  params.set('limit', String(limit));
  params.set('view', 'feed');
  if (category && category !== 'all') params.set('category', String(category).slice(0, 24));
  if (Number(offset) > 0) params.set('offset', String(Math.floor(Number(offset))));
  return `${origin}/v2/life/news?${params}`;
}

// Only a real web address opens; anything else leaves the title unlinked.
export function safeArticleHref(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

// "오전 9:12" today, "10월 9일 오후 3:05" before (KST, as Core dates it).
export function formatNewsTime(value, now = new Date()) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('ko-KR', {timeZone: KST, year: 'numeric', month: 'numeric', day: 'numeric'});
  const time = new Intl.DateTimeFormat('ko-KR', {timeZone: KST, hour: 'numeric', minute: '2-digit'}).format(date);
  if (day.format(date) === day.format(now)) return time;
  const monthDay = new Intl.DateTimeFormat('ko-KR', {timeZone: KST, month: 'long', day: 'numeric'}).format(date);
  return `${monthDay} ${time}`;
}

// Core's feed order as it came (오늘 under 전체 puts sports / photo last; the
// days are already newest first); never adds anything Core did not return.
export function feedListItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({title: text(item?.title), source: text(item?.source_label), href: safeArticleHref(item?.url), at: item?.published_at || ''}))
    .filter(item => item.title && item.href);
}

// The 분야 tabs to show: 전체 always, a 분야 only when it has a story (or is
// the one picked, so the reader is never stranded).
export function visibleCategories(categories, picked = 'all') {
  return (Array.isArray(categories) ? categories : [])
    .filter(entry => entry && entry.id && (entry.id === 'all' || entry.id === picked || Number(entry.count) > 0));
}

// Newest first; the list never adds anything Core did not return.
export function newsListItems(newsResult) {
  const items = Array.isArray(newsResult?.items) ? newsResult.items : [];
  return items
    .map(item => ({title: text(item?.title), source: text(item?.source_label), href: safeArticleHref(item?.url), at: item?.published_at || ''}))
    .filter(item => item.title && item.href)
    .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
}

async function getJson(url, {fetchImpl = globalThis.fetch, signal} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), {once: true});
  try {
    const response = await fetchImpl(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok) return {ok: false, status: response.status, data: null};
    return {ok: true, status: response.status, data: await response.json()};
  } catch {
    return {ok: false, status: 0, data: null};
  } finally {
    clearTimeout(timer);
  }
}

function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function glyph(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `lotbi-news-glyph lotbi-news-glyph-${name}`);
  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function mountRegionalNews({root, fetchImpl = globalThis.fetch, now = () => new Date()} = {}) {
  let disposed = false;
  let request = 0;
  let controller;
  const saved = savedLifeRegionLabel();
  const state = {source: '', mode: '', region: '', city: '', province: '', cities: [], coords: null, period: 'today',
    label: '', category: 'all', offset: 0, categories: [], panelOpen: false};

  const surface = el('section', 'lotbi-news');
  surface.dataset.newsState = 'LOADING';
  const head = el('div', 'lotbi-news-head');
  const title = el('h3', 'lotbi-news-title', '지역뉴스');
  title.tabIndex = -1;
  head.append(glyph('news'), title);
  const basis = el('p', 'lotbi-news-basis');

  const modes = el('div', 'lotbi-news-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', '지역 기준');
  const modeCurrent = el('button', 'lotbi-news-mode', '현재 위치');
  modeCurrent.type = 'button';
  modeCurrent.dataset.newsMode = 'current';
  modeCurrent.hidden = true;
  const modePick = el('button', 'lotbi-news-mode', '시·도 선택 ▾');
  modePick.type = 'button';
  modePick.dataset.newsMode = 'pick';
  modePick.setAttribute('aria-expanded', 'false');
  modes.append(modeCurrent, modePick);

  const picker = el('div', 'lotbi-news-picker');
  picker.hidden = true;
  const chip = (key, value, content, full) => {
    const button = el('button', 'lotbi-news-chip', content);
    button.type = 'button';
    button.dataset[key] = value;
    if (full) button.setAttribute('aria-label', full);
    return button;
  };
  const provinceChips = el('div', 'lotbi-news-chips');
  provinceChips.setAttribute('role', 'group');
  provinceChips.setAttribute('aria-label', '시·도');
  const provinceButtons = [];
  if (saved) provinceButtons.push(chip('newsProvince', 'saved', `저장 지역 (${saved})`));
  for (const province of NEWS_PROVINCES) provinceButtons.push(chip('newsProvince', province, provinceShort(province), province));
  provinceChips.append(...provinceButtons);
  picker.append(provinceChips);
  const cityRow = el('div', 'lotbi-news-cities');
  cityRow.setAttribute('role', 'group');
  cityRow.setAttribute('aria-label', '시·군·구');
  cityRow.hidden = true;

  const periods = el('div', 'lotbi-news-periods');
  periods.setAttribute('role', 'group');
  periods.setAttribute('aria-label', '기간');
  const periodButtons = NEWS_PERIODS.map(period => {
    const button = el('button', 'lotbi-news-period', period.label);
    button.type = 'button';
    button.dataset.newsPeriod = period.id;
    button.addEventListener('click', () => {
      if (disposed || state.period === period.id) return;
      state.period = period.id;
      void load();
    });
    periods.append(button);
    return button;
  });
  const tabs = el('div', 'lotbi-news-categories');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', '분야');
  tabs.hidden = true;
  const list = el('ul', 'lotbi-news-list');
  list.setAttribute('aria-label', '지역뉴스 목록');
  const days = el('div', 'lotbi-news-days');
  const more = el('button', 'consumer-action consumer-action-secondary lotbi-news-more', '더보기');
  more.type = 'button';
  more.dataset.newsMore = 'true';
  more.hidden = true;
  more.addEventListener('click', () => { if (!disposed) void load({more: true}); });
  const status = el('p', 'lotbi-news-status');
  status.setAttribute('role', 'status');
  const retry = el('button', 'consumer-action consumer-action-secondary lotbi-news-retry', '다시 시도');
  retry.type = 'button';
  retry.hidden = true;
  retry.addEventListener('click', () => { if (!disposed) void load(); });
  surface.append(head, basis, modes, picker, cityRow, periods, tabs, list, days, more, status, retry);
  root.replaceChildren(surface);

  const sourceText = () => (state.city ? '선택한 지역' : state.source === 'current' ? '현재 위치 기준' : state.source === 'saved' ? '저장 지역 기준' : '선택한 지역');
  const periodText = () => (NEWS_PERIODS.find(item => item.id === state.period) || NEWS_PERIODS[0]).label;
  const paint = () => {
    title.textContent = state.label ? `${state.label} 지역뉴스` : '지역뉴스';
    basis.textContent = state.source ? `${sourceText()} · ${periodText()} · ${state.period === 'week' ? '날짜별 대표 기사' : '최신순'}` : '';
    for (const button of periodButtons) button.setAttribute('aria-pressed', String(button.dataset.newsPeriod === state.period));
    periods.hidden = !state.source;
    paintRegion();
  };
  const pickSummary = () => (state.mode === 'pick' && state.province
    ? `${provinceShort(state.province)}${state.city ? ` · ${state.city}` : ''} ▾`
    : '시·도 선택 ▾');
  const paintRegion = () => {
    // Nothing to show yet and no [현재 위치]: the open chips are the whole choice.
    modes.hidden = modeCurrent.hidden && !state.source;
    modeCurrent.setAttribute('aria-pressed', String(state.mode === 'current'));
    modePick.setAttribute('aria-pressed', String(state.mode === 'pick'));
    modePick.setAttribute('aria-expanded', String(state.panelOpen));
    modePick.textContent = pickSummary();
    picker.hidden = !state.panelOpen;
    const picked = state.source === 'saved' ? 'saved' : state.mode === 'pick' ? state.region : '';
    for (const button of provinceButtons) button.setAttribute('aria-pressed', String(button.dataset.newsProvince === picked));
    const cities = state.source ? state.cities : [];
    cityRow.hidden = cities.length === 0;
    if (!cityRow.hidden && cityRow.dataset.filled !== cities.join('|')) {
      cityRow.replaceChildren(chip('newsCity', '', '전체'), ...cities.map(name => chip('newsCity', name, name)));
      cityRow.dataset.filled = cities.join('|');
    }
    for (const button of cityRow.children) button.setAttribute('aria-pressed', String((button.dataset.newsCity || '') === (state.city || '')));
  };
  const setStatus = (message, {canRetry = false} = {}) => {
    status.textContent = message;
    retry.hidden = !canRetry;
  };

  const paintTabs = () => {
    const shown = visibleCategories(state.categories, state.category);
    tabs.replaceChildren();
    tabs.hidden = shown.length <= 1;
    for (const entry of shown) {
      const button = el('button', 'lotbi-news-category', text(entry.label));
      button.type = 'button';
      button.dataset.newsCategory = entry.id;
      button.setAttribute('aria-pressed', String(entry.id === state.category));
      button.addEventListener('click', () => {
        if (disposed || state.category === entry.id) return;
        state.category = entry.id;
        void load();
      });
      tabs.append(button);
    }
  };
  const row = item => {
    const row = el('li', 'lotbi-news-row');
    const link = el('a', 'lotbi-news-item');
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.newsArticle = 'true';
    const copy = el('span', 'lotbi-news-item-copy');
    copy.append(el('span', 'lotbi-news-item-title', item.title));
    const meta = [item.source, formatNewsTime(item.at, now())].filter(Boolean).join(' · ');
    if (meta) copy.append(el('span', 'lotbi-news-item-meta', meta));
    link.append(copy, glyph('open'));
    row.append(link);
    return row;
  };
  const renderDays = entries => {
    days.replaceChildren();
    let count = 0;
    for (const day of Array.isArray(entries) ? entries : []) {
      const items = feedListItems(day?.items);
      if (!items.length) continue;
      const section = el('section', 'lotbi-news-day');
      section.dataset.newsDay = text(day.date);
      const heading = el('h4', 'lotbi-news-day-title', text(day.label));
      const dayList = el('ul', 'lotbi-news-list');
      for (const item of items) dayList.append(row(item));
      section.append(heading, dayList);
      days.append(section);
      count += items.length;
    }
    return count;
  };
  async function load({more: append = false} = {}) {
    const current = ++request;
    controller?.abort();
    controller = new AbortController();
    surface.dataset.newsState = 'LOADING';
    surface.setAttribute('aria-busy', 'true');
    paint();
    setStatus('지역뉴스를 불러오고 있어요.');
    if (!append) state.offset = 0;
    const where = state.city && state.province
      ? {region: state.province, city: state.city}
      : state.source === 'current' && state.coords
        ? {...state.coords}
        : {region: state.source === 'saved' ? saved : state.region};
    const url = newsListUrl({...where, period: state.period, category: state.category, offset: append ? state.offset : 0});
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || current !== request) return;
    surface.removeAttribute('aria-busy');
    if (!response.ok || response.data?.status !== 'OK') {
      if (!append) { list.replaceChildren(); days.replaceChildren(); }
      more.hidden = true;
      surface.dataset.newsState = 'ERROR';
      if (response.status === 422) {
        state.mode = 'pick';
        state.panelOpen = true;
        paint();
        setStatus('지역을 골라 주세요.');
      } else if (response.status === 429) {
        setStatus('요청이 많아요. 잠시 후 다시 시도해 주세요.', {canRetry: true});
      } else {
        setStatus('지역뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', {canRetry: true});
      }
      return;
    }
    const data = response.data;
    state.label = text(data.region?.label) || state.label;
    state.province = text(data.province) || state.province;
    state.cities = Array.isArray(data.cities) ? data.cities.map(text).filter(Boolean) : [];
    state.categories = Array.isArray(data.categories) ? data.categories : [];
    paintTabs();
    let shown;
    if (state.period === 'week') {
      list.replaceChildren();
      more.hidden = true;
      shown = renderDays(data.days);
    } else {
      days.replaceChildren();
      const page = data.today || {};
      const items = feedListItems(page.items);
      if (!append) list.replaceChildren();
      for (const item of items) list.append(row(item));
      state.offset = Number(page.offset || 0) + (Array.isArray(page.items) ? page.items.length : 0);
      more.hidden = !page.has_more;
      shown = list.children.length;
    }
    surface.dataset.newsState = shown ? 'READY' : 'EMPTY';
    paint();
    const where2 = state.category === 'all' ? '' : ` ${(state.categories.find(entry => entry.id === state.category) || {}).label || ''} 분야`;
    if (shown) setStatus('');
    else setStatus(state.period === 'today'
      ? `오늘 ${state.label || '이 지역'}${where2} 기사가 아직 없어요. 1주일을 눌러 보세요.`
      : `최근 1주일 ${state.label || '이 지역'}${where2} 기사를 찾지 못했어요.`);
  }

  const useCurrent = coords => {
    state.coords = coords;
    state.source = 'current';
    state.mode = 'current';
    state.city = '';
    state.label = '';
    state.panelOpen = false;
  };
  const locate = async allowPrompt => {
    try {
      const outcome = await resolveSharedBrowserCurrentLocation({allowPrompt});
      const location = outcome?.location;
      const coords = {latitude: Number(location?.latitude), longitude: Number(location?.longitude)};
      return inKorea(coords.latitude, coords.longitude) ? coords : null;
    } catch {
      return null;
    }
  };

  modePick.addEventListener('click', () => {
    if (disposed) return;
    state.panelOpen = !state.panelOpen;
    paintRegion();
    if (state.panelOpen) provinceButtons[0]?.focus();
  });
  modeCurrent.addEventListener('click', async () => {
    if (disposed || modeCurrent.disabled) return;
    if (state.mode === 'current' && state.coords && !state.city) return;
    modeCurrent.disabled = true;
    const coords = state.coords || await locate(true);
    if (disposed) return;
    modeCurrent.disabled = false;
    if (coords) { useCurrent(coords); void load(); }
    else {
      state.mode = 'pick';
      state.panelOpen = true;
      paintRegion();
      setStatus('위치를 확인하지 못했어요. 시·도를 골라 주세요.');
    }
  });
  provinceChips.addEventListener('click', event => {
    const button = event.target.closest?.('[data-news-province]');
    if (disposed || !button) return;
    const value = button.dataset.newsProvince;
    state.mode = 'pick';
    state.city = '';
    state.panelOpen = false;
    state.source = value === 'saved' ? 'saved' : 'pick';
    state.region = value === 'saved' ? '' : value;
    state.label = value === 'saved' ? '' : value;
    void load();
  });
  cityRow.addEventListener('click', event => {
    const button = event.target.closest?.('[data-news-city]');
    if (disposed || !button) return;
    state.city = button.dataset.newsCity || '';
    state.label = state.city || state.province;
    void load();
  });

  (async () => {
    let permission = LOCATION_PERMISSION.DENIED;
    if (isLocationUsageEnabled()) {
      try { permission = await getBrowserLocationPermissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
    }
    if (disposed) return;
    modeCurrent.hidden = !(isLocationUsageEnabled() && permission !== LOCATION_PERMISSION.UNAVAILABLE);
    if (permission === LOCATION_PERMISSION.GRANTED) {
      const coords = await locate(false);
      if (disposed) return;
      if (coords) { useCurrent(coords); void load(); return; }
    }
    state.mode = 'pick';
    if (saved) { state.source = 'saved'; void load(); return; }
    state.panelOpen = true;
    surface.dataset.newsState = 'PICK';
    paint();
    setStatus('지역을 골라 주세요.');
  })();

  return {
    focus: () => title.focus(),
    dispose() { disposed = true; request += 1; controller?.abort(); },
  };
}
