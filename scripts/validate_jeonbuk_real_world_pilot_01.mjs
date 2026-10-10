// JEONBUK-PILOT-01 — 전북 맛집·음식 / 전북 행정기관 연락처 / 전북 의료기관 등록정보.
//
// 계약:
//  - 공식 기록 카드는 이미지 영역이 아예 없다. 사진이 없으면 글 카드다.
//  - 영업시간은 Core가 붙인 "등록 영업시간 …" 그대로만. "영업 중"·예약·좌석은 없다.
//  - 지도는 사용자가 설정한 지도앱(lotbi_default_map_provider_v1), 전화는 tel:, 팩스는 글자.
//  - 행정기관 연락처는 공개 사무실 번호만(휴대전화 번호는 보이지 않는다).
//  - 전북 의료기관 등록정보만 있는 카드는 "진료시간 정보 없음"이라고 쓰고, "진료 중"이라고 하지 않는다.
//  - 생활정보 홈 바로가기는 개수가 바뀌어도 마지막 줄에 빈칸이 없다.
//  - 360/375/390/412px 모바일과 데스크톱에서 넘치지 않고 44px 이상 누를 수 있다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regional = await import('../site-life-regional.js');
const {lifeLocationIntent} = await import('../site-life-location.js');
const {medicalStatusLines} = await import('../site-life-medical.js');
const {normalizePlaceResult, buildDefaultMapHref} = await import('../site-navigation.js');
const {LIFE_SHORTCUTS} = await import('../site-consumer-sections.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function fakeDocument() {
  const make = tag => ({
    tag, className: '', textContent: '', children: [], attributes: {}, dataset: {}, listeners: {},
    append(...items) { for (const item of items) this.children.push(item); },
    appendChild(item) { this.children.push(item); return item; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    get childNodes() { return this.children; },
  });
  return {cookie: '', createElement: make, createTextNode: value => ({tag: '#text', textContent: value, children: []})};
}

function all(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.children || []) all(child, predicate, out);
  return out;
}
const textOf = node => (node.textContent || '') + (node.children || []).map(textOf).join('');

