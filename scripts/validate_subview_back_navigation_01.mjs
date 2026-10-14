// SUBVIEW-BACK-NAVIGATION-01 — the phone's back steps one in-screen layer at a time.
//
// Owner (2026-10-10): "어떤 페이지를 가도 뒤로가기가 한 단계씩". A screen's own
// detail view (Life Wallet 카드·통관부호 상세, 안심케어 사람 수정·등록, 반려동물
// 상세·등록, 축제 상세·프로그램, 내 아이 학교·유치원 상세·추가, 캘린더 날짜·기록·
// 금액 창) changed inside its screen with no history entry, so back left the
// whole screen. Each marks its own back / close control with data-subview-back
// (a modal bottom sheet's dismiss counts the same); site-conversation.js keeps
// one history entry (same URL) per such control on view.
//
// Contract checked here:
// * static: every listed control carries the mark (one per layer); the
//   부동산 apartment (a route of its own) does not; the shell's hooks and the
//   html[data-subview-back-shell] feature mark exist
// * a layer in a real workspace (지역정보): opening it adds one entry, the URL
//   stays; the browser/system back closes it and keeps the screen (index back
//   to where it was); the header ←, Escape and the layer's own control do the
//   same in one step; two layers take two steps; a reload drops the entry the
//   layer had; the next back after a layer still leaves the screen one step
// * a modal bottom sheet over a screen: back closes the sheet only
// * real modules: 축제·행사 card [프로그램] (its program screen) and [접수] (a
//   popup) → back → the festival list (Core answers faked here; a card's image
//   is a link out, and the festival detail opens only from 캘린더, so its mark
//   is checked statically); 캘린더 설정 and '+ 기록' → back → the calendar
//
// Browser: real Chrome (DevTools protocol), 360×780 Samsung Internet UA and
// 1280×900. The back is Page.navigateToHistoryEntry — the same history step
// the Android / Samsung back button takes. Viewport emulation, not a device run.
// Life Wallet, 안심케어 and 반려동물 details need a signed-in account and its
// data: their marks are checked statically here (NOT_VERIFIED in a browser).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

