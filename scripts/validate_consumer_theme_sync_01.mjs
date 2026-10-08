// LOTBI-CONSUMER-THEME-SYNC-01
//
// 대표: "account.lotbiai.com 설정에서 다크 또는 자동모드를 선택하면 설정 화면은
// 다크인데, lotbiai.com 채팅 / 생활정보 / 진위확인으로 돌아가면 라이트로 풀린다."
//
// The two origins each kept their own copy of the screen mode and neither could
// read the other's. The fix is one shared, non-identifying cookie on the parent
// domain — lotbi_theme_preference_v1 = light | dark | system | auto — read
// before first paint on every consumer page. This gate locks that contract:
//   1. the shared module: strict parsing, the 07:00/18:00 clock, cookie scope;
//   2. every consumer page carries the same read-only pre-paint bootstrap;
//   3. that bootstrap, executed, follows the shared value, the clock and the
//      legacy fallback, and never writes anything;
//   4. the chat runtime takes the shared value first, imports an explicit old
//      choice once, and re-reads when the tab comes back;
//   5. in Chrome, a static page and the login hand-off page follow the cookie.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as theme from '../site-theme-preference.js';
import {expectedPage, locateThemeBootstrap, THEME_BOOTSTRAP_PAGES, THEME_BOOTSTRAP_SCRIPT} from './sync_theme_bootstrap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replaceAll('\r\n', '\n');
const at = (hour, minute = 0) => new Date(2026, 9, 7, hour, minute, 0, 0);

// ── 1. The shared module ──────────────────────────────────────────────────
assert.equal(theme.THEME_PREFERENCE_COOKIE, 'lotbi_theme_preference_v1');
assert.deepEqual([...theme.THEME_PREFERENCES], ['light', 'dark', 'system', 'auto']);
for (const value of theme.THEME_PREFERENCES) {
  assert.equal(theme.readThemePreference(`lotbi_theme_preference_v1=${value}`), value);
  assert.equal(theme.readThemePreference(`a=1; lotbi_theme_preference_v1=${value}; b=2`), value);
}
for (const bad of ['', 'LIGHT', 'darkmode', 'purple', '<script>', 'dark%00', 'au to', 'user-123']) {
  assert.equal(theme.readThemePreference(`lotbi_theme_preference_v1=${bad}`), undefined, `must reject ${JSON.stringify(bad)}`);
}
assert.equal(theme.readThemePreference(''), undefined);
assert.equal(theme.readThemePreference(undefined), undefined);
assert.equal(theme.readThemePreference('lotbi_theme_preference_v1=dark; lotbi_theme_preference_v1=dark'), 'dark', 'agreeing copies are one choice');
assert.equal(theme.readThemePreference('lotbi_theme_preference_v1=dark; lotbi_theme_preference_v1=light'), undefined, 'disagreeing copies are ambiguous');
assert.equal(theme.readThemePreference('xlotbi_theme_preference_v1=dark'), undefined, 'a longer name is a different cookie');
assert.equal(theme.readThemeImportMarker('lotbi_theme_preference_import_v1=site'), 'site');
assert.equal(theme.readThemeImportMarker('lotbi_theme_preference_import_v1=other'), undefined);

for (const [hour, minute, expected] of [
  [0, 0, 'dark'], [6, 59, 'dark'], [7, 0, 'light'], [12, 0, 'light'], [17, 59, 'light'], [18, 0, 'dark'], [23, 59, 'dark'],
]) {
  assert.equal(theme.resolveThemePreference('auto', at(hour, minute)), expected, `자동모드 ${hour}:${minute} → ${expected}`);
}
assert.equal(theme.resolveThemePreference('system', at(23)), 'system', '기기모드 is the device, not the clock');
assert.equal(theme.resolveThemePreference('light', at(23)), 'light');
assert.equal(theme.resolveThemePreference('dark', at(12)), 'dark');
assert.equal(theme.resolveThemePreference('nonsense', at(12)), 'system', 'anything unknown fails safe to 기기모드');
const hours = ms => ms / 3_600_000;
assert.equal(hours(theme.millisecondsUntilNextThemeBoundary(at(6, 59))), 1 / 60);
assert.equal(hours(theme.millisecondsUntilNextThemeBoundary(at(7))), 11);
assert.equal(hours(theme.millisecondsUntilNextThemeBoundary(at(17, 59))), 1 / 60);
assert.equal(hours(theme.millisecondsUntilNextThemeBoundary(at(18))), 13);

