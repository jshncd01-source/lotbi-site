// MESSAGE-CALENDAR-FOOTER-EDITOR-01 — the footer 캘린더 button, in a real browser.
//
// The button itself (icon, label, append order) is proven by the static
// validator next door. This one proves what happens after it is pressed:
// openCalendar's editor must open every time, because a caller that lands on
// the plain calendar view instead of "일정을 등록하시겠습니까?" is exactly the
// regression a user reported — a plain-text answer with no place and no Core
// calendar_draft returned a null hint, and site-calendar-manager.js's
// openDeepTarget() only auto-opens the editor when initialDraft is a truthy
// object, so null silently skipped it.
//
//   - a message with a real Core calendar_draft opens the editor pre-filled,
//     heading "일정 초안 확인"
//   - a plain answer with neither a place nor a calendar_draft still opens the
//     editor, blank, heading "기록 추가" — never the bare calendar view
//     (LIFE UX 01 renamed the blank editor from "일정 등록" to "기록 추가";
//     the contract — it always opens, it never invents a title — is unchanged)
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calfooter-editor-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calfooter-editor-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4297;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'calfootedit1';

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
<pre id="footer-editor-result">pending</pre>
<script type="module">
const out=document.getElementById('footer-editor-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},40000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<400;i+=1){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,25))}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));

const DRAFT={contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,
  source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  document_kind:'RESERVATION',detection_confidence:'HIGH',calendar_relevance:'SCHEDULED_EVENT',
  title:'전주 치과 정기검진',
  local_date:'2026-10-05',local_time:'10:30',
  end_local_date:null,end_local_time:null,
  entry:{amount_minor:null,currency:null,expense_category:null,memo:null,place:null,merchant:null},
  dedupe_fingerprint:'${'d'.repeat(64)}',auto_suggestable:false,
  source_attachment_ids:['att_aaaabbbbccccddddeeee']};

let draft=DRAFT;
const calls=[];
// "카카오톡 공유하기" exists only with explicit Share readiness. 'unset' is
// Production today; 'configured' models the future Share-specific contract.
const kakaoMode=new URLSearchParams(location.search).get('kakao')||'unset';
const copied=[];
const kakaoCalls={init:[],send:[]};
function install(){
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied.push(text)}}});
  if(kakaoMode==='configured'){
    let initialized=false;
    globalThis.Kakao={init:key=>{kakaoCalls.init.push(key);initialized=true},isInitialized:()=>initialized,
      Share:{sendDefault:async payload=>{kakaoCalls.send.push(payload)}}};
  }
  const native=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(url,init={})=>{
    const parsed=new URL(String(url),location.origin);
    const method=(init.method||'GET').toUpperCase();
    calls.push({path:parsed.pathname,method});
    if(parsed.pathname==='/app/config.json'){
      return json({navigation:kakaoMode==='configured'
        ?{kakao_share_ready:true,kakao_navi_ready:true,kakao_javascript_key:'fixture-js-key',kakao_javascript_sdk_url:'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js'}
        :{kakao_navi_ready:false,kakao_javascript_key:null,kakao_javascript_sdk_url:null}});
    }
    if(parsed.pathname==='/v2/conversation/messages'){
      return json(draft?{contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'10월 5일 오전 10시 30분 전주 치과 정기검진 일정이네요.',
        response_mode:'AI_CALENDAR_DRAFT_NON_AUTHORITATIVE',correlation_id:'corr_footeredit',
        retry_safe:true,follow_up:{required:false},intent:{action:'UNKNOWN'},
        calendar_draft:draft}:{contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text:'오늘은 대체로 맑고 낮 최고 기온은 24도 정도예요.',
        response_mode:'STANDARD',correlation_id:'corr_footeredit_plain',
        retry_safe:true,follow_up:{required:false},intent:{action:'UNKNOWN'}});
    }
    if(parsed.pathname==='/v2/me'){
      return json({user:{id:'usr_footeredit',name:'LOTBI 사용자',public_handle:'lotbi'},
        session:{id:'ses_footeredit',assurance_level:'FULL',expires_at:'2027-01-01T00:00:00+00:00'},
        installation:{id:'inst_footeredit'}});
    }
    if(parsed.pathname==='/v2/subscription'||parsed.pathname==='/v2/subscriptions/current'){
      return json({tier:'FREE',status:'ACTIVE'});
    }
    if(parsed.pathname==='/v2/life/holidays')return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'footeredit-2026',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.pathname.startsWith('/v2/life/'))return json({view:'AGENDA',as_of:new Date().toISOString(),timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(parsed.origin!==location.origin)return json({});
    return native(url,init);
  };
}

