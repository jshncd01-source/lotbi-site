// SITE-REFRESH-ROUTE-RESTORE-01 — a reload keeps the screen the reader was on.
//
// The Site is one document (/). Its screens (캘린더 · Life Wallet · 진위확인 ·
// 안심케어 · 반려동물 · 생활정보 · 축제·행사) are surfaces over the
// conversation and are now named by the URL fragment (site-route.js), so
// reload, a typed URL, a new tab and back/forward reach the same screen.
//
// Static part: the route table, the login return allowlist (a closed set — no
// open redirect), the first-paint guard and the unchanged nginx contract.
// Browser part: real Chrome through the DevTools protocol — real reloads
// (soft and hard), history entries, direct URLs, the Account handoff that
// every signed-in reload takes (Account navigation intercepted and answered by
// this script), a frame-by-frame probe for a flash of the conversation home,
// at 375×812 and 390×844 (iPhone UA, touch) and 1280×900 (desktop).
// Viewport emulation only — not an iPhone Safari / KakaoTalk device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if (typeof globalThis.btoa !== 'function') globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Route table ─────────────────────────────────────────────────────────
const {SITE_ROUTES, isSiteRoute, parseSiteRouteHash, siteRouteHash, siteRouteUrl} = await import('../site-route.js');
const EXPECTED_ROUTES = ['calendar', 'wallet', 'scam', 'care', 'pets', 'life', 'festival'];
assert.deepEqual([...SITE_ROUTES], EXPECTED_ROUTES);
assert.ok(Object.isFrozen(SITE_ROUTES));
for (const route of SITE_ROUTES) {
  assert.equal(parseSiteRouteHash(`#${route}`), route);
  assert.equal(siteRouteHash(route), `#${route}`);
  assert.ok(isSiteRoute(route));
}
for (const none of ['', '#', undefined, null, 7]) assert.equal(parseSiteRouteHash(none), '', String(none));
for (const foreign of ['#profile-photo', '#main-content', '#does-not-exist', '#lotbi-box', '#CALENDAR', '#calendar/', '#calendar?x=1', 'calendar', '#//evil.example', '#https://evil.example', '#javascript:alert(1)']) {
  assert.equal(parseSiteRouteHash(foreign), null, String(foreign));
}
assert.equal(siteRouteHash('admin'), '');
assert.equal(siteRouteUrl('calendar', {pathname: '/', search: '?utm_source=x'}), '/?utm_source=x#calendar');
assert.equal(siteRouteUrl('', {pathname: '/', search: '?utm_source=x'}), '/?utm_source=x');

