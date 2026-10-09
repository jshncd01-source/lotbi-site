// SCHOOL-MEAL-01 — 학교 급식표: NEIS 자동 + 직원 보완.
//
// 계약:
//  - 오늘 급식은 짧게(메뉴 6개까지, 나머지는 "더 보기"), 이번 주 급식은 급식이
//    있는 날만 보여 주고 오늘을 표시한다. 주말 급식이 오면 그대로 보여 준다.
//  - [이번 주 급식]은 그 주에 더 볼 급식이 있을 때만, [급식표 보기]는 직원이
//    등록한 학교 급식표 주소가 있을 때만. 학교 홈페이지 버튼은 따로 유지.
//  - 직원 보완 급식은 "학교 공식자료 기준"(안전한 근거 주소) 또는 "직원 확인 정보"
//    로만 표시하고 NEIS라고 하지 않는다. 알레르기는 받은 그대로, 해석하지 않는다.
//  - "내일은?" 같은 급식 후속 질문에도 저장된 학교(공개 식별값)를 싣는다.
//  - 360/375/390/412px 모바일과 1280px 데스크톱, 라이트·다크에서 넘치지 않고
//    버튼은 44px 이상, 학교명은 잘리지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const school = await import('../site-life-school.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function fakeDocument() {
  const make = tag => ({
    tag, className: '', textContent: '', type: '', children: [], attributes: {}, dataset: {}, listeners: {},
    append(...items) { for (const item of items) this.children.push(typeof item === 'string' ? {tag: '#text', textContent: item, children: []} : item); },
    appendChild(item) { this.children.push(item); return item; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
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

const byClass = (card, name) => all(card, node => String(node.className || '').split(' ').includes(name));
const anchors = card => all(card, node => node.tag === 'a');
const buttons = card => all(card, node => node.tag === 'button');

const SEOWON = {office_code: 'P10', school_code: '8332169', name: '전주서원초등학교', kind: '초등학교'};
const LINKS = {homepage_url: 'http://www.sewon.es.kr/', homepage_source: 'NEIS', meal_source_url: 'https://www.sewon.es.kr/meal'};
const TODAY = '2026-10-08';

function neisMeal(date, mealType, mealName, dishes, calories = '601.1 Kcal') {
  return {date, meal_code: {BREAKFAST: '1', LUNCH: '2', DINNER: '3'}[mealType], meal_name: mealName, meal_type: mealType,
    dishes, calories, nutrition: [], source_type: 'NEIS'};
}

function staffMeal(date, mealType, mealName, sourceUrl = null) {
  return {date, meal_code: null, meal_name: mealName, meal_type: mealType, calories: '650 Kcal', nutrition: [],
    dishes: [{name: '쌀밥', allergens: [5]}, {name: '미역국', allergens: []}, {name: '불고기', allergens: []}],
    allergy_text: '5.6.16 (학교 표기)', source_type: 'STAFF_FALLBACK',
    source_label: sourceUrl ? '학교 공식자료 기준' : '직원 확인 정보', source_url: sourceUrl};
}

const LONG_LUNCH = neisMeal(TODAY, 'LUNCH', '중식', [
  {name: '친환경발아찰현미밥', allergens: []},
  {name: '솎음배추된장국', allergens: [5, 6]},
  {name: '견과류모듬', allergens: [14]},
  {name: '닭고기야채카레찜', allergens: [2, 5, 6, 12, 13, 15, 16, 18]},
  {name: '볼카츠/케챱', allergens: [1, 5, 6, 10, 12]},
  {name: '보쌈김치', allergens: [9]},
  {name: '쌈다시마파프리카표고버섯초장쌈다시마파프리카표고버섯초장', allergens: [5, 6, 13]},
  {name: '망고블루요거트', allergens: [2]},
]);

function result(kind, extra = {}) {
  return {
    contract_id: 'CORE-SCHOOL-RESULT-01', schema_version: 1, kind, school: SEOWON,
    range: {from: TODAY, to: TODAY, label: '오늘 10월 8일(목)'},
    meals: [], events: [], timetable: [], candidates: [], coverage: 'COMPLETE', source: 'NEIS_OPEN_API', today: TODAY,
    freshness: 'FRESH',
    ...extra,
  };
}

function today(meals, {links = LINKS, more = true, week = '2026-10-05', target = TODAY, label = '오늘 10월 8일(목)'} = {}) {
  return result('MEAL', {
    range: {from: target, to: target, label}, meals, links,
    allergen_legend: {'2': '우유', '5': '대두', '6': '밀', '9': '새우'},
    meal_summary: {target_date: target, meals, source: 'NEIS', official_meal_page_url: links?.meal_source_url ?? null,
      has_more_weekly: more, week: {from: week, to: '2026-10-11'}},
  });
}

const WEEK_DAYS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
function weekResult({skip = ['2026-10-05', '2026-10-09']} = {}) {
  const days = WEEK_DAYS.filter(day => !skip.includes(day)).map(date => ({
    date,
    meals: date === '2026-10-10'
      ? [staffMeal(date, 'LUNCH', '중식', 'https://www.sewon.es.kr/meal/1010')]
      : [neisMeal(date, 'BREAKFAST', '조식', [{name: '달걀야채죽', allergens: [1]}, {name: '배추김치', allergens: [9]}], '572.7 Kcal'),
        neisMeal(date, 'LUNCH', '중식', LONG_LUNCH.dishes, '797.8 Kcal'),
        neisMeal(date, 'DINNER', '석식', [{name: '친환경보리밥', allergens: []}, {name: '돼지고기김치찌개', allergens: [5, 9, 10]}], '1221.3 Kcal')],
  }));
  return result('MEAL', {
    range: {from: '2026-10-05', to: '2026-10-11', label: '이번 주'}, links: LINKS,
    meals: days.flatMap(day => day.meals), weekly: days, allergen_legend: {'1': '난류', '9': '새우'},
  });
}

// ------------------------------------------------------------------ unit --

await check('SCHOOL_TODAY_MEAL_PASS: one day, compact (6 dishes + 더 보기), calories, allergens as NEIS sent them', async () => {
  const card = school.createSchoolResultCard(today([LONG_LUNCH]), {document: fakeDocument()});
  const text = textOf(card);
  assert.match(text, /전주서원초등학교/u);
  assert.match(text, /10월 8일\(목\) 중식/u);
  const [first] = byClass(card, 'lotbi-school-dishes');
  assert.equal(first.children.length, 6);
  const [more] = byClass(card, 'lotbi-school-more');
  assert.equal(more.tag, 'details');
  assert.equal(textOf(more.children[0]), '메뉴 2개 더 보기');
  assert.match(textOf(more), /망고블루요거트 ②/u);
  assert.match(text, /닭고기야채카레찜 ②⑤⑥⑫⑬⑮⑯⑱/u);
  assert.match(text, /601\.1 Kcal/u);
  assert.match(text, /알레르기 정보는 학교·NEIS 제공 내용을 확인하세요\./u);
  assert.equal(byClass(card, 'lotbi-school-week').length, 0);
});

await check('SCHOOL_WEEKLY_MEAL_PASS: only days with meals, today marked, weekend kept when served', async () => {
  const card = school.createSchoolResultCard(weekResult(), {document: fakeDocument()});
  const days = byClass(card, 'lotbi-school-day');
  assert.deepEqual(days.map(day => day.dataset.schoolDate), ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-10', '2026-10-11']);
  const todayBlocks = days.filter(day => day.className.includes('is-today'));
  assert.equal(todayBlocks.length, 1);
  assert.equal(todayBlocks[0].dataset.schoolDate, TODAY);
  assert.equal(todayBlocks[0].attributes['aria-current'], 'date');
  assert.match(textOf(todayBlocks[0]), /오늘/u);
  assert.match(textOf(card), /10월 10일\(토\)/u, 'Saturday meals show when the school serves them');
  assert.doesNotMatch(textOf(card), /10월 9일|10월 5일/u, 'no empty day cards');
  assert.equal(byClass(card, 'lotbi-school-weekly').length, 0, 'a week view needs no week button');
});

await check('OFFICIAL_MEAL_LINK_PASS: [급식표 보기] is the staff-registered page, homepage stays its own button', async () => {
  const card = school.createSchoolResultCard(today([LONG_LUNCH]), {document: fakeDocument()});
  const links = anchors(card);
  assert.deepEqual(links.map(link => link.textContent), ['급식표 보기', '학교 홈페이지']);
  assert.deepEqual(links.map(link => link.href), ['https://www.sewon.es.kr/meal', 'http://www.sewon.es.kr/']);
  for (const link of links) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
});

await check('NO_OFFICIAL_MEAL_LINK_NO_BUTTON_PASS: no staff meal page, no [급식표 보기] — the homepage never stands in', async () => {
  const card = school.createSchoolResultCard(today([LONG_LUNCH], {links: {...LINKS, meal_source_url: null}}), {document: fakeDocument()});
  assert.deepEqual(anchors(card).map(link => link.textContent), ['학교 홈페이지']);
  for (const unsafe of ['https://search.naver.com/search.naver?query=x', 'javascript:alert(1)', 'http://10.0.0.1/meal']) {
    const value = school.normalizeSchoolResult(today([LONG_LUNCH], {links: {...LINKS, meal_source_url: unsafe}}));
    if (unsafe.startsWith('https://search.')) continue;     // Core refuses these; the browser only re-checks safety
    assert.equal(value.links.mealSourceUrl, '', unsafe);
  }
  const bare = school.createSchoolResultCard(today([LONG_LUNCH], {links: null, more: false}), {document: fakeDocument()});
  assert.equal(byClass(bare, 'lotbi-school-links').length, 0, 'no empty button row');
});

await check('NEIS_SOURCE_PASS: NEIS meals say NEIS and carry no staff badge', async () => {
  const card = school.createSchoolResultCard(today([LONG_LUNCH]), {document: fakeDocument()});
  assert.equal(textOf(byClass(card, 'lotbi-school-source')[0]), '출처: NEIS 교육정보 개방 포털');
  assert.equal(byClass(card, 'lotbi-school-meal-badge').length, 0);
});

await check('STAFF_FALLBACK_SOURCE_PASS: staff meals are 학교 공식자료 기준 / 직원 확인 정보, never NEIS', async () => {
  const withSource = school.createSchoolResultCard(today([staffMeal(TODAY, 'LUNCH', '중식', 'https://www.sewon.es.kr/meal/1008')]), {document: fakeDocument()});
  assert.deepEqual(byClass(withSource, 'lotbi-school-meal-badge').map(textOf), ['학교 공식자료 기준']);
  const source = textOf(byClass(withSource, 'lotbi-school-source')[0]);
  assert.equal(source, '출처: 학교 자료를 LOTBI 직원이 확인한 정보 (NEIS 급식 없음)');
  assert.doesNotMatch(source, /NEIS 교육정보/u);
  // Allergy text exactly as the school wrote it; staff allergen numbers are not turned into marks.
  assert.match(textOf(withSource), /알레르기 정보: 5\.6\.16 \(학교 표기\)/u);
  assert.doesNotMatch(textOf(withSource), /쌀밥 ⑤/u);
  const without = school.createSchoolResultCard(today([staffMeal(TODAY, 'LUNCH', '중식')]), {document: fakeDocument()});
  assert.deepEqual(byClass(without, 'lotbi-school-meal-badge').map(textOf), ['직원 확인 정보']);
  const unsafe = school.createSchoolResultCard(today([staffMeal(TODAY, 'LUNCH', '중식', 'http://127.0.0.1/meal')]), {document: fakeDocument()});
  assert.deepEqual(byClass(unsafe, 'lotbi-school-meal-badge').map(textOf), ['직원 확인 정보'], 'no safe page, no 공식자료 wording');
  const mixed = school.createSchoolResultCard(today([LONG_LUNCH, staffMeal(TODAY, 'DINNER', '석식')]), {document: fakeDocument()});
  assert.equal(textOf(byClass(mixed, 'lotbi-school-source')[0]), '출처: NEIS 교육정보 개방 포털 · 표시된 일부는 직원 확인 정보');
  const week = school.createSchoolResultCard(weekResult(), {document: fakeDocument()});
  assert.deepEqual(byClass(week, 'lotbi-school-meal-badge').map(textOf), ['학교 공식자료 기준']);
});

await check('FOLLOWUP_TOMORROW_PASS: "내일은?" keeps the saved school; unrelated short questions do not', async () => {
  for (const text of ['내일은?', '내일은요?', '그럼 내일은?', '금요일은요?', '모레는', '10월 12일은?']) {
    assert.deepEqual(school.schoolContextForMessage(text, SEOWON), SEOWON, text);
  }
  for (const text of ['내일 날씨는?', '내일 회의 잡아줘', '안녕', '전주 맛집']) {
    assert.equal(school.schoolContextForMessage(text, SEOWON), null, text);
  }
  assert.equal(school.schoolContextForMessage('내일은?', null), null);
});

await check('FOLLOWUP_WEEK_PASS: [이번 주 급식] asks for the week, only when that week has more', async () => {
  const asked = [];
  const card = school.createSchoolResultCard(today([LONG_LUNCH]), {document: fakeDocument(), onAsk: text => asked.push(text)});
  const [week] = byClass(card, 'lotbi-school-weekly');
  assert.equal(week.tag, 'button');
  assert.equal(week.textContent, '이번 주 급식');
  assert.deepEqual(asked, [], 'rendering asks nothing');
  week.listeners.click();
  assert.deepEqual(asked, ['이번 주 급식 보여줘']);
  assert.deepEqual(school.schoolContextForMessage('이번 주 급식 보여줘', SEOWON), SEOWON);
  assert.deepEqual(school.schoolContextForMessage('이번 주 전체', SEOWON), SEOWON);
  const none = school.createSchoolResultCard(today([LONG_LUNCH], {more: false}), {document: fakeDocument()});
  assert.equal(byClass(none, 'lotbi-school-weekly').length, 0);
  const nextWeek = school.createSchoolResultCard(
    today([], {week: '2026-10-12', target: '2026-10-12', label: '모레 10월 12일(월)'}), {document: fakeDocument()},
  );
  assert.equal(byClass(nextWeek, 'lotbi-school-weekly')[0].textContent, '다음 주 급식');
  assert.equal(byClass(nextWeek, 'lotbi-school-weekly')[0].dataset.schoolPrompt, '다음 주 급식 보여줘');
});

await check('an empty day says so in one line and still offers the week; stale answers say they are recent', async () => {
  const empty = school.createSchoolResultCard(
    {...today([], {target: '2026-10-09', label: '내일 10월 9일(금)'}), empty_reason: 'NO_DATA', allergen_legend: {}},
    {document: fakeDocument()},
  );
  assert.match(textOf(empty), /이 날은 급식 정보가 없어요\./u);
  assert.doesNotMatch(textOf(empty), /중식|Kcal|알레르기/u);
  assert.equal(byClass(empty, 'lotbi-school-weekly').length, 1);
  const stale = school.createSchoolResultCard({...today([LONG_LUNCH]), freshness: 'STALE_CACHE'}, {document: fakeDocument()});
  assert.match(textOf(stale), /NEIS 연결이 원활하지 않아 최근에 확인한 급식이에요\./u);
});

await check('older Core answers (no meal_summary / weekly / source_type) still render as NEIS meals', async () => {
  const legacy = result('MEAL', {range: {from: '2026-10-01', to: '2026-10-01', label: '오늘 10월 1일(목)'}, today: undefined,
    meals: [{date: '2026-10-01', meal_code: '2', meal_name: '중식', calories: '635.0 Kcal', nutrition: [],
      dishes: [{name: '친환경쌀영양잡곡밥', allergens: [5]}]}], allergen_legend: {'5': '대두'}});
  const card = school.createSchoolResultCard(legacy, {document: fakeDocument()});
  assert.match(textOf(card), /10월 1일\(목\) 중식/u);
  assert.match(textOf(card), /출처: NEIS 교육정보 개방 포털/u);
  assert.equal(byClass(card, 'lotbi-school-weekly').length, 0);
});

// ------------------------------------------------------- real browser layout --

const PORT = 4293;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'MOBILE_360', width: 360, height: 780, mobile: true},
  {label: 'MOBILE_375', width: 375, height: 812, mobile: true},
  {label: 'MOBILE_390', width: 390, height: 844, mobile: true},
  {label: 'MOBILE_412', width: 412, height: 915, mobile: true},
  {label: 'DESKTOP', width: 1280, height: 900, mobile: false},
];

const LONG_SCHOOL = {...SEOWON, name: '전주서원초등학교'};
const CANDIDATES = result('SCHOOL_CANDIDATES', {school: null, range: null,
  candidates: [{...LONG_SCHOOL, office_name: '전북특별자치도교육청', address: '전북특별자치도 전주시 완산구'}],
  resume_text: '전주서원초 급식 알려줘'});
const TODAY_ANSWER = today([LONG_LUNCH, staffMeal(TODAY, 'DINNER', '석식', 'https://www.sewon.es.kr/meal/1008')], {
  links: {
    homepage_url: 'https://www.sewon-elementary-school-official-homepage.es.kr/index.do?menu=main',
    homepage_source: 'NEIS',
    meal_source_url: 'https://www.sewon-elementary-school-official-homepage.es.kr/board/meal/list.do?category=lunch',
  },
});
const WEEK_ANSWER = weekResult();
const TOMORROW_ANSWER = {...today([], {target: '2026-10-09', label: '내일 10월 9일(금)'}), empty_reason: 'NO_DATA', allergen_legend: {}};

function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime);
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const ANSWERS = ${JSON.stringify({candidates: CANDIDATES, today: TODAY_ANSWER, week: WEEK_ANSWER, tomorrow: TOMORROW_ANSWER})};
const out = document.getElementById('school-meal-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 60000);
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  const sent = [];
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(String(init && init.body || '{}'));
      sent.push({text: body.text, school: body.client_context && body.client_context.school || null,
        recent: (body.recent_context || []).length});
      const key = body.text === '내일은?' ? 'tomorrow' : body.text === '이번 주 급식 보여줘' ? 'week'
        : (body.client_context && body.client_context.school) ? 'today' : 'candidates';
      const school_result = ANSWERS[key];
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,
        status: key === 'candidates' ? 'FOLLOW_UP_REQUIRED' : 'ANSWERED',
        assistant_text: key === 'candidates' ? '전주서원초등학교(전북특별자치도교육청)가 맞으면 선택해 주세요.' : '급식 정보예요.',
        response_mode:'SCHOOL_READONLY',correlation_id:'req_schoolmeal01_'+sent.length,
        intent:{action:'SCHOOL_LOOKUP',domain:'LIFE_SCHOOL',kind:school_result.kind},
        follow_up:{required:key === 'candidates',action:'SCHOOL_LOOKUP',automatic_execution:false},
        routing:{route:'SCHOOL_READONLY',ai_calls:0},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
          order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        school_result,retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=schoolmeal01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<600;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const cards = () => document.querySelectorAll('.lotbi-school-card');
  const nthCard = n => wait(() => cards().length >= n ? cards()[n - 1] : null, 'card '+n);
  const ask = async text => {
    const field = document.getElementById('lotbi-prompt');
    field.value = text;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  };
  await ask('전주서원초 급식 알려줘');
  const candidates = await nthCard(1);
  candidates.querySelector('.lotbi-school-candidate').click();
  const todayCard = await nthCard(2);
  await new Promise(r=>setTimeout(r,300));
  todayCard.querySelector('.lotbi-school-weekly').click();
  const weekCard = await nthCard(3);
  await new Promise(r=>setTimeout(r,500));
  await ask('내일은?');
  const tomorrowCard = await nthCard(4);
  await new Promise(r=>setTimeout(r,300));

  const box = node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r,g,b]) => { const f = c => { c/=255; return c <= .03928 ? c/12.92 : Math.pow((c+.055)/1.055, 2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0,3); } return [255,255,255]; };
  const contrast = node => { const fg = parse(getComputedStyle(node).color).slice(0,3), bg = bgOf(node); const [a,b] = [lum(fg), lum(bg)].sort((x,y)=>y-x); return (a+.05)/(b+.05); };
  const theme = mode => {
    document.body.dataset.siteTheme = mode;
    const dish = todayCard.querySelector('.lotbi-school-dish'), src = todayCard.querySelector('.lotbi-school-source');
    const badge = todayCard.querySelector('.lotbi-school-meal-badge'), day = weekCard.querySelector('.lotbi-school-day.is-today');
    return {dish: contrast(dish), source: contrast(src), badge: contrast(badge), todayDay: contrast(day.querySelector('.lotbi-school-date')),
      text: getComputedStyle(dish).color};
  };
  const actions = card => [...card.querySelectorAll('.lotbi-school-links > *')].map(node => ({
    tag: node.tagName, text: (node.textContent||'').trim(), href: node.getAttribute('href')||'', ...box(node),
  }));
  const overflow = card => [...card.querySelectorAll('*')].filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && (r.right > card.getBoundingClientRect().right + 1 || r.x < card.getBoundingClientRect().x - 1); }).map(node => node.className || node.tagName).slice(0, 5);
  const title = todayCard.querySelector('.lotbi-school-card-title');
  const summary = todayCard.querySelector('.lotbi-school-more summary');
  const light = theme('light');
  const dark = theme('dark');
  out.textContent = JSON.stringify({
    ok:true,
    viewport:{w:innerWidth,scroll:document.documentElement.scrollWidth},
    sent,
    today:{card:box(todayCard), actions:actions(todayCard), dishes:todayCard.querySelectorAll('.lotbi-school-meal')[0].querySelectorAll(':scope > .lotbi-school-dishes > li').length,
      title:{text:title.textContent, scroll:title.scrollWidth, client:title.clientWidth}, summary:box(summary),
      badges:[...todayCard.querySelectorAll('.lotbi-school-meal-badge')].map(n => n.textContent),
      source:todayCard.querySelector('.lotbi-school-source')?.textContent||'', overflow:overflow(todayCard),
      images:todayCard.querySelectorAll('img,video,picture,canvas').length},
    week:{card:box(weekCard), days:[...weekCard.querySelectorAll('.lotbi-school-day')].map(n => n.dataset.schoolDate),
      todayDays:[...weekCard.querySelectorAll('.lotbi-school-day.is-today')].map(n => n.dataset.schoolDate),
      actions:actions(weekCard), overflow:overflow(weekCard)},
    tomorrow:{text:tomorrowCard.textContent, actions:actions(tomorrowCard)},
    light, dark,
  });
} catch(e) { fail(e); }
</script><pre id="school-meal-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const probe = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (probe.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(testCase, innerRel) {
  return `<!doctype html><html><body style="margin:0"><iframe id="frame" src="about:blank" width="${testCase.width}" height="${testCase.height}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('frame'),out=document.getElementById('result');
  frame.src='/${innerRel}';
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('school-meal-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},80000);
  <\/script></body></html>`;
}

