// COMMON-UI-POLISH-02 — QA 일괄보고 02 공통 항목(Site): C6·C7·C8·C9·D4·E2·E3.
// (D2·D3 = 안심케어 방, E1 = 상품권 방. Account 쪽 C1·C3·C4·C5는 web branch.)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0;
const check = (label, fn) => { fn(); passed += 1; };

const conversation = read('site-conversation.js');
const scam = read('site-scam-shield.js');
const docsCss = read('site-consumer-documents.css');
const index = read('index.html');
const PAGES = ['about', 'subscribe', 'refund', 'exchange', 'dispute', 'terms', 'privacy', 'account-deletion', 'contact'];

check('C9 pinned chats carry no second 고정 badge', () => {
  const body = conversation.slice(conversation.indexOf('const renderRecent = () => {'), conversation.indexOf('const appendPersistedMessage'));
  assert.doesNotMatch(body, /conversation-history-pin/);
  assert.match(body, /data-pinned-conversations/, 'the 고정 section itself stays');
  assert.match(body, /summary\.setAttribute\('aria-label', `\$\{item\.title\} 대화 메뉴`\)/, 'the ⋯ button keeps its accessible name');
});

check('D4 technical checks fold away and the result scrolls into view', () => {
  assert.match(scam, /collapsedList\('확인된 내용', payload\.confirmedFacts\)/);
  assert.doesNotMatch(scam, /\blist\('확인된 내용'/);
  assert.match(scam, /function revealResult\(\)[\s\S]*?scrollIntoView/);
  const submit = scam.slice(scam.indexOf('async function submitAnalysis'), scam.indexOf('function returnToMethods'));
  assert.match(submit, /render\(payload\);\s*revealResult\(\);/);
  assert.match(submit, /renderUsageLimit\(error\);\s*revealResult\(\);/);
  assert.match(scam, /prefers-reduced-motion: reduce/, 'no smooth scroll for reduced motion');
});

check('E2 the nine footer pages share one top menu and no English eyebrow', () => {
  const menus = new Set();
  for (const page of PAGES) {
    const html = read(`${page}.html`);
    const menu = html.match(/<nav aria-label="주요 메뉴">([\s\S]*?)<\/nav>/)?.[1].replace(/\s+/g, '');
    assert.ok(menu, `${page}: top menu`);
    if (page !== 'contact') menus.add(menu);
  }
  assert.equal(menus.size, 1, `top menus differ: ${[...menus].join(' | ')}`);
  assert.match([...menus][0], /^<ahref="index\.html">홈<\/a><ahref="\/contact">문의<\/a>$/);
  assert.doesNotMatch(read('subscribe.html'), /class="kicker"/);
  assert.match(docsCss, /\.consumer-document \.kicker \{ display: none; \}/);
});

check('E3 the exchange page no longer shows a developer note', () => {
  const html = read('exchange.html');
  assert.doesNotMatch(html, /심사자료|<code>\/exchange<\/code>/);
  assert.match(html, /rel="canonical" href="https:\/\/lotbiai\.com\/exchange"/, 'the address itself is unchanged');
});

check('C6 the company page says what LOTBI does today, after the philosophy', () => {
  const html = read('about.html');
  const core = html.indexOf('LOTBI는 쇼핑몰이 아니라, 소비자가 모든 거래를 시작하는 관문입니다.');
  const today = html.indexOf('id="about-today-title"');
  const principles = html.indexOf('class="about-principles" aria-label="LOTBI 핵심 방향"');
  assert.ok(core > 0 && today > core && principles > today, 'order: philosophy, today, direction');
  for (const feature of ['캘린더', '지역정보', '안심케어', 'Life Wallet', '진위확인']) assert.ok(html.slice(today, principles).includes(feature), feature);
  assert.doesNotMatch(html.slice(today, principles), /구매할 수 있|자동으로 완료|결제/, 'no commerce overclaim');
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
  throw new Error('Chrome/Chromium is required for the COMMON-UI-POLISH-02 validation.');
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

// Home's own stylesheets in Home's order, around just the pieces under test. The body
// is in conversation mode: that is where QA measured these (the Home skin repaints
// the same elements and would hide the defect).
function fixtureHtml() {
  const head = index.slice(0, index.indexOf('</head>'));
  const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)].map(match => `<link rel="stylesheet" href="/${match[1]}" />`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />${links.join('\n')}</head><body class="chat-home-page conversation-active">
<div class="sidebar-nav"><span class="sidebar-profile-avatar" id="avatar">Q</span>
<ul class="nav-history-list"><li><details class="conversation-history-actions" open><summary class="conversation-history-menu-trigger">⋯</summary>
<div class="conversation-history-menu" role="menu"><button type="button" role="menuitem" class="conversation-history-delete" id="del">삭제</button></div></details></li></ul></div></body></html>`;
}

const CONTRAST = `(() => {
  const parse = value => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p); return Math.round(((x + .05) / (y + .05)) * 100) / 100; };
  const avatar = document.getElementById('avatar'); const del = document.getElementById('del');
  const menu = del.closest('.conversation-history-menu');
  const A = getComputedStyle(avatar), D = getComputedStyle(del), M = getComputedStyle(menu);
  return {avatar: ratio(A.color, A.backgroundColor), del: ratio(D.color, M.backgroundColor), delColor: D.color, avatarBg: A.backgroundColor};
})()`;

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.common-ui-polish-02-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'fixture.html'), fixtureHtml(), 'utf8');
  const port = await new Promise((resolve, reject) => {
    server.stdout.once('data', chunk => resolve(String(chunk).trim()));
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${port}`;
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
    const open = async (url, theme) => {
      await page('Page.navigate', {url});
      await waitFor(() => evaluate('document.readyState === "complete"'), 'load');
      if (theme) await evaluate(`document.body.dataset.siteTheme = ${JSON.stringify(theme)}; true`);
      await sleep(150);
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});

    const fixture = `${base}/scripts/${path.basename(dir)}/fixture.html`;
    await open(`${fixture}?light`, 'light');
    const light = await evaluate(CONTRAST);
    await open(`${fixture}?dark`, 'dark');
    const dark = await evaluate(CONTRAST);
    check('C7·C8 Dark initials and 삭제 reach readable contrast; Light is unchanged', () => {
      assert.ok(dark.avatar >= 4.5, `dark initials ${dark.avatar}`);
      assert.ok(dark.del >= 4.5, `dark 삭제 ${dark.del}`);
      assert.equal(light.delColor, 'rgb(160, 38, 69)', 'Light 삭제 colour unchanged');
      assert.equal(light.avatarBg, 'rgb(238, 240, 246)', 'Light initials ring unchanged');
      assert.ok(light.avatar >= 1 && light.del >= 4.5, 'Light 삭제 stays readable');
    });

    for (const pageName of ['about', 'privacy', 'contact']) {
      await open(`${base}/${pageName}.html`);
      const eyebrow = await evaluate(`(() => { const k = document.querySelector('.kicker'); return k ? getComputedStyle(k).display : 'absent'; })()`);
      check(`E2 ${pageName}: no English eyebrow is drawn`, () => assert.ok(eyebrow === 'none' || eyebrow === 'absent', `${pageName}: ${eyebrow}`));
    }
    await open(`${base}/about.html`);
    const about = await evaluate(`({today: !!document.getElementById('about-today-title'), overflow: document.documentElement.scrollWidth > innerWidth})`);
    check('C6 the new company-page block renders without overflow at 390px', () => {
      assert.equal(about.today, true);
      assert.equal(about.overflow, false);
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

console.log(`COMMON-UI-POLISH-02 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
