// LOTBI SITE P0 — chat composer in Dark, header 로그인/회원가입, KakaoTalk Share.
//
// Samsung Internet, 2026-10-09:
// 1. Dark: a white square edge appeared inside the rounded chat composer.
//    Measured cause: a focused textarea always matches :focus-visible, and the
//    Dark/system-Dark focus ring (site-theme-tokens.css, !important) beat
//    `.chat-input:focus-visible { outline: 0 }`, drawing a 3px #ededed
//    4px-cornered rectangle inside the 30px-rounded composer on every tap.
//    (SITE-CHAT-COMPOSER-DARK-FOCUS-01)
// 2. Header: Production 로그인 read 1.69:1 in Dark (fixed light fill under white
//    ink — fixed by SCAM-SHIELD-LOGIN-GATE-CONTRAST-01, not deployed yet). On
//    top of that 로그인 kept the Light edge #dde3ee and a #212121 pill on the
//    navy topbar. (SITE-HEADER-AUTH-BUTTONS-DARK-01)
// 3. Share showed only 링크 복사: Core never published kakao_share_ready, so
//    the KakaoTalk item stayed hidden (fail closed, by design). With Share
//    ready the item now comes first, says what it sends, and the SDK is
//    prepared when the menu opens so the tap reaches Kakao.Share.sendDefault
//    with user activation. (LOTBI-KAKAO-SHARE-ACTUAL-01)
//
// Real Chrome (headless, CDP). Viewport emulation only — not a Samsung
// Internet, Android Chrome or iPhone Safari device run. The Kakao SDK is a
// local stand-in served for the allowlisted SDK URL; the real KakaoTalk
// friend/chat picker is not exercised here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.CHAT_DARK_LOGIN_KAKAO_SHOTS || '';
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────────
const tokens = read('site-theme-tokens.css');
const homeChat = read('home-chat.css');
const conversation = read('site-conversation.js');
const kakaoModule = read('site-kakao-share.js');
for (const theme of ['dark', 'system']) {
  assert.match(tokens, new RegExp(`body\\[data-site-theme="${theme}"\\] \\.chat-composer \\.chat-input:focus-visible \\{\\s*outline: none !important;`), `${theme}: the textarea draws no ring of its own`);
  assert.match(tokens, new RegExp(`body\\[data-site-theme="${theme}"\\] \\.chat-composer-stack \\.chat-composer:focus-within \\{\\s*border-color: var\\(--lotbi-focus-ring\\);`), `${theme}: the rounded composer shows the focus`);
  assert.match(tokens, new RegExp(`body\\[data-site-theme="${theme}"\\] \\.account-login \\{\\s*border-color: var\\(--lotbi-border-strong\\);`), `${theme}: 로그인 edge is a Dark token`);
}
assert.match(homeChat, /\.account-login \{[^}]*background: transparent;/, '로그인 has no fill of its own');
assert.match(homeChat, /\.chat-input:focus-visible \{\s*outline: 0;/, 'Light keeps the textarea ring off');
assert.match(kakaoModule, /export async function prepareKakaoShare\(\)/);
assert.match(conversation, /shareMenu\.prepend\(kakao\)/);
assert.doesNotMatch(conversation, /navigator\.share\s*\(/, 'no generic OS share sheet');

// ── Harness ────────────────────────────────────────────────────────────────
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
  throw new Error('Chrome/Chromium is required for the chat Dark / header / KakaoTalk Share validation.');
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

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
const GUEST_TOKEN = 'g'.repeat(43);
const ANSWER = '전주 한옥마을 근처 공영주차장은 세 곳이 있어요. ' + '주말에는 오전 10시 전에 도착하면 자리가 넉넉한 편이에요. '.repeat(8);
const EXPECTED_SHARE_TEXT = ANSWER.length > 200 ? `${ANSWER.slice(0, 199)}…` : ANSWER;

// Signed out (guest). Core answers one guest turn; /app/config.json follows
// the mode: 'configured' = Share ready, 'unconfigured' = Production today.
const MOCK = mode => `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  window.__copied = [];
  try { Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => { window.__copied.push(String(text)); }}}); } catch {}
  window.__kakaoSendFails = ${JSON.stringify(mode === 'send-fails')};
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: ${JSON.stringify(GUEST_TOKEN)}, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (url.pathname === '/app/config.json') {
      return json({navigation: ${JSON.stringify(mode)} === 'unconfigured'
        ? {kakao_navi_ready: false, kakao_javascript_key: null, kakao_javascript_sdk_url: null}
        : {kakao_navi_ready: false, kakao_share_ready: true, kakao_javascript_key: 'fixture-public-js-key', kakao_javascript_sdk_url: ${JSON.stringify(SDK_URL)}}});
    }
    if (url.pathname === '/v2/conversation/guest/messages') {
      return json({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED', assistant_text: ${JSON.stringify(ANSWER)},
        response_mode: 'STANDARD', correlation_id: 'req_kakao_share_01', intent: {action: 'UNKNOWN'},
        follow_up: {required: false, action: 'UNKNOWN', automatic_execution: false}, sources: [], retry_safe: true,
        safety: {execution_authority: false, external_side_effect: false, transaction_created: false, order_created: false, payment_attempted: false, reservation_created: false, merchant_execution_started: false}});
    }
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

// Stand-in for the allowlisted SDK: records init/send and whether the send ran
// with the user's tap still active (a popup or app hand-off needs it).
const FAKE_SDK = `(() => {
  const calls = window.__kakaoCalls = window.__kakaoCalls || {init: [], send: []};
  let initialized = false;
  window.Kakao = {
    init(key) { calls.init.push(key); initialized = true; },
    isInitialized() { return initialized; },
    Share: {
      sendDefault(payload) {
        calls.send.push({payload: JSON.parse(JSON.stringify(payload)), active: navigator.userActivation ? navigator.userActivation.isActive : null});
        if (window.__kakaoSendFails) throw new Error('KAKAO_FIXTURE_SEND_FAILED');
      },
    },
  };
})();`;

const HELPERS = `
  const parse = value => { const m = String(value).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const blend = (top, base) => ({r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1});
  const backgroundOf = node => { const layers = []; for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let base = {r: 255, g: 255, b: 255, a: 1}; for (const l of layers.reverse()) base = blend(l, base); return base; };
  const css = c => 'rgb(' + [c.r, c.g, c.b].map(Math.round).join(', ') + ')';
  const visible = sel => [...document.querySelectorAll(sel)].find(n => n.getClientRects().length && !n.closest('[hidden], [inert]'));
  const box = n => { const r = n.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
`;

// Everything inside the composer that is not one of its round buttons: the
// textarea and layout boxes must paint nothing of their own.
const COMPOSER = `(() => {${HELPERS}
  const composer = document.querySelector('.chat-composer');
  const input = document.querySelector('#lotbi-prompt');
  const surface = backgroundOf(composer);
  const page = backgroundOf(composer.parentElement);
  const paints = [];
  for (const n of [input, ...composer.querySelectorAll('*')]) {
    if (n.closest('button, [hidden], [inert], .attachment-menu') || !n.getClientRects().length) continue;
    const s = getComputedStyle(n);
    const name = n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).join('.') : '');
    const oc = parse(s.outlineColor);
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && oc && oc.a > 0) paints.push({name, kind: 'outline', value: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor});
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const c = parse(s['border' + side + 'Color']);
      if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none' && c && c.a > 0) { paints.push({name, kind: 'border', value: side + ' ' + s['border' + side + 'Width'] + ' ' + s['border' + side + 'Color']}); break; }
    }
    const bg = parse(s.backgroundColor);
    if (bg && bg.a > 0 && css(blend(bg, surface)) !== css(surface)) paints.push({name, kind: 'background', value: s.backgroundColor});
    if (s.boxShadow !== 'none') paints.push({name, kind: 'shadow', value: s.boxShadow});
    if (s.backgroundImage !== 'none') paints.push({name, kind: 'background-image', value: s.backgroundImage.slice(0, 80)});
  }
  const cs = getComputedStyle(composer);
  const is = getComputedStyle(input);
  const border = parse(cs.borderTopColor);
  const ink = blend(parse(is.color), surface);
  const placeholder = blend(parse(getComputedStyle(input, '::placeholder').color), surface);
  const plus = visible('.attachment-button');
  const ib = box(input);
  const pad = {left: parseFloat(is.paddingLeft), right: parseFloat(is.paddingRight), top: parseFloat(is.paddingTop), bottom: parseFloat(is.paddingBottom)};
  const content = {left: ib.left + pad.left, right: ib.right - pad.right, top: ib.top + pad.top, bottom: ib.bottom - pad.bottom};
  const pb = plus ? box(plus) : null;
  return {
    siteTheme: document.body.dataset.siteTheme || '', dark: lum(surface) < 0.2,
    surface: css(surface), page: css(page),
    focused: document.activeElement === input, conversationActive: document.body.classList.contains('conversation-active'),
    radius: parseFloat(cs.borderTopLeftRadius), border: cs.borderTopColor + ' ' + cs.borderTopWidth, shadow: cs.boxShadow,
    borderVsPage: border ? contrast(blend(border, page), page) : 0,
    text: contrast(ink, surface), placeholder: contrast(placeholder, surface),
    inputOutline: is.outlineStyle + ' ' + is.outlineWidth, inputBackground: is.backgroundColor,
    plusOverlapsText: Boolean(pb && pb.left < content.right && pb.right > content.left && pb.top < content.bottom && pb.bottom > content.top),
    composerInViewport: box(composer).left >= 0 && box(composer).right <= innerWidth + 0.5,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    inputHeight: ib.height, value: input.value,
    paints,
  };
})()`;

const HEADER = `(() => {${HELPERS}
  const out = {vw: innerWidth, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
  for (const [key, sel] of [['login', '.account-login'], ['signup', '.account-signup']]) {
    const n = visible(sel);
    if (!n) { out[key] = null; continue; }
    const s = getComputedStyle(n);
    const under = backgroundOf(n.parentElement);
    const fill = backgroundOf(n);
    let opacity = 1; for (let el = n; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
    out[key] = {
      label: n.textContent.trim(), text: contrast(blend(parse(s.color), fill), fill), ownFill: s.backgroundColor, border: s.borderTopColor,
      fillVsTopbar: contrast(fill, under), opacity, filter: s.filter, ...box(n),
      radius: s.borderTopLeftRadius, fontSize: s.fontSize, fontWeight: s.fontWeight, padding: s.padding,
      clipped: n.scrollWidth - n.clientWidth, lines: Math.round(n.getBoundingClientRect().height / (parseFloat(s.lineHeight) || 20)),
    };
  }
  const header = visible('.account-login')?.closest('header');
  out.overlaps = [];
  if (header && out.login && out.signup) {
    const buttons = ['.account-login', '.account-signup'].map(visible);
    for (const el of header.querySelectorAll('a, button, img, svg, h1, [class*=brand], [class*=logo]')) {
      if (!el.getClientRects().length || buttons.some(b => b === el || b.contains(el) || el.contains(b))) continue;
      const a = el.getBoundingClientRect();
      for (const b of buttons) { const c = b.getBoundingClientRect(); if (a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5) out.overlaps.push((el.className || el.tagName) + ' x ' + b.className); }
    }
    const [l, r] = buttons.map(b => b.getBoundingClientRect());
    out.gap = r.left - l.right;
  }
  return out;
})()`;

const HEADER_RING = key => `(() => {${HELPERS}
  const n = visible(${JSON.stringify(key === 'login' ? '.account-login' : '.account-signup')});
  const s = getComputedStyle(n);
  const under = backgroundOf(n.parentElement);
  const c = parse(s.outlineColor);
  return {focusVisible: n.matches(':focus-visible'), width: parseFloat(s.outlineWidth) || 0, style: s.outlineStyle, ring: c && s.outlineStyle !== 'none' ? contrast(blend(c, under), under) : 0};
})()`;

const SHARE_MENU = `(() => {${HELPERS}
  const actions = [...document.querySelectorAll('.chat-message-actions')].pop();
  const menu = actions?.querySelector('.lotbi-share-menu');
  if (!menu || menu.hidden) return {ok: false, open: false};
  const surface = backgroundOf(menu);
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map(item => {
    const hint = item.querySelector('.lotbi-share-menu-hint');
    const described = item.getAttribute('aria-describedby');
    const s = getComputedStyle(item);
    return {
      label: item.getAttribute('aria-label'), action: item.dataset.shareAction,
      hint: hint?.textContent.trim() || '', describedBy: described ? document.getElementById(described)?.textContent.trim() || '' : '',
      text: contrast(blend(parse(s.color), surface), surface),
      hintText: hint ? contrast(blend(parse(getComputedStyle(hint).color), surface), surface) : null,
      height: item.getBoundingClientRect().height,
    };
  });
  const r = menu.getBoundingClientRect();
  return {ok: true, open: true, items, inViewport: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5, focused: document.activeElement?.dataset?.shareAction || document.activeElement?.dataset?.messageAction || ''};
})()`;

const THEMES = [
  {label: 'light', cookie: 'light', media: 'light', dark: false},
  {label: 'dark', cookie: 'dark', media: 'light', dark: true},
  {label: 'system-light', cookie: 'system', media: 'light', dark: false, switchTo: 'dark'},
  {label: 'system-dark', cookie: 'system', media: 'dark', dark: true, switchTo: 'light'},
];
const VIEWPORTS = [
  {label: '320x640', width: 320, height: 640, mobile: true},
  {label: '344x882-fold-cover', width: 344, height: 882, mobile: true},
  {label: '360x780', width: 360, height: 780, mobile: true},
  {label: '390x844', width: 390, height: 844, mobile: true},
  {label: '412x915', width: 412, height: 915, mobile: true},
  {label: '690x829-fold-open', width: 690, height: 829, mobile: true},
  {label: '1280x900', width: 1280, height: 900, mobile: false},
];
// One hand-off per page load (site-continuity keeps `redirecting` set), so
// 로그인 and 회원가입 are each followed on their own pages.
const NAV_FLOW = new Map([['360x780 dark', '.account-login'], ['412x915 system-dark', '.account-login'], ['390x844 light', '.account-signup'], ['360x780 light', '.account-signup'], ['412x915 dark', '.account-signup']]);
const SHARE_COMBOS = [
  {viewport: VIEWPORTS[2], theme: THEMES[1], mode: 'configured'},
  {viewport: VIEWPORTS[4], theme: THEMES[3], mode: 'configured'},
  {viewport: VIEWPORTS[3], theme: THEMES[0], mode: 'configured'},
  {viewport: VIEWPORTS[1], theme: THEMES[1], mode: 'configured'},
  {viewport: VIEWPORTS[6], theme: THEMES[1], mode: 'configured'},
  {viewport: VIEWPORTS[2], theme: THEMES[1], mode: 'unconfigured'},
  {viewport: VIEWPORTS[2], theme: THEMES[1], mode: 'sdk-missing'},
  {viewport: VIEWPORTS[3], theme: THEMES[0], mode: 'send-fails'},
];

async function openPage(cdp, origin, viewport, theme, mode = 'unconfigured') {
  const {browserContextId} = await cdp.send('Target.createBrowserContext');
  const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  const page = (method, params) => cdp.send(method, params, sessionId);
  const requests = {kakaoSdk: 0, documents: []};
  const stop = cdp.on(message => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
    const {requestId, request, resourceType} = message.params;
    if (request.url.startsWith('https://t1.kakaocdn.net/')) {
      requests.kakaoSdk += 1;
      const ok = mode !== 'sdk-missing' && request.url === SDK_URL;
      void page('Fetch.fulfillRequest', {
        requestId, responseCode: ok ? 200 : 404,
        responseHeaders: [{name: 'Content-Type', value: 'text/javascript'}, {name: 'Access-Control-Allow-Origin', value: '*'}],
        body: Buffer.from(ok ? FAKE_SDK : 'not found').toString('base64'),
      }).catch(() => {});
      return;
    }
    if (resourceType === 'Document' && requests.armed) {
      requests.documents.push(request.url);
      void page('Fetch.failRequest', {requestId, errorReason: 'Aborted'}).catch(() => {});
      return;
    }
    void page('Fetch.continueRequest', {requestId}).catch(() => {});
  });
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Network.enable');
  await page('DOM.enable');
  await page('CSS.enable');
  await page('Fetch.enable', {patterns: [{urlPattern: 'https://t1.kakaocdn.net/*'}, {urlPattern: '*', resourceType: 'Document'}]});
  await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: theme.cookie, url: origin});
  await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK(mode)});
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
    const off = cdp.on(message => {
      if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { off(); resolve(); }
    });
    setTimeout(() => { off(); resolve(); }, 10000);
  });
  await page('Page.navigate', {url: `${origin}/`});
  await loaded;
  await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), `${viewport.label} ${theme.label} conversation ready`);
  requests.armed = true;
  const where = `${viewport.label} ${theme.label}${mode === 'unconfigured' ? '' : ' ' + mode}`;
  // The conversation re-anchors a frame or two after its rows change height
  // (e.g. the share feedback line going away), so tap only once the target
  // has stayed put between two reads.
  let lastPoint = '';
  const point = async selector => waitFor(() => evaluate(`(() => {
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.getClientRects().length && !item.closest('[inert], [hidden]'));
    if (!node) return null;
    node.scrollIntoView({block: 'nearest', inline: 'nearest'});
    const rect = node.getBoundingClientRect();
    const x = rect.left + Math.min(rect.width / 2, 24), y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
  })()`).then(found => {
    const key = found ? `${Math.round(found.x)},${Math.round(found.y)}` : '';
    const stable = Boolean(found) && key === lastPoint;
    lastPoint = key;
    return stable ? found : null;
  }), `${where} tap target ${selector}`);
  const tap = async selector => {
    const {x, y} = await point(selector);
    if (viewport.mobile) {
      await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
      await sleep(30);
      await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
      await page('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
      await sleep(30);
      await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
    }
  };
  const key = async (keyName, code, vk, modifiers = 0, text) => {
    await page('Input.dispatchKeyEvent', {type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? {text} : {})});
    await page('Input.dispatchKeyEvent', {type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, modifiers});
  };
  const forced = async (selector, states, expression) => {
    const {root} = await page('DOM.getDocument', {depth: -1});
    const {nodeIds} = await page('DOM.querySelectorAll', {nodeId: root.nodeId, selector});
    const nodeId = nodeIds[0];
    await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: states});
    try { await sleep(40); return await evaluate(expression); }
    finally { await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []}); }
  };
  const shot = async name => {
    if (!SHOTS) return;
    const {data} = await page('Page.captureScreenshot', {format: 'png'});
    fs.mkdirSync(SHOTS, {recursive: true});
    fs.writeFileSync(path.join(SHOTS, `${where.replace(/ /g, '_')}-${name}.png`), Buffer.from(data, 'base64'));
  };
  const close = async () => {
    stop();
    await cdp.send('Target.closeTarget', {targetId}).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', {browserContextId}).catch(() => {});
  };
  return {page, evaluate, media, tap, key, forced, shot, close, requests, where};
}

const sendTurn = async p => {
  await p.tap('#lotbi-prompt');
  await p.page('Input.insertText', {text: '한옥마을 주차장 알려줘'});
  await p.key('Enter', 'Enter', 13, 0, '\r');
  await waitFor(() => p.evaluate("document.querySelectorAll('.chat-message-actions').length > 0"), `${p.where} assistant answer`);
};

// ── Run ────────────────────────────────────────────────────────────────────
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const results = {composer: 0, header: 0, share: 0, nav: 0};
const server = startServer();
const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-dark-login-kakao-'));
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const only = process.env.CHAT_DARK_LOGIN_KAKAO_ONLY || '';
    for (const viewport of only === 'share' ? [] : VIEWPORTS) {
      for (const theme of THEMES) {
        const p = await openPage(cdp, origin, viewport, theme);
        const where = p.where;
        try {
          // ── Header 로그인 / 회원가입 ──
          const header = viewport.mobile
            ? await waitFor(() => p.evaluate(HEADER).then(h => (h.login && h.signup ? h : {ok: false, h})), `${where} header buttons`)
            : await p.evaluate(HEADER);
          if (header.login && header.signup) {
            results.header += 1;
            const {login, signup} = header;
            for (const b of [login, signup]) {
              check(b.text >= 4.5, `${where}: ${b.label} text ${b.text}:1 < 4.5`);
              check(b.opacity === 1 && b.filter === 'none', `${where}: ${b.label} looks dimmed (opacity ${b.opacity}, filter ${b.filter})`);
              check(b.clipped <= 0 && b.lines <= 2, `${where}: ${b.label} label clipped or wrapped`);
              check(b.left >= 0 && b.right <= header.vw + 0.5, `${where}: ${b.label} leaves the viewport`);
            }
            check(login.ownFill === 'rgba(0, 0, 0, 0)', `${where}: 로그인 must not paint its own fill (got ${login.ownFill})`);
            check(theme.dark ? login.border === 'rgb(91, 91, 91)' : login.border === 'rgb(221, 227, 238)', `${where}: 로그인 edge ${login.border}`);
            check(signup.fillVsTopbar >= 3, `${where}: 회원가입 fill vs topbar ${signup.fillVsTopbar}:1 < 3`);
            for (const prop of ['radius', 'fontSize', 'fontWeight', 'padding']) check(login[prop] === signup[prop], `${where}: ${prop} differs (${login[prop]} / ${signup[prop]})`);
            check(Math.abs(login.height - signup.height) < 0.5 && Math.abs(login.top - signup.top) < 0.5, `${where}: button heights/rows differ`);
            check(header.gap >= 4, `${where}: buttons too close (${header.gap}px)`);
            check(!header.overlaps.length, `${where}: header overlap ${header.overlaps.join(', ')}`);
            check(header.pageOverflow <= 0, `${where}: page scrolls sideways (${header.pageOverflow}px)`);
            for (const which of ['login', 'signup']) {
              const ring = await p.forced(which === 'login' ? '.account-login' : '.account-signup', ['focus', 'focus-visible'], HEADER_RING(which));
              check(ring.style !== 'none' && ring.width >= 2 && ring.ring >= 3, `${where}: ${which} keyboard focus ring ${JSON.stringify(ring)}`);
            }
          } else {
            check(!viewport.mobile, `${where}: header buttons missing`);
          }

          // ── Composer ──
          const idle = await p.evaluate(COMPOSER);
          await p.tap('#lotbi-prompt');
          await waitFor(() => p.evaluate("document.activeElement?.id === 'lotbi-prompt'"), `${where} composer focus`);
          await p.page('Input.insertText', {text: 'LOTBI 첫 글자'});
          await sleep(60);
          const typing = await p.evaluate(COMPOSER);
          await p.shot('typing');
          const before = typing.inputHeight;
          await p.key('Enter', 'Enter', 13, 8, '\r');
          await p.page('Input.insertText', {text: '둘째 줄'});
          await sleep(80);
          const multiline = await p.evaluate(COMPOSER);
          const states = [['typing', typing], ['multiline', multiline]];
          if (theme.switchTo) {
            await p.media(theme.switchTo);
            await sleep(120);
            states.push([`switched-${theme.switchTo}`, {...await p.evaluate(COMPOSER), expectDark: theme.switchTo === 'dark'}]);
            await p.media(theme.media);
            await sleep(120);
          }
          for (const [state, m] of states) {
            const dark = m.expectDark ?? theme.dark;
            check(m.dark === dark, `${where} ${state}: expected ${dark ? 'dark' : 'light'} composer, surface ${m.surface}`);
            check(m.focused, `${where} ${state}: textarea lost focus`);
            check(!m.paints.length, `${where} ${state}: something paints inside the composer: ${JSON.stringify(m.paints)}`);
            check(m.inputOutline.startsWith('none') || m.inputOutline.endsWith(' 0px'), `${where} ${state}: textarea outline ${m.inputOutline}`);
            check(m.radius >= 16, `${where} ${state}: composer not rounded (${m.radius}px)`);
            check(m.text >= 4.5 && m.placeholder >= 4.5, `${where} ${state}: text ${m.text} / placeholder ${m.placeholder}`);
            check(!m.plusOverlapsText, `${where} ${state}: + button overlaps the text area`);
            check(m.composerInViewport && m.pageOverflow <= 0, `${where} ${state}: composer leaves the viewport`);
            if (dark) {
              check(m.border.startsWith('rgb(237, 237, 237)'), `${where} ${state}: Dark focus edge ${m.border}`);
              check(m.borderVsPage >= 3, `${where} ${state}: Dark focus edge contrast ${m.borderVsPage}:1 < 3`);
            }
          }
          check(idle.border !== typing.border || idle.shadow !== typing.shadow, `${where}: focus does not change the composer edge (${idle.border})`);
          check(!idle.paints.length, `${where} idle: something paints inside the composer: ${JSON.stringify(idle.paints)}`);
          check(multiline.value.includes('\n') && multiline.inputHeight >= before, `${where}: Shift+Enter must add a line and keep auto height (${before} → ${multiline.inputHeight})`);

          // Enter sends; the composer that comes back after the answer is the same.
          if (['360x780', '412x915', '1280x900'].includes(viewport.label)) {
            await p.key('Enter', 'Enter', 13, 0, '\r');
            await waitFor(() => p.evaluate("document.querySelectorAll('.chat-message-actions').length > 0 && document.querySelector('#lotbi-prompt').value === ''"), `${where} Enter sends`);
            await p.tap('#lotbi-prompt');
            await waitFor(() => p.evaluate("document.activeElement?.id === 'lotbi-prompt'"), `${where} composer focus after answer`);
            await p.page('Input.insertText', {text: '다음 질문'});
            await sleep(60);
            const after = await p.evaluate(COMPOSER);
            await p.shot('after-answer');
            check(after.conversationActive, `${where}: conversation view expected after the answer`);
            check(!after.paints.length, `${where} after answer: something paints inside the composer: ${JSON.stringify(after.paints)}`);
            if (theme.dark) check(after.border.startsWith('rgb(237, 237, 237)'), `${where} after answer: Dark focus edge ${after.border}`);
          }
          results.composer += 1;

          // ── 로그인 / 회원가입 still go where they went ──
          if (NAV_FLOW.has(where)) {
            await p.evaluate('document.activeElement?.blur(), true');
            for (const [selector, expected] of [['.account-login', /\/auth\/start\/|account\.lotbiai\.com/], ['.account-signup', /^https:\/\/account\.lotbiai\.com\/signup/]].filter(([selector]) => NAV_FLOW.get(where) === selector)) {
              p.requests.documents.length = 0;
              await p.tap(selector);
              const {url} = await waitFor(async () => (p.requests.documents[0] ? {url: p.requests.documents[0]} : null), `${where} ${selector} navigation`);
              check(expected.test(url), `${where}: ${selector} went to ${url}`);
              await sleep(150);
              await p.evaluate("(() => { try { location.hash = ''; } catch {} return true; })()");
            }
            results.nav += 1;
          }
        } finally {
          await p.close();
        }
      }
    }

    // ── KakaoTalk Share ──
    for (const {viewport, theme, mode} of SHARE_COMBOS) {
      const p = await openPage(cdp, origin, viewport, theme, mode);
      const where = p.where;
      try {
        await sendTurn(p);
        await p.tap('.chat-message-actions:last-of-type [data-message-action="share"]').catch(async () => p.tap('[data-message-action="share"]'));
        const menu = await waitFor(async () => {
          const m = await p.evaluate(SHARE_MENU);
          if (!m.open) return m;
          if (mode === 'configured' || mode === 'send-fails') return m.items.length === 2 ? m : {ok: false, m};
          return m;
        }, `${where} share menu`);
        if (mode === 'unconfigured' || mode === 'sdk-missing') await sleep(400);
        const settled = await p.evaluate(SHARE_MENU);
        await p.shot('share-menu');
        const labels = settled.items.map(item => item.label);
        check(settled.inViewport, `${where}: share menu leaves the viewport`);
        for (const item of settled.items) {
          check(item.text >= 4.5, `${where}: ${item.label} text ${item.text}:1`);
          check(item.height >= 44, `${where}: ${item.label} target ${item.height}px`);
        }
        if (mode === 'configured' || mode === 'send-fails') {
          assert.deepEqual(labels, ['카카오톡 공유하기', '링크 복사'], `${where}: share menu order`);
          const kakaoItem = settled.items[0];
          check(kakaoItem.hint === '이 답변 내용과 LOTBI 주소만 보내요' && kakaoItem.describedBy === kakaoItem.hint, `${where}: KakaoTalk item must say what it sends (${JSON.stringify(kakaoItem)})`);
          check(kakaoItem.hintText >= 4.5, `${where}: KakaoTalk hint ${kakaoItem.hintText}:1`);
          check(await p.evaluate('window.__kakaoCalls?.init?.length === 1'), `${where}: opening the menu must prepare (initialize) the SDK once`);
          check(await p.evaluate('(window.__kakaoCalls?.send?.length || 0) === 0'), `${where}: preparing must not share`);
          await p.tap('[data-share-action="kakaotalk"]');
          const feedback = await waitFor(() => p.evaluate("(() => { const f = [...document.querySelectorAll('.chat-message-action-feedback')].pop(); return f && f.textContent.trim() ? {text: f.textContent.trim(), tone: f.dataset.tone || ''} : null; })()"), `${where} kakao feedback`);
          const calls = await p.evaluate('window.__kakaoCalls');
          const copied = await p.evaluate('window.__copied');
          check(!copied.length, `${where}: KakaoTalk must never copy instead (${JSON.stringify(copied)})`);
          check(!/완료|공유했습니다|보냈습니다/.test(feedback.text), `${where}: feedback claims a finished share: ${feedback.text}`);
          check(await p.evaluate("[...document.querySelectorAll('.lotbi-share-menu')].pop().hidden"), `${where}: choosing KakaoTalk closes the menu`);
          check(calls.init.length === 1 && calls.init[0] === 'fixture-public-js-key', `${where}: one Kakao.init with Core's public key (${JSON.stringify(calls.init)})`);
          check(calls.send.length === 1, `${where}: exactly one sendDefault (${calls.send.length})`);
          const sent = calls.send[0] || {payload: {}};
          check(sent.active === true, `${where}: sendDefault must run inside the user's tap (userActivation ${sent.active})`);
          check(sent.payload.objectType === 'text' && sent.payload.text === EXPECTED_SHARE_TEXT && sent.payload.buttonTitle === 'LOTBI 열기', `${where}: share payload ${JSON.stringify(sent.payload).slice(0, 300)}`);
          check(JSON.stringify(sent.payload.link) === JSON.stringify({mobileWebUrl: 'https://lotbiai.com/', webUrl: 'https://lotbiai.com/'}), `${where}: only the public LOTBI address is linked (${JSON.stringify(sent.payload.link)})`);
          const serialized = JSON.stringify(sent.payload);
          for (const secret of [GUEST_TOKEN, 'Bearer', origin, 'api.lotbiai.com', 'conversation', 'thread', '한옥마을 주차장 알려줘']) {
            check(!serialized.includes(secret), `${where}: share payload must not carry ${secret}`);
          }
          if (mode === 'send-fails') {
            check(feedback.text === '카카오톡 공유를 열지 못했어요. 링크 복사를 이용해 주세요.' && feedback.tone === 'error', `${where}: a failed share must say so (${JSON.stringify(feedback)})`);
          } else {
            check(feedback.text === '카카오톡에서 보낼 친구나 채팅방을 선택해 주세요.' && !feedback.tone, `${where}: share hand-off message (${JSON.stringify(feedback)})`);
          }
          // 링크 복사 is still there and still copies only the public address.
          await p.evaluate("[...document.querySelectorAll('.chat-message-action-feedback')].forEach(f => { f.textContent = ''; }), true");
          await p.tap('[data-message-action="share"]');
          await waitFor(() => p.evaluate(SHARE_MENU).then(m => (m.open && m.items.length === 2 ? m : {ok: false, m})), `${where} share menu reopen`).catch(async error => { await p.shot('reopen-fail'); throw error; });
          const reopened = await p.evaluate(SHARE_MENU);
          if (!viewport.mobile) check(reopened.focused === 'kakaotalk', `${where}: reopened menu focuses its first item (${reopened.focused})`);
          if (!viewport.mobile) {
            await p.key('Escape', 'Escape', 27);
            await waitFor(() => p.evaluate("[...document.querySelectorAll('.lotbi-share-menu')].pop().hidden && document.activeElement?.dataset?.messageAction === 'share'"), `${where} Escape closes the menu back to 공유하기`);
            await p.tap('[data-message-action="share"]');
            await waitFor(() => p.evaluate(SHARE_MENU).then(m => (m.open ? m : {ok: false})), `${where} share menu reopen 2`);
          }
          await p.tap('[data-share-action="link-copy"]');
          await waitFor(() => p.evaluate("window.__copied.length === 1 && window.__copied[0] === 'https://lotbiai.com/'"), `${where} link copy`);
          check((await p.evaluate('window.__kakaoCalls.send.length')) === 1, `${where}: 링크 복사 must not share to KakaoTalk`);
          check(p.requests.kakaoSdk === 1, `${where}: the SDK loads once (${p.requests.kakaoSdk})`);
        } else {
          assert.deepEqual(labels, ['링크 복사'], `${where}: without Share readiness only 링크 복사 is offered`);
          check(await p.evaluate('!window.__kakaoCalls || (window.__kakaoCalls.init.length === 0 && window.__kakaoCalls.send.length === 0)'), `${where}: Kakao must not be called`);
          if (mode === 'unconfigured') check(p.requests.kakaoSdk === 0, `${where}: no SDK request while Share is not ready (${p.requests.kakaoSdk})`);
          await p.tap('[data-share-action="link-copy"]');
          await waitFor(() => p.evaluate("window.__copied.length === 1 && window.__copied[0] === 'https://lotbiai.com/'"), `${where} link copy`);
        }
        results.share += 1;
      } finally {
        await p.close();
      }
    }
  } finally {
    cdp.close();
    await sleep(300);
  }
} finally {
  server.kill();
  try { fs.rmSync(workDir, {recursive: true, force: true}); } catch {}
}

if (failures.length) {
  console.error(failures.slice(0, 60).join('\n'));
  console.error(`LOTBI-CHAT-DARK-LOGIN-KAKAO-SHARE-01 FAIL — ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`LOTBI-CHAT-DARK-LOGIN-KAKAO-SHARE-01 PASS — composer ${results.composer} renders, header ${results.header}, login/signup flows ${results.nav}, share ${results.share} (viewport emulation only; no device run)`);
