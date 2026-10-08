// CHAT-IOS-TOUCH-SCROLL-KEYBOARD-01 (2026-10-08) — a finger on an iPhone can
// always scroll the conversation, and the composer sits right above the
// keyboard, measured with real touch gestures in a real browser against
// index.html.
//
// 실사용 (iPhone 카카오톡 내장 브라우저, 화면 녹화):
//   1. 대화 중 손가락으로 위아래 스크롤이 되지 않는다.
//   2. 키보드가 열릴 때 입력창이 비정상적으로 올라가고 큰 빈 공간이 생긴다.
//
// Touches are Chrome's own touch pipeline (Input.synthesizeScrollGesture /
// Input.dispatchTouchEvent with touch emulation), so the page sees what a
// finger produces: touchstart, pointerdown, touchmove, scroll.
//
// Software keyboards (browser emulation, not an iPhone):
//   ios     — WebKit as reported in bug 237851: visualViewport's resize
//             arrives with the height already reduced but offsetTop still the
//             old value, and the pan (offsetTop = keyboard) lands ~60ms later
//             with no event. Closing is the mirror image.
//   ios26   — the same opening; closing leaves the viewport displaced
//             (offsetTop 24, height 24px short — WebKit bug 297779, iOS 26
//             Safari and WKWebView, which in-app browsers use).
//   android — Chrome's resizes-visual: correct values, with events.
// The page cannot really pan here, so "on screen" is measured against the
// emulated visual viewport: [offsetTop, offsetTop + height].
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const homeShell = read('home-shell.js');
// A drag is the reader's wherever the finger started, the composer included;
// only a tap (no travel) leaves the composer's own focus handling alone.
assert.ok(conversation.includes('const READER_DRAG_SLOP = '), 'a finger that travels is the reader scrolling, wherever it started');
assert.ok(!/markReaderScroll = event => \{\s*if \(event\?\.target instanceof Element && event\.target\.closest\('\.chat-composer-stack'\)\) return;/.test(conversation),
  'a drag that starts on the composer must not be ignored as "not the reader"');
// The shell follows the visual viewport frame by frame until it is still:
// WebKit hands out the old offsetTop with the event and the new one later.
assert.ok(homeShell.includes('const VIEWPORT_STILL_FRAMES = '), 'the shell keeps reading the visual viewport until it settles');
assert.ok(homeShell.includes("'mobile-viewport-displaced'"), 'a viewport left displaced after the keyboard is followed too');
assert.ok(!/setTimeout/.test(homeShell), 'no timer guesses the composer position');

// ── Answers ─────────────────────────────────────────────────────────────
const paragraph = (n, topic) => `${n}번째 문단 — ${topic}을 설명하는 부분이에요. 손가락으로 위아래로 움직여도 읽는 위치를 화면이 억지로 되돌리지 않는지 확인하는 문장입니다.`;
function longAnswer(minChars, topic) {
  const blocks = [`**요약:** ${topic}의 첫 줄이에요.`];
  for (let i = 1; blocks.join('\n\n').length < minChars; i += 1) {
    blocks.push(paragraph(i, topic));
    if (i % 4 === 0) blocks.push(`- **${i}번 정리** 핵심 하나\n- ${i}번 정리 핵심 둘`);
  }
  blocks.push('**정리:** 여기가 마지막이에요.');
  return blocks.join('\n\n');
}
const ANSWERS = {short: '네, 짧게 답할게요.', long1000: longAnswer(1100, '천 자 답변'), long3000: longAnswer(3200, '삼천 자 답변')};

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
  throw new Error('Chrome/Chromium is required for the iOS touch scroll / keyboard validation.');
}

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36';
const CASES = [
  {label: 'iphone-se-375x667/ios', width: 375, height: 667, kb: 'ios', keyboard: 291, ua: IOS_UA},
  {label: 'iphone-390x844/ios', width: 390, height: 844, kb: 'ios', keyboard: 336, ua: IOS_UA},
  {label: 'iphone-390x844/ios26', width: 390, height: 844, kb: 'ios26', keyboard: 336, ua: IOS_UA},
  {label: 'android-412x915/android', width: 412, height: 915, kb: 'android', keyboard: 320, ua: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, kb: '', keyboard: 0, ua: DESKTOP_UA},
];
const STUCK_OFFSET = 24;

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', `<head>
  <base href="/">
  <script>
  // Focus-driven software keyboard (see the header of this file). Installed
  // before home-shell.js reads visualViewport.
  (() => {
    const params = new URLSearchParams(location.search);
    const model = params.get('kb');
    if (!model) return;
    const KEYBOARD = Number(params.get('k')) || 0;
    const STUCK = ${STUCK_OFFSET};
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
    const fire = type => target.dispatchEvent(new Event(type));
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const settle = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
    const open = () => {
      settle();
      if (model === 'android') { later(60, () => { state.height = window.innerHeight - KEYBOARD; state.offsetTop = KEYBOARD; fire('resize'); fire('scroll'); }); return; }
      later(120, () => { state.height = window.innerHeight - KEYBOARD; fire('resize'); later(60, () => { state.offsetTop = KEYBOARD; }); });
    };
    const close = () => {
      settle();
      if (model === 'android') { later(60, () => { state.height = null; state.offsetTop = 0; fire('resize'); fire('scroll'); }); return; }
      if (model === 'ios26') { later(120, () => { state.height = window.innerHeight - STUCK; fire('resize'); later(60, () => { state.offsetTop = STUCK; }); }); return; }
      later(120, () => { state.height = null; fire('resize'); later(60, () => { state.offsetTop = 0; }); });
    };
    document.addEventListener('focusin', event => { if (event.target && event.target.id === 'lotbi-prompt') open(); }, true);
    document.addEventListener('focusout', event => { if (event.target && event.target.id === 'lotbi-prompt') close(); }, true);
    window.__kbSettled = () => timers.size === 0;
  })();
  </script>`);
  const harness = `<script type="module">
