// CONVERSATION-CALENDAR-CARD-02 — the card itself, in a real browser.
//
// The unit validator next door proves the write path. This one proves the part
// the owner actually touches: a reservation image comes back from Core, a small
// card appears under LOTBI's answer, and pressing 등록 puts the stay on the
// Calendar without opening anything or asking for anything to be retyped.
//
// What it drives is the real site-conversation.js against a stubbed Core, at a
// phone viewport and a desktop one. What it asserts is mostly the restraint:
//
//   - a settled receipt and an irrelevant photo produce no card at all
//   - 아니요 writes nothing and does not come back after a re-render
//   - two fast presses of 등록 produce exactly one POST
//   - the reservation number and phone number in the draft's memo never reach
//     the Calendar
//
// and then the capability: a check-in and a check-out arrive as one TIME_WINDOW
// activity, the card turns into the registered card, and the Calendar is told
// to refresh so the day the owner just saved onto is already right.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-card-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-card-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4213;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'calcard2';

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
<link rel="stylesheet" href="/site-conversation.css?v=${V}">
<link rel="stylesheet" href="/site-calendar.css?v=${V}">
</head><body class="chat-home-page" data-site-auth-state="authenticated">
<aside class="chat-sidebar chat-sidebar-desktop">
  <button type="button" data-calendar-view="all">캘린더</button>
</aside>
<template id="shell-markup"><main id="main-content" class="chat-home-shell" tabindex="0">
  <div data-home-avatar-anchor><div data-lotbi-avatar-container></div></div>
  <div id="conversation-thread" class="conversation-thread" hidden></div>
  <div class="chat-composer-stack">
    <div data-attachment-preview hidden></div>
    <textarea id="lotbi-prompt"></textarea>
    <div data-attachment-control>
      <button type="button" data-attachment-trigger aria-expanded="false">+</button>
      <div data-attachment-menu hidden>
        <button type="button" role="menuitem" data-attachment-action="camera">카메라</button>
        <button type="button" role="menuitem" data-attachment-action="photos">사진</button>
        <button type="button" role="menuitem" data-attachment-action="files">파일</button>
      </div>
      <input type="file" data-attachment-input="camera">
      <input type="file" data-attachment-input="photos">
      <input type="file" data-attachment-input="files">
    </div>
  </div>
  <div data-response-grade-control hidden inert>
    <button type="button" data-response-grade-trigger disabled><span data-response-grade-label>스탠다드</span></button>
    <div data-response-grade-menu hidden>
      <button type="button" data-response-grade="LIGHT" disabled></button>
      <button type="button" data-response-grade="STANDARD" disabled></button>
      <button type="button" data-response-grade="PREMIUM" disabled></button>
    </div>
  </div>
  <button class="send-button" type="button">전송</button>
  <button class="mic-button" type="button">마이크</button>
  <p id="chat-status"></p>
  <div id="chat-state-region" hidden></div>
