// PLACE-CARD-CAROUSEL-SCROLL-DRIFT-01 — the place card orbit never scrolls.
//
// The orbit positions its cards with transforms inside an overflow-clipped
// rail. It also carries .lotbi-rich-card-rail, whose product-rail rules set
// `scroll-snap-type: inline mandatory`; a hidden-overflow box is still a
// scroll container, so after every rotation the browser re-snapped the rail
// to a card edge (153-161px on phones) and the center card slid off to the
// side. This test rotates the orbit every way a person can — prev/next taps
// (swipes on phones, which have no arrows), side-card taps, arrow/Home/End
// keys, 다른 장소 보기 — plus scrollIntoView and a
// programmatic scroll, and checks after each step that the rail is still at
// scrollLeft 0 and the center card sits exactly where it started.
//
// Real input through the DevTools protocol (touch on phone sizes, mouse on
// desktop). Viewport emulation only — not an iPhone Safari / Android device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── CSS contract ────────────────────────────────────────────────────────
const css = read('site-conversation.css');
const orbitRule = css.match(/\/\* LOTBI PLACE CARD TRUE ORBIT \+ PLACE PHOTO[^*]*\*\/\s*\.lotbi-place-orbit \{([^}]*)\}/u);
assert.ok(orbitRule, 'base .lotbi-place-orbit rule');
assert.match(orbitRule[1], /scroll-snap-type: none;/u, 'the orbit opts out of the product rail scroll snap');
assert.match(orbitRule[1], /overflow: hidden;\s*overflow: clip;/u, 'clip with hidden as the fallback');
assert.ok(css.indexOf('scroll-snap-type: inline mandatory') < css.indexOf(orbitRule[0]), 'the orbit override comes after the product rail rule');

