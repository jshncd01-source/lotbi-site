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
  OTHER: '인허가 대조 불가',
};

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

// ── the five 인허가 lines move together ───────────────────────────────────
const assignments = [...conversationSource.matchAll(/foodLicense\.textContent = ([^;]+);/gu)].map(m => m[1]);
assert.equal(assignments.length, 5, '인허가 문구는 다섯 갈래 그대로여야 합니다');
const lengths = [];
for (const [state, copy] of Object.entries(LICENSE_COPY)) {
  assert.ok(conversationSource.includes(`'${copy}'`), `${state} 인허가 문구가 '${copy}' 가 아닙니다`);
  lengths.push(copy.length);
}
// 하나만 줄이면 다섯 개가 따로 논다. 가장 긴 것과 가장 짧은 것의 차이를 묶는다.
assert.ok(
  Math.max(...lengths) - Math.min(...lengths) <= 3,
  `인허가 문구 다섯 개의 길이가 고르지 않습니다: ${JSON.stringify(LICENSE_COPY)}`,
);
// NOT_FOUND 는 "이 가게가 무허가다" 가 아니라 "우리가 공공 데이터에서 이 가게를
// 못 찾았다" 는 뜻이다. 주어가 가게 쪽으로 넘어가면 조회 실패가 고발이 된다.
for (const assignment of assignments) {
  assert.doesNotMatch(
    assignment,
    /인허가 기록 없음|무허가|허가 없음|미허가|불법 영업/u,
    `인허가 문구가 가게를 무허가로 읽히게 씌어 있습니다: ${assignment}`,
  );
}

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
  {name: '전주는전주 전주한옥마을 본점', category: '음식점>한식',
    address: '전북특별자치도 전주시 완산구 교동 72-2 1층, 2층',
    road: '전북특별자치도 전주시 완산구 태조로 31 1층, 2층',
    lat: 35.8142654, lon: 127.1513267, license: {state: 'NOT_FOUND'}},
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
  {name: '자매갈비전골', category: '한식>육류,고기요리',
    address: '전북특별자치도 전주시 완산구 남노송동 536-1 자매갈비전골',
    road: '전북특별자치도 전주시 완산구 기린대로 121 자매갈비전골',
    lat: 35.8198479, lon: 127.1534529, license: {state: 'UNAVAILABLE'}},
];

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
  const box = node => { const r = node.getBoundingClientRect(); return {w: round(r.width), h: round(r.height)}; };
  const railBox = rail.getBoundingClientRect();
  const centerBox = center.getBoundingClientRect();
  out.textContent = JSON.stringify({
    ok: true,
    viewport: {width: innerWidth, height: innerHeight},
    rail: box(rail),
    centerCard: box(center),
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

  // ── 3. 옆 가게가 눈에 들어온다 ─────────────────────────────────────────
  assert.ok(
    reading.neighbourStripPx > (before.railHeight === 342 ? 18 : 209),
    `${label}: 가운데 카드 옆에 남는 폭이 ${reading.neighbourStripPx}px 뿐이라 다음 가게가 보이지 않습니다`,
  );

  // ── 4. 글자는 없고 이름과 터치 영역은 남는다 ───────────────────────────
  assert.equal(actions.length, 2, `${label}: 동작 버튼은 전화와 네이버지도 둘입니다`);
  const byAction = Object.fromEntries(actions.map(a => [a.action, a]));
  for (const name of ['phone', 'naver-map']) {
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

  // ── 5. 지도 썸네일과 "위치" 는 화면에도 없다 ───────────────────────────
  assert.equal(reading.hasLocationThumb, false, `${label}: 지도 썸네일이 아직 카드에 있습니다`);
  assert.equal(reading.hasActionLabel, false, `${label}: 동작 버튼 글자가 아직 카드에 있습니다`);

  // ── 6. 인허가 다섯 갈래가 화면에 그대로 나온다 ─────────────────────────
  assert.equal(reading.licenseTexts.length, 5, `${label}: 인허가 문구가 다섯 장에 다 나오지 않았습니다`);
  const expected = [
    LICENSE_COPY.NOT_FOUND,
    `${LICENSE_COPY.VERIFIED} · 영업/정상`,
    LICENSE_COPY.AMBIGUOUS,
    LICENSE_COPY.CONFLICTING,
    LICENSE_COPY.OTHER,
  ];
  assert.deepEqual(reading.licenseTexts, expected, `${label}: 인허가 문구가 기대와 다릅니다`);

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
