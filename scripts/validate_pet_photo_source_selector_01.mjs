// SITE-PET-PHOTO-SOURCE-01 — LOTBI chooses first, not Google Photos direct.
//
// The bug this replaces: every Pet photo slot opened a single
// <input type="file" accept="image/jpeg,image/png"> with no `capture`. That
// exact multi-value mime list is what routes Android's Chrome straight into
// one photo provider — the same "generic chooser fallback" the profile photo
// picker was already fixed away from (see
// scripts/validate_conversation_sidebar_ux_01.mjs). The owner never got a
// chance to pick Camera, Gallery or Files; LOTBI does not choose, Google
// Photos did.
//
// SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): the per-slot pickers are gone;
// '사진 여러 장 선택' is the one way in, and it opens the same sheet (Gallery and
// File take several photos, Camera one). Desktop still goes straight to the
// file dialog.
//
// The fix is architectural (LOTBI asks first) and is checked two ways: static
// assertions on the source for the parts that cannot regress silently, and a
// real headless-browser render for the parts that only exist once the DOM is
// live — the sheet appearing, the right hidden input receiving the click, a
// cancel leaving the slot untouched, and Desktop never seeing the sheet at
// all.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const petUi = read('site-pet-ui.js');
const petCss = read('site-pet.css');

// --------------------------------------------------------------- static ---

// The bug-causing pattern must not survive on the picker-triggering inputs.
// A capture-forced camera input is unaffected by this bug (it never opens a
// chooser at all), so it alone may keep the exact JPEG/PNG list — this also
// matches the existing PET FAMILY contract test, which reads the first
// input's accept attribute per slot.
assert.match(petUi, /camera\.accept = 'image\/jpeg,image\/png'/, 'camera input must keep the exact JPEG/PNG accept list');
assert.match(petUi, /camera\.setAttribute\('capture', 'environment'\)/, 'camera input must force the device camera');
assert.match(petUi, /gallery\.accept = 'image\/\*'/, 'gallery input must not use a narrow mime list (the Android generic-chooser-fallback bug)');
assert.ok(!/file\.accept = 'image\/jpeg,image\/png'/.test(petUi), 'the File option must not carry the same narrow accept as Camera');
// PET-FILE-INPUT-IMAGE-ONLY-01 — owner: "캠코더 없이 사진첩만". An empty accept let
// Android's chooser list the camcorder; File now takes the same single type as Gallery.
assert.match(petUi, /file\.accept = 'image\/\*'/, 'the File option takes image/* so the Android chooser lists no camcorder');
assert.ok(!petUi.includes("gallery.setAttribute('capture'"), 'gallery must never force the camera');
assert.ok(!petUi.includes("file.setAttribute('capture'"), 'the File option must never force the camera');

