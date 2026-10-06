import {mountLifeWallet} from './site-life-wallet.js?v=aset-fd0a6e010706';

// Presentation only. Actions delegate to the existing feature owners; this
// module never uploads identity documents or invents account/connection data.
export const LIFE_SHORTCUTS = Object.freeze([
  {id: 'festivals', label: '축제·행사', icon: 'calendar'},
  {id: 'local', label: '지역생활정보', icon: 'pin', prompt: '우리 지역 생활정보를 알려 줘'},
  {id: 'bills', label: '공과금 확인', icon: 'document', prompt: '공과금 고지서를 확인하고 납부기한을 캘린더에 등록할지 알려 줘'},
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
  bills: [['고지서 내용', '기관 · 금액 · 납부기한을 입력하세요']],
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

export function mountConsumerSection({section, root, onDraft, onFestival, onSaved, mountPeople, mountPets, authenticated = false, accountId = '', sessionExpiresAt = ''} = {}) {
  root.classList.add('consumer-section-content');
  root.dataset.consumerSurface = section;
  let disposed = false;
  let generation = 0;
  let releasePeople;
  let releasePets;
  let releaseWallet;

  if (section === 'life') {
    const form = node('form', 'consumer-search');
    const input = node('input'); input.type = 'search'; input.maxLength = 1000;
    input.placeholder = '어떤 생활정보가 필요하세요?'; input.setAttribute('aria-label', input.placeholder);
    const submit = action('롯비에게 물어보기'); submit.type = 'submit';
    form.append(input, submit);
    form.addEventListener('submit', event => { event.preventDefault(); if (input.value.trim()) onDraft(input.value.trim()); else input.focus(); });
    const grid = node('div', 'consumer-shortcuts');
    function openLifeDetail(item) {
      const back = action('생활정보로 돌아가기', () => { root.replaceChildren(form, heading, grid, footer); input.focus(); }, {secondary: true});
      const detail = node('section', 'consumer-life-detail');
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const queryForm = node('form', 'consumer-life-form');
      const controls = [];
      const fields = LIFE_DETAIL_FIELDS[item.id];
      for (const [labelText, placeholder] of fields) {
        const label = node('label', 'consumer-life-field', labelText);
        const field = node(item.id === 'bills' ? 'textarea' : 'input');
        if (item.id !== 'bills') field.type = 'text';
        field.placeholder = placeholder; field.maxLength = 1000; field.required = true;
        field.setAttribute('aria-label', labelText); label.append(field); controls.push([labelText, field]); queryForm.append(label);
      }
      const send = action('질문 준비하기'); send.type = 'submit'; queryForm.append(send);
      queryForm.addEventListener('submit', event => {
        event.preventDefault();
        if (disposed) return;
        const missing = controls.find(([, field]) => !field.value.trim());
        if (missing) { missing[1].focus(); return; }
        onDraft([item.prompt, ...controls.map(([label, field]) => `${label}: ${field.value.trim()}`)].join('\n'));
      });
      const note = item.id === 'bills'
        ? '다음 화면에서 질문을 확인한 뒤 보내세요. 사진·PDF는 대화창에 첨부할 수 있어요. 납기일 등록과 납부는 확인 없이 진행하지 않습니다.'
        : '다음 화면에서 질문을 확인한 뒤 보내세요. 현재 위치는 자동으로 수집하지 않습니다.';
      detail.append(back, title, queryForm, node('p', 'consumer-feature-note', note));
      root.replaceChildren(detail); title.focus();
    }
    for (const item of LIFE_SHORTCUTS) {
      const button = node('button', 'consumer-shortcut'); button.type = 'button';
      button.append(icon(item.icon), node('span', '', item.label));
      button.addEventListener('click', () => item.id === 'festivals' ? onFestival() : openLifeDetail(item));
      grid.append(button);
    }
    const saved = action('저장한 정보 다시 보기', onSaved, {secondary: true});
    const heading = node('h3', 'consumer-section-label', '생활에 필요한 정보');
    const footer = node('div', 'consumer-section-footer');
    footer.append(saved, node('p', 'consumer-feature-note', '원하는 정보를 선택하고 조건을 입력하세요. 공과금 납기는 확인 후 일정 등록을 제안합니다.'));
    root.append(form, heading, grid, footer);
  } else if (section === 'wallet') {
    releaseWallet = mountLifeWallet({root, authenticated, accountId, sessionExpiresAt});
  } else if (section === 'care') {
    const tabs = node('div', 'consumer-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '보호 대상');
    const body = node('div', 'consumer-care-body'); body.setAttribute('role', 'tabpanel');
    const panelId = `${root.parentElement.getAttribute('aria-labelledby') || 'consumer-care'}-targets`; body.id = panelId;
    const buttons = ['people', 'pets'].map((value, index) => {
      const button = node('button', '', index ? '반려동물' : '사람'); button.type = 'button';
      button.setAttribute('role', 'tab'); button.id = `${panelId}-${value}`;
      button.setAttribute('aria-controls', panelId); button.dataset.careTab = value;
      button.addEventListener('click', () => { void selectTab(value); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
        buttons[next].focus(); void selectTab(next ? 'pets' : 'people');
      });
      return button;
    });
    tabs.append(...buttons);
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
          const mounted = await mountPeople(host, initialSurface);
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
          if (Number.isInteger(counts.pets)) buttons[1].textContent = `반려동물 · ${counts.pets}`;
        });
        if (disposed || current !== generation) { mounted?.dispose?.(); return; }
        releasePets = mounted?.dispose;
      } catch {
        if (!disposed && current === generation) body.replaceChildren(node('p', 'consumer-error', '반려동물 정보를 확인하지 못했습니다. 잠시 후 다시 열어 주세요.'));
      } finally { if (!disposed && current === generation) body.removeAttribute('aria-busy'); }
    }
    root.append(tabs, body); void selectTab('people');
  } else if (section === 'mall') {
    const state = empty('연결한 업체를 롯비에서 이용하세요', '제휴처를 찾아 연결하고, 허용한 권한과 연결 상태를 관리하는 공간입니다.', 'link');
    const catalog = node('a', 'consumer-action', '제휴처 찾아 연결하기');
    catalog.href = 'https://account.lotbiai.com/connected-services'; state.append(catalog);
    const groups = node('div', 'consumer-source-options');
    for (const label of ['지역몰', '공공몰', '생활서비스', '쇼핑']) groups.append(node('span', 'consumer-category-label', label));
    root.append(state, groups, node('p', 'consumer-feature-note', '업체별 실제 연결 가능 여부와 권한은 연결 서비스에서 확인합니다. 소셜 로그인 계정과 제휴처 이용 권한은 다릅니다. 주문·배송 및 자동 주문은 연결만으로 활성화되지 않으며, 실제 결제는 진행하지 않습니다.'));
  }
  return {dispose() { disposed = true; generation += 1; releasePeople?.(); releasePets?.(); releaseWallet?.dispose?.(); }};
}
