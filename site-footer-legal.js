// SITE-HOME-SAME-URL-STABILITY-01 — progressively enhance the native mobile
// legal disclosure into the existing LOTBI bottom sheet.
//
// The HTML/CSS contract is intentionally complete without this module:
//   mobile first paint => compact native <details>/<summary>
//   tap with no JS     => the one legal panel expands inline
//   desktop            => the one legal panel is fully visible
//
// With JS, the *same* panel node moves into the bottom sheet and is restored on
// close/fold-width change. There is never a second copy of legal/business data.
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-5affefb9c2a8';

const MOBILE_QUERY = '(max-width: 760px)';
const footer = document.querySelector('.chat-home-footer');
const disclosure = footer?.querySelector('[data-footer-legal-disclosure]');
const toggle = disclosure?.querySelector('[data-footer-legal-toggle]');
const panels = footer?.querySelector('.footer-legal-panels');

if (footer && disclosure instanceof HTMLDetailsElement && toggle && panels) {
  const query = globalThis.matchMedia?.(MOBILE_QUERY) ?? null;
  let sheet = null;

  const restorePanels = () => {
    if (panels.parentNode !== footer) disclosure.insertAdjacentElement('afterend', panels);
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
    list.appendChild(panels);
    wrap.append(header, list);
    return wrap;
  };

  const openSheet = () => {
    if (sheet || !(query?.matches ?? globalThis.innerWidth <= 760)) return;
    disclosure.open = false;
    sheet = createBottomSheet({
      label: 'LOTBI 사업자 정보',
      presentation: SHEET_PRESENTATION.SHEET,
      content: buildBody,
      onClose: () => {
        sheet = null;
        restorePanels();
        disclosure.open = false;
      },
    });
    sheet.element.classList.add('footer-legal-sheet');
    sheet.open();
  };

  toggle.addEventListener('click', event => {
    if (!(query?.matches ?? globalThis.innerWidth <= 760)) return;
    event.preventDefault();
    if (sheet) sheet.close();
    else openSheet();
  });

  const applyViewport = mobile => {
    // A native inline disclosure may have been opened with JS disabled/delayed.
    // Once enhanced, keep mobile compact; on desktop the panel is always shown
    // by CSS and any open sheet must return its single source node first.
    disclosure.open = false;
    if (!mobile) sheet?.close();
  };

  applyViewport(query ? query.matches : globalThis.innerWidth <= 760);
  query?.addEventListener?.('change', event => applyViewport(event.matches));
}
