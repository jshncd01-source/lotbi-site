// PLACE-CARD-NAVER-SEARCH-CLICK-01 — the place card body opens a NAVER web
// search for that place; the map button keeps the map handoff; phone and the
// carousel controls never trigger the search.
//
// Browser part: real input through the DevTools protocol (touch taps on an
// iPhone-sized viewport, mouse and keyboard on desktop) and the tabs Chrome
// actually opens. External hosts do not resolve, so nothing leaves the machine.
// Viewport emulation only — not an iPhone Safari / KakaoTalk device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildNaverPlaceSearchQuery, buildNaverPlaceSearchUrl} from '../site-navigation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Search query rule ───────────────────────────────────────────────────
const JEONJU = '전북특별자치도 전주시 완산구 전주객사3길 22-6';
const queryCases = [
  // Production example: "전주 죠죠 메뉴 알려줘" → query "전주 죠죠". The name already says 전주.
  [{name: '죠죠 전주객사점', address: JEONJU}, '전주 죠죠', '죠죠 전주객사점'],
  // The user's region word is used when the place's address confirms it.
  [{name: '죠죠', address: JEONJU}, '전주 죠죠', '전주 죠죠'],
  [{name: '호시마츠생라멘', address: '전북특별자치도 전주시 완산구 전주객사2길 46-12'}, '전주 맛집', '전주 호시마츠생라멘'],
  [{name: '호시마츠생라멘', address: '전북특별자치도 전주시 완산구 전주객사2길 46-12'}, '전주시 라멘', '전주시 호시마츠생라멘'],
  // A region word the address does not confirm is not used; the address city is.
  [{name: '카페 죠죠', address: '전북특별자치도 완주군 이서면 혁신로 1'}, '전주 죠죠', '완주 카페 죠죠'],
  [{name: '카페 A', address: '경기도 성남시 분당구 판교역로 1'}, '판교 카페', '성남 카페 A'],
  [{name: '카페 A', address: '경기도 성남시 분당구 판교역로 1'}, '분당 카페', '분당 카페 A'],
  [{name: '스타벅스 역삼점', address: '서울특별시 강남구 테헤란로 1'}, '맛집', '서울 스타벅스 역삼점'],
  [{name: '카페 A', address: '대구광역시 중구 동성로 1'}, '', '대구 카페 A'],
  [{name: '카페 A', address: '세종특별자치시 한누리대로 1'}, '', '세종 카페 A'],
  // No duplicate region when the name already carries it (short or full form).
  [{name: '스타벅스 강남역점', address: '서울특별시 강남구 강남대로 1'}, '강남구 카페', '스타벅스 강남역점'],
  [{name: '전주 전동성당 카페', address: JEONJU}, '전주 카페', '전주 전동성당 카페'],
  // No region that can be made safely → the name alone.
  [{name: '카페 A', address: '주소 확인 중'}, '', '카페 A'],
  [{name: '카페 A', address: ''}, '전주 카페', '카페 A'],
  // Only the region word is borrowed from the query, never "메뉴" or other words.
  [{name: '죠죠 전주객사점', address: JEONJU}, '전주 죠죠 메뉴 알려줘', '죠죠 전주객사점'],
  // The persisted snake_case shape is accepted too.
  [{name: '죠죠', road_address: JEONJU}, '전주 죠죠', '전주 죠죠'],
];
for (const [place, searchContext, expected] of queryCases) {
  assert.equal(buildNaverPlaceSearchQuery(place, {searchContext}), expected, `${place.name} / ${searchContext}`);
}
for (const [place, searchContext] of queryCases) {
  const query = buildNaverPlaceSearchQuery(place, {searchContext});
  assert.doesNotMatch(query, /(\S+) \1(\s|$)/u, `no repeated word: ${query}`);
  assert.ok(!query.includes('완산구') && !query.includes('객사3길'), `no address fragments: ${query}`);
}
assert.equal(buildNaverPlaceSearchQuery({name: '  죠죠\n전주객사점  ', address: JEONJU}, {searchContext: '전주 죠죠'}), '죠죠 전주객사점');
assert.equal(buildNaverPlaceSearchQuery({name: '', address: JEONJU}), '');
assert.equal(buildNaverPlaceSearchQuery(null), '');
assert.throws(() => buildNaverPlaceSearchUrl({name: '', address: JEONJU}), TypeError);

