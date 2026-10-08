// NEIS-SCHOOL-LINKS-01 — [학교 홈페이지] / [급식·식단 원문] on NEIS school cards.
//
// 계약:
//  - Core가 정한 링크(school_result.links)만 버튼이 된다. 홈페이지는 직원 보완 →
//    NEIS 순으로 Core가 이미 고른 값, 급식·식단 원문은 직원 등록 값.
//  - 링크가 없거나 공개 http(s) 주소가 아니면 버튼도, 빈 자리도 없다.
//  - 급식 데이터 출처는 계속 "NEIS 교육정보 개방 포털". 직원 등록 원문은 NEIS로 표시하지 않는다.
//  - 같은 버튼은 카드마다 한 번만. 새 창 + rel="noopener noreferrer".
//  - 360/375/390/412px 모바일과 데스크톱에서 넘치지 않고 44px 이상 누를 수 있다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const school = await import('../site-life-school.js');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function fakeDocument() {
  const make = tag => ({
    tag, className: '', textContent: '', type: '', children: [], attributes: {}, dataset: {}, listeners: {},
    append(...items) { for (const item of items) this.children.push(typeof item === 'string' ? {tag: '#text', textContent: item, children: []} : item); },
    appendChild(item) { this.children.push(item); return item; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
  return {createElement: make};
}

function all(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.children || []) all(child, predicate, out);
  return out;
}

function textOf(node) {
  return (node.textContent || '') + (node.children || []).map(textOf).join('');
}

const SEOWON = {office_code: 'P10', school_code: '8332169', name: '전주서원초등학교', kind: '초등학교'};
const LINKS = {
  homepage_url: 'http://www.sewon.es.kr/',
  homepage_source: 'NEIS',
  meal_source_url: 'https://new.sewon.es.kr/meal',
};

function result(kind, extra = {}) {
  return {
    contract_id: 'CORE-SCHOOL-RESULT-01', schema_version: 1, kind, school: SEOWON,
    range: {from: '2026-10-01', to: '2026-10-01', label: '10월 1일(목)'},
    meals: [], events: [], timetable: [], candidates: [], coverage: 'COMPLETE', source: 'NEIS_OPEN_API',
    ...extra,
  };
}

const MEAL = {date: '2026-10-01', meal_name: '중식', dishes: [{name: '현미밥', allergens: []}, {name: '미역국', allergens: [5, 6]}], calories: '612.4 Kcal'};
const anchors = card => all(card, node => node.tag === 'a');

await check('links survive normalization; unsafe ones never do', async () => {
  const normalized = school.normalizeSchoolResult(result('MEAL', {meals: [MEAL], links: LINKS}));
  assert.deepEqual({...normalized.links}, {
    homepageUrl: 'http://www.sewon.es.kr/', homepageSource: 'NEIS', mealSourceUrl: 'https://new.sewon.es.kr/meal',
  });
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://localhost/', 'http://10.0.0.1/', 'https://u:p@a.kr/', 'http://a.kr:8080/', 'www.a.kr', 42]) {
    const value = school.normalizeSchoolResult(result('MEAL', {meals: [MEAL], links: {homepage_url: bad, homepage_source: 'NEIS', meal_source_url: bad}}));
    assert.deepEqual({...value.links}, {homepageUrl: '', homepageSource: '', mealSourceUrl: ''}, String(bad));
  }
  assert.deepEqual({...school.normalizeSchoolResult(result('MEAL', {meals: [MEAL]})).links}, {homepageUrl: '', homepageSource: '', mealSourceUrl: ''});
});

await check('meal answer: one [급식·식단 원문] and one [학교 홈페이지], new tab, source stays NEIS', async () => {
  const card = school.createSchoolResultCard(result('MEAL', {meals: [MEAL], links: LINKS}), {document: fakeDocument()});
  const links = anchors(card);
  assert.deepEqual(links.map(link => link.textContent), ['급식·식단 원문', '학교 홈페이지']);
  assert.deepEqual(links.map(link => link.href), ['https://new.sewon.es.kr/meal', 'http://www.sewon.es.kr/']);
  for (const link of links) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
    assert.equal(link.referrerPolicy, 'no-referrer');
    assert.match(link.attributes['aria-label'], /새 창에서 열립니다/u);
  }
  const [source] = all(card, node => node.className === 'lotbi-school-source');
  assert.equal(source.textContent, '출처: NEIS 교육정보 개방 포털');
  // The staff-registered page is a "원문" link, never presented as NEIS data.
  assert.doesNotMatch(`${links[0].textContent} ${links[0].attributes['aria-label']}`, /NEIS/u);
  assert.doesNotMatch(source.textContent, /원문/u);
});

