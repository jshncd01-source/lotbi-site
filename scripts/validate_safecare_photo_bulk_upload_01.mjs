#!/usr/bin/env node
// SAFECARE-PHOTO-BULK-UPLOAD-01 → SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round) +
// SAFECARE-SOS-ADMIN-INTAKE (Site side).
//
// A guardian attaches everyday photos in one go. Each photo goes to Core's
// slot-free POST one at a time, in the order picked; Core decides FACE or BODY,
// refuses only wrong or useless photos, and places it in a free card. Every
// success is kept when a later photo is refused, and only a refused photo is
// replaced. Three face photos and two body photos complete the set (owner
// decision 2026-10-10); ten are recommended, never required. The ten tiles are
// examples; in 사진 갱신·관리 a stored photo can be taken out (second tap).
// After a person SOS the guardian reads that the case reached the LOTBI admin
// inbox (when Core says so) and, always, that this is not a police report.
//
// Layers: A. pure rules and the Core client contract in Node, B. source and
// copy checks, C. a real Chrome run (360/390/412 mobile emulation, 1440
// desktop) against an in-memory stand-in for Core. Core is never contacted.
//
//   CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_safecare_photo_bulk_upload_01.mjs
// Set SAFECARE_SCREENSHOT_DIR to keep PNG evidence.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const client = await import(`${pathToFileURL(path.join(ROOT, 'site-person.js')).href}?contract=bulk-01`);
const {PERSON_IDENTITY_SLOTS} = await import(`${pathToFileURL(path.join(ROOT, 'site-person-guides.js')).href}?contract=bulk-01`);
const bulk = await import(`${pathToFileURL(path.join(ROOT, 'site-person-bulk-photos.js')).href}?contract=bulk-01`);
const common = await import(`${pathToFileURL(path.join(ROOT, 'site-safecare-common.js')).href}?contract=bulk-01`);

const WARNING = '정확한 비교를 위해 동일한 사람의 사진만 등록해 주세요. 다른 사람이나 동물·사물 사진이 섞이면 등록이 제한될 수 있습니다.';
const ANGLES = '휴대폰에 있는 사진 중 얼굴이 잘 보이는 사진 3장과 상반신·전신 사진 2장이면 충분해요. 각도는 대충 맞아도 괜찮아요.';
const ANCHOR = '처음 저장된 사진이 다른 사람일 수 있어요. 사진 갱신·관리에서 그 사진을 빼고 다시 올려 주세요.';
const NEEDS_ALL = '얼굴이 잘 보이는 사진 3장과 상반신·전신 사진 2장이 더 있으면 등록을 마칠 수 있어요.';
const RECOMMEND = '등록할 수 있어요. 사진을 더 올리면(최대 10장) 찾을 확률을 높일 수 있어요.';
const NOT_POLICE = '이 접수는 경찰 신고가 아닙니다. 긴급한 경우 112에 바로 신고해 주세요.';
// The bulk screen never claims certainty about who is in the photos...
const FORBIDDEN = ['100%', '확정', '일치합니다', '찾았습니다', '찾았어요', '동일인입니다', '카메라 촬영'];
// ...and no person screen ever says LOTBI reported anything to the police.
const POLICE = ['경찰 신고 완료', '신고가 경찰에 접수', '경찰에 신고했', '경찰에 접수'];
// A found report's reporter is never told whether a comparison candidate existed
// or whether anything matched (SAFECARE-SIGHTING-RESULT-PRIVACY).
const RESULT_DISCLOSURE = ['비교 후보가 있어', '일치 대상이 없', '일치 대상 없음'];
// Nothing on the photo step may make ten look required.
const TEN_REQUIRED = ['남은 사진', '10장을 모두', '/ 10', '/10', '식별 사진 10장'];
const REVIEW_STATES = ['DRAFT', 'QUEUED', 'ANALYZING', 'ADMIN_REVIEW', 'NO_RELIABLE_MATCH', 'INSUFFICIENT_QUALITY', 'CLOSED', 'SOMETHING_NEW'];
const QUEUED_DETAIL = '제보가 접수되었습니다. 관리자가 확인하고 있으며, 비교 결과는 제보자에게 공개되지 않습니다.';
const CLOSED_DETAIL = '제보 검토가 종료되었습니다. 비교 결과는 제보자에게 공개되지 않습니다.';
const SLOT_CODES = PERSON_IDENTITY_SLOTS.map(slot => slot.code);
const MSG = {
  NO_PERSON: '사람이 보이지 않는 사진이에요. 동물·물건·풍경 사진은 등록할 수 없어요.',
  NON_IDENTITY_IMAGE: '사람 식별 사진이 아닙니다. 문서·사물·화면 사진은 등록할 수 없습니다.',
  DIFFERENT_PERSON: '등록된 사람과 다른 사람으로 보이는 사진입니다. 같은 사람의 사진을 선택해 주세요.',
  MULTIPLE_FACES: '여러 사람이 함께 나온 사진은 등록할 수 없습니다. 등록할 사람 한 명만 나온 사진을 선택해 주세요.',
};

// ------------------------------------------------------------ A. rules
assert.deepEqual([...client.PERSON_IDENTITY_SLOT_CODES], SLOT_CODES, 'the client slot table is the guide slot table');
assert.equal(bulk.PERSON_BULK_MAX_FILES, 10);
assert.equal(bulk.PERSON_BULK_WARNING, WARNING);
assert.equal(bulk.PERSON_BULK_ANGLE_GUIDE, ANGLES);
assert.equal(bulk.PERSON_BULK_ANCHOR_HINT, ANCHOR);
assert.equal(bulk.personBulkProgress(3, 10), '사진을 확인하고 있어요 (3/10)');
{
  // Ten in all, counting the photos already stored.
  const all = Array.from({length: 12}, (_, i) => `f${i}`);
  assert.deepEqual(bulk.limitPersonBulkFiles(all), {kept: all.slice(0, 10), dropped: 2, room: 10});
  assert.deepEqual(bulk.limitPersonBulkFiles(all, 8), {kept: all.slice(0, 2), dropped: 10, room: 2});
  assert.deepEqual(bulk.limitPersonBulkFiles(['a'], 10), {kept: [], dropped: 1, room: 0});
  assert.equal(bulk.personBulkTooManyMessage(2), '사진은 모두 합쳐 10장까지 등록할 수 있어요. 처음 고른 2장만 확인할게요.');
  assert.equal(bulk.personBulkTooManyMessage(0), bulk.PERSON_BULK_FULL);
}
{
  const DP = 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON';
  assert.equal(bulk.personBulkAnchorSuspect([{ok: true}, {ok: false, code: DP}, {ok: false, code: DP}], true), true);
  assert.equal(bulk.personBulkAnchorSuspect([{ok: true}, {ok: false, code: DP}, {ok: false, code: DP}], false), false, 'only a previously empty profile');
  assert.equal(bulk.personBulkAnchorSuspect([{ok: true}, {ok: false, code: DP}, {ok: false, code: 'PERSON_IDENTITY_PHOTO_TOO_BLURRY'}], true), false, 'two different-person refusals are needed');
  assert.equal(bulk.personBulkAnchorSuspect([{ok: false, code: 'X'}, {ok: false, code: DP}, {ok: false, code: DP}], true), false, 'no anchor stored');
  assert.equal(bulk.personBulkSummary([{state: 'STORED'}, {state: 'REFUSED'}, {state: 'PREPARE_FAILED'}, {state: 'SKIPPED'}]).text, '등록 성공 1장 · 실패 2장');
}
// What the guardian still needs; ten is only a recommendation.
assert.equal(bulk.personPhotoSetMessage({complete: false, faceCount: 0, bodyCount: 0}), NEEDS_ALL);
assert.equal(bulk.personPhotoSetMessage({complete: false, faceCount: 3, bodyCount: 1}), '상반신·전신 사진 1장이 더 있으면 등록을 마칠 수 있어요.');
assert.equal(bulk.personPhotoSetMessage({complete: false, faceCount: 1, bodyCount: 2}), '얼굴이 잘 보이는 사진 2장이 더 있으면 등록을 마칠 수 있어요.');
assert.equal(bulk.personPhotoSetMessage({complete: true, faceCount: 3, bodyCount: 2, photoCount: 5}), RECOMMEND);
assert.equal(bulk.personPhotoSetMessage({complete: true, faceCount: 8, bodyCount: 2, photoCount: 10}), '등록에 필요한 사진이 모두 있어요.');


