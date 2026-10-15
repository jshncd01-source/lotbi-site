// LIFE-WALLET-WIFI-CARD-01 — Wi-Fi names and passwords in Life Wallet (site-life-wallet-wifi.js,
// site-qr-encode.js, LifeWalletVault.listWifi/saveWifi/removeWifi).
//
// Pure parts: the WIFI: code (escaping \ ; , : "), reading it back, entry rules, sticker text,
// and the QR encoder against Python `qrcode` matrices (scripts/fixtures/wifi-qr-reference.json,
// versions 1-20 and all eight masks). The screens on a Free wallet with one card: a sticker photo
// whose QR is read on this device (a stand-in BarcodeDetector) fills the form; the password is
// masked until 비밀번호 보기 and masked again after 30 seconds; 비밀번호 복사; 와이파이 QR is the
// same matrix as the encoder; the sticker photo opens from 관리; changing and deleting ask for
// the PIN (a wrong PIN changes nothing); an open network; no browser reader → typed by hand.
// The photo is never kept: router-label photos on a keyboard, a desk and the router body
// (scripts/fixtures/wifi-label-scenes.mjs, tilted and on its side) are cut to the label by the
// wallet scanner, trimmed inside its edge, and the kept image's border holds no background pixel
// and stays within the label's size; a photo with no label opens the corner adjustment at once.
// Kept sealed (no plaintext in IndexedDB), never in a backup, never fetched anywhere, and gone
// from the page once the wallet locks. Layout at 360 px, light and dark. All data is synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:auto}</style></head>';

