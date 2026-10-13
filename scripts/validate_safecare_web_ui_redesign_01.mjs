// SAFECARE-WEB-UI-REDESIGN-01 — person + pet SafeCare web screens.
//
// Three layers:
//   A. the shared screen rules in site-safecare-common.js (pure functions),
//   B. source checks for copy and fields the screens must never carry,
//   C. a real Chrome run over the DevTools protocol at 1440px and 390px with a
//      stand-in for Core, driving the screens the way a guardian would.
//
// Core is never contacted. Set SAFECARE_SCREENSHOT_DIR to keep PNG evidence of
// every checked state; without it the run only asserts.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = process.env.SAFECARE_BASELINE_ROOT
  ? path.resolve(process.env.SAFECARE_BASELINE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ------------------------------------------------------------ A. rules
const common = await import(pathToFileURL(path.join(ROOT, 'site-safecare-common.js')).href);
const renewalNotice = await import(pathToFileURL(path.join(ROOT, 'site-safecare-renewal-notice.js')).href);
assert.equal(typeof renewalNotice.requiresGuardianConsent, 'function', 'renewal notice must expose the guardian-consent rule');
assert.equal(renewalNotice.requiresGuardianConsent({relationship: 'CHILD', birthYear: 2012, birthMonth: 11}, new Date('2026-10-06T00:00:00Z')), true,
  'a child who has not reached 14 must require guardian consent');
assert.equal(renewalNotice.requiresGuardianConsent({relationship: 'CHILD', birthYear: 2012, birthMonth: 10}, new Date('2026-10-06T00:00:00Z')), false,
  'a child who reaches 14 in the current month must not require guardian consent');
assert.equal(renewalNotice.requiresGuardianConsent({relationship: 'PARENT', birthYear: 2018, birthMonth: 8}, new Date('2026-10-06T00:00:00Z')), false,
  'only the CHILD relationship can require guardian consent');
for (let count = 0; count <= 10; count += 1) {
  const progress = common.foundPhotoProgress(count);
  assert.equal(progress.canSubmit, count >= 5, `found report with ${count} photos: submit must ${count >= 5 ? 'open' : 'stay closed'}`);
  assert.equal(progress.canAdd, count < 10, `found report with ${count} photos: adding must ${count < 10 ? 'stay open' : 'stop'}`);
}
assert.equal(common.foundPhotoProgress(1).message, '현재 1/5장 · 최종 제출하려면 사진 4장이 더 필요합니다.');
// QA 02 D2: the birth-year wheel starts near a likely year for the relationship.
{
  const now = new Date(Date.UTC(2026, 9, 10));
  assert.deepEqual(['CHILD', 'PARENT', 'SPOUSE', 'FAMILY', 'DEPENDENT', 'OTHER', 'UNKNOWN'].map(code => common.birthYearStart(code, now)), [2018, 1961, 1986, 1981, 1956, 1981, 1981]);
  for (const code of ['CHILD', 'PARENT', 'SPOUSE', 'FAMILY', 'DEPENDENT', 'OTHER']) assert.ok(common.birthYearOptions(now).includes(common.birthYearStart(code, now)), `${code}: the start year is on the wheel`);
}
assert.equal(common.foundPhotoProgress(0).message, '발견한 대상의 사진 1장부터 작성을 시작할 수 있습니다.');
assert.equal(common.NO_RELIABLE_MATCH_LABEL, '확인 가능한 일치 대상 없음');
assert.equal(common.foundReviewStateCopy('NO_RELIABLE_MATCH').label, '확인 가능한 일치 대상 없음');
for (const state of ['DRAFT', 'QUEUED', 'ANALYZING', 'ADMIN_REVIEW', 'INSUFFICIENT_QUALITY', 'CLOSED', null, undefined, 'SOMETHING_NEW']) {
  assert.ok(!JSON.stringify(common.foundReviewStateCopy(state)).includes('일치 대상 없음'),
    `review state ${state} must never read as no reliable match`);
  assert.equal(common.isNoReliableMatchState(state), false);
}
assert.equal(common.isNoReliableMatchState('NO_RELIABLE_MATCH'), true);
// SAFECARE-SIGHTING-RESULT-PRIVACY (2026-10-08, person found reports only): the
// reporter is never told whether a comparison candidate existed or whether
// anything matched. Person Core sends DRAFT / QUEUED / INSUFFICIENT_QUALITY /
// CLOSED; an older Core's ANALYZING / ADMIN_REVIEW read as QUEUED and
// NO_RELIABLE_MATCH reads as CLOSED. The pet table above is unchanged.
assert.deepEqual(common.personFoundReviewStateCopy('QUEUED'), {label: '접수됨', tone: 'progress', detail: '제보가 접수되었습니다. 관리자가 확인하고 있으며, 비교 결과는 제보자에게 공개되지 않습니다.'});
assert.deepEqual(common.personFoundReviewStateCopy('CLOSED'), {label: '검토 종료', tone: 'neutral', detail: '제보 검토가 종료되었습니다. 비교 결과는 제보자에게 공개되지 않습니다.'});
for (const state of ['ANALYZING', 'ADMIN_REVIEW']) assert.deepEqual(common.personFoundReviewStateCopy(state), common.personFoundReviewStateCopy('QUEUED'), `person ${state} must read like QUEUED`);
assert.deepEqual(common.personFoundReviewStateCopy('NO_RELIABLE_MATCH'), common.personFoundReviewStateCopy('CLOSED'), 'person NO_RELIABLE_MATCH must read like CLOSED');
for (const state of ['DRAFT', 'QUEUED', 'ANALYZING', 'ADMIN_REVIEW', 'NO_RELIABLE_MATCH', 'INSUFFICIENT_QUALITY', 'CLOSED', null, undefined, 'SOMETHING_NEW']) {
  const copy = JSON.stringify(common.personFoundReviewStateCopy(state));
  for (const phrase of ['일치 대상 없음', '일치 대상이 없', '비교 후보가 있어', '비교 후보', '일치 대상']) {
    assert.ok(!copy.includes(phrase), `person review state ${state} must never disclose a comparison result ("${phrase}")`);
  }
}
assert.equal(common.identityPhotoProgress(3).label, '등록 완료 3 / 10');
assert.equal(common.identityPhotoProgress(3).remainingLabel, '남은 사진 7장');
assert.equal(common.identityPhotoProgress(10).complete, true);
assert.equal(common.IDENTITY_PHOTO_TOTAL, 10);
for (const [value, expected] of [['8', 8], ['08', 8], [8, 8], [' 12 ', 12], ['0', null], ['13', null], ['', null], ['팔', null]]) {
  assert.equal(common.normalizeBirthMonth(value), expected, `birth month ${JSON.stringify(value)}`);
}
assert.equal(common.normalizeBirthYear('2016', new Date('2026-10-05T00:00:00Z')), 2016);
assert.equal(common.normalizeBirthYear('2030', new Date('2026-10-05T00:00:00Z')), null);
assert.equal(common.renewalBadge({state: 'EXPIRED'}).label, '사진 갱신 필요');
assert.equal(common.renewalBadge({state: 'EXPIRING', daysRemaining: 7}).label, '갱신 예정 · 7일 남음');
assert.equal(common.renewalBadge({state: 'CURRENT'}).label, '정상');
assert.equal(common.renewalBadge({state: 'BIRTH_INFO_REQUIRED'}).label, '출생정보 필요');
console.log('SAFECARE-WEB-UI-REDESIGN-01 rules PASS');

// ------------------------------------------------------------ B. source
const personUi = read('site-person-ui.js');
const personClient = read('site-person.js');
const petUi = read('site-pet-ui.js');
const commonSource = read('site-safecare-common.js');
const personGuides = read('site-person-guides.js');
const index = read('index.html');
const renderedCopy = text => text
  .split(/\r?\n/)
  .filter(line => !line.trimStart().startsWith('//'))
  .join('\n')
  .replace(/const NON_ASSERTION_NOTICE = '[^']*';/, '');
for (const [label, text] of [['site-person-ui.js', personUi], ['site-pet-ui.js', petUi], ['site-safecare-common.js', commonSource], ['site-person-guides.js', personGuides]]) {
  const copy = renderedCopy(text);
  for (const phrase of ['100% 일치', '찾았습니다', '찾았어요', '일치합니다', '동일인입니다', '같은 반려동물입니다', '자동으로 확정', '카메라 촬영']) {
    assert.ok(!copy.includes(phrase), `${label} must not render "${phrase}"`);
  }
}
assert.ok(index.includes('site-safecare.css?v='), 'the shared SafeCare stylesheet must be linked');
assert.ok(personUi.includes("from './site-safecare-common.js?v=") && petUi.includes("from './site-safecare-common.js?v="),
  'both screens must use the one shared rule module');
assert.ok(!/birthYear\.type = 'number'|birthMonth\.type = 'number'/.test(personUi), 'birth year/month must be chosen, not typed');
for (const code of [
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
]) {
  assert.ok(personClient.includes(code), `person photo UI must explain Core rejection ${code}`);
}
// Fields Core does not store must not appear as if they were saved.
for (const unsupported of ['현재 상태', '제보자 연락처', '지도에서 선택', '다른 기기에서 이어']) {
  assert.ok(!personUi.includes(unsupported) && !petUi.includes(unsupported), `no screen may offer "${unsupported}"`);
}
console.log('SAFECARE-WEB-UI-REDESIGN-01 source PASS');

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
  throw new Error('Chrome/Chromium is required for the SafeCare render validation (set CHROME_BIN).');
}

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
function serve() {
  const server = http.createServer((request, response) => {
    const rel = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// A stand-in for Core: the same routes and response shapes the screens call,
// in memory, with a call log so the test can see what reached "Core".
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-conversation.css" />
<link rel="stylesheet" href="/site-pet.css" />
<link rel="stylesheet" href="/site-person.css" />
<link rel="stylesheet" href="/site-person-bulk.css" />
<link rel="stylesheet" href="/site-safecare.css" />
<link rel="stylesheet" href="/site-family-guardian.css" />
<link rel="stylesheet" href="/site-consumer-design.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<style>html,body{margin:0;background:var(--lotbi-bg-primary,#fff)}body{min-height:100vh}#host{box-sizing:border-box;max-width:960px;margin:0 auto;padding:16px}</style>
<script>
  globalThis.__calls = [];
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  // SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): slots 6 and 7 hold body photos;
  // three faces and two bodies complete a set (Core's identity_photo_complete).
  const BODY_SLOTS = [6, 7];
  const categoryOf = slot => (BODY_SLOTS.includes(slot) ? 'BODY' : 'FACE');
  const photosFor = (slots) => [...slots].sort((a, b) => a - b).map(slot => ({slot_index: slot, slot_code: 'S' + slot, category: categoryOf(slot), revision: 1, width: 640, height: 640, updated_at: '2026-09-01T00:00:00Z'}));
  const range = count => Array.from({length: count}, (_, i) => i + 1);
  const setFields = slots => {
    const body = slots.filter(slot => BODY_SLOTS.includes(slot)).length;
    const face = slots.length - body;
    return {identity_photo_face_count: face, identity_photo_body_count: body, identity_photo_face_minimum: 3, identity_photo_body_minimum: 2, identity_photo_minimum: 5, identity_photo_complete: face >= 3 && body >= 2};
  };
  const personRow = (n, name, relationship, year, month, count, state, extra = {}) => ({
    person_id: P(n), display_name: name, nickname: '', relationship, birth_year: year, birthday_month: month, revision: 1,
    has_photo: setFields(range(count)).identity_photo_complete, identity_photo_count: count, identity_photo_state: state, ...setFields(range(count)),
    identity_photo_expires_at: extra.expires || null, identity_photo_days_remaining: extra.days ?? null,
    identity_photo_renewal_reminder_days: extra.reminder ?? null, identity_photo_validity_days: extra.validity ?? null,
  });
  const state = {
    people: [
      personRow(1, '김하늘', 'CHILD', 2016, 8, 10, 'CURRENT', {expires: '2027-03-01T00:00:00Z', days: 147, validity: 180}),
      personRow(2, '박영자', 'PARENT', 1948, 3, 3, 'INCOMPLETE'),
      personRow(3, '이도윤', 'CHILD', 2019, 11, 10, 'EXPIRED', {expires: '2026-09-30T00:00:00Z', days: 0, validity: 180}),
      personRow(4, '최민준', 'FAMILY', 1985, 1, 10, 'EXPIRING', {expires: '2026-10-12T00:00:00Z', days: 7, reminder: 7, validity: 365}),
    ],
    photos: {1: range(10), 2: range(3), 3: range(10), 4: range(10)},
    nextCategory: 'FACE',
    sos: [{sos_id: 'sos-1', person_id: P(1), display_name: '김하늘', status: 'ACTIVE', last_seen_at: '2026-10-05T01:30:00Z', last_seen_summary: '망원한강공원 입구', description: '노란 우비', matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false}],
    sightings: [
      {report_id: 'r-nrm', observed_at: '2026-10-01T03:00:00Z', location_summary: '정자역 2번 출구', description: '', review_state: 'NO_RELIABLE_MATCH', photo_count: 6},
      {report_id: 'r-an', observed_at: '2026-10-04T05:00:00Z', location_summary: '서현역 광장', description: '', review_state: 'ANALYZING', photo_count: 5},
    ],
    sightingPhotos: {},
    pets: [{pet_id: 'PET_KR_DDDDDDDDDDDDDDDDDDDD', name: '초코', species: 'DOG', sex: 'MALE', breed: '진돗개', photo_completion_state: 'UPLOAD_COMPLETE', matching_consent_state: 'NOT_GRANTED'}],
    found: [{found_case_id: 'pfound_nrm', species: 'CAT', found_location: {label: '정자동 느티마을'}, found_at: '2026-10-02T02:10:00Z', review_state: 'NO_RELIABLE_MATCH', status: 'ACTIVE'}],
    foundPhotos: {pfound_nrm: [1, 2, 3, 4, 5]},
  };
  globalThis.__fixtureState = state;
  const sightingView = row => ({...row, minimum_photo_count: 5, maximum_photo_count: 10, can_submit: row.review_state === 'DRAFT' && row.photo_count >= 5, message: '', automatic_identity_decision: false, contact_details_exposed: false});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const draftView = () => ({draft_id: 'pdraft_ssssssssssssssssssss', status: 'ACTIVE', revision: 2,
    current_step: 'PHOTOS', matching_consent_state: 'NOT_GRANTED', photos: [], ...(globalThis.__draft || {})});
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = init.method || 'GET';
    globalThis.__calls.push(method + ' ' + target);
    let m;
    if (/\/content$/.test(target)) return png();
    // ---- person
    if (target === '/v2/person-profiles' && method === 'GET') return json({people: state.people});
    if (target === '/v2/person-profiles' && method === 'POST') {
      const body = JSON.parse(init.body);
      const row = personRow(5, body.display_name, body.relationship, body.birth_year, body.birthday_month, 0, 'INCOMPLETE');
      state.people.push(row); state.photos[5] = [];
      return json({person: row}, 201);
    }
    // 2nd round: one slot-free POST per photo; Core picks the card.
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/)) && method === 'POST') {
      const key = m[1].slice(-1);
      const order = state.nextCategory === 'BODY' ? [6, 7, 10, 9, 8, 5, 4, 3, 2, 1] : [1, 8, 2, 3, 9, 10, 4, 5, 7, 6];
      const slot = order.find(index => !(state.photos[key] || []).includes(index));
      state.photos[key] = [...(state.photos[key] || []), slot];
      const row = state.people.find(item => item.person_id === m[1]);
      Object.assign(row, setFields(state.photos[key]), {identity_photo_count: state.photos[key].length});
      row.has_photo = row.identity_photo_complete;
      row.identity_photo_state = row.identity_photo_complete ? 'CURRENT' : 'INCOMPLETE';
      return json({photo: {slot_index: slot, slot_code: 'S' + slot, category: categoryOf(slot), revision: 2, width: 640, height: 640}, category: categoryOf(slot), identity_check: 'SAME', idempotent_replay: false,
        validity: {photo_count: row.identity_photo_count, face_count: row.identity_photo_face_count, body_count: row.identity_photo_body_count, complete: row.identity_photo_complete}}, 201);
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/))) return json({photos: photosFor(state.photos[m[1].slice(-1)] || [])});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/)) && method === 'PATCH') {
      const row = state.people.find(item => item.person_id === m[1]);
      const body = JSON.parse(init.body);
      if (body.expected_revision !== row.revision) return json({detail:{code:'PERSON_REVISION_CONFLICT'}},409);
      const fields = ['display_name','nickname','relationship','birth_year','birthday_month'];
      let changed = false;
      for (const field of fields) if (Object.hasOwn(body,field) && body[field] !== row[field]) {row[field]=body[field];changed=true;}
      if (changed) row.revision++;
      return json({person:row});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/))) return json({person: state.people.find(item => item.person_id === m[1])});
    if (target.startsWith('/v2/person-sos?status=ACTIVE')) return json({items: state.sos.filter(item => item.status === 'ACTIVE')});
    if (target === '/v2/person-sos/notices/candidates') return json({notices: []});
    if (target === '/v2/safecare/human-sightings' && method === 'GET') return json({reports: state.sightings.map(sightingView)});
    if (target === '/v2/safecare/human-sightings' && method === 'POST') {
      const body = JSON.parse(init.body);
      const row = {report_id: 'r-new', observed_at: body.observed_at, location_summary: body.location_summary, description: body.description, review_state: 'DRAFT', photo_count: 0};
      state.sightings.unshift(row); state.sightingPhotos['r-new'] = [];
      return json({report: sightingView(row)}, 201);
    }
    if ((m = target.match(/^\/v2\/safecare\/human-sightings\/([^/]+)\/photos\/(\d+)$/)) && method === 'PUT') {
      const row = state.sightings.find(item => item.report_id === m[1]);
      state.sightingPhotos[m[1]] = [...new Set([...(state.sightingPhotos[m[1]] || []), Number(m[2])])];
      row.photo_count = state.sightingPhotos[m[1]].length;
      return json({photo: {slot_index: Number(m[2]), angle_code: 'A' + m[2], revision: 1, width: 640, height: 640}});
    }
    if ((m = target.match(/^\/v2\/safecare\/human-sightings\/([^/]+)\/photos$/))) return json({photos: (state.sightingPhotos[m[1]] || []).map(slot_index => ({slot_index, angle_code: 'A' + slot_index, revision: 1}))});
    if ((m = target.match(/^\/v2\/safecare\/human-sightings\/([^/]+)\/submit$/))) {
      const row = state.sightings.find(item => item.report_id === m[1]);
      row.review_state = row.photo_count >= 5 ? 'QUEUED' : 'DRAFT';
      return row.review_state === 'QUEUED' ? json({report: sightingView(row)}) : json({detail: {code: 'HUMAN_SIGHTING_PHOTOS_INCOMPLETE'}}, 422);
    }
    // ---- pet
    if (target === '/v2/pets' && method === 'GET') return json({pets: state.pets});
    if (/^\/v2\/pets\/PET_KR_[A-Z]+\/photos$/.test(target)) {
      const filled = ['NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR', 'DISTINCTIVE'].map(slot_code => ({slot_code}));
      return json({photos: filled, manifest: {slot_count: 10, state: 'UPLOAD_COMPLETE', manifest_version: 1}});
    }
    if (target === '/v2/pets/profile-hub') return json({pets: [{pet_id: 'PET_KR_DDDDDDDDDDDDDDDDDDDD', name: '초코', species: 'DOG', age: {label: '3살', mode: 'EXACT'}, photo_count: 10, photo_total: 10, identity_photo_state: 'EXPIRING', identity_photo_expires_at: '2026-10-25T00:00:00Z', identity_photo_days_remaining: 20, identity_photo_renewal_reminder_days: 30, identity_photo_renewal_due: true, sos: {active: false}}]});
    if (target === '/v2/pets/match-notices') return json({notices: []});
    if (target === '/v2/pets/sos') return json({cases: []});
    if (target === '/v2/pets/found' && method === 'GET') return json({cases: state.found});
    if (target === '/v2/pets/found' && method === 'POST') {
      const body = JSON.parse(init.body);
      const row = {found_case_id: 'pfound_new', species: body.species, found_location: body.found_location || {}, found_at: body.found_at, description: body.description || '', review_state: 'DRAFT', status: 'ACTIVE'};
      state.found.unshift(row); state.foundPhotos.pfound_new = [];
      return json({found_case: row}, 201);
    }
    if ((m = target.match(/^\/v2\/pets\/found\/([^/]+)\/photos\/(\d+)$/)) && method === 'PUT') {
      state.foundPhotos[m[1]] = [...new Set([...(state.foundPhotos[m[1]] || []), Number(m[2])])];
      return json({photo_count: state.foundPhotos[m[1]].length});
    }
    if ((m = target.match(/^\/v2\/pets\/found\/([^/]+)\/photos$/))) return json({photos: (state.foundPhotos[m[1]] || []).map(slot_index => ({slot_index}))});
    if ((m = target.match(/^\/v2\/pets\/found\/([^/]+)\/submit$/))) {
      const row = state.found.find(item => item.found_case_id === m[1]);
      row.review_state = 'QUEUED';
      return json({found_case: row});
    }
    if (target === '/v2/pet-catalog') return json({breeds: {DOG: [{code: 'JINDO', display_name: '진돗개', species: 'DOG'}], CAT: [{code: 'KOREAN_SHORTHAIR', display_name: '코리안숏헤어', species: 'CAT'}]}, colors: [{code: 'WHITE', display_name: '흰색'}], patterns: [{code: 'SOLID', display_name: '단색', species: null}]});
    if (target === '/v2/pet-registration-drafts/active') return json({draft: null});
    if (target === '/v2/pet-registration-drafts' && method === 'POST') return json({draft: {draft_id: 'pdraft_ssssssssssssssssssss', status: 'ACTIVE', current_step: 'PHOTOS', revision: 1, matching_consent_state: 'NOT_GRANTED', photos: []}});
    if (target === '/v2/pet-registration-drafts/pdraft_ssssssssssssssssssss' && method === 'PATCH') {
      const update = JSON.parse(init.body || '{}');
      globalThis.__draft = {...(globalThis.__draft || {current_step: 'PHOTOS'}), ...update};
      const d = globalThis.__draft;
      return json({draft: draftView()});
    }
    if (target === '/v2/pet-registration-drafts/pdraft_ssssssssssssssssssss/photos' && method === 'POST') {
      const codes = ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT'];
      const photos = globalThis.__draft.photos || [];
      const photo = {slot_code: codes[photos.length], revision: 1, inspection_state: 'ACCEPTED', detected_species: 'DOG'};
      globalThis.__draft.photos = [...photos, photo];
      return json({photo, category: photos.length < 3 ? 'FACE' : 'BODY', draft: draftView()}, 201);
    }
    if (target === '/v2/pet-registration-drafts/pdraft_ssssssssssssssssssss/finalize' && method === 'POST') {
      const draft = draftView();
      if (draft.photos.length < 5 || draft.current_step !== 'REVIEW') return json({detail: {code: 'PET_DRAFT_INCOMPLETE'}}, 422);
      const pet = {...draft, pet_id: 'PET_KR_EEEEEEEEEEEEEEEEEEEE', photo_completion_state: 'UPLOAD_COMPLETE'};
      state.pets.push(pet);
      return json({pet, draft: {...draft, status: 'COMPLETED', completed_pet_id: pet.pet_id}});
    }
    return json({}, 404);
  };
