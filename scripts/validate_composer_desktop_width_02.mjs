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

// Desktop brand belongs to the sidebar hierarchy and uses the approved logo asset.
const desktopAside = index.match(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/)?.[0] || '';
assert.match(desktopAside, /<a class="sidebar-brand" href="index\.html" aria-label="LOTBI 홈">/);
assert.ok(desktopAside.includes('<img class="sidebar-brand-logo" src="/assets/lotbi-logo-header.png" alt="LOTBI 캐릭터"'));
assert.match(desktopAside, /<span class="sidebar-brand-mascot-crop"/);
assert.match(desktopAside, /<span class="sidebar-brand-wordmark"/);
assert.ok(
  desktopAside.indexOf('sidebar-brand') < desktopAside.indexOf('<nav class="sidebar-nav sidebar-nav-desktop"'),
  'desktop sidebar brand must appear before navigation',
);

// The main topbar brand remains available for tablet/mobile only; desktop must not duplicate it.
assert.match(index, /class="brand-text-logo chat-brand mobile-header-brand" href="index\.html"/);
assert.match(
  sidebarCss,
  /@media\s*\(min-width:\s*901px\)[\s\S]*?\.topbar-left,[\s\S]*?\.account-actions\s*\{[\s\S]*?display:\s*none/,
);

// Current sidebar brand keeps the approved mascot pixels in a fixed crop and
// renders the LOTBI wordmark separately without widening the 220px sidebar.
assert.match(sidebarCss, /\.sidebar-brand\s*\{[\s\S]*?margin:\s*0\s+10px\s+18px/);
assert.match(sidebarCss, /\.sidebar-brand\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(sidebarCss, /\.sidebar-brand-mascot-crop\s*\{[\s\S]*?width:\s*49px[\s\S]*?height:\s*48px/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?width:\s*auto/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?max-width:\s*none/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?height:\s*48px/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?object-fit:\s*contain/);
assert.match(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?object-position:\s*left center/);
assert.doesNotMatch(sidebarCss, /\.sidebar-brand-logo\s*\{[\s\S]*?height:\s*34px/);

const logoPng = readFileSync(path.join(ROOT, 'assets/lotbi-logo-header.png'));
assert.equal(logoPng.toString('ascii', 1, 4), 'PNG');
assert.equal(logoPng.toString('ascii', 12, 16), 'IHDR');
assert.equal(logoPng.readUInt32BE(16), 334, 'official sidebar logo intrinsic width changed');
assert.equal(logoPng.readUInt32BE(20), 96, 'official sidebar logo intrinsic height changed');

console.log('SITE-COMPOSER-DESKTOP-WIDTH-02 + SITE-SIDEBAR-LOGO-RIGHT-EDGE-SAFE-FIT-02 CONTRACT PASS');