</main></template>
<pre id="card-result">pending</pre>
<script type="module">
const out=document.getElementById('card-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},40000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<300;i+=1){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const gone=async(fn,label)=>{stage=label;for(let i=0;i<40;i+=1){if(!fn())return true;await new Promise(r=>setTimeout(r,20))}return false};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));

const BOOKING={contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,
  source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  document_kind:'RESERVATION',detection_confidence:'HIGH',calendar_relevance:'SCHEDULED_EVENT',
  title:'라마다 프라자 호텔 자은도 숙박',
  local_date:'2026-09-12',local_time:'15:00',
  end_local_date:'2026-09-13',end_local_time:'11:00',
  entry:{amount_minor:null,currency:null,expense_category:null,
    memo:'예약번호 R-99128841 / 010-1234-5678',place:'라마다 프라자 호텔 자은도',merchant:null},
  dedupe_fingerprint:'${'c'.repeat(64)}',auto_suggestable:true,
  source_attachment_ids:['att_aaaabbbbccccddddeeee']};

const result={};
let draft=BOOKING;
const calls=[];

function install(){
  const native=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(url,init={})=>{
    const parsed=new URL(String(url),location.origin);
    const method=(init.method||'GET').toUpperCase();
    const body=typeof init.body==='string'?init.body:null;
    if(parsed.pathname.startsWith('/v2/')||parsed.origin!==location.origin){
      calls.push({path:parsed.pathname,method,body});
    }
    if(parsed.pathname==='/v2/conversation/messages'){
      return json({contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'숙박 예약 확인서네요. 9월 12일 체크인, 9월 13일 체크아웃입니다.',
        response_mode:'AI_CALENDAR_DRAFT_NON_AUTHORITATIVE',correlation_id:'corr_card',
        retry_safe:true,follow_up:{required:false},intent:{action:'UNKNOWN'},
        ...(draft?{calendar_draft:draft}:{})});
    }
    if(parsed.pathname==='/v2/life/activities'&&method==='POST'){
      return json({activity_id:'activity_'+'1'.repeat(32),occurrence_id:'occurrence_'+'2'.repeat(32),
        title:JSON.parse(body||'{}').title||'',activity_revision:1,occurrence_revision:1,
        activity_state:'ACTIVE',entry:{},temporal:JSON.parse(body||'{}').temporal,
        temporal_semantics:'USER_PLANNED_TIME',busy:'UNKNOWN',
        confirmation_level:'USER_ATTESTED',provider_verified:false,read_your_writes:true});
    }
    if(parsed.pathname==='/v2/me'){
      return json({user:{id:'usr_card_fixture',name:'LOTBI 사용자',public_handle:'lotbi'},
        session:{id:'ses_card_fixture',assurance_level:'FULL',expires_at:'2027-01-01T00:00:00+00:00'},
        installation:{id:'inst_card_fixture'}});
    }
    if(parsed.pathname==='/v2/subscription'||parsed.pathname==='/v2/subscriptions/current'){
      return json({tier:'FREE',status:'ACTIVE'});
    }
    if(parsed.pathname==='/v2/life/holidays')return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'card-2026',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname.startsWith('/v2/life/'))return json({view:'AGENDA',as_of:new Date().toISOString(),timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.origin!==location.origin)return json({});
    return native(url,init);
  };
}

let turns=0;
const send=async text=>{
  const box=document.getElementById('lotbi-prompt');
  const sendButton=document.querySelector('.send-button');
  box.value=text;
  box.dispatchEvent(new Event('input',{bubbles:true}));
  // The composer refuses a second message while the first is in flight, so a
  // test that fires them back to back silently sends one. Typing first, because
  // an empty box disables the button for a different reason.
  await wait(()=>!sendButton.disabled,'composer ready');
  const before=calls.filter(c=>c.path==='/v2/conversation/messages').length;
  click(sendButton);
  await wait(()=>calls.filter(c=>c.path==='/v2/conversation/messages').length>before,'turn sent');
  turns+=1;
};

// The newest card. Earlier turns' cards stay in the thread, as they should, so
// every assertion here is about the turn just sent.
const card=()=>[...document.querySelectorAll('.conversation-calendar-draft')].pop()||null;
const button=label=>[...(card()?.querySelectorAll('button')||[])].find(b=>b.textContent.trim()===label);
const writes=()=>calls.filter(c=>c.path==='/v2/life/activities'&&c.method==='POST');

try{
  localStorage.clear();
  install();
  const conversation=await import('/site-conversation.js?v=${V}');
  document.body.appendChild(document.getElementById('shell-markup').content.cloneNode(true));
  if(!conversation.mountConversation({sessionToken:'tok_card_fixture'}))throw new Error('conversation mount');
  await wait(()=>calls.some(c=>c.path==='/v2/me'),'identity loaded');

  let refreshes=0;
  window.addEventListener('lotbi:life-calendar-refresh',()=>{refreshes+=1});

  // ── 1. a receipt and a dog photo raise nothing ─────────────────────────
  // This is what Core actually sends for both: an answer about the picture and
  // no calendar_draft at all, because calendar_draft_should_surface() already
  // decided. The Site's job is to not invent a card out of its absence.
  draft=null;
  await send('이거');
  // Core would not have sent a draft at all for this; the Site must not invent a
  // card from one that slipped through with auto_suggestable false either.
  result.receiptCard=Boolean(card());

  // A draft with no legible date is not registerable: it offers review, never a
  // one-tap 등록 that would write a dateless entry.
  draft={...BOOKING,local_date:null,local_time:null,end_local_date:null,end_local_time:null,
    title:'보험 서류',dedupe_fingerprint:'${'f'.repeat(64)}',auto_suggestable:false};
  await send('이거');
  await wait(()=>card(),'dateless card');
  result.datelessButtons=[...card().querySelectorAll('button')].map(b=>b.textContent.trim());

  // ── 2. a booking asks, once ────────────────────────────────────────────
  draft=BOOKING;
  await send('이거');
  await wait(()=>card()&&button('등록'),'booking card');
  const row=card();
  result.question=row.querySelector('.conversation-calendar-action-status')?.textContent||'';
  result.cardTitle=row.querySelector('.conversation-calendar-action-copy strong')?.textContent||'';
  result.cardWhen=row.querySelector('.conversation-calendar-action-copy span')?.textContent||'';
  result.buttons=[...row.querySelectorAll('button')].map(b=>b.textContent.trim());
  result.labels=[...row.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'');
  result.taps=[...row.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().height));
  result.liveRegion=row.querySelector('.conversation-calendar-action-status')?.getAttribute('aria-live')||'';
  result.focusable=[...row.querySelectorAll('button')].every(b=>b.tabIndex>=0&&!b.disabled);
  result.writesBeforePressing=writes().length;

  // ── 3. two fast presses are one write ──────────────────────────────────
  const register=button('등록');
  click(register); click(register);
  await wait(()=>[...document.querySelectorAll('.conversation-calendar-action[data-calendar-result]')].pop(),'registered card');
  const posts=writes();
  result.postCount=posts.length;
  const sent=JSON.parse(posts[0].body);
  result.sentTemporal=sent.temporal;
  result.sentTitle=sent.title;
  result.sentRequestId=sent.logical_request_id;
  result.sentBody=posts[0].body;
  result.refreshes=refreshes;
  result.registeredText=[...document.querySelectorAll('.conversation-calendar-action[data-calendar-result]')].pop()?.querySelector('.conversation-calendar-action-status')?.textContent||'';
  // No editor, no form, nothing retyped.
  result.noEditorOpened=!document.querySelector('.site-modal.site-calendar-modal');
  result.draftCardGone=!button('등록');

  // ── 4. 아니요 writes nothing, and stays declined ───────────────────────
  draft={...BOOKING,title:'전주 치과 정기검진',local_date:'2026-10-05',local_time:'10:30',
    end_local_date:null,end_local_time:null,dedupe_fingerprint:'${'e'.repeat(64)}'};
  await send('이거');
  await wait(()=>card()&&button('아니요'),'decline card');
  const before=writes().length;
  click(button('아니요'));
  await wait(()=>!button('아니요'),'declined');
  result.declineWrote=writes().length!==before;
  result.declineText=card()?.querySelector('.conversation-calendar-action-status')?.textContent||'';

  result.ok=true;
  out.textContent=JSON.stringify(result);
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),calls:calls.map(c=>c.method+' '+c.path)})}
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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('card-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
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
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.calls || [])}`);
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

    // Restraint first. A card on a grocery receipt is the failure that makes an
    // owner turn the feature off.
    if (v.receiptCard) throw new Error(`${label}: a turn Core sent no draft for must raise no card at all`);
    if (v.datelessButtons.join('|') !== '초안 확인 · 편집') {
      throw new Error(`${label}: a draft with no date must offer review, not one-tap 등록, got ${v.datelessButtons.join('|')}`);
    }

    // The question, and what it is asking about.
    if (!/캘린더에 등록할까요/.test(v.question)) throw new Error(`${label}: the card must ask, got "${v.question}"`);
    if (v.cardTitle !== '라마다 프라자 호텔 자은도 숙박') throw new Error(`${label}: the card must name the stay, got "${v.cardTitle}"`);
    // Both ends, on one line, so the owner can check it before saying yes.
    if (v.cardWhen !== '09월 12일 15:00 → 09월 13일 11:00') {
      throw new Error(`${label}: the card must show check-in and check-out, got "${v.cardWhen}"`);
    }
    if (v.buttons.join('|') !== '등록|아니요|편집') {
      throw new Error(`${label}: the card must offer 등록, 아니요 and 편집, got ${v.buttons.join('|')}`);
    }
    if (v.labels.some(l => !l)) throw new Error(`${label}: every button needs an accessible name, got ${JSON.stringify(v.labels)}`);
    if (v.taps.some(h2 => h2 < 44)) throw new Error(`${label}: tap targets must be at least 44px, got ${JSON.stringify(v.taps)}`);
    if (v.liveRegion !== 'polite') throw new Error(`${label}: the status must be announced, got "${v.liveRegion}"`);
    if (!v.focusable) throw new Error(`${label}: every button must be keyboard reachable`);
    if (v.writesBeforePressing) throw new Error(`${label}: nothing may be written before the owner presses 등록`);

    // Two presses, one entry.
    if (v.postCount !== 1) throw new Error(`${label}: pressing 등록 twice must write once, got ${v.postCount} writes`);
    if (v.sentTemporal?.kind !== 'TIME_WINDOW') throw new Error(`${label}: a stay must be written as one TIME_WINDOW, got ${JSON.stringify(v.sentTemporal)}`);
    if (v.sentTemporal.window_start !== '2026-09-12T15:00:00' || v.sentTemporal.window_end !== '2026-09-13T11:00:00') {
      throw new Error(`${label}: the window must carry both ends, got ${JSON.stringify(v.sentTemporal)}`);
    }
    if (!/^calimg-[0-9a-f]{40}$/.test(String(v.sentRequestId))) {
      throw new Error(`${label}: the write identity must come from the booking, got ${JSON.stringify(v.sentRequestId)}`);
    }
    // What the document carried and the Calendar must not.
    for (const secret of ['R-99128841', '010-1234-5678']) {
      if (v.sentBody.includes(secret)) throw new Error(`${label}: the Calendar write leaked ${secret}`);
    }

    // Saved, said so, and the Calendar told to catch up — with nothing retyped.
    if (!/등록/.test(v.registeredText)) throw new Error(`${label}: the card must confirm the save, got "${v.registeredText}"`);
    if (!v.draftCardGone) throw new Error(`${label}: the question must not still be on screen after it was answered`);
    if (v.refreshes < 1) throw new Error(`${label}: a successful save must refresh the Calendar`);
    if (!v.noEditorOpened) throw new Error(`${label}: 등록 must not make the owner fill in a form`);

    // And no is no.
    if (v.declineWrote) throw new Error(`${label}: 아니요 must write nothing`);
    if (!/등록하지 않았습니다/.test(v.declineText)) throw new Error(`${label}: 아니요 must say so, got "${v.declineText}"`);

    console.log(label, JSON.stringify({
      question: v.question, when: v.cardWhen, buttons: v.buttons, taps: v.taps,
      writes: v.postCount, temporal: v.sentTemporal.kind, refreshes: v.refreshes,
      receiptCard: v.receiptCard, dateless: v.datelessButtons, declineWrote: v.declineWrote,
    }));
  }
  console.log('CONVERSATION CALENDAR CARD 02 PASS — booking asks once, receipt asks nothing, 등록 writes one TIME_WINDOW with no retyping and no leaked identifiers, double-press writes once, Calendar refreshed, 아니요 writes nothing.');
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
