// REAL-ESTATE-REGION-FAVORITES-P0 — 지역정보 → 부동산 실거래가.
//
// Node part: client contract (URLs, rounding, 만원 formatting, device storage)
// and source rules (no conversation, no AI, no public-data host, no stored
// coordinate, the card / routes / stylesheet are wired).
// Browser part: the real app (index.html) with Core answered in the page by a
// model of the Core contract (app/real_estate_public_api.py and
// app/real_estate_favorites_api.py): 3-step 법정동 regions, current location →
// 법정동 (only as far as confirmed), apartment lists per 매매 / 전세 / 월세,
// apartment detail, signed-in favorites per account. Real touch / mouse input
// through the DevTools protocol on 360/375/390/412 phones, a 768 tablet and a
// 1280 desktop, light and dark. Viewport emulation only — not a device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  formatArea, formatDealLine, formatFloor, formatManwon, GUEST_FAVORITES_KEY, isApartmentId, locateUrl, readGuestFavorites,
  readRegionPreference, realEstateUrl, regionPreferenceKey, REAL_ESTATE_GUEST_FAVORITES_LIMIT, writeGuestFavorites, writeRegionPreference,
} from '../site-real-estate-client.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Node: contract ──────────────────────────────────────────────────────
{
  assert.equal(formatManwon(230000), '23억원');
  assert.equal(formatManwon(225500), '22억 5,500만원');
  assert.equal(formatManwon(9900), '9,900만원');
  assert.equal(formatManwon(-1), '');
  assert.equal(formatArea(84.97), '전용 84.97㎡');
  assert.equal(formatArea(84.1), '전용 84.1㎡');
  assert.equal(formatFloor(-1), '지하 1층');
  assert.equal(formatFloor(12), '12층');
  assert.equal(formatDealLine({type: 'MONTHLY', deposit_manwon: 10000, monthly_rent_manwon: 250, area_m2: 59.98, floor: 3, date: '2026-09-05'}),
    '월세 1억원 / 250만원 · 전용 59.98㎡ · 3층 · 2026.09.05');
  assert.equal(formatDealLine({type: 'JEONSE', deposit_manwon: 120000, area_m2: 84.97, floor: 7, date: '2026-09-11'}),
    '전세 12억원 · 전용 84.97㎡ · 7층 · 2026.09.11');
  assert.ok(isApartmentId('1168010100-0123456789ab') && !isApartmentId('1168010100-0123') && !isApartmentId('x'));

  const list = new URL(realEstateUrl('/apartments', {sigungu: '11680', dong: '', deal: 'SALE', q: ''}));
  assert.equal(list.origin + list.pathname, 'https://api.lotbiai.com/v2/life/real-estate/apartments');
  assert.equal(list.searchParams.get('dong'), null, 'empty parameters are left out');
  const located = new URL(locateUrl(37.500123, 127.036456));
  assert.equal(located.searchParams.get('latitude'), '37.5', 'rounded to ~100 m');
  assert.equal(located.searchParams.get('longitude'), '127.036');
  assert.equal(locateUrl(10, 10), '', 'outside Korea: no request');

  const memory = new Map();
  const storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key)};
  assert.equal(regionPreferenceKey(''), 'lotbi.site.ux.v1.real-estate.region.guest');
  assert.equal(regionPreferenceKey('usr_1'), 'lotbi.site.ux.v1.real-estate.region.usr_1');
  writeRegionPreference('usr_1', {mode: 'MANUAL', sido: '11', sigungu: '11680', dong: '1168010100'}, storage);
  assert.deepEqual(readRegionPreference('usr_1', storage), {mode: 'MANUAL', sido: '11', sigungu: '11680', dong: '1168010100'});
  assert.equal(readRegionPreference('', storage), null, 'an account region is not the guest region');
  writeRegionPreference('usr_1', {mode: 'AUTO', sido: '11'}, storage);
  assert.deepEqual(readRegionPreference('usr_1', storage), {mode: 'AUTO'});
  assert.ok(![...memory.values()].some(value => /latitude|longitude|\d{2}\.\d{3,}/u.test(value)), 'no coordinate is stored');
  const many = Array.from({length: 60}, (_, i) => ({apartment_id: `1168010100-${String(i).padStart(12, '0')}`, name: `A${i}`}));
  writeGuestFavorites([...many, many[0]], storage);
  assert.equal(readGuestFavorites(storage).length, REAL_ESTATE_GUEST_FAVORITES_LIMIT);
  writeGuestFavorites([], storage);
  assert.equal(memory.has(GUEST_FAVORITES_KEY), false);
  const throwing = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }};
  assert.deepEqual(readGuestFavorites(throwing), []);
  assert.equal(writeGuestFavorites(many, throwing), false);

  const screen = read('site-life-real-estate.js') + read('site-real-estate-client.js');
  assert.doesNotMatch(screen, /data\.go\.kr|serviceKey|RTMSDataSvc|molit\.go\.kr/u, 'the Site never calls a public-data host');
  assert.doesNotMatch(screen, /\/v2\/conversation|sendConversationMessage|onAsk|openai|anthropic/u, 'no conversation, no AI');
  assert.doesNotMatch(screen, /innerHTML|insertAdjacentHTML|document\.write/u, 'no HTML injection');
  assert.doesNotMatch(screen, /oapi\.map\.naver|dapi\.kakao\.com\/v2\/maps|maps\.googleapis|apis\.openapi\.sk\.com/u, 'no map SDK or pin');
  assert.doesNotMatch(screen, /setItem\([^)]*latitude|savedLifeRegion|lotbi\.calendar\.weather-region/u, 'the LOTBI 기본 생활지역 is never written');

  const sections = read('site-consumer-sections.js');
  assert.match(sections, /\{id: 'real-estate', label: '부동산 실거래가', description: '우리 동네 아파트 실제 거래', icon: 'building'\}/u);
  assert.match(sections, /item\.id === 'real-estate' \? onRealEstate\?\.\(\)/u);
  const routes = read('site-route.js');
  assert.match(routes, /'real-estate',\n\s+'real-estate-apartment',/u);
  const conversation = read('site-conversation.js');
  assert.match(conversation, /'real-estate': \(\) => openRealEstate\(\),/u);
  assert.match(conversation, /'real-estate-apartment': \(\) => openRealEstate\(\{view: 'detail'\}\),/u);
  assert.match(conversation, /route: 'real-estate', backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\), backRoute: 'life'/u);
  for (const page of ['index.html', 'auth/callback/index.html']) assert.match(read(page), /site-life-real-estate\.css\?v=aset-/u, page);
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
  throw new Error('Chrome/Chromium is required for the real-estate validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const ALL_CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: SAMSUNG_UA, full: true},
  {label: 'mobile-375x812-dark', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, dark: true},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'tablet-768x1024', width: 768, height: 1024, mobile: true, userAgent: IPHONE_UA.replace('iPhone', 'iPad')},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, full: true, signedIn: true},
  {label: 'desktop-1280x900-dark', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, dark: true},
];
const CASES = process.env.REAL_ESTATE_CASES ? ALL_CASES.filter(item => process.env.REAL_ESTATE_CASES.split(',').includes(item.label)) : ALL_CASES;

