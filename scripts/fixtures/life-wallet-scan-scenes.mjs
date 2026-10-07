// Synthetic, privacy-free wallet-card photographs for the Life Wallet scan
// validators. Every scene is procedurally generated from a seed: textured,
// unevenly lit surfaces, rounded identity-card shaped documents under rotation
// and perspective, dense glyph-like internal edges and hologram-like tints.
// No real document, face, name or number is drawn or stored here.

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(width, height, cell, random) {
  const columns = Math.ceil(width / cell) + 2; const rows = Math.ceil(height / cell) + 2;
  const grid = new Float32Array(columns * rows).map(() => random() * 2 - 1);
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const gy = y / cell; const row = Math.floor(gy); const fy = gy - row; const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < width; x += 1) {
      const gx = x / cell; const column = Math.floor(gx); const fx = gx - column; const sx = fx * fx * (3 - 2 * fx);
      const a = grid[row * columns + column]; const b = grid[row * columns + column + 1];
      const c = grid[(row + 1) * columns + column]; const d = grid[(row + 1) * columns + column + 1];
      output[y * width + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    }
  }
  return output;
}

function surface(width, height, kind, random) {
  const pixels = new Float32Array(width * height * 3);
  const coarse = valueNoise(width, height, Math.max(24, Math.round(width / 9)), random);
  const middle = valueNoise(width, height, 9, random);
  const fine = valueNoise(width, height, 3, random);
  const base = kind === 'mat' ? [44, 112, 84] : kind === 'olive' ? [96, 118, 70] : kind === 'navy' ? [40, 52, 92] : [62, 112, 70];
  const strength = kind === 'strong' ? 2.4 : 1;
  const grid = Math.round(width / 26);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let shade = coarse[index] * 14 + middle[index] * 10 * strength + fine[index] * 9 * strength;
      if (kind === 'felt' || kind === 'strong') shade += Math.sin(x * 0.9 + Math.sin(y * 0.21) * 3) * 4 * strength;
      let lift = 0;
      if (kind === 'mat') {
        const gx = x % grid; const gy = y % grid;
        if (gx < 2 || gy < 2) lift = (x % (grid * 5) < 3 || y % (grid * 5) < 3) ? 70 : 34;
      }
      pixels[index * 3] = base[0] + shade * 0.8 + lift * 0.8;
      pixels[index * 3 + 1] = base[1] + shade + lift;
      pixels[index * 3 + 2] = base[2] + shade * 0.7 + lift * 0.7;
    }
  }
  return pixels;
}

