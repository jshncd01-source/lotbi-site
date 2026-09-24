// SITE-THEME-AUTO-SCHEDULE-02
//
// 대표: "시간이 18시 이후에는 다크로 가고 아침 07시 되면 화이트로 가는 거"
//
// This is the clock schedule that #247 carried, lifted onto the 개인테마 window
// that #250 shipped. #247's menu restructure (프로필 수정 / 테마 선택 / 순서
// 변경 / 계정 페이지에서 관리 유지) was discarded — it contradicted 대표's four
// profile-menu instructions on every point. Only the schedule survived, so this
// gate locks the schedule and leaves the menu contract to
// validate_profile_menu_personal_theme_01.
//
// The thing that must never drift: '자동모드' is a *preference*. What reaches
// body[data-site-theme] and html[data-site-theme-bootstrap] is always one of the
// three states site-theme-tokens.css already paints, so the dark-theme
// stylesheet needs no fourth state and cannot be broken from here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const conversation = read('site-conversation.js');
const html = read('index.html');
const tokens = read('site-theme-tokens.css');
const workflow = read('.github/workflows/site-review.yml');

// ── 1. The schedule itself, run rather than read ──────────────────────────
const start = conversation.indexOf('const AUTO_THEME_DARK_HOUR');
const end = conversation.indexOf('// SITE-THEME-BOOTSTRAP-FIRST-PAINT-01', start);
assert.ok(start >= 0 && end > start, 'the theme schedule must remain independently testable');
const context = {Date};
vm.runInNewContext(
  `${conversation.slice(start, end)}\nthis.resolveScheduledTheme = resolveScheduledTheme;\nthis.millisecondsUntilNextThemeBoundary = millisecondsUntilNextThemeBoundary;`,
  context,
);
const {resolveScheduledTheme, millisecondsUntilNextThemeBoundary} = context;

const at = (hour, minute = 0) => new Date(2026, 8, 23, hour, minute, 0, 0);
// 18:00 is dark and 07:00 is light, inclusive on the hour itself — an exclusive
// boundary would leave 18:00–18:59 light on the day it matters.
for (const [hour, minute, expected] of [
  [0, 0, 'dark'], [6, 0, 'dark'], [6, 59, 'dark'],
  [7, 0, 'light'], [8, 0, 'light'], [12, 0, 'light'], [17, 59, 'light'],
  [18, 0, 'dark'], [21, 0, 'dark'], [23, 59, 'dark'],
]) {
  assert.equal(
    resolveScheduledTheme(at(hour, minute)), expected,
    `${hour}:${String(minute).padStart(2, '0')} 는 ${expected} 여야 합니다`,
  );
}

// A tab left open has to switch on its own, so the next boundary must be the
// next one — never yesterday's, and never a whole day away when it is hours off.
const hours = ms => ms / 3_600_000;
assert.equal(hours(millisecondsUntilNextThemeBoundary(at(3))), 4, '03시 다음 전환은 같은 날 07시');
assert.equal(hours(millisecondsUntilNextThemeBoundary(at(7))), 11, '07시 정각 다음 전환은 같은 날 18시');
assert.equal(hours(millisecondsUntilNextThemeBoundary(at(12))), 6, '12시 다음 전환은 같은 날 18시');
assert.equal(hours(millisecondsUntilNextThemeBoundary(at(18))), 13, '18시 정각 다음 전환은 다음 날 07시');
assert.equal(hours(millisecondsUntilNextThemeBoundary(at(23))), 8, '23시 다음 전환은 다음 날 07시');
for (let hour = 0; hour < 24; hour += 1) {
  for (const minute of [0, 1, 30, 59]) {
    const ms = millisecondsUntilNextThemeBoundary(at(hour, minute));
    assert.ok(ms > 0, `${hour}:${minute} 다음 전환은 항상 미래여야 합니다`);
    assert.ok(ms <= 24 * 3_600_000, `${hour}:${minute} 다음 전환이 하루를 넘겨서는 안 됩니다`);
  }
}

