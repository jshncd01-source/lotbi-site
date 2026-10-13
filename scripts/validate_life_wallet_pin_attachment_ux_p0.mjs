// LIFE-WALLET-PIN-ATTACHMENT-UX-P0
// Samsung Internet feedback on Life Wallet:
// (1) entering the wallet PIN made the browser (Samsung Pass) offer to save a website login. A
//     type=password field makes every PIN form look like a login, whatever autocomplete says, so
//     PIN fields are masked text fields (never type=password) with a number pad, and nothing is
//     focused on its own on a phone;
// (2) one way to add an item: 첫 자료 등록하기 on an empty wallet, + 자료 추가 once one is saved,
//     and one attach area whose menu offers exactly 카메라 (direct shot) and 내 파일 (photos and
//     PDFs); the 사진 선택 / PDF / + buttons and the scanner's own 다시 선택 are gone;
// (3) the chooser: a second tap does not open a second chooser, the same file can be chosen
//     again, a cancelled or rejected choice keeps the previous photo, a new file replaces the old
//     one and its scanner, size and type limits still hold;
// (4) a camera trip hides the page on a phone: the add form survives it while the key still
//     leaves memory (saving waits for the page to come back), and the saved item decrypts after
//     locking; without a chooser open, going to the background still clears the screen.
// Synthetic images, PDFs and PINs only.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:720px;margin:auto}</style></head><body class="chat-home-page"><main id="host"></main>';
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = await predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
// A phone: coarse pointer.
const nativeMatch = window.matchMedia.bind(window);
window.matchMedia = query => /pointer:\\s*coarse/.test(query) ? {matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}} : nativeMatch(query);
// A card photo with print on it (synthetic).
const cardFile = async (name, variant = 0) => {
  const source = document.createElement('canvas'); source.width = 480; source.height = 320; const context = source.getContext('2d');
  context.fillStyle = '#18212d'; context.fillRect(0, 0, 480, 320); context.beginPath(); context.moveTo(70, 55); context.lineTo(420, 40); context.lineTo(440, 275); context.lineTo(50, 285); context.closePath();
  context.fillStyle = '#e9dcae'; context.fill(); context.lineWidth = 8; context.strokeStyle = '#fff'; context.stroke();
  for (let row = 0; row < 5; row += 1) for (let glyph = 0; glyph < 18; glyph += 1) { context.fillStyle = '#2a2a2a'; context.fillRect(125 + glyph * 13, 98 + row * 30, 8 + ((glyph + variant) % 3), 10 + ((row + variant) % 2)); }
  return new File([await new Promise(resolve => source.toBlob(resolve, 'image/png'))], name, {type: 'image/png'});
};
const feed = (input, file) => { const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true})); };
// Clicks on the hidden file inputs are counted and kept from opening a real chooser.
const countClicks = input => { const counter = {count: 0}; input.addEventListener('click', event => { counter.count += 1; event.preventDefault(); }); return counter; };
const buttons = scope => [...scope.querySelectorAll('button')].filter(button => !button.closest('[hidden]') && button.getClientRects().length).map(button => button.innerText.replace(/\\s+/gu, ' ').trim());
`;

// (1) PIN fields on every PIN screen, (2) the add entry points.
const pinFixture = head + `<script type="module">
${helpers}
try {
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=pin-attach-pin');
  const root = document.getElementById('host');
  mountLifeWallet({root, authenticated: true, accountId: 'pin-attach-pin-' + Date.now()});
  const describe = input => ({type: input.type, mask: getComputedStyle(input).webkitTextSecurity || '', autocomplete: input.getAttribute('autocomplete'), inputMode: input.inputMode, focused: document.activeElement === input, ignore: input.getAttribute('data-lpignore') === 'true' && input.dataset.formType === 'other'});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  await sleep(100);
  const setupFields = [...setup.querySelectorAll('input')].map(describe);
  const [first, second] = setup.querySelectorAll('input'); first.value = '1357'; second.value = '1357'; setup.requestSubmit();
  const empty = await wait(() => root.querySelector('.wallet-empty'), 'empty wallet');
  const emptyButtons = buttons(root);
  const lockButton = () => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기');
  root.querySelector('.wallet-settings > button').click();
  [...root.querySelectorAll('button')].find(button => button.textContent === 'PIN 변경').click();
  const change = await wait(() => root.querySelector('form.wallet-editor'), 'change form'); await sleep(100);
  const changeFields = [...change.querySelectorAll('input')].map(describe);
  [...change.querySelectorAll('button')].find(button => button.textContent === '취소').click();
  await wait(() => lockButton(), 'wallet again');
  lockButton().click();
  const unlockForm = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form'); await sleep(100);
  const unlockField = describe(unlockForm.querySelector('input'));
  window.__result = JSON.stringify({ok: true, setupFields, changeFields, unlockField, emptyButtons, emptyHasFirst: Boolean(empty)});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// (2)(3) The attach area and its chooser, on its own.
const pickerFixture = head + `<script type="module">
${helpers}
try {
  const wallet = await import('/site-life-wallet.js?test=pin-attach-picker');
  const host = document.getElementById('host');
  let readyCalls = []; const errors = []; let opened = 0; let closed = 0;
  const picker = wallet.createWalletPhotoPicker({onError: message => { if (message) errors.push(message); }, onReady: value => readyCalls.push(value), onPickerOpen: () => { opened += 1; }, onPickerClose: () => { closed += 1; }});
  host.replaceChildren(picker.element);
  const zone = picker.element.querySelector('.wallet-attach-zone');
  const menu = picker.element.querySelector('.wallet-attach-menu');
  const option = source => menu.querySelector('[data-wallet-attach-source="' + source + '"]');
  const camera = countClicks(picker.cameraInput); const files = countClicks(picker.filesInput);
  const structure = {
    fileInputs: [...picker.element.querySelectorAll('input[type=file]')].map(input => ({accept: input.accept, capture: input.getAttribute('capture')})),
    visibleButtons: buttons(picker.element),
    labelText: picker.element.querySelector('.wallet-attach-label')?.textContent,
    helpText: picker.element.querySelector('.wallet-attach-help')?.textContent,
    menuHidden: menu.hidden,
  };
  zone.click();
  structure.menuOpen = !menu.hidden && zone.getAttribute('aria-expanded') === 'true';
  structure.options = [...menu.querySelectorAll('[role=menuitem]')].map(item => item.textContent);
  menu.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  structure.escapeCloses = menu.hidden;

  // 카메라: the camera input; a second tap while it opens does nothing.
  zone.click(); option('camera').click(); zone.click(); option('camera').click();
  const doubleTap = {camera: camera.count, files: files.count, opened};
  // A cancelled chooser frees the next tap at once.
  picker.cameraInput.dispatchEvent(new Event('cancel'));
  zone.click(); option('camera').click();
  const afterCancel = {camera: camera.count, closed};
  picker.cameraInput.dispatchEvent(new Event('cancel'));

  // 내 파일 with a document picker (no camera apps in it): its file goes the same way.
  const pickerCalls = [];
  window.showOpenFilePicker = async options => { pickerCalls.push(options); return [{getFile: async () => cardFile('document-picker-card.png')}]; };
  zone.click(); option('files').click();
  await wait(() => picker.element.querySelector('[data-scan-state="review"]'), 'document picker review');
  const documentPicker = {calls: pickerCalls.length, filesInputClicks: files.count, excludeAll: pickerCalls[0]?.excludeAcceptAllOption, accepts: Object.keys(pickerCalls[0]?.types?.[0]?.accept || {}), name: zone.textContent.includes('document-picker-card.png')};
  picker.element.querySelector('.wallet-scan-actions button').click();   // 취소: back to empty
  await sleep(50);
  // Cancelled in the document picker: nothing changes.
  window.showOpenFilePicker = async () => { throw new DOMException('cancelled', 'AbortError'); };
  zone.click(); option('files').click(); await sleep(50);
  const documentPickerAbort = {state: zone.dataset.state, filesInputClicks: files.count};
  // Without a document picker: the 내 파일 input (photos and PDFs).
  window.showOpenFilePicker = undefined;
  zone.click(); option('files').click();
  const inputFallback = {filesInputClicks: files.count};
  picker.filesInput.dispatchEvent(new Event('cancel'));

  // A rejected file on an empty attach area: error, nothing selected.
  feed(picker.filesInput, new File([new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0])], 'animation.gif', {type: 'image/gif'}));
  await wait(() => errors.length, 'gif rejected');
  const gif = {error: errors.at(-1), state: zone.dataset.state};

  // A photo: scanner, then confirmed.
  const first = await cardFile('first-card.png');
  feed(picker.filesInput, first);
  const inputEmptiedAfterChange = picker.filesInput.value === '';
  const scanner = await wait(() => picker.element.querySelector('[data-scan-state="review"]'), 'first review');
  const scanning = {state: zone.dataset.state, scannerButtons: buttons(scanner.querySelector('.wallet-scan-actions')), zoneButtons: buttons(picker.element.querySelector('.wallet-attach')), changeVisible: !zone.querySelector('.wallet-attach-change').hidden};
  scanner.querySelector('[data-wallet-scan-confirm]').click();
  await wait(() => zone.dataset.state === 'ready', 'first ready');
  const firstData = await picker.readDataUrl();
  const ready = {state: zone.dataset.state, preview: !zone.querySelector('.wallet-photo-preview').hidden, change: zone.querySelector('.wallet-attach-change').textContent, jpeg: firstData.startsWith('data:image/jpeg;base64,'), scanners: picker.element.querySelectorAll('.wallet-scan-editor').length};

  // Cancelled change: the confirmed photo stays.
  zone.click(); option('files').click(); picker.filesInput.dispatchEvent(new Event('cancel'));
  const keptOnCancel = zone.dataset.state === 'ready' && (await picker.readDataUrl()) === firstData;
  // Rejected change: error, the confirmed photo stays.
  feed(picker.filesInput, new File([new Uint8Array([1, 2, 3, 4])], 'notes.txt', {type: 'text/plain'}));
  await wait(() => errors.at(-1)?.includes('PDF만'), 'text rejected');
  const keptOnReject = zone.dataset.state === 'ready' && (await picker.readDataUrl()) === firstData;
  // Too large: a 31 MB photo, a 21 MB PDF.
  feed(picker.filesInput, new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]), new Uint8Array(31 * 1024 * 1024)], 'huge.jpg', {type: 'image/jpeg'}));
  await wait(() => errors.at(-1)?.includes('30MB'), 'large photo');
  feed(picker.filesInput, new File([new TextEncoder().encode('%PDF-1.4\\n'), new Uint8Array(21 * 1024 * 1024)], 'huge.pdf', {type: 'application/pdf'}));
  await wait(() => errors.at(-1)?.includes('20MB'), 'large pdf');
  const keptOnLarge = zone.dataset.state === 'ready' && (await picker.readDataUrl()) === firstData;

  // The same file again: a new choice (the input was emptied), a new scanner.
  readyCalls = [];
  feed(picker.filesInput, first);
  const again = await wait(() => picker.element.querySelector('[data-scan-state="review"]'), 'same file review');
  let blockedWhileScanning = false; try { await picker.readDataUrl(); } catch { blockedWhileScanning = true; }
  const sameFile = {readyFalse: readyCalls[0] === false, blockedWhileScanning, scanners: picker.element.querySelectorAll('.wallet-scan-editor').length};
  // Replaced while the scanner is open: the old scanner goes, the new file is checked.
  feed(picker.cameraInput, await cardFile('camera-shot.png', 1));
  await wait(() => zone.textContent.includes('camera-shot.png') && picker.element.querySelector('[data-scan-state="review"]'), 'replacement review');
  const replaced = {scanners: picker.element.querySelectorAll('.wallet-scan-editor').length, oldGone: !again.isConnected};
  picker.element.querySelector('[data-wallet-scan-confirm]').click();
  await wait(() => zone.dataset.state === 'ready', 'replacement ready');
  replaced.changed = (await picker.readDataUrl()) !== firstData;

  // A PDF from 내 파일.
  const pdfText = '%PDF-1.4\\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj\\ntrailer << /Root 1 0 R >>\\n%%EOF\\n';
  feed(picker.filesInput, new File([new TextEncoder().encode(pdfText)], 'statement.pdf', {type: 'application/pdf'}));
  const pdfEditor = await wait(() => { const editor = picker.element.querySelector('.wallet-scan-editor'); return editor && ['review', 'error'].includes(editor.dataset.scanState) ? editor : null; }, 'pdf outcome');
  const pdf = {pages: pdfEditor.dataset.scanPdfPages || null, state: pdfEditor.dataset.scanState, name: zone.textContent.includes('statement.pdf')};
  picker.element.querySelector('.wallet-scan-actions button').click();
  await sleep(50);

  // A long file name stays on one line inside the area.
  feed(picker.filesInput, await cardFile('아주_긴_파일_이름_' + '가'.repeat(80) + '.png'));
  await wait(() => picker.element.querySelector('[data-scan-state="review"]'), 'long name review');
  const title = zone.querySelector('.wallet-photo-copy strong');
  const longName = {zoneFits: zone.scrollWidth <= zone.clientWidth + 1, truncated: title.scrollWidth > title.clientWidth, pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth};
  picker.destroy();
  window.__result = JSON.stringify({ok: true, structure, doubleTap, afterCancel, documentPicker, documentPickerAbort, inputFallback, gif, inputEmptiedAfterChange, scanning, ready, keptOnCancel, keptOnReject, keptOnLarge, sameFile, replaced, pdf, longName, errors});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// (4) The whole add flow in a mounted wallet, with a camera trip that hides the page.
const flowFixture = head + `<script type="module">
${helpers}
try {
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => visibility});
  const setVisibility = value => { visibility = value; document.dispatchEvent(new Event('visibilitychange')); };
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=pin-attach-flow');
  const root = document.getElementById('host');
  mountLifeWallet({root, authenticated: true, accountId: 'pin-attach-flow-' + Date.now()});
  const click = text => { const button = [...root.querySelectorAll('button')].find(item => item.textContent === text && item.getClientRects().length); if (!button) throw new Error('no button ' + text + ' in ' + buttons(root).join('|')); button.click(); };
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  const [first, second] = setup.querySelectorAll('input'); first.value = '2580'; second.value = '2580'; setup.requestSubmit();
  await wait(() => root.querySelector('.wallet-empty'), 'empty wallet');

  // Background without a chooser: the screen is cleared (unchanged protection), and comes back.
  click('첫 자료 등록하기');
  await wait(() => root.querySelector('[data-wallet-view="add"]'), 'add form');
  setVisibility('hidden'); await sleep(400);
  const plainBackgroundCleared = root.childElementCount === 0;
  setVisibility('visible');
  await wait(() => root.querySelector('.wallet-empty'), 'wallet restored after background');

  // A camera trip: the add form stays while hidden; saving waits for the page to come back.
  click('첫 자료 등록하기');
  const form = await wait(() => root.querySelector('[data-wallet-view="add"]'), 'add form 2');
  const zone = form.querySelector('.wallet-attach-zone');
  const camera = countClicks(form.querySelectorAll('.wallet-attach input[type=file]')[0]);
  zone.click(); form.querySelector('[data-wallet-attach-source="camera"]').click();
  setVisibility('hidden'); await sleep(400);
  const duringTrip = {formKept: form.isConnected, cameraClicks: camera.count};
  // The camera returns its shot before the page is shown again.
  feed(form.querySelectorAll('.wallet-attach input[type=file]')[0], await cardFile('camera-trip.png'));
  const scanner = await wait(() => form.querySelector('[data-scan-state="review"]'), 'trip review');
  scanner.querySelector('[data-wallet-scan-confirm]').click();
  await wait(() => zone.dataset.state === 'ready', 'trip ready');
  const save = form.querySelector('button[type=submit]');
  duringTrip.saveEnabled = !save.disabled;
  save.click();
  const status = await wait(() => form.querySelector('.wallet-message')?.textContent, 'save refused while hidden');
  duringTrip.saveRefusedWhileHidden = status.includes('잠금');
  duringTrip.stillOnForm = form.isConnected;
  setVisibility('visible'); await sleep(200);
  const afterTrip = {formKept: form.isConnected, state: root.dataset.walletState};
  await wait(() => !save.disabled, 'save enabled again');
  save.click();
  await wait(() => root.textContent.includes('저장 자료 1개'), 'saved one item');
  const afterSave = {buttons: buttons(root)};

  // Lock, unlock with the keypad, the item decrypts; delete asks for the PIN in a masked field.
  click('잠그기');
  const unlock = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form');
  for (const digit of '2580') [...unlock.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === digit).click();
  [...unlock.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === '열기').click();
  const card = await wait(() => root.querySelector('.wallet-deck-card[data-depth="0"]'), 'deck');
  card.click();
  const image = await wait(() => root.querySelector('.wallet-detail-images img'), 'detail image');
  await image.decode();
  const decrypted = image.naturalWidth > 0 && image.src.startsWith('data:image/jpeg;base64,');
  click('자료 삭제');
  const removal = root.querySelector('form.wallet-delete-confirm');
  const removalPin = removal.querySelector('input');
  const removalField = {type: removalPin.type, mask: getComputedStyle(removalPin).webkitTextSecurity || '', autocomplete: removalPin.getAttribute('autocomplete')};
  removalPin.value = '0000'; removal.requestSubmit();
  const wrongPin = await wait(() => removal.querySelector('.wallet-message')?.textContent, 'wrong pin');
  removalPin.value = '2580'; removal.requestSubmit();
  await wait(() => root.querySelector('.wallet-empty'), 'deleted');

  // A camera trip that outlasts the session grant ends on the lock screen.
  click('첫 자료 등록하기');
  const form3 = await wait(() => root.querySelector('[data-wallet-view="add"]'), 'add form 3');
  countClicks(form3.querySelectorAll('.wallet-attach input[type=file]')[0]);
  form3.querySelector('.wallet-attach-zone').click(); form3.querySelector('[data-wallet-attach-source="camera"]').click();
  setVisibility('hidden'); await sleep(400);
  sessionStorage.clear();
  setVisibility('visible');
  const lockedAfterExpiry = Boolean(await wait(() => root.querySelector('.wallet-unlock-form'), 'locked after expired grant'));
  window.__result = JSON.stringify({ok: true, plainBackgroundCleared, duringTrip, afterTrip, afterSave, decrypted, removalField, wrongPin, lockedAfterExpiry});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const run = (fixtureHtml, viewport, name) => runFixturePage({root: ROOT, fixturePath: `/__life_wallet_pin_attach_${name}.html`, fixtureHtml, viewport, touch: true, timeoutMs: 600000, resultExpression: 'window.__result || ""'});

