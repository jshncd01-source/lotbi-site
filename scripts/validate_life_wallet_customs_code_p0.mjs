// LOTBI_WALLET_CUSTOMS_CODE_P0
// 개인통관고유부호 in Life Wallet: typed in by the owner, kept encrypted on this device, shown
// masked, copied only on a press while the wallet is open, changed or deleted with the wallet PIN.
// (1) format: "P" and 12 digits after dropping spaces and separators; anything else is refused,
//     and a matching shape is never presented as checked by the customs service;
// (2) storage: only ciphertext in IndexedDB, nothing in localStorage, cookies, the URL, the
//     console, events or the network; the device key cannot be exported; a photo item's AAD
//     cannot open it; older wallet code (photo items only) never lists it;
// (3) unlock boundary: nothing readable while locked, a stale copy button copies nothing after
//     locking, logout and leaving the section clear the screen;
// (4) accounts: one account's code is neither shown to nor decryptable by another;
// (5) change/delete need the PIN (a wrong PIN is a failed attempt); a first save needs consent;
// (6) backups: a file backup carries it sealed; other exports leave it out unless asked; a
//     restore never replaces a saved code; older backups and older restorers keep working;
// (7) copy: the result shown is what the browser reported; refused or missing clipboard → the
//     number selected for a manual copy; the clipboard is never said to be cleared;
// (8) official links go only to the customs portal over HTTPS, in a new window;
// (9) on by default for the live site (owner accepted the open review), off with customsCode: false;
// (10) light and dark: the card's text keeps its contrast.
// Synthetic codes only (P000000000123 and the like), never a real person's number.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = theme => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:720px;margin:auto}</style></head><body class="chat-home-page" data-site-theme="${theme}"><main id="host"></main>`;

// Watches every way the code could leave the page or land in plain storage.
const watch = `
const SECRET_DIGITS = ['000000000123', '000000000456', '000000000789'];
const leaks = [];
const network = [];
const consoleLines = [];
const eventDetails = [];
const hasSecret = value => { const text = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value) ?? String(value); } catch { return String(value); } })(); return SECRET_DIGITS.some(digits => text.includes(digits)); };
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => { network.push('fetch ' + String(input?.url || input)); if (hasSecret(init?.body) || hasSecret(String(input?.url || input))) leaks.push('fetch'); return nativeFetch(input, init); };
const nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function open(method, url) { network.push('xhr ' + url); return nativeOpen.apply(this, arguments); };
const nativeSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function send(body) { if (hasSecret(body)) leaks.push('xhr'); return nativeSend.apply(this, arguments); };
navigator.sendBeacon = (url, body) => { network.push('beacon ' + url); if (hasSecret(body)) leaks.push('beacon'); return true; };
const NativeSocket = window.WebSocket;
window.WebSocket = function WebSocket(url, protocols) { network.push('ws ' + url); return new NativeSocket(url, protocols); };
for (const level of ['log', 'info', 'warn', 'error', 'debug']) { const native = console[level].bind(console); console[level] = (...args) => { consoleLines.push(level); if (args.some(hasSecret)) leaks.push('console.' + level); native(...args); }; }
const nativeDispatch = EventTarget.prototype.dispatchEvent;
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) { if (event?.detail !== undefined) { eventDetails.push(event.type); if (hasSecret(event.detail)) leaks.push('event ' + event.type); } return nativeDispatch.call(this, event); };
const storageLeaks = () => {
  const found = [];
  for (const [name, store] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) for (let i = 0; i < store.length; i += 1) { const key = store.key(i); if (hasSecret(key) || hasSecret(store.getItem(key))) found.push(name + ':' + key); }
  if (hasSecret(document.cookie)) found.push('cookie');
  if (hasSecret(location.href)) found.push('url');
  if (performance.getEntriesByType('resource').some(entry => hasSecret(entry.name))) found.push('resource-url');
  return found;
};
// Every row of the wallet database, as stored (CryptoKey objects described, not opened).
const rawDatabase = () => new Promise((resolve, reject) => {
  const open = indexedDB.open('lotbi-life-wallet-site-v1');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const database = open.result; const names = [...database.objectStoreNames];
    const transaction = database.transaction(names, 'readonly'); const rows = {};
    for (const name of names) { const request = transaction.objectStore(name).getAll(); request.onsuccess = () => { rows[name] = request.result; }; }
    transaction.oncomplete = () => { database.close(); resolve(rows); };
    transaction.onerror = () => reject(transaction.error);
  };
});
const describeRows = rows => JSON.stringify(rows, (key, value) => value instanceof CryptoKey ? {cryptoKey: true, extractable: value.extractable, type: value.type, usages: value.usages} : value);
`;

