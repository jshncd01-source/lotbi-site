#!/usr/bin/env node
// SAFECARE-PHOTO-BULK-UPLOAD-01 + SAFECARE-SOS-ADMIN-INTAKE (Site side).
//
// A guardian can pick up to ten identity photos at once. Core's classify hint
// (stores nothing, compares no people) says which slots each photo fits; the
// Site places them (fewer candidates first, never outside the list, never over
// a filled slot without asking), saves them one by one with the existing
// per-slot PUT in the order 1, 8, 2, 3, 9, 10, 6, 4, 5, 7, keeps every success
// when a later photo is refused, and lets only the wrong photo be replaced.
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
const ANCHOR = '정면 사진이 다른 사람일 수 있어요. 정면 사진을 먼저 확인해 주세요.';
const NOT_POLICE = '이 접수는 경찰 신고가 아닙니다. 긴급한 경우 112에 바로 신고해 주세요.';
// The bulk screen never claims certainty about who is in the photos...
const FORBIDDEN = ['100%', '확정', '일치합니다', '찾았습니다', '찾았어요', '동일인입니다', '카메라 촬영'];
// ...and no person screen ever says LOTBI reported anything to the police.
const POLICE = ['경찰 신고 완료', '신고가 경찰에 접수', '경찰에 신고했', '경찰에 접수'];
// A found report's reporter is never told whether a comparison candidate existed
// or whether anything matched (SAFECARE-SIGHTING-RESULT-PRIVACY).
const RESULT_DISCLOSURE = ['비교 후보가 있어', '일치 대상이 없', '일치 대상 없음'];
const REVIEW_STATES = ['DRAFT', 'QUEUED', 'ANALYZING', 'ADMIN_REVIEW', 'NO_RELIABLE_MATCH', 'INSUFFICIENT_QUALITY', 'CLOSED', 'SOMETHING_NEW'];
const QUEUED_DETAIL = '제보가 접수되었습니다. 관리자가 확인하고 있으며, 비교 결과는 제보자에게 공개되지 않습니다.';
const CLOSED_DETAIL = '제보 검토가 종료되었습니다. 비교 결과는 제보자에게 공개되지 않습니다.';
const SLOT_CODES = PERSON_IDENTITY_SLOTS.map(slot => slot.code);
const MSG = {
  NO_PERSON: '사람을 확인할 수 없습니다. 안내 그림처럼 등록할 사람이 크게 나온 사진을 다시 선택해 주세요.',
  NON_IDENTITY_IMAGE: '사람 식별 사진이 아닙니다. 문서·사물·화면 사진은 등록할 수 없습니다.',
  DIFFERENT_PERSON: '등록된 사람과 다른 사람으로 보이는 사진입니다. 같은 사람의 사진을 선택해 주세요.',
  TOO_BLURRY: '사진이 너무 흐립니다. 얼굴이 선명하게 보이도록 다시 촬영해 주세요.',
  MULTIPLE_FACES: '여러 사람이 함께 나온 사진은 등록할 수 없습니다. 등록할 사람 한 명만 나온 사진을 선택해 주세요.',
  WRONG_POSE: '촬영 방향이 맞지 않습니다. 안내 그림과 같은 방향으로 얼굴을 돌려 다시 촬영해 주세요.',
  DUPLICATE: '같은 사진은 여러 각도에 사용할 수 없습니다. 다른 방향에서 찍은 사진을 선택해 주세요.',
};

// ------------------------------------------------------------ A. rules
assert.deepEqual([...client.PERSON_IDENTITY_SLOT_CODES], SLOT_CODES, 'the client slot table is the guide slot table');
assert.deepEqual([...bulk.PERSON_BULK_UPLOAD_ORDER], [1, 8, 2, 3, 9, 10, 6, 4, 5, 7]);
assert.equal(bulk.PERSON_BULK_MAX_FILES, 10);
assert.equal(bulk.PERSON_BULK_WARNING, WARNING);
assert.equal(bulk.PERSON_BULK_ANCHOR_HINT, ANCHOR);
assert.match(bulk.PERSON_BULK_ANGLE_GUIDE, /서로 다른 각도/);
assert.equal(bulk.personBulkClassifyProgress(3, 10), 'AI가 사진을 분류하고 있어요 (3/10)');
assert.equal(bulk.personBulkUploadProgress(5, 10), '사진을 등록하고 있어요 (5/10)');
{
  const {kept, dropped} = bulk.limitPersonBulkFiles(Array.from({length: 12}, (_, i) => `f${i}`));
  assert.deepEqual(kept, Array.from({length: 10}, (_, i) => `f${i}`));
  assert.equal(dropped, 2);
  assert.equal(bulk.limitPersonBulkFiles(['a', 'b']).dropped, 0);
}

// Classify contract: strict shape, POST body, nothing stored, no identity claim.
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