function hologramOverlay(context, width, height, random) {
  const holo = context.createLinearGradient(0, 0, width, height);
  for (let stop = 0; stop <= 6; stop += 1) holo.addColorStop(stop / 6, `hsla(${stop * 60 + random() * 30},70%,70%,0.16)`);
  context.fillStyle = holo; context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(120,140,170,0.22)'; context.lineWidth = Math.max(1, width / 500);
  for (let line = 0; line < 42; line += 1) {
    context.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = height * (line / 42) + Math.sin(x / width * 14 + line * 0.7) * height * 0.03;
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
}

function cardTexture(width, height, {glyphDensity = 1, panel = false, plain = false, glare = false, edgeFade = null, tint = [228, 232, 229]} = {}, random) {
  const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext('2d', {willReadFrequently: true});
  context.fillStyle = `rgb(${tint.join(',')})`; context.fillRect(0, 0, width, height);
  if (!plain) hologramOverlay(context, width, height, random);
  // A printed design band whose colour is close to the surface at the card edge and fades
  // into the card body: that stretch of the card edge is soft and low-contrast.
  if (edgeFade) {
    const depth = (edgeFade.side === 'left' || edgeFade.side === 'right' ? width : height) * edgeFade.depth;
    const [x0, y0, x1, y1] = {left: [0, 0, depth, 0], right: [width, 0, width - depth, 0], top: [0, 0, 0, depth], bottom: [0, height, 0, height - depth]}[edgeFade.side];
    const band = context.createLinearGradient(x0, y0, x1, y1);
    band.addColorStop(0, `rgba(${edgeFade.color.join(',')},${edgeFade.alpha ?? 0.9})`); band.addColorStop(1, `rgba(${edgeFade.color.join(',')},0)`);
    context.fillStyle = band; context.fillRect(0, 0, width, height);
  }
  if (panel) { context.fillStyle = '#8f6c5c'; context.fillRect(width * 0.08, height * 0.12, width * 0.84, height * 0.76); }
  const photo = {x: width * 0.06, y: height * 0.24, w: width * 0.24, h: height * 0.6};
  const photoGradient = context.createLinearGradient(photo.x, photo.y, photo.x, photo.y + photo.h);
  photoGradient.addColorStop(0, '#9aa3ad'); photoGradient.addColorStop(1, '#5b6470');
  context.fillStyle = photoGradient; context.fillRect(photo.x, photo.y, photo.w, photo.h);
  for (let blob = 0; blob < 26; blob += 1) {
    context.fillStyle = `rgba(${40 + random() * 60},${40 + random() * 50},${50 + random() * 40},0.35)`;
    context.beginPath(); context.ellipse(photo.x + random() * photo.w, photo.y + random() * photo.h, photo.w * (0.05 + random() * 0.12), photo.h * (0.04 + random() * 0.1), random() * 3, 0, Math.PI * 2); context.fill();
  }
  const rows = Math.round(7 * glyphDensity);
  for (let row = 0; row < rows; row += 1) {
    const y = height * (0.14 + row * (0.72 / rows)); const glyphHeight = height * (row === 0 ? 0.075 : 0.045);
    let x = width * 0.36; const end = width * (0.62 + random() * 0.33);
    while (x < end) {
      const glyphWidth = glyphHeight * (0.5 + random() * 0.6);
      context.fillStyle = row === 0 ? '#17202b' : '#2b3644';
      for (let stroke = 0; stroke < 3; stroke += 1) {
        context.fillRect(x + random() * glyphWidth * 0.6, y + random() * glyphHeight * 0.6, Math.max(1.5, glyphWidth * (0.15 + random() * 0.5)), Math.max(1.5, glyphHeight * (0.12 + random() * 0.4)));
      }
      x += glyphWidth + glyphHeight * (random() < 0.2 ? 0.9 : 0.25);
    }
  }
  if (plain) return context.getImageData(0, 0, width, height);
  const emblem = context.createRadialGradient(width * 0.83, height * 0.74, 2, width * 0.83, height * 0.74, height * 0.16);
  emblem.addColorStop(0, 'rgba(255,220,180,0.45)'); emblem.addColorStop(0.5, 'rgba(160,220,255,0.30)'); emblem.addColorStop(1, 'rgba(200,255,200,0)');
  context.fillStyle = emblem; context.fillRect(0, 0, width, height);
  if (glare) {
    const spot = context.createRadialGradient(width * 0.92, height * 0.1, 2, width * 0.92, height * 0.1, height * 0.45);
    spot.addColorStop(0, 'rgba(255,255,255,0.85)'); spot.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = spot; context.fillRect(0, 0, width, height);
  }
  return context.getImageData(0, 0, width, height);
}

function solve(matrix, values) {
  const size = values.length; const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue; const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map(row => row[size]);
}

// Maps image coordinates back onto unit card coordinates (u, v in 0..1).
function inverseHomography(corners) {
  const unit = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}];
  const matrix = []; const values = [];
  for (let index = 0; index < 4; index += 1) {
    const {x, y} = corners[index]; const target = unit[index];
    matrix.push([x, y, 1, 0, 0, 0, -target.x * x, -target.x * y]); values.push(target.x);
    matrix.push([0, 0, 0, x, y, 1, -target.y * x, -target.y * y]); values.push(target.y);
  }
  const h = solve(matrix, values);
  return (x, y) => {
    const denominator = h[6] * x + h[7] * y + 1;
    return {u: (h[0] * x + h[1] * y + h[2]) / denominator, v: (h[3] * x + h[4] * y + h[5]) / denominator};
  };
}

function insideRoundedCard(u, v, aspect, radius) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  const px = u * aspect; const py = v;
  const cx = Math.min(Math.max(px, radius), aspect - radius); const cy = Math.min(Math.max(py, radius), 1 - radius);
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius;
}

