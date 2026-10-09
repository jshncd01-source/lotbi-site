// SAMSUNG-COMPOSER-KEYBOARD-P0 (2026-10-08) — the composer on Samsung
// Internet, measured as on-screen rects in a real browser against index.html.
//
// 실사용 (삼성 인터넷 실기기, 2026-10-08 밤):
//   1. 입력창 왼쪽 + 버튼이 플레이스홀더 첫 글자를 가린다(키보드를 닫아도).
//   2. 키보드가 열리면 입력창이 키보드 바로 위에 붙지 않고 위로 튀어 중간에
//      큰 빈 공간이 생긴다.
//   3. 홈의 캐릭터·인사말·입력창이 키보드 열기/닫기에 따라 크게 흔들린다.
//
// Samsung Internet UA on Galaxy viewports (S 360x780, S+ 384x854, Ultra
// 412x915, Z Fold cover 344x882, Z Fold inner 690x829). The keyboard opens
// and closes in one resize (Chromium reports the keyboard once it is up), and
// again in three animation steps, under two models (browser emulation, not a
// Galaxy):
//   layout — the layout viewport itself shrinks (resizes-content):
//            Emulation.setDeviceMetricsOverride.
//   visual — only visualViewport shrinks and is panned to the bottom
//            (resizes-visual). The page cannot really pan here, so on-screen
//            = rect − offsetTop.
// Text geometry: a hidden mirror lays the placeholder (or the typed value) out
// with the textarea's own box and font, so every glyph has a rect.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

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
  throw new Error('Chrome/Chromium is required for the Samsung composer keyboard validation.');
}

const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const DEVICES = [
  {label: 'galaxy-s-360x780', width: 360, height: 780, keyboard: 318},
  {label: 'galaxy-s-plus-384x854', width: 384, height: 854, keyboard: 330},
  {label: 'galaxy-ultra-412x915', width: 412, height: 915, keyboard: 340},
  {label: 'fold-cover-344x882', width: 344, height: 882, keyboard: 330},
  {label: 'fold-inner-690x829', width: 690, height: 829, keyboard: 300},
];
const MODELS = ['layout', 'visual'];
const ONE_STEP = [1];
const ANIMATED = [1 / 3, 2 / 3, 1];