</script>
</head><body data-site-theme="light"><div id="host"></div>
<script type="module">
  import {mountPersonCareManager} from '/site-person-ui.js';
  import {mountPetFamilyManager} from '/site-pet-ui.js';
  import {mountConsumerSection} from '/site-consumer-sections.js';
  const host = document.getElementById('host');
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 4000) => { for (let t = 0; t < ms && !check(); t += 50) await __wait(50); return check(); };
  globalThis.__mountPerson = async surface => { host.replaceChildren(); globalThis.__screen = await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface: surface || 'home'}); };
  globalThis.__mountPet = async surface => { host.replaceChildren(); globalThis.__screen = await mountPetFamilyManager({sessionToken: 'fixture-token', root: host, initialSurface: surface || 'pets'}); };
  globalThis.__mountGuest = tab => {
    host.replaceChildren();
    const counts = {callsBefore: __calls.length, mountedPrivate: 0};
    globalThis.__screen = mountConsumerSection({section: 'care', root: host, authenticated: false,
      careTab: tab, mountPeople: () => counts.mountedPrivate++, mountPets: () => counts.mountedPrivate++});
    return counts;
  };
  globalThis.__mountGuestBefore = tab => {
    host.replaceChildren();
    globalThis.__screen = mountConsumerSection({section: 'care', root: host, authenticated: false, careTab: tab,
      mountPeople: (root, initialSurface) => mountPersonCareManager({root, initialSurface}),
      mountPets: (root, initialSurface) => mountPetFamilyManager({root, initialSurface})});
  };
  globalThis.__mountCare = () => {
    host.replaceChildren();
    globalThis.__screen = mountConsumerSection({
      section: 'care',
      root: host,
      authenticated: true,
      loadCareCounts: async () => ({people: 4, pets: 1}),
      mountPeople: (root, initialSurface, reportCounts) => mountPersonCareManager({sessionToken: 'fixture-token', root, initialSurface, onCountChange: reportCounts}),
      mountPets: (root, initialSurface, reportCounts) => mountPetFamilyManager({sessionToken: 'fixture-token', root, initialSurface, onCountChange: reportCounts}),
    });
  };
  globalThis.__file = (name, type = 'image/png') => new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const context = canvas.getContext('2d');
    context.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); context.fillRect(0, 0, 640, 640);
    // Synthetic high-frequency texture, so the existing local blur gate runs normally.
    for (let y = 0; y < 640; y += 4) for (let x = 0; x < 640; x += 4) {
      context.fillStyle = ((x + y) % 8 === 0) ? '#ffffff' : '#202020';
      context.fillRect(x, y, 4, 4);
    }
    canvas.toBlob(blob => resolve(new File([blob], name, {type})), type);
  });
  globalThis.__put = async (input, name) => {
    const transfer = new DataTransfer(); transfer.items.add(await __file(name));
    input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
  };
  globalThis.__overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  globalThis.__fixtureReady = true;
