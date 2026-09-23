// SITE-THEME-NAMESPACE-CARRY-01
//
// 대표: "다크모드에서 새로고침하면 화이트하면으로 보이는것도 명령 했는데
//        왜 이건 안고치는거야??"
//
// SITE-THEME-BOOTSTRAP-FIRST-PAINT-01 fixed the first frame and that fix is
// live: measured on https://lotbiai.com, with the durable key set to 'dark' on
// a light OS, body painted #151922 at frame 0. The white page came back
// afterwards, from the other end.
//
// The theme has two stores. The durable, device-wide key
// 'lotbi.site.theme.bootstrap.v1' is what the pre-paint bootstrap reads before
// any namespace is known. The per-namespace preferences blob is what
// switchNamespace() loads once the module mounts, and applyPreferences() then
// writes body[data-site-theme] and html[data-site-theme-bootstrap] from it —
// over the top of what the bootstrap just set. savePreferences() writes the
// result back over the durable key.
//
// The old fallback for an absent namespace theme was the literal 'system'.
// Measured with the durable key at 'dark' and no stored namespace preferences,
// viewport 1600x900, OS light:
//
//   t=0    body rgb(21,25,34)    html[data-site-theme-bootstrap]="dark"
//   t=120  body rgb(255,255,255) html[data-site-theme-bootstrap]="system"
//
// — not a flash, a reset, and a permanent one: the durable key is rewritten on
// the way out, so the user's Dark is gone for every later load too. Any
// namespace change reaches this state: signing in or out, a namespace whose
// preferences never persisted because savePreferences() ran before stateReady,
// a second account, cleared per-namespace data.
//
// The rule that has to hold: an absent namespace theme carries the durable
// value forward. Only a genuinely stored namespace theme may override it, and
// 'system' stays the last resort rather than the first.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const conversation = readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');

// ── 1. The resolution is a named, independently testable function ────────
const start = conversation.indexOf('function resolveNamespaceTheme(');
assert.ok(start >= 0, 'resolveNamespaceTheme must stay a top-level function so this gate can exercise it');
const end = conversation.indexOf('\n}', start) + 2;
const themesAt = conversation.indexOf('const SITE_THEMES =');
assert.ok(themesAt >= 0, 'SITE_THEMES must stay declared alongside the resolver');
const themesSource = conversation.slice(themesAt, conversation.indexOf('\n', themesAt));

const context = {};
vm.runInNewContext(
  `${themesSource}\n${conversation.slice(start, end)}\nthis.resolveNamespaceTheme = resolveNamespaceTheme;`,
  context,
);
const resolve = context.resolveNamespaceTheme;

// ── 2. The matrix the defect lives in ────────────────────────────────────
// A stored namespace theme always wins — a user who set Light on this account
// must not be dragged dark by the device key.
assert.equal(resolve('light', 'dark'), 'light', 'a stored namespace theme must win over the durable key');
assert.equal(resolve('dark', 'light'), 'dark', 'a stored namespace theme must win over the durable key');
assert.equal(resolve('system', 'dark'), 'system', "an explicitly stored 'system' is a choice, not an absence");

// The defect: nothing stored for this namespace, Dark on the device.
for (const absent of [undefined, null, '', 'nonsense', 0, {}]) {
  assert.equal(
    resolve(absent, 'dark'), 'dark',
    'an absent namespace theme must carry the durable Dark forward — resetting to '
    + "'system' is what turned the page white after a refresh",
  );
  assert.equal(resolve(absent, 'light'), 'light', 'an absent namespace theme must carry the durable Light forward');
  assert.equal(resolve(absent, 'system'), 'system', "a durable 'system' carries forward as itself");
}

// Nothing anywhere: 'system' is still the last resort.
for (const bad of [undefined, null, '', 'nonsense']) {
  assert.equal(resolve(undefined, bad), 'system', "with neither store readable the default is still 'system'");
}

// ── 3. The loader actually uses it ───────────────────────────────────────
assert.ok(
  conversation.includes('theme: resolveNamespaceTheme(loadedPreferences.theme, durableBootstrapTheme()),'),
  'switchNamespace must resolve the theme through resolveNamespaceTheme with the durable key as the '
  + 'fallback — inlining the old ternary brings the reset straight back',
);
assert.ok(
  !/includes\(loadedPreferences\.theme\)\s*\?\s*loadedPreferences\.theme\s*:\s*'system'/.test(conversation),
  "the old 'system' fallback must not return",
);

// ── 4. Reading the durable key can never throw ───────────────────────────
const readerAt = conversation.indexOf('function durableBootstrapTheme(');
assert.ok(readerAt >= 0, 'durableBootstrapTheme must stay a top-level function');
const reader = conversation.slice(readerAt, conversation.indexOf('\n}', readerAt));
assert.ok(
  reader.includes('try') && reader.includes('catch'),
  'a storage failure must not stop the page rendering',
);
assert.ok(
  !reader.includes('setItem'),
  'the fallback reader must only read — writing belongs to savePreferences()',
);

// ── 5. One spelling of the key ───────────────────────────────────────────
const literals = conversation.split("'lotbi.site.theme.bootstrap.v1'").length - 1;
assert.equal(
  literals, 2,
  'the key must be spelled literally exactly twice — once in the pre-paint bootstrap block, which '
  + 'runs before the constant exists, and once in the constant itself. Every other use goes through '
  + `SITE_THEME_BOOTSTRAP_KEY. Found ${literals}.`,
);

console.log('SITE-THEME-NAMESPACE-CARRY-01 OK — an unset namespace theme carries the device choice forward');
