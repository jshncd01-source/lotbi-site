// SOCIAL-SIGNUP-PROFILE-UX-01 — a new Kakao signup must land on a natural
// profile: "내 프로필" with a person icon and "카카오 계정으로 가입 · LOTBI Free",
// never "LOTBI 사용자" over a server-generated "@u...". A named account keeps
// its name, initials and chosen handle; an older Core without the marks keeps
// the old rendering. Checked at 320/360/390/430px and desktop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {getCurrentSiteUser} = await import('../site-core.js?social-signup-profile-ux-01=1');

const GENERATED = 'uabcdefghij2';
const session = {id: 'ses', assurance_level: 'FEDERATED_LIMITED', expires_at: '2099-01-01T00:00:00Z'};
const meResponse = user => async () => Response.json({user, session, installation: {id: 'install-profile-ux'}});

const federated = await getCurrentSiteUser('site-token', meResponse({
  id: 'usr-kakao', name: 'LOTBI 사용자', profile_photo: null, display_name_is_default: true, signup_provider: 'KAKAO',
}));
assert.equal(federated.name, '');
assert.equal(federated.publicHandle, '');
assert.equal(federated.signupProvider, 'KAKAO');
assert.equal('publicHandleGenerated' in federated, false);

const full = await getCurrentSiteUser('site-token', meResponse({
  id: 'usr-kakao', name: 'LOTBI 사용자', account_handle: GENERATED, public_handle: GENERATED, email: null,
  account_handle_is_synthetic: false, display_name_is_default: true, public_handle_is_generated: true, signup_provider: 'KAKAO',
}));
assert.equal(full.name, '');
// The handle stays (Account deletion confirms with it); it is only marked.
assert.equal(full.publicHandle, GENERATED);
assert.equal(full.publicHandleGenerated, true);

const named = await getCurrentSiteUser('site-token', meResponse({
  id: 'usr-named', name: '홍길동', public_handle: 'hong2026', display_name_is_default: false,
  public_handle_is_generated: false, signup_provider: 'KAKAO',
}));
assert.equal(named.name, '홍길동');
assert.equal('publicHandleGenerated' in named, false);

const unknownProvider = await getCurrentSiteUser('site-token', meResponse({
  id: 'usr-x', name: null, display_name_is_default: true, signup_provider: 'EXAMPLE',
}));
assert.equal('signupProvider' in unknownProvider, false);

// An older Core sends no marks: the identity keeps exactly its old fields.
const older = await getCurrentSiteUser('site-token', meResponse({id: 'usr-old', name: 'LOTBI 사용자', account_handle: GENERATED}));
assert.equal(older.name, 'LOTBI 사용자');
assert.equal(older.publicHandle, GENERATED);
assert.equal('publicHandleGenerated' in older || 'signupProvider' in older, false);

// The longest name Core accepts (display_name max_length=120, users.name String(120)).
// A 28-character name fitted the 360px summary under the Linux gate's narrower font and
// was never cut, so the ellipsis check could not run there; 120 characters overflow
// every width in any font, including the forced narrow-glyph stage below.
const LONG_NAME = '아주아주긴이름을가진LOTBI사용자입니다정말로길어요'.repeat(5).slice(0, 120);

const CASES = {
  kakaoLimited: {user: {id: 'usr-kakao', name: 'LOTBI 사용자', profile_photo: null, display_name_is_default: true, signup_provider: 'KAKAO'}, assurance: 'FEDERATED_LIMITED'},
  kakaoFull: {user: {id: 'usr-kakao', name: 'LOTBI 사용자', account_handle: GENERATED, public_handle: GENERATED, email: null, account_handle_is_synthetic: false, display_name_is_default: true, public_handle_is_generated: true, signup_provider: 'KAKAO', profile_photo: null}, assurance: 'FULL'},
  noProvider: {user: {id: 'usr-x', name: null, display_name_is_default: true, signup_provider: null, profile_photo: null}, assurance: 'FEDERATED_LIMITED'},
  named: {user: {id: 'usr-named', name: '홍길동', account_handle: GENERATED, public_handle: 'hong2026', email: null, display_name_is_default: false, public_handle_is_generated: false, signup_provider: 'KAKAO', profile_photo: null}, assurance: 'FULL'},
  longName: {user: {id: 'usr-long', name: LONG_NAME, display_name_is_default: false, signup_provider: 'NAVER', profile_photo: null}, assurance: 'FEDERATED_LIMITED'},
  olderCore: {user: {id: 'usr-old', name: 'LOTBI 사용자', account_handle: GENERATED, profile_photo: null}, assurance: 'FULL'},
};

