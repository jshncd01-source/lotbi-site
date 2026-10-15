// COMMON-UI-POLISH-01 — QA 일괄보고 01 공통 항목 #4·#17·#18·#19·#20·#21·#25·#26,
// and #5 (CONNECTED-SERVICES-NAME-01, 대표 결정 "연결서비스로 통합").
//
// Source contracts first, then a headless Chrome pass over a fixture that loads
// every stylesheet index.html loads, in the same order, so the cascade that
// produced each QA measurement is the cascade being measured here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0;
const check = (label, fn) => { fn(); passed += 1; };

const index = read('index.html');
const conversation = read('site-conversation.js');
const scam = read('site-scam-shield.js');
const wallet = read('site-life-wallet.js');

// #5 — one name for the primary navigation destination. The approved compact
// profile popover deliberately omits this shortcut and reaches details via 설정.
check('#5 drawer keeps the connected-services name', () => {
  const mallButtons = [...index.matchAll(/<button[^>]*data-consumer-section="mall"[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
  assert.equal(mallButtons.length, 2, 'desktop and mobile drawer entries');
  for (const button of mallButtons) {
    assert.match(button, /aria-label="연결 서비스"/);
    assert.match(button, /<span class="nav-item-label">연결 서비스<\/span>/);
  }
  assert.doesNotMatch(index, /제휴몰/);
  assert.match(conversation, /mall: \['연결 서비스', /);
  const profileMenu = conversation.slice(conversation.indexOf('const openProfileMenu = trigger =>'), conversation.indexOf('let responseGradeOpen'));
  assert.doesNotMatch(profileMenu, /connectedServices|연결 서비스/);
  assert.match(read('subscribe.html'), /<tr><th scope="row">연결 서비스<\/th>/);
});

// #4 — 진위확인 closes the mobile drawer before its dialog opens, the way every
// other drawer item (openConsumerSection → closeMobileDrawer) already does.
// SCAM-PHISHING-REDESIGN-02 — 사기·피싱 확인 is now a workspace page opened from
// site-conversation.js: it closes the drawer before the page shell is built,
// and the workspace close restores focus like every other page.
check('#4 scam page closes the drawer first', () => {
  const conversation = read('site-conversation.js');
  const body = conversation.slice(conversation.indexOf('const openScamShieldPage = () => {'), conversation.indexOf("window.addEventListener('lotbi:scam-shield-open-request'"));
  const close = body.indexOf('closeMobileDrawer();');
  const shell = body.indexOf("modalShell('사기·피싱 확인')");
  assert.ok(close > 0 && shell > close, 'drawer close must run before the page opens');
  assert.match(conversation, /const restoreTarget = surfaceRestoreFocus instanceof HTMLElement && surfaceRestoreFocus\.isConnected \? surfaceRestoreFocus : undefined;/);
  assert.doesNotMatch(scam, /showModal/);
});

// #21 — the gate's mark is a padlock, not a lone dot.
check('#21 wallet gate uses a padlock', () => {
  assert.doesNotMatch(wallet, /'wallet-lock-mark', '\u25cf'/);
  assert.equal((wallet.match(/lockMark\(\)/g) || []).length, 4, 'definition + three gates');
  assert.match(wallet, /function lockMark\(\) \{[\s\S]*?createElementNS\(ns, 'svg'\)[\s\S]*?setAttribute\('aria-hidden', 'true'\)|function lockMark\(\) \{[\s\S]*?setAttribute\('aria-hidden', 'true'\)[\s\S]*?createElementNS\(ns, 'svg'\)/);
  assert.match(read('site-life-wallet.css'), /\.wallet-lock-mark svg \{[^}]*stroke: currentColor;/);
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
  throw new Error('Chrome/Chromium is required for the COMMON-UI-POLISH-01 validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
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
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

// The real topbar markup, with the signed-out actions site-continuity.js puts in it.
function fixtureHtml() {
  const head = index.slice(0, index.indexOf('</head>'));
  const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)].map(match => `<link rel="stylesheet" href="/${match[1]}" />`);
  assert.ok(links.length > 20, 'index.html stylesheets');
  const header = index.match(/<header class="chat-topbar"[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, 'chat-topbar markup');
  const topbar = header.replace(/(<nav class="account-actions"[^>]*>)[\s\S]*?(<\/nav>)/,
    '$1<a class="account-action account-login" href="#">로그인</a><a class="account-action account-signup" href="#">회원가입</a>$2');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${links.join('\n')}
</head><body class="chat-home-page">
<div class="chat-app-shell">
  <aside class="chat-sidebar chat-sidebar-desktop"><nav class="sidebar-nav"><div class="sidebar-history-shell"><div class="sidebar-history-scroll">
    <section class="nav-section sidebar-pinned-section" data-pinned-conversations-section hidden><h2 class="nav-section-title">고정</h2><ul class="nav-history-list"></ul></section>
    <section class="nav-section sidebar-history-section"><ul class="nav-history-list">
      <li class="conversation-history-item"><button type="button" class="conversation-history-open"><span>시험 대화</span></button>
        <details class="conversation-history-actions" data-conversation-menu><summary class="conversation-history-menu-trigger">⋯</summary>
          <div class="conversation-history-menu" role="menu"><button type="button" role="menuitem">상단에 고정</button><button type="button" role="menuitem">이름 바꾸기</button><button type="button" role="menuitem" class="conversation-history-delete">삭제</button></div>
        </details></li>
    </ul></section>
  </div></div></nav></aside>
  <main class="chat-home-shell" id="main-content">${topbar}
    <nav class="account-actions" data-unknown-probe><span class="account-auth-unknown"><button type="button" class="account-auth-retry">다시 확인</button><a class="account-auth-login" href="#">로그인</a></span></nav>
  </main>
</div>
<div class="site-modal-backdrop consumer-workspace"><section class="site-modal consumer-section-panel"><div class="site-modal-content consumer-section-content">
  <div class="consumer-tabs" role="tablist"><button type="button" role="tab" data-care-tab="people" aria-selected="true">사람</button><button type="button" role="tab" data-care-tab="pets" aria-selected="false">반려동물</button></div>
  <div class="consumer-care-body" data-probe="people"><div class="person-care-surface"><div class="person-empty person-empty-panel"><p>로그인하면 사람 안심케어를 사용할 수 있습니다.</p><a class="site-button site-button-primary person-login-link" href="/auth/start/">로그인</a></div></div></div>
  <div class="consumer-care-body" data-probe="pets"><div class="pet-family-surface"><div class="pet-empty"><p class="pet-empty-title">로그인하면 반려동물을 등록할 수 있습니다.</p><p class="pet-empty-copy">반려동물 정보와 사진은 계정에 비공개로 저장됩니다.</p><a class="site-button site-button-primary pet-login-link" href="/auth/start/">로그인</a></div></div></div>
</div></section></div>
<section class="calendar-settings-dialog" role="dialog"><div class="calendar-settings-body">
  <section><h4>표시</h4>
    <label class="calendar-settings-toggle-row" data-probe="on"><span><strong>격자선 표시</strong><small>날짜 칸 사이의 선을 표시합니다.</small></span><input type="checkbox" checked aria-label="격자선 표시"></label>
    <label class="calendar-settings-toggle-row" data-probe="off"><span><strong>음력 표시</strong><small>날짜 칸에 음력 날짜를 함께 표시합니다.</small></span><input type="checkbox" aria-label="음력 표시"></label>
  </section>
  <section class="calendar-settings-section"><div class="calendar-settings-action-row"><span><strong>현재 위치 자동 사용</strong></span><button type="button" class="calendar-location-switch" role="switch" aria-checked="false">OFF</button></div></section>
</div></section>
<div class="wallet-gate"><div class="wallet-lock-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2"></rect></svg></div></div>
</body></html>`;
}

const MEASURE = `(() => {
  const box = el => { const r = el.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
  const out = {};
  const header = document.querySelector('header.chat-topbar');
  out.login = box(document.querySelector('header .account-login'));
  out.signup = box(document.querySelector('header .account-signup'));
  const unknown = document.querySelector('[data-unknown-probe]');
  out.unknown = [...unknown.querySelectorAll('button, a')].map(box);
  unknown.remove();
  out.topbar = box(header);
  const tabs = [...document.querySelectorAll('.consumer-tabs [role=tab]')].map(box);
  out.tabs = tabs;
  const shape = (panel, title, link) => ({
    border: cs(panel).borderTopStyle, align: cs(panel).textAlign, justify: cs(panel).justifyItems, padding: cs(panel).padding,
    titleSize: cs(title).fontSize, titleWeight: cs(title).fontWeight, titleColor: cs(title).color,
    linkDecoration: cs(link).textDecorationLine, linkBg: cs(link).backgroundColor,
  });
  out.people = shape(document.querySelector('.person-empty-panel'), document.querySelector('.person-empty-panel > p'), document.querySelector('.person-login-link'));
  out.pets = shape(document.querySelector('.pet-empty'), document.querySelector('.pet-empty-title'), document.querySelector('.pet-login-link'));
  const row = name => document.querySelector('[data-probe="' + name + '"]');
  const sw = name => { const input = row(name).querySelector('input'); return {...box(input), appearance: cs(input).appearance, bg: cs(input).backgroundColor, word: cs(row(name), '::after').content}; };
  out.switchOn = sw('on'); out.switchOff = sw('off');
  const location = document.querySelector('.calendar-location-switch');
  out.location = {...box(location), bg: cs(location).backgroundColor};
  location.setAttribute('aria-checked', 'true');
  out.locationOn = {bg: cs(location).backgroundColor};
  const mark = document.querySelector('.wallet-lock-mark svg');
  out.lock = {...box(mark), fill: cs(mark).fill, stroke: cs(mark).stroke, ink: cs(mark.parentElement).color};
  return out;
})()`;

// The desktop sidebar (where the pinned section and the ⋯ menus live) is not
// rendered at phone width, so these are read at 1280.
const SIDEBAR = `(() => {
  const box = el => { const r = el.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; };
  const pinned = document.querySelector('[data-pinned-conversations-section]');
  const details = document.querySelector('details[data-conversation-menu]');
  const items = [...details.querySelectorAll('[role=menuitem]')];
  const focusable = () => { items[2].focus(); const ok = document.activeElement === items[2]; items[2].blur(); return ok; };
  const out = {pinned: getComputedStyle(pinned).display, pinnedHeight: box(pinned).h};
  out.menuClosed = {sizes: items.map(box), deleteFocusable: focusable()};
  details.open = true;
  out.menuOpen = {sizes: items.map(box), deleteFocusable: focusable()};
  details.open = false;
  return out;
})()`;

// Conversation mode is left alone: the new rule is scoped to
// :not(.conversation-active), and the page reloads site-conversation.css at
// runtime, which a static fixture cannot reproduce, so it is not measured here.
const BG = `(() => ({
  topbar: getComputedStyle(document.querySelector('header.chat-topbar')).backgroundColor,
  shell: getComputedStyle(document.querySelector('.chat-home-shell')).backgroundColor,
}))()`;

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.common-ui-polish-01-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'fixture.html'), fixtureHtml(), 'utf8');
  const port = await new Promise((resolve, reject) => {
    server.stdout.once('data', chunk => resolve(String(chunk).trim()));
    server.once('error', reject);
  });
  const url = `http://127.0.0.1:${port}/scripts/${path.basename(dir)}/fixture.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
      return result.result.value;
    };
    const load = async (width, height, theme) => {
      await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
      await page('Page.navigate', {url: `${url}?w=${width}&t=${theme}`});
      await waitFor(() => evaluate('document.readyState === "complete" && document.styleSheets.length > 20'), 'fixture load');
      await evaluate(`(() => { document.body.dataset.siteTheme = ${JSON.stringify(theme)}; return document.fonts ? document.fonts.ready.then(() => true) : true; })()`);
    };
    await page('Page.enable');
    await page('Runtime.enable');

    await load(390, 844, 'light');
    const phone = await evaluate(MEASURE);

    check('#20 header sign-in actions reach 44px', () => {
      assert.ok(phone.login.h >= 44 && phone.signup.h >= 44, JSON.stringify([phone.login, phone.signup]));
      assert.ok(phone.unknown.every(size => size.h >= 44), JSON.stringify(phone.unknown));
      assert.ok(phone.topbar.h <= 64, `topbar must not grow: ${phone.topbar.h}`);
    });
    check('#20 안심케어 tabs reach 44px wide', () => assert.ok(phone.tabs.every(size => size.w >= 44 && size.h >= 44), JSON.stringify(phone.tabs)));
    check('#25 signed-out 사람 matches 반려동물', () => {
      for (const key of ['border', 'align', 'justify', 'padding', 'titleSize', 'titleWeight', 'titleColor', 'linkDecoration', 'linkBg']) {
        assert.equal(phone.people[key], phone.pets[key], `${key}: ${phone.people[key]} vs ${phone.pets[key]}`);
      }
      assert.equal(phone.people.border, 'none');
      assert.equal(phone.people.linkDecoration, 'none');
    });
    check('#26 calendar checkboxes draw the location switch', () => {
      for (const sw of [phone.switchOn, phone.switchOff]) {
        assert.equal(sw.appearance, 'none');
        assert.equal(sw.w, phone.location.w);
        assert.equal(sw.h, phone.location.h);
      }
      assert.equal(phone.switchOff.bg, phone.location.bg, 'off track = location off track');
      assert.equal(phone.switchOn.bg, phone.locationOn.bg, 'on track = location on track');
      assert.equal(phone.switchOn.word, '"ON"');
      assert.equal(phone.switchOff.word, '"OFF"');
    });
    check('#21 padlock renders as the approved stroked 28px mobile icon', () => {
      assert.deepEqual([phone.lock.w, phone.lock.h], [28, 28]);
      assert.equal(phone.lock.fill, 'none');
      assert.equal(phone.lock.stroke, phone.lock.ink);
    });

    await load(1280, 900, 'dark');
    const darkHome = await evaluate(BG);
    await load(1280, 900, 'light');
    const lightHome = await evaluate(BG);
    const sidebar = await evaluate(SIDEBAR);
    check('#17 an empty pinned section stays hidden', () => {
      assert.equal(sidebar.pinned, 'none');
      assert.equal(sidebar.pinnedHeight, 0);
    });
    check('#18 a closed ⋯ menu is out of layout and focus', () => {
      assert.deepEqual(sidebar.menuClosed.sizes, [{w: 0, h: 0}, {w: 0, h: 0}, {w: 0, h: 0}]);
      assert.equal(sidebar.menuClosed.deleteFocusable, false);
      assert.ok(sidebar.menuOpen.sizes.every(size => size.w > 0 && size.h > 0), JSON.stringify(sidebar.menuOpen));
      assert.equal(sidebar.menuOpen.deleteFocusable, true);
    });
    check('#19 the Dark home topbar takes the home surface', () => {
      assert.equal(darkHome.topbar, darkHome.shell, JSON.stringify(darkHome));
      assert.equal(darkHome.shell, 'rgb(33, 33, 33)');
      assert.equal(lightHome.topbar, lightHome.shell);
    });
  } finally {
    cdp.close();
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`COMMON-UI-POLISH-01 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
