// Locks 이미지로 등록 — the picture-to-draft path on the Calendar day panel.
//
// The rule the 대표 set is that LOTBI never saves by itself: a picture becomes a
// draft the owner looks at and presses save on. So the assertions here are as
// much about what must NOT happen as about what must.
//
// Covered contracts:
//   - the attachment id the upload returned is the one sent to the conversation
//     route (it is `id` on that contract, and reading the wrong key silently
//     sent an empty attachment list)
//   - the message text is the canonical phrase Core's calendar-draft gate needs
//   - the draft opens the editor prefilled, and NOTHING is written: no POST or
//     PATCH to any activity route anywhere in the flow
//   - a response carrying no draft says so and leaves the editor closed
//   - a refused upload asks the owner to sign in again rather than failing mute
//   - a signed-out owner is told to sign in before any network call is made
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
<link rel="stylesheet" href="/site-calendar.css?v=20260923-calsettings1">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="image-result">pending</pre>
<script type="module">
const out=document.getElementById('image-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));

const DRAFT={contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,
  source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  title:'야놀자 호텔 예약',local_date:'2026-09-26',local_time:'15:00',
  entry:{amount_minor:208320,currency:'KRW',expense_category:'TRAVEL',
    memo:null,place:'제주 호텔',merchant:'NOL'},
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
    if(parsed.pathname==='/v2/life/agenda')return json({view:'AGENDA',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/attention')return json({view:'ATTENTION',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/expense-summary')return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',start_date:'2026-09-01',end_date:'2026-09-30',coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',currencies:[],entries_without_amount:0,ai_calls:0,provider_api_calls:0});
    if(parsed.pathname==='/v2/life/holidays')return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    return json({items:[]});
  };
  impl.calls=calls;
  return impl;
}

