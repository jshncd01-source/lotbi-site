// SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 — 진위확인 로그인 안내: every button reads, in every theme.
//
// Signed out, 진위확인 shows "진위확인은 로그인 후 사용할 수 있어요" with
// 로그인하고 확인하기 and 취소. 취소 set only a fixed white fill
// (background: #fff) and no ink, so under color-scheme: dark it kept the
// browser's white button text: white on white, the label gone (Samsung
// Internet, 2026-10-08). The 로그인 안내 buttons and the dialog's other fixed
// fills (× and 구독 및 사용량 보기) now take fill and ink together from the
// LOTBI theme tokens.
//
// Static part: no hard-coded color in the 로그인 안내 rules, each fill comes
// with its ink, and every --lotbi-* token site-scam-shield.css uses is defined
// for both light and dark.
// Browser part: real Chrome opens 진위확인 signed out from the home entry at
// 360/375/390/412 (touch) and 1280 in light, dark, system+light and
// system+dark (and the system theme switching while the dialog is open). For
// the title, description, both buttons, × and the usage link it measures
// WCAG contrast of computed colors — text 4.5:1, button edge 3:1 — in the
// normal, hover, pressed (:active) and keyboard focus states, the disabled
// state (3:1, an inactive control), and the layout (inside the dialog, no
// clipped label, 44px targets). It then checks 취소, ×, back and 로그인 still
// work. The mobile header's 로그인 had the same fixed light fill under the
// dark theme's white ink (1.69:1); it is measured on the same pages.
// Viewport emulation only — not a device run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SCAM_LOGIN_SHOTS || '';
const css = fs.readFileSync(path.join(ROOT, 'site-scam-shield.css'), 'utf8');
const tokens = fs.readFileSync(path.join(ROOT, 'site-theme-tokens.css'), 'utf8');

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
  throw new Error('Chrome/Chromium is required for the 진위확인 로그인 안내 contrast validation.');
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

// Signed out: Account answers "not signed in", so the page's own session owner
// answers the dialog's session question with false and the 로그인 안내 shows.
// The login request is counted here and not passed on (it would leave for the
// real Account login).
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
  window.__scamLoginRequests = 0;
  window.addEventListener('lotbi:scam-shield-login-request', event => {
    event.stopImmediatePropagation();
    window.__scamLoginRequests += 1;
  });
})();`;

const THEMES = [
  {label: 'light', cookie: 'light', media: 'light', dark: false},
  {label: 'dark', cookie: 'dark', media: 'light', dark: true},
  {label: 'system-light', cookie: 'system', media: 'light', dark: false, switchTo: 'dark'},
  {label: 'system-dark', cookie: 'system', media: 'dark', dark: true, switchTo: 'light'},
];
const VIEWPORTS = [
  {label: '360x780', width: 360, height: 780, mobile: true},
  {label: '375x812', width: 375, height: 812, mobile: true},
  {label: '390x844', width: 390, height: 844, mobile: true},
  {label: '412x915', width: 412, height: 915, mobile: true},
  {label: '1280x900', width: 1280, height: 900, mobile: false},
];
// The close / back / login flow runs in these combinations.
const FLOW = new Set(['390x844 dark', '1280x900 light', '360x780 system-dark']);

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

// WCAG 2.x contrast of computed colors. Text is measured on the first opaque
// background up the tree; a button's edge is its fill or its border against
// the dialog surface, whichever stands out more.
const HELPERS = `
  const parse = value => { const m = String(value).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const blend = (top, base) => ({r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a)});
  const backgroundOf = node => {
    const layers = [];
    for (let el = node; el; el = el.parentElement) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = {r: 255, g: 255, b: 255};
    for (const layer of layers.reverse()) base = blend(layer, base);
    return base;
  };
  const css = c => 'rgb(' + [c.r, c.g, c.b].map(Math.round).join(', ') + ')';
  const dialog = document.querySelector('[data-scam-dialog]');
  const surface = backgroundOf(dialog);
  const text = node => {
    const style = getComputedStyle(node);
    const fg = blend(parse(style.color), backgroundOf(node));
    const bg = backgroundOf(node);
    return {ratio: contrast(fg, bg), color: style.color, background: css(bg), opacity: style.opacity};
  };
  const edge = node => {
    const style = getComputedStyle(node);
    const fill = parse(style.backgroundColor);
    const border = parse(style.borderTopColor);
    const borderWidth = parseFloat(style.borderTopWidth) || 0;
    const fillRatio = fill && fill.a > 0 ? contrast(blend(fill, surface), surface) : 1;
    const borderRatio = border && border.a > 0 && borderWidth > 0 && style.borderTopStyle !== 'none' ? contrast(blend(border, surface), surface) : 1;
    return {ratio: Math.max(fillRatio, borderRatio), fill: style.backgroundColor, border: style.borderTopColor + ' ' + style.borderTopWidth};
  };
  const ring = node => {
    const style = getComputedStyle(node);
    const color = parse(style.outlineColor);
    const width = parseFloat(style.outlineWidth) || 0;
    if (style.outlineStyle === 'none' || !color || width < 2) return {ratio: 0, outline: style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor};
    return {ratio: contrast(blend(color, surface), surface), outline: style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor};
  };