const footerCalendarButtons=()=>[...document.querySelectorAll('[data-message-action="calendar"]')];

const send=async text=>{
  const box=document.getElementById('lotbi-prompt');
  const sendButton=document.querySelector('.send-button');
  box.value=text;
  box.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>!sendButton.disabled,'composer ready');
  const before=calls.filter(c=>c.path==='/v2/conversation/messages').length;
  const footersBefore=footerCalendarButtons().length;
  click(sendButton);
  await wait(()=>calls.filter(c=>c.path==='/v2/conversation/messages').length>before,'turn sent');
  // Wait for THIS turn's own footer button, never a stale one still in the
  // thread from an earlier turn — a bare existence check would resolve
  // instantly against the previous message's button and click the wrong one.
  await wait(()=>footerCalendarButtons().length>footersBefore,"this turn's footer button rendered");
};

const openViaFooter=async label=>{
  const btn=footerCalendarButtons().pop();
  click(btn);
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),label+': calendar modal opened');
  await new Promise(r=>setTimeout(r,600));
  return {
    editor: document.querySelector('.calendar-editor-dialog'),
    modal: document.querySelector('.site-modal.site-calendar-modal'),
  };
};

const closeCalendar=async()=>{
  document.querySelector('.calendar-editor-close')?.click();
  document.querySelector('.site-modal-close')?.click();
  await new Promise(r=>setTimeout(r,300));
};