const FOOD = {
  contract_id: 'CORE-REGIONAL-FOOD-RESULT-01', schema_version: 1, result_set_id: `rfrs_${'a1'.repeat(10)}`,
  region_scope: 'JEONBUK', basis_label: '전주시', total_matches: 7, coverage: 'COMPLETE',
  notice: '공식 등록정보 기준이며 실제 운영은 방문 전 확인해 주세요.',
  realtime_status_provided: false, booking_capability: false,
  results: [
    {result_id: 'food-1', name: '가상비빔밥집', address: '전라북도 전주시 덕진구 가상로 10', food_categories: ['비빔밥'], themes: [],
      phone: null, business_hours_label: '등록 영업시간 11:00~20:00', holiday: null, representative_menu: '전주비빔밥',
      latitude: null, longitude: null, coordinate_system: null, coordinate_authority: null, navigation_capability: false, image_url: null},
    {result_id: 'food-2', name: '성미당', address: '전북 전주시 완산구 전라감영5길 19-9', food_categories: ['비빔밥', '한옥마을 맛집'],
      themes: [{field: 'MOOD', label: '분위기', value: '조용'}], phone: '063-284-6595', business_hours_label: '등록 영업시간 09:30~21:30',
      holiday: '명절', representative_menu: '육회비빔밥, 비빔밥, 토종삼계탕, 떡국', latitude: 35.81722, longitude: 127.14533,
      coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true, distance_meters: 120},
    {result_id: 'food-3', name: '아주아주긴이름의가상전주한정식전문점본점(전주한옥마을점)', address:
      '전북특별자치도 전주시 완산구 아주아주긴가상한옥마을골목길이름 123-45, 가상빌딩 2층 (풍남동3가)', food_categories: ['한정식'], themes: [],
      phone: '1577-0072', business_hours_label: '등록 영업시간 11:00~22:00', holiday: '연중무휴',
      representative_menu: '한정식(코스요리), 떡갈비, 전주비빔밥, 콩나물국밥, 막걸리 한상', latitude: null, longitude: null,
      coordinate_system: null, coordinate_authority: null, navigation_capability: false},
  ],
  sources: [{code: 'JEONJU_FOOD', name: '전북특별자치도 전주시_전주음식', provider: '전북특별자치도 전주시',
    dataset_url: 'https://www.data.go.kr/data/3036596/openapi.do', updated_at: '2024-06-19', basis_date: null, status: 'OK'}],
};
const CONTACT = {
  contract_id: 'CORE-REGIONAL-CONTACT-RESULT-01', schema_version: 1, result_set_id: `rcrs_${'b2'.repeat(10)}`,
  region_scope: 'JEONBUK', public_contact_only: true, coverage: 'COMPLETE',
  notice: '공식 공개 자료 기준이라 번호가 바뀌었을 수 있어요. 연결이 안 되면 기관 대표전화로 문의해 주세요.',
  entries: [
    {entry_id: 'contact-1', kind: 'INSTITUTION', institution: '전북특별자치도청', unit: '직소민원실', division: null,
      main_phone: '063-280-2114', direct_phone: '063-280-2000', fax: null, address: '전북특별자치도 전주시 완산구 효자로 225',
      postal_code: '54968', basis_date: '2017-10-31', source: 'JEONBUK_CIVIL_CONTACTS'},
    {entry_id: 'contact-2', kind: 'DEPARTMENT', institution: '전북특별자치도청', unit: '사회복지정책과', division: '복지여성보건국',
      main_phone: null, direct_phone: '010-9999-0000', fax: '063-280-2419', address: null, basis_date: '2025-05-15', source: 'JEONBUK_DEPARTMENT_FAX'},
  ],
  sources: [
    {code: 'JEONBUK_CIVIL_CONTACTS', name: '전북특별자치도_관공서 및 공공기관 정보', provider: '전북특별자치도',
      dataset_url: 'https://www.data.go.kr/data/15011446/fileData.do', updated_at: '2025-08-15', basis_date: '2017-10-31', status: 'OK'},
    {code: 'JEONBUK_DEPARTMENT_FAX', name: '전북특별자치도_부서별 팩스번호', provider: '전북특별자치도',
      dataset_url: 'https://www.data.go.kr/data/15143408/fileData.do', updated_at: '2025-08-13', basis_date: '2025-05-15', status: 'OK'},
  ],
};
const REGISTRY_PLACE = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: `plrs_${'c3'.repeat(10)}`,
  provider_code: 'JEONBUK_MEDICAL', source: 'JEONBUK_MEDICAL_REGISTRY', query: '전주시 소아청소년과',
  results: [{result_id: 'place-1', place_id: 'jbmed:JB-0001', name: '가상튼튼소아청소년과의원', category: '의원 · 소아청소년과',
    address: '전북특별자치도 전주시 완산구 가상로 11, 2층 (효자동)', road_address: '전북특별자치도 전주시 완산구 가상로 11, 2층 (효자동)',
    latitude: null, longitude: null, coordinate_system: null, coordinate_authority: 'UNRESOLVED', phone: '063-555-0001', phone_verified: true,
    navigation_capability: false, open_now: null, business_hours: null, image_url: null,
    medical_registry: {source: 'JEONBUK_MEDICAL_REGISTRY', institution_type: '의원', departments: ['소아청소년과'],
      registry_state: 'ACTIVE', registry_only: true, conflicts: [], hours_provided: false}}],
};

