// LIFE-WALLET-UPRIGHT-PRINT-01
// Nobody should have to press 회전: a found item is stood upright by its print. A page (or a
// bankbook spread, a contract) photographed on its side or upside down comes out reading
// upright — the empty bands between its lines say which way the print runs and the even line
// starts say which end is the top. A card keeps the shape rule for quarter turns (verified on
// real photos); an upside-down card is left for 회전 (right-aligned business cards would be
// flipped by a line-end rule), and a rounded card's dense small print never turns it (it can
// line up both ways). A two-page bankbook spread reads upright in all four turns too: its
// lines start evenly in two columns. All images are synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureHtml = `<!doctype html><html><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?upright=1');
  const ui = await import('/site-life-wallet-scan-ui.js?upright=1');
  const turn = (canvas, degrees) => {
    if (!degrees) return canvas;
    const quarter = degrees % 180 !== 0; const out = new OffscreenCanvas(quarter ? canvas.height : canvas.width, quarter ? canvas.width : canvas.height);
    const context = out.getContext('2d'); context.translate(out.width / 2, out.height / 2); context.rotate(degrees * Math.PI / 180); context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); return out;
  };
  const nativeBitmap = globalThis.createImageBitmap;
  const judge = async canvas => {
    globalThis.createImageBitmap = async () => canvas;
    const scanner = ui.createWalletDocumentScanner({file: new File([await canvas.convertToBlob({type: 'image/jpeg', quality: .9})], 'upright.jpg', {type: 'image/jpeg'})});
    document.getElementById('host').replaceChildren(scanner.element);
    const element = scanner.element; for (let i = 0; i < 2400 && !['review', 'error'].includes(element.dataset.scanState); i += 1) await sleep(25);
    const diagnostics = JSON.parse(element.dataset.scanDiagnostics || '{}');
    const preview = element.querySelector('.wallet-scan-result-image');
    for (let i = 0; i < 400 && preview && (!preview.complete || !preview.naturalWidth); i += 1) await sleep(25);
    const out = {mode: element.dataset.scanMode, rotation: Number(element.dataset.scanRotation || 0), print: diagnostics.print || '', save: !element.querySelector('[data-wallet-scan-confirm]').disabled, width: preview?.naturalWidth || 0, height: preview?.naturalHeight || 0};
    scanner.destroy(); globalThis.createImageBitmap = nativeBitmap; return out;
  };
  const rows = [];
  for (const index of [0, 1, 2, 3]) {
    const {canvas} = await scenes.renderPageScene(index, {photo: index % 2 === 1});
    for (const degrees of [0, 90, 180, 270]) rows.push({kind: 'page', index, degrees, expected: (360 - degrees) % 360, ...(await judge(turn(canvas, degrees)))});
  }
  // A bankbook-like spread: two pages side by side on a darker desk.
  for (const index of [0, 2]) {
    const left = (await scenes.renderPageScene(index)).canvas; const right = (await scenes.renderPageScene(index + 1)).canvas; const pad = 160;
    const spread = new OffscreenCanvas(left.width * 2 + pad * 2, left.height + pad * 2); const context = spread.getContext('2d');
    context.fillStyle = 'rgb(62,70,58)'; context.fillRect(0, 0, spread.width, spread.height); context.drawImage(left, pad, pad); context.drawImage(right, pad + left.width, pad);
    context.fillStyle = 'rgba(0,0,0,.25)'; context.fillRect(pad + left.width - 3, pad, 6, left.height);
    const photo = new OffscreenCanvas(Math.round(spread.width / 2), Math.round(spread.height / 2)); photo.getContext('2d').drawImage(spread, 0, 0, photo.width, photo.height);
    for (const degrees of [0, 90, 180, 270]) rows.push({kind: 'spread', index, degrees, expected: (360 - degrees) % 360, ...(await judge(turn(photo, degrees)))});
  }
  // Rounded cards with dense small print, upright: never turned by their print.
  for (const [seed, glyphDensity] of [[15, 2], [21, 1.8]]) {
    const canvas = await scenes.renderScene({seed, surfaceKind: 'felt', cards: [scenes.walletCard({width: 1266, height: 680, margins: {left: .12, right: .07, top: .04, bottom: .03}, rotation: -1, keystone: .03, keystoneAxis: 'right', glyphDensity})]});
    rows.push({kind: 'dense-card', index: seed, degrees: 0, expected: 0, ...(await judge(canvas))});
  }
  for (const index of [0, 2, 3, 6]) {
    const canvas = await scenes.renderScene(scenes.cameraCardScene(index));
    for (const degrees of [0, 90, 270]) rows.push({kind: 'card', index, degrees, expected: (360 - degrees) % 360, ...(await judge(turn(canvas, degrees)))});
  }
  window.__result = JSON.stringify({ok: true, rows});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_upright_print_01.html', fixtureHtml, viewport: {width: 900, height: 900}, timeoutMs: 900_000, resultExpression: 'window.__result || ""'});
assert.equal(result.ok, true, result.error);
for (const row of result.rows) {
  const detail = JSON.stringify(row);
  assert.equal(row.mode, 'automatic', `${row.kind} #${row.index} turned ${row.degrees}° is still found: ${detail}`);
  assert.equal(row.rotation, row.expected, `${row.kind} #${row.index} turned ${row.degrees}° comes out upright without 회전: ${detail}`);
  if (row.kind === 'page' || row.kind === 'spread') {
    // A page's print decides it clearly: lines one way, almost no bands the other.
    const [across, down] = row.print.split('/').map(Number);
    assert.ok(row.degrees % 180 === 0 ? across >= 4 * down + 1 : down >= 4 * across + 1, `page print bands: ${detail}`);
    assert.ok(row.kind === 'spread' ? row.width > row.height : row.height > row.width, `the saved ${row.kind} keeps its upright shape: ${detail}`);
  } else {
    assert.ok(row.width > row.height, `the saved card stands landscape: ${detail}`);
  }
}
console.log(`LIFE_WALLET_UPRIGHT_PRINT_01 PASS — ${result.rows.length} synthetic pages and bankbook spreads (0/90/180/270), dense rounded cards (0) and cards (0/90/270) come out upright`);
