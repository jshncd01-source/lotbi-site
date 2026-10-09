// PLACE-MEDICAL-CARD-UX-FINAL-01 — 장소·의료 검색 카드 최종 정리.
//
// What a person sees after a place or 병원·약국 search:
//  - phones (≤760px) have no ‹ › arrows over the card; a swipe turns the cards
//    round (last → first), and only the center card shows — no side card is
//    cut off at the screen edge or drawn over the center card;
//  - a card without a photo has no photo box; the center card fits on the
//    screen whole, with 이름·거리·주소·진료시간·전화·길찾기 inside it;
//  - "1/3" under the card says where you are; three cards first, the rest of
//    Core's list behind "다른 병원 보기"; the same institution listed twice is
//    one card;
//  - wider screens keep the turning layout, the arrows and the keys;
//  - the map button still follows the map app chosen in 설정
//    (lotbi_default_map_provider_v1) and the card body still opens a NAVER
//    search.
//
// Real input through the DevTools protocol (touch on phone sizes, mouse on
// desktop) with animations on. Viewport emulation only — not an iPhone
// Safari / Android device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SCREENSHOT_DIR = process.env.PLACE_MEDICAL_CARD_SCREENSHOT_DIR || '';

// ── Source contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const rendererStart = conversation.indexOf('const createPlaceCardRail = placeValue => {');
const rendererEnd = conversation.indexOf('const normalizeConversationCalendarResult = value => {', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'place card renderer');
const renderer = conversation.slice(rendererStart, rendererEnd);
assert.doesNotMatch(renderer, /has-place-banner|preserveEmptyMedia|empty-no-photo/u, 'no empty photo box for a card without a photo');
assert.match(renderer, /const media = place\.imageUrl \? document\.createElement\('div'\) : null;/u);
assert.equal((renderer.match(/actions\.appendChild\(/gu) || []).length, 2, '전화 + 지도 두 개만');
assert.match(renderer, /mapAction\.href = buildDefaultMapHref\(defaultMapProvider, place\)/u, 'map button keeps the 설정 map app');
assert.doesNotMatch(renderer, /innerHTML|insertAdjacentHTML|window\.open/u);
for (const claim of ['진료 가능', '접수 가능', '바로 진료', '영업 중']) assert.ok(!renderer.includes(claim), claim);
const css = read('site-conversation.css');
const finalBlock = css.slice(css.indexOf('/* PLACE-MEDICAL-CARD-UX-FINAL-01'));
assert.ok(finalBlock.length > 0 && css.indexOf('/* PLACE-MEDICAL-CARD-UX-FINAL-01') > css.indexOf('/* SITE-PLACE-CARD-CROSS-PLATFORM-01'), 'the final block comes after the earlier place card rules');
assert.match(finalBlock, /@media \(max-width: 760px\) \{\s*\.lotbi-place-orbit-control \{\s*display: none;/u, 'no arrows on phones');

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
  throw new Error('Chrome/Chromium is required for the place / medical card validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'Android-360x800', width: 360, height: 800, mobile: true, userAgent: ANDROID_UA},
  {label: 'iPhone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'Android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

const nmc = (index, name, address, distance, extra = {}) => ({
  result_id: `place-${index}`, place_id: `nmc:A11000${index}`, name, category: '의원 · 소아청소년과',
  address, road_address: address, latitude: 35.81 + index / 1000, longitude: 127.12,
  coordinate_system: 'WGS84', coordinate_authority: 'NMC_OFFICIAL', navigation_capability: true,
  phone: `063-222-10${index}0`, phone_verified: true, image_url: null, distance_meters: distance,
  medical_status: {kind: 'HOSPITAL', basis: 'NMC_REGISTERED_HOURS', target_label: '소아청소년과', open_state: 'OPEN', hours_label: '오늘 09:00~18:30'},
  ...extra,
});
const naver = (index, name, address, extra = {}) => ({
  result_id: `place-${index}`, place_id: `naver:${index}:${name}`, name, category: '음식점>한식',
  road_address: address, latitude: 35.8183, longitude: 127.1433,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone: null, phone_verified: false, image_url: null, photo_evidence: null, ...extra,
});

const SCENARIOS = {
  // Five rows from Core, one of them the second clinic again (spacing and a
  // hyphen differ): four institutions, three shown first.
  medical: {
    cookieProvider: 'KAKAO_NAVI',
    noun: '병원',
    names: ['가온소아청소년과의원', '전주바른소아과의원', '효자연합소아청소년과의원', '우리아이소아청소년과의원'],
    answer: '전주시 완산구에서 지금 등록된 시간상 문을 연 소아청소년과 5곳을 찾았어요: 가온소아청소년과의원, 전주바른소아과의원, 효자연합소아청소년과의원.',
    result: {
      contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_0d1e2f304152637485a6',
      provider_code: 'NMC', source: 'NMC_E_GEN', query: '전주 완산구 지금 진료하는 소아과',
      results: [
        nmc(1, '가온소아청소년과의원', '전북특별자치도 전주시 완산구 효자로 225, 3층', 350),
        nmc(2, '전주바른소아과의원', '전북특별자치도 전주시 완산구 홍산로 245 (효자동3가)', 620),
        nmc(3, '전주바른소아과의원', '전북특별자치도 전주시 완산구  홍산로 245(효자동3가)', 620, {place_id: 'nmc:A110002-dup'}),
        nmc(4, '효자연합소아청소년과의원', '전북특별자치도 전주시 완산구 용머리로 94 2층 좀 긴 주소 상가동 201호', 1240),
        nmc(5, '우리아이소아청소년과의원', '전북특별자치도 전주시 완산구 서원로 77', 1850),
      ],
    },
  },
  // Two NAVER places, the first with a verified photo: "1/2", no 더 보기.
  photo: {
    cookieProvider: '',
    noun: '장소',
    names: ['진원소우 전주신시가지점', '호시마츠생라멘'],
    answer: '전주에서 확인한 후보 2곳이에요.',
    result: {
      contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_1a2b3c4d5e6f70819203',
      provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query: '전주 맛집',
      results: [
        naver(1, '진원소우 전주신시가지점', '전북특별자치도 전주시 완산구 홍산중앙로 26 3층', {
          phone: '063-000-0000', phone_verified: true,
          image_url: 'https://lh3.googleusercontent.com/lotbi-place-medical-card-ux-final.jpg',
          photo_evidence: {provider: 'GOOGLE_PLACES', provider_place_id: 'google:one', match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
            fetched_at: '2026-10-08T01:00:00Z', verification_state: 'VERIFIED', attributions: []},
        }),
        naver(2, '호시마츠생라멘', '전북특별자치도 전주시 완산구 전주객사2길 46-12'),
      ],
    },
  },
  // One pharmacy: no position, no 더 보기, nothing to turn.
  single: {
    cookieProvider: 'TMAP',
    noun: '약국',
    names: ['효자온누리약국'],
    answer: '전주시 완산구에서 지금 등록된 시간상 문을 연 약국 1곳을 찾았어요: 효자온누리약국.',
    result: {
      contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_2b3c4d5e6f7081920314',
      provider_code: 'NMC', source: 'NMC_E_GEN', query: '전주 지금 여는 약국',
      results: [nmc(1, '효자온누리약국', '전북특별자치도 전주시 완산구 효자로 201', 280, {
        category: '약국',
        medical_status: {kind: 'PHARMACY', basis: 'NMC_REGISTERED_HOURS', target_label: '약국', open_state: 'OPEN', hours_label: '오늘 08:30~22:00'},
      })],
    },
  },
};

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const SCENARIOS = ${JSON.stringify(SCENARIOS)};
const scenario = SCENARIOS[new URLSearchParams(location.search).get('scenario')];
const out = document.getElementById('pmc-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
try {
  localStorage.clear();
  document.cookie = 'lotbi_default_map_provider_v1=; Path=/; Max-Age=0';
  if (scenario.cookieProvider) document.cookie = 'lotbi_default_map_provider_v1=' + scenario.cookieProvider + '; Path=/; SameSite=Lax';
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  // A verified place photo "loads" without leaving the machine.
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
      assistant_text:scenario.answer,
      response_mode:'PLACE_PROVIDER_READONLY',correlation_id:'req_placemedicalcardux01',
      intent:{action:'PLACE_SEARCH',domain:'PLACE'},
      follow_up:{required:false,action:'PLACE_SEARCH',automatic_execution:false},
      safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
        order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
      place_result:scenario.result,retry_safe:true,
    });
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  // Nothing in this test may leave the page: record and stop every link.
  globalThis.__anchorClicks = [];
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a');
    if (!anchor) return;
    globalThis.__anchorClicks.push(anchor.href);
    event.preventDefault();
  }, true);
  const navigation = await import('/site-navigation.js?v=placemedicalcardux01');
  const provider = scenario.cookieProvider || 'NAVER_MAP';
  const normalized = navigation.normalizePlaceResult(scenario.result).results;
  // The first of a repeated institution is the card kept.
  globalThis.__expectedMapHref = {};
  for (const place of normalized) globalThis.__expectedMapHref[place.name] ??= navigation.buildDefaultMapHref(provider, place);
  globalThis.__expectedMapProvider = provider;
  const conversation = await import('/site-conversation.js?v=placemedicalcardux01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<500;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const field=document.getElementById('lotbi-prompt');
  field.value=scenario.result.query;
  field.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  const rail=await wait(()=>document.querySelector('.lotbi-place-orbit'),'rail');
  await wait(()=>rail.querySelector('[data-orbit-slot="CENTER"]'),'center');
  await new Promise(r=>setTimeout(r,400));
  rail.scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r,200));
  out.textContent=JSON.stringify({ok:true});
} catch(e) { fail(e); }
</script><pre id="pmc-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const rail = document.querySelector('.lotbi-place-orbit');
  const box = node => {
    if (!node || !node.getClientRects().length) return null;
    const r = node.getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2};
  };
  const cards = [...rail.querySelectorAll('.lotbi-place-orbit-card')];
  const center = rail.querySelector('[data-orbit-slot="CENTER"]');
  const part = selector => {
    const node = center.querySelector(selector);
    return node ? {box: box(node), text: (node.textContent || '').trim()} : null;
  };
  const control = selector => {
    const node = rail.querySelector(selector);
    return {display: getComputedStyle(node).display, box: box(node), disabled: node.disabled};
  };
  const position = rail.querySelector('.lotbi-place-orbit-position');
  const more = rail.querySelector('.lotbi-place-orbit-more');
  const map = center.querySelector('[data-map-provider]');
  return {
    vw: document.documentElement.clientWidth, vh: innerHeight,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rail: box(rail), scrollLeft: rail.scrollLeft, railMinHeight: rail.style.minHeight,
    hasFooterClass: rail.classList.contains('has-orbit-footer'),
    cardCount: Number(rail.dataset.cardCount), placeCount: Number(rail.dataset.placeCount),
    shown: cards.filter(card => !card.hidden).length, total: cards.length,
    activeIndex: Number(center.dataset.orbitIndex),
    center: box(center), centerName: center.querySelector('.lotbi-rich-card-title').textContent,
    centerMedia: center.querySelector('.lotbi-rich-card-place-media') ? {
      state: center.querySelector('.lotbi-rich-card-place-media').dataset.mediaState || '',
      box: box(center.querySelector('.lotbi-rich-card-place-media')),
    } : null,
    mediaCount: rail.querySelectorAll('.lotbi-rich-card-place-media').length,
    parts: {
      title: part('.lotbi-rich-card-title'),
      address: part('.lotbi-rich-card-price'),
      distance: part('.lotbi-place-badges'),
      medical: part('.lotbi-place-medical-line'),
      phone: part('[data-action="phone"]'),
      map: part('[data-map-provider]'),
    },
    sides: cards.filter(card => !card.hidden && card !== center).map(card => ({
      slot: card.dataset.orbitSlot, name: card.querySelector('.lotbi-rich-card-title').textContent,
      opacity: Number.parseFloat(getComputedStyle(card).opacity), pointer: getComputedStyle(card).pointerEvents, box: box(card),
    })),
    prev: control('.lotbi-place-orbit-control-prev'),
    next: control('.lotbi-place-orbit-control-next'),
    footer: box(rail.querySelector('.lotbi-place-orbit-footer')),
    position: {text: position.textContent, box: box(position)},
    more: {text: more.textContent, aria: more.getAttribute('aria-label') || '', box: box(more)},
    status: rail.querySelector('.lotbi-place-orbit-status').textContent,
    focusedIsCenter: document.activeElement === center,
    mapProvider: map?.dataset.mapProvider || '', mapHref: map?.getAttribute('href') || '',
    expectedMapHref: globalThis.__expectedMapHref[center.querySelector('.lotbi-rich-card-title').textContent] || '',
    expectedMapProvider: globalThis.__expectedMapProvider,
    anchors: globalThis.__anchorClicks.splice(0),
    assistantText: document.querySelector('.chat-message-assistant .chat-message-body')?.textContent || '',
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

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const targets = await waitFor(async () => {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
    return list.find(item => item.type === 'page') ? list : null;
  }, 'page target');
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

const inside = (inner, outer, slack = 0.5) => Boolean(inner && outer)
  && inner.x >= outer.x - slack && inner.r <= outer.r + slack && inner.y >= outer.y - slack && inner.b <= outer.b + slack;
const overlapArea = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));