const out = document.getElementById('it-result');
try {
  localStorage.clear();
  const ANSWERS = ${JSON.stringify(ANSWERS)};
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}});
  let turn = 0;
  window.__answerDelay = 0;
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const text = JSON.parse(init.body).text;
      turn += 1;
      if (window.__answerDelay) await new Promise(r => setTimeout(r, window.__answerDelay));
      const key = text.includes('삼천자') ? 'long3000' : text.includes('천자') ? 'long1000' : 'short';
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: key === 'short' ? turn + '번째 답변이에요. 짧게 확인합니다.' : ANSWERS[key],
        response_mode:'AI_GROUNDED_CURRENT_FACT', correlation_id:'req_it_'+turn,
        intent:{action:'UNKNOWN'}, follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        sources:[{title:'출처 '+turn,url:'https://example.com/s'+turn}], retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=ios-touch-scroll-01');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const main = document.getElementById('main-content');
  const prompt = document.getElementById('lotbi-prompt');
  const thread = document.getElementById('conversation-thread');
  const topbar = document.querySelector('.chat-topbar');
  const stack = document.querySelector('.chat-composer-stack');
  const composer = document.querySelector('.chat-composer');
  const vv = () => window.visualViewport;
  const visible = () => ({top: vv().offsetTop, bottom: vv().offsetTop + vv().height});
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const lastAssistant = () => assistants().pop();
  const questions = () => [...thread.querySelectorAll('.chat-message-user')];
  const readingTop = () => Math.max(visible().top, topbar.getBoundingClientRect().bottom);
  const readingBottom = () => Math.min(composer.getBoundingClientRect().top, visible().bottom);
  const marks = new Map();
  let growth = null;
  window.__h = {
    sleep,
    assistants: () => assistants().length,
    clickSend: text => {
      prompt.value = text;
      prompt.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
    },
    answered: async before => {
      for (let i = 0; i < 400 && assistants().length <= before; i += 1) await sleep(25);
      if (assistants().length <= before) throw new Error('no answer');
      await sleep(450);
    },
    rect: selector => {
      const node = selector === 'prompt' ? prompt : selector === 'composer' ? composer : selector === 'send' ? document.querySelector('.send-button') : document.querySelector(selector);
      const r = node.getBoundingClientRect();
      return {x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom};
    },
    // A point a finger can put down on the conversation: inside the reading
    // area, on whatever text is there, away from links and buttons.
    // A finger moving down starts just under the bar, one moving up just above
    // the composer, so the whole travel can happen on the conversation.
    readingPoint: (distance = 0) => {
      const top = readingTop();
      const bottom = readingBottom();
      const x = Math.round(main.getBoundingClientRect().left + Math.min(main.clientWidth * 0.5, 180));
      if (distance > 0) return {x, y: Math.round(top + 10)};
      if (distance < 0) return {x, y: Math.round(bottom - 10)};
      return {x, y: Math.round(top + (bottom - top) * 0.55)};
    },
    // Somewhere to tap that is only conversation text: the top-left of the
    // reading area (↓ 최신 답변 floats at the bottom centre).
    quietPoint: () => ({x: Math.round(main.getBoundingClientRect().left + 28), y: Math.round(readingTop() + 14)}),
    view: () => {
      const v = visible();
      const t = topbar.getBoundingClientRect();
      const c = composer.getBoundingClientRect();
      const s = stack.getBoundingClientRect();
      return {
        keyboardClass: document.body.classList.contains('mobile-keyboard-open'),
        displacedClass: document.body.classList.contains('mobile-viewport-displaced'),
        focused: document.activeElement === prompt,
        visibleTop: Math.round(v.top), visibleBottom: Math.round(v.bottom),
        topbarTop: Math.round(t.top), topbarBottom: Math.round(t.bottom),
        composerTop: Math.round(c.top), composerBottom: Math.round(c.bottom), stackBottom: Math.round(s.bottom),
        // Room between the composer and the keyboard (or the bottom of the screen).
        gapBelowComposer: Math.round(v.bottom - c.bottom),
        topbarCut: Math.round(v.top - t.top),
        readingRoom: Math.round(readingBottom() - readingTop()),
        scrollTop: Math.round(main.scrollTop),
        distance: Math.round(main.scrollHeight - main.scrollTop - main.clientHeight),
        jumpVisible: (() => { const b = document.querySelector('.conversation-jump-latest'); return Boolean(b) && !b.hidden; })(),
      };
    },
    turnView: () => {
      const q = questions().pop();
      return {questionOffset: Math.round(q.getBoundingClientRect().top - readingTop()), questionText: q.textContent.slice(0, 30)};
    },
    firstQuestion: () => {
      const q = questions()[0];
      const r = q.getBoundingClientRect();
      return {top: Math.round(r.top - readingTop()), onScreen: r.top >= readingTop() - 1 && r.bottom <= readingBottom() + 1};
    },
    // The item nearest the middle of the reading area.
    mark: name => {
      const top = readingTop();
      const bottom = readingBottom();
      const middle = (top + bottom) / 2;
      let best = null;
      for (const node of thread.querySelectorAll('.chat-message-user, .chat-message-body > *, time')) {
        const box = node.getBoundingClientRect();
        if (box.height <= 0 || box.bottom <= top || box.top >= bottom) continue;
        const away = middle < box.top ? box.top - middle : middle > box.bottom ? middle - box.bottom : 0;
        if (!best || away < best.away) best = {node, away};
      }
      if (!best) return null;
      // On screen means relative to the visual viewport: with the keyboard the
      // shell moves with offsetTop, and so does what the eye sees.
      marks.set(name, {node: best.node, top: best.node.getBoundingClientRect().top - vv().offsetTop});
      return (best.node.textContent || '').slice(0, 24);
    },
    // The line at the top of the reading area (what the page itself keeps
    // when the keyboard opens or closes under a reader).
    markTop: name => {
      const top = readingTop();
      for (const node of thread.querySelectorAll('.chat-message-user, .chat-message-body > *, time')) {
        const box = node.getBoundingClientRect();
        if (box.height > 0 && box.bottom > top + 1) {
          marks.set(name, {node, top: box.top - vv().offsetTop});
          return (node.textContent || '').slice(0, 24);
        }
      }
      return null;
    },
    shift: name => {
      const m = marks.get(name);
      return m && m.node.isConnected ? Math.round(m.node.getBoundingClientRect().top - vv().offsetTop - m.top) : null;
    },
    // Growth at the end of the newest answer, the way late blocks, images and
    // cards arrive: every block goes through the same ResizeObserver path.
    startGrowth: (count, every) => {
      const body = lastAssistant().querySelector('.chat-message-body');
      growth = (async () => {
        for (let i = 1; i <= count; i += 1) {
          const p = document.createElement('p');
          p.className = 'chat-message-paragraph';
          p.textContent = '이어 붙는 ' + i + '번째 블록이에요. 손가락으로 읽던 위치를 침범하면 안 됩니다.';
          body.appendChild(p);
          await sleep(every);
        }
      })();
      return true;
    },
    growthDone: async () => { await growth; await sleep(350); return true; },
    pageReturn: async () => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
      await sleep(200);
      Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
      window.dispatchEvent(new Event('focus'));
      await sleep(600);
      return true;
    },
    kbSettled: () => (typeof window.__kbSettled === 'function' ? window.__kbSettled() : true),
  };
  out.textContent = 'ready';
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="it-result" hidden>pending</pre>`;
  return html.replace(runtime[0], harness);
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

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  if (!fs.existsSync(path.join(ROOT, innerRel))) fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const devtools = await openDevtools(browser, profile);
  const {send} = devtools;
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(`${testCase.label}: ${expression}: ${JSON.stringify(result.exceptionDetails).slice(0, 600)}`);
    return result.result.value;
  };
  const h = (call) => evaluate(`window.__h.${call}`);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const mobile = Boolean(testCase.kb);
  // A finger: Chrome's touch pipeline does the scrolling, as on a phone
  // (headless ignores Input.synthesizeScrollGesture's touch moves, so the
  // touch points are sent one by one). The finger rests before lifting, so no
  // fling carries the scroll further. Positive distance = the finger moves
  // down = earlier messages come into view. On the desktop the same distance
  // goes through the mouse wheel.
  const drag = async (point, wanted) => {
    // The finger stays on the screen.
    const distance = wanted > 0 ? Math.min(wanted, testCase.height - 4 - point.y) : Math.max(wanted, 4 - point.y);
    if (mobile) {
      const steps = Math.max(6, Math.round(Math.abs(distance) / 18));
      await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y}]});
      for (let step = 1; step <= steps; step += 1) {
        await send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x, y: Math.round(point.y + (distance * step) / steps)}]});
        await sleep(16);
      }
      for (let rest = 0; rest < 4; rest += 1) {
        await send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x, y: Math.round(point.y + distance)}]});
        await sleep(30);
      }
      await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await send('Input.dispatchMouseEvent', {type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY: -distance});
    }
    await sleep(120);
  };
  const tap = async point => {
    if (mobile) {
      await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y}]});
      await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1});
      await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1});
    }
  };
  const center = r => ({x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2)});
  const keyboardSettled = async () => { await waitFor(() => h('kbSettled()'), 'keyboard settled', 5000); await sleep(500); };
  const tapComposer = async () => { await tap(center(await h(`rect('prompt')`))); await keyboardSettled(); };
  // A point on the composer that is neither the text nor a button: its own
  // padding, where a thumb rests when it starts a scroll from the bottom.
  const composerEdge = async (atTop = false) => {
    const c = await h(`rect('composer')`);
    const p = await h(`rect('prompt')`);
    return {x: Math.round(c.x + 5), y: atTop ? Math.round(c.y + 4) : Math.round(Math.max(c.y + 4, Math.min(p.y + p.h / 2, c.bottom - 4)))};
  };
  const sendQuestion = async text => {
    const before = await h('assistants()');
    if (mobile) {
      await tapComposer();
      await send('Input.insertText', {text});
      await sleep(200);
      await tap(center(await h(`rect('send')`)));
    } else {
      await evaluate(`window.__h.clickSend(${JSON.stringify(text)})`);
    }
    await h(`answered(${before})`);
    await keyboardSettled();
  };
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile});
    await send('Emulation.setUserAgentOverride', {userAgent: testCase.ua});
    if (mobile) await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    // Headless has no focused window: without this focus/blur never happen.
    await send('Emulation.setFocusEmulationEnabled', {enabled: true});
    await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    // A slow machine (the Linux gate), on demand: LOTBI_VALIDATOR_CPU_THROTTLE=6.
    if (process.env.LOTBI_VALIDATOR_CPU_THROTTLE) await send('Emulation.setCPUThrottlingRate', {rate: Number(process.env.LOTBI_VALIDATOR_CPU_THROTTLE)});
    const query = mobile ? `?kb=${testCase.kb}&k=${testCase.keyboard}` : '';
    await send('Page.navigate', {url: `${origin}/${innerRel}${query}`});
    const state = await waitFor(async () => {
      const value = await evaluate("document.getElementById('it-result')?.textContent || 'pending'").catch(() => 'pending');
      return value !== 'pending' ? value : null;
    }, `${testCase.label} ready`, 30000);
    if (state !== 'ready') throw new Error(`${testCase.label}: ${state}`);

    const r = {};
    // 0. A conversation longer than the screen.
    await evaluate(`window.__h.clickSend('천자 넘게 설명해줘')`); await h('answered(0)');
    for (let i = 1; i <= 3; i += 1) { const n = await h('assistants()'); await evaluate(`window.__h.clickSend('이전 질문 ${i}')`); await h(`answered(${n})`); }
    await sendQuestion('삼천자 넘게 길게 설명해줘');
    r.sent = {view: await h('view()'), turn: await h('turnView()')};

    if (mobile) {
      // 1. Keyboard opens from a tap on the composer (closed first if a build
      //    kept it open after sending).
      if ((await h('view()')).focused) { await tap(await h('quietPoint()')); await keyboardSettled(); }
      // A reader in the middle of the answer taps the composer: the line at
      // the top of what they read stays where it was on screen.
      await drag(await h('readingPoint(200)'), 200);
      r.openLine = {item: await h(`markTop('open')`)};
      await tapComposer();
      r.openLine.shift = await h(`shift('open')`);
      r.open = await h('view()');
      // 2. With the keyboard open: a finger on the conversation scrolls it,
      //    and growth afterwards does not take the reader back.
      r.openDrag = {before: (await h('view()')).scrollTop};
      await drag(await h('readingPoint(220)'), 220);
      await drag(await h('readingPoint(220)'), 220);
      r.openDrag.after = (await h('view()')).scrollTop;
      r.openDrag.item = await h(`mark('openDrag')`);
      await h('startGrowth(6, 60)'); await h('growthDone()');
      r.openDrag.shift = await h(`shift('openDrag')`);
      // 3. With the keyboard open: a scroll that starts on the composer (the
      //    thumb pushes up, newer lines come into view).
      r.openComposerDrag = {before: (await h('view()')).scrollTop};
      await drag(await composerEdge(), -160);
      r.openComposerDrag.after = (await h('view()')).scrollTop;
      r.openComposerDrag.item = await h(`mark('openComposerDrag')`);
      await h('startGrowth(6, 60)'); await h('growthDone()');
      r.openComposerDrag.shift = await h(`shift('openComposerDrag')`);
      // 4. Keyboard closes (a tap on the conversation): the reading position stays.
      r.beforeClose = {item: await h(`mark('close')`), view: await h('view()')};
      await tap(await h('quietPoint()'));
      await keyboardSettled();
      r.closed = {view: await h('view()'), shift: await h(`shift('close')`)};
    }

    // 5. A new question while reading: it is anchored at the top and, on a
    //    phone, the keyboard goes away.
    await sendQuestion('삼천자 넘게 하나 더 설명해줘');
    r.second = {view: await h('view()'), turn: await h('turnView()')};

    // 6. Growth while a finger drags back up through the answer.
    await h('startGrowth(18, 70)');
    await sleep(150);
    r.growthDrag = {before: (await h('view()')).scrollTop};
    await drag(await h('readingPoint(240)'), 240);
    r.growthDrag.after = (await h('view()')).scrollTop;
    r.growthDrag.item = await h(`mark('growthDrag')`);
    await h('growthDone()');
    r.growthDrag.shift = await h(`shift('growthDrag')`);
    r.growthDrag.view = await h('view()');

    // 7. A drag that starts on the composer text itself (not focused yet): the
    //    thumb pushes up from the bottom of the screen, newer lines come in.
    if (mobile) {
      r.textDrag = {before: (await h('view()')).scrollTop};
      const p = await h(`rect('prompt')`);
      await drag({x: Math.round(p.x + p.w / 2), y: Math.round(p.y + p.h / 2)}, -200);
      r.textDrag.after = (await h('view()')).scrollTop;
      r.textDrag.item = await h(`mark('textDrag')`);
      await h('startGrowth(6, 60)'); await h('growthDone()');
      r.textDrag.shift = await h(`shift('textDrag')`);
      r.textDrag.focused = (await h('view()')).focused;
    }

    // 8. The reader follows the newest message (↓ 최신 답변) and, while it
    //    grows, pulls the conversation down from the composer's top edge
    //    (the wheel on the desktop).
    const jump = await evaluate(`(() => { const b = document.querySelector('.conversation-jump-latest'); if (b && !b.hidden) { b.click(); return true; } const m = document.getElementById('main-content'); m.scrollTop = m.scrollHeight; return false; })()`);
    await sleep(400);
    r.tailDrag = {jump, beforeView: await h('view()')};
    // One block every 250ms: at most one can land between the finger coming
    // down and travelling far enough to be the reader's, however slow the
    // machine (the Linux gate is).
    await h('startGrowth(8, 250)');
    await sleep(300);
    // Following has carried the reader down with the growth so far; the drag
    // is measured from where it starts.
    const tailStart = mobile ? await composerEdge(true) : await h('readingPoint(200)');
    r.tailDrag.before = (await h('view()')).scrollTop;
    await drag(tailStart, 200);
    const afterTail = await h('view()');
    r.tailDrag.after = afterTail.scrollTop;
    r.tailDrag.afterDistance = afterTail.distance;
    r.tailDrag.item = await h(`mark('tailDrag')`);
    await h('growthDone()');
    r.tailDrag.shift = await h(`shift('tailDrag')`);
    r.tailDrag.view = await h('view()');

    // 9. Back to the earliest messages by finger, one drag at a time (the
    //    wheel takes the reader to about three screens below them first, so
    //    the run stays short on the Linux gate).
    await evaluate(`(() => { const m = document.getElementById('main-content'); m.dispatchEvent(new WheelEvent('wheel', {deltaY: -1, bubbles: true})); m.scrollTop = Math.min(m.scrollTop, m.clientHeight * 3); m.dispatchEvent(new Event('scroll')); return true; })()`);
    await sleep(200);
    let drags = 0;
    while (drags < 30 && (await h('view()')).scrollTop > 0) { await drag(await h('readingPoint(600)'), 600); drags += 1; }
    r.earliest = {drags, view: await h('view()'), first: await h('firstQuestion()')};

    // 10. Leaving the browser and coming back keeps the place.
    await drag(await h('readingPoint(-300)'), -300);
    r.returned = {item: await h(`mark('return')`)};
    await h('pageReturn()');
    r.returned.shift = await h(`shift('return')`);
    r.returned.view = await h('view()');

    // 11. And a new question from there.
    await sendQuestion('천자 넘게 마지막으로 설명해줘');
    r.last = {view: await h('view()'), turn: await h('turnView()')};
    r.overflow = await evaluate('({page: document.documentElement.scrollWidth - document.documentElement.clientWidth})');
    return r;
  } finally {
    devtools.close();
  }
}

// Thresholds. A drag of D px moves the conversation by at least D/2 (Chrome
// keeps a touch slop and the gesture's own ramp); "still" is 2px.
const STILL = 2;
const QUESTION_TOP_MAX = 40;
const COMPOSER_GAP_MAX = 28; // the composer stack's own padding (16px) plus rounding
const moved = (d, min, label, step) => assert.ok(Math.abs(d.after - d.before) >= min,
  `${label}: ${step} — the finger scrolled the conversation (${d.before} → ${d.after})`);
const stayed = (d, label, step) => assert.ok(d.shift !== null && Math.abs(d.shift) <= STILL,
  `${label}: ${step} — nothing took the reader back afterwards (${d.shift}px, item ${JSON.stringify(d.item)})`);
const docked = (v, label, step) => {
  assert.ok(v.gapBelowComposer >= 0 && v.gapBelowComposer <= COMPOSER_GAP_MAX,
    `${label}: ${step} — the composer sits right above the keyboard / screen bottom (gap ${v.gapBelowComposer}px, visible ${v.visibleTop}–${v.visibleBottom}, composer ${v.composerTop}–${v.composerBottom})`);
  assert.ok(v.topbarCut <= 1, `${label}: ${step} — the top bar is on screen (cut ${v.topbarCut}px)`);
  assert.ok(v.readingRoom > 0, `${label}: ${step} — some conversation is visible between the bar and the composer (${v.readingRoom}px)`);
};
const anchored = (t, label, step) => assert.ok(t.questionOffset >= 0 && t.questionOffset <= QUESTION_TOP_MAX,
  `${label}: ${step} — the question is at the top (${t.questionOffset}px)`);

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.chat-ios-touch-'));
const server = startServer();
const failures = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const only = process.env.LOTBI_IOS_TOUCH_CASE;
  for (const testCase of CASES.filter(c => !only || c.label.includes(only))) {
    const label = testCase.label;
    let r;
    try {
      r = await runCase(browser, origin, dir, testCase);
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      continue;
    }
    console.log(`CHAT_IOS_TOUCH_SCROLL_KEYBOARD_01 ${label}`, JSON.stringify(r));
    try {
      const mobile = Boolean(testCase.kb);
      anchored(r.sent.turn, label, 'question sent');
      docked(r.sent.view, label, 'after sending');
      if (mobile) {
        assert.equal(r.sent.view.focused, false, `${label}: sending closed the keyboard`);
        assert.equal(r.open.keyboardClass, true, `${label}: the keyboard emulation engaged`);
        assert.ok(r.openLine.shift !== null && Math.abs(r.openLine.shift) <= STILL, `${label}: opening the keyboard kept the line being read on screen (${r.openLine.shift}px, ${JSON.stringify(r.openLine.item)})`);
        docked(r.open, label, 'keyboard open');
        moved(r.openDrag, 100, label, 'keyboard open, drag on the conversation');
        stayed(r.openDrag, label, 'keyboard open, drag on the conversation');
        moved(r.openComposerDrag, 70, label, 'keyboard open, drag starting on the composer');
        stayed(r.openComposerDrag, label, 'keyboard open, drag starting on the composer');
        assert.equal(r.closed.view.keyboardClass, false, `${label}: the keyboard closed`);
        assert.ok(r.closed.shift !== null && Math.abs(r.closed.shift) <= STILL, `${label}: closing the keyboard kept the line being read (${r.closed.shift}px)`);
        docked(r.closed.view, label, 'keyboard closed');
        if (testCase.kb === 'ios26') assert.equal(r.closed.view.displacedClass, true, `${label}: the displaced viewport is followed`);
        else assert.equal(r.closed.view.displacedClass, false, `${label}: an undisplaced viewport is left to the normal layout`);
        moved(r.textDrag, 80, label, 'drag starting on the composer text');
        stayed(r.textDrag, label, 'drag starting on the composer text');
        assert.equal(r.textDrag.focused, false, `${label}: a drag over the composer is not a tap — the keyboard stays closed`);
      }
      anchored(r.second.turn, label, 'second question');
      docked(r.second.view, label, 'second question');
      moved(r.growthDrag, 100, label, 'drag while the answer grows');
      stayed(r.growthDrag, label, 'drag while the answer grows');
      assert.ok(r.growthDrag.view.jumpVisible, `${label}: ↓ 최신 답변 is offered while reading above new content`);
      assert.ok(r.tailDrag.beforeView.distance <= 2, `${label}: the reader was following the newest message before the drag (${r.tailDrag.beforeView.distance}px)`);
      // The composer's top edge leaves a finger ~110px of screen to travel
      // down, and following may still carry a block of growth until the finger
      // has moved: what counts is that the drag took the reader off the end.
      assert.ok(r.tailDrag.after < r.tailDrag.before, `${label}: ${mobile ? 'following, drag starting on the composer' : 'following, wheel'} — the conversation went up with the finger, not down with the growth (${r.tailDrag.before} → ${r.tailDrag.after})`);
      assert.ok(r.tailDrag.afterDistance >= 40, `${label}: the drag took the reader off the newest message (${r.tailDrag.afterDistance}px below)`);
      stayed(r.tailDrag, label, mobile ? 'following, drag starting on the composer' : 'following, wheel');
      assert.ok(r.tailDrag.view.distance > 80, `${label}: growth did not pull the reader back to the bottom (${r.tailDrag.view.distance}px left)`);
      assert.ok(r.earliest.drags >= 2, `${label}: the last screens before the earliest message were travelled by finger (${r.earliest.drags} drags)`);
      assert.equal(r.earliest.view.scrollTop, 0, `${label}: the earliest message is reachable by finger (${r.earliest.drags} drags)`);
      assert.ok(r.earliest.first.onScreen, `${label}: the first question is on screen at the start (${r.earliest.first.top}px)`);
      assert.ok(r.returned.shift !== null && Math.abs(r.returned.shift) <= STILL, `${label}: leaving and coming back kept the place (${r.returned.shift}px)`);
      docked(r.returned.view, label, 'back in the browser');
      anchored(r.last.turn, label, 'question after reading back');
      docked(r.last.view, label, 'question after reading back');
      assert.ok(r.overflow.page <= 0, `${label}: no horizontal page scroll`);
    } catch (error) {
      failures.push(error.message);
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}
assert.equal(failures.length, 0, `iOS touch scroll / keyboard failures:\n  ${failures.join('\n  ')}`);
console.log('CHAT-IOS-TOUCH-SCROLL-KEYBOARD-01 OK — a finger scrolls the conversation from anywhere, nothing pulls it back, and the composer stays right above the keyboard on iOS-shaped, iOS 26-displaced and Android viewports');