// The three-way choice, not a single input.click() shortcut. SAFECARE-PHOTO-
// EASY-UPLOAD-01 (2nd round): the batch panel (shared by registration and
// 사진 갱신·관리) opens the shared sheet for '사진 여러 장 선택' and for a
// refused photo's next step; Gallery and File take several photos at once.
assert.match(petUi, /function openPetPhotoSource\(sourceInputs\) \{/, 'shared source-selector opener missing');
assert.match(petUi, /function buildPetPhotoSourceInputs\(\)/, 'shared three-input builder missing');
assert.ok(petUi.includes("pick.addEventListener('click', () => { if (!busy) openPetPhotoSource(sourceInputs); });"), "'사진 여러 장 선택' must open the shared source selector");
assert.ok(petUi.includes('openPetPhotoSource(replaceInputs);'), "a refused photo's next step must open the shared source selector");
assert.ok(petUi.includes('sourceInputs.gallery.multiple = true;') && petUi.includes('sourceInputs.file.multiple = true;'), 'Gallery and File take several photos');
assert.ok(!petUi.includes('sourceInputs.camera.multiple'), 'Camera takes one photo');
assert.ok(
  !/choose\.addEventListener\('click', \(\) => input\.click\(\)\)/.test(petUi),
  'a slot "사진 선택"/"다른 사진 선택" button must not click a single input directly any more',
);

// Desktop is explicitly a bypass, not a smaller version of the sheet.
assert.match(petUi, /if \(!isMobilePetPhotoViewport\(\)\) \{\s*sourceInputs\.gallery\.click\(\);\s*return;\s*\}/, 'Desktop must skip the sheet and go straight to the file dialog');
assert.match(petUi, /matchMedia\('\(max-width: 900px\)'\)/, 'the mobile/desktop split must reuse the project convention breakpoint');

// Post-selection validation is untouched: petPhotoRejection/inspectPetPhotoLocally
// still gate every one of the three inputs, so MIME/size enforcement is not
// weakened by broadening `accept`.
// SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): every input of the batch runs
// through the one batch handler, and the slot-free client functions reject an
// unsupported file locally before it ever reaches Core.
assert.ok(petUi.includes('for (const input of sourceInputs.all) {') && petUi.includes('void runBatch(files);'), 'all three inputs must run through the batch handler');
assert.ok(petUi.includes('const local = await inspectPetPhotoLocally(file)'), 'the batch takes the local quick look first');
const petClientSource = read('site-pet.js');
for (const name of ['addPetRegistrationDraftPhoto', 'addPetPhoto']) {
  const body = petClientSource.slice(petClientSource.indexOf(`export async function ${name}(`), petClientSource.indexOf('formData.append', petClientSource.indexOf(`export async function ${name}(`)));
  assert.ok(body.includes('const rejection = petPhotoRejection(file);'), `${name} must reject an unsupported file locally before it reaches Core`);
}
assert.equal(
  (petUi.match(/const rejection = petPhotoRejection\(file\);/g) || []).length,
  1, // (SAFECARE-WEB-UI-REDESIGN-01) the found-report photo
  'the found-report picker still rejects an unsupported file locally',
);

// The sheet only ever needs the shared, already-accessible bottom-sheet
// primitive — no new modal/overlay implementation, no new dependency.
assert.match(petUi, /import \{createBottomSheet\} from '\.\/site-bottom-sheet\.js\?v=/, 'must reuse the shared bottom-sheet primitive');
assert.match(petCss, /\.pet-photo-source-menu \{/, 'source menu layout styling missing');
assert.match(petCss, /\.pet-photo-source-option \{/, 'source option button styling missing');
assert.match(petCss, /body\[data-site-theme="dark"\] \.pet-photo-source-option \{/, 'source option must have a Dark styling');

for (const check of ['node --check site-pet-ui.js', 'node --check site-pet.css']) {
  const [cmd, ...args] = check.split(' ');
  if (cmd === 'node' && args[1]?.endsWith('.css')) continue; // node --check does not parse CSS
  const run = spawnSync(cmd, args, {cwd: ROOT, encoding: 'utf8'});
  assert.equal(run.status, 0, `${check} failed: ${run.stderr}`);
}

console.log('SITE-PET-PHOTO-SOURCE-01 static checks PASS');

// ------------------------------------------------------------------ live ---

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for the PET photo source selector web gate.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolve(port));
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
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

// DOG and CAT, both mid-registration, so a single fixture exercises both
// species through the exact same shared component.
const DOG_ID = 'PET_KR_AAAAAAAAAAAAAAAAAAAA';
const CAT_ID = 'PET_KR_BBBBBBBBBBBBBBBBBBBB';

function innerFixtureHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<link rel="stylesheet" href="/site-pet.css" />
<style>html,body{margin:0}#host{padding:12px}#render-result{position:absolute;left:-99999px;visibility:hidden}</style>
<script>
  // Never let a real OS file dialog open under headless Chrome: record which
  // input a click landed on instead. This is the only way to observe "which
  // source did LOTBI actually trigger" without a real native picker.
  globalThis.__clicked = [];
  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function patchedClick() {
    if (this.type === 'file') {
      globalThis.__clicked.push({
        source: this.dataset.petPhotoSourceInput || '',
        accept: this.getAttribute('accept') || '',
        capture: this.getAttribute('capture') || '',
        multiple: this.multiple,
      });
      return;
    }
    return nativeClick.call(this);
  };

  globalThis.__report = globalThis.fetch.bind(globalThis);
  const DRAFT_ID = 'pdraft_zzzzzzzzzzzzzzzzzzzz';
  let filledSlots = {['${DOG_ID}']: ['NOSE_FRONT'], ['${CAT_ID}']: []};
  let draftPhotos = [];
  let draftSpecies = '';
  globalThis.__draftFields = {};
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    const method = (init && init.method) || 'GET';
    const json = (body, status) => new Response(JSON.stringify(body), {status: status || 200, headers: {'Content-Type': 'application/json'}});

    // SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): Core's slot-free POSTs.
    const petPhotoPost = target.match(new RegExp('/v2/pets/([^/]+)/photos$'));
    if (method === 'POST' && petPhotoPost) {
      const petId = petPhotoPost[1];
      const slotCode = ['FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT'].find(code => !(filledSlots[petId] || []).includes(code));
      filledSlots[petId] = [...(filledSlots[petId] || []), slotCode];
      return json({photo: {slot_code: slotCode}, category: 'FACE', idempotent_replay: false, manifest: {slot_count: filledSlots[petId].length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}}, 201);
    }
    if (method === 'POST' && target.endsWith('/v2/pet-registration-drafts/' + DRAFT_ID + '/photos')) {
      const photo = {slot_code: 'FACE_FRONT', slot_index: 0, revision: 1, inspection_state: 'ACCEPTED', detected_species: draftSpecies || 'DOG'};
      draftPhotos = [...draftPhotos.filter(item => item.slot_code !== 'FACE_FRONT'), photo];
      return json({photo, category: 'FACE', idempotent_replay: false, draft: {draft_id: DRAFT_ID, status: 'ACTIVE', current_step: 'PHOTOS', revision: 3, species: draftSpecies || 'DOG', name: globalThis.__draftFields.name || null, sex: globalThis.__draftFields.sex || null, breed_code: globalThis.__draftFields.breed_code || null, breed: globalThis.__draftFields.breed || null, matching_consent_state: 'NOT_GRANTED', photos: draftPhotos}}, 201);
    }
    // An already-registered pet's own photo slots.
    const petPhotoPut = target.match(/\\/v2\\/pets\\/([^/]+)\\/photos\\/([A-Z_]+)$/);
    if (method === 'PUT' && petPhotoPut) {
      const [, petId, slotCode] = petPhotoPut;
      filledSlots[petId] = [...new Set([...(filledSlots[petId] || []), slotCode])];
      return json({manifest: {slot_count: filledSlots[petId].length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}});
    }
    if (/\\/v2\\/pets\\/${DOG_ID}\\/photos$/.test(target)) {
      return json({photos: filledSlots['${DOG_ID}'].map(slot_code => ({slot_code})), manifest: {slot_count: filledSlots['${DOG_ID}'].length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}});
    }
    if (/\\/v2\\/pets\\/${CAT_ID}\\/photos$/.test(target)) {
      return json({photos: filledSlots['${CAT_ID}'].map(slot_code => ({slot_code})), manifest: {slot_count: filledSlots['${CAT_ID}'].length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}});
    }
    if (/\\/v2\\/pets\\/sos$/.test(target)) return json({cases: []});
    if (/\\/v2\\/pets\\/found$/.test(target)) return json({cases: []});
    if (/\\/v2\\/pets$/.test(target)) return json({pets: [
      {pet_id: '${DOG_ID}', name: '보리', species: 'DOG', sex: 'FEMALE', photo_completion_state: 'UPLOAD_INCOMPLETE', matching_consent_state: 'NOT_GRANTED'},
      {pet_id: '${CAT_ID}', name: '나비', species: 'CAT', sex: 'FEMALE', photo_completion_state: 'UPLOAD_INCOMPLETE', matching_consent_state: 'NOT_GRANTED'},
    ]});

    // Registration draft: a brand-new pet, PHOTOS step. The gate under test
    // (FACE_FRONT unlocks the rest) is orthogonal to this feature and stays
    // completely untouched here — only exercised, not re-implemented.
    if (/\\/v2\\/pet-catalog$/.test(target)) {
      return json({
        breeds: {DOG: [{code: 'JINDO', display_name: '진돗개', species: 'DOG'}], CAT: []},
        colors: [{code: 'WHITE', display_name: '흰색'}],
        patterns: [{code: 'SOLID', display_name: '단색', species: null}],
      });
    }
    if (/\\/v2\\/pet-registration-drafts\\/active$/.test(target)) return json({draft: null});
    if (/\\/v2\\/pet-registration-drafts$/.test(target) && method === 'POST') {
      draftPhotos = [];
      draftSpecies = '';
      return json({draft: {draft_id: DRAFT_ID, status: 'ACTIVE', current_step: 'PHOTOS', revision: 1, matching_consent_state: 'NOT_GRANTED', photos: []}});
    }
    if (target.endsWith('/v2/pet-registration-drafts/' + DRAFT_ID) && method === 'PATCH') {
      const update = JSON.parse(init?.body || '{}');
      if (typeof update.species === 'string') draftSpecies = update.species;
      // SAFECARE-WEB-UI-REDESIGN-01: basic information comes first now, so the
      // stand-in keeps what was saved the way Core's draft does.
      for (const key of ['name', 'sex', 'breed_code', 'breed', 'current_step']) {
        if (key in update) globalThis.__draftFields[key] = update[key];
      }
      return json({draft: {draft_id: DRAFT_ID, status: 'ACTIVE', current_step: globalThis.__draftFields.current_step || 'PHOTOS', revision: 2, species: draftSpecies || 'DOG', name: globalThis.__draftFields.name || null, sex: globalThis.__draftFields.sex || null, breed_code: globalThis.__draftFields.breed_code || null, breed: globalThis.__draftFields.breed || null, matching_consent_state: 'NOT_GRANTED', photos: draftPhotos}});
    }
    const draftPhotoMatch = target.match(new RegExp('/v2/pet-registration-drafts/' + DRAFT_ID + '/photos/([A-Z_]+)$'));
    if (draftPhotoMatch && method === 'PUT') {
      const slotCode = draftPhotoMatch[1];
      const photo = {
        slot_code: slotCode,
        slot_index: 0,
        revision: 1,
        inspection_state: slotCode === 'FACE_FRONT' ? 'ACCEPTED' : 'PENDING',
        detected_species: slotCode === 'FACE_FRONT' ? draftSpecies : '',
      };
      draftPhotos = [...draftPhotos.filter(item => item.slot_code !== slotCode), photo];
      return json({photo});
    }
    return json({}, 404);
  };
</script>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
import {mountPetFamilyManager} from '/site-pet-ui.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// A real, decodable, sharp photo: the batch prepares each photo before sending it.
const png = () => new Promise(resolve => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
  const context = canvas.getContext('2d');
  const image = context.createImageData(400, 400);
  for (let i = 0; i < image.data.length; i += 4) { image.data[i] = (Math.random() * 256) | 0; image.data[i + 1] = (Math.random() * 256) | 0; image.data[i + 2] = 90; image.data[i + 3] = 255; }
  context.putImageData(image, 0, 0);
  canvas.toBlob(blob => resolve(new File([blob], 'x.png', {type: 'image/png'})), 'image/png');
});

async function setFile(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(await file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', {bubbles: true}));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if ((document.querySelector('[data-pet-bulk-status]')?.textContent || '').startsWith('등록 성공')) break;
    await wait(100);
  }
  await wait(300);
}

const result = {viewportWidth: window.innerWidth, userAgent: navigator.userAgent};
try {
  await mountPetFamilyManager({sessionToken: 'fixture-token', root: document.getElementById('host')});
  document.querySelector('[data-pet-open="${DOG_ID}"]').click();
  await wait(300);

  // SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round): the ten tiles are examples; the
  // one way in is '사진 여러 장 선택', and it keeps LOTBI's own source sheet.
  result.tilePickers = document.querySelectorAll('[data-pet-slot-grid] input, [data-pet-slot-choose]').length;
  const dogChoose = document.querySelector('[data-pet-bulk-pick]');

  // 1) The button must not open a native picker directly — only LOTBI's own
  //    menu (Mobile) or a direct gallery click (Desktop) may ever fire.
  globalThis.__clicked.length = 0;
  dogChoose.click();
  await wait(50);
  result.menuAfterChooseClick = Boolean(document.querySelector('.pet-photo-source-menu'));
  result.clickedAfterChooseClick = globalThis.__clicked.slice();

  if (result.menuAfterChooseClick) {
    // Mobile: verify the three labelled options exist before touching any of
    // them, then cancel via backdrop and prove nothing happened.
    const optionsAtOpen = [...document.querySelectorAll('.pet-photo-source-option')].map(node => ({
      key: node.dataset.petPhotoSourceOption,
      label: node.querySelector('.pet-photo-source-label')?.textContent || '',
      role: node.getAttribute('role'),
    }));
    result.optionsAtOpen = optionsAtOpen;
    result.sheetRole = document.querySelector('[data-lotbi-sheet]')?.getAttribute('role') || '';

    document.querySelector('[data-lotbi-sheet-backdrop]').click();
    await wait(250);
    result.menuAfterBackdropCancel = Boolean(document.querySelector('.pet-photo-source-menu'));
    result.clickedAfterBackdropCancel = globalThis.__clicked.slice();
    result.slotUnchangedAfterCancel = dogChoose.textContent.trim();

    // Reopen, choose Camera.
    dogChoose.click();
    await wait(50);
    document.querySelector('[data-pet-photo-source-option="camera"]').click();
    await wait(50);
    result.afterCamera = globalThis.__clicked.slice();
    result.menuAfterCameraPick = Boolean(document.querySelector('.pet-photo-source-menu'));
    // Reopen, choose File.
    globalThis.__clicked.length = 0;
    dogChoose.click();
    await wait(50);
    document.querySelector('[data-pet-photo-source-option="file"]').click();
    await wait(50);
    result.afterFile = globalThis.__clicked.slice();
    // Escape must also close the sheet.
    dogChoose.click();
    await wait(50);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await wait(250);
    result.menuAfterEscape = Boolean(document.querySelector('.pet-photo-source-menu'));
    // Reopen, choose Gallery, then actually deliver a photo through it — the
    // upload pipeline must still be the one canonical path (Core's POST).
    globalThis.__clicked.length = 0;
    dogChoose.click();
    await wait(50);
    document.querySelector('[data-pet-photo-source-option="gallery"]').click();
    await wait(50);
    result.afterGallery = globalThis.__clicked.slice();
    await setFile(document.querySelector('[data-pet-bulk-input]'), png());
    result.dogSlotFilledAfterGalleryUpload = document.querySelector('[data-pet-slot="FACE_FRONT"]')?.dataset.petSlotFilled;
    // CAT parity: the same shared component must open for the other species.
    document.querySelector('[data-pet-open="${CAT_ID}"]').click();
    await wait(300);
    document.querySelector('[data-pet-bulk-pick]').click();
    await wait(50);
    result.catMenuOpens = Boolean(document.querySelector('.pet-photo-source-menu'));
    result.catOptions = [...document.querySelectorAll('.pet-photo-source-option')].map(node => node.dataset.petPhotoSourceOption);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await wait(250);
    // Registration: step 1 is 기본정보, then the photo step's batch opens the
    // same sheet and reaches the draft's slot-free POST.
    document.querySelector('.pet-add-button').click();
    await wait(150);
    document.querySelector('input[name="pet-species"][value="DOG"]').click();
    await wait(150);
    const basicForm = document.querySelector('[data-pet-register-form]');
    basicForm.querySelector('input[type="text"]').value = '초코';
    basicForm.querySelector('input[name="pet-sex"][value="MALE"]').click();
    const breed = basicForm.querySelector('select');
    breed.value = 'JINDO';
    breed.dispatchEvent(new Event('change', {bubbles: true}));
    basicForm.requestSubmit();
    await wait(150);
    const renewalDialog = document.querySelector('[data-safecare-renewal-dialog="pet"]');
    result.registrationRenewalNotice = renewalDialog?.textContent || '';
    renewalDialog?.querySelector('[data-safecare-consent="privacy"]')?.click();
    renewalDialog?.querySelector('[data-safecare-renewal-confirm]')?.click();
    await wait(400);
    result.draftTilePickers = document.querySelectorAll('[data-pet-draft-slot] input, [data-pet-draft-slot] .pet-slot-actions button:not([data-pet-draft-slot-delete])').length;
    globalThis.__clicked.length = 0;
    document.querySelector('[data-pet-bulk-pick]').click();
    await wait(50);
    result.registrationMenuOpens = Boolean(document.querySelector('.pet-photo-source-menu'));
    document.querySelector('[data-pet-photo-source-option="gallery"]')?.click();
    await wait(50);
    result.registrationClicked = globalThis.__clicked.slice();
    await setFile(document.querySelector('[data-pet-bulk-input]'), png());
    result.draftSlotFilledAfterUnlock = [...document.querySelectorAll('[data-pet-draft-slot]')]
      .find(node => node.dataset.petDraftSlot === 'FACE_FRONT')?.dataset.petSlotFilled;
  } else {
    // Desktop: the button must go straight to the gallery input, and the
    // upload pipeline must still work end to end.
    result.desktopClickWentToGallery = result.clickedAfterChooseClick[0]?.source === 'gallery';
    result.desktopMultiple = result.clickedAfterChooseClick[0]?.multiple === true;
    await setFile(document.querySelector('[data-pet-bulk-input]'), png());
    result.dogSlotFilledAfterDesktopUpload = document.querySelector('[data-pet-slot="FACE_FRONT"]')?.dataset.petSlotFilled;
  }
} catch (error) {
  result.error = String(error && error.stack || error);
}
document.getElementById('render-result').textContent = JSON.stringify(result);
await globalThis.__report('/__result', {method: 'POST', body: JSON.stringify(result)});
</script></body></html>`;
}

async function run({windowSize, userAgent}) {
  const innerName = `.pet-photo-source-${process.pid}-${windowSize.replace(',', 'x')}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerFixtureHtml(), 'utf8');
  let settle;
  const answered = new Promise(resolve => { settle = resolve; });
  const server = await serve(body => settle(body));
  const {port} = server.address();
  const profile = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'lotbi-pet-photo-source-'));
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--window-size=${windowSize}`, `--user-data-dir=${profile}`,
  ];
  if (userAgent) args.push(`--user-agent=${userAgent}`);
  args.push(`http://127.0.0.1:${port}/${innerName}`);
  const browser = spawn(browserPath(), args, {stdio: 'ignore'});
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('pet photo source fixture never reported')), 90000).unref?.();
  });
  try {
    const body = await Promise.race([answered, timeout]);
    assert.ok(body && body.trim(), 'pet photo source fixture produced no result');
    return JSON.parse(body);
  } finally {
    browser.kill();
    server.close();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    try {
      fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    } catch {}
  }
}

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const mobileAndroid = await run({windowSize: '390,844', userAgent: ANDROID_UA});
assert.ok(!mobileAndroid.error, `Android mobile fixture failed: ${mobileAndroid.error}`);

