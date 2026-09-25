// SITE-PET-FAMILY-V2-REGISTRATION-01 — photo-first private draft contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const clientSource = read('site-pet.js');
const uiSource = read('site-pet-ui.js');

for (const forbidden of [
  "label', '이름 (필수)'",
  "legend', '', '종 (필수)'",
]) {
  assert.ok(!uiSource.includes(forbidden), `required-marker copy returned: ${forbidden}`);
}
assert.ok(uiSource.indexOf("stepChrome('PHOTOS')") < uiSource.indexOf("stepChrome('BASIC')"),
  'the registration source must place the photo step before basic information');
assert.ok(uiSource.includes('petDraftPhotoInspectionMessage'), 'draft photo reason codes must drive visible inspection guidance');
assert.ok(uiSource.includes('next.disabled = !progression.ready'), 'BASIC must stay disabled until the progression contract is green');
assert.ok(!uiSource.includes('registrationDraft.photos.length !== PET_PHOTO_SLOT_CODES.length'),
  '10/10 presence alone must never authorize BASIC');
assert.ok(uiSource.includes("current_step: 'REVIEW'"), 'the form must persist review progress');
assert.ok(uiSource.includes('finalizePetRegistrationDraft'), 'stable registration must require explicit finalize');
assert.ok(clientSource.includes("PET_MATCHING_CONSENT_VERSION = 'PET_MATCHING_CONSENT_2026_09_V2'"));

const client = await import(`${pathToFileURL(path.join(ROOT, 'site-pet.js')).href}?v=v2-contract`);
const calls = [];
const json = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: {'Content-Type': 'application/json'},
});
const draftPayload = {
  draft_id: 'pdraft_0123456789abcdef0123',
  status: 'ACTIVE',
  current_step: 'PHOTOS',
  revision: 3,
  species: 'DOG',
  matching_consent_state: 'NOT_GRANTED',
  photos: [{
    slot_code: 'NOSE_FRONT',
    slot_index: 1,
    revision: 1,
    inspection_state: 'PENDING',
    inspection_reason_code: 'PET_PHOTO_ANCHOR_REQUIRED',
    detected_species: null,
  }],
};
const fetchImpl = async (url, options = {}) => {
  calls.push({url: String(url), options});
  const pathname = new URL(String(url)).pathname;
  if (pathname === '/v2/pet-catalog') {
    return json({
      breeds: {
        DOG: [{code: 'JINDO', display_name: '진돗개', species: 'DOG'}],
        CAT: [{code: 'KOREAN_SHORTHAIR', display_name: '코리안숏헤어', species: 'CAT'}],
      },
      colors: [{code: 'WHITE', display_name: '흰색'}],
      patterns: [{code: 'SOLID', display_name: '단색', species: null}],
    });
  }
  if (pathname === '/v2/pet-registration-drafts/active') return json({draft: draftPayload});
  if (pathname === '/v2/pet-registration-drafts' && options.method === 'POST') return json({draft: draftPayload});
  if (pathname.endsWith('/photos/NOSE_FRONT') && options.method === 'PUT') return json({photo: draftPayload.photos[0]});
  if (pathname.endsWith('/finalize') && options.method === 'POST') {
    return json({
      pet: {
        pet_id: 'PET_KR_0123456789ABCDEF0123',
        name: '보리',
        species: 'DOG',
        sex: 'UNKNOWN',
        matching_consent_state: 'NOT_GRANTED',
      },
      draft: {...draftPayload, status: 'COMPLETED', completed_pet_id: 'PET_KR_0123456789ABCDEF0123', photos: []},
    });
  }
  throw new Error(`unexpected request ${options.method || 'GET'} ${pathname}`);
};

const catalog = await client.getPetCatalog(fetchImpl);
assert.equal(catalog.breeds.DOG[0].code, 'JINDO');
assert.equal(catalog.patterns[0].displayName, '단색');

const active = await client.getActivePetRegistrationDraft('session-token', fetchImpl);
assert.equal(active.draftId, draftPayload.draft_id);
assert.equal(active.photos[0].inspectionState, 'PENDING');
assert.equal(active.photos[0].inspectionReasonCode, 'PET_PHOTO_ANCHOR_REQUIRED');
assert.ok(!('petId' in active), 'a private registration draft must not allocate a stable Pet ID');
assert.match(
  client.petDraftPhotoInspectionMessage(active.photos[0]),
  /얼굴이나 몸 전체/,
  'pending close-ups must explain the anchor requirement',
);

