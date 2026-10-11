// MY-CHILD-SCHOOL-01 — 생활정보 → 내 아이 학교·유치원.
//
// Save once, see it automatically: a signed-in reader saves the school (NEIS)
// or 유치원 (유치원알리미) a child goes to, under a name of their own ("첫째")
// and with NEIS allergen numbers to watch. The entry then shows this week's
// meals (allergen dishes marked from the printed numbers — "급식표 알레르기
// 표기 기준", nothing medical), the school's official links, 방학·재량휴업일·개학
// for this month and the next, or the 유치원's 기본정보, each with its source
// and update time. Where NEIS is empty the reader may ask staff to fill it.
//
// Stored (in Core, per account): institution code, nickname, allergen numbers.
// A child's name, birth date, photo, grade or class is never asked for.
import {
  INFO_ITEM_LABELS,
  NICKNAME_MAX,
  deleteAllMyChildren,
  deleteMyChild,
  fetchOverview,
  kindergartenSaveBody,
  listMyChildren,
  requestInfo,
  saveMyChild,
  schoolSaveBody,
  searchSchools,
  telHref,
  updateMyChild,
} from './site-my-child-client.js?v=aset-68c45bc8b8d3';
import {fetchKindergartenRegions, searchKindergartens} from './site-kindergarten-client.js?v=aset-68c45bc8b8d3';

const ORDINALS = Object.freeze(['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째']);
const WEEKDAYS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);
const ALLERGEN_MARKS = Object.freeze(['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲']);
export const ALLERGY_BASIS_NOTE = '알레르기 강조는 급식표 알레르기 표기 기준이에요.';
export const PRIVACY_NOTE = '저장하는 것은 학교·유치원, 부르는 이름, 알레르기 번호뿐이에요. 아이 이름·생년월일·사진·학년·반은 받지 않아요.';
const UNAVAILABLE_NOTE = '지금 확인하지 못했어요. 없다는 뜻은 아니에요. 잠시 후 다시 열어 주세요.';

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

function isoParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value || ''));
  return match ? match.slice(1).map(Number) : null;
}

/** "2026-10-09" → "10.9(금)". */
export function formatDayLabel(value) {
  const parts = isoParts(value);
  if (!parts) return '';
  const [year, month, day] = parts;
  return `${month}.${day}(${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]})`;
}

/** One day, or "7.20(월)~8.25(화)". */
export function formatPeriod(start, end) {
  const first = formatDayLabel(start);
  if (!end || end === start) return first;
  return `${first}~${formatDayLabel(end)}`;
}

/** NEIS answer time in Korea: "10.9 13:05". */
export function formatFetchedAt(value) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(time)).map(part => [part.type, part.value]));
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

/** The n-th saved entry suggests the n-th ordinal ("둘째" for the second), skipping names in use. */
export function nextNickname(entries = []) {
  const used = new Set(entries.map(entry => entry.nickname));
  const order = [...ORDINALS.slice(entries.length), ...ORDINALS.slice(0, entries.length)];
  return order.find(name => !used.has(name)) || '';
}

export function allergenSummary(list = []) {
  return list.length ? list.map(item => item.name).join('·') : '';
}

function sourceLine(source, fallbackLabel) {
  const line = node('p', 'lotbi-mychild-source');
  const when = formatFetchedAt(source?.fetchedAt);
  line.textContent = `${source?.label || fallbackLabel}${when ? ` · ${when} 갱신` : ''}${source?.stale ? ' · 최근 응답' : ''}`;
  return line;
}

function loginNotice() {
  const box = node('section', 'lotbi-mychild-login');
  box.dataset.myChildState = 'LOGIN_REQUIRED';
  box.append(node('h4', '', '로그인하고 아이 학교·유치원을 저장하세요'),
    node('p', '', '저장하면 급식·학사일정·기본정보를 바로 볼 수 있어요. 저장한 정보는 내 계정에서만 보여요.'));
  const login = node('a', 'consumer-action', '로그인');
  login.href = '/auth/start/';
  box.append(login);
  return box;
}

function allergenPicker(catalog, selected = []) {
  const fieldset = node('fieldset', 'lotbi-mychild-allergens');
  const legend = node('legend', '', '알레르기 표시 (선택)');
  fieldset.append(legend, node('p', 'lotbi-mychild-hint', '고른 번호가 급식표에 있으면 그 메뉴를 강조해요.'));
  const grid = node('div', 'lotbi-mychild-allergen-grid');
  const chosen = new Set(selected);
  for (const item of catalog) {
    const label = node('label', 'lotbi-mychild-allergen');
    const input = node('input');
    input.type = 'checkbox'; input.value = String(item.code); input.checked = chosen.has(item.code);
    input.dataset.myChildAllergen = String(item.code);
    label.append(input, node('span', '', `${ALLERGEN_MARKS[item.code] || item.code} ${item.name}`));
    grid.append(label);
  }
  fieldset.append(grid);
  return {fieldset, values: () => [...grid.querySelectorAll('input:checked')].map(input => Number(input.value))};
}

