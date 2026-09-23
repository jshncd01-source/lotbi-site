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
// SITE-STATIC-PAGES-THEME-01 — these six are reachable from the footer and now
// follow the LOTBI theme through site-static-theme.css, so they carry both
// wordmarks like index.html does.
const THEMED_STATIC_PAGES = [
  'about.html', 'contact.html', 'privacy.html', 'terms.html',
  'account-deletion.html', '404.html',
  'subscribe.html', 'refund.html', 'exchange.html', 'dispute.html',
];
// Still genuinely always-light: neither is reachable from the footer and
// neither loads the static theme.
const STATIC_PAGES = ['android-auth-test.html', 'auth/callback/index.html'];

// ── 1. The OS-only mechanism is gone everywhere ───────────────────────────
for (const page of [...THEMED_PAGES, ...THEMED_STATIC_PAGES, ...STATIC_PAGES]) {
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

// ── 3a. Footer-reachable pages carry both wordmarks ───────────────────────
// SITE-STATIC-PAGES-THEME-01 — this block used to assert the opposite, on the
// premise that these pages had no dark surface. They do now, so the premise
// moved and the invariant did not: the wordmark tracks the painted surface.
// A single light lockup here would be navy on #151922.
const staticTheme = read('site-static-theme.css');
for (const page of THEMED_STATIC_PAGES) {
  const html = read(page);
  assert.ok(
    html.includes('site-static-theme.css'),
    `${page} must load site-static-theme.css — that is what paints its dark surface`,
  );
  for (const variant of ['light', 'dark']) {
    assert.ok(
      html.includes(`lotbi-brand-logo-${variant}`),
      `${page} is missing its ${variant} wordmark variant`,
    );
  }
  assert.ok(
    /lotbi-brand-logo-dark" src="\/assets\/brand\/lotbi-lockup-dark-160w\.png/.test(html),
    `${page} dark wordmark must use the dark asset`,
  );
  const imgs = html.match(/<img[^>]*lotbi-brand-logo-(?:light|dark)[^>]*>/g) ?? [];
  assert.equal(imgs.length, 2, `${page} must have exactly one wordmark pair`);
  for (const img of imgs) {
    assert.ok(/alt="LOTBI"/.test(img), `${page} wordmark lost its alt text: ${img.slice(0, 80)}`);
  }
}

// The static theme has to hide the off-variant, or both lockups render at once.
assert.ok(
  /\.lotbi-brand-logo-dark\s*\{\s*display:\s*none/.test(staticTheme),
  'site-static-theme.css must hide the dark wordmark by default',
);
assert.ok(
  /html\[data-site-theme-bootstrap="dark"\] \.lotbi-brand-logo-dark\s*\{\s*display:\s*block/.test(staticTheme),
  'explicit Dark must show the dark wordmark on the static pages',
);

// ── 3b. The genuinely always-light pages stay light ───────────────────────
// styles.css itself must still carry no dark block: the static theme lives in
// its own file, which these two pages do not load.
const styles = read('styles.css');
assert.ok(
  !styles.includes('prefers-color-scheme'),
  'styles.css gained dark styling — android-auth-test and the auth callback would inherit it',
);
for (const page of STATIC_PAGES) {
  const html = read(page);
  assert.ok(
    !html.includes('site-static-theme.css'),
    `${page} is not footer-reachable and must stay on the always-light path`,
  );
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
// Matched allowing a selector group: this rule now also carries the pre-paint
// bootstrap="system" selector beside it.
assert.ok(
  /body\[data-site-theme="system"\]\s+\.lotbi-brand-logo-dark[^{]*\{\s*display:\s*block/.test(tokens),
  'system-following Dark must show the dark wordmark',
);
assert.ok(
  /html\[data-site-theme-bootstrap="dark"\] body:not\(\[data-site-theme\]\)\s+\.lotbi-brand-logo-dark\s*\{\s*display:\s*block/.test(tokens),
  'the pre-paint Dark bootstrap must show the dark wordmark',
);
// SITE-THEME-BOOTSTRAP-FIRST-PAINT-01 — this used to assert the opposite. The
// bootstrap="system" block once set tokens without painting `background`, so a
// logo keyed to it went white-on-white in the pre-paint window. That block now
// paints its background, so the wordmark has to follow it or the first frame
// carries a navy wordmark on #151922. The invariant is unchanged — the logo
// tracks the painted surface — only the surface changed.
assert.ok(
  /html\[data-site-theme-bootstrap="system"\] body:not\(\[data-site-theme\]\) \.lotbi-brand-logo-dark/.test(tokens),
  'the wordmark must follow the bootstrap="system" state now that it paints a dark background',
);
assert.ok(
  /html\[data-site-theme-bootstrap="system"\] body:not\(\[data-site-theme\]\)\s*\{[^}]*background:\s*#151922/.test(tokens),
  'the bootstrap="system" block must paint its background — the logo rule above depends on it',
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
