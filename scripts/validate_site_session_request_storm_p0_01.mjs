// SITE-SESSION-REQUEST-STORM-P0-01 — a signed-in Home never turns into a
// request storm.
//
// 2026-10-10 one Windows Chrome tab sent ~200 GET /v2/life/today and ~10
// GET /api/auth/site-session-status a second after the person's Account
// session ended elsewhere: Core refused the Site bearer (401), the Calendar
// badge read announced a dead session, the announcement asked for the badge
// again with the same refused bearer, and the newer read's generation kept the
// failed one from dropping it.
//
// Static part: the badge read keeps its authoritative Today read, runs one at a
// time with a minimum interval, and drops a refused bearer whatever generation
// is current; site-continuity.js does not ask Account again for every refused
// request once Account has just said "signed out".
// Browser part: the real Home (index.html) in Chrome through the DevTools
// protocol, Account and Core answered in-page, request counts measured over a
// fixed window — left alone, Account signed out elsewhere while Core refuses
// the bearer, and a refused bearer that renewal heals. Chromium runtime only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const WINDOW_MS = 6000;
// Upper bounds per window. The storm measured before the fix was hundreds.
const LIMITS = Object.freeze({lifeToday: 4, status: 4, refusals: 3, renewals: 2});

// ── Static part ───────────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const continuity = read('site-continuity.js');
const refreshStart = conversation.indexOf('const refreshNavigationCalendarStatus = async () => {');
const refreshEnd = conversation.indexOf('const onNavigationCalendarRefresh', refreshStart);
assert.ok(refreshStart > 0 && refreshEnd > refreshStart, 'Calendar badge refresher must remain bounded');
const refresh = conversation.slice(refreshStart, refreshEnd);
assert.match(conversation, /const NAVIGATION_CALENDAR_MIN_INTERVAL_MS = \d{3,5};/u, 'badge reads need a minimum interval');
assert.match(refresh, /navigationCalendarReadInFlight\s*\n?\s*\|\| Date\.now\(\) - navigationCalendarLastStartedAt < NAVIGATION_CALENDAR_MIN_INTERVAL_MS/u, 'one badge read at a time, folded within the interval');
assert.match(refresh, /queueNavigationCalendarFollowUp\(\);\s*return;/u, 'later asks fold into one follow-up');
assert.match(refresh, /isSessionError\(error\) && tokenAtStart && tokenAtStart === sessionToken\) \{\s*dropSessionToken\(\);/u, 'a refused bearer is dropped regardless of generation');
assert.doesNotMatch(refresh, /if \(generation === navigationCalendarStatusGeneration\) \{\s*renderNavigationCalendarStatus\(\{count: 0, hasReminder: false\}\);\s*if \(error instanceof SiteCoreError && isSessionError\(error\)\) dropSessionToken\(\);/u, 'the generation-gated drop let the refused bearer loop');
assert.ok(conversation.includes('getLifeToday(sessionToken, timezone, globalThis.fetch)'), 'the badge keeps the authoritative Today read');
assert.ok(!conversation.includes('setInterval(refreshNavigationCalendarStatus'), 'no polling');
assert.match(continuity, /export const ACCOUNT_STATUS_SIGNED_OUT_RECHECK_MS = \d+ \* 1000;/u);
const sessionStateHandler = continuity.slice(continuity.indexOf('function handleSiteSessionState'), continuity.indexOf('window.addEventListener(SITE_SESSION_STATE_EVENT'));
assert.match(sessionStateHandler, /rootLocation\(\)\s*&& document\.body\.dataset\.siteAuthState === AUTH_STATE_UNAUTHENTICATED\s*&& Date\.now\(\) - lastSignedOutAnswerAt < ACCOUNT_STATUS_SIGNED_OUT_RECHECK_MS\s*\) return;\s*if \(rootLocation\(\)\) \{\s*void synchronizeAccountContinuity\(\);/u, 'a repeated dead-session announcement does not re-ask Account at once; anything else still asks Account first');
assert.match(continuity, /if \(authenticated === false\) \{\s*lastSignedOutAnswerAt = Date\.now\(\);/u);

// ── Browser part ──────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for SITE-SESSION-REQUEST-STORM-P0-01 browser validation.');
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

// Account and Core answered inside the page; modes live in localStorage.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const nativeFetch = window.fetch.bind(window);
  const log = window.__storm = {status: 0, renewals: 0, redeems: 0, lifeToday: 0, refusals: 0, todayTokens: []};
  const challenges = new Map();
  let tokens = 0;
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
        log.status += 1;
        return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: read('__stormAccount') === 'signed-in'});
      }
      if (url.pathname === '/api/auth/site-session-renewal') {
        log.renewals += 1;
        const body = JSON.parse(init.body || '{}');
        if (read('__stormAccount') !== 'signed-in') return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: false}, 401);
        const code = 'code' + String(log.renewals).padStart(3, '0') + 'k'.repeat(40);
        challenges.set(code, {challenge: body.code_challenge, state: body.state});
        return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: true, state: body.state, code});
      }
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const bearer = (headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (url.pathname === '/v2/life/today') { log.lifeToday += 1; log.todayTokens.push(bearer.slice(0, 13)); }
    const refused = read('__stormRefuse');
    if (bearer && refused && bearer.startsWith(refused)) {
      log.refusals += 1;
      return json({detail: {code: 'SESSION_EXPIRED', message: 'Session expired'}}, 401);
    }
    if (url.pathname === '/v2/sessions/handoffs/redeem') {
      const body = JSON.parse(init.body || '{}');
      const issued = challenges.get(body.handoff_code);
      const pkce = Boolean(issued) && issued.state === body.state && issued.challenge === await s256(body.code_verifier || '');
      challenges.delete(body.handoff_code);
      log.redeems += 1;
      if (!pkce) return json({detail: {code: 'SITE_HANDOFF_REPLAY_OR_INVALID'}}, 400);
      tokens += 1;
      return json({session_token: 'site-token-' + String(tokens).padStart(2, '0') + 's'.repeat(36), session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com',
        session_id: 'site-session-' + tokens, installation_id: 'installation-storm', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()});
    }
    if (url.pathname === '/v2/me') return bearer ? json({user: {id: 'user-storm', name: '요청 폭주 테스트', email: 'storm@example.test'}, session: {id: 'site-session', assurance_level: 'FULL', expires_at: new Date(Date.now() + 1800e3).toISOString()}, installation: {id: 'installation-storm'}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return bearer ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/life/today') {
      return json({view: 'TODAY', as_of: new Date().toISOString(), timezone: url.searchParams.get('timezone') || 'Asia/Seoul', items: [], ai_calls: 0, provider_api_calls: 0});
    }
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return bearer ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/__storm-seed') {
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
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort', 30000);
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
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
  return {send, close};
}

async function scenario(executable, origin, workDir, label, run) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(executable, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    // Never leave the page under test: a redirect handoff is answered here.
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://account.lotbiai.com/*', resourceType: 'Document', requestStage: 'Request'}]});
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
      return result.result.value;
    };
    await page('Page.navigate', {url: `${origin}/__storm-seed`});
    await waitFor(() => evaluate('document.readyState === "complete"'), `${label}: seed page`);
    await evaluate(`(() => { localStorage.setItem('__stormAccount', 'signed-in'); localStorage.removeItem('__stormRefuse'); return true; })()`);
    await page('Page.navigate', {url: `${origin}/`});
    const counts = () => evaluate(`(() => ({...window.__storm, todayTokens: (window.__storm?.todayTokens || []).slice(-3), auth: document.body?.dataset.siteAuthState || ''}))()`);
    await waitFor(async () => {
      const value = await counts();
      return value.auth === 'authenticated' && value.redeems >= 1 ? value : false;
    }, `${label}: signed in`, 20000);
    // Let the sign-in burst (sidebar repaint, profile, badge) settle first.
    await delay(2500);
    await run({evaluate, counts});
    console.log(`  PASS ${label}`);
  } finally {
    await cdp.close();
  }
}