function checkLayout(where, p, testCase, scenarioKey, {announced = true} = {}) {
  const scenario = SCENARIOS[scenarioKey];
  assert.equal(p.scrollLeft, 0, `${where}: the rail never scrolls`);
  assert.ok(p.pageOverflow <= 0, `${where}: horizontal page scroll ${p.pageOverflow}`);
  assert.ok(p.railMinHeight, `${where}: the rail is fitted to its tallest card`);
  // The center card is whole: inside the screen and inside the rail.
  assert.ok(p.center.x >= 0 && p.center.r <= p.vw, `${where}: center card cut at the screen edge ${JSON.stringify(p.center)} vw=${p.vw}`);
  assert.ok(inside(p.center, p.rail), `${where}: center card cut by the rail ${JSON.stringify({card: p.center, rail: p.rail})}`);
  if (testCase.mobile) assert.ok(p.center.h <= p.vh * 0.6, `${where}: card ${p.center.h}px is too tall for a ${p.vh}px screen`);
  // 이름·주소·전화·길찾기 always; 거리·진료시간 when Core sent them.
  for (const key of ['title', 'address', 'map']) {
    assert.ok(p.parts[key]?.box, `${where}: ${key} shown`);
    assert.ok(inside(p.parts[key].box, p.center), `${where}: ${key} inside the card`);
  }
  if (scenarioKey !== 'photo' || p.activeIndex === 0) {
    assert.ok(p.parts.phone?.box && inside(p.parts.phone.box, p.center), `${where}: phone inside the card`);
  }
  if (scenario.result.provider_code === 'NMC') {
    for (const key of ['distance', 'medical']) {
      assert.ok(p.parts[key]?.box && inside(p.parts[key].box, p.center), `${where}: ${key} inside the card`);
    }
    assert.match(p.parts.distance.text, /^\d+m$|^\d+\.\dkm$/u, `${where}: distance`);
    assert.match(p.parts.medical.text, /^등록 시간상 (진료|운영) 중 · 오늘 \d\d:\d\d~\d\d:\d\d$/u, `${where}: 진료시간 says it is the registered time`);
  }
  assert.doesNotMatch(p.parts.medical?.text || '', /진료 가능|접수 가능|바로 진료/u, `${where}: no unconfirmed claim`);
  // The 설정 map app, unchanged.
  assert.equal(p.mapProvider, p.expectedMapProvider, `${where}: map provider`);
  assert.equal(p.mapHref, p.expectedMapHref, `${where}: map href`);
  // Footer: under the card, never over it.
  if (p.shown > 1 || p.more.box) {
    assert.ok(p.hasFooterClass && p.footer, `${where}: footer shown`);
    assert.ok(p.footer.y >= p.center.b - 0.5, `${where}: footer ${p.footer.y} overlaps the card bottom ${p.center.b}`);
    assert.ok(inside(p.footer, p.rail), `${where}: footer inside the rail`);
  } else {
    assert.equal(p.footer, null, `${where}: nothing to show under a single card`);
    assert.equal(p.hasFooterClass, false, `${where}: no footer space for a single card`);
  }
  if (p.shown > 1) {
    assert.equal(p.position.text, `${p.activeIndex + 1}/${p.shown}`, `${where}: position`);
    assert.ok(p.position.box && inside(p.position.box, p.rail), `${where}: position shown`);
    // Read out on every turn, not when the answer first appears.
    assert.equal(p.status, announced ? `${p.activeIndex + 1} / ${p.shown} · ${p.centerName}` : '', `${where}: screen reader status`);
  } else {
    assert.equal(p.position.box, null, `${where}: no position for one card`);
  }
  if (testCase.mobile) {
    // No arrows; side cards wait unseen beside the card, never over it.
    assert.equal(p.prev.display, 'none', `${where}: ‹ on a phone`);
    assert.equal(p.next.display, 'none', `${where}: › on a phone`);
    for (const side of p.sides) {
      assert.equal(side.opacity, 0, `${where}: side card ${side.name} (${side.slot}) visible`);
      assert.equal(side.pointer, 'none', `${where}: side card ${side.name} takes taps`);
      assert.equal(overlapArea(side.box, p.center), 0, `${where}: side card ${side.name} (${side.slot}) under the center card`);
    }
  } else {
    assert.notEqual(p.prev.display, 'none', `${where}: ‹ on desktop`);
    assert.notEqual(p.next.display, 'none', `${where}: › on desktop`);
    assert.ok(inside(p.prev.box, p.rail) && inside(p.next.box, p.rail), `${where}: arrows inside the rail`);
    assert.equal(p.prev.disabled, p.shown < 2, `${where}: ‹ enabled with more than one card`);
    assert.ok(p.prev.box.b <= p.center.b && p.prev.box.y >= p.center.y, `${where}: arrows beside the card, not on the footer`);
  }
  // A card without a photo has no photo box.
  if (p.centerMedia) assert.equal(p.centerMedia.state, 'loaded', `${where}: a photo box only for a loaded photo`);
}

