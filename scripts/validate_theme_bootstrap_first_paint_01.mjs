// SITE-THEME-BOOTSTRAP-FIRST-PAINT-01
//
// 대표: "왜 다크모드에서 새로고침하면 화면 화이트로 갔다가 다시 다크모드로 와?"
//
// The pre-paint rules existed all along — site-theme-tokens.css keys them on
// html[data-site-theme-bootstrap] — but the only code setting that attribute
// lived inside site-conversation.js, which loads as a module and therefore
// defers past first paint. The stylesheets painted a light page, then the
// attribute arrived. Same shape as the rest of today's bugs: not missing,
// just wired to one side.
//
// Two things have to stay true, and neither is obvious from reading the CSS:
//   1. the bootstrap runs before any stylesheet, blocking, inline — a module,
//      a defer, an async, or a move below the <link> tags all reintroduce the
//      flash while leaving the code looking correct;
//   2. every bootstrap state that a theme can resolve to actually paints
//      `background`. Setting tokens alone leaves the surface white, which is
//      how the system-on-a-dark-OS flash survived the first fix.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const tokens = read('site-theme-tokens.css');
const MARKER = 'SITE-THEME-BOOTSTRAP-FIRST-PAINT-01';

// ── 1. The bootstrap is inline, blocking, and above every stylesheet ──────
assert.ok(html.includes(MARKER), 'index.html must carry the pre-paint theme bootstrap');

const markerAt = html.indexOf(MARKER);
const scriptOpen = html.indexOf('<script', markerAt);
const scriptTag = html.slice(scriptOpen, html.indexOf('>', scriptOpen) + 1);
assert.equal(
  scriptTag, '<script>',
  `the theme bootstrap must be a plain blocking script, found ${scriptTag} — `
  + 'type="module", defer and async all run after first paint and bring the flash back',
);

const headEnd = html.indexOf('</head>');
assert.ok(scriptOpen > 0 && scriptOpen < headEnd, 'the theme bootstrap must sit inside <head>');

const firstStylesheet = html.indexOf('<link rel="stylesheet"');
assert.ok(
  scriptOpen < firstStylesheet,
  'the theme bootstrap must come before the first stylesheet so the attribute is set when CSS first applies',
);

const scriptBody = html.slice(scriptOpen, html.indexOf('</script>', scriptOpen));
assert.ok(
  scriptBody.includes('lotbi.site.theme.bootstrap.v1'),
  'the theme bootstrap must read the theme key',
);
assert.ok(
  scriptBody.includes('siteThemeBootstrap'),
  'the theme bootstrap must set html[data-site-theme-bootstrap], which is what the CSS keys on',
);
assert.ok(
  scriptBody.includes('try') && scriptBody.includes('catch'),
  'a storage failure must not stop the page rendering',
);
assert.ok(
  !scriptBody.includes('setItem'),
  'the pre-paint bootstrap must only read — writing belongs to the module that owns preferences',
);

// The deferred copy stays, and must stay consistent with this one.
const conversation = read('site-conversation.js');
assert.ok(
  conversation.includes("localStorage?.getItem?.('lotbi.site.theme.bootstrap.v1')")
  && conversation.includes('document.documentElement.dataset.siteThemeBootstrap = savedTheme'),
  'the module copy must keep writing the same attribute from the same key',
);

// ── 2. Every dark bootstrap state paints a background, not just tokens ────
// A token-only block leaves the surface white until body gets its attribute.
// That is not a theoretical gap: it is exactly how the flash survived for
// readers following the system setting on a dark OS.
const blockFor = selector => {
  const at = tokens.indexOf(selector);
  if (at < 0) return null;
  return tokens.slice(at, tokens.indexOf('}', at));
};
for (const selector of [
  'html[data-site-theme-bootstrap="dark"] body:not([data-site-theme])',
  'html[data-site-theme-bootstrap="system"] body:not([data-site-theme])',
]) {
  const block = blockFor(selector);
  assert.ok(block, `missing pre-paint block: ${selector}`);
  assert.ok(
    /background:\s*#151922/.test(block),
    `${selector} must paint its background — tokens alone leave the first frame white`,
  );
  assert.ok(
    /color:\s*#f8fafc/.test(block),
    `${selector} must set its text colour alongside the background`,
  );
}

console.log('SITE-THEME-BOOTSTRAP-FIRST-PAINT-01 OK — blocking bootstrap above the stylesheets, both dark states painted');
