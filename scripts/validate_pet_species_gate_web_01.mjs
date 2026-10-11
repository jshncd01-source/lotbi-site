// SITE-PET-SPECIES-GATE-01 — 강아지·고양이가 아니면 등록되지 않는다.
//
// Core takes the decision (app/pet_species_gate.py); this gate guards the half
// that lives in the browser. Two things are easy to break silently here and
// both are checked in a real headless browser rather than by reading source:
//
//  1. A refusal must arrive with a way forward. "등록할 수 없습니다" on its own
//     is the dead end this feature exists to replace, so the screen has to show
//     the next step as something clickable.
//     SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): photos go in through '사진 여러
//     장 선택' (one slot-free POST each); a refused photo's result row carries
//     that next step, and it replaces only that photo.
//  2. The screen's own quick look must stay slacker than Core's. It exists for
//     speed, not authority; if it ever refuses a photo Core would have taken,
//     the owner is blocked by the wrong half of the system.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const petClient = read('site-pet.js');
const petUi = read('site-pet-ui.js');
const petCss = read('site-pet.css');
const petGuides = read('site-pet-guides.js');

// --------------------------------- PET-NOSE-VISION-02: realistic nose capture

// The extreme-closeup instruction is gone, and nothing that replaced it may
// reintroduce "fill the screen" or a fixed physical distance.
assert.ok(!petGuides.includes('코주름'), 'the nose wrinkle close-up instruction must be gone');
assert.ok(!petGuides.includes('가득 차게'), 'no nose guide may ask the frame to be filled');
assert.ok(!/\d+\s*cm/.test(petGuides), 'no nose guide may demand a fixed centimetre distance');

const noseFrontHint = petGuides.match(/NOSE_FRONT: \{[\s\S]*?hint: '([^']+)'/)?.[1];
assert.ok(noseFrontHint, 'NOSE_FRONT hint missing');
assert.ok(noseFrontHint.includes('전체') && noseFrontHint.includes('콧구멍'), noseFrontHint);
assert.ok(noseFrontHint.includes('가까이 붙이지 않아도'), 'NOSE_FRONT must say closeness is not required');

for (const slot of ['NOSE_LEFT', 'NOSE_RIGHT']) {
  const hint = petGuides.match(new RegExp(`${slot}: \\{[\\s\\S]*?hint: '([^']+)'`))?.[1];
  assert.ok(hint, `${slot} hint missing`);
  assert.ok(hint.includes('코 전체가 보이는 거리'), `${slot} must anchor on seeing the whole nose, not a fixed distance: ${hint}`);
  assert.ok(!/[A-Za-z]{4,}/.test(hint), `${slot} hint must not leak English: ${hint}`);
}

// Local pre-upload rejection never reaches the network, so the copy must say
// the photo was not saved; the draft row (server-saved) copy must not.
assert.match(petClient, /사진이 흐려 저장하지 않았어요/, 'local blur rejection must say it was not saved');
assert.match(petClient, /사진이 너무 작아 저장하지 않았어요/, 'local too-small rejection must say it was not saved');
assert.match(
  petClient,
  /사진은 초안에 저장됐지만 확인을 통과하지 못했어요/,
  'a rejected draft photo row is still saved, and the copy must say so',
);
assert.match(
  petClient,
  /사진은 저장됐어요\. 확인이 끝나면 상태가 바뀝니다/,
  'a pending draft photo row is saved and awaiting a verdict, and the copy must say so',
);

// ------------------------------------------------------- Core's own contract