// Card corners from margins (fractions of the image), then rotation about the
// card centre and a keystone (perspective) squeeze of one edge.
export function cardCorners({width, height, margins, rotation = 0, keystone = 0, keystoneAxis = 'top'}) {
  const left = width * margins.left; const right = width * (1 - margins.right);
  const top = height * margins.top; const bottom = height * (1 - margins.bottom);
  let points = [{x: left, y: top}, {x: right, y: top}, {x: right, y: bottom}, {x: left, y: bottom}];
  const squeeze = (right - left) * keystone / 2; const squeezeY = (bottom - top) * keystone / 2;
  if (keystoneAxis === 'top') { points[0].x += squeeze; points[1].x -= squeeze; }
  if (keystoneAxis === 'right') { points[1].y += squeezeY; points[2].y -= squeezeY; }
  const center = {x: (left + right) / 2, y: (top + bottom) / 2};
  const cos = Math.cos(rotation * Math.PI / 180); const sin = Math.sin(rotation * Math.PI / 180);
  points = points.map(point => ({x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin, y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos}));
  return points;
}

// A hand holding the card: the palm/arm enters from the photo edge nearest one card side
// and the thumb lies across that side, hiding part of the card edge.
function drawHoldingHand(context, corners, {side = 'left', at = .5, palm = .32, thumb = .16, tone = [222, 178, 146]}, width, height) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const [start, end] = {left: [bottomLeft, topLeft], right: [topRight, bottomRight], top: [topLeft, topRight], bottom: [bottomRight, bottomLeft]}[side];
  const center = corners.reduce((sum, point) => ({x: sum.x + point.x / 4, y: sum.y + point.y / 4}), {x: 0, y: 0});
  const sideLength = Math.hypot(end.x - start.x, end.y - start.y);
  const short = Math.min(Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y), Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y));
  const point = {x: start.x + (end.x - start.x) * at, y: start.y + (end.y - start.y) * at};
  let outward = {x: -(end.y - start.y) / sideLength, y: (end.x - start.x) / sideLength};
  if ((center.x - point.x) * outward.x + (center.y - point.y) * outward.y > 0) outward = {x: -outward.x, y: -outward.y};
  const reach = Math.hypot(width, height);
  context.save(); context.translate(point.x, point.y); context.rotate(Math.atan2(outward.y, outward.x));
  context.shadowColor = 'rgba(0,0,0,.35)'; context.shadowBlur = short * .04;
  const palmWidth = sideLength * palm; const overlap = short * .035;
  const shade = context.createLinearGradient(0, -palmWidth / 2, 0, palmWidth / 2);
  shade.addColorStop(0, `rgb(${tone.map(value => value - 38).join(',')})`); shade.addColorStop(.45, `rgb(${tone.join(',')})`); shade.addColorStop(1, `rgb(${tone.map(value => value - 52).join(',')})`);
  context.fillStyle = shade;
  context.beginPath(); context.moveTo(reach, -palmWidth / 2); context.lineTo(-overlap + palmWidth / 2, -palmWidth / 2);
  context.arc(-overlap + palmWidth / 2, 0, palmWidth / 2, -Math.PI / 2, Math.PI / 2, true); context.lineTo(reach, palmWidth / 2); context.closePath(); context.fill();
  const thumbLength = short * thumb * 2; const thumbWidth = short * .085;
  context.beginPath(); context.ellipse(-thumbLength * .38, -palmWidth * .18, thumbLength / 2, thumbWidth / 2, .08, 0, Math.PI * 2); context.fill();
  context.restore();
}

