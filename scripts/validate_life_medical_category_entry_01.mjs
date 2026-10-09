// LIFE-MEDICAL-CATEGORY-ENTRY-01 — 생활정보에 병원·의원 / 약국 진입 카드.
// LIFE-MEDICAL-AUTO-SEARCH-01 — the entry cards have no form any more: 병원·의원,
// 약국 and 응급실 send one fixed "근처" question at once (Core's medical route
// reads it; the life-location contract adds the current location or saved
// region). Nothing is left in the composer to send again, and the composer is
// not focused (no phone keyboard). 지역생활정보 keeps its form, which also
// sends at once.
//
// LIFE-UTILITY-BILL-MENU-REMOVE-01: 공과금 확인 stays hidden. The life home is a
// category picker only: no free-question bar and no saved-items/help row. It
// has eight cards (응급실, 온누리상품권, 전북 맛집·음식, 유치원·학교 included); an odd last card
// takes its whole row, so there is no empty grid cell.
// KINDERGARTEN-OFFICIAL-INFO-01: 유치원·학교 is the one life screen that still
// drafts its question (onDraft); that handoff is pinned below and any other
// draft handoff in the life cards fails.
//
// Browser part: real touch/mouse input through the DevTools protocol on
// 360x780, 375x812, 390x844, 412x915 and 1280x900. Viewport emulation only —
// not an iPhone Safari / Android device run. External hosts do not resolve.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_MEDICAL_QUESTIONS, LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {lifeLocationIntent} from '../site-life-location.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Shortcut list ───────────────────────────────────────────────────────
assert.deepEqual(LIFE_SHORTCUTS.map(item => item.label), ['병원·의원', '약국', '응급실', '축제·행사', '온누리상품권', '지역생활정보', '전북 맛집·음식', '유치원·학교']);
assert.deepEqual(LIFE_SHORTCUTS.filter(item => item.ask).map(item => [item.id, item.ask]), [
  ['hospital', '근처 병원 찾아줘'], ['pharmacy', '근처 약국 찾아줘'], ['emergency', '근처 응급실 찾아줘'],
]);
for (const id of ['festivals', 'local', 'onnuri', 'education']) assert.ok(LIFE_SHORTCUTS.some(item => item.id === id), `existing ${id} shortcut kept`);
assert.equal(LIFE_SHORTCUTS.some(item => item.id === 'bills' || /공과금/u.test(item.label)), false, '공과금 확인 stays hidden');
assert.ok(Object.isFrozen(LIFE_SHORTCUTS) && Object.isFrozen(LIFE_MEDICAL_QUESTIONS));
// Each question carries "근처", so Core takes it to the 국립중앙의료원 lookup
// (not the NAVER place search) and the location contract may attach a location.
for (const question of Object.values(LIFE_MEDICAL_QUESTIONS)) {
  assert.match(question, /^근처 (?:병원|약국|응급실) 찾아줘$/u);
  assert.equal(lifeLocationIntent(question), true, question);
  assert.doesNotMatch(question, /보장|진료 가능|수용 가능/u);
}

