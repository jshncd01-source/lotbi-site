import {mountLifeWallet} from './site-life-wallet.js?v=aset-dd5190d1fa87';
import {savedLifeRegionLabel} from './site-life-location.js?v=aset-dd5190d1fa87';
import {LIFE_LOCAL_CARD_ENABLED, TRAFFIC_CCTV_UI_ENABLED} from './site-feature-flags.js?v=aset-dd5190d1fa87';

// Presentation only. Actions delegate to the existing feature owners; this
// module never uploads identity documents or invents account/connection data.
// onAsk(text) hands a finished question to the conversation, which sends it
// right away: one tap asks LOTBI, with nothing to confirm or send again.
//
// LIFE-MEDICAL-MERGE-01 (owner decision 2026-10-11: "병원 응급실 약국도 같은 분류이니깐
// 카테고리를 하나로", then "이걸 너 같으면 사용자가 쓰겠어?"): 병원·응급실·약국 is ONE
// card, and it is a screen of its own — site-life-medical-list.js lists the nearest
// 병원·의원 / 응급실 / 약국 right in the 지역정보 screen (Core GET
// /v2/life/medical/nearby, the search the conversation runs for "근처 … 찾아줘").
// Nothing is sent to the conversation: the earlier fixed questions (LIFE-MEDICAL-
// AUTO-SEARCH-01) and the two-way choice (REGIONAL-INFO-APPROVED-UX-RESTORE-P0)
// are gone. 응급실 stays in the card name so an emergency room is not hidden behind
// a card that does not name it.
// REGIONAL-INFO-APPROVED-UX-RESTORE-P0 — the separate 유치원·학교 card is gone (owner
// decision 2026-10-10): 내 아이 학교·유치원 is the one education card.
// REGIONAL-INFO-BACK-NAVIGATION-01 (owner decision 2026-10-10, "학교·유치원
// 등록인데 메뉴를 왜 나눠?"): it opens the saved schools / 유치원 screen at once
// (MY-CHILD-SCHOOL-01) — no 내 아이 정보 / 유치원·학교 찾기 choice; schools (NEIS) and
// 유치원 (유치원알리미) are found inside its '학교·유치원 추가'. Owner decision
// 2026-10-10 ("1링크 다시 살리"): signed out, that screen also links "로그인 없이
// 학교·유치원 찾기" — the public lookup (site-life-education.js,
// KINDERGARTEN-OFFICIAL-INFO-01, route life-education).
// REGIONAL-CARDS-BUNDLE-01 (four feature screens, one card list):
// * 전기차 충전소 right after the 병원·응급실·약국 card (EV-CHARGER-NEARBY-LIST-P0, site-life-ev-chargers.js)
// * 지하철 정보 right after 지역뉴스 (SUBWAY-LIFE-INFO-P0, site-life-subway.js)
// * 부동산 실거래가 right after 온누리상품권·지역화폐 (REAL-ESTATE-REGION-FAVORITES-P0,
//   site-life-real-estate.js)
// * 도로 CCTV after it only while TRAFFIC_CCTV_UI_ENABLED (off: owner decision
//   2026-10-10, TRAFFIC-CCTV P0, site-life-traffic-cctv.js)
// Each is a screen of its own, never a question to the conversation. Eight
// cards (CCTV off; no 전북 맛집·음식 — owner decision 2026-10-10, 약국 inside the
// medical card — 2026-10-11, 지역생활정보 hidden — QA_화면전수_01 H3, 2026-10-11):
// four full rows of two, so no cell is empty. On a 360px phone 병원·응급실·약국 and
// 온누리상품권·지역화폐 wrap at a '·' inside the shared card height
// (site-consumer-layout.css: grid-auto-rows 1fr). An odd count (CCTV on, or
// 지역생활정보 shown again) makes the last card span its row
// (site-consumer-design.css), so no cell is empty either way.
export const LIFE_SHORTCUTS = Object.freeze([
  // LIFE-MEDICAL-MERGE-01: 병원·응급실·약국 in one screen (site-life-medical-list.js), no chat.
  {id: 'medical', label: '병원·응급실·약국', icon: 'hospital'},
  // EV-CHARGER-NEARBY-LIST-P0: nearest stations from 한국환경공단 data, no chat.
  {id: 'ev-chargers', label: '전기차 충전소', icon: 'ev'},
  {id: 'festivals', label: '축제·행사', icon: 'calendar'},
  // REGIONAL-NEWS-SCREEN-LIST-01: lists 광역시·도 news titles itself (site-life-news.js).
  {id: 'news', label: '지역뉴스', icon: 'news'},
  // SUBWAY-LIFE-INFO-P0: its own screen (site-life-subway.js) — nearby and
  // searched stations, official real-time arrivals, average congestion. No chat.
  {id: 'subway', label: '지하철 정보', icon: 'subway'},
  // ONNURI-MERCHANT-01: its own search surface (site-life-onnuri.js). The
  // official logo is not used before approval; brandSlot names the place it
  // takes then. LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0: 온누리상품권 + 지역화폐 in
  // one card. QA 2026-10-10 #12: until then a plain voucher icon (LOTBI's own
  // line icon, not the official mark) so it is not the one card without one.
  {id: 'onnuri', label: '온누리상품권·지역화폐', icon: 'voucher', brandSlot: 'onnuri'},
  // REAL-ESTATE-REGION-FAVORITES-P0: 국토교통부 실거래가 list + 관심 아파트, no chat.
  {id: 'real-estate', label: '부동산 실거래가', icon: 'building'},
  // TRAFFIC-CCTV P0: official ITS road cameras by road, route and 구간, no chat.
  // The screen is titled 실시간 도로 CCTV; the card says 도로 CCTV so the label
  // stays on one line in the approved two-column grid at 360 px. Hidden while
  // TRAFFIC_CCTV_UI_ENABLED is off.
  ...(TRAFFIC_CCTV_UI_ENABLED ? [{id: 'traffic-cctv', label: '도로 CCTV', icon: 'cctv'}] : []),
  // Hidden until its result shows inside the screen (QA_화면전수_01 H3, LIFE_LOCAL_CARD_ENABLED).
  ...(LIFE_LOCAL_CARD_ENABLED ? [{id: 'local', label: '지역생활정보', icon: 'pin', prompt: '우리 지역 생활정보를 알려 줘'}] : []),
  // REGIONAL-CARDS-BUNDLE-01: no 전북 맛집·음식 card or entry form (owner decision
  // 2026-10-10 — LOTBI serves the whole country, not 전북 only). The 전북 official
  // record cards shown in a conversation answer stay.
  // MY-CHILD-SCHOOL-01: the saved schools / 유치원 screen, opened at once. Last.
  {id: 'my-child', label: '내 아이 학교·유치원', icon: 'backpack'},
]);

