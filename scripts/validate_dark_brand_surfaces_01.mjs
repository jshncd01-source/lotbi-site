// SITE-DARK-BRAND-SURFACES-01 — the LOTBI navy, given a Dark form.
//
// styles.css already carried the warning, right above the colour:
//
//   /* Raw brand colours. These have no Dark form: anything that paints text
//      or an icon with them goes unreadable the moment a surface flips. */
//   --brand-navy: #182A46;
//
// The note was right and four controls were still reaching for it. Measured in
// a real browser on the Dark Home, every one of them sat at 1.22:1 — the
// contrast of #182a46 against #151922, which is to say invisible:
//
//   .mobile-menu-button / .mobile-drawer-close   the hamburger, and the control
//                                                that gets you back out of the
//                                                drawer
//   .mobile-drawer-header                        PR #228 painted the drawer
//                                                surface from both theme paths;
//                                                the text on it kept the navy
//   .account-signup                              a navy pill on a navy-black
//                                                page
//   .skip-link                                   the first thing a keyboard
//                                                user lands on
//
// The remaining --brand-navy uses are NOT defects and were deliberately left
// alone: about.css only ever serves about.html, mobile-entry.css paints its own
// always-white card, and six of the eight in styles.css appear only on the
// static pages. None of those surfaces can flip, because none of those pages
// loads site-theme-tokens.css or receives body[data-site-theme]. A blanket
// token substitution across all 45 uses was tried once before and turned CI red
// (7b90eef); this change moves the four that measurably break and no others.
//
// The last gate here is the general one. Today's defects were not missing
// code — they were code wired on one side only, and this file's job is to make
// a half-wired token impossible rather than to catch this particular four.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const tokens = read('site-theme-tokens.css');
const homeChat = read('home-chat.css');
const styles = read('styles.css');

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

// ── theme blocks ──────────────────────────────────────────────────────────
// The file states every token four times: light, explicit Dark, system while
// the OS is Dark, and the pre-paint bootstrap. Half of today's bugs lived in
// the gap between two of them, so each is read separately rather than the file
// being searched as one string.
const block = (label, opening) => {
  const start = tokens.indexOf(opening);
  assert.notEqual(start, -1, `could not find the ${label} token block`);
  let depth = 0;
  let at = tokens.indexOf('{', start);
  const from = at;
  for (; at < tokens.length; at += 1) {
    if (tokens[at] === '{') depth += 1;
    else if (tokens[at] === '}' && (depth -= 1) === 0) break;
  }
  return tokens.slice(from, at);
};

const BLOCKS = {
  light: block('light', ':root,\nbody[data-site-theme="light"] {'),
  dark: block('explicit Dark', 'body[data-site-theme="dark"] {\n  color-scheme: dark;'),
  system: block('system Dark', 'body[data-site-theme="system"],\n  html[data-site-theme-bootstrap="system"] body:not([data-site-theme]) {'),
  bootstrap: block('pre-paint Dark', 'html[data-site-theme-bootstrap="dark"] body:not([data-site-theme]) {'),
};

