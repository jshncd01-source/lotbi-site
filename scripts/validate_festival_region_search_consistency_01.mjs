// FESTIVAL-REGION-SEARCH-CONSISTENCY-01 — 전국 / 시·도 / 시·군 / 현재 위치 scopes
// say what they search and send what they say.
//
// Production 2026-10-08 (iPhone KakaoTalk browser): 전국 listed 임실N치즈축제
// (전북특별자치도 임실군), "현재 위치 기준 · 전북특별자치도" said there was
// nothing. The 0 came from Core (every PUBLISHED row had region_name = null and
// the region filter read only that column; fixed in lotbi-core
// feature/festival-region-search-consistency-01-core). This script covers the
// Site half: one scope label shared by the banner and the 0건 message, and the
// exact query each scope sends, driven through the real site-festival-ui.js in
// headless Chromium (same tiny-server + --dump-dom convention as
// validate_festival_event_08_responsive_a11y_01.mjs).
//
// The mocked Core answers from the 2026-10-08 production rows with the
// province/시·군/time membership the fixed Core computed for them -- Core stays
// the authority; the mock only replays it.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(pathToFileURL(path.join(ROOT, 'site-festival-client.js')).href);
const ui = fs.readFileSync(path.join(ROOT, 'site-festival-ui.js'), 'utf8');

// ------------------------------------------------------------ pure contract --
const scope = client.festivalBrowseScopeLabel;
assert.equal(typeof scope, 'function', 'the banner and the 0건 message must share one production scope label');
assert.equal(scope({}), '전국');
assert.equal(scope({locationMode: 'NATIONWIDE'}), '전국');
assert.equal(scope({region: '전북특별자치도'}), '전북특별자치도 전체',
  'a province pick searches every 시·군 in it and must say so');
assert.equal(scope({region: '전북특별자치도', municipality: '임실군'}), '전북특별자치도 · 임실군');
assert.equal(scope({locationMode: 'CURRENT', currentRegionLabel: '전북특별자치도'}), '현재 위치 기준 · 전북특별자치도 전체',
  '"현재 위치 기준" is a whole-province search, not a radius around the user');
assert.equal(scope({region: '경기도', locationMode: 'CURRENT', currentRegionLabel: '전북특별자치도'}), '경기도 전체',
  'an explicit manual pick wins over stale current-location state, in the label as in the query');

const query = client.buildFestivalBrowseLocationQuery;
assert.deepEqual(query({locationMode: 'CURRENT', currentPosition: {latitude: 35.82, longitude: 127.15}, currentRegionLabel: '전북특별자치도'}),
  {latitude: 35.82, longitude: 127.15, region: '전북특별자치도'});
assert.deepEqual(query({region: '전북특별자치도'}), {region: '전북특별자치도'});
assert.deepEqual(query({region: '전북특별자치도', municipality: '임실군'}), {region: '전북특별자치도', municipality: '임실군'});
assert.deepEqual(query({locationMode: 'NATIONWIDE'}), {});

assert.match(ui, /label\.textContent = `📍 \$\{festivalBrowseScopeLabel\(state\)\}`/,
  'the banner must print the shared scope label');
assert.match(ui, /return `현재 조건에 맞는 축제·행사가 없어요 \(\$\{festivalBrowseScopeLabel\(state\)\}\)`/,
  'the 0건 message must name the same scope the banner shows');
assert.doesNotMatch(ui, /현재 위치 주변에/, '"주변" promises a radius search that does not exist');

// --------------------------------------------------------- live UI journey --
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for FESTIVAL-REGION-SEARCH-CONSISTENCY-01 render validation.');
}