const prod = theme.serializeThemePreference('auto', 'lotbiai.com', 'https:');
assert.match(prod, /^lotbi_theme_preference_v1=auto; /);
for (const part of ['Path=/', 'SameSite=Lax', 'Domain=lotbiai.com', 'Secure']) assert.ok(prod.includes(part), `production cookie needs ${part}`);
assert.match(prod, /Max-Age=\d{6,}/);
assert.doesNotMatch(prod, /HttpOnly/i, 'the pre-paint bootstrap has to read it');
assert.equal(theme.serializeThemePreference('dark', 'account.lotbiai.com', 'https:'), theme.serializeThemePreference('dark', 'lotbiai.com', 'https:'),
  'both origins must write the very same cookie, or a second copy shadows the first');
assert.doesNotMatch(theme.serializeThemePreference('dark', 'localhost', 'http:'), /Domain=|Secure/, 'a local preview stays host-only');
assert.throws(() => theme.serializeThemePreference('dark', 'lotbiai.com', 'http:'), /origin/);
assert.throws(() => theme.serializeThemePreference('dark', 'evil.example', 'https:'), /origin/);
assert.throws(() => theme.serializeThemePreference('blue', 'lotbiai.com', 'https:'), /preference/);
assert.match(theme.serializeThemeImportMarker(false, 'lotbiai.com', 'https:'), /^lotbi_theme_preference_import_v1=; .*Max-Age=0.*Domain=lotbiai.com/);