// A model of the Core contract on test complexes (names and prices made up).
const MOCK = String.raw`
const RE = globalThis.__re = {requests: [], unavailable: false, favorites: {}, tokenUser: {'site-token': 'usr_a', 'site-token-b': 'usr_b'}};
const SIDO = [{code:'11',name:'서울특별시'},{code:'26',name:'부산광역시'},{code:'12',name:'전남광주통합특별시'},{code:'41',name:'경기도'}];
const SGG = {
  '11':[{code:'11680',sido_code:'11',name:'강남구',city:null},{code:'11650',sido_code:'11',name:'서초구',city:null}],
  '26':[{code:'26350',sido_code:'26',name:'해운대구',city:null}],
  '12':[{code:'12300',sido_code:'12',name:'북구',city:null}],
  '41':[{code:'41117',sido_code:'41',name:'수원시 영통구',city:'수원시'}],
};
const DONG = {
  '11680':[['1168010100','역삼동'],['1168010300','개포동'],['1168010600','대치동']],
  '11650':[['1165010700','반포동']],
  '26350':[['2635010500','우동'],['2635010600','중동']],
  '12300':[['1230010100','중흥동']],
  '41117':[['4111710300','매탄동']],
};
const NAME = {}; for (const [s, list] of Object.entries(SGG)) for (const g of list) NAME[g.code] = {sido: SIDO.find(x=>x.code===s).name, name: g.name};
const label = (sgg, dong) => [NAME[sgg].sido, NAME[sgg].name, dong ? (DONG[sgg].find(d=>d[0]===dong)||[])[1] : ''].filter(Boolean).join(' ');
const APTS = [];
const apt = (sgg, dong, name, jibun, built, sale, jeonse, monthly) => APTS.push({id: dong + '-' + (APTS.length + 1).toString(16).padStart(12,'0'), sgg, dong, name, jibun, built, sale, jeonse, monthly});
apt('11680','1168010100','래미안 역삼','754-1',2006,[[230000,'2026-09-14',84.97,12],[225000,'2026-09-03',84.97,5]],[[120000,'2026-09-11',84.97,7]],[[10000,250,'2026-09-05',59.98,3]]);
apt('11680','1168010600','은마','316',1979,[[245000,'2026-09-02',76.79,4,false],[260000,'2026-09-18',76.79,9,true]],[[65000,'2026-09-16',76.79,11]],[]);
apt('11680','1168010100','현대','711',1988,[[150000,'2026-09-07',59.4,3]],[],[]);
apt('11680','1168010300','현대','12',1984,[[180000,'2026-09-21',84.1,-1]],[],[]);
for (let i = 0; i < 24; i++) apt('11680','1168010300','테스트개포단지' + String(i+1).padStart(2,'0'),'1' + i,2000+i%20,[[100000+i*1000,'2026-08-' + String(1+i).padStart(2,'0'),59.9,2+i%10]],[],[]);
apt('11650','1165010700','반포 테스트자이','20',2009,[[350000,'2026-09-12',84.9,20]],[[150000,'2026-09-01',84.9,8]],[]);
apt('26350','2635010500','해운대 테스트파크','1400',2011,[[90000,'2026-09-09',114.5,30]],[],[[5000,180,'2026-09-15',84.9,15]]);
apt('26350','2635010500','아주아주긴이름의테스트아파트입니다정말로이름이길어서줄이깨지지않는지확인하는단지명','1500',2015,[[70000,'2026-09-19',59.9,7]],[],[]);
const dealOf = (a, type) => type === 'SALE' ? a.sale.map(([amount,date,area,floor,cancelled])=>({type:'SALE',amount_manwon:amount,date,area_m2:area,floor,cancelled:Boolean(cancelled),cancel_date:cancelled?'2026-09-20':null}))
  : type === 'JEONSE' ? a.jeonse.map(([deposit,date,area,floor])=>({type:'JEONSE',deposit_manwon:deposit,monthly_rent_manwon:0,date,area_m2:area,floor,contract_type:'갱신',renewal_right_used:true}))
  : a.monthly.map(([deposit,rent,date,area,floor])=>({type:'MONTHLY',deposit_manwon:deposit,monthly_rent_manwon:rent,date,area_m2:area,floor,contract_type:'신규',renewal_right_used:null}));
const source = [{code:'MOLIT_APT_TRADE',name:'국토교통부_아파트 매매 실거래가 자료'}];
const NOTICE = '국토교통부에 신고된 실거래 자료입니다. 호가·시세·감정가가 아닙니다.';
const view = a => ({apartment_id:a.id,name:a.name,sigungu_code:a.sgg,dong_code:a.dong,dong_name:(DONG[a.sgg].find(d=>d[0]===a.dong)||[])[1],jibun:a.jibun,
  address_label:label(a.sgg,a.dong)+' '+a.jibun,built_year:a.built});
function reCore(url, init) {
  const method = (init && init.method) || 'GET';
  const auth = init && init.headers && (init.headers.Authorization || init.headers.authorization) || '';
  RE.requests.push({method, path: url.pathname + url.search, auth: Boolean(auth), credentials: (init && init.credentials) || ''});
  const p = url.searchParams, path = url.pathname.replace('/v2/life/real-estate', '');
  if (path === '/regions') {
    if (p.get('sigungu')) return {level:'DONG', items:(DONG[p.get('sigungu')]||[]).map(([code,name])=>({code,name,sigungu_code:p.get('sigungu')}))};
    if (p.get('sido')) return {level:'SIGUNGU', items:SGG[p.get('sido')]||[]};
    return {level:'SIDO', items:SIDO, provider_ready:true};
  }
  if (path === '/regions/search') {
    const q = (p.get('q')||'').replace(/\s+/g,'');
    const hits = [];
    for (const [sgg, list] of Object.entries(DONG)) for (const [code, name] of list) {
      const full = label(sgg, code);
      if (full.replace(/\s+/g,'').includes(q)) hits.push({level:'DONG',label:full,sido:{code:sgg==='12300'?'12':SIDO.find(s=>SGG[s.code].some(g=>g.code===sgg)).code},sigungu:{code:sgg},dong:{code}});
    }
    return {items: hits.slice(0, Number(p.get('limit')||20))};
  }
  if (path === '/locate') {
    const lat = Number(p.get('latitude')), lng = Number(p.get('longitude'));
    if (Math.abs(lat-37.5) < .01 && Math.abs(lng-127.036) < .01) return {status:'OK',level:'DONG',confidence:'CONFIRMED',resolver:'NAVER_LEGALCODE',sido:{code:'11',name:'서울특별시'},sigungu:SGG['11'][0],dong:{code:'1168010100',name:'역삼동',sigungu_code:'11680'},label:'서울특별시 강남구 역삼동'};
    if (Math.abs(lat-35.163) < .01) return {status:'OK',level:'SIGUNGU',confidence:'CONFIRMED',resolver:'NAVER_LEGALCODE',sido:{code:'26',name:'부산광역시'},sigungu:SGG['26'][0],dong:null,label:'부산광역시 해운대구'};
    return {status:'NOT_FOUND',level:'NONE',confidence:'NONE',sido:null,sigungu:null,dong:null,label:''};
  }
  if (path === '/apartments') {
    const deal = p.get('deal') || 'SALE';
    if (RE.unavailable) return {status:'UNAVAILABLE',items:[],total:0,has_more:false,next_offset:null,empty_reason:'PROVIDER_UNAVAILABLE',coverage:{provider_errors:['PROVIDER_ACCESS_DENIED']},notice:NOTICE};
    const q = (p.get('q')||'').replace(/\s+/g,'');
    let rows = APTS.filter(a=>a.sgg===p.get('sigungu') && (!p.get('dong') || a.dong===p.get('dong')) && dealOf(a, deal).length);
    const all = rows.length;
    if (q) rows = rows.filter(a=>a.name.replace(/\s+/g,'').includes(q));
    rows = rows.map(a=>{ const deals = dealOf(a, deal); const valid = deals.filter(d=>!d.cancelled); const latest = (valid.length?valid:deals).sort((x,y)=>y.date.localeCompare(x.date))[0];
      return {...view(a), latest, deals_in_period: valid.length, cancelled_in_period: deals.length-valid.length}; })
      .sort((x,y)=>y.latest.date.localeCompare(x.latest.date) || y.name.localeCompare(x.name));
    const offset = Number(p.get('offset')||0), limit = Number(p.get('limit')||20);
    const page = rows.slice(offset, offset+limit);
    return {contract_id:'CORE-REAL-ESTATE-01',schema_version:1,status:'OK',region:{label:label(p.get('sigungu'),p.get('dong'))},deal,months:Number(p.get('months')||3),
      items:page,total:rows.length,has_more:offset+page.length<rows.length,next_offset:offset+page.length<rows.length?offset+page.length:null,
      empty_reason: page.length ? null : (q && all ? 'NAME_NOT_MATCHED' : 'NO_DEALS_IN_PERIOD'), notice:NOTICE, registry_notice:'거래가 없는 단지는 목록에 나오지 않습니다.', source, coverage:{months_requested:3}};
  }
  if (path === '/apartment') {
    const a = APTS.find(x=>x.id===p.get('id'));
    if (!a) return {status:'OK',found:false,apartment:null,sales:[],rents:[],latest_sale:null,latest_rent:null,empty_reason:'NO_DEALS_IN_PERIOD',notice:NOTICE};
    const sales = dealOf(a,'SALE').sort((x,y)=>y.date.localeCompare(x.date)), rents = [...dealOf(a,'JEONSE'),...dealOf(a,'MONTHLY')].sort((x,y)=>y.date.localeCompare(x.date));
    return {status:'OK',found:true,apartment:view(a),sales,rents,latest_sale:sales.find(d=>!d.cancelled)||null,latest_rent:rents[0]||null,months:Number(p.get('months')),notice:NOTICE,source};
  }
  if (path === '/favorites') {
    const user = RE.tokenUser[String(auth).replace(/^Bearer\s+/,'')];
    if (!user) return {__status:401, detail:{code:'SESSION_REQUIRED'}};
    const mine = RE.favorites[user] = RE.favorites[user] || [];
    if (method === 'GET') return {items: mine, count: mine.length, limit: 50};
    if (method === 'PUT') {
      const id = JSON.parse(init.body).apartment_id; const a = APTS.find(x=>x.id===id);
      if (!a) return {__status:404, detail:{code:'REAL_ESTATE_APARTMENT_NOT_CONFIRMED', message:'공식 실거래 자료에서 이 아파트를 다시 확인하지 못했어요.'}};
      if (!mine.some(f=>f.apartment_id===id)) mine.unshift({...view(a), region_label: label(a.sgg,a.dong), saved_at: new Date().toISOString()});
      return {favorite: mine.find(f=>f.apartment_id===id), created: true};
    }
    if (method === 'DELETE') { const id = p.get('apartment_id'); const before = mine.length; RE.favorites[user] = mine.filter(f=>f.apartment_id!==id); return {removed: before !== RE.favorites[user].length, apartment_id: id}; }
  }
  return {__status:404, detail:{code:'NOT_FOUND'}};
}`;