// name, province, 시·군, times it is listed under on 2026-10-08 (from Core).
const ROWS = [
  ['fest_00000000000000000001', '2026 남도 K-가든 페스티벌', '전남광주통합특별시 여수시 문수로 124 (여서동)', '전라남도', '여수시', ['ONGOING', 'THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000002', '포천 한탄강 가든페스타', '경기도 포천시 관인면 창동로 832', '경기도', '포천시', ['ONGOING', 'THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000003', '감악산 꽃별 여행', '경상남도 거창군 신원면 연수사길 452', '경상남도', '거창군', ['ONGOING', 'THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000004', '궁중문화축전', '서울특별시 종로구 사직로 161 경복궁', '서울특별시', null, ['ONGOING', 'THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000005', '임실N치즈축제', '전북특별자치도 임실군 성수면 도인2길 50', '전북특별자치도', '임실군', ['ONGOING', 'THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000006', '제6회 전주거리인형극제', '전북특별자치도 전주시 완산구 은행로 65-8 (교동)', '전북특별자치도', '전주시', ['THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000007', '대전 중구 북페스티벌', '대전광역시 중구 중앙로 85 (선화동)', '대전광역시', null, ['THIS_WEEKEND', 'THIS_MONTH']],
  ['fest_00000000000000000008', '전주 국가유산야행', '전북특별자치도 전주시 완산구 태조로 44 (풍남동3가)', '전북특별자치도', '전주시', ['THIS_MONTH']],
];

function innerHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}</style>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
const ROWS = ${JSON.stringify(ROWS)};
const JEONBUK_MUNICIPALITIES = ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'];
const queries = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
window.fetch = async (url) => {
  const target = new URL(String(url));
  if (target.pathname === '/festivals/regions') {
    return json({regions: ['서울특별시','경기도','전북특별자치도','전라남도','제주특별자치도'].map(region_name => ({region_name}))});
  }
  const municipalities = /^\\/festivals\\/regions\\/([^/]+)\\/municipalities$/.exec(target.pathname);
  if (municipalities) {
    const province = decodeURIComponent(municipalities[1]);
    const list = province === '전북특별자치도' ? JEONBUK_MUNICIPALITIES : [];
    return json({province, municipalities: list.map(municipality_name => ({municipality_name}))});
  }
  if (target.pathname === '/festivals/browse') {
    const q = Object.fromEntries(target.searchParams.entries());
    queries.push(q);
    const rows = ROWS.filter(([, , , province, municipality, times]) =>
      times.includes(q.time)
      && (!q.region || province === q.region)
      && (!q.municipality || municipality === q.municipality));
    return json({
      festivals: rows.map(([festival_id, name, address, , municipality_name]) => ({
        festival_id, name, address, municipality_name, region_name: null,
        start_date: '20261001', end_date: '20261011', latitude: 35.6, longitude: 127.3,
        distance_km: q.latitude ? 23.4 : null, status: 'PUBLISHED', is_always_open: false,
      })),
      result_count: rows.length, total_count: rows.length, limit: 20, offset: 0, next_offset: null, has_more: false,
    });
  }
  return json({}, 404);
};
// GPS in 전주 with permission already granted: the screen opens on its own in
// "현재 위치 기준" without any prompt.
Object.defineProperty(navigator, 'permissions', {configurable: true, value: {query: async () => ({state: 'granted'})}});
Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
  getCurrentPosition: ok => setTimeout(() => ok({coords: {latitude: 35.8242, longitude: 127.148, accuracy: 30}, timestamp: Date.now()}), 0),
}});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label) {
  for (let i = 0; i < 200; i += 1) {
    const value = check();
    if (value) return value;
    await sleep(25);
  }
  throw new Error('timeout: ' + label);
}
const host = document.getElementById('host');
const banner = () => host.querySelector('.festival-location-label')?.textContent || '';
const cards = () => [...host.querySelectorAll('.festival-card-name')].map(node => node.textContent);
const settled = async () => {
  await waitFor(() => host.querySelector('.festival-status')?.hidden !== false, 'list settled');
  await sleep(40);
};
const snapshot = () => ({
  banner: banner(),
  cards: cards(),
  distances: [...host.querySelectorAll('.festival-card-distance')].length,
  empty: host.querySelector('.festival-empty')?.hidden ? '' : host.querySelector('.festival-empty')?.textContent,
  query: queries.at(-1),
});
const option = async text => waitFor(
  () => [...document.querySelectorAll('.festival-region-option')].find(node => node.textContent.trim() === text),
  'region option ' + text,
);
async function pickRegion(province, second) {
  [...host.querySelectorAll('.festival-location-actions button')].find(node => node.textContent.trim() === '지역 변경').click();
  (await option(province)).click();
  if (second) (await option(second)).click();
  await waitFor(() => !document.querySelector('.festival-region-option'), 'sheet closed');
  await settled();
}
const chip = label => [...host.querySelectorAll('.festival-time-row button')].find(node => node.textContent.trim() === label);

const result = {};
try {
  const {mountFestivalManager} = await import('/site-festival-ui.js');
  await mountFestivalManager({root: host, now: new Date('2026-10-08T03:00:00Z'), fetchImpl: window.fetch});
  await waitFor(() => banner().startsWith('📍 현재 위치 기준 ·'), 'current location banner');
  await settled();
  result.current = snapshot();

  await pickRegion('전북특별자치도', '전북특별자치도 전체');
  result.jeonbuk = {};
  for (const label of ['진행 중', '이번 주말', '이번 달']) {
    chip(label).click();
    await settled();
    result.jeonbuk[label] = snapshot();
  }
  chip('진행 중').click();
  await settled();

  await pickRegion('전북특별자치도', '임실군');
  result.imsil = snapshot();

  await pickRegion('전국');
  result.nationwide = snapshot();

  await pickRegion('제주특별자치도', '제주특별자치도 전체');
  result.jeju = snapshot();
} catch (error) {
  result.error = String(error && error.stack || error);
}
document.getElementById('render-result').textContent = JSON.stringify(result);
</script></body></html>`;
}

function outerHtml(innerName) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="fixture-frame" title="festival region search fixture" src="/${innerName}" style="display:block;width:390px;height:900px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const out = document.getElementById('render-result');
const deadline = Date.now() + 20000;
const poll = () => {
  const doc = frame.contentDocument;
  const raw = doc && doc.getElementById('render-result') ? doc.getElementById('render-result').textContent : '';
  if (raw && raw.trim()) { out.textContent = raw; return; }
  if (Date.now() > deadline) { out.textContent = JSON.stringify({error: 'inner fixture never rendered'}); return; }
  setTimeout(poll, 100);
};
poll();
</script></body></html>`;
}

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json'};
const innerName = `.festival-region-search-inner-${process.pid}.html`;
const outerName = `.festival-region-search-outer-${process.pid}.html`;
const pages = {[`/${innerName}`]: innerHtml(), [`/${outerName}`]: outerHtml(innerName)};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (pages[pathname]) {
    response.writeHead(200, {'Content-Type': TYPES['.html']});
    response.end(pages[pathname]);
    return;
  }
  const file = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const {port} = server.address();
