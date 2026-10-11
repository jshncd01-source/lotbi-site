// SITE-SUBSCRIBE-DARK-CONTRAST-01 — QA 화면 전수 01 N1 (P1).
//
// /subscribe is where a purchase starts. In Dark the three plan buttons and the
// 추천 badge painted #fff labels on --brand-navy, which Dark resolves to #f5f5f5:
// 1.09:1, unreadable. The static-theme gate only ever measured .plan-buy, so the
// other two surfaces drifted. This gate measures what the browser actually paints
// on the real subscribe.html with its real stylesheets, in every way Dark can
// reach the page, plus Light so the fix cannot cost the light page its contrast.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0;
const check = (label, fn) => { fn(); passed += 1; };

const subscribe = read('subscribe.html');
const staticTheme = read('site-static-theme.css');

check('subscribe.html has three plan buttons and one 추천 badge', () => {
  assert.equal((subscribe.match(/<a class="plan-card-cta"/g) || []).length, 3);
  assert.equal((subscribe.match(/class="recommended-badge"/g) || []).length, 1);
  for (const label of ['Basic 시작하기', 'Plus 시작하기', 'Pro로 업그레이드']) assert.ok(subscribe.includes(label), label);
});

// The cascade has to be beaten by selector weight, not by luck of source order:
// subscribe.css writes the link colour five classes deep, :hover and :visited deeper.
check('every Dark route repeats the plan-button path (base, :visited, :hover) and the badge', () => {
  const heads = [
    'html[data-site-theme-bootstrap="dark"]',
    'html[data-site-theme-bootstrap="system"]',
    'html:not([data-site-theme-bootstrap])',
  ];
  for (const head of heads) {
    for (const state of ['', ':visited', ':hover']) {
      assert.ok(staticTheme.includes(`${head} .plan-picker .plan-grid .plan-card a.plan-card-cta${state}`), `${head} ${state}`);
    }
    assert.ok(staticTheme.includes(`${head} .recommended-badge`), `${head} badge`);
  }
});

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the SITE-SUBSCRIBE-DARK-CONTRAST-01 validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
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

// Effective colours as painted: the label's computed colour against the first
// opaque background at or above the element.
const MEASURE = `(() => {
  const parse = value => {
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    const [r, g, b, a = 1] = m[1].split(',').map(part => Number.parseFloat(part));
    return {r, g, b, a};
  };
  const lum = ({r, g, b}) => [r, g, b].map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const backdrop = el => {
    for (let node = el; node; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg.a > 0.99) return bg;
    }
    return {r: 255, g: 255, b: 255, a: 1};
  };
  const read = el => {
    const style = getComputedStyle(el);
    const fg = parse(style.color);
    const bg = backdrop(el);
    return {text: el.textContent.trim(), color: style.color, background: style.backgroundColor, ratio: Number(ratio(fg, bg).toFixed(2))};
  };
  return {
    buttons: [...document.querySelectorAll('.plan-picker .plan-card a.plan-card-cta')].map(read),
    badge: [...document.querySelectorAll('.recommended-badge')].map(read),
    buy: [...document.querySelectorAll('.plan-buy')].map(read),
  };
})()`;

const MODES = {
  // [html attribute (null = absent), emulated device scheme]
  'light': ['light', 'light'],
  'explicit dark': ['dark', 'light'],
  'system, device dark': ['system', 'dark'],
  'no theme attribute, device dark': [null, 'dark'],
};

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts', '.subscribe-dark-contrast-'));
const server = startServer();
try {
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
    await page('DOM.enable');
    await page('CSS.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    await page('Page.navigate', {url: `http://127.0.0.1:${port}/subscribe.html`});
    await waitFor(() => evaluate('document.readyState === "complete" && document.styleSheets.length >= 4 && document.querySelectorAll(".plan-card-cta").length === 3'), 'subscribe load');

    for (const [name, [attribute, scheme]] of Object.entries(MODES)) {
      await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
      await evaluate(attribute === null
        ? 'document.documentElement.removeAttribute("data-site-theme-bootstrap"); true'
        : `document.documentElement.setAttribute("data-site-theme-bootstrap", ${JSON.stringify(attribute)}); true`);
      const measured = await evaluate(MEASURE);
      check(`${name}: three plan buttons and the badge are readable`, () => {
        assert.equal(measured.buttons.length, 3, JSON.stringify(measured));
        assert.equal(measured.badge.length, 1);
        for (const item of [...measured.buttons, ...measured.badge]) {
          assert.ok(item.ratio >= 4.5, `${name}: "${item.text}" ${item.color} on ${item.background} measures ${item.ratio}:1`);
        }
        console.log(`  ${name.padEnd(32)} buttons ${measured.buttons.map(item => item.ratio).join('/')}  badge ${measured.badge[0].ratio}`);
      });
      if (measured.buy.length) {
        check(`${name}: the purchase button that already worked keeps working`, () => {
          for (const item of measured.buy) assert.ok(item.ratio >= 4.5, `${item.text} ${item.ratio}`);
        });
      }
    }

    // The mouse-over state is its own rule (:hover is heavier than the base link),
    // so it is forced and measured rather than assumed from the resting state.
    for (const [name, [attribute, scheme]] of Object.entries(MODES)) {
      await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
      await evaluate(attribute === null
        ? 'document.documentElement.removeAttribute("data-site-theme-bootstrap"); true'
        : `document.documentElement.setAttribute("data-site-theme-bootstrap", ${JSON.stringify(attribute)}); true`);
      const {root} = await page('DOM.getDocument', {depth: 0});
      const {nodeIds} = await page('DOM.querySelectorAll', {nodeId: root.nodeId, selector: '.plan-picker .plan-card a.plan-card-cta'});
      assert.equal(nodeIds.length, 3);
      for (const nodeId of nodeIds) await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: ['hover']});
      const hovered = await evaluate(MEASURE);
      for (const nodeId of nodeIds) await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []});
      check(`${name}: hovered plan buttons are readable`, () => {
        for (const item of hovered.buttons) assert.ok(item.ratio >= 4.5, `${name} hover "${item.text}" ${item.color} on ${item.background} = ${item.ratio}:1`);
      });
    }
  } finally {
    cdp.close();
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`SITE-SUBSCRIBE-DARK-CONTRAST-01 PASS (${passed} checks; viewport emulation, not a device run)`);
