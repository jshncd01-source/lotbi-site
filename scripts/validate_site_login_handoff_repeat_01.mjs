// SITE-LOGIN-HANDOFF-REPEAT-01 — a signed-in device does not keep landing on
// "LOTBI 연결 오류" or going round Account again.
//
// 2026-10-10 15:31 a signed-in phone (Samsung Internet, LTE) showed "LOTBI 연결
// 오류 — 로그인 연결 파라미터가 올바르지 않습니다" while Core had just completed two
// hand-overs for it. A stale or broken callback on a signed-in device used to
// start one more Account round trip, and the next one inside two minutes ended
// on the error page; a single missed in-place restore on a phone network sent
// the person on the full round trip too.
//
// Module part: returnHomeFromStaleSiteHandoff goes Home only for a signed-in
// Account, once per recovery window, never for a typed message waiting to be
// sent and never for an unrelated error. Static part: the callback asks it
// before the old recovery, and Home retries the in-place restore once before
// the redirect fallback. Browser part: the real pages in Chrome with Account and
// Core answered in-page — stale and broken callbacks while signed in end on Home
// signed in with no Account navigation and no error page; the loop breaker; a
// revisit whose first renewal fails still restores in place. Chromium only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Module part ───────────────────────────────────────────────────────────
const auth = await import('../site-auth.js?v=handoff-repeat-01');
const {HANDOFF_RECOVERY_KEY, returnHomeFromStaleSiteHandoff, recoverStaleSiteHandoff, SiteHandoffClientError} = auth;
const memoryStorage = () => {
  const data = new Map();
  return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
};
{
  const storage = memoryStorage();
  const homes = [];
  let checks = 0;
  const first = await returnHomeFromStaleSiteHandoff(new SiteHandoffClientError('x', 'SITE_HANDOFF_CONTEXT_MISSING'), {
    storage, now: 50_000, readStatus: async () => { checks += 1; return true; }, goHome: hash => homes.push(hash), returnHash: '#calendar',
  });
  assert.equal(first, true, 'signed in: a stale callback goes Home');
  assert.deepEqual(homes, ['#calendar'], 'the screen the person came from is kept');
  assert.equal(checks, 1);
  assert.deepEqual(JSON.parse(storage.data.get(HANDOFF_RECOVERY_KEY)), {version: 1, startedAt: 50_000, attemptCount: 1});
  const second = await returnHomeFromStaleSiteHandoff(new SiteHandoffClientError('x', 'SITE_HANDOFF_CALLBACK_INVALID'), {
    storage, now: 50_001, readStatus: async () => { checks += 1; return true; }, goHome: hash => homes.push(hash),
  });
  assert.equal(second, false, 'once per recovery window: Home and the callback cannot bounce');
  assert.equal(homes.length, 1);
  // The old recovery honours the same marker, so the error page is next.
  assert.equal(await recoverStaleSiteHandoff(new SiteHandoffClientError('x', 'SITE_HANDOFF_CALLBACK_INVALID'), {
    storage, now: 50_002, readStatus: async () => true, beginHandoff: async () => { throw new Error('must not start'); },
  }), false);
}
for (const [label, input, status] of [
  ['a typed message keeps the handoff that carries it', {pendingText: '보내려던 질문'}, async () => true],
  ['signed-out Account keeps the diagnostic error page', {}, async () => false],
  ['an unreachable Account is not read as signed in', {}, async () => { throw new Error('offline'); }],
]) {
  const storage = memoryStorage();
  let homes = 0;
  const result = await returnHomeFromStaleSiteHandoff(new SiteHandoffClientError('x', 'SITE_HANDOFF_REPLAY_OR_INVALID'), {
    storage, readStatus: status, goHome: () => { homes += 1; }, ...input,
  });
  assert.equal(result, false, label);
  assert.equal(homes, 0, label);
  assert.equal(storage.data.size, 0, `${label}: no marker`);
}
{
  let homes = 0;
  const result = await returnHomeFromStaleSiteHandoff(new Error('LOTBI 홈 화면을 불러오지 못했습니다.'), {
    storage: memoryStorage(), readStatus: async () => true, goHome: () => { homes += 1; },
  });
  assert.equal(result, false, 'only stale/broken hand-over errors go Home');
  assert.equal(homes, 0);
}

