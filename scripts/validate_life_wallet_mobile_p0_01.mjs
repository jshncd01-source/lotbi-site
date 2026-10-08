// LIFE-WALLET-MOBILE-P0-01
// Phone feedback on Life Wallet: (1) the photo picker never offers a camcorder (one image
// type per picker; PDFs have their own), (2) a camera shot takes the same path as a gallery
// file (EXIF orientation, large photos, header without a size, WebP; HEIC explained where the
// browser cannot open it) and is recognised even when the card is small in the frame,
// (3) the wallet strip shows exactly one whole item at phone widths, and (4) the PIN keypad
// does not raise the phone keyboard. All images are synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:720px;margin:auto}</style></head><body><main id="host"></main>';
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
`;

// Picker, camera shots, formats.
const pickerFixture = head + `<script type="module">
${helpers}
try {
  const wallet = await import('/site-life-wallet.js?test=mobile-p0');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=mobile-p0');
  // A portrait camera shot of an upright card; cardWidth is the card's share of the frame width.
  const portraitScene = async (cardWidth, seed) => {
    const W = 1500, H = 2000; const cardHeight = W * cardWidth / 1.586; const top = (H - cardHeight) / 2 / H;
    const card = scenes.walletCard({width: W, height: H, margins: {left: (1 - cardWidth) / 2, right: (1 - cardWidth) / 2, top, bottom: top}, rotation: 2, keystone: .03, glyphDensity: 1.4});
    return scenes.renderScene({width: W, height: H, seed, surfaceKind: 'felt', cards: [card]});
  };
  // How a phone stores it: landscape pixels (4000x3000) plus EXIF orientation 6, and (like
  // Samsung's maker blocks) about 250 KB of extra header before the image size marker.
  const cameraJpeg = async scene => {
    const stored = new OffscreenCanvas(4000, 3000); const context = stored.getContext('2d');
    context.translate(0, 3000); context.rotate(-Math.PI / 2); context.drawImage(scene, 0, 0, 3000, 4000);
    const jpeg = new Uint8Array(await (await stored.convertToBlob({type: 'image/jpeg', quality: .9})).arrayBuffer());
    const exif = [0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0x00,0x00,0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
    const filler = []; for (let block = 0; block < 4; block += 1) { const length = 65000; filler.push(0xFF, 0xE2, length >> 8, length & 255); for (let i = 0; i < length - 2; i += 1) filler.push(0); }
    const bytes = new Uint8Array(2 + exif.length + filler.length + jpeg.length - 2);
    bytes.set([0xFF, 0xD8], 0); bytes.set(exif, 2); bytes.set(filler, 2 + exif.length); bytes.set(jpeg.subarray(2), 2 + exif.length + filler.length);
    return new File([bytes], 'camera-20261007.jpg', {type: 'image/jpeg'});
  };
  const open = async (picker, input, file) => {
    const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
    const editor = await wait(() => { const e = picker.element.querySelector('.wallet-scan-editor'); return e && ['review', 'error'].includes(e.dataset.scanState) ? e : null; }, 'scanner outcome ' + file.name);
    const preview = editor.querySelector('.wallet-scan-result-image'); if (editor.dataset.scanState === 'review' && !preview.hidden) await preview.decode();
    return {state: editor.dataset.scanState, mode: editor.dataset.scanMode, reason: editor.dataset.scanReason, source: editor.dataset.scanSourceWidth + 'x' + editor.dataset.scanSourceHeight,
      result: preview && !preview.hidden ? [preview.naturalWidth, preview.naturalHeight] : null, saveEnabled: !editor.querySelector('[data-wallet-scan-confirm]').disabled,
      status: editor.querySelector('.wallet-scan-status').textContent, pdfPages: editor.dataset.scanPdfPages || null, diagnostics: editor.dataset.scanDiagnostics || ''};
  };
  const host = document.getElementById('host');
  const fresh = () => { const picker = wallet.createWalletPhotoPicker({}); host.replaceChildren(picker.element); return picker; };
  let picker = fresh();
  const inputs = [...picker.element.querySelectorAll('input[type=file]')].map(input => ({accept: input.accept, capture: input.getAttribute('capture')}));
  const near = await open(picker, picker.input, await cameraJpeg(await portraitScene(.62, 51)));
  picker = fresh(); const far = await open(picker, picker.input, await cameraJpeg(await portraitScene(.34, 52)));
  picker = fresh(); const webp = await open(picker, picker.input, new File([await (await portraitScene(.6, 53)).convertToBlob({type: 'image/webp', quality: .92})], 'shot.webp', {type: 'image/webp'}));
  picker = fresh(); const heic = await open(picker, picker.input, new File([new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0])], 'IMG_0001.HEIC', {type: 'image/heic'}));
  const pdfText = '%PDF-1.4\\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj\\ntrailer << /Root 1 0 R >>\\n%%EOF\\n';
  picker = fresh(); const pdf = await open(picker, picker.pdfInput, new File([new TextEncoder().encode(pdfText)], 'blank.pdf', {type: 'application/pdf'}));
  window.__result = JSON.stringify({ok: true, inputs, near, far, webp, heic, pdf});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// One whole item at a time at phone widths.
