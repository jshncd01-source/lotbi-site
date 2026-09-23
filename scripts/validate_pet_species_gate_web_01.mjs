// SITE-PET-SPECIES-GATE-01 — 강아지·고양이가 아니면 등록되지 않는다.
//
// Core takes the decision (app/pet_species_gate.py); this gate guards the half
// that lives in the browser. Two things are easy to break silently here and
// both are checked in a real headless browser rather than by reading source:
//
//  1. A refusal must arrive with a way forward. "등록할 수 없습니다" on its own
//     is the dead end this feature exists to replace, so the screen has to show
//     the next step as something clickable.
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
assert.match(petUi, /UPLOAD_FACE_OR_BODY_FIRST/, 'the anchor refusal must lead somewhere');
assert.match(petCss, /\.pet-slot-retry-action \{/, 'retry action has no style');

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
  // Stand in for Core, refusing the way the species gate refuses.
  globalThis.__puts = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    const method = (init && init.method) || 'GET';
    const json = (body, status) => new Response(JSON.stringify(body), {status: status || 200, headers: {'Content-Type': 'application/json'}});
    if (method === 'PUT' && /\\/photos\\/FACE_FRONT$/.test(target)) {
      globalThis.__puts.push('FACE_FRONT');
      return json({detail: {code: 'PET_PHOTO_NOT_DOG_OR_CAT', message: 'Pet photo does not show a dog or a cat', retryable: true, next_action: 'RETAKE_WITH_THE_PET_IN_FRAME'}}, 422);
    }
    if (method === 'PUT' && /\\/photos\\/NOSE_FRONT$/.test(target)) {
      globalThis.__puts.push('NOSE_FRONT');
      return json({detail: {code: 'PET_PHOTO_ANCHOR_REQUIRED', message: 'A whole-animal photo is required before a close-up', retryable: true, next_action: 'UPLOAD_FACE_OR_BODY_FIRST'}}, 422);
    }
    if (method === 'PUT' && /\\/photos\\/BODY_LEFT$/.test(target)) {
      globalThis.__puts.push('BODY_LEFT');
      return json({detail: {code: 'PET_PHOTO_TOO_BLURRY', message: 'Pet photo is too blurry to judge', retryable: true, next_action: 'RETAKE_IN_FOCUS'}}, 422);
    }
    if (/\\/v2\\/pets\\/[^/]+\\/photos$/.test(target)) return json({photos: [], manifest: {slot_count: 0, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}});
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

async function putIntoSlot(tile, file) {
  const input = tile.querySelector('input[type="file"]');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change'));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const error = tile.querySelector('.pet-slot-error');
    if (error && !error.hidden && error.textContent.trim()) break;
    await wait(100);
  }
  const error = tile.querySelector('.pet-slot-error');
  const retry = tile.querySelector('.pet-slot-retry');
  const action = tile.querySelector('.pet-slot-retry-action');
  return {
    message: error && !error.hidden ? error.textContent.trim() : '',
    code: error ? error.dataset.petErrorCode || '' : '',
    retryShown: Boolean(retry) && !retry.hidden,
    retryLabel: action ? action.textContent.trim() : '',
    nextAction: action ? action.dataset.petSlotNextAction || '' : '',
  };
}

const result = {};
try {
  await mountPetFamilyManager({sessionToken: 'fixture-token', root: document.getElementById('host')});
  document.querySelector('[data-pet-open="${PET_ID}"]').click();
  await wait(500);
  const grid = document.querySelector('[data-pet-slot-grid]');
  const tileFor = code => grid.querySelector('[data-pet-slot="' + code + '"]');

  result.notADogOrCat = await putIntoSlot(tileFor('FACE_FRONT'), await noiseFile(640, 0));
  result.anchorFirst = await putIntoSlot(tileFor('NOSE_FRONT'), await noiseFile(640, 0));
  result.serverBlur = await putIntoSlot(tileFor('BODY_LEFT'), await noiseFile(640, 0));

  // The anchor refusal's button must take the owner to a whole-animal slot,
  // not back to the same picker that just failed.
  const nose = tileFor('NOSE_FRONT');
  nose.querySelector('.pet-slot-retry-action').click();
  await wait(300);
  result.focusedAfterAnchorRetry = document.activeElement?.closest('[data-pet-slot]')?.dataset.petSlot || '';

  // The quick look: a blurred frame and a tiny frame must fail on the screen,
  // with no request leaving the browser at all.
  const before = globalThis.__puts.length;
  result.localBlur = await putIntoSlot(tileFor('FACE_LEFT'), await noiseFile(640, 9));
  result.localTiny = await putIntoSlot(tileFor('FACE_RIGHT'), await noiseFile(200, 0));
  result.requestsDuringLocalChecks = globalThis.__puts.length - before;
  result.puts = globalThis.__puts.slice();

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

// A close-up is held until the pet has a whole-animal photo, and the button
// says so rather than offering the same picker again.
assert.equal(seen.anchorFirst.code, 'PET_PHOTO_ANCHOR_REQUIRED');
assert.equal(seen.anchorFirst.nextAction, 'UPLOAD_FACE_OR_BODY_FIRST');
assert.equal(seen.anchorFirst.retryLabel, '얼굴 사진부터 올리기');
assert.equal(
  seen.focusedAfterAnchorRetry,
  'FACE_FRONT',
  'the anchor refusal must move the owner to a whole-animal slot',
);

assert.equal(seen.serverBlur.code, 'PET_PHOTO_TOO_BLURRY');
assert.equal(seen.serverBlur.retryShown, true);

// The quick look answers before the network does, and says the same thing Core
// would have said.
assert.equal(seen.localBlur.code, 'PET_PHOTO_TOO_BLURRY', 'a blurred frame must fail on the screen');
assert.equal(seen.localTiny.code, 'PET_PHOTO_TOO_SMALL', 'a tiny frame must fail on the screen');
assert.equal(seen.localBlur.retryShown, true);
assert.equal(seen.localTiny.retryShown, true);
assert.equal(
  seen.requestsDuringLocalChecks,
  0,
  'the quick look must answer without a round trip',
);

// Sharp, full-size frames did reach Core: the quick look is a hint, not a gate.
assert.deepEqual(seen.puts, ['FACE_FRONT', 'NOSE_FRONT', 'BODY_LEFT']);

// Read back as the browser actually computed them, not as the source reads.
assert.deepEqual(seen.anchorSlots, CORE_ANCHOR_SLOTS, 'anchor slots must match Core');
assert.deepEqual(seen.closeupSlots, CORE_CLOSEUP_SLOTS, 'close-up slots must match Core');

console.log('SITE-PET-SPECIES-GATE-01 OK');
