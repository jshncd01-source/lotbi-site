import {mountLifeWallet} from './site-life-wallet.js?v=aset-934415c7da50';
import {createJeonbukFoodForm} from './site-life-regional.js?v=aset-934415c7da50';

// Presentation only. Actions delegate to the existing feature owners; this
// module never uploads identity documents or invents account/connection data.
// onAsk(text) hands a finished question to the conversation, which sends it
// right away: one tap asks LOTBI, with nothing to confirm or send again.
//
// LIFE-MEDICAL-AUTO-SEARCH-01 — 병원·약국·응급실 have no form. The tap sends a
// fixed question the existing Core medical route (국립중앙의료원 data) reads as
// "nearby"; the existing life-location contract (site-life-location.js) then
// sends the current location (location use on and permitted), else the saved
// region, else nothing so Core asks for a region. Conditions such as 지금 ·
// 야간 · 휴일 · 24시간 are offered on the pharmacy results, not asked first.
export const LIFE_MEDICAL_QUESTIONS = Object.freeze({
  hospital: '근처 병원 찾아줘',
  pharmacy: '근처 약국 찾아줘',
  emergency: '근처 응급실 찾아줘',
});
// REGIONAL-INFO-APPROVED-UX-RESTORE-P0 — the approved 지역정보 menu: one
// 병원·응급실 card opens a two-way choice (병원·의원 찾기 / 응급실 찾기, each the
// existing medical question), 약국 stays its own card and asks at once, and the
// separate 유치원·학교 card is gone (owner decision 2026-10-10): 내 아이 학교·유치원
// is the one education card and opens 내 아이 정보 (signed-in, MY-CHILD-SCHOOL-01)
// or 유치원·학교 찾기 (the public lookup, KINDERGARTEN-OFFICIAL-INFO-01).
// Eight cards with 전북 맛집·음식: every row of two is full (an odd count would
// let the last card span its row, site-consumer-design.css).
// REAL-ESTATE-REGION-FAVORITES-P0 adds 부동산 실거래가 after 온누리상품권: its own
// list screen (site-life-real-estate.js, route real-estate), never a question
// to the conversation. Nine cards: the odd last card spans its row.
export const LIFE_MEDICAL_CHOICES = Object.freeze([
  Object.freeze({id: 'hospital', label: '병원·의원 찾기'}),
  Object.freeze({id: 'emergency', label: '응급실 찾기'}),
]);
export const LIFE_CHILD_CHOICES = Object.freeze([
  Object.freeze({id: 'my-child', label: '내 아이 정보'}),
  Object.freeze({id: 'education', label: '유치원·학교 찾기'}),
]);
export const LIFE_SHORTCUTS = Object.freeze([
  {id: 'medical', label: '병원·응급실', icon: 'hospital', choices: LIFE_MEDICAL_CHOICES},
  {id: 'pharmacy', label: '약국', icon: 'pharmacy', ask: LIFE_MEDICAL_QUESTIONS.pharmacy},
  {id: 'festivals', label: '축제·행사', icon: 'calendar'},
  // REGIONAL-NEWS-SCREEN-LIST-01: lists 광역시·도 news titles itself (site-life-news.js).
  {id: 'news', label: '지역뉴스', icon: 'news'},
  // ONNURI-MERCHANT-01: its own search surface (site-life-onnuri.js). The
  // official logo is not used before approval; brandSlot reserves its place.
  {id: 'onnuri', label: '온누리상품권', brandSlot: 'onnuri'},
  // REAL-ESTATE-REGION-FAVORITES-P0: 국토교통부 실거래가 list + 관심 아파트, no chat.
  {id: 'real-estate', label: '부동산 실거래가', icon: 'building'},
  {id: 'local', label: '지역생활정보', icon: 'pin', prompt: '우리 지역 생활정보를 알려 줘'},
  // JEONBUK-PILOT-01: 전북특별자치도·전주시 공식 음식점 공공데이터 (Core regional_food).
  {id: 'jeonbuk-food', label: '전북 맛집·음식', icon: 'food', regionalFood: true},
  // MY-CHILD-SCHOOL-01 + KINDERGARTEN-OFFICIAL-INFO-01 behind one card. Last.
  {id: 'my-child', label: '내 아이 학교·유치원', icon: 'backpack', children: LIFE_CHILD_CHOICES},
]);