const result={};
try{
  localStorage.clear();
  install();
  const conversation=await import('/site-conversation.js?v=${V}');
  document.body.appendChild(document.getElementById('shell-markup').content.cloneNode(true));
  if(!conversation.mountConversation({sessionToken:'tok_footeredit_fixture'}))throw new Error('conversation mount');
  await wait(()=>calls.some(c=>c.path==='/v2/me'),'identity loaded');

  // ── 1. a message with a real calendar_draft opens the editor pre-filled ──
  draft=DRAFT;
  await send('이거');
  const withDraft=await openViaFooter('withDraft');
  result.withDraft_editorOpened=Boolean(withDraft.editor);
  result.withDraft_heading=withDraft.editor?.querySelector('#calendar-editor-heading')?.textContent||'';
  result.withDraft_title=withDraft.editor?.querySelector('.calendar-editor-title')?.value||'';
  result.withDraft_date=withDraft.editor?.querySelector('.calendar-editor-date')?.value||'';
  await closeCalendar();

  // ── 2. a plain answer with no place and no draft still opens the editor ──
  // This is the reported bug: before the fix, this case landed on the bare
  // calendar view instead of "일정을 등록하시겠습니까?".
  draft=null;
  await send('오늘 날씨 어때');
  const latestActions=[...document.querySelectorAll('.chat-message-actions')].pop();
  result.messageActionLabels=[...latestActions.querySelectorAll(':scope > button')].map(button=>button.getAttribute('aria-label'));
  const shareFeedback=latestActions.querySelector('.chat-message-action-feedback');
  click(latestActions.querySelector('[data-message-action="copy"]'));
  await wait(()=>copied.length,'ordinary answer copy');
  await wait(()=>shareFeedback.textContent.trim()==='답변을 복사했습니다.','ordinary answer copy feedback');
  result.answerCopied=[...copied];
  copied.length=0;
  shareFeedback.textContent='';
  click(latestActions.querySelector('[data-message-action="share"]'));
  await wait(()=>calls.some(c=>c.path==='/app/config.json'),'kakao config read when the share menu opens');
  await new Promise(r=>setTimeout(r,50));
  result.shareMenuItems=[...latestActions.querySelectorAll('[role="menuitem"]')].map(item=>item.getAttribute('aria-label'));
  const selectedShareAction=kakaoMode==='configured'?'kakaotalk':'link-copy';
  click(latestActions.querySelector('[data-share-action="'+selectedShareAction+'"]'));
  await wait(()=>shareFeedback.textContent.trim(),'kakao share feedback');
  result.kakaoFeedback=shareFeedback.textContent.trim();
  result.kakaoFeedbackTone=shareFeedback.dataset.tone||'';
  result.kakaoCopied=[...copied];
  result.kakaoSend=kakaoCalls.send.map(p=>({objectType:p.objectType,link:p.link}));
  result.kakaoInit=[...kakaoCalls.init];
  result.kakaoSdkScripts=[...document.querySelectorAll('script[src*="kakaocdn"]')].length;
  result.shareMenuClosed=latestActions.querySelector('.lotbi-share-menu').hidden;
  const plain=await openViaFooter('plain');
  result.plain_editorOpened=Boolean(plain.editor);
  result.plain_heading=plain.editor?.querySelector('#calendar-editor-heading')?.textContent||'';
  result.plain_title=plain.editor?.querySelector('.calendar-editor-title')?.value||'';
  result.plain_calendarManagerView=plain.modal?.querySelector('.site-modal-content')?.dataset.calendarManagerView||'';
  result.calendarRole=plain.modal?.getAttribute('role')||'';
  result.calendarAriaModal=plain.modal?.getAttribute('aria-modal')||'';
  result.calendarIsWorkspace=plain.modal?.parentElement?.classList.contains('consumer-workspace')||false;
  result.bodyWorkspaceOpen=document.body.classList.contains('site-workspace-open');
  result.bodyOverlayOpen=document.body.classList.contains('site-overlay-open');
  result.chatRemainsVisible=!document.getElementById('main-content').hidden;
  result.chatIsInert=document.getElementById('main-content').inert;

  // The Calendar is a modal over the conversation, but unlike a short-lived
  // confirmation dialog it must not disappear when the user taps blank space.
  // Close the nested editor first so the clicks exercise the Calendar shell.
  document.querySelector('.calendar-editor-close')?.click();
  await wait(()=>!document.querySelector('.calendar-editor-dialog'),'plain editor closed');
  const conversationBeforeBackdrop=document.getElementById('conversation-thread').textContent;
  click(plain.modal);
  await new Promise(r=>setTimeout(r,50));
  result.calendarStayedAfterInnerBlankClick=Boolean(document.querySelector('.site-modal.site-calendar-modal'));
  const calendarBackdrop=plain.modal.parentElement;
  calendarBackdrop.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
  click(calendarBackdrop);
  await new Promise(r=>setTimeout(r,50));
  result.calendarStayedAfterBackdropClick=Boolean(document.querySelector('.site-modal.site-calendar-modal'));
  const calendarCloseButton=document.querySelector('.site-calendar-modal > .site-modal-header .site-modal-close');
  result.calendarCloseButtonLabel=calendarCloseButton?.getAttribute('aria-label')||'';
  calendarCloseButton?.click();
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'calendar closed by close button');
  result.calendarClosedByCloseButton=!document.querySelector('.site-modal.site-calendar-modal');
  result.conversationPreservedAfterClose=document.getElementById('conversation-thread').textContent===conversationBeforeBackdrop;

  click(document.querySelector('[data-calendar-view="all"]'));
  const escapeCalendar=await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar reopened for Escape');
  escapeCalendar.parentElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'calendar closed by Escape');
  result.calendarClosedByEscape=!document.querySelector('.site-modal.site-calendar-modal');
  result.conversationPreservedAfterEscape=document.getElementById('conversation-thread').textContent===conversationBeforeBackdrop;

  result.ok=true;
  out.textContent=JSON.stringify(result);
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),calls:calls.map(c=>c.method+' '+c.path),partial:result})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h, kakao) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}?kakao=${kakao}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('footer-editor-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h, kakao, userAgent = '') {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, kakao), 'utf8');
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=60000'];
  if (userAgent) args.push(`--user-agent=${userAgent}`);
  args.push('--dump-dom', ORIGIN + '/' + WRAPPER_REL);
  const r = spawnSync(browser, args, {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.calls || [])} ${JSON.stringify(v.partial || {})}`);
  return v;
}

function assertList(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h, kakao, userAgent = ''] of [[375, 812, 'unset'], [390, 844, 'unset'], [1280, 900, 'unset'], [390, 844, 'configured'], [390, 844, 'unset', 'Mozilla/5.0 KAKAOTALK/25.0']]) {
    const v = run(browser, w, h, kakao, userAgent);
    const label = `${w}x${h} kakao=${kakao}${userAgent ? ' inapp=KakaoTalk' : ''}`;

    if (!v.withDraft_editorOpened) throw new Error(`${label}: a message with a calendar_draft must open the editor`);
    if (v.withDraft_heading !== '일정 초안 확인') throw new Error(`${label}: a real draft must read "일정 초안 확인", got "${v.withDraft_heading}"`);
    if (v.withDraft_title !== '전주 치과 정기검진') throw new Error(`${label}: the editor must pre-fill the draft's title, got "${v.withDraft_title}"`);
    if (v.withDraft_date !== '2026-10-05') throw new Error(`${label}: the editor must pre-fill the draft's date, got "${v.withDraft_date}"`);

    // The regression: no place, no calendar_draft — must still reach the
    // editor, never the bare calendar view.
    if (!v.plain_editorOpened) throw new Error(`${label}: a plain answer's footer button must still open the editor, not the bare calendar view (calendarManagerView="${v.plain_calendarManagerView}")`);
    if (v.plain_heading !== '기록 추가') throw new Error(`${label}: a blank fallback must read "기록 추가", got "${v.plain_heading}"`);
    if (v.plain_title !== '') throw new Error(`${label}: a plain answer must not invent a title, got "${v.plain_title}"`);
    assertList(v.messageActionLabels, ['복사하기', '공유하기', '캘린더에 추가'], `${label}: chat answer tools`);
    if (v.answerCopied.length !== 1 || !v.answerCopied[0].startsWith('오늘은 대체로 맑고')) throw new Error(`${label}: ordinary answer copy regressed, got ${JSON.stringify(v.answerCopied)}`);
    assertList(v.shareMenuItems, kakao === 'configured' ? ['링크 복사', '카카오톡 공유하기'] : ['링크 복사'], `${label}: share menu`);
    if (v.calendarRole !== 'dialog' || v.calendarAriaModal !== 'true') throw new Error(`${label}: Calendar must be an accessible modal dialog`);
    if (v.calendarIsWorkspace || v.bodyWorkspaceOpen) throw new Error(`${label}: Calendar must not replace chat as a workspace`);
    if (!v.bodyOverlayOpen || !v.chatRemainsVisible || v.chatIsInert) throw new Error(`${label}: chat must remain mounted and visible behind Calendar`);
    if (!v.calendarStayedAfterInnerBlankClick) throw new Error(`${label}: Calendar must stay open after a blank area inside the modal is clicked`);
    if (!v.calendarStayedAfterBackdropClick) throw new Error(`${label}: Calendar must stay open after its outer backdrop is clicked`);
    if (v.calendarCloseButtonLabel !== '캘린더 닫기') throw new Error(`${label}: Calendar modal close button contract changed, got "${v.calendarCloseButtonLabel}"`);
    if (!v.calendarClosedByCloseButton) throw new Error(`${label}: Calendar close button must still close the modal`);
    if (!v.conversationPreservedAfterClose) throw new Error(`${label}: closing Calendar must preserve the conversation`);
    if (!v.calendarClosedByEscape) throw new Error(`${label}: Escape must still close the Calendar modal`);
    if (!v.conversationPreservedAfterEscape) throw new Error(`${label}: closing Calendar with Escape must preserve the conversation`);
    if (!v.shareMenuClosed) throw new Error(`${label}: choosing a share option must close the share menu`);
    if (v.kakaoSdkScripts !== 0) throw new Error(`${label}: the Kakao SDK must not be added as a page script here`);
    if (kakao === 'unset') {
      // Production today: Kakao is absent; only the user's explicit Link Copy runs.
      if (v.kakaoFeedback !== '링크를 복사했습니다.' || v.kakaoFeedbackTone) throw new Error(`${label}: Link Copy must remain explicit and functional, got "${v.kakaoFeedback}" (${v.kakaoFeedbackTone})`);
      if (JSON.stringify(v.kakaoCopied) !== JSON.stringify(['https://lotbiai.com/'])) throw new Error(`${label}: only the canonical link must be copied, got ${JSON.stringify(v.kakaoCopied)}`);
      if (v.kakaoSend.length || v.kakaoInit.length) throw new Error(`${label}: Kakao must not be called while unconfigured`);
    } else {
      if (v.kakaoFeedback !== '카카오톡 공유 화면을 열었습니다.') throw new Error(`${label}: configured KakaoTalk share must open, got "${v.kakaoFeedback}"`);
      if (v.kakaoCopied.length) throw new Error(`${label}: a configured share must not copy instead`);
      if (JSON.stringify(v.kakaoInit) !== JSON.stringify(['fixture-js-key'])) throw new Error(`${label}: Kakao must be initialised once with Core's key`);
      if (v.kakaoSend.length !== 1 || v.kakaoSend[0].objectType !== 'text' || v.kakaoSend[0].link?.webUrl !== 'https://lotbiai.com/') throw new Error(`${label}: one KakaoTalk text share with the LOTBI link, got ${JSON.stringify(v.kakaoSend)}`);
    }

    console.log(label, JSON.stringify({
      withDraft: {heading: v.withDraft_heading, title: v.withDraft_title, date: v.withDraft_date},
      plain: {heading: v.plain_heading, title: v.plain_title},
      kakao: v.kakaoFeedback,
    }));
  }
  console.log('MESSAGE CALENDAR FOOTER EDITOR 01 PASS — a real draft opens the editor pre-filled ("일정 초안 확인"), and a plain answer with nothing to pre-fill still opens it blank ("기록 추가") instead of landing on the bare calendar view.');
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
