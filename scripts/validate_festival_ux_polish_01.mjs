// FESTIVAL-UX-POLISH-01 — the 축제·행사 list as QA 2026-10-10 asked for it
// (items #1, #2, #3 festival part, #20 festival part, #27):
//
//  #1  [프로그램]/[접수] appear on a card only when that festival's own detail
//      really has programs / a program reservation link — never a button that
//      can only say "없습니다". Each card asks when it comes into view (not every
//      card up front), the answer is reused when the button is pressed, and a
//      failed read shows neither button.
//  #2  The 〈 month 〉 navigator and the time chips always agree: a chip brings
//      the month back to this month, moving to another month lights the month
//      itself like a pressed chip, and coming back to this month lights 이번 달.
//  #3  The in-screen "← 목록으로" carries data-subview-back; where the site
//      shell marks html[data-subview-back-shell] it is not shown twice (the
//      panel ← presses it), and it still goes back one step.
//  #20 Card actions, the month arrows and the 일정 등록 month arrows are 44px.
//  #27 One map action in the Settings 지도앱 (same builders, name and icon as
//      the chat Place Card), 일정 등록 shaped like the other card buttons (no
//      emoji), and the poster shown whole (contain) over a blurred fill.
//
// Real site-festival-ui.js / site-festival-client.js in headless Chromium over
// CDP, Core mocked in the page, poster images served through CDP Fetch.
// Viewport emulation only — not a device run.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const ui = read('site-festival-ui.js');
const css = read('site-festival.css');

