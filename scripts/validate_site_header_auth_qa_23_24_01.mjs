// SITE-HEADER-AUTH-QA-23-24-01 — the Home Header always gives a way in, and a
// signed-in phone shows who is signed in.
//
// QA #23: a signed-out visitor saw only "계정 확인 중" for the 1-3 s (8 s and
// more under load) Account took to answer — no 로그인 to press. QA #24: on a
// phone the account row lives in the drawer, so a signed-in Header was empty on
// its right.
//
// Static part: first paint stays neutral (no 로그인/회원가입 in the HTML), the
// checking state carries a delayed 로그인 that a "signed in" answer withdraws,
// and the phone Header button opens the drawer instead of adding a second
// account menu. Browser part: the real Home in Chrome with Account and Core
// answered in-page — a slow signed-out answer, a slow signed-in answer, a fast
// signed-in answer (no flash), and the phone/desktop Header once signed in.
// Chromium runtime only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Static part ───────────────────────────────────────────────────────────
const index = read('index.html');
const continuity = read('site-continuity.js');
const conversation = read('site-conversation.js');
const authCss = read('site-auth-continuity.css');
const headerNav = index.match(/<nav class="account-actions"[\s\S]*?<\/nav>/)?.[0] || '';
assert.ok(headerNav.includes('계정 확인 중') && !headerNav.includes('>로그인<'), 'first paint stays neutral');
const headerButton = index.match(/<button class="mobile-header-account"[\s\S]*?<\/button>/)?.[0] || '';
assert.ok(headerButton.includes('data-mobile-account-open') && headerButton.includes('aria-controls="mobile-nav-drawer"'), 'the phone Header button opens the drawer');
// The page keeps exactly one mobile menu open control (validate_accessibility.py).
assert.ok(!headerButton.includes('data-mobile-nav-open'), 'the Header button is not a second [data-mobile-nav-open]');
assert.equal((index.match(/data-mobile-nav-open/g) || []).length, 1, 'index.html has one data-mobile-nav-open');
assert.match(read('home-shell.js'), /querySelectorAll\('\[data-mobile-nav-open\], \[data-mobile-account-open\]'\)/u, 'home-shell opens the drawer from both buttons');
assert.ok(!headerButton.includes('data-profile-menu-trigger'), 'it is not a second account menu');
assert.ok(index.indexOf('<button class="mobile-header-account"') > index.indexOf('<nav class="account-actions"'), 'it sits on the right of the Header');
const checkingFn = continuity.slice(continuity.indexOf('function checkingNodes'), continuity.indexOf('function withdrawLoginWhileChecking'));
assert.match(checkingFn, /recoveryLoginLink\('account-action account-login account-login-while-checking'\)/u);
assert.match(continuity, /if \(authenticated !== false\) withdrawLoginWhileChecking\(\);/u);
assert.match(authCss, /\.account-login-while-checking \{[^}]*opacity: 0;[^}]*pointer-events: none;[^}]*animation: lotbi-login-while-checking 0s linear 0\.8s forwards;/su);
assert.match(authCss, /body\[data-site-authenticated="true"\] \.mobile-header-account \{/u);
assert.match(conversation, /renderHeaderAccountAvatar\(\);\n?\s*\};/u);

// ── Browser part ──────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for SITE-HEADER-AUTH-QA-23-24-01 browser validation.');
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
    await delay(40);
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

