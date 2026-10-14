// SCAM-PHISHING-REDESIGN-02 — shared headless-Chrome harness for the 사기·피싱 확인
// workspace validators (validate_scam_shield_*.mjs). Not a validator itself.
//
// Gate rules kept here (see validate_my_child_school_01): the Chrome profile is
// created before launch (the Linux gate runtime copies DevToolsActivePort into
// it), the work dir lives under scripts/.name-*, and cleanup retries.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);

export async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

export function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the 사기·피싱 확인 page validation.');
}

export function makeWorkDir(name) {
  return fs.mkdtempSync(path.join(ROOT, 'scripts', `.${name}-`));
}

export async function removeDir(dir) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); return; } catch { await sleep(150); }
  }
}

export function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.stat(target,(error,stat)=>send(res,!error&&stat.isDirectory()?path.join(target,'index.html'):target));
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  const server = spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
  const port = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
  return {server, origin: port.then(value => `http://127.0.0.1:${value}`), stop: () => server.kill('SIGTERM')};
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(async () => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort', 30000);
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
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

// Account/Core answered offline (signed out of Account, guest Core session).
export const BASE_MOCK = `
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  window.__scamNetwork = [];
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    window.__scamNetwork.push({url: url.href, form: init && init.body instanceof FormData, blob: init && init.body instanceof Blob});
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
`;

// One Chrome per call (a fresh profile each time). theme: {cookie, media};
// viewport: {width, height, mobile, userAgent?}. mock: page script source.
export async function openPage({browser, origin, workDir, viewport, theme = {cookie: 'light', media: 'light'}, mock, interceptFiles = false}) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const {targetInfos} = await cdp.send('Target.getTargets');
  const pageTarget = targetInfos.find(item => item.type === 'page');
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
  const page = (method, params) => cdp.send(method, params, sessionId);
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Network.enable');
  await page('DOM.enable');
  await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: theme.cookie, url: origin});
  await page('Page.addScriptToEvaluateOnNewDocument', {source: mock});
  if (viewport.userAgent) await page('Emulation.setUserAgentOverride', {userAgent: viewport.userAgent});
  await page('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: Boolean(viewport.mobile)});
  if (viewport.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: theme.media}]});
  if (interceptFiles) await page('Page.setInterceptFileChooserDialog', {enabled: true});
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 800));
    return result.result.value;
  };
  const loaded = new Promise(resolve => {
    const stop = cdp.on(message => {
      if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); }
    });
    setTimeout(() => { stop(); resolve(); }, 15000);
  });
  await page('Page.navigate', {url: `${origin}/`});
  await loaded;
  await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), 'conversation ready', 20000);
  const tap = async selector => {
    const box = await waitFor(() => evaluate(`(() => {
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.getClientRects().length && !item.closest('[inert], [hidden]'));
      if (!node) return null;
      node.scrollIntoView({block: 'center', inline: 'center'});
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
    })()`), `tap target ${selector}`);
    if (viewport.mobile) {
      await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x, y: box.y}]});
      await sleep(30);
      await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: box.x, y: box.y});
      await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1});
      await sleep(30);
      await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1});
    }
  };
  const screenshot = async file => {
    const {data} = await page('Page.captureScreenshot', {format: 'png'});
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };
  const close = async () => {
    cdp.close();
    await sleep(300);
    await removeDir(profile);
  };
  return {cdp, sessionId, page, evaluate, tap, screenshot, close};
}

// The page opens through the same event the menu, reload and login return use.
export const OPEN_PAGE = "window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); true";

// A fresh input screen: open the page if it is not open; on a result, press
// 다른 내용 확인하기 (what a person does), never close-and-reopen (the close
// steps back in history and would land after the reopen).
export async function freshInput(p) {
  await p.evaluate(`(() => {
    const ws = document.querySelector('.consumer-workspace[data-workspace="scam"]');
    if (!ws) { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); return true; }
    const reset = ws.querySelector('[data-scam-reset]');
    if (reset) reset.click();
    return true;
  })()`);
  await waitFor(() => p.evaluate(INPUT_READY), 'scam page input');
}
export const PAGE_READY = "(() => { const ws = document.querySelector('.consumer-workspace[data-workspace=\"scam\"]'); const root = ws?.querySelector('.scam-page'); return Boolean(ws && root && root.dataset.scamPhase && root.dataset.scamPhase !== 'checking'); })()";
export const INPUT_READY = "(() => document.querySelector('.consumer-workspace[data-workspace=\"scam\"] .scam-page')?.dataset.scamPhase === 'input')()";

// WCAG 2.x contrast of computed colors; the background is the first opaque one
// up the tree (alpha blended). Returns a function source usable in evaluate().
export const CONTRAST_FN = `(() => {
  const parse = value => { const m = String(value).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const backgroundOf = node => {
    const layers = [];
    for (let el = node; el; el = el.parentElement) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = {r: 255, g: 255, b: 255};
    for (const layer of layers.reverse()) base = {r: layer.r * layer.a + base.r * (1 - layer.a), g: layer.g * layer.a + base.g * (1 - layer.a), b: layer.b * layer.a + base.b * (1 - layer.a)};
    return base;
  };
  return node => {
    if (!node) return null;
    const fg = parse(getComputedStyle(node).color), bg = backgroundOf(node);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return {ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, color: getComputedStyle(node).color, background: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')'};
  };
})()`;

export const THEMES = Object.freeze([
  {label: 'light', cookie: 'light', media: 'light', dark: false},
  {label: 'dark', cookie: 'dark', media: 'light', dark: true},
  {label: 'system-dark', cookie: 'system', media: 'dark', dark: true},
]);

export async function waitTheme(evaluate, dark, label) {
  await waitFor(async () => {
    const bg = await evaluate('getComputedStyle(document.body).backgroundColor');
    return (bg === 'rgb(33, 33, 33)') === dark ? true : {ok: false, bg};
  }, `${label} theme applied`);
}
