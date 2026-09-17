(() => {
  'use strict';

  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.querySelector('[data-mobile-nav-backdrop]');
  const openButtons = Array.from(document.querySelectorAll('[data-mobile-nav-open]'));
  const closeButton = document.querySelector('[data-mobile-nav-close]');
  const prompt = document.getElementById('lotbi-prompt');

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
    const resizePrompt = () => {
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
      }
    });
  }
})();
