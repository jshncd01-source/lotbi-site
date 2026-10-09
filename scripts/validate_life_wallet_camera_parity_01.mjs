// LIFE-WALLET-CAMERA-PARITY-01
// A photo taken with the phone camera from Life Wallet must take exactly the path of the same
// photo chosen from the gallery or a PC: the file's bytes decide what it is (camera apps hand
// over temporary names, no extension, an empty or a non-standard type), the EXIF orientation
// is applied (or applied here when a decoder ignores it), large photos are bounded, and the
// tilted, perspective card shot is cropped and squared up. Photos that are not wallet items
// (a face, scenery with rows of windows, an empty desk, a pet) stay refused on that path.
// Runs as Samsung Internet on an Android phone (user agent, 412px, touch). All images are
// synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMSUNG_INTERNET = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';

const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 4000; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
try {
  const wallet = await import('/site-life-wallet.js?test=camera-parity');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=camera-parity');
  const host = document.getElementById('host');
  const errors = [];
  const fresh = () => { errors.length = 0; const picker = wallet.createWalletPhotoPicker({onError: message => { if (message) errors.push(message); }}); host.replaceChildren(picker.element); return picker; };

  // EXIF APP1 with one orientation entry (value at byte 28 of the segment).
  const exif = orientation => [0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0x00,0x00,0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,orientation,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
  // Stores an upright portrait photo the way a phone camera does for EXIF orientation 1, 2, 3,
  // 6 or 8 (pixels turned or mirrored, plus the tag that turns them back), with about 250 KB of
  // maker-note style header before the image size marker.
  const cameraBytes = async (upright, orientation, long = 4000) => {
    const short = Math.round(long * 3 / 4); const turned = orientation >= 5;
    const stored = new OffscreenCanvas(turned ? long : short, turned ? short : long); const context = stored.getContext('2d'); context.imageSmoothingQuality = 'high';
    if (orientation === 2) { context.translate(short, 0); context.scale(-1, 1); }
    if (orientation === 3) { context.translate(short, long); context.rotate(Math.PI); }
    if (orientation === 6) { context.translate(0, short); context.rotate(-Math.PI / 2); }
    if (orientation === 8) { context.translate(long, 0); context.rotate(Math.PI / 2); }
    context.drawImage(upright, 0, 0, short, long);
    const jpeg = new Uint8Array(await (await stored.convertToBlob({type: 'image/jpeg', quality: .9})).arrayBuffer());
    const filler = []; for (let block = 0; block < 4; block += 1) { const length = 65000; filler.push(0xFF, 0xE2, length >> 8, length & 255); for (let i = 0; i < length - 2; i += 1) filler.push(0); }
    const tag = exif(orientation); const bytes = new Uint8Array(2 + tag.length + filler.length + jpeg.length - 2);
    bytes.set([0xFF, 0xD8], 0); bytes.set(tag, 2); bytes.set(filler, 2 + tag.length); bytes.set(jpeg.subarray(2), 2 + tag.length + filler.length);
    return bytes;
  };
  const outcome = editor => {
    const preview = editor.querySelector('.wallet-scan-result-image');
    const width = Number(editor.dataset.scanSourceWidth); const height = Number(editor.dataset.scanSourceHeight);
    return {state: editor.dataset.scanState, mode: editor.dataset.scanMode, reason: editor.dataset.scanReason, width, height,
      result: preview && !preview.hidden ? [preview.naturalWidth, preview.naturalHeight] : null, save: !editor.querySelector('[data-wallet-scan-confirm]').disabled,
      status: editor.querySelector('.wallet-scan-status').textContent, pdfPages: editor.dataset.scanPdfPages || null,
      corners: [...editor.querySelectorAll('.wallet-scan-handle')].map(handle => [Number(handle.dataset.x) / width, Number(handle.dataset.y) / height])};
  };
  const settle = async editor => { await wait(() => ['review', 'error'].includes(editor.dataset.scanState), 'scanner outcome'); const preview = editor.querySelector('.wallet-scan-result-image'); if (editor.dataset.scanState === 'review' && !preview.hidden) await preview.decode(); return outcome(editor); };
  const open = async (picker, file) => {
    const transfer = new DataTransfer(); transfer.items.add(file); picker.input.files = transfer.files; picker.input.dispatchEvent(new Event('change', {bubbles: true}));
    const editor = await wait(() => picker.element.querySelector('.wallet-scan-editor') || (errors.length ? 'error' : null), 'scanner ' + file.name);
    if (editor === 'error') return {rejected: errors[0]};
    return settle(editor);
  };
  // Expected card corners as fractions of the upright frame.
  const expectedCorners = config => config.cards[0].corners.map(point => [point.x / config.width, point.y / config.height]);
  const cornerError = (found, expected) => Math.max(...expected.map(point => Math.min(...found.map(corner => Math.hypot((corner[0] - point[0]) * 3, (corner[1] - point[1]) * 4))))) / 5;

  // 1. Same bytes, gallery vs camera metadata.
  const base = scenes.cameraCardScene(16); const baseCanvas = await scenes.renderScene(base);
  const bytes = await cameraBytes(baseCanvas, 6);
  const variants = [['gallery', 'IMG_20261007_101010.jpg', 'image/jpeg'], ['camera-blank-type', '1728291234567', ''], ['camera-image-jpg', 'image', 'image/jpg'], ['camera-octet', 'capture.tmp', 'application/octet-stream']];
  const parity = {};
  for (const [name, fileName, type] of variants) parity[name] = await open(fresh(), new File([bytes], fileName, {type}));

  // 2. EXIF orientations a phone writes (portrait both ways, upside down, mirrored selfie).
  const orientations = {};
  for (const orientation of [1, 2, 3, 6, 8]) orientations[orientation] = await open(fresh(), new File([await cameraBytes(baseCanvas, orientation)], 'shot-' + orientation, {type: ''}));
  // A front-camera selfie saved mirrored (no tag): the card and its print appear mirrored.
  const mirrored = new OffscreenCanvas(baseCanvas.width, baseCanvas.height); const mirrorContext = mirrored.getContext('2d'); mirrorContext.translate(baseCanvas.width, 0); mirrorContext.scale(-1, 1); mirrorContext.drawImage(baseCanvas, 0, 0);
  const selfie = await open(fresh(), new File([await cameraBytes(mirrored, 1)], 'selfie', {type: 'image/jpeg'}));

  // 3. A 48 MP camera photo (8000x6000 stored, rotated by EXIF).
  const highRes = await open(fresh(), new File([await cameraBytes(baseCanvas, 6, 8000)], 'IMG_48MP.jpg', {type: 'image/jpeg'}));

  // 4. Tilted, perspective camera shots of a card on different surfaces, one held in the hand.
  const perspective = [];
  for (const index of [6, 21, 27, 32]) {
    const config = scenes.cameraCardScene(index); const canvas = await scenes.renderScene(config);
    const result = await open(fresh(), new File([await cameraBytes(canvas, 6)], String(1728291234000 + index), {type: ''}));
    perspective.push({index, rotation: config.expected.rotation, keystone: config.expected.keystone, fraction: config.expected.fraction, ...result, error: result.mode === 'automatic' ? cornerError(result.corners, expectedCorners(config)) : null});
  }

  // 5. Formats decided by bytes: HEIC without a type or name, a video and a GIF labelled as
  //    JPEG, a PDF without a type or name through the photo picker.
  const heic = await open(fresh(), new File([new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0,109,105,102,49,104,101,105,99])], '', {type: ''}));
  const video = await open(fresh(), new File([new Uint8Array([0,0,0,24,102,116,121,112,109,112,52,50,0,0,0,0,109,112,52,50,105,115,111,109])], 'IMG_0002.jpg', {type: 'image/jpeg'}));
  const gif = await open(fresh(), new File([new TextEncoder().encode('GIF89a' + '\\0'.repeat(20))], 'photo.jpg', {type: 'image/jpeg'}));
  const pdfText = '%PDF-1.4\\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj\\ntrailer << /Root 1 0 R >>\\n%%EOF\\n';
  const pdf = await open(fresh(), new File([new TextEncoder().encode(pdfText)], '', {type: ''}));

  // 6. Not wallet items, taken with the camera.
  const negatives = {};
  for (const [name, scene] of [['face', await scenes.renderNotDocumentScene('face', 0)], ['scenery', await scenes.renderNotDocumentScene('scenery', 1)], ['desk', await scenes.renderNotDocumentScene('desk', 1)], ['pet', await scenes.renderPetPhotoScene(2)]]) {
    negatives[name] = await open(fresh(), new File([await cameraBytes(scene.canvas, 6)], name, {type: ''}));
  }

  // 7. A browser whose decoders ignore the EXIF tag: the scanner turns the photo itself.
  const decode = globalThis.createImageBitmap.bind(globalThis);
  globalThis.createImageBitmap = async (source, ...rest) => {
    if (source instanceof Blob) { const raw = new Uint8Array(await source.arrayBuffer()); if (raw[2] === 0xFF && raw[3] === 0xE1 && raw[6] === 0x45) raw[30] = 1; source = new Blob([raw], {type: source.type}); }
    return decode(source, ...rest);
  };
  const legacyModule = await import('/site-life-wallet-scan-ui.js?test=camera-parity-legacy-decoder');
  const legacyScanner = legacyModule.createWalletDocumentScanner({file: new File([bytes], 'legacy', {type: ''})}); host.replaceChildren(legacyScanner.element);
  const legacy = await settle(legacyScanner.element); legacyScanner.destroy(); globalThis.createImageBitmap = decode;

  window.__result = JSON.stringify({ok: true, userAgent: navigator.userAgent, coarse: matchMedia('(pointer: coarse)').matches, touchPoints: navigator.maxTouchPoints, expected: expectedCorners(base), parity, orientations, selfie, highRes, perspective, heic, video, gif, pdf, negatives, legacy});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_camera_parity_01.html', fixtureHtml, resultExpression: 'window.__result || ""',
  viewport: {width: 412, height: 915, mobile: true, deviceScaleFactor: 1}, userAgent: SAMSUNG_INTERNET, touch: true, timeoutMs: 900_000});