let passed = 0;
async function check(label, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${label}`);
}

// ── Source contract ─────────────────────────────────────────────────────
await check('source: one Settings map action through the shared builders, no per-app buttons', () => {
  assert.match(ui, /import \{buildDefaultMapHref, defaultMapProviderPresentation\} from '\.\/site-navigation\.js/);
  assert.match(ui, /readDefaultMapProvider\b/);
  assert.doesNotMatch(ui, /openNaverMapsPlace|openKakaoNaviPlace|openTmapPlace|isTmapHandoffAvailable/,
    'the card must not render its own 네이버지도/카카오내비/TMAP trio');
  assert.match(ui, /\/assets\/place-actions\/\$\{presentation\.icon\}\.png\?v=\$\{MAP_ACTION_ICON_VERSION\}/,
    'the map action uses the chat Place Card icon files');
  assert.match(read('site-conversation.js'), /const PLACE_ACTION_ICON_VERSION = 'place-icons-20260925';/,
    'the icon version must stay the one the chat Place Card uses');
  assert.match(ui, /const MAP_ACTION_ICON_VERSION = 'place-icons-20260925';/);
});
await check('source: 일정 등록 has no emoji and the card button class', () => {
  assert.doesNotMatch(ui, /📅/u);
  assert.match(ui, /trigger\.className = 'festival-card-icon-button festival-calendar-add-trigger';\s*trigger\.textContent = '일정 등록';/);
});
await check('source: both in-screen backs carry data-subview-back, hidden only under the shell marker', () => {
  assert.equal((ui.match(/back\.dataset\.subviewBack = '';/g) || []).length, 2);
  assert.match(css, /html\[data-subview-back-shell\] \.festival-back-button\[data-subview-back\] \{\s*display: none;\s*\}/);
  assert.doesNotMatch(ui, /\bback\.hidden = true/,'the shell counts a [hidden] back as gone — never hide it with the attribute');
});
await check('source: the poster is contained, never cropped', () => {
  assert.match(css, /\.festival-hero img \{[^}]*object-fit: contain;/);
  assert.doesNotMatch(css.match(/\.festival-hero img \{[^}]*\}/)[0], /object-fit: cover/);
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
  throw new Error('Chrome/Chromium is required for FESTIVAL-UX-POLISH-01.');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(80);
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
  return {send, on: listener => listeners.push(listener), close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(ROOT, `.${pathname}`);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    response.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// A portrait poster (the production 444×627 shape) and a landscape photo.
const POSTER = '<svg xmlns="http://www.w3.org/2000/svg" width="444" height="627"><rect width="444" height="627" fill="#c0392b"/><rect y="0" width="444" height="80" fill="#1e3a8a"/></svg>';
const PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="940" height="627"><rect width="940" height="627" fill="#2e7d32"/></svg>';
const IMAGES = {'https://img.festival-ux.test/poster.svg': POSTER, 'https://img.festival-ux.test/photo.svg': PHOTO};

const D = (y, m, d) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
const FESTIVALS = [
  {festival_id: 'fest_prog', name: '가을 억새 축제', image_url: 'https://img.festival-ux.test/poster.svg', programs: [
    {program_name: '개막식', start_date: '2026-10-10', start_time: '19:00', venue: '중앙광장'},
    {program_name: '체험 부스', start_date: '2026-10-10', end_date: '2026-10-12', start_time: '10:00', reservation_url: 'https://example.com/join'},
    {program_name: '먹거리 장터', start_date: '2026-10-11', start_time: '11:00'},
  ]},
  {festival_id: 'fest_none', name: '남도 가든 페스티벌', image_url: 'https://img.festival-ux.test/photo.svg', programs: []},
  {festival_id: 'fest_fail', name: '상세 읽기 실패 축제', image_url: 'https://img.festival-ux.test/photo.svg', programs: [], detailStatus: 500},
  {festival_id: 'fest_progonly', name: '거리 인형극제', image_url: 'https://img.festival-ux.test/poster.svg', programs: [
    {program_name: '인형극 공연', start_date: '2026-10-11', start_time: '14:00'},
  ]},
];

function innerHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #host{padding:0 12px}</style>
</head><body><div id="host"></div><pre id="fup-result" hidden>pending</pre>
<script type="module">
const FESTIVALS = ${JSON.stringify(FESTIVALS)};
const calls = {browse: [], detail: {}};
window.__calls = calls;
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const row = f => ({
  festival_id: f.festival_id, name: f.name, start_date: '${D(2026, 10, 8)}', end_date: '${D(2026, 10, 14)}',
  region_name: '서울특별시', address: '서울특별시 영등포구 여의동로 330', latitude: 37.52, longitude: 126.93,
  image_url: f.image_url, homepage_url: 'https://official.example.com/' + f.festival_id, status: 'PUBLISHED', is_always_open: false,
});
window.fetch = async url => {
  const target = new URL(String(url));
  if (target.pathname === '/festivals/regions') return json({regions: [{region_name: '서울특별시'}]});
  if (target.pathname === '/festivals/browse') {
    calls.browse.push(Object.fromEntries(target.searchParams.entries()));
    return json({festivals: FESTIVALS.map(row), result_count: FESTIVALS.length, total_count: FESTIVALS.length, limit: 20, offset: 0, next_offset: null, has_more: false});
  }
  const detail = /^\\/festivals\\/(fest_[a-z]+)$/.exec(target.pathname);
  if (detail) {
    calls.detail[detail[1]] = (calls.detail[detail[1]] || 0) + 1;
    const f = FESTIVALS.find(item => item.festival_id === detail[1]);
    if (!f) return json({detail: 'not found'}, 404);
    if (f.detailStatus) return json({detail: 'boom'}, f.detailStatus);
    return json({festival: {...row(f), programs: f.programs}});
  }
  return json({}, 404);
};
try {
  const {mountFestivalManager} = await import('/site-festival-ui.js');
  await mountFestivalManager({root: document.getElementById('host'), now: new Date('2026-10-10T03:00:00Z'), fetchImpl: window.fetch});
  document.getElementById('fup-result').textContent = JSON.stringify({ok: true});
} catch (error) {
  document.getElementById('fup-result').textContent = JSON.stringify({ok: false, error: String(error?.stack || error)});
}
</script></body></html>`;
}

