#!/usr/bin/env node
// SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round) — 반려동물 사진 등록 (owner decision
// 2026-10-10: "반려동물도 똑같아야 돼").
//
// The pet screens follow the person rule: the ten tiles are examples, photos go
// in through '사진 여러 장 선택' (one slot-free POST each, in the order picked),
// Core places each photo and refuses only wrong ones, and three face photos plus
// two whole-body photos complete the set — ten are recommended, never required.
// A refused photo keeps its next step and replaces only that photo; the screen's
// quick look still answers before the network for an obviously blurry or tiny
// frame (validate_pet_species_gate_web_01.mjs covers that, and
// validate_pet_photo_source_selector_01.mjs the Camera / Gallery / File sheet).
//
// This runs in real time (image decoding is part of the batch), at 360/390/412
// mobile and 1440 desktop, against an in-memory stand-in for Core.
//
//   CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_safecare_pet_photo_easy_upload_01.mjs
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

// ------------------------------------------------------------ A. rules
const pet = await import(`${pathToFileURL(path.join(ROOT, 'site-pet.js')).href}?contract=pet-easy-01`);
assert.deepEqual([...pet.PET_PHOTO_FACE_SLOT_CODES], ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT']);
assert.deepEqual([...pet.PET_PHOTO_BODY_SLOT_CODES], ['BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR']);
assert.equal(pet.PET_PHOTO_FACE_MINIMUM, 3);
assert.equal(pet.PET_PHOTO_BODY_MINIMUM, 2);
assert.equal(pet.petPhotoNextActionLabel('ADD_A_WHOLE_BODY_PHOTO'), '몸 전체 사진 고르기');
assert.equal(pet.petPhotoNextActionLabel('CHOOSE_ANOTHER_PHOTO'), '다른 사진 고르기');
assert.equal(pet.petPhotoNextActionLabel('RETAKE_ONE_ANIMAL'), '다시 찍기');
// Slot-free client contract: multipart POST, no slot in the path, local refusal first.
{
  const calls = [];
  const respond = (body, status = 201) => async (url, init) => { calls.push({url: String(url), init}); return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}); };
  const file = new File([Uint8Array.from([255, 216, 255, 224])], 'dog.jpg', {type: 'image/jpeg'});
  const added = await pet.addPetPhoto('session-token', 'PET_KR_AAAAAAAAAAAAAAAAAAAA', file, respond({photo: {slot_code: 'BODY_LEFT'}, category: 'BODY', manifest: {slot_count: 4, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}}));
  assert.match(calls[0].url, /\/v2\/pets\/PET_KR_AAAAAAAAAAAAAAAAAAAA\/photos$/);
  assert.equal(calls[0].init.method, 'POST');
  assert.ok(calls[0].init.body instanceof FormData, 'pet photos go as multipart FormData');
  assert.deepEqual([added.slotCode, added.category], ['BODY_LEFT', 'BODY']);
  const draftFile = new File([Uint8Array.from([137, 80, 78, 71])], 'cat.png', {type: 'image/png'});
  const saved = await pet.addPetRegistrationDraftPhoto('session-token', 'pdraft_zzzzzzzzzzzzzzzzzzzz', draftFile, respond({photo: {slot_code: 'FACE_FRONT', slot_index: 0, revision: 1, inspection_state: 'ACCEPTED', detected_species: 'CAT'}, category: 'FACE', draft: {draft_id: 'pdraft_zzzzzzzzzzzzzzzzzzzz', status: 'ACTIVE', current_step: 'PHOTOS', revision: 2, species: 'CAT', matching_consent_state: 'NOT_GRANTED', photos: []}}));
  assert.match(calls[1].url, /\/v2\/pet-registration-drafts\/pdraft_zzzzzzzzzzzzzzzzzzzz\/photos$/);
  assert.equal(saved.category, 'FACE');
  assert.equal(saved.photo.slotCode, 'FACE_FRONT');
  await assert.rejects(() => pet.addPetPhoto('t', 'p', new File([new Uint8Array(4)], 'x.gif', {type: 'image/gif'}), respond({})), error => error.code === 'PET_PHOTO_REJECTED_LOCALLY');
  assert.equal(calls.length, 2, 'a locally refused file never reaches Core');
}
for (const code of ['PET_PHOTO_MULTIPLE_ANIMALS', 'PET_PHOTO_KIND_FULL', 'PET_PHOTOS_FULL', 'PET_DRAFT_PHOTOS_INCOMPLETE', 'PET_IDENTITY_PHOTOS_INCOMPLETE']) {
  const line = read('site-pet.js').match(new RegExp(`${code}: '([^']+)'`))?.[1];
  assert.ok(line && !/[A-Za-z]{4,}/.test(line), `${code} has a Korean sentence`);
}
assert.ok(!/10장을 모두|식별 사진 10장/.test(read('site-pet.js') + read('site-pet-ui.js')), 'nothing says all ten pet photos are required');
console.log('SAFECARE-PET-PHOTO-EASY-UPLOAD-01 rules PASS');

