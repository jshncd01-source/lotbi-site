// LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0 — 생활정보 '온누리상품권·지역화폐'.
//
// Node part: the public contract (docs/VOUCHER_UNIFIED_API_CONTRACT.md §1) as the
// Site reads it — URLs, normalizers, exact source labels, no 온누리 in a
// local-currency card, no stored data / HTML injection.
// Browser part: the real app (index.html) with Core answered inside the page
// from scripts/fixtures/voucher_unified_p0.json (지역화폐) and a small model of
// the existing onnuri contract (온누리상품권 tab), real touch/mouse/keyboard input
// through the DevTools protocol at 360/375/390/412 phones and 1280 desktop,
// light and dark (cookie lotbi_theme_preference_v1=dark).
// Viewport emulation only — not a device run (no Samsung Internet / iPhone Safari).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {
  VOUCHER_HUB_TITLE,
  VOUCHER_PAGE_SIZE,
  VOUCHER_SOURCE_LABELS,
  VOUCHER_NO_DATA_TEXT,
  normalizeVoucherMerchant,
  normalizeVoucherRegions,
  normalizeVoucherSchemes,
  normalizeVoucherSearch,
  paymentLabel,
  voucherMerchantsUrl,
  voucherRegionsUrl,
  voucherSchemesUrl,
} from '../site-life-vouchers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const FIXTURE_REL = 'scripts/fixtures/voucher_unified_p0.json';
const FIXTURE = JSON.parse(read(FIXTURE_REL));
const SOURCE_TEXTS = Object.values(VOUCHER_SOURCE_LABELS);
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); passed += 1; };

// ── Node: contract ──────────────────────────────────────────────────────
{
  const card = LIFE_SHORTCUTS.find(item => item.id === 'onnuri');
  check(['온누리상품권·지역화폐', '온누리·지역화폐'].includes(card.label), `menu card label (${card.label})`);
  same(card.brandSlot, 'onnuri', 'brand slot kept, no logo');
  same(card.icon, undefined, 'no stand-in icon');
  same(VOUCHER_HUB_TITLE, '온누리상품권·지역화폐');
  same(VOUCHER_PAGE_SIZE, 12);
  same(VOUCHER_SOURCE_LABELS, {
    OFFICIAL_API: '한국조폐공사 공식 공개자료', LOCAL_GOV_LIST: '지자체 공개 가맹점 명단',
    OPERATOR_LIST: '승인된 운영기관 자료', ADMIN_ENTRY: 'LOTBI 관리자 등록자료',
  }, 'source labels are the contract strings');

  const regions = new URL(voucherRegionsUrl({sido: '강원특별자치도', sigungu: '춘천시', level: 'DONG'}));
  same(regions.pathname, '/v2/life/vouchers/regions');
  same(regions.searchParams.get('level'), 'DONG');
  same(new URL(voucherRegionsUrl({sigungu: '춘천시'})).search, '', 'no 시·군·구 without its 시·도');
  same(new URL(voucherSchemesUrl({sido: '강원특별자치도', sigungu: '춘천시'})).search, '?sido=%EA%B0%95%EC%9B%90%ED%8A%B9%EB%B3%84%EC%9E%90%EC%B9%98%EB%8F%84&sigungu=%EC%B6%98%EC%B2%9C%EC%8B%9C');
  const merchants = new URL(voucherMerchantsUrl({schemeId: 'vs_x', sido: '강원특별자치도', sigungu: '춘천시', dong: '효자동', q: 'x'.repeat(60),
    category: 'CAFE', payment: 'MOBILE', latitude: 37.88123, longitude: 127.72987, offset: 12}));
  same(merchants.searchParams.get('scheme_id'), 'vs_x');
  same(merchants.searchParams.get('q').length, 40, 'q capped at 40');
  same(merchants.searchParams.get('category'), 'CAFE');
  same(merchants.searchParams.get('payment'), 'MOBILE');
  same(merchants.searchParams.get('latitude'), '37.881', 'rounded to ~100 m');
  same(merchants.searchParams.get('radius_meters'), '5000');
  same(merchants.searchParams.get('limit'), '12');
  same(merchants.searchParams.get('offset'), '12');
  const bad = new URL(voucherMerchantsUrl({schemeId: 'vs_x', category: 'DROP', payment: 'CASH'}));
  same([bad.searchParams.get('category'), bad.searchParams.get('payment'), bad.searchParams.get('latitude')], [null, null, null], 'unknown filters dropped');

  const raw = {id: 'vm_1', name: '가게', address: '강원특별자치도 춘천시', address_precision: 'REGION_ONLY', location: null, phone: null,
    business_status: 'SUSPENDED', category: {code: 'FOOD', label: '음식점'},
    accepts: [
      {scheme_id: 'vs_cc', scheme_name: '춘천사랑상품권', payment_types: {paper: true, mobile: null, card: false}, source: {kind: 'OFFICIAL_API', label: 'x'}, last_verified_on: '2026-10-10'},
      {scheme_id: 'vs_on', scheme_name: '온누리상품권', payment_types: {}, source: {kind: 'OFFICIAL_API'}, last_verified_on: '2026-10-10'},
      {scheme_id: 'vs_bad', scheme_name: '근거없음', payment_types: {}, source: {kind: 'GUESS'}},
    ],
    map_query: '강원특별자치도 춘천시 가게'};
  const merchant = normalizeVoucherMerchant(raw);
  same(merchant.regionOnly, true);
  same(merchant.latitude, null);
  same(merchant.accepts.map(item => item.schemeName), ['춘천사랑상품권'], 'onnuri / unsourced links never shown on a local-currency card');
  same(merchant.accepts[0].sourceLabel, '한국조폐공사 공식 공개자료', 'label from the kind, exact');
  same(paymentLabel(merchant.accepts[0].payments), '지류', 'only confirmed payment types');
  same(normalizeVoucherMerchant({...raw, accepts: []}), null, 'no published link → not shown');
  same(normalizeVoucherMerchant({...raw, id: '<x>'}), null, 'unsafe id rejected');
  same(normalizeVoucherMerchant({...raw, location: {latitude: 0, longitude: 0, precision: 'OFFICIAL'}}).latitude, null, 'no pin outside Korea');
  same(normalizeVoucherMerchant({...raw, location: {latitude: 37.9, longitude: 127.7, precision: 'GUESSED'}}).latitude, null, 'unknown precision → no pin');
  same(normalizeVoucherMerchant({...raw, location: {latitude: 37.9, longitude: 127.7, precision: 'PROVIDED'}}).latitude, 37.9, 'PROVIDED is a real pin');
  same(normalizeVoucherMerchant({...raw, phone: '1234'}).phone, '', 'malformed phone hidden');
  const search = normalizeVoucherSearch({schema_version: 1, items: [], total_count: 0, empty_reason: 'NO_DATA_REGISTERED', notice: '현재 결제 가능한 곳'});
  same(search.emptyReason, 'NO_DATA_REGISTERED');
  check(!/현재 결제 가능/u.test(search.notice), 'a notice claiming payment availability is replaced');
  same(normalizeVoucherSearch({schema_version: 2}), null, 'unknown schema rejected');
  const schemes = normalizeVoucherSchemes(FIXTURE.schemes['강원특별자치도|춘천시']);
  same(schemes.items.map(item => item.issuerLevel), ['PROVINCE', 'CITY'], '광역 and 기초 both, 광역 first');
  same(normalizeVoucherSchemes({schema_version: 1, items: [{id: 'vs_on', name: '온누리상품권', status: 'ACTIVE'}]}).items.length, 0, 'onnuri never listed as a local currency');
  same(normalizeVoucherSchemes({schema_version: 1, items: [{id: 'vs_s', name: 'A', status: 'SUSPENDED'}]}).items.length, 0, 'only ACTIVE');
  same(normalizeVoucherRegions(FIXTURE.regions.SIDO).items.length > 0, true);

  const source = read('site-life-vouchers.js');
  check(!/localStorage|sessionStorage|innerHTML|insertAdjacentHTML|indexedDB|document\.cookie\s*=/u.test(source), 'nothing stored, no HTML injection');
  check(!/현재 결제 가능/u.test(source), 'never says 현재 결제 가능');
  check(/credentials: 'omit'/u.test(source), 'credentials omitted');
  check(/import \{CORE_ORIGIN\} from '\.\/site-core\.js\?v=aset-[0-9a-f]{12}'/u.test(source), 'versioned imports');
  check(!/oapi\.map\.naver|dapi\.kakao\.com\/v2\/maps|maps\.googleapis|onnuri\.gift|#EB6620/iu.test(source), 'no map SDK / copied brand asset');
  check(/site-life-vouchers\.css\?v=aset-[0-9a-f]{12}/u.test(read('index.html')), 'index.html links the CSS with the asset token');
  check(/\/site-life-vouchers\.css\?v=aset-[0-9a-f]{12}/u.test(read('auth/callback/index.html')), 'auth/callback links the CSS');
  const conversation = read('site-conversation.js');
  check(/modalShell\('온누리상품권·지역화폐'/u.test(conversation), 'modal title is the full name');
  check(/import\('\.\/site-life-vouchers\.js\?v=aset-[0-9a-f]{12}'\)/u.test(conversation), 'hub loaded on demand');
  for (const icon of ['naver-map', 'kakao-map', 'tmap', 'google-maps']) check(fs.existsSync(path.join(ROOT, `assets/place-actions/${icon}.png`)), `${icon} icon asset`);
}

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium',
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      // /opt/pw-browsers/chromium may be a folder: look for the binary inside.
      const found = spawnSync('find', [candidate, '-maxdepth', '4', '-type', 'f', '(', '-name', 'chrome', '-o', '-name', 'chromium', ')'], {encoding: 'utf8'});
      const first = found.status === 0 ? found.stdout.trim().split(/\r?\n/)[0] : '';
      if (first) return first;
      continue;
    }
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the voucher unified validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const ALL_CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA, full: true},
  {label: 'mobile-375x812-dark', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, dark: true},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, full: true},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, full: true},
  {label: 'desktop-1280x900-dark', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, dark: true},
];
const CASES = process.env.VOUCHER_CASES ? ALL_CASES.filter(item => process.env.VOUCHER_CASES.split(',').includes(item.label)) : ALL_CASES;