// Classify contract (kept for older callers; the 2nd-round batch no longer uses it):
// strict shape, POST body, nothing stored, no identity claim.
{
  const calls = [];
  const response = (body, status = 200) => async (url, init) => { calls.push({url: String(url), init}); return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}); };
  const good = {status: 'CLEAR', detected_view: 'FRONT', suggested_slot_indexes: [1, 8], suggested_slot_codes: ['FACE_FRONT', 'FACE_FRONT_ALT'], rejection_code: null, identity_checked: false, stored: false, extra: 'tolerated'};
  const result = await client.classifyPersonIdentityPhoto('session-token', 'per 1', 'data:image/jpeg;base64,AAAA', response({classification: good, unknown: 1}));
  assert.equal(result.status, 'CLEAR');
  assert.deepEqual([...result.suggestedSlotIndexes], [1, 8]);
  assert.equal(result.identityChecked, false);
  assert.equal(result.stored, false);
  assert.match(calls[0].url, /\/v2\/person-profiles\/per%201\/identity-photos\/classify$/);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {photo_data_uri: 'data:image/jpeg;base64,AAAA'});
  assert.equal(calls[0].init.credentials, 'omit');
  const rejected = await client.classifyPersonIdentityPhoto('t', 'p', 'd', response({classification: {...good, status: 'REJECTED', suggested_slot_indexes: [], suggested_slot_codes: [], rejection_code: 'PERSON_IDENTITY_PHOTO_NO_PERSON'}}));
  assert.equal(rejected.rejectionCode, 'PERSON_IDENTITY_PHOTO_NO_PERSON');
  const unknownView = await client.classifyPersonIdentityPhoto('t', 'p', 'd', response({classification: {...good, detected_view: 'SOMETHING_NEW'}}));
  assert.equal(unknownView.detectedView, 'UNKNOWN');
  const invalid = [
    undefined,
    {...good, identity_checked: true},
    {...good, stored: true},
    {...good, stored: undefined},
    {...good, status: 'MATCH'},
    {...good, suggested_slot_indexes: [1, 11], suggested_slot_codes: ['FACE_FRONT', 'X']},
    {...good, suggested_slot_indexes: [1, 8], suggested_slot_codes: ['FACE_FRONT', 'FACE_LEFT_45']},
    {...good, suggested_slot_indexes: [1, 1], suggested_slot_codes: ['FACE_FRONT', 'FACE_FRONT']},
    {...good, suggested_slot_indexes: [1], suggested_slot_codes: ['FACE_FRONT', 'FACE_FRONT_ALT']},
    {...good, suggested_slot_indexes: []},
    {...good, suggested_slot_indexes: [], suggested_slot_codes: []},
    {...good, rejection_code: 'PERSON_IDENTITY_PHOTO_NO_PERSON'},
    {...good, status: 'REJECTED', rejection_code: null, suggested_slot_indexes: [], suggested_slot_codes: []},
    {...good, status: 'REJECTED', rejection_code: 'PERSON_IDENTITY_PHOTO_NO_PERSON'},
    {...good, detected_view: undefined},
  ];
  for (const classification of invalid) {
    await assert.rejects(() => client.classifyPersonIdentityPhoto('t', 'p', 'd', response({classification})), error => error?.code === 'PERSON_RESPONSE_INVALID', JSON.stringify(classification));
  }
  await assert.rejects(() => client.classifyPersonIdentityPhoto('t', 'p', 'd', response({detail: {code: 'PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE'}}, 503)), error => error.code === 'PERSON_IDENTITY_PHOTO_CHECK_UNAVAILABLE' && error.status === 503);
  await assert.rejects(() => client.classifyPersonIdentityPhoto('t', 'p', 'd', response({detail: 'Not Found'}, 404)), error => error.code === 'HTTP_404');
}

