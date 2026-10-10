// EV-CHARGER-NEARBY-LIST-P0 — 지역정보 → 전기차 충전소 → 내 주변 충전소 목록.
//
// Contract checked here:
// * 지역정보 shows '전기차 충전소' right after 약국; the existing cards and
//   their order stay; phones keep the approved two-column grid with no empty
//   cell (an even count fills every row, an odd count spans the last card)
// * the card opens its own screen (/#ev-chargers), never the conversation:
//   no chat request, nothing typed into the composer, no AI
// * the screen calls only GET /v2/life/ev-chargers/nearby (credentials omit):
//   the current position (rounded to 4 decimals) when location use is on and
//   allowed, radius 5 km, nearest first; 급속 / 완속 / 충전 가능 and
//   1·3·5·10·20 km re-ask Core; 더 보기 pages with offset
// * each station: name, straight-line distance, address, "급속 3대 중 1대 사용
//   가능", charger lines (type · registered kW · status), "상태 확인 HH:MM";
//   a status Core could not confirm reads "현재 상태 확인 필요"
// * the map button is the saved map app's approved image
//   (/assets/place-actions) and opens that app (NAVER_MAP / KAKAO_NAVI / TMAP
//   / GOOGLE_MAPS; desktop 티맵 → 네이버지도 웹 with its icon); no phone button
// * location refused or off: a 시·도 / 시·군 picker; distances say "○○ 중심에서
//   직선"; a reload of /#ev-chargers never asks for the location by itself
// * empty result, provider down, quota, not ready, preparing, partial and a
//   network error each say what happened
// * system back and the screen's ← both land on 지역정보, a second back on
//   the home
// * 360/375/390/412 phones and 1280 desktop, light and dark: no horizontal
//   overflow, controls ≥ 44 px, readable text (viewport emulation, not a
//   device run; real map apps are not opened here)
//
// Core answers come from scripts/fixtures/ev_charger_nearby_p0_01.json,
// produced by lotbi-core app/ev_chargers.py itself on invented 테스트 stations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/ev_charger_nearby_p0_01.json'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const EXPECTED_CARDS = ['medical', 'pharmacy', 'ev-chargers', 'festivals', 'news', 'subway', 'onnuri', 'real-estate', 'local', 'jeonbuk-food', 'my-child'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

// ── Pure contract ───────────────────────────────────────────────────────
const sections = await import('../site-consumer-sections.js');
const ev = await import('../site-life-ev-chargers.js');
const navigation = await import('../site-navigation.js');
const {SITE_ROUTES} = await import('../site-route.js');

await check('지역정보: 전기차 충전소 right after 약국, the other cards and their order kept', () => {
  const ids = sections.LIFE_SHORTCUTS.map(item => item.id);
  assert.deepEqual(ids, EXPECTED_CARDS);
  assert.equal(ids.indexOf('ev-chargers'), ids.indexOf('pharmacy') + 1);
  const card = sections.LIFE_SHORTCUTS.find(item => item.id === 'ev-chargers');
  assert.equal(card.label, '전기차 충전소');
  assert.equal(card.icon, 'ev');
  for (const key of ['ask', 'prompt', 'choices', 'children']) assert.equal(card[key], undefined, key);
});

