// SITE-CHAT-ANSWER-QUALITY-P0 (2026-10-07) — mobile conversation tail and
// comparison tables, measured in a real browser against the real index.html.
//
// Production on iPhone:
//   D  after sending, the new answer's sources and action row ended up under
//      the composer while the keyboard was open; the reader had to scroll.
//   E  reopening a long conversation, or tapping the composer to reply, left
//      the view near the top or middle instead of the newest message.
//   G  "Pro랑 Pro Max 비교" arrived as a pipe table and the phone showed the
//      raw "| 항목 | ... |" source.
//
// Core is replaced by a fake that answers instantly (or after a delay when a
// test needs to scroll while waiting). The software keyboard is emulated the
// way iOS presents it: the layout viewport keeps its height and only
// visualViewport.height shrinks. This is a browser emulation, not an iPhone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const messageBody = read('site-message-body.js');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');

for (const needle of [
  'function createTable(headerLine, bodyLines)',
  "const table = document.createElement('table')",
  "table.classList.add('is-comparison')",
  "scroll.className = 'chat-table-scroll'",
  'const TABLE_SEPARATOR =',
]) assert.ok(messageBody.includes(needle), `table renderer missing: ${needle}`);
// One unparsable regex takes the whole chat module down on older iOS Safari.
assert.ok(!/\(\?<[!=]/.test(messageBody), 'the message renderer must not use lookbehind (older iOS Safari cannot parse it)');
for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'createContextualFragment']) {
  assert.ok(!messageBody.includes(sink), `the message renderer must not use ${sink}`);
}
for (const needle of [
  'const scrollToConversationTail = ({force = false} = {}) =>',
  'const stickThreadToBottom = () => scrollToConversationTail({force: true});',
  "if (!thread.hidden && followThreadBottom) scrollToConversationTail();",
  "prompt.addEventListener('pointerdown', () => {",
  'tailObserver.observe(mainScrollHost);',
  '(followThreadBottom || isThreadNearBottom())',
]) assert.ok(conversation.includes(needle), `conversation tail contract missing: ${needle}`);
assert.ok(/const renderActiveThread = \(\) => \{[\s\S]*?stickThreadToBottom\(\);\s*\};/.test(conversation),
  'reopening a conversation must land on its newest message');
assert.ok(/\.chat-table-scroll\s*\{[^}]*overflow-x:\s*auto/.test(css), 'a wide table scrolls inside its own box');
assert.ok(/\.chat-message-table\.is-comparison\s*\{[^}]*table-layout:\s*fixed/.test(css), 'A vs B tables keep fixed columns');
assert.ok(/\.chat-message-table th,\s*\.chat-message-table td\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css), 'cells wrap long names');

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
  throw new Error('Chrome/Chromium is required for the chat answer quality validation.');
}

const CASES = [
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, keyboard: 336},
  {label: 'phone-375x667', width: 375, height: 667, mobile: true, keyboard: 291},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, keyboard: 0},
];
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

const COMPARISON = [
  '두 모델은 화면 크기와 배터리에서 가장 크게 갈려요.',
  '',
  '| 항목 | iPhone 17 Pro | iPhone 17 Pro Max (아주 긴 제품명 줄바꿈 확인) |',
  '|---|---|---|',
  '| 화면 | 6.3형 | 6.9형 |',
  '| 무게 | 가벼움 | |',
  '| 배터리 | 확인 필요 | 더 김 |',
  '| 가격 | 확인 필요 | 확인 필요 |',
  '',
  '추천: 한 손 사용은 Pro, 영상·배터리는 Pro Max가 잘 맞아요.',
].join('\n');
const WIDE = [
  '세 가지를 같이 보면 이래요.',
  '',
  '| 항목 | 갤럭시 S26 | iPhone 17 Pro | 픽셀 11 Pro | 샤오미 16 Ultra |',
  '|---|---|---|---|---|',
  '| 화면 | 6.2형 | 6.3형 | 6.3형 | 6.7형 |',
  '| 카메라 | 확인 필요 | 확인 필요 | 확인 필요 | 확인 필요 |',
  '',
  '추천: 쓰던 생태계를 먼저 고르세요.',
].join('\n');
const LONG = Array.from({length: 14}, (_, i) => `${i + 1}번째 문단이에요. 답변이 길어져서 화면 아래로 이어지는 경우를 확인합니다.`).join('\n\n');

