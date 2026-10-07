// SITE-MOBILE-COMPOSER-KEYBOARD-LAYOUT-HOTFIX (2026-10-07) — where the composer sits
// with the software keyboard open, and whether the + / send buttons ever sit on
// the text, measured as bounding rects in a real browser against index.html.
//
// 실사용 (Samsung 계열 모바일 브라우저):
//   1. 키보드를 열면 입력창이 키보드 바로 위가 아니라 헤더 바로 아래로 올라가고,
//      입력창과 키보드 사이에 큰 빈 공간이 생겼다.
//   2. 입력한 첫 글자들이 + 버튼 뒤에 가려졌다.
//
// Three software keyboards are emulated, none of them a real phone:
//   layout — the layout viewport itself shrinks (Android resizes-content,
//            Samsung Internet / WebView): Emulation.setDeviceMetricsOverride.
//   visual — only visualViewport shrinks, offsetTop 0 (iOS Safari).
//   pan    — visualViewport shrinks and is panned down to the bottom of the
//            layout viewport (Chrome resizes-visual revealing a bottom field).
//            The page cannot really pan here, so on-screen = rect − offsetTop.
//
// Text geometry: a hidden mirror lays the value (or the placeholder) out with
// the textarea's own box and font, so every glyph and the caret has a rect.
// Contract, for the placeholder, typed text (one line and several) and the
// caret: no glyph intersects the + or the send button, and on any line that
// shares rows with one of them TEXT_LEFT >= PLUS_RIGHT + 8 and
// TEXT_RIGHT <= SEND_LEFT - 8.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const layoutCss = read('site-consumer-layout.css');
assert.ok(!/\.attachment-control\s*\{[^}]*position:\s*absolute/.test(layoutCss),
  'the + control is laid out in the composer grid, never absolutely over the text');
assert.match(layoutCss, /body\.chat-home-page \.composer-actions \{ display: contents; \}/,
  'the composer controls are grid items of the composer');
assert.match(layoutCss, /body\.chat-home-page\.mobile-keyboard-open:not\(\.conversation-active\) \.chat-hero \{[^}]*justify-content: flex-end/,
  'the empty Home docks the composer at the bottom while the keyboard is open');
const homeShell = read('home-shell.js');
for (const needle of ["'--lotbi-visible-viewport-height'", "'--lotbi-visible-viewport-offset-top'", "window.visualViewport?.addEventListener('resize', syncMobileViewport"]) {
  assert.ok(homeShell.includes(needle), `the shell follows the visual viewport: ${needle}`);
}
assert.ok(!/setTimeout/.test(homeShell), 'no timer corrects the composer position');

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
  throw new Error('Chrome/Chromium is required for the mobile composer keyboard layout validation.');
}

const LONG_ANSWER = Array.from({length: 28}, (_, i) => `${i + 1}번째 문단 — 긴 답변을 읽는 중에 입력창을 눌러 키보드를 열어도 읽던 위치가 그대로인지 확인하는 문장입니다.`).join('\n\n');
const PROBE_HEAD = `<base href="/">
<script>
// Emulated software keyboard. kb=visual|pan replace visualViewport; kb=layout
// leaves the real one (the harness shrinks the layout viewport itself).
(() => {
  const model = new URLSearchParams(location.search).get('kb');
  window.__kbModel = model;
  if (model !== 'visual' && model !== 'pan') return;
  const target = new EventTarget();
  // Until the keyboard opens the real layout viewport is the answer; reading
  // innerHeight here would give the 980px pre-meta-viewport layout.
  const state = {height: null, offsetTop: 0};
  Object.defineProperties(target, {
    height: {get: () => state.height ?? window.innerHeight},
    width: {get: () => window.innerWidth},
    offsetTop: {get: () => state.offsetTop},
    offsetLeft: {get: () => 0},
    pageTop: {get: () => state.offsetTop + window.scrollY},
    pageLeft: {get: () => 0},
    scale: {get: () => 1},
  });
  Object.defineProperty(window, 'visualViewport', {configurable: true, get: () => target});
  window.__setVisual = (height, offsetTop) => {
    state.height = height; state.offsetTop = offsetTop;
    target.dispatchEvent(new Event('resize'));
    target.dispatchEvent(new Event('scroll'));
  };
})();
</script>`;