await check('food result keeps only the contract: no image, hours only as labelled, safe phones, NAVER-only navigation', async () => {
  const result = regional.normalizeRegionalFoodResult(FOOD);
  assert.equal(result.results.length, 3);
  const [first, second] = result.results;
  assert.equal(first.phone, '');
  assert.equal(first.navigationCapable, false);
  assert.equal(second.navigationCapable, true);
  assert.equal(second.hoursLabel, '등록 영업시간 09:30~21:30');
  assert.ok(!('imageUrl' in second));
  const bad = structuredClone(FOOD);
  bad.results[0].business_hours_label = '지금 영업 중';
  bad.results[0].phone = '0632846595<script>';
  bad.results[1].coordinate_authority = 'JEONJU_FOOD_OFFICIAL';
  const cleaned = regional.normalizeRegionalFoodResult(bad);
  assert.equal(cleaned.results[0].hoursLabel, '');
  assert.equal(cleaned.results[0].phone, '');
  assert.equal(cleaned.results[1].navigationCapable, false);
  assert.equal(regional.normalizeRegionalFoodResult({...FOOD, result_set_id: 'plrs_x'}), null);
  assert.equal(regional.normalizeRegionalFoodResult({...FOOD, contract_id: 'CORE-PLACE-RESULT-01'}), null);
  const round = regional.compactRegionalFoodMeta(FOOD);
  assert.deepEqual(regional.normalizeRegionalFoodResult(round), result);
  assert.ok(!JSON.stringify(round).includes('image'));
});

await check('contact result shows public office numbers only and requires the public-contact flag', async () => {
  const result = regional.normalizeRegionalContactResult(CONTACT);
  assert.equal(result.entries[0].mainPhone, '063-280-2114');
  assert.equal(result.entries[1].directPhone, '');            // a mobile number is dropped
  assert.equal(result.entries[1].fax, '063-280-2419');
  assert.equal(regional.normalizeRegionalContactResult({...CONTACT, public_contact_only: false}), null);
  assert.deepEqual(regional.normalizeRegionalContactResult(regional.compactRegionalContactMeta(CONTACT)), result);
});