// ── Static part ───────────────────────────────────────────────────────────
const callback = read('auth-callback.js');
const continuity = read('site-continuity.js');
const catchBody = callback.slice(callback.indexOf('void completeSiteHandoff().catch('));
assert.ok(catchBody.indexOf('returnHomeFromStaleSiteHandoff(error, {') > 0, 'the callback asks to go Home first');
assert.ok(catchBody.indexOf('returnHomeFromStaleSiteHandoff(error, {') < catchBody.indexOf('recoverStaleSiteHandoff(error, {'), 'Home before the extra Account round trip');
assert.ok(catchBody.indexOf('recoverStaleSiteHandoff(error, {') < catchBody.indexOf('showCallbackError('), 'the error page stays the last resort');
const syncBody = continuity.slice(continuity.indexOf('export async function synchronizeAccountContinuity'), continuity.indexOf('\nfunction handleSiteSessionState'));
assert.ok(syncBody.indexOf("restoreSiteSessionInPlace('restore')") < syncBody.indexOf("restoreSiteSessionInPlace('restore-retry')"), 'one more in-place restore');
assert.ok(syncBody.indexOf("restoreSiteSessionInPlace('restore-retry')") < syncBody.indexOf('await beginSiteHandoff()'), 'before the redirect fallback');
assert.match(syncBody, /if \(retried === 'SIGNED_OUT'\) \{\s*showAccountSignedOut\(\);\s*return;\s*\}/u);
// An ordinary load's pageshow does not ask Account a second time; a page back
// from the back/forward cache still does.
const pageshowHandler = continuity.slice(continuity.indexOf("window.addEventListener('pageshow'"), continuity.indexOf("window.addEventListener('online'"));
assert.ok(pageshowHandler.indexOf('if (!event?.persisted) return;') > 0
  && pageshowHandler.indexOf('if (!event?.persisted) return;') < pageshowHandler.indexOf('void synchronizeAccountContinuity();'), 'pageshow re-checks only a bfcache restore');

// ── Browser part ──────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for SITE-LOGIN-HANDOFF-REPEAT-01 browser validation.');
}

async function waitFor(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await check();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await delay(60);
  }
  throw new Error(`timeout: ${label} (${last instanceof Error ? last.message : JSON.stringify(last)})`);
}

