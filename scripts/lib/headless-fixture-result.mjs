// Serves the repository plus one in-memory fixture page, opens it in headless
// Chrome over the DevTools protocol and waits in real time for the page to publish
// its JSON result. Unlike --dump-dom with --virtual-time-budget, slow CI machines
// cannot dump the page before asynchronous image work has finished.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required for this browser validation.');
}

const TYPES = {'.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2'};

// `resultExpression` must evaluate to a string: empty while pending, JSON when done.
export async function runFixturePage({root, fixturePath, fixtureHtml, resultExpression, viewport = null, timeoutMs = 300_000}) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === fixturePath) { response.writeHead(200, {'content-type': TYPES['.html']}); response.end(fixtureHtml); return; }
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'}); response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-fixture-'));
  const chrome = spawn(browserPath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 600 && !fs.existsSync(portFile); attempt += 1) await delay(50);
    const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/u)[0];
    let page;
    for (let attempt = 0; attempt < 200 && !page; attempt += 1) {
      try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(target => target.type === 'page'); } catch {}
      if (!page) await delay(50);
    }
    if (!page) throw new Error('headless Chrome page target missing');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
    let messageId = 0; const pending = new Map();
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
    const send = (method, params = {}) => new Promise(resolve => { const id = ++messageId; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
    if (viewport) await send('Emulation.setDeviceMetricsOverride', {deviceScaleFactor: 1, mobile: false, ...viewport});
    await send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}${fixturePath}`});
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await delay(100);
      const evaluated = await send('Runtime.evaluate', {expression: resultExpression, returnByValue: true});
      const value = evaluated.result?.result?.value;
      if (value) return JSON.parse(value);
    }
    throw new Error(`fixture ${fixturePath} did not publish a result within ${timeoutMs}ms`);
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill(); server.close();
    for (let attempt = 0; attempt < 10; attempt += 1) { try { fs.rmSync(profile, {recursive: true, force: true}); break; } catch { await delay(200); } }
  }
}