// Slot-free add contract (2nd round): POST body, parsed result, no stronger claim than SAME/UNVERIFIED.
{
  const calls = [];
  const response = (body, status = 201) => async (url, init) => { calls.push({url: String(url), init}); return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}); };
  const added = await client.addPersonIdentityPhoto('session-token', 'per 1', 'data:image/jpeg;base64,AAAA', response({
    photo: {slot_index: 6, slot_code: 'UPPER_BODY_FRONT', category: 'BODY', revision: 1, width: 640, height: 640},
    category: 'BODY', identity_check: 'SAME', idempotent_replay: false,
    validity: {state: 'INCOMPLETE', photo_count: 4, face_count: 3, body_count: 1, complete: false},
  }));
  assert.match(calls[0].url, /\/v2\/person-profiles\/per%201\/identity-photos$/);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), {photo_data_uri: 'data:image/jpeg;base64,AAAA'});
  assert.equal(calls[0].init.credentials, 'omit');
  assert.deepEqual({slot: added.photo.slotIndex, category: added.category, check: added.identityCheck, complete: added.complete, face: added.faceCount, body: added.bodyCount}, {slot: 6, category: 'BODY', check: 'SAME', complete: false, face: 3, body: 1});
  const unknownCheck = await client.addPersonIdentityPhoto('t', 'p', 'd', response({photo: {slot_index: 1, slot_code: 'FACE_FRONT'}, category: 'FACE', identity_check: 'MATCH', validity: {}}));
  assert.equal(unknownCheck.identityCheck, 'UNVERIFIED', 'anything but SAME reads as UNVERIFIED');
  await assert.rejects(() => client.addPersonIdentityPhoto('t', 'p', 'd', response({detail: {code: 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON'}}, 422)), error => error.code === 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON');
  await assert.rejects(() => client.addPersonIdentityPhoto('t', 'p', 'd', response({detail: {code: 'PERSON_IDENTITY_PHOTOS_FULL'}}, 409)), error => error.code === 'PERSON_IDENTITY_PHOTOS_FULL' && error.status === 409);
  const removed = [];
  await client.deletePersonIdentityPhoto('t', 'per 1', 3, async (url, init) => { removed.push([String(url), init.method]); return new Response(null, {status: 204}); });
  assert.match(removed[0][0], /\/v2\/person-profiles\/per%201\/identity-photos\/3$/);
  assert.equal(removed[0][1], 'DELETE');
}
// The person row: Core's minimum-set flag; an older Core without it needs all ten.
{
  const row = extra => ({person_id: 'p', display_name: 'x', relationship: 'CHILD', revision: 1, identity_photo_count: 5, ...extra});
  const listed = async rows => client.listPeople('t', async () => new Response(JSON.stringify({people: rows}), {status: 200, headers: {'Content-Type': 'application/json'}}));
  const [fresh, old, oldFull] = await listed([
    row({identity_photo_complete: true, identity_photo_face_count: 3, identity_photo_body_count: 2}),
    row({}),
    row({identity_photo_count: 10}),
  ]);
  assert.deepEqual([fresh.identityPhotoComplete, fresh.identityPhotoFaceCount, fresh.identityPhotoBodyCount], [true, 3, 2]);
  assert.deepEqual([old.identityPhotoComplete, old.identityPhotoFaceCount], [false, null]);
  assert.equal(oldFull.identityPhotoComplete, true);
}

// SOS intake (contract B1): old Core (no intake) and new Core both accepted.
{
  const sosRow = intake => ({sos_id: 'hsos_01', person_id: 'per_01', display_name: '민수', status: 'ACTIVE', last_seen_at: '2026-10-08T00:00:00Z', last_seen_summary: '서울', description: null, matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false, ...(intake === undefined ? {} : {intake})});
  const post = intake => client.createPersonSos('t', {personId: 'per_01', lastSeenAt: '2026-10-08T00:00:00Z', lastSeenSummary: '서울', matchingConsentConfirmed: true}, async () => new Response(JSON.stringify({sos: sosRow(intake)}), {status: 201, headers: {'Content-Type': 'application/json'}}));
  const old = await post(undefined);
  assert.equal(old.intake, null);
  assert.equal(client.personSosReceivedMessage('민수', old), `민수 실종 상태로 전환했습니다. ${NOT_POLICE}`);
  const expected = {
    DELIVERED: '민수 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 담당 관리자에게 알림을 보냈습니다.',
    PENDING: '민수 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 관리자 알림을 다시 보내고 있습니다. 접수는 이미 완료되었습니다.',
    RETRYING: '민수 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 관리자 알림을 다시 보내고 있습니다. 접수는 이미 완료되었습니다.',
    FAILED: '민수 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 관리자 알림 전송이 지연되고 있습니다. 접수는 완료되었으며 계속 다시 보냅니다.',
  };
  for (const [state, text] of Object.entries(expected)) {
    const created = await post({received: true, review_status: 'RECEIVED', admin_notification: state, police_report_filed: false});
    assert.equal(created.intake.adminNotification, state);
    assert.equal(client.personSosReceivedMessage('민수', created), `${text} ${NOT_POLICE}`);
  }
  // A misbehaving intake block never fails the SOS and never reads as a police report.
  const odd = await post({received: true, admin_notification: 'SOMETHING', police_report_filed: true});
  const oddText = client.personSosReceivedMessage('민수', odd);
  assert.equal(oddText, `민수 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. ${NOT_POLICE}`);
  for (const phrase of [...FORBIDDEN, ...POLICE]) assert.ok(!oddText.includes(phrase), phrase);
  assert.equal(client.personSosReceivedMessage('민수', await post({received: false})), `민수 실종 상태로 전환했습니다. ${NOT_POLICE}`);
  // The list keeps working with and without intake.
  const listed = await client.listPersonSos('t', async () => new Response(JSON.stringify({items: [sosRow(undefined), sosRow({received: true, admin_notification: 'DELIVERED'})]}), {status: 200, headers: {'Content-Type': 'application/json'}}));
  assert.equal(listed.length, 2);
}
// Person found-report review states as the reporter reads them. The pet found
// report keeps the shared foundReviewStateCopy table (pet Core is unchanged).
assert.deepEqual({...common.personFoundReviewStateCopy('QUEUED')}, {label: '접수됨', tone: 'progress', detail: QUEUED_DETAIL});
assert.deepEqual({...common.personFoundReviewStateCopy('CLOSED')}, {label: '검토 종료', tone: 'neutral', detail: CLOSED_DETAIL});
for (const state of ['ANALYZING', 'ADMIN_REVIEW']) assert.equal(common.personFoundReviewStateCopy(state), common.personFoundReviewStateCopy('QUEUED'), state);
assert.equal(common.personFoundReviewStateCopy('NO_RELIABLE_MATCH'), common.personFoundReviewStateCopy('CLOSED'));
for (const state of REVIEW_STATES) {
  const copy = JSON.stringify(common.personFoundReviewStateCopy(state));
  for (const phrase of RESULT_DISCLOSURE) assert.ok(!copy.includes(phrase), `person review state ${state} must not say "${phrase}"`);
}
assert.equal(common.foundReviewStateCopy('NO_RELIABLE_MATCH').label, common.NO_RELIABLE_MATCH_LABEL, 'the pet table stays as it was');
console.log('SAFECARE-PHOTO-BULK-UPLOAD-01 rules PASS');

// ------------------------------------------------------------ B. source
const ui = read('site-person-ui.js');
const bulkSource = read('site-person-bulk-photos.js');
const personClient = read('site-person.js');
const copyOf = text => text.split(/\r?\n/).filter(line => !line.trimStart().startsWith('//')).join('\n');
for (const phrase of FORBIDDEN) assert.ok(!copyOf(bulkSource).includes(phrase), `site-person-bulk-photos.js must not render "${phrase}"`);
for (const [label, text] of [['site-person-bulk-photos.js', bulkSource], ['site-person-ui.js', ui], ['site-person.js', personClient]]) {
  for (const phrase of POLICE) assert.ok(!copyOf(text).includes(phrase), `${label} must not render "${phrase}"`);
}
assert.ok(bulkSource.includes(`'${WARNING}'`), 'the warning sentence is exact');
assert.ok(!bulkSource.includes('classifyPersonIdentityPhoto') && !bulkSource.includes('putPersonIdentityPhoto'), 'the batch uses the slot-free POST only');
assert.match(ui, /import \{createPersonBulkPhotos, personPhotoSetMessage\} from '\.\/site-person-bulk-photos\.js\?v=aset-[0-9a-f]{12}';/);
const photoStep = ui.slice(ui.indexOf('const renderPhotoStep = '), ui.indexOf('const renderReviewStep = '));
assert.ok(photoStep.indexOf('bulkPhotos.render({storedCount: photos.length})') > 0 && photoStep.indexOf('bulkPhotos.render({storedCount: photos.length})') < photoStep.indexOf("const grid = el('div', 'safecare-slot-grid')"), 'the bulk panel sits above the ten tiles');
assert.ok(photoStep.includes('isBusy: () => busy') && photoStep.includes('setBusy: value => { busy = value; }'), 'the bulk run shares the screen\'s busy flag');
assert.ok(photoStep.includes('next.disabled = !set.complete;'), 'the next step opens at the minimum set (Core\'s flag)');
const tile = ui.slice(ui.indexOf('const photoTile = '), ui.indexOf('const renderPhotoStep = '));
assert.ok(!/type = 'file'|putPersonIdentityPhoto|이 칸 다시 고르기/.test(tile), 'a tile has no photo picker any more');
assert.ok(tile.includes('if (!removable || !filled) return tile;') && tile.includes('deletePersonIdentityPhoto('), 'only 사진 갱신·관리 can take a stored photo out');
for (const phrase of TEN_REQUIRED) assert.ok(!copyOf(photoStep).includes(phrase), `the photo step must not make ten look required: "${phrase}"`);
assert.ok(ui.includes('showStatus(personSosReceivedMessage(person.displayName, created))'), 'the SOS success copy comes from the intake-aware message');
assert.ok(!ui.includes('`${person.displayName} 실종 상태로 전환했습니다.`'), 'the old one-line SOS copy is replaced');
const index = read('index.html');
const callback = read('auth/callback/index.html');
assert.match(index, /<link rel="stylesheet" href="site-person-bulk\.css\?v=aset-[0-9a-f]{12}" \/>/);
assert.match(callback, /<link rel="stylesheet" href="\/site-person-bulk\.css\?v=aset-[0-9a-f]{12}" \/>/);
assert.match(read('site-person-bulk.css'), /\.person-bulk \{/);
for (const phrase of RESULT_DISCLOSURE) assert.ok(!copyOf(ui).includes(phrase), `site-person-ui.js must not render "${phrase}"`);
assert.ok(!/(^|[^A-Za-z])foundReviewStateCopy\(/.test(ui), 'the person screen reads review states only from the person table');
assert.equal((ui.match(/personFoundReviewStateCopy\(/g) || []).length, 2, 'both person review-state texts use the person table');
console.log('SAFECARE-PHOTO-BULK-UPLOAD-01 source PASS');

// ------------------------------------------------------------ C. browser
function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for the bulk-upload render validation (set CHROME_BIN).');
}

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const FIXTURE = `.safecare-photo-bulk-${process.pid}.html`;
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-conversation.css" />
<link rel="stylesheet" href="/site-person.css" />
<link rel="stylesheet" href="/site-person-bulk.css" />
<link rel="stylesheet" href="/site-safecare.css" />
<style>html,body{margin:0;background:var(--lotbi-bg-primary,#fff)}#host{box-sizing:border-box;max-width:960px;margin:0 auto;padding:16px}</style>
<script>
  const PERSON = 'aaaaaaaa-0000-4000-8000-0000000000b1';
  const SLOT_CODES = ${JSON.stringify(SLOT_CODES)};
  globalThis.__core = {filled: new Map(), rules: {}, calls: [], posts: [], deletes: [], inflight: 0, maxInflight: 0, delay: 4, postStatus: 0, sosIntake: null, sosPosted: false};
  globalThis.__names = new Map();
  const nameOf = uri => __names.get(uri) || '?';
  const counts = () => {
    const values = [...__core.filled.values()];
    const body = values.filter(item => item.cat === 'BODY').length;
    return {face: values.length - body, body, total: values.length, complete: values.length - body >= 3 && body >= 2};
  };
  const person = () => {
    const c = counts();
    return {person_id: PERSON, display_name: '한지우', nickname: '', relationship: 'CHILD', birth_year: 2016, birthday_month: 5, revision: 1,
      has_photo: c.complete, identity_photo_count: c.total, identity_photo_required: 10, identity_photo_minimum: 5,
      identity_photo_face_count: c.face, identity_photo_body_count: c.body, identity_photo_face_minimum: 3, identity_photo_body_minimum: 2,
      identity_photo_complete: c.complete, identity_photo_state: c.complete ? 'CURRENT' : 'INCOMPLETE',
      identity_photo_expires_at: c.complete ? '2027-03-01T00:00:00Z' : null, identity_photo_days_remaining: c.complete ? 140 : null,
      identity_photo_renewal_reminder_days: null, identity_photo_validity_days: c.complete ? 180 : null};
  };
  const validity = () => { const c = counts(); return {state: c.complete ? 'CURRENT' : 'INCOMPLETE', photo_count: c.total, required_count: 10, minimum_count: 5, face_count: c.face, body_count: c.body, face_minimum: 3, body_minimum: 2, complete: c.complete}; };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  const view = (slot, item) => ({slot_index: slot, slot_code: item.cat === 'BODY' ? 'UPPER_BODY_FRONT' : 'FACE_FRONT', category: item.cat, revision: 1, width: 640, height: 640, updated_at: '2026-10-10T00:00:00Z'});
  const sosRow = () => ({sos_id: 'hsos_0123456789abcdef0123', person_id: PERSON, display_name: '한지우', status: 'ACTIVE', last_seen_at: '2026-10-08T01:00:00Z', last_seen_summary: '망원한강공원 입구', description: null, matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false, ...(__core.sosIntake ? {intake: __core.sosIntake} : {})});
  const handle = async (target, method, init) => {
    let m;
    if (/\/content$/.test(target)) return png();
    if (target === '/v2/person-profiles' && method === 'GET') return json({people: [person()]});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/)) && method === 'POST') {
      const uri = JSON.parse(init.body).photo_data_uri;
      const name = nameOf(uri);
      __core.calls.push('POST ' + name);
      __core.posts.push(name);
      if (__core.postStatus) return json({detail: 'Not Found'}, __core.postStatus);
      const rule = __core.rules[name] || {code: 'NO_PERSON'};
      if (rule.code) return json({detail: {code: 'PERSON_IDENTITY_PHOTO_' + rule.code}}, 422);
      for (const [slot, item] of __core.filled) if (item.uri === uri) return json({photo: view(slot, item), category: item.cat, identity_check: 'SAME', validity: validity(), idempotent_replay: true});
      if (__core.filled.size >= 10) return json({detail: {code: 'PERSON_IDENTITY_PHOTOS_FULL'}}, 409);
      const order = rule.cat === 'BODY' ? [6, 7, 10, 9, 8, 5, 4, 3, 2, 1] : [1, 8, 2, 3, 9, 10, 4, 5, 7, 6];
      const slot = order.find(index => !__core.filled.has(index));
      const item = {uri, cat: rule.cat};
      __core.filled.set(slot, item);
      return json({photo: view(slot, item), category: item.cat, identity_check: 'SAME', validity: validity(), idempotent_replay: false}, 201);
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/))) {
      return json({photos: [...__core.filled.entries()].sort((a, b) => a[0] - b[0]).map(([slot, item]) => view(slot, item))});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos\/(\d+)$/)) && method === 'DELETE') {
      __core.calls.push('DELETE ' + m[2]); __core.deletes.push(Number(m[2]));
      __core.filled.delete(Number(m[2]));
      return new Response(null, {status: 204});
    }
    if (method === 'PUT' || method === 'DELETE') { __core.calls.push(method + ' ' + target); return json({}, 405); }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/))) return json({person: person()});
    if (target.startsWith('/v2/person-sos?status=ACTIVE')) return json({items: __core.sosPosted ? [sosRow()] : []});
    if (target === '/v2/person-sos' && method === 'POST') { __core.calls.push('POST SOS'); __core.sosPosted = true; return json({sos: sosRow()}, 201); }
    if (target === '/v2/person-sos/notices/candidates') return json({notices: []});
    if (target === '/v2/safecare/human-sightings') return json({reports: (__core.sightings || []).map(row => ({minimum_photo_count: 5, maximum_photo_count: 10, can_submit: false, message: '', description: '', automatic_identity_decision: false, contact_details_exposed: false, result_disclosed: false, ...row}))});
    return json({}, 404);
  };
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = init.method || 'GET';
    // Concurrency of the photo writes only (page loads fetch in parallel).
    const photoCall = /\/identity-photos(\/\d+)?$/.test(target) && method !== 'GET';
    if (photoCall) { __core.inflight += 1; __core.maxInflight = Math.max(__core.maxInflight, __core.inflight); }
    try { await new Promise(resolve => setTimeout(resolve, __core.delay)); return await handle(target, method, init); }
    finally { if (photoCall) __core.inflight -= 1; }
  };
