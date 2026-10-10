// TRAFFIC-CCTV P0 — 지역정보 → 실시간 도로 CCTV → 도로 → 노선 → 방향 → 구간 → CCTV → 영상.
//
// Contract checked here:
// * shipped switch TRAFFIC_CCTV_UI_ENABLED (site-feature-flags.js) off — owner
//   decision 2026-10-10: no card, no #traffic-cctv route, no module, no player,
//   no CCTV request, even when the URL names #traffic-cctv; the 지역정보 grid is
//   main's eight cards. Everything below runs with the switch served on by
//   this validator's own server (the shipped file is not changed).
// * on: 지역정보 shows '도로 CCTV' (screen title 실시간 도로 CCTV) right after 온누리상품권; the other cards
//   and their order stay; phones keep the approved two-column grid with no
//   empty cell (nine cards: the odd last card spans its row)
// * the card opens its own screen (/#traffic-cctv), never the conversation:
//   no chat request, nothing typed, no AI; no location is asked for or read
//   (no geolocation call, no geolocation permission query)
// * the screen calls only GET /v2/life/traffic-cctv/{roads,routes,sections,
//   cameras,playback} (credentials omit, no referrer) with opaque ids
// * 고속도로 → 노선 (official order, search) → 방향 (only reorders 구간) → 구간
//   (IC·JC, counts, "CCTV 없음", "구간 미확인 CCTV") → CCTV; a route without
//   official 구간 lists its cameras with a note; 국도 → 국도 번호 → CCTV
// * unplayable cameras say why and never open a player; the list carries no
//   stream URL
// * the player: one history entry; one back (system / browser / "목록으로")
//   closes it and releases the stream (no src, hls.js destroyed, no more CDN
//   requests); the list, route and 구간 stay as they were; a second back lands
//   on 지역정보, a third on the home
// * a real stream plays in the player (a test video served at the CDN URL);
//   HLS goes through the sealed hls.js (SRI) where the browser needs it; a
//   stream that fails says so and offers 다시 시도
// * the saved map app decides the map link and its approved icon
// * re-entering the screen restores the road, route, direction and 구간
// * provider down, preparing, disabled and network errors each say what happened
// * 360/375/390/412 phones and 1280 desktop, light and dark: no horizontal
//   overflow, controls ≥ 44 px, readable text (viewport emulation, not a
//   device run)
//
// Core answers come from scripts/fixtures/traffic_cctv_route_select_p0_01.json,
// produced by lotbi-core app/traffic_cctv.py itself (real route / facility
// names, invented stream tokens and coordinates — not real cameras).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/traffic_cctv_route_select_p0_01.json'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const EXPECTED_CARDS = ['medical', 'pharmacy', 'festivals', 'news', 'onnuri', 'traffic-cctv', 'local', 'jeonbuk-food', 'my-child'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CDN = 'https://cctvsec.ktict.co.kr';
const EX = FIXTURE.route_ids.expressway;
const NA = FIXTURE.route_ids.national;

// ── Pure contract ───────────────────────────────────────────────────────
const sections = await import('../site-consumer-sections.js');
const cctv = await import('../site-life-traffic-cctv.js');
const {SITE_ROUTES} = await import('../site-route.js');
const {TRAFFIC_CCTV_UI_ENABLED} = await import('../site-feature-flags.js');
const CARDS_OFF = ['medical', 'pharmacy', 'festivals', 'news', 'onnuri', 'local', 'jeonbuk-food', 'my-child'];

await check(`switch ${TRAFFIC_CCTV_UI_ENABLED ? 'on' : 'off'}: ${TRAFFIC_CCTV_UI_ENABLED ? '도로 CCTV right after 온누리상품권' : 'no card and no #traffic-cctv route (main\'s eight cards)'}`, () => {
  const ids = sections.LIFE_SHORTCUTS.map(item => item.id);
  if (!TRAFFIC_CCTV_UI_ENABLED) {
    assert.deepEqual(ids, CARDS_OFF);
    assert.equal(SITE_ROUTES.includes('traffic-cctv'), false);
    return;
  }
  assert.deepEqual(ids, EXPECTED_CARDS);
  const card = sections.LIFE_SHORTCUTS.find(item => item.id === 'traffic-cctv');
  assert.equal(card.label, '도로 CCTV', 'one line on a 360 px phone; the screen keeps the full title');
  assert.equal(card.icon, 'cctv');
  for (const key of ['ask', 'prompt', 'choices', 'children']) assert.equal(card[key], undefined, key);
});