// REGIONAL-INFO-BACK-NAVIGATION-01 — the screens inside 지역정보, each a route of
// site-route.js, and the screen each one steps back to: 카테고리 → 지역정보 →
// home, one screen per back (the system/browser back, the header ←, Escape and
// the '지역정보로 돌아가기' button alike).
export const LIFE_VIEW_PARENT = Object.freeze({
  'life-medical': 'life',
  'life-news': 'life',
  'life-local': 'life',
  'life-my-child': 'life',
  'life-education': 'life-my-child',
});
// The 지역정보 card a screen was opened from (focus returns to it).
const LIFE_VIEW_CARD = Object.freeze({
  'life-medical': 'medical', 'life-news': 'news', 'life-local': 'local', 'life-my-child': 'my-child', 'life-education': 'my-child',
});
export function lifeBackLabel(view) {
  const parent = LIFE_VIEW_PARENT[view];
  return parent === 'life' ? '지역정보로 돌아가기' : parent === 'life-my-child' ? '내 아이 학교·유치원으로 돌아가기' : '대화로 돌아가기';
}

// QA 2026-10-10 #14: 지역생활정보 offers questions that ask in one tap, so the
// form is not the only way in. No "nearby" word: like the form, they never
// send the current location (lifeLocationIntent stays false).
export const LIFE_DETAIL_EXAMPLES = Object.freeze({
  local: Object.freeze(['쓰레기 배출 요일', '주민센터 운영시간', '대형폐기물 버리는 방법', '공영주차장 위치']),
});

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
  ev: ['M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16', 'M2 21h15', 'm10 7-2.5 4h4L9 15', 'M15 9h1.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-2.5-2.5'],
  subway: ['M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z', 'M4 11h16M8 15h.01M16 15h.01', 'm8 18-2 3m10-3 2 3'],
  cctv: ['M3 7.5 15 3.8l2 6.2-12 3.7-2-6.2Z', 'm17 8.6 4-1.2v5.2l-3.2 1', 'M8 12.6 9 16H4.5v4.5', 'M7 8.4h.01'],
  voucher: ['M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Z', 'M14 7v2m0 2v2m0 2v2'],
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

