// CONVERSATION-ANSWER-UX-01 (QA 2026-10-10 일괄보고 01 #6–#11) — the chat's
// answers, in a real browser (DevTools protocol, real time) against the real
// index.html with a fake Core, at 320/360/390/412 (phone) and 1280 (desktop).
//
//   #7 지역정보 → 약국 with no location: Core asks "어느 지역에서 찾을까요?" with
//      follow_up.reason LOCATION_REQUIRED, and the answer offers
//      [현재 위치 사용] [지역 선택] (location use off → [지역 선택] only).
//      - 현재 위치 사용: asks the same question again once, with the location;
//        a browser that blocks location gets words and no second question.
//      - 지역 선택: the region list (Core /v2/life/weather/regions) → one
//        question "전북특별자치도 전주시 근처 약국 찾아줘".
//      - REGION_AMBIGUOUS or an older Core without a reason: no buttons.
//      - The buttons survive a reload; nothing waits in the composer and the
//        composer is never focused by any of this.
//   #8 캘린더에 추가 only under an answer with a schedule: none under a
//      "where?" answer, a place answer or a plain answer.
//   #9 a place card shows NAVER's category as its last step ("여행,명소>동물원"
//      → "동물원", "카페,디저트" → "카페·디저트").
//   #6 a home example asks at once (one question, composer empty, no focus);
//      의심되는 문자 확인 opens a screen and shows a chevron.
//   #11 Korean words wrap whole (word-break: keep-all) on the page and in the
//      chat; the safety line under the composer is centred in a conversation.
//   Dark (다크 in settings): buttons and the region list keep ≥4.5 contrast.
// This is a browser emulation, not an iPhone or Android device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {placeCategoryLabel} from '../site-navigation.js';
import {regionChoicesFromPayload} from '../site-region-picker.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');

// ── Pure contract ──────────────────────────────────────────────────────────
assert.equal(placeCategoryLabel('여행,명소>동물원'), '동물원');
assert.equal(placeCategoryLabel('음식점>한식>소고기구이'), '소고기구이');
assert.equal(placeCategoryLabel('카페,디저트'), '카페·디저트');
assert.equal(placeCategoryLabel('약국'), '약국');
assert.equal(placeCategoryLabel('  '), '');
assert.equal(placeCategoryLabel(null), '');
const REGIONS = {
  items: [
    {code: 'R1', label: '전주시', province: '전북특별자치도', latitude: 35.82, longitude: 127.15},
    {code: 'R2', label: '익산시', province: '전북특별자치도', latitude: 35.95, longitude: 126.96},
    {code: 'R3', label: '세종특별자치시', province: '세종특별자치시', latitude: 36.48, longitude: 127.29},
  ],
  provinces: ['세종특별자치시', '전북특별자치도'],
  ai_calls: 0,
};
const choices = regionChoicesFromPayload(REGIONS);
assert.deepEqual(choices.provinces, ['세종특별자치시', '전북특별자치도']);
assert.deepEqual(choices.byProvince.get('전북특별자치도').map(entry => entry.name), ['전북특별자치도 전주시', '전북특별자치도 익산시']);
assert.deepEqual(choices.byProvince.get('세종특별자치시').map(entry => entry.name), ['세종특별자치시']);
assert.equal(regionChoicesFromPayload({items: []}), null);

const conversationSource = read('site-conversation.js');
assert.match(conversationSource, /function answerLocationRequest\(response, question\) \{/u);
assert.match(conversationSource, /const reason = response\?\.followUp\?\.reason \|\| response\?\.intent\?\.clarification;/u);
assert.equal((conversationSource.match(/const locationRequest = answerLocationRequest\(response, message\);/gu) || []).length, 2, 'guest and signed-in answers both remember it');
assert.match(conversationSource, /import\('\.\/site-region-picker\.js\?v=aset-[0-9a-f]{12}'\)/u, 'the region list loads only when asked');
assert.doesNotMatch(conversationSource, /^import [^\n]*site-region-picker/mu, 'no new module in the first bundle');
// styles.css is a locked file (validate_hardening.py); the app's own base sheet carries it.
assert.match(read('home-chat.css'), /body \{ word-break: keep-all; overflow-wrap: break-word; \}/u);

// ── Browser ────────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium',
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the conversation answer UX validation.');
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '320', width: 320, height: 640, mobile: true},
  {label: '360', width: 360, height: 800, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: '1280', width: 1280, height: 900, mobile: false},
];