function contentType(file) {
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.json') || file.endsWith('.webmanifest')) return 'application/json';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

// Account and Core answered inside the page; modes and the renewal count live
// in localStorage so they span the callback → Home navigation.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
  const bump = key => { try { const next = Number(window.localStorage.getItem(key) || 0) + 1; window.localStorage.setItem(key, String(next)); return next; } catch { return 0; } };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const nativeFetch = window.fetch.bind(window);
  const challenges = new Map();
  const s256 = async value => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    let binary = '';
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
  };
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') {
        bump('__rpStatus');
        return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: read('__rpAccount') === 'signed-in'});
      }
      if (url.pathname === '/api/auth/site-session-renewal') {
        const count = bump('__rpRenewals');
        const body = JSON.parse(init.body || '{}');
        if (read('__rpAccount') !== 'signed-in') return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: false}, 401);
        if (read('__rpRenewal') === 'fail-once' && count === 1) throw new TypeError('Failed to fetch');
        const code = 'code' + String(count).padStart(3, '0') + 'k'.repeat(40);
        challenges.set(code, {challenge: body.code_challenge, state: body.state});
        return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: true, state: body.state, code});
      }
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const bearer = (headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (url.pathname === '/v2/sessions/handoffs/redeem') {
      const body = JSON.parse(init.body || '{}');
      const issued = challenges.get(body.handoff_code);
      const pkce = Boolean(issued) && issued.state === body.state && issued.challenge === await s256(body.code_verifier || '');
      challenges.delete(body.handoff_code);
      bump('__rpRedeems');
      if (!pkce) return json({detail: {code: 'SITE_HANDOFF_REPLAY_OR_INVALID', message: 'replayed'}}, 400);
      const tokens = bump('__rpTokens');
      return json({session_token: 'site-token-' + String(tokens).padStart(2, '0') + 's'.repeat(36), session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com',
        session_id: 'site-session-' + tokens, installation_id: 'installation-rp', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()});
    }
    if (url.pathname === '/v2/me') return bearer ? json({user: {id: 'user-rp', name: '연결 반복 테스트', email: 'rp@example.test'}, session: {id: 'site-session', assurance_level: 'FULL', expires_at: new Date(Date.now() + 1800e3).toISOString()}, installation: {id: 'installation-rp'}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return bearer ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return bearer ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/__rp-seed') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
      res.end('<!doctype html><title>seed</title>');
      return;
    }
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('not found');
      return;
    }
    res.writeHead(200, {'Content-Type': contentType(file), 'Cache-Control': 'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openBrowser(executable, profile) {
  const chrome = spawn(executable, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=390,844', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort', 30000);
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
  const close = async () => {
    try { socket.close(); } catch {}
    if (chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once('exit', resolve));
      chrome.kill('SIGTERM');
      await Promise.race([exited, delay(2000)]);
    }
  };
  return {send, close, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

async function scenario(executable, origin, workDir, label, {account, renewal = 'ok', path: startPath}, run) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(executable, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    // Every Account page navigation (a round trip) is recorded and answered here.
    const navigations = [];
    cdp.on(message => {
      if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
      const {requestId, request} = message.params;
      navigations.push(new URL(request.url).pathname);
      void page('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'text/html'}], body: Buffer.from('<!doctype html><title>account</title>account handoff').toString('base64')});
    });
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://account.lotbiai.com/*', resourceType: 'Document', requestStage: 'Request'}]});
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
      return result.result.value;
    };
    await page('Page.navigate', {url: `${origin}/__rp-seed`});
    await waitFor(() => evaluate('document.readyState === "complete"'), `${label}: seed page`);
    await evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem('__rpAccount', ${JSON.stringify(account)});
      localStorage.setItem('__rpRenewal', ${JSON.stringify(renewal)});
      return true;
    })()`);
    const go = async target => page('Page.navigate', {url: `${origin}${target}`});
    const snapshot = () => evaluate(`(() => ({
      path: location.pathname + location.hash,
      auth: document.body?.dataset.siteAuthState || '',
      diagnostic: document.body?.dataset.authCallbackDiagnostic || '',
      errorPage: document.body?.classList.contains('auth-callback-error-page') || false,
      text: (document.body?.innerText || '').slice(0, 600),
      renewals: Number(localStorage.getItem('__rpRenewals') || 0),
      redeems: Number(localStorage.getItem('__rpRedeems') || 0),
    }))()`);
    await go(startPath);
    await run({evaluate, snapshot, navigations, go});
    console.log(`  PASS ${label}`);
  } finally {
    await cdp.close();
  }
}

const STALE_CALLBACK = `/auth/callback/?code=${'c'.repeat(43)}&state=${'s'.repeat(43)}`;
const BROKEN_CALLBACK = `/auth/callback/?code=${'q'.repeat(40)}`;
const signedInHome = async snapshot => waitFor(async () => {
  const value = await snapshot();
  return value.path === '/' && value.auth === 'authenticated' ? value : false;
}, 'Home signed in', 20000);

const executable = browserPath();
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.site-login-handoff-repeat-'));
try {
  await scenario(executable, origin, workDir, 'signed in: a stale callback (code already used, no hand-over context) ends on Home, restored in place', {account: 'signed-in', path: STALE_CALLBACK}, async ({snapshot, navigations}) => {
    const state = await signedInHome(snapshot);
    assert.deepEqual(navigations, [], 'no Account round trip');
    assert.equal(state.diagnostic, '', 'no error page');
    assert.equal(state.errorPage, false);
    assert.equal(state.renewals, 1, 'Home restored with one in-place renewal');
  });

  await scenario(executable, origin, workDir, 'signed in: a broken callback (code without state) ends on Home, never "로그인 연결 파라미터가 올바르지 않습니다"', {account: 'signed-in', path: BROKEN_CALLBACK}, async ({snapshot, navigations}) => {
    const state = await signedInHome(snapshot);
    assert.deepEqual(navigations, []);
    assert.ok(!state.text.includes('파라미터'), 'the parameter error never reaches the screen');
  });

  await scenario(executable, origin, workDir, 'signed in: a second broken callback inside the window shows the diagnostic page instead of bouncing', {account: 'signed-in', path: BROKEN_CALLBACK}, async ({snapshot, navigations, go}) => {
    await signedInHome(snapshot);
    await go(BROKEN_CALLBACK);
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.diagnostic ? value : false;
    }, 'loop breaker');
    assert.match(state.diagnostic, /^진단 SITE_HANDOFF_CALLBACK_INVALID · code 1 · state 0 · 기타 0 · /u);
    assert.deepEqual(navigations, [], 'still no Account round trip');
  });

  await scenario(executable, origin, workDir, 'revisit: the first in-place renewal fails on a phone network, the second restores — no Account round trip', {account: 'signed-in', renewal: 'fail-once', path: '/'}, async ({evaluate, snapshot, navigations}) => {
    const state = await signedInHome(snapshot);
    assert.deepEqual(navigations, [], 'no redirect fallback after one miss');
    assert.equal(state.renewals, 2);
    assert.equal(state.redeems, 1);
    // One load, one Account check: the ordinary pageshow after load does not
    // start a second one.
    await delay(1500);
    assert.equal(await evaluate(`Number(localStorage.getItem('__rpStatus') || 0)`), 1, 'Account is asked once per load');
  });
} finally {
  await new Promise(resolve => server.close(resolve));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); break; } catch { await delay(250); }
  }
}

console.log('validate_site_login_handoff_repeat_01: PASS');
