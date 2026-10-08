// LIFE-MEDICAL-CATEGORY-ENTRY-01 — 생활정보에 병원·의원 / 약국 진입 카드.
//
// The cards are entry UI only: the detail form builds one sentence and hands
// it to the existing conversation draft (onDraft). Core's medical route
// (국립중앙의료원 data) answers it; nothing here searches by itself.
//
// LIFE-UTILITY-BILL-MENU-REMOVE-01: 공과금 확인 is hidden until an official
// integration exists, so the life home has four cards and no empty grid cell.
// The life home is a category picker only: no free-question bar (the main
// chat owns free questions) and no saved-items/help row under the list.
//
// Browser part: real touch/mouse input through the DevTools protocol on
// 360x780, 375x812, 390x844, 412x915 and 1280x900. Viewport emulation only —
// not an iPhone Safari / Android device run. External hosts do not resolve.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_SHORTCUTS, applyMedicalChip, buildLifeMedicalPrompt, medicalChipPressed} from '../site-consumer-sections.js';
import {lifeLocationIntent} from '../site-life-location.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Shortcut list ───────────────────────────────────────────────────────
assert.deepEqual(LIFE_SHORTCUTS.map(item => item.label), ['병원·의원', '약국', '축제·행사', '온누리상품권', '지역생활정보']);
assert.deepEqual(LIFE_SHORTCUTS.filter(item => item.medical).map(item => item.id), ['hospital', 'pharmacy']);
for (const id of ['festivals', 'local']) assert.ok(LIFE_SHORTCUTS.some(item => item.id === id), `existing ${id} shortcut kept`);
assert.equal(LIFE_SHORTCUTS.some(item => item.id === 'bills' || /공과금/u.test(item.label)), false, '공과금 확인 stays hidden');
assert.ok(Object.isFrozen(LIFE_SHORTCUTS));

// ── Sentence rule (checked against Core main medical_conversation) ──────
// Every sentence must carry a time or "근처" word, or Core hands it to the
// NAVER place search instead of the 국립중앙의료원 lookup.
const PROMPTS = [
  ['hospital', {region: '전주 효자동', need: '내과'}, '전주 효자동에서 지금 진료하는 내과 알려줘'],
  ['hospital', {region: '전주 효자동', need: '소아과'}, '전주 효자동에서 지금 진료하는 소아과 알려줘'],
  ['hospital', {region: '전주 효자동', need: '치과'}, '전주 효자동에서 지금 진료하는 치과 알려줘'],
  ['hospital', {region: '전주 효자동', need: '오늘 밤 진료하는 병원'}, '전주 효자동에서 오늘 밤 진료하는 병원 알려줘'],
  ['hospital', {region: '전주 효자동', need: '소아과 야간진료'}, '전주 효자동에서 소아과 야간진료 알려줘'],
  ['hospital', {region: '전주시 완산구', need: '일요일에 여는 소아과'}, '전주시 완산구에서 일요일에 여는 소아과 알려줘'],
  ['hospital', {region: '전주 효자동', need: '응급실'}, '전주 효자동에서 응급실 알려줘'],
  ['hospital', {region: '전주 효자동', need: '허리 통증'}, '전주 효자동에서 지금 진료하는 병원 알려줘. 찾는 진료: 허리 통증'],
  ['hospital', {region: ' 전주 효자동에서 ', need: '  내과 '}, '전주 효자동에서 지금 진료하는 내과 알려줘'],
  ['hospital', {region: '', need: '내과'}, '근처에서 지금 진료하는 내과 알려줘'],
  ['hospital', {region: '', need: ''}, '근처에서 지금 진료하는 병원 알려줘'],
  ['hospital', {region: '', need: '응급실'}, '근처에서 응급실 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: ''}, '전주 효자동에서 지금 여는 약국 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: '지금 여는 약국'}, '전주 효자동에서 지금 여는 약국 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: '오늘 밤 여는 약국'}, '전주 효자동에서 오늘 밤 여는 약국 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: '24시간 약국'}, '전주 효자동에서 24시간 약국 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: '24시간'}, '전주 효자동에서 24시간 약국 알려줘'],
  ['pharmacy', {region: '전주 효자동', need: '약국'}, '전주 효자동에서 지금 여는 약국 알려줘'],
  ['pharmacy', {region: '서울 강남구', need: '공휴일에 여는 약국'}, '서울 강남구에서 공휴일에 여는 약국 알려줘'],
  ['pharmacy', {region: '', need: ''}, '근처에서 지금 여는 약국 알려줘'],
];
for (const [kind, input, expected] of PROMPTS) {
  const prompt = buildLifeMedicalPrompt(kind, input);
  assert.equal(prompt, expected, `${kind} ${JSON.stringify(input)}`);
  if (kind === 'pharmacy') assert.match(prompt, /약국/u, 'pharmacy-compatible: names 약국');
  else assert.match(prompt, /병원|의원|과|응급실|진료/u, 'medical-compatible: names a hospital, department or ER');
  assert.match(prompt, /지금|밤|야간|24시간|요일|공휴일|응급실|근처/u, 'carries a time or nearby signal Core reads');
  assert.doesNotMatch(prompt, /보장|진료 가능|수용 가능/u, 'never promises treatment or acceptance');
  assert.ok(prompt.length <= 1000);
  // Without a typed region the existing life-location contract may attach a
  // location (its own permission policy decides); the form never asks for one.
  if (!input.region.trim()) assert.equal(lifeLocationIntent(prompt), true, `nearby sentence reaches the life-location contract: ${prompt}`);
}

