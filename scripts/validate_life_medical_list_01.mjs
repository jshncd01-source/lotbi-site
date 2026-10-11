// LIFE-MEDICAL-MERGE-01 — 지역정보 '병원·응급실·약국': 한 카드, 같은 화면의 가까운 곳 목록.
//
// Contract checked here:
// * 지역정보 has ONE medical card named 병원·응급실·약국 (no 약국 card) and, with the
//   unfinished 지역생활정보 card hidden (QA_화면전수_01 H3), eight cards in all —
//   four full rows of two, no card spans; it opens its own screen
//   (/#life-medical) — never the conversation: no chat request, nothing typed
//   into the composer, no AI
// * the screen reads only Core's public GET /v2/life/medical/nearby (credentials
//   omit): three choices 병원·의원 / 응급실 / 약국, the nearest five first,
//   더 보기 shows five more from the same read (no new request), one line on
//   why the list is in this order, the registered 진료·운영 lines, a verified
//   phone and the reader's map app
// * location (USER_FIRST_STANDARD #2): setting on + allowed → the list at once;
//   otherwise a remembered region at once, else [위치 허용하고 찾기] / [지역 고르기];
//   a picked region is remembered; opening or reloading never asks the browser
// * empty, provider down, off, rate limit, network error and a malformed
//   answer each say what happened and leave a next tap; an emergency room list
//   always carries 119
// * system back and the screen's ← land on 지역정보, a second back on the home
// * 360/375/390/412 phones and 1280 desktop, light and dark: no horizontal
//   overflow, every control ≥ 48 px, readable text (viewport emulation, not a
//   device run; real map apps are not opened here)
//
// Core answers come from scripts/fixtures/life_medical_nearby_01.json, produced
// by lotbi-core app/life_medical_api.nearby() itself on invented (가상) facilities.
//
// LIFE_MEDICAL_SCREENSHOT_DIR=<dir> writes the scenario screenshots;
// LIFE_MEDICAL_SCENARIO_OUT=<file> writes the tap counts of each user scenario.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/life_medical_nearby_01.json'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const {LIFE_LOCAL_CARD_ENABLED: LOCAL_ON} = await import('../site-feature-flags.js');
// 지역생활정보 is hidden until its result shows inside the screen (QA_화면전수_01 H3).
const EXPECTED_CARDS = ['medical', 'ev-chargers', 'festivals', 'news', 'subway', 'onnuri', 'real-estate', ...(LOCAL_ON ? ['local'] : []), 'my-child'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const names = key => FIXTURE[key].place_result.results.map(row => row.name);

// ── Pure contract ───────────────────────────────────────────────────────
const sections = await import('../site-consumer-sections.js');
const list = await import('../site-life-medical-list.js');
const navigation = await import('../site-navigation.js');
const {SITE_ROUTES} = await import('../site-route.js');

await check('지역정보: one 병원·응급실·약국 card (no 약국 card), 지역생활정보 hidden, the others and their order kept', () => {
  assert.equal(LOCAL_ON, false, 'the shipped switch hides the unfinished 지역생활정보 card');
  assert.equal(sections.LIFE_SHORTCUTS.some(item => item.id === 'local'), false);
  assert.deepEqual(sections.LIFE_SHORTCUTS.map(item => item.id), EXPECTED_CARDS);
  assert.equal(EXPECTED_CARDS.length, 8, 'eight cards: four rows of two');
  const card = sections.LIFE_SHORTCUTS[0];
  assert.equal(card.label, '병원·응급실·약국');
  assert.equal(card.icon, 'hospital');
  assert.equal(card.choices, undefined, 'no two-way choice in front of the screen');
  assert.equal(card.ask, undefined, 'the card never asks the conversation');
  assert.equal(sections.LIFE_SHORTCUTS.some(item => item.id === 'pharmacy' || item.label === '약국'), false);
  assert.equal(sections.LIFE_MEDICAL_QUESTIONS, undefined, 'the fixed chat questions are gone');
  assert.equal(sections.LIFE_MEDICAL_CHOICES, undefined);
  assert.ok(SITE_ROUTES.includes('life-medical'));
  assert.equal(sections.LIFE_VIEW_PARENT['life-medical'], 'life');
  assert.equal(sections.lifeBackLabel('life-medical'), '지역정보로 돌아가기');
});

await check('Core request: kind, 3-decimal position, region label, limit 15, nothing else', () => {
  const url = new URL(list.medicalNearbyUrl({kind: 'pharmacy', latitude: 37.4981234, longitude: 127.0287654}, 'https://core.example'));
  assert.equal(url.origin + url.pathname, 'https://core.example/v2/life/medical/nearby');
  assert.deepEqual(Object.fromEntries(url.searchParams), {kind: 'pharmacy', latitude: '37.498', longitude: '127.029', limit: '15'});
  const region = new URL(list.medicalNearbyUrl({kind: 'hospital', latitude: 37.498, longitude: 127.028, source: 'SAVED_REGION', label: '강남구'}, 'https://core.example'));
  assert.deepEqual(Object.fromEntries(region.searchParams), {kind: 'hospital', latitude: '37.498', longitude: '127.028', source: 'SAVED_REGION', label: '강남구', limit: '15'});
  assert.throws(() => list.medicalNearbyUrl({kind: 'dentist', latitude: 37.5, longitude: 127}), TypeError);
  assert.throws(() => list.medicalNearbyUrl({kind: 'pharmacy', latitude: 50, longitude: 127}), TypeError);
  assert.throws(() => list.medicalNearbyUrl({kind: 'pharmacy', latitude: 37.5, longitude: 127, source: 'SAVED_REGION'}), TypeError, 'a region needs its name');
  assert.equal(new URL(list.medicalNearbyUrl({kind: 'pharmacy', latitude: 37.5, longitude: 127, limit: 99})).searchParams.get('limit'), '15');
});

await check('Core answer is read as the place cards read it, five at a time from one read', () => {
  const twelve = list.normalizeMedicalNearby(FIXTURE.hospital_12);
  assert.equal(twelve.status, 'OK');
  assert.equal(twelve.places.length, 12);
  assert.deepEqual(twelve.places.map(place => place.name), names('hospital_12'));
  assert.equal(twelve.places[0].medicalStatus.openState, 'OPEN');
  assert.equal(twelve.basisLabel, '현재 위치(서울특별시 강남구)');
  assert.match(twelve.sortBasis, /^가까운 순이에요\. 2km 안에서 등록된 운영시간상 지금 문을 연 곳을 먼저/u);
  assert.equal(list.normalizeMedicalNearby(FIXTURE.pharmacy_partial).partial, true);
  assert.equal(list.normalizeMedicalNearby(FIXTURE.pharmacy_8).partial, false);
  const emergency = list.normalizeMedicalNearby(FIXTURE.emergency_4);
  assert.match(emergency.emergencyNotice, /119/u);
  for (const key of ['pharmacy_empty', 'hospital_unavailable', 'disabled_hospital', 'needs_location']) {
    const answer = list.normalizeMedicalNearby(FIXTURE[key]);
    assert.ok(answer && answer.places.length === 0, key);
  }
  assert.equal(list.normalizeMedicalNearby({...FIXTURE.hospital_12, contract_id: 'x'}), null);
  assert.equal(list.normalizeMedicalNearby({...FIXTURE.hospital_12, status: 'WEIRD'}), null);
  assert.equal(list.normalizeMedicalNearby({...FIXTURE.hospital_12, kind: 'dentist'}), null);
  assert.equal(list.normalizeMedicalNearby(null), null);
  // The conversation rail still keeps five (its own contract).
  assert.equal(navigation.normalizePlaceResult(FIXTURE.hospital_12.place_result).results.length, 5);
  assert.equal(navigation.normalizePlaceResult(FIXTURE.hospital_12.place_result, {limit: 15}).results.length, 12);
});

await check('source contract: no chat, no own location read, no storage but the two keys, theme tokens only', () => {
  const module = read('site-life-medical-list.js');
  assert.doesNotMatch(module, /onAsk|innerHTML|document\.write|\beval\(|geolocation|getCurrentPosition/u);
  assert.deepEqual([...new Set([...module.matchAll(/https?:\/\/[^\s'"`)]+/gu)].map(match => match[0]))], ['https://account.lotbiai.com/account#privacy']);
  assert.equal(list.MEDICAL_KIND_STORAGE_KEY, 'lotbi.life.medical-kind.v1');
  assert.equal(list.MEDICAL_REGION_STORAGE_KEY, 'lotbi.life.medical-region.v1');
  const sectionsSource = read('site-consumer-sections.js');
  assert.match(sectionsSource, /else if \(item\.id === 'medical'\) openMedical\(item\);/u);
  assert.doesNotMatch(sectionsSource, /LIFE_MEDICAL_QUESTIONS|data-medical-choice|medicalChoice/u);
  const css = read('site-life-medical-list.css');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/iu, 'theme tokens only');
  for (const page of ['index.html', 'auth/callback/index.html']) assert.match(read(page), /site-life-medical-list\.css\?v=aset-[0-9a-f]{12}/u, page);
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
  throw new Error('Chrome/Chromium is required for the 병원·응급실·약국 validation.');
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
// script on every document. localStorage.__medScenario picks a Core answer.
const MOCK = `(() => {
  const F = ${JSON.stringify(FIXTURE)};
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { window.localStorage.setItem(key, value); } catch {} };
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const log = window.__medLog = {nearby: [], chat: [], regions: 0, geo: 0};
  const geo = navigator.geolocation;
  if (geo) {
    const current = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (...args) => { log.geo += 1; return current(...args); };
    const watch = geo.watchPosition.bind(geo);
    geo.watchPosition = (...args) => { log.geo += 1; return watch(...args); };
  }
  // A verified photo (Google Places evidence) loads from a host this run cannot reach, so the
  // image source setter answers load / error itself (the way the chat card validator does).
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const mockImageSrc = new WeakMap();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return mockImageSrc.get(this) || nativeImageSrc?.get?.call(this) || ''; },
    set(value) {
      const next = String(value);
      if (next.startsWith('https://lh3.googleusercontent.com/')) {
        mockImageSrc.set(this, next);
        setTimeout(() => this.dispatchEvent(new Event(next.includes('/broken-') ? 'error' : 'load')), 60);
        return;
      }
      nativeImageSrc?.set?.call(this, next);
    },
  });
  const EVIDENCE = {provider: 'GOOGLE_PLACES', provider_place_id: 'google:lotbi-medical-list', match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
    fetched_at: '2026-10-07T08:30:00Z', verification_state: 'VERIFIED', attributions: [{display_name: 'Google Places contributor'}]};
  const withPhotos = body => ({...body, place_result: {...body.place_result, results: body.place_result.results.map((row, index) => (
    index === 1 ? {...row, image_url: 'https://lh3.googleusercontent.com/lotbi-medical-list-photo.jpg', photo_evidence: EVIDENCE}
      : index === 2 ? {...row, image_url: 'https://lh3.googleusercontent.com/broken-lotbi-medical-list.jpg', photo_evidence: EVIDENCE}
        : index === 3 ? {...row, image_url: 'https://example.com/not-verified.jpg'} : row))}});
  const BASE = {hospital: 'hospital_12', pharmacy: 'pharmacy_8', emergency: 'emergency_4'};
  const pick = params => {
    const scenario = read('__medScenario') || 'normal';
    const kind = params.kind;
    const region = params.source === 'SAVED_REGION';
    if (scenario === 'photo') return withPhotos(F[BASE[kind] + (region ? '_region' : '')]);
    if (scenario === 'partial') return F.pharmacy_partial;
    if (scenario === 'none_open') return F.pharmacy_none_open;
    if (scenario === 'empty') return F[kind + '_empty'];
    if (scenario === 'unavailable') return F[kind + '_unavailable'];
    if (scenario === 'disabled') return kind === 'emergency' ? F.disabled_emergency : {...F.disabled_hospital, kind};
    if (scenario === 'needs_location') return {...F.needs_location, kind};
    if (scenario === 'bad_shape') return {contract_id: 'something-else'};
    return F[BASE[kind] + (region ? '_region' : '')];
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
      if (read('__medRegions') === 'down') return json({}, 503);
      return json({items: [
        {code: 'KR_GANGNAM', label: '강남구', province: '서울특별시', latitude: 37.498, longitude: 127.028},
        {code: 'KR_JEONJU', label: '전주시', province: '전북특별자치도', latitude: 35.8242, longitude: 127.148},
      ], provinces: ['서울특별시', '전북특별자치도'], ai_calls: 0});
    }
    if (url.pathname === '/v2/life/medical/nearby') {
      const params = Object.fromEntries(url.searchParams);
      log.nearby.push({params, credentials: init.credentials || '', mode: init.mode || '', method: init.method || 'GET', referrerPolicy: init.referrerPolicy || ''});
      const scenario = read('__medScenario') || 'normal';
      if (scenario === 'network_error') throw new TypeError('Failed to fetch');
      if (scenario === 'rate_limited') return json({detail: {code: 'LIFE_MEDICAL_RATE_LIMITED'}}, 429);
      if (scenario === 'fail_once') { write('__medScenario', 'normal'); return json({}, 503); }
      return json(pick(params));
    }
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const CASES = [
  {label: 'android-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA, full: true, shots: true},
  {label: 'iphone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, messages: true, providers: 'ios', dark: true, shots: true},
  {label: 'android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, providers: 'android'},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, full: true, providers: 'desktop', dark: true, shots: true},
];

const PROVIDER_EXPECT = {
  NAVER_MAP: {icon: 'naver-map', desktopIcon: 'naver-map'},
  KAKAO_NAVI: {icon: 'kakao-map', desktopIcon: 'kakao-map'},
  TMAP: {icon: 'tmap', desktopIcon: 'naver-map'},
  GOOGLE_MAPS: {icon: 'google-maps', desktopIcon: 'google-maps'},
};

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

// In the page: what the 병원·응급실·약국 screen shows and how it is laid out.
const SNAPSHOT = `(() => {
  const surface = document.querySelector('[data-site-route="life-medical"]');
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return 0; const a = lum(parse(getComputedStyle(node).color).slice(0, 3)), b = lum(bgOf(node)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const visible = node => Boolean(node && node.getClientRects().length && !node.hidden);
  const items = [...(surface?.querySelectorAll('.medical-place') || [])].map(item => {
    const phone = item.querySelector('[data-medical-action="phone"]');
    const map = item.querySelector('[data-medical-action="map"]');
    const mapImage = map?.querySelector('img');
    const rect = item.getBoundingClientRect();
    return {
      id: item.dataset.medicalPlace,
      photo: Boolean(item.querySelector('.medical-place-media')),
      photoSrc: item.querySelector('.medical-place-photo')?.src || '',
      photoAlt: item.querySelector('.medical-place-photo')?.alt || '',
      name: item.querySelector('.medical-place-name')?.textContent || '',
      searchHref: item.querySelector('.medical-place-link')?.getAttribute('href') || '',
      distance: item.querySelector('.medical-place-distance')?.textContent || '',
      category: item.querySelector('.medical-place-category')?.textContent || '',
      address: item.querySelector('.medical-place-address')?.textContent || '',
      lines: [...item.querySelectorAll('.medical-place-lines p')].map(node => ({state: node.dataset.medicalState, text: node.textContent})),
      phone: phone?.getAttribute('href') || '',
      phoneLabel: phone?.getAttribute('aria-label') || '',
      phoneBox: phone ? {w: phone.getBoundingClientRect().width, h: phone.getBoundingClientRect().height} : null,
      mapHref: map?.getAttribute('href') || '',
      mapProvider: map?.dataset.mapProvider || '',
      mapIcon: map?.dataset.mapIcon || '',
      mapImg: mapImage?.getAttribute('src') || '',
      mapLoaded: Boolean(mapImage && mapImage.complete && mapImage.naturalWidth > 0),
      mapFailed: Boolean(mapImage && mapImage.complete && mapImage.naturalWidth === 0),
      mapAria: map?.getAttribute('aria-label') || '',
      mapTarget: map?.target || '',
      mapRel: map?.rel || '',
      mapBox: map ? {w: map.getBoundingClientRect().width, h: map.getBoundingClientRect().height} : null,
      right: rect.right, width: rect.width,
      contrastName: contrast(item.querySelector('.medical-place-name a')),
      contrastState: contrast(item.querySelector('.medical-place-state')),
      contrastSecondary: contrast(item.querySelector('.medical-place-address')),
    };
  });
  const own = surface?.querySelector('.medical-surface');
  const closeButton = surface?.querySelector('.site-modal-close');
  const controls = [...(own?.querySelectorAll('button, a, select') || [])].filter(visible);
  const small = controls.map(node => ({node, r: node.getBoundingClientRect()})).filter(({r}) => r.height < 47.5)
    .map(({node, r}) => (node.className || node.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  const kinds = [...(surface?.querySelectorAll('[data-medical-kind]') || [])].map(node => ({kind: node.dataset.medicalKind, text: node.textContent, pressed: node.getAttribute('aria-pressed') === 'true'}));
  const errorBox = surface?.querySelector('.medical-error:not([hidden])');
  const emergencyBox = surface?.querySelector('.medical-emergency:not([hidden])');
  const more = surface?.querySelector('.medical-more:not([hidden])');
  const locate = surface?.querySelector('[data-medical-locate]');
  const toggle = surface?.querySelector('[data-medical-region-toggle]');
  return {
    hash: location.hash,
    open: Boolean(surface),
    title: surface?.querySelector('.site-modal-header h2, .site-modal h2, h2')?.textContent || '',
    back: surface?.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    heading: surface?.querySelector('.medical-title')?.textContent || '',
    kinds,
    basis: visible(surface?.querySelector('.medical-basis')) ? surface.querySelector('.medical-basis').textContent : '',
    status: surface?.querySelector('.medical-status')?.textContent || '',
    statusRole: surface?.querySelector('.medical-status')?.getAttribute('role') || '',
    notice: surface?.querySelector('.medical-notice:not([hidden])')?.textContent || '',
    errorText: errorBox?.querySelector('.medical-error-text')?.textContent || '',
    errorButtons: errorBox ? [...errorBox.querySelectorAll('button, a')].map(node => node.textContent) : [],
    errorTel: errorBox ? [...errorBox.querySelectorAll('a[href^="tel:"]')].map(node => node.getAttribute('href')) : [],
    emergency: Boolean(emergencyBox),
    emergencyText: emergencyBox?.querySelector('.medical-emergency-text')?.textContent || '',
    emergencyTel: emergencyBox?.querySelector('a[href^="tel:"]')?.getAttribute('href') || '',
    emergencyCallBox: emergencyBox?.querySelector('a[href^="tel:"]') ? (r => ({w: r.width, h: r.height}))(emergencyBox.querySelector('a[href^="tel:"]').getBoundingClientRect()) : null,
    locate: locate?.textContent || '',
    locateDisabled: Boolean(locate?.disabled),
    locateSecondary: Boolean(locate?.classList.contains('consumer-action-secondary')),
    toggle: toggle?.textContent || '',
    togglePressed: toggle?.getAttribute('aria-pressed') === 'true',
    locationNote: surface?.querySelector('.medical-location-note')?.textContent || '',
    settingsLink: surface?.querySelector('.medical-location-note a')?.getAttribute('href') || '',
    regionVisible: visible(surface?.querySelector('.medical-region-row')),
    provinces: [...(surface?.querySelectorAll('[data-medical-region="province"] option') || [])].map(node => node.textContent),
    more: more ? more.textContent : '',
    source: surface?.querySelector('.medical-source')?.textContent || '',
    items,
    listLabel: surface?.querySelector('.medical-results')?.tagName || '',
    overflow: Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth),
    small,
    closeBox: closeButton ? (r => ({w: Math.round(r.width), h: Math.round(r.height)}))(closeButton.getBoundingClientRect()) : null,
    log: JSON.parse(JSON.stringify(window.__medLog || {})),
    prompt: document.getElementById('lotbi-prompt')?.value || '',
    lifeVisible: Boolean(document.querySelector('[data-site-route="life"] [data-life-shortcut="medical"]')),
    homeVisible: !document.querySelector('[data-site-route]'),
    storage: {kind: localStorage.getItem('lotbi.life.medical-kind.v1'), region: localStorage.getItem('lotbi.life.medical-region.v1')},
  };
})()`;

const SCENARIOS = [];
let shotsDir = process.env.LIFE_MEDICAL_SCREENSHOT_DIR || '';

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
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
    await page('Emulation.setGeolocationOverride', {latitude: 37.498, longitude: 127.028, accuracy: 20});
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
    let taps = 0;
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
      taps += 1;
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
    // A <select> is two real interactions on a phone (open, choose); count both.
    const choose = async (selector, value) => {
      await tapSelector(selector);
      taps += 1;
      await evaluate(`(() => { const s = document.querySelector(${JSON.stringify(selector)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
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
    // A list is settled once every map icon has finished loading.
    const listed = (count, extra = () => true) => waitFor(async () => {
      const s = await snapshot();
      const images = s.items.every(item => item.mapLoaded || item.mapFailed);
      return s.open && s.hash === '#life-medical' && s.items.length === count && !/찾는 중/u.test(s.status) && images && extra(s) ? s : {ok: false, s: {...s, items: s.items.map(i => i.name)}};
    }, `${label}: ${count} places`);
    const settledScreen = (predicate, what = 'screen state') => waitFor(async () => { const s = await snapshot(); return s.open && predicate(s) ? s : {ok: false, s: {...s, items: s.items.length}}; }, `${label}: ${what}`, 20000);
    const setScenario = value => evaluate(`(() => { localStorage.setItem('__medScenario', ${JSON.stringify(value)}); return true; })()`);
    const setCookie = (name, value) => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + ${JSON.stringify(value)} + '; path=/; SameSite=Lax'; return true; })()`);
    const clearCookie = name => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + '; path=/; max-age=0'; return true; })()`);
    const clearMemory = () => evaluate("(() => { localStorage.removeItem('lotbi.life.medical-kind.v1'); localStorage.removeItem('lotbi.life.medical-region.v1'); localStorage.removeItem('lotbi.calendar.weather-region.v1'); return true; })()");
    const reopenFromUrl = async () => { await navigate('about:blank'); await navigate(`${origin}/#life-medical`); await ready(); };
    const shot = async name => {
      if (!shotsDir || !testCase.shots) return;
      fs.mkdirSync(shotsDir, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
      fs.writeFileSync(path.join(shotsDir, `${label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const record = (name, tapCount, outcome, extra = {}) => { SCENARIOS.push({case: label, name, taps: tapCount, outcome, ...extra}); };
    const lastCall = st => st.log.nearby.at(-1).params;

    // 1. Home → 지역정보: nine cards in the approved grid, one 병원·응급실·약국.
    await navigate(`${origin}/`);
    await ready();
    await clearMemory();
    await openLife();
    const grid = await evaluate(`(() => {
      const grid = document.querySelector('[data-site-route="life"] .consumer-shortcuts');
      const cards = [...grid.querySelectorAll('.consumer-shortcut')];
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = new Map();
      for (const card of cards) { const r = card.getBoundingClientRect(); const key = Math.round(r.top); rows.set(key, (rows.get(key) || 0) + (Math.abs(r.width - grid.getBoundingClientRect().width) < 4 ? columns : 1)); }
      return {ids: cards.map(card => card.dataset.lifeShortcut), columns, rows: [...rows.values()],
        heights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
        label: grid.querySelector('[data-life-shortcut="medical"] span')?.textContent || '',
        icon: Boolean(grid.querySelector('[data-life-shortcut="medical"] svg path')),
        pharmacy: Boolean(grid.querySelector('[data-life-shortcut="pharmacy"]'))};
    })()`);
    await check(`${label}: 지역정보 grid — one 병원·응급실·약국 card, 8 cards in ${testCase.mobile ? 'two columns' : 'the desktop grid'}, four full rows, cards ≥ 48 px`, () => {
      assert.deepEqual(grid.ids, EXPECTED_CARDS);
      assert.equal(grid.rows.length, 4, JSON.stringify(grid));
      assert.equal(grid.label, '병원·응급실·약국');
      assert.equal(grid.pharmacy, false);
      assert.ok(grid.icon);
      if (testCase.mobile) assert.equal(grid.columns, 2, 'phones keep two columns');
      assert.ok(grid.rows.every(count => count === grid.columns), JSON.stringify(grid));
      assert.ok(grid.heights.every(height => height >= 48), JSON.stringify(grid.heights));
    });

    // 2. The card opens the list at once: location allowed, no chat, no AI.
    taps = 0;
    await tapSelector('[data-site-route="life"] [data-life-shortcut="medical"]');
    let s = await listed(5);
    const hospitalTaps = taps;
    await check(`${label}: tap → /#life-medical lists the five nearest 병원·의원 from the current position; no chat, nothing typed`, () => {
      assert.equal(s.hash, '#life-medical');
      assert.equal(s.heading, '병원·응급실·약국');
      assert.equal(s.back, '지역정보로 돌아가기');
      assert.deepEqual(s.kinds, [{kind: 'hospital', text: '병원·의원', pressed: true}, {kind: 'emergency', text: '응급실', pressed: false}, {kind: 'pharmacy', text: '약국', pressed: false}]);
      assert.deepEqual(s.log.chat, [], 'no conversation request');
      assert.equal(s.prompt, '', 'nothing typed into the composer');
      assert.equal(s.log.nearby.length, 1);
      const call = s.log.nearby[0];
      assert.deepEqual(call.params, {kind: 'hospital', latitude: '37.498', longitude: '127.028', limit: '15'});
      assert.equal(call.credentials, 'omit'); assert.equal(call.mode, 'cors'); assert.equal(call.method, 'GET'); assert.equal(call.referrerPolicy, 'no-referrer');
      assert.deepEqual(s.items.map(item => item.name), names('hospital_12').slice(0, 5));
      assert.equal(s.status, '내 주변 병원·의원 12곳 중 5곳을 보여 드려요.');
      assert.equal(s.statusRole, 'status');
      assert.equal(s.basis, '현재 위치(서울특별시 강남구) 기준');
      assert.match(s.notice, /^가까운 순이에요\. 2km 안에서 등록된 운영시간상 지금 문을 연 곳을 먼저 보여 드려요\.$/u, 'one line on why this order');
      assert.equal(s.more, '더 보기 (5곳)');
      assert.match(s.source, /출처: 국립중앙의료원 공공데이터/u);
      assert.match(s.source, /실제와 다를 수 있으니 가기 전에 전화로 확인/u);
      assert.ok(s.log.geo >= 1, 'the allowed position was read');
      assert.equal(s.locate, '내 위치 다시 찾기');
      assert.equal(s.locationNote, '위치는 이번 검색에만 쓰고 저장하지 않아요.');
      assert.equal(s.regionVisible, false);
    });
    await check(`${label}: a place carries its name, kind, address, distance, registered hours, a verified phone and the saved map app`, () => {
      const first = s.items[0];
      assert.equal(first.name, '가상내과의원');
      assert.equal(first.category, '의원');
      assert.match(first.address, /^서울특별시 강남구/u);
      assert.equal(first.distance, '직선 200m');
      assert.deepEqual(first.lines[0], {state: 'OPEN', text: '등록 시간상 진료 중 · 오늘 09:00~18:00'});
      assert.ok(first.lines.some(line => line.state === 'CONFIRM' && /실제 진료 여부는 전화로 확인/u.test(line.text)));
      assert.equal(first.phone, 'tel:020000000');
      assert.equal(first.phoneLabel, '가상내과의원 전화하기');
      assert.ok(first.phoneBox.h >= 48 && first.phoneBox.w >= 48, JSON.stringify(first.phoneBox));
      assert.match(first.searchHref, /^https:\/\/search\.naver\.com\//u);
      assert.equal(first.mapProvider, 'NAVER_MAP');
      assert.equal(first.mapIcon, 'naver-map');
      assert.equal(first.mapImg, '/assets/place-actions/naver-map.png?v=place-icons-20260925');
      assert.equal(first.mapLoaded, true, 'the approved image loads');
      assert.equal(first.mapTarget, '_blank'); assert.equal(first.mapRel, 'noopener noreferrer');
      assert.equal(first.mapAria, '가상내과의원 길찾기 (네이버지도)');
      assert.ok(first.mapBox.h >= 48 && first.mapBox.w >= 48, JSON.stringify(first.mapBox));
      const meters = s.items.map(item => { const m = /직선 ([\d.]+)(k?m)/u.exec(item.distance); return Number(m[1]) * (m[2] === 'km' ? 1000 : 1); });
      assert.deepEqual(meters, [200, 720, 980, 1500, 1800], 'open ones first (1760 m reads 1.8km), then by distance');
    });
    await check(`${label}: no photo from Core → no photo box on any card`, () => assert.ok(s.items.every(item => !item.photo), JSON.stringify(s.items.map(item => item.photo))));
    await check(`${label}: no horizontal overflow, every control ≥ 48 px, readable`, () => {
      assert.ok(s.overflow <= 0, `overflow ${s.overflow}`);
      assert.deepEqual(s.small, []);
      for (const item of s.items) {
        assert.ok(item.right <= testCase.width + 0.5, `${item.name} right ${item.right}`);
        assert.ok(item.contrastName >= 4.5 && item.contrastSecondary >= 3, JSON.stringify(item));
      }
    });
    record('병원·의원 — 위치 허용 상태에서 지역정보 → 목록', hospitalTaps, `내 주변 병원·의원 5곳(12곳 중), 전화·길찾기 버튼 바로 보임`);
    await shot('hospital-list-light');
    if (testCase.dark) {
      await evaluate("(() => { document.body.dataset.siteTheme = 'dark'; return true; })()");
      await sleep(80);
      const dark = await snapshot();
      await check(`${label}: dark theme readable`, () => {
        for (const item of dark.items) assert.ok(item.contrastName >= 4.5 && item.contrastSecondary >= 3 && item.contrastState >= 4.5, JSON.stringify(item));
        assert.deepEqual(dark.small, []);
      });
      await shot('hospital-list-dark');
      await evaluate("(() => { document.body.dataset.siteTheme = 'light'; return true; })()");
    }

    // 3. 더 보기: five more from the same read, no new request.
    await tapSelector('[data-site-route="life-medical"] [data-medical-more]');
    s = await listed(10);
    await check(`${label}: 더 보기 shows five more from the same read (no request)`, () => {
      assert.equal(s.status, '내 주변 병원·의원 12곳 중 10곳을 보여 드려요.');
      assert.equal(s.more, '더 보기 (2곳)');
      assert.equal(s.log.nearby.length, 1);
    });
    await tapSelector('[data-site-route="life-medical"] [data-medical-more]');
    s = await listed(12);
    await check(`${label}: the last two, then the button is gone and the count says all`, () => {
      assert.equal(s.more, '');
      assert.equal(s.status, '내 주변 병원·의원 12곳을 모두 보여 드려요.');
      assert.deepEqual(s.items.map(item => item.name), names('hospital_12'));
      assert.equal(new Set(s.items.map(item => item.id)).size, 12);
      const closed = s.items.find(item => item.name === '가상소아과의원');
      assert.deepEqual(closed.lines[0], {state: 'CLOSED', text: '등록 시간상 진료 종료 · 오늘 09:00~12:00'});
    });

    // 4. 응급실 / 약국 are one tap away on the same screen; the choice is remembered.
    taps = 0;
    await tapSelector('[data-site-route="life-medical"] [data-medical-kind="emergency"]');
    s = await listed(4, st => st.log.nearby.length === 2);
    const emergencyTaps = taps;
    await check(`${label}: 응급실 → kind=emergency, 119 call button, five-or-fewer rooms with the ER lines, no phone-less dead end`, () => {
      assert.equal(lastCall(s).kind, 'emergency');
      assert.ok(s.kinds.find(item => item.kind === 'emergency').pressed);
      assert.equal(s.emergency, true);
      assert.equal(s.emergencyTel, 'tel:119');
      assert.match(s.emergencyText, /119/u);
      assert.ok(s.emergencyCallBox.h >= 48 && s.emergencyCallBox.w >= 48, JSON.stringify(s.emergencyCallBox));
      assert.deepEqual(s.items.map(item => item.name), names('emergency_4'));
      assert.equal(s.status, '내 주변 응급실 4곳을 모두 보여 드려요.');
      assert.equal(s.more, '');
      assert.match(s.notice, /^가까운 순이에요\. 병상은 병원이 보고한 시각 기준이고, 받아 줄지는 병원이 정해요\.$/u);
      assert.ok(s.items[0].lines.some(line => line.state === 'REALTIME_NONE'), JSON.stringify(s.items[0].lines));
      assert.ok(s.items[0].lines.some(line => /수용 여부는 출발 전 전화로 확인/u.test(line.text)));
      assert.equal(s.items[0].phone, 'tel:021110000');
    });
    record('응급실 — 같은 화면에서 칩 한 번', emergencyTaps, '내 주변 응급실 4곳 + 119 전화 버튼 항상 보임');
    await shot('emergency-light');
    taps = 0;
    await tapSelector('[data-site-route="life-medical"] [data-medical-kind="pharmacy"]');
    s = await listed(5, st => st.log.nearby.length === 3);
    const pharmacyTaps = taps;
    await check(`${label}: 약국 → kind=pharmacy, five of eight, 119 button gone`, () => {
      assert.equal(lastCall(s).kind, 'pharmacy');
      assert.equal(s.emergency, false);
      assert.deepEqual(s.items.map(item => item.name), names('pharmacy_8').slice(0, 5));
      assert.equal(s.status, '내 주변 약국 8곳 중 5곳을 보여 드려요.');
      assert.equal(s.more, '더 보기 (3곳)');
      assert.deepEqual(s.items[0].lines[0], {state: 'OPEN', text: '등록 시간상 운영 중 · 오늘 09:00~18:00'});
      assert.equal(JSON.parse(s.storage.kind), 'pharmacy', 'the choice is remembered');
    });
    record('약국 — 같은 화면에서 칩 한 번', pharmacyTaps, '내 주변 약국 5곳(8곳 중)');
    await reopenFromUrl();
    s = await listed(5);
    await check(`${label}: reopening starts from the remembered choice (약국) — no tap`, () => {
      assert.ok(s.kinds.find(item => item.kind === 'pharmacy').pressed);
      assert.equal(lastCall(s).kind, 'pharmacy');
    });
    await evaluate("(() => { localStorage.removeItem('lotbi.life.medical-kind.v1'); return true; })()");

    // 5. System back and ← both land on 지역정보, a second back on the home.
    await navigate(`${origin}/`);
    await ready();
    await openLife();
    await tapSelector('[data-site-route="life"] [data-life-shortcut="medical"]');
    await listed(5);
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '#life' && st.lifeVisible && !st.open ? st : {ok: false, st}; }, `${label}: back to 지역정보`);
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '' && st.homeVisible ? st : {ok: false, st}; }, `${label}: back to home`);
    await openLife();
    await tapSelector('[data-site-route="life"] [data-life-shortcut="medical"]');
    await listed(5);
    await tapSelector('[data-site-route="life-medical"] .site-modal-close');
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '#life' && st.lifeVisible && !st.open ? st : {ok: false, st}; }, `${label}: ← to 지역정보`);
    await go(-1);
    s = await waitFor(async () => { const st = await snapshot(); return st.hash === '' && st.homeVisible ? st : {ok: false, st}; }, `${label}: ← then back to home`);
    await check(`${label}: system back and ← both land on 지역정보, a second back on the home; no chat`, () => {
      assert.equal(s.hash, '');
      assert.deepEqual(s.log.chat, []);
    });

    // 6. Every problem says what happened and leaves a next tap.
    const problem = async (scenario, kind, ok, what) => {
      await setScenario(scenario);
      await evaluate(`(() => { localStorage.setItem('lotbi.life.medical-kind.v1', ${JSON.stringify(JSON.stringify(kind))}); return true; })()`);
      await reopenFromUrl();
      const state = await settledScreen(st => st.errorText !== '' && !/찾는 중/u.test(st.status), `${scenario}/${kind} problem`);
      await check(`${label}: ${what}`, () => assert.ok(ok(state), JSON.stringify({text: state.errorText, buttons: state.errorButtons, items: state.items.length})));
      return state;
    };
    const none = st => st.items.length === 0;
    await problem('empty', 'pharmacy', st => none(st) && /내 주변에서 약국을 찾지 못했어요\. 다른 지역을 골라 보세요\./u.test(st.errorText) && st.errorButtons.join('|') === '지역 고르기', 'nothing found → says so, [지역 고르기] (not a retry of the same nothing)');
    await shot('empty-light');
    await problem('unavailable', 'hospital', st => none(st) && /가까운 병원·의원이 없다는 뜻은 아니에요/u.test(st.errorText) && st.errorButtons.join('|') === '다시 시도|지역 고르기', 'provider down → "does not mean there is none", [다시 시도] [지역 고르기]');
    await shot('unavailable-light');
    await problem('unavailable', 'emergency', st => none(st) && /119에 전화하세요/u.test(st.errorText) && st.errorButtons.join('|') === '다시 시도|지역 고르기|119 전화' && st.errorTel.join() === 'tel:119' && st.emergency, 'emergency provider down → 119 stays one tap away (banner and button)');
    await problem('empty', 'emergency', st => none(st) && /119에 전화하세요/u.test(st.errorText) && st.errorTel.join() === 'tel:119', 'no emergency room found → 119');
    await problem('disabled', 'hospital', st => none(st) && /병원·의원 정보 연결을 준비하고 있어요/u.test(st.errorText) && st.errorButtons.join('|') === '다시 시도', 'connection off → says it is being prepared, [다시 시도], the other choices stay');
    await problem('disabled', 'emergency', st => none(st) && /급하면 119에 전화하세요/u.test(st.errorText) && st.errorTel.join() === 'tel:119', 'connection off, emergency → 119');
    await problem('network_error', 'pharmacy', st => none(st) && /인터넷 연결을 확인하고 다시 시도해 주세요/u.test(st.errorText) && st.errorButtons.join('|') === '다시 시도|지역 고르기', 'network error → [다시 시도] [지역 고르기]');
    await problem('rate_limited', 'pharmacy', st => none(st) && /1분 뒤에 다시 시도해 주세요/u.test(st.errorText), 'rate limit → says when to retry');
    await problem('bad_shape', 'pharmacy', st => none(st) && /약국 정보를 불러오지 못했어요/u.test(st.errorText) && st.errorButtons.includes('다시 시도'), 'a malformed answer is never shown as a list');
    await problem('needs_location', 'pharmacy', st => none(st) && /위치를 알려 주시면/u.test(st.errorText) && st.errorButtons.join('|') === '지역 고르기', 'Core asks for a position → [지역 고르기], never a typed question');
    // Retry really retries: first call 503, the second is the normal answer.
    await setScenario('fail_once');
    await evaluate(`(() => { localStorage.setItem('lotbi.life.medical-kind.v1', '"pharmacy"'); return true; })()`);
    await reopenFromUrl();
    await settledScreen(st => /다시 시도/u.test(st.errorButtons.join()), 'fail_once error');
    await tapSelector('[data-site-route="life-medical"] [data-medical-retry]');
    s = await listed(5);
    await check(`${label}: [다시 시도] asks Core again and the list appears`, () => {
      assert.equal(s.errorText, '');
      assert.equal(s.log.nearby.length, 2, 'the first read failed, the retry is the second');
    });
    await setScenario('normal');
    await setScenario('partial');
    await reopenFromUrl();
    s = await listed(5);
    await check(`${label}: a partly read provider says so, and the list still shows`, () => {
      assert.match(s.notice, /공공데이터에서 일부만 확인한 결과예요/u);
      assert.ok(s.items[0].lines.some(line => /일부 기관만 확인/u.test(line.text)));
    });
    await setScenario('photo');
    await reopenFromUrl();
    s = await settledScreen(st => st.items.length === 5 && !st.items[2].photo && st.items[1].photo, 'photos settled');
    await check(`${label}: a verified photo shows in its card; no photo, a failing photo and an unverified URL leave no photo box`, () => {
      assert.deepEqual(s.items.map(item => item.photo), [false, true, false, false, false]);
      assert.equal(s.items[1].photoSrc, 'https://lh3.googleusercontent.com/lotbi-medical-list-photo.jpg');
      assert.equal(s.items[1].photoAlt, `${s.items[1].name} 대표 사진`);
      assert.deepEqual(s.small, []);
    });
    await shot('photo-light');
    await setScenario('none_open');
    await reopenFromUrl();
    s = await listed(5);
    await check(`${label}: nothing registered open near → the sort line says so, the list is by distance`, () => {
      assert.match(s.notice, /2km 안에 등록된 운영시간상 지금 문을 연 곳이 없어 가까운 곳을 보여 드려요/u);
      assert.ok(s.items.every(item => item.lines[0].state === 'CLOSED'));
    });
    await setScenario('normal');
    await evaluate("(() => { localStorage.removeItem('lotbi.life.medical-kind.v1'); return true; })()");

    if (testCase.full) {
      // 7. Location refused: the picker is the screen; a picked region is remembered.
      await permission('denied');
      await clearMemory();
      await reopenFromUrl();
      s = await settledScreen(st => st.regionVisible && /위치 권한이 허용되지 않아/u.test(st.locationNote) && st.log.regions > 0 && /시·도와 시·군을 고르면/u.test(st.status), 'denied: picker');
      await check(`${label}: location refused → the 시·도/시·군 picker is open with both buttons, nothing searched, no position read`, () => {
        assert.deepEqual(s.provinces, ['시·도 선택', '서울특별시', '전북특별자치도']);
        assert.equal(s.locate, '위치 허용하고 찾기');
        assert.equal(s.toggle, '지역 고르기'); assert.equal(s.togglePressed, true);
        assert.equal(s.log.nearby.length, 0);
        assert.equal(s.items.length, 0);
        assert.equal(s.status, '시·도와 시·군을 고르면 그곳의 병원·의원을 보여 드려요.');
      });
      await shot('denied-picker-light');
      taps = 0;
      await choose('[data-medical-region="province"]', '서울특별시');
      await choose('[data-medical-region="city"]', '강남구');
      s = await listed(5, st => st.log.nearby.length === 1);
      const regionTaps = taps;
      await check(`${label}: pick 서울특별시 → 강남구 → the region's list; distances are not claimed; the region is remembered`, () => {
        assert.deepEqual(lastCall(s), {kind: 'hospital', latitude: '37.498', longitude: '127.028', source: 'SAVED_REGION', label: '강남구', limit: '15'});
        assert.deepEqual(s.items.map(item => item.name), names('hospital_12_region').slice(0, 5));
        assert.ok(s.items.every(item => item.distance === ''), 'a region has no distance');
        assert.equal(s.basis, '저장된 지역(강남구) 기준');
        assert.equal(s.status, '강남구 병원·의원 12곳 중 5곳을 보여 드려요.');
        assert.match(s.notice, /^등록된 운영시간상 지금 문을 연 곳을 먼저, 그다음 이름 순이에요\.$/u);
        assert.equal(s.log.geo, 0, 'the browser position was not read');
        assert.deepEqual(JSON.parse(s.storage.region), {label: '강남구', latitude: 37.498, longitude: 127.028});
      });
      record('위치 거부 — 지역 고르기(첫 방문)', regionTaps, '강남구 병원·의원 5곳(12곳 중), 거리는 말하지 않음(지역 기준)', {afterEntry: '지역정보 → 카드 1탭 + 선택 2칸(각 2번 조작)'});
      await shot('region-list-light');
      await tapSelector('[data-site-route="life-medical"] [data-medical-kind="emergency"]');
      s = await listed(4, st => st.log.nearby.length === 2);
      await check(`${label}: 응급실 in a region → name order line, 119 stays`, () => {
        assert.match(s.notice, /^이름 순이에요\. 병상은 병원이 보고한 시각 기준이고/u);
        assert.equal(s.emergencyTel, 'tel:119');
        assert.equal(s.status, '강남구 응급실 4곳을 모두 보여 드려요.');
      });
      await tapSelector('[data-site-route="life-medical"] [data-medical-kind="hospital"]');
      await listed(5, st => st.log.nearby.length === 3);
      // Next visit: the remembered region lists at once, no tap, no picker needed.
      await reopenFromUrl();
      taps = 0;
      s = await listed(5);
      await check(`${label}: next visit (still refused) → the remembered 강남구 list appears at once; no tap, no position read`, () => {
        assert.equal(lastCall(s).source, 'SAVED_REGION');
        assert.equal(lastCall(s).label, '강남구');
        assert.equal(s.log.geo, 0);
        assert.equal(s.basis, '저장된 지역(강남구) 기준');
        assert.equal(taps, 0);
        assert.equal(s.regionVisible, true, 'the picker stays open to change the region');
      });
      record('위치 거부 — 다음 방문(지역 기억)', 0, '지역정보 → 카드 1탭만으로 강남구 목록 5곳');
      await permission('granted');
      await tapSelector('[data-site-route="life-medical"] [data-medical-locate]');
      s = await listed(5, st => lastCall(st).source === undefined);
      await check(`${label}: [위치 허용하고 찾기] after allowing → the current position's list (region row closes)`, () => {
        assert.equal(s.basis, '현재 위치(서울특별시 강남구) 기준');
        assert.equal(s.regionVisible, false);
        assert.ok(s.log.geo >= 1);
      });

      // 8. Undecided permission, nothing remembered: the two buttons are the screen; opening asks nothing.
      await cdp.send('Browser.resetPermissions');
      await clearMemory();
      await reopenFromUrl();
      s = await settledScreen(st => st.regionVisible && /내 위치나 지역을 알려 주시면/u.test(st.status), 'undecided: chooser');
      await check(`${label}: undecided permission, nothing remembered → [위치 허용하고 찾기] and [지역 고르기] are the screen; nothing asked, nothing searched`, () => {
        assert.equal(s.locate, '위치 허용하고 찾기');
        assert.equal(s.toggle, '지역 고르기');
        assert.equal(s.log.geo, 0);
        assert.equal(s.log.nearby.length, 0);
        assert.match(s.locationNote, /위치 허용하고 찾기.를 누르거나 지역을 골라 주세요/u);
      });
      await shot('chooser-light');
      // Undecided but a region is remembered: it lists at once and says how to use the position.
      await evaluate(`(() => { localStorage.setItem('lotbi.life.medical-region.v1', JSON.stringify({label: '전주시', latitude: 35.8242, longitude: 127.148})); return true; })()`);
      await reopenFromUrl();
      s = await listed(5);
      await check(`${label}: undecided permission + remembered region → that region's list at once, the note says how to use the position, no position read`, () => {
        assert.equal(lastCall(s).label, '전주시');
        assert.match(s.locationNote, /현재 위치로 찾으려면 "위치 허용하고 찾기"를 눌러 주세요/u);
        assert.equal(s.log.geo, 0);
      });
      // The calendar's saved region is the same kind of memory.
      await evaluate(`(() => { localStorage.removeItem('lotbi.life.medical-region.v1'); localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전주시', latitude: 35.8242, longitude: 127.148})); return true; })()`);
      await reopenFromUrl();
      s = await listed(5);
      await check(`${label}: the calendar's saved region is used when nothing was picked here`, () => assert.equal(lastCall(s).label, '전주시'));

      // 9. LOTBI location use off: picker + settings link, no position read.
      await permission('granted');
      await clearMemory();
      await setCookie('lotbi_location_usage_v1', 'off');
      await reopenFromUrl();
      s = await settledScreen(st => /위치 사용이 꺼져 있어/u.test(st.locationNote) && st.regionVisible && st.status !== '', 'usage off');
      await check(`${label}: location use off → settings link (≥ 48 px), picker, no position read`, () => {
        assert.equal(s.settingsLink, 'https://account.lotbiai.com/account#privacy');
        assert.equal(s.log.geo, 0);
        assert.deepEqual(s.small, []);
      });
      await clearCookie('lotbi_location_usage_v1');
      // The 지역 목록 itself cannot be read: says so, offers a retry.
      await permission('denied');
      await clearMemory();
      await evaluate("(() => { localStorage.setItem('__medRegions', 'down'); return true; })()");
      await reopenFromUrl();
      s = await settledScreen(st => /지역 목록을 불러오지 못했어요/u.test(st.errorText), 'regions down');
      await check(`${label}: the region list cannot be read → says so with [다시 시도] (no empty picker)`, () => {
        assert.deepEqual(s.errorButtons, ['다시 시도']);
      });
      await evaluate("(() => { localStorage.removeItem('__medRegions'); return true; })()");
      await tapSelector('[data-site-route="life-medical"] [data-medical-retry]');
      s = await settledScreen(st => st.provinces.length === 3, 'regions retried');
      await check(`${label}: [다시 시도] reads the 지역 목록 again; the picker is there and the error is gone`, () => {
        assert.deepEqual(s.provinces, ['시·도 선택', '서울특별시', '전북특별자치도']);
        assert.equal(s.errorText, '');
        assert.equal(s.status, '시·도와 시·군을 고르면 그곳의 병원·의원을 보여 드려요.');
      });
      await permission('granted');
      await clearMemory();
    }

    if (testCase.messages) {
      // 10. A signed-in reader: the same screen (mounted from the section itself).
      await navigate(`${origin}/`);
      await ready();
      const signedIn = await evaluate(`(async () => {
        const {mountConsumerSection} = await import('/site-consumer-sections.js');
        const host = document.createElement('div'); host.id = 'signed-in-host'; document.body.append(host);
        const asked = [];
        mountConsumerSection({section: 'life', root: host, authenticated: true, accountId: 'acct', onAsk: text => asked.push(text), onLifeView: () => {}});
        host.querySelector('[data-life-shortcut="medical"]').click();
        for (let i = 0; i < 100 && host.querySelectorAll('.medical-place').length < 5; i += 1) await new Promise(r => setTimeout(r, 100));
        return {names: [...host.querySelectorAll('.medical-place-name')].map(n => n.textContent), asked, kinds: [...host.querySelectorAll('[data-medical-kind]')].map(n => n.textContent)};
      })()`);
      await check(`${label}: signed in → the same three choices and list; nothing asked of the conversation`, () => {
        assert.deepEqual(signedIn.kinds, ['병원·의원', '응급실', '약국']);
        assert.deepEqual(signedIn.names, names('hospital_12').slice(0, 5));
        assert.deepEqual(signedIn.asked, []);
      });
    }

    if (testCase.providers) {
      await evaluate("(() => { localStorage.removeItem('lotbi.life.medical-kind.v1'); return true; })()");
      for (const [provider, want] of Object.entries(PROVIDER_EXPECT)) {
        await setCookie('lotbi_default_map_provider_v1', provider);
        await reopenFromUrl();
        s = await listed(5);
        const icon = testCase.providers === 'desktop' ? want.desktopIcon : want.icon;
        await check(`${label}: saved ${provider} → its approved icon (${icon}) and its link`, () => {
          for (const item of s.items) {
            assert.equal(item.mapProvider, provider);
            assert.equal(item.mapIcon, icon);
            assert.equal(item.mapImg, `/assets/place-actions/${icon}.png?v=place-icons-20260925`);
            assert.equal(item.mapLoaded, true);
            assert.ok(item.mapHref.startsWith('http') || item.mapHref.includes('://') || item.mapHref.startsWith('intent'), item.mapHref);
          }
          assert.match(s.items[0].mapAria, /길찾기 \(/u);
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
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-medical-list-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const only = (process.env.LIFE_MEDICAL_CASES || '').split(',').map(item => item.trim()).filter(Boolean);
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
if (process.env.LIFE_MEDICAL_SCENARIO_OUT) fs.writeFileSync(process.env.LIFE_MEDICAL_SCENARIO_OUT, JSON.stringify(SCENARIOS, null, 1));

console.log(`LIFE-MEDICAL-MERGE-01 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
