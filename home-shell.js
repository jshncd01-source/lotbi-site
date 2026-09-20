(() => {
  'use strict';

  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  const openButtons = Array.from(document.querySelectorAll('[data-mobile-nav-open]'));
  const closeButton = document.querySelector('[data-mobile-nav-close]');
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

  const syncMobileViewport = () => {
    cancelAnimationFrame(viewportSyncFrame);
    viewportSyncFrame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      const visibleHeight = currentVisibleHeight();
      const visibleWidth = currentVisibleWidth();
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
      const layoutHeight = currentLayoutHeight();

      document.documentElement.style.setProperty('--lotbi-mobile-viewport-height', `${visibleHeight}px`);
      document.documentElement.style.setProperty('--lotbi-visible-viewport-height', `${visibleHeight}px`);
      document.documentElement.style.setProperty('--lotbi-visible-viewport-width', `${visibleWidth}px`);
      document.documentElement.style.setProperty('--lotbi-visible-viewport-offset-top', `${offsetTop}px`);

      const widthChanged = Math.abs(visibleWidth - mobileViewportWidth) > 72;
      if (widthChanged) {
        mobileViewportWidth = visibleWidth;
        mobileViewportBaseline = layoutHeight;
      }

      const promptFocused = prompt instanceof HTMLTextAreaElement && document.activeElement === prompt;
      if (!promptFocused || !softwareKeyboardCapable()) {
        mobileViewportBaseline = Math.max(visibleHeight, layoutHeight);
        document.documentElement.style.setProperty('--lotbi-keyboard-inset', '0px');
        document.body.classList.remove('mobile-keyboard-open', 'mobile-keyboard-tight');
        resizePrompt();
        return;
      }

      mobileViewportBaseline = Math.max(mobileViewportBaseline, layoutHeight, visibleHeight);
      const keyboardInset = Math.max(0, mobileViewportBaseline - visibleHeight);
      const keyboardRatio = visibleHeight / Math.max(1, mobileViewportBaseline);
      const openThreshold = Math.max(96, Math.round(mobileViewportBaseline * 0.16));
      const keyboardOpen = keyboardInset >= openThreshold && keyboardRatio <= 0.84;
      const keyboardTight = keyboardOpen && (keyboardRatio <= 0.62 || visibleHeight <= 460);

      document.documentElement.style.setProperty('--lotbi-keyboard-inset', `${Math.round(keyboardInset)}px`);
      document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
      document.body.classList.toggle('mobile-keyboard-tight', keyboardTight);
      resizePrompt();

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
    });
  };

  if (drawer && backdrop && openButtons.length > 0 && closeButton) {
    let lastFocused = null;

    const setDrawerOpen = (open) => {
      document.body.classList.toggle('nav-drawer-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      openButtons.forEach((button) => button.setAttribute('aria-expanded', String(open)));

      if (open) {
        lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        drawer.removeAttribute('inert');
        closeButton.focus();
      } else {
        drawer.setAttribute('inert', '');
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
      if (event.key === 'Escape' && document.body.classList.contains('nav-drawer-open')) {
        setDrawerOpen(false);
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
    document.body.classList.remove('mobile-keyboard-open', 'mobile-keyboard-tight');
    syncMobileViewport();
  }, {passive: true});
  syncMobileViewport();
})();