// ── 2. The pre-paint bootstrap resolves '자동모드' itself ──────────────────
// Storing an already-resolved value instead would go stale the moment the clock
// crosses a boundary, and the reader would get yesterday's theme on first paint.
const scriptOpen = html.indexOf('<script>', html.indexOf('SITE-THEME-BOOTSTRAP-FIRST-PAINT-01'));
const bootstrap = html.slice(scriptOpen, html.indexOf('</script>', scriptOpen));
assert.ok(bootstrap.includes("=== 'auto'"), 'the pre-paint bootstrap must resolve 자동모드 itself');
assert.match(bootstrap, /lotbiHour >= 18 \|\| lotbiHour < 7/, 'the pre-paint bootstrap must use the same boundaries');
assert.ok(!bootstrap.includes('setItem'), 'the pre-paint bootstrap must stay read-only');
// It resolves before the whitelist, so the attribute itself never says 'auto'.
assert.ok(
  bootstrap.indexOf("=== 'auto'") < bootstrap.indexOf("=== 'light'"),
  'the whitelist must run after the 자동모드 resolution, or the attribute is left unset',
);
// The deferred module copy has to agree with it.
assert.ok(
  conversation.includes("const savedTheme = stored === 'auto' ? resolveScheduledTheme() : stored;"),
  'the deferred module copy must resolve 자동모드 the same way',
);

// ── 3. The dark-theme stylesheet is untouched by this ─────────────────────
assert.ok(!/data-site-theme(-bootstrap)?="auto"/.test(tokens), 'no theme token may depend on an "auto" state');
const apply = conversation.slice(
  conversation.indexOf('const applyPreferences = () => {'),
  conversation.indexOf('const restoreAvatarHome'),
);
assert.ok(
  apply.includes("const resolvedTheme = storedTheme === 'auto' ? resolveScheduledTheme() : storedTheme;"),
  'what reaches the document must always be a state the tokens style',
);
assert.ok(apply.includes('scheduleThemeBoundary(storedTheme)'), 'an open tab must re-apply at the next boundary');
const timer = conversation.slice(
  conversation.indexOf('const scheduleThemeBoundary = storedTheme => {'),
  conversation.indexOf('const applyPreferences = () => {'),
);
assert.ok(timer.includes('clearTimeout(themeBoundaryTimer)'), 'the boundary timer must never be allowed to stack');
assert.ok(timer.includes("if (storedTheme !== 'auto'"), 'the boundary timer must only run while 자동모드 is selected');

// ── 4. 기기모드 and 자동모드 stay distinguishable ──────────────────────────
const options = conversation.slice(conversation.indexOf('const THEME_OPTIONS'), conversation.indexOf('const RESPONSE_GRADE_OPTIONS'));
for (const key of ['system', 'light', 'dark', 'auto']) {
  assert.ok(options.includes(`'${key}'`), `theme option ${key} must be offered`);
}
assert.ok(options.includes("'기기모드'") && options.includes("'자동모드'"), '기기모드 와 자동모드 는 둘 다 남아야 합니다');
const chooser = conversation.slice(
  conversation.indexOf('const openPersonalTheme = () => {'),
  conversation.indexOf('const openSettings = () =>'),
);
assert.ok(chooser.includes('for (const [value, label] of THEME_OPTIONS)'), '개인테마 창은 네 선택지를 모두 제공해야 합니다');
assert.ok(chooser.includes('themeHelp'), '기기모드 와 자동모드 의 차이는 말로 적혀 있어야 합니다');
// #250 removed the colour picker from this window; 자동모드 must not bring it back.
assert.ok(!chooser.includes('colorPicker()'), '개인테마 창에 대화 색상 선택이 돌아오면 안 됩니다');
assert.ok(workflow.includes('node scripts/validate_theme_auto_schedule_02.mjs'), 'this gate must run in CI');

