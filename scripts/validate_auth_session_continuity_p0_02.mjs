// AUTH-SESSION-CONTINUITY-P0-02 — a signed-in person is not sent back to the
// login button by the Site's own 30-minute session.
//
// Module part (node): silent renewal keeps PKCE/state/one-time redeem, reads
// only Account's explicit "no session" as signed out, never stores anything,
// and the callback diagnostic counts parameters without reading a value.
// Static part: the continuity contract (restore in place before the redirect
// fallback, logout suppression first, one session timer, bfcache/online
// recovery) and the conversation's bearer hand-over.
// Browser part: the real Home (index.html) in Chrome through the DevTools
// protocol, Account and Core answered in-page — reload restore without any
// navigation, a route restored on reload, renewal before expiry with the new
// bearer in use, renewal on Core refusal, signed-out Account, an Account
// deploy without the renewal route (redirect fallback), and the callback
// error page diagnostic. Chromium runtime only — not Samsung Internet or
// iPhone Safari device evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Module part ───────────────────────────────────────────────────────────
const auth = await import('../site-auth.js?v=p0-02');
const {
  ACCOUNT_SITE_SESSION_RENEWAL_URL,
  SiteHandoffClientError,
  adoptSiteSession,
  describeSiteHandoffCallbackQuery,
  registerSiteSessionAdopter,
  renewSiteSessionSilently,
} = auth;

assert.equal(ACCOUNT_SITE_SESSION_RENEWAL_URL, 'https://account.lotbiai.com/api/auth/site-session-renewal');

async function s256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('base64url');
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const renewalBody = (state, code = 'r'.repeat(43)) => ({
  contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: true, state, code,
});

{
  const sent = [];
  const redeemed = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({url: String(url), init, body});
    return json(renewalBody(body.state));
  };
  const redeem = async input => {
    redeemed.push(input);
    return {sessionToken: 'site-bearer', installationId: 'inst-1', expiresAt: '2099-01-01T00:30:00Z'};
  };
  const first = await renewSiteSessionSilently({fetchImpl, redeem});
  const second = await renewSiteSessionSilently({fetchImpl, redeem});
  assert.equal(first.status, 'RENEWED');
  assert.equal(first.session.sessionToken, 'site-bearer');
  assert.equal(second.status, 'RENEWED');
  assert.equal(sent.length, 2);
  for (const [index, request] of sent.entries()) {
    assert.equal(request.url, ACCOUNT_SITE_SESSION_RENEWAL_URL);
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.mode, 'cors');
    assert.equal(request.init.credentials, 'include');
    assert.equal(request.init.cache, 'no-store');
    assert.equal(request.init.referrerPolicy, 'no-referrer');
    assert.equal(request.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(Object.keys(request.body).sort(), ['code_challenge', 'state']);
    assert.match(request.body.state, /^[A-Za-z0-9_-]{43}$/);
    assert.match(request.body.code_challenge, /^[A-Za-z0-9_-]{43}$/);
    // The code is redeemed only with the verifier behind that challenge.
    assert.equal(redeemed[index].state, request.body.state);
    assert.equal(redeemed[index].handoffCode, 'r'.repeat(43));
    assert.equal(await s256(redeemed[index].codeVerifier), request.body.code_challenge);
  }
  assert.notEqual(sent[0].body.state, sent[1].body.state, 'every renewal uses a fresh state');
  assert.notEqual(redeemed[0].codeVerifier, redeemed[1].codeVerifier, 'every renewal uses a fresh verifier');
}