function run(browser, testCase, wrapperPath, wrapperRel, innerRel) {
  fs.writeFileSync(wrapperPath, wrapperMarkup(testCase, innerRel), 'utf8');
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors',
    `--user-agent=${testCase.mobile ? MOBILE_UA : DESKTOP_UA}`, '--window-size=1500,1000', '--force-device-scale-factor=1',
    '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=90000', '--dump-dom', ORIGIN + '/' + wrapperRel,
  ], {encoding: 'utf8', timeout: 170000, maxBuffer: 16 * 1024 * 1024});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  const open = '<pre id="result">', close = '</pre>';
  const start = result.stdout.indexOf(open), end = result.stdout.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error('result missing');
  const raw = result.stdout.slice(start + open.length, end)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
  return parsed;
}

const browser = browserPath();
const FIXTURE_DIR = fs.mkdtempSync(path.join(ROOT, 'scripts/.schoolmeal-'));
const FIXTURE_REL = 'scripts/' + path.basename(FIXTURE_DIR);
const innerRel = FIXTURE_REL + '/inner.html';
const wrapperRel = FIXTURE_REL + '/wrapper.html';
const python = process.platform === 'win32' ? 'python' : 'python3';
let server;
let flowChecked = false;
try {
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  server = spawn(python, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  waitServer();
  for (const testCase of CASES) {
    const reading = run(browser, testCase, path.join(ROOT, wrapperRel), wrapperRel, innerRel);
    if (!flowChecked) {
      flowChecked = true;
      await check('FOLLOWUP_TOMORROW / FOLLOWUP_WEEK in the real runtime: the saved school rides along, the week button asks', async () => {
        assert.deepEqual(reading.sent.map(item => item.text), ['전주서원초 급식 알려줘', '전주서원초 급식 알려줘', '이번 주 급식 보여줘', '내일은?']);
        assert.equal(reading.sent[0].school, null, 'nothing is sent before a school is chosen');
        for (const item of reading.sent.slice(1)) {
          assert.deepEqual(item.school, {office_code: 'P10', school_code: '8332169', name: '전주서원초등학교', kind: '초등학교'}, item.text);
        }
        assert.ok(reading.sent[3].recent >= 2, '"내일은?" carries the recent turns Core needs');
        assert.match(reading.tomorrow.text, /이 날은 급식 정보가 없어요\./u);
      });
    }
    await check(`${testCase.label}_PASS: fits, tappable, school name whole, no blank media`, async () => {
      const {today: card, week} = reading;
      assert.ok(reading.viewport.scroll <= reading.viewport.w, `${testCase.label}: page scrolls sideways ${reading.viewport.scroll} > ${reading.viewport.w}`);
      assert.ok(card.card.right <= reading.viewport.w + 0.5 && week.card.right <= reading.viewport.w + 0.5, `${testCase.label}: card wider than the screen`);
      assert.deepEqual(card.overflow, [], `${testCase.label}: today card overflow ${card.overflow}`);
      assert.deepEqual(week.overflow, [], `${testCase.label}: week card overflow ${week.overflow}`);
      assert.equal(card.title.text, '전주서원초등학교');
      assert.ok(card.title.scroll <= card.title.client + 1, `${testCase.label}: school name truncated`);
      assert.equal(card.dishes, 6, 'today shows 6 dishes, the rest behind 더 보기');
      assert.ok(card.summary.h >= 44, `${testCase.label}: 더 보기 height ${card.summary.h}`);
      assert.deepEqual(card.actions.map(item => item.text), ['이번 주 급식', '급식표 보기', '학교 홈페이지']);
      for (const action of [...card.actions, ...week.actions]) {
        assert.ok(action.h >= 44, `${testCase.label}: ${action.text} height ${action.h}`);
        assert.ok(action.x >= card.card.x - 0.5 && action.right <= Math.max(card.card.right, week.card.right) + 0.5, `${testCase.label}: ${action.text} overflows`);
      }
      assert.deepEqual(card.badges, ['학교 공식자료 기준']);
      assert.equal(card.source, '출처: NEIS 교육정보 개방 포털 · 표시된 일부는 직원 확인 정보');
      assert.equal(card.images, 0, 'no image/media placeholder');
      assert.deepEqual(week.days, ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-10', '2026-10-11']);
      assert.deepEqual(week.todayDays, ['2026-10-08']);
      assert.deepEqual(week.actions.map(item => item.text), ['급식표 보기', '학교 홈페이지']);
    });
    if (testCase.label === 'DESKTOP' || testCase.label === 'MOBILE_360') {
      await check(`${testCase.label}: LIGHT_MODE_PASS / DARK_MODE_PASS readable text in both themes`, async () => {
        for (const [mode, values] of [['light', reading.light], ['dark', reading.dark]]) {
          assert.ok(values.dish >= 4.5, `${mode}: dish contrast ${values.dish}`);
          assert.ok(values.source >= 3, `${mode}: source contrast ${values.source}`);
          assert.ok(values.badge >= 3, `${mode}: badge contrast ${values.badge}`);
          assert.ok(values.todayDay >= 3, `${mode}: today date contrast ${values.todayDay}`);
        }
        assert.notEqual(reading.light.text, reading.dark.text, 'the dark theme changes the text colour');
        const round = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(1)) : value]));
        console.log(`   contrast light=${JSON.stringify(round(reading.light))} dark=${JSON.stringify(round(reading.dark))}`);
      });
    }
  }
} finally {
  server?.kill();
  fs.rmSync(FIXTURE_DIR, {recursive: true, force: true});
}

console.log(`SCHOOL-MEAL-01 site contract: PASS (${passed} checks)`);
