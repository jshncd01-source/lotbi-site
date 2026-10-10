// REGIONAL-INFO-BACK-NAVIGATION-01 — 지역정보 steps back one screen at a time.
//
// Owner report 2026-10-10 17:01 (Samsung Internet, phone): 지역정보 → 내 아이
// 학교·유치원 → back went to the home instead of 지역정보. The screens inside
// 지역정보 (병원·응급실, 지역뉴스, 지역생활정보, 내 아이 학교·유치원 and its 내 아이
// 정보 / 유치원·학교 찾기) changed inside one surface without a history entry,
// and 온누리상품권·지역화폐 shared the 'life' route, so one back left 지역정보.
//
// Contract checked here:
// * every screen inside 지역정보 has a route (site-route.js) and a parent
//   (LIFE_VIEW_PARENT): 하위 → 카테고리 → 지역정보 → home
// * for every category that opens a screen (병원·응급실, 지역뉴스, 지역생활정보,
//   내 아이 학교·유치원, 축제·행사, 전기차 충전소, 지하철 정보, 온누리상품권·지역화폐,
//   부동산 실거래가): the browser/system back shows the 지역정보 list, a second
//   back the home; the header ← does the same in one history step (the entry
//   index goes down by one — no new entry)
// * 내 아이 정보 / 유치원·학교 찾기: back → 내 아이 학교·유치원 → 지역정보 → home, by
//   the system back, the header ←, the '…로 돌아가기' button and Escape; forward
//   reopens the screen; a reload keeps the screen and back still steps up
// * the URL always names the screen on view (history state matches)
//
// Browser: real Chrome through the DevTools protocol, 360×780 (Samsung
// Internet UA), 390×844 (iPhone UA) and 1280×900. The browser back is
// Page.navigateToHistoryEntry — the same history step the Android/Samsung
// back button takes. Viewport emulation only — not a device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

// ── Pure contract ───────────────────────────────────────────────────────
const {SITE_ROUTES, isSiteRoute} = await import('../site-route.js');
const sections = await import('../site-consumer-sections.js');
const LIFE_VIEWS = ['life-medical', 'life-news', 'life-local', 'life-my-child', 'life-my-child-info', 'life-education'];

await check('every screen inside 지역정보 is a route with a parent; chains end at 지역정보', () => {
  assert.deepEqual(Object.keys(sections.LIFE_VIEW_PARENT), LIFE_VIEWS);
  for (const view of LIFE_VIEWS) {
    assert.ok(isSiteRoute(view), view);
    let at = view;
    const seen = new Set();
    while (at !== 'life') { assert.ok(!seen.has(at), `${view}: loop`); seen.add(at); at = sections.LIFE_VIEW_PARENT[at]; assert.ok(at, `${view}: no parent`); }
  }
  assert.equal(sections.LIFE_VIEW_PARENT['life-my-child-info'], 'life-my-child');
  assert.equal(sections.LIFE_VIEW_PARENT['life-education'], 'life-my-child');
  assert.equal(sections.lifeBackLabel('life-education'), '내 아이 학교·유치원으로 돌아가기');
  assert.equal(sections.lifeBackLabel('life-my-child'), '지역정보로 돌아가기');
  assert.ok(SITE_ROUTES.includes('onnuri'), '온누리상품권·지역화폐 has its own route');
  assert.deepEqual(SITE_ROUTES.slice(SITE_ROUTES.indexOf('life'), SITE_ROUTES.indexOf('life') + 7), ['life', ...LIFE_VIEWS]);
});

