// SITE-FOCUS-RING-CONTAINER-01
//
// 대표: "특정부분 클릭하면 이렇게 파란색 줄생기는거 확인하라고 하고"
//
// Measured on the shipped page (Chromium 1600x900, Dark): pressing Tab eight
// times landed focus on <main id="main-content">, and the shared focus rule
//
//   body[data-site-theme="dark"] :where(a, button, input, select, textarea,
//   [tabindex]):focus-visible { outline: 3px solid var(--lotbi-focus-ring)
//   !important; outline-offset: 2px; }
//
// drew a 3px rgb(167,199,255) ring around a box measured at 1240x900 inside a
// 900px viewport. With the +2px offset its top edge sat at y=-2 and its bottom
// at y=902 — both off screen. Only the two vertical sides were visible, which
// is the pair of blue lines down the edges of the content column.
//
// Two things fix it and both have to stay true:
//   1. the element is the skip link's landing target, not a control, so it is
//      focusable programmatically (tabindex="-1") and not a tab stop;
//   2. the ring is drawn INSIDE the box, so when the skip link does land there
//      the indicator is a complete frame. It is never removed: `outline: none`
//      on this element would leave a keyboard user with no landing feedback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const tokens = read('site-theme-tokens.css');
const MARKER = 'SITE-FOCUS-RING-CONTAINER-01';

// ── 1. The scroll container is not a tab stop ────────────────────────────
assert.match(
  html,
  /<main id="main-content" class="chat-home-shell" tabindex="-1">/,
  'main#main-content must carry tabindex="-1": it is the skip link target, not a control. '
  + 'tabindex="0" puts a viewport-sized element in the tab order and its focus ring '
  + 'reaches the screen as two vertical blue lines.',
);
assert.ok(
  !/<main id="main-content"[^>]*tabindex="0"/.test(html),
  'main#main-content must not be restored to tabindex="0"',
);

// The skip link is what makes tabindex="-1" the right value rather than none.
assert.ok(
  html.includes('class="skip-link" href="#main-content"'),
  'the skip link must keep pointing at #main-content — that is why the target stays focusable',
);

// ── 2. The indicator survives, drawn inside the box ──────────────────────
assert.ok(tokens.includes(MARKER), 'site-theme-tokens.css must carry the container focus-ring rule');

const at = tokens.indexOf('#main-content:focus-visible');
assert.ok(at > 0, 'missing rule: #main-content:focus-visible');
const block = tokens.slice(at, tokens.indexOf('}', at));

assert.match(
  block,
  /outline:\s*3px solid var\(--lotbi-focus-ring/,
  'the container must keep a 3px focus ring in the shared focus-ring colour',
);
assert.match(
  block,
  /outline-offset:\s*-3px/,
  'the ring must be drawn inside the box (negative offset) — a positive offset on a '
  + 'viewport-tall element pushes the horizontal edges off screen and leaves only the vertical lines',
);
assert.ok(
  !/outline:\s*(none|0)/.test(block),
  'the focus indicator must never be removed: a keyboard user following the skip link '
  + 'has to see where focus landed',
);

// ── 3. Nothing else in the site removes focus indication wholesale ───────
for (const name of ['styles.css', 'site-theme-tokens.css']) {
  const css = read(name);
  assert.ok(
    !/:focus-visible\s*\{[^}]*outline:\s*(none|0)\s*[;}]/.test(css),
    `${name} must not blanket-remove :focus-visible outlines`,
  );
}

console.log('SITE-FOCUS-RING-CONTAINER-01 OK — scroll container is not a tab stop, ring drawn inside');
