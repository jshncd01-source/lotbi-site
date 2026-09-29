// FESTIVAL-EVENT-08 — live-render evidence for the festival list card and the
// detail/program screen: real headless-Chromium checks (same convention as
// scripts/validate_pet_family_web_01.mjs / validate_sidebar_viewports_04.mjs
// — a tiny local http.server + `--dump-dom`, no npm/jsdom dependency) that
// this repo does not otherwise have for this feature. Exercises the ACTUAL
// site-festival-ui.js / site-festival-client.js modules with a mocked fetch
// shaped exactly like the real Core response (see
// app.festival_review.festival_public_view in lotbi-core).
//
// Two entry points now share the same internal program/registration surfaces:
//
// 1. The list card itself (the primary path — this is the chat festival
//    banner/card): its image/name link out to the festival's official
//    homepage in a new tab (no more internal detail navigation), and
//    [접수]/[프로그램]/네이버지도/카카오지도/TMAP are direct actions on the
//    card, in that exact order. [접수]/[프로그램] only render when Core's
//    has_registration/has_programs hints say there is something to show —
//    never a click into an empty popup. There is no calendar CTA on the card
//    any more: 전화/Google Maps were never here either — only the chat
//    answer's common calendar button (CHATPERF-08, site-conversation.js) is
//    used for festivals now. [접수]/[프로그램] still lazy-fetch the
//    festival's programs on click (browse items never carry the program
//    bodies themselves) and open the same internal surfaces the old detail
//    screen used.
// 2. Calendar re-entry (FESTIVAL-EVENT-10, `initialFestivalId`): still lands
//    on the detail screen's own CTA row (buildCtaRow, unrelated to and
//    untouched by the card's [접수]/[프로그램] gating above) and its own
//    [📅 일정 등록] month-grid picker, auto-opening the program surface when
//    there are programs — this surface is intentionally out of scope for the
//    card-only UX change above and is left exactly as FESTIVAL-EVENT-08/10
//    built it. It preserves the original CTA-visibility-matrix coverage
//    (0/1/2 CTAs) and the detail->program->list back-navigation chain.
//
// Covers: the list card's homepage link, its gated [접수]/[프로그램] actions,
// its final map-action order (네이버지도/카카오지도/TMAP, with window.open
// stubbed to capture map handoffs instead of really navigating), CTA
// visibility across the three reachable real-data shapes on Calendar
// re-entry, the internal [프로그램] date-tab navigation (no external
// handoff), date-tab keyboard (ArrowRight) semantics, back navigation across
// all three surfaces, external-link security attributes, and 320/390/412/
// 1280px layout with no horizontal overflow.
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

function programsFor(scenario) {
  const byScenario = {
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
  return byScenario[scenario] || [];
}

function sharedFixtureScript(scenario) {
  const programs = JSON.stringify(programsFor(scenario));
  return `
function coreFestival() {
  return {
    festival_id: 'fest_demo', name: '가을 억새 축제', start_date: ${JSON.stringify(D0)}, end_date: ${JSON.stringify(D2)},
    region_name: '서울특별시', address: '서울특별시 영등포구 여의동로 330',
    latitude: 37.52, longitude: 126.93,
    homepage_url: 'https://official.example.com/festival',
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
        distance_km: null, status: f.status, homepage_url: f.homepage_url,
        has_programs: f.programs.length > 0,
        has_registration: f.programs.some(p => Boolean(p.reservation_url)),
      }],
      result_count: 1, total_count: 1, limit: 20, offset: 0, next_offset: null, has_more: false,
    }), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  if (target.includes('/festivals?')) {
    return new Response(JSON.stringify({festivals: [coreFestival()], result_count: 1}), {status: 200, headers: {'Content-Type': 'application/json'}});
  }
  return new Response('{}', {status: 404, headers: {'Content-Type': 'application/json'}});
};
`;
}

// ----------------------------------- list-card [접수]/[프로그램] gating fixture
// Lightweight sibling of cardFixtureHtml(): only checks which action buttons
// render for a given programs scenario, using Core's own has_programs/
// has_registration hints -- never clicks anything, so it stays safe to use
// with a 'none' scenario where those buttons don't exist at all.
function cardGatingFixtureHtml(scenario) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}</style>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
${sharedFixtureScript(scenario)}
window.open = () => null;

