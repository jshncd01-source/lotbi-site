import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'scripts/.calendar-identity-isolation.html';
const FIXTURE = path.join(ROOT, FIXTURE_REL);
const PORT = 4192;
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
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-calendar.css?v=20260920-calux1">
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<div id="stage"></div>
<pre id="result">pending</pre>
<script type="module">
import {mountLifeCalendarManager} from '/site-calendar-manager.js?v=20260920-calux1';
import {createGuestCalendarRepository} from '/site-calendar-guest.js?v=20260920-calux1';

const stage=document.getElementById('stage');
const out=document.getElementById('result');
const fixedNow=new Date('2026-09-20T04:00:00.000Z');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(fn,label)=>{for(let i=0;i<120;i+=1){const value=fn();if(value)return value;await sleep(20)}throw new Error('timeout '+label)};
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const makeRoot=id=>{const root=document.createElement('section');root.id=id;stage.appendChild(root);return root};
const selectedDate=root=>root.querySelector('.calendar-date-cell[data-selected="true"]')?.dataset.calendarDate||null;
const has=root,text=>root.textContent.includes(text);
const jsonResponse=body=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});

const guestRepo=createGuestCalendarRepository(localStorage,{
  uuid:()=> '00000000-0000-4000-8000-000000000001',
  now:()=>fixedNow,
});
guestRepo.create({
  title:'GUEST-ONLY',
  local_date:'2026-09-15',
  local_datetime:'2026-09-15T09:00:00',
  all_day:false,
});

const itemA={
  projection_id:'projection_A',
  activity_id:'activity_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  occurrence_id:'occurrence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  title:'AUTH-A-ONLY',
  activity_revision:1,
  occurrence_revision:1,
  local_date:'2026-09-21',
  local_datetime:'2026-09-21T10:00:00',
  temporal_kind:'LOCAL_DATE_TIME',
  temporal_semantics:'USER_PLANNED_TIME',
  busy:'UNKNOWN',
  confirmation_level:'USER_ATTESTED',
  provider_verified:false,
  source_kind:'USER_INPUT',
  allowed_actions:['UPDATE','REMOVE'],
};
const itemB={
  projection_id:'projection_B',
  activity_id:'activity_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  occurrence_id:'occurrence_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  title:'AUTH-B-ONLY',
  activity_revision:1,
  occurrence_revision:1,
  local_date:'2026-09-22',
  local_datetime:'2026-09-22T11:00:00',
  temporal_kind:'LOCAL_DATE_TIME',
  temporal_semantics:'USER_PLANNED_TIME',
  busy:'UNKNOWN',
  confirmation_level:'USER_ATTESTED',
  provider_verified:false,
  source_kind:'USER_INPUT',
  allowed_actions:['UPDATE','REMOVE'],
};

const payloadFor=(url,token)=>{
  const pathname=new URL(url).pathname;
  if(pathname==='/v2/life/agenda'){
    return {
      view:'AGENDA',
      as_of:'2026-09-20T04:00:00Z',
      timezone:'Asia/Seoul',
      coverage:'PERSONAL_ACTIVITY_ONLY',
      items:[token==='token-A'?itemA:itemB],
      ai_calls:0,
      provider_api_calls:0,
    };
  }
  if(pathname==='/v2/life/attention'){
    return {
      view:'ATTENTION',
      as_of:'2026-09-20T04:00:00Z',
      timezone:'Asia/Seoul',
      coverage:'PERSONAL_ACTIVITY_ONLY',
      items:[],
      ai_calls:0,
      provider_api_calls:0,
    };
  }
  throw new Error('unexpected path '+pathname);
};

let delayARefresh=false;
const pendingA=[];
const fetchImpl=async(url,init={})=>{
  const auth=init.headers?.Authorization||'';
  const token=auth==='Bearer token-A'?'token-A':auth==='Bearer token-B'?'token-B':'';
  if(!token)throw new Error('unexpected auth '+auth);
  const payload=payloadFor(url,token);
  if(token==='token-A'&&delayARefresh){
    return new Promise(resolve=>pendingA.push({resolve,payload}));
  }
  return jsonResponse(payload);
};

