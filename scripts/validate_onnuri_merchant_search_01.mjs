// ONNURI-MERCHANT-01 — 생활정보 '온누리상품권' 가맹점 찾기.
//
// Node part: the response normalizer, request URLs, the chat location rule and
// source guards (no official logo before approval, no storage, no partner claim).
// Browser part: the real app (index.html) with Core mocked in the page, real
// touch/mouse input through the DevTools protocol on 375x812, 390x844 and
// 1280x900. Viewport emulation only — not an iPhone Safari / KakaoTalk device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {lifeLocationIntent} from '../site-life-location.js';
import {
  ONNURI_CARD_LABEL,
  ONNURI_DISCLAIMER,
  ONNURI_LOGO_ASSET,
  ONNURI_MENU_LABEL,
  acceptanceLabel,
  normalizeOnnuriMerchant,
  normalizeOnnuriSearch,
  onnuriRegionsUrl,
  onnuriSearchUrl,
} from '../site-life-onnuri.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ID = n => String(n).padStart(40, 'a').slice(-40).replace(/[^0-9a-f]/gu, 'b');

// ── Node: contract, URLs, chat location, guards ─────────────────────────
{
  const onnuri = LIFE_SHORTCUTS.find(item => item.id === 'onnuri');
  assert.equal(onnuri.label, '온누리상품권');
  assert.equal(ONNURI_MENU_LABEL, '온누리상품권');
  assert.equal(ONNURI_CARD_LABEL, '온누리 가맹점');
  assert.equal(onnuri.icon, undefined, 'no stand-in icon for the official logo');
  assert.equal(onnuri.brandSlot, 'onnuri');
  assert.equal(ONNURI_LOGO_ASSET, '', 'official logo is not used before approval');
  assert.match(ONNURI_DISCLAIMER, /공식·제휴 서비스가 아니에요/u);
  assert.match(ONNURI_DISCLAIMER, /실시간 결제 가능 여부는 아니/u);

  const verified = normalizeOnnuriMerchant({id: ID(1), name: '만성커피', address: '전북 전주시 덕진구 만성중앙로 50', geo_state: 'VERIFIED', latitude: 35.847, longitude: 127.061, distance_meters: 80, paper: false, digital: true});
  assert.equal(verified.distanceMeters, 80);
  const unverified = normalizeOnnuriMerchant({id: ID(2), name: 'A', address: 'B', geo_state: 'UNVERIFIED', latitude: 35.8, longitude: 127.1, distance_meters: 80});
  assert.equal(unverified.distanceMeters, null, 'no distance without a verified coordinate');
  assert.equal(unverified.latitude, null);
  assert.equal(normalizeOnnuriMerchant({id: 'x', name: 'A', address: 'B'}), null);
  assert.equal(normalizeOnnuriMerchant({id: ID(3), name: 'A', address: 'B', geo_state: 'VERIFIED', latitude: 35.8, longitude: 127.1, distance_meters: null}).distanceMeters, null, 'null distance is not 0m');
  assert.equal(acceptanceLabel(verified), '디지털(모바일·카드) 가맹');
  assert.equal(acceptanceLabel({paper: null, digital: null}), '취급 형태 정보 없음', 'unknown is never guessed');
  const search = normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 1, availability: 'AVAILABLE',
    items: [{id: ID(1), name: 'A', address: 'B'}, {id: ID(1), name: 'A', address: 'B'}], total_count: 2, has_more: false,
    data_source: {source_date: '2026-07-31', synced_at: '2026-10-08T17:00:00+09:00'}});
  assert.equal(search.items.length, 1, 'same merchant once');
  assert.equal(search.sourceDate, '2026-07-31');
  assert.equal(normalizeOnnuriSearch({contract_id: 'OTHER', schema_version: 1}), null);

  const near = new URL(onnuriSearchUrl({latitude: 35.84661, longitude: 127.06063, sido: '전북', category: 'CAFE', accept: 'DIGITAL', offset: 3}));
  assert.equal(near.searchParams.get('latitude'), '35.847');
  assert.equal(near.searchParams.get('sido'), null, 'location and region are never mixed');
  assert.equal(near.searchParams.get('category'), 'CAFE');
  assert.equal(near.searchParams.get('accept'), 'DIGITAL');
  const region = new URL(onnuriSearchUrl({sido: '전북특별자치도', sigungu: '전주시 덕진구', dong: '만성동'}));
  assert.equal(region.searchParams.get('latitude'), null);
  assert.equal(region.searchParams.get('dong'), '만성동');
  assert.equal(region.pathname, '/v2/life/onnuri/merchants');
  assert.equal(new URL(onnuriRegionsUrl({sido: '전북특별자치도', sigungu: '익산시'})).searchParams.get('sigungu'), '익산시');

  for (const text of ['롯비야, 내 주변 온누리상품권 가맹점 찾아줘', '온누리 가능한 카페 가까운 순서로 보여줘', '모바일 온누리 되는 곳만 보여줘', '근처 동물병원']) {
    assert.equal(lifeLocationIntent(text), true, text);
  }
  for (const text of ['온누리약국 전화번호 알려줘', '전주 맛집 알려줘', '가까운 2곳 알려줘']) assert.equal(lifeLocationIntent(text), false, text);
  const recent = [{role: 'user', text: '내 주변 온누리상품권 가맹점 찾아줘'}, {role: 'assistant', text: '**온누리상품권 가맹점**\n조건: 현재 위치 근처'}];
  assert.equal(lifeLocationIntent('가까운 2곳 알려줘', recent), true);
  assert.equal(lifeLocationIntent('그중 가장 가까운 곳 길찾기', recent), true);
  assert.equal(lifeLocationIntent('오늘 날씨 어때', recent), false);

  const source = read('site-life-onnuri.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|innerHTML|indexedDB|document\.cookie\s*=/u);
  assert.doesNotMatch(source, /onnuri\.gift|cdn\.onnuri|🎟|#EB6620/iu, 'no copied official logo / brand asset');
  assert.doesNotMatch(read('site-consumer-sections.js'), /\bfetch\(|geolocation|getCurrentPosition/u);
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
  throw new Error('Chrome/Chromium is required for the Onnuri merchant validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

// Core's public read, served inside the page: the same filters and ordering
// rules as app/onnuri_merchants.search_merchants, on test merchants.
const MOCK = String.raw`
const merchants = [
  {id:'1'.repeat(40),name:'만성커피',address:'전북특별자치도 전주시 덕진구 만성중앙로 50',sido:'전북특별자치도',sigungu:'전주시 덕진구',dong:'만성동',items:'커피',market_name:null,paper:false,digital:true,lat:35.8470,lng:127.0610},
  {id:'2'.repeat(40),name:'만성한식당',address:'전북특별자치도 전주시 덕진구 만성중앙로 60',sido:'전북특별자치도',sigungu:'전주시 덕진구',dong:'만성동',items:'한식',market_name:null,paper:true,digital:true,lat:35.8480,lng:127.0625},
  {id:'3'.repeat(40),name:'남부시장콩나물국밥',address:'전북특별자치도 전주시 완산구 풍남문2길 63',sido:'전북특별자치도',sigungu:'전주시 완산구',dong:'전동',items:'음식점',market_name:'전주남부시장',paper:true,digital:true,lat:35.8125,lng:127.1470},
  {id:'4'.repeat(40),name:'명동칼국수',address:'전북특별자치도 전주시 완산구 홍산로 100',sido:'전북특별자치도',sigungu:'전주시 완산구',dong:'효자동2가',items:'음식점',market_name:null,paper:true,digital:true,lat:35.8160,lng:127.1080},
  {id:'5'.repeat(40),name:'중앙청과',address:'전북특별자치도 익산시 중앙동3가 12-3',sido:'전북특별자치도',sigungu:'익산시',dong:'중앙동',items:'과일',market_name:'익산중앙시장',paper:true,digital:true,lat:null,lng:null},
  {id:'6'.repeat(40),name:'공설수산',address:'전북특별자치도 군산시 대명동 1-1',sido:'전북특별자치도',sigungu:'군산시',dong:'대명동',items:'수산물',market_name:'군산공설시장',paper:true,digital:false,lat:null,lng:null},
  {id:'7'.repeat(40),name:'효자분식',address:'전북특별자치도 전주시 완산구 효자로 10',sido:'전북특별자치도',sigungu:'전주시 완산구',dong:'효자동1가',items:'분식',market_name:null,paper:true,digital:true,lat:35.8150,lng:127.1100},
  {id:'8'.repeat(40),name:'덕진베이커리',address:'전북특별자치도 전주시 덕진구 권삼득로 5',sido:'전북특별자치도',sigungu:'전주시 덕진구',dong:'덕진동1가',items:'제과',market_name:null,paper:false,digital:true,lat:35.8460,lng:127.1250},
];
const words = {FOOD:['음식','한식','분식','국밥','칼국수'],CAFE:['커피','제과','카페'],GROCERY:['과일','수산'],CLOTHING:['의류'],LIVING:['생활']};
const hav = (a,b,c,d) => { const r=x=>x*Math.PI/180; const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2; return 2*6371000*Math.asin(Math.sqrt(h)); };
globalThis.__onnuri = {requests: [], notReady: false};
function onnuriResponse(url) {
  globalThis.__onnuri.requests.push(url.pathname + url.search);
  const p = url.searchParams;
  const source = {label:'소상공인시장진흥공단 전국 온누리상품권 가맹점 현황',source_date:'2026-07-31',synced_at:'2026-10-08T17:00:00+09:00'};
  if (url.pathname.endsWith('/regions')) {
    const sido = p.get('sido'), sigungu = p.get('sigungu');
    const pick = !sido ? merchants.map(m=>m.sido) : !sigungu ? merchants.filter(m=>m.sido===sido).map(m=>m.sigungu) : merchants.filter(m=>m.sido===sido&&(m.sigungu===sigungu||m.sigungu.startsWith(sigungu+' '))).map(m=>m.dong);
    return {contract_id:'CORE-ONNURI-MERCHANT-REGIONS-01',schema_version:1,availability:'AVAILABLE',level:!sido?'SIDO':!sigungu?'SIGUNGU':'DONG',regions:[...new Set(pick)].sort().map(name=>({name,count:1})),data_source:source};
  }
  if (globalThis.__onnuri.notReady) return {contract_id:'CORE-ONNURI-MERCHANT-SEARCH-01',schema_version:1,availability:'NOT_READY',mode:'NONE',items:[],total_count:0,has_more:false,next_offset:null,data_source:null};
  let rows = merchants.slice();
  const lat = Number(p.get('latitude')), lng = Number(p.get('longitude'));
  const nearby = p.has('latitude');
  if (!nearby) {
    if (p.get('sido')) rows = rows.filter(m=>m.sido===p.get('sido'));
    if (p.get('sigungu')) rows = rows.filter(m=>m.sigungu===p.get('sigungu')||m.sigungu.startsWith(p.get('sigungu')+' '));
    if (p.get('dong')) rows = rows.filter(m=>m.dong===p.get('dong'));
  }
  if (p.get('category')) rows = rows.filter(m=>words[p.get('category')].some(w=>(m.items||'').includes(w)||m.name.includes(w)));
  if (p.get('accept')==='PAPER') rows = rows.filter(m=>m.paper===true);
  if (p.get('accept')==='DIGITAL') rows = rows.filter(m=>m.digital===true);
  if (nearby) rows = rows.filter(m=>m.lat!==null).map(m=>({...m,d:Math.round(hav(lat,lng,m.lat,m.lng))})).sort((a,b)=>a.d-b.d);
  else rows.sort((a,b)=>a.sigungu.localeCompare(b.sigungu)||a.name.localeCompare(b.name));
  const limit = Number(p.get('limit')||3), offset = Number(p.get('offset')||0);
  const page = rows.slice(offset, offset+limit);
  const hasMore = offset+page.length < rows.length;
  return {contract_id:'CORE-ONNURI-MERCHANT-SEARCH-01',schema_version:1,availability:'AVAILABLE',mode:nearby?'NEARBY':'REGION',location_used:nearby,
    items:page.map(m=>({id:m.id,name:m.name,market_name:m.market_name,address:m.address,items:m.items,sido:m.sido,sigungu:m.sigungu,dong:m.dong,paper:m.paper,digital:m.digital,mobile:null,card:null,registered_year:2020,
      latitude:m.lat,longitude:m.lng,geo_state:m.lat!==null?'VERIFIED':'UNVERIFIED',distance_meters:nearby?m.d:null})),
    total_count:rows.length,has_more:hasMore,next_offset:hasMore?offset+page.length:null,data_source:source,notice:'',digital_notice:''};
}`;

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
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
    if (parsed.pathname.startsWith('/v2/life/onnuri/')) return json(onnuriResponse(parsed));
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=onnurimerchant01');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="onnuri-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const surface = workspace?.querySelector('.onnuri-surface');
  const cards = [...(surface?.querySelectorAll('.onnuri-card') || [])].map(card => ({
    id: card.dataset.onnuriMerchant, name: card.querySelector('.onnuri-card-title')?.textContent || '',
    label: card.querySelector('.onnuri-card-label')?.textContent || '', distance: card.querySelector('.onnuri-card-distance')?.textContent || '',
    accept: card.querySelector('.onnuri-card-accept')?.textContent || '', map: card.querySelector('.onnuri-card-map')?.getAttribute('href') || '',
    mapLabel: card.querySelector('.onnuri-card-map')?.textContent || '', box: box(card),
    logoImg: Boolean(card.querySelector('.onnuri-logo-slot img')), logoVisible: (() => { const s = card.querySelector('.onnuri-logo-slot'); return s ? getComputedStyle(s).display !== 'none' : false; })(),
    bg: getComputedStyle(card).backgroundColor, fg: getComputedStyle(card).color,
  }));
  const shortcut = workspace?.querySelector('[data-life-shortcut="onnuri"]');
  return {
    open: Boolean(workspace), title: panel?.querySelector('.site-modal-header h2, h2')?.textContent || '',
    viewport: {w: innerWidth, h: innerHeight}, panel: box(panel),
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    shortcuts: [...(workspace?.querySelectorAll('.consumer-shortcut') || [])].map(b => b.dataset.lifeShortcut),
    shortcut: shortcut ? {label: shortcut.textContent, slot: shortcut.querySelector('[data-brand-logo-slot]')?.dataset.logoState || '', img: Boolean(shortcut.querySelector('img')), svg: Boolean(shortcut.querySelector('svg')), box: box(shortcut)} : null,
    surface: Boolean(surface),
    disclaimer: surface?.querySelector('.onnuri-disclaimer')?.textContent || '',
    brandImg: Boolean(surface?.querySelector('.onnuri-brand img')),
    status: surface?.querySelector('.onnuri-status')?.textContent || '',
    note: surface?.querySelector('.onnuri-location-note')?.textContent || '',
    settingsLink: surface?.querySelector('.onnuri-location-note a')?.getAttribute('href') || '',
    error: surface?.querySelector('.onnuri-error:not([hidden])')?.textContent || '',
    more: (() => { const m = surface?.querySelector('.onnuri-more'); return m && !m.hidden ? box(m) : null; })(),
    locate: box(surface?.querySelector('.onnuri-locate')),
    digitalNote: Boolean(surface?.querySelector('.onnuri-digital-note:not([hidden])')),
    source: surface?.querySelector('.onnuri-source')?.textContent || '',
    regions: Object.fromEntries([...(surface?.querySelectorAll('[data-onnuri-region]') || [])].map(s => [s.dataset.onnuriRegion, {disabled: s.disabled, options: [...s.options].map(o => o.value), box: box(s)}])),
    cards,
    requests: globalThis.__onnuri.requests.slice(),
    emoji: /🎟/u.test(document.body.textContent || ''),
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
    const value = await fn();
    if (value) return value;
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

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.ONNURI_SCREENSHOT_DIR || '';
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
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    const probe = () => evaluate(PROBE);
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
      await sleep(120);
      return await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    };
    const select = async (key, value) => {
      await evaluate(`(() => { const s = document.querySelector('[data-onnuri-region="${key}"]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
      await sleep(250);
    };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const load = async ({cookie = '', grant = false} = {}) => {
      if (grant) {
        await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
        await page('Emulation.setGeolocationOverride', {latitude: 35.8466, longitude: 127.0606, accuracy: 20});
      } else {
        await cdp.send('Browser.resetPermissions', {});
        await page('Emulation.clearGeolocationOverride');
      }
      await page('Network.enable');
      await page('Network.clearBrowserCookies');
      if (cookie) await page('Network.setCookie', {name: cookie.split('=')[0], value: cookie.split('=')[1], url: origin});
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
    const openOnnuri = async () => {
      const center = await reveal('.consumer-workspace [data-life-shortcut="onnuri"]');
      await tap(center);
      return await waitFor(async () => { const v = await probe(); return v.surface && v.status && v.status !== '찾는 중…' ? v : null; }, `${testCase.label}: onnuri surface`);
    };
    const layout = state => {
      assert.ok(state.pageOverflowX <= 0, `${testCase.label}: no horizontal page scroll (${state.pageOverflowX})`);
      assert.ok(state.panelOverflowX <= 0, `${testCase.label}: panel does not scroll sideways (${state.panelOverflowX})`);
      for (const card of state.cards) {
        assert.ok(card.box.x >= 0 && card.box.right <= state.viewport.w + 0.5, `${testCase.label}: ${card.name} inside the viewport`);
        assert.equal(card.label, '온누리 가맹점');
        assert.equal(card.logoImg, false, 'no logo image before approval');
        assert.equal(card.logoVisible, false, 'reserved logo slot draws nothing');
        assert.ok(card.map, `${testCase.label}: ${card.name} has a map link`);
        assert.notEqual(card.bg, card.fg);
      }
      assert.equal(state.emoji, false, 'no ticket emoji anywhere');
    };

    // 1. No permission: region list, Top 3, no distance; 더 보기; shortcut shows text only.
    await load();
    let state = await probe();
    assert.equal(state.shortcut.label, '온누리상품권');
    assert.equal(state.shortcut.slot, 'PENDING_APPROVAL');
    assert.equal(state.shortcut.img, false);
    assert.equal(state.shortcut.svg, false, 'no stand-in icon');
    assert.ok(state.shortcut.box.h >= 44);
    state = await openOnnuri();
    assert.equal(state.title, '온누리상품권 가맹점');
    assert.match(state.disclaimer, /공식·제휴 서비스가 아니에요/u);
    assert.equal(state.brandImg, false);
    assert.equal(state.cards.length, 3, `${testCase.label}: Top 3`);
    assert.ok(state.cards.every(card => card.distance === ''), `no distance without location ${JSON.stringify({requests: state.requests, cards: state.cards.map(c => [c.name, c.distance]), note: state.note, status: state.status})}`);
    assert.match(state.status, /거리는 현재 위치를 쓸 때만/u);
    assert.match(state.source, /2026-07-31 기준/u);
    assert.ok(state.requests.every(url => !url.includes('latitude=')), 'no location sent without permission');
    assert.ok(state.locate.h >= 40, `${testCase.label}: locate button touch target ${state.locate.h}`);
    layout(state);
    await shot('01-region-top3');
    await tap(await reveal('.onnuri-more'));
    state = await waitFor(async () => { const v = await probe(); return v.cards.length === 6 ? v : null; }, `${testCase.label}: more`);
    assert.equal(new Set(state.cards.map(card => card.id)).size, 6, 'no duplicates after 더 보기');

    // 2. Region drill-down: 전북 → 전주시 덕진구 → 만성동 = 2 results only.
    await select('sido', '전북특별자치도');
    await waitFor(async () => (await probe()).regions.sigungu?.options.includes('전주시 덕진구'), `${testCase.label}: sigungu list`);
    await select('sigungu', '전주시 덕진구');
    await waitFor(async () => (await probe()).regions.dong?.options.includes('만성동'), `${testCase.label}: dong list`);
    await select('dong', '만성동');
    state = await waitFor(async () => { const v = await probe(); return v.cards.length === 2 && !v.status.includes('찾는 중') ? v : null; }, `${testCase.label}: 만성동`);
    assert.deepEqual(state.cards.map(card => card.name), ['만성커피', '만성한식당']);
    assert.equal(state.more, null, '2건이면 2건만, 더 보기 없음');
    assert.ok(state.requests.at(-1).includes('dong='));

    // 3. Filters: 카페 → 1; 디지털형 note; 지류형 + 카페 → 0 with an honest message.
    await tap(await reveal('[data-onnuri-filter="category"][data-value="CAFE"]'));
    state = await waitFor(async () => { const v = await probe(); return v.cards.length === 1 ? v : null; }, `${testCase.label}: cafe`);
    assert.equal(state.cards[0].name, '만성커피');
    assert.equal(state.cards[0].accept, '디지털(모바일·카드) 가맹');
    await tap(await reveal('[data-onnuri-filter="accept"][data-value="DIGITAL"]'));
    state = await waitFor(async () => { const v = await probe(); return v.digitalNote && v.cards.length === 1 ? v : null; }, `${testCase.label}: digital note`);
    await tap(await reveal('[data-onnuri-filter="accept"][data-value="PAPER"]'));
    state = await waitFor(async () => { const v = await probe(); return v.cards.length === 0 && v.status.includes('찾지 못했어요') ? v : null; }, `${testCase.label}: zero`);
    assert.match(state.status, /가맹점이 아니라는 뜻은 아니에요/u);
    await shot('02-zero');

    // 4. Permission already granted: opens nearest-first with distances.
    await load({grant: true});
    state = await openOnnuri();
    state = await waitFor(async () => { const v = await probe(); return v.cards.length === 3 && v.cards.every(c => c.distance) ? v : null; }, `${testCase.label}: nearby`);
    assert.deepEqual(state.cards.map(card => card.name), ['만성커피', '만성한식당', '명동칼국수']);   // 5.5km < 덕진베이커리 5.8km
    const meters = state.cards.map(card => card.distance.endsWith('km') ? Number.parseFloat(card.distance) * 1000 : Number.parseFloat(card.distance));
    assert.deepEqual(meters, [...meters].sort((a, b) => a - b), 'nearest first');
    assert.ok(state.cards.every(card => card.mapLabel === '길찾기'));
    const nearbyRequest = state.requests.find(url => url.includes('latitude='));
    assert.ok(nearbyRequest && !nearbyRequest.includes('sido='), 'location only, rounded');
    assert.match(nearbyRequest, /latitude=35\.847/u);
    assert.match(state.note, /저장하지 않아요/u);
    layout(state);
    await shot('03-nearby');

    // 5. 위치 사용 off: the button explains and falls back to regions.
    await load({cookie: 'lotbi_location_usage_v1=off'});
    state = await openOnnuri();
    await tap(await reveal('.onnuri-locate'));
    state = await waitFor(async () => { const v = await probe(); return v.note.includes('위치 사용이 꺼져') ? v : null; }, `${testCase.label}: usage off`);
    assert.equal(state.settingsLink, 'https://account.lotbiai.com/account#privacy');
    assert.ok(state.requests.every(url => !url.includes('latitude=')));

    // 6. Not published yet: an honest "준비 중".
    await evaluate('globalThis.__onnuri.notReady = true, true');
    await select('sido', '전북특별자치도');
    state = await waitFor(async () => { const v = await probe(); return v.status.includes('준비하고 있어요') ? v : null; }, `${testCase.label}: not ready`);
    assert.equal(state.cards.length, 0);
    return {cards: state.cards.length, requests: state.requests.length};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.onnuri-merchant-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`ONNURI_MERCHANT_SEARCH ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('ONNURI-MERCHANT-SEARCH-01 OK — 생활정보 온누리상품권: region/location search, Top 3 + 더 보기, filters, honest empty/not-ready states, no distance without verified location, no official logo before approval (viewport emulation, not a device run)');