// Account and Core answered inside the page. __qaStatusDelay holds the Account
// status answer back; the mode lives in localStorage across reloads.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const nativeFetch = window.fetch.bind(window);
  const challenges = new Map();
  let tokens = 0;
  window.__qa = {statusAnsweredAt: 0};
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
        const wait = Number(read('__qaStatusDelay') || 0);
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        window.__qa.statusAnsweredAt = performance.now();
        return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: read('__qaAccount') === 'signed-in'});
      }
      if (url.pathname === '/api/auth/site-session-renewal') {
        const body = JSON.parse(init.body || '{}');
        if (read('__qaAccount') !== 'signed-in') return json({contract_id: 'ACCOUNT-SITE-SESSION-RENEWAL-01', schema_version: 1, authenticated: false}, 401);
        const code = 'code' + String(challenges.size + 1).padStart(3, '0') + 'k'.repeat(40);
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
      if (!pkce) return json({detail: {code: 'SITE_HANDOFF_REPLAY_OR_INVALID'}}, 400);
      tokens += 1;
      return json({session_token: 'site-token-' + String(tokens).padStart(2, '0') + 's'.repeat(36), session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com',
        session_id: 'site-session-' + tokens, installation_id: 'installation-qa', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()});
    }
    if (url.pathname === '/v2/me') return bearer ? json({user: {id: 'user-qa', name: '헤더 확인', email: 'qa@example.test'}, session: {id: 'site-session', assurance_level: 'FULL', expires_at: new Date(Date.now() + 1800e3).toISOString()}, installation: {id: 'installation-qa'}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return bearer ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return bearer ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/__qa-seed') {
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

// Where the delayed 로그인 is, whether it can be seen and pressed.
const LOGIN_PROBE = `(() => {
  const link = document.querySelector('.account-login-while-checking');
  const state = document.querySelector('.account-actions')?.dataset.authState || '';
  if (!link) return {present: false, state};
  const style = getComputedStyle(link);
  const rect = link.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {present: true, state, opacity: Number(style.opacity), pointer: style.pointerEvents,
    pressable: hit === link || link.contains(hit), width: Math.round(rect.width), text: link.textContent};
})()`;

async function scenario(executable, origin, workDir, label, {account, statusDelay = 0, width = 390, height = 844, mobile = true}, run) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(executable, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://account.lotbiai.com/*', resourceType: 'Document', requestStage: 'Request'}]});
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
      return result.result.value;
    };
    await page('Page.navigate', {url: `${origin}/__qa-seed`});
    await waitFor(() => evaluate('document.readyState === "complete"'), `${label}: seed page`);
    await evaluate(`(() => { localStorage.clear(); localStorage.setItem('__qaAccount', ${JSON.stringify(account)}); localStorage.setItem('__qaStatusDelay', ${JSON.stringify(String(statusDelay))}); return true; })()`);
    await page('Page.navigate', {url: `${origin}/`});
    await run({evaluate, page});
    console.log(`  PASS ${label}`);
  } finally {
    await cdp.close();
  }
}