async function runScenario(page, origin, innerRel, testCase, scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  const log = [];
  const evaluate = async expression => {
    const result = await page.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await page.send('Page.navigate', {url: `${origin}/${innerRel}?scenario=${scenarioKey}`});
  await sleep(300);
  const ready = await waitFor(async () => {
    const text = await evaluate("document.getElementById('pmc-result')?.textContent || 'pending'").catch(() => 'pending');
    return text !== 'pending' ? text : null;
  }, `${testCase.label}/${scenarioKey}: harness`, 60000);
  const parsedReady = JSON.parse(ready);
  if (!parsedReady.ok) throw new Error(`${testCase.label}/${scenarioKey}: ${parsedReady.error}`);

  const tap = async (x, y) => {
    if (testCase.mobile) {
      await page.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
      await sleep(40);
      await page.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
      await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
      await sleep(40);
      await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
    }
  };
  const swipe = async (fromX, toX, y) => {
    const steps = 8;
    if (testCase.mobile) {
      await page.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: fromX, y}]});
      for (let i = 1; i <= steps; i += 1) {
        await page.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: fromX + (toX - fromX) * i / steps, y}]});
        await sleep(16);
      }
      await page.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX, y});
      await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: fromX, y, button: 'left', buttons: 1, clickCount: 1});
      for (let i = 1; i <= steps; i += 1) {
        await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX + (toX - fromX) * i / steps, y, button: 'left', buttons: 1});
        await sleep(16);
      }
      await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: toX, y, button: 'left', buttons: 0, clickCount: 1});
    }
  };
  const key = async name => {
    const codes = {ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35};
    await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name]});
    await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name]});
  };
  const shot = async name => {
    if (!SCREENSHOT_DIR) return;
    fs.mkdirSync(SCREENSHOT_DIR, {recursive: true});
    const {data} = await page.send('Page.captureScreenshot', {format: 'png'});
    fs.writeFileSync(path.join(SCREENSHOT_DIR, `${testCase.label}-${scenarioKey}-${name}.png`), Buffer.from(data, 'base64'));
  };

  let p = await evaluate(PROBE);
  const where0 = `${testCase.label}/${scenarioKey} initial`;
  const unique = scenario.names.length;
  assert.equal(p.total, unique, `${where0}: one card per institution (${p.total})`);
  assert.equal(p.placeCount, unique, `${where0}: place count`);
  assert.equal(p.shown, Math.min(unique, 3), `${where0}: three cards first`);
  assert.equal(p.cardCount, p.shown, `${where0}: card count`);
  assert.equal(p.centerName, scenario.names[0], `${where0}: Core's first place first`);
  if (unique > 3) {
    assert.equal(p.more.text, `다른 ${scenario.noun} 보기`, `${where0}: 더 보기 label`);
    assert.equal(p.more.aria, `다른 ${scenario.noun} ${unique - 3}곳 더 보기`, `${where0}: 더 보기 aria`);
    assert.ok(p.more.box && inside(p.more.box, p.rail) && p.more.box.h >= 32, `${where0}: 더 보기 shown`);
  } else {
    assert.equal(p.more.box, null, `${where0}: no 더 보기 when every card is shown`);
  }
  assert.equal(p.mediaCount, scenarioKey === 'photo' ? 1 : 0, `${where0}: a photo box only for the card with a photo`);
  checkLayout(where0, p, testCase, scenarioKey, {announced: false});
  await shot('initial');

  let expected = 0;
  const step = async (name, action, delta) => {
    const before = await evaluate(PROBE);
    await action(before);
    await sleep(450);
    p = await evaluate(PROBE);
    log.push(`${name}:${before.position.text || '-'}→${p.position.text || '-'}`);
    const where = `${testCase.label}/${scenarioKey} ${name} (${log.join(' ')})`;
    if (delta !== undefined) {
      expected = ((expected + delta) % p.shown + p.shown) % p.shown;
      assert.equal(p.activeIndex, expected, `${where}: center card`);
      assert.equal(p.centerName, scenario.names[expected], `${where}: center name`);
    }
    assert.deepEqual(p.anchors, [], `${where}: no link was opened`);
    checkLayout(where, p, testCase, scenarioKey, {announced: delta !== 0});
    return p;
  };
  const titleY = () => p.parts.title.box.cy;

  if (p.shown > 1) {
    if (testCase.mobile) {
      // Round and round with a finger: forward past the last card, then back.
      for (let i = 1; i <= p.shown; i += 1) await step(`swipe-left#${i}`, b => swipe(b.center.cx + 70, b.center.cx - 70, b.parts.title.box.cy), 1);
      await step('swipe-right', b => swipe(b.center.cx - 70, b.center.cx + 70, b.parts.title.box.cy), -1);
      // The card that just left waits on the side it was pushed toward.
      if (p.shown === 2) assert.ok(p.sides[0].slot.startsWith('RIGHT'), `${testCase.label}/${scenarioKey}: after a swipe right the other card waits on the right`);
      await step('swipe-left', b => swipe(b.center.cx + 70, b.center.cx - 70, b.parts.title.box.cy), 1);
      if (p.shown === 2) assert.ok(p.sides[0].slot.startsWith('LEFT'), `${testCase.label}/${scenarioKey}: after a swipe left the other card waits on the left`);
    } else {
      await step('next', b => tap(b.next.box.cx, b.next.box.cy), 1);
      await step('prev', b => tap(b.prev.box.cx, b.prev.box.cy), -1);
      await step('prev(wrap)', b => tap(b.prev.box.cx, b.prev.box.cy), -1);
      await step('mouse-drag-left', b => swipe(b.center.cx + 70, b.center.cx - 70, b.parts.title.box.cy), 1);
      await evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"CENTER\"]').focus({preventScroll: true}), true");
      await step('ArrowRight', () => key('ArrowRight'), 1);
      await step('ArrowLeft', () => key('ArrowLeft'), -1);
      await step('End', () => key('End'), p.shown - 1 - expected);
      await step('Home', () => key('Home'), -expected);
    }
  } else {
    await step('swipe-left(single)', b => swipe(b.center.cx + 70, b.center.cx - 70, b.parts.title.box.cy), 0);
  }

  if (unique > 3) {
    const beforeMore = await evaluate(PROBE);
    await tap(beforeMore.more.box.cx, beforeMore.more.box.cy);
    await sleep(450);
    p = await evaluate(PROBE);
    const where = `${testCase.label}/${scenarioKey} 더 보기`;
    assert.equal(p.shown, unique, `${where}: every card shown`);
    assert.equal(p.cardCount, unique, `${where}: card count`);
    assert.equal(p.activeIndex, 3, `${where}: the first added card comes to the center`);
    assert.equal(p.centerName, scenario.names[3], `${where}: center name`);
    assert.equal(p.position.text, `4/${unique}`, `${where}: position`);
    assert.equal(p.more.box, null, `${where}: 더 보기 gone`);
    assert.equal(p.focusedIsCenter, true, `${where}: focus moves to the added card, not lost with the button`);
    assert.deepEqual(p.anchors, [], `${where}: no link was opened`);
    checkLayout(where, p, testCase, scenarioKey);
    await shot('more');
    expected = 3;
    if (testCase.mobile) await step('swipe-left(after more, wrap)', b => swipe(b.center.cx + 70, b.center.cx - 70, b.parts.title.box.cy), 1);
    else await step('next(after more, wrap)', b => tap(b.next.box.cx, b.next.box.cy), 1);
  }

  // A plain tap on the card body still opens the NAVER search for it.
  const beforeTap = await evaluate(PROBE);
  await tap(beforeTap.parts.title.box.cx, titleY());
  await sleep(300);
  const afterTap = await evaluate(PROBE);
  assert.equal(afterTap.anchors.length, 1, `${testCase.label}/${scenarioKey}: card body tap opens one link ${JSON.stringify(afterTap.anchors)}`);
  assert.match(afterTap.anchors[0], /^https:\/\/(?:m\.)?search\.naver\.com\/search\.naver\?/u, `${testCase.label}/${scenarioKey}: NAVER search`);
  assert.equal(afterTap.activeIndex, beforeTap.activeIndex, `${testCase.label}/${scenarioKey}: a tap does not turn the cards`);

  // A tap on the text just above the 전화 / 길찾기 row stays on the text: the
  // browser's tap correction must not move it onto the phone or map link.
  const nearRow = await evaluate(PROBE);
  const lastText = [nearRow.parts.medical, nearRow.parts.distance, nearRow.parts.address].find(item => item?.box)?.box;
  const rowTop = Math.min(...[nearRow.parts.phone?.box, nearRow.parts.map.box].filter(Boolean).map(item => item.y));
  for (const x of [nearRow.parts.phone?.box?.cx, nearRow.center.cx, nearRow.parts.map.box.cx].filter(Number.isFinite)) {
    const y = Math.min(lastText.b + 2, rowTop - 4);
    await tap(x, y);
    await sleep(300);
    const after = await evaluate(PROBE);
    assert.equal(after.anchors.length, 1, `${testCase.label}/${scenarioKey}: text tap at ${x},${y} opens one link ${JSON.stringify(after.anchors)}`);
    assert.match(after.anchors[0], /^https:\/\/(?:m\.)?search\.naver\.com\//u, `${testCase.label}/${scenarioKey}: text tap at ${x},${y} opened ${after.anchors[0]}, not the NAVER search`);
  }
  // The buttons themselves still do their one job.
  await tap(nearRow.parts.map.box.cx, nearRow.parts.map.box.cy);
  await sleep(300);
  assert.deepEqual((await evaluate(PROBE)).anchors, [nearRow.mapHref], `${testCase.label}/${scenarioKey}: map button`);
  if (nearRow.parts.phone?.box) {
    await tap(nearRow.parts.phone.box.cx, nearRow.parts.phone.box.cy);
    await sleep(300);
    const phoneAnchors = (await evaluate(PROBE)).anchors;
    assert.equal(phoneAnchors.length, 1, `${testCase.label}/${scenarioKey}: phone button`);
    assert.match(phoneAnchors[0], /^tel:\d+$/u, `${testCase.label}/${scenarioKey}: phone button`);
  }
  return log;
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.place-medical-card-ux-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  for (const testCase of CASES) {
    const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
    const page = await openDevtools(browser, profile);
    try {
      await page.send('Page.enable');
      await page.send('Runtime.enable');
      await page.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
      await page.send('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
      if (testCase.mobile) await page.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
      for (const scenarioKey of Object.keys(SCENARIOS)) {
        const log = await runScenario(page, origin, innerRel, testCase, scenarioKey);
        console.log(`PLACE_MEDICAL_CARD_UX ${testCase.label}/${scenarioKey}`, log.join(' '));
      }
    } finally {
      page.close();
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('PLACE-MEDICAL-CARD-UX-FINAL-01 OK — phones swipe without arrows and see one whole card; no photo, no photo box; 1/3 and 다른 병원 보기; one card per institution; desktop keeps arrows and keys; the 설정 map app and the NAVER search stay');