function buildPage() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', `<head>\n${PROBE_HEAD}`);
  const harness = `<script type="module">
localStorage.clear();
const nativeFetch = globalThis.fetch.bind(globalThis);
const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
let turn = 0;
const LONG_ANSWER = ${JSON.stringify(LONG_ANSWER)};
globalThis.fetch = async (url, init) => {
  let parsed;
  try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
  if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
    contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  if (parsed.pathname === '/v2/conversation/guest/messages') {
    const text = JSON.parse(init.body).text;
    turn += 1;
    return json({
      contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED',
      assistant_text: text.includes('길게') ? LONG_ANSWER : turn + '번째 답변이에요.',
      response_mode: 'AI_GROUNDED_CURRENT_FACT', correlation_id: 'req_mk_' + turn, intent: {action: 'UNKNOWN'},
      follow_up: {required: false, action: 'UNKNOWN', automatic_execution: false},
      safety: {execution_authority: false, external_side_effect: false, transaction_created: false, order_created: false, payment_attempted: false, reservation_created: false, merchant_execution_started: false},
      sources: [], retry_safe: true,
    });
  }
  if (parsed.origin !== location.origin) return json({items: []});
  return nativeFetch(url, init);
};
const conversation = await import('/site-conversation.js?v=composer-keyboard-01');
if (!conversation.mountConversation()) throw new Error('mount');
document.body.dataset.siteAuthState = 'unauthenticated';
window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
window.__ready = true;
</script>`;
  return html.replace(runtime[0], harness);
}

