// LIFE-WALLET-FULL-FRAME-CARD-01
// A business card or ID saved as a picture file (the whole image is the card, no background
// around it) is taken whole and can be saved, like a photographed card; it keeps its colours
// and the orientation it was saved in. Card-shaped pictures that are not wallet items stay
// unsaved: a blank card-shaped image, a wide screen capture with two short lines, a portrait
// phone screen capture, and wide crops of scenery, a pet and a face; a wide camera photo of a
// card on a white desk is never taken whole. All images are synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const scanUi = await import('/site-life-wallet-scan-ui.js?test=full-frame-card');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=full-frame-card');
  const host = document.getElementById('host');
  const fileOf = async (canvas, type) => new File([await canvas.convertToBlob(type === 'image/jpeg' ? {type, quality: .9} : {type})], 'picture', {type});
  const judge = async file => {
    const scanner = scanUi.createWalletDocumentScanner({file}); host.replaceChildren(scanner.element);
    const editor = scanner.element;
    for (let i = 0; i < 4000 && !['review', 'error'].includes(editor.dataset.scanState); i += 1) await sleep(25);
    const preview = editor.querySelector('.wallet-scan-result-image'); if (editor.dataset.scanState === 'review' && !preview.hidden) await preview.decode();
    const diagnostics = JSON.parse(editor.dataset.scanDiagnostics || '{}');
    const outcome = {state: editor.dataset.scanState, mode: editor.dataset.scanMode, reason: editor.dataset.scanReason, detected: diagnostics.source, rotation: editor.dataset.scanRotation,
      source: [Number(editor.dataset.scanSourceWidth), Number(editor.dataset.scanSourceHeight)], result: preview && !preview.hidden ? [preview.naturalWidth, preview.naturalHeight] : null,
      save: !editor.querySelector('[data-wallet-scan-confirm]').disabled, diagnostics: editor.dataset.scanDiagnostics};
    scanner.destroy(); return outcome;
  };
  const crop = (canvas, height) => { const out = new OffscreenCanvas(canvas.width, height); out.getContext('2d').drawImage(canvas, 0, (canvas.height - height) / 2, canvas.width, height, 0, 0, canvas.width, height); return out; };
  const blank = new OffscreenCanvas(900, 500); const blankContext = blank.getContext('2d'); blankContext.fillStyle = '#fafaf8'; blankContext.fillRect(0, 0, 900, 500);
  const cards = {
    'business-card-png': await judge(await fileOf(scenes.flatCardImage(1696, 940, {plain: true, font: 'regular'}, 31), 'image/png')),
    'id-card-jpeg': await judge(await fileOf(scenes.flatCardImage(1012, 638, {font: 'small'}, 32), 'image/jpeg')),
    'vertical-business-card': await judge(await fileOf(scenes.flatCardImage(940, 1696, {plain: true, font: 'regular'}, 33), 'image/png')),
    'faint-business-card': await judge(await fileOf(scenes.flatCardImage(1696, 940, {plain: true, font: 'regular', ink: '#6e7680'}, 34), 'image/png')),
  };
  const others = {
    'blank-card-shape': await judge(await fileOf(blank, 'image/png')),
    'wide-capture-two-lines': await judge(await fileOf(scenes.flatCardImage(1600, 900, {plain: true, font: 'regular', glyphDensity: .34}, 35), 'image/png')),
    'phone-capture': await judge(await fileOf(scenes.flatCardImage(1080, 2340, {plain: true, font: 'regular', glyphDensity: 1.4}, 36), 'image/png')),
    'wide-scenery': await judge(await fileOf(crop((await scenes.renderNotDocumentScene('scenery', 1)).canvas, 590), 'image/jpeg')),
    'wide-face': await judge(await fileOf(crop((await scenes.renderNotDocumentScene('face', 0)).canvas, 590), 'image/jpeg')),
  };
  for (let index = 1; index <= 4; index += 1) others['wide-pet-' + index] = await judge(await fileOf(crop((await scenes.renderPetPhotoScene(index)).canvas, 590), 'image/jpeg'));
  // Wide (16:9) camera photos of a pale card on a white desk: never taken whole as a card
  // (the light falls off across the desk; a found card outline is fine).
  const desks = {};
  for (const index of [7, 13, 31]) desks['wide-desk-' + index] = await judge(await fileOf(await scenes.renderScene(scenes.cameraCardScene(index, {width: 1600, height: 900})), 'image/jpeg'));
  window.__result = JSON.stringify({ok: true, cards, others, desks});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_full_frame_card_01.html', fixtureHtml, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 600_000});
assert.equal(result.ok, true, result.error);
for (const [name, value] of Object.entries(result.cards)) {
  const detail = JSON.stringify(value);
  assert.equal(value.mode, 'automatic', `${name}: a card saved as a picture must be taken automatically: ${detail}`);
  assert.equal(value.detected, 'full-frame-card', `${name}: the whole picture is the card: ${detail}`);
  assert.equal(value.save, true, `${name}: it must be savable: ${detail}`);
  assert.equal(value.rotation, '0', `${name}: a card picture keeps the orientation it was saved in: ${detail}`);
  // The whole card is kept (no crop into the print, no margin lost).
  assert.ok(value.result[0] >= value.source[0] - 4 && value.result[1] >= value.source[1] - 4, `${name}: the whole card must be kept: ${detail}`);
}
for (const [name, value] of Object.entries(result.others)) {
  const detail = JSON.stringify(value);
  assert.notEqual(value.mode, 'automatic', `${name}: must not be taken as a wallet item: ${detail}`);
  assert.equal(value.save, false, `${name}: must not be savable: ${detail}`);
}
for (const [name, value] of Object.entries(result.desks)) assert.notEqual(value.detected, 'full-frame-card', `${name}: a camera photo of a card on a desk must not be taken whole: ${JSON.stringify(value)}`);
console.log(`LIFE_WALLET_FULL_FRAME_CARD_01 PASS — card pictures ${Object.keys(result.cards).join('/')} taken whole; desk photos ${Object.values(result.desks).map(value => value.detected).join('/')}; ${Object.keys(result.others).length} card-shaped non-items refused (${Object.entries(result.others).map(([name, value]) => name + ':' + value.reason).join(', ')})`);