// ── Browser ─────────────────────────────────────────────────────────────
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
  throw new Error('Chrome/Chromium is required for the place card carousel validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'Android-360x800', width: 360, height: 800, mobile: true, userAgent: ANDROID_UA},
  {label: 'iPhone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'Android-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

const JEONJU = '전북특별자치도 전주시 완산구 전주객사3길 22-6';
const place = (index, name, extra = {}) => ({
  result_id: `place-${index}`, place_id: `naver:drift-${index}`, name, category: '음식점>양식',
  road_address: JEONJU, latitude: 35.8183, longitude: 127.1433,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone: null, phone_verified: false, image_url: null, photo_evidence: null, ...extra,
});
// Five results so the back slots exist too: the widest scrollable overflow.
const PLACE_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_d71f0a0d0e0f01020304',
  provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query: '전주 죠죠',
  results: [
    place(1, '죠죠 전주객사점', {phone: '063-000-0000', phone_verified: true}),
    place(2, '죠죠'),
    place(3, '카페 죠죠'),
    place(4, '죠죠 브런치'),
    place(5, '죠죠 파스타'),
  ],
};

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PLACE_RESULT = ${JSON.stringify(PLACE_RESULT)};
const out = document.getElementById('drift-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') return json({
      contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
      assistant_text:'전주에서 죠죠 검색 결과로 5곳을 찾았어요.',
      response_mode:'PLACE_PROVIDER_READONLY',correlation_id:'req_placecarouseldrift01',
      intent:{action:'PLACE_SEARCH',domain:'PLACE'},
      follow_up:{required:false,action:'PLACE_SEARCH',automatic_execution:false},
      safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
        order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
      place_result:PLACE_RESULT,retry_safe:true,
    });
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  // Nothing in this test may leave the page: record and stop every link.
  globalThis.__anchorClicks = [];
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a');
    if (!anchor) return;
    globalThis.__anchorClicks.push(anchor.href);
    event.preventDefault();
  }, true);
  globalThis.__railScrolls = [];
  const conversation = await import('/site-conversation.js?v=placecarouseldrift01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<500;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const field=document.getElementById('lotbi-prompt');
  field.value='전주 죠죠 알려줘';
  field.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  const rail=await wait(()=>document.querySelector('.lotbi-place-orbit'),'rail');
  await wait(()=>rail.querySelector('[data-orbit-slot="CENTER"]'),'center');
  rail.addEventListener('scroll', () => globalThis.__railScrolls.push(rail.scrollLeft));
  await new Promise(r=>setTimeout(r,300));
  rail.scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r,150));
  out.textContent=JSON.stringify({ok:true});
} catch(e) { fail(e); }
</script><pre id="drift-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const rail = document.querySelector('.lotbi-place-orbit');
  const center = rail.querySelector('[data-orbit-slot="CENTER"]');
  const box = node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const railBox = box(rail);
  const centerBox = box(center);
  const right = rail.querySelector('[data-orbit-slot="RIGHT_FRONT"]');
  const rightBox = right ? box(right) : null;
  const visibleRight = rightBox ? Math.min(rightBox.x + rightBox.w, railBox.x + railBox.w) : 0;
  return {
    activeIndex: Number(center.dataset.orbitIndex),
    scrollLeft: rail.scrollLeft,
    scrolls: globalThis.__railScrolls.splice(0),
    centerOffset: Math.round((centerBox.cx - railBox.cx) * 10) / 10,
    rail: railBox, card: centerBox,
    title: box(center.querySelector('.lotbi-rich-card-title')),
    prev: box(rail.querySelector('.lotbi-place-orbit-control-prev')),
    next: box(rail.querySelector('.lotbi-place-orbit-control-next')),
    more: box(rail.querySelector('.lotbi-place-orbit-more')),
    cardCount: Number(rail.dataset.cardCount),
    sideStrip: rightBox ? {cx: (centerBox.x + centerBox.w + visibleRight) / 2, cy: centerBox.cy, width: visibleRight - (centerBox.x + centerBox.w)} : null,
    snap: getComputedStyle(rail).scrollSnapType,
    overflowX: getComputedStyle(rail).overflowX,
    anchors: globalThis.__anchorClicks.splice(0),
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
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
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const page = await openDevtools(browser, profile);
  const log = [];
  try {
    const evaluate = async expression => {
      const result = await page.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page.send('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page.send('Page.navigate', {url: `${origin}/${innerRel}`});
    const ready = await waitFor(async () => {
      const text = await evaluate("document.getElementById('drift-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsedReady = JSON.parse(ready);
    if (!parsedReady.ok) throw new Error(`${testCase.label}: ${parsedReady.error}`);

    const tap = async (x, y) => {
      if (testCase.mobile) {
        await page.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
        await sleep(40);
        await page.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
        await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(40);
        await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    const swipe = async (fromX, toX, y) => {
      const steps = 8;
      if (testCase.mobile) {
        await page.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: fromX, y}]});
        for (let i = 1; i <= steps; i += 1) {
          await page.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: fromX + (toX - fromX) * i / steps, y}]});
          await sleep(16);
        }
        await page.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX, y});
        await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: fromX, y, button: 'left', buttons: 1, clickCount: 1});
        for (let i = 1; i <= steps; i += 1) {
          await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: fromX + (toX - fromX) * i / steps, y, button: 'left', buttons: 1});
          await sleep(16);
        }
        await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: toX, y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    const key = async name => {
      const codes = {ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35};
      await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name]});
      await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name]});
    };

    const initial = await evaluate(PROBE);
    assert.equal(initial.snap, 'none', `${testCase.label}: computed scroll-snap-type`);
    assert.equal(initial.overflowX, 'clip', `${testCase.label}: computed overflow`);
    assert.equal(initial.scrollLeft, 0);
    assert.ok(initial.pageOverflow <= 0, `${testCase.label}: no horizontal page scroll`);
    const restingOffset = initial.centerOffset;
    // Three cards first; the other two wait behind 다른 장소 보기 (PLACE-MEDICAL-CARD-UX-FINAL-01).
    let count = initial.cardCount;
    assert.equal(count, 3, `${testCase.label}: three cards first`);
    let expected = 0;
    // Phones have no ‹ › any more: a swipe on the card turns it there.
    if (testCase.mobile) assert.ok(initial.prev.w === 0 && initial.next.w === 0, `${testCase.label}: no arrows on a phone`);
    const goNext = b => (testCase.mobile ? swipe(b.title.cx + 60, b.title.cx - 60, b.title.cy) : tap(b.next.cx, b.next.cy));
    const goPrev = b => (testCase.mobile ? swipe(b.title.cx - 60, b.title.cx + 60, b.title.cy) : tap(b.prev.cx, b.prev.cy));

    const step = async (name, action, nextExpected) => {
      const before = await evaluate(PROBE);
      await action(before);
      await sleep(350);
      const after = await evaluate(PROBE);
      log.push(`${name}:${before.activeIndex}->${after.activeIndex}@${after.scrollLeft}`);
      const where = `${testCase.label}: ${name} (${log.join(' ')})`;
      assert.equal(after.scrollLeft, 0, `${where}: rail scrolled to ${after.scrollLeft}`);
      assert.deepEqual(after.scrolls.filter(value => value !== 0), [], `${where}: rail scrolled during the step ${JSON.stringify(after.scrolls)}`);
      assert.ok(Math.abs(after.centerOffset - restingOffset) <= 1, `${where}: center card moved ${restingOffset} -> ${after.centerOffset}`);
      assert.deepEqual(after.anchors, [], `${where}: no link was activated`);
      assert.ok(after.pageOverflow <= 0, `${where}: horizontal page scroll`);
      if (nextExpected !== undefined) {
        expected = ((nextExpected % count) + count) % count;
        assert.equal(after.activeIndex, expected, `${where}: center card`);
      }
      return after;
    };

    for (let i = 1; i <= count; i += 1) await step(`next#${i}`, goNext, expected + 1);
    for (let i = 1; i <= 2; i += 1) await step(`prev#${i}`, goPrev, expected - 1);
    await step('swipe-left', b => swipe(b.title.cx + 60, b.title.cx - 60, b.title.cy), expected + 1);
    await step('swipe-right', b => swipe(b.title.cx - 60, b.title.cx + 60, b.title.cy), expected - 1);
    const probe = await evaluate(PROBE);
    if (probe.sideStrip && probe.sideStrip.width >= 16) {
      await step('tap-side-card', b => tap(b.sideStrip.cx, b.sideStrip.cy), expected + 1);
    } else {
      log.push('tap-side-card:skipped(no visible side strip)');
    }
    await evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"CENTER\"]').focus({preventScroll: true}), true");
    await step('ArrowRight', () => key('ArrowRight'), expected + 1);
    await step('ArrowRight', () => key('ArrowRight'), expected + 1);
    await step('ArrowLeft', () => key('ArrowLeft'), expected - 1);
    await step('End', () => key('End'), count - 1);
    await step('Home', () => key('Home'), 0);
    // A browser (find-in-page, focus, scrollIntoView) can no longer scroll the clipped rail.
    await step('scrollIntoView-side-title', () => evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot^=\"RIGHT\"] .lotbi-rich-card-title').scrollIntoView({inline: 'center', block: 'nearest'}), true"), 0);
    await step('programmatic-scrollLeft', () => evaluate("document.querySelector('.lotbi-place-orbit').scrollLeft = 160, true"), 0);
    // 다른 장소 보기 brings the other two in; the rail still never scrolls.
    count = PLACE_RESULT.results.length;
    await step('more', b => tap(b.more.cx, b.more.cy), 3);
    await step('next(after more)', goNext, expected + 1);
    await step('scrollIntoView-back-title', () => evaluate("document.querySelector('.lotbi-place-orbit [data-orbit-slot=\"RIGHT_BACK\"] .lotbi-rich-card-title').scrollIntoView({inline: 'center', block: 'nearest'}), true"), expected);
    return log;
  } finally {
    page.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.place-carousel-drift-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const log = await runCase(browser, origin, dir, testCase);
    console.log(`PLACE_CARD_CAROUSEL_NO_DRIFT ${testCase.label}`, log.join(' '));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('PLACE-CARD-CAROUSEL-SCROLL-DRIFT-01 OK — the place card orbit never scrolls; the center card stays centered through taps, swipes, keys and scrollIntoView');