export async function renderScene({
  width = 1266, height = 680, seed = 1, surfaceKind = 'felt', cards = [],
  lighting = {left: 0.78, right: 1.12, top: 1.04, bottom: 0.94, hotspot: 0.12}, noise = 5, jpegQuality = 0.86, frame = null, focusBlur = 0, hand = null, holder = null,
} = {}) {
  const random = seededRandom(seed);
  const pixels = surface(width, height, surfaceKind, random);
  const shadowCanvas = new OffscreenCanvas(width, height); const shadowContext = shadowCanvas.getContext('2d', {willReadFrequently: true});
  shadowContext.shadowColor = 'rgba(0,0,0,1)'; shadowContext.shadowBlur = Math.round(width / 90); shadowContext.shadowOffsetX = 10000 + width / 260; shadowContext.shadowOffsetY = height / 110;
  for (const card of cards) {
    shadowContext.beginPath(); card.corners.forEach((point, index) => index ? shadowContext.lineTo(point.x - 10000, point.y) : shadowContext.moveTo(point.x - 10000, point.y)); shadowContext.closePath(); shadowContext.fill();
  }
  const shadow = shadowContext.getImageData(0, 0, width, height).data;
  // A dark woven wallet (or similar holder) under the card, larger than it and possibly
  // running off the photo edge; its lower part is close to a dark surface in colour.
  const holderInverse = holder ? inverseHomography(holder.corners) : null;
  const textures = cards.map(card => {
    const textureWidth = 960; const textureHeight = Math.round(textureWidth / card.aspect);
    const xs = card.corners.map(point => point.x); const ys = card.corners.map(point => point.y);
    const bounds = {left: Math.min(...xs) - 2, right: Math.max(...xs) + 2, top: Math.min(...ys) - 2, bottom: Math.max(...ys) + 2};
    return {card, bounds, texture: cardTexture(textureWidth, textureHeight, card, random), textureWidth, textureHeight, inverse: inverseHomography(card.corners)};
  });
  const output = new ImageData(width, height);
  const hotX = width * 0.7; const hotY = height * 0.25; const hotSigma = width * 0.3;
  const subsamples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x; const gain = (lighting.left + (lighting.right - lighting.left) * x / width) * (lighting.top + (lighting.bottom - lighting.top) * y / height)
        + lighting.hotspot * Math.exp(-((x - hotX) ** 2 + (y - hotY) ** 2) / (2 * hotSigma * hotSigma));
      const shade = 1 - (shadow[index * 4 + 3] / 255) * 0.42;
      let rgb = [pixels[index * 3] * shade, pixels[index * 3 + 1] * shade, pixels[index * 3 + 2] * shade];
      if (holderInverse) {
        const {u, v} = holderInverse(x + .5, y + .5);
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          // Woven leather: diamond tiles with a sheen gradient and bright ridges, a lighter rim.
          const tileU = (u * 26 + v * 34) % 2; const tileV = (u * 26 - v * 34 + 40) % 2;
          const weave = Math.abs(tileU - 1) < .12 || Math.abs(tileV - 1) < .12;
          const sheen = (holder.sheen ?? 0) * Math.max(0, Math.sin(tileU * Math.PI)) * Math.max(0, Math.sin(tileV * Math.PI)) * (1.2 - v);
          const tone = (holder.tone ?? 24) + (weave ? 16 + (holder.sheen ?? 0) * .3 : 0) + sheen * .45 + (u < .015 || u > .985 || v < .02 || v > .98 ? 18 + (holder.sheen ?? 0) * .3 : 0);
          const hue = holder.color ?? [1, 1, 1.12];
          rgb = [tone * hue[0] * shade, tone * hue[1] * shade, tone * hue[2] * shade];
        }
      }
      if (frame && Math.min(x, y, width - 1 - x, height - 1 - y) < Math.min(width, height) * frame.thickness) rgb = [...frame.color];
      for (const {card, bounds, texture, textureWidth, textureHeight, inverse} of textures) {
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
        let covered = 0; const sum = [0, 0, 0];
        for (const [ox, oy] of subsamples) {
          const {u, v} = inverse(x + ox, y + oy);
          if (!insideRoundedCard(u, v, card.aspect, card.radius ?? 0.06)) continue;
          const tx = Math.min(textureWidth - 1, Math.max(0, Math.round(u * (textureWidth - 1)))); const ty = Math.min(textureHeight - 1, Math.max(0, Math.round(v * (textureHeight - 1))));
          const offset = (ty * textureWidth + tx) * 4; covered += 1;
          sum[0] += texture.data[offset]; sum[1] += texture.data[offset + 1]; sum[2] += texture.data[offset + 2];
        }
        if (covered) {
          const weight = covered / 4;
          rgb = rgb.map((value, channel) => value * (1 - weight) + (sum[channel] / covered) * weight);
        }
      }
      for (let channel = 0; channel < 3; channel += 1) {
        const jitter = (random() + random() + random() - 1.5) * noise;
        output.data[index * 4 + channel] = Math.max(0, Math.min(255, Math.round(rgb[channel] * gain + jitter)));
      }
      output.data[index * 4 + 3] = 255;
    }
  }
  let canvas = new OffscreenCanvas(width, height); canvas.getContext('2d').putImageData(output, 0, 0);
  if (hand && cards.length) drawHoldingHand(canvas.getContext('2d'), cards[0].corners, hand, width, height);
  if (focusBlur) {
    const soft = new OffscreenCanvas(width, height); const softContext = soft.getContext('2d');
    softContext.filter = `blur(${focusBlur}px)`; softContext.drawImage(canvas, 0, 0); canvas = soft;
  }
  if (!jpegQuality) return canvas;
  const blob = await canvas.convertToBlob({type: 'image/jpeg', quality: jpegQuality});
  const bitmap = await createImageBitmap(blob);
  const encoded = new OffscreenCanvas(width, height); encoded.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close?.();
  return encoded;
}

