// SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 — the 결론 banner reads first, in every theme.
//
// The banner (.scam-result-headline) sits on a fixed light tint per risk
// level. Its text used the theme token --lotbi-text-primary on the
// CURRENTLY_NO_RISK_SIGNAL mint, so dark mode drew #f5f5f5 on #e5f7ec and
// "확인한 범위에서는 이상한 점을 찾지 못했어요." all but vanished. Every risk level
// now pairs its tint with a fixed dark ink of the same hue.
//
// Static part: no banner color comes from a theme-flipping token.
// Browser part: real Chrome renders each of the five risk levels through the
// real form (analysis answered here) in light, dark and system+dark, and the
// computed colors must meet WCAG AA (4.5:1) for the banner, the 결론 heading,
// the result list and the dialog's buttons. Viewport emulation only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SCAM_BANNER_SHOTS || '';
const css = fs.readFileSync(path.join(ROOT, 'site-scam-shield.css'), 'utf8');


function browserPath() {
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
  throw new Error('Chrome/Chromium is required for the 진위확인 banner contrast validation.');
}

function startServer() {
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
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);
async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

// Account/Core answered offline; the dialog's session question answered
// "signed in"; each analysis answered with the risk level the test names.
const MOCK = `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  window.addEventListener('lotbi:scam-shield-request', event => {
    const level = window.__bannerLevel || 'UNVERIFIED';
    event.detail.resolve({riskLevel: level, headline: '확인한 범위에서는 이상한 점을 찾지 못했어요.', doNow: ['공식 번호로 다시 확인하세요.'], doNot: ['주소를 열지 마세요.'], reasons: ['검증용 응답'], confirmedFacts: ['문자에 외부 주소가 없습니다.'], unverifiedItems: ['발신 기관'], incidentTriage: null, evidence: []});
  });
})();`;