</script>
</head><body><div id="host"></div>
<script type="module">
  import {mountPersonCareManager} from '/site-person-ui.js';
  const host = document.getElementById('host');
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 8000) => { for (let t = 0; t < ms && !check(); t += 25) await __wait(25); return check(); };
  globalThis.__mount = async (initialSurface = 'home') => { host.replaceChildren(); await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface}); };
  let colour = 0;
  const blobs = new Map();
  globalThis.__file = async (name, copyOf = '') => {
    let blob = copyOf ? blobs.get(copyOf) : null;
    if (!blob) {
      colour += 1;
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext('2d');
      context.fillStyle = 'rgb(' + ((colour * 53) % 256) + ',' + ((colour * 97) % 256) + ',' + ((colour * 151) % 256) + ')';
      context.fillRect(0, 0, 320, 320);
      context.fillStyle = '#fff'; context.fillRect(colour % 300, 7, 9, 9);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      blobs.set(name, blob);
      const uri = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      __names.set(uri, name);
    }
    return new File([blob], name + '.png', {type: 'image/png'});
  };
  globalThis.__pick = async (input, specs) => {
    const transfer = new DataTransfer();
    for (const spec of specs) transfer.items.add(await __file(...(Array.isArray(spec) ? spec : [spec])));
    input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
  };
  globalThis.__panel = () => document.querySelector('[data-person-bulk]');
  globalThis.__idle = () => { const panel = __panel(); return Boolean(panel && panel.dataset.personBulkBusy === 'false' && !document.querySelector('[data-person-care-surface][data-person-bulk-running]')); };
  globalThis.__done = async () => {
    await __wait(30);
    const settled = await __until(() => __idle() && (__panel().querySelector('[data-person-bulk-summary]') || __panel().querySelector('[data-person-bulk-notice]')), 15000);
    if (!settled) throw new Error('the bulk panel did not settle');
    await __wait(30);
  };
  globalThis.__statusLog = [];
  new MutationObserver(() => {
    const text = document.querySelector('[data-person-bulk-status]')?.textContent || '';
    if (text && __statusLog[__statusLog.length - 1] !== text) __statusLog.push(text);
  }).observe(document.body, {subtree: true, childList: true, characterData: true});
  globalThis.__items = () => [...document.querySelectorAll('[data-person-bulk-item]')].map(row => ({
    id: Number(row.dataset.personBulkItem), title: row.querySelector('.person-bulk-item-title')?.textContent || '',
    state: row.dataset.personBulkState, slot: Number(row.dataset.personBulkSlot || 0), category: row.dataset.personBulkCategory || '', code: row.dataset.personErrorCode || '',
    badge: row.querySelector('.safecare-badge')?.textContent || '', line: row.querySelector('.person-bulk-item-slot')?.textContent || '',
    message: row.querySelector('[data-person-bulk-message]')?.textContent || '', replace: Boolean(row.querySelector('[data-person-bulk-replace]')),
  }));
  globalThis.__counter = () => ({text: document.querySelector('[data-safecare-photo-count]')?.textContent || '', complete: document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoComplete || '', note: document.querySelector('[data-person-photo-set-note]')?.textContent || '', next: document.querySelector('[data-person-photos-next]')?.disabled});
  globalThis.__layout = () => {
    const panel = __panel();
    const box = panel.getBoundingClientRect();
    const outside = [...panel.querySelectorAll('button, .person-bulk-item, p')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1);
    }).map(node => node.textContent.slice(0, 40));
    const small = [...panel.querySelectorAll('button')].filter(node => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 43.5).map(node => node.textContent);
    return {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, outside, small};
  };
  globalThis.__openPhotos = async () => {
    await __mount();
    await __until(() => document.querySelector('[data-person-photos]'));
    document.querySelector('[data-person-photos]').click();
    await __until(() => __panel() && document.querySelector('[data-person-slot-grid]'));
  };
  globalThis.__ready = true;
