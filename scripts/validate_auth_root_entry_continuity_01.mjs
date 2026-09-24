// SITE-AUTH-ROOT-ENTRY-CONTINUITY-01
//
// 대표님이 주소창에 `https://lotbiai.com/` 을 직접 입력했을 때 무슨 일이
// 벌어지는지를 실제 브라우저로 잰다.
//
// 기존 scripts/validate_auth_continuity_02.mjs 는 소스 문자열만 본다. 그래서
// "로그인된 Account 로 홈에 들어가면 주소가 /auth/callback 으로 넘어간다" 를
// 한 번도 잡지 못했다. 소스에는 `await beginSiteHandoff()` 라고만 적혀 있고,
// 그것이 full-page navigation 이라는 사실은 실행해 봐야 드러난다.
//
// 그래서 이 파일은 Chromium 을 띄우고 세 origin 을 모두 로컬에서 흉내내
// 진짜 navigation timeline 을 기록한다:
//
//   https://lotbiai.com          → 이 저장소의 정적 파일 (GitHub Pages 의
//                                  디렉터리 인덱스 301 동작까지 포함)
//   https://account.lotbiai.com  → /api/auth/site-session-status (CORS),
//                                  /auth/site-handoff (303)
//   https://api.lotbiai.com      → /v2/sessions/handoffs/redeem
//
// --host-resolver-rules 로 세 호스트를 전부 127.0.0.1 로 보내므로 네트워크
// 밖으로 나가는 요청은 없고, site-core.js / site-auth.js 의 실제 상수
// (SITE_CALLBACK_URI, ACCOUNT_SITE_HANDOFF_URL, CORE_ORIGIN) 가 그대로
// 실행된다. Core 스텁은 PKCE S256·state·callback_uri·audience·단일 사용을
// 진짜로 검증한다 — 그래서 아래 "authenticated root" 케이스가 통과한다는 것은
// Site 가 올바른 code_verifier 를 보냈다는 증거다. 검증을 느슨하게 하면
// 이 파일의 의미가 사라진다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-auth-root-'));

// 로그인된 Account 로 홈에 들어갈 때 사용자에게 보이는 callback navigation 의
// 허용치. 0 이다. 홈 주소를 입력한 것만으로 cross-origin auth 왕복이 일어나선
// 안 된다 — 그것이 대표님이 주소창에서 보신 결함이다. 올리지 마십시오.
const AUTHENTICATED_ROOT_CALLBACK_BUDGET = 0;

