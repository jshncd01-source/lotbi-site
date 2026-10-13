import assert from 'node:assert/strict';

const expectedSlots = Object.freeze([
  'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT',
  'BACK_REAR', 'NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'DISTINCTIVE',
]);

class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.className = '';
    this.children = [];
    this.dataset = {};
    this.style = {};
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = String(value); }
}

globalThis.document = {
  createElement: tagName => new FakeNode(tagName),
  createElementNS: (_namespace, tagName) => new FakeNode(tagName),
};

const {PET_APPROVED_EXAMPLE_CROPS, petPhotoSlotArtwork} = await import('../site-pet-guides.js');
for (const species of ['DOG', 'CAT']) {
  assert.deepEqual(Object.keys(PET_APPROVED_EXAMPLE_CROPS[species]), expectedSlots, `${species} ten-slot photo map`);
  for (const slotCode of expectedSlots) {
    const example = PET_APPROVED_EXAMPLE_CROPS[species][slotCode];
    assert.match(example.sheet, /^assets\/family-guardian\/approved-pet-(dog|cat)-/);
    assert.equal(example.sheetWidth, 1536);
    assert.equal(example.sheetHeight, 1024);
    assert.match(example.viewBox, /^\d+ \d+ \d+ \d+$/);

    const artwork = petPhotoSlotArtwork(slotCode, species);
    assert.equal(artwork.tagName, 'SPAN');
    assert.equal(artwork.className, 'pet-slot-guide-image');
    assert.equal(artwork.role, 'img');
    assert.match(artwork['aria-label'], /가상 반려동물 예시 사진$/);
    assert.equal(artwork.dataset.petApprovedSource, example.sheet);
    assert.equal(artwork.style.backgroundImage, `url("${example.sheet}")`);
    assert.match(artwork.style.backgroundSize, /^.+% .+%$/);
    assert.match(artwork.style.backgroundPosition, /^.+% .+%$/);
  }
}

assert.match(PET_APPROVED_EXAMPLE_CROPS.DOG.FACE_FRONT.sheet, /dog-required-bichon/,
  'dog example must be the small white Bichon requested by the user');
assert.ok(!PET_APPROVED_EXAMPLE_CROPS.DOG.FACE_FRONT.sheet.startsWith('assets/pet/'),
  'drawn pet guides must not return to the family registration screen');

console.log('PET-SLOT-GUIDE-ART-01 PASS');
