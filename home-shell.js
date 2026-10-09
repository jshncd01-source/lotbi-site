(() => {
  'use strict';

  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  const openButtons = Array.from(document.querySelectorAll('[data-mobile-nav-open]'));
  const closeButton = document.querySelector('[data-mobile-nav-close]');
  const appShell = document.querySelector('.chat-app-shell');
  const prompt = document.getElementById('lotbi-prompt');
  const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
  const currentVisibleHeight = () => Math.max(
    1,
    Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 1),
  );
  const currentVisibleWidth = () => Math.max(
    1,
    Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 1),
  );
  const currentLayoutHeight = () => Math.max(
    currentVisibleHeight(),
    Math.round(window.innerHeight || 0),
    Math.round(document.documentElement.clientHeight || 0),
  );
  const softwareKeyboardCapable = () => (
    coarsePointerQuery.matches
    || Number(navigator.maxTouchPoints || 0) > 0
    || 'ontouchstart' in window
  );
  let mobileViewportBaseline = currentLayoutHeight();
  let mobileViewportWidth = currentVisibleWidth();
  let viewportSyncFrame = 0;
  let resizePrompt = () => {};

  // CHAT-IOS-TOUCH-SCROLL-KEYBOARD-01 — iOS 26 Safari and WKWebView (the
  // KakaoTalk in-app browser) can leave the visual viewport displaced after
  // the keyboard has closed: offsetTop stays above 0 and the visible height
  // short (WebKit bug 297779). The page then sits off the screen - the top
  // bar cut, room under the composer - until the viewport comes back. While
  // it is displaced, with nothing being typed, the shell covers what is
  // actually visible, as it does with the keyboard open. A displacement has to
  // outlast a few frames: closing the keyboard passes through it briefly.
  const DISPLACED_FRAMES = 8;
  let displacedFrames = 0;
  const editingOutsideComposer = () => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== prompt
      && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
  };

  let appliedViewport = '';
  const applyMobileViewport = () => {
    const viewport = window.visualViewport;
    const visibleHeight = currentVisibleHeight();
    const visibleWidth = currentVisibleWidth();
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const layoutHeight = currentLayoutHeight();
    const sample = `${visibleHeight}x${visibleWidth}+${offsetTop}/${layoutHeight}/${Math.round(window.scrollY || 0)}`;

    const widthChanged = Math.abs(visibleWidth - mobileViewportWidth) > 72;
    if (widthChanged) {
      mobileViewportWidth = visibleWidth;
      mobileViewportBaseline = layoutHeight;
    }

    const promptFocused = prompt instanceof HTMLTextAreaElement && document.activeElement === prompt;
    let keyboardOpen = false;
    let keyboardTight = false;
    let keyboardInset = 0;
    let displaced = false;
    if (!promptFocused || !softwareKeyboardCapable()) {
      mobileViewportBaseline = Math.max(visibleHeight, layoutHeight);
      const zoomed = Math.abs((viewport?.scale || 1) - 1) > 0.01;
      const displacedNow = Boolean(viewport) && !promptFocused && softwareKeyboardCapable() && !zoomed && !editingOutsideComposer()
        && (offsetTop > 1 || visibleHeight < Math.round(window.innerHeight || 0) - 2 || (window.scrollY || 0) > 1);
      displacedFrames = displacedNow ? displacedFrames + 1 : 0;
      displaced = displacedFrames >= DISPLACED_FRAMES;
    } else {
      displacedFrames = 0;
      mobileViewportBaseline = Math.max(mobileViewportBaseline, layoutHeight, visibleHeight);
      keyboardInset = Math.max(0, mobileViewportBaseline - visibleHeight);
      const keyboardRatio = visibleHeight / Math.max(1, mobileViewportBaseline);
      const openThreshold = Math.max(96, Math.round(mobileViewportBaseline * 0.16));
      keyboardOpen = keyboardInset >= openThreshold && keyboardRatio <= 0.84;
      keyboardTight = keyboardOpen && (keyboardRatio <= 0.62 || visibleHeight <= 460);
    }

    // Writes only when something changed: this runs every frame while the
    // viewport is being followed.
    const applied = `${sample}|${promptFocused}|${keyboardOpen}|${keyboardTight}|${displaced}|${Math.round(keyboardInset)}`;
    if (applied === appliedViewport) return sample;
    appliedViewport = applied;
    document.documentElement.style.setProperty('--lotbi-mobile-viewport-height', `${visibleHeight}px`);
    document.documentElement.style.setProperty('--lotbi-visible-viewport-height', `${visibleHeight}px`);
    document.documentElement.style.setProperty('--lotbi-visible-viewport-width', `${visibleWidth}px`);
    document.documentElement.style.setProperty('--lotbi-visible-viewport-offset-top', `${offsetTop}px`);
    document.documentElement.style.setProperty('--lotbi-keyboard-inset', `${Math.round(keyboardInset)}px`);
    document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
    document.body.classList.toggle('mobile-keyboard-tight', keyboardTight);
    document.body.classList.toggle('mobile-viewport-displaced', displaced);
    resizePrompt();

    if (promptFocused && softwareKeyboardCapable()) {
      window.dispatchEvent(new CustomEvent('lotbi:keyboard-viewport', {
        detail: Object.freeze({
          open: keyboardOpen,
          tight: keyboardTight,
          visibleHeight,
          visibleWidth,
          offsetTop,
          keyboardInset: Math.round(keyboardInset),
        }),
      }));
    }
    return sample;
  };

  // CHAT-IOS-TOUCH-SCROLL-KEYBOARD-01 — WebKit hands out visualViewport values
  // late: the resize that announces the keyboard still carries the old
  // offsetTop, and the pan lands a few frames later with no event of its own
  // (WebKit bug 237851); while a finger pans the page it sends nothing until
  // the pan ends. One read per event left the shell where the viewport used to
  // be - on an iPhone the composer floated a keyboard's height above the
  // keyboard with empty space under it, and the conversation had a strip of
  // 48px. So every trigger follows the viewport frame by frame until it has
  // held still for VIEWPORT_STILL_FRAMES; nothing is guessed, no timer.
  const VIEWPORT_STILL_FRAMES = 12;
  const VIEWPORT_FOLLOW_FRAMES = 90;
  let viewportFramesLeft = 0;
  let viewportStillFrames = 0;
  let lastViewportSample = '';
  const syncMobileViewport = () => {
    viewportFramesLeft = VIEWPORT_FOLLOW_FRAMES;
    viewportStillFrames = 0;
    if (viewportSyncFrame) return;
    const followViewport = () => {
      viewportSyncFrame = 0;
      const sample = applyMobileViewport();
      viewportStillFrames = sample === lastViewportSample ? viewportStillFrames + 1 : 0;
      lastViewportSample = sample;
      viewportFramesLeft -= 1;
      if (viewportFramesLeft > 0 && viewportStillFrames < VIEWPORT_STILL_FRAMES) {
        viewportSyncFrame = requestAnimationFrame(followViewport);
      }
    };
    viewportSyncFrame = requestAnimationFrame(followViewport);
  };
  // A finger on the page while the keyboard is open (or the viewport is
  // displaced) may be panning the visual viewport, which iOS only reports
  // when the pan is over: follow it while the finger moves.
  const followWhileTouching = () => {
    if (document.body.classList.contains('mobile-keyboard-open') || document.body.classList.contains('mobile-viewport-displaced')) {
      syncMobileViewport();
    }
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    document.addEventListener(type, followWhileTouching, {passive: true, capture: true});
  }

  if (drawer && backdrop && openButtons.length > 0 && closeButton) {
    let lastFocused = null;
    const drawerFocusable = () => Array.from(drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((node) => node instanceof HTMLElement && !node.hasAttribute('inert'));

    const setDrawerOpen = (open) => {
      document.body.classList.toggle('nav-drawer-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      openButtons.forEach((button) => button.setAttribute('aria-expanded', String(open)));

      if (open) {
        lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        appShell?.setAttribute('inert', '');
        drawer.removeAttribute('inert');
        closeButton.focus();
      } else {
        drawer.setAttribute('inert', '');
        appShell?.removeAttribute('inert');
        if (lastFocused instanceof HTMLElement) {
          lastFocused.focus();
        }
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener('click', () => setDrawerOpen(true));
    });
    closeButton.addEventListener('click', () => setDrawerOpen(false));
    backdrop.addEventListener('click', () => setDrawerOpen(false));
    document.addEventListener('keydown', (event) => {
      if (!document.body.classList.contains('nav-drawer-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = drawerFocusable();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (prompt instanceof HTMLTextAreaElement) {
    resizePrompt = () => {
      prompt.style.height = 'auto';
      const styles = window.getComputedStyle(prompt);
      const minHeight = Number.parseFloat(styles.minHeight) || 40;
      const maxHeight = Number.parseFloat(styles.maxHeight) || 320;
      const nextHeight = Math.min(Math.max(prompt.scrollHeight, minHeight), maxHeight);
      prompt.style.height = `${nextHeight}px`;
      prompt.style.overflowY = prompt.scrollHeight > maxHeight ? 'auto' : 'hidden';
      // CHAT-IOS-TOUCH-SCROLL-KEYBOARD-01 — containment is for a draft long
      // enough to scroll itself. On a draft that fits, `contain` stopped every
      // drag that started on the text: the conversation never moved.
      prompt.style.overscrollBehavior = prompt.scrollHeight > maxHeight ? 'contain' : 'auto';
    };

    prompt.addEventListener('input', resizePrompt);
    prompt.addEventListener('compositionend', resizePrompt);
    window.addEventListener('resize', resizePrompt);

    // Establish the compact one-line baseline immediately and keep all later
    // typing, paste, newline, IME and programmatic input events on one path.
    resizePrompt();

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        resizePrompt();
        syncMobileViewport();
      }
    });

    prompt.addEventListener('focus', syncMobileViewport);
    prompt.addEventListener('blur', syncMobileViewport);
  }

  window.visualViewport?.addEventListener('resize', syncMobileViewport, {passive: true});
  window.visualViewport?.addEventListener('scroll', syncMobileViewport, {passive: true});
  window.addEventListener('resize', syncMobileViewport, {passive: true});
  window.addEventListener('orientationchange', () => {
    mobileViewportBaseline = currentLayoutHeight();
    mobileViewportWidth = currentVisibleWidth();
    document.body.classList.remove('mobile-keyboard-open', 'mobile-keyboard-tight', 'mobile-viewport-displaced');
    appliedViewport = '';
    displacedFrames = 0;
    syncMobileViewport();
  }, {passive: true});
  syncMobileViewport();
})();
