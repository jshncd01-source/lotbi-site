// SITE-CONNECTED-SERVICES-HIDE-01 — 소유자 결정 2026-10-11 (USER_FIRST 13).
//
// 연결 서비스's three partners are all still being prepared, so a visitor must not
// be sent to a page of things that are not ready. The three entry points (the
// desktop drawer, the phone drawer, the account menu) are hidden by ONE constant,
// and Account's own /connected-services page is left alone. This gate holds that
// the entries really are out of sight AND out of the keyboard's reach, that the
// neighbouring entries are not collateral, and that flipping the constant brings
// every one of them back — a switch that cannot be flipped back is a deletion.
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
const nav = read('site-sidebar-nav.css');

check('one constant, defined once, defaults to hidden', () => {
  assert.equal((conversation.match(/const CONNECTED_SERVICES_MENU_VISIBLE = (true|false);/g) || []).length, 1);
  assert.match(conversation, /const CONNECTED_SERVICES_MENU_VISIBLE = false;/);
  assert.match(conversation, /for \(const entry of document\.querySelectorAll\('\[data-consumer-section="mall"\]'\)\) entry\.hidden = !CONNECTED_SERVICES_MENU_VISIBLE;/);
  assert.match(conversation, /connectedServices\.hidden = !CONNECTED_SERVICES_MENU_VISIBLE;\r?\n\s+menu\.appendChild\(connectedServices\);/);
});

check('both drawer entries ship hidden (no flash before the script runs)', () => {
  const entries = [...index.matchAll(/<button[^>]*data-consumer-section="mall"[^>]*>/g)].map(match => match[0]);
  assert.equal(entries.length, 2);
  for (const entry of entries) assert.match(entry, /\shidden>/);
});

check('the stylesheet makes [hidden] win over the flex rows', () => {
  assert.match(nav, /\.nav-item\[data-consumer-section="mall"\]\[hidden\],\s*\.profile-popover \[role="menuitem"\]\[hidden\] \{\s*display: none;\s*\}/);
});

check("Account's own page is untouched by this change", () => {
  assert.match(conversation, /window\.location\.assign\('https:\/\/account\.lotbiai\.com\/connected-services'\)/);
  assert.match(conversation, /connectedServices\.href = 'https:\/\/account\.lotbiai\.com\/connected-services';/);
});

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the SITE-CONNECTED-SERVICES-HIDE-01 validation.');
}

// `visible` = serve site-conversation.js with the constant flipped, to prove the switch works.
function startServer(visible) {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const visible=${JSON.stringify(visible)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{
        if(error){res.writeHead(404);res.end();return;}
        if(visible&&path.basename(target)==='site-conversation.js'){data=Buffer.from(String(data).replace('const CONNECTED_SERVICES_MENU_VISIBLE = false;','const CONNECTED_SERVICES_MENU_VISIBLE = true;'));}
        res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);
      });
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

// The drawers as rendered, and the account menu's row rendered from the real stylesheet
// (the menu itself is built at sign-in, which this gate cannot do without a session).
const MEASURE = `(() => {
  const probe = document.createElement('div');
  probe.className = 'profile-popover';
  probe.innerHTML = '<a role="menuitem" data-probe="hidden-row" hidden>연결 서비스</a><a role="menuitem" data-probe="shown-row">도움말</a>';
  document.body.append(probe);
  const rows = [...document.querySelectorAll('[data-consumer-section]')].map(el => {
    const box = el.getBoundingClientRect();
    return {section: el.dataset.consumerSection, display: getComputedStyle(el).display, hidden: el.hidden, w: Math.round(box.width), h: Math.round(box.height), tab: el.tabIndex};
  });
  const out = {
    rows,
    menuHidden: getComputedStyle(probe.querySelector('[data-probe="hidden-row"]')).display,
    menuShown: getComputedStyle(probe.querySelector('[data-probe="shown-row"]')).display,
  };
  probe.remove();
  return out;
})()`;

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts', '.connected-services-hidden-'));
const servers = [];
try {
  async function session(visible, run) {
    const server = startServer(visible);
    servers.push(server);
    const port = await new Promise((resolve, reject) => {
      server.stdout.once('data', data => resolve(Number(String(data).trim())));
      server.once('error', reject);
    });
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
      await page('Page.enable');
      await page('Runtime.enable');
      const measure = async (width, height) => {
        await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
        await page('Page.navigate', {url: `http://127.0.0.1:${port}/index.html`});
        await waitFor(() => evaluate('document.readyState === "complete"'), 'index load');
        await sleep(1200);
        return evaluate(MEASURE);
      };
      await run(measure);
    } finally {
      cdp.close();
      server.kill('SIGTERM');
    }
  }

  await session(false, async measure => {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const m = await measure(width, height);
      const mall = m.rows.filter(row => row.section === 'mall');
      check(`${name}: switch off — the 연결 서비스 entries are out of sight and layout`, () => {
        assert.equal(mall.length, 2, JSON.stringify(m.rows));
        for (const row of mall) assert.deepEqual([row.display, row.hidden, row.w, row.h], ['none', true, 0, 0], JSON.stringify(row));
        assert.equal(m.menuHidden, 'none', 'account menu row');
        assert.notEqual(m.menuShown, 'none', 'neighbouring account menu rows stay');
      });
      check(`${name}: switch off — neighbouring entries are not collateral`, () => {
        const visibleSections = new Set(m.rows.filter(row => row.display !== 'none').map(row => row.section));
        assert.ok(visibleSections.has('life'), `지역정보 must stay: ${[...visibleSections]}`);
        assert.ok(visibleSections.size >= 3, [...visibleSections].join());
      });
    }
  });

  await session(true, async measure => {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const m = await measure(width, height);
      const mall = m.rows.filter(row => row.section === 'mall');
      check(`${name}: switch on — both entries come back`, () => {
        assert.equal(mall.length, 2);
        for (const row of mall) assert.equal(row.hidden, false, JSON.stringify(row));
      });
    }
  });
} finally {
  for (const server of servers) server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`SITE-CONNECTED-SERVICES-HIDE-01 PASS (${passed} checks; viewport emulation, the account menu row is measured as a stylesheet probe)`);
