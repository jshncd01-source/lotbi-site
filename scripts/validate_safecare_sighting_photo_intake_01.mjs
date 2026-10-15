// SAFECARE-SIGHTING-PHOTO-INTAKE-01 — found-person report photos reach Core.
//
// SAFECARE-PHOTO-UPLOAD-FIX-03 fixed the identity photo tiles but left the
// 발견 제보 photo picker on the old path: `PHOTO_TYPES.has(file.type)` refused a
// JPG with an empty MIME type and every HEIC ("JPG, PNG, WEBP 사진만…") without
// a request, WebP went to Core unconverted and was refused, very large photos
// hit Core's body limit, and a tap during another save did nothing. Found
// reports went live on lotbiai.com on 2026-10-07 (SAFECARE-WEB-SOS-SIGHTING-01).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'site-person-ui.js'), 'utf8');

// The old browser-MIME filter and the raw FileReader path are gone everywhere.
assert.ok(!/PHOTO_TYPES/.test(ui), 'no screen may refuse a photo by the browser MIME type');
assert.ok(!/fileDataUri/.test(ui), 'no screen may send unprepared bytes');
assert.ok(!/JPG, PNG, WEBP 사진만 등록할 수 있습니다/.test(ui), 'the misleading format sentence is not used by the screens');

const found = ui.slice(ui.indexOf('const renderFound = '), ui.indexOf('const details = el(\'fieldset\', \'safecare-found-details\')'));
assert.ok(found.length > 0, 'found composer present');
assert.ok(found.includes('input.accept = PERSON_PHOTO_ACCEPT'), 'the found picker offers the same formats as the identity tiles');

// Prepare first, then keep (before the report exists) or PUT the prepared URI.
const change = found.slice(found.indexOf("input.addEventListener('change'"));
const prepareAt = change.indexOf('await preparePersonPhoto(file)');
assert.ok(prepareAt > 0, 'the photo is prepared on selection');
assert.ok(change.indexOf("composer.pending.set(slot, {dataUri: photo.dataUri})") > prepareAt, 'a pending photo keeps the prepared data URI');
assert.ok(change.indexOf('putHumanSightingPhoto(sessionToken, composer.reportId, slot, photo.dataUri)') > prepareAt, 'a saved report receives the prepared data URI');
assert.ok(change.includes('value instanceof PersonPhotoPrepareError ? personPhotoPrepareMessage(value)'), 'a file problem says why');
assert.match(change, /finally \{ busy = false; \}/, 'busy is always released');

// Nothing is silent: a tap while busy and a full report both say why.
assert.ok(found.includes("다른 사진을 처리하는 중입니다. 끝난 뒤 다시 선택해 주세요."), 'busy tap explains');
assert.match(found, /add\.addEventListener\('click', \(\) => \{ if \(busy\) notNow\(\); else if \(progress\.canAdd\) input\.click\(\); \}\)/);
assert.ok(found.includes('사진은 최대 ${FOUND_REPORT_MAX_PHOTOS}장까지 등록할 수 있습니다.'), 'a full report explains');

// The report flush sends the prepared URI too, and a pending photo previews from it.
const flush = ui.slice(ui.indexOf('const createDraftAndFlush = '), ui.indexOf('const renderFound = '));
assert.ok(flush.includes('putHumanSightingPhoto(sessionToken, composer.reportId, slot, item.dataUri)'), 'the first save sends the prepared URI');
assert.ok(found.includes('image.src = pending.dataUri'), 'a pending tile previews the prepared photo (HEIC included)');

console.log('SAFECARE-SIGHTING-PHOTO-INTAKE-01 SITE PASS');
