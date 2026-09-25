// FESTIVAL-07 — nav entry, modal wiring, and external-link hygiene.
//
// Static file assertions, no browser — the same style as
// scripts/validate_brand_official_logo_01.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const indexHtml = read('index.html');
const conversationJs = read('site-conversation.js');
const festivalUiJs = read('site-festival-ui.js');
const festivalClientJs = read('site-festival-client.js');
const festivalCss = read('site-festival.css');
const sidebarCss = read('site-sidebar-nav.css');

// ------------------------------------------------------------------- nav --
const festivalTriggers = [...indexHtml.matchAll(/data-festival-open/g)];
assert.equal(festivalTriggers.length, 2, 'the 축제 nav button must exist once in the desktop sidebar and once in the mobile drawer');

const festivalButtonRe = /<button[^>]*data-festival-open[^>]*>[\s\S]*?<\/button>/g;
const festivalButtons = [...indexHtml.matchAll(festivalButtonRe)];
assert.equal(festivalButtons.length, 2);
for (const [button] of festivalButtons) {
  assert.match(button, /aria-label="축제"/, 'the 축제 button must have an accessible label');
  assert.match(button, /lotbi-icon-festival/, 'the 축제 button must use the festival icon symbol');
  assert.match(button, /nav-item-label">축제</, 'the 축제 button must show the short "축제" label');
}

const symbolMatches = [...indexHtml.matchAll(/id="lotbi-icon-festival"/g)];
assert.equal(symbolMatches.length, 1, 'the festival icon symbol must be defined exactly once');

assert.match(indexHtml, /<link rel="stylesheet" href="site-festival\.css(?:\?v=[A-Za-z0-9._-]+)?" \/>/,
  'index.html must link site-festival.css');

assert.match(sidebarCss, /\.sidebar-festival-nav\s*\{/, 'site-sidebar-nav.css must style .sidebar-festival-nav');

// -------------------------------------------------------------- app shell --
assert.match(conversationJs, /const openFestival = async \(\) => \{/, 'site-conversation.js must define openFestival()');
assert.match(conversationJs, /import\(['"]\.\/site-festival-ui\.js(?:\?v=[A-Za-z0-9._-]+)?['"]\)/,
  'openFestival must lazy-load site-festival-ui.js, matching the 반려동물 panel pattern');
assert.match(conversationJs, /mountFestivalManager\(\{root: content\}\)/,
  'openFestival must mount into the shared modal content node');
assert.match(conversationJs, /festivalTrigger = target\?\.closest\('\[data-festival-open\]'\)/,
  'the delegated click handler for [data-festival-open] must exist');
assert.match(conversationJs, /panel\.classList\.add\('site-festival-modal'\)/,
  'the festival modal must carry its sizing modifier class');

// FESTIVAL-04 (private API) must never be imported by the public browse UI —
// only site-festival-client.js may be imported for festival data.
assert.doesNotMatch(festivalUiJs, /^import[^;]*festival_sources[^;]*;/m);
assert.doesNotMatch(festivalUiJs, /^import[^;]*from ['"](?!\.\/site-festival-client\.js)[^'"]*festival[^'"]*['"];/mi);
assert.doesNotMatch(festivalClientJs, /^import[^;]*festival_sources[^;]*;/m);

// --------------------------------------------------------------- CSS ------
assert.match(festivalCss, /\.site-modal\.site-festival-modal\s*\{/, 'the festival modal must have its own sizing rule');
assert.match(festivalCss, /\.festival-chip-row\s*\{[^}]*flex-wrap:\s*wrap/,
  'chip rows (used for the 17-region filter) must wrap, never a vertical list');
assert.doesNotMatch(festivalCss, /\.festival-region-row\s*\{[^}]*flex-direction:\s*column/,
  'the region row must not be forced into a vertical column layout');

// ------------------------------------------------------- external links ---
// Every target="_blank" anchor built in site-festival-ui.js must carry
// rel="noopener noreferrer" and something readable that marks it external.
const anchorBlocks = [...festivalUiJs.matchAll(/link\.target = '_blank';[\s\S]{0,400}?(?=\n\s*(?:if |return|\}))/g)]
  .map(match => match[0]);
assert.ok(anchorBlocks.length >= 2, 'expected reservation and official-source external links');
for (const block of anchorBlocks) {
  assert.match(block, /link\.rel = 'noopener noreferrer'/, 'external link missing rel=noopener noreferrer');
  assert.match(block, /외부 사이트/, 'external link must tell the user it leaves the site');
}

// -------------------------------------------------- price non-aggregation --
assert.doesNotMatch(festivalUiJs, /totalPrice|priceTotal|sumPrice|합계.*가격|총\s*가격/,
  'the UI must never compute or display a summed/total price across programs');
assert.doesNotMatch(festivalClientJs, /totalPrice|priceTotal|sumPrice/);

console.log('FESTIVAL NAV WIRING VALIDATION PASS — nav entry (desktop+mobile), modal wiring, private-API isolation, chip layout, and external-link hygiene verified.');