assert.equal(mobileAndroid.menuAfterChooseClick, true, 'Mobile "사진 선택" must open LOTBI\'s own source menu, not a native picker');
assert.deepEqual(mobileAndroid.clickedAfterChooseClick, [], 'no input may be clicked before the owner chooses a source');
assert.deepEqual(
  mobileAndroid.optionsAtOpen,
  [
    {key: 'camera', label: '카메라', role: 'menuitem'},
    {key: 'gallery', label: '갤러리', role: 'menuitem'},
    {key: 'file', label: '파일', role: 'menuitem'},
  ],
  'Android must show Camera/Gallery/File in Korean, in that order',
);
assert.equal(mobileAndroid.sheetRole, 'dialog', 'the source sheet must be an accessible dialog');

assert.equal(mobileAndroid.menuAfterBackdropCancel, false, 'a backdrop click must close the menu');
assert.deepEqual(mobileAndroid.clickedAfterBackdropCancel, [], 'cancelling must never click any picker input');
assert.equal(mobileAndroid.slotUnchangedAfterCancel, '사진 여러 장 선택', 'cancelling must leave the button untouched');
assert.equal(mobileAndroid.tilePickers, 0, 'the ten tiles are examples without their own picker');

assert.equal(mobileAndroid.afterCamera.length, 1, 'choosing Camera must click exactly one input');
assert.equal(mobileAndroid.afterCamera[0].source, 'camera');
assert.equal(mobileAndroid.afterCamera[0].capture, 'environment', 'Camera must force the device camera');
assert.equal(mobileAndroid.afterCamera[0].accept, 'image/jpeg,image/png');
assert.equal(mobileAndroid.afterCamera[0].multiple, false, 'Camera takes one photo');
assert.equal(mobileAndroid.menuAfterCameraPick, false, 'the sheet must close once a source is chosen');