</script></body></html>`;

class Cdp {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const {resolve, reject} = this.pending.get(message.id); this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
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

const SHOTS = process.env.SAFECARE_SCREENSHOT_DIR ? path.resolve(process.env.SAFECARE_SCREENSHOT_DIR) : '';
if (SHOTS) fs.mkdirSync(SHOTS, {recursive: true});
const shots = [];

async function run() {
  const fixtureName = `.safecare-redesign-${process.pid}.html`;
  let fixtureHtml = process.env.SAFECARE_BASELINE_ROOT
    ? FIXTURE_HTML.replace('<link rel="stylesheet" href="/site-family-guardian.css" />', '')
    : FIXTURE_HTML;
  // A deployment-room server may expose this worktree under a temporary path.
  // Import the actual reviewed tree, never another branch served at URL root.
  const servedPath = process.env.SAFECARE_BASE_URL ? new URL(process.env.SAFECARE_BASE_URL).pathname.replace(/\/$/,'') : '';
  if (servedPath) fixtureHtml = fixtureHtml.replaceAll('href="/site-', `href="${servedPath}/site-`).replaceAll("from '/site-", `from '${servedPath}/site-`);
  fs.writeFileSync(path.join(ROOT, fixtureName), fixtureHtml, 'utf8');
  const server = process.env.SAFECARE_BASE_URL ? null : await serve();
  const baseUrl = process.env.SAFECARE_BASE_URL || `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-safecare-'));
  const browser = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let t = 0; t < 200 && !fs.existsSync(portFile); t += 1) await new Promise(resolve => setTimeout(resolve, 100));
    const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(item => item.type === 'page');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
    const cdp = new Cdp(socket);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const results = {};
    const viewports = process.env.SAFECARE_VIEWPORTS_JSON
      ? JSON.parse(process.env.SAFECARE_VIEWPORTS_JSON)
      : [['desktop-1440', 1440, 900, 'light'], ['mobile-390', 390, 844, 'light']];
    for (const [label, width, height, theme = 'light', scheme = theme === 'dark' ? 'dark' : 'light', bootstrap = false] of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
      await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
      await cdp.send('Page.navigate', {url: `${baseUrl}/${fixtureName}`});
      for (let t = 0; t < 100; t += 1) {
        if (await cdp.evaluate('return globalThis.__fixtureReady === true;').catch(() => false)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await cdp.evaluate(`
        document.documentElement.dataset.siteThemeBootstrap = ${JSON.stringify(theme)};
        if (${JSON.stringify(bootstrap)}) delete document.body.dataset.siteTheme;
        else document.body.dataset.siteTheme = ${JSON.stringify(theme)};
      `);
      const shoot = async name => {
        const overflow = await cdp.evaluate('return __overflow();');
        assert.ok(overflow <= 1, `${label}/${name}: horizontal overflow ${overflow}px`);
        if (!SHOTS) return;
        const metrics = await cdp.send('Page.getLayoutMetrics');
        const contentHeight = Math.min(Math.ceil(metrics.cssContentSize?.height || metrics.contentSize.height), 7000);
        const shot = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x: 0, y: 0, width, height: contentHeight, scale: 1}});
        const file = path.join(SHOTS, `${label}-${name}.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
        shots.push(file);
      };
      const r = results[label] = {};

      if (process.env.FAMILY_GUARDIAN_REVIEW === 'before') {
        for (const tab of ['people', 'pets']) {
          await cdp.evaluate(`__mountGuestBefore(${JSON.stringify(tab)}); await __wait(200);`);
          await shoot(`guest-${tab}`);
        }
      }

      if (process.env.FAMILY_GUARDIAN_REVIEW === '1') {
        for (const tab of ['people', 'pets']) {
          const guest = await cdp.evaluate(`
            const counts = __mountGuest(${JSON.stringify(tab)});
            await __wait(100);
            const welcome = document.querySelector('[data-family-guardian-welcome]');
            return {tab: welcome?.dataset.familyGuardianWelcome, login: welcome?.querySelector('a')?.getAttribute('href'),
              text: welcome?.textContent, calls: __calls.length - counts.callsBefore, mountedPrivate: counts.mountedPrivate,
              background: getComputedStyle(host).backgroundColor,
              card: welcome && getComputedStyle(welcome).backgroundColor,
              button: welcome && getComputedStyle(welcome.querySelector('a')).backgroundColor,
              textColor: welcome && getComputedStyle(welcome).color};
          `);
          assert.equal(guest.tab, tab, `${label}: signed-out ${tab} welcome visible`);
          assert.equal(guest.login, '/auth/start/');
          assert.ok(guest.text.includes('로그인하고 시작하기'));
          assert.equal(guest.calls, 0, 'signed-out category never loads target APIs');
          assert.equal(guest.mountedPrivate, 0, 'signed-out category never mounts a private manager');
          if (theme === 'light' || (theme === 'system' && scheme === 'light')) {
            assert.equal(guest.background, 'rgb(246, 247, 249)');
            assert.equal(guest.card, 'rgb(255, 255, 255)');
            assert.equal(guest.button, 'rgb(37, 99, 235)');
          } else {
            assert.notEqual(guest.background, 'rgb(246, 247, 249)');
            assert.notEqual(guest.card, 'rgb(255, 255, 255)');
            assert.notEqual(guest.card, guest.textColor);
          }
          await shoot(`guest-${tab}`);
        }
      }

      // --------------------------------------------- SafeCare category counts
      r.categoryCounts = await cdp.evaluate(`
        __mountCare();
        await __until(() => {
          const current = [...document.querySelectorAll('[role=tab]')];
          return current[0]?.textContent === '사람 · 4' && current[1]?.textContent === '반려동물 · 1';
        });
        const tabs = [...document.querySelectorAll('[role=tab]')];
        const people = tabs[0].textContent;
        const petsBeforeClick = tabs[1].textContent;
        tabs[1].click();
        await __until(() => tabs[1].textContent === '반려동물 · 1');
        return {people, petsBeforeClick, pets: tabs[1].textContent};
      `);

      // ---------------------------------------------------- person: list
      r.personList = await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        const cards = [...document.querySelectorAll('[data-person-card]')].map(card => ({
          name: card.querySelector('.person-card-name').textContent,
          badge: card.querySelector('[data-person-renewal-state]').textContent,
          activeSos: Boolean(card.querySelector('[data-person-active-sos]')),
          activeSosText: card.querySelector('[data-person-active-sos]')?.textContent || '',
          transition: Boolean(card.querySelector('[data-person-sos-open]')),
          closeButton: card.querySelector('[data-person-sos-close]')?.textContent || '',
          photoAction: card.querySelector('[data-person-photos]').textContent,
          text: card.textContent,
        }));
        const cta = document.querySelector('[data-safecare-found-cta="person"]');
        return {cards, cta: Boolean(cta), ctaInsideList: Boolean(cta?.closest('[data-person-list]')), innerMenu: document.querySelectorAll('.person-tabs').length};
      `);
      await shoot('person-01-list');

      // ------------------------------------------- person: photo management
      r.personPhotos = await cdp.evaluate(`
        document.querySelector('[data-person-photos="aaaaaaaa-0000-4000-8000-000000000002"]').click();
        await __until(() => document.querySelector('[data-person-slot-grid]'));
        const tiles = () => [...document.querySelectorAll('[data-person-slot]')];
        const before = {
          count: tiles().length,
          labels: tiles().map(tile => tile.querySelector('.safecare-slot-label').textContent),
          counter: document.querySelector('[data-safecare-photo-count]').textContent,
          guideBoxPresent: Boolean(document.querySelector('[data-safecare-guide="person"]')),
          emptyArtworkCount: tiles().filter(tile => tile.dataset.safecareSlotFilled === 'false' && tile.querySelector('.person-slot-guide-image')).length,
          accept: [...new Set([...document.querySelectorAll('input[type=file]')].map(input => input.accept))],
          tileInputs: tiles().filter(tile => tile.querySelector('input')).length,
          buttons: tiles().map(tile => [tile.dataset.safecareSlotFilled, [...tile.querySelectorAll('button')].map(node => node.textContent).join('|')]),
          nextDisabled: document.querySelector('[data-person-photos-next]').disabled,
          note: document.querySelector('[data-person-photo-set-note]')?.textContent || '',
        };
        __fixtureState.nextCategory = 'BODY';
        await __put(document.querySelector('[data-person-bulk-input]'), 'upper-body.png');
        await __until(() => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === '4');
        return {before, after: document.querySelector('[data-safecare-photo-count]').textContent, posts: __calls.filter(call => call.startsWith('POST ') && call.endsWith('/identity-photos')).length, puts: __calls.filter(call => call.startsWith('PUT ') && call.includes('/identity-photos/')).length};
      `);
      await shoot('person-02-photos');

      // ------------------------------------------------ person: register
      // QA 02 D3: the browser's own accessibility tree names the name input '이름'.
      await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        [...document.querySelectorAll('.person-section-heading button')].find(b => b.textContent === '사람 등록').click();
        await __until(() => document.querySelector('[data-person-basic-form]'));
        return true;
      `);
      await cdp.send('DOM.enable');
      await cdp.send('Accessibility.enable');
      const axRoot = await cdp.send('DOM.getDocument', {depth: 0});
      const nameAx = await cdp.send('Accessibility.queryAXTree', {nodeId: axRoot.root.nodeId, accessibleName: '이름', role: 'textbox'});
      r.personRegister = await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        [...document.querySelectorAll('.person-section-heading button')].find(b => b.textContent === '사람 등록').click();
        await __until(() => document.querySelector('[data-person-basic-form]'));
        const form = document.querySelector('[data-person-basic-form]');
        const trigger = form.querySelector('[data-person-birth-trigger]');
        const nameInput = form.querySelector('input');
        const nameLabel = {
          id: nameInput.id, labels: nameInput.labels.length, forMatches: nameInput.labels[0]?.htmlFor === nameInput.id && Boolean(nameInput.id),
          text: nameInput.labels[0]?.querySelector('.person-field-label')?.textContent || '',
        };
        const selectedYearNow = () => document.querySelector('[data-person-birth-picker] [data-person-birth-year-option][aria-selected="true"]')?.dataset.personBirthYearOption;
        // QA 02 D2: a parent's wheel starts decades back, not at this year.
        const relationshipSelect = form.querySelector('select');
        relationshipSelect.value = 'PARENT';
        trigger.click();
        await __until(() => document.querySelector('[data-person-birth-picker]'));
        await __wait(260);
        const parentStart = selectedYearNow();
        const parentVisible = (() => { const wheel = document.querySelector('[data-person-birth-picker] [aria-label="연도 선택"]'); const option = wheel.querySelector('[aria-selected="true"]'); const a = wheel.getBoundingClientRect(), b = option.getBoundingClientRect(); return b.top >= a.top - 1 && b.bottom <= a.bottom + 1; })();
        document.querySelector('[data-lotbi-sheet-dismiss]').click();
        await __until(() => !document.querySelector('[data-person-birth-picker]'));
        await __wait(260);
        relationshipSelect.value = 'CHILD';
        trigger.click();
        await __until(() => document.querySelector('[data-person-birth-picker]'));
        await __wait(260);
        const childStart = selectedYearNow();
        const picker = document.querySelector('[data-person-birth-picker]');
        const yearWheel = picker.querySelector('[aria-label="연도 선택"]');
        const year2015 = picker.querySelector('[data-person-birth-year-option="2015"]');
        yearWheel.scrollTop = year2015.offsetTop - (yearWheel.clientHeight - year2015.offsetHeight) / 2;
        yearWheel.dispatchEvent(new Event('scroll'));
        await __wait(140);
        return {
          steps: [...document.querySelectorAll('.safecare-step-name')].map(node => node.textContent),
          active: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent,
          triggerTag: trigger?.tagName,
          triggerText: trigger?.textContent,
          wheelLabels: [...picker.querySelectorAll('.person-birth-wheel-label')].map(node => node.textContent),
          monthValues: [...picker.querySelectorAll('[data-person-birth-month-option]')].map(node => node.dataset.personBirthMonthOption),
          scrolledYear: picker.querySelector('[data-person-birth-year-option][aria-selected="true"]')?.dataset.personBirthYearOption,
          parentStart, parentVisible, childStart, nameLabel, thisYear: new Date().getFullYear(),
          dayControls: picker.querySelectorAll('[data-person-birth-day], [aria-label*="일 선택"]').length,
          typedBirthControls: form.querySelectorAll('input[type=number], [data-person-birth-year][contenteditable], [data-person-birth-month][contenteditable]').length,
          numberInputs: form.querySelectorAll('input[type=number]').length,
          inlineRenewalNotices: [...form.querySelectorAll('.person-consent')].filter(node => node.textContent.includes('갱신 주기')).length,
        };
      `);
      r.personRegister.nameAccessibleName = nameAx.nodes.length === 1;
      await shoot('person-03-register-step1');
      r.personRenewalNotice = await cdp.evaluate(`
        const form = document.querySelector('[data-person-basic-form]');
        form.querySelector('input').value = '정우리';
        document.querySelector('[data-person-birth-year-option="2018"]').click();
        document.querySelector('[data-person-birth-month-option="8"]').click();
        document.querySelector('[data-person-birth-confirm]').click();
        const selectedBirth = form.querySelector('[data-person-birth-trigger]').textContent;
        form.requestSubmit();
        await __until(() => document.querySelector('[data-safecare-renewal-dialog="person"]'));
        const renewalDialog = document.querySelector('[data-safecare-renewal-dialog="person"]');
        if (!renewalDialog) return {
          selectedBirth, renewalNotice: null,
        };
        const renewalNotice = {
          title: renewalDialog.querySelector('h3')?.textContent || '',
          text: renewalDialog.textContent,
          createdBeforeConfirm: __calls.includes('POST /v2/person-profiles'),
          activeBeforeConfirm: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent,
          sectionCount: renewalDialog.querySelectorAll('[data-safecare-notice-section]').length,
          guardianVisible: Boolean(renewalDialog.querySelector('[data-safecare-notice-section="guardian"]')),
          // SAFECARE-CONSENT-VISIBLE-01: inactive until consent, but never a silently dead button.
          confirmDisabledInitially: renewalDialog.querySelector('[data-safecare-renewal-confirm]')?.getAttribute('aria-disabled') === 'true',
          confirmNativeDisabled: renewalDialog.querySelector('[data-safecare-renewal-confirm]')?.disabled,
          // Every required checkbox is visible before any 상세보기 is opened.
          visibleConsents: [...renewalDialog.querySelectorAll('[data-safecare-consent]')].filter(input => input.getClientRects().length > 0).map(input => input.dataset.safecareConsent),
          openDetailsAtStart: [...renewalDialog.querySelectorAll('[data-safecare-notice-detail]')].filter(node => !node.hidden).length,
        };
        // Pressing without consent says which ones are missing, moves to the first, creates nothing.
        renewalDialog.querySelector('[data-safecare-renewal-confirm]').click();
        await __wait(80);
        const missingError = renewalDialog.querySelector('.safecare-renewal-error');
        renewalNotice.missingPress = {
          shown: !missingError.hidden, text: missingError.textContent, role: missingError.getAttribute('role'),
          focused: document.activeElement?.dataset?.safecareConsent || '',
          outlined: renewalDialog.querySelectorAll('.safecare-consent-row.is-missing').length,
          created: __calls.includes('POST /v2/person-profiles'),
        };
        // 모두 동의 ticks every required box at once and can untick them again.
        const allConsent = renewalDialog.querySelector('[data-safecare-consent-all]');
        allConsent.click();
        renewalNotice.afterAll = {
          checked: [...renewalDialog.querySelectorAll('[data-safecare-consent]')].every(input => input.checked),
          ready: renewalDialog.querySelector('[data-safecare-renewal-confirm]').getAttribute('aria-disabled') === 'false',
          errorHidden: missingError.hidden,
          outlined: renewalDialog.querySelectorAll('.safecare-consent-row.is-missing').length,
        };
        allConsent.click();
        renewalNotice.afterAllAgain = [...renewalDialog.querySelectorAll('[data-safecare-consent]')].some(input => input.checked);
        renewalDialog.querySelector('[data-safecare-notice-toggle="renewal"]').click();
        renewalNotice.openAfterRenewal = [...renewalDialog.querySelectorAll('[data-safecare-notice-detail]')]
          .filter(node => !node.hidden).map(node => node.dataset.safecareNoticeDetail);
        renewalDialog.querySelector('[data-safecare-notice-toggle="usage"]').click();
        renewalNotice.openAfterUsage = [...renewalDialog.querySelectorAll('[data-safecare-notice-detail]')]
          .filter(node => !node.hidden).map(node => node.dataset.safecareNoticeDetail);
        const usageConsent = renewalDialog.querySelector('[data-safecare-consent="usage"]');
        renewalNotice.usageLabel = usageConsent.closest('label').textContent.trim();
        usageConsent.click();
        renewalNotice.disabledAfterUsage = renewalDialog.querySelector('[data-safecare-renewal-confirm]').getAttribute('aria-disabled') === 'true';
        const privacyConsent = renewalDialog.querySelector('[data-safecare-consent="privacy"]');
        renewalNotice.privacyLabel = privacyConsent.closest('label').textContent.trim();
        privacyConsent.click();
        renewalNotice.disabledAfterPrivacy = renewalDialog.querySelector('[data-safecare-renewal-confirm]').getAttribute('aria-disabled') === 'true';
        // Only the guardian consent is left: the message names just that one.
        renewalDialog.querySelector('[data-safecare-renewal-confirm]').click();
        await __wait(80);
        renewalNotice.guardianOnlyMissing = renewalDialog.querySelector('.safecare-renewal-error').textContent;
        renewalDialog.querySelector('[data-safecare-notice-toggle="guardian"]').click();
        const guardianConsent = renewalDialog.querySelector('[data-safecare-consent="guardian"]');
        renewalNotice.guardianLabel = guardianConsent.closest('label').textContent.trim();
        guardianConsent.click();
        renewalNotice.confirmEnabledAfterRequiredConsents = renewalDialog.querySelector('[data-safecare-renewal-confirm]').getAttribute('aria-disabled') === 'false'
          && !renewalDialog.querySelector('[data-safecare-renewal-confirm]').disabled;
        renewalNotice.errorClearedAfterConsent = renewalDialog.querySelector('.safecare-renewal-error').hidden;
        renewalNotice.confirmText = renewalDialog.querySelector('[data-safecare-renewal-confirm]').textContent;
        await __wait(260);
        return {selectedBirth, renewalNotice};
      `);
      await shoot('person-04-renewal-notice');
      r.personRegisterFlow = await cdp.evaluate(`
        document.querySelector('[data-safecare-renewal-confirm]').click();
        await __until(() => document.querySelector('[data-person-slot-grid]'));
        const create = __calls.find(call => call === 'POST /v2/person-profiles');
        const retry = [...document.querySelectorAll('[data-person-slot]')].map(tile => tile.querySelectorAll('button').length);
        const pickers = document.querySelectorAll('[data-person-slot] input, [data-person-slot-input]').length;
        const bulkPick = document.querySelector('[data-person-bulk-pick]')?.textContent || '';
        return {create: Boolean(create), active: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent, retry, pickers, bulkPick};
      `);
      await shoot('person-05-register-step2');
      // Visual review uses actual UI actions and synthetic accepted upload responses.
      // Server photo validation is tested separately, never inferred from this fixture.
      r.personComplete = await cdp.evaluate(`
        for (let n = 1; n <= 5; n++) {
          __fixtureState.nextCategory = n <= 3 ? 'FACE' : 'BODY';
          await __put(document.querySelector('[data-person-bulk-input]'), 'register-' + n + '.png');
          await __until(() => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === String(n));
        }
        const next = document.querySelector('[data-person-photos-next]');
        if (next.disabled) throw new Error('five required photos did not enable review');
        next.click();
        await __until(() => document.querySelector('[data-person-finish]'));
        return {review: document.querySelector('.person-review')?.textContent || ''};
      `);
      await shoot('person-08-confirmation');
      r.personComplete.done = await cdp.evaluate(`
        document.querySelector('[data-person-finish]').click();
        await __until(() => document.querySelector('[data-person-register-done]'));
        if (!document.querySelector('[data-person-register-done]')) throw new Error('completion missing');
        return document.querySelector('[data-person-register-done]').textContent;
      `);
      await shoot('person-09-complete');
      if (process.env.FAMILY_GUARDIAN_REGISTRATION_REVIEW === '1') {
        assert.ok(r.personComplete.done.includes('FAM-****-****'),'완료 화면 대상 번호 마스킹');
        assert.ok(!r.personComplete.done.includes('aaaaaaaa-0000-4000-8000-000000000005'),'완료 화면 내부 대상 번호 비노출');
        assert.ok(r.personComplete.done.includes('2018년 8월'),'기존 아동 등록 출생정보 완료 표시 유지');
      }
      await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        document.querySelector('[data-person-card="aaaaaaaa-0000-4000-8000-000000000005"] .person-text-button').click();
        await __until(() => document.querySelector('[data-person-basic-form]'));
        return true;
      `);
      await shoot('person-10-info-edit');
      if (process.env.FAMILY_GUARDIAN_REGISTRATION_REVIEW === '1') {
        r.personPartialEdit = await cdp.evaluate(`
          const before = __calls.filter(call => call.startsWith('PATCH /v2/person-profiles/')).length;
          document.querySelector('[data-person-basic-form]').requestSubmit();
          await __until(() => document.querySelector('[data-person-list]'));
          const unchanged = __calls.filter(call => call.startsWith('PATCH /v2/person-profiles/')).length === before;
          const unchangedCopy = document.querySelector('.person-status').textContent;
          document.querySelector('[data-person-card="aaaaaaaa-0000-4000-8000-000000000005"] .person-text-button').click();
          await __until(() => document.querySelector('[data-person-basic-form]'));
          document.querySelector('[data-person-birth-trigger]').click();
          document.querySelector('[data-person-birth-year-option="2000"]').click();
          document.querySelector('[data-person-birth-month-option="1"]').click();
          document.querySelector('[data-person-birth-confirm]').click();
          document.querySelector('[data-person-basic-form]').requestSubmit();
          await __until(() => document.querySelector('[data-person-list]'));
          await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
          const storedCard = document.querySelector('[data-person-card="aaaaaaaa-0000-4000-8000-000000000005"]');
          return {unchanged,unchangedCopy,text:storedCard.textContent,revision:__fixtureState.people.find(row=>row.person_id.endsWith('5')).revision};
        `);
        assert.equal(r.personPartialEdit.unchanged,true,'무변경 저장은 PATCH 0건');
        assert.ok(r.personPartialEdit.unchangedCopy.includes('변경한 정보가 없습니다.'));
        assert.ok(r.personPartialEdit.text.includes('2000년 1월'),'정보 수정 후 실제 화면 재조회 출생정보 유지');
        assert.ok(r.personPartialEdit.text.includes('등록 완료'),'필수 사진 완료와 재조회 등록 상태 일치');
        assert.equal(r.personPartialEdit.revision,2);
        await shoot('person-12-birth-2000-reloaded');
      }

      // -------------------------------------------------- person: SOS rules
      r.personSos = await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        document.querySelector('[data-person-sos-open="aaaaaaaa-0000-4000-8000-000000000003"]').click();
        await __until(() => document.querySelector('[data-person-sos-form]'));
        const blocked = document.querySelector('[data-person-sos-blocked]')?.textContent || '';
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        document.querySelector('[data-person-sos-open="aaaaaaaa-0000-4000-8000-000000000004"]').click();
        await __until(() => document.querySelector('[data-person-sos-form] input[type=checkbox]'));
        const form = document.querySelector('[data-person-sos-form]');
        return {blocked, fields: [...form.querySelectorAll('.person-field-label')].map(node => node.textContent), consent: Boolean(form.querySelector('input[type=checkbox]'))};
      `);
      await shoot('person-05-sos-form');
      if (process.env.FAMILY_GUARDIAN_SOS_REVIEW === '1') {
        const entry = await cdp.evaluate(`
          const form=document.querySelector('[data-person-sos-form]');
          const checkbox=form.querySelector('input[type=checkbox]'),submit=form.querySelector('button[type=submit]');
          const initial={unchecked:!checkbox.checked,disabled:submit.disabled};
          const place=[...form.querySelectorAll('input')].find(input=>input.placeholder.startsWith('예:'));
          place.value='가상 시험 장소';place.dispatchEvent(new Event('input',{bubbles:true}));checkbox.click();
          const enabled=!submit.disabled;
          checkbox.click(); const revoked=submit.disabled;
          place.value='';place.dispatchEvent(new Event('input',{bubbles:true}));
          return {initial,enabled,revoked};
        `);
        assert.deepEqual(entry.initial,{unchecked:true,disabled:true});
        assert.equal(entry.enabled,true); assert.equal(entry.revoked,true);
      }

      // ------------------------------------------------ person: found report
      r.personFound = await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        document.querySelector('[data-safecare-found-cta="person"] button').click();
        await __until(() => document.querySelector('[data-person-found-composer]'));
        const sightingWrites = () => __calls.filter(call => /^(POST|PUT) \\/v2\\/safecare\\/human-sightings/.test(call)).length;
        const steps = [];
        const snapshot = n => ({
          n,
          counter: document.querySelector('[data-safecare-found-count]').textContent,
          submitDisabled: document.querySelector('[data-person-found-submit]').disabled,
          addDisabled: document.querySelector('[data-person-found-add]').disabled,
          writes: sightingWrites(),
        });
        steps.push(snapshot(0));
        for (let n = 1; n <= 10; n += 1) {
          await __put(document.querySelector('[data-person-found-input]'), 'found' + n + '.png');
          await __until(() => document.querySelector('[data-safecare-found-count]')?.dataset.safecareFoundCount === String(n));
          steps.push(snapshot(n));
          if (n === 1) globalThis.__shotFound1 = true;
        }
        return {steps, noMatchBeforeSubmit: document.querySelector('[data-person-found-composer]').textContent.includes('확인 가능한 일치 대상 없음')};
      `);
      await shoot('person-06-found-10photos');
      r.personFoundSubmit = await cdp.evaluate(`
        const location = [...document.querySelectorAll('.safecare-found-details input')].find(input => input.type !== 'datetime-local');
        location.value = '분당구 정자역 2번 출구'; location.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('[data-person-found-submit]').click();
        await __until(() => document.querySelector('[data-person-found-report="r-new"]'));
        const card = id => document.querySelector('[data-person-found-report="' + id + '"]');
        return {
          creates: __calls.filter(call => call === 'POST /v2/safecare/human-sightings').length,
          photoPuts: __calls.filter(call => /^PUT \\/v2\\/safecare\\/human-sightings\\/r-new\\/photos\\//.test(call)).length,
          submits: __calls.filter(call => call === 'POST /v2/safecare/human-sightings/r-new/submit').length,
          newState: card('r-new')?.dataset.safecareReviewState,
          newText: card('r-new')?.textContent || '',
          nrmText: card('r-nrm')?.textContent || '',
          analyzingText: card('r-an')?.textContent || '',
        };
      `);
      await shoot('person-07-found-submitted');

      // ------------------------------------------------------- pet: list
      r.petList = await cdp.evaluate(`
        __calls.length = 0;
        await __mountPet(); await __until(() => document.querySelector('[data-pet-card]'));
        await __wait(300);
        const card = document.querySelector('[data-pet-card]');
        return {
          menu: document.querySelectorAll('[data-pet-home-target]').length,
          badge: card.querySelector('[data-pet-renewal-state]')?.textContent || '',
          renewal: card.querySelector('.pet-profile-renewal')?.textContent || '',
          transition: Boolean(card.querySelector('[data-pet-sos-target]')),
          activeSos: Boolean(card.querySelector('[data-pet-active-sos]')),
          cta: Boolean(document.querySelector('[data-safecare-found-cta="pet"]')),
        };
      `);
      await shoot('pet-01-list');

      // ------------------------------------------------- pet: found report
      r.petFound = await cdp.evaluate(`
        document.querySelector('[data-pet-found-open]').click();
        await __until(() => document.querySelector('[data-pet-found-composer]'));
        const writes = () => __calls.filter(call => /^(POST|PUT) \\/v2\\/pets\\/found/.test(call)).length;
        const snapshot = n => ({n, counter: document.querySelector('[data-safecare-found-count]').textContent, submitDisabled: document.querySelector('[data-pet-found-submit]').disabled, addDisabled: document.querySelector('[data-pet-found-add]').disabled, writes: writes()});
        const steps = [snapshot(0)];
        for (let n = 1; n <= 10; n += 1) {
          await __put(document.querySelector('[data-pet-found-input]'), 'pet' + n + '.png');
          await __until(() => document.querySelector('[data-safecare-found-count]')?.dataset.safecareFoundCount === String(n));
          steps.push(snapshot(n));
        }
        const nrm = document.querySelector('[data-pet-case="pfound_nrm"]')?.textContent || '';
        return {steps, nrm};
      `);
      await shoot('pet-02-found-10photos');
      r.petFoundSubmit = await cdp.evaluate(`
        const place = document.querySelectorAll('.safecare-found-details input[type=text]')[0];
        place.value = '정자동 느티마을 앞'; place.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('[data-pet-found-submit]').click();
        await __until(() => document.querySelector('[data-pet-case="pfound_new"]'));
        return {
          creates: __calls.filter(call => call === 'POST /v2/pets/found').length,
          photoPuts: __calls.filter(call => /^PUT \\/v2\\/pets\\/found\\/pfound_new\\/photos\\//.test(call)).length,
          submits: __calls.filter(call => call === 'POST /v2/pets/found/pfound_new/submit').length,
          newText: document.querySelector('[data-pet-case="pfound_new"]')?.textContent || '',
        };
      `);
      await shoot('pet-03-found-submitted');

      // -------------------------------------------------- pet: registration
      r.petRegister = await cdp.evaluate(`
        await __mountPet(); await __until(() => document.querySelector('.pet-add-button'));
        await __wait(200);
        document.querySelector('.pet-add-button').click();
        await __until(() => document.querySelector('[data-pet-register-form]'));
        const label = document.querySelector('[data-pet-draft-progress]').textContent;
        const slotsAtStart = document.querySelectorAll('[data-pet-draft-slot]').length;
        const listHidden = document.querySelector('[data-pet-list]').closest('section').hidden;
        const back = Boolean(document.querySelector('[data-pet-register-back]'));
        const activeStep = document.querySelector('[data-pet-draft-step][aria-current=step]')?.dataset.safecareStepState || '';
        return {label, slotsAtStart, listHidden, back, activeStep, ageModes: [...document.querySelectorAll('input[name=pet-age-mode]')].map(input => input.value), family: [...document.querySelectorAll('[data-pet-register-form] .site-field')].some(field => field.firstChild?.textContent === '가족이 된 날 (선택)')};
      `);
      await shoot('pet-04-register-step1');
      r.petRenewalNotice = await cdp.evaluate(`
        document.querySelector('input[name=pet-species][value=DOG]').click();
        const form = document.querySelector('[data-pet-register-form]');
        form.querySelector('input[type=text]').value = '보리';
        form.querySelector('input[name=pet-sex][value=FEMALE]').click();
        const breed = form.querySelector('select'); breed.value = 'JINDO'; breed.dispatchEvent(new Event('change', {bubbles: true}));
        form.requestSubmit();
        await __until(() => document.querySelector('[data-safecare-renewal-dialog="pet"]'));
        const renewalDialog = document.querySelector('[data-safecare-renewal-dialog="pet"]');
        if (!renewalDialog) return {renewalNotice: null};
        const renewalNotice = {
          title: renewalDialog.querySelector('h3')?.textContent || '',
          text: renewalDialog.textContent,
          photosVisibleBeforeConfirm: Boolean(document.querySelector('[data-pet-draft-slot]')),
          guardianVisible: Boolean(renewalDialog.querySelector('[data-safecare-consent="guardian"]')),
          confirmDisabledInitially: renewalDialog.querySelector('[data-safecare-renewal-confirm]')?.getAttribute('aria-disabled') === 'true',
        };
        renewalDialog.querySelector('[data-safecare-renewal-confirm]').click();
        await __wait(80);
        renewalNotice.missingPress = {
          text: renewalDialog.querySelector('.safecare-renewal-error').textContent,
          photos: Boolean(document.querySelector('[data-pet-draft-slot]')),
        };
        const privacyConsent = renewalDialog.querySelector('[data-safecare-consent="privacy"]');
        renewalNotice.privacyLabel = privacyConsent.closest('label').textContent.trim();
        privacyConsent.click();
        renewalNotice.confirmEnabledAfterPrivacy = renewalDialog.querySelector('[data-safecare-renewal-confirm]').getAttribute('aria-disabled') === 'false';
        await __wait(260);
        return {renewalNotice};
      `);
      await shoot('pet-05-renewal-notice');
      r.petRegisterPhotos = await cdp.evaluate(`
        document.querySelector('[data-safecare-renewal-confirm]').click();
        await __until(() => document.querySelector('[data-pet-draft-slot]'));
        return {
          label: document.querySelector('[data-pet-draft-progress]').textContent,
          slots: document.querySelectorAll('[data-pet-draft-slot]').length,
          guide: document.querySelector('[data-safecare-guide]')?.dataset.safecareGuide || '',
          artwork: document.querySelector('.safecare-guide-art')?.getAttribute('src') || '',
          guideMap: document.querySelectorAll('.safecare-guide-map, .safecare-guide-title').length,
          firstTileArt: document.querySelector('[data-pet-draft-slot="FACE_FRONT"] .pet-slot-guide-image')?.dataset.petApprovedSource || '',
          counter: document.querySelector('[data-safecare-photo-count]')?.textContent || '',
          firstOpen: document.querySelector('[data-pet-draft-slot="FACE_FRONT"]')?.dataset.petDraftSlotLocked,
          tileInputs: document.querySelectorAll('[data-pet-draft-slot] input').length,
          bulkPick: document.querySelector('[data-pet-bulk-pick]')?.textContent || '',
          nextDisabled: document.querySelector('[data-pet-draft-next="REVIEW"]')?.disabled,
        };
      `);
      await shoot('pet-06-register-step2-photos');
      // PET-REGISTER-BASIC-FIRST-01: back to the list, then "등록 계속" opens
      // the saved draft at 1단계 기본정보 again, filled in, on its own screen.
      r.petResume = await cdp.evaluate(`
        document.querySelector('[data-pet-register-back]').click();
        await __until(() => !document.querySelector('[data-pet-draft-slot]'));
        const listBack = {
          listVisible: !document.querySelector('[data-pet-list]').closest('section').hidden,
          button: document.querySelector('.pet-add-button').textContent,
          buttonHidden: document.querySelector('.pet-add-button').hidden,
        };
        document.querySelector('.pet-add-button').click();
        await __until(() => document.querySelector('[data-pet-register-form]'));
        return {
          listBack,
          label: document.querySelector('[data-pet-draft-progress]')?.textContent || '',
          name: document.querySelector('[data-pet-register-form] input[type=text]')?.value || '',
          species: document.querySelector('input[name=pet-species]:checked')?.value || '',
          listHidden: document.querySelector('[data-pet-list]').closest('section').hidden,
        };
      `);
      await shoot('pet-07-register-resume-step1');
      await cdp.evaluate(`
        document.querySelector('[data-pet-register-form]').requestSubmit();
        await __until(() => document.querySelector('[data-safecare-renewal-dialog="pet"]'));
        document.querySelector('[data-safecare-consent="privacy"]').click();
        document.querySelector('[data-safecare-renewal-confirm]').click();
        await __until(() => document.querySelector('[data-pet-bulk-input]'));
        for (let n = 1; n <= 5; n++) {
          await __put(document.querySelector('[data-pet-bulk-input]'), 'pet-register-' + n + '.png');
          await __until(() => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === String(n));
        }
        const next = document.querySelector('[data-pet-draft-next="REVIEW"]');
        await __until(() => !document.querySelector('[data-pet-draft-next="REVIEW"]')?.disabled);
        if (document.querySelector('[data-pet-draft-next="REVIEW"]').disabled) throw new Error('five accepted pet photos did not enable review: ' + JSON.stringify(__draft) + ' / ' + document.querySelector('[data-pet-bulk]').textContent);
        next.click(); await __until(() => document.querySelector('[data-pet-draft-finalize]'));
        return true;
      `);
      await shoot('pet-08-confirmation');
      await cdp.evaluate(`
        document.querySelector('[data-pet-draft-finalize]').click();
        await __until(() => document.querySelector('[data-pet-register-done]'));
        if (!document.querySelector('[data-pet-register-done]')) throw new Error('pet completion missing');
        document.querySelector('[data-pet-gate-notice] button')?.click();
        return true;
      `);
      await shoot('pet-09-complete');
      await cdp.evaluate(`
        await __mountPet(); await __until(() => document.querySelector('[data-pet-open]'));
        document.querySelector('[data-pet-open="PET_KR_DDDDDDDDDDDDDDDDDDDD"]').click();
        await __until(() => document.querySelector('[data-pet-photos]'));
        return true;
      `);
      await shoot('pet-10-photos-and-info-edit');
      await cdp.evaluate(`
        await __mountPet(); await __until(() => document.querySelector('[data-pet-sos-target]'));
        document.querySelector('[data-pet-sos-target="PET_KR_DDDDDDDDDDDDDDDDDDDD"]').click();
        await __until(() => document.querySelector('[data-pet-sos-form]'));
        if (!document.querySelector('[data-pet-sos-form]')) throw new Error('pet SOS form missing');
        return true;
      `);
      await shoot('pet-11-sos-form');
      if (process.env.FAMILY_GUARDIAN_SOS_REVIEW === '1') {
        const entry = await cdp.evaluate(`
          const form=document.querySelector('[data-pet-sos-form]');
          const checkbox=form.querySelector('input[type=checkbox]'),submit=form.querySelector('button[type=submit]');
          const initial={unchecked:!checkbox.checked,disabled:submit.disabled};
          const place=[...form.querySelectorAll('input')].find(input=>input.placeholder.startsWith('예:'));
          place.value='가상 시험 장소';place.dispatchEvent(new Event('input',{bubbles:true}));checkbox.click();
          const enabled=!submit.disabled;
          checkbox.click(); const revoked=submit.disabled;
          return {initial,enabled,revoked};
        `);
        assert.deepEqual(entry.initial,{unchecked:true,disabled:true});
        assert.equal(entry.enabled,true);assert.equal(entry.revoked,true);
      }
    }
    socket.close();
    return results;
  } finally {
    browser.kill();
    server?.close();
    fs.rmSync(path.join(ROOT, fixtureName), {force: true});
    try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
  }
}

const results = await run();
for (const [label, r] of Object.entries(results)) {
  assert.deepEqual(r.categoryCounts, {people: '사람 · 4', petsBeforeClick: '반려동물 · 1', pets: '반려동물 · 1'}, `${label}: both SafeCare categories must show their counts before either tab is opened`);

  // person list: inner menu gone, card actions, ACTIVE SOS only, separate CTA
  const cards = Object.fromEntries(r.personList.cards.map(card => [card.name, card]));
  assert.equal(r.personList.innerMenu, 0, `${label}: the person inner menu must be gone`);
  assert.ok(r.personList.cta && !r.personList.ctaInsideList, `${label}: the found CTA must be separate from the list`);
  assert.equal(cards['김하늘'].activeSos, true, `${label}: an ACTIVE SOS must show on its card`);
  assert.ok(cards['김하늘'].activeSosText.includes('망원한강공원 입구'), `${label}: the active SOS must show where they were last seen`);
  assert.equal(cards['김하늘'].closeButton, '실종 종료', `${label}: an active SOS must offer 실종 종료`);
  assert.equal(cards['김하늘'].transition, false, `${label}: a person already missing must not offer the transition again`);
  for (const name of ['박영자', '이도윤', '최민준']) {
    assert.equal(cards[name].activeSos, false, `${label}: ${name} has no ACTIVE SOS and must show no missing state`);
    // An unfinished registration (박영자 3/10) offers 이어서 등록하기 instead of a blocked transition.
    assert.equal(cards[name].transition, name !== '박영자', `${label}: ${name} 실종 상태로 전환`);
  }
  // SAFECARE-PERSON-DARK-CANCEL-01: 등록 완료 / 등록 중 / 사진 갱신 필요.
  assert.equal(cards['김하늘'].badge, '등록 완료');
  assert.equal(cards['이도윤'].badge, '사진 갱신 필요');
  assert.equal(cards['최민준'].badge, '갱신 예정 · 7일 남음');
  assert.ok(cards['최민준'].text.includes('2026.10.12'), `${label}: Core's next renewal date must show`);
  assert.equal(cards['박영자'].photoAction, '이어서 등록하기');
  assert.equal(cards['박영자'].badge, '등록 중 · 사진 3장');
  assert.equal(cards['김하늘'].photoAction, '사진 갱신·관리');

  // person photos: five visible required examples plus five optional-capacity
  // slots in the collapsed disclosure; Core still owns all ten physical slots.
  assert.equal(r.personPhotos.before.count, 10, `${label}: five required and five optional physical slots`);
  assert.deepEqual(r.personPhotos.before.labels, ['얼굴 사진', '얼굴 사진', '얼굴 사진', '상반신 사진', '전신 사진', '추가 얼굴 사진', '추가 얼굴 사진', '추가 얼굴 사진', '추가 얼굴 사진', '추가 얼굴 사진']);
  assert.equal(r.personPhotos.before.counter, '얼굴 3/3 · 몸 0/2지금 3장 · 10장까지 올릴 수 있어요');
  assert.equal(r.personPhotos.before.note, '상반신·전신 사진 2장이 더 있으면 등록을 마칠 수 있어요.');
  assert.equal(r.personPhotos.before.guideBoxPresent, false, `${label}: the duplicated explanation box must not sit above the photo cards`);
  assert.equal(r.personPhotos.before.emptyArtworkCount, 7, `${label}: every empty photo card must show its own large shooting example`);
  assert.deepEqual(r.personPhotos.before.accept, ['image/*']);
  // SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): photos go in through the gallery picker
  // only (one slot-free POST each); the tiles have no picker or button while registering.
  assert.equal(r.personPhotos.before.tileInputs, 0, `${label}: no per-tile picker`);
  assert.deepEqual(r.personPhotos.before.buttons, [...Array(3).fill(['true', '']), ...Array(7).fill(['false', ''])], `${label}: no tile button while registering`);
  assert.equal(r.personPhotos.before.nextDisabled, true, `${label}: three faces without body photos must not move on`);
  assert.equal(r.personPhotos.after, '얼굴 3/3 · 몸 1/2지금 4장 · 10장까지 올릴 수 있어요');
  assert.deepEqual([r.personPhotos.posts, r.personPhotos.puts], [1, 0], `${label}: one POST, no per-slot PUT`);

  // person registration: four steps, one year/month wheel and no day field
  assert.deepEqual(r.personRegister.steps, ['기본정보', '식별 사진', '최종 확인', '등록 완료']);
  assert.equal(r.personRegister.active, '기본정보');
  assert.equal(r.personRegister.triggerTag, 'BUTTON');
  assert.equal(r.personRegister.triggerText, '출생 연월 선택');
  assert.deepEqual(r.personRegister.wheelLabels, ['연도', '월']);
  assert.deepEqual(r.personRegister.monthValues, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.equal(r.personRegister.scrolledYear, '2015', `${label}: scrolling the wheel must change its selected year`);
  // QA 02 D2 / D3
  assert.equal(r.personRegister.parentStart, String(r.personRegister.thisYear - 65), `${label}: a parent's wheel starts near a likely birth year`);
  assert.equal(r.personRegister.parentVisible, true, `${label}: the start year is scrolled into view`);
  assert.equal(r.personRegister.childStart, String(r.personRegister.thisYear - 8), `${label}: a child's wheel starts near a likely birth year`);
  assert.deepEqual(r.personRegister.nameLabel, {id: r.personRegister.nameLabel.id, labels: 1, forMatches: true, text: '이름'}, `${label}: the name input is tied to its label`);
  assert.equal(r.personRegister.nameAccessibleName, true, `${label}: the name input's accessible name is 이름`);
  assert.equal(r.personRegister.dayControls, 0, `${label}: birth day must not be collected`);
  assert.equal(r.personRegister.typedBirthControls, 0, `${label}: birth year/month must not be typed`);
  assert.equal(r.personRegister.numberInputs, 0);
  assert.equal(r.personRegister.inlineRenewalNotices, 0, `${label}: renewal policy belongs in the confirmation dialog, not weak inline helper copy`);
  assert.equal(r.personRenewalNotice.selectedBirth, '2018년 8월');
  assert.equal(r.personRegisterFlow.create, true);
  assert.equal(r.personRegisterFlow.active, '식별 사진');
  assert.equal(r.personRenewalNotice.renewalNotice?.title, '식별 사진 등록 안내', `${label}: person registration notice must open before photos`);
  assert.equal(r.personRenewalNotice.renewalNotice.createdBeforeConfirm, false, `${label}: person profile must not be created before renewal notice confirmation`);
  assert.equal(r.personRenewalNotice.renewalNotice.activeBeforeConfirm, '기본정보');
  assert.equal(r.personRenewalNotice.renewalNotice.sectionCount, 3, `${label}: under-14 child must see renewal, usage, and guardian sections`);
  assert.equal(r.personRenewalNotice.renewalNotice.guardianVisible, true, `${label}: under-14 child must require guardian confirmation`);
  assert.equal(r.personRenewalNotice.renewalNotice.confirmDisabledInitially, true, `${label}: registration must wait for required consent`);
  // SAFECARE-CONSENT-VISIBLE-01 (QA 02 D1)
  assert.equal(r.personRenewalNotice.renewalNotice.confirmNativeDisabled, false, `${label}: the button answers a press instead of being silently dead`);
  assert.deepEqual(r.personRenewalNotice.renewalNotice.visibleConsents, ['usage', 'privacy', 'guardian'], `${label}: every required checkbox is visible without opening 상세보기`);
  assert.equal(r.personRenewalNotice.renewalNotice.openDetailsAtStart, 0, `${label}: only the explanations are folded`);
  assert.deepEqual(r.personRenewalNotice.renewalNotice.missingPress, {
    shown: true, role: 'alert', focused: 'usage', outlined: 3, created: false,
    text: '필수 동의가 빠졌어요: 식별 사진 등록 및 이용 동의, 법정대리인 확인. 체크한 뒤 다시 눌러 주세요.',
  }, `${label}: a press without consent names what is missing and creates nothing`);
  assert.deepEqual(r.personRenewalNotice.renewalNotice.afterAll, {checked: true, ready: true, errorHidden: true, outlined: 0}, `${label}: 모두 동의 ticks every required box`);
  assert.equal(r.personRenewalNotice.renewalNotice.afterAllAgain, false, `${label}: 모두 동의 unticks them again`);
  assert.equal(r.personRenewalNotice.renewalNotice.guardianOnlyMissing, '필수 동의가 빠졌어요: 법정대리인 확인. 체크한 뒤 다시 눌러 주세요.', `${label}: the message names only what is still missing`);
  assert.equal(r.personRenewalNotice.renewalNotice.errorClearedAfterConsent, true, `${label}: the message goes away once everything is ticked`);
  assert.deepEqual(r.personRenewalNotice.renewalNotice.openAfterRenewal, ['renewal'], `${label}: renewal details must open alone`);
  assert.deepEqual(r.personRenewalNotice.renewalNotice.openAfterUsage, ['usage'], `${label}: opening usage details must close renewal details`);
  assert.equal(r.personRenewalNotice.renewalNotice.usageLabel, '위 내용에 동의합니다 (필수)');
  assert.equal(r.personRenewalNotice.renewalNotice.disabledAfterUsage, true, `${label}: guardian consent must still be required`);
  assert.equal(r.personRenewalNotice.renewalNotice.privacyLabel, '🔒 사진은 비공개로 안전하게 보관되며, 분실·발견 시 후보 비교를 위해 사용됩니다. (필수)');
  assert.equal(r.personRenewalNotice.renewalNotice.disabledAfterPrivacy, true, `${label}: guardian consent must remain required after privacy consent`);
  assert.equal(r.personRenewalNotice.renewalNotice.guardianLabel, '법정대리인임을 확인하고 동의합니다 (필수)');
  assert.equal(r.personRenewalNotice.renewalNotice.confirmEnabledAfterRequiredConsents, true, `${label}: all required consent enables registration`);
  assert.equal(r.personRenewalNotice.renewalNotice.confirmText, '동의하고 식별 사진 등록');
  assert.ok(r.personRenewalNotice.renewalNotice.text.includes('만 12세 이하 · 180일마다'));
  assert.ok(r.personRenewalNotice.renewalNotice.text.includes('만 13세 이상 · 365일마다'));
  assert.ok(r.personRenewalNotice.renewalNotice.text.includes('만료 30일·7일·1일 전'));
  assert.ok(r.personRenewalNotice.renewalNotice.text.includes('안심케어 등록 및 실종 시 후보 검색'));
  assert.ok(r.personRenewalNotice.renewalNotice.text.includes('등록을 삭제하면 관련 식별 사진과 생성된 식별정보도 삭제'));
  // SAFECARE-PHOTO-EASY-UPLOAD-01: a new person registration has one gallery picker;
  // the ten tiles are examples without their own picker.
  assert.deepEqual(r.personRegisterFlow.retry, Array(10).fill(0), `${label}: no tile offers a button on a new registration`);
  assert.equal(r.personRegisterFlow.pickers, 0, `${label}: no per-tile picker on a new registration`);
  assert.equal(r.personRegisterFlow.bulkPick, '갤러리에서 여러 장 선택', label);

  // person SOS: expired photos blocked, only Core's fields
  assert.ok(r.personSos.blocked.includes('유효기간'), `${label}: expired photos must block a new SOS with a reason`);
  assert.deepEqual(r.personSos.fields, ['실종 날짜·시간', '마지막으로 본 장소', '당시 특징·기타 (선택)']);
  assert.equal(r.personSos.consent, true);

  // person found report: 1 → 10, local until saved, 5-photo submit
  for (const step of r.personFound.steps) {
    assert.equal(step.submitDisabled, step.n < 5, `${label}: person found ${step.n} photos submit state`);
    assert.equal(step.addDisabled, step.n >= 10, `${label}: person found ${step.n} photos add state`);
    assert.equal(step.writes, 0, `${label}: photos must stay in the browser until the reporter saves`);
  }
  assert.ok(r.personFound.steps[1].counter.includes('현재 1/5장 · 최종 제출하려면 사진 4장이 더 필요합니다.'));
  assert.equal(r.personFound.noMatchBeforeSubmit, false);
  assert.equal(r.personFoundSubmit.creates, 1);
  assert.equal(r.personFoundSubmit.photoPuts, 10);
  assert.equal(r.personFoundSubmit.submits, 1);
  assert.equal(r.personFoundSubmit.newState, 'QUEUED');
  assert.ok(!r.personFoundSubmit.newText.includes('확인 가능한 일치 대상 없음'), `${label}: just-submitted must not read as no match`);
  // SAFECARE-SIGHTING-RESULT-PRIVACY: an older Core's NO_RELIABLE_MATCH reads as a closed review, never as a result.
  assert.ok(r.personFoundSubmit.nrmText.includes('검토 종료') && r.personFoundSubmit.nrmText.includes('제보 검토가 종료되었습니다. 비교 결과는 제보자에게 공개되지 않습니다.'), `${label}: NO_RELIABLE_MATCH must read as 검토 종료`);
  assert.ok(r.personFoundSubmit.newText.includes('접수됨') && r.personFoundSubmit.analyzingText.includes('접수됨'), `${label}: QUEUED / ANALYZING must read as 접수됨`);
  for (const text of [r.personFoundSubmit.newText, r.personFoundSubmit.nrmText, r.personFoundSubmit.analyzingText]) {
    assert.ok(!text.includes('일치 대상') && !text.includes('비교 후보'), `${label}: a found report must not disclose a comparison result`);
  }

  // pet list and found report
  assert.equal(r.petList.menu, 0);
  assert.equal(r.petList.cta, true);
  assert.equal(r.petList.badge, '갱신 예정 · 20일 남음');
  assert.ok(r.petList.renewal.includes('2026.10.25'));
  assert.equal(r.petList.transition, true);
  assert.equal(r.petList.activeSos, false);
  for (const step of r.petFound.steps) {
    assert.equal(step.submitDisabled, step.n < 5, `${label}: pet found ${step.n} photos submit state`);
    assert.equal(step.addDisabled, step.n >= 10, `${label}: pet found ${step.n} photos add state`);
    assert.equal(step.writes, 0, `${label}: pet found photos must stay in the browser until saved`);
  }
  assert.ok(r.petFound.nrm.includes('확인 가능한 일치 대상 없음'));
  assert.equal(r.petFoundSubmit.creates, 1);
  assert.equal(r.petFoundSubmit.photoPuts, 10);
  assert.equal(r.petFoundSubmit.submits, 1);
  assert.ok(!r.petFoundSubmit.newText.includes('확인 가능한 일치 대상 없음'));

  // pet registration: 기본정보 first, then ten photos with the dog guide
  assert.equal(r.petRegister.label, '반려동물 등록 1단계 / 4단계 · 기본정보');
  assert.equal(r.petRegister.slotsAtStart, 0);
  // PET-REGISTER-BASIC-FIRST-01: the registration is its own screen like the person one
  assert.equal(r.petRegister.listHidden, true, `${label}: the pet list must step aside while registering`);
  assert.equal(r.petRegister.back, true, `${label}: registration must offer ← 목록으로`);
  assert.equal(r.petRegister.activeStep, 'active', `${label}: pet steps must use the shared SafeCare stepper`);
  assert.equal(r.petResume.listBack.listVisible, true, `${label}: ← 목록으로 must bring the list back`);
  assert.equal(r.petResume.listBack.buttonHidden, false);
  assert.equal(r.petResume.listBack.button, '등록 계속');
  assert.equal(r.petResume.label, '반려동물 등록 1단계 / 4단계 · 기본정보', `${label}: a resumed draft must open at 기본정보`);
  assert.equal(r.petResume.name, '보리', `${label}: the resumed 기본정보 keeps what was saved`);
  assert.equal(r.petResume.species, 'DOG');
  assert.equal(r.petResume.listHidden, true);
  assert.deepEqual(r.petRegister.ageModes, ['BIRTH_DATE', 'ESTIMATED', 'UNKNOWN']);
  assert.equal(r.petRegister.family, true, `${label}: 가족이 된 날 is stored by Core's draft and must be offered`);
  assert.equal(r.petRegisterPhotos.label, '반려동물 등록 2단계 / 4단계 · 사진');
  assert.equal(r.petRenewalNotice.renewalNotice?.title, '식별 사진 갱신 안내', `${label}: pet renewal notice must open before photos`);
  assert.equal(r.petRenewalNotice.renewalNotice.photosVisibleBeforeConfirm, false, `${label}: pet photos must wait for renewal notice confirmation`);
  assert.equal(r.petRenewalNotice.renewalNotice.guardianVisible, false, `${label}: pet registration must not ask for legal guardian confirmation`);
  assert.equal(r.petRenewalNotice.renewalNotice.confirmDisabledInitially, true, `${label}: pet registration must wait for privacy consent`);
  assert.deepEqual(r.petRenewalNotice.renewalNotice.missingPress, {text: '필수 동의가 빠졌어요: 사진 보관·이용 동의. 체크한 뒤 다시 눌러 주세요.', photos: false}, `${label}: a pet press without consent names it and opens nothing`);
  assert.equal(r.petRenewalNotice.renewalNotice.privacyLabel, '🔒 사진은 비공개로 안전하게 보관되며, 분실·발견 시 후보 비교를 위해 사용됩니다. (필수)');
  assert.equal(r.petRenewalNotice.renewalNotice.confirmEnabledAfterPrivacy, true, `${label}: pet privacy consent enables photo registration`);
  assert.ok(r.petRenewalNotice.renewalNotice.text.includes('나이와 관계없이 · 6개월(180일)마다'));
  assert.ok(r.petRenewalNotice.renewalNotice.text.includes('만료 30일·7일·1일 전'));
  assert.equal(r.petRegisterPhotos.slots, 10);
  assert.equal(r.petRegisterPhotos.guide, 'dog');
  // PET-PHOTO-GUIDE-DEDUPE-01: the tiles carry the example pictures; no second
  // illustration, title or direction map above them.
  assert.equal(r.petRegisterPhotos.artwork, '', `${label}: duplicate guide illustration must be gone`);
  assert.equal(r.petRegisterPhotos.guideMap, 0, `${label}: duplicate guide title/map must be gone`);
  assert.equal(r.petRegisterPhotos.firstTileArt, 'assets/family-guardian/approved-pet-dog-required-bichon-20261013.png');
  // SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): the pet rule is the person rule.
  assert.equal(r.petRegisterPhotos.counter, '얼굴 0/3 · 몸 0/2 · 지금 0장 (10장까지)');
  assert.equal(r.petRegisterPhotos.firstOpen, undefined, `${label}: no tile is locked any more`);
  assert.equal(r.petRegisterPhotos.tileInputs, 0, `${label}: no per-tile picker`);
  assert.equal(r.petRegisterPhotos.bulkPick, '사진 여러 장 선택', label);
  assert.equal(r.petRegisterPhotos.nextDisabled, true);
  console.log(`SAFECARE-WEB-UI-REDESIGN-01 ${label} PASS`);
}
if (SHOTS) console.log(`SAFECARE-WEB-UI-REDESIGN-01 screenshots: ${shots.length} in ${SHOTS}`);
console.log('SAFECARE-WEB-UI-REDESIGN-01 PASS');
