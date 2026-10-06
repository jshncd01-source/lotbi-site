// SAFECARE-HUMAN-PHOTO-INTAKE-GATE-01 — Site side of the identity-photo gate.
//
// Core decides whether a photo is a usable identity photo for the slot. The
// Site must (1) say "checking" while Core decides, (2) say "saved" only after
// Core accepted it, (3) turn every refusal code into a sentence the guardian
// can act on without exposing scores or model details, and (4) show guide art
// whose head direction matches the slot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const REFUSALS = [
  'PERSON_IDENTITY_PHOTO_NON_IDENTITY_IMAGE',
  'PERSON_IDENTITY_PHOTO_NO_PERSON',
  'PERSON_IDENTITY_PHOTO_NO_FACE',
  'PERSON_IDENTITY_PHOTO_MULTIPLE_FACES',
  'PERSON_IDENTITY_PHOTO_WRONG_POSE',
  'PERSON_IDENTITY_PHOTO_WRONG_FRAMING',
  'PERSON_IDENTITY_PHOTO_TOO_BLURRY',
  'PERSON_IDENTITY_PHOTO_OCCLUDED',
  'PERSON_IDENTITY_PHOTO_SUBJECT_TOO_SMALL',
  'PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE',
  'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON',
  'PERSON_IDENTITY_PHOTO_IDENTITY_UNCLEAR',
];
const FALLBACK = '__fallback__';
const INTERNAL = [/score/i, /yaw/i, /confidence/i, /model/i, /\bAI\b/, /\d+(\.\d+)?\s*%/, /모델/, /점수/, /신뢰도/, /PERSON_/];

const client = await import(`${pathToFileURL(path.join(root, 'site-person.js')).href}?contract=intake-gate-01`);
const {PERSON_IDENTITY_SLOTS} = await import(`${pathToFileURL(path.join(root, 'site-person-guides.js')).href}?contract=intake-gate-01`);
const slotByCode = Object.fromEntries(PERSON_IDENTITY_SLOTS.map(slot => [slot.code, slot]));

// 1. Every refusal has its own guardian-facing sentence; none leaks internals.
const seen = new Set();
for (const code of REFUSALS) {
  for (const slot of PERSON_IDENTITY_SLOTS) {
    const message = client.personIdentityPhotoErrorMessage({code, status: code.endsWith('UNAVAILABLE') ? 503 : 422}, slot, FALLBACK);
    assert.notEqual(message, FALLBACK, `${code} must have its own message (${slot.code})`);
    for (const pattern of INTERNAL) assert.ok(!pattern.test(message), `${code} message must not expose ${pattern}`);
    seen.add(message);
  }
}
assert.ok(seen.size >= REFUSALS.length, 'refusals must not collapse into one generic sentence');
assert.match(client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_NON_IDENTITY_IMAGE'}, FALLBACK), /문서·사물·화면 사진은 등록할 수 없습니다/);
assert.match(client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_NO_FACE'}, FALLBACK), /사람 얼굴을 확인할 수 없습니다/);
assert.match(client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_WRONG_POSE'}, FALLBACK), /촬영 방향이 맞지 않습니다/);
assert.match(client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_TOO_BLURRY'}, FALLBACK), /너무 흐립니다/);
assert.match(client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE'}, FALLBACK), /저장하지 않았습니다/);
// Same-person refusals: "someone else" and "cannot tell" read differently.
const different = client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON'}, FALLBACK);
const unclear = client.personErrorMessage({code: 'PERSON_IDENTITY_PHOTO_IDENTITY_UNCLEAR'}, FALLBACK);
assert.match(different, /등록된 사람과 다른 사람으로 보이는 사진입니다/);
assert.match(unclear, /얼굴을 충분히 확인하기 어렵습니다/);
assert.ok(!/다른 사람/.test(unclear), 'an inconclusive check must not say "different person"');

// Framing reads per slot.
const framing = {code: 'PERSON_IDENTITY_PHOTO_WRONG_FRAMING', status: 422};
assert.match(client.personIdentityPhotoErrorMessage(framing, slotByCode.UPPER_BODY_FRONT, FALLBACK), /머리부터 허리까지/);
assert.match(client.personIdentityPhotoErrorMessage(framing, slotByCode.FULL_BODY_FRONT, FALLBACK), /머리부터 발끝까지/);
assert.match(client.personIdentityPhotoErrorMessage(framing, slotByCode.FACE_FRONT, FALLBACK), /얼굴 전체/);

// 2. The Core reason code reaches the UI intact (422 and 503).
for (const [status, code] of [[422, 'PERSON_IDENTITY_PHOTO_NON_IDENTITY_IMAGE'], [503, 'PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE']]) {
  const fetchImpl = async () => new Response(JSON.stringify({detail: {code}}), {status, headers: {'Content-Type': 'application/json'}});
  await assert.rejects(
    () => client.putPersonIdentityPhoto('session-token', 'per_01', 1, 'data:image/jpeg;base64,AAAA', fetchImpl),
    error => error?.code === code && error?.status === status,
  );
}

// 3. The slot tile says "checking" while Core decides and "saved" only after
//    the PUT resolved; a refusal clears the status and shows the slot error.
const ui = read('site-person-ui.js');
const tile = ui.slice(ui.indexOf('const photoTile = '), ui.indexOf('const renderPhotoStep = '));
assert.ok(tile.includes('사진을 확인하고 있습니다…'), 'the tile must say the photo is being checked');
assert.ok(!tile.includes('안전하게 저장하는 중'), 'the tile must not claim saving before Core accepted the photo');
const tryBlock = tile.slice(tile.indexOf('try {'), tile.indexOf('catch (value)'));
assert.ok(tryBlock.indexOf('await putPersonIdentityPhoto(') >= 0, 'the tile must await Core');
assert.ok(tryBlock.indexOf('await putPersonIdentityPhoto(') < tryBlock.indexOf('사진을 저장했습니다.'), '"saved" must follow the accepted PUT');
const catchBlock = tile.slice(tile.indexOf('catch (value)'), tile.indexOf('finally {', tile.indexOf('catch (value)')));
assert.ok(!catchBlock.includes('저장했습니다'), 'a refusal must never show the saved message');
assert.ok(catchBlock.includes("showStatus('')") && catchBlock.includes('personIdentityPhotoErrorMessage(value, slot'), 'a refusal clears the status and explains the slot-specific reason');

// 4. Guide art: LEFT_45 shows a face looking toward the viewer's left (the v1
//    art faced right, same as RIGHT_45). Core locks the direction with the
//    same art; here the Site must ship the corrected file.
assert.equal(slotByCode.FACE_LEFT_45.artwork, 'assets/safecare/person-face-left-45-v2.png');
const v2 = fs.readFileSync(path.join(root, 'assets/safecare/person-face-left-45-v2.png'));
const right45 = fs.readFileSync(path.join(root, 'assets/safecare/person-face-right-45-v1.png'));
assert.equal(v2.subarray(1, 4).toString('ascii'), 'PNG');
assert.ok(v2.length >= 80_000 && !v2.equals(right45), 'LEFT_45 art must be its own finished illustration');
assert.match(slotByCode.FACE_LEFT_45.hint, /왼쪽을 바라보도록/);
assert.match(slotByCode.FACE_RIGHT_45.hint, /오른쪽을 바라보도록/);

console.log('SAFECARE-HUMAN-PHOTO-INTAKE-GATE-01 SITE PASS');