assert.equal(result.ok, true, result.error);
assert.match(result.userAgent, /SamsungBrowser/u, 'the page must run as Samsung Internet');
assert.ok(result.touchPoints >= 1, 'the page must run with touch input');

const cornerError = (found, expected) => Math.max(...expected.map(point => Math.min(...found.map(corner => Math.hypot((corner[0] - point[0]) * 3, (corner[1] - point[1]) * 4))))) / 5;
const brief = value => JSON.stringify({...value, corners: undefined});

// 1. Parity: identical outcome whatever the camera reported.
const gallery = result.parity.gallery;
assert.equal(gallery.mode, 'automatic', `the gallery photo must be cropped automatically: ${brief(gallery)}`);
assert.equal(gallery.save, true);
assert.deepEqual([gallery.width, gallery.height], [1920, 2560], 'a 4000x3000 camera photo tagged "rotate 90" decodes upright and bounded');
assert.ok(cornerError(gallery.corners, result.expected) <= .03, `the crop must follow the card: ${brief(gallery)}`);
for (const [name, value] of Object.entries(result.parity)) {
  assert.ok(!value.rejected, `${name}: a camera shot with that name/type must not be refused: ${value.rejected}`);
  for (const key of ['state', 'mode', 'reason', 'width', 'height', 'save']) assert.equal(value[key], gallery[key], `${name}: ${key} must equal the gallery result (${brief(value)})`);
  assert.deepEqual(value.result, gallery.result, `${name}: the corrected image must be the same size`);
  assert.deepEqual(value.corners, gallery.corners, `${name}: the crop must be identical`);
}

