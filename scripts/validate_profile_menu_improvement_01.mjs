import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.profile-menu-runtime-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.profile-menu-runtime-fixture.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4187;
const ORIGIN = 'http://127.0.0.1:' + PORT;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-sidebar-nav.css"><link rel="stylesheet" href="/site-auth-continuity.css">
<link rel="stylesheet" href="/site-conversation.css"></head><body class="chat-home-page">
<main id="root"><div data-sidebar-account></div></main><pre id="profile-result">pending</pre>
<script type="module">
const root=document.getElementById('root'),out=document.getElementById('profile-result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<100;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const state=()=>JSON.parse(localStorage.getItem('lotbi.site.ux.v1.threads.install-profile-test')||'{}');
const counts={me:0,subscription:0,logout:0,accountLogout:0,other:0};
HTMLFormElement.prototype.requestSubmit=function(){
  const intent=this.querySelector('input[name="intent"]');
  if(this.method!=='post'||this.action!=='https://account.lotbiai.com/auth/site-logout'||intent?.value!=='logout')throw new Error('account logout handoff contract');
  const suppression=sessionStorage.getItem('lotbi.site-logout-suppression.v1');
  if(!suppression||!/^\\d+$/.test(suppression))throw new Error('logout suppression missing before account navigation');
  counts.accountLogout+=1;
};
let releaseSubscription;const subscriptionGate=new Promise(resolve=>{releaseSubscription=resolve});
window.fetch=async input=>{const u=String(typeof input==='string'?input:input?.url||'');
if(u.endsWith('/v2/me')){counts.me+=1;return new Response(JSON.stringify({user:{id:'usr',name:'홍길동',account_handle:'hong'},session:{id:'ses',assurance_level:'FULL',expires_at:'2099-01-01T00:00:00Z'},installation:{id:'install-profile-test'}}),{status:200,headers:{'Content-Type':'application/json'}})}
if(u.endsWith('/v2/subscription')){counts.subscription+=1;await subscriptionGate;return new Response(JSON.stringify({plan:'LOTBI_PLUS',status:'ACTIVE',entitled:true,free_units:3,used_free_units:1,remaining_free_units:2}),{status:200,headers:{'Content-Type':'application/json'}})}
if(u.endsWith('/v2/sessions/logout')){counts.logout+=1;return new Response(JSON.stringify({session_id:'ses',status:'REVOKED'}),{status:200,headers:{'Content-Type':'application/json'}})}
counts.other+=1;return new Response('{}',{status:500})};
try{
localStorage.clear();
const continuity=await import('/site-continuity.js?profile-test=1');
const conversation=await import('/site-conversation.js?v=20260920-messageux1');
continuity.markAnonymousAccountUi();
const anon=document.querySelector('[data-sidebar-account] a.sidebar-account-entry');
if(!(anon instanceof HTMLAnchorElement)||anon.getAttribute('href')!=='/auth/start/'||document.querySelector('[data-profile-menu-trigger]'))throw new Error('anonymous contract');
root.innerHTML='<aside class="chat-sidebar"><ul data-recent-conversations></ul><div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div></aside><main class="chat-home-shell"><div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div><div id="conversation-thread" class="conversation-thread" hidden></div><div class="chat-composer-stack"><div id="attachment-preview-strip" data-attachment-preview hidden></div><textarea id="lotbi-prompt" class="chat-input"></textarea><div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button><div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진·스크린샷</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div><input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files"></div></div><div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden><button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div><button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div></main>';
document.body.dataset.siteAuthState='authenticated';
if(!conversation.mountConversation({sessionToken:'site-token',identityKey:'install-profile-test'}))throw new Error('mount');
await wait(()=>document.querySelector('.sidebar-account-name')?.textContent==='홍길동','name');
await wait(()=>document.querySelector('.sidebar-account-handle')?.textContent==='@hong','handle');
await wait(()=>counts.subscription===1,'subscription');
const prompt=document.getElementById('lotbi-prompt'),send=document.querySelector('.send-button');
prompt.value='안녕';prompt.dispatchEvent(new Event('input',{bubbles:true}));click(send);
await wait(()=>state().threads?.[0]?.messages?.length===2,'conversation');
prompt.value='작성 중인 초안';prompt.dispatchEvent(new Event('input',{bubbles:true}));
const before=state(),url=location.href,id=before.activeThreadId,msgs=JSON.stringify(before.threads[0].messages);
let trigger=document.querySelector('[data-profile-menu-trigger]');
if(!(trigger instanceof HTMLButtonElement)||trigger.hasAttribute('href'))throw new Error('authenticated trigger');
click(trigger);await wait(()=>document.querySelector('.profile-popover'),'open');
if(document.querySelector('.profile-popover-summary-plan'))throw new Error('plan must not be fabricated before subscription response');
releaseSubscription();await wait(()=>document.querySelector('.profile-popover-summary-plan')?.textContent==='현재 이용 등급 · LOTBI Plus','late plan hydration');
if(location.href!==url||document.querySelector('.profile-popover-summary-name')?.textContent!=='홍길동'||document.querySelector('.profile-popover-summary-handle')?.textContent!=='@hong'||document.querySelector('.profile-popover-summary-plan')?.textContent!=='현재 이용 등급 · LOTBI Plus')throw new Error('profile summary/url');
const labels=[...document.querySelectorAll('.profile-popover [role="menuitem"]')].map(n=>n.textContent).join('|');
if(labels!=='프로필|개인 맞춤 설정|설정|도움말|로그아웃'||counts.logout!==0)throw new Error('menu/logout-before-click');
let after=state();if(after.activeThreadId!==id||after.draft!=='작성 중인 초안'||prompt.value!=='작성 중인 초안'||JSON.stringify(after.threads[0].messages)!==msgs)throw new Error('continuity open');
trigger=document.querySelector('[data-profile-menu-trigger]');click(trigger);await wait(()=>!document.querySelector('.profile-popover'),'toggle close');
trigger=document.querySelector('[data-profile-menu-trigger]');click(trigger);await wait(()=>document.querySelector('.profile-popover-layer'),'outside setup');click(document.querySelector('.profile-popover-layer'));await wait(()=>!document.querySelector('.profile-popover'),'outside close');
trigger=document.querySelector('[data-profile-menu-trigger]');click(trigger);await wait(()=>document.querySelector('.profile-popover'),'escape setup');document.querySelector('.profile-popover').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await wait(()=>!document.querySelector('.profile-popover'),'escape close');
const slot=document.querySelector('[data-sidebar-account]');slot.innerHTML='<a class="sidebar-account-entry" href="/auth/start/">로그인</a>';const stale=slot.querySelector('a'),ev=new MouseEvent('click',{bubbles:true,cancelable:true,view:window});stale.dispatchEvent(ev);
await wait(()=>slot.querySelector('[data-profile-menu-trigger]')&&document.querySelector('.profile-popover'),'self heal');
after=state();if(!ev.defaultPrevented||location.href!==url||after.activeThreadId!==id||after.draft!=='작성 중인 초안'||JSON.stringify(after.threads[0].messages)!==msgs||counts.logout!==0)throw new Error('stale self-heal continuity');
const measured=document.querySelector('.profile-popover').getBoundingClientRect(),layoutWidth=document.documentElement.clientWidth,layoutHeight=document.documentElement.clientHeight,mobile=innerWidth<=900,rect={width:measured.width,left:measured.left,right:measured.right,top:measured.top,bottom:measured.bottom},expectedWidth=mobile?Math.max(0,layoutWidth-20):264;if(rect.left<-1||rect.right>layoutWidth+1||rect.top<-1||rect.bottom>layoutHeight+1||Math.abs(rect.width-expectedWidth)>3)throw new Error('popover viewport/layout '+JSON.stringify({rect,expectedWidth,innerWidth,innerHeight,layoutWidth,layoutHeight,mobile}));
const logout=[...document.querySelectorAll('.profile-popover [role="menuitem"]')].find(n=>n.textContent==='로그아웃');click(logout);await wait(()=>counts.logout===1,'logout');await wait(()=>counts.accountLogout===1,'account logout handoff');await wait(()=>document.querySelector('[data-sidebar-account] a[href="/auth/start/"]'),'logout UI');
out.textContent=JSON.stringify({ok:true,viewport:{width:innerWidth,height:innerHeight,mobile},profile:{name:'홍길동',handle:'@hong',plan:'현재 이용 등급 · LOTBI Plus'},continuity:{urlUnchanged:location.href===url,threadId:id,draft:after.draft,messageCount:after.threads[0].messages.length},close:{toggle:true,outside:true,escape:true},selfHeal:true,counts,popover:{width:rect.width,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}})
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),counts})}
</script></body></html>`;

function waitServer(){for(let i=0;i<40;i+=1){const p=spawnSync('curl',['--fail','--silent',ORIGIN+'/'],{timeout:1000});if(p.status===0)return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100)}throw new Error('server start')}
function wrapperMarkup(w,h){return `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="profile-result">pending</pre><script>const frame=document.getElementById('case-frame'),out=document.getElementById('profile-result');const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('profile-result');if(child&&child.textContent&&child.textContent!=='pending'){const v=JSON.parse(child.textContent),width=frame.contentWindow.innerWidth,height=frame.contentWindow.innerHeight;if(width!==${w}||height!==${h}){v.ok=false;v.error='iframe viewport '+width+'x'+height+' expected ${w}x${h}'}out.textContent=JSON.stringify(v);clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)});clearInterval(timer)}},20);setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},7000);<\/script></body></html>`}
function run(browser,w,h){fs.writeFileSync(WRAPPER,wrapperMarkup(w,h),'utf8');const r=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--enable-logging=stderr','--v=1','--window-size=1600,1000','--force-device-scale-factor=1','--virtual-time-budget=8000','--dump-dom',ORIGIN+'/'+WRAPPER_REL],{encoding:'utf8',timeout:30000,maxBuffer:12*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw new Error('browser '+r.status+' '+r.stderr);const a='<pre id="profile-result">',b='</pre>',i=r.stdout.indexOf(a),j=r.stdout.indexOf(b,i);if(i<0||j<0)throw new Error('result missing');const raw=r.stdout.slice(i+a.length,j).replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');const v=JSON.parse(raw);if(!v.ok)throw new Error(v.error+'\n'+r.stderr);if(v.viewport.width!==w||v.viewport.height!==h)throw new Error('inner viewport '+v.viewport.width+'x'+v.viewport.height+' expected '+w+'x'+h);return v}

const browser=browserPath();fs.writeFileSync(INNER,fixture,'utf8');const server=spawn('python',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try{waitServer();const desktop=run(browser,1440,900),mobile=run(browser,390,844);for(const [label,v] of [['desktop',desktop],['mobile',mobile]]){if(v.counts.me!==1||v.counts.subscription!==1||v.counts.logout!==1||v.counts.accountLogout!==1||v.counts.other!==0)throw new Error(label+' request contract');if(!v.continuity.urlUnchanged||v.continuity.draft!=='작성 중인 초안'||v.continuity.messageCount!==2)throw new Error(label+' continuity')}if(desktop.viewport.mobile||!mobile.viewport.mobile)throw new Error('desktop/mobile media query');console.log('SITE-PROFILE-MENU-IMPROVEMENT-01 desktop',JSON.stringify(desktop));console.log('SITE-PROFILE-MENU-IMPROVEMENT-01 mobile',JSON.stringify(mobile));console.log('SITE-PROFILE-MENU-IMPROVEMENT-01 RUNTIME PASS')}finally{server.kill('SIGTERM');fs.rmSync(INNER,{force:true});fs.rmSync(WRAPPER,{force:true})}