// ── Source contract ─────────────────────────────────────────────────────
const source = read('site-consumer-sections.js');
assert.match(source, /if \(item\.ask\) onAsk\(item\.ask\);/u, 'a medical card asks at once');
// The 유치원·학교 draft handoff (KINDERGARTEN-OFFICIAL-INFO-01) is the only
// onDraft allowed: its two exact uses are taken out, then the same check runs.
const EDUCATION_DRAFT_USES = [
  ['{section, root, onAsk, onDraft, onFestival,', '{section, root, onAsk, onFestival,'],
  ['mountEducation({root: host, onDraft, accountId})', 'mountEducation({root: host, accountId})'],
];
let lifeCardsSource = source;
for (const [use, without] of EDUCATION_DRAFT_USES) {
  assert.equal(lifeCardsSource.split(use).length, 2, `education draft handoff appears exactly once: ${use}`);
  lifeCardsSource = lifeCardsSource.replace(use, without);
}
assert.doesNotMatch(lifeCardsSource, /openMedicalDetail|data-medical-field|질문 준비하기|onDraft/u, 'no region/condition form, no draft handoff');
assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|innerHTML|geolocation|getCurrentPosition/u, 'no own search engine, storage or location request');
const conversation = read('site-conversation.js');
assert.match(conversation, /onAsk: text => \{[\s\S]{0,400}?surfaceRestoreFocus = undefined;\s*closeSurface\(\);\s*askWithoutKeyboard\(text\);/u,
  'closing 생활정보 does not hand focus back to the composer');

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
    // KINDERGARTEN-OFFICIAL-INFO-01: an odd last card may take its whole row.
    const spansRow = button.getBoundingClientRect().width >= button.parentElement.getBoundingClientRect().width - 2;
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
    await cdp.send('Browser.setPermission', {origin, permission: {name: 'geolocation'}, setting: 'denied'});
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
      await waitFor(async () => (await probe()).shortcuts.length === 8, `${testCase.label}: life shortcuts`);
      await sleep(250);
    };
    const tapShortcut = async id => {
      const center = await reveal(`.consumer-workspace [data-life-shortcut="${id}"]`);
      const before = await probe();
      const card = before.shortcuts.find(item => item.id === id);
      assert.equal(card.hit, true, `${testCase.label}: ${id} card is the element under its own center (touchable)`);
      await tap(center);
    };

    // 1. Life main: eight cards (응급실, 온누리상품권, 전북 맛집·음식 and 유치원·학교 added, 공과금 확인
    // hidden), full rows, no empty cell — an odd last card takes its whole row.
    await openLife();
    const main = await probe();
    assert.equal(main.title, '생활정보');
    assert.deepEqual(main.shortcuts.map(item => item.label), ['병원·의원', '약국', '응급실', '축제·행사', '온누리상품권', '지역생활정보', '전북 맛집·음식', '유치원·학교']);
    assert.equal(main.billsVisible, false, `${testCase.label}: 공과금 확인 is not shown anywhere on the life surface`);
    // ONNURI-MERCHANT-01 / KINDERGARTEN-OFFICIAL-INFO-01: with an odd number of cards the
    // last one spans the row (site-life-onnuri.css, site-life-education.css), so a
    // spanning card fills every column.
    const cells = main.shortcuts.reduce((sum, card) => sum + (card.spansRow ? main.gridColumns : 1), 0);
    assert.ok(main.gridColumns >= 1 && cells % main.gridColumns === 0, `${testCase.label}: ${main.shortcuts.length} cards fill ${main.gridColumns} columns without an empty cell`);
    const rows = new Map();
    for (const card of main.shortcuts) { const top = Math.round(card.box.y); rows.set(top, (rows.get(top) || 0) + (card.spansRow ? main.gridColumns : 1)); }
    assert.deepEqual([...rows.values()], Array(cells / main.gridColumns).fill(main.gridColumns), `${testCase.label}: every row is full ${JSON.stringify([...rows])}`);
    assert.equal(new Set(main.shortcuts.filter(item => !item.spansRow || main.gridColumns === 1).map(item => Math.round(item.box.w))).size, 1, `${testCase.label}: all cards share one width`);
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

    // 2. 병원·의원 / 약국 / 응급실: one tap sends the fixed question at once —
    // 생활정보 closes, nothing waits in the composer, the composer is not focused.
    const asked = {hospital: '근처 병원 찾아줘', pharmacy: '근처 약국 찾아줘', emergency: '근처 응급실 찾아줘'};
    let state;
    let sent = [];
    for (const id of Object.keys(asked)) {
      if (id !== 'hospital') await openLife();
      await tapShortcut(id);
      state = await waitFor(async () => { const value = await probe(); return !value.open ? value : null; }, `${testCase.label}: ${id} closes 생활정보`);
      sent = await waitFor(() => evaluate(`globalThis.__sent.length === ${sent.length + 1} ? globalThis.__sent.slice() : null`), `${testCase.label}: ${id} sent at once`);
      assert.equal(sent.at(-1).text, asked[id], `${testCase.label}: ${id} asks ${JSON.stringify(sent.at(-1))}`);
      assert.equal(state.composer, '', `${testCase.label}: ${id}: nothing left in the composer to send again`);
      assert.equal(await evaluate("document.activeElement === document.getElementById('lotbi-prompt')"), false, `${testCase.label}: ${id}: composer not focused`);
      assert.equal(sent.at(-1).client_context?.location, undefined, `${testCase.label}: ${id}: location denied, no saved region → nothing sent (Core asks)`);
      await waitFor(() => evaluate("!document.querySelector('.send-button[aria-label=\"전송 중\"]')"), `${testCase.label}: ${id} answered`);
      if (id === 'hospital') await shot('02-hospital-sent');
    }

    // 5. Existing shortcuts unchanged.
    await openLife();
    await tapShortcut('local');
    state = await waitFor(async () => { const value = await probe(); return value.detail ? value : null; }, `${testCase.label}: local detail`);
    assert.equal(state.detail.title, '지역생활정보');
    assert.deepEqual(state.detail.fields.map(field => [field.label, field.required]), [['지역 또는 장소', true], ['궁금한 생활정보', true]]);
    assert.deepEqual(state.detail.chips, []);
    await typeInto('.consumer-life-detail input', '전주시 덕진구');
    await typeInto('.consumer-life-detail .consumer-life-field:nth-of-type(2) input', '쓰레기 배출일');
    assert.equal(state.detail.submit ? (await evaluate("document.querySelector('.consumer-life-detail form button[type=submit]').textContent")) : '', '롯비에게 물어보기');
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    state = await waitFor(async () => { const value = await probe(); return !value.open ? value : null; }, `${testCase.label}: local submit`);
    sent = await waitFor(() => evaluate(`globalThis.__sent.length === ${sent.length + 1} ? globalThis.__sent.slice() : null`), `${testCase.label}: local sent at once`);
    assert.equal(sent.at(-1).text, '우리 지역 생활정보를 알려 줘\n지역 또는 장소: 전주시 덕진구\n궁금한 생활정보: 쓰레기 배출일');
    assert.equal(state.composer, '', `${testCase.label}: local: nothing left in the composer`);
    await openLife();
    await tapShortcut('festivals');
    state = await waitFor(async () => { const value = await probe(); return value.festival ? value : null; }, `${testCase.label}: festival surface`);
    return {cards: main.shortcuts.map(item => `${item.label}:${Math.round(item.box.w)}x${Math.round(item.box.h)}`), sent: sent.map(body => body.text)};
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

console.log('LIFE-MEDICAL-CATEGORY-ENTRY-01 OK — 병원·의원/약국/응급실 send one nearby question at once (no form, nothing left in the composer, composer not focused); 공과금 확인 hidden, eight life cards fill their grid under the description, no free-question bar or footer row (viewport emulation, not a device run)');
