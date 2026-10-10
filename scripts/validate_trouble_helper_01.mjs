// TROUBLE-HELPER-01 — 분쟁·사고 도우미, “막막할 때 롯비”.
//
// Contract checked here:
// * both menus (desktop sidebar, mobile drawer) carry 분쟁·사고 도우미
//   (data-trouble-open) right after 진위확인; it opens <dialog
//   data-trouble-dialog> headed "LOTBI 분쟁·사고 도우미" / “막막할 때 롯비”
//   without any login, from Core's public GET /v2/trouble-helper/guides
//   (credentials omit, no headers)
// * ① five situations in order with the notice; ② one question per screen,
//   show_if honoured (신호등 only for 교차로), "n/m" progress, back;
//   ③ numbered step cards (urgent band, 했어요, 읽어주기, tel buttons, 진위확인
//   link, goto); ④ evidence, references, official channels with the fee line
//   rules, hours, "확인일 · 근거 보기", "인증이 안 돼요" putting phone/visit first;
//   ⑤ 상황 정리표 with 'SUBMITTED' locked until the receipt_field_id field holds
//   a 접수번호 (never locked when it is null), save, print (large print sheet),
//   카카오로 보내기 → navigator.share → copy, safety notes
// * 자동차 사고: the 과실비율정보포털 order, its link (전동킥보드 → pm_url), the
//   "대화로 찾기" sentence + copy; no ratio-looking number anywhere on screen
// * progress survives a reload (the dialog reopens where it was)
// * Core down: the fallback sentence and 112 · 119 · 132 call buttons
// * 375 (and 320, 1280) light and dark: no sideways scroll, text ≥ 20px,
//   headings 26–28px, main buttons ≥ 56px, every target ≥ 48px, contrast ≥ 4.5
//   (viewport emulation in headless Chrome, not a device run)
//
// Core's answer comes from scripts/fixtures/trouble_helper_guides_01.json, the
// public output of lotbi-core app/trouble_helper.py (public_guides()).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/trouble_helper_guides_01.json'));
const RATIO_RE = /\d+\s*[:：]\s*\d+|\d+\s*%/u;
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

// ── Static wiring ───────────────────────────────────────────────────────
const index = read('index.html');
const callback = read('auth/callback/index.html');
const conversation = read('site-conversation.js');
const ui = read('site-trouble-helper.js');
const modelSource = read('site-trouble-helper-model.js');
const css = read('site-trouble-helper.css');

await check('menus: 분쟁·사고 도우미 sits right after 진위확인 in the desktop and mobile menus', () => {
  const navs = [...index.matchAll(/<div class="consumer-primary-nav"[^>]*>([\s\S]*?)<\/div>/gu)].map(match => match[1]);
  assert.equal(navs.length, 2);
  for (const nav of navs) {
    const labels = [...nav.matchAll(/<button\b[^>]*aria-label="([^"]+)"/gu)].map(match => match[1]);
    assert.equal(labels[labels.indexOf('진위확인') + 1], '분쟁·사고 도우미', JSON.stringify(labels));
    assert.match(nav, /<button class="nav-item nav-link" type="button" data-trouble-open aria-label="분쟁·사고 도우미">\s*<svg class="nav-icon"[^>]*><use href="#lotbi-icon-lifebuoy"><\/use><\/svg>\s*<span class="nav-item-label">분쟁·사고 도우미<\/span>/u);
  }
  assert.equal((index.match(/id="lotbi-icon-lifebuoy"/gu) || []).length, 1);
});

await check('dialog: header LOTBI 분쟁·사고 도우미 / “막막할 때 롯비”, no login gate, styles on both entry pages', () => {
  const dialog = index.match(/<dialog class="trouble-dialog"[\s\S]*?<\/dialog>/u)?.[0] || '';
  assert.ok(dialog, 'dialog markup');
  assert.match(dialog, /<p class="trouble-dialog-eyebrow">LOTBI 분쟁·사고 도우미<\/p>/u);
  assert.match(dialog, /<h2 id="trouble-dialog-title">“막막할 때 롯비”<\/h2>/u);
  assert.match(dialog, /aria-labelledby="trouble-dialog-title"/u);
  assert.match(dialog, /data-trouble-progress[^>]*|aria-live="polite" data-trouble-progress/u);
  assert.doesNotMatch(dialog, /login|로그인/u, 'no login gate');
  assert.ok(index.indexOf('<dialog class="trouble-dialog"') > index.indexOf('<dialog class="scam-dialog"'));
  for (const [name, html] of [['index.html', index], ['auth/callback/index.html', callback]]) {
    const scam = html.indexOf('site-scam-shield.css?v=');
    const mine = html.indexOf('site-trouble-helper.css?v=');
    assert.ok(scam > 0 && mine > scam, `${name}: stylesheet after site-scam-shield.css`);
  }
  assert.match(conversation, /void import\('\.\/site-trouble-helper\.js\?v=aset-[0-9a-f]{12}'\)\.catch\(\(\) => \{\}\);/u,
    'loaded on the side from site-conversation.js, a failure there never stops the chat');
});

await check('sources: no HTML injection, storage only inside try, theme tokens only, no "dispute" names', () => {
  for (const [name, source] of [['site-trouble-helper.js', ui], ['site-trouble-helper-model.js', modelSource]]) {
    assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML\s*=|eval\(|new Function|document\.write/u, name);
    assert.doesNotMatch(source, /dispute/iu, name);
  }
  assert.doesNotMatch(modelSource, /localStorage|sessionStorage|document\.|window\./u, 'the model is pure');
  for (const match of ui.matchAll(/window\.(?:localStorage|sessionStorage)\.[a-zA-Z]+\(/gu)) {
    const before = ui.slice(Math.max(0, match.index - 160), match.index);
    assert.match(before, /try\s*\{[^}]*$/u, `storage call without try: ${ui.slice(match.index, match.index + 60)}`);
  }
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|data-site-theme|prefers-color-scheme/iu, 'theme tokens only');
  assert.doesNotMatch(css, /dispute/iu);
  assert.doesNotMatch(ui, /Authorization|credentials:\s*'include'|sessionToken/u, 'no login, no credentials');
});

// ── Pure rules ──────────────────────────────────────────────────────────
const model = await import('../site-trouble-helper-model.js');
const guides = model.normalizeGuides(FIXTURE);
const situation = id => model.findSituation(guides, id);

await check('Core answer: five situations in order, receipt_field_id honoured, fixture car guide carries no ratio', () => {
  assert.ok(guides);
  assert.deepEqual(guides.situations.map(item => item.id), ['CAR_ACCIDENT', 'USED_TRADE_FRAUD', 'WAGE_ARREARS', 'FLOOR_NOISE', 'OTHER_LEGAL']);
  assert.deepEqual(guides.situations.map(item => item.receiptFieldId), ['receipt', 'receipt', 'receipt', 'receipt', null]);
  assert.equal(guides.notice, FIXTURE.notice);
  assert.doesNotMatch(JSON.stringify(FIXTURE.situations[0]), RATIO_RE);
  assert.equal(model.guidesUrl(), 'https://api.lotbiai.com/v2/trouble-helper/guides');
  assert.equal(model.normalizeGuides({...FIXTURE, situations: []}), null);
  assert.equal(model.normalizeGuides({...FIXTURE, notice: ''}), null);
  assert.equal(model.normalizeGuides({...FIXTURE, status_track: FIXTURE.status_track.slice(1)}), null);
  assert.equal(model.normalizeGuides('nope'), null);
});

