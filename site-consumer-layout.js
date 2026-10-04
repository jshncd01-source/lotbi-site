/* On-demand plan presentation only. Existing subscription/navigation owns actions. */
(() => {
  'use strict';
  const disclosure = document.querySelector('[data-consumer-disclosure]');
  if (!disclosure) return;
  const trigger = disclosure.querySelector('summary');
  document.addEventListener('pointerdown', event => {
    if (disclosure.open && !disclosure.contains(event.target)) disclosure.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !disclosure.open) return;
    disclosure.open = false;
    trigger?.focus();
    event.preventDefault();
  });
})();
