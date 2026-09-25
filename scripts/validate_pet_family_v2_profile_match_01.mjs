// SITE-PET-FAMILY-V2-PROFILE-MATCH-01 — profile hub, private candidate review,
// semantic found-photo upload, and chat-to-task contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const clientSource = read('site-pet.js');
const uiSource = read('site-pet-ui.js');
const conversationSource = read('site-conversation.js');
const conversationCss = read('site-conversation.css');
const index = read('index.html');
const callback = read('auth/callback/index.html');
const assetVersion = JSON.parse(read('site-asset-version.json')).version;

for (const contract of [
  '/v2/pets/profile-hub',
  '/profile-preferences',
  '/v2/pets/match-notices',
  '/found-photo',
  '/response',
  "'X-Pet-Photo-Slot-Code'",
]) {
  assert.ok(clientSource.includes(contract), `missing Core client contract: ${contract}`);
}
for (const copy of [
  '관리자가 근거를 검토한 후보입니다.',
  '같은 반려동물일 확률이나 확정 판정이 아닙니다.',
  '발견자 연락처는 공개되지 않습니다.',
  '내 반려동물 같아요',
  '아닌 것 같아요',
  '잘 모르겠어요',
]) {
  assert.ok(uiSource.includes(copy), `missing private candidate-review copy: ${copy}`);
}
for (const forbidden of [
  '자동으로 주인에게 알림',
  '공개 매칭 결과',
  '발견자 연락처 보기',
  '같은 반려동물입니다',
]) {
  assert.ok(!uiSource.includes(forbidden), `unsafe public/automatic matching copy returned: ${forbidden}`);
}

assert.ok(uiSource.includes('FOUND_PHOTO_SEMANTIC_SLOT_CODES[slotIndex - 1]'),
  'found photos must carry an automatic internal semantic slot');
assert.ok(clientSource.includes('[3, 4, 5, 6, 7, 8, 0, 1, 2, 9].map(index => PET_PHOTO_SLOT_CODES[index])'),
  'the first found photo must be a broad face view, not a close-up');
assert.ok(conversationSource.includes('function petConversationAction'));
assert.ok(conversationSource.includes("target: 'found'"));
assert.ok(conversationSource.includes("target: 'sos'"));
assert.ok(conversationSource.includes("openPetFamily(petChatAction.dataset.petChatAction || 'pets')"));
assert.ok(conversationCss.includes('.conversation-pet-action-button'));
assert.ok(/\.conversation-pet-action-button\s*\{[\s\S]*?min-height:\s*44px/.test(conversationCss),
  'chat task CTA must retain a 44px touch target');

const token = uiSource.match(/site-pet\.js\?v=([\w-]+)/)?.[1];
assert.equal(token, assetVersion,
  'Pet V2 modules must use the generated content-hash asset version');
for (const [name, source, expected] of [
  ['site-conversation.js', conversationSource, `site-pet-ui.js?v=${token}`],
  ['index.html', index, `site-pet.css?v=${token}`],
  ['auth/callback/index.html', callback, `site-pet.css?v=${token}`],
]) {
  assert.ok(source.includes(expected), `${name} does not use the V2 profile cache token`);
}

const client = await import(`${pathToFileURL(path.join(ROOT, 'site-pet.js')).href}?v=v2-profile-match-contract`);
const calls = [];
const json = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: {'Content-Type': 'application/json'},
});
const fetchImpl = async (url, options = {}) => {
  const pathname = new URL(String(url)).pathname;
  calls.push({pathname, options});
  if (pathname === '/v2/pets/profile-hub') {
    return json({
      private: true,
      public_profile_exposure: false,
      pets: [{
        pet_id: 'PET_KR_0123456789ABCDEF0123',
        name: '보리',
        species: 'DOG',
        is_primary: true,
        age: {mode: 'EXACT', label: '4년 2개월'},
        family_duration: {label: '우리 가족이 된 지 3년'},
        birthday: {date: '2026-10-01', days_until: 7, state: 'D7', reminder_due: true},
        photo_count: 10,
        photo_total: 10,
        thumbnail: {slot_code: 'FACE_FRONT'},
        visual_identity: {status: 'READY', label: '식별정보 준비됨'},
        sos: {active: false, recently_resolved: true},
        candidate_notice_count: 1,
        candidate_label: '유사한 발견 제보가 있어요',
        timeline: [{type: 'REGISTERED', at: '2026-09-01T00:00:00Z', label: 'LOTBI 등록'}],
        birthday_reminders_enabled: true,
        family_anniversary_reminders_enabled: false,
      }],
    });
  }
  if (pathname.endsWith('/profile-preferences') && options.method === 'PUT') {
    return json({pet: {
      pet_id: 'PET_KR_0123456789ABCDEF0123', name: '보리', species: 'DOG', sex: 'UNKNOWN',
      matching_consent_state: 'GRANTED',
    }});
  }
  if (pathname === '/v2/pets/match-notices') {
    return json({automatic_owner_alert_enabled: false, notices: [{
      notice_id: 'notice-1',
      candidate_id: 'candidate-1',
      pet_id: 'PET_KR_0123456789ABCDEF0123',
      status: 'UNREAD',
      message: '등록하신 반려동물과 유사한 발견 제보가 접수되었습니다.',
      visual_similarity: 82,
      visual_similarity_label: '시각적 유사도 82/100',
      score_is_identity_probability: false,
      evidence_coverage: 'LOW',
      found_at: '2026-09-24T08:00:00Z',
      found_location: {district: '중구'},
      reporter_contact_returned: false,
    }]});
  }
  if (pathname.endsWith('/response') && options.method === 'POST') {
    return json({candidate_id: 'candidate-1', response: 'UNSURE', contact_relay_started: false, reporter_contact_returned: false});
  }
  if (pathname.endsWith('/photos/1') && options.method === 'PUT') return json({photo_count: 1});
  throw new Error(`unexpected request ${options.method || 'GET'} ${pathname}`);
};

