// KINDERGARTEN-OFFICIAL-INFO-01 — 생활정보 → 유치원·학교 → 유치원 (교육부 유치원알리미 공시).
//
// Contract checked here:
// * 생활정보 shows "유치원·학교"; it opens 학교 / 유치원 tabs (no new route,
//   no change to site-conversation.js, the saved school key is never touched)
// * 유치원: the provider's 시도·시군구 picker → name / 설립유형 → list → one
//   유치원: 설립유형·주소·연락처·운영시간·학급·정원·원아·홈페이지·공시 기준 first,
//   then 8 공시 sections with their 공시차수, source + 조회일, 학비 never stated
// * 내 유치원: its own per-account key, set and cleared on the screen
// * Core off → "준비 중" + chat fallback, not an empty list
// * 360/375/390/412 mobile and 1280 desktop, light and dark: no horizontal
//   overflow, controls ≥ 44px, readable text (viewport emulation, not a device run)
//
// Core responses come from scripts/fixtures/kindergarten_official_info_01.json,
// produced by lotbi-core app/kindergarten_api.py itself on real 유치원알리미 rows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/kindergarten_official_info_01.json'));
const YEIL = '1ecec08c-f46d-b044-e053-0a32095ab044';
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

// ── Pure contract ───────────────────────────────────────────────────────
const client = await import('../site-kindergarten-client.js');
const education = await import('../site-life-education.js');
const sections = await import('../site-consumer-sections.js');

await check('생활정보 lists 유치원·학교 with its own screen', () => {
  const item = sections.LIFE_SHORTCUTS.find(entry => entry.id === 'education');
  assert.ok(item && item.label === '유치원·학교' && !item.prompt);
  const source = read('site-consumer-sections.js');
  assert.match(source, /import\('\.\/site-life-education\.js\?v=aset-[0-9a-f]{12}'\)/u);
  assert.match(source, /item\.id === 'education' \? openEducation\(item\)/u);
});

await check('Core contract normalizes and keeps the kinder code', () => {
  const list = client.normalizeKindergartenList(FIXTURE.search['52113|ALL|예일']);
  assert.equal(list.status, 'OK');
  assert.deepEqual(list.items.map(item => item.name), ['예일유치원']);
  const [yeil] = list.items;
  assert.equal(yeil.kinderCode, YEIL);
  assert.equal(yeil.hours, '08:30~17:00');
  assert.deepEqual([yeil.capacity, yeil.enrolled, yeil.classes], [253, 208, 11]);
  assert.equal(yeil.disclosureLabel, '2026년 1차');
  const detail = client.normalizeKindergartenDetail(FIXTURE.detail[YEIL]);
  assert.equal(detail.categories.length, 8);
  assert.equal(detail.source.label, '교육부 유치원알리미');
  assert.equal(client.normalizeKindergartenList({contract_id: 'OTHER'}), null);
});

await check('links and phone numbers are safe', () => {
  assert.equal(client.safeKindergartenLink('javascript:alert(1)'), '');
  assert.equal(client.safeKindergartenLink('http://cafe.naver.com/yeail1133'), 'http://cafe.naver.com/yeail1133');
  assert.equal(client.safeKindergartenLink('https://user:pw@example.com'), '');
  assert.equal(client.telHref('063-245-1133'), 'tel:063-245-1133');
  assert.equal(client.telHref('063-245-1133<script>'), '');
});

await check('a saved region label picks one 시군구 of the code table', () => {
  const catalog = client.normalizeRegionCatalog(FIXTURE.regions);
  assert.equal(catalog.regions.length, 16);
  assert.deepEqual(client.regionFromLabel(catalog, '전북특별자치도 전주시 덕진구'), {sidoCode: '52', sggCode: '52113'});
  assert.deepEqual(client.regionFromLabel(catalog, '전주시 완산구'), {sidoCode: '52', sggCode: '52111'});
  assert.equal(client.regionFromLabel(catalog, '동구'), null);              // five 시도 have one
});