function within(before, after) {
  const delta = {};
  for (const key of ['lifeToday', 'status', 'refusals', 'renewals']) delta[key] = after[key] - before[key];
  return delta;
}

function assertBounded(delta, label) {
  for (const [key, limit] of Object.entries(LIMITS)) {
    assert.ok(delta[key] <= limit, `${label}: ${key} ${delta[key]} in ${WINDOW_MS} ms exceeds ${limit} (request storm)`);
  }
}

const triggers = `(() => {
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
  return true;
})()`;

const executable = browserPath();
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.site-session-request-storm-'));
try {
  await scenario(executable, origin, workDir, 'signed-in Home left alone stays quiet', async ({counts}) => {
    const before = await counts();
    await delay(WINDOW_MS);
    const delta = within(before, await counts());
    assertBounded(delta, 'idle');
    assert.ok(delta.lifeToday <= 1, `idle Home must not keep reading Today (${delta.lifeToday})`);
  });

  await scenario(executable, origin, workDir, 'Account signed out elsewhere while Core refuses the bearer: no storm', async ({evaluate, counts}) => {
    await evaluate(`(() => { localStorage.setItem('__stormAccount', 'signed-out'); localStorage.setItem('__stormRefuse', 'site-token'); return true; })()`);
    const before = await counts();
    await evaluate(triggers);
    await delay(WINDOW_MS);
    const after = await counts();
    const delta = within(before, after);
    assertBounded(delta, 'signed out elsewhere');
    assert.ok(delta.refusals >= 1, 'the refused bearer must actually have been tried once');
    assert.equal(after.auth, 'unauthenticated', 'Account said signed out: the Home shows it');
    // A second burst of resume events while signed out stays bounded too.
    const again = await counts();
    await evaluate(triggers);
    await delay(WINDOW_MS);
    const second = within(again, await counts());
    assertBounded(second, 'signed out, second burst');
    assert.equal(second.refusals, 0, 'a refused bearer is never sent again');
  });

  await scenario(executable, origin, workDir, 'Core refuses the bearer while Account is still signed in: one renewal heals it', async ({evaluate, counts}) => {
    await evaluate(`(() => { localStorage.setItem('__stormRefuse', 'site-token-01'); return true; })()`);
    const before = await counts();
    await evaluate(triggers);
    const healed = await waitFor(async () => {
      const value = await counts();
      return value.redeems > before.redeems && value.auth === 'authenticated' ? value : false;
    }, 'renewed in place', 10000);
    await delay(WINDOW_MS);
    const after = await counts();
    const delta = within(before, after);
    assertBounded(delta, 'refused then renewed');
    assert.ok(healed.redeems - before.redeems <= 2, 'one renewal, not a loop');
    assert.equal(after.auth, 'authenticated');
    // The badge reads again with the renewed bearer, not the refused one.
    await evaluate(`window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'))`);
    const reread = await waitFor(async () => {
      const value = await counts();
      return value.lifeToday > after.lifeToday ? value : false;
    }, 'badge re-read after renewal', 6000);
    assert.ok(!reread.todayTokens.at(-1).startsWith('site-token-01'), `the renewed bearer is used (${reread.todayTokens.at(-1)})`);
  });
} finally {
  server.close();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); break; } catch { await delay(250); }
  }
}

console.log('validate_site_session_request_storm_p0_01: PASS');
