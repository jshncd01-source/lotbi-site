// SITE-DARK-WORDMARK-COUNTERS-01 — the B has to read as a B in Dark.
//
// 대표님: "다크모드에서 너무 B자가 좀 이상하지 않아? 확실하게 B자라고 보이고 좀 바꿔"
//
// The wiring was already right — PR #220 made the lockup follow the LOTBI theme
// switch rather than only the OS, so the dark artwork was reaching the screen.
// The artwork itself was wrong. tools/build-brand-assets.py removes the white
// background by flooding inward from the image border, and a letter counter (the
// enclosed hole in O, the two bowls in B) is white fenced in by ink, so the flood
// could never arrive. Those pixels stayed fully opaque white. On a white page
// that is invisible, which is how it shipped on 9/22. On #151922 they light up
// with the rest of the wordmark: the O became a filled disc and the B a filled
// block.
//
// This gate measures the shipped PNGs, not the source that made them. A hand
// edit, a generator regression, or a re-export from some other tool all fail the
// same way.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------ png ----
// The brand assets are written by Pillow as 8-bit non-interlaced RGBA. Reading
// them here keeps this gate dependency-free; anything else is rejected loudly
// rather than silently measured wrong.
function decodePng(rel) {
  const buf = readFileSync(path.join(ROOT, rel));
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${rel} must be a PNG`);

  let width = 0;
  let height = 0;
  const idat = [];
  for (let at = 8; at + 8 <= buf.length;) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8, `${rel} must be 8-bit`);
      assert.equal(body[9], 6, `${rel} must be RGBA (colour type 6)`);
      assert.equal(body[12], 0, `${rel} must not be interlaced`);
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  assert.ok(width > 0 && height > 0, `${rel} has no IHDR`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else assert.equal(filter, 0, `${rel} row ${y} uses unsupported filter ${filter}`);
      out[y * stride + x] = value & 0xff;
    }
  }
  return {
    width,
    height,
    alphaAt: (x, y) => out[y * stride + x * 4 + 3],
    rgbAt: (x, y) => [out[y * stride + x * 4], out[y * stride + x * 4 + 1], out[y * stride + x * 4 + 2]],
  };
}

// ------------------------------------------------------------- geometry ----
const INK = 16; // alpha above this counts as drawn

// Connected components of pixels matching `hit`, 4-connected, within [x0, x1].
function components(img, x0, x1, hit) {
  const {width, height, alphaAt} = img;
  const seen = new Uint8Array(width * height);
  const found = [];
  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = x0; sx <= x1; sx += 1) {
      if (seen[sy * width + sx] || !hit(alphaAt(sx, sy))) continue;
      const stack = [sx, sy];
      seen[sy * width + sx] = 1;
      let size = 0;
      let touchesEdge = false;
      let minX = sx; let maxX = sx; let minY = sy; let maxY = sy;
      while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        size += 1;
        if (x === x0 || x === x1 || y === 0 || y === height - 1) touchesEdge = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < x0 || nx > x1 || ny < 0 || ny >= height) continue;
          if (seen[ny * width + nx] || !hit(alphaAt(nx, ny))) continue;
          seen[ny * width + nx] = 1;
          stack.push(nx, ny);
        }
      }
      found.push({size, touchesEdge, minX, maxX, minY, maxY});
    }
  }
  return found.sort((a, b) => b.size - a.size);
}

// The lockup is mascot + wordmark. Every asserted glyph lives in the wordmark,
// so the mascot — which is legitimately white, and legitimately solid — is never
// measured. The split is found from the artwork instead of hardcoded, so the
// gate survives a re-crop.
function wordmarkRange(img) {
  const {width, height, alphaAt} = img;
  const inked = [];
  for (let x = 0; x < width; x += 1) {
    let n = 0;
    for (let y = 0; y < height; y += 1) if (alphaAt(x, y) > INK) n += 1;
    inked.push(n);
  }
  let bestGap = null;
  let run = null;
  for (let x = 0; x < width; x += 1) {
    if (inked[x] === 0) {
      if (run === null) run = [x, x];
      else run[1] = x;
    } else if (run) {
      if (run[0] > width * 0.2 && (!bestGap || run[1] - run[0] > bestGap[1] - bestGap[0])) bestGap = run;
      run = null;
    }
  }
  assert.ok(bestGap, 'could not find the gap between the mascot and the wordmark');
  let last = width - 1;
  while (last > bestGap[1] && inked[last] === 0) last -= 1;
  return [bestGap[1] + 1, last];
}

// ---------------------------------------------------------------- gates ----
const DARK_SURFACE = [0x15, 0x19, 0x22]; // --lotbi-bg-primary
const relativeLuminance = ([r, g, b]) => [r, g, b]
  .map(v => v / 255)
  .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// 160w is what every surface actually requests through srcset's smallest
// candidate; the larger ones back the 2x/3x steps. All four must read.
const DARK_LOCKUPS = [
  'assets/brand/lotbi-lockup-dark-160w.png',
  'assets/brand/lotbi-lockup-dark-320w.png',
  'assets/brand/lotbi-lockup-dark-480w.png',
  'assets/brand/lotbi-lockup-dark.png',
];

for (const rel of DARK_LOCKUPS) {
  const img = decodePng(rel);
  const [x0, x1] = wordmarkRange(img);

  // L O T B I — five separate ink shapes. If a counter is filled the glyph is
  // still one shape, so this alone does not catch the bug; it anchors the
  // indexing for everything below.
  const glyphs = components(img, x0, x1, a => a > INK)
    .filter(c => c.size > (x1 - x0) * 0.5)
    .sort((a, b) => a.minX - b.minX);
  assert.equal(glyphs.length, 5, `${rel}: expected five wordmark glyphs, found ${glyphs.length}`);
  const [, o, , b] = glyphs;

  // The actual regression. A counter is a transparent region fenced in by ink,
  // so it never touches the wordmark's outer edge. Before this fix there were
  // exactly zero of them and the whole wordmark sat in one edge-touching
  // background region.
  const holes = components(img, x0, x1, a => a <= INK).filter(c => !c.touchesEdge);
  assert.ok(holes.length >= 3,
    `${rel}: the wordmark has ${holes.length} enclosed transparent counters, expected at least 3 `
    + '(the O bowl and B\'s two bowls). A filled counter turns the B into a solid block — '
    + 'rebuild with tools/build-brand-assets.py.');

  // Name them, so a fix that opens three holes in the wrong glyph still fails.
  const inside = (hole, glyph) => hole.minX >= glyph.minX && hole.maxX <= glyph.maxX
    && hole.minY >= glyph.minY && hole.maxY <= glyph.maxY;
  assert.ok(holes.some(h => inside(h, o)), `${rel}: the O has no open bowl`);
  const bBowls = holes.filter(h => inside(h, b));
  assert.equal(bBowls.length, 2,
    `${rel}: the B has ${bBowls.length} open bowls, expected 2 — this is the glyph 대표님 reported`);

  // Two bowls can exist and still be a few stray pixels wide, which would pass
  // the count and fail the eye. This measures how much of the B is actually
  // open. On the shipped artwork it is 6.4% at 160w rising to 9.3% at full
  // size; before this fix it was 0.0% at every size.
  const bArea = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
  const bOpen = bBowls.reduce((sum, hole) => sum + hole.size, 0) / bArea;
  assert.ok(bOpen >= 0.04,
    `${rel}: the B's bowls are only ${(bOpen * 100).toFixed(1)}% of the glyph box — too closed to read as a B`);

  // The counters only help if the letters themselves still carry contrast.
  let best = 0;
  for (let x = x0; x <= x1; x += 1) {
    for (let y = 0; y < img.height; y += 1) {
      if (img.alphaAt(x, y) < 250) continue;
      best = Math.max(best, contrast(img.rgbAt(x, y), DARK_SURFACE));
    }
  }
  assert.ok(best >= 4.5, `${rel}: wordmark ink peaks at ${best.toFixed(2)}:1 on the dark surface`);

  console.log(
    `${path.basename(rel).padEnd(30)} glyphs=5 counters=${holes.length} `
    + `B-open=${(bOpen * 100).toFixed(1)}% ink=${best.toFixed(2)}:1`);
}