// A cookie jar that behaves like document.cookie for one host.
function jar() {
  const values = new Map();
  return {
    writes: [],
    get cookie() { return [...values].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(line) {
      this.writes.push(line);
      const [pair, ...attrs] = line.split('; ');
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (attrs.some(attr => attr === 'Max-Age=0')) values.delete(name); else values.set(name, value);
    },
  };
}
const documentRef = jar();
theme.writeThemePreference(documentRef, 'auto', {hostname: 'lotbiai.com', protocol: 'https:', imported: true});
assert.equal(theme.readThemePreference(documentRef.cookie), 'auto');
assert.equal(theme.readThemeImportMarker(documentRef.cookie), 'site');
theme.writeThemePreference(documentRef, 'dark', {hostname: 'account.lotbiai.com', protocol: 'https:'});
assert.equal(theme.readThemePreference(documentRef.cookie), 'dark');
assert.equal(theme.readThemeImportMarker(documentRef.cookie), undefined, 'a real choice clears the import mark');
assert.throws(() => theme.writeThemePreference({cookie: '', set cookie(_) {}}, 'dark', {hostname: 'lotbiai.com', protocol: 'https:'}),
  /not saved/, 'a blocked cookie jar is reported, never silently ignored');

// Display preference only — nothing that identifies anyone.
const moduleSource = read('site-theme-preference.js');
for (const forbidden of ['sessionToken', 'Bearer', 'userId', 'user_id', 'email', 'fetch(', 'localStorage.setItem', 'HttpOnly;']) {
  assert.ok(!moduleSource.includes(forbidden), `the theme module must not touch ${forbidden}`);
}

// ── 2. Every consumer page carries the same bootstrap ─────────────────────
for (const page of THEME_BOOTSTRAP_PAGES) {
  const html = read(page);
  assert.equal(expectedPage(html), html, `${page}: the theme bootstrap drifted — run node scripts/sync_theme_bootstrap.mjs --write`);
  const [start] = locateThemeBootstrap(html);
  const headEnd = html.indexOf('</head>');
  assert.ok(start < headEnd, `${page}: the bootstrap must sit inside <head>`);
  const firstStyle = Math.min(...['<link rel="stylesheet"', '<style'].map(tag => html.indexOf(tag)).filter(i => i >= 0));
  assert.ok(start < firstStyle, `${page}: the bootstrap must run before the first stylesheet paints`);
  assert.equal(html.split('lotbi_theme_preference_v1=').length - 1, 2, `${page}: exactly one bootstrap`);
}
const bootstrapBody = THEME_BOOTSTRAP_SCRIPT.slice(THEME_BOOTSTRAP_SCRIPT.indexOf('<script>') + 8, THEME_BOOTSTRAP_SCRIPT.lastIndexOf('</script>'));
assert.doesNotMatch(bootstrapBody, /document\.cookie\s*=(?!=)/, 'the bootstrap must never write a cookie');
assert.ok(!bootstrapBody.includes('setItem') && !bootstrapBody.includes('fetch(') && !bootstrapBody.includes('sessionStorage'));

// ── 3. The bootstrap, executed ────────────────────────────────────────────
function runBootstrap({cookie = '', legacy = null, storageThrows = false, now = at(12)}) {
  const listeners = {};
  const timers = [];
  const html = {dataset: {}};
  // The raw header, so duplicate names can be expressed; writes are recorded.
  const state = {cookie, writes: []};
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
    static now() { return now.getTime(); }
  }
  const context = {
    Date: FakeDate,
    document: {
      get cookie() { return state.cookie; },
      set cookie(line) { state.writes.push(line); },
      documentElement: html,
      visibilityState: 'visible',
      addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    },
    window: {
      localStorage: {
        getItem: key => { if (storageThrows) throw new Error('blocked'); return key === 'lotbi.site.theme.bootstrap.v1' ? legacy : null; },
        setItem: () => { throw new Error('the bootstrap must not write storage'); },
      },
      addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    },
    setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
    clearTimeout: () => {},
  };
  vm.runInNewContext(bootstrapBody, context);
  return {html, listeners, timers, state};
}
const cases = [
  [{cookie: 'lotbi_theme_preference_v1=dark', legacy: 'light'}, 'dark', 'dark', 'the shared choice wins over the old Site key'],
  [{cookie: 'lotbi_theme_preference_v1=light', legacy: 'dark'}, 'light', 'light', 'Account → light reaches the Site'],
  [{cookie: 'lotbi_theme_preference_v1=system', legacy: 'dark'}, 'system', 'system', '기기모드 follows the device'],
  [{cookie: 'lotbi_theme_preference_v1=auto', now: at(6, 59)}, 'dark', 'auto', '자동 06:59 is dark'],
  [{cookie: 'lotbi_theme_preference_v1=auto', now: at(7)}, 'light', 'auto', '자동 07:00 is light'],
  [{cookie: 'lotbi_theme_preference_v1=auto', now: at(17, 59)}, 'light', 'auto', '자동 17:59 is light'],
  [{cookie: 'lotbi_theme_preference_v1=auto', now: at(18)}, 'dark', 'auto', '자동 18:00 is dark'],
  [{cookie: 'lotbi_theme_preference_v1=auto', now: at(23)}, 'dark', 'auto', '자동 at 23:00 is dark on the Site too'],
  [{cookie: '', legacy: 'dark'}, 'dark', 'dark', 'without the shared cookie the old Site key still applies'],
  [{cookie: 'lotbi_theme_preference_v1=purple', legacy: 'light'}, 'light', 'light', 'a malformed shared value falls back'],
  [{cookie: 'lotbi_theme_preference_v1=dark; lotbi_theme_preference_v1=light', legacy: 'system'}, 'system', 'system', 'ambiguous copies fall back'],
  [{cookie: 'lotbi_theme_preference_v1=dark', storageThrows: true}, 'dark', 'dark', 'blocked storage does not hide the shared choice'],
];
for (const [input, bootstrap, preference, label] of cases) {
  const {html, state: written} = runBootstrap(input);
  assert.equal(html.dataset.siteThemeBootstrap, bootstrap, label);
  assert.equal(html.dataset.siteThemePreference, preference, `${label} (preference)`);
  assert.equal(written.writes.length, 0, `${label}: the bootstrap must not write a cookie`);
}
{
  const {html} = runBootstrap({cookie: '', legacy: null});
  assert.equal(html.dataset.siteThemeBootstrap, undefined, 'nothing chosen anywhere leaves the page on its default');
}
{
  // 자동 at 17:30 arms one timer for 18:00, and coming back to the tab re-reads
  // a choice made in Account meanwhile.
  const run = runBootstrap({cookie: 'lotbi_theme_preference_v1=auto', now: at(17, 30)});
  assert.equal(run.timers.length, 1);
  assert.equal(run.timers[0].ms, 30 * 60 * 1000, '자동 must switch at 18:00 on an open page');
  run.state.cookie = 'lotbi_theme_preference_v1=light';
  for (const fn of run.listeners.visibilitychange ?? []) fn();
  assert.equal(run.html.dataset.siteThemeBootstrap, 'light', 'returning to the tab picks up the new choice');
  assert.ok((run.listeners.pageshow ?? []).length && (run.listeners.focus ?? []).length, 'bfcache and focus re-apply too');
}

// ── 4. The chat runtime ───────────────────────────────────────────────────
const conversation = read('site-conversation.js');
assert.match(conversation, /import \{millisecondsUntilNextThemeBoundary, readThemePreference, resolveThemePreference, writeThemePreference\} from '\.\/site-theme-preference\.js\?v=aset-[0-9a-f]{12}';/);
assert.ok(conversation.includes('theme: sharedThemePreference() ?? adoptLegacyTheme(resolveNamespaceTheme(loadedPreferences.theme, durableBootstrapTheme())),'),
  'the shared choice first; only without it the old per-origin store');