// ── 5. The runtime, in a browser ──────────────────────────────────────────
const PORT = 4241;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const INNER_REL = 'scripts/.theme-auto-02-inner.html';
const INNER = path.join(ROOT, INNER_REL);

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const SKELETON = '<aside class="chat-sidebar"><ul data-recent-conversations></ul><div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div></aside>'
  + '<main id="main-content" class="chat-home-shell" tabindex="0"><div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div>'
  + '<div id="conversation-thread" class="conversation-thread" hidden></div><div class="chat-composer-stack"><div id="attachment-preview-strip" data-attachment-preview hidden></div>'
  + '<textarea id="lotbi-prompt" class="chat-input"></textarea><div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button>'
  + '<div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div>'
  + '<input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files"></div></div>'
  + '<div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden>'
  + '<button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div>'
  + '<button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div></main>';

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/site-sidebar-nav.css"><link rel="stylesheet" href="/site-conversation.css"></head>
<body class="chat-home-page"><main id="root"></main><pre id="theme-auto-result">pending</pre>
<script type="module">
const root=document.getElementById('root'),out=document.getElementById('theme-auto-result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<120;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
window.fetch=async()=>new Response('{}',{status:503});
const NS='install-theme-auto-02-test';
try{
const conversation=await import('/site-conversation.js?v=20260924-imagethumb1');
root.innerHTML=\`${SKELETON}\`;
localStorage.clear();sessionStorage.clear();
document.body.dataset.siteAuthState='authenticated';
if(!conversation.mountConversation({identityKey:NS}))throw new Error('mount failed');
await wait(()=>document.body.dataset.siteTheme,'first theme');
const trigger=document.querySelector('[data-profile-menu-trigger]');
click(trigger);await wait(()=>document.querySelector('.profile-popover'),'menu');
const items=[...document.querySelectorAll('.profile-popover [role="menuitem"]')];
const labels=items.map(n=>n.textContent);
click(items.find(n=>n.textContent==='개인테마'));
await wait(()=>document.querySelector('select'),'theme modal');
const select=document.querySelector('select');
const offered=[...select.options].map(o=>o.value);
const offeredLabels=[...select.options].map(o=>o.textContent);
select.value='auto';select.dispatchEvent(new Event('change',{bubbles:true}));
await wait(()=>document.body.dataset.siteThemePreference==='auto','auto applied');
const hour=new Date().getHours();
const expected=(hour>=18||hour<7)?'dark':'light';
const auto={preference:document.body.dataset.siteThemePreference,
  applied:document.body.dataset.siteTheme,
  bootstrap:document.documentElement.dataset.siteThemeBootstrap,
  stored:localStorage.getItem('lotbi.site.theme.bootstrap.v1'),
  expected,hour,
  themeColor:document.querySelector('meta[name="theme-color"]').getAttribute('content')};
select.value='dark';select.dispatchEvent(new Event('change',{bubbles:true}));
await wait(()=>document.body.dataset.siteTheme==='dark','dark applied');
const dark={preference:document.body.dataset.siteThemePreference,applied:document.body.dataset.siteTheme,stored:localStorage.getItem('lotbi.site.theme.bootstrap.v1')};
out.textContent=JSON.stringify({ok:true,report:{labels,offered,offeredLabels,auto,dark}});
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 40; i += 1) {
    if (spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000}).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
let report;
try {
  waitServer();
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1440,900', '--force-device-scale-factor=1', '--virtual-time-budget=9000', '--dump-dom',
    `${ORIGIN}/${INNER_REL}`], {encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="theme-auto-result">';
  const i = r.stdout.indexOf(a);
  const raw = r.stdout.slice(i + a.length, r.stdout.indexOf('</pre>', i))
    .replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${v.error}\n${r.stderr}`);
  report = v.report;
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
}

// The menu 대표 asked for is #250's and this must not have disturbed it.
assert.deepEqual(
  report.labels, ['프로필', '개인테마', '설정', '연결 서비스', '도움말', '로그아웃'],
  '메뉴는 대표가 지시한 여섯 항목 그대로여야 합니다',
);
assert.deepEqual(report.offered, ['system', 'light', 'dark', 'auto'], '개인테마 창은 네 가지를 모두 제공해야 합니다');
assert.deepEqual(report.offeredLabels, ['기기모드', '라이트모드', '다크모드', '자동모드'], '표기는 대표가 쓰신 대로여야 합니다');
// '자동모드' is stored as the preference, and what paints is the resolved state.
assert.equal(report.auto.preference, 'auto', '선택한 preference 는 자동으로 남아야 합니다');
assert.equal(report.auto.stored, 'auto', 'pre-paint 키에는 자동이 그대로 저장되어야 합니다 — 해석은 부팅 시점에');
assert.equal(report.auto.applied, report.auto.expected, `${report.auto.hour}시에는 ${report.auto.expected} 가 적용되어야 합니다`);
assert.equal(report.auto.bootstrap, report.auto.expected, 'html 의 bootstrap 속성도 해석된 값이어야 합니다');
assert.notEqual(report.auto.applied, 'auto', 'data-site-theme 에 auto 가 새어나가면 안 됩니다');
assert.equal(report.auto.themeColor, report.auto.expected === 'dark' ? '#151922' : '#ffffff', '브라우저 상단 색도 따라가야 합니다');
assert.equal(report.dark.preference, 'dark', '자동을 껐다면 preference 도 바뀌어야 합니다');
assert.equal(report.dark.stored, 'dark', '자동을 껐다면 pre-paint 키도 바뀌어야 합니다');

console.log('SITE-THEME-AUTO-SCHEDULE-02', JSON.stringify(report));
console.log('SITE-THEME-AUTO-SCHEDULE-02 OK — 자동모드는 시계를 따라갑니다');