// ------------------------------------------------------------ B. browser
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
  throw new Error('Chrome/Chromium is required for the pet photo render validation (set CHROME_BIN).');
}

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const FIXTURE = `.safecare-pet-photo-easy-${process.pid}.html`;
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-conversation.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<link rel="stylesheet" href="/site-pet.css" />
<link rel="stylesheet" href="/site-person-bulk.css" />
<link rel="stylesheet" href="/site-safecare.css" />
<style>html,body{margin:0;background:var(--lotbi-bg-primary,#fff)}#host{box-sizing:border-box;max-width:960px;margin:0 auto;padding:16px}*,*::before,*::after{transition:none!important;animation:none!important}</style>
<script>
  // Never open a real OS file dialog: record which input a click landed on.
  globalThis.__clicked = [];
  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function patchedClick() {
    if (this.type === 'file') { __clicked.push(this.dataset.petPhotoSourceInput || ''); return; }
    return nativeClick.call(this);
  };
  const PET = 'PET_KR_AAAAAAAAAAAAAAAAAAAA';
  const DRAFT = 'pdraft_zzzzzzzzzzzzzzzzzzzz';
  const FACE = ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT'];
  const BODY = ['BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR'];
  const CLOSEUP = ['NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'DISTINCTIVE'];
  // What Core makes of each photo, by its file name: a kind, or a refusal.
  const RULES = {
    face: {kind: 'FACE'}, body: {kind: 'BODY'}, nose: {kind: 'CLOSEUP'},
    cat: {code: 'PET_PHOTO_SPECIES_MISMATCH', next: 'CHOOSE_ANOTHER_PHOTO'},
    car: {code: 'PET_PHOTO_NOT_DOG_OR_CAT', next: 'RETAKE_WITH_THE_PET_IN_FRAME'},
    two: {code: 'PET_PHOTO_MULTIPLE_ANIMALS', next: 'RETAKE_ONE_ANIMAL'},
  };
  globalThis.__core = {draft: [], pet: ['FACE_FRONT', 'NOSE_FRONT', 'NOSE_LEFT'], posts: [], inflight: 0, maxInflight: 0, deletes: []};
  const C = globalThis.__core;
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const place = (taken, kind) => (kind === 'FACE' ? FACE : kind === 'BODY' ? BODY : CLOSEUP).find(code => !taken.includes(code));
  const decide = (init, taken) => {
    const name = String(init.body.get('file')?.name || '').replace(/[0-9]*\.[a-z]+$/, '');
    C.posts.push(name);
    const rule = RULES[name] || {code: 'PET_PHOTO_NOT_DOG_OR_CAT', next: 'RETAKE_WITH_THE_PET_IN_FRAME'};
    if (rule.code) return {refusal: json({detail: {code: rule.code, message: 'refused', retryable: true, next_action: rule.next}}, 422)};
    if (taken.length >= 10) return {refusal: json({detail: {code: 'PET_PHOTOS_FULL', message: 'full', retryable: false, next_action: 'REPLACE_FROM_THE_CARDS'}}, 409)};
    return {slot: place(taken, rule.kind), kind: rule.kind};
  };
  const draftView = () => ({draft_id: DRAFT, status: 'ACTIVE', current_step: 'PHOTOS', revision: 3, species: 'DOG', name: '초코', sex: 'MALE', breed_code: 'JINDO', breed: null, matching_consent_state: 'NOT_GRANTED',
    // Core records the species on every stored photo (placement.species or the draft's).
    photos: C.draft.map(slot_code => ({slot_code, slot_index: 0, revision: 1, inspection_state: 'ACCEPTED', detected_species: 'DOG'}))});
  const manifest = () => ({slot_count: C.pet.length, state: C.pet.length === 10 ? 'UPLOAD_COMPLETE' : 'UPLOAD_INCOMPLETE', manifest_version: 1});
  const handle = async (target, method, init) => {
    let m;
    if (/\/content$/.test(target)) return new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
    if (target.endsWith('/v2/pet-registration-drafts/' + DRAFT + '/photos') && method === 'POST') {
      const verdict = decide(init, C.draft);
      if (verdict.refusal) return verdict.refusal;
      C.draft = [...C.draft, verdict.slot];
      return json({photo: {slot_code: verdict.slot, slot_index: 0, revision: 1, inspection_state: 'ACCEPTED', detected_species: 'DOG'}, category: verdict.kind, idempotent_replay: false, draft: draftView()}, 201);
    }
    if ((m = target.match(new RegExp('/v2/pet-registration-drafts/' + DRAFT + '/photos/([A-Z_]+)$'))) && method === 'DELETE') {
      C.deletes.push(m[1]); C.draft = C.draft.filter(code => code !== m[1]); return json({});
    }
    if (target.endsWith('/v2/pets/' + PET + '/photos') && method === 'POST') {
      const verdict = decide(init, C.pet);
      if (verdict.refusal) return verdict.refusal;
      C.pet = [...C.pet, verdict.slot];
      return json({photo: {slot_code: verdict.slot}, category: verdict.kind, idempotent_replay: false, manifest: manifest()}, 201);
    }
    if (target.endsWith('/v2/pets/' + PET + '/photos')) return json({photos: C.pet.map(slot_code => ({slot_code})), manifest: manifest()});
    if (method === 'PUT') { C.posts.push('PUT'); return json({}, 405); }
    if (/\/v2\/pet-catalog$/.test(target)) return json({breeds: {DOG: [{code: 'JINDO', display_name: '진돗개', species: 'DOG'}], CAT: []}, colors: [{code: 'WHITE', display_name: '흰색'}], patterns: [{code: 'SOLID', display_name: '단색', species: null}]});
    if (/\/v2\/pet-registration-drafts\/active$/.test(target)) return json({draft: null});
    if (/\/v2\/pet-registration-drafts$/.test(target) && method === 'POST') return json({draft: {...draftView(), current_step: 'BASIC', revision: 1, photos: []}});
    if (target.endsWith('/v2/pet-registration-drafts/' + DRAFT) && method === 'PATCH') return json({draft: draftView()});
    if (/\/v2\/pets\/sos$/.test(target)) return json({cases: []});
    if (/\/v2\/pets\/found$/.test(target)) return json({cases: []});
    if (/\/v2\/pets$/.test(target)) return json({pets: [{pet_id: PET, name: '보리', species: 'DOG', sex: 'FEMALE', photo_completion_state: 'UPLOAD_INCOMPLETE', matching_consent_state: 'NOT_GRANTED'}]});
    return json({}, 404);
  };
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = init.method || 'GET';
    const write = method === 'POST' && /\/photos$/.test(target);
    if (write) { C.inflight += 1; C.maxInflight = Math.max(C.maxInflight, C.inflight); }
    try { await new Promise(resolve => setTimeout(resolve, 5)); return await handle(target, method, init); }
    finally { if (write) C.inflight -= 1; }
  };
</script>
</head><body><div id="host"></div>
<script type="module">
  import {mountPetFamilyManager} from '/site-pet-ui.js';
  const host = document.getElementById('host');
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 8000) => { for (let t = 0; t < ms && !check(); t += 25) await __wait(25); return check(); };
  globalThis.__mount = async () => { host.replaceChildren(); await mountPetFamilyManager({sessionToken: 'fixture-token', root: host}); };
  // Sharp, decodable photos named after what Core will make of them.
  globalThis.__photo = name => new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
    const context = canvas.getContext('2d');
    const image = context.createImageData(400, 400);
    for (let i = 0; i < image.data.length; i += 4) { image.data[i] = (Math.random() * 256) | 0; image.data[i + 1] = (Math.random() * 256) | 0; image.data[i + 2] = 120; image.data[i + 3] = 255; }
    context.putImageData(image, 0, 0);
    canvas.toBlob(blob => resolve(new File([blob], name + '.png', {type: 'image/png'})), 'image/png');
  });
  globalThis.__status = () => document.querySelector('[data-pet-bulk-status]')?.textContent || '';
  globalThis.__deliver = async (input, names) => {
    const transfer = new DataTransfer();
    for (const name of names) transfer.items.add(await __photo(name));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles: true}));
    await __wait(40);
    if (!(await __until(() => __status().startsWith('등록 성공'), 15000))) throw new Error('the pet batch did not settle');
    await __wait(150);
  };
  globalThis.__rows = () => [...document.querySelectorAll('[data-pet-bulk-item]')].map(row => ({
    state: row.dataset.petBulkItem, code: row.dataset.petErrorCode || '',
    title: row.querySelector('.person-bulk-item-title')?.textContent || '',
    message: row.querySelector('.person-bulk-item-message')?.textContent || '',
    next: row.querySelector('.pet-slot-retry-action')?.textContent || '',
  }));
  globalThis.__counter = () => ({
    text: document.querySelector('[data-safecare-photo-count]')?.textContent || '',
    complete: document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoComplete || '',
  });
  globalThis.__layout = () => {
    const panel = document.querySelector('[data-pet-bulk]');
    const box = panel.getBoundingClientRect();
    const outside = [...panel.querySelectorAll('button, li, p')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1);
    }).map(node => node.textContent.slice(0, 40));
    const small = [...panel.querySelectorAll('button')].filter(node => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 43.5).map(node => node.textContent);
    return {overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, outside, small};
  };
  globalThis.__toPhotoStep = async () => {
    await __mount();
    await __until(() => document.querySelector('.pet-add-button'));
    document.querySelector('.pet-add-button').click();
    await __until(() => document.querySelector('input[name="pet-species"][value="DOG"]'));
    document.querySelector('input[name="pet-species"][value="DOG"]').click();
    await __wait(100);
    const form = document.querySelector('[data-pet-register-form]');
    form.querySelector('input[type="text"]').value = '초코';
    form.querySelector('input[name="pet-sex"][value="MALE"]').click();
    const breed = form.querySelector('select');
    breed.value = 'JINDO'; breed.dispatchEvent(new Event('change', {bubbles: true}));
    form.requestSubmit();
    await __until(() => document.querySelector('[data-safecare-renewal-dialog="pet"]'));
    const dialog = document.querySelector('[data-safecare-renewal-dialog="pet"]');
    dialog.querySelector('[data-safecare-consent="privacy"]').click();
    dialog.querySelector('[data-safecare-renewal-confirm]').click();
    await __until(() => document.querySelector('[data-pet-draft-slot-grid]') && document.querySelector('[data-pet-bulk-input]'));
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

const FORBIDDEN = ['100%', '확정', '일치합니다', '찾았습니다', '찾았어요', '동일 개체'];
const TEN_REQUIRED = ['10장을 모두', '남은 사진', '/ 10', '/10', '사진 10장'];
const RECOMMEND = '다음 단계로 넘어갈 수 있어요. 사진을 더 올리면(최대 10장) 비교에 도움이 될 수 있어요.';
const SHOTS = process.env.SAFECARE_SCREENSHOT_DIR ? path.resolve(process.env.SAFECARE_SCREENSHOT_DIR) : '';
if (SHOTS) fs.mkdirSync(SHOTS, {recursive: true});
const VIEWPORTS = [['mobile-360', 360, 780], ['mobile-390', 390, 844], ['mobile-412', 412, 915], ['desktop-1440', 1440, 900]]
  .filter(([label]) => !process.env.SAFECARE_PET_VIEWPORTS || process.env.SAFECARE_PET_VIEWPORTS.split(',').includes(label));

const server = await serve();
const profileDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-pet-easy-'));
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
    const scenario = async (name, setup, body) => {
      await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${FIXTURE}`});
      let ready = false;
      for (let t = 0; t < 300 && !ready; t += 1) {
        ready = await cdp.evaluate('return globalThis.__ready === true;').catch(() => false);
        if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error(`${label} ${name}: the fixture page did not load`);
      const result = await cdp.evaluate(`Object.assign(__core, ${JSON.stringify(setup)}); ${body}`);
      const where = `${label} ${name}`;
      const layout = await cdp.evaluate('return __layout();');
      assert.ok(layout.overflow <= 1, `${where}: horizontal overflow ${layout.overflow}px`);
      assert.deepEqual(layout.outside, [], `${where}: everything stays inside the panel`);
      assert.deepEqual(layout.small, [], `${where}: buttons keep a 44px touch target`);
      // The pet surface's own notice quotes "100% 일치" to say LOTBI never shows it; the batch panel never says any of it.
      const text = await cdp.evaluate('return document.querySelector("[data-pet-bulk]")?.innerText || "";');
      for (const phrase of FORBIDDEN) assert.ok(!text.includes(phrase), `${where}: the batch panel must not say "${phrase}"`);
      if (SHOTS) {
        const metrics = await cdp.send('Page.getLayoutMetrics');
        const contentHeight = Math.min(Math.ceil(metrics.cssContentSize?.height || metrics.contentSize.height), 7000);
        const shot = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x: 0, y: 0, width, height: contentHeight, scale: 1}});
        fs.writeFileSync(path.join(SHOTS, `${label}-${name}.png`), Buffer.from(shot.data, 'base64'));
      }
      return {result, where};
    };

    // (a) Registration: five everyday photos (3 face + 2 whole body) open the next step.
    {
      const {result: r, where} = await scenario('a-register-five', {}, `
        await __toPhotoStep();
        const before = {counter: __counter(), next: document.querySelector('[data-pet-draft-next="REVIEW"]')?.disabled,
          tileControls: document.querySelectorAll('[data-pet-draft-slot] input, [data-pet-draft-slot] button').length,
          step: document.querySelector('[data-pet-draft-progress]')?.textContent || '', page: document.body.innerText};
        __clicked.length = 0;
        document.querySelector('[data-pet-bulk-pick]').click();
        await __wait(60);
        const sheet = Boolean(document.querySelector('.pet-photo-source-menu'));
        if (sheet) { document.querySelector('[data-pet-photo-source-option="gallery"]').click(); await __wait(60); }
        const clicked = [...__clicked];
        await __deliver(document.querySelector('[data-pet-bulk-input]'), ['face1', 'body1', 'face2', 'face3', 'body2']);
        return {before, sheet, clicked, rows: __rows(), counter: __counter(), posts: [...__core.posts], maxInflight: __core.maxInflight,
          note: document.querySelector('[data-pet-draft-photo-note]')?.textContent || '', status: __status(),
          next: document.querySelector('[data-pet-draft-next="REVIEW"]')?.disabled,
          filled: [...document.querySelectorAll('[data-pet-draft-slot][data-pet-slot-filled="true"]')].map(tile => tile.dataset.petDraftSlot).sort(),
          deleteButtons: document.querySelectorAll('[data-pet-draft-slot-delete]').length};
      `);
      assert.equal(r.before.step, '반려동물 등록 2단계 / 4단계 · 식별 사진', where);
      assert.deepEqual(r.before.counter, {text: '얼굴 0/3 · 몸 0/2 · 지금 0장 (10장까지)', complete: 'false'}, where);
      assert.equal(r.before.next, true, `${where}: nothing yet, no next step`);
      assert.equal(r.before.tileControls, 0, `${where}: the ten tiles are examples without a picker`);
      for (const phrase of TEN_REQUIRED) assert.ok(!r.before.page.includes(phrase), `${where}: nothing makes ten look required ("${phrase}")`);
      assert.equal(r.sheet, width < 768 ? true : false, `${where}: phones get LOTBI's Camera / Gallery / File sheet first`);
      assert.deepEqual(r.clicked, ['gallery'], `${where}: Gallery (Desktop: the file dialog) takes the photos`);
      assert.deepEqual(r.posts, ['face', 'body', 'face', 'face', 'body'], `${where}: one POST per photo, in the order picked`);
      assert.equal(r.maxInflight, 1, `${where}: one request at a time`);
      assert.deepEqual(r.rows.map(row => [row.state, row.message]), [
        ['STORED', '얼굴 사진으로 등록했어요'], ['STORED', '몸 전체 사진으로 등록했어요'], ['STORED', '얼굴 사진으로 등록했어요'],
        ['STORED', '얼굴 사진으로 등록했어요'], ['STORED', '몸 전체 사진으로 등록했어요'],
      ], where);
      assert.equal(r.status, '등록 성공 5장 · 실패 0장', where);
      assert.deepEqual(r.counter, {text: '얼굴 3/3 · 몸 2/2 · 지금 5장 (10장까지)', complete: 'true'}, where);
      assert.equal(r.note, RECOMMEND, `${where}: more is only recommended`);
      assert.equal(r.next, false, `${where}: five photos (3 face + 2 body) open the next step`);
      assert.deepEqual(r.filled, ['BODY_LEFT', 'BODY_RIGHT', 'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT'], `${where}: Core's placement shows in the cards`);
      assert.equal(r.deleteButtons, 5, `${where}: a stored photo can still be deleted from its card`);
    }

    // (b) Wrong photos: another species, not a dog or cat, two animals — each says why and offers its next step.
    {
      const {result: r, where} = await scenario('b-register-mixed', {}, `
        await __toPhotoStep();
        await __deliver(document.querySelector('[data-pet-bulk-input]'), ['face', 'cat', 'car', 'two']);
        const first = __rows();
        // Replace only the second photo through its next step.
        __clicked.length = 0;
        document.querySelectorAll('[data-pet-bulk-item]')[1].querySelector('.pet-slot-retry-action').click();
        await __wait(60);
        if (document.querySelector('.pet-photo-source-menu')) { document.querySelector('[data-pet-photo-source-option="gallery"]').click(); await __wait(60); }
        await __deliver(document.querySelector('[data-pet-bulk-replace-input="gallery"]'), ['body']);
        return {first, after: __rows(), status: __status(), counter: __counter(), posts: [...__core.posts], deletes: [...__core.deletes],
          note: document.querySelector('[data-pet-draft-photo-note]')?.textContent || ''};
      `);
      assert.deepEqual(r.first.map(row => [row.state, row.code]), [['STORED', ''], ['FAILED', 'PET_PHOTO_SPECIES_MISMATCH'], ['FAILED', 'PET_PHOTO_NOT_DOG_OR_CAT'], ['FAILED', 'PET_PHOTO_MULTIPLE_ANIMALS']], where);
      for (const row of r.first.slice(1)) {
        assert.ok(row.message && !/[A-Za-z]{4,}/.test(row.message), `${where}: ${row.code} reads in Korean: ${row.message}`);
        assert.ok(row.next, `${where}: ${row.code} offers a next step`);
      }
      assert.ok(r.first[2].message.includes('강아지') && r.first[2].message.includes('고양이'), `${where}: the species refusal names the two species`);
      assert.match(r.first[3].message, /한 마리/, `${where}: two animals: one animal per photo`);
      assert.deepEqual(r.first.map(row => row.next), ['', '다른 사진 고르기', '다시 찍기', '다시 찍기'], where);
      assert.deepEqual(r.after.map(row => row.state), ['STORED', 'STORED', 'FAILED', 'FAILED'], `${where}: only the replaced row changes`);
      assert.equal(r.status, '등록 성공 2장 · 실패 2장', where);
      assert.deepEqual(r.posts, ['face', 'cat', 'car', 'two', 'body'], where);
      assert.deepEqual(r.deletes, [], `${where}: a batch never deletes`);
      assert.deepEqual(r.counter, {text: '얼굴 1/3 · 몸 1/2 · 지금 2장 (10장까지)', complete: 'false'}, where);
      assert.equal(r.note, '얼굴 사진 2장과 몸 전체가 보이는 사진 1장이 더 있으면 다음 단계로 넘어갈 수 있어요.', where);
    }

    // (c) More than fits: ten in all, counting the photos already stored.
    {
      const {result: r, where} = await scenario('c-register-room', {draft: ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR', 'NOSE_FRONT', 'NOSE_LEFT']}, `
        await __toPhotoStep();
        await __deliver(document.querySelector('[data-pet-bulk-input]'), ['nose', 'nose', 'face', 'face']);
        return {rows: __rows(), posts: [...__core.posts], counter: __counter()};
      `);
      assert.deepEqual(r.posts, ['nose', 'nose'], `${where}: only the two that fit are sent`);
      assert.deepEqual(r.rows.map(row => row.state), ['NOTICE', 'STORED', 'STORED'], where);
      assert.equal(r.rows[0].message, '사진은 모두 합쳐 10장까지예요. 처음 고른 2장만 확인할게요.', where);
      assert.equal(r.counter.text, '얼굴 3/3 · 몸 2/2 · 지금 10장 (10장까지)', where);
    }

    // (d) 사진 갱신·관리: a registered pet adds photos the same way; the note names the missing-state goal.
    {
      const {result: r, where} = await scenario('d-manage-add', {}, `
        await __mount();
        await __until(() => document.querySelector('[data-pet-open]'));
        document.querySelector('[data-pet-open]').click();
        await __until(() => document.querySelector('[data-pet-slot-grid]') && document.querySelector('[data-pet-bulk-input]'));
        const before = {count: document.querySelector('.pet-photo-count')?.textContent || '', note: document.querySelector('.pet-photo-progress-note')?.textContent || '',
          tileInputs: document.querySelectorAll('[data-pet-slot-grid] input').length};
        await __deliver(document.querySelector('[data-pet-bulk-input]'), ['face', 'face', 'body', 'body']);
        await __until(() => (document.querySelector('.pet-photo-count')?.textContent || '').includes('지금 7장'));
        return {before, rows: __rows(), posts: [...__core.posts], count: document.querySelector('.pet-photo-count')?.textContent || '',
          note: document.querySelector('.pet-photo-progress-note')?.textContent || '', stored: [...__core.pet]};
      `);
      assert.equal(r.before.count, '얼굴 1/3 · 몸 0/2 · 지금 3장', where);
      assert.equal(r.before.note, '얼굴 사진 2장과 몸 전체가 보이는 사진 2장이 더 있으면 실종 상태로 전환할 수 있어요.', where);
      assert.equal(r.before.tileInputs, 0, `${where}: tiles have no picker`);
      assert.deepEqual(r.posts, ['face', 'face', 'body', 'body'], where);
      assert.deepEqual(r.rows.map(row => row.state), ['STORED', 'STORED', 'STORED', 'STORED'], where);
      assert.equal(r.count, '얼굴 3/3 · 몸 2/2 · 지금 7장', where);
      assert.equal(r.note, '실종 상태로 전환할 수 있어요. 사진을 더 올리면(최대 10장) 비교에 도움이 될 수 있어요.', where);
    }
    console.log(`  ${label}: pet registration batch (five-photo set), refusals with next steps, room, 사진 갱신·관리 PASS`);
  }
} finally {
  browser.kill();
  server.close();
}
console.log('SAFECARE-PET-PHOTO-EASY-UPLOAD-01 SITE PASS');