assert.equal(mobileAndroid.afterGallery.length, 1, 'choosing Gallery must click exactly one input');
assert.equal(mobileAndroid.afterGallery[0].source, 'gallery');
assert.equal(mobileAndroid.afterGallery[0].capture, '', 'Gallery must never force the camera');
assert.equal(mobileAndroid.afterGallery[0].accept, 'image/*', 'Gallery must not use the narrow mime list that causes the generic-chooser bug');
assert.equal(mobileAndroid.afterGallery[0].multiple, true, 'Gallery takes several photos at once');
assert.equal(mobileAndroid.dogSlotFilledAfterGalleryUpload, 'true', 'a file chosen through Gallery must still reach the canonical upload pipeline');

assert.equal(mobileAndroid.afterFile.length, 1, 'choosing File must click exactly one input');
assert.equal(mobileAndroid.afterFile[0].source, 'file');
assert.equal(mobileAndroid.afterFile[0].capture, '', 'File must never force the camera');
assert.notEqual(mobileAndroid.afterFile[0].accept, 'image/jpeg,image/png', 'File must not be the same narrow-list input as Camera');
assert.equal(mobileAndroid.afterFile[0].accept, 'image/*', 'File takes image/* (no camcorder in the Android chooser)');
assert.equal(mobileAndroid.afterFile[0].multiple, true, 'File takes several photos at once');

