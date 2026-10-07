import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slots = Object.freeze({
  FACE_FRONT: 'face-front',
  FACE_LEFT: 'face-left',
  FACE_RIGHT: 'face-right',
  BODY_LEFT: 'body-left',
  BODY_RIGHT: 'body-right',
  BACK_REAR: 'back-rear',
  NOSE_FRONT: 'nose-front',
  NOSE_LEFT: 'nose-left',
  NOSE_RIGHT: 'nose-right',
  DISTINCTIVE: 'distinctive',
});

function pngInfo(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', 'asset must be PNG');
  assert.equal(bytes.readUInt32BE(12), 0x49484452, 'asset must contain IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

// PET-PHOTO-GUIDE-DEDUPE-01 — the tiles show the art at about 150 CSS px, so
// the page loads a 480 px WebP made from each 1254 px PNG master (the masters
// stay in the repo as the source). Extended format so the alpha survives.
function webpInfo(bytes) {
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', 'asset must be RIFF');
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', 'asset must be WebP');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'VP8X', 'asset must use the extended WebP header');
  return {
    alpha: Boolean(bytes[20] & 0x10),
    width: bytes.readUIntLE(24, 3) + 1,
    height: bytes.readUIntLE(27, 3) + 1,
  };
}

const expected = {};
for (const species of ['DOG', 'CAT']) {
  for (const [slotCode, fileName] of Object.entries(slots)) {
    const relativePath = `assets/pet/${species.toLowerCase()}-${fileName}-v1.png`;
    const bytes = await readFile(path.join(root, relativePath));
    const info = pngInfo(bytes);
    assert.equal(info.width, 1254, `${relativePath} width`);
    assert.equal(info.height, 1254, `${relativePath} height`);
    assert.ok(info.colorType === 4 || info.colorType === 6, `${relativePath} must preserve alpha`);
    assert.ok(bytes.length >= 80_000, `${relativePath} must be finished artwork`);
    const displayPath = `assets/pet/${species.toLowerCase()}-${fileName}-v2.webp`;
    expected[`${species}:${slotCode}`] = displayPath;
    const display = await readFile(path.join(root, displayPath));
    const displayInfo = webpInfo(display);
    assert.equal(displayInfo.width, 480, `${displayPath} width`);
    assert.equal(displayInfo.height, 480, `${displayPath} height`);
    assert.ok(displayInfo.alpha, `${displayPath} must preserve alpha`);
    assert.ok(display.length >= 10_000, `${displayPath} must be finished artwork`);
    assert.ok(display.length <= 120_000, `${displayPath} must stay light enough for the ten-tile step`);
  }
  assert.notEqual(expected[`${species}:FACE_LEFT`], expected[`${species}:FACE_FRONT`]);
  assert.notEqual(expected[`${species}:FACE_RIGHT`], expected[`${species}:FACE_FRONT`]);
}

class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.className = '';
    this.children = [];
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = String(value); }
  replaceWith(node) { this.replacement = node; }
}

globalThis.document = {
  createElement: tagName => new FakeNode(tagName),
  createElementNS: (_namespace, tagName) => new FakeNode(tagName),
};

const {PET_SLOT_ARTWORK, petPhotoSlotArtwork} = await import('../site-pet-guides.js');
assert.deepEqual(PET_SLOT_ARTWORK, expected, 'slot/species artwork mapping');

for (const [key, src] of Object.entries(expected)) {
  const [species, slotCode] = key.split(':');
  const artwork = petPhotoSlotArtwork(slotCode, species);
  assert.equal(artwork.tagName, 'IMG');
  assert.equal(artwork.className, 'pet-slot-guide-image');
  assert.equal(artwork.src, src);
  assert.equal(artwork.alt, `${slots[slotCode] ? {
    FACE_FRONT: '얼굴 정면', FACE_LEFT: '얼굴 왼쪽', FACE_RIGHT: '얼굴 오른쪽',
    BODY_LEFT: '몸 왼쪽', BODY_RIGHT: '몸 오른쪽', BACK_REAR: '뒷모습',
    NOSE_FRONT: '코 정면', NOSE_LEFT: '코 왼쪽', NOSE_RIGHT: '코 오른쪽', DISTINCTIVE: '특징 부위',
  }[slotCode] : slotCode} 촬영 예시`);
  assert.equal(artwork.loading, 'eager', 'the ten small examples load with the step');
  assert.equal(artwork.decoding, 'async');
  assert.equal(typeof artwork.onerror, 'function', 'missing asset must retain SVG fallback');
  artwork.onerror();
  assert.equal(artwork.replacement?.tagName, 'SVG', 'load failure must replace artwork with SVG');
}

console.log('PET-SLOT-GUIDE-ART-01 PASS');