// 2. Orientation: every way a phone stores the shot ends upright with the same crop.
for (const [orientation, value] of Object.entries(result.orientations)) {
  assert.equal(value.mode, 'automatic', `EXIF ${orientation}: must be cropped automatically: ${brief(value)}`);
  assert.deepEqual([value.width, value.height], [1920, 2560], `EXIF ${orientation}: decoded upright`);
  assert.ok(cornerError(value.corners, result.expected) <= .03, `EXIF ${orientation}: the crop must sit on the card in the upright photo: ${brief(value)}`);
  assert.ok(value.result[0] > value.result[1], `EXIF ${orientation}: the card comes out landscape`);
}

// A mirrored selfie: the card is found where it appears, mirrored left-right.
assert.equal(result.selfie.mode, 'automatic', `a mirrored selfie of the card must be cropped automatically: ${brief(result.selfie)}`);
assert.ok(cornerError(result.selfie.corners, result.expected.map(([x, y]) => [1 - x, y])) <= .03, 'the selfie crop must follow the mirrored card');

// 3. 48 MP photo.
assert.equal(result.highRes.mode, 'automatic', `a 48 MP camera photo must be cropped automatically: ${brief(result.highRes)}`);
assert.deepEqual([result.highRes.width, result.highRes.height], [1920, 2560], 'a 48 MP photo is bounded to 2560 pixels');
assert.ok(cornerError(result.highRes.corners, result.expected) <= .03, 'the 48 MP crop must follow the card');

