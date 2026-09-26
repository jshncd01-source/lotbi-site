// FESTIVAL-EVENT-08 — nav entry, modal wiring, and external-link hygiene.
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
assert.equal(festivalTriggers.length, 2, 'the 축제·행사 nav button must exist once in the desktop sidebar and once in the mobile drawer');

const festivalButtonRe = /<button[^>]*data-festival-open[^>]*>[\s\S]*?<\/button>/g;
const festivalButtons = [...indexHtml.matchAll(festivalButtonRe)];
assert.equal(festivalButtons.length, 2);
for (const [button] of festivalButtons) {
  assert.match(button, /aria-label="축제·행사"/, 'the 축제·행사 button must have an accessible label using the renamed category');
  assert.match(button, /lotbi-icon-festival/, 'the 축제·행사 button must use the festival icon symbol (internal id unchanged by the rename)');
  assert.match(button, /nav-item-label">축제·행사</, 'the 축제·행사 button must show the renamed "축제·행사" label');
}

const festivalGroupRe = /<div class="sidebar-festival-nav"[^>]*>/g;
const festivalGroups = [...indexHtml.matchAll(festivalGroupRe)];
assert.equal(festivalGroups.length, 2);
for (const [group] of festivalGroups) {
  assert.match(group, /aria-label="축제·행사"/, 'the nav group must carry the renamed accessible label');
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
assert.match(conversationJs, /modalShell\('축제·행사',/,
  'the festival modal title must use the renamed "축제·행사" category, not the old bare "축제"');
assert.match(conversationJs, /내 주변부터 이번 주말·이번 달 전국 축제와 행사를 찾아보세요/,
  'the festival modal subtitle must point at nearby/this-weekend/this-month browsing');

// FESTIVAL-04 (private API) must never be imported by the public browse UI —
// only site-festival-client.js (festival data) and site-festival-weather.js
// (FESTIVAL-EVENT-09 program-date weather orchestration, itself only ever
// reusing the existing Calendar weather client/normalizer) may be imported.
assert.doesNotMatch(festivalUiJs, /^import[^;]*festival_sources[^;]*;/m);
assert.doesNotMatch(
  festivalUiJs,
  /^import[^;]*from ['"](?!\.\/site-festival-client\.js|\.\/site-festival-weather\.js)[^'"]*festival[^'"]*['"];/mi,
);
assert.doesNotMatch(festivalClientJs, /^import[^;]*festival_sources[^;]*;/m);

// --------------------------------------------------------------- CSS ------
assert.match(festivalCss, /\.site-modal\.site-festival-modal\s*\{/, 'the festival modal must have its own sizing rule');
assert.match(festivalCss, /\.festival-chip-row\s*\{[^}]*flex-wrap:\s*wrap/,
  'chip rows (time filter, program category) must wrap, never a vertical list');
assert.doesNotMatch(festivalCss, /\.festival-region-row\s*\{/,
  'a permanent always-on region chip row must not exist — region choice lives inside the "지역 변경" sheet');

// ---------------------------------------------------- FESTIVAL-EVENT-07 ---
// Real Core browse/regions contract, current-location permission reuse
// (no new geolocation contract), and no fixture path in production.
assert.match(festivalClientJs, /\/festivals\/browse/, 'the client must target the real Core browse endpoint');
assert.match(festivalClientJs, /\/festivals\/regions/, 'the client must target the real Core region catalog endpoint');
assert.doesNotMatch(festivalClientJs, /FESTIVAL_FIXTURES|FESTIVAL_API_ENABLED\s*=\s*false/,
  'no fixture generator or disabled-API flag may remain in the production client');
assert.match(festivalUiJs, /from '\.\/site-current-location\.js(?:\?v=[A-Za-z0-9._-]+)?'/,
  'site-festival-ui.js must reuse the shared location permission primitives, not a new geolocation contract');
assert.match(festivalUiJs, /from '\.\/site-bottom-sheet\.js(?:\?v=[A-Za-z0-9._-]+)?'/,
  'the region-change interaction must reuse the shared bottom-sheet primitive');

// ------------------------------------------------------- external links ---
// The only external, new-tab link this UI ever builds is [체험·신청]; it must
// carry rel="noopener noreferrer" and an accessible label that marks it
// external. There must be exactly one such link — a second one would mean a
// legacy 공식예약/공식출처-style external CTA crept back in.
const anchorBlocks = [...festivalUiJs.matchAll(/link\.target = '_blank';[\s\S]{0,400}?(?=\n\s*(?:if |return|\}|row\.appendChild))/g)]
  .map(match => match[0]);
assert.equal(anchorBlocks.length, 1, 'expected exactly one external-link CTA ([체험·신청]) — a second one would be a reintroduced legacy external link');
for (const block of anchorBlocks) {
  assert.match(block, /link\.rel = 'noopener noreferrer'/, 'external link missing rel=noopener noreferrer');
  assert.match(block, /aria-label/, 'external link must have an accessible label announcing the external handoff');
}

// -------------------------------------------------- price non-aggregation --
assert.doesNotMatch(festivalUiJs, /totalPrice|priceTotal|sumPrice|합계.*가격|총\s*가격/,
  'the UI must never compute or display a summed/total price across programs');
assert.doesNotMatch(festivalClientJs, /totalPrice|priceTotal|sumPrice/);

// ------------------------------------------------------ legacy UI removed --
// FESTIVAL-EVENT-08 removes the legacy 공식홈페이지/예약안내/주차·셔틀/공식출처
// sections entirely — not just visually, but as dead code, so nothing can
// resurrect them by re-adding a call site.
// Code-usage patterns only (not doc-comment prose, which may still name the
// removed Core field for context): a function call/definition or an actual
// property read/assignment.
const REMOVED_CODE_PATTERNS = [
  [/buildReservationSection\s*\(/, 'buildReservationSection() call/definition'],
  [/buildParkingShuttleSection\s*\(/, 'buildParkingShuttleSection() call/definition'],
  [/buildOfficialSourceSection\s*\(/, 'buildOfficialSourceSection() call/definition'],
  [/\.homepage_url\b/, '.homepage_url property read'],
  [/\bhomepageUrl\s*[:=]/, 'homepageUrl assignment/property'],
  [/FESTIVAL_RESERVATION_TYPE\w*/, 'the legacy reservation-type enum'],
];
for (const [pattern, label] of REMOVED_CODE_PATTERNS) {
  assert.doesNotMatch(festivalUiJs, pattern, `legacy ${label} must not remain in site-festival-ui.js`);
  assert.doesNotMatch(festivalClientJs, pattern, `legacy ${label} must not remain in site-festival-client.js`);
}

// At most two primary CTAs, and the internal program screen must never be an
// external handoff to Core's admin-curated source package.
assert.match(festivalUiJs, /festival-cta-program/, 'a [프로그램] CTA must exist');
assert.match(festivalUiJs, /festival-cta-participation/, 'a [체험·신청] CTA must exist');
assert.doesNotMatch(festivalUiJs, /festival_sources|source_service|admin_festival/i,
  '[프로그램] must open the internal date-tab screen, never call an admin source-package API');

console.log('FESTIVAL NAV WIRING VALIDATION PASS — nav entry (desktop+mobile), modal wiring, private-API isolation, chip layout, external-link hygiene, and legacy-section removal verified.');