// Everything measured on screen. Installed once per page.
const PAGE_TOOLS = `(() => {
  const main = document.getElementById('main-content');
  const prompt = document.getElementById('lotbi-prompt');
  const stack = document.querySelector('.chat-composer-stack');
  const composer = document.querySelector('.chat-composer');
  const topbar = document.querySelector('.chat-topbar');
  const thread = document.getElementById('conversation-thread');
  const box = el => {
    if (!(el instanceof Element)) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
  };
  const visible = () => {
    const vv = window.visualViewport;
    return {top: vv ? vv.offsetTop : 0, height: vv ? vv.height : innerHeight};
  };
  const mirrorProps = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle',
    'borderBottomStyle', 'borderLeftStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
    'fontVariant', 'fontKerning', 'fontFeatureSettings', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign',
    'textIndent', 'textTransform', 'tabSize', 'direction', 'wordBreak'];
  // Glyph rects of the value (or the placeholder when empty) and the caret at
  // the end, laid out exactly like the textarea and clipped to what it shows.
  const glyphs = () => {
    const cs = getComputedStyle(prompt);
    const field = prompt.getBoundingClientRect();
    const text = prompt.value || prompt.placeholder;
    const mirror = document.createElement('div');
    for (const p of mirrorProps) mirror.style[p] = cs[p];
    const scrollbar = prompt.offsetWidth - prompt.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    if (scrollbar > 0) mirror.style.paddingRight = (parseFloat(cs.paddingRight) + scrollbar) + 'px';
    Object.assign(mirror.style, {position: 'fixed', left: field.left + 'px', top: (field.top - prompt.scrollTop) + 'px',
      margin: '0', height: 'auto', overflow: 'visible', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      visibility: 'hidden', pointerEvents: 'none', zIndex: '-1'});
    const spans = [];
    for (const ch of text) { const s = document.createElement('span'); s.textContent = ch; mirror.append(s); spans.push(s); }
    const caretMark = document.createElement('span');
    caretMark.textContent = '\\u200b';
    if (!prompt.value) mirror.prepend(caretMark); else mirror.append(caretMark);
    document.body.append(mirror);
    const clipTop = field.top + parseFloat(cs.borderTopWidth);
    const clipBottom = field.bottom - parseFloat(cs.borderBottomWidth);
    const rects = [];
    for (const s of spans) {
      if (!s.textContent.trim()) continue;
      for (const r of s.getClientRects()) {
        if (r.bottom <= clipTop + 1 || r.top >= clipBottom - 1) continue;
        rects.push({left: r.left, right: r.right, top: Math.max(r.top, clipTop), bottom: Math.min(r.bottom, clipBottom)});
      }
    }
    const c = caretMark.getClientRects()[0];
    mirror.remove();
    // The caret is drawn as a 1px line starting at its x.
    const caret = c ? {left: c.left, right: c.left + 1, top: Math.max(c.top, clipTop), bottom: Math.min(c.bottom, clipBottom)} : null;
    return {kind: prompt.value ? 'text' : 'placeholder', rects, caret, lines: new Set(rects.map(r => Math.round(r.top))).size};
  };
  const vOverlap = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const hOverlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const r1 = v => Math.round(v * 10) / 10;
  const geometry = () => {
    const plus = box(document.querySelector('.attachment-button'));
    const send = box(document.querySelector('.send-button'));
    const g = glyphs();
    const items = g.caret ? [...g.rects, g.caret] : g.rects;
    const hits = (button) => button ? items.filter(r => vOverlap(r, button) > 0 && hOverlap(r, button) > 0).length : 0;
    const sameRows = (button) => button ? items.filter(r => vOverlap(r, button) > 0) : [];
    const plusRow = sameRows(plus);
    const sendRow = sameRows(send);
    const left = items.length ? Math.min(...items.map(r => r.left)) : null;
    const right = g.rects.length ? Math.max(...g.rects.map(r => r.right)) : null;
    return {
      kind: g.kind, lines: g.lines,
      PLUS_RIGHT: plus ? r1(plus.right) : null, TEXT_LEFT: left === null ? null : r1(left),
      SEND_LEFT: send ? r1(send.left) : null, TEXT_RIGHT: right === null ? null : r1(right),
      CARET_X: g.caret ? r1(g.caret.left) : null,
      plusSharesRow: plusRow.length > 0, sendSharesRow: sendRow.length > 0,
      plusRowTextLeft: plusRow.length ? r1(Math.min(...plusRow.map(r => r.left))) : null,
      sendRowTextRight: sendRow.length ? r1(Math.max(...sendRow.map(r => r.right))) : null,
      // + below the text on phones: the vertical room between them.
      plusBelowText: plus && items.length ? r1(plus.top - Math.max(...items.map(r => r.bottom))) : null,
      plusHits: hits(plus), sendHits: hits(send),
    };
  };
  // Anything of the conversation painted between the composer and the
  // bottom of the visible viewport (the keyboard's top edge).
  const transcriptUnderComposer = (c, v) => {
    let hits = 0;
    for (let y = Math.ceil(c.bottom) + 1; y < v.top + v.height - 0.5; y += 2) {
      for (let x = Math.ceil(c.left) + 4; x < c.right - 4; x += 16) {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit.closest('#conversation-thread')) hits += 1;
      }
    }
    return hits;
  };
  const dock = () => {
    const v = visible();
    const c = box(composer);
    const t = box(topbar);
    return {
      transcriptUnderComposer: transcriptUnderComposer(c, v),
      keyboardClass: document.body.classList.contains('mobile-keyboard-open'),
      // On-screen coordinates: subtract the visual viewport's offset.
      COMPOSER_BOTTOM_GAP: Math.round(v.top + v.height - c.bottom),
      composerTop: Math.round(c.top - v.top), composerBottom: Math.round(c.bottom - v.top),
      topbarBottom: t ? Math.round(t.bottom - v.top) : null,
      visibleHeight: Math.round(v.height),
      focused: document.activeElement === prompt,
    };
  };
  const readingTop = () => Math.max(main.getBoundingClientRect().top, topbar.getBoundingClientRect().bottom);
  const readingBottom = () => Math.min(stack.getBoundingClientRect().top, visible().top + visible().height);
  const lastQuestion = () => [...thread.querySelectorAll('.chat-message-user')].pop();
  const question = () => {
    const q = lastQuestion();
    if (!q) return null;
    const r = q.getBoundingClientRect();
    return {offset: Math.round(r.top - readingTop()), onScreen: r.top >= readingTop() - 1 && r.bottom <= readingBottom() + 1};
  };
  // The item nearest the middle of the reading area, by geometry.
  let held = null;
  const holdReadingItem = () => {
    const top = readingTop(), bottom = readingBottom(), middle = (top + bottom) / 2;
    let best = null;
    for (const node of thread.querySelectorAll('.chat-message-user, .chat-message-body > *')) {
      const r = node.getBoundingClientRect();
      if (r.height <= 0 || r.bottom <= top || r.top >= bottom) continue;
      const away = middle < r.top ? r.top - middle : middle > r.bottom ? middle - r.bottom : 0;
      if (!best || away < best.away) best = {node, away, top: r.top};
    }
    held = best;
    return Boolean(best);
  };
  const heldShift = () => (held && held.node.isConnected ? Math.round(held.node.getBoundingClientRect().top - held.top) : null);
  const readerScroll = delta => {
    main.dispatchEvent(new WheelEvent('wheel', {deltaY: delta, bubbles: true}));
    main.scrollTop = Math.max(0, main.scrollTop + delta);
    main.dispatchEvent(new Event('scroll'));
  };
  const jump = () => document.querySelector('.conversation-jump-latest');
  const jumpVisible = () => { const b = jump(); return Boolean(b) && !b.hidden && b.getBoundingClientRect().height > 0; };
  const distance = () => Math.round(main.scrollHeight - main.scrollTop - main.clientHeight);
  const assistants = () => document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)').length;
  const send = text => {
    prompt.value = text;
    prompt.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  };
  const promptCenter = () => { const r = prompt.getBoundingClientRect(); return {x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2}; };
  const clear = () => { prompt.value = ''; prompt.dispatchEvent(new Event('input', {bubbles: true})); };
  const overflow = () => ({page: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main.scrollWidth - main.clientWidth});
  window.__t = {geometry, dock, question, holdReadingItem, heldShift, readerScroll, jumpVisible, distance, assistants, send, promptCenter, clear, overflow,
    clickJump: () => jump().click(), blur: () => prompt.blur(), activeIsPrompt: () => document.activeElement === prompt};
  return true;
})()`;

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
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

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const targets = await waitFor(async () => {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
    return list.find(item => item.type === 'page') ? list : null;
  }, 'page target');
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 16; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const VIEWPORTS = [
  {label: '360x780', width: 360, height: 780},
  {label: '375x667', width: 375, height: 667},
  {label: '390x844', width: 390, height: 844},
  {label: '412x915', width: 412, height: 915},
  // Foldable inner screens land between the phone (≤600) and desktop rules.
  {label: '690x829-fold', width: 690, height: 829},
  {label: '750x832-fold', width: 750, height: 832},
];
const MODELS = ['layout', 'visual', 'pan'];
const GAP = 8;
const DOCK_MAX = 24;
const STILL = 2;
const MULTI_LINE = '여러 줄 입력 확인 — 첫 줄이 + 버튼과 겹치면 안 되고 마지막 글자도 전송 버튼과 떨어져 있어야 합니다. 셋째 줄까지 이어지도록 조금 더 길게 씁니다.';