await check('fee line: 상담료 · 통화료 · 신청 수수료 each only when known', () => {
  const lines = Object.fromEntries([...guides.channels.values()].map(channel => [channel.id, model.feeLine(channel)]));
  for (const raw of FIXTURE.channels) {
    const expected = [];
    if (raw.consult_fee === 'FREE') expected.push('상담료 없음');
    if (raw.consult_fee === 'PAID') expected.push('상담료 있음');
    if (raw.call_cost === 'FREE') expected.push('통화료 없음');
    if (raw.call_cost === 'CALLER_PAYS') expected.push('통화료 별도');
    if (raw.procedure_fee === 'NONE') expected.push('신청 수수료 없음');
    if (raw.procedure_fee === 'FEE') expected.push(raw.procedure_fee_note);
    assert.equal(lines[raw.id], expected.join(' · '), raw.id);
  }
  assert.equal(lines.MY_INSURER, '', 'all UNKNOWN: nothing shown');
  assert.doesNotMatch(lines.MOEL_1350, /상담료/u, '1350 상담료 is UNKNOWN');
  const hours = channel => model.hoursLine(guides.channels.get(channel));
  assert.equal(hours('COMWEL_1588'), '운영시간은 전화로 확인해 주세요');
  assert.equal(hours('ECRM'), '', 'no phone: no "전화로 확인"');
  assert.match(hours('KLAC_132'), /^운영시간 평일/u);
});

await check('show_if, 접수번호 lock, fault portal sentence, share text, safe links', () => {
  const car = situation('CAR_ACCIDENT');
  assert.deepEqual(model.visibleQuestions(car, {place: 'oncoming'}).map(q => q.id), ['injury', 'other', 'place', 'my_move']);
  assert.deepEqual(model.visibleQuestions(car, {place: 'intersection'}).map(q => q.id), ['injury', 'other', 'place', 'signal', 'my_move']);
  assert.deepEqual(model.cleanAnswers(car, {place: 'oncoming', signal: 'yes'}), {place: 'oncoming'});
  assert.ok(!model.visibleSteps(car, {injury: 'no'}).some(step => step.id === 'call_119'));
  assert.ok(model.visibleSteps(car, {injury: 'unknown'}).some(step => step.id === 'call_119'));
  const answers = {injury: 'no', other: 'car', place: 'intersection', signal: 'yes', my_move: 'straight'};
  const portal = model.faultPortalGuide(car, answers);
  assert.deepEqual(portal.order, ['차 대 차', '교차로']);
  assert.equal(portal.selectUrl, FIXTURE.situations[0].fault_portal.select_url);
  assert.equal(portal.sentence, '교차로(사거리·삼거리)에서 다른 차와 부딪혔어요. 신호등은 있었어요. 내 차는 곧게 가고 있었어요.');
  assert.ok(portal.sentence.length >= 20 && portal.sentence.length <= 1000);
  const pm = model.faultPortalGuide(car, {...answers, other: 'pm', place: 'oncoming'});
  assert.equal(pm.selectUrl, FIXTURE.situations[0].fault_portal.pm_url);
  assert.equal(pm.sentence, '마주 오다가 전동킥보드와 부딪혔어요. 내 차는 곧게 가고 있었어요.');
  assert.doesNotMatch(JSON.stringify([portal, pm]), RATIO_RE);
  assert.equal(model.canChooseStatus(car, {}, 'SUBMITTED'), false);
  assert.equal(model.canChooseStatus(car, {receipt: '  '}, 'SUBMITTED'), false);
  assert.equal(model.canChooseStatus(car, {receipt: '2026-77'}, 'SUBMITTED'), true);
  assert.equal(model.canChooseStatus(car, {}, 'IN_PROGRESS'), true);
  assert.equal(model.canChooseStatus(situation('OTHER_LEGAL'), {}, 'SUBMITTED'), true, 'receipt_field_id null never locks');
  assert.equal(model.normalizeRecord(car, {status: 'SUBMITTED', fields: {}}).status, 'PREPARE');
  const record = model.normalizeRecord(car, {answers, fields: {receipt: '2026-77'}, status: 'SUBMITTED', createdOn: '2026-10-10'});
  const text = model.shareText(guides, car, record);
  const head = text.slice(0, 200);
  for (const line of [model.SHARE_SAFETY_LINE, FIXTURE.notice, '접수번호: 2026-77']) assert.ok(head.includes(line), `in the first 200 characters: ${line}`);
  assert.equal(model.SHARE_SAFETY_LINE, '인증번호·비밀번호는 가족에게도 보내지 마세요.');
  assert.equal(model.officialUrl('http://www.klac.or.kr/'), '');
  assert.equal(model.officialUrl('javascript:alert(1)'), '');
  assert.equal(model.officialUrl('https://example.com/'), '');
  assert.equal(model.officialUrl('https://www.korea.kr/news/x'), 'https://www.korea.kr/news/x');
  assert.equal(model.telHref('1588-0075'), 'tel:15880075');
  assert.equal(model.telHref('12a'), '');
  assert.doesNotMatch(model.savedAtLabel(new Date(2026, 9, 10, 21, 5)), RATIO_RE);
});

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the 분쟁·사고 도우미 validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, shots: true},
  {label: 'mobile-320x640', width: 320, height: 640, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

function buildInner(mode) {
  let html = index;
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('th-result');
const F = ${JSON.stringify(FIXTURE)};
const MODE = ${JSON.stringify(mode)};
try {
  if (sessionStorage.getItem('__thBooted') !== MODE) { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('__thBooted', MODE); }
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  const calls = globalThis.__thCalls = [];
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/trouble-helper/guides') {
      calls.push({url: parsed.href, method: init?.method || 'GET', credentials: init?.credentials || '', mode: init?.mode || '',
        headers: [...new Headers(init?.headers || {}).keys()]});
      return MODE === 'fail' ? json({detail: {code: 'UNAVAILABLE'}}, 503) : json(F);
    }
    if (parsed.pathname === '/app/config.json') return json({detail: 'missing'}, 404);
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
      guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  globalThis.__thPrints = [];
  window.print = () => { globalThis.__thPrints.push({printing: document.body.classList.contains('trouble-printing'), sheet: document.querySelector('[data-trouble-print-sheet]')?.textContent || ''}); };
  globalThis.__thShares = [];
  globalThis.__thCopies = [];
  Object.defineProperty(navigator, 'share', {configurable: true, writable: true, value: async data => { globalThis.__thShares.push(data); }});
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => { globalThis.__thCopies.push(text); }}});
  await import('/site-conversation.js?v=troublehelper01');
  const started = Date.now();
  while (document.querySelector('[data-trouble-open]')?.dataset.troubleBound !== 'true') {
    if (Date.now() - started > 20000) throw new Error('menu buttons never bound');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  out.textContent = JSON.stringify({ok: true});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); }