// The light lockup is deliberately NOT rebuilt by this change — 대표님 never
// reported it and it sits on white, where a filled counter cannot be seen. This
// asserts that intent rather than leaving it to chance: if someone later opens
// the light counters too, they are told to come update this gate and re-check
// the light surfaces, instead of it passing silently.
const light = decodePng('assets/brand/lotbi-lockup-160w.png');
const lightRange = wordmarkRange(light);
const lightHoles = components(light, lightRange[0], lightRange[1], a => a <= INK)
  .filter(c => !c.touchesEdge);
assert.equal(lightHoles.length, 0,
  'the light lockup changed shape. That is not wrong, but it is out of this fix\'s scope: '
  + 're-verify the light wordmark on #ffffff and #f7f8fb, then update this assertion.');

// ------------------------------------------------------------ generator ----
// The PNGs are build output. If the generator loses the step, the next rebuild
// silently reintroduces the bug — so the step is pinned at its source too.
const generator = readFileSync(path.join(ROOT, 'tools/build-brand-assets.py'), 'utf8');
assert.match(generator, /def knock_out_counters\(/,
  'the counter knockout must stay in the brand asset generator');
assert.match(generator, /word_dark = navy_to_light\(knock_out_counters\(word\)\)/,
  'the dark wordmark must be built from counter-opened artwork');
assert.match(generator, /navy_to_light\(\s*knock_out_counters\(lock\.crop/,
  'the dark lockup must be built from counter-opened artwork');
assert.ok(!/knock_out_counters\(mark/.test(generator),
  'the mascot is legitimately white ink — knocking out its white would dissolve the robot');

console.log('DARK WORDMARK COUNTERS CONTRACT: PASS');