async function runCase(devtools, origin, viewport, model) {
  const {width, height} = viewport;
  const keyboard = Math.round(height * 0.42);
  const evaluate = async expression => {
    const result = await devtools.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(`${viewport.label}/${model}: ${JSON.stringify(result.exceptionDetails).slice(0, 600)}`);
    return result.result.value;
  };
  const frames = n => evaluate(`new Promise(r => { const step = k => (k <= 0 ? r(true) : requestAnimationFrame(() => step(k - 1))); step(${n}); })`);
  const settle = async () => { await frames(3); await new Promise(r => setTimeout(r, 120)); await frames(2); };
  const metrics = h => devtools.send('Emulation.setDeviceMetricsOverride', {width, height: h, deviceScaleFactor: 1, mobile: true});
  const tap = async ({x, y}) => {
    await devtools.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
    await devtools.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  };
  const openKeyboard = async () => {
    await tap(await evaluate('__t.promptCenter()'));
    await frames(2);
    if (model === 'layout') await metrics(height - keyboard);
    else await evaluate(`__setVisual(${height - keyboard}, ${model === 'pan' ? keyboard : 0})`);
    await settle();
  };
  // Android's back key: the keyboard goes, the field keeps focus.
  const closeKeyboard = async () => {
    if (model === 'layout') await metrics(height);
    else await evaluate(`__setVisual(${height}, 0)`);
    await settle();
  };
  const type = async text => { await devtools.send('Input.insertText', {text}); await settle(); };

  await metrics(height);
  await devtools.send('Emulation.setUserAgentOverride', {userAgent: MOBILE_UA});
  await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await devtools.send('Page.navigate', {url: `${origin}/${PAGE}?kb=${model}`});
  await waitFor(() => evaluate('window.__ready === true').catch(() => false), `${viewport.label}/${model} ready`);
  await evaluate(PAGE_TOOLS);
  await settle();

  const r = {};
  // Empty Home.
  r.blankClosed = {dock: await evaluate('__t.dock()'), geometry: await evaluate('__t.geometry()')};
  await openKeyboard();
  r.blankOpen = {dock: await evaluate('__t.dock()'), placeholder: await evaluate('__t.geometry()')};
  await type('가나다라마바사 첫 글자');
  r.blankOpen.oneLine = await evaluate('__t.geometry()');
  await type(' ' + MULTI_LINE);
  r.blankOpen.multiLine = await evaluate('__t.geometry()');
  r.blankOpen.multiDock = await evaluate('__t.dock()');
  await closeKeyboard();
  await evaluate('__t.blur()');
  await evaluate('__t.clear()');
  await settle();
  r.blankAfter = {dock: await evaluate('__t.dock()')};

  // A conversation: a short turn, then a long answer the reader is held on.
  for (const [text, count] of [['안녕', 1], ['길게 설명해줘', 2]]) {
    await evaluate(`__t.send(${JSON.stringify(text)})`);
    await waitFor(() => evaluate(`__t.assistants() >= ${count}`), `${viewport.label}/${model} answer ${count}`);
    await settle();
  }
  await evaluate('__t.blur()');
  await settle();
  r.convClosed = {dock: await evaluate('__t.dock()'), question: await evaluate('__t.question()'), geometry: await evaluate('__t.geometry()'), jump: await evaluate('__t.jumpVisible()')};
  // Tap the composer while reading from the anchored question.
  await openKeyboard();
  r.convOpen = {dock: await evaluate('__t.dock()'), question: await evaluate('__t.question()'), placeholder: await evaluate('__t.geometry()'), distance: await evaluate('__t.distance()')};
  await type('가나다라마바사 첫 글자');
  r.convOpen.oneLine = await evaluate('__t.geometry()');
  await type(' ' + MULTI_LINE);
  r.convOpen.multiLine = await evaluate('__t.geometry()');
  r.convOpen.multiDock = await evaluate('__t.dock()');
  r.convOpen.multiQuestion = await evaluate('__t.question()');
  await closeKeyboard();
  r.convAfter = {dock: await evaluate('__t.dock()'), question: await evaluate('__t.question()')};
  await evaluate('__t.blur()');
  await evaluate('__t.clear()');
  await settle();

  // Reading the middle of the long answer: the keyboard opening and closing
  // keeps the line being read.
  await evaluate('__t.readerScroll(260)');
  await settle();
  r.middle = {held: await evaluate('__t.holdReadingItem()')};
  await openKeyboard();
  r.middle.openShift = await evaluate('__t.heldShift()');
  r.middle.openDock = await evaluate('__t.dock()');
  r.middle.openDistance = await evaluate('__t.distance()');
  await closeKeyboard();
  r.middle.closedShift = await evaluate('__t.heldShift()');
  await evaluate('__t.blur()');
  await settle();
  r.middle.jumpVisible = await evaluate('__t.jumpVisible()');
  await evaluate('__t.clickJump()');
  await settle();
  r.middle.afterJumpDistance = await evaluate('__t.distance()');
  r.overflow = await evaluate('__t.overflow()');
  return r;
}

