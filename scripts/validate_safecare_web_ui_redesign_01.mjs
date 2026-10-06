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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
assert.equal(common.foundPhotoProgress(0).message, '발견한 대상의 사진 1장부터 작성을 시작할 수 있습니다.');
assert.equal(common.NO_RELIABLE_MATCH_LABEL, '확인 가능한 일치 대상 없음');
assert.equal(common.foundReviewStateCopy('NO_RELIABLE_MATCH').label, '확인 가능한 일치 대상 없음');
for (const state of ['DRAFT', 'QUEUED', 'ANALYZING', 'ADMIN_REVIEW', 'INSUFFICIENT_QUALITY', 'CLOSED', null, undefined, 'SOMETHING_NEW']) {
  assert.ok(!JSON.stringify(common.foundReviewStateCopy(state)).includes('일치 대상 없음'),
    `review state ${state} must never read as no reliable match`);
  assert.equal(common.isNoReliableMatchState(state), false);
}
assert.equal(common.isNoReliableMatchState('NO_RELIABLE_MATCH'), true);
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

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
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
<link rel="stylesheet" href="/site-safecare.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<style>html,body{margin:0;background:var(--lotbi-bg-primary,#fff)}#host{box-sizing:border-box;max-width:960px;margin:0 auto;padding:16px}</style>
<script>
  globalThis.__calls = [];
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  const photosFor = (count) => Array.from({length: count}, (_, i) => ({slot_index: i + 1, slot_code: 'S' + (i + 1), revision: 1, width: 640, height: 640, updated_at: '2026-09-01T00:00:00Z'}));
  const personRow = (n, name, relationship, year, month, count, state, extra = {}) => ({
    person_id: P(n), display_name: name, nickname: '', relationship, birth_year: year, birthday_month: month, revision: 1,
    has_photo: count === 10, identity_photo_count: count, identity_photo_state: state,
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
    photos: {1: 10, 2: 3, 3: 10, 4: 10},
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
  const sightingView = row => ({...row, minimum_photo_count: 5, maximum_photo_count: 10, can_submit: row.review_state === 'DRAFT' && row.photo_count >= 5, message: '', automatic_identity_decision: false, contact_details_exposed: false});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
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
      state.people.push(row); state.photos[5] = 0;
      return json({person: row}, 201);
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/))) return json({photos: photosFor(state.photos[m[1].slice(-1)] || 0)});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos\/(\d+)$/)) && method === 'PUT') {
      const key = m[1].slice(-1); state.photos[key] = Math.max(state.photos[key] || 0, Number(m[2]));
      const row = state.people.find(item => item.person_id === m[1]);
      row.identity_photo_count = state.photos[key]; row.has_photo = row.identity_photo_count === 10;
      return json({photo: {slot_index: Number(m[2]), slot_code: 'S' + m[2], revision: 2, width: 640, height: 640}});
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
      return json({draft: {draft_id: 'pdraft_ssssssssssssssssssss', status: 'ACTIVE', current_step: d.current_step, revision: 2, species: d.species || null, name: d.name || null, sex: d.sex || null, breed_code: d.breed_code || null, breed: d.breed || null, matching_consent_state: 'NOT_GRANTED', photos: []}});
    }
    return json({}, 404);
  };
