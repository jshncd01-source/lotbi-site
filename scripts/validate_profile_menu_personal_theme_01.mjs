// SITE-PROFILE-MENU-PERSONAL-THEME-01
//
// 대표 지시 4건을 잠그는 게이트. 프로필 메뉴는 여섯 항목 그대로이고, 바뀐 것은
// 두 번째 항목의 이름과, 그 창과 '설정' 이 하는 일뿐이다.
//
//   [1] '개인 맞춤 설정' → '개인테마' (항목은 없애지 않는다, 이름만 바꾼다)
//   [2] '개인테마' 창에는 테마 선택만 남는다 (대화 색상 글박스는 제거)
//   [3] '설정' 은 창을 띄우지 않고 계정 관리 페이지로 바로 나간다
//   [4] '프로필' 창의 '계정 페이지에서 관리' 버튼은 사라지고 '프로필 저장' 은 남는다
//
// [1][2][4] 와 항목 수·순서는 실제 Chromium 에서 렌더해 측정한다. [3] 은 소스
// 계약으로 잠근다 — 클릭하면 문서가 외부 출처로 나가버려서 같은 문서 안에서는
// 측정한 값을 되가져올 수 없다. 측정한 것과 소스로 잠근 것을 섞어 적지 않는다.
//
// 테마 전환 로직(savePreferences / applyPreferences) 자체는 이 게이트의 범위가
// 아니다. 여기서는 '개인테마' 창이 그 둘을 호출한 결과만 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const conversation = read('site-conversation.js');
const workflow = read('.github/workflows/site-review.yml');

const MENU_LABELS = ['프로필', '개인테마', '설정', '연결 서비스', '도움말', '로그아웃'];
// SITE-THEME-AUTO-SCHEDULE-02 — '자동모드' joined this list as a fourth
// *preference*. 대표's original four instructions named three, and the clock
// schedule ("18시 이후 다크, 07시 화이트") was a separate instruction; this is
// where the two meet. 기기모드 follows the device, 자동모드 follows the clock,
// and neither replaces the other — so all four stay locked here.
const THEME_OPTIONS = [['system', '기기모드'], ['light', '라이트모드'], ['dark', '다크모드'], ['auto', '자동모드']];
const ACCOUNT_MANAGE_URL = 'https://account.lotbiai.com/account';

// ── 소스 계약 ─────────────────────────────────────────────────────────────
assert.ok(
  workflow.includes('node scripts/validate_profile_menu_personal_theme_01.mjs'),
  'this gate must be wired into the Public Site Review Gate',
);

// [1] 이름만 바뀐다. 옛 이름은 남지 않는다.
assert.ok(
  conversation.includes("[['프로필', openProfile], ['개인테마', openPersonalTheme], ['설정', openSettings]]"),
  '프로필 메뉴의 앞 세 항목은 프로필 / 개인테마 / 설정 이어야 합니다',
);
assert.ok(
  !conversation.includes('개인 맞춤 설정') && !conversation.includes('openPersonalization'),
  "'개인 맞춤 설정' 은 '개인테마' 로 완전히 바뀌어야 합니다",
);
// 띄어쓴 '개인 테마' 는 대표가 쓴 표기가 아니다.
assert.ok(!conversation.includes('개인 테마'), "표기는 '개인테마' 입니다 — 띄어쓰지 않습니다");

// [2] 색상 글박스는 중복이라 제거됐고, 되돌아오지 않는다.
for (const removed of ['colorPicker', "'대화 색상'", "className = 'color-picker'"]) {
  assert.ok(!conversation.includes(removed), `대화 색상 선택은 제거되어야 합니다: ${removed}`);
}

// [3] 설정은 계정 관리 페이지로 바로 나간다. 중간 창이 없다.
assert.ok(
  conversation.includes(`const ACCOUNT_MANAGE_URL = '${ACCOUNT_MANAGE_URL}';`),
  '계정 관리 목적지는 이름 붙은 상수 하나여야 합니다',
);
assert.ok(
  conversation.includes('const openSettings = () => { window.location.assign(ACCOUNT_MANAGE_URL); };'),
  "'설정' 은 테마 창을 거치지 않고 계정 관리 페이지로 바로 이동해야 합니다",
);
// 델리게이트 핸들러(네이티브 webview 가 아직 쓸 수 있는 경로)도 같은 곳으로 간다.
assert.ok(
  conversation.includes("else if (action === 'settings') openSettings();"),
  'data-global-nav-action 핸들러는 같은 설정 동작을 유지해야 합니다',
);