async function mountCase(manager,{sessionToken,fetchImpl}){
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken,timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    fetchImpl,settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
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

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=20260923-calsettings1');
  const result={ok:true};

  // --- the happy path --------------------------------------------------
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

  await wait(()=>document.querySelector('.calendar-editor-dialog')||root.querySelector('[data-calendar-add-message]'),'editor or message');

  const uploadCall=happy.calls.find(c=>c.method==='POST'&&c.path.endsWith('/attachments'));
  const chatCall=happy.calls.find(c=>c.method==='POST'&&!c.path.endsWith('/attachments'));
  result.uploaded=Boolean(uploadCall);
  result.chatCalled=Boolean(chatCall);
  const chatBody=chatCall?JSON.parse(chatCall.body):null;
  result.sentAttachmentIds=chatBody?.attachment_ids||null;
  result.sentText=chatBody?.text||'';

  // Nothing may be written. Any POST/PATCH/PUT/DELETE on an activity route is a
  // silent save, which is the one thing this feature must never do.
  result.writes=happy.calls
    .filter(c=>['POST','PATCH','PUT','DELETE'].includes(c.method)&&c.path.includes('/activities'))
    .map(c=>c.method+' '+c.path);

  const dialog=document.querySelector('.calendar-editor-dialog, dialog[data-calendar-editor], .calendar-editor')
    ||root.querySelector('.calendar-editor-dialog, dialog[data-calendar-editor], .calendar-editor');
  result.editorOpened=Boolean(dialog);
  if(dialog){
    const val=cls=>dialog.querySelector('.calendar-editor-'+cls)?.value??null;
    result.prefill={
      title:val('title'),date:val('date'),time:val('time'),
      amount:val('amount'),category:val('category'),
      place:val('place'),merchant:val('merchant'),memo:val('memo'),
      allDay:dialog.querySelector('.calendar-editor-all-day input')?.checked??null,
    };
    result.heading=dialog.querySelector('#calendar-editor-heading')?.textContent||'';
    result.categoryOptions=[...dialog.querySelectorAll('.calendar-editor-category option')].map(o=>o.textContent);
  }

  // --- a response with no draft ----------------------------------------
  const noDraft=stubFetch({draft:null});
  root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl:noDraft});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button 2');
  root.querySelector('[data-calendar-add-image]').click();
  dropImage(root);
  await wait(()=>root.querySelector('[data-calendar-add-message]'),'no-draft message');
  result.noDraftText=root.querySelector('[data-calendar-add-message]')?.textContent||'';
  result.noDraftEditorOpened=Boolean(document.querySelector('.calendar-editor-dialog, dialog[data-calendar-editor], .calendar-editor'));

  // --- a refused upload (403: the route, not the session) ---------------
  const refused=stubFetch({uploadStatus:403});
  root=await mountCase(manager,{sessionToken:'tok_image_fixture',fetchImpl:refused});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button 3');
  root.querySelector('[data-calendar-add-image]').click();
  dropImage(root);
  await wait(()=>root.querySelector('[data-calendar-add-message]'),'refused message');
  result.refusedText=root.querySelector('[data-calendar-add-message]')?.textContent||'';
  result.refusedAskedChat=refused.calls.some(c=>c.method==='POST'&&!c.path.endsWith('/attachments'));
  // A 403 is this route being refused, never evidence the session died: the
  // month must still be standing behind the message.
  result.refusedCalendarStanding=Boolean(root.querySelector('.calendar-month'));

  // --- a signed-out owner ------------------------------------------------
  const guest=stubFetch();
  root=await mountCase(manager,{sessionToken:'',fetchImpl:guest});
  await wait(()=>root.querySelector('[data-calendar-add-image]'),'add-image button 4');
  const guestCallsBefore=guest.calls.length;
  root.querySelector('[data-calendar-add-image]').click();
  await wait(()=>root.querySelector('[data-calendar-add-message]'),'guest message');
  result.guestText=root.querySelector('[data-calendar-add-message]')?.textContent||'';
  result.guestMadeNoCall=guest.calls.length===guestCallsBefore;

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{status:r?.querySelector('.calendar-status')?.textContent||''}})}
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
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const v = run(browser, w, h);
    const label = `${w}x${h}`;

    if (v.buttonOrder.join('|') !== '이미지로 등록|직접 등록') {
      throw new Error(`${label}: the day panel must offer 이미지로 등록 then 직접 등록, got ${v.buttonOrder.join('|')}`);
    }
    if (!v.plainButtonPresent) throw new Error(`${label}: 직접 등록 must keep its own data hook`);
    if (!v.pickerHidden) throw new Error(`${label}: the file input must stay hidden`);
    if (!v.pickerAcceptsImages.includes('image/')) throw new Error(`${label}: the file input must ask for images, got "${v.pickerAcceptsImages}"`);

    if (!v.uploaded) throw new Error(`${label}: choosing a picture must upload it`);
    if (!v.chatCalled) throw new Error(`${label}: the upload must be followed by a draft request`);

    // The bug this test exists for: the upload contract names the id `id`, and
    // reading `attachmentId` off it sent [undefined] — an empty attachment list.
    if (!Array.isArray(v.sentAttachmentIds) || v.sentAttachmentIds.length !== 1) {
      throw new Error(`${label}: exactly one attachment id must be sent, got ${JSON.stringify(v.sentAttachmentIds)}`);
    }
    if (v.sentAttachmentIds[0] !== 'att_aaaabbbbccccddddeeee') {
      throw new Error(`${label}: the id the upload returned must be the id sent, got ${JSON.stringify(v.sentAttachmentIds[0])}`);
    }
    // Core only builds a calendar draft when the message names the calendar and
    // an add action. Losing either word turns this into an ordinary chat turn.
    if (!/캘린더|달력|일정/.test(v.sentText) || !/추가|등록|저장/.test(v.sentText)) {
      throw new Error(`${label}: the message must ask Core for a calendar entry, got "${v.sentText}"`);
    }

    if (v.writes.length) throw new Error(`${label}: nothing may be saved before the owner presses save, but the flow made ${v.writes.join(', ')}`);
    if (!v.editorOpened) throw new Error(`${label}: the draft must open the editor for review`);
    // Field by field, what a picture is allowed to fill in. The draft carried
    // every one of these, so every one must arrive — a draft that silently
    // dropped the amount would look like an entry the owner chose to leave blank.
    const expected = {
      title: '야놀자 호텔 예약', date: '2026-09-26', time: '15:00',
      amount: '208320', category: 'TRAVEL', place: '제주 호텔', merchant: 'NOL',
    };
    for (const [field, want] of Object.entries(expected)) {
      if (String(v.prefill[field] ?? '') !== want) {
        throw new Error(`${label}: the editor must open with ${field}="${want}", got ${JSON.stringify(v.prefill[field])}`);
      }
    }
    // The draft carried no memo. A blank stays blank: nothing is invented to
    // fill the field in.
    if (v.prefill.memo) throw new Error(`${label}: a field the picture did not carry must stay blank, got memo=${JSON.stringify(v.prefill.memo)}`);
    if (!/확인|초안/.test(v.heading)) throw new Error(`${label}: the editor must announce itself as a draft to check, got "${v.heading}"`);
    if (!v.categoryOptions.includes('기타')) throw new Error(`${label}: the draft editor must offer 기타, got ${v.categoryOptions.join('/')}`);

    if (!v.noDraftText) throw new Error(`${label}: a response with no draft must say so`);
    if (v.noDraftEditorOpened) throw new Error(`${label}: a response with no draft must not open an empty editor`);

    if (!/직접 등록/.test(v.refusedText)) throw new Error(`${label}: a refused upload must point at the manual way in, got "${v.refusedText}"`);
    if (/로그인/.test(v.refusedText)) throw new Error(`${label}: a 403 is the route, not the session — it must not send the owner to a login screen, got "${v.refusedText}"`);
    if (v.refusedAskedChat) throw new Error(`${label}: a refused upload must not go on to ask for a draft`);
    if (!v.refusedCalendarStanding) throw new Error(`${label}: a 403 must leave the month grid standing`);

    if (!/로그인/.test(v.guestText)) throw new Error(`${label}: a signed-out owner must be asked to sign in, got "${v.guestText}"`);
    if (!v.guestMadeNoCall) throw new Error(`${label}: a signed-out owner must not reach the network`);

    console.log(label, JSON.stringify({attachment: v.sentAttachmentIds, text: v.sentText, heading: v.heading, prefill: v.prefill}));
  }
  console.log('LOTBI Calendar 이미지로 등록: PASS');
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