async function runDesktop(devtools, origin) {
  const evaluate = async expression => {
    const result = await devtools.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(`desktop: ${JSON.stringify(result.exceptionDetails).slice(0, 600)}`);
    return result.result.value;
  };
  const settle = async () => { await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))'); await new Promise(r => setTimeout(r, 120)); };
  await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: false});
  await devtools.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await devtools.send('Emulation.setUserAgentOverride', {userAgent: DESKTOP_UA});
  await devtools.send('Page.navigate', {url: `${origin}/${PAGE}?kb=none`});
  await waitFor(() => evaluate('window.__ready === true').catch(() => false), 'desktop ready');
  await evaluate(PAGE_TOOLS);
  await settle();
  const r = {};
  const composerBox = () => evaluate(`(() => { const c = document.querySelector('.chat-composer').getBoundingClientRect(); const p = document.querySelector('.attachment-button').getBoundingClientRect(); const s = document.querySelector('.send-button').getBoundingClientRect(); return {composer: {left: c.left, right: c.right, top: c.top, bottom: c.bottom, height: c.height, width: c.width}, plus: {left: p.left, bottom: p.bottom}, send: {right: s.right, top: s.top, bottom: s.bottom}}; })()`);
  r.blank = {placeholder: await evaluate('__t.geometry()'), box: await composerBox()};
  await evaluate("document.getElementById('lotbi-prompt').focus()");
  await devtools.send('Input.insertText', {text: '가나다라마바사 첫 글자'});
  await settle();
  r.blank.oneLine = await evaluate('__t.geometry()');
  await devtools.send('Input.insertText', {text: ' ' + MULTI_LINE + ' ' + MULTI_LINE + ' ' + MULTI_LINE});
  await settle();
  r.blank.multiLine = await evaluate('__t.geometry()');
  r.blank.keyboardClass = await evaluate("document.body.classList.contains('mobile-keyboard-open')");
  await evaluate('__t.clear()');
  await evaluate(`__t.send('안녕')`);
  await waitFor(() => evaluate('__t.assistants() >= 1'), 'desktop answer');
  await settle();
  r.conv = {placeholder: await evaluate('__t.geometry()'), dock: await evaluate('__t.dock()'), box: await composerBox()};
  await evaluate("document.getElementById('lotbi-prompt').focus()");
  await devtools.send('Input.insertText', {text: MULTI_LINE + ' ' + MULTI_LINE});
  await settle();
  r.conv.multiLine = await evaluate('__t.geometry()');
  r.overflow = await evaluate('__t.overflow()');
  return r;
}