const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = await predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const nativeMatch = window.matchMedia.bind(window);
window.matchMedia = query => /pointer:\\s*coarse/.test(query) ? {matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}} : nativeMatch(query);
const visibleButtons = scope => [...scope.querySelectorAll('button')].filter(button => !button.closest('[hidden]') && button.getClientRects().length);
const press = (scope, text) => { const button = visibleButtons(scope).find(item => item.textContent.trim() === text); if (!button) throw new Error('no button ' + text + ' in ' + visibleButtons(scope).map(item => item.textContent.trim()).join('|')); button.click(); return button; };
const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', {bubbles: true})); };
const setPin = async (root, pin) => { const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup'); const [first, second] = setup.querySelectorAll('input'); first.value = pin; second.value = pin; setup.requestSubmit(); };
const unlockWith = async (root, pin) => { const form = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form'); for (const digit of pin) [...form.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === digit).click(); [...form.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === '열기').click(); };
const customsCard = root => root.querySelector('section.wallet-customs');
// LIFE-WALLET-REDESIGN-02: the code lives on the 생활정보 tab, and backups are rows on the 설정 screen.
const showLife = root => root.querySelector('[data-wallet-tab="life"]')?.click();
const backupDisabled = async root => {
  root.querySelector('[data-wallet-settings-open]').click();
  const page = await wait(() => root.querySelector('[data-wallet-view="settings"]'), 'settings');
  const disabled = page.querySelector('[data-wallet-settings="backup"]').disabled;
  press(page, 'Life Wallet');
  await wait(() => customsCard(root), 'back from settings');
  return disabled;
};
const pngDataUrl = () => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 20; const context = canvas.getContext('2d'); context.fillStyle = '#e9dcae'; context.fillRect(0, 0, 32, 20); return canvas.toDataURL('image/png'); };
`;

// (2)(4)(5)(6) The vault on its own, on the real IndexedDB store.
const vaultFixture = head('light') + `<script type="module">
${watch}
${helpers}
try {
  const wallet = await import('/site-life-wallet.js?test=customs-vault');
  const {LifeWalletVault, IndexedDbWalletRepository, accountScope, normalizeCustomsCode} = wallet;
  const stamp = Date.now();
  const A = 'customs-vault-a-' + stamp, B = 'customs-vault-b-' + stamp, C = 'customs-vault-c-' + stamp, D = 'customs-vault-d-' + stamp;
  const repository = new IndexedDbWalletRepository();
  const vault = new LifeWalletVault(repository);
  const errorOf = async run => { try { await run(); return ''; } catch (error) { return error.message; } };
  await vault.create(A, '2468');
  await vault.save(A, {id: 'photo-1', kind: 'document', note: '', frontDataUrl: pngDataUrl(), updatedAt: new Date().toISOString()});

  const result = {};
  result.noConsent = await errorOf(() => vault.saveCustomsCode(A, {code: 'P000000000123'}));
  result.badFormat = await errorOf(() => vault.saveCustomsCode(A, {code: 'P00000000012', consent: true}));
  result.badExpiry = await errorOf(() => vault.saveCustomsCode(A, {code: 'P000000000123', consent: true, expiresOn: '2027-02-30'}));
  result.afterRefusals = await vault.getCustomsCode(A);
  const saved = await vault.saveCustomsCode(A, {code: ' p0000-0000-0123 ', consent: true, expiresOn: '2027-03-01'});
  result.saved = {code: saved.code, expiresOn: saved.expiresOn, consented: Boolean(saved.consentedAt)};
  result.read = (await vault.getCustomsCode(A))?.code;
  result.photoList = (await vault.list(A)).map(card => card.id);

  // What older wallet code sees: it lists the account's scope only.
  const scopeA = await accountScope(A);
  result.olderCodeRows = (await repository.listCards(scopeA)).map(row => row.id);
  const itemRow = await repository.getCard('items:' + scopeA, 'customs-code');
  const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const tryOpen = async (key, aad) => { try { await crypto.subtle.decrypt({name: 'AES-GCM', iv: decode(itemRow.envelope.nonce), additionalData: new TextEncoder().encode(aad), tagLength: 128}, key, decode(itemRow.envelope.ciphertext)); return true; } catch { return false; } };
  result.aad = {item: await tryOpen(vault.unlocked.key, 'lotbi-wallet-item:v1:' + scopeA + ':customs-code'), asPhotoItem: await tryOpen(vault.unlocked.key, 'lotbi-wallet-card:v1:' + scopeA + ':customs-code'), otherScope: await tryOpen(vault.unlocked.key, 'lotbi-wallet-item:v1:' + scopeA + 'x:customs-code')};

  // At rest: ciphertext only; the device key never leaves the browser.
  const rows = await rawDatabase();
  const described = describeRows(rows);
  result.atRest = {secretInDatabase: hasSecret(described), itemEnvelope: itemRow?.envelope?.algorithm, deviceKeys: rows.deviceKeys.map(row => ({extractable: row.key.extractable, type: row.key.type}))};
  result.atRest.exportRefused = await errorOf(() => crypto.subtle.exportKey('raw', rows.deviceKeys[0].key)) !== '';
  result.atRest.storage = storageLeaks();

  // Change and delete need the PIN; a wrong one counts as a failed attempt.
  result.changeWithoutPin = await errorOf(() => vault.saveCustomsCode(A, {code: 'P000000000456', consent: true}));
  result.changeWrongPin = await errorOf(() => vault.saveCustomsCode(A, {code: 'P000000000456', pin: '1111'}));
  result.failedAttempts = (await repository.getVault(scopeA)).failedAttempts;
  await new Promise(resolve => setTimeout(resolve, 5));
  const changed = await vault.saveCustomsCode(A, {code: 'P000000000456', pin: '2468', expiresOn: ''});
  result.changed = {code: changed.code, expiresOn: changed.expiresOn, keptCreated: changed.createdAt === saved.createdAt, keptConsent: changed.consentedAt === saved.consentedAt, newUpdated: changed.updatedAt !== saved.updatedAt, failedAttempts: (await repository.getVault(scopeA)).failedAttempts};

  // Backups: sealed; the code only when asked; a restore never replaces a saved code.
  const backupPassword = 'synthetic-backup-pass';
  const openBackup = async serialized => {
    const backup = JSON.parse(serialized);
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(backupPassword), {name: 'PBKDF2'}, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: decode(backup.kdf.salt), iterations: backup.kdf.iterations}, material, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: decode(backup.cipher.nonce), additionalData: new TextEncoder().encode(backup.cipher.aad), tagLength: 128}, key, decode(backup.cipher.ciphertext))));
  };
  const plainBackup = await vault.exportBackup(A, backupPassword);
  const fileBackup = await vault.exportBackup(A, backupPassword, {includeItems: true});
  const plainPayload = await openBackup(plainBackup); const filePayload = await openBackup(fileBackup);
  result.backup = {
    format: [JSON.parse(fileBackup).format, JSON.parse(fileBackup).version],
    plainHasItems: 'items' in plainPayload, fileItems: (filePayload.items || []).map(item => item.code), fileCards: filePayload.cards.length,
    sealed: !hasSecret(plainBackup) && !hasSecret(fileBackup),
    // An older restorer reads payload.cards only: every entry there is a photo item it accepts.
    olderRestorerCards: filePayload.cards.every(card => typeof card.frontDataUrl === 'string' && card.kind === 'document'),
  };
  await vault.create(C, '1357');
  result.restoreFresh = {count: await vault.importBackup(C, fileBackup, backupPassword), customs: vault.lastImport.customsCode, code: (await vault.getCustomsCode(C))?.code};
  result.restoreAgain = {count: await vault.importBackup(C, fileBackup, backupPassword), customs: vault.lastImport.customsCode, code: (await vault.getCustomsCode(C))?.code};
  await vault.saveCustomsCode(C, {code: 'P000000000789', pin: '1357'});
  await vault.importBackup(C, fileBackup, backupPassword);
  result.restoreKeepsSaved = {customs: vault.lastImport.customsCode, code: (await vault.getCustomsCode(C))?.code};
  // A backup made before this change (no items) still restores.
  await vault.create(D, '9753');
  result.restoreOld = {count: await vault.importBackup(D, plainBackup, backupPassword), customs: vault.lastImport.customsCode, code: await vault.getCustomsCode(D)};
  // A damaged code in a backup: refused before anything is written.
  const forged = await (async () => {
    const payload = {cards: filePayload.cards, items: [{...filePayload.items[0], code: 'P12'}]};
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(backupPassword), {name: 'PBKDF2'}, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000}, material, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode('LOTBI_LIFE_WALLET_BACKUP_V1'), tagLength: 128}, key, new TextEncoder().encode(JSON.stringify(payload))));
    const b64 = bytes => btoa(String.fromCharCode(...bytes));
    return JSON.stringify({format: 'LOTBI_LIFE_WALLET', version: 1, kdf: {name: 'PBKDF2-HMAC-SHA-256', iterations: 600000, salt: b64(salt)}, cipher: {algorithm: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(ciphertext), aad: 'LOTBI_LIFE_WALLET_BACKUP_V1'}});
  })();
  const beforeForged = (await vault.list(D)).length;
  result.restoreForged = {error: await errorOf(() => vault.importBackup(D, forged, backupPassword)), cardsUnchanged: (await vault.list(D)).length === beforeForged, code: await vault.getCustomsCode(D)};

  // Accounts: B never sees or opens A's code.
  await vault.create(B, '8642');
  const scopeB = await accountScope(B);
  result.accounts = {
    bCode: await vault.getCustomsCode(B),
    bOpensA: await tryOpen(vault.unlocked.key, 'lotbi-wallet-item:v1:' + scopeA + ':customs-code'),
    aWhileB: await errorOf(() => vault.getCustomsCode(A)),
    bRows: (await repository.listCards('items:' + scopeB)).length,
  };

  // Locked: nothing to read or write.
  vault.lock();
  result.locked = {read: await errorOf(() => vault.getCustomsCode(A)), write: await errorOf(() => vault.saveCustomsCode(A, {code: 'P000000000123', consent: true})), remove: await errorOf(() => vault.removeCustomsCode(A, '2468'))};

  // Restart: a new vault object (no session grant) needs the PIN, then the code is there.
  const restarted = new LifeWalletVault(new IndexedDbWalletRepository(), {sessionStorage: null});
  result.restart = {beforeUnlock: await errorOf(() => restarted.getCustomsCode(A))};
  await restarted.unlock(A, '2468');
  result.restart.code = (await restarted.getCustomsCode(A))?.code;
  result.restart.photos = (await restarted.list(A)).length;

  // Delete: PIN again; the photo item stays.
  result.removeWrongPin = await errorOf(() => restarted.removeCustomsCode(A, '0000'));
  await restarted.removeCustomsCode(A, '2468');
  result.removed = {code: await restarted.getCustomsCode(A), photos: (await restarted.list(A)).map(card => card.id)};

  result.format = {
    valid: ['P000000000123', 'p0000 0000 0123', 'P0000-0000-0123', 'Ｐ０００００００００１２３', '000000000123', 'P0000\\u200b0000\\u00a00123', 'P0000.0000.0123'].map(value => { try { return normalizeCustomsCode(value); } catch { return 'REFUSED'; } }),
    invalid: ['P00000000012', 'P0000000001234', 'Q000000000123', 'P00000000012A', '', 'P0000 0000 012O', 'PP000000000123', 'P٠٠٠٠٠٠٠٠٠١٢٣'].map(value => { try { return normalizeCustomsCode(value); } catch (error) { return error.message; } }),
  };
  result.network = network; result.leaks = leaks; result.storageAfter = storageLeaks();
  window.__result = JSON.stringify({ok: true, ...result});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// (1)(3)(4)(5)(7)(8)(9) The mounted wallet on a phone.