// Assignment: fewer candidates first, first free slot of the photo's own list,
// filled slots untouched, never a slot outside the list.
{
  const E = (status, suggested) => ({status, suggested});
  const decisions = bulk.assignPersonBulkPhotos([
    E('CLEAR', [1, 8]), E('CLEAR', [6]), E('CLEAR', [1, 8]), E('CLEAR', [1, 8]), E('UNCERTAIN', [6, 7]), E('REJECTED', []), null, E('CLEAR', [2, 9]),
  ], []);
  assert.deepEqual(decisions.map(d => d.state), ['ASSIGNED', 'ASSIGNED', 'ASSIGNED', 'NEEDS_CHOICE', 'NEEDS_CHOICE', 'NOT_PLACED', 'NOT_PLACED', 'ASSIGNED']);
  assert.deepEqual([decisions[0].slot, decisions[1].slot, decisions[2].slot, decisions[7].slot], [1, 6, 8, 2]);
  assert.equal(decisions[3].reason, 'NO_FREE_SLOT');
  assert.deepEqual(decisions[3].candidates, [1, 8]);
  assert.equal(decisions[4].reason, 'UNCERTAIN');
  // The photo with one candidate wins its slot over an earlier photo with two.
  const contested = bulk.assignPersonBulkPhotos([E('CLEAR', [6, 7]), E('CLEAR', [6])], []);
  assert.deepEqual(contested.map(d => d.slot), [7, 6]);
  // Already filled on Core: not overwritten automatically.
  const filled = bulk.assignPersonBulkPhotos([E('CLEAR', [1, 8]), E('CLEAR', [4])], [1, 4]);
  assert.deepEqual(filled.map(d => [d.state, d.slot || 0]), [['ASSIGNED', 8], ['NEEDS_CHOICE', 0]]);
  for (let round = 0; round < 200; round += 1) {
    const entries = Array.from({length: 10}, () => {
      const pool = [...SLOT_CODES.keys()].map(i => i + 1).sort(() => Math.random() - 0.5);
      return E(Math.random() < 0.8 ? 'CLEAR' : 'UNCERTAIN', pool.slice(0, 1 + Math.floor(Math.random() * 3)));
    });
    const before = [3, 5].filter(() => Math.random() < 0.5);
    const placed = bulk.assignPersonBulkPhotos(entries, before);
    const slots = placed.filter(d => d.state === 'ASSIGNED').map(d => d.slot);
    assert.equal(new Set(slots).size, slots.length, 'one photo per slot');
    placed.forEach((d, i) => {
      if (d.state === 'ASSIGNED') {
        assert.ok(entries[i].suggested.includes(d.slot), 'never outside the suggested list');
        assert.ok(!before.includes(d.slot), 'never over a filled slot');
        assert.equal(entries[i].status, 'CLEAR');
      }
    });
  }
}
// Upload order, front-first rule, anchor rule, replacement plan, summary.
assert.deepEqual(bulk.orderPersonBulkUploads([7, 5, 4, 6, 10, 9, 3, 2, 8, 1].map(slot => ({slot}))).map(item => item.slot), [1, 8, 2, 3, 9, 10, 6, 4, 5, 7]);
assert.equal(bulk.personBulkNeedsFrontFirst([2, 6], []), true);
assert.equal(bulk.personBulkNeedsFrontFirst([2, 1], []), false);
assert.equal(bulk.personBulkNeedsFrontFirst([2, 6], [1]), false);
assert.equal(bulk.personBulkNeedsFrontFirst([], []), false);
const DP = 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON';
assert.equal(bulk.personBulkAnchorSuspect([{slot: 1, ok: true}, {slot: 8, ok: false, code: DP}, {slot: 2, ok: false, code: DP}], true), true);
assert.equal(bulk.personBulkAnchorSuspect([{slot: 1, ok: true}, {slot: 8, ok: false, code: DP}, {slot: 2, ok: false, code: DP}], false), false, 'only a previously empty profile');
assert.equal(bulk.personBulkAnchorSuspect([{slot: 1, ok: true}, {slot: 8, ok: false, code: DP}, {slot: 2, ok: true}, {slot: 3, ok: false, code: DP}], true), false, 'a later success clears it');
assert.equal(bulk.personBulkAnchorSuspect([{slot: 1, ok: true}, {slot: 8, ok: false, code: DP}, {slot: 2, ok: false, code: 'PERSON_IDENTITY_PHOTO_TOO_BLURRY'}], true), false, 'two different-person refusals are needed');
assert.equal(bulk.personBulkAnchorSuspect([{slot: 1, ok: false, code: 'X'}, {slot: 8, ok: false, code: DP}, {slot: 2, ok: false, code: DP}], true), false, 'no anchor stored');
assert.deepEqual(bulk.personBulkReplacementPlan({intendedSlot: 8, status: 'CLEAR', suggested: [1, 8], filled: [1]}), {action: 'PUT', slot: 8});
assert.deepEqual(bulk.personBulkReplacementPlan({intendedSlot: 8, status: 'CLEAR', suggested: [6], filled: [1]}), {action: 'MISMATCH'});
assert.deepEqual(bulk.personBulkReplacementPlan({intendedSlot: 8, status: 'UNCERTAIN', suggested: [8, 6], filled: [1]}), {action: 'PUT', slot: 8});
assert.deepEqual(bulk.personBulkReplacementPlan({intendedSlot: 8, status: 'REJECTED', suggested: [], filled: [1]}), {action: 'REJECTED'});
assert.deepEqual(bulk.personBulkReplacementPlan({intendedSlot: 6, status: 'CLEAR', suggested: [6], filled: []}), {action: 'HOLD', slot: 6});
assert.deepEqual(bulk.personBulkReplacementPlan({status: 'CLEAR', suggested: [1, 8], filled: [1]}), {action: 'PUT', slot: 8});
assert.deepEqual(bulk.personBulkReplacementPlan({status: 'CLEAR', suggested: [4], filled: [1, 4]}), {action: 'CHOOSE', reason: 'NO_FREE_SLOT', candidates: [4]});
assert.deepEqual(bulk.personBulkReplacementPlan({status: 'UNCERTAIN', suggested: [6, 7], filled: [1]}), {action: 'CHOOSE', reason: 'UNCERTAIN', candidates: [6, 7]});
assert.deepEqual(bulk.personBulkChoiceSlots([1, 8, 6], [1, 8]), [6]);
assert.equal(bulk.personBulkSummary([{state: 'STORED'}, {state: 'PUT_FAILED'}, {state: 'REJECTED'}, {state: 'NEEDS_CHOICE'}, {state: 'HELD'}, {state: 'SKIPPED'}]).text, '등록 성공 1장 · 실패 2장 · 확인 필요 2장');
assert.equal(bulk.personBulkMismatchMessage(8), '새 사진은 추가 정면 칸에 맞지 않아요. 추가 정면 칸에 맞는 사진을 선택해 주세요.');

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
assert.match(ui, /import \{createPersonBulkPhotos\} from '\.\/site-person-bulk-photos\.js\?v=aset-[0-9a-f]{12}';/);
const photoStep = ui.slice(ui.indexOf('const renderPhotoStep = '), ui.indexOf('const renderReviewStep = '));
assert.ok(photoStep.indexOf('bulkPhotos.render({filledSlots})') > 0 && photoStep.indexOf('bulkPhotos.render({filledSlots})') < photoStep.indexOf("const grid = el('div', 'safecare-slot-grid')"), 'the bulk panel sits above the ten tiles');
assert.ok(photoStep.includes('isBusy: () => busy') && photoStep.includes('setBusy: value => { busy = value; }'), 'the bulk run shares the tiles\' busy flag');
const tile = ui.slice(ui.indexOf('const photoTile = '), ui.indexOf('const renderPhotoStep = '));
assert.ok(!/bulk/i.test(tile), 'the single-slot tile is unchanged');
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
  globalThis.__core = {filled: new Map(), rules: {}, calls: [], puts: [], inflight: 0, maxInflight: 0, delay: 4, classifyStatus: 0, sosIntake: null, sosPosted: false};
  globalThis.__names = new Map();
  const nameOf = uri => __names.get(uri) || '?';
  const person = () => {
    const count = __core.filled.size;
    return {person_id: PERSON, display_name: '한지우', nickname: '', relationship: 'CHILD', birth_year: 2016, birthday_month: 5, revision: 1,
      has_photo: count === 10, identity_photo_count: count, identity_photo_state: count === 10 ? 'CURRENT' : 'INCOMPLETE',
      identity_photo_expires_at: count === 10 ? '2027-03-01T00:00:00Z' : null, identity_photo_days_remaining: count === 10 ? 140 : null,
      identity_photo_renewal_reminder_days: null, identity_photo_validity_days: count === 10 ? 180 : null};
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  const classification = rule => ({
    status: rule.status, detected_view: rule.view || 'UNKNOWN',
    suggested_slot_indexes: rule.slots || [], suggested_slot_codes: (rule.slots || []).map(index => SLOT_CODES[index - 1]),
    rejection_code: rule.status === 'REJECTED' ? 'PERSON_IDENTITY_PHOTO_' + rule.code : null,
    identity_checked: false, stored: false,
  });
  const sosRow = () => ({sos_id: 'hsos_0123456789abcdef0123', person_id: PERSON, display_name: '한지우', status: 'ACTIVE', last_seen_at: '2026-10-08T01:00:00Z', last_seen_summary: '망원한강공원 입구', description: null, matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false, ...(__core.sosIntake ? {intake: __core.sosIntake} : {})});
  const handle = async (target, method, init) => {
    let m;
    if (/\/content$/.test(target)) return png();
    if (target === '/v2/person-profiles' && method === 'GET') return json({people: [person()]});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos\/classify$/)) && method === 'POST') {
      const name = nameOf(JSON.parse(init.body).photo_data_uri);
      __core.calls.push('CLASSIFY ' + name);
      if (__core.classifyStatus) return json({detail: 'Not Found'}, __core.classifyStatus);
      const rule = __core.rules[name] || {status: 'REJECTED', code: 'NO_PERSON'};
      return json({classification: classification(rule)});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/))) {
      return json({photos: [...__core.filled.keys()].sort((a, b) => a - b).map(slot => ({slot_index: slot, slot_code: SLOT_CODES[slot - 1], revision: 1, width: 640, height: 640, updated_at: '2026-10-08T00:00:00Z'}))});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos\/(\d+)$/)) && method === 'PUT') {
      const slot = Number(m[2]);
      const uri = JSON.parse(init.body).photo_data_uri;
      const name = nameOf(uri);
      __core.calls.push('PUT ' + slot + ' ' + name);
      __core.puts.push(slot);
      const rule = __core.rules[name] || {};
      if (rule.put) return json({detail: {code: 'PERSON_IDENTITY_PHOTO_' + rule.put}}, 422);
      for (const [other, stored] of __core.filled) if (other !== slot && stored === uri) return json({detail: {code: 'PERSON_IDENTITY_PHOTO_DUPLICATE'}}, 422);
      __core.filled.set(slot, uri);
      return json({photo: {slot_index: slot, slot_code: SLOT_CODES[slot - 1], revision: 2, width: 640, height: 640}});
    }
    if (method === 'DELETE') { __core.calls.push('DELETE ' + target); return json({}, 405); }
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
    // Concurrency of the photo writes and classify calls only (page loads fetch in parallel).
    const photoCall = /\/identity-photos\/(classify|\d+)$/.test(target) && method !== 'GET';
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
    state: row.dataset.personBulkState, slot: Number(row.dataset.personBulkSlot || 0), code: row.dataset.personErrorCode || '',
    badge: row.querySelector('.safecare-badge')?.textContent || '', slotLine: row.querySelector('.person-bulk-item-slot')?.textContent || '',
    message: row.querySelector('[data-person-bulk-message]')?.textContent || '', note: row.querySelector('[data-person-bulk-note]')?.textContent || '',
    choices: [...row.querySelectorAll('[data-person-bulk-choose]')].map(button => [Number(button.dataset.personBulkChoose), button.textContent]),
    skip: Boolean(row.querySelector('[data-person-bulk-skip]')), replace: Boolean(row.querySelector('[data-person-bulk-replace]')),
  }));
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