const HEAD = `<base href="/">
<script>
(() => {
  // kb=visual replaces visualViewport; kb=layout leaves the real one.
  const model = new URLSearchParams(location.search).get('kb');
  if (model !== 'visual') return;
  const target = new EventTarget();
  const state = {height: null, offsetTop: 0};
  Object.defineProperties(target, {
    height: {get: () => state.height ?? window.innerHeight},
    width: {get: () => window.innerWidth},
    offsetTop: {get: () => state.offsetTop},
    offsetLeft: {get: () => 0},
    pageTop: {get: () => state.offsetTop + window.scrollY},
    pageLeft: {get: () => window.scrollX},
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

const HARNESS = `<script type="module">
const out = document.getElementById('sk-result');
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}});
  let turn = 0;
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      turn += 1;
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: turn + '번째 답변이에요. ' + '삼성 인터넷에서 입력창이 키보드 바로 위에 붙는지 확인하는 문장입니다. '.repeat(6),
        response_mode:'AI_GROUNDED_CURRENT_FACT', correlation_id:'req_sk_'+turn,
        intent:{action:'UNKNOWN'}, follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        sources:[], retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=samsung-composer-01');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const prompt = document.getElementById('lotbi-prompt');
  const composer = document.querySelector('.chat-composer');
  const topbar = document.querySelector('.chat-topbar');
  const vv = () => window.visualViewport;
  const visible = () => ({top: vv() ? vv().offsetTop : 0, height: vv() ? vv().height : innerHeight});
  const box = el => {
    if (!(el instanceof Element)) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 0 || r.height <= 0 || cs.visibility === 'hidden' || cs.display === 'none') return null;
    return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
  };
  const mirrorProps = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle',
    'borderBottomStyle', 'borderLeftStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
    'fontVariant', 'fontKerning', 'fontFeatureSettings', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign',
    'textIndent', 'textTransform', 'tabSize', 'direction', 'wordBreak'];
  // Glyph rects of the value (or the placeholder when empty), clipped to the field.
  const glyphs = () => {
    const cs = getComputedStyle(prompt);
    const field = prompt.getBoundingClientRect();
    const text = prompt.value || prompt.placeholder;
    const mirror = document.createElement('div');
    for (const p of mirrorProps) mirror.style[p] = cs[p];
    Object.assign(mirror.style, {position: 'fixed', left: field.left + 'px', top: (field.top - prompt.scrollTop) + 'px',
      margin: '0', height: 'auto', overflow: 'visible', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      visibility: 'hidden', pointerEvents: 'none', zIndex: '-1'});
    const spans = [];
    for (const ch of text) { const s = document.createElement('span'); s.textContent = ch; mirror.append(s); spans.push(s); }
    document.body.append(mirror);
    const clipTop = field.top + parseFloat(cs.borderTopWidth);
    const clipBottom = field.bottom - parseFloat(cs.borderBottomWidth);
    const clipLeft = field.left + parseFloat(cs.borderLeftWidth);
    const clipRight = field.right - parseFloat(cs.borderRightWidth);
    const rects = [];
    for (const s of spans) {
      if (!s.textContent.trim()) continue;
      for (const r of s.getClientRects()) {
        if (r.bottom <= clipTop + 1 || r.top >= clipBottom - 1 || r.right <= clipLeft || r.left >= clipRight) continue;
        rects.push({left: Math.max(r.left, clipLeft), right: Math.min(r.right, clipRight), top: Math.max(r.top, clipTop), bottom: Math.min(r.bottom, clipBottom)});
      }
    }
    mirror.remove();
    return {kind: prompt.value ? 'text' : 'placeholder', rects, firstGlyph: rects[0] || null, shown: (prompt.value || prompt.placeholder).length};
  };
  const vOverlap = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const hOverlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const onScreen = el => {
    const b = box(el);
    const v = visible();
    return b ? {top: Math.round(b.top - v.top), bottom: Math.round(b.bottom - v.top), left: Math.round(b.left), right: Math.round(b.right)} : null;
  };
  window.__s = {
    sleep,
    frames: n => new Promise(r => { const step = k => (k <= 0 ? r(true) : requestAnimationFrame(() => step(k - 1))); step(n); }),
    plus: () => {
      const plus = box(document.querySelector('.attachment-button'));
      const g = glyphs();
      const hits = plus ? g.rects.filter(r => vOverlap(r, plus) > 0 && hOverlap(r, plus) > -4).length : 0;
      const row = plus ? g.rects.filter(r => vOverlap(r, plus) > 0) : [];
      return {
        kind: g.kind, glyphs: g.rects.length,
        plusRight: plus ? Math.round(plus.right) : null,
        rowTextLeft: row.length ? Math.round(Math.min(...row.map(r => r.left))) : null,
        // Glyphs within 4px of the + (or under it).
        plusHits: hits,
        firstGlyphLeft: g.firstGlyph ? Math.round(g.firstGlyph.left) : null,
      };
    },
    layout: () => {
      const v = visible();
      const c = onScreen(composer);
      const t = onScreen(topbar);
      return {
        keyboardClass: document.body.classList.contains('mobile-keyboard-open'),
        visibleHeight: Math.round(v.height),
        avatar: onScreen(document.querySelector('[data-home-avatar-anchor] .chat-character-wrap') || document.querySelector('[data-home-avatar-anchor]')),
        greeting: onScreen(document.querySelector('.home-value-proposition')),
        composer: c,
        topbarBottom: t ? t.bottom : null,
        gapBelowComposer: c ? Math.round(v.height - c.bottom) : null,
        focused: document.activeElement === prompt,
      };
    },
    rect: () => { const r = prompt.getBoundingClientRect(); return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)}; },
    blur: () => { prompt.blur(); return true; },
    send: async text => {
      const before = document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)').length;
      prompt.value = text;
      prompt.dispatchEvent(new Event('input', {bubbles: true}));
      document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
      for (let i = 0; i < 400 && document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)').length <= before; i += 1) await sleep(25);
      await sleep(400);
      prompt.blur();
      return true;
    },
    clear: () => { prompt.value = ''; prompt.dispatchEvent(new Event('input', {bubbles: true})); return true; },
  };
  out.textContent = 'ready';
} catch (e) { out.textContent = 'error ' + String((e && e.stack) || e); }
</script><pre id="sk-result" hidden>pending</pre>`;

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', `<head>\n${HEAD}`);
  return html.replace(runtime[0], HARNESS);
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

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort', 60000);
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

async function runCase(browser, origin, dir, device, model) {
  const label = `${device.label}/${model}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  if (!fs.existsSync(path.join(ROOT, innerRel))) fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const devtools = await openDevtools(browser, profile);
  const {send} = devtools;
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(`${label}: ${expression}: ${JSON.stringify(result.exceptionDetails).slice(0, 500)}`);
    return result.result.value;
  };
  const s = call => evaluate(`window.__s.${call}`);
  const settle = async (ms = 150) => { await s('frames(3)'); await new Promise(r => setTimeout(r, ms)); await s('frames(2)'); };
  const metrics = height => send('Emulation.setDeviceMetricsOverride', {width: device.width, height, deviceScaleFactor: 1, mobile: true});
  // One step of the keyboard animation: fraction f of the keyboard is up.
  const keyboardStep = async f => {
    const k = Math.round(device.keyboard * f);
    if (model === 'layout') await metrics(device.height - k);
    else await evaluate(`__setVisual(${device.height - k}, ${k})`);
  };
  const tap = async point => {
    await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  };
  // Opens (focus, then the keyboard rises in steps) and samples the layout
  // after every step; closes the same way.
  const openKeyboard = async (steps = ONE_STEP) => {
    await tap(await s('rect()'));
    const samples = [];
    for (const f of steps) { await keyboardStep(f); await settle(120); samples.push(await s('layout()')); }
    await settle(500);
    return samples;
  };
  const closeKeyboard = async (steps = ONE_STEP) => {
    await s('blur()');
    const samples = [];
    for (const f of [...steps].reverse().slice(1).concat([0])) { await keyboardStep(f); await settle(120); samples.push(await s('layout()')); }
    await settle(500);
    return samples;
  };
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await metrics(device.height);
    await send('Emulation.setUserAgentOverride', {userAgent: SAMSUNG_UA, platform: 'Linux armv8l'});
    await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await send('Emulation.setFocusEmulationEnabled', {enabled: true});
    await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await send('Page.navigate', {url: `${origin}/${innerRel}?kb=${model}`});
    const state = await waitFor(async () => {
      const value = await evaluate("document.getElementById('sk-result')?.textContent || 'pending'").catch(() => 'pending');
      return value !== 'pending' ? value : null;
    }, `${label} ready`, 60000);
    if (state !== 'ready') throw new Error(`${label}: ${state}`);
    await settle(400);

    const r = {};
    // Empty Home.
    r.homeClosed = {plus: await s('plus()'), layout: await s('layout()')};
    r.homeOpenSteps = await openKeyboard();
    r.homeOpen = {plus: await s('plus()'), layout: await s('layout()')};
    await send('Input.insertText', {text: '롯비에게 질문할게요'});
    await settle(200);
    r.homeTyped = {plus: await s('plus()'), layout: await s('layout()')};
    await s('clear()');
    r.homeCloseSteps = await closeKeyboard();
    r.homeAfter = {plus: await s('plus()'), layout: await s('layout()')};
    // The same with the keyboard rising and falling in three steps.
    r.homeAnimOpenSteps = await openKeyboard(ANIMATED);
    r.homeAnimOpen = {plus: await s('plus()'), layout: await s('layout()')};
    r.homeAnimCloseSteps = await closeKeyboard(ANIMATED);
    r.homeAnimAfter = {plus: await s('plus()'), layout: await s('layout()')};
    // A conversation.
    await s(`send('첫 질문이에요')`);
    await s(`send('두 번째 질문이에요')`);
    await settle(300);
    r.convClosed = {plus: await s('plus()'), layout: await s('layout()')};
    r.convOpenSteps = await openKeyboard();
    r.convOpen = {plus: await s('plus()'), layout: await s('layout()')};
    r.convCloseSteps = await closeKeyboard();
    r.convAfter = {plus: await s('plus()'), layout: await s('layout()')};
    return r;
  } finally {
    devtools.close();
  }
}