// Core inside the page. 지역화폐: the fixture, filtered like Core's public read
// (§1.3). The loader only needs regions/schemes/merchants; anything missing is
// treated as empty so a fixture regenerated from a real Core still loads.
const MOCK = String.raw`
const F = await (await nativeFetch('/${FIXTURE_REL}', {cache: 'no-store'})).json();
const regionsOf = F.regions || {};
const schemeMap = F.schemes || {};
const allMerchants = Array.isArray(F.merchants) ? F.merchants : [];
const allSchemes = Object.values(schemeMap).flatMap(r => Array.isArray(r && r.items) ? r.items : []);
const hav = (a,b,c,d) => { const r=x=>x*Math.PI/180; const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2; return 2*6371000*Math.asin(Math.sqrt(h)); };
globalThis.__voucher = {requests: [], failNext: 0};
function voucherResponse(url) {
  globalThis.__voucher.requests.push(url.pathname + url.search);
  if (globalThis.__voucher.failNext > 0) { globalThis.__voucher.failNext -= 1; return null; }
  const p = url.searchParams;
  if (url.pathname.endsWith('/regions')) {
    const sido = p.get('sido'), sigungu = p.get('sigungu');
    if (!sido) return regionsOf.SIDO || {schema_version:1, level:'SIDO', sido:null, sigungu:null, items:[]};
    if (p.get('level') === 'DONG' && sigungu) return (regionsOf.DONG || {})[sido+'|'+sigungu] || {schema_version:1, level:'DONG', sido, sigungu, items:[]};
    return (regionsOf.SIGUNGU || {})[sido] || {schema_version:1, level:'SIGUNGU', sido, sigungu:null, items:[]};
  }
  if (url.pathname.endsWith('/schemes')) {
    const sido = p.get('sido'), sigungu = p.get('sigungu');
    if (!sido) return {schema_version:1, catalog:null, region:null, items:[], empty_reason:'REGION_REQUIRED'};
    return schemeMap[sido+'|'+(sigungu||'')] || {schema_version:1, region:{sido, sigungu}, items:[], empty_reason:'NO_SCHEME_FOR_REGION'};
  }
  const sid = p.get('scheme_id');
  const scheme = allSchemes.find(s => s.id === sid) || null;
  const limit = Math.min(30, Number(p.get('limit') || 12)), offset = Number(p.get('offset') || 0);
  let rows = allMerchants.filter(m => (m.accepts||[]).some(a => a.scheme_id === sid));
  if (p.get('sido')) rows = rows.filter(m => m.sido === p.get('sido'));
  if (p.get('sigungu')) rows = rows.filter(m => m.sigungu === p.get('sigungu'));
  if (p.get('dong')) rows = rows.filter(m => m.dong === p.get('dong'));
  const registered = rows.length;
  if (p.get('q')) rows = rows.filter(m => m.name.includes(p.get('q')));
  if (p.get('category')) rows = rows.filter(m => m.category && m.category.code === p.get('category'));
  if (p.get('payment')) { const k = p.get('payment').toLowerCase(); rows = rows.filter(m => m.accepts.find(a => a.scheme_id === sid).payment_types[k] === true); }
  const nearby = p.has('latitude') && p.has('longitude');
  let withDistance = rows.map(m => ({m, d: null}));
  if (nearby) {
    const lat = Number(p.get('latitude')), lng = Number(p.get('longitude')), radius = Number(p.get('radius_meters') || 5000);
    withDistance = rows.filter(m => m.location).map(m => ({m, d: Math.round(hav(lat, lng, m.location.latitude, m.location.longitude))}))
      .filter(x => x.d <= radius).sort((a, b) => a.d - b.d);
  }
  const page = withDistance.slice(offset, offset + limit);
  const items = page.map(({m, d}) => ({...m, distance_meters: d, accepts: [...m.accepts].sort((a, b) => (a.scheme_id === sid ? -1 : 0) - (b.scheme_id === sid ? -1 : 0))}));
  const empty = withDistance.length ? null : registered === 0 ? 'NO_DATA_REGISTERED' : nearby ? 'NO_LOCATED_NEARBY' : 'NO_MATCH';
  return {schema_version:1, mode: nearby ? 'NEARBY' : 'REGION', scheme, total_count: withDistance.length, limit, offset,
    has_more: offset + page.length < withDistance.length, items, empty_reason: empty,
    official_merchant_search_url: scheme ? scheme.official_merchant_search_url : null, notice: F.notice || ''};
}
// 온누리상품권 tab: the existing onnuri contract, three test shops.
globalThis.__onnuri = {requests: []};
const onnuriShops = [
  {id:'1'.repeat(40),name:'테스트온누리상회',address:'강원특별자치도 춘천시 중앙로 1',sido:'강원특별자치도',sigungu:'춘천시',dong:'효자동',items:'반찬',market_name:'춘천중앙시장',paper:true,digital:true,latitude:37.8813,longitude:127.7298,geo_state:'VERIFIED'},
  {id:'2'.repeat(40),name:'테스트온누리카페',address:'강원특별자치도 춘천시 중앙로 2',sido:'강원특별자치도',sigungu:'춘천시',dong:'효자동',items:'커피',market_name:null,paper:false,digital:true,latitude:null,longitude:null,geo_state:'UNVERIFIED'},
  {id:'3'.repeat(40),name:'테스트온누리정육',address:'강원',sido:'강원특별자치도',sigungu:null,dong:null,items:'정육',market_name:null,paper:true,digital:false,latitude:null,longitude:null,geo_state:'UNVERIFIED'},
];
function onnuriResponse(url) {
  globalThis.__onnuri.requests.push(url.pathname + url.search);
  const source = {label:'소상공인시장진흥공단 전국 온누리상품권 가맹점 현황',source_date:'2026-07-31',synced_at:'2026-10-09T12:30:45+09:00'};
  if (url.pathname.endsWith('/regions')) return {contract_id:'CORE-ONNURI-MERCHANT-REGIONS-01',schema_version:1,availability:'AVAILABLE',level:url.searchParams.get('sido')?'SIGUNGU':'SIDO',
    regions:url.searchParams.get('sido')?[{name:'춘천시',count:2}]:[{name:'강원특별자치도',count:3}],data_source:source};
  return {contract_id:'CORE-ONNURI-MERCHANT-SEARCH-01',schema_version:1,availability:'AVAILABLE',mode:'ALL',data_source:source,
    items:onnuriShops,total_count:onnuriShops.length,has_more:false,next_offset:null};
}`;

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('voucher-result');
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  ${MOCK}
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname.startsWith('/v2/life/vouchers/')) { globalThis.__voucher.credentials = init && init.credentials; const body = voucherResponse(parsed); return body ? json(body) : Promise.resolve(new Response('{}', {status: 500})); }
    if (parsed.pathname.startsWith('/v2/life/onnuri/')) return json(onnuriResponse(parsed));
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=voucherunifiedp0');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="voucher-result" hidden>pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const lum = c => { const m = String(c).match(/\\d+(\\.\\d+)?/g); if (!m) return null; const [r,g,b] = m.slice(0,3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); if (x === null || y === null) return null; return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = node => { for (let n = node; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; } return getComputedStyle(document.body).backgroundColor; };
  const visible = node => Boolean(node) && !node.closest('[hidden]') && node.getClientRects().length > 0;
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const hub = workspace?.querySelector('.voucher-hub');
  const local = hub?.querySelector('.voucher-surface');
  const shortcut = workspace?.querySelector('[data-life-shortcut="onnuri"]');
  const shortcutLabel = shortcut?.querySelector('span');
  const lines = node => { const range = document.createRange(); range.selectNodeContents(node); return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; };
  const cards = [...(local?.querySelectorAll('.voucher-card') || [])].map(card => {
    const title = card.querySelector('.voucher-card-title');
    return {
      id: card.dataset.voucherMerchant, name: title?.textContent || '', text: card.textContent,
      head: card.querySelector('.voucher-card-head')?.textContent || '', address: card.querySelector('.voucher-card-address')?.textContent || '',
      basis: card.querySelector('.voucher-card-basis')?.textContent || '', status: card.querySelector('.voucher-card-status')?.textContent || '',
      distance: card.querySelector('.voucher-card-distance')?.textContent || '',
      accepts: [...card.querySelectorAll('.voucher-accept')].map(li => ({scheme: li.dataset.schemeId, name: li.querySelector('.voucher-accept-name')?.textContent || '',
        payment: li.querySelector('.voucher-accept-payment')?.textContent || '', source: li.querySelector('.voucher-accept-source')?.textContent || '',
        kind: li.querySelector('.voucher-accept-source')?.dataset.sourceKind || '', date: li.querySelector('.voucher-accept-date')?.textContent || ''})),
      links: [...card.querySelectorAll('a')].map(a => ({cls: a.className, action: a.dataset.mapAction || '', provider: a.dataset.mapProvider || '', href: a.getAttribute('href') || '',
        text: a.textContent, target: a.target, icon: a.querySelector('img')?.dataset.mapIcon || '', iconSrc: a.querySelector('img')?.getAttribute('src') || '',
        iconLoaded: Boolean(a.querySelector('img')?.complete && a.querySelector('img')?.naturalWidth > 0), box: box(a)})),
      box: box(card), overflowX: card.scrollWidth - card.clientWidth, bgLum: lum(getComputedStyle(card).backgroundColor),
      titleContrast: title ? contrast(getComputedStyle(title).color, bgOf(card)) : null,
    };
  });
  const regions = Object.fromEntries([...(local?.querySelectorAll('[data-voucher-region]') || [])].map(s => [s.dataset.voucherRegion, {visible: visible(s), value: s.value, options: [...s.options].map(o => o.value), box: box(s)}]));
  const empty = local?.querySelector('.voucher-empty:not([hidden])');
  return {
    viewport: {w: innerWidth, h: innerHeight}, hash: location.hash,
    themeAttr: document.body.dataset.siteTheme || document.documentElement.dataset.siteThemeBootstrap || '', bodyBgLum: lum(getComputedStyle(document.body).backgroundColor),
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    title: panel?.querySelector('.site-modal-header h2')?.textContent || '',
    backButton: (() => { const b = panel?.querySelector('.site-modal-close'); return b ? {label: b.getAttribute('aria-label'), box: box(b)} : null; })(),
    shortcuts: [...(workspace?.querySelectorAll('.consumer-shortcut') || [])].map(b => b.dataset.lifeShortcut),
    shortcut: shortcut ? {label: shortcutLabel?.textContent || '', box: box(shortcut), labelBox: box(shortcutLabel), lines: shortcutLabel ? lines(shortcutLabel) : 0,
      clipped: shortcutLabel ? shortcutLabel.scrollWidth > shortcutLabel.clientWidth + 1 || shortcutLabel.getBoundingClientRect().right > shortcut.getBoundingClientRect().right + 0.5 : true,
      columns: getComputedStyle(shortcut.parentElement).gridTemplateColumns.split(' ').filter(Boolean).length,
      slot: shortcut.querySelector('[data-brand-logo-slot]')?.dataset.logoState || '', img: Boolean(shortcut.querySelector('img'))} : null,
    hub: Boolean(hub), activeTab: hub?.dataset.voucherActiveTab || '',
    tablist: hub?.querySelector('[role="tablist"]')?.getAttribute('aria-label') || '',
    tabs: [...(hub?.querySelectorAll('[data-voucher-tab]') || [])].map(t => ({key: t.dataset.voucherTab, text: t.textContent, role: t.getAttribute('role'), selected: t.getAttribute('aria-selected') === 'true',
      tabIndex: t.tabIndex, focused: document.activeElement === t, controls: t.getAttribute('aria-controls'), box: box(t),
      contrast: contrast(getComputedStyle(t).color, bgOf(t))})),
    panels: [...(hub?.querySelectorAll('[data-voucher-panel]') || [])].map(p => ({key: p.dataset.voucherPanel, id: p.id, role: p.getAttribute('role'), hidden: p.hidden, labelledby: p.getAttribute('aria-labelledby')})),
    onnuri: {visible: visible(hub?.querySelector('.onnuri-surface')), cards: [...(hub?.querySelectorAll('.onnuri-card') || [])].map(c => ({label: c.querySelector('.onnuri-card-label')?.textContent || '', text: c.textContent})),
      requests: (globalThis.__onnuri?.requests || []).slice()},
    local: Boolean(local), localVisible: visible(local), regions,
    schemes: [...(local?.querySelectorAll('[data-voucher-scheme]') || [])].map(s => ({id: s.dataset.voucherScheme, name: s.querySelector('.voucher-scheme-name')?.textContent || '',
      level: s.querySelector('.voucher-scheme-level')?.textContent || '', levelKey: s.querySelector('.voucher-scheme-level')?.dataset.issuerLevel || '',
      meta: s.querySelector('.voucher-scheme-meta')?.textContent || '', area: s.querySelector('.voucher-scheme-area')?.textContent || '', pressed: s.getAttribute('aria-pressed') === 'true', box: box(s)})),
    schemeNote: local?.querySelector('.voucher-schemes-note')?.textContent || '', catalog: local?.querySelector('.voucher-catalog')?.textContent || '',
    filtersVisible: visible(local?.querySelector('.voucher-filters')), nearbyVisible: visible(local?.querySelector('.voucher-nearby')),
    nearbyPressed: local?.querySelector('.voucher-nearby')?.getAttribute('aria-pressed') === 'true',
    status: local?.querySelector('.voucher-status')?.textContent || '', scope: local?.querySelector('.voucher-scope')?.textContent || '',
    notice: local?.querySelector('.voucher-notice')?.textContent || '', notPartner: local?.querySelector('.voucher-not-partner')?.textContent || '',
    noticeContrast: (() => { const n = local?.querySelector('.voucher-notice'); return n ? contrast(getComputedStyle(n).color, bgOf(n)) : null; })(),
    appNote: local?.querySelector('.voucher-map-app')?.textContent || '',
    empty: empty ? {reason: empty.dataset.emptyReason, title: empty.querySelector('.voucher-empty-title')?.textContent || '', text: empty.textContent,
      official: empty.querySelector('[data-voucher-official]')?.getAttribute('href') || ''} : null,
    error: local?.querySelector('.voucher-error:not([hidden])')?.textContent || '',
    more: (() => { const m = local?.querySelector('.voucher-more'); return m && !m.hidden ? box(m) : null; })(),
    chips: [...(local?.querySelectorAll('[data-voucher-filter]') || [])].map(c => ({key: c.dataset.voucherFilter, value: c.dataset.value, pressed: c.getAttribute('aria-pressed') === 'true', h: c.getBoundingClientRect().height})),
    cards, columns: (() => { const l = local?.querySelector('.voucher-results'); return l ? getComputedStyle(l).gridTemplateColumns.split(' ').filter(Boolean).length : 0; })(),
    requests: (globalThis.__voucher?.requests || []).slice(), credentials: globalThis.__voucher?.credentials || '',
    payNow: /현재 결제 가능/.test(document.body.innerText || ''),
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
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
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
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

const chromePids = new Set();
async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  chromePids.add(chrome.pid);
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const events = [];
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    } else if (message.method) {
      events.push(message);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = async () => {
    try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch {}
    try { socket.close(); } catch {}
    try { chrome.kill('SIGTERM'); } catch {}
    await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 3000); } });
    if (chrome.exitCode !== null || chrome.signalCode) chromePids.delete(chrome.pid);
  };
  return {send, close, events};
}

