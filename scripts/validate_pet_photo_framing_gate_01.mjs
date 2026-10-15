// PET-PHOTO-FRAMING-GATE-01 — the Site side of Core's whole-animal check.
//
// Core now refuses a BODY_LEFT / BODY_RIGHT / BACK_REAR photo that does not
// show the whole animal (Production 2026-10-07: a dog's hindquarters from above
// was stored as 몸 왼쪽). Each new reason code needs its own Korean sentence
// that says what to retake; an unmapped code would read "확인을 통과하지
// 못했어요" and leave the owner guessing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'site-pet.js'), 'utf8');
const pet = await import(`${pathToFileURL(path.join(root, 'site-pet.js')).href}?contract=pet-framing-01`);

const EXPECTED = {
  PET_PHOTO_BODY_NOT_WHOLE: [/몸 전체/, /머리부터 꼬리, 네 다리까지/],
  PET_PHOTO_BODY_TOO_SMALL: [/너무 작게/, /가까이/],
  PET_PHOTO_BODY_NOT_SIDE: [/옆모습 사진이 아니에요/, /머리부터 꼬리까지/],
  PET_PHOTO_BODY_NOT_REAR: [/뒷모습 사진이 아니에요/, /등·꼬리·뒷다리/],
};

const sentences = new Set();
for (const [code, patterns] of Object.entries(EXPECTED)) {
  const line = source.match(new RegExp(`${code}: '([^']+)'`))?.[1];
  assert.ok(line, `${code} has no Korean sentence`);
  assert.ok(!/[A-Za-z]{4,}/.test(line), `${code} sentence must not leak Core's English: ${line}`);
  for (const pattern of patterns) assert.match(line, pattern, `${code}: ${line}`);
  // A rejected draft row shows exactly this sentence (not the generic one).
  const shown = pet.petDraftPhotoInspectionMessage({inspectionState: 'REJECTED', inspectionReasonCode: code});
  assert.equal(shown, line, `${code} must reach the draft photo tile`);
  sentences.add(line);
}
assert.equal(sentences.size, Object.keys(EXPECTED).length, 'each refusal reads differently');
// The retake buttons stay generic and Korean.
for (const action of ['RETAKE_WHOLE_BODY', 'RETAKE_CLOSER', 'RETAKE_FROM_THE_SIDE', 'RETAKE_FROM_BEHIND']) {
  assert.equal(pet.petPhotoNextActionLabel(action), '다시 찍기');
}
// An accepted row is unchanged.
assert.equal(pet.petDraftPhotoInspectionMessage({inspectionState: 'ACCEPTED'}), '사진 확인됨');

console.log('PET-PHOTO-FRAMING-GATE-01 SITE PASS');