// Runs inside the page: small helpers the scenario steps share.
const HELPERS = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const host = document.getElementById('host');
const cards = () => [...host.querySelectorAll('.festival-card')];
const card = id => cards().find(node => node.querySelector('.festival-card-open')?.getAttribute('href')?.endsWith(id));
const rowLabels = node => [...node.querySelector('.festival-card-action-row').querySelectorAll('.festival-card-icon-button')].map(b => b.textContent.trim());
const settle = async () => { for (let i = 0; i < 100 && host.querySelector('.festival-status')?.hidden === false; i += 1) await sleep(30); await sleep(250); };
const chips = () => Object.fromEntries([...host.querySelectorAll('.festival-chip')].map(b => [b.textContent, b.getAttribute('aria-pressed') === 'true']));
const month = () => {
  const nav = host.querySelector('.festival-month-nav');
  const label = nav.querySelector('.festival-month-nav-label');
  const style = getComputedStyle(label);
  return {label: label.textContent, active: nav.classList.contains('is-active'), aria: nav.getAttribute('aria-label'),
    background: style.backgroundColor, color: style.color};
};
const lastQuery = () => window.__calls.browse.at(-1);
const clickChip = text => [...host.querySelectorAll('.festival-chip')].find(b => b.textContent === text).click();
`;

async function runCase(browser, origin, dir, testCase) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    cdp.on(message => {
      if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
      const svg = IMAGES[message.params.request.url];
      const reply = svg
        ? page('Fetch.fulfillRequest', {requestId: message.params.requestId, responseCode: 200,
          responseHeaders: [{name: 'Content-Type', value: 'image/svg+xml'}], body: Buffer.from(svg).toString('base64')})
        : page('Fetch.failRequest', {requestId: message.params.requestId, errorReason: 'NameNotResolved'});
      reply.catch(() => {});
    });
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression: `(async () => {${HELPERS}\n${expression}\n})()`, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(`${testCase.label}: ${JSON.stringify(result.exceptionDetails).slice(0, 2000)}`);
      return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Fetch.enable', {patterns: [{urlPattern: 'https://img.festival-ux.test/*'}]});
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url: `${origin}/scripts/${path.basename(dir)}/inner.html`});
    const ready = await waitFor(async () => {
      const text = await evaluate("return document.getElementById('fup-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsed = JSON.parse(ready);
    if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
    return await testCase.run(evaluate);
  } finally {
    cdp.close();
  }
}

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.festival-ux-polish-'));
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), innerHtml(), 'utf8');

  // ── 390px phone (Android) ──
  const phone = await runCase(browser, origin, dir, {label: 'phone-390', width: 390, height: 844, mobile: true, userAgent: ANDROID_UA, run: async evaluate => {
    const out = {};
    out.initial = await evaluate(`await settle(); await sleep(400);
      return {detail: {...window.__calls.detail}, labels: Object.fromEntries(cards().map(c => [c.querySelector('.festival-card-name').textContent, rowLabels(c)])),
        chips: chips(), month: month(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};`);
    out.scrolled = await evaluate(`for (const c of cards()) { c.scrollIntoView({block: 'center'}); await sleep(350); }
      window.scrollTo(0, 0); await sleep(200);
      return {detail: {...window.__calls.detail}, labels: Object.fromEntries(cards().map(c => [c.querySelector('.festival-card-name').textContent, rowLabels(c)]))};`);
    out.sizes = await evaluate(`const buttons = [...host.querySelectorAll('.festival-card-action-row .festival-card-icon-button')];
      const navButtons = [...host.querySelectorAll('.festival-month-nav-button')];
      const first = card('fest_prog');
      const map = first.querySelector('.festival-card-map');
      const trigger = first.querySelector('.festival-calendar-add-trigger');
      const shape = node => { const s = getComputedStyle(node); return {radius: s.borderRadius, height: Math.round(node.getBoundingClientRect().height), border: s.borderTopWidth}; };
      return {buttons: buttons.map(b => ({text: b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width})),
        nav: navButtons.map(b => ({w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height})),
        monthLabelHeight: host.querySelector('.festival-month-nav-label').getBoundingClientRect().height,
        mapShape: shape(map), triggerShape: shape(trigger), triggerText: trigger.textContent,
        mapCount: first.querySelectorAll('.festival-card-map').length,
        legacyMaps: host.querySelectorAll('.festival-card-map-naver, .festival-card-map-kakao, .festival-card-map-tmap, .festival-card-map-actions').length,
        map: {provider: map.dataset.mapProvider, href: map.getAttribute('href'), target: map.target, rel: map.rel,
          label: map.querySelector('.festival-card-map-label')?.textContent, icon: map.querySelector('img')?.getAttribute('src'), aria: map.getAttribute('aria-label')}};`);
    out.poster = await evaluate(`const hero = card('fest_prog').querySelector('.festival-hero');
      const image = hero.querySelector('.festival-hero-image');
      const backdrop = hero.querySelector('.festival-hero-backdrop');
      for (let i = 0; i < 60 && !(image?.complete && image.naturalWidth); i += 1) await sleep(50);
      const box = hero.getBoundingClientRect();
      const fit = getComputedStyle(image).objectFit;
      // contain: the drawn picture = the largest box of the image's own shape that fits.
      const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
      return {fit, natural: [image.naturalWidth, image.naturalHeight], box: [Math.round(box.width), Math.round(box.height)],
        drawn: [Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale)],
        alt: image.alt, backdrop: backdrop ? {hidden: backdrop.getAttribute('aria-hidden'), alt: backdrop.alt, fit: getComputedStyle(backdrop).objectFit} : null};`);
    out.program = await evaluate(`const before = window.__calls.detail.fest_prog;
      [...card('fest_prog').querySelectorAll('button')].find(b => b.textContent === '프로그램').click();
      await sleep(300);
      const surface = host.querySelector('.festival-program-surface');
      const back = surface.querySelector('.festival-back-button');
      const result = {before, after: window.__calls.detail.fest_prog, visible: !surface.hidden, tabs: surface.querySelectorAll('.festival-date-tab').length,
        back: {text: back.textContent, subview: back.hasAttribute('data-subview-back'), hiddenAttr: back.hidden, displayNoShell: getComputedStyle(back).display}};
      document.documentElement.dataset.subviewBackShell = '';
      result.back.displayShell = getComputedStyle(back).display;
      result.back.stillConnected = back.isConnected;
      back.click();
      await sleep(200);
      result.listAfterBack = !host.querySelector('.festival-list-surface').hidden;
      result.programAfterBack = !surface.hidden;
      delete document.documentElement.dataset.subviewBackShell;
      return result;`);
    out.registration = await evaluate(`const before = window.__calls.detail.fest_prog;
      [...card('fest_prog').querySelectorAll('button')].find(b => b.textContent === '접수').click();
      await sleep(300);
      const sheet = document.querySelector('.lotbi-sheet');
      const links = sheet ? [...sheet.querySelectorAll('.festival-registration-link')].map(a => a.getAttribute('href')) : [];
      const empty = sheet ? /없습니다/.test(sheet.textContent) : null;
      document.querySelector('.lotbi-sheet-dismiss')?.click();
      await sleep(200);
      return {before, after: window.__calls.detail.fest_prog, open: Boolean(sheet), links, empty};`);
    out.schedule = await evaluate(`card('fest_prog').querySelector('.festival-calendar-add-trigger').click();
      await sleep(300);
      const sheet = document.querySelector('.lotbi-sheet');
      const nav = sheet ? [...sheet.querySelectorAll('.festival-schedule-nav-button')].map(b => ({w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height})) : [];
      document.querySelector('.lotbi-sheet-dismiss')?.click();
      await sleep(200);
      return {open: Boolean(sheet), nav};`);
    out.month = await evaluate(`const steps = {};
      const snap = () => ({...month(), chips: chips(), query: lastQuery()});
      host.querySelector('.festival-month-nav-next').click(); await settle(); steps.next = snap();
      clickChip('진행 중'); await settle(); steps.ongoing = snap();
      host.querySelector('.festival-month-nav-next').click(); await settle();
      host.querySelector('.festival-month-nav-next').click(); await settle(); steps.december = snap();
      clickChip('이번 달'); await settle(); steps.thisMonthChip = snap();
      host.querySelector('.festival-month-nav-next').click(); await settle();
      host.querySelector('.festival-month-nav-prev').click(); await settle(); steps.backToThisMonth = snap();
      host.querySelector('.festival-month-nav-prev').click(); await settle(); steps.september = snap();
      return steps;`);
    out.androidMaps = await evaluate(`const pick = async provider => {
        document.cookie = provider ? 'lotbi_default_map_provider_v1=' + provider + '; path=/' : 'lotbi_default_map_provider_v1=; path=/; max-age=0';
        clickChip('이번 주말'); await settle();
        const map = card('fest_prog').querySelector('.festival-card-map');
        return {provider: map.dataset.mapProvider, href: map.getAttribute('href'), label: map.querySelector('.festival-card-map-label')?.textContent,
          icon: map.querySelector('img')?.getAttribute('src'), count: card('fest_prog').querySelectorAll('.festival-card-map').length};
      };
      const result = {TMAP: await pick('TMAP'), KAKAO_NAVI: await pick('KAKAO_NAVI'), none: await pick('')};
      result.detailAfterRerenders = {...window.__calls.detail};
      result.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return result;`);
    return out;
  }});

  await check('#1 phone: no detail read before a card is on screen; buttons only where the festival has them', () => {
    assert.equal(phone.initial.detail.fest_progonly || 0, 0, 'a card below the fold must not be read up front');
    assert.ok((phone.initial.detail.fest_prog || 0) === 1, 'the card in view is read once');
    assert.deepEqual(phone.scrolled.labels['가을 억새 축제'].slice(0, 2), ['프로그램', '접수'], 'programs + a reservation link -> both, first in the row');
    assert.deepEqual(phone.scrolled.labels['거리 인형극제'].filter(t => t === '프로그램' || t === '접수'), ['프로그램'], 'programs without a reservation link -> 프로그램 only');
    assert.deepEqual(phone.scrolled.labels['남도 가든 페스티벌'].filter(t => t === '프로그램' || t === '접수'), [], 'no programs -> neither button');
    assert.deepEqual(phone.scrolled.labels['상세 읽기 실패 축제'].filter(t => t === '프로그램' || t === '접수'), [], 'a failed read shows neither button');
    for (const id of ['fest_prog', 'fest_none', 'fest_progonly']) assert.equal(phone.scrolled.detail[id], 1, `${id}: one read per festival`);
  });
  await check('#1 phone: pressing 프로그램/접수 reuses the read and never answers "없습니다"', () => {
    assert.equal(phone.program.after, phone.program.before, '프로그램 must not read the detail again');
    assert.equal(phone.program.visible, true);
    assert.equal(phone.program.tabs, 3);
    assert.equal(phone.registration.after, phone.registration.before, '접수 must not read the detail again');
    assert.equal(phone.registration.open, true);
    assert.deepEqual(phone.registration.links, ['https://example.com/join']);
    assert.equal(phone.registration.empty, false);
  });
  await check('#3 phone: one back per screen — data-subview-back, hidden only under the shell marker, still one step back', () => {
    const back = phone.program.back;
    assert.equal(back.text, '← 목록으로');
    assert.equal(back.subview, true);
    assert.equal(back.hiddenAttr, false, 'the shell must still count it, so never the hidden attribute');
    assert.notEqual(back.displayNoShell, 'none', 'an older shell (no marker) keeps showing the in-screen back');
    assert.equal(back.displayShell, 'none', 'under html[data-subview-back-shell] the panel ← is the only visible back');
    assert.equal(back.stillConnected, true);
    assert.equal(phone.program.listAfterBack, true, 'pressing it (what the shell ← does) returns to the list');
    assert.equal(phone.program.programAfterBack, false);
  });
  await check('#2 phone: chips and the month navigator always agree', () => {
    const {initial} = phone;
    assert.equal(initial.month.label, '2026년 10월');
    assert.equal(initial.month.active, false);
    assert.equal(initial.chips['진행 중'], true);
    const m = phone.month;
    assert.equal(m.next.label, '2026년 11월');
    assert.equal(m.next.active, true, 'another month lights the month itself');
    assert.notEqual(m.next.background, initial.month.background, 'the selected month must look selected (filled like a pressed chip)');
    assert.equal(m.next.aria, '월별 탐색, 2026년 11월 보는 중');
    assert.ok(Object.values(m.next.chips).every(pressed => !pressed));
    assert.deepEqual([m.next.query.time, m.next.query.date], ['MONTH', '2026-11']);
    assert.equal(m.ongoing.label, '2026년 10월', 'a chip brings the month back to this month — no "11월" over a 진행 중 list');
    assert.equal(m.ongoing.active, false);
    assert.equal(m.ongoing.chips['진행 중'], true);
    assert.equal(m.ongoing.query.time, 'ONGOING');
    assert.equal(m.december.label, '2026년 12월');
    assert.equal(m.thisMonthChip.label, '2026년 10월', '이번 달 chip shows this month');
    assert.equal(m.thisMonthChip.chips['이번 달'], true);
    assert.equal(m.backToThisMonth.label, '2026년 10월');
    assert.equal(m.backToThisMonth.chips['이번 달'], true, 'moving back to this month lights 이번 달 instead of an unnamed month');
    assert.equal(m.backToThisMonth.active, false);
    assert.equal(m.backToThisMonth.query.time, 'THIS_MONTH');
    assert.equal(m.september.label, '2026년 9월');
    assert.equal(m.september.active, true);
    assert.deepEqual([m.september.query.time, m.september.query.date], ['MONTH', '2026-09']);
  });
  await check('#20 phone: card actions, month arrows and 일정 등록 arrows are at least 44px', () => {
    assert.ok(phone.sizes.buttons.length >= 8);
    for (const button of phone.sizes.buttons) assert.ok(button.h >= 44, `${button.text}: ${button.h}px`);
    for (const nav of phone.sizes.nav) assert.ok(nav.w >= 44 && nav.h >= 44, `month arrow ${nav.w}x${nav.h}`);
    assert.ok(phone.sizes.monthLabelHeight >= 44);
    assert.equal(phone.schedule.open, true);
    for (const nav of phone.schedule.nav) assert.ok(nav.w >= 44 && nav.h >= 44, `일정 등록 arrow ${nav.w}x${nav.h}`);
  });
  await check('#27 phone: one Settings map action (default 네이버지도), 일정 등록 shaped like the rest, poster whole', () => {
    const s = phone.sizes;
    assert.equal(s.mapCount, 1);
    assert.equal(s.legacyMaps, 0, 'no 네이버지도/카카오내비/TMAP trio');
    assert.equal(s.map.provider, 'NAVER_MAP');
    assert.match(s.map.href, /^intent:\/\//u, 'Android opens the 네이버지도 app link');
    assert.equal(s.map.target, '_blank');
    assert.equal(s.map.rel, 'noopener noreferrer');
    assert.equal(s.map.label, '네이버지도');
    assert.equal(s.map.icon, '/assets/place-actions/naver-map.png?v=place-icons-20260925');
    assert.match(s.map.aria, /가을 억새 축제 길찾기 \(네이버지도\), 새 창에서 열립니다/u);
    assert.equal(s.triggerText, '일정 등록');
    assert.deepEqual(s.triggerShape, s.mapShape, '일정 등록 must have the same shape as the other card buttons');
    const p = phone.poster;
    assert.equal(p.fit, 'contain');
    assert.deepEqual(p.natural, [444, 627]);
    assert.ok(p.drawn[0] <= p.box[0] && p.drawn[1] <= p.box[1], `the whole poster fits: drawn ${p.drawn} in ${p.box}`);
    assert.equal(p.drawn[1], p.box[1], 'a portrait poster uses the full height — top and bottom are not cut');
    assert.match(p.alt, /대표 이미지/u);
    assert.deepEqual(p.backdrop, {hidden: 'true', alt: '', fit: 'cover'}, 'the blurred fill is decoration only');
  });
  await check('#27 phone: the map action follows the Settings 지도앱 and re-renders reuse the reads', () => {
    const maps = phone.androidMaps;
    assert.equal(maps.TMAP.provider, 'TMAP');
    assert.equal(maps.TMAP.label, '티맵');
    assert.match(maps.TMAP.href, /^intent:\/\//u);
    assert.equal(maps.TMAP.icon, '/assets/place-actions/tmap.png?v=place-icons-20260925');
    assert.equal(maps.KAKAO_NAVI.provider, 'KAKAO_NAVI');
    assert.equal(maps.KAKAO_NAVI.label, '카카오내비');
    assert.match(maps.KAKAO_NAVI.href, /\/kakao-navi\.html\?/u, 'Android Kakao Navi goes through the shared handoff page');
    assert.equal(maps.KAKAO_NAVI.icon, '/assets/place-actions/kakao-map.png?v=place-icons-20260925');
    assert.equal(maps.none.provider, 'NAVER_MAP');
    for (const key of ['TMAP', 'KAKAO_NAVI', 'none']) assert.equal(maps[key].count, 1);
    for (const id of ['fest_prog', 'fest_none', 'fest_progonly']) assert.equal(maps.detailAfterRerenders[id], 1, `${id}: filter changes must not read again`);
    assert.ok(maps.overflow <= 1, `390px horizontal overflow ${maps.overflow}px`);
  });

  // ── 1280px desktop ──
  const desktop = await runCase(browser, origin, dir, {label: 'desktop-1280', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, run: async evaluate => {
    return await evaluate(`await settle(); for (const c of cards()) { c.scrollIntoView({block: 'center'}); await sleep(300); }
      const pick = async provider => {
        document.cookie = provider ? 'lotbi_default_map_provider_v1=' + provider + '; path=/' : 'lotbi_default_map_provider_v1=; path=/; max-age=0';
        clickChip('이번 주말'); await settle();
        const map = card('fest_prog').querySelector('.festival-card-map');
        return {provider: map.dataset.mapProvider, href: map.getAttribute('href'), label: map.querySelector('.festival-card-map-label')?.textContent};
      };
      const maps = {none: await pick(''), KAKAO_NAVI: await pick('KAKAO_NAVI'), TMAP: await pick('TMAP')};
      await pick('');
      for (const c of cards()) { c.scrollIntoView({block: 'center'}); await sleep(250); }
      const buttons = [...host.querySelectorAll('.festival-card-action-row .festival-card-icon-button')].map(b => b.getBoundingClientRect().height);
      return {maps, buttons, labels: Object.fromEntries(cards().map(c => [c.querySelector('.festival-card-name').textContent, rowLabels(c)])),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};`);
  }});
  await check('#27 desktop: 네이버지도 web search carries the full address, 카카오 web route the coordinate, TMAP says it opens 네이버지도', () => {
    const {maps} = desktop;
    assert.equal(maps.none.label, '네이버지도');
    assert.match(decodeURIComponent(maps.none.href), /여의동로 330/u, 'the full road address, not a district fragment');
    assert.match(maps.KAKAO_NAVI.href, /^https:\/\/map\.kakao\.com\/link\/to\//u);
    assert.match(decodeURIComponent(maps.KAKAO_NAVI.href), /,37\.52,126\.93/u);
    assert.equal(maps.TMAP.label, '티맵 대신 네이버지도 웹', 'TMAP is phone-only; the desktop button says where it goes');
    assert.match(decodeURIComponent(maps.TMAP.href), /여의동로 330/u);
    for (const height of desktop.buttons) assert.ok(height >= 44, `desktop card action ${height}px`);
    assert.deepEqual(desktop.labels['가을 억새 축제'].slice(0, 2), ['프로그램', '접수']);
    assert.deepEqual(desktop.labels['남도 가든 페스티벌'].filter(t => t === '프로그램' || t === '접수'), []);
    assert.ok(desktop.overflow <= 1, `1280px horizontal overflow ${desktop.overflow}px`);
  });
} finally {
  server.close();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`FESTIVAL-UX-POLISH-01 PASS (${passed} checks; viewport emulation, not a device run)`);