// ── stub server ───────────────────────────────────────────────────────────
// 별도 프로세스로 띄운다. 부모는 spawnSync(browser) 에서 블로킹되므로
// 같은 프로세스의 서버는 소켓을 받지 못한다 (이 함정에 한 번 빠졌다).
const SERVER_SOURCE = String.raw`
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import crypto from 'node:crypto';

const [, , portArg, scenarioArg, logPath, siteRoot, certDir] = process.argv;
const scenario = JSON.parse(scenarioArg);
const ROOT = path.resolve(siteRoot);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gif': 'image/gif',
  '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
};

// location.href 를 <html> 속성에 적는다. auth-callback.js 가 document.body 를
// 통째로 교체해도 살아남고, history.replaceState 전이까지 관측된다.
const PROBE = '<script>(function(){var r=document.documentElement,s=[];function t(){var h=location.href;'
  + "if(s[s.length-1]!==h){s.push(h);r.setAttribute('data-lotbi-urls',s.join(' '));}"
  + "r.setAttribute('data-lotbi-final',h);if(document.body){"
  + "r.setAttribute('data-lotbi-auth',document.body.dataset.siteAuthState||'');"
  + "r.setAttribute('data-lotbi-authed',document.body.dataset.siteAuthenticated||'');"
  + "r.setAttribute('data-lotbi-home',document.getElementById('lotbi-prompt')?'1':'0');"
  + "r.setAttribute('data-lotbi-login',document.querySelector('.account-actions a.account-login')?'1':'0');"
  + "r.setAttribute('data-lotbi-continue',document.querySelector('.account-actions a.account-continue')?'1':'0');"
  + "r.setAttribute('data-lotbi-linked',document.body.dataset.siteAccountLinked||'');"
  + "r.setAttribute('data-lotbi-sidebar',document.querySelector('[data-sidebar-account] .sidebar-account-name')?.textContent||'');"
  + "var sh=document.getElementById('auth-callback-shell'),e=document.getElementById('auth-callback-status');"
  + "r.setAttribute('data-lotbi-cberr',(sh&&!sh.hasAttribute('hidden')&&e)?(e.textContent||''):'');}}"
  + 't();setInterval(t,25);})();</script>';

// 로그아웃 억제 마커를 module script 보다 먼저 심는다 (classic inline script 는
// deferred module 보다 앞서 실행된다).
const SEED_LOGOUT = "<script>try{sessionStorage.setItem('lotbi.site-logout-suppression.v1',String(Date.now()));}catch(e){}</script>";
const STRESS = '<script>(function(){setInterval(function(){'
  + "try{window.dispatchEvent(new Event('focus'));}catch(e){}"
  + "try{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}));}catch(e){}"
  + "try{document.dispatchEvent(new Event('visibilitychange'));}catch(e){}"
  + '},120);})();</script>';
const clicker = selector => '<script>(function(){var n=0;var i=setInterval(function(){'
  + "var b=document.querySelector('" + selector + "');"
  + "if(b){clearInterval(i);document.documentElement.setAttribute('data-lotbi-clicked','1');"
  + 'b.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,button:0}));}'
  + 'else if(++n>300)clearInterval(i);},50);})();</script>';
const CLICK_LOGIN = clicker('.account-actions a.account-login');
const CLICK_CONTINUE = clicker('.account-actions a.account-continue');
// PKCE 컨텍스트가 왕복 중에 사라진 경우 (sessionStorage 축출, 다른 탭, 5분
// HANDOFF_CONTEXT_TTL_MS 만료) 를 재현한다. classic inline script 는 deferred
// module 보다 먼저 실행되므로 auth-callback.js 가 읽기 전에 지워진다.
const DROP_CONTEXT = "<script>try{sessionStorage.removeItem('lotbi.site-handoff.v1');}catch(e){}</script>";

const issued = new Map();
const record = entry => fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const s256 = value => b64u(crypto.createHash('sha256').update(value, 'utf8').digest());

function cors(res, extra) {
  res.setHeader('Access-Control-Allow-Origin', 'https://lotbiai.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  for (const [k, v] of Object.entries(extra || {})) res.setHeader(k, v);
}

function account(req, res, url) {
  if (url.pathname === '/api/auth/site-session-status') {
    if (req.method === 'OPTIONS') {
      cors(res, {'Access-Control-Allow-Methods': 'GET, OPTIONS'});
      return res.writeHead(204).end();
    }
    cors(res, {'Content-Type': 'application/json'});
    if (scenario.accountStatus === 'unavailable') {
      return res.writeHead(503).end(JSON.stringify({
        contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false, available: false,
      }));
    }
    return res.writeHead(200).end(JSON.stringify({
      contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1,
      authenticated: scenario.accountAuthenticated === true,
    }));
  }
  if (url.pathname === '/auth/site-handoff') {
    const state = url.searchParams.get('state') || '';
    const challenge = url.searchParams.get('code_challenge') || '';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (scenario.accountAuthenticated !== true) {
      return res.writeHead(303, {Location: 'https://account.lotbiai.com/?site_handoff=1&state='
        + encodeURIComponent(state) + '&code_challenge=' + encodeURIComponent(challenge)}).end();
    }
    const code = 'hc' + crypto.randomBytes(24).toString('hex');
    issued.set(code, {challenge, state, used: false});
    // state 불일치 재현: Account 가 받은 것과 다른 state 로 돌려보낸다.
    const returned = scenario.stateMismatch ? 'MISMATCHED' + crypto.randomBytes(12).toString('hex') : state;
    return res.writeHead(303, {Location: 'https://lotbiai.com/auth/callback?code=' + code
      + '&state=' + encodeURIComponent(returned)}).end();
  }
  res.setHeader('X-Frame-Options', 'DENY');
  return res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'})
    .end('<!doctype html><title>LOTBI Account</title><body data-account-stub="1">account</body>');
}

function core(req, res, url) {
  if (req.method === 'OPTIONS') {
    cors(res, {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, Accept',
    });
    return res.writeHead(204).end();
  }
  if (url.pathname === '/v2/sessions/handoffs/redeem') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      cors(res, {'Content-Type': 'application/json'});
      // 실제 Core 의 오류 봉투 그대로: HTTPException(status, detail={code, message})
      // → {"detail": {"code": …, "message": …}}. site-core.js 의
      // errorFromResponse() 가 payload.detail.code 를 읽으므로 이 모양이어야
      // SiteCoreError 코드가 제대로 서고, callbackErrorMessage() 의 사용자
      // 안내 매핑이 실제로 검증된다. 평평한 {code} 로 보내면 검증이 헛돈다.
      const coreFail = (code, status) => res.writeHead(status || 400)
        .end(JSON.stringify({detail: {code, message: 'stubbed core failure'}}));
      const fail = why => coreFail('SITE_HANDOFF_REPLAY_OR_INVALID', 400) && why;
      if (scenario.redeemFailure) {
        // app/site_session_handoff_api.py: source-session-invalid 만 401.
        return coreFail(scenario.redeemFailure,
          scenario.redeemFailure === 'SITE_HANDOFF_SOURCE_SESSION_INVALID' ? 401 : 400);
      }
      let parsed;
      try { parsed = JSON.parse(body); } catch { return fail('body'); }
      const held = issued.get(parsed.handoff_code);
      if (!held || held.used) return fail('replay-or-unknown');
      if (held.state !== parsed.state) return fail('state');
      if (s256(String(parsed.code_verifier || '')) !== held.challenge) return fail('pkce');
      if (parsed.callback_uri !== 'https://lotbiai.com/auth/callback') return fail('callback_uri');
      if (parsed.audience !== 'lotbiai.com') return fail('audience');
      held.used = true;
      return res.writeHead(200).end(JSON.stringify({
        session_token: 'st' + crypto.randomBytes(24).toString('hex'),
        session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com',
        session_id: 'sess' + crypto.randomBytes(8).toString('hex'),
        installation_id: 'inst' + crypto.randomBytes(8).toString('hex'),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }));
    });
    return undefined;
  }
  cors(res, {'Content-Type': 'application/json'});
  return res.writeHead(200).end('{}');
}

function site(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  const onDisk = path.join(ROOT, rel);
  // GitHub Pages 의 디렉터리 인덱스 동작. 실제 Production 에서 확인했다:
  // /auth/callback?code=… → 301 → /auth/callback/?code=… (쿼리 유지).
  if (!rel.endsWith('/') && fs.existsSync(onDisk) && fs.statSync(onDisk).isDirectory()) {
    return res.writeHead(301, {Location: rel + '/' + url.search, 'Cache-Control': 'no-store'}).end();
  }
  if (rel.endsWith('/')) rel += 'index.html';
  // hydrateHomeShell() 의 fetch('/index.html') 만 떨어뜨린다. 최초 navigation
  // 은 Sec-Fetch-Dest: document, fetch 는 empty 라서 구분된다.
  if (scenario.hydrateFailure && rel === '/index.html' && req.headers['sec-fetch-dest'] === 'empty') {
    return res.writeHead(500, {'Content-Type': 'text/plain'}).end('home shell unavailable');
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'}).end('<!doctype html><title>404</title>');
  }
  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  if (ext === '.html') {
    const onCallback = rel === '/auth/callback/index.html';
    let inject = PROBE;
    if (scenario.seedLogoutSuppression) inject = SEED_LOGOUT + inject;
    if (scenario.dropContext && onCallback) inject = DROP_CONTEXT + inject;
    if (scenario.stressEvents) inject += STRESS;
    if (scenario.clickLogin) inject += CLICK_LOGIN;
    if (scenario.clickContinue) inject += CLICK_CONTINUE;
    return res.writeHead(200).end(
      fs.readFileSync(file, 'utf8').replace(/<head(\s[^>]*)?>/i, m => m + inject));
  }
  return res.writeHead(200).end(fs.readFileSync(file));
}

const server = https.createServer({
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
}, (req, res) => {
  const host = String(req.headers.host || '').split(':')[0];
  const url = new URL(req.url, 'https://' + host);
  record({host, method: req.method, path: url.pathname, search: url.search});
  if (host === 'account.lotbiai.com') return account(req, res, url);
  if (host === 'api.lotbiai.com') return core(req, res, url);
  if (host === 'lotbiai.com') return site(req, res, url);
  return res.writeHead(404).end();
});
server.on('tlsClientError', () => {});
server.listen(Number(portArg), '127.0.0.1');
`;