</script></body></html>`;

function serve() {
  const server = http.createServer((request, response) => {
    const rel = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
    if (rel === FIXTURE) { response.writeHead(200, {'Content-Type': MIME['.html']}); response.end(FIXTURE_HTML); return; }
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

class Cdp {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (!data.id || !this.pending.has(data.id)) return;
      const {resolve, reject} = this.pending.get(data.id); this.pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error))); else resolve(data.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(`page error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    return result.result.value;
  }
}

// What Core makes of each picked photo (by file name): a FACE or BODY photo,
// or a refusal reason.
const R = {
  front1: {cat: 'FACE'}, front2: {cat: 'FACE'}, left45: {cat: 'FACE'}, left45b: {cat: 'FACE'}, right45: {cat: 'FACE'}, right45b: {cat: 'FACE'},
  leftp: {cat: 'FACE'}, rightp: {cat: 'FACE'}, upper: {cat: 'BODY'}, full: {cat: 'BODY'}, extra1: {cat: 'FACE'}, extra2: {cat: 'FACE'},
  dog: {code: 'NO_PERSON'}, car: {code: 'NON_IDENTITY_IMAGE'}, group: {code: 'MULTIPLE_FACES'}, other: {code: 'DIFFERENT_PERSON'},
  wrongfront: {cat: 'FACE'}, left45x: {code: 'DIFFERENT_PERSON'}, upperx: {code: 'DIFFERENT_PERSON'}, fullx: {code: 'DIFFERENT_PERSON'},
};
const TEN = ['full', 'left45', 'upper', 'front1', 'rightp', 'right45', 'left45b', 'front2', 'leftp', 'right45b'];
const PREFILL = (faces, bodies) => [...Array.from({length: faces}, (_, i) => [[1, 8, 2, 3, 9, 10, 4, 5][i], 'FACE']), ...Array.from({length: bodies}, (_, i) => [[6, 7][i], 'BODY'])];