// ── Static contract ─────────────────────────────────────────────────────
const marks = text => (text.match(/dataset\.subviewBack = ''/gu) || []).length;
await check('each in-screen layer marks its own back / close control, one per layer', () => {
  const wallet = read('site-life-wallet.js');
  assert.equal(marks(wallet), 3, 'Life Wallet: add-limit, card detail, 통관부호 detail');
  assert.match(wallet, /function renderDetail\(card\) \{[\s\S]{0,300}?toList\.dataset\.subviewBack = ''/u);
  assert.match(wallet, /function renderCustomsDetail\(customs\) \{[\s\S]{0,300}?toList\.dataset\.subviewBack = ''/u);
  const person = read('site-person-ui.js');
  assert.equal(marks(person), 2, '안심케어 사람: the back bar and 등록 취소');
  assert.match(person, /const backBar = [^\n]*back\.dataset\.subviewBack = ''/u);
  assert.match(person, /cancel\.dataset\.personRegistrationCancel = '';\s*cancel\.dataset\.subviewBack = ''/u);
  const pet = read('site-pet-ui.js');
  assert.equal(marks(pet), 2, '반려동물: detail back and registration back');
  assert.match(pet, /back\.dataset\.petBackToList = '';\s*back\.dataset\.subviewBack = ''/u);
  assert.match(pet, /back\.dataset\.petRegisterBack = '';\s*back\.dataset\.subviewBack = ''/u);
  const festival = read('site-festival-ui.js');
  assert.equal(marks(festival), 2, '축제: program back and detail back');
  const child = read('site-life-my-child.js');
  assert.equal(marks(child), 3, '내 아이: add, overview and its edit (취소 → overview)');
  const calendar = read('site-calendar-manager.js');
  // CALENDAR-DESIGN-04 adds two: the shared close of its dialogs (일정 상세 ·
  // 지출 내역 · 사진 확인) and the 취소 of its delete confirmation.
  assert.equal(marks(calendar), 9, '캘린더: day sheet, settings, readonly, editor, delete confirm, photo confirm, amount, design-04 dialog close, design-04 delete confirm');
  for (const cls of ['calendar-day-close', 'calendar-settings-close', 'calendar-readonly-done', 'calendar-editor-close', 'calendar-delete-confirm-cancel', 'calendar-photo-confirm-close', 'calendar-amount-close']) {
    assert.match(calendar, new RegExp(`'${cls}'[^\\n]*\\n(?:[^\\n]*\\n){0,2}[^\\n]*\\.dataset\\.subviewBack = ''`, 'u'), cls);
  }
  assert.equal(marks(read('site-life-education.js')), 1, '학교·유치원 찾기: 유치원 상세 → 유치원 목록으로');
  // 부동산's apartment is a route of its own (real-estate-apartment), not a layer.
  assert.equal(marks(read('site-life-real-estate.js')), 0);
});

await check('the shell keeps one entry per layer and walks route steps over them', () => {
  const conversation = read('site-conversation.js');
  assert.ok(conversation.includes(`const SUBVIEW_BACK_SELECTOR = '[data-subview-back], [data-lotbi-sheet][aria-modal="true"] [data-lotbi-sheet-dismiss]';`));
  assert.match(conversation, /window\.addEventListener\('popstate', \(\) => \{\s*if \(handleSubviewPopState\(\)\) return;/u, 'a step over a layer entry is handled first');
  assert.equal((conversation.match(/takeSubviewDepth\(\)/gu) || []).length, 3, 'collapse, life chain and leave also walk over the layer entries');
  assert.match(conversation, /document\.documentElement\.dataset\.subviewBackShell = '';/u, 'feature mark for module styles');
  assert.match(conversation, /new MutationObserver\(queueSubviewSync\)\.observe\(document\.body,/u);
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
  throw new Error('Chrome/Chromium is required for the subview back validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
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

// Fake Account status + Core for an anonymous reader; 축제·행사 answers one
// published festival (the shape validate_festival_event_08_responsive_a11y_01 uses).
const MOCK = `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const day = offset => { const d = new Date(Date.now() + offset * 86400000); return d.toISOString().slice(0, 10); };
  const festival = () => ({
    festival_id: 'fest_demo', name: '가을 억새 축제', start_date: day(0), end_date: day(2),
    region_name: '서울특별시', address: '서울특별시 영등포구 여의동로 330', latitude: 37.52, longitude: 126.93,
    homepage_url: 'https://official.example.com/festival', telephone: '02-000-0000', status: 'PUBLISHED',
    // The real Core contract (site-festival-client.js normalizeFestivalProgram):
    // program_name / start_date / venue / reservation_url. A card shows
    // [프로그램] only for a festival whose detail has programs, and [접수] only
    // when one carries a reservation_url — so the second one is there on purpose.
    programs: [
      {program_name: '개막 공연', category: '공연', start_date: day(0), start_time: '18:00', end_time: '19:00', venue: '주무대'},
      {program_name: '체험 부스', category: '체험', start_date: day(0), end_date: day(2), start_time: '10:00', end_time: '17:00', venue: '체험존', reservation_url: 'https://example.com/join'},
    ],
    transport: {parking: '유료 주차장 이용'}, notices: [],
  });
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (url.pathname.endsWith('/festivals/regions')) return json({regions: [{region_name: '서울특별시'}]});
    if (url.pathname.endsWith('/festivals/browse')) {
      const f = festival();
      return json({festivals: [{festival_id: f.festival_id, name: f.name, start_date: f.start_date, end_date: f.end_date,
        region_name: f.region_name, address: f.address, latitude: f.latitude, longitude: f.longitude, distance_km: null,
        status: f.status, homepage_url: f.homepage_url}], result_count: 1, total_count: 1, limit: 20, offset: 0, next_offset: null, has_more: false});
    }
    if (/\\/festivals\\/fest_demo$/u.test(url.pathname)) return json({festival: festival()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const CASES = [
  {label: 'samsung-360x780', width: 360, height: 780, mobile: true, userAgent: SAMSUNG_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
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

const SNAPSHOT = `(() => {
  const surface = document.querySelector('[data-site-route]');
  const shown = selector => { const node = document.querySelector(selector); return Boolean(node && node.isConnected && !node.closest('[hidden]') && node.getClientRects().length); };
  return {
    hash: location.hash, route: surface?.dataset.siteRoute || '',
    home: !surface && !document.body.classList.contains('site-workspace-open'),
    shell: document.documentElement.hasAttribute('data-subview-back-shell'),
    fakeList: shown('#fake-open'), fakeDetail: shown('#fake-detail'), fakeInner: shown('#fake-inner'),
    sheet: Boolean(document.querySelector('[data-lotbi-sheet][aria-modal="true"]')),
    festivalList: shown('.festival-card-open'),
    // Not by layout: with html[data-subview-back-shell] a module may hide its
    // own back control by style and leave the header ← to press it (축제 UX).
    festivalBack: [...document.querySelectorAll('.festival-back-button[data-subview-back]')].some(node => node.isConnected && !node.closest('[hidden]')),
    calendar: Boolean(document.querySelector('[data-site-route="calendar"]')), editor: shown('.calendar-editor-close') || shown('.c4-editor'), calendarSettings: shown('.calendar-settings-close'),
  };
})()`;

// A module-like layer inside the open 지역정보 screen: list ↔ detail ↔ inner,
// each step's own control marked the way the real modules mark theirs.
const FAKE_MODULE = `(() => {
  const content = document.querySelector('[data-site-route="life"] .consumer-section-content');
  const host = document.createElement('section'); host.id = 'fake-module';
  const list = () => { const open = document.createElement('button'); open.id = 'fake-open'; open.type = 'button'; open.textContent = '상세 열기';
    open.addEventListener('click', detail); host.replaceChildren(open); };
  const detail = () => {
    const box = document.createElement('div'); box.id = 'fake-detail';
    const back = document.createElement('button'); back.id = 'fake-back'; back.type = 'button'; back.textContent = '목록으로'; back.dataset.subviewBack = '';
    back.addEventListener('click', list);
    const inner = document.createElement('button'); inner.id = 'fake-inner-open'; inner.type = 'button'; inner.textContent = '안쪽 열기';
    inner.addEventListener('click', () => {
      const layer = document.createElement('div'); layer.id = 'fake-inner';
      const close = document.createElement('button'); close.id = 'fake-inner-back'; close.type = 'button'; close.textContent = '닫기'; close.dataset.subviewBack = '';
      close.addEventListener('click', () => layer.remove());
      layer.append(close); box.append(layer);
    });
    box.append(back, inner); host.replaceChildren(box);
  };
  list(); content.append(host);
  return true;
})()`;

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const label = testCase.label;
  const done = [];
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
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});

    const loadEvent = () => new Promise(resolve => {
      const stop = cdp.on(message => { if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); } });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    const navigate = async url => { const loaded = loadEvent(); await page('Page.navigate', {url}); await loaded; };
    const ready = () => waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${label}: page ready`, 30000);
    const snapshot = () => evaluate(SNAPSHOT);
    const historyIndex = async () => (await page('Page.getNavigationHistory')).currentIndex;
    const go = async delta => {
      const {currentIndex, entries} = await page('Page.getNavigationHistory');
      const entry = entries[currentIndex + delta];
      assert.ok(entry, `${label}: history entry ${delta} from ${currentIndex}`);
      await page('Page.navigateToHistoryEntry', {entryId: entry.id});
    };
    const tapSelector = async (selector, {settle = false} = {}) => {
      const measureTap = () => evaluate(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(node => node.getClientRects().length && !node.closest('[inert]'));
        const node = nodes[nodes.length - 1]; if (!node) return null;
        node.scrollIntoView({block: 'center', inline: 'center'});
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
      })()`);
      let box = await waitFor(measureTap, `${label}: tap target ${selector}`);
      // settle: a control that moves while its screen is still filling in is not
      // tapped on a measured spot: its centre must stay put over three reads
      // 100 ms apart. Nothing is relaxed — the same tap, the same assertions.
      if (settle) {
        for (let still = 0, previous = JSON.stringify(box), guard = Date.now(); still < 3;) {
          if (Date.now() - guard > 15000) throw new Error(`${label}: tap target ${selector} never held still`);
          await sleep(100);
          const now = await measureTap();
          const key = JSON.stringify(now);
          if (now && key === previous) still += 1; else { still = 0; previous = key; if (now) box = now; }
        }
      }
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
    // Settled: the predicate holds, the URL names the screen and the history
    // index is where it should be (the shell's own steps have landed).
    const at = (expect, index, what, timeoutMs = 15000) => waitFor(async () => {
      const s = await snapshot();
      const named = s.home ? s.hash === '' : s.hash === `#${s.route}`;
      const i = await historyIndex();
      return named && expect(s) && (index === null || i === index) ? s : {ok: false, s, i, index};
    }, `${label}: ${what}`, timeoutMs);
    const openSection = async selector => {
      if (testCase.mobile) {
        await tapSelector('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), `${label}: drawer`);
        await sleep(150);
        await tapSelector(`#mobile-nav-drawer ${selector}`);
      } else {
        await tapSelector(`.chat-sidebar-desktop ${selector}`);
      }
    };
    const escape = async () => {
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    };

    await navigate(`${origin}/`);
    await ready();
    assert.equal((await snapshot()).shell, true, `${label}: html[data-subview-back-shell]`);

    // A. A layer in a real workspace (지역정보).
    await openSection('[data-consumer-section="life"]');
    await at(s => s.route === 'life', null, 'open 지역정보');
    const base = await historyIndex();
    await evaluate(FAKE_MODULE);
    const life = s => s.route === 'life' && s.hash === '#life';
    // system back
    await tapSelector('#fake-open');
    await at(s => life(s) && s.fakeDetail, base + 1, 'layer opens: one entry, same URL');
    await go(-1);
    await at(s => life(s) && s.fakeList && !s.fakeDetail, base, 'system back closes the layer, keeps 지역정보');
    done.push('back');
    // header ←
    await tapSelector('#fake-open');
    await at(s => life(s) && s.fakeDetail, base + 1, 'layer again');
    await tapSelector('[data-site-route="life"] .site-modal-close');
    await at(s => life(s) && s.fakeList, base, 'header ← closes the layer only');
    done.push('header');
    // the layer's own control
    await tapSelector('#fake-open');
    await at(s => life(s) && s.fakeDetail, base + 1, 'layer again (own)');
    await tapSelector('#fake-back');
    await at(s => life(s) && s.fakeList, base, "the layer's own 목록으로 drops its entry");
    done.push('own');
    // two layers, two steps
    await tapSelector('#fake-open');
    await at(s => life(s) && s.fakeDetail, base + 1, 'layer 1');
    await tapSelector('#fake-inner-open');
    await at(s => life(s) && s.fakeInner, base + 2, 'layer 2: a second entry');
    await go(-1);
    await at(s => life(s) && s.fakeDetail && !s.fakeInner, base + 1, 'back closes the top layer');
    await go(-1);
    await at(s => life(s) && s.fakeList, base, 'back closes the next layer');
    done.push('nested');
    if (!testCase.mobile) {
      await tapSelector('#fake-open');
      await at(s => life(s) && s.fakeDetail, base + 1, 'layer (Escape)');
      await escape();
      await at(s => life(s) && s.fakeList, base, 'Escape closes the layer only');
      done.push('escape');
    }
    // A modal bottom sheet over the screen: back closes the sheet only.
    await evaluate(`(async () => {
      const {createBottomSheet, SHEET_PRESENTATION} = await import('/site-bottom-sheet.js');
      window.__sheet = createBottomSheet({label: '시험 시트', presentation: SHEET_PRESENTATION.SHEET, content: Object.assign(document.createElement('p'), {textContent: '시트'})});
      window.__sheet.open();
      return true;
    })()`);
    await at(s => life(s) && s.sheet, base + 1, 'sheet opens: one entry');
    await go(-1);
    await at(s => life(s) && !s.sheet, base, 'back closes the sheet, keeps 지역정보');
    done.push('sheet');
    // A reload drops the entry a layer had (the layer itself is not restored).
    await tapSelector('#fake-open');
    await at(s => life(s) && s.fakeDetail, base + 1, 'layer before reload');
    const loaded = loadEvent();
    await page('Page.reload', {ignoreCache: false});
    await loaded;
    await ready();
    await at(s => life(s), base, 'after a reload the layer entry is dropped', 20000);
    done.push('reload');
    // The next back still leaves the screen one step.
    await go(-1);
    await at(s => s.home, base - 1, 'back from 지역정보 → home', 20000);

    // B. 축제·행사: the card's [프로그램] screen and [접수] popup → back → the list.
    await openSection('[data-consumer-section="life"]');
    await at(s => s.route === 'life', null, 'open 지역정보 (festival)');
    await tapSelector('[data-site-route="life"] [data-life-shortcut="festivals"]');
    await at(s => s.route === 'festival' && s.festivalList, null, 'festival list', 20000);
    const listIndex = await historyIndex();
    await tapSelector('.festival-card-action-program', {settle: true});
    await at(s => s.route === 'festival' && s.festivalBack && !s.festivalList, listIndex + 1, 'festival program screen: one entry', 20000);
    await go(-1);
    await at(s => s.route === 'festival' && s.festivalList && !s.festivalBack, listIndex, 'back from the program → the festival list');
    done.push('festival-program');
    // [접수] is a modal sheet on a phone (a layer); on a wide screen the same
    // content opens inline in the card (site-bottom-sheet.js INLINE), not a layer.
    if (testCase.mobile && await evaluate("Boolean(document.querySelector('.festival-card-action-registration'))")) {
      await tapSelector('.festival-card-action-registration', {settle: true});
      await at(s => s.route === 'festival' && (s.sheet || s.festivalBack), listIndex + 1, 'festival 접수 popup: one entry', 20000);
      await go(-1);
      await at(s => s.route === 'festival' && s.festivalList && !s.sheet && !s.festivalBack, listIndex, 'back from 접수 → the festival list');
      done.push('festival-registration');
    }
    await go(-1);
    await at(s => s.route === 'life', listIndex - 1, 'back from the festival list → 지역정보');
    await go(-1);
    await at(s => s.home, null, 'home again');

    // C. 캘린더 '기록 추가' → back → the calendar.
    await openSection('[data-calendar-view="all"]');
    await at(s => s.route === 'calendar' && s.calendar, null, 'calendar', 20000);
    const calendarIndex = await historyIndex();
    // 설정 is a layer too.
    await tapSelector('.calendar-settings-button');
    await at(s => s.route === 'calendar' && s.calendarSettings, calendarIndex + 1, 'calendar 설정: one entry', 20000);
    await go(-1);
    await at(s => s.route === 'calendar' && !s.calendarSettings, calendarIndex, 'back closes 설정, keeps the calendar');
    done.push('calendar-settings');
    // A guest picks a day first: where the day opens as a closable sheet that
    // sheet is a layer of its own; its '+ 기록' opens the editor over it.
    // Design 04 (the calendar workspace) draws month cells as .c4-mc; the day is listed in the page.
    await tapSelector('.calendar-date-trigger, .c4-mc[data-current-month="true"]', {settle: true});
    await waitFor(() => evaluate("[...document.querySelectorAll('[data-calendar-add]')].some(node => node.getClientRects().length)"), `${label}: calendar '+ 기록'`, 20000);
    const daySheet = await evaluate("Boolean(document.querySelector('.calendar-day-close'))");
    const dayIndex = calendarIndex + (daySheet ? 1 : 0);
    await at(s => s.route === 'calendar', dayIndex, `calendar day ${daySheet ? 'sheet: one entry' : 'in the page: no entry'}`, 20000);
    // The editor opens over the day — or in its place — so the entries are
    // one per layer on view; back closes the editor first, then the day sheet.
    const layersOnView = `[...document.querySelectorAll('[data-subview-back], [data-lotbi-sheet][aria-modal="true"] [data-lotbi-sheet-dismiss]')].filter(node => !node.closest('[hidden]')).length`;
    await tapSelector('[data-calendar-add]', {settle: true});
    await at(s => s.calendar && s.editor, null, 'calendar editor', 20000);
    const editorLayers = await evaluate(layersOnView);
    assert.ok(editorLayers >= 1, `${label}: the editor is a layer`);
    await at(s => s.calendar && s.editor, calendarIndex + editorLayers, `calendar editor: ${editorLayers} layer entr${editorLayers === 1 ? 'y' : 'ies'}`, 20000);
    await go(-1);
    await at(s => s.route === 'calendar' && s.calendar && !s.editor, null, 'back closes the editor, keeps the calendar');
    const dayLayers = await evaluate(layersOnView);
    await at(s => s.route === 'calendar' && !s.editor, calendarIndex + dayLayers, 'the day stays as it was under the editor');
    done.push('calendar-editor');
    if (dayLayers) {
      await go(-1);
      await at(s => s.route === 'calendar' && s.calendar, calendarIndex, 'back closes the day sheet, keeps the calendar');
      assert.equal(await evaluate(layersOnView), 0, `${label}: no layer left on the calendar`);
      done.push('calendar-day-sheet');
    }
    await go(-1);
    await at(s => s.home, calendarIndex - 1, 'back from the calendar → home');

    assert.deepEqual(errors, [], `${label}: page errors`);
    return done;
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.subview-back-'));
const server = startServer();
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const testCase of CASES) {
    await check(`${testCase.label}: one back step per in-screen layer`, async () => {
      const result = await runCase(browser, origin, workDir, testCase);
      console.log(`SUBVIEW_BACK ${testCase.label}`, JSON.stringify(result));
      assert.ok(result.includes('festival-program') && result.includes('calendar-editor'), `${testCase.label}: real modules reached ${JSON.stringify(result)}`);
    });
  }
} finally {
  server.kill();
  // Chrome may still hold its profile for a moment after it is told to quit.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); break; } catch { await sleep(300); }
  }
}
console.log(`SUBVIEW-BACK-NAVIGATION-01 PASS (${passed} checks) — viewport emulation, not a device run`);
