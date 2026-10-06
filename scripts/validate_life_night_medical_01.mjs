// LIFE-PUBLIC-DATA-01 / FEATURE C — 야간 병원·약국·응급실 카드.
//
// 계약:
//  - 기존 Place Card(전화 + 기본 지도앱)로 보여 준다. 새 카드 디자인이 없다.
//  - 국립중앙의료원 공식 좌표(NMC_OFFICIAL)는 길찾기 좌표로 쓴다.
//  - 진료·운영 여부는 "등록 시간상"으로만 쓴다. 등록 시간이 없으면 없다고 쓴다.
//  - 응급실 병상 숫자는 FRESH 보고만. 오래되면 숫자 없이 "오래됨". "수용 가능" 금지.
//  - 응급 답변에는 119 전화 안내가 붙는다(새로고침 뒤에도).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {buildDefaultMapHref, buildVerifiedPhoneHref, normalizeEmergencyStatus, normalizeMedicalStatus, normalizePlaceResult} = await import('../site-navigation.js');
const {createEmergencyCallNotice, medicalStatusLines} = await import('../site-life-medical.js');
const {sendGuestConversationMessage} = await import('../site-core.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const pharmacyResult = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_aaaaaaaaaaaaaaaaaaaa',
  provider_code: 'NMC',
  source: 'NMC_E_GEN',
  query: '현재 위치(전주시 완산구) 약국',
  results: [{
    result_id: 'place-1', place_id: 'nmc:C0000001', name: '밤늦게약국', category: '약국',
    address: '전북특별자치도 전주시 완산구 효자로 10 (효자동1가)', road_address: '전북특별자치도 전주시 완산구 효자로 10 (효자동1가)',
    latitude: 35.814, longitude: 127.119, coordinate_system: 'WGS84', coordinate_authority: 'NMC_OFFICIAL',
    navigation_capability: true, phone: '063-200-0001', phone_verified: true,
    phone_evidence: {source: 'NMC_E_GEN', verification_state: 'OFFICIAL_REGISTRY'},
    open_now: null, business_hours: null, distance_meters: 206,
    medical_status: {kind: 'PHARMACY', basis: 'NMC_REGISTERED_HOURS', target_label: '지금', open_state: 'OPEN', hours_label: '오늘 09:00~23:00'},
  }],
};

const erResult = {
  ...pharmacyResult,
  result_set_id: 'plrs_bbbbbbbbbbbbbbbbbbbb',
  results: [
    {
      ...pharmacyResult.results[0], result_id: 'place-1', place_id: 'nmc:A1200001', name: '가상권역응급의료센터병원',
      category: '종합병원', phone: '063-250-1119', medical_status: undefined,
      emergency_status: {er_operating: null, realtime_state: 'FRESH', updated_at_label: '10/07 22:15',
        beds: [{label: '응급실', available: 4}, {label: '수술실', available: 3}], equipment: [],
        severe_acceptance_reported: ['뇌출혈 수술'], severe_unavailable_reported: ['심근경색 재관류'],
        messages: ['소아 안과 진료 불가'], acceptance_guaranteed: false},
    },
    {
      ...pharmacyResult.results[0], result_id: 'place-2', place_id: 'nmc:A1200002', name: '가상지역응급의료센터병원',
      category: '종합병원', phone: '063-230-1119', medical_status: undefined,
      emergency_status: {er_operating: null, realtime_state: 'STALE', updated_at_label: '10/07 18:00',
        beds: [{label: '응급실', available: 9}], equipment: [], severe_acceptance_reported: [], severe_unavailable_reported: [],
        messages: [], acceptance_guaranteed: false},
    },
  ],
};

await check('약국: 등록 시간상 운영 중 + 시간, 전화·공식 좌표 길찾기', async () => {
  const [place] = normalizePlaceResult(pharmacyResult).results;
  assert.deepEqual(medicalStatusLines(place).map(line => line.text), ['등록 시간상 운영 중 · 오늘 09:00~23:00']);
  assert.equal(buildVerifiedPhoneHref(place), 'tel:0632000001');
  assert.equal(place.navigationCapable, true, 'NMC 공식 WGS84 좌표는 길찾기 좌표다');
  const tmap = buildDefaultMapHref('TMAP', place, {userAgent: 'Mozilla/5.0 (Linux; Android 14)'});
  assert.match(tmap, /goalx=127\.119/);
});

await check('병원: 진료 종료·등록 시간 없음은 그대로, 지어내지 않는다', async () => {
  const closed = normalizeMedicalStatus({kind: 'HOSPITAL', basis: 'NMC_REGISTERED_HOURS', open_state: 'CLOSED', hours_label: '오늘 09:00~18:00'});
  assert.deepEqual(medicalStatusLines({medicalStatus: closed}).map(line => line.text), ['등록 시간상 진료 종료 · 오늘 09:00~18:00']);
  const missing = normalizeMedicalStatus({kind: 'HOSPITAL', basis: 'NMC_REGISTERED_HOURS', open_state: 'NOT_LISTED', hours_label: '오늘 진료시간 정보 없음'});
  assert.deepEqual(medicalStatusLines({medicalStatus: missing}).map(line => line.text), ['오늘 진료시간 정보 없음']);
  const sunday = normalizeMedicalStatus({kind: 'PHARMACY', basis: 'NMC_REGISTERED_HOURS', open_state: 'LISTED', hours_label: '일요일 10:00~18:00'});
  assert.deepEqual(medicalStatusLines({medicalStatus: sunday}).map(line => line.text), ['일요일 10:00~18:00']);
  assert.equal(normalizeMedicalStatus({kind: 'HOSPITAL', basis: 'GUESS', open_state: 'OPEN'}), null);
});