export function mountConsumerSection({section, root, onAsk, onFestival, onOnnuri, onEvChargers, onRealEstate, onSubway, onTrafficCctv, lifeView = 'life', onLifeView, requestLifeBack, loadCareCounts, mountPeople, mountPets, mountFamily, checkFamily, mountMyChild, careTab = 'people', onCareTab, authenticated = false, accountId = '', sessionExpiresAt = '', sessionToken = '', subscription = null} = {}) {
  root.classList.add('consumer-section-content');
  root.dataset.consumerSurface = section;
  let disposed = false;
  let generation = 0;
  let releasePeople;
  let releasePets;
  let releaseFamily;
  let releaseWallet;
  let releaseEducation;
  let releaseNews;
  let releaseMedical;
  let releaseMyChild;
  let lifeApi = null;

  if (section === 'life') {
    // The life home only picks a category: free questions belong to the main
    // chat, and saved items are not duplicated here.
    //
    // REGIONAL-INFO-BACK-NAVIGATION-01 — each screen below is a view with a
    // route (LIFE_VIEW_PARENT). A change is reported (onLifeView) so the
    // conversation names it in the URL and history; a step back is handed to
    // requestLifeBack, which goes back in history first (leaveSiteRoute) and
    // then shows the parent, so the screen and the URL change together.
    // showLifeView is how back/forward or a reload of a 'life-*' URL shows a
    // screen in this surface.
    const grid = node('div', 'consumer-shortcuts');
    const items = Object.fromEntries(LIFE_SHORTCUTS.map(item => [item.id, item]));
    let view = 'life';
    const setView = name => { view = name; onLifeView?.(name); };
    // Leaving a screen releases the module it mounted (뉴스, 유치원·학교, 내 아이 정보).
    const releaseDetail = () => {
      generation += 1;
      releaseMedical?.(); releaseMedical = undefined;
      releaseNews?.(); releaseNews = undefined;
      releaseEducation?.(); releaseEducation = undefined;
      releaseMyChild?.(); releaseMyChild = undefined;
    };
    const stepBack = (from = view) => {
      const parent = LIFE_VIEW_PARENT[from];
      if (!parent || disposed) return false;
      const apply = () => { if (!disposed && view === from) showLifeView(parent, {from}); };
      if (typeof requestLifeBack === 'function') requestLifeBack(parent, apply); else apply();
      return true;
    };
    // QA 2026-10-10 #3: one back per screen — the header ← steps to the 지역정보
    // list (its label says so, lifeBackLabel); no second '지역정보로 돌아가기' link.
    function showGrid(from = '') {
      releaseDetail();
      root.replaceChildren(heading, grid);
      setView('life');
      if (LIFE_VIEW_CARD[from]) grid.querySelector(`[data-life-shortcut="${LIFE_VIEW_CARD[from]}"]`)?.focus();
    }
    function showLifeView(name, {from = ''} = {}) {
      if (disposed) return;
      if (name === 'life-medical' && items.medical) openMedical(items.medical);
      else if (name === 'life-news' && items.news) openNewsEntry(items.news);
      else if (name === 'life-local' && items.local) openLifeDetail(items.local);
      else if (name === 'life-my-child' && items['my-child']) openMyChild(items['my-child'], from);
      else if (name === 'life-education' && items['my-child']) openEducation();
      else showGrid(from);
    }
    lifeApi = {view: () => view, show: name => showLifeView(name, {from: view}), back: () => stepBack()};
    function openLifeDetail(item) {
      releaseDetail();
      const viewName = `life-${item.id}`;
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const examples = node('div', 'consumer-life-examples');
      examples.setAttribute('role', 'group'); examples.setAttribute('aria-label', '자주 묻는 생활정보');
      for (const example of LIFE_DETAIL_EXAMPLES[item.id] || []) {
        const chip = node('button', 'consumer-life-example', example); chip.type = 'button';
        chip.dataset.lifeExample = example;
        chip.addEventListener('click', () => { if (!disposed) onAsk(`${item.prompt}\n궁금한 생활정보: ${example}`); });
        examples.append(chip);
      }
      const queryForm = node('form', 'consumer-life-form');
      // LOTBI says what is missing, not the browser's own bubble.
      queryForm.noValidate = true;
      const formStatus = node('p', 'consumer-life-form-status'); formStatus.setAttribute('role', 'status'); formStatus.hidden = true;
      const controls = [];
      const fields = LIFE_DETAIL_FIELDS[item.id];
      for (const [labelText, placeholder] of fields) {
        const label = node('label', 'consumer-life-field', labelText);
        const field = node('input'); field.type = 'text';
        field.placeholder = placeholder; field.maxLength = 1000; field.required = true;
        field.setAttribute('aria-label', labelText); label.append(field); controls.push([labelText, field]); queryForm.append(label);
      }
      const send = action('롯비에게 물어보기'); send.type = 'submit'; queryForm.append(formStatus, send);
      queryForm.addEventListener('submit', event => {
        event.preventDefault();
        if (disposed) return;
        const missing = controls.find(([, field]) => !field.value.trim());
        if (missing) { formStatus.textContent = `${missing[0]}를 입력해 주세요.`; formStatus.hidden = false; missing[1].focus(); return; }
        onAsk([item.prompt, ...controls.map(([label, field]) => `${label}: ${field.value.trim()}`)].join('\n'));
      });
      const note = '누르면 바로 롯비에게 물어봐요. 현재 위치는 자동으로 수집하지 않습니다.';
      detail.append(title, ...(examples.childElementCount ? [examples] : []), queryForm, node('p', 'consumer-feature-note', note));
      root.replaceChildren(detail); setView(viewName); title.focus();
    }
    // 병원·응급실·약국 (LIFE-MEDICAL-MERGE-01): its own module lists the nearest
    // 병원·의원 / 응급실 / 약국 in this screen (current location, a remembered
    // region, or a picked one). Nothing goes to the conversation. It never shows
    // the browser's permission prompt on opening or on a reload — only the
    // [위치 허용하고 찾기] tap does.
    function openMedical(item) {
      releaseDetail();
      const current = ++generation;
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const host = node('div', 'consumer-life-medical');
      detail.append(host);
      root.replaceChildren(detail); setView('life-medical');
      import('./site-life-medical-list.js?v=aset-dd5190d1fa87').then(({mountMedicalList}) => {
        if (disposed || current !== generation) return null;
        return mountMedicalList({root: host}).then(mounted => {
          if (disposed || current !== generation) { mounted.dispose(); return; }
          releaseMedical = mounted.dispose;
          mounted.focus();
        });
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '병원·응급실·약국을 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    // 지역뉴스: its own module lists the 광역시·도 news titles in this screen
    // (current location, saved region or a picked 시·도; 오늘 / 1주일). Nothing
    // goes to the conversation.
    function openNewsEntry(item) {
      releaseDetail();
      const current = ++generation;
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const host = node('div', 'consumer-life-news');
      detail.append(host);
      root.replaceChildren(detail); setView('life-news');
      import('./site-life-news.js?v=aset-dd5190d1fa87').then(({mountRegionalNews}) => {
        if (disposed || current !== generation) return;
        const mounted = mountRegionalNews({root: host});
        releaseNews = mounted.dispose;
        mounted.focus();
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '지역뉴스를 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    // KINDERGARTEN-OFFICIAL-INFO-01: the public 학교 / 유치원 lookup, its own
    // module loaded on first use (its reads and its "내 유치원" key). Reached
    // signed out from 내 아이 학교·유치원; its header ← steps back there.
    function openEducation() {
      releaseDetail();
      const current = ++generation;
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = 'education';
      const title = node('h3', '', '학교·유치원 찾기'); title.tabIndex = -1;
      const host = node('div', 'consumer-life-education');
      detail.append(title, host);
      root.replaceChildren(detail); setView('life-education'); title.focus();
      import('./site-life-education.js?v=aset-dd5190d1fa87').then(({mountEducation}) => {
        if (disposed || current !== generation) return;
        releaseEducation = mountEducation({root: host, onAsk, accountId}).dispose;
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '유치원·학교 정보를 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    // MY-CHILD-SCHOOL-01: the saved schools / 유치원 screen is its own module;
    // the conversation owns the session and mounts it (mountMyChild). Its
    // "대화로 더 물어보기" asks through the same onAsk as every life card.
    function openMyChild(item, from = '') {
      releaseDetail();
      const current = ++generation;
      const detail = node('section', 'consumer-life-detail');
      detail.dataset.lifeDetail = item.id;
      const title = node('h3', '', item.label); title.tabIndex = -1;
      const host = node('div', 'consumer-life-my-child');
      detail.append(title);
      // Signed out: the public lookup, without an account (owner decision
      // 2026-10-10). Signed in, the saved screen is all there is. The link sits
      // right under the title, above the content the module mounts below it
      // (owner approval 2026-10-11): it used to sit under that content, so it
      // slid ~175px down the moment the module attached and a tap on it missed.
      const lookup = authenticated ? null : node('button', 'consumer-action consumer-action-secondary consumer-life-lookup', '로그인 없이 학교·유치원 찾기');
      if (lookup) {
        lookup.type = 'button'; lookup.dataset.lifeEducationEntry = '';
        lookup.addEventListener('click', () => { if (!disposed) showLifeView('life-education'); });
        detail.append(lookup);
      }
      detail.append(host);
      root.replaceChildren(detail); setView('life-my-child');
      (from === 'life-education' && lookup ? lookup : title).focus();
      Promise.resolve(typeof mountMyChild === 'function' ? mountMyChild(host, {onAsk}) : null).then(mounted => {
        if (disposed || current !== generation) { mounted?.dispose?.(); return; }
        releaseMyChild = mounted?.dispose;
      }).catch(() => {
        if (!disposed && current === generation) host.replaceChildren(node('p', 'consumer-error', '내 아이 학교·유치원을 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
      });
    }
    for (const item of LIFE_SHORTCUTS) {
      const button = node('button', 'consumer-shortcut'); button.type = 'button'; button.dataset.lifeShortcut = item.id;
      button.append(item.icon ? icon(item.icon) : brandSlot(item.brandSlot), node('span', '', item.label));
      button.addEventListener('click', () => {
        if (disposed) return;
        if (item.ask) onAsk(item.ask);
        else if (item.id === 'medical') openMedical(item);
        else if (item.id === 'traffic-cctv') onTrafficCctv?.();
        else if (item.id === 'festivals') onFestival();
        else if (item.id === 'ev-chargers') onEvChargers?.();
        else if (item.id === 'subway') onSubway?.();
        else if (item.id === 'my-child') openMyChild(item);
        else item.id === 'news' ? openNewsEntry(item)
          : item.id === 'onnuri' ? onOnnuri?.()
            : item.id === 'real-estate' ? onRealEstate?.() : openLifeDetail(item);
      });
      grid.append(button);
    }
    const heading = node('h3', 'consumer-section-label', '생활에 필요한 정보');
    root.append(heading, grid);
    // A reload or back/forward of a 'life-*' URL opens that screen directly.
    if (lifeView !== 'life' && LIFE_VIEW_PARENT[lifeView]) showLifeView(lifeView);
  } else if (section === 'wallet') {
    releaseWallet = mountLifeWallet({root, authenticated, accountId, sessionExpiresAt, sessionToken, subscription});
  } else if (section === 'care') {
    const tabs = node('div', 'consumer-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '보호 대상');
    const body = node('div', 'consumer-care-body'); body.setAttribute('role', 'tabpanel');
    const panelId = `${root.parentElement.getAttribute('aria-labelledby') || 'consumer-care'}-targets`; body.id = panelId;
    // FAMILY-LOCATION-01: with the 「가족 위치」 tab present (Core's switch on), the arrow keys move
    // across all three tabs; with two tabs the 사람/반려동물 behaviour below is unchanged.
    const moveAcrossTabs = (key, index) => {
      const next = key === 'Home' ? 0 : key === 'End' ? buttons.length - 1
        : (index + (key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
      const target = buttons[next]; target.focus();
      void selectTab(target.dataset.careTab); onCareTab?.(target.dataset.careTab);
    };
    const buttons = ['people', 'pets'].map((value, index) => {
      const button = node('button', '', index ? '반려동물' : '사람'); button.type = 'button';
      button.setAttribute('role', 'tab'); button.id = `${panelId}-${value}`;
      button.setAttribute('aria-controls', panelId); button.dataset.careTab = value;
      button.addEventListener('click', () => { void selectTab(value); onCareTab?.(value); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        if (buttons.length > 2) { event.preventDefault(); moveAcrossTabs(event.key, index); return; }
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
    async function selectTab(value, initialSurface = 'pets', missingPrefill = null) {
      const current = ++generation;
      releasePeople?.(); releasePeople = undefined;
      releasePets?.(); releasePets = undefined;
      releaseFamily?.(); releaseFamily = undefined;
      body.setAttribute('aria-labelledby', `${panelId}-${value}`);
      for (const button of buttons) {
        const active = button.dataset.careTab === value;
        button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      }
      if (value === 'family') {
        body.setAttribute('aria-busy', 'true');
        const host = node('div'); body.replaceChildren(host);
        try {
          const mounted = await mountFamily(host, {
            // [실종 신고로 이어가기]: the 사람 tab opens with the place in words filled in.
            onMissingReport: prefill => { if (disposed) return; onCareTab?.('people'); void selectTab('people', 'home', prefill); },
          });
          if (disposed || current !== generation) { mounted?.dispose?.(); return; }
          releaseFamily = mounted?.dispose;
        } catch {
          if (!disposed && current === generation) body.replaceChildren(node('p', 'consumer-error', '가족 위치를 열지 못했습니다. 잠시 후 다시 열어 주세요.'));
        } finally { if (!disposed && current === generation) body.removeAttribute('aria-busy'); }
        return;
      }
      if (value === 'people') {
        body.setAttribute('aria-busy', 'true');
        const host = node('div'); body.replaceChildren(host);
        try {
          const mounted = await mountPeople(host, initialSurface, counts => {
            if (disposed || current !== generation || !authenticated) return;
            applyCounts(counts);
          }, missingPrefill ? {missingPrefill} : undefined);
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
    // FAMILY-LOCATION-01: 「가족 위치」 joins as a third tab only once Core's FAMILY_LOCATION_ENABLED
    // answers for this signed-in account; a 가족 위치 invitation (careTab 'family') opens it then.
    if (authenticated && typeof mountFamily === 'function' && typeof checkFamily === 'function') {
      void Promise.resolve(checkFamily()).then(available => {
        if (disposed || available !== true) return;
        const button = node('button', '', '가족 위치'); button.type = 'button';
        button.setAttribute('role', 'tab'); button.id = `${panelId}-family`;
        button.setAttribute('aria-controls', panelId); button.dataset.careTab = 'family';
        button.setAttribute('aria-selected', 'false'); button.tabIndex = -1;
        button.addEventListener('click', () => { void selectTab('family'); onCareTab?.('family'); });
        button.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); moveAcrossTabs(event.key, buttons.indexOf(button));
        });
        buttons.push(button); tabs.append(button);
        if (careTab === 'family') { void selectTab('family'); onCareTab?.('family'); }
      }).catch(() => {});
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
  return {
    dispose() { disposed = true; generation += 1; releasePeople?.(); releasePets?.(); releaseFamily?.(); releaseWallet?.dispose?.(); releaseEducation?.(); releaseNews?.(); releaseMedical?.(); releaseMyChild?.(); },
    // REGIONAL-INFO-BACK-NAVIGATION-01 (지역정보 only): the screen on view, show
    // one by its route, and one step back (false on the 지역정보 list itself).
    get lifeView() { return lifeApi ? lifeApi.view() : ''; },
    showLifeView(name) { lifeApi?.show(name); },
    back() { return lifeApi ? lifeApi.back() : false; },
  };
}
