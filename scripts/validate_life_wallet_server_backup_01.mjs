// LIFE-WALLET-ENCRYPTED-BACKUP-01
// The wallet backed up to LOTBI Core like KakaoTalk's backup restore, end to end encrypted:
// device A seals the whole wallet in the browser with the backup password and uploads only the
// envelope; device B (a fresh browser profile, empty storage) is told a backup exists, makes
// its PIN, enters the backup password and gets the same items back. Wrong password, damaged
// backup, an unknown format, a too-large backup, a session that is not FULL and deleting the
// backup are covered, and every request that leaves for Core is checked for plaintext, the
// PIN and the password. A stand-in plays Core. All images are synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSWORD = 'Lotbi-Backup-2026!';
const NOTE = 'SECRET-NOTE-7731';
// What a request shows besides the sealed bytes. The envelope's ciphertext, nonce and salt are
// random base64, so a short secret such as the 4-digit PIN can appear in them by chance; they
// must be pure base64, the decoded bytes must not hold the password or the note, and only then
// are they set aside. The URL, every key and every other field are searched as before.
const OPAQUE_FIELDS = [['cipher', 'ciphertext'], ['cipher', 'nonce'], ['kdf', 'salt']];
const BASE64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/u;
function wireText(request) {
  let body = request.body;
  let value = null;
  try { value = JSON.parse(body); } catch {}
  if (value && typeof value === 'object') {
    for (const [outer, inner] of OPAQUE_FIELDS) {
      const field = value[outer]?.[inner];
      if (field === undefined) continue;
      assert.equal(typeof field, 'string', `${outer}.${inner} is a string`);
      assert.match(field, BASE64_RE, `${outer}.${inner} must be opaque base64: ${request.method} ${request.url}`);
      const bytes = Buffer.from(field.replaceAll('-', '+').replaceAll('_', '/'), 'base64');
      for (const secret of [PASSWORD, NOTE]) assert.ok(!bytes.includes(Buffer.from(secret, 'utf8')), `${secret} must not sit inside ${outer}.${inner}`);
      value[outer][inner] = '<opaque>';
    }
    if (value.cipher && 'aad' in value.cipher) assert.equal(value.cipher.aad, 'LOTBI_LIFE_WALLET_BACKUP_V1', 'the AAD is the fixed label');
    body = JSON.stringify(value);
  }
  return request.url + body;
}
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:auto}</style></head><body><main id="host"></main>';