{
  let redeemCalls = 0;
  const redeem = async () => { redeemCalls += 1; return {}; };
  const signedOut = await renewSiteSessionSilently({
    fetchImpl: async () => json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: false}, 401),
    redeem,
  });
  assert.deepEqual({...signedOut}, {status: 'SIGNED_OUT'});

  const failures = [
    ['state mismatch', async () => json(renewalBody('x'.repeat(43))), 'SITE_HANDOFF_STATE_MISMATCH'],
    ['401 without the contract', async () => json({}, 401), 'SITE_SESSION_RENEWAL_UNAVAILABLE'],
    ['Account deploy without the route', async () => new Response('<!doctype html>not found', {status: 404}), 'SITE_SESSION_RENEWAL_UNAVAILABLE'],
    ['Core outage', async () => json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, available: false, retryable: true}, 503), 'SITE_SESSION_RENEWAL_UNAVAILABLE'],
    ['rate limited', async () => json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, available: false, retryable: true}, 429), 'SITE_SESSION_RENEWAL_UNAVAILABLE'],
    ['short code', async (_url, init) => json(renewalBody(JSON.parse(init.body).state, 'short')), 'SITE_SESSION_RENEWAL_UNAVAILABLE'],
    ['offline', async () => { throw new TypeError('Failed to fetch'); }, 'SITE_SESSION_RENEWAL_NETWORK_ERROR'],
    ['stalled radio', () => new Promise(() => {}), 'SITE_SESSION_RENEWAL_TIMEOUT'],
  ];
  for (const [label, fetchImpl, code] of failures) {
    await assert.rejects(
      renewSiteSessionSilently({fetchImpl, redeem, timeoutMs: 200}),
      error => error instanceof SiteHandoffClientError && error.code === code,
      label,
    );
  }
  assert.equal(redeemCalls, 0, 'nothing but a matching contract answer is ever redeemed');
}