// ── Contract ────────────────────────────────────────────────────────────
function assertText(g, where) {
  assert.ok(g && (g.TEXT_LEFT !== null), `${where}: no text geometry`);
  assert.equal(g.plusHits, 0, `${where}: ${g.kind} or caret intersects the + button ${JSON.stringify(g)}`);
  assert.equal(g.sendHits, 0, `${where}: ${g.kind} or caret intersects the send button ${JSON.stringify(g)}`);
  if (g.plusSharesRow) assert.ok(g.plusRowTextLeft >= g.PLUS_RIGHT + GAP, `${where}: TEXT_LEFT ${g.plusRowTextLeft} < PLUS_RIGHT ${g.PLUS_RIGHT} + ${GAP}`);
  else assert.ok(g.plusBelowText >= 4, `${where}: the + is neither beside the text with a gap nor clear below it (${g.plusBelowText}px)`);
  if (g.sendSharesRow) assert.ok(g.sendRowTextRight <= g.SEND_LEFT - GAP, `${where}: TEXT_RIGHT ${g.sendRowTextRight} > SEND_LEFT ${g.SEND_LEFT} - ${GAP}`);
}
function assertDocked(d, where) {
  assert.equal(d.keyboardClass, true, `${where}: keyboard state engaged`);
  assert.ok(d.COMPOSER_BOTTOM_GAP >= 0 && d.COMPOSER_BOTTOM_GAP <= DOCK_MAX,
    `${where}: composer sits right above the keyboard (bottom gap ${d.COMPOSER_BOTTOM_GAP}px, composer ${d.composerTop}-${d.composerBottom} of ${d.visibleHeight})`);
  assert.ok(d.composerTop > d.topbarBottom, `${where}: composer is below the header`);
  assert.equal(d.transcriptUnderComposer, 0, `${where}: nothing of the conversation shows between the composer and the keyboard`);
}