// ── URL ─────────────────────────────────────────────────────────────────
const PRODUCTION_EXAMPLE_URL = 'https://search.naver.com/search.naver?query=%EC%A3%A0%EC%A3%A0+%EC%A0%84%EC%A3%BC%EA%B0%9D%EC%82%AC%EC%A0%90';
assert.equal(buildNaverPlaceSearchUrl({name: '죠죠 전주객사점', address: JEONJU}, {searchContext: '전주 죠죠'}), PRODUCTION_EXAMPLE_URL);
const special = {name: 'C&A 카페 #1 / "특가"? <b>x</b> javascript:alert(1)', address: JEONJU};
const specialUrl = new URL(buildNaverPlaceSearchUrl(special, {searchContext: '전주 카페'}));
assert.equal(specialUrl.origin + specialUrl.pathname, 'https://search.naver.com/search.naver');
assert.deepEqual([...specialUrl.searchParams.keys()], ['query'], 'only the query parameter');
assert.equal(specialUrl.hash, '', 'no fragment smuggled through #');
assert.equal(specialUrl.searchParams.get('query'), '전주 C&A 카페 #1 / "특가"? <b>x</b> javascript:alert(1)');
// A name made only of characters a sanitizer might drop still yields a search (never a render error).
assert.equal(new URL(buildNaverPlaceSearchUrl({name: '<>', address: ''})).searchParams.get('query'), '<>');
assert.doesNotMatch(specialUrl.href.slice(specialUrl.origin.length), /[&#<>"]|javascript:alert/u);
for (const [place, searchContext] of queryCases.filter(([place]) => place.name)) {
  const url = new URL(buildNaverPlaceSearchUrl(place, {searchContext}));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'search.naver.com');
  assert.equal(url.searchParams.get('query'), buildNaverPlaceSearchQuery(place, {searchContext}));
}

// ── Renderer contract ───────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const rendererStart = conversation.indexOf('const createPlaceCardRail = placeValue => {');
const rendererEnd = conversation.indexOf('const normalizeConversationCalendarResult = value => {', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
const renderer = conversation.slice(rendererStart, rendererEnd);
assert.match(renderer, /searchLink\.href = buildNaverPlaceSearchUrl\(place, \{searchContext: placeResult\.query\}\)/u);
assert.match(renderer, /searchLink\.target = '_blank'/u);
assert.match(renderer, /searchLink\.rel = 'noopener noreferrer'/u);
assert.match(renderer, /searchLink\.setAttribute\('aria-label', `네이버에서 \$\{place\.name\} 검색`\)/u);
assert.doesNotMatch(renderer, /innerHTML|insertAdjacentHTML|window\.open|location\.href\s*=/u);
assert.doesNotMatch(renderer, /querySelector\('\[data-map-provider\]'\)\?\.click\(\)/u, 'the card body never forwards to the map handoff');
assert.match(renderer, /cards\[index\]\.querySelector\('\[data-place-search\]'\)\?\.click\(\)/u);
assert.match(renderer, /mapAction\.href = buildDefaultMapHref\(defaultMapProvider, place\)/u, 'map button keeps the existing handoff');
// Desktop Chrome sends a captured mouse tap's click to the rail, not the card.
assert.match(renderer, /rail\.addEventListener\('click', event => \{\s*if \(event\.target !== rail \|\| capturedBodyTapIndex === null\) return;[\s\S]*?cards\[index\]\?\.querySelector\('\[data-place-search\]'\)\?\.click\(\);/u);
assert.match(renderer, /const tappedActiveCard = !cancelled\s*&& dragCaptured\s*&& !dragMoved\s*&& !crossedDragThreshold\s*&& pointerOriginIndex === activeIndex;/u);
const css = read('site-conversation.css');
assert.match(css, /\.lotbi-place-search-link \{[^}]*position: absolute;[^}]*clip: rect\(0, 0, 0, 0\);/u);
assert.match(css, /\.lotbi-place-orbit-card:has\(\.lotbi-place-search-link:focus-visible\) \{[^}]*outline:/u);

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the place card NAVER search validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KAKAOTALK_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'iPhone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'KakaoTalk-iOS-390x844', width: 390, height: 844, mobile: true, userAgent: KAKAOTALK_IOS_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

const PLACE_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_5e4c0a0d0e0f01020304',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '전주 죠죠',
  results: [
    {
      result_id: 'place-1', place_id: 'naver:jojo-gaeksa', name: '죠죠 전주객사점', category: '음식점>양식',
      road_address: JEONJU, latitude: 35.8183, longitude: 127.1433,
      coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
      phone: '063-000-0000', phone_verified: true,
      image_url: 'https://lh3.googleusercontent.com/lotbi-place-search-click-contract.jpg',
      photo_evidence: {
        provider: 'GOOGLE_PLACES', provider_place_id: 'google:jojo', match_basis: 'EXACT_NAME_AND_ADDRESS',
        fetched_at: '2026-10-07T08:30:00Z', verification_state: 'VERIFIED', attributions: [],
      },
    },
    {
      result_id: 'place-2', place_id: 'naver:jojo', name: '죠죠', category: '음식점>양식',
      road_address: '전북특별자치도 전주시 덕진구 명륜4길 10', latitude: 35.8468, longitude: 127.1290,
      coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
      phone: null, phone_verified: false, image_url: null, photo_evidence: null,
    },
    {
      result_id: 'place-3', place_id: 'naver:cafe-jojo', name: '카페 죠죠', category: '카페',
      road_address: '전북특별자치도 완주군 이서면 혁신로 1', latitude: 35.8330, longitude: 127.0610,
      coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
      phone: null, phone_verified: false, image_url: null, photo_evidence: null,
    },
  ],
};
const EXPECTED_SEARCH = [
  PRODUCTION_EXAMPLE_URL,
  buildNaverPlaceSearchUrl({name: '죠죠', address: PLACE_RESULT.results[1].road_address}, {searchContext: '전주 죠죠'}),
  buildNaverPlaceSearchUrl({name: '카페 죠죠', address: PLACE_RESULT.results[2].road_address}, {searchContext: '전주 죠죠'}),
];
assert.equal(new URL(EXPECTED_SEARCH[1]).searchParams.get('query'), '전주 죠죠');
assert.equal(new URL(EXPECTED_SEARCH[2]).searchParams.get('query'), '완주 카페 죠죠');

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PLACE_RESULT = ${JSON.stringify(PLACE_RESULT)};
const out = document.getElementById('nsc-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const mockImageSrc = new WeakMap();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return mockImageSrc.get(this) || nativeImageSrc?.get?.call(this) || ''; },
    set(value) {
      const next = String(value);
      if (next.startsWith('https://lh3.googleusercontent.com/')) {
        mockImageSrc.set(this, next);
        queueMicrotask(() => this.dispatchEvent(new Event('load')));
        return;
      }
      nativeImageSrc?.set?.call(this, next);
    },
  });
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') return json({
      contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
      assistant_text:'전주에서 죠죠 메뉴 검색 결과로 죠죠 전주객사점 등을 찾았어요.',
      response_mode:'PLACE_PROVIDER_READONLY',correlation_id:'req_placesearchclick01',
      intent:{action:'PLACE_SEARCH',domain:'PLACE'},
      follow_up:{required:false,action:'PLACE_SEARCH',automatic_execution:false},
      safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
        order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
      place_result:PLACE_RESULT,retry_safe:true,
    });
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  // Every anchor activation, trusted or forwarded. tel: is recorded and stopped
  // (no dialer in headless Chrome); everything else is left to the browser.
  globalThis.__anchorClicks = [];
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a');
    if (!anchor) return;
    globalThis.__anchorClicks.push({
      kind: anchor.dataset.placeSearch ? 'NAVER_SEARCH' : (anchor.dataset.action || 'OTHER'),
      href: anchor.href, trusted: event.isTrusted,
    });
    if (anchor.href.startsWith('tel:')) event.preventDefault();
  }, true);
  const conversation = await import('/site-conversation.js?v=placesearchclick01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<500;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const field=document.getElementById('lotbi-prompt');
  field.value='전주 죠죠 메뉴 알려줘';
  field.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  const rail=await wait(()=>document.querySelector('.lotbi-place-orbit'),'rail');
  await wait(()=>rail.querySelector('[data-orbit-slot="CENTER"]'),'center');
  await new Promise(r=>setTimeout(r,300));
  rail.scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r,150));
  out.textContent=JSON.stringify({ok:true});
} catch(e) { fail(e); }
</script><pre id="nsc-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Page-side probes, evaluated after each step.
const PROBE = `(() => {
  const rail = document.querySelector('.lotbi-place-orbit');
  const center = rail.querySelector('[data-orbit-slot="CENTER"]');
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const sideRight = rail.querySelector('[data-orbit-slot="RIGHT_FRONT"]');
  const centerBox = box(center);
  const sideBox = box(sideRight);
  return {
    activeIndex: Number(center.dataset.orbitIndex),
    centerName: center.querySelector('.lotbi-rich-card-title')?.textContent || '',
    rail: box(rail),
    card: centerBox,
    media: box(center.querySelector('.lotbi-rich-card-place-media')),
    title: box(center.querySelector('.lotbi-rich-card-title')),
    address: box(center.querySelector('.lotbi-rich-card-price')),
    copy: box(center.querySelector('.lotbi-rich-card-copy')),
    actions: box(center.querySelector('.lotbi-place-card-actions')),
    phone: box(center.querySelector('[data-action="phone"]')),
    map: box(center.querySelector('[data-map-provider]')),
    mapHref: center.querySelector('[data-map-provider]')?.href || '',
    prev: box(rail.querySelector('.lotbi-place-orbit-control-prev')),
    next: box(rail.querySelector('.lotbi-place-orbit-control-next')),
    // The visible strip of the right-hand card, between the center card and the rail edge.
    sideTap: sideBox && centerBox ? (() => {
      const railBox = box(rail);
      const visibleRight = Math.min(sideBox.x + sideBox.w, railBox.x + railBox.w);
      return {cx: (centerBox.x + centerBox.w + visibleRight) / 2, cy: centerBox.cy, visibleRight, centerRight: centerBox.x + centerBox.w};
    })() : null,
    searchLinks: [...rail.querySelectorAll('[data-place-search]')].map(link => ({
      href: link.href, target: link.target, rel: link.rel, aria: link.getAttribute('aria-label') || '',
      text: link.textContent, tabIndex: link.tabIndex, ariaDisabled: link.getAttribute('aria-disabled'),
      tag: link.tagName, insideInteractive: Boolean(link.parentElement.closest('a, button')),
      nestedInteractive: link.querySelectorAll('a, button, input, select, textarea').length,
      w: link.getBoundingClientRect().width, h: link.getBoundingClientRect().height,
    })),
    hitAtMedia: (() => { const b = box(center.querySelector('.lotbi-rich-card-place-media')); if (!b) return 'NO_PHOTO_BOX'; const el = document.elementFromPoint(b.cx, b.cy); return (el?.className || el?.tagName || '') + '|' + (el?.closest?.('.lotbi-place-orbit-card')?.dataset.orbitIndex ?? '-'); })(),
    hitAtTitle: (() => { const b = box(center.querySelector('.lotbi-rich-card-title')); const el = document.elementFromPoint(b.cx, b.cy); return el?.closest?.('a') ? 'ANCHOR' : (el?.closest?.('.lotbi-place-orbit-card') === center ? 'CARD' : 'OTHER'); })(),
    clicks: globalThis.__anchorClicks.splice(0),
    status: document.querySelector('[data-conversation-status], #lotbi-conversation-status, .chat-status')?.textContent || '',
    focusedSearch: document.activeElement?.dataset?.placeSearch === 'NAVER_SEARCH',
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

// Card geometry with and without the search links: the link must not move a pixel.
const GEOMETRY = `(() => {
  const rail = document.querySelector('.lotbi-place-orbit');
  const measure = () => [...rail.querySelectorAll('.lotbi-place-orbit-card')].flatMap(card =>
    ['', '.lotbi-rich-card-place-media', '.lotbi-rich-card-copy', '.lotbi-rich-card-title', '.lotbi-rich-card-price', '.lotbi-place-card-actions', '[data-action="phone"]', '[data-map-provider]']
      .map(selector => { const node = selector ? card.querySelector(selector) : card; if (!node) return null; const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100); }));
  const withLinks = measure();
  const links = [...rail.querySelectorAll('[data-place-search]')].map(link => [link, link.parentNode, link.nextSibling]);
  for (const [link] of links) link.remove();
  const withoutLinks = measure();
  for (const [link, parent, next] of links) parent.insertBefore(link, next);
  return {same: JSON.stringify(withLinks) === JSON.stringify(withoutLinks), withLinks, withoutLinks, railH: rail.getBoundingClientRect().height};
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
  const targets = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
      return;
    }
    if (message.method === 'Target.targetCreated' || message.method === 'Target.targetInfoChanged') {
      const info = message.params.targetInfo;
      const known = targets.get(info.targetId) || {urls: new Set(), opener: info.openerId || ''};
      if (info.url) known.urls.add(info.url);
      known.type = info.type;
      if (info.openerId) known.opener = info.openerId;
      targets.set(info.targetId, known);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, targets};
}

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const log = [];
  try {
    await cdp.send('Target.setDiscoverTargets', {discover: true});
    const pageTarget = await waitFor(async () => {
      const {targetInfos} = await cdp.send('Target.getTargets');
      return targetInfos.find(item => item.type === 'page');
    }, 'page target');
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
    await page('Page.navigate', {url: `${origin}/${innerRel}`});
    const ready = await waitFor(async () => {
      const text = await evaluate("document.getElementById('nsc-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsedReady = JSON.parse(ready);
    if (!parsedReady.ok) throw new Error(`${testCase.label}: ${parsedReady.error}`);

    const openedTabs = async () => {
      await sleep(600);
      const opened = [];
      for (const [targetId, info] of cdp.targets) {
        if (targetId === pageTarget.targetId || info.type !== 'page') continue;
        opened.push([...info.urls].filter(url => url && url !== 'about:blank'));
        cdp.targets.delete(targetId);
        await cdp.send('Target.closeTarget', {targetId}).catch(() => {});
      }
      return opened.flat();
    };
    const tap = async (x, y) => {
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
    };
    const swipe = async (fromX, toX, y) => {
      const steps = 8;
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: fromX, y}]});
        for (let i = 1; i <= steps; i += 1) {
          await page('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: fromX + (toX - fromX) * i / steps, y}]});
          await sleep(16);
        }
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX, y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: fromX, y, button: 'left', buttons: 1, clickCount: 1});
        for (let i = 1; i <= steps; i += 1) {
          await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX + (toX - fromX) * i / steps, y, button: 'left', buttons: 1});
          await sleep(16);
        }
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: toX, y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    const key = async keyName => {
      const map = {Enter: {code: 'Enter', windowsVirtualKeyCode: 13, text: '\r'}, Tab: {code: 'Tab', windowsVirtualKeyCode: 9}};
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: keyName, ...map[keyName]});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: keyName, ...map[keyName]});
    };
    const step = async (name, action) => {
      await evaluate('globalThis.__anchorClicks.splice(0), true');
      const before = await evaluate(PROBE);
      await action(before);
      await sleep(350);
      const after = await evaluate(PROBE);
      const tabs = await openedTabs();
      const record = {name, before: before.activeIndex, after: after.activeIndex, clicks: after.clicks, tabs};
      log.push(record);
      return {before, after, tabs, clicks: after.clicks};
    };
    const searchTabs = tabs => tabs.filter(url => url.startsWith('https://search.naver.com/'));
    const mapTabs = tabs => tabs.filter(url => url.includes('/map-handoff.html') || url.startsWith('https://map.naver.com/') || url.startsWith('nmap:') || url.startsWith('intent:'));
    const expectSearch = (result, index, label) => {
      assert.equal(result.after.activeIndex, index, `${label}: carousel stays on the card`);
      assert.deepEqual(result.clicks.filter(c => c.kind === 'NAVER_SEARCH').map(c => c.href), [EXPECTED_SEARCH[index]], `${label}: one NAVER search activation ${JSON.stringify({hit: result.before.hitAtMedia, media: result.before.media, clicks: result.clicks, active: result.before.activeIndex, steps: log.map(item => item.name + ':' + item.before + '->' + item.after)})}`);
      assert.equal(result.clicks.some(c => c.kind !== 'NAVER_SEARCH' && c.kind !== 'OTHER'), false, `${label}: no map/phone activation`);
      assert.deepEqual(searchTabs(result.tabs).map(url => url.replace(/&.*$/u, '')), [EXPECTED_SEARCH[index]], `${label}: a NAVER search tab opened (${JSON.stringify(result.tabs)})`);
      assert.deepEqual(mapTabs(result.tabs), [], `${label}: no map handoff tab`);
    };
    const expectNoExternal = (result, label) => {
      assert.equal(result.clicks.some(c => c.kind === 'NAVER_SEARCH'), false, `${label}: no NAVER search activation`);
      assert.deepEqual(searchTabs(result.tabs), [], `${label}: no NAVER search tab`);
    };

    // Static reading of the rendered card.
    const initial = await evaluate(PROBE);
    assert.equal(initial.activeIndex, 0);
    assert.equal(initial.centerName, '죠죠 전주객사점');
    assert.deepEqual(initial.searchLinks.map(link => link.href), EXPECTED_SEARCH, `${testCase.label}: search hrefs`);
    for (const [index, link] of initial.searchLinks.entries()) {
      assert.equal(link.tag, 'A');
      assert.equal(link.target, '_blank');
      assert.match(link.rel, /noopener/u);
      assert.match(link.rel, /noreferrer/u);
      assert.equal(link.aria, `네이버에서 ${PLACE_RESULT.results[index].name} 검색`);
      assert.equal(link.text, '', 'no visible/copyable text added to the card');
      assert.equal(link.insideInteractive, false, 'not nested in another link or button');
      assert.equal(link.nestedInteractive, 0);
      assert.ok(link.w <= 1 && link.h <= 1, `${testCase.label}: search link is not drawn (${link.w}x${link.h})`);
      assert.equal(link.tabIndex, index === 0 ? 0 : -1, 'only the center card link is in the tab order');
      assert.equal(link.ariaDisabled, index === 0 ? 'false' : 'true');
    }
    assert.equal(initial.hitAtTitle, 'CARD', 'taps on the title land on the card, not on a link (swipe keeps working)');
    if (testCase.mobile) assert.match(initial.mapHref, /\/map-handoff\.html\?provider=NAVER_MAP/u, `${testCase.label}: iOS map button keeps the map handoff page`);
    else assert.match(initial.mapHref, /^https:\/\/map\.naver\.com\/p\/search\//u);
    assert.ok(initial.pageOverflow <= 0, `${testCase.label}: no horizontal page scroll`);

    const geometry = await evaluate(GEOMETRY);
    assert.equal(geometry.same, true, `${testCase.label}: card layout changed by the search link ${JSON.stringify(geometry)}`);

    // 1, 10. Card body (photo, title, address, card background) → NAVER search.
    expectSearch(await step('tap-photo', b => tap(b.media.cx, b.media.cy)), 0, `${testCase.label}: photo`);
    expectSearch(await step('tap-title', b => tap(b.title.cx, b.title.cy)), 0, `${testCase.label}: title`);
    expectSearch(await step('tap-address', b => tap(b.address.cx, b.address.cy)), 0, `${testCase.label}: address`);
    expectSearch(await step('tap-card-background', b => tap(b.card.cx, (b.address.y + b.address.h + b.actions.y) / 2)), 0, `${testCase.label}: card background`);

    // 3. Map button → existing map handoff only.
    const mapResult = await step('tap-map', b => tap(b.map.cx, b.map.cy));
    expectNoExternal(mapResult, `${testCase.label}: map`);
    assert.deepEqual(mapResult.clicks.map(c => c.kind), ['naver-map'], `${testCase.label}: map activation only`);
    assert.equal(mapTabs(mapResult.tabs).length, 1, `${testCase.label}: map handoff tab opened (${JSON.stringify(mapResult.tabs)})`);
    assert.equal(mapResult.after.activeIndex, 0);

    // 4. Phone → tel: only.
    const phoneResult = await step('tap-phone', b => tap(b.phone.cx, b.phone.cy));
    expectNoExternal(phoneResult, `${testCase.label}: phone`);
    assert.deepEqual(phoneResult.clicks.map(c => [c.kind, c.href]), [['phone', 'tel:0630000000']], `${testCase.label}: tel only`);
    assert.deepEqual(phoneResult.tabs, [], `${testCase.label}: phone opens no tab`);

    // 5. Carousel controls → carousel only. Phones have no ‹ › any more
    // (PLACE-MEDICAL-CARD-UX-FINAL-01): a swipe on the card turns it there.
    const goNext = b => (testCase.mobile ? swipe(b.title.cx + 60, b.title.cx - 60, b.title.cy) : tap(b.next.cx, b.next.cy));
    const goPrev = b => (testCase.mobile ? swipe(b.title.cx - 60, b.title.cx + 60, b.title.cy) : tap(b.prev.cx, b.prev.cy));
    if (testCase.mobile) assert.ok(initial.next.w === 0 && initial.prev.w === 0, `${testCase.label}: no arrows on a phone`);
    const nextResult = await step('tap-next', goNext);
    expectNoExternal(nextResult, `${testCase.label}: next`);
    assert.equal(nextResult.after.activeIndex, 1, `${testCase.label}: next moves the carousel`);
    assert.deepEqual(nextResult.tabs, []);
    const prevResult = await step('tap-prev', goPrev);
    expectNoExternal(prevResult, `${testCase.label}: prev`);
    assert.equal(prevResult.after.activeIndex, 0, `${testCase.label}: prev moves the carousel`);
    assert.deepEqual(prevResult.tabs, []);

    // Side card tap (where a side strip is visible) and swipe rotate; they never search.
    let expectedIndex = 0;
    const probe = await evaluate(PROBE);
    if (probe.sideTap && probe.sideTap.visibleRight - probe.sideTap.centerRight >= 16) {
      const sideResult = await step('tap-side-card', b => tap(b.sideTap.cx, b.sideTap.cy));
      expectNoExternal(sideResult, `${testCase.label}: side card`);
      expectedIndex = 1;
      assert.equal(sideResult.after.activeIndex, expectedIndex, `${testCase.label}: side card becomes the center ${JSON.stringify(sideResult.before.sideTap)}`);
      assert.deepEqual(sideResult.tabs, []);
    } else {
      log.push({name: 'tap-side-card', before: 0, after: 0, clicks: [], tabs: [], skipped: 'NO_VISIBLE_SIDE_STRIP'});
    }
    const swipeResult = await step('swipe-title', b => swipe(b.title.cx + 60, b.title.cx - 60, b.title.cy));
    expectNoExternal(swipeResult, `${testCase.label}: swipe`);
    expectedIndex = (expectedIndex + 1) % 3;
    assert.equal(swipeResult.after.activeIndex, expectedIndex, `${testCase.label}: swipe on the title still rotates`);
    assert.deepEqual(swipeResult.tabs, []);
    if (expectedIndex !== 2) {
      const nextAgain = await step('tap-next-to-third', goNext);
      expectNoExternal(nextAgain, `${testCase.label}: next`);
      assert.equal(nextAgain.after.activeIndex, 2);
    }

    // The new center card searches for itself (address-derived region).
    // The third place has no photo, so it has no photo box (PLACE-MEDICAL-CARD-UX-FINAL-01): its title is the body.
    expectSearch(await step('tap-third-card', b => tap((b.media || b.title).cx, (b.media || b.title).cy)), 2, `${testCase.label}: third card`);
    const back = await step('back-to-first', goNext);
    assert.equal(back.after.activeIndex, 0);

    // Keyboard: Enter on the focused card, and Enter on its search link.
    if (!testCase.mobile) {
      const cardEnter = await step('enter-on-card', async () => {
        await evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"CENTER\"]').focus(), true");
        await key('Enter');
      });
      expectSearch(cardEnter, 0, `${testCase.label}: Enter on card`);
      const linkEnter = await step('tab-enter-on-link', async () => {
        await evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"CENTER\"]').focus(), true");
        await key('Tab');
        const focused = await evaluate(PROBE);
        assert.equal(focused.focusedSearch, true, `${testCase.label}: Tab from the card reaches its NAVER search link`);
        await key('Enter');
      });
      expectSearch(linkEnter, 0, `${testCase.label}: Enter on search link`);
      const arrow = await step('arrow-right', async () => {
        await evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"CENTER\"]').focus(), true");
        await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39});
        await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39});
      });
      expectNoExternal(arrow, `${testCase.label}: ArrowRight`);
      assert.equal(arrow.after.activeIndex, 1, `${testCase.label}: ArrowRight still rotates`);
    }
    return {geometry: {same: geometry.same, railH: geometry.railH, card: initial.card, actions: initial.actions}, steps: log.map(item => `${item.name}:${item.before}->${item.after}:${item.clicks.map(c => c.kind).join('+') || '-'}:${item.tabs.length}`)};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.place-search-click-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`PLACE_CARD_NAVER_SEARCH_CLICK ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('PLACE-CARD-NAVER-SEARCH-CLICK-01 OK — card body opens NAVER search; map, phone and carousel controls keep their own behavior');
