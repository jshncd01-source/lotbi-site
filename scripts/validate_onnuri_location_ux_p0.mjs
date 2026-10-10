// ONNURI-MERCHANT-LOCATION-UX-P0 — 온누리상품권 가맹점: 내 주변(반경) / 지역 선택,
// compact responsive cards, the user's map app, verified phone.
// ONNURI-REMOVE-RELATION-MAP-01: the tile-less 위치 관계도 block is gone (owner decision
// 2026-10-10); every case asserts it is absent, the list/distance/map links stay.
//
// Node part: response/URL contract and the map-preference reading.
// Browser part: the real app (index.html) with Core answered in the page by a
// model of the new Core contract (radius, coverage, empty reasons, regions with
// 시장·상점가), real touch/mouse input through the DevTools protocol on
// 360/375/390/412 phones, a 768 tablet and a 1280 desktop, light and dark.
// With ONNURI_REAL_CORE=http://127.0.0.1:<port> the page talks to a real local
// Core instead (real-data run; not part of CI).
// Viewport emulation only — not a device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  ONNURI_DEFAULT_RADIUS,
  ONNURI_PAGE_SIZE,
  ONNURI_RADII,
  mapPreferenceNote,
  normalizeOnnuriMerchant,
  normalizeOnnuriRegions,
  normalizeOnnuriSearch,
  onnuriRegionsUrl,
  onnuriSearchUrl,
  readMapPreference,
} from '../site-life-onnuri.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ID = n => String(n).padStart(40, '0').slice(-40);
const REAL_CORE = process.env.ONNURI_REAL_CORE || '';

// ── Node: contract ──────────────────────────────────────────────────────
{
  assert.equal(ONNURI_PAGE_SIZE, 12);
  assert.deepEqual(ONNURI_RADII, [1000, 3000, 5000, 10000, 25000]);
  assert.equal(ONNURI_DEFAULT_RADIUS, 5000);

  const near = new URL(onnuriSearchUrl({latitude: 35.17964, longitude: 129.07561, radius: 3000, sido: '부산', market: '부전시장'}));
  assert.equal(near.searchParams.get('latitude'), '35.18', 'rounded to ~100 m');
  assert.equal(near.searchParams.get('radius_meters'), '3000');
  assert.equal(near.searchParams.get('sido'), null, 'location and region are never mixed');
  assert.equal(near.searchParams.get('market'), null);
  assert.equal(near.searchParams.get('limit'), '12');
  assert.equal(new URL(onnuriSearchUrl({latitude: 35.1, longitude: 129.1, radius: 7000})).searchParams.get('radius_meters'), '5000', 'only the five options');
  const region = new URL(onnuriSearchUrl({sido: '부산광역시', sigungu: '부산진구', dong: '부전동', market: '부전시장'}));
  assert.equal(region.searchParams.get('radius_meters'), null);
  assert.equal(region.searchParams.get('market'), '부전시장');
  assert.equal(new URL(onnuriSearchUrl({sigungu: '부산진구'})).searchParams.get('sigungu'), null, 'no 시·군·구 without its 시·도');
  assert.equal(new URL(onnuriRegionsUrl({sido: '부산광역시', level: 'MARKET'})).searchParams.get('level'), 'MARKET');
  assert.equal(new URL(onnuriRegionsUrl({sido: '세종특별자치시', level: 'DONG'})).searchParams.get('level'), 'DONG');
  assert.equal(new URL(onnuriRegionsUrl({level: 'MARKET'})).searchParams.get('level'), null);

  const market = normalizeOnnuriMerchant({id: ID(1), name: '부전상회', address: '부산', geo_state: 'MARKET', location_source: 'PUBLIC_MARKET_STANDARD',
    latitude: 35.1632, longitude: 129.0609, distance_meters: 2264, market_name: '부전시장', market_address: '부산광역시 부산진구 중앙대로 783번길 23',
    phone: '051-123-4567', phone_source: 'STAFF_VERIFIED', phone_verified_on: '2026-10-09'});
  assert.equal(market.locationBasis, 'MARKET');
  assert.equal(market.phone, '051-123-4567');
  const unverifiedPhone = normalizeOnnuriMerchant({id: ID(2), name: 'A', address: '부산', phone: '051-123-4567'});
  assert.equal(unverifiedPhone.phone, '', 'a phone without staff verification is not shown');
  assert.equal(normalizeOnnuriMerchant({id: ID(3), name: 'A', address: '부산', phone: '1234', phone_source: 'STAFF_VERIFIED'}).phone, '');

  const empty = normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 1, availability: 'AVAILABLE', mode: 'NEARBY',
    items: [], total_count: 0, radius_meters: 1000, radius_mode: 'FIXED', empty_reason: 'NONE_WITHIN_RADIUS',
    nearest_distance_meters: 2264, suggested_radius_meters: 3000,
    coverage: {total_merchants: 9, located_merchants: 7, located_building: 0, located_market: 7, unlocated_merchants: 2,
      market_reference: {source_date: '2025-11-10'}}});
  assert.equal(empty.emptyReason, 'NONE_WITHIN_RADIUS');
  assert.equal(empty.suggestedRadiusMeters, 3000);
  assert.equal(empty.coverage.unlocated, 2);
  assert.equal(empty.coverage.referenceDate, '2025-11-10');
  assert.equal(normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 2}), null, 'unknown schema rejected');
  const legacy = normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 1, availability: 'AVAILABLE', items: [], total_count: 0});
  assert.equal(legacy.coverage, null, 'an older Core without coverage still works');
  assert.equal(legacy.pageLimitReached, false);
  assert.equal(normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 1, availability: 'AVAILABLE', items: [],
    total_count: 9000, has_more: false, page_limit_reached: true}).pageLimitReached, true, 'paging stops at the API limit and says so');
  const regions = normalizeOnnuriRegions({contract_id: 'CORE-ONNURI-MERCHANT-REGIONS-01', level: 'SIGUNGU', regions: [],
    empty_reason: 'REGION_DATA_UNAVAILABLE', coverage: {total_merchants: 2, located_merchants: 0, with_region: 0, without_region: 2}});
  assert.equal(regions.emptyReason, 'REGION_DATA_UNAVAILABLE');
  assert.equal(regions.coverage.withoutRegion, 2);

  // The Account cookie, as web src/lib/location-preference.ts writes it.
  for (const provider of ['NAVER_MAP', 'KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS']) {
    assert.deepEqual(readMapPreference(`a=1; lotbi_default_map_provider_v1=${provider}; b=2`), {provider, state: 'SAVED'});
  }
  assert.deepEqual(readMapPreference(''), {provider: 'NAVER_MAP', state: 'DEFAULT'});
  assert.deepEqual(readMapPreference('lotbi_default_map_provider_v1=TMAP; lotbi_default_map_provider_v1=GOOGLE_MAPS'), {provider: 'NAVER_MAP', state: 'CONFLICT'});
  assert.deepEqual(readMapPreference('lotbi_default_map_provider_v1=KAKAO_NAVI; lotbi_default_map_provider_v1=KAKAO_NAVI'), {provider: 'NAVER_MAP', state: 'SAVED'});
  assert.deepEqual(readMapPreference('lotbi_default_map_provider_v1=BUS'), {provider: 'NAVER_MAP', state: 'UNKNOWN'});
  assert.match(mapPreferenceNote({provider: 'NAVER_MAP', state: 'CONFLICT'}, {userAgent: ''}), /둘 이상 저장돼 있어 네이버지도로 열어요/u);
  assert.match(mapPreferenceNote({provider: 'KAKAO_NAVI', state: 'SAVED'}, {userAgent: ''}), /카카오내비\(내 설정\)/u);
  assert.match(mapPreferenceNote({provider: 'NAVER_MAP', state: 'DEFAULT'}, {userAgent: ''}), /기본값/u);

  const source = read('site-life-onnuri.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|innerHTML|indexedDB|document\.cookie\s*=/u, 'nothing stored, no HTML injection');
  assert.doesNotMatch(source, /oapi\.map\.naver|dapi\.kakao\.com\/v2\/maps|maps\.googleapis|apis\.openapi\.sk\.com|tile\.openstreetmap|maps\.apigw\.ntruss/u,
    'no map SDK, tile server or key in the Onnuri screen');
  assert.doesNotMatch(source, /onnuriRelationMap|createElementNS|onnuri-map-(?:svg|pin|range|me|caption|selection|canvas)|배경 지도 없이|위쪽이 북쪽|위치 관계도'/u,
    'ONNURI-REMOVE-RELATION-MAP-01: no relation-map sketch code left in the Onnuri screen');
  assert.doesNotMatch(source, /onnuri\.gift|cdn\.onnuri|🎟|#EB6620/iu, 'no copied official logo / brand asset');
  assert.match(read('index.html'), /site-life-onnuri\.css\?v=aset-/u);
}

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/opt/pw-browsers/chromium',
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the Onnuri location UX validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const ALL_CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA, columns: 1, full: true},
  {label: 'mobile-375x812-dark', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, columns: 1, dark: true},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, columns: 1},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, columns: 1},
  {label: 'tablet-768x1024', width: 768, height: 1024, mobile: true, userAgent: IPHONE_UA.replace('iPhone', 'iPad'), columns: 2},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, columns: 3, full: true},
  {label: 'desktop-1280x900-dark', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, columns: 3, dark: true},
];
const CASES = process.env.ONNURI_CASES ? ALL_CASES.filter(item => process.env.ONNURI_CASES.split(',').includes(item.label)) : ALL_CASES;