await check('the card opens its own routed screen; nothing goes to the conversation; no location, no phone', () => {
  const source = read('site-consumer-sections.js');
  assert.match(source, /\.\.\.\(TRAFFIC_CCTV_UI_ENABLED \? \[\{id: 'traffic-cctv', label: '도로 CCTV', icon: 'cctv'\}\] : \[\]\),/u);
  assert.match(read('site-route.js'), /\.\.\.\(TRAFFIC_CCTV_UI_ENABLED \? \['traffic-cctv'\] : \[\]\),/u);
  assert.match(source, /else if \(item\.id === 'traffic-cctv'\) onTrafficCctv\?\.\(\);/u);
  assert.match(source, /export function mountConsumerSection\(\{[^}]*\bonTrafficCctv,/u);
  const conversation = read('site-conversation.js');
  assert.match(conversation, /onTrafficCctv: \(\) => \{ closeSurface\(\); void openTrafficCctv\(\); \},/u);
  assert.match(conversation, /const openTrafficCctv = async \(\) => \{\n\s+\/\/[^\n]*\n\s+if \(!TRAFFIC_CCTV_UI_ENABLED\) return;/u);
  assert.match(conversation, /workspace: 'life', route: TRAFFIC_CCTV_UI_ENABLED \? 'traffic-cctv' : '', backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\), backRoute: 'life',/u);
  assert.match(conversation, /const \{mountTrafficCctv\} = await import\('\.\/site-life-traffic-cctv\.js\?v=aset-[0-9a-f]{12}'\);/u);
  assert.match(conversation, /\.\.\.\(TRAFFIC_CCTV_UI_ENABLED \? \{'traffic-cctv': \(\) => openTrafficCctv\(\)\} : \{\}\),/u);
  const screen = read('site-life-traffic-cctv.js');
  for (const banned of [/\bonAsk\b/u, /requestAssistant|askWithoutKeyboard/u, /\/v2\/conversation/u, /tel:/u, /전화/u, /innerHTML/u,
    /navigator\.geolocation|getCurrentPosition|watchPosition|site-current-location|isLocationUsageEnabled/u, /localStorage/u,
    /MediaRecorder|captureStream|\.download\s*=|download=/u, /console\.(?:log|info|debug)/u, /document\.cookie\s*=/u, /latitude=|longitude=/u]) {
    assert.doesNotMatch(screen, banned, String(banned));
  }
  assert.match(screen, /\/v2\/life\/traffic-cctv/u);
  assert.match(screen, /readDefaultMapProvider\(documentRef\.cookie \|\| ''\)/u);
  assert.match(screen, /buildDefaultMapHref\(provider, place/u);
});

await check('styles: theme tokens only, linked from index.html and the callback document', () => {
  const css = read('site-life-traffic-cctv.css');
  assert.doesNotMatch(css, /data-site-theme|prefers-color-scheme|#[0-9a-f]{3,6}\b|rgb\(/iu, 'theme tokens only');
  assert.match(read('index.html'), /<link rel="stylesheet" href="site-life-traffic-cctv\.css\?v=aset-[0-9a-f]{12}" \/>/u);
  assert.match(read('auth/callback/index.html'), /<link rel="stylesheet" href="\/site-life-traffic-cctv\.css\?v=aset-[0-9a-f]{12}" \/>/u);
});

await check('hls.js: the sealed vendor file is the documented one and the page pins it with SRI', () => {
  const file = fs.readFileSync(path.join(ROOT, 'vendor/hls.js-1.6.19/hls.light.min.js'));
  const sha256 = crypto.createHash('sha256').update(file).digest('hex');
  const sri = `sha384-${crypto.createHash('sha384').update(file).digest('base64')}`;
  const readme = read('vendor/hls.js-1.6.19/README.md');
  assert.ok(readme.includes(`${sha256}  hls.light.min.js`), 'README sha256');
  assert.ok(readme.includes(sri), 'README SRI');
  assert.equal(cctv.HLS_SCRIPT_INTEGRITY, sri);
  assert.equal(cctv.HLS_SCRIPT_PATH, './vendor/hls.js-1.6.19/hls.light.min.js');
  assert.match(read('vendor/hls.js-1.6.19/LICENSE'), /Apache License/u);
});

await check('Core answers: routes in official order, sections by direction, cameras without URLs', () => {
  const roads = cctv.normalizeRoads(FIXTURE.roads);
  assert.deepEqual(roads.roads.map(item => [item.roadType, item.routeCount, item.cameraCount]), [['expressway', 5, 16], ['national', 6, 12]]);
  const routes = cctv.normalizeRoutes(FIXTURE.routes_expressway);
  assert.deepEqual(routes.routes.map(item => item.name), ['경부선', '남해선', '중부선', '수도권제1순환선', '서울외곽순환선', '노선 미확인 CCTV']);
  const gyeongbu = routes.routes[0];
  assert.deepEqual(gyeongbu.directions.map(item => item.label), ['서울 방향', '부산 방향']);
  assert.equal(routes.routes[1].directions.length, 0, '남해선 is published in parts: no direction');
  const forward = cctv.normalizeSections(FIXTURE.sections[`expressway|${EX['경부선']}|forward`]);
  const reverse = cctv.normalizeSections(FIXTURE.sections[`expressway|${EX['경부선']}|reverse`]);
  assert.equal(forward.sections[0].name, '구서IC');
  assert.equal(reverse.sections[0].name, '양재IC');
  assert.deepEqual(forward.sections.map(s => s.sectionId), reverse.sections.map(s => s.sectionId).reverse());
  assert.equal(forward.unmappedCount, 4);
  for (const body of Object.values(FIXTURE.cameras)) {
    const list = cctv.normalizeCameras(body);
    assert.ok(list, 'camera list normalizes');
    assert.doesNotMatch(JSON.stringify(body), /cctvsec\.ktict\.co\.kr|https?:\/\//u, 'no stream URL in a list');
  }
  const doubled = cctv.normalizeRoutes({...FIXTURE.routes_expressway, routes: [...FIXTURE.routes_expressway.routes, FIXTURE.routes_expressway.routes[0]]});
  assert.equal(doubled.routes.length, 6, 'a route once');
  assert.equal(cctv.normalizeRoutes({status: 'WEIRD'}), null);
});

await check('playback answers: only https on the ITS CDN; anything else is unplayable', () => {
  const playable = Object.values(FIXTURE.playback).map(cctv.normalizePlayback).filter(item => item.status === 'OK');
  assert.ok(playable.length >= 10);
  assert.ok(playable.every(item => item.stream.url.startsWith(`${CDN}/`)));
  const ok = playable[0];
  const forged = cctv.normalizePlayback({...FIXTURE.playback[Object.keys(FIXTURE.playback).find(key => FIXTURE.playback[key].status === 'OK')],
    stream: {kind: 'HLS', url: 'https://evil.example/live.m3u8'}});
  assert.equal(forged.status, 'UNPLAYABLE');
  assert.equal(forged.stream, null);
  assert.ok(ok.notice.includes('저장되지 않으며'));
  for (const [url, allowed] of [[`${CDN}/1/a==`, true], [`${CDN}:443/1`, true], ['http://cctvsec.ktict.co.kr/1', false],
    [`https://user:pw@cctvsec.ktict.co.kr/1`, false], ['https://cctvsec.ktict.co.kr.evil.example/1', false], ['https://127.0.0.1/a.m3u8', false],
    ['javascript:alert(1)', false], [`${CDN}:8443/1`, false]]) {
    assert.equal(cctv.streamUrlAllowed(url), allowed, url);
  }
});

await check('requests: opaque ids only; anything else is refused before it is sent', () => {
  const url = new URL(cctv.trafficCctvUrl('sections', {road_type: 'expressway', route_id: EX['경부선'], direction: 'reverse'}, 'https://api.lotbiai.com'));
  assert.equal(url.pathname, '/v2/life/traffic-cctv/sections');
  assert.deepEqual(Object.fromEntries(url.searchParams), {road_type: 'expressway', route_id: EX['경부선'], direction: 'reverse'});
  for (const bad of [{road_type: 'local'}, {route_id: '../x'}, {section_id: 'x;1'}, {camera_id: 'https://evil.example'}, {latitude: '35.8'}, {url: 'http://169.254.169.254'}]) {
    assert.throws(() => cctv.trafficCctvUrl('cameras', bad), JSON.stringify(bad));
  }
  assert.throws(() => cctv.trafficCctvUrl('stream', {}));
});

await check('player engine: Safari/iOS native HLS, hls.js elsewhere, honest when neither', () => {
  const engine = (kind, extra) => cctv.choosePlaybackEngine(kind, extra);
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: true, userAgent: IPHONE_UA}), 'native');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: false, userAgent: IPHONE_UA}), 'native');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: true, userAgent: MAC_SAFARI_UA}), 'native');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', maxTouchPoints: 5}), 'native', 'iPadOS');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: true, userAgent: ANDROID_UA}), 'hlsjs', 'Android Chrome with MSE');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: true, userAgent: SAMSUNG_UA}), 'hlsjs', 'Samsung Internet with MSE');
  assert.equal(engine('HLS', {nativeHls: false, mediaSource: true, userAgent: DESKTOP_UA}), 'hlsjs');
  assert.equal(engine('HLS', {nativeHls: true, mediaSource: false, userAgent: ANDROID_UA}), 'native', 'no MSE: the browser itself');
  assert.equal(engine('HLS', {nativeHls: false, mediaSource: false, userAgent: ANDROID_UA}), 'none');
  assert.equal(engine('MP4', {userAgent: ANDROID_UA}), 'native');
  assert.equal(engine('STILL', {userAgent: ANDROID_UA}), 'image');
  assert.equal(engine('UNKNOWN', {nativeHls: true, mediaSource: true}), 'none');
});

