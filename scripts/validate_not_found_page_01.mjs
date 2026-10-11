// SITE-404-LOTBI-01 — QA 화면 전수 01 N4 (P1).
//
// A mistyped address used to reach nginx's own English "404 Not Found nginx" page:
// no logo, no way back, no viewport (so phone text was pinhead small) and white
// in Dark. The repository already had a themed 404.html but nginx never served it
// (no error_page). This gate holds both halves: the nginx wiring, and what the
// page looks like to a person — measured in Chrome with the same substitution
// nginx performs (a missing deep path answered by 404.html, address bar kept).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0;
const check = (label, fn) => { fn(); passed += 1; };

const nginx = read('nginx/default.conf.template');
const page = read('404.html');

check('nginx answers every missing path with the LOTBI page, still as 404', () => {
  assert.match(nginx, /^\s*error_page 404 \/404\.html;/m);
  assert.match(nginx, /location = \/404\.html \{\s*internal;\s*\}/);
  // The status is kept (error_page 404 without "=200"), so crawlers still see a 404.
  assert.doesNotMatch(nginx, /error_page 404 =\d+/);
});

check('the page reads as a person would want it to', () => {
  assert.match(page, /<html lang="ko">/);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
  assert.match(page, /<meta name="robots" content="noindex,nofollow" \/>/);
  assert.match(page, /<h1 id="not-found-title">찾으시는 페이지를 찾을 수 없어요<\/h1>/);
  assert.match(page, /<a class="primary-link" href="\/">LOTBI 홈으로 가기<\/a>/);
  assert.match(page, /<a class="not-found-secondary" href="\/contact">문의하기<\/a>/);
  // The old developer memo and the English eyebrow are gone.
  assert.doesNotMatch(page, /주소는 그대로 유지했습니다|아직 제공하지 않습니다|class="kicker"/);
});

// nginx keeps the requested address, so a relative URL in this page resolves
// against that address and a mistyped deep path would load it unstyled.
check('every URL the page loads is absolute', () => {
  const relative = [...page.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1])
    .filter(url => !/^(\/|https?:|mailto:|tel:|data:)/.test(url));
  assert.deepEqual(relative, []);
});

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the SITE-404-LOTBI-01 validation.');
}

// Same substitution as nginx: a file that exists is served; anything else is
// answered by /404.html with status 404 and the requested URL left alone.
function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      const missing=()=>fs.readFile(path.join(root,'404.html'),(e,d)=>{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(d);});
      if(!target.startsWith(root)||pathname==='/404.html'){missing();return;}
      fs.stat(target,(error,stat)=>{
        if(error||!stat.isFile()){missing();return;}
        fs.readFile(target,(readError,data)=>{if(readError){missing();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
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

const MEASURE = `(() => {
  const parse = value => {
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    const [r, g, b, a = 1] = m[1].split(',').map(part => Number.parseFloat(part));
    return {r, g, b, a};
  };
  const lum = ({r, g, b}) => [r, g, b].map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)); };
  const backdrop = el => {
    for (let node = el; node; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg.a > 0.99) return bg;
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };
  const action = el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {text: el.textContent.trim(), height: Math.round(box.height), size: Number.parseFloat(style.fontSize), ratio: ratio(parse(style.color), backdrop(el))};
  };
  const h1 = document.querySelector('h1');
  const lead = document.querySelector('.not-found-lead');
  const mark = document.querySelector('.not-found-mark');
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    h1: {text: h1.textContent.trim(), size: Number.parseFloat(getComputedStyle(h1).fontSize), ratio: ratio(parse(getComputedStyle(h1).color), backdrop(h1))},
    lead: {size: Number.parseFloat(getComputedStyle(lead).fontSize), ratio: ratio(parse(getComputedStyle(lead).color), backdrop(lead))},
    actions: [...document.querySelectorAll('.not-found-actions a')].map(action),
    markWidth: Math.round(mark.getBoundingClientRect().width),
    sheets: document.styleSheets.length,
    footerLinks: document.querySelectorAll('.footer-links a').length,
    path: location.pathname,
  };
})()`;

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts', '.not-found-page-'));
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
    const page_ = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page_('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
      return result.result.value;
    };
    await page_('Page.enable');
    await page_('Runtime.enable');

    const load = async (width, height, scheme, attribute, urlPath) => {
      await page_('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
      await page_('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
      await page_('Page.navigate', {url: `http://127.0.0.1:${port}${urlPath}`});
      await waitFor(() => evaluate('document.readyState === "complete" && document.querySelector(".not-found") !== null'), '404 page load');
      await evaluate(`document.documentElement.setAttribute("data-site-theme-bootstrap", ${JSON.stringify(attribute)}); true`);
      await sleep(150);
      return evaluate(MEASURE);
    };

    const DEEP = '/does/not/exist/at/all?x=1';
    for (const [name, width, height, scheme, attribute] of [
      ['phone, light', 390, 844, 'light', 'light'],
      ['phone, dark', 390, 844, 'dark', 'dark'],
      ['phone, device dark', 390, 844, 'dark', 'system'],
      ['desktop, light', 1280, 900, 'light', 'light'],
      ['desktop, dark', 1280, 900, 'dark', 'dark'],
    ]) {
      const m = await load(width, height, scheme, attribute, DEEP);
      check(`${name}: styled, one line to read, two buttons to press`, () => {
        // Stylesheets loaded although the address is four folders deep.
        assert.ok(m.sheets >= 4, `stylesheets ${m.sheets}`);
        assert.equal(m.path, '/does/not/exist/at/all');
        assert.equal(m.h1.text, '찾으시는 페이지를 찾을 수 없어요');
        assert.ok(m.h1.size >= 22 && m.h1.ratio >= 4.5, JSON.stringify(m.h1));
        // 16px body text; phone width means the viewport meta is honoured.
        assert.ok(m.lead.size >= 16 && m.lead.ratio >= 4.5, JSON.stringify(m.lead));
        if (width < 768) assert.equal(m.innerWidth, width, 'viewport meta must make the phone layout width');
        assert.ok(m.scrollWidth <= m.innerWidth, `horizontal scroll ${m.scrollWidth} > ${m.innerWidth}`);
        assert.equal(m.actions.length, 2);
        assert.deepEqual(m.actions.map(item => item.text), ['LOTBI 홈으로 가기', '문의하기']);
        for (const item of m.actions) {
          assert.ok(item.height >= 48, `${item.text} height ${item.height}`);
          assert.ok(item.size >= 16, `${item.text} font ${item.size}`);
          assert.ok(item.ratio >= 4.5, `${item.text} measures ${item.ratio}:1`);
        }
        assert.equal(m.markWidth, 96);
        assert.ok(m.footerLinks >= 5);
        console.log(`  ${name.padEnd(20)} h1 ${m.h1.size}px/${m.h1.ratio}:1  lead ${m.lead.size}px  buttons ${m.actions.map(item => `${item.height}px/${item.ratio}:1`).join(' ')}`);
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

console.log(`SITE-404-LOTBI-01 PASS (${passed} checks; viewport emulation, nginx substitution emulated — the docker smoke step checks the real server)`);
