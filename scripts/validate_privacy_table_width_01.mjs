import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
const container = css.match(/\.legal-table-scroll\s*\{([^}]+)\}/)?.[1];
assert.ok(container, 'legal table container CSS must exist');
assert.match(container, /width:\s*100%\s*;/);
assert.match(container, /max-width:\s*100%\s*;/);
assert.match(container, /margin:\s*18px 0 26px\s*;/);
assert.match(container, /transform:\s*none\s*;/);
assert.match(container, /overflow-x:\s*auto\s*;/);
assert.doesNotMatch(container, /100vw|translateX|50%/);
assert.match(css, /\.legal-table-scroll:focus-visible\s*\{/);
assert.match(privacy, /class="legal-table-scroll"[^>]*tabindex="0"/);
assert.match(css, /@media\s*\(max-width:\s*760px\)/);
assert.match(css, /content:\s*attr\(data-label\)/);
console.log('PRIVACY-TABLE-WIDTH-01 PASS — reading-column containment, keyboard focus, mobile labels preserved');
