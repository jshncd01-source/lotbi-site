// LIFE-PUBLIC-DATA-01 / FEATURE A — 동물병원 Place Card.
//
// 계약:
//  - 기존 Place Card 를 그대로 쓴다. 액션은 여전히 전화 + 기본 지도앱 두 개뿐이다.
//  - "공식 등록 동물병원"은 Core 가 행정안전부 데이터와 대조에 성공했다고 밝힌
//    경우(VERIFIED + official_registered true)에만 쓴다. 그 외는 "확인 안 됨".
//  - 영업 중/영업 종료 문구는 카드에 만들지 않는다 (지도앱이 최신 안내를 준다).
//  - 거리는 Core 가 현재 위치 기준으로 계산해 준 경우에만 보인다.
//  - Pet SOS 발견 제보 흐름은 그대로 두고, 대화에서 "근처 동물병원 찾기"로만 잇는다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {
  buildDefaultMapHref,
  buildVerifiedPhoneHref,
  formatDistanceMeters,
  normalizePlaceResult,
  placeLifeBadges,
} = await import('../site-navigation.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// Shape produced by Core run_place_conversation for "근처 동물병원 찾아줘".
const coreResult = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0123456789abcdef0123',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '전주시 완산구 효자동 동물병원',
  results: [
    {
      result_id: 'place-1', place_id: 'naver:0:바른동물병원', name: '24시 바른동물병원', category: '동물병원',
      road_address: '전북특별자치도 전주시 완산구 효자로 123 1층', address: '전북특별자치도 전주시 완산구 효자동1가 1-1',
      latitude: 35.8135, longitude: 127.1185, coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true, phone: '063-111-2222', phone_verified: true,
      phone_evidence: {source: 'MOIS_ANIMAL_HOSPITAL', match_basis: 'CONTAINED_NAME_AND_ADDRESS', verification_state: 'VERIFIED'},
      open_now: null, business_hours: null,
      animal_hospital_verification: {state: 'VERIFIED', source: 'MOIS_ANIMAL_HOSPITAL', ai_calls: 0, official_registered: true,
        administrative_status: '영업/정상', license_date: '20200101', management_number: 'MNG-1', match_basis: 'CONTAINED_NAME_AND_ADDRESS'},
      distance_meters: 182,
    },
    {
      result_id: 'place-2', place_id: 'naver:1:새봄동물병원', name: '새봄동물병원', category: '동물병원',
      road_address: '전북특별자치도 전주시 덕진구 백제대로 500', address: '전북특별자치도 전주시 덕진구 금암동 2',
      latitude: 35.84, longitude: 127.13, coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true, phone: null, phone_verified: false,
      animal_hospital_verification: {state: 'NOT_FOUND', source: 'MOIS_ANIMAL_HOSPITAL', ai_calls: 0, official_registered: 'UNVERIFIED'},
      distance_meters: 3260,
    },
  ],
};

await check('공식 등록은 VERIFIED + true 일 때만, 나머지는 확인 안 됨', async () => {
  const result = normalizePlaceResult(coreResult, {capturedAt: Date.now()});
  const [first, second] = result.results;
  assert.equal(first.animalHospitalVerification.officialRegistered, true);
  assert.equal(first.animalHospitalVerification.administrativeStatus, '영업/정상');
  assert.equal(second.animalHospitalVerification.officialRegistered, false);
  assert.deepEqual(placeLifeBadges(first).map(badge => badge.label), ['공식 등록 동물병원', '182m']);
  assert.deepEqual(placeLifeBadges(second).map(badge => badge.label), ['공식 등록 확인 안 됨', '3.3km']);

  // A forged "official_registered: true" on a non-VERIFIED state is never shown as registered.
  const forged = normalizePlaceResult({...coreResult, results: [{...coreResult.results[1],
    animal_hospital_verification: {state: 'NOT_FOUND', source: 'MOIS_ANIMAL_HOSPITAL', ai_calls: 0, official_registered: true}}]});
  assert.equal(forged.results[0].animalHospitalVerification.officialRegistered, false);
  // Unknown source / AI-derived evidence is dropped entirely.
  const foreign = normalizePlaceResult({...coreResult, results: [{...coreResult.results[0],
    animal_hospital_verification: {state: 'VERIFIED', source: 'NAVER', ai_calls: 0, official_registered: true}}]});
  assert.equal(foreign.results[0].animalHospitalVerification, null);
  const inactive = normalizePlaceResult({...coreResult, results: [{...coreResult.results[0],
    animal_hospital_verification: {state: 'INACTIVE', source: 'MOIS_ANIMAL_HOSPITAL', ai_calls: 0, official_registered: 'UNVERIFIED', administrative_status: '폐업'}}]});
  assert.deepEqual(placeLifeBadges(inactive.results[0]).map(badge => badge.label), ['등록 상태 확인 필요', '182m']);
});