assert.equal(mobileAndroid.menuAfterEscape, false, 'Escape must close the sheet');

assert.equal(mobileAndroid.catMenuOpens, true, 'CAT must get the exact same source selector as DOG');
assert.deepEqual(mobileAndroid.catOptions, ['camera', 'gallery', 'file'], 'CAT options must match DOG');

assert.ok(mobileAndroid.registrationRenewalNotice.includes('나이와 관계없이 · 6개월(180일)마다'), 'registration must confirm the six-month renewal policy before photo sources open');
assert.equal(mobileAndroid.draftTilePickers, 0, 'registration tiles are examples without their own picker');
assert.equal(mobileAndroid.registrationMenuOpens, true, "registration's '사진 여러 장 선택' must open the same source menu");
assert.deepEqual(mobileAndroid.registrationClicked.map(click => [click.source, click.multiple]), [['gallery', true]], 'registration Gallery takes several photos');
assert.equal(mobileAndroid.draftSlotFilledAfterUnlock, 'true', 'the source selector must reach the draft upload pipeline');

console.log('SITE-PET-PHOTO-SOURCE-01 Android mobile web PASS');

const mobileIos = await run({windowSize: '390,844', userAgent: IOS_UA});
assert.ok(!mobileIos.error, `iOS mobile fixture failed: ${mobileIos.error}`);
assert.equal(mobileIos.menuAfterChooseClick, true, 'iOS Safari must also get LOTBI\'s own source menu');
assert.deepEqual(
  mobileIos.optionsAtOpen.map(option => option.label),
  ['카메라', '사진 보관함', '파일'],
  'iOS must read 사진 보관함 for the gallery option, not 갤러리',
);
console.log('SITE-PET-PHOTO-SOURCE-01 iOS mobile web PASS');

const desktop = await run({windowSize: '1280,900'});
assert.ok(!desktop.error, `Desktop fixture failed: ${desktop.error}`);
assert.equal(desktop.menuAfterChooseClick, false, 'Desktop must never show the mobile source menu');
assert.equal(desktop.desktopClickWentToGallery, true, 'Desktop must go straight to the plain file dialog (the gallery-equivalent input)');
assert.equal(desktop.desktopMultiple, true, 'Desktop picks several photos at once');
assert.equal(desktop.dogSlotFilledAfterDesktopUpload, 'true', 'Desktop file selection must still reach the canonical upload pipeline');
console.log('SITE-PET-PHOTO-SOURCE-01 Desktop web PASS');

console.log('SITE-PET-PHOTO-SOURCE-01 OK');
console.log('PHYSICAL DEVICE E2E DEFERRED — headless Chromium only; a real Android/iPhone handset was not available in this environment.');