const uiFixture = head('light') + `<script type="module">
${watch}
${helpers}
try {
  const historyLength = history.length;
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => visibility});
  const wallet = await import('/site-life-wallet.js?test=customs-ui');
  const root = document.getElementById('host');
  const stamp = Date.now();
  const A = 'customs-ui-a-' + stamp, B = 'customs-ui-b-' + stamp;
  const result = {released: wallet.CUSTOMS_CODE_RELEASED};

  // Signed out: the login notice, nothing else.
  let mounted = wallet.mountLifeWallet({root, authenticated: false, accountId: A, customsCode: true});
  await wait(() => root.textContent.includes('로그인'), 'signed out notice');
  result.signedOut = {card: Boolean(customsCard(root)), links: root.querySelectorAll('a[href^="https://ecos"]').length};
  mounted.dispose();

  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A, customsCode: true});
  await setPin(root, '2468');
  const empty = await wait(() => customsCard(root), 'empty customs card');
  showLife(root);
  const anchors = scope => [...scope.querySelectorAll('a')].map(anchor => ({href: anchor.href, target: anchor.target, rel: anchor.rel, text: anchor.textContent}));
  result.emptyCard = {state: empty.dataset.walletCustoms, buttons: visibleButtons(empty).map(button => button.textContent), links: anchors(empty)};
  result.emptyCard.backupDisabled = await backupDisabled(root);

  // Register: the field, the live format check, consent.
  press(customsCard(root), '등록하기');
  const editor = await wait(() => root.querySelector('[data-wallet-view="customs-edit"]'), 'editor');
  const input = editor.querySelector('.wallet-customs-input');
  result.field = {type: input.type, inputMode: input.inputMode, autocomplete: input.getAttribute('autocomplete'), spellcheck: input.spellcheck, autocorrect: input.getAttribute('autocorrect'), autocapitalize: input.getAttribute('autocapitalize'), ignored: input.getAttribute('data-lpignore') === 'true' && input.dataset.formType === 'other', name: input.name, focused: document.activeElement === input, prefix: editor.querySelector('.wallet-customs-prefix')?.textContent, consent: Boolean(editor.querySelector('.wallet-customs-consent input[type=checkbox]')), pinField: Boolean(editor.querySelector('.wallet-pin-input')), links: anchors(editor)};
  const format = editor.querySelector('.wallet-customs-format');
  type(input, '00000000012');
  result.formatShort = {state: format.dataset.format, text: format.textContent};
  editor.requestSubmit();
  result.submitShort = await wait(() => editor.querySelector('.wallet-message')?.textContent, 'short refused');
  type(input, 'P0000-0000-0123');
  result.formatOk = {state: format.dataset.format, text: format.textContent};
  editor.querySelector('.wallet-message').textContent = '';
  editor.requestSubmit();
  result.submitNoConsent = await wait(() => editor.querySelector('.wallet-message')?.textContent, 'consent refused');
  editor.querySelector('.wallet-customs-consent input').checked = true;
  editor.requestSubmit();
  const card = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'saved card');
  const number = card.querySelector('.wallet-customs-number');
  result.saved = {masked: number.textContent, maskedFlag: number.dataset.masked, pageHasDigits: hasSecret(root.innerHTML), buttons: visibleButtons(card).map(button => button.textContent), message: root.querySelector('.wallet-shell > .wallet-message')?.textContent, links: anchors(card)};

  // 번호 보기 / 가리기.
  press(card, '번호 보기');
  result.revealed = {text: number.textContent, flag: number.dataset.masked};
  press(card, '번호 가리기');
  result.hiddenAgain = {text: number.textContent, flag: number.dataset.masked};

  // Copy: the outcome shown is the browser's.
  const written = [];
  const execCalls = [];
  const setClipboard = value => Object.defineProperty(navigator, 'clipboard', {configurable: true, get: () => value});
  document.execCommand = command => { execCalls.push(command); return false; };
  setClipboard({writeText: async text => { written.push(text); }});
  const copyButton = press(card, '번호 복사');
  const status = card.querySelector('.wallet-customs-status');
  await wait(() => status.dataset.outcome, 'copied');
  result.copyOk = {outcome: status.dataset.outcome, text: status.textContent, written: written.slice(), execCalls: execCalls.length, masked: number.dataset.masked, manualHidden: card.querySelector('.wallet-customs-manual').hidden};
  // Refused by the browser (permission or focus): manual copy, number shown and selected.
  delete status.dataset.outcome;
  setClipboard({writeText: async () => { throw new DOMException('Write permission denied.', 'NotAllowedError'); }});
  press(card, '번호 복사');
  await wait(() => status.dataset.outcome, 'refused');
  const manual = card.querySelector('.wallet-customs-manual');
  result.copyDenied = {outcome: status.dataset.outcome, text: status.textContent, execTried: execCalls.length, manualVisible: !manual.hidden, manualValue: manual.value, selected: [manual.selectionStart, manual.selectionEnd], readOnly: manual.readOnly, revealed: number.dataset.masked === 'false'};
  // No Clipboard API: the older copy command, judged by its own return value.
  delete status.dataset.outcome;
  setClipboard(undefined);
  document.execCommand = command => { execCalls.push(command); return command === 'copy'; };
  press(card, '번호 가리기');
  press(card, '번호 복사');
  await wait(() => status.dataset.outcome, 'legacy copied');
  result.copyLegacy = {outcome: status.dataset.outcome, execCalls: execCalls.slice(), leftovers: document.querySelectorAll('textarea').length};
  // Neither available.
  delete status.dataset.outcome;
  document.execCommand = () => false;
  press(card, '번호 복사');
  await wait(() => status.dataset.outcome, 'no clipboard');
  result.copyNone = {outcome: status.dataset.outcome, manualVisible: !manual.hidden};
  setClipboard({writeText: async text => { written.push(text); }});

  // Locked: the card leaves the page; the stale button copies nothing.
  const writtenBefore = written.length;
  press(root, '잠그기');
  await wait(() => root.querySelector('.wallet-unlock-form'), 'locked');
  copyButton.click();
  await sleep(100);
  result.locked = {written: written.length - writtenBefore, pageHasDigits: hasSecret(root.innerHTML), card: Boolean(customsCard(root))};

  // Unlock: masked again.
  await unlockWith(root, '2468');
  const card2 = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'card after unlock');
  result.afterUnlock = {flag: card2.querySelector('.wallet-customs-number').dataset.masked};
  result.afterUnlock.backupEnabled = !(await backupDisabled(root));

  // 관리: facts, the caution, the official steps.
  press(await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'card after settings'), '관리');
  const detail = await wait(() => root.querySelector('[data-wallet-view="customs"]'), 'detail');
  result.detail = {caution: detail.querySelector('.wallet-customs-caution')?.textContent, facts: [...detail.querySelectorAll('.wallet-customs-facts dt')].map(term => term.textContent), steps: [...detail.querySelectorAll('[data-wallet-customs-step]')].map(step => step.dataset.walletCustomsStep), links: anchors(detail), masked: detail.querySelector('.wallet-customs-number').dataset.masked, buttons: visibleButtons(detail).map(button => button.textContent)};

  // Change: PIN needed; expiry within 30 days shows the renewal notice.
  press(detail, '번호·만료일 변경');
  const change = await wait(() => root.querySelector('[data-wallet-view="customs-edit"]'), 'change editor');
  result.changeForm = {value: change.querySelector('.wallet-customs-input').value, pinField: Boolean(change.querySelector('.wallet-pin-input')), consent: Boolean(change.querySelector('.wallet-customs-consent'))};
  type(change.querySelector('.wallet-customs-input'), '0000 0000 0456');
  const soon = new Date(); soon.setDate(soon.getDate() + 10);
  change.querySelector('input[type=date]').value = soon.getFullYear() + '-' + String(soon.getMonth() + 1).padStart(2, '0') + '-' + String(soon.getDate()).padStart(2, '0');
  change.querySelector('.wallet-pin-input').value = '1111';
  change.requestSubmit();
  result.changeWrongPin = await wait(() => change.querySelector('.wallet-message')?.textContent, 'wrong pin');
  change.querySelector('.wallet-message').textContent = '';
  change.querySelector('.wallet-pin-input').value = '2468';
  change.requestSubmit();
  const card3 = await wait(() => { const found = customsCard(root); return found?.dataset.walletCustoms === 'saved' && found.querySelector('.wallet-customs-number').textContent.endsWith('0456') && found; }, 'changed card');
  const renewal = card3.querySelector('.wallet-customs-renewal');
  result.changed = {masked: card3.querySelector('.wallet-customs-number').textContent, renewal: renewal?.dataset.renewal, renewalText: renewal?.textContent, renewalLink: renewal?.querySelector('a')?.href};

  // Another account in the same browser.
  mounted.dispose();
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: B, customsCode: true});
  await setPin(root, '1357');
  const cardB = await wait(() => customsCard(root), 'B card');
  showLife(root);
  result.accountB = {state: cardB.dataset.walletCustoms, pageHasA: root.innerHTML.includes('0456')};
  press(cardB, '등록하기');
  const editorB = await wait(() => root.querySelector('[data-wallet-view="customs-edit"]'), 'B editor');
  type(editorB.querySelector('.wallet-customs-input'), 'P000000000789');
  editorB.querySelector('.wallet-customs-consent input').checked = true;
  editorB.requestSubmit();
  await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved', 'B saved');
  result.accountB.masked = customsCard(root).querySelector('.wallet-customs-number').textContent;
  mounted.dispose();
  sessionStorage.clear();
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A, customsCode: true});
  await unlockWith(root, '2468');
  const cardA = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'A again');
  result.accountAAgain = cardA.querySelector('.wallet-customs-number').textContent;

  // Leaving the section (the phone back button closes it) clears the screen; reopening within
  // ten minutes opens the wallet again, the number masked.
  mounted.dispose();
  result.back = {cleared: root.childElementCount === 0, historyPushed: history.length - historyLength};
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A, customsCode: true});
  const reopened = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'reopened');
  result.back.masked = reopened.querySelector('.wallet-customs-number').dataset.masked;

  // Background (another app, the customs portal in a new tab): the screen is cleared.
  visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await sleep(400);
  result.background = {cleared: root.childElementCount === 0};
  visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
  await wait(() => customsCard(root), 'back from background');

  // Logout locks and clears.
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  await wait(() => root.textContent.includes('로그인'), 'logged out');
  result.logout = {card: Boolean(customsCard(root)), pageHasDigits: hasSecret(root.innerHTML)};
  mounted.dispose();

  // The live default (no option, as site-consumer-sections mounts it): the card, masked.
  sessionStorage.clear();
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A});
  await unlockWith(root, '2468');
  const liveCard = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'live default card');
  result.liveDefault = {state: liveCard.dataset.walletCustoms, masked: liveCard.querySelector('.wallet-customs-number').textContent, pageHasDigits: hasSecret(root.innerHTML)};
  mounted.dispose();

  // Switched off (customsCode: false): no 개인통관고유부호 anywhere, even with one saved.
  sessionStorage.clear();
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A, customsCode: false});
  await unlockWith(root, '2468');
  await wait(() => root.querySelector('.wallet-shell'), 'wallet switched off');
  result.switchedOff = {card: Boolean(customsCard(root)), text: root.textContent.includes('개인통관')};
  mounted.dispose();

  // Delete with the PIN.
  sessionStorage.clear();
  mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: A, customsCode: true});
  await unlockWith(root, '2468');
  await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved', 'card for delete ready');
  showLife(root);
  press(customsCard(root), '관리');
  const detail2 = await wait(() => root.querySelector('[data-wallet-view="customs"]'), 'detail for delete');
  press(detail2, '번호 삭제');
  const removal = detail2.querySelector('form.wallet-delete-confirm');
  removal.querySelector('input').value = '0000'; removal.requestSubmit();
  result.deleteWrongPin = await wait(() => removal.querySelector('.wallet-message')?.textContent, 'delete wrong pin');
  removal.querySelector('input').value = '2468'; removal.requestSubmit();
  await wait(() => customsCard(root)?.dataset.walletCustoms === 'empty', 'deleted');
  result.deleted = {message: root.querySelector('.wallet-shell > .wallet-message')?.textContent};
  mounted.dispose();

  result.layout = {pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth};
  result.network = network; result.leaks = leaks; result.storage = storageLeaks(); result.events = eventDetails;
  result.rawDatabaseHasDigits = hasSecret(describeRows(await rawDatabase()));
  window.__result = JSON.stringify({ok: true, ...result});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// Restart for real: save, reload the page with the session gone, unlock with the PIN.
const restartFixture = head('light') + `<script type="module">
${helpers}
try {
  const wallet = await import('/site-life-wallet.js?test=customs-restart');
  const root = document.getElementById('host');
  const phase = localStorage.getItem('customs-restart-phase');
  const account = localStorage.getItem('customs-restart-account') || ('customs-restart-' + Date.now());
  if (!phase) {
    localStorage.setItem('customs-restart-account', account);
    wallet.mountLifeWallet({root, authenticated: true, accountId: account, customsCode: true});
    await setPin(root, '3579');
    await wait(() => customsCard(root), 'card'); showLife(root);
    press(customsCard(root), '등록하기');
    const editor = await wait(() => root.querySelector('[data-wallet-view="customs-edit"]'), 'editor');
    type(editor.querySelector('.wallet-customs-input'), 'P000000000123');
    editor.querySelector('.wallet-customs-consent input').checked = true;
    editor.requestSubmit();
    await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved', 'saved');
    localStorage.setItem('customs-restart-phase', 'reload');
    sessionStorage.clear();
    location.reload();
  } else {
    localStorage.removeItem('customs-restart-phase'); localStorage.removeItem('customs-restart-account');
    wallet.mountLifeWallet({root, authenticated: true, accountId: account, customsCode: true});
    const unlockShown = Boolean(await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock after restart'));
    await unlockWith(root, '3579');
    const card = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'card after restart');
    card.querySelector('[data-wallet-customs-action="reveal"]').click();
    window.__result = JSON.stringify({ok: true, unlockShown, revealed: card.querySelector('.wallet-customs-number').textContent});
  }
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// (10) The card and editor in both themes: contrast of their text against the page.
const themeFixture = theme => head(theme) + `<script type="module">
${helpers}
try {
  const wallet = await import('/site-life-wallet.js?test=customs-theme-${theme}');
  const root = document.getElementById('host');
  wallet.mountLifeWallet({root, authenticated: true, accountId: 'customs-theme-${theme}-' + Date.now(), customsCode: true});
  await setPin(root, '2468');
  await wait(() => customsCard(root), 'card'); showLife(root);
  press(customsCard(root), '등록하기');
  const editor = await wait(() => root.querySelector('[data-wallet-view="customs-edit"]'), 'editor');
  type(editor.querySelector('.wallet-customs-input'), 'P000000000123');
  const soon = new Date(); soon.setDate(soon.getDate() + 5);
  editor.querySelector('input[type=date]').value = soon.toISOString().slice(0, 10);
  editor.querySelector('.wallet-customs-consent input').checked = true;
  // rgb()/rgba(), and color(srgb …) which Chrome reports for color-mix().
  const parse = value => {
    const srgb = value.match(/color\\(srgb ([^)]+)\\)/);
    if (srgb) { const parts = srgb[1].split(/[ /]+/).filter(Boolean).map(Number); return {rgb: parts.slice(0, 3).map(part => part * 255), alpha: parts.length > 3 ? parts[3] : 1}; }
    const match = value.match(/rgba?\\(([^)]+)\\)/); if (!match) return null;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number); return {rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1};
  };
  const background = element => { for (let node = element; node; node = node.parentElement) { const color = parse(getComputedStyle(node).backgroundColor); if (color && color.alpha > 0.5) return color.rgb; } return parse(getComputedStyle(document.body).backgroundColor)?.rgb || [255, 255, 255]; };
  const luminance = rgb => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const ratio = element => { const fore = parse(getComputedStyle(element).color).rgb; const back = background(element); const [high, low] = [luminance(fore), luminance(back)].sort((a, b) => b - a); return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100; };
  const measure = scope => Object.fromEntries([...scope.querySelectorAll('.wallet-customs-number, .wallet-customs-hint, .wallet-customs-status, .wallet-customs-link, .wallet-customs-renewal, .wallet-customs-format, .wallet-customs-consent span, .wallet-customs-prefix, .wallet-customs-input, .wallet-customs-title, .wallet-customs-step strong, .wallet-customs-step span, .wallet-customs-caution, .wallet-customs-facts dd, .wallet-customs-facts dt')].filter(element => element.textContent.trim() || element.value).map((element, index) => [index + ':' + element.className + ':' + element.tagName, ratio(element)]));
  const editorRatios = measure(editor);
  editor.requestSubmit();
  const card = await wait(() => customsCard(root)?.dataset.walletCustoms === 'saved' && customsCard(root), 'saved');
  Object.defineProperty(navigator, 'clipboard', {configurable: true, get: () => ({writeText: async () => {}})});
  card.querySelector('[data-wallet-customs-action="copy"]').click();
  await wait(() => card.querySelector('.wallet-customs-status').dataset.outcome, 'copied');
  const cardRatios = measure(card);
  card.querySelector('[data-wallet-customs-action="manage"]').click();
  const detail = await wait(() => root.querySelector('[data-wallet-view="customs"]'), 'detail');
  const detailRatios = measure(detail);
  window.__result = JSON.stringify({ok: true, theme: '${theme}', bodyBackground: getComputedStyle(document.body).backgroundColor, editorRatios, cardRatios, detailRatios, pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const run = (fixtureHtml, viewport, name) => runFixturePage({root: ROOT, fixturePath: `/__life_wallet_customs_${name}.html`, fixtureHtml, viewport, touch: true, timeoutMs: 600000, resultExpression: 'window.__result || ""'});

const vault = await run(vaultFixture, {width: 390, height: 844, mobile: true}, 'vault');
assert.equal(vault.ok, true, vault.error);
{
  const detail = JSON.stringify(vault);
  assert.deepEqual(vault.format.valid, Array(7).fill('P000000000123'), `spaces, separators, full-width and a missing P normalise: ${detail}`);
  assert.ok(vault.format.invalid.every(message => message.startsWith('개인통관고유부호는 P와 숫자 12자리')), `every other shape is refused: ${detail}`);
  assert.equal(vault.noConsent, '이 기기에 암호화해 보관하는 데 동의해야 저장할 수 있습니다.', detail);
  assert.ok(vault.badFormat.startsWith('개인통관고유부호는 P와 숫자 12자리'), detail);
  assert.equal(vault.badExpiry, '만료일을 날짜로 입력해 주세요.', detail);
  assert.equal(vault.afterRefusals, null, `refused saves write nothing: ${detail}`);
  assert.deepEqual(vault.saved, {code: 'P000000000123', expiresOn: '2027-03-01', consented: true}, detail);
  assert.equal(vault.read, 'P000000000123', detail);
  assert.deepEqual(vault.photoList, ['photo-1'], `the photo list is unchanged: ${detail}`);
  assert.deepEqual(vault.olderCodeRows, ['photo-1'], `older wallet code (photo items only) never meets the code: ${detail}`);
  assert.deepEqual(vault.aad, {item: true, asPhotoItem: false, otherScope: false}, `its own AAD, bound to the account: ${detail}`);
  assert.equal(vault.atRest.secretInDatabase, false, `IndexedDB holds ciphertext only: ${detail}`);
  assert.equal(vault.atRest.itemEnvelope, 'AES-256-GCM', detail);
  assert.ok(vault.atRest.deviceKeys.length > 0 && vault.atRest.deviceKeys.every(key => key.extractable === false && key.type === 'secret'), `device keys are non-extractable: ${detail}`);
  assert.equal(vault.atRest.exportRefused, true, `the device key cannot be exported: ${detail}`);
  assert.deepEqual(vault.atRest.storage, [], `no localStorage, sessionStorage, cookie or URL copy: ${detail}`);
  assert.equal(vault.changeWithoutPin, '월렛 PIN은 숫자 4자리로 입력해 주세요.', `replacing needs the PIN: ${detail}`);
  assert.equal(vault.changeWrongPin, '월렛 PIN을 확인해 주세요.', detail);
  assert.equal(vault.failedAttempts, 1, `a wrong PIN counts as a failed attempt: ${detail}`);
  assert.deepEqual(vault.changed, {code: 'P000000000456', expiresOn: '', keptCreated: true, keptConsent: true, newUpdated: true, failedAttempts: 0}, detail);
  assert.deepEqual(vault.backup.format, ['LOTBI_LIFE_WALLET', 1], `the backup format is unchanged: ${detail}`);
  assert.equal(vault.backup.plainHasItems, false, `exports leave the code out unless asked: ${detail}`);
  assert.deepEqual(vault.backup.fileItems, ['P000000000456'], `the file backup carries it: ${detail}`);
  assert.equal(vault.backup.fileCards, 1, detail);
  assert.equal(vault.backup.sealed, true, `backups are sealed: ${detail}`);
  assert.equal(vault.backup.olderRestorerCards, true, `an older restorer still restores the photo items: ${detail}`);
  assert.deepEqual(vault.restoreFresh, {count: 1, customs: 'restored', code: 'P000000000456'}, detail);
  assert.deepEqual(vault.restoreAgain, {count: 1, customs: 'kept', code: 'P000000000456'}, detail);
  assert.deepEqual(vault.restoreKeepsSaved, {customs: 'kept', code: 'P000000000789'}, `a restore never replaces a saved code: ${detail}`);
  assert.deepEqual(vault.restoreOld, {count: 1, customs: 'none', code: null}, `older backups restore: ${detail}`);
  assert.ok(vault.restoreForged.error.startsWith('개인통관고유부호는 P와 숫자 12자리'), detail);
  assert.equal(vault.restoreForged.cardsUnchanged, true, `a damaged backup writes nothing: ${detail}`);
  assert.equal(vault.restoreForged.code, null, detail);
  assert.deepEqual(vault.accounts, {bCode: null, bOpensA: false, aWhileB: 'Life Wallet 잠금을 먼저 해제해 주세요.', bRows: 0}, `accounts are separate: ${detail}`);
  assert.deepEqual(vault.locked, {read: 'Life Wallet 잠금을 먼저 해제해 주세요.', write: 'Life Wallet 잠금을 먼저 해제해 주세요.', remove: 'Life Wallet 잠금을 먼저 해제해 주세요.'}, detail);
  assert.equal(vault.restart.beforeUnlock, 'Life Wallet 잠금을 먼저 해제해 주세요.', detail);
  assert.equal(vault.restart.code, 'P000000000456', `the code decrypts after a restart: ${detail}`);
  assert.equal(vault.restart.photos, 1, detail);
  assert.equal(vault.removeWrongPin, '월렛 PIN을 확인해 주세요.', detail);
  assert.deepEqual(vault.removed, {code: null, photos: ['photo-1']}, `deleting the code keeps the other items: ${detail}`);
  assert.deepEqual(vault.network, [], `nothing goes over the network: ${detail}`);
  assert.deepEqual(vault.leaks, [], detail);
  assert.deepEqual(vault.storageAfter, [], detail);
}

const ui = await run(uiFixture, {width: 360, height: 800, mobile: true}, 'ui');
assert.equal(ui.ok, true, ui.error);
{
  const detail = JSON.stringify(ui);
  const portal = 'https://ecos.customs.go.kr/ecp/index.do';
  const officialOnly = links => links.length > 0 && links.every(link => link.href === portal && link.target === '_blank' && link.rel === 'noopener noreferrer');
  assert.equal(ui.released, true, `on for the live site (owner accepted the open 2026-10-05 review on 2026-10-10): ${detail}`);
  assert.deepEqual(ui.signedOut, {card: false, links: 0}, detail);
  assert.equal(ui.emptyCard.state, 'empty', detail);
  assert.deepEqual(ui.emptyCard.buttons, ['등록하기'], detail);
  assert.ok(officialOnly(ui.emptyCard.links), `official links only: ${detail}`);
  assert.equal(ui.emptyCard.backupDisabled, true, detail);
  assert.deepEqual({...ui.field, links: undefined}, {type: 'text', inputMode: 'numeric', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'off', ignored: true, name: '', focused: false, prefix: 'P', consent: true, pinField: false, links: undefined}, `kept away from autofill, spell check and password managers; consent on a first save: ${detail}`);
  assert.ok(officialOnly(ui.field.links), detail);
  assert.equal(ui.formatShort.state, 'invalid', detail);
  assert.ok(ui.formatShort.text.includes('지금 숫자 11자리'), detail);
  assert.ok(ui.submitShort.startsWith('개인통관고유부호는 P와 숫자 12자리'), detail);
  assert.equal(ui.formatOk.state, 'ok', detail);
  assert.ok(ui.formatOk.text.includes('관세청에서 확인된 번호라는 뜻은 아닙니다'), `a matching shape is not a customs check: ${detail}`);
  assert.equal(ui.submitNoConsent, '이 기기에 암호화해 보관하는 데 동의해야 저장할 수 있습니다.', detail);
  assert.deepEqual({...ui.saved, links: undefined}, {masked: 'P •••• •••• 0123', maskedFlag: 'true', pageHasDigits: false, buttons: ['관리', '번호 복사', '번호 보기'], message: '개인통관고유부호를 암호화하여 저장했습니다.', links: undefined}, `saved and shown masked: ${detail}`);
  assert.ok(officialOnly(ui.saved.links), detail);
  assert.deepEqual(ui.revealed, {text: 'P 0000 0000 0123', flag: 'false'}, detail);
  assert.deepEqual(ui.hiddenAgain, {text: 'P •••• •••• 0123', flag: 'true'}, detail);
  assert.equal(ui.copyOk.outcome, 'copied', detail);
  assert.deepEqual(ui.copyOk.written, ['P000000000123'], `the bare code is copied: ${detail}`);
  assert.equal(ui.copyOk.execCalls, 0, detail);
  assert.ok(ui.copyOk.text.includes('클립보드에 남고 LOTBI가 지우지 않으니'), `the clipboard warning, without claiming it is cleared: ${detail}`);
  assert.equal(ui.copyOk.masked, 'true', `copying does not reveal the number: ${detail}`);
  assert.equal(ui.copyOk.manualHidden, true, detail);
  assert.equal(ui.copyDenied.outcome, 'manual', detail);
  assert.ok(ui.copyDenied.text.includes('직접 복사'), detail);
  assert.deepEqual({...ui.copyDenied, outcome: undefined, text: undefined, execTried: undefined}, {outcome: undefined, text: undefined, execTried: undefined, manualVisible: true, manualValue: 'P000000000123', selected: [0, 13], readOnly: true, revealed: true}, `refused: the number shown and selected for a manual copy: ${detail}`);
  assert.equal(ui.copyDenied.execTried, 1, `the older copy command is tried and its false result trusted: ${detail}`);
  assert.equal(ui.copyLegacy.outcome, 'copied', detail);
  assert.equal(ui.copyLegacy.leftovers, 0, `the temporary copy field is removed: ${detail}`);
  assert.deepEqual(ui.copyNone, {outcome: 'manual', manualVisible: true}, detail);
  assert.deepEqual(ui.locked, {written: 0, pageHasDigits: false, card: false}, `locked: nothing on the page, a stale button copies nothing: ${detail}`);
  assert.deepEqual(ui.afterUnlock, {flag: 'true', backupEnabled: true}, detail);
  assert.ok(ui.detail.caution.includes('본인 번호인지는 LOTBI가 확인할 수 없으니'), detail);
  assert.deepEqual(ui.detail.facts, ['등록', '마지막 변경', '입력한 만료일'], detail);
  assert.deepEqual(ui.detail.steps, ['lookup', 'update', 'renew', 'reissue'], `조회·정보 변경·갱신·부호 변경 on the portal: ${detail}`);
  assert.ok(officialOnly(ui.detail.links), detail);
  assert.equal(ui.detail.masked, 'true', detail);
  assert.deepEqual(ui.detail.buttons, ['목록으로', '번호 복사', '번호 보기', '번호·만료일 변경', '번호 삭제'], detail);
  assert.deepEqual(ui.changeForm, {value: '000000000123', pinField: true, consent: false}, detail);
  assert.equal(ui.changeWrongPin, '월렛 PIN을 확인해 주세요.', detail);
  assert.equal(ui.changed.masked, 'P •••• •••• 0456', detail);
  assert.equal(ui.changed.renewal, 'renew', detail);
  assert.ok(ui.changed.renewalText.includes('10일 남았습니다'), detail);
  assert.equal(ui.changed.renewalLink, portal, detail);
  assert.deepEqual(ui.accountB, {state: 'empty', pageHasA: false, masked: 'P •••• •••• 0789'}, `another account starts empty and keeps its own: ${detail}`);
  assert.equal(ui.accountAAgain, 'P •••• •••• 0456', detail);
  assert.deepEqual(ui.back, {cleared: true, historyPushed: 0, masked: 'true'}, `closing the section clears it; no history entries of its own: ${detail}`);
  assert.deepEqual(ui.background, {cleared: true}, detail);
  assert.deepEqual(ui.logout, {card: false, pageHasDigits: false}, detail);
  assert.deepEqual(ui.liveDefault, {state: 'saved', masked: 'P •••• •••• 0456', pageHasDigits: false}, `on by default (owner accepted the open review), masked: ${detail}`);
  assert.deepEqual(ui.switchedOff, {card: false, text: false}, `the switch still takes it off the page: ${detail}`);
  assert.equal(ui.deleteWrongPin, '월렛 PIN을 확인해 주세요.', detail);
  assert.equal(ui.deleted.message, '개인통관고유부호를 삭제했습니다.', detail);
  assert.equal(ui.layout.pageFits, true, detail);
  assert.deepEqual(ui.network, [], `nothing goes over the network: ${detail}`);
  assert.deepEqual(ui.leaks, [], `no console, event or request carries the code: ${detail}`);
  assert.deepEqual(ui.storage, [], detail);
  assert.equal(ui.rawDatabaseHasDigits, false, detail);
}

const restart = await run(restartFixture, {width: 390, height: 844, mobile: true}, 'restart');
assert.equal(restart.ok, true, restart.error);
assert.deepEqual(restart, {ok: true, unlockShown: true, revealed: 'P 0000 0000 0123'}, `after a reload without the session the PIN opens the saved code: ${JSON.stringify(restart)}`);

for (const theme of ['light', 'dark']) {
  const measured = await run(themeFixture(theme), {width: 375, height: 812, mobile: true}, `theme_${theme}`);
  assert.equal(measured.ok, true, measured.error);
  const detail = JSON.stringify(measured);
  for (const [name, value] of Object.entries({...measured.editorRatios, ...measured.cardRatios, ...measured.detailRatios})) {
    assert.ok(value >= 4.5, `${theme}: ${name} contrast ${value} < 4.5: ${detail}`);
  }
  assert.equal(measured.pageFits, true, detail);
}

console.log('LOTBI_WALLET_CUSTOMS_CODE_P0 PASS — P+12 format (separators/full-width/missing P; others refused, not a customs check), consent, ciphertext-only IndexedDB, non-extractable device key, own AAD, older code never lists it, PIN for change/delete, lock/logout/back/background clear, stale copy blocked, accounts separate, backups sealed (file only)/older formats/restore keeps saved, copy outcome from the browser + manual fallback, portal-only links, off by default, light/dark contrast, no network/console/event/storage leaks');
