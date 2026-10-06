// Locks 사진에서 기록 읽기 — the picture-to-draft path on the Calendar.
//
// The rule the 대표 set is that LOTBI never saves by itself: a picture becomes a
// draft the owner looks at and presses save on. So the assertions here are as
// much about what must NOT happen as about what must.
//
// LIFE UX 01: the draft first appears as a short confirmation card ("사진에서
// 읽었어요" · what was legible · [수정] [저장]) instead of the full form; 수정
// opens the full editor prefilled, 저장 writes exactly once. The photo itself is
// never kept, and the card says so.
//
// Covered contracts:
//   - the day's actions read 사진에서 기록 읽기 then + 기록, each with its own hook
//   - the attachment id the upload returned is the one sent to the conversation
//     route (it is `id` on that contract, and reading the wrong key silently
//     sent an empty attachment list)
//   - the message text is the canonical phrase Core's calendar-draft gate needs
//   - the draft opens the confirmation card with what was legible, and NOTHING
//     is written: no POST or PATCH to any activity route anywhere in the flow
//     until the owner presses 저장
//   - 수정 opens the editor prefilled with every field the draft carried, and a
//     field it did not carry stays blank
//   - 저장 on the card writes exactly one record with the draft's values
//   - a response carrying no draft, or a photo that is not a transaction, says
//     so and opens nothing
//   - a refused upload points at + 기록 rather than a login screen
//   - a signed-out owner is told to sign in before any network call is made,
//     and that + 기록 still works without signing in
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-image-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-image-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4201;
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
<link rel="stylesheet" href="/site-calendar.css?v=20260924-mapdeeplink1">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="image-result">pending</pre>
<script type="module">
const out=document.getElementById('image-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},40000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const settledImageMessage=root=>{
  const message=root.querySelector('[data-calendar-add-message]');
  return message&&message.textContent&&!message.textContent.includes('읽는 중')?message:null;
};
const json=body=>new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}})),80));

const DRAFT={contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,
  source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  title:'야놀자 호텔 예약',local_date:'2026-09-26',local_time:'15:00',
  entry:{amount_minor:208320,currency:'KRW',expense_category:'TRAVEL',
    memo:null,place:'제주 호텔',merchant:'NOL'},
  source_attachment_ids:['att_aaaabbbbccccddddeeee']};
// A family photo: Core reads it honestly as nothing to record.
const NOT_A_TRANSACTION={contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,
  source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  title:null,local_date:null,local_time:null,document_kind:'NOT_A_TRANSACTION',
  entry:{amount_minor:null,currency:null,expense_category:null,memo:null,place:null,merchant:null},
  source_attachment_ids:['att_aaaabbbbccccddddeeee']};

// The id the upload hands back. The conversation call must quote THIS value.
const UPLOADED_ID='att_aaaabbbbccccddddeeee';