// ── Quick chips edit the visible text ───────────────────────────────────
const CHIPS = [
  ['hospital', 'now', '', '지금 진료하는 병원'],
  ['hospital', 'night', '', '오늘 밤 진료하는 병원'],
  ['hospital', 'night', '내과', '오늘 밤 진료하는 내과'],
  ['hospital', 'now', '오늘 밤 진료하는 내과', '지금 진료하는 내과'],
  ['hospital', 'now', '지금 진료하는 내과', '내과'],
  ['hospital', 'now', '지금 진료하는 병원', ''],
  ['hospital', 'emergency', '내과', '응급실'],
  ['hospital', 'emergency', '응급실', ''],
  ['hospital', 'night', '응급실', '오늘 밤 진료하는 병원'],
  ['pharmacy', 'now', '', '지금 여는 약국'],
  ['pharmacy', 'night', '지금 여는 약국', '오늘 밤 여는 약국'],
  ['pharmacy', 'allday', '', '24시간 약국'],
  ['pharmacy', 'allday', '24시간 약국', ''],
];
for (const [kind, chip, before, after] of CHIPS) {
  assert.equal(applyMedicalChip(kind, chip, before), after, `${kind}/${chip}: "${before}"`);
  // Applying a chip selects it; pressing a selected chip again releases it.
  const wasPressed = medicalChipPressed(kind, chip, before);
  assert.equal(medicalChipPressed(kind, chip, after), !wasPressed, `${kind}/${chip} pressed state after "${before}" → "${after}"`);
}
assert.equal(medicalChipPressed('hospital', 'night', '지금 진료하는 내과'), false);
assert.equal(medicalChipPressed('hospital', 'emergency', '응급실'), true);