const pin = await run(pinFixture, {width: 390, height: 844, mobile: true}, 'pin');
assert.equal(pin.ok, true, pin.error);
{
  const detail = JSON.stringify(pin);
  for (const field of [...pin.setupFields, ...pin.changeFields, pin.unlockField]) {
    assert.equal(field.type, 'text', `a PIN field is never type=password (browsers offer to save it as a login): ${detail}`);
    assert.equal(field.mask, 'disc', `the PIN stays masked: ${detail}`);
    assert.equal(field.autocomplete, 'off', detail);
    assert.equal(field.ignore, true, `password-manager extensions are asked to skip it: ${detail}`);
    assert.equal(field.focused, false, `nothing is focused on its own on a phone: ${detail}`);
  }
  assert.deepEqual(pin.setupFields.map(field => field.inputMode), ['numeric', 'numeric'], detail);
  assert.deepEqual(pin.changeFields.map(field => field.inputMode), ['numeric', 'numeric', 'numeric'], detail);
  assert.equal(pin.unlockField.inputMode, 'none', `the keypad screen keeps the phone keyboard down: ${detail}`);
  assert.ok(pin.emptyButtons.includes('첫 자료 등록하기'), detail);
  assert.ok(!pin.emptyButtons.includes('+ 자료 추가'), `an empty wallet has one way to add: ${detail}`);
}

