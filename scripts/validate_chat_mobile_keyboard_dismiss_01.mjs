// CHAT-MOBILE-KEYBOARD-DISMISS-01 (2026-10-07) — sending on a phone switches
// from writing to reading: the composer lets go, the keyboard closes, and
// nothing LOTBI does afterwards (answer, error, timeout) brings it back. Only
// the reader's own tap on the composer reopens it. A desktop keeps its cursor.
//
// Real index.html and site-conversation.js in a real Chrome, driven through
// the DevTools protocol with real input: touch taps, typed text and the Enter
// key. Core is a fake. The software keyboard follows focus, as on a phone:
//   ios-visual      iPhone Safari / KakaoTalk in-app — the layout viewport keeps
//                   its height and only visualViewport shrinks; it opens and
//                   closes over several frames after focus changes, so the page
//                   sees the old height right after blur().
//   android-resize  Android Chrome / Samsung Internet in resize mode — the
//                   viewport itself is resized (innerHeight and the real
//                   visualViewport both change), a step at a time, from the
//                   test process after the page reports the focus change.
// This is browser emulation, not an iPhone, a Galaxy or KakaoTalk.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
for (const needle of [
  "const coarsePointerQuery = globalThis.matchMedia?.('(pointer: coarse)');",
  'const dismissComposerKeyboard = () => {',
  'const sendFromReader = startTurn => {',
  'if (activeTurnGeneration !== turnBefore) dismissComposerKeyboard();',
  'const returnComposerFocusAfterTurn = () => {',
  'await sendFromReader(() => requestAssistant(message, true));',
  'await sendFromReader(() => requestAssistant(retryText, !retryWithoutDuplicate, logicalRequestId, turnCreatedAt));',
]) assert.ok(conversation.includes(needle), `keyboard dismiss contract missing: ${needle}`);
const requestAssistantBody = conversation.slice(
  conversation.indexOf('const requestAssistant = async'),
  conversation.indexOf('const submitCurrentPrompt = async'),
);
assert.ok(requestAssistantBody.length > 1000, 'requestAssistant located');
// Every place a turn ends must go through the phone-aware helper or guard.
assert.ok(!/focusComposerInPlace\(\)/.test(requestAssistantBody), 'a finished turn must not call focusComposerInPlace directly');
assert.ok(!/[^)]\s*prompt\.focus\(\);/.test(requestAssistantBody.replace(/if \(!composerUsesSoftwareKeyboard\(\)\) prompt\.focus\(\);/g, '')),
  'a finished turn must not call prompt.focus() unguarded');
assert.equal((requestAssistantBody.match(/returnComposerFocusAfterTurn\(\)/g) || []).length, 4, 'local answer + three finally blocks');

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
  throw new Error('Chrome/Chromium is required for the mobile keyboard dismiss validation.');
}

const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KAKAOTALK_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0';
const SAMSUNG_INTERNET_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

const CASES = [
  {label: 'kakaotalk-ios-375x812', width: 375, height: 812, mobile: true, keyboard: 300, mode: 'ios-visual', userAgent: KAKAOTALK_IOS_UA},
  {label: 'iphone-safari-390x844', width: 390, height: 844, mobile: true, keyboard: 336, mode: 'ios-visual', userAgent: IPHONE_SAFARI_UA},
  {label: 'samsung-android-412x915', width: 412, height: 915, mobile: true, keyboard: 380, mode: 'android-resize', userAgent: SAMSUNG_INTERNET_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, keyboard: 0, mode: 'none', userAgent: DESKTOP_UA},
];

const paragraph = n => `${n}번째 문단이에요. 답변이 길어져서 화면 아래로 이어지는 경우를 확인합니다. 질문과 답변 시작 부분을 읽는 위치가 흔들리면 안 됩니다.`;
const LONG_1000 = Array.from({length: 16}, (_, i) => paragraph(i + 1)).join('\n\n');
const LONG_3000 = Array.from({length: 46}, (_, i) => paragraph(i + 1)).join('\n\n');
assert.ok(LONG_1000.length >= 1000 && LONG_1000.length < 2000, `1,000자 답변 ${LONG_1000.length}`);
assert.ok(LONG_3000.length >= 3000, `3,000자 답변 ${LONG_3000.length}`);
const LIST_ANSWER = [
  '준비물은 이렇게 정리할 수 있어요.',
  '',
  '- 신분증과 보험증',
  '- 복용 중인 약 목록',
  '- 최근 검사 결과지',
  '',
  '1. 접수 시간을 먼저 확인하세요.',
  '2. 주차 가능 여부를 확인하세요.',
  '',
  '**중요:** 휴일에는 운영 시간이 달라질 수 있어요.',
].join('\n');

