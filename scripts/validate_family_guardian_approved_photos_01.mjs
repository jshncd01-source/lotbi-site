// FAMILY-GUARDIAN-APPROVED-PHOTOS-01
// The person's guide photos must remain byte-identical to the user's approved
// 2026-10-13 source sheets. The UI may crop those pixels, but may not repaint,
// redraw, or replace them with an illustration.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath));
const text = relativePath => read(relativePath).toString('utf8');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const approvedSources = Object.freeze({
  before: Object.freeze({
    path: 'assets/family-guardian/approved-person-examples-before-20261013.png',
    width: 1485,
    height: 1059,
    sha256: '97dfdfad4116478f11a4dc5ef684584398dd6cc7a886a7196988d83259f80611',
  }),
  ten: Object.freeze({
    path: 'assets/family-guardian/approved-person-examples-ten-20261013.png',
    width: 1484,
    height: 1060,
    sha256: '45c7165cd0c95fedd02c03197e5b2743e16f11e9d328b52d255c9b9244f6c7db',
  }),
});

const petSources = Object.freeze({
  dogRequired: Object.freeze({
    path: 'assets/family-guardian/approved-pet-dog-required-bichon-20261013.png',
    width: 1536,
    height: 1024,
    sha256: 'ee4df0bb6f2ce142b148c9be6e8630af1a75bb342cfedadbf83932cb9305e525',
  }),
  dogOptional: Object.freeze({
    path: 'assets/family-guardian/approved-pet-dog-optional-bichon-20261013.png',
    width: 1536,
    height: 1024,
    sha256: '492c9d3e65ff0369c2d626b63bcecd8614cec30d04fafdb3aa5d1b0815af6b9c',
  }),
  catRequired: Object.freeze({
    path: 'assets/family-guardian/approved-pet-cat-required-20261013.png',
    width: 1536,
    height: 1024,
    sha256: '4c182f99c0a0400e3a3d4a97abbfd3426d6f8bb3e18fa4a89bd10bbeeb5327cf',
  }),
  catOptional: Object.freeze({
    path: 'assets/family-guardian/approved-pet-cat-optional-20261013.png',
    width: 1536,
    height: 1024,
    sha256: '43fc043457495972ab4274a87389f8786ef915568dc68f09f5a524abf813ac8c',
  }),
});

for (const source of Object.values(approvedSources)) {
  const bytes = read(source.path);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.readUInt32BE(16), source.width);
  assert.equal(bytes.readUInt32BE(20), source.height);
  assert.equal(sha256(bytes), source.sha256, `${source.path} must remain byte-identical to the approved original`);
}
for (const source of Object.values(petSources)) {
  const bytes = read(source.path);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.readUInt32BE(16), source.width);
  assert.equal(bytes.readUInt32BE(20), source.height);
  assert.equal(sha256(bytes), source.sha256, `${source.path} must remain the reviewed virtual-pet sheet`);
}

const guideModule = await import(`${pathToFileURL(path.join(root, 'site-person-guides.js')).href}?approved=20261013`);
const {PERSON_APPROVED_EXAMPLE_CROPS, PERSON_IDENTITY_SLOTS, PERSON_REQUIRED_EXAMPLE_SLOTS} = guideModule;
const expected = Object.freeze({
  FACE_FRONT: [approvedSources.before.path, '350 471 194 197'],
  FACE_LEFT_45: [approvedSources.before.path, '558 471 195 197'],
  FACE_RIGHT_45: [approvedSources.before.path, '768 471 190 197'],
  UPPER_BODY_FRONT: [approvedSources.before.path, '972 471 203 197'],
  FULL_BODY_FRONT: [approvedSources.before.path, '1190 471 204 197'],
  FACE_LEFT_PROFILE: [approvedSources.ten.path, '342 596 192 165'],
  FACE_RIGHT_PROFILE: [approvedSources.ten.path, '552 596 195 165'],
  FACE_FRONT_ALT: [approvedSources.ten.path, '763 596 193 165'],
  FACE_LEFT_ALT: [approvedSources.ten.path, '969 596 205 165'],
  FACE_RIGHT_ALT: [approvedSources.ten.path, '1190 596 210 165'],
});

