// Synthetic router-label photos for LIFE-WALLET-WIFI-CARD-01: a light printed label stuck on a
// dark router body, the router on a wooden desk next to a keyboard (dark key caps with light
// legends), shot slightly turned. Nothing here is a real photo.
import {cardCorners, renderScene, seededRandom} from './life-wallet-scan-scenes.mjs';

export const KEYBOARD_BASE = [34, 36, 42];
export const KEYCAP = [62, 64, 72];
export const ROUTER_BODY = [78, 80, 88];
export const LABEL_TINT = [244, 244, 240];
// Blue print, so the checks can tell the label's own ink from the dark keyboard and router body.
export const LABEL_INK = '#1a2a8a';

function trace(context, points) {
  points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))); context.closePath();
}

function polygon(context, points) { context.beginPath(); trace(context, points); }

function grow(points, factor) {
  const center = points.reduce((sum, point) => ({x: sum.x + point.x / 4, y: sum.y + point.y / 4}), {x: 0, y: 0});
  return points.map(point => ({x: center.x + (point.x - center.x) * factor, y: center.y + (point.y - center.y) * factor}));
}

function keyboard(context, left, top, right, bottom, random) {
  context.fillStyle = `rgb(${KEYBOARD_BASE.join(',')})`; context.fillRect(left, top, right - left, bottom - top);
  const key = 64; const gap = 12;
  for (let y = top + gap; y + key < bottom; y += key + gap) {
    for (let x = left + gap + ((y / (key + gap)) % 2) * 18; x + key < right; x += key + gap) {
      context.fillStyle = `rgb(${KEYCAP.join(',')})`; context.fillRect(x, y, key, key);
      context.fillStyle = 'rgb(214,216,222)';
      const strokes = 1 + Math.floor(random() * 3);
      for (let s = 0; s < strokes; s += 1) context.fillRect(x + 14 + s * 12, y + 16, 5, 20 + random() * 12);
    }
  }
}

/**
 * {canvas, corners, aspect}: a 1600x1100 photo. `turned` lays the label on its side (portrait).
 * `rotation` tilts it a few degrees, `far` makes it small, `body: false` leaves out the router body,
 * `label: false` leaves out the label (a photo with no label to find).
 */
export async function routerLabelScene({seed = 3, rotation = 4, turned = false, far = false, body = true, label = true, width = 1600, height = 1100} = {}) {
  const random = seededRandom(seed);
  const margins = far ? {left: .44, right: .44, top: .46, bottom: .47} : turned ? {left: .4, right: .4, top: .2, bottom: .2} : {left: .25, right: .25, top: .36, bottom: .36};
  const corners = cardCorners({width, height, margins, rotation});
  const across = width * (1 - margins.left - margins.right); const down = height * (1 - margins.top - margins.bottom);
  const aspect = turned ? down / across : across / down;
  // The label texture is drawn landscape; a turned label is a landscape label whose corners run
  // around the portrait outline starting from a side corner.
  const labelCorners = turned ? [corners[3], corners[0], corners[1], corners[2]] : corners;
  const scene = await renderScene({width, height, seed, surfaceKind: 'desk', noise: 4, jpegQuality: 0,
    cards: label ? [{corners: labelCorners, aspect, radius: 0.012, tint: LABEL_TINT, ink: LABEL_INK}] : []});
  const context = scene.getContext('2d');
  context.save();
  // Everything below is drawn around the label only (the frame minus the label outline).
  context.beginPath(); context.rect(0, 0, width, height); trace(context, corners); context.clip('evenodd');
  keyboard(context, 0, 0, width, height * 0.27, random);
  keyboard(context, 0, height * 0.8, width, height, random);
  if (body) { context.fillStyle = `rgb(${ROUTER_BODY.join(',')})`; polygon(context, grow(corners, 1.35)); context.fill(); }
  context.restore();
  const blob = await scene.convertToBlob({type: 'image/jpeg', quality: 0.9});
  return {blob, corners, aspect, width, height};
}

/** Share of `pixels` (RGBA) in a ring `ring` px wide along the edges that look like the scene's background. */
export function borderBackgroundShare(imageData, ring = 3) {
  const {width, height, data} = imageData;
  let total = 0; let background = 0; let minLuma = 255;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= ring && y >= ring && x < width - ring && y < height - ring) continue;
      const offset = (y * width + x) * 4;
      const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b; const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      total += 1; minLuma = Math.min(minLuma, luma);
      // Keyboard, key caps and router body are dark; the desk is a saturated light brown.
      if (luma < 150 || (chroma > 40 && r > b + 30)) background += 1;
    }
  }
  return {share: total ? background / total : 1, minLuma: Math.round(minLuma), total};
}
