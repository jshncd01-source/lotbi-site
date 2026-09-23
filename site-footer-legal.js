// SITE-MOBILE-FOOTER-LEGAL-SHEET-01 — 모바일 홈 푸터를 한 줄로 접는다.
//
// 대표: "롯비 모바일 웹사이트 메인은 컴퓨터처럼 화면이 넓지 않으니깐 ...
// 유한회사 알에이디홀딩스 사업자번호만 나오게 하고, 거길 클릭하면 아래에서
// 슬라이드로 올라오게 바꿔."
//
// 390px 화면에서 푸터가 306px, 화면의 3분의 1 이상을 먹고 있었다. 전자상거래법
// 제10조제1항이 요구하는 표시사항이라 지울 수는 없다 — 그래서 지우지 않는다.
// 한 줄만 남기고 나머지는 자리만 바텀시트 안으로 옮긴다.
//
// 옮긴다는 말 그대로다: 복사가 아니라 이동이다. 푸터에 있던 그 노드가 시트
// 안으로 들어갔다가 닫을 때 제자리로 돌아온다. 복사본을 만들면 표시사항이 두
// 벌이 되고, 한 벌만 고쳐지는 날 조용히 어긋난다 — scripts/
// sync_footer_business_info.py 가 막고 있는 바로 그 사고다.
//
// 접기 자체는 CSS 가 하되 body 의 클래스로만 열린다. 이 모듈이 실패하면 클래스가
// 붙지 않고, 푸터는 지금까지처럼 전부 펼쳐진 채 남는다. 표시의무가 스크립트에
// 딸려 사라지지 않게 하려는 것이다.
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=20260923-legalsheet1';

// 푸터가 자기 모바일 값으로 내려가는 폭과 같은 지점에서 접는다
// (footer-business-info.css / styles.css 의 @media (max-width: 760px)).
const MOBILE_QUERY = '(max-width: 760px)';

const footer = document.querySelector('.chat-home-footer');
const toggle = footer?.querySelector('[data-footer-legal-toggle]');

if (footer && toggle) {
  // 시트로 옮길 것들 — 한 줄 요약을 뺀 푸터의 나머지 전부. 개별 클래스를 적지
  // 않는 것은 의도적이다: 나중에 푸터에 항목이 늘어도 시트가 같이 따라간다.
  const panels = [...footer.children].filter(node => node !== toggle);
  const query = globalThis.matchMedia?.(MOBILE_QUERY) ?? null;

  let sheet = null;

  const restorePanels = () => {
    // 원래 순서 그대로 푸터 끝에 다시 붙인다. 요약 버튼이 푸터의 첫 자식이므로
    // 순서대로 append 하면 접기 전 구성으로 정확히 돌아간다.
    for (const node of panels) footer.appendChild(node);
  };

  const buildBody = () => {
    const wrap = document.createElement('div');
    wrap.className = 'footer-legal-sheet-content';

    const header = document.createElement('div');
    header.className = 'footer-legal-sheet-header';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'footer-legal-sheet-close';
    close.setAttribute('aria-label', '사업자 정보 닫기');
    close.textContent = '×';
    close.addEventListener('click', () => sheet?.close());
    header.appendChild(close);

    const list = document.createElement('div');
    list.className = 'footer-legal-sheet-panels';
    for (const node of panels) list.appendChild(node);

    wrap.append(header, list);
    return wrap;
  };

  const openSheet = () => {
    if (sheet) return;
    sheet = createBottomSheet({
      label: 'LOTBI 사업자 정보',
      // 이 시트는 좁은 화면에서만 열리므로 항상 올라오는 형태다.
      presentation: SHEET_PRESENTATION.SHEET,
      content: buildBody,
      onClose: () => {
        sheet = null;
        restorePanels();
        toggle.setAttribute('aria-expanded', 'false');
      },
    });
    sheet.element.classList.add('footer-legal-sheet');
    toggle.setAttribute('aria-expanded', 'true');
    sheet.open();
  };

  const setCollapsed = collapsed => {
    document.body.classList.toggle('footer-legal-collapsed', collapsed);
    toggle.hidden = !collapsed;
    // 접기를 풀 때 시트가 열려 있었다면 닫아서 내용물을 푸터로 돌려보낸다.
    // 가로로 돌리거나 폴더블을 펼치는 순간이 여기다.
    if (!collapsed) sheet?.close();
  };

  toggle.addEventListener('click', () => {
    if (sheet) sheet.close();
    else openSheet();
  });

  setCollapsed(query ? query.matches : false);
  query?.addEventListener?.('change', event => setCollapsed(event.matches));
}
