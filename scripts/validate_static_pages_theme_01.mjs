// SITE-STATIC-PAGES-THEME-01
//
// 대표: "LOTBI © 2026 / 회사 소개 / 개인정보처리방침 / 이용안내 / 계정 삭제 /
//        문의하기 — 이부분 클릭하면 왜 다크모드인핵 화이트모드로 바뀌는지
//        이거까지 해결"
//
// Measured with the saved theme at 'dark', on a dark OS and a light one alike:
//
//   index.html            body rgb(21, 25, 34)
//   about.html            body rgb(247, 248, 251)
//   privacy.html          body rgb(247, 248, 251)
//   terms.html            body rgb(247, 248, 251)
//   account-deletion.html body rgb(247, 248, 251)
//   contact.html          body rgb(247, 248, 251)
//   404.html              body rgb(247, 248, 251)
//
// Six of six. data-site-theme-bootstrap was absent on every one of them: these
// pages carried no theme code at all. Nothing was broken — the theme was only
// ever wired to index.html, and following any footer link walked out of it.
//
// No module runs on these pages, so body[data-site-theme] never appears and the
// inline bootstrap is the ONLY thing that puts the theme on the document. That
// makes two things load-bearing, and neither is visible from the CSS:
//   1. every footer-reachable page carries the bootstrap, inline and blocking
//      and above its stylesheets — a defer, a module, or a move below the
//      <link> tags leaves the page painting light while the code looks right;
//   2. the CSS covers every state that resolves to dark, and no state that
//      resolves to light. 'light' must be matched by nothing here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const assetVersion = JSON.parse(read('site-asset-version.json')).version;

const MARKER = 'SITE-STATIC-PAGES-THEME-01';
const KEY = 'lotbi.site.theme.bootstrap.v1';
// Every page the footer links to, plus the 404 a mistyped link lands on, plus
// the 전자상거래법 pages those footer pages link on to. The second group is not
// footer-linked, but leaving them light only moves the defect one click deeper.
const PAGES = [
  'about.html', 'privacy.html', 'terms.html',
  'account-deletion.html', 'contact.html', '404.html',
  'subscribe.html', 'refund.html', 'exchange.html', 'dispute.html',
];

// The footer on index.html is the list the 대표 read out. If a link is added
// there it has to be themed too, so the list above is checked against it.
const index = read('index.html');
const footer = index.slice(index.indexOf('<footer'), index.indexOf('</footer>'));

// The '자동모드' boundaries are index.html's to own; this gate only checks that
// the static pages agree with it, so moving them there moves them everywhere.
const indexHours = index.match(/lotbiHour >= (\d+) \|\| lotbiHour < (\d+)/);
assert.ok(indexHours, "index.html must carry the '자동모드' resolution this gate compares against");
const [, AUTO_DARK_HOUR, AUTO_LIGHT_HOUR] = indexHours;
for (const href of footer.match(/href="([a-z0-9-]+\.html)"/g) ?? []) {
  const page = href.slice(6, -1);
  if (page === 'index.html') continue;
  assert.ok(
    PAGES.includes(page),
    `${page} is linked from the Home footer but is not in this gate's list — a footer link `
    + 'that is not themed walks the reader out of Dark, which is the whole defect',
  );
}

// ── 1. The bootstrap is inline, blocking, and above every stylesheet ──────
for (const page of PAGES) {
  const html = read(page);
  assert.ok(html.includes(MARKER), `${page} must carry the pre-paint theme bootstrap`);

  const markerAt = html.indexOf(MARKER);
  const scriptOpen = html.indexOf('<script', markerAt);
  const scriptTag = html.slice(scriptOpen, html.indexOf('>', scriptOpen) + 1);
  assert.equal(
    scriptTag, '<script>',
    `${page}: the theme bootstrap must be a plain blocking script, found ${scriptTag} — `
    + 'type="module", defer and async all run after first paint',
  );

  const headEnd = html.indexOf('</head>');
  assert.ok(scriptOpen > 0 && scriptOpen < headEnd, `${page}: the bootstrap must sit inside <head>`);

  const firstStylesheet = html.indexOf('<link rel="stylesheet"');
  assert.ok(
    scriptOpen < firstStylesheet,
    `${page}: the bootstrap must come before the first stylesheet`,
  );

  const body = html.slice(scriptOpen, html.indexOf('</script>', scriptOpen));
  assert.ok(body.includes(KEY), `${page}: the bootstrap must read the theme key`);
  assert.ok(
    body.includes('siteThemeBootstrap'),
    `${page}: the bootstrap must set html[data-site-theme-bootstrap], which is what the CSS keys on`,
  );
  assert.ok(body.includes('try') && body.includes('catch'), `${page}: a storage failure must not stop rendering`);
  assert.ok(body.includes("=== 'light'") && body.includes("=== 'dark'") && body.includes("=== 'system'"),
    `${page}: the bootstrap must accept the three attribute values the CSS keys on`);
  assert.ok(!body.includes('setItem'), `${page}: the pre-paint bootstrap must only read`);

  // SITE-THEME-AUTO-SCHEDULE-02 — the durable key can also hold 'auto'. These
  // pages must resolve it, on the same boundaries index.html uses. Measured
  // before this was added: with the key at 'auto' they set no attribute at all
  // and fell back to the OS, so at 22:00 on a light OS Home went dark by the
  // clock and a legal page stayed rgb(247, 248, 251) — the defect, one click on.
  assert.ok(body.includes("=== 'auto'"), `${page}: the bootstrap must resolve '자동모드'`);
  const hours = body.match(/lotbiHour >= (\d+) \|\| lotbiHour < (\d+)/);
  assert.ok(hours, `${page}: the '자동모드' boundaries must be readable`);
  assert.deepEqual(
    [hours[1], hours[2]], [String(AUTO_DARK_HOUR), String(AUTO_LIGHT_HOUR)],
    `${page}: '자동모드' boundaries must match index.html (${AUTO_DARK_HOUR}:00 / ${AUTO_LIGHT_HOUR}:00) — `
    + 'two different clocks would put Home and a legal page on different themes at the boundary',
  );

  // The stylesheet that reads the attribute has to actually be on the page,
  // and after styles.css whose tokens it overrides.
  // Matched on the <link> itself: the bootstrap comment above names the file too.
  const themeAt = html.indexOf(`site-static-theme.css?v=${assetVersion}`);
  assert.ok(themeAt > 0, `${page} must load site-static-theme.css`);
  const baseAt = html.indexOf(`styles.css?v=${assetVersion}`);
  assert.ok(baseAt > 0, `${page} must still load styles.css`);
  assert.ok(
    themeAt > baseAt,
    `${page}: site-static-theme.css must come after styles.css or its token overrides lose`,
  );
}