// A stand-in for Core's /v2/life-wallet/backup; window.__core.mode switches its answers.
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const core = window.__core = {stored: window.__seed || null, mode: 'normal', requests: [], madeAt: '2026-10-09T05:30:00.000Z'};
const BASE = 'https://api.lotbiai.com/v2/life-wallet/backup';
const json = (status, value) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
const meta = () => core.stored ? {created_at: core.madeAt, size_bytes: core.stored.length, format: 'LOTBI_LIFE_WALLET', format_version: 1, kdf: {name: 'PBKDF2-HMAC-SHA-256', iterations: 600000}} : null;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = String(input?.url || input);
  if (!url.startsWith(BASE)) return nativeFetch(input, init);
  const method = (init.method || 'GET').toUpperCase(); const body = typeof init.body === 'string' ? init.body : '';
  core.requests.push({method, url, body, authorization: init.headers?.Authorization || '', credentials: init.credentials});
  const path = url.slice(BASE.length);
  const full = core.mode !== 'social';
  if (path === '' && method === 'GET') return json(200, {backup: meta()});
  if (!full) return json(403, {detail: {code: 'SESSION_ASSURANCE_INSUFFICIENT'}});
  if (path === '' && method === 'PUT') { core.stored = body; return json(200, {backup: meta()}); }
  if (path === '' && method === 'DELETE') { core.stored = null; return json(200, {backup: null}); }
  if (path === '/content' && method === 'GET') {
    if (!core.stored) return json(404, {detail: {code: 'BACKUP_NOT_FOUND'}});
    let sealed = core.stored;
    if (core.mode === 'tamper') { const value = JSON.parse(sealed); const bytes = value.cipher.ciphertext; value.cipher.ciphertext = (bytes[0] === 'A' ? 'B' : 'A') + bytes.slice(1); sealed = JSON.stringify(value); }
    if (core.mode === 'future') { const value = JSON.parse(sealed); value.version = 2; sealed = JSON.stringify(value); }
    return new Response(sealed, {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  return json(404, {detail: {code: 'NOT_FOUND'}});
};
const shaped = (width, height, colour) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.fillStyle = colour; context.fillRect(width * .1, height * .1, width * .8, height * .8); return canvas.toDataURL('image/jpeg', .8); };
const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
const fingerprint = async cards => (await Promise.all(cards.map(card => digest((card.note || '') + '|' + card.frontDataUrl + '|' + (card.shape || ''))))).sort();
const buttonNamed = (root, text) => [...root.querySelectorAll('button')].find(button => button.textContent.trim() === text);
const openSettings = async (root, action) => { root.querySelector('.wallet-settings > button').click(); const item = await wait(() => root.querySelector('[data-wallet-server-backup="' + action + '"]'), 'settings ' + action); item.click(); };
const overflow = () => document.documentElement.scrollWidth > innerWidth + 1;
`;

const deviceA = head + `<script type="module">
${helpers}
try {
  const {mountLifeWallet, LifeWalletVault, IndexedDbWalletRepository} = await import('/site-life-wallet.js?test=server-backup-a');
  const root = document.getElementById('host');
  const accountId = 'acct-server-backup';
  mountLifeWallet({root, authenticated: true, accountId, sessionToken: 'session-A'});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  await sleep(300);
  const noticeWithoutBackup = Boolean(root.querySelector('[data-wallet-server-backup-notice]'));
  const [first, second] = setup.querySelectorAll('input'); first.value = '1357'; second.value = '1357'; setup.requestSubmit();
  await wait(() => buttonNamed(root, '잠그기'), 'unlocked');
  const store = new LifeWalletVault(new IndexedDbWalletRepository()); await store.unlock(accountId, '1357');
  const at = '2026-10-01T12:00:00.000Z';
  await store.save(accountId, {id: 'card', kind: 'document', note: '${NOTE} 카드', updatedAt: at, frontDataUrl: shaped(1012, 638, '#1f3b5a')});
  await store.save(accountId, {id: 'page', kind: 'document', note: '${NOTE} 문서', updatedAt: at, frontDataUrl: shaped(734, 1024, '#3b5a1f')});
  await store.save(accountId, {id: 'pdf', kind: 'document', note: 'PDF 1쪽', updatedAt: at, frontDataUrl: shaped(840, 1188, '#5a1f3b'), shape: 'document'});
  await store.save(accountId, {id: 'photo', kind: 'document', note: '', updatedAt: at, frontDataUrl: shaped(1000, 1400, '#5a3b1f'), shape: 'card'});
  const originals = await fingerprint(await store.list(accountId));
  buttonNamed(root, '잠그기').click();
  const unlock = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock'); unlock.querySelector('input').value = '1357'; unlock.requestSubmit();
  await wait(() => root.querySelector('.wallet-deck-shell'), 'deck');
  const reassuranceBefore = root.querySelector('.wallet-storage-reassurance strong')?.textContent || '';
  await openSettings(root, 'keep');
  const form = await wait(() => root.querySelector('form.wallet-server-backup'), 'backup form');
  const [password, confirmation] = form.querySelectorAll('input[type=password]'); const check = form.querySelector('input[type=checkbox]');
  const statusOf = () => form.querySelector('[role=alert], .wallet-error, [aria-live]')?.textContent || '';
  const attempt = async (value, again, checked) => { password.value = value; confirmation.value = again; check.checked = checked; form.requestSubmit(); await sleep(150); return [...form.querySelectorAll('p')].map(p => p.textContent).join(' | '); };
  const rules = {
    short: await attempt('abc12', 'abc12', true),
    oneKind: await attempt('abcdefghijkl', 'abcdefghijkl', true),
    repeated: await attempt('aaaaaa111111', 'aaaaaa111111', true),
    mismatch: await attempt('${PASSWORD}', '${PASSWORD}x', true),
    unchecked: await attempt('${PASSWORD}', '${PASSWORD}', false),
  };
  password.value = '${PASSWORD}'; password.dispatchEvent(new Event('input', {bubbles: true}));
  const strength = await wait(() => { const text = form.querySelector('.wallet-password-strength').textContent; return text.includes('강함') && text; }, 'strength');
  const putsBefore = core.requests.filter(request => request.method === 'PUT').length;
  confirmation.value = '${PASSWORD}'; check.checked = true; form.requestSubmit();
  const done = await wait(() => [...root.querySelectorAll('.wallet-message')].map(node => node.textContent).find(text => text.includes('서버에 백업했습니다')), 'backed up');
  const reassuranceAfter = root.querySelector('.wallet-storage-reassurance strong')?.textContent || '';
  root.querySelector('.wallet-settings > button').click();
  const menu = {restore: Boolean(root.querySelector('[data-wallet-server-backup="restore"]')), remove: Boolean(root.querySelector('[data-wallet-server-backup="delete"]')), help: [...root.querySelectorAll('.wallet-settings-help')].map(node => node.textContent).join(' | ')};
  const puts = core.requests.filter(request => request.method === 'PUT');
  window.__result = JSON.stringify({ok: true, noticeWithoutBackup, rules, strength, putsBefore, done, reassuranceBefore, reassuranceAfter, menu, originals, sealed: core.stored, requests: core.requests.map(({method, url, body, authorization, credentials}) => ({method, url, body, authorization, credentials})), puts: puts.length});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const deviceB = sealed => head + `<script>window.__seed = ${JSON.stringify(sealed)};</script><script type="module">
${helpers}
try {
  const {mountLifeWallet, LifeWalletVault, IndexedDbWalletRepository} = await import('/site-life-wallet.js?test=server-backup-b');
  const root = document.getElementById('host');
  const accountId = 'acct-server-backup';
  mountLifeWallet({root, authenticated: true, accountId, sessionToken: 'session-B'});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup on a new device');
  const notice = (await wait(() => root.querySelector('[data-wallet-server-backup-notice]'), 'backup notice')).textContent;
  const [first, second] = setup.querySelectorAll('input'); first.value = '2468'; second.value = '2468'; setup.requestSubmit();
  const restore = await wait(() => root.querySelector('form.wallet-server-restore'), 'restore right after the PIN');
  const text = () => [...restore.querySelectorAll('p')].map(p => p.textContent).join(' | ');
  const input = restore.querySelector('input[type=password]');
  input.value = 'Wrong-Password-1'; restore.requestSubmit();
  const wrong = await wait(() => text().includes('맞지 않거나') && text(), 'wrong password');
  const fetchesAfterWrong = core.requests.filter(request => request.url.endsWith('/content')).length;
  input.value = '${PASSWORD}'; restore.requestSubmit();
  const restored = await wait(() => [...root.querySelectorAll('.wallet-message')].map(node => node.textContent).find(text => text.includes('불러왔습니다')), 'restored');
  const fetchesAfterRight = core.requests.filter(request => request.url.endsWith('/content')).length;
  const store = new LifeWalletVault(new IndexedDbWalletRepository()); await store.unlock(accountId, '2468');
  const copies = await fingerprint(await store.list(accountId));
  const deckCards = root.querySelectorAll('.wallet-deck-card').length;
  // Damaged ciphertext and an unknown format are refused; nothing is added.
  const failures = {};
  for (const mode of ['tamper', 'future']) {
    core.mode = mode;
    await openSettings(root, 'restore');
    const form = await wait(() => root.querySelector('form.wallet-server-restore'), 'restore ' + mode);
    form.querySelector('input[type=password]').value = '${PASSWORD}'; form.requestSubmit();
    failures[mode] = await wait(() => { const value = [...form.querySelectorAll('p')].map(p => p.textContent).join(' | '); return /맞지 않거나|지원하지 않거나/.test(value) && value; }, 'failure ' + mode);
    buttonNamed(root, '나중에').click(); await wait(() => root.querySelector('.wallet-deck-shell'), 'back ' + mode);
  }
  core.mode = 'normal';
  const countAfterFailures = (await store.list(accountId)).length;
  // A session that is not FULL (social login): told how, nothing kept.
  core.mode = 'social';
  await openSettings(root, 'keep');
  const keepForm = await wait(() => root.querySelector('form.wallet-server-backup'), 'keep form');
  const [p1, p2] = keepForm.querySelectorAll('input[type=password]'); p1.value = '${PASSWORD}'; p2.value = '${PASSWORD}'; keepForm.querySelector('input[type=checkbox]').checked = true; keepForm.requestSubmit();
  const social = await wait(() => { const value = [...keepForm.querySelectorAll('p')].map(p => p.textContent).join(' | '); return value.includes('패스키') && value; }, 'social message');
  buttonNamed(root, '취소').click(); await wait(() => root.querySelector('.wallet-deck-shell'), 'back from social');
  core.mode = 'normal';
  // Too large: refused in the browser, nothing sent.
  const backupModule = await import('/site-life-wallet-backup.js?test=server-backup-b');
  let sent = 0; let tooLarge = '';
  try { await backupModule.createWalletServerBackup({sessionToken: 's', fetchImpl: async () => { sent += 1; return new Response('{}'); }, maxBytes: 100}).keep('x'.repeat(200)); } catch (error) { tooLarge = error.message; }
  // Delete: asks for the PIN, then the backup is gone.
  await openSettings(root, 'delete');
  const removal = await wait(() => root.querySelector('form.wallet-server-backup-delete'), 'delete form');
  removal.querySelector('input').value = '2468'; removal.requestSubmit();
  const deleted = await wait(() => [...root.querySelectorAll('.wallet-message')].map(node => node.textContent).find(text => text.includes('삭제했습니다')), 'deleted');
  const deleteRequests = core.requests.filter(request => request.method === 'DELETE').length;
  window.__result = JSON.stringify({ok: true, notice, wrong, fetchesAfterWrong, fetchesAfterRight, restored, copies, deckCards, failures, countAfterFailures, social, tooLarge, sent, deleted, deleteRequests, stored: core.stored, requests: core.requests.map(({method, url, body, authorization, credentials}) => ({method, url, body, authorization, credentials}))});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// The new-device notice and the restore form at phone widths, light and dark.
const layout = (sealed, theme) => head.replace('<main id="host">', `<main id="host">`).replace('<body>', `<body data-site-theme="${theme}">`) + `<script>window.__seed = ${JSON.stringify(sealed)};</script><script type="module">
${helpers}
try {
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=server-backup-layout');
  const root = document.getElementById('host');
  mountLifeWallet({root, authenticated: true, accountId: 'acct-layout-' + Date.now(), sessionToken: 'session-L'});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'setup');
  const notice = await wait(() => root.querySelector('[data-wallet-server-backup-notice]'), 'notice');
  const noticeStyle = getComputedStyle(notice);
  const views = {setupOverflow: overflow(), noticeColor: noticeStyle.color, noticeBackground: noticeStyle.backgroundColor};
  const [first, second] = setup.querySelectorAll('input'); first.value = '1357'; second.value = '1357'; setup.requestSubmit();
  const restore = await wait(() => root.querySelector('form.wallet-server-restore'), 'restore');
  views.restoreOverflow = overflow();
  views.restoreButtons = [...restore.querySelectorAll('button')].every(button => { const rect = button.getBoundingClientRect(); return rect.right <= innerWidth + 1 && rect.width > 40; });
  window.__result = JSON.stringify({ok: true, width: innerWidth, ...views});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const run = (fixtureHtml, name, viewport = {width: 390, height: 844, mobile: true}) => runFixturePage({root: ROOT, fixturePath: `/__life_wallet_server_backup_${name}.html`, fixtureHtml, viewport, timeoutMs: 600000, resultExpression: 'window.__result || ""'});

const a = await run(deviceA, 'a');
assert.equal(a.ok, true, a.error);
{
  const detail = JSON.stringify({...a, sealed: `${a.sealed?.length} chars`, requests: a.requests.length});
  assert.equal(a.noticeWithoutBackup, false, `no backup, no notice: ${detail}`);
  assert.match(a.rules.short, /10자 이상/u, detail);
  assert.match(a.rules.oneKind, /두 가지 이상/u, detail);
  assert.match(a.rules.repeated, /반복/u, detail);
  assert.match(a.rules.mismatch, /일치하지 않습니다/u, detail);
  assert.match(a.rules.unchecked, /복구할 수 없다는 안내/u, detail);
  assert.equal(a.putsBefore, 0, `nothing leaves before the password passes the rules: ${detail}`);
  assert.match(a.strength, /강함/u, detail);
  assert.match(a.done, /서버에 백업했습니다/u, detail);
  assert.equal(a.reassuranceBefore, '안전하게 이 기기에만 저장됩니다.', detail);
  assert.match(a.reassuranceAfter, /서버에는 암호화된 백업만/u, `the screen says what the server keeps: ${detail}`);
  assert.equal(a.menu.restore && a.menu.remove, true, detail);
  assert.match(a.menu.help, /마지막 서버 백업: \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}/u, detail);
  assert.equal(a.puts, 1, detail);
  // What left for Core: the sealed envelope only — no PIN, password, note or picture.
  const envelope = JSON.parse(a.sealed);
  assert.deepEqual(Object.keys(envelope).sort(), ['cipher', 'format', 'kdf', 'version'], detail);
  assert.deepEqual(Object.keys(envelope.cipher).sort(), ['aad', 'algorithm', 'ciphertext', 'nonce'], detail);
  assert.deepEqual([envelope.kdf.name, envelope.kdf.iterations, envelope.cipher.algorithm], ['PBKDF2-HMAC-SHA-256', 600000, 'AES-256-GCM'], detail);
  for (const request of a.requests) {
    const text = wireText(request);
    for (const secret of [PASSWORD, NOTE, '1357', 'data:image', 'PDF 1쪽']) assert.ok(!text.includes(secret), `${secret} must not leave the browser: ${request.method} ${request.url}`);
    assert.equal(request.authorization, 'Bearer session-A', 'every call carries the session'); assert.equal(request.credentials, 'omit');
  }
}

const b = await run(deviceB(a.sealed), 'b');
assert.equal(b.ok, true, b.error);
{
  const detail = JSON.stringify({...b, stored: b.stored ? `${b.stored.length} chars` : null, requests: b.requests.length});
  assert.match(b.notice, /서버에 백업한 월렛이 있습니다 \(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}\)/u, `a new device is told a backup exists: ${detail}`);
  assert.match(b.wrong, /맞지 않거나/u, detail);
  assert.equal(b.fetchesAfterWrong, 1, detail);
  assert.equal(b.fetchesAfterRight, 1, `a retry opens the fetched copy again; Core counts one download: ${detail}`);
  assert.match(b.restored, /4개 자료를 불러왔습니다/u, detail);
  assert.deepEqual(b.copies, a.originals, `device B holds exactly device A's items (card, page, PDF page, photo; notes and 분류): ${detail}`);
  assert.equal(b.deckCards, 4, detail);
  assert.match(b.failures.tamper, /맞지 않거나 백업이 손상/u, `a damaged backup is refused: ${detail}`);
  assert.match(b.failures.future, /지원하지 않거나 손상된/u, `an unknown format is refused: ${detail}`);
  assert.equal(b.countAfterFailures, 4, `failed restores add nothing: ${detail}`);
  assert.match(b.social, /이메일·비밀번호 또는 패스키/u, `a session that is not FULL is told how: ${detail}`);
  assert.match(b.tooLarge, /32MB/u, detail); assert.equal(b.sent, 0, 'a too-large backup is not sent');
  assert.match(b.deleted, /서버 백업을 삭제했습니다/u, detail); assert.equal(b.deleteRequests, 1, detail); assert.equal(b.stored, null, detail);
  for (const request of b.requests) {
    const text = wireText(request);
    for (const secret of [PASSWORD, NOTE, '2468', 'data:image']) assert.ok(!text.includes(secret), `${secret} must not leave the browser: ${request.method} ${request.url}`);
  }
}

const widths = [];
for (const [width, theme] of [[320, 'light'], [360, 'dark'], [412, 'light'], [412, 'dark']]) {
  const view = await run(layout(a.sealed, theme), `layout_${width}_${theme}`, {width, height: 800, mobile: true});
  assert.equal(view.ok, true, view.error);
  const detail = JSON.stringify(view);
  assert.equal(view.setupOverflow, false, `no sideways scroll on the new-device screen: ${detail}`);
  assert.equal(view.restoreOverflow, false, detail);
  assert.equal(view.restoreButtons, true, detail);
  assert.notEqual(view.noticeColor, view.noticeBackground, detail);
  widths.push(`${width}${theme === 'dark' ? 'd' : ''}`);
}
console.log(`LIFE_WALLET_SERVER_BACKUP_01 PASS — A→B round trip (4 items), password rules, wrong/damaged/unknown/too-large/not-FULL refused, delete, no plaintext/PIN/password on the wire, layout ${widths.join('/')}`);
