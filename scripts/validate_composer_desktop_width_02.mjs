import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const homeCss = read('home-chat.css');
const hardeningCss = read('site-hardening.css');
const sidebarCss = read('site-sidebar-nav.css');

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

// Mobile/Fold uses the full available content column; the stale 350px cap is forbidden.
assert.match(
  hardeningCss,
  /@media\s*\(max-width:\s*760px\)[\s\S]*?\.chat-composer\s*\{[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none/,
);
assert.doesNotMatch(hardeningCss, /\.chat-composer\s*\{[^}]*350px/);
assert.match(hardeningCss, /max-height:\s*min\(calc\(12lh\s*\+\s*12px\),\s*40dvh\)/);

// Font readability is not traded away to manufacture capacity.
assert.match(homeCss, /\.chat-input\s*\{[\s\S]*?font-size:\s*17px/);
assert.doesNotMatch(hardeningCss, /letter-spacing:\s*-\d/);
assert.doesNotMatch(hardeningCss, /white-space:\s*nowrap/);

// Desktop brand belongs to the sidebar hierarchy and uses the approved logo asset.
const desktopAside = index.match(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/)?.[0] || '';
assert.match(desktopAside, /<a class="sidebar-brand" href="index\.html" aria-label="LOTBI 홈" data-new-conversation>/);
// SITE-BRAND-LOGO-THEME-AWARE-01 — the class now carries a theme variant, and
// the dark twin sits beside the light one. Both keep the accessible name.
assert.match(desktopAside, /<img class="sidebar-brand-logo lotbi-brand-logo-light" src="\/assets\/brand\/lotbi-lockup-160w\.png"[^>]*\salt="LOTBI"/);
assert.match(desktopAside, /<img class="sidebar-brand-logo lotbi-brand-logo-dark" src="\/assets\/brand\/lotbi-lockup-dark-160w\.png"[^>]*\salt="LOTBI"/);
// The approved artwork is rendered as-is: no cropped mascot strip, no retyped wordmark.
assert.doesNotMatch(desktopAside, /sidebar-brand-mascot-crop/);
assert.doesNotMatch(desktopAside, /sidebar-brand-wordmark/);
assert.ok(
  desktopAside.indexOf('sidebar-brand') < desktopAside.indexOf('<nav class="sidebar-nav sidebar-nav-desktop"'),
  'desktop sidebar brand must appear before navigation',
);

// The main topbar brand remains available for tablet/mobile only; desktop must not duplicate it.
assert.ok(index.includes('<a class="chat-brand mobile-header-brand lotbi-official-brand" href="index.html" aria-label="LOTBI 홈" data-new-conversation>'));
assert.match(
  sidebarCss,
  /@media\s*\(min-width:\s*901px\)[\s\S]*?\.topbar-left,[\s\S]*?\.account-actions\s*\{[\s\S]*?display:\s*none/,
);

// The sidebar brand is the official lockup, sized to fit the 220px sidebar
// without cropping or redrawing any part of it.
assert.match(sidebarCss, /\.sidebar-brand\s*\{[\s\S]*?margin:\s*0\s+10px\s+18px/);
assert.match(sidebarCss, /\.sidebar-brand\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?width:\s*auto/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?max-width:\s*100%/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?height:\s*44px/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?object-fit:\s*contain/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?object-position:\s*left center/);
assert.doesNotMatch(sidebarCss, /\.sidebar-brand-logo\s*\{[^}]*height:\s*34px/);

const logoPng = readFileSync(path.join(ROOT, 'assets/brand/lotbi-lockup-160w.png'));
assert.equal(logoPng.toString('ascii', 1, 4), 'PNG');
assert.equal(logoPng.toString('ascii', 12, 16), 'IHDR');
assert.equal(logoPng.readUInt32BE(16), 160, 'official sidebar logo intrinsic width changed');
assert.equal(logoPng.readUInt32BE(20), 70, 'official sidebar logo intrinsic height changed');

console.log('SITE-COMPOSER-DESKTOP-WIDTH-02 + SITE-SIDEBAR-LOGO-RIGHT-EDGE-SAFE-FIT-02 CONTRACT PASS');