const LEVELS = ['CURRENTLY_NO_RISK_SIGNAL', 'UNVERIFIED', 'SUSPICIOUS', 'HIGH_RISK', 'CONFIRMED_MALICIOUS'];
const THEMES = [
  {label: 'light', cookie: 'light', media: 'light'},
  {label: 'dark', cookie: 'dark', media: 'light'},
  {label: 'system-dark', cookie: 'system', media: 'dark'},
];
const VIEWPORTS = [
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false},
];

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(async () => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
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

// WCAG 2.x relative luminance contrast of computed colors; the background is
// the first opaque one up the tree (alpha blended over it).
const MEASURE = `(() => {
  const parse = value => { const m = value.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
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
  const ratio = node => {
    if (!node) return null;
    const fg = parse(getComputedStyle(node).color), bg = backgroundOf(node);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return {ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, color: getComputedStyle(node).color, background: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')'};
  };
  const result = document.querySelector('[data-scam-result]');
  const banner = result.querySelector('.scam-result-headline');
  const dialog = document.querySelector('[data-scam-dialog]');
  return {
    level: result.dataset.riskLevel,
    text: banner?.textContent || '',
    theme: document.body.dataset.siteTheme || '',
    dialogBackground: getComputedStyle(dialog).backgroundColor,
    banner: ratio(banner),
    bannerBorder: banner ? getComputedStyle(banner).borderTopColor + ' ' + getComputedStyle(banner).borderTopWidth : '',
    heading: ratio(result.querySelector('h3')),
    item: ratio(result.querySelector('li')),
    submit: ratio(dialog.querySelector('.scam-submit')),
    close: ratio(dialog.querySelector('[data-scam-close]')),
  };
})()`;

async function runViewport(browser, origin, workDir, viewport, theme, measurements) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Network.enable');
    await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: theme.cookie, url: origin});
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile});
    if (viewport.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: theme.media}]});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
      return result.result.value;
    };
    const loaded = new Promise(resolve => {
      const stop = cdp.on(message => {
        if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); }
      });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    await page('Page.navigate', {url: `${origin}/`});
    await loaded;
    await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), 'conversation ready');
    const expectDark = theme.label !== 'light';
    await waitFor(async () => {
      const bg = await evaluate("getComputedStyle(document.body).backgroundColor");
      return (bg === 'rgb(33, 33, 33)') === expectDark ? true : {ok: false, bg};
    }, `${theme.label} theme applied`);
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
    for (const level of LEVELS) {
      await evaluate(`window.__bannerLevel = ${JSON.stringify(level)}; window.dispatchEvent(new CustomEvent('lotbi:scam-shield-close-request')); window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); true`);
      await waitFor(() => evaluate("(() => { const d = document.querySelector('[data-scam-dialog]'); return Boolean(d?.open && !document.querySelector('[data-scam-workspace]').hidden && !document.querySelector('[data-scam-methods]').hidden); })()"), 'scam workspace');
      await tap('[data-scam-methods] label:has(input[value="text"])');
      await waitFor(() => evaluate("!document.querySelector('#scam-text').disabled"), 'text panel');
      await evaluate("(() => { const t = document.querySelector('#scam-text'); t.value = '[국세청] 미납 세금 확인: 링크 확인 바랍니다'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()");
      await tap('[data-scam-dialog] .scam-submit');
      await waitFor(() => evaluate(`document.querySelector('[data-scam-result]')?.dataset.riskLevel === ${JSON.stringify(level)} && !document.querySelector('[data-scam-result]').hidden`), `${level} result`);
      await evaluate("document.querySelector('[data-scam-result] .scam-result-headline').scrollIntoView({block: 'center'}), true");
      await sleep(60);
      const measured = await evaluate(MEASURE);
      measurements.push({viewport: viewport.label, theme: theme.label, ...measured});
      if (SHOTS) {
        const {data} = await page('Page.captureScreenshot', {format: 'png'});
        fs.mkdirSync(SHOTS, {recursive: true});
        fs.writeFileSync(path.join(SHOTS, `${viewport.label}-${theme.label}-${level}.png`), Buffer.from(data, 'base64'));
      }
    }
  } finally {
    cdp.close();
    await sleep(300);
    try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
  }
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-scam-banner-'));
const server = startServer();
const measurements = [];
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const viewport of VIEWPORTS) for (const theme of THEMES) await runViewport(browser, origin, workDir, viewport, theme, measurements);
} finally {
  server.kill('SIGTERM');
  try { fs.rmSync(workDir, {recursive: true, force: true}); } catch {}
}
for (const item of measurements) {
  console.log(`  ${item.viewport} ${item.theme.padEnd(11)} ${item.level.padEnd(24)} banner ${String(item.banner.ratio).padStart(5)} (${item.banner.color} on ${item.banner.background}) heading ${item.heading.ratio} list ${item.item.ratio} submit ${item.submit.ratio} close ${item.close.ratio}`);
}
const bannerRules = [...css.matchAll(/([^{}]*\.scam-result-headline[^{}]*)\{([^}]*)\}/gu)];
assert.ok(bannerRules.length >= 3, 'banner rules found');
for (const [, selector, body] of bannerRules) {
  assert.doesNotMatch(body, /(?:^|;)\s*(?:color|background(?:-color)?)\s*:\s*var\(--lotbi-/u, `${selector.trim()}: banner ink and tint must not flip with the theme`);
}
for (const level of ['CURRENTLY_NO_RISK_SIGNAL', 'HIGH_RISK', 'CONFIRMED_MALICIOUS']) {
  assert.match(css, new RegExp(`\\.scam-result\\[data-risk-level="${level}"\\] \\.scam-result-headline`, 'u'), level);
}
console.log('SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 static PASS');
for (const item of measurements) {
  const where = `${item.viewport} ${item.theme} ${item.level}`;
  for (const key of ['banner', 'heading', 'item', 'submit', 'close']) {
    assert.ok(item[key] && item[key].ratio >= 4.5, `${where}: ${key} contrast ${JSON.stringify(item[key])} is below WCAG AA 4.5:1`);
  }
}
const noRisk = measurements.filter(item => item.level === 'CURRENTLY_NO_RISK_SIGNAL');
assert.ok(noRisk.every(item => item.text === '확인한 범위에서는 이상한 점을 찾지 못했어요.'), 'the reported sentence is the one measured');
console.log(`SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 PASS — ${measurements.length} renders (5 levels × light/dark/system-dark × 390/1280), WCAG AA; viewport emulation, not a device run`);