await check('food card: no media element, official source and notice, tel + the default map app', async () => {
  for (const [provider, prefix] of [['GOOGLE_MAPS', 'https://www.google.com/maps'], ['KAKAO_NAVI', 'https://map.kakao.com'], ['NAVER_MAP', 'https://map.naver.com']]) {
    const doc = fakeDocument();
    const card = regional.createRegionalFoodCard(FOOD, {document: doc, mapProvider: provider, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140'});
    assert.equal(all(card, node => /media|image|photo/u.test(node.className) || node.tag === 'img').length, 0);
    const maps = all(card, node => node.dataset?.action === 'map');
    assert.equal(maps.length, 3);
    for (const map of maps) {
      assert.equal(map.dataset.mapProvider, provider);
      assert.ok(map.href.startsWith(prefix), `${provider}: ${map.href}`);
      assert.equal(map.target, '_blank');
      assert.equal(map.rel, 'noopener noreferrer');
    }
    const place = {name: '성미당', address: '전북 전주시 완산구 전라감영5길 19-9', latitude: 35.81722, longitude: 127.14533, navigationCapable: true};
    assert.equal(maps[1].href, buildDefaultMapHref(provider, place, {userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140'}));
    const phones = all(card, node => node.dataset?.action === 'phone');
    assert.deepEqual(phones.map(node => node.href), ['tel:0632846595', 'tel:15770072']);
    const text = textOf(card);
    assert.match(text, /출처: 전북특별자치도 전주시 공공데이터 「전북특별자치도 전주시_전주음식」/u);
    assert.match(text, /공식 등록정보 기준이며 실제 운영은 방문 전 확인해 주세요\./u);
    assert.match(text, /공식 자료에 모두 7곳이 등록돼 있어요/u);
    for (const claim of ['영업 중', '예약', '좌석']) assert.ok(!text.includes(claim), claim);
  }
});

await check('contact card: tel for office numbers, fax as text, basis dates in the source line', async () => {
  const card = regional.createRegionalContactCard(CONTACT, {document: fakeDocument()});
  const phones = all(card, node => node.dataset?.action === 'phone');
  assert.deepEqual(phones.map(node => node.href), ['tel:0632802114', 'tel:0632802000']);
  const faxes = all(card, node => node.className === 'lotbi-regional-fax');
  assert.equal(faxes.length, 1);
  assert.equal(faxes[0].href, undefined);
  const text = textOf(card);
  assert.ok(!text.includes('010-9999-0000'));
  assert.match(text, /「전북특별자치도_관공서 및 공공기관 정보」 2017-10-31 기준/u);
  assert.match(text, /「전북특별자치도_부서별 팩스번호」 2025-05-15 기준/u);
});

await check('registry-only medical card says there are no hours and never "진료 중"', async () => {
  const place = normalizePlaceResult(REGISTRY_PLACE).results[0];
  assert.equal(place.medicalStatus, null);
  const lines = medicalStatusLines(place);
  assert.deepEqual(lines.map(line => line.state), ['REGISTRY', 'REGISTRY_NO_HOURS']);
  assert.equal(lines[0].text, '전북 의료기관 등록정보 · 의원 · 소아청소년과');
  assert.ok(lines.every(line => !/진료 중|운영 중/u.test(line.text)));
  const closed = structuredClone(REGISTRY_PLACE);
  Object.assign(closed.results[0].medical_registry, {registry_only: false, registry_state: 'CLOSED_IN_REGISTRY'});
  assert.deepEqual(medicalStatusLines(normalizePlaceResult(closed).results[0]).map(line => line.state), ['REGISTRY', 'REGISTRY_CONFLICT']);
  const forged = structuredClone(REGISTRY_PLACE);
  forged.results[0].medical_registry.hours_provided = true;
  assert.equal(normalizePlaceResult(forged).results[0].medicalRegistry, null);
});

await check('the 전북 맛집·음식 entry builds the sentence Core reads; location only for 내 주변', async () => {
  // Right after 지역생활정보, before 내 아이 학교·유치원 (REGIONAL-INFO-APPROVED-UX-RESTORE-P0:
  // 유치원·학교 now opens from inside 내 아이 학교·유치원).
  assert.deepEqual(LIFE_SHORTCUTS.slice(-3).map(item => item.label), ['지역생활정보', '전북 맛집·음식', '내 아이 학교·유치원']);
  assert.equal(regional.buildJeonbukFoodPrompt({}), '전북 맛집 알려줘');
  assert.equal(regional.buildJeonbukFoodPrompt({region: '전주', food: '비빔밥'}), '전북 전주 비빔밥 맛집 알려줘');
  assert.equal(regional.buildJeonbukFoodPrompt({region: '완산구에서'}), '전북 완산구 맛집 알려줘');
  assert.equal(regional.buildJeonbukFoodPrompt({nearby: true}), '근처 전북 맛집 알려줘');
  assert.equal(regional.buildJeonbukFoodPrompt({theme: 'kids'}), '전북 아이랑 가기 좋은 테마 음식점 알려줘');
  assert.equal(regional.buildJeonbukFoodPrompt({food: '막걸리'}), '전북 막걸리집 알려줘');
  assert.equal(lifeLocationIntent('근처 전북 맛집 알려줘'), true);
  assert.equal(lifeLocationIntent('전북 맛집 알려줘'), false);
  assert.equal(lifeLocationIntent('전주 맛집 알려줘'), false);
  assert.equal(lifeLocationIntent('전북 전주 비빔밥 맛집 알려줘'), false);
});

// ---------------------------------------------------------------- browser --

const PORT = 4293;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '360', width: 360, height: 800, mobile: true},
  {label: '375', width: 375, height: 812, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: 'desktop', width: 1280, height: 900, mobile: false},
];

function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime);
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const FOOD = ${JSON.stringify(FOOD)};
const CONTACT = ${JSON.stringify(CONTACT)};
const REGISTRY_PLACE = ${JSON.stringify(REGISTRY_PLACE)};
const out = document.getElementById('jeonbuk-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 60000);
try {
  localStorage.clear();
  document.cookie = 'lotbi_default_map_provider_v1=GOOGLE_MAPS; path=/';
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  const sent = [];
  const base = (text, extra) => ({
    contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',assistant_text:text,correlation_id:'req_jeonbuk01_'+sent.length,
    follow_up:{required:false,automatic_execution:false},routing:{ai_calls:0},retry_safe:true,
    safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,
      payment_attempted:false,reservation_created:false,merchant_execution_started:false},
    ...extra,
  });
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init?.body || '{}');
      sent.push(body.text || '');
      if (/연락처|전화/.test(body.text)) return json(base('완주군청 연락처예요.', {response_mode:'REGIONAL_CONTACT_READONLY',regional_contact_result:CONTACT}));
      if (/소아과/.test(body.text)) return json(base('전주시 기준 의료기관 등록정보예요.', {response_mode:'MEDICAL_PROVIDER_READONLY',place_result:REGISTRY_PLACE,
        medical_result:{contract_id:'CORE-MEDICAL-RESULT-01',schema_version:1,kind:'HOSPITAL',provider_state:'OK',notices:[],source:'JEONBUK_MEDICAL_REGISTRY'}}));
      return json(base('전주시 기준 공식 등록정보예요.', {response_mode:'REGIONAL_FOOD_READONLY',regional_food_result:FOOD,
        sources:[{type:'OFFICIAL_DATASET',title:'공공데이터포털 · 전북특별자치도 전주시_전주음식',url:'https://www.data.go.kr/data/3036596/openapi.do'}]}));
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=jeonbuk01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label) => {
    for (let i=0;i<600;i+=1) { const value=fn(); if(value) return value; await sleep(25); }
    throw new Error('timeout '+label);
  };
  const ask = async (text, selector, count) => {
    const field = document.getElementById('lotbi-prompt');
    field.value = text;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    return wait(() => { const nodes = document.querySelectorAll(selector); return nodes.length >= count ? nodes[count - 1] : null; }, selector+' '+count);
  };
  const box = node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
  const food = await ask('전주 비빔밥집 알려줘', '.lotbi-regional-card[data-regional-card=FOOD]', 1);
  await sleep(250);
  const contact = await ask('완주군청 연락처', '.lotbi-regional-card[data-regional-card=CONTACT]', 1);
  await sleep(250);
  const rail = await ask('전주 소아과 알려줘', '.lotbi-place-orbit', 1);
  await sleep(400);
  const actions = card => [...card.querySelectorAll('.lotbi-regional-action')].map(node => ({
    action:node.dataset.action, text:(node.textContent||'').trim(), href:node.getAttribute('href')||'',
    target:node.getAttribute('target')||'', rel:node.getAttribute('rel')||'', provider:node.dataset.mapProvider||'', ...box(node),
  }));
  const reading = {
    ok:true,
    viewport:{w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth},
    food:{card:box(food), media:food.querySelectorAll('img, picture, video, [class*=media], [class*=photo]').length,
      items:[...food.querySelectorAll('.lotbi-regional-item')].map(item => ({...box(item), scroll:item.scrollWidth-item.clientWidth})),
      actions:actions(food), text:food.textContent, cardScroll:food.scrollWidth-food.clientWidth,
      color:getComputedStyle(food).color},
    contact:{card:box(contact), actions:actions(contact), fax:[...contact.querySelectorAll('.lotbi-regional-fax')].map(node => ({tag:node.tagName, text:node.textContent})), text:contact.textContent},
    medical:{lines:[...rail.querySelectorAll('.lotbi-place-medical-line')].map(node => ({state:node.dataset.medicalState, text:node.textContent}))},
  };
  document.body.dataset.siteTheme = 'dark';
  await sleep(50);
  reading.food.darkColor = getComputedStyle(food).color;
  document.body.dataset.siteTheme = 'light';

  // 지역정보 home (REGIONAL-INFO-APPROVED-UX-RESTORE-P0 menu + 전북 + 전기차 충전소,
  // EV-CHARGER-NEARBY-LIST-P0): nine shortcuts, no empty cell in any row (and
  // still none with eight, i.e. if the 전북 card were ever taken out).
  document.querySelector('[data-consumer-section="life"]').click();
  const grid = await wait(() => { const g = document.querySelector('.consumer-workspace .consumer-shortcuts'); return g && g.children.length === 9 ? g : null; }, 'life grid');
  await sleep(300);
  const rows = () => {
    const g = box(grid), byRow = new Map();
    for (const button of grid.children) { const b = box(button); const key = Math.round(b.y); const row = byRow.get(key) || {x:Infinity,right:-Infinity,count:0}; row.x = Math.min(row.x, b.x); row.right = Math.max(row.right, b.right); row.count += 1; byRow.set(key, row); }
    return {grid:g, rows:[...byRow.values()]};
  };
  reading.life = {labels:[...grid.children].map(button => button.textContent.trim()), withFood:rows()};
  const foodShortcut = grid.querySelector('[data-life-shortcut="jeonbuk-food"]');
  foodShortcut.remove();
  await sleep(100);
  reading.life.withoutFood = rows();
  grid.insertBefore(foodShortcut, grid.querySelector('[data-life-shortcut="my-child"]'));
  // 전북 맛집·음식 detail: chips inside the panel; 전주 + 비빔밥 asks the right sentence.
  grid.querySelector('[data-life-shortcut="jeonbuk-food"]').click();
  const detail = await wait(() => document.querySelector('.consumer-life-detail[data-life-detail="jeonbuk-food"]'), 'food detail');
  await sleep(200);
  const panel = document.querySelector('.consumer-workspace .site-modal');
  reading.detail = {title:detail.querySelector('h3')?.textContent||'', panel:box(panel), panelScroll:panel.scrollWidth-panel.clientWidth,
    chips:[...detail.querySelectorAll('[data-regional-chip]')].map(chip => ({label:chip.textContent, ...box(chip)})),
    submit:box(detail.querySelector('form button[type=submit]')), note:detail.querySelector('.consumer-feature-note')?.textContent||''};
  detail.querySelector('[data-regional-chips="area"] [data-regional-chip="전주"]').click();
  detail.querySelector('[data-regional-chips="food"] [data-regional-chip="비빔밥"]').click();
  reading.detail.pressed = [...detail.querySelectorAll('[aria-pressed="true"]')].map(chip => chip.textContent);
  const before = sent.length;
  detail.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await sleep(600);
  reading.handoff = {composer:document.getElementById('lotbi-prompt').value, sent:sent.slice(before)};
  out.textContent = JSON.stringify(reading);
} catch(e) { fail(e); }
</script><pre id="jeonbuk-result">pending</pre>`;
  return html.replace(runtime[0], harness);
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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('jeonbuk-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},80000);
  <\/script></body></html>`;
}