await check('일반 장소에는 아무 줄도 생기지 않는다', async () => {
  const plain = normalizePlaceResult({...coreResult, results: [{...coreResult.results[0], animal_hospital_verification: undefined, distance_meters: undefined}]});
  assert.deepEqual(placeLifeBadges(plain.results[0]), []);
  assert.equal(formatDistanceMeters(999), '999m');
  assert.equal(formatDistanceMeters(1000), '1.0km');
  assert.equal(formatDistanceMeters(null), '');
});

await check('전화는 검증된 번호만, 길찾기는 기본 지도앱 좌표 handoff', async () => {
  const result = normalizePlaceResult(coreResult);
  const [first, second] = result.results;
  assert.equal(buildVerifiedPhoneHref(first), 'tel:0631112222');
  assert.equal(buildVerifiedPhoneHref(second), '');
  assert.equal(first.navigationCapable, true);
  const naver = buildDefaultMapHref('NAVER_MAP', first, {userAgent: 'Mozilla/5.0 (Windows NT 10.0)'});
  assert.match(naver, /^https:\/\/map\.naver\.com\/p\/search\//);
  for (const provider of ['KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS']) {
    assert.ok(buildDefaultMapHref(provider, first, {userAgent: 'Mozilla/5.0 (Linux; Android 14)'}), provider);
  }
});

await check('카드는 기존 렌더러를 쓰고 액션은 두 개 그대로, 영업 문구는 없다', async () => {
  const source = read('site-conversation.js');
  const start = source.indexOf('const createPlaceCardRail = placeValue => {');
  const end = source.indexOf('const normalizeConversationCalendarResult', start);
  const renderer = source.slice(start, end);
  assert.match(renderer, /const lifeBadges = placeLifeBadges\(place\);/);
  assert.match(renderer, /copy\.appendChild\(badges\);/);
  assert.doesNotMatch(renderer, /actions\.appendChild\(badges\)/);
  const actionAppends = renderer.match(/actions\.appendChild\(/g) || [];
  assert.equal(actionAppends.length, 2, '전화 + 지도 두 개만');
  for (const forbidden of ['영업 중', '영업중', '영업 종료', '인허가', '공공데이터']) {
    assert.ok(!renderer.includes(forbidden), forbidden);
  }
  const navigation = read('site-navigation.js');
  for (const label of ['공식 등록 동물병원', '공식 등록 확인 안 됨', '등록 상태 확인 필요']) assert.ok(navigation.includes(label));
  assert.match(source, /animal_hospital_verification: place\.animalHospitalVerification \? \{/,
    '대화 저장(meta)에도 등록 대조 결과가 그대로 남아야 새로고침 뒤에도 같은 카드가 보인다');
});

await check('Pet SOS 발견 제보 → 근처 동물병원 찾기 (Pet SOS 흐름은 그대로)', async () => {
  const source = read('site-conversation.js');
  assert.match(source, /const ANIMAL_HOSPITAL_NEARBY_PROMPT = '근처 동물병원 찾아줘';/);
  assert.match(source, /if \(message\.meta\.petAction\.target === 'found'\) \{[\s\S]{0,400}vet\.dataset\.lifePrompt = ANIMAL_HOSPITAL_NEARBY_PROMPT;/);
  assert.match(source, /lifePrompt\.dataset\.lifePrompt === ANIMAL_HOSPITAL_NEARBY_PROMPT && !inFlight[\s\S]{0,120}requestAssistant\(ANIMAL_HOSPITAL_NEARBY_PROMPT, true\)/);
  assert.doesNotMatch(read('site-pet-ui.js'), /data-life-prompt|lifePrompt/);
  assert.doesNotMatch(read('site-pet.js'), /animal_hospital|동물병원 찾기/);
});

console.log(`\nLIFE ANIMAL HOSPITAL VALIDATION PASS — ${passed} checks.`);
