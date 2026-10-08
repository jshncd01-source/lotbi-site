// LIFE INFO CLEANUP — FINAL (2026-10-08). The six product decisions, measured
// together in a real browser (DevTools protocol, real time) against the real
// index.html / subscribe.html with a fake Core, at 360/375/390/412 (mobile
// emulation) and 1280 (desktop):
//   1 the 공과금 menu is not shown in 생활정보
//   2 the 생활정보 top question bar is not shown
//   3 the 생활정보 bottom row ("저장한 정보 다시 보기" + note) is not shown
//   4 there is no way into 롯비함: no entry button, and /#lotbi-box (direct or
//     after a reload) stays on the conversation
//   5 product cards carry no "+ 롯비함" save button
//   6 the plans page does not advertise 공과금
// Saved 롯비함 data in the browser is left untouched (nothing is deleted).
// This is a browser emulation, not an iPhone or Android device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');

// ── Static contract ─────────────────────────────────────────────────────
assert.match(read('site-feature-flags.js'), /export const LOTBI_BOX_UI_ENABLED = false;/u, 'one flag hides 롯비함');
assert.ok(!/공과금|고지서/u.test(read('subscribe.html')), 'subscribe.html does not advertise 공과금');
assert.ok(!/공과금|고지서/u.test(read('site-consumer-sections.js')), '생활정보 has no 공과금 menu or copy');

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
  throw new Error('Chrome/Chromium is required for the life info cleanup validation.');
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '360', width: 360, height: 800, mobile: true},
  {label: '375', width: 375, height: 667, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: '1280', width: 1280, height: 900, mobile: false},
];
const SAVED_KEY = 'lotbi.site.ux.v1:cleanup-check:lotbi-box';
const SAVED_VALUE = JSON.stringify({items: [{key: 'RAD_GODOMALL:1', title: 'RAD RA', savedAt: '2026-10-07T09:00:00Z'}]});
const PRODUCTS = {
  contract_id: 'CORE-PUBLIC-RICH-PRODUCT-DISCOVERY-01', schema_version: 1, display_id: 'pdc_' + 'b'.repeat(24),
  status: 'DISPLAY_READY', query: 'RAD RA', merchant: {code: 'RAD_GODOMALL', name: 'RAD 전주본점 / Godomall'},
  source_mode: 'GODOMALL_STOREFRONT', candidate_count: 2,
  cards: [0, 1].map(index => ({
    candidate_index: index, merchant_code: 'RAD_GODOMALL', source: 'GODOMALL_STOREFRONT',
    title: index ? 'RAD RA 리필' : 'RAD RA', price: 1650000 - index * 1000, currency: 'KRW', available: true,
    product_url: `https://www.carcarerad.com/goods/goods_view.php?goodsNo=100000009${index}`, image_url: '',
  })),
  display_evidence: true, purchase_requires_login: true, selection_available: false, external_side_effect: false,
  execution_authority: false, transaction_created: false, order_created: false, payment_attempted: false, live_money: false,
};

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PRODUCTS = ${JSON.stringify(PRODUCTS)};
const SAVED_KEY = ${JSON.stringify(SAVED_KEY)};
const SAVED_VALUE = ${JSON.stringify(SAVED_VALUE)};
const out = document.getElementById('lc-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 60000);
const PHASE = new URLSearchParams(location.search).get('phase') || 'home';
try {
  if (PHASE === 'home') { localStorage.clear(); localStorage.setItem(SAVED_KEY, SAVED_VALUE); }
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.pathname === '/v2/conversation/guest/messages') return json({
      contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',assistant_text:'RAD RA 상품을 찾았어요.',
      response_mode:'PRODUCT_DISCOVERY',correlation_id:'req_lc',intent:{action:'PURCHASE',product_query:'RAD RA'},
      follow_up:{required:false,action:'PURCHASE',automatic_execution:false},
      safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
      retry_safe:true,
    });
    if (parsed.pathname.startsWith('/v2/public/product-cards')) return json(PRODUCTS);
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=life-info-cleanup');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, tries = 400) => {
    for (let i = 0; i < tries; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const visible = node => Boolean(node) && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  // Anything a person could press to reach 롯비함.
  const lotbiBoxEntries = () => [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [data-lotbi-box-open]')]
    .filter(node => node.matches('[data-lotbi-box-open]') || /롯비함|저장한 정보|저장한 항목/u.test((node.textContent || '') + ' ' + (node.getAttribute('aria-label') || '') + ' ' + (node.title || '')))
    .map(node => ({tag: node.tagName, text: (node.textContent || '').trim().slice(0, 40), aria: node.getAttribute('aria-label') || '', visible: visible(node)}));
  const lotbiBoxSurfaceOpen = () => Boolean(document.querySelector('[data-site-route="lotbi-box"]')) || [...document.querySelectorAll('.site-modal-header h2, [role="dialog"] h2')].some(h => /롯비함/u.test(h.textContent || ''));
  const result = {ok: true, phase: PHASE};
  if (PHASE === 'home') {
    await sleep(500);
    result.homeEntries = lotbiBoxEntries();
    // 생활정보 home.
    document.querySelector('[data-consumer-section="life"]').click();
    const panel = await wait(() => document.querySelector('.consumer-section-panel'), 'life surface');
    await wait(() => panel.querySelector('[data-life-shortcut]'), 'life shortcuts');
    await sleep(200);
    result.life = {
      shortcuts: [...panel.querySelectorAll('[data-life-shortcut]')].map(node => ({id: node.dataset.lifeShortcut, label: node.textContent.trim(), visible: visible(node)})),
      topBar: [...panel.querySelectorAll('.consumer-search, input[type="search"]')].length,
      footer: [...panel.querySelectorAll('.consumer-section-footer')].length,
      text: panel.innerText,
      entries: lotbiBoxEntries(),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    // Each detail screen too (bills must be unreachable).
    result.details = [];
    for (const id of result.life.shortcuts.map(item => item.id).filter(id => id !== 'festivals')) {
      panel.querySelector('[data-life-shortcut="' + id + '"]').click();
      await sleep(150);
      result.details.push({id, text: panel.innerText});
      [...panel.querySelectorAll('.consumer-action')].find(b => b.textContent === '생활정보로 돌아가기')?.click();
      await wait(() => panel.querySelector('[data-life-shortcut]'), 'back to life');
    }
    document.querySelector('[data-site-surface-close], .site-modal-close, [aria-label="닫기"]')?.click();
    await sleep(300);
    // Product cards: no "+ 롯비함".
    const prompt = document.getElementById('lotbi-prompt');
    prompt.value = 'RAD RA 사줘'; prompt.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    const rail = await wait(() => document.querySelector('.lotbi-rich-card-product')?.closest('section, .lotbi-rich-card-rail') || null, 'product cards');
    await sleep(300);
    result.products = {
      cards: rail.querySelectorAll('.lotbi-rich-card-product').length,
      toggles: rail.querySelectorAll('[data-lotbi-box-toggle-key]').length,
      boxText: /롯비함/u.test(rail.innerText),
      actions: [...rail.querySelectorAll('button, a')].map(node => (node.textContent || node.getAttribute('aria-label') || '').trim()).filter(Boolean),
    };
    // 4: /#lotbi-box typed while the page is open.
    location.hash = '#lotbi-box';
    await sleep(900);
    result.hashOpen = {surface: lotbiBoxSurfaceOpen(), entries: lotbiBoxEntries()};
    result.saved = localStorage.getItem(SAVED_KEY);
  } else if (PHASE === 'direct') {
    // 4: /#lotbi-box opened directly (or reloaded).
    await sleep(1500);
    result.direct = {surface: lotbiBoxSurfaceOpen(), hash: location.hash, entries: lotbiBoxEntries()};
    result.saved = localStorage.getItem(SAVED_KEY);
  }
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="lc-result">pending</pre>`;
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

async function evaluate(devtools, expression) {
  const result = await devtools.send('Runtime.evaluate', {expression, returnByValue: true}).catch(() => null);
  return result?.result?.value;
}

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url});
  const text = await waitFor(async () => {
    const value = await evaluate(devtools, "document.getElementById('lc-result')?.textContent || 'pending'");
    return value && value !== 'pending' ? value : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

const FORBIDDEN_LIFE = /공과금|고지서|저장한 정보|롯비함|어떤 생활정보가 필요하세요/u;
const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-info-cleanup-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  for (const testCase of CASES) {
    const label = testCase.label;
    const devtools = await openDevtools(browser, fs.mkdtempSync(path.join(dir, 'profile-')));
    try {
      await devtools.send('Page.enable');
      await devtools.send('Runtime.enable');
      await devtools.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
      await devtools.send('Emulation.setUserAgentOverride', {userAgent: testCase.mobile ? MOBILE_UA : DESKTOP_UA});
      if (testCase.mobile) await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});

      const home = await runPhase(devtools, `${origin}/${innerRel}?phase=home`, `${label}/home`);
      console.log(`LIFE_INFO_CLEANUP ${label}`, JSON.stringify({shortcuts: home.life.shortcuts.map(s => s.label), topBar: home.life.topBar, footer: home.life.footer, products: home.products, hash: home.hashOpen.surface}));
      // 1 공과금 menu
      assert.deepEqual(home.life.shortcuts.map(item => item.id), ['hospital', 'pharmacy', 'festivals', 'local', 'education'], `${label}: 생활정보 menu without 공과금`);
      assert.ok(home.life.shortcuts.every(item => item.visible), `${label}: every menu is visible`);
      for (const detail of home.details) assert.ok(!/공과금|고지서/u.test(detail.text), `${label}: ${detail.id} detail mentions no 공과금`);
      // 2 top question bar
      assert.equal(home.life.topBar, 0, `${label}: no top question bar`);
      // 3 bottom row
      assert.equal(home.life.footer, 0, `${label}: no bottom row`);
      assert.ok(!FORBIDDEN_LIFE.test(home.life.text), `${label}: 생활정보 text has no 공과금 / 저장한 정보 / 롯비함 / question bar copy`);
      assert.ok(home.life.pageOverflow <= 0, `${label}: no sideways scroll`);
      // 4 no 롯비함 entry
      assert.deepEqual(home.homeEntries, [], `${label}: nothing on the home screen opens 롯비함 ${JSON.stringify(home.homeEntries)}`);
      assert.deepEqual(home.life.entries, [], `${label}: nothing in 생활정보 opens 롯비함`);
      assert.equal(home.hashOpen.surface, false, `${label}: typing /#lotbi-box opens nothing`);
      const direct = await runPhase(devtools, `${origin}/${innerRel}?phase=direct#lotbi-box`, `${label}/direct`);
      assert.equal(direct.direct.surface, false, `${label}: /#lotbi-box opened directly stays on the conversation`);
      assert.deepEqual(direct.direct.entries, [], `${label}: no 롯비함 entry after a direct visit`);
      const reloaded = await runPhase(devtools, `${origin}/${innerRel}?phase=direct#lotbi-box`, `${label}/reload`);
      assert.equal(reloaded.direct.surface, false, `${label}: reloading /#lotbi-box opens nothing`);
      // 5 product cards
      assert.equal(home.products.cards, 2, `${label}: product cards rendered`);
      assert.equal(home.products.toggles, 0, `${label}: no 롯비함 save toggle on product cards`);
      assert.equal(home.products.boxText, false, `${label}: no "+ 롯비함" on product cards ${JSON.stringify(home.products.actions)}`);
      // Saved data is left alone.
      assert.equal(home.saved, SAVED_VALUE, `${label}: saved 롯비함 data untouched`);
      assert.equal(reloaded.saved, SAVED_VALUE, `${label}: saved 롯비함 data untouched after the direct visits`);
      // 6 plans page
      await devtools.send('Page.navigate', {url: `${origin}/subscribe.html`});
      const plans = await waitFor(async () => {
        const value = await evaluate(devtools, "document.readyState === 'complete' ? document.body.innerText : ''");
        return value && value.includes('LOTBI Plus') ? value : null;
      }, `${label}: subscribe page`);
      assert.ok(!/공과금|고지서/u.test(plans), `${label}: the plans page does not advertise 공과금`);
      assert.ok(plans.includes('생활비 자동정리'), `${label}: the plans page still lists 생활비 자동정리`);
      const overflow = await evaluate(devtools, 'document.documentElement.scrollWidth - document.documentElement.clientWidth');
      assert.ok(overflow <= 0, `${label}: plans page has no sideways scroll (${overflow})`);
    } finally {
      devtools.close();
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

console.log('SITE-LIFE-INFO-CLEANUP-FINAL-01 OK — no 공과금 menu, no top bar, no bottom row, no 롯비함 entry or save button, no 공과금 on the plans page; saved data untouched (360/375/390/412/1280 emulation)');
