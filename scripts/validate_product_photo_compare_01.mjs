// CONVERSATION-INTENT-PRODUCT-KNOWLEDGE-01 — product photo comparison cards.
//
// Source part: the CORE-PRODUCT-LOOKUP-01 card contract (only an official page
// image with its official page link is ever drawn) and its wiring into the
// guest and signed-in answers.
// Browser part: a real conversation turn through the DevTools protocol on
// 360x780, 375x812, 390x844, 412x915 and 1280x900, plus 390x844 dark. Core is
// mocked with the shape Core's product lookup returns; the product image hosts
// are answered by request interception (one image loads, one fails), so the
// load-failure fallback is exercised for real. Viewport emulation only — not
// an iPhone Safari / Android device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compactProductLookupMeta} from '../site-product-lookup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CLASSIC_PAGE = 'https://www.crocs.co.kr/p/classic-clog/10001.html';
const BAYA_PAGE = 'https://www.crocs.co.kr/p/baya-clog/10126.html';
const CLASSIC_IMAGE = 'https://media.crocs.example/images/classic.png';
const BAYA_IMAGE = 'https://media.crocs.example/images/baya-missing.png';
const SWITCH_PAGE = 'https://www.nintendo.co.kr/switch2/';

function photoLookup() {
  return {
    contract_id: 'CORE-PRODUCT-LOOKUP-01', kind: 'PRODUCT_IMAGE', subject: '크록스 클래식 · 크록스 바야',
    status: 'CONFIRMED_RESULTS', item_count: 2,
    products: [
      {name: '크록스 클래식', brand: '크록스', page_url: CLASSIC_PAGE, source_host: 'www.crocs.co.kr', page_title: '클래식 클로그', image_url: CLASSIC_IMAGE, image_status: 'OFFICIAL_PAGE_IMAGE'},
      {name: '크록스 바야', brand: '크록스', page_url: BAYA_PAGE, source_host: 'www.crocs.co.kr', page_title: '바야 클로그', image_url: BAYA_IMAGE, image_status: 'OFFICIAL_PAGE_IMAGE'},
    ],
  };
}

// ── Card contract ───────────────────────────────────────────────────────
{
  const meta = compactProductLookupMeta(photoLookup());
  assert.equal(meta.products.length, 2);
  assert.deepEqual(meta.products.map(card => card.image_url), [CLASSIC_IMAGE, BAYA_IMAGE]);
  assert.equal(meta.products[0].source_host, 'crocs.co.kr');
  assert.equal(compactProductLookupMeta({...photoLookup(), contract_id: 'OTHER'}), null);
  assert.equal(compactProductLookupMeta({...photoLookup(), kind: 'PRODUCT_SPEC'}), null, 'a spec answer draws no photo box');
  assert.equal(compactProductLookupMeta({...photoLookup(), products: []}), null);
  const risky = compactProductLookupMeta({...photoLookup(), products: [
    {name: 'http 이미지', page_url: CLASSIC_PAGE, image_url: 'http://media.crocs.example/a.png', image_status: 'OFFICIAL_PAGE_IMAGE'},
    {name: '확인 안 된 이미지', page_url: BAYA_PAGE, image_url: BAYA_IMAGE, image_status: 'MODEL_NOT_MATCHED'},
    {name: '출처 없는 이미지', image_url: CLASSIC_IMAGE, image_status: 'OFFICIAL_PAGE_IMAGE'},
    {name: '네 번째', page_url: CLASSIC_PAGE, image_url: CLASSIC_IMAGE, image_status: 'OFFICIAL_PAGE_IMAGE'},
  ]});
  assert.equal(risky.products.length, 3, 'at most three products');
  assert.ok(risky.products.every(card => !card.image_url), 'an image is drawn only when it is the official page image with its page');
  assert.equal(risky.products[1].image_status, 'MODEL_NOT_MATCHED');
  assert.equal(risky.products[2].page_url, '');
  const script = compactProductLookupMeta({...photoLookup(), products: [{name: '스크립트', page_url: 'javascript:alert(1)', image_url: CLASSIC_IMAGE, image_status: 'OFFICIAL_PAGE_IMAGE'}]});
  assert.equal(script.products[0].page_url, '');
  assert.equal(script.products[0].image_url, '');
}
const module = read('site-product-lookup.js');
assert.doesNotMatch(module, /innerHTML|insertAdjacentHTML/u, 'cards are built from DOM nodes only');
assert.match(module, /link\.rel = 'noopener noreferrer'/u);
assert.match(module, /image\.referrerPolicy = 'no-referrer'/u);
assert.match(read('site-product-lookup.css'), /aspect-ratio: 1 \/ 1/u, 'a fixed square media box keeps the thread still while an image loads');
const core = read('site-core.js');
assert.equal(
  (core.match(/productLookup: payload\.lookup_result && typeof payload\.lookup_result === 'object' && payload\.lookup_result\.contract_id === 'CORE-PRODUCT-LOOKUP-01'/gu) || []).length,
  2,
  'guest and signed-in answers both carry the product lookup',
);
const conversation = read('site-conversation.js');
assert.equal((conversation.match(/const productLookup = compactProductLookupMeta\(response\.productLookup\);/gu) || []).length, 2);
assert.match(conversation, /createProductImageComparison\(message\.meta\.productLookup, \{document\}\)/u);

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
  throw new Error('Chrome/Chromium is required for the product photo validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA},
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
  {label: 'mobile-390x844-dark', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, theme: 'dark'},
];