function buildInner(testCase) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', `<head>
  <base href="/">
  <script>
  // iOS-shaped software keyboard: the layout viewport keeps its height and only
  // visualViewport shrinks. window.visualViewport is replaced before
  // home-shell.js reads it.
  (() => {
    const target = new EventTarget();
    const state = {height: window.innerHeight, width: window.innerWidth, offsetTop: 0};
    const fake = Object.assign(target, {});
    Object.defineProperties(fake, {
      height: {get: () => state.height},
      width: {get: () => state.width},
      offsetTop: {get: () => state.offsetTop},
      offsetLeft: {get: () => 0},
      pageTop: {get: () => 0},
      scale: {get: () => 1},
    });
    Object.defineProperty(window, 'visualViewport', {configurable: true, get: () => fake});
    window.__keyboard = height => { state.height = height; fake.dispatchEvent(new Event('resize')); };
    window.__roCalls = 0;
    const NativeRO = window.ResizeObserver;
    if (NativeRO) window.ResizeObserver = class extends NativeRO { constructor(cb) { super((...args) => { window.__roCalls += 1; return cb(...args); }); } };
    window.__layoutHeight = () => window.innerHeight;
  })();
  </script>`);
  const harness = `<script type="module">
const out = document.getElementById('cq-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e),local:Object.keys(localStorage),session:Object.keys(sessionStorage),recent:document.querySelector('[data-recent-conversations]')?.children.length??null,threadHidden:document.getElementById('conversation-thread')?.hidden,restore:document.body.dataset.conversationRestore,ns:{durable:localStorage.getItem('lotbi.site.ux.v1.anonymous-namespace'),session:sessionStorage.getItem('lotbi.site.ux.v1.anonymous-namespace')},stored:Object.keys(localStorage).filter(k=>k.includes('.threads.')).map(k=>{try{const v=JSON.parse(localStorage.getItem(k));return {k,threads:(v.threads||[]).length,active:v.activeThreadId,msgs:(v.threads||[]).map(t=>t.messages.length),sample:JSON.stringify((v.threads||[])[0]?.messages?.[1]||null).slice(0,600)}}catch(e){return String(e)}})}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 110000);
const COMPARISON = ${JSON.stringify(COMPARISON)};
const WIDE = ${JSON.stringify(WIDE)};
const LONG = ${JSON.stringify(LONG)};
const PHASE = new URLSearchParams(location.search).get('phase') || 'build';
try {
  if (PHASE === 'build') localStorage.clear();
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
      const answer = text.includes('넓은') ? WIDE : text.includes('비교') ? COMPARISON : text.includes('길게') ? LONG : turn + '번째 답변이에요. 짧게 확인합니다.';
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:answer,response_mode:'AI_GROUNDED_CURRENT_FACT',correlation_id:'req_cq_'+turn,
        intent:{action:'UNKNOWN'},follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        sources:[{title:'출처 하나 '+turn,url:'https://example.com/a'+turn},{title:'출처 둘 '+turn,url:'https://example.com/b'+turn}],
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=chat-answer-quality-p0');
  if (!conversation.mountConversation()) throw new Error('mount');
  // Production learns it is signed out from site-continuity; this fake Core
  // has no Account, so the page is told directly - which is also what
  // restores a stored conversation on load.
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label) => {
    for (let i=0;i<800;i+=1) { const v=fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout '+label);
  };
  const main = document.getElementById('main-content');
  const prompt = document.getElementById('lotbi-prompt');
  const composer = document.querySelector('.chat-composer-stack');
  const visibleHeight = () => window.visualViewport.height;
  const distance = () => Math.round(main.scrollHeight - main.scrollTop - main.clientHeight);
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const lastAssistant = () => assistants().at(-1);
  const tail = () => {
    const message = lastAssistant();
    const actions = message?.querySelector('.chat-message-actions');
    const sources = message?.querySelector('.chat-message-sources');
    const composerTop = composer.getBoundingClientRect().top;
    const bottomEdge = Math.min(composerTop, visibleHeight());
    const actionsRect = actions?.getBoundingClientRect();
    return {
      distance: distance(),
      actionsBottom: actionsRect ? Math.round(actionsRect.bottom) : null,
      actionsTop: actionsRect ? Math.round(actionsRect.top) : null,
      sourcesPresent: Boolean(sources),
      composerTop: Math.round(composerTop),
      visibleHeight: visibleHeight(),
      actionsVisible: Boolean(actionsRect) && actionsRect.bottom <= bottomEdge + 1 && actionsRect.top >= 0,
      ro: window.__roCalls,
      focused: document.activeElement === prompt,
      keyboardClass: document.body.classList.contains('mobile-keyboard-open'),
    };
  };
  const send = async text => {
    const before = assistants().length;
    prompt.value = text;
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
    await wait(() => assistants().length > before, 'answer '+text);
    await sleep(450);
  };
  const readerScroll = async delta => {
    main.dispatchEvent(new WheelEvent('wheel', {deltaY: delta, bubbles: true}));
    main.scrollTop = Math.max(0, main.scrollTop + delta);
    main.dispatchEvent(new Event('scroll'));
    await sleep(60);
  };
  // What the reader is looking at: the conversation item (message, assistant
  // row or time separator) across the middle of the visible area, and where it
  // sits. Content above it can change size (the avatar moves between rows) and
  // the browser's scroll anchoring then moves scrollTop to keep this item
  // still - so "did the reader's view move?" is answered by this item's
  // position, not by scrollTop.
  // The item is chosen by geometry, not by hit-testing the single middle
  // point: that point lands beside a right-aligned user bubble or in the gap
  // between two items at about one reading position in seven, and which
  // positions those are depends on font metrics (the Linux gate missed where
  // Windows hit). When the middle is such a gap, the nearest visible item is
  // the one being read.
  const thread = document.getElementById('conversation-thread');
  const readingAnchor = () => {
    const rect = main.getBoundingClientRect();
    const top = rect.top;
    const bottom = rect.top + Math.min(rect.height, visibleHeight());
    const middle = (top + bottom) / 2;
    let best = null;
    for (const node of thread.children) {
      if (!node.matches('.chat-message, .chat-assistant-row, time')) continue;
      const box = node.getBoundingClientRect();
      if (box.height <= 0 || box.bottom <= top || box.top >= bottom) continue;
      const away = middle < box.top ? box.top - middle : middle > box.bottom ? middle - box.bottom : 0;
      if (!best || away < best.away) best = {node, away};
    }
    return best ? {node: best.node, top: Math.round(best.node.getBoundingClientRect().top), kind: best.node.className || best.node.tagName} : null;
  };
  const overflow = () => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main: main.scrollWidth - main.clientWidth,
  });
  const result = {ok:true, phase:PHASE};

  if (PHASE === 'reopen') {
    // Reopening = the page is loaded again and the reader opens the existing
    // conversation from the list (or it is restored as the active one).
    const opener = await wait(() => assistants().length >= 20 || document.querySelector('.conversation-history-open[data-thread-id]'), 'stored conversation');
    if (opener instanceof HTMLElement && assistants().length < 20) {
      main.scrollTop = 0;
      opener.click();
    }
    await wait(() => assistants().length >= 20, 'hydrated conversation');
    await sleep(600);
    result.reopen = {...tail(), messages: assistants().length};
    prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    window.focus();
    prompt.focus();
    window.__keyboard(window.innerHeight - ${testCase.keyboard || 0});
    await sleep(600);
    result.reopenFocus = tail();
    out.textContent = JSON.stringify(result);
  } else {
    // 1. A long conversation (22 turns), answers with sources and actions.
    for (let i = 1; i <= 22; i += 1) await send(i % 7 === 0 ? '이번엔 길게 설명해줘 ' + i : '질문 ' + i);
    result.longConversation = {...tail(), messages: assistants().length};

    // 2. Tap the composer; the keyboard opens and the visible height shrinks.
    prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    window.focus();
    prompt.focus();
    window.__keyboard(window.innerHeight - ${testCase.keyboard || 0});
    await sleep(600);
    result.keyboardOpen = {...tail(), bodyKeyboardClass: document.body.classList.contains('mobile-keyboard-open')};

    // 3. iOS scrolls on its own to reveal the focused field. That is not the
    //    reader scrolling, and must not switch following off.
    main.scrollTop = Math.max(0, main.scrollTop - 240);
    main.dispatchEvent(new Event('scroll'));
    await sleep(60);
    await send('아이폰 17 Pro랑 Pro Max 비교해줘');
    result.comparisonWithKeyboard = tail();
    const table = lastAssistant().querySelector('.chat-message-table');
    const scrollBox = lastAssistant().querySelector('.chat-table-scroll');
    const bodyText = lastAssistant().querySelector('.chat-message-body').innerText;
    result.comparison = {
      tablePresent: Boolean(table),
      comparisonClass: Boolean(table?.classList.contains('is-comparison')),
      headers: table ? [...table.querySelectorAll('thead th')].map(n => n.textContent) : [],
      rows: table ? table.querySelectorAll('tbody tr').length : 0,
      emptyCells: table ? [...table.querySelectorAll('.chat-table-empty')].map(n => n.textContent) : [],
      rawPipeLines: bodyText.split('\\n').filter(line => line.trim().startsWith('|') || line.includes('|---')).length,
      recommendation: bodyText.includes('추천: 한 손 사용은 Pro'),
      tableFits: scrollBox ? scrollBox.scrollWidth <= scrollBox.clientWidth + 1 : false,
      tableWidth: scrollBox ? Math.round(scrollBox.getBoundingClientRect().width) : 0,
      messageWidth: Math.round(lastAssistant().getBoundingClientRect().width),
      dividerColumn3: table ? getComputedStyle(table.querySelector('tbody tr td:nth-child(3)')).borderLeftStyle : '',
    };

    // 4. Three or more options: the box may scroll sideways, the page never.
    await send('넓은 표로 비교해줘');
    const wideBox = lastAssistant().querySelector('.chat-table-scroll');
    result.wide = {
      wideClass: Boolean(wideBox?.classList.contains('is-wide')),
      focusable: wideBox?.tabIndex === 0,
      scrollsInside: wideBox ? wideBox.scrollWidth >= wideBox.clientWidth : false,
      overflow: overflow(),
      ...tail(),
    };

    // 5. Late growth (an image or card finishing its layout) is followed.
    const late = document.createElement('div'); late.style.height = '180px'; late.className = 'cq-late-growth';
    lastAssistant().appendChild(late);
    await sleep(400);
    result.lateGrowth = tail();

    // 6. Keyboard closes: no jump away from the newest message.
    window.__keyboard(window.innerHeight);
    prompt.blur();
    await sleep(600);
    result.keyboardClosed = tail();

    // 7. The reader scrolls up to read; later growth must not pull them down.
    await readerScroll(-900);
    const readingTop = main.scrollTop;
    const reading = readingAnchor();
    const grow = document.createElement('div'); grow.style.height = '160px';
    lastAssistant().appendChild(grow);
    await sleep(400);
    result.readerScrolledUp = {
      before: Math.round(readingTop), after: Math.round(main.scrollTop), distance: distance(),
      anchor: reading ? reading.kind : null,
      anchorShift: reading ? Math.round(reading.node.getBoundingClientRect().top) - reading.top : null,
    };

    // 8. An answer that arrives while the reader is scrolled up stays put,
    //    including LOTBI's own focus() after the answer.
    window.__answerDelay = 900;
    prompt.value = '천천히 오는 답변';
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    const count = assistants().length;
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
    await sleep(150);
    await readerScroll(-700);
    const waitingTop = main.scrollTop;
    const waiting = readingAnchor();
    await wait(() => assistants().length > count, 'slow answer');
    await sleep(500);
    result.answerWhileReading = {
      before: Math.round(waitingTop), after: Math.round(main.scrollTop), distance: distance(),
      anchor: waiting ? waiting.kind : null,
      anchorShift: waiting ? Math.round(waiting.node.getBoundingClientRect().top) - waiting.top : null,
    };
    window.__answerDelay = 0;

    // 9. Tapping the composer to reply brings the newest message back.
    prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    window.focus();
    prompt.focus();
    window.__keyboard(window.innerHeight - ${testCase.keyboard || 0});
    await sleep(600);
    result.composerTap = tail();
    window.__keyboard(window.innerHeight);
    prompt.blur();
    await sleep(300);

    result.overflow = overflow();
    out.textContent = JSON.stringify(result);
  }
} catch (e) { fail(e); }
</script><pre id="cq-result">pending</pre>`;
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

// Real-time rendering through the DevTools protocol. --dump-dom needs
// --virtual-time-budget, and under virtual time Chrome produces no frames
// while a page only waits: ResizeObserver and requestAnimationFrame never run,
// which is exactly what this test has to observe.
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

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url});
  const text = await waitFor(async () => {
    const result = await devtools.send('Runtime.evaluate', {
      expression: "document.getElementById('cq-result')?.textContent || 'pending'",
      returnByValue: true,
    }).catch(() => null);
    const value = result?.result?.value;
    return value && value !== 'pending' ? value : null;
  }, label, 150000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner-${testCase.label}.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(testCase), 'utf8');
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const devtools = await openDevtools(browser, profile);
  try {
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile,
    });
    await devtools.send('Emulation.setUserAgentOverride', {userAgent: testCase.mobile ? MOBILE_UA : DESKTOP_UA});
    if (testCase.mobile) await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await devtools.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    const built = await runPhase(devtools, `${origin}/${innerRel}?phase=build`, `${testCase.label}/build`);
    const reopened = await runPhase(devtools, `${origin}/${innerRel}?phase=reopen`, `${testCase.label}/reopen`);
    return {built, reopened};
  } finally {
    devtools.close();
  }
}

const AT_TAIL = 2;
const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.chat-answer-quality-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const {built, reopened} = await runCase(browser, origin, dir, testCase);
    console.log(`CHAT_ANSWER_QUALITY_P0 ${testCase.label}`, JSON.stringify({built, reopened}));
    const label = testCase.label;

    assert.equal(built.longConversation.messages, 22, `${label}: 22 answered turns`);
    assert.ok(built.longConversation.distance <= AT_TAIL, `${label}: long conversation tail ${built.longConversation.distance}px`);
    assert.ok(built.longConversation.actionsVisible, `${label}: newest action row visible after a long conversation`);
    assert.ok(built.longConversation.sourcesPresent, `${label}: sources rendered`);

    assert.ok(built.keyboardOpen.distance <= AT_TAIL, `${label}: keyboard open tail ${built.keyboardOpen.distance}px`);
    assert.ok(built.keyboardOpen.actionsVisible, `${label}: action row above the composer with the keyboard open`);
    if (testCase.mobile) assert.equal(built.keyboardOpen.bodyKeyboardClass, true, `${label}: keyboard emulation engaged`);

    assert.ok(built.comparisonWithKeyboard.distance <= AT_TAIL, `${label}: answer with keyboard open ${built.comparisonWithKeyboard.distance}px`);
    assert.ok(built.comparisonWithKeyboard.actionsVisible, `${label}: comparison answer actions visible above the composer`);

    const cmp = built.comparison;
    assert.ok(cmp.tablePresent && cmp.comparisonClass, `${label}: A vs B renders as a comparison table`);
    assert.deepEqual(cmp.headers, ['항목', 'iPhone 17 Pro', 'iPhone 17 Pro Max (아주 긴 제품명 줄바꿈 확인)'], `${label}: headers`);
    assert.equal(cmp.rows, 4, `${label}: rows`);
    assert.deepEqual(cmp.emptyCells, ['—'], `${label}: a missing value is shown as —`);
    assert.equal(cmp.rawPipeLines, 0, `${label}: no raw markdown table lines`);
    assert.ok(cmp.recommendation, `${label}: the recommendation line stays text`);
    assert.ok(cmp.tableFits, `${label}: A vs B fits without sideways scrolling`);
    assert.ok(cmp.tableWidth <= cmp.messageWidth, `${label}: table inside the message`);
    assert.equal(cmp.dividerColumn3, 'solid', `${label}: divider between the two options`);

    assert.ok(built.wide.wideClass && built.wide.focusable, `${label}: 3+ options use the scrollable table box`);
    assert.ok(built.wide.overflow.page <= 0 && built.wide.overflow.main <= 0, `${label}: no page-level sideways scroll ${JSON.stringify(built.wide.overflow)}`);

    assert.ok(built.lateGrowth.distance <= AT_TAIL, `${label}: late growth followed ${built.lateGrowth.distance}px`);
    assert.ok(built.keyboardClosed.distance <= AT_TAIL, `${label}: keyboard close keeps the tail ${built.keyboardClosed.distance}px`);

    assert.equal(built.readerScrolledUp.after, built.readerScrolledUp.before, `${label}: a reader scrolled up is not pulled down by growth`);
    // No visible item means the reader's view could not be measured at all -
    // a failure of its own, never a silent null.
    assert.ok(built.readerScrolledUp.anchor, `${label}: no conversation item was visible while reading, so whether the message being read moved could not be measured`);
    assert.equal(built.readerScrolledUp.anchorShift, 0, `${label}: the message being read stays where it was`);
    assert.ok(built.readerScrolledUp.distance > 200, `${label}: reader really is away from the bottom`);
    assert.ok(built.answerWhileReading.anchor, `${label}: no conversation item was visible while waiting for an answer, so whether the message being read moved could not be measured`);
    assert.ok(Math.abs(built.answerWhileReading.anchorShift) <= 2, `${label}: an answer arriving while reading does not move the message being read (${built.answerWhileReading.anchorShift}px)`);
    assert.ok(built.answerWhileReading.distance > 200, `${label}: an answer arriving while reading does not pull the reader to the bottom`);

    assert.ok(built.composerTap.distance <= AT_TAIL, `${label}: tapping the composer returns to the newest message ${built.composerTap.distance}px`);
    assert.ok(built.composerTap.actionsVisible, `${label}: newest action row visible after the composer tap`);
    assert.ok(built.overflow.page <= 0 && built.overflow.main <= 0, `${label}: no horizontal page scroll`);

    assert.ok(reopened.reopen.messages >= 20, `${label}: reopened conversation hydrated`);
    assert.ok(reopened.reopen.distance <= AT_TAIL, `${label}: reopened conversation lands on its newest message ${reopened.reopen.distance}px`);
    assert.ok(reopened.reopenFocus.distance <= AT_TAIL, `${label}: composer focus after reopening keeps the tail`);
    assert.ok(reopened.reopenFocus.actionsVisible, `${label}: reopened newest action row visible above the composer`);
  }
} finally {
  server.kill('SIGTERM');
  // Chrome may hold its profile for a moment after it is told to exit.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

console.log('SITE-CHAT-ANSWER-QUALITY-P0 OK — conversation tail follows answers, keyboard and reopen; comparison tables render without raw pipes or page overflow');