await check('school questions go to the chat; the saved school key is not this screen\'s', () => {
  assert.equal(education.buildSchoolPrompt('meal_week', '전주서원초'), '전주서원초 이번 주 급식 알려줘');
  assert.equal(education.buildSchoolPrompt('meal_today', ''), '오늘 급식 알려줘');
  assert.equal(education.buildSchoolPrompt('basic', ''), '우리 학교 기본정보 알려줘');
  assert.equal(education.buildKindergartenPrompt({name: '예일유치원', area: '전북 전주시 덕진구'}), '전주시 덕진구 예일유치원 알려줘');
  assert.equal(education.kindergartenPreferenceKey('user_1'), 'lotbi.site.ux.v1.life-kindergarten.user_1');
  assert.equal(education.kindergartenPreferenceKey(''), 'lotbi.site.ux.v1.life-kindergarten.guest');
  const source = read('site-life-education.js') + read('site-kindergarten-client.js');
  assert.doesNotMatch(source, /'life-school'|readSchoolPreference|writeSchoolPreference|clearSchoolPreference|innerHTML|eval\(|new Function/u);
  assert.doesNotMatch(source, /학비\s*:\s*\d/u);
});

await check('내 유치원 storage round trip and bad values', () => {
  const store = new Map();
  const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)};
  const key = education.kindergartenPreferenceKey('');
  assert.equal(education.writeKindergartenPreference(storage, key, {kinderCode: YEIL, sggCode: '52113', name: '예일유치원', area: '전북 전주시 덕진구'}), true);
  assert.equal(education.readKindergartenPreference(storage, key).kinderCode, YEIL);
  assert.equal(education.writeKindergartenPreference(storage, key, {kinderCode: '../x', sggCode: '52113', name: 'x'}), false);
  education.clearKindergartenPreference(storage, key);
  assert.equal(education.readKindergartenPreference(storage, key), null);
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
  throw new Error('Chrome/Chromium is required for the kindergarten screen validation.');
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

function buildInner(disabled) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const fixture = JSON.stringify(FIXTURE);
  const harness = `<script type="module">
const out = document.getElementById('kgo-result');
const FIXTURE = ${fixture};
const DISABLED = ${disabled ? 'true' : 'false'};
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  globalThis.__kinderCalls = [];
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname.startsWith('/v2/life/kindergartens')) {
      globalThis.__kinderCalls.push({path: parsed.pathname, query: parsed.search, credentials: init?.credentials || ''});
      if (parsed.pathname.endsWith('/regions')) return json(DISABLED ? FIXTURE.disabled_regions : FIXTURE.regions);
      if (parsed.pathname.endsWith('/detail')) return json(FIXTURE.detail[parsed.searchParams.get('kinder_code')] || {contract_id: 'CORE-KINDERGARTEN-RESULT-01', status: 'NOT_FOUND'});
      if (DISABLED) return json(FIXTURE.disabled_search);
      const key = [parsed.searchParams.get('sgg_code'), parsed.searchParams.get('establishment') || 'ALL', parsed.searchParams.get('q') || ''].join('|');
      return json(FIXTURE.search[key] || {contract_id: 'CORE-KINDERGARTEN-RESULT-01', status: 'UNAVAILABLE', items: []});
    }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
      guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=kindergartenofficial01');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok: true});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); }
</script><pre id="kgo-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Runs in the page: drives the screen with DOM events and measures it.
const SCENARIO = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, ms = 15000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + label); await sleep(50); } };
  const box = node => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right}; };
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { const fg = parse(getComputedStyle(node).color).slice(0, 3), bg = bgOf(node); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + .05) / (b + .05); };
  const visibleSmall = root => [...root.querySelectorAll('button, select, input, summary, a.consumer-action')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(n => (n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().height) + ':' + (n.textContent || '').trim().slice(0, 12));
  const overflowOf = root => [...root.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(n => n.className || n.tagName).slice(0, 5);
  const fire = (node, type) => node.dispatchEvent(new Event(type, {bubbles: true}));
  const result = {};

  document.querySelector('[data-consumer-section="life"]').click();
  const panel = await wait(() => document.querySelector('.consumer-section-panel'), 'life surface');
  const shortcut = await wait(() => panel.querySelector('[data-life-shortcut="education"]'), 'education shortcut');
  result.shortcut = {label: shortcut.textContent.trim(), box: box(shortcut), grid: box(shortcut.parentElement)};
  shortcut.click();
  const edu = await wait(() => panel.querySelector('.lotbi-edu'), 'education screen');
  result.tabs = [...edu.querySelectorAll('[data-edu-tab]')].map(t => ({id: t.dataset.eduTab, text: t.textContent.trim(), selected: t.getAttribute('aria-selected'), h: box(t).h}));
  if (${'${DISABLED}'}) {
    const state = await wait(() => edu.querySelector('[data-kinder-state="DISABLED"]'), 'disabled notice');
    result.disabled = {text: state.textContent, button: [...state.querySelectorAll('button')].map(b => b.textContent)};
    return result;
  }
  const sido = await wait(() => edu.querySelector('[data-kinder-sido]'), 'region picker');
  result.sidoCount = sido.options.length - 1;
  sido.value = '52'; fire(sido, 'change');
  const sgg = edu.querySelector('[data-kinder-sgg]');
  result.sggNames = [...sgg.options].map(o => o.textContent).slice(1);
  sgg.value = '52113'; fire(sgg, 'change');
  edu.querySelector('.lotbi-kinder-search').requestSubmit();
  await wait(() => edu.querySelectorAll('.lotbi-kinder-card').length, 'list');
  result.list = {status: edu.querySelector('.lotbi-kinder-status').textContent, names: [...edu.querySelectorAll('.lotbi-kinder-card strong')].map(n => n.textContent)};
  // Name + 설립유형 filter.
  edu.querySelector('[data-kinder-name]').value = '예일';
  edu.querySelector('[data-kinder-establishment="ALL"]').click();
  edu.querySelector('.lotbi-kinder-search').requestSubmit();
  await wait(() => edu.querySelectorAll('.lotbi-kinder-card').length === 1, 'filtered list');
  result.filtered = [...edu.querySelectorAll('.lotbi-kinder-card strong')].map(n => n.textContent);
  result.listMeasure = {small: visibleSmall(edu), overflow: overflowOf(edu), card: box(edu.querySelector('.lotbi-kinder-card'))};
  edu.querySelector('.lotbi-kinder-card').click();
  const detail = await wait(() => edu.querySelector('[data-kinder-detail]'), 'detail');
  result.detail = {
    code: detail.dataset.kinderDetail,
    title: edu.querySelector('.lotbi-kinder-title').textContent,
    facts: [...detail.querySelectorAll('.lotbi-kinder-facts .lotbi-kinder-fact')].map(r => [r.querySelector('dt').textContent, r.querySelector('dd').textContent]),
    tel: detail.querySelector('a[href^="tel:"]')?.getAttribute('href') || '',
    homepage: detail.querySelector('a[target="_blank"]')?.getAttribute('rel') || '',
    sections: [...edu.querySelectorAll('[data-kinder-category]')].map(s => [s.dataset.kinderCategory, s.querySelector('.lotbi-kinder-section-label').textContent, s.querySelector('.lotbi-kinder-section-meta').textContent]),
    source: edu.querySelector('.lotbi-kinder-source').textContent,
    text: edu.textContent,
  };
  const bus = edu.querySelector('[data-kinder-category="bus"]'); bus.open = true;
  const safety = edu.querySelector('[data-kinder-category="safety"]'); safety.open = true;
  await sleep(50);
  result.bus = [...bus.querySelectorAll('.lotbi-kinder-fact')].map(r => r.textContent);
  result.detailMeasure = {small: visibleSmall(edu), overflow: overflowOf(edu), pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
  const themes = {};
  for (const mode of ['light', 'dark']) {
    document.body.dataset.siteTheme = mode; await sleep(30);
    themes[mode] = {
      fact: contrast(detail.querySelector('.lotbi-kinder-fact dd')), term: contrast(detail.querySelector('.lotbi-kinder-fact dt')),
      section: contrast(bus.querySelector('.lotbi-kinder-section-label')), meta: contrast(bus.querySelector('.lotbi-kinder-section-meta')),
      source: contrast(edu.querySelector('.lotbi-kinder-source')), title: contrast(edu.querySelector('.lotbi-kinder-title')),
      color: getComputedStyle(detail.querySelector('.lotbi-kinder-fact dd')).color,
    };
  }
  result.themes = themes;
  // 내 유치원.
  const mine = [...detail.querySelectorAll('button')].find(b => b.textContent === '내 유치원으로 설정');
  mine.click();
  result.mineSaved = localStorage.getItem('lotbi.site.ux.v1.life-kindergarten.guest');
  result.schoolKeys = Object.keys(localStorage).filter(k => k.includes('life-school'));
  [...edu.querySelectorAll('button')].find(b => b.textContent === '유치원 목록으로').click();
  const mineCard = await wait(() => edu.querySelector('[data-kinder-mine]'), 'mine card');
  result.mineCard = mineCard.textContent;
  [...mineCard.querySelectorAll('button')].find(b => b.textContent === '내 유치원 해제').click();
  await wait(() => !edu.querySelector('[data-kinder-mine]') && edu.querySelector('[data-kinder-sido]'), 'mine cleared');
  result.mineCleared = localStorage.getItem('lotbi.site.ux.v1.life-kindergarten.guest');
  result.calls = globalThis.__kinderCalls.map(c => c.credentials);
  // 학교 tab: the question goes to the chat composer.
  edu.querySelector('[data-edu-tab="school"]').click();
  const schoolName = await wait(() => edu.querySelector('[data-edu-school-name]'), 'school form');
  schoolName.value = '전주서원초';
  edu.querySelector('[data-school-action="meal_week"]').click();
  result.schoolMeasure = {small: visibleSmall(edu), overflow: overflowOf(edu)};
  edu.querySelector('.lotbi-edu-school').requestSubmit();
  await sleep(300);
  result.composer = document.getElementById('lotbi-prompt')?.value ?? null;
  result.surfaceOpen = Boolean(document.querySelector('.consumer-section-panel .lotbi-edu'));
  return result;
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

async function runCase(browser, origin, dir, testCase, innerName, disabled) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.KINDERGARTEN_SCREENSHOT_DIR || '';
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
      return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url: `${origin}/scripts/${path.basename(dir)}/${innerName}`});
    const ready = await waitFor(async () => {
      const text = await evaluate("document.getElementById('kgo-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsed = JSON.parse(ready);
    if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
    const result = await evaluate(SCENARIO.replace('${DISABLED}', disabled ? 'true' : 'false'));
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(shots, `${testCase.label}${disabled ? '-disabled' : ''}.png`), Buffer.from(data, 'base64'));
    }
    return result;
  } finally {
    cdp.close();
  }
}

// KINDERGARTEN_PREVIEW_OUT=<file>: only write the harness page (for a manual look) and stop.
if (process.env.KINDERGARTEN_PREVIEW_OUT) {
  fs.writeFileSync(process.env.KINDERGARTEN_PREVIEW_OUT, buildInner(false), 'utf8');
  console.log(`preview harness written: ${process.env.KINDERGARTEN_PREVIEW_OUT}`);
  process.exit(0);
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.kindergarten-official-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(false), 'utf8');
  fs.writeFileSync(path.join(dir, 'disabled.html'), buildInner(true), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const r = await runCase(browser, origin, dir, testCase, 'inner.html', false);
    const label = testCase.label;
    await check(`${label}: 유치원·학교 opens 학교 / 유치원 tabs, 유치원 first`, () => {
      assert.equal(r.shortcut.label, '유치원·학교');
      assert.deepEqual(r.tabs.map(tab => [tab.id, tab.selected]), [['school', 'false'], ['kindergarten', 'true']]);
      assert.ok(r.tabs.every(tab => tab.h >= 44), JSON.stringify(r.tabs));
    });
    await check(`${label}: official region picker, list and filter`, () => {
      assert.equal(r.sidoCount, 16);
      assert.ok(r.sggNames.includes('전주시 덕진구') && r.sggNames.includes('전주시 완산구') && r.sggNames.length === 15);
      assert.ok(r.list.names.includes('예일유치원') && !r.list.names.includes('예일킨더유치원'), JSON.stringify(r.list));
      assert.match(r.list.status, /유치원알리미 공시 기준/u);
      assert.deepEqual(r.filtered, ['예일유치원']);
    });
    await check(`${label}: six facts first, 8 공시 sections, source and 조회일`, () => {
      assert.equal(r.detail.code, YEIL);
      assert.equal(r.detail.title, '예일유치원');
      const facts = Object.fromEntries(r.detail.facts);
      assert.equal(facts['설립유형'], '사립(사인)');
      assert.equal(facts['주소'], '전북특별자치도 전주시 덕진구 한배미5길 12-6');
      assert.equal(facts['연락처'], '063-245-1133');
      assert.equal(facts['운영시간'], '08:30~17:00');
      assert.equal(facts['학급·정원·원아'], '학급 11개 · 인가 정원 253명 · 원아 208명');
      assert.equal(facts['홈페이지'], 'cafe.naver.com/yeail1133');
      assert.equal(facts['공시 기준'], '2026년 1차 · 교육부 유치원알리미');
      assert.equal(r.detail.tel, 'tel:063-245-1133');
      assert.equal(r.detail.homepage, 'noopener noreferrer');
      assert.deepEqual(r.detail.sections.map(item => item[1]),
        ['통학차량', '급식운영', '방과후 과정', '교직원', '수업일수', '안전·환경위생', '건물·교실', '보험·공제회']);
      assert.ok(r.detail.sections.every(item => item[2] === '2026년 1차'), JSON.stringify(r.detail.sections));
      assert.match(r.detail.source, /교육부 유치원알리미 공시 · \d{4}-\d{2}-\d{2} 조회/u);
      assert.match(r.detail.text, /어린이집은 유치원알리미 공시 대상이 아니에요/u);
      assert.match(r.detail.text, /학비는 유치원알리미 Open API로 제공되지 않아/u);
      assert.ok(r.bus.some(line => line.includes('운행 차량') && line.includes('3대')), JSON.stringify(r.bus));
    });
    await check(`${label}: no overflow, controls ≥ 44px, light and dark readable`, () => {
      assert.deepEqual(r.listMeasure.overflow, []);
      assert.deepEqual(r.detailMeasure.overflow, []);
      assert.ok(r.detailMeasure.pageOverflow <= 0, String(r.detailMeasure.pageOverflow));
      assert.deepEqual(r.listMeasure.small, [], 'list controls');
      assert.deepEqual(r.detailMeasure.small, [], 'detail controls');
      assert.deepEqual(r.schoolMeasure.small, [], 'school controls');
      for (const mode of ['light', 'dark']) {
        const t = r.themes[mode];
        for (const key of ['fact', 'section', 'title']) assert.ok(t[key] >= 4.5, `${mode} ${key} ${t[key]}`);
        for (const key of ['term', 'meta', 'source']) assert.ok(t[key] >= 3, `${mode} ${key} ${t[key]}`);
      }
      assert.notEqual(r.themes.light.color, r.themes.dark.color, 'the dark theme changes the text colour');
    });
    await check(`${label}: 내 유치원 own key; the saved school untouched; school question to chat`, () => {
      assert.equal(JSON.parse(r.mineSaved).kinderCode, YEIL);
      assert.match(r.mineCard, /내 유치원예일유치원/u);
      assert.equal(r.mineCleared, null);
      assert.deepEqual(r.schoolKeys, []);
      assert.ok(r.calls.length >= 3 && r.calls.every(value => value === 'omit'), JSON.stringify(r.calls));
      assert.equal(r.composer, '전주서원초 이번 주 급식 알려줘');
      assert.equal(r.surfaceOpen, false);
    });
  }
  const off = await runCase(browser, origin, dir, CASES[2], 'disabled.html', true);
  await check('Core off: 준비 중 notice with a chat fallback, never an empty list', () => {
    assert.match(off.disabled.text, /유치원 공식정보 연결을 준비하고 있어요/u);
    assert.match(off.disabled.text, /공시 자료가 아니에요/u);
    assert.deepEqual(off.disabled.button, ['대화로 물어보기']);
  });
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

async function serverPort(child) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    child.once('error', reject);
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

console.log(`KINDERGARTEN-OFFICIAL-INFO-01 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