const PHOTO_TEXT = '크록스 클래식과 바야 사진으로 비교해줘';
const SINGLE_TEXT = '닌텐도 스위치 2 사진 보여줘';
const SPEC_TEXT = '레이ev 제원알려줘';

function buildInner(theme) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('pp-result');
try {
  localStorage.clear();
  ${theme ? `localStorage.setItem('lotbi.site.theme.bootstrap.v1', ${JSON.stringify(theme)});` : ''}
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.__sent = [];
  const PHOTO = ${photoLookup.toString()};
  const CLASSIC_PAGE = ${JSON.stringify(CLASSIC_PAGE)}, BAYA_PAGE = ${JSON.stringify(BAYA_PAGE)};
  const CLASSIC_IMAGE = ${JSON.stringify(CLASSIC_IMAGE)}, BAYA_IMAGE = ${JSON.stringify(BAYA_IMAGE)};
  const SWITCH_PAGE = ${JSON.stringify(SWITCH_PAGE)};
  const answer = text => {
    if (/클래식과 바야/u.test(text)) return {
      assistant_text: '| 항목 | 클래식 | 바야 |\\n|---|---|---|\\n| 디자인 | 기본 클로그 | 측면 로고 각인 |\\n| 통풍구 | 상단 | 상단·측면 |\\n추천: 기본형은 클래식, 로고 포인트는 바야\\n\\n사진은 각 제품 공식 페이지에 게시된 대표 이미지예요. 출처 링크를 함께 붙였어요.',
      lookup_result: PHOTO(),
      sources: [{type:'WEB',title:'클래식 클로그',url:CLASSIC_PAGE},{type:'WEB',title:'바야 클로그',url:BAYA_PAGE}],
    };
    if (/스위치/u.test(text)) return {
      assistant_text: '- 닌텐도 스위치 2 본체 모습이에요.\\n\\n닌텐도 스위치 2는 공식 페이지에서 이미지를 확인하지 못했어요. 아래 공식 페이지 링크에서 사진을 확인해 주세요.',
      lookup_result: {contract_id:'CORE-PRODUCT-LOOKUP-01',kind:'PRODUCT_IMAGE',subject:'닌텐도 스위치 2',status:'NO_RESULTS_FOUND',item_count:0,
        products:[{name:'닌텐도 스위치 2',brand:'닌텐도',page_url:SWITCH_PAGE,source_host:'www.nintendo.co.kr',image_status:'PAGE_UNAVAILABLE'}]},
      sources: [{type:'WEB',title:'닌텐도 스위치 2 공식 페이지',url:SWITCH_PAGE}],
    };
    return {
      assistant_text: '2025년형 기아 레이 EV(국내 판매 모델) 기준이에요.\\n- 1회 충전 주행거리: 205km',
      lookup_result: {contract_id:'CORE-PRODUCT-LOOKUP-01',kind:'PRODUCT_SPEC',subject:'기아 레이 EV',status:'CONFIRMED_RESULTS',item_count:1},
      sources: [{type:'WEB',title:'레이 EV 제원 | 기아',url:'https://www.kia.com/kr/vehicles/ray-ev/specification'}],
    };
  };
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      let body = {};
      try { body = JSON.parse(String(init?.body || '{}')); } catch {}
      globalThis.__sent.push(body);
      const reply = answer(String(body.text || ''));
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: reply.assistant_text,
        response_mode: 'AI_GROUNDED_CURRENT_FACT', correlation_id:'req_productphoto01',
        intent: {action:'UNKNOWN'},
        follow_up:{required:false,automatic_execution:false},
        routing:{route:'AI', ai_calls:1},
        freshness:{status:'GROUNDED',grounded:true,source_count:reply.sources.length},
        sources: reply.sources,
        lookup_result: reply.lookup_result,
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
          order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=productphoto01');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="pp-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const sections = [...document.querySelectorAll('.lotbi-product-compare')];
  const section = sections.at(-1) || null;
  const cards = [...(section?.querySelectorAll('.lotbi-product-compare-card') || [])].map(card => {
    const media = card.querySelector('.lotbi-product-compare-media');
    const image = card.querySelector('.lotbi-product-compare-image');
    const link = card.querySelector('.lotbi-product-compare-link');
    return {
      status: card.dataset.imageStatus || '',
      box: box(card), media: box(media),
      name: card.querySelector('.lotbi-product-compare-name')?.textContent || '',
      image: image ? {src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0, ready: image.classList.contains('is-ready'), alt: image.alt, referrer: image.referrerPolicy} : null,
      placeholder: card.querySelector('.lotbi-product-compare-placeholder')?.textContent || '',
      link: link ? {href: link.href, target: link.target, rel: link.rel, text: link.textContent, box: box(link), lines: (() => { const range = document.createRange(); range.selectNodeContents(link); return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; })()} : null,
      host: card.querySelector('.lotbi-product-compare-host')?.textContent || '',
      mediaBackground: media ? getComputedStyle(media).backgroundColor : '',
      cardBackground: getComputedStyle(card).backgroundColor,
      nameColor: card.querySelector('.lotbi-product-compare-name') ? getComputedStyle(card.querySelector('.lotbi-product-compare-name')).color : '',
      broken: card.querySelectorAll('img').length && !image?.complete ? 'loading' : '',
    };
  });
  const assistant = [...document.querySelectorAll('.chat-message-assistant')].at(-1);
  return {
    sections: sections.length,
    section: section ? {box: box(section), label: section.getAttribute('aria-label') || '', count: section.dataset.productCount, note: section.querySelector('.lotbi-product-compare-note')?.textContent || ''} : null,
    cards,
    lastAssistantHasPhotos: Boolean(assistant?.querySelector('.lotbi-product-compare')),
    lastAssistantTable: Boolean(assistant?.querySelector('table')),
    sources: [...(assistant?.querySelectorAll('.chat-message-source-link') || [])].map(a => a.href),
    viewport: {w: innerWidth, h: innerHeight},
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    stored: Object.keys(localStorage).some(key => String(localStorage.getItem(key) || '').includes('CORE-PRODUCT-LOOKUP-01')),
    pageBackground: getComputedStyle(document.body).backgroundColor, theme: document.body.dataset.siteTheme || '',
  };
})()`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
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

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => listeners.push(listener)};
}

function luminance(rgb) {
  const [r, g, b] = (rgb.match(/[\d.]+/gu) || []).slice(0, 3).map(Number).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const PNG_BASE64 = fs.readFileSync(path.join(ROOT, 'icon-192.png')).toString('base64');

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/${testCase.theme ? `inner-${testCase.theme}` : 'inner'}.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.PRODUCT_PHOTO_SCREENSHOT_DIR || '';
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    // The product image host: the Classic image loads, the Baya image is gone.
    const imageRequests = [];
    cdp.on(message => {
      if (message.method !== 'Fetch.requestPaused' || message.sessionId !== sessionId) return;
      const {requestId, request} = message.params;
      imageRequests.push(request.url);
      const params = request.url === CLASSIC_IMAGE
        ? {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'image/png'}], body: PNG_BASE64}
        : {requestId, responseCode: 404, responseHeaders: [{name: 'Content-Type', value: 'text/plain'}], body: Buffer.from('gone').toString('base64')};
      void page('Fetch.fulfillRequest', params).catch(() => {});
    });
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://media.crocs.example/*', requestStage: 'Request'}]});
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url: `${origin}/${innerRel}`});
    const ready = await waitFor(async () => {
      const text = await evaluate("document.getElementById('pp-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsedReady = JSON.parse(ready);
    if (!parsedReady.ok) throw new Error(`${testCase.label}: ${parsedReady.error}`);
    await evaluate("document.getElementById('pp-result').hidden = true, true");

    const probe = () => evaluate(PROBE);
    const tap = async ({cx: x, cy: y}) => {
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
        await sleep(40);
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(40);
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1});
      }
      await sleep(150);
    };
    const center = selector => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const send = async text => {
      const before = await evaluate('globalThis.__sent.length');
      await evaluate('window.scrollTo(0, 0), true');
      await sleep(80);
      await tap(await center('#lotbi-prompt'));
      await page('Input.insertText', {text});
      await sleep(80);
      await tap(await center('.send-button'));
      await waitFor(async () => (await evaluate('globalThis.__sent.length')) > before, `${testCase.label}: sent ${text}`);
      const sent = await evaluate('globalThis.__sent.at(-1)');
      assert.equal(sent.text, text, `${testCase.label}: Core receives the question unchanged`);
    };
    const reveal = async selector => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block: 'center'}), true`);
        await sleep(attempt ? 300 : 120);
        const point = await center(selector);
        if (point.cy > 0 && point.cy < testCase.height) return point;
      }
      return center(selector);
    };

    // 1. Photo comparison: two official images side by side, one fails to load.
    await send(PHOTO_TEXT);
    let state = await waitFor(async () => {
      const value = await probe();
      if (value.sections < 1 || value.cards.length !== 2) return null;
      const settled = value.cards[0].image?.ready && value.cards[1].status === 'IMAGE_LOAD_FAILED';
      return settled ? value : null;
    }, `${testCase.label}: photo cards settle`);
    await reveal('.lotbi-product-compare');
    state = await probe();
    assert.equal(state.lastAssistantHasPhotos, true, `${testCase.label}: the photos belong to the answer`);
    assert.equal(state.lastAssistantTable, true, `${testCase.label}: the comparison table is drawn too`);
    assert.equal(state.section.count, '2');
    assert.equal(state.section.label, '크록스 클래식 · 크록스 바야 공식 사진');
    assert.equal(state.section.note, '사진 출처: 각 제품 공식 페이지에 게시된 대표 이미지');
    const [classic, baya] = state.cards;
    assert.equal(classic.name, '크록스 클래식');
    assert.equal(classic.image.src, CLASSIC_IMAGE);
    assert.equal(classic.image.loaded, true);
    assert.equal(classic.image.alt, '크록스 클래식 공식 제품 이미지');
    assert.equal(classic.image.referrer, 'no-referrer');
    assert.equal(baya.image, null, `${testCase.label}: a failed image leaves no broken image behind`);
    assert.equal(baya.placeholder, '이미지를 불러오지 못했어요');
    for (const card of state.cards) {
      assert.ok(card.link, `${testCase.label}: ${card.name} keeps its official page link`);
      assert.equal(card.link.target, '_blank');
      assert.match(card.link.rel, /noopener/u);
      assert.equal(card.host, 'crocs.co.kr');
      assert.equal(card.link.lines, 1, `${testCase.label}: ${card.name} link on one line`);
      assert.ok(card.link.box.h >= 32, `${testCase.label}: link touch target ${card.link.box.h}`);
      assert.ok(Math.abs(card.media.w - card.media.h) <= 1, `${testCase.label}: square media box ${card.media.w}x${card.media.h}`);
      assert.ok(card.box.x >= 0 && card.box.right <= state.viewport.w + 0.5, `${testCase.label}: ${card.name} inside the viewport`);
      assert.equal(luminance(card.mediaBackground) > 0.9 || card.status === 'IMAGE_LOAD_FAILED', true, `${testCase.label}: photo box is white (${card.mediaBackground})`);
    }
    assert.equal(classic.link.text, '공식 페이지 열기');
    assert.equal(baya.link.text, '공식 페이지 열기');
    assert.equal(classic.link.href, CLASSIC_PAGE);
    assert.equal(baya.link.href, BAYA_PAGE);
    assert.ok(Math.abs(classic.box.y - baya.box.y) <= 1, `${testCase.label}: the two products sit side by side`);
    assert.ok(classic.box.w >= 120, `${testCase.label}: each card is wide enough to see (${classic.box.w})`);
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: no sideways scroll (${state.pageOverflowX})`);
    assert.deepEqual(state.sources, [CLASSIC_PAGE, BAYA_PAGE]);
    assert.equal(state.stored, true, `${testCase.label}: the photo answer is kept with the conversation`);
    assert.deepEqual([...new Set(imageRequests)].sort(), [BAYA_IMAGE, CLASSIC_IMAGE].sort());
    if (testCase.theme === 'dark') {
      assert.equal(state.theme, 'dark');
      const contrast = Math.abs(luminance(classic.nameColor) - luminance(classic.cardBackground));
      assert.ok(contrast > 0.4, `${testCase.label}: name readable on the dark card (${classic.nameColor} on ${classic.cardBackground})`);
    }
    await shot('01-photo-compare');

    // 2. One product, no official image: a plain box and the official link.
    await send(SINGLE_TEXT);
    state = await waitFor(async () => { const value = await probe(); return value.sections >= 2 && value.lastAssistantHasPhotos ? value : null; }, `${testCase.label}: single product card`);
    await reveal('.chat-message-assistant:last-of-type .lotbi-product-compare');
    state = await probe();
    assert.equal(state.section.count, '1');
    assert.equal(state.cards.length, 1);
    assert.equal(state.cards[0].image, null);
    assert.equal(state.cards[0].placeholder, '공식 이미지를 확인하지 못했어요');
    assert.equal(state.cards[0].link.text, '공식 페이지에서 사진 보기');
    assert.equal(state.cards[0].host, 'nintendo.co.kr');
    assert.equal(state.cards[0].link.href, SWITCH_PAGE);
    assert.equal(state.section.note, '공식 이미지를 확인하지 못해 사진 대신 공식 페이지 링크를 보여드려요');
    assert.ok(state.cards[0].box.w <= 221, `${testCase.label}: a single card stays compact (${state.cards[0].box.w})`);
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: no sideways scroll`);
    await shot('02-single-unavailable');

    // 3. A specification answer draws no photo box at all.
    const sectionsBefore = state.sections;
    await send(SPEC_TEXT);
    state = await waitFor(async () => {
      const value = await probe();
      return value.sources.includes('https://www.kia.com/kr/vehicles/ray-ev/specification') ? value : null;
    }, `${testCase.label}: spec answer`);
    assert.equal(state.lastAssistantHasPhotos, false);
    assert.equal(state.sections, sectionsBefore);
    await shot('03-spec-no-photo');
    return {cards: `${Math.round(classic.box.w)}x${Math.round(classic.box.h)}`, media: `${Math.round(classic.media.w)}x${Math.round(classic.media.h)}`};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.product-photo-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(''), 'utf8');
  fs.writeFileSync(path.join(dir, 'inner-dark.html'), buildInner('dark'), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`PRODUCT_PHOTO_COMPARE ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('PRODUCT-PHOTO-COMPARE-01 OK — official product photos side by side with their official page links, load-failure and no-image fallbacks, no photo box for spec answers (viewport emulation, not a device run)');