const acceptedDogPhotos = client.PET_PHOTO_SLOT_CODES.map((slotCode, index) => ({
  slotCode,
  slotIndex: index + 1,
  revision: 1,
  inspectionState: 'ACCEPTED',
  inspectionReasonCode: '',
  detectedSpecies: 'DOG',
}));
const greenProgression = client.petDraftPhotoProgression({
  species: 'DOG',
  photos: acceptedDogPhotos,
});
assert.equal(greenProgression.presentCount, 10);
assert.equal(greenProgression.acceptedCount, 10);
assert.equal(greenProgression.ready, true, '10 accepted DOG photos must authorize BASIC');

const rejectedProgression = client.petDraftPhotoProgression({
  species: 'DOG',
  photos: acceptedDogPhotos.map(photo => (
    photo.slotCode === 'FACE_LEFT'
      ? {...photo, inspectionState: 'REJECTED', inspectionReasonCode: 'PET_PHOTO_NOT_DOG_OR_CAT'}
      : photo
  )),
});
assert.equal(rejectedProgression.presentCount, 10);
assert.equal(rejectedProgression.ready, false, '10/10 with one rejected photo must not authorize BASIC');
assert.deepEqual(rejectedProgression.rejectedSlots, ['FACE_LEFT']);

const pendingProgression = client.petDraftPhotoProgression({
  species: 'DOG',
  photos: acceptedDogPhotos.map(photo => (
    photo.slotCode === 'BODY_RIGHT'
      ? {...photo, inspectionState: 'PENDING', inspectionReasonCode: 'PET_PHOTO_SPECIES_CHECK_UNAVAILABLE'}
      : photo
  )),
});
assert.equal(pendingProgression.presentCount, 10);
assert.equal(pendingProgression.ready, false, '10/10 with one pending photo must not authorize BASIC');
assert.deepEqual(pendingProgression.pendingSlots, ['BODY_RIGHT']);

const mismatchProgression = client.petDraftPhotoProgression({
  species: 'DOG',
  photos: acceptedDogPhotos.map(photo => (
    photo.slotCode === 'FACE_FRONT' ? {...photo, detectedSpecies: 'CAT'} : photo
  )),
});
assert.equal(mismatchProgression.ready, false, 'accepted anchor species must still match the selected species');
assert.deepEqual(mismatchProgression.speciesMismatchSlots, ['FACE_FRONT']);

await client.createPetRegistrationDraft('session-token', 'site.pet.draft.contract', fetchImpl);
const createCall = calls.find(call => new URL(call.url).pathname === '/v2/pet-registration-drafts'
  && call.options.method === 'POST');
assert.equal(createCall.options.headers['X-Request-ID'], 'site.pet.draft.contract');

const file = new File([Uint8Array.from([137, 80, 78, 71])], 'nose.png', {type: 'image/png'});
const uploaded = await client.uploadPetRegistrationDraftPhoto(
  'session-token',
  draftPayload.draft_id,
  'NOSE_FRONT',
  file,
  fetchImpl,
);
assert.equal(uploaded.inspectionState, 'PENDING', 'a close-up uploaded first must be retained as pending');
const uploadCall = calls.find(call => call.options.method === 'PUT');
assert.ok(uploadCall.options.body instanceof FormData, 'draft photos must use browser multipart FormData');
assert.ok(!('Content-Type' in uploadCall.options.headers), 'the browser must set the multipart boundary');

const finalized = await client.finalizePetRegistrationDraft(
  'session-token',
  draftPayload.draft_id,
  'site.pet.finalize.contract',
  fetchImpl,
);
assert.equal(finalized.pet.petId, 'PET_KR_0123456789ABCDEF0123');
const finalizeCall = calls.find(call => new URL(call.url).pathname.endsWith('/finalize'));
assert.equal(finalizeCall.options.headers['X-Request-ID'], 'site.pet.finalize.contract');

console.log('SITE-PET-FAMILY-V2-REGISTRATION-01 CONTRACT PASS');
