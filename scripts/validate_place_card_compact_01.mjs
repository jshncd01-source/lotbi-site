// SITE-PLACE-CARD-COMPACT-01
//
// 대표님이 lotbiai.com 에서 "전주 맛집 추천해줘" 를 보내 나온 맛집 카드를 보시고
// 직접 지시하신 것 중 화면에 해당하는 네 가지를 봉인한다.
//
//  1. 카드 한 장이 너무 크다 — 적당히 줄이고, 옆에 다음 가게가 있다는 것이
//     눈에 들어오게 한다.
//  2. 지도 썸네일과 그 옆 "위치" 글자를 지운다 — 주소가 이미 있고 네이버지도
//     버튼도 있어 같은 말을 세 번 한다.
//  3. "네이버지도"·"전화" 글자를 지우고 아이콘만 둔다.
//  4. 인허가 문구 다섯 개를 같은 길이감으로 줄인다.
//
// 이 파일이 소스 정규식이 아니라 실제 브라우저인 이유가 둘 있다.
//
// 첫째, 줄였다는 것은 숫자다. 소스에 적힌 height 값이 아니라 렌더된 카드의
// 높이·너비를 재야 줄었다고 말할 수 있다.
//
// 둘째, 줄이기 전 카드는 레일보다 52~62px 높아서 아래쪽 동작 버튼이 잘려
// 있었다(overflow: hidden). 소스만 봐서는 보이지 않는 결함이라, 카드가 레일
// 안에 다 들어오는지를 여기서 실제로 잰다.
//
// 글자를 지워도 이름은 남는다: 화면 낭독기 사용자에게 aria-label 과 title 은
// 그대로 있어야 하고, 아이콘만 남아도 터치 영역은 44x44 를 지켜야 한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.placecard-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.placecard-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4213;
const ORIGIN = 'http://127.0.0.1:' + PORT;

// What the card must fit inside, per viewport. These are the rail heights the
// stylesheet declares; the card is measured against them below.
const CASES = [
  {label: 'iPhone 390x844', width: 390, height: 844},
  {label: 'desktop 1280', width: 1280, height: 900},
];

// 줄이기 전 값(origin/main, 같은 방법으로 실측). 이 아래로 내려와야 '줄였다'.
const BEFORE = {
  'iPhone 390x844': {cardWidth: 256, cardHeight: 403.5, railHeight: 342},
  'desktop 1280': {cardWidth: 256.1, cardHeight: 403.6, railHeight: 352},
};

const LICENSE_COPY = {
  VERIFIED: '인허가 대조 확인',
  AMBIGUOUS: '인허가 후보 여럿',
  CONFLICTING: '인허가 정보 불일치',
  NOT_FOUND: '인허가 대조 안 됨',
  UNAVAILABLE: '인허가 대조 불가',
};
// UNAVAILABLE 은 대조 결과가 아니라 대조가 아예 못 돈 상태다. 문구는 그대로
// 두되 카드에는 그리지 않는다.
const LICENSE_RENDERED_STATES = ['VERIFIED', 'AMBIGUOUS', 'CONFLICTING', 'NOT_FOUND'];
const LICENSE_LAG_NOTE = '공공데이터 갱신이 늦을 수 있어요';
const LICENSE_LAG_NOTE_STATES = new Set(['NOT_FOUND', 'CONFLICTING']);

// ── the deleted markup must be gone from the source, not commented out ────
const conversationSource = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const conversationStyles = fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');
const navigationSource = fs.readFileSync(path.join(ROOT, 'site-navigation.js'), 'utf8');

for (const token of [
  'lotbi-place-location-support', 'lotbi-place-location-thumbnail',
  'lotbi-place-action-label', 'buildNaverStaticMapThumbnailUrl',
]) {
  assert.ok(
    !conversationSource.includes(token),
    `site-conversation.js still carries "${token}" — the thumbnail and the action words were to be deleted, not hidden`,
  );
  assert.ok(
    !conversationStyles.includes(token),
    `site-conversation.css still carries a rule for "${token}", whose markup no longer exists`,
  );
}
// The URL builder that only ever fed the thumbnail dies with it.
assert.ok(
  !navigationSource.includes('buildNaverStaticMapThumbnailUrl')
  && !navigationSource.includes('static-place-thumbnail'),
  'site-navigation.js must not keep the static map thumbnail builder once its only caller is gone',
);

