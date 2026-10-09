// SITE-LIFE-DIRECT-CHAT-CARD-COMPACTION-01 (2026-10-07) — 생활정보 asks LOTBI
// in one tap, and a place card without a photo has no photo box.
//
// Production, phone web: 생활정보 → 병원·의원 → 조건 → "질문 준비하기" put the
// question in the composer (and focused it, opening the keyboard); the person
// had to press send again. The answer's 병원·약국 cards then kept an empty 16:8
// photo box on every card without a photo, most of a phone screen.
//
// Measured in a real browser (DevTools protocol, real time) against the real
// index.html with a fake Core, at 360/375/390/412 (mobile) and 1280 (desktop):
//   A one tap sends the question through the normal send path; no second tap,
//     the composer is never focused and stays empty; the answer starts.
//   B an empty region sends the current location when location use is on.
//   C 약국 and 지역생활정보 behave the same.
//   D a fast double tap sends one message.
//   E history back/forward and a reload send nothing again and focus nothing.
//   F/G no image_url, or an image that fails, leaves no media box; the card
//     is short and nothing in it is cut off.
//   H a real photo still renders.
//   I/J phone action unchanged; the map action follows the map app chosen in
//     settings (cookie read by the existing helper), default unchanged.
//   K tapping the composer focuses it - only then.
//   L dark (다크 in settings): the same one-tap ask; the form button, its
//     note and the photo-less cards' text keep readable contrast.
// This is a browser emulation, not an iPhone or Android device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const sections = read('site-consumer-sections.js');
for (const needle of [
  'onDraft: text => askFromLife(text),',
  "void requestAssistant(question, true, '', 0, {keepKeyboardClosed: true});",
  'surfaceRestoreFocus = undefined;',
  'const composerStaysClosed = keepKeyboardClosed || recovering;',
]) assert.ok(conversation.includes(needle), `direct ask contract missing: ${needle}`);
const askBody = conversation.slice(conversation.indexOf('const askFromLife = text => {'), conversation.indexOf("onDraft: text => askFromLife(text),"));
assert.ok(!/prompt\.focus\(|focusComposerInPlace\(/u.test(askBody), 'asking from 생활정보 never focuses the composer');
// Every focus after an answer inside requestAssistant goes through refocusComposer.
const requestBody = conversation.slice(conversation.indexOf('const requestAssistant = async'), conversation.indexOf('const submitCurrentPrompt = async'));
assert.ok(!/(?<!const refocusComposer[^\n]*)\bfocusComposerInPlace\(\);/u.test(requestBody.replace(/const refocusComposer = [\s\S]*?\n {4}\};/u, '')), 'no direct composer focus left in requestAssistant');
assert.ok(!/\bprompt\.focus\(\)/u.test(requestBody.replace(/const refocusComposer = [\s\S]*?\n {4}\};/u, '')), 'no direct prompt.focus() left in requestAssistant');
assert.ok(!/\breturnComposerFocusAfterTurn\(\)/u.test(requestBody.replace(/const refocusComposer = [\s\S]*?\n {4}\};/u, '')), 'no direct returnComposerFocusAfterTurn() left in requestAssistant');
assert.ok(!sections.includes('질문 준비하기'), 'the button sends; it no longer only prepares');
assert.ok(sections.includes("action('바로 찾기')") && sections.includes("action('롯비에게 물어보기')"));
assert.ok(!sections.includes('다음 화면에서 질문을 확인한 뒤 보내세요'), 'no note promising a confirmation step');
// 유치원·학교 → 학교 also asks through onDraft, so it sends right away too
// (its browser run is scripts/validate_kindergarten_official_info_01.mjs).
const education = read('site-life-education.js');
assert.ok(!education.includes('질문 준비하기') && !education.includes('다음 화면에서 질문을 확인한 뒤 보내세요'), '학교 question form promises no confirmation step');
assert.ok(!conversation.includes('preserveEmptyMedia') && !conversation.includes("rail.classList.add('has-place-banner')"), 'no empty photo box contract left');

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
  throw new Error('Chrome/Chromium is required for the life direct chat validation.');
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

