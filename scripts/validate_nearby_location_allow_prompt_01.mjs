// NEARBY-LOCATION-ALLOW-PROMPT-01 — the shared 위치 허용 row (site-location-allow.js)
// under a "where?" answer, in a real browser (DevTools protocol, real time)
// against the real index.html with a fake Core, at 360/390 (phone) and 1280
// (a Windows PC), light and dark.
//
// The owner's case: LOTBI 위치 사용 is off, "근처 약국 찾아줘" → Core asks
// "어느 지역에서 찾을까요?" (follow_up.reason LOCATION_REQUIRED). The answer
// offers [위치 허용하고 찾기] [지역 고르기]:
//   - allow: the tap turns LOTBI 위치 사용 on, the browser asks once, and the
//     same question goes again with the (rounded) position — no typing.
//   - blocked browser: no prompt can show; one line on 자물쇠 → 위치 → 허용,
//     nothing sent.
//   - "no" at the prompt: one line and the region list opens.
//   - allowed but no position: Windows 위치 설정 on a PC, 위치 서비스 on a phone.
//   - a rough PC position (5 km): not used at once — "PC 위치는 정확하지 않을 수
//     있어요" stays beside [이 위치로 찾기] [지역 고르기]; a phone uses it as before.
//   - 지역 고르기 on a PC saves the region (Calendar's 저장 지역, MANUAL) and the
//     next nearby question uses it without asking the browser; a phone uses
//     the pick once and saves nothing.
//   - a saved region is offered as "<지역>에서 찾기".
// Every button is at least 48px tall (USER_FIRST_STANDARD 6), the composer is
// never focused, and the row stays readable in dark (≥4.5).
// This is a browser emulation, not an iPhone, Android phone or Windows device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {COARSE_ACCURACY_METERS, LOCATION_ALLOW_OUTCOME, locationOutcomeMessage, requestLocationWithConsent} from '../site-location-allow.js';
import {regionChoicesFromPayload} from '../site-region-picker.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');