// These mirror ANCHOR_SLOT_CODES / CLOSEUP_SLOT_CODES in Core. If Core moves a
// slot between the two groups and the Site does not, the screen will send an
// owner to fetch a photo Core is not waiting for.
const CORE_ANCHOR_SLOTS = ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT', 'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR'];
const CORE_CLOSEUP_SLOTS = ['NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'DISTINCTIVE'];

// The two groupings are derived from PET_PHOTO_SLOT_CODES rather than retyped,
// so they are read back at runtime in the browser below rather than scraped
// out of the source here.
assert.match(petClient, /export const PET_PHOTO_ANCHOR_SLOT_CODES/, 'anchor grouping missing');
assert.match(petClient, /export const PET_PHOTO_CLOSEUP_SLOT_CODES/, 'close-up grouping missing');

// Every refusal Core can return needs a Korean sentence. An unmapped code
// falls back to "사진을 올리지 못했습니다", which tells the owner nothing.
for (const code of [
  'PET_PHOTO_NOT_DOG_OR_CAT',
  'PET_PHOTO_SPECIES_UNCERTAIN',
  'PET_PHOTO_TOO_BLURRY',
  'PET_PHOTO_TOO_SMALL',
  'PET_PHOTO_ANCHOR_REQUIRED',
  'PET_PHOTO_SPECIES_CHECK_UNAVAILABLE',
]) {
  const line = petClient.match(new RegExp(`${code}: '([^']+)'`))?.[1];
  assert.ok(line, `${code} has no Korean sentence`);
  assert.ok(!/[A-Za-z]{4,}/.test(line), `${code} sentence must not leak Core's English: ${line}`);
}

// 강아지·고양이만. The sentence for the outright refusal has to say which two.
const speciesLine = petClient.match(/PET_PHOTO_NOT_DOG_OR_CAT: '([^']+)'/)[1];
assert.ok(
  speciesLine.includes('강아지') && speciesLine.includes('고양이'),
  'the refusal must name the two species that are allowed',
);
// It must not ask. 대표님: 종 판별은 확인이 아니라 차단.
assert.ok(
  !/맞나요|맞습니까|확인해 주세요\s*\?/.test(speciesLine),
  'the species refusal must refuse, not ask the owner to confirm',
);

assert.match(petClient, /next_action/, 'Core’s next_action must be carried onto the error');
assert.match(petClient, /export function petPhotoNextActionLabel/, 'missing next-action label helper');
assert.match(petClient, /export async function inspectPetPhotoLocally/, 'missing local quick look');

// The local floor must stay under Core's, or the browser blocks photos Core
// would have accepted. Core's SHARPNESS_MIN is 100 and MIN_SHORT_EDGE is 256.
const localFloor = Number(petClient.match(/LOCAL_SHARPNESS_FLOOR = ([\d.]+)/)?.[1]);
assert.ok(Number.isFinite(localFloor), 'local sharpness floor not found');
assert.ok(localFloor < 100, `local floor ${localFloor} must stay under Core's 100`);
assert.equal(Number(petClient.match(/PET_PHOTO_MIN_EDGE = (\d+)/)?.[1]), 256, 'min edge must match Core');

assert.match(petUi, /inspectPetPhotoLocally/, 'the uploader must take the local quick look');
assert.match(petUi, /pet-slot-retry-action/, 'the refusal needs a clickable next step');
// SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): the refused row's button reads its
// label from Core's next_action (petPhotoNextActionLabel) and replaces that photo.
assert.match(petClient, /UPLOAD_FACE_OR_BODY_FIRST/, 'the anchor refusal must lead somewhere');
assert.match(petUi, /petPhotoNextActionLabel\(result\.nextAction\)/, 'the batch row labels its next step from Core');
assert.match(petCss, /\.pet-slot-retry-action \{/, 'retry action has no style');

// A browser that already holds the old modules must be made to fetch these.
// The three cache-bust tokens move together or a returning owner keeps running
// a build that has never heard of the species gate.
const token = petUi.match(/site-pet\.js\?v=([\w-]+)/)?.[1];
assert.ok(token, 'site-pet.js import carries no cache-bust token');
// The auth callback transplants the whole Home body, so it carries its own copy
// of the stylesheet link. Bumping Home and forgetting the callback is a CI
// failure on a gate that belongs to somebody else — check it here instead.
for (const [file, needle] of [
  ['site-conversation.js', `site-pet-ui.js?v=${token}`],
  ['index.html', `site-pet.css?v=${token}`],
  ['auth/callback/index.html', `site-pet.css?v=${token}`],
]) {
  assert.ok(read(file).includes(needle), `${file} is missing ${needle}`);
}

// ------------------------------------------------------------------ browser

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for the PET species gate web gate.');
}