const verified = id => ({
  provider: 'GOOGLE_PLACES', provider_place_id: `google:${id}`, match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
  fetched_at: '2026-10-07T08:30:00Z', verification_state: 'VERIFIED', attributions: [{display_name: 'Google Places contributor'}],
});
const clinic = (index, name, {image = null, phone = null, open = 'OPEN', hours = '오늘 09:00~23:00'} = {}) => ({
  result_id: `clinic-${index}`, place_id: `naver:clinic:${index}`, name,
  category: '병원,의원>내과',
  road_address: `전북특별자치도 전주시 완산구 효자로 ${100 + index}`,
  latitude: 35.81 + index / 1000, longitude: 127.12 + index / 1000,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone, phone_verified: Boolean(phone),
  image_url: image, photo_evidence: image ? verified(index) : null,
  medical_status: {kind: 'HOSPITAL', open_state: open, hours_label: hours, target_label: '지금', basis: 'NMC_REGISTERED_HOURS'},
});
const placeResult = places => ({
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_0d1e2c3a4b5c6d7e8f90',
  provider_code: 'NMC', source: 'NMC_MEDICAL', query: '전주 효자동 내과', results: places,
});
const MIXED = placeResult([
  clinic(1, '가상바른내과의원', {image: 'https://lh3.googleusercontent.com/lotbi-life-direct-photo.jpg', phone: '063-000-0001'}),
  clinic(2, '가상효자내과의원 전주효자점 (사진 없는 카드)', {phone: '063-000-0002'}),
  clinic(3, '가상서신내과의원', {image: 'https://lh3.googleusercontent.com/broken-lotbi-life-direct.jpg', open: 'CLOSED', hours: '오늘 09:00~18:00'}),
]);
const NO_PHOTO = placeResult([
  clinic(4, '가상아주긴이름의내과의원 전주효자동 본원 야간진료센터', {phone: '063-000-0004'}),
  clinic(5, '가상동네내과의원'),
]);

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const MIXED = ${JSON.stringify(MIXED)};
const NO_PHOTO = ${JSON.stringify(NO_PHOTO)};
const out = document.getElementById('ld-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 80000);
const params = new URLSearchParams(location.search);
const PHASE = params.get('phase') || 'hospital';
const MAP = params.get('map') || '';
const DARK = params.get('dark') === '1';
const log = JSON.parse(sessionStorage.getItem('ld-log') || '[]');
const remember = entry => { log.push(entry); sessionStorage.setItem('ld-log', JSON.stringify(log)); };
try {
  if (PHASE !== 'reload') { localStorage.clear(); sessionStorage.removeItem('ld-log'); log.length = 0; }
  document.cookie = 'lotbi_default_map_provider_v1=; Path=/; Max-Age=0';
  if (MAP) document.cookie = 'lotbi_default_map_provider_v1=' + MAP + '; Path=/';
  // Dark: the person chose 다크 in settings (the shared theme cookie).
  document.cookie = 'lotbi_theme_preference_v1=; Path=/; Max-Age=0';
  if (DARK) document.cookie = 'lotbi_theme_preference_v1=dark; Path=/';
  // Location use is on by default; the browser grants a position in 전주.
  Object.defineProperty(navigator, 'permissions', {configurable: true, value: {query: async () => ({state: 'granted', onchange: null, addEventListener() {}, removeEventListener() {}})}});
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: ok => setTimeout(() => ok({coords: {latitude: 35.8123, longitude: 127.1234, accuracy: 20}, timestamp: Date.now()}), 10),
    watchPosition: () => 1, clearWatch() {},
  }});
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const mockImageSrc = new WeakMap();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return mockImageSrc.get(this) || nativeImageSrc?.get?.call(this) || ''; },
    set(value) {
      const next = String(value);
      if (next.startsWith('https://lh3.googleusercontent.com/')) {
        mockImageSrc.set(this, next);
        setTimeout(() => this.dispatchEvent(new Event(next.includes('/broken-') ? 'error' : 'load')), 60);
        return;
      }
      nativeImageSrc?.set?.call(this, next);
    },
  });
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init.body);
      remember({phase: PHASE, text: body.text, location: body.client_context?.location || null});
      await new Promise(r => setTimeout(r, 150));
      const places = PHASE === 'nophoto' ? NO_PHOTO : MIXED;
      const medical = /병원|약국|의원/.test(body.text);
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: medical ? '등록 시간상 문을 연 곳이에요. 방문 전 전화로 확인해 주세요.' : '지역 생활정보를 정리했어요.',
        response_mode: medical ? 'PLACE_PROVIDER_READONLY' : 'AI_GROUNDED_CURRENT_FACT', correlation_id:'req_ld_' + log.length,
        intent:{action: medical ? 'PLACE_SEARCH' : 'UNKNOWN'},
        follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        ...(medical ? {place_result: places} : {}),
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const prompt = document.getElementById('lotbi-prompt');
  // Counted twice: focus events (focus emulation is on) and every focus()
  // call on the composer, so a call that would open a phone keyboard is seen
  // even where the browser does not dispatch the event.
  let focusEvents = 0;
  let focusCalls = 0;
  prompt.addEventListener('focus', () => { focusEvents += 1; });
  prompt.focus = function (...args) { focusCalls += 1; return HTMLElement.prototype.focus.apply(this, args); };
  const focusTotal = () => focusEvents + focusCalls;
  const conversation = await import('/site-conversation.js?v=life-direct-chat');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const {buildDefaultMapHref, buildVerifiedPhoneHref, normalizePlaceResult} = await import('/site-navigation.js?v=life-direct-chat');
  const {readDefaultMapProvider} = await import('/site-location-preference.js?v=life-direct-chat');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, tries = 600) => {
    for (let i = 0; i < tries; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)}; };
  // Text contrast against the first opaque background behind it (WCAG).
  const rgb = value => (String(value).match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = rgb(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return null; const [a, b] = [lum(rgb(getComputedStyle(node).color).slice(0, 3)), lum(bgOf(node))].sort((x, y) => y - x); return Math.round((a + .05) / (b + .05) * 100) / 100; };
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const users = () => [...document.querySelectorAll('.chat-message-user .chat-message-body')].map(n => n.innerText.trim());
  const mine = () => log.filter(item => item.phase === PHASE);
  const openLife = async item => {
    document.querySelector('[data-consumer-section="life"]').click();
    const shortcut = await wait(() => document.querySelector('[data-life-shortcut="' + item + '"]'), 'life shortcut ' + item);
    shortcut.click();
    return await wait(() => document.querySelector('.consumer-life-form'), 'life form');
  };
  const typeInto = (field, value) => { field.value = value; field.dispatchEvent(new Event('input', {bubbles: true})); };
  const submitButton = form => form.querySelector('button[type="submit"]');
  const cardsOf = rail => [...rail.querySelectorAll('.lotbi-place-orbit-card')];
  const measureCard = card => {
    const copy = card.querySelector('.lotbi-rich-card-copy');
    return {
      name: card.querySelector('.lotbi-rich-card-title')?.textContent || '',
      hasMedia: Boolean(card.querySelector('.lotbi-rich-card-place-media')),
      mediaState: card.querySelector('.lotbi-rich-card-place-media')?.dataset.mediaState || '',
      photoReady: Boolean(card.querySelector('.lotbi-place-photo.is-ready')),
      card: box(card),
      copyClipped: copy ? copy.scrollHeight > copy.clientHeight + 1 : true,
      actions: [...card.querySelectorAll('.lotbi-rich-card-action')].map(n => ({action: n.dataset.action, provider: n.dataset.mapProvider || '', href: n.getAttribute('href') || '', ...box(n)})),
    };
  };
  const result = {ok: true, phase: PHASE};

  if (PHASE === 'hospital' || PHASE === 'nophoto' || PHASE === 'nearby' || PHASE === 'pharmacy' || PHASE === 'local') {
    const item = PHASE === 'pharmacy' ? 'pharmacy' : PHASE === 'local' ? 'local' : 'hospital';
    const form = await openLife(item);
    result.buttonLabel = submitButton(form).textContent;
    result.theme = document.body.dataset.siteTheme || '';
    result.formContrast = {
      button: contrast(submitButton(form)),
      note: contrast(form.closest('.consumer-life-detail')?.querySelector('.consumer-feature-note')),
    };
    if (item === 'local') {
      const [where, what] = form.querySelectorAll('input');
      typeInto(where, '전주시 덕진구'); typeInto(what, '쓰레기 배출일');
    } else {
      if (PHASE !== 'nearby' && PHASE !== 'pharmacy') typeInto(form.querySelector('[data-medical-field="region"]'), '전주 효자동');
      form.querySelector('[data-medical-chip="now"]').click();
    }
    // D: a fast double tap.
    const button = submitButton(form);
    button.click(); button.click();
    result.composerAfterTap = prompt.value;
    await wait(() => assistants().length >= 1, 'answer');
    await sleep(item === 'local' ? 400 : 700);
    result.requests = mine();
    result.users = users();
    result.promptValue = prompt.value;
    result.focusCount = focusTotal();
    result.focusDetail = {events: focusEvents, calls: focusCalls};
    result.activeIsPrompt = document.activeElement === prompt;
    result.activeIsTextEntry = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    result.surfaceOpen = Boolean(document.querySelector('.consumer-section-panel'));
    const rail = document.querySelector('.lotbi-place-orbit');
    if (rail) {
      await sleep(300);
      result.rail = {...box(rail), hasPhotoClass: rail.classList.contains('has-place-photo'), bannerClass: rail.classList.contains('has-place-banner')};
      result.viewport = {w: window.innerWidth, h: window.innerHeight};
      const cards = cardsOf(rail);
      const centerOf = () => rail.querySelector('[data-orbit-slot="CENTER"]');
      result.cards = [];
      for (let index = 0; index < cards.length; index += 1) {
        await wait(() => Number(centerOf()?.dataset.orbitIndex) === index, 'center ' + index);
        await sleep(320);
        const center = centerOf();
        const overlaps = (a, b) => Boolean(a && b) && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        const arrows = [rail.querySelector('.lotbi-place-orbit-control-prev'), rail.querySelector('.lotbi-place-orbit-control-next')].map(box);
        const texts = [...center.querySelectorAll('.lotbi-rich-card-source, .lotbi-rich-card-title, .lotbi-rich-card-price, .lotbi-place-medical-line, .lotbi-place-badges')].map(box);
        const icons = [...center.querySelectorAll('.lotbi-place-action-icon-image')].map(box);
        result.cards.push({
          ...measureCard(center), rail: box(rail),
          arrowOverText: arrows.some(a => texts.some(t => overlaps(a, t))),
          arrowOverIcon: arrows.some(a => icons.some(i => overlaps(a, i))),
          contrast: {
            title: contrast(center.querySelector('.lotbi-rich-card-title')),
            source: contrast(center.querySelector('.lotbi-rich-card-source')),
            address: contrast(center.querySelector('.lotbi-rich-card-price')),
            medical: contrast(center.querySelector('.lotbi-place-medical-line')),
          },
        });
        rail.querySelector('.lotbi-place-orbit-control-next')?.click();
      }
      result.sideVisible = (() => {
        const side = rail.querySelector('[data-orbit-slot="RIGHT_FRONT"]');
        return side ? Number.parseFloat(getComputedStyle(side).opacity) : 0;
      })();
      // I/J: the existing helpers decide phone and map; the card must agree.
      const normalized = normalizePlaceResult(PHASE === 'nophoto' ? NO_PHOTO : MIXED);
      const provider = readDefaultMapProvider(document.cookie);
      result.mapProvider = provider;
      result.expectedMap = normalized.results.map(place => buildDefaultMapHref(provider, place));
      result.expectedPhone = normalized.results.map(place => buildVerifiedPhoneHref(place) || '');
    }
    if (PHASE === 'hospital') {
      // E: forward reopens 생활정보 (its menu, nothing sent); back closes it.
      const before = mine().length;
      history.forward(); await sleep(900);
      result.forwardSurface = Boolean(document.querySelector('.consumer-section-panel'));
      result.forwardActiveIsTextEntry = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      history.back(); await sleep(900);
      result.backSurface = Boolean(document.querySelector('.consumer-section-panel'));
      result.historyRequests = mine().length - before;
      result.historyFocusCount = focusTotal();
      result.historyUsers = users();
    }
    if (PHASE === 'hospital' && params.get('tap') === '1') {
      // K: the person taps the composer.
      prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      prompt.focus();
      await sleep(200);
      result.tapFocusEvents = focusEvents;
      result.tapFocusCalls = focusCalls;
      result.tapActiveIsPrompt = document.activeElement === prompt;
    }
  } else if (PHASE === 'reload') {
    await wait(() => document.body.dataset.conversationRestore === 'ready', 'restore');
    await sleep(1800);
    result.requests = mine();
    result.users = users();
    result.promptValue = prompt.value;
    result.focusCount = focusTotal();
    result.activeIsPrompt = document.activeElement === prompt;
  }
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="ld-result">pending</pre>`;
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

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url});
  const text = await waitFor(async () => {
    const result = await devtools.send('Runtime.evaluate', {
      expression: "document.getElementById('ld-result')?.textContent || 'pending'",
      returnByValue: true,
    }).catch(() => null);
    const value = result?.result?.value;
    return value && value !== 'pending' ? value : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

function assertOneDirectAsk(run, label, expectedText) {
  assert.equal(run.composerAfterTap, '', `${label}: the question is not left in the composer for a second tap`);
  assert.deepEqual(run.requests.map(item => item.text), [expectedText], `${label}: one tap sends exactly one message`);
  assert.deepEqual(run.users, [expectedText], `${label}: one user message`);
  assert.equal(run.promptValue, '', `${label}: composer empty after sending`);
  assert.equal(run.focusCount, 0, `${label}: the composer was never focused (keyboard stays closed)`);
  assert.equal(run.activeIsPrompt, false, `${label}: composer not focused`);
  assert.equal(run.activeIsTextEntry, false, `${label}: no text field focused`);
  assert.equal(run.surfaceOpen, false, `${label}: 생활정보 closed, the conversation is shown`);
}

function assertCards(run, label, testCase, {photo}) {
  assert.ok(run.rail, `${label}: place cards rendered`);
  assert.equal(run.rail.bannerClass, false, `${label}: no forced photo-height banner`);
  assert.equal(run.rail.hasPhotoClass, photo, `${label}: rail photo height only when a photo is shown`);
  for (const [index, card] of run.cards.entries()) {
    assert.ok(card.card.h <= card.rail.h + 1, `${label}: card ${index} ${card.card.h}px fits the rail ${card.rail.h}px`);
    assert.ok(card.card.y >= card.rail.y - 1 && card.card.bottom <= card.rail.bottom + 1, `${label}: card ${index} not cut by the rail`);
    assert.equal(card.copyClipped, false, `${label}: card ${index} text not cut off`);
    assert.ok(card.card.x >= 0 && card.card.right <= run.viewport.w, `${label}: card ${index} inside the screen`);
    for (const action of card.actions) {
      assert.ok(action.right <= run.viewport.w && action.x >= 0, `${label}: card ${index} ${action.action} inside the screen`);
      assert.ok(action.bottom <= card.card.bottom + 1 && action.y >= card.card.y - 1, `${label}: card ${index} ${action.action} inside its card`);
      if (testCase.mobile) assert.ok(action.w >= 44 && action.h >= 44, `${label}: card ${index} ${action.action} touch target ${action.w}x${action.h}`);
    }
    if (!card.hasMedia) {
      assert.equal(card.arrowOverText, false, `${label}: card ${index} without a photo - the arrows do not cover its text`);
      assert.equal(card.arrowOverIcon, false, `${label}: card ${index} without a photo - the arrows do not cover phone / map`);
    }
    const map = card.actions.find(action => action.provider);
    assert.ok(map, `${label}: card ${index} map action`);
    assert.equal(map.provider, run.mapProvider, `${label}: card ${index} uses the map app from settings`);
    assert.equal(map.href, run.expectedMap[index], `${label}: card ${index} map link from the existing helper`);
    const phone = card.actions.find(action => action.action === 'phone');
    assert.equal(phone?.href || '', run.expectedPhone[index], `${label}: card ${index} phone action unchanged`);
  }
  assert.ok(run.sideVisible <= 0.2, `${label}: side card stays faint (${run.sideVisible})`);
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-direct-chat-'));
const server = startServer();
const summary = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  for (const testCase of CASES) {
    const devtools = await openDevtools(browser, fs.mkdtempSync(path.join(dir, 'profile-')));
    const label = testCase.label;
    try {
      await devtools.send('Page.enable');
      await devtools.send('Runtime.enable');
      await devtools.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
      await devtools.send('Emulation.setUserAgentOverride', {userAgent: testCase.mobile ? MOBILE_UA : DESKTOP_UA});
      if (testCase.mobile) await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
      await devtools.send('Emulation.setFocusEmulationEnabled', {enabled: true});
      await devtools.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
      const page = query => `${origin}/${innerRel}?${query}`;

      // A, D, E, F, G, H, I, J: 병원·의원 with a region and 지금 진료.
      const hospital = await runPhase(devtools, page(`phase=hospital${label === '390' ? '&tap=1' : ''}`), `${label}/hospital`);
      console.log(`LIFE_DIRECT_CHAT ${label} hospital`, JSON.stringify(hospital));
      assert.equal(hospital.buttonLabel, '바로 찾기', `${label}: button label`);
      assertOneDirectAsk(hospital, `${label}/hospital`, '전주 효자동에서 지금 진료하는 병원 알려줘');
      assertCards(hospital, `${label}/hospital`, testCase, {photo: true});
      const [photoCard, noPhotoCard, brokenCard] = hospital.cards;
      assert.ok(photoCard.hasMedia && photoCard.mediaState === 'loaded' && photoCard.photoReady, `${label}: a real photo renders`);
      assert.equal(noPhotoCard.hasMedia, false, `${label}: no image_url, no media box`);
      assert.equal(brokenCard.hasMedia, false, `${label}: a photo that fails removes its media box`);
      assert.ok(noPhotoCard.card.h <= photoCard.card.h - 90, `${label}: a card without a photo is short (${noPhotoCard.card.h} vs ${photoCard.card.h})`);
      assert.equal(hospital.forwardSurface, true, `${label}: forward reopens 생활정보`);
      assert.equal(hospital.forwardActiveIsTextEntry, false, `${label}: reopening focuses no text field`);
      assert.equal(hospital.backSurface, false, `${label}: back closes it`);
      assert.equal(hospital.historyRequests, 0, `${label}: back/forward sends nothing again`);
      assert.equal(hospital.historyFocusCount, 0, `${label}: back/forward focuses no composer`);
      assert.deepEqual(hospital.historyUsers, hospital.users, `${label}: no new message after back/forward`);
      if (label === '390') {
        assert.ok(hospital.tapFocusEvents >= 1 && hospital.tapFocusCalls === 1, `${label}: tapping the composer focuses it (${hospital.tapFocusEvents} events, ${hospital.tapFocusCalls} calls)`);
        assert.equal(hospital.tapActiveIsPrompt, true, `${label}: composer focused after the tap`);
      }

      // E: a reload sends nothing and focuses nothing.
      const reloaded = await runPhase(devtools, page('phase=reload'), `${label}/reload`);
      console.log(`LIFE_DIRECT_CHAT ${label} reload`, JSON.stringify(reloaded));
      assert.deepEqual(reloaded.requests, [], `${label}: reload sends nothing`);
      assert.deepEqual(reloaded.users, ['전주 효자동에서 지금 진료하는 병원 알려줘'], `${label}: the stored conversation, once`);
      assert.equal(reloaded.promptValue, '', `${label}: reload leaves the composer empty`);
      assert.equal(reloaded.focusCount, 0, `${label}: reload focuses no composer`);

      // F: a list with no photo at all is short and nothing is cut off; the
      // map app follows settings (default and each existing choice).
      const maps = label === '390' ? ['', 'NAVER_MAP', 'KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS'] : [''];
      for (const map of maps) {
        const noPhoto = await runPhase(devtools, page(`phase=nophoto${map ? `&map=${map}` : ''}`), `${label}/nophoto/${map || 'default'}`);
        console.log(`LIFE_DIRECT_CHAT ${label} nophoto ${map || 'default'}`, JSON.stringify({rail: noPhoto.rail, cards: noPhoto.cards.map(c => ({h: c.card.h, media: c.hasMedia, provider: c.actions.find(a => a.provider)?.provider}))}));
        assertOneDirectAsk(noPhoto, `${label}/nophoto`, '전주 효자동에서 지금 진료하는 병원 알려줘');
        assertCards(noPhoto, `${label}/nophoto/${map || 'default'}`, testCase, {photo: false});
        assert.equal(noPhoto.mapProvider, map || 'NAVER_MAP', `${label}: map provider ${map || 'default'} read from settings`);
        assert.ok(noPhoto.cards.every(card => !card.hasMedia), `${label}: no media box on any card`);
        assert.ok(noPhoto.rail.h <= Math.round(hospital.rail.h * 0.7), `${label}: no-photo list is compact (${noPhoto.rail.h} vs ${hospital.rail.h})`);
        if (!map) summary.push(`${label}: photo rail ${hospital.rail.h}px → no-photo rail ${noPhoto.rail.h}px, no-photo card ${noPhotoCard.card.h}px vs photo card ${photoCard.card.h}px`);
      }

      // Dark (다크 chosen in settings): the same one-tap ask, and the form and
      // the cards without a photo stay readable.
      const dark = await runPhase(devtools, page('phase=nophoto&dark=1'), `${label}/nophoto/dark`);
      console.log(`LIFE_DIRECT_CHAT ${label} dark`, JSON.stringify({theme: dark.theme, form: dark.formContrast, cards: dark.cards.map(card => card.contrast), lightForm: hospital.formContrast, lightCards: hospital.cards.map(card => card.contrast)}));
      assert.equal(dark.theme, 'dark', `${label}: dark theme applied`);
      assertOneDirectAsk(dark, `${label}/dark`, '전주 효자동에서 지금 진료하는 병원 알려줘');
      assertCards(dark, `${label}/dark`, testCase, {photo: false});
      assert.ok(dark.formContrast.button >= 4.5, `${label}: dark 바로 찾기 contrast ${dark.formContrast.button}`);
      assert.ok(dark.formContrast.note >= 4.5, `${label}: dark form note contrast ${dark.formContrast.note}`);
      for (const [index, card] of dark.cards.entries()) {
        for (const key of ['title', 'address', 'medical']) {
          if (card.contrast[key] !== null) assert.ok(card.contrast[key] >= 4.5, `${label}: dark card ${index} ${key} contrast ${card.contrast[key]}`);
        }
        assert.ok(card.contrast.source >= 3, `${label}: dark card ${index} category contrast ${card.contrast.source}`);
      }

      if (label === '390') {
        // B: empty region + location allowed → the current location goes along.
        const nearby = await runPhase(devtools, page('phase=nearby'), `${label}/nearby`);
        assertOneDirectAsk(nearby, `${label}/nearby`, '근처에서 지금 진료하는 병원 알려줘');
        assert.ok(nearby.requests[0].location && Math.abs(nearby.requests[0].location.latitude - 35.812) < 0.01, `${label}: current location sent ${JSON.stringify(nearby.requests[0].location)}`);
        // C: the same one-tap ask for 약국 and 지역생활정보.
        const pharmacy = await runPhase(devtools, page('phase=pharmacy'), `${label}/pharmacy`);
        assert.equal(pharmacy.buttonLabel, '바로 찾기');
        assertOneDirectAsk(pharmacy, `${label}/pharmacy`, '근처에서 지금 여는 약국 알려줘');
        const local = await runPhase(devtools, page('phase=local'), `${label}/local`);
        assert.equal(local.buttonLabel, '롯비에게 물어보기');
        assertOneDirectAsk(local, `${label}/local`, '우리 지역 생활정보를 알려 줘\n지역 또는 장소: 전주시 덕진구\n궁금한 생활정보: 쓰레기 배출일');
      }
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

for (const line of summary) console.log(`LIFE_DIRECT_CHAT compact ${line}`);
console.log('SITE-LIFE-DIRECT-CHAT-CARD-COMPACTION-01 OK — 생활정보 asks in one tap without the keyboard; cards without a photo have no photo box; phone and the chosen map app unchanged');