const flow = `${head}<body><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 1200; i += 1) { const value = await predicate(); if (value) return value; await sleep(25); } throw new Error('timed out: ' + label + ' — ' + text().slice(0, 400)); };
const host = document.getElementById('host');
const text = () => host.textContent.replace(/\\s+/gu, ' ');
const q = selector => host.querySelector(selector);
const act = name => { const target = host.querySelector('[data-wallet-wifi-action="' + name + '"]'); if (!target) throw new Error('no action ' + name + ' in ' + text().slice(0, 300)); target.click(); };
const results = {};
try {
  // Timers the module starts for 30 s / 60 s are kept so the test can run them now.
  const realSetTimeout = window.setTimeout.bind(window);
  const timers = [];
  window.setTimeout = (fn, ms, ...rest) => { const id = realSetTimeout(fn, ms, ...rest); if (ms === 30000 || ms === 60000) timers.push({fn, ms, id}); return id; };
  const reference = await (await fetch('/scripts/fixtures/wifi-qr-reference.json')).json();
  // From here no request may leave the page.
  const network = [];
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => { network.push(String(input?.url || input)); return nativeFetch(input, init); };
  const copied = [];
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async value => { copied.push(value); }}});
  const STICKER_QR = 'WIFI:T:WPA;S:LOTBI_Home_5G;P:Synthetic#Pass\\\\,1;;';
  let detectorCalls = 0;
  window.BarcodeDetector = class { constructor(options) { this.options = options; } async detect() { detectorCalls += 1; return [{rawValue: STICKER_QR}]; } };
  delete window.TextDetector;

  const wifi = await import('/site-life-wallet-wifi.js?test=wifi-01');
  const qr = await import('/site-qr-encode.js?test=wifi-01');
  const wallet = await import('/site-life-wallet.js?test=wifi-01');
  const scenes = await import('/scripts/fixtures/wifi-label-scenes.mjs?test=wifi-01');
  const scanUi = await import('/site-life-wallet-scan-ui.js?test=wifi-01');
  const decodeData = async dataUrl => {
    const image = new Image(); await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; });
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const scanLabel = async options => {
    const scene = await scenes.routerLabelScene(options);
    let confirmed = '';
    const scanner = scanUi.createWalletDocumentScanner({file: new File([scene.blob], 'synthetic-router.jpg', {type: 'image/jpeg'}), purpose: 'label', onConfirm: value => { confirmed = value; }});
    document.body.append(scanner.element);
    await wait(() => ['review', 'error'].includes(scanner.element.dataset.scanState), 'label review');
    const button = scanner.element.querySelector('[data-wallet-scan-confirm]');
    const row = {mode: scanner.element.dataset.scanMode, reason: scanner.element.dataset.scanReason, adjusting: scanner.element.dataset.scanAdjusting,
      sourceShown: !scanner.element.querySelector('.wallet-scan-source-pane').hidden, confirmEnabled: !button.disabled,
      status: scanner.element.querySelector('.wallet-scan-status').textContent, scene};
    if (!button.disabled) {
      button.click();
      const kept = await wifi.insetLabelImage(confirmed);
      const pixels = await decodeData(kept);
      row.kept = {width: pixels.width, height: pixels.height, border: scenes.borderBackgroundShare(pixels, 3).share};
    }
    scanner.destroy(); scanner.element.remove();
    return row;
  };

  // ── pure parts ───────────────────────────────────────────────────────────
  const tricky = {kind: 'wifi', id: 'w1', label: '집', ssid: '우리집;5G:"A"', security: 'WPA', password: 'a\\\\b,c:d"e;f!', hidden: true, photo: '', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z'};
  results.payload = wifi.wifiQrPayload(tricky) === 'WIFI:T:WPA;S:우리집\\\\;5G\\\\:\\\\"A\\\\";P:a\\\\\\\\b\\\\,c\\\\:d\\\\"e\\\\;f!;H:true;;';
  const back = wifi.parseWifiQr(wifi.wifiQrPayload(tricky));
  results.roundTrip = back.ssid === tricky.ssid && back.password === tricky.password && back.security === 'WPA' && back.hidden === true;
  results.openPayload = wifi.wifiQrPayload({...tricky, security: 'nopass', password: '', hidden: false}) === 'WIFI:T:nopass;S:우리집\\\\;5G\\\\:\\\\"A\\\\";;';
  const vendor = wifi.parseWifiQr('WIFI:S:KT_GiGA_2G;T:WPA;P:ab12cd34;H:false;;');
  results.vendorOrder = vendor.ssid === 'KT_GiGA_2G' && vendor.password === 'ab12cd34' && vendor.security === 'WPA' && wifi.parseWifiQr('https://example.com') === null;
  const reject = change => { try { wifi.validateWifiEntry({...tricky, ...change}); return false; } catch { return true; } };
  results.rules = [{password: 'short'}, {ssid: 'S'.repeat(33)}, {ssid: ''}, {security: 'nopass'}, {security: 'WEP', password: 'abcdef'},
    {label: ''}, {label: 'L'.repeat(21)}, {password: 'tab\\tinside'}, {security: 'WPA2'}, {photo: 'data:image/png;base64,AAAA'}].every(reject)
    && !reject({security: 'WEP', password: 'abcde'}) && !reject({security: 'WEP', password: '0123456789'}) && !reject({password: 'f'.repeat(64)})
    && !reject({security: 'nopass', password: ''});
  const printed = wifi.readStickerText(['ipTIME A3004NS', 'SSID : iptime_5G_ABCD', '비밀번호: abcd1234ef']);
  const printed2 = wifi.readStickerText(['Network Name: KT_GiGA_2G_Wave2_1A2B', 'WiFi Password: ka1b2c3d4e']);
  results.stickerText = printed.ssid === 'iptime_5G_ABCD' && printed.password === 'abcd1234ef' && printed2.ssid === 'KT_GiGA_2G_Wave2_1A2B' && printed2.password === 'ka1b2c3d4e';
  // The encoder, module by module against Python qrcode (sha256 of the row bits).
  const sha = async bits => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bits)))].map(b => b.toString(16).padStart(2, '0')).join('');
  let matched = 0;
  for (const c of reference.cases) {
    const bytes = Uint8Array.from(atob(c.text_b64), ch => ch.charCodeAt(0));
    const m = qr.encodeQr(bytes, {version: c.version, mask: c.mask});
    if (m.size === c.size && await sha(m.modules.map(row => row.map(v => (v ? '1' : '0')).join('')).join('')) === c.sha256) matched += 1;
  }
  results.qrReference = matched === reference.cases.length && reference.cases.length >= 28;
  results.qrVersions = new Set(reference.cases.map(c => c.version)).size === 20 && new Set(reference.cases.map(c => c.mask)).size === 8;
  let tooLong = false; try { qr.encodeQr('x'.repeat(700)); } catch (error) { tooLong = error.code === 'QR_TOO_LONG'; }
  results.qrTooLong = tooLong;
  const readers = await wifi.readWifiSticker(document.createElement('canvas'), {BarcodeDetectorImpl: null, TextDetectorImpl: class { async detect() { return [{rawValue: 'SSID: Text_Net'}, {rawValue: 'PW: textpass99'}]; } }});
  const none = await wifi.readWifiSticker(document.createElement('canvas'), {BarcodeDetectorImpl: null, TextDetectorImpl: null});
  results.readers = readers.source === 'text' && readers.ssid === 'Text_Net' && readers.password === 'textpass99' && none.source === 'none';

  // ── the label, not the photo ─────────────────────────────────────────────
  const side = scene => {
    const [a, b, c] = scene.corners; const one = Math.hypot(b.x - a.x, b.y - a.y); const two = Math.hypot(c.x - b.x, c.y - b.y);
    return {long: Math.max(one, two), short: Math.min(one, two)};
  };
  const cut = [];
  for (const options of [{seed: 3}, {seed: 5, rotation: -6}, {seed: 7, turned: true}, {seed: 11, body: false}]) {
    const row = await scanLabel(options); const size = side(row.scene);
    const ok = row.mode === 'automatic' && row.reason === 'label-region' && !row.sourceShown && row.kept
      && row.kept.border === 0 && row.kept.width > row.kept.height
      && Math.abs(row.kept.width / row.kept.height - row.scene.aspect) / row.scene.aspect < 0.06
      && row.kept.width <= size.long && row.kept.height <= size.short;
    cut.push({options, ok, mode: row.mode, reason: row.reason, kept: row.kept, aspect: row.scene.aspect, label: size});
  }
  results.labelOnly = cut.every(row => row.ok);
  results.labelCutDetail = JSON.stringify(cut);
  const missing = await scanLabel({seed: 13, label: false});
  results.noLabelAdjust = missing.mode === 'manual' && missing.adjusting === 'true' && missing.sourceShown && !missing.confirmEnabled && missing.status.includes('공유기 스티커를 가까이 찍어 주세요');

  // ── a Free wallet with one card ──────────────────────────────────────────
  const account = 'wifi-card-test-account';
  const vault = new wallet.LifeWalletVault(new wallet.IndexedDbWalletRepository());
  if (!(await vault.hasVault(account))) await vault.create(account, '2468'); else await vault.unlock(account, '2468');
  for (const card of await vault.list(account)) await vault.remove(account, card.id);
  for (const entry of (await vault.listWifi(account)).entries) await vault.removeWifi(account, entry.id, '2468');
  await vault.save(account, {id: 'card-1', kind: 'document', note: '합성 카드', frontDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', updatedAt: '2026-10-10T00:00:00Z'});
  const mount = () => wallet.mountLifeWallet({root: host, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(), subscription: {plan: 'FREE'}});
  let mounted = mount();
  await wait(() => q('[data-wallet-wifi-action="add"]'), 'wifi section');
  results.freeHasWifi = q('.wallet-wifi')?.dataset.walletWifiCount === '0' && text().includes('저장 자료 1개');

  // Add: the sticker photo is read on this device (its QR), the form fills, 부모님 댁.
  detectorCalls = 0;
  act('add');
  const form = await wait(() => q('form[data-wallet-wifi-form="add"]'), 'add form');
  const routerPhoto = await scenes.routerLabelScene({seed: 3});
  const transfer = new DataTransfer(); transfer.items.add(new File([routerPhoto.blob], 'synthetic-router.jpg', {type: 'image/jpeg'}));
  const input = form.querySelector('[data-wallet-wifi-photo-input]'); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
  await wait(() => form.querySelector('.wallet-wifi-status[data-read]'), 'sticker read');
  const inputs = [...form.querySelectorAll('input[type=text], input[type=password]')];
  const ssidInput = inputs.find(el => el.getAttribute('aria-label') === '와이파이 이름(SSID)');
  const passwordInput = form.querySelector('.wallet-wifi-secret');
  // The label is cut in the form; nothing of the photo is shown outside the scanner's own preview.
  const formScanner = await wait(() => form.querySelector('[data-wallet-wifi-scanner][data-scan-state="review"]'), 'label scanner');
  const scannerAutomatic = formScanner.dataset.scanMode === 'automatic' && formScanner.querySelector('.wallet-scan-source-pane').hidden;
  formScanner.querySelector('[data-wallet-scan-confirm]').click();
  await wait(() => form.querySelector('[data-wallet-wifi-crop][data-crop="kept"]'), 'label kept');
  const keptPreview = form.querySelector('.wallet-wifi-photo img');
  const keptPixels = await decodeData(keptPreview.src);
  results.stickerFilled = form.querySelector('.wallet-wifi-status').dataset.read === 'qr' && ssidInput.value === 'LOTBI_Home_5G' && passwordInput.value === 'Synthetic#Pass,1'
    && detectorCalls === 1 && scannerAutomatic && !form.querySelector('[data-wallet-wifi-scanner]') && !form.querySelector('canvas')
    && keptPreview.src.startsWith('data:image/jpeg;base64,') && scenes.borderBackgroundShare(keptPixels, 3).share === 0
    && keptPixels.width < routerPhoto.width * 0.6 && keptPixels.width > keptPixels.height;
  results.passwordMaskedField = passwordInput.dataset.masked === 'true' && passwordInput.getAttribute('autocomplete') === 'off' && passwordInput.dataset.lpignore === 'true';
  form.querySelector('[data-wallet-wifi-label="부모님 댁"]').click();
  act('save');
  // LIFE-WALLET-REDESIGN-02: a new entry opens on its QR at once (closing by itself after a
  // minute), with the green "saved" note; 닫기 goes back to the list on the 생활정보 tab.
  await wait(() => q('.wallet-wifi-qr svg'), 'qr after save');
  results.qrAfterSave = text().includes('와이파이를 암호화하여 저장했어요') && Boolean(timers.find(t => t.ms === 60000))
    && !text().includes('Synthetic#Pass,1') && q('.wallet-wifi-password')?.dataset.masked === 'true';
  act('close-qr');
  const card = await wait(() => q('[data-wallet-wifi-entry]'), 'saved entry');
  results.qrAfterSave = results.qrAfterSave && q('[data-wallet-tab="life"]')?.getAttribute('aria-selected') === 'true';
  const entryId = card.dataset.walletWifiEntry;
  results.savedShown = card.textContent.includes('부모님 댁') && card.textContent.includes('LOTBI_Home_5G') && !text().includes('Synthetic#Pass,1')
    && card.querySelector('.wallet-wifi-password').dataset.masked === 'true' && text().includes('저장 자료 1개');

  // 30-second reveal, copy.
  timers.length = 0;
  act('reveal');
  results.revealed = card.querySelector('.wallet-wifi-password').textContent === 'Synthetic#Pass,1';
  const revealTimer = timers.find(t => t.ms === 30000); revealTimer?.fn();
  results.maskedAgain = Boolean(revealTimer) && card.querySelector('.wallet-wifi-password').dataset.masked === 'true' && !text().includes('Synthetic#Pass,1');
  act('copy'); await wait(() => copied.length === 1, 'copied');
  results.copied = copied[0] === 'Synthetic#Pass,1' && card.querySelector('.wallet-wifi-status').dataset.outcome === 'copied';

  // The QR on screen is the encoder's matrix for the WIFI: code.
  timers.length = 0;
  act('qr');
  const svg = await wait(() => q('.wallet-wifi-qr svg'), 'qr');
  const entry = (await vault.listWifi(account)).entries[0];
  const expected = qr.qrPathData(qr.encodeQr(wifi.wifiQrPayload(entry)));
  results.qrMatches = svg.querySelector('path').getAttribute('d') === expected && wifi.wifiQrPayload(entry) === 'WIFI:T:WPA;S:LOTBI_Home_5G;P:Synthetic#Pass\\\\,1;;'
    && !svg.outerHTML.includes('Synthetic') && Boolean(timers.find(t => t.ms === 60000));
  act('close-qr');
  await wait(() => q('[data-wallet-wifi-entry]'), 'back from qr');

  // 관리: the sticker photo; 수정 with a wrong PIN changes nothing, with the PIN it does.
  act('manage'); await wait(() => q('[data-wallet-wifi-action="photo"]'), 'manage');
  act('photo');
  const shownLabel = q('.wallet-wifi-photo img');
  const stored = (await vault.listWifi(account)).entries[0].photo;
  const storedPixels = await decodeData(stored);
  results.photo = Boolean(shownLabel?.src === stored) && scenes.borderBackgroundShare(storedPixels, 3).share === 0
    && storedPixels.width < routerPhoto.width * 0.6 && storedPixels.height < routerPhoto.height * 0.5;
  act('edit');
  const edit = await wait(() => q('form[data-wallet-wifi-form="edit"]'), 'edit form');
  const labelInput = [...edit.querySelectorAll('input')].find(el => el.getAttribute('aria-label') === '이름');
  labelInput.value = '회사';
  const pin = edit.querySelector('.wallet-pin-input'); pin.value = '1111';
  act('save');
  await wait(() => text().includes('월렛 PIN을 확인해 주세요'), 'wrong pin');
  results.wrongPinKeeps = (await vault.listWifi(account)).entries[0].label === '부모님 댁';
  edit.querySelector('.wallet-pin-input').value = '2468';
  act('save');
  await wait(() => q('[data-wallet-wifi-entry]')?.textContent.includes('회사'), 'edited');
  results.editedWithPin = (await vault.listWifi(account)).entries[0].label === '회사';

  // An open network typed by hand (no reader in this browser).
  delete window.BarcodeDetector;
  act('add');
  const open = await wait(() => q('form[data-wallet-wifi-form="add"]'), 'add open');
  const noLabelPhoto = await scenes.routerLabelScene({seed: 17, label: false});
  const t2 = new DataTransfer(); t2.items.add(new File([noLabelPhoto.blob], 'synthetic-router-2.jpg', {type: 'image/jpeg'}));
  const input2 = open.querySelector('[data-wallet-wifi-photo-input]'); input2.files = t2.files; input2.dispatchEvent(new Event('change', {bubbles: true}));
  await wait(() => open.querySelector('.wallet-wifi-status[data-read]'), 'no reader');
  results.noReader = open.querySelector('.wallet-wifi-status').dataset.read === 'none' && open.textContent.includes('기기 안에서 읽지 못합니다');
  // No label in this photo: the corners open at once, nothing can be kept; 취소 keeps no image.
  const openScanner = await wait(() => open.querySelector('[data-wallet-wifi-scanner][data-scan-state="review"]'), 'no-label scanner');
  results.noLabelInForm = openScanner.dataset.scanAdjusting === 'true' && openScanner.querySelector('[data-wallet-scan-confirm]').disabled
    && openScanner.textContent.includes('공유기 스티커를 가까이 찍어 주세요');
  [...openScanner.querySelectorAll('button')].find(b => b.textContent.trim() === '취소').click();
  await wait(() => open.querySelector('[data-wallet-wifi-crop][data-crop="none"]'), 'no image kept');
  results.noLabelInForm = results.noLabelInForm && !open.querySelector('.wallet-wifi-photo img') && !open.querySelector('[data-wallet-wifi-scanner]');
  const openInputs = [...open.querySelectorAll('input')];
  openInputs.find(el => el.getAttribute('aria-label') === '이름').value = '카페';
  openInputs.find(el => el.getAttribute('aria-label') === '와이파이 이름(SSID)').value = 'Cafe Guest';
  const select = open.querySelector('select'); select.value = 'nopass'; select.dispatchEvent(new Event('change', {bubbles: true}));
  results.nopassHidesPassword = open.querySelector('.wallet-wifi-secret').closest('label').hidden === true;
  act('save');
  await wait(() => q('[data-wallet-wifi-action="close-qr"]'), 'open network qr');
  act('close-qr');
  await wait(() => host.querySelectorAll('[data-wallet-wifi-entry]').length === 2, 'two entries');
  const listed = (await vault.listWifi(account)).entries;
  const cafe = listed.find(item => item.ssid === 'Cafe Guest');
  results.openNetwork = cafe.security === 'nopass' && cafe.password === '' && cafe.photo === '' && wifi.wifiQrPayload(cafe) === 'WIFI:T:nopass;S:Cafe Guest;;' && text().includes('비밀번호 없음');

  // Stored sealed: nothing readable in IndexedDB.
  const rows = await new Promise((resolve, reject) => {
    const opened = indexedDB.open('lotbi-life-wallet-site-v1');
    opened.onsuccess = () => { const req = opened.result.transaction('cards', 'readonly').objectStore('cards').getAll(); req.onsuccess = () => { resolve(req.result); opened.result.close(); }; req.onerror = () => reject(req.error); };
    opened.onerror = () => reject(opened.error);
  });
  const wifiRows = rows.filter(row => String(row.scope).startsWith('wifi:'));
  const raw = JSON.stringify(rows);
  results.sealedAtRest = wifiRows.length === 2 && !/LOTBI_Home_5G|Synthetic#Pass|Cafe Guest|부모님 댁|회사|카페/u.test(raw);
  results.notInDeck = (await vault.list(account)).length === 1;

  // Not in a backup file (and so not in the server backup, which seals the same export).
  const exported = await vault.exportBackup(account, 'Backup-Pass-2026!');
  const other = 'wifi-card-test-restore';
  const restore = new wallet.LifeWalletVault(new wallet.IndexedDbWalletRepository());
  if (!(await restore.hasVault(other))) await restore.create(other, '1357'); else await restore.unlock(other, '1357');
  for (const c of await restore.list(other)) await restore.remove(other, c.id);
  await restore.importBackup(other, exported, 'Backup-Pass-2026!');
  results.notInBackup = (await restore.listWifi(other)).entries.length === 0 && (await restore.list(other)).length === 1;
  await vault.unlock(account, '2468');

  // 삭제 asks for the PIN.
  mounted.dispose(); mounted = mount();
  await wait(() => host.querySelectorAll('[data-wallet-wifi-entry]').length === 2, 're-mounted');
  [...host.querySelectorAll('[data-wallet-wifi-entry]')].find(el => el.textContent.includes('카페')).querySelector('[data-wallet-wifi-action="manage"]').click();
  await wait(() => q('[data-wallet-wifi-action="delete"]'), 'manage cafe'); act('delete');
  const removal = await wait(() => q('.wallet-wifi-form .wallet-pin-input'), 'delete form');
  removal.value = '9999'; removal.form.requestSubmit();
  await wait(() => text().includes('월렛 PIN을 확인해 주세요'), 'wrong delete pin');
  results.wrongPinNoDelete = (await vault.listWifi(account)).entries.length === 2;
  q('.wallet-wifi-form .wallet-pin-input').value = '2468'; q('.wallet-wifi-form').requestSubmit();
  await wait(() => host.querySelectorAll('[data-wallet-wifi-entry]').length === 1, 'deleted');
  results.deletedWithPin = (await vault.listWifi(account)).entries.length === 1;

  // Locked: the section leaves the page; a stale copy button copies nothing.
  const staleCopy = q('[data-wallet-wifi-action="copy"]');
  [...host.querySelectorAll('button')].find(b => b.textContent.trim() === '잠그기').click();
  await wait(() => host.dataset.walletState !== 'unlocked' || !q('.wallet-wifi'), 'locked');
  const before = copied.length; staleCopy.click(); await sleep(100);
  results.lockedGone = !q('.wallet-wifi') && copied.length === before && !text().includes('LOTBI_Home_5G');
  results.noNetwork = network.length === 0;
  mounted.dispose();
  window.__result = JSON.stringify({ok: true, results, network});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error), results}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_wifi_card_01.html', fixtureHtml: flow, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 300_000});
assert.equal(result.ok, true, result.error);
const r = result.results;
for (const key of ['payload', 'roundTrip', 'openPayload', 'vendorOrder', 'rules', 'stickerText', 'qrReference', 'qrVersions', 'qrTooLong', 'readers',
  'freeHasWifi', 'stickerFilled', 'passwordMaskedField', 'qrAfterSave', 'savedShown', 'revealed', 'maskedAgain', 'copied', 'qrMatches', 'photo', 'wrongPinKeeps', 'editedWithPin',
  'labelOnly', 'noLabelAdjust', 'noLabelInForm', 'noReader', 'nopassHidesPassword', 'openNetwork', 'sealedAtRest', 'notInDeck', 'notInBackup', 'wrongPinNoDelete', 'deletedWithPin', 'lockedGone', 'noNetwork']) {
  assert.equal(r[key], true, `${key}: ${JSON.stringify(r)} network=${JSON.stringify(result.network)}`);
}

// Layout: the saved entry, the form and the QR at 360 px, light and dark — no sideways scroll,
// text and its background differ.
const layout = theme => `${head}<body data-site-theme="${theme}"><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 1200; i += 1) { const value = await predicate(); if (value) return value; await sleep(25); } throw new Error('timed out: ' + label); };
const host = document.getElementById('host');
const q = selector => host.querySelector(selector);
const overflow = () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
try {
  const wallet = await import('/site-life-wallet.js?test=wifi-layout');
  const account = 'wifi-card-layout-${theme}';
  const vault = new wallet.LifeWalletVault(new wallet.IndexedDbWalletRepository());
  if (!(await vault.hasVault(account))) await vault.create(account, '2468'); else await vault.unlock(account, '2468');
  for (const entry of (await vault.listWifi(account)).entries) await vault.removeWifi(account, entry.id, '2468');
  await vault.saveWifi(account, {kind: 'wifi', id: 'layout-1', label: '부모님 댁', ssid: 'Very_Long_Network_Name_5G_ABCDE', security: 'WPA', password: 'LayoutPass#2026', hidden: false, photo: '', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z'});
  const mounted = wallet.mountLifeWallet({root: host, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(), subscription: {plan: 'FREE'}});
  const card = await wait(() => q('[data-wallet-wifi-entry]'), 'entry');
  const colors = el => { const style = getComputedStyle(el); return [style.color, getComputedStyle(card).backgroundColor]; };
  const [fg, bg] = colors(card.querySelector('.wallet-wifi-password'));
  const out = {entryOverflow: overflow(), distinct: fg !== bg};
  card.querySelector('[data-wallet-wifi-action="qr"]').click();
  const svg = await wait(() => q('.wallet-wifi-qr svg'), 'qr');
  const box = svg.getBoundingClientRect();
  out.qrOverflow = overflow(); out.qrSize = Math.round(box.width); out.qrSquare = Math.abs(box.width - box.height) < 1;
  host.querySelector('[data-wallet-wifi-action="close-qr"]').click();
  await wait(() => q('[data-wallet-wifi-action="add"]'), 'back');
  q('[data-wallet-wifi-action="add"]').click();
  await wait(() => q('form[data-wallet-wifi-form="add"]'), 'form');
  out.formOverflow = overflow();
  mounted.dispose();
  window.__result = JSON.stringify({ok: true, ...out});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

for (const theme of ['light', 'dark']) {
  const view = await runFixturePage({root: ROOT, fixturePath: `/__life_wallet_wifi_card_01_${theme}.html`, fixtureHtml: layout(theme), resultExpression: 'window.__result || ""', viewport: {width: 360, height: 780, mobile: true, deviceScaleFactor: 1}, timeoutMs: 180_000});
  assert.equal(view.ok, true, view.error);
  assert.equal(view.entryOverflow, false, `${theme}: the wallet with a Wi-Fi entry scrolls sideways at 360 px`);
  assert.equal(view.qrOverflow, false, `${theme}: the QR screen scrolls sideways`);
  assert.equal(view.formOverflow, false, `${theme}: the form scrolls sideways`);
  assert.equal(view.distinct, true, `${theme}: the password text and its card share one colour`);
  assert.ok(view.qrSquare && view.qrSize >= 200, `${theme}: the QR is square and big enough to scan (${view.qrSize}px)`);
}

console.log('LIFE_WALLET_WIFI_CARD_01 PASS — WIFI: code escaping/reading, entry rules, sticker text, QR encoder = Python qrcode (v1-20, masks 0-7), sticker QR read on the device fills the form, only the label kept (keyboard/desk/router body: 0 background pixels on the kept border, tilted and on its side, within the label size), no label → corners open, masked password + 30 s reveal, copy, on-screen QR = encoder, PIN for change/delete, open network, no reader → typed by hand, sealed at rest, not in the deck or a backup, no network, gone once locked, 360 px light/dark');