const {mountFestivalManager} = await import('/site-festival-ui.js');
const host = document.getElementById('host');
await mountFestivalManager({root: host, now: new Date('2026-10-08T02:00:00Z'), fetchImpl: window.fetch});
await new Promise(resolve => setTimeout(resolve, 60));

const card = host.querySelector('.festival-card');
document.getElementById('render-result').textContent = JSON.stringify({
  registrationBtnPresent: !!card.querySelector('.festival-card-action-registration'),
  programBtnPresent: !!card.querySelector('.festival-card-action-program'),
  naverBtnPresent: !!card.querySelector('.festival-card-map-naver'),
  kakaoBtnPresent: !!card.querySelector('.festival-card-map-kakao'),
});
</script></body></html>`;
}

// ------------------------------------------------------- list-card fixture --
function cardFixtureHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}</style>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
${sharedFixtureScript('both')}

// Map handoffs each call window.open(uri, '_blank', 'noopener,noreferrer')
// synchronously — stub it to capture the call instead of really navigating.
const opened = [];
window.open = (uri, target, features) => { opened.push({uri, target, features}); return null; };

const {mountFestivalManager} = await import('/site-festival-ui.js');
const host = document.getElementById('host');
await mountFestivalManager({root: host, now: new Date('2026-10-08T02:00:00Z'), fetchImpl: window.fetch});
await new Promise(resolve => setTimeout(resolve, 60));

const card = host.querySelector('.festival-card');
if (!card) throw new Error('festival card did not render');
const media = card.querySelector('.festival-card-open');

// Final action order: [접수] [프로그램] 네이버지도 카카오지도 TMAP.
const actionOrder = [...card.querySelector('.festival-card-action-row').children]
  .flatMap(node => node.matches('button') ? [node.className] : [...node.querySelectorAll('button')].map(b => b.className));

const naverBtn = card.querySelector('.festival-card-map-naver');
naverBtn.click();
const naverCall = opened.at(-1);
opened.length = 0;

const kakaoBtn = card.querySelector('.festival-card-map-kakao');
kakaoBtn.click();
const kakaoCall = opened.at(-1);
opened.length = 0;

const tmapBtnPresent = !!card.querySelector('.festival-card-map-tmap');

// The card no longer carries its own [📅 일정 등록] CTA at all -- only the
// chat answer's common calendar button (CHATPERF-08, site-conversation.js)
// is used now.
const calendarTriggerPresent = !!card.querySelector('.festival-calendar-add-trigger');

const registrationBtn = card.querySelector('.festival-card-action-registration');
registrationBtn.click();
await new Promise(resolve => setTimeout(resolve, 80));
const sheet = document.querySelector('.lotbi-sheet');
const regLinks = sheet ? [...sheet.querySelectorAll('.festival-registration-link')] : [];
const registrationResult = {
  sheetOpen: !!sheet,
  linkCount: regLinks.length,
  hrefs: regLinks.map(a => a.getAttribute('href')),
  targets: regLinks.map(a => a.getAttribute('target')),
  rels: regLinks.map(a => a.getAttribute('rel')),
  titles: regLinks.map(a => a.textContent),
};
document.querySelector('.lotbi-sheet-dismiss')?.click();
await new Promise(resolve => setTimeout(resolve, 60));
registrationResult.sheetClosedAfterDismiss = !document.querySelector('.lotbi-sheet');

const programBtn = card.querySelector('.festival-card-action-program');
programBtn.click();
await new Promise(resolve => setTimeout(resolve, 80));
const programSurface = host.querySelector('.festival-program-surface');
const tabs = [...programSurface.querySelectorAll('.festival-date-tab')];
const programResult = {
  surfaceVisible: !programSurface.hidden,
  listHiddenWhileOpen: host.querySelector('.festival-list-surface').hidden,
  tabCount: tabs.length,
  tabDates: tabs.map(t => t.getAttribute('data-festival-program-date')),
};
programSurface.querySelector('.festival-back-button').click();
await new Promise(resolve => setTimeout(resolve, 60));
programResult.listVisibleAfterBack = !host.querySelector('.festival-list-surface').hidden;
programResult.backButtonLabel = programSurface.querySelector('.festival-back-button')?.textContent;

// FESTIVAL-EVENT-11 fix: the always-visible 〈 2026년 9월 〉 month navigator
// must snap back to the real current month when a quick-filter chip is
// picked -- not stay stuck on wherever a previous 다음/이전 달 tap left it.
// The month navigator and quick-filter chips live in the filter bar, a
// sibling of the card grid -- not inside the .festival-card element itself.
const monthNavLabel = host.querySelector('.festival-month-nav-label');
const monthNavNext = host.querySelector('.festival-month-nav-next');
const monthNavResult = {labelInitial: monthNavLabel.textContent};
monthNavNext.click();
await new Promise(resolve => setTimeout(resolve, 60));
monthNavResult.labelAfterNext = monthNavLabel.textContent; // expect 2026년 11월
const allChip = [...host.querySelectorAll('.festival-chip')].find(b => b.textContent === '전체');
allChip.click();
await new Promise(resolve => setTimeout(resolve, 60));
monthNavResult.labelAfterQuickFilter = monthNavLabel.textContent; // must reset to 2026년 10월, not stay at 11월
monthNavNext.click();
await new Promise(resolve => setTimeout(resolve, 60));
monthNavResult.labelAfterNextAgain = monthNavLabel.textContent; // must be 2026년 11월, not 2026년 12월

document.getElementById('render-result').textContent = JSON.stringify({
  mediaTag: media.tagName,
  mediaHref: media.getAttribute('href'),
  mediaTarget: media.getAttribute('target'),
  mediaRel: media.getAttribute('rel'),
  mediaAriaLabel: media.getAttribute('aria-label'),
  legacySectionPresent: /예약\\s*안내|주차|셔틀|공식\\s*출처|CHECK_REQUIRED|ADVANCE|ONSITE/.test(card.textContent),
  naverUri: naverCall ? naverCall.uri : null,
  naverTarget: naverCall ? naverCall.target : null,
  naverFeatures: naverCall ? naverCall.features : null,
  kakaoUri: kakaoCall ? kakaoCall.uri : null,
  tmapBtnPresent,
  calendarTriggerPresent,
  actionOrder,
  registration: registrationResult,
  program: programResult,
  monthNav: monthNavResult,
  bodyScrollWidth: document.documentElement.scrollWidth,
  bodyClientWidth: document.documentElement.clientWidth,
});
</script></body></html>`;
}

