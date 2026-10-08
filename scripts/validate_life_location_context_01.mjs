// LIFE-PUBLIC-DATA-01 — 생활 공공정보 조회에만 붙는 대략적 위치 문맥.
//
// 계약:
//  - "근처/지금 + 병원·약국·응급실·동물병원" 요청에만 위치를 붙인다. 일반 대화와
//    일반 장소 검색 요청 body 는 한 글자도 바뀌지 않는다.
//  - 순서: 위치 사용 ON + 현재 위치 → 저장 지역(캘린더 날씨 지역) → 없음.
//  - 좌표는 소수 셋째 자리로 반올림, 이 모듈은 아무것도 저장하지 않는다.
//  - 좌표 획득은 공통 위치 계층(site-current-location.js)만 쓴다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');
const codeOf = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const {lifeLocationIntent, resolveLifeLocationContext, savedRegionLabel, LIFE_LOCATION_SOURCE} = await import('../site-life-location.js');
const {sendConversationMessage, sendGuestConversationMessage} = await import('../site-core.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

const answered = {
  contract_id: 'CORE-WEB-CHAT-01',
  schema_version: 1,
  correlation_id: 'req_life_location',
  status: 'ANSWERED',
  assistant_text: 'ok',
  intent: {action: 'UNKNOWN'},
  response_mode: 'MODEL',
  follow_up: {required: false, action: null, reason: null, automatic_execution: false},
  retry_safe: true,
  safety: {execution_authority: false, external_side_effect: false},
};

await check('생활 조회 의도에만 반응한다', async () => {
  for (const text of ['근처 동물병원 찾아줘', '지금 문 연 약국', '오늘 밤 소아과 있어?', '근처 응급실', '일요일 약국', '롯비야 근처 동물병원']) {
    assert.equal(lifeLocationIntent(text), true, text);
  }
  for (const text of ['전주 맛집 알려줘', '안녕', '전주 동물병원', '병원비 얼마야', '오늘 급식 뭐야?', '']) {
    assert.equal(lifeLocationIntent(text), false, text);
  }
});

await check('온누리상품권 가맹점 질문과 그 후속 질문에만 반응한다 (ONNURI-MERCHANT-01)', async () => {
  for (const text of ['내 주변 온누리상품권 가맹점 찾아줘', '모바일 온누리 되는 곳만 보여줘', '온누리 가능한 카페 가까운 순서로 보여줘']) {
    assert.equal(lifeLocationIntent(text), true, text);
  }
  assert.equal(lifeLocationIntent('온누리약국 전화번호 알려줘'), false);
  const thread = [{role: 'assistant', text: ['**온누리상품권 가맹점**', '조건: 현재 위치 근처'].join(' ')}];
  assert.equal(lifeLocationIntent('가까운 2곳 알려줘', thread), true);
  assert.equal(lifeLocationIntent('가까운 2곳 알려줘'), false);
  assert.equal(lifeLocationIntent('가까운 2곳 알려줘', [{role: 'assistant', text: '전주 맛집 검색 결과예요.'}]), false);
});

await check('현재 위치가 있으면 반올림 좌표만 보낸다 (사용자 요청이 곧 명시적 동작)', async () => {
  const calls = [];
  const context = await resolveLifeLocationContext('근처 동물병원 찾아줘', {
    locationUsageEnabled: () => true,
    resolveCurrent: async options => { calls.push(options); return {location: {latitude: 35.8123456, longitude: 127.1166666, accuracyMeters: 12}}; },
    readSavedRegion: () => { throw new Error('saved region must not be read when GPS answered'); },
  });
  assert.deepEqual(calls, [{allowPrompt: true}]);
  assert.deepEqual(context, {latitude: 35.812, longitude: 127.117, source: LIFE_LOCATION_SOURCE.CURRENT});
  assert.equal(Object.isFrozen(context), true);
});

await check('권한 거부·시간 초과면 저장 지역, 그것도 없으면 아무것도 보내지 않는다', async () => {
  const saved = {label: '전북특별자치도 전주시 완산구', latitude: 35.8242, longitude: 127.148, midRegionCode: '11F10000'};
  const denied = await resolveLifeLocationContext('지금 문 연 약국', {
    locationUsageEnabled: () => true,
    resolveCurrent: async () => ({permission: 'DENIED', location: null}),
    readSavedRegion: () => saved,
  });
  assert.deepEqual(denied, {latitude: 35.824, longitude: 127.148, source: 'SAVED_REGION', label: '전북특별자치도 전주시 완산구'});

  const slow = await resolveLifeLocationContext('근처 응급실', {
    locationUsageEnabled: () => true,
    resolveCurrent: () => new Promise(() => {}),
    readSavedRegion: () => saved,
    timeoutMs: 20,
  });
  assert.equal(slow.source, 'SAVED_REGION');

  const nothing = await resolveLifeLocationContext('근처 응급실', {
    locationUsageEnabled: () => true,
    resolveCurrent: async () => ({location: null}),
    readSavedRegion: () => null,
  });
  assert.equal(nothing, null);
});

await check('위치 사용 OFF 면 GPS 를 묻지 않는다', async () => {
  let asked = false;
  const context = await resolveLifeLocationContext('근처 동물병원', {
    locationUsageEnabled: () => false,
    resolveCurrent: async () => { asked = true; return {location: {latitude: 35.8, longitude: 127.1}}; },
    readSavedRegion: () => null,
  });
  assert.equal(asked, false);
  assert.equal(context, null);
});

await check('해외·잘못된 좌표와 긴 지역명은 걸러진다', async () => {
  const abroad = await resolveLifeLocationContext('근처 약국', {
    locationUsageEnabled: () => true,
    resolveCurrent: async () => ({location: {latitude: 48.85, longitude: 2.35}}),
    readSavedRegion: () => null,
  });
  assert.equal(abroad, null);
  const long = savedRegionLabel('전북특별자치도 전주시 완산구 효자동1가 가나다라마바사 아자차카타파하 가나다라마바사 끝동네');
  assert.ok(long.length <= 40, long);
  assert.ok(long.endsWith('끝동네') && !long.startsWith('전북특별자치도'), long);
  assert.equal(savedRegionLabel('전북특별자치도 전주시 완산구'), '전북특별자치도 전주시 완산구');
  assert.equal(savedRegionLabel('<script>전주</script>'), 'script 전주 script');
});

await check('위치가 없으면 Core 요청 body 는 기존과 동일하다', async () => {
  let body;
  await sendConversationMessage('site-token', '안녕하세요', async (url, init) => { body = JSON.parse(init.body); return jsonResponse(answered); });
  assert.deepEqual(body, {text: '안녕하세요'});
  await sendConversationMessage('site-token', '전주 썬팅 찾아줘', async (url, init) => { body = JSON.parse(init.body); return jsonResponse(answered); },
    [], 'auth-life-0001', 'Asia/Seoul', '2026-10-06T10:00:00+09:00', [], {conversationId: 'thread-1', turnId: 'auth-life-0001', logicalRequestId: 'auth-life-0001', stateVersion: 1});
  assert.equal('location' in body.client_context, false);
});

await check('위치가 있으면 client_context.location 으로만 실린다 (로그인·게스트)', async () => {
  let body;
  await sendConversationMessage('site-token', '근처 동물병원', async (url, init) => { body = JSON.parse(init.body); return jsonResponse(answered); },
    [], 'auth-life-0002', 'Asia/Seoul', '2026-10-06T10:00:00+09:00', [],
    {conversationId: 'thread-1', turnId: 'auth-life-0002', logicalRequestId: 'auth-life-0002', stateVersion: 1,
      location: {latitude: 35.8123456, longitude: 127.1166666, source: 'BROWSER_CURRENT', label: 'ignored for current'}});
  assert.deepEqual(body.client_context.location, {latitude: 35.812, longitude: 127.117, source: 'BROWSER_CURRENT'});

  await sendGuestConversationMessage({
    guestToken: 'g'.repeat(40), text: '지금 문 연 약국', idempotencyKey: 'guest-life-0001', timezone: 'Asia/Seoul',
    location: {latitude: 35.8242, longitude: 127.148, source: 'SAVED_REGION', label: '전주시'},
  }, async (url, init) => { body = JSON.parse(init.body); return jsonResponse(answered); });
  assert.deepEqual(body.client_context.location, {latitude: 35.824, longitude: 127.148, source: 'SAVED_REGION', label: '전주시'});

  for (const bad of [{latitude: 99, longitude: 127, source: 'BROWSER_CURRENT'}, {latitude: 35, longitude: 127, source: 'GPS'}, 'x']) {
    await sendGuestConversationMessage({
      guestToken: 'g'.repeat(40), text: '근처 약국', idempotencyKey: 'guest-life-0002', timezone: 'Asia/Seoul', location: bad,
    }, async (url, init) => { body = JSON.parse(init.body); return jsonResponse(answered); });
    assert.equal('location' in body.client_context, false);
  }
});

await check('좌표는 공통 위치 계층에서만 얻고 이 모듈은 아무것도 저장하지 않는다', async () => {
  const source = codeOf('site-life-location.js');
  assert.match(source, /from '\.\/site-current-location\.js(?:\?v=[A-Za-z0-9._-]+)?'/);
  for (const forbidden of [/getCurrentPosition/, /watchPosition/, /permissions\s*\.\s*query/, /localStorage\s*\.\s*setItem/, /sessionStorage/, /indexedDB/, /document\.cookie\s*=/, /fetch\(/]) {
    assert.doesNotMatch(source, forbidden);
  }
  const conversation = read('site-conversation.js');
  // ONNURI-MERCHANT-01: both paths also pass the visible thread, so a short
  // follow-up after an 온누리 answer ("가까운 2곳") carries the same location.
  assert.equal((conversation.match(/const lifeLocation = await resolveLifeLocationContext\(message, \{recentContext: recentConversationContext\(\)\}\)\.catch\(\(\) => null\);/g) || []).length, 2);
  assert.equal((conversation.match(/\.\.\.\(lifeLocation \? \{location: lifeLocation\} : \{\}\)/g) || []).length, 2,
    '게스트와 로그인 두 경로 모두 같은 방식으로 위치를 싣는다');
});

console.log(`\nLIFE LOCATION CONTEXT VALIDATION PASS — ${passed} checks.`);
