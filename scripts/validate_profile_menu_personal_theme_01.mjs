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
const index = read('index.html');
const assetVersion = JSON.parse(read('site-asset-version.json')).version;
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

// PROFILE-PHOTO-SOURCES-01 — LOTBI owns the three user-facing choices so
// Samsung's generic chooser cannot replace the requested wording with duplicate
// Files apps. Every path remains one decoded still image; only the explicit
// camera path carries capture=environment.
assert.ok(conversation.includes("['camera', '카메라'], ['gallery', '갤러리'], ['files', '내 파일']"), '카메라 / 갤러리 / 내 파일 세 경로가 정확히 있어야 합니다');
assert.ok(conversation.includes("input.accept = 'image/*'"), '모든 프로필 사진 input은 image/* 여야 합니다');
assert.ok(conversation.includes("if (source === 'camera') input.setAttribute('capture', 'environment')"), '카메라 경로만 후면 정지사진 capture를 요청해야 합니다');
assert.ok(conversation.includes('excludeAcceptAllOption: true'), '내 파일 경로도 임의 파일 전체 허용 옵션을 노출하면 안 됩니다');
assert.ok(!conversation.includes("input.accept = 'video/*'") && !conversation.includes('capture="camcorder"'), 'video/camcorder 계약은 없어야 합니다');
assert.ok(conversation.includes("mime.startsWith('image/')"), '선택 후에도 image MIME을 검증해야 합니다');
assert.ok(conversation.includes("mime === 'image/svg+xml'"), '실행 가능한 SVG는 프로필 사진으로 직접 저장하지 않습니다');
assert.ok(conversation.includes("'프로필에는 사진만 사용할 수 있어요.'"), 'video/non-image 거부 문구가 있어야 합니다');
assert.ok(index.includes(`site-conversation.js?v=${assetVersion}`), 'Production HTML은 현재 asset-set version의 프로필 picker JS를 사용해야 합니다');
assert.ok(conversation.includes(`/site-conversation.css?v=${assetVersion}`), '새 source menu CSS도 현재 asset-set version으로 cache-bust 되어야 합니다');

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
const profilePhotoInputs=[...modal().querySelectorAll('input[data-profile-photo-input]')];
if(profilePhotoInputs.length!==3)throw new Error('profile photo input count '+profilePhotoInputs.length);
const profilePhotoInputBySource=Object.fromEntries(profilePhotoInputs.map(input=>[input.dataset.profilePhotoInput,input]));
const profilePhotoPreview=modal().querySelector('.profile-photo-preview');
const profilePhotoError=modal().querySelector('.site-field-error');
const photoSourceMenu=modal().querySelector('.profile-photo-source-menu');
const photoTrigger=[...modal().querySelectorAll('button')].find(node=>node.textContent==='사진 선택');
const sourceLabels=[...photoSourceMenu.querySelectorAll('[data-profile-photo-source]')].map(node=>node.textContent);
const menuInitiallyHidden=photoSourceMenu.hidden;
click(photoTrigger);await wait(()=>!photoSourceMenu.hidden,'profile photo source menu');
const menuVisibleAfterTrigger=!photoSourceMenu.hidden&&photoTrigger.getAttribute('aria-expanded')==='true';
const setProfileFile=async(source,file)=>{
  const input=profilePhotoInputBySource[source];
  if(!(input instanceof HTMLInputElement))throw new Error('profile photo input missing '+source);
  const transfer=new DataTransfer();
  if(file)transfer.items.add(file);
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(100);
};
const pickerContract=Object.fromEntries(profilePhotoInputs.map(input=>[input.dataset.profilePhotoInput,{
  accept:input.accept,
  multiple:input.multiple,
  capture:input.getAttribute('capture'),
}]));

const storageSnapshot=()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]));
const beforeCancelStorage=JSON.stringify(storageSnapshot());
const beforeCancelPreview=profilePhotoPreview.style.backgroundImage;
await setProfileFile('gallery',null);
const initialCancelPreserved=beforeCancelStorage===JSON.stringify(storageSnapshot())&&beforeCancelPreview===profilePhotoPreview.style.backgroundImage;

await setProfileFile('gallery',new File([new Uint8Array([0,0,0,20,102,116,121,112])],'renamed-photo.jpg',{type:'video/mp4'}));
await wait(()=>profilePhotoError.textContent==='프로필에는 사진만 사용할 수 있어요.','video rejection');
const videoError=profilePhotoError.textContent;