// A model of Core's public read (app/onnuri_merchants.py after this P0) on test
// shops: region-only 2026-style rows placed at real markets, a building shop,
// unplaced shops, one long name, one staff-verified phone.
const MOCK = String.raw`
const BUSAN = '부산광역시';
const M = {
  bujeon: {name:'부전시장', sigungu:'부산진구', dong:'부전동', lat:35.1632343, lng:129.0609058, address:'부산광역시 부산진구 중앙대로 783번길 23'},
  seomyeon: {name:'서면시장', sigungu:'부산진구', dong:'부전동', lat:35.155659, lng:129.0581395, address:'부산광역시 부산진구 중앙대로 680번길 21'},
  geoje: {name:'거제시장', sigungu:'연제구', dong:'거제동', lat:35.18, lng:129.072, address:'부산광역시 연제구 거제시장로 1'},
  gijang: {name:'기장시장', sigungu:'기장군', dong:'기장읍', lat:35.2436916, lng:129.2148692, address:'부산광역시 기장군 기장읍 읍내로104번길 16'},
  sejong: {name:'세종전통시장', sigungu:null, dong:'조치원읍', lat:36.5997885, lng:127.3006053, address:'세종특별자치시 조치원읍 조치원8길 1', sido:'세종특별자치시'},
};
const shops = [];
let n = 0;
const add = (o) => shops.push({id: String(++n).padStart(40,'0'), sido: BUSAN, items:'잡화', paper:true, digital:true, phone:null, ...o});
for (let i = 0; i < 14; i++) add({name:'테스트부전상회'+String(i+1).padStart(2,'0'), market:M.bujeon, items:['농산물','한식','수산물'][i%3]});
for (let i = 0; i < 6; i++) add({name:'테스트서면상회'+(i+1), market:M.seomyeon, items:'의류'});
for (let i = 0; i < 3; i++) add({name:'테스트거제상회'+(i+1), market:M.geoje, items:'반찬'});
add({name:'테스트기장상회', market:M.gijang, items:'건어물'});
add({name:'테스트건물카페', building:{lat:35.1830, lng:129.0790, sigungu:'연제구', dong:'연산동', address:'부산광역시 연제구 테스트대로 101'}, items:'커피', paper:false});
add({name:'테스트전화되는가게', market:M.geoje, items:'한식', phone:'051-123-4567'});
add({name:'아주아주긴이름의테스트가게입니다정말로이름이길어서카드가깨지지않는지확인하는가게명칭', market:M.bujeon, items:'아주 긴 품목 설명 농산물 수산물 축산물 가공식품 의류 신발 가정용품 음식점'});
for (let i = 0; i < 4; i++) add({name:'테스트골목가게'+(i+1), alley:'테스트골목형상점가'});
add({name:'테스트세종상회', sido:'세종특별자치시', market:M.sejong});
add({name:'테스트대전가게', sido:'대전광역시', alley:'테스트대전상점가'});
const hav = (a,b,c,d) => { const r=x=>x*Math.PI/180; const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2; return 2*6371000*Math.asin(Math.sqrt(h)); };
const point = s => s.building ? {lat:s.building.lat,lng:s.building.lng,basis:'BUILDING'} : s.market ? {lat:s.market.lat,lng:s.market.lng,basis:'MARKET'} : null;
const region = s => s.building ? {sigungu:s.building.sigungu,dong:s.building.dong} : s.market ? {sigungu:s.market.sigungu,dong:s.market.dong} : {sigungu:null,dong:null};
const marketName = s => s.market ? s.market.name : (s.alley || null);
const words = {FOOD:['한식','반찬','커피'],CAFE:['커피'],GROCERY:['농산물','수산물','건어물'],CLOTHING:['의류'],LIVING:['잡화']};
globalThis.__onnuri = {requests: [], notReady: false, failNext: 0, noData: false};
const source = {label:'소상공인시장진흥공단 전국 온누리상품권 가맹점 현황',source_date:'2026-07-31',synced_at:'2026-10-09T12:30:45+09:00'};
const coverage = (rows) => {
  const located = globalThis.__onnuri.noData ? 0 : rows.filter(point).length;
  return {scope:'ALL', total_merchants: rows.length, located_merchants: located, located_building: globalThis.__onnuri.noData ? 0 : rows.filter(s=>s.building).length,
    located_market: globalThis.__onnuri.noData ? 0 : rows.filter(s=>s.market).length, unlocated_merchants: rows.length - located,
    region_known_merchants: rows.filter(s=>region(s).sigungu||region(s).dong).length, market_reference:{source_date:'2025-11-10'}};
};
const view = (s, d) => {
  const p = globalThis.__onnuri.noData ? null : point(s); const r = region(s);
  return {id:s.id,name:s.name,market_name:marketName(s),address:s.building?s.building.address:(s.sido===BUSAN?'부산':s.sido.slice(0,2)),items:s.items,sido:s.sido,sigungu:r.sigungu,dong:r.dong,
    paper:s.paper,digital:s.digital,mobile:null,card:null,registered_year:2025,latitude:p?p.lat:null,longitude:p?p.lng:null,
    geo_state:p?(p.basis==='BUILDING'?'VERIFIED':'MARKET'):'UNVERIFIED',location_basis:p?p.basis:null,location_source:p?(p.basis==='BUILDING'?'GEOCODED':'PUBLIC_MARKET_STANDARD'):null,
    market_address:s.market?s.market.address:null,distance_meters:d==null?null:Math.round(d),
    phone:s.phone,phone_source:s.phone?'STAFF_VERIFIED':null,phone_verified_on:s.phone?'2026-10-09':null};
};
function onnuriResponse(url) {
  globalThis.__onnuri.requests.push(url.pathname + url.search);
  const p = url.searchParams;
  if (globalThis.__onnuri.failNext > 0) { globalThis.__onnuri.failNext -= 1; return null; }
  if (url.pathname.endsWith('/regions')) {
    const sido = p.get('sido'), sigungu = p.get('sigungu'), level = p.get('level');
    const base = {contract_id:'CORE-ONNURI-MERCHANT-REGIONS-01',schema_version:1,availability:'AVAILABLE',data_source:source};
    if (!sido) {
      const names = [...new Set(shops.map(s=>s.sido))];
      return {...base, level:'SIDO', regions: names.map(name=>({name,count:shops.filter(s=>s.sido===name).length})), coverage: coverage(shops)};
    }
    const inSido = shops.filter(s=>s.sido===sido);
    const cov = coverage(inSido); const withRegion = cov.region_known_merchants;
    const head = {...base, sido, no_sigungu_level: sido==='세종특별자치시', coverage:{...cov, with_region:withRegion, without_region:inSido.length-withRegion}};
    const count = (key) => { const m = new Map(); for (const s of inSido) { const k = key(s); if (k) m.set(k,(m.get(k)||0)+1); } return [...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,c])=>({name,count:c})); };
    if (level === 'MARKET') {
      const rows = inSido.filter(s=>!sigungu || region(s).sigungu===sigungu);
      const m = new Map(); for (const s of rows) { const k = marketName(s); if (k) m.set(k,(m.get(k)||0)+1); }
      return {...head, level:'MARKET', sigungu: sigungu||null, regions:[...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,c])=>({name,count:c,sigungu:(shops.find(s=>marketName(s)===name).market||{}).sigungu||null,located:Boolean(shops.find(s=>marketName(s)===name).market)}))};
    }
    if (!sigungu && level !== 'DONG') {
      const regions = sido==='세종특별자치시' ? [] : count(s=>region(s).sigungu);
      return {...head, level:'SIGUNGU', regions, ...(regions.length?{}:{empty_reason: sido==='세종특별자치시'?'NO_SIGUNGU_LEVEL':'REGION_DATA_UNAVAILABLE'})};
    }
    return {...head, level:'DONG', sigungu: sigungu||null, regions: count(s=>(!sigungu||region(s).sigungu===sigungu)?region(s).dong:null)};
  }
  if (globalThis.__onnuri.notReady) return {contract_id:'CORE-ONNURI-MERCHANT-SEARCH-01',schema_version:1,availability:'NOT_READY',mode:'NONE',items:[],total_count:0,has_more:false,next_offset:null,data_source:null};
  let rows = shops.slice();
  const nearby = p.has('latitude');
  if (p.get('category')) rows = rows.filter(s=>words[p.get('category')].some(w=>(s.items||'').includes(w)));
  if (p.get('accept')==='PAPER') rows = rows.filter(s=>s.paper===true);
  if (p.get('accept')==='DIGITAL') rows = rows.filter(s=>s.digital===true);
  const limit = Number(p.get('limit')||3), offset = Number(p.get('offset')||0);
  const base = {contract_id:'CORE-ONNURI-MERCHANT-SEARCH-01',schema_version:1,availability:'AVAILABLE',data_source:source,notice:'',digital_notice:'',available_radii:[1000,3000,5000,10000,25000]};
  if (nearby) {
    const lat = Number(p.get('latitude')), lng = Number(p.get('longitude')), radius = Number(p.get('radius_meters')||5000);
    const all = globalThis.__onnuri.noData ? [] : rows.filter(point).map(s=>({s,d:hav(lat,lng,point(s).lat,point(s).lng)})).sort((a,b)=>a.d-b.d||a.s.name.localeCompare(b.s.name));
    const inside = all.filter(x=>x.d<=radius);
    const page = inside.slice(offset, offset+limit);
    const hasMore = offset+page.length < inside.length;
    const out = {...base, mode:'NEARBY', location_used:true, radius_meters:radius, radius_mode:'FIXED', coverage:coverage(shops),
      items: page.map(x=>view(x.s,x.d)), total_count: inside.length, has_more: hasMore, next_offset: hasMore?offset+page.length:null};
    if (!page.length) {
      if (out.coverage.located_merchants === 0) out.empty_reason = 'LOCATION_DATA_UNAVAILABLE';
      else { out.empty_reason = 'NONE_WITHIN_RADIUS'; const nearest = all[0] && all[0].d <= 25000 ? Math.round(all[0].d) : null; out.nearest_distance_meters = nearest; out.suggested_radius_meters = [1000,3000,5000,10000,25000].find(r=>nearest!==null&&r>=nearest&&r>radius)||null; }
    }
    return out;
  }
  if (p.get('sido')) rows = rows.filter(s=>s.sido===p.get('sido'));
  if (p.get('sigungu')) rows = rows.filter(s=>region(s).sigungu===p.get('sigungu'));
  if (p.get('dong')) rows = rows.filter(s=>region(s).dong===p.get('dong'));
  if (p.get('market')) rows = rows.filter(s=>marketName(s)===p.get('market'));
  rows.sort((a,b)=>String(region(a).sigungu||'~').localeCompare(String(region(b).sigungu||'~'))||String(marketName(a)||'~').localeCompare(String(marketName(b)||'~'))||a.name.localeCompare(b.name));
  const page = rows.slice(offset, offset+limit);
  const hasMore = offset+page.length < rows.length;
  return {...base, mode: p.get('sido')?'REGION':'ALL', location_used:false, coverage: coverage(p.get('sido')?shops.filter(s=>s.sido===p.get('sido')):shops),
    items: page.map(s=>view(s,null)), total_count: rows.length, has_more: hasMore, next_offset: hasMore?offset+page.length:null, ...(page.length?{}:{empty_reason:'NO_MATCH'})};
}`;

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const route = REAL_CORE
    ? `if (parsed.pathname.startsWith('/v2/life/onnuri/')) { globalThis.__onnuri.requests.push(parsed.pathname + parsed.search); return nativeFetch('/__core' + parsed.pathname + parsed.search, {method: 'GET', cache: 'no-store', signal: init && init.signal}); }`
    : `if (parsed.pathname.startsWith('/v2/life/onnuri/')) { const body = onnuriResponse(parsed); return body ? json(body) : Promise.resolve(new Response('{}', {status: 500})); }`;
  const harness = `<script type="module">
const out = document.getElementById('onnuri-result');
try {
  localStorage.clear();
  ${MOCK}
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    ${route}
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=onnuriuxp0');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="onnuri-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const lum = c => { const m = String(c).match(/\\d+(\\.\\d+)?/g); if (!m) return null; const [r,g,b] = m.slice(0,3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); if (x === null || y === null) return null; return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const surface = workspace?.querySelector('.onnuri-surface');
  const visible = node => Boolean(node) && !node.closest('[hidden]') && node.getClientRects().length > 0;
  const cards = [...(surface?.querySelectorAll('.onnuri-card') || [])].map(card => {
    const title = card.querySelector('.onnuri-card-title');
    const style = getComputedStyle(card);
    return {
      id: card.dataset.onnuriMerchant, point: card.dataset.onnuriPoint || '', selected: card.classList.contains('is-selected'),
      name: title?.textContent || '', titleLines: title ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)) : 0,
      label: card.querySelector('.onnuri-card-label')?.textContent || '', distance: card.querySelector('.onnuri-card-distance')?.textContent || '',
      address: card.querySelector('.onnuri-card-address')?.textContent || '', basis: card.querySelector('.onnuri-card-basis')?.textContent || '',
      accept: card.querySelector('.onnuri-card-accept')?.textContent || '',
      links: [...card.querySelectorAll('a')].map(a => ({cls: a.className, action: a.dataset.mapAction || '', href: a.getAttribute('href') || '', text: a.textContent, box: box(a),
        icon: a.querySelector('img[data-map-icon]') ? {name: a.querySelector('img[data-map-icon]').dataset.mapIcon, loaded: a.querySelector('img[data-map-icon]').complete && a.querySelector('img[data-map-icon]').naturalWidth > 0, src: a.querySelector('img[data-map-icon]').getAttribute('src')} : null})),
      box: box(card), bg: style.backgroundColor, fg: style.color, titleContrast: title ? contrast(getComputedStyle(title).color, style.backgroundColor) : null,
      overflowX: card.scrollWidth - card.clientWidth, bgLum: lum(style.backgroundColor),
    };
  });
  const regions = Object.fromEntries([...(surface?.querySelectorAll('[data-onnuri-region]') || [])].map(s => [s.dataset.onnuriRegion, {visible: visible(s), disabled: s.disabled, value: s.value, options: [...s.options].map(o => o.value), box: box(s)}]));
  const tabs = Object.fromEntries([...(surface?.querySelectorAll('[data-onnuri-mode]') || [])].map(t => [t.dataset.onnuriMode, {selected: t.getAttribute('aria-selected') === 'true', box: box(t)}]));
  const radius = [...(surface?.querySelectorAll('[data-onnuri-radius]') || [])].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => Number(c.dataset.onnuriRadius));
  const pins = [...(surface?.querySelectorAll('.onnuri-map-pin') || [])].map(p => ({point: p.dataset.onnuriPoint, label: p.getAttribute('aria-label'), selected: p.classList.contains('is-selected'), box: box(p)}));
  return {
    open: Boolean(workspace), viewport: {w: innerWidth, h: innerHeight}, panel: box(panel), dark: matchMedia('(prefers-color-scheme: dark)').matches,
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    shortcuts: [...(workspace?.querySelectorAll('.consumer-shortcut') || [])].map(b => b.dataset.lifeShortcut),
    surface: Boolean(surface), tabs, radius, regions,
    nearbyVisible: visible(surface?.querySelector('.onnuri-nearby-panel')), regionVisible: visible(surface?.querySelector('.onnuri-region-panel')),
    scope: surface?.querySelector('.onnuri-scope')?.textContent || '',
    status: surface?.querySelector('.onnuri-status')?.textContent || '',
    coverage: surface?.querySelector('.onnuri-coverage')?.textContent || '',
    note: surface?.querySelector('.onnuri-location-note')?.textContent || '',
    regionNote: surface?.querySelector('.onnuri-region-note')?.textContent || '',
    settingsLink: surface?.querySelector('.onnuri-location-note a')?.getAttribute('href') || '',
    toRegion: visible(surface?.querySelector('.onnuri-to-region')),
    emptyButtons: [...(surface?.querySelectorAll('.onnuri-empty-actions:not([hidden]) button') || [])].map(b => ({text: b.textContent, expand: b.dataset.onnuriExpand || ''})),
    error: surface?.querySelector('.onnuri-error:not([hidden])')?.textContent || '',
    more: (() => { const m = surface?.querySelector('.onnuri-more'); return m && !m.hidden ? box(m) : null; })(),
    locate: box(surface?.querySelector('.onnuri-locate')),
    // ONNURI-REMOVE-RELATION-MAP-01: any trace of the removed sketch, visible or not.
    relationMap: Boolean(surface?.querySelector('.onnuri-map, .onnuri-map-svg, .onnuri-map-pin, .onnuri-map-caption, .onnuri-map-selection, svg')),
    relationText: /배경 지도 없이|위치 관계|위쪽이 북쪽/u.test(surface?.textContent || ''), pins,
    appNote: surface?.querySelector('.onnuri-map-app')?.textContent || '',
    source: surface?.querySelector('.onnuri-source')?.textContent || '',
    columns: (() => { const list = surface?.querySelector('.onnuri-results'); return list ? getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length : 0; })(),
    renderMs: Number(surface?.dataset.onnuriRenderMs || 'NaN'),
    statusContrast: (() => { const s = surface?.querySelector('.onnuri-status'); const c = surface?.querySelector('.onnuri-card'); return s && c ? contrast(getComputedStyle(s).color, getComputedStyle(c).backgroundColor) : null; })(),
    cards,
    requests: globalThis.__onnuri.requests.slice(),
  };
})()`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const core=${JSON.stringify(REAL_CORE)};
    const server=http.createServer((req,res)=>{
      if(core && req.url.startsWith('/__core/')){
        // Same-origin proxy to a local Core for the real-data run (Core CORS allows lotbiai.com only).
        http.get(core+req.url.slice(7),upstream=>{res.writeHead(upstream.statusCode,{'Content-Type':upstream.headers['content-type']||'application/json'});upstream.pipe(res);})
          .on('error',()=>{res.writeHead(502);res.end();});
        return;
      }
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

const BUSAN_CITY_HALL = {latitude: 35.1796, longitude: 129.0756};
const meters = value => value.endsWith('km') ? Number.parseFloat(value.replace(/[^0-9.]/gu, '')) * 1000 : Number.parseFloat(value.replace(/[^0-9.]/gu, ''));

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.ONNURI_SCREENSHOT_DIR || '';
  const measures = {};
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: testCase.dark ? 'dark' : 'light'}]});
    const probe = () => evaluate(PROBE);
    const waitState = async (predicate, label, timeoutMs = 20000) => {
      const started = Date.now();
      let last = null;
      for (;;) {
        last = await probe().catch(() => last);
        if (last && predicate(last)) return last;
        if (Date.now() - started > timeoutMs) {
          const brief = last && {scope: last.scope, status: last.status, note: last.note, regionNote: last.regionNote, appNote: last.appNote,
            cards: last.cards.map(card => [card.name, card.distance]).slice(0, 8), radius: last.radius, requests: last.requests.slice(-4), error: last.error};
          throw new Error(`timeout: ${label} ${JSON.stringify(brief)}`);
        }
        await sleep(100);
      }
    };
    const tap = async ({cx: x, cy: y}) => {
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
        await sleep(40);
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(40);
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
      }
      await sleep(200);
    };
    const reveal = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'}), true`);
      await sleep(150);
      return await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    };
    const select = async (key, value) => {
      await evaluate(`(() => { const s = document.querySelector('[data-onnuri-region="${key}"]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
      await sleep(300);
    };
    const shot = async (name, focus = '.onnuri-results') => {
      if (!shots) return;
      await evaluate(`document.querySelector(${JSON.stringify(focus)})?.scrollIntoView({block: 'start'}), true`).catch(() => null);
      await sleep(150);
      const {data} = await page('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const settled = state => state.status && !state.status.includes('찾는 중');
    const load = async ({cookies = [], geo = 'none', position = BUSAN_CITY_HALL} = {}) => {
      await cdp.send('Browser.resetPermissions', {});
      if (geo === 'grant') {
        await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
        await page('Emulation.setGeolocationOverride', {...position, accuracy: 20});
      } else if (geo === 'deny') {
        await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});
        await page('Emulation.clearGeolocationOverride');
      } else if (geo === 'fail') {
        await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
        await page('Emulation.setGeolocationOverride', {});                     // position unavailable
      } else {
        await page('Emulation.clearGeolocationOverride');
      }
      await page('Network.enable');
      await page('Network.clearBrowserCookies');
      if (testCase.dark) cookies = [...cookies, 'lotbi_theme_preference_v1=dark'];
      for (const cookie of cookies) await page('Network.setCookie', {name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: origin});
      await page('Page.navigate', {url: `${origin}/${innerRel}`});
      const ready = await waitFor(async () => {
        const value = await evaluate("document.getElementById('onnuri-result')?.textContent || 'pending'").catch(() => 'pending');
        return value !== 'pending' ? value : null;
      }, `${testCase.label}: harness`, 60000);
      const parsed = JSON.parse(ready);
      if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(async () => (await probe()).shortcuts.includes('onnuri'), `${testCase.label}: life shortcuts`);
      await sleep(200);
    };
    const openOnnuri = async (until = settled) => {
      await tap(await reveal('.consumer-workspace [data-life-shortcut="onnuri"]'));
      return await waitState(v => v.surface && until(v), `${testCase.label}: onnuri surface`, 30000);
    };
    const layout = (state, label) => {
      assert.ok(state.pageOverflowX <= 0, `${testCase.label} ${label}: no horizontal page scroll (${state.pageOverflowX})`);
      assert.ok(state.panelOverflowX <= 0, `${testCase.label} ${label}: panel does not scroll sideways (${state.panelOverflowX})`);
      if (state.cards.length) assert.equal(state.columns, testCase.columns, `${testCase.label} ${label}: ${testCase.columns} card column(s)`);
      for (const card of state.cards) {
        assert.ok(card.box.x >= 0 && card.box.right <= state.viewport.w + 0.5, `${testCase.label}: ${card.name} inside the viewport`);
        assert.ok(card.overflowX <= 0, `${testCase.label}: ${card.name} content fits the card`);
        assert.ok(card.titleLines <= 2, `${testCase.label}: long names are clamped (${card.titleLines})`);
        assert.equal(card.label, '온누리 가맹점');
        assert.ok(card.titleContrast === null || card.titleContrast >= 4.5, `${testCase.label}: title contrast ${card.titleContrast}`);
        for (const link of card.links) assert.ok(link.box.h >= 40, `${testCase.label}: ${link.text} touch target ${link.box.h}`);
      }
      if (testCase.dark) assert.ok(state.cards.every(card => card.bgLum !== null && card.bgLum < 0.2), `${testCase.label}: dark cards (${state.cards.map(card => card.bgLum)})`);
      else assert.ok(state.cards.every(card => card.bgLum === null || card.bgLum > 0.6), `${testCase.label}: light cards`);
      assert.ok(state.statusContrast === null || state.statusContrast >= 4.5, `${testCase.label}: status contrast ${state.statusContrast}`);
      if (state.cards.length && !REAL_CORE) {
        const heights = state.cards.map(card => card.box.h);
        assert.ok(Math.max(...heights) <= 300, `${testCase.label}: compact cards (${Math.max(...heights)}px)`);
      }
      for (const tab of Object.values(state.tabs)) assert.ok(tab.box.h >= 44, `${testCase.label}: mode tab touch target`);
    };

    // 1. No permission: 지역 선택, 전국 12곳, 더 보기 without duplicates, no distance.
    await load();
    let state = await openOnnuri();
    assert.equal(state.tabs.region.selected, true);
    assert.equal(state.regionVisible, true);
    assert.equal(state.regions.sigungu.visible, false, 'no empty 시·군·구 picker before a 시·도');
    assert.equal(state.cards.length, REAL_CORE ? 12 : 12, `${testCase.label}: first page of 12`);
    assert.ok(state.cards.every(card => card.distance === ''), 'no distance without location');
    assert.ok(state.requests.every(url => !url.includes('latitude=')), 'no location sent without a user action');
    assert.match(state.scope, /전국 전체/u);
    assert.match(state.appNote, /지도앱: 네이버지도\(기본값\)/u);
    measures.renderMs12 = state.renderMs;
    await shot('01-region');
    layout(state, 'region');
    await tap(await reveal('.onnuri-more'));
    state = await waitState(v => v.cards.length > 12 && settled(v), `${testCase.label}: more`);
    assert.equal(new Set(state.cards.map(card => card.id)).size, state.cards.length, 'no duplicates after 더 보기');
    measures.cardsAfterMore = state.cards.length;

    if (!REAL_CORE) {
      // 2. 지역 cascade: 부산 → 부산진구 → 부전동, 시장; a 시·도 without data says why; 세종 has no 시·군·구.
      await select('sido', '부산광역시');
      state = await waitState(v => v.regions.sigungu.visible && v.regions.market.visible && settled(v), `${testCase.label}: 부산 lists`);
      assert.ok(state.regions.sigungu.options.includes('부산진구'));
      assert.ok(state.regions.market.options.includes('부전시장'));
      assert.match(state.regionNote, /확인 안 됨 4곳/u, 'unplaced shops are counted, not hidden');
      assert.match(state.coverage, /시·군·구를 확인한 곳은/u);
      await select('sigungu', '부산진구');
      state = await waitState(v => v.regions.dong.visible && v.regions.dong.options.includes('부전동') && settled(v), `${testCase.label}: 부산진구 dongs`);
      assert.deepEqual(state.regions.market.options.slice(1), ['부전시장', '서면시장'], '시장 list follows the 시·군·구');
      await select('dong', '부전동');
      state = await waitState(v => settled(v) && v.requests.at(-1).includes('dong='), `${testCase.label}: 부전동`);
      assert.match(state.scope, /부산광역시 부산진구 부전동/u);
      assert.ok(state.cards.every(card => /부전시장|서면시장/u.test(card.address) || card.address.startsWith('시장 주소')));
      await select('market', '서면시장');
      state = await waitState(v => settled(v) && v.cards.length === 6, `${testCase.label}: 서면시장`);
      assert.ok(state.cards.every(card => card.address.includes('중앙대로 680번길')));
      assert.ok(!state.relationMap && !state.relationText && !state.pins.length, `${testCase.label}: region results have no relation map`);
      await select('sido', '대전광역시');
      state = await waitState(v => settled(v) && v.regionNote.includes('나눠 볼 수 없어요'), `${testCase.label}: 대전`);
      assert.equal(state.regions.sigungu.visible, false, 'no disabled-only picker');
      assert.equal(state.regions.dong.visible, false);
      assert.equal(state.regions.sigungu.value, '');
      await select('sido', '세종특별자치시');
      state = await waitState(v => settled(v) && v.regions.dong.visible, `${testCase.label}: 세종`);
      assert.equal(state.regions.sigungu.visible, false);
      assert.ok(state.regions.dong.options.includes('조치원읍'));
      assert.match(state.regionNote, /시·군·구 없이 읍·면·동/u);
      layout(state, 'cascade');
      await shot('02-cascade');

      // 3. Filters still narrow; zero is honest.
      await select('sido', '부산광역시');
      await waitFor(async () => settled(await probe()), `${testCase.label}: back to 부산`);
      await tap(await reveal('[data-onnuri-filter="category"][data-value="CLOTHING"]'));
      state = await waitState(v => settled(v) && v.cards.length === 7, `${testCase.label}: clothing`);   // 서면 6 + the long-name shop (의류 in its items)
      await tap(await reveal('[data-onnuri-filter="accept"][data-value="PAPER"]'));
      await tap(await reveal('[data-onnuri-filter="category"][data-value="CAFE"]'));
      state = await waitState(v => settled(v) && v.cards.length === 0, `${testCase.label}: zero`);
      assert.match(state.status, /가맹점이 아니라는 뜻은 아니에요/u);
    }

    // 4. Permission granted: 내 주변 5 km, nearest first, market distance said so, no relation map.
    await load({geo: 'grant', cookies: ['lotbi_default_map_provider_v1=KAKAO_NAVI']});
    state = await openOnnuri();
    state = await waitState(v => v.tabs.location.selected && v.cards.length && settled(v), `${testCase.label}: nearby`);
    assert.deepEqual(state.radius, [5000]);
    assert.match(state.scope, /반경 5km/u);
    const nearbyRequest = state.requests.find(url => url.includes('latitude='));
    assert.match(nearbyRequest, /latitude=35\.18&longitude=129\.076&radius_meters=5000/u, 'rounded location + chosen radius');
    assert.ok(!nearbyRequest.includes('sido='));
    const distances = state.cards.map(card => meters(card.distance));
    assert.deepEqual(distances, [...distances].sort((a, b) => a - b), 'nearest first');
    assert.ok(distances.every(value => value <= 5000), 'inside the radius');
    if (!REAL_CORE) {
      assert.match(state.cards[0].distance, /^시장까지 /u, '거제시장 first, 시장 기준');
      assert.match(state.cards[0].basis, /소속 시장 기준/u);
      assert.ok(state.cards.some(card => card.distance && !card.distance.startsWith('시장까지')), 'building shop shows its own distance');
    }
    assert.equal(state.relationMap, false, `${testCase.label}: 내 주변 has no relation map (circle, dots, count)`);
    assert.equal(state.relationText, false, `${testCase.label}: no '배경 지도 없이 위치 관계만…' caption`);
    assert.equal(state.pins.length, 0, `${testCase.label}: no map pins`);
    assert.match(state.note, /저장하지 않아요/u);
    assert.match(state.appNote, /카카오내비\(내 설정\)/u);
    for (const card of state.cards) {
      // ONNURI-REMOVE-RELATION-MAP-01: one map button per card, the saved app's icon on it.
      const mapLinks = card.links.filter(link => link.action);
      assert.equal(mapLinks.length, 1, `${card.name}: exactly one map button (no separate '지도에서 보기')`);
      assert.ok(!card.links.some(link => /지도에서 보기/u.test(link.text)), `${card.name}: no '지도에서 보기'`);
      assert.ok(mapLinks[0].icon && mapLinks[0].icon.name === 'kakao-map' && mapLinks[0].icon.loaded,
        `${card.name}: the KAKAO_NAVI icon is shown and loaded (${JSON.stringify(mapLinks[0].icon)})`);
      assert.match(mapLinks[0].icon.src, /^\/assets\/place-actions\/kakao-map\.png\?v=place-icons-20260925$/u);
      assert.doesNotMatch(mapLinks[0].text, /시장 길찾기/u, 'the market basis is said in the card body, not on the button');
      const route = card.links.find(link => link.action === 'route');
      assert.ok(route, `${card.name}: route only with a point`);
      assert.match(route.text, /카카오내비/u, 'the chosen app is named on the button');
      if (testCase.mobile) assert.match(route.href, /\/kakao-navi\.html\?/u);
      else assert.match(route.href, /^https:\/\/map\.kakao\.com\//u);
    }
    if (!REAL_CORE) {
      const phone = state.cards.find(card => card.name === '테스트전화되는가게');
      assert.ok(phone, 'phone shop listed');
      const call = phone.links.find(link => link.cls.includes('onnuri-card-phone'));
      assert.equal(call.href, 'tel:0511234567');
      assert.ok(state.cards.filter(card => card !== phone).every(card => !card.links.some(link => link.href.startsWith('tel:'))), 'no phone button without a verified number');
    }
    layout(state, 'nearby');
    await shot('03-nearby');
    // Tapping a card body selects nothing any more (there is no sketch to point at);
    // its links still open the chosen map app.
    if (state.cards[0]) {
      await evaluate(`document.querySelector('.onnuri-card[data-onnuri-merchant="${state.cards[0].id}"] .onnuri-card-title').scrollIntoView({block:'center'}), true`);
      await sleep(150);
      const at = await evaluate(`(() => { const r = document.querySelector('.onnuri-card[data-onnuri-merchant="${state.cards[0].id}"] .onnuri-card-title').getBoundingClientRect(); return {cx: r.x + 4, cy: r.y + r.height / 2}; })()`);
      await tap(at);
      await sleep(200);
      state = await waitState(v => settled(v), `${testCase.label}: after card tap`);
      assert.ok(state.cards.every(card => !card.selected), 'no card selection state');
      assert.equal(state.relationMap, false, 'still no relation map after a card tap');
    }

    // Radius: 1 km → fewer; 25 km → 기장 too.
    await tap(await reveal('[data-onnuri-radius="1000"]'));
    state = await waitState(v => settled(v) && v.radius[0] === 1000 && v.requests.at(-1).includes('radius_meters=1000'), `${testCase.label}: 1 km`);
    assert.ok(state.cards.every(card => meters(card.distance) <= 1000));
    if (!REAL_CORE) {
      await tap(await reveal('[data-onnuri-radius="25000"]'));
      state = await waitState(v => settled(v) && v.radius[0] === 25000 && v.status.includes('반경 안 27곳'), `${testCase.label}: 25 km`);
      assert.equal(state.cards.length, 12);
      assert.ok(state.more, 'more within the radius');
    }

    if (!REAL_CORE) {
      // Nothing within 5 km of a point 7 km from 기장시장: say the nearest and offer the next radius.
      await load({geo: 'grant', position: {latitude: 35.30, longitude: 129.25}});
      state = await openOnnuri();
      state = await waitState(v => settled(v) && v.cards.length === 0 && v.emptyButtons.length, `${testCase.label}: none in 5 km`);
      assert.match(state.status, /반경 5km 안에서 위치가 확인된 가맹점을 찾지 못했어요/u);
      assert.match(state.status, /가장 가까운 확인된 곳은 약 \d/u);
      assert.match(state.status, /단정하지는 말아 주세요/u);
      const expand = state.emptyButtons.find(button => button.expand);
      assert.equal(expand?.expand, '10000', 'offer the smallest radius that reaches the nearest');
      await tap(await reveal(`[data-onnuri-expand="${expand.expand}"]`));
      state = await waitState(v => settled(v) && v.cards.length, `${testCase.label}: widened`);
      assert.deepEqual(state.radius, [10000]);
      assert.deepEqual(state.cards.map(card => card.name), ['테스트기장상회']);

      // No located data at all: never "주변에 없음".
      await evaluate('globalThis.__onnuri.noData = true, true');
      await tap(await reveal('[data-onnuri-radius="5000"]'));
      state = await waitState(v => settled(v) && v.cards.length === 0 && v.status.includes('위치가 확인된 가맹점 자료가 아직 없어'), `${testCase.label}: no data`);
      assert.match(state.status, /주변에 가맹점이 없다는 뜻은 아니에요/u);
      assert.ok(state.emptyButtons.some(button => button.text === '지역 선택으로 찾기'));
      await evaluate('globalThis.__onnuri.noData = false, true');

      // Core failure → retry.
      await evaluate('globalThis.__onnuri.failNext = 1, true');
      await tap(await reveal('[data-onnuri-radius="25000"]'));
      state = await waitState(v => v.error.includes('불러오지 못했어요'), `${testCase.label}: failure`);
      await tap(await reveal('.onnuri-error button'));
      state = await waitState(v => !v.error && settled(v) && v.cards.length, `${testCase.label}: retried`);
    }

    // 5. The map app setting changes while the screen is open (another tab) → links follow.
    for (const provider of ['GOOGLE_MAPS', 'TMAP', 'NAVER_MAP']) {
      await page('Network.setCookie', {name: 'lotbi_default_map_provider_v1', value: provider, url: origin});
      await evaluate("document.dispatchEvent(new Event('visibilitychange')), true");
      state = await waitFor(async () => {
        const v = await probe();
        const want = {GOOGLE_MAPS: /Google Maps/u, TMAP: /티맵/u, NAVER_MAP: /네이버지도/u}[provider];
        return want.test(v.appNote) && v.cards.length && v.cards.every(card => card.links.some(link => want.test(link.text)))
          && v.cards.every(card => card.links.filter(link => link.action).every(link => link.icon && link.icon.loaded)) ? v : null;
      }, `${testCase.label}: ${provider} after return`);
      const route = state.cards[0].links.find(link => link.action === 'route');
      const wantIcon = {GOOGLE_MAPS: 'google-maps', NAVER_MAP: 'naver-map', TMAP: testCase.mobile ? 'tmap' : 'naver-map'}[provider];
      assert.ok(state.cards.every(card => card.links.filter(link => link.action).length === 1), `${testCase.label}: ${provider}: one map button per card`);
      assert.ok(state.cards.every(card => card.links.filter(link => link.action).every(link => link.icon && link.icon.name === wantIcon && link.icon.loaded)),
        `${testCase.label}: ${provider}: every map button shows the ${wantIcon} icon`);
      if (provider === 'GOOGLE_MAPS') assert.match(route.href, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/u);
      if (provider === 'TMAP') {
        if (testCase.userAgent === ANDROID_UA) assert.match(route.href, /^intent:\/\/route\?/u);
        else if (testCase.mobile) assert.match(route.href, /\/map-handoff\.html\?provider=TMAP/u);
        else { assert.match(route.text, /티맵 대신 네이버지도 웹/u, 'desktop says it opens NAVER web instead'); assert.match(route.href, /^https:\/\/map\.naver\.com\//u); }
      }
      if (provider === 'NAVER_MAP') {
        if (testCase.userAgent === ANDROID_UA) assert.match(route.href, /^intent:\/\/navigation/u);
        else if (testCase.mobile) assert.match(route.href, /\/map-handoff\.html\?provider=NAVER_MAP/u);
        else assert.match(route.href, /^https:\/\/map\.naver\.com\//u);
      }
    }
    // Two different saved values: said, not silently swapped.
    await page('Network.setCookie', {name: 'lotbi_default_map_provider_v1', value: 'KAKAO_NAVI', url: origin, path: '/scripts'});
    await evaluate("document.dispatchEvent(new Event('visibilitychange')), true");
    state = await waitState(v => v.appNote.includes('둘 이상 저장돼'), `${testCase.label}: conflicting cookies`);

    if (!REAL_CORE && testCase.full) {
      // 6. Permission denied: reason + region offer; no location request.
      await load({geo: 'deny'});
      state = await openOnnuri();
      await tap(await reveal('[data-onnuri-mode="location"]'));
      state = await waitState(v => v.note.includes('위치 권한이 꺼져'), `${testCase.label}: denied`);
      assert.equal(state.toRegion, true);
      assert.equal(state.cards.length, 0, 'no guessed region results under 내 주변');
      assert.ok(state.requests.every(url => !url.includes('latitude=')));
      await tap(await reveal('.onnuri-to-region'));
      state = await waitState(v => v.tabs.region.selected && v.cards.length && settled(v), `${testCase.label}: denied → region`);

      // 7. Location failure (no position): reason, nothing guessed.
      await load({geo: 'fail'});
      state = await openOnnuri(v => Boolean(v.note) && !v.note.includes('확인하고 있어요'));
      state = await waitState(v => v.note.includes('현재 위치를 확인하지 못했어요') || v.note.includes('시간이 지나'), `${testCase.label}: failure`, 30000);
      assert.equal(state.cards.length, 0);
      assert.ok(state.requests.every(url => !url.includes('latitude=')));

      // 8. 위치 사용 off in LOTBI settings.
      await load({cookies: ['lotbi_location_usage_v1=off']});
      state = await openOnnuri();
      await tap(await reveal('[data-onnuri-mode="location"]'));
      state = await waitState(v => v.note.includes('위치 사용이 꺼져'), `${testCase.label}: usage off`);
      assert.equal(state.settingsLink, 'https://account.lotbiai.com/account#privacy');
      assert.ok(state.requests.every(url => !url.includes('latitude=')));

      // 9. Not published yet.
      await evaluate('globalThis.__onnuri.notReady = true, true');
      await tap(await reveal('[data-onnuri-mode="region"]'));
      state = await waitState(v => v.status.includes('준비하고 있어요'), `${testCase.label}: not ready`);
    }
    return {cards: state.cards.length, requests: state.requests.length, ...measures};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.onnuri-location-ux-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`ONNURI_LOCATION_UX ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`ONNURI-MERCHANT-LOCATION-UX-P0 OK${REAL_CORE ? ' (real local Core)' : ''} — 내 주변 반경/지역 단계, 12-card responsive grid, no relation map, chosen map app (4 + default + conflict, live refresh), verified phone only, honest empty/failure states (viewport emulation, not a device run)`);