const adopt = conversation.slice(conversation.indexOf('function adoptLegacyTheme('), conversation.indexOf('\n}', conversation.indexOf('function adoptLegacyTheme(')));
assert.ok(adopt.includes("legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'auto'"), "only an explicit old choice is imported — 'system' is also the untouched default");
assert.ok(adopt.includes('imported: true'), 'an import is marked so Account can prefer its own explicit choice');
const sync = conversation.slice(conversation.indexOf('const syncSharedTheme = () => {'), conversation.indexOf("document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSharedTheme(); });"));
assert.ok(sync.includes('sharedThemePreference()') && sync.includes('applyPreferences()'), 'coming back to the tab re-reads the shared choice');
for (const event of ["window.addEventListener('focus', syncSharedTheme);", "window.addEventListener('pageshow', syncSharedTheme);"]) {
  assert.ok(conversation.includes(event), `the chat must re-read on ${event}`);
}
assert.ok(!/document\.cookie\s*=(?!=)/.test(conversation), 'the chat writes the cookie only through writeThemePreference');
const workflow = read('.github/workflows/site-review.yml');
assert.ok(workflow.includes('node scripts/validate_consumer_theme_sync_01.mjs'), 'this gate must run in CI');
assert.ok(workflow.includes('node scripts/sync_theme_bootstrap.mjs --check'), 'bootstrap drift must fail CI');

// ── 5. In Chrome: pages follow the cookie ─────────────────────────────────
function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if ((name.includes('/') || name.includes('\\')) && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}
const PORT = 4246;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const INNER_REL = 'scripts/.consumer-theme-sync-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const fixture = `<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="out">pending</pre><script type="module">
const out=document.getElementById('out');
// /auth/start/ hands straight off to Account; its redirect module is left out so the
// paint it shows on the way through can be measured on this origin.
const load=async src=>{const f=document.createElement('iframe');f.style.cssText='width:390px;height:600px';const loaded=new Promise((resolve,reject)=>{f.onload=()=>resolve(f);f.onerror=reject;});if(src.startsWith('/auth/start/')){const html=await (await fetch(src)).text();f.srcdoc=html.replace(/<script type="module"[^>]*><\\/script>/g,'');}else{f.src=src;}document.body.append(f);return loaded;};
const probe=async (cookie,src)=>{
  document.cookie='lotbi_theme_preference_v1=; Path=/; Max-Age=0';
  if(cookie)document.cookie='lotbi_theme_preference_v1='+cookie+'; Path=/; SameSite=Lax; Max-Age=600';
  localStorage.setItem('lotbi.site.theme.bootstrap.v1','light');
  const f=await load(src);const d=f.contentDocument;
  const r={bootstrap:d.documentElement.dataset.siteThemeBootstrap||'',background:getComputedStyle(d.body).backgroundColor};
  f.remove();return r;
};
try{
  const report={};
  report.termsDark=await probe('dark','/terms.html');
  report.termsLight=await probe('light','/terms.html');
  report.authStartDark=await probe('dark','/auth/start/index.html');
  report.authStartLight=await probe('light','/auth/start/index.html');
  report.legacyOnly=await probe('','/terms.html');
  out.textContent=JSON.stringify({ok:true,report});
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e&&e.stack||e)})}
</script></body></html>`;
function waitServer() {
  for (let i = 0; i < 40; i += 1) {
    if (spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000}).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}
const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
let report;
try {
  waitServer();
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-dark-mode',
    '--window-size=1280,900', '--virtual-time-budget=8000', '--dump-dom', `${ORIGIN}/${INNER_REL}`],
  {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
  if (r.error) throw r.error;
  const marker = '<pre id="out">';
  const i = r.stdout.indexOf(marker);
  const raw = r.stdout.slice(i + marker.length, r.stdout.indexOf('</pre>', i))
    .replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  report = parsed.report;
} finally {
  server.kill();
  fs.rmSync(INNER, {force: true});
}
const DARK = 'rgb(33, 33, 33)';
assert.equal(report.termsDark.bootstrap, 'dark', 'a legal page follows the shared Dark even when the old key says light');
assert.equal(report.termsDark.background, DARK, 'and actually paints dark');
assert.equal(report.termsLight.bootstrap, 'light', 'a legal page follows the shared Light on a dark device');
assert.notEqual(report.termsLight.background, DARK, 'Light must not paint dark on a dark device');
assert.equal(report.authStartDark.background, DARK, '"LOTBI로 돌아가기" passes through /auth/start/ in Dark, not white');
assert.equal(report.authStartLight.background, 'rgb(255, 255, 255)', 'and in Light, not the device dark');
assert.equal(report.legacyOnly.bootstrap, 'light', 'without the shared cookie the old key still applies');

console.log('LOTBI-CONSUMER-THEME-SYNC-01', JSON.stringify(report));
console.log('LOTBI-CONSUMER-THEME-SYNC-01 OK — one screen mode across lotbiai.com and account.lotbiai.com');
