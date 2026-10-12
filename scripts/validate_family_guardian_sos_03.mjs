// Existing SOS clients and scope; never call production or claim alert delivery.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const people = read('site-person-ui.js');
const pets = read('site-pet-ui.js');
assert.match(people,/syncSosSubmit/,'사람 신고 입력/동의 전 버튼 비활성화 필요');
assert.match(pets,/syncSosSubmit/,'반려동물 신고 입력/동의 전 버튼 비활성화 필요');
const {safecareSosSubmitReady} = await import('../site-safecare-common.js');
const now = Date.parse('2026-10-12T09:00:00Z');
const valid = {busy:false,lastSeenAt:'2026-10-12T08:00:00Z',location:'가상 시험 장소',consented:true};
assert.equal(safecareSosSubmitReady(valid,now),true);
for (const input of [{...valid,busy:true},{...valid,consented:false},{...valid,location:' '},
  {...valid,lastSeenAt:''},{...valid,lastSeenAt:'잘못된 시간'},
  {...valid,lastSeenAt:'2026-10-12T09:01:00Z'}]) assert.equal(safecareSosSubmitReady(input,now),false);
assert.match(people,/접수번호.*activeCase\.sosId/);
assert.match(pets,/접수번호.*activeCase\.caseId/);
for(const source of [people,pets])assert.match(source,/syncSosSubmit\(\);/);
assert.match(people,/matchingConsentConfirmed: true/,'서버 명시 동의 전송 유지');
assert.match(pets,/matchingConsentConfirmed: consentInput\.checked/);
assert.ok(read('.github/workflows/site-review.yml').includes('node scripts/validate_family_guardian_sos_03.mjs'));
console.log('FAMILY-GUARDIAN-SOS-03 PASS — 기본 신고 진입·명시 동의·실제 접수번호. 관리자 알림·운영 E2E 완료 의미 아님');
