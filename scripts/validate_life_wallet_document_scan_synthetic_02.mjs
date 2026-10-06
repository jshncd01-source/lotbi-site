// LIFE-WALLET-DOCUMENT-SCAN-SYNTHETIC-02
// Real-photo conditions for automatic wallet-card cropping, reproduced only with
// procedurally generated, privacy-free scenes (scripts/fixtures/life-wallet-scan-scenes.mjs):
// textured green-family surfaces with uneven light, asymmetric margins, cards close
// to the top/bottom frame, rounded corners under rotation and perspective, dense
// glyph/hologram-like internal edges, plus negative scenes that must stay manual.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixture = `<!doctype html><html><body><script type="module">
const W = 1266, H = 680;
try {
  const scan = await import('/site-life-wallet-scan.js?test=synthetic-02');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=synthetic-02');
  const card = options => scenes.walletCard({width: options.width || W, height: options.height || H, ...options});
  const named = [
    {group: 'SYNTHETIC_TEXTURED_FIXTURE', name: 'felt-real-like', expect: 'card', scene: {seed: 11, surfaceKind: 'felt', cards: [card({margins: {left: .13, right: .06, top: .03, bottom: .03}, rotation: 1.2, keystone: .03})]}},
    {group: 'SYNTHETIC_TEXTURED_FIXTURE', name: 'cutting-mat-grid', expect: 'card', scene: {seed: 16, surfaceKind: 'mat', cards: [card({margins: {left: .15, right: .06, top: .035, bottom: .03}, rotation: 1.5, keystone: .03})]}},
    {group: 'SYNTHETIC_TEXTURED_FIXTURE', name: 'strong-texture', expect: 'card', scene: {seed: 17, surfaceKind: 'strong', cards: [card({margins: {left: .12, right: .06, top: .04, bottom: .04}, rotation: -.8, keystone: .02})]}},
    {group: 'SYNTHETIC_ASYMMETRIC_MARGIN', name: 'wide-left-margin', expect: 'card', scene: {seed: 12, surfaceKind: 'olive', cards: [card({margins: {left: .19, right: .045, top: .05, bottom: .04}, rotation: -2, keystone: .02})]}},
    {group: 'SYNTHETIC_NEAR_BORDER', name: 'near-top-bottom', expect: 'card', scene: {seed: 13, surfaceKind: 'felt', cards: [card({margins: {left: .11, right: .07, top: .02, bottom: .025}, rotation: .6, keystone: .025})]}},
    {group: 'SYNTHETIC_NEAR_BORDER', name: 'near-border-hard-light', expect: 'card', scene: {seed: 19, surfaceKind: 'felt', lighting: {left: .58, right: 1.22, top: 1.08, bottom: .86, hotspot: .2}, cards: [card({margins: {left: .14, right: .05, top: .03, bottom: .035}, rotation: 1.8, keystone: .035})]}},
    {group: 'SYNTHETIC_PERSPECTIVE', name: 'rounded-keystone', expect: 'card', scene: {seed: 14, surfaceKind: 'felt', cards: [card({margins: {left: .14, right: .08, top: .06, bottom: .05}, rotation: 3, keystone: .07})]}},
    {group: 'SYNTHETIC_PERSPECTIVE', name: 'portrait-photo', expect: 'card', scene: {width: 680, height: 1266, seed: 18, surfaceKind: 'felt', cards: [card({width: 680, height: 1266, margins: {left: .05, right: .03, top: .33, bottom: .38}, rotation: 2, keystone: .03})]}},
    {group: 'SYNTHETIC_DENSE_INTERNAL_EDGES', name: 'dense-glyphs-hologram', expect: 'card', scene: {seed: 15, surfaceKind: 'felt', cards: [card({margins: {left: .12, right: .07, top: .04, bottom: .03}, rotation: -1, keystone: .03, keystoneAxis: 'right', glyphDensity: 2})]}},
    {group: 'SYNTHETIC_DENSE_INTERNAL_EDGES', name: 'strong-internal-panel', expect: 'card', scene: {seed: 26, surfaceKind: 'felt', cards: [card({margins: {left: .13, right: .06, top: .04, bottom: .04}, rotation: 1, panel: true})]}},
    {group: 'NEGATIVE', name: 'surface-only', expect: 'manual', scene: {seed: 21, surfaceKind: 'felt', cards: []}},
    {group: 'NEGATIVE', name: 'strong-texture-only', expect: 'manual', scene: {seed: 22, surfaceKind: 'strong', cards: []}},
    {group: 'NEGATIVE', name: 'photo-frame-only', expect: 'manual', scene: {seed: 28, surfaceKind: 'felt', frame: {thickness: .035, color: [28, 30, 28]}, cards: []}},
    {group: 'NEGATIVE', name: 'small-rectangle', expect: 'manual', scene: {seed: 23, surfaceKind: 'felt', cards: [card({margins: {left: .4, right: .41, top: .38, bottom: .4}, rotation: 4})]}},
    {group: 'NEGATIVE', name: 'two-cards', expect: 'manual', scene: {seed: 24, surfaceKind: 'felt', cards: [card({margins: {left: .04, right: .53, top: .2, bottom: .22}, rotation: 2}), card({margins: {left: .53, right: .04, top: .22, bottom: .2}, rotation: -2})]}},
    {group: 'NEGATIVE', name: 'two-touching-cards', expect: 'manual', scene: {seed: 29, surfaceKind: 'olive', cards: [card({margins: {left: .03, right: .49, top: .25, bottom: .2}, rotation: -3}), card({margins: {left: .5, right: .03, top: .2, bottom: .25}, rotation: 4})]}},
    {group: 'NEGATIVE', name: 'very-low-contrast', expect: 'manual', scene: {seed: 25, surfaceKind: 'felt', cards: [card({margins: {left: .13, right: .06, top: .04, bottom: .04}, rotation: 1, tint: [70, 118, 76], plain: true})]}},
    {group: 'NEGATIVE', name: 'weak-card-strong-panel', expect: 'manual', scene: {seed: 27, surfaceKind: 'felt', cards: [card({margins: {left: .13, right: .06, top: .04, bottom: .04}, rotation: 1, tint: [70, 118, 76], panel: true})]}},
  ];
  const sweep = Array.from({length: 24}, (_, index) => ({group: 'SYNTHETIC_RANDOM_ENVELOPE', name: 'seed-' + (index + 1), expect: 'card', scene: scenes.randomWalletScene(index + 1)}));
  const results = [];
  for (const test of [...named, ...sweep]) {
    const width = test.scene.width || W; const height = test.scene.height || H;
    const canvas = await scenes.renderScene({width, height, ...test.scene});
    // Same bounded detection input the scanner UI builds before detection.
    const scale = Math.min(1, 1200 / Math.max(width, height));
    const small = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
    const context = small.getContext('2d', {willReadFrequently: true}); context.drawImage(canvas, 0, 0, small.width, small.height);
    const started = performance.now();
    const found = scan.detectDocumentCorners(context.getImageData(0, 0, small.width, small.height));
    const elapsed = performance.now() - started;
    const row = {group: test.group, name: test.name, expect: test.expect, mode: found.mode, reason: found.reason, elapsed, diagnostics: found.diagnostics};
    if (test.scene.cards.length === 1) {
      const truth = scan.orderDocumentCorners(test.scene.cards[0].corners);
      const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
      const lengths = keys.map((key, index) => Math.hypot(truth[keys[(index + 1) % 4]].x - truth[key].x, truth[keys[(index + 1) % 4]].y - truth[key].y));
      row.shortSide = Math.min(...lengths);
      row.errors = keys.map(key => Math.hypot(found.corners[key].x / scale - truth[key].x, found.corners[key].y / scale - truth[key].y));
    }
    results.push(row);
  }
  window.__result = {ok: true, results};
} catch (error) { window.__result = {ok: false, error: String(error?.stack || error)}; }
</script></body></html>`;

const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_scan_synthetic_02.html', fixtureHtml: fixture, timeoutMs: 900000,
  resultExpression: 'window.__result ? JSON.stringify(window.__result) : ""',
});
assert.equal(result.ok, true, result.error);
{
  const groups = new Map();
  const allowedDiagnostics = new Set(['working', 'surface', 'legacy', 'source', 'floodThreshold', 'calmGradient', 'foregroundRegions', 'surfaceCandidates', 'rejected', 'nested', 'bounds', 'areaRatio', 'fill', 'outside', 'coverage', 'straightness', 'contrast', 'minimumContrast', 'contrastToSurface', 'edgeSupport', 'shapeScore', 'rectangularity', 'cornerRadius', 'angles']);
  for (const row of result.results) {
    const label = `${row.group}/${row.name}`;
    const serialized = JSON.stringify(row.diagnostics || {});
    assert.ok(serialized.length < 1200, `${label}: diagnostics must stay small geometry/statistics (${serialized.length} chars)`);
    for (const key of Object.keys(row.diagnostics || {})) assert.ok(allowedDiagnostics.has(key), `${label}: unexpected diagnostics key ${key}`);
    assert.ok(!/data:image|base64/u.test(serialized), `${label}: diagnostics must not carry image data`);
    if (row.expect === 'card') {
      assert.equal(row.mode, 'automatic', `${label}: card was not detected automatically: ${row.reason} ${serialized}`);
      assert.equal(row.reason, 'document-quadrilateral');
      // Corners are the intersections of the straight card sides, so rounded corners are
      // neither clipped nor padded: every corner must land within ~1% of the card's short side.
      const tolerance = Math.max(6, row.shortSide * 0.012);
      row.errors.forEach((error, index) => assert.ok(error <= tolerance, `${label}: corner ${index} is ${error.toFixed(1)}px from the card corner (tolerance ${tolerance.toFixed(1)}): ${serialized}`));
    } else {
      assert.equal(row.mode, 'manual', `${label}: ambiguous/negative scene must not be cropped automatically: ${serialized}`);
    }
    const group = groups.get(row.group) || {count: 0, worst: 0, elapsed: 0};
    group.count += 1; group.elapsed += row.elapsed; if (row.expect === 'card') group.worst = Math.max(group.worst, ...row.errors);
    groups.set(row.group, group);
  }
  const average = result.results.reduce((sum, row) => sum + row.elapsed, 0) / result.results.length;
  assert.ok(average < 3000, `average detection time ${average.toFixed(0)}ms suggests a pathological slowdown`);
  for (const [name, group] of groups) console.log(`${name}=PASS scenes=${group.count}${group.worst ? ` worst_corner_px=${group.worst.toFixed(1)}` : ''}`);
  console.log(`LIFE_WALLET_DOCUMENT_SCAN_SYNTHETIC_02 PASS — scenes=${result.results.length}, average_detection_ms=${average.toFixed(0)}`);
}