const browser = browserPath();
const tmp = fs.mkdtempSync(path.join(ROOT, 'scripts/.composer-keyboard-'));
const PAGE = `scripts/${path.basename(tmp)}/page.html`;
fs.writeFileSync(path.join(ROOT, PAGE), buildPage(), 'utf8');
const server = startServer();
const summary = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const viewport of VIEWPORTS) {
    for (const model of MODELS) {
      const profile = fs.mkdtempSync(path.join(tmp, 'profile-'));
      const devtools = await openDevtools(browser, profile);
      let r;
      try {
        await devtools.send('Page.enable');
        await devtools.send('Runtime.enable');
        await devtools.send('Emulation.setFocusEmulationEnabled', {enabled: true});
        await devtools.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
        r = await runCase(devtools, origin, viewport, model);
      } finally {
        devtools.close();
      }
      const where = `${viewport.label}/${model}`;
      // Empty Home.
      assert.equal(r.blankClosed.dock.keyboardClass, false, `${where}: no keyboard state before the tap`);
      assertText(r.blankClosed.geometry, `${where} home placeholder (closed)`);
      assertDocked(r.blankOpen.dock, `${where} home, keyboard open`);
      assertText(r.blankOpen.placeholder, `${where} home placeholder + caret (open)`);
      assertText(r.blankOpen.oneLine, `${where} home one line`);
      assertText(r.blankOpen.multiLine, `${where} home several lines`);
      assert.ok(r.blankOpen.multiLine.lines >= 2, `${where}: the long draft wrapped (${r.blankOpen.multiLine.lines} lines)`);
      assertDocked(r.blankOpen.multiDock, `${where} home, several lines`);
      assert.equal(r.blankAfter.dock.keyboardClass, false, `${where}: keyboard state cleared on close`);
      assert.ok(Math.abs(r.blankAfter.dock.composerTop - r.blankClosed.dock.composerTop) <= STILL,
        `${where}: the empty Home composer returns to its place (${r.blankClosed.dock.composerTop} → ${r.blankAfter.dock.composerTop})`);
      // Conversation, held on the long answer's question.
      assert.ok(r.convClosed.question.offset >= 0 && r.convClosed.question.offset <= 40, `${where}: the question is at the top before the keyboard (${r.convClosed.question.offset})`);
      assert.ok(r.convClosed.dock.COMPOSER_BOTTOM_GAP >= 0 && r.convClosed.dock.COMPOSER_BOTTOM_GAP <= DOCK_MAX, `${where}: composer at the bottom with the keyboard closed (${r.convClosed.dock.COMPOSER_BOTTOM_GAP})`);
      assert.equal(r.convClosed.dock.transcriptUnderComposer, 0, `${where}: nothing of the conversation shows under the composer (keyboard closed)`);
      assertText(r.convClosed.geometry, `${where} conversation placeholder (closed)`);
      assertDocked(r.convOpen.dock, `${where} conversation, keyboard open`);
      assert.ok(r.convOpen.question.offset >= 0 && r.convOpen.question.offset <= 40 && r.convOpen.question.onScreen,
        `${where}: the anchored question stays at the top with the keyboard open (${JSON.stringify(r.convOpen.question)})`);
      assert.ok(r.convOpen.distance > 100, `${where}: tapping the composer did not pull the reader to the newest message (${r.convOpen.distance}px below)`);
      assert.ok(r.convOpen.dock.composerTop - r.convOpen.dock.topbarBottom >= 60, `${where}: the transcript keeps the room between header and composer`);
      assertText(r.convOpen.placeholder, `${where} conversation placeholder + caret (open)`);
      assertText(r.convOpen.oneLine, `${where} conversation one line`);
      assertText(r.convOpen.multiLine, `${where} conversation several lines`);
      assertDocked(r.convOpen.multiDock, `${where} conversation, several lines`);
      assert.ok(r.convOpen.multiQuestion.offset >= 0 && r.convOpen.multiQuestion.offset <= 40, `${where}: a growing draft does not move the anchored question (${r.convOpen.multiQuestion.offset})`);
      assert.equal(r.convAfter.dock.keyboardClass, false, `${where}: keyboard state cleared on close`);
      assert.ok(r.convAfter.dock.COMPOSER_BOTTOM_GAP >= 0 && r.convAfter.dock.COMPOSER_BOTTOM_GAP <= DOCK_MAX, `${where}: composer back at the bottom after close (${r.convAfter.dock.COMPOSER_BOTTOM_GAP})`);
      assert.equal(r.convAfter.dock.transcriptUnderComposer, 0, `${where}: nothing of the conversation shows under the composer after close`);
      assert.ok(r.convAfter.question.offset >= 0 && r.convAfter.question.offset <= 40, `${where}: the question is still at the top after close (${r.convAfter.question.offset})`);
      // Reading the middle of the answer.
      assert.ok(r.middle.held, `${where}: an item was visible in the middle of the answer`);
      assert.ok(r.middle.openShift !== null && Math.abs(r.middle.openShift) <= STILL, `${where}: the keyboard opening kept the line being read (${r.middle.openShift}px)`);
      assertDocked(r.middle.openDock, `${where} reading the middle, keyboard open`);
      assert.ok(r.middle.openDistance > 100, `${where}: the keyboard did not jump the reader to the end`);
      assert.ok(r.middle.closedShift !== null && Math.abs(r.middle.closedShift) <= STILL, `${where}: the keyboard closing kept the line being read (${r.middle.closedShift}px)`);
      assert.ok(r.middle.jumpVisible, `${where}: ↓ 최신 답변 is offered while reading above the end`);
      assert.ok(r.middle.afterJumpDistance <= 2, `${where}: ↓ 최신 답변 reaches the newest message (${r.middle.afterJumpDistance}px)`);
      assert.ok(r.overflow.page <= 0 && r.overflow.main <= 0, `${where}: no horizontal scroll ${JSON.stringify(r.overflow)}`);
      const g = r.convOpen.oneLine;
      summary.push({where, COMPOSER_BOTTOM_GAP_HOME: r.blankOpen.dock.COMPOSER_BOTTOM_GAP, COMPOSER_BOTTOM_GAP_CONV: r.convOpen.dock.COMPOSER_BOTTOM_GAP,
        PLUS_RIGHT: g.PLUS_RIGHT, TEXT_LEFT: g.TEXT_LEFT, SEND_LEFT: g.SEND_LEFT, TEXT_RIGHT: g.TEXT_RIGHT, plusSharesRow: g.plusSharesRow, plusBelowText: g.plusBelowText,
        homePlus: {PLUS_RIGHT: r.blankOpen.oneLine.PLUS_RIGHT, TEXT_LEFT: r.blankOpen.oneLine.TEXT_LEFT, sharesRow: r.blankOpen.oneLine.plusSharesRow},
        closedHomeTop: r.blankClosed.dock.composerTop, openHomeTop: r.blankOpen.dock.composerTop, question: r.convOpen.question.offset});
      console.log(`MOBILE_COMPOSER_KEYBOARD_LAYOUT_01 ${where}`, JSON.stringify(summary[summary.length - 1]));
    }
  }
  // Desktop.
  {
    const profile = fs.mkdtempSync(path.join(tmp, 'profile-'));
    const devtools = await openDevtools(browser, profile);
    let r;
    try {
      await devtools.send('Page.enable');
      await devtools.send('Runtime.enable');
      await devtools.send('Emulation.setFocusEmulationEnabled', {enabled: true});
      r = await runDesktop(devtools, origin);
    } finally {
      devtools.close();
    }
    assert.equal(r.blank.keyboardClass, false, 'desktop: focusing the composer never engages the keyboard layout');
    for (const [key, g] of [['home placeholder', r.blank.placeholder], ['home one line', r.blank.oneLine], ['home several lines', r.blank.multiLine], ['conversation placeholder', r.conv.placeholder], ['conversation several lines', r.conv.multiLine]]) {
      assertText(g, `desktop-1280x900 ${key}`);
      assert.ok(g.plusSharesRow || key.includes('several'), `desktop ${key}: + sits beside the text`);
    }
    assert.ok(r.blank.multiLine.lines >= 3, `desktop: the long draft wrapped (${r.blank.multiLine.lines})`);
    // The desktop composer keeps the box measured before this change (f296c4ce,
    // 1280x900): 680x70, + 8px from the left edge, send 11px from the right and
    // 9px from the top. The + now shares the send button's row (its bottom was
    // 7px lower, under the text row, while it was absolutely placed).
    for (const [key, b] of [['home', r.blank.box], ['conversation', r.conv.box]]) {
      assert.equal(Math.round(b.composer.width), 680, `desktop ${key}: composer width unchanged (${b.composer.width})`);
      assert.equal(Math.round(b.composer.height), 70, `desktop ${key}: composer height unchanged (${b.composer.height})`);
      assert.ok(Math.abs(b.plus.left - b.composer.left - 8) <= 1, `desktop ${key}: + stays at the left edge (${b.plus.left - b.composer.left})`);
      assert.ok(Math.abs(b.composer.right - b.send.right - 11) <= 1, `desktop ${key}: send stays at the right edge (${b.composer.right - b.send.right})`);
      assert.ok(Math.abs(b.send.top - b.composer.top - 9) <= 1, `desktop ${key}: send stays where it was vertically (${b.send.top - b.composer.top})`);
      assert.ok(Math.abs(b.plus.bottom - b.send.bottom) <= 1, `desktop ${key}: + and send share one row (${b.plus.bottom} / ${b.send.bottom})`);
    }
    assert.ok(r.overflow.page <= 0 && r.overflow.main <= 0, `desktop: no horizontal scroll ${JSON.stringify(r.overflow)}`);
    const g = r.conv.placeholder;
    summary.push({where: 'desktop-1280x900', PLUS_RIGHT: g.PLUS_RIGHT, TEXT_LEFT: g.TEXT_LEFT, SEND_LEFT: g.SEND_LEFT, TEXT_RIGHT: g.TEXT_RIGHT,
      composer: {width: Math.round(r.conv.box.composer.width), height: Math.round(r.conv.box.composer.height)}});
    console.log('MOBILE_COMPOSER_KEYBOARD_LAYOUT_01 desktop-1280x900', JSON.stringify(summary[summary.length - 1]));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(tmp, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

console.log('SITE-MOBILE-COMPOSER-KEYBOARD-LAYOUT-HOTFIX OK — with the keyboard open the composer sits right above it (empty Home and conversation, three keyboard models); placeholder, text and caret never touch the + or send buttons');