assert.deepEqual(Object.keys(PERSON_APPROVED_EXAMPLE_CROPS).sort(), Object.keys(expected).sort());
for (const [code, [sheet, viewBox]] of Object.entries(expected)) {
  assert.equal(PERSON_APPROVED_EXAMPLE_CROPS[code].sheet, sheet, `${code} must use the approved source sheet`);
  assert.equal(PERSON_APPROVED_EXAMPLE_CROPS[code].viewBox, viewBox, `${code} crop must stay reviewed`);
}
assert.deepEqual(
  PERSON_REQUIRED_EXAMPLE_SLOTS.map(slot => slot.code),
  ['FACE_FRONT', 'FACE_LEFT_45', 'FACE_RIGHT_45', 'UPPER_BODY_FRONT', 'FULL_BODY_FRONT'],
  'registration must ask for the approved five-photo set, not ten required photos',
);
assert.ok(PERSON_IDENTITY_SLOTS.every(slot => slot.example === PERSON_APPROVED_EXAMPLE_CROPS[slot.code]), 'every person slot must use an approved photo crop');

const guides = text('site-person-guides.js');
assert.ok(!guides.includes('assets/safecare/person-'), 'person guides must not fall back to the removed illustrations');
const ui = text('site-person-ui.js');
assert.match(ui, /media\.replaceChildren\(image\)/, 'a registered user photo must replace the guide photo');
const css = text('site-safecare.css');
const cssBlock = css.match(/\.person-slot-guide-image\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
assert.ok(cssBlock, 'approved person-photo CSS block must exist');
assert.ok(!/padding|filter|drop-shadow|object-fit/u.test(cssBlock), 'approved photos must not be restyled as padded illustrations');

const petGuideModule = await import(`${pathToFileURL(path.join(root, 'site-pet-guides.js')).href}?approved=20261013`);
const {PET_APPROVED_EXAMPLE_CROPS} = petGuideModule;
assert.equal(PET_APPROVED_EXAMPLE_CROPS.DOG.FACE_FRONT.sheet, petSources.dogRequired.path);
assert.equal(PET_APPROVED_EXAMPLE_CROPS.DOG.BACK_REAR.sheet, petSources.dogOptional.path);
assert.equal(PET_APPROVED_EXAMPLE_CROPS.CAT.FACE_FRONT.sheet, petSources.catRequired.path);
assert.equal(PET_APPROVED_EXAMPLE_CROPS.CAT.BACK_REAR.sheet, petSources.catOptional.path);
assert.equal(Object.keys(PET_APPROVED_EXAMPLE_CROPS.DOG).length, 10);
assert.equal(Object.keys(PET_APPROVED_EXAMPLE_CROPS.CAT).length, 10);
const petGuides = text('site-pet-guides.js');
assert.ok(!petGuides.includes('assets/pet/${species.toLowerCase()}'), 'drawn pet artwork must not return to registration');
const petUi = text('site-pet-ui.js');
assert.match(petUi, /PET_REQUIRED_EXAMPLE_SLOTS\.forEach/);
assert.match(petUi, /PET_OPTIONAL_EXAMPLE_SLOTS\.forEach/);
assert.match(petUi, /인식을 돕는 사진 더 추가하기 \(선택\)/);
assert.match(petUi, /approvedPetSpeciesPhoto\(value\)/, 'pet species selector must use the approved dog/cat photos');
assert.ok(!petUi.includes("['DOG', '🐶', '강아지']"), 'emoji species cards must not return');
const petCss = text('site-pet.css');
const petCssBlock = petCss.match(/\.pet-slot-guide-image\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
assert.ok(petCssBlock);
assert.ok(!/padding|filter|drop-shadow|object-fit/u.test(petCssBlock), 'virtual-pet photos must not be restyled as drawings');

const workflow = text('.github/workflows/site-review.yml');
assert.ok(workflow.includes('node scripts/validate_family_guardian_approved_photos_01.mjs'), 'approved-photo validation must run in the Site gate');

console.log('FAMILY-GUARDIAN-APPROVED-PHOTOS-01 PASS');
