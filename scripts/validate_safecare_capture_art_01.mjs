import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = Object.freeze({
  person: 'assets/safecare/person-capture-guide-v1.png',
  dog: 'assets/safecare/dog-capture-guide-v1.png',
  cat: 'assets/safecare/cat-capture-guide-v1.png',
});

function pngSize(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', 'asset must be a PNG');
  assert.equal(bytes.readUInt32BE(12), 0x49484452, 'asset must contain an IHDR header');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

for (const [kind, relativePath] of Object.entries(expected)) {
  const bytes = await readFile(path.join(root, relativePath));
  const image = pngSize(bytes);
  assert.ok(image.width >= 768 && image.height >= 768, `${kind} guide must be at least 768px square`);
  assert.ok(image.colorType === 4 || image.colorType === 6, `${kind} guide must preserve transparency`);
  assert.ok(bytes.length >= 80_000, `${kind} guide must be a finished illustration, not a placeholder`);
}

class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.className = '';
    this.dataset = {};
    this.children = [];
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = String(value); }
}

globalThis.document = {
  createElement: tagName => new FakeNode(tagName),
  createElementNS: (_namespace, tagName) => new FakeNode(tagName),
};
const {createSafeCareGuideArtwork, SAFECARE_GUIDE_ART} = await import('../site-safecare-guide-art.js');

assert.deepEqual(SAFECARE_GUIDE_ART, expected, 'the shared guide map must cover person, dog, and cat');
for (const kind of Object.keys(expected)) {
  const node = createSafeCareGuideArtwork(kind);
  assert.equal(node.tagName, 'IMG');
  assert.equal(node.className, 'safecare-guide-art');
  assert.equal(node.src, expected[kind]);
  assert.equal(node.alt, '');
  assert.equal(node.decoding, 'async');
  assert.equal(node.loading, 'eager');
  assert.equal(node.fetchPriority, 'high');
  assert.equal(node.width, 112);
  assert.equal(node.height, 112);
}

const {petPhotoSlotDiagram} = await import('../site-pet-guides.js');
for (const species of ['DOG', 'CAT']) {
  for (const slot of ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT', 'NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'DISTINCTIVE']) {
    const diagram = petPhotoSlotDiagram(slot, species);
    const text = diagram.children.map(child => child.textContent || '').join('');
    const paths = diagram.children.filter(child => child.tagName === 'PATH');
    assert.ok(paths.length >= 2, `${species} ${slot} must render a purposeful vector diagram`);
    assert.ok(!/[🐶🐱🐕🐈]/u.test(text), `${species} ${slot} must not fall back to emoji art`);
  }
}
const noseDiagram = petPhotoSlotDiagram('NOSE_FRONT', 'DOG');
const largeNoseEllipses = noseDiagram.children.filter(child => child.tagName === 'ELLIPSE' && Number(child.rx) >= 5);
assert.ok(largeNoseEllipses.length >= 1, 'nose guidance must include a magnified callout');
assert.ok(largeNoseEllipses.every(child => child.class === 'pet-slot-guide-callout'), 'large callouts must stay outlined instead of becoming solid blobs');

const {PERSON_IDENTITY_SLOTS, personSlotArtwork} = await import('../site-person-guides.js');

const expectedPersonSlotArtwork = [
  'assets/safecare/person-face-front-v1.png',
  'assets/safecare/person-face-left-45-v1.png',
  'assets/safecare/person-face-right-45-v1.png',
  'assets/safecare/person-face-left-profile-v1.png',
  'assets/safecare/person-face-right-profile-v1.png',
  'assets/safecare/person-upper-body-front-v1.png',
  'assets/safecare/person-full-body-front-v1.png',
  'assets/safecare/person-face-front-alt-v1.png',
  'assets/safecare/person-face-left-alt-v1.png',
  'assets/safecare/person-face-right-alt-v1.png',
];
for (const [index, slot] of PERSON_IDENTITY_SLOTS.entries()) {
  const artwork = personSlotArtwork(slot);
  assert.equal(artwork.tagName, 'IMG', `${slot.code} must use a finished image instead of a tiny line icon`);
  assert.equal(artwork.className, 'person-slot-guide-image');
  assert.equal(artwork.src, expectedPersonSlotArtwork[index]);
  assert.equal(artwork.alt, `${slot.label} 촬영 예시`);
  assert.equal(artwork.decoding, 'async');
}

console.log('SAFECARE-CAPTURE-ART-01 PASS');
