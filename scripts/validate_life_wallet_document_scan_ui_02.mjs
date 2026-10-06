// LIFE-WALLET-DOCUMENT-SCAN-UI-02
// The scanner UI on a privacy-free synthetic photo that reproduces the reported
// failure conditions (textured green surface, uneven light, card close to the
// top/bottom edges, wider left margin, rounded corners, perspective, dense
// internal edges). The default flow must crop automatically: no manual corner
// step, background and margins removed, the whole card kept, save enabled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = '/__life_wallet_scan_ui_02.html';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required for the Life Wallet scan UI validation.');
}

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:680px;margin:auto}</style></head><body><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
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
  twoCards.destroy(); globalThis.createImageBitmap = nativeBitmap;
  window.__result = {ok: true, automatic, ambiguous};
} catch (error) { window.__result = {ok: false, error: String(error?.stack || error)}; }
</script></body></html>`;

function contentType(file) {
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === FIXTURE_PATH) { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); response.end(fixture); return; }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, {'content-type': contentType(file)}); response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-wallet-scan-ui-'));
const chrome = spawn(browserPath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});
let socket;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 200 && !fs.existsSync(portFile); attempt += 1) await delay(50);
  const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/u)[0];
  let page;
  for (let attempt = 0; attempt < 100 && !page; attempt += 1) {
    try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(target => target.type === 'page'); } catch {}
    if (!page) await delay(50);
  }
  assert.ok(page, 'headless Chrome page target missing');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
  let messageId = 0; const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
  const send = (method, params = {}) => new Promise(resolve => { const id = ++messageId; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await send('Page.navigate', {url: origin + FIXTURE_PATH});
  let result = null;
  for (let attempt = 0; attempt < 900 && !result; attempt += 1) {
    await delay(100);
    const evaluated = await send('Runtime.evaluate', {expression: 'window.__result ? JSON.stringify(window.__result) : ""', returnByValue: true});
    const value = evaluated.result?.result?.value; if (value) result = JSON.parse(value);
  }
  assert.ok(result, 'scanner UI fixture timed out');
  assert.equal(result.ok, true, result.error);
  const {automatic, ambiguous} = result;
  const detail = JSON.stringify({...automatic, text: undefined});
  assert.equal(automatic.state, 'review');
  assert.equal(automatic.mode, 'automatic', `real-condition card photo fell back to manual: ${detail}`);
  assert.equal(automatic.reason, 'document-quadrilateral');
  assert.equal(automatic.diagnostics.source, 'border-surface', `unexpected detection source: ${detail}`);
  assert.ok(automatic.status.includes('배경과 여백을 자동으로 제거했습니다'), `automatic status copy missing: ${automatic.status}`);
  assert.ok(!automatic.text.includes('테두리를 찾지 못했습니다'), 'manual-fallback copy must not appear for a detectable card');
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
  assert.equal(ambiguous.confirmEnabled, false, 'ambiguous scenes keep save disabled until the user adjusts corners');
  console.log(`LIFE_WALLET_DOCUMENT_SCAN_UI_02 PASS — aspect=${automatic.aspect.toFixed(3)} edge_surface=${automatic.edgeSurfaceRatio.toFixed(3)} ambiguous=${ambiguous.reason}`);
} finally {
  try { socket?.close(); } catch {}
  chrome.kill(); server.close();
  for (let attempt = 0; attempt < 10; attempt += 1) { try { fs.rmSync(profile, {recursive: true, force: true}); break; } catch { await delay(200); } }
}