const placeResult = (query, places) => ({
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_0a1b2c3d4e5f60718293',
  provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query, results: places,
});
const place = (index, name, category) => ({
  result_id: `place-${index}`, place_id: `naver:cau:${index}`, name, category,
  road_address: `전북특별자치도 전주시 완산구 기린대로 ${90 + index}`,
  latitude: 35.81 + index / 1000, longitude: 127.15 + index / 1000,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone: null, phone_verified: false, image_url: null, photo_evidence: null,
});
const ATTRACTIONS = placeResult('전주 관광지', [
  place(1, '가상전주동물원', '여행,명소>동물원'),
  place(2, '가상한옥카페', '카페,디저트'),
  place(3, '가상전주명소', '관광지'),
]);
const PHARMACIES = placeResult('근처 약국', [place(4, '가상바른약국', '약국'), place(5, '가상온누리약국', '약국')]);

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const REGIONS = ${JSON.stringify(REGIONS)};
const ATTRACTIONS = ${JSON.stringify(ATTRACTIONS)};
const PHARMACIES = ${JSON.stringify(PHARMACIES)};
const out = document.getElementById('cau-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 80000);
const params = new URLSearchParams(location.search);
const PHASE = params.get('phase') || 'clarify';
const PERM = params.get('perm') || 'prompt';
const DARK = params.get('dark') === '1';
// Optional evidence (CONVERSATION_ANSWER_UX_SCREENSHOTS): pause so the runner can capture.
const SHOTS = params.get('shots') === '1';
const log = JSON.parse(sessionStorage.getItem('cau-log') || '[]');
const remember = entry => { log.push(entry); sessionStorage.setItem('cau-log', JSON.stringify(log)); };
try {
  if (PHASE !== 'reload') { localStorage.clear(); sessionStorage.removeItem('cau-log'); log.length = 0; }
  document.cookie = 'lotbi_location_usage_v1=; Path=/; Max-Age=0';
  if (params.get('usage') === 'off') document.cookie = 'lotbi_location_usage_v1=off; Path=/';
  document.cookie = 'lotbi_theme_preference_v1=; Path=/; Max-Age=0';
  if (DARK) document.cookie = 'lotbi_theme_preference_v1=dark; Path=/';
  // The browser: 'granted' / 'denied' / 'prompt'. In 'prompt' the first ask
  // is dismissed (no location) and an explicit second ask is allowed.
  let geoAsks = 0;
  Object.defineProperty(navigator, 'permissions', {configurable: true, value: {query: async () => ({state: PERM, onchange: null, addEventListener() {}, removeEventListener() {}})}});
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (ok, bad) => {
      geoAsks += 1;
      const allowed = PERM === 'granted' || (PERM === 'prompt' && geoAsks > 1 && params.get('allowSecond') === '1');
      setTimeout(() => allowed
        ? ok({coords: {latitude: 35.8123, longitude: 127.1234, accuracy: 20}, timestamp: Date.now()})
        : bad({code: 1, message: 'denied', PERMISSION_DENIED: 1}), 10);
    },
    watchPosition: () => 1, clearWatch() {},
  }});
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
  const base = {contract_id:'CORE-WEB-CHAT-01',schema_version:1,retry_safe:true,
    safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false}};
  const answer = (text, extra = {}) => ({...base, status:'ANSWERED', assistant_text:text, response_mode:'STANDARD', correlation_id:'corr_cau_' + log.length,
    intent:{action:'UNKNOWN'}, follow_up:{required:false, action:'UNKNOWN', automatic_execution:false}, ...extra});
  const ask = (text, reason) => ({...base, status:'FOLLOW_UP_REQUIRED', assistant_text:text, response_mode:'MEDICAL_CLARIFICATION', correlation_id:'corr_cau_ask_' + log.length,
    intent:{action:'MEDICAL_SEARCH', domain:'LIFE_MEDICAL', kind:'PHARMACY', ...(reason ? {clarification: reason} : {})},
    follow_up:{required:true, action:'MEDICAL_SEARCH', automatic_execution:false, ...(reason ? {reason} : {})}});
  globalThis.__regionLists = 0;
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/life/weather/regions') { globalThis.__regionLists += 1; return json(REGIONS); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init.body);
      const where = body.client_context?.location || null;
      remember({phase: PHASE, text: body.text, location: where});
      await new Promise(r => setTimeout(r, 120));
      const text = String(body.text || '');
      if (text === '중구 근처 약국 찾아줘') return json(ask("'중구'은(는) 여러 지역에 있어요. 서울특별시 중구, 부산광역시 중구 중 어디에서 찾을까요?", 'REGION_AMBIGUOUS'));
      if (text === '옛 근처 약국 찾아줘') return json(ask('어느 지역에서 찾을까요?', null));
      if (/약국/.test(text) && !where && !/전주시|세종/.test(text)) return json(ask('어느 지역에서 찾을까요? 시·군·구 이름(예: 전주시 완산구)을 알려주시거나 위치 사용을 허용해 주세요.', 'LOCATION_REQUIRED'));
      if (/약국/.test(text)) return json(answer('근처 약국 2곳을 찾았어요.', {response_mode:'MEDICAL_PROVIDER_READONLY', intent:{action:'MEDICAL_SEARCH'}, place_result: PHARMACIES}));
      if (/관광지/.test(text)) return json(answer('전주에서 가볼 만한 곳을 찾았어요.', {response_mode:'PLACE_PROVIDER_READONLY', intent:{action:'PLACE_SEARCH', category:'ATTRACTION'}, place_result: ATTRACTIONS}));
      return json(answer('정리해 볼게요. 오늘은 맑고 할 일은 세 가지예요.'));
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const prompt = document.getElementById('lotbi-prompt');
  let focusEvents = 0, focusCalls = 0;
  prompt.addEventListener('focus', () => { focusEvents += 1; });
  prompt.focus = function (...args) { focusCalls += 1; return HTMLElement.prototype.focus.apply(this, args); };
  const conversation = await import('/site-conversation.js?v=cau');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, tries = 600) => {
    for (let i = 0; i < tries; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const rgb = value => (String(value).match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = rgb(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return null; const [a, b] = [lum(rgb(getComputedStyle(node).color).slice(0, 3)), lum(bgOf(node))].sort((x, y) => y - x); return Math.round((a + .05) / (b + .05) * 100) / 100; };
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)}; };
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const users = () => [...document.querySelectorAll('.chat-message-user .chat-message-body')].map(n => n.innerText.trim());
  const mine = () => log.filter(item => item.phase === PHASE);
  const lastAnswer = () => assistants().pop();
  const tools = answerNode => [...(answerNode?.querySelectorAll('.chat-message-actions > button') || [])].map(b => b.getAttribute('aria-label'));
  const locationRow = answerNode => answerNode?.querySelector('.lotbi-location-request-row') || null;
  const rowButtons = answerNode => [...(locationRow(answerNode)?.querySelectorAll('button') || [])].map(b => ({text: b.textContent.trim(), kind: b.dataset.locationRequest, ...box(b)}));
  const sendTyped = async text => {
    const sendButton = document.querySelector('.send-button');
    prompt.value = text; prompt.dispatchEvent(new Event('input', {bubbles: true}));
    await wait(() => !sendButton.disabled, 'composer ready');
    sendButton.click();
  };
  const settle = async count => { await wait(() => assistants().length >= count && !inFlightVisible(), 'answer ' + count); await sleep(500); };
  const inFlightVisible = () => Boolean(document.querySelector('.chat-message-loading'));
  const shot = async name => { if (!SHOTS) return; window.__cauShot = name; await wait(() => window.__cauShotTaken === name, 'shot ' + name, 800); };
  const snapshot = () => ({requests: mine(), users: users(), promptValue: prompt.value, focus: {events: focusEvents, calls: focusCalls},
    activeIsPrompt: document.activeElement === prompt, status: document.querySelector('[data-site-status], #site-status, .site-status')?.textContent?.trim() || ''});
  const result = {ok: true, phase: PHASE};
  const openPharmacy = async () => {
    document.querySelector('[data-consumer-section="life"]').click();
    const shortcut = await wait(() => document.querySelector('[data-life-shortcut="pharmacy"]'), 'pharmacy shortcut');
    shortcut.click();
  };

  if (PHASE === 'clarify' || PHASE === 'reload') {
    if (PHASE === 'clarify') {
      await openPharmacy();
      await settle(1);
    } else {
      await wait(() => document.body.dataset.conversationRestore === 'ready', 'restore');
      await sleep(1200);
    }
    const answerNode = PHASE === 'reload'
      ? assistants().find(node => node.innerText.includes('어느 지역에서 찾을까요?'))
      : lastAnswer();
    result.answerText = answerNode?.querySelector('.chat-message-body')?.innerText?.trim() || '';
    result.rowButtons = rowButtons(answerNode);
    result.tools = tools(answerNode);
    result.rowContrast = [...(locationRow(answerNode)?.querySelectorAll('button') || [])].map(contrast);
    result.viewport = {w: innerWidth, h: innerHeight};
    result.afterFirst = snapshot();
    await shot('where-answer');
    const action = params.get('action') || '';
    if (action === 'current') {
      locationRow(answerNode).querySelector('[data-location-request="current"]').click();
      if (PERM === 'denied') {
        await sleep(800);
      } else {
        await wait(() => mine().length >= 2, 'second question');
        await settle(2);
      }
    } else if (action === 'region') {
      const before = focusEvents + focusCalls;
      locationRow(answerNode).querySelector('[data-location-request="region"]').click();
      const sheet = await wait(() => document.querySelector('.lotbi-sheet .lotbi-region-picker'), 'region picker');
      const province = await wait(() => { const s = sheet.querySelector('[data-region-picker="province"]'); return s && !s.disabled && s.options.length > 1 ? s : null; }, 'provinces');
      result.picker = {
        title: sheet.querySelector('.lotbi-region-picker-title')?.textContent || '',
        provinces: [...province.options].map(o => o.value).filter(Boolean),
        dialog: sheet.closest('.lotbi-sheet')?.getAttribute('role') || '',
        submitDisabledAtStart: sheet.querySelector('[data-region-picker="submit"]').disabled,
        box: box(sheet.closest('.lotbi-sheet')),
        contrast: {
          title: contrast(sheet.querySelector('.lotbi-region-picker-title')),
          note: contrast(sheet.querySelector('.lotbi-region-picker-note')),
          select: contrast(province),
        },
      };
      province.value = '전북특별자치도'; province.dispatchEvent(new Event('change', {bubbles: true}));
      const city = sheet.querySelector('[data-region-picker="city"]');
      result.picker.cities = [...city.options].map(o => o.value).filter(Boolean);
      city.value = '전북특별자치도 전주시'; city.dispatchEvent(new Event('change', {bubbles: true}));
      await shot('region-picker');
      const submit = sheet.querySelector('[data-region-picker="submit"]');
      result.picker.contrast.submit = contrast(submit);
      result.picker.submitEnabled = !submit.disabled;
      submit.click();
      await wait(() => mine().length >= 2, 'region question');
      await settle(2);
      result.picker.closed = !document.querySelector('.lotbi-sheet .lotbi-region-picker');
      result.picker.focusDuring = focusEvents + focusCalls - before;
      result.regionLists = globalThis.__regionLists;
    }
    const after = lastAnswer();
    result.final = snapshot();
    result.finalTools = tools(after);
    result.finalHasRow = Boolean(locationRow(after));
  } else if (PHASE === 'typed') {
    // Typed questions: REGION_AMBIGUOUS and an older Core (no reason) → no buttons.
    await sendTyped(params.get('text'));
    await settle(1);
    result.rowButtons = rowButtons(lastAnswer());
    result.tools = tools(lastAnswer());
  } else if (PHASE === 'place') {
    await sendTyped('전주 가볼만한 관광지 알려줘');
    await settle(1);
    await sleep(400);
    const answerNode = lastAnswer();
    result.categories = [...document.querySelectorAll('.lotbi-place-orbit-card .lotbi-rich-card-source')].map(n => n.textContent.trim());
    await shot('place-answer');
    result.tools = tools(answerNode);
    result.rowButtons = rowButtons(answerNode);
    // #11 on the chat: the safety line is centred under the composer, and a
    // Korean word is laid out on one line.
    const copy = document.querySelector('.chat-safety-copy');
    const composer = copy?.closest('.chat-composer-stack') || copy?.parentElement;
    const range = document.createRange();
    const node = [...copy.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('내용은'));
    const at = node ? node.textContent.indexOf('내용은') : -1;
    if (node && at >= 0) { range.setStart(node, at); range.setEnd(node, at + 3); }
    result.copy = {
      text: copy?.textContent?.trim() || '', box: box(copy), stack: box(composer),
      wordBreak: getComputedStyle(copy).wordBreak, wordLines: node && at >= 0 ? new Set([...range.getClientRects()].map(r => Math.round(r.top))).size : -1,
    };
    result.messageWordBreak = getComputedStyle(answerNode).wordBreak;
    result.bodyWordBreak = getComputedStyle(document.body).wordBreak;
    // A description the width of a phone panel keeps "찾아보세요." whole.
    const probe = document.createElement('p');
    probe.className = 'site-modal-description';
    probe.style.cssText = 'position:absolute;left:0;top:0;width:250px;font-size:14px;visibility:hidden';
    probe.textContent = '내 주변부터 이번 주말·이번 달 전국 축제와 행사를 찾아보세요.';
    document.body.appendChild(probe);
    const tail = probe.firstChild; const end = tail.textContent.indexOf('찾아보세요.');
    const tailRange = document.createRange(); tailRange.setStart(tail, end); tailRange.setEnd(tail, end + 6);
    result.descriptionWordLines = new Set([...tailRange.getClientRects()].map(r => Math.round(r.top))).size;
    probe.remove();
  } else if (PHASE === 'home') {
    await shot('home');
    const examples = [...document.querySelectorAll('.home-example-prompts button')];
    result.examples = examples.map(b => ({text: b.textContent.trim(), prompt: b.dataset.homePrompt || '', opens: b.hasAttribute('data-scam-open'), after: getComputedStyle(b, '::after').content}));
    examples.find(b => b.dataset.homePrompt).click();
    await wait(() => mine().length >= 1, 'example asked');
    await settle(1);
    result.final = snapshot();
  }
  result.theme = document.body.dataset.siteTheme || '';
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="cau-result" hidden>pending</pre>`;
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

const SHOT_DIR = process.env.CONVERSATION_ANSWER_UX_SCREENSHOTS || '';

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url: SHOT_DIR ? `${url}&shots=1` : url});
  const text = await waitFor(async () => {
    if (SHOT_DIR) {
      const pending = await devtools.send('Runtime.evaluate', {expression: "window.__cauShot && window.__cauShot !== window.__cauShotTaken ? window.__cauShot : ''", returnByValue: true}).catch(() => null);
      const name = pending?.result?.value;
      if (name) {
        await new Promise(resolve => setTimeout(resolve, 350));
        const png = await devtools.send('Page.captureScreenshot', {format: 'png'});
        fs.mkdirSync(SHOT_DIR, {recursive: true});
        fs.writeFileSync(path.join(SHOT_DIR, `${label.replace(/[^0-9a-z-]+/giu, '_')}-${name}.png`), Buffer.from(png.data, 'base64'));
        await devtools.send('Runtime.evaluate', {expression: `window.__cauShotTaken = ${JSON.stringify(name)}`});
      }
    }
    const result = await devtools.send('Runtime.evaluate', {
      expression: "document.getElementById('cau-result')?.textContent || 'pending'",
      returnByValue: true,
    }).catch(() => null);
    const value = result?.result?.value;
    return value && value !== 'pending' ? value : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

const PHARMACY = '근처 약국 찾아줘';
const NO_TOOLS_CALENDAR = tools => assert.ok(!tools.includes('캘린더에 추가'), `no 캘린더에 추가: ${JSON.stringify(tools)}`);

function assertQuiet(run, label) {
  assert.equal(run.promptValue, '', `${label}: nothing waits in the composer`);
  assert.equal(run.focus.events + run.focus.calls, 0, `${label}: the composer was never focused ${JSON.stringify(run.focus)}`);
  assert.equal(run.activeIsPrompt, false, `${label}: composer not focused`);
}

function assertRow(run, label, testCase, kinds) {
  assert.deepEqual(run.rowButtons.map(button => button.kind), kinds, `${label}: location buttons ${JSON.stringify(run.rowButtons)}`);
  assert.deepEqual(run.rowButtons.map(button => button.text), kinds.map(kind => (kind === 'current' ? '현재 위치 사용' : '지역 선택')));
  for (const button of run.rowButtons) {
    assert.ok(button.h >= 44, `${label}: ${button.text} touch height ${button.h}`);
    assert.ok(button.x >= 0 && button.right <= run.viewport.w, `${label}: ${button.text} inside the screen`);
  }
  NO_TOOLS_CALENDAR(run.tools);
  assert.ok(run.tools.includes('복사하기'), `${label}: the answer keeps its tools`);
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.conversation-answer-ux-'));
const server = startServer();
const summary = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  for (const testCase of CASES) {
    const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
    const devtools = await openDevtools(browser, profile);
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

      // #7 지역 선택: 약국 → "where?" → region list → one question with the region.
      const region = await runPhase(devtools, page('phase=clarify&perm=prompt&action=region'), `${label}/region`);
      console.log(`CAU ${label} region`, JSON.stringify({rows: region.rowButtons, picker: region.picker, requests: region.final.requests, users: region.final.users}));
      assert.deepEqual(region.afterFirst.requests.map(item => item.text), [PHARMACY], `${label}: one tap sends 약국 once`);
      assert.equal(region.afterFirst.requests[0].location, null, `${label}: the first question went without a location`);
      assert.ok(region.answerText.startsWith('어느 지역에서 찾을까요?'), `${label}: Core asked where`);
      assertRow(region, `${label}/region`, testCase, ['current', 'region']);
      assert.equal(region.picker.title, '지역 선택');
      assert.equal(region.picker.dialog, 'dialog', `${label}: the region list is a dialog`);
      assert.deepEqual(region.picker.provinces, ['세종특별자치시', '전북특별자치도']);
      assert.deepEqual(region.picker.cities, ['전북특별자치도 전주시', '전북특별자치도 익산시']);
      assert.equal(region.picker.submitDisabledAtStart, true, `${label}: nothing picked, nothing to send`);
      assert.equal(region.picker.submitEnabled, true);
      assert.ok(region.picker.box.x >= 0 && region.picker.box.right <= testCase.width, `${label}: the region list inside the screen ${JSON.stringify(region.picker.box)}`);
      assert.deepEqual(region.final.requests.map(item => item.text), [PHARMACY, `전북특별자치도 전주시 ${PHARMACY}`], `${label}: one question with the picked region`);
      assert.equal(region.picker.closed, true, `${label}: the region list closes after the pick`);
      assert.equal(region.regionLists, 1, `${label}: the region list is read once`);
      assert.equal(region.picker.focusDuring, 0, `${label}: picking a region never focuses the composer`);
      assertQuiet(region.final, `${label}/region`);
      assert.equal(region.finalHasRow, false, `${label}: the answer with results has no location buttons`);
      NO_TOOLS_CALENDAR(region.finalTools);

      // Reload: the "where?" answer keeps its buttons; nothing is sent again.
      const reloaded = await runPhase(devtools, page('phase=reload'), `${label}/reload`);
      assert.ok(reloaded.answerText.startsWith('어느 지역에서 찾을까요?'), `${label}: the "where?" answer is restored`);
      assert.deepEqual(reloaded.rowButtons.map(button => button.kind), ['current', 'region'], `${label}: its buttons survive a reload`);
      assert.deepEqual(reloaded.final.requests, [], `${label}: reload sends nothing`);
      assert.equal(reloaded.final.users.length, 2, `${label}: both questions restored once`);
      assertQuiet(reloaded.final, `${label}/reload`);

      if (label === '390' || label === '1280') {
        // #7 현재 위치 사용: the explicit tap lets the browser ask again.
        const current = await runPhase(devtools, page('phase=clarify&perm=prompt&allowSecond=1&action=current'), `${label}/current`);
        console.log(`CAU ${label} current`, JSON.stringify(current.final.requests));
        assert.deepEqual(current.final.requests.map(item => item.text), [PHARMACY, PHARMACY], `${label}: the same question once more`);
        assert.equal(current.final.requests[0].location, null);
        assert.ok(current.final.requests[1].location && Math.abs(current.final.requests[1].location.latitude - 35.812) < 0.01, `${label}: the current location goes along ${JSON.stringify(current.final.requests[1].location)}`);
        assertQuiet(current.final, `${label}/current`);
        assert.equal(current.finalHasRow, false);

        // A browser that blocks location: words, no second question.
        const blocked = await runPhase(devtools, page('phase=clarify&perm=denied&action=current'), `${label}/blocked`);
        assert.deepEqual(blocked.final.requests.map(item => item.text), [PHARMACY], `${label}: blocked location sends nothing more`);
        assertQuiet(blocked.final, `${label}/blocked`);

        // LOTBI location use off: [지역 선택] only.
        const off = await runPhase(devtools, page('phase=clarify&perm=granted&usage=off'), `${label}/usage-off`);
        assertRow(off, `${label}/usage-off`, testCase, ['region']);

        // REGION_AMBIGUOUS and an older Core without a reason: no buttons.
        for (const text of ['중구 근처 약국 찾아줘', '옛 근처 약국 찾아줘']) {
          const typed = await runPhase(devtools, page(`phase=typed&text=${encodeURIComponent(text)}`), `${label}/typed`);
          assert.deepEqual(typed.rowButtons, [], `${label}: ${text} has no location buttons`);
          NO_TOOLS_CALENDAR(typed.tools);
        }

        // #6 home examples ask at once; the screen-opening one shows a chevron.
        const home = await runPhase(devtools, page('phase=home'), `${label}/home`);
        console.log(`CAU ${label} home`, JSON.stringify(home.examples));
        const ask = home.examples.filter(example => example.prompt);
        assert.equal(ask.length, 2);
        assert.deepEqual(home.final.requests.map(item => item.text), [ask[0].prompt], `${label}: an example asks once, at once`);
        assertQuiet(home.final, `${label}/home`);
        const opener = home.examples.find(example => example.opens);
        assert.ok(opener && /\u203A/u.test(opener.after), `${label}: 의심되는 문자 확인 shows it opens a screen (${opener?.after})`);
        assert.ok(ask.every(example => !/\u203A/u.test(example.after)), `${label}: the asking examples have no chevron`);
      }

      // #9, #8, #11: a place answer.
      const placeRun = await runPhase(devtools, page('phase=place'), `${label}/place`);
      console.log(`CAU ${label} place`, JSON.stringify({categories: placeRun.categories, tools: placeRun.tools, copy: placeRun.copy, lines: placeRun.descriptionWordLines}));
      assert.deepEqual([...new Set(placeRun.categories)].sort(), ['관광지', '동물원', '카페·디저트'], `${label}: categories read as their last step`);
      assert.ok(placeRun.categories.every(text => !/[>,]/u.test(text)), `${label}: no raw category path`);
      NO_TOOLS_CALENDAR(placeRun.tools);
      assert.deepEqual(placeRun.rowButtons, [], `${label}: a place answer has no location buttons`);
      assert.equal(placeRun.bodyWordBreak, 'keep-all', `${label}: page text keeps Korean words whole`);
      assert.equal(placeRun.messageWordBreak, 'keep-all', `${label}: chat text keeps Korean words whole`);
      assert.equal(placeRun.copy.wordBreak, 'keep-all');
      assert.equal(placeRun.copy.wordLines, 1, `${label}: "내용은" is not split across lines`);
      assert.equal(placeRun.descriptionWordLines, 1, `${label}: "찾아보세요." is not split across lines`);
      if (testCase.mobile && placeRun.copy.box && placeRun.copy.stack) {
        const left = placeRun.copy.box.x - placeRun.copy.stack.x;
        const right = placeRun.copy.stack.right - placeRun.copy.box.right;
        assert.ok(Math.abs(left - right) <= 3, `${label}: the safety line is centred under the composer (left ${left}, right ${right})`);
      }

      // Dark (다크 in settings): the buttons and the region list stay readable.
      const dark = await runPhase(devtools, page('phase=clarify&perm=prompt&action=region&dark=1'), `${label}/dark`);
      assert.equal(dark.theme, 'dark', `${label}: dark theme applied`);
      for (const value of dark.rowContrast) assert.ok(value >= 4.5, `${label}: dark location button contrast ${value}`);
      for (const [key, value] of Object.entries(dark.picker.contrast)) assert.ok(value >= 4.5, `${label}: dark region list ${key} contrast ${value}`);
      for (const value of region.rowContrast) assert.ok(value >= 4.5, `${label}: light location button contrast ${value}`);
      for (const [key, value] of Object.entries(region.picker.contrast)) assert.ok(value >= 4.5, `${label}: light region list ${key} contrast ${value}`);
      summary.push(`${label}: light ${JSON.stringify(region.picker.contrast)} dark ${JSON.stringify(dark.picker.contrast)} buttons ${region.rowContrast}/${dark.rowContrast}`);
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

for (const line of summary) console.log(`CAU contrast ${line}`);
console.log('CONVERSATION-ANSWER-UX-01 OK — a "where?" answer offers 현재 위치 사용 / 지역 선택 and asks once more without the keyboard; 캘린더에 추가 only with a schedule; place categories read as their last step; home examples ask at once; Korean words wrap whole (viewport emulation, not a device run)');