// -------------------------------------------------- Calendar re-entry fixture
function reentryFixtureHtml(scenario) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-festival.css" />
<style>html,body{margin:0} #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}</style>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
${sharedFixtureScript(scenario)}

const {mountFestivalManager} = await import('/site-festival-ui.js');
const host = document.getElementById('host');
await mountFestivalManager({root: host, now: new Date('2026-10-08T02:00:00Z'), fetchImpl: window.fetch, initialFestivalId: 'fest_demo'});
await new Promise(resolve => setTimeout(resolve, 80));

const detail = host.querySelector('.festival-detail-surface');
const ctaButtons = [...detail.querySelectorAll('.festival-cta-button')];
const ctaRowPresent = !!detail.querySelector('.festival-cta-row');
const homepageButtonPresent = /공식\\s*홈페이지/.test(detail.textContent);
const legacySectionPresent = /예약\\s*안내|주차|셔틀|공식\\s*출처|CHECK_REQUIRED|ADVANCE|ONSITE/.test(detail.textContent);

// Programs exist (both/program_only) -> FESTIVAL-EVENT-10 auto-open already
// landed on the program surface; none -> stays on the detail screen.
const programSurface = host.querySelector('.festival-program-surface');
const autoOpenedProgram = !programSurface.hidden;

let program = null;
if (autoOpenedProgram) {
  const tabs = [...programSurface.querySelectorAll('.festival-date-tab')];
  const selectedBefore = tabs.find(t => t.getAttribute('aria-selected') === 'true');
  selectedBefore.focus();
  selectedBefore.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}));
  await new Promise(resolve => setTimeout(resolve, 60));
  const tabsAfter = [...programSurface.querySelectorAll('.festival-date-tab')];
  const selectedAfter = tabsAfter.find(t => t.getAttribute('aria-selected') === 'true');
  const panel = programSurface.querySelector('[role="tabpanel"]');
  program = {
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
  programSurface.querySelector('.festival-back-button').click();
  await new Promise(resolve => setTimeout(resolve, 40));
}

const detailVisibleAfterProgramBack = autoOpenedProgram ? !host.querySelector('.festival-detail-surface').hidden : null;
const programHiddenAfterBack = autoOpenedProgram ? host.querySelector('.festival-program-surface').hidden : null;

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
  autoOpenedProgram,
  program,
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