// ── 2. The CSS covers every dark state and no light one ──────────────────
const css = read('site-static-theme.css');
const blockFor = selector => {
  const at = css.indexOf(selector);
  return at < 0 ? null : css.slice(at, css.indexOf('}', at));
};

// Explicit Dark.
const dark = blockFor('html[data-site-theme-bootstrap="dark"] body');
assert.ok(dark, 'missing the explicit-dark body block');
assert.match(dark, /background:\s*var\(--bg\)/, 'explicit Dark must paint the body background');
assert.match(dark, /color:\s*var\(--text\)/, 'explicit Dark must set the body text colour');

// Following the device: both the chosen 'system' and the never-chosen absence.
assert.ok(
  css.includes('@media (prefers-color-scheme: dark)'),
  'the static theme must have a device-following block',
);
for (const selector of ['html[data-site-theme-bootstrap="system"] body', 'html:not([data-site-theme-bootstrap]) body']) {
  assert.ok(
    css.includes(selector),
    `missing device-following selector ${selector} — a reader who never opened Settings, or who `
    + "chose 기기 설정, must get the same page as they get on Home",
  );
}

// 'light' is a choice, and nothing here may override it.
assert.ok(
  !css.includes('data-site-theme-bootstrap="light"'),
  "site-static-theme.css must never target the 'light' state — Light is a choice, and it is served "
  + 'by styles.css as written',
);

// The dark tokens have to be declared on every dark path, not just one.
const TOKENS = ['--bg', '--panel', '--text', '--muted', '--line', '--accent', '--soft', '--brand-navy', '--brand-line'];
const explicitTokens = blockFor('html[data-site-theme-bootstrap="dark"] {');
const systemTokens = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
for (const token of TOKENS) {
  assert.ok(explicitTokens.includes(`${token}:`), `explicit Dark is missing token ${token}`);
  assert.ok(systemTokens.includes(`${token}:`), `device-following Dark is missing token ${token}`);
}

// ── 3. The dark palette is readable ──────────────────────────────────────
const channels = hex => [0, 2, 4].map(i => Number.parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const luminance = hex => channels(hex)
  .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BG = '#151922';
const PANEL = '#171c25';
for (const [label, fg, bg, min] of [
  ['page text', '#f8fafc', BG, 4.5],
  ['card text', '#f8fafc', PANEL, 4.5],
  ['muted text', '#cbd5e1', BG, 4.5],
  ['muted text on a card', '#cbd5e1', PANEL, 4.5],
  ['legal body copy', '#e5e7eb', BG, 4.5],
  // 11px business-info separators are small text, so they are held to the same bar.
  ['footer separator', '#8b93a1', BG, 4.5],
  // subscribe.css: the solid plan button inverts in Dark, so its label flips too.
  ['plan button label', '#17191d', '#edf0f5', 4.5],
  ['plan button label, hover', '#17191d', '#ffffff', 4.5],
  // 제6조 6.1 국외이전 고지표: styles.css writes its cells #343942, which measured
  // 1.52:1 on the dark page. A disclosure a reviewer cannot read is not a disclosure.
  ['overseas-transfer table cell', '#e5e7eb', BG, 4.5],
  ['overseas-transfer table header', '#e5e7eb', '#202631', 4.5],
]) {
  const ratio = contrast(fg, bg);
  assert.ok(
    ratio >= min,
    `${label}: ${fg} on ${bg} measures ${ratio.toFixed(2)}:1, below ${min}:1`,
  );
  console.log(`  ${label.padEnd(22)} ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
}

// Every colour the static theme PAINTS must be one of these measured values —
// a new literal slipping in unmeasured is how the last contrast gap happened.
const MEASURED = new Set([
  '#151922', '#171c25', '#f8fafc', '#cbd5e1', '#e5e7eb', '#edf0f5', '#424b59', '#202631', '#8b93a1',
  '#17191d', '#ffffff',
]);
// Comments are stripped first: they quote the light-theme literals they exist to
// explain (styles.css writes the cells of the 국외이전 고지표 a dark slate, and the
// rule below says so), and a quoted colour is not a painted one.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const hex of declarations.match(/#[0-9a-f]{6}\b/gi) ?? []) {
  assert.ok(
    MEASURED.has(hex.toLowerCase()),
    `site-static-theme.css introduces an unmeasured colour ${hex} — add it to this gate's contrast table`,
  );
}

console.log(`SITE-STATIC-PAGES-THEME-01 OK — ${PAGES.length} footer pages follow the LOTBI theme`);
