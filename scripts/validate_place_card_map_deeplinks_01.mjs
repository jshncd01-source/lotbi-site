// SITE-PLACE-CARD-MAP-DEEPLINK-01
//
// 대표님 지시: 대화창 장소 카드의 길찾기를 딥링크 3종으로 넓힌다. 네이버 옆에
// 카카오맵과 티맵을 붙이고, 앱이 있으면 앱으로, 없으면 웹으로 떨어뜨린다.
// 새 API 키도 과금도 없다 — URL scheme 과 Android intent 뿐이다.
//
// 이 파일이 지키는 것은 네 가지다.
//
//  1. NAVER 가 이 카드의 primary identity 로 남는다. 카카오·티맵은 같은 장소를
//     다른 앱에서 여는 손잡이일 뿐, 장소를 다시 고르지 않는다.
//  2. 좌표는 navigation_capability 가 참일 때만 쓴다. 네이버 버튼이 이미 지키는
//     규칙이고, 확인되지 않은 좌표로 길안내를 걸어 엉뚱한 곳에 보내는 것이
//     이 작업의 최악의 실패다. 확인이 안 되면 이름으로 검색시킨다.
//  3. 티맵은 x 가 경도, y 가 위도다. 뒤집으면 서해 한가운데로 간다. 그래서 이
//     파일은 두 값이 서로 다른 좌표를 써서 순서를 직접 못 박는다.
//  4. 버튼이 넷이 되어도 44x44 터치 타깃과 카드 폭을 깨지 않는다. 소스가 아니라
//     실제 브라우저에서 412px·390px·360px 로 잰다.
//
// 티맵에는 장소를 여는 웹 화면이 없다. 데스크톱에서는 열어 줄 대상이 없으므로
// 링크가 아니라 꺼진 버튼이어야 한다 — 눌러도 아무 일이 없는 버튼이 제일 나쁘다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.mapdeeplink-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.mapdeeplink-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4219;
const ORIGIN = 'http://127.0.0.1:' + PORT;

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// 대표님이 412px 에서 직접 재라고 하신 폭. 360px 은 카드가 가장 좁아지는
// 지점이라 넷이 넘치면 여기서 먼저 넘친다.
const CASES = [
  {label: 'Android 412x915', width: 412, height: 915, userAgent: ANDROID_UA, mobile: true},
  {label: 'iPhone 390x844', width: 390, height: 844, userAgent: IPHONE_UA, mobile: true},
  {label: 'Android 360x800', width: 360, height: 800, userAgent: ANDROID_UA, mobile: true},
  {label: 'desktop 1280', width: 1280, height: 900, userAgent: DESKTOP_UA, mobile: false},
];

