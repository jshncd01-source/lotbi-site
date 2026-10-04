import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const ui = read('site-person-ui.js');
const conversation = read('site-conversation.js');
assert.ok(ui.includes("['sos', 'SOS / 실종 신고'], ['home', '사람'], ['pet', '반려동물']"));
assert.ok(ui.includes('관리자 승인 후보'));
assert.ok(ui.includes('연락처는 공개되지 않습니다.'));
assert.ok(conversation.includes("onOpenPet: () => openPetFamily('pets')"));

const client = await import(`${pathToFileURL(path.join(root, 'site-person.js')).href}?contract=person-real-user-01`);
const calls = [];
const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
const fetchImpl = async (url, options = {}) => {
  calls.push({url: String(url), options});
  return json({sos: {
    sos_id: 'hsos_01', person_id: 'per_01', display_name: '민수', status: 'ACTIVE',
    last_seen_at: '2026-10-05T00:00:00Z', last_seen_summary: '서울', description: null,
    matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false,
  }});
};
const sos = await client.createPersonSos('session-token', {
  personId: 'per_01', lastSeenAt: '2026-10-05T00:00:00Z', lastSeenSummary: '서울', description: '',
}, fetchImpl);
assert.equal(sos.status, 'ACTIVE');
assert.equal(JSON.parse(calls[0].options.body).matching_consent_confirmed, true);

await assert.rejects(() => client.listGuardianNotices('session-token', async () => json({notices: [{
  notice_id: 'notice-1', candidate_id: 'candidate-1', person_id: 'per_01', display_name: '민수',
  status: 'UNREAD', response: null, face_score: 0.9, registered_photo_path: '/private',
  automatic_identity_decision: true, contact_details_exposed: false,
}]})), error => error?.code === 'PERSON_RESPONSE_INVALID');

console.log('SITE-PERSON-CARE-REAL-USER-01 CONTRACT PASS');
