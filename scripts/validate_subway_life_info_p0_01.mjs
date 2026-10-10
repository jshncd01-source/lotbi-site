// SUBWAY-LIFE-INFO-P0 — 지역정보 → 지하철 정보 → 역 → 실시간 도착 · 열차 위치 · 평균 혼잡도.
//
// Contract checked here:
// * 지역정보 shows '지하철 정보' right after 지역뉴스; the other cards and their
//   order stay; phones keep the approved two-column grid with every row full
// * the card opens its own screen (/#subway), never the conversation: no chat
//   request, nothing typed into the composer, no AI
// * the screens call only GET /v2/life/subway/* (credentials omit, no-referrer)
// * 가까운 역: the current position rounded to 4 decimals when the LOTBI
//   location setting is on and the browser allows it; off → no position is
//   read and the reader searches instead; a reload never asks for the location
// * 역 이름 검색 · 호선으로 찾기; a station outside the Seoul list says so
// * the station screen (/#subway-station): one line at a time (강남 2호선 /
//   신분당선 chips), 방향 chips with the official 방면, the official arrival
//   message, "지금 기준 약 …", "정보 생성 HH:MM:SS (… 전)", 막차, the joined train
//   position; NOT_READY / STALE / EMPTY / UNAVAILABLE / QUOTA each say what
//   happened; 평균 혼잡도 is titled "(과거 자료)", says it is not real time,
//   gives the 34%/100% scale and its source quarter, 평일/토요일/일요일 and the
//   30-minute slot re-ask Core; a line without averages says so
// * reload of /#subway-station reopens the same station, line and direction;
//   system back steps station → 지하철 정보 → 지역정보 → home; the station's ←
//   goes to 지하철 정보
// * 360/375/390/412 phones and 1280 desktop, light and dark: no horizontal
//   overflow, controls ≥ 44 px, readable text (viewport emulation, not a
//   device run)
//
// Core answers come from scripts/fixtures/subway_life_info_p0_01.json,
// produced by lotbi-core scripts/export_subway_site_fixture.py (Core's own
// code; real-time rows are invented 테스트 trains, stations and averages are
// the bundled official data).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/subway_life_info_p0_01.json'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const EXPECTED_CARDS = ['medical', 'pharmacy', 'ev-chargers', 'festivals', 'news', 'subway', 'onnuri', 'real-estate', 'local', 'my-child'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

// ── Pure contract ───────────────────────────────────────────────────────
const sections = await import('../site-consumer-sections.js');
const subway = await import('../site-life-subway.js');
const {SITE_ROUTES} = await import('../site-route.js');

await check('지역정보: 지하철 정보 right after 지역뉴스, the other cards and their order kept', () => {
  const ids = sections.LIFE_SHORTCUTS.map(item => item.id);
  assert.deepEqual(ids, EXPECTED_CARDS);
  const card = sections.LIFE_SHORTCUTS.find(item => item.id === 'subway');
  assert.deepEqual(card, {id: 'subway', label: '지하철 정보', icon: 'subway'});
});

