// Reusable bottom-sheet primitive.
//
// Deliberately owns no product content: callers inject a body node, so the same
// component backs the Calendar selected-day sheet and the account/profile sheet.
//
//   import {createBottomSheet} from './site-bottom-sheet.js?v=aset-975b9c80ce29';
//
//   const sheet = createBottomSheet({
//     label: '9월 2일 일정',
//     content: () => buildMyBody(),      // Node, or a function returning one
//     onClose: () => restoreSelection(), // called after the sheet is gone
//   });
//   sheet.open();
//
// Desktop callers that want a different presentation pass
// presentation: 'INLINE' (or their own resolver) and mount `sheet.element`
// wherever they like: no fixed positioning, no backdrop, no focus trap.

export const SHEET_PRESENTATION = Object.freeze({SHEET: 'SHEET', INLINE: 'INLINE'});

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const DRAG_CLOSE_RATIO = 0.28;   // fraction of sheet height that dismisses
const DRAG_CLOSE_MIN_PX = 64;    // ...but never less than this
const DRAG_FLICK_VELOCITY = 0.6; // px/ms: a fast flick dismisses short of the distance
const DRAG_FLICK_MIN_PX = 32;    // ...but a flick still needs real travel, so a
                                 // tiny fast twitch cannot dismiss the sheet

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function defaultPresentation() {
  if (typeof globalThis.matchMedia === 'function') {
    return globalThis.matchMedia('(max-width: 900px)').matches
      ? SHEET_PRESENTATION.SHEET
      : SHEET_PRESENTATION.INLINE;
  }
  return globalThis.innerWidth <= 900 ? SHEET_PRESENTATION.SHEET : SHEET_PRESENTATION.INLINE;
}

// Keeps the sheet clear of a raised software keyboard. Shared shape with the
// Calendar editor's handling so both ride the visual viewport the same way.
function bindVisualViewport(node) {
  const viewport = globalThis.visualViewport;
  if (!viewport || !node) return () => {};
  const sync = () => {
    const height = Math.max(1, Math.round(viewport.height));
    const top = Math.max(0, Math.round(viewport.offsetTop || 0));
    const gap = Math.max(0, Math.round((globalThis.innerHeight || height) - (top + height)));
    node.style.setProperty('--lotbi-sheet-visual-height', `${height}px`);
    node.style.setProperty('--lotbi-sheet-bottom-gap', `${gap}px`);
  };
  sync();
  viewport.addEventListener('resize', sync);
  viewport.addEventListener('scroll', sync);
  return () => {
    viewport.removeEventListener('resize', sync);
    viewport.removeEventListener('scroll', sync);
  };
}