await check('응급실: FRESH 만 숫자, STALE 은 숫자 없음, 수용 보장 데이터는 거부', async () => {
  const [fresh, stale] = normalizePlaceResult(erResult).results;
  assert.deepEqual(medicalStatusLines(fresh).map(line => line.text), ['응급실 가용 병상 4 · 10/07 22:15 보고', '병원 공지: 소아 안과 진료 불가']);
  assert.deepEqual(medicalStatusLines(stale).map(line => line.text), ['실시간 병상 정보 오래됨(10/07 18:00)']);
  assert.deepEqual(stale.emergencyStatus.beds, [], 'STALE 보고의 병상 숫자는 버린다');
  const full = normalizeEmergencyStatus({realtime_state: 'FRESH', beds: [{label: '응급실', available: -2}], acceptance_guaranteed: false, updated_at_label: '22:15'});
  assert.deepEqual(medicalStatusLines({emergencyStatus: full}).map(line => line.text), ['응급실 가용 병상 없음(보고값 -2) · 22:15 보고']);
  assert.equal(normalizeEmergencyStatus({realtime_state: 'FRESH', beds: [], acceptance_guaranteed: true}), null);
  const none = normalizeEmergencyStatus({realtime_state: 'UNAVAILABLE', beds: [{label: '응급실', available: 5}], acceptance_guaranteed: false});
  assert.deepEqual(medicalStatusLines({emergencyStatus: none}).map(line => line.text), ['실시간 병상 정보 없음']);
  for (const line of [...medicalStatusLines(fresh), ...medicalStatusLines(stale)]) {
    assert.doesNotMatch(line.text, /수용\s*가능|받아\s*줍|보장/);
  }
});

await check('119 안내: 응답 notice → meta.emergencyCall → tel:119 버튼', async () => {
  let body;
  const reply = await sendGuestConversationMessage({
    guestToken: 'g'.repeat(40), text: '근처 응급실', idempotencyKey: 'guest-medical-0001', timezone: 'Asia/Seoul',
  }, async () => new Response(JSON.stringify({
    contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, correlation_id: 'req', status: 'ANSWERED',
    assistant_text: '생명이 위급하거나 응급 증상이 의심되면 지금 바로 119에 전화하세요.', intent: {action: 'MEDICAL_SEARCH'},
    response_mode: 'MEDICAL_PROVIDER_READONLY',
    follow_up: {required: false, action: 'MEDICAL_SEARCH', automatic_execution: false}, retry_safe: true,
    safety: {execution_authority: false, external_side_effect: false},
    place_result: erResult,
    medical_result: {contract_id: 'CORE-MEDICAL-RESULT-01', schema_version: 1, kind: 'EMERGENCY', notices: ['CALL_119']},
  }), {status: 200, headers: {'Content-Type': 'application/json'}}));
  assert.equal(reply.medicalNotice.emergencyCall, true);
  assert.equal(reply.placeResult.provider_code, 'NMC');
  void body;

  const elements = [];
  const doc = {createElement: tag => {
    const element = {tag, children: [], attributes: {}, className: '', textContent: '', href: '',
      setAttribute(name, value) { this.attributes[name] = value; }, append(...items) { this.children.push(...items); }};
    elements.push(element);
    return element;
  }};
  const notice = createEmergencyCallNotice(doc);
  assert.equal(notice.className, 'conversation-emergency-call');
  const link = notice.children.find(child => child.tag === 'a');
  assert.equal(link.href, 'tel:119');

  const source = read('site-conversation.js');
  assert.equal((source.match(/if \(response\.medicalNotice\?\.emergencyCall === true\) meta\.emergencyCall = true;/g) || []).length, 2);
  assert.match(source, /if \(message\.role === 'assistant' && message\.meta\?\.emergencyCall === true\) \{\s*node\.appendChild\(createEmergencyCallNotice\(document\)\);/);
});

await check('카드 렌더러: 상태 줄만 추가, 액션은 그대로 두 개', async () => {
  const source = read('site-conversation.js');
  const start = source.indexOf('const createPlaceCardRail = placeValue => {');
  const end = source.indexOf('const normalizeConversationCalendarResult', start);
  const renderer = source.slice(start, end);
  assert.match(renderer, /for \(const line of medicalStatusLines\(place\)\)/);
  assert.equal((renderer.match(/actions\.appendChild\(/g) || []).length, 2);
  assert.match(source, /medical_status: \{\s*kind: place\.medicalStatus\.kind,/, '저장 meta 에도 남아 새로고침 뒤 같은 카드');
  assert.match(source, /emergency_status: \{\s*realtime_state: place\.emergencyStatus\.realtimeState,/);
});

console.log(`\nLIFE NIGHT MEDICAL VALIDATION PASS — ${passed} checks.`);