// Each existing request form should show examples that belong to that service,
// not a mixed café/grant example repeated across every detail page.
const LIFE_DETAIL_FIELDS = Object.freeze({
  weather: [['지역 또는 장소', '예: 전주시 덕진구']],
  places: [['지역 또는 장소', '예: 전주시'], ['찾고 싶은 장소', '예: 한옥마을 근처 주차장']],
  directions: [['출발지', '예: 서울역'], ['목적지', '예: 전주 한옥마을']],
  facilities: [['지역 또는 장소', '예: 전주시 덕진구'], ['찾고 싶은 시설', '예: 주차 가능한 카페, 야간 약국']],
  local: [['지역 또는 장소', '예: 전주시 덕진구'], ['궁금한 생활정보', '예: 쓰레기 배출일, 주민센터 운영시간']],
  support: [['지역 또는 장소', '예: 전주시'], ['찾고 싶은 지원', '예: 청년 주거 지원, 자녀 돌봄 지원']],
});

const ICON_PATHS = {
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  route: ['M5 6h10a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10', 'M2 6a3 3 0 1 0 6 0 3 3 0 0 0-6', 'm16 19 3 3 3-3'],
  store: ['M3 10h18l-2-7H5l-2 7Z', 'M5 10v11h14V10M9 21v-7h6v7'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z', 'M7 2v4m10-4v4M3 10h18M7 14h3m4 0h3M7 17h3'],
  document: ['M6 2h8l4 4v16H6V2Z', 'M14 2v5h4M9 12h6m-6 4h6'],
  wallet: ['M3 6V4h16v4M3 6h18v15H3V6Z', 'M16 11h5v5h-5v-5Z'],
  people: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M19 8a3 3 0 0 1 0 6m0 2a4 4 0 0 1 3 4v1'],
  shield: ['m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6l8-4Z', 'm8 12 3 3 5-6'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2'],
  hospital: ['M4 3h16v18H4V3Z', 'M12 7v8M8 11h8'],
  pharmacy: ['M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7l7-7Z', 'm7 10 7 7'],
  emergency: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 8v8M8 12h8'],
  news: ['M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5Z', 'M17 9h3v10a2 2 0 0 1-2 2', 'M7 9h7M7 12h7M7 15h4'],
  food: ['M6 2v7a2 2 0 0 0 4 0V2M8 2v20', 'M18 22V2c-2.2 1.4-3.5 4.2-3.5 7.5V14H18'],
  school: ['m2 9 10-5 10 5-10 5L2 9Z', 'M6 11v5c3 2.5 9 2.5 12 0v-5', 'M22 9v6'],
  backpack: ['M9 6V5a3 3 0 0 1 6 0v1', 'M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v12H6V9Z', 'M9 13h6v4H9v-4Z'],
  building: ['M4 21V8l6-4v17', 'M10 21V9h10v12', 'M2 21h20', 'M13 12h1m3 0h1m-5 4h1m3 0h1M6.5 10h1m-1 4h1'],
};

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  for (const value of ICON_PATHS[name] || ICON_PATHS.document) {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', value); svg.append(path);
  }
  return svg;
}
// Reserved place for an approved partner logo. Renders nothing until then.
function brandSlot(name) {
  const slot = node('i', `${name}-logo-slot`);   // not a <span>: the label stays the tile's first span
  slot.dataset.brandLogoSlot = name; slot.dataset.logoState = 'PENDING_APPROVAL';
  slot.setAttribute('aria-hidden', 'true');
  return slot;
}
function action(label, run, {secondary = false, disabled = false} = {}) {
  const button = node('button', `consumer-action${secondary ? ' consumer-action-secondary' : ''}`, label);
  button.type = 'button'; button.disabled = disabled;
  if (run) button.addEventListener('click', run);
  return button;
}
function empty(title, copy, glyph) {
  const section = node('section', 'consumer-empty');
  section.append(icon(glyph), node('h3', '', title), node('p', '', copy));
  return section;
}

export function mountConsumerSection({section, root, onAsk, onFestival, onOnnuri, onRealEstate, loadCareCounts, mountPeople, mountPets, mountMyChild, careTab = 'people', onCareTab, authenticated = false, accountId = '', sessionExpiresAt = '', sessionToken = ''} = {}) {
  root.classList.add('consumer-section-content');
  root.dataset.consumerSurface = section;
  let disposed = false;
  let generation = 0;
  let releasePeople;
  let releasePets;
  let releaseWallet;
  let releaseEducation;
  let releaseNews;
  let releaseMyChild;

  if (section === 'life') {
    // The life home only picks a category: free questions belong to the main
    // chat, and saved items are not duplicated here.
    const grid = node('div', 'consumer-shortcuts');
    function openLifeDetail(item) {
      const back = action('지역정보로 돌아가기', () => {
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${item.id}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      const title = node('h3', '', item.label); title.tabIndex = -1;
      if (item.regionalFood) {
        // The question goes through the same life handoff (onAsk) as every
        // other 생활정보 form; Core answers it from the official 전북 data.
        const {form: foodForm, note} = createJeonbukFoodForm(document, {onSubmit: text => { if (!disposed) onAsk(text); }});
        detail.dataset.lifeDetail = item.id;
        detail.append(back, title, foodForm, node('p', 'consumer-feature-note', note));
        root.replaceChildren(detail); title.focus();
        return;
      }
      const queryForm = node('form', 'consumer-life-form');
      const controls = [];
      const fields = LIFE_DETAIL_FIELDS[item.id];
      for (const [labelText, placeholder] of fields) {
        const label = node('label', 'consumer-life-field', labelText);
        const field = node('input'); field.type = 'text';
        field.placeholder = placeholder; field.maxLength = 1000; field.required = true;
        field.setAttribute('aria-label', labelText); label.append(field); controls.push([labelText, field]); queryForm.append(label);
      }
      const send = action('롯비에게 물어보기'); send.type = 'submit'; queryForm.append(send);
      queryForm.addEventListener('submit', event => {
        event.preventDefault();
        if (disposed) return;
        const missing = controls.find(([, field]) => !field.value.trim());
        if (missing) { missing[1].focus(); return; }
        onAsk([item.prompt, ...controls.map(([label, field]) => `${label}: ${field.value.trim()}`)].join('\n'));
      });
      const note = '누르면 바로 롯비에게 물어봐요. 현재 위치는 자동으로 수집하지 않습니다.';
      detail.append(back, title, queryForm, node('p', 'consumer-feature-note', note));
      root.replaceChildren(detail); title.focus();
    }
    // 병원·응급실: nothing is asked until the reader picks 병원·의원 or 응급실;
    // the pick sends that existing medical question once.
    function openMedicalChoice(item) {
      const back = action('지역정보로 돌아가기', () => {
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${item.id}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const choices = node('div', 'consumer-life-choices');
      let asked = false;
      for (const choice of item.choices) {
        const button = action(choice.label, () => {
          if (disposed || asked) return;
          asked = true;
          onAsk(LIFE_MEDICAL_QUESTIONS[choice.id]);
        });
        button.dataset.medicalChoice = choice.id;
        choices.append(button);
      }
      detail.append(back, title, choices);
      root.replaceChildren(detail); title.focus();
    }
    // 지역뉴스: its own module lists the 광역시·도 news titles in this screen
    // (current location, saved region or a picked 시·도; 오늘 / 1주일). Nothing
    // goes to the conversation.
    function openNewsEntry(item) {
      const current = ++generation;
      const back = action('지역정보로 돌아가기', () => {
        releaseNews?.(); releaseNews = undefined; generation += 1;
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${item.id}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const host = node('div', 'consumer-life-news');
      detail.append(back, host);
      root.replaceChildren(detail); back.focus();
      import('./site-life-news.js?v=aset-934415c7da50').then(({mountRegionalNews}) => {
        if (disposed || current !== generation) return;
        const mounted = mountRegionalNews({root: host});
        releaseNews = mounted.dispose;
        mounted.focus();
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '지역뉴스를 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    // 내 아이 학교·유치원: one card, two features — 내 아이 정보 (the reader's saved
    // schools / 유치원, its own sign-in rules) and 유치원·학교 찾기 (public lookup).
    function openChildChoice(item) {
      const back = action('지역정보로 돌아가기', () => {
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${item.id}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = `${item.id}-choice`;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const choices = node('div', 'consumer-life-choices');
      for (const choice of item.children) {
        const button = action(choice.label, () => {
          if (disposed) return;
          if (choice.id === 'education') openEducation({id: 'education', label: '유치원·학교'}, item.id);
          else openMyChild(item);
        });
        button.dataset.childChoice = choice.id;
        choices.append(button);
      }
      detail.append(back, title, choices);
      root.replaceChildren(detail); title.focus();
    }
    // KINDERGARTEN-OFFICIAL-INFO-01: the 유치원·학교 screen is its own module,
    // loaded on first use; it owns its reads and its "내 유치원" key.
    function openEducation(item, cardId = item.id) {
      const current = ++generation;
      const back = action('지역정보로 돌아가기', () => {
        releaseEducation?.(); releaseEducation = undefined; generation += 1;
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${cardId}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const host = node('div', 'consumer-life-education');
      detail.append(back, title, host);
      root.replaceChildren(detail); title.focus();
      import('./site-life-education.js?v=aset-934415c7da50').then(({mountEducation}) => {
        if (disposed || current !== generation) return;
        releaseEducation = mountEducation({root: host, onAsk, accountId}).dispose;
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '유치원·학교 정보를 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    // MY-CHILD-SCHOOL-01: the saved schools / 유치원 screen is its own module;
    // the conversation owns the session and mounts it (mountMyChild). Its
    // "대화로 더 물어보기" asks through the same onAsk as every life card.
    function openMyChild(item) {
      const current = ++generation;
      const back = action('지역정보로 돌아가기', () => {
        releaseMyChild?.(); releaseMyChild = undefined; generation += 1;
        root.replaceChildren(heading, grid);
        grid.querySelector(`[data-life-shortcut="${item.id}"]`)?.focus();
      }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const host = node('div', 'consumer-life-my-child');
      detail.append(back, title, host);
      root.replaceChildren(detail); title.focus();
      Promise.resolve(typeof mountMyChild === 'function' ? mountMyChild(host, {onAsk}) : null).then(mounted => {
        if (disposed || current !== generation) { mounted?.dispose?.(); return; }
        releaseMyChild = mounted?.dispose;
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '내 아이 학교·유치원을 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    for (const item of LIFE_SHORTCUTS) {
      const button = node('button', 'consumer-shortcut'); button.type = 'button'; button.dataset.lifeShortcut = item.id;
      button.append(item.brandSlot ? brandSlot(item.brandSlot) : icon(item.icon), node('span', '', item.label));
      button.addEventListener('click', () => {
        if (disposed) return;
        if (item.ask) onAsk(item.ask);
        else if (item.choices) openMedicalChoice(item);
        else if (item.id === 'festivals') onFestival();
        else if (item.children) openChildChoice(item);
        else item.id === 'news' ? openNewsEntry(item)
          : item.id === 'onnuri' ? onOnnuri?.()
            : item.id === 'real-estate' ? onRealEstate?.() : openLifeDetail(item);
      });
      grid.append(button);
    }
    const heading = node('h3', 'consumer-section-label', '생활에 필요한 정보');
    root.append(heading, grid);
  } else if (section === 'wallet') {
    releaseWallet = mountLifeWallet({root, authenticated, accountId, sessionExpiresAt, sessionToken});
  } else if (section === 'care') {
    const tabs = node('div', 'consumer-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '보호 대상');
    const body = node('div', 'consumer-care-body'); body.setAttribute('role', 'tabpanel');
    const panelId = `${root.parentElement.getAttribute('aria-labelledby') || 'consumer-care'}-targets`; body.id = panelId;
    const buttons = ['people', 'pets'].map((value, index) => {
      const button = node('button', '', index ? '반려동물' : '사람'); button.type = 'button';
      button.setAttribute('role', 'tab'); button.id = `${panelId}-${value}`;
      button.setAttribute('aria-controls', panelId); button.dataset.careTab = value;
      button.addEventListener('click', () => { void selectTab(value); onCareTab?.(value); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
        buttons[next].focus(); void selectTab(next ? 'pets' : 'people'); onCareTab?.(next ? 'pets' : 'people');
      });
      return button;
    });
    tabs.append(...buttons);
    const applyCounts = counts => {
      if (disposed || !authenticated || !counts) return;
      if (Number.isInteger(counts.people)) buttons[0].textContent = `사람 · ${counts.people}`;
      if (Number.isInteger(counts.pets)) buttons[1].textContent = `반려동물 · ${counts.pets}`;
    };
    async function selectTab(value, initialSurface = 'pets') {
      const current = ++generation;
      releasePeople?.(); releasePeople = undefined;
      releasePets?.(); releasePets = undefined;
      body.setAttribute('aria-labelledby', `${panelId}-${value}`);
      for (const button of buttons) {
        const active = button.dataset.careTab === value;
        button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      }
      if (value === 'people') {
        body.setAttribute('aria-busy', 'true');
        const host = node('div'); body.replaceChildren(host);
        try {
          const mounted = await mountPeople(host, initialSurface, counts => {
            if (disposed || current !== generation || !authenticated) return;
            applyCounts(counts);
          });
          if (disposed || current !== generation) { mounted?.dispose?.(); return; }
          releasePeople = mounted?.dispose;
        } catch {
          if (!disposed && current === generation) body.replaceChildren(node('p', 'consumer-error', '사람 안심케어 정보를 확인하지 못했습니다. 잠시 후 다시 열어 주세요.'));
        } finally { if (!disposed && current === generation) body.removeAttribute('aria-busy'); }
        return;
      }
      body.setAttribute('aria-busy', 'true'); body.replaceChildren(node('p', 'consumer-feature-note', '반려동물 정보를 확인하고 있어요.'));
      // Each async mount owns a separate host. A late response after switching
      // tabs must never overwrite the current people panel or leak photo URLs.
      const host = node('div'); body.replaceChildren(host);
      try {
        const mounted = await mountPets(host, initialSurface, counts => {
          if (disposed || current !== generation || !authenticated) return;
          applyCounts(counts);
        });
        if (disposed || current !== generation) { mounted?.dispose?.(); return; }
        releasePets = mounted?.dispose;
      } catch {
        if (!disposed && current === generation) body.replaceChildren(node('p', 'consumer-error', '반려동물 정보를 확인하지 못했습니다. 잠시 후 다시 열어 주세요.'));
      } finally { if (!disposed && current === generation) body.removeAttribute('aria-busy'); }
    }
    root.append(tabs, body);
    if (authenticated && typeof loadCareCounts === 'function') {
      void Promise.resolve(loadCareCounts()).then(applyCounts).catch(() => {});
    }
    void selectTab(careTab === 'pets' ? 'pets' : 'people');
  } else if (section === 'mall') {
    const state = empty('연결한 업체를 롯비에서 이용하세요', '제휴처를 찾아 연결하고, 허용한 권한과 연결 상태를 관리하는 공간입니다.', 'link');
    const catalog = node('a', 'consumer-action', '제휴처 찾아 연결하기');
    catalog.href = 'https://account.lotbiai.com/connected-services'; state.append(catalog);
    const groups = node('div', 'consumer-source-options');
    for (const label of ['지역몰', '공공몰', '생활서비스', '쇼핑']) groups.append(node('span', 'consumer-category-label', label));
    root.append(state, groups, node('p', 'consumer-feature-note', '업체별 실제 연결 가능 여부와 권한은 연결 서비스에서 확인합니다. 소셜 로그인 계정과 제휴처 이용 권한은 다릅니다. 주문·배송 및 자동 주문은 연결만으로 활성화되지 않으며, 실제 결제는 진행하지 않습니다.'));
  }
  return {dispose() { disposed = true; generation += 1; releasePeople?.(); releasePets?.(); releaseWallet?.dispose?.(); releaseEducation?.(); releaseNews?.(); releaseMyChild?.(); }};
}