await check('the conversation opens every life route and 온누리 steps back to 지역정보', () => {
  const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
  const start = conversation.indexOf('const siteRouteOpeners = {');
  const table = conversation.slice(start, conversation.indexOf('};', start));
  for (const view of ['life', ...LIFE_VIEWS]) assert.match(table, new RegExp(`'?${view}'?: \\(\\) => openLifeView\\('${view}'\\)`, 'u'), view);
  assert.match(table, /onnuri: \(\) => openOnnuri\(\)/u);
  assert.match(conversation, /workspace: 'life', route: 'onnuri', backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\), backRoute: 'life'/u);
  assert.match(conversation, /requestLifeBack: \(parent, apply\) => leaveSiteRoute\(parent, /u, 'an in-panel step back goes through history first');
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
  throw new Error('Chrome/Chromium is required for the 지역정보 back navigation validation.');
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

// Fake Account status + Core for an anonymous reader: no Core data is needed —
// each screen's own reads get an empty or refused answer and say so.
const MOCK = `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

const CASES = [
  {label: 'samsung-360x780', width: 360, height: 780, mobile: true, userAgent: SAMSUNG_UA, full: true},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, full: true},
];

// Category cards that open a screen (약국 asks at once and opens none).
const CATEGORIES = [
  {card: 'medical', hash: '#life-medical', detail: 'medical'},
  {card: 'news', hash: '#life-news', detail: 'news'},
  {card: 'local', hash: '#life-local', detail: 'local'},
  {card: 'my-child', hash: '#life-my-child', detail: 'my-child-choice'},
  {card: 'festivals', hash: '#festival'},
  {card: 'ev-chargers', hash: '#ev-chargers'},
  {card: 'subway', hash: '#subway'},
  {card: 'onnuri', hash: '#onnuri'},
  {card: 'real-estate', hash: '#real-estate'},
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

// In the page: which screen is on view and what the URL names.
const SNAPSHOT = `(() => {
  const surface = document.querySelector('[data-site-route]');
  const detail = surface?.querySelector('.consumer-life-detail');
  const grid = surface?.querySelector('.consumer-shortcuts');
  const inner = detail?.querySelector(':scope > .consumer-action-secondary');
  return {
    hash: location.hash,
    route: surface?.dataset.siteRoute || '',
    workspace: surface?.dataset.workspace || '',
    grid: Boolean(grid && !detail && grid.getClientRects().length && grid.querySelectorAll('.consumer-shortcut').length >= 10),
    detail: detail?.dataset.lifeDetail || '',
    title: detail?.querySelector('h3')?.textContent || surface?.querySelector('.site-modal-header h2')?.textContent || '',
    headerBack: surface?.querySelector('.site-modal-close')?.getAttribute('aria-label') || '',
    innerBack: inner?.textContent || '',
    home: !surface && !document.body.classList.contains('site-workspace-open'),
    focusedCard: document.activeElement?.dataset?.lifeShortcut || document.activeElement?.dataset?.childChoice || '',
  };
})()`;

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const label = testCase.label;
  const log = [];
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
    // No location prompt in this run (전기차·지하철 ask on open): refused.
    await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});

    const loadEvent = () => new Promise(resolve => {
      const stop = cdp.on(message => { if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); } });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    const navigate = async url => { const loaded = loadEvent(); await page('Page.navigate', {url}); await loaded; };
    const ready = () => waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${label}: page ready`, 30000);
    const snapshot = () => evaluate(SNAPSHOT);
    const historyIndex = async () => (await page('Page.getNavigationHistory')).currentIndex;
    // The browser / Android / Samsung Internet back and forward.
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
    // A screen is settled when it is on view and the URL names it.
    const at = (expect, what, timeoutMs = 20000) => waitFor(async () => {
      const s = await snapshot();
      const named = s.home ? s.hash === '' : s.hash === `#${s.route}`;
      return named && expect(s) ? s : {ok: false, s};
    }, `${label}: ${what}`, timeoutMs);
    const atLife = what => at(s => s.route === 'life' && s.grid, `${what} → 지역정보 list`);
    const atHome = what => at(s => s.home, `${what} → home`);
    const atScreen = (category, what) => at(s => s.hash === category.hash && (!category.detail || s.detail === category.detail), `${what} → ${category.hash}`);
    const openLife = async () => {
      if (testCase.mobile) {
        await tapSelector('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), `${label}: drawer`);
        await sleep(150);
        await tapSelector('#mobile-nav-drawer [data-consumer-section="life"]');
      } else {
        await tapSelector('.chat-sidebar-desktop [data-consumer-section="life"]');
      }
      return atLife('open 지역정보');
    };
    const headerBack = () => tapSelector('[data-site-route] .site-modal-close');
    const innerBack = () => tapSelector('[data-site-route] .consumer-life-detail > .consumer-action-secondary');

    await navigate(`${origin}/`);
    await ready();

    // 1. Every category: system back → 지역정보 list → home; header ← → 지역정보 in one step.
    for (const category of CATEGORIES) {
      await openLife();
      await tapSelector(`[data-site-route="life"] [data-life-shortcut="${category.card}"]`);
      await atScreen(category, `${category.card} opens`);
      await go(-1);
      const back = await atLife(`${category.card}: system back`);
      assert.equal(back.focusedCard === category.card || back.focusedCard === '', true, `${label}: ${category.card}: focus ${back.focusedCard}`);
      await go(-1);
      await atHome(`${category.card}: second system back`);
      await openLife();
      await tapSelector(`[data-site-route="life"] [data-life-shortcut="${category.card}"]`);
      const screen = await atScreen(category, `${category.card} opens again`);
      if (category.detail) assert.equal(screen.headerBack, '지역정보로 돌아가기', `${label}: ${category.card}: header ← names its step`);
      const before = await historyIndex();
      await headerBack();
      await atLife(`${category.card}: header ←`);
      assert.equal(await historyIndex(), before - 1, `${label}: ${category.card}: ← stepped back one entry (no new entry)`);
      await headerBack();
      await atHome(`${category.card}: header ← on 지역정보`);
      log.push(category.card);
    }

    // 2. 내 아이 학교·유치원 → 유치원·학교 찾기 / 내 아이 정보: one step at a time.
    const myChild = CATEGORIES.find(category => category.card === 'my-child');
    const SUBS = [
      {choice: 'education', hash: '#life-education', detail: 'education'},
      {choice: 'my-child', hash: '#life-my-child-info', detail: 'my-child'},
    ];
    for (const sub of SUBS) {
      // System back: sub → 내 아이 학교·유치원 → 지역정보 → home; forward reopens.
      await openLife();
      await tapSelector('[data-site-route="life"] [data-life-shortcut="my-child"]');
      await atScreen(myChild, 'my-child');
      await tapSelector(`[data-site-route="life-my-child"] [data-child-choice="${sub.choice}"]`);
      const opened = await atScreen(sub, `${sub.choice} opens`);
      assert.equal(opened.innerBack, '내 아이 학교·유치원으로 돌아가기', `${label}: ${sub.choice}: inner back names its parent`);
      assert.equal(opened.headerBack, '내 아이 학교·유치원으로 돌아가기', `${label}: ${sub.choice}: header ← names its parent`);
      await go(-1);
      const choice = await atScreen(myChild, `${sub.choice}: system back`);
      assert.equal(choice.focusedCard, sub.choice, `${label}: focus returns to ${sub.choice}`);
      await go(1);
      await atScreen(sub, `${sub.choice}: forward`);
      await go(-1);
      await atScreen(myChild, `${sub.choice}: back again`);
      await go(-1);
      await atLife(`${sub.choice}: back from 내 아이 학교·유치원`);
      await go(-1);
      await atHome(`${sub.choice}: back from 지역정보`);
      // Header ←: the same three steps, each one history entry back.
      await openLife();
      await tapSelector('[data-site-route="life"] [data-life-shortcut="my-child"]');
      await atScreen(myChild, 'my-child (←)');
      await tapSelector(`[data-site-route="life-my-child"] [data-child-choice="${sub.choice}"]`);
      await atScreen(sub, `${sub.choice} opens (←)`);
      let before = await historyIndex();
      await headerBack();
      await atScreen(myChild, `${sub.choice}: header ←`);
      assert.equal(await historyIndex(), before - 1, `${label}: ${sub.choice}: ← one entry back`);
      before = await historyIndex();
      await headerBack();
      await atLife(`${sub.choice}: header ← on 내 아이 학교·유치원`);
      assert.equal(await historyIndex(), before - 1, `${label}: my-child: ← one entry back`);
      await headerBack();
      await atHome(`${sub.choice}: header ← on 지역정보`);
      // '…로 돌아가기' inside the screen: the same steps.
      await openLife();
      await tapSelector('[data-site-route="life"] [data-life-shortcut="my-child"]');
      await atScreen(myChild, 'my-child (button)');
      await tapSelector(`[data-site-route="life-my-child"] [data-child-choice="${sub.choice}"]`);
      await atScreen(sub, `${sub.choice} opens (button)`);
      before = await historyIndex();
      await innerBack();
      await atScreen(myChild, `${sub.choice}: 내 아이 학교·유치원으로 돌아가기`);
      assert.equal(await historyIndex(), before - 1, `${label}: ${sub.choice}: button one entry back`);
      await innerBack();
      await atLife(`${sub.choice}: 지역정보로 돌아가기`);
      await headerBack();
      await atHome(`${sub.choice}: done`);
    }

    // 3. Escape (desktop) and a reload keep the same rule.
    if (testCase.full) {
      await openLife();
      await tapSelector('[data-site-route="life"] [data-life-shortcut="my-child"]');
      await atScreen(myChild, 'my-child (reload)');
      await tapSelector('[data-site-route="life-my-child"] [data-child-choice="education"]');
      await atScreen(SUBS[0], 'education (reload)');
      if (!testCase.mobile) {
        await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        await atScreen(myChild, 'education: Escape');
        await go(1);
        await atScreen(SUBS[0], 'education: forward after Escape');
      }
      const loaded = loadEvent();
      await page('Page.reload', {ignoreCache: false});
      await loaded;
      await ready();
      const reloaded = await atScreen(SUBS[0], 'education: reload keeps the screen');
      assert.equal(reloaded.innerBack, '내 아이 학교·유치원으로 돌아가기');
      await go(-1);
      await atScreen(myChild, 'education: back after the reload');
      await go(-1);
      await atLife('my-child: back after the reload');
      await go(-1);
      await atHome('지역정보: back after the reload');
      // A typed URL of a screen inside 지역정보 opens it; ← then steps to its parent.
      await navigate(`${origin}/#life-my-child-info`);
      await ready();
      await atScreen(SUBS[1], 'direct /#life-my-child-info');
      await headerBack();
      await atScreen(myChild, 'direct URL: ←');
      await headerBack();
      await atLife('direct URL: ← ←');
    }
    assert.deepEqual(errors, [], `${label}: page errors`);
    return log;
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.regional-info-back-'));
const server = startServer();
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const testCase of CASES) {
    await check(`${testCase.label}: every 지역정보 screen steps back one screen at a time`, async () => {
      const done = await runCase(browser, origin, workDir, testCase);
      console.log(`REGIONAL_INFO_BACK ${testCase.label}`, JSON.stringify(done));
    });
  }
} finally {
  server.kill();
  await sleep(300);
  fs.rmSync(workDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}
console.log(`REGIONAL-INFO-BACK-NAVIGATION-01 PASS (${passed} checks) — viewport emulation, not a device run`);
