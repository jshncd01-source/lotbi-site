// Locks the official LOTBI logo wiring.
//
// The site used to draw a lookalike logo instead of shipping the approved
// artwork: the mascot PNG was cropped to a 32px strip, the wordmark was retyped
// in Arial Black, and the gradient O was painted as flat violet. This file makes
// sure none of that can come back, and that the logo stays a working Home reset
// control (Site #152 / #156).
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const LOCKUP = '/assets/brand/lotbi-lockup-160w.png';
const LOCKUP_DARK = '/assets/brand/lotbi-lockup-dark-160w.png';

// ---------------------------------------------------------------- assets ----
const REQUIRED_ASSETS = [
  'assets/brand/lotbi-lockup.png',
  'assets/brand/lotbi-lockup-160w.png',
  'assets/brand/lotbi-lockup-320w.png',
  'assets/brand/lotbi-lockup-480w.png',
  'assets/brand/lotbi-lockup-dark.png',
  'assets/brand/lotbi-lockup-dark-160w.png',
  'assets/brand/lotbi-lockup-dark-320w.png',
  'assets/brand/lotbi-lockup-dark-480w.png',
  'assets/brand/lotbi-mark-32.png',
  'assets/brand/lotbi-mark-48.png',
  'assets/brand/lotbi-mark-96.png',
  'assets/brand/lotbi-mark-192.png',
  'assets/brand/lotbi-mark-512.png',
];
for (const rel of REQUIRED_ASSETS) {
  assert.ok(existsSync(path.join(ROOT, rel)), `official brand asset missing: ${rel}`);
  const png = readFileSync(path.join(ROOT, rel));
  assert.equal(png.toString('ascii', 1, 4), 'PNG', `${rel} must be a PNG`);
}

// The generator stays in the tree so the assets can be rebuilt from the approved
// original rather than hand-edited.
assert.ok(existsSync(path.join(ROOT, 'tools/build-brand-assets.py')),
  'the brand asset build script must remain reproducible');

// Intrinsic sizes back the width/height attributes that prevent layout shift.
const expectDimensions = (rel, width, height) => {
  const png = readFileSync(path.join(ROOT, rel));
  assert.equal(png.readUInt32BE(16), width, `${rel} width`);
  assert.equal(png.readUInt32BE(20), height, `${rel} height`);
};
expectDimensions('assets/brand/lotbi-lockup-160w.png', 160, 70);
expectDimensions('assets/brand/lotbi-lockup-dark-160w.png', 160, 70);
expectDimensions('assets/brand/lotbi-mark-192.png', 192, 192);
expectDimensions('assets/brand/lotbi-mark-512.png', 512, 512);

// --------------------------------------------------- no lookalike drawing ----
const sidebarCss = read('site-sidebar-nav.css');
for (const forbidden of ['.sidebar-brand-mascot-crop', '.sidebar-brand-wordmark']) {
  assert.ok(!sidebarCss.includes(forbidden),
    `mock logo CSS must not return: ${forbidden}`);
}
assert.ok(!sidebarCss.includes('Arial Black'),
  'the wordmark must be the official asset, never retyped text');

const index = read('index.html');
for (const forbidden of ['sidebar-brand-mascot-crop', 'sidebar-brand-wordmark', 'lotbi-logo-header.png']) {
  assert.ok(!index.includes(forbidden),
    `index.html must not reference the mock logo: ${forbidden}`);
}