const EXPECT = {
  kakaoLimited: {name: '내 프로필', icon: true, handle: '', summaryPlan: '카카오 계정으로 가입 · LOTBI Free', forbidden: ['LOTBI 사용자', '@u']},
  kakaoFull: {name: '내 프로필', icon: true, handle: '', summaryPlan: '카카오 계정으로 가입 · LOTBI Free', forbidden: ['LOTBI 사용자', GENERATED]},
  noProvider: {name: '내 프로필', icon: true, handle: '', summaryPlan: '현재 이용 등급 · LOTBI Free', forbidden: ['LOTBI 사용자', '계정으로 가입']},
  named: {name: '홍길동', icon: false, initials: '홍', handle: '@hong2026', summaryPlan: '현재 이용 등급 · LOTBI Free', forbidden: ['내 프로필', '계정으로 가입', GENERATED]},
  longName: {name: CASES.longName.user.name, icon: false, handle: '', summaryPlan: '현재 이용 등급 · LOTBI Free', forbidden: ['계정으로 가입']},
  olderCore: {name: 'LOTBI 사용자', icon: false, handle: '@' + GENERATED, summaryPlan: '현재 이용 등급 · LOTBI Free', forbidden: ['내 프로필']},
};

const INNER_REL = 'scripts/.social-signup-profile-ux-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.social-signup-profile-ux-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4193;
const ORIGIN = 'http://127.0.0.1:' + PORT;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The page shell (.chat-app-shell) gives the desktop sidebar its real 220px column;
// at 900px and below it is display:block, as on lotbiai.com.
const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-sidebar-nav.css"><link rel="stylesheet" href="/site-auth-continuity.css">
<link rel="stylesheet" href="/site-conversation.css"></head><body class="chat-home-page">
<main id="root"><div data-sidebar-account></div></main><pre id="profile-result">pending</pre>
<script type="module">
const out=document.getElementById('profile-result');
const params=new URLSearchParams(location.search),caseName=params.get('case'),glyphs=params.get('glyphs')||'default';
// Narrow-glyph stage: every profile text glyph 3px narrower, like the Linux gate's font
// (with it the old 28-character name was cut at 320px and fitted at 360px, as on the gate).
if(glyphs==='narrow'){const style=document.createElement('style');style.textContent='.sidebar-account-name,.sidebar-account-plan,.sidebar-account-handle,.profile-popover-summary-name,.profile-popover-summary-plan,.profile-popover-summary-handle,.profile-popover-summary-email{letter-spacing:-3px!important}';document.head.appendChild(style)}
const cases=${JSON.stringify(CASES)};
const current=cases[caseName];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<150;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const counts={me:0,subscription:0,other:0};
window.fetch=async input=>{const u=String(typeof input==='string'?input:input?.url||'');
if(u.endsWith('/v2/me')){counts.me+=1;return new Response(JSON.stringify({user:current.user,session:{id:'ses',assurance_level:current.assurance,expires_at:'2099-01-01T00:00:00Z'},installation:{id:'install-profile-ux'}}),{status:200,headers:{'Content-Type':'application/json'}})}
if(u.endsWith('/v2/subscription')){counts.subscription+=1;return new Response(JSON.stringify({plan:'FREE',status:'ACTIVE',entitled:false,free_units:3,used_free_units:0,remaining_free_units:3}),{status:200,headers:{'Content-Type':'application/json'}})}
counts.other+=1;return new Response('{}',{status:500})};
try{
localStorage.clear();
const conversation=await import('/site-conversation.js?social-signup-profile-ux=1');
document.getElementById('root').innerHTML='<div class="chat-app-shell"><aside class="chat-sidebar"><ul data-recent-conversations></ul><div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div></aside><main id="main-content" class="chat-home-shell" tabindex="0"><div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div><div id="conversation-thread" class="conversation-thread" hidden></div><div class="chat-composer-stack"><div id="attachment-preview-strip" data-attachment-preview hidden></div><textarea id="lotbi-prompt" class="chat-input"></textarea><div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button><div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진·스크린샷</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div><input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files"></div></div><div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden><button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div><button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div></main></div>';
document.body.dataset.siteAuthState='authenticated';
if(!conversation.mountConversation({sessionToken:'site-token',identityKey:'install-profile-ux'}))throw new Error('mount');
await wait(()=>counts.me===1&&counts.subscription===1&&document.querySelector('.sidebar-account-plan'),'identity+plan');
const trigger=document.querySelector('[data-profile-menu-trigger]');
const avatar=trigger.querySelector('.sidebar-profile-avatar');
const sidebar={name:trigger.querySelector('.sidebar-account-name')?.textContent||'',plan:trigger.querySelector('.sidebar-account-plan')?.textContent||'',handle:trigger.querySelector('.sidebar-account-handle')?.textContent||'',icon:Boolean(avatar?.querySelector('svg.sidebar-profile-avatar-icon')),avatarText:avatar?.textContent||'',label:trigger.getAttribute('aria-label')||''};
click(trigger);await wait(()=>document.querySelector('.profile-popover .profile-popover-summary'),'popover');
const pop=document.querySelector('.profile-popover'),summaryNode=pop.querySelector('.profile-popover-summary'),copy=summaryNode.querySelector('.profile-popover-summary-copy');
const summaryAvatar=summaryNode.querySelector('.sidebar-profile-avatar');
const nameNode=summaryNode.querySelector('.profile-popover-summary-name');
const summary={name:nameNode?.textContent||'',handle:summaryNode.querySelector('.profile-popover-summary-handle')?.textContent||'',email:summaryNode.querySelector('.profile-popover-summary-email')?.textContent||'',plan:summaryNode.querySelector('.profile-popover-summary-plan')?.textContent||'',icon:Boolean(summaryAvatar?.querySelector('svg.sidebar-profile-avatar-icon')),avatarText:summaryAvatar?.textContent||''};
const labels=[...pop.querySelectorAll('[role="menuitem"]')].map(n=>n.textContent).join('|');
const r=pop.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
const nameStyle=getComputedStyle(nameNode);
const triggerName=trigger.querySelector('.sidebar-account-name'),triggerNameStyle=getComputedStyle(triggerName);
const layout={popover:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width},viewport:{width:vw,height:vh},copyOverflow:copy.scrollWidth-copy.clientWidth,summaryOverflow:summaryNode.scrollWidth-summaryNode.clientWidth,nameEllipsis:nameStyle.textOverflow,nameWhiteSpace:nameStyle.whiteSpace,nameClipped:nameNode.scrollWidth>nameNode.clientWidth,nameScrollWidth:nameNode.scrollWidth,nameClientWidth:nameNode.clientWidth,letterSpacing:nameStyle.letterSpacing,triggerNameEllipsis:triggerNameStyle.textOverflow,triggerNameWhiteSpace:triggerNameStyle.whiteSpace,triggerNameClipped:triggerName.scrollWidth>triggerName.clientWidth,pageOverflow:document.documentElement.scrollWidth-vw,triggerOverflow:trigger.scrollWidth-trigger.clientWidth};
const text=document.body.innerText;
out.textContent=JSON.stringify({ok:true,caseName,viewport:{width:innerWidth,height:innerHeight},sidebar,summary,labels,layout,text,counts});
}catch(e){out.textContent=JSON.stringify({ok:false,caseName,error:String(e?.stack||e),counts})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const probe = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (probe.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(caseName, w, h, glyphs) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe id="case-frame" src="/${INNER_REL}?case=${caseName}&glyphs=${glyphs}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="profile-result">pending</pre><script>const frame=document.getElementById('case-frame'),out=document.getElementById('profile-result');const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('profile-result');if(child&&child.textContent&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)});clearInterval(timer)}},20);setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},9000);<\/script></body></html>`;
}

function run(browser, caseName, w, h, glyphs, attempt = 1) {
  try {
    return runOnce(browser, caseName, w, h, glyphs);
  } catch (error) {
    // The single local static server sometimes drops a module request between
    // two headless Chrome runs; that is the harness, not the page.
    if (attempt < 3 && /Failed to fetch dynamically imported module|result missing/.test(String(error))) {
      return run(browser, caseName, w, h, glyphs, attempt + 1);
    }
    throw error;
  }
}

function runOnce(browser, caseName, w, h, glyphs) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(caseName, w, h, glyphs), 'utf8');
  const result = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--virtual-time-budget=10000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 45000, maxBuffer: 12 * 1024 * 1024});
  if (result.error) throw result.error;
  const start = '<pre id="profile-result">', end = '</pre>', i = result.stdout.indexOf(start), j = result.stdout.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('result missing ' + caseName + ' ' + w + '\n' + result.stderr);
  const raw = result.stdout.slice(i + start.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const value = JSON.parse(raw);
  if (!value.ok) throw new Error(caseName + ' ' + w + ': ' + value.error);
  assert.equal(value.viewport.width, w, caseName + ' viewport');
  return value;
}

