// LIFE-PUBLIC-DATA-01 / FEATURE B — NEIS 급식·학사일정·시간표.
//
// 계약:
//  - 학교는 한 번 고르면 기존 대화 설정 저장 구조(namespace 별)에 공개 식별값만 저장.
//  - 학교 관련 질문에만 client_context.school 을 싣는다. 다른 요청 body 는 그대로.
//  - 급식 없는 날은 Core 가 비워 보낸 그대로 — 카드가 메뉴를 만들지 않는다.
//  - 학사일정은 "캘린더에 추가" 버튼이 편집기를 열 뿐, 자동 저장하지 않는다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const school = await import('../site-life-school.js');
const {sendConversationMessage, sendGuestConversationMessage} = await import('../site-core.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

function fakeDocument() {
  const make = tag => {
    const node = {
      tag, className: '', textContent: '', type: '', children: [], attributes: {}, dataset: {}, listeners: {},
      append(...items) { for (const item of items) this.children.push(typeof item === 'string' ? {tag: '#text', textContent: item, children: []} : item); },
      appendChild(item) { this.children.push(item); return item; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      click() { this.listeners.click?.(); },
    };
    return node;
  };
  return {createElement: make};
}

function all(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.children || []) all(child, predicate, out);
  return out;
}

function textOf(node) {
  return (node.textContent || '') + (node.children || []).map(textOf).join('');
}

const SEOWON = {office_code: 'P10', school_code: '8332169', name: '전주서원초등학교', kind: '초등학교'};

await check('저장은 공개 식별값만, 학생 정보는 버린다', async () => {
  const storage = new MemoryStorage();
  const saved = school.writeSchoolPreference('lotbi.site.ux.v1.life-school.ns', {...SEOWON, student_name: '홍길동', grade: 3}, storage);
  assert.deepEqual(saved, {...SEOWON, grade: 3});
  assert.doesNotMatch(storage.getItem('lotbi.site.ux.v1.life-school.ns'), /홍길동/);
  assert.deepEqual(school.readSchoolPreference('lotbi.site.ux.v1.life-school.ns', storage), {...SEOWON, grade: 3});
  assert.equal(school.writeSchoolPreference('k', {office_code: 'P1', school_code: '8332169', name: '전주서원초등학교'}, storage), null);
  assert.equal(school.writeSchoolPreference('k', {office_code: 'P10', school_code: 'x', name: '전주서원초등학교'}, storage), null);
  school.clearSchoolPreference('lotbi.site.ux.v1.life-school.ns', storage);
  assert.equal(school.readSchoolPreference('lotbi.site.ux.v1.life-school.ns', storage), null);
});

await check('학교 관련 질문에만 학교를 싣는다', async () => {
  for (const text of ['오늘 급식 뭐야?', '내일 학교 뭐 있어?', '방학 언제야?', '3학년 2반 시간표', '이번주 학교 일정 알려줘']) {
    assert.deepEqual(school.schoolContextForMessage(text, SEOWON), SEOWON, text);
  }
  for (const text of ['전주 맛집', '지금 문 연 약국', '안녕']) {
    assert.equal(school.schoolContextForMessage(text, SEOWON), null, text);
  }
  assert.equal(school.schoolContextForMessage('오늘 급식', null), null);
});

await check('Core 요청: 학교 문맥은 client_context.school 로만, 없으면 body 그대로', async () => {
  const answered = {
    contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, correlation_id: 'req', status: 'ANSWERED', assistant_text: 'ok',
    intent: {action: 'SCHOOL_LOOKUP'}, response_mode: 'SCHOOL_READONLY',
    follow_up: {required: false, action: 'SCHOOL_LOOKUP', automatic_execution: false}, retry_safe: true,
    safety: {execution_authority: false, external_side_effect: false},
    school_result: {contract_id: 'CORE-SCHOOL-RESULT-01', schema_version: 1, kind: 'MEAL', meals: []},
  };
  let body;
  const reply = await sendGuestConversationMessage({guestToken: 'g'.repeat(40), text: '오늘 급식 뭐야?', idempotencyKey: 'guest-school-0001',
    timezone: 'Asia/Seoul', school: {...SEOWON, student_name: '홍길동'}},
  async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify(answered), {status: 200, headers: {'Content-Type': 'application/json'}}); });
  assert.deepEqual(body.client_context.school, SEOWON);
  assert.equal(reply.schoolResult.kind, 'MEAL');
  await sendConversationMessage('site-token', '안녕하세요', async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify(answered), {status: 200}); });
  assert.deepEqual(body, {text: '안녕하세요'});
  await sendGuestConversationMessage({guestToken: 'g'.repeat(40), text: '오늘 급식', idempotencyKey: 'guest-school-0002', timezone: 'Asia/Seoul',
    school: {office_code: 'P10', school_code: '83A2169', name: '전주서원초등학교'}},
  async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify(answered), {status: 200}); });
  assert.equal('school' in body.client_context, false);
});