// ── the five 인허가 lines are fixed, and stay a set ───────────────────────
// 다섯 문구는 바꾸지 않는다. 상태 이름에 묶어 읽으므로 한 줄을 다른 상태에
// 붙여 놓는 실수도 여기서 걸린다.
const lengths = [];
for (const [state, copy] of Object.entries(LICENSE_COPY)) {
  assert.match(
    conversationSource,
    new RegExp(`${state}:\\s*'${copy}'`, 'u'),
    `${state} 인허가 문구가 '${copy}' 가 아닙니다 — 이 다섯은 바꾸지 않습니다`,
  );
  lengths.push(copy.length);
}
assert.ok(
  Math.max(...lengths) - Math.min(...lengths) <= 3,
  `인허가 문구 다섯 개의 길이가 고르지 않습니다: ${JSON.stringify(LICENSE_COPY)}`,
);
// NOT_FOUND 는 "이 가게가 무허가다" 가 아니라 "우리가 공공 데이터에서 이 가게를
// 못 찾았다" 는 뜻이다. 주어가 가게 쪽으로 넘어가면 조회 실패가 고발이 된다.
for (const copy of [...Object.values(LICENSE_COPY), LICENSE_LAG_NOTE]) {
  assert.doesNotMatch(
    copy,
    /인허가 기록 없음|무허가|허가 없음|미허가|불법 영업/u,
    `가게를 무허가로 읽히게 씌어 있습니다: ${copy}`,
  );
}

// ── 공공데이터 시차 문구 ──────────────────────────────────────────────────
// 공공 인허가 데이터는 제 일정대로 갱신된다. 멀쩡한 가게가 아직 대조되지 않을
// 수 있다는 사실만 적고, 주어는 데이터에 둔다.
assert.ok(conversationSource.includes(`'${LICENSE_LAG_NOTE}'`), '공공데이터 시차 문구가 없습니다');
assert.match(LICENSE_LAG_NOTE, /^공공데이터/u, '시차 문구의 주어는 공공데이터여야 합니다');
assert.doesNotMatch(
  LICENSE_LAG_NOTE,
  /가게|업소|업체|의심|주의|확인 필요|위험/u,
  '시차 문구가 업소를 의심하게 만듭니다',
);

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The captured shape of a real production answer: five NAVER restaurants, no
// photo, no phone, and four of the five 인허가 states between them. Nothing is
// invented — no rating, no hours, no number.
const PLACES = [
  // Worst case first, so the rail centres it: a name that wraps to the 2-line
  // clamp, an address that wraps to its own 2-line clamp, and the longest
  // category the provider emits.
  {name: '진원소우 전주신시가지점 한옥마을 본점', category: '음식점>한식>육류,고기요리>소고기구이',
    address: '전북특별자치도 전주시 완산구 효자동3가 1536-8 3층 남노송동 상가',
    road: '전북특별자치도 전주시 완산구 홍산중앙로 26 3층 남노송동 상가',
    lat: 35.8159596, lon: 127.1093458, license: {state: 'NOT_FOUND'}},
  {name: '호시마츠생라멘', category: '음식점>일식>일본식라면',
    address: '전북특별자치도 전주시 완산구 고사동 473-9',
    road: '전북특별자치도 전주시 완산구 전주객사2길 46-12',
    lat: 35.8189944, lon: 127.1412996,
    license: {state: 'VERIFIED', administrative_status: '영업/정상'}},
  {name: '봉동당', category: '카페,디저트>베이커리',
    address: '전북특별자치도 전주시 덕진구 송천동2가 1329-1 4층 CGV영화관 로비',
    road: '전북특별자치도 전주시 덕진구 세병2길 10 4층 CGV영화관 로비',
    lat: 35.8730827, lon: 127.1245697, license: {state: 'AMBIGUOUS'}},
  {name: '진원소우 전주신시가지점', category: '음식점>한식>육류,고기요리>소고기구이',
    address: '전북특별자치도 전주시 완산구 효자동3가 1536-8 3층',
    road: '전북특별자치도 전주시 완산구 홍산중앙로 26 3층',
    lat: 35.8159596, lon: 127.1093458, license: {state: 'CONFLICTING'}},
  // 대조가 아예 못 돈 카드. 배지가 한 장도 나오면 안 된다.
  {name: '자매갈비전골', category: '한식>육류,고기요리',
    address: '전북특별자치도 전주시 완산구 남노송동 536-1 자매갈비전골',
    road: '전북특별자치도 전주시 완산구 기린대로 121 자매갈비전골',
    lat: 35.8198479, lon: 127.1534529, license: {state: 'UNAVAILABLE'}},
];

