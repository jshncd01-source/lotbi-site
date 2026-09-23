// SITE-FOCUS-RING-CONTAINER-01
//
// 대표: "특정부분 클릭하면 이렇게 파란색 줄생기는거 확인하라고 하고"
//
// Measured on the shipped page (Chromium 1600x900, Dark): Tab reaches
// <main id="main-content">, and the shared focus rule
//
//   body[data-site-theme="dark"] :where(a, button, input, select, textarea,
//   [tabindex]):focus-visible { outline: 3px solid var(--lotbi-focus-ring)
//   !important; outline-offset: 2px; }
//
// drew a 3px rgb(167,199,255) ring around a box measured at 1240x900 inside a
// 900px viewport. With the +2px offset the ring's top edge sat at y=-2 and its
// bottom at y=902 — both off screen. Only the two vertical sides were visible,
// which is the pair of blue lines down the edges of the content column.
//
// The tab stop is NOT the defect and must not be removed. #main-content owns
// the page's vertical scrolling, and a scrollable region has to be reachable by
// keyboard; validate_chat_layout_attachment_01 measures that contract directly
// (mainOverflow "auto", mainTabIndex 0, "main pane must accept scrolling").
// An earlier revision of this fix dropped the element to tabindex="-1" and that
// gate caught it in CI.
//
// What is wrong is where the ring is drawn. Drawing it inside keeps the
// indicator — same width, same colour, same contrast — and makes it a complete
// frame instead of two clipped edges. Removing it is not an option either:
// `outline: none` would leave a keyboard user with no idea where focus is.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const tokens = read('site-theme-tokens.css');
const MARKER = 'SITE-FOCUS-RING-CONTAINER-01';

// ── 1. The scroll container stays keyboard reachable ─────────────────────
assert.match(
  html,
  /<main id="main-content" class="chat-home-shell" tabindex="0">/,
  'main#main-content must keep tabindex="0": it owns vertical scrolling, and a scrollable '
  + 'region has to be reachable by keyboard. Fix the ring geometry, never the tab stop.',
);
assert.ok(
  html.includes('class="skip-link" href="#main-content"'),
  'the skip link must keep pointing at #main-content',
);

// ── 2. The ring is drawn inside the box ──────────────────────────────────
assert.ok(tokens.includes(MARKER), 'site-theme-tokens.css must carry the container focus-ring rule');

const at = tokens.indexOf('#main-content:focus-visible');
assert.ok(at > 0, 'missing rule: #main-content:focus-visible');
const block = tokens.slice(at, tokens.indexOf('}', at));

assert.match(
  block,
  /outline:\s*3px solid var\(--lotbi-focus-ring/,
  'the container must keep a 3px focus ring in the shared focus-ring colour',
);
const offset = block.match(/outline-offset:\s*(-?\d+)px/);
assert.ok(offset, '#main-content:focus-visible must set an explicit outline-offset');
assert.ok(
  Number(offset[1]) < 0,
  `outline-offset is ${offset[1]}px; it must be negative. A positive offset on an element as tall `
  + 'as the viewport pushes the horizontal edges off screen and leaves only the vertical lines.',
);
// The ring is 3px wide, so an offset smaller than -3px would eat into content.
assert.ok(
  Number(offset[1]) >= -3,
  `outline-offset ${offset[1]}px pulls the ring further inside than its own width`,
);
assert.ok(
  !/outline:\s*(none|0)/.test(block),
  'the focus indicator must never be removed: a keyboard user has to see where focus is',
);

// ── 3. The rule must win the offset, and only the offset ─────────────────
// The theme rules carry !important on `outline`, so this rule deliberately does
// not: it overrides the offset by ID specificity and leaves width and colour to
// the shared a11y rules, which is what keeps the two in step.
assert.ok(
  !block.includes('!important'),
  'this rule must not use !important — width and colour stay owned by the shared focus rules',
);
for (const shared of [
  'body[data-site-theme="dark"] :where(a, button, input, select, textarea, [tabindex]):focus-visible',
  'body[data-site-theme="system"] :where(a, button, input, select, textarea, [tabindex]):focus-visible',
]) {
  assert.ok(
    tokens.includes(shared),
    `the shared focus rule must still exist (${shared.slice(0, 40)}…) — this fix is an offset `
    + 'override on top of it, not a replacement',
  );
}

// ── 4. Nothing blanket-removes focus indication ──────────────────────────
for (const name of ['styles.css', 'site-theme-tokens.css']) {
  const css = read(name);
  assert.ok(
    !/:focus-visible\s*\{[^}]*outline:\s*(none|0)\s*[;}]/.test(css),
    `${name} must not blanket-remove :focus-visible outlines`,
  );
}

console.log('SITE-FOCUS-RING-CONTAINER-01 OK — tab stop kept, ring drawn inside the viewport');
