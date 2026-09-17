import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const homeCss = read('home-chat.css');
const hardeningCss = read('site-hardening.css');

// SITE-COMPOSER-DESKTOP-WIDTH-02: desktop composer must no longer be capped at 720px.
assert.match(
  hardeningCss,
  /\.chat-composer\s*\{[\s\S]*?width:\s*min\(960px,\s*calc\(100%\s*-\s*12px\)\)/,
  'desktop composer should use the approved 960px responsive cap',
);
assert.doesNotMatch(
  hardeningCss,
  /\.chat-composer\s*\{[\s\S]*?width:\s*min\(720px,/,
  'stale 720px desktop composer cap must be removed',
);

// Parent/sidebar widths remain stable; widening happens inside the existing main content budget.
assert.match(homeCss, /\.chat-app-shell\s*\{[\s\S]*?grid-template-columns:\s*220px\s+minmax\(0,\s*1fr\)/);
assert.match(homeCss, /\.chat-home-shell\s*\{[\s\S]*?width:\s*min\(100%,\s*1240px\)/);

// Mobile keeps its existing compact, viewport-safe composer policy.
assert.match(
  hardeningCss,
  /@media\s*\(max-width:\s*760px\)[\s\S]*?\.chat-composer\s*\{[\s\S]*?width:\s*min\(100%,\s*350px\)/,
);
assert.match(hardeningCss, /max-height:\s*min\(calc\(12lh\s*\+\s*12px\),\s*40dvh\)/);

// Font readability is not traded away to manufacture capacity.
assert.match(homeCss, /\.chat-input\s*\{[\s\S]*?font-size:\s*17px/);
assert.doesNotMatch(hardeningCss, /letter-spacing:\s*-\d/);
assert.doesNotMatch(hardeningCss, /white-space:\s*nowrap/);

// Desktop brand belongs to the sidebar hierarchy, using the existing official text-wordmark treatment.
const desktopAside = index.match(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/)?.[0] || '';
assert.match(desktopAside, /<a class="brand-text-logo sidebar-brand" href="index\.html" aria-label="LOTBI 홈">/);
assert.ok(
  desktopAside.indexOf('sidebar-brand') < desktopAside.indexOf('<nav class="sidebar-nav">'),
  'desktop sidebar brand must appear before navigation',
);

// The main topbar brand remains available for tablet/mobile only; desktop must not duplicate it.
assert.match(index, /class="brand-text-logo chat-brand mobile-header-brand" href="index\.html"/);
assert.match(
  hardeningCss,
  /@media\s*\(min-width:\s*901px\)[\s\S]*?\.topbar-left\s*\{[\s\S]*?display:\s*none/,
);
assert.match(
  hardeningCss,
  /@media\s*\(min-width:\s*901px\)[\s\S]*?\.chat-topbar\s*\{[\s\S]*?justify-content:\s*flex-end/,
);

// Sidebar logo aligns with navigation text without changing sidebar width.
assert.match(hardeningCss, /\.sidebar-brand\s*\{[\s\S]*?margin:\s*4px\s+10px\s+22px/);

console.log('SITE-COMPOSER-DESKTOP-WIDTH-02 + DESKTOP-SIDEBAR-BRAND CONTRACT PASS');