const UNAVAILABLE_PLACE_NAME = PLACES.find(place => place.license.state === 'UNAVAILABLE').name;

const placeResult = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0c0a0d0e0f0102030405',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '전주 맛집',
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
    navigation_capability: true,
    food_license_verification: {source: 'MOIS_FOOD_LICENSE', ai_calls: 0, ...place.license},
  })),
};

// The fixture is index.html itself, with only the conversation runtime import
// swapped for one that stubs the two guest Core calls first. Rebuilding the
// Home markup by hand here would drift away from the page under test.
function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a cache-busted module');
  // The fixture is served from /scripts/, and index.html's asset hrefs are
  // relative. Without this the stylesheets 404 and the card is measured
  // unstyled — which reads as a pass on "줄었다" for the wrong reason.
  assert.ok(/<head>/u.test(html), 'index.html must have a <head> to anchor the fixture base URL');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PLACE_RESULT = ${JSON.stringify(placeResult)};
const UNAVAILABLE_PLACE_NAME = ${JSON.stringify(UNAVAILABLE_PLACE_NAME)};
const out = document.getElementById('placecard-result');
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
        assistant_text: '전주 맛집 다섯 곳입니다. 평점·영업시간·전화번호는 이번 결과에 없어 확인되지 않아요.',
        response_mode: 'PLACE_PROVIDER_READONLY',
        correlation_id: 'req_placecardcompact01',
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
  const conversation = await import('/site-conversation.js?v=placecardcompact1');
  if (!conversation.mountConversation()) throw new Error('conversation mount');
  const wait = async (fn, label) => {
    for (let i = 0; i < 500; i += 1) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 25)); }
    throw new Error('timeout ' + label);
  };
  const field = document.getElementById('lotbi-prompt');
  field.value = '전주 맛집 추천해줘';
  field.dispatchEvent(new Event('input', {bubbles: true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  const rail = await wait(() => document.querySelector('.lotbi-place-orbit'), 'place rail');
  const center = await wait(() => rail.querySelector('.lotbi-place-orbit-card[data-orbit-slot="CENTER"]'), 'center card');
  await new Promise(r => setTimeout(r, 500));

  const round = value => Math.round(value * 10) / 10;
  const box = node => { const r = node.getBoundingClientRect(); return {x: round(r.left), w: round(r.width), h: round(r.height)}; };
  const railBox = rail.getBoundingClientRect();
  const centerBox = center.getBoundingClientRect();
  out.textContent = JSON.stringify({
    ok: true,
    viewport: {width: innerWidth, height: innerHeight},
    rail: box(rail),
    centerCard: box(center),
    // Every card, not just the centred one: the card that overflows is not
    // always the one on top.
    tallestCardPx: Math.max(...[...rail.querySelectorAll('.lotbi-place-orbit-card')].map(n => round(n.offsetHeight))),
    // How much of the next store sits beside the centre card and inside the
    // rail. This is the number 대표님 asked to see move.
    neighbourStripPx: round((railBox.width - centerBox.width) / 2),
    actions: [...center.querySelectorAll('.lotbi-rich-card-action')].map(node => ({
      action: node.dataset.action || '',
      ...box(node),
      visibleText: (node.textContent || '').trim(),
      aria: node.getAttribute('aria-label') || '',
      title: node.getAttribute('title') || '',
      tag: node.tagName,
      phoneState: node.dataset.phoneState || '',
      disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
    })),
    licenseTexts: [...rail.querySelectorAll('.lotbi-place-license-evidence')].map(n => (n.textContent || '').trim()),
    licenseTitles: [...rail.querySelectorAll('.lotbi-place-license-evidence')].map(n => n.getAttribute('title') || ''),
    statusBadges: [...rail.querySelectorAll('.lotbi-place-license-status')].map(n => (n.textContent || '').trim()),
    lagNotes: [...rail.querySelectorAll('.lotbi-place-license-note')].map(n => (n.textContent || '').trim()),
    // 배지가 둘일 때 같은 줄 묶음 안에 들어가는지. 줄의 배치는 가운데 카드에서
    // 읽는다 — 사이드 카드의 줄은 숨김 목록 때문에 display:none 이 맞다.
    badgeRowCounts: [...rail.querySelectorAll('.lotbi-place-badges')].map(row => row.children.length),
    centerBadgeRow: (() => {
      const row = center.querySelector('.lotbi-place-badges');
      if (!row) return null;
      const style = getComputedStyle(row);
      return {count: row.children.length, display: style.display, wrap: style.flexWrap};
    })(),
    // 사이드 카드가 아직 칠하고 있는 것. 비어 있어야 한다.
    sidePainted: [...rail.querySelectorAll('.lotbi-place-orbit-card:not([data-orbit-slot="CENTER"])')]
      .flatMap(card => [...card.querySelectorAll('.lotbi-rich-card-price, .lotbi-place-badges, .lotbi-place-license-note, .lotbi-place-card-actions')]
        .filter(n => getComputedStyle(n).display !== 'none')
        .map(n => n.className)),
    // UNAVAILABLE 카드가 배지를 하나도 그리지 않았는지.
    unavailableCardBadges: (() => {
      const card = [...rail.querySelectorAll('.lotbi-place-orbit-card')]
        .find(n => (n.querySelector('.lotbi-rich-card-title')?.textContent || '') === UNAVAILABLE_PLACE_NAME);
      if (!card) return null;
      return card.querySelectorAll('.lotbi-place-badges, .lotbi-place-license-evidence, .lotbi-place-license-note').length;
    })(),
    hasLocationThumb: Boolean(rail.querySelector('.lotbi-place-location-thumbnail, .lotbi-place-location-support')),
    hasActionLabel: Boolean(rail.querySelector('.lotbi-place-action-label')),
    mediaState: center.querySelector('.lotbi-rich-card-media')?.dataset.mediaState || '',
    placeholderLabel: (center.querySelector('.lotbi-place-placeholder-label')?.textContent || '').trim(),
    // 모바일 입력창 16px 규칙은 이 작업이 건드리지 않는다.
    composerFontPx: parseFloat(getComputedStyle(document.getElementById('lotbi-prompt')).fontSize),
  });
} catch (e) { fail(e); }
</script>
<pre id="placecard-result">pending</pre>`;
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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('placecard-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},70000);
  <\/script></body></html>`;
}

function run(browser, {label, width, height}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(width, height), 'utf8');
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--ignore-certificate-errors',
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

for (const [label, reading] of Object.entries(readings)) {
  const before = BEFORE[label];
  const {rail, centerCard, actions} = reading;

  // ── 1. 줄었다 ───────────────────────────────────────────────────────────
  assert.ok(
    centerCard.h < before.cardHeight,
    `${label}: 카드 높이가 ${centerCard.h}px 로, 줄이기 전 ${before.cardHeight}px 보다 작지 않습니다`,
  );
  assert.ok(
    centerCard.w < before.cardWidth,
    `${label}: 카드 너비가 ${centerCard.w}px 로, 줄이기 전 ${before.cardWidth}px 보다 작지 않습니다`,
  );
  assert.ok(
    rail.h < before.railHeight,
    `${label}: 레일 높이가 ${rail.h}px 로, 줄이기 전 ${before.railHeight}px 보다 작지 않습니다`,
  );

  // ── 2. 카드가 레일 안에 다 들어온다 ────────────────────────────────────
  // 줄이기 전에는 여기서 52~62px 이 잘려 동작 버튼이 반쯤 사라져 있었다.
  assert.ok(
    centerCard.h <= rail.h,
    `${label}: 카드 ${centerCard.h}px 가 레일 ${rail.h}px 를 넘어, 아래쪽 ${(centerCard.h - rail.h).toFixed(1)}px 가 잘립니다`,
  );
  // 운영에서 두 줄짜리 상호명 카드가 301.5px 로 300px 레일을 1.5px 넘고 있었다.
  // 가운데 카드만 재면 그것을 놓친다.
  assert.ok(
    reading.tallestCardPx <= rail.h,
    `${label}: 가장 높은 카드 ${reading.tallestCardPx}px 가 레일 ${rail.h}px 를 넘어 ${(reading.tallestCardPx - rail.h).toFixed(1)}px 가 잘립니다`,
  );

  // ── 3. 옆 가게가 눈에 들어온다 ─────────────────────────────────────────
  assert.ok(
    reading.neighbourStripPx > (before.railHeight === 342 ? 18 : 209),
    `${label}: 가운데 카드 옆에 남는 폭이 ${reading.neighbourStripPx}px 뿐이라 다음 가게가 보이지 않습니다`,
  );

  // ── 4. 글자는 없고 이름과 터치 영역은 남는다 ───────────────────────────
  // 대표님 지시로 길찾기 손잡이가 셋이 되었습니다 — 네이버 옆에 카카오맵과
  // 티맵. 전화까지 넷이고, 넷 모두 44x44 를 지킨 채 카드 안에 들어와야 합니다.
  assert.equal(actions.length, 4, `${label}: 동작 버튼은 전화·네이버지도·카카오맵·티맵 넷입니다`);
  const byAction = Object.fromEntries(actions.map(a => [a.action, a]));
  for (const name of ['phone', 'naver-map', 'kakao-map', 'tmap']) {
    const button = byAction[name];
    assert.ok(button, `${label}: ${name} 버튼이 없습니다`);
    assert.equal(button.visibleText, '', `${label}: ${name} 버튼에 아직 글자가 보입니다 — "${button.visibleText}"`);
    assert.ok(button.aria.includes(PLACES[0].name), `${label}: ${name} 버튼의 aria-label 에 가게 이름이 없습니다`);
    assert.ok(button.title, `${label}: ${name} 버튼의 title 이 비었습니다`);
    assert.ok(
      button.w >= 44 && button.h >= 44,
      `${label}: ${name} 버튼이 ${button.w}x${button.h}px 로 터치 영역 44x44 에 못 미칩니다`,
    );
  }
  // 번호가 오지 않은 카드의 전화 버튼은 꺼져 있어야 한다 — 꺼진 것이 고장이
  // 아니라 "번호를 확인하지 못했다" 는 정직한 표시다. 이 고정 데이터에는
  // 번호가 없으므로 꺼져 있는 것이 맞다.
  assert.equal(byAction.phone.phoneState, 'UNAVAILABLE', `${label}: 번호 없는 카드의 전화 버튼 상태가 틀렸습니다`);
  assert.equal(byAction.phone.disabled, true, `${label}: 번호 없는 전화 버튼이 눌리면 안 됩니다`);
  assert.equal(byAction.phone.tag, 'BUTTON', `${label}: 번호 없는 전화는 링크가 아니라 꺼진 버튼입니다`);
  assert.equal(byAction['naver-map'].tag, 'A', `${label}: 네이버지도는 링크여야 합니다`);
  assert.equal(byAction['kakao-map'].tag, 'A', `${label}: 카카오맵은 링크여야 합니다`);
  // 이 검사는 데스크톱 Chromium 의 UA 로 돕니다. 티맵은 열어 줄 웹 화면이 없어
  // 그 자리에서는 꺼진 버튼이 맞습니다. 휴대폰 UA 에서 링크가 되는지는
  // validate_place_card_map_deeplinks_01.mjs 가 봅니다.
  assert.equal(byAction.tmap.tag, 'BUTTON', `${label}: 데스크톱 UA 에서 티맵은 꺼진 버튼이어야 합니다`);
  assert.equal(byAction.tmap.disabled, true, `${label}: 데스크톱 UA 의 티맵 버튼이 눌리면 안 됩니다`);

  // 넷이 되면서 줄이 넘치는지. 버튼 줄은 접히지 않으므로 넘치면 그대로 잘립니다.
  const actionsRight = Math.max(...actions.map(a => a.x + a.w));
  const actionsLeft = Math.min(...actions.map(a => a.x));
  assert.ok(
    actionsLeft >= centerCard.x - 0.5 && actionsRight <= centerCard.x + centerCard.w + 0.5,
    `${label}: 버튼 넷이 카드 밖으로 나갑니다 — 카드 ${centerCard.x}~${(centerCard.x + centerCard.w).toFixed(1)}, 버튼 ${actionsLeft}~${actionsRight.toFixed(1)}`,
  );

  // ── 5. 지도 썸네일과 "위치" 는 화면에도 없다 ───────────────────────────
  assert.equal(reading.hasLocationThumb, false, `${label}: 지도 썸네일이 아직 카드에 있습니다`);
  assert.equal(reading.hasActionLabel, false, `${label}: 동작 버튼 글자가 아직 카드에 있습니다`);

  // ── 6. 인허가 다섯 갈래가 화면에 그대로 나온다 ─────────────────────────
  // 다섯 장 중 UNAVAILABLE 한 장은 배지를 그리지 않으므로 네 개가 맞다.
  // 고정 데이터에 적힌 순서 그대로, UNAVAILABLE 한 장만 빠진 채 나와야 한다.
  assert.deepEqual(
    reading.licenseTexts,
    PLACES.map(place => place.license.state)
      .filter(state => LICENSE_RENDERED_STATES.includes(state))
      .map(state => LICENSE_COPY[state]),
    `${label}: 인허가 배지가 기대와 다릅니다`,
  );
  assert.equal(
    reading.unavailableCardBadges,
    0,
    `${label}: UNAVAILABLE 카드가 아직 배지를 그립니다 — 대조가 안 돈 것은 결과가 아닙니다`,
  );
  // 행정상 상태는 대조 결과와 다른 사실이므로 같은 문장에 구분자로 붙이지 않고
  // 제 배지를 가집니다.
  assert.deepEqual(reading.statusBadges, ['영업/정상'], `${label}: 행정상 상태 배지가 기대와 다릅니다`);
  for (const text of reading.licenseTexts) {
    assert.doesNotMatch(text, / · /u, `${label}: 배지 둘을 구분자로 한 줄에 붙여 놓았습니다 — "${text}"`);
  }
  assert.ok(
    reading.badgeRowCounts.some(count => count > 1),
    `${label}: 배지가 둘인 줄이 없습니다 — 행정상 상태가 제 배지를 갖지 못했습니다`,
  );
  assert.ok(reading.centerBadgeRow, `${label}: 가운데 카드에 배지 줄이 없습니다`);
  assert.equal(reading.centerBadgeRow.display, 'flex', `${label}: 배지 줄이 flex 가 아닙니다`);
  assert.equal(reading.centerBadgeRow.wrap, 'wrap', `${label}: 배지 줄이 넘칠 때 접히지 않습니다`);

  // 공공데이터 시차 문구는 읽는 사람이 배지를 가게에 대한 판정으로 오해할 수
  // 있는 두 상태에만 붙는다.
  assert.deepEqual(
    reading.lagNotes,
    PLACES.map(place => place.license.state)
      .filter(state => LICENSE_LAG_NOTE_STATES.has(state))
      .map(() => LICENSE_LAG_NOTE),
    `${label}: 공공데이터 시차 문구가 기대와 다릅니다`,
  );
  // 짧은 배지가 무슨 뜻인지는 높이를 쓰지 않고도 닿아야 한다.
  for (const title of reading.licenseTitles) {
    assert.ok(title, `${label}: 인허가 배지에 설명이 붙어 있지 않습니다`);
  }

  // 사이드 카드는 가운데 카드가 감추는 것을 똑같이 감춰야 한다. 인허가 배지가
  // 목록에서 빠져 있어 옆 카드에서 글자만 비어져 나오고 있었다.
  assert.deepEqual(
    reading.sidePainted,
    [],
    `${label}: 사이드 카드가 아직 칠하고 있습니다 — ${reading.sidePainted.join(', ')}`,
  );

  // ── 7. 사진이 없으면 없다고만 한다 ─────────────────────────────────────
  // 가짜·추정 사진을 채우는 것은 금지. 없을 때의 정답은 중립 자리표시다.
  assert.equal(reading.mediaState, 'placeholder', `${label}: 사진이 없는 카드의 미디어 상태가 틀렸습니다`);
  assert.equal(reading.placeholderLabel, '사진 정보 없음', `${label}: 사진 없음 표시가 바뀌었습니다`);

  // ── 8. 모바일 입력창 16px 은 이 작업이 건드리지 않는다 ─────────────────
  if (reading.viewport.width <= 900) {
    assert.ok(
      reading.composerFontPx >= 16,
      `${label}: 입력창 글자가 ${reading.composerFontPx}px 로 내려가 iOS Safari 가 화면을 확대합니다`,
    );
  }
}

for (const [label, reading] of Object.entries(readings)) {
  const before = BEFORE[label];
  console.log(
    `  ${label}: 카드 ${before.cardWidth}x${before.cardHeight} -> ${reading.centerCard.w}x${reading.centerCard.h}`
    + ` · 레일 높이 ${before.railHeight} -> ${reading.rail.h}`
    + ` · 옆 가게 노출폭 ${reading.neighbourStripPx}px`,
  );
}
console.log('PLACE CARD COMPACT + thumbnail/label removal + 인허가 문구 축약 contract: PASS');