// ── setup ─────────────────────────────────────────────────────────────────
const SERVER_PATH = path.join(WORK, 'origins.mjs');
fs.writeFileSync(SERVER_PATH, SERVER_SOURCE, 'utf8');

const tls = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', path.join(WORK, 'key.pem'), '-out', path.join(WORK, 'cert.pem'),
  '-days', '2', '-subj', '/CN=lotbiai.com',
  '-addext', 'subjectAltName=DNS:lotbiai.com,DNS:account.lotbiai.com,DNS:api.lotbiai.com',
], {encoding: 'utf8'});
if (tls.status !== 0) throw new Error('openssl is required to serve the three stub origins: ' + tls.stderr);

function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/')) {
      try { if (fs.statSync(name).isFile()) return name; } catch { /* keep looking */ }
      continue;
    }
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const {port} = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitPort(port, ms = 20000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const open = await new Promise(resolve => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (open) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('the stub origin server did not come up');
}

const browser = browserPath();

async function measure(label, scenario, {url = 'https://lotbiai.com/', budget = 25000} = {}) {
  const port = await freePort();
  const logPath = path.join(WORK, `log-${port}.jsonl`);
  fs.writeFileSync(logPath, '');
  const server = spawn(process.execPath, [SERVER_PATH, String(port), JSON.stringify(scenario), logPath, ROOT, WORK], {stdio: 'ignore'});
  try {
    await waitPort(port);
    const r = spawnSync(browser, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      // 이 환경은 HTTPS_PROXY 가 설정돼 있다. 프록시를 끄지 않으면
      // --host-resolver-rules 가 무시되고 전부 ERR_TIMED_OUT 이 된다.
      '--no-proxy-server',
      `--host-resolver-rules=MAP * 127.0.0.1:${port}`,
      '--window-size=1280,900', '--force-device-scale-factor=1',
      '--force-prefers-reduced-motion=reduce',
      `--virtual-time-budget=${budget}`,
      '--dump-dom', url,
    ], {encoding: 'utf8', timeout: budget + 120000, maxBuffer: 32 * 1024 * 1024});
    if (r.error) throw r.error;
    const dom = r.stdout || '';
    const netError = (dom.match(/ERR_[A-Z_]+/) || [''])[0];
    if (netError) throw new Error(`${label}: the browser could not reach the stub origins (${netError})`);
    const attr = name => {
      const m = dom.match(new RegExp(`<html[^>]*\\sdata-lotbi-${name}="([^"]*)"`, 'i'));
      return m ? m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>') : '';
    };
    const log = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const count = pred => log.filter(pred).length;
    return {
      label,
      urls: attr('urls').split(' ').filter(Boolean),
      final: attr('final'),
      authState: attr('auth'),
      authenticated: attr('authed') === 'true',
      homeMounted: attr('home') === '1',
      loginCta: attr('login') === '1',
      continueCta: attr('continue') === '1',
      accountLinked: attr('linked') === 'true',
      sidebarLabel: attr('sidebar'),
      callbackError: attr('cberr'),
      accountStub: /data-account-stub="1"/.test(dom),
      handoffStarts: count(e => e.host === 'account.lotbiai.com' && e.path === '/auth/site-handoff'),
      // 301 페어(/auth/callback → /auth/callback/)는 사용자 눈에 보이는 한 번의
      // navigation 이다. 그래서 요청 수가 아니라 navigation 수로 센다.
      callbackNavigations: count(e => e.host === 'lotbiai.com' && e.path === '/auth/callback/'),
      redeemPosts: count(e => e.host === 'api.lotbiai.com' && e.method === 'POST' && e.path === '/v2/sessions/handoffs/redeem'),
      statusGets: count(e => e.host === 'account.lotbiai.com' && e.method === 'GET' && e.path === '/api/auth/site-session-status'),
      homeDocuments: count(e => e.host === 'lotbiai.com' && (e.path === '/' || e.path === '/index.html')),
    };
  } finally {
    server.kill('SIGKILL');
  }
}