// The page posts its answer back instead of being screen-scraped with
// --dump-dom. Headless Chrome's virtual clock does not wait for image
// decoding, and decoding is exactly what the quick look does, so a virtual
// time budget dumps an empty page every time. Real time and a real round trip
// are the only honest way to watch this run.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serve(onResult) {
  const server = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/__result') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        response.writeHead(204).end();
        onResult(body);
      });
      return;
    }
    const rel = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const PET_ID = 'PET_KR_AAAAAAAAAAAAAAAAAAAA';

function innerFixtureHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-pet.css" />
<style>html,body{margin:0}#host{padding:12px}#render-result{position:absolute;left:-99999px;visibility:hidden}</style>
<script>
  // Keep the browser's own fetch before Core is stood in for, so the answer can
  // be posted back on a path the stub never sees.
  globalThis.__report = globalThis.fetch.bind(globalThis);
  // Never let a real OS file dialog open under headless Chrome: record which
  // input a click landed on instead.
  globalThis.__clicked = [];
  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function patchedClick() {
    if (this.type === 'file') { globalThis.__clicked.push(this.dataset.petBulkReplaceInput ? 'replace:' + this.dataset.petBulkReplaceInput : this.dataset.petPhotoSourceInput || ''); return; }
    return nativeClick.call(this);
  };
  // Stand in for Core's slot-free POST, refusing the way the species gate
  // refuses: the answers come in the order the photos are sent.
  globalThis.__posts = [];
  const REFUSALS = [
    {code: 'PET_PHOTO_NOT_DOG_OR_CAT', message: 'Pet photo does not show a dog or a cat', retryable: true, next_action: 'RETAKE_WITH_THE_PET_IN_FRAME'},
    {code: 'PET_PHOTO_ANCHOR_REQUIRED', message: 'A whole-animal photo is required before a close-up', retryable: true, next_action: 'UPLOAD_FACE_OR_BODY_FIRST'},
    {code: 'PET_PHOTO_TOO_BLURRY', message: 'Pet photo is too blurry to judge', retryable: true, next_action: 'RETAKE_IN_FOCUS'},
  ];
  let filled = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    const method = (init && init.method) || 'GET';
    const json = (body, status) => new Response(JSON.stringify(body), {status: status || 200, headers: {'Content-Type': 'application/json'}});
    const manifest = () => ({slot_count: filled.length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1});
    if (method === 'POST' && /\\/v2\\/pets\\/[^/]+\\/photos$/.test(target)) {
      const refusal = REFUSALS[globalThis.__posts.length];
      globalThis.__posts.push(refusal ? refusal.code : 'STORED');
      if (refusal) return json({detail: refusal}, 422);
      filled = [...filled, 'FACE_FRONT'];
      return json({photo: {slot_code: 'FACE_FRONT'}, category: 'FACE', manifest: manifest(), idempotent_replay: false}, 201);
    }
    if (method === 'PUT') { globalThis.__posts.push('PUT'); return json({}, 405); }
    if (/\\/v2\\/pets\\/[^/]+\\/photos$/.test(target)) return json({photos: filled.map(slot_code => ({slot_code})), manifest: manifest()});
    if (/\\/v2\\/pets\\/sos$/.test(target)) return json({cases: []});
    if (/\\/v2\\/pets\\/found$/.test(target)) return json({cases: []});
    if (/\\/v2\\/pets$/.test(target)) return json({pets: [{pet_id: '${PET_ID}', name: '보리', species: 'DOG', sex: 'FEMALE', photo_completion_state: 'UPLOAD_INCOMPLETE', matching_consent_state: 'NOT_GRANTED'}]});
    return json({}, 404);
  };