const declared = source => new Set([...source.matchAll(/(--lotbi-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
const valueOf = (source, token) => source.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1];

// ── 1. The four controls follow the token, not the raw brand colour ───────
// Comments are dropped: these rules explain in prose why they no longer use
// --brand-navy, and a gate that reads its own explanation as a violation is
// worse than no gate.
const ruleFor = (source, selector) => {
  const at = source.indexOf(selector + ' {');
  assert.notEqual(at, -1, `could not find the rule for ${selector}`);
  return source.slice(at, source.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
};

const MOVED = [
  [homeChat, '.mobile-menu-button,\n.mobile-drawer-close', ['--lotbi-brand-ink'],
    'the hamburger and the drawer close control'],
  [homeChat, '.mobile-drawer-header', ['--lotbi-brand-ink'], 'the drawer header'],
  [homeChat, '.account-signup', ['--lotbi-brand-solid-bg', '--lotbi-brand-solid-text'], '회원가입'],
  [styles, '.skip-link', ['--lotbi-brand-solid-bg', '--lotbi-brand-solid-text'], 'the keyboard skip target'],
];
for (const [source, selector, expected, label] of MOVED) {
  const rule = ruleFor(source, selector);
  for (const declaration of rule.split(';')) {
    if (!declaration.includes('--brand-navy')) continue;
    // Allowed in exactly one shape: the last-resort fallback behind a token,
    // for pages that never load site-theme-tokens.css. Anything else means the
    // control is painted navy again and goes to 1.22:1 the moment Dark lands.
    assert.match(declaration, /var\(--lotbi-brand-[a-z-]+,\s*var\(--brand-navy\)\)/,
      `${label} paints with --brand-navy (\`${declaration.trim()}\`), which is 1.22:1 on #151922`);
  }
  for (const token of expected) {
    assert.ok(rule.includes(token), `${label} must follow ${token}`);
  }
}

// styles.css is also served to the always-light pages, which never load
// site-theme-tokens.css. Without a fallback the skip link would lose its colour
// there entirely, so the fallback is part of the contract, not a nicety.
assert.match(ruleFor(styles, '.skip-link'), /var\(--lotbi-brand-solid-bg,\s*var\(--brand-navy\)\)/,
  'the skip link must fall back to --brand-navy for the always-light pages');

// The always-light pages must keep the navy: nothing may start theming them
// through this file, which has no dark surface to sit on.
assert.ok(!styles.includes('prefers-color-scheme'),
  'styles.css gained dark styling — the static pages would need themed surfaces too');

// ── 2. The pages that cannot flip were left alone, on purpose ─────────────
// This is an assertion about restraint. If someone later decides about.css or
// mobile-entry.css should be themed, that is a real decision with real surfaces
// to re-check — it should not happen as a side effect of a find-and-replace.
for (const [file, count] of [['about.css', 5], ['mobile-entry.css', 4]]) {
  const uses = (read(file).match(/--brand-navy/g) || []).length;
  assert.equal(uses, count,
    `${file} changed its --brand-navy use from ${count} to ${uses}. Those surfaces are light in `
    + 'every theme (no body[data-site-theme], no site-theme-tokens.css), so if this is deliberate, '
    + 're-verify the pages in Dark and update this count.');
}

// ── 3. Every token is wired on all four sides ─────────────────────────────
// The general guard. Not "these four tokens exist" — every semantic token this
// file defines has to be defined in all four theme states. A token present in
// light and missing from system is exactly the shape of SITE-DARK-DRAWER-
// SURFACE-01 and SITE-BRAND-LOGO-THEME-AWARE-01, and it is silent until
// somebody with that combination looks at the screen.
const lightTokens = declared(BLOCKS.light);
assert.ok(lightTokens.size >= 27, `expected the full token set, found ${lightTokens.size}`);
for (const [label, source] of [['explicit Dark', BLOCKS.dark], ['system Dark', BLOCKS.system],
  ['pre-paint Dark', BLOCKS.bootstrap]]) {
  const here = declared(source);
  const missing = [...lightTokens].filter(t => !here.has(t)).sort();
  const extra = [...here].filter(t => !lightTokens.has(t)).sort();
  assert.deepEqual(missing, [], `${label} is missing ${missing.join(', ')} — half-wired token`);
  assert.deepEqual(extra, [], `${label} defines ${extra.join(', ')} with no light counterpart`);
}

// ── 4. Light is byte-for-byte what it was ─────────────────────────────────
// 대표님 reported Dark. Light was not broken and must not move, so the light
// values are pinned to the hardcoded colours they replaced.
for (const [token, was] of [
  ['--lotbi-brand-ink', '#182a46'],
  ['--lotbi-brand-solid-bg', '#182a46'],
  ['--lotbi-brand-solid-bg-hover', '#243b61'],
  ['--lotbi-brand-solid-text', '#ffffff'],
]) {
  assert.equal(valueOf(BLOCKS.light, token), was,
    `${token} must keep the Light appearance it replaced (${was})`);
}

// ── 5. And Dark actually reads ────────────────────────────────────────────
const PAGE = '#151922';   // --lotbi-bg-primary
const DRAWER = '#151922'; // the drawer is painted from the same token
const measured = [];
for (const [label, source] of [['explicit Dark', BLOCKS.dark], ['system Dark', BLOCKS.system],
  ['pre-paint Dark', BLOCKS.bootstrap]]) {
  const ink = valueOf(source, '--lotbi-brand-ink');
  const solid = valueOf(source, '--lotbi-brand-solid-bg');
  const solidHover = valueOf(source, '--lotbi-brand-solid-bg-hover');
  const solidText = valueOf(source, '--lotbi-brand-solid-text');
  for (const [name, fg, bg, minimum] of [
    ['menu button / drawer header on page', ink, PAGE, AA],
    ['drawer header on drawer', ink, DRAWER, AA],
    ['회원가입 surface against the page', solid, PAGE, 3],
    ['회원가입 label on its surface', solidText, solid, AA],
    ['회원가입 hover surface against the page', solidHover, PAGE, 3],
    ['회원가입 label on hover', solidText, solidHover, AA],
  ]) {
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= minimum,
      `${label}: ${name} is ${ratio.toFixed(2)}:1, below ${minimum}:1`);
    measured.push(`${label.padEnd(14)} ${name.padEnd(38)} ${ratio.toFixed(2)}:1`);
  }
}

// The regression itself, stated as a number so the gate says what it prevents.
assert.ok(contrast('#182a46', PAGE) < 2,
  'the premise of this gate changed: --brand-navy is no longer low-contrast on the dark page');

for (const line of measured) console.log('  ' + line);
console.log(`  raw --brand-navy on ${PAGE} would be ${contrast('#182a46', PAGE).toFixed(2)}:1 — what this replaces`);
console.log('DARK BRAND SURFACES CONTRACT: PASS');
