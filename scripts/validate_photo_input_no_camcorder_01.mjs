// PHOTO-INPUT-NO-CAMCORDER-01 — a photo button never offers the camcorder.
//
// Owner report (Samsung Internet, Android): 진위확인 '사진·스크린샷 선택' opened
// the Android chooser with 카메라 / 카메라 캠코더 / 파일. The input said
// accept="image/jpeg,image/png,image/webp" (no capture).
//
// Cause, from Chromium's Android file chooser
// (ui/android/java/src/org/chromium/ui/base/SelectFileDialog.java):
// showExternalPickerDeprecated() — the default path through Chromium 121
// (kDeprecatedExternalPickerFunction ENABLED_BY_DEFAULT; disabled by 130),
// still the code browsers on an older Chromium base run — only targets the
// chooser when acceptsSingleType() is true. Several exact image types are
// NOT a single type ([image/jpeg, image/gif] -> false), so it "couldn't
// resolve a single accept type" and falls back to a generic chooser with the
// camera, camcorder and sound recorder intents. One generic "image/*" is a
// single type: camera + files only. A `capture` input with image-only types
// opens the camera directly and never shows a chooser at all.
//
// This validator models both chooser paths (deprecated and current) from that
// source, finds every <input type=file> the Site serves (HTML and JS-built),
// and asserts: every photo picker is exactly accept="image/*" without
// capture (no camcorder on either path), every camera input is capture +
// image-only (camera direct), documents keep their PDF/document types, and no
// accept anywhere lists video/ or */*. A new file input fails here until it
// is classified. Static only — no browser, no device.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ------------------------------------------------ Chromium chooser model ---

const EXTENSIONS = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  pdf: 'application/pdf', txt: 'text/plain', html: 'text/html', htm: 'text/html', csv: 'text/csv', json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// convertToSupportedMimeTypes(): MIME types pass through, known extensions map
// to their MIME type, unknown extensions become application/octet-stream.
function mimeTypesOf(accept) {
  const out = [];
  for (const raw of String(accept || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)) {
    const type = raw.includes('/') ? raw : (EXTENSIONS[raw.replace(/^\./u, '')] || 'application/octet-stream');
    if (!out.includes(type)) out.push(type);
  }
  return out;
}

function chooserModel(accept, capture) {
  const types = mimeTypesOf(accept);
  const count = superType => types.filter(type => type.startsWith(superType)).length;
  const acceptsType = superType => types.length === 0 || types.includes('*/*') || count(superType) > 0;
  const acceptsOnlyType = superType => count(superType) === types.length;
  const acceptsSingleType = () => {
    if (types.length === 1) return !types.includes('*/*');
    let superFound = null;
    let generic = false;
    for (const type of types) {
      const slash = type.indexOf('/');
      if (slash === -1) return false;
      const superType = type.slice(0, slash);
      if (superFound === null) superFound = superType;
      else if (superFound !== superType) return false;
      if (type.slice(slash + 1) === '*') generic = true;
    }
    return generic;
  };
  if (capture && acceptsOnlyType('image')) return {deprecated: ['camera-direct'], current: ['camera-direct']};

  // showExternalPickerDeprecated()
  let deprecated;
  if (acceptsSingleType() && acceptsType('image')) deprecated = ['camera', 'files'];
  else if (acceptsSingleType() && acceptsType('video')) deprecated = ['camcorder', 'files'];
  else deprecated = ['camera', 'camcorder', 'sound-recorder', 'files']; // "couldn't resolve a single accept type"

  // Current path: the photo picker for media-only types, else a chooser whose
  // extra intents follow acceptsType().
  let current;
  if (types.length > 0 && types.every(type => type.startsWith('image/') || type.startsWith('video/'))) current = ['photo-picker'];
  else current = [...(acceptsType('image') ? ['camera'] : []), ...(acceptsType('video') ? ['camcorder'] : []), ...(acceptsType('audio') ? ['sound-recorder'] : []), 'files'];
  return {deprecated, current};
}

// The model reproduces the owner's screenshot and the fix.
assert.deepEqual(chooserModel('image/jpeg,image/png,image/webp', false).deprecated, ['camera', 'camcorder', 'sound-recorder', 'files'], 'old accept list falls back to the generic chooser (the reported camcorder)');
assert.deepEqual(chooserModel('image/*', false).deprecated, ['camera', 'files'], 'image/* is a single type: camera and files only');
assert.deepEqual(chooserModel('image/*', false).current, ['photo-picker']);
assert.deepEqual(chooserModel('image/png,image/*', false).deprecated, ['camera', 'files'], 'Chromium treats [image/png, image/*] as image/*');
assert.deepEqual(chooserModel('image/jpeg,image/png', true).deprecated, ['camera-direct'], 'capture + image-only opens the camera directly');
assert.ok(chooserModel('', false).deprecated.includes('camcorder'), 'no accept at all accepts everything');

