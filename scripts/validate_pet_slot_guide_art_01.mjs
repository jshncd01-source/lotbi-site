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

const expected = {};
for (const species of ['DOG', 'CAT']) {
  for (const [slotCode, fileName] of Object.entries(slots)) {
    const relativePath = `assets/pet/${species.toLowerCase()}-${fileName}-v1.png`;
    expected[`${species}:${slotCode}`] = relativePath;
    const bytes = await readFile(path.join(root, relativePath));
    const info = pngInfo(bytes);
    assert.equal(info.width, 1254, `${relativePath} width`);
    assert.equal(info.height, 1254, `${relativePath} height`);
    assert.ok(info.colorType === 4 || info.colorType === 6, `${relativePath} must preserve alpha`);
    assert.ok(bytes.length >= 80_000, `${relativePath} must be finished artwork`);
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
  assert.equal(artwork.loading, 'lazy');
  assert.equal(artwork.decoding, 'async');
  assert.equal(typeof artwork.onerror, 'function', 'missing asset must retain SVG fallback');
  artwork.onerror();
  assert.equal(artwork.replacement?.tagName, 'SVG', 'load failure must replace artwork with SVG');
}

console.log('PET-SLOT-GUIDE-ART-01 PASS');
