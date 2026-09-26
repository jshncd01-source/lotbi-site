// FESTIVAL-EVENT-08 — live-render evidence for the detail/program screen:
// real headless-Chromium checks (same convention as
// scripts/validate_pet_family_web_01.mjs / validate_sidebar_viewports_04.mjs
// — a tiny local http.server + `--dump-dom`, no npm/jsdom dependency) that
// this repo does not otherwise have for this feature. Exercises the ACTUAL
// site-festival-ui.js / site-festival-client.js modules with a mocked fetch
// shaped exactly like the real Core response (see
// app.festival_review.festival_public_view in lotbi-core).
//
// Covers: CTA visibility across the three reachable real-data shapes
// (0 programs -> no CTA row; programs but no reservation_url -> [프로그램]
// only; a program with a reservation_url -> both CTAs), the internal
// [프로그램] date-tab navigation (no external handoff), date-tab
// keyboard (ArrowRight) semantics, back navigation across all three
// surfaces, external-link security attributes, and 320/390/412/1280px
// layout with no horizontal overflow.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for FESTIVAL-EVENT-08 render validation.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Base date fixed at a known Thursday so the KST-weekday and "오늘 프로그램
// 있으면 오늘" selection-priority behavior are exercised deterministically
// rather than depending on the day this script happens to run.
const BASE = '2026-10-08'; // Thursday
function addDays(base, offset) {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
const D0 = BASE;
const D1 = addDays(BASE, 1);
const D2 = addDays(BASE, 2);

function innerFixtureHtml(scenario) {
  const programsByScenario = {
    both: [
      {program_name: '개막식', category: '공연', start_date: D0, start_time: '19:00', end_time: '21:00', venue: '중앙광장'},
      {program_name: '체험 부스', category: '체험', start_date: D0, end_date: D2, start_time: '10:00', end_time: '18:00', venue: '체험존', reservation_url: 'https://example.com/join'},
      {program_name: '먹거리 장터', category: '먹거리', start_date: D1, start_time: '11:00'},
    ],
    program_only: [
      {program_name: '개막식', category: '공연', start_date: D0, start_time: '19:00'},
    ],
    none: [],
  };
  const programs = JSON.stringify(programsByScenario[scenario] || []);

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}</style>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
function coreFestival() {
  return {
    festival_id: 'fest_demo', name: '가을 억새 축제', start_date: ${JSON.stringify(D0)}, end_date: ${JSON.stringify(D2)},
    region_name: '서울특별시', address: '서울특별시 영등포구 여의동로 330',
    latitude: 37.52, longitude: 126.93,
    homepage_url: 'https://official.example.com',
    telephone: '02-000-0000',
    status: 'PUBLISHED',
    programs: ${programs},
    transport: {parking: '유료 주차장 이용'},
    notices: [],
  };
}

window.fetch = async (url) => {
  const target = String(url);
  if (target.includes('/festivals/regions')) {
    return new Response(JSON.stringify({regions: [{region_name: '서울특별시'}]}), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  if (/\\/festivals\\/fest_demo$/.test(target)) {
    return new Response(JSON.stringify({festival: coreFestival()}), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  if (target.includes('/festivals/browse')) {
    const f = coreFestival();
    return new Response(JSON.stringify({
      festivals: [{
        festival_id: f.festival_id, name: f.name, start_date: f.start_date, end_date: f.end_date,
        region_name: f.region_name, address: f.address, latitude: f.latitude, longitude: f.longitude,
        distance_km: null, status: f.status,
      }],
      result_count: 1, total_count: 1, limit: 20, offset: 0, next_offset: null, has_more: false,
    }), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  if (target.includes('/festivals?')) {
    return new Response(JSON.stringify({festivals: [coreFestival()], result_count: 1}), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  return new Response('{}', {status: 404, headers: {'Content-Type': 'application/json'}});
};

const {mountFestivalManager} = await import('/site-festival-ui.js');
const host = document.getElementById('host');
await mountFestivalManager({root: host, now: new Date('2026-10-08T02:00:00Z'), fetchImpl: window.fetch});
await new Promise(resolve => setTimeout(resolve, 60));

const card = host.querySelector('.festival-card-open');
if (!card) throw new Error('festival card did not render');
card.click();
await new Promise(resolve => setTimeout(resolve, 60));

const detail = host.querySelector('.festival-detail-surface');
const ctaButtons = [...detail.querySelectorAll('.festival-cta-button')];
const ctaRowPresent = !!detail.querySelector('.festival-cta-row');
const programBtn = detail.querySelector('.festival-cta-program');
const participationLink = detail.querySelector('.festival-cta-participation');
const homepageButtonPresent = /공식\\s*홈페이지/.test(detail.textContent);
const legacySectionPresent = /예약\\s*안내|주차|셔틀|공식\\s*출처|CHECK_REQUIRED|ADVANCE|ONSITE/.test(detail.textContent);

let programResult = null;
if (programBtn) {
  programBtn.click();
  await new Promise(resolve => setTimeout(resolve, 60));
  const programSurface = host.querySelector('.festival-program-surface');
  const tabs = [...programSurface.querySelectorAll('.festival-date-tab')];
  const selectedBefore = tabs.find(t => t.getAttribute('aria-selected') === 'true');
  selectedBefore.focus();
  selectedBefore.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}));
  await new Promise(resolve => setTimeout(resolve, 60));
  const tabsAfter = [...programSurface.querySelectorAll('.festival-date-tab')];
  const selectedAfter = tabsAfter.find(t => t.getAttribute('aria-selected') === 'true');
  const panel = programSurface.querySelector('[role="tabpanel"]');
  programResult = {
    tabCount: tabs.length,
    tabDates: tabs.map(t => t.getAttribute('data-festival-program-date')),
    tabRoles: tabs.map(t => t.getAttribute('role')),
    tablistRole: programSurface.querySelector('[role="tablist"]')?.getAttribute('role') || null,
    selectedBeforeDate: selectedBefore.getAttribute('data-festival-program-date'),
    selectedAfterArrowDate: selectedAfter ? selectedAfter.getAttribute('data-festival-program-date') : null,
    focusedAfterArrowDate: document.activeElement ? document.activeElement.getAttribute('data-festival-program-date') : null,
    panelRole: panel ? panel.getAttribute('role') : null,
    panelItemCount: panel ? panel.querySelectorAll('.festival-program-item').length : 0,
  };
  const backToDetail = programSurface.querySelector('.festival-back-button');
  backToDetail.click();
  await new Promise(resolve => setTimeout(resolve, 40));
}

const detailVisibleAfterProgramBack = programBtn ? !host.querySelector('.festival-detail-surface').hidden : null;
const programHiddenAfterBack = programBtn ? host.querySelector('.festival-program-surface').hidden : null;

const backToList = host.querySelector('.festival-detail-surface .festival-back-button');
backToList.click();
await new Promise(resolve => setTimeout(resolve, 40));
const listVisibleAfterBack = !host.querySelector('.festival-list-surface').hidden;
const detailHiddenAfterListBack = host.querySelector('.festival-detail-surface').hidden;

document.getElementById('render-result').textContent = JSON.stringify({
  ctaRowPresent,
  ctaCount: ctaButtons.length,
  ctaClasses: ctaButtons.map(b => b.className),
  homepageButtonPresent,
  legacySectionPresent,
  participationHref: participationLink ? participationLink.getAttribute('href') : null,
  participationTarget: participationLink ? participationLink.getAttribute('target') : null,
  participationRel: participationLink ? participationLink.getAttribute('rel') : null,
  participationAriaLabel: participationLink ? participationLink.getAttribute('aria-label') : null,
  program: programResult,
  detailVisibleAfterProgramBack,
  programHiddenAfterBack,
  listVisibleAfterBack,
  detailHiddenAfterListBack,
  bodyScrollWidth: document.documentElement.scrollWidth,
  bodyClientWidth: document.documentElement.clientWidth,
});
</script></body></html>`;
}

function outerFixtureHtml(innerName, width, height) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="fixture-frame" title="FESTIVAL-EVENT-08 viewport fixture" src="/${innerName}" style="display:block;width:${width}px;height:${height}px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const out = document.getElementById('render-result');
const deadline = Date.now() + 15000;
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

async function render(scenario, width, height) {
  const port = await freePort();
  const innerName = `.festival-08-inner-${process.pid}-${scenario}-${width}.html`;
  const outerName = `.festival-08-outer-${process.pid}-${scenario}-${width}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerFixtureHtml(scenario), 'utf8');
  fs.writeFileSync(path.join(ROOT, outerName), outerFixtureHtml(innerName, width, height), 'utf8');
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/${outerName}`);
        if (probe.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const run = spawnSync(browserPath(), [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--window-size=1600,1100', '--virtual-time-budget=8000', '--dump-dom',
      `http://127.0.0.1:${port}/${outerName}`,
    ], {encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024});
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
    const match = run.stdout.match(/<pre id="render-result">([^<]*)<\/pre>/);
    if (!match || !match[1].trim()) throw new Error(`FESTIVAL-EVENT-08 render produced no result (${scenario} ${width}px)`);
    const parsed = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    if (parsed.error) throw new Error(`FESTIVAL-EVENT-08 render failed (${scenario} ${width}px): ${parsed.error}`);
    return parsed;
  } finally {
    server.kill();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    fs.rmSync(path.join(ROOT, outerName), {force: true});
  }
}

// ---------------------------------------------------- CTA visibility matrix
const both = await render('both', 390, 900);
assert.equal(both.ctaRowPresent, true);
assert.equal(both.ctaCount, 2, '프로그램 있음 + reservation_url 있는 프로그램 존재 -> 정확히 2개의 CTA');
assert.ok(both.ctaClasses.some(c => c.includes('festival-cta-program')));
assert.ok(both.ctaClasses.some(c => c.includes('festival-cta-participation')));
assert.equal(both.participationHref, 'https://example.com/join');
assert.equal(both.participationTarget, '_blank');
assert.equal(both.participationRel, 'noopener noreferrer');
assert.match(both.participationAriaLabel || '', /체험·신청/);
assert.match(both.participationAriaLabel || '', /새 창/);
assert.equal(both.homepageButtonPresent, false, 'homepage_url이 내려와도 소비자 화면에 공식 홈페이지 버튼이 없어야 한다');
assert.equal(both.legacySectionPresent, false, '예약안내/주차·셔틀/공식출처/내부 enum이 노출되면 안 된다');

const programOnly = await render('program_only', 390, 900);
assert.equal(programOnly.ctaRowPresent, true);
assert.equal(programOnly.ctaCount, 1, '프로그램은 있지만 reservation_url이 없으면 [프로그램]만');
assert.ok(programOnly.ctaClasses.some(c => c.includes('festival-cta-program')));
assert.equal(programOnly.ctaClasses.some(c => c.includes('festival-cta-participation')), false);

const none = await render('none', 390, 900);
assert.equal(none.ctaRowPresent, false, '프로그램도 참가 URL도 없으면 CTA row 자체가 없어야 한다(빈 칸 금지)');
assert.equal(none.ctaCount, 0);

// --------------------------------------------------- [프로그램] navigation --
const program = both.program;
assert.ok(program, '[프로그램] 클릭이 내부 program surface를 열어야 한다');
assert.equal(program.tabCount, 3, `${D0}~${D2} 3일 범위의 실제 프로그램 -> 정확히 3개의 날짜 탭`);
assert.deepEqual(program.tabDates, [D0, D1, D2]);
assert.ok(program.tabRoles.every(role => role === 'tab'));
assert.equal(program.tablistRole, 'tablist');
assert.equal(program.panelRole, 'tabpanel');
assert.equal(program.selectedBeforeDate, D0, '오늘(D0)에 프로그램이 있으므로 기본 선택은 오늘이어야 한다');
assert.equal(program.selectedAfterArrowDate, D1, 'ArrowRight는 다음 날짜 탭으로 이동해야 한다');
assert.equal(program.focusedAfterArrowDate, D1, 'ArrowRight 이후 포커스도 새 탭으로 이동해야 한다(키보드 접근성)');
assert.ok(program.panelItemCount >= 1);

// --------------------------------------------------------- back navigation --
assert.equal(both.detailVisibleAfterProgramBack, true, '프로그램 화면에서 뒤로가기는 상세 화면으로 돌아가야 한다');
assert.equal(both.programHiddenAfterBack, true);
assert.equal(both.listVisibleAfterBack, true, '상세 화면에서 뒤로가기는 목록으로 돌아가야 한다');
assert.equal(both.detailHiddenAfterListBack, true);

// -------------------------------------------------------------- responsive
for (const width of [320, 390, 412, 1280]) {
  const result = width === 390 ? both : await render('both', width, 900);
  assert.ok(result.bodyScrollWidth <= result.bodyClientWidth + 2,
    `${width}px: horizontal overflow ${result.bodyScrollWidth}px > ${result.bodyClientWidth}px`);
}

console.log('FESTIVAL-EVENT-08 RESPONSIVE/A11Y RENDER VALIDATION PASS — CTA visibility matrix (0/1/2), internal [프로그램] date-tab navigation with real tab/tablist/tabpanel roles, keyboard ArrowRight tab switch + focus, back navigation across all three surfaces, external-link security attributes, legacy-section/homepage-button absence, and 320/390/412/1280px layouts with no horizontal overflow — all verified against real headless-Chromium renders of the actual site-festival-ui.js/site-festival-client.js modules.');
