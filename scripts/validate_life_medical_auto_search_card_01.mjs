// LIFE-MEDICAL-AUTO-SEARCH-CARD-01 — 생활정보 병원·약국·응급실 자동 검색과
// 회전형 의료 카드.
//
// 계약:
//  - 생활정보 → 병원·의원 / 약국 / 응급실: 입력 화면 없이 한 번 눌러 바로
//    전송된다(질문 1건, 요청 1건). 입력창은 비어 있고 포커스·키보드가 없다.
//  - 위치: 위치 사용 + 권한 허용이면 현재 위치, 아니면 저장 지역, 둘 다 없으면
//    아무것도 보내지 않는다(Core 가 지역을 묻는다). 권한은 한 페이지에서 한 번만 묻는다.
//  - 답변은 Core 의 한 문장 그대로. 카드: 가운데 카드가 가장 크고 휴대폰에서는
//    양옆 카드 끝이 보인다. 스와이프·1/3·최대 3곳·"다른 … 보기"·한 장이면 회전 표시 없음.
//  - 전화·지도: 원형 44px 버튼 두 개, 22px 선 아이콘, 이름 "전화하기"·"길찾기".
//  - 카드 안 한 줄: "실제 … 여부는 전화로 확인"(응급실: "수용 여부는 출발 전 전화로 확인").
//  - 일반 응급실 검색: 119 박스 없음. 응급 증상 메시지(CALL_119): 작은 119 버튼 하나.
//  - 약국 결과 아래 보조 조건(지금 운영 중·야간·휴일·24시간)도 바로 전송, 키보드 없음.
//  - 새로고침·뒤로가기로 같은 질문이 다시 전송되지 않는다.
//  - 라이트·다크 모두 버튼이 보인다. 320~412px·1280px 에서 가로 스크롤 없음.
//
// 브라우저: DevTools 프로토콜로 실제 터치/마우스 입력. 화면 크기·UA 에뮬레이션일
// 뿐 Samsung Internet / Android Chrome / iPhone Safari 실기기 결과가 아니다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_MEDICAL_QUESTIONS, LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {lifeLocationIntent, resetLifeLocationPromptMemory, resolveLifeLocationContext} from '../site-life-location.js';
import {createEmergencyCallNotice, medicalStatusLines} from '../site-life-medical.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
// REGIONAL-INFO-APPROVED-UX-RESTORE-P0: one 병원·응급실 card (병원·의원 찾기 / 응급실
// 찾기 ask the same questions), 약국 its own card, eight cards with 전북 맛집·음식;
// EV-CHARGER-NEARBY-LIST-P0 adds 전기차 충전소 right after 약국 (nine).
assert.deepEqual(LIFE_SHORTCUTS.map(item => item.label), ['병원·응급실', '약국', '전기차 충전소', '축제·행사', '지역뉴스', '온누리상품권', '지역생활정보', '전북 맛집·음식', '내 아이 학교·유치원']);
assert.deepEqual(LIFE_SHORTCUTS.find(item => item.id === 'medical').choices.map(choice => choice.id), ['hospital', 'emergency']);
assert.deepEqual(LIFE_MEDICAL_QUESTIONS, {hospital: '근처 병원 찾아줘', pharmacy: '근처 약국 찾아줘', emergency: '근처 응급실 찾아줘'});
for (const question of Object.values(LIFE_MEDICAL_QUESTIONS)) {
  assert.equal(lifeLocationIntent(question), true, `${question} reaches the life-location contract`);
}
// LIFE-DIRECT-CHAT-CARD-COMPACTION-01: 유치원·학교 asks through onAsk as well,
// so no life screen drafts its question any more.
const sectionsSource = read('site-consumer-sections.js');
assert.match(sectionsSource, /mountEducation\(\{root: host, onAsk, accountId\}\)/u, '유치원·학교 asks through onAsk');
assert.doesNotMatch(sectionsSource, /질문 준비하기|onDraft|openMedicalDetail|data-medical-field|LIFE_MEDICAL_FORMS/u, 'no medical form or draft handoff left');
assert.doesNotMatch(sectionsSource, /\bfetch\(|geolocation|getCurrentPosition/u, 'the menu does not search or ask for a location itself');
const conversation = read('site-conversation.js');
// The old draft-then-send path is gone: no draft helper, no onDraft handoff;
// onAsk sends.
assert.doesNotMatch(conversation, /요청을 입력창에 넣었어요|draft\(text\)|onDraft/u, 'no draft handoff left');
const consumerMountAt = conversation.indexOf('mounted = mountConsumerSection({');
assert.ok(consumerMountAt >= 0, 'the 생활정보 surface is mounted from the conversation');
const onAskHandler = conversation.slice(consumerMountAt).match(/onAsk: text => \{[\s\S]*?\n {6}\},/u)?.[0] || '';
assert.match(onAskHandler, /askWithoutKeyboard\(text\);/u, 'the life cards ask at once');
assert.doesNotMatch(onAskHandler, /draft\(|입력창에 넣었어요/u, 'the life cards never draft');
assert.match(conversation, /requestAssistant\(question, true, '', 0, \{keepComposerClosed: true\}\)/u);

// The browser asks for permission at most once per page.
{
  resetLifeLocationPromptMemory();
  const asked = [];
  const resolveCurrent = async ({allowPrompt}) => { asked.push(allowPrompt); return {location: null}; };
  const options = {resolveCurrent, readSavedRegion: () => null, locationUsageEnabled: () => true, timeoutMs: 200};
  assert.equal(await resolveLifeLocationContext('근처 약국 찾아줘', options), null);
  assert.equal(await resolveLifeLocationContext('근처 병원 찾아줘', options), null);
  assert.equal(await resolveLifeLocationContext('지금 문 연 근처 약국 찾아줘', options), null);
  assert.deepEqual(asked, [true, false, false], 'one permission prompt per page');
  const saved = await resolveLifeLocationContext('근처 약국 찾아줘', {...options, readSavedRegion: () => ({label: '전주시 완산구', latitude: 35.81, longitude: 127.12})});
  assert.deepEqual(saved, {latitude: 35.81, longitude: 127.12, source: 'SAVED_REGION', label: '전주시 완산구'}, 'saved region after no position');
  resetLifeLocationPromptMemory();
}

// Card lines: registered hours, one short confirm line, never a promise.
{
  const pharmacy = {medicalStatus: {kind: 'PHARMACY', openState: 'OPEN', hoursLabel: '오늘 09:00~22:00', holidayUnverified: true}};
  assert.deepEqual(medicalStatusLines(pharmacy).map(line => line.text), ['등록 시간상 운영 중 · 오늘 09:00~22:00', '실제 운영 여부는 전화로 확인 · 공휴일 미반영']);
  const clinic = {medicalStatus: {kind: 'HOSPITAL', openState: 'CLOSED', hoursLabel: '오늘 09:00~18:00', holidayUnverified: false}};
  assert.deepEqual(medicalStatusLines(clinic, {partial: true}).map(line => line.text), ['등록 시간상 진료 종료 · 오늘 09:00~18:00', '실제 진료 여부는 전화로 확인 · 일부 기관만 확인']);
  const er = {emergencyStatus: {realtimeState: 'UNAVAILABLE', updatedAtLabel: '', beds: [], messages: []}};
  assert.deepEqual(medicalStatusLines(er).map(line => line.text), ['실시간 병상 정보 없음', '수용 여부는 출발 전 전화로 확인']);
}

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
  throw new Error('Chrome/Chromium is required for the life medical auto search validation.');
}

const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'samsung-320x700', width: 320, height: 700, mobile: true, userAgent: SAMSUNG_UA, full: true},
  {label: 'android-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA},
  {label: 'iphone-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'iphone-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, theme: 'dark'},
  {label: 'samsung-412x915', width: 412, height: 915, mobile: true, userAgent: SAMSUNG_UA, location: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: 'dark'},
];

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('lmas-result');
try {
  const params = new URLSearchParams(location.search);
  // A reload keeps the conversation (and the stored turns) of this page.
  if (!sessionStorage.getItem('lmas-started')) { localStorage.clear(); sessionStorage.setItem('lmas-started', '1'); }
  if (params.get('theme')) document.cookie = 'lotbi_theme_preference_v1=' + params.get('theme') + '; Path=/';
  if (params.get('saved')) localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전주시 완산구', latitude: 35.812, longitude: 127.119}));
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.__sent = [];
  globalThis.__promptFocus = 0;
  const row = (index, kind, name, distance) => ({
    result_id: 'place-' + index, place_id: 'nmc:' + kind[0] + index, name, category: {PHARMACY:'약국',HOSPITAL:'의원',EMERGENCY:'종합병원'}[kind],
    address: '전북특별자치도 전주시 완산구 효자로 ' + (100 + index * 37) + ' (효자동' + index + '가)',
    road_address: '전북특별자치도 전주시 완산구 효자로 ' + (100 + index * 37) + ' (효자동' + index + '가)',
    latitude: 35.81 + index / 1000, longitude: 127.12, coordinate_system: 'WGS84', coordinate_authority: 'NMC_OFFICIAL',
    navigation_capability: true, phone: '063-222-10' + index + '0', phone_verified: true,
    phone_evidence: {source: 'NMC_E_GEN', verification_state: 'OFFICIAL_REGISTRY'}, image_url: null, distance_meters: distance,
    ...(kind === 'EMERGENCY'
      ? {emergency_status: {er_operating: true, realtime_state: index === 1 ? 'FRESH' : 'UNAVAILABLE', updated_at_label: index === 1 ? '10/09 01:20' : null,
          beds: index === 1 ? [{label: '응급실', available: 4}] : [], equipment: [], severe_acceptance_reported: [], severe_unavailable_reported: [], messages: [], acceptance_guaranteed: false}}
      : {medical_status: {kind, basis: 'NMC_REGISTERED_HOURS', target_label: '지금', open_state: index === 3 ? 'CLOSED' : 'OPEN',
          hours_label: index === 3 ? '오늘 09:00~18:00' : '오늘 09:00~22:00'}}),
  });
  const NAMES = {
    PHARMACY: ['효자온누리약국', '전주바른약국', '서신365약국', '삼천밤늦게약국', '완산새벽약국'],
    HOSPITAL: ['가온내과의원', '전주바른가정의학과의원', '효자연합의원', '우리아이소아청소년과의원', '서원정형외과의원'],
    EMERGENCY: ['전북대학교병원', '전주예수병원', '대자인병원', '전주병원', '엠마오사랑병원'],
  };
  const safety = {execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false};
  // Core 69b7cb23 shapes: one sentence + NMC cards; CALL_119 only for a symptom.
  const answer = body => {
    const text = String(body.text || '');
    if (/지역만/u.test(text)) return {contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'FOLLOW_UP_REQUIRED',
      assistant_text:'어느 지역에서 찾을까요? 시·군·구 이름(예: 전주시 완산구)을 알려주시거나 위치 사용을 허용해 주세요.',
      response_mode:'MEDICAL_CLARIFICATION',correlation_id:'req_lmas000000000001',intent:{action:'MEDICAL_SEARCH',domain:'LIFE_MEDICAL'},
      follow_up:{required:true,action:'MEDICAL_SEARCH',automatic_execution:false},safety,retry_safe:true};
    const kind = /응급/u.test(text) ? 'EMERGENCY' : (/약국/u.test(text) ? 'PHARMACY' : 'HOSPITAL');
    const count = /한 곳/u.test(text) ? 1 : (kind === 'EMERGENCY' ? 5 : 3);
    const symptom = /숨이|의식/u.test(text);
    const results = NAMES[kind].slice(0, count).map((name, i) => row(i + 1, kind, name, 180 + i * 410));
    const word = {PHARMACY: '근처 약국', HOSPITAL: '가까운 병원', EMERGENCY: '근처 응급실'}[kind];
    return {
      contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
      assistant_text:(symptom ? '생명이 위급하거나 응급 증상이 의심되면 지금 바로 119에 전화하세요. ' : '') + word + ' ' + count + '곳을 찾았어요.',
      response_mode:'MEDICAL_PROVIDER_READONLY',correlation_id:'req_lmas000000000002',intent:{action:'MEDICAL_SEARCH',domain:'LIFE_MEDICAL',kind},
      follow_up:{required:false,action:'MEDICAL_SEARCH',automatic_execution:false},safety,
      place_result:{contract_id:'CORE-PLACE-RESULT-01',schema_version:1,
        result_set_id:'plrs_' + ({PHARMACY:'a',HOSPITAL:'b',EMERGENCY:'c'}[kind] + (count === 1 ? 'd' : 'e')).repeat(10),
        provider_code:'NMC',source:'NMC_E_GEN',query:'현재 위치(전북특별자치도 전주시) ' + {PHARMACY:'약국',HOSPITAL:'병원',EMERGENCY:'응급실'}[kind],results},
      medical_result:{contract_id:'CORE-MEDICAL-RESULT-01',schema_version:1,kind,provider_state:'OK',notices:symptom ? ['CALL_119'] : [],coverage:'COMPLETE'},
      retry_safe:true,
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
      return new Promise(resolve => setTimeout(resolve, 250)).then(() => json(answer(body)));
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  // Links in cards are read, not followed (tel:, map apps).
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a');
    if (link && link.closest('.lotbi-place-orbit, .conversation-emergency-call')) { event.preventDefault(); globalThis.__lastLink = link.href; }
  }, true);
  const conversation = await import('/site-conversation.js?v=lmas01');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.getElementById('lotbi-prompt').addEventListener('focus', () => { globalThis.__promptFocus += 1; });
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="lmas-result" hidden>pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Page-side reading of the latest assistant answer and its cards.
const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const prompt = document.getElementById('lotbi-prompt');
  const assistants = [...document.querySelectorAll('.chat-message-assistant')];
  const last = assistants.at(-1);
  const rail = last?.querySelector('.lotbi-place-orbit');
  const cards = rail ? [...rail.querySelectorAll('.lotbi-place-orbit-card')].filter(card => !card.hidden) : [];
  const center = rail?.querySelector('[data-orbit-slot="CENTER"]');
  const actions = center ? [...center.querySelectorAll('.lotbi-rich-card-action')].map(action => ({
    action: action.dataset.action, href: action.getAttribute('href') || '', aria: action.getAttribute('aria-label') || '',
    text: (action.textContent || '').trim(), box: box(action), icon: box(action.querySelector('.lotbi-place-action-icon')),
    iconSrc: action.querySelector('.lotbi-place-action-icon-image')?.getAttribute('src') || '', lineIcon: Boolean(action.querySelector('svg')),
    radius: getComputedStyle(action).borderRadius, bg: getComputedStyle(action).backgroundColor, color: getComputedStyle(action).color,
  })) : [];
  const emergency = last ? [...last.querySelectorAll('.conversation-emergency-call')] : [];
  return {
    viewport: {w: innerWidth, h: innerHeight},
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sent: globalThis.__sent.map(body => body.text),
    locations: globalThis.__sent.map(body => body.client_context?.location || null),
    promptValue: prompt?.value ?? null, promptFocused: document.activeElement === prompt, promptFocusEvents: globalThis.__promptFocus,
    keyboardOpen: document.body.classList.contains('mobile-keyboard-open'),
    surfaceOpen: Boolean(document.querySelector('.consumer-workspace')),
    userMessages: [...document.querySelectorAll('.chat-message-user')].map(node => node.textContent.trim()),
    answers: assistants.map(node => (node.querySelector('.chat-message-text, p')?.textContent || '').trim()),
    rail: rail ? {box: box(rail), count: rail.dataset.cardCount, position: rail.querySelector('.lotbi-place-orbit-position')?.hidden ? '' : (rail.querySelector('.lotbi-place-orbit-position')?.textContent || ''),
      more: rail.querySelector('.lotbi-place-orbit-more')?.hidden ? '' : (rail.querySelector('.lotbi-place-orbit-more')?.textContent || ''),
      moreBox: box(rail.querySelector('.lotbi-place-orbit-more')),
      arrowsShown: [...rail.querySelectorAll('.lotbi-place-orbit-control')].some(node => getComputedStyle(node).display !== 'none')} : null,
    cards: cards.map(card => ({slot: card.dataset.orbitSlot, box: box(card), opacity: Number(getComputedStyle(card).opacity),
      name: card.querySelector('.lotbi-rich-card-title')?.textContent || '',
      lines: [...card.querySelectorAll('.lotbi-place-medical-line')].map(line => line.textContent),
      sideControlsVisible: card.dataset.orbitSlot !== 'CENTER' && [...card.querySelectorAll('a')].some(link => getComputedStyle(link).visibility === 'visible' && getComputedStyle(link.closest('.lotbi-place-card-actions') || link).display !== 'none' && link.getBoundingClientRect().width > 1)})),
    centerName: center?.querySelector('.lotbi-rich-card-title')?.textContent || '',
    actions,
    filters: last ? [...last.querySelectorAll('.lotbi-place-filter-chip')].map(chip => ({label: chip.textContent, box: box(chip), bg: getComputedStyle(chip).backgroundColor, color: getComputedStyle(chip).color})) : [],
    emergency: emergency.map(node => ({text: node.textContent.trim(), links: [...node.querySelectorAll('a')].map(a => a.getAttribute('href')), border: getComputedStyle(node).borderTopWidth, bg: getComputedStyle(node).backgroundColor, box: box(node)})),
    theme: document.body.dataset.siteTheme || document.documentElement.dataset.siteTheme || '',
    lastLink: globalThis.__lastLink || '',
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
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 10000);
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
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort', 30000);
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
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
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

const luminance = rgb => {
  const values = String(rgb).match(/[\d.]+/gu)?.slice(0, 3).map(Number) || [255, 255, 255];
  const [r, g, b] = values.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.LIFE_MEDICAL_SCREENSHOT_DIR || '';
  const label = testCase.label;
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
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    // Headless has no window focus: without this no focus event reaches the page.
    await page('Emulation.setFocusEmulationEnabled', {enabled: true});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    if (testCase.location) {
      await cdp.send('Browser.grantPermissions', {origin, permissions: ['geolocation']});
      await page('Emulation.setGeolocationOverride', {latitude: 35.8242, longitude: 127.148, accuracy: 30});
    } else {
      await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});
    }
    const query = new URLSearchParams({...(testCase.theme ? {theme: testCase.theme} : {})}).toString();
    const load = async () => {
      await page('Page.navigate', {url: `${origin}/${innerRel}${query ? `?${query}` : ''}`});
      const ready = await waitFor(async () => {
        const text = await evaluate("document.getElementById('lmas-result')?.textContent || 'pending'").catch(() => 'pending');
        return text !== 'pending' ? text : null;
      }, `${label}: harness`, 60000);
      const parsedReady = JSON.parse(ready);
      if (!parsedReady.ok) throw new Error(`${label}: ${parsedReady.error}`);
    };
    await load();

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
      await sleep(220);
    };
    const swipe = async (from, to, y) => {
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: from, y}]});
        for (let step = 1; step <= 8; step += 1) {
          await page('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: from + ((to - from) * step) / 8, y}]});
          await sleep(16);
        }
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: from, y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: from, y, button: 'left', buttons: 1, clickCount: 1});
        for (let step = 1; step <= 8; step += 1) {
          await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: from + ((to - from) * step) / 8, y, button: 'left', buttons: 1});
          await sleep(16);
        }
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: to, y, button: 'left', buttons: 0, clickCount: 1});
      }
      await sleep(260);
    };
    const reveal = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'}), true`);
      await sleep(150);
      return await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const openLife = async () => {
      // The 생활정보 entry sits in the (closed) phone drawer; opening it is not under test.
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(() => evaluate("document.querySelectorAll('.consumer-workspace .consumer-shortcut').length === 9"), `${label}: life menu`);
      await sleep(200);
    };
    // Marks the newest answer so selectors reach its cards, not an older one's.
    const markLast = () => evaluate(`(() => { document.querySelectorAll('[data-lmas-last]').forEach(n => n.removeAttribute('data-lmas-last')); const last = [...document.querySelectorAll('.chat-message-assistant')].at(-1); last?.setAttribute('data-lmas-last', ''); return Boolean(last); })()`);
    const askFromLife = async (id, sentCount, expectedAnswer) => {
      await openLife();
      const menu = await evaluate(`(() => ({forms: document.querySelectorAll('.consumer-workspace form, .consumer-workspace input').length,
        prepare: /질문 준비하기/u.test(document.querySelector('.consumer-workspace').textContent)}))()`);
      assert.deepEqual(menu, {forms: 0, prepare: false}, `${label}: the life menu has no region/condition form`);
      if (id === 'hospital' || id === 'emergency') {
        // 병원·응급실 asks nothing until 병원·의원 찾기 / 응급실 찾기 is picked.
        const sentBefore = (await probe()).sent.length;
        await tap(await reveal('.consumer-workspace [data-life-shortcut="medical"]'));
        await waitFor(() => evaluate(`Boolean(document.querySelector('[data-medical-choice="${id}"]'))`), `${label}: ${id} choice`);
        assert.equal((await probe()).sent.length, sentBefore, `${label}: 병원·응급실 alone sends nothing`);
        await tap(await reveal(`[data-medical-choice="${id}"]`));
      } else {
        await tap(await reveal(`.consumer-workspace [data-life-shortcut="${id}"]`));
      }
      const answered = await waitFor(async () => {
        const state = await probe();
        return state.sent.length === sentCount && state.answers.at(-1) === expectedAnswer && state.rail && state.cards.length ? state : null;
      }, `${label}: ${id} answer with cards`);
      await markLast();
      return answered;
    };
    const assertNoKeyboard = (state, step) => {
      assert.equal(state.promptValue, '', `${label}: ${step}: composer stays empty (nothing to send again)`);
      assert.equal(state.promptFocused, false, `${label}: ${step}: composer not focused`);
      assert.equal(state.promptFocusEvents, 0, `${label}: ${step}: composer never focused`);
      assert.equal(state.keyboardOpen, false, `${label}: ${step}: keyboard class not set`);
      assert.equal(state.surfaceOpen, false, `${label}: ${step}: 생활정보 closed`);
    };
    const assertCards = (state, step, {count, kind}) => {
      assert.ok(state.pageOverflowX <= 0, `${label}: ${step}: no horizontal page scroll (${state.pageOverflowX})`);
      const rail = state.rail;
      assert.ok(rail.box.x >= -0.5 && rail.box.right <= state.viewport.w + 0.5, `${label}: ${step}: rail inside the viewport ${JSON.stringify(rail.box)}`);
      assert.ok(rail.box.y < state.viewport.h && rail.box.bottom > 0, `${label}: ${step}: the cards are on screen after the answer`);
      assert.equal(rail.position, count > 1 ? `1/${count}` : '', `${label}: ${step}: position`);
      const center = state.cards.find(card => card.slot === 'CENTER');
      assert.ok(center, `${label}: ${step}: center card`);
      for (const card of state.cards.filter(item => item.slot !== 'CENTER')) {
        assert.ok(center.box.w * center.box.h > card.box.w * card.box.h, `${label}: ${step}: center card is the largest`);
        assert.equal(card.sideControlsVisible, false, `${label}: ${step}: side card links hidden`);
      }
      if (testCase.mobile) {
        assert.equal(rail.arrowsShown, false, `${label}: ${step}: no arrows on a phone`);
        assert.ok(center.box.w >= Math.min(rail.box.w - 64, 380) - 1, `${label}: ${step}: center card ${center.box.w}px of ${rail.box.w}px`);
        assert.ok(center.box.w >= 200, `${label}: ${step}: center card wide enough on ${state.viewport.w}px (${center.box.w})`);
        if (count > 1) {
          const left = state.cards.find(card => card.slot === 'LEFT_FRONT');
          const right = state.cards.find(card => card.slot === 'RIGHT_FRONT');
          assert.ok(right, `${label}: ${step}: a card waits on the right`);
          const peekRight = rail.box.right - right.box.x;
          assert.ok(peekRight >= 10 && peekRight <= 40, `${label}: ${step}: right card edge shows ${peekRight}px`);
          assert.ok(right.opacity >= 0.3, `${label}: ${step}: right card visible (${right.opacity})`);
          if (count > 2) {
            assert.ok(left, `${label}: ${step}: a card waits on the left`);
            const peekLeft = left.box.right - rail.box.x;
            assert.ok(peekLeft >= 10 && peekLeft <= 40, `${label}: ${step}: left card edge shows ${peekLeft}px`);
            assert.ok(left.opacity >= 0.3, `${label}: ${step}: left card visible (${left.opacity})`);
          }
        } else {
          assert.equal(state.cards.length, 1, `${label}: ${step}: one card, no side cards`);
          assert.ok(center.box.w >= Math.min(rail.box.w - 16, 380) - 1, `${label}: ${step}: a single card uses the width`);
        }
      }
      assert.deepEqual(state.actions.map(action => action.action), ['phone', 'naver-map'], `${label}: ${step}: phone + map`);
      for (const action of state.actions) {
        assert.ok(Math.abs(action.box.w - 44) <= 1 && Math.abs(action.box.h - 44) <= 1, `${label}: ${step}: ${action.action} target ${action.box.w}x${action.box.h}`);
        // The approved LOTBI icon images (phone, the chosen map app), 32px in a 44px target.
        assert.equal(action.iconSrc, `/assets/place-actions/${action.action === 'phone' ? 'phone' : 'naver-map'}.png?v=place-icons-20260925`, `${label}: ${step}: ${action.action} LOTBI icon`);
        assert.equal(action.lineIcon, false, `${label}: ${step}: ${action.action} no generic line icon`);
        assert.ok(action.icon && Math.round(action.icon.w) === 32, `${label}: ${step}: ${action.action} icon ${action.icon?.w}px`);
        assert.equal(action.radius, '10px', `${label}: ${step}: ${action.action} approved button shape (${action.radius})`);
        assert.equal(action.text, '', `${label}: ${step}: ${action.action} icon only`);
        assert.ok(action.box.w < center.box.w / 3, `${label}: ${step}: ${action.action} does not span the card`);
      }
      assert.match(state.actions[0].aria, /전화하기$/u);
      assert.match(state.actions[0].href, /^tel:/u);
      assert.match(state.actions[1].aria, /길찾기 \(네이버지도\)$/u);
      assert.ok(state.actions[1].href.length > 10, `${label}: ${step}: map handoff link kept`);
      const lines = center.lines.join(' / ');
      if (kind === 'EMERGENCY') assert.match(lines, /수용 여부는 출발 전 전화로 확인/u, `${label}: ${step}: ${lines}`);
      else assert.match(lines, /등록 시간상 .+ 중 · 오늘 09:00~22:00 \/ 실제 .+ 여부는 전화로 확인/u, `${label}: ${step}: ${lines}`);
      assert.doesNotMatch(lines, /24시간 영업|영업 중|진료 가능|수용 가능/u, `${label}: ${step}: no overclaim`);
    };

    // 1. 생활정보 → 약국 → one automatic search, one sentence, cards.
    let state = await askFromLife('pharmacy', 1, '근처 약국 3곳을 찾았어요.');
    assert.deepEqual(state.sent, ['근처 약국 찾아줘'], `${label}: one question sent`);
    assertNoKeyboard(state, '약국');
    assert.equal(state.answers.at(-1), '근처 약국 3곳을 찾았어요.', `${label}: one-sentence answer shown as Core sent it`);
    assertCards(state, '약국', {count: 3, kind: 'PHARMACY'});
    assert.deepEqual(state.filters.map(filter => filter.label), ['지금 운영 중', '야간', '휴일', '24시간'], `${label}: pharmacy conditions on the results`);
    for (const filter of state.filters) {
      assert.ok(filter.box.h >= 36 && filter.box.x >= -0.5 && filter.box.right <= state.viewport.w + 0.5, `${label}: filter ${filter.label} fits`);
    }
    assert.equal(state.emergency.length, 0);
    if (testCase.location) assert.equal(state.locations[0]?.source, 'BROWSER_CURRENT', `${label}: permitted location used ${JSON.stringify(state.locations[0])}`);
    else assert.equal(state.locations[0], null, `${label}: denied location and no saved region: nothing sent (Core asks)`);
    if (testCase.theme === 'dark') {
      assert.equal(state.theme, 'dark', `${label}: dark theme applied`);
      // The approved LOTBI icon images carry their own colours on a transparent
      // button, so they read the same on the dark page.
      for (const action of state.actions) {
        assert.ok(/rgba\(0, 0, 0, 0\)|transparent/u.test(action.bg) && action.iconSrc && Math.round(action.icon.w) === 32, `${label}: dark ${action.action} ${action.bg} / ${action.iconSrc}`);
      }
      for (const filter of state.filters) assert.ok(luminance(filter.bg) < 0.2 && luminance(filter.color) > 0.5, `${label}: dark filter ${filter.label}`);
    } else {
      for (const action of state.actions) assert.ok(/rgba\(0, 0, 0, 0\)|transparent/u.test(action.bg) && action.iconSrc && Math.round(action.icon.w) === 32, `${label}: light ${action.action} ${action.bg} / ${action.iconSrc}`);
    }
    await shot('01-pharmacy');

    // 2. Turning: swipe (phone) or arrow / drag (desktop), wrapping round.
    // A drag that starts on the center card's text, as a thumb would.
    await evaluate("document.querySelector('[data-lmas-last] .lotbi-place-orbit').scrollIntoView({block: 'center'}), true");
    await sleep(200);
    state = await probe();
    const centerBox = state.cards.find(card => card.slot === 'CENTER').box;
    const swipeY = centerBox.y + 30;
    const leftward = () => swipe(centerBox.cx + centerBox.w * 0.3, centerBox.cx - centerBox.w * 0.35, swipeY);
    const rightward = () => swipe(centerBox.cx - centerBox.w * 0.3, centerBox.cx + centerBox.w * 0.35, swipeY);
    await leftward();
    state = await probe();
    assert.equal(state.rail.position, '2/3', `${label}: swipe left → 2/3`);
    assert.equal(state.centerName, '전주바른약국');
    await leftward();
    assert.equal((await probe()).rail.position, '3/3', `${label}: swipe left → 3/3`);
    await leftward();
    assert.equal((await probe()).rail.position, '1/3', `${label}: wraps to 1/3`);
    await rightward();
    state = await probe();
    assert.equal(state.rail.position, '3/3', `${label}: swipe right → 3/3`);
    assert.equal(state.sent.length, 1, `${label}: turning sends nothing`);
    assert.equal(state.lastLink, '', `${label}: a swipe opens no link`);
    await leftward();
    assert.equal((await probe()).rail.position, '1/3', `${label}: back to 1/3`);

    // 3. The phone / map icons work (handoff read, not followed).
    await tap(await reveal('[data-lmas-last] [data-orbit-slot="CENTER"] [data-action="phone"]'));
    assert.match((await probe()).lastLink, /^tel:/u, `${label}: phone icon calls`);
    await tap(await reveal('[data-lmas-last] [data-orbit-slot="CENTER"] [data-action="naver-map"]'));
    assert.match((await probe()).lastLink, /map\.naver\.com|nmap:|naver/u, `${label}: map icon opens the chosen map app`);

    // 4. A pharmacy condition asks again at once, still without the keyboard.
    const answersBefore = (await probe()).answers.length;
    await tap(await reveal('[data-lmas-last] [data-pharmacy-filter="NIGHT"]'));
    state = await waitFor(async () => { const value = await probe(); return value.sent.length === 2 && value.answers.length === answersBefore + 1 && value.rail ? value : null; }, `${label}: night filter answer`);
    await markLast();
    assert.equal(state.sent[1], '오늘 밤 문 여는 근처 약국 찾아줘');
    assertNoKeyboard(state, '야간');

    // 5. 병원 and 응급실 use the same card and the same behavior.
    state = await askFromLife('hospital', 3, '가까운 병원 3곳을 찾았어요.');
    assert.equal(state.sent[2], '근처 병원 찾아줘');
    assertNoKeyboard(state, '병원');
    assert.equal(state.answers.at(-1), '가까운 병원 3곳을 찾았어요.');
    assertCards(state, '병원', {count: 3, kind: 'HOSPITAL'});
    assert.equal(state.filters.length, 0, `${label}: conditions are for pharmacies only`);
    state = await askFromLife('emergency', 4, '근처 응급실 5곳을 찾았어요.');
    assert.equal(state.sent[3], '근처 응급실 찾아줘');
    assertNoKeyboard(state, '응급실');
    assert.equal(state.answers.at(-1), '근처 응급실 5곳을 찾았어요.');
    assertCards(state, '응급실', {count: 3, kind: 'EMERGENCY'});
    assert.equal(state.emergency.length, 0, `${label}: plain 응급실 search has no 119 box`);
    assert.equal(state.rail.more, '다른 응급실 보기');
    await shot('02-emergency');
    await tap(await reveal('[data-lmas-last] .lotbi-place-orbit-more'));
    assert.equal((await probe()).rail.position, '4/5', `${label}: 다른 응급실 보기 → 4/5`);

    // 6. Back / forward over 생활정보 (the screen is restored) and a reload
    // never send a question again.
    const before = (await probe()).userMessages.length;
    await openLife();
    await evaluate('history.back(), true');
    await sleep(900);
    await evaluate('history.forward(), true');
    await waitFor(() => evaluate("document.querySelectorAll('.consumer-workspace .consumer-shortcut').length === 9"), `${label}: forward restores 생활정보`);
    await sleep(600);
    state = await probe();
    assert.equal(state.sent.length, 4, `${label}: back / forward sends nothing`);
    assert.equal(state.userMessages.length, before, `${label}: back / forward adds no message`);
    await evaluate('history.back(), true');
    await sleep(600);
    await page('Page.reload', {});
    await waitFor(async () => (await evaluate("document.getElementById('lmas-result')?.textContent || 'pending'").catch(() => 'pending')) !== 'pending', `${label}: reload`, 60000);
    await sleep(1500);
    state = await probe();
    assert.equal(state.sent.length, 0, `${label}: reload sends nothing again`);
    const counts = state.userMessages.reduce((map, text) => map.set(text, (map.get(text) || 0) + 1), new Map());
    for (const [text, count] of counts) assert.equal(count, 1, `${label}: "${text}" shown ${count} times after reload`);

    if (testCase.full) {
      // 7. A message describing a symptom: one small 119 call, no box, no repeat.
      await evaluate(`(() => { const p = document.getElementById('lotbi-prompt'); p.value = '숨이 안 쉬어져요 근처 응급실 찾아줘'; p.dispatchEvent(new Event('input', {bubbles: true})); document.querySelector('.send-button').click(); return true; })()`);
      state = await waitFor(async () => { const value = await probe(); return value.sent.length === 1 && value.emergency.length ? value : null; }, `${label}: symptom answer`);
      assert.equal(state.emergency.length, 1, `${label}: one 119 call`);
      assert.deepEqual(state.emergency[0].links, ['tel:119']);
      assert.equal(state.emergency[0].text, '119 전화', `${label}: no second 119 sentence`);
      assert.equal(state.emergency[0].border, '0px', `${label}: no box border`);
      assert.match(state.emergency[0].bg, /rgba\(0, 0, 0, 0\)|transparent/u, `${label}: no box background`);
      assert.equal((state.answers.at(-1).match(/119/gu) || []).length, 1, `${label}: the answer says 119 once`);
      await shot('03-symptom');

      // 8. One card: no position, no side cards, a drag does not move it.
      await evaluate(`(() => { const p = document.getElementById('lotbi-prompt'); p.value = '근처 약국 한 곳만 찾아줘'; p.dispatchEvent(new Event('input', {bubbles: true})); document.querySelector('.send-button').click(); return true; })()`);
      state = await waitFor(async () => { const value = await probe(); return value.sent.length === 2 && value.rail && value.answers.at(-1) === '근처 약국 1곳을 찾았어요.' ? value : null; }, `${label}: single card`);
      assertCards(state, '한 곳', {count: 1, kind: 'PHARMACY'});
      const single = state.cards[0].box;
      await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: single.cx, y: single.y + 30}]});
      await page('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: single.cx - 60, y: single.y + 30}]});
      await sleep(60);
      await markLast();
      const moved = await evaluate(`document.querySelector('[data-lmas-last] [data-orbit-slot="CENTER"]').getBoundingClientRect().x`);
      await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      assert.ok(Math.abs(moved - single.x) <= 1, `${label}: a single card does not slide (${single.x} → ${moved})`);

      // 9. Saved region when no position, and the region question when neither.
      await page('Page.navigate', {url: `${origin}/${innerRel}?saved=1`});
      await waitFor(async () => (await evaluate("document.getElementById('lmas-result')?.textContent || 'pending'").catch(() => 'pending')) !== 'pending', `${label}: saved region page`, 60000);
      state = await askFromLife('pharmacy', 1, '근처 약국 3곳을 찾았어요.');
      assert.equal(state.locations[0]?.source, 'SAVED_REGION', `${label}: saved region used ${JSON.stringify(state.locations[0])}`);
      assert.equal(state.locations[0]?.label, '전주시 완산구');
    }
    return {rail: state.rail?.box?.w, center: state.cards.find(card => card.slot === 'CENTER')?.box.w};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-medical-auto-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`LIFE_MEDICAL_AUTO_SEARCH_CARD ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('LIFE-MEDICAL-AUTO-SEARCH-CARD-01 OK — 생활정보 병원·약국·응급실 ask at once without the keyboard, one-sentence answers over turning cards with side edges showing, round phone/map icons, no 119 box for a plain search (viewport emulation, not a device run)');