const report = [];
try {
  // ── A. 익명 ───────────────────────────────────────────────────────────
  for (const entry of ['https://lotbiai.com/', 'https://lotbiai.com/index.html']) {
    const v = await measure(`anonymous ${entry}`, {accountAuthenticated: false}, {url: entry});
    report.push(v);
    assert.equal(v.final, entry, `${v.label}: 익명 사용자는 입력한 주소에 머물러야 한다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 익명 상태에서 자동 handoff 가 일어나면 안 된다`);
    assert.equal(v.callbackNavigations, 0, `${v.label}: 익명 상태에서 callback 주소가 열려선 안 된다`);
    assert.equal(v.redeemPosts, 0, `${v.label}: 익명 상태에서 redeem 이 일어나면 안 된다`);
    assert.equal(v.authState, 'unauthenticated', `${v.label}: 익명 상태가 authoritative 하게 표시돼야 한다`);
    assert.ok(v.homeMounted, `${v.label}: Home 이 바로 보여야 한다`);
    assert.ok(v.loginCta, `${v.label}: 로그인 CTA 가 있어야 한다`);
  }

  // 반복 focus/pageshow/visibilitychange 가 익명 상태를 흔들지 않는다.
  {
    const v = await measure('anonymous + repeated focus/pageshow/visibilitychange',
      {accountAuthenticated: false, stressEvents: true});
    report.push(v);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: 이벤트 반복이 주소를 옮기면 안 된다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 이벤트 반복이 handoff 를 만들면 안 된다`);
    assert.equal(v.callbackNavigations, 0, `${v.label}: 이벤트 반복이 callback 을 열면 안 된다`);
    assert.equal(v.homeDocuments, 1, `${v.label}: 홈 문서를 다시 읽는 루프가 없어야 한다`);
  }

  // ── B. 로그인된 Account — 이 PR 의 본론 ───────────────────────────────
  // 대표님이 보신 그 동작이 여기서 막힌다. 홈 주소를 입력하면 주소가 그대로
  // 남고, cross-origin 왕복이 아예 시작되지 않는다.
  for (const entry of ['https://lotbiai.com/', 'https://lotbiai.com/index.html']) {
    const v = await measure(`authenticated ${entry}`, {accountAuthenticated: true}, {url: entry});
    report.push(v);
    assert.equal(v.final, entry, `${v.label}: 홈 주소를 입력했으면 그 주소에 머물러야 한다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 홈 진입만으로 handoff 가 시작되면 안 된다`);
    assert.equal(v.redeemPosts, 0, `${v.label}: 홈 진입만으로 세션이 발급되면 안 된다`);
    assert.equal(v.callbackNavigations, AUTHENTICATED_ROOT_CALLBACK_BUDGET,
      `${v.label}: 홈 진입에서 callback navigation 이 ${v.callbackNavigations}회 일어났다 — 허용치 ${AUTHENTICATED_ROOT_CALLBACK_BUDGET}회`);
    assert.equal(v.callbackError, '', `${v.label}: 홈을 열었을 뿐인데 로그인 오류 화면이 떠선 안 된다`);
    assert.ok(v.homeMounted, `${v.label}: Home 이 바로 보여야 한다`);
    // 계정이 연결돼 있다는 사실은 보여주되, 세션이 있는 척하지 않는다.
    assert.ok(v.accountLinked, `${v.label}: 계정 연결 상태가 표시돼야 한다`);
    assert.ok(v.continueCta, `${v.label}: 이어서 사용하기 CTA 가 있어야 한다`);
    assert.ok(!v.loginCta, `${v.label}: 이미 로그인한 분에게 '로그인' 을 다시 요구하면 안 된다`);
    assert.equal(v.sidebarLabel, '이어서 사용하기', `${v.label}: 사이드바도 같은 동작을 제시해야 한다`);
    // Site 세션은 진짜로 없다 — guest namespace 소비자가 그대로 동작해야 한다.
    assert.equal(v.authState, 'unauthenticated', `${v.label}: Site 세션이 없으면 authenticated 로 위장하면 안 된다`);
    assert.ok(!v.authenticated, `${v.label}: fake login state 금지`);
  }

  // 이벤트를 두드려도 아무 왕복도 시작되지 않는다 (§10). 이제 자동 navigation
  // 자체가 없으므로 루프는 구조적으로 불가능하다.
  {
    const v = await measure('authenticated + repeated focus/pageshow/visibilitychange',
      {accountAuthenticated: true, stressEvents: true});
    report.push(v);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: 최종 주소는 '/' 여야 한다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 이벤트 반복이 handoff 를 만들면 안 된다`);
    assert.equal(v.callbackNavigations, 0, `${v.label}: 이벤트 반복이 callback 을 열면 안 된다`);
    assert.equal(v.homeDocuments, 1, `${v.label}: 홈 문서를 다시 읽는 루프가 없어야 한다`);
    assert.ok(v.accountLinked, `${v.label}: 계정 연결 표시가 유지돼야 한다`);
  }

  // 그리고 누르면 실제로 이어진다 — 목표 C 와 같은 경로다.
  {
    const v = await measure('authenticated → 이어서 사용하기 클릭',
      {accountAuthenticated: true, clickContinue: true}, {budget: 40000});
    report.push(v);
    assert.equal(v.handoffStarts, 1, `${v.label}: 누르면 handoff 가 정확히 한 번 시작돼야 한다`);
    assert.equal(v.redeemPosts, 1, `${v.label}: redeem 은 정확히 한 번이어야 한다 (replay 금지)`);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: callback 처리 후 주소는 '/' 여야 한다`);
    // Core 스텁이 PKCE S256 · state · callback_uri · audience · 단일 사용을
    // 실제로 검증하므로, authenticated 로 끝났다는 것은 Site 가 올바른
    // code_verifier 를 보냈다는 증거다.
    assert.equal(v.authState, 'authenticated', `${v.label}: FULL 세션이 서야 한다`);
    assert.ok(v.authenticated, `${v.label}: body[data-site-authenticated] 가 서야 한다`);
    assert.ok(v.homeMounted, `${v.label}: 로그인 후 Home 이 보여야 한다`);
    assert.ok(!v.accountLinked, `${v.label}: 로그인되면 연결 안내 표식은 지워져야 한다`);
    assert.equal(v.callbackError, '', `${v.label}: 정상 경로에서 오류 화면이 떠선 안 된다`);
  }

  // ── C. 명시적 로그인 ──────────────────────────────────────────────────
  {
    const v = await measure('anonymous → 로그인 클릭', {accountAuthenticated: false, clickLogin: true});
    report.push(v);
    assert.equal(v.handoffStarts, 1, `${v.label}: 로그인 클릭은 handoff 를 정확히 한 번 시작해야 한다`);
    assert.ok(v.accountStub, `${v.label}: Account 로그인 화면으로 넘어가야 한다`);
    assert.equal(v.redeemPosts, 0, `${v.label}: 로그인하지 않은 채 세션이 발급되면 안 된다`);
  }
  {
    // 로그아웃 억제 상태에서도 사용자가 직접 누르면 로그인된다.
    const v = await measure('logout-suppressed → 로그인 클릭',
      {accountAuthenticated: true, seedLogoutSuppression: true, clickLogin: true}, {budget: 40000});
    report.push(v);
    assert.equal(v.handoffStarts, 1, `${v.label}: 명시적 로그인은 억제를 풀고 handoff 를 시작해야 한다`);
    assert.equal(v.redeemPosts, 1, `${v.label}: 명시적 로그인은 세션을 발급받아야 한다`);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: callback 처리 후 주소는 '/' 여야 한다`);
    assert.equal(v.authState, 'authenticated', `${v.label}: 명시적 로그인 후 FULL 세션이어야 한다`);
    assert.ok(v.homeMounted, `${v.label}: 로그인 후 Home 이 보여야 한다`);
  }

  // ── D. 로그아웃 억제 ──────────────────────────────────────────────────
  {
    const v = await measure('logout-suppressed root entry',
      {accountAuthenticated: true, seedLogoutSuppression: true});
    report.push(v);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: 로그아웃 후 홈은 홈에 머물러야 한다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: Account 쿠키가 살아 있어도 즉시 자동 재로그인되면 안 된다`);
    assert.equal(v.callbackNavigations, 0, `${v.label}: 로그아웃 후 callback 으로 튕기면 안 된다`);
    assert.equal(v.authState, 'unauthenticated', `${v.label}: 로그아웃 상태가 유지돼야 한다`);
    assert.ok(v.loginCta, `${v.label}: 로그아웃 후 로그인 CTA 가 보여야 한다`);
  }

  // 억제 + 이벤트 폭격에도 자동 재로그인은 없다.
  {
    const v = await measure('logout-suppressed + repeated focus/pageshow',
      {accountAuthenticated: true, seedLogoutSuppression: true, stressEvents: true});
    report.push(v);
    assert.equal(v.handoffStarts, 0, `${v.label}: 이벤트 반복이 억제를 뚫으면 안 된다`);
    assert.equal(v.callbackNavigations, 0, `${v.label}: 이벤트 반복이 callback 을 열면 안 된다`);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: 주소가 옮겨지면 안 된다`);
  }

  // ── E. callback fail-closed ───────────────────────────────────────────
  for (const [name, query] of [
    ['invalid params', '?code=short&state=x'],
    ['unexpected parameter', '?code=abcdefghijklmnopqrstuvwxyz012345&state=ABCDEFGHIJKLMNOPQRSTUVWXYZ012345&next=%2Fadmin'],
    ['no params', ''],
  ]) {
    const v = await measure(`callback ${name}`, {accountAuthenticated: false},
      {url: `https://lotbiai.com/auth/callback${query}`});
    report.push(v);
    assert.ok(v.callbackError, `${v.label}: 잘못된 callback 은 오류를 보여야 한다 (fail closed)`);
    assert.equal(v.redeemPosts, 0, `${v.label}: 잘못된 callback 이 redeem 을 시도해선 안 된다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 익명 상태의 잘못된 callback 이 자동 로그인을 시작해선 안 된다`);
    assert.ok(!v.authenticated, `${v.label}: 잘못된 callback 이 로그인 상태를 만들면 안 된다`);
    assert.ok(!v.final.includes('code='), `${v.label}: 주소창에 code/state 가 남으면 안 된다`);
  }

  // ── E2. auth-callback.js:155 이전의 네 실패 지점 ───────────────────────
  // 총괄방이 지목한 네 후보가 각각 사용자를 어디에 남기는지 실제로 잰다.
  // 넷 다 사용자를 /auth/callback 에 갇히게 만든다 — auth-callback.js 가
  // 주소를 '/' 로 되돌리는 것은 hydrate 까지 성공한 뒤이기 때문이다.
  //
  // 핵심은 이것이다: 이제 이 네 지점은 **명시적 로그인에서만** 도달한다.
  // 홈 주소를 입력한 사람은 애초에 이 흐름에 들어가지 않으므로, "홈을 열었을
  // 뿐인데 로그인 오류 화면에 갇힌다" 는 사고 자체가 사라진다. 위 B 묶음의
  // callbackNavigations === 0 이 그것을 증명한다.
  const strandingCases = [
    ['state 불일치', {stateMismatch: true}, '로그인 연결 상태값이 일치하지 않습니다.'],
    ['PKCE 컨텍스트 소실', {dropContext: true}, undefined],
    ['redeem replay', {redeemFailure: 'SITE_HANDOFF_REPLAY_OR_INVALID'},
      '이 로그인 연결은 이미 사용되었거나 유효하지 않습니다. 홈에서 다시 시도해 주세요.'],
    ['redeem 만료', {redeemFailure: 'SITE_HANDOFF_EXPIRED'},
      '로그인 연결 시간이 만료되었습니다. 홈에서 다시 시도해 주세요.'],
    ['redeem 원본 세션 무효', {redeemFailure: 'SITE_HANDOFF_SOURCE_SESSION_INVALID'},
      '계정 로그인 상태가 더 이상 유효하지 않습니다. 홈에서 다시 연결해 주세요.'],
    ['홈 셸 hydrate 실패', {hydrateFailure: true}, undefined],
  ];
  for (const [name, knobs, expectedMessage] of strandingCases) {
    const v = await measure(`explicit login → ${name}`,
      {accountAuthenticated: true, clickContinue: true, ...knobs}, {budget: 40000});
    report.push(v);
    // 실패는 반드시 fail closed 여야 한다: 세션 있는 척 금지.
    assert.ok(!v.authenticated, `${v.label}: 실패했는데 로그인 상태를 주장하면 안 된다`);
    assert.ok(v.callbackError, `${v.label}: 실패는 사용자에게 오류로 보여야 한다 (조용히 삼키지 말 것)`);
    assert.ok(!v.final.includes('code='), `${v.label}: 주소창에 code/state 가 남으면 안 된다`);
    if (expectedMessage) {
      assert.equal(v.callbackError, expectedMessage, `${v.label}: 사용자에게 맞는 안내가 떠야 한다`);
    }
    // 무한 재시도 금지: 실패가 handoff 를 반복 생성하면 루프가 된다.
    assert.ok(v.handoffStarts <= 2,
      `${v.label}: handoff 가 ${v.handoffStarts}회 — 실패가 재시도 루프로 번졌다`);
  }

  // ── F. Account 상태 서버 장애 ─────────────────────────────────────────
  {
    const v = await measure('Account status 503', {accountStatus: 'unavailable'});
    report.push(v);
    assert.equal(v.final, 'https://lotbiai.com/', `${v.label}: 503 이어도 홈에 머물러야 한다`);
    assert.equal(v.handoffStarts, 0, `${v.label}: 503 이 자동 handoff 를 유발하면 안 된다`);
    assert.equal(v.authState, 'unauthenticated', `${v.label}: 503 의 안전한 기본값은 익명 CTA 다`);
    assert.ok(v.loginCta, `${v.label}: 503 이어도 로그인 버튼은 눌릴 수 있어야 한다`);
  }

  console.log('SITE-AUTH-ROOT-ENTRY-CONTINUITY-01 PASS');
  for (const v of report) {
    console.log(
      '  ' + v.label.padEnd(52),
      'final=' + (v.final || '(none)').replace('https://lotbiai.com', ''),
      '| auth=' + (v.authState || '-'),
      '| handoff=' + v.handoffStarts,
      '| callbackNav=' + v.callbackNavigations,
      '| redeem=' + v.redeemPosts,
      '| cta=' + (v.continueCta ? '이어서' : v.loginCta ? '로그인' : '-'),
      v.callbackError ? '| err=' + v.callbackError.slice(0, 28) : '',
    );
  }
} finally {
  fs.rmSync(WORK, {recursive: true, force: true});
}