// [4] 프로필 창에서 계정 관리 버튼만 빠지고, 저장 버튼은 남는다.
assert.ok(
  !conversation.includes('계정 페이지에서 관리'),
  "'계정 페이지에서 관리' 버튼은 프로필 창에서 제거되어야 합니다",
);
assert.ok(
  conversation.includes("save.textContent = '프로필 저장'") && conversation.includes("modalShell('프로필'"),
  "'프로필 저장' 버튼은 그대로 남아야 합니다",
);

// ── 런타임 측정 ───────────────────────────────────────────────────────────
const INNER_REL = 'scripts/.personal-theme-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.personal-theme-fixture.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4191;
const ORIGIN = 'http://127.0.0.1:' + PORT;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for profile menu runtime validation.');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-sidebar-nav.css"><link rel="stylesheet" href="/site-auth-continuity.css">
<link rel="stylesheet" href="/site-conversation.css"></head><body class="chat-home-page">
<main id="root"><div data-sidebar-account></div></main><pre id="theme-result">pending</pre>
<script type="module">
const root=document.getElementById('root'),out=document.getElementById('theme-result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<100;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const modal=()=>document.querySelector('.site-modal-backdrop .site-modal');
const items=()=>[...document.querySelectorAll('.profile-popover [role="menuitem"]')];
const openMenu=async()=>{click(document.querySelector('[data-profile-menu-trigger]'));await wait(()=>document.querySelector('.profile-popover'),'menu')};
const closeModal=async()=>{modal().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await wait(()=>!modal(),'modal close')};
window.fetch=async input=>{const u=String(typeof input==='string'?input:input?.url||'');
if(u.endsWith('/v2/me'))return new Response(JSON.stringify({user:{id:'usr',name:'홍길동',account_handle:'hong',email:'hong@example.com'},session:{id:'ses',assurance_level:'FULL',expires_at:'2099-01-01T00:00:00Z'},installation:{id:'install-theme-test'}}),{status:200,headers:{'Content-Type':'application/json'}});
if(u.endsWith('/v2/subscription'))return new Response(JSON.stringify({plan:'LOTBI_PLUS',status:'ACTIVE',entitled:true,free_units:3,used_free_units:1,remaining_free_units:2}),{status:200,headers:{'Content-Type':'application/json'}});
return new Response('{}',{status:500})};
try{
localStorage.clear();
const continuity=await import('/site-continuity.js?personal-theme=1');
const conversation=await import('/site-conversation.js?personal-theme=1');
continuity.markAnonymousAccountUi();
root.innerHTML='<aside class="chat-sidebar"><ul data-recent-conversations></ul><div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div></aside><main id="main-content" class="chat-home-shell" tabindex="-1"><div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div><div id="conversation-thread" class="conversation-thread" hidden></div><div class="chat-composer-stack"><div id="attachment-preview-strip" data-attachment-preview hidden></div><textarea id="lotbi-prompt" class="chat-input"></textarea><div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button><div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div><input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files"></div></div><div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden><button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div><button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div></main>';
document.body.dataset.siteAuthState='authenticated';
if(!conversation.mountConversation({sessionToken:'site-token',identityKey:'install-theme-test'}))throw new Error('mount');
await wait(()=>document.querySelector('.sidebar-account-name')?.textContent==='홍길동','identity');

// 항목 여섯 개, 순서 그대로, 막다른 길 없음
await openMenu();
const labels=items().map(n=>n.textContent);
const disabledItems=items().filter(n=>n.disabled).map(n=>n.textContent);
const popoverText=document.querySelector('.profile-popover').textContent;

// [1][2] 개인테마 창
const themeItem=items().find(n=>n.textContent==='개인테마');
if(!themeItem)throw new Error('개인테마 항목 없음');
click(themeItem);await wait(()=>modal(),'theme modal');
const themeTitle=modal().querySelector('h2').textContent;
const selects=[...modal().querySelectorAll('select')];
if(selects.length!==1)throw new Error('개인테마 창의 select 개수 '+selects.length);
const themeChoices=[...selects[0].options].map(o=>[o.value,o.textContent]);
const colorPickerPresent=Boolean(modal().querySelector('.color-picker'))||modal().textContent.includes('대화 색상');
const themeModalText=modal().textContent;
selects[0].value='dark';selects[0].dispatchEvent(new Event('change',{bubbles:true}));
await wait(()=>document.body.dataset.siteTheme==='dark','dark applied');
const themeApplied=document.body.dataset.siteTheme,themeBootstrap=document.documentElement.dataset.siteThemeBootstrap,themeStored=localStorage.getItem('lotbi.site.theme.bootstrap.v1');
await closeModal();

// [4] 프로필 창
await openMenu();
click(items().find(n=>n.textContent==='프로필'));await wait(()=>modal(),'profile modal');
const profileTitle=modal().querySelector('h2').textContent;
const profileButtons=[...modal().querySelectorAll('.site-modal-content button')].map(n=>n.textContent);
const profileLinks=[...modal().querySelectorAll('.site-modal-content a')].map(n=>n.getAttribute('href'));
const manageGone=!modal().textContent.includes('계정 페이지에서 관리');
await closeModal();

out.textContent=JSON.stringify({ok:true,viewport:{width:innerWidth,height:innerHeight,mobile:innerWidth<=900},
labels,disabledItems,deadEnd:popoverText.includes('준비 중'),
theme:{title:themeTitle,choices:themeChoices,colorPickerPresent,applied:themeApplied,bootstrap:themeBootstrap,stored:themeStored,deadEnd:themeModalText.includes('준비 중')},
profile:{title:profileTitle,buttons:profileButtons,links:profileLinks,manageGone}})
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 40; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="theme-result">pending</pre><script>const frame=document.getElementById('case-frame'),out=document.getElementById('theme-result');const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('theme-result');if(child&&child.textContent&&child.textContent!=='pending'){const v=JSON.parse(child.textContent),width=frame.contentWindow.innerWidth,height=frame.contentWindow.innerHeight;if(width!==${w}||height!==${h}){v.ok=false;v.error='iframe viewport '+width+'x'+height+' expected ${w}x${h}'}out.textContent=JSON.stringify(v);clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)});clearInterval(timer)}},20);setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},9000);<\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--virtual-time-budget=10000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 40000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="theme-result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(v.error);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const measured = [['desktop', run(browser, 1440, 900)], ['mobile', run(browser, 390, 844)]];
  for (const [surface, v] of measured) {
    // 여섯 개 그대로, 순서 그대로.
    assert.deepEqual(v.labels, MENU_LABELS, `${surface}: 프로필 메뉴는 여섯 항목이 이 순서여야 합니다`);
    // 막다른 길 금지 — 로그인된 상태에서는 누를 수 없는 항목이 없어야 한다.
    assert.deepEqual(v.disabledItems, [], `${surface}: 누를 수 없는 메뉴 항목이 있으면 안 됩니다`);
    assert.equal(v.deadEnd, false, `${surface}: 메뉴에 '준비 중' 표시가 있으면 안 됩니다`);

    // [1][2] 개인테마 창은 테마 선택만 가진다.
    assert.equal(v.theme.title, '개인테마', `${surface}: 창 제목은 개인테마 여야 합니다`);
    assert.deepEqual(v.theme.choices, THEME_OPTIONS, `${surface}: 다크·라이트·기기·자동 네 선택지여야 합니다`);
    assert.equal(v.theme.colorPickerPresent, false, `${surface}: 대화 색상 선택이 남아 있으면 안 됩니다`);
    assert.equal(v.theme.deadEnd, false, `${surface}: 개인테마 창에 '준비 중' 표시가 있으면 안 됩니다`);
    // 고른 테마가 실제로 문서와 저장소에 닿는지 — 창을 옮기면서 끊기지 않았는지.
    assert.equal(v.theme.applied, 'dark', `${surface}: 다크모드 선택이 문서에 적용되어야 합니다`);
    assert.equal(v.theme.bootstrap, 'dark', `${surface}: 첫 페인트용 속성도 함께 따라가야 합니다`);
    assert.equal(v.theme.stored, 'dark', `${surface}: 선택한 테마가 저장되어야 합니다`);

    // [4] 프로필 창은 저장 버튼만 남고 계정 관리 버튼은 없다.
    assert.equal(v.profile.title, '프로필', `${surface}: 프로필 창 제목`);
    assert.ok(v.profile.buttons.includes('프로필 저장'), `${surface}: '프로필 저장' 은 남아야 합니다`);
    assert.equal(v.profile.manageGone, true, `${surface}: '계정 페이지에서 관리' 는 사라져야 합니다`);
    assert.deepEqual(v.profile.links, [], `${surface}: 프로필 창에 계정 페이지로 나가는 링크가 남아 있으면 안 됩니다`);
  }
  for (const [surface, v] of measured) console.log('SITE-PROFILE-MENU-PERSONAL-THEME-01 ' + surface, JSON.stringify(v));
  console.log('SITE-PROFILE-MENU-PERSONAL-THEME-01 RUNTIME PASS');
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
