// REGIONAL-NEWS-SCREEN-LIST-01 — 지역정보 → 지역뉴스 lists news titles itself.
// Reads only Core's public, guest-safe GET /v2/life/news (no credentials,
// nothing stored). Core reads every region at 광역시·도 level
// (REGIONAL-NEWS-PROVINCE-ONLY-01) and keeps only related, de-duplicated
// articles, so the list shows what Core found — three articles stay three.
//
// Region: the current location when location use is on and the browser already
// allows it, else the saved region, else the reader picks one of 17 시·도.
// [위치 허용] shows only while location use is on but not yet allowed. A title
// opens the article itself; a failed read says so and offers 다시 시도 —
// nothing old or made up is shown in its place.
import {CORE_ORIGIN} from './site-core.js?v=aset-d5c6e0c08567';
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-d5c6e0c08567';
import {isLocationUsageEnabled} from './site-location-preference.js?v=aset-d5c6e0c08567';
import {savedLifeRegionLabel} from './site-life-location.js?v=aset-d5c6e0c08567';

export const NEWS_PROVINCES = Object.freeze([
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]);
export const NEWS_PERIODS = Object.freeze([
  Object.freeze({id: 'today', label: '오늘'}),
  Object.freeze({id: 'week', label: '1주일'}),
]);
export const NEWS_LIST_LIMIT = 10;
const TIMEOUT_MS = 12_000;
const KST = 'Asia/Seoul';
const SVG_NS = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');
const ICONS = Object.freeze({
  news: ['M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5Z', 'M17 9h3v10a2 2 0 0 1-2 2', 'M7 9h7M7 12h7M7 15h4'],
  pin: ['M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z', 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  open: ['M14 4h6v6', 'M20 4 11 13', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
});

const inKorea = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= 31 && latitude <= 44.5 && longitude >= 122 && longitude <= 132.5;
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

export function newsListUrl({latitude, longitude, region = '', period = 'today', limit = NEWS_LIST_LIMIT} = {}, origin = CORE_ORIGIN) {
  const params = new URLSearchParams();
  if (inKorea(Number(latitude), Number(longitude))) {
    params.set('latitude', String(Math.round(Number(latitude) * 1000) / 1000));
    params.set('longitude', String(Math.round(Number(longitude) * 1000) / 1000));
  } else if (text(region)) {
    params.set('region', text(region).slice(0, 40));
  }
  params.set('period', NEWS_PERIODS.some(item => item.id === period) ? period : 'today');
  params.set('limit', String(limit));
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
  const state = {source: '', region: '', coords: null, period: 'today', label: ''};

  const surface = el('section', 'lotbi-news');
  surface.dataset.newsState = 'LOADING';
  const head = el('div', 'lotbi-news-head');
  const title = el('h3', 'lotbi-news-title', '지역뉴스');
  title.tabIndex = -1;
  const toggle = el('button', 'lotbi-news-region-toggle');
  toggle.type = 'button';
  toggle.dataset.newsRegionToggle = 'true';
  toggle.setAttribute('aria-label', '지역 변경');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.title = '지역 변경';
  toggle.append(glyph('pin'));
  head.append(glyph('news'), title, toggle);
  const basis = el('p', 'lotbi-news-basis');

  const picker = el('div', 'lotbi-news-picker');
  picker.hidden = true;
  const label = el('label', 'lotbi-news-field', '지역');
  const select = el('select');
  select.dataset.newsRegion = 'true';
  select.setAttribute('aria-label', '지역');
  const option = (value, content) => { const entry = el('option', '', content); entry.value = value; return entry; };
  const placeholder = option('', '시·도 선택');
  select.append(saved ? option('saved', `저장 지역 (${saved})`) : placeholder);
  for (const province of NEWS_PROVINCES) select.append(option(province, province));
  label.append(select);
  const allow = el('button', 'consumer-action consumer-action-secondary lotbi-news-allow', '위치 허용');
  allow.type = 'button';
  allow.dataset.newsAllowLocation = 'true';
  allow.hidden = true;
  picker.append(label);

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
  const list = el('ul', 'lotbi-news-list');
  list.setAttribute('aria-label', '지역뉴스 목록');
  const status = el('p', 'lotbi-news-status');
  status.setAttribute('role', 'status');
  const retry = el('button', 'consumer-action consumer-action-secondary lotbi-news-retry', '다시 시도');
  retry.type = 'button';
  retry.hidden = true;
  retry.addEventListener('click', () => { if (!disposed) void load(); });
  surface.append(head, basis, allow, picker, periods, list, status, retry);
  root.replaceChildren(surface);

  const sourceText = () => (state.source === 'current' ? '현재 위치 기준' : state.source === 'saved' ? '저장 지역 기준' : '선택한 지역');
  const periodText = () => (NEWS_PERIODS.find(item => item.id === state.period) || NEWS_PERIODS[0]).label;
  const paint = () => {
    title.textContent = state.label ? `${state.label} 지역뉴스` : '지역뉴스';
    basis.textContent = state.source ? `${sourceText()} · ${periodText()} · 최신순` : '';
    for (const button of periodButtons) button.setAttribute('aria-pressed', String(button.dataset.newsPeriod === state.period));
    periods.hidden = !state.source;
  };
  const openPicker = open => {
    picker.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  const setStatus = (message, {canRetry = false} = {}) => {
    status.textContent = message;
    retry.hidden = !canRetry;
  };

  const render = items => {
    list.replaceChildren();
    for (const item of items) {
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
      list.append(row);
    }
  };

  async function load() {
    const current = ++request;
    controller?.abort();
    controller = new AbortController();
    surface.dataset.newsState = 'LOADING';
    surface.setAttribute('aria-busy', 'true');
    paint();
    setStatus('지역뉴스를 불러오고 있어요.');
    const url = state.source === 'current' && state.coords
      ? newsListUrl({...state.coords, period: state.period})
      : newsListUrl({region: state.source === 'saved' ? saved : state.region, period: state.period});
    const response = await getJson(url, {fetchImpl, signal: controller.signal});
    if (disposed || current !== request) return;
    surface.removeAttribute('aria-busy');
    if (!response.ok || response.data?.status !== 'OK') {
      list.replaceChildren();
      surface.dataset.newsState = 'ERROR';
      if (response.status === 422) {
        openPicker(true);
        setStatus('지역을 골라 주세요.');
      } else if (response.status === 429) {
        setStatus('요청이 많아요. 잠시 후 다시 시도해 주세요.', {canRetry: true});
      } else {
        setStatus('지역뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', {canRetry: true});
      }
      return;
    }
    const newsResult = response.data.news_result;
    state.label = text(newsResult?.region?.label) || state.label;
    const items = newsListItems(newsResult);
    render(items);
    surface.dataset.newsState = items.length ? 'READY' : 'EMPTY';
    paint();
    if (items.length) setStatus('');
    else setStatus(state.period === 'today'
      ? `오늘 ${state.label || '이 지역'} 관련 기사가 아직 없어요. 1주일을 눌러 보세요.`
      : `최근 1주일 ${state.label || '이 지역'} 관련 기사를 찾지 못했어요.`);
  }

  const useCurrent = coords => {
    state.coords = coords;
    state.source = 'current';
    if (!select.querySelector('option[value="current"]')) select.prepend(option('current', '현재 위치'));
    placeholder.remove();
    select.value = 'current';
    allow.hidden = true;
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

  toggle.addEventListener('click', () => { if (!disposed) openPicker(picker.hidden); });
  select.addEventListener('change', () => {
    if (disposed || !select.value) return;
    if (select.value === 'current' && state.coords) state.source = 'current';
    else if (select.value === 'saved') state.source = 'saved';
    else { state.source = 'pick'; state.region = select.value; }
    state.label = select.value === 'current' || select.value === 'saved' ? '' : select.value;
    openPicker(false);
    void load();
  });
  allow.addEventListener('click', async () => {
    if (disposed || allow.disabled) return;
    allow.disabled = true;
    const coords = await locate(true);
    if (disposed) return;
    allow.disabled = false;
    if (coords) { useCurrent(coords); openPicker(false); void load(); }
    else setStatus('위치를 확인하지 못했어요. 시·도를 골라 주세요.');
  });

  (async () => {
    let permission = LOCATION_PERMISSION.DENIED;
    if (isLocationUsageEnabled()) {
      try { permission = await getBrowserLocationPermissionState(); } catch { permission = LOCATION_PERMISSION.UNKNOWN; }
    }
    if (disposed) return;
    if (permission === LOCATION_PERMISSION.GRANTED) {
      const coords = await locate(false);
      if (disposed) return;
      if (coords) { useCurrent(coords); void load(); return; }
    }
    if (isLocationUsageEnabled() && permission !== LOCATION_PERMISSION.UNAVAILABLE) allow.hidden = false;
    if (saved) { state.source = 'saved'; void load(); return; }
    surface.dataset.newsState = 'PICK';
    paint();
    openPicker(true);
    setStatus('지역을 골라 주세요.');
  })();

  return {
    focus: () => title.focus(),
    dispose() { disposed = true; request += 1; controller?.abort(); },
  };
}
