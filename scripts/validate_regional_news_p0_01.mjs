// REGIONAL-NEWS-P0 — 지역정보 label, 지역뉴스 entry and the news answer cards.
//
// Source part: the 지역뉴스 shortcut, the sentence it hands to Core, the
// location rule for news turns and the CORE-REGIONAL-NEWS-01 card contract.
// Browser part: real touch/mouse input through the DevTools protocol on
// 360x780, 375x812, 390x844, 412x915 and 1280x900, plus 390x844 dark. Core is
// mocked; the mocked news answer has the shape Core's regional news route
// returns, and with the Core news switch off (NAVER_NEWS_SEARCH_ENABLED=false)
// the same question gets a general answer with no news_result and no card.
// Viewport emulation only — not an iPhone Safari / Android device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_SHORTCUTS, buildRegionalNewsPrompt} from '../site-consumer-sections.js';
import {lifeLocationIntent, newsLocationIntent} from '../site-life-location.js';
import {compactNewsResultMeta, normalizeNewsResult, relativeNewsTime} from '../site-regional-news.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── 지역정보 label ───────────────────────────────────────────────────────
const index = read('index.html');
assert.equal((index.match(/<span class="nav-item-label">지역정보<\/span>/gu) || []).length, 2, 'desktop and mobile nav say 지역정보');
assert.equal((index.match(/data-consumer-section="life" aria-label="지역정보"/gu) || []).length, 2);
assert.doesNotMatch(index, />생활정보</u);
const conversation = read('site-conversation.js');
assert.match(conversation, /life: \['지역정보', '저장한 지역과 내 주변의 필요한 정보를 찾아보세요\.'\]/u);
assert.doesNotMatch(conversation, /'생활정보로 돌아가기'/u);
assert.match(read('subscribe.html'), /<th scope="row">지역정보 · /u);
// Internal ids stay: the route, the section key and the storage keys are unchanged.
assert.match(index, /data-consumer-section="life"/u);
assert.match(conversation, /openConsumerSection\('life'\)/u);

