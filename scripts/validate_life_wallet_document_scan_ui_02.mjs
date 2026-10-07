// LIFE-WALLET-DOCUMENT-SCAN-UI-02
// The scanner UI on a privacy-free synthetic photo that reproduces the reported
// failure conditions (textured green surface, uneven light, card close to the
// top/bottom edges, wider left margin, rounded corners, perspective, dense
// internal edges). The default flow must crop automatically: no manual corner
// step, background and margins removed, the whole card kept, save enabled.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:680px;margin:auto}</style></head><body><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const nativeBitmap = globalThis.createImageBitmap;
async function scanScene(module, scenes, scene) {
  // The scene generator decodes its own JPEG round-trip, so only the scanner sees the stub.
  globalThis.createImageBitmap = nativeBitmap;
  const canvas = await scenes.renderScene(scene);
  const blob = await canvas.convertToBlob({type: 'image/jpeg', quality: .9});
  globalThis.createImageBitmap = async () => canvas;
  const saved = {value: ''};
  const scanner = module.createWalletDocumentScanner({file: new File([blob], 'synthetic-wallet.jpg', {type: 'image/jpeg'}), onConfirm: value => { saved.value = value; }});
  document.getElementById('host').replaceChildren(scanner.element);
  await wait(() => scanner.element.dataset.scanState === 'review', 'review state');
  return {scanner, saved};
}
function visible(element) { return Boolean(element) && element.getClientRects().length > 0; }
try {
  const module = await import('/site-life-wallet-scan-ui.js?test=ui-02');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=ui-02');
  const W = 1266, H = 680;
  const card = scenes.walletCard({width: W, height: H, margins: {left: .13, right: .06, top: .03, bottom: .025}, rotation: 1.2, keystone: .03, glyphDensity: 1.6});
  const {scanner, saved} = await scanScene(module, scenes, {width: W, height: H, seed: 31, surfaceKind: 'felt', cards: [card]});
  const element = scanner.element;
  const preview = element.querySelector('.wallet-scan-result-image');
  const confirm = element.querySelector('[data-wallet-scan-confirm]');
  const decoded = new Image(); decoded.src = preview.src; await decoded.decode();
  const pixels = document.createElement('canvas'); pixels.width = decoded.naturalWidth; pixels.height = decoded.naturalHeight;
  const context = pixels.getContext('2d', {willReadFrequently: true}); context.drawImage(decoded, 0, 0);
  const data = context.getImageData(0, 0, pixels.width, pixels.height).data;
  const at = (u, v) => { const x = Math.round(u * (pixels.width - 1)); const y = Math.round(v * (pixels.height - 1)); const offset = (y * pixels.width + x) * 4; return [data[offset], data[offset + 1], data[offset + 2]]; };
  const surfaceLike = ([red, green, blue]) => green - Math.max(red, blue) > 20;
  const edgeSamples = [];
  for (let step = 1; step < 20; step += 1) { const t = .08 + .84 * step / 20; edgeSamples.push(at(t, .012), at(t, .988), at(.008, t), at(.992, t)); }
  const corners = [at(.06, .09), at(.94, .09), at(.94, .91), at(.06, .91)];
  const extremeCorners = [at(.004, .006), at(.996, .006), at(.996, .994), at(.004, .994)];
  const luminance = ([red, green, blue]) => red * .299 + green * .587 + blue * .114;
  const ordered = [card.corners[0], card.corners[1], card.corners[2], card.corners[3]];
  const side = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const expectedAspect = ((side(ordered[0], ordered[1]) + side(ordered[3], ordered[2])) / 2) / ((side(ordered[0], ordered[3]) + side(ordered[1], ordered[2])) / 2);
  const automatic = {
    state: element.dataset.scanState, mode: element.dataset.scanMode, reason: element.dataset.scanReason, diagnostics: JSON.parse(element.dataset.scanDiagnostics || '{}'),
    status: element.querySelector('.wallet-scan-status').textContent, text: element.textContent,
    confirmEnabled: !confirm.disabled, sourceVisible: visible(element.querySelector('.wallet-scan-source-pane')), handlesVisible: [...element.querySelectorAll('.wallet-scan-handle')].some(visible),
    previewVisible: visible(preview), aspect: pixels.width / pixels.height, expectedAspect,
    edgeSurfaceRatio: edgeSamples.filter(surfaceLike).length / edgeSamples.length, cornerSurface: corners.map(surfaceLike), roundedCornerSurface: extremeCorners.map(surfaceLike),
    marginLuminance: luminance(at(.03, .5)), photoLuminance: luminance(at(.18, .55)),
    width: element.getBoundingClientRect().width, viewport: document.documentElement.clientWidth,
  };
  confirm.click(); await wait(() => saved.value, 'confirm callback'); automatic.confirmed = saved.value.startsWith('data:image/jpeg;base64,'); scanner.destroy();
  const {scanner: twoCards} = await scanScene(module, scenes, {width: W, height: H, seed: 24, surfaceKind: 'felt', cards: [scenes.walletCard({width: W, height: H, margins: {left: .04, right: .53, top: .2, bottom: .22}, rotation: 2}), scenes.walletCard({width: W, height: H, margins: {left: .53, right: .04, top: .22, bottom: .2}, rotation: -2})]});
  const ambiguous = {mode: twoCards.element.dataset.scanMode, reason: twoCards.element.dataset.scanReason, diagnostics: twoCards.element.dataset.scanDiagnostics, confirmEnabled: !twoCards.element.querySelector('[data-wallet-scan-confirm]').disabled, status: twoCards.element.querySelector('.wallet-scan-status').textContent};
  twoCards.destroy();
  // A portrait page must be shown at its own aspect: no letterbox bars beside it on wide screens.
  globalThis.createImageBitmap = nativeBitmap;
  const page = await scenes.renderPageScene(1);
  const pageBlob = await page.canvas.convertToBlob({type: 'image/jpeg', quality: .9});
  globalThis.createImageBitmap = async () => page.canvas;
  const wide = document.createElement('div'); wide.style.width = '760px'; document.body.append(wide);
  const pageScanner = module.createWalletDocumentScanner({file: new File([pageBlob], 'synthetic-page.jpg', {type: 'image/jpeg'})});
  wide.append(pageScanner.element);
  await wait(() => pageScanner.element.dataset.scanState === 'review', 'page review state');
  const pagePreview = pageScanner.element.querySelector('.wallet-scan-result-image'); await pagePreview.decode();
  const pageBox = pagePreview.getBoundingClientRect();
  const pageView = {mode: pageScanner.element.dataset.scanMode, boxAspect: pageBox.width / pageBox.height, imageAspect: pagePreview.naturalWidth / pagePreview.naturalHeight, boxWidth: pageBox.width, boxHeight: pageBox.height, warnings: pageScanner.element.querySelector('.wallet-scan-warnings').textContent};
  pageScanner.destroy(); wide.remove(); globalThis.createImageBitmap = nativeBitmap;
  // A dim photo of a sheet on a dark desk reads like a scan: white paper, dark print, no
  // retake warning for a page that fills the frame, and the desk left out.
  const desk = await scenes.renderPageScene(8, {photo: true, dim: true, band: true});
  const deskBlob = await desk.canvas.convertToBlob({type: 'image/jpeg', quality: .9});
  globalThis.createImageBitmap = async () => desk.canvas;
  const deskScanner = module.createWalletDocumentScanner({file: new File([deskBlob], 'synthetic-desk-page.jpg', {type: 'image/jpeg'})});
  document.getElementById('host').replaceChildren(deskScanner.element);
  await wait(() => deskScanner.element.dataset.scanState === 'review', 'desk page review state');
  const deskPreview = deskScanner.element.querySelector('.wallet-scan-result-image'); await deskPreview.decode();
  const tones = (image, from, to) => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext('2d', {willReadFrequently: true}); context.drawImage(image, 0, 0); const data = context.getImageData(0, Math.round(canvas.height * from), canvas.width, Math.max(1, Math.round(canvas.height * (to - from)))).data; const values = []; for (let offset = 0; offset < data.length; offset += 16) values.push(data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114); values.sort((left, right) => left - right); return quantile => values[Math.floor(values.length * quantile)]; };
  const deskTones = tones(deskPreview, 0, 1); const deskBottom = tones(deskPreview, .97, 1);
  const deskView = {mode: deskScanner.element.dataset.scanMode, paper: deskTones(.8), ink: deskTones(.02), bottomRow: deskBottom(.5), warnings: deskScanner.element.querySelector('.wallet-scan-warnings').textContent};
  deskScanner.destroy(); globalThis.createImageBitmap = nativeBitmap;
  // Only printed items are saved. A pet photo is refused outright; on an uncertain photo with
  // print, a hand-placed crop is saved only while it frames the print.
  const pet = await scenes.renderPetPhotoScene(1);
  globalThis.createImageBitmap = async () => pet.canvas;
  const petScanner = module.createWalletDocumentScanner({file: new File([await pet.canvas.convertToBlob({type: 'image/jpeg'})], 'synthetic-pet.jpg', {type: 'image/jpeg'})});
  document.getElementById('host').replaceChildren(petScanner.element);
  await wait(() => petScanner.element.dataset.scanState === 'review', 'pet review state');
  const petView = {mode: petScanner.element.dataset.scanMode, reason: petScanner.element.dataset.scanReason, confirmEnabled: !petScanner.element.querySelector('[data-wallet-scan-confirm]').disabled, adjustHidden: petScanner.element.querySelector('[data-wallet-scan-adjust]').getClientRects().length === 0, heading: petScanner.element.querySelector('h3').textContent, warnings: petScanner.element.querySelector('.wallet-scan-warnings').textContent};
  petScanner.destroy();
  const note = new OffscreenCanvas(900, 700); const noteContext = note.getContext('2d');
  noteContext.fillStyle = '#cfcfcf'; noteContext.fillRect(0, 0, 900, 700); noteContext.fillStyle = '#2a2a2a';
  for (let row = 0; row < 4; row += 1) for (let glyph = 0; glyph < 16; glyph += 1) noteContext.fillRect(600 + glyph * 16, 560 + row * 26, 10, 12);
  globalThis.createImageBitmap = async () => note;
  const noteScanner = module.createWalletDocumentScanner({file: new File([await note.convertToBlob({type: 'image/png'})], 'synthetic-note.png', {type: 'image/png'})});
  document.getElementById('host').replaceChildren(noteScanner.element);
  await wait(() => noteScanner.element.dataset.scanState === 'review', 'uncertain print review state');
  const noteConfirm = noteScanner.element.querySelector('[data-wallet-scan-confirm]');
  const press = async (corner, key, times) => { const handle = noteScanner.element.querySelector('.wallet-scan-handle[data-corner="' + corner + '"]'); for (let step = 0; step < times; step += 1) handle.dispatchEvent(new KeyboardEvent('keydown', {key, shiftKey: true, bubbles: true})); await sleep(400); await wait(() => noteScanner.element.dataset.scanState === 'review', 'review after adjusting'); };
  const manualView = {mode: noteScanner.element.dataset.scanMode, initialConfirm: !noteConfirm.disabled, initialHeading: noteScanner.element.querySelector('h3').textContent, initialStatus: noteScanner.element.querySelector('.wallet-scan-status').textContent, initialWarnings: noteScanner.element.querySelector('.wallet-scan-warnings').textContent};
  await press('topLeft', 'ArrowRight', 1); manualView.framingConfirm = !noteConfirm.disabled;
  await press('bottomRight', 'ArrowUp', 30); await press('bottomRight', 'ArrowLeft', 30);
  manualView.blankConfirm = !noteConfirm.disabled; manualView.blankStatus = noteScanner.element.querySelector('.wallet-scan-status').textContent;
  noteScanner.destroy(); globalThis.createImageBitmap = nativeBitmap;
  // A card photographed on its side comes out upright (landscape, photo on the left), and the
  // 회전 button turns the result a quarter.
  const sideCanvas = await scenes.renderScene({width: 900, height: 1400, seed: 41, surfaceKind: 'felt', cards: [scenes.walletCard({width: 900, height: 1400, margins: {left: -0.044, right: -0.044, top: 0.279, bottom: 0.279}, rotation: 90, glyphDensity: 1.4})]});
  globalThis.createImageBitmap = async () => sideCanvas;
  const sideScanner = module.createWalletDocumentScanner({file: new File([await sideCanvas.convertToBlob({type: 'image/jpeg'})], 'synthetic-sideways.jpg', {type: 'image/jpeg'})});
  document.getElementById('host').replaceChildren(sideScanner.element);
  await wait(() => sideScanner.element.dataset.scanState === 'review', 'sideways review state');
  const sidePreview = sideScanner.element.querySelector('.wallet-scan-result-image'); await sidePreview.decode();
  const sideTones = (() => { const c = document.createElement('canvas'); c.width = sidePreview.naturalWidth; c.height = sidePreview.naturalHeight; const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(sidePreview, 0, 0); const band = (from, to) => { const d = x.getImageData(Math.round(c.width * from), Math.round(c.height * .3), Math.max(1, Math.round(c.width * (to - from))), Math.round(c.height * .4)).data; let sum = 0; for (let o = 0; o < d.length; o += 4) sum += d[o] * .299 + d[o + 1] * .587 + d[o + 2] * .114; return sum / (d.length / 4); }; return {photoSide: band(.08, .28), textSide: band(.7, .9)}; })();
  const sideView = {mode: sideScanner.element.dataset.scanMode, rotation: sideScanner.element.dataset.scanRotation, width: sidePreview.naturalWidth, height: sidePreview.naturalHeight, ...sideTones};
  sideScanner.element.querySelector('[data-wallet-scan-rotate]').click();
  await wait(() => sideScanner.element.dataset.scanRotation !== sideView.rotation && sideScanner.element.dataset.scanState === 'review', 'rotated review');
  await sleep(300); await sidePreview.decode();
  sideView.turnedRotation = sideScanner.element.dataset.scanRotation; sideView.turnedPortrait = sidePreview.naturalHeight > sidePreview.naturalWidth;
  sideScanner.destroy(); globalThis.createImageBitmap = nativeBitmap;
  // A phone photo stored as 9000x6000 pixels with EXIF orientation 6 is a 6000x9000 portrait;
  // the bounded decode size must follow the rotated frame or the page is squashed.
  let rotatedOptions = null; globalThis.createImageBitmap = (input, options) => { rotatedOptions = options; return Promise.reject(new Error('decode stub')); };
  const rotatedHeader = new Uint8Array([0xFF,0xD8,0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0x00,0x00,0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xC0,0x00,0x11,0x08,0x17,0x70,0x23,0x28,0x03,0x01,0x22,0x00,0x02,0x11,0x01,0x03,0x11,0x01,0xFF,0xD9]);
  const rotatedScanner = module.createWalletDocumentScanner({file: new File([rotatedHeader], 'rotated.jpg', {type: 'image/jpeg'})});
  await wait(() => rotatedOptions, 'rotated decode options'); rotatedScanner.destroy();
  globalThis.createImageBitmap = nativeBitmap;
  window.__result = {ok: true, automatic, ambiguous, rotatedOptions, pageView, deskView, petView, manualView, sideView};
} catch (error) { window.__result = {ok: false, error: String(error?.stack || error)}; }
</script></body></html>`;

const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_scan_ui_02.html', fixtureHtml: fixture, timeoutMs: 600000,
  viewport: {width: 390, height: 844, mobile: true},
  resultExpression: 'window.__result ? JSON.stringify(window.__result) : ""',
});
assert.equal(result.ok, true, result.error);
{
  const {automatic, ambiguous, rotatedOptions, pageView, deskView, petView, manualView, sideView} = result;
  assert.equal(rotatedOptions.imageOrientation, 'from-image');
  assert.deepEqual([rotatedOptions.resizeWidth, rotatedOptions.resizeHeight], [1707, 2560], `EXIF-rotated photo must be bounded in its rotated frame: ${JSON.stringify(rotatedOptions)}`);
  const detail = JSON.stringify({...automatic, text: undefined});
  assert.equal(automatic.state, 'review');
  assert.equal(automatic.mode, 'automatic', `real-condition card photo fell back to manual: ${detail}`);
  assert.equal(automatic.reason, 'document-quadrilateral');
  assert.equal(automatic.diagnostics.source, 'border-surface', `unexpected detection source: ${detail}`);
  assert.equal(automatic.status, '', `an automatic crop needs no explanation: ${automatic.status}`);
  assert.ok(!automatic.text.includes('테두리를 찾지 못했습니다'), 'manual-fallback copy must not appear for a detectable card');
  // One scanner for cards, contracts and PDFs: the heading names no document type.
  for (const narration of ['자동으로 정리', '보정된 자료', '이 브라우저에서만', '배경과 여백', '신분증을 자동으로']) assert.ok(!automatic.text.includes(narration), `the scanner must not narrate its own processing: ${narration}`);
  assert.equal(automatic.confirmEnabled, true, 'save must be enabled after an automatic crop');
  assert.equal(automatic.sourceVisible, false, 'manual corner editor must stay hidden in the default flow');
  assert.equal(automatic.handlesVisible, false, 'corner handles must stay hidden in the default flow');
  assert.equal(automatic.previewVisible, true);
  assert.ok(Math.abs(automatic.aspect - automatic.expectedAspect) < .04, `corrected card aspect ${automatic.aspect.toFixed(3)} differs from the card ${automatic.expectedAspect.toFixed(3)}`);
  assert.ok(automatic.edgeSurfaceRatio <= .05, `background strip remains along the corrected edges: ${automatic.edgeSurfaceRatio}`);
  assert.deepEqual(automatic.cornerSurface, [false, false, false, false], 'background remains inside the corrected corners');
  assert.deepEqual(automatic.roundedCornerSurface, [false, false, false, false], 'surface wedges outside the rounded card corners must not remain in the corrected card');
  assert.ok(automatic.diagnostics.cornerRadius >= .03 && automatic.diagnostics.cornerRadius <= .09, `rounded-corner estimate ${automatic.diagnostics.cornerRadius} is not card-like (ID-1 ~0.059)`);
  assert.ok(automatic.marginLuminance - automatic.photoLuminance > 25, `card margin left of the photo area was clipped: margin=${automatic.marginLuminance.toFixed(0)} photo=${automatic.photoLuminance.toFixed(0)}`);
  assert.equal(automatic.confirmed, true, 'save must hand the corrected JPEG to the wallet');
  assert.ok(automatic.width <= automatic.viewport, `scanner overflowed the mobile viewport: ${automatic.width}/${automatic.viewport}`);
  assert.equal(ambiguous.mode, 'manual', `two competing cards must not be cropped silently: ${JSON.stringify(ambiguous)}`);
  assert.equal(pageView.mode, 'automatic', `synthetic page fell back to manual: ${JSON.stringify(pageView)}`);
  assert.equal(pageView.warnings, '', `a clean white scan must not be flagged for glare or edges after whitening: ${JSON.stringify(pageView)}`);
  assert.ok(Math.abs(pageView.boxAspect - pageView.imageAspect) < .03, `portrait page preview is letterboxed: ${JSON.stringify(pageView)}`);
  assert.equal(deskView.mode, 'automatic', `dim desk page fell back to manual: ${JSON.stringify(deskView)}`);
  assert.ok(deskView.paper >= 225, `dim page paper must read white after correction: ${JSON.stringify(deskView)}`);
  assert.ok(deskView.ink <= 110, `print must stay dark after paper correction: ${JSON.stringify(deskView)}`);
  assert.ok(deskView.bottomRow >= 150, `the dark desk below the sheet must not remain in the page: ${JSON.stringify(deskView)}`);
  assert.equal(deskView.warnings, '', `a page filling the frame must not ask for a retake: ${JSON.stringify(deskView)}`);
  assert.equal(petView.mode, 'manual', `a pet photo must not be cropped: ${JSON.stringify(petView)}`);
  assert.equal(petView.reason, 'not-a-document', `a pet photo must be refused: ${JSON.stringify(petView)}`);
  assert.equal(petView.confirmEnabled, false, 'a pet photo must never be savable');
  assert.equal(petView.adjustHidden, true, 'no manual adjustment for a pet photo');
  assert.equal(petView.heading, '등록할 수 없는 사진입니다', `refused photo heading: ${JSON.stringify(petView)}`);
  assert.equal(petView.warnings, '', 'no photo-quality advice for a refused photo');
  assert.equal(manualView.mode, 'manual', `the uncertain print scene must need manual corners: ${JSON.stringify(manualView)}`);
  assert.equal(manualView.initialConfirm, false, 'save stays off until corners are placed');
  assert.equal(manualView.initialHeading, '자료를 찾지 못했습니다', `not-found heading: ${JSON.stringify(manualView)}`);
  assert.ok(manualView.initialStatus.includes('신분증이나 문서를 찾지 못했습니다'), `not-found guidance: ${manualView.initialStatus}`);
  assert.equal(manualView.initialWarnings, '', 'no photo-quality advice before an item is found');
  assert.equal(manualView.framingConfirm, true, `corners framing the print must allow saving: ${JSON.stringify(manualView)}`);
  assert.equal(manualView.blankConfirm, false, `corners framing no print must not allow saving: ${JSON.stringify(manualView)}`);
  assert.ok(manualView.blankStatus.includes('모서리 안에 신분증이나 문서가 보이지 않습니다'), `blank-crop message: ${manualView.blankStatus}`);
  assert.equal(sideView.mode, 'automatic', `a card on its side must be cropped: ${JSON.stringify(sideView)}`);
  assert.equal(sideView.rotation, '270', `a clockwise-lying card is turned back: ${JSON.stringify(sideView)}`);
  assert.ok(sideView.width > sideView.height, `the card comes out landscape: ${JSON.stringify(sideView)}`);
  assert.ok(sideView.photoSide < sideView.textSide - 15, `the card comes out upright (photo on the left): ${JSON.stringify(sideView)}`);
  assert.equal(sideView.turnedRotation, '0', 'the rotate button turns a quarter (270 → 0)');
  assert.equal(sideView.turnedPortrait, true, 'after a quarter turn the result is portrait');
  assert.equal(ambiguous.confirmEnabled, false, 'ambiguous scenes keep save disabled until the user adjusts corners');
  console.log(`LIFE_WALLET_DOCUMENT_SCAN_UI_02 PASS — aspect=${automatic.aspect.toFixed(3)} edge_surface=${automatic.edgeSurfaceRatio.toFixed(3)} ambiguous=${ambiguous.reason}`);
}