const JEONJU = '전북특별자치도 전주시 완산구 전주객사3길 22-6';
const place = (index, name, extra = {}) => ({
  result_id: `place-${index}`, place_id: `naver:kbd-${index}`, name, category: '음식점>한식',
  road_address: JEONJU, latitude: 35.8183, longitude: 127.1433,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone: null, phone_verified: false, image_url: null, photo_evidence: null, ...extra,
});
const PLACE_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_6b6264300a0d0e0f0102',
  provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query: '전주 한식',
  results: [place(1, '객사 한식당', {phone: '063-000-0000', phone_verified: true}), place(2, '전주 밥집'), place(3, '완산 국밥')],
};
const PHARMACY_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_6b626461aaaaaaaaaaaa',
  provider_code: 'NMC', source: 'NMC_E_GEN', query: '현재 위치(전주시 완산구) 약국',
  results: [{
    result_id: 'place-1', place_id: 'nmc:C0000001', name: '밤늦게약국', category: '약국',
    address: '전북특별자치도 전주시 완산구 효자로 10 (효자동1가)', road_address: '전북특별자치도 전주시 완산구 효자로 10 (효자동1가)',
    latitude: 35.814, longitude: 127.119, coordinate_system: 'WGS84', coordinate_authority: 'NMC_OFFICIAL',
    navigation_capability: true, phone: '063-200-0001', phone_verified: true,
    phone_evidence: {source: 'NMC_E_GEN', verification_state: 'OFFICIAL_REGISTRY'},
    open_now: null, business_hours: null, distance_meters: 206,
    medical_status: {kind: 'PHARMACY', basis: 'NMC_REGISTERED_HOURS', target_label: '지금', open_state: 'OPEN', hours_label: '오늘 09:00~23:00'},
  }],
};