const SHOTS = process.env.SAFECARE_SCREENSHOT_DIR ? path.resolve(process.env.SAFECARE_SCREENSHOT_DIR) : '';
if (SHOTS) fs.mkdirSync(SHOTS, {recursive: true});
const VIEWPORTS = [['mobile-360', 360, 780], ['mobile-390', 390, 844], ['mobile-412', 412, 915], ['desktop-1440', 1440, 900]]
  .filter(([label]) => !process.env.SAFECARE_BULK_VIEWPORTS || process.env.SAFECARE_BULK_VIEWPORTS.split(',').includes(label));

const server = await serve();
const profileDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-photo-bulk-'));
const browser = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], {stdio: 'ignore'});
try {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let t = 0; t < 200 && !fs.existsSync(portFile); t += 1) await new Promise(resolve => setTimeout(resolve, 100));
  const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  const cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const [label, width, height] of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
    // Each scenario starts from a fresh page and a fresh in-memory Core.
    const scenario = async (name, setup, body) => {
      const started = Date.now();
      await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${FIXTURE}`});
      let ready = false;
      for (let t = 0; t < 300 && !ready; t += 1) {
        ready = await cdp.evaluate('return globalThis.__ready === true;').catch(() => false);
        if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error(`${label} ${name}: the fixture page did not load`);
      const {prefill, ...rest} = setup;
      const result = await cdp.evaluate(`
        Object.assign(__core, ${JSON.stringify({rules: R, ...rest})});
        for (const [slot, cat] of ${JSON.stringify(prefill || [])}) __core.filled.set(slot, {uri: 'prefilled-' + slot, cat});
        ${body}
      `);
      const layout = await cdp.evaluate('return document.querySelector("[data-person-bulk]") ? __layout() : {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, outside: [], small: []};');
      const where = `${label} ${name}`;
      assert.ok(layout.overflow <= 1, `${where}: horizontal overflow ${layout.overflow}px`);
      assert.deepEqual(layout.outside, [], `${where}: everything stays inside the panel`);
      assert.deepEqual(layout.small, [], `${where}: buttons keep a 44px touch target`);
      const text = await cdp.evaluate('return {page: document.body.innerText, panel: document.querySelector("[data-person-bulk]")?.innerText || "", status: document.querySelector(".person-status")?.textContent || ""};');
      for (const phrase of FORBIDDEN) assert.ok(!text.panel.includes(phrase) && !text.status.includes(phrase), `${where}: the bulk panel must not say "${phrase}"`);
      for (const phrase of POLICE) assert.ok(!text.page.includes(phrase), `${where}: the screen must not say "${phrase}"`);
      if (SHOTS) {
        const metrics = await cdp.send('Page.getLayoutMetrics');
        const contentHeight = Math.min(Math.ceil(metrics.cssContentSize?.height || metrics.contentSize.height), 7000);
        const shot = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x: 0, y: 0, width, height: contentHeight, scale: 1}});
        fs.writeFileSync(path.join(SHOTS, `${label}-${name}.png`), Buffer.from(shot.data, 'base64'));
      }
      if (process.env.SAFECARE_BULK_TIMING) console.log(`    ${where}: ${Date.now() - started}ms`);
      return {result, where};
    };

    // (i) Before picking: the exact warning, the easy guide, the tiles as examples, nothing that makes ten look required.
    {
      const {result: r, where} = await scenario('i-selection', {}, `
        await __openPhotos();
        const panel = __panel();
        const input = panel.querySelector('[data-person-bulk-input]');
        return {
          warning: panel.querySelector('[data-person-bulk-warning]')?.textContent,
          angles: panel.querySelector('[data-person-bulk-angles]')?.textContent,
          pick: panel.querySelector('[data-person-bulk-pick]')?.textContent,
          multiple: input.multiple, accept: input.accept, type: input.type,
          beforeGrid: Boolean(panel.compareDocumentPosition(document.querySelector('[data-person-slot-grid]')) & Node.DOCUMENT_POSITION_FOLLOWING),
          tiles: document.querySelectorAll('[data-person-slot]').length,
          artwork: document.querySelectorAll('[data-person-slot] .person-slot-guide-image').length,
          visible: [...document.querySelectorAll('[data-person-slot] .safecare-slot-visible')].filter(node => node.textContent.startsWith('보여야 하는 부분')).length,
          tileControls: document.querySelectorAll('[data-person-slot] button, [data-person-slot] input').length,
          examples: document.querySelector('[data-person-slot-examples]')?.textContent || '',
          step: document.querySelector('[data-person-care-surface]').innerText,
          counter: __counter(),
          statusRole: panel.querySelector('[data-person-bulk-status]').getAttribute('role'),
        };
      `);
      assert.equal(r.warning, WARNING, `${where}: warning verbatim`);
      assert.equal(r.angles, ANGLES, where);
      assert.equal(r.pick, '사진 여러 장 선택', where);
      assert.equal(r.multiple, true, where);
      assert.equal(r.accept, 'image/*', where);
      assert.equal(r.beforeGrid, true, `${where}: the panel sits above the tiles`);
      assert.equal(r.tiles, 10, `${where}: the ten example tiles stay`);
      assert.equal(r.artwork, 10, `${where}: every tile keeps its example picture`);
      assert.equal(r.visible, 10, `${where}: every tile keeps '보여야 하는 부분'`);
      assert.equal(r.tileControls, 0, `${where}: a registration tile has no button or picker`);
      assert.equal(r.examples, '아래 10칸은 어떤 사진이 있으면 좋은지 보여 주는 예시예요. 사진은 위의 ‘사진 여러 장 선택’으로 한 번에 올려 주세요. 칸을 다 채우지 않아도 돼요.', where);
      assert.deepEqual(r.counter, {text: '얼굴 0/3 · 몸 0/2지금 0장 · 10장까지 올릴 수 있어요', complete: 'false', note: NEEDS_ALL, next: true}, where);
      for (const phrase of TEN_REQUIRED) assert.ok(!r.step.includes(phrase), `${where}: nothing makes ten look required ("${phrase}")`);
      assert.equal(r.statusRole, 'status', where);
    }

    // (a) Ten everyday photos: sent one at a time in the order picked, all kept, the set complete.
    {
      const {result: r, where} = await scenario('a-ten', {delay: 25}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ${JSON.stringify(TEN)});
        const running = document.querySelector('[data-person-care-surface]').dataset.personBulkRunning;
        await __done();
        return {
          running, posts: [...__core.posts], maxInflight: __core.maxInflight,
          summary: __panel().querySelector('[data-person-bulk-summary]')?.textContent,
          items: __items(), statusLog: [...__statusLog], counter: __counter(),
          focused: document.activeElement?.dataset?.personBulkSummary === '',
          summaryDrawn: [...__panel().querySelectorAll('*')].filter(node => !node.children.length && node.textContent === '등록 성공 10장 · 실패 0장' && node.getBoundingClientRect().height > 2).length,
          filled: [...__core.filled.keys()].sort((a, b) => a - b),
        };
      `);
      assert.equal(r.running, 'true', `${where}: the surface marks the run`);
      assert.deepEqual(r.posts, TEN, `${where}: one POST per photo, in the order picked`);
      assert.equal(r.maxInflight, 1, `${where}: one request at a time`);
      assert.equal(r.summary, '등록 성공 10장 · 실패 0장', where);
      assert.ok(r.items.every(item => item.state === 'STORED' && item.badge === '등록 성공'), where);
      assert.deepEqual(r.items.map(item => item.line), TEN.map(name => (R[name].cat === 'BODY' ? '상반신·전신 사진으로 등록했어요' : '얼굴 사진으로 등록했어요')), `${where}: each photo says what kind it was stored as`);
      for (let i = 1; i <= 10; i += 1) assert.ok(r.statusLog.includes(`사진을 확인하고 있어요 (${i}/10)`), `${where}: progress ${i}/10`);
      assert.deepEqual(r.counter, {text: '얼굴 3/3 · 몸 2/2지금 10장 · 10장까지 올릴 수 있어요', complete: 'true', note: '등록에 필요한 사진이 모두 있어요.', next: false}, where);
      assert.deepEqual(r.filled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], where);
      assert.equal(r.focused, true, `${where}: focus moves to the result`);
      assert.equal(r.summaryDrawn, 1, `${where}: the summary is drawn once`);
    }

    // (b) Mixed: an animal, a car and another person among real photos; then replace only a wrong photo.
    {
      const {result: r, where} = await scenario('b-mixed-replace', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'dog', 'car', 'other', 'left45', 'upper']);
        await __done();
        const first = {posts: [...__core.posts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent, anchor: Boolean(document.querySelector('[data-person-bulk-anchor-hint]'))};
        const row = id => document.querySelector('[data-person-bulk-item="' + id + '"]');
        await __pick(row(4).querySelector('[data-person-bulk-replace-input]'), ['right45']);
        await __done();
        return {first, posts: [...__core.posts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent,
          deletes: [...__core.deletes], filled: [...__core.filled.keys()].sort((a, b) => a - b), counter: __counter()};
      `);
      const byId = items => Object.fromEntries(items.map(item => [item.id, item]));
      const first = byId(r.first.items);
      assert.deepEqual(r.first.posts, ['front1', 'dog', 'car', 'other', 'left45', 'upper'], `${where}: every photo is asked about, in order`);
      assert.equal(r.first.summary, '등록 성공 3장 · 실패 3장', where);
      assert.equal(first[1].state, 'STORED');
      assert.deepEqual([first[2].state, first[2].message], ['REFUSED', MSG.NO_PERSON], `${where}: animal reason`);
      assert.deepEqual([first[3].state, first[3].message], ['REFUSED', MSG.NON_IDENTITY_IMAGE], `${where}: object reason`);
      assert.deepEqual([first[4].state, first[4].message, first[4].code], ['REFUSED', MSG.DIFFERENT_PERSON, 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON'], `${where}: other person reason`);
      assert.ok(first[2].replace && first[3].replace && first[4].replace && !first[1].replace, `${where}: only a refused photo can be replaced`);
      assert.equal(r.first.anchor, false, `${where}: one different-person refusal is no anchor warning`);
      assert.deepEqual(r.posts, ['front1', 'dog', 'car', 'other', 'left45', 'upper', 'right45'], `${where}: the replacement is one more POST`);
      assert.equal(byId(r.items)[4].state, 'STORED');
      assert.equal(r.summary, '등록 성공 4장 · 실패 2장', where);
      assert.deepEqual(r.deletes, [], `${where}: nothing is ever deleted by a batch`);
      assert.deepEqual(r.filled, [1, 2, 6, 8], `${where}: earlier successes stay stored`);
      assert.equal(r.counter.note, '상반신·전신 사진 1장이 더 있으면 등록을 마칠 수 있어요.', `${where}: three faces and one body so far`);
    }

    // (c) Five photos — three faces and two bodies — open the next step; more is only recommended.
    {
      const {result: r, where} = await scenario('c-five', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'left45', 'upper', 'right45']);
        await __done();
        const four = __counter();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['full']);
        await __done();
        return {four, five: __counter()};
      `);
      assert.deepEqual(r.four, {text: '얼굴 3/3 · 몸 1/2지금 4장 · 10장까지 올릴 수 있어요', complete: 'false', note: '상반신·전신 사진 1장이 더 있으면 등록을 마칠 수 있어요.', next: true}, `${where}: four photos are one body short`);
      assert.deepEqual(r.five, {text: '얼굴 3/3 · 몸 2/2지금 5장 · 10장까지 올릴 수 있어요', complete: 'true', note: RECOMMEND, next: false}, `${where}: five photos complete the set`);
    }

    // (g) More than fits: ten in all, counting the photos already stored.
    {
      const {result: r, where} = await scenario('g-room', {prefill: PREFILL(6, 2)}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['extra1', 'extra2', 'front1', 'front2']);
        await __done();
        return {posts: [...__core.posts], notices: [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent), items: __items().length};
      `);
      assert.deepEqual(r.posts, ['extra1', 'extra2'], `${where}: only the two that fit are sent`);
      assert.deepEqual(r.notices, ['사진은 모두 합쳐 10장까지 등록할 수 있어요. 처음 고른 2장만 확인할게요.'], where);
      assert.equal(r.items, 2, where);
    }

    // (h) The first stored photo may be someone else.
    {
      const {result: r, where} = await scenario('h-anchor-hint', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['wrongfront', 'left45x', 'upperx', 'fullx']);
        await __done();
        return {hint: document.querySelector('[data-person-bulk-anchor-hint]')?.textContent || '', summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
      `);
      assert.equal(r.hint, ANCHOR, `${where}: anchor hint verbatim`);
      assert.equal(r.summary, '등록 성공 1장 · 실패 3장', where);
    }

    // (k) An older Core without the slot-free POST: the run stops at the first answer, nothing is stored.
    {
      const {result: r, where} = await scenario('k-post-unavailable', {postStatus: 404}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'left45', 'upper']);
        await __done();
        return {notices: [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent), posts: [...__core.posts], items: __items().map(item => item.state), filled: __core.filled.size};
      `);
      assert.deepEqual(r.notices, [bulk.PERSON_BULK_UNAVAILABLE], where);
      assert.deepEqual(r.posts, ['front1'], `${where}: the run stops at the first answer`);
      assert.deepEqual(r.items, ['REFUSED', 'SKIPPED', 'SKIPPED'], where);
      assert.equal(r.filled, 0, where);
    }

    // (m) 사진 갱신·관리: a stored photo is taken out only on a second tap.
    {
      const {result: r, where} = await scenario('m-manage-remove', {prefill: PREFILL(4, 2)}, `
        await __mount();
        await __until(() => document.querySelector('[data-person-photos]'));
        document.querySelector('[data-person-photos]').click();
        await __until(() => document.querySelector('[data-person-slot-grid]'));
        const removers = () => [...document.querySelectorAll('[data-person-slot-remove]')].map(button => Number(button.dataset.personSlotRemove));
        const before = removers();
        const button = document.querySelector('[data-person-slot-remove="8"]');
        button.click();
        await __wait(50);
        const armed = {label: button.textContent, deletes: [...__core.deletes]};
        button.click();
        await __until(() => __core.deletes.length === 1 && document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === '5');
        return {before, armed, deletes: [...__core.deletes], after: removers(), counter: __counter(), title: document.querySelector('.person-form-title')?.textContent || ''};
      `);
      assert.deepEqual(r.before, [1, 2, 3, 6, 7, 8], `${where}: only filled tiles offer 사진 빼기`);
      assert.deepEqual(r.armed, {label: '한 번 더 누르면 사진을 빼요', deletes: []}, `${where}: the first tap only asks`);
      assert.deepEqual(r.deletes, [8], `${where}: the second tap takes that photo out`);
      assert.deepEqual(r.after, [1, 2, 3, 6, 7], where);
      assert.equal(r.title, '한지우 사진 갱신·관리', where);
      assert.equal(r.counter.complete, 'true', `${where}: three faces and two bodies are still a set`);
    }

    // (l) The reporter's own found reports never disclose a comparison result,
    // whatever review_state an older or newer Core sends.
    {
      const states = ['QUEUED', 'ADMIN_REVIEW', 'ANALYZING', 'NO_RELIABLE_MATCH', 'CLOSED', 'INSUFFICIENT_QUALITY'];
      const sightings = states.map((state, index) => ({report_id: 'hs-' + state.toLowerCase(), observed_at: '2026-10-0' + (index + 1) + 'T03:00:00Z', location_summary: '정자역 ' + (index + 1) + '번 출구', review_state: state, photo_count: 6}));
      const {result: r, where} = await scenario('l-found-report-privacy', {sightings}, `
        await __mount('sighting');
        await __until(() => document.querySelectorAll('[data-person-found-report]').length === ${states.length});
        const cards = Object.fromEntries([...document.querySelectorAll('[data-person-found-report]')].map(card => [card.dataset.safecareReviewState, {badge: card.querySelector('.safecare-badge')?.textContent || '', text: card.textContent}]));
        return {cards, screen: document.querySelector('[data-person-care-surface]').innerText};
      `);
      for (const state of ['QUEUED', 'ADMIN_REVIEW', 'ANALYZING']) {
        assert.equal(r.cards[state]?.badge, '접수됨', `${where}: ${state}`);
        assert.ok(r.cards[state].text.includes(QUEUED_DETAIL), `${where}: ${state} detail`);
      }
      for (const state of ['NO_RELIABLE_MATCH', 'CLOSED']) {
        assert.equal(r.cards[state]?.badge, '검토 종료', `${where}: ${state}`);
        assert.ok(r.cards[state].text.includes(CLOSED_DETAIL), `${where}: ${state} detail`);
      }
      assert.equal(r.cards.INSUFFICIENT_QUALITY?.badge, '사진 보완 필요', where);
      for (const phrase of RESULT_DISCLOSURE) assert.ok(!r.screen.includes(phrase), `${where}: the found-report screen must not say "${phrase}"`);
    }

    // (j) SOS success copy: admin inbox + notification state + always the 112 line.
    for (const [mode, intake, expected] of [
      ['delivered', {received: true, review_status: 'RECEIVED', admin_notification: 'DELIVERED', police_report_filed: false}, `한지우 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 담당 관리자에게 알림을 보냈습니다. ${NOT_POLICE}`],
      ['retrying', {received: true, review_status: 'RECEIVED', admin_notification: 'RETRYING', police_report_filed: false}, `한지우 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다. 관리자 알림을 다시 보내고 있습니다. 접수는 이미 완료되었습니다. ${NOT_POLICE}`],
      ['no-intake', null, `한지우 실종 상태로 전환했습니다. ${NOT_POLICE}`],
    ]) {
      const {result: r, where} = await scenario(`j-sos-${mode}`, {prefill: PREFILL(8, 2), sosIntake: intake}, `
        await __mount();
        await __until(() => document.querySelector('[data-person-sos-open]'));
        document.querySelector('[data-person-sos-open]').click();
        await __until(() => document.querySelector('[data-person-sos-form] input[type=checkbox]'));
        const form = document.querySelector('[data-person-sos-form]');
        const place = [...form.querySelectorAll('input')].find(input => input.placeholder.startsWith('예:'));
        place.value = '망원한강공원 입구';
        form.querySelector('input[type=checkbox]').checked = true;
        form.requestSubmit();
        await __until(() => (document.querySelector('.person-status')?.textContent || '').includes('112'));
        const status = document.querySelector('.person-status');
        return {text: status.textContent, role: status.getAttribute('role'), posted: __core.calls.includes('POST SOS'), view: document.querySelector('[data-person-care-surface]').dataset.personView};
      `);
      assert.equal(r.posted, true, where);
      assert.equal(r.text, expected, `${where}: SOS copy`);
      assert.equal(r.role, 'status', where);
      assert.equal(r.view, 'list', where);
    }
    console.log(`  ${label}: bulk upload (POST one by one), five-photo set, manage remove, found-report privacy, SOS copy PASS`);
  }
} finally {
  browser.kill();
  server.close();
}
console.log('SAFECARE-PHOTO-BULK-UPLOAD-01 SITE PASS');