// Wallet-like ID-1 card: 85.60 x 53.98 mm with ~3.2 mm corner radius.
export const ID_CARD_ASPECT = 85.6 / 53.98;

export function walletCard(options) {
  return {aspect: ID_CARD_ASPECT, radius: 0.059, ...options, corners: cardCorners(options)};
}

// Randomised wallet-card photo within the envelope of the reported failure: landscape
// frame, card close to the top/bottom edges, wider left margin, mild rotation and
// perspective, textured green-family surface with uneven light.
export function randomWalletScene(seed, {width = 1266, height = 680} = {}) {
  const random = seededRandom(seed * 7919 + 17);
  const pick = (low, high) => low + (high - low) * random();
  const kinds = ['felt', 'olive', 'mat', 'strong'];
  const margins = {left: pick(.08, .2), right: pick(.03, .08), top: pick(.02, .05), bottom: pick(.02, .05)};
  const tints = [[228, 232, 229], [205, 228, 210], [212, 222, 236], [236, 216, 220], [238, 236, 226]];
  const options = {width, height, margins, rotation: pick(-3, 3), keystone: pick(0, .06), keystoneAxis: random() < .7 ? 'top' : 'right', glyphDensity: pick(.8, 2), tint: tints[Math.floor(random() * tints.length)], glare: random() < .3};
  // Keep every corner at least 1% inside the frame, like the reported photo.
  const inFrame = corners => corners.every(point => point.x >= width * .01 && point.x <= width * .99 && point.y >= height * .01 && point.y <= height * .99);
  for (let attempt = 0; attempt < 6 && !inFrame(cardCorners(options)); attempt += 1) options.rotation /= 2;
  const card = walletCard(options);
  const left = pick(.55, .9); const right = pick(1.0, 1.25);
  return {
    width, height, seed, surfaceKind: kinds[Math.floor(random() * kinds.length)], cards: [card],
    lighting: random() < .5 ? {left, right, top: pick(.95, 1.1), bottom: pick(.85, 1.0), hotspot: pick(0, .22)} : {left: right, right: left, top: pick(.85, 1.0), bottom: pick(.95, 1.1), hotspot: pick(0, .22)},
    noise: pick(3, 8), jpegQuality: pick(.7, .92), focusBlur: random() < .35 ? pick(.6, 1.6) : 0,
  };
}