function check(caseName, w, glyphs, value) {
  const expected = EXPECT[caseName];
  const at = `${caseName}@${w}/${glyphs}`;
  assert.equal(value.sidebar.name, expected.name, at + ' sidebar name');
  assert.equal(value.summary.name, expected.name, at + ' summary name');
  assert.equal(value.sidebar.plan, 'LOTBI Free', at + ' sidebar plan');
  assert.equal(value.summary.plan, expected.summaryPlan, at + ' summary plan');
  assert.equal(value.sidebar.handle, expected.handle, at + ' sidebar handle');
  assert.equal(value.summary.handle, expected.handle, at + ' summary handle');
  assert.equal(value.sidebar.icon, expected.icon, at + ' sidebar icon');
  assert.equal(value.summary.icon, expected.icon, at + ' summary icon');
  if (expected.icon) {
    assert.equal(value.sidebar.avatarText, '', at + ' icon avatar has no letters');
    assert.equal(value.summary.avatarText, '', at + ' icon avatar has no letters');
  }
  if (expected.initials) assert.equal(value.sidebar.avatarText, expected.initials, at + ' initials');
  assert.equal(value.sidebar.label, `${expected.name} 계정 메뉴 열기`, at + ' aria label');
  assert.equal(value.labels, '프로필|개인테마|설정|연결 서비스|도움말|로그아웃', at + ' menu unchanged');
  for (const forbidden of expected.forbidden) assert.equal(value.text.includes(forbidden), false, `${at} shows ${forbidden}`);
  const {layout} = value;
  assert.ok(layout.popover.left >= -1 && layout.popover.right <= layout.viewport.width + 1, at + ' popover inside viewport ' + JSON.stringify(layout));
  assert.ok(layout.copyOverflow <= 1 && layout.summaryOverflow <= 1, at + ' summary overflow ' + JSON.stringify(layout));
  assert.ok(layout.pageOverflow <= 1, at + ' page overflow ' + JSON.stringify(layout));
  assert.equal(layout.nameEllipsis, 'ellipsis', at + ' long names end with an ellipsis');
  assert.equal(layout.nameWhiteSpace, 'nowrap', at + ' name stays on one line');
  assert.equal(layout.triggerNameEllipsis, 'ellipsis', at + ' sidebar name ends with an ellipsis');
  assert.equal(layout.triggerNameWhiteSpace, 'nowrap', at + ' sidebar name stays on one line');
  assert.ok(layout.triggerOverflow <= 1, at + ' sidebar trigger overflow ' + JSON.stringify(layout));
  // Whenever a name does not fit, it is cut on one line with an ellipsis (checked above).
  if (caseName === 'longName') {
    assert.ok(layout.nameClipped, `${at} the longest allowed name is cut in the summary ` + JSON.stringify(layout));
    assert.ok(layout.triggerNameClipped, `${at} the longest allowed name is cut in the sidebar ` + JSON.stringify(layout));
  }
  if (glyphs === 'narrow') assert.equal(layout.letterSpacing, '-3px', at + ' narrow-glyph stage applied');
  assert.equal(value.counts.other, 0, at + ' unexpected request');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const server = spawn(python, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const widths = [[320, 640], [360, 740], [390, 844], [430, 932], [1440, 900]];
  for (const caseName of Object.keys(CASES)) {
    const layoutCase = caseName === 'kakaoLimited' || caseName === 'longName';
    // Layout cases also run with narrow glyphs, so a narrower server font cannot hide an overflow.
    for (const glyphs of layoutCase ? ['default', 'narrow'] : ['default']) {
      for (const [w, h] of layoutCase ? widths : [[390, 844]]) {
        const value = run(browser, caseName, w, h, glyphs);
        check(caseName, w, glyphs, value);
        console.log('SOCIAL-SIGNUP-PROFILE-UX-01', caseName, w, glyphs, JSON.stringify({sidebar: {...value.sidebar, name: value.sidebar.name.slice(0, 24)}, summary: {...value.summary, name: value.summary.name.slice(0, 24)}, layout: value.layout}));
      }
    }
  }
  console.log('SOCIAL-SIGNUP-PROFILE-UX-01 PASS');
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