// Shape produced by Core for 2026-10-01 (real NEIS fixture in Core tests).
const mealResult = {
  contract_id: 'CORE-SCHOOL-RESULT-01', schema_version: 1, kind: 'MEAL', school: SEOWON,
  range: {from: '2026-10-01', to: '2026-10-01', label: '오늘 10월 1일(목)'},
  meals: [{date: '2026-10-01', meal_code: '2', meal_name: '중식', calories: '635.0 Kcal', nutrition: [],
    dishes: [{name: '친환경쌀영양잡곡밥', allergens: [5]}, {name: '쇠고기미역국', allergens: [16]}, {name: '팥시루떡', allergens: []}]}],
  events: [], timetable: [], candidates: [], coverage: 'COMPLETE', allergen_legend: {'5': '대두', '16': '쇠고기'},
  source: 'NEIS_OPEN_API',
};

await check('급식 카드: 메뉴·알레르기·열량, 없는 날은 아무것도 만들지 않는다', async () => {
  const card = school.createSchoolResultCard(mealResult, {document: fakeDocument()});
  const text = textOf(card);
  assert.match(text, /전주서원초등학교/);
  assert.match(text, /10월 1일\(목\) 중식/);
  assert.match(text, /친환경쌀영양잡곡밥 ⑤/);
  assert.match(text, /635\.0 Kcal/);
  assert.match(text, /알레르기 표시: ⑤대두 ⑯쇠고기/);
  assert.match(text, /출처: NEIS 교육정보 개방 포털/);
  const empty = school.createSchoolResultCard({...mealResult, meals: [], allergen_legend: {}, empty_reason: 'NO_DATA'}, {document: fakeDocument()});
  assert.doesNotMatch(textOf(empty), /중식|Kcal/);
});

await check('학사일정: 캘린더 추가는 버튼을 눌렀을 때 편집기 초안만 넘긴다', async () => {
  const added = [];
  const card = school.createSchoolResultCard({
    ...mealResult, kind: 'SCHEDULE', meals: [], allergen_legend: {},
    events: [{date: '2026-10-07', name: '안전체험학습', content: '2학년 119체험학습', day_type: '해당없음', grades: [2],
      calendar_draft: {title: '[전주서원초등학교] 안전체험학습', local_date: '2026-10-07'}}],
  }, {document: fakeDocument(), onAddToCalendar: draft => added.push(draft)});
  assert.deepEqual(added, [], '렌더링만으로는 아무것도 추가되지 않는다');
  const [button] = all(card, node => node.className === 'lotbi-school-calendar-add');
  assert.equal(button.textContent, '캘린더에 추가');
  button.click();
  assert.deepEqual(added, [{title: '[전주서원초등학교] 안전체험학습', localDate: '2026-10-07'}]);
  assert.doesNotMatch(read('site-life-school.js'), /createLifeActivity|\/v2\/life\/activities|fetch\(/);
});

await check('학교 후보 선택 → 저장 콜백 + 원래 질문 다시 묻기, 학교 변경', async () => {
  const picks = [];
  const changes = [];
  const card = school.createSchoolResultCard({
    contract_id: 'CORE-SCHOOL-RESULT-01', schema_version: 1, kind: 'SCHOOL_CANDIDATES', school: null,
    candidates: [{...SEOWON, office_name: '전북특별자치도교육청', address: '전북특별자치도 전주시 완산구 오두정길 45', region: '전북특별자치도'}],
    resume_text: '오늘 급식 뭐야?', meals: [], events: [], timetable: [], coverage: 'COMPLETE',
  }, {document: fakeDocument(), onSelectSchool: (picked, resume) => picks.push([picked.school_code, resume])});
  const [choice] = all(card, node => node.className === 'lotbi-school-candidate');
  choice.click();
  assert.deepEqual(picks, [['8332169', '오늘 급식 뭐야?']]);
  const saved = school.createSchoolResultCard(mealResult, {document: fakeDocument(), onChangeSchool: () => changes.push(1)});
  all(saved, node => node.className === 'lotbi-school-change')[0].click();
  assert.equal(changes.length, 1);
});

await check('대화 배선: namespace 설정 키, meta 저장, 학년·반 패치, 학교 질문에만 전송', async () => {
  const source = read('site-conversation.js');
  assert.match(source, /const lifeSchoolKey = \(\) => storageKey\(namespace \|\| anonymousConversationNamespace\(\), 'life-school'\);/);
  assert.equal((source.match(/const schoolMeta = compactSchoolResultMeta\(response\.schoolResult\);/g) || []).length, 2);
  assert.equal((source.match(/const lifeSchool = schoolContextForMessage\(message, readSchoolPreference\(lifeSchoolKey\(\), storage\)\);/g) || []).length, 2);
  assert.equal((source.match(/\.\.\.\(lifeSchool \? \{school: lifeSchool\} : \{\}\),/g) || []).length, 2);
  assert.match(source, /onAddToCalendar: draft => openCalendar\(draft\?\.localDate \? 'month' : 'agenda', \{initialDraft: draft, restoreConversation: true\}\)/);
});

console.log(`\nLIFE NEIS SCHOOL VALIDATION PASS — ${passed} checks.`);