const picker = await run(pickerFixture, {width: 360, height: 800, mobile: true}, 'picker');
assert.equal(picker.ok, true, picker.error);
{
  const detail = JSON.stringify(picker);
  const {structure} = picker;
  assert.deepEqual(structure.fileInputs, [{accept: 'image/*', capture: 'environment'}, {accept: 'image/*,application/pdf', capture: null}], `카메라 is a still-photo capture, 내 파일 takes photos and PDFs: ${detail}`);
  assert.ok(structure.fileInputs.every(input => !/video|audio|\*\/\*/u.test(input.accept)), 'no video or audio capture path');
  assert.deepEqual(structure.visibleButtons, ['+ 카메라 또는 내 파일에서 선택'], `one attach area, no 사진 선택 / PDF / + buttons: ${detail}`);
  assert.equal(structure.labelText, '자료 첨부');
  assert.equal(structure.helpText, '사진 또는 PDF를 등록할 수 있어요.');
  assert.equal(structure.menuHidden, true);
  assert.equal(structure.menuOpen, true);
  assert.deepEqual(structure.options, ['카메라직접 촬영', '내 파일기기에 저장된 사진·PDF 선택'], `exactly two sources: ${detail}`);
  assert.equal(structure.escapeCloses, true);
  assert.deepEqual(picker.doubleTap, {camera: 1, files: 0, opened: 1}, `a second tap while the chooser opens opens nothing: ${detail}`);
  assert.equal(picker.afterCancel.camera, 2, `after a cancelled chooser the next tap opens it: ${detail}`);
  assert.deepEqual(picker.documentPicker, {calls: 1, filesInputClicks: 0, excludeAll: true, accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'], name: true}, `내 파일 uses the document picker where there is one: ${detail}`);
  assert.deepEqual(picker.documentPickerAbort, {state: 'empty', filesInputClicks: 0}, detail);
  assert.equal(picker.inputFallback.filesInputClicks, 1, `without a document picker 내 파일 opens its input: ${detail}`);
  assert.deepEqual(picker.gif, {error: '사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다.', state: 'empty'}, detail);
  assert.equal(picker.inputEmptiedAfterChange, true, 'the input is emptied so the same file can be chosen again');
  assert.equal(picker.scanning.state, 'scanning');
  assert.deepEqual(picker.scanning.scannerButtons, ['취소', '저장'], `the scanner has no second 다시 선택: ${detail}`);
  assert.equal(picker.scanning.changeVisible, true, detail);
  assert.deepEqual(picker.ready, {state: 'ready', preview: true, change: '파일 변경', jpeg: true, scanners: 0}, detail);
  assert.equal(picker.keptOnCancel, true, `a cancelled change keeps the photo: ${detail}`);
  assert.equal(picker.keptOnReject, true, `a rejected file keeps the photo: ${detail}`);
  assert.equal(picker.keptOnLarge, true, `too-large files are refused and keep the photo: ${detail}`);
  assert.ok(picker.errors.some(message => message.includes('30MB')) && picker.errors.some(message => message.includes('20MB')), detail);
  assert.deepEqual(picker.sameFile, {readyFalse: true, blockedWhileScanning: true, scanners: 1}, `the same file again is a new check: ${detail}`);
  assert.deepEqual(picker.replaced, {scanners: 1, oldGone: true, changed: true}, `a new file replaces the old scanner: ${detail}`);
  assert.equal(picker.pdf.name, true, detail);
  assert.ok(picker.pdf.pages === '1' || picker.pdf.state === 'error', `내 파일 opens PDFs: ${detail}`);
  assert.deepEqual(picker.longName, {zoneFits: true, truncated: true, pageFits: true}, `a long name is cut on one line: ${detail}`);
}

const flow = await run(flowFixture, {width: 412, height: 900, mobile: true}, 'flow');
assert.equal(flow.ok, true, flow.error);
{
  const detail = JSON.stringify(flow);
  assert.equal(flow.plainBackgroundCleared, true, `going to the background without a chooser still clears the wallet screen: ${detail}`);
  assert.deepEqual(flow.duringTrip, {formKept: true, cameraClicks: 1, saveEnabled: true, saveRefusedWhileHidden: true, stillOnForm: true}, `the add form survives a camera trip, the key does not: ${detail}`);
  assert.deepEqual(flow.afterTrip, {formKept: true, state: 'unlocked'}, detail);
  assert.ok(flow.afterSave.buttons.includes('+ 추가') && !flow.afterSave.buttons.includes('첫 자료 등록하기'), `with an item, the mobile +추가 action is the way to add: ${detail}`);
  assert.equal(flow.decrypted, true, `the saved item decrypts after locking and unlocking: ${detail}`);
  assert.deepEqual(flow.removalField, {type: 'text', mask: 'disc', autocomplete: 'off'}, detail);
  assert.equal(flow.wrongPin, '월렛 PIN을 확인해 주세요.', detail);
  assert.equal(flow.lockedAfterExpiry, true, `without a valid grant the wallet locks after the trip: ${detail}`);
}

console.log('LIFE_WALLET_PIN_ATTACHMENT_UX_P0 PASS — PIN fields masked text (setup/change/unlock/delete), one add button per state, one attach area with 카메라/내 파일, document picker or one input, double tap/cancel/same file/replace/reject/size limits, PDF, long name, camera trip keeps the form while the key leaves memory, saved item decrypts');