try{
  localStorage.removeItem('lotbi.guest.calendar.v1');

  const guestStorageRepo=createGuestCalendarRepository(localStorage,{
    uuid:()=> '00000000-0000-4000-8000-000000000001',
    now:()=>fixedNow,
  });
  guestStorageRepo.create({
    title:'GUEST-ONLY',
    local_date:'2026-09-15',
    local_datetime:'2026-09-15T09:00:00',
    all_day:false,
  });

  const guest1=makeRoot('guest-1');
  await mountLifeCalendarManager({
    root:guest1,
    timezone:'Asia/Seoul',
    now:fixedNow,
    guestRepository:guestStorageRepo,
  });
  assert(guest1.dataset.calendarAccess==='guest','Guest 1 access mode');
  assert(has(guest1,'GUEST-ONLY'),'Guest 1 event missing');
  assert(selectedDate(guest1)==='2026-09-20','Guest 1 initial selected date');
  click(guest1.querySelector('[data-calendar-date-trigger="2026-09-15"]'));
  await wait(()=>selectedDate(guest1)==='2026-09-15','Guest 1 date selection');
  await wait(()=>guest1.querySelector('.calendar-add-button'),'Guest 1 add button');
  click(guest1.querySelector('.calendar-add-button'));
  await wait(()=>guest1.querySelector('.calendar-editor-title'),'Guest 1 editor');
  guest1.querySelector('.calendar-editor-title').value='GUEST-DRAFT-NOT-SAVED';
  guest1.querySelector('.calendar-editor-title').dispatchEvent(new Event('input',{bubbles:true}));
  assert(guest1.textContent.includes('GUEST-DRAFT-NOT-SAVED')===false,'Draft must remain input-only');
  guest1.remove();

  const authA=makeRoot('auth-a');
  await mountLifeCalendarManager({
    sessionToken:'token-A',
    root:authA,
    timezone:'Asia/Seoul',
    now:fixedNow,
    fetchImpl,
  });
  assert(authA.dataset.calendarAccess==='authenticated','Auth A access mode');
  assert(has(authA,'AUTH-A-ONLY'),'Auth A event missing');
  assert(!has(authA,'GUEST-ONLY'),'Guest data leaked into Auth A');
  assert(!authA.querySelector('.calendar-editor-dialog'),'Guest editor leaked into Auth A');
  assert(!authA.querySelector('input')?.value?.includes('GUEST-DRAFT-NOT-SAVED'),'Guest draft leaked into Auth A');
  assert(selectedDate(authA)==='2026-09-20','Auth A selected date leaked from Guest');

  click(authA.querySelector('[data-calendar-date-trigger="2026-09-18"]'));
  await wait(()=>selectedDate(authA)==='2026-09-18','Auth A date selection');
  await wait(()=>authA.querySelector('.calendar-add-button'),'Auth A add button');
  click(authA.querySelector('.calendar-add-button'));
  await wait(()=>authA.querySelector('.calendar-editor-title'),'Auth A editor');
  authA.querySelector('.calendar-editor-title').value='AUTH-A-DRAFT-NOT-SAVED';
  authA.querySelector('.calendar-editor-title').dispatchEvent(new Event('input',{bubbles:true}));

  delayARefresh=true;
  window.dispatchEvent(new CustomEvent('lotbi:life-calendar-refresh'));
  await wait(()=>pendingA.length===2,'Auth A delayed refresh requests');
  authA.remove();

  const guest2=makeRoot('guest-2');
  await mountLifeCalendarManager({
    root:guest2,
    timezone:'Asia/Seoul',
    now:fixedNow,
    guestRepository:guestStorageRepo,
  });
  assert(guest2.dataset.calendarAccess==='guest','Guest 2 access mode');
  assert(has(guest2,'GUEST-ONLY'),'Guest data did not survive logout return');
  assert(!has(guest2,'AUTH-A-ONLY'),'Auth A data leaked into Guest 2');
  assert(!guest2.querySelector('.calendar-editor-dialog'),'Auth A editor leaked into Guest 2');
  assert(selectedDate(guest2)==='2026-09-20','Auth A selected date leaked into Guest 2');
  guest2.remove();

  const authB=makeRoot('auth-b');
  await mountLifeCalendarManager({
    sessionToken:'token-B',
    root:authB,
    timezone:'Asia/Seoul',
    now:fixedNow,
    fetchImpl,
  });
  assert(authB.dataset.calendarAccess==='authenticated','Auth B access mode');
  assert(has(authB,'AUTH-B-ONLY'),'Auth B event missing');
  assert(!has(authB,'AUTH-A-ONLY'),'Auth A data leaked into Auth B');
  assert(!has(authB,'GUEST-ONLY'),'Guest data leaked into Auth B');
  assert(!authB.querySelector('.calendar-editor-dialog'),'Prior editor leaked into Auth B');
  assert(selectedDate(authB)==='2026-09-20','Prior selected date leaked into Auth B');

  delayARefresh=false;
  for(const pending of pendingA)pending.resolve(jsonResponse(pending.payload));
  await sleep(120);

  assert(has(authB,'AUTH-B-ONLY'),'Auth B event disappeared after delayed A response');
  assert(!has(authB,'AUTH-A-ONLY'),'Delayed Auth A response leaked into Auth B');
  assert(!has(authB,'GUEST-ONLY'),'Guest data appeared in Auth B after delayed A response');
  assert(selectedDate(authB)==='2026-09-20','Delayed Auth A response changed Auth B selected date');

  const storedGuest=JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1')||'{"events":[]}');
  assert(storedGuest.events.length===1&&storedGuest.events[0].title==='GUEST-ONLY','Auth transitions mutated Guest local data');

  out.textContent=JSON.stringify({
    ok:true,
    guest1:{selected:'2026-09-15',draft:'isolated'},
    authA:{event:'AUTH-A-ONLY',selected:'2026-09-18',delayedRequests:pendingA.length},
    guest2:{event:'GUEST-ONLY',selected:selectedDate(guest2)||'detached-reset'},
    authB:{event:'AUTH-B-ONLY',selected:selectedDate(authB),lateAContained:true},
    guestStorage:{eventCount:storedGuest.events.length,title:storedGuest.events[0].title},
  });
}catch(error){
  out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)});
}
</script></body></html>`;

function waitServer(){
  for(let i=0;i<50;i+=1){
    const p=spawnSync('curl',['--fail','--silent',ORIGIN+'/'],{timeout:1000});
    if(p.status===0)return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  throw new Error('server start');
}

function decodeHtml(value){
  return value.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
}

const browser=browserPath();
fs.writeFileSync(FIXTURE,fixture,'utf8');
const server=spawn('python',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try{
  waitServer();
  const run=spawnSync(browser,[
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1280,900',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=9000',
    '--dump-dom',
    ORIGIN+'/'+FIXTURE_REL,
  ],{encoding:'utf8',timeout:35000,maxBuffer:12*1024*1024});
  if(run.error)throw run.error;
  if(run.status!==0)throw new Error('browser '+run.status+' '+run.stderr);
  const start='<pre id="result">';
  const end='</pre>';
  const i=run.stdout.indexOf(start);
  const j=run.stdout.indexOf(end,i);
  if(i<0||j<0)throw new Error('identity result missing');
  const result=JSON.parse(decodeHtml(run.stdout.slice(i+start.length,j)));
  if(!result.ok)throw new Error(result.error);
  if(result.authA.delayedRequests!==2)throw new Error('delayed Auth A request count');
  if(result.authB.event!=='AUTH-B-ONLY'||result.authB.lateAContained!==true)throw new Error('Auth B isolation result');
  if(result.guestStorage.eventCount!==1||result.guestStorage.title!=='GUEST-ONLY')throw new Error('Guest storage isolation result');
  console.log('CALENDAR IDENTITY ISOLATION PASS',JSON.stringify(result));
}finally{
  server.kill('SIGTERM');
  fs.rmSync(FIXTURE,{force:true});
}
