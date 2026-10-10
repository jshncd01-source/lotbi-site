// REGIONAL-NEWS-P0 — 지역정보 label, the 지역뉴스 screen list and the news answer cards.
//
// REGIONAL-NEWS-SCREEN-LIST-01: 지역뉴스 lists 광역시·도 news titles in its own
// screen (GET /v2/life/news) — nothing is sent to the conversation. A typed
// news question in the conversation still gets the compact news cards.
// Source part: the 지역뉴스 shortcut and screen module, the location rule for
// news turns and the CORE-REGIONAL-NEWS-01 card contract.
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
import {LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {NEWS_LIST_LIMIT, NEWS_PERIODS, NEWS_PROVINCES, feedListItems, formatNewsTime, newsListItems, newsListUrl, safeArticleHref, visibleCategories} from '../site-life-news.js';
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

// ── 지역뉴스 shortcut and screen ──────────────────────────────────────────
const ids = LIFE_SHORTCUTS.map(item => item.id);
assert.equal(ids[ids.indexOf('festivals') + 1], 'news', '지역뉴스 sits right after 축제·행사');
assert.deepEqual(LIFE_SHORTCUTS.find(item => item.id === 'news'), {id: 'news', label: '지역뉴스', icon: 'news'});
const sections = read('site-consumer-sections.js');
assert.match(sections, /news: \['M4 5h13v14/u, 'a line news icon in the shortcut icon set');
assert.match(sections, /item\.id === 'news' \? openNewsEntry\(item\)/u);
assert.match(sections, /import\('\.\/site-life-news\.js\?v=aset-[0-9a-f]{12}'\)\.then\(\(\{mountRegionalNews\}\) =>/u, '지역뉴스 mounts its own list screen');
assert.doesNotMatch(sections, /buildRegionalNewsPrompt|뉴스 알려 줘/u, 'the 지역뉴스 card asks the conversation nothing');
const newsScreen = read('site-life-news.js');
assert.doesNotMatch(newsScreen, /onAsk|onDraft|innerHTML|localStorage|sessionStorage|type = 'text'|createElement\('input'\)|el\('input'/u, 'no typing, no conversation, no storage, no HTML injection');
assert.match(newsScreen, /credentials: 'omit'/u);
// The screen's styles never reach the conversation news cards, which share
// .lotbi-news-title / .lotbi-news-list (site-regional-news.css): every rule in
// site-life-news.css starts at the screen root.
for (const selector of read('site-life-news.css').replace(/\/\*[\s\S]*?\*\//gu, '').split('}').map(block => block.split('{')[0]).flatMap(head => head.split(',')).map(part => part.trim()).filter(Boolean)) {
  assert.ok(selector === '.lotbi-news' || selector.startsWith('.lotbi-news '), `site-life-news.css rule outside the screen root: ${selector}`);
}
assert.match(newsScreen, /link\.rel = 'noopener noreferrer'/u);
assert.match(newsScreen, /link\.target = '_blank'/u);
assert.equal(NEWS_PROVINCES.length, 17);
assert.deepEqual(NEWS_PERIODS.map(item => [item.id, item.label]), [['today', '오늘'], ['week', '1주일']]);
// REGIONAL-NEWS-CATEGORIES-01: the screen reads Core's view=feed (분야, 오늘 pages
// of 20 with 더보기, 1주일 by day).
assert.equal(NEWS_LIST_LIMIT, 20);
assert.equal(newsListUrl({region: '전북특별자치도', period: 'today'}, 'https://api.example'), 'https://api.example/v2/life/news?region=%EC%A0%84%EB%B6%81%ED%8A%B9%EB%B3%84%EC%9E%90%EC%B9%98%EB%8F%84&period=today&limit=20&view=feed');
assert.equal(newsListUrl({latitude: 35.81254, longitude: 127.11756, period: 'week'}, 'https://api.example'), 'https://api.example/v2/life/news?latitude=35.813&longitude=127.118&period=week&limit=20&view=feed', 'coarse coordinates only');
assert.equal(newsListUrl({region: '전북', category: 'sports', offset: 20}, 'https://api.example'), 'https://api.example/v2/life/news?region=%EC%A0%84%EB%B6%81&period=today&limit=20&view=feed&category=sports&offset=20');
assert.deepEqual(feedListItems([{title: '나중', source_label: 'a', url: 'https://a.kr/1', published_at: '2026-10-10T01:00:00+09:00'},
  {title: '링크 없음', url: 'javascript:alert(1)'}, {title: '먼저', source_label: 'b', url: 'https://b.kr/2', published_at: '2026-10-10T05:00:00+09:00'}]).map(item => item.title),
  ['나중', '먼저'], "the feed keeps Core's order (sports / photo last under 전체) and drops unlinkable items");
assert.deepEqual(visibleCategories([{id: 'all', label: '전체', count: 3}, {id: 'politics', label: '행정·정치', count: 2}, {id: 'culture', label: '문화·축제·관광', count: 0}]).map(entry => entry.id),
  ['all', 'politics'], 'a 분야 with no story is hidden');
assert.deepEqual(visibleCategories([{id: 'all', count: 0}, {id: 'culture', count: 0}], 'culture').map(entry => entry.id), ['all', 'culture'], 'the picked 분야 stays');
assert.equal(newsListUrl({region: '전주시', period: 'month'}, 'https://api.example').includes('period=today'), true, 'an unknown period falls back to 오늘');
assert.equal(safeArticleHref('javascript:alert(1)'), '');
assert.equal(safeArticleHref('data:text/html,x'), '');
assert.equal(safeArticleHref('https://www.jjan.kr/article/1'), 'https://www.jjan.kr/article/1');
{
  const items = newsListItems({items: [
    {title: '앞 기사', source_label: 'a.kr', url: 'https://a.kr/1', published_at: '2026-10-10T01:00:00+09:00'},
    {title: '링크 없는 기사', source_label: 'b.kr', url: 'javascript:alert(1)', published_at: '2026-10-10T03:00:00+09:00'},
    {title: '새 기사', source_label: 'c.kr', url: 'https://c.kr/2', published_at: '2026-10-10T02:00:00+09:00'},
    {title: '', source_label: 'd.kr', url: 'https://d.kr/3', published_at: '2026-10-10T04:00:00+09:00'},
  ]});
  assert.deepEqual(items.map(item => item.title), ['새 기사', '앞 기사'], 'newest first; an item without a title or a web link is dropped, never padded');
  assert.equal(newsListItems(null).length, 0);
  const now = new Date('2026-10-10T05:00:00+09:00');
  assert.equal(formatNewsTime('2026-10-10T02:05:00+09:00', now), '오전 2:05');
  assert.equal(formatNewsTime('2026-10-09T15:05:00+09:00', now), '10월 9일 오후 3:05');
  assert.equal(formatNewsTime('not a date', now), '');
}

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

// Core's view=feed for one 광역시·도 (REGIONAL-NEWS-CATEGORIES-01): 오늘 has 26
// stories (two pages of 20; sports last under 전체; one unlinkable item that the
// Site drops), 문화·축제·관광 has none (its tab is hidden), 1주일 has seven days of
// at most ten stories.
function screenFeed(now, label, source, params) {
  const at = minutes => new Date(now - minutes * 60000).toISOString();
  const short = label.slice(0, 2);
  const plan = ['politics', 'economy', 'society', 'education', 'welfare', 'traffic_realestate', 'weather_safety'];
  const labels = {politics: '행정·정치', economy: '경제·일자리', society: '사회·사건사고', education: '교육', welfare: '복지·생활',
    traffic_realestate: '교통·부동산', culture: '문화·축제·관광', weather_safety: '날씨·재난·안전', sports: '스포츠'};
  const outlets = ['jjan.kr', 'jbnews.com', 'jeonmin.co.kr', 'newsis.com'];
  const story = (n, category, minutes) => ({cluster_id: `nwc_${n}`, title: `${short} ${labels[category]} 소식 ${n}번째 기사`,
    source_label: outlets[n % outlets.length], url: `https://www.${outlets[n % outlets.length]}/news/${n}`, published_at: at(minutes),
    related_count: 0, category, category_label: labels[category], photo: false});
  const today = [];
  for (let n = 0; n < 21; n += 1) today.push(story(n, plan[n % plan.length], 10 + n * 5));
  for (let n = 21; n < 25; n += 1) today.push(story(n, 'sports', 5 + n));
  today.push({...story(25, 'sports', 30), title: '링크가 없는 기사', url: 'javascript:alert(1)'});
  const category = params.category || 'all';
  const counts = Object.fromEntries(Object.keys(labels).map(id => [id, today.filter(item => item.category === id).length]));
  const categories = [{id: 'all', label: '전체', count: today.length}, ...Object.keys(labels).map(id => ({id, label: labels[id], count: counts[id]}))];
  const body = {status: 'OK', contract_id: 'CORE-REGIONAL-NEWS-FEED-01', region: {level: 'PROVINCE', label, source},
    period: params.period || 'today', category, categories, attribution: '검색: NAVER · 기사: 각 언론사'};
  if ((params.period || 'today') === 'week') {
    body.days = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(now - day * 86400000);
      const iso = date.toISOString().slice(0, 10);
      const name = day === 0 ? '오늘' : day === 1 ? '어제' : `${day}일 전`;
      const size = Math.max(3, 10 - day);
      const items = [];
      for (let k = 0; k < size; k += 1) {
        const pick = category === 'all' ? plan[(day + k) % plan.length] : category;
        items.push({...story(100 + day * 20 + k, pick, day * 1440 + 30 + k * 30), date: iso});
      }
      body.days.push({date: iso, label: `${name} · ${date.getMonth() + 1}월 ${date.getDate()}일`, items});
    }
  } else {
    const chosen = category === 'all' ? today : today.filter(item => item.category === category);
    const offset = Number(params.offset || 0);
    const limit = Number(params.limit || 20);
    const page = chosen.slice(offset, offset + limit);
    body.today = {items: page, total: chosen.length, offset, limit, has_more: offset + page.length < chosen.length};
  }
  return body;
}

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
  globalThis.__newsRequests = [];
  globalThis.__geolocationCalls = 0;
  globalThis.__permission = 'prompt';
  try {
    const geo = navigator.geolocation;
    if (geo) {
      const fix = () => ({coords: {latitude: 35.8125, longitude: 127.1175, accuracy: 30}, timestamp: Date.now()});
      geo.getCurrentPosition = (ok, fail) => {
        globalThis.__geolocationCalls += 1;
        if (globalThis.__permission === 'granted') ok?.(fix()); else fail?.({code: 1, message: 'denied'});
      };
      geo.watchPosition = () => { globalThis.__geolocationCalls += 1; return 0; };
    }
    if (navigator.permissions) {
      Object.defineProperty(navigator.permissions, 'query', {configurable: true,
        value: async () => ({state: globalThis.__permission, addEventListener() {}, removeEventListener() {}})});
    }
  } catch {}
  const NEWS = ${newsResult.toString()};
  const SCREEN_FEED = ${screenFeed.toString()};
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
    if (parsed.pathname === '/v2/life/news') {
      globalThis.__newsRequests.push(Object.fromEntries(parsed.searchParams));
      if (globalThis.__newsSwitch === false) return Promise.resolve(new Response(JSON.stringify({detail:{code:'NEWS_UNAVAILABLE'}}), {status:503,headers:{'Content-Type':'application/json'}}));
      const params = parsed.searchParams;
      const current = params.has('latitude');
      const asked = params.get('region') || '';
      const label = current || /전주|전북/u.test(asked) ? '전북특별자치도' : asked;
      const source = current ? 'CURRENT_LOCATION' : 'TEXT';
      return json(SCREEN_FEED(Date.now(), label, source, Object.fromEntries(params)));
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
  const newsRoot = workspace?.querySelector('.lotbi-news');
  const news = newsRoot ? {
    state: newsRoot.dataset.newsState || '', title: newsRoot.querySelector('.lotbi-news-title')?.textContent || '',
    basis: newsRoot.querySelector('.lotbi-news-basis')?.textContent || '',
    toggle: (() => { const t = newsRoot.querySelector('[data-news-region-toggle]'); return t ? {label: t.getAttribute('aria-label'), expanded: t.getAttribute('aria-expanded'), box: box(t)} : null; })(),
    pickerOpen: !newsRoot.querySelector('.lotbi-news-picker').hidden,
    options: [...newsRoot.querySelectorAll('[data-news-region] option')].map(o => o.value),
    selected: newsRoot.querySelector('[data-news-region]')?.value ?? '',
    allow: (() => { const a = newsRoot.querySelector('[data-news-allow-location]'); return a && !a.hidden ? {box: box(a), text: a.textContent} : null; })(),
    periods: [...newsRoot.querySelectorAll('[data-news-period]')].map(b => ({id: b.dataset.newsPeriod, pressed: b.getAttribute('aria-pressed'), visible: b.getClientRects().length > 0, h: b.getBoundingClientRect().height})),
    items: [...newsRoot.querySelectorAll('.lotbi-news-item')].map(a => ({href: a.href, target: a.target, rel: a.rel, box: box(a),
      title: a.querySelector('.lotbi-news-item-title')?.textContent || '', meta: a.querySelector('.lotbi-news-item-meta')?.textContent || '',
      titleLines: (() => { const t = a.querySelector('.lotbi-news-item-title'); return t ? Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) : 0; })(),
      titleColor: color(a.querySelector('.lotbi-news-item-title'))})),
    tabs: [...newsRoot.querySelectorAll('[data-news-category]')].map(b => ({id: b.dataset.newsCategory, label: b.textContent, pressed: b.getAttribute('aria-pressed'), h: b.getBoundingClientRect().height})),
    tabsHidden: Boolean(newsRoot.querySelector('.lotbi-news-categories')?.hidden),
    more: (() => { const m = newsRoot.querySelector('[data-news-more]'); return m && !m.hidden ? {box: box(m), text: m.textContent} : null; })(),
    days: [...newsRoot.querySelectorAll('.lotbi-news-day')].map(d => ({date: d.dataset.newsDay, title: d.querySelector('.lotbi-news-day-title')?.textContent || '', count: d.querySelectorAll('.lotbi-news-item').length})),
    status: newsRoot.querySelector('.lotbi-news-status')?.textContent || '',
    retry: Boolean(newsRoot.querySelector('.lotbi-news-retry') && !newsRoot.querySelector('.lotbi-news-retry').hidden),
    textInputs: (newsRoot.closest('.consumer-life-detail') || newsRoot).querySelectorAll('input:not([type=hidden]), textarea').length,
    surface: getComputedStyle(newsRoot).color,
  } : null;
  return {
    news,
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

    const newsState = async (predicate, label) => waitFor(async () => { const value = await probe(); return value.news && predicate(value.news) ? value : null; }, `${testCase.label}: ${label}`);
    const openNews = async () => {
      await openLife();
      await tap(await reveal('.consumer-workspace [data-life-shortcut="news"]'));
    };
    const pick = async value => {
      await evaluate(`(() => { const s = document.querySelector('[data-news-region]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
    };
    const checkList = (value, step, count = 20) => {
      const list = value.news;
      assert.equal(list.items.length, count, `${testCase.label}: ${step}: Core's linkable stories only, never padded (${list.items.length})`);
      const sports = list.items.map(item => item.title.includes('스포츠'));
      assert.deepEqual(sports, [...sports].sort(), `${testCase.label}: ${step}: Core's order kept — sports after the rest under 전체`);
      for (const item of list.items) {
        assert.match(item.href, /^https:\/\//u, `${testCase.label}: ${step}: a title opens the article`);
        assert.equal(item.target, '_blank');
        assert.match(item.rel, /noopener/u);
        assert.ok(item.titleLines >= 1 && item.titleLines <= 2, `${testCase.label}: ${step}: ${item.title} at most two lines (${item.titleLines})`);
        assert.match(item.meta, /^\S.* · (?:\d{1,2}월 \d{1,2}일 )?(?:오전|오후) \d{1,2}:\d{2}$/u, `${testCase.label}: ${step}: outlet · time (${item.meta})`);
        assert.ok(item.box.h >= 44, `${testCase.label}: ${step}: touch target ${item.box.h}`);
        assert.ok(item.box.x >= 0 && item.box.right <= value.viewport.w + 0.5, `${testCase.label}: ${step}: row inside the viewport`);
      }
      assert.ok(value.pageOverflowX <= 0 && value.panelOverflowX <= 0, `${testCase.label}: ${step}: no sideways scroll`);
      assert.equal(list.textInputs, 0, `${testCase.label}: ${step}: nothing to type`);
    };

    // 2. No saved region, location use on but not allowed yet: the screen asks
    //    for a 시·도 (no typing), shows [위치 허용], and reads nothing yet.
    await openNews();
    state = await newsState(news => news.state === 'PICK', 'pick a region');
    assert.equal(state.news.title, '지역뉴스');
    assert.equal(state.news.pickerOpen, true);
    assert.equal(state.news.options[0], '', 'placeholder first');
    assert.equal(state.news.options.length, 18, '시·도 선택 + 17 시·도');
    assert.ok(state.news.allow && state.news.allow.box.h >= 44, `${testCase.label}: [위치 허용] while location use is on but not allowed`);
    assert.equal(state.news.toggle.label, '지역 변경');
    assert.ok(state.news.toggle.box.h >= 44 && state.news.toggle.box.w >= 44, `${testCase.label}: 지역 변경 touch target`);
    assert.equal(state.news.textInputs, 0, `${testCase.label}: nothing to type`);
    assert.equal(state.news.status, '지역을 골라 주세요.');
    assert.equal(await evaluate('globalThis.__newsRequests.length'), 0, `${testCase.label}: nothing read before a region`);
    assert.equal(await evaluate('globalThis.__geolocationCalls'), 0, `${testCase.label}: no position asked before [위치 허용]`);
    assert.ok(!['INPUT', 'TEXTAREA'].includes(state.active?.tag), `${testCase.label}: no keyboard`);
    assert.ok(state.pageOverflowX <= 0 && state.panelOverflowX <= 0, `${testCase.label}: pick screen fits`);
    await shot('02-news-pick');
    // ← (the header's, the one back of the screen — QA 2026-10-10 #3) returns
    // to 지역정보 with focus on the card it came from.
    assert.equal(await evaluate("document.querySelectorAll('.consumer-life-detail > .consumer-action-secondary').length"), 0, `${testCase.label}: no second text back`);
    await tap(await reveal('.consumer-workspace .site-modal-close'));
    state = await waitFor(async () => { const value = await probe(); return !value.detail && value.shortcuts.length === LIFE_SHORTCUTS.length ? value : null; }, `${testCase.label}: back to 지역정보`);
    assert.equal(state.active?.shortcut, 'news', `${testCase.label}: focus returns to 지역뉴스`);

    // 3. Pick 전북특별자치도 → the list shows in this screen; nothing goes to the
    //    conversation. [1주일] reads the last seven days.
    const sentBefore = await evaluate('globalThis.__sent.length');
    await openNews();
    await newsState(news => news.state === 'PICK', 'pick again');
    await pick('전북특별자치도');
    state = await newsState(news => news.state === 'READY', 'province list');
    assert.equal(state.news.title, '전북특별자치도 지역뉴스');
    assert.equal(state.news.basis, '선택한 지역 · 오늘 · 최신순');
    assert.deepEqual(await evaluate('globalThis.__newsRequests.at(-1)'), {region: '전북특별자치도', period: 'today', limit: '20', view: 'feed'});
    checkList(state, 'today');
    // 분야 tabs: 전체 + every 분야 with a story (문화·축제·관광 has none → hidden).
    assert.equal(state.news.tabsHidden, false);
    assert.deepEqual(state.news.tabs.map(tab => tab.id), ['all', 'politics', 'economy', 'society', 'education', 'welfare', 'traffic_realestate', 'weather_safety', 'sports']);
    assert.equal(state.news.tabs[0].pressed, 'true');
    for (const tab of state.news.tabs) assert.ok(tab.h >= 44, `${testCase.label}: ${tab.id} tab touch target`);
    // 더보기 reads the next 20 (here the last five linkable ones: 25 in all).
    assert.ok(state.news.more && state.news.more.box.h >= 44, `${testCase.label}: 더보기 shown while more stories wait`);
    await tap(await reveal('[data-news-more]'));
    state = await newsState(news => news.items.length === 25 && !news.more, '더보기');
    assert.equal((await evaluate('globalThis.__newsRequests.at(-1)')).offset, '20');
    checkList(state, 'today + 더보기', 25);
    // 스포츠 tab → only 스포츠 stories; 전체 again → back to the first page.
    await tap(await reveal('[data-news-category="sports"]'));
    state = await newsState(news => news.state === 'READY' && news.tabs.find(tab => tab.id === 'sports')?.pressed === 'true', '스포츠 tab');
    assert.equal((await evaluate('globalThis.__newsRequests.at(-1)')).category, 'sports');
    assert.ok(state.news.items.length === 4 && state.news.items.every(item => item.title.includes('스포츠')), `${testCase.label}: 스포츠 only`);
    await tap(await reveal('[data-news-category="all"]'));
    state = await newsState(news => news.state === 'READY' && news.tabs[0]?.pressed === 'true' && news.items.length === 20, '전체 again');
    assert.deepEqual(state.news.periods.map(item => [item.id, item.pressed]), [['today', 'true'], ['week', 'false']]);
    for (const period of state.news.periods) assert.ok(period.h >= 44, `${testCase.label}: ${period.id} touch target`);
    await shot('03-news-list');
    await tap(await reveal('[data-news-period="week"]'));
    state = await newsState(news => news.state === 'READY' && news.basis.includes('1주일'), '1주일 by day');
    assert.equal(state.news.basis, '선택한 지역 · 1주일 · 날짜별 대표 기사');
    assert.equal((await evaluate('globalThis.__newsRequests.at(-1)')).period, 'week');
    // One heading per day (오늘, 어제 … 6일 전), at most ten stories each, no date twice.
    assert.equal(state.news.days.length, 7);
    assert.equal(new Set(state.news.days.map(day => day.date)).size, 7, `${testCase.label}: no date twice`);
    assert.ok(state.news.days[0].title.startsWith('오늘') && state.news.days[1].title.startsWith('어제'), JSON.stringify(state.news.days.map(day => day.title)));
    assert.ok(state.news.days.every(day => day.count >= 1 && day.count <= 10), `${testCase.label}: 1~10 stories per day`);
    assert.equal(state.news.more, null, `${testCase.label}: no 더보기 on 1주일`);
    checkList(state, 'week', state.news.days.reduce((sum, day) => sum + day.count, 0));
    await shot('03c-news-week');
    assert.equal(await evaluate('globalThis.__sent.length'), sentBefore, `${testCase.label}: the 지역뉴스 screen sends nothing to the conversation`);
    if (testCase.theme === 'dark') {
      assert.ok(luminance(state.pageBackground) < 0.2, `${testCase.label}: the list sits on the dark page (${state.pageBackground})`);
      const contrast = Math.abs(luminance(state.news.items[0].titleColor) - luminance(state.pageBackground));
      assert.ok(contrast > 0.4, `${testCase.label}: list text readable on the dark page`);
    }
    // 지역 변경 opens the picker again.
    await tap(await reveal('[data-news-region-toggle]'));
    state = await newsState(news => news.pickerOpen, '지역 변경');
    assert.equal(state.news.toggle.expanded, 'true');

    // 3b. Core news off or failing: a plain error with 다시 시도, no list and
    //     nothing old shown in its place.
    await evaluate('globalThis.__newsSwitch = false, true');
    await pick('서울특별시');
    state = await newsState(news => news.state === 'ERROR', 'news off');
    assert.equal(state.news.items.length, 0, `${testCase.label}: no stale list on an error`);
    assert.equal(state.news.status, '지역뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    assert.equal(state.news.retry, true);
    await shot('03b-news-error');
    await evaluate('globalThis.__newsSwitch = true, true');
    await tap(await reveal('.lotbi-news-retry'));
    state = await newsState(news => news.state === 'READY', 'retry');
    assert.equal(state.news.title, '서울특별시 지역뉴스');

    // 4. Saved region, location not allowed: the saved region's list shows at
    //    once; [위치 허용] stays offered; no position is asked.
    await evaluate(`localStorage.setItem('lotbi.calendar.weather-region.v1', JSON.stringify({label: '전주시', latitude: 35.824, longitude: 127.148})), true`);
    const geoBeforeSaved = await evaluate('globalThis.__geolocationCalls');
    await openNews();
    state = await newsState(news => news.state === 'READY' && news.basis.startsWith('저장 지역'), 'saved region list');
    assert.equal(state.news.title, '전북특별자치도 지역뉴스');
    assert.equal(state.news.basis, '저장 지역 기준 · 오늘 · 최신순');
    assert.deepEqual(await evaluate('globalThis.__newsRequests.at(-1)'), {region: '전주시', period: 'today', limit: '20', view: 'feed'});
    assert.ok(state.news.allow, `${testCase.label}: [위치 허용] still offered`);
    assert.equal(await evaluate('globalThis.__geolocationCalls'), geoBeforeSaved, `${testCase.label}: saved-region news never asks for the position`);
    checkList(state, 'saved');

    // 5. Location already allowed: the current location's 광역시·도 list shows
    //    at once and [위치 허용] is not shown. With location use off in LOTBI
    //    settings the position is not even asked for and no button shows.
    await evaluate(`globalThis.__permission = 'granted', true`);
    await openNews();
    state = await newsState(news => news.state === 'READY' && news.basis.startsWith('현재 위치'), 'current location list');
    assert.equal(state.news.title, '전북특별자치도 지역뉴스');
    assert.equal(state.news.basis, '현재 위치 기준 · 오늘 · 최신순');
    assert.equal(state.news.allow, null, `${testCase.label}: no [위치 허용] once allowed`);
    assert.equal(state.news.selected, 'current');
    const currentRequest = await evaluate('globalThis.__newsRequests.at(-1)');
    assert.deepEqual(currentRequest, {latitude: '35.813', longitude: '127.118', period: 'today', limit: '20', view: 'feed'}, `${testCase.label}: coarse coordinates only`);
    checkList(state, 'current');
    await shot('04-news-current');
    await evaluate(`document.cookie = 'lotbi_location_usage_v1=off; path=/', true`);
    const geoBeforeOff = await evaluate('globalThis.__geolocationCalls');
    await openNews();
    state = await newsState(news => news.state === 'READY' && news.basis.startsWith('저장 지역'), 'location use off');
    assert.equal(state.news.allow, null, `${testCase.label}: location use off → no [위치 허용]`);
    assert.equal(await evaluate('globalThis.__geolocationCalls'), geoBeforeOff, `${testCase.label}: location use off → no position asked`);
    await evaluate(`document.cookie = 'lotbi_location_usage_v1=; path=/; max-age=0', true`);
    await evaluate(`globalThis.__permission = 'prompt', true`);
    await evaluate(`localStorage.removeItem('lotbi.calendar.weather-region.v1'), true`);

    // 6. A news question typed in the conversation still gets the compact
    //    news cards (CORE-REGIONAL-NEWS-01).
    //    REGIONAL-INFO-BACK-NAVIGATION-01: ← steps one screen at a time —
    //    지역뉴스 → the 지역정보 list → the conversation.
    await evaluate("document.querySelector('.consumer-workspace .site-modal-close, .consumer-workspace [data-close], .site-modal-close')?.click(), true");
    await waitFor(() => evaluate("document.querySelector('.consumer-workspace')?.dataset.siteRoute === 'life' && location.hash === '#life' && Boolean(document.querySelector('.consumer-workspace .consumer-shortcuts'))"), `${testCase.label}: ← from 지역뉴스 → 지역정보`);
    await evaluate("document.querySelector('.consumer-workspace .site-modal-close')?.click(), true");
    await waitFor(() => evaluate("!document.querySelector('.consumer-workspace') && location.hash === ''"), `${testCase.label}: ← from 지역정보 → the conversation`);
    await evaluate(`(() => { const p = document.getElementById('lotbi-prompt'); p.value = '군산 뉴스 알려 줘'; p.dispatchEvent(new Event('input', {bubbles: true})); document.querySelector('.send-button').click(); return true; })()`);
    const typedSent = await waitFor(async () => { const sent = await evaluate('globalThis.__sent.slice()'); return sent.length > sentBefore ? sent.at(-1) : null; }, `${testCase.label}: typed news question sent`);
    assert.equal(typedSent.text, '군산 뉴스 알려 줘');
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
    await shot('05-news-cards');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await tap(await reveal('.lotbi-news-related-toggle'));
      state = await probe();
      if (state.cards[0].relatedOpen) break;
    }
    assert.equal(state.cards[0].relatedOpen, true, `${testCase.label}: 관련 보도 opens on tap`);
    assert.deepEqual(state.cards[0].relatedLinks, ['https://www.jbnews.com/news/articleView.html?idxno=1', 'https://www.jjan.kr/article/2']);
    assert.ok(state.pageOverflowX <= 0, `${testCase.label}: related list fits`);
    await shot('06-related-open');
    if (testCase.theme === 'dark') {
      assert.equal(state.theme, 'dark');
      const contrast = Math.abs(luminance(state.cards[0].titleColor) - luminance(state.pageBackground));
      assert.ok(contrast > 0.4, `${testCase.label}: card text readable on the dark page (${state.cards[0].titleColor} on ${state.pageBackground})`);
    }


    // 7. Desktop: ten categories (병원·응급실, 약국, 전기차 충전소 … 지역생활정보, 내 아이 학교·유치원)
    //    fill every row of two — no empty cell. With an odd count the last card
    //    takes its whole row and the row before it is full.
    if (!testCase.mobile) {
      await openLife();
      state = await probe();
      const first = state.shortcuts[0].box;
      const last = state.shortcuts.at(-1).box;
      const beforeLast = state.shortcuts.at(-2).box;
      const pair = state.shortcuts.at(-3).box;
      const rowRight = Math.max(...state.shortcuts.slice(0, -1).map(item => item.box.right));
      assert.equal(state.shortcuts.length, 10);
      assert.equal(state.shortcuts.at(-1).id, 'my-child');
      if (state.shortcuts.length % 2 === 0) {
        assert.ok(Math.abs(last.w - first.w) <= 1, `${testCase.label}: last card keeps the column width (${Math.round(last.w)} vs ${Math.round(first.w)})`);
        assert.ok(Math.abs(last.y - beforeLast.y) <= 1 && last.x > beforeLast.right - 1, `${testCase.label}: the last row holds two cards (no empty cell)`);
      } else {
        assert.ok(Math.abs(last.x - first.x) <= 1 && Math.abs(last.right - rowRight) <= 1 && last.y > beforeLast.bottom - 1, `${testCase.label}: the odd last card takes its whole row (${Math.round(last.x)}..${Math.round(last.right)} vs ${Math.round(first.x)}..${Math.round(rowRight)})`);
        assert.ok(Math.abs(beforeLast.y - pair.y) <= 1 && beforeLast.x > pair.right - 1 && Math.abs(beforeLast.w - first.w) <= 1, `${testCase.label}: the row before it holds two column-wide cards (no empty cell)`);
      }
      await shot('07-full-rows');
    }
    return {list: 'OK', cards: state.cards?.length ?? 0};
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

console.log('REGIONAL-NEWS-P0-01 OK — 지역정보 label, 지역뉴스 screen title list (pick a 시·도 / saved region / current location, 오늘·1주일, error + 다시 시도, articles open in place) and conversation news cards (viewport emulation, not a device run)');