const carouselFixture = head + `<script type="module">
${helpers}
try {
  const {createWalletCardCarousel} = await import('/site-life-wallet.js?test=mobile-p0-carousel');
  const shaped = (width, height) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.fillStyle = '#123'; context.fillRect(width * .1, height * .1, width * .8, height * .8); return canvas.toDataURL('image/png'); };
  const carousel = createWalletCardCarousel({cards: [{id: 'a', name: 'a', kind: 'document', frontDataUrl: shaped(1618, 1044)}, {id: 'b', name: 'b', kind: 'document', frontDataUrl: shaped(1015, 643)}, {id: 'c', name: 'c', kind: 'document', frontDataUrl: shaped(1467, 2048)}], onOpen: () => {}});
  document.getElementById('host').append(carousel);
  await Promise.all([...carousel.querySelectorAll('img')].map(image => image.decode().catch(() => {}))); await sleep(200);
  const viewport = carousel.querySelector('.wallet-card-viewport'); const dots = [...carousel.querySelectorAll('[data-wallet-carousel-dot]')];
  const views = [];
  for (let index = 0; index < dots.length; index += 1) {
    dots[index].click(); await sleep(600);
    const frame = viewport.getBoundingClientRect();
    const slides = [...carousel.querySelectorAll('.wallet-card-slide')];
    const visible = slides.filter(slide => { const r = slide.getBoundingClientRect(); return r.right > frame.left + 1 && r.left < frame.right - 1; });
    const card = carousel.querySelectorAll('.wallet-card')[index]; const image = card.querySelector('img');
    const c = card.getBoundingClientRect(); const i = image.getBoundingClientRect(); const s = slides[index].getBoundingClientRect();
    views.push({index, visibleSlides: visible.length, slideWidth: s.width, viewportWidth: frame.width, cardInside: c.left >= frame.left - .5 && c.right <= frame.right + .5 && c.top >= frame.top - .5 && c.bottom <= frame.bottom + .5,
      imageInside: i.left >= c.left - .5 && i.right <= c.right + .5 && i.top >= c.top - .5 && i.bottom <= c.bottom + .5, imageAspect: i.width / i.height, naturalAspect: image.naturalWidth / image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit, flexShrink: getComputedStyle(slides[index]).flexShrink});
  }
  window.__result = JSON.stringify({ok: true, width: innerWidth, views});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// The PIN keypad on a touch screen: no phone keyboard, keypad unlocks.
const pinFixture = head + `<script type="module">
${helpers}
try {
  const nativeMatch = window.matchMedia.bind(window);
  window.matchMedia = query => /pointer:\\s*coarse/.test(query) ? {matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}} : nativeMatch(query);
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=mobile-p0-pin');
  const root = document.getElementById('host');
  mountLifeWallet({root, authenticated: true, accountId: 'mobile-p0-' + Date.now()});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  const [first, second] = setup.querySelectorAll('input'); first.value = '1357'; second.value = '1357'; setup.requestSubmit();
  const lock = await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked wallet');
  lock.click();
  const form = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form');
  const pin = form.querySelector('input'); await sleep(100);
  const unlock = {inputMode: pin.inputMode, type: pin.type, ariaLabel: pin.getAttribute('aria-label'), focused: document.activeElement === pin, keypadButtons: form.querySelectorAll('.wallet-keypad button').length};
  for (const digit of ['1', '3', '5', '7']) [...form.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === digit).click();
  unlock.typed = pin.value.length;
  [...form.querySelectorAll('.wallet-keypad button')].find(button => button.textContent === '확인').click();
  unlock.reopened = Boolean(await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked by keypad'));
  window.__result = JSON.stringify({ok: true, unlock});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const run = (fixtureHtml, viewport, name) => runFixturePage({root: ROOT, fixturePath: `/__life_wallet_mobile_p0_${name}.html`, fixtureHtml, viewport, timeoutMs: 600000, resultExpression: 'window.__result || ""'});

const picker = await run(pickerFixture, {width: 412, height: 900, mobile: true}, 'picker');
assert.equal(picker.ok, true, picker.error);
{
  const detail = JSON.stringify(picker);
  assert.deepEqual(picker.inputs.map(input => input.accept), ['image/*', 'application/pdf'], `one type per picker so Android offers no camcorder: ${detail}`);
  assert.ok(picker.inputs.every(input => !/video|audio|\*\/\*/u.test(input.accept)), 'no video or audio capture path');
  for (const [name, shot] of [['near camera shot', picker.near], ['far camera shot', picker.far]]) {
    assert.equal(shot.state, 'review', `${name}: ${detail}`);
    assert.equal(shot.source, '1920x2560', `${name} must be decoded upright (EXIF 6) and bounded to 2560 px even without a size in the first header bytes: ${detail}`);
    assert.equal(shot.mode, 'automatic', `${name} must be recognised like a gallery photo: ${detail}`);
    assert.ok(shot.result[0] > shot.result[1], `${name}: the card comes out landscape: ${detail}`);
    assert.equal(shot.saveEnabled, true, `${name}: save enabled`);
  }
  assert.equal(picker.webp.mode, 'automatic', `a WebP photo takes the same path: ${detail}`);
  assert.equal(picker.heic.state, 'error', `an HEIC the browser cannot open stops with an explanation: ${detail}`);
  assert.ok(picker.heic.status.includes('HEIC'), `HEIC message: ${picker.heic.status}`);
  assert.ok(picker.pdf.pdfPages === '1' || picker.pdf.state === 'error', `the PDF picker opens PDFs: ${detail}`);
}
const widths = [];
for (const width of [360, 390, 412]) {
  const carousel = await run(carouselFixture, {width, height: 800, mobile: true}, 'carousel');
  assert.equal(carousel.ok, true, carousel.error);
  for (const view of carousel.views) {
    const detail = `${width}px #${view.index + 1}: ${JSON.stringify(view)}`;
    assert.equal(view.visibleSlides, 1, `exactly one item on screen, no neighbour peeking: ${detail}`);
    assert.ok(Math.abs(view.slideWidth - view.viewportWidth) <= 1, `a slide is as wide as the visible strip: ${detail}`);
    assert.equal(view.flexShrink, '0', `slides never shrink: ${detail}`);
    assert.equal(view.cardInside, true, `the whole item is visible, nothing cut: ${detail}`);
    assert.equal(view.imageInside, true, `the photo stays inside its card: ${detail}`);
    assert.equal(view.objectFit, 'contain', `object-fit contain: ${detail}`);
    assert.ok(Math.abs(view.imageAspect - view.naturalAspect) < .03, `the document is not cropped: ${detail}`);
  }
  widths.push(width);
}
const pin = await run(pinFixture, {width: 390, height: 844, mobile: true}, 'pin');
assert.equal(pin.ok, true, pin.error);
assert.equal(pin.unlock.inputMode, 'none', `the PIN keypad screen must not raise the phone keyboard: ${JSON.stringify(pin.unlock)}`);
assert.equal(pin.unlock.focused, false, 'no automatic focus on a touch screen');
assert.equal(pin.unlock.type, 'password');
assert.equal(pin.unlock.ariaLabel, '월렛 PIN', 'the field stays labelled for screen readers and hardware keyboards');
assert.equal(pin.unlock.typed, 4, 'keypad digits fill the PIN');
assert.equal(pin.unlock.reopened, true, 'the keypad unlocks the wallet');
console.log(`LIFE_WALLET_MOBILE_P0_01 PASS — camera near/far automatic (decoded ${picker.near.source}), webp automatic, heic explained, carousel one slide at ${widths.join('/')}px, pin inputmode=none`);