// ── Pure contract ──────────────────────────────────────────────────────────
{
  const calls = [];
  const deps = (state, result) => ({
    usageEnabled: () => false,
    enableUsage: () => { calls.push('enable'); },
    permissionState: async () => state,
    resolveCurrent: async options => { calls.push(`ask:${options.allowPrompt}`); return result; },
  });
  let out = await requestLocationWithConsent(deps('PROMPT_REQUIRED', {location: {latitude: 35.81, longitude: 127.12, accuracyMeters: 20}}));
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.LOCATED);
  assert.deepEqual(calls.splice(0), ['enable', 'ask:true'], 'the tap turns location use on, then lets the browser ask');
  out = await requestLocationWithConsent(deps('DENIED', null));
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.BLOCKED);
  assert.deepEqual(calls.splice(0), ['enable'], 'a blocked browser is not asked');
  out = await requestLocationWithConsent(deps('PROMPT_REQUIRED', {permission: 'DENIED', location: null, error: {code: 'BROWSER_LOCATION_DENIED'}}));
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.DENIED);
  out = await requestLocationWithConsent(deps('GRANTED', {permission: 'GRANTED', location: null, error: {code: 'BROWSER_LOCATION_UNAVAILABLE'}}));
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.POSITION_UNAVAILABLE);
  out = await requestLocationWithConsent(deps('GRANTED', {location: {latitude: 35.81, longitude: 127.12, accuracyMeters: COARSE_ACCURACY_METERS + 1}}));
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.COARSE);
  out = await requestLocationWithConsent({...deps('PROMPT_REQUIRED', null), enableUsage: () => { throw new Error('cookie'); }});
  assert.equal(out.outcome, LOCATION_ALLOW_OUTCOME.SETTING_FAILED);
  assert.match(locationOutcomeMessage('POSITION_UNAVAILABLE', {platform: 'WINDOWS'}), /Windows 설정 → 개인 정보 및 보안 → 위치/u);
  assert.match(locationOutcomeMessage('POSITION_UNAVAILABLE', {platform: 'MAC'}), /시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스/u);
  assert.match(locationOutcomeMessage('BLOCKED', {}), /자물쇠 아이콘 → 위치 → 허용/u);
  assert.match(locationOutcomeMessage({outcome: 'COARSE', accuracyMeters: 5200}, {wide: true}), /^PC 위치는 정확하지 않을 수 있어요\(오차 약 5km\)\. 이 위치로 찾거나 지역을 골라 주세요\.$/u);
  assert.equal(locationOutcomeMessage({outcome: 'COARSE', accuracyMeters: 5200}, {wide: false}), '', 'a phone says nothing about a rough position');
  assert.equal(locationOutcomeMessage('LOCATED', {}), '');
}
const REGIONS = {
  items: [
    {code: 'R1', label: '전주시', province: '전북특별자치도', latitude: 35.82, longitude: 127.15},
    {code: 'R2', label: '익산시', province: '전북특별자치도', latitude: 35.95, longitude: 126.96},
    {code: 'R3', label: '세종특별자치시', province: '세종특별자치시', latitude: 36.48, longitude: 127.29},
  ],
  provinces: ['세종특별자치시', '전북특별자치도'],
  ai_calls: 0,
};
{
  const choices = regionChoicesFromPayload(REGIONS);
  const jeonju = choices.byProvince.get('전북특별자치도')[0];
  assert.deepEqual({name: jeonju.name, latitude: jeonju.latitude, longitude: jeonju.longitude}, {name: '전북특별자치도 전주시', latitude: 35.82, longitude: 127.15}, 'a pick carries the list coordinates');
  assert.ok(Number.isNaN(regionChoicesFromPayload({items: [{label: '가', province: '나'}]}).byProvince.get('나')[0].latitude), 'no coordinates, nothing invented');
}
const conversationSource = read('site-conversation.js');
assert.match(conversationSource, /import\('\.\/site-location-allow\.js\?v=aset-[0-9a-f]{12}'\)/u, 'the row loads only with a "where?" answer');
assert.doesNotMatch(conversationSource, /^import [^\n]*site-location-allow/mu, 'no new module in the first bundle');
const allowSource = read('site-location-allow.js');
assert.doesNotMatch(allowSource, /localStorage|sessionStorage|indexedDB/u, 'the row itself stores nothing; the saved region goes through site-calendar-weather-region.js');
assert.match(allowSource, /resolveCurrent\(\{allowPrompt: true\}\)/u, 'only the tap may show the browser prompt');

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
  throw new Error('Chrome/Chromium is required for the nearby location allow validation.');
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '360', width: 360, height: 800, mobile: true, userAgent: MOBILE_UA},
  {label: '390', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: '1280', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

const PHARMACIES = {
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_1a2b3c4d5e6f70819a0b',
  provider_code: 'NAVER', source: 'NAVER_LOCAL_SEARCH', query: '근처 약국',
  results: [1, 2].map(index => ({
    result_id: `place-${index}`, place_id: `naver:nla:${index}`, name: `가상${index}약국`, category: '약국',
    road_address: `전북특별자치도 전주시 완산구 기린대로 ${90 + index}`,
    latitude: 35.81 + index / 1000, longitude: 127.15 + index / 1000,
    coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
    phone: null, phone_verified: false, image_url: null, photo_evidence: null,
  })),
};

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const REGIONS = ${JSON.stringify(REGIONS)};
const PHARMACIES = ${JSON.stringify(PHARMACIES)};
const out = document.getElementById('nla-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 80000);
const params = new URLSearchParams(location.search);
const PHASE = params.get('phase');
const SHOTS = params.get('shots') === '1';
const GEO = params.get('geo') || 'allow';
const ACCURACY = Number(params.get('acc') || 20);
let permission = params.get('perm') || 'prompt';
try {
  localStorage.clear();
  document.cookie = 'lotbi_location_usage_v1=; Path=/; Max-Age=0';
  if (params.get('usage') === 'off') document.cookie = 'lotbi_location_usage_v1=off; Path=/';
  document.cookie = 'lotbi_theme_preference_v1=; Path=/; Max-Age=0';
  if (params.get('dark') === '1') document.cookie = 'lotbi_theme_preference_v1=dark; Path=/';
  if (params.get('saved') === '1') {
    localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전북특별자치도 전주시', latitude: 35.82, longitude: 127.15, midRegionCode: null}));
  }
  // The browser: a permission state and what happens when it is asked.
  globalThis.__geoAsks = 0;
  Object.defineProperty(navigator, 'permissions', {configurable: true, value: {query: async () => ({state: permission, onchange: null, addEventListener() {}, removeEventListener() {}})}});
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: (ok, bad) => {
      globalThis.__geoAsks += 1;
      setTimeout(() => {
        if (permission === 'denied') return bad({code: 1, message: 'denied', PERMISSION_DENIED: 1});
        if (GEO === 'deny') { permission = 'denied'; return bad({code: 1, message: 'denied', PERMISSION_DENIED: 1}); }
        permission = 'granted';
        if (GEO === 'unavailable') return bad({code: 2, message: 'unavailable', POSITION_UNAVAILABLE: 2});
        ok({coords: {latitude: 35.8123, longitude: 127.1234, accuracy: ACCURACY}, timestamp: Date.now()});
      }, 30);
    },
    watchPosition: () => 1, clearWatch() {},
  }});
  const sent = [];
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
  const base = {contract_id:'CORE-WEB-CHAT-01',schema_version:1,retry_safe:true,
    safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false}};
  const where = () => ({...base, status:'FOLLOW_UP_REQUIRED', response_mode:'MEDICAL_CLARIFICATION', correlation_id:'corr_nla_ask_' + sent.length,
    assistant_text:'어느 지역에서 찾을까요? 시·군·구 이름(예: 전주시 완산구)을 알려주시거나 위치 사용을 허용해 주세요.',
    intent:{action:'MEDICAL_SEARCH', domain:'LIFE_MEDICAL', kind:'PHARMACY', clarification:'LOCATION_REQUIRED'},
    follow_up:{required:true, action:'MEDICAL_SEARCH', automatic_execution:false, reason:'LOCATION_REQUIRED'}});
  const found = () => ({...base, status:'ANSWERED', response_mode:'MEDICAL_PROVIDER_READONLY', correlation_id:'corr_nla_' + sent.length,
    assistant_text:'근처 약국 2곳을 찾았어요.', intent:{action:'MEDICAL_SEARCH'}, follow_up:{required:false, action:'MEDICAL_SEARCH', automatic_execution:false},
    place_result: PHARMACIES});
  globalThis.__regionLists = 0;
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/life/weather/regions') { globalThis.__regionLists += 1; return json(REGIONS); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init.body);
      const at = body.client_context?.location || null;
      sent.push({text: body.text, location: at});
      await new Promise(r => setTimeout(r, 120));
      return json(!at && !/전주시|세종/.test(String(body.text || '')) ? where() : found());
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const prompt = document.getElementById('lotbi-prompt');
  let focusEvents = 0;
  prompt.addEventListener('focus', () => { focusEvents += 1; });
  const conversation = await import('/site-conversation.js?v=nla');
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
  const settle = async count => { await wait(() => assistants().length >= count && !document.querySelector('.chat-message-loading'), 'answer ' + count); await sleep(500); };
  const shot = async name => { if (!SHOTS) return; window.__nlaShot = name; await wait(() => window.__nlaShotTaken === name, 'shot ' + name, 800); };
  const rowOf = node => node?.querySelector('.lotbi-location-request-row .lotbi-location-allow') || null;
  const readRow = node => {
    const row = rowOf(node);
    const note = row?.querySelector('.lotbi-location-allow-note');
    return {
      buttons: [...(row?.querySelectorAll('button') || [])].map(b => ({kind: b.dataset.locationRequest, text: b.textContent.trim(), contrast: contrast(b), ...box(b)})),
      note: note && !note.hidden ? note.textContent.trim() : '',
      noteContrast: note && !note.hidden ? contrast(note) : null,
    };
  };
  const tap = async node => {
    node.scrollIntoView({block: 'center'});
    await sleep(80);
    node.click();
    result.taps += 1;
  };
  const result = {ok: true, phase: PHASE, taps: 0, viewport: {w: innerWidth, h: innerHeight}};
  const snapshot = () => ({
    sent: sent.slice(), geoAsks: globalThis.__geoAsks, usageCookie: (document.cookie.match(/lotbi_location_usage_v1=(on|off)/) || [])[1] || '',
    saved: JSON.parse(localStorage.getItem('lotbi.calendar.weather-region.v1') || 'null'),
    savedOrigin: localStorage.getItem('lotbi.calendar.weather-region-origin.v1'),
    focusEvents, promptValue: prompt.value, activeIsPrompt: document.activeElement === prompt,
    pickerOpen: Boolean(document.querySelector('.lotbi-sheet .lotbi-region-picker')),
    regionFocused: document.activeElement?.dataset?.locationRequest === 'region',
    regionLists: globalThis.__regionLists,
    lastAnswer: assistants().pop()?.querySelector('.chat-message-body')?.innerText?.trim() || '',
    cards: document.querySelectorAll('.lotbi-place-orbit-card').length,
  });
  // Chips: 시·도 then 시·군, which asks at once (no dropdown, nothing to confirm).
  const pickJeonju = async () => {
    const sheet = await wait(() => document.querySelector('.lotbi-sheet .lotbi-region-picker'), 'region picker');
    await wait(() => sheet.querySelector('[data-region-province]'), 'province chips');
    result.pickerSaved = sheet.querySelector('[data-region-saved]')?.textContent || '';
    result.pickerSelects = sheet.querySelectorAll('select').length;
    await tap(sheet.querySelector('[data-region-province="전북특별자치도"]'));
    await wait(() => sheet.querySelector('[data-region-city]'), 'city chips');
    await shot('picker');
    result.pickerSizes = [...sheet.querySelectorAll('button:not([hidden])')].map(n => box(n).h);
    await tap(sheet.querySelector('[data-region-city="전북특별자치도 전주시"]'));
  };

  // LIFE-MEDICAL-MERGE-01 (SITE-T56): 생활정보's 병원·응급실·약국 card opens its own
  // list screen and sends nothing, so the question is typed — "근처 약국 찾아줘"
  // unless the phase names another. A PC puts the cursor back in the composer
  // when a typed turn ends (CHAT-MOBILE-KEYBOARD-DISMISS-01); that is recorded
  // apart, and "the composer was never focused" counts from the "where?" answer
  // on — what the 위치 허용 row does.
  prompt.value = PHASE === 'typed' ? params.get('text') : '근처 약국 찾아줘';
  prompt.dispatchEvent(new Event('input', {bubbles: true}));
  await wait(() => !document.querySelector('.send-button').disabled, 'composer ready');
  document.querySelector('.send-button').click();
  result.taps += 1;
  await settle(1);
  const answer = assistants().pop();
  await wait(() => rowOf(answer)?.querySelector('button'), 'location row');
  result.typedEntry = {promptValue: prompt.value, activeIsPrompt: document.activeElement === prompt};
  if (document.activeElement === prompt) prompt.blur();
  focusEvents = 0;
  result.first = snapshot();
  result.row = readRow(answer);
  await shot('where');
  const action = params.get('action') || '';
  if (action) {
    await tap(rowOf(answer).querySelector(\`[data-location-request="\${action}"]\`));
    if (params.get('expect') === 'confirm') {
      // A rough PC position: the line and the two choices wait for the person.
      await wait(() => readRow(answer).note.startsWith('PC 위치는'), 'rough position line');
      await sleep(400);
      result.waiting = {row: readRow(answer), sent: sent.length};
      await shot('rough');
      await tap(rowOf(answer).querySelector('[data-location-request="current"]'));
      await wait(() => sent.length >= 2, 'second question');
      await settle(2);
    } else if (params.get('expect') === 'send') {
      await wait(() => sent.length >= 2, 'second question');
      await settle(2);
    } else if (params.get('expect') === 'picker') {
      await wait(() => document.querySelector('.lotbi-sheet .lotbi-region-picker'), 'region picker opens');
      result.noteBeforePick = readRow(answer).note;
      await pickJeonju();
      await wait(() => sent.length >= 2, 'region question');
      await settle(2);
    } else {
      await sleep(900);
    }
    result.afterRow = readRow(answer);
    await shot('after');
  }
  if (params.get('then')) {
    // Typed by hand next (a PC puts focus back in the composer after a typed send).
    result.beforeThen = snapshot();
    prompt.value = params.get('then'); prompt.dispatchEvent(new Event('input', {bubbles: true}));
    await wait(() => !document.querySelector('.send-button').disabled, 'composer ready');
    document.querySelector('.send-button').click();
    await wait(() => sent.length >= 3, 'next question');
    await settle(3);
  }
  result.final = snapshot();
  result.theme = document.body.dataset.siteTheme || '';
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="nla-result" hidden>pending</pre>`;
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

const SHOT_DIR = process.env.NEARBY_LOCATION_ALLOW_SCREENSHOTS || '';

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url: SHOT_DIR ? `${url}&shots=1` : url});
  const text = await waitFor(async () => {
    if (SHOT_DIR) {
      const pendingShot = await devtools.send('Runtime.evaluate', {expression: "window.__nlaShot && window.__nlaShot !== window.__nlaShotTaken ? window.__nlaShot : ''", returnByValue: true}).catch(() => null);
      const name = pendingShot?.result?.value;
      if (name) {
        await new Promise(resolve => setTimeout(resolve, 350));
        const png = await devtools.send('Page.captureScreenshot', {format: 'png'});
        fs.mkdirSync(SHOT_DIR, {recursive: true});
        fs.writeFileSync(path.join(SHOT_DIR, `${label.replace(/[^0-9a-z-]+/giu, '_')}-${name}.png`), Buffer.from(png.data, 'base64'));
        await devtools.send('Runtime.evaluate', {expression: `window.__nlaShotTaken = ${JSON.stringify(name)}`});
      }
    }
    const value = await devtools.send('Runtime.evaluate', {expression: "document.getElementById('nla-result')?.textContent || 'pending'", returnByValue: true}).catch(() => null);
    const raw = value?.result?.value;
    return raw && raw !== 'pending' ? raw : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

const PHARMACY = '근처 약국 찾아줘';

function assertQuiet(run, label) {
  assert.equal(run.promptValue, '', `${label}: nothing waits in the composer`);
  assert.equal(run.focusEvents, 0, `${label}: the composer was never focused`);
  assert.equal(run.activeIsPrompt, false, `${label}: composer not focused`);
}

function assertButtons(run, label, testCase, expected) {
  assert.deepEqual(run.row.buttons.map(button => [button.kind, button.text]), expected, `${label}: buttons ${JSON.stringify(run.row.buttons)}`);
  for (const button of run.row.buttons) {
    assert.ok(button.h >= 48, `${label}: ${button.text} is ${button.h}px tall (USER_FIRST_STANDARD 6: 48)`);
    assert.ok(button.x >= 0 && button.right <= testCase.width, `${label}: ${button.text} inside the screen`);
  }
  const [allow, region] = run.row.buttons;
  // Side by side at the same weight: same height, same row.
  assert.equal(allow.h, region.h, `${label}: 위치 허용 and 지역 고르기 the same height`);
  assert.equal(allow.y, region.y, `${label}: 위치 허용 and 지역 고르기 on one line`);
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.nearby-location-allow-'));
const server = startServer();
const scenarios = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  for (const testCase of CASES) {
    const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
    const devtools = await openDevtools(browser, profile);
    const label = testCase.label;
    const pc = !testCase.mobile;
    try {
      await devtools.send('Page.enable');
      await devtools.send('Runtime.enable');
      await devtools.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
      await devtools.send('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
      if (testCase.mobile) await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
      await devtools.send('Emulation.setFocusEmulationEnabled', {enabled: true});
      await devtools.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
      const page = query => `${origin}/${innerRel}?${query}`;

      // 1. The owner's case: 위치 사용 off → allow → the same question with the position.
      const allow = await runPhase(devtools, page('phase=ask&usage=off&perm=prompt&geo=allow&action=current&expect=send'), `${label}/allow`);
      assert.deepEqual(allow.first.sent, [{text: PHARMACY, location: null}], `${label}: 위치 사용 off sends no position`);
      assert.equal(allow.typedEntry.promptValue, '', `${label}: the typed question leaves the composer`);
      assert.equal(allow.first.geoAsks, 0, `${label}: the browser is not asked before the tap`);
      assert.match(allow.first.lastAnswer, /^어느 지역에서 찾을까요\?/u);
      assertButtons(allow, `${label}/allow`, testCase, [['current', '위치 허용하고 찾기'], ['region', '지역 고르기']]);
      assert.equal(allow.final.usageCookie, 'on', `${label}: the tap turned LOTBI 위치 사용 on`);
      assert.equal(allow.final.geoAsks, 1, `${label}: the browser asked once`);
      assert.deepEqual(allow.final.sent.map(item => item.text), [PHARMACY, PHARMACY], `${label}: the same question again, nothing typed`);
      assert.deepEqual(allow.final.sent[1].location, {latitude: 35.812, longitude: 127.123, source: 'BROWSER_CURRENT'}, `${label}: the rounded position goes with it`);
      assert.equal(allow.final.lastAnswer, '근처 약국 2곳을 찾았어요.');
      assert.ok(allow.final.cards >= 2, `${label}: the cards show`);
      assert.equal(allow.afterRow.note, '', `${label}: nothing to say when it worked`);
      assert.equal(allow.final.saved, null, `${label}: a position is never saved`);
      assertQuiet(allow.final, `${label}/allow`);
      scenarios.push({label, name: '위치 꺼짐 → 허용하고 찾기', taps: allow.taps + 1, result: allow.final.lastAnswer});

      // 2. A browser that blocked location: where to unblock it, nothing sent.
      const blocked = await runPhase(devtools, page('phase=ask&usage=off&perm=denied&action=current'), `${label}/blocked`);
      assert.match(blocked.afterRow.note, /자물쇠 아이콘 → 위치 → 허용/u, `${label}: blocked → 자물쇠 (${blocked.afterRow.note})`);
      assert.equal(blocked.final.geoAsks, 0, `${label}: a blocked browser is not asked`);
      assert.deepEqual(blocked.final.sent.map(item => item.text), [PHARMACY], `${label}: nothing more is sent`);
      assert.equal(blocked.final.regionFocused, true, `${label}: 지역 고르기 is next`);
      assertQuiet(blocked.final, `${label}/blocked`);

      // 3. "No" at the prompt: one line, and the region list opens at once.
      const denied = await runPhase(devtools, page('phase=ask&usage=off&perm=prompt&geo=deny&action=current&expect=picker'), `${label}/denied`);
      assert.match(denied.noteBeforePick, /^위치를 허용하지 않았어요\. 지역을 골라 주세요\./u, `${label}: denied (${denied.noteBeforePick})`);
      assert.deepEqual(denied.final.sent.map(item => item.text), [PHARMACY, `전북특별자치도 전주시 ${PHARMACY}`], `${label}: the picked region asks once`);
      assert.equal(denied.final.pickerOpen, false, `${label}: the list closes after the pick`);
      assertQuiet(denied.final, `${label}/denied`);
      scenarios.push({label, name: '위치 거부 → 지역 고르기', taps: denied.taps + 1, result: denied.final.lastAnswer});

      // 4. Allowed but no position: a PC with its location service off.
      const unavailable = await runPhase(devtools, page('phase=ask&perm=granted&geo=unavailable&action=current'), `${label}/unavailable`);
      assert.deepEqual(unavailable.first.sent, [{text: PHARMACY, location: null}], `${label}: no position, nothing invented`);
      assertButtons(unavailable, `${label}/unavailable`, testCase, [['current', '현재 위치로 찾기'], ['region', '지역 고르기']]);
      if (pc) assert.match(unavailable.afterRow.note, /Windows 설정 → 개인 정보 및 보안 → 위치/u, `${label}: Windows 위치 (${unavailable.afterRow.note})`);
      else assert.match(unavailable.afterRow.note, /기기의 위치 서비스를 켜거나 지역을 골라 주세요/u, `${label}: phone 위치 서비스 (${unavailable.afterRow.note})`);
      assert.deepEqual(unavailable.final.sent.map(item => item.text), [PHARMACY], `${label}: nothing more is sent`);

      // 5. A rough position (5 km): a PC says so and waits for the choice; a phone uses it.
      const coarse = await runPhase(devtools, page(`phase=ask&usage=off&perm=prompt&geo=allow&acc=5000&action=current&expect=${pc ? 'confirm' : 'send'}`), `${label}/coarse`);
      if (pc) {
        assert.equal(coarse.waiting.sent, 1, `${label}: a rough PC position is not used before the choice`);
        assert.equal(coarse.waiting.row.note, 'PC 위치는 정확하지 않을 수 있어요(오차 약 5km). 이 위치로 찾거나 지역을 골라 주세요.', `${label}: PC accuracy line`);
        assert.deepEqual(coarse.waiting.row.buttons.map(button => button.text), ['이 위치로 찾기', '지역 고르기'], `${label}: the two choices`);
        assert.equal(coarse.final.geoAsks, 1, `${label}: 이 위치로 찾기 uses the position already read`);
        scenarios.push({label, name: 'PC 위치 오차 큼 → 안내 → 이 위치로 찾기', taps: coarse.taps + 1, result: coarse.final.lastAnswer});
      } else {
        assert.equal(coarse.afterRow.note, '', `${label}: phones keep their behavior`);
      }
      assert.deepEqual(coarse.final.sent.map(item => item.text), [PHARMACY, PHARMACY], `${label}: then the same question with the position`);
      assert.equal(coarse.afterRow.note, '', `${label}: the line goes once the choice is made`);

      // 6. 지역 고르기: a PC keeps the region and uses it next time without asking the browser.
      const picked = await runPhase(devtools, page(`phase=ask&perm=granted&geo=unavailable&action=region&expect=picker&then=${encodeURIComponent('근처 병원 찾아줘')}`), `${label}/picked`);
      assert.deepEqual(picked.final.sent.slice(0, 2).map(item => item.text), [PHARMACY, `전북특별자치도 전주시 ${PHARMACY}`]);
      assert.ok(picked.pickerSizes.every(height => height >= 48), `${label}: region list controls ${picked.pickerSizes}`);
      assert.equal(picked.pickerSelects, 0, `${label}: chips, no dropdown`);
      if (pc) {
        assert.deepEqual(picked.final.saved, {label: '전북특별자치도 전주시', latitude: 35.82, longitude: 127.15, midRegionCode: null}, `${label}: a PC saves the picked region`);
        assert.equal(picked.final.savedOrigin, 'MANUAL');
        assert.match(picked.afterRow.note, /전북특별자치도 전주시을\(를\) 내 지역으로 저장했어요/u);
        assert.deepEqual(picked.final.sent[2].location, {latitude: 35.82, longitude: 127.15, source: 'SAVED_REGION', label: '전북특별자치도 전주시'}, `${label}: next time the saved region goes, not a PC guess`);
        assert.equal(picked.final.geoAsks, picked.first.geoAsks, `${label}: the browser is not asked again on a PC with a picked region`);
        scenarios.push({label, name: 'PC 지역 고르기 → 저장 → 다음 질문 자동', taps: picked.taps, result: picked.final.lastAnswer});
      } else {
        assert.equal(picked.final.saved, null, `${label}: a phone uses the pick once and saves nothing`);
        assert.equal(picked.afterRow.note, '');
      }
      assertQuiet(picked.beforeThen, `${label}/picked`);

      // 7. A saved region is offered as "<지역>에서 찾기".
      const chip = await runPhase(devtools, page(`phase=typed&usage=off&saved=1&text=${encodeURIComponent('약국 찾아줘')}&action=saved&expect=send`), `${label}/saved`);
      assertButtons(chip, `${label}/saved`, testCase, [['current', '위치 허용하고 찾기'], ['region', '지역 고르기'], ['saved', '전북특별자치도 전주시에서 찾기']]);
      assert.deepEqual(chip.final.sent.map(item => item.text), ['약국 찾아줘', '전북특별자치도 전주시 약국 찾아줘'], `${label}: the saved region asks at once`);
      assert.equal(chip.final.geoAsks, 0, `${label}: no browser prompt for the saved region`);
      scenarios.push({label, name: '저장 지역 칩 → 바로 찾기', taps: chip.taps, result: chip.final.lastAnswer});

      // Dark: the row and its line stay readable.
      const dark = await runPhase(devtools, page('phase=ask&usage=off&perm=denied&action=current&dark=1'), `${label}/dark`);
      assert.equal(dark.theme, 'dark');
      for (const button of dark.afterRow.buttons) assert.ok(button.contrast >= 4.5, `${label}: dark ${button.text} contrast ${button.contrast}`);
      assert.ok(dark.afterRow.noteContrast >= 4.5, `${label}: dark note contrast ${dark.afterRow.noteContrast}`);
      for (const button of blocked.afterRow.buttons) assert.ok(button.contrast >= 4.5, `${label}: light ${button.text} contrast ${button.contrast}`);
      assert.ok(blocked.afterRow.noteContrast >= 4.5, `${label}: light note contrast ${blocked.afterRow.noteContrast}`);
      console.log(`NLA ${label} OK`, JSON.stringify({allow: allow.final.sent[1], picked: picked.final.saved, notes: [blocked.afterRow.note, unavailable.afterRow.note, coarse.afterRow.note]}));
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

// Taps count the person's own taps; the browser's 허용 / 차단 answer counts as one where it asks.
for (const scenario of scenarios) console.log(`NLA scenario ${scenario.label} ${scenario.name}: ${scenario.taps} taps → ${scenario.result}`);
console.log('NEARBY-LOCATION-ALLOW-PROMPT-01 OK — a "where?" answer offers 위치 허용하고 찾기 even with location use off (tap → setting on → browser → same question with the position), blocked → 자물쇠, denied → region list, PC: Windows 위치 / accuracy line / a picked region saved and used next time; 48px buttons; dark ≥4.5 (viewport emulation, not a device run)');