</script><pre id="th-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Page-side helpers, installed once per page load.
const HELPERS = `(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dialog = () => document.querySelector('[data-trouble-dialog]');
  const view = () => dialog()?.querySelector('[data-trouble-view]');
  const wait = async (fn, label, ms = 15000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + label + ' | ' + (view()?.textContent || '').slice(0, 300)); await sleep(40); } };
  const visible = n => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const describe = n => (n.dataset && Object.keys(n.dataset)[0] || n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height) + ':' + (n.textContent || '').trim().slice(0, 14);
  const targets = root => [...root.querySelectorAll('button, a[href], summary, textarea, label.trouble-check, label.trouble-status-option')].filter(visible);
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { const fg = parse(getComputedStyle(node).color).slice(0, 3), bg = bgOf(node); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return Math.round(((a + .05) / (b + .05)) * 100) / 100; };
  const textNodes = root => { const out = []; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (walker.nextNode()) { const t = walker.currentNode; const p = t.parentElement; if (!t.textContent.trim() || !p || p.closest('.trouble-sr') || !visible(p)) continue; out.push(p); } return [...new Set(out)]; };
  const measure = () => {
    const d = dialog();
    const body = d.querySelector('[data-trouble-scroll]');
    return {
      small: targets(d).filter(n => { const r = n.getBoundingClientRect(); return r.height < 47.5 || r.width < 47.5; }).map(describe),
      mainSmall: [...d.querySelectorAll('.trouble-button, .trouble-option, .trouble-situation, .trouble-tab, .trouble-dialog-close, .trouble-call')].filter(visible).filter(n => n.getBoundingClientRect().height < 55.5).map(describe),
      smallText: textNodes(d).filter(n => parseFloat(getComputedStyle(n).fontSize) < 19.5).map(n => describe(n) + ':' + getComputedStyle(n).fontSize).slice(0, 8),
      bigText: textNodes(d).filter(n => parseFloat(getComputedStyle(n).fontSize) > 28.5 && !n.matches('.trouble-dialog-close')).map(describe).slice(0, 8),
      overflow: [...d.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(describe).slice(0, 6),
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyScroll: body.scrollWidth - body.clientWidth,
      title: parseFloat(getComputedStyle(d.querySelector('#trouble-dialog-title')).fontSize),
      heading: parseFloat(getComputedStyle(d.querySelector('[data-trouble-heading]') || d.querySelector('#trouble-dialog-title')).fontSize),
      view: view()?.dataset.troubleView || '',
    };
  };
  const contrasts = () => {
    const d = dialog();
    const out = {};
    for (const node of textNodes(d)) {
      const key = describe(node).split(':')[0];
      const value = contrast(node);
      if (!(key in out) || value < out[key].value) out[key] = {value, fg: getComputedStyle(node).color, bg: bgOf(node).join(','), text: node.textContent.trim().slice(0, 16)};
    }
    return out;
  };
  const click = (selector, root) => { const node = (root || dialog()).querySelector(selector); if (!node) throw new Error('missing ' + selector + ' | ' + (view()?.textContent || '').slice(0, 200)); node.click(); return node; };
  const answer = async (questionText, optionId) => {
    await wait(() => view()?.dataset.troubleView === 'question' && view().querySelector('[data-trouble-heading]')?.textContent === questionText, 'question ' + questionText);
    const progress = dialog().querySelector('[data-trouble-progress]').textContent;
    click('[data-trouble-option="' + optionId + '"]');
    await sleep(30);
    return progress;
  };
  const dialogText = () => dialog().textContent;
  window.__th = {sleep, dialog, view, wait, measure, contrasts, contrast, click, answer, dialogText, visible};
  return true;
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
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
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
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

async function withPage(browser, dir, testCase, url, run) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(`${testCase.label}: ${JSON.stringify(result.exceptionDetails).slice(0, 2000)}`);
      return result.result.value;
    };
    const ready = async () => {
      const text = await waitFor(async () => {
        const value = await evaluate("document.getElementById('th-result')?.textContent || 'pending'").catch(() => 'pending');
        return value !== 'pending' ? value : null;
      }, `${testCase.label}: harness`, 60000);
      const parsed = JSON.parse(text);
      if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
      await evaluate(HELPERS);
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url});
    await ready();
    const shoot = async name => {
      const target = process.env.TROUBLE_HELPER_SCREENSHOT_DIR || '';
      if (!target || !testCase.shots) return;
      fs.mkdirSync(target, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(target, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    return await run({page, evaluate, ready, shoot});
  } finally {
    cdp.close();
  }
}

const themed = async (evaluate, shoot, name) => {
  const out = {};
  for (const mode of ['light', 'dark']) {
    await evaluate(`document.body.dataset.siteTheme = '${mode}'; new Promise(r => setTimeout(() => r(true), 60))`);
    out[mode] = await evaluate('__th.contrasts()');
    await shoot(`${name}-${mode}`);
  }
  await evaluate("document.body.dataset.siteTheme = 'light'; true");
  return out;
};

const OPEN = mobile => `(async () => {
  if (${mobile ? 'true' : 'false'}) {
    document.querySelector('[data-mobile-nav-open]').click();
    await __th.wait(() => document.body.classList.contains('nav-drawer-open'), 'drawer');
    document.querySelector('#mobile-nav-drawer [data-trouble-open]').click();
  } else {
    document.querySelector('.chat-sidebar-desktop [data-trouble-open]').click();
  }
  await __th.wait(() => __th.dialog().open, 'dialog open');
  return {drawerOpen: document.body.classList.contains('nav-drawer-open'), eyebrow: __th.dialog().querySelector('.trouble-dialog-eyebrow').textContent,
    title: __th.dialog().querySelector('#trouble-dialog-title').textContent};
})()`;

async function runFlow(browser, origin, dir, testCase) {
  return withPage(browser, dir, testCase, `${origin}/scripts/${path.basename(dir)}/inner.html`, async ({page, evaluate, ready, shoot}) => {
    const r = {};
    r.menus = await evaluate(`[...document.querySelectorAll('[data-trouble-open]')].map(n => ({inDrawer: Boolean(n.closest('#mobile-nav-drawer')),
      prev: n.previousElementSibling?.getAttribute('aria-label'), label: n.textContent.trim()}))`);
    r.open = await evaluate(OPEN(testCase.mobile));
    await evaluate("__th.wait(() => __th.view()?.dataset.troubleView === 'pick', 'pick view')");
    r.pick = await evaluate(`({
      situations: [...__th.view().querySelectorAll('[data-trouble-situation]')].map(n => [n.dataset.troubleSituation, n.querySelector('strong').textContent, n.querySelector('span')?.textContent || '']),
      notice: __th.view().querySelector('[data-trouble-notice]')?.textContent || '',
      login: Boolean(__th.dialog().querySelector('[data-scam-login], a[href*="auth"]')) || /로그인/.test(__th.dialogText()),
      calls: globalThis.__thCalls, measure: __th.measure(), focus: document.activeElement?.matches('[data-trouble-heading]') || false})`);
    r.pickThemes = await themed(evaluate, shoot, 'pick');

    // ② 자동차 사고 — one question at a time; 신호등 appears only for 교차로.
    r.car = await evaluate(`(async () => {
      __th.click('[data-trouble-situation="CAR_ACCIDENT"]');
      const p = [];
      p.push(await __th.answer('다친 사람이 있나요?', 'no'));
      p.push(await __th.answer('무엇과 부딪혔나요?', 'car'));
      await __th.wait(() => __th.view().querySelector('[data-trouble-heading]')?.textContent === '어디서 났나요?', 'place');
      p.push(__th.dialog().querySelector('[data-trouble-progress]').textContent);
      const questionMeasure = __th.measure();
      questionMeasure.shortcutWhileUnanswered = Boolean(__th.view().querySelector('[data-trouble-resume-steps]'));
      __th.click('[data-trouble-option="oncoming"]');
      await __th.wait(() => __th.view().querySelector('[data-trouble-heading]')?.textContent === '내 차는 어떻게 움직이고 있었나요?', 'my_move after oncoming');
      p.push(__th.dialog().querySelector('[data-trouble-progress]').textContent);
      __th.click('[data-trouble-back]');
      await __th.wait(() => __th.view().querySelector('[data-trouble-heading]')?.textContent === '어디서 났나요?', 'back to place');
      const pressed = __th.view().querySelector('[aria-pressed="true"]')?.dataset.troubleOption;
      p.push(await __th.answer('어디서 났나요?', 'intersection'));
      p.push(await __th.answer('신호등이 있었나요?', 'yes'));
      p.push(await __th.answer('내 차는 어떻게 움직이고 있었나요?', 'straight'));
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'steps');
      return {progress: p, pressed, questionMeasure};
    })()`);
    r.resume = await evaluate(`(async () => {
      __th.click('[data-trouble-back]');
      await __th.wait(() => __th.view().dataset.troubleView === 'question', 'q again');
      const shortcut = __th.view().querySelector('[data-trouble-resume-steps]');
      return {label: shortcut?.textContent || '', pick: Boolean(__th.view().querySelector('[data-trouble-pick]'))};
    })()`);
    await shoot('question');
    r.questionThemes = await themed(evaluate, shoot, 'question');
    await evaluate(`(async () => {
      for (const [text, option] of [['다친 사람이 있나요?', 'no'], ['무엇과 부딪혔나요?', 'car'], ['어디서 났나요?', 'intersection'], ['신호등이 있었나요?', 'yes'], ['내 차는 어떻게 움직이고 있었나요?', 'straight']]) await __th.answer(text, option);
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'steps again');
      return true;
    })()`);
    const carTexts = [];
    // ③ 할 일
    r.steps = await evaluate(`(async () => {
      const v = __th.view();
      const cards = [...v.querySelectorAll('[data-trouble-step]')];
      const card = id => v.querySelector('[data-trouble-step="' + id + '"]');
      const result = {
        ids: cards.map(n => n.dataset.troubleStep),
        urgent: cards.filter(n => n.dataset.urgent === 'true').map(n => [n.dataset.troubleStep, n.querySelector('.trouble-step-urgent')?.textContent || '', getComputedStyle(n).borderLeftWidth]),
        numbers: cards.map(n => n.querySelector('h4').textContent.trim().split(' ')[0]),
        notice: v.querySelector('[data-trouble-situation-notice]')?.textContent || '',
        tel112: card('call_112')?.querySelector('a[href^="tel:"]')?.getAttribute('href') || '',
        insurer: card('insurer')?.textContent || '',
        speak: cards.every(n => n.querySelector('.chat-message-action-read')),
        checks: cards.every(n => n.querySelector('[data-trouble-step-done]')),
        tabs: [...v.querySelectorAll('[data-trouble-tab]')].map(n => [n.dataset.troubleTab, n.getAttribute('aria-current') || '']),
        portal: {
          order: v.querySelector('[data-trouble-portal-order]')?.textContent || '',
          select: v.querySelector('[data-trouble-portal-select]')?.getAttribute('href') || '',
          sentence: v.querySelector('[data-trouble-portal-sentence]')?.textContent || '',
          describe: v.querySelector('[data-trouble-portal-describe]')?.getAttribute('href') || '',
          note: v.querySelector('[data-trouble-portal]')?.textContent || '',
          targets: [...v.querySelectorAll('[data-trouble-portal] a')].map(a => a.target + '|' + a.rel),
        },
      };
      const box = card('photos').querySelector('[data-trouble-step-done]');
      box.click();
      result.doneAfter = card('photos').dataset.done;
      __th.click('[data-trouble-portal-copy]');
      await __th.wait(() => globalThis.__thCopies.length, 'portal copy');
      result.copied = globalThis.__thCopies.at(-1);
      result.measure = __th.measure();
      result.text = __th.dialogText();
      return result;
    })()`);
    carTexts.push(r.steps.text);
    await shoot('steps');
    r.stepsThemes = await themed(evaluate, shoot, 'steps');
    // Scrolling to the portal box (as a focus move would) scrolls the dialog's
    // body only; the dialog box itself never moves, so its header stays.
    r.scrolled = await evaluate(`(async () => {
      __th.view().querySelector('[data-trouble-portal]').scrollIntoView();
      await __th.sleep(60);
      const d = __th.dialog();
      return {dialogTop: d.scrollTop, dialogOverflow: d.scrollHeight - d.clientHeight, bodyTop: d.querySelector('[data-trouble-scroll]').scrollTop,
        headerTop: Math.round(d.querySelector('.trouble-dialog-header').getBoundingClientRect().top - d.getBoundingClientRect().top)};
    })()`);
    await shoot('steps-portal');

    // ④ 모을 증거 · 참고 기준 · 공식 창구
    r.help = await evaluate(`(async () => {
      __th.click('[data-trouble-next]');
      await __th.wait(() => __th.view().dataset.troubleView === 'help', 'help');
      const v = __th.view();
      const channel = id => v.querySelector('[data-trouble-channel="' + id + '"]');
      const routeHeights = id => [...channel(id).querySelectorAll('.trouble-channel-routes > *')].map(n => [n.matches('a[href^="tel:"]') ? 'tel' : n.dataset.troubleOnline ? 'online' : n.dataset.troubleNoAuth ? 'noauth' : n.className, Math.round(n.getBoundingClientRect().height)]);
      const evidence = [...v.querySelectorAll('[data-trouble-evidence]')];
      evidence[0].click(); evidence[2].click();
      const r = {
        evidence: evidence.map(n => n.dataset.troubleEvidence),
        references: [...v.querySelectorAll('[data-trouble-reference]')].map(a => [a.getAttribute('href'), a.target, a.rel]),
        channels: [...v.querySelectorAll('[data-trouble-channel]')].map(n => n.dataset.troubleChannel),
        fire: {tel: channel('FIRE_119').querySelector('a[href^="tel:"]')?.getAttribute('href'), fees: channel('FIRE_119').querySelector('[data-trouble-fees]')?.textContent, hours: channel('FIRE_119').querySelector('[data-trouble-hours]')?.textContent},
        insurer: {fees: channel('MY_INSURER').querySelector('[data-trouble-fees]')?.textContent || '', hours: channel('MY_INSURER').querySelector('[data-trouble-hours]')?.textContent || '', text: channel('MY_INSURER').textContent},
        knia: {hours: channel('KNIA_PORTAL').querySelector('[data-trouble-hours]')?.textContent || '', verified: channel('KNIA_PORTAL').querySelector('[data-trouble-verified]')?.textContent || '',
          sources: [...channel('KNIA_PORTAL').querySelectorAll('[data-trouble-verified] a')].map(a => [a.getAttribute('href'), a.target]), routes: routeHeights('KNIA_PORTAL')},
        script: Boolean(v.querySelector('[data-trouble-call-script] summary')),
        measure: __th.measure(),
      };
      v.querySelector('[data-trouble-call-script]').open = true;
      await __th.sleep(40);
      r.measureOpen = __th.measure();
      r.text = __th.dialogText();
      return r;
    })()`);
    carTexts.push(r.help.text);
    await shoot('help');
    r.helpThemes = await themed(evaluate, shoot, 'help');

    // ⑤ 상황 정리표 — 'SUBMITTED' waits for the 접수번호.
    r.summary = await evaluate(`(async () => {
      __th.click('[data-trouble-next]');
      await __th.wait(() => __th.view().dataset.troubleView === 'summary', 'summary');
      const v = __th.view();
      const submitted = () => v.querySelector('[data-trouble-status-choice="SUBMITTED"]');
      const hint = () => v.querySelector('[data-trouble-receipt-hint]');
      const type = (id, value) => { const area = v.querySelector('[data-trouble-field="' + id + '"]'); area.value = value; area.dispatchEvent(new Event('input', {bubbles: true})); };
      const r = {
        fields: [...v.querySelectorAll('[data-trouble-field]')].map(n => n.dataset.troubleField),
        statuses: [...v.querySelectorAll('[data-trouble-status-option]')].map(n => n.textContent.trim()),
        lockedAtStart: submitted().disabled, hintAtStart: __th.visible(hint()) ? hint().textContent : '',
        answers: [...v.querySelectorAll('[data-trouble-answers] li')].map(n => n.textContent),
        sheet: v.querySelector('[data-trouble-sheet]').textContent,
        safety: [...v.querySelectorAll('[data-trouble-safety] li')].map(n => n.textContent),
      };
      submitted().click();
      r.checkedWhileLocked = submitted().checked;
      type('receipt', '보험-2026-7788');
      r.lockedAfterReceipt = submitted().disabled; r.hintAfterReceipt = __th.visible(hint());
      submitted().click();
      r.checkedAfterReceipt = submitted().checked;
      type('receipt', '');
      r.lockedAfterClear = submitted().disabled;
      r.statusAfterClear = v.querySelector('[data-trouble-status-choice]:checked')?.value;
      type('receipt', '보험-2026-7788');
      submitted().click();
      type('when_where', '10월 10일 오후, 전주 덕진구 사거리');
      __th.click('[data-trouble-save]');
      r.saveStatus = __th.dialog().querySelector('[data-trouble-status]').textContent;
      r.stored = JSON.parse(localStorage.getItem('lotbi.site.ux.v1.trouble-helper') || 'null');
      __th.click('[data-trouble-print]');
      r.prints = globalThis.__thPrints.slice();
      await __th.sleep(300);
      __th.click('[data-trouble-share]');
      r.shareInsideTap = globalThis.__thShares.length === 1;
      await __th.wait(() => globalThis.__thShares.length, 'share');
      r.share = globalThis.__thShares.at(-1);
      Object.defineProperty(navigator, 'share', {configurable: true, writable: true, value: undefined});
      const copies = globalThis.__thCopies.length;
      __th.click('[data-trouble-share]');
      await __th.wait(() => globalThis.__thCopies.length > copies, 'copy fallback');
      await __th.wait(() => /복사/.test(__th.dialog().querySelector('[data-trouble-status]').textContent), 'copy status');
      r.copied = globalThis.__thCopies.at(-1);
      r.copyStatus = __th.dialog().querySelector('[data-trouble-status]').textContent;
      r.measure = __th.measure();
      r.text = __th.dialogText();
      return r;
    })()`);
    carTexts.push(r.summary.text);
    await shoot('summary');
    r.summaryThemes = await themed(evaluate, shoot, 'summary');
    await evaluate("(async () => { __th.view().querySelector('[data-trouble-status-group]').scrollIntoView(); await __th.sleep(60); return true; })()");
    await shoot('summary-status');

    // 인쇄: in print media only the large-print sheet shows.
    await page('Emulation.setEmulatedMedia', {media: 'print', features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    r.print = await evaluate(`(() => {
      document.body.classList.add('trouble-printing');
      const sheet = document.querySelector('[data-trouble-print-sheet]');
      const out = {sheet: sheet ? getComputedStyle(sheet).display : 'none', size: sheet ? parseFloat(getComputedStyle(sheet).fontSize) : 0,
        h1: sheet ? parseFloat(getComputedStyle(sheet.querySelector('h1')).fontSize) : 0,
        shell: getComputedStyle(document.querySelector('.chat-app-shell')).display, dialog: getComputedStyle(__th.dialog()).display,
        text: sheet?.textContent || ''};
      document.body.classList.remove('trouble-printing');
      return out;
    })()`);
    await page('Emulation.setEmulatedMedia', {media: '', features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});

    // Reload: the dialog reopens on the 정리표 with what was written. The old
    // page's "ready" mark is cleared first so only the new page can answer.
    await evaluate("document.getElementById('th-result').textContent = 'pending'; true");
    await page('Page.reload', {});
    await ready();
    r.reload = await evaluate(`(async () => {
      await __th.wait(() => __th.dialog().open && __th.view()?.dataset.troubleView === 'summary', 'reopened on summary');
      const v = __th.view();
      return {receipt: v.querySelector('[data-trouble-field="receipt"]').value, when: v.querySelector('[data-trouble-field="when_where"]').value,
        status: v.querySelector('[data-trouble-status-choice]:checked')?.value, evidence: v.querySelector('[data-trouble-sheet]').textContent};
    })()`);

    // Another situation: show_if steps, 진위확인 link, "인증이 안 돼요".
    r.fraud = await evaluate(`(async () => {
      __th.click('[data-trouble-pick]');
      await __th.wait(() => __th.view().dataset.troubleView === 'pick', 'pick again');
      const resume = __th.view().querySelector('[data-trouble-situation="CAR_ACCIDENT"] .trouble-resume')?.textContent || '';
      __th.click('[data-trouble-situation="USED_TRADE_FRAUD"]');
      const progress = [await __th.answer('돈을 보냈나요?', 'not_yet')];
      progress.push(await __th.answer('판매자와 지금도 연락이 되나요?', 'yes'));
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'fraud steps');
      const v = __th.view();
      const r = {resume, progress, ids: [...v.querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep),
        scam: Boolean(v.querySelector('[data-trouble-step="lookup_before"] [data-trouble-scam-shield]'))};
      __th.click('[data-trouble-back]');
      await __th.wait(() => __th.view().dataset.troubleView === 'question', 'fraud back');
      for (const [text, option] of [['돈을 보냈나요?', 'bank'], ['언제 보냈나요?', 'today'], ['판매자와 지금도 연락이 되나요?', 'no']]) progress.push(await __th.answer(text, option));
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'fraud steps 2');
      r.bankIds = [...__th.view().querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep);
      const police = __th.view().querySelector('[data-trouble-step="police_report"]');
      const kind = n => n.matches('a[href^="tel:"]') ? 'tel' : n.dataset.troubleOnline ? 'online' : n.dataset.troubleNoAuth ? 'noauth' : n.dataset.troubleVisit ? 'visit' : n.className;
      r.policeRoutes = [...police.querySelectorAll('.trouble-step-actions > *')].map(kind);
      police.querySelector('[data-trouble-no-auth]').click();
      await __th.sleep(60);
      const policeAfter = __th.view().querySelector('[data-trouble-step="police_report"]');
      r.policeRoutesOffline = [...policeAfter.querySelectorAll('.trouble-step-actions > *')].map(kind);
      r.noAuthPressed = policeAfter.querySelector('[data-trouble-no-auth]').getAttribute('aria-pressed');
      r.noAuthFocus = document.activeElement?.dataset?.troubleNoAuth || '';
      __th.click('[data-trouble-next]');
      await __th.wait(() => __th.view().dataset.troubleView === 'help', 'fraud help');
      const ecrm = () => __th.view().querySelector('[data-trouble-channel="ECRM"]');
      r.channelsOffline = [...__th.view().querySelectorAll('[data-trouble-channel]')].map(n => n.dataset.troubleChannel);
      r.ecrmOffline = [...ecrm().querySelectorAll('.trouble-channel-routes > *')].map(n => n.dataset.troubleVisit !== undefined ? 'visit' : n.dataset.troubleOnline ? 'online' : n.dataset.troubleNoAuth ? 'noauth' : n.tagName);
      ecrm().querySelector('[data-trouble-no-auth]').click();
      await __th.sleep(60);
      r.channelsOnline = [...__th.view().querySelectorAll('[data-trouble-channel]')].map(n => n.dataset.troubleChannel);
      r.ecrmOnline = [...ecrm().querySelectorAll('.trouble-channel-routes > *')].map(n => n.dataset.troubleOnline ? 'online' : n.dataset.troubleNoAuth ? 'noauth' : n.tagName);
      r.ecrmHours = ecrm().querySelector('[data-trouble-hours]')?.textContent || '';
      r.measure = __th.measure();
      return r;
    })()`);

    // 그 밖의 법률 고민: goto 월급 못 받음; receipt_field_id null never locks.
    r.other = await evaluate(`(async () => {
      __th.click('[data-trouble-pick]');
      await __th.wait(() => __th.view().dataset.troubleView === 'pick', 'pick 3');
      __th.click('[data-trouble-situation="OTHER_LEGAL"]');
      await __th.answer('어떤 문제인가요?', 'work');
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'other steps');
      const r = {ids: [...__th.view().querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep)};
      __th.click('[data-trouble-tab="summary"]');
      await __th.wait(() => __th.view().dataset.troubleView === 'summary', 'other summary');
      r.submittedLocked = __th.view().querySelector('[data-trouble-status-choice="SUBMITTED"]').disabled;
      r.hintShown = __th.visible(__th.view().querySelector('[data-trouble-receipt-hint]'));
      r.statuses = [...__th.view().querySelectorAll('[data-trouble-status-option]')].map(n => n.textContent.trim());
      __th.click('[data-trouble-tab="steps"]');
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'other steps 2');
      __th.click('[data-trouble-goto="WAGE_ARREARS"]');
      await __th.wait(() => __th.view().dataset.troubleView === 'question' && __th.view().querySelector('[data-trouble-heading]').textContent === '지금도 그 회사에 다니시나요?', 'wage question');
      for (const [text, option] of [['지금도 그 회사에 다니시나요?', 'left'], ['근로계약서나 월급 명세서가 있나요?', 'yes'], ['회사가 문을 닫았거나 사장님과 연락이 안 되나요?', 'yes']]) await __th.answer(text, option);
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'wage steps');
      r.wageIds = [...__th.view().querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep);
      r.duration = __th.view().querySelector('[data-trouble-step="file_petition"] [data-trouble-duration]')?.textContent || '';
      __th.click('[data-trouble-next]');
      await __th.wait(() => __th.view().dataset.troubleView === 'help', 'wage help');
      const moel = __th.view().querySelector('[data-trouble-channel="MOEL_1350"]');
      r.moelFees = moel.querySelector('[data-trouble-fees]')?.textContent || '';
      r.measure = __th.measure();
      return r;
    })()`);
    await shoot('wage-help');

    // 처음부터 다시 takes two presses; then 진위확인 link closes this dialog.
    r.reset = await evaluate(`(async () => {
      const first = __th.click('[data-trouble-reset]');
      const armed = first.textContent;
      const stillHere = __th.view().dataset.troubleView;
      __th.click('[data-trouble-reset]');
      await __th.wait(() => __th.view().dataset.troubleView === 'pick', 'reset to pick');
      const stored = JSON.parse(localStorage.getItem('lotbi.site.ux.v1.trouble-helper') || 'null');
      __th.click('[data-trouble-situation="USED_TRADE_FRAUD"]');
      await __th.wait(() => __th.view().dataset.troubleView === 'help', 'fraud resumes where it was left');
      __th.click('[data-trouble-tab="steps"]');
      await __th.wait(() => __th.view().dataset.troubleView === 'steps', 'fraud steps tab');
      __th.click('[data-trouble-back]');
      await __th.wait(() => __th.view().dataset.troubleView === 'question', 'fraud q');
      for (const [text, option] of [['돈을 보냈나요?', 'not_yet'], ['판매자와 지금도 연락이 되나요?', 'yes']]) await __th.answer(text, option);
      await __th.wait(() => __th.view().querySelector('[data-trouble-scam-shield]'), 'scam link');
      __th.click('[data-trouble-scam-shield]');
      await __th.wait(() => !__th.dialog().open && document.querySelector('[data-scam-dialog]')?.open, 'scam opened');
      const scamOpen = document.querySelector('[data-scam-dialog]').open;
      document.querySelector('[data-scam-dialog] [data-scam-close]').click();
      await __th.wait(() => !document.querySelector('[data-scam-dialog]').open, 'scam closed', 5000);
      return {armed, stillHere, wageGone: !stored.cases.WAGE_ARREARS, carKept: Boolean(stored.cases.CAR_ACCIDENT), scamOpen,
        flag: sessionStorage.getItem('lotbi.trouble-helper.open.v1')};
    })()`);

    // × closes and the reload no longer reopens it.
    await evaluate(OPEN(testCase.mobile));
    r.close = await evaluate(`(async () => {
      __th.click('[data-trouble-close]');
      await __th.wait(() => !__th.dialog().open, 'closed');
      return {flag: sessionStorage.getItem('lotbi.trouble-helper.open.v1'), focus: document.activeElement?.matches('[data-trouble-open], [data-mobile-nav-open]') || false};
    })()`);
    r.carTexts = carTexts;
    return r;
  });
}

async function runFailure(browser, origin, dir, testCase) {
  return withPage(browser, dir, testCase, `${origin}/scripts/${path.basename(dir)}/fail.html`, async ({evaluate, shoot}) => {
    await evaluate(OPEN(testCase.mobile));
    const r = await evaluate(`(async () => {
      await __th.wait(() => __th.view()?.dataset.troubleView === 'error', 'error view');
      const v = __th.view();
      return {text: v.querySelector('[data-trouble-failure]').textContent,
        calls: [...v.querySelectorAll('[data-trouble-fallback-call]')].map(a => [a.getAttribute('href'), a.textContent, Math.round(a.getBoundingClientRect().height)]),
        retry: Boolean(v.querySelector('[data-trouble-retry]')), measure: __th.measure(), requests: globalThis.__thCalls.length};
    })()`);
    await shoot('failure');
    r.themes = await themed(evaluate, shoot, 'failure');
    r.retried = await evaluate(`(async () => { __th.click('[data-trouble-retry]'); await __th.wait(() => globalThis.__thCalls.length >= 2, 'retry'); await __th.wait(() => __th.view().dataset.troubleView === 'error', 'error again'); return globalThis.__thCalls.length; })()`);
    return r;
  });
}

async function serverPort(child) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    child.once('error', reject);
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const assertReadable = (themes, label) => {
  for (const [mode, values] of Object.entries(themes)) {
    for (const [key, value] of Object.entries(values)) assert.ok(value.value >= 4.5, `${label} ${mode} ${key} contrast ${JSON.stringify(value)}`);
  }
};
const assertElderly = (m, label, width) => {
  assert.deepEqual(m.overflow, [], `${label}: overflow`);
  assert.ok(m.page <= 0, `${label}: page scrolls sideways by ${m.page}`);
  assert.ok(m.bodyScroll <= 0, `${label}: dialog scrolls sideways by ${m.bodyScroll}`);
  assert.deepEqual(m.small, [], `${label}: targets under 48px`);
  assert.deepEqual(m.mainSmall, [], `${label}: main buttons under 56px`);
  assert.deepEqual(m.smallText, [], `${label}: text under 20px`);
  assert.deepEqual(m.bigText, [], `${label}: text over 28px`);
  assert.ok(m.title >= 26 && m.title <= 28, `${label}: title ${m.title}`);
  assert.ok(m.heading >= 26 && m.heading <= 28, `${label}: heading ${m.heading}`);
  assert.ok(width, label);
};

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.validate-trouble-helper-01-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner('ok'), 'utf8');
  fs.writeFileSync(path.join(dir, 'fail.html'), buildInner('fail'), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const label = testCase.label;
    const r = await runFlow(browser, origin, dir, testCase);
    await check(`${label}: both menus open it without a login; Core read is public (credentials omit, no headers)`, () => {
      assert.deepEqual(r.menus.map(m => [m.inDrawer, m.prev, m.label]), [[false, '진위확인', '분쟁·사고 도우미'], [true, '진위확인', '분쟁·사고 도우미']]);
      assert.equal(r.open.eyebrow, 'LOTBI 분쟁·사고 도우미');
      assert.equal(r.open.title, '“막막할 때 롯비”');
      assert.equal(r.open.drawerOpen, false, 'the drawer closes behind the dialog');
      assert.equal(r.pick.login, false);
      assert.equal(r.pick.calls.length, 1);
      assert.deepEqual(r.pick.calls[0], {url: 'https://api.lotbiai.com/v2/trouble-helper/guides', method: 'GET', credentials: 'omit', mode: 'cors', headers: []});
    });
    await check(`${label}: ① five situations in order under the notice`, () => {
      assert.deepEqual(r.pick.situations, FIXTURE.situations.map(item => [item.id, item.title, item.subtitle]));
      assert.equal(r.pick.notice, FIXTURE.notice);
      assert.equal(r.pick.focus, true, 'focus on the heading');
      assertElderly(r.pick.measure, `${label} pick`, testCase.width);
      assertReadable(r.pickThemes, `${label} pick`);
    });
    await check(`${label}: ② one question per screen, show_if, n/m progress, back keeps the answer`, () => {
      assert.deepEqual(r.car.progress, ['질문 1/4', '질문 2/4', '질문 3/4', '질문 4/4', '질문 3/4', '질문 4/5', '질문 5/5']);
      assert.equal(r.car.pressed, 'oncoming');
      assert.equal(r.car.questionMeasure.shortcutWhileUnanswered, false, 'no shortcut before every question is answered');
      assert.equal(r.resume.label, '답 그대로 할 일 보기 →', 'back on question 1 with every answer kept: a shortcut to the steps');
      assert.equal(r.resume.pick, false, 'question 1 has its own ← 상황 다시 고르기, no second one');
      assertElderly(r.car.questionMeasure, `${label} question`, testCase.width);
      assertReadable(r.questionThemes, `${label} question`);
    });
    await check(`${label}: ③ numbered steps, urgent band, tel, 했어요, 읽어주기, 과실비율정보포털 way in`, () => {
      assert.deepEqual(r.steps.ids, ['stay_safe', 'call_112', 'photos', 'blackbox', 'insurer', 'fault_reference']);
      assert.deepEqual(r.steps.numbers, ['1.', '2.', '3.', '4.', '5.', '6.']);
      assert.deepEqual(r.steps.urgent.map(item => item[0]), ['stay_safe']);
      assert.equal(r.steps.urgent[0][1], '급해요 · 먼저 하세요');
      assert.equal(r.steps.urgent[0][2], '10px');
      assert.equal(r.steps.notice, FIXTURE.situations[0].notice);
      assert.equal(r.steps.tel112, 'tel:112');
      assert.match(r.steps.insurer, /번호는 보험증권이나 보험사 앱에 있어요/u);
      assert.ok(r.steps.speak && r.steps.checks);
      assert.deepEqual(r.steps.tabs, [['steps', 'step'], ['help', ''], ['summary', '']]);
      assert.equal(r.steps.doneAfter, 'true');
      assert.equal(r.steps.portal.order, '차 대 차 → 교차로');
      assert.equal(r.steps.portal.select, FIXTURE.situations[0].fault_portal.select_url);
      assert.equal(r.steps.portal.sentence, '교차로(사거리·삼거리)에서 다른 차와 부딪혔어요. 신호등은 있었어요. 내 차는 곧게 가고 있었어요.');
      assert.equal(r.steps.portal.describe, FIXTURE.situations[0].fault_portal.describe_url);
      assert.ok(r.steps.portal.note.includes(FIXTURE.situations[0].fault_portal.copy_note));
      assert.ok(r.steps.portal.targets.every(value => value === '_blank|noopener noreferrer'));
      assert.equal(r.steps.copied, r.steps.portal.sentence);
      assert.equal(r.scrolled.dialogTop, 0, 'the dialog box never scrolls');
      assert.ok(r.scrolled.dialogOverflow <= 2, `nothing overflows the dialog box: ${JSON.stringify(r.scrolled)}`);
      assert.ok(r.scrolled.bodyTop > 0 && r.scrolled.headerTop <= 1, JSON.stringify(r.scrolled));
      assertElderly(r.steps.measure, `${label} steps`, testCase.width);
      assertReadable(r.stepsThemes, `${label} steps`);
    });
    await check(`${label}: ④ evidence, references, channels with fee/hours/확인일·근거; phone ≥ online`, () => {
      assert.deepEqual(r.help.evidence, FIXTURE.situations[0].evidence.map(item => item.id));
      assert.deepEqual(r.help.references, FIXTURE.situations[0].references.map(item => [item.url, '_blank', 'noopener noreferrer']));
      assert.deepEqual(r.help.channels, FIXTURE.situations[0].channel_ids);
      assert.deepEqual(r.help.fire, {tel: 'tel:119', fees: '상담료 없음 · 통화료 없음 · 신청 수수료 없음', hours: '운영시간 365일 24시간'});
      assert.equal(r.help.insurer.fees, '');
      assert.equal(r.help.insurer.hours, '');
      assert.equal(r.help.knia.hours, '운영시간은 전화로 확인해 주세요');
      const knia = FIXTURE.channels.find(item => item.id === 'KNIA_PORTAL');
      assert.match(r.help.knia.verified, new RegExp(`^확인일 ${knia.verified_at} · 근거 보기`, 'u'));
      assert.deepEqual(r.help.knia.sources, [knia.source_url, ...(knia.other_source_urls || [])].map(url => [new URL(url).href, '_blank']));
      const tel = r.help.knia.routes.find(item => item[0] === 'tel');
      const online = r.help.knia.routes.find(item => item[0] === 'online');
      assert.ok(tel && online && tel[1] >= online[1], JSON.stringify(r.help.knia.routes));
      assert.equal(r.help.knia.routes[0][0], 'tel', 'phone first');
      assert.ok(r.help.script);
      assertElderly(r.help.measure, `${label} help`, testCase.width);
      assertElderly(r.help.measureOpen, `${label} help (script open)`, testCase.width);
      assertReadable(r.helpThemes, `${label} help`);
    });
    await check(`${label}: ⑤ 정리표 — 'SUBMITTED' only with a 접수번호; save, print, 카카오 → share → copy`, () => {
      assert.deepEqual(r.summary.fields, FIXTURE.situations[0].summary_fields.map(item => item.id));
      const labels = FIXTURE.situations[0].status_labels;
      assert.deepEqual(r.summary.statuses, FIXTURE.status_track.map(item => labels[item.id] || item.label));
      assert.equal(r.summary.lockedAtStart, true);
      assert.equal(r.summary.hintAtStart, '접수번호를 적으면 고를 수 있어요');
      assert.equal(r.summary.checkedWhileLocked, false);
      assert.equal(r.summary.lockedAfterReceipt, false);
      assert.equal(r.summary.hintAfterReceipt, false);
      assert.equal(r.summary.checkedAfterReceipt, true);
      assert.equal(r.summary.lockedAfterClear, true);
      assert.equal(r.summary.statusAfterClear, 'PREPARE');
      assert.ok(r.summary.answers.includes('신호등이 있었나요? 있었어요'), JSON.stringify(r.summary.answers));
      const carSteps = FIXTURE.situations[0].steps;
      assert.ok(r.summary.sheet.includes(carSteps.find(step => step.id === 'photos').title), 'done step listed');
      const carEvidence = FIXTURE.situations[0].evidence;
      for (const index of [0, 2]) assert.ok(r.summary.sheet.includes(carEvidence[index].label), 'checked evidence listed');
      assert.deepEqual(r.summary.safety, FIXTURE.safety_notes);
      assert.match(r.summary.saveStatus, /^이 휴대폰에 저장했어요\. \(\d+월 \d+일 오[전후] \d+시 \d+분\)$/u);
      const stored = r.summary.stored.cases.CAR_ACCIDENT;
      assert.equal(stored.fields.receipt, '보험-2026-7788');
      assert.equal(stored.status, 'SUBMITTED');
      assert.equal(stored.answers.signal, 'yes');
      assert.equal(r.summary.prints.length, 1);
      assert.equal(r.summary.prints[0].printing, true);
      assert.match(r.summary.prints[0].sheet, /자동차 사고/u);
      assert.match(r.summary.prints[0].sheet, /보험-2026-7788/u);
      for (const shared of [r.summary.share.text, r.summary.copied]) {
        assert.ok(shared.includes(FIXTURE.notice), 'notice in the sent text');
        assert.ok(shared.includes('인증번호·비밀번호는 가족에게도 보내지 마세요'), 'safety line in the sent text');
        assert.ok(shared.includes('접수번호: 보험-2026-7788'));
      }
      assert.match(r.summary.copyStatus, /복사했어요/u);
      assert.equal(r.summary.shareInsideTap, true, 'KakaoTalk not set up: the share sheet opens inside the tap (no wait first)');
      assertElderly(r.summary.measure, `${label} summary`, testCase.width);
      assertReadable(r.summaryThemes, `${label} summary`);
    });
    await check(`${label}: 인쇄 shows only a large-print 정리표`, () => {
      assert.equal(r.print.sheet, 'block');
      assert.ok(r.print.size >= 21, `print text ${r.print.size}px`);
      assert.ok(r.print.h1 >= 30, `print title ${r.print.h1}px`);
      assert.equal(r.print.shell, 'none');
      assert.equal(r.print.dialog, 'none');
      assert.match(r.print.text, /꼭 기억하세요/u);
    });
    await check(`${label}: no ratio-looking number on any 자동차 사고 screen`, () => {
      for (const text of r.carTexts) assert.doesNotMatch(text, RATIO_RE, text.match(RATIO_RE)?.[0]);
      assert.equal(r.carTexts.length, 3);
    });
    await check(`${label}: a reload reopens the dialog on the 정리표 with everything kept`, () => {
      assert.deepEqual(r.reload.receipt, '보험-2026-7788');
      assert.equal(r.reload.when, '10월 10일 오후, 전주 덕진구 사거리');
      assert.equal(r.reload.status, 'SUBMITTED');
      assert.ok(r.reload.evidence.includes(FIXTURE.situations[0].evidence[0].label), 'checked evidence kept');
    });
    await check(`${label}: 중고거래 — show_if steps, 진위확인 link, "인증이 안 돼요" puts phone and visit first`, () => {
      assert.match(r.fraud.resume, /이어서 보기/u);
      assert.deepEqual(r.fraud.progress.slice(0, 2), ['질문 1/2', '질문 2/2']);
      assert.deepEqual(r.fraud.ids, ['stop_paying', 'lookup_before']);
      assert.equal(r.fraud.scam, true);
      assert.deepEqual(r.fraud.bankIds, ['stop_paying', 'bank_and_112', 'save_evidence', 'police_report']);
      assert.deepEqual(r.fraud.policeRoutes, ['tel', 'online', 'noauth'], 'the 182 phone comes before the online form');
      assert.deepEqual(r.fraud.policeRoutesOffline, ['tel', 'visit', 'online', 'noauth'], '인증이 안 돼요: the 경찰서 visit moves ahead of the online form');
      assert.equal(r.fraud.noAuthPressed, 'true');
      assert.equal(r.fraud.noAuthFocus, 'ECRM');
      assert.deepEqual(r.fraud.channelsOffline, ['POLICE_112', 'POLICE_182', 'ECRM', 'POLICE_FRAUD_LOOKUP']);
      assert.deepEqual(r.fraud.ecrmOffline, ['visit', 'online', 'noauth']);
      assert.deepEqual(r.fraud.ecrmOnline, ['online', 'noauth']);
      assert.equal(r.fraud.ecrmHours, '');
      assertElderly(r.fraud.measure, `${label} fraud help`, testCase.width);
    });
    await check(`${label}: 그 밖의 법률 고민 — goto 월급 못 받음; no receipt_field_id, no lock; duration shown; 1350 fee`, () => {
      assert.deepEqual(r.other.ids, ['summary_first', 'work_link', 'call_132', 'call_110']);
      assert.equal(r.other.submittedLocked, false);
      assert.equal(r.other.hintShown, false);
      assert.deepEqual(r.other.wageIds, ['write_down', 'call_1350', 'file_petition', 'attend', 'certificate', 'substitute_pay', 'legal_aid']);
      assert.equal(r.other.duration, FIXTURE.situations[2].steps.find(step => step.id === 'file_petition').duration);
      assert.equal(r.other.moelFees, '통화료 별도 · 신청 수수료 없음');
      assertElderly(r.other.measure, `${label} wage help`, testCase.width);
    });
    await check(`${label}: 처음부터 다시 takes two presses; 진위확인 link hands over; × closes for good`, () => {
      assert.equal(r.reset.armed, '한 번 더 누르면 지우고 처음부터 해요');
      assert.equal(r.reset.stillHere, 'help');
      assert.equal(r.reset.wageGone, true);
      assert.equal(r.reset.carKept, true);
      assert.equal(r.reset.scamOpen, true);
      assert.equal(r.reset.flag, null);
      assert.equal(r.close.flag, null);
      assert.equal(r.close.focus, true);
    });
  }
  const fail = await runFailure(browser, origin, dir, CASES[0]);
  await check('Core down: the fallback sentence with 112 · 119 · 132, retry asks again', () => {
    assert.equal(fail.text, '안내를 불러오지 못했어요. 급하면 112·119, 법률 고민은 132에 전화해 주세요.');
    assert.deepEqual(fail.calls.map(item => item[0]), ['tel:112', 'tel:119', 'tel:132']);
    assert.ok(fail.calls.every(item => item[2] >= 56));
    assert.equal(fail.retry, true);
    assert.equal(fail.requests, 1);
    assert.equal(fail.retried, 2);
    assertElderly({...fail.measure, heading: 26}, 'failure', 375);
    assertReadable(fail.themes, 'failure');
  });
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`TROUBLE-HELPER-01 site contract: PASS (${passed} checks; viewport emulation in headless Chrome, not a device run)`);