const executable = browserPath();
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.site-header-auth-qa-'));
try {
  await scenario(executable, origin, workDir, '#23 slow Account, signed out: 로그인 appears while still checking, and works', {account: 'signed-out', statusDelay: 3000}, async ({evaluate}) => {
    const early = await waitFor(async () => {
      const value = await evaluate(LOGIN_PROBE);
      return value.present ? value : false;
    }, 'checking state with the delayed 로그인', 2000);
    assert.equal(early.state, 'checking');
    assert.equal(early.opacity, 0, 'not shown at once (a quick answer would make it flash)');
    assert.equal(early.pointer, 'none');
    await delay(1300);
    const shown = await evaluate(LOGIN_PROBE);
    assert.equal(shown.state, 'checking', 'Account has still not answered');
    assert.equal(shown.opacity, 1, '로그인 is visible while checking');
    assert.equal(shown.pointer, 'auto');
    assert.ok(shown.pressable, `로그인 can be pressed: ${JSON.stringify(shown)}`);
    assert.equal(shown.text, '로그인');
    const settled = await waitFor(async () => {
      const value = await evaluate(`({state: document.querySelector('.account-actions')?.dataset.authState, links: [...document.querySelectorAll('.account-actions a')].map(node => node.textContent)})`);
      return value.state === 'unauthenticated' ? value : false;
    }, 'signed-out header', 8000);
    assert.deepEqual(settled.links, ['로그인', '회원가입']);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mobile-header-account')).display`), 'none', 'no account button while signed out');
  });

  await scenario(executable, origin, workDir, '#23 slow Account, signed in: the delayed 로그인 is withdrawn the moment Account answers', {account: 'signed-in', statusDelay: 2000}, async ({evaluate}) => {
    await waitFor(async () => (await evaluate(LOGIN_PROBE)).present, 'checking state', 2000);
    await waitFor(() => evaluate('window.__qa.statusAnsweredAt > 0'), 'Account answered', 6000);
    const after = await evaluate(LOGIN_PROBE);
    assert.equal(after.present, false, `no 로그인 once Account said signed in: ${JSON.stringify(after)}`);
    await waitFor(() => evaluate(`document.body?.dataset.siteAuthenticated === 'true'`), 'signed in', 8000);
  });

  await scenario(executable, origin, workDir, '#23 quick Account, signed in: 로그인 never flashes', {account: 'signed-in', statusDelay: 0}, async ({evaluate}) => {
    const started = Date.now();
    let visibleSamples = 0;
    while (Date.now() - started < 1800) {
      const value = await evaluate(`(() => {
        const visible = [...document.querySelectorAll('.account-actions .account-login')].filter(node => Number(getComputedStyle(node).opacity) > 0 && node.getClientRects().length);
        return {visible: visible.length, signedIn: document.body?.dataset.siteAuthenticated === 'true'};
      })()`);
      if (value.visible) visibleSamples += 1;
      await delay(30);
    }
    assert.equal(visibleSamples, 0, 'a signed-in person never sees 로그인');
    assert.equal(await evaluate(`document.body.dataset.siteAuthenticated`), 'true');
  });

  await scenario(executable, origin, workDir, '#24 signed-in phone: the Header shows the account avatar and opens the drawer', {account: 'signed-in'}, async ({evaluate, page}) => {
    await waitFor(() => evaluate(`document.body?.dataset.siteAuthenticated === 'true'`), 'signed in', 10000);
    const header = await waitFor(async () => {
      const value = await evaluate(`(() => {
        const button = document.querySelector('.mobile-header-account');
        const avatar = button?.querySelector('[data-header-account-avatar]');
        const rect = button?.getBoundingClientRect();
        return {display: getComputedStyle(button).display, width: Math.round(rect.width), height: Math.round(rect.height),
          right: Math.round(window.innerWidth - rect.right), top: Math.round(rect.top),
          avatarText: avatar?.textContent?.trim() || '', avatarIcon: Boolean(avatar?.querySelector('svg')), label: button.getAttribute('aria-label'),
          x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, menuTrigger: Boolean(button.closest('[data-profile-menu-trigger]') || button.hasAttribute('data-profile-menu-trigger'))};
      })()`);
      return value.avatarText ? value : false;
    }, 'avatar with initials', 10000);
    assert.notEqual(header.display, 'none');
    assert.ok(header.width >= 44 && header.height >= 44, `a 44px touch target: ${JSON.stringify(header)}`);
    assert.ok(header.right < 80 && header.top < 90, `on the right of the Header: ${JSON.stringify(header)}`);
    assert.equal(header.avatarIcon, false, 'initials replace the plain icon');
    assert.match(header.label, /헤더 확인 계정 메뉴 열기/u);
    assert.equal(header.menuTrigger, false, 'not a second account menu');
    await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: header.x, y: header.y, button: 'left', clickCount: 1});
    await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: header.x, y: header.y, button: 'left', clickCount: 1});
    await waitFor(() => evaluate(`document.body.classList.contains('nav-drawer-open')`), 'drawer opened', 3000);
    const drawerAccount = await evaluate(`Boolean(document.querySelector('#mobile-nav-drawer [data-sidebar-account] [data-profile-menu-trigger]'))`);
    assert.ok(drawerAccount, 'the drawer holds the one account menu');
  });

  await scenario(executable, origin, workDir, '#24 signed-in desktop: no Header account button (the sidebar row is on screen)', {account: 'signed-in', width: 1280, height: 900, mobile: false}, async ({evaluate}) => {
    await waitFor(() => evaluate(`document.body?.dataset.siteAuthenticated === 'true'`), 'signed in', 10000);
    await delay(300);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mobile-header-account')).display`), 'none');
  });
} finally {
  await new Promise(resolve => server.close(resolve));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); break; } catch { await delay(250); }
  }
}

console.log('validate_site_header_auth_qa_23_24_01: PASS');