const CHUNCHEON_CITY_HALL = {latitude: 37.8813, longitude: 127.7298};
const HREF = {
  route: {
    NAVER_MAP: {android: /^intent:\/\/navigation\?/u, ios: /\/map-handoff\.html\?provider=NAVER_MAP/u, desktop: /^https:\/\/map\.naver\.com\//u},
    KAKAO_NAVI: {android: /\/kakao-navi\.html\?/u, ios: /\/kakao-navi\.html\?/u, desktop: /^https:\/\/map\.kakao\.com\/link\/to\//u},
    TMAP: {android: /^intent:\/\/route\?/u, ios: /\/map-handoff\.html\?provider=TMAP/u, desktop: /^https:\/\/map\.naver\.com\//u},
    GOOGLE_MAPS: {android: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d+%2C12\d\.\d+/u, ios: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d+%2C12\d\.\d+/u, desktop: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d+%2C12\d\.\d+/u},
  },
  search: {
    NAVER_MAP: {android: /^intent:\/\/search\?/u, ios: /\/map-handoff\.html\?provider=NAVER_MAP/u, desktop: /^https:\/\/map\.naver\.com\//u},
    KAKAO_NAVI: {android: /^https:\/\/map\.kakao\.com\/\?q=/u, ios: /^https:\/\/map\.kakao\.com\/\?q=/u, desktop: /^https:\/\/map\.kakao\.com\/\?q=/u},
    TMAP: {android: /^intent:\/\/search\?/u, ios: /\/map-handoff\.html\?provider=TMAP/u, desktop: /^https:\/\/map\.naver\.com\//u},
    GOOGLE_MAPS: {android: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=%EA%B0%95/u, ios: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=%EA%B0%95/u, desktop: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=%EA%B0%95/u},
  },
};
const ICON = {NAVER_MAP: 'naver-map', KAKAO_NAVI: 'kakao-map', TMAP: 'tmap', GOOGLE_MAPS: 'google-maps'};

async function runCase(browser, origin, workDir, testCase) {
  const innerRel = `scripts/${path.basename(workDir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const platform = testCase.userAgent === ANDROID_UA ? 'android' : testCase.userAgent === IPHONE_UA ? 'ios' : 'desktop';
  const shots = process.env.VOUCHER_SCREENSHOT_DIR || '';
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
    await page('Network.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    // The OS scheme is the opposite of the Site theme: only the cookie decides.
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: testCase.dark ? 'light' : 'dark'}]});
    const probe = () => evaluate(PROBE);
    const waitState = async (predicate, label, timeoutMs = 20000) => {
      const started = Date.now();
      let last = null;
      for (;;) {
        last = await probe().catch(() => last);
        if (last && predicate(last)) return last;
        if (Date.now() - started > timeoutMs) {
          const brief = last && {title: last.title, activeTab: last.activeTab, status: last.status, schemeNote: last.schemeNote, empty: last.empty, error: last.error,
            cards: last.cards.length, schemes: last.schemes.map(s => s.name), regions: last.regions, requests: last.requests.slice(-3)};
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
    const key = async (name, code) => {
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code});
      await sleep(150);
    };
    const reveal = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'}), true`);
      await sleep(150);
      return await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    };
    const select = async (name, value) => {
      await evaluate(`(() => { const s = document.querySelector('[data-voucher-region="${name}"]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
      await sleep(250);
    };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const settled = v => v.status && !v.status.includes('찾는 중');
    const load = async ({cookies = [], geo = 'none'} = {}) => {
      await cdp.send('Browser.resetPermissions', {});
      if (geo === 'grant') {
        await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
        await page('Emulation.setGeolocationOverride', {...CHUNCHEON_CITY_HALL, accuracy: 20});
      } else {
        await page('Emulation.clearGeolocationOverride');
      }
      await page('Network.clearBrowserCookies');
      // Light/dark chosen in LOTBI settings (cookie); the OS scheme says the opposite.
      cookies = [...cookies, `lotbi_theme_preference_v1=${testCase.dark ? 'dark' : 'light'}`];
      for (const cookie of cookies) await page('Network.setCookie', {name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: origin});
      cdp.events.length = 0;
      await page('Page.navigate', {url: `${origin}/${innerRel}`});
      const ready = await waitFor(async () => {
        const value = await evaluate("document.getElementById('voucher-result')?.textContent || 'pending'").catch(() => 'pending');
        return value !== 'pending' ? value : null;
      }, `${testCase.label}: harness`, 60000);
      const parsed = JSON.parse(ready);
      if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(async () => (await probe()).shortcuts.includes('onnuri'), `${testCase.label}: life shortcuts`);
      await sleep(200);
    };
    const openHub = async () => {
      await tap(await reveal('.consumer-workspace [data-life-shortcut="onnuri"]'));
      return await waitState(v => v.hub && v.onnuri.visible && v.onnuri.cards.length === 3, `${testCase.label}: hub with onnuri tab`, 30000);
    };
    const openLocal = async () => {
      const at = await reveal('[data-voucher-tab="local"]');
      await tap(at);
      return await waitState(v => v.activeTab === 'local' && v.localVisible && v.regions.sido?.options.length > 1, `${testCase.label}: local tab`);
    };
    const layout = (v, label) => {
      check(v.pageOverflowX <= 0, `${testCase.label} ${label}: no horizontal page scroll (${v.pageOverflowX})`);
      check(v.panelOverflowX <= 0, `${testCase.label} ${label}: panel does not scroll sideways (${v.panelOverflowX})`);
      for (const tab of v.tabs) check(tab.box.h >= 44, `${testCase.label}: ${tab.text} tab touch target ${tab.box.h}`);
      for (const tab of v.tabs) check(tab.contrast >= 4.5, `${testCase.label}: ${tab.text} tab contrast ${tab.contrast}`);
      for (const scheme of v.schemes) check(scheme.box.h >= 44 && scheme.box.right <= v.viewport.w, `${testCase.label}: scheme chip ${scheme.name} size/position`);
      for (const chip of v.chips) if (v.filtersVisible) check(chip.h >= 44, `${testCase.label}: chip ${chip.value || '전체'} ${chip.h}`);
      for (const card of v.cards) {
        check(card.box.x >= 0 && card.box.right <= v.viewport.w + 0.5, `${testCase.label}: ${card.name} inside the viewport`);
        check(card.overflowX <= 0, `${testCase.label}: ${card.name} content fits`);
        check(card.titleContrast >= 4.5, `${testCase.label}: ${card.name} title contrast ${card.titleContrast}`);
        if (testCase.dark) check(card.bgLum < 0.2, `${testCase.label}: dark card ${card.bgLum}`);
        else check(card.bgLum > 0.6, `${testCase.label}: light card ${card.bgLum}`);
        for (const link of card.links) check(link.box.h >= 44, `${testCase.label}: ${link.text} touch target ${link.box.h}`);
      }
      if (v.noticeContrast !== null) check(v.noticeContrast >= 4.5, `${testCase.label}: notice contrast ${v.noticeContrast}`);
      check(!v.payNow, `${testCase.label} ${label}: never '현재 결제 가능'`);
    };

    // 1. 생활정보 card: label, no logo, fits its cell at this width.
    await load();
    let v = await probe();
    check(['온누리상품권·지역화폐', '온누리·지역화폐'].includes(v.shortcut.label), `${testCase.label}: card label ${v.shortcut.label}`);
    check(!v.shortcut.clipped, `${testCase.label}: card label not clipped (${v.shortcut.columns} columns, ${v.shortcut.lines} line(s))`);
    check(v.shortcut.box.right <= v.viewport.w && v.shortcut.box.x >= 0, `${testCase.label}: card inside the viewport`);
    check(v.shortcut.box.h >= 44, `${testCase.label}: card touch target`);
    same(v.shortcut.slot, 'PENDING_APPROVAL', 'logo slot kept, nothing drawn');
    same(v.shortcut.img, false, 'no logo image');
    check(v.pageOverflowX <= 0, `${testCase.label}: life home no horizontal scroll`);
    if (testCase.dark) check(v.themeAttr === 'dark' && v.bodyBgLum < 0.2, `${testCase.label}: cookie dark theme applied (${v.themeAttr})`);
    else check(v.themeAttr !== 'dark' && v.bodyBgLum > 0.6, `${testCase.label}: light theme while the OS says dark (${v.themeAttr})`);
    const cardInfo = {label: v.shortcut.label, columns: v.shortcut.columns, lines: v.shortcut.lines};
    if (testCase.mobile) {
      // A two-column phone grid (another room may switch the list to it): the
      // long name wraps inside its cell, never clipped or overflowing.
      const twoColumn = await evaluate(`(() => {
        const grid = document.querySelector('.consumer-workspace .consumer-shortcuts');
        const before = grid.style.gridTemplateColumns;
        grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        const card = grid.querySelector('[data-life-shortcut="onnuri"]'); const label = card.querySelector('span');
        const range = document.createRange(); range.selectNodeContents(label);
        const lines = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size;
        const out = {lines, clipped: label.scrollWidth > label.clientWidth + 1 || label.getBoundingClientRect().right > card.getBoundingClientRect().right + 0.5,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
        grid.style.gridTemplateColumns = before;
        return out;
      })()`);
      check(!twoColumn.clipped && twoColumn.lines <= 2 && twoColumn.overflow <= 0, `${testCase.label}: two-column grid label wraps gracefully ${JSON.stringify(twoColumn)}`);
      cardInfo.twoColumnLines = twoColumn.lines;
    }
    await shot('01-life');

    // 2. Hub: full title, tabs, 온누리상품권 tab = the existing onnuri screen.
    v = await openHub();
    same(v.title, '온누리상품권·지역화폐', `${testCase.label}: modal title`);
    same(v.tablist, '상품권 종류');
    same(v.tabs.map(tab => [tab.key, tab.text, tab.role]), [['onnuri', '온누리상품권', 'tab'], ['local', '지역화폐', 'tab']]);
    same(v.tabs.map(tab => tab.selected), [true, false]);
    same(v.tabs.map(tab => tab.tabIndex), [0, -1], 'roving tabindex');
    same(v.panels.map(panel => [panel.key, panel.role, panel.hidden]), [['onnuri', 'tabpanel', false], ['local', 'tabpanel', true]]);
    check(v.tabs.every(tab => v.panels.some(panel => panel.id === tab.controls)), 'aria-controls → panel');
    check(v.onnuri.cards.every(card => card.label === '온누리 가맹점'), 'onnuri cards unchanged');
    check(v.onnuri.cards.every(card => !/지역화폐|지역사랑/u.test(card.text)), 'onnuri cards never mention local currency');
    check(v.onnuri.requests.some(url => url.startsWith('/v2/life/onnuri/merchants')), 'onnuri tab reads the onnuri API');
    same(v.requests.filter(url => url.includes('/merchants')).length, 0, 'local-currency merchants not loaded before the tab');
    same(v.backButton?.label, '지역정보로 돌아가기');
    layout(v, 'hub');
    await shot('02-hub-onnuri');

    // 3. Keyboard: → / ← / End / Home move selection and focus.
    await evaluate("document.querySelector('[data-voucher-tab=\"onnuri\"]').focus(), true");
    await key('ArrowRight', 39);
    v = await waitState(s => s.activeTab === 'local' && s.tabs[1].focused && s.localVisible, `${testCase.label}: ArrowRight`);
    same(v.tabs.map(tab => tab.tabIndex), [-1, 0]);
    await key('ArrowLeft', 37);
    v = await waitState(s => s.activeTab === 'onnuri' && s.tabs[0].focused && s.onnuri.visible, `${testCase.label}: ArrowLeft`);
    check(v.onnuri.cards.length === 3, 'onnuri tab kept its results (mounted once)');
    await key('End', 35);
    v = await waitState(s => s.activeTab === 'local' && s.tabs[1].focused, `${testCase.label}: End`);
    await key('Home', 36);
    v = await waitState(s => s.activeTab === 'onnuri' && s.tabs[0].focused, `${testCase.label}: Home`);

    // 4. 지역화폐: 시·도 → 시·군·구 → both vouchers (광역 + 기초).
    v = await openLocal();
    check(v.regions.sido.visible && !v.regions.sigungu.visible && !v.regions.dong.visible, 'only 시·도 before a choice');
    check(/실시간 결제 가능 여부가 아니니/u.test(v.notice), `notice: ${v.notice}`);
    check(/공식·제휴 서비스가 아니에요/u.test(v.notPartner), 'not a partner service');
    check(!v.nearbyVisible, 'no 가까운 순 without an allowed location');
    await select('sido', '강원특별자치도');
    v = await waitState(s => s.regions.sigungu.visible && s.regions.sigungu.options.includes('춘천시'), `${testCase.label}: 시·군·구`);
    await select('sigungu', '춘천시');
    v = await waitState(s => s.schemes.length === 2 && s.regions.dong.visible, `${testCase.label}: schemes`);
    same(v.schemes.map(s => [s.name, s.level, s.levelKey]), [['강원상품권', '광역', 'PROVINCE'], ['춘천사랑상품권', '기초', 'CITY']], 'both 광역 and 기초');
    check(/발행 춘천시/u.test(v.schemes[1].meta) && /지류·모바일/u.test(v.schemes[1].meta), `issuer + known payment types (${v.schemes[1].meta})`);
    check(/모바일/u.test(v.schemes[0].meta) && !/지류/u.test(v.schemes[0].meta), 'unknown payment types are not guessed');
    check(/2가지 지역화폐/u.test(v.schemeNote), v.schemeNote);
    same(v.schemes.map(s => s.area), ['', '춘천시 안에서만 쓸 수 있어요(테스트 안내).'], 'usage_area_note shown only when present');
    check(/행정안전부 내고장알리미/u.test(v.catalog), 'catalog source shown');
    same(v.cards.length, 0, 'no merchant list before a voucher is chosen');
    layout(v, 'schemes');
    await shot('03-schemes');

    // 5. 춘천사랑상품권 → 12, 더 보기 → 24, still more.
    await tap(await reveal('[data-voucher-scheme="vs_chuncheon_city"]'));
    v = await waitState(s => s.cards.length === 12 && settled(s), `${testCase.label}: first 12`);
    const first = v.requests.filter(url => url.startsWith('/v2/life/vouchers/merchants')).at(-1);
    const firstUrl = new URL(first, origin);
    same([firstUrl.searchParams.get('scheme_id'), firstUrl.searchParams.get('sido'), firstUrl.searchParams.get('sigungu'), firstUrl.searchParams.get('limit'), firstUrl.searchParams.get('offset')],
      ['vs_chuncheon_city', '강원특별자치도', '춘천시', '12', '0'], 'merchant request');
    same(v.credentials, 'omit', 'credentials omitted');
    check(v.schemes.find(s => s.id === 'vs_chuncheon_city').pressed, 'chosen voucher marked');
    check(v.more, 'more available');
    check(v.filtersVisible && !v.nearbyVisible, 'no 가까운 순 without an allowed location');
    check(v.requests.every(url => !url.includes('latitude=')), 'no location sent');
    check(/26곳 중 12곳/u.test(v.status), v.status);
    layout(v, 'list-12');
    await shot('04-list');
    await tap(await reveal('.voucher-more'));
    v = await waitState(s => s.cards.length === 24 && settled(s), `${testCase.label}: 24 after more`);
    same(new Set(v.cards.map(card => card.id)).size, 24, 'no duplicates');
    check(v.requests.at(-1).includes('offset=12') && v.requests.at(-1).includes('limit=12'), 'second page offset 12');
    check(v.more, 'still more after 24');
    // Card content.
    const byId = Object.fromEntries(v.cards.map(card => [card.id, card]));
    for (const card of v.cards) {
      check(card.accepts.length >= 1 && card.accepts[0].scheme === 'vs_chuncheon_city', `${card.name}: searched voucher first`);
      for (const accept of card.accepts) {
        check(SOURCE_TEXTS.includes(accept.source), `${card.name}: exact source label (${accept.source})`);
        same(accept.source, VOUCHER_SOURCE_LABELS[accept.kind], `${card.name}: label matches kind`);
        check(/^마지막 확인 \d{4}-\d{2}-\d{2}$/u.test(accept.date), `${card.name}: last verified (${accept.date})`);
      }
      check(!/온누리/u.test(card.text), `${card.name}: a local-currency card never says 온누리`);
      const map = card.links.find(link => link.cls.includes('voucher-card-map'));
      check(map && map.provider === 'NAVER_MAP' && map.icon === 'naver-map' && map.iconLoaded, `${card.name}: default map app icon (${JSON.stringify(map && {p: map.provider, i: map.icon, l: map.iconLoaded})})`);
      check(map.target === '_blank', 'map opens outside');
      // ONNURI-REMOVE-RELATION-MAP-01 rule shared by both tabs: one map button per card.
      same(card.links.filter(link => link.action).length, 1, `${card.name}: exactly one map button`);
      check(!card.links.some(link => /지도에서 보기/u.test(link.text || '')), `${card.name}: no separate '지도에서 보기'`);
    }
    same(new Set(v.cards.flatMap(card => card.accepts.map(a => a.source))).size, 4, 'all four source labels appear');
    check(byId.vm_cc_001.accepts.map(a => a.name).join(',') === '춘천사랑상품권,강원상품권', 'both vouchers listed on a shop that takes both');
    check(byId.vm_cc_001.accepts[0].payment === '지류' && byId.vm_cc_002.accepts[0].payment === '지류·모바일', `payment types when known (${byId.vm_cc_001.accepts[0].payment}/${byId.vm_cc_002.accepts[0].payment})`);
    same(byId.vm_cc_003.accepts[0].payment, '', 'no payment text when unknown');
    check(/상세 위치는 확인되지 않았어요/u.test(byId.vm_cc_002.basis), 'REGION_ONLY wording');
    same(byId.vm_cc_002.links.find(link => link.action).action, 'search', 'REGION_ONLY → address search, no pin');
    same(byId.vm_cc_003.links.find(link => link.action).action, 'search', 'no location → address search');
    check(/주소로만/u.test(byId.vm_cc_003.basis), 'no coordinate said');
    same(byId.vm_cc_005.links.find(link => link.action).action, 'route', 'located → coordinate link');
    check(/휴업/u.test(byId.vm_cc_004.status), 'SUSPENDED shown');
    same(byId.vm_cc_001.links.filter(link => link.href.startsWith('tel:')).map(link => link.href), ['tel:0332541234'], 'phone when present');
    check(v.cards.filter(card => card.id !== 'vm_cc_001').every(card => !card.links.some(link => link.href.startsWith('tel:'))), 'no phone button otherwise');
    check(/음식점/u.test(byId.vm_cc_001.head) && /한식/u.test(byId.vm_cc_001.text), '업종 shown');
    layout(v, 'list-24');

    // 6. The customer's map app (4 providers): icon + coordinate vs address search.
    const mapResults = {};
    for (const provider of ['KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS', 'NAVER_MAP']) {
      await page('Network.setCookie', {name: 'lotbi_default_map_provider_v1', value: provider, url: origin});
      await evaluate("document.dispatchEvent(new Event('visibilitychange')), true");
      v = await waitState(s => s.cards.length && s.cards.every(card => card.links.some(link => link.provider === provider)), `${testCase.label}: ${provider}`);
      const route = v.cards.find(card => card.id === 'vm_cc_005').links.find(link => link.action === 'route');
      const searchLink = v.cards.find(card => card.id === 'vm_cc_003').links.find(link => link.action === 'search');
      const icon = provider === 'TMAP' && platform === 'desktop' ? 'naver-map' : ICON[provider];
      check(route.icon === icon && searchLink.icon === icon, `${testCase.label}: ${provider} icon ${route.icon}`);
      check(route.iconSrc === `/assets/place-actions/${icon}.png?v=place-icons-20260925`, `icon asset ${route.iconSrc}`);
      await waitState(s => s.cards.every(card => card.links.filter(link => link.action).every(link => link.iconLoaded)), `${testCase.label}: ${provider} icons loaded`);
      check(HREF.route[provider][platform].test(route.href), `${testCase.label}: ${provider} route ${route.href.slice(0, 120)}`);
      check(HREF.search[provider][platform].test(searchLink.href), `${testCase.label}: ${provider} search ${searchLink.href.slice(0, 120)}`);
      check(!/navigation|route|link\/to|travelmode/u.test(searchLink.href) || provider === 'NAVER_MAP' && platform !== 'android', `${testCase.label}: ${provider} address search is not a route`);
      if (provider !== 'NAVER_MAP') check(!v.cards.some(card => card.links.some(link => link.provider === 'NAVER_MAP')), `${provider} never replaced by NAVER`);
      mapResults[provider] = route.text;
    }
    await shot('05-map-apps');

    // 7. Filters send the contract query; 0 results explained.
    await evaluate("(() => { const i = document.querySelector('[data-voucher-query]'); i.focus(); i.select(); return true; })()");
    await page('Input.insertText', {text: '닭갈비'});
    await tap(await reveal('.voucher-search-button'));
    v = await waitState(s => settled(s) && s.cards.length === 2, `${testCase.label}: q`);
    check(new URL(v.requests.at(-1), origin).searchParams.get('q') === '닭갈비' && v.requests.at(-1).includes('offset=0'), 'q sent, paging reset');
    same(v.cards.map(card => card.name).sort(), ['닭갈비골목집', '명동닭갈비'].sort());
    await evaluate("(() => { const i = document.querySelector('[data-voucher-query]'); i.value = ''; i.form.requestSubmit(); return true; })()");
    await waitState(s => settled(s) && s.cards.length === 12, `${testCase.label}: q cleared`);
    await tap(await reveal('[data-voucher-filter="category"][data-value="CAFE"]'));
    v = await waitState(s => settled(s) && s.requests.at(-1).includes('category=CAFE'), `${testCase.label}: category`);
    check(v.cards.length > 0 && v.cards.every(card => /카페·간식/u.test(card.head)), 'category filtered');
    await tap(await reveal('[data-voucher-filter="payment"][data-value="MOBILE"]'));
    v = await waitState(s => (settled(s) || s.empty) && s.requests.at(-1).includes('payment=MOBILE') && s.requests.at(-1).includes('category=CAFE'), `${testCase.label}: payment`);
    check(v.cards.every(card => /모바일/u.test(card.accepts[0].payment)), 'payment filtered');
    await tap(await reveal('[data-voucher-filter="category"][data-value="HEALTH"]'));
    await tap(await reveal('[data-voucher-filter="payment"][data-value="CARD"]'));
    v = await waitState(s => s.empty && s.requests.at(-1).includes('payment=CARD'), `${testCase.label}: no match`);
    same(v.empty.reason, 'NO_MATCH');
    check(/조건에 맞는 가맹점을 찾지 못했어요/u.test(v.empty.title), v.empty.title);
    await tap(await reveal('[data-voucher-filter="category"][data-value=""]'));
    await tap(await reveal('[data-voucher-filter="payment"][data-value=""]'));
    await waitState(s => settled(s) && s.cards.length === 12, `${testCase.label}: filters cleared`);
    await select('dong', '효자동');
    v = await waitState(s => settled(s) && s.requests.at(-1).includes('dong='), `${testCase.label}: dong`);
    check(v.cards.length > 0 && v.cards.every(card => card.address.includes('효자동')), '읍·면·동 narrows');

    // 8. NO_DATA_REGISTERED: exact text + official link; 강원상품권 still lists 춘천 shops.
    await select('sigungu', '원주시');
    v = await waitState(s => s.schemes.length === 2, `${testCase.label}: 원주 schemes`);
    await tap(await reveal('[data-voucher-scheme="vs_wonju_city"]'));
    v = await waitState(s => s.empty, `${testCase.label}: no data`);
    same(v.empty.reason, 'NO_DATA_REGISTERED');
    same(v.empty.title, VOUCHER_NO_DATA_TEXT);
    same(v.empty.title, '현재 LOTBI에 등록된 가맹점 정보가 없습니다.');
    check(/가맹점이 없다는 뜻은 아니에요/u.test(v.empty.text), 'does not claim there are none');
    same(v.empty.official, 'https://www.wonju.go.kr/www/contents.do?key=voucher-merchants', 'official merchant search link');
    layout(v, 'no-data');
    await shot('06-no-data');
    await select('sigungu', '춘천시');
    v = await waitState(s => s.schemes.length === 2, `${testCase.label}: back to 춘천`);
    await tap(await reveal('[data-voucher-scheme="vs_gangwon_province"]'));
    v = await waitState(s => settled(s) && s.cards.length === 7, `${testCase.label}: 강원상품권`);
    check(v.cards.every(card => card.accepts[0].name === '강원상품권'), 'province voucher first on its own list');
    // A region with no voucher in the official list.
    await select('sido', '대전광역시');
    await waitState(s => s.regions.sigungu.options.includes('유성구'), `${testCase.label}: 대전`);
    await select('sigungu', '유성구');
    v = await waitState(s => /공식 목록에 등록돼 있지 않아요/u.test(s.schemeNote), `${testCase.label}: no scheme`);
    same(v.schemes.length, 0);
    same(v.cards.length, 0);

    // 9. Remember the tab inside the open modal; failure → retry.
    await tap(await reveal('[data-voucher-tab="onnuri"]'));
    v = await waitState(s => s.activeTab === 'onnuri' && s.onnuri.visible, `${testCase.label}: back to onnuri tab`);
    await tap(await reveal('[data-voucher-tab="local"]'));
    v = await waitState(s => s.activeTab === 'local', `${testCase.label}: local again`);
    same([v.regions.sido.value, v.regions.sigungu.value], ['대전광역시', '유성구'], 'local tab kept its choices');
    if (testCase.full) {
      await select('sido', '강원특별자치도');
      await waitState(s => s.regions.sigungu.options.includes('춘천시'), `${testCase.label}: 강원 again`);
      await select('sigungu', '춘천시');
      await waitState(s => s.schemes.length === 2, `${testCase.label}: 춘천 again`);
      await evaluate('globalThis.__voucher.failNext = 1, true');
      await tap(await reveal('[data-voucher-scheme="vs_chuncheon_city"]'));
      v = await waitState(s => s.error.includes('불러오지 못했어요'), `${testCase.label}: failure`);
      await tap(await reveal('.voucher-error button'));
      v = await waitState(s => settled(s) && s.cards.length === 12 && !s.error, `${testCase.label}: retried`);
    }

    // 10. ← returns to 지역정보; reopening starts on 온누리상품권 again.
    await tap(await reveal('.consumer-workspace .site-modal-close'));
    v = await waitState(s => !s.hub && s.shortcuts.includes('onnuri'), `${testCase.label}: back to 지역정보`);
    v = await openHub();
    same(v.activeTab, 'onnuri', 'a new modal starts on 온누리상품권');
    // Browser back/forward around the screen (same 'life' route as today).
    const hashOpen = v.hash;
    await evaluate('history.back(), true');
    v = await waitState(s => !s.hub && s.hash !== hashOpen, `${testCase.label}: browser back`);
    await evaluate('history.forward(), true');
    v = await waitState(s => s.shortcuts.includes('onnuri') && s.hash === hashOpen, `${testCase.label}: browser forward`);

    if (testCase.full) {
      // 11. Location already allowed → 가까운 순 offered; it sends the rounded point.
      await load({geo: 'grant'});
      v = await openHub();
      v = await openLocal();
      await select('sido', '강원특별자치도');
      await waitState(s => s.regions.sigungu.options.includes('춘천시'), `${testCase.label}: 강원 (geo)`);
      await select('sigungu', '춘천시');
      await waitState(s => s.schemes.length === 2, `${testCase.label}: schemes (geo)`);
      const before = (await probe()).requests.filter(url => url.includes('latitude=')).length;
      same(before, 0, 'no location sent before the user asks');
      await tap(await reveal('[data-voucher-scheme="vs_chuncheon_city"]'));
      v = await waitState(s => settled(s) && s.cards.length === 12, `${testCase.label}: list (geo)`);
      check(v.nearbyVisible, 'nearby offered when location is already allowed');
      await tap(await reveal('.voucher-nearby'));
      v = await waitState(s => s.nearbyPressed && settled(s) && s.requests.at(-1).includes('latitude='), `${testCase.label}: nearby`);
      check(/latitude=37\.881&longitude=127\.73/u.test(v.requests.at(-1)), `rounded point ${v.requests.at(-1)}`);
      const distances = v.cards.map(card => card.distance).filter(Boolean);
      check(distances.length === v.cards.length, 'every nearby card has a distance');
      check(v.cards.every(card => card.id !== 'vm_cc_002' && card.id !== 'vm_cc_003'), 'unlocated shops are not in the distance list');
      // Location use off in LOTBI settings → not offered, nothing asked.
      await load({geo: 'grant', cookies: ['lotbi_location_usage_v1=off']});
      v = await openHub();
      v = await openLocal();
      await select('sido', '강원특별자치도');
      await waitState(s => s.regions.sigungu.options.includes('춘천시'), `${testCase.label}: 강원 (off)`);
      await select('sigungu', '춘천시');
      await waitState(s => s.schemes.length === 2, `${testCase.label}: schemes (off)`);
      await tap(await reveal('[data-voucher-scheme="vs_chuncheon_city"]'));
      v = await waitState(s => settled(s) && s.cards.length === 12, `${testCase.label}: list (off)`);
      check(v.filtersVisible && !v.nearbyVisible, 'no 가까운 순 when location use is off');
      check(v.requests.every(url => !url.includes('latitude=')), 'no location sent when off');
    }

    const errors = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown'
      || (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error'));
    same(errors.map(event => JSON.stringify(event.params).slice(0, 300)), [], `${testCase.label}: no console errors`);
    return {card: cardInfo, cards: 24, mapApps: mapResults};
  } finally {
    await cdp.close();
  }
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.voucher-unified-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(workDir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, workDir, testCase);
    console.log(`VOUCHER_UNIFIED ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (const pid of chromePids) { try { process.kill(pid); } catch {} }
  // Chrome's helper processes can hold profile files for a moment after exit.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); } catch {}
    if (!fs.existsSync(workDir)) break;
    await sleep(500);
  }
}

console.log(`LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0 OK — ${passed} checks: 온누리상품권·지역화폐 card/title, tabs + keyboard, onnuri tab unchanged, 시·도→시·군·구→광역+기초 지역화폐, 12 + 더 보기, filters, NO_DATA/NO_MATCH/no-scheme, exact source labels, 4 map apps, location only when allowed, light/dark (viewport emulation, not a device run)`);
