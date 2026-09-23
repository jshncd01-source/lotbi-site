// SITE-DARK-CONVERSATION-LIST-CONTRAST-01
//
// 대표: "다크모드에서 채팅 카테고리 글자가 너무 어두워서 안보인다. 해당 대화중인
// 카테고리를 클릭하면 더욱더 안보이니깐 해결해"
//
// The selected row flipped its background to #262e3a in Dark while its text
// stayed --brand-navy (#182a46): 1.05:1. The unselected rows sat at #555d69 on
// #151922: 2.64:1. Both came from raw colours with no dark form.
//
// This gate does not just check that a token is referenced — it reads the token
// values out of the stylesheet and computes the contrast, so a future palette
// change that quietly drops a row below AA fails here rather than in someone's
// eyes. It also pins the light values, because the fix was only allowed to
// change Dark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const tokens = read('site-theme-tokens.css');
const sidebarCss = read('site-sidebar-nav.css');
const homeChat = read('home-chat.css');
const bareWhite = read('home-bare-white.css');

// ── contrast maths (WCAG 2.1 relative luminance) ──────────────────────────
const channel = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = hex => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const AA = 4.5;

// ── 1. The raw brand colour is out of the conversation list ───────────────
const selectedRule = sidebarCss.match(/\.nav-history-list button\[aria-current="true"\]\s*\{[^}]*\}/)?.[0];
assert.ok(selectedRule, 'the selected-conversation rule must exist');
assert.ok(
  !selectedRule.includes('--brand-navy'),
  'the selected conversation must not be painted with --brand-navy, which has no dark form',
);
assert.ok(
  selectedRule.includes('--lotbi-nav-history-text-active'),
  'the selected conversation must follow the theme token',
);

const listRule = homeChat.match(/\.nav-history-list li\s*\{[^}]*\}/)?.[0];
assert.ok(listRule, 'the conversation list rule must exist');
assert.ok(
  listRule.includes('--lotbi-nav-history-text'),
  'unselected conversations must follow the theme token',
);

// ── 2. Both tokens are defined in every theme state ───────────────────────
// light (:root), explicit dark, system-follows-dark, and the pre-paint
// bootstrap — the same four this file already maintains for surface colours.
for (const token of ['--lotbi-nav-history-text', '--lotbi-nav-history-text-active']) {
  const defs = tokens.match(new RegExp(`${token}:\\s*#[0-9a-fA-F]{6}`, 'g')) ?? [];
  assert.equal(defs.length, 4, `${token} must be defined in all four theme states, found ${defs.length}`);
}

const valueIn = (block, token) => block.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
const lightBlock = tokens.slice(0, tokens.indexOf('body[data-site-theme="dark"]'));
const darkBlock = tokens.slice(tokens.indexOf('body[data-site-theme="dark"] {'));

const lightText = valueIn(lightBlock, '--lotbi-nav-history-text');
const lightActive = valueIn(lightBlock, '--lotbi-nav-history-text-active');
const darkText = valueIn(darkBlock, '--lotbi-nav-history-text');
const darkActive = valueIn(darkBlock, '--lotbi-nav-history-text-active');
for (const [name, v] of [['light text', lightText], ['light active', lightActive],
  ['dark text', darkText], ['dark active', darkActive]]) {
  assert.ok(v, `could not read the ${name} token value`);
}

// ── 3. Light is unchanged — the fix was only allowed to touch Dark ────────
assert.equal(lightText, '#555d69', 'the light unselected colour must not change');
assert.equal(lightActive, '#182a46', 'the light selected colour must not change');

// ── 4. Every row clears AA against the surface it actually sits on ────────
// Surfaces come from home-bare-white.css, so a palette change there is caught
// too rather than silently invalidating these numbers.
const surface = (name, fallback) => bareWhite.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? fallback;
const lightBg = '#ffffff';
const lightSelectedBg = surface('--home-skin-selected', '#f1f3f5');
const darkBg = bareWhite.match(/--home-skin-bg:\s*(#151922)/)?.[1] ?? '#151922';
const darkSelectedBg = bareWhite.match(/--home-skin-selected:\s*(#262e3a)/)?.[1] ?? '#262e3a';

const rows = [
  ['light / unselected', lightText, lightBg],
  ['light / selected', lightActive, lightSelectedBg],
  ['dark / unselected', darkText, darkBg],
  ['dark / selected', darkActive, darkSelectedBg],
];
for (const [label, fg, bg] of rows) {
  const ratio = contrast(fg, bg);
  assert.ok(
    ratio >= AA,
    `${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${AA}:1 minimum`,
  );
}

// ── 5. Selected and unselected must still be distinguishable ──────────────
// Fixing contrast by making every row the same bright colour would pass the
// checks above and lose the selection cue.
assert.notEqual(darkText, darkActive, 'Dark must still distinguish the selected conversation');
assert.notEqual(lightText, lightActive, 'Light must still distinguish the selected conversation');
assert.ok(
  selectedRule.includes('font-weight'),
  'the selected conversation must keep a non-colour cue as well',
);

const report = rows.map(([l, fg, bg]) => `${l} ${contrast(fg, bg).toFixed(2)}:1`).join(', ');
console.log(`SITE-DARK-CONVERSATION-LIST-CONTRAST-01 OK — ${report}`);