export function createBottomSheet({
  label = '',
  labelledBy = '',
  content = null,
  onClose = () => {},
  root = typeof document !== 'undefined' ? document.body : null,
  presentation = null,
  dragToClose = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  dismissLabel = '닫기',
} = {}) {
  const mode = presentation || defaultPresentation();
  const isSheet = mode === SHEET_PRESENTATION.SHEET;
  const reducedMotion = prefersReducedMotion();

  const backdrop = document.createElement('div');
  backdrop.className = 'lotbi-sheet-backdrop';
  backdrop.dataset.lotbiSheetBackdrop = '';
  backdrop.dataset.reducedMotion = String(reducedMotion);

  const element = document.createElement('div');
  element.className = 'lotbi-sheet';
  element.dataset.lotbiSheet = '';
  element.dataset.presentation = mode;
  element.dataset.reducedMotion = String(reducedMotion);
  // Only the overlay presentation is a modal dialog. INLINE is an ordinary
  // region, so it must not claim aria-modal or trap focus.
  element.setAttribute('role', isSheet ? 'dialog' : 'group');
  if (isSheet) element.setAttribute('aria-modal', 'true');
  if (labelledBy) element.setAttribute('aria-labelledby', labelledBy);
  else if (label) element.setAttribute('aria-label', label);

  const grabber = document.createElement('div');
  grabber.className = 'lotbi-sheet-grabber';
  grabber.dataset.lotbiSheetGrabber = '';
  grabber.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'lotbi-sheet-body';
  body.dataset.lotbiSheetBody = '';

  // A keyboard- and screen-reader-reachable dismiss, since the grabber is
  // pointer-only.
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'lotbi-sheet-dismiss';
  dismiss.dataset.lotbiSheetDismiss = '';
  dismiss.textContent = dismissLabel;

  if (isSheet) element.appendChild(grabber);
  element.append(body, dismiss);

  let opened = false;
  let releaseViewport = () => {};
  let previouslyFocused = null;

  const setContent = next => {
    const node = typeof next === 'function' ? next() : next;
    body.replaceChildren();
    if (node) body.appendChild(node);
    return sheet;
  };

  const focusables = () => [...element.querySelectorAll(FOCUSABLE)]
    .filter(node => node.offsetParent !== null || node === document.activeElement);

  const onKeydown = event => {
    if (!opened) return;
    if (closeOnEscape && event.key === 'Escape') {
      // Consume it here so an ancestor handler cannot also close its own layer.
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!isSheet || event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !element.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // ------------------------------------------------------------ dragging ---
  let dragging = false, startY = 0, startedAt = 0, offset = 0, pointerId = null;

  const applyOffset = value => {
    offset = Math.max(0, value);
    element.style.transform = offset ? `translateY(${offset}px)` : '';
  };

  const endDrag = commit => {
    if (!dragging) return;
    dragging = false;
    element.dataset.dragging = 'false';
    if (pointerId !== null && grabber.releasePointerCapture) {
      try { grabber.releasePointerCapture(pointerId); } catch { /* already released */ }
    }
    pointerId = null;
    const height = element.getBoundingClientRect().height || 1;
    const elapsed = Math.max(1, Date.now() - startedAt);
    const velocity = offset / elapsed;
    const threshold = Math.max(DRAG_CLOSE_MIN_PX, height * DRAG_CLOSE_RATIO);
    const flicked = offset >= DRAG_FLICK_MIN_PX && velocity >= DRAG_FLICK_VELOCITY;
    if (commit && (offset >= threshold || flicked)) {
      applyOffset(0);
      close();
      return;
    }
    applyOffset(0);
  };

  const onPointerDown = event => {
    if (!isSheet || !dragToClose || !opened) return;
    if (event.button != null && event.button !== 0) return;
    dragging = true;
    startY = event.clientY;
    startedAt = Date.now();
    pointerId = event.pointerId ?? null;
    element.dataset.dragging = 'true';
    if (pointerId !== null && grabber.setPointerCapture) {
      try { grabber.setPointerCapture(pointerId); } catch { /* not capturable */ }
    }
  };

  const onPointerMove = event => {
    if (!dragging) return;
    if (event.cancelable) event.preventDefault();
    applyOffset(event.clientY - startY);
  };

  const onPointerUp = () => endDrag(true);
  const onPointerCancel = () => endDrag(false);

  grabber.addEventListener('pointerdown', onPointerDown);
  grabber.addEventListener('pointermove', onPointerMove, {passive: false});
  grabber.addEventListener('pointerup', onPointerUp);
  grabber.addEventListener('pointercancel', onPointerCancel);
  dismiss.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => { if (closeOnBackdrop) close(); });

  function open() {
    if (opened) return sheet;
    opened = true;
    previouslyFocused = document.activeElement;
    const host = root || document.body;
    if (isSheet) host.appendChild(backdrop);
    host.appendChild(element);
    if (isSheet) {
      releaseViewport = bindVisualViewport(element);
      document.addEventListener('keydown', onKeydown, true);
      // Focus the sheet itself rather than its first control, so a screen
      // reader announces the dialog before its contents.
      element.tabIndex = -1;
      element.focus({preventScroll: true});
    }
    return sheet;
  }

  function close() {
    if (!opened) return sheet;
    opened = false;
    releaseViewport();
    releaseViewport = () => {};
    document.removeEventListener('keydown', onKeydown, true);
    backdrop.remove();
    element.remove();
    element.style.transform = '';
    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && previouslyFocused.isConnected) {
      previouslyFocused.focus({preventScroll: true});
    }
    previouslyFocused = null;
    onClose();
    return sheet;
  }

  function destroy() {
    close();
    grabber.removeEventListener('pointerdown', onPointerDown);
    grabber.removeEventListener('pointermove', onPointerMove);
    grabber.removeEventListener('pointerup', onPointerUp);
    grabber.removeEventListener('pointercancel', onPointerCancel);
  }

  const sheet = {
    element,
    backdrop,
    body,
    presentation: mode,
    get isOpen() { return opened; },
    open,
    close,
    destroy,
    setContent,
  };

  if (content) setContent(content);
  return sheet;
}