// Classify rules per file name: CLEAR/UNCERTAIN with slots, REJECTED with a
// reason; `put` makes the PUT refuse with that reason.
const R = {
  front1: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
  front2: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
  front3: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
  left45: {status: 'CLEAR', view: 'LEFT_TURN', slots: [2, 9]},
  left45b: {status: 'CLEAR', view: 'LEFT_TURN', slots: [2, 9]},
  right45: {status: 'CLEAR', view: 'RIGHT_TURN', slots: [3, 10]},
  right45b: {status: 'CLEAR', view: 'RIGHT_TURN', slots: [3, 10]},
  leftp: {status: 'CLEAR', view: 'LEFT_PROFILE', slots: [4]},
  rightp: {status: 'CLEAR', view: 'RIGHT_PROFILE', slots: [5]},
  upper: {status: 'CLEAR', view: 'UPPER_BODY', slots: [6]},
  upper2: {status: 'CLEAR', view: 'UPPER_BODY', slots: [6]},
  full: {status: 'CLEAR', view: 'FULL_BODY', slots: [7]},
  dog: {status: 'REJECTED', code: 'NO_PERSON'},
  car: {status: 'REJECTED', code: 'NON_IDENTITY_IMAGE'},
  blur: {status: 'REJECTED', code: 'TOO_BLURRY'},
  group: {status: 'REJECTED', code: 'MULTIPLE_FACES'},
  back: {status: 'REJECTED', code: 'WRONG_POSE'},
  other: {status: 'CLEAR', view: 'FRONT', slots: [1, 8], put: 'DIFFERENT_PERSON'},
  unsure: {status: 'UNCERTAIN', view: 'UNKNOWN', slots: [6, 7]},
  unsure2: {status: 'UNCERTAIN', view: 'UNKNOWN', slots: [2, 4]},
  wrongfront: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
  left45x: {status: 'CLEAR', view: 'LEFT_TURN', slots: [2, 9], put: 'DIFFERENT_PERSON'},
  upperx: {status: 'CLEAR', view: 'UPPER_BODY', slots: [6], put: 'DIFFERENT_PERSON'},
  fullx: {status: 'CLEAR', view: 'FULL_BODY', slots: [7], put: 'DIFFERENT_PERSON'},
  extra1: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
  extra2: {status: 'CLEAR', view: 'FRONT', slots: [1, 8]},
};
const TEN = ['full', 'left45', 'upper', 'front1', 'rightp', 'right45', 'left45b', 'front2', 'leftp', 'right45b'];

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
      for (let t = 0; t < 100; t += 1) {
        if (await cdp.evaluate('return globalThis.__ready === true;').catch(() => false)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const result = await cdp.evaluate(`
        Object.assign(__core, ${JSON.stringify({rules: R, ...setup})});
        ${setup.prefill ? `for (const slot of ${JSON.stringify(setup.prefill)}) __core.filled.set(slot, 'prefilled-' + slot);` : ''}
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

    // (i) Selection screen: the exact warning and the angle line before picking.
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
          statusRole: panel.querySelector('[data-person-bulk-status]').getAttribute('role'),
        };
      `);
      assert.equal(r.warning, WARNING, `${where}: warning verbatim`);
      assert.equal(r.angles, bulk.PERSON_BULK_ANGLE_GUIDE, where);
      assert.equal(r.pick, '사진 여러 장 선택', where);
      assert.equal(r.multiple, true, where);
      assert.equal(r.accept, 'image/jpeg,image/png,image/webp', where);
      assert.equal(r.beforeGrid, true, `${where}: the panel sits above the tiles`);
      assert.equal(r.tiles, 10, `${where}: the ten single-slot tiles stay`);
      assert.equal(r.statusRole, 'status', where);
    }

    // (a) Ten photos of one person, all CLEAR: ten stored, fronts first.
    {
      const {result: r, where} = await scenario('a-ten-clear', {delay: 25}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ${JSON.stringify(TEN)});
        // While the batch runs the single-slot tiles say why they do not open.
        const running = document.querySelector('[data-person-care-surface]').dataset.personBulkRunning;
        const tile = document.querySelector('[data-person-slot="FACE_FRONT"]');
        tile.querySelector('.safecare-slot-choose').click();
        const tileError = tile.querySelector('.safecare-slot-error');
        const tileMessage = tileError.hidden ? '' : tileError.textContent;
        await __done();
        return {
          running, tileMessage, puts: [...__core.puts], classifies: __core.calls.filter(c => c.startsWith('CLASSIFY')).length,
          maxInflight: __core.maxInflight, summary: __panel().querySelector('[data-person-bulk-summary]')?.textContent,
          items: __items(), statusLog: [...__statusLog], counter: document.querySelector('[data-safecare-photo-count]').textContent,
          next: document.querySelector('[data-person-photos-next]')?.disabled, anchor: Boolean(document.querySelector('[data-person-bulk-anchor-hint]')),
          focused: document.activeElement?.dataset?.personBulkSummary === '',
          summaryDrawn: [...__panel().querySelectorAll('*')].filter(node => !node.children.length && node.textContent === '등록 성공 10장 · 실패 0장 · 확인 필요 0장' && node.getBoundingClientRect().height > 2).length,
        };
      `);
      assert.equal(r.running, 'true', `${where}: the surface marks the run`);
      assert.equal(r.tileMessage, '다른 사진을 확인하는 중입니다. 끝난 뒤 다시 선택해 주세요.', `${where}: a tile tap during the run says why`);
      assert.deepEqual(r.puts, [1, 8, 2, 3, 9, 10, 6, 4, 5, 7], `${where}: upload order`);
      assert.equal(r.classifies, 10, where);
      assert.equal(r.maxInflight, 1, `${where}: one request at a time`);
      assert.equal(r.summary, '등록 성공 10장 · 실패 0장 · 확인 필요 0장', where);
      assert.ok(r.items.every(item => item.state === 'STORED' && item.badge === '등록 성공' && item.slotLine.startsWith('등록한 칸: ')), where);
      assert.deepEqual(r.items.map(item => item.slot), [7, 2, 6, 1, 5, 3, 9, 8, 4, 10], `${where}: each photo in its own kind of slot`);
      for (let i = 1; i <= 10; i += 1) {
        assert.ok(r.statusLog.includes(`AI가 사진을 분류하고 있어요 (${i}/10)`), `${where}: classify progress ${i}/10`);
        assert.ok(r.statusLog.includes(`사진을 등록하고 있어요 (${i}/10)`), `${where}: upload progress ${i}/10`);
      }
      assert.ok(r.statusLog.indexOf('AI가 사진을 분류하고 있어요 (10/10)') < r.statusLog.indexOf('사진을 등록하고 있어요 (1/10)'), `${where}: classify before upload`);
      assert.equal(r.counter, '등록 완료 10 / 10' + '10장을 모두 등록했습니다', `${where}: the counter follows Core`);
      assert.equal(r.next, false, `${where}: the wizard can move on`);
      assert.equal(r.anchor, false, where);
      assert.equal(r.focused, true, `${where}: focus moves to the result`);
      assert.equal(r.summaryDrawn, 1, `${where}: the summary is drawn once`);
    }

    // (b) Mixed: an animal, a car and another person among real photos.
    // (d) Then replace only the wrong photos; earlier successes stay.
    {
      const {result: r, where} = await scenario('b-d-mixed-replace', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'dog', 'car', 'other', 'left45', 'upper']);
        await __done();
        const first = {puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent, anchor: Boolean(document.querySelector('[data-person-bulk-anchor-hint]'))};
        const row = id => document.querySelector('[data-person-bulk-item="' + id + '"]');
        // The other person's photo (meant for 추가 정면) replaced by an upper-body photo: wrong slot, kept pending.
        await __pick(row(4).querySelector('[data-person-bulk-replace-input]'), ['upper2']);
        await __done();
        const mismatch = {puts: [...__core.puts], item: __items()[3]};
        // ...then by a real front photo: stored in 추가 정면 only.
        await __pick(row(4).querySelector('[data-person-bulk-replace-input]'), ['front2']);
        await __done();
        const fixed = {puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
        // The dog photo (no slot) replaced by a full-body photo: goes to 정면 전신.
        await __pick(row(2).querySelector('[data-person-bulk-replace-input]'), ['full']);
        await __done();
        return {first, mismatch, fixed, last: {puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent},
          deletes: __core.calls.filter(c => c.startsWith('DELETE')), filled: [...__core.filled.keys()].sort((a, b) => a - b),
          counter: document.querySelector('[data-safecare-photo-count]').dataset.safecarePhotoCount};
      `);
      const byId = items => Object.fromEntries(items.map(item => [item.id, item]));
      const first = byId(r.first.items);
      assert.deepEqual(r.first.puts, [1, 8, 2, 6], `${where}: fronts first, rejected photos never uploaded`);
      assert.equal(r.first.summary, '등록 성공 3장 · 실패 3장 · 확인 필요 0장', where);
      assert.equal(first[1].state, 'STORED'); assert.equal(first[1].slot, 1);
      assert.equal(first[2].state, 'REJECTED'); assert.equal(first[2].message, MSG.NO_PERSON, `${where}: animal reason`);
      assert.equal(first[3].state, 'REJECTED'); assert.equal(first[3].message, MSG.NON_IDENTITY_IMAGE, `${where}: object reason`);
      assert.equal(first[4].state, 'PUT_FAILED'); assert.equal(first[4].message, MSG.DIFFERENT_PERSON, `${where}: other person reason`);
      assert.equal(first[4].slotLine, '등록하려던 칸: 추가 정면');
      assert.equal(first[4].code, 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON');
      assert.ok(first[2].replace && first[3].replace && first[4].replace, `${where}: every failed photo has 다른 사진으로 교체`);
      assert.equal(first[5].slot, 2); assert.equal(first[6].slot, 6);
      assert.equal(r.first.anchor, false, `${where}: one different-person refusal followed by successes is no anchor warning`);
      assert.deepEqual(r.mismatch.puts, [1, 8, 2, 6], `${where}: a replacement for the wrong slot is not uploaded`);
      assert.equal(r.mismatch.item.state, 'PUT_FAILED');
      assert.equal(r.mismatch.item.note, '새 사진은 추가 정면 칸에 맞지 않아요. 추가 정면 칸에 맞는 사진을 선택해 주세요.', where);
      assert.deepEqual(r.fixed.puts, [1, 8, 2, 6, 8], `${where}: only the intended slot is written`);
      assert.equal(byId(r.fixed.items)[4].state, 'STORED');
      assert.equal(byId(r.fixed.items)[4].slot, 8);
      assert.equal(r.fixed.summary, '등록 성공 4장 · 실패 2장 · 확인 필요 0장', where);
      assert.deepEqual(r.last.puts, [1, 8, 2, 6, 8, 7], where);
      assert.equal(byId(r.last.items)[2].state, 'STORED'); assert.equal(byId(r.last.items)[2].slot, 7);
      assert.equal(r.last.summary, '등록 성공 5장 · 실패 1장 · 확인 필요 0장', where);
      assert.deepEqual(r.deletes, [], `${where}: nothing is ever deleted`);
      assert.deepEqual(r.filled, [1, 2, 6, 7, 8], `${where}: earlier successes stay stored`);
      assert.equal(r.counter, '5', where);
    }

    // (c) Wrong angle, a third front, blur, a group photo and duplicate bytes.
    {
      const {result: r, where} = await scenario('c-angles-quality-duplicate', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'front2', 'front3', 'blur', 'group', 'back', 'left45', ['left45dup', 'left45']]);
        await __done();
        return {puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
      `);
      const items = Object.fromEntries(r.items.map(item => [item.id, item]));
      assert.deepEqual(r.puts, [1, 8, 2, 9], where);
      assert.equal(r.summary, '등록 성공 3장 · 실패 4장 · 확인 필요 1장', where);
      assert.deepEqual([items[1].slot, items[2].slot], [1, 8], `${where}: two fronts placed`);
      assert.equal(items[3].state, 'NEEDS_CHOICE', `${where}: the third front needs confirmation`);
      assert.equal(items[3].badge, '확인 필요');
      assert.deepEqual(items[3].choices, [], `${where}: it never displaces a photo of this batch`);
      assert.ok(items[3].skip && items[3].replace, where);
      assert.match(items[3].message, /다른 각도에서 찍은 사진으로 바꾸거나 건너뛰어 주세요/);
      assert.equal(items[4].message, MSG.TOO_BLURRY, `${where}: blur`);
      assert.equal(items[5].message, MSG.MULTIPLE_FACES, `${where}: several people`);
      assert.equal(items[6].message, MSG.WRONG_POSE, `${where}: wrong angle`);
      assert.equal(items[7].state, 'STORED'); assert.equal(items[7].slot, 2);
      assert.equal(items[8].state, 'PUT_FAILED'); assert.equal(items[8].slot, 9);
      assert.equal(items[8].message, MSG.DUPLICATE, `${where}: duplicate bytes`);
    }

    // (e) UNCERTAIN: the guardian chooses the slot; another one is skipped.
    {
      const {result: r, where} = await scenario('e-uncertain-choice', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'unsure', 'unsure2']);
        await __done();
        const before = {puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
        document.querySelector('[data-person-bulk-item="2"] [data-person-bulk-choose="7"]').click();
        await __done();
        document.querySelector('[data-person-bulk-item="3"] [data-person-bulk-skip]').click();
        await __wait(30);
        return {before, puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
      `);
      const before = Object.fromEntries(r.before.items.map(item => [item.id, item]));
      assert.deepEqual(r.before.puts, [1], `${where}: an uncertain photo is not placed by itself`);
      assert.equal(r.before.summary, '등록 성공 1장 · 실패 0장 · 확인 필요 2장', where);
      assert.equal(before[2].state, 'NEEDS_CHOICE');
      assert.deepEqual(before[2].choices, [[6, '정면 상반신 칸에 등록'], [7, '정면 전신 칸에 등록']], `${where}: only its own candidate slots`);
      assert.deepEqual(before[3].choices.map(([slot]) => slot), [2, 4]);
      const after = Object.fromEntries(r.items.map(item => [item.id, item]));
      assert.deepEqual(r.puts, [1, 7], `${where}: the chosen slot only`);
      assert.equal(after[2].state, 'STORED'); assert.equal(after[2].slot, 7);
      assert.equal(after[3].state, 'SKIPPED'); assert.equal(after[3].badge, '건너뜀');
      assert.equal(r.summary, '등록 성공 2장 · 실패 0장 · 확인 필요 0장', where);
    }

    // (e2) A slot already filled on Core is replaced only when chosen.
    {
      const {result: r, where} = await scenario('e2-filled-replace-choice', {prefill: [1, 4, 6]}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['upper', 'leftp']);
        await __done();
        const before = {puts: [...__core.puts], items: __items()};
        document.querySelector('[data-person-bulk-item="1"] [data-person-bulk-choose="6"]').click();
        await __done();
        return {before, puts: [...__core.puts], items: __items()};
      `);
      assert.deepEqual(r.before.puts, [], `${where}: filled slots are not overwritten automatically`);
      assert.deepEqual(r.before.items.map(item => item.choices), [[[6, '정면 상반신 사진 바꾸기']], [[4, '왼쪽 옆면 사진 바꾸기']]], where);
      assert.deepEqual(r.puts, [6], where);
      assert.equal(r.items[0].state, 'STORED');
    }

    // (f) No front photo while slot 1 is empty: nothing uploaded, front first.
    {
      const {result: r, where} = await scenario('f-front-first', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['left45', 'upper']);
        await __done();
        const before = {puts: [...__core.puts], items: __items(), notices: [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent),
          summary: __panel().querySelector('[data-person-bulk-summary]').textContent, front: Boolean(document.querySelector('[data-person-bulk-front-pick]'))};
        // A held photo cannot be replaced into its slot before the front.
        document.querySelector('[data-person-bulk-item="1"] [data-person-bulk-replace]').click();
        const blocked = document.querySelector('[data-person-bulk-item="1"] [data-person-bulk-note]')?.textContent || '';
        // A side photo offered as the front is refused without an upload.
        await __pick(document.querySelector('[data-person-bulk-front-input]'), ['leftp']);
        await __done();
        const wrongFront = {puts: [...__core.puts], note: document.querySelector('[data-person-bulk-front-note]')?.textContent || ''};
        await __pick(document.querySelector('[data-person-bulk-front-input]'), ['front1']);
        await __done();
        return {before, blocked, wrongFront, puts: [...__core.puts], items: __items(), summary: __panel().querySelector('[data-person-bulk-summary]').textContent,
          notices: [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent)};
      `);
      assert.deepEqual(r.before.puts, [], `${where}: nothing uploaded without a front`);
      assert.ok(r.before.notices.includes(bulk.PERSON_BULK_FRONT_FIRST), `${where}: front-first message`);
      assert.deepEqual(r.before.items.map(item => [item.state, item.slot, item.badge]), [['HELD', 2, '확인 필요'], ['HELD', 6, '확인 필요']], where);
      assert.equal(r.before.summary, '등록 성공 0장 · 실패 0장 · 확인 필요 2장', where);
      assert.equal(r.before.front, true, `${where}: a front photo can be picked right here`);
      assert.equal(r.blocked, '정면 얼굴 사진을 먼저 등록해 주세요.', where);
      assert.deepEqual(r.wrongFront.puts, [], where);
      assert.equal(r.wrongFront.note, '새 사진은 정면 얼굴 칸에 맞지 않아요. 정면 얼굴 칸에 맞는 사진을 선택해 주세요.', where);
      assert.deepEqual(r.puts, [1, 2, 6], `${where}: the front first, then the held photos in order`);
      assert.equal(r.summary, '등록 성공 3장 · 실패 0장 · 확인 필요 0장', where);
      assert.deepEqual(r.notices, [], where);
    }

    // (g) More than ten photos: the first ten are used and the screen says so.
    {
      const {result: r, where} = await scenario('g-more-than-ten', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ${JSON.stringify([...TEN, 'extra1', 'extra2'])});
        await __done();
        return {classified: __core.calls.filter(c => c.startsWith('CLASSIFY')).map(c => c.slice(9)), items: __items().length,
          notices: [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent), puts: __core.puts.length};
      `);
      assert.deepEqual(r.classified, TEN, `${where}: only the first ten are classified`);
      assert.equal(r.items, 10, where);
      assert.equal(r.puts, 10, where);
      assert.ok(r.notices.includes('사진은 한 번에 최대 10장까지 등록할 수 있어 앞의 10장만 사용해요. (12장 중 2장 제외)'), `${where}: ${JSON.stringify(r.notices)}`);
    }

    // (h) The anchor may be someone else: a stored front, then only refusals.
    {
      const {result: r, where} = await scenario('h-anchor-hint', {}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['wrongfront', 'left45x', 'upperx', 'fullx']);
        await __done();
        return {puts: [...__core.puts], hint: document.querySelector('[data-person-bulk-anchor-hint]')?.textContent || '', summary: __panel().querySelector('[data-person-bulk-summary]').textContent};
      `);
      assert.deepEqual(r.puts, [1, 2, 6, 7], where);
      assert.equal(r.hint, ANCHOR, `${where}: anchor hint verbatim`);
      assert.equal(r.summary, '등록 성공 1장 · 실패 3장 · 확인 필요 0장', where);
    }

    // (k) Older Core without classify: nothing stored, the tiles still work.
    {
      const {result: r, where} = await scenario('k-classify-unavailable', {classifyStatus: 404}, `
        await __openPhotos();
        await __pick(__panel().querySelector('[data-person-bulk-input]'), ['front1', 'left45']);
        await __done();
        const notices = [...document.querySelectorAll('[data-person-bulk-notice]')].map(n => n.textContent);
        const tile = document.querySelector('[data-person-slot="FACE_FRONT"]');
        const transfer = new DataTransfer(); transfer.items.add(await __file('front2'));
        const input = tile.querySelector('[data-person-slot-input]'); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
        await __until(() => __core.puts.length === 1 && document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === '1');
        return {notices, puts: [...__core.puts], classifies: __core.calls.filter(c => c.startsWith('CLASSIFY')).length, items: __items().length};
      `);
      assert.deepEqual(r.notices, [bulk.PERSON_BULK_UNAVAILABLE], where);
      assert.equal(r.classifies, 1, `${where}: the run stops at the first answer`);
      assert.equal(r.items, 0, where);
      assert.deepEqual(r.puts, [1], `${where}: the single-slot tile still saves`);
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
      const {result: r, where} = await scenario(`j-sos-${mode}`, {prefill: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], sosIntake: intake}, `
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
    console.log(`  ${label}: bulk upload a-k, found-report privacy, SOS copy PASS`);
  }
} finally {
  browser.kill();
  server.close();
}
console.log('SAFECARE-PHOTO-BULK-UPLOAD-01 SITE PASS');