// Every route has exactly one opener in the conversation, and every routed
// surface names a route of the table.
const conversation = read('site-conversation.js');
const openersStart = conversation.indexOf('const siteRouteOpeners = {');
const openersEnd = conversation.indexOf('};', openersStart);
assert.ok(openersStart > 0 && openersEnd > openersStart, 'siteRouteOpeners table');
const openerKeys = [...conversation.slice(openersStart, openersEnd).matchAll(/^\s*'?([a-z-]+)'?: \(\) =>/gmu)].map(match => match[1]);
assert.deepEqual(openerKeys, EXPECTED_ROUTES, 'one opener per route, same order as site-route.js');
const surfaceRoutes = [...conversation.matchAll(/route: '([a-z-]+)'/gu)].map(match => match[1]);
assert.deepEqual([...new Set(surfaceRoutes)].sort(), ['calendar', 'festival', 'pets'].sort());
for (const route of surfaceRoutes) assert.ok(isSiteRoute(route), route);
assert.match(conversation, /installSurfaceBehavior\(backdrop, panel, \{workspace: section, route, onClose/u, 'wallet/care/life surfaces carry their section route');
assert.match(conversation, /const route = section === 'care' && careTab === 'pets' \? 'pets' : section;/u);
assert.match(conversation, /window\.addEventListener\('popstate', \(\) => \{/u);
assert.match(conversation, /window\.history\.pushState\(\{lotbiRoute: visible, lotbiRouteFrom: inUrl, lotbiRouteKey: key\}, '', siteRouteUrl\(visible\)\)/u);
assert.match(conversation, /routeEntriesPushedHere\.has\(entry\.lotbiRouteKey\) && entry\.lotbiRouteFrom === visible/u, 'history.back() only into an entry this document wrote');
assert.doesNotMatch(conversation, /location\.hash\s*=(?!=)/u, 'routes are written through the History API only');
const scam = read('site-scam-shield.js');
assert.match(scam, /window\.addEventListener\('lotbi:scam-shield-open-request', \(\) => \{\s*if \(dialog && !dialog\.hasAttribute\('open'\)\) void openDialog\(\);/u);
assert.match(scam, /window\.addEventListener\('lotbi:scam-shield-close-request', \(\) => \{\s*if \(dialog\?\.hasAttribute\('open'\)\) closeDialog\(\);/u);
assert.doesNotMatch(scam, /^\s*(export|import)\s/mu, 'site-scam-shield.js stays a plain script (validate_scam_shield_mvp_01 runs it in a vm)');
assert.match(scam, /dialog\.close\(\);\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*notifyScamShieldVisibility\(\);/u, 'closing 진위확인 updates the URL without waiting for a frame');

// ── Login return target: a closed set on / ──────────────────────────────
const {
  HANDOFF_CONTEXT_KEY,
  createSiteHandoffContext,
  normalizeSiteHandoffReturnHash,
  readAndClearSiteHandoffContext,
  siteHandoffReturnPath,
  storeSiteHandoffContext,
} = await import('../site-auth.js');
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
for (const route of SITE_ROUTES) {
  assert.equal(normalizeSiteHandoffReturnHash(`#${route}`), `#${route}`);
  assert.equal(siteHandoffReturnPath(`#${route}`), `/#${route}`);
}
assert.equal(siteHandoffReturnPath('#profile-photo'), '/#profile-photo');
for (const hostile of ['#lotbi-box', '#//evil.example', '//evil.example', 'https://evil.example/#calendar', '/#calendar', '#calendar?next=https://evil.example', '#calendar#x', '#javascript:alert(1)', '#unexpected', '', undefined, null, {}]) {
  assert.equal(normalizeSiteHandoffReturnHash(hostile), '', String(hostile));
  assert.equal(siteHandoffReturnPath(hostile), '/', String(hostile));
}
{
  const now = 1_800_000_000_000;
  const storage = new MemoryStorage();
  const context = await createSiteHandoffContext('', now, '#wallet');
  assert.equal(context.returnHash, '#wallet');
  storeSiteHandoffContext(context, storage);
  assert.equal(readAndClearSiteHandoffContext(context.state, storage, now + 1).returnHash, '#wallet');
  const dropped = await createSiteHandoffContext('', now, '#//evil.example');
  assert.equal(dropped.returnHash, '');
  const tampered = {...context, returnHash: '#//evil.example'};
  storage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify(tampered));
  assert.throws(() => readAndClearSiteHandoffContext(context.state, storage, now + 1), /올바르지 않습니다/u, 'a tampered stored target is refused, not followed');
}

// ── First paint, callback, server ───────────────────────────────────────
const index = read('index.html');
const guard = index.indexOf('document.documentElement.dataset.siteRoutePending');
assert.ok(guard > 0 && guard < index.indexOf('<link rel="stylesheet"'), 'the pending marker is set before the first stylesheet/paint');
assert.ok(guard < index.indexOf('<script type="module"'), 'before any module runs');
const css = read('site-conversation.css');
assert.match(css, /html\[data-site-route-pending\] #main-content > \* \{[^}]*visibility: hidden;[^}]*animation: site-route-pending-release 0s linear 8s forwards;/u);
assert.match(css, /@keyframes site-route-pending-release \{ to \{ opacity: 1; visibility: visible; \} \}/u, 'the home is never hidden for good');
assert.match(read('auth/callback/index.html'), /site-conversation\.css/u, 'the callback document carries the pending rule');
const callback = read('auth-callback.js');
const pendingAt = callback.indexOf("if (parseSiteRouteHash(context.returnHash)) document.documentElement.dataset.siteRoutePending = '';");
assert.ok(pendingAt > 0 && pendingAt < callback.indexOf('await hydrateHomeShell();'), 'callback hides the home before it is hydrated');
assert.match(callback, /\.catch\(async error => \{\s*delete document\.documentElement\.dataset\.siteRoutePending;/u);
const nginx = read('nginx/default.conf.template');
assert.match(nginx, /location \/ \{\s*try_files \$uri \$uri\/ =404;\s*\}/u, 'server routing unchanged: fragments never reach nginx');
assert.doesNotMatch(nginx, /calendar|wallet|lotbi-box/u);

console.log('SITE-REFRESH-ROUTE-RESTORE-01 static PASS');

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
  throw new Error('Chrome/Chromium is required for the route restore validation.');
}

// nginx/default.conf.template, in miniature: clean legal pages, directory
// index, try_files, otherwise 404. Documents are served byte-for-byte.
function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const clean=/^\\/(about|subscribe|refund|exchange|dispute|account-deletion|contact|terms|privacy)$/;
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const page=clean.exec(pathname); if(page) return send(res,path.join(root,page[1]+'.html'));
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.stat(target,(error,stat)=>send(res,!error&&stat.isDirectory()?path.join(target,'index.html'):target));
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

// fn resolves to true or an object when done; null/false, {ok: false, ...} or
// a thrown error (e.g. a document swap mid-evaluate) mean "not yet".
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

// Fake Account status + Core, installed before any page script on every new
// document. localStorage.__routeTestMode picks anonymous | authenticated.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const mode = () => read('__routeTestMode') || 'anonymous';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const requests = window.__routeTestRequests = [];
  let turn = 0;
  window.__routeDocId = Math.random().toString(36).slice(2);
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') {
        await sleep(Number(read('__routeTestStatusDelay') || 250));
        return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: mode() === 'authenticated'});
      }
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const auth = Boolean(headers.get('Authorization'));
    requests.push({path: url.pathname, auth});
    const expires = new Date(Date.now() + 3600e3).toISOString();
    if (url.pathname === '/v2/sessions/handoffs/redeem') return json({session_token: 's'.repeat(48), session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com', session_id: 'site-session-route', installation_id: 'installation-route-test', expires_at: expires});
    if (url.pathname === '/v2/me') return auth ? json({user: {id: 'user-route', name: '경로 테스트', email: 'route@example.test'}, session: {id: 'site-session-route', assurance_level: 'FULL', expires_at: expires}, installation: {id: 'installation-route-test'}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return auth ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: expires});
    if (url.pathname === '/v2/conversation/guest/messages') {
      turn += 1;
      await sleep(100);
      return json({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED', assistant_text: '경로 테스트 답변입니다.', response_mode: 'AI_GROUNDED_CURRENT_FACT', correlation_id: 'req_route_' + turn,
        intent: {action: 'UNKNOWN'}, follow_up: {required: false, action: 'UNKNOWN', automatic_execution: false},
        safety: {execution_authority: false, external_side_effect: false, transaction_created: false, order_created: false, payment_attempted: false, reservation_created: false, merchant_execution_started: false},
        sources: [], retry_safe: true});
    }
    return auth ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

// Frame-by-frame: while sessionStorage.__routeExpect names a screen and that
// screen is not open yet, count frames where the conversation home is painted.
const FLASH_PROBE = `(() => {
  const expected = () => { try { return window.sessionStorage.getItem('__routeExpect') || ''; } catch { return ''; } };
  const probe = window.__routeFlash = {frames: 0, homeFrames: 0, pendingFrames: 0, opened: false};
  const tick = () => {
    const want = expected();
    if (want && !probe.opened) {
      probe.frames += 1;
      const open = want === 'scam' ? document.querySelector('[data-scam-dialog]')?.open : document.querySelector('[data-site-route="' + want + '"]');
      if (open) probe.opened = true;
      else {
        const prompt = document.getElementById('lotbi-prompt');
        const block = prompt?.closest('#main-content > *');
        if (prompt && block && prompt.getClientRects().length && getComputedStyle(prompt).visibility === 'visible' && Number(getComputedStyle(block).opacity) > 0.01) probe.homeFrames += 1;
        if (document.documentElement.hasAttribute('data-site-route-pending')) probe.pendingFrames += 1;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'iPhone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];
const NAV_SELECTOR = {
  calendar: '[data-calendar-view="all"]',
  wallet: '[data-consumer-section="wallet"]',
  scam: '[data-scam-open]',
  care: '[data-consumer-section="care"]',
  life: '[data-consumer-section="life"]',
};

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
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
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

async function runCase(browser, origin, workDir, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const results = [];
  const check = (label, condition, detail) => {
    results.push(label);
    assert.ok(condition, `${testCase.label}: ${label} — ${JSON.stringify(detail)}`);
  };
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const handoffs = [];
    // Account is another origin: answer its site-handoff with the redirect it
    // would send back (same state, a fresh code) to this server's callback.
    cdp.on(message => {
      if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
      const {requestId, request} = message.params;
      const url = new URL(request.url);
      if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/auth/site-handoff') {
        handoffs.push(url.searchParams.get('state'));
        const location = `${origin}/auth/callback/?code=${'c'.repeat(48)}&state=${encodeURIComponent(url.searchParams.get('state'))}`;
        void page('Fetch.fulfillRequest', {requestId, responseCode: 302, responseHeaders: [{name: 'Location', value: location}], body: ''});
        return;
      }
      void page('Fetch.fulfillRequest', {requestId, responseCode: 404, responseHeaders: [{name: 'Content-Type', value: 'text/plain'}], body: Buffer.from('not here').toString('base64')});
    });
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://account.lotbiai.com/*', resourceType: 'Document', requestStage: 'Request'}]});
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Page.addScriptToEvaluateOnNewDocument', {source: FLASH_PROBE});
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});

    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
      return result.result.value;
    };
    const snapshot = () => evaluate(`(() => ({
      url: location.pathname + location.search + location.hash,
      ready: document.body?.dataset.conversationRestore === 'ready',
      auth: document.body?.dataset.siteAuthState || '',
      pending: document.documentElement.hasAttribute('data-site-route-pending'),
      routes: [...document.querySelectorAll('[data-site-route]')].map(node => node.dataset.siteRoute),
      scam: Boolean(document.querySelector('[data-scam-dialog]')?.open),
      scamGate: Boolean(document.querySelector('[data-scam-dialog]')?.open && !document.querySelector('[data-scam-login-gate]')?.hidden),
      scamWorkspace: Boolean(document.querySelector('[data-scam-dialog]')?.open && !document.querySelector('[data-scam-workspace]')?.hidden),
      careTab: document.querySelector('[data-site-route] [data-care-tab][aria-selected="true"]')?.dataset.careTab || '',
      surfaceText: (document.querySelector('[data-site-route]')?.textContent || '').replace(/\\s+/g, ' ').slice(0, 400),
      homeVisible: (() => { const prompt = document.getElementById('lotbi-prompt'); const block = prompt?.closest('#main-content > *'); return Boolean(prompt && block && getComputedStyle(prompt).visibility === 'visible' && Number(getComputedStyle(block).opacity) > 0.01); })(),
      docId: window.__routeDocId || '',
      flash: window.__routeFlash ? {...window.__routeFlash} : null,
      authedCoreCalls: (window.__routeTestRequests || []).filter(item => item.auth).map(item => item.path),
      thread: [...document.querySelectorAll('#conversation-thread .chat-message')].map(node => node.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(-4),
    }))()`);
    const visibleRoute = state => (state.scam ? 'scam' : state.routes.at(-1) || '');
    const settled = async (expectRoute, label, timeoutMs = 15000) => waitFor(async () => {
      const state = await snapshot();
      const ok = state.ready && !state.pending && visibleRoute(state) === expectRoute
        && (expectRoute !== 'scam' || state.scamGate || state.scamWorkspace);
      return ok ? state : {ok: false, state};
    }, label, timeoutMs);
    const expectScreen = route => evaluate(`(() => { try { sessionStorage.setItem('__routeExpect', ${JSON.stringify(route)}); } catch {} return true; })()`);
    const loadEvent = () => new Promise(resolve => {
      const stop = cdp.on(message => {
        if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); }
      });
      setTimeout(() => { stop(); resolve(); }, 8000);
    });
    const navigate = async url => { const loaded = loadEvent(); await page('Page.navigate', {url}); await loaded; };
    const reload = async ({hard = false} = {}) => { const loaded = loadEvent(); await page('Page.reload', {ignoreCache: hard}); await loaded; };
    const go = async delta => {
      const {currentIndex, entries} = await page('Page.getNavigationHistory');
      const entry = entries[currentIndex + delta];
      assert.ok(entry, `${testCase.label}: history entry ${delta} from ${currentIndex}`);
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
      })()`), `tap target ${selector}`);
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
    const openFromMenu = async route => {
      if (testCase.mobile) {
        await tapSelector('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), 'drawer open');
        await sleep(150);
        await tapSelector(`#mobile-nav-drawer ${NAV_SELECTOR[route]}`);
      } else {
        await tapSelector(`.chat-sidebar-desktop ${NAV_SELECTOR[route]}`);
      }
    };
    const closeScreen = async route => {
      if (route === 'scam') await tapSelector('[data-scam-dialog] [data-scam-close]');
      else await tapSelector(`[data-site-route="${route}"] .site-modal-close`);
    };
    const flashCheck = (state, label) => {
      check(`${label}: no home frame before the screen`, state.flash && state.flash.homeFrames === 0, state.flash);
      return evaluate("(() => { try { sessionStorage.removeItem('__routeExpect'); } catch {} return true; })()");
    };

    // CASE A — / reload stays home.
    await navigate(`${origin}/`);
    let state = await settled('', 'home');
    check('A home renders', state.homeVisible && state.url === '/' && state.auth === 'unauthenticated', state);
    let previousDoc = state.docId;
    await reload();
    state = await settled('', 'home reload');
    check('A / reload → home', state.homeVisible && state.url === '/' && state.docId !== previousDoc, state);

    // CASE B–E — each menu screen: URL follows, reload restores, closing returns home.
    for (const route of ['calendar', 'wallet', 'scam', 'care', 'life']) {
      await openFromMenu(route);
      state = await settled(route, `${route} from menu`);
      check(`${route}: menu → /#${route}`, state.url === `/#${route}`, state);
      previousDoc = state.docId;
      await expectScreen(route);
      await reload({hard: route === 'calendar'});
      state = await settled(route, `${route} reload`);
      check(`${route}: reload → same screen`, state.url === `/#${route}` && state.docId !== previousDoc, state);
      await flashCheck(state, `${route} reload`);
      if (route === 'wallet') check('wallet guest: login gate, no account data', /로그인/u.test(state.surfaceText) && state.authedCoreCalls.length === 0, state);
      if (route === 'scam') check('scam guest: login gate', state.scamGate && !state.scamWorkspace, state);
      await closeScreen(route);
      state = await settled('', `${route} closed`);
      check(`${route}: close → /`, state.url === '/' && state.homeVisible, state);
    }

    // 반려동물 tab, 축제·행사, 롯비함 — screens inside screens.
    await openFromMenu('care');
    await settled('care', 'care for pets');
    await tapSelector('[data-site-route] [data-care-tab="pets"]');
    state = await settled('pets', 'pets tab');
    check('pets: tab → /#pets (entry replaced)', state.url === '/#pets' && state.careTab === 'pets', state);
    await expectScreen('pets');
    await reload();
    state = await settled('pets', 'pets reload');
    check('pets: reload → 안심케어 반려동물 tab', state.url === '/#pets' && state.careTab === 'pets', state);
    await flashCheck(state, 'pets reload');
    await tapSelector('[data-site-route] [data-care-tab="people"]');
    state = await settled('care', 'people tab');
    check('care: people tab → /#care', state.url === '/#care' && state.careTab === 'people', state);
    await closeScreen('care');
    await settled('', 'care closed');

    await openFromMenu('life');
    await settled('life', 'life');
    await tapSelector('[data-site-route="life"] .consumer-shortcut[data-life-shortcut="festivals"]');
    state = await settled('festival', 'festival');
    check('festival: 생활정보 → 축제·행사 → /#festival', state.url === '/#festival', state);
    await expectScreen('festival');
    await reload();
    state = await settled('festival', 'festival reload');
    check('festival: reload → 축제·행사', state.url === '/#festival', state);
    await flashCheck(state, 'festival reload');
    await go(-1);
    state = await settled('life', 'back to life across the reload');
    check('festival: back → 생활정보', state.url === '/#life', state);
    // LOTBI-BOX-HIDE-02: the former route is now a foreign fragment. It must
    // stay on the conversation home before and after reload, never opening a
    // hidden surface or creating a route entry.
    await navigate('about:blank');
    await navigate(`${origin}/#lotbi-box`);
    state = await settled('', 'hidden lotbi-box direct URL');
    check('lotbi-box hidden: direct URL → home', state.homeVisible && state.url === '/#lotbi-box' && state.routes.length === 0 && !state.surfaceText.includes('롯비함'), state);
    await reload();
    state = await settled('', 'hidden lotbi-box reload');
    check('lotbi-box hidden: reload → home', state.homeVisible && state.url === '/#lotbi-box' && state.routes.length === 0 && !state.surfaceText.includes('롯비함'), state);

    // CASE G — back/forward inside one document: no reload, the same screens.
    await navigate(`${origin}/`);
    state = await settled('', 'home for history');
    const doc = state.docId;
    const walk = [];
    const step = async (route, label) => { const s = await settled(route, label); walk.push([label, s.url, s.docId === doc]); return s; };
    if (testCase.mobile) {
      await openFromMenu('life'); await step('life', 'open life');
      await tapSelector('[data-site-route="life"] .consumer-shortcut[data-life-shortcut="festivals"]'); await step('festival', 'open festival');
    } else {
      await openFromMenu('wallet'); await step('wallet', 'open wallet');
      await openFromMenu('care'); await step('care', 'open care');
    }
    const [first, second] = testCase.mobile ? ['life', 'festival'] : ['wallet', 'care'];
    await go(-1); await step(first, 'back');
    await go(-1); await step('', 'back');
    await go(1); await step(first, 'forward');
    await go(1); state = await step(second, 'forward');
    check('G back/forward sequence', JSON.stringify(walk.map(([, url]) => url)) === JSON.stringify([`/#${first}`, `/#${second}`, `/#${first}`, '/', `/#${first}`, `/#${second}`]), walk);
    check('G no document reload on back/forward', walk.every(([, , same]) => same), walk);
    await closeScreen(second);
    if (second === 'festival') {
      // 축제·행사 ← returns to 생활정보 — the entry it was opened from.
      state = await settled('life', 'festival back arrow');
      check('G festival ← → /#life (history back, same document)', state.url === '/#life' && state.docId === doc, state);
      await closeScreen('life');
    }
    state = await settled('', 'close after forward');
    check('G close after forward → /', state.url === '/' && state.docId === doc, state);
    // Closing a screen opened from home steps back into the home entry.
    const {currentIndex: beforeOpen} = await page('Page.getNavigationHistory');
    await openFromMenu('calendar');
    await settled('calendar', 'calendar for close');
    await closeScreen('calendar');
    state = await settled('', 'calendar closed');
    const {currentIndex: afterClose} = await page('Page.getNavigationHistory');
    check('G close returns to the home entry (no extra entry)', afterClose === beforeOpen && state.docId === doc, {beforeOpen, afterClose});

    // Typed URL on the same document (address bar fragment + Enter).
    await page('Page.navigate', {url: `${origin}/#care`});
    state = await settled('care', 'typed fragment');
    check('typed /#care on the open page → 안심케어 without reload', state.url === '/#care' && state.docId === doc, state);
    await closeScreen('care');
    await settled('', 'typed closed');

    // Direct URL in a fresh document (new tab / address bar from elsewhere).
    await expectScreen('wallet');
    await navigate('about:blank');
    await navigate(`${origin}/#wallet`);
    state = await settled('wallet', 'direct wallet');
    check('direct URL /#wallet → Life Wallet', state.url === '/#wallet', state);
    await flashCheck(state, 'direct URL');

    // CASE J — query preserved; one-time ?conversation= consumed, fragment kept.
    await navigate(`${origin}/?utm_source=route-test#calendar`);
    state = await settled('calendar', 'query calendar');
    check('J query kept on load', state.url === '/?utm_source=route-test#calendar', state);
    await reload();
    state = await settled('calendar', 'query reload');
    check('J query kept on reload', state.url === '/?utm_source=route-test#calendar', state);
    await closeScreen('calendar');
    state = await settled('', 'query closed');
    check('J query kept on close', state.url === '/?utm_source=route-test', state);
    await navigate(`${origin}/?conversation=thread-route-test-0001#life`);
    state = await settled('life', 'conversation param + route');
    check('J ?conversation= consumed, route kept', state.url === '/#life', state);

    // CASE K — not a route: the home, as before; nothing hidden for long.
    // (On an open page a foreign fragment such as #main-content is left alone.)
    await navigate('about:blank');
    await navigate(`${origin}/#does-not-exist`);
    state = await settled('', 'unknown fragment');
    check('K unknown fragment → home', state.homeVisible && state.url === '/#does-not-exist' && state.routes.length === 0, state);
    const notFound = await fetch(`${origin}/this-route-does-not-exist`);
    check('K unknown path → 404 (server contract unchanged)', notFound.status === 404, notFound.status);

    // CASE F — the conversation survives a reload, with and without a screen over it.
    await navigate(`${origin}/`);
    await settled('', 'home for conversation');
    await evaluate(`(() => { const prompt = document.getElementById('lotbi-prompt'); prompt.value = '새로고침 경로 테스트 질문'; prompt.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    await tapSelector('.send-button');
    state = await waitFor(async () => { const s = await snapshot(); return s.thread.some(text => text.includes('경로 테스트 답변')) ? s : {ok: false, s}; }, 'guest answer');
    await reload();
    state = await waitFor(async () => { const s = await snapshot(); return s.ready && s.thread.some(text => text.includes('새로고침 경로 테스트 질문')) ? s : {ok: false, s}; }, 'conversation after reload');
    check('F conversation reload → same conversation', state.url === '/' && state.thread.some(text => text.includes('경로 테스트 답변')), state);
    await openFromMenu('calendar');
    await settled('calendar', 'calendar over conversation');
    await reload();
    state = await settled('calendar', 'calendar over conversation reload');
    check('F calendar over a conversation → both restored', state.thread.some(text => text.includes('새로고침 경로 테스트 질문')), state);
    await closeScreen('calendar');
    await settled('', 'conversation calendar closed');

    // CASE I + 10 — signed out on a protected screen, then login from it comes back to it.
    // Life Wallet's 로그인하기 goes through /auth/start/ (the fallback page).
    await navigate('about:blank');
    await navigate(`${origin}/#wallet`);
    state = await settled('wallet', 'guest wallet');
    check('I guest /#wallet → login gate, no account call', /로그인하기/u.test(state.surfaceText) && state.authedCoreCalls.length === 0, state);
    await evaluate("localStorage.setItem('__routeTestMode', 'authenticated'); sessionStorage.setItem('__routeExpect', 'wallet'); true");
    let handoffsBefore = handoffs.length;
    await tapSelector('[data-site-route="wallet"] a[href="/auth/start/"]');
    state = await settled('wallet', 'wallet after login', 20000);
    check('I 로그인하기 on /#wallet → /auth/start/#wallet → back on Life Wallet, signed in', handoffs.length === handoffsBefore + 1 && state.url === '/#wallet' && state.auth === 'authenticated' && !/로그인하기/u.test(state.surfaceText), {handoffs: handoffs.length, state});
    await flashCheck(state, 'wallet login return');
    // 진위확인's login starts the handoff from the page itself.
    await evaluate("localStorage.setItem('__routeTestMode', 'anonymous'); true");
    await navigate('about:blank');
    await navigate(`${origin}/#scam`);
    state = await settled('scam', 'guest scam');
    check('I guest /#scam → 진위확인 login gate', state.scamGate && state.authedCoreCalls.length === 0, state);
    await evaluate("localStorage.setItem('__routeTestMode', 'authenticated'); sessionStorage.setItem('__routeExpect', 'scam'); true");
    handoffsBefore = handoffs.length;
    await tapSelector('[data-scam-dialog] [data-scam-login]');
    state = await settled('scam', 'scam after login', 20000);
    check('I login from /#scam → back on 진위확인, signed in', handoffs.length === handoffsBefore + 1 && state.url === '/#scam' && state.scamWorkspace && state.auth === 'authenticated', {handoffs: handoffs.length, state});
    await flashCheck(state, 'login return');
    await closeScreen('scam');
    await settled('', 'scam closed signed in');

    // CASE H — signed in: every reload goes through Account and comes back to the screen.
    for (const route of ['wallet', 'calendar', 'care']) {
      await openFromMenu(route);
      await settled(route, `signed-in ${route}`);
      await expectScreen(route);
      const count = handoffs.length;
      await reload();
      state = await settled(route, `signed-in ${route} reload`, 20000);
      check(`H signed-in ${route} reload → Account round trip → same screen`, handoffs.length === count + 1 && state.url === `/#${route}` && state.auth === 'authenticated', {handoffs: handoffs.length, state});
      await flashCheck(state, `signed-in ${route} reload`);
      if (route === 'wallet') check('H wallet opens for the account (no login gate)', !/로그인하기/u.test(state.surfaceText) && state.authedCoreCalls.includes('/v2/me'), state);
      await closeScreen(route);
      await settled('', `signed-in ${route} closed`);
    }
    // Signed in, a direct URL in a fresh document goes through Account and lands on the screen.
    await expectScreen('life');
    await navigate('about:blank');
    const directCount = handoffs.length;
    await navigate(`${origin}/#life`);
    state = await settled('life', 'signed-in direct life', 20000);
    check('H signed-in direct /#life → Account round trip → 생활정보', handoffs.length === directCount + 1 && state.url === '/#life' && state.auth === 'authenticated', {handoffs: handoffs.length, state});
    await flashCheck(state, 'signed-in direct URL');
    await evaluate("localStorage.setItem('__routeTestMode', 'anonymous'); true");
    return results;
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const server = startServer();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-route-restore-'));
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const testCase of CASES) {
    const results = await runCase(browser, origin, workDir, testCase);
    console.log(`${testCase.label}: ${results.length} checks PASS`);
  }
} finally {
  server.kill('SIGTERM');
  await sleep(300);
  // Windows can hold a just-killed Chrome profile for a while; a cleanup
  // error must never replace the failure that ended the run.
  try {
    fs.rmSync(workDir, {recursive: true, force: true, maxRetries: 10, retryDelay: 300});
  } catch (error) {
    console.warn(`route restore: temp profile not removed (${error.code}): ${workDir}`);
  }
}
console.log('SITE-REFRESH-ROUTE-RESTORE-01 PASS');