function run(browser, testCase, wrapperPath, wrapperRel, innerRel) {
  fs.writeFileSync(wrapperPath, wrapperMarkup(testCase, innerRel), 'utf8');
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors',
    `--user-agent=${testCase.mobile ? MOBILE_UA : DESKTOP_UA}`, '--window-size=1500,1000', '--force-device-scale-factor=1',
    '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=90000', '--dump-dom', ORIGIN + '/' + wrapperRel,
  ], {encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024});
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

function assertRowsFilled(label, layout) {
  for (const row of layout.rows) {
    assert.ok(Math.abs(row.x - layout.grid.x) <= 1.5 && Math.abs(row.right - layout.grid.right) <= 1.5,
      `${label}: a row leaves an empty cell ${JSON.stringify(row)} in ${JSON.stringify(layout.grid)}`);
  }
}

const browser = browserPath();
const FIXTURE_DIR = fs.mkdtempSync(path.join(ROOT, 'scripts/.jeonbuk-'));
const FIXTURE_REL = 'scripts/' + path.basename(FIXTURE_DIR);
const innerRel = FIXTURE_REL + '/inner.html';
const wrapperRel = FIXTURE_REL + '/wrapper.html';
let server;
try {
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  waitServer();
  for (const testCase of CASES) {
    await check(`${testCase.label}${testCase.mobile ? 'px' : ''}: compact official cards fit, tap targets 44px, map app, life grid without gaps, food entry hands off`, async () => {
      const r = run(browser, testCase, path.join(ROOT, wrapperRel), wrapperRel, innerRel);
      const where = testCase.label;
      assert.ok(r.viewport.scroll <= r.viewport.w, `${where}: page scrolls sideways ${r.viewport.scroll} > ${r.viewport.w}`);
      // Food card.
      assert.equal(r.food.media, 0, `${where}: a media element in the food card`);
      assert.ok(r.food.card.right <= r.viewport.w + 0.5 && r.food.card.x >= -0.5, `${where}: food card off screen`);
      assert.ok(r.food.cardScroll <= 0, `${where}: food card scrolls sideways`);
      for (const item of r.food.items) {
        assert.ok(item.scroll <= 0, `${where}: an item scrolls sideways`);
        assert.ok(item.h < r.viewport.h * 0.6, `${where}: one record takes ${item.h}px of a ${r.viewport.h}px screen`);
      }
      const foodActions = r.food.actions;
      assert.deepEqual(foodActions.map(action => action.action), ['map', 'phone', 'map', 'phone', 'map']);
      for (const action of foodActions) {
        assert.ok(action.h >= 44, `${where}: ${action.text} height ${action.h}`);
        assert.ok(action.x >= r.food.card.x - 0.5 && action.right <= r.food.card.right + 0.5, `${where}: ${action.text} overflows the card`);
        if (action.action === 'map') {
          assert.equal(action.provider, 'GOOGLE_MAPS');
          assert.ok(action.href.startsWith('https://www.google.com/maps'), action.href);
          assert.equal(action.target, '_blank');
          assert.equal(action.rel, 'noopener noreferrer');
        } else {
          assert.match(action.href, /^tel:\d+$/u);
        }
      }
      assert.match(r.food.text, /출처: 전북특별자치도 전주시 공공데이터 「전북특별자치도 전주시_전주음식」/u);
      assert.match(r.food.text, /공식 등록정보 기준이며 실제 운영은 방문 전 확인해 주세요/u);
      assert.notEqual(r.food.color, r.food.darkColor, `${where}: dark theme does not reach the card text`);
      // Contact card.
      assert.deepEqual(r.contact.actions.map(action => action.text), ['대표 063-280-2114', '직통 063-280-2000']);
      for (const action of r.contact.actions) {
        assert.ok(action.h >= 44 && action.right <= r.contact.card.right + 0.5, `${where}: contact action ${action.text}`);
      }
      assert.deepEqual(r.contact.fax, [{tag: 'SPAN', text: '팩스 063-280-2419'}]);
      assert.ok(!r.contact.text.includes('010-9999-0000'), `${where}: a mobile number is shown`);
      // Registry-only medical card.
      assert.deepEqual(r.medical.lines.map(line => line.state), ['REGISTRY', 'REGISTRY_NO_HOURS']);
      assert.ok(r.medical.lines.every(line => !/진료 중/u.test(line.text)));
      // 생활정보 home grid.
      assert.deepEqual(r.life.labels, ['병원·응급실', '약국', '축제·행사', '지역뉴스', '온누리상품권·지역화폐', '지역생활정보', '전북 맛집·음식', '내 아이 학교·유치원']);
      assertRowsFilled(`${where} eight`, r.life.withFood);
      assertRowsFilled(`${where} seven without 전북`, r.life.withoutFood);
      // 전북 맛집·음식 detail.
      assert.equal(r.detail.title, '전북 맛집·음식');
      assert.ok(r.detail.panelScroll <= 0, `${where}: the panel scrolls sideways`);
      for (const chip of r.detail.chips) {
        assert.ok(chip.x >= r.detail.panel.x - 0.5 && chip.right <= r.detail.panel.right + 0.5, `${where}: chip ${chip.label} outside the panel`);
        assert.ok(chip.h >= 32, `${where}: chip ${chip.label} height ${chip.h}`);
      }
      assert.ok(r.detail.submit.h >= 44, `${where}: submit height ${r.detail.submit.h}`);
      assert.deepEqual(r.detail.pressed, ['전주', '비빔밥']);
      assert.match(r.detail.note, /공식 공공데이터/u);
      const prompt = '전북 전주 비빔밥 맛집 알려줘';
      // Like every life form but 유치원·학교 (LIFE-MEDICAL-AUTO-SEARCH-01): sent
      // at once, nothing left in the composer to send again.
      assert.ok(r.handoff.sent.includes(prompt) && r.handoff.composer === '', `${where}: handoff ${JSON.stringify(r.handoff)}`);
    });
  }
} finally {
  server?.kill();
  fs.rmSync(FIXTURE_DIR, {recursive: true, force: true});
}

console.log(`JEONBUK-PILOT-01 site contract: PASS (${passed} checks)`);