// ── 지역뉴스 shortcut ────────────────────────────────────────────────────
const ids = LIFE_SHORTCUTS.map(item => item.id);
assert.equal(ids[ids.indexOf('festivals') + 1], 'news', '지역뉴스 sits right after 축제·행사');
assert.deepEqual(LIFE_SHORTCUTS.find(item => item.id === 'news'), {id: 'news', label: '지역뉴스', icon: 'news'});
const sections = read('site-consumer-sections.js');
assert.match(sections, /news: \['M4 5h13v14/u, 'a line news icon in the shortcut icon set');
assert.match(sections, /item\.id === 'news' \? openNewsEntry\(item\)/u);
assert.equal(buildRegionalNewsPrompt('전주시'), '전주시 뉴스 알려 줘');
assert.equal(buildRegionalNewsPrompt('  군산  '), '군산 뉴스 알려 줘');
assert.equal(buildRegionalNewsPrompt('전주시 완산구의'), '전주시 완산구 뉴스 알려 줘');
assert.equal(buildRegionalNewsPrompt(''), '내 주변 뉴스 알려 줘');
// The news entry rebuilds the home from what it showed, so it keeps working
// whichever controls the life home has (search bar or not).
assert.match(sections, /const home = \[\.\.\.root\.children\];/u);

// ── Location for news turns ─────────────────────────────────────────────
for (const text of ['전주 뉴스 알려 줘', '내 주변 뉴스 알려 줘', '우리 지역 소식', '군산 오늘 속보']) assert.equal(newsLocationIntent(text), true, text);
for (const text of ['뉴스앱 추천해 줘', '택시기사 연락처', '안녕', '전주 맛집']) assert.equal(newsLocationIntent(text), false, text);
assert.equal(lifeLocationIntent('전주 뉴스 알려 줘'), false, 'news is not a medical lookup');
const lifeLocation = read('site-life-location.js');
assert.match(lifeLocation, /if \(usageEnabled && \(lifeLookup \|\| LIFE_NEARBY_RE\.test\(text\)\)\) \{/u, 'news asks for the current position only with 근처/주변/여기');

// ── Card contract ───────────────────────────────────────────────────────
const MINUTE = 60_000;
function newsResult(now) {
  const at = minutes => new Date(now - minutes * MINUTE).toISOString();
  return {
    contract_id: 'CORE-REGIONAL-NEWS-01', schema_version: 1, result_set_id: 'nrs_validate01',
    provider_code: 'NAVER', source: 'NAVER_API_HUB_NEWS_SEARCH', attribution: '검색: NAVER · 기사: 각 언론사',
    region: {level: 'CITY', label: '군산시', short_label: '군산', source: 'TEXT'}, time_range: 'LATEST', topic: null,
    items: [
      {cluster_id: 'nwc_0123456789abcdef', source_type: 'NEWS_ARTICLE', title: '군산항 컨테이너 물동량 역대 최대…새만금 신항 효과',
        source_label: 'kunsan.co.kr', url: 'https://www.kunsan.co.kr/news/articleView.html?idxno=90001', naver_url: 'https://n.news.naver.com/mnews/article/666/0000600001',
        published_at: at(35), snippet: '군산지방해양수산청은 올해 군산항 컨테이너 물동량이 역대 최대를 기록했다고 8일 밝혔다.', flags: [], related_count: 2,
        image: 'https://example.com/should-not-render.jpg',
        related: [
          {title: '군산항 물동량 사상 최대', source_label: 'jbnews.com', url: 'https://www.jbnews.com/news/articleView.html?idxno=1', published_at: at(50)},
          {title: '군산항 컨테이너 처리 실적 최고', source_label: 'jjan.kr', url: 'https://www.jjan.kr/article/2', published_at: at(80)},
          {title: '스크립트 링크', source_label: 'bad', url: 'javascript:alert(1)', published_at: at(90)},
        ]},
      {cluster_id: 'nwc_1123456789abcdef', source_type: 'NEWS_ARTICLE', title: '군산 시내버스 노선 개편…13일부터 운행',
        source_label: 'jjan.kr', url: 'https://www.jjan.kr/article/20261008050', naver_url: null, published_at: at(150),
        snippet: '군산시는 시내버스 노선을 개편해 13일부터 운행한다고 8일 밝혔다. 교통 불편 지역 배차를 늘렸다.', flags: [], related_count: 0, related: []},
      {cluster_id: 'nwc_2123456789abcdef', source_type: 'NEWS_ARTICLE',
        title: '군산시, 내년 예산 1조 원 시대 열어…복지·교통·청년 일자리 예산 대폭 늘리고 원도심 도시재생 사업도 계속 이어가기로 결정',
        source_label: 'jeollailbo.com', url: 'https://www.jeollailbo.com/news/articleView.html?idxno=700001', naver_url: null, published_at: at(400),
        snippet: '군산시가 2027년도 본예산을 1조 원 규모로 편성해 시의회에 제출했다. 복지와 교통, 청년 일자리 예산을 크게 늘렸고 원도심 도시재생 사업 예산도 반영했다고 시는 설명했다.', flags: [], related_count: 0, related: []},
      {cluster_id: 'nwc_3123456789abcdef', source_type: 'NEWS_ARTICLE', title: '군산 새만금 수상태양광 착공',
        source_label: 'news1.kr', url: 'https://www.news1.kr/local/jeonbuk/5599001', naver_url: null, published_at: at(60 * 26),
        snippet: null, flags: ['속보'], related_count: 0, related: []},
      {cluster_id: 'nwc_4123456789abcdef', source_type: 'NEWS_ARTICLE', title: '군산 은파호수공원 야간 경관 조명 새 단장',
        source_label: '네이버 뉴스', url: 'https://n.news.naver.com/mnews/article/087/0000100099', naver_url: 'https://n.news.naver.com/mnews/article/087/0000100099',
        published_at: at(60 * 30), snippet: '군산시는 은파호수공원 산책로에 새 경관 조명을 설치했다.', flags: [], related_count: 0, related: []},
    ],
    counts: {raw: 20, in_period: 14, region_kept: 9, clusters: 5, shown: 5}, partial: false, external_side_effect: false,
  };
}
{
  const now = Date.parse('2026-10-08T03:00:00Z');
  const normalized = normalizeNewsResult(newsResult(now));
  assert.equal(normalized.items.length, 5);
  assert.equal(normalized.items[0].related.length, 2, 'a non-web related link is dropped');
  assert.equal(normalized.items[0].related_count, 2);
  assert.ok(!JSON.stringify(normalized).includes('should-not-render'), 'no image field is carried');
  assert.equal(normalizeNewsResult({...newsResult(now), contract_id: 'OTHER'}), null);
  assert.equal(compactNewsResultMeta({...newsResult(now), items: []}), null);
  assert.equal(relativeNewsTime(new Date(now - 35 * MINUTE).toISOString(), now), '35분 전');
  assert.equal(relativeNewsTime(new Date(now - 150 * MINUTE).toISOString(), now), '2시간 전');
  assert.equal(relativeNewsTime('2026-10-06T00:00:00Z', now), '10월 6일');
}
const newsJs = read('site-regional-news.js');
assert.doesNotMatch(newsJs, /\bimg\b|createElement\('img'|innerHTML|background-image|placeholder/u, 'cards have no image element');
const newsCss = read('site-regional-news.css');
assert.doesNotMatch(newsCss, /aspect-ratio|background-image|media/u, 'no media box in the card styles');
assert.match(newsJs, /link\.rel = 'noopener noreferrer'/u);
assert.match(read('site-core.js'), /newsResult: payload\.news_result && typeof payload\.news_result === 'object' && payload\.news_result\.contract_id === 'CORE-REGIONAL-NEWS-01'/u);
assert.equal((read('site-core.js').match(/newsResult: payload\.news_result/gu) || []).length, 2, 'guest and signed-in responses both carry news_result');

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
  throw new Error('Chrome/Chromium is required for the regional news validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA},
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-390x844', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
  {label: 'mobile-390x844-dark', width: 390, height: 844, mobile: true, userAgent: IPHONE_UA, theme: 'dark'},
];

const SWITCH_OFF_ANSWER = '전주 소식은 일반 대화로 답했어요(뉴스 검색 꺼짐).';

function buildInner(theme) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('rn-result');
try {
  localStorage.clear();
  ${theme ? `localStorage.setItem('lotbi.site.theme.bootstrap.v1', ${JSON.stringify(theme)});` : ''}
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.__sent = [];
  globalThis.__geolocationCalls = 0;
  try {
    const geo = navigator.geolocation;
    if (geo) {
      geo.getCurrentPosition = (ok, fail) => { globalThis.__geolocationCalls += 1; fail?.({code: 1, message: 'denied'}); };
      geo.watchPosition = () => { globalThis.__geolocationCalls += 1; return 0; };
    }
  } catch {}
  const NEWS = ${newsResult.toString()};
  const MINUTE = 60000;
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
      // NAVER_NEWS_SEARCH_ENABLED off: Core's run_regional_news returns None and
      // the turn takes the general route — an answer without news_result.
      const news = globalThis.__newsSwitch !== false && /뉴스|소식/u.test(String(body.text || ''));
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: news ? '군산시 최신 뉴스 5건이에요. 같은 사건을 다룬 기사는 한 건으로 묶었어요.' : globalThis.__newsSwitch === false ? ${JSON.stringify(SWITCH_OFF_ANSWER)} : '확인했어요.',
        response_mode: news ? 'NEWS_PROVIDER_READONLY' : 'DETERMINISTIC', correlation_id:'req_regionalnews01',
        intent: news ? {action:'REGIONAL_NEWS',domain:'NEWS'} : {action:'ANSWER',domain:'GENERAL'},
        follow_up:{required:false,action:'REGIONAL_NEWS',automatic_execution:false},
        ...(news ? {news_result: NEWS(Date.now())} : {}),
        routing:{route: news ? 'NEWS_READONLY' : 'LOCAL', ai_calls:0},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
          order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=regionalnews01');
  if (!conversation.mountConversation()) throw new Error('mount');
  out.textContent = JSON.stringify({ok:true});
} catch (e) { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); }
</script><pre id="rn-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

const PROBE = `(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
  const lines = node => { const range = document.createRange(); range.selectNodeContents(node); return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; };
  const workspace = document.querySelector('.consumer-workspace');
  const panel = workspace?.querySelector('.site-modal');
  const shortcuts = [...(workspace?.querySelectorAll('.consumer-shortcut') || [])].map(button => {
    const label = button.querySelector('span');
    const b = box(button);
    const hit = document.elementFromPoint(b.cx, Math.min(Math.max(b.cy, 0), innerHeight - 1))?.closest?.('.consumer-shortcut') === button;
    return {id: button.dataset.lifeShortcut, label: label?.textContent || '', box: b, lines: label ? lines(label) : 0,
      clipped: label ? label.scrollWidth > label.parentElement.clientWidth : true, hit, icon: Boolean(button.querySelector('svg path'))};
  });
  const detail = workspace?.querySelector('.consumer-life-detail');
  const results = [...document.querySelectorAll('.lotbi-news-result')];
  const result = results.at(-1) || null;
  const color = node => node ? getComputedStyle(node).color : '';
  const cards = [...(result?.querySelectorAll('.lotbi-news-card') || [])].map(card => ({
    box: box(card), title: card.querySelector('.lotbi-news-title')?.textContent || '',
    titleLines: (() => { const t = card.querySelector('.lotbi-news-title'); if (!t) return 0; return Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)); })(),
    source: card.querySelector('.lotbi-news-source')?.textContent || '', time: card.querySelector('.lotbi-news-time')?.textContent || '',
    snippet: card.querySelector('.lotbi-news-snippet')?.textContent || '',
    open: (() => { const a = card.querySelector('.lotbi-news-open'); return a ? {href: a.href, target: a.target, rel: a.rel, text: a.textContent, box: box(a)} : null; })(),
    related: card.querySelector('.lotbi-news-related-toggle')?.textContent || '',
    relatedOpen: Boolean(card.querySelector('.lotbi-news-related')?.open),
    relatedLinks: [...card.querySelectorAll('.lotbi-news-related-link')].map(a => a.href),
    media: card.querySelectorAll('img, picture, video, canvas, [class*="media"], [class*="image"], [class*="thumb"]').length,
    titleColor: color(card.querySelector('.lotbi-news-title')),
    border: getComputedStyle(card).borderTopColor,
  }));
  return {
    open: Boolean(workspace), title: panel?.querySelector('.site-modal-header h2, h2')?.textContent || '',
    description: panel?.querySelector('.site-modal-description')?.textContent || '',
    viewport: {w: innerWidth, h: innerHeight},
    pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
    shortcuts,
    detail: detail ? {id: detail.dataset.lifeDetail || '', title: detail.querySelector('h3')?.textContent || '',
      back: [...detail.querySelectorAll('.consumer-action')].find(b => b.textContent === '지역정보로 돌아가기') ? true : false,
      field: detail.querySelector('[data-news-field="region"]')?.placeholder || '',
      nearby: Boolean(detail.querySelector('[data-news-nearby]')), note: detail.querySelector('.consumer-feature-note')?.textContent || ''} : null,
    composer: document.getElementById('lotbi-prompt')?.value ?? null,
    active: document.activeElement ? {tag: document.activeElement.tagName, id: document.activeElement.id || '', shortcut: document.activeElement.dataset?.lifeShortcut || ''} : null,
    results: results.length, cards, attribution: result?.querySelector('.lotbi-news-attribution')?.textContent || '',
    assistantTexts: [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')].map(node => (node.textContent || '').trim()),
    resultMedia: result ? result.querySelectorAll('img, picture, video').length : 0,
    pageBackground: getComputedStyle(document.body).backgroundColor, theme: document.body.dataset.siteTheme || '',
  };
})()`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
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

const innerHeightOf = testCase => testCase.height;

function luminance(rgb) {
  const [r, g, b] = (rgb.match(/[\d.]+/gu) || []).slice(0, 3).map(Number).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function runCase(browser, origin, dir, testCase) {
  const innerRel = `scripts/${path.basename(dir)}/${testCase.theme ? `inner-${testCase.theme}` : 'inner'}.html`;
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.REGIONAL_NEWS_SCREENSHOT_DIR || '';
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
      const text = await evaluate("document.getElementById('rn-result')?.textContent || 'pending'").catch(() => 'pending');
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
    // The conversation keeps a fresh answer pinned for a moment after it
    // lands, so scroll until the element stays in view.
    const reveal = async selector => {
      for (let attempt = 0; ; attempt += 1) {
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'}), true`);
        await sleep(attempt ? 300 : 120);
        const center = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {cx: r.x + r.width / 2, cy: r.y + r.height / 2}; })()`);
        if ((center.cy > 0 && center.cy < innerHeightOf(testCase)) || attempt >= 12) return center;
      }
    };
    const shot = async name => {
      if (!shots) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(shots, {recursive: true});
      fs.writeFileSync(path.join(shots, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const openLife = async () => {
      await evaluate("document.querySelector('[data-consumer-section=\"life\"]').click(), true");
      await waitFor(async () => (await probe()).shortcuts.length === LIFE_SHORTCUTS.length, `${testCase.label}: life shortcuts`);
      await sleep(250);
    };
    // One tap on a life entry either drafts the sentence into the composer (the
    // send button then sends it) or, where the life home sends directly, sends
    // it. Either way Core must receive exactly that sentence.
    const sentAfterEntry = async (expected, before) => {
      const outcome = await waitFor(async () => {
        const sent = await evaluate('globalThis.__sent.slice()');
        if (sent.length > before) return {mode: 'DIRECT', sent};
        const state = await probe();
        if (!state.open && state.composer === expected) return {mode: 'DRAFT', sent};
        return null;
      }, `${testCase.label}: ${expected}`);
      if (outcome.mode === 'DRAFT') {
        await evaluate("document.querySelector('.send-button').click(), true");
        outcome.sent = await waitFor(async () => { const sent = await evaluate('globalThis.__sent.slice()'); return sent.length > before ? sent : null; }, `${testCase.label}: sent`);
      }
      const body = outcome.sent.at(-1);
      assert.equal(body.text, expected, `${testCase.label}: Core receives the sentence unchanged`);
      return {mode: outcome.mode, body};
    };
    const answered = async count => waitFor(async () => {
      const state = await probe();
      return state.results >= count && state.cards.length ? state : null;
    }, `${testCase.label}: news cards`);

    // 1. 지역정보 home.
    await openLife();
    let state = await probe();
    assert.equal(state.title, '지역정보');
    assert.equal(state.description, '저장한 지역과 내 주변의 필요한 정보를 찾아보세요.');
    const news = state.shortcuts.find(item => item.id === 'news');
    assert.ok(news, `${testCase.label}: 지역뉴스 card`);
    assert.equal(news.label, '지역뉴스');
    assert.equal(news.icon, true);
    assert.equal(news.lines, 1, `${testCase.label}: label on one line`);
    assert.equal(news.clipped, false);
    assert.ok(news.box.h >= 44, `${testCase.label}: touch target ${news.box.h}`);
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: no sideways scroll`);
    for (const card of state.shortcuts) assert.ok(card.box.x >= 0 && card.box.right <= state.viewport.w + 0.5, `${testCase.label}: ${card.label} inside viewport`);
    const heights = new Set(state.shortcuts.map(item => Math.round(item.box.h)));
    assert.equal(heights.size, 1, `${testCase.label}: equal card heights ${[...heights]}`);
    await shot('01-region-info-home');

    // 2. No saved region: a one-field form, nothing focused that opens a keyboard.
    await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
    state = await waitFor(async () => { const value = await probe(); return value.detail?.id === 'news' ? value : null; }, `${testCase.label}: news form`);
    assert.equal(state.detail.title, '지역뉴스');
    assert.equal(state.detail.back, true);
    assert.equal(state.detail.field, '예: 전주시, 군산시, 완산구');
    assert.equal(state.detail.nearby, true);
    assert.ok(!['INPUT', 'TEXTAREA'].includes(state.active?.tag), `${testCase.label}: opening the form does not raise the keyboard (${JSON.stringify(state.active)})`);
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: news form fits`);
    await shot('02-news-form');
    // ← returns to 지역정보 with focus on the card it came from.
    await tap(await reveal('.consumer-life-detail > .consumer-action'));
    state = await waitFor(async () => { const value = await probe(); return !value.detail && value.shortcuts.length === LIFE_SHORTCUTS.length ? value : null; }, `${testCase.label}: back to 지역정보`);
    assert.equal(state.active?.shortcut, 'news', `${testCase.label}: focus returns to 지역뉴스`);
    assert.equal(state.title, '지역정보');

    // 3. Type a region → Core receives "군산 뉴스 알려 줘" → compact cards.
    await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
    await waitFor(async () => (await probe()).detail?.id === 'news', `${testCase.label}: news form again`);
    await tap(await reveal('[data-news-field="region"]'));
    await page('Input.insertText', {text: '군산'});
    await sleep(80);
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    const typed = await sentAfterEntry('군산 뉴스 알려 줘', 0);
    assert.equal(typed.body.client_context?.location, undefined, `${testCase.label}: a named region sends no location without a saved region`);
    assert.equal(await evaluate('globalThis.__geolocationCalls'), 0, `${testCase.label}: news for a named region never asks for the position`);
    state = await answered(1);
    assert.equal(state.cards.length, 5);
    assert.equal(state.resultMedia, 0, `${testCase.label}: no image in the answer`);
    assert.equal(state.attribution, '검색: NAVER · 기사: 각 언론사');
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: answer fits (${state.pageOverflowX})`);
    for (const card of state.cards) {
      assert.ok(card.title && card.source && card.time, `${testCase.label}: ${card.title} has title, outlet and time`);
      assert.equal(card.media, 0, `${testCase.label}: ${card.title} has no media box`);
      assert.ok(card.titleLines <= 3, `${testCase.label}: ${card.title} at most three lines`);
      assert.ok(card.box.x >= 0 && card.box.right <= state.viewport.w + 0.5, `${testCase.label}: card inside viewport`);
      assert.ok(card.box.h <= 220, `${testCase.label}: compact card ${Math.round(card.box.h)}px`);
      assert.equal(card.open?.text, '원문 열기');
      assert.equal(card.open?.target, '_blank');
      assert.match(card.open?.rel || '', /noopener/u);
      assert.ok(card.open.box.h >= 32, `${testCase.label}: 원문 열기 touch target`);
    }
    assert.equal(state.cards[0].open.href, 'https://www.kunsan.co.kr/news/articleView.html?idxno=90001');
    assert.equal(state.cards[0].time, '35분 전');
    assert.equal(state.cards[0].related, '관련 보도 2건');
    assert.ok(state.cards.slice(1).every(card => !card.related), 'no 관련 보도 line on a single-report story');
    assert.equal(state.cards[3].snippet, '', 'a story without a snippet shows no empty snippet line');
    assert.equal(state.cards[4].source, '네이버 뉴스');
    await shot('03-news-cards');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await tap(await reveal('.lotbi-news-related-toggle'));
      state = await probe();
      if (state.cards[0].relatedOpen) break;
    }
    assert.equal(state.cards[0].relatedOpen, true, `${testCase.label}: 관련 보도 opens on tap`);
    assert.deepEqual(state.cards[0].relatedLinks, ['https://www.jbnews.com/news/articleView.html?idxno=1', 'https://www.jjan.kr/article/2']);
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: related list fits`);
    await shot('04-related-open');
    if (testCase.theme === 'dark') {
      assert.equal(state.theme, 'dark');
      const contrast = Math.abs(luminance(state.cards[0].titleColor) - luminance(state.pageBackground));
      assert.ok(contrast > 0.4, `${testCase.label}: card text readable on the dark page (${state.cards[0].titleColor} on ${state.pageBackground})`);
    }

    // 3b. Core news switch off (NAVER_NEWS_SEARCH_ENABLED=false — the Production
    // state until the owner approves): the same entry still sends the sentence,
    // Core answers on the general route without news_result, and the Site shows
    // that answer with no news card. Then the switch goes back on.
    await evaluate('globalThis.__newsSwitch = false, true');
    await openLife();
    const offSent = await evaluate('globalThis.__sent.length');
    const offResults = (await probe()).results;
    await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
    await waitFor(async () => (await probe()).detail?.id === 'news', `${testCase.label}: news form (switch off)`);
    await tap(await reveal('[data-news-field="region"]'));
    await page('Input.insertText', {text: '전주'});
    await sleep(80);
    await tap(await reveal('.consumer-life-detail form button[type=submit]'));
    const off = await sentAfterEntry('전주 뉴스 알려 줘', offSent);
    assert.equal(off.body.text, '전주 뉴스 알려 줘');
    state = await waitFor(async () => { const value = await probe(); return value.assistantTexts.some(text => text.includes(SWITCH_OFF_ANSWER)) ? value : null; }, `${testCase.label}: general answer with the news switch off`);
    assert.equal(state.results, offResults, `${testCase.label}: switch off → no news card block (${state.results} vs ${offResults})`);
    assert.ok(!state.assistantTexts.at(-1).includes('원문 열기'), `${testCase.label}: switch off → the answer has no 원문 열기`);
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: switch-off answer fits`);
    await shot('03b-news-switch-off');
    await evaluate('globalThis.__newsSwitch = true, true');

    // 4. Saved region: one tap asks for that region, the saved region rides along.
    await evaluate(`localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전주시', latitude: 35.824, longitude: 127.148})), true`);
    await openLife();
    let before = (await evaluate('globalThis.__sent.length'));
    await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
    const saved = await sentAfterEntry('전주시 뉴스 알려 줘', before);
    assert.equal(await evaluate('globalThis.__geolocationCalls'), 0, `${testCase.label}: saved-region news never asks for the position`);
    assert.deepEqual(
      {source: saved.body.client_context?.location?.source, label: saved.body.client_context?.location?.label},
      {source: 'SAVED_REGION', label: '전주시'},
      `${testCase.label}: saved region sent with the news turn`,
    );
    await answered(2);
    if (saved.mode === 'DIRECT') {
      state = await probe();
      assert.notEqual(state.active?.id, 'lotbi-prompt', `${testCase.label}: one-tap news leaves the keyboard closed`);
    }

    // 5. 내 주변 뉴스: the browser's own permission prompt is the consent. With
    // location use on (the default) and permission denied nothing is sent; with
    // location use off the position is not even asked for. Never guessed.
    await evaluate(`localStorage.removeItem('lotbi.calendar.weather-region.v1'), true`);
    for (const usage of ['default', 'off']) {
      if (usage === 'off') await evaluate(`document.cookie = 'lotbi_location_usage_v1=off; path=/', true`);
      await openLife();
      before = (await evaluate('globalThis.__sent.length'));
      const geolocationBefore = await evaluate('globalThis.__geolocationCalls');
      await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
      await waitFor(async () => (await probe()).detail?.id === 'news', `${testCase.label}: news form for 내 주변 (${usage})`);
      await tap(await reveal('[data-news-nearby]'));
      const nearby = await sentAfterEntry('내 주변 뉴스 알려 줘', before);
      assert.equal(nearby.body.client_context?.location, undefined, `${testCase.label}: no location when permission is denied / location use is off (${usage})`);
      const asked = (await evaluate('globalThis.__geolocationCalls')) - geolocationBefore;
      assert.ok(usage === 'off' ? asked === 0 : asked <= 1, `${testCase.label}: geolocation requests with location use ${usage}: ${asked}`);
    }

    // 6. Desktop: eight categories (응급실 + 지역뉴스) fill every row of two —
    // no empty cell, and the last card keeps the column width.
    if (!testCase.mobile) {
      await openLife();
      await evaluate(`document.querySelector('.consumer-workspace [data-life-shortcut="bills"]')?.remove(), true`);
      state = await probe();
      const first = state.shortcuts[0].box;
      const last = state.shortcuts.at(-1).box;
      const beforeLast = state.shortcuts.at(-2).box;
      assert.equal(state.shortcuts.length, 8);
      assert.equal(state.shortcuts.at(-1).id, 'education');
      assert.ok(Math.abs(last.w - first.w) <= 1, `${testCase.label}: last card keeps the column width (${Math.round(last.w)} vs ${Math.round(first.w)})`);
      assert.ok(Math.abs(last.y - beforeLast.y) <= 1 && last.x > beforeLast.right - 1, `${testCase.label}: the last row holds two cards (no empty cell)`);
      await shot('05-even-rows');
    }
    return {entry: typed.mode, cards: state.cards?.length ?? 0, firstCard: `${Math.round(state.cards?.[0]?.box.w || 0)}x${Math.round(state.cards?.[0]?.box.h || 0)}`};
  } finally {
    cdp.close();
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.regional-news-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(''), 'utf8');
  fs.writeFileSync(path.join(dir, 'inner-dark.html'), buildInner('dark'), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const result = await runCase(browser, origin, dir, testCase);
    console.log(`REGIONAL_NEWS_P0 ${testCase.label}`, JSON.stringify(result));
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log('REGIONAL-NEWS-P0-01 OK — 지역정보 label, 지역뉴스 entry (saved region / typed region / 내 주변) and compact news cards with original-article handoff (viewport emulation, not a device run)');