await check('no link, no button and no empty placeholder', async () => {
  const card = school.createSchoolResultCard(result('MEAL', {meals: [MEAL]}), {document: fakeDocument()});
  assert.equal(anchors(card).length, 0);
  assert.equal(all(card, node => node.className === 'lotbi-school-links').length, 0);
  assert.equal(all(card, node => /disabled/u.test(node.attributes?.disabled || '')).length, 0);
});

await check('schedule/timetable answers carry only the homepage', async () => {
  const event = {date: '2026-10-09', name: '한글날', content: '', day_type: '공휴일', grade_numbers: [], calendar_draft: null};
  const card = school.createSchoolResultCard(result('SCHEDULE', {events: [event], links: LINKS}), {document: fakeDocument()});
  assert.deepEqual(anchors(card).map(link => link.textContent), ['학교 홈페이지']);
});

await check('homepage answer names where the address came from', async () => {
  const staff = school.createSchoolResultCard(
    result('HOMEPAGE', {range: null, links: {homepage_url: 'https://new.sewon.es.kr/', homepage_source: 'STAFF_OVERRIDE', meal_source_url: null}}),
    {document: fakeDocument()},
  );
  assert.deepEqual(anchors(staff).map(link => link.textContent), ['학교 홈페이지']);
  assert.match(textOf(staff), /홈페이지 주소: LOTBI 운영 등록/u);
  assert.doesNotMatch(textOf(staff), /출처: NEIS/u);
  const neis = school.createSchoolResultCard(result('HOMEPAGE', {range: null, links: LINKS}), {document: fakeDocument()});
  assert.match(textOf(neis), /홈페이지 주소 출처: NEIS 교육정보 개방 포털/u);
  const none = school.createSchoolResultCard(
    result('HOMEPAGE', {range: null, links: {homepage_url: null, homepage_source: null, meal_source_url: null}, empty_reason: 'NO_LINK'}),
    {document: fakeDocument()},
  );
  assert.ok(none, 'the school card still renders');
  assert.equal(anchors(none).length, 0);
});

await check('candidate lists never carry links', async () => {
  const card = school.createSchoolResultCard(
    result('SCHOOL_CANDIDATES', {school: null, candidates: [{...SEOWON, office_name: '전북특별자치도교육청'}], links: LINKS}),
    {document: fakeDocument()},
  );
  assert.equal(anchors(card).length, 0);
});

await check('school preference stays public identifiers only (no links stored)', async () => {
  const stored = school.normalizeSchoolPreference({...SEOWON, homepage_url: 'http://www.sewon.es.kr/', meal_source_url: 'https://x.kr/'});
  assert.deepEqual(Object.keys(stored).sort(), ['kind', 'name', 'office_code', 'school_code']);
  assert.equal(school.schoolContextForMessage('학교 홈페이지 열어줘', SEOWON)?.school_code, '8332169');
  assert.equal(school.schoolContextForMessage('롯비 홈페이지 열어줘', SEOWON), null);
});

// ------------------------------------------------------- real browser layout --

const PORT = 4291;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '360', width: 360, height: 780, mobile: true},
  {label: '375', width: 375, height: 812, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: 'desktop', width: 1280, height: 900, mobile: false},
];
const RESPONSES = [
  result('MEAL', {meals: [MEAL], links: {
    homepage_url: 'https://www.sewon-elementary-school-official-homepage.es.kr/index.do?menu=main',
    homepage_source: 'STAFF_OVERRIDE',
    meal_source_url: 'https://www.sewon-elementary-school-official-homepage.es.kr/board/meal/list.do?category=lunch',
  }}),
  result('MEAL', {meals: [MEAL]}),
];