const ACTION_ORDER = ['phone', 'naver-map', 'kakao-map', 'tmap'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. 모듈 — 딥링크 문자열 자체
// ─────────────────────────────────────────────────────────────────────────────
const nav = await import('../site-navigation.js');
const navSource = fs.readFileSync(path.join(ROOT, 'site-navigation.js'), 'utf8');
const conversationSource = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const conversationStyles = fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');

// 위도와 경도를 일부러 다른 값으로 둔다. 같은 값이면 순서를 뒤집어도 검사가
// 통과해 버린다.
const CONFIRMED = {
  name: '선유도 리조트',
  address: '전북특별자치도 군산시 옥도면 선유북길 30',
  latitude: 35.8012345,
  longitude: 126.4567891,
  navigationCapable: true,
};
const UNCONFIRMED = {...CONFIRMED, navigationCapable: false};

// ── 카카오맵 ────────────────────────────────────────────────────────────────
assert.equal(
  nav.buildKakaoMapMobileUri(CONFIRMED),
  'kakaomap://route?ep=35.8012345,126.4567891&by=CAR',
  '카카오맵 길찾기는 ep=위도,경도 와 by=CAR 입니다',
);
const kakaoSearch = nav.buildKakaoMapMobileUri(UNCONFIRMED);
assert.match(kakaoSearch, /^kakaomap:\/\/search\?q=/u, '좌표가 확인 안 되면 카카오맵도 검색으로 갑니다');
assert.doesNotMatch(kakaoSearch, /35\.80|126\.45/u, '확인 안 된 좌표는 카카오맵에 넘기지 않습니다');
assert.ok(
  decodeURIComponent(kakaoSearch.slice('kakaomap://search?q='.length)).startsWith(CONFIRMED.name),
  '카카오맵 검색어는 가게 이름으로 시작합니다',
);

const kakaoWeb = nav.buildKakaoMapWebSearchUrl(CONFIRMED);
assert.match(kakaoWeb, /^https:\/\/map\.kakao\.com\/\?q=/u, '카카오맵 웹 폴백은 https 카카오맵 검색입니다');

const kakaoIntent = nav.buildKakaoMapAndroidIntentUri(CONFIRMED);
assert.match(kakaoIntent, /^intent:\/\/route\?ep=35\.8012345,126\.4567891&by=CAR#Intent;/u);
assert.match(kakaoIntent, /;scheme=kakaomap;/u);
assert.match(kakaoIntent, /;package=net\.daum\.android\.map;/u, '카카오맵 Android 패키지는 net.daum.android.map 입니다');
assert.match(kakaoIntent, /;S\.browser_fallback_url=https%3A%2F%2Fmap\.kakao\.com%2F%3Fq%3D[^;]+;end$/u);
assert.equal(
  decodeURIComponent(kakaoIntent.match(/S\.browser_fallback_url=([^;]+);end$/u)[1]),
  kakaoWeb,
  'Android 폴백은 카카오맵 웹 검색과 같은 주소여야 합니다',
);

// ── 티맵 ────────────────────────────────────────────────────────────────────
const tmapRoute = nav.buildTmapMobileUri(CONFIRMED);
assert.match(tmapRoute, /^tmap:\/\/route\?/u);
// 여기가 이 파일의 핵심이다. x 는 경도, y 는 위도.
assert.match(tmapRoute, /goalx=126\.4567891/u, '티맵 goalx 는 경도입니다');
assert.match(tmapRoute, /goaly=35\.8012345/u, '티맵 goaly 는 위도입니다');
assert.equal(
  decodeURIComponent(tmapRoute.match(/goalname=([^&]+)/u)[1]),
  CONFIRMED.name,
  '티맵 목적지 이름은 네이버가 확정한 상호 그대로입니다',
);

const tmapSearch = nav.buildTmapMobileUri(UNCONFIRMED);
assert.match(tmapSearch, /^tmap:\/\/search\?name=/u, '좌표가 확인 안 되면 티맵도 검색으로 갑니다');
assert.doesNotMatch(tmapSearch, /goalx|goaly|35\.80|126\.45/u, '확인 안 된 좌표는 티맵에 넘기지 않습니다');

const tmapIntent = nav.buildTmapAndroidIntentUri(CONFIRMED);
assert.match(tmapIntent, /^intent:\/\/route\?/u);
assert.match(tmapIntent, /;scheme=tmap;/u);
assert.match(tmapIntent, /;package=com\.skt\.tmap\.ku;/u, '티맵 Android 패키지는 com.skt.tmap.ku 입니다');
assert.equal(
  decodeURIComponent(tmapIntent.match(/S\.browser_fallback_url=([^;]+);end$/u)[1]),
  'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
  '티맵에는 장소를 여는 웹 화면이 없어 설치 안내가 유일한 폴백입니다',
);

// ── 어느 화면에서 열리는가 ──────────────────────────────────────────────────
assert.equal(nav.isTmapHandoffAvailable({userAgent: ANDROID_UA}), true);
assert.equal(nav.isTmapHandoffAvailable({userAgent: IPHONE_UA}), true);
assert.equal(nav.isTmapHandoffAvailable({userAgent: DESKTOP_UA}), false, '데스크톱에는 티맵이 없습니다');

function fakeWindow() {
  const calls = [];
  return {
    calls,
    windowRef: {
      location: {set href(value) { calls.push(value); }, get href() { return calls.at(-1) || ''; }},
      setTimeout: () => null,
      clearTimeout: () => {},
      addEventListener: () => {},
      open: () => null,
    },
    documentRef: {addEventListener: () => {}, visibilityState: 'visible'},
  };
}

{
  const {calls, windowRef, documentRef} = fakeWindow();
  const opened = nav.openKakaoMapPlace(CONFIRMED, {windowRef, documentRef, userAgent: ANDROID_UA});
  assert.equal(opened.mode, 'KAKAO_ROUTE_INTENT');
  assert.equal(calls.at(-1), kakaoIntent, 'Android 카카오맵은 intent 로 넘깁니다');
}
{
  const {calls, windowRef, documentRef} = fakeWindow();
  const opened = nav.openKakaoMapPlace(CONFIRMED, {windowRef, documentRef, userAgent: IPHONE_UA});
  assert.equal(opened.mode, 'KAKAO_ROUTE_URL_SCHEME');
  assert.equal(calls.at(-1), 'kakaomap://route?ep=35.8012345,126.4567891&by=CAR');
  assert.equal(opened.fallbackUri, kakaoWeb, 'iOS 는 앱이 없으면 카카오맵 웹으로 떨어집니다');
}
{
  const {windowRef, documentRef} = fakeWindow();
  const opened = nav.openKakaoMapPlace(CONFIRMED, {windowRef, documentRef, userAgent: DESKTOP_UA});
  assert.equal(opened.mode, 'KAKAO_WEB_SEARCH');
  assert.equal(opened.uri, kakaoWeb);
}
{
  const {calls, windowRef, documentRef} = fakeWindow();
  const opened = nav.openTmapPlace(CONFIRMED, {windowRef, documentRef, userAgent: ANDROID_UA});
  assert.equal(opened.mode, 'TMAP_ROUTE_INTENT');
  assert.equal(calls.at(-1), tmapIntent);
}
{
  const {calls, windowRef, documentRef} = fakeWindow();
  const opened = nav.openTmapPlace(CONFIRMED, {windowRef, documentRef, userAgent: IPHONE_UA});
  assert.equal(opened.mode, 'TMAP_ROUTE_URL_SCHEME');
  assert.equal(calls.at(-1), tmapRoute);
}
{
  const {calls, windowRef, documentRef} = fakeWindow();
  const opened = nav.openTmapPlace(CONFIRMED, {windowRef, documentRef, userAgent: DESKTOP_UA});
  assert.equal(opened.opened, false);
  assert.equal(opened.mode, 'TMAP_MOBILE_ONLY');
  assert.deepEqual(calls, [], '데스크톱에서 티맵 버튼은 아무 곳으로도 보내지 않습니다');
}

// ── 하지 않기로 한 것 ───────────────────────────────────────────────────────
// 이번 작업은 딥링크다. 내비 SDK 도, 새 키도, 새 과금도 아니다.
assert.doesNotMatch(navSource, /kakao_navi|KAKAO_NAVI|apikey|api_key|client_id|appkey|javascript_key/iu);
assert.doesNotMatch(conversationSource, /kakao_navi|KAKAO_NAVI/iu);
// NAVER 가 primary identity 로 남는다.
assert.match(navSource, /const NAVER_MAPS_ANDROID_PACKAGE = 'com\.nhn\.android\.nmap'/u);
assert.match(conversationSource, /openPlaceInNaverMap\(place\)/u);

// ─────────────────────────────────────────────────────────────────────────────
// 2. 소스 — 카드가 버튼을 어떻게 다는가
// ─────────────────────────────────────────────────────────────────────────────
const rendererStart = conversationSource.indexOf('const createPlaceCardRail = placeValue => {');
const rendererEnd = conversationSource.indexOf('const normalizeConversationCalendarResult = value => {', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, '장소 카드 렌더러를 찾지 못했습니다');
const rendererSource = conversationSource.slice(rendererStart, rendererEnd);

// 세 손잡이가 같은 신선도 규칙을 씁니다.
for (const helper of ['openPlaceInNaverMap', 'openPlaceInKakaoMap', 'openPlaceInTmap']) {
  assert.match(rendererSource, new RegExp(`const ${helper} = place => \\{`, 'u'), `${helper} 가 없습니다`);
}
assert.equal(
  (rendererSource.match(/결과가 오래됐어요\. 같은 장소를 다시 검색한 뒤 열어 주세요\./gu) || []).length,
  3,
  '세 지도 버튼 모두 오래된 결과를 같은 문구로 막아야 합니다',
);
assert.match(rendererSource, /kakaoMap\.dataset\.action = 'kakao-map'/u);
assert.match(rendererSource, /tmap\.dataset\.action = 'tmap'/u);
assert.match(rendererSource, /kakaoMap\.href = buildKakaoMapWebSearchUrl\(place\)/u);
assert.match(rendererSource, /const tmapReady = isTmapHandoffAvailable\(\)/u);
assert.match(rendererSource, /tmap\.disabled = true/u);
// 아이콘은 네이버 버튼이 이미 쓰는 is-icon-fallback 표시를 그대로 씁니다.
assert.match(rendererSource, /lotbi-kakao-map-action is-icon-fallback/u);
assert.match(rendererSource, /lotbi-tmap-action is-icon-fallback/u);
// 화면 낭독기에는 이름이 남아야 합니다.
assert.match(rendererSource, /kakaoMap\.setAttribute\('aria-label', `\$\{place\.name\} 카카오맵에서 열기`\)/u);
assert.match(rendererSource, /tmap\.setAttribute\('aria-label', `\$\{place\.name\} 티맵/u);
// 사진이 없을 때의 문구는 이 작업이 건드리지 않습니다.
assert.match(rendererSource, /사진 정보 없음/u);

// 44px 타깃은 그대로, 여백만 줄였습니다.
const iconAction = conversationStyles.match(/\.lotbi-rich-card-icon-action \{[^}]*\}/s)?.[0] || '';
assert.match(iconAction, /width:\s*44px/u);
assert.match(iconAction, /height:\s*44px/u);
assert.match(iconAction, /min-width:\s*44px/u);
assert.match(iconAction, /min-height:\s*44px/u);
assert.match(conversationStyles, /\.lotbi-kakao-map-action\.is-icon-fallback::before \{[^}]*content:\s*"카"/s);
assert.match(conversationStyles, /\.lotbi-tmap-action\.is-icon-fallback::before \{[^}]*content:\s*"T"/s);

// ─────────────────────────────────────────────────────────────────────────────
// 3. 실제 브라우저 — 넷이 카드 안에 들어오는가
// ─────────────────────────────────────────────────────────────────────────────
function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// 실제 운영 답변의 모양 그대로: NAVER 장소 두 곳, 사진 없음, 번호 없음.
const PLACES = [
  {
    name: '선유도 리조트', category: '숙박>펜션',
    address: '전북특별자치도 군산시 옥도면 선유도리 산 1-1',
    road: '전북특별자치도 군산시 옥도면 선유북길 30',
    lat: 35.8012345, lon: 126.4567891, navigable: true,
  },
  {
    name: '선유도 바다펜션', category: '숙박>펜션',
    address: '전북특별자치도 군산시 옥도면 선유도리 234-5',
    road: '전북특별자치도 군산시 옥도면 선유남길 12',
    lat: 35.7998765, lon: 126.4501234, navigable: true,
  },
];

const placeResult = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0d1e2f3a4b5c6d7e8f90',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '군산 선유도 숙소',
  results: PLACES.map((place, index) => ({
    result_id: `place-${index + 1}`,
    place_id: `naver:${index}:${place.name}`,
    name: place.name,
    category: place.category,
    address: place.address,
    road_address: place.road,
    latitude: place.lat,
    longitude: place.lon,
    coordinate_system: 'WGS84',
    coordinate_authority: 'NAVER_MAPS_GEOCODING',
    phone: null,
    phone_verified: false,
    phone_evidence: null,
    image_url: null,
    photo_evidence: null,
    source: 'NAVER_LOCAL_SEARCH',
    source_truth: 'NAVER_LOCAL_SEARCH',
    navigation_capability: place.navigable,
    food_license_verification: null,
  })),
};

// 검사 대상은 index.html 그 자체다. 여기서 Home 마크업을 흉내 내면 실제
// 페이지와 어긋난 것을 재게 된다.
function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a cache-busted module');
  assert.ok(/<head>/u.test(html), 'index.html must have a <head> to anchor the fixture base URL');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PLACE_RESULT = ${JSON.stringify(placeResult)};
const out = document.getElementById('mapdeeplink-result');
const fail = e => { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 50000);
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') {
      return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
        guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    }
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      return json({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED',
        assistant_text: '군산 선유도 숙소 두 곳입니다. 사진·전화번호는 이번 결과에 없어 확인되지 않아요.',
        response_mode: 'PLACE_PROVIDER_READONLY',
        correlation_id: 'req_mapdeeplink01',
        intent: {action: 'PLACE_SEARCH', domain: 'PLACE'},
        follow_up: {required: false, action: 'PLACE_SEARCH', automatic_execution: false},
        safety: {execution_authority: false, external_side_effect: false,
          transaction_created: false, order_created: false, payment_attempted: false,
          reservation_created: false, merchant_execution_started: false},
        place_result: PLACE_RESULT, retry_safe: true});
    }
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=mapdeeplink01');
  if (!conversation.mountConversation()) throw new Error('conversation mount');
  const wait = async (fn, label) => {
    for (let i = 0; i < 500; i += 1) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 25)); }
    throw new Error('timeout ' + label);
  };
  const field = document.getElementById('lotbi-prompt');
  field.value = '군산 선유도 숙소';
  field.dispatchEvent(new Event('input', {bubbles: true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  const rail = await wait(() => document.querySelector('.lotbi-place-orbit'), 'place rail');
  const center = await wait(() => rail.querySelector('.lotbi-place-orbit-card[data-orbit-slot="CENTER"]'), 'center card');
  await new Promise(r => setTimeout(r, 500));

  const round = value => Math.round(value * 10) / 10;
  const box = node => { const r = node.getBoundingClientRect(); return {x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height)}; };
  out.textContent = JSON.stringify({
    ok: true,
    viewport: {width: innerWidth, height: innerHeight},
    userAgent: navigator.userAgent,
    rail: box(rail),
    centerCard: box(center),
    actionsRow: box(center.querySelector('.lotbi-place-card-actions')),
    actions: [...center.querySelectorAll('.lotbi-rich-card-action')].map(node => ({
      action: node.dataset.action || '',
      ...box(node),
      tag: node.tagName,
      href: node.getAttribute('href') || '',
      aria: node.getAttribute('aria-label') || '',
      title: node.getAttribute('title') || '',
      visibleText: (node.textContent || '').trim(),
      tmapState: node.dataset.tmapState || '',
      disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
      iconGlyph: getComputedStyle(node, '::before').content,
    })),
    placeholderLabel: (center.querySelector('.lotbi-place-placeholder-label')?.textContent || '').trim(),
  });
} catch (e) { fail(e); }
</script>
<pre id="mapdeeplink-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const probe = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (probe.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(width, height) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${width}" height="${height}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('mapdeeplink-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},70000);
  <\/script></body></html>`;
}

function run(browser, {label, width, height, userAgent}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(width, height), 'utf8');
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--ignore-certificate-errors',
    `--user-agent=${userAgent}`,
    '--window-size=1600,1100', '--force-device-scale-factor=1',
    '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=80000',
    '--dump-dom', ORIGIN + '/' + WRAPPER_REL,
  ], {encoding: 'utf8', timeout: 150000, maxBuffer: 16 * 1024 * 1024});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('browser ' + result.status + ' ' + result.stderr);
  const open = '<pre id="result">', close = '</pre>';
  const start = result.stdout.indexOf(open);
  const end = result.stdout.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error('result missing');
  const raw = result.stdout.slice(start + open.length, end)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const value = JSON.parse(raw);
  if (!value.ok) throw new Error(`${label}: ${value.error}`);
  return value;
}