// The gradient O belongs to the artwork. A flat brand colour must never be used
// to paint a letterform again. (--brand-violet itself stays: it is still used by
// unrelated gradients, focus rings and about/mobile-entry styling.)
assert.ok(!/\.sidebar-brand[^{]*\{[^}]*--brand-violet/.test(sidebarCss),
  'the brand lockup must not be recoloured with a flat token');

// ------------------------------------------------------ every use site ------
const PAGES_WITH_LOGO = [
  'index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html',
  '404.html', 'account-deletion.html', 'auth/callback/index.html',
  'android-auth-test.html',
];
// SITE-BRAND-LOGO-THEME-AWARE-01 — only Home carries the LOTBI theme switch,
// so only Home ships both wordmarks. The rest have no dark surface at all
// (styles.css has no prefers-color-scheme block), and the <source
// media="(prefers-color-scheme: dark)"> they used to carry put the white
// wordmark on #f7f8fb for every dark-OS visitor. The switching contract itself
// is locked by scripts/validate_brand_logo_theme_aware_01.mjs.
const THEMED_PAGES = new Set(['index.html']);
for (const rel of PAGES_WITH_LOGO) {
  const html = read(rel);
  assert.ok(!html.includes('lotbi-logo-header.png'),
    `${rel}: the mock logo asset must be gone`);
  assert.ok(html.includes(LOCKUP), `${rel}: must use the official lockup`);
  assert.ok(!/<source media="\(prefers-color-scheme: dark\)"/.test(html),
    `${rel}: the wordmark must not be chosen by the OS setting alone`);
  if (THEMED_PAGES.has(rel)) {
    assert.ok(html.includes(LOCKUP_DARK), `${rel}: must provide the dark lockup`);
  } else {
    assert.ok(!html.includes(LOCKUP_DARK),
      `${rel}: has no dark surface, so it must not serve the dark lockup`);
  }
  // width/height on the rendered <img> is what prevents CLS.
  assert.match(html, /<img[^>]*lotbi-lockup-160w\.png"[^>]*width="160"[^>]*height="70"/,
    `${rel}: the logo must declare intrinsic size to avoid layout shift`);
  assert.match(html, /<img[^>]*lotbi-lockup-160w\.png"[^>]*alt="LOTBI"/,
    `${rel}: the logo must keep an accessible name`);
}

// index.html carries three logo sites: desktop sidebar, mobile topbar, drawer.
assert.equal((index.match(/lotbi-lockup-160w\.png"/g) || []).length, 3,
  'index.html must render the lockup at exactly three sites');
// Counted on the src attribute (the closing quote), not anywhere in the file:
// each variant also names itself inside its own srcset.
assert.equal((index.match(/lotbi-lockup-dark-160w\.png"/g) || []).length, 3,
  'each index.html logo site must offer the dark artwork');

// ------------------------------------------- Home reset contract preserved ---
// Site #152 / #156: the logo is a reset-to-empty-Home control. Whatever markup
// carries the artwork — <picture> before, paired <img> variants now — must not
// detach the anchor or its data attribute.
const sidebarBrand = index.match(/<a class="sidebar-brand"[\s\S]*?<\/a>/)?.[0] || '';
assert.ok(sidebarBrand, 'desktop sidebar brand anchor missing');
assert.match(sidebarBrand, /data-new-conversation/,
  'sidebar brand must keep data-new-conversation');
assert.match(sidebarBrand, /lotbi-brand-logo-light[\s\S]*lotbi-brand-logo-dark/,
  'sidebar brand must carry both wordmark variants inside the reset anchor');
assert.match(sidebarBrand, /aria-label="LOTBI 홈"/,
  'sidebar brand must keep its accessible name');

const mobileBrand = index.match(/<a class="chat-brand mobile-header-brand[\s\S]*?<\/a>/)?.[0] || '';
assert.ok(mobileBrand, 'mobile header brand anchor missing');
assert.match(mobileBrand, /data-new-conversation/,
  'mobile header brand must keep data-new-conversation');
assert.match(mobileBrand, /lotbi-brand-logo-light[\s\S]*lotbi-brand-logo-dark/,
  'mobile header brand must carry both wordmark variants inside the reset anchor');

// The runtime still binds the reset on the anchor, not on the image node.
const conversation = read('site-conversation.js');
assert.ok(conversation.includes('data-new-conversation'),
  'the conversation runtime must still bind the Home reset control');

// ------------------------------------------------------- icons / manifest ---
for (const size of [32, 48, 96, 192]) {
  assert.ok(index.includes(`/assets/brand/lotbi-mark-${size}.png`),
    `index.html must wire the ${size}px official mark icon`);
}
assert.match(index, /rel="apple-touch-icon"[^>]*lotbi-mark-192\.png/,
  'apple touch icon must use the official mark');

const manifest = JSON.parse(read('site.webmanifest'));
const iconSrcs = manifest.icons.map(icon => icon.src);
assert.ok(iconSrcs.some(src => src.includes('lotbi-mark-192.png')),
  'manifest must ship the 192px official mark');
assert.ok(iconSrcs.some(src => src.includes('lotbi-mark-512.png')),
  'manifest must ship the 512px official mark');

// ------------------------------------------------------------ chooser -------
const mobileEntry = read('mobile-entry.js');
assert.ok(mobileEntry.includes(LOCKUP),
  'the mobile chooser must use the official lockup');
assert.ok(!mobileEntry.includes('lotbi-logo-header.png'),
  'the mobile chooser must not keep the mock logo');

console.log('BRAND OFFICIAL LOGO CONTRACT PASS');