await check('the card opens routed screens of its own; nothing goes to the conversation', () => {
  const source = read('site-consumer-sections.js');
  assert.match(source, /else if \(item\.id === 'subway'\) onSubway\?\.\(\);/u);
  assert.match(source, /subway: \['M7 3h10/u, 'a subway icon in the shortcut icon set');
  const conversation = read('site-conversation.js');
  assert.match(conversation, /onSubway: \(\) => \{ closeSurface\(\); void openSubway\(\); \},/u);
  assert.match(conversation, /workspace: 'life', route: 'subway', backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\), backRoute: 'life',/u);
  assert.match(conversation, /workspace: 'life', route: 'subway-station', backLabel: '지하철 정보로 돌아가기', onBack: \(\) => openSubway\(\{askLocation: false\}\), backRoute: 'subway',/u);
  assert.match(conversation, /subway: \(\) => openSubway\(\{askLocation: false\}\),/u, 'a URL-opened screen never asks for the location');
  assert.match(conversation, /'subway-station': \(\) => openSubwayStation\(\),/u);
  assert.match(conversation, /import\('\.\/site-life-subway\.js\?v=aset-[0-9a-f]{12}'\)/u);
  assert.ok(SITE_ROUTES.includes('subway') && SITE_ROUTES.includes('subway-station'));
  const screen = read('site-life-subway.js');
  for (const banned of [/\bonAsk\b/u, /requestAssistant|askWithoutKeyboard/u, /\/v2\/conversation/u, /innerHTML/u,
    /localStorage|sessionStorage/u, /navigator\.geolocation/u, /document\.cookie\s*=/u, /swopenapi|data\.seoul\.go\.kr\/api/u,
    /실시간 혼잡도:|현재 혼잡도|칸별 혼잡/u]) {
    assert.doesNotMatch(screen, banned, String(banned));
  }
  assert.match(screen, /\/v2\/life\/subway\//u);
});

await check('styles: theme tokens only, linked from index.html and the callback document', () => {
  const css = read('site-life-subway.css');
  assert.doesNotMatch(css, /data-site-theme|prefers-color-scheme|#[0-9a-f]{3,6}\b|rgb\(/iu, 'theme tokens only');
  assert.match(read('index.html'), /<link rel="stylesheet" href="site-life-subway\.css\?v=aset-[0-9a-f]{12}" \/>/u);
  assert.match(read('auth/callback/index.html'), /<link rel="stylesheet" href="\/site-life-subway\.css\?v=aset-[0-9a-f]{12}" \/>/u);
});

await check('Core answers: groups, lines and arrivals normalize to exactly what Core said', () => {
  const groups = FIXTURE.nearby_gangnam_1km.groups.map(subway.normalizeGroup);
  assert.equal(groups[0].name, '강남');
  assert.deepEqual(groups[0].lines.map(line => line.lineName), ['2호선', '신분당선']);
  assert.ok(groups.every((group, index) => index === 0 || group.distanceMeters >= groups[index - 1].distanceMeters));
  assert.equal(subway.normalizeGroup({name: '가짜', lines: [{station_id: '1002000222', line_id: '1077', line_name: 'x'}]}), null,
    'a station id that is not on its line is dropped');
  const arrivals = FIXTURE.arrivals_gangnam_2.arrivals.map(subway.normalizeArrival);
  assert.equal(arrivals.length, 4);
  assert.deepEqual(arrivals.map(item => item.direction), ['INNER', 'INNER', 'OUTER', 'OUTER']);
  assert.equal(arrivals[0].message, '2분 후 (교대)');
  assert.equal(arrivals[0].etaSeconds, 75);
  assert.equal(arrivals[0].generatedAt, '07:59:40');
  assert.deepEqual(arrivals[0].position, {stationName: '교대', statusLabel: '출발', receivedAt: '07:59:48'});
  assert.equal(arrivals[3].lastTrain, true);
  assert.equal(arrivals[2].statusLabel, '진입');
  assert.deepEqual(subway.directionChoices(arrivals, FIXTURE.congestion_gangnam_2_weekday.series),
    [{code: 'INNER', label: '내선', heading: '역삼방면'}, {code: 'OUTER', label: '외선', heading: '교대방면'}]);
  assert.equal(subway.headingOf('성수행 - 교대방면 (막차)'), '교대방면');
  // 신분당선's live rows run a few minutes ahead of the clock: official words, no age.
  const ahead = subway.normalizeArrival({...FIXTURE.arrivals_gangnam_sinbundang.arrivals[0], clock_ahead: true, age_seconds: null, eta_seconds: null});
  assert.equal(ahead.clockAhead, true);
  const item = subway.arrivalItem(ahead, {documentRef: {createElement: tag => ({tag, className: '', textContent: '', dataset: {}, children: [], append(...nodes) { this.children.push(...nodes); }})}});
  const meta = item.children.find(node => node.className === 'subway-arrival-meta');
  assert.match(meta.textContent, /^정보 생성 \d{2}:\d{2}:\d{2} \(제공처 시각이 지금보다 앞서 경과 시간을 계산하지 않았어요\)$/u);
  assert.equal(subway.formatSeconds(75), '1분 15초');
  assert.equal(subway.formatSeconds(120), '2분');
  assert.equal(subway.kstDayType(Date.parse('2026-10-11T23:30:00Z')), 'weekday', 'Monday 08:30 KST');
  assert.equal(subway.kstDayType(Date.parse('2026-10-10T03:00:00Z')), 'saturday');
});

await check('requests: rounded position, radius choices, station and line ids only', () => {
  const url = new URL(subway.nearbyUrl({latitude: 37.497912, longitude: 127.027634}, 'https://api.lotbiai.com'));
  assert.equal(url.pathname, '/v2/life/subway/nearby');
  assert.deepEqual(Object.fromEntries(url.searchParams), {latitude: '37.4979', longitude: '127.0276', radius_km: '2', limit: '10'});
  assert.equal(new URL(subway.nearbyUrl({latitude: 37.5, longitude: 127, radiusKm: 7}, 'https://x.test')).searchParams.get('radius_km'), '2');
  assert.throws(() => subway.nearbyUrl({latitude: 40.1, longitude: 127.1}));
  assert.equal(subway.subwayUrl('arrivals', {station_id: '1002000222'}, 'https://x.test'), 'https://x.test/v2/life/subway/arrivals?station_id=1002000222');
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
  throw new Error('Chrome/Chromium is required for the 지하철 정보 validation.');
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
// script on every document. localStorage.__subwayScenario picks an arrivals answer.
const MOCK = `(() => {
  const F = ${JSON.stringify(FIXTURE)};
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const log = window.__subwayLog = {subway: [], chat: [], geo: 0};
  const geo = navigator.geolocation;
  if (geo) {
    const current = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (...args) => { log.geo += 1; return current(...args); };
    const watch = geo.watchPosition.bind(geo);
    geo.watchPosition = (...args) => { log.geo += 1; return watch(...args); };
  }
  const answer = (name, params) => {
    if (name === 'stations') {
      if (params.line_id === '1002') return F.line_1002;
      if (params.q === '강남') return F.search_gangnam;
      if (params.q === '서울역') return F.search_seoul;
      if (params.q === '서면') return F.search_seomyeon;
      return F.lines;
    }
    if (name === 'nearby') return params.radius_km === '1' ? F.nearby_gangnam_1km : F.nearby_gangnam_2km;
    if (name === 'arrivals') {
      const scenario = read('__subwayScenario') || '';
      if (scenario && F['arrivals_' + scenario]) return F['arrivals_' + scenario];
      return params.station_id === '1077000687' ? F.arrivals_gangnam_sinbundang : F.arrivals_gangnam_2;
    }
    if (name === 'congestion-average') {
      if (params.station_id === '1077000687') return F.congestion_gangnam_sinbundang;
      return F['congestion_gangnam_2_' + (params.day || 'weekday')];
    }
    return null;
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
    const match = /^\\/v2\\/life\\/subway\\/([a-z-]+)$/u.exec(url.pathname);
    if (match) {
      const params = Object.fromEntries(url.searchParams);
      log.subway.push({name: match[1], params, credentials: init.credentials || '', mode: init.mode || '', referrerPolicy: init.referrerPolicy || ''});
      if ((read('__subwayScenario') || '') === 'network_error' && match[1] === 'arrivals') throw new TypeError('Failed to fetch');
      const body = answer(match[1], params);
      return body ? json(body) : json({detail: 'not found'}, 404);
    }
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const CASES = [
  {label: 'android-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA, full: true},
  {label: 'iphone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, dark: true},
  {label: 'android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, dark: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, dark: true, full: true},
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

// In the page: what the 지하철 screens show and how they are laid out.
const SNAPSHOT = `(() => {
  const home = document.querySelector('[data-site-route="subway"]');
  const station = document.querySelector('[data-site-route="subway-station"]');
  const surface = station || home;
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height, right: r.right}; };
  const luminance = color => {
    const m = /rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)/u.exec(color || ''); if (!m) return 1;
    const c = [m[1], m[2], m[3]].map(v => { const s = Number(v) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const background = node => { for (let n = node; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg && !/rgba\\(0, 0, 0, 0\\)|transparent/u.test(bg)) return bg; } return 'rgb(255, 255, 255)'; };
  const contrast = node => { if (!node) return 21; const a = luminance(getComputedStyle(node).color), b = luminance(background(node)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const visible = node => node && node.getClientRects().length > 0 && !node.closest('[hidden]');
  const small = surface ? [...surface.querySelectorAll('button, select, input, a')].filter(visible).filter(node => {
    const r = node.getBoundingClientRect(); return r.width > 0 && (r.height < 44 && !node.closest('.subway-source, .subway-location-note')) ;
  }).map(node => (node.textContent || node.getAttribute('aria-label') || node.tagName).trim().slice(0, 30)) : [];
  const text = selector => surface?.querySelector(selector)?.textContent?.trim() || '';
  return {
    hash: location.hash,
    open: Boolean(surface),
    which: station ? 'station' : home ? 'home' : '',
    lifeVisible: Boolean(document.querySelector('[data-site-route="life"] .consumer-shortcuts')),
    title: surface?.querySelector('.site-modal-header h2')?.textContent || '',
    back: surface?.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    prompt: document.querySelector('textarea')?.value || '',
    log: window.__subwayLog,
    status: [...(surface?.querySelectorAll('.subway-status') || [])].map(n => n.textContent.trim()).filter(Boolean),
    note: text('.subway-location-note'),
    groups: [...(home?.querySelectorAll('.subway-group-button') || [])].map(button => ({
      name: button.querySelector('.subway-group-name')?.textContent || '',
      lines: [...button.querySelectorAll('.subway-line-badge')].map(n => n.textContent),
      distance: button.querySelector('.subway-group-distance')?.textContent || '',
      contrast: contrast(button.querySelector('.subway-group-name')),
    })),
    stationName: text('.subway-station-name'),
    lineChips: [...(station?.querySelectorAll('[data-subway-line-choice]') || [])].filter(visible).map(n => ({line: n.textContent, pressed: n.getAttribute('aria-pressed')})),
    directionChips: [...(station?.querySelectorAll('[data-subway-direction]') || [])].filter(visible).map(n => ({label: n.textContent, code: n.dataset.subwayDirection, pressed: n.getAttribute('aria-pressed')})),
    arrivals: [...(station?.querySelectorAll('.subway-arrival') || [])].map(item => ({
      direction: item.dataset.direction, train: item.dataset.trainNo || '',
      line: item.querySelector('.subway-arrival-line')?.textContent || '',
      message: item.querySelector('.subway-arrival-message')?.textContent || '',
      meta: item.querySelector('.subway-arrival-meta')?.textContent || '',
      position: item.querySelector('.subway-arrival-position')?.textContent || '',
      tags: [...item.querySelectorAll('.subway-tag')].map(n => n.textContent),
      contrast: contrast(item.querySelector('.subway-arrival-message')),
      metaContrast: contrast(item.querySelector('.subway-arrival-meta')),
    })),
    checked: text('.subway-checked'),
    refreshVisible: visible(station?.querySelector('.subway-refresh')),
    averageTitle: text('.subway-average .subway-block-title'),
    averageNotice: text('.subway-average-notice'),
    averageScale: text('.subway-average-scale'),
    averageSource: station?.querySelector('.subway-average .subway-source')?.textContent || '',
    averageRows: [...(station?.querySelectorAll('.subway-average-row') || [])].map(row => ({direction: row.dataset.direction, label: row.querySelector('.subway-average-label')?.textContent || '', value: row.querySelector('.subway-average-value')?.textContent || ''})),
    dayChips: [...(station?.querySelectorAll('[data-subway-day]') || [])].filter(visible).map(n => ({day: n.dataset.subwayDay, pressed: n.getAttribute('aria-pressed')})),
    slot: station?.querySelector('[data-subway-slot]')?.value || '',
    slotVisible: visible(station?.querySelector('.subway-slot-field')),
    realtimeSource: station?.querySelector('.subway-realtime .subway-source')?.textContent || '',
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    surfaceOverflow: surface ? surface.querySelector('.site-modal-content')?.scrollWidth - surface.querySelector('.site-modal-content')?.clientWidth : 0,
    small,
    unnamed: surface ? [...surface.querySelectorAll('button, select, input, a')].filter(visible).filter(node =>
      !((node.textContent || '').trim() || node.getAttribute('aria-label') || (node.labels && node.labels.length))).map(node => node.outerHTML.slice(0, 80)) : [],
    groupsLabelled: [...(surface?.querySelectorAll('[role="group"]') || [])].every(node => Boolean(node.getAttribute('aria-label'))),
    statusRoles: [...(surface?.querySelectorAll('.subway-status') || [])].every(n => n.getAttribute('role') === 'status'),
  };
})()`;

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.SUBWAY_SCREENSHOT_DIR || '';
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
    await page('Emulation.setFocusEmulationEnabled', {enabled: true});
    await page('Emulation.setGeolocationOverride', {latitude: 37.497912, longitude: 127.027634, accuracy: 20});
    await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'granted'});

    const loadEvent = () => new Promise(resolve => {
      const stop = cdp.on(message => { if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); } });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    const navigate = async url => { const loaded = loadEvent(); await page('Page.navigate', {url}); await loaded; };
    const ready = () => waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${label}: page ready`, 30000);
    const snapshot = () => evaluate(SNAPSHOT);
    const reload = async () => { const loaded = loadEvent(); await page('Page.reload', {ignoreCache: true}); await loaded; await ready(); };
    const back = async () => { await evaluate('(() => { history.back(); return true; })()'); };
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
    const settled = (predicate, what) => waitFor(async () => {
      const s = await snapshot();
      return predicate(s) ? s : {ok: false, s: {...s, log: undefined, groups: s.groups.length, arrivals: s.arrivals.length}};
    }, `${label}: ${what}`, 20000);
    const setScenario = value => evaluate(`(() => { localStorage.setItem('__subwayScenario', ${JSON.stringify(value)}); return true; })()`);
    const setCookie = (name, value) => evaluate(`(() => { document.cookie = ${JSON.stringify(`${name}=`)} + ${JSON.stringify(value)} + '; path=/; SameSite=Lax'; return true; })()`);
    const shoot = async name => {
      if (!shots) return;
      fs.mkdirSync(shots, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(shots, `${label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const darkCheck = async (name, assertDark) => {
      if (!testCase.dark) return;
      await evaluate("(() => { document.body.dataset.siteTheme = 'dark'; document.documentElement.dataset.siteTheme = 'dark'; return true; })()");
      await sleep(80);
      const dark = await snapshot();
      await check(`${label}: ${name} — dark theme readable`, () => assertDark(dark));
      await shoot(`${name}-dark`);
      await evaluate("(() => { document.body.dataset.siteTheme = 'light'; document.documentElement.dataset.siteTheme = 'light'; return true; })()");
    };

    // 1. Home → 지역정보: the card sits after 지역뉴스 in the approved grid.
    await navigate(`${origin}/`);
    await ready();
    await setCookie('lotbi_location_usage_v1', 'on');
    await evaluate("(() => { localStorage.removeItem('__subwayScenario'); return true; })()");
    await openLife();
    const grid = await evaluate(`(() => {
      const grid = document.querySelector('[data-site-route="life"] .consumer-shortcuts');
      const cards = [...grid.querySelectorAll('.consumer-shortcut')];
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = new Map();
      for (const card of cards) { const r = card.getBoundingClientRect(); const key = Math.round(r.top); rows.set(key, (rows.get(key) || 0) + (Math.abs(r.width - grid.getBoundingClientRect().width) < 4 ? columns : 1)); }
      return {ids: cards.map(card => card.dataset.lifeShortcut), columns, rows: [...rows.values()],
        heights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
        icon: Boolean(grid.querySelector('[data-life-shortcut="subway"] svg path')),
        label: grid.querySelector('[data-life-shortcut="subway"] span')?.textContent || ''};
    })()`);
    await check(`${label}: 지역정보 grid — 지하철 정보 after 지역뉴스, ${testCase.mobile ? 'two columns' : 'the desktop grid'}, every row full`, () => {
      assert.deepEqual(grid.ids, EXPECTED_CARDS);
      if (testCase.mobile) assert.equal(grid.columns, 2, 'phones keep two columns');
      assert.ok(grid.rows.every(count => count === grid.columns), JSON.stringify(grid));
      assert.ok(grid.heights.every(height => height >= 44), JSON.stringify(grid.heights));
      assert.equal(grid.label, '지하철 정보');
      assert.ok(grid.icon);
    });

    // 2. The card opens 지하철 정보: no chat, the current position, nearest first.
    await tapSelector('[data-site-route="life"] [data-life-shortcut="subway"]');
    let s = await settled(st => st.which === 'home' && st.groups.length === 10, '가까운 역 10곳');
    await check(`${label}: tap → /#subway, 가까운 역 from the current position; no chat, nothing typed`, () => {
      assert.equal(s.hash, '#subway');
      assert.equal(s.title, '지하철 정보');
      assert.equal(s.back, '지역정보로 돌아가기');
      assert.deepEqual(s.log.chat, [], 'no conversation request');
      assert.equal(s.prompt, '', 'nothing typed into the composer');
      const nearby = s.log.subway.filter(call => call.name === 'nearby');
      assert.equal(nearby.length, 1);
      assert.deepEqual(nearby[0].params, {latitude: '37.4979', longitude: '127.0276', radius_km: '2', limit: '10'});
      assert.ok(s.log.subway.every(call => call.credentials === 'omit' && call.mode === 'cors' && call.referrerPolicy === 'no-referrer'));
      assert.equal(s.groups[0].name, '강남');
      assert.deepEqual(s.groups[0].lines, ['2호선', '신분당선']);
      assert.equal(s.groups[0].distance, '30m');
      assert.match(s.note, /이번 검색에만 쓰고 저장하지 않아요/u);
      assert.ok(s.statusRoles);
      assert.equal(s.log.geo, 1, 'the position is read once');
    });
    await check(`${label}: 지하철 정보 — no horizontal overflow, controls ≥ 44 px, readable`, () => {
      assert.ok(s.overflow <= 0, `overflow ${s.overflow}`);
      assert.deepEqual(s.small, []);
      assert.deepEqual(s.unnamed, [], 'every control has a name a screen reader can read');
      assert.ok(s.groupsLabelled);
      assert.ok(s.groups.every(group => group.contrast >= 4.5), JSON.stringify(s.groups.map(g => g.contrast)));
    });
    await shoot('home');
    await darkCheck('home', dark => assert.ok(dark.groups.every(group => group.contrast >= 4.5), JSON.stringify(dark.groups.map(g => g.contrast))));

    // 3. 반경, 역 이름 검색, 서울시 범위 밖.
    await tapSelector('[data-site-route="subway"] [data-subway-radius="1"]');
    s = await settled(st => st.groups.length === 3, '반경 1km');
    await check(`${label}: 1km → radius_km=1 asked again`, () => {
      assert.equal(s.log.subway.filter(call => call.name === 'nearby').at(-1).params.radius_km, '1');
    });
    await evaluate(`(() => { const input = document.querySelector('[data-site-route="subway"] .subway-search-input'); input.value = '서면'; input.form.requestSubmit(); return true; })()`);
    s = await settled(st => st.status.some(text => /제공 범위에 없습니다/u.test(text)), '서면 → 범위 밖');
    await check(`${label}: 서면 (부산) → not covered, no other region's data`, () => {
      assert.equal(s.groups.length, 0);
      assert.ok(s.status.some(text => /부산·대구·광주·대전/u.test(text)), JSON.stringify(s.status));
    });
    await evaluate(`(() => { const input = document.querySelector('[data-site-route="subway"] .subway-search-input'); input.value = '강남'; input.form.requestSubmit(); return true; })()`);
    s = await settled(st => st.groups.length === 2 && st.groups[0].name === '강남', '강남 검색');
    await check(`${label}: 역 이름 검색 '강남' → the station with both lines`, () => {
      assert.deepEqual(s.groups.map(group => group.name), ['강남', '강남구청']);
      assert.deepEqual(s.groups[0].lines, ['2호선', '신분당선']);
      assert.equal(s.log.subway.filter(call => call.name === 'stations' && call.params.q === '강남').length >= 1, true);
    });

    // 4. 강남 → the station screen: 2호선 first, 방향, arrivals, position, average.
    if (testCase.mobile) {
      await tapSelector('[data-site-route="subway"] .subway-group-button[data-subway-station="1002000222"]');
    } else {
      // Keyboard: the station is a real button; Enter opens it.
      await evaluate(`(() => { document.querySelector('[data-site-route="subway"] .subway-group-button[data-subway-station="1002000222"]').focus(); return document.activeElement?.dataset.subwayStation === '1002000222'; })()`);
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r'});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13});
    }
    s = await settled(st => st.which === 'station' && st.arrivals.length === 4 && st.averageRows.length === 2, '강남 2호선');
    await check(`${label}: 강남 → /#subway-station, 2호선 arrivals as Seoul said them`, () => {
      assert.equal(s.hash, '#subway-station');
      assert.equal(s.title, '강남역');
      assert.equal(s.back, '지하철 정보로 돌아가기');
      assert.deepEqual(s.lineChips, [{line: '2호선', pressed: 'true'}, {line: '신분당선', pressed: 'false'}]);
      assert.deepEqual(s.directionChips.map(chip => chip.label), ['전체 방향', '내선 · 역삼방면', '외선 · 교대방면']);
      assert.deepEqual(s.arrivals.map(item => item.direction), ['INNER', 'INNER', 'OUTER', 'OUTER']);
      assert.equal(s.arrivals[0].line, '성수행 - 역삼방면');
      assert.equal(s.arrivals[0].message, '2분 후 (교대)');
      assert.equal(s.arrivals[0].meta, '지금 기준 약 1분 15초 남음 · 정보 생성 07:59:40 (20초 전)');
      assert.equal(s.arrivals[0].position, '열차 위치: 교대 출발 · 07:59:48 수신');
      assert.equal(s.arrivals[2].message, '강남 진입');
      assert.deepEqual(s.arrivals[3].tags, ['막차']);
      assert.match(s.checked, /^마지막 확인 08:00:00/u);
      assert.ok(s.refreshVisible);
      assert.match(s.realtimeSource, /서울특별시 지하철 실시간 도착정보\(서울 열린데이터광장\)/u);
      assert.deepEqual(s.log.chat, []);
    });
    await check(`${label}: 평균 혼잡도 is a past average, never real time`, () => {
      assert.equal(s.averageTitle, '시간대별 평균 혼잡도 (과거 자료)');
      assert.match(s.averageNotice, /실제 혼잡도가 아닙니다/u);
      assert.match(s.averageNotice, /칸별 실시간 혼잡도는 제공하지 않습니다/u);
      assert.match(s.averageScale, /34%.*100%.*안전 여부를 뜻하지 않습니다/u);
      assert.match(s.averageSource, /^출처: 서울교통공사_지하철혼잡도정보\(서울교통공사\) · 2026년 6월 \(2026년 2분기\) 자료 · 공공데이터포털$/u);
      assert.match(s.averageScale, /막대의 세로 눈금은 34%와 100%예요/u);
      assert.ok(s.slotVisible && /^\d{2}:\d{2}$/u.test(s.slot), s.slot);
      assert.deepEqual(s.averageRows.map(row => row.direction), ['INNER', 'OUTER']);
      assert.ok(s.averageRows.every(row => /^\d+\.\d%$/u.test(row.value)), JSON.stringify(s.averageRows));
    });
    await check(`${label}: 역 화면 — no horizontal overflow, controls ≥ 44 px, readable`, () => {
      assert.ok(s.overflow <= 0, `overflow ${s.overflow}`);
      assert.deepEqual(s.small, []);
      assert.deepEqual(s.unnamed, [], 'every control has a name a screen reader can read');
      assert.ok(s.groupsLabelled, '호선 · 방향 · 요일 groups are named');
      assert.ok(s.arrivals.every(item => item.contrast >= 4.5 && item.metaContrast >= 4.5), JSON.stringify(s.arrivals.map(a => [a.contrast, a.metaContrast])));
    });
    await shoot('station');
    await evaluate("(() => { document.querySelector('[data-site-route=\"subway-station\"] .subway-average')?.scrollIntoView({block: 'start'}); return true; })()");
    await shoot('average');
    await darkCheck('station', dark => assert.ok(dark.arrivals.every(item => item.contrast >= 4.5 && item.metaContrast >= 4.5), JSON.stringify(dark.arrivals.map(a => [a.contrast, a.metaContrast]))));

    // 5. 방향 · 요일 · 시간대.
    await tapSelector('[data-site-route="subway-station"] [data-subway-direction="OUTER"]');
    s = await settled(st => st.arrivals.length === 2 && st.averageRows.length === 1, '외선');
    await check(`${label}: 외선 → only 외선 trains and the 외선 average`, () => {
      assert.ok(s.arrivals.every(item => item.direction === 'OUTER'));
      assert.equal(s.averageRows[0].direction, 'OUTER');
    });
    await tapSelector('[data-site-route="subway-station"] [data-subway-day="saturday"]');
    s = await settled(st => st.log.subway.some(call => call.name === 'congestion-average' && call.params.day === 'saturday') && st.dayChips.find(c => c.day === 'saturday')?.pressed === 'true', '토요일');
    await evaluate(`(() => { const select = document.querySelector('[data-site-route="subway-station"] [data-subway-slot]'); select.value = '08:00'; select.dispatchEvent(new Event('change')); return true; })()`);
    s = await settled(st => st.slot === '08:00', '08:00');
    const saturday = FIXTURE.congestion_gangnam_2_saturday.series.find(item => item.direction_code === 'OUTER').values[5];
    await check(`${label}: 토요일 08:00 외선 = the published Seoul Metro value`, () => {
      assert.equal(s.averageRows[0].value, `${saturday.toFixed(1)}%`);
    });

    // 6. Another line of the same station; the line without averages says so.
    await tapSelector('[data-site-route="subway-station"] [data-subway-line-choice="1077"]');
    s = await settled(st => st.lineChips.some(c => c.line === '신분당선' && c.pressed === 'true') && st.arrivals.length === 1 && st.status.some(t => /1~8호선/u.test(t)), '신분당선');
    await check(`${label}: 신분당선 → its own arrivals; averages only for 서울교통공사 1~8호선`, () => {
      assert.equal(s.arrivals[0].line, '광교행 - 양재방면');
      assert.equal(s.arrivals[0].message, '신논현 출발');
      assert.equal(s.averageRows.length, 0);
      assert.ok(!s.slotVisible);
      assert.equal(s.log.subway.filter(call => call.name === 'arrivals').at(-1).params.station_id, '1077000687');
    });

    // 7. Reload keeps the station and line; it never asks for the location.
    const geoBefore = (await snapshot()).log.geo;
    await reload();
    s = await settled(st => st.which === 'station' && st.arrivals.length === 1, 'reload station');
    await check(`${label}: reload /#subway-station → 강남 신분당선 again, no location read`, () => {
      assert.equal(s.hash, '#subway-station');
      assert.equal(s.title, '강남역');
      assert.ok(s.lineChips.some(c => c.line === '신분당선' && c.pressed === 'true'), JSON.stringify(s.lineChips));
      assert.equal(s.log.geo, 0, `no geolocation after reload (before ${geoBefore})`);
      assert.equal(s.log.subway.filter(call => call.name === 'nearby').length, 0);
    });

    // 8. System back: station → 지하철 정보 → 지역정보 → home.
    await back();
    s = await settled(st => st.hash === '#subway' && st.which === 'home' && st.groups.length === 2, 'back → 지하철 정보');
    await check(`${label}: back → /#subway (지하철 정보), its search kept`, () => {
      assert.equal(s.title, '지하철 정보');
      assert.deepEqual(s.groups.map(group => group.name), ['강남', '강남구청']);
      assert.equal(s.log.geo, 0, 'a back step never asks for the location');
    });
    await back();
    s = await settled(st => st.hash === '#life' && st.lifeVisible && !st.open, 'back → 지역정보');
    await check(`${label}: back → /#life (지역정보)`, () => assert.equal(s.hash, '#life'));
    await back();
    s = await settled(st => st.hash === '' && !st.open && !st.lifeVisible, 'back → home');
    await check(`${label}: back → home`, () => assert.equal(s.hash, ''));

    // 9. Forward twice and the screen's ←: the same steps, URL and screen together.
    await evaluate('(() => { history.forward(); return true; })()');
    await settled(st => st.hash === '#life' && st.lifeVisible, 'forward → 지역정보');
    await evaluate('(() => { history.forward(); return true; })()');
    await settled(st => st.hash === '#subway' && st.which === 'home', 'forward → 지하철 정보');
    await evaluate('(() => { history.forward(); return true; })()');
    s = await settled(st => st.hash === '#subway-station' && st.which === 'station' && st.arrivals.length === 1, 'forward → 역');
    await tapSelector('[data-site-route="subway-station"] .site-modal-close');
    s = await settled(st => st.hash === '#subway' && st.which === 'home', '← → 지하철 정보');
    await check(`${label}: forward reopens the station; its ← lands on 지하철 정보`, () => assert.equal(s.title, '지하철 정보'));

    if (testCase.full) {
      // 10. Each real-time state says what happened (Core's own answers).
      const expectations = {
        not_ready: /서울시 연결을 준비하고 있어요/u,
        stale: /오래되었거나 생성 시각이 올바르지 않아.*마지막 공식 정보 생성 \d{2}:\d{2}:\d{2}/u,
        empty: /도착 예정 열차가 없습니다/u,
        unavailable: /연결할 수 없습니다/u,
        quota: /조회 가능한 실시간 정보 횟수를 넘었습니다/u,
        network_error: /도착정보를 불러오지 못했어요/u,
      };
      for (const [scenario, pattern] of Object.entries(expectations)) {
        await setScenario(scenario);
        await tapSelector('[data-site-route="subway"] .subway-group-button[data-subway-station="1002000222"]');
        s = await settled(st => st.which === 'station' && st.status.some(text => pattern.test(text)), `scenario ${scenario}`);
        await check(`${label}: ${scenario} → says so, shows no train, keeps the average`, () => {
          assert.equal(s.arrivals.length, 0);
          assert.equal(s.averageRows.length, 2, 'the past average still shows');
          if (scenario === 'not_ready') assert.ok(!s.refreshVisible, 'nothing to refresh before the link exists');
        });
        await tapSelector('[data-site-route="subway-station"] .site-modal-close');
        await settled(st => st.hash === '#subway' && st.which === 'home', `${scenario} ←`);
      }
      await evaluate("(() => { localStorage.removeItem('__subwayScenario'); return true; })()");

      // 11. LOTBI location setting off: no position is read, search works.
      await setCookie('lotbi_location_usage_v1', 'off');
      await navigate(`${origin}/`);
      await ready();
      await openLife();
      await tapSelector('[data-site-route="life"] [data-life-shortcut="subway"]');
      s = await settled(st => st.which === 'home' && /위치 사용이 꺼져 있어/u.test(st.note), 'location off');
      await check(`${label}: location setting off → no nearby call, no position read, search offered`, () => {
        assert.equal(s.log.geo, 0);
        assert.equal(s.log.subway.filter(call => call.name === 'nearby').length, 0);
        assert.equal(s.groups.length, 0);
      });
      await setCookie('lotbi_location_usage_v1', 'on');
    }
    assert.deepEqual(errors, [], `${label}: page errors`);
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.subway-life-info-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const only = process.env.SUBWAY_CASE || '';
  for (const testCase of CASES) {
    if (only && testCase.label !== only) continue;
    await runCase(browser, origin, dir, testCase);
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}
console.log(`SUBWAY-LIFE-INFO-P0 OK — ${passed} checks (지역정보 → 지하철 정보 → 역; official real-time words, past averages labelled as such; viewport emulation, not a device run)`);