// The composer stack's own bottom padding (16px with the keyboard, 10px
// without) plus rounding.
const GAP_MAX = 28;
const STILL = 2;
const JITTER = 4;
const noCover = (p, label, step) => {
  assert.ok(p.glyphs > 0, `${label}: ${step} — the ${p.kind} is drawn (${p.glyphs} glyphs)`);
  assert.equal(p.plusHits, 0, `${label}: ${step} — the + covers or touches the ${p.kind} (first glyph at ${p.firstGlyphLeft}px, + ends at ${p.plusRight}px, ${p.plusHits} glyphs)`);
};
const docked = (l, label, step) => {
  assert.ok(l.composer, `${label}: ${step} — the composer is on screen`);
  assert.ok(l.gapBelowComposer >= 0 && l.gapBelowComposer <= GAP_MAX,
    `${label}: ${step} — the composer sits right above the keyboard / screen bottom (${l.gapBelowComposer}px of empty space under it, visible height ${l.visibleHeight}, composer ${l.composer.top}–${l.composer.bottom})`);
  assert.ok(l.topbarBottom === null || l.composer.top >= l.topbarBottom - 1, `${label}: ${step} — the composer is below the top bar`);
};
const samePlace = (a, b, key, label, step) => {
  if (!a[key] || !b[key]) { assert.equal(Boolean(a[key]), Boolean(b[key]), `${label}: ${step} — ${key} visibility came back`); return; }
  assert.ok(Math.abs(a[key].top - b[key].top) <= STILL && Math.abs(a[key].left - b[key].left) <= STILL,
    `${label}: ${step} — the ${key} came back to where it was (${a[key].top},${a[key].left} → ${b[key].top},${b[key].left})`);
};
// While the keyboard rises, things above the composer only ever move up (or
// leave): a back-and-forth is the "흔들림".
const oneWay = (samples, before, key, label, step) => {
  let previous = before[key] ? before[key].top : null;
  for (const [i, sample] of samples.entries()) {
    const now = sample[key] ? sample[key].top : null;
    if (previous !== null && now !== null) {
      assert.ok(now <= previous + JITTER, `${label}: ${step} step ${i + 1} — the ${key} moved back down ${now - previous}px while the keyboard rose`);
    }
    if (now !== null) previous = now;
  }
};

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.samsung-composer-'));
const server = startServer();
const failures = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const only = process.env.LOTBI_SAMSUNG_CASE;
  for (const device of DEVICES) {
    for (const model of MODELS) {
      const label = `${device.label}/${model}`;
      if (only && !label.includes(only)) continue;
      let r;
      try { r = await runCase(browser, origin, dir, device, model); } catch (error) { failures.push(`${label}: ${error.message}`); continue; }
      console.log(`SAMSUNG_COMPOSER_KEYBOARD_01 ${label}`, JSON.stringify(r));
      try {
        // 1. The + never covers the first characters, keyboard open or closed.
        noCover(r.homeClosed.plus, label, 'Home, keyboard closed');
        noCover(r.homeOpen.plus, label, 'Home, keyboard open');
        noCover(r.homeTyped.plus, label, 'Home, typing');
        noCover(r.homeAfter.plus, label, 'Home, keyboard closed again');
        noCover(r.convClosed.plus, label, 'conversation, keyboard closed');
        noCover(r.convOpen.plus, label, 'conversation, keyboard open');
        noCover(r.homeAnimOpen.plus, label, 'Home, keyboard open (animated)');
        // 2. The composer docks right above the keyboard once it is up. (The
        //    empty Home without a keyboard centres it under the greeting by
        //    design; there it only has to come back to that place.) While an
        //    animated keyboard rises the composer is never under it.
        docked(r.homeOpen.layout, label, 'Home, keyboard open');
        docked(r.homeAnimOpen.layout, label, 'Home, keyboard open (animated)');
        for (const [i, step] of r.homeAnimOpenSteps.entries()) {
          assert.ok(step.composer && step.composer.bottom <= step.visibleHeight + 1, `${label}: Home, keyboard rising step ${i + 1} — the composer is not under the keyboard (${step.composer && step.composer.bottom} > ${step.visibleHeight})`);
        }
        assert.equal(r.homeOpen.layout.keyboardClass, true, `${label}: the keyboard emulation engaged`);
        docked(r.homeTyped.layout, label, 'Home, typing');
        docked(r.convOpen.layout, label, 'conversation, keyboard open');
        docked(r.convAfter.layout, label, 'conversation, keyboard closed again');
        // 3. The Home does not shake: up only while the keyboard rises, back
        //    to exactly where it was when it closes.
        for (const key of ['avatar', 'greeting']) oneWay(r.homeOpenSteps, r.homeClosed.layout, key, label, 'Home, keyboard rising');
        for (const key of ['avatar', 'greeting', 'composer']) {
          samePlace(r.homeClosed.layout, r.homeAfter.layout, key, label, 'Home, keyboard closed again');
          samePlace(r.homeClosed.layout, r.homeAnimAfter.layout, key, label, 'Home, animated keyboard closed again');
        }
        samePlace(r.convClosed.layout, r.convAfter.layout, 'composer', label, 'conversation, keyboard closed again');
      } catch (error) {
        failures.push(error.message);
      }
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}
assert.equal(failures.length, 0, `Samsung composer keyboard failures:\n  ${failures.join('\n  ')}`);
console.log('SAMSUNG-COMPOSER-KEYBOARD-01 OK — on Galaxy viewports with the Samsung Internet UA the + never covers the text, the composer docks right above the keyboard once it is up and is never under it while it rises, and the Home moves one way and comes back');