// The reported production failure: a textured surface whose texture is about as sharp as
// part of the card edge, where a printed band close to the surface colour softens one
// side. Scenes are 1440x811 like the reported photo.
export function softEdgeWalletScene(index) {
  const random = seededRandom(900 + index);
  const base = randomWalletScene(500 + index, {width: 1440, height: 811});
  const tint = [[196, 214, 198], [205, 222, 206], [188, 206, 190], [214, 226, 214]][index % 4];
  const edgeFade = {side: ['left', 'bottom', 'right', 'top'][index % 4], depth: .25 + random() * .2, alpha: .75 + random() * .2, color: [[96, 128, 84], [110, 140, 96], [84, 120, 80], [120, 146, 104]][(index >> 2) % 4]};
  const card = walletCard({width: 1440, height: 811, margins: {left: .15 + random() * .06, right: .08 + random() * .04, top: .06 + random() * .03, bottom: .06 + random() * .03}, rotation: (random() - .5) * 4, keystone: random() * .05, tint, glare: random() < .3, edgeFade});
  return {...base, width: 1440, height: 811, cards: [card], surfaceKind: ['strong', 'olive', 'felt', 'strong'][index % 4], focusBlur: 1.2 + random() * 1.2, noise: 6 + random() * 4};
}

// A card held in the hand: the palm enters from the photo edge and the thumb lies across
// one card side. Alternates landscape and portrait phone photos.
export function handHeldWalletScene(index) {
  const random = seededRandom(700 + index); const portrait = index % 2 === 0;
  const width = portrait ? 900 : 1266; const height = portrait ? 1200 : 680;
  const side = ['left', 'right', 'bottom', 'left'][index % 4];
  const margins = portrait ? {left: .03 + random() * .05, right: .03 + random() * .05, top: .25 + random() * .08, bottom: .25 + random() * .08} : {left: .12 + random() * .06, right: .06 + random() * .05, top: .05 + random() * .04, bottom: .05 + random() * .04};
  const card = walletCard({width, height, margins, rotation: (random() - .5) * 6, keystone: random() * .05, keystoneAxis: 'top', tint: [[228, 232, 229], [212, 222, 236], [238, 236, 226]][index % 3]});
  const base = randomWalletScene(300 + index, {width, height});
  return {...base, width, height, cards: [card], hand: {side, at: .35 + random() * .3, palm: .22 + random() * .18, thumb: .12 + random() * .08, tone: [[222, 178, 146], [196, 150, 120], [236, 196, 170]][index % 3]}};
}

// The reported hand-held photo class: a card lying on a dark woven wallet held in the hand
// over a dark fabric surface, phone portrait frame. The wallet top runs above the card and
// its left part off the photo edge; fingers enter at a lower corner.
export function cardOnWalletScene(index) {
  const random = seededRandom(1100 + index); const width = 900; const height = 1200;
  const card = walletCard({width, height, margins: {left: .07 + random() * .05, right: .04 + random() * .04, top: .31 + random() * .04, bottom: .24 + random() * .04}, rotation: (random() - .5) * 3, keystone: random() * .03, keystoneAxis: 'top', tint: [[236, 228, 230], [232, 230, 222], [226, 230, 236]][index % 3]});
  const [topLeft, topRight, bottomRight, bottomLeft] = card.corners;
  // The wallet runs off the left photo edge, rises well above the card and ends below it.
  const top = Math.min(topLeft.y, topRight.y) - height * (.08 + random() * .05); const bottom = Math.max(bottomLeft.y, bottomRight.y) + height * (.1 + random() * .06);
  const left = -width * .03; const right = Math.max(topRight.x, bottomRight.x) + width * (.02 + random() * .03);
  const tilt = (random() - .5) * height * .02;
  const holderCorners = [{x: left, y: top - tilt}, {x: right, y: top + tilt}, {x: right, y: bottom + tilt}, {x: left, y: bottom - tilt}];
  const base = randomWalletScene(1300 + index, {width, height});
  return {...base, width, height, surfaceKind: 'navy', lighting: {left: .9 + random() * .2, right: .9 + random() * .2, top: 1.05, bottom: .9, hotspot: .08}, cards: [card], holder: {corners: holderCorners, tone: 10 + Math.round(random() * 8), sheen: index % 3 === 0 ? 30 : 55 + Math.round(random() * 35), color: index % 4 === 3 ? [3.4, 2.3, 1.6] : undefined}, hand: index % 2 ? {side: 'bottom', at: .9 + random() * .08, palm: .2, thumb: .06, tone: [[222, 178, 146], [196, 150, 120], [236, 196, 170]][index % 3]} : null};
}