const PROVIDER_EXPECT = {
  NAVER_MAP: {icon: 'naver-map', android: /^intent:\/\/navigation\?.*package=com\.nhn\.android\.nmap;/u, ios: /\/map-handoff\.html\?provider=NAVER_MAP&/u, desktop: /^https:\/\/map\.naver\.com\/p\/search\//u, desktopIcon: 'naver-map'},
  KAKAO_NAVI: {icon: 'kakao-map', android: /\/kakao-navi\.html\?name=/u, ios: /\/kakao-navi\.html\?name=/u, desktop: /^https:\/\/map\.kakao\.com\/link\/to\//u, desktopIcon: 'kakao-map'},
  TMAP: {icon: 'tmap', android: /^intent:\/\/route\?goalname=.*package=com\.skt\.tmap\.ku;/u, ios: /\/map-handoff\.html\?provider=TMAP&/u, desktop: /^https:\/\/map\.naver\.com\/p\/search\//u, desktopIcon: 'naver-map'},
  GOOGLE_MAPS: {icon: 'google-maps', android: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, ios: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, desktop: /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=3\d\.\d{7}%2C12\d\.\d{7}&travelmode=driving$/u, desktopIcon: 'google-maps'},
};

await check('map app: the icon is the approved image of the app the link really opens; no coordinate, no link', async () => {
  const {JSDOM} = await import('jsdom').catch(() => ({JSDOM: null}));
  const camera = cctv.normalizeCameras(FIXTURE.cameras[`expressway|${EX['경부선']}|${FIXTURE.sections[`expressway|${EX['경부선']}|forward`].sections.find(s => s.name === '양재IC').section_id}|`]).cameras[0];
  assert.equal(camera.latitude, 37.469);
  for (const [provider, expect] of Object.entries(PROVIDER_EXPECT)) {
    assert.equal(cctv.cctvMapIcon(provider, {userAgent: ANDROID_UA}).icon, expect.icon);
    assert.equal(cctv.cctvMapIcon(provider, {userAgent: DESKTOP_UA}).icon, expect.desktopIcon);
  }
  if (JSDOM) {
    const dom = new JSDOM('<!doctype html><p></p>');
    for (const [provider, expect] of Object.entries(PROVIDER_EXPECT)) {
      for (const [platform, ua] of [['android', ANDROID_UA], ['ios', IPHONE_UA], ['desktop', DESKTOP_UA]]) {
        const link = cctv.cctvMapLink(camera, provider, {documentRef: dom.window.document, userAgent: ua, origin: 'https://lotbiai.com'});
        assert.match(link.getAttribute('href'), expect[platform], `${provider} ${platform}`);
        assert.equal(link.dataset.mapIcon, platform === 'desktop' ? expect.desktopIcon : expect.icon);
        assert.equal(link.querySelector('img').getAttribute('src'), `/assets/place-actions/${link.dataset.mapIcon}.png?v=place-icons-20260925`);
      }
    }
    assert.equal(cctv.cctvMapLink({...camera, latitude: null, longitude: null}, 'NAVER_MAP', {documentRef: dom.window.document}), null);
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
  throw new Error('Chrome/Chromium is required for the 실시간 도로 CCTV validation.');
}

function startServer({switchOn = false} = {}) {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      if(${switchOn} && pathname==='/site-feature-flags.js'){fs.readFile(target,'utf8',(error,text)=>{res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});res.end(String(text).replace('export const TRAFFIC_CCTV_UI_ENABLED = false;','export const TRAFFIC_CCTV_UI_ENABLED = true;'));});return;}
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
const isDone = value => value === true || Boolean(value && typeof value === 'object' && value.ok !== false && !value.failure);
async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({failure: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

// Fake Account status + Core (anonymous reader), installed before any page
// script on every document. localStorage.__cctvScenario picks a failure.
const MOCK = `(() => {
  const F = ${JSON.stringify(FIXTURE)};
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const log = window.__cctvLog = {calls: [], chat: [], geo: 0, geoPermission: 0};
  const geo = navigator.geolocation;
  if (geo) {
    for (const name of ['getCurrentPosition', 'watchPosition']) {
      const original = geo[name].bind(geo);
      geo[name] = (...args) => { log.geo += 1; return original(...args); };
    }
  }
  if (navigator.permissions?.query) {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = descriptor => { if (descriptor?.name === 'geolocation') log.geoPermission += 1; return query(descriptor); };
  }
  let preparingSeen = 0;
  const answer = (endpoint, p) => {
    const scenario = read('__cctvScenario') || 'normal';
    if (scenario === 'disabled') return F.disabled_roads;
    if (endpoint === 'routes' && scenario === 'unavailable') return F.unavailable_routes;
    if (endpoint === 'routes' && scenario === 'preparing_then_ok' && preparingSeen++ === 0) return F.preparing_routes;
    if (endpoint === 'roads') return F.roads;
    if (endpoint === 'routes') return p.road_type === 'national' ? F.routes_national : F.routes_expressway;
    if (endpoint === 'sections') return F.sections[[p.road_type, p.route_id, p.direction || ''].join('|')] || {status: 'NOT_FOUND', code: 'CCTV_ROUTE_NOT_FOUND', message: '이 노선의 CCTV를 지금은 찾을 수 없습니다. 노선을 다시 골라 주세요.'};
    if (endpoint === 'cameras') {
      const body = F.cameras[[p.road_type, p.route_id, p.section_id, p.direction || ''].join('|')] || F.cameras[[p.road_type, p.route_id, p.section_id, ''].join('|')];
      if (!body) return {status: 'OK', provider: F.roads.provider, road_type: p.road_type, section: {section_id: p.section_id, name: '', unmapped: false}, cameras: []};
      if (scenario !== 'many_cameras') return body;
      // Five copies of every camera (new ids): a long 구간 미확인 list.
      const many = [];
      body.cameras.forEach((camera, index) => { for (let copy = 0; copy < 5; copy += 1) many.push({...camera, camera_id: (index * 5 + copy).toString(16).padStart(16, 'a'), name: camera.name + ' ' + copy, location: camera.location + ' ' + copy}); });
      return {...body, cameras: many};
    }
    if (endpoint === 'playback') return F.playback[[p.road_type, p.camera_id].join('|')] || {status: 'NOT_FOUND', code: 'CCTV_CAMERA_NOT_FOUND', message: '이 CCTV를 지금은 찾을 수 없습니다.'};
    return {status: 'UNAVAILABLE'};
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
    const match = /^\\/v2\\/life\\/traffic-cctv\\/(roads|routes|sections|cameras|playback)$/u.exec(url.pathname);
    if (match) {
      const params = Object.fromEntries(url.searchParams);
      log.calls.push({endpoint: match[1], params, credentials: init.credentials || '', mode: init.mode || '', method: init.method || 'GET', referrerPolicy: init.referrerPolicy || ''});
      if ((read('__cctvScenario') || '') === 'network_error') throw new TypeError('Failed to fetch');
      return json(answer(match[1], params));
    }
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const OFF_CASES = [
  {label: 'off-samsung-360x780', width: 360, height: 780, mobile: true, userAgent: SAMSUNG_UA, platform: 'android', off: true},
  {label: 'off-desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, platform: 'desktop', off: true},
];
const CASES = [
  {label: 'samsung-360x780', width: 360, height: 780, mobile: true, userAgent: SAMSUNG_UA, full: true, platform: 'android'},
  {label: 'iphone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, platform: 'ios'},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, platform: 'ios', errors: true},
  {label: 'android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, platform: 'android', dark: true, providers: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, platform: 'desktop', dark: true, full: true},
];

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
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

// In the page: what the 실시간 도로 CCTV screen shows and how it is laid out.
const SNAPSHOT = `(() => {
  const surface = document.querySelector('[data-site-route="traffic-cctv"]');
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return 0; const a = lum(parse(getComputedStyle(node).color).slice(0, 3)), b = lum(bgOf(node)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const all = selector => [...(surface?.querySelectorAll(selector) || [])].filter(node => !node.closest('[hidden]'));
  const player = document.querySelector('.cctv-player');
  const video = player?.querySelector('video');
  const image = player?.querySelector('.cctv-player-image');
  const map = player?.querySelector('.cctv-map-link');
  const mapImage = map?.querySelector('img');
  const scope = player || surface;
  const controls = [...(scope?.querySelectorAll('button, a, select, input') || [])].filter(node => node.getClientRects().length && !node.closest('[hidden]') && !node.disabled);
  const small = controls.map(node => ({node, r: node.getBoundingClientRect()})).filter(({r}) => r.height < 43.5 || r.width < 43.5)
    .map(({node, r}) => (node.className || node.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  const playerBox = player?.getBoundingClientRect();
  const script = document.querySelector('script[data-traffic-cctv-hls]');
  return {
    hash: location.hash,
    open: Boolean(surface),
    title: surface?.querySelector('.site-modal-header h2')?.textContent || '',
    back: surface?.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    roads: all('[data-cctv-road]').map(node => ({id: node.dataset.cctvRoad, pressed: node.getAttribute('aria-pressed'), text: node.textContent})),
    routes: all('[data-cctv-route]').map(node => node.querySelector('.cctv-row-title')?.textContent || ''),
    routeMeta: all('[data-cctv-route]').map(node => node.querySelector('.cctv-row-meta')?.textContent || ''),
    searchVisible: all('.cctv-route-search').length === 1,
    routeSummary: surface?.querySelector('[data-cctv-summary="route"]:not([hidden]) .cctv-summary-value')?.textContent || '',
    directions: all('[data-cctv-direction]').map(node => ({id: node.dataset.cctvDirection, label: node.textContent, pressed: node.getAttribute('aria-pressed')})),
    sections: all('[data-cctv-section]').map(node => ({id: node.dataset.cctvSection, title: node.querySelector('.cctv-row-title')?.textContent || '', meta: node.querySelector('.cctv-row-meta')?.textContent || '', empty: node.dataset.cctvEmpty === 'true'})),
    parts: all('.cctv-part').map(node => node.textContent),
    sectionSummary: surface?.querySelector('[data-cctv-summary="section"] .cctv-summary-value')?.textContent || '',
    cameraTitle: surface?.querySelector('.cctv-camera-block:not([hidden]) .cctv-block-title')?.textContent || '',
    cameras: all('[data-cctv-camera]').map(node => ({id: node.dataset.cctvCamera, kind: node.dataset.cctvKind, title: node.querySelector('.cctv-row-title')?.textContent || '',
      badge: node.querySelector('.cctv-badge')?.textContent || '', disabled: node.disabled, reason: node.querySelector('.cctv-unplayable')?.textContent || '',
      play: node.querySelector('.cctv-play-label')?.textContent || '', contrast: contrast(node.querySelector('.cctv-row-title')), right: node.getBoundingClientRect().right})),
    emptyText: surface?.querySelector('.cctv-camera-block:not([hidden]) .cctv-empty:not([hidden])')?.textContent || '',
    cameraFilter: Boolean(surface?.querySelector('.cctv-camera-block:not([hidden]) .cctv-camera-search')),
    filterEmpty: Boolean(surface?.querySelector('.cctv-camera-block:not([hidden]) .cctv-empty:not([hidden])') && surface.querySelector('.cctv-camera-search')),
    notes: all('.cctv-note').map(node => node.textContent),
    status: surface?.querySelector('.cctv-status')?.textContent || '',
    errorText: surface?.querySelector('.cctv-error:not([hidden])')?.textContent || '',
    source: surface?.querySelector('.cctv-source')?.textContent || '',
    urlInDom: (surface?.innerHTML || '').includes('cctvsec.ktict.co.kr') && !player,
    player: player ? {
      title: player.querySelector('.cctv-player-title')?.textContent || '',
      engine: player.dataset.cctvEngine || '', playback: player.dataset.cctvPlayback || '',
      loading: player.querySelector('.cctv-player-loading:not([hidden])')?.textContent || '',
      error: player.querySelector('.cctv-player-error:not([hidden])')?.textContent || '',
      retry: Boolean(player.querySelector('.cctv-player-retry')),
      meta: player.querySelector('.cctv-player-meta')?.textContent || '',
      notice: player.querySelector('.cctv-player-notice')?.textContent || '',
      video: video ? {src: video.getAttribute('src') || '', current: video.currentSrc || '', readyState: video.readyState, time: video.currentTime, paused: video.paused, muted: video.muted, playsInline: video.playsInline, controls: video.controls, w: video.videoWidth} : null,
      image: image ? {src: image.getAttribute('src') || '', loaded: image.complete && image.naturalWidth > 0} : null,
      map: map ? {href: map.getAttribute('href') || '', icon: map.dataset.mapIcon, provider: map.dataset.mapProvider, img: mapImage?.getAttribute('src') || '', loaded: Boolean(mapImage && mapImage.complete && mapImage.naturalWidth > 0), failed: Boolean(mapImage && mapImage.complete && mapImage.naturalWidth === 0), target: map.target, rel: map.rel} : null,
      box: playerBox ? {x: playerBox.x, y: playerBox.y, w: playerBox.width, h: playerBox.height} : null,
      focusInside: player.contains(document.activeElement),
      contrastTitle: contrast(player.querySelector('.cctv-player-title')),
    } : null,
    hlsScript: script ? {src: script.getAttribute('src') || '', integrity: script.integrity, crossOrigin: script.crossOrigin} : null,
    hlsLoaded: typeof window.Hls === 'function',
    history: {length: history.length, state: history.state},
    overflow: Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth),
    small,
    tel: document.querySelectorAll('[data-site-route="traffic-cctv"] a[href^="tel:"], .cctv-player a[href^="tel:"]').length,
    phoneWord: /전화/u.test((surface?.textContent || '') + (player?.textContent || '')),
    log: JSON.parse(JSON.stringify(window.__cctvLog || {})),
    prompt: document.getElementById('lotbi-prompt')?.value || '',
    lifeVisible: Boolean(document.querySelector('[data-site-route="life"] [data-life-shortcut="traffic-cctv"]')),
    homeVisible: !document.querySelector('[data-site-route]'),
    contrastRoute: contrast(surface?.querySelector('[data-cctv-route] .cctv-row-title, [data-cctv-section] .cctv-row-title, [data-cctv-camera] .cctv-row-title')),
    contrastMeta: contrast(surface?.querySelector('.cctv-row-meta')),
  };
})()`;

// A one-and-a-half-second test video recorded in the page itself (a canvas
// with a frame counter): served at the CDN URL, it proves the player really
// plays a stream. MP4 (fragmented H.264) is used for HLS when this browser can
// both record and play it; WebM otherwise (and for the MP4 camera).
const RECORD = mime => `(async () => {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(${JSON.stringify(mime)})) return null;
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
  const g = canvas.getContext('2d');
  const stream = canvas.captureStream(15);
  const recorder = new MediaRecorder(stream, {mimeType: ${JSON.stringify(mime)}, videoBitsPerSecond: 300000});
  const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  let frame = 0;
  const draw = () => { g.fillStyle = frame % 2 ? '#1d3557' : '#457b9d'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#ffffff'; g.font = '28px sans-serif'; g.fillText('TEST ' + frame, 90, 100); frame += 1; };
  draw(); const timer = setInterval(draw, 66);
  recorder.start(250);
  await new Promise(resolve => setTimeout(resolve, 1600));
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.stop(); clearInterval(timer); await stopped;
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
})()`;

function firstBox(buffer, type) {
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const name = buffer.toString('latin1', offset + 4, offset + 8);
    if (name === type) return offset;
    if (size < 8) return -1;
    offset += size;
  }
  return -1;
}

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.TRAFFIC_CCTV_SCREENSHOT_DIR || '';
  const label = testCase.label;
  const cdnLog = [];
  let media = {hls: null, webm: null};
  let nativeHlsOutcome = '';
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
    // The ITS CDN: every request is logged and answered here (the test video,
    // a playlist, a still, or a 404 for a stream that is "down").
    const cdnMode = {hls: 'video'};
    cdp.on(message => {
      if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
      const {requestId, request} = message.params;
      const url = request.url;
      cdnLog.push(url);
      const cors = [{name: 'Access-Control-Allow-Origin', value: '*'}, {name: 'Cache-Control', value: 'no-store'}];
      const fulfill = (status, body, type, extra = []) => page('Fetch.fulfillRequest', {requestId, responseCode: status,
        responseHeaders: [...cors, {name: 'Content-Type', value: type}, ...extra], body: Buffer.from(body).toString('base64')}).catch(() => {});
      if (/-hls==$/u.test(url)) {
        if (cdnMode.hls !== 'video' || !media.hls) { void fulfill(404, 'gone', 'text/plain'); return; }
        const {init, total} = media.hls;
        const playlist = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-TARGETDURATION:2', '#EXT-X-MEDIA-SEQUENCE:0',
          `#EXT-X-MAP:URI="seg.mp4",BYTERANGE="${init}@0"`, '#EXTINF:1.5,', `#EXT-X-BYTERANGE:${total - init}@${init}`, 'seg.mp4', '#EXT-X-ENDLIST', ''].join('\n');
        void fulfill(200, playlist, 'application/vnd.apple.mpegurl');
        return;
      }
      if (/\/seg\.mp4$/u.test(url) && media.hls) {
        const range = /bytes=(\d+)-(\d*)/u.exec(request.headers.Range || request.headers.range || '');
        const bytes = media.hls.bytes;
        if (range) {
          const start = Number(range[1]); const end = range[2] ? Number(range[2]) : bytes.length - 1;
          void fulfill(206, bytes.subarray(start, end + 1), 'video/mp4', [{name: 'Content-Range', value: `bytes ${start}-${end}/${bytes.length}`}, {name: 'Accept-Ranges', value: 'bytes'}]);
        } else void fulfill(200, bytes, 'video/mp4');
        return;
      }
      if (/-mp4==$/u.test(url) && media.webm) { void fulfill(200, media.webm, 'video/webm'); return; }
      if (/-still==$/u.test(url)) { void fulfill(200, fs.readFileSync(path.join(ROOT, 'icon-192.png')), 'image/png'); return; }
      void fulfill(404, 'not here', 'text/plain');
    });
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Fetch.enable', {patterns: [{urlPattern: `${CDN}/*`, requestStage: 'Request'}]});
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: 'light'}]});

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
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(node => node.getClientRects().length && !node.closest('[inert]') && !node.closest('[hidden]'));
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
    const typeText = async (selector, value) => {
      await tapSelector(selector);
      await page('Input.insertText', {text: value});
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
    const screen = (predicate, what) => waitFor(async () => {
      const s = await snapshot();
      return s.open && s.hash === '#traffic-cctv' && predicate(s) ? s : {ok: false, s: {...s, log: undefined}};
    }, `${label}: ${what}`, 20000);
    const setScenario = value => evaluate(`(() => { localStorage.setItem('__cctvScenario', ${JSON.stringify(value)}); return true; })()`);
    const setCookie = (name, value) => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + ${JSON.stringify(value)} + '; path=/; SameSite=Lax'; return true; })()`);
    const clearCookie = name => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + '; path=/; max-age=0'; return true; })()`);
    // A fresh document on /#traffic-cctv (the same URL would only move the fragment).
    const reopenFromUrl = async () => { await navigate('about:blank'); await navigate(`${origin}/#traffic-cctv`); await ready(); };
    const layoutOk = (s, where) => {
      assert.ok(s.overflow <= 0, `${where}: overflow ${s.overflow}`);
      assert.deepEqual(s.small, [], `${where}: controls ≥ 44 px`);
    };

    // 0. The home, then the test videos recorded in this browser.
    await navigate(`${origin}/`);
    await ready();
    await evaluate("(() => { localStorage.removeItem('__cctvScenario'); sessionStorage.clear(); return true; })()");
    if (testCase.off) {
      // The shipped state: switch off (there is no CCTV card to wait for).
      if (testCase.mobile) {
        await tapSelector('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), `${label}: drawer`);
        await sleep(150);
        await tapSelector('#mobile-nav-drawer [data-consumer-section="life"]');
      } else {
        await tapSelector('.chat-sidebar-desktop [data-consumer-section="life"]');
      }
      await waitFor(() => evaluate("location.hash === '#life' && document.querySelectorAll('[data-site-route=\"life\"] .consumer-shortcut').length > 0"), `${label}: 지역정보 (off)`);
      const offGrid = await evaluate(`(() => {
        const grid = document.querySelector('[data-site-route="life"] .consumer-shortcuts');
        const cards = [...grid.querySelectorAll('.consumer-shortcut')];
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        return {ids: cards.map(card => card.dataset.lifeShortcut), columns};
      })()`);
      await check(`${label}: switch off — 지역정보 is main's eight cards, no 도로 CCTV`, () => {
        assert.deepEqual(offGrid.ids, CARDS_OFF);
        if (testCase.mobile) assert.equal(offGrid.columns, 2);
      });
      await navigate('about:blank');
      await navigate(`${origin}/#traffic-cctv`);
      await ready();
      await sleep(1500);
      await evaluate("(() => { window.location.hash = '#traffic-cctv'; window.dispatchEvent(new HashChangeEvent('hashchange')); return true; })()");
      await sleep(1000);
      const off = await snapshot();
      const loaded = await evaluate("performance.getEntriesByType('resource').filter(entry => /site-life-traffic-cctv\\.js|hls\\.light/u.test(entry.name)).map(entry => entry.name.split('/').pop())");
      await check(`${label}: switch off — a URL naming #traffic-cctv opens no screen, loads no CCTV module, makes no CCTV request, no player`, () => {
        assert.equal(off.open, false);
        assert.equal(off.player, null);
        assert.equal(off.hlsScript, null);
        assert.deepEqual(loaded, []);
        assert.deepEqual(off.log.calls ?? [], []);
        assert.equal(off.homeVisible, true, "the home stays on view");
      });
      return {off: true};
    }
    const canMp4 = await evaluate("Boolean(window.MediaRecorder && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') && window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs=\"avc1.42E01E\"'))");
    const webm = await evaluate(RECORD('video/webm;codecs=vp8'));
    media.webm = webm ? Buffer.from(webm, 'base64') : null;
    if (canMp4) {
      const mp4 = await evaluate(RECORD('video/mp4;codecs=avc1'));
      const bytes = mp4 ? Buffer.from(mp4, 'base64') : null;
      const init = bytes ? firstBox(bytes, 'moof') : -1;
      media.hls = bytes && init > 0 ? {bytes, init, total: bytes.length} : null;
    }

    // 1. Home → 지역정보: the card after 온누리상품권 in the approved grid.
    await openLife();
    const grid = await evaluate(`(() => {
      const grid = document.querySelector('[data-site-route="life"] .consumer-shortcuts');
      const cards = [...grid.querySelectorAll('.consumer-shortcut')];
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = new Map();
      for (const card of cards) { const r = card.getBoundingClientRect(); const key = Math.round(r.top); rows.set(key, (rows.get(key) || 0) + (Math.abs(r.width - grid.getBoundingClientRect().width) < 4 ? columns : 1)); }
      return {ids: cards.map(card => card.dataset.lifeShortcut), columns, rows: [...rows.values()],
        heights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
        icon: Boolean(grid.querySelector('[data-life-shortcut="traffic-cctv"] svg path')),
        label: grid.querySelector('[data-life-shortcut="traffic-cctv"] span')?.textContent || ''};
    })()`);
    await check(`${label}: 지역정보 grid — 실시간 도로 CCTV after 온누리상품권, ${testCase.mobile ? 'two columns' : 'the desktop grid'}, every row full`, () => {
      assert.deepEqual(grid.ids, EXPECTED_CARDS);
      if (testCase.mobile) assert.equal(grid.columns, 2, 'phones keep two columns');
      assert.ok(grid.rows.every(count => count === grid.columns), JSON.stringify(grid));
      assert.ok(grid.heights.every(height => height >= 44), JSON.stringify(grid.heights));
      assert.equal(grid.label, '도로 CCTV');
      assert.ok(grid.icon);
    });

    // 2. The card opens the screen: 도로 선택 first, no chat, no location.
    await tapSelector('[data-site-route="life"] [data-life-shortcut="traffic-cctv"]');
    let s = await screen(st => st.roads.length === 2 && /노선 5개/u.test(st.roads[0].text), 'road choice');
    await check(`${label}: tap → /#traffic-cctv, 고속도로·국도 first; no chat, nothing typed, no location`, () => {
      assert.match(s.title, /실시간 도로 CCTV/u);
      assert.equal(s.back, '지역정보로 돌아가기');
      assert.deepEqual(s.roads.map(r => [r.id, r.pressed]), [['expressway', 'false'], ['national', 'false']]);
      assert.match(s.roads[0].text, /^고속도로노선 5개 · CCTV 16대$/u);
      assert.match(s.roads[1].text, /^국도노선 6개 · CCTV 12대$/u);
      assert.equal(s.routes.length, 0);
      assert.deepEqual(s.log.chat, []);
      assert.equal(s.prompt, '');
      assert.equal(s.log.geo, 0, 'no geolocation call');
      assert.equal(s.log.geoPermission, 0, 'no geolocation permission query');
      assert.deepEqual(s.log.calls.map(c => c.endpoint), ['roads']);
      const call = s.log.calls[0];
      assert.equal(call.credentials, 'omit'); assert.equal(call.mode, 'cors'); assert.equal(call.method, 'GET'); assert.equal(call.referrerPolicy, 'no-referrer');
      assert.match(s.status, /고속도로 또는 국도/u);
      layoutOk(s, 'road choice');
    });

    // 3. 고속도로 → 노선 (official order) → search.
    await tapSelector('[data-cctv-road="expressway"]');
    s = await screen(st => st.routes.length === 6, 'route list');
    await check(`${label}: 고속도로 → routes in the official order, 노선 미확인 last`, () => {
      assert.deepEqual(s.routes, ['경부선', '남해선', '중부선', '수도권제1순환선', '서울외곽순환선', '노선 미확인 CCTV']);
      assert.match(s.routeMeta[0], /^제1호 · CCTV 9대 · 재생 가능 7대$/u);
      assert.equal(s.roads[0].pressed, 'true');
      assert.ok(s.searchVisible);
      assert.deepEqual(s.log.calls.at(-1), {endpoint: 'routes', params: {road_type: 'expressway'}, credentials: 'omit', mode: 'cors', method: 'GET', referrerPolicy: 'no-referrer'});
      assert.ok(s.contrastRoute >= 4.5 && s.contrastMeta >= 4.5, JSON.stringify([s.contrastRoute, s.contrastMeta]));
      layoutOk(s, 'route list');
    });
    await typeText('.cctv-route-search', '경부');
    s = await screen(st => st.routes.length === 1, 'route search');
    await check(`${label}: route search narrows the list`, () => assert.deepEqual(s.routes, ['경부선']));

    // 4. 경부선 → 방향 (서울 방향 first) → 구간 in official order.
    await tapSelector(`[data-cctv-route="${EX['경부선']}"]`);
    s = await screen(st => st.sections.length > 50, '경부선 sections');
    await check(`${label}: 경부선 → 서울 방향 / 부산 방향, 구간 from 구서IC, counts and "CCTV 없음"`, () => {
      assert.equal(s.routeSummary, '경부선');
      assert.deepEqual(s.directions.map(d => [d.label, d.pressed]), [['서울 방향', 'true'], ['부산 방향', 'false']]);
      assert.equal(s.sections[0].title, '구서IC');
      const byName = Object.fromEntries(s.sections.map(item => [item.title, item]));
      assert.equal(byName['양재IC'].meta, 'CCTV 1대');
      assert.equal(byName['부산TG'].meta, 'CCTV 없음'); assert.equal(byName['부산TG'].empty, true);
      assert.equal(byName['노포 (IC·JCT)'].meta, 'CCTV 1대');
      assert.equal(s.sections.at(-1).id, 'unmapped');
      assert.equal(s.sections.at(-1).title, '구간 미확인 CCTV');
      assert.match(s.sections.at(-1).meta, /^CCTV 4대/u);
      assert.ok(s.notes.some(note => /촬영 방향 정보가 없습니다/u.test(note)), JSON.stringify(s.notes));
      assert.deepEqual(s.log.calls.at(-1).params, {road_type: 'expressway', route_id: EX['경부선'], direction: 'forward'});
      layoutOk(s, 'section list');
    });
    await tapSelector('[data-cctv-direction="reverse"]');
    s = await screen(st => st.sections[0]?.title === '양재IC', 'reverse order');
    await check(`${label}: 부산 방향 reverses the 구간 order only`, () => {
      assert.deepEqual(s.directions.map(d => d.pressed), ['false', 'true']);
      assert.equal(s.sections.at(-2).title, '구서IC');
      assert.deepEqual(s.log.calls.at(-1).params, {road_type: 'expressway', route_id: EX['경부선'], direction: 'reverse'});
    });

    // 5. 구간 → CCTV list → player.
    await tapSelector('[data-cctv-section]');                    // 양재IC, the first in 부산 방향
    s = await screen(st => st.cameras.length === 1, '양재IC cameras');
    const yangjae = s.cameras[0];
    await check(`${label}: 양재IC → its CCTV, live badge, no URL in the page`, () => {
      assert.equal(s.sectionSummary, '양재IC');
      assert.equal(s.cameraTitle, '양재IC CCTV');
      assert.deepEqual([yangjae.title, yangjae.badge, yangjae.kind, yangjae.disabled, yangjae.play], ['양재', '실시간', 'HLS', false, '영상 보기']);
      assert.equal(s.urlInDom, false);
      assert.ok(yangjae.right <= testCase.width + 0.5);
      layoutOk(s, 'camera list');
    });
    const historyBefore = s.history.length;
    const cdnBefore = cdnLog.length;
    // The engine this browser should get, from what it says it can do.
    const ability = await evaluate(`({nativeHls: Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl')), mediaSource: Boolean(window.MediaSource || window.ManagedMediaSource), maxTouchPoints: navigator.maxTouchPoints || 0})`);
    const expectedEngine = cctv.choosePlaybackEngine('HLS', {...ability, userAgent: testCase.userAgent});
    await tapSelector(`[data-cctv-camera="${yangjae.id}"]`);
    const hlsPlays = Boolean(media.hls);
    s = await waitFor(async () => {
      const st = await snapshot();
      if (!st.player) return {ok: false, st: 'no player'};
      if (st.player.engine === 'hlsjs' && hlsPlays) return st.player.playback === 'playing' && st.player.video?.time > 0 ? st : {ok: false, p: st.player};
      if (st.player.engine === 'native') return (st.player.playback === 'playing' && st.player.video?.time > 0) || st.player.playback === 'failed' ? st : {ok: false, p: st.player};
      return ['playing', 'failed'].includes(st.player.playback) ? st : {ok: false, p: st.player};
    }, `${label}: player`, 30000);
    const viaHlsJs = expectedEngine === 'hlsjs';
    nativeHlsOutcome = viaHlsJs ? '' : s.player.playback;
    await check(`${label}: the player — one history entry, ${viaHlsJs ? (hlsPlays ? 'the HLS test stream plays through hls.js' : 'hls.js loads and asks the CDN') : `the browser's own HLS (${s.player.playback})`}, map app, notice`, () => {
      assert.equal(s.hash, '#traffic-cctv');
      assert.equal(s.history.length, historyBefore + 1, 'one entry for the player');
      assert.equal(typeof s.history.state.lotbiCctvPlayer, 'string');
      assert.equal(s.player.title, '양재');
      assert.equal(s.player.engine, expectedEngine, JSON.stringify(ability));
      if (viaHlsJs) {
        assert.ok(s.hlsLoaded, 'hls.js loaded');
        assert.deepEqual(s.hlsScript, {src: `${origin}/vendor/hls.js-1.6.19/hls.light.min.js`, integrity: cctv.HLS_SCRIPT_INTEGRITY, crossOrigin: 'anonymous'});
      } else {
        assert.equal(s.hlsScript, null, 'native HLS never loads hls.js');
      }
      assert.ok(cdnLog.slice(cdnBefore).some(url => /-hls==$/u.test(url)), 'the playlist was asked for at the CDN');
      assert.ok(s.player.video.muted && s.player.video.playsInline && s.player.video.controls);
      if (!viaHlsJs) {
        assert.ok(['playing', 'failed'].includes(s.player.playback));
        if (s.player.playback === 'failed') assert.match(s.player.error, /영상|재생/u);
      } else if (hlsPlays) {
        assert.equal(s.player.playback, 'playing');
        assert.ok(s.player.video.time > 0 && s.player.video.w === 320, JSON.stringify(s.player.video));
      } else {
        assert.equal(s.player.playback, 'failed');
        assert.match(s.player.error, /영상|재생/u);
      }
      assert.match(s.player.meta, /경부선 · 실시간/u);
      assert.match(s.player.notice, /국가교통정보센터.*저장되지 않으며/u);
      assert.equal(s.player.map.provider, 'NAVER_MAP');
      assert.equal(s.player.map.icon, 'naver-map');
      assert.match(s.player.map.href, PROVIDER_EXPECT.NAVER_MAP[testCase.platform], s.player.map.href);
      assert.equal(s.player.map.target, '_blank'); assert.equal(s.player.map.rel, 'noopener noreferrer');
      assert.ok(s.player.box.x <= 0.5 && s.player.box.y <= 0.5 && s.player.box.w >= testCase.width - 1, JSON.stringify(s.player.box));
      assert.ok(s.player.focusInside, 'focus moves into the player');
      assert.ok(s.player.contrastTitle >= 4.5);
      assert.equal(s.tel, 0); assert.equal(s.phoneWord, false);
      layoutOk(s, 'player');
    });
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(shots, `${label}-player.png`), Buffer.from(data, 'base64'));
    }

    // 6. Back 1: the player closes, the stream is released, the list stays.
    await go(-1);
    s = await screen(st => !st.player && st.cameras.length === 1, 'back to the list');
    const cdnAfterClose = cdnLog.length;
    await sleep(1200);
    const afterQuiet = await snapshot();
    const videosLeft = await evaluate("document.querySelectorAll('video').length");
    await check(`${label}: back 1 — video → CCTV list; the stream stops; 경부선 · 부산 방향 · 양재IC kept`, () => {
      assert.equal(s.hash, '#traffic-cctv');
      assert.equal(s.routeSummary, '경부선');
      assert.equal(s.sectionSummary, '양재IC');
      assert.deepEqual(s.directions.map(d => d.pressed), ['false', 'true']);
      assert.equal(cdnLog.length, cdnAfterClose, 'no CDN request after the player closed');
      assert.equal(afterQuiet.player, null);
      assert.equal(videosLeft, 0, 'no video element left behind');
    });

    // 7. Back 2 → 지역정보, back 3 → home.
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.lifeVisible && st.hash === '#life' ? st : {ok: false, st}; }, `${label}: back 2`);
    await check(`${label}: back 2 — CCTV list → 지역정보`, () => assert.equal(s.open, false));
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.homeVisible && st.hash === '' ? st : {ok: false, st}; }, `${label}: back 3`);
    await check(`${label}: back 3 — 지역정보 → home`, () => assert.equal(s.lifeVisible, false));

    // 8. Re-enter: road, route, direction and 구간 come back.
    await openLife();
    await tapSelector('[data-site-route="life"] [data-life-shortcut="traffic-cctv"]');
    s = await screen(st => st.cameras.length === 1 && st.sectionSummary === '양재IC', 'restored');
    await check(`${label}: re-entering restores 고속도로 · 경부선 · 부산 방향 · 양재IC`, () => {
      assert.equal(s.roads[0].pressed, 'true');
      assert.equal(s.routeSummary, '경부선');
      assert.deepEqual(s.directions.map(d => d.pressed), ['false', 'true']);
      assert.equal(s.cameras[0].title, '양재');
    });

    // 9. The player's own "목록으로" = one back.
    {
      const length = s.history.length;
      await tapSelector(`[data-cctv-camera="${yangjae.id}"]`);
      await waitFor(async () => { const st = await snapshot(); return st.player && st.history.length === length + 1 ? st : {ok: false}; }, `${label}: player again`);
      await tapSelector('.cctv-player-close');
      s = await screen(st => !st.player, 'closed by its button');
      const {currentIndex, entries} = await page('Page.getNavigationHistory');
      await check(`${label}: "목록으로" closes the player through history (no extra entry left)`, () => {
        assert.equal(entries[currentIndex].url.endsWith('#traffic-cctv'), true);
        assert.equal(s.history.state?.lotbiCctvPlayer, undefined);
      });
    }

    if (testCase.full) {
      // 10. A 구간 without CCTV, then 구간 미확인.
      await tapSelector('[data-cctv-change="section"]');
      s = await screen(st => st.sections.length > 50, 'sections again');
      await tapSelector('[data-cctv-section="' + s.sections.find(item => item.title === '부산TG').id + '"]');
      s = await screen(st => st.sectionSummary === '부산TG' && st.emptyText, 'empty section');
      await check(`${label}: a 구간 without CCTV says so`, () => {
        assert.equal(s.cameras.length, 0);
        assert.match(s.emptyText, /이 구간에는 지금 확인되는 공식 CCTV가 없어요/u);
      });
      await tapSelector('[data-cctv-change="section"]');
      await screen(st => st.sections.length > 50, 'sections again');
      await tapSelector('[data-cctv-section="unmapped"]');
      s = await screen(st => st.sectionSummary === '구간 미확인 CCTV' && st.cameras.length === 4, 'unmapped');
      await check(`${label}: 구간 미확인 CCTV come in route order for the chosen direction, said to be an order only`, () => {
        const expected = FIXTURE.cameras[`expressway|${EX['경부선']}|unmapped|reverse`].cameras.map(item => item.location);
        assert.deepEqual(s.cameras.map(item => item.title), expected);
        assert.equal(s.log.calls.at(-1).params.direction, 'reverse');
        assert.ok(s.notes.some(note => /노선을 따라 놓인 순서입니다\(CCTV 좌표 기준\)\. 구간을 정한 것은 아닙니다\./u.test(note)), JSON.stringify(s.notes));
        assert.equal(s.cameraFilter, false, 'a short list has no name filter');
      });
      await check(`${label}: 구간 미확인 CCTV — listed apart; an http or foreign stream says why and opens nothing`, () => {
        const byTitle = Object.fromEntries(s.cameras.map(item => [item.title, item]));
        assert.deepEqual(Object.keys(byTitle).sort(), ['다른 호스트', '달래내2', '동탄 http', '좌표 뒤바뀜'].sort());
        assert.equal(byTitle['동탄 http'].disabled, true);
        assert.match(byTitle['동탄 http'].reason, /보안 연결\(HTTPS\)/u);
        assert.equal(byTitle['다른 호스트'].disabled, true);
        assert.match(byTitle['다른 호스트'].reason, /확인된 영상 제공 주소가 아니어서/u);
        assert.equal(byTitle['달래내2'].disabled, false);
      });
      // A failing stream: the playlist answers 404.
      cdnMode.hls = 'down';
      const dallae = s.cameras.find(item => item.title === '달래내2');
      await tapSelector(`[data-cctv-camera="${dallae.id}"]`);
      s = await waitFor(async () => { const st = await snapshot(); return st.player?.playback === 'failed' ? st : {ok: false, p: st.player}; }, `${label}: failing stream`, 30000);
      await check(`${label}: a stream that does not answer says so and offers 다시 시도`, () => {
        assert.match(s.player.error, /영상/u);
        assert.equal(s.player.retry, true);
      });
      cdnMode.hls = 'video';
      // 좌표 뒤바뀜 has no valid coordinate: the player has no map link.
      await tapSelector('.cctv-player-close');
      await screen(st => !st.player, 'closed');
      const swapped = s.cameras.find(item => item.title === '좌표 뒤바뀜');
      await tapSelector(`[data-cctv-camera="${swapped.id}"]`);
      s = await waitFor(async () => { const st = await snapshot(); return st.player && ['playing', 'failed'].includes(st.player.playback) ? st : {ok: false}; }, `${label}: swapped`, 30000);
      await check(`${label}: a camera without a valid coordinate gets no map link`, () => assert.equal(s.player.map, null));
      await tapSelector('.cctv-player-close');
      await screen(st => !st.player, 'closed');

      // A long list can be narrowed by name.
      await setScenario('many_cameras');
      await tapSelector('[data-cctv-change="section"]');
      await screen(st => st.sections.length > 50, 'sections for the long list');
      await tapSelector('[data-cctv-section="unmapped"]');
      await screen(st => st.cameras.length === 20 && st.cameraFilter, 'long list');
      await typeText('.cctv-camera-search', '달래내');
      s = await screen(st => st.cameras.length === 5, 'filtered');
      await check(`${label}: a long CCTV list has a name filter`, () => {
        assert.ok(s.cameras.every(item => item.title.startsWith('달래내')), JSON.stringify(s.cameras.map(i => i.title)));
      });
      await typeText('.cctv-camera-search', '없는이름');
      s = await screen(st => st.cameras.length === 0, 'filtered to nothing');
      await check(`${label}: the filter says when nothing matches`, () => assert.equal(s.filterEmpty, true));
      await setScenario('normal');

      // 11. A route without official 구간 lists its cameras with a note.
      await tapSelector('[data-cctv-change="route"]');
      await screen(st => st.routes.length >= 6, 'routes again');
      await tapSelector(`[data-cctv-route="${EX['서울외곽순환선']}"]`);
      s = await screen(st => st.routeSummary === '서울외곽순환선' && st.cameras.length === 1, 'route without 구간');
      await check(`${label}: 서울외곽순환선 (not in the official list) — no 구간, its CCTV with a note`, () => {
        assert.equal(s.directions.length, 0);
        assert.equal(s.sections.length, 0);
        assert.ok(s.notes.some(note => /공식 IC·JC 목록과 연결할 수 없는 노선/u.test(note)), JSON.stringify(s.notes));
        assert.equal(s.cameras[0].title, '판교');
      });

      // 12. 국도 → 국도 번호 → 시·군 구간 → CCTV; MP4 really plays; a still shows as 정지영상.
      await tapSelector('[data-cctv-road="national"]');
      s = await screen(st => st.routes.length === 7, 'national routes');
      await check(`${label}: 국도 → routes by 국도 번호 (위임국도·시관내 국도 included), 노선 미확인 last`, () => {
        assert.deepEqual(s.routes, ['국도 1호선', '국도 2호선', '국도 3호선', '국도 7호선', '국도 17호선', '국도 59호선', '노선 미확인 CCTV']);
        assert.equal(s.roads[1].pressed, 'true');
      });
      await tapSelector(`[data-cctv-route="${NA['국도 1호선']}"]`);
      s = await screen(st => st.routeSummary === '국도 1호선' && st.sections.length === 4, '국도 1호선 sections');
      await check(`${label}: 국도 1호선 → 시·군 구간 south to north, 이름에 시·군이 없음 apart`, () => {
        assert.deepEqual(s.directions.map(d => [d.label, d.pressed]), [['북쪽 방향', 'true'], ['남쪽 방향', 'false']]);
        assert.deepEqual(s.sections.map(item => item.title), ['전주', '천안', '파주', '구간 미확인 CCTV']);
        assert.match(s.sections.at(-1).meta, /이름에 시·군이 없음/u);
        assert.ok(s.notes.some(note => /공식 CCTV 이름에 적힌 시·군/u.test(note)), JSON.stringify(s.notes));
        assert.ok(s.sections.every(item => item.id === 'unmapped' || /^g-[a-f0-9]{8}$/u.test(item.id)));
      });
      await tapSelector('[data-cctv-direction="reverse"]');
      s = await screen(st => st.sections[0]?.title === '파주', '국도 1호선 reverse');
      await check(`${label}: 남쪽 방향 reverses the 시·군 order`, () => assert.deepEqual(s.sections.map(item => item.title), ['파주', '천안', '전주', '구간 미확인 CCTV']));
      await tapSelector('[data-cctv-section]');
      s = await screen(st => st.sectionSummary === '파주' && st.cameras.length === 1, '파주');
      await check(`${label}: a 시·군 구간 lists its CCTV`, () => assert.equal(s.cameras[0].title, '파주 테스트1'));
      await tapSelector('[data-cctv-change="route"]');
      await screen(st => st.routes.length === 7, 'national routes again');
      await tapSelector(`[data-cctv-route="${NA['국도 17호선']}"]`);
      await screen(st => st.sections.length === 1, '국도 17호선 sections');
      await tapSelector('[data-cctv-section]');
      s = await screen(st => st.cameras.length === 1, '국도 17호선');
      assert.equal(s.cameras[0].badge, '동영상');
      await tapSelector(`[data-cctv-camera="${s.cameras[0].id}"]`);
      s = await waitFor(async () => { const st = await snapshot(); return st.player?.playback === 'playing' && st.player.video?.time > 0 ? st : {ok: false, p: st.player}; }, `${label}: MP4 plays`, 30000);
      await check(`${label}: a video stream really plays in the player (test video at the CDN URL)`, () => {
        assert.equal(s.player.engine, 'native');
        assert.ok(s.player.video.time > 0 && s.player.video.w === 320, JSON.stringify(s.player.video));
        assert.match(s.player.meta, /국도 17호선 · 동영상/u);
      });
      await go(-1);
      s = await screen(st => !st.player, 'MP4 closed');
      const released = await evaluate("(() => [...document.querySelectorAll('video')].length)()");
      await check(`${label}: closing releases the video element`, () => assert.equal(released, 0));
      await tapSelector('[data-cctv-change="route"]');
      await screen(st => st.routes.length === 7, 'national routes again (unknown)');
      await tapSelector('[data-cctv-route="unknown"]');
      s = await screen(st => st.cameras.length === 2, 'national unknown');
      const still = s.cameras.find(item => item.kind === 'STILL');
      await check(`${label}: 국도 without a road number — listed under 노선 미확인; a still is called 정지영상`, () => {
        assert.equal(still.badge, '정지영상');
        assert.equal(still.play, '정지영상 보기');
      });
      await tapSelector(`[data-cctv-camera="${still.id}"]`);
      s = await waitFor(async () => { const st = await snapshot(); return st.player?.playback === 'playing' ? st : {ok: false, p: st.player}; }, `${label}: still`, 20000);
      await check(`${label}: the still shows as an image, never as live video`, () => {
        assert.equal(s.player.engine, 'image');
        assert.equal(s.player.image.loaded, true);
        assert.equal(s.player.video, null);
        assert.match(s.player.meta, /정지영상/u);
      });
      await go(-1);
      await screen(st => !st.player, 'still closed');
    }

    if (testCase.providers) {
      for (const provider of ['KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS']) {
        await setCookie('lotbi_default_map_provider_v1', provider);
        await reopenFromUrl();
        s = await screen(st => st.cameras.length === 1, `${provider} restored list`);
        await tapSelector(`[data-cctv-camera="${s.cameras[0].id}"]`);
        s = await waitFor(async () => { const st = await snapshot(); return st.player?.map ? st : {ok: false}; }, `${label}: ${provider} player`);
        await waitFor(async () => { const st = await snapshot(); return st.player?.map?.loaded || st.player?.map?.failed ? true : {ok: false}; }, `${label}: ${provider} icon`);
        s = await snapshot();
        await check(`${label}: saved map app ${provider} — its approved icon and its link`, () => {
          assert.equal(s.player.map.provider, provider);
          assert.equal(s.player.map.icon, PROVIDER_EXPECT[provider].icon);
          assert.equal(s.player.map.img, `/assets/place-actions/${PROVIDER_EXPECT[provider].icon}.png?v=place-icons-20260925`);
          assert.equal(s.player.map.loaded, true);
          assert.match(s.player.map.href, PROVIDER_EXPECT[provider][testCase.platform], s.player.map.href);
        });
        await tapSelector('.cctv-player-close');
        await screen(st => !st.player, 'closed');
      }
      await clearCookie('lotbi_default_map_provider_v1');
    }

    if (testCase.dark) {
      await evaluate("(() => { document.body.dataset.siteTheme = 'dark'; document.documentElement.dataset.siteTheme = 'dark'; return true; })()");
      await tapSelector('[data-cctv-change="route"]');
      s = await screen(st => st.routes.length >= 4, 'dark routes');
      await check(`${label}: dark theme readable (routes)`, () => assert.ok(s.contrastRoute >= 4.5 && s.contrastMeta >= 4.5, JSON.stringify([s.contrastRoute, s.contrastMeta])));
      if (shots) {
        const {data} = await page('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(shots, `${label}-dark.png`), Buffer.from(data, 'base64'));
      }
      await evaluate("(() => { document.body.dataset.siteTheme = 'light'; document.documentElement.dataset.siteTheme = 'light'; return true; })()");
    }

    if (testCase.errors) {
      const reopen = async scenario => {
        await evaluate("(() => { sessionStorage.clear(); return true; })()");
        await setScenario(scenario);
        await reopenFromUrl();
      };
      await reopen('unavailable');
      await screen(st => st.roads.length === 2 && /노선/u.test(st.roads[0].text), 'roads (unavailable)');
      await tapSelector('[data-cctv-road="expressway"]');
      s = await screen(st => st.errorText, 'provider down');
      await check(`${label}: provider down — says so, offers 다시 시도, shows no list`, () => {
        assert.match(s.errorText, /제공기관 인증 문제로 지금은 CCTV를 불러올 수 없습니다\.다시 시도/u);
        assert.equal(s.routes.length, 0);
      });
      await reopen('preparing_then_ok');
      await screen(st => st.roads.length === 2 && /노선/u.test(st.roads[0].text), 'roads (preparing)');
      await tapSelector('[data-cctv-road="expressway"]');
      s = await screen(st => st.routes.length === 6, 'preparing then routes');
      await check(`${label}: preparing — asks again by itself, then lists`, () => {
        assert.equal(s.log.calls.filter(c => c.endpoint === 'routes').length, 2);
      });
      await reopen('disabled');
      s = await screen(st => /준비/u.test(st.status), 'disabled');
      await check(`${label}: disabled — says it is being prepared, nothing else`, () => {
        assert.match(s.status, /실시간 도로 CCTV를 준비하고 있습니다/u);
        assert.equal(s.routes.length, 0);
        assert.equal(s.roads.every(r => !/노선/u.test(r.text)), true);
      });
      await reopen('network_error');
      s = await screen(st => st.errorText, 'network');
      await check(`${label}: network error — says so and offers 다시 시도`, () => assert.match(s.errorText, /인터넷 연결을 확인하고 다시 시도해 주세요\.다시 시도/u));
      await evaluate("(() => { localStorage.removeItem('__cctvScenario'); return true; })()");
    }

    const final = await snapshot();
    await check(`${label}: no location, no chat in the whole run; no page errors`, () => {
      assert.equal(final.log.geo ?? 0, 0);
      assert.equal(final.log.geoPermission ?? 0, 0);
      assert.deepEqual(final.log.chat ?? [], []);
      assert.deepEqual(errors, []);
    });
    return {hlsPlays: Boolean(media.hls), webm: Boolean(media.webm), nativeHlsOutcome};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.traffic-cctv-'));
const server = startServer();
const serverOn = startServer({switchOn: true});
const summary = [];
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  const originOn = `http://127.0.0.1:${await serverPort(serverOn)}`;
  const only = process.env.TRAFFIC_CCTV_CASE || '';
  for (const testCase of (TRAFFIC_CCTV_UI_ENABLED ? [] : OFF_CASES).filter(item => !only || item.label === only)) {
    await runCase(browser, origin, dir, testCase);
    summary.push(`${testCase.label}: switch off as shipped — nothing reachable`);
  }
  for (const testCase of CASES.filter(item => !only || item.label === only)) {
    const outcome = await runCase(browser, originOn, dir, testCase);
    summary.push(`${testCase.label}: HLS ${outcome.nativeHlsOutcome ? `through this browser's own HLS player under the ${testCase.platform} user agent: ${outcome.nativeHlsOutcome}` : outcome.hlsPlays ? 'played (fMP4 test stream via hls.js)' : 'load path only (this browser cannot record/play H.264)'}`);
  }
} finally {
  server.kill('SIGTERM');
  serverOn.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}
for (const line of summary) console.log(`note - ${line}`);
console.log(`TRAFFIC-CCTV-ROUTE-SELECT-P0-01 PASS — ${passed} checks (viewport emulation in headless Chromium; not a device run)`);
