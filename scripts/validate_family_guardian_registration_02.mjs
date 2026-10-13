// Phase 2: real clients, synthetic Core responses. No production data or APIs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPerson, getPerson, listPeople, updatePerson} from '../site-person.js';
import {listPets, lotbiPetNumber} from '../site-pet.js';

const id = 'per_0123456789abcdef0123456789abcdef';
const row = {person_id:id,registration_number:id,display_name:'가상 가족',nickname:null,
  relationship:'FAMILY',birth_year:2000,birthday_month:1,revision:3,
  identity_photo_count:5,identity_photo_complete:true,identity_photo_state:'CURRENT',
  identity_photo_expires_at:'2027-10-01T00:00:00Z'};
const calls = [];
const response = (payload,status=200) => new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
const fetchImpl = async (url,options={}) => {
  calls.push({url,options});
  if (options.method === 'PATCH') {
    const body = JSON.parse(options.body);
    assert.equal(body.expected_revision,3);
    return response({person:{...row,...body,revision:4}});
  }
  return response(url.endsWith('/v2/person-profiles') && options.method !== 'POST' ? {people:[row]} : {person:row});
};
const person = (await listPeople('synthetic-test-token',fetchImpl))[0];
assert.equal(person.registrationNumber,id,'실제 대상 등록번호를 응답에서 유지');
assert.equal(person.birthYear,2000); assert.equal(person.birthMonth,1);
const created = await createPerson('synthetic-test-token',{displayName:row.display_name,relationship:'FAMILY',birthYear:2000,birthMonth:1},fetchImpl);
assert.equal(created.birthMonth,1); assert.equal(created.registrationNumber,id);
const stored = await getPerson('synthetic-test-token',id,fetchImpl);
assert.equal(stored.birthYear,2000); assert.equal(stored.birthMonth,1); assert.equal(stored.registrationNumber,id);
const before = calls.length;
const unchanged = await updatePerson('synthetic-test-token',{personId:id,revision:3,original:person,
  displayName:person.displayName,nickname:'',relationship:'FAMILY',birthYear:2000,birthMonth:1},fetchImpl);
assert.equal(calls.length,before,'변경 없음은 PATCH를 보내지 않는다');
assert.equal(unchanged.revision,3); assert.equal(unchanged.identityPhotoExpiresAt,person.identityPhotoExpiresAt);
const changed = await updatePerson('synthetic-test-token',{personId:id,revision:3,original:person,
  displayName:'가상 가족 수정',nickname:'',relationship:'FAMILY',birthYear:2000,birthMonth:1},fetchImpl);
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{expected_revision:3,display_name:'가상 가족 수정'});
assert.equal(changed.registrationNumber,id); assert.equal(changed.birthMonth,1);
assert.equal(changed.identityPhotoExpiresAt,person.identityPhotoExpiresAt,'기본정보 수정으로 사진 갱신일을 연장하지 않는다');
await updatePerson('synthetic-test-token',{personId:id,revision:3,original:person,birthMonth:2},fetchImpl);
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{expected_revision:3,birth_year:2000,birthday_month:2},'서버 출생 연·월은 원자적 쌍으로 보낸다');
const legacy = await getPerson('synthetic-test-token',id,async()=>response({person:{...row,registration_number:undefined}}));
assert.equal(legacy.registrationNumber,id,'기존 내부 대상 ID만 호환 번호로 재사용, 번호를 새로 생성하지 않는다');
await assert.rejects(updatePerson('synthetic-test-token',{personId:id,revision:3,original:person,displayName:'가상 수정'},async()=>response({detail:{code:'PERSON_REVISION_CONFLICT'}},409)));
assert.equal(person.displayName,'가상 가족'); assert.equal(person.revision,3,'실패 시 기존 모델을 바꾸지 않는다');
const petId = 'PET_KR_0123456789ABCDEF0123';
const pets = await listPets('synthetic-test-token',async()=>response({pets:[{pet_id:petId,registration_number:petId,name:'가상 반려동물',species:'DOG'}]}));
assert.equal(pets[0].registrationNumber,petId);
assert.equal(lotbiPetNumber(pets[0].registrationNumber),'PET-KR 0123 4567 89AB CDEF 0123');
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const personUi = read('site-person-ui.js'); const petUi = read('site-pet-ui.js');
assert.ok((personUi.match(/person\.registrationNumber|item\.registrationNumber/g)||[]).length>=4,'목록·관리·완료·신고 실제 번호 연결');
assert.ok(personUi.includes("if (view.manage) header.append(el('p', 'person-card-meta', `등록번호 ${person.registrationNumber}`))"), '사진 단계는 등록 완료 후 관리 화면에서만 번호 표시');
assert.ok(personUi.includes("fact('가족 등록번호', maskedFamilyRegistrationNumber());"), '최종 확인에서는 실제 번호 대신 별표 번호를 표시');
assert.ok(personUi.includes("el('dt', '', '가족 등록번호'), el('dd', '', maskedFamilyRegistrationNumber())"), '사람 실종 신고에서도 번호를 별표 처리');
assert.ok(personUi.includes("facts.append(el('dt', '', '등록번호'), el('dd', '', person.registrationNumber))"), '최종 등록 완료 화면에서 번호 표시');
assert.ok(personUi.includes("fact('출생', person.birthYear"),'확인 단계 출생 연월 표시 보존');
assert.ok(personUi.includes('변경한 정보가 없습니다.'),'변경 없음·저장을 구분');
assert.ok(petUi.includes('lotbiPetNumber(pet.registrationNumber)'));
assert.ok(petUi.includes('lotbiPetNumber(created.registrationNumber)'));
assert.ok(petUi.includes("add(LOTBI_PET_NUMBER_LABEL, maskedPetRegistrationNumber());"), '반려동물 최종 확인에서도 별표 번호 표시');
assert.ok(petUi.includes('`${LOTBI_PET_NUMBER_LABEL} ${maskedPetRegistrationNumber()}`'), '반려동물 실종 신고에서도 번호를 별표 처리');
assert.ok(petUi.includes('등록을 확정한 뒤 롯비 반려동물 번호가 발급됩니다.'), '반려동물도 최종 등록 전 번호 미발급 안내');
assert.ok(read('.github/workflows/site-review.yml').includes('node scripts/validate_family_guardian_registration_02.mjs'),'신규 검사 gate 등록');
console.log('FAMILY-GUARDIAN-REGISTRATION-02 PASS — 번호·2000년1월·부분 수정·무변경·실패 보존. 가상 응답 계약, 운영 저장/사진 판정 검증 아님');