function buildInner(signedIn) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('re-result');
try {
  ${MOCK}
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname.startsWith('/v2/life/real-estate')) { const body = reCore(parsed, init); return json(body, body.__status || 200); }
    if (parsed.pathname.startsWith('/v2/conversation') && parsed.pathname !== '/v2/conversation/guest/sessions') RE.requests.push({method: (init && init.method) || 'GET', path: parsed.pathname, chat: true});
    if (parsed.pathname === '/v2/me') return json({user: {id: 'usr_a', name: '테스트', account_handle: 'tester'},
      session: {id: 'ses', assurance_level: 'FULL', expires_at: '2099-01-01T00:00:00Z'}, installation: {id: 'install-re-test'}});
    if (parsed.pathname === '/v2/subscription') return json({plan: 'FREE', status: 'NONE', entitled: false});
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
      guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  const signedIn = ${signedIn ? 'true' : 'false'};
  const token = sessionStorage.getItem('re-test-token') || 'site-token';
  const composer = document.getElementById('lotbi-prompt');
  const slot = document.createComment('composer');
  if (signedIn) composer.replaceWith(slot);
  const conversation = await import('/site-conversation.js?v=realestatep0');
  if (signedIn) { slot.replaceWith(composer); document.body.dataset.siteAuthState = 'authenticated'; }
  const mounted = signedIn ? conversation.mountConversation({sessionToken: token, identityKey: 'install-re-test'}) : conversation.mountConversation();
  if (!mounted) throw new Error('mount');
  out.textContent = JSON.stringify({ok: true});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); }