await setProfileFile('files',new File([new Uint8Array([1,2,3,4,5,6,7,8])],'spoofed.jpg',{type:'image/jpeg'}));
await wait(()=>profilePhotoError.textContent==='이미지 파일을 읽지 못했습니다.','decode rejection');
const decodeError=profilePhotoError.textContent;

const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
await setProfileFile('camera',new File([png],'profile.png',{type:'image/png'}));
await wait(()=>profilePhotoPreview.style.backgroundImage.includes('data:image/webp'),'valid preview');
const validPreview=profilePhotoPreview.style.backgroundImage.includes('data:image/webp');
const storedPhoto=Object.values(storageSnapshot()).some(v=>String(v).includes('data:image/webp'));
const beforeFinalCancelStorage=JSON.stringify(storageSnapshot());
const beforeFinalCancelPreview=profilePhotoPreview.style.backgroundImage;
await setProfileFile('camera',null);
const finalCancelPreserved=beforeFinalCancelStorage===JSON.stringify(storageSnapshot())&&beforeFinalCancelPreview===profilePhotoPreview.style.backgroundImage;
await closeModal();

out.textContent=JSON.stringify({ok:true,viewport:{width:innerWidth,height:innerHeight,mobile:innerWidth<=900},
labels,disabledItems,deadEnd:popoverText.includes('준비 중'),
theme:{title:themeTitle,choices:themeChoices,colorPickerPresent,applied:themeApplied,bootstrap:themeBootstrap,stored:themeStored,deadEnd:themeModalText.includes('준비 중')},
profile:{title:profileTitle,buttons:profileButtons,links:profileLinks,manageGone,sourceLabels,menuInitiallyHidden,menuVisibleAfterTrigger,pickerContract,initialCancelPreserved,videoError,decodeError,validPreview,storedPhoto,finalCancelPreserved}})
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
    assert.deepEqual(v.profile.sourceLabels, ['카메라', '갤러리', '내 파일'], `${surface}: 사진 선택 메뉴는 카메라 / 갤러리 / 내 파일 순서여야 합니다`);
    assert.equal(v.profile.menuInitiallyHidden, true, `${surface}: source menu는 사진 선택을 누르기 전에는 닫혀 있어야 합니다`);
    assert.equal(v.profile.menuVisibleAfterTrigger, true, `${surface}: 사진 선택을 누르면 source menu가 열려야 합니다`);
    assert.deepEqual(v.profile.pickerContract.camera, {accept:'image/*',multiple:false,capture:'environment'}, `${surface}: 카메라는 한 장의 정지 이미지만 촬영해야 합니다`);
    assert.deepEqual(v.profile.pickerContract.gallery, {accept:'image/*',multiple:false,capture:null}, `${surface}: 갤러리는 한 장의 이미지만 선택해야 합니다`);
    assert.deepEqual(v.profile.pickerContract.files, {accept:'image/*',multiple:false,capture:null}, `${surface}: 내 파일은 이미지 한 장만 선택해야 합니다`);
    assert.equal(v.profile.initialCancelPreserved, true, `${surface}: 최초 picker 취소는 기존 상태를 유지해야 합니다`);
    assert.equal(v.profile.videoError, '프로필에는 사진만 사용할 수 있어요.', `${surface}: video MIME은 사진 전용 문구로 거부해야 합니다`);
    assert.equal(v.profile.decodeError, '이미지 파일을 읽지 못했습니다.', `${surface}: image MIME으로 위장한 비이미지 bytes도 decode 단계에서 거부해야 합니다`);
    assert.equal(v.profile.validPreview, true, `${surface}: 정상 사진은 즉시 원형 preview에 반영되어야 합니다`);
    assert.equal(v.profile.storedPhoto, true, `${surface}: 정상 사진은 기존 browser-local 저장 계약을 유지해야 합니다`);
    assert.equal(v.profile.finalCancelPreserved, true, `${surface}: 저장 후 picker 취소도 기존 사진을 유지해야 합니다`);
  }
  for (const [surface, v] of measured) console.log('SITE-PROFILE-MENU-PERSONAL-THEME-01 ' + surface, JSON.stringify(v));
  console.log('SITE-PROFILE-MENU-PERSONAL-THEME-01 RUNTIME PASS');
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
