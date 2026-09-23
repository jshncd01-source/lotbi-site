// SITE-BRAND-LOGO-THEME-AWARE-01
//
// The lockup used <picture media="(prefers-color-scheme: dark)">, which reads
// the OS setting only. LOTBI has its own three-state switch on
// body[data-site-theme], and <picture>'s media attribute takes CSS media
// queries — an attribute selector cannot go there. Two combinations broke:
// a light OS with LOTBI set to Dark put the navy wordmark on #151922, and a
// dark OS on the always-light static pages put the white wordmark on #f7f8fb.
//
// This gate locks the shape of the fix:
//   1. no <picture> dark source survives anywhere — that mechanism cannot see
//      the site theme and must not come back,
//   2. every themed logo spot ships both variants with the theme classes,
//   3. the CSS keys on body[data-site-theme] and, for the pre-paint window,
//      only on the bootstrap state that actually paints `background`, and
//   4. alt text survives on both variants.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const THEMED_PAGES = ['index.html'];
const STATIC_PAGES = [
  'about.html', 'contact.html', 'privacy.html', 'terms.html',
  'account-deletion.html', '404.html', 'android-auth-test.html',
  'auth/callback/index.html',
];

// ── 1. The OS-only mechanism is gone everywhere ───────────────────────────
for (const page of [...THEMED_PAGES, ...STATIC_PAGES]) {
  const html = read(page);
  assert.ok(
    !/media="\(prefers-color-scheme: dark\)"/.test(html),
    `${page} must not pick the wordmark from the OS setting alone`,
  );
}

// ── 2. Themed pages ship both variants at every logo spot ─────────────────
for (const page of THEMED_PAGES) {
  const html = read(page);
  const light = html.match(/class="[^"]*lotbi-brand-logo-light[^"]*"/g) ?? [];
  const dark = html.match(/class="[^"]*lotbi-brand-logo-dark[^"]*"/g) ?? [];
  assert.equal(light.length, 3, `${page} must carry three light wordmarks (sidebar, mobile header, drawer)`);
  assert.equal(dark.length, 3, `${page} must carry a dark wordmark beside each light one`);

  // Each spot's class pairs up, so no surface is left on one variant only.
  for (const spot of ['sidebar-brand-logo', 'mobile-header-logo', 'mobile-drawer-brand-logo']) {
    for (const variant of ['light', 'dark']) {
      assert.ok(
        new RegExp(`class="${spot}[^"]*lotbi-brand-logo-${variant}`).test(html)
        || new RegExp(`class="${spot} [^"]*lotbi-brand-logo-${variant}`).test(html),
        `${page}: ${spot} is missing its ${variant} variant`,
      );
    }
  }

  // Both variants must point at the matching asset.
  assert.ok(
    /lotbi-brand-logo-light" src="\/assets\/brand\/lotbi-lockup-160w\.png/.test(html),
    `${page} light wordmark must use the light asset`,
  );
  assert.ok(
    /lotbi-brand-logo-dark" src="\/assets\/brand\/lotbi-lockup-dark-160w\.png/.test(html),
    `${page} dark wordmark must use the dark asset`,
  );

  // Accessibility: a variant hidden by display:none leaves the a11y tree, so
  // whichever one renders still has to name itself.
  const imgs = html.match(/<img[^>]*lotbi-brand-logo-(?:light|dark)[^>]*>/g) ?? [];
  assert.equal(imgs.length, 6, `${page} must have six wordmark images`);
  for (const img of imgs) {
    assert.ok(/alt="LOTBI"/.test(img), `${page} wordmark lost its alt text: ${img.slice(0, 80)}`);
  }
}

// ── 3. Static pages stay on the light wordmark ────────────────────────────
// They have no dark styling at all — styles.css carries no prefers-color-scheme
// block — so a dark wordmark there is white on #f7f8fb.
const styles = read('styles.css');
assert.ok(
  !styles.includes('prefers-color-scheme'),
  'styles.css gained dark styling — the static pages now need themed wordmarks too',
);
for (const page of STATIC_PAGES) {
  const html = read(page);
  assert.ok(
    !html.includes('lotbi-lockup-dark'),
    `${page} has no dark surface, so it must not serve the dark wordmark`,
  );
  assert.ok(html.includes('alt="LOTBI"'), `${page} wordmark lost its alt text`);
}

// ── 4. The CSS decides, and keys on the right things ──────────────────────
const tokens = read('site-theme-tokens.css');
assert.ok(
  /\.lotbi-brand-logo-dark\s*\{\s*display:\s*none/.test(tokens),
  'the dark wordmark must be hidden by default',
);
assert.ok(
  /body\[data-site-theme="dark"\]\s+\.lotbi-brand-logo-dark\s*\{\s*display:\s*block/.test(tokens),
  'explicit Dark must show the dark wordmark',
);
assert.ok(
  /body\[data-site-theme="system"\]\s+\.lotbi-brand-logo-dark\s*\{\s*display:\s*block/.test(tokens),
  'system-following Dark must show the dark wordmark',
);
assert.ok(
  /html\[data-site-theme-bootstrap="dark"\] body:not\(\[data-site-theme\]\)\s+\.lotbi-brand-logo-dark\s*\{\s*display:\s*block/.test(tokens),
  'the pre-paint Dark bootstrap must show the dark wordmark',
);
// The bootstrap="system" block sets tokens but never paints `background`, so
// the surface is still white in that window. Keying the logo to it puts a
// white wordmark on a white page — the flash this change exists to prevent.
assert.ok(
  !/html\[data-site-theme-bootstrap="system"\][^{]*\.lotbi-brand-logo/.test(tokens),
  'the wordmark must not follow the bootstrap="system" state, which does not paint a dark background',
);

// ── 5. The mobile entry chooser rides the same CSS ────────────────────────
const entry = read('mobile-entry.js');
assert.ok(
  entry.includes('lotbi-brand-logo-light') && entry.includes('lotbi-brand-logo-dark'),
  'the mobile entry chooser must ship both wordmarks',
);
assert.ok(
  entry.includes("OFFICIAL_LOGO_DARK_SRC = '/assets/brand/lotbi-lockup-dark-160w.png'"),
  'the mobile entry chooser must know the dark asset',
);

console.log('SITE-BRAND-LOGO-THEME-AWARE-01 OK — the wordmark follows the LOTBI theme, not just the OS');