function buildInner(testCase) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  // The keyboard follows focus. It is installed before home-shell.js reads
  // window.visualViewport.
  const keyboard = testCase.mode === 'ios-visual' ? `
    const target = new EventTarget();
    // Without a keyboard the visible height is the window's own.
    const state = {height: null};
    const height = () => state.height ?? window.innerHeight;
    Object.defineProperties(target, {
      height: {get: height}, width: {get: () => window.innerWidth},
      offsetTop: {get: () => 0}, offsetLeft: {get: () => 0}, pageTop: {get: () => 0}, pageLeft: {get: () => 0}, scale: {get: () => 1},
    });
    Object.defineProperty(window, 'visualViewport', {configurable: true, get: () => target});
    let frame = 0;
    // iOS starts moving the keyboard a frame or two after focus changes and
    // reports the visible height step by step while it animates.
    const animateTo = goal => {
      cancelAnimationFrame(frame);
      kb.animating = true;
      const start = height();
      let step = 0;
      const tick = () => {
        step += 1;
        state.height = Math.round(start + (goal - start) * step / 6);
        target.dispatchEvent(new Event('resize'));
        if (step < 6) frame = requestAnimationFrame(tick);
        else { kb.animating = false; if (state.height === window.innerHeight) state.height = null; }
      };
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(tick); });
    };
    kb.request = open => animateTo(open ? window.innerHeight - ${testCase.keyboard} : window.innerHeight);
  ` : testCase.mode === 'android-resize' ? `
    // The test process resizes the viewport (window.__kdKeyboard is a DevTools binding).
    kb.request = open => { kb.animating = true; window.__kdKeyboard(open ? 'open' : 'close'); };
  ` : `kb.request = () => {};`;
  html = html.replace('<head>', `<head>
  <base href="/">
  <script>
  (() => {
    const kb = window.__kb = {open: false, animating: false, opens: 0, closes: 0, request: () => {}};
    ${keyboard}
    const isPrompt = node => node instanceof Element && node.id === 'lotbi-prompt';
    document.addEventListener('focusin', event => { if (isPrompt(event.target) && !kb.open) { kb.open = true; kb.opens += 1; kb.request(true); } });
    document.addEventListener('focusout', event => { if (isPrompt(event.target) && kb.open) { kb.open = false; kb.closes += 1; kb.request(false); } });
  })();
  </script>`);
  const harness = `<script type="module">
const out = document.getElementById('kd-status');
const LONG_1000 = ${JSON.stringify(LONG_1000)};
const LONG_3000 = ${JSON.stringify(LONG_3000)};
const LIST_ANSWER = ${JSON.stringify(LIST_ANSWER)};
const PLACE_RESULT = ${JSON.stringify(PLACE_RESULT)};
const PHARMACY_RESULT = ${JSON.stringify(PHARMACY_RESULT)};
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const safety = {execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false};
  let turn = 0;
  window.__answerDelay = 0;
  window.__requests = [];
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init.body);
      const text = body.text;
      const key = (init.headers && init.headers['Idempotency-Key']) || '';
      window.__requests.push(text);
      turn += 1;
      if (window.__answerDelay) await new Promise(resolve => setTimeout(resolve, window.__answerDelay));
      if (text.includes('오류')) return json({detail:{code:'UPSTREAM_TEMPORARY',message:'잠시 후 다시 시도해 주세요.',retryable:true}}, 503);
      const base = {
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',response_mode:'AI_GROUNDED_CURRENT_FACT',
        correlation_id:'req_kd_'+turn,intent:{action:'UNKNOWN'},
        follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},safety,retry_safe:true,
      };
      if (text.includes('3000자')) return json({...base, assistant_text: LONG_3000});
      if (text.includes('1000자')) return json({...base, assistant_text: LONG_1000});
      if (text.includes('목록')) return json({...base, assistant_text: LIST_ANSWER});
      if (text.includes('식당')) return json({...base, assistant_text:'전주 한식 검색 결과로 3곳을 찾았어요.', response_mode:'PLACE_PROVIDER_READONLY',
        intent:{action:'PLACE_SEARCH',domain:'PLACE'}, follow_up:{required:false,action:'PLACE_SEARCH',automatic_execution:false}, place_result: PLACE_RESULT});
      if (text.includes('약국')) return json({...base, assistant_text:'지금 운영 중으로 등록된 약국 1곳이에요.', response_mode:'MEDICAL_PROVIDER_READONLY',
        intent:{action:'MEDICAL_SEARCH'}, follow_up:{required:false,action:'MEDICAL_SEARCH',automatic_execution:false}, place_result: PHARMACY_RESULT});
      if (text.includes('계획')) {
        const created = new Date().toISOString();
        return json({...base, assistant_text:'토요일 오전 9시 등산 계획이네요. 캘린더에 넣어 둘까요?', calendar_candidate: {
          contract_id:'CORE-CALENDAR-CANDIDATE-01', schema_version:1, candidate_id:'calcand_0123456789abcdef01234567',
          action_id:'calact_0123456789abcdef01234567', candidate_version:1, source_turn_ref:key || 'guest-ai-kbddismiss01',
          source_turn_created_at:created, title:'등산',
          temporal:{kind:'LOCAL_DATE_TIME', local_datetime:'2026-10-10T09:00:00', timezone_name:'Asia/Seoul'},
          temporal_semantics:'USER_PLANNED_TIME', meaning:'PERSONAL_CALENDAR_ACTIVITY', missing_fields:[],
          approval_state:'NOT_APPROVED', execution_state:'NOT_EXECUTED', write_logical_request_id:'calendar-action:0123456789abcdef01234567',
        }});
      }
      return json({...base, assistant_text: turn + '번째 답변이에요. 짧게 확인합니다.'});
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  // Nothing may leave the page.
  document.addEventListener('click', event => { if (event.target?.closest?.('a')) event.preventDefault(); }, true);
  const conversation = await import('/site-conversation.js?v=kbd-dismiss-01');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));

  const main = document.getElementById('main-content');
  const prompt = document.getElementById('lotbi-prompt');
  const composer = document.querySelector('.chat-composer-stack');
  const topbar = document.querySelector('.chat-topbar');
  const thread = document.getElementById('conversation-thread');
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const users = () => [...document.querySelectorAll('.chat-message-user')];
  const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visibleHeight = () => Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight);
  const readingTop = () => Math.max(main.getBoundingClientRect().top, topbar ? topbar.getBoundingClientRect().bottom : 0);
  const readingBottom = () => Math.min(composer.getBoundingClientRect().top, visibleHeight());
  let readingItem = null;
  window.__kd = {
    snap() {
      const user = users().at(-1);
      const answer = assistants().at(-1);
      const userRect = user?.getBoundingClientRect();
      const answerRect = answer?.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      const top = readingTop(), bottom = readingBottom();
      const scroller = document.scrollingElement;
      return {
        focused: document.activeElement === prompt,
        active: document.activeElement ? document.activeElement.tagName + '.' + String(document.activeElement.className || '').split(' ')[0] : null,
        kbOpen: window.__kb.open, kbOpens: window.__kb.opens, kbCloses: window.__kb.closes,
        keyboardClass: document.body.classList.contains('mobile-keyboard-open'),
        coarse: matchMedia('(pointer: coarse)').matches,
        innerHeight: window.innerHeight, visibleHeight: visibleHeight(),
        readingHeight: Math.round(bottom - top),
        scrollTop: Math.round(main.scrollTop),
        distance: Math.round(main.scrollHeight - main.scrollTop - main.clientHeight),
        composerTop: Math.round(composerRect.top), composerBottom: Math.round(composerRect.bottom),
        composerInView: composerRect.top >= 0 && composerRect.bottom <= visibleHeight() + 1,
        composerGap: Math.round(visibleHeight() - composerRect.bottom),
        pageScroll: Math.round(scroller.scrollHeight - scroller.clientHeight), windowScrollY: Math.round(window.scrollY),
        overflowPage: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        overflowMain: main.scrollWidth - main.clientWidth,
        users: users().length, answers: assistants().length,
        loading: document.querySelectorAll('.chat-message-loading').length,
        errors: document.querySelectorAll('.chat-message-error').length,
        draft: prompt.value,
        answerLength: answer ? answer.querySelector('.chat-message-body')?.innerText.length || 0 : 0,
        questionVisible: Boolean(userRect) && userRect.top >= top - 1 && userRect.bottom <= bottom + 1,
        answerStartVisible: Boolean(answerRect) && answerRect.top >= top - 1 && answerRect.top <= bottom - 24,
        questionTop: userRect ? Math.round(userRect.top - top) : null,
      };
    },
    async settle() {
      for (let i = 0; i < 200 && window.__kb.animating; i += 1) await sleep(20);
      await frame(); await frame();
      await sleep(400);
      await frame();
    },
    async waitFor(kind, count) {
      for (let i = 0; i < 600; i += 1) {
        const loading = document.querySelectorAll('.chat-message-loading').length;
        const value = kind === 'answers' ? assistants().length : document.querySelectorAll('.chat-message-error').length;
        if (value >= count && !loading) return true;
        await sleep(25);
      }
      throw new Error('timeout waiting for ' + kind + ' ' + count);
    },
    // iPhone Safari: tapping a button does not take focus from the textarea.
    clickSendLikeIos() { document.querySelector('.send-button').click(); },
    clickRetryLikeIos() { const retry = [...document.querySelectorAll('.chat-retry-button')].at(-1); retry.click(); return Boolean(retry); },
    blurPromptLikeDoneKey() { prompt.blur(); },
    setDelay(ms) { window.__answerDelay = ms; },
    center(selector) {
      const node = [...document.querySelectorAll(selector)].at(-1);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {x: Math.round(rect.left + Math.min(rect.width / 2, 40)), y: Math.round(rect.top + rect.height / 2)};
    },
    // The reader's own scroll (the wheel marks it as theirs), like the P0 test.
    async readerScroll(delta) {
      main.dispatchEvent(new WheelEvent('wheel', {deltaY: delta, bubbles: true}));
      main.scrollTop = Math.max(0, main.scrollTop + delta);
      main.dispatchEvent(new Event('scroll'));
      await sleep(80);
    },
    // The conversation item nearest the middle of what the reader sees.
    markReadingItem() {
      const top = readingTop(), bottom = readingBottom(), middle = (top + bottom) / 2;
      let best = null;
      for (const node of thread.children) {
        if (!node.matches('.chat-message, .chat-assistant-row, time')) continue;
        const box = node.getBoundingClientRect();
        if (box.height <= 0 || box.bottom <= top || box.top >= bottom) continue;
        const away = middle < box.top ? box.top - middle : middle > box.bottom ? middle - box.bottom : 0;
        if (!best || away < best.away) best = {node, away};
      }
      readingItem = best ? {node: best.node, top: best.node.getBoundingClientRect().top} : null;
      return Boolean(readingItem);
    },
    readingItemState() {
      if (!readingItem) return null;
      const box = readingItem.node.getBoundingClientRect();
      return {shift: Math.round(box.top - readingItem.top), visible: box.bottom > readingTop() && box.top < readingBottom()};
    },
    rails() {
      return [...document.querySelectorAll('.lotbi-place-orbit')].map(rail => {
        const box = rail.getBoundingClientRect();
        return {left: Math.round(box.left), right: Math.round(box.right)};
      });
    },
    has(selector) { return document.querySelectorAll(selector).length; },
  };
  out.textContent = 'ready';
} catch (e) { out.textContent = 'error ' + String((e && e.stack) || e); }
</script><pre id="kd-status" hidden>pending</pre>`;
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,1000', 'about:blank',
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
  const listeners = new Set();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    } else if (message.method) for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => listeners.add(listener)};
}

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner-${testCase.label}.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(testCase), 'utf8');
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const devtools = await openDevtools(browser, profile);
  const {send} = devtools;
  const metrics = height => send('Emulation.setDeviceMetricsOverride', {
    width: testCase.width, height, deviceScaleFactor: 1, mobile: testCase.mobile,
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(`${testCase.label}: ${expression}: ${JSON.stringify(result.exceptionDetails).slice(0, 600)}`);
    return result.result.value;
  };
  // android-resize: the page asks, this process resizes the viewport in three
  // steps, then tells the page the keyboard has stopped moving.
  let keyboardWork = Promise.resolve();
  devtools.on(message => {
    if (message.method !== 'Runtime.bindingCalled' || message.params.name !== '__kdKeyboard') return;
    const open = message.params.payload === 'open';
    keyboardWork = keyboardWork.then(async () => {
      const goal = open ? testCase.height - testCase.keyboard : testCase.height;
      const steps = [1, 2, 3].map(i => Math.round((open ? testCase.height : testCase.height - testCase.keyboard) + (goal - (open ? testCase.height : testCase.height - testCase.keyboard)) * i / 3));
      for (const height of steps) { await sleep(30); await metrics(height); }
      await evaluate('window.__kb.animating = false');
    });
  });
  const settle = async () => { await sleep(60); await keyboardWork; await evaluate('window.__kd.settle()'); };
  const snap = () => evaluate('window.__kd.snap()');
  const point = async selector => {
    const center = await evaluate(`window.__kd.center(${JSON.stringify(selector)})`);
    assert.ok(center, `${testCase.label}: ${selector} on screen`);
    return center;
  };
  const tap = async selector => {
    const {x, y} = await point(selector);
    if (testCase.mobile) {
      await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
      await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      await send('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', clickCount: 1});
      await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', clickCount: 1});
    }
    await sleep(80);
  };
  const type = text => send('Input.insertText', {text});
  const enter = async () => {
    await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r'});
    await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13});
  };
  const answers = count => evaluate(`window.__kd.waitFor('answers', ${count})`);
  const errors = count => evaluate(`window.__kd.waitFor('errors', ${count})`);
  const openComposer = async () => { await tap('#lotbi-prompt'); await settle(); };
  const r = {};
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Runtime.addBinding', {name: '__kdKeyboard'});
    await metrics(testCase.height);
    await send('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    // Headless pages have no window focus; without this, focus and blur
    // events never fire and the keyboard could not follow focus.
    await send('Emulation.setFocusEmulationEnabled', {enabled: true});
    await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await send('Page.navigate', {url: `${origin}/${innerRel}`});
    const status = await waitFor(async () => {
      const value = await evaluate("document.getElementById('kd-status')?.textContent || 'pending'").catch(() => 'pending');
      return value !== 'pending' ? value : null;
    }, `${testCase.label} boot`, 60000);
    assert.equal(status, 'ready', `${testCase.label}: harness ${status}`);
    r.boot = await snap();

    let count = 0;
    let errorCount = 0;
    if (testCase.mobile) {
      // A + B: iPhone-style send button (focus stays in the textarea), and
      // the keyboard is closed by the send itself, before the answer.
      await evaluate('window.__kd.setDelay(900)');
      await openComposer();
      r.keyboardOpen = await snap();
      await type('짧게 답해줘');
      await evaluate('window.__kd.clickSendLikeIos()');
      await settle();
      r.sentWaiting = await snap();
      await answers(count += 1); await settle();
      r.afterButtonIos = await snap();
      await evaluate('window.__kd.setDelay(0)');

      // A: the keyboard's Enter key.
      await openComposer();
      await type('엔터로 보내기');
      await enter();
      await answers(count += 1); await settle();
      r.afterEnter = await snap();

      // A: Android-style tap on the send button (the button takes focus).
      await openComposer();
      await type('버튼 탭으로 보내기');
      await tap('.send-button');
      await answers(count += 1); await settle();
      r.afterButtonTap = await snap();

      // G: an empty or blank send, and the disabled button, change nothing.
      await openComposer();
      r.emptyBefore = await snap();
      await enter(); await sleep(300);
      await evaluate('window.__kd.clickSendLikeIos()'); await sleep(300);
      await type('   '); await enter(); await settle();
      r.emptyAfter = await snap();

      // C: a 1,000-character answer.
      await type('1000자로 길게 설명해줘');
      await enter();
      await answers(count += 1); await settle();
      r.long1000 = await snap();
      await sleep(1200);
      r.long1000Later = await snap();

      // D: a 3,000-character answer, then the reader reads from further up.
      await openComposer();
      await type('3000자로 아주 길게 설명해줘');
      await enter();
      await answers(count += 1); await settle();
      r.long3000 = await snap();
      await evaluate('window.__kd.readerScroll(-600)');
      assert.ok(await evaluate('window.__kd.markReadingItem()'), `${testCase.label}: a conversation item is visible while reading`);
      await sleep(1200);
      r.long3000Reading = {...await snap(), item: await evaluate('window.__kd.readingItemState()')};

      // E + F: while a slow answer is on its way the reader taps the composer
      // (the keyboard comes back), writes the next question, presses Enter
      // (nothing is sent while a turn runs), then closes the keyboard.
      await evaluate('window.__kd.setDelay(3500)');
      await openComposer();
      await type('천천히 답해줘');
      await enter(); await settle();
      r.slowSent = await snap();
      await openComposer();
      r.slowTap = await snap();
      await type('다음 질문 초안');
      await enter(); await sleep(300);
      r.slowEnterWhileRunning = await snap();
      assert.ok(await evaluate('window.__kd.markReadingItem()'), `${testCase.label}: a conversation item is visible while waiting`);
      await evaluate('window.__kd.blurPromptLikeDoneKey()'); await settle();
      r.slowKeyboardClosed = {...await snap(), item: await evaluate('window.__kd.readingItemState()')};
      await answers(count += 1); await settle();
      r.slowAnswered = await snap();

      // E: the answer arrives while the reader is writing - their keyboard stays.
      await evaluate("document.getElementById('lotbi-prompt').value = ''; document.getElementById('lotbi-prompt').dispatchEvent(new Event('input', {bubbles: true}))");
      await evaluate('window.__kd.setDelay(2000)');
      await openComposer();
      await type('작성 중 답변 도착');
      await enter(); await settle();
      await openComposer();
      await type('계속 쓰는 중');
      await answers(count += 1); await settle();
      r.answerWhileWriting = await snap();
      await evaluate("document.getElementById('lotbi-prompt').value = ''; document.getElementById('lotbi-prompt').dispatchEvent(new Event('input', {bubbles: true}))");
      await evaluate('window.__kd.setDelay(0)');

      // H: a failed send — no keyboard over the error, 다시 시도 still there,
      // and a tap on the composer still writes.
      await type('오류 나는 질문');
      await enter();
      await errors(errorCount += 1); await settle();
      r.error = {...await snap(), retry: await evaluate("[...document.querySelectorAll('.chat-retry-button')].filter(b => !b.disabled).length")};
      await openComposer();
      r.errorComposerTap = await snap();
      await evaluate('window.__kd.clickRetryLikeIos()');
      await errors(errorCount); await settle();
      r.errorRetry = await snap();

      // I, K, J, L: rich answers keep their layout once the keyboard is gone.
      for (const [key, text, selector] of [
        ['place', '전주 한식 식당 찾아줘', '.lotbi-place-orbit'],
        ['medical', '근처 약국 알려줘', '.lotbi-place-medical-line'],
        ['list', '목록으로 정리해줘', '.chat-message-list'],
        ['calendar', '토요일 등산 계획 있어', '.conversation-calendar-action'],
      ]) {
        await openComposer();
        await type(text);
        await enter();
        await answers(count += 1); await settle();
        r[key] = {...await snap(), present: await evaluate(`window.__kd.has(${JSON.stringify(selector)})`), rails: await evaluate('window.__kd.rails()')};
      }
    } else {
      // Desktop: the cursor stays for the next question, as before.
      await openComposer();
      await type('데스크톱 엔터');
      await enter();
      r.desktopEnterSent = await snap();
      await answers(count += 1); await settle();
      r.desktopEnter = await snap();
      await type('데스크톱 버튼');
      await tap('.send-button');
      await answers(count += 1); await settle();
      r.desktopButton = await snap();
      await openComposer();
      await type('1000자로 길게 설명해줘');
      await enter();
      await answers(count += 1); await settle();
      r.desktopLong = await snap();
      await type('오류 나는 질문');
      await enter();
      await errors(errorCount += 1); await settle();
      r.desktopError = await snap();
    }
    return r;
  } finally {
    devtools.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.chat-mobile-keyboard-dismiss-'));
const server = startServer();
const failures = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const r = await runCase(browser, origin, dir, testCase);
    console.log(`CHAT_MOBILE_KEYBOARD_DISMISS ${testCase.label}`, JSON.stringify(r));
    const label = testCase.label;
    const check = (condition, message) => { if (!condition) failures.push(`${label}: ${message}`); };
    // Layout after the keyboard is gone: composer at the bottom of the screen,
    // no second scroller behind the conversation, nothing sideways.
    const layout = (s, step) => {
      check(s.composerInView, `${step}: composer inside the screen (${s.composerTop}..${s.composerBottom} / ${s.visibleHeight})`);
      check(s.composerGap >= 0 && s.composerGap <= 48, `${step}: composer sits at the bottom (gap ${s.composerGap}px)`);
      check(s.pageScroll <= 1 && s.windowScrollY === 0, `${step}: the page itself does not scroll behind the conversation (${s.pageScroll}px, scrollY ${s.windowScrollY})`);
      check(s.overflowPage <= 0 && s.overflowMain <= 0, `${step}: no sideways scroll (${s.overflowPage}/${s.overflowMain})`);
    };
    const closed = (s, step) => {
      check(!s.focused, `${step}: composer let go (active ${s.active})`);
      check(!s.kbOpen && !s.keyboardClass, `${step}: keyboard closed (kb ${s.kbOpen}, class ${s.keyboardClass})`);
      check(s.visibleHeight === testCase.height, `${step}: full visible height back (${s.visibleHeight}/${testCase.height})`);
      layout(s, step);
    };
    if (testCase.mobile) {
      check(r.boot.coarse === true, 'touch emulation reports a coarse pointer');
      check(r.keyboardOpen.focused && r.keyboardOpen.kbOpen && r.keyboardOpen.keyboardClass, 'tapping the composer opens the keyboard');
      check(r.keyboardOpen.visibleHeight === testCase.height - testCase.keyboard, `keyboard emulation engaged (${r.keyboardOpen.visibleHeight})`);
      // A: closed by the send itself, while the answer is still on its way.
      check(r.sentWaiting.loading === 1 && r.sentWaiting.answers === 0, 'the answer is still on its way');
      closed(r.sentWaiting, 'A send button (iPhone), before the answer');
      closed(r.afterButtonIos, 'A send button (iPhone), after the answer');
      // B: more room to read, and the question with the start of its answer.
      check(r.afterButtonIos.readingHeight - r.keyboardOpen.readingHeight >= testCase.keyboard - 60,
        `B reading area grows by about the keyboard (${r.keyboardOpen.readingHeight} -> ${r.afterButtonIos.readingHeight})`);
      check(r.afterButtonIos.questionVisible && r.afterButtonIos.answerStartVisible, 'B question and the start of its answer on screen');
      closed(r.afterEnter, 'A Enter key');
      check(r.afterEnter.questionVisible && r.afterEnter.answerStartVisible, 'A Enter key: question and answer start on screen');
      check(r.afterEnter.draft === '', 'A Enter key: the composer is emptied, not given a newline');
      closed(r.afterButtonTap, 'A send button (Android tap)');
      // G: nothing was sent, nothing let go.
      check(r.emptyAfter.focused && r.emptyAfter.kbOpen && r.emptyAfter.keyboardClass, `G empty send keeps the keyboard (active ${r.emptyAfter.active})`);
      check(r.emptyAfter.users === r.emptyBefore.users && r.emptyAfter.kbCloses === r.emptyBefore.kbCloses, 'G empty send sends nothing and closes nothing');
      // C, D: no keyboard, no focus back, no jump when the answer completes.
      closed(r.long1000, 'C 1,000자');
      check(r.long1000.answerLength >= 1000, `C answer length ${r.long1000.answerLength}`);
      check(r.long1000Later.scrollTop === r.long1000.scrollTop && !r.long1000Later.kbOpen && !r.long1000Later.focused, 'C nothing moves after the answer completes');
      closed(r.long3000, 'D 3,000자');
      check(r.long3000.answerLength >= 3000, `D answer length ${r.long3000.answerLength}`);
      check(r.long3000Reading.item && r.long3000Reading.item.shift === 0 && r.long3000Reading.item.visible, `D the passage being read stays put (${JSON.stringify(r.long3000Reading.item)})`);
      check(!r.long3000Reading.kbOpen && !r.long3000Reading.focused, 'D keyboard stays closed while reading');
      // E: the reader's tap brings the keyboard back mid-answer; Enter while a
      // turn runs neither sends nor closes it, and the draft is kept.
      closed(r.slowSent, 'E slow answer sent');
      check(r.slowSent.loading === 1, 'E the answer is still on its way');
      check(r.slowTap.focused && r.slowTap.kbOpen && r.slowTap.keyboardClass, 'E tapping the composer reopens the keyboard');
      check(r.slowEnterWhileRunning.focused && r.slowEnterWhileRunning.kbOpen && r.slowEnterWhileRunning.draft === '다음 질문 초안', 'E Enter while a turn runs keeps the keyboard and the draft');
      check(r.slowEnterWhileRunning.users === r.slowTap.users, 'E Enter while a turn runs sends nothing');
      // F: closing it again moves nothing the reader was looking at out of view.
      closed(r.slowKeyboardClosed, 'F keyboard closed during the answer');
      check(r.slowKeyboardClosed.item && r.slowKeyboardClosed.item.visible, `F the message being read is still on screen (${JSON.stringify(r.slowKeyboardClosed.item)})`);
      check(!r.slowAnswered.focused && !r.slowAnswered.kbOpen, 'F the completed answer does not reopen the keyboard');
      check(r.slowAnswered.draft === '다음 질문 초안', 'F the draft survives the answer');
      check(r.answerWhileWriting.focused && r.answerWhileWriting.kbOpen && r.answerWhileWriting.draft.endsWith('계속 쓰는 중'), 'E an answer arriving while writing leaves the keyboard and draft alone');
      // H
      closed(r.error, 'H error');
      check(r.error.errors >= 1 && r.error.retry >= 1, 'H error shown with 다시 시도');
      check(r.errorComposerTap.focused && r.errorComposerTap.kbOpen, 'H the composer can be tapped to write again');
      closed(r.errorRetry, 'H 다시 시도 is a send');
      // I, K, J, L
      for (const key of ['place', 'medical', 'list', 'calendar']) {
        closed(r[key], `${key}`);
        check(r[key].present > 0, `${key}: rendered`);
        for (const rail of r[key].rails) check(rail.left >= 0 && rail.right <= testCase.width, `${key}: card rail inside the screen ${JSON.stringify(rail)}`);
      }
      check(r.calendar.kbOpens === r.calendar.kbCloses, `every keyboard opening was the reader's and was closed (${r.calendar.kbOpens}/${r.calendar.kbCloses})`);
    } else {
      check(r.boot.coarse === false, 'desktop pointer is fine');
      check(r.desktopEnterSent.focused, 'desktop Enter keeps the cursor while sending');
      check(r.desktopEnter.focused && !r.desktopEnter.keyboardClass, 'desktop Enter: cursor still in the composer after the answer');
      check(r.desktopButton.focused, 'desktop send button: cursor back in the composer after the answer');
      check(r.desktopLong.focused, 'desktop long answer: cursor back in the composer');
      check(r.desktopError.focused, 'desktop error: cursor back in the composer');
      for (const step of ['desktopEnter', 'desktopButton', 'desktopLong', 'desktopError']) {
        check(r[step].overflowPage <= 0 && r[step].overflowMain <= 0, `${step}: no sideways scroll`);
        check(r[step].composerInView, `${step}: composer on screen`);
      }
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}
assert.deepEqual(failures, [], `keyboard dismiss failures:\n${failures.join('\n')}`);
console.log('CHAT-MOBILE-KEYBOARD-DISMISS-01 OK — a phone send closes the keyboard once accepted, nothing reopens it but the reader, and desktop keeps its cursor');