</script>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
import {mountPetFamilyManager} from '/site-pet-ui.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// A frame of sharp noise: no pet in it, but sharp and large enough that the
// browser's quick look has no opinion and the request reaches Core.
function noiseFile(size, blurPx) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = (Math.random() * 256) | 0;
    image.data[i] = value;
    image.data[i + 1] = (Math.random() * 256) | 0;
    image.data[i + 2] = (Math.random() * 256) | 0;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  if (blurPx) {
    const blurred = document.createElement('canvas');
    blurred.width = size;
    blurred.height = size;
    const blurContext = blurred.getContext('2d');
    blurContext.filter = 'blur(' + blurPx + 'px)';
    blurContext.drawImage(canvas, 0, 0);
    return new Promise(resolve => blurred.toBlob(blob => resolve(new File([blob], 'x.jpg', {type: 'image/jpeg'})), 'image/jpeg', 0.92));
  }
  return new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], 'x.jpg', {type: 'image/jpeg'})), 'image/jpeg', 0.92));
}

// Hand files to an input the way the browser does after the owner picks them,
// then wait for the batch summary.
async function deliver(input, files) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change'));
  await wait(50);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = document.querySelector('[data-pet-bulk-status]')?.textContent || '';
    if (status.startsWith('등록 성공')) break;
    await wait(100);
  }
  await wait(150);
}
const rows = () => [...document.querySelectorAll('[data-pet-bulk-item]')].map(row => {
  const action = row.querySelector('.pet-slot-retry-action');
  return {
    state: row.dataset.petBulkItem,
    message: row.querySelector('.person-bulk-item-message')?.textContent.trim() || '',
    code: row.dataset.petErrorCode || '',
    retryShown: Boolean(action),
    retryLabel: action ? action.textContent.trim() : '',
    nextAction: action ? action.dataset.petSlotNextAction || '' : '',
  };
});

const result = {};
try {
  await mountPetFamilyManager({sessionToken: 'fixture-token', root: document.getElementById('host')});
  document.querySelector('[data-pet-open="${PET_ID}"]').click();
  await wait(500);
  result.tilePickers = document.querySelectorAll('[data-pet-slot-grid] input[type="file"]').length;
  // Three sharp frames in one batch: Core refuses each for its own reason.
  await deliver(document.querySelector('[data-pet-bulk-input]'), [await noiseFile(640, 0), await noiseFile(640, 0), await noiseFile(640, 0)]);
  [result.notADogOrCat, result.anchorFirst, result.serverBlur] = rows();
  result.postsAfterBatch = globalThis.__posts.slice();
  // The anchor refusal's button replaces only that photo: it opens the
  // picker for one photo (Desktop: the file dialog), and the new photo is sent.
  globalThis.__clicked.length = 0;
  document.querySelectorAll('[data-pet-bulk-item]')[1].querySelector('.pet-slot-retry-action').click();
  await wait(100);
  result.clickedAfterAnchorRetry = globalThis.__clicked.slice();
  await deliver(document.querySelector('[data-pet-bulk-replace-input="gallery"]'), [await noiseFile(640, 0)]);
  result.afterReplace = rows();
  result.statusAfterReplace = document.querySelector('[data-pet-bulk-status]')?.textContent || '';
  // The quick look: a blurred frame and a tiny frame must fail on the screen,
  // with no request leaving the browser at all.
  const before = globalThis.__posts.length;
  await deliver(document.querySelector('[data-pet-bulk-input]'), [await noiseFile(640, 9), await noiseFile(200, 0)]);
  [result.localBlur, result.localTiny] = rows();
  result.requestsDuringLocalChecks = globalThis.__posts.length - before;
  result.posts = globalThis.__posts.slice();

  const client = await import('/site-pet.js');
  result.anchorSlots = [...client.PET_PHOTO_ANCHOR_SLOT_CODES];
  result.closeupSlots = [...client.PET_PHOTO_CLOSEUP_SLOT_CODES];
} catch (error) {
  result.error = String(error && error.stack || error);
}
document.getElementById('render-result').textContent = JSON.stringify(result);
await globalThis.__report('/__result', {method: 'POST', body: JSON.stringify(result)});
</script></body></html>`;
}

async function run() {
  const innerName = `.pet-species-gate-${process.pid}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerFixtureHtml(), 'utf8');
  let settle;
  const answered = new Promise(resolve => { settle = resolve; });
  const server = await serve(body => settle(body));
  const {port} = server.address();
  const profile = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'lotbi-pet-species-'));
  const browser = spawn(browserPath(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1280,1000', `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/${innerName}`,
  ], {stdio: 'ignore'});
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('species gate fixture never reported')), 90000).unref?.();
  });
  try {
    const body = await Promise.race([answered, timeout]);
    assert.ok(body && body.trim(), 'species gate fixture produced no result');
    return JSON.parse(body);
  } finally {
    browser.kill();
    server.close();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    // The browser is still flushing its profile as it dies; a failed cleanup of
    // a temp directory must not fail the gate.
    try {
      fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    } catch {}
  }
}