{
  const shape = url => ({...describeSiteHandoffCallbackQuery(new URL(url))});
  assert.deepEqual(shape('https://lotbiai.com/auth/callback/'), {code: 0, state: 0, other: 0});
  assert.deepEqual(shape(`https://lotbiai.com/auth/callback/?code=${'a'.repeat(40)}`), {code: 1, state: 0, other: 0});
  assert.deepEqual(shape('https://lotbiai.com/auth/callback/?code=a&code=b&state=c&utm=1&x=2'), {code: 2, state: 1, other: 2});
  const source = read('site-auth.js');
  const body = source.slice(source.indexOf('export function describeSiteHandoffCallbackQuery'), source.indexOf('export function parseSiteHandoffCallback'));
  assert.doesNotMatch(body, /searchParams\.get\(|\[0\]|\.values\(|\.entries\(/u, 'the diagnostic never reads a value');
}

{
  assert.equal(adoptSiteSession({sessionToken: 'x'}), false, 'no conversation mounted: nothing adopts');
  let adopted;
  registerSiteSessionAdopter(session => { adopted = session; return true; });
  assert.equal(adoptSiteSession({sessionToken: 'y'}), true);
  assert.equal(adopted.sessionToken, 'y');
  registerSiteSessionAdopter(() => { throw new Error('boom'); });
  assert.equal(adoptSiteSession({sessionToken: 'z'}), false, 'an adopter failure is a failed renewal, not a crash');
  registerSiteSessionAdopter(undefined);
}

// ── Static part ───────────────────────────────────────────────────────────
const continuity = read('site-continuity.js');
const conversation = read('site-conversation.js');
const callback = read('auth-callback.js');
const syncBody = continuity.slice(
  continuity.indexOf('export async function synchronizeAccountContinuity'),
  continuity.indexOf('\nfunction handleSiteSessionState'),
);
assert.ok(syncBody.indexOf('siteLogoutSuppressed || hasSiteLogoutSuppression()') < syncBody.indexOf("restoreSiteSessionInPlace('restore')"), 'an explicit Site logout is honoured before any automatic restore');
assert.ok(syncBody.indexOf("restoreSiteSessionInPlace('restore')") < syncBody.indexOf('await beginSiteHandoff()'), 'restore in place comes before the redirect fallback');
assert.match(syncBody, /if \(restored === 'SIGNED_OUT'\) \{\s*showAccountSignedOut\(\);\s*return;\s*\}/u);
assert.match(syncBody, /if \(siteSessionNearExpiry\(\)\) void renewLiveSiteSession\('resume'\);/u, 'a tab back from the background renews when its session is close to running out');
assert.equal((continuity.match(/setTimeout\(/g) || []).length, 2, 'one session timer and the bounded UNKNOWN retry only');
const timerBody = continuity.slice(continuity.indexOf('async function handleSessionTimer'), continuity.indexOf('// Core refused the Site bearer'));
assert.doesNotMatch(timerBody, /markAnonymousAccountUi/u, 'a Site session running out never paints the login button by itself');
const stateHandler = continuity.slice(continuity.indexOf('function handleSiteSessionState'), continuity.indexOf('window.addEventListener(SITE_SESSION_STATE_EVENT'));
const refusalBranch = stateHandler.slice(stateHandler.indexOf("if (detail.reason === 'site-logout')"));
assert.match(refusalBranch, /if \(rootLocation\(\)\) \{\s*void synchronizeAccountContinuity\(\);\s*return;\s*\}\s*markAnonymousAccountUi\(\);/u, 'a Core 401/403 on Home asks Account before any login button');
assert.match(continuity, /if \(event\?\.persisted\) \{\s*redirecting = false;\s*checking = false;\s*\}/u, 'a back/forward-cache restore releases the handoff guard');
assert.match(continuity, /window\.addEventListener\('online', \(\) => \{/u, 'coming back online re-checks Account');
assert.match(continuity, /window\.addEventListener\(SITE_SESSION_RENEWAL_REQUEST_EVENT, \(\) => \{/u);
assert.match(continuity, /SITE_SESSION_RENEWAL_MIN_INTERVAL_MS = 20 \* 1000/u, 'Core refusals cannot drive a renewal storm');
const showSignedOut = continuity.slice(continuity.indexOf('function showAccountSignedOut'), continuity.indexOf('async function renewLiveSiteSession'));
assert.match(showSignedOut, /markAnonymousAccountUi\(\);/u);
assert.doesNotMatch(continuity, /sessionStorage|localStorage/u, 'continuity never stores a session');
assert.match(conversation, /registerSiteSessionAdopter\(session => \{/u);
assert.equal((conversation.match(/sessionToken = undefined;/g) || []).length, 4, 'dropSessionToken(), explicit logout and the two send-path catches clear the Site bearer');
assert.equal((conversation.match(/dropSessionToken\(\);/g) || []).length, 5, 'every other Core refusal asks for an in-place renewal');
// The send path keeps its original contract; its Core 401/403 is announced by site-core.js and restored in place.
assert.match(read('site-core.js'), /function announceInvalidSiteSession\(error\) \{\s*if \(!\(error instanceof SiteCoreError\) \|\| \(error.status !== 401 && error.status !== 403\)\) return;/u);
assert.match(conversation, /const dropSessionToken = \(\) => \{\s*if \(!sessionToken\) return;\s*sessionToken = undefined;\s*window\.dispatchEvent\(new CustomEvent\(SITE_SESSION_RENEWAL_REQUEST_EVENT\)\);/u);
assert.doesNotMatch(conversation, /SESSION_STATE_EVENT, \{detail: \{[^}]*sessionToken/u, 'the bearer never travels on a window event');
assert.match(callback, /showCallbackError\(callbackErrorMessage\(error\), callbackDiagnosticText\(error\)\)/u);
const authSource = read('site-auth.js');
const renewalSource = authSource.slice(authSource.indexOf('export async function renewSiteSessionSilently'), authSource.indexOf('let siteSessionAdopter'));
assert.doesNotMatch(renewalSource, /storeSiteHandoffContext|sessionStorage|localStorage/u, 'silent renewal keeps its verifier in memory only');

// ── Browser part ──────────────────────────────────────────────────────────
function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for AUTH-SESSION-CONTINUITY-P0-02 browser validation.');
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

// Account and Core, answered inside the page. Modes come from localStorage so
// they survive reloads; every observation is kept per document.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const nativeFetch = window.fetch.bind(window);
  const log = window.__p02 = {status: 0, renewals: [], redeems: [], authed: [], states: []};
  const challenges = new Map();
  let tokens = 0;
  const s256 = async value => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    let binary = '';
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
  };
  new MutationObserver(() => {
    const state = document.body?.dataset.siteAuthState || '';
    if (state && log.states.at(-1) !== state) log.states.push(state);
  }).observe(document, {subtree: true, attributes: true, attributeFilter: ['data-site-auth-state']});
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') {
        log.status += 1;
        return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: read('__p02Account') === 'signed-in'});
      }
      if (url.pathname === '/api/auth/site-session-renewal') {
        const body = JSON.parse(init.body || '{}');
        log.renewals.push({credentials: init.credentials, method: init.method, keys: Object.keys(body).sort().join(',')});
        const mode = read('__p02Renewal') || 'ok';
        if (mode === 'missing') return new Response('<!doctype html>404', {status: 404, headers: {'Content-Type': 'text/html'}});
        if (mode === 'signed-out' || read('__p02Account') !== 'signed-in') return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: false}, 401);
        const code = 'code' + String(log.renewals.length).padStart(3, '0') + 'k'.repeat(40);
        challenges.set(code, {challenge: body.code_challenge, state: body.state});
        return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: true, state: body.state, code});
      }
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const bearer = (headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (bearer) log.authed.push({path: url.pathname, token: bearer});
    const refused = read('__p02Refuse');
    if (bearer && refused && bearer.startsWith(refused)) {
      log.refusals = (log.refusals || 0) + 1;
      return json({detail: {code: 'SESSION_EXPIRED', message: 'Session expired'}}, 401);
    }
    if (url.pathname === '/v2/sessions/handoffs/redeem') {
      const body = JSON.parse(init.body || '{}');
      const issued = challenges.get(body.handoff_code);
      const pkce = Boolean(issued) && issued.state === body.state && issued.challenge === await s256(body.code_verifier || '');
      challenges.delete(body.handoff_code);
      log.redeems.push({pkce});
      if (!pkce) return json({detail: {code: 'SITE_HANDOFF_REPLAY_OR_INVALID'}}, 400);
      tokens += 1;
      const lifetime = Number(read('__p02FirstLifetimeMs')) && tokens === 1 ? Number(read('__p02FirstLifetimeMs')) : 30 * 60 * 1000;
      return json({session_token: 'site-token-' + String(tokens).padStart(2, '0') + 's'.repeat(36), session_type: 'Bearer', assurance_level: 'FEDERATED_LIMITED', audience: 'lotbiai.com',
        session_id: 'site-session-' + tokens, installation_id: 'installation-p02', expires_at: new Date(Date.now() + lifetime).toISOString()});
    }
    if (url.pathname === '/v2/me') return bearer ? json({user: {id: 'user-p02', name: '연속성 테스트', email: 'p02@example.test'}, session: {id: 'site-session', assurance_level: 'FEDERATED_LIMITED', expires_at: new Date(Date.now() + 1800e3).toISOString()}, installation: {id: 'installation-p02'}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return bearer ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return bearer ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/__p02-seed') {
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
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
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

async function scenario(executable, origin, workDir, label, {account, renewal = 'ok', firstLifetimeMs = 0, path: startPath = '/'}, run) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(executable, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
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
    await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
      return result.result.value;
    };
    // Seed the modes on this origin, then load the page under test.
    await page('Page.navigate', {url: `${origin}/__p02-seed`});
    await waitFor(() => evaluate('document.readyState === "complete"'), `${label}: seed page`);
    await evaluate(`(() => {
      localStorage.setItem('__p02Account', ${JSON.stringify(account)});
      localStorage.setItem('__p02Renewal', ${JSON.stringify(renewal)});
      localStorage.setItem('__p02FirstLifetimeMs', ${JSON.stringify(String(firstLifetimeMs))});
      return true;
    })()`);
    await page('Page.navigate', {url: `${origin}${startPath}`});
    const snapshot = () => evaluate(`(() => ({
      path: location.pathname + location.hash,
      auth: document.body?.dataset.siteAuthState || '',
      states: (window.__p02?.states || []).slice(),
      status: window.__p02?.status || 0,
      renewals: (window.__p02?.renewals || []).slice(),
      redeems: (window.__p02?.redeems || []).slice(),
      authed: (window.__p02?.authed || []).slice(),
      loginButtons: document.querySelectorAll('.account-login, .sidebar-account-entry[href="/auth/start/"]').length,
      profileTrigger: Boolean(document.querySelector('[data-profile-menu-trigger]')),
      calendar: Boolean(document.querySelector('[data-site-route="calendar"]')),
      marks: performance.getEntriesByName('lotbi-auth:site-session-renewal').map(entry => entry.detail),
      diagnostic: document.body?.dataset.authCallbackDiagnostic || '',
      text: (document.body?.innerText || '').slice(0, 2000),
    }))()`);
    let lastSnapshot;
    const observed = async () => { lastSnapshot = await snapshot(); return lastSnapshot; };
    try {
      await run({evaluate, snapshot: observed, navigations});
    } catch (error) {
      error.message += `
  last page state: ${JSON.stringify({...(lastSnapshot || {}), text: undefined})}
  navigations: ${JSON.stringify(navigations)}`;
      throw error;
    }
    console.log(`  PASS ${label}`);
  } finally {
    await cdp.close();
  }
}

const executable = browserPath();
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-p02-'));
try {
  await scenario(executable, origin, workDir, 'reload restores the Site session in place (no Account navigation, no login button)', {account: 'signed-in'}, async ({snapshot, navigations}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.auth === 'authenticated' && value.authed.some(item => item.path === '/v2/me') ? value : false;
    }, 'authenticated in place');
    assert.equal(state.path, '/');
    assert.deepEqual(navigations, [], 'no page navigation to Account');
    assert.equal(state.renewals.length, 1);
    assert.equal(state.renewals[0].credentials, 'include');
    assert.equal(state.renewals[0].keys, 'code_challenge,state');
    assert.deepEqual(state.redeems, [{pkce: true}], 'the code was redeemed with the verifier behind its challenge');
    assert.ok(state.authed.every(item => item.token.startsWith('site-token-01')), 'the conversation uses the restored bearer');
    assert.ok(!state.states.includes('unauthenticated'), `never painted signed-out: ${state.states}`);
    assert.equal(state.loginButtons, 0);
    assert.ok(state.profileTrigger, 'the account row shows the signed-in profile');
    assert.equal(state.marks.at(-1)?.outcome, 'RESTORED');
  });

  await scenario(executable, origin, workDir, 'reload on /#calendar reopens the calendar signed in, in place', {account: 'signed-in', path: '/#calendar'}, async ({snapshot, navigations}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.auth === 'authenticated' && value.calendar ? value : false;
    }, 'calendar restored signed in');
    assert.equal(state.path, '/#calendar');
    assert.deepEqual(navigations, []);
    assert.ok(!state.states.includes('unauthenticated'));
  });

  await scenario(executable, origin, workDir, 'renewal before expiry swaps the bearer without leaving the page; Core refusal renews too', {account: 'signed-in', firstLifetimeMs: 5 * 60 * 1000 + 2500}, async ({evaluate, snapshot, navigations}) => {
    await waitFor(async () => (await snapshot()).auth === 'authenticated', 'first restore');
    const renewed = await waitFor(async () => {
      const value = await snapshot();
      return value.redeems.length >= 2 ? value : false;
    }, 'renewal before expiry', 12000);
    assert.deepEqual(renewed.redeems, [{pkce: true}, {pkce: true}]);
    assert.equal(renewed.auth, 'authenticated');
    assert.equal(renewed.marks.at(-1)?.reason, 'timer');
    assert.equal(renewed.marks.at(-1)?.outcome, 'RESTORED');
    // The renewed bearer is the one the page now uses.
    await evaluate(`document.querySelector('[data-calendar-view="all"]')?.click(); true`);
    const used = await waitFor(async () => {
      const value = await snapshot();
      return value.calendar && value.authed.some(item => item.token.startsWith('site-token-02')) ? value : false;
    }, 'calendar with renewed bearer');
    assert.ok(!used.authed.slice(-3).some(item => item.token.startsWith('site-token-01')), 'the old bearer is no longer sent');
    // Core refuses the bearer: the conversation asks for a renewal (rate bounded).
    await delay(21000);
    await evaluate(`window.dispatchEvent(new CustomEvent('lotbi:site-session-renewal-request')); true`);
    const refused = await waitFor(async () => {
      const value = await snapshot();
      return value.redeems.length >= 3 ? value : false;
    }, 'renewal after Core refusal');
    assert.equal(refused.marks.at(-1)?.reason, 'core-refused');
    assert.equal(refused.marks.at(-1)?.outcome, 'RESTORED');
    assert.equal(refused.auth, 'authenticated');
    assert.deepEqual(navigations, []);
    assert.ok(!refused.states.includes('unauthenticated'));
  });

  await scenario(executable, origin, workDir, 'Core refusing the expired Site bearer never paints the login button; the session comes back in place', {account: 'signed-in'}, async ({evaluate, snapshot, navigations}) => {
    await waitFor(async () => {
      const value = await snapshot();
      return value.auth === 'authenticated' && value.authed.some(item => item.path === '/v2/me') ? value : false;
    }, 'first restore');
    await evaluate(`localStorage.setItem('__p02Refuse', 'site-token-01'); document.querySelector('[data-calendar-view="all"]')?.click(); true`);
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.redeems.length >= 2 && value.auth === 'authenticated' ? value : false;
    }, 'renewed after Core refusal');
    assert.ok(await evaluate('(window.__p02.refusals || 0) >= 1'), 'Core did refuse the old bearer');
    assert.ok(!state.states.includes('unauthenticated'), `never painted signed-out: ${state.states}`);
    assert.deepEqual(navigations, []);
    await waitFor(async () => (await snapshot()).authed.some(item => item.token.startsWith('site-token-02')), 'new bearer in use');
    await evaluate(`localStorage.removeItem('__p02Refuse'); true`);
  });

  await scenario(executable, origin, workDir, 'Account signed out shows login without any renewal or navigation', {account: 'signed-out'}, async ({snapshot, navigations}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.auth === 'unauthenticated' ? value : false;
    }, 'signed out');
    assert.equal(state.renewals.length, 0);
    assert.deepEqual(navigations, []);
    assert.ok(state.loginButtons >= 1);
  });

  await scenario(executable, origin, workDir, 'Account session gone between status and renewal reads as signed out, not as an error', {account: 'signed-in', renewal: 'signed-out'}, async ({snapshot, navigations}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.auth === 'unauthenticated' ? value : false;
    }, 'signed out by renewal');
    assert.equal(state.renewals.length, 1);
    assert.equal(state.redeems.length, 0);
    assert.deepEqual(navigations, []);
  });

  await scenario(executable, origin, workDir, 'an Account deploy without the renewal route falls back to the redirect handoff once', {account: 'signed-in', renewal: 'missing'}, async ({navigations}) => {
    await waitFor(() => navigations.length >= 1, 'redirect fallback');
    await delay(800);
    assert.deepEqual(navigations, ['/auth/site-handoff']);
  });

  await scenario(executable, origin, workDir, 'callback error page carries a value-free diagnostic and the running asset version', {account: 'signed-out', path: `/auth/callback/?code=${'q'.repeat(40)}`}, async ({snapshot}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.diagnostic ? value : false;
    }, 'callback diagnostic');
    const version = JSON.parse(read('site-asset-version.json')).version;
    assert.equal(state.diagnostic, `진단 SITE_HANDOFF_CALLBACK_INVALID · code 1 · state 0 · 기타 0 · ${version}`);
    assert.ok(state.text.includes(state.diagnostic), 'the line is on screen');
    assert.ok(!state.text.includes('qqqq'), 'no callback value reaches the page');
    assert.equal(state.path, '/auth/callback', 'the query is gone from the address bar');
  });

  await scenario(executable, origin, workDir, 'a callback revisited without its query goes Home and restores there', {account: 'signed-in', path: '/auth/callback/'}, async ({snapshot, navigations}) => {
    const state = await waitFor(async () => {
      const value = await snapshot();
      return value.path === '/' && value.auth === 'authenticated' ? value : false;
    }, 'consumed callback → Home → restored');
    assert.deepEqual(navigations, []);
    assert.equal(state.diagnostic, '');
  });

  console.log('AUTH-SESSION-CONTINUITY-P0-02 PASS');
} finally {
  await new Promise(resolve => server.close(resolve));
  // Windows can still hold the Chrome profile for a moment; leftovers are temp files.
  try { fs.rmSync(workDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 100}); } catch {}
}
