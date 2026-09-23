// SITE-DARK-DRAWER-SURFACE-01
//
// 대표: "모바일 사이트에서 다크모드인데 메뉴 클릭하면 화이트로 나오고 글자들도 다
// 식별이 안 된다"
//
// The drawer was fine on Home and broke the moment a conversation started. Not
// because .conversation-active fails to apply — it applies exactly as intended,
// and that is the problem. home-bare-white.css is the only place that paints
// these surfaces in both themes, and it is scoped to :not(.conversation-active).
// Once the class lands it stops applying and home-chat.css's hardcoded #f7f8fb
// shows through, under text the dark theme had already lightened.
//
// Underneath that sat a plain asymmetry between two blocks of
// site-theme-tokens.css, each missing what the other had:
//
//   body[data-site-theme="dark"]   nav text ✓   surface background ✗
//   body[data-site-theme="system"] surface background ✓   nav text ✗
//
// So explicit Dark gave light surface + light text, and system-on-a-dark-OS gave
// dark surface + navy text. Opposite failures, one root.
//
// This gate locks the symmetry rather than the two symptoms: whatever one block
// declares for these surfaces, the other has to declare too. That is what stops
// the next screen from losing one half again.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = fs.readFileSync(path.join(ROOT, 'site-theme-tokens.css'), 'utf8');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Collect the properties a theme block declares for a :where(...) group that
// covers all of `targets`. Targets are matched as plain substrings of the
// selector list, so they are written here exactly as they appear in the CSS.
const declarationsFor = (source, themeSelector, targets) => {
  const pattern = new RegExp(
    `${escapeRegExp(themeSelector)}\\s+:where\\(([^)]*)\\)\\s*\\{([^}]*)\\}`,
    'g',
  );
  const found = new Set();
  for (const [, group, body] of source.matchAll(pattern)) {
    if (!targets.every(target => group.includes(target))) continue;
    for (const decl of body.split(';')) {
      const [prop] = decl.split(':');
      if (prop && prop.trim()) found.add(prop.trim());
    }
  }
  return found;
};

const SURFACES = ['.chat-sidebar', '.mobile-nav-drawer'];
const NAV_TEXT = ['.nav-item', '.nav-section-title'];

// ── 1. Both theme paths paint the drawer and sidebar surface ──────────────
for (const [label, selector] of [['explicit Dark', 'body[data-site-theme="dark"]'],
  ['system Dark', 'body[data-site-theme="system"]']]) {
  const decls = declarationsFor(tokens, selector, SURFACES);
  assert.ok(
    decls.has('background'),
    `${label} must paint .chat-sidebar / .mobile-nav-drawer — without it the drawer falls back to `
    + "home-chat.css's hardcoded #f7f8fb the moment .conversation-active lands",
  );
  assert.ok(decls.has('color'), `${label} must set the surface text colour alongside the background`);
  assert.ok(decls.has('border-color'), `${label} must set the surface border colour`);
}

// ── 2. Both theme paths colour the navigation text ────────────────────────
for (const [label, selector] of [['explicit Dark', 'body[data-site-theme="dark"]'],
  ['system Dark', 'body[data-site-theme="system"]']]) {
  const decls = declarationsFor(tokens, selector, NAV_TEXT);
  assert.ok(
    decls.has('color'),
    `${label} must colour .nav-item / .nav-section-title — without it the labels keep their light `
    + 'value on a dark surface',
  );
}

// ── 3. The one nav item with its own surface follows too ──────────────────
// 새 대화 carries a white pill and --brand-navy text from home-chat.css. Home
// flattens it to transparent so it inherits the theme; a conversation does not,
// and the raw white came back under the dark theme's light label.
for (const [label, selector] of [['explicit Dark', 'body[data-site-theme="dark"]'],
  ['system Dark', 'body[data-site-theme="system"]']]) {
  const decls = declarationsFor(tokens, selector, ['.nav-item-primary']);
  for (const property of ['background', 'color', 'border-color']) {
    assert.ok(
      decls.has(property),
      `${label} must set ${property} on .nav-item-primary — otherwise 새 대화 keeps its white pill in a conversation`,
    );
  }
}

// ── 4. home-bare-white.css stays Home-scoped, and keeps both themes ───────
// It is not the bug and must not be deleted: its :not(.conversation-active)
// prefix is a specificity escalation over the runtime-injected
// site-conversation.css, and it is what keeps Home's skin intact. What it may
// not do is be the only place a dark surface is defined.
const bareWhite = fs.readFileSync(path.join(ROOT, 'home-bare-white.css'), 'utf8');
assert.ok(
  bareWhite.includes('--home-skin-bg: #ffffff') && bareWhite.includes('--home-skin-bg: #151922'),
  'home-bare-white.css must keep defining both themes for the Home skin',
);
assert.ok(
  /body\.chat-home-page:not\(\.conversation-active\)/.test(bareWhite),
  'home-bare-white.css must stay scoped to Home',
);

console.log('SITE-DARK-DRAWER-SURFACE-01 OK — both theme paths paint the drawer surface and its labels');