const seen = await run();
assert.ok(!seen.error, `species gate fixture failed: ${seen.error}`);

// Core refused because there is no dog or cat in the frame, and the owner is
// told exactly that, in Korean, with a way to try again.
assert.equal(seen.notADogOrCat.code, 'PET_PHOTO_NOT_DOG_OR_CAT');
assert.ok(seen.notADogOrCat.message.includes('강아지'), seen.notADogOrCat.message);
assert.ok(seen.notADogOrCat.message.includes('고양이'), seen.notADogOrCat.message);
assert.equal(seen.notADogOrCat.retryShown, true, 'the refusal showed no next step');
assert.equal(seen.notADogOrCat.retryLabel, '다시 찍기');
assert.equal(seen.tilePickers, 0, 'the ten tiles are examples without a picker; the batch is the way in');
// A close-up is held until the pet has a whole-animal photo, and the button
// says so.
assert.equal(seen.anchorFirst.code, 'PET_PHOTO_ANCHOR_REQUIRED');
assert.equal(seen.anchorFirst.nextAction, 'UPLOAD_FACE_OR_BODY_FIRST');
assert.equal(seen.anchorFirst.retryLabel, '얼굴 사진부터 올리기');
assert.deepEqual(seen.clickedAfterAnchorRetry, ['replace:gallery'], 'the next step opens the picker for that one photo (Desktop: the file dialog)');
assert.deepEqual(seen.afterReplace.map(row => row.state), ['FAILED', 'STORED', 'FAILED'], 'the replacement takes the refused row\'s place; the other rows stay');
assert.equal(seen.afterReplace[1].retryShown, false, 'a stored photo offers no retry');
assert.equal(seen.statusAfterReplace, '등록 성공 1장 · 실패 2장');
assert.deepEqual(seen.postsAfterBatch, ['PET_PHOTO_NOT_DOG_OR_CAT', 'PET_PHOTO_ANCHOR_REQUIRED', 'PET_PHOTO_TOO_BLURRY'], 'one POST per photo, in order');
assert.equal(seen.serverBlur.code, 'PET_PHOTO_TOO_BLURRY');
assert.equal(seen.serverBlur.retryShown, true);

// The quick look answers before the network does, and says the same thing Core
// would have said.
assert.equal(seen.localBlur.code, 'PET_PHOTO_TOO_BLURRY', 'a blurred frame must fail on the screen');
assert.equal(seen.localTiny.code, 'PET_PHOTO_TOO_SMALL', 'a tiny frame must fail on the screen');
assert.equal(seen.localBlur.retryShown, true);
assert.equal(seen.localTiny.retryShown, true);
assert.ok(seen.localBlur.message.includes('저장하지 않았'), seen.localBlur.message);
assert.ok(seen.localTiny.message.includes('저장하지 않았'), seen.localTiny.message);
assert.equal(
  seen.requestsDuringLocalChecks,
  0,
  'the quick look must answer without a round trip',
);

// Sharp, full-size frames did reach Core: the quick look is a hint, not a gate.
assert.deepEqual(seen.posts, ['PET_PHOTO_NOT_DOG_OR_CAT', 'PET_PHOTO_ANCHOR_REQUIRED', 'PET_PHOTO_TOO_BLURRY', 'STORED']);

// Read back as the browser actually computed them, not as the source reads.
assert.deepEqual(seen.anchorSlots, CORE_ANCHOR_SLOTS, 'anchor slots must match Core');
assert.deepEqual(seen.closeupSlots, CORE_CLOSEUP_SLOTS, 'close-up slots must match Core');

console.log('SITE-PET-SPECIES-GATE-01 OK');
