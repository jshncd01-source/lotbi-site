// site-calendar.css writes its dark theme as `body[data-site-theme="dark"] X`.
//
// That attribute holds the RAW preference -- system | light | dark -- and the
// default is "system". So on a dark phone, with nobody having touched the theme
// setting, NONE of those rules match. Measured on lotbiai.com: the day panel
// that opens when you tap a date rendered white text on a white sheet at
// 1.05:1. Not "a bit light": invisible.
//
// The colour tokens at the top of the file already cover all three states. This
// generator extends the same coverage to every remaining dark rule by emitting
// one @media (prefers-color-scheme: dark) block that repeats them for the two
// selectors the "system" preference actually produces.
//
// It is generated rather than hand-written so the copy cannot drift from the
// original: validate_calendar_system_dark_01.mjs regenerates and compares.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const BEGIN = '/* BEGIN GENERATED: system-dark mirror -- scripts/generate_calendar_system_dark.mjs */';
export const END = '/* END GENERATED: system-dark mirror */';

const DARK = 'body[data-site-theme="dark"]';
// The two shapes a "system" preference takes: after the theme script runs, and
// during the first paint before it has stamped the body.
const SYSTEM = [
  'body[data-site-theme="system"]',
  'html[data-site-theme-bootstrap="system"] body:not([data-site-theme])',
];

// Strip the generated block, then every @media block, so only top-level rules
// remain. Nested at-rules are not used in this file; assert that stays true.
export function topLevelSource(css) {
  const start = css.indexOf(BEGIN);
  const body = start === -1 ? css : css.slice(0, start);
  let out = '';
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf('@media', i);
    if (at === -1) { out += body.slice(i); break; }
    out += body.slice(i, at);
    const open = body.indexOf('{', at);
    let depth = 0;
    let j = open;
    for (; j < body.length; j += 1) {
      if (body[j] === '{') depth += 1;
      else if (body[j] === '}') { depth -= 1; if (depth === 0) break; }
    }
    i = j + 1;
  }
  return out;
}

export function generate(css) {
  const source = topLevelSource(css);
  const rules = [];
  // Rules are `selectors { declarations }`; comments are stripped first so a
  // brace or a selector inside one cannot be mistaken for code.
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const declarations = match[2].trim();
    if (!declarations) continue;
    const mirrored = [];
    for (const selector of selectors) {
      if (!selector.startsWith(DARK)) continue;
      const rest = selector.slice(DARK.length);
      // The bare `body[data-site-theme="dark"]` rule is the colour-token block,
      // which already spells out the system states by hand at the top of the
      // file. Mirroring it would only restate values that are already correct.
      if (!rest.trim()) continue;
      for (const system of SYSTEM) mirrored.push(system + rest);
    }
    if (mirrored.length) rules.push(`  ${mirrored.join(',\n  ')} { ${declarations} }`);
  }
  return [
    BEGIN,
    '/* Do not edit by hand. Run the generator; the validator fails on drift. */',
    '@media (prefers-color-scheme: dark) {',
    rules.join('\n'),
    '}',
    END,
    '',
  ].join('\n');
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is `C:\...` while
// import.meta.url is `file:///C:/...`, so the template never matched and a
// direct run silently wrote nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = 'site-calendar.css';
  const raw = fs.readFileSync(path, 'utf8');
  // A checkout with core.autocrlf=true has CRLF on disk. Work in LF, then write
  // back with the file's own line ending so a no-op run leaves no diff.
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const css = raw.replace(/\r\n/g, '\n');
  const block = generate(css);
  const start = css.indexOf(BEGIN);
  const base = start === -1 ? css.trimEnd() + '\n' : css.slice(0, start).trimEnd() + '\n';
  fs.writeFileSync(path, `${base}\n${block}`.replace(/\n/g, eol), 'utf8');
  console.log(`system-dark mirror written: ${block.split('\n').length} lines`);
}