// ------------------------------------------------------- input inventory ---

const tracked = execFileSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'}).split(/\r?\n/u).filter(Boolean);
const served = file => !/^(?:scripts|docs|vendor|tests?|\.github|avatar-runtime\/vendor)\//u.test(file);
const htmlFiles = tracked.filter(file => file.endsWith('.html') && served(file));
const jsFiles = tracked.filter(file => /\.(?:m?js)$/u.test(file) && served(file));

const PERSON_PHOTO_ACCEPT = read('site-person-photo-intake.js').match(/export const PERSON_PHOTO_ACCEPT = '([^']*)'/u)?.[1];
assert.ok(PERSON_PHOTO_ACCEPT !== undefined, 'PERSON_PHOTO_ACCEPT is defined');

const inputs = [];
for (const file of htmlFiles) {
  for (const match of read(file).matchAll(/<input\b[^>]*\btype="file"[^>]*>/gu)) {
    const tag = match[0];
    const attr = name => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1];
    const id = attr('id') || attr('name') || (attr('data-attachment-input') ? `attachment-${attr('data-attachment-input')}` : tag.slice(0, 60));
    inputs.push({key: `${file}#${id}`, accept: attr('accept') ?? '', capture: /\bcapture\b/u.test(tag)});
  }
}
for (const file of jsFiles) {
  const source = read(file);
  for (const match of source.matchAll(/\b(\w+)\.type\s*=\s*'file'/gu)) {
    const name = match[1];
    const window = source.slice(match.index, match.index + 420);
    const next = window.slice(1).search(new RegExp(`\\b${name}\\.type\\s*=`, 'u'));
    const own = next === -1 ? window : window.slice(0, next + 1);
    const acceptMatch = own.match(new RegExp(`\\b${name}\\.accept\\s*=\\s*(?:'([^']*)'|(PERSON_PHOTO_ACCEPT))`, 'u'));
    const accept = acceptMatch ? (acceptMatch[2] ? PERSON_PHOTO_ACCEPT : acceptMatch[1]) : '';
    const captureLine = own.split('\n').find(text => new RegExp(`\\b${name}\\.setAttribute\\('capture'`, 'u').test(text)) || '';
    // `if (source === 'camera') input.setAttribute('capture', …)`: one input per
    // source, only the camera one forced.
    const capture = !captureLine ? false : /\bif\s*\(/u.test(captureLine) ? 'per-source' : true;
    const line = source.slice(0, match.index).split('\n').length;
    const tag = own.match(/dataset\.(\w+)\s*=\s*(?:'([^']*)'|(\w+))/u);
    const label = tag ? `${tag[1]}${tag[2] ? `=${tag[2]}` : ''}` : `${name}@${line}`;
    inputs.push({key: `${file}#${label}`, accept, capture});
  }
}

// Every input the Site serves, by what it is for.
const PHOTO_PICKER = 'photo picker — image/* only, no capture';
const PHOTO_CAMERA = 'camera — capture + image-only accept';
const PHOTO_SOURCES = 'one image/* input per source, capture only on the camera source';
const DOCUMENT = 'document — keeps PDF/document types';
const OTHER = 'not a photo input';
const KNOWN = new Map([
  ['index.html#attachment-photos', PHOTO_PICKER],
  ['index.html#scam-photo', PHOTO_PICKER],
  ['site-calendar-manager.js#calendarImagePicker', PHOTO_PICKER],
  ['site-conversation.js#profilePhotoInput', PHOTO_SOURCES],
  ['site-person-ui.js#personSlotInput', PHOTO_PICKER],
  ['site-person-ui.js#personFoundInput', PHOTO_PICKER],
  ['site-person-bulk-photos.js#input@399', PHOTO_PICKER],
  ['site-pet-ui.js#petPhotoSourceInput=gallery', PHOTO_PICKER],
  ['site-pet-ui.js#petFoundInput', PHOTO_PICKER],
  ['index.html#attachment-camera', PHOTO_CAMERA],
  ['index.html#scam-camera', PHOTO_CAMERA],
  ['site-life-wallet.js#cameraInput@689', PHOTO_CAMERA],
  ['site-pet-ui.js#petPhotoSourceInput=camera', PHOTO_CAMERA],
  ['index.html#attachment-files', DOCUMENT],
  ['index.html#scam-document', DOCUMENT],
  ['site-life-wallet.js#filesInput@691', DOCUMENT],
  ['site-life-wallet.js#fileInput@1647', OTHER],
  // SITE-PET-PHOTO-SOURCE-01 by design: LOTBI's own sheet offers 카메라 / 갤러리 /
  // 파일, and 파일 carries no accept so a current Chrome opens the Files app
  // rather than the photo picker. On the deprecated chooser path a no-accept
  // input still lists the camcorder; left to the pet owner's decision.
  ['site-pet-ui.js#petPhotoSourceInput=file', OTHER],
]);

const keyOf = input => {
  // The person bulk input carries no dataset label; its line may move, so
  // match it by file and the PERSON_PHOTO_ACCEPT source.
  if (input.key.startsWith('site-person-bulk-photos.js#input@')) return 'site-person-bulk-photos.js#input@399';
  if (input.key.startsWith('site-life-wallet.js#cameraInput@')) return 'site-life-wallet.js#cameraInput@689';
  if (input.key.startsWith('site-life-wallet.js#filesInput@')) return 'site-life-wallet.js#filesInput@691';
  if (input.key.startsWith('site-life-wallet.js#fileInput@')) return 'site-life-wallet.js#fileInput@1647';
  return input.key;
};

const rows = [];
for (const input of inputs) {
  const kind = KNOWN.get(keyOf(input));
  assert.ok(kind, `unclassified file input ${input.key} (accept="${input.accept}") — add it to KNOWN with the rule it follows`);
  const model = chooserModel(input.accept, input.capture === true);
  rows.push({...input, kind, ...model});
  assert.doesNotMatch(input.accept, /video\/|\*\/\*/u, `${input.key}: accept must not list video/ or */*`);
  if (kind === PHOTO_PICKER) {
    assert.equal(input.accept, 'image/*', `${input.key}: a photo picker uses one generic image type`);
    assert.equal(input.capture, false, `${input.key}: a photo picker must not force the camera (photo library and files stay reachable)`);
    assert.ok(!model.deprecated.includes('camcorder') && !model.current.includes('camcorder'), `${input.key}: no camcorder`);
    assert.deepEqual(model.deprecated, ['camera', 'files'], `${input.key}: Android chooser shows camera and files only`);
  } else if (kind === PHOTO_CAMERA) {
    assert.equal(input.capture, true, `${input.key}: camera input forces the camera`);
    assert.ok(mimeTypesOf(input.accept).length > 0 && mimeTypesOf(input.accept).every(type => type.startsWith('image/')), `${input.key}: camera input accepts images only`);
    assert.deepEqual(model.deprecated, ['camera-direct'], `${input.key}: camera opens directly, no chooser`);
  } else if (kind === PHOTO_SOURCES) {
    assert.equal(input.accept, 'image/*', `${input.key}: every source input uses one generic image type`);
    assert.equal(input.capture, 'per-source', `${input.key}: only the camera source forces the camera`);
    assert.deepEqual(chooserModel(input.accept, false).deprecated, ['camera', 'files'], `${input.key}: non-camera sources show camera and files only`);
    assert.deepEqual(chooserModel(input.accept, true).deprecated, ['camera-direct'], `${input.key}: the camera source opens the camera directly`);
  } else if (kind === DOCUMENT) {
    assert.equal(input.capture, false, `${input.key}: documents never force the camera`);
    assert.ok(mimeTypesOf(input.accept).includes('application/pdf'), `${input.key}: document input keeps PDF`);
  }
}
for (const key of KNOWN.keys()) assert.ok(inputs.some(input => keyOf(input) === key), `inventory entry ${key} no longer found — update KNOWN`);

// What each photo picker tells the owner about formats is unchanged; the
// format check after choosing still decides.
const html = read('index.html');
assert.match(html, /사진\(JPEG·PNG·WEBP\) · 최대 10MB/u, '진위확인 still names the supported formats');
assert.match(read('site-scam-shield.js'), /const allowedFileTypes = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'/u, '진위확인 still checks the chosen file type');
assert.match(read('site-attachments.js'), /export const ATTACHMENT_MEDIA_TYPES = Object\.freeze\(\[\s*'image\/jpeg',\s*'image\/png',/u, 'attachments still accept only JPEG/PNG images');
assert.match(read('site-pet.js'), /if \(!PET_PHOTO_MIME_TYPES\.includes\(file\.type\)\)/u, 'pet photos still checked after choosing');
assert.match(read('site-person-photo-intake.js'), /export function sniffImageKind\(bytes\)/u, 'person photos still recognised by their bytes');

for (const row of rows) {
  console.log(`  ${row.key.padEnd(48)} accept="${row.accept}"${row.capture === true ? ' capture' : row.capture ? ` capture(${row.capture})` : ''} → old: ${row.deprecated.join('+')} · current: ${row.current.join('+')}`);
}
console.log(`PHOTO-INPUT-NO-CAMCORDER-01 PASS — ${rows.length} file inputs classified, ${rows.filter(row => row.kind === PHOTO_PICKER).length} photo pickers image/* (no camcorder on the deprecated or current Android chooser), ${rows.filter(row => row.kind === PHOTO_CAMERA).length} camera inputs open the camera directly; static model of Chromium SelectFileDialog, not a device run`);
