// SAFECARE-PHOTO-UPLOAD-FIX-03 — new identity photos reach Core.
//
// Reproduced on Production (Site 131b775d, 2026-10-07): a JPG whose MIME type
// was empty and any HEIC file stopped at "JPG, PNG, WEBP 사진만 등록할 수
// 있습니다." without a request; WebP passed the Site and Core refused it; a
// photo the browser could not read showed the gate's "안내 그림과 같은 방향…"
// sentence; a tap during another upload did nothing; a refused 45-degree photo
// only heard "촬영 방향이 맞지 않습니다". This validator locks the fix with
// synthetic bytes only (no real photo).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const intake = await import(`${pathToFileURL(path.join(root, 'site-person-photo-intake.js')).href}?contract=fix-03`);
const client = await import(`${pathToFileURL(path.join(root, 'site-person.js')).href}?contract=fix-03`);
const {PERSON_IDENTITY_SLOTS} = await import(`${pathToFileURL(path.join(root, 'site-person-guides.js')).href}?contract=fix-03`);
const slotByCode = Object.fromEntries(PERSON_IDENTITY_SLOTS.map(slot => [slot.code, slot]));
const {PersonPhotoPrepareError, preparePersonPhoto, sniffImageKind, personPhotoKind} = intake;

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const ascii = text => [...text].map(char => char.charCodeAt(0));
const WEBP = [...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBPVP8 ')];
const HEIC = [0, 0, 0, 0x18, ...ascii('ftypheic'), 0, 0, 0, 0, ...ascii('mif1heic')];
const HEIF_MIF1 = [0, 0, 0, 0x18, ...ascii('ftypmif1'), 0, 0, 0, 0, ...ascii('mif1heic')];
const PDF = ascii('%PDF-1.7\n%');
const file = (head, name, type, size = 0) => new File([new Uint8Array([...head, ...new Uint8Array(Math.max(0, size - head.length))])], name, {type});
const decodes = (width, height) => {
  const calls = [];
  const decode = async value => { calls.push(value); return {width, height, source: 'decoded', close() { calls.closed = (calls.closed || 0) + 1; }}; };
  return {decode, calls};
};
const cannotDecode = async () => { throw new Error('decode failed'); };
const encoder = () => {
  const calls = [];
  const encode = async (decoded, maxEdge, quality) => { calls.push({decoded, maxEdge, quality}); return new Blob([new Uint8Array([...JPEG, 1, 2, 3])], {type: 'image/jpeg'}); };
  return {encode, calls};
};
const prefix = uri => uri.slice(0, uri.indexOf(',') + 1);
const rejectsWith = async (promise, code) => assert.rejects(promise, error => error instanceof PersonPhotoPrepareError && error.code === code);

// 1. Kind from the bytes, then MIME type, then name.
assert.equal(sniffImageKind(new Uint8Array(JPEG)), 'jpeg');
assert.equal(sniffImageKind(new Uint8Array(PNG)), 'png');
assert.equal(sniffImageKind(new Uint8Array(WEBP)), 'webp');
assert.equal(sniffImageKind(new Uint8Array(HEIC)), 'heic');
assert.equal(sniffImageKind(new Uint8Array(HEIF_MIF1)), 'heic');
assert.equal(sniffImageKind(new Uint8Array(PDF)), '');
assert.equal(personPhotoKind(new Uint8Array(JPEG), '', 'IMG_0001'), 'jpeg', 'an empty MIME type does not hide a JPG');
assert.equal(personPhotoKind(new Uint8Array([1, 2, 3, 4]), '', 'IMG_0001.HEIC'), 'heic');
assert.equal(personPhotoKind(new Uint8Array([1, 2, 3, 4]), 'image/x-unknown', 'x'), 'image');
assert.equal(personPhotoKind(new Uint8Array(PDF), 'application/pdf', 'scan.pdf'), '');

// 2. (A) A real JPG with an empty MIME type goes to Core unchanged, labelled JPEG.
{
  const {decode} = decodes(4000, 3000);
  const {encode, calls} = encoder();
  const picked = file(JPEG, 'photo.jpg', '', 2048);
  const prepared = await preparePersonPhoto(picked, {decode, encode});
  assert.equal(prefix(prepared.dataUri), 'data:image/jpeg;base64,');
  assert.equal(prepared.converted, false);
  assert.equal(calls.length, 0, 'a JPG that already fits is not re-encoded');
  assert.deepEqual(Buffer.from(prepared.dataUri.split(',')[1], 'base64'), Buffer.from(await picked.arrayBuffer()));
}
// A PNG without a MIME type stays PNG.
assert.equal(prefix((await preparePersonPhoto(file(PNG, 'scan', '', 512), {decode: decodes(800, 600).decode, encode: encoder().encode})).dataUri), 'data:image/png;base64,');
// A JPG the browser cannot open but that fits is still sent: Core decides.
assert.equal(prefix((await preparePersonPhoto(file(JPEG, 'odd.jpg', 'image/jpeg', 1024), {decode: cannotDecode, encode: encoder().encode})).dataUri), 'data:image/jpeg;base64,');

// 3. (A) HEIC: converted to JPEG where the browser opens it (Safari); otherwise
//    a concrete instruction instead of "JPG, PNG, WEBP만".
{
  const {decode} = decodes(3024, 4032);
  const {encode, calls} = encoder();
  const prepared = await preparePersonPhoto(file(HEIC, 'IMG_0002.HEIC', 'image/heic', 4096), {decode, encode});
  assert.equal(prefix(prepared.dataUri), 'data:image/jpeg;base64,');
  assert.equal(prepared.converted, true);
  assert.equal(calls[0].maxEdge, intake.PERSON_PHOTO_MAX_EDGE);
}
await rejectsWith(preparePersonPhoto(file(HEIC, 'IMG_0003.HEIC', 'image/heic', 4096), {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_HEIC_UNSUPPORTED');
await rejectsWith(preparePersonPhoto(file(HEIC, 'IMG_0004', '', 4096), {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_HEIC_UNSUPPORTED');
assert.match(intake.PERSON_PHOTO_PREPARE_MESSAGES.PERSON_PHOTO_HEIC_UNSUPPORTED, /높은 호환성/);
assert.match(intake.PERSON_PHOTO_PREPARE_MESSAGES.PERSON_PHOTO_HEIC_UNSUPPORTED, /고효율 사진/);

// 4. WebP passed the Site and Core refused it (Core takes JPEG/PNG only): now JPEG.
{
  const {encode, calls} = encoder();
  const prepared = await preparePersonPhoto(file(WEBP, 'photo.webp', 'image/webp', 1024), {decode: decodes(1600, 1200).decode, encode});
  assert.equal(prefix(prepared.dataUri), 'data:image/jpeg;base64,');
  assert.equal(calls.length, 1);
}

// 5. Large photos are brought inside Core's limits before upload, keeping 2400 px.
{
  const {decode, calls: decoded} = decodes(8160, 6120);
  const {encode, calls} = encoder();
  const big = file(JPEG, 'big.jpg', 'image/jpeg', intake.PERSON_PHOTO_PASS_MAX_BYTES + 1);
  const prepared = await preparePersonPhoto(big, {decode, encode});
  assert.equal(prepared.converted, true);
  assert.equal(calls[0].maxEdge, 2400, 'the face keeps enough resolution for the Core gate');
  assert.equal(decoded.closed, 1, 'the decoded frame is released');
  // Under 8 MB but over Core's 40 MP / 8192 px: re-encoded as well.
  const many = encoder();
  await preparePersonPhoto(file(JPEG, 'wide.jpg', 'image/jpeg', 4096), {decode: decodes(9000, 6000).decode, encode: many.encode});
  assert.equal(many.calls.length, 1);
}

// 6. (D) A file that cannot be read or is not a photo says so (not the gate's sentence).
const unreadable = {name: 'cloud.jpg', type: 'image/jpeg', size: 10, slice: () => ({arrayBuffer: async () => { throw new DOMException('gone', 'NotReadableError'); }})};
await rejectsWith(preparePersonPhoto(unreadable, {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_READ_FAILED');
await rejectsWith(preparePersonPhoto(file([], 'empty.jpg', 'image/jpeg'), {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_READ_FAILED');
await rejectsWith(preparePersonPhoto(file(PDF, 'scan.pdf', 'application/pdf', 512), {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_NOT_IMAGE');
await rejectsWith(preparePersonPhoto(file(WEBP, 'broken.webp', 'image/webp', 512), {decode: cannotDecode, encode: encoder().encode}), 'PERSON_PHOTO_DECODE_FAILED');
const gateFallback = '사진을 저장하지 못했습니다. 안내 그림과 같은 방향에서 찍은 선명한 사진을 선택해 주세요.';
for (const message of Object.values(intake.PERSON_PHOTO_PREPARE_MESSAGES)) {
  assert.notEqual(message, gateFallback);
  assert.ok(!/JPG, PNG, WEBP 사진만/.test(message));
}
assert.equal(intake.personPhotoPrepareMessage(new PersonPhotoPrepareError('PERSON_PHOTO_READ_FAILED')), intake.PERSON_PHOTO_PREPARE_MESSAGES.PERSON_PHOTO_READ_FAILED);

// 7. The slot tile prepares before the PUT, never filters on file.type, and
//    never ignores a tap silently (B: locked, C: busy).
const ui = read('site-person-ui.js');
const tile = ui.slice(ui.indexOf('const photoTile = '), ui.indexOf('const renderPhotoStep = '));
assert.ok(ui.includes("from './site-person-photo-intake.js?v="), 'the UI imports the intake module with the asset token');
assert.ok(!tile.includes('PHOTO_TYPES.has(file.type)'), 'the tile must not refuse by the browser MIME type');
assert.ok(!tile.includes('fileDataUri('), 'the tile must not send unprepared bytes');
assert.ok(tile.includes('input.accept = PERSON_PHOTO_ACCEPT'));
const tryBlock = tile.slice(tile.indexOf('try {'), tile.indexOf('catch (value)'));
assert.ok(tryBlock.indexOf('await preparePersonPhoto(file)') >= 0 && tryBlock.indexOf('await preparePersonPhoto(file)') < tryBlock.indexOf('await putPersonIdentityPhoto('), 'prepare runs before the PUT');
assert.ok(tryBlock.includes('photo.dataUri'), 'the prepared data URI is what Core receives');
const catchBlock = tile.slice(tile.indexOf('catch (value)'), tile.indexOf('finally {', tile.indexOf('catch (value)')));
assert.ok(catchBlock.includes('value instanceof PersonPhotoPrepareError ? personPhotoPrepareMessage(value)'), 'a file problem shows its own sentence');
assert.match(tile, /choose\.addEventListener\('click', \(\) => \{ if \(locked \|\| busy\) notNow\(\); else input\.click\(\); \}\)/);
assert.match(tile, /if \(busy \|\| locked\) \{ notNow\(\); return; \}/);
assert.ok(tile.includes('다른 사진을 확인하는 중입니다. 끝난 뒤 다시 선택해 주세요.'));
assert.ok(tile.includes('정면 얼굴 사진을 먼저 등록해 주세요.'));
assert.ok(/finally \{ busy = false; \}/.test(tile), 'busy is released after every attempt (C)');

// 8. Slot guidance: left/right is where the face looks in the photo, and a
//    45-degree photo shows both eyes, the nose and the mouth.
for (const code of ['FACE_LEFT_45', 'FACE_RIGHT_45']) {
  const side = code.includes('LEFT') ? '왼쪽' : '오른쪽';
  assert.ok(slotByCode[code].hint.includes(`화면 ${side}을 바라보도록`), code);
  assert.ok(slotByCode[code].hint.includes('두 눈·코·입이 모두 보여야'), code);
  assert.ok(slotByCode[code].hint.includes('반쯤만'), code);
}
for (const code of ['FACE_LEFT_PROFILE', 'FACE_RIGHT_PROFILE']) {
  assert.ok(slotByCode[code].hint.includes('완전히 옆으로') && slotByCode[code].hint.includes('귀와 턱선'), code);
}
for (const code of ['FACE_LEFT_ALT', 'FACE_RIGHT_ALT']) assert.ok(slotByCode[code].hint.includes('다른 날·다른 장소'), code);

// 9. A pose refusal says what the slot needed.
const pose = {code: 'PERSON_IDENTITY_PHOTO_WRONG_POSE', status: 422};
const fallback = '__fallback__';
const left45 = client.personIdentityPhotoErrorMessage(pose, slotByCode.FACE_LEFT_45, fallback);
assert.match(left45, /45도 각도가 아닙니다/);
assert.match(left45, /두 눈·코·입이 모두 보이도록/);
assert.match(left45, /'왼쪽 옆면' 칸/);
assert.match(left45, /셀카는 좌우가 바뀌어/);
assert.match(client.personIdentityPhotoErrorMessage(pose, slotByCode.FACE_RIGHT_45, fallback), /'오른쪽 옆면' 칸/);
const leftProfile = client.personIdentityPhotoErrorMessage(pose, slotByCode.FACE_LEFT_PROFILE, fallback);
assert.match(leftProfile, /옆면 사진이 아닙니다/);
assert.match(leftProfile, /'왼쪽 45도' 칸/);
const leftAlt = client.personIdentityPhotoErrorMessage(pose, slotByCode.FACE_LEFT_ALT, fallback);
assert.match(leftAlt, /화면 왼쪽을 바라보도록/);
assert.ok(!/옆면' 칸/.test(leftAlt), 'an extra turned slot also takes a profile, so it must not send the photo elsewhere');
for (const code of ['FACE_FRONT', 'FACE_FRONT_ALT', 'UPPER_BODY_FRONT', 'FULL_BODY_FRONT']) {
  assert.match(client.personIdentityPhotoErrorMessage(pose, slotByCode[code], fallback), /정면 사진이 아닙니다/, code);
}
// Without a slot the generic sentence stays.
assert.match(client.personErrorMessage(pose, fallback), /촬영 방향이 맞지 않습니다/);
const INTERNAL = [/score/i, /yaw/i, /confidence/i, /model/i, /\bAI\b/, /\d+(\.\d+)?\s*%/, /모델/, /점수/, /신뢰도/, /PERSON_/];
for (const slot of PERSON_IDENTITY_SLOTS) {
  const message = client.personIdentityPhotoErrorMessage(pose, slot, fallback);
  for (const pattern of INTERNAL) assert.ok(!pattern.test(message), `${slot.code} pose message must not expose ${pattern}`);
}

console.log('SAFECARE-PHOTO-UPLOAD-FIX-03 SITE PASS');
