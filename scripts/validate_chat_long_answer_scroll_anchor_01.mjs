// CHAT-LONG-ANSWER-SCROLL-ANCHOR-01 (2026-10-07) — where the reader reads from
// after sending a question, measured in a real browser against index.html.
//
// 실사용 피드백: 답변이 길어지면 화면이 답변의 마지막 문장까지 자동으로
// 내려가서, 방금 보낸 질문과 답변 시작을 보려면 위로 다시 올려야 했다.
//
// The contract this file holds:
//
//   USER QUESTION
//   ↓
//   ASSISTANT RESPONSE START
//
// stays on screen however long the answer gets. Every check is about where a
// conversation item sits on the screen (the question, the answer's first line,
// or whichever item the reader was looking at) — never about scrollTop alone,
// because content above can change size and the browser then moves scrollTop
// to keep the same item still.
//
// Core is a fake that answers by keyword, optionally after a delay. The site
// receives an answer whole; "streaming" growth (tokens, markdown blocks, a
// late card) is emulated by appending blocks to the newest answer, which is
// the same ResizeObserver path any growth takes. The software keyboard is
// emulated the way iOS presents it (visualViewport shrinks, the layout
// viewport does not). This is browser emulation, not an iPhone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');
for (const needle of [
  'const setTurnAnchor = node =>',
  'const scrollToTurnAnchor = () =>',
  'const syncTurnSpace = () =>',
  'const keepReadingPosition = () =>',
  "jumpLatest.textContent = '↓ 최신 답변';",
  "{anchorTurn: true}",
  'if (anchorTurn) setTurnAnchor(node);',
  'new ResizeObserver(keepReadingPosition).observe(thread);',
]) assert.ok(conversation.includes(needle), `scroll anchor contract missing: ${needle}`);
// The forbidden shapes: an unconditional pull to the end on append, a forced
// tail on the composer tap, and nearness to the bottom counting as following.
assert.ok(!/scrollIntoView\(\{[^}]*block:\s*'end'/.test(conversation), 'no scrollIntoView({block:"end"}) in the conversation');
assert.ok(!conversation.includes("prompt.addEventListener('pointerdown', () => {\n    if (!thread.hidden) scrollToConversationTail({force: true});"),
  'tapping the composer must not force the reader to the newest message');
assert.ok(!conversation.includes('(followThreadBottom || isThreadNearBottom())'),
  'being near the bottom must not count as following (an anchored short answer sits there)');
assert.ok(!conversation.includes('forceScroll'), 'sending must anchor the question, not force the tail');
assert.ok(/\.conversation-jump-latest\s*\{[^}]*position:\s*absolute/.test(css), 'the jump control floats above the composer');
assert.ok(/\.conversation-jump-latest\[hidden\]\s*\{[^}]*display:\s*none/.test(css), 'a hidden jump control takes no space');
assert.ok(/\.conversation-turn-space\s*\{[^}]*pointer-events:\s*none/.test(css), 'the turn space never takes taps');

// ── Answers ─────────────────────────────────────────────────────────────
const sentence = (n, topic) => `${n}번째 문단 — ${topic}을 설명하는 부분이에요. 답변이 길어질 때 방금 보낸 질문과 답변의 시작이 화면에 그대로 남아 있는지 확인하는 문장입니다.`;
function longAnswer(minChars, topic) {
  const blocks = [`**요약:** ${topic}의 첫 줄이에요. 이 줄이 질문 바로 아래에 보여야 합니다.`];
  for (let i = 1; blocks.join('\n\n').length < minChars; i += 1) {
    blocks.push(sentence(i, topic));
    if (i % 4 === 0) blocks.push(`- **${i}번 정리** 핵심 하나\n- ${i}번 정리 핵심 둘`);
  }
  blocks.push('**정리:** 끝까지 읽으셨다면 아래 ↓ 최신 답변 없이도 여기가 마지막이에요.');
  return blocks.join('\n\n');
}
const ANSWERS = {
  short: '네, 짧게 답할게요. 오늘은 맑아요.',
  long1000: longAnswer(1100, '천 자 답변'),
  long3000: longAnswer(3200, '삼천 자 답변'),
  list: [
    '준비물을 목록으로 정리했어요.',
    '',
    '1. 신분증',
    '2. **보험증** 사본',
    '3. 복용 중인 약 목록',
    '',
    '- 물',
    '- 간단한 간식',
    '- 보조 배터리',
    '',
    '필요하면 더 알려 드릴게요.',
  ].join('\n'),
  place: '근처에서 확인한 후보 3곳이에요. 아래 카드에서 전화나 지도를 바로 열 수 있어요.',
};
for (const [key, min] of [['long1000', 1000], ['long3000', 3000]]) {
  assert.ok(ANSWERS[key].length >= min, `${key} fixture must be at least ${min} characters (${ANSWERS[key].length})`);
}
const place = (n, name, lat, lng) => ({
  result_id: `place-${n}`, place_id: `naver:${n}`, name, category: '음식점>한식',
  road_address: `전북특별자치도 전주시 완산구 홍산중앙로 ${n}`, latitude: lat, longitude: lng,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone: null, phone_verified: false, image_url: null, photo_evidence: null,
  food_license_verification: {state: 'VERIFIED', source: 'MOIS_FOOD_LICENSE', administrative_status: '영업/정상', ai_calls: 0},
});
const PLACE_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_0c0a0d0e0f0102030499',
  provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query: '전주 맛집',
  results: [place(1, '첫째 식당', 35.8159, 127.1093), place(2, '둘째 식당', 35.8189, 127.1412), place(3, '셋째 식당', 35.8201, 127.1301)],
};

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
  throw new Error('Chrome/Chromium is required for the long answer scroll anchor validation.');
}