await check('the card opens its own routed screen; nothing goes to the conversation', () => {
  const source = read('site-consumer-sections.js');
  assert.match(source, /else if \(item\.id === 'ev-chargers'\) onEvChargers\?\.\(\);/u);
  assert.match(source, /export function mountConsumerSection\(\{section, root, onAsk, onFestival, onOnnuri, onEvChargers,/u);
  const conversation = read('site-conversation.js');
  assert.match(conversation, /onEvChargers: \(\) => \{ closeSurface\(\); void openEvChargers\(\); \},/u);
  assert.match(conversation, /workspace: 'life', route: 'ev-chargers', backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\), backRoute: 'life',/u);
  assert.match(conversation, /const \{mountEvChargers\} = await import\('\.\/site-life-ev-chargers\.js\?v=aset-[0-9a-f]{12}'\);/u);
  assert.match(conversation, /'ev-chargers': \(\) => openEvChargers\(\{askLocation: false\}\),/u, 'a URL-opened screen never asks for the location');
  assert.ok(SITE_ROUTES.includes('ev-chargers'));
  const screen = read('site-life-ev-chargers.js');
  for (const banned of [/\bonAsk\b/u, /requestAssistant|askWithoutKeyboard/u, /\/v2\/conversation/u, /tel:/u, /전화/u, /innerHTML/u,
    /localStorage\.setItem|sessionStorage/u, /navigator\.geolocation/u, /document\.cookie\s*=/u]) {
    assert.doesNotMatch(screen, banned, String(banned));
  }
  assert.match(screen, /\/v2\/life\/ev-chargers\/nearby/u);
  assert.match(screen, /readDefaultMapProvider\(documentRef\.cookie \|\| ''\)/u);
  assert.match(screen, /buildDefaultMapHref\(provider, place/u);
});

await check('styles: theme tokens only, linked from index.html and the callback document', () => {
  const css = read('site-life-ev-chargers.css');
  assert.doesNotMatch(css, /data-site-theme|prefers-color-scheme|#[0-9a-f]{3,6}\b|rgb\(/iu, 'theme tokens only');
  assert.match(read('index.html'), /<link rel="stylesheet" href="site-life-ev-chargers\.css\?v=aset-[0-9a-f]{12}" \/>/u);
  assert.match(read('auth/callback/index.html'), /<link rel="stylesheet" href="\/site-life-ev-chargers\.css\?v=aset-[0-9a-f]{12}" \/>/u);
});

await check('Core answer: contract, nearest first, stations once, unconfirmed status never shown as its old word', () => {
  const result = ev.normalizeEvSearch(FIXTURE.jeonju_5km_all);
  assert.equal(result.status, 'OK');
  assert.equal(result.stations.length, 5);
  const distances = result.stations.map(item => item.distanceMeters);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.equal(result.stations[0].name, '테스트 전주 시청 급속');
  assert.deepEqual(result.stations[0].summary.FAST, {total: 3, checked: 3, available: 1});
  assert.equal(ev.normalizeEvSearch({...FIXTURE.jeonju_5km_all, contract_id: 'OTHER'}), null);
  const doubled = ev.normalizeEvSearch({...FIXTURE.jeonju_5km_all, stations: [...FIXTURE.jeonju_5km_all.stations, FIXTURE.jeonju_5km_all.stations[0]]});
  assert.equal(doubled.stations.length, 5, 'one station once');
  const unplaced = ev.normalizeEvSearch({...FIXTURE.jeonju_5km_all, stations: [{...FIXTURE.jeonju_5km_all.stations[0], latitude: null}]});
  assert.equal(unplaced.stations.length, 0, 'no coordinate, not placed');
  const stale = ev.normalizeEvSearch(FIXTURE.stale_status);
  for (const station of stale.stations) {
    assert.ok(station.chargers.every(charger => charger.statusLabel === '현재 상태 확인 필요'), station.name);
    assert.ok(Object.values(station.summary).every(bucket => bucket.checked === 0 && bucket.available === 0));
  }
  assert.equal(ev.normalizeEvSearch(FIXTURE.preparing).status, 'PREPARING');
  assert.deepEqual(ev.normalizeEvSearch(FIXTURE.partial_border).regionsMissing, ['충청남도']);
});

await check('summary words count only what was confirmed', () => {
  assert.equal(ev.speedSummaryText('FAST', {total: 3, checked: 3, available: 1}), '급속 3대 중 1대 사용 가능');
  assert.equal(ev.speedSummaryText('SLOW', {total: 2, checked: 1, available: 1}), '완속 2대 중 1대 사용 가능 · 1대 상태 확인 필요');
  assert.equal(ev.speedSummaryText('FAST', {total: 2, checked: 0, available: 0}), '급속 2대 · 현재 상태 확인 필요');
  assert.equal(ev.speedSummaryText('UNKNOWN', {total: 1, checked: 1, available: 0}), '유형 확인 불가 1대 중 0대 사용 가능');
  const station = ev.normalizeEvSearch(FIXTURE.jeonju_5km_all).stations[0];
  assert.deepEqual(ev.chargerGroupLines(station.chargers).map(line => line.text),
    ['급속 DC콤보 100kW 2대 · 사용 가능 1 · 충전 중 1', '급속 AC3상 43kW · 통신 장애']);
});

await check('request: rounded position, radius choices, filters, region origin', () => {
  const url = new URL(ev.evChargerSearchUrl({latitude: 35.824236, longitude: 127.148041}, 'https://api.lotbiai.com'));
  assert.equal(url.pathname, '/v2/life/ev-chargers/nearby');
  assert.deepEqual(Object.fromEntries(url.searchParams), {latitude: '35.8242', longitude: '127.148', radius_km: '5', charging_speed: 'all', limit: '10', offset: '0'});
  const filtered = new URL(ev.evChargerSearchUrl({latitude: 35.8, longitude: 127.1, radiusKm: 20, speed: 'fast', availableOnly: true, offset: 10, origin: 'region'}, 'https://api.lotbiai.com'));
  assert.deepEqual(Object.fromEntries(filtered.searchParams), {latitude: '35.8', longitude: '127.1', radius_km: '20', charging_speed: 'fast', available_only: 'true', limit: '10', offset: '10', origin: 'region'});
  assert.equal(new URL(ev.evChargerSearchUrl({latitude: 35.8, longitude: 127.1, radiusKm: 7}, 'https://x.test')).searchParams.get('radius_km'), '5');
  assert.throws(() => ev.evChargerSearchUrl({latitude: 40.1, longitude: 127.1}));
});

const PROVIDER_EXPECT = {
  NAVER_MAP: {icon: 'naver-map', android: /^intent:\/\/navigation\?.*package=com\.nhn\.android\.nmap;/u, ios: /\/map-handoff\.html\?provider=NAVER_MAP&/u, desktop: /^https:\/\/map\.naver\.com\/p\/search\//u, desktopIcon: 'naver-map'},
  KAKAO_NAVI: {icon: 'kakao-map', android: /\/kakao-navi\.html\?name=/u, ios: /\/kakao-navi\.html\?name=/u, desktop: /^https:\/\/map\.kakao\.com\/link\/to\//u, desktopIcon: 'kakao-map'},
  TMAP: {icon: 'tmap', android: /^intent:\/\/route\?goalname=.*package=com\.skt\.tmap\.ku;/u, ios: /\/map-handoff\.html\?provider=TMAP&/u, desktop: /^https:\/\/map\.naver\.com\/p\/search\//u, desktopIcon: 'naver-map'},
  GOOGLE_MAPS: {icon: 'google-maps', android: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, ios: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, desktop: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, desktopIcon: 'google-maps'},
};

await check('map app: the icon is the approved image of the app the link really opens', () => {
  const station = ev.normalizeEvSearch(FIXTURE.jeonju_5km_all).stations[0];
  const place = {name: station.name, address: station.address, placeId: `ev:${station.id}`, latitude: station.latitude, longitude: station.longitude, navigationCapable: true};
  for (const [provider, want] of Object.entries(PROVIDER_EXPECT)) {
    for (const [platform, userAgent] of [['android', ANDROID_UA], ['ios', IPHONE_UA], ['desktop', DESKTOP_UA]]) {
      const href = navigation.buildDefaultMapHref(provider, place, {userAgent, origin: 'https://lotbiai.com'});
      assert.match(href, want[platform], `${provider} ${platform}: ${href}`);
      const {icon} = ev.evMapIcon(provider, {userAgent});
      assert.equal(icon, platform === 'desktop' ? want.desktopIcon : want.icon, `${provider} ${platform}`);
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/place-actions', `${icon}.png`)), icon);
    }
  }
});

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the 전기차 충전소 validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.stat(target,(error,stat)=>send(res,!error&&stat.isDirectory()?path.join(target,'index.html'):target));
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(child) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    child.once('error', reject);
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);
async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

// Fake Account status + Core (anonymous reader), installed before any page
// script on every document. localStorage.__evScenario picks a Core answer.
const MOCK = `(() => {
  const F = ${JSON.stringify(FIXTURE)};
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const log = window.__evLog = {nearby: [], chat: [], regions: 0, geo: 0};
  const geo = navigator.geolocation;
  if (geo) {
    const current = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (...args) => { log.geo += 1; return current(...args); };
    const watch = geo.watchPosition.bind(geo);
    geo.watchPosition = (...args) => { log.geo += 1; return watch(...args); };
  }
  const pick = params => {
    const scenario = read('__evScenario') || 'normal';
    if (scenario === 'paging') return params.offset === '10' ? F.page_2 : F.page_1;
    if (scenario === 'preparing_then_ok') return log.nearby.length === 1 ? {...F.preparing, retry_after_seconds: 2} : F.jeonju_5km_all;
    if (scenario !== 'normal' && F[scenario]) return F[scenario];
    if (params.origin === 'region') return F.jeonju_region_5km_all;
    if (params.available_only === 'true') return F.jeonju_5km_available;
    if (params.charging_speed === 'fast') return F.jeonju_5km_fast;
    if (params.charging_speed === 'slow') return F.jeonju_5km_slow;
    if (params.radius_km === '20') return F.jeonju_20km_all;
    if (params.radius_km === '1') return F.jeonju_1km_all;
    return F.jeonju_5km_all;
  };
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    if (/\\/messages$/u.test(url.pathname) || url.pathname.startsWith('/v2/web-chat') || url.pathname.startsWith('/v2/conversation/turns')) log.chat.push(url.pathname);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (url.pathname === '/v2/life/weather/regions') {
      log.regions += 1;
      return json({items: [
        {code: 'KR_SEOUL', label: '서울특별시', province: '서울특별시', latitude: 37.5665, longitude: 126.978},
        {code: 'KR_JEONJU', label: '전주시', province: '전북특별자치도', latitude: 35.8242, longitude: 127.148},
      ], provinces: ['서울특별시', '전북특별자치도'], ai_calls: 0});
    }
    if (url.pathname === '/v2/life/ev-chargers/nearby') {
      const params = Object.fromEntries(url.searchParams);
      log.nearby.push({params, credentials: init.credentials || '', mode: init.mode || '', method: init.method || 'GET', referrerPolicy: init.referrerPolicy || ''});
      if ((read('__evScenario') || '') === 'network_error') throw new TypeError('Failed to fetch');
      return json(pick(params));
    }
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const CASES = [
  {label: 'android-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA, full: true},
  {label: 'iphone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, messages: true, providers: 'ios'},
  {label: 'android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, providers: 'android', dark: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, providers: 'desktop', dark: true, full: true},
];

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(async () => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
      return;
    }
    if (message.method) for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

// In the page: what the 전기차 충전소 screen shows and how it is laid out.
const SNAPSHOT = `(() => {
  const surface = document.querySelector('[data-site-route="ev-chargers"]');
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return 0; const a = lum(parse(getComputedStyle(node).color).slice(0, 3)), b = lum(bgOf(node)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const items = [...(surface?.querySelectorAll('.ev-station') || [])].map(item => {
    const link = item.querySelector('.ev-map-link');
    const image = link?.querySelector('img');
    const rect = item.getBoundingClientRect();
    const linkRect = link?.getBoundingClientRect();
    return {
      id: item.dataset.evStation,
      name: item.querySelector('.ev-station-name')?.textContent || '',
      distance: item.querySelector('.ev-station-distance')?.textContent || '',
      address: item.querySelector('.ev-station-address')?.textContent || '',
      badges: [...item.querySelectorAll('.ev-badge')].map(node => node.textContent),
      chargers: [...item.querySelectorAll('.ev-charger')].map(node => node.textContent),
      meta: item.querySelector('.ev-station-meta')?.textContent || '',
      checked: item.querySelector('.ev-station-checked')?.textContent || '',
      href: link?.getAttribute('href') || '',
      target: link?.target || '',
      rel: link?.rel || '',
      provider: link?.dataset.mapProvider || '',
      icon: link?.dataset.mapIcon || '',
      img: image?.getAttribute('src') || '',
      imgLoaded: Boolean(image && image.complete && image.naturalWidth > 0),
      imgFailed: Boolean(image && image.complete && image.naturalWidth === 0),
      aria: link?.getAttribute('aria-label') || '',
      right: rect.right, width: rect.width,
      linkBox: linkRect ? {w: linkRect.width, h: linkRect.height} : null,
      contrastName: contrast(item.querySelector('.ev-station-name')),
      contrastCharger: contrast(item.querySelector('.ev-charger')),
      contrastSecondary: contrast(item.querySelector('.ev-station-address')),
    };
  });
  const controls = [...(surface?.querySelectorAll('button, a, select') || [])].filter(node => node.getClientRects().length && !node.hidden);
  const small = controls.map(node => ({node, r: node.getBoundingClientRect()})).filter(({r}) => r.height < 43.5 || r.width < 43.5)
    .map(({node, r}) => (node.className || node.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  return {
    hash: location.hash,
    open: Boolean(surface),
    title: surface?.querySelector('.site-modal-header h2, .site-modal h2, h2')?.textContent || '',
    back: surface?.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    basis: surface?.querySelector('.ev-basis')?.textContent || '',
    status: surface?.querySelector('.ev-status')?.textContent || '',
    notice: surface?.querySelector('.ev-notice:not([hidden])')?.textContent || '',
    errorText: surface?.querySelector('.ev-error:not([hidden])')?.textContent || '',
    locationNote: surface?.querySelector('.ev-location-note')?.textContent || '',
    settingsLink: surface?.querySelector('.ev-location-note a')?.getAttribute('href') || '',
    regionVisible: Boolean(surface?.querySelector('.ev-region-row:not([hidden])')),
    more: Boolean(surface?.querySelector('.ev-more:not([hidden])')),
    widen: surface?.querySelector('.ev-widen')?.textContent || '',
    source: surface?.querySelector('.ev-source')?.textContent || '',
    pressed: [...(surface?.querySelectorAll('[aria-pressed="true"]') || [])].map(node => node.textContent),
    items,
    tel: surface ? surface.querySelectorAll('a[href^="tel:"]').length : -1,
    phoneWord: /전화/u.test(surface?.textContent || ''),
    listLabel: surface?.querySelector('.ev-results')?.getAttribute('aria-label') || '',
    statusRole: surface?.querySelector('.ev-status')?.getAttribute('role') || '',
    overflow: Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth),
    small,
    log: JSON.parse(JSON.stringify(window.__evLog || {})),
    prompt: document.getElementById('lotbi-prompt')?.value || '',
    lifeVisible: Boolean(document.querySelector('[data-site-route="life"] [data-life-shortcut="ev-chargers"]')),
    homeVisible: !document.querySelector('[data-site-route]'),
  };
})()`;

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.EV_CHARGER_SCREENSHOT_DIR || '';
  const label = testCase.label;
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1500));
      return result.result.value;
    };
    const errors = [];
    cdp.on(message => {
      if (message.sessionId === sessionId && message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'exception');
    });
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: 'light'}]});
    await page('Emulation.setGeolocationOverride', {latitude: 35.824236, longitude: 127.148041, accuracy: 20});
    const permission = setting => cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting});
    await permission('granted');

    const loadEvent = () => new Promise(resolve => {
      const stop = cdp.on(message => { if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); } });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    const navigate = async url => { const loaded = loadEvent(); await page('Page.navigate', {url}); await loaded; };
    const ready = () => waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${label}: page ready`, 30000);
    const snapshot = () => evaluate(SNAPSHOT);
    const go = async delta => {
      const {currentIndex, entries} = await page('Page.getNavigationHistory');
      const entry = entries[currentIndex + delta];
      assert.ok(entry, `${label}: history entry ${delta} from ${currentIndex}`);
      await page('Page.navigateToHistoryEntry', {entryId: entry.id});
    };
    const tapSelector = async selector => {
      const box = await waitFor(() => evaluate(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(node => node.getClientRects().length && !node.closest('[inert]'));
        const node = nodes[0]; if (!node) return null;
        node.scrollIntoView({block: 'center', inline: 'center'});
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
      })()`), `${label}: tap target ${selector}`);
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x, y: box.y}]});
        await sleep(30);
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: box.x, y: box.y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(30);
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    const openLife = async () => {
      if (testCase.mobile) {
        await tapSelector('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), `${label}: drawer`);
        await sleep(150);
        await tapSelector('#mobile-nav-drawer [data-consumer-section="life"]');
      } else {
        await tapSelector('.chat-sidebar-desktop [data-consumer-section="life"]');
      }
      return waitFor(async () => { const s = await snapshot(); return s.lifeVisible && s.hash === '#life' ? s : {ok: false, s}; }, `${label}: 지역정보`);
    };
    // The map icons are one small cached image; a busy machine may still be
    // decoding it, so a list is settled once every icon has finished loading.
    const listed = (count, extra = () => true) => waitFor(async () => {
      const s = await snapshot();
      const images = s.items.every(item => item.imgLoaded || item.imgFailed);
      return s.open && s.hash === '#ev-chargers' && s.items.length === count && !/찾는 중/u.test(s.status) && images && extra(s) ? s : {ok: false, s: {...s, items: s.items.map(i => i.name)}};
    }, `${label}: ${count} stations`);
    const settledScreen = predicate => waitFor(async () => { const s = await snapshot(); return s.open && predicate(s) ? s : {ok: false, s: {...s, items: s.items.length}}; }, `${label}: screen state`, 20000);
    const setScenario = value => evaluate(`(() => { localStorage.setItem('__evScenario', ${JSON.stringify(value)}); return true; })()`);
    const setCookie = (name, value) => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + ${JSON.stringify(value)} + '; path=/; SameSite=Lax'; return true; })()`);
    const clearCookie = name => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + '; path=/; max-age=0'; return true; })()`);
    const reopenFromUrl = async () => { await navigate('about:blank'); await navigate(`${origin}/#ev-chargers`); await ready(); };

    // 1. Home → 지역정보: the card sits after 약국 in the approved grid.
    await navigate(`${origin}/`);
    await ready();
    await evaluate("(() => { localStorage.removeItem('__evScenario'); return true; })()");
    await openLife();
    const grid = await evaluate(`(() => {
      const grid = document.querySelector('[data-site-route="life"] .consumer-shortcuts');
      const cards = [...grid.querySelectorAll('.consumer-shortcut')];
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = new Map();
      for (const card of cards) { const r = card.getBoundingClientRect(); const key = Math.round(r.top); rows.set(key, (rows.get(key) || 0) + (Math.abs(r.width - grid.getBoundingClientRect().width) < 4 ? columns : 1)); }
      return {ids: cards.map(card => card.dataset.lifeShortcut), columns, rows: [...rows.values()],
        heights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
        evIcon: Boolean(grid.querySelector('[data-life-shortcut="ev-chargers"] svg path')),
        evLabel: grid.querySelector('[data-life-shortcut="ev-chargers"] span')?.textContent || ''};
    })()`);
    await check(`${label}: 지역정보 grid — 전기차 충전소 after 약국, ${testCase.mobile ? 'two columns' : 'the desktop grid'}, every row full`, () => {
      assert.deepEqual(grid.ids, EXPECTED_CARDS);
      if (testCase.mobile) assert.equal(grid.columns, 2, 'phones keep two columns');
      assert.ok(grid.rows.every(count => count === grid.columns), JSON.stringify(grid));
      assert.ok(grid.heights.every(height => height >= 44), JSON.stringify(grid.heights));
      assert.equal(grid.evLabel, '전기차 충전소');
      assert.ok(grid.evIcon);
    });

    // 2. The card opens the list: no chat, the current position, nearest first.
    await tapSelector('[data-site-route="life"] [data-life-shortcut="ev-chargers"]');
    let s = await listed(5);
    await check(`${label}: tap → /#ev-chargers list from the current position; no chat, nothing typed`, () => {
      assert.equal(s.hash, '#ev-chargers');
      assert.match(s.title, /내 주변 전기차 충전소/u);
      assert.equal(s.back, '지역정보로 돌아가기');
      assert.equal(s.basis, '현재 위치 기준 · 반경 5km · 가까운 순(직선거리)');
      assert.deepEqual(s.log.chat, [], 'no conversation request');
      assert.equal(s.prompt, '', 'nothing typed into the composer');
      assert.equal(s.log.nearby.length, 1);
      const call = s.log.nearby[0];
      assert.deepEqual(call.params, {latitude: '35.8242', longitude: '127.148', radius_km: '5', charging_speed: 'all', limit: '10', offset: '0'});
      assert.equal(call.credentials, 'omit'); assert.equal(call.mode, 'cors'); assert.equal(call.method, 'GET'); assert.equal(call.referrerPolicy, 'no-referrer');
      assert.deepEqual(s.items.map(item => item.name), ['테스트 전주 시청 급속', '테스트 전주 NACS', '테스트 전주 아파트 완속', '테스트 전주 공영주차장 완속', '테스트 완주 경계 급속']);
      const meters = s.items.map(item => { const m = /직선 ([\d.]+)(k?m)/u.exec(item.distance); return m ? Number(m[1]) * (m[2] === 'km' ? 1000 : 1) : NaN; });
      assert.ok(meters.every(Number.isFinite) && meters.every((value, index) => index === 0 || value >= meters[index - 1]), JSON.stringify(s.items.map(i => i.distance)));
      assert.deepEqual(s.items[0].badges, ['급속 3대 중 1대 사용 가능']);
      assert.deepEqual(s.items[0].chargers, ['급속 DC콤보 100kW 2대 · 사용 가능 1 · 충전 중 1', '급속 AC3상 43kW · 통신 장애']);
      assert.match(s.items[0].checked, /^상태 확인 \d{2}:\d{2}$/u);
      assert.match(s.items[2].meta, /이용 제한: 거주자외 출입제한/u);
      assert.ok(s.items[2].badges.includes('완속 2대 중 1대 사용 가능 · 1대 상태 확인 필요'), JSON.stringify(s.items[2].badges));
      assert.match(s.items[3].chargers[0], /현재 상태 확인 필요/u);
      assert.deepEqual(s.items[1].chargers, ['급속 NACS 50kW · 사용 가능', 'NACS (급속·완속 확인 불가) · 사용 가능', 'AC3상 22kW (급속·완속 확인 불가) · 사용 가능']);
      assert.match(s.source, /출처: 한국환경공단 전기자동차 충전소 정보\(공공데이터포털\) · 충전소 정보 \d{2}:\d{2} 기준\. 거리는 도로 거리가 아니라 직선거리예요\./u);
      assert.equal(s.tel, 0, 'no phone link');
      assert.equal(s.phoneWord, false, 'no phone button');
      assert.equal(s.listLabel, '가까운 충전소');
      assert.equal(s.statusRole, 'status');
    });
    await check(`${label}: default map app (네이버지도) — its approved icon, its link`, () => {
      const platform = testCase.userAgent === DESKTOP_UA ? 'desktop' : testCase.userAgent === IPHONE_UA ? 'ios' : 'android';
      for (const item of s.items) {
        assert.equal(item.provider, 'NAVER_MAP');
        assert.equal(item.icon, 'naver-map');
        assert.equal(item.img, '/assets/place-actions/naver-map.png?v=place-icons-20260925');
        assert.equal(item.imgLoaded, true, 'the approved image loads');
        assert.match(item.href, PROVIDER_EXPECT.NAVER_MAP[platform], item.href);
        assert.equal(item.target, '_blank'); assert.equal(item.rel, 'noopener noreferrer');
        assert.equal(item.aria, `${item.name} 길찾기 (네이버지도)`);
        assert.ok(item.linkBox.w >= 44 && item.linkBox.h >= 44, JSON.stringify(item.linkBox));
      }
    });
    await check(`${label}: no horizontal overflow, controls ≥ 44 px, readable`, () => {
      assert.ok(s.overflow <= 0, `overflow ${s.overflow}`);
      assert.deepEqual(s.small, []);
      for (const item of s.items) {
        assert.ok(item.right <= testCase.width + 0.5, `${item.name} right ${item.right}`);
        assert.ok(item.contrastName >= 4.5 && item.contrastCharger >= 4.5 && item.contrastSecondary >= 3, JSON.stringify(item));
      }
    });
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
      fs.writeFileSync(path.join(shots, `${label}-light.png`), Buffer.from(data, 'base64'));
    }
    if (testCase.dark) {
      await evaluate("(() => { document.body.dataset.siteTheme = 'dark'; return true; })()");
      await sleep(60);
      const dark = await snapshot();
      await check(`${label}: dark theme readable`, () => {
        for (const item of dark.items) assert.ok(item.contrastName >= 4.5 && item.contrastCharger >= 4.5 && item.contrastSecondary >= 3, JSON.stringify(item));
      });
      if (shots) {
        const {data} = await page('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(shots, `${label}-dark.png`), Buffer.from(data, 'base64'));
      }
      await evaluate("(() => { document.body.dataset.siteTheme = 'light'; return true; })()");
    }

    // 3. Filters and radius ask Core again.
    const lastCall = st => st.log.nearby.at(-1).params;
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-speed="fast"]');
    s = await listed(3, st => lastCall(st).charging_speed === 'fast');
    await check(`${label}: 급속 → charging_speed=fast, only 급속 lines`, () => {
      assert.ok(s.items.every(item => item.badges.every(badge => badge.startsWith('급속'))), JSON.stringify(s.items.map(i => i.badges)));
      assert.ok(s.pressed.includes('급속'));
    });
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-speed="slow"]');
    s = await listed(2, st => lastCall(st).charging_speed === 'slow');
    await check(`${label}: 완속 → charging_speed=slow`, () => {
      assert.ok(s.items.every(item => item.badges.every(badge => badge.startsWith('완속'))));
    });
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-speed="all"]');
    await listed(5, st => lastCall(st).charging_speed === 'all');
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-available-only]');
    s = await listed(3, st => lastCall(st).available_only === 'true');
    await check(`${label}: 충전 가능 → available_only=true, pressed`, () => {
      assert.ok(s.pressed.includes('충전 가능'));
      assert.deepEqual(s.items.map(item => item.name), ['테스트 전주 시청 급속', '테스트 전주 NACS', '테스트 완주 경계 급속']);
    });
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-available-only]');
    await listed(5, st => lastCall(st).available_only === undefined);
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-radius="20"]');
    s = await listed(6, st => lastCall(st).radius_km === '20');
    await check(`${label}: 20km → radius_km=20 and the basis says so`, () => {
      assert.equal(s.basis, '현재 위치 기준 · 반경 20km · 가까운 순(직선거리)');
      assert.ok(s.pressed.includes('20km'));
    });
    await tapSelector('[data-site-route="ev-chargers"] [data-ev-radius="5"]');
    await listed(5, st => lastCall(st).radius_km === '5');

    // 4. System back → 지역정보 → home; ← → 지역정보 → back → home.
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '#life' && st.lifeVisible && !st.open ? st : {ok: false, st}; }, `${label}: back to 지역정보`);
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '' && st.homeVisible ? st : {ok: false, st}; }, `${label}: back to home`);
    await openLife();
    await tapSelector('[data-site-route="life"] [data-life-shortcut="ev-chargers"]');
    await listed(5);
    await tapSelector('[data-site-route="ev-chargers"] .site-modal-close');
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '#life' && st.lifeVisible && !st.open ? st : {ok: false, st}; }, `${label}: ← to 지역정보`);
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '' && st.homeVisible ? st : {ok: false, st}; }, `${label}: ← then back to home`);
    await check(`${label}: system back and ← both land on 지역정보, a second back on the home`, () => {
      assert.equal(s.hash, '');
      assert.deepEqual(s.log.chat, []);
    });

    if (testCase.full) {
      // 5. 더 보기.
      await setScenario('paging');
      await reopenFromUrl();
      s = await listed(10);
      assert.ok(s.more, `${label}: 더 보기 shown`);
      await tapSelector('[data-site-route="ev-chargers"] .ev-more');
      s = await listed(14, st => lastCall(st).offset === '10');
      await check(`${label}: 더 보기 → offset=10, appended, then hidden`, () => {
        assert.equal(s.more, false);
        assert.equal(new Set(s.items.map(item => item.id)).size, 14);
      });
      await setScenario('normal');

      // 6. Location refused: region picker, distances from the place's center.
      await permission('denied');
      await reopenFromUrl();
      s = await settledScreen(st => st.regionVisible && /위치 권한이 허용되지 않아/u.test(st.locationNote) && st.log.regions > 0 && !/찾는 중/u.test(st.status));
      await evaluate(`(() => {
        const surface = document.querySelector('[data-site-route="ev-chargers"]');
        const province = surface.querySelector('[data-ev-region="province"]');
        province.value = '전북특별자치도'; province.dispatchEvent(new Event('change', {bubbles: true}));
        const city = surface.querySelector('[data-ev-region="city"]');
        city.value = '전주시'; city.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
      })()`);
      s = await listed(5, st => lastCall(st)?.origin === 'region');
      await check(`${label}: location refused → 시·도/시·군 picker; "전주시 중심에서 직선"; no position read`, () => {
        assert.deepEqual(lastCall(s), {latitude: '35.8242', longitude: '127.148', radius_km: '5', charging_speed: 'all', limit: '10', offset: '0', origin: 'region'});
        assert.equal(s.basis, '전주시 중심 기준 · 반경 5km · 가까운 순(직선거리)');
        assert.ok(s.items.every(item => item.distance.startsWith('전주시 중심에서 직선 ')), JSON.stringify(s.items.map(i => i.distance)));
        assert.equal(s.log.geo, 0, 'the browser position was not read');
        assert.match(s.status, /전주시 중심에서 가까운 충전소/u);
      });

      // 7. A reload never asks: permission not decided → button + picker, no read.
      await cdp.send('Browser.resetPermissions');
      await reopenFromUrl();
      s = await settledScreen(st => st.regionVisible && /현재 위치로 찾으려면/u.test(st.locationNote) && /시·도와 시·군을 고르면/u.test(st.status));
      await check(`${label}: /#ev-chargers reload with an undecided permission asks nothing`, () => {
        assert.equal(s.log.geo, 0);
        assert.equal(s.log.nearby.length, 0, 'no search until a place is chosen');
        assert.match(s.status, /시·도와 시·군을 고르면/u);
      });

      // 8. LOTBI location use off: picker + settings link, no position read.
      await permission('granted');
      await setCookie('lotbi_location_usage_v1', 'off');
      await reopenFromUrl();
      s = await settledScreen(st => /위치 사용이 꺼져 있어/u.test(st.locationNote) && st.regionVisible && st.status !== '');
      await check(`${label}: location use off → settings link, picker, no position read`, () => {
        assert.equal(s.settingsLink, 'https://account.lotbiai.com/account#privacy');
        assert.ok(s.regionVisible);
        assert.equal(s.log.geo, 0);
      });
      await clearCookie('lotbi_location_usage_v1');
    }

    if (testCase.messages) {
      const scenarios = [
        ['no_results', st => /반경 5km 안에 조건에 맞는 충전소가 공공데이터에 없어요/u.test(st.status) && st.widen === '반경 10km로 넓히기'],
        ['unavailable_provider', st => /한국환경공단\)가 지금 응답하지 않아요/u.test(st.errorText) && /다시 시도/u.test(st.errorText)],
        ['unavailable_quota', st => /조회 한도/u.test(st.errorText)],
        ['unavailable_access', st => /연결을 준비하고 있어요/u.test(st.errorText)],
        ['disabled', st => /전기차 충전소 정보를 준비하고 있어요/u.test(st.status) && !st.items.length],
        ['network_error', st => /인터넷 연결을 확인/u.test(st.errorText)],
        ['partial_border', st => /충청남도 충전소 정보를 지금 불러오지 못해 일부만 보여 드려요/u.test(st.notice) && st.items.length === 1],
        ['stale_status', st => st.items.length === 5 && st.items.every(item => item.badges.every(badge => /현재 상태 확인 필요/u.test(badge))) && /새로 확인하지 못한/u.test(st.notice)],
      ];
      for (const [scenario, ok] of scenarios) {
        await setScenario(scenario);
        await reopenFromUrl();
        const state = await settledScreen(ok);
        await check(`${label}: ${scenario} says what happened`, () => {
          assert.ok(ok(state));
          if (scenario === 'stale_status') assert.ok(state.items.every(item => item.checked === '현재 상태 확인 필요'));
        });
      }
      await setScenario('preparing_then_ok');
      await reopenFromUrl();
      const preparing = await settledScreen(st => /불러오는 중이에요/u.test(st.status));
      assert.match(preparing.status, /전북특별자치도 충전소 정보를 공공데이터에서 불러오는 중이에요/u);
      s = await listed(5);
      await check(`${label}: PREPARING shows the 시·도 being loaded, then retries by itself`, () => {
        assert.equal(s.log.nearby.length, 2);
      });
      await setScenario('normal');
    }

    if (testCase.providers) {
      for (const [provider, want] of Object.entries(PROVIDER_EXPECT)) {
        await setCookie('lotbi_default_map_provider_v1', provider);
        await reopenFromUrl();
        s = await listed(5);
        const icon = testCase.providers === 'desktop' ? want.desktopIcon : want.icon;
        await check(`${label}: saved ${provider} → its approved icon (${icon}) and its link`, () => {
          for (const item of s.items) {
            assert.equal(item.provider, provider);
            assert.equal(item.icon, icon);
            assert.equal(item.img, `/assets/place-actions/${icon}.png?v=place-icons-20260925`);
            assert.equal(item.imgLoaded, true);
            assert.match(item.href, want[testCase.providers], item.href);
          }
          assert.match(s.items[0].aria, /길찾기 \(/u);
        });
      }
      await clearCookie('lotbi_default_map_provider_v1');
    }

    await check(`${label}: no page error`, () => {
      assert.deepEqual(errors.filter(text => !/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED/u.test(text)), []);
    });
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.ev-charger-nearby-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const only = (process.env.EV_CHARGER_CASES || '').split(',').map(item => item.trim()).filter(Boolean);
  for (const testCase of CASES) {
    if (only.length && !only.includes(testCase.label)) continue;
    await runCase(browser, origin, dir, testCase);
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`EV-CHARGER-NEARBY-LIST-P0 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
