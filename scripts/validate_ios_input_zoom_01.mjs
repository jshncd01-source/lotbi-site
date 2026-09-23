// SITE-IOS-INPUT-ZOOM-01
//
// 대표: "이렇게 입력하려고 눌렀을 때 확대 안 되고 기존 화면 그대로 있는 게 좋을
// 것 같애. 화면 크기에 맞게"
//
// iOS Safari zooms the whole page in when a focused field's text measures under
// 16px, which scrolls the form sideways and cuts off its right edge. The shared
// .site-field controls inherited the label's 14px, and its textareas were not in
// the rule at all so they sat at the UA default 13.33px. Every form built on
// .site-field had it: the pet sighting report 대표 walked into, the profile
// modal, personalization.
//
// The fix is the font size, and this gate also guards the wrong fix — killing
// the zoom with `maximum-scale=1, user-scalable=no` would take pinch-zoom away
// from everyone who needs it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const conversationCss = read('site-conversation.css');

// ── 1. The shared controls reach 16px on mobile ───────────────────────────
// Matched inside a max-width media query, because desktop deliberately keeps
// the smaller text — Safari there does not do this.
const mobileBlocks = [...conversationCss.matchAll(/@media \(max-width: (\d+)px\)\s*\{([\s\S]*?)\n\}/g)];
const zoomRule = mobileBlocks
  .map(([, width, body]) => ({width: Number(width), body}))
  .find(({body}) => /\.site-field input[\s\S]{0,200}font-size:\s*16px/.test(body));

assert.ok(
  zoomRule,
  '.site-field controls must reach 16px inside a mobile media query, or iOS Safari zooms on focus',
);
assert.ok(
  zoomRule.width >= 768,
  `the mobile breakpoint for this rule is ${zoomRule.width}px; Safari zooms on every iOS viewport, `
  + 'and an iPad in portrait is 768px, so the rule has to reach at least that far',
);
for (const control of ['input', 'select', 'textarea']) {
  assert.ok(
    new RegExp(`\\.site-field ${control}`).test(zoomRule.body),
    `.site-field ${control} must be covered — 대표 walked into a text field, but any of these zooms`,
  );
}

// textarea was missing from the base rule entirely, which is why it sat below
// even the inputs. Keep it there so it matches them.
assert.ok(
  /\.site-field input, \.site-field select, \.site-field textarea \{/.test(conversationCss),
  '.site-field textarea must share the base control styling with input and select',
);

// ── 2. The forbidden workaround must never appear ─────────────────────────
// Locking the viewport stops the zoom by removing pinch-zoom, which is the
// accessibility affordance the zoom is borrowing from in the first place.
const htmlFiles = ['index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html',
  'account-deletion.html', '404.html', 'android-auth-test.html', 'auth/callback/index.html'];
for (const rel of htmlFiles) {
  const html = read(rel);
  for (const forbidden of ['maximum-scale', 'user-scalable']) {
    assert.ok(
      !html.includes(forbidden),
      `${rel}: ${forbidden} must not be used to suppress the zoom — it takes pinch-zoom away from users who need it`,
    );
  }
  // Spelling varies (some pages add viewport-fit=cover, some omit the spaces).
  // What has to hold is that the page sizes to the device and starts at 1:1;
  // the zoom-suppressing keywords are forbidden above.
  const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1];
  assert.ok(viewport, `${rel}: the viewport meta must be present`);
  assert.ok(
    /width=device-width/.test(viewport) && /initial-scale=1\b/.test(viewport),
    `${rel}: the viewport meta must stay open to user zoom, found "${viewport}"`,
  );
}

// ── 3. Note on what is deliberately not covered ───────────────────────────
// The profile photo picker is <input type="file" class="sr-only">, rendered
// 1x1. A file input opens the photo picker rather than a text keyboard, so it
// never triggers the zoom, and it carries no visible text to size. If it ever
// stops being sr-only this assertion is the reminder to look again.
assert.ok(
  /photo\.className = 'sr-only'/.test(read('site-conversation.js')),
  'the profile photo input is exempt only because it is visually hidden and opens a picker, not a keyboard',
);

console.log(`SITE-IOS-INPUT-ZOOM-01 OK — .site-field controls reach 16px at <=${zoomRule.width}px, viewport stays zoomable`);