// ── Source contract ─────────────────────────────────────────────────────
const source = read('site-consumer-sections.js');
assert.match(source, /onDraft\(buildLifeMedicalPrompt\(item\.id, \{region: values\.region\.value, need: values\.need\.value\}\)\)/u, 'submit goes through the existing draft handoff');
assert.match(source, /if \(item\.medical\) \{ openMedicalDetail\(item, back, detail, title\); return; \}/u);
assert.match(source, /import \{createEmergencyCallNotice\} from '\.\/site-life-medical\.js\?v=aset-[0-9a-f]{12}'/u, 'reuses the existing 119 notice');
assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|innerHTML|geolocation|getCurrentPosition/u, 'no own search engine, storage or location request');
const conversation = read('site-conversation.js');
assert.match(conversation, /onDraft: text => \{ closeSurface\(\); draft\(text\); \}/u);

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
  throw new Error('Chrome/Chromium is required for the life medical entry validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA},
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('lme-result');
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.__sent = [];
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      try { globalThis.__sent.push(JSON.parse(String(init?.body || '{}'))); } catch { globalThis.__sent.push({unparsed:true}); }
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'확인했어요.',response_mode:'DETERMINISTIC',correlation_id:'req_lifemedicalentry01',
        intent:{action:'ANSWER',domain:'GENERAL'},
        follow_up:{required:false,action:'NONE',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
          order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=lifemedicalentry01');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="lme-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Page-side reading of the open life surface.
const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const lines = node => { const range = document.createRange(); range.selectNodeContents(node); const tops = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))); return tops.size; };
  const shortcuts = [...(workspace?.querySelectorAll('.consumer-shortcut') || [])].map(button => {
    const label = button.querySelector('span');
    const hit = (() => { const b = box(button); const el = document.elementFromPoint(b.cx, Math.min(Math.max(b.cy, 0), innerHeight - 1)); return el?.closest?.('.consumer-shortcut') === button; })();
    return {id: button.dataset.lifeShortcut, label: label?.textContent || '', box: box(button), labelBox: box(label), lines: label ? lines(label) : 0,
      labelClipped: label ? label.scrollWidth > label.parentElement.clientWidth : true, hit, icon: Boolean(button.querySelector('svg path')), brandSlot: button.querySelector('[data-brand-logo-slot]')?.dataset.brandLogoSlot || '',
      spansRow: getComputedStyle(button).gridColumnStart === '1' && getComputedStyle(button).gridColumnEnd === '-1'};
  });
  const detail = workspace?.querySelector('.consumer-life-detail');
  const fields = [...(detail?.querySelectorAll('.consumer-life-field') || [])].map(label => ({
    label: label.firstChild?.textContent || '', key: label.querySelector('[data-medical-field]')?.dataset.medicalField || '',
    tag: label.querySelector('input, textarea')?.tagName || '', placeholder: label.querySelector('input, textarea')?.placeholder || '',
    value: label.querySelector('input, textarea')?.value || '', required: Boolean(label.querySelector('input, textarea')?.required), box: box(label.querySelector('input, textarea')),
  }));
  const chips = [...(detail?.querySelectorAll('[data-medical-chip]') || [])].map(chip => ({id: chip.dataset.medicalChip, label: chip.textContent, pressed: chip.getAttribute('aria-pressed'), box: box(chip), lines: lines(chip)}));
  return {
    open: Boolean(workspace), title: panel?.querySelector('.site-modal-header h2, h2')?.textContent || '',
    viewport: {w: innerWidth, h: innerHeight}, panel: box(panel),
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    search: Boolean(workspace?.querySelector('.consumer-search, input[type=search]')), saved: /저장한 정보 다시 보기/u.test(workspace?.textContent || ''),
    freeQuery: /어떤 생활정보가 필요하세요|롯비에게 물어보기/u.test(workspace?.textContent || ''), footer: Boolean(workspace?.querySelector('.consumer-section-footer')),
    homeChildren: [...(workspace?.querySelector('[data-consumer-surface]')?.children || [])].map(child => child.className),
    header: box(panel?.querySelector('.site-modal-header')), description: box(panel?.querySelector('.site-modal-description')), label: box(workspace?.querySelector('.consumer-section-label')),
    focusedShortcut: document.activeElement?.dataset?.lifeShortcut || '',
    shortcuts,
    detail: detail ? {id: detail.dataset.lifeDetail || '', title: detail.querySelector('h3')?.textContent || '', box: box(detail), back: box([...detail.querySelectorAll('.consumer-action')].find(b => b.textContent === '생활정보로 돌아가기')),
      submit: box(detail.querySelector('form button[type=submit]')), note: detail.querySelector('.consumer-feature-note')?.textContent || '',
      emergency: Boolean(detail.querySelector('.conversation-emergency-call')), emergencyText: detail.querySelector('.conversation-emergency-call')?.textContent || '',
      call: detail.querySelector('.conversation-emergency-call-link')?.getAttribute('href') || '', fields, chips} : null,
    composer: document.getElementById('lotbi-prompt')?.value ?? null,
    festival: Boolean(document.querySelector('.festival-manager')),
    gridColumns: (() => { const grid = workspace?.querySelector('.consumer-shortcuts'); return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0; })(),
    billsVisible: Boolean(workspace?.querySelector('[data-life-shortcut="bills"]')) || /공과금|고지서/u.test(workspace?.textContent || ''),
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

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.LIFE_MEDICAL_SCREENSHOT_DIR || '';
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
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url: `${origin}/${innerRel}`});
    const ready = await waitFor(async () => {
      const text = await evaluate("document.getElementById('lme-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsedReady = JSON.parse(ready);
    if (!parsedReady.ok) throw new Error(`${testCase.label}: ${parsedReady.error}`);

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
      await sleep(200);
    };
    // Scroll an element into the middle of the viewport, then read its box.
    const reveal = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'}), true`);
      await sleep(120);
      return await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
    };
    const typeInto = async (selector, text) => {
      await tap(await reveal(selector));
      await evaluate(`(() => { const f = document.querySelector(${JSON.stringify(selector)}); f.select(); return document.activeElement === f; })()`)
        .then(focused => assert.equal(focused, true, `${testCase.label}: ${selector} focused by tap`));
      await page('Input.insertText', {text});
      await sleep(80);
    };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const openLife = async () => {
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(async () => (await probe()).shortcuts.length === 5, `${testCase.label}: life shortcuts`);
      await sleep(250);
    };
    const tapShortcut = async id => {
      const center = await reveal(`.consumer-workspace [data-life-shortcut="${id}"]`);
      const before = await probe();
      const card = before.shortcuts.find(item => item.id === id);
      assert.equal(card.hit, true, `${testCase.label}: ${id} card is the element under its own center (touchable)`);
      await tap(center);
    };

    // 1. Life main: four cards (공과금 확인 hidden), full rows, no empty cell.
    await openLife();
    const main = await probe();
    assert.equal(main.title, '생활정보');
    assert.deepEqual(main.shortcuts.map(item => item.label), ['병원·의원', '약국', '축제·행사', '온누리상품권', '지역생활정보']);
    assert.equal(main.billsVisible, false, `${testCase.label}: 공과금 확인 is not shown anywhere on the life surface`);
    // ONNURI-MERCHANT-01: with an odd number of cards the last one spans the
    // row (site-life-onnuri.css), so a spanning card fills every column.
    const cells = main.shortcuts.reduce((sum, card) => sum + (card.spansRow ? main.gridColumns : 1), 0);
    assert.ok(main.gridColumns >= 1 && cells % main.gridColumns === 0, `${testCase.label}: ${main.shortcuts.length} cards fill ${main.gridColumns} columns without an empty cell`);
    const rows = new Map();
    for (const card of main.shortcuts) { const top = Math.round(card.box.y); rows.set(top, (rows.get(top) || 0) + (card.spansRow ? main.gridColumns : 1)); }
    assert.deepEqual([...rows.values()], Array(cells / main.gridColumns).fill(main.gridColumns), `${testCase.label}: every row is full ${JSON.stringify([...rows])}`);
    assert.equal(new Set(main.shortcuts.filter(item => !item.spansRow).map(item => Math.round(item.box.w))).size, 1, `${testCase.label}: all cards share one width`);
    // Category list right under the description; nothing above or below it.
    assert.equal(main.search, false, `${testCase.label}: no free-question bar on the life home`);
    assert.equal(main.freeQuery, false, `${testCase.label}: no 어떤 생활정보가 필요하세요 / 롯비에게 물어보기`);
    assert.equal(main.saved, false, `${testCase.label}: no 저장한 정보 다시 보기 on the life home`);
    assert.equal(main.footer, false, `${testCase.label}: no footer row`);
    assert.deepEqual(main.homeChildren, ['consumer-section-label', 'consumer-shortcuts'], `${testCase.label}: the home is label + list only`);
    assert.ok(main.header.y >= 0, `${testCase.label}: header inside the viewport (${main.header.y})`);
    const descriptionToLabel = main.label.y - main.description.bottom;
    const labelToList = main.shortcuts[0].box.y - main.label.bottom;
    assert.ok(descriptionToLabel >= 12 && descriptionToLabel <= 32, `${testCase.label}: description → 생활에 필요한 정보 ${descriptionToLabel}px`);
    assert.ok(labelToList >= 4 && labelToList <= 16, `${testCase.label}: label → first category ${labelToList}px`);
    assert.ok(main.shortcuts[0].box.y <= 160, `${testCase.label}: first category at ${main.shortcuts[0].box.y}px (was 251px with the bar)`);
    assert.ok(main.shortcuts.at(-1).box.bottom <= main.viewport.h, `${testCase.label}: every category on the first screen`);
    assert.ok(main.pageOverflowX <= 0, `${testCase.label}: no horizontal page scroll (${main.pageOverflowX})`);
    assert.ok(main.panelOverflowX <= 0, `${testCase.label}: panel does not scroll sideways (${main.panelOverflowX})`);
    const heights = main.shortcuts.map(item => Math.round(item.box.h));
    for (const card of main.shortcuts) {
      assert.ok(card.box.x >= main.panel.x - 0.5 && card.box.right <= main.panel.right + 0.5, `${testCase.label}: ${card.label} inside the panel ${JSON.stringify(card.box)} / ${JSON.stringify(main.panel)}`);
      assert.ok(card.box.x >= 0 && card.box.right <= main.viewport.w, `${testCase.label}: ${card.label} inside the viewport`);
      assert.equal(card.lines, 1, `${testCase.label}: ${card.label} label stays on one line`);
      assert.equal(card.labelClipped, false, `${testCase.label}: ${card.label} label not clipped`);
      assert.ok(card.box.h >= 44, `${testCase.label}: ${card.label} touch target ${card.box.h}px`);
      // 온누리상품권 keeps a reserved logo slot instead of an icon until the
      // official logo is approved (ONNURI-MERCHANT-01).
      assert.ok(card.icon || (card.id === 'onnuri' && card.brandSlot === 'onnuri'), `${testCase.label}: ${card.label} has its icon`);
    }
    assert.equal(new Set(heights).size, 1, `${testCase.label}: all cards share one height ${heights}`);
    await shot('01-life-main');

    // 2. 병원·의원 → detail; chips; 119 notice only for 응급실; back → main.
    await tapShortcut('hospital');
    let state = await waitFor(async () => { const value = await probe(); return value.detail?.id === 'hospital' ? value : null; }, `${testCase.label}: hospital detail`);
    assert.equal(state.detail.title, '병원·의원');
    assert.deepEqual(state.detail.fields.map(field => [field.label, field.key, field.tag, field.placeholder, field.required]), [
      ['지역', 'region', 'INPUT', '예: 전주 효자동', false],
      ['찾는 진료', 'need', 'INPUT', '예: 내과, 소아과, 치과, 오늘 밤 진료하는 병원', false],
    ], 'region is typed, location is never required');
    assert.deepEqual(state.detail.chips.map(chip => [chip.label, chip.pressed]), [['지금 진료', 'false'], ['야간진료', 'false'], ['응급실', 'false']]);
    assert.equal(state.detail.emergency, false);
    assert.match(state.detail.note, /위치 사용을 켠 경우에만 현재 위치/u);
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: hospital detail fits (${state.pageOverflowX}/${state.panelOverflowX})`);
    for (const chip of state.detail.chips) {
      assert.ok(chip.box.x >= state.panel.x - 0.5 && chip.box.right <= state.panel.right + 0.5, `${testCase.label}: chip ${chip.label} inside the panel`);
      assert.equal(chip.lines, 1, `${testCase.label}: chip ${chip.label} on one line`);
      assert.ok(chip.box.h >= 44, `${testCase.label}: chip ${chip.label} touch target`);
    }
    for (const field of state.detail.fields) assert.ok(field.box.right <= state.panel.right + 0.5, `${testCase.label}: ${field.label} field inside the panel`);
    await typeInto('[data-medical-field="need"]', '내과');
    await tap(await reveal('[data-medical-chip="night"]'));
    state = await probe();
    assert.equal(state.detail.fields[1].value, '오늘 밤 진료하는 내과', `${testCase.label}: 야간진료 keeps the typed department`);
    assert.deepEqual(state.detail.chips.map(chip => chip.pressed), ['false', 'true', 'false']);
    await tap(await reveal('[data-medical-chip="emergency"]'));
    state = await probe();
    assert.equal(state.detail.fields[1].value, '응급실');
    assert.equal(state.detail.emergency, true, `${testCase.label}: 119 notice for 응급실`);
    assert.equal(state.detail.emergencyText, '생명이 위급하면 지금 바로 119에 전화하세요.119 전화');
    assert.equal(state.detail.call, 'tel:119');
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: 119 notice fits`);
    await shot('02-hospital-emergency');
    await tap(await reveal('[data-medical-chip="emergency"]'));
    state = await probe();
    assert.equal(state.detail.fields[1].value, '', 'pressing a selected chip clears it');
    assert.equal(state.detail.emergency, false, '119 notice leaves with 응급실');
    await tap(await reveal('[data-medical-chip="now"]'));
    state = await probe();
    assert.equal(state.detail.fields[1].value, '지금 진료하는 병원');
    await shot('03-hospital-now');
    await tap(await reveal('.consumer-life-detail > .consumer-action'));
    state = await waitFor(async () => { const value = await probe(); return !value.detail && value.shortcuts.length === 5 ? value : null; }, `${testCase.label}: back to life main`);
    assert.deepEqual(state.shortcuts.map(item => item.label), main.shortcuts.map(item => item.label), 'back → 생활정보 메인');
    assert.equal(state.focusedShortcut, 'hospital', `${testCase.label}: back returns focus to the card that opened the detail`);
    assert.deepEqual(state.homeChildren, ['consumer-section-label', 'consumer-shortcuts'], `${testCase.label}: back restores label + list only`);

    // 3. 병원·의원 submit → composer holds the Core-compatible sentence → send.
    await tapShortcut('hospital');
    await waitFor(async () => (await probe()).detail?.id === 'hospital', `${testCase.label}: hospital detail again`);
    await typeInto('[data-medical-field="region"]', '전주 효자동');
    await typeInto('[data-medical-field="need"]', '내과');
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    state = await waitFor(async () => { const value = await probe(); return !value.open ? value : null; }, `${testCase.label}: surface closes on submit`);
    assert.equal(state.composer, '전주 효자동에서 지금 진료하는 내과 알려줘', `${testCase.label}: hospital draft`);
    await evaluate("document.querySelector('.send-button').click(), true");
    const sent = await waitFor(() => evaluate('globalThis.__sent.length ? globalThis.__sent.slice() : null'), `${testCase.label}: guest message sent`);
    assert.equal(sent.length, 1);
    assert.ok(Object.values(sent[0]).includes('전주 효자동에서 지금 진료하는 내과 알려줘'), `${testCase.label}: Core receives the sentence unchanged ${JSON.stringify(sent[0])}`);
    assert.equal(sent[0].client_context?.location, undefined, `${testCase.label}: no location without the user's location setting`);

    // 4. 약국 → detail → chip → submit.
    await openLife();
    await tapShortcut('pharmacy');
    state = await waitFor(async () => { const value = await probe(); return value.detail?.id === 'pharmacy' ? value : null; }, `${testCase.label}: pharmacy detail`);
    assert.equal(state.detail.title, '약국');
    assert.deepEqual(state.detail.fields.map(field => [field.label, field.placeholder]), [['지역', '예: 전주 효자동'], ['찾는 조건', '예: 지금 여는 약국, 오늘 밤 여는 약국, 24시간 약국']]);
    assert.deepEqual(state.detail.chips.map(chip => chip.label), ['지금 여는 약국', '오늘 밤 여는 약국', '24시간 약국']);
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: pharmacy detail fits`);
    for (const chip of state.detail.chips) assert.equal(chip.lines, 1, `${testCase.label}: chip ${chip.label} on one line`);
    await typeInto('[data-medical-field="region"]', '전주 효자동');
    await tap(await reveal('[data-medical-chip="night"]'));
    await shot('04-pharmacy');
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    state = await waitFor(async () => { const value = await probe(); return !value.open ? value : null; }, `${testCase.label}: pharmacy submit`);
    assert.equal(state.composer, '전주 효자동에서 오늘 밤 여는 약국 알려줘', `${testCase.label}: pharmacy draft`);

    // 5. Existing shortcuts unchanged.
    await openLife();
    await tapShortcut('local');
    state = await waitFor(async () => { const value = await probe(); return value.detail ? value : null; }, `${testCase.label}: local detail`);
    assert.equal(state.detail.title, '지역생활정보');
    assert.deepEqual(state.detail.fields.map(field => [field.label, field.required]), [['지역 또는 장소', true], ['궁금한 생활정보', true]]);
    assert.deepEqual(state.detail.chips, []);
    await typeInto('.consumer-life-detail input', '전주시 덕진구');
    await typeInto('.consumer-life-detail .consumer-life-field:nth-of-type(2) input', '쓰레기 배출일');
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    state = await waitFor(async () => { const value = await probe(); return !value.open ? value : null; }, `${testCase.label}: local submit`);
    assert.equal(state.composer, '우리 지역 생활정보를 알려 줘\n지역 또는 장소: 전주시 덕진구\n궁금한 생활정보: 쓰레기 배출일');
    await openLife();
    await tapShortcut('festivals');
    state = await waitFor(async () => { const value = await probe(); return value.festival ? value : null; }, `${testCase.label}: festival surface`);
    return {cards: main.shortcuts.map(item => `${item.label}:${Math.round(item.box.w)}x${Math.round(item.box.h)}`), sent: sent[0].text ?? '(text field)'};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-medical-entry-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`LIFE_MEDICAL_CATEGORY_ENTRY ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('LIFE-MEDICAL-CATEGORY-ENTRY-01 OK — 병원·의원/약국 cards open their forms and hand a Core medical sentence to the conversation; 공과금 확인 hidden, four life cards fill their grid under the description, no free-question bar or footer row (viewport emulation, not a device run)');