const CASES = [
  {label: 'phone-375x667', width: 375, height: 667, mobile: true, keyboard: 291},
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, keyboard: 336},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, keyboard: 0},
];
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

function buildInner(testCase) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', `<head>
  <base href="/">
  <script>
  // iOS-shaped software keyboard: the layout viewport keeps its height and only
  // visualViewport shrinks. Installed before home-shell.js reads it.
  (() => {
    const target = new EventTarget();
    const state = {height: window.innerHeight, width: window.innerWidth};
    Object.defineProperties(target, {
      height: {get: () => state.height},
      width: {get: () => state.width},
      offsetTop: {get: () => 0},
      offsetLeft: {get: () => 0},
      pageTop: {get: () => 0},
      scale: {get: () => 1},
    });
    Object.defineProperty(window, 'visualViewport', {configurable: true, get: () => target});
    window.__keyboard = height => { state.height = height; target.dispatchEvent(new Event('resize')); };
  })();
  </script>`);
  const harness = `<script type="module">
const out = document.getElementById('sa-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e),partial:window.__partial||null}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 170000);
const ANSWERS = ${JSON.stringify(ANSWERS)};
const PLACE_RESULT = ${JSON.stringify(PLACE_RESULT)};
const MOBILE = ${JSON.stringify(Boolean(testCase.mobile))};
const KEYBOARD = ${JSON.stringify(testCase.keyboard || 0)};
try {
  localStorage.clear();
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
      const key = text.includes('삼천자') ? 'long3000' : text.includes('천자') ? 'long1000' : text.includes('목록') ? 'list' : text.includes('장소') ? 'place' : 'short';
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: key === 'short' ? turn + '번째 답변이에요. 짧게 확인합니다.' : ANSWERS[key],
        response_mode: key === 'place' ? 'PLACE_PROVIDER_READONLY' : 'AI_GROUNDED_CURRENT_FACT',
        correlation_id:'req_sa_'+turn,
        intent: key === 'place' ? {action:'PLACE_SEARCH',domain:'PLACE'} : {action:'UNKNOWN'},
        follow_up:{required:false,action: key === 'place' ? 'PLACE_SEARCH' : 'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        ...(key === 'place' ? {place_result: PLACE_RESULT} : {sources:[{title:'출처 '+turn,url:'https://example.com/s'+turn}]}),
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=scroll-anchor-01');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frames = n => new Promise(r => { const step = k => (k <= 0 ? r() : requestAnimationFrame(() => step(k - 1))); step(n); });
  const wait = async (fn, label) => {
    for (let i = 0; i < 800; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const main = document.getElementById('main-content');
  const prompt = document.getElementById('lotbi-prompt');
  const composer = document.querySelector('.chat-composer-stack');
  const topbar = document.querySelector('.chat-topbar');
  const thread = document.getElementById('conversation-thread');
  const jump = () => document.querySelector('.conversation-jump-latest');
  const visibleHeight = () => window.visualViewport.height;
  const readingTop = () => Math.max(main.getBoundingClientRect().top, topbar.getBoundingClientRect().bottom);
  const readingBottom = () => Math.min(composer.getBoundingClientRect().top, visibleHeight());
  const distance = () => Math.round(main.scrollHeight - main.scrollTop - main.clientHeight);
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const lastAssistant = () => assistants().pop();
  const lastQuestion = () => [...thread.querySelectorAll('.chat-message-user')].pop();
  const jumpVisible = () => { const b = jump(); return Boolean(b) && !b.hidden && b.getBoundingClientRect().height > 0; };
  // Where the newest question and the start of its answer are on screen.
  const turnView = () => {
    const q = lastQuestion();
    const qr = q.getBoundingClientRect();
    const a = lastAssistant();
    const answerFollowsQuestion = Boolean(a) && Boolean(q.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
    const ar = answerFollowsQuestion ? a.getBoundingClientRect() : null;
    const top = readingTop();
    const bottom = readingBottom();
    return {
      questionOffset: Math.round(qr.top - top),
      questionOnScreen: qr.top >= top - 1 && qr.bottom <= bottom + 1,
      answerStartOffset: ar ? Math.round(ar.top - top) : null,
      // The answer's first line (about 24px) is inside the reading area.
      answerStartOnScreen: ar ? ar.top >= top - 1 && ar.top + 24 <= bottom + 1 : false,
      answerChars: answerFollowsQuestion ? (a.querySelector('.chat-message-body')?.textContent || '').length : 0,
      answerEndOnScreen: ar ? ar.bottom <= bottom + 1 : false,
      distance: distance(),
      jumpVisible: jumpVisible(),
    };
  };
  // The conversation item the reader is looking at: the one nearest the
  // middle of the reading area, chosen by geometry (a single hit-test point
  // lands in gaps differently per font and OS).
  const readingItem = () => {
    const top = readingTop();
    const bottom = readingBottom();
    const middle = (top + bottom) / 2;
    let best = null;
    for (const node of thread.querySelectorAll('.chat-message, time, .chat-message-body > *')) {
      const box = node.getBoundingClientRect();
      if (box.height <= 0 || box.bottom <= top || box.top >= bottom) continue;
      const away = middle < box.top ? box.top - middle : middle > box.bottom ? middle - box.bottom : 0;
      if (!best || away < best.away || (away === best.away && box.height < best.height)) best = {node, away, height: box.height};
    }
    if (!best) return null;
    const node = best.node;
    return {node, top: node.getBoundingClientRect().top, label: (node.className || node.tagName) + ':' + (node.textContent || '').slice(0, 24)};
  };
  const shiftOf = item => (item && item.node.isConnected ? Math.round(item.node.getBoundingClientRect().top - item.top) : null);
  const clickSend = text => {
    prompt.value = text;
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
  };
  const answered = async (before, label) => { await wait(() => assistants().length > before, 'answer ' + label); await sleep(450); };
  const send = async text => { const before = assistants().length; clickSend(text); await answered(before, text); };
  // A reader gesture: the wheel marks it as the reader's, then the scroller moves.
  const readerScroll = async delta => {
    main.dispatchEvent(new WheelEvent('wheel', {deltaY: delta, bubbles: true}));
    main.scrollTop = Math.max(0, main.scrollTop + delta);
    main.dispatchEvent(new Event('scroll'));
    await sleep(80);
  };
  const readerScrollToEnd = async () => {
    main.dispatchEvent(new WheelEvent('wheel', {deltaY: 400, bubbles: true}));
    main.scrollTop = main.scrollHeight;
    main.dispatchEvent(new Event('scroll'));
    await sleep(80);
  };
  // Emulated streaming: blocks keep arriving at the end of the newest answer.
  const streamInto = async (count, every = 70, onBlock = async () => {}) => {
    const body = lastAssistant().querySelector('.chat-message-body');
    for (let i = 1; i <= count; i += 1) {
      const block = document.createElement(i % 5 === 0 ? 'ul' : 'p');
      if (block.tagName === 'UL') { block.className = 'chat-message-list'; for (const t of ['스트리밍 목록 하나', '스트리밍 목록 둘']) { const li = document.createElement('li'); li.textContent = t; block.appendChild(li); } }
      else { block.className = 'chat-message-paragraph'; block.textContent = '스트리밍으로 이어 붙는 ' + i + '번째 블록이에요. 읽던 위치를 침범하면 안 됩니다.'; }
      body.appendChild(block);
      await sleep(every);
      await onBlock(i);
    }
    await frames(3);
  };
  const result = {ok: true};
  window.__partial = result;

  // 0. A conversation already longer than the screen: the question that
  //    matters is sent at the bottom of it, which is where the bug lived.
  for (let i = 1; i <= 6; i += 1) await send('이전 질문 ' + i);

  // 1. Short answer: right after sending (answer still on its way) the
  //    question is at the top; after the answer it has not moved and the
  //    whole short answer is on screen.
  window.__answerDelay = 700;
  let before = assistants().length;
  clickSend('짧은 답 부탁해');
  await sleep(160);
  const shortSent = turnView();
  await answered(before, 'short');
  result.short = {sent: shortSent, done: turnView()};

  // 2. 1,000+ characters of Markdown, 3. 3,000+ characters.
  for (const [key, text] of [['long1000', '천자 넘게 마크다운으로 설명해줘'], ['long3000', '삼천자 넘게 아주 길게 설명해줘']]) {
    before = assistants().length;
    clickSend(text);
    await sleep(160);
    const sent = turnView();
    await answered(before, key);
    const a = lastAssistant();
    result[key] = {
      sent, done: turnView(),
      strong: a.querySelectorAll('.chat-message-body strong').length,
      lists: a.querySelectorAll('.chat-message-body ul').length,
      paragraphs: a.querySelectorAll('.chat-message-body p').length,
    };
  }
  window.__answerDelay = 0;

  // 4. A list answer, 5. place cards (carousel).
  await send('준비물 목록으로 알려줘');
  result.list = {...turnView(), items: lastAssistant().querySelectorAll('.chat-message-body li').length};
  await send('근처 장소 찾아줘');
  await wait(() => lastAssistant().querySelector('.lotbi-place-orbit'), 'place carousel');
  await sleep(400);
  result.place = {...turnView(), carousel: Boolean(lastAssistant().querySelector('.lotbi-place-orbit'))};

  // 6. Streaming, reader scrolls up while it streams: following stops at once
  //    and nothing that arrives afterwards moves what they are reading.
  await send('천자 넘게 다시 설명해줘');
  const heldBeforeStream = turnView();
  let upItem = null;
  let upCheckpoints = [];
  await streamInto(18, 70, async i => {
    if (i === 3) { await readerScroll(-180); upItem = readingItem(); }
    else if (i > 3) upCheckpoints.push(shiftOf(upItem));
  });
  await sleep(300);
  result.streamUp = {
    heldBeforeStream,
    item: upItem ? upItem.label : null,
    worstShift: upCheckpoints.length ? Math.max(...upCheckpoints.map(v => (v === null ? 9999 : Math.abs(v)))) : null,
    finalShift: shiftOf(upItem),
    distance: distance(),
    jumpVisible: jumpVisible(),
  };

  // 7. Jump control: only it brings the reader to the newest message, and
  //    from there following works as the stream continues.
  const jumpButton = jump();
  jumpButton.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  await frames(3);
  await sleep(100);
  const afterJump = {distance: distance(), jumpVisible: jumpVisible()};
  const followDistances = [];
  await streamInto(6, 70, async () => { await frames(2); followDistances.push(distance()); });
  result.jump = {afterJump, followDistances, final: distance()};

  // 8. Streaming, reader scrolls down to the end while it streams: from then
  //    on the stream is followed.
  await send('천자 넘게 하나 더 설명해줘');
  const downDistances = [];
  await streamInto(14, 70, async i => {
    if (i === 3) await readerScrollToEnd();
    else if (i > 3) { await frames(2); downDistances.push(distance()); }
  });
  result.streamDown = {downDistances, final: distance(), jumpVisible: jumpVisible()};

  // 9. The moment the answer completes: a held question does not move (the
  //    thinking row going away, the answer arriving, LOTBI's own focus()),
  //    and a reader who scrolled up while waiting stays where they were.
  window.__answerDelay = 900;
  before = assistants().length;
  clickSend('삼천자 넘게 길게 한 번 더 설명해줘');
  await sleep(250);
  const heldWaiting = turnView();
  await answered(before, 'completion-held');
  const heldDone = turnView();
  result.completionHeld = {waiting: heldWaiting, done: heldDone};
  before = assistants().length;
  clickSend('짧은 답 하나 더');
  await sleep(200);
  await readerScroll(-260);
  const waitingItem = readingItem();
  await answered(before, 'completion-reading');
  result.completionReading = {item: waitingItem ? waitingItem.label : null, shift: shiftOf(waitingItem), distance: distance(), jumpVisible: jumpVisible()};
  window.__answerDelay = 0;

  // 10. The next question sets a new anchor, from wherever the reader was.
  await send('천자 넘게 마지막으로 설명해줘');
  result.nextQuestion = turnView();

  // 11. Keyboard open/close, with the question held at the top of a long
  //     answer, and with the reader somewhere in the middle of it.
  if (MOBILE) {
    const held = turnView();
    prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    window.focus();
    prompt.focus();
    window.__keyboard(window.innerHeight - KEYBOARD);
    await sleep(600);
    const open = {...turnView(), keyboardClass: document.body.classList.contains('mobile-keyboard-open')};
    window.__keyboard(window.innerHeight);
    prompt.blur();
    await sleep(600);
    const closed = turnView();
    await readerScroll(320);
    const middleItem = readingItem();
    prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    prompt.focus();
    window.__keyboard(window.innerHeight - KEYBOARD);
    await sleep(600);
    const middleOpenShift = shiftOf(middleItem);
    const middleOpenDistance = distance();
    window.__keyboard(window.innerHeight);
    prompt.blur();
    await sleep(600);
    result.keyboard = {held, open, closed, middleItem: middleItem ? middleItem.label : null, middleOpenShift, middleOpenDistance, middleClosedShift: shiftOf(middleItem)};
  }

  // 12. Something other than the reader scrolls the page while a question is
  //     held (the page's own scrollIntoView, find-in-page): the hold lets go
  //     there, and later growth does not pull the reader back to the question.
  await send('천자 넘게 한 번만 더 설명해줘');
  const heldBeforeForeign = turnView();
  lastAssistant().querySelectorAll('.chat-message-body > p')[6].scrollIntoView({block: 'center'});
  await sleep(150);
  const foreignItem = readingItem();
  await streamInto(5, 70);
  await sleep(250);
  result.foreignScroll = {heldBeforeForeign, item: foreignItem ? foreignItem.label : null, shift: shiftOf(foreignItem), question: turnView().questionOffset};

  result.overflow = {page: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main.scrollWidth - main.clientWidth};
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="sa-result">pending</pre>`;
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

// Real-time rendering through the DevTools protocol: under --virtual-time-budget
// Chrome produces no frames while a page waits, and ResizeObserver and
// requestAnimationFrame are exactly what this test has to observe.
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
    await devtools.send('Page.navigate', {url: `${origin}/${innerRel}`});
    const text = await waitFor(async () => {
      const result = await devtools.send('Runtime.evaluate', {
        expression: "document.getElementById('sa-result')?.textContent || 'pending'",
        returnByValue: true,
      }).catch(() => null);
      const value = result?.result?.value;
      return value && value !== 'pending' ? value : null;
    }, testCase.label, 200000);
    const parsed = JSON.parse(text);
    if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error} ${JSON.stringify(parsed.partial || {})}`);
    return parsed;
  } finally {
    devtools.close();
  }
}

// The question sits at the top of the reading area: under the sticky bar, a
// small gap above it, never hidden under the bar and never further down than
// a line or so.
const QUESTION_TOP_MIN = 0;
const QUESTION_TOP_MAX = 40;
const STILL = 2;
const AT_TAIL = 2;
const atTop = (view, label, step) => {
  assert.ok(view.questionOffset >= QUESTION_TOP_MIN && view.questionOffset <= QUESTION_TOP_MAX,
    `${label}: ${step} — the question is at the top of the screen (${view.questionOffset}px below the bar)`);
  assert.ok(view.questionOnScreen, `${label}: ${step} — the question is fully on screen`);
};
const answerStarts = (view, label, step) => {
  assert.ok(view.answerStartOnScreen, `${label}: ${step} — the answer's first line is on screen under the question (${view.answerStartOffset}px)`);
};

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.chat-scroll-anchor-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const r = await runCase(browser, origin, dir, testCase);
    console.log(`CHAT_LONG_ANSWER_SCROLL_ANCHOR_01 ${testCase.label}`, JSON.stringify(r));
    const label = testCase.label;

    // 1. Short answer.
    atTop(r.short.sent, label, 'short, right after sending');
    atTop(r.short.done, label, 'short, answered');
    assert.ok(Math.abs(r.short.done.questionOffset - r.short.sent.questionOffset) <= STILL, `${label}: the short answer arriving did not move the question`);
    answerStarts(r.short.done, label, 'short');
    assert.ok(r.short.done.answerEndOnScreen, `${label}: a short answer is on screen whole`);
    assert.equal(r.short.done.jumpVisible, false, `${label}: nothing below a short answer, so no jump control`);

    // 2./3. Long Markdown answers.
    for (const [key, min] of [['long1000', 1000], ['long3000', 3000]]) {
      const v = r[key];
      atTop(v.sent, label, `${key}, right after sending`);
      atTop(v.done, label, `${key}, answered`);
      assert.ok(Math.abs(v.done.questionOffset - v.sent.questionOffset) <= STILL, `${label}: ${key} arriving did not move the question (${v.sent.questionOffset} → ${v.done.questionOffset})`);
      answerStarts(v.done, label, key);
      assert.ok(v.done.answerChars >= min, `${label}: ${key} rendered ${v.done.answerChars} characters`);
      assert.ok(v.done.distance > 200, `${label}: ${key} did not carry the reader to its end (${v.done.distance}px left below)`);
      assert.equal(v.done.answerEndOnScreen, false, `${label}: ${key} is longer than the screen`);
      assert.ok(v.done.jumpVisible, `${label}: ${key} — ↓ 최신 답변 is offered`);
      assert.ok(v.strong >= 2 && v.lists >= 1 && v.paragraphs >= 3, `${label}: ${key} rendered as Markdown (${v.strong} strong, ${v.lists} lists, ${v.paragraphs} paragraphs)`);
    }

    // 4./5. List and place cards.
    atTop(r.list, label, 'list');
    answerStarts(r.list, label, 'list');
    assert.equal(r.list.items, 6, `${label}: list answer rendered its 6 items`);
    atTop(r.place, label, 'place cards');
    answerStarts(r.place, label, 'place cards');
    assert.ok(r.place.carousel, `${label}: place answer rendered its card carousel`);

    // 6. Streaming + reader scrolls up.
    atTop(r.streamUp.heldBeforeStream, label, 'before streaming');
    assert.ok(r.streamUp.item, `${label}: no conversation item was visible while reading, so whether it moved could not be measured`);
    assert.ok(r.streamUp.worstShift !== null && r.streamUp.worstShift <= STILL, `${label}: streaming after the reader scrolled up never moved what they were reading (worst ${r.streamUp.worstShift}px)`);
    assert.ok(r.streamUp.finalShift !== null && Math.abs(r.streamUp.finalShift) <= STILL, `${label}: still in place after the stream (${r.streamUp.finalShift}px)`);
    assert.ok(r.streamUp.distance > 200, `${label}: the reader was not pulled to the bottom`);
    assert.ok(r.streamUp.jumpVisible, `${label}: ↓ 최신 답변 is offered while reading above new content`);

    // 7. Jump control.
    assert.ok(r.jump.afterJump.distance <= AT_TAIL, `${label}: ↓ 최신 답변 brings the reader to the newest message (${r.jump.afterJump.distance}px)`);
    assert.equal(r.jump.afterJump.jumpVisible, false, `${label}: the jump control goes away at the bottom`);
    assert.ok(r.jump.followDistances.every(d => d <= AT_TAIL) && r.jump.final <= AT_TAIL, `${label}: after the jump the stream is followed ${JSON.stringify(r.jump.followDistances)}`);

    // 8. Streaming + reader scrolls down to the end.
    assert.ok(r.streamDown.downDistances.length > 0 && r.streamDown.downDistances.every(d => d <= AT_TAIL), `${label}: a reader who scrolled to the end follows the stream ${JSON.stringify(r.streamDown.downDistances)}`);
    assert.ok(r.streamDown.final <= AT_TAIL && !r.streamDown.jumpVisible, `${label}: still at the end when the stream finishes`);

    // 9. Completion.
    atTop(r.completionHeld.waiting, label, 'waiting for the answer');
    atTop(r.completionHeld.done, label, 'the moment the answer completed');
    assert.ok(Math.abs(r.completionHeld.done.questionOffset - r.completionHeld.waiting.questionOffset) <= STILL, `${label}: completion did not move the held question`);
    assert.ok(r.completionHeld.done.distance > 200, `${label}: completion did not jump to the bottom`);
    answerStarts(r.completionHeld.done, label, 'completion');
    assert.ok(r.completionReading.item, `${label}: no item visible while reading during the wait`);
    assert.ok(r.completionReading.shift !== null && Math.abs(r.completionReading.shift) <= STILL, `${label}: an answer completing while the reader looks elsewhere does not move them (${r.completionReading.shift}px)`);
    assert.ok(r.completionReading.jumpVisible, `${label}: the new answer below is offered by ↓ 최신 답변`);

    // 10. Next question.
    atTop(r.nextQuestion, label, 'next question');
    answerStarts(r.nextQuestion, label, 'next question');

    // 11. Keyboard.
    if (testCase.mobile) {
      const k = r.keyboard;
      assert.equal(k.open.keyboardClass, true, `${label}: keyboard emulation engaged`);
      atTop(k.held, label, 'before the keyboard');
      atTop(k.open, label, 'keyboard open (composer tapped)');
      assert.ok(k.open.distance > 100, `${label}: tapping the composer did not drag the reader to the end (${k.open.distance}px)`);
      atTop(k.closed, label, 'keyboard closed');
      assert.ok(k.middleItem, `${label}: no item visible in the middle of the answer`);
      assert.ok(k.middleOpenShift !== null && Math.abs(k.middleOpenShift) <= STILL, `${label}: the keyboard opening kept the line being read (${k.middleOpenShift}px)`);
      assert.ok(k.middleOpenDistance > 100, `${label}: the keyboard opening did not jump to the end`);
      assert.ok(k.middleClosedShift !== null && Math.abs(k.middleClosedShift) <= STILL, `${label}: the keyboard closing kept the line being read (${k.middleClosedShift}px)`);
    }
    // 12. A scroll the page itself made is respected.
    atTop(r.foreignScroll.heldBeforeForeign, label, 'before the page scrolled itself');
    assert.ok(r.foreignScroll.item, `${label}: no item visible after the page scrolled itself`);
    assert.ok(r.foreignScroll.shift !== null && Math.abs(r.foreignScroll.shift) <= STILL, `${label}: growth after the page's own scrollIntoView did not pull the reader back (${r.foreignScroll.shift}px)`);
    assert.ok(r.foreignScroll.question < QUESTION_TOP_MIN, `${label}: the reader stayed where the page took them, past the question`);

    assert.ok(r.overflow.page <= 0 && r.overflow.main <= 0, `${label}: no horizontal page scroll ${JSON.stringify(r.overflow)}`);
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

console.log('CHAT-LONG-ANSWER-SCROLL-ANCHOR-01 OK — the question and the start of its answer stay on screen through long answers, streaming, completion and the keyboard; only the reader or ↓ 최신 답변 moves them');