function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime);
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const RESPONSES = ${JSON.stringify(RESPONSES)};
const out = document.getElementById('school-links-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 50000);
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  let turn = 0;
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const school_result = RESPONSES[Math.min(turn, RESPONSES.length - 1)];
      turn += 1;
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'전주서원초등학교 10월 1일(목) 급식이에요.',
        response_mode:'SCHOOL_READONLY',correlation_id:'req_schoollinks01_'+turn,
        intent:{action:'SCHOOL_LOOKUP',domain:'LIFE_SCHOOL',kind:'MEAL'},
        follow_up:{required:false,action:'SCHOOL_LOOKUP',automatic_execution:false},
        routing:{route:'SCHOOL_READONLY',ai_calls:0},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
          order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        school_result,retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=schoollinks01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<500;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const ask = async (text, count) => {
    const field = document.getElementById('lotbi-prompt');
    await wait(() => !document.querySelector('.send-button')?.disabled || true, 'send');
    field.value = text;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    return wait(() => { const cards = document.querySelectorAll('.lotbi-school-card'); return cards.length >= count ? cards[count - 1] : null; }, 'card '+count);
  };
  const withLinks = await ask('오늘 급식 뭐야?', 1);
  await new Promise(r=>setTimeout(r,300));
  const withoutLinks = await ask('내일 급식 뭐야?', 2);
  await new Promise(r=>setTimeout(r,300));
  const box = node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right}; };
  out.textContent = JSON.stringify({
    ok:true,
    viewport:{w:innerWidth,scroll:document.documentElement.scrollWidth},
    card:box(withLinks),
    links:[...withLinks.querySelectorAll('a.lotbi-school-link')].map(node => ({
      text:(node.textContent||'').trim(), href:node.getAttribute('href')||'', target:node.getAttribute('target')||'',
      rel:node.getAttribute('rel')||'', ...box(node),
    })),
    source:withLinks.querySelector('.lotbi-school-source')?.textContent||'',
    bare:{links:withoutLinks.querySelectorAll('a').length,row:withoutLinks.querySelectorAll('.lotbi-school-links').length,card:box(withoutLinks)},
  });
} catch(e) { fail(e); }
</script><pre id="school-links-result">pending</pre>`;
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

function wrapperMarkup(testCase, innerRel) {
  return `<!doctype html><html><body style="margin:0"><iframe id="frame" src="about:blank" width="${testCase.width}" height="${testCase.height}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('frame'),out=document.getElementById('result');
  frame.src='/${innerRel}';
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('school-links-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},70000);
  <\/script></body></html>`;
}

function run(browser, testCase, wrapperPath, wrapperRel) {
  fs.writeFileSync(wrapperPath, wrapperMarkup(testCase, innerRel), 'utf8');
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors',
    `--user-agent=${testCase.mobile ? MOBILE_UA : DESKTOP_UA}`, '--window-size=1500,1000', '--force-device-scale-factor=1',
    '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=80000', '--dump-dom', ORIGIN + '/' + wrapperRel,
  ], {encoding: 'utf8', timeout: 150000, maxBuffer: 16 * 1024 * 1024});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  const open = '<pre id="result">', close = '</pre>';
  const start = result.stdout.indexOf(open), end = result.stdout.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error('result missing');
  const raw = result.stdout.slice(start + open.length, end)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
  return parsed;
}

const browser = browserPath();
const FIXTURE_DIR = fs.mkdtempSync(path.join(ROOT, 'scripts/.schoollinks-'));
const FIXTURE_REL = 'scripts/' + path.basename(FIXTURE_DIR);
const innerRel = FIXTURE_REL + '/inner.html';
const wrapperRel = FIXTURE_REL + '/wrapper.html';
let server;
try {
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  waitServer();
  for (const testCase of CASES) {
    await check(`${testCase.label}${testCase.mobile ? "px" : ""}: links fit, are tappable, open safely; none when absent`, async () => {
      const reading = run(browser, testCase, path.join(ROOT, wrapperRel), wrapperRel);
      assert.ok(reading.viewport.scroll <= reading.viewport.w, `${testCase.label}: page scrolls sideways ${reading.viewport.scroll} > ${reading.viewport.w}`);
      assert.deepEqual(reading.links.map(link => link.text), ['급식·식단 원문', '학교 홈페이지'], `${testCase.label}: actions`);
      for (const link of reading.links) {
        assert.ok(link.h >= 44, `${testCase.label}: ${link.text} height ${link.h}`);
        assert.ok(link.x >= reading.card.x - 0.5 && link.right <= reading.card.right + 0.5, `${testCase.label}: ${link.text} overflows the card`);
        assert.equal(link.target, '_blank');
        assert.equal(link.rel, 'noopener noreferrer');
        assert.match(link.href, /^https:\/\/www\.sewon-elementary-school-official-homepage\.es\.kr\//u);
      }
      assert.ok(reading.card.right <= reading.viewport.w + 0.5, `${testCase.label}: card wider than the screen`);
      assert.match(reading.source, /출처: NEIS 교육정보 개방 포털/u);
      assert.deepEqual({links: reading.bare.links, row: reading.bare.row}, {links: 0, row: 0}, `${testCase.label}: no-link card`);
    });
  }
} finally {
  server?.kill();
  fs.rmSync(FIXTURE_DIR, {recursive: true, force: true});
}

console.log(`NEIS-SCHOOL-LINKS-01 site contract: PASS (${passed} checks)`);