async function render(innerHtml, {width, height, label}) {
  const port = await freePort();
  const innerName = `.festival-08-inner-${process.pid}-${label}-${width}.html`;
  const outerName = `.festival-08-outer-${process.pid}-${label}-${width}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerHtml, 'utf8');
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
    if (!match || !match[1].trim()) throw new Error(`FESTIVAL-EVENT-08 render produced no result (${label} ${width}px)`);
    const parsed = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    if (parsed.error) throw new Error(`FESTIVAL-EVENT-08 render failed (${label} ${width}px): ${parsed.error}`);
    return parsed;
  } finally {
    server.kill();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    fs.rmSync(path.join(ROOT, outerName), {force: true});
  }
}

// ================================================================ list card
const card = await render(cardFixtureHtml(), {width: 390, height: 900, label: 'card'});

assert.equal(card.mediaTag, 'A', 'a festival with homepage_url must render its card media as a real link, not a button');
assert.equal(card.mediaHref, 'https://official.example.com/festival');
assert.equal(card.mediaTarget, '_blank');
assert.equal(card.mediaRel, 'noopener noreferrer');
assert.match(card.mediaAriaLabel || '', /공식 홈페이지/);
assert.match(card.mediaAriaLabel || '', /새 창/);
assert.equal(card.legacySectionPresent, false, '예약안내/주차·셔틀/공식출처/내부 enum이 카드에 노출되면 안 된다');

// [LOTBI 챗 축제 배너 UX — FINAL] 최종 액션 순서: 접수 | 프로그램 | 네이버지도 |
// 카카오지도 | TMAP. 전화/Google Maps 버튼은 원래도 없었고 여기서도 추가하지
// 않는다 (repo 전체에 tel:/구글맵스 링크가 없다는 것은 별도 grep으로 확인됨).
assert.deepEqual(card.actionOrder, [
  'festival-card-icon-button festival-card-action-registration',
  'festival-card-icon-button festival-card-action-program',
  'festival-card-icon-button festival-card-map-naver',
  'festival-card-icon-button festival-card-map-kakao',
], '최종 액션 순서는 접수 → 프로그램 → 네이버지도 → 카카오지도 → (모바일이면) TMAP 이어야 한다');

assert.ok(card.naverUri, '네이버지도 버튼은 window.open을 호출해야 한다');
assert.equal(card.naverTarget, '_blank');
assert.equal(card.naverFeatures, 'noopener,noreferrer');
// Desktop NAVER handoff must carry the festival's full address, not a
// truncated "서울특별시 영등포구"-only fragment that can match the wrong place.
assert.match(
  decodeURIComponent(card.naverUri),
  /여의동로 330/u,
  '네이버지도 목적지에 축제 주소 전체(도로명+번지)가 포함되어야 한다',
);
assert.ok(
  card.kakaoUri && card.kakaoUri.startsWith('https://map.kakao.com/link/to/'),
  '카카오지도는 map.kakao.com 링크(실제 Kakao Map)로 열려야 한다 -- 카카오내비 SDK 핸드오프가 아니다',
);
// A verified coordinate routes Kakao Map directly to that destination -- the
// festival's actual lat/lng, not a re-derived or truncated value.
assert.match(card.kakaoUri, /37\.5200000/u);
assert.match(card.kakaoUri, /126\.9300000/u);
assert.match(decodeURIComponent(card.kakaoUri), /가을 억새 축제/u);
assert.equal(card.tmapBtnPresent, false, 'TMAP은 모바일 전용이므로 데스크톱 UA에서는 렌더되지 않아야 한다');
// The card no longer has its own [📅 일정 등록] CTA -- only the chat answer's
// common calendar button (CHATPERF-08) is used now.
assert.equal(card.calendarTriggerPresent, false, '카드에는 더 이상 별도 캘린더 CTA가 없어야 한다 (챗 공통 캘린더 버튼만 사용)');

assert.ok(card.registration, '[접수] 클릭이 접수 가능한 프로그램 팝업을 열어야 한다');
assert.equal(card.registration.sheetOpen, true);
assert.equal(card.registration.linkCount, 1, 'reservation_url이 있는 프로그램은 1개뿐이므로 접수 팝업 링크도 1개여야 한다');
assert.equal(card.registration.hrefs[0], 'https://example.com/join');
assert.equal(card.registration.targets[0], '_blank');
assert.equal(card.registration.rels[0], 'noopener noreferrer');
assert.match(card.registration.titles[0] || '', /체험 부스/);
assert.equal(card.registration.sheetClosedAfterDismiss, true);

assert.ok(card.program, '[프로그램] 클릭이 내부 program surface를 열어야 한다');
assert.equal(card.program.surfaceVisible, true);
assert.equal(card.program.listHiddenWhileOpen, true, '프로그램 화면이 열리는 동안 목록은 숨겨져야 한다');
assert.equal(card.program.tabCount, 3, `${D0}~${D2} 3일 범위의 실제 프로그램 -> 정확히 3개의 날짜 탭`);
assert.deepEqual(card.program.tabDates, [D0, D1, D2]);
assert.equal(card.program.listVisibleAfterBack, true, '카드에서 연 프로그램 화면의 뒤로가기는 상세화면이 아니라 목록으로 돌아가야 한다');
assert.equal(card.program.backButtonLabel, '← 목록으로');

// FESTIVAL-EVENT-11 fix: 〈 2026년 9월 〉 월별 탐색 must snap back to the real
// current month (2026-10-08 fixture -> 10월) when a quick-filter chip is
// picked, instead of staying stuck on a previously-navigated month.
assert.equal(card.monthNav.labelInitial, '2026년 10월');
assert.equal(card.monthNav.labelAfterNext, '2026년 11월', '다음 달 탭 한 번으로 11월로 이동해야 한다');
assert.equal(
  card.monthNav.labelAfterQuickFilter,
  '2026년 10월',
  '전체 칩을 고르면 월별 탐색이 실제 현재 달(10월)로 되돌아가야 한다 -- 11월에 멈춰 있으면 안 된다',
);
assert.equal(
  card.monthNav.labelAfterNextAgain,
  '2026년 11월',
  '되돌아간 10월에서 다시 다음 달을 누르면 11월이어야 한다 -- 자칫 12월로 건너뛰면 이전 상태가 남아있었다는 뜻이다',
);

assert.ok(card.bodyScrollWidth <= card.bodyClientWidth + 2, `390px: horizontal overflow ${card.bodyScrollWidth}px > ${card.bodyClientWidth}px`);

// ---------------------------------------- [접수]/[프로그램] hide-when-empty
// Real data, not "click then discover empty": has_registration/has_programs
// come straight from Core's browse hint (mirrored in sharedFixtureScript's
// mock), so the card must decide before ever rendering the button.
const gatingNone = await render(cardGatingFixtureHtml('none'), {width: 390, height: 900, label: 'gating-none'});
assert.equal(gatingNone.registrationBtnPresent, false, '프로그램이 하나도 없으면 접수 버튼 자체가 없어야 한다');
assert.equal(gatingNone.programBtnPresent, false, '프로그램이 하나도 없으면 프로그램 버튼 자체가 없어야 한다');
assert.equal(gatingNone.naverBtnPresent, true, '지도 버튼들은 프로그램 유무와 무관하게 항상 있어야 한다');
assert.equal(gatingNone.kakaoBtnPresent, true);

const gatingProgramOnly = await render(cardGatingFixtureHtml('program_only'), {width: 390, height: 900, label: 'gating-program-only'});
assert.equal(gatingProgramOnly.programBtnPresent, true, '프로그램이 있으면(접수 링크가 없어도) 프로그램 버튼은 있어야 한다');
assert.equal(gatingProgramOnly.registrationBtnPresent, false, '프로그램은 있어도 reservation_url이 있는 프로그램이 하나도 없으면 접수 버튼은 없어야 한다');

const gatingBoth = await render(cardGatingFixtureHtml('both'), {width: 390, height: 900, label: 'gating-both'});
assert.equal(gatingBoth.registrationBtnPresent, true, 'reservation_url이 있는 프로그램이 있으면 접수 버튼이 있어야 한다');
assert.equal(gatingBoth.programBtnPresent, true);

// ========================================================== Calendar re-entry
const both = await render(reentryFixtureHtml('both'), {width: 390, height: 900, label: 'reentry-both'});
assert.equal(both.ctaRowPresent, true);
assert.equal(both.ctaCount, 2, '프로그램 있음 + reservation_url 있는 프로그램 존재 -> 정확히 2개의 CTA');
assert.ok(both.ctaClasses.some(c => c.includes('festival-cta-program')));
assert.ok(both.ctaClasses.some(c => c.includes('festival-cta-registration')));
assert.equal(both.homepageButtonPresent, false, 'homepage_url이 내려와도 상세화면에 공식 홈페이지 버튼이 없어야 한다');
assert.equal(both.legacySectionPresent, false, '예약안내/주차·셔틀/공식출처/내부 enum이 노출되면 안 된다');
assert.equal(both.autoOpenedProgram, true, '프로그램이 있으면 Calendar 재진입 시 자동으로 프로그램 화면이 열려야 한다');

const program = both.program;
assert.ok(program, 'Calendar 재진입 시 프로그램 화면이 열려야 한다');
assert.equal(program.tabCount, 3, `${D0}~${D2} 3일 범위의 실제 프로그램 -> 정확히 3개의 날짜 탭`);
assert.deepEqual(program.tabDates, [D0, D1, D2]);
assert.ok(program.tabRoles.every(role => role === 'tab'));
assert.equal(program.tablistRole, 'tablist');
assert.equal(program.panelRole, 'tabpanel');
assert.equal(program.selectedBeforeDate, D0, '오늘(D0)에 프로그램이 있으므로 기본 선택은 오늘이어야 한다');
assert.equal(program.selectedAfterArrowDate, D1, 'ArrowRight는 다음 날짜 탭으로 이동해야 한다');
assert.equal(program.focusedAfterArrowDate, D1, 'ArrowRight 이후 포커스도 새 탭으로 이동해야 한다(키보드 접근성)');
assert.ok(program.panelItemCount >= 1);

assert.equal(both.detailVisibleAfterProgramBack, true, 'Calendar 재진입 경로의 프로그램 화면에서 뒤로가기는 상세 화면으로 돌아가야 한다');
assert.equal(both.programHiddenAfterBack, true);
assert.equal(both.listVisibleAfterBack, true, '상세 화면에서 뒤로가기는 목록으로 돌아가야 한다');
assert.equal(both.detailHiddenAfterListBack, true);

const programOnly = await render(reentryFixtureHtml('program_only'), {width: 390, height: 900, label: 'reentry-program-only'});
assert.equal(programOnly.ctaRowPresent, true);
assert.equal(programOnly.ctaCount, 1, '프로그램은 있지만 reservation_url이 없으면 [프로그램]만');
assert.ok(programOnly.ctaClasses.some(c => c.includes('festival-cta-program')));
assert.equal(programOnly.ctaClasses.some(c => c.includes('festival-cta-registration')), false);
assert.equal(programOnly.autoOpenedProgram, true);

const none = await render(reentryFixtureHtml('none'), {width: 390, height: 900, label: 'reentry-none'});
assert.equal(none.ctaRowPresent, false, '프로그램도 참가 URL도 없으면 CTA row 자체가 없어야 한다(빈 칸 금지)');
assert.equal(none.ctaCount, 0);
assert.equal(none.autoOpenedProgram, false, '프로그램이 없으면 자동으로 프로그램 화면을 열지 않아야 한다');

// -------------------------------------------------------------- responsive
for (const width of [320, 412, 1280]) {
  const result = await render(cardFixtureHtml(), {width, height: 900, label: `card-${width}`});
  assert.ok(result.bodyScrollWidth <= result.bodyClientWidth + 2,
    `${width}px: horizontal overflow ${result.bodyScrollWidth}px > ${result.bodyClientWidth}px`);
}

console.log('FESTIVAL-EVENT-08 RESPONSIVE/A11Y RENDER VALIDATION PASS — list card homepage link, gated [접수]/[프로그램] actions (has_registration/has_programs hints, never click-then-empty), final map action order [접수|프로그램|네이버지도|카카오지도|TMAP] with no card-level calendar/phone/Google Maps CTA (with map handoffs captured via a stubbed window.open), the month navigator\'s current-month reset on quick-filter change, the detail screen\'s own Calendar-re-entry [📅 일정 등록] month-grid picker (real cells, clamped prev/next navigation, 28 disabled out-of-range days, single-date select+confirm, success copy, and same-date dedupe) and CTA visibility matrix (0/1/2), internal [프로그램] date-tab navigation with real tab/tablist/tabpanel roles, keyboard ArrowRight tab switch + focus, back navigation across all three surfaces (card path returns to the list, re-entry path returns to the detail then the list), external-link security attributes, legacy-section/homepage-button absence inside the detail screen, and 320/390/412/1280px layouts with no horizontal overflow — all verified against real headless-Chromium renders of the actual site-festival-ui.js/site-festival-client.js modules.');