fs.writeFileSync(INNER, buildInner(), 'utf8');
const browser = browserPath();
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const readings = {};
try {
  waitServer();
  for (const testCase of CASES) readings[testCase.label] = run(browser, testCase);
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) { try { fs.unlinkSync(file); } catch {} }
}

for (const testCase of CASES) {
  const {label, mobile} = testCase;
  const reading = readings[label];
  const {centerCard, actions, actionsRow} = reading;

  assert.deepEqual(
    actions.map(action => action.action),
    ACTION_ORDER,
    `${label}: 버튼은 전화·네이버지도·카카오맵·티맵 순서로 넷입니다`,
  );

  for (const action of actions) {
    assert.ok(
      action.w >= 44 && action.h >= 44,
      `${label}: ${action.action} 버튼이 ${action.w}x${action.h}px 로 터치 영역 44x44 에 못 미칩니다`,
    );
    assert.equal(action.visibleText, '', `${label}: ${action.action} 버튼에 글자가 보입니다 — "${action.visibleText}"`);
    assert.ok(action.aria.includes(PLACES[0].name), `${label}: ${action.action} 버튼의 aria-label 에 가게 이름이 없습니다`);
    assert.ok(action.title, `${label}: ${action.action} 버튼의 title 이 비었습니다`);
  }

  // 넷이 되어도 카드를 넘지 않는다. 버튼 줄은 접히지 않으므로 넘치면 잘린다.
  const left = Math.min(...actions.map(a => a.x));
  const right = Math.max(...actions.map(a => a.x + a.w));
  assert.ok(
    left >= centerCard.x - 0.5 && right <= centerCard.x + centerCard.w + 0.5,
    `${label}: 버튼 넷이 카드 밖으로 나갑니다 — 카드 ${centerCard.x}~${round1(centerCard.x + centerCard.w)}, 버튼 ${left}~${round1(right)}`,
  );
  // 한 줄에 그대로 있는지. 넷이 두 줄로 접히면 카드가 아래로 자란다.
  const rowTops = new Set(actions.map(action => action.y));
  assert.equal(rowTops.size, 1, `${label}: 버튼이 줄바꿈으로 ${rowTops.size} 줄이 되었습니다`);
  // 44px 버튼 + 위아래 여백(3px/6px) = 53~54px. 버튼이 둘이던 때와 같은 높이다.
  // 넷이 두 줄로 접히면 여기가 100px 을 넘어 카드가 아래로 자란다.
  assert.ok(
    actionsRow.h <= 56,
    `${label}: 버튼 줄 높이가 ${actionsRow.h}px 로 카드 치수를 밀어냅니다`,
  );

  // 아이콘은 글리프로 그린다 — 남의 로고 파일을 끌어다 쓰지 않는다.
  const byAction = Object.fromEntries(actions.map(a => [a.action, a]));
  assert.match(byAction['kakao-map'].iconGlyph, /카/u, `${label}: 카카오맵 아이콘 표시가 없습니다`);
  assert.match(byAction.tmap.iconGlyph, /T/u, `${label}: 티맵 아이콘 표시가 없습니다`);

  // 카카오맵은 어디서든 진짜 링크다 — 새 탭 열기와 주소 복사가 살아 있어야 한다.
  assert.equal(byAction['kakao-map'].tag, 'A', `${label}: 카카오맵은 링크여야 합니다`);
  assert.match(
    byAction['kakao-map'].href,
    /^https:\/\/map\.kakao\.com\/\?q=/u,
    `${label}: 카카오맵 href 가 웹 폴백 주소가 아닙니다`,
  );

  // 티맵은 앱이 있는 화면에서만 눌린다.
  if (mobile) {
    assert.equal(byAction.tmap.tag, 'A', `${label}: 휴대폰에서 티맵은 링크여야 합니다`);
    assert.equal(byAction.tmap.tmapState, 'MOBILE_APP', `${label}: 휴대폰 티맵 버튼 상태가 틀렸습니다`);
    assert.equal(byAction.tmap.disabled, false, `${label}: 휴대폰에서 티맵 버튼이 꺼져 있습니다`);
  } else {
    assert.equal(byAction.tmap.tag, 'BUTTON', `${label}: 데스크톱에서 티맵은 꺼진 버튼이어야 합니다`);
    assert.equal(byAction.tmap.tmapState, 'MOBILE_ONLY', `${label}: 데스크톱 티맵 버튼 상태가 틀렸습니다`);
    assert.equal(byAction.tmap.disabled, true, `${label}: 데스크톱 티맵 버튼이 눌리면 안 됩니다`);
  }

  // 전화·네이버 버튼의 기존 동작은 그대로입니다.
  assert.equal(byAction.phone.tag, 'BUTTON', `${label}: 번호 없는 전화는 꺼진 버튼입니다`);
  assert.equal(byAction['naver-map'].tag, 'A', `${label}: 네이버지도는 링크여야 합니다`);
  assert.match(
    byAction['naver-map'].href,
    /^https:\/\/map\.naver\.com\/p\/search\//u,
    `${label}: 네이버지도 href 가 바뀌었습니다`,
  );

  // 사진이 없는 카드는 이 작업 뒤에도 같은 문구를 답니다.
  assert.equal(reading.placeholderLabel, '사진 정보 없음', `${label}: 사진 없음 문구가 바뀌었습니다`);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

for (const testCase of CASES) {
  const reading = readings[testCase.label];
  const row = reading.actionsRow;
  const gap = round1(row.w - reading.actions.reduce((sum, action) => sum + action.w, 0));
  console.log(`  ${testCase.label}: 카드 ${reading.centerCard.w}px · 버튼 줄 ${row.w}x${row.h}px · 버튼 넷 밖 여백 합 ${gap}px`);
}

console.log('PLACE CARD 길찾기 딥링크 3종(네이버·카카오맵·티맵) contract: PASS');