`;

const NODES = {
  title: '[data-scam-login-gate] h3',
  description: '[data-scam-login-gate] > p:not([data-scam-login-status])',
  login: '[data-scam-login]',
  cancel: '[data-scam-login-cancel]',
  close: '[data-scam-close]',
};

const MEASURE = `(() => {${HELPERS}
  const pick = selector => dialog.querySelector(selector);
  const out = {siteTheme: document.body.dataset.siteTheme || '', dark: getComputedStyle(document.body).backgroundColor === 'rgb(33, 33, 33)', surface: css(surface)};
  for (const [key, selector] of Object.entries(${JSON.stringify(NODES)})) {
    const node = pick(selector);
    out[key] = node ? {...text(node), label: node.textContent.trim(), aria: node.getAttribute('aria-label') || ''} : null;
  }
  for (const key of ['login', 'cancel']) out[key + 'Edge'] = edge(pick(${JSON.stringify(NODES)}[key]));
  // 구독 및 사용량 보기 (shown when the month's checks are used up) on the same surface.
  const usage = document.createElement('a');
  usage.className = 'scam-usage-link'; usage.href = '#'; usage.textContent = '구독 및 사용량 보기';
  pick('[data-scam-login-gate]').append(usage);
  out.usage = text(usage); out.usageEdge = edge(usage);
  usage.remove();
  // Layout: inside the dialog and the viewport, label not clipped, 44px targets.
  const box = node => { const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
  const d = box(dialog);
  const inner = box(dialog.querySelector('.scam-dialog-inner'));
  const buttons = ['login', 'cancel'].map(key => ({key, node: pick(${JSON.stringify(NODES)}[key])}));
  out.layout = {
    viewport: {width: innerWidth, height: innerHeight},
    dialog: d,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    innerOverflow: dialog.querySelector('.scam-dialog-inner').scrollWidth - dialog.querySelector('.scam-dialog-inner').clientWidth,
    buttons: buttons.map(({key, node}) => ({key, ...box(node), clipped: node.scrollWidth - node.clientWidth, lines: Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight || '20'))})),
    inner,
    gap: (() => { const [a, b] = buttons.map(item => box(item.node)); return Math.max(b.top - a.bottom, b.left - a.right, a.top - b.bottom, a.left - b.right); })(),
  };
  return out;
})()`;

const STATE = key => `(() => {${HELPERS}
  const node = dialog.querySelector(${JSON.stringify(NODES[key])});
  return {text: text(node), edge: edge(node), ring: ring(node), focusVisible: node.matches(':focus-visible')};
})()`;

const DISABLED = `(() => {${HELPERS}
  const nodes = ['[data-scam-login]', '[data-scam-login-cancel]'].map(selector => dialog.querySelector(selector));
  nodes.forEach(node => { node.disabled = true; });
  const out = nodes.map(node => ({text: text(node), edge: edge(node), cursor: getComputedStyle(node).cursor}));
  nodes.forEach(node => { node.disabled = false; });
  return out;
})()`;

const GATE_SHOWN = "(() => { const d = document.querySelector('[data-scam-dialog]'); const g = document.querySelector('[data-scam-login-gate]'); return Boolean(d?.open && g && !g.hidden && document.querySelector('[data-scam-workspace]').hidden); })()";
const DIALOG_CLOSED = "(() => { const d = document.querySelector('[data-scam-dialog]'); return Boolean(d && !d.open && location.hash !== '#scam'); })()";

async function runAll(browser, origin, workDir, measurements, flows) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const {browserContextId} = await cdp.send('Target.createBrowserContext');
        const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank', browserContextId});
        const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
        const page = (method, params) => cdp.send(method, params, sessionId);
        try {
          await runCombo(cdp, page, sessionId, origin, viewport, theme, measurements, flows);
        } finally {
          await cdp.send('Target.closeTarget', {targetId}).catch(() => {});
          await cdp.send('Target.disposeBrowserContext', {browserContextId}).catch(() => {});
        }
      }
    }
  } finally {
    cdp.close();
    await sleep(300);
    try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
  }
}

async function runCombo(cdp, page, sessionId, origin, viewport, theme, measurements, flows) {
  const where = `${viewport.label} ${theme.label}`;
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Network.enable');
  await page('DOM.enable');
  await page('CSS.enable');
  await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: theme.cookie, url: origin});
  await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
  await page('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile});
  if (viewport.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  const media = value => page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value}]});
  await media(theme.media);
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
  await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${where} conversation ready`);
  const expectTheme = async (dark, label) => waitFor(async () => {
    const bg = await evaluate("getComputedStyle(document.body).backgroundColor");
    return (bg === 'rgb(33, 33, 33)') === dark ? true : {ok: false, bg};
  }, `${where} ${label}`);
  await expectTheme(theme.dark, 'theme applied');

  const tap = async selector => {
    const point = await waitFor(() => evaluate(`(() => {
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.getClientRects().length && !item.closest('[inert], [hidden]'));
      if (!node) return null;
      node.scrollIntoView({block: 'center', inline: 'center'});
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
    })()`), `${where} tap target ${selector}`);
    if (viewport.mobile) {
      await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y}]});
      await sleep(30);
      await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: point.x, y: point.y});
      await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1});
      await sleep(30);
      await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1});
    }
  };
  const openGate = async () => {
    await tap('[data-scam-open]');
    await waitFor(() => evaluate(GATE_SHOWN), `${where} 로그인 안내 shown`);
    await sleep(80);
  };
  const forced = async (key, states) => {
    const {root} = await page('DOM.getDocument', {depth: 0});
    const {nodeId} = await page('DOM.querySelector', {nodeId: root.nodeId, selector: NODES[key]});
    await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: states});
    try { await sleep(40); return await evaluate(STATE(key)); }
    finally { await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []}); }
  };
  const shot = async name => {
    if (!SHOTS) return;
    const {data} = await page('Page.captureScreenshot', {format: 'png'});
    fs.mkdirSync(SHOTS, {recursive: true});
    fs.writeFileSync(path.join(SHOTS, `${viewport.label}-${name}.png`), Buffer.from(data, 'base64'));
  };

  // The header 로그인 (mobile, signed out) had the same fixed light fill.
  const headerLogin = async () => evaluate(`(() => {${HELPERS}
    const node = [...document.querySelectorAll('.account-login')].find(item => item.getClientRects().length && !item.closest('[hidden], [inert]'));
    return node ? {label: node.textContent.trim(), ...text(node)} : null;
  })()`);
  const header = viewport.mobile ? await waitFor(headerLogin, `${where} header 로그인 shown`) : await headerLogin();

  await openGate();
  const record = async (themeLabel, dark) => {
    const measured = await evaluate(MEASURE);
    if (themeLabel === theme.label) measured.headerLogin = header;
    measured.states = {};
    for (const key of ['login', 'cancel', 'close']) {
      measured.states[key] = {
        hover: await forced(key, ['hover']),
        active: await forced(key, ['hover', 'active', 'focus']),
        focus: await forced(key, ['focus', 'focus-visible']),
      };
    }
    measured.disabled = await evaluate(DISABLED);
    measurements.push({viewport: viewport.label, mobile: viewport.mobile, theme: themeLabel, expectDark: dark, ...measured});
    await shot(themeLabel);
  };
  await record(theme.label, theme.dark);

  // System theme switching while the dialog stays open.
  if (theme.switchTo) {
    await media(theme.switchTo);
    await expectTheme(theme.switchTo === 'dark', `system switch to ${theme.switchTo}`);
    await sleep(80);
    await record(`${theme.label}→${theme.switchTo}`, theme.switchTo === 'dark');
    await media(theme.media);
    await expectTheme(theme.dark, 'system switch back');
  }

  // Keyboard: from the focused 로그인 button, Tab reaches 취소 with a visible ring.
  if (!viewport.mobile) {
    await evaluate("document.querySelector('[data-scam-login]').focus(), true");
    await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
    await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
    const keyboard = await waitFor(() => evaluate(`(() => {${HELPERS}
      const node = document.activeElement;
      if (!node?.matches('[data-scam-login-cancel]')) return {ok: false, active: node?.outerHTML?.slice(0, 80)};
      return {ok: true, focusVisible: node.matches(':focus-visible'), ring: ring(node), text: text(node)};
    })()`), `${where} Tab to 취소`);
    measurements.at(-1).keyboard = keyboard;
  }

  if (!FLOW.has(where)) return;
  const flow = {where};
  // 취소 closes it and the URL leaves /#scam.
  await tap('[data-scam-login-cancel]');
  await waitFor(() => evaluate(DIALOG_CLOSED), `${where} 취소 closes`);
  flow.cancel = true;
  // × closes it.
  await openGate();
  await tap('[data-scam-close]');
  await waitFor(() => evaluate(DIALOG_CLOSED), `${where} × closes`);
  flow.close = true;
  // Back closes it.
  await openGate();
  await waitFor(() => evaluate("location.hash === '#scam'"), `${where} /#scam while open`);
  await evaluate('history.back(), true');
  await waitFor(() => evaluate(DIALOG_CLOSED), `${where} back closes`);
  flow.back = true;
  // 로그인하고 확인하기 asks the page to start login once and says so.
  await openGate();
  await tap('[data-scam-login]');
  flow.login = await waitFor(() => evaluate(`(() => {
    const status = document.querySelector('[data-scam-login-status]').textContent.trim();
    return window.__scamLoginRequests === 1 && status === '공식 LOTBI 로그인 화면으로 이동합니다.' ? {ok: true, status, requests: window.__scamLoginRequests} : {ok: false, status, requests: window.__scamLoginRequests};
  })()`), `${where} login request`);
  await shot(`${theme.label}-login-status`);
  await evaluate("sessionStorage.clear(), true");
  flows.push(flow);
}