</script>
</head><body><div id="host"></div>
<script type="module">
  import {mountPersonCareManager} from '/site-person-ui.js';
  import {mountPetFamilyManager} from '/site-pet-ui.js';
  import {mountConsumerSection} from '/site-consumer-sections.js';
  const host = document.getElementById('host');
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 4000) => { for (let t = 0; t < ms && !check(); t += 50) await __wait(50); return check(); };
  globalThis.__mountPerson = async surface => { host.replaceChildren(); globalThis.__screen = await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface: surface || 'home'}); };
  globalThis.__mountPet = async surface => { host.replaceChildren(); globalThis.__screen = await mountPetFamilyManager({sessionToken: 'fixture-token', root: host, initialSurface: surface || 'pets'}); };
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
  fs.writeFileSync(path.join(ROOT, fixtureName), FIXTURE_HTML, 'utf8');
  const server = await serve();
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
    for (const [label, width, height] of [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
      await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${fixtureName}`});
      for (let t = 0; t < 100; t += 1) {
        if (await cdp.evaluate('return globalThis.__fixtureReady === true;').catch(() => false)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
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
          accept: [...new Set(tiles().map(tile => tile.querySelector('input[type=file]').accept))],
          buttons: [...new Set(tiles().map(tile => tile.querySelector('.safecare-slot-choose').textContent))],
          nextDisabled: document.querySelector('[data-person-photos-next]').disabled,
        };
        await __put(tiles()[3].querySelector('input[type=file]'), 'slot4.png');
        await __until(() => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === '4');
        return {before, after: document.querySelector('[data-safecare-photo-count]').textContent};
      `);
      await shoot('person-02-photos');

      // ------------------------------------------------ person: register
      r.personRegister = await cdp.evaluate(`
        await __mountPerson(); await __until(() => document.querySelector('[data-person-list]'));
        [...document.querySelectorAll('.person-section-heading button')].find(b => b.textContent === '사람 등록').click();
        await __until(() => document.querySelector('[data-person-basic-form]'));
        const form = document.querySelector('[data-person-basic-form]');
        const trigger = form.querySelector('[data-person-birth-trigger]');
        trigger.click();
        await __until(() => document.querySelector('[data-person-birth-picker]'));
        await __wait(260);
        const picker = document.querySelector('[data-person-birth-picker]');
        const yearWheel = picker.querySelector('[aria-label="연도 선택"]');
        const year2018 = picker.querySelector('[data-person-birth-year-option="2018"]');
        yearWheel.scrollTop = year2018.offsetTop - (yearWheel.clientHeight - year2018.offsetHeight) / 2;
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
          dayControls: picker.querySelectorAll('[data-person-birth-day], [aria-label*="일 선택"]').length,
          typedBirthControls: form.querySelectorAll('input[type=number], [data-person-birth-year][contenteditable], [data-person-birth-month][contenteditable]').length,
          numberInputs: form.querySelectorAll('input[type=number]').length,
          inlineRenewalNotices: [...form.querySelectorAll('.person-consent')].filter(node => node.textContent.includes('갱신 주기')).length,
        };
      `);
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
          confirmDisabledInitially: renewalDialog.querySelector('[data-safecare-renewal-confirm]')?.disabled,
        };
        renewalDialog.querySelector('[data-safecare-notice-toggle="renewal"]').click();
        renewalNotice.openAfterRenewal = [...renewalDialog.querySelectorAll('[data-safecare-notice-detail]')]
          .filter(node => !node.hidden).map(node => node.dataset.safecareNoticeDetail);
        renewalDialog.querySelector('[data-safecare-notice-toggle="usage"]').click();
        renewalNotice.openAfterUsage = [...renewalDialog.querySelectorAll('[data-safecare-notice-detail]')]
          .filter(node => !node.hidden).map(node => node.dataset.safecareNoticeDetail);
        const usageConsent = renewalDialog.querySelector('[data-safecare-consent="usage"]');
        renewalNotice.usageLabel = usageConsent.closest('label').textContent.trim();
        usageConsent.click();
        renewalNotice.disabledAfterUsage = renewalDialog.querySelector('[data-safecare-renewal-confirm]').disabled;
        const privacyConsent = renewalDialog.querySelector('[data-safecare-consent="privacy"]');
        renewalNotice.privacyLabel = privacyConsent.closest('label').textContent.trim();
        privacyConsent.click();
        renewalNotice.disabledAfterPrivacy = renewalDialog.querySelector('[data-safecare-renewal-confirm]').disabled;
        renewalDialog.querySelector('[data-safecare-notice-toggle="guardian"]').click();
        const guardianConsent = renewalDialog.querySelector('[data-safecare-consent="guardian"]');
        renewalNotice.guardianLabel = guardianConsent.closest('label').textContent.trim();
        guardianConsent.click();
        renewalNotice.confirmEnabledAfterRequiredConsents = !renewalDialog.querySelector('[data-safecare-renewal-confirm]').disabled;
        renewalNotice.confirmText = renewalDialog.querySelector('[data-safecare-renewal-confirm]').textContent;
        await __wait(260);
        return {selectedBirth, renewalNotice};
      `);
      await shoot('person-04-renewal-notice');
      r.personRegisterFlow = await cdp.evaluate(`
        document.querySelector('[data-safecare-renewal-confirm]').click();
        await __until(() => document.querySelector('[data-person-slot-grid]'));
        const create = __calls.find(call => call === 'POST /v2/person-profiles');
        const locked = [...document.querySelectorAll('[data-person-slot]')].map(tile => tile.dataset.safecareSlotLocked);
        return {create: Boolean(create), active: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent, locked};
      `);
      await shoot('person-05-register-step2');

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
        const label = document.querySelector('.pet-draft-progress-label').textContent;
        const slotsAtStart = document.querySelectorAll('[data-pet-draft-slot]').length;
        return {label, slotsAtStart, ageModes: [...document.querySelectorAll('input[name=pet-age-mode]')].map(input => input.value), family: [...document.querySelectorAll('[data-pet-register-form] .site-field')].some(field => field.firstChild?.textContent === '가족이 된 날 (선택)')};
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
          confirmDisabledInitially: renewalDialog.querySelector('[data-safecare-renewal-confirm]')?.disabled,
        };
        const privacyConsent = renewalDialog.querySelector('[data-safecare-consent="privacy"]');
        renewalNotice.privacyLabel = privacyConsent.closest('label').textContent.trim();
        privacyConsent.click();
        renewalNotice.confirmEnabledAfterPrivacy = !renewalDialog.querySelector('[data-safecare-renewal-confirm]').disabled;
        await __wait(260);
        return {renewalNotice};
      `);
      await shoot('pet-05-renewal-notice');
      r.petRegisterPhotos = await cdp.evaluate(`
        document.querySelector('[data-safecare-renewal-confirm]').click();
        await __until(() => document.querySelector('[data-pet-draft-slot]'));
        return {
          label: document.querySelector('.pet-draft-progress-label').textContent,
          slots: document.querySelectorAll('[data-pet-draft-slot]').length,
          guide: document.querySelector('[data-safecare-guide]')?.dataset.safecareGuide || '',
          artwork: document.querySelector('.safecare-guide-art')?.getAttribute('src') || '',
          counter: document.querySelector('[data-safecare-photo-count]')?.textContent || '',
          firstOpen: document.querySelector('[data-pet-draft-slot="FACE_FRONT"]')?.dataset.petDraftSlotLocked,
          nextDisabled: document.querySelector('[data-pet-draft-next="REVIEW"]')?.disabled,
        };
      `);
      await shoot('pet-06-register-step2-photos');
    }
    socket.close();
    return results;
  } finally {
    browser.kill();
    server.close();
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
    assert.equal(cards[name].transition, true, `${label}: ${name} must offer 실종 상태로 전환`);
  }
  assert.equal(cards['김하늘'].badge, '정상');
  assert.equal(cards['이도윤'].badge, '사진 갱신 필요');
  assert.equal(cards['최민준'].badge, '갱신 예정 · 7일 남음');
  assert.ok(cards['최민준'].text.includes('2026.10.12'), `${label}: Core's next renewal date must show`);
  assert.equal(cards['박영자'].photoAction, '사진 등록 이어하기');
  assert.equal(cards['김하늘'].photoAction, '사진 갱신·관리');

  // person photos: exactly ten labelled slots, progress, card-local artwork, web wording
  assert.equal(r.personPhotos.before.count, 10, `${label}: exactly ten identity slots`);
  assert.deepEqual(r.personPhotos.before.labels, ['정면 얼굴', '왼쪽 45도', '오른쪽 45도', '왼쪽 옆면', '오른쪽 옆면', '정면 상반신', '정면 전신', '추가 정면', '추가 왼쪽', '추가 오른쪽']);
  assert.equal(r.personPhotos.before.counter, '등록 완료 3 / 10남은 사진 7장');
  assert.equal(r.personPhotos.before.guideBoxPresent, false, `${label}: the duplicated explanation box must not sit above the photo cards`);
  assert.equal(r.personPhotos.before.emptyArtworkCount, 7, `${label}: every empty photo card must show its own large shooting example`);
  assert.deepEqual(r.personPhotos.before.accept, ['image/jpeg,image/png,image/webp']);
  assert.ok(r.personPhotos.before.buttons.every(text => ['사진 선택', '다른 사진 선택'].includes(text)), `${label}: web wording must be 사진 선택`);
  assert.equal(r.personPhotos.before.nextDisabled, true, `${label}: 3/10 must not move on`);
  assert.equal(r.personPhotos.after, '등록 완료 4 / 10남은 사진 6장');

  // person registration: four steps, one year/month wheel and no day field
  assert.deepEqual(r.personRegister.steps, ['기본정보', '식별 사진 10장', '최종 확인', '등록 완료']);
  assert.equal(r.personRegister.active, '기본정보');
  assert.equal(r.personRegister.triggerTag, 'BUTTON');
  assert.equal(r.personRegister.triggerText, '출생 연월 선택');
  assert.deepEqual(r.personRegister.wheelLabels, ['연도', '월']);
  assert.deepEqual(r.personRegister.monthValues, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.equal(r.personRegister.scrolledYear, '2018', `${label}: scrolling the wheel must change its selected year`);
  assert.equal(r.personRegister.dayControls, 0, `${label}: birth day must not be collected`);
  assert.equal(r.personRegister.typedBirthControls, 0, `${label}: birth year/month must not be typed`);
  assert.equal(r.personRegister.numberInputs, 0);
  assert.equal(r.personRegister.inlineRenewalNotices, 0, `${label}: renewal policy belongs in the confirmation dialog, not weak inline helper copy`);
  assert.equal(r.personRenewalNotice.selectedBirth, '2018년 8월');
  assert.equal(r.personRegisterFlow.create, true);
  assert.equal(r.personRegisterFlow.active, '식별 사진 10장');
  assert.equal(r.personRenewalNotice.renewalNotice?.title, '식별 사진 등록 안내', `${label}: person registration notice must open before photos`);
  assert.equal(r.personRenewalNotice.renewalNotice.createdBeforeConfirm, false, `${label}: person profile must not be created before renewal notice confirmation`);
  assert.equal(r.personRenewalNotice.renewalNotice.activeBeforeConfirm, '기본정보');
  assert.equal(r.personRenewalNotice.renewalNotice.sectionCount, 3, `${label}: under-14 child must see renewal, usage, and guardian sections`);
  assert.equal(r.personRenewalNotice.renewalNotice.guardianVisible, true, `${label}: under-14 child must require guardian confirmation`);
  assert.equal(r.personRenewalNotice.renewalNotice.confirmDisabledInitially, true, `${label}: registration must wait for required consent`);
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
  assert.deepEqual(r.personRegisterFlow.locked, ['false', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true'],
    `${label}: registration starts from the front face`);

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
  assert.ok(r.personFoundSubmit.nrmText.includes('확인 가능한 일치 대상 없음'), `${label}: NO_RELIABLE_MATCH must read 확인 가능한 일치 대상 없음`);
  assert.ok(!r.personFoundSubmit.analyzingText.includes('확인 가능한 일치 대상 없음'), `${label}: ANALYZING must not read as no match`);

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
  assert.deepEqual(r.petRegister.ageModes, ['BIRTH_DATE', 'ESTIMATED', 'UNKNOWN']);
  assert.equal(r.petRegister.family, true, `${label}: 가족이 된 날 is stored by Core's draft and must be offered`);
  assert.equal(r.petRegisterPhotos.label, '반려동물 등록 2단계 / 4단계 · 사진 10장');
  assert.equal(r.petRenewalNotice.renewalNotice?.title, '식별 사진 갱신 안내', `${label}: pet renewal notice must open before photos`);
  assert.equal(r.petRenewalNotice.renewalNotice.photosVisibleBeforeConfirm, false, `${label}: pet photos must wait for renewal notice confirmation`);
  assert.equal(r.petRenewalNotice.renewalNotice.guardianVisible, false, `${label}: pet registration must not ask for legal guardian confirmation`);
  assert.equal(r.petRenewalNotice.renewalNotice.confirmDisabledInitially, true, `${label}: pet registration must wait for privacy consent`);
  assert.equal(r.petRenewalNotice.renewalNotice.privacyLabel, '🔒 사진은 비공개로 안전하게 보관되며, 분실·발견 시 후보 비교를 위해 사용됩니다. (필수)');
  assert.equal(r.petRenewalNotice.renewalNotice.confirmEnabledAfterPrivacy, true, `${label}: pet privacy consent enables photo registration`);
  assert.ok(r.petRenewalNotice.renewalNotice.text.includes('나이와 관계없이 · 6개월(180일)마다'));
  assert.ok(r.petRenewalNotice.renewalNotice.text.includes('만료 30일·7일·1일 전'));
  assert.equal(r.petRegisterPhotos.slots, 10);
  assert.equal(r.petRegisterPhotos.guide, 'dog');
  assert.equal(r.petRegisterPhotos.artwork, 'assets/safecare/dog-capture-guide-v1.png');
  assert.ok(r.petRegisterPhotos.counter.startsWith('등록 완료 0 / 10 · 남은 사진 10장'));
  assert.equal(r.petRegisterPhotos.firstOpen, 'false');
  assert.equal(r.petRegisterPhotos.nextDisabled, true);
  console.log(`SAFECARE-WEB-UI-REDESIGN-01 ${label} PASS`);
}
if (SHOTS) console.log(`SAFECARE-WEB-UI-REDESIGN-01 screenshots: ${shots.length} in ${SHOTS}`);
console.log('SAFECARE-WEB-UI-REDESIGN-01 PASS');