</script><pre id="re-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const parse = value => (String(value).match(/[\\d.]+/g) || []).map(Number);
  const lum = c => { const v = parse(c); if (v.length < 3) return null; const [r,g,b] = v.slice(0,3).map(x => { x /= 255; return x <= 0.03928 ? x/12.92 : ((x+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return 'rgb(' + c.slice(0,3).join(',') + ')'; } return 'rgb(255,255,255)'; };
  const contrast = node => { if (!node) return null; const a = lum(getComputedStyle(node).color), b = lum(bgOf(node)); if (a === null || b === null) return null; return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
  const visible = node => Boolean(node) && !node.closest('[hidden]') && node.getClientRects().length > 0;
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const re = document.querySelector('[data-real-estate]');
  const sel = name => { const s = re?.querySelector('[data-re-select="' + name + '"]'); return s ? {value: s.value, disabled: s.disabled, options: [...s.options].map(o => o.value), text: s.selectedOptions[0]?.textContent || '', box: box(s)} : null; };
  const rows = [...(re?.querySelectorAll('[data-re-panel="region"] .lotbi-re-row') || [])].filter(visible).map(row => ({
    id: row.dataset.reApartmentRow, name: row.querySelector('.lotbi-re-row-name')?.textContent || '', address: row.querySelector('.lotbi-re-row-address')?.textContent || '',
    deal: row.querySelector('.lotbi-re-row-deal')?.textContent || '', heart: row.querySelector('[data-re-heart]')?.dataset.reFavorite || '',
    heartBox: box(row.querySelector('[data-re-heart]')), box: box(row), nameContrast: contrast(row.querySelector('.lotbi-re-row-name')),
    overflowX: row.scrollWidth - row.clientWidth }));
  const favorites = [...(re?.querySelectorAll('[data-re-favorite-row]') || [])].filter(visible).map(row => ({id: row.dataset.reFavoriteRow, text: row.textContent}));
  const detail = re?.querySelector('[data-re-detail]');
  const smallTargets = [...(re?.querySelectorAll('button, select, input, a') || [])].filter(visible).filter(n => n.getBoundingClientRect().height < 43.5 && !n.closest('.lotbi-re-fav-note') && !n.classList.contains('lotbi-re-settings'))
    .map(n => (n.dataset.reTab || n.dataset.reDeal || n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().height));
  return {
    hash: location.hash, viewport: {w: innerWidth, h: innerHeight},
    open: Boolean(re && visible(re)), view: re?.dataset.reView || '', listState: re?.dataset.reListState || '',
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    shortcuts: [...(document.querySelectorAll('.consumer-workspace .consumer-shortcut') || [])].map(b => ({
      id: b.dataset.lifeShortcut, box: box(b),
      title: b.querySelector('.consumer-shortcut-title')?.textContent || '',
      description: b.querySelector('.consumer-shortcut-description')?.textContent || '',
      accessibleName: b.getAttribute('aria-label') || ''
    })),
    lifeOpen: Boolean(document.querySelector('.consumer-workspace .consumer-shortcuts')),
    tab: re?.querySelector('[data-re-tab][aria-selected="true"]')?.dataset.reTab || '',
    sido: sel('sido'), sigungu: sel('sigungu'), dong: sel('dong'),
    mode: re?.querySelector('.lotbi-re-region-status')?.dataset.reRegionMode || '',
    regionStatus: re?.querySelector('.lotbi-re-region-status')?.textContent || '',
    locate: visible(re?.querySelector('[data-re-locate]')) ? re.querySelector('[data-re-locate]').textContent : '',
    settings: visible(re?.querySelector('.lotbi-re-settings')) ? re.querySelector('.lotbi-re-settings').getAttribute('href') : '',
    deal: re?.querySelector('[data-re-deal][aria-pressed="true"]')?.dataset.reDeal || '',
    basis: re?.querySelector('.lotbi-re-basis')?.textContent || '',
    status: re?.querySelector('[data-re-list-status]')?.textContent || '',
    retry: visible(re?.querySelector('[data-re-panel="region"] .lotbi-re-retry')),
    more: visible(re?.querySelector('.lotbi-re-more')),
    rows, favorites, favoritesStatus: re?.querySelector('[data-re-favorites-status]')?.textContent || '',
    favNote: re?.querySelector('.lotbi-re-fav-note')?.textContent || '',
    migrate: visible(re?.querySelector('[data-re-migrate="add"]')),
    detail: detail && visible(detail) ? {
      title: detail.querySelector('.lotbi-re-detail-title')?.textContent || '', address: detail.querySelector('.lotbi-re-detail-address')?.textContent || '',
      back: detail.querySelector('[data-re-detail-back]')?.textContent || '', state: detail.dataset.reDetailState || '',
      sales: [...detail.querySelectorAll('[data-re-sales] .lotbi-re-deal-row')].map(r => ({text: r.textContent, cancelled: r.dataset.reCancelled === 'true'})),
      rents: [...detail.querySelectorAll('[data-re-rents] .lotbi-re-deal-row')].map(r => r.textContent),
      heart: detail.querySelector('[data-re-heart="detail"]')?.dataset.reFavorite || '',
      map: (() => { const a = detail.querySelector('[data-re-map]'); return a ? {provider: a.dataset.reMap, href: a.getAttribute('href'), icon: a.querySelector('img')?.getAttribute('src') || '', text: a.textContent} : null; })(),
      status: detail.querySelector('[data-re-detail-status]')?.textContent || '',
    } : null,
    scrollTop: document.querySelector('.consumer-workspace .site-modal-content')?.scrollTop || 0,
    smallTargets,
    bgLum: re ? lum(bgOf(re)) : null,
    statusContrast: contrast(re?.querySelector('[data-re-list-status]')),
    requests: globalThis.__re?.requests.slice() || [],
    guestFavorites: (() => { try { return JSON.parse(localStorage.getItem('lotbi.site.ux.v1.real-estate.favorites.guest') || '[]').map(i => i.apartment_id); } catch { return []; } })(),
    storageKeys: (() => { try { return Object.keys(localStorage).filter(k => k.includes('real-estate')); } catch { return []; } })(),
    storageValues: (() => { try { return Object.keys(localStorage).filter(k => k.includes('real-estate')).map(k => localStorage.getItem(k)).join('|'); } catch { return ''; } })(),
    chat: document.querySelectorAll('.site-message, [data-message-role]').length,
  };
})()`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
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
  for (;;) {
    const last = await fn();
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

const YEOKSAM = {latitude: 37.50012, longitude: 127.03643};

async function runCase(browser, origin, dir, testCase) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.REAL_ESTATE_SCREENSHOT_DIR || '';
  const done = [];
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
          const brief = last && {hash: last.hash, view: last.view, mode: last.mode, regionStatus: last.regionStatus, status: last.status,
            sido: last.sido?.value, sigungu: last.sigungu?.value, dong: last.dong?.value, rows: last.rows.map(r => r.name).slice(0, 5),
            detail: last.detail && {title: last.detail.title, state: last.detail.state}, requests: last.requests.slice(-4)};
          throw new Error(`timeout: ${testCase.label} ${label} ${JSON.stringify(brief)}`);
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
    const press = async selector => tap(await reveal(selector));
    const choose = async (name, value) => {
      await evaluate(`(() => { const s = document.querySelector('[data-re-select="${name}"]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
      await sleep(250);
    };
    const key = async keyName => {
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: keyName === 'Escape' ? 27 : 0});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: keyName === 'Escape' ? 27 : 0});
      await sleep(250);
    };
    const back = async () => { await evaluate('history.back(), true'); await sleep(400); };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const settled = state => state.open && state.listState && state.listState !== 'LOADING';
    const load = async ({cookies = [], geo = 'none', position = YEOKSAM, signedIn = false, token = 'site-token', keepStorage = false, hash = ''} = {}) => {
      await cdp.send('Browser.resetPermissions', {});
      if (geo === 'grant') {
        await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
        await page('Emulation.setGeolocationOverride', {...position, accuracy: 20});
      } else if (geo === 'deny') {
        await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});
        await page('Emulation.clearGeolocationOverride');
      } else {
        await page('Emulation.clearGeolocationOverride');
      }
      await page('Network.enable');
      await page('Network.clearBrowserCookies');
      if (testCase.dark) cookies = [...cookies, 'lotbi_theme_preference_v1=dark'];
      for (const cookie of cookies) await page('Network.setCookie', {name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: origin});
      const inner = signedIn ? 'inner-signed-in.html' : 'inner.html';
      await page('Page.navigate', {url: `${origin}/scripts/${path.basename(dir)}/${inner}`});
      await waitFor(async () => (await evaluate("document.readyState").catch(() => '')) === 'complete', 'document', 60000);
      if (!keepStorage) await evaluate("localStorage.clear(), sessionStorage.clear(), true");
      await evaluate(`sessionStorage.setItem('re-test-token', ${JSON.stringify(token)}), true`);
      await page('Page.navigate', {url: `${origin}/scripts/${path.basename(dir)}/${inner}${hash}`});
      const ready = await waitFor(async () => {
        const value = await evaluate("document.getElementById('re-result')?.textContent || 'pending'").catch(() => 'pending');
        return value !== 'pending' ? value : null;
      }, `${testCase.label}: harness`, 60000);
      const parsed = JSON.parse(ready);
      if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
      if (hash) return;
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(async () => (await probe()).shortcuts.some(item => item.id === 'real-estate'), `${testCase.label}: life shortcuts`);
      await sleep(200);
    };
    const openScreen = async (until = settled) => {
      await press('.consumer-workspace [data-life-shortcut="real-estate"]');
      return await waitState(v => v.open && until(v), 'real-estate screen', 30000);
    };
    const layout = (state, label) => {
      assert.ok(state.pageOverflowX <= 0, `${testCase.label} ${label}: no horizontal page scroll (${state.pageOverflowX})`);
      assert.ok(state.panelOverflowX <= 0, `${testCase.label} ${label}: panel does not scroll sideways (${state.panelOverflowX})`);
      assert.deepEqual(state.smallTargets, [], `${testCase.label} ${label}: touch targets ≥ 44px`);
      for (const row of state.rows) {
        assert.ok(row.box.x >= 0 && row.box.right <= state.viewport.w + 0.5, `${testCase.label}: ${row.name} inside the viewport`);
        assert.ok(row.overflowX <= 0, `${testCase.label}: ${row.name} fits its row`);
        assert.ok(row.box.h <= 150, `${testCase.label}: compact rows, not one big card (${row.box.h}px)`);
        assert.ok(row.nameContrast === null || row.nameContrast >= 4.5, `${testCase.label}: name contrast ${row.nameContrast}`);
        assert.ok(row.heartBox.h >= 44 && row.heartBox.w >= 44, `${testCase.label}: ♡ touch target`);
      }
      assert.ok(state.statusContrast === null || state.statusContrast >= 4.5, `${testCase.label}: status contrast ${state.statusContrast}`);
      if (testCase.dark) assert.ok(state.bgLum !== null && state.bgLum < 0.2, `${testCase.label}: dark background (${state.bgLum})`);
      else assert.ok(state.bgLum === null || state.bgLum > 0.6, `${testCase.label}: light background (${state.bgLum})`);
    };
    const noChat = state => {
      assert.ok(!state.requests.some(item => item.chat), `${testCase.label}: no conversation request`);
      assert.ok(state.requests.filter(item => !item.path.includes('/favorites')).every(item => item.credentials === 'omit' && !item.auth),
        `${testCase.label}: public reads carry no credentials`);
    };

    // 1. 지역정보 menu: the card is there, two columns on phones, the odd last card spans its row.
    await load({geo: 'grant'});
    let state = await probe();
    const ids = state.shortcuts.map(item => item.id);
    assert.ok(ids.indexOf('real-estate') === ids.indexOf('onnuri') + 1, `${testCase.label}: 부동산 실거래가 follows 온누리상품권 (${ids})`);
    const shortcut = state.shortcuts.find(item => item.id === 'real-estate');
    assert.deepEqual({title: shortcut.title, description: shortcut.description, accessibleName: shortcut.accessibleName}, {
      title: '부동산 실거래가',
      description: '우리 동네 아파트 실제 거래',
      accessibleName: '부동산 실거래가. 우리 동네 아파트 실제 거래',
    });
    if (testCase.width <= 600) {
      const tops = [...new Set(state.shortcuts.map(item => Math.round(item.box.y)))];
      const perRow = tops.map(top => state.shortcuts.filter(item => Math.round(item.box.y) === top).length);
      assert.ok(perRow.slice(0, -1).every(count => count === 2), `${testCase.label}: two columns (${perRow})`);
      if (state.shortcuts.length % 2) assert.equal(perRow.at(-1), 1, 'odd last card spans its row');
    }
    done.push('menu');

    // 2. Location allowed: 시·도 / 시·군·구 / 읍·면·동 filled from the confirmed 법정동, list shown, no chat.
    state = await openScreen(v => settled(v) && v.rows.length > 0);
    assert.equal(state.hash, '#real-estate');
    assert.equal(state.tab, 'region');
    assert.deepEqual([state.sido.value, state.sigungu.value, state.dong.value], ['11', '11680', '1168010100']);
    assert.equal(state.mode, 'AUTO');
    assert.match(state.regionStatus, /현재 위치로 자동 선택 · 서울특별시 강남구 역삼동/u);
    assert.equal(state.deal, 'SALE');
    assert.deepEqual(state.rows.map(row => row.name), ['래미안 역삼', '현대'], 'only 역삼동, newest deal first');
    assert.match(state.rows[0].deal, /매매 23억원 · 전용 84\.97㎡ · 12층 · 2026\.09\.14/u);
    assert.match(state.rows[0].address, /서울특별시 강남구 역삼동 754-1/u);
    assert.ok(state.requests.some(item => item.path.startsWith('/v2/life/real-estate/locate?latitude=37.5&longitude=127.036')), 'rounded coordinate');
    assert.equal(state.chat, 0);
    noChat(state);
    assert.ok(!/37\.5|127\.03/u.test(state.storageValues), 'no coordinate stored on the device');
    layout(state, 'auto list');
    await shot('01-auto');
    done.push('auto-location');

    // 3. Manual cascade: 전체 읍·면·동 → 강남구 all; 전세 / 월세; 시·도 change resets lower levels.
    await choose('dong', '');
    state = await waitState(v => settled(v) && v.rows.length >= 20 && v.mode === 'MANUAL', 'all dongs');
    assert.match(state.regionStatus, /직접 선택한 지역 · 서울특별시 강남구/u);
    assert.equal(state.more, true, '더 보기 for a long list');
    await press('.lotbi-re-more');
    state = await waitState(v => settled(v) && v.rows.length > 20, 'more');
    assert.equal(new Set(state.rows.map(row => row.id)).size, state.rows.length, 'no duplicates after 더 보기');
    const hyundai = state.rows.filter(row => row.name === '현대');
    assert.equal(hyundai.length, 2, 'same name in two 법정동 = two complexes');
    assert.notEqual(hyundai[0].address, hyundai[1].address);
    await press('[data-re-deal="JEONSE"]');
    state = await waitState(v => settled(v) && v.deal === 'JEONSE', 'jeonse');
    assert.deepEqual(state.rows.map(row => row.name).sort(), ['래미안 역삼', '은마']);
    assert.ok(state.rows.every(row => row.deal.startsWith('전세 ')));
    await press('[data-re-deal="MONTHLY"]');
    state = await waitState(v => settled(v) && v.deal === 'MONTHLY', 'monthly');
    assert.deepEqual(state.rows.map(row => row.name), ['래미안 역삼']);
    assert.match(state.rows[0].deal, /월세 1억원 \/ 250만원/u);
    await press('[data-re-deal="SALE"]');
    await choose('sido', '26');
    state = await waitState(v => v.sigungu.options.includes('26350') && v.listState === 'PICK', 'busan');
    assert.equal(state.sigungu.value, '');
    assert.equal(state.dong.value, '');
    assert.equal(state.dong.disabled, true, '읍·면·동 waits for its 시·군·구');
    assert.deepEqual(state.rows, [], 'the previous region list is gone');
    assert.match(state.status, /시·군·구를 고르면/u);
    await choose('sigungu', '26350');
    state = await waitState(v => settled(v) && v.rows.length === 2, 'haeundae');
    assert.ok(state.dong.options.includes('2635010500') && state.dong.value === '');
    if (testCase.full) layout(state, 'long name');
    done.push('manual-cascade', 'deal-types');

    // 4. Region name search, apartment name search, empty reasons.
    await evaluate(`(() => { const i = document.querySelector('[data-re-region-search]'); i.value = '반포'; i.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    await waitFor(async () => evaluate("Boolean(document.querySelector('[data-re-region-hit]'))"), 'region hits');
    await press('[data-re-region-hit]');
    state = await waitState(v => settled(v) && v.dong.value === '1165010700', 'banpo');
    assert.deepEqual([state.sido.value, state.sigungu.value], ['11', '11650']);
    assert.deepEqual(state.rows.map(row => row.name), ['반포 테스트자이']);
    await choose('sigungu', '11680');
    await waitState(v => settled(v) && v.rows.length >= 20, 'gangnam again');
    await evaluate(`(() => { const i = document.querySelector('[data-re-name]'); i.value = '래미안'; i.form.requestSubmit(); return true; })()`);
    state = await waitState(v => settled(v) && v.rows.length === 1, 'name search');
    assert.equal(state.rows[0].name, '래미안 역삼');
    await evaluate(`(() => { const i = document.querySelector('[data-re-name]'); i.value = '없는단지'; i.form.requestSubmit(); return true; })()`);
    state = await waitState(v => v.listState === 'EMPTY', 'name not found');
    assert.match(state.status, /'없는단지'을\(를\) 찾지 못했어요/u);
    await evaluate(`(() => { const i = document.querySelector('[data-re-name]'); i.value = ''; i.form.requestSubmit(); return true; })()`);
    await choose('sigungu', '11650');
    await choose('dong', '1165010700');
    await press('[data-re-deal="MONTHLY"]');
    state = await waitState(v => v.listState === 'EMPTY' && v.deal === 'MONTHLY', 'no deals');
    assert.match(state.status, /신고된 월세 거래가 없어요.*아파트가 없다는 뜻은 아니에요/u);
    await press('[data-re-deal="SALE"]');
    await choose('sigungu', '11680');
    await waitState(v => settled(v) && v.rows.length >= 20 && v.deal === 'SALE', 'gangnam sale');
    done.push('region-search', 'apartment-search', 'empty-states');

    // 5. Detail, back paths, scroll kept.
    await evaluate("document.querySelector('.consumer-workspace .site-modal-content').scrollTop = 400, true");
    await sleep(150);
    const scrolled = (await probe()).scrollTop;
    await evaluate("[...document.querySelectorAll('[data-re-open]')].find(b => b.textContent.includes('은마')).click(), true");
    state = await waitState(v => v.view === 'detail' && v.detail?.state === 'READY', 'detail');
    assert.equal(state.hash, '#real-estate-apartment');
    assert.equal(state.detail.title, '은마');
    assert.equal(state.detail.back, '← 목록으로');
    assert.equal(state.detail.sales.length, 2);
    assert.ok(state.detail.sales.some(row => row.cancelled && /해제 2026\.09\.20/u.test(row.text)), 'cancelled contract marked');
    assert.match(state.detail.rents[0], /전세 6억 5,000만원/u);
    assert.equal(state.detail.map.provider, 'NAVER_MAP');
    assert.match(state.detail.map.icon, /\/assets\/place-actions\/naver-map\.png\?v=place-icons-20260925$/u);
    assert.match(state.detail.map.text, /네이버지도에서 찾아보기/u);
    noChat(state);
    layout(state, 'detail');
    await shot('02-detail');
    await back();
    state = await waitState(v => v.view === 'list' && v.hash === '#real-estate', 'system back → list');
    assert.ok(Math.abs(state.scrollTop - scrolled) <= 2, `list scroll kept (${state.scrollTop} vs ${scrolled})`);
    assert.equal(state.sigungu.value, '11680');
    assert.equal(state.deal, 'SALE');
    await evaluate("[...document.querySelectorAll('[data-re-open]')].find(b => b.textContent.includes('은마')).click(), true");
    await waitState(v => v.view === 'detail' && v.hash === '#real-estate-apartment', 'detail again');
    await press('[data-re-detail-back]');
    state = await waitState(v => v.view === 'list' && v.hash === '#real-estate', 'screen ← → list');
    await evaluate("[...document.querySelectorAll('[data-re-open]')].find(b => b.textContent.includes('은마')).click(), true");
    await waitState(v => v.view === 'detail', 'detail 3');
    await press('.consumer-workspace .site-modal-close');
    state = await waitState(v => v.view === 'list' && v.hash === '#real-estate', 'header ← in detail → list');
    await evaluate("[...document.querySelectorAll('[data-re-open]')].find(b => b.textContent.includes('은마')).click(), true");
    await waitState(v => v.view === 'detail', 'detail 4');
    await key('Escape');
    state = await waitState(v => v.view === 'list' && v.hash === '#real-estate', 'Escape in detail → list');
    await press('.consumer-workspace .site-modal-close');
    state = await waitState(v => !v.open && v.lifeOpen && v.hash === '#life', 'header ← in list → 지역정보');
    await back();
    state = await waitState(v => !v.lifeOpen && v.hash === '', 'system back → home');
    done.push('detail', 'back-navigation');

    // 6. Reopen: the picked region stays (no automatic relocation); 현재 위치로 다시 설정 restores AUTO.
    await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
    await waitFor(async () => (await probe()).shortcuts.some(item => item.id === 'real-estate'), 'life again');
    const locatesBefore = (await probe()).requests.filter(item => item.path.includes('/locate')).length;
    state = await openScreen(v => settled(v) && v.sigungu.value === '11680');
    assert.equal(state.mode, 'MANUAL');
    assert.equal(state.dong.value, '', 'the manual 전체 읍·면·동 is kept');
    assert.equal(state.requests.filter(item => item.path.includes('/locate')).length, locatesBefore, 'no automatic relocation after a manual pick');
    assert.equal(state.locate, '현재 위치로 다시 설정');
    await press('[data-re-locate]');
    state = await waitState(v => settled(v) && v.mode === 'AUTO' && v.dong.value === '1168010100', 'relocate');
    done.push('manual-kept', 'relocate');

    // 7. Guest favorites on this device; favorites tab; detail from favorites returns there.
    await evaluate("document.querySelector('[data-re-heart][data-re-name=\"래미안 역삼\"]').click(), true");
    state = await waitState(v => v.rows.find(row => row.name === '래미안 역삼')?.heart === 'on', '♥');
    assert.equal(state.guestFavorites.length, 1);
    await choose('sido', '26');
    await choose('sigungu', '26350');
    state = await waitState(v => settled(v) && v.rows.length === 2, 'busan for a second favorite');
    await evaluate("document.querySelector('[data-re-heart][data-re-name=\"해운대 테스트파크\"]').click(), true");
    state = await waitState(v => v.guestFavorites.length === 2, 'two regions saved');
    await press('[data-re-tab="favorites"]');
    state = await waitState(v => v.tab === 'favorites' && v.favorites.length === 2 && v.favorites.every(f => /최근 (매매|전세|월세)/u.test(f.text)), 'favorites tab');
    assert.match(state.favNote, /이 기기에만 저장돼요/u);
    assert.ok(state.favorites.some(f => f.text.includes('서울특별시 강남구 역삼동')) && state.favorites.some(f => f.text.includes('부산광역시 해운대구')));
    layout(state, 'favorites');
    await shot('03-favorites');
    await evaluate("[...document.querySelectorAll('[data-re-favorite-row] [data-re-open]')].find(b => b.textContent.includes('래미안')).click(), true");
    state = await waitState(v => v.view === 'detail' && v.detail?.state === 'READY', 'detail from favorites');
    assert.equal(state.detail.back, '← 관심 아파트로');
    assert.equal(state.detail.heart, 'on');
    await back();
    state = await waitState(v => v.view === 'list' && v.tab === 'favorites', 'back → favorites tab');
    await evaluate("document.querySelector('[data-re-remove]').click(), true");
    state = await waitState(v => v.favorites.length === 1 && v.guestFavorites.length === 1, 'remove');
    done.push('guest-favorites', 'favorites-tab', 'favorite-remove');

    // 8. Reload on an apartment reopens it (this tab); default map app follows the setting.
    await press('[data-re-tab="region"]');
    await evaluate("[...document.querySelectorAll('[data-re-open]')][0].click(), true");
    await waitState(v => v.view === 'detail' && v.detail?.state === 'READY', 'detail before reload');
    const reloadTitle = (await probe()).detail.title;
    await load({geo: 'grant', keepStorage: true, hash: '#real-estate-apartment', cookies: ['lotbi_default_map_provider_v1=KAKAO_NAVI']});
    state = await waitState(v => v.view === 'detail' && v.detail?.state === 'READY', 'reload detail', 30000);
    assert.equal(state.detail.title, reloadTitle);
    assert.equal(state.detail.map.provider, 'KAKAO_NAVI');
    assert.match(state.detail.map.icon, /kakao-map\.png/u);
    assert.ok(!state.detail.map.href.includes('dlat='), 'no coordinate pin');
    done.push('reload-detail', 'default-map-app');

    if (testCase.full) {
      // 9. Location denied / LOTBI 위치 사용 off: manual only, honest notes.
      await load({geo: 'deny'});
      state = await openScreen(v => v.listState === 'PICK' && v.regionStatus);
      assert.equal(state.sido.value, '');
      assert.match(state.regionStatus, /위치 권한이 없어|현재 위치로 설정/u);
      assert.ok(!state.requests.some(item => item.path.includes('/locate')));
      await choose('sido', '11');
      await choose('sigungu', '11680');
      await waitState(v => settled(v) && v.rows.length > 0, 'manual without location');
      await load({geo: 'grant', cookies: ['lotbi_location_usage_v1=off']});
      state = await openScreen(v => v.listState === 'PICK');
      assert.match(state.regionStatus, /LOTBI 설정에서 위치 사용이 꺼져/u);
      assert.equal(state.settings, 'https://account.lotbiai.com/account#privacy');
      assert.equal(state.locate, '', 'no location button while location use is off');
      assert.ok(!state.requests.some(item => item.path.includes('/locate')));
      done.push('location-denied', 'location-off');

      // 10. Provider unavailable: says so, offers retry, never "no deals".
      await load({geo: 'grant'});
      await evaluate('globalThis.__re.unavailable = true, true');
      state = await openScreen(v => v.listState === 'UNAVAILABLE');
      assert.match(state.status, /불러오지 못했어요/u);
      assert.equal(state.retry, true);
      await evaluate('globalThis.__re.unavailable = false, true');
      await press('[data-re-panel="region"] .lotbi-re-retry');
      await waitState(v => settled(v) && v.rows.length > 0, 'retry');
      done.push('provider-unavailable');
    }

    if (testCase.signedIn) {
      // 11. Signed in: favorites on the account (Bearer), kept across re-login, isolated per account;
      //     a device list from before signing in is offered, never merged by itself.
      await load({geo: 'grant', signedIn: true});
      await evaluate(`localStorage.setItem('lotbi.site.ux.v1.real-estate.favorites.guest', JSON.stringify([{apartment_id: globalThis.__re && '1165010700-00000000001d', name: '반포 테스트자이'}])), true`);
      state = await openScreen(v => settled(v) && v.rows.length > 0);
      await evaluate("document.querySelector('[data-re-heart][data-re-name=\"래미안 역삼\"]').click(), true");
      state = await waitState(v => v.rows.find(row => row.name === '래미안 역삼')?.heart === 'on', 'account ♥');
      const put = state.requests.find(item => item.method === 'PUT');
      assert.ok(put && put.auth && put.path === '/v2/life/real-estate/favorites', 'saved on the account with the session');
      await press('[data-re-tab="favorites"]');
      state = await waitState(v => v.tab === 'favorites' && v.favorites.length === 1, 'account favorites');
      assert.match(state.favNote, /로그인한 계정에 저장돼요/u);
      assert.equal(state.migrate, true, 'the device list is offered');
      assert.equal(state.favorites.length, 1, '...and not merged by itself');
      // Re-login on another device: same account, same list.
      await load({geo: 'grant', signedIn: true, keepStorage: false});
      await evaluate("globalThis.__re.favorites = {usr_a: [{apartment_id: '1168010100-000000000001', name: '래미안 역삼', region_label: '서울특별시 강남구 역삼동', address_label: '서울특별시 강남구 역삼동 754-1'}]}, true");
      state = await openScreen(v => settled(v) && v.rows.length > 0);
      await press('[data-re-tab="favorites"]');
      state = await waitState(v => v.favorites.length === 1 && v.favorites[0].text.includes('래미안 역삼'), 'after re-login');
      // Another account sees nothing of it.
      await load({geo: 'grant', signedIn: true, token: 'site-token-b'});
      await evaluate("globalThis.__re.favorites = {usr_a: [{apartment_id: '1168010100-000000000001', name: '래미안 역삼'}]}, true");
      state = await openScreen(v => settled(v) && v.rows.length > 0);
      assert.equal(state.rows.find(row => row.name === '래미안 역삼').heart, 'off', 'account B does not see the ♥ of account A');
      await press('[data-re-tab="favorites"]');
      state = await waitState(v => v.tab === 'favorites' && /아직 관심 아파트가 없어요/u.test(v.favoritesStatus), 'account B empty');
      done.push('account-favorites', 'relogin', 'account-isolation', 'no-auto-merge');
    }
    return done;
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.real-estate-p0-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(false), 'utf8');
  fs.writeFileSync(path.join(dir, 'inner-signed-in.html'), buildInner(true), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`REAL_ESTATE_P0 ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('REAL-ESTATE-REGION-FAVORITES-P0 OK — 지역정보 card (mobile 2-column, desktop 4-column), location → 법정동 as far as confirmed, 3-step manual regions kept, 매매/전세/월세 lists, name search, honest empty/unavailable states, detail with default map app (no pin), ♡/♥ favorites on device and per account, back paths (system / ← / Escape) list ↔ detail ↔ 지역정보 ↔ home (viewport emulation, not a device run)');
