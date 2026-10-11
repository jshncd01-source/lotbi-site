// MY-CHILD-SCHOOL-01 — 생활정보 → 내 아이 학교·유치원.
//
// Contract checked here:
// * 생활정보 shows a ninth (last) card "내 아이 학교·유치원" (the eight existing
//   cards and their order stay); the card opens this screen at once — no
//   내 아이 정보 / 유치원·학교 찾기 choice (REGIONAL-INFO-BACK-NAVIGATION-01, owner
//   decision 2026-10-10) — its header ← ("지역정보로 돌아가기", the one back
//   of the screen — QA 2026-10-10 #3) steps one screen back to the 지역정보
//   list; its "대화로 더 물어보기" asks through
//   the same onAsk as every life card (one tap, no keyboard)
// * signed out: a login notice (/auth/start/), no Core call
// * signed in: NEIS school search → pick → nickname (default "첫째") +
//   allergen numbers + the first-save consent → save; 유치원 via the
//   유치원알리미 region picker; rename / re-allergen; delete one; delete all
//   (the consent is asked again afterwards)
// * school overview: today's meals with the chosen allergen dishes marked and
//   "○○ 포함", "급식표 알레르기 표기 기준", 학교 홈페이지 link, 방학·재량휴업일·개학,
//   "출처: NEIS · <time> 갱신"; nothing medical
// * a school NEIS left empty offers "정보 보완 요청" per item → "요청함"
// * MY-CHILD-MEAL-LINK-PDF-01: where NEIS has no meal this week (and for a
//   유치원) the "학교/유치원 공개 급식표" card lists what staff registered —
//   a link opens in a new tab, a PDF opens through the Bearer content route
//   in a tab opened inside the tap; source, registered day and "알레르기
//   번호를 읽지 않아 자동 강조·알림은 되지 않으니" are on the card
// * "no meal" is told apart: a day / week without a meal ("오늘은 급식이 없는
//   날이에요"), a school NEIS carries no meal for lately (guidance, with the
//   lookback days), a 유치원 ("공공 데이터로 급식표가 제공되지 않아요")
// * every Core call: Bearer, credentials omit; bodies carry only the
//   institution code, nickname, allergen numbers (and the consent version)
// * 320/360/412 mobile and 1280 desktop, light and dark: no horizontal
//   overflow, controls ≥ 44px, readable text (viewport emulation, not a device run)
//
// Core responses come from scripts/fixtures/my_child_school_01.json, produced
// by lotbi-core app/my_child_api.py itself on real NEIS / 유치원알리미 rows;
// the in-page fake keeps state (entries, consent, requests) the way Core does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/my_child_school_01.json'));
const KINDER = JSON.parse(read('scripts/fixtures/kindergarten_official_info_01.json'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

// ── Pure contract ───────────────────────────────────────────────────────
const sections = await import('../site-consumer-sections.js');
const screen = await import('../site-life-my-child.js');
const client = await import('../site-my-child-client.js');

await check('지역정보: 내 아이 학교·유치원 is the last card and opens the saved schools / 유치원 screen at once', () => {
  assert.deepEqual(sections.LIFE_SHORTCUTS.map(item => item.id), ['medical', 'pharmacy', 'ev-chargers', 'festivals', 'news', 'subway', 'onnuri', 'real-estate', 'local', 'my-child']);
  const item = sections.LIFE_SHORTCUTS.at(-1);
  assert.equal(item.label, '내 아이 학교·유치원');
  assert.ok(!item.prompt && !item.medical);
  const source = read('site-consumer-sections.js');
  // REGIONAL-INFO-BACK-NAVIGATION-01 (owner decision 2026-10-10): one card, one
  // screen — no 내 아이 정보 / 유치원·학교 찾기 choice in between.
  assert.equal(item.children, undefined);
  assert.match(source, /else if \(item\.id === 'my-child'\) openMyChild\(item\);/u);
  assert.doesNotMatch(source, /openChildChoice|data-child-choice|childChoice/u);
  // Owner decision 2026-10-10: signed out only, the saved screen links the public lookup.
  assert.match(source, /const lookup = authenticated \? null : node\('button', [^)]*'로그인 없이 학교·유치원 찾기'\);/u);
  assert.equal(sections.LIFE_VIEW_PARENT['life-my-child'], 'life');
  assert.doesNotMatch(source, /\bfetch\(|localStorage|innerHTML/u);
  const conversation = read('site-conversation.js');
  assert.match(conversation, /mountMyChild: async \(root, \{onAsk: askFromMyChild\} = \{\}\) => \{\r?\n\s+const \{mountMyChild\} = await import\('\.\/site-life-my-child\.js\?v=aset-[0-9a-f]{12}'\);/u);
  assert.match(conversation, /return mountMyChild\(\{sessionToken, root, authenticated: Boolean\(sessionToken\), onAsk: askFromMyChild\}\);/u);
  // LIFE-DIRECT-CHAT-CARD-COMPACTION-01: "대화로 더 물어보기" asks through the
  // life section's onAsk (closes 생활정보, sends at once, no keyboard); no
  // draft handoff is left anywhere.
  assert.match(source, /mountMyChild\(host, \{onAsk\}\)/u, 'the life section hands its onAsk to the screen');
  const screenSource = read('site-life-my-child.js');
  assert.match(screenSource, /button\('대화로 더 물어보기', \(\) => onAsk\?\.\(/u, '대화로 더 물어보기 asks through onAsk');
  for (const [file, text] of [['site-conversation.js', conversation], ['site-consumer-sections.js', source], ['site-life-my-child.js', screenSource]]) {
    assert.doesNotMatch(text, /\bonDraft\b|draft\(text\)/u, `${file}: no draft handoff`);
  }
});

await check('screen sources: no storage, no HTML injection, nothing medical', () => {
  for (const file of ['site-life-my-child.js', 'site-my-child-client.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /localStorage|sessionStorage|innerHTML|insertAdjacentHTML|eval\(|new Function/u, file);
    assert.doesNotMatch(source, /섭취|드시지|먹지 마|위험해|의사와|진료를 받|안전합니다/u, file);
  }
  const css = read('site-life-my-child.css');
  assert.doesNotMatch(css, /data-site-theme|prefers-color-scheme|#[0-9a-f]{3,6}\b/iu, 'theme tokens only');
  for (const html of ['index.html', 'auth/callback/index.html']) {
    const text = read(html);
    const education = text.indexOf('site-life-education.css?v=');
    const mine = text.indexOf('site-life-my-child.css?v=');
    assert.ok(education > 0 && mine > education, `${html}: stylesheet after site-life-education.css`);
  }
});

await check('labels: days, periods, update time, nickname, allergens', () => {
  assert.equal(screen.formatDayLabel('2026-10-09'), '10.9(금)');
  assert.equal(screen.formatPeriod('2026-07-20', '2026-08-25'), '7.20(월)~8.25(화)');
  assert.equal(screen.formatPeriod('2026-10-12', '2026-10-12'), '10.12(월)');
  assert.equal(screen.formatFetchedAt('2026-10-09T04:05:00+00:00'), '10.9 13:05');
  assert.equal(screen.formatFetchedAt('nope'), '');
  assert.equal(screen.nextNickname([]), '첫째');
  assert.equal(screen.nextNickname([{nickname: '큰애'}]), '둘째');
  assert.equal(screen.nextNickname([{nickname: '첫째'}, {nickname: '셋째'}]), '넷째');
  assert.equal(screen.allergenSummary([{code: 1, name: '난류'}, {code: 2, name: '우유'}]), '난류·우유');
  assert.match(screen.ALLERGY_BASIS_NOTE, /급식표 알레르기 표기 기준/u);
});

await check('client: save bodies hold only code, nickname, allergen numbers; responses keep known fields', () => {
  assert.deepEqual(Object.keys(client.schoolSaveBody({officeCode: 'P10', schoolCode: '8332169', nickname: ' 첫째 ', allergenCodes: [6, 5, 6]})).sort(),
    ['allergens', 'kind', 'nickname', 'office_code', 'school_code']);
  assert.deepEqual(client.schoolSaveBody({officeCode: 'P10', schoolCode: '8332169', nickname: '첫째', allergenCodes: [6, 5, 6], consentVersion: 'v1'}),
    {kind: 'SCHOOL', office_code: 'P10', school_code: '8332169', nickname: '첫째', allergens: [5, 6], consent_version: 'v1'});
  assert.deepEqual(Object.keys(client.kindergartenSaveBody({kinderCode: 'abcdefgh', sggCode: '52113', nickname: '둘째'})).sort(),
    ['allergens', 'kind', 'kinder_code', 'nickname', 'sgg_code']);
  const listing = client.normalizeListing(FIXTURE.listing_three);
  assert.equal(listing.entries.length, 3);
  assert.equal(listing.allergenCatalog.length, 19);
  assert.equal(listing.consent.accepted, true);
  const overview = client.normalizeOverview(FIXTURE.overview_school);
  assert.equal(overview.meals.status, 'OK');
  assert.ok(overview.meals.today[0].dishes.some(dish => dish.containsText === '대두·밀 포함'));
  assert.equal(overview.links.homepage, 'http://www.sewon.es.kr/');
  assert.equal(client.safeLink('javascript:alert(1)'), '');
  assert.equal(client.normalizeEntry({id: 'mci_x', kind: 'SCHOOL'}), null);
});

await check('client: 공개 급식표 — only links and PDF / JPG / PNG files, content path built from ids, never allergen-checked', async () => {
  const shown = client.normalizeOverview(FIXTURE.overview_school_empty).mealPlans;
  assert.equal(shown.visible, true);
  assert.equal(shown.title, '학교 공개 급식표');
  assert.match(shown.notice, /알레르기 번호를 읽지 않아 자동 강조·알림은 되지 않으니/u);
  assert.deepEqual(shown.items.map(item => item.kind), ['DOCUMENT', 'LINK']);
  const entryId = FIXTURE.overview_school_empty.entry.id;
  assert.equal(shown.items[0].contentPath, `/v2/life/my-children/${entryId}/meal-plans/${shown.items[0].id}/content`);
  assert.equal(shown.items[1].url, 'https://school.example.kr/meal/2026-09');
  assert.equal(client.normalizeOverview(FIXTURE.overview_school).mealPlans.visible, false, 'NEIS meals this week: no card');
  assert.equal(client.normalizeOverview(FIXTURE.overview_kindergarten).mealPlans.title, '유치원 공개 급식표');
  const hostile = client.normalizeOverview({...FIXTURE.overview_school_empty, meal_plans: {visible: true, items: [
    {id: 'mps_0123456789abcdef0123', kind: 'LINK', url: 'javascript:alert(1)'},
    {id: 'mps_0123456789abcdef0124', kind: 'DOCUMENT', file: {name: 'x.html', mime_type: 'text/html', size_bytes: 1}},
    {id: '../../admin', kind: 'DOCUMENT', file: {name: 'x.pdf', mime_type: 'application/pdf', size_bytes: 1}},
    {id: 'mps_0123456789abcdef0125', kind: 'DOCUMENT', file: {name: 'x.pdf', mime_type: 'application/pdf', size_bytes: 1},
      content_path: 'https://evil.example/x'},
  ]}}).mealPlans;
  assert.deepEqual(hostile.items.map(item => item.id), ['mps_0123456789abcdef0125']);
  assert.match(hostile.items[0].contentPath, /^\/v2\/life\/my-children\/mci_[0-9a-f]{20}\/meal-plans\/mps_0123456789abcdef0125\/content$/u);
  const seen = [];
  const pdf = Buffer.from(FIXTURE.meal_plan_pdf_base64, 'base64');
  const fake = async (url, init) => { seen.push([url, init]); return new Response(pdf, {status: 200, headers: {'Content-Type': 'application/pdf'}}); };
  const blob = await client.fetchMealPlanFile('site-token', entryId, shown.items[0].id, fake);
  assert.equal(blob.type, 'application/pdf');
  assert.equal(seen[0][1].headers.Authorization, 'Bearer site-token');
  assert.equal(seen[0][1].credentials, 'omit');
  assert.ok(seen[0][0].endsWith(`/v2/life/my-children/${entryId}/meal-plans/${shown.items[0].id}/content`), seen[0][0]);
  await assert.rejects(client.fetchMealPlanFile('site-token', entryId, 'mps_bad', fake), {code: 'MY_CHILD_MEAL_PLAN_NOT_FOUND'});
  const html = async () => new Response('<html></html>', {status: 200, headers: {'Content-Type': 'text/html'}});
  await assert.rejects(client.fetchMealPlanFile('site-token', entryId, shown.items[0].id, html), {code: 'CONTRACT_INVALID'});
  assert.equal(screen.formatRegisteredDay('2026-10-05T15:30:00+00:00'), '10.6(화)');
});

await check('client: NEIS coverage — PROVIDED / NOT_PROVIDED / UNKNOWN with the lookback days; anything else is UNKNOWN', () => {
  assert.equal(client.normalizeOverview(FIXTURE.overview_school).meals.coverage, 'PROVIDED');
  const empty = client.normalizeOverview(FIXTURE.overview_school_empty).meals;
  assert.equal(empty.coverage, 'NOT_PROVIDED');
  assert.equal(empty.coverageDays, 120);
  const odd = client.normalizeOverview({...FIXTURE.overview_school_empty, meals: {...FIXTURE.overview_school_empty.meals, coverage: 'NONE'}}).meals;
  assert.equal(odd.coverage, 'UNKNOWN');
  assert.equal(screen.NO_MEAL_TODAY, '오늘은 급식이 없는 날이에요.');
  assert.match(screen.SCHOOL_NOT_PROVIDED, /NEIS로 급식표를 제공하지 않는 것 같아요\. 학교 홈페이지나 가정통신문에서 확인해 주세요\./u);
  assert.equal(screen.KINDERGARTEN_NO_MEAL, '유치원은 공공 데이터로 급식표가 제공되지 않아요.');
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
  throw new Error('Chrome/Chromium is required for the 내 아이 학교·유치원 validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-320x640', width: 320, height: 640, mobile: true, userAgent: IPHONE_UA},
  {label: 'mobile-360x780', width: 360, height: 780, mobile: true, userAgent: ANDROID_UA},
  {label: 'mobile-412x915', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA},
];

function buildInner(signedIn) {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('mcs-result');
const F = ${JSON.stringify(FIXTURE)};
const K = ${JSON.stringify(KINDER)};
const SIGNED_IN = ${signedIn ? 'true' : 'false'};
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  const names = Object.fromEntries(F.listing_empty.allergen_catalog.map(item => [item.code, item.name]));
  const state = {accepted: false, entries: [], pending: {}, seq: 0};
  const calls = globalThis.__mcsCalls = [];
  const view = entry => ({id: entry.id, kind: entry.kind, nickname: entry.nickname,
    allergens: entry.allergens.map(code => ({code, name: names[code]})), institution_ref: entry.ref,
    institution: entry.institution, institution_status: 'OK', created_at: '2026-10-08T00:00:00+00:00', updated_at: '2026-10-08T00:00:00+00:00'});
  const listing = () => ({...F.listing_empty, entries: state.entries.map(view), consent: {...F.listing_empty.consent, accepted: state.accepted}});
  const detail = (status, code, message, extra = {}) => json({detail: {code, message, ...extra}}, status);
  const remark = (overview, entry) => {
    // Core marks NEIS dishes from the printed numbers ∩ the entry's numbers.
    const wanted = new Set(entry.allergens);
    const mark = meal => {
      const numbered = meal.source_type === 'NEIS';
      const dishes = meal.dishes.map(dish => {
        const hits = numbered ? dish.allergens.filter(code => wanted.has(code)).sort((a, b) => a - b) : [];
        return {...dish, matched_allergens: hits.map(code => ({code, name: names[code]})), contains_text: hits.length ? hits.map(code => names[code]).join('·') + ' 포함' : null};
      });
      const all = [...new Set(dishes.flatMap(dish => dish.matched_allergens.map(hit => hit.code)))].sort((a, b) => a - b);
      return {...meal, dishes, matched_allergens: all.map(code => ({code, name: names[code]}))};
    };
    if (!overview.meals) return overview;
    return {...overview, meals: {...overview.meals, today: overview.meals.today.map(mark), days: overview.meals.days.map(day => ({...day, meals: day.meals.map(mark)}))}};
  };
  const myChildren = (parsed, init) => {
    const method = (init?.method || 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    const auth = new Headers(init?.headers || {}).get('authorization') || '';
    calls.push({method, path: parsed.pathname + parsed.search, body, auth, credentials: init?.credentials || '', mode: init?.mode || ''});
    if (auth !== 'Bearer site-token') return detail(401, 'SESSION_REQUIRED', '');
    const rest = parsed.pathname.slice('/v2/life/my-children'.length);
    if (rest === '' && method === 'GET') return json(listing());
    if (rest === '' && method === 'DELETE') {
      const count = state.entries.length; state.entries = []; state.pending = {}; state.accepted = false;
      return json({deleted: {entries_deleted: count, info_requests_deleted: 0}});
    }
    if (rest === '/schools') return json(F.search);
    if (rest === '' && method === 'POST') {
      const allowed = new Set(['kind', 'office_code', 'school_code', 'kinder_code', 'sgg_code', 'nickname', 'allergens', 'consent_version']);
      if (Object.keys(body).some(key => !allowed.has(key))) return detail(422, 'VALIDATION', 'extra field');
      if (!state.accepted && body.consent_version !== F.listing_empty.consent.version) return json(F.consent_required, 428);
      if (state.entries.some(entry => entry.nickname === body.nickname)) return detail(409, 'MY_CHILD_NICKNAME_DUPLICATE', '같은 이름으로 저장한 항목이 있어요. 다른 이름을 써 주세요.', {field: 'nickname'});
      const id = 'mci_' + String(++state.seq).padStart(20, '0');
      let institution, ref;
      if (body.kind === 'SCHOOL') {
        const school = F.search.schools.find(item => item.school_code === body.school_code);
        institution = school; ref = {kind: 'SCHOOL', office_code: body.office_code, school_code: body.school_code};
      } else {
        const k = F.overview_kindergarten.kindergarten;
        institution = {kinder_code: body.kinder_code, sgg_code: body.sgg_code, name: k.name, kind_label: '유치원', establishment: k.establishment, area: k.area, address: k.address};
        ref = {kind: 'KINDERGARTEN', kinder_code: body.kinder_code, sgg_code: body.sgg_code};
      }
      const entry = {id, kind: body.kind, nickname: body.nickname, allergens: body.allergens, institution, ref};
      state.entries.push(entry); state.accepted = true;
      return json({entry: view(entry), consent: listing().consent}, 201);
    }
    const match = /^\\/(mci_[0-9a-f]{20})(\\/overview|\\/info-requests|\\/meal-plans\\/mps_[0-9a-f]{20}\\/content)?$/u.exec(rest);
    const entry = match && state.entries.find(item => item.id === match[1]);
    if (!entry) return detail(404, 'MY_CHILD_ENTRY_NOT_FOUND', '저장한 항목을 찾지 못했어요.');
    const base = () => entry.kind === 'KINDERGARTEN' ? F.overview_kindergarten
      : entry.ref.school_code === '8332169' ? F.overview_school : F.overview_school_empty;
    if (!match[2] && method === 'PATCH') {
      if (body.nickname !== undefined) entry.nickname = body.nickname;
      if (body.allergens !== undefined) entry.allergens = body.allergens;
      return json({entry: view(entry), changed: Object.keys(body)});
    }
    if (!match[2] && method === 'DELETE') { state.entries = state.entries.filter(item => item !== entry); return json({deleted: true, id: entry.id}); }
    if (match[2] === '/overview') return json(remark({...base(), entry: view(entry), info_requests: state.pending[entry.id] || {}}, entry));
    if (match[2] && match[2].startsWith('/meal-plans/')) {
      const sourceId = match[2].split('/')[2];
      const item = (base().meal_plans?.items || []).find(plan => plan.id === sourceId && plan.kind === 'DOCUMENT');
      if (!item) return detail(404, 'MY_CHILD_MEAL_PLAN_NOT_FOUND', '급식표 파일을 찾지 못했어요.');
      const bytes = Uint8Array.from(atob(F.meal_plan_pdf_base64), c => c.charCodeAt(0));
      return Promise.resolve(new Response(bytes, {status: 200, headers: {'Content-Type': item.file.mime_type}}));
    }
    if (match[2] === '/info-requests') {
      const results = {};
      state.pending[entry.id] = state.pending[entry.id] || {};
      for (const item of body.items) {
        if (!base().requestable.includes(item)) { results[item] = 'NOT_EMPTY'; continue; }
        results[item] = state.pending[entry.id][item] ? 'ALREADY_REQUESTED' : 'REQUESTED';
        state.pending[entry.id][item] = 'PENDING';
      }
      return json({id: entry.id, results, info_requests: state.pending[entry.id]});
    }
    return detail(405, 'METHOD', '');
  };
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname.startsWith('/v2/life/my-children')) return myChildren(parsed, init);
    if (parsed.pathname.startsWith('/v2/life/kindergartens')) {
      calls.push({method: 'GET', path: parsed.pathname + parsed.search, kinder: true, credentials: init?.credentials || ''});
      if (parsed.pathname.endsWith('/regions')) return json(K.regions);
      const key = [parsed.searchParams.get('sgg_code'), parsed.searchParams.get('establishment') || 'ALL', parsed.searchParams.get('q') || ''].join('|');
      return json(K.search[key] || {contract_id: 'CORE-KINDERGARTEN-RESULT-01', status: 'UNAVAILABLE', items: []});
    }
    if (parsed.pathname === '/v2/me') return json({user: {id: 'usr_mychild', name: '보호자', account_handle: 'parent'},
      session: {id: 'ses', assurance_level: 'FULL', expires_at: '2099-01-01T00:00:00Z'}, installation: {id: 'install-mychild-test'}});
    if (parsed.pathname === '/v2/subscription') return json({plan: 'FREE', status: 'NONE', entitled: false});
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
      guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  // site-conversation.js mounts a guest conversation on import when the
  // composer exists (autoMount); the signed-in run detaches it until the
  // module is loaded, the way auth/callback mounts after hydration.
  const composer = document.getElementById('lotbi-prompt');
  const slot = document.createComment('composer');
  if (SIGNED_IN) composer.replaceWith(slot);
  const conversation = await import('/site-conversation.js?v=mychildschool01');
  if (SIGNED_IN) { slot.replaceWith(composer); document.body.dataset.siteAuthState = 'authenticated'; }
  const mounted = SIGNED_IN ? conversation.mountConversation({sessionToken: 'site-token', identityKey: 'install-mychild-test'}) : conversation.mountConversation();
  if (!mounted) throw new Error('mount');
  out.textContent = JSON.stringify({ok: true});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); }
</script><pre id="mcs-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Runs in the page: drives the screen with DOM events and measures it.
const SCENARIO = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const screenText = () => (document.querySelector('.lotbi-mychild')?.textContent || document.querySelector('.consumer-section-panel')?.textContent || '').slice(0, 400);
  const wait = async (fn, label, ms = 15000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + label + ' | screen: ' + screenText()); await sleep(50); } };
  const box = node => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right}; };
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { const fg = parse(getComputedStyle(node).color).slice(0, 3), bg = bgOf(node); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + .05) / (b + .05); };
  const small = root => [...root.querySelectorAll('button, select, input:not([type="checkbox"]), summary, a.consumer-action, label.lotbi-mychild-allergen, label.lotbi-mychild-consent-check')]
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; })
    .map(n => (n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().height) + ':' + (n.textContent || '').trim().slice(0, 12));
  const overflow = root => [...root.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(n => n.className || n.tagName).slice(0, 5);
  const pageOverflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const fire = (node, type) => node.dispatchEvent(new Event(type, {bubbles: true}));
  const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find(n => n.textContent.trim() === text);
  const measure = root => ({small: small(root), overflow: overflow(root), page: pageOverflow()});
  const result = {};

  document.querySelector('[data-consumer-section="life"]').click();
  const panel = await wait(() => document.querySelector('.consumer-section-panel'), 'life surface');
  const shortcut = await wait(() => panel.querySelector('[data-life-shortcut="my-child"]'), 'my-child shortcut');
  result.cards = [...panel.querySelectorAll('[data-life-shortcut]')].map(n => n.dataset.lifeShortcut);
  result.card = {label: shortcut.textContent.trim(), box: box(shortcut)};
  shortcut.click();
  const host = await wait(() => panel.querySelector('.lotbi-mychild'), 'my-child screen');
  result.choices = [...panel.querySelectorAll('[data-child-choice]')].map(n => n.dataset.childChoice + ':' + n.textContent.trim());
  result.back = panel.querySelector('.site-modal-close')?.getAttribute('aria-label') || '';
  result.textBack = Boolean(panel.querySelector('.consumer-life-detail > .consumer-action-secondary:not([data-life-education-entry])'));
  result.lookup = panel.querySelector('[data-life-education-entry]')?.textContent || '';
  if (!${'${SIGNED_IN}'}) {
    const notice = await wait(() => host.querySelector('[data-my-child-state="LOGIN_REQUIRED"]'), 'login notice');
    result.login = {text: notice.textContent, href: notice.querySelector('a')?.getAttribute('href'), measure: measure(host)};
    result.calls = globalThis.__mcsCalls.length;
    panel.querySelector('.site-modal-close').click();
    await wait(() => panel.querySelector('[data-life-shortcut="my-child"]') && !panel.querySelector('.lotbi-mychild'), 'back to life');
    result.backHome = document.activeElement?.dataset?.lifeShortcut || '';
    return result;
  }
  const emptyState = await wait(() => host.querySelector('.lotbi-mychild-empty'), 'empty list');
  result.empty = {text: emptyState.textContent, footer: host.querySelector('.lotbi-mychild-footer')?.textContent || '', measure: measure(host)};

  // 1. Add a school: NEIS search → pick → nickname + allergens + consent.
  host.querySelector('[data-my-child-add]').click();
  const query = await wait(() => host.querySelector('[data-my-child-school-query]'), 'school search');
  result.tabs = [...host.querySelectorAll('[data-my-child-tab]')].map(t => [t.dataset.myChildTab, t.getAttribute('aria-selected')]);
  query.value = '서원초';
  query.closest('form').requestSubmit();
  await wait(() => host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card').length, 'school results');
  result.search = {count: host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card').length, measure: measure(host),
    status: host.querySelector('.lotbi-mychild-panel .lotbi-mychild-status').textContent};
  byText(host, '.lotbi-mychild-results .lotbi-mychild-card strong', '전주서원초등학교').closest('button').click();
  const save = await wait(() => host.querySelector('[data-my-child-save="SCHOOL"]'), 'save form');
  result.form = {nickname: save.querySelector('[data-my-child-nickname]').value, allergens: save.querySelectorAll('[data-my-child-allergen]').length,
    consent: Boolean(save.querySelector('[data-my-child-consent-check]')), consentText: save.querySelector('.lotbi-mychild-consent')?.textContent || '',
    hint: save.textContent, measure: measure(host)};
  for (const code of ['5', '6']) { const box_ = save.querySelector('[data-my-child-allergen="' + code + '"]'); box_.checked = true; fire(box_, 'change'); }
  save.requestSubmit();
  await sleep(100);
  result.withoutConsent = {status: save.querySelector('.lotbi-mychild-status').textContent, posts: globalThis.__mcsCalls.filter(c => c.method === 'POST').length};
  save.querySelector('[data-my-child-consent-check]').checked = true;
  save.requestSubmit();
  // SUBVIEW-BACK-NAVIGATION-01: the phone's back on the overview shows the
  // saved list — one step, 지역정보 stays — and the entry opens again.
  await wait(() => host.querySelector('[data-my-child-section="meals"]'), 'school overview (first)');
  await wait(() => history.state && history.state.lotbiSubview, 'the overview layer entry');
  history.back();
  await wait(() => host.querySelector('[data-my-child-entry]') && !host.querySelector('[data-my-child-section="meals"]'), 'phone back → the saved list');
  result.overviewBack = {list: true, route: document.querySelector('[data-site-route]')?.dataset.siteRoute || '', hash: location.hash};
  host.querySelector('[data-my-child-entry]').click();
  const meals = await wait(() => host.querySelector('[data-my-child-section="meals"]'), 'school overview');
  const overview = () => ({
    title: host.querySelector('.lotbi-mychild-title')?.textContent,
    subtitle: host.querySelector('.lotbi-mychild-subtitle')?.textContent,
    todayHeading: meals.querySelector('h5')?.textContent,
    dishes: [...host.querySelectorAll('[data-my-child-section="meals"] > .lotbi-mychild-meal .lotbi-mychild-dish')].map(d => ({
      name: d.querySelector('.lotbi-mychild-dish-name').textContent, hit: d.classList.contains('is-allergen'),
      contains: d.querySelector('.lotbi-mychild-contains')?.textContent || '', codes: d.dataset.myChildAllergenHit || ''})),
    notes: [...host.querySelectorAll('[data-my-child-section="meals"] .lotbi-mychild-hint')].map(n => n.textContent),
    week: host.querySelector('.lotbi-mychild-week summary')?.textContent || '',
    links: [...host.querySelectorAll('.lotbi-mychild-links a')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('rel'), a.target]),
    schedule: [...host.querySelectorAll('[data-my-child-schedule]')].map(li => [li.dataset.myChildSchedule, li.textContent]),
    source: host.querySelector('.lotbi-mychild-source')?.textContent || '',
    gap: Boolean(host.querySelector('[data-my-child-section="info-request"]')),
    text: host.textContent,
  });
  result.school = overview();
  const week = host.querySelector('.lotbi-mychild-week'); if (week) week.open = true;
  await sleep(50);
  result.school.measure = measure(host);
  const themes = {};
  for (const mode of ['light', 'dark']) {
    document.body.dataset.siteTheme = mode; await sleep(40);
    const hit = host.querySelector('.lotbi-mychild-dish.is-allergen');
    themes[mode] = {
      dish: contrast(hit.querySelector('.lotbi-mychild-dish-name')), contains: contrast(hit.querySelector('.lotbi-mychild-contains')),
      plain: contrast(host.querySelector('.lotbi-mychild-dish:not(.is-allergen) .lotbi-mychild-dish-name')),
      hint: contrast(host.querySelector('[data-my-child-section="meals"] .lotbi-mychild-hint')),
      source: contrast(host.querySelector('.lotbi-mychild-source')), title: contrast(host.querySelector('.lotbi-mychild-title')),
      schedule: contrast(host.querySelector('.lotbi-mychild-schedule-when')),
      hitBorder: getComputedStyle(hit).borderLeftColor, color: getComputedStyle(hit.querySelector('.lotbi-mychild-dish-name')).color,
    };
  }
  document.body.dataset.siteTheme = 'light';
  result.themes = themes;

  // 2. Rename + change allergens.
  host.querySelector('[data-my-child-edit]').click();
  const edit = await wait(() => host.querySelector('[data-my-child-edit-form]'), 'edit form');
  edit.querySelector('[data-my-child-nickname]').value = '큰애';
  const six = edit.querySelector('[data-my-child-allergen="6"]'); six.checked = false;
  edit.requestSubmit();
  await wait(() => host.querySelector('.lotbi-mychild-title')?.textContent === '큰애' && host.querySelector('[data-my-child-section="meals"]'), 'renamed overview');
  result.edited = {title: host.querySelector('.lotbi-mychild-title').textContent,
    contains: [...host.querySelectorAll('[data-my-child-section="meals"] > .lotbi-mychild-meal .lotbi-mychild-contains')].map(n => n.textContent)};

  // 3. A second school NEIS left empty: gap requests.
  byText(host, 'button', '목록으로').click();
  await wait(() => host.querySelectorAll('[data-my-child-entry]').length === 1, 'list with one');
  host.querySelector('[data-my-child-add]').click();
  const query2 = await wait(() => host.querySelector('[data-my-child-school-query]'), 'school search 2');
  query2.value = '서원초'; query2.closest('form').requestSubmit();
  await wait(() => host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card').length, 'school results 2');
  [...host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card')].find(b => b.querySelector('strong').textContent !== '전주서원초등학교').click();
  const save2 = await wait(() => host.querySelector('[data-my-child-save="SCHOOL"]'), 'save form 2');
  result.second = {nickname: save2.querySelector('[data-my-child-nickname]').value, consent: Boolean(save2.querySelector('[data-my-child-consent-check]'))};
  save2.requestSubmit();
  const gap = await wait(() => host.querySelector('[data-my-child-section="info-request"]'), 'gap section');
  result.gap = {items: [...gap.querySelectorAll('[data-my-child-gap]')].map(li => li.dataset.myChildGap), text: gap.textContent,
    emptyLines: [...host.querySelectorAll('.lotbi-mychild-empty-line')].map(n => n.textContent), measure: measure(host),
    coverage: [...host.querySelectorAll('[data-my-child-meal-coverage="NOT_PROVIDED"] p')].map(n => n.textContent)};
  const plansCard = host.querySelector('[data-my-child-section="meal-plans"]');
  const order = [...host.querySelectorAll('[data-my-child-section]')].map(n => n.dataset.myChildSection);
  result.plans = plansCard ? {order, title: plansCard.querySelector('h5')?.textContent, notice: plansCard.querySelector('.lotbi-mychild-hint')?.textContent,
    rows: [...plansCard.querySelectorAll('[data-my-child-meal-plan]')].map(li => [li.dataset.myChildMealPlan, li.querySelector('.lotbi-mychild-mealplan-name')?.textContent,
      li.querySelector('.lotbi-mychild-mealplan-meta')?.textContent]),
    link: [...plansCard.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href'), a.target, a.rel]),
    allergenMarks: plansCard.querySelectorAll('.is-allergen, .lotbi-mychild-contains').length} : null;
  if (plansCard) {
    const opened = [];
    const realOpen = window.open;
    window.open = (url, target) => { const tab = {opener: window, url, target, closed: false, location: {href: ''}, close() { this.closed = true; }}; opened.push(tab); return tab; };
    plansCard.querySelector('[data-my-child-meal-plan-open]').click();
    await wait(() => opened[0]?.location.href, 'pdf tab pointed at the file');
    window.open = realOpen;
    result.plans.opened = opened.map(tab => ({url: tab.url, target: tab.target, opener: tab.opener === null, href: tab.location.href.slice(0, 5), closed: tab.closed}));
    result.plans.contentCalls = globalThis.__mcsCalls.filter(call => call.path.includes('/meal-plans/')).map(call => ({path: call.path, auth: call.auth}));
  }
  gap.querySelector('[data-my-child-request="MEAL"]').click();
  await wait(() => host.querySelector('[data-my-child-gap="MEAL"] .lotbi-mychild-badge')?.textContent === '요청함', 'requested badge');
  result.gap.after = [...host.querySelectorAll('[data-my-child-gap]')].map(li => [li.dataset.myChildGap, li.textContent]);
  result.gap.status = host.querySelector('.lotbi-mychild > .lotbi-mychild-status').textContent;

  // 4. A 유치원 through the 유치원알리미 region picker.
  byText(host, 'button', '목록으로').click();
  await wait(() => host.querySelectorAll('[data-my-child-entry]').length === 2, 'list with two');
  host.querySelector('[data-my-child-add]').click();
  await wait(() => host.querySelector('[data-my-child-tab="KINDERGARTEN"]'), 'tabs');
  host.querySelector('[data-my-child-tab="KINDERGARTEN"]').click();
  const sido = await wait(() => host.querySelector('[data-my-child-sido]'), 'sido');
  sido.value = '52'; fire(sido, 'change');
  const sgg = host.querySelector('[data-my-child-sgg]'); sgg.value = '52113'; fire(sgg, 'change');
  host.querySelector('[data-my-child-kinder-query]').value = '예일';
  sido.closest('form').requestSubmit();
  await wait(() => host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card').length, 'kindergarten results');
  result.kinderSearch = {names: [...host.querySelectorAll('.lotbi-mychild-results strong')].map(n => n.textContent), measure: measure(host)};
  host.querySelector('.lotbi-mychild-results .lotbi-mychild-card').click();
  const save3 = await wait(() => host.querySelector('[data-my-child-save="KINDERGARTEN"]'), 'save form 3');
  result.third = {nickname: save3.querySelector('[data-my-child-nickname]').value};
  save3.requestSubmit();
  const kinder = await wait(() => host.querySelector('[data-my-child-section="kindergarten"] .lotbi-mychild-facts'), 'kindergarten overview');
  const kinderPlans = host.querySelector('[data-my-child-section="meal-plans"]');
  result.kinderMeal = {line: host.querySelector('[data-my-child-meal-coverage="KINDERGARTEN"]')?.textContent || '',
    order: [...host.querySelectorAll('[data-my-child-section]')].map(n => n.dataset.myChildSection),
    hint: host.querySelector('[data-my-child-section="kinder-meal"] .lotbi-mychild-hint')?.textContent || ''};
  result.kinderPlans = kinderPlans ? {title: kinderPlans.querySelector('h5')?.textContent,
    rows: [...kinderPlans.querySelectorAll('[data-my-child-meal-plan]')].map(li => li.querySelector('.lotbi-mychild-mealplan-meta')?.textContent),
    button: kinderPlans.querySelector('[data-my-child-meal-plan-open]')?.textContent} : null;
  result.kinder = {facts: [...kinder.querySelectorAll('.lotbi-mychild-fact')].map(r => [r.querySelector('dt').textContent, r.querySelector('dd').textContent]),
    tel: kinder.querySelector('a[href^="tel:"]')?.getAttribute('href') || '', source: host.querySelector('.lotbi-mychild-source').textContent,
    gap: Boolean(host.querySelector('[data-my-child-section="info-request"]')), measure: measure(host)};

  // 5. Delete one (two steps), then everything (two steps); consent asked again.
  byText(host, 'button', '목록으로').click();
  await wait(() => host.querySelectorAll('[data-my-child-entry]').length === 3, 'list with three');
  result.list = [...host.querySelectorAll('[data-my-child-entry]')].map(n => n.textContent);
  result.listMeasure = measure(host);
  host.querySelector('[data-my-child-entry]').click();
  const remove = await wait(() => host.querySelector('[data-my-child-delete]'), 'delete button');
  remove.click();
  result.deleteArmed = {label: remove.textContent, deletes: globalThis.__mcsCalls.filter(c => c.method === 'DELETE').length};
  remove.click();
  await wait(() => host.querySelectorAll('[data-my-child-entry]').length === 2, 'list after delete');
  const clear = host.querySelector('[data-my-child-delete-all]');
  clear.click(); result.clearArmed = clear.textContent; clear.click();
  await wait(() => host.querySelector('.lotbi-mychild-empty'), 'empty after delete all');
  result.afterClear = host.querySelector('.lotbi-mychild > .lotbi-mychild-status').textContent;
  host.querySelector('[data-my-child-add]').click();
  const query3 = await wait(() => host.querySelector('[data-my-child-school-query]'), 'school search 3');
  query3.value = '서원초'; query3.closest('form').requestSubmit();
  await wait(() => host.querySelectorAll('.lotbi-mychild-results .lotbi-mychild-card').length, 'school results 3');
  host.querySelector('.lotbi-mychild-results .lotbi-mychild-card').click();
  const save4 = await wait(() => host.querySelector('[data-my-child-save="SCHOOL"]'), 'save form 4');
  result.consentAgain = Boolean(save4.querySelector('[data-my-child-consent-check]'));

  // 6. The header ← steps one layer at a time (SUBVIEW-BACK-NAVIGATION-01): the
  //    open 추가 form → the saved list → the 지역정보 list.
  panel.querySelector('.site-modal-close').click();
  await wait(() => host.querySelector('[data-my-child-add]') && !host.querySelector('[data-my-child-save]'), '← → the saved list');
  panel.querySelector('.site-modal-close').click();
  await wait(() => panel.querySelector('[data-life-shortcut="my-child"]') && !panel.querySelector('.consumer-life-detail'), 'back to life');
  result.backHome = document.activeElement?.dataset?.lifeShortcut || '';
  result.calls = globalThis.__mcsCalls;
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

async function runCase(browser, origin, dir, testCase, innerName, signedIn) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const shots = process.env.MY_CHILD_SCREENSHOT_DIR || '';
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
      const text = await evaluate("document.getElementById('mcs-result')?.textContent || 'pending'").catch(() => 'pending');
      return text !== 'pending' ? text : null;
    }, `${testCase.label}: harness`, 60000);
    const parsed = JSON.parse(ready);
    if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
    const result = await evaluate(SCENARIO.replace('${SIGNED_IN}', signedIn ? 'true' : 'false'));
    if (shots) {
      fs.mkdirSync(shots, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(shots, `${testCase.label}${signedIn ? '' : '-signed-out'}.png`), Buffer.from(data, 'base64'));
    }
    return result;
  } finally {
    cdp.close();
  }
}

async function serverPort(child) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    child.once('error', reject);
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

// MY_CHILD_PREVIEW_OUT=<file>: only write the signed-in harness page (for a manual look) and stop.
if (process.env.MY_CHILD_PREVIEW_OUT) {
  fs.writeFileSync(process.env.MY_CHILD_PREVIEW_OUT, buildInner(true), 'utf8');
  console.log(`preview harness written: ${process.env.MY_CHILD_PREVIEW_OUT}`);
  process.exit(0);
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.my-child-school-'));
const server = startServer();
const ALLOWED_BODY = new Set(['kind', 'office_code', 'school_code', 'kinder_code', 'sgg_code', 'nickname', 'allergens', 'consent_version', 'items']);
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner(true), 'utf8');
  fs.writeFileSync(path.join(dir, 'signed-out.html'), buildInner(false), 'utf8');
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const r = await runCase(browser, origin, dir, testCase, 'inner.html', true);
    const label = testCase.label;
    await check(`${label}: the last card opens the saved screen at once with 지역정보로 돌아가기; empty list explains storage`, () => {
      assert.deepEqual(r.choices, [], 'no 내 아이 정보 / 유치원·학교 찾기 choice');
      assert.deepEqual(r.cards, ['medical', 'pharmacy', 'ev-chargers', 'festivals', 'news', 'subway', 'onnuri', 'real-estate', 'local', 'my-child']);
      assert.equal(r.card.label, '내 아이 학교·유치원');
      assert.ok(r.card.box.h >= 44, JSON.stringify(r.card.box));
      assert.equal(r.back, '지역정보로 돌아가기');
      assert.equal(r.textBack, false, 'one back: the header ←, no second text link (QA #3)');
      assert.equal(r.lookup, '', 'signed in: no 로그인 없이 학교·유치원 찾기 link');
      assert.match(r.empty.text, /아직 저장한 학교·유치원이 없어요/u);
      assert.match(r.empty.footer, /아이 이름·생년월일·사진·학년·반은 받지 않아요/u);
      assert.equal(r.backHome, 'my-child', 'focus returns to the card');
    });
    await check(`${label}: the phone's back on a saved school's overview → the saved list (SUBVIEW-BACK-NAVIGATION-01)`, () => {
      assert.deepEqual(r.overviewBack, {list: true, route: 'life-my-child', hash: '#life-my-child'});
    });
    await check(`${label}: NEIS search → pick → 첫째 + 19 allergen boxes + first-save consent`, () => {
      assert.deepEqual(r.tabs, [['SCHOOL', 'true'], ['KINDERGARTEN', 'false']]);
      assert.equal(r.search.count, 6);
      assert.match(r.search.status, /NEIS 학교 6곳 \(일부만 보여요/u);
      assert.equal(r.form.nickname, '첫째');
      assert.equal(r.form.allergens, 19);
      assert.equal(r.form.consent, true);
      assert.match(r.form.consentText, /자녀가 다니는 기관과 알레르기 표시 설정을 저장합니다, 언제든 삭제 가능/u);
      assert.match(r.form.hint, /아이 이름 대신 "첫째", "둘째"처럼 불러 주세요/u);
      assert.equal(r.withoutConsent.posts, 0, 'no save before the consent is ticked');
      assert.match(r.withoutConsent.status, /저장 안내에 동의해 주세요/u);
    });
    await check(`${label}: overview — today's meal, chosen allergens marked "대두·밀 포함", basis wording, links, schedule, source`, () => {
      assert.equal(r.school.title, '첫째');
      assert.match(r.school.subtitle, /전주서원초등학교 · 초등학교/u);
      assert.match(r.school.todayHeading, /오늘 급식 · 10\.8\(목\)/u);
      const hits = r.school.dishes.filter(dish => dish.hit);
      assert.ok(hits.length >= 3 && hits.every(dish => dish.contains === '대두·밀 포함' && dish.codes === '5,6'), JSON.stringify(r.school.dishes));
      assert.ok(r.school.dishes.some(dish => !dish.hit && !dish.contains), 'plain dishes stay plain');
      assert.ok(r.school.notes.some(note => /알레르기 강조는 급식표 알레르기 표기 기준이에요\. 표시한 알레르기: 대두·밀/u.test(note)), JSON.stringify(r.school.notes));
      assert.match(r.school.week, /이번 주 급식 \(10\.5\(월\)~10\.11\(일\)\)/u);
      assert.deepEqual(r.school.links, [['학교 홈페이지', 'http://www.sewon.es.kr/', 'noopener noreferrer', '_blank']]);
      assert.deepEqual(r.school.schedule.map(item => item[0]), ['DISCRETIONARY_HOLIDAY', 'VACATION', 'SCHOOL_START']);
      assert.match(r.school.schedule[1][1], /방학가을방학11\.20\(금\)~11\.24\(화\)/u);
      assert.match(r.school.source, /^출처: NEIS · \d{1,2}\.\d{1,2} \d{2}:\d{2} 갱신/u);
      assert.equal(r.school.gap, false, 'nothing to request where NEIS has data');
      assert.doesNotMatch(r.school.text, /섭취|드시지|먹지 마|위험|의사|진료를 받|안전합니다/u);
    });
    await check(`${label}: no overflow, controls ≥ 44px on every step`, () => {
      for (const [step, m] of Object.entries({empty: r.empty.measure, search: r.search.measure, form: r.form.measure, school: r.school.measure,
        gap: r.gap.measure, kinderSearch: r.kinderSearch.measure, kinder: r.kinder.measure, list: r.listMeasure})) {
        assert.deepEqual(m.overflow, [], `${step} overflow`);
        assert.ok(m.page <= 0, `${step} page overflow ${m.page}`);
        assert.deepEqual(m.small, [], `${step} controls`);
      }
    });
    await check(`${label}: light and dark readable; the mark follows the theme`, () => {
      for (const mode of ['light', 'dark']) {
        const t = r.themes[mode];
        for (const key of ['dish', 'contains', 'plain', 'title']) assert.ok(t[key] >= 4.5, `${mode} ${key} ${t[key]}`);
        for (const key of ['hint', 'source', 'schedule']) assert.ok(t[key] >= 3, `${mode} ${key} ${t[key]}`);
      }
      assert.notEqual(r.themes.light.color, r.themes.dark.color);
      assert.notEqual(r.themes.light.hitBorder, r.themes.dark.hitBorder);
    });
    await check(`${label}: rename and allergen change; an empty school offers 정보 보완 요청 → 요청함`, () => {
      assert.equal(r.edited.title, '큰애');
      assert.ok(r.edited.contains.length && r.edited.contains.every(text => text === '대두 포함'), JSON.stringify(r.edited.contains));
      assert.equal(r.second.nickname, '둘째');
      assert.equal(r.second.consent, false, 'consent is asked once');
      assert.deepEqual(r.gap.items, ['MEAL', 'SCHEDULE']);
      assert.match(r.gap.text, /요청한 사람은 직원에게 보이지 않아요/u);
      // MY-CHILD-MEAL-LINK-PDF-01: a school NEIS carries no meal for lately is told so (guidance, not a verdict).
      assert.deepEqual(r.gap.coverage, ['이 학교는 NEIS로 급식표를 제공하지 않는 것 같아요. 학교 홈페이지나 가정통신문에서 확인해 주세요.',
        '최근 120일 동안 NEIS 급식 기록이 없어요.']);
      assert.ok(!r.gap.emptyLines.includes('오늘은 급식 정보가 없어요.'), JSON.stringify(r.gap.emptyLines));
      assert.deepEqual(r.gap.after.map(item => item[0]), ['MEAL', 'SCHEDULE']);
      assert.match(r.gap.after[0][1], /급식요청함/u);
      assert.match(r.gap.after[1][1], /학사일정정보 보완 요청/u);
      assert.match(r.gap.status, /급식 보완을 요청했어요/u);
    });
    await check(`${label}: 학교 공개 급식표 card where NEIS has no meal; a PDF opens in a tab opened inside the tap`, () => {
      assert.ok(r.plans, 'meal-plans card on the empty school');
      assert.equal(r.school.text.includes('학교 공개 급식표'), false, 'no card while NEIS has meals');
      assert.deepEqual(r.plans.order.slice(0, 2), ['meals', 'meal-plans']);
      assert.equal(r.plans.title, '학교 공개 급식표');
      assert.match(r.plans.notice, /알레르기 번호를 읽지 않아 자동 강조·알림은 되지 않으니 직접 확인해 주세요/u);
      assert.deepEqual(r.plans.rows.map(row => row.slice(0, 2)), [['DOCUMENT', '10월 급식표'], ['LINK', '9월 급식표']]);
      assert.equal(r.plans.rows[0][2], '학교 공개 자료, LOTBI 직원 등록 · 10.6(화) 등록');
      assert.equal(r.plans.rows[1][2], '학교 공개 자료, LOTBI 직원 등록 · 10.2(금) 등록');
      assert.deepEqual(r.plans.link, [['급식표 열기', 'https://school.example.kr/meal/2026-09', '_blank', 'noopener noreferrer']]);
      assert.equal(r.plans.allergenMarks, 0, 'a published meal plan is never allergen-marked');
      assert.deepEqual(r.plans.opened, [{url: '', target: '_blank', opener: true, href: 'blob:', closed: false}]);
      assert.equal(r.plans.contentCalls.length, 1);
      assert.match(r.plans.contentCalls[0].path, /^\/v2\/life\/my-children\/mci_[0-9a-f]{20}\/meal-plans\/mps_[0-9a-f]{20}\/content$/u);
      assert.equal(r.plans.contentCalls[0].auth, 'Bearer site-token');
      assert.deepEqual(r.kinderPlans, {title: '유치원 공개 급식표', rows: ['유치원 공개 자료, LOTBI 직원 등록 · 10.5(월) 등록'], button: 'PDF 보기'});
      assert.equal(r.kinderMeal.line, '유치원은 공공 데이터로 급식표가 제공되지 않아요.');
      assert.deepEqual(r.kinderMeal.order, ['kindergarten', 'kinder-meal', 'meal-plans']);
      assert.equal(r.kinderMeal.hint, '', 'the card is there, so no "check the 가정통신문" hint');
    });
    await check(`${label}: 유치원 via the 유치원알리미 picker; 기본정보 with source; no gap request`, () => {
      assert.deepEqual(r.kinderSearch.names, ['예일유치원']);
      assert.equal(r.third.nickname, '셋째');
      const facts = Object.fromEntries(r.kinder.facts);
      assert.equal(facts['설립유형'], '사립(사인)');
      assert.equal(facts['연락처'], '063-245-1133');
      assert.ok(facts['주소'].includes('한배미5길'));
      assert.equal(r.kinder.tel, 'tel:063-245-1133');
      assert.match(r.kinder.source, /^교육부 유치원알리미 · 10\.8 12:00 갱신$/u);
      assert.equal(r.kinder.gap, false);
    });
    await check(`${label}: delete one and delete all take two steps; consent asked again after 모두 삭제`, () => {
      assert.equal(r.list.length, 3);
      assert.ok(r.list[0].startsWith('큰애학교전주서원초등학교알레르기 표시: 대두'), r.list[0]);
      assert.equal(r.deleteArmed.label, '정말 삭제');
      assert.equal(r.deleteArmed.deletes, 0);
      assert.equal(r.clearArmed, '정말 모두 삭제');
      assert.match(r.afterClear, /모두 삭제했어요/u);
      assert.equal(r.consentAgain, true);
    });
    await check(`${label}: every Core call is Bearer, credentials omit; bodies hold only codes, nickname, allergens`, () => {
      const mine = r.calls.filter(call => !call.kinder);
      assert.ok(mine.length >= 15, String(mine.length));
      for (const call of mine) {
        assert.equal(call.auth, 'Bearer site-token', call.path);
        assert.equal(call.credentials, 'omit', call.path);
        assert.equal(call.mode, 'cors', call.path);
        if (call.body) assert.deepEqual(Object.keys(call.body).filter(key => !ALLOWED_BODY.has(key)), [], JSON.stringify(call.body));
      }
      const saves = mine.filter(call => call.method === 'POST' && call.path === '/v2/life/my-children');
      assert.deepEqual(saves[0].body, {kind: 'SCHOOL', office_code: 'P10', school_code: '8332169', nickname: '첫째', allergens: [5, 6],
        consent_version: FIXTURE.listing_empty.consent.version});
      assert.equal('consent_version' in saves[1].body, false);
      assert.deepEqual(mine.find(call => call.method === 'PATCH').body, {nickname: '큰애', allergens: [5]});
      assert.ok(r.calls.filter(call => call.kinder).every(call => call.credentials === 'omit'));
    });
  }
  const out = await runCase(browser, origin, dir, CASES[1], 'signed-out.html', false);
  await check('signed out: login notice to /auth/start/, back button, no Core call', () => {
    assert.match(out.login.text, /로그인하고 아이 학교·유치원을 저장하세요/u);
    assert.equal(out.login.href, '/auth/start/');
    assert.equal(out.back, '지역정보로 돌아가기');
    assert.equal(out.textBack, false);
    assert.equal(out.lookup, '로그인 없이 학교·유치원 찾기', 'signed out: the public lookup link (owner decision 2026-10-10)');
    assert.deepEqual(out.choices, []);
    assert.equal(out.calls, 0);
    assert.deepEqual(out.login.measure.small, []);
    assert.deepEqual(out.login.measure.overflow, []);
    assert.equal(out.backHome, 'my-child');
  });
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`MY-CHILD-SCHOOL-01 site contract: PASS (${passed} checks; viewport emulation, not a device run)`);