// 4. Tilt and perspective.
for (const shot of result.perspective) {
  assert.equal(shot.mode, 'automatic', `tilted camera shot ${shot.index} (rotation ${shot.rotation.toFixed(1)}°, keystone ${shot.keystone.toFixed(2)}) must be cropped: ${brief(shot)}`);
  assert.ok(shot.error <= .03, `tilted camera shot ${shot.index}: the crop must follow the card (error ${shot.error})`);
  assert.ok(shot.result[0] > shot.result[1], `tilted camera shot ${shot.index}: squared up into a landscape card`);
  assert.equal(shot.save, true);
}

// 5. Formats by bytes.
assert.match(result.heic.status || '', /HEIC/u, `a HEIC shot without type or name must get the HEIC message: ${brief(result.heic)}`);
assert.equal(result.video.rejected, '사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다.', 'a video labelled as JPEG must be refused');
assert.equal(result.gif.rejected, '사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다.', 'a GIF labelled as JPEG must be refused');
assert.equal(result.pdf.pdfPages, '1', `a PDF without type or name must open as a PDF: ${brief(result.pdf)}`);

// 6. False-accept guard on the camera path.
for (const [name, value] of Object.entries(result.negatives)) {
  assert.notEqual(value.mode, 'automatic', `${name} photo must never be cropped as a wallet item: ${brief(value)}`);
  assert.equal(value.save, false, `${name} photo must not be savable: ${brief(value)}`);
}

// 7. A decoder that ignores the EXIF tag.
assert.equal(result.legacy.mode, 'automatic', `with a decoder that ignores EXIF the shot must still be cropped: ${brief(result.legacy)}`);
assert.ok(result.legacy.height > result.legacy.width, 'the scanner itself must turn the photo upright');
assert.ok(cornerError(result.legacy.corners, result.expected) <= .03, 'the crop must sit on the card in the upright photo');

console.log(`LIFE_WALLET_CAMERA_PARITY_01 PASS — samsung-internet ua, gallery=camera(blank/image-jpg/octet) identical, exif 1/2/3/6/8 upright, mirrored selfie, 48MP bounded, perspective ${result.perspective.map(shot => shot.error.toFixed(3)).join('/')}, heic/video/gif/pdf by bytes, negatives refused, legacy decoder turned`);