// ---- static ----
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const ruleBodies = selectorPattern => [...css.matchAll(/([^{}]+)\{([^}]*)\}/gu)]
  .filter(([, selector]) => selectorPattern.test(selector))
  .map(([, selector, body]) => ({selector: selector.trim().replace(/^@media[^{]*\{\s*/u, ''), body}));
const declares = (body, property) => new RegExp(`(?:^|;|\\{)\\s*${property}\\s*:`, 'u').test(body);
const gateRules = ruleBodies(/\.scam-login-/u);
check(gateRules.length >= 4, '로그인 안내 rules found');
for (const {selector, body} of gateRules) {
  check(!/#[0-9a-f]{3,8}\b|rgba?\(/iu.test(body), `${selector}: 로그인 안내 colors come from the LOTBI theme tokens`);
}
const fillRules = [...ruleBodies(/\.scam-login-actions (?:button|\[data-scam-login\])\s*$/u), ...ruleBodies(/^\s*\.scam-dialog-close\s*$/u), ...ruleBodies(/^\s*\.scam-usage-link\s*$/u)];
check(fillRules.length >= 4, 'button base rules found');
for (const {selector, body} of fillRules) {
  if (declares(body, 'background') || declares(body, 'background-color')) check(declares(body, 'color'), `${selector}: a fill needs its own ink (color), or the browser's dark button text shows on it`);
  check(!/(?:^|;)\s*(?:color|background(?:-color)?|border(?:-color)?)\s*:[^;]*#[0-9a-f]{3,8}\b/iu.test(body), `${selector}: no fixed color`);
}
const darkBlock = tokens.match(/body\[data-site-theme="dark"\]\s*\{([^}]*)\}/u)?.[1] || '';
const lightBlock = tokens.match(/:root,\s*body\[data-site-theme="light"\]\s*\{([^}]*)\}/u)?.[1] || '';
const used = [...new Set([...css.matchAll(/var\((--lotbi-[a-z0-9-]+)/gu)].map(match => match[1]))];
for (const name of used) {
  check(new RegExp(`${name}\\s*:`, 'u').test(lightBlock), `${name} is defined for light`);
  check(new RegExp(`${name}\\s*:`, 'u').test(darkBlock), `${name} is defined for dark`);
}
console.log(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 static ${failures.length ? 'FAIL' : 'PASS'} — ${gateRules.length} 로그인 안내 rules token-only, ${used.length} --lotbi tokens defined in light and dark`);

// ---- browser ----
const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-scam-login-'));
const server = startServer();
const measurements = [];
const flows = [];
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  await runAll(browser, origin, workDir, measurements, flows);
} finally {
  server.kill('SIGTERM');
  try { fs.rmSync(workDir, {recursive: true, force: true}); } catch {}
}

const fmt = value => String(value).padStart(5);
for (const item of measurements) {
  const s = item.states;
  console.log(`  ${item.viewport.padEnd(8)} ${item.theme.padEnd(19)} surface ${item.surface} | 로그인 ${fmt(item.login.ratio)} edge ${fmt(item.loginEdge.ratio)} | 취소 ${fmt(item.cancel.ratio)} (${item.cancel.color} on ${item.cancel.background}) edge ${fmt(item.cancelEdge.ratio)} | × ${fmt(item.close.ratio)} | 제목 ${fmt(item.title.ratio)} 설명 ${fmt(item.description.ratio)} | 사용량 ${fmt(item.usage.ratio)} edge ${fmt(item.usageEdge.ratio)}`);
  console.log(`  ${''.padEnd(28)} hover 로그인 ${s.login.hover.text.ratio} 취소 ${s.cancel.hover.text.ratio} | 눌림 로그인 ${s.login.active.text.ratio} 취소 ${s.cancel.active.text.ratio} | focus ring 로그인 ${s.login.focus.ring.ratio} 취소 ${s.cancel.focus.ring.ratio} × ${s.close.focus.ring.ratio} | 비활성 로그인 ${item.disabled[0].text.ratio} 취소 ${item.disabled[1].text.ratio} | 버튼 ${item.layout.buttons.map(b => `${Math.round(b.width)}x${Math.round(b.height)}`).join(' / ')} 간격 ${Math.round(item.layout.gap)}${item.keyboard ? ` | Tab→취소 ring ${item.keyboard.ring.ratio}` : ''}${item.headerLogin ? ` | 헤더 로그인 ${item.headerLogin.ratio}` : ''}`);
}

for (const item of measurements) {
  const where = `${item.viewport} ${item.theme}`;
  check(item.dark === item.expectDark, `${where}: theme ${item.dark ? 'dark' : 'light'} expected ${item.expectDark ? 'dark' : 'light'}`);
  check(item.login?.label === '로그인하고 확인하기', `${where}: login label ${item.login?.label}`);
  check(item.cancel?.label === '취소', `${where}: cancel label ${item.cancel?.label}`);
  for (const key of ['title', 'description', 'login', 'cancel', 'close', 'usage']) check(item[key].ratio >= 4.5, `${where}: ${key} text ${JSON.stringify(item[key])} below 4.5:1`);
  for (const key of ['loginEdge', 'cancelEdge', 'usageEdge']) check(item[key].ratio >= 3, `${where}: ${key} ${JSON.stringify(item[key])} below 3:1 against the dialog`);
  for (const key of ['login', 'cancel', 'close']) {
    for (const state of ['hover', 'active', 'focus']) check(item.states[key][state].text.ratio >= 4.5, `${where}: ${key} ${state} text ${JSON.stringify(item.states[key][state].text)} below 4.5:1`);
    for (const state of ['hover', 'active']) if (key !== 'close') check(item.states[key][state].edge.ratio >= 3, `${where}: ${key} ${state} edge ${JSON.stringify(item.states[key][state].edge)} below 3:1`);
    check(item.states[key].focus.ring.ratio >= 3, `${where}: ${key} focus ring ${JSON.stringify(item.states[key].focus.ring)} below 3:1`);
  }
  for (const [index, disabled] of item.disabled.entries()) check(disabled.text.ratio >= 3, `${where}: disabled ${index ? '취소' : '로그인'} text ${JSON.stringify(disabled.text)} below 3:1`);
  if (item.headerLogin) check(item.headerLogin.ratio >= 4.5, `${where}: header 로그인 text ${JSON.stringify(item.headerLogin)} below 4.5:1`);
  if (item.mobile && !item.theme.includes('→')) check(item.headerLogin?.label === '로그인', `${where}: header 로그인 not measured`);
  if (item.keyboard) {
    check(item.keyboard.focusVisible, `${where}: Tab focus on 취소 is not :focus-visible`);
    check(item.keyboard.ring.ratio >= 3, `${where}: Tab focus ring ${JSON.stringify(item.keyboard.ring)} below 3:1`);
  }
  const {layout} = item;
  check(layout.pageOverflow <= 0, `${where}: page scrolls sideways by ${layout.pageOverflow}px`);
  check(layout.innerOverflow <= 0, `${where}: dialog body scrolls sideways by ${layout.innerOverflow}px`);
  check(layout.dialog.left >= -0.5 && layout.dialog.right <= layout.viewport.width + 0.5, `${where}: dialog outside the viewport ${JSON.stringify(layout.dialog)}`);
  for (const button of layout.buttons) {
    check(button.height >= 44, `${where}: ${button.key} is ${button.height}px tall`);
    check(button.clipped <= 0, `${where}: ${button.key} label clipped by ${button.clipped}px`);
    check(button.left >= layout.inner.left - 0.5 && button.right <= layout.inner.right + 0.5, `${where}: ${button.key} outside the dialog body`);
  }
  check(layout.gap >= 8, `${where}: buttons ${layout.gap}px apart`);
}
check(flows.length === FLOW.size, `close/back/login flow ran ${flows.length}/${FLOW.size}`);
for (const flow of flows) check(flow.cancel && flow.close && flow.back && flow.login?.ok, `${flow.where}: flow ${JSON.stringify(flow)}`);
if (failures.length) {
  console.error(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 FAIL — ${failures.length} problems:`);
  for (const failure of failures.slice(0, 60)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 PASS — ${measurements.length} renders (360/375/390/412/1280 × light/dark/system±dark + live system switch), text ≥4.5:1, edges/rings ≥3:1, hover/pressed/focus/disabled, 취소·×·back·로그인 flows ${flows.length}; viewport emulation, not a device run`);