function nicknameField(value = '') {
  const label = node('label', 'consumer-life-field', '부르는 이름');
  const input = node('input');
  input.type = 'text'; input.maxLength = NICKNAME_MAX; input.required = true; input.value = value;
  input.placeholder = '예: 첫째, 둘째'; input.autocomplete = 'off'; input.dataset.myChildNickname = '';
  input.setAttribute('aria-label', '부르는 이름');
  label.append(input, node('span', 'lotbi-mychild-hint', '아이 이름 대신 "첫째", "둘째"처럼 불러 주세요. 20자까지.'));
  return {label, input};
}

export function mountMyChild({
  root,
  sessionToken = '',
  authenticated = false,
  onAsk,
  fetchImpl = globalThis.fetch,
} = {}) {
  let disposed = false;
  let generation = 0;
  let listing = null;
  const container = node('div', 'lotbi-mychild');
  const status = node('p', 'lotbi-mychild-status'); status.setAttribute('role', 'status');
  const view = node('div', 'lotbi-mychild-view');
  container.append(status, view);
  root.append(container);

  const live = current => !disposed && current === generation;
  const say = text => { status.textContent = text || ''; };

  function failed(error, current, fallback) {
    if (!live(current)) return;
    if (error?.status === 401) { listing = null; view.replaceChildren(loginNotice()); say(''); return; }
    say(error?.message || fallback);
  }

  // ------------------------------------------------------------ home ----
  async function renderHome(message = '') {
    const current = ++generation;
    if (!authenticated || !sessionToken) { view.replaceChildren(loginNotice()); say(''); return; }
    view.setAttribute('aria-busy', 'true');
    view.replaceChildren(node('p', 'consumer-feature-note', '저장한 학교·유치원을 불러오고 있어요.'));
    try {
      listing = await listMyChildren(sessionToken, fetchImpl);
    } catch (error) {
      view.removeAttribute('aria-busy');
      if (!live(current)) return;
      if (error?.status === 401) { view.replaceChildren(loginNotice()); return; }
      const box = node('section', 'lotbi-mychild-state'); box.dataset.myChildState = 'UNAVAILABLE';
      box.append(node('p', '', error?.message || UNAVAILABLE_NOTE), button('다시 불러오기', () => void renderHome()));
      view.replaceChildren(box);
      return;
    }
    view.removeAttribute('aria-busy');
    if (!live(current)) return;
    say(message);
    const intro = node('p', 'lotbi-mychild-intro', '아이가 다니는 학교·유치원을 저장하면 급식·학사일정·기본정보를 바로 보여 드려요.');
    const children = [intro];
    if (listing.entries.length) {
      const list = node('ul', 'lotbi-mychild-list');
      for (const entry of listing.entries) {
        const item = node('li');
        const card = node('button', 'lotbi-mychild-card'); card.type = 'button'; card.dataset.myChildEntry = entry.id;
        const top = node('span', 'lotbi-mychild-card-top');
        top.append(node('strong', '', entry.nickname), node('span', 'lotbi-mychild-badge', entry.kind === 'SCHOOL' ? '학교' : '유치원'));
        card.append(top, node('span', 'lotbi-mychild-card-line',
          entry.institution?.name || (entry.institutionStatus === 'NOT_FOUND' ? '기관 정보를 찾지 못했어요' : '기관 정보를 지금 확인하지 못했어요')));
        const allergy = allergenSummary(entry.allergens);
        if (allergy) card.append(node('span', 'lotbi-mychild-card-line', `알레르기 표시: ${allergy}`));
        card.addEventListener('click', () => void renderOverview(entry));
        item.append(card); list.append(item);
      }
      children.push(list);
    } else {
      const empty = node('section', 'lotbi-mychild-empty');
      empty.append(node('h4', '', '아직 저장한 학교·유치원이 없어요'),
        node('p', '', '학교는 NEIS, 유치원은 교육부 유치원알리미에서 찾아 저장해요.'));
      children.push(empty);
    }
    const full = listing.entries.length >= listing.maxEntries;
    const add = button('학교·유치원 추가', () => renderAdd(), 'consumer-action');
    add.dataset.myChildAdd = ''; add.disabled = full;
    children.push(add);
    if (full) children.push(node('p', 'lotbi-mychild-hint', `최대 ${listing.maxEntries}곳까지 저장할 수 있어요.`));
    const footer = node('div', 'lotbi-mychild-footer');
    footer.append(node('p', 'consumer-feature-note', PRIVACY_NOTE));
    if (listing.entries.length) {
      const clear = button('모두 삭제', null);
      clear.dataset.myChildDeleteAll = '';
      let armed = false;
      clear.addEventListener('click', async () => {
        if (!armed) { armed = true; clear.textContent = '정말 모두 삭제'; say('한 번 더 누르면 저장한 학교·유치원과 알레르기 설정이 모두 지워져요.'); return; }
        clear.disabled = true;
        try {
          await deleteAllMyChildren(sessionToken, fetchImpl);
          if (!disposed) void renderHome('모두 삭제했어요. 다시 저장할 때 저장 안내에 동의를 다시 받아요.');
        } catch (error) { clear.disabled = false; failed(error, generation, '삭제하지 못했어요.'); }
      });
      footer.append(clear);
    }
    children.push(footer);
    view.replaceChildren(...children);
  }

  // ------------------------------------------------------------- add ----
  function renderAdd() {
    const current = ++generation;
    say('');
    const back = button('목록으로', () => void renderHome());
    back.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    const title = node('h4', 'lotbi-mychild-title', '학교·유치원 추가'); title.tabIndex = -1;
    const tabs = node('div', 'consumer-tabs lotbi-mychild-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '기관 종류');
    const panel = node('div', 'lotbi-mychild-panel'); panel.setAttribute('role', 'tabpanel'); panel.id = 'lotbi-mychild-add-panel';
    const tabButtons = [['SCHOOL', '학교', 'NEIS'], ['KINDERGARTEN', '유치원', '유치원알리미']].map(([value, label, sub]) => {
      const tab = node('button', 'lotbi-edu-tab');
      tab.type = 'button'; tab.id = `lotbi-mychild-tab-${value}`; tab.dataset.myChildTab = value;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
      tab.append(node('span', 'lotbi-edu-tab-label', label), node('span', 'lotbi-edu-tab-sub', sub));
      tab.addEventListener('click', () => select(value));
      return tab;
    });
    tabs.append(...tabButtons);
    view.replaceChildren(back, title, tabs, panel);
    title.focus();

    function select(kind) {
      if (!live(current)) return;
      for (const tab of tabButtons) {
        const active = tab.dataset.myChildTab === kind;
        tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', `lotbi-mychild-tab-${kind}`);
      if (kind === 'SCHOOL') renderSchoolSearch(); else void renderKindergartenSearch();
    }

    function results(items, describe, onPick) {
      const list = node('ul', 'lotbi-mychild-results');
      for (const item of items) {
        const entry = node('li');
        const pick = node('button', 'lotbi-mychild-card'); pick.type = 'button';
        const top = node('span', 'lotbi-mychild-card-top');
        top.append(node('strong', '', item.name));
        const [badge, line] = describe(item);
        if (badge) top.append(node('span', 'lotbi-mychild-badge', badge));
        pick.append(top, node('span', 'lotbi-mychild-card-line', line || '주소 미확인'));
        pick.addEventListener('click', () => onPick(item));
        entry.append(pick); list.append(entry);
      }
      return list;
    }

    function renderSchoolSearch() {
      const form = node('form', 'consumer-life-form lotbi-mychild-search');
      const label = node('label', 'consumer-life-field', '학교 이름');
      const input = node('input'); input.type = 'search'; input.maxLength = 40; input.minLength = 2;
      input.placeholder = '예: 전주서원초'; input.dataset.myChildSchoolQuery = ''; input.setAttribute('aria-label', '학교 이름');
      label.append(input);
      const send = node('button', 'consumer-action', '학교 찾기'); send.type = 'submit';
      const note = node('p', 'lotbi-mychild-status'); note.setAttribute('role', 'status');
      const found = node('div', 'lotbi-mychild-found');
      form.append(label, send);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const query = input.value.replace(/\s+/gu, ' ').trim();
        if (query.length < 2) { note.textContent = '학교 이름을 두 글자 이상 적어 주세요.'; input.focus(); return; }
        note.textContent = 'NEIS에서 찾고 있어요.'; found.replaceChildren(); send.disabled = true;
        try {
          const result = await searchSchools(sessionToken, query, fetchImpl);
          if (!live(current)) return;
          note.textContent = result.schools.length
            ? `NEIS 학교 ${result.schools.length}곳${result.truncated ? ' (일부만 보여요. 지역을 붙여 찾아 보세요)' : ''}`
            : 'NEIS에서 학교를 찾지 못했어요. 이름을 바꿔 보세요.';
          found.replaceChildren(results(result.schools, school => [school.kind, school.address || school.region],
            school => renderSaveForm({kind: 'SCHOOL', school})));
        } catch (error) {
          if (live(current)) { if (error?.status === 401) { view.replaceChildren(loginNotice()); return; } note.textContent = error?.message || UNAVAILABLE_NOTE; }
        } finally { send.disabled = false; }
      });
      panel.replaceChildren(node('p', 'lotbi-edu-intro', '초·중·고·특수학교는 교육부 NEIS에서 찾아요.'), form, note, found,
        node('p', 'lotbi-mychild-source', '출처: NEIS'));
    }

    async function renderKindergartenSearch() {
      panel.replaceChildren(node('p', 'consumer-feature-note', '유치원알리미 지역 목록을 불러오고 있어요.'));
      const catalog = await fetchKindergartenRegions(fetchImpl);
      if (!live(current)) return;
      if (!catalog) { panel.replaceChildren(node('p', 'lotbi-mychild-state', UNAVAILABLE_NOTE)); return; }
      if (!catalog.enabled) {
        panel.replaceChildren(node('p', 'lotbi-mychild-state', '유치원 공식정보 연결을 준비하고 있어요. 지금은 학교만 저장할 수 있어요.'));
        return;
      }
      const form = node('form', 'consumer-life-form lotbi-mychild-search');
      const row = node('div', 'lotbi-mychild-region');
      const sidoLabel = node('label', 'consumer-life-field', '시·도');
      const sido = node('select'); sido.setAttribute('aria-label', '시·도'); sido.dataset.myChildSido = '';
      const sggLabel = node('label', 'consumer-life-field', '시·군·구');
      const sgg = node('select'); sgg.setAttribute('aria-label', '시·군·구'); sgg.dataset.myChildSgg = '';
      sido.append(new Option('시·도 선택', ''));
      for (const item of catalog.regions) sido.append(new Option(item.sidoName, item.sidoCode));
      const fill = () => {
        sgg.replaceChildren(new Option('시·군·구 선택', ''));
        for (const item of catalog.regions.find(entry => entry.sidoCode === sido.value)?.sggs || []) sgg.append(new Option(item.name, item.code));
      };
      sido.addEventListener('change', fill); fill();
      sidoLabel.append(sido); sggLabel.append(sgg); row.append(sidoLabel, sggLabel);
      const nameLabel = node('label', 'consumer-life-field', '유치원 이름 (선택)');
      const name = node('input'); name.type = 'text'; name.maxLength = 30; name.placeholder = '예: 예일';
      name.setAttribute('aria-label', '유치원 이름'); name.dataset.myChildKinderQuery = '';
      nameLabel.append(name);
      const send = node('button', 'consumer-action', '유치원 찾기'); send.type = 'submit';
      const note = node('p', 'lotbi-mychild-status'); note.setAttribute('role', 'status');
      const found = node('div', 'lotbi-mychild-found');
      form.append(row, nameLabel, send);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!sgg.value) { note.textContent = '시·군·구를 먼저 골라 주세요.'; (sido.value ? sgg : sido).focus(); return; }
        note.textContent = '유치원알리미에서 찾고 있어요.'; found.replaceChildren(); send.disabled = true;
        const result = await searchKindergartens({sggCode: sgg.value, q: name.value}, fetchImpl);
        send.disabled = false;
        if (!live(current)) return;
        if (result.status === 'RATE_LIMITED') { note.textContent = '조회가 많아요. 잠시 후 다시 찾아 주세요.'; return; }
        if (result.status !== 'OK') { note.textContent = UNAVAILABLE_NOTE; return; }
        note.textContent = result.items.length ? `유치원 ${result.items.length}곳 (유치원알리미 공시 기준)` : '조건에 맞는 유치원을 찾지 못했어요.';
        found.replaceChildren(results(result.items, item => [item.establishment, item.address],
          kindergarten => renderSaveForm({kind: 'KINDERGARTEN', kindergarten})));
      });
      panel.replaceChildren(node('p', 'lotbi-edu-intro', '유치원은 교육부 유치원알리미 공시에서 찾아요. 어린이집은 대상이 아니에요.'), form, note, found,
        node('p', 'lotbi-mychild-source', '출처: 교육부 유치원알리미'));
    }

    function renderSaveForm(choice) {
      if (!live(current)) return;
      const chosen = choice.kind === 'SCHOOL' ? choice.school : choice.kindergarten;
      const form = node('form', 'consumer-life-form lotbi-mychild-save');
      form.dataset.myChildSave = choice.kind;
      const summary = node('div', 'lotbi-mychild-chosen');
      summary.append(node('strong', '', chosen.name), node('span', 'lotbi-mychild-card-line',
        choice.kind === 'SCHOOL' ? [chosen.kind, chosen.address].filter(Boolean).join(' · ') : [chosen.establishment, chosen.address].filter(Boolean).join(' · ')));
      const nick = nicknameField(nextNickname(listing?.entries || []));
      const picker = allergenPicker(listing?.allergenCatalog || []);
      form.append(summary, nick.label, picker.fieldset);
      let consent = null;
      if (!listing?.consent?.accepted) {
        const box = node('div', 'lotbi-mychild-consent');
        box.dataset.myChildConsent = listing?.consent?.version || '';
        const label = node('label', 'lotbi-mychild-consent-check');
        // Checked on submit with the screen's own wording (not the browser's).
        consent = node('input'); consent.type = 'checkbox'; consent.dataset.myChildConsentCheck = '';
        label.append(consent, node('span', '', listing?.consent?.text || '자녀가 다니는 기관과 알레르기 표시 설정을 저장합니다, 언제든 삭제 가능.'));
        box.append(label);
        form.append(box);
      }
      const save = node('button', 'consumer-action', '저장하기'); save.type = 'submit'; save.dataset.myChildSubmit = '';
      const note = node('p', 'lotbi-mychild-status'); note.setAttribute('role', 'status');
      form.append(save, note, node('p', 'lotbi-mychild-hint', PRIVACY_NOTE));
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const nickname = nick.input.value.replace(/\s+/gu, ' ').trim();
        if (!nickname) { note.textContent = '부르는 이름을 적어 주세요.'; nick.input.focus(); return; }
        if (consent && !consent.checked) { note.textContent = '처음 저장할 때는 저장 안내에 동의해 주세요.'; consent.focus(); return; }
        const consentVersion = consent ? listing?.consent?.version || '' : '';
        const body = choice.kind === 'SCHOOL'
          ? schoolSaveBody({officeCode: chosen.officeCode, schoolCode: chosen.schoolCode, nickname, allergenCodes: picker.values(), consentVersion})
          : kindergartenSaveBody({kinderCode: chosen.kinderCode, sggCode: chosen.sggCode, nickname, allergenCodes: picker.values(), consentVersion});
        save.disabled = true; note.textContent = '저장하고 있어요.';
        try {
          const entry = await saveMyChild(sessionToken, body, fetchImpl);
          if (disposed) return;
          await renderHome(`${entry?.nickname || nickname}을(를) 저장했어요.`);
          const saved = listing?.entries.find(item => item.id === entry?.id);
          if (saved && !disposed) void renderOverview(saved);
        } catch (error) {
          save.disabled = false;
          if (disposed) return;
          if (error?.status === 401) { view.replaceChildren(loginNotice()); return; }
          note.textContent = error?.message || '저장하지 못했어요.';
          if (error?.field === 'nickname') nick.input.focus();
        }
      });
      const backToSearch = button('다시 찾기', () => select(choice.kind));
      panel.replaceChildren(backToSearch, form);
      nick.input.focus();
    }

    select('SCHOOL');
  }

  // -------------------------------------------------------- overview ----
  function mealBlock(meal) {
    const block = node('section', 'lotbi-mychild-meal');
    block.dataset.myChildMeal = meal.date;
    const head = node('div', 'lotbi-mychild-meal-head');
    head.append(node('strong', '', meal.mealName));
    if (meal.calories) head.append(node('span', 'lotbi-mychild-meal-meta', meal.calories));
    if (meal.sourceType === 'STAFF_FALLBACK') head.append(node('span', 'lotbi-mychild-badge', meal.sourceLabel || '직원 확인 정보'));
    const list = node('ul', 'lotbi-mychild-dishes');
    for (const dish of meal.dishes) {
      const item = node('li', `lotbi-mychild-dish${dish.matched.length ? ' is-allergen' : ''}`);
      item.append(node('span', 'lotbi-mychild-dish-name', dish.name));
      if (meal.numbered && dish.allergens.length) {
        const marks = node('span', 'lotbi-mychild-dish-marks', dish.allergens.map(code => ALLERGEN_MARKS[code] || String(code)).join(''));
        marks.setAttribute('aria-label', `알레르기 ${dish.allergens.join(', ')}번`);
        item.append(marks);
      }
      if (dish.matched.length) {
        item.dataset.myChildAllergenHit = dish.matched.map(hit => hit.code).join(',');
        item.append(node('span', 'lotbi-mychild-contains', dish.containsText || `${dish.matched.map(hit => hit.name).join('·')} 포함`));
      }
      list.append(item);
    }
    block.append(head, list);
    if (meal.allergyText) block.append(node('p', 'lotbi-mychild-hint', `알레르기 정보(학교 자료 그대로): ${meal.allergyText}`));
    return block;
  }

  function mealsSection(overview) {
    const section = node('section', 'lotbi-mychild-section');
    section.dataset.myChildSection = 'meals';
    section.append(node('h5', '', `오늘 급식${overview.today ? ` · ${formatDayLabel(overview.today)}` : ''}`));
    const meals = overview.meals;
    if (!meals || meals.status === 'UNAVAILABLE') {
      section.append(node('p', 'lotbi-mychild-state', `NEIS 급식을 ${UNAVAILABLE_NOTE}`));
      return section;
    }
    if (meals.today.length) for (const meal of meals.today) section.append(mealBlock(meal));
    else section.append(node('p', 'lotbi-mychild-empty-line', '오늘은 급식 정보가 없어요.'));
    if (meals.days.length) {
      const week = node('details', 'lotbi-mychild-week');
      week.append(node('summary', '', `이번 주 급식 (${formatPeriod(meals.from, meals.to)})`));
      for (const day of meals.days) {
        const dayBox = node('div', 'lotbi-mychild-day');
        dayBox.append(node('h6', '', formatDayLabel(day.date)));
        for (const meal of day.meals) dayBox.append(mealBlock(meal));
        week.append(dayBox);
      }
      section.append(week);
    } else if (meals.status === 'NONE') {
      section.append(node('p', 'lotbi-mychild-empty-line', '이번 주 NEIS 급식 정보가 없어요.'));
    }
    if (meals.status === 'PARTIAL') section.append(node('p', 'lotbi-mychild-hint', 'NEIS 급식을 지금 확인하지 못해 직원 보완 급식만 보여요.'));
    const hasAllergens = overview.entry.allergens.length > 0;
    section.append(node('p', 'lotbi-mychild-hint', hasAllergens
      ? `${ALLERGY_BASIS_NOTE} 표시한 알레르기: ${allergenSummary(overview.entry.allergens)}`
      : `알레르기를 고르면 해당 메뉴를 강조해 드려요. ${ALLERGY_BASIS_NOTE}`));
    return section;
  }

  function linksSection(overview) {
    const section = node('div', 'lotbi-mychild-links');
    const links = [['학교 홈페이지', overview.links.homepage], ['급식표 보기', overview.links.mealSource]].filter(([, href]) => href);
    for (const [label, href] of links) {
      const link = node('a', 'consumer-action consumer-action-secondary', label);
      link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
      section.append(link);
    }
    return links.length ? section : null;
  }

  function scheduleSection(overview) {
    const section = node('section', 'lotbi-mychild-section');
    section.dataset.myChildSection = 'schedule';
    section.append(node('h5', '', '학사일정 · 방학·재량휴업일·개학'));
    const schedule = overview.schedule;
    if (schedule.status === 'UNAVAILABLE') { section.append(node('p', 'lotbi-mychild-state', `NEIS 학사일정을 ${UNAVAILABLE_NOTE}`)); return section; }
    if (!schedule.items.length) {
      section.append(node('p', 'lotbi-mychild-empty-line', schedule.status === 'NONE'
        ? `${formatPeriod(schedule.from, schedule.to)} NEIS 학사일정이 없어요.`
        : `${formatPeriod(schedule.from, schedule.to)}에는 방학·재량휴업일·개학 일정이 없어요.`));
    } else {
      const list = node('ul', 'lotbi-mychild-schedule');
      for (const item of schedule.items) {
        const row = node('li'); row.dataset.myChildSchedule = item.type;
        // "재량휴업일" names itself; "가을방학" / "여름개학식" get their kind first.
        if (item.typeLabel && item.typeLabel !== item.name) row.append(node('span', 'lotbi-mychild-badge', item.typeLabel));
        row.append(node('strong', '', item.name), node('span', 'lotbi-mychild-schedule-when', formatPeriod(item.start, item.end)));
        list.append(row);
      }
      section.append(list);
    }
    if (schedule.truncated) section.append(node('p', 'lotbi-mychild-hint', 'NEIS 응답이 일부만 와서 빠진 일정이 있을 수 있어요.'));
    return section;
  }

  function gapSection(overview, entry) {
    const items = ['MEAL', 'HOMEPAGE', 'SCHEDULE'].filter(item => overview.requestable.includes(item) || overview.infoRequests[item] === 'PENDING');
    if (!items.length) return null;
    const section = node('section', 'lotbi-mychild-gap');
    section.dataset.myChildSection = 'info-request';
    section.append(node('h5', '', 'NEIS에 없는 정보'),
      node('p', 'lotbi-mychild-hint', '비어 있는 정보는 LOTBI 직원에게 보완을 요청할 수 있어요. 요청한 사람은 직원에게 보이지 않아요.'));
    const list = node('ul', 'lotbi-mychild-gap-list');
    for (const item of items) {
      const row = node('li'); row.dataset.myChildGap = item;
      row.append(node('span', '', INFO_ITEM_LABELS[item]));
      if (overview.infoRequests[item] === 'PENDING') {
        row.append(node('span', 'lotbi-mychild-badge', '요청함'));
      } else {
        const ask = button('정보 보완 요청', async () => {
          ask.disabled = true;
          try {
            const result = await requestInfo(sessionToken, entry.id, [item], fetchImpl);
            if (disposed) return;
            const outcome = result.results[item];
            say(outcome === 'REQUESTED' || outcome === 'ALREADY_REQUESTED'
              ? `${INFO_ITEM_LABELS[item]} 보완을 요청했어요. 직원이 확인하면 이 화면에 보여요.`
              : `${INFO_ITEM_LABELS[item]} 정보가 지금은 NEIS에 있어요. 화면을 새로 불러올게요.`);
            void renderOverview(entry, {keepStatus: true});
          } catch (error) { ask.disabled = false; failed(error, generation, '요청하지 못했어요.'); }
        });
        ask.dataset.myChildRequest = item;
        row.append(ask);
      }
      list.append(row);
    }
    section.append(list);
    return section;
  }

  function kindergartenSection(overview) {
    const section = node('section', 'lotbi-mychild-section');
    section.dataset.myChildSection = 'kindergarten';
    if (overview.status === 'DISABLED') { section.append(node('p', 'lotbi-mychild-state', '유치원 공식정보 연결을 준비하고 있어요.')); return section; }
    if (overview.status === 'NOT_FOUND' || !overview.kindergarten) {
      section.append(node('p', 'lotbi-mychild-state', overview.status === 'NOT_FOUND' ? '유치원알리미 공시에서 이 유치원을 찾지 못했어요.' : `유치원알리미 정보를 ${UNAVAILABLE_NOTE}`));
      return section;
    }
    const k = overview.kindergarten;
    const facts = node('dl', 'lotbi-mychild-facts');
    const fact = (label, value, href = '') => {
      const row = node('div', 'lotbi-mychild-fact');
      const data = node('dd');
      if (href && value) { const link = node('a', '', value); link.href = href; if (/^https?:/u.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } data.append(link); }
      else data.textContent = value || '미확인';
      row.append(node('dt', '', label), data); facts.append(row);
    };
    fact('설립유형', k.establishment);
    fact('주소', k.address);
    fact('연락처', k.phone, telHref(k.phone));
    fact('운영시간', k.hours);
    fact('홈페이지', k.homepage ? k.homepage.replace(/^https?:\/\//u, '').replace(/\/$/u, '') : '', k.homepage);
    fact('관할', k.officeEdu);
    fact('공시 기준', k.disclosureLabel);
    section.append(node('h5', '', '기본정보'), facts);
    const ask = button('대화로 더 물어보기', () => onAsk?.(`${k.area ? `${k.area.replace(/^\S+\s+/u, '')} ` : ''}${k.name} 알려줘`));
    section.append(ask);
    return section;
  }

  async function renderOverview(entry, {keepStatus = false} = {}) {
    const current = ++generation;
    if (!keepStatus) say('');
    const back = button('목록으로', () => void renderHome());
    back.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    const title = node('h4', 'lotbi-mychild-title', entry.nickname); title.tabIndex = -1;
    view.setAttribute('aria-busy', 'true');
    view.replaceChildren(back, title, node('p', 'consumer-feature-note', '정보를 불러오고 있어요.'));
    title.focus();
    let overview;
    try {
      overview = await fetchOverview(sessionToken, entry.id, fetchImpl);
    } catch (error) {
      view.removeAttribute('aria-busy');
      if (!live(current)) return;
      if (error?.status === 401) { view.replaceChildren(loginNotice()); return; }
      if (error?.status === 404) { void renderHome('저장한 항목을 찾지 못했어요.'); return; }
      view.replaceChildren(back, title, node('p', 'lotbi-mychild-state', error?.message || UNAVAILABLE_NOTE),
        button('다시 불러오기', () => void renderOverview(entry)));
      return;
    }
    view.removeAttribute('aria-busy');
    if (!live(current)) return;
    const current_entry = overview.entry;
    const name = overview.school?.name || overview.kindergarten?.name || entry.institution?.name || '';
    title.textContent = current_entry.nickname;
    const sub = node('p', 'lotbi-mychild-subtitle', [name, current_entry.kind === 'SCHOOL' ? overview.school?.kindLabel || '학교' : '유치원']
      .filter(Boolean).join(' · '));
    const actions = node('div', 'lotbi-mychild-actions');
    const edit = button('이름·알레르기 바꾸기', () => renderEdit(current_entry));
    edit.dataset.myChildEdit = '';
    const remove = button('삭제', null);
    remove.dataset.myChildDelete = '';
    let armed = false;
    remove.addEventListener('click', async () => {
      if (!armed) { armed = true; remove.textContent = '정말 삭제'; say('한 번 더 누르면 이 항목과 알레르기 설정이 지워져요.'); return; }
      remove.disabled = true;
      try {
        await deleteMyChild(sessionToken, current_entry.id, fetchImpl);
        if (!disposed) void renderHome(`${current_entry.nickname}을(를) 삭제했어요.`);
      } catch (error) { remove.disabled = false; failed(error, generation, '삭제하지 못했어요.'); }
    });
    actions.append(edit, remove);
    const parts = [back, title, sub, actions];
    if (current_entry.kind === 'SCHOOL') {
      if (overview.status === 'NOT_FOUND') {
        parts.push(node('p', 'lotbi-mychild-state', 'NEIS에서 이 학교를 찾지 못했어요. 학교가 바뀌었다면 삭제한 뒤 다시 저장해 주세요.'));
      } else {
        if (overview.status === 'UNAVAILABLE') parts.push(node('p', 'lotbi-mychild-state', `NEIS 학교 정보를 ${UNAVAILABLE_NOTE}`));
        parts.push(mealsSection(overview));
        const links = linksSection(overview);
        if (links) parts.push(links);
        parts.push(scheduleSection(overview));
        const gap = gapSection(overview, current_entry);
        if (gap) parts.push(gap);
      }
      parts.push(sourceLine(overview.source, '출처: NEIS'));
    } else {
      parts.push(kindergartenSection(overview), sourceLine(overview.source, '교육부 유치원알리미'));
    }
    view.replaceChildren(...parts);
  }

  // ------------------------------------------------------------ edit ----
  function renderEdit(entry) {
    const current = ++generation;
    say('');
    const back = button('취소', () => void renderOverview(entry));
    back.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    const title = node('h4', 'lotbi-mychild-title', `${entry.nickname} 바꾸기`); title.tabIndex = -1;
    const form = node('form', 'consumer-life-form lotbi-mychild-save');
    form.dataset.myChildEditForm = entry.id;
    const nick = nicknameField(entry.nickname);
    const picker = allergenPicker(listing?.allergenCatalog || [], entry.allergens.map(item => item.code));
    const save = node('button', 'consumer-action', '저장하기'); save.type = 'submit';
    const note = node('p', 'lotbi-mychild-status'); note.setAttribute('role', 'status');
    form.append(nick.label, picker.fieldset, save, note);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const nickname = nick.input.value.replace(/\s+/gu, ' ').trim();
      if (!nickname) { note.textContent = '부르는 이름을 적어 주세요.'; nick.input.focus(); return; }
      save.disabled = true;
      try {
        const updated = await updateMyChild(sessionToken, entry.id, {nickname, allergenCodes: picker.values()}, fetchImpl);
        if (!live(current)) return;
        if (listing) listing = {...listing, entries: listing.entries.map(item => item.id === entry.id && updated ? updated : item)};
        say('바꿨어요.');
        void renderOverview(updated || entry, {keepStatus: true});
      } catch (error) {
        save.disabled = false;
        if (!live(current)) return;
        if (error?.status === 401) { view.replaceChildren(loginNotice()); return; }
        note.textContent = error?.message || '저장하지 못했어요.';
      }
    });
    view.replaceChildren(back, title, form);
    title.focus();
  }

  void renderHome();
  return {dispose() { disposed = true; generation += 1; }};
}
