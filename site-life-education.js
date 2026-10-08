// KINDERGARTEN-OFFICIAL-INFO-01 — 생활정보 → 유치원·학교.
//
// 학교: the existing NEIS school answers in the chat (급식·학사일정·기본정보).
//   This screen only prepares the question; the saved school (life-school
//   key, site-life-school.js) is never read or changed here.
// 유치원: 교육부 유치원알리미 공시 through Core (site-kindergarten-client.js) —
//   region (the provider's 시도·시군구 code table) → name / 설립유형 → list →
//   one 유치원: six facts first, then 통학차량·급식·방과후 과정·교직원·수업일수·
//   안전·건물·보험 공시, each with its 공시차수. A 유치원 is its kinder code.
//   "내 유치원" is a separate per-account key; 어린이집 are not 유치원알리미
//   공시 and are not shown as such.
import {
  ESTABLISHMENT_FILTERS,
  fetchKindergartenDetail,
  fetchKindergartenRegions,
  regionFromLabel,
  safeKindergartenLink,
  searchKindergartens,
  telHref,
} from './site-kindergarten-client.js?v=aset-286a694c2120';
import {readCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-286a694c2120';

const PREFERENCE_PREFIX = 'lotbi.site.ux.v1.life-kindergarten';
const LAST_REGION_KEY = 'lotbi.site.ux.v1.life-kindergarten-region';
const CODE_RE = /^[0-9A-Za-z-]{8,64}$/u;
const SGG_RE = /^\d{5}$/u;

export const SCHOOL_ACTIONS = Object.freeze([
  ['basic', '학교 기본정보'], ['meal_today', '오늘 급식'], ['meal_week', '이번 주 급식'], ['schedule', '학사일정'],
]);
const SCHOOL_ACTION_TEXT = Object.freeze({
  basic: '알려줘', meal_today: '오늘 급식 알려줘', meal_week: '이번 주 급식 알려줘', schedule: '이번 달 학사일정 알려줘',
});

function clean(value, max = 60) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

// The chat's NEIS school answer reads these sentences; without a name it uses
// the school the user saved there.
export function buildSchoolPrompt(actionId, schoolName = '') {
  const name = clean(schoolName, 40).replace(/[^0-9A-Za-z가-힣 ]/gu, '');
  const tail = SCHOOL_ACTION_TEXT[actionId] || SCHOOL_ACTION_TEXT.basic;
  if (!name) return actionId === 'basic' ? '우리 학교 기본정보 알려줘' : tail;
  return `${name} ${tail}`;
}

export function buildKindergartenPrompt(kindergarten) {
  const area = clean(kindergarten?.area, 30).replace(/^(?:전북|전남광주|서울|부산|대구|인천|대전|울산|세종|경기|충북|충남|경북|경남|제주|강원)\s+/u, '');
  const name = clean(kindergarten?.name, 60);
  return name ? `${area ? `${area} ` : ''}${name} 알려줘` : '';
}

export function kindergartenPreferenceKey(accountId = '') {
  const namespace = clean(accountId, 80).replace(/[^0-9A-Za-z_-]/gu, '').slice(0, 64) || 'guest';
  return `${PREFERENCE_PREFIX}.${namespace}`;
}

function normalizePreference(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kinderCode = clean(raw.kinderCode, 64);
  const sggCode = clean(raw.sggCode, 5);
  const name = clean(raw.name, 80);
  if (!CODE_RE.test(kinderCode) || !SGG_RE.test(sggCode) || !name) return null;
  return Object.freeze({kinderCode, sggCode, name, area: clean(raw.area, 40)});
}

export function readKindergartenPreference(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? normalizePreference(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeKindergartenPreference(storage, key, kindergarten) {
  const value = normalizePreference(kindergarten);
  if (!value) return false;
  try { storage?.setItem?.(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function clearKindergartenPreference(storage, key) {
  try { storage?.removeItem?.(key); } catch { /* storage may be blocked */ }
}

function readLastRegion(storage) {
  try {
    const value = JSON.parse(storage?.getItem?.(LAST_REGION_KEY) || 'null');
    return value && /^\d{2}$/u.test(value.sidoCode) && SGG_RE.test(value.sggCode) ? value : null;
  } catch {
    return null;
  }
}

function writeLastRegion(storage, region) {
  try { storage?.setItem?.(LAST_REGION_KEY, JSON.stringify(region)); } catch { /* optional */ }
}

function safeStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function button(label, run, className = 'consumer-action consumer-action-secondary') {
  const element = node('button', className, label);
  element.type = 'button';
  if (run) element.addEventListener('click', run);
  return element;
}

function people(value, unit = '명') {
  return Number.isInteger(value) ? `${value}${unit}` : '미확인';
}

function factRow(list, label, value, href = '') {
  const row = node('div', 'lotbi-kinder-fact');
  const term = node('dt', '', label);
  const data = node('dd');
  if (href && value) {
    const link = node('a', '', value);
    link.href = href;
    if (/^https?:/u.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    data.append(link);
  } else {
    data.textContent = value || '미확인';
  }
  row.append(term, data);
  list.append(row);
}

const PART_NOTE = Object.freeze({
  NO_DATA: '유치원알리미에 이 유치원 공시가 없어요(미확인).',
  DENIED: 'LOTBI의 유치원알리미 이용 권한으로는 아직 조회되지 않아요(미확인).',
  UNAVAILABLE: '지금 유치원알리미에서 확인하지 못했어요. 없다는 뜻은 아니에요.',
  DISABLED: '유치원알리미 공식정보 연결을 준비하고 있어요.',
});
const CATEGORY_NOTE = Object.freeze({
  bus: '통학 노선·정류장·지금 탈 수 있는지는 공시 항목이 아니에요. 유치원에 확인해 주세요.',
  meal: '날짜별 식단은 공시 항목이 아니에요.',
  after_school: '방과후 과정 비용과 신청 방법은 공시 항목이 아니에요.',
  safety: '안전교육 수치는 공시된 값 그대로예요.',
});

export function mountEducation({
  root,
  onDraft,
  accountId = '',
  fetchImpl = globalThis.fetch,
  storage = safeStorage(),
  readSavedRegion = readCalendarManualWeatherRegion,
  initialTab = 'kindergarten',
} = {}) {
  let disposed = false;
  let generation = 0;
  let catalog = null;
  const preferenceKey = kindergartenPreferenceKey(accountId);
  const container = node('div', 'lotbi-edu');
  const tabs = node('div', 'consumer-tabs lotbi-edu-tabs');
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '교육정보 분류');
  const panel = node('div', 'lotbi-edu-panel'); panel.setAttribute('role', 'tabpanel'); panel.id = 'lotbi-edu-panel';
  const tabButtons = [['school', '학교', '초·중·고'], ['kindergarten', '유치원', '유치원알리미']].map(([value, label, sub], index) => {
    const tab = node('button', 'lotbi-edu-tab');
    tab.type = 'button'; tab.id = `lotbi-edu-tab-${value}`; tab.dataset.eduTab = value;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
    tab.append(node('span', 'lotbi-edu-tab-label', label), node('span', 'lotbi-edu-tab-sub', sub));
    tab.addEventListener('click', () => select(value));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      tabButtons[next].focus(); select(next ? 'kindergarten' : 'school');
    });
    return tab;
  });
  tabs.append(...tabButtons);
  container.append(tabs, panel);
  root.append(container);

  function select(value) {
    generation += 1;
    for (const tab of tabButtons) {
      const active = tab.dataset.eduTab === value;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `lotbi-edu-tab-${value}`);
    if (value === 'school') renderSchool(); else void renderKindergartenHome();
  }

  // ------------------------------------------------------------ 학교 ----
  function renderSchool() {
    const form = node('form', 'consumer-life-form lotbi-edu-school');
    const label = node('label', 'consumer-life-field', '학교 이름');
    const input = node('input'); input.type = 'text'; input.maxLength = 40; input.placeholder = '예: 전주서원초 (비우면 저장한 내 학교)';
    input.setAttribute('aria-label', '학교 이름'); input.dataset.eduSchoolName = '';
    label.append(input);
    const chips = node('div', 'festival-chip-row consumer-life-chips');
    chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', '물어볼 내용');
    let chosen = 'meal_today';
    for (const [id, text] of SCHOOL_ACTIONS) {
      const chip = button(text, () => {
        chosen = id;
        for (const other of chips.children) other.setAttribute('aria-pressed', String(other.dataset.schoolAction === id));
      }, 'festival-chip');
      chip.dataset.schoolAction = id; chip.setAttribute('aria-pressed', String(id === chosen));
      chips.append(chip);
    }
    const send = node('button', 'consumer-action', '질문 준비하기'); send.type = 'submit';
    form.append(label, chips, send);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!disposed) onDraft?.(buildSchoolPrompt(chosen, input.value));
    });
    const intro = node('p', 'lotbi-edu-intro', '초·중·고 급식·학사일정·기본정보는 교육부 NEIS 공식 자료로 대화에서 알려 드려요.');
    const note = node('p', 'consumer-feature-note',
      '다음 화면에서 질문을 확인한 뒤 보내세요. 학교를 고르면 대화에서 내 학교로 저장할 수 있고, 이 화면은 저장한 학교를 바꾸지 않아요.');
    panel.replaceChildren(intro, form, note);
  }

  // ---------------------------------------------------------- 유치원 ----
  function sourceFooter(source) {
    const footer = node('p', 'lotbi-kinder-source');
    footer.append('출처: ');
    const link = node('a', '', source?.label || '교육부 유치원알리미');
    link.href = safeKindergartenLink(source?.url) || 'https://e-childschoolinfo.moe.go.kr/';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    footer.append(link, ` 공시${source?.fetchedOn ? ` · ${source.fetchedOn} 조회` : ''}. 어린이집은 유치원알리미 공시 대상이 아니에요.`);
    return footer;
  }

  function disabledNotice() {
    const box = node('section', 'lotbi-kinder-state');
    box.dataset.kinderState = 'DISABLED';
    box.append(node('h4', '', '유치원 공식정보 연결을 준비하고 있어요'),
      node('p', '', '지금은 대화에서 "전주 예일유치원 알려줘"처럼 물어보시면 지역 검색으로 찾아 드려요. 이때 답은 공시 자료가 아니에요.'));
    box.append(button('대화로 물어보기', () => onDraft?.('전주 예일유치원 알려줘')));
    return box;
  }

  async function ensureCatalog() {
    if (catalog) return catalog;
    catalog = await fetchKindergartenRegions(fetchImpl);
    return catalog;
  }

  function defaultRegion(found) {
    const preference = readKindergartenPreference(storage, preferenceKey);
    const fromPreference = preference ? found.regions.find(sido => sido.sggs.some(sgg => sgg.code === preference.sggCode)) : null;
    if (fromPreference) return {sidoCode: fromPreference.sidoCode, sggCode: preference.sggCode};
    const last = readLastRegion(storage);
    if (last && found.regions.some(sido => sido.sidoCode === last.sidoCode && sido.sggs.some(sgg => sgg.code === last.sggCode))) return last;
    let saved = null;
    try { saved = readSavedRegion?.(storage); } catch { saved = null; }
    return regionFromLabel(found, saved?.label) || null;
  }

  async function renderKindergartenHome({keepQuery} = {}) {
    const current = ++generation;
    panel.setAttribute('aria-busy', 'true');
    panel.replaceChildren(node('p', 'consumer-feature-note', '유치원알리미 지역 목록을 불러오고 있어요.'));
    const found = await ensureCatalog();
    if (disposed || current !== generation) return;
    panel.removeAttribute('aria-busy');
    if (!found) {
      catalog = null;
      const box = node('section', 'lotbi-kinder-state'); box.dataset.kinderState = 'UNAVAILABLE';
      box.append(node('p', '', '지금 유치원 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.'),
        button('다시 불러오기', () => void renderKindergartenHome()));
      panel.replaceChildren(box);
      return;
    }
    if (!found.enabled) {
      panel.replaceChildren(disabledNotice(), sourceFooter(null));
      return;
    }
    const children = [];
    const preference = readKindergartenPreference(storage, preferenceKey);
    if (preference) {
      const mine = node('section', 'lotbi-kinder-mine');
      mine.dataset.kinderMine = preference.kinderCode;
      const head = node('div', 'lotbi-kinder-mine-head');
      head.append(node('span', 'lotbi-kinder-mine-label', '내 유치원'), node('strong', '', preference.name));
      if (preference.area) head.append(node('span', 'lotbi-kinder-mine-area', preference.area));
      const actions = node('div', 'lotbi-kinder-actions');
      actions.append(button('공시 보기', () => void openDetail({kinderCode: preference.kinderCode, sggCode: preference.sggCode,
        name: preference.name, area: preference.area}), 'consumer-action'));
      actions.append(button('내 유치원 해제', () => { clearKindergartenPreference(storage, preferenceKey); void renderKindergartenHome(); }));
      mine.append(head, actions);
      children.push(mine);
    }
    const form = node('form', 'consumer-life-form lotbi-kinder-search');
    const regionRow = node('div', 'lotbi-kinder-region');
    const sidoLabel = node('label', 'consumer-life-field', '시·도');
    const sido = node('select'); sido.dataset.kinderSido = ''; sido.setAttribute('aria-label', '시·도');
    const sggLabel = node('label', 'consumer-life-field', '시·군·구');
    const sgg = node('select'); sgg.dataset.kinderSgg = ''; sgg.setAttribute('aria-label', '시·군·구');
    sido.append(new Option('시·도 선택', ''));
    for (const item of found.regions) sido.append(new Option(item.sidoName, item.sidoCode));
    const fillSgg = selected => {
      sgg.replaceChildren(new Option('시·군·구 선택', ''));
      const entry = found.regions.find(item => item.sidoCode === sido.value);
      for (const item of entry?.sggs || []) sgg.append(new Option(item.name, item.code));
      sgg.value = selected && [...sgg.options].some(option => option.value === selected) ? selected : '';
    };
    sido.addEventListener('change', () => fillSgg(''));
    sidoLabel.append(sido); sggLabel.append(sgg); regionRow.append(sidoLabel, sggLabel);
    const nameLabel = node('label', 'consumer-life-field', '유치원 이름 (선택)');
    const name = node('input'); name.type = 'text'; name.maxLength = 30; name.placeholder = '예: 예일';
    name.setAttribute('aria-label', '유치원 이름'); name.dataset.kinderName = '';
    nameLabel.append(name);
    const chips = node('div', 'festival-chip-row consumer-life-chips');
    chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', '설립유형');
    let establishment = keepQuery?.establishment || 'ALL';
    for (const [value, label] of ESTABLISHMENT_FILTERS) {
      const chip = button(label, () => {
        establishment = value;
        for (const other of chips.children) other.setAttribute('aria-pressed', String(other.dataset.kinderEstablishment === value));
      }, 'festival-chip');
      chip.dataset.kinderEstablishment = value; chip.setAttribute('aria-pressed', String(value === establishment));
      chips.append(chip);
    }
    const send = node('button', 'consumer-action', '유치원 찾기'); send.type = 'submit';
    const status = node('p', 'lotbi-kinder-status'); status.setAttribute('role', 'status');
    const results = node('div', 'lotbi-kinder-results');
    form.append(regionRow, nameLabel, chips, send);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!sgg.value) { status.textContent = '시·군·구를 먼저 골라 주세요.'; (sido.value ? sgg : sido).focus(); return; }
      writeLastRegion(storage, {sidoCode: sido.value, sggCode: sgg.value});
      void runSearch({sggCode: sgg.value, q: name.value, establishment}, status, results);
    });
    const start = keepQuery?.region || defaultRegion(found);
    if (start) { sido.value = start.sidoCode; fillSgg(start.sggCode); } else fillSgg('');
    if (keepQuery?.q) name.value = keepQuery.q;
    children.push(form, status, results, sourceFooter(null));
    panel.replaceChildren(...children);
    if (keepQuery?.region?.sggCode) void runSearch({sggCode: keepQuery.region.sggCode, q: keepQuery.q, establishment}, status, results);
    lastQuery = () => ({region: {sidoCode: sido.value, sggCode: sgg.value}, q: name.value, establishment});
  }

  let lastQuery = () => null;

  async function runSearch(query, status, results) {
    const current = ++generation;
    status.textContent = '유치원알리미 공시를 찾고 있어요.';
    results.replaceChildren(); results.setAttribute('aria-busy', 'true');
    const found = await searchKindergartens(query, fetchImpl);
    if (disposed || current !== generation) return;
    results.removeAttribute('aria-busy');
    if (found.status === 'DISABLED') { results.replaceChildren(disabledNotice()); status.textContent = ''; return; }
    if (found.status === 'RATE_LIMITED') { status.textContent = '조회가 많아요. 잠시 후 다시 찾아 주세요.'; return; }
    if (found.status !== 'OK') { status.textContent = PART_NOTE.UNAVAILABLE; return; }
    status.textContent = found.items.length
      ? `${found.regionLabel || '선택한 지역'} 유치원 ${found.items.length}곳 (유치원알리미 공시 기준)`
      : '조건에 맞는 유치원을 공시에서 찾지 못했어요. 이름이나 설립유형을 바꿔 보세요.';
    const list = node('ul', 'lotbi-kinder-list');
    for (const item of found.items) {
      const entry = node('li');
      const card = node('button', 'lotbi-kinder-card'); card.type = 'button'; card.dataset.kinderCode = item.kinderCode;
      const top = node('span', 'lotbi-kinder-card-top');
      top.append(node('strong', '', item.name), node('span', 'lotbi-kinder-badge', item.establishment || '설립유형 미확인'));
      card.append(top,
        node('span', 'lotbi-kinder-card-line', item.address || '주소 미확인'),
        node('span', 'lotbi-kinder-card-line', `운영 ${item.hours || '미확인'} · 정원 ${people(item.capacity)} · 원아 ${people(item.enrolled)}`));
      card.addEventListener('click', () => void openDetail(item));
      entry.append(card); list.append(entry);
    }
    results.replaceChildren(list);
  }

  async function openDetail(summary) {
    const current = ++generation;
    const back = button('유치원 목록으로', () => {
      const keep = lastQuery();
      void renderKindergartenHome({keepQuery: keep && keep.region.sggCode ? keep : null});
    });
    const title = node('h4', 'lotbi-kinder-title', summary.name || '유치원'); title.tabIndex = -1;
    panel.setAttribute('aria-busy', 'true');
    panel.replaceChildren(back, title, node('p', 'consumer-feature-note', '공시를 불러오고 있어요.'));
    title.focus();
    const found = await fetchKindergartenDetail(summary, fetchImpl);
    if (disposed || current !== generation) return;
    panel.removeAttribute('aria-busy');
    if (found.status === 'DISABLED') { panel.replaceChildren(back, disabledNotice()); return; }
    if (found.status !== 'OK' || !found.kindergarten) {
      const message = found.status === 'NOT_FOUND' ? '유치원알리미 공시에서 이 유치원을 찾지 못했어요.'
        : found.status === 'RATE_LIMITED' ? '조회가 많아요. 잠시 후 다시 열어 주세요.' : PART_NOTE.UNAVAILABLE;
      const box = node('section', 'lotbi-kinder-state'); box.dataset.kinderState = found.status;
      box.append(node('p', '', message));
      panel.replaceChildren(back, title, box);
      return;
    }
    const kindergarten = found.kindergarten;
    const card = node('section', 'lotbi-kinder-detail');
    card.dataset.kinderDetail = kindergarten.kinderCode;
    title.textContent = kindergarten.name;
    const facts = node('dl', 'lotbi-kinder-facts');
    factRow(facts, '설립유형', kindergarten.establishment);
    factRow(facts, '주소', kindergarten.address);
    factRow(facts, '연락처', kindergarten.phone, telHref(kindergarten.phone));
    factRow(facts, '운영시간', kindergarten.hours);
    factRow(facts, '학급·정원·원아', `학급 ${people(kindergarten.classes, '개')} · 인가 정원 ${people(kindergarten.capacity)} · 원아 ${people(kindergarten.enrolled)}`);
    factRow(facts, '홈페이지', kindergarten.homepage ? kindergarten.homepage.replace(/^https?:\/\//u, '').replace(/\/$/u, '') : '',
      kindergarten.homepage);
    factRow(facts, '공시 기준', `${kindergarten.disclosureLabel || '공시차수 미확인'} · 교육부 유치원알리미`);
    const actions = node('div', 'lotbi-kinder-actions');
    const isMine = () => readKindergartenPreference(storage, preferenceKey)?.kinderCode === kindergarten.kinderCode;
    const mineButton = button('', null, 'consumer-action');
    const syncMine = () => { mineButton.textContent = isMine() ? '내 유치원 해제' : '내 유치원으로 설정'; mineButton.setAttribute('aria-pressed', String(isMine())); };
    mineButton.addEventListener('click', () => {
      if (isMine()) clearKindergartenPreference(storage, preferenceKey);
      else writeKindergartenPreference(storage, preferenceKey, kindergarten);
      syncMine();
    });
    syncMine();
    actions.append(mineButton, button('대화로 물어보기', () => onDraft?.(buildKindergartenPrompt(kindergarten))));
    card.append(facts, actions);
    const sections = node('div', 'lotbi-kinder-sections');
    sections.append(node('h5', 'lotbi-kinder-sections-title', '상세 공시'));
    for (const category of found.categories) {
      const block = node('details', 'lotbi-kinder-section');
      block.dataset.kinderCategory = category.key;
      const summaryLine = node('summary');
      const labels = [...new Set(category.parts.map(part => part.disclosureLabel).filter(Boolean))];
      summaryLine.append(node('span', 'lotbi-kinder-section-label', category.label),
        node('span', 'lotbi-kinder-section-meta', labels.length ? labels.join(', ') : '미확인'));
      block.append(summaryLine);
      for (const part of category.parts) {
        if (category.parts.length > 1) block.append(node('p', 'lotbi-kinder-part-label', part.label));
        if (part.status === 'OK' && part.items.length) {
          const list = node('dl', 'lotbi-kinder-items');
          for (const item of part.items) factRow(list, item.label, item.value);
          block.append(list);
        } else {
          block.append(node('p', 'lotbi-kinder-part-note', PART_NOTE[part.status] || PART_NOTE.UNAVAILABLE));
        }
      }
      if (CATEGORY_NOTE[category.key]) block.append(node('p', 'lotbi-kinder-part-note', CATEGORY_NOTE[category.key]));
      sections.append(block);
    }
    const tuition = node('p', 'consumer-feature-note', '학비는 유치원알리미 Open API로 제공되지 않아 LOTBI가 말씀드리지 않아요. 유치원알리미 누리집이나 유치원에 확인해 주세요.');
    panel.replaceChildren(back, title, card, sections, tuition, sourceFooter(found.source));
  }

  select(initialTab === 'school' ? 'school' : 'kindergarten');
  return {dispose() { disposed = true; generation += 1; }};
}