const profiles = await client.getPetProfileHub('session-token', fetchImpl);
assert.equal(profiles[0].isPrimary, true);
assert.equal(profiles[0].thumbnailSlot, 'FACE_FRONT');
assert.equal(profiles[0].birthday.state, 'D7');
assert.equal(profiles[0].candidateNoticeCount, 1);
assert.equal(profiles[0].timeline[0].label, 'LOTBI 등록');

await client.updatePetProfilePreferences(
  'session-token',
  'PET_KR_0123456789ABCDEF0123',
  {birthday_reminders_enabled: false},
  fetchImpl,
);
const preferenceCall = calls.find(call => call.pathname.endsWith('/profile-preferences'));
assert.deepEqual(JSON.parse(preferenceCall.options.body), {birthday_reminders_enabled: false});

const notices = await client.listPetMatchNotices('session-token', fetchImpl);
assert.equal(notices[0].scoreIsIdentityProbability, false);
assert.equal(notices[0].reporterContactReturned, false);
assert.deepEqual(notices[0].foundLocation, {district: '중구'});

const response = await client.respondToPetMatchNotice('session-token', 'candidate-1', 'UNSURE', fetchImpl);
assert.equal(response.contactRelayStarted, false);
assert.equal(response.reporterContactReturned, false);
const responseCall = calls.find(call => call.pathname.endsWith('/response'));
assert.deepEqual(JSON.parse(responseCall.options.body), {response: 'UNSURE'});

const file = new File([Uint8Array.from([137, 80, 78, 71])], 'found.png', {type: 'image/png'});
await client.uploadFoundPetPhoto('session-token', 'found-1', 1, file, 'FACE_FRONT', fetchImpl);
const foundUpload = calls.find(call => call.pathname.endsWith('/photos/1'));
assert.equal(foundUpload.options.headers['X-Pet-Photo-Slot-Code'], 'FACE_FRONT');
assert.ok(foundUpload.options.body instanceof FormData);
assert.ok(!('Content-Type' in foundUpload.options.headers), 'browser must set multipart boundary');

console.log('SITE-PET-FAMILY-V2-PROFILE-MATCH-01 CONTRACT PASS');