let live;
try {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'festival-region-search-profile-'));
  try {
    const run = await new Promise((resolve, reject) => {
      // Asynchronous spawn: the static server above runs on this same event loop.
      import('node:child_process').then(({spawn}) => {
        const child = spawn(browserPath(), [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--user-data-dir=${profile}`,
          '--window-size=1200,1000', '--virtual-time-budget=15000', '--dump-dom',
          `http://127.0.0.1:${port}/${outerName}`,
        ]);
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill(), 90000);
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', status => { clearTimeout(timer); resolve({status, stdout, stderr}); });
      }, reject);
    });
    if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
    const match = run.stdout.match(/<pre id="render-result">([^<]*)<\/pre>/);
    if (!match || !match[1].trim()) throw new Error('festival region search render produced no result');
    live = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"'));
  } finally {
    try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
  }
} finally {
  server.close();
}
assert.equal(live.error, undefined, live.error);

// 현재 위치 기준 = the province the GPS reading is in, whole province, distances shown.
assert.equal(live.current.banner, '📍 현재 위치 기준 · 전북특별자치도 전체');
assert.equal(live.current.query.region, '전북특별자치도');
assert.ok(live.current.query.latitude && live.current.query.longitude, 'current location keeps its coordinates for card distance');
assert.equal(live.current.query.municipality, undefined);
assert.deepEqual(live.current.cards, ['임실N치즈축제'], 'the 진행 중 임실 축제 shown nationwide must also show for 현재 위치 기준 전북');
assert.equal(live.current.distances, 1);

// 전북 전체 across the three visible time filters.
const jeonbuk = live.jeonbuk;
for (const [label, time] of [['진행 중', 'ONGOING'], ['이번 주말', 'THIS_WEEKEND'], ['이번 달', 'THIS_MONTH']]) {
  assert.equal(jeonbuk[label].banner, '📍 전북특별자치도 전체', label);
  assert.equal(jeonbuk[label].query.time, time, label);
  assert.equal(jeonbuk[label].query.region, '전북특별자치도', label);
  assert.equal(jeonbuk[label].query.latitude, undefined, `${label}: a manual province pick must not carry stale GPS`);
  assert.equal(jeonbuk[label].query.municipality, undefined, label);
  assert.ok(jeonbuk[label].cards.includes('임실N치즈축제'), `${label}: 임실N치즈축제 must be listed for 전북`);
  assert.equal(new Set(jeonbuk[label].cards).size, jeonbuk[label].cards.length, `${label}: no duplicate cards`);
  assert.equal(jeonbuk[label].distances, 0, `${label}: no distance without a location scope`);
}
assert.deepEqual(jeonbuk['이번 주말'].cards, ['임실N치즈축제', '제6회 전주거리인형극제']);
assert.deepEqual(jeonbuk['이번 달'].cards, ['임실N치즈축제', '제6회 전주거리인형극제', '전주 국가유산야행']);

// 전북 -> 임실군 -> 전국.
assert.equal(live.imsil.banner, '📍 전북특별자치도 · 임실군');
assert.equal(live.imsil.query.region, '전북특별자치도');
assert.equal(live.imsil.query.municipality, '임실군');
assert.deepEqual(live.imsil.cards, ['임실N치즈축제']);

assert.equal(live.nationwide.banner, '📍 전국');
assert.equal(live.nationwide.query.region, undefined, '전국 must drop the previous province');
assert.equal(live.nationwide.query.municipality, undefined, '전국 must drop the previous 시·군');
assert.equal(live.nationwide.query.latitude, undefined);
assert.equal(live.nationwide.query.time, 'ONGOING');
assert.equal(live.nationwide.cards.length, 5);
assert.ok(live.nationwide.cards.includes('임실N치즈축제'));

// A real 0 names the scope that was searched.
assert.deepEqual(live.jeju.cards, []);
assert.equal(live.jeju.empty, '현재 조건에 맞는 축제·행사가 없어요 (제주특별자치도 전체)');

console.log('FESTIVAL REGION SEARCH CONSISTENCY VALIDATION PASS — 현재 위치 기준 전북 전체, 전북 전체(진행 중/이번 주말/이번 달), 전북→임실군→전국, 0건 안내 문구 확인');