function stubFetch({uploadStatus=200,draft=DRAFT}={}){
  const calls=[];
  const impl=(url,init={})=>{
    const parsed=new URL(String(url),location.origin);
    calls.push({path:parsed.pathname,method:(init.method||'GET').toUpperCase(),body:init.body});
    if(parsed.pathname==='/v2/conversation/attachments'){
      if(uploadStatus!==200)return Promise.resolve(new Response(JSON.stringify({code:'NOPE'}),{status:uploadStatus,headers:{'Content-Type':'application/json'}}));
      return json({contract_id:'CORE-CONVERSATION-ATTACHMENT-01',attachment:{
        attachment_id:UPLOADED_ID,file_name:'nol.png',mime_type:'image/png',
        media_kind:'IMAGE',size_bytes:4096,expires_at:'2026-09-30T00:00:00+00:00'}});
    }
    if(parsed.pathname==='/v2/conversation/messages'){
      return json({contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'이미지에서 일정 초안을 만들었어요. 저장 전에 확인해 주세요.',
        response_mode:'AI_CALENDAR_DRAFT_NON_AUTHORITATIVE',correlation_id:'corr_1',
        retry_safe:true,follow_up:{required:false},intent:{action:'UNKNOWN'},
        calendar_draft:draft});
    }
    if(parsed.pathname==='/v2/life/activities'&&(init.method||'GET').toUpperCase()==='POST'){
      const body=JSON.parse(init.body);
      return Promise.resolve(new Response(JSON.stringify({activity_id:'activity_0123456789abcdef0123456789abcdef',occurrence_id:'occurrence_0123456789abcdef0123456789abcdef',
        activity_revision:1,occurrence_revision:1,title:body.title,activity_state:'ACTIVE',temporal:body.temporal,
        entry:body.entry||null,temporal_semantics:'USER_PLANNED_TIME',busy:'UNKNOWN',confirmation_level:'USER_ATTESTED',provider_verified:false,read_your_writes:true}),
        {status:201,headers:{'Content-Type':'application/json'}}));
    }
    if(parsed.pathname==='/v2/life/agenda')return json({view:'AGENDA',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/attention')return json({view:'ATTENTION',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/expense-summary')return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',start_date:'2026-09-01',end_date:'2026-09-30',coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',currencies:[],entries_without_amount:0,ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/holidays')return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    return json({items:[]});
  };
  impl.calls=calls;
  return impl;
}
// Any POST/PATCH/PUT/DELETE on an activity route is a save.
const writesOf=fetchImpl=>fetchImpl.calls
  .filter(c=>['POST','PATCH','PUT','DELETE'].includes(c.method)&&c.path.includes('/activities'))
  .map(c=>c.method+' '+c.path);

async function mountCase(manager,{sessionToken,fetchImpl}){
  document.querySelectorAll('.calendar-photo-confirm-backdrop,.calendar-editor-backdrop').forEach(node=>node.remove());
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  await manager.mountLifeCalendarManager({
    root,sessionToken,timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    fetchImpl,settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  root.querySelector('.calendar-today-button')?.click();
  return root;
}

// Headless cannot open a real file chooser, so the picture is handed to the
// hidden input the way the chooser would: set .files, then fire change.
function dropImage(root){
  const picker=root.querySelector('[data-calendar-image-picker]');
  if(!picker)throw new Error('no image picker input');
  const transfer=new DataTransfer();
  transfer.items.add(new File([new Uint8Array([137,80,78,71])],'nol.png',{type:'image/png'}));
  picker.files=transfer.files;
  picker.dispatchEvent(new Event('change',{bubbles:true}));
}
const card=()=>document.querySelector('.calendar-photo-confirm-dialog');
const editorDialog=()=>document.querySelector('.calendar-editor-dialog');

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=20260924-mapdeeplink1');
  const result={ok:true};

  // --- the happy path: a confirmation card, nothing saved ---------------
  const happy=stubFetch();
  let root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl:happy});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button');

  const addImage=root.querySelector('[data-calendar-add-image]');
  const addPlain=root.querySelector('[data-calendar-add]');
  result.buttonOrder=[...root.querySelectorAll('.calendar-add-actions button')].map(n=>n.textContent);
  result.pickerHidden=Boolean(root.querySelector('[data-calendar-image-picker]')?.hidden);
  result.pickerAcceptsImages=root.querySelector('[data-calendar-image-picker]')?.accept||'';
  result.plainButtonPresent=Boolean(addPlain);

  addImage.click();
  dropImage(root);
  await wait(()=>card()||editorDialog()||settledImageMessage(root),'card, editor or settled message');

  const uploadCall=happy.calls.find(c=>c.method==='POST'&&c.path.endsWith('/attachments'));
  const chatCall=happy.calls.find(c=>c.method==='POST'&&c.path.endsWith('/messages'));
  result.uploaded=Boolean(uploadCall);
  result.chatCalled=Boolean(chatCall);
  const chatBody=chatCall?JSON.parse(chatCall.body):null;
  result.sentAttachmentIds=chatBody?.attachment_ids||null;
  result.sentText=chatBody?.text||'';

  result.cardOpened=Boolean(card());
  result.editorBeforeCard=Boolean(editorDialog());
  if(card()){
    const c=card();
    const text=cls=>c.querySelector('.calendar-photo-confirm-'+cls)?.textContent||'';
    result.card={heading:c.querySelector('#calendar-photo-confirm-heading')?.textContent||'',
      title:text('title'),amount:text('amount'),when:text('when'),where:text('where'),note:text('note'),
      buttons:[...c.querySelectorAll('.calendar-photo-confirm-actions button')].map(n=>n.textContent),
      saveEnabled:!c.querySelector('.calendar-photo-confirm-save')?.disabled};
    await new Promise(r=>setTimeout(r,30));
    result.card.focusOnSave=document.activeElement===c.querySelector('.calendar-photo-confirm-save');
  }
  result.writesAtCard=writesOf(happy);

  // 수정: the full editor, prefilled with every field the draft carried.
  card()?.querySelector('.calendar-photo-confirm-edit')?.click();
  await wait(()=>editorDialog(),'editor from 수정');
  {
    const dialog=editorDialog();
    const val=cls=>dialog.querySelector('.calendar-editor-'+cls)?.value??null;
    result.prefill={
      title:val('title'),date:val('date'),time:val('time'),
      amount:String(val('amount')??'').replace(/,/g,''),category:val('category'),
      place:val('place'),merchant:val('merchant'),memo:val('memo'),
    };
    result.cardGone=!card();
    result.heading=dialog.querySelector('#calendar-editor-heading')?.textContent||'';
    result.categoryOptions=[...dialog.querySelectorAll('.calendar-editor-category option')].map(o=>o.textContent);
  }
  result.writesAtEditor=writesOf(happy);

  // --- 저장 on the card writes exactly once, with the draft's values -----
  const saving=stubFetch();
  root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl:saving});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button save');
  root.querySelector('[data-calendar-add-image]').click();
  dropImage(root);
  await wait(()=>card(),'card for save');
  card().querySelector('.calendar-photo-confirm-save').click();
  await wait(()=>!card()&&writesOf(saving).length>0,'card saved');
  await new Promise(r=>setTimeout(r,200));
  const saved=saving.calls.filter(c=>c.method==='POST'&&c.path==='/v2/life/activities').map(c=>JSON.parse(c.body));
  result.savedWrites=writesOf(saving);
  result.savedBody=saved[0]?{title:saved[0].title,temporal:saved[0].temporal,entry:saved[0].entry}:null;

  // --- a response with no draft ----------------------------------------
  for(const [key,draft] of [['noDraft',null],['notTransaction',NOT_A_TRANSACTION]]){
    const fetchImpl=stubFetch({draft});
    root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl});
    await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button '+key);
    root.querySelector('[data-calendar-add-image]').click();
    dropImage(root);
    await wait(()=>settledImageMessage(root),key+' message');
    result[key]={text:root.querySelector('[data-calendar-add-message]')?.textContent||'',
      opened:Boolean(card()||editorDialog()),writes:writesOf(fetchImpl)};
  }

  // --- a refused upload (403: the route, not the session) ---------------
  const refused=stubFetch({uploadStatus:403});
  root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl:refused});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button 3');
  root.querySelector('[data-calendar-add-image]').click();
  dropImage(root);
  await wait(()=>settledImageMessage(root),'refused message');
  result.refusedText=root.querySelector('[data-calendar-add-message]')?.textContent||'';
  result.refusedAskedChat=refused.calls.some(c=>c.method==='POST'&&c.path.endsWith('/messages'));
  // A 403 is this route being refused, never evidence the session died: the
  // month must still be standing behind the message.
  result.refusedCalendarStanding=Boolean(root.querySelector('.calendar-day-view'));

  // --- a signed-out owner ------------------------------------------------
  const guest=stubFetch();
  root=await mountCase(manager,{sessionToken:'',fetchImpl:guest});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button 4');
  const guestCallsBefore=guest.calls.length;
  root.querySelector('[data-calendar-add-image]').click();
  await wait(()=>settledImageMessage(root),'guest message');
  result.guestText=root.querySelector('[data-calendar-add-message]')?.textContent||'';
  result.guestMadeNoCall=guest.calls.length===guestCallsBefore;

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{status:r?.querySelector('.calendar-status')?.textContent||'',message:r?.querySelector('[data-calendar-add-message]')?.textContent||''}})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('image-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=60000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.diag || {})}`);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const v = run(browser, w, h);
    const label = `${w}x${h}`;
    const fail = message => { throw new Error(`${label}: ${message}`); };

    // Two ways in, picture first; the plain one opens the editor directly.
    if (v.buttonOrder.join('|') !== '사진에서 기록 읽기|+ 기록') fail(`the day's actions must read 사진에서 기록 읽기 then + 기록, got ${v.buttonOrder.join('|')}`);
    if (!v.plainButtonPresent) fail('+ 기록 must keep its own data hook');
    if (!v.pickerHidden) fail('the file input must stay hidden');
    if (!v.pickerAcceptsImages.includes('image/')) fail(`the file input must ask for images, got "${v.pickerAcceptsImages}"`);

    if (!v.uploaded) fail('choosing a picture must upload it');
    if (!v.chatCalled) fail('the upload must be followed by a draft request');
    // The bug this test exists for: the upload contract names the id `id`, and
    // reading `attachmentId` off it sent [undefined] — an empty attachment list.
    if (!Array.isArray(v.sentAttachmentIds) || v.sentAttachmentIds.length !== 1) fail(`exactly one attachment id must be sent, got ${JSON.stringify(v.sentAttachmentIds)}`);
    if (v.sentAttachmentIds[0] !== 'att_aaaabbbbccccddddeeee') fail(`the id the upload returned must be the id sent, got ${JSON.stringify(v.sentAttachmentIds[0])}`);
    // Core only builds a calendar draft when the message names the calendar and
    // an add action. Losing either word turns this into an ordinary chat turn.
    if (!/캘린더|달력|일정/.test(v.sentText) || !/추가|등록|저장/.test(v.sentText)) fail(`the message must ask Core for a calendar entry, got "${v.sentText}"`);

    // The card: what was legible, the photo is not kept, nothing saved yet.
    if (!v.cardOpened || v.editorBeforeCard) fail('a legible draft must open the confirmation card first, not the full form');
    const card = v.card;
    if (card.heading !== '사진에서 읽었어요') fail(`the card must say where it came from, got "${card.heading}"`);
    if (card.title !== '야놀자 호텔 예약') fail(`the card must show the title read, got "${card.title}"`);
    if (card.amount !== '208,320원') fail(`the card must show the amount read, got "${card.amount}"`);
    if (card.when !== '여행 · 9월 26일 토요일 15:00') fail(`the card must show category and when, got "${card.when}"`);
    if (card.where !== '제주 호텔 · NOL') fail(`the card must show where, got "${card.where}"`);
    if (card.note !== '사진 자체는 캘린더에 저장되지 않아요.') fail(`the card must say the photo is not kept, got "${card.note}"`);
    if (card.buttons.join('|') !== '수정|저장' || !card.saveEnabled) fail(`the card must offer 수정 and an enabled 저장, got ${card.buttons.join('|')}`);
    if (!card.focusOnSave) fail('a complete draft must put focus on 저장');
    if (v.writesAtCard.length) fail(`nothing may be saved before the owner presses 저장, but the flow made ${v.writesAtCard.join(', ')}`);

    // 수정: the editor, field by field, with what a picture is allowed to fill in.
    if (!v.cardGone) fail('수정 must replace the card with the editor');
    const expected = {
      title: '야놀자 호텔 예약', date: '2026-09-26', time: '15:00',
      amount: '208320', category: 'TRAVEL', place: '제주 호텔', merchant: 'NOL',
    };
    for (const [field, want] of Object.entries(expected)) {
      if (String(v.prefill[field] ?? '') !== want) fail(`the editor must open with ${field}="${want}", got ${JSON.stringify(v.prefill[field])}`);
    }
    // The draft carried no memo. A blank stays blank: nothing is invented.
    if (v.prefill.memo) fail(`a field the picture did not carry must stay blank, got memo=${JSON.stringify(v.prefill.memo)}`);
    if (!/확인|초안/.test(v.heading)) fail(`the editor must announce itself as a draft to check, got "${v.heading}"`);
    if (!v.categoryOptions.includes('기타')) fail(`the draft editor must offer 기타, got ${v.categoryOptions.join('/')}`);
    if (v.writesAtEditor.length) fail(`opening the editor must not save, but the flow made ${v.writesAtEditor.join(', ')}`);

    // 저장 on the card: exactly one write, with the draft's values.
    if (v.savedWrites.length !== 1) fail(`저장 must write exactly once, got ${JSON.stringify(v.savedWrites)}`);
    const body = v.savedBody;
    if (body?.title !== '야놀자 호텔 예약') fail(`the saved title must be the draft's, got ${JSON.stringify(body?.title)}`);
    if (JSON.stringify(body?.temporal || {}).indexOf('2026-09-26T15:00') < 0) fail(`the saved time must be the draft's, got ${JSON.stringify(body?.temporal)}`);
    if (body?.entry?.amount_minor !== 208320 || body?.entry?.expense_category !== 'TRAVEL' || body?.entry?.place !== '제주 호텔' || body?.entry?.merchant !== 'NOL') {
      fail(`the saved entry must be the draft's, got ${JSON.stringify(body?.entry)}`);
    }

    for (const key of ['noDraft', 'notTransaction']) {
      const state = v[key];
      if (!/찾지 못했어요/.test(state.text) || !/\+ 기록/.test(state.text)) fail(`${key}: nothing legible must be said, with + 기록 as the way on, got "${state.text}"`);
      if (!/저장되지 않아요/.test(state.text)) fail(`${key}: the message must say the photo is not kept, got "${state.text}"`);
      if (state.opened) fail(`${key}: nothing legible must not open a card or an empty editor`);
      if (state.writes.length) fail(`${key}: nothing may be written, got ${state.writes.join(', ')}`);
    }

    if (!/\+ 기록/.test(v.refusedText) || !/직접/.test(v.refusedText)) fail(`a refused upload must point at + 기록, got "${v.refusedText}"`);
    if (/로그인/.test(v.refusedText)) fail(`a 403 is the route, not the session — it must not send the owner to a login screen, got "${v.refusedText}"`);
    if (v.refusedAskedChat) fail('a refused upload must not go on to ask for a draft');
    if (!v.refusedCalendarStanding) fail('a 403 must leave the active Calendar view standing');

    if (!/로그인/.test(v.guestText)) fail(`a signed-out owner must be asked to sign in, got "${v.guestText}"`);
    if (!/로그인 없이도/.test(v.guestText)) fail(`a signed-out owner must hear that + 기록 works without signing in, got "${v.guestText}"`);
    if (!v.guestMadeNoCall) fail('a signed-out owner must not reach the network');

    console.log(label, JSON.stringify({attachment: v.sentAttachmentIds, text: v.sentText, card: v.card, heading: v.heading, prefill: v.prefill}));
  }
  console.log('LOTBI Calendar 사진에서 기록 읽기: PASS');
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
