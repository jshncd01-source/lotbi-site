// CALENDAR-DAY-PANEL-TWO-BUTTONS-01
//
// 날짜 상세와 두 버튼을 봉인한다. (LIFE UX 01 갱신)
//
//  1. 날짜 상세에 "일정 제목" 입력칸과 [저장] 버튼이 없다. 커서도 들어가지 않는다.
//  2. 버튼은 딱 둘이다 — [사진에서 기록 읽기] [+ 기록]. + 기록은 고른 날짜로
//     입력 폼을 바로 연다(종류 고르기 단계 없음). 오늘이 아닌 날을 고르면
//     "+ 10월 7일에 기록"처럼 그 날짜를 말한다. 폰에서는 화면 아래에 붙어 있고,
//     넓은 화면에서는 오른쪽 날짜 상세 안에 있다.
//  3. 날짜 상세는 창이 아니라 화면의 일부다. 캘린더를 열면 오늘의 기록이 폰에서는
//     달력 아래에 이어서, 넓은 화면에서는 오른쪽 칸에 보인다. 달력을 덮는
//     overlay·sheet가 아니며, 사용자가 누르지 않은 날짜가 미리 선택되는 일은
//     없다 -- 선택은 오늘이거나, 사용자가 누른 날짜다.
//
// 3은 이전 지시("캘린더를 열면 날짜 창이 저절로 뜨지 않는다")를 대체한다. 그
// 지시가 막으려던 것 -- 아무도 누르지 않은 날짜(오늘이 24일인데 7일)가 선택된
// 채 달력을 가리는 창 -- 은 여기서도 그대로 막는다: 열 때와 다시 들어올 때
// 선택은 오늘 하나뿐이고, 상세는 달력 아래(폰) 또는 옆(데스크톱)에 있으며
// 달력을 가리지 않는다. 캐럿도 저절로 들어가지 않는다.
//
// 함께 지키는 것: 날짜 heading, "이 날은 기록이 없어요.", 일정 목록, 폰에서
// 상세가 안쪽 스크롤을 갖지 않는 것(한 화면 한 스크롤), 버튼이 실제로 눌리는 것.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-twobuttons-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-twobuttons-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4207;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'twobuttons1';

// ── the dead form must be gone from the source, not commented out ─────────
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const calendarCss = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
for (const token of [
  'calendar-quick-add', 'quickAddTitle', 'quickAddBusy', 'quickAddMessage',
  'quickAddFocus', 'onQuickAddInput', 'onQuickAddSubmit',
]) {
  if (manager.includes(token)) {
    throw new Error(`site-calendar-manager.js still carries "${token}" — the quick-add form was to be deleted, not commented out`);
  }
}
if (calendarCss.includes('calendar-quick-add')) {
  throw new Error('site-calendar.css still carries a .calendar-quick-add rule for markup that no longer exists');
}
// Whether the day detail is shown must not depend on reading the viewport at
// mount: that is how a phone once opened on a sheet nobody asked for.
if (/detailOpen:\s*usesFlowingDayDetail\(\)/.test(manager)) {
  throw new Error('the day detail must not be decided by the viewport at mount');
}
// No "what kind of record?" chooser between + 기록 and the editor.
for (const token of ['calendar-add-type', 'data-calendar-add-kind', '어떤 기록을']) {
  if (manager.includes(token)) throw new Error(`+ 기록 must open the editor directly; found a type chooser token "${token}"`);
}

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
<link rel="stylesheet" href="/site-calendar.css?v=${V}">
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<aside class="chat-sidebar chat-sidebar-desktop">
  <button type="button" data-calendar-view="all">캘린더</button>
  <button type="button" data-calendar-view="today">오늘</button>
</aside>
<main id="main-content" class="chat-home-shell" tabindex="0">
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
</main>
<pre id="calendar-result">pending</pre>
<script type="module">
const out=document.getElementById('calendar-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage,viewport:{width:innerWidth,height:innerHeight}})}},40000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const click=node=>{if(!node)throw new Error('missing node at stage: '+stage);node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))};
// Takes a getter: a background render (weather, holidays, the amount line)
// rebuilds the panel, so it is always read afresh.
const settle=async get=>{
  let previous=null,stable=0;
  for(let i=0;i<120;i+=1){
    const r=get().getBoundingClientRect();
    const current=r.height+r.top;
    if(previous!==null&&Math.abs(current-previous)<0.5){stable+=1;if(stable>=3)return}else stable=0;
    previous=current;
    await new Promise(r=>setTimeout(r,20));
  }
};
// What the caret is sitting on, named rather than guessed.
const caret=()=>{
  const node=document.activeElement;
  if(!node||node===document.body)return {tag:'(none)',cls:'',type:'',editable:false,insidePanel:false,dateTrigger:''};
  return {
    tag:node.tagName,
    cls:String(node.className||''),
    type:String(node.getAttribute?.('type')||''),
    editable:node.tagName==='INPUT'||node.tagName==='TEXTAREA'||node.isContentEditable===true,
    insidePanel:Boolean(node.closest?.('.calendar-day-panel')),
    dateTrigger:node.dataset?.calendarDateTrigger||'',
  };
};
try{
  localStorage.clear();
  localStorage.setItem('lotbi.calendar.settings.v1',JSON.stringify({showKoreaHolidays:false}));
  const forceDark=new URLSearchParams(location.search).get('theme')==='dark';
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch=(url,init)=>{
    const parsed=new URL(String(url),location.origin);
    if(parsed.pathname==='/v2/life/holidays'){
      const year=Number(parsed.searchParams.get('year')||new Date().getFullYear());
      return json({year,country:'KR',coverage_status:'VERIFIED',snapshot_version:'twobuttons-'+year,supported_years:[year],items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.origin!==location.origin)return json({items:[]});
    return nativeFetch(url,init);
  };
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const {createGuestCalendarRepository}=await import('/site-calendar-guest.js?v=${V}');
  createGuestCalendarRepository(localStorage,{createQuota:50,limit:100});
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=Object.fromEntries(parts.map(value=>[value.type,value.value]));
  // A busy day that is never today, so the empty-today and busy-day readings
  // never collide whatever the real date is.
  const busyDay=part.day==='12'?'13':'12';
  const busyDate=part.year+'-'+part.month+'-'+busyDay;

  const conversation=await import('/site-conversation.js?v=${V}');
  if(!conversation.mountConversation())throw new Error('conversation mount');
  if(forceDark)document.body.dataset.siteTheme='dark';

  const openCalendar=async()=>{
    click(document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]'));
    await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar modal');
    const modal=document.querySelector('.site-modal.site-calendar-modal');
    const content=modal.querySelector('.site-modal-content');
    await wait(()=>content?.dataset.calendarManagerView==='month','month view');
    await wait(()=>content?.getAttribute('aria-busy')!=='true','calendar idle');
    await new Promise(r=>setTimeout(r,120));
    await wait(()=>modal.querySelector('.calendar-month')?.getBoundingClientRect().width>0,'month geometry');
    return {modal,content};
  };
  const measure=node=>{const r=node.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),height:Math.round(r.height),width:Math.round(r.width)}};
  // What the Calendar shows without anyone pressing a date.
  const reading=modal=>{
    const panel=modal.querySelector('.calendar-day-panel');
    const grid=modal.querySelector('.calendar-month-grid');
    return {
      panelPresent:Boolean(panel),
      panelHidden:panel?panel.hidden===true:null,
      panelSelectedDate:panel?.dataset.selectedDate||'',
      panelPresentation:panel?.dataset.presentation||'',
      panelPosition:panel?getComputedStyle(panel).position:'',
      panelRect:panel&&!panel.hidden?measure(panel):null,
      gridRect:grid?measure(grid):null,
      selectedDates:[...modal.querySelectorAll('.calendar-date-cell[data-selected="true"]')].map(n=>n.dataset.calendarDate),
      todayDate:modal.querySelector('.calendar-date-cell[data-today="true"]')?.dataset.calendarDate||'',
      overlay:Boolean(modal.querySelector('.calendar-day-sheet-backdrop,.calendar-day-backdrop,[data-calendar-day-sheet]')),
      closeControl:Boolean(modal.querySelector('.calendar-day-close')),
      caret:caret(),
    };
  };
  const hit=node=>{
    if(!node)return false;
    const r=node.getBoundingClientRect();
    if(r.width<24||r.height<20)return false;
    const found=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
    return Boolean(found&&(found===node||node.contains(found)));
  };
  const addButtons=modal=>[...modal.querySelectorAll('.calendar-add-actions button')];

  let {modal,content}=await openCalendar();
  const desktop=innerWidth>900;
  const result={ok:true,desktop,viewport:{width:innerWidth,height:innerHeight},
    theme:document.body.dataset.siteTheme||'light'};

  // --- (1) opening the Calendar: today's detail, part of the page ---------
  result.onMount=reading(modal);
  // Give a late render (weather, amount line, holidays) a chance to move it.
  await new Promise(r=>setTimeout(r,400));
  result.onMountSettled=reading(modal);
  result.quickAddAnywhereOnMount=Boolean(
    modal.querySelector('[data-calendar-quick-add],[data-calendar-quick-add-title],[data-calendar-quick-add-save],.calendar-quick-add')
  );
  result.mountButtons=addButtons(modal).map(node=>node.textContent.trim());
  result.mountEmptySentence=(modal.querySelector('.calendar-day-panel')?.textContent||'').includes('오늘은 아직 기록이 없어요.');

  const cells=()=>[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')];
  const emptyCell=cells().find(node=>node.dataset.calendarDate!==busyDate&&node.dataset.today!=='true');
  const emptyDate=emptyCell.dataset.calendarDate;
  result.emptyDate=emptyDate;
  result.busyDate=busyDate;

  // --- (2) a tap on an empty day ----------------------------------------
  click(emptyCell);
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===emptyDate,'panel follows the tap');
  await settle(()=>modal.querySelector('.calendar-day-panel'));
  // A focus that arrives a frame late is still a focus nobody asked for.
  await new Promise(r=>setTimeout(r,250));
  const panel=modal.querySelector('.calendar-day-panel');
  result.empty={
    presentation:panel.dataset.presentation,
    position:getComputedStyle(panel).position,
    selectedDate:panel.dataset.selectedDate,
    rect:measure(panel),
    caret:caret(),
    // Nothing to type into, and nothing to press [저장] on.
    inputsInPanel:panel.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
    quickAddForm:Boolean(panel.querySelector('[data-calendar-quick-add],.calendar-quick-add')),
    buttons:addButtons(modal).map(node=>node.textContent.trim()),
    buttonsInPanel:panel.querySelectorAll('.calendar-add-actions button').length,
    buttonsInPinnedBar:modal.querySelectorAll('.calendar-action-slot[data-calendar-action-bar="pinned"] .calendar-add-actions button').length,
    buttonsHittable:addButtons(modal).every(hit),
    addImageAria:modal.querySelector('[data-calendar-add-image]')?.getAttribute('aria-label')||'',
    addDetailAria:modal.querySelector('[data-calendar-add]')?.getAttribute('aria-label')||'',
    heading:panel.querySelector('.calendar-day-heading')?.textContent?.trim()||'',
    emptySentence:panel.textContent.includes('이 날은 기록이 없어요.'),
    selectedDates:[...modal.querySelectorAll('.calendar-date-cell[data-selected="true"]')].map(n=>n.dataset.calendarDate),
    gridBottom:Math.round(modal.querySelector('.calendar-month-grid').getBoundingClientRect().bottom),
    gridRight:Math.round(modal.querySelector('.calendar-month-grid').getBoundingClientRect().right),
  };

  // --- (4) + 기록 opens the form straight away on the tapped day ----------
  click(modal.querySelector('[data-calendar-add]'));
  await wait(()=>modal.querySelector('.calendar-editor-dialog'),'form open');
  const editor=modal.querySelector('.calendar-editor-dialog');
  await new Promise(r=>setTimeout(r,80));
  result.editor={
    heading:editor.querySelector('#calendar-editor-heading')?.textContent?.trim()||'',
    date:editor.querySelector('.calendar-editor-date')?.value||'',
    question:editor.querySelector('.calendar-editor-title')?.closest('label')?.textContent||'',
    hasTitle:Boolean(editor.querySelector('.calendar-editor-title')),
    hasTime:Boolean(editor.querySelector('.calendar-editor-time')),
    hasMemo:Boolean(editor.querySelector('.calendar-editor-memo')),
    hasSave:Boolean(editor.querySelector('.calendar-editor-save')),
    focusOnTitle:document.activeElement===editor.querySelector('.calendar-editor-title'),
    dayDetailStillPresent:Boolean(modal.querySelector('.calendar-day-detail-backdrop')),
    modalDialogCount:modal.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
  };
  click(editor.querySelector('.calendar-editor-cancel'));
  await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'form closed');
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===emptyDate,'day detail restored after cancel');
  await new Promise(r=>setTimeout(r,120));
  result.editorReturn={
    dayDetailRestored:Boolean(modal.querySelector('.calendar-day-detail-backdrop')),
    selectedDate:modal.querySelector('.calendar-day-panel')?.dataset.selectedDate||'',
  };

  click(modal.querySelector('[data-calendar-add]'));
  await wait(()=>modal.querySelector('.calendar-editor-dialog'),'form reopened for save');
  const saveEditor=modal.querySelector('.calendar-editor-dialog');
  const saveTitle=saveEditor.querySelector('.calendar-editor-title');
  saveTitle.value='겹침 없는 기록';
  saveTitle.dispatchEvent(new Event('input',{bubbles:true}));
  click(saveEditor.querySelector('.calendar-editor-save'));
  await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'saved form closed');
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===emptyDate,'day detail restored after save');
  await wait(()=>[...modal.querySelectorAll('.calendar-day-event strong')].some(node=>node.textContent==='겹침 없는 기록'),'saved record visible in restored day detail');
  result.editorSaveReturn={
    dayDetailRestored:Boolean(modal.querySelector('.calendar-day-detail-backdrop')),
    selectedDate:modal.querySelector('.calendar-day-panel')?.dataset.selectedDate||'',
    savedTitleVisible:[...modal.querySelectorAll('.calendar-day-event strong')].some(node=>node.textContent==='겹침 없는 기록'),
  };

  // --- (3) a day that already has entries -------------------------------
  {
    const stamp=new Date().toISOString();
    const held=JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1')||'null')?.events||[];
    const seeded=held.slice();
    for(let i=0;i<8;i+=1){
      seeded.push({
        id:'guest_0000000'+i+'-0000-4000-8000-00000000000'+i,
        title:'가득 찬 하루 일정 '+(i+1),
        local_date:busyDate,
        local_datetime:busyDate+'T0'+(i+1)+':00:00',
        all_day:false,
        created_at:stamp,
        updated_at:stamp,
      });
    }
    localStorage.setItem('lotbi.guest.calendar.v1',JSON.stringify({version:2,created_count:seeded.length,events:seeded}));
  }
  // The month has to be re-read for the seed to exist as far as the panel is
  // concerned; stepping a month and back is the cheapest honest way to do it.
  const navButtons=modal.querySelectorAll('.calendar-nav-button');
  click(navButtons[1]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','next month settle');
  click(navButtons[0]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','back to month');
  await new Promise(r=>setTimeout(r,140));
  // Stepping back to this month lands on today, not on a date nobody pressed.
  result.afterMonthStep=reading(modal);
  await wait(()=>modal.querySelector('[data-calendar-date="'+busyDate+'"]'),'busy cell back');
  click(modal.querySelector('[data-calendar-date="'+busyDate+'"]'));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===busyDate,'busy day open');
  await settle(()=>modal.querySelector('.calendar-day-panel'));
  const busyPanel=modal.querySelector('.calendar-day-panel');
  const busyBody=busyPanel.querySelector('.calendar-day-body');
  result.busy={
    events:busyPanel.querySelectorAll('.calendar-day-event').length,
    titles:[...busyPanel.querySelectorAll('.calendar-day-event strong')].map(n=>n.textContent).slice(0,3),
    times:[...busyPanel.querySelectorAll('.calendar-day-event time')].map(n=>n.textContent).slice(0,3),
    rect:measure(busyPanel),
    bodyOverflow:getComputedStyle(busyBody).overflowY,
    panelOverflow:getComputedStyle(busyPanel).overflowY,
    buttons:addButtons(modal).map(n=>n.textContent.trim()),
    buttonsHittable:addButtons(modal).every(hit),
    emptySentence:/기록이 없어요/.test(busyPanel.textContent),
    caret:caret(),
    inputsInPanel:busyPanel.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
  };

  // --- (5) leave the Calendar and come back: today again -----------------
  click(modal.querySelector('.site-modal-close'));
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'calendar closed');
  await new Promise(r=>setTimeout(r,200));
  ({modal,content}=await openCalendar());
  result.reopen=reading(modal);
  await new Promise(r=>setTimeout(r,400));
  result.reopenSettled=reading(modal);
  result.quickAddAnywhereOnReopen=Boolean(
    modal.querySelector('[data-calendar-quick-add],[data-calendar-quick-add-title],[data-calendar-quick-add-save],.calendar-quick-add')
  );

  out.textContent=JSON.stringify(result);
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),viewport:{width:innerWidth,height:innerHeight}})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h, theme) {
  const src = `/${INNER_REL}${theme === 'dark' ? '?theme=dark' : ''}`;
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="${src}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},60000);
  <\/script></body></html>`;
}

function run(browser, w, h, {theme = 'light'} = {}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, theme), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=70000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 140000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}${theme === 'dark' ? ' dark' : ''}: ${v.error}`);
  return v;
}

// Month opens as the calendar alone. A date press is the only action that may
// create a selected-day popup/sheet.
function assertTodayInPage(label, when, value, r) {
  if (!r.todayDate) throw new Error(`${label}: ${when} — today is not on the month`);
  if (r.panelPresent) throw new Error(`${label}: ${when} — Month opened an unrequested day detail`);
  if (r.selectedDates.length) throw new Error(`${label}: ${when} — Month selected ${r.selectedDates.join(', ')} before a date press`);
  if (r.overlay) throw new Error(`${label}: ${when} — a sheet or backdrop covers the month`);
  if (r.closeControl) throw new Error(`${label}: ${when} — a close control exists without an open detail`);
  if (r.caret.insidePanel || r.caret.editable) throw new Error(`${label}: ${when} — the caret was moved without anyone asking (${r.caret.tag}.${r.caret.cls})`);
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const report = [];
try {
  waitServer();
  // 344 is a folded Fold; 1280 is the desk it has to keep working on.
  const cases = [[390, 844], [412, 915], [360, 780], [344, 800], [768, 900], [1280, 900]];
  for (const [w, h] of cases) report.push(run(browser, w, h));
  report.push(run(browser, 390, 844, {theme: 'dark'}));

  if (process.env.CALENDAR_DAY_PANEL_MEASURE_ONLY === '1') {
    console.log(JSON.stringify(report, null, 1));
  } else {
    for (const value of report) {
      const label = `${value.viewport.width}x${value.viewport.height}${value.theme === 'dark' ? ' dark' : ''}`;
      const fail = message => { throw new Error(`${label}: ${message}`); };
      const empty = value.empty, busy = value.busy, editor = value.editor;

      // ── 3. 캘린더를 열면 오늘이 화면의 일부로 보인다 ───────────────────
      assertTodayInPage(label, 'on mount', value, value.onMount);
      assertTodayInPage(label, 'a beat after mount', value, value.onMountSettled);
      assertTodayInPage(label, 'after stepping a month and back', value, value.afterMonthStep);
      assertTodayInPage(label, 'on re-entering the Calendar', value, value.reopen);
      assertTodayInPage(label, 'a beat after re-entering', value, value.reopenSettled);
      if (value.quickAddAnywhereOnMount || value.quickAddAnywhereOnReopen) fail('a quick-add form is still rendered somewhere in the Calendar');
      if (value.mountEmptySentence) fail('Month must not mount an automatic today detail');
      if (value.mountButtons.length) fail(`Month must not mount day actions before a date press, got [${value.mountButtons.join('|')}]`);

      // ── 1. 제목 입력칸도, [저장] 도, 커서도 없다 ───────────────────────
      if (empty.quickAddForm) fail('the quick-add form is still in the day detail');
      if (empty.inputsInPanel !== 0) fail(`the day detail still holds ${empty.inputsInPanel} input(s)`);
      if (busy.inputsInPanel !== 0) fail(`a day with entries still holds ${busy.inputsInPanel} input(s) in its detail`);
      if (empty.caret.editable) fail(`tapping a date put the caret in ${empty.caret.tag}.${empty.caret.cls} — a phone raises its keyboard for that`);
      // A popup/sheet moves focus into its explicit close control.
      if (!empty.caret.cls.includes('calendar-day-close')) fail(`tapping a date must focus the opened detail, got ${empty.caret.tag}.${empty.caret.cls}`);
      if (busy.caret.editable) fail(`a day with entries put the caret in ${busy.caret.tag}.${busy.caret.cls}`);
      if (empty.selectedDates.join(',') !== value.emptyDate) fail(`only the tapped date may be selected, got ${empty.selectedDates.join(', ')}`);

      // ── 2. 버튼 둘, 그리고 [+ 기록] 이 여는 것 ─────────────────────────
      // The pinned bar on a phone names the day a new record lands on; the
      // desk's detail already names it in its heading, so it just says + 기록.
      // Either way the accessible name carries the date (below).
      const [, month, day] = value.emptyDate.split('-').map(Number);
      const addLabel = () => '+ 기록';
      const expected = ['사진에서 기록 읽기', addLabel(month, day)];
      if (empty.buttons.join('|') !== expected.join('|')) fail(`a picked day must offer exactly ${expected.join(' then ')}, got [${empty.buttons.join('|')}]`);
      const [, busyMonth, busyDayNumber] = value.busyDate.split('-').map(Number);
      if (busy.buttons.join('|') !== ['사진에서 기록 읽기', addLabel(busyMonth, busyDayNumber)].join('|')) fail(`a day with entries must offer the same two buttons, got [${busy.buttons.join('|')}]`);
      if (empty.buttonsInPanel !== 2 || empty.buttonsInPinnedBar !== 0) fail(`the popup/sheet must own the two buttons, got pinned=${empty.buttonsInPinnedBar} panel=${empty.buttonsInPanel}`);
      if (!empty.buttonsHittable) fail('both buttons must be hit-testable on an empty day');
      if (!busy.buttonsHittable) fail('both buttons must stay reachable on a full day');
      if (empty.addImageAria !== `사진에서 일정·거래 정보를 읽어 ${month}월 ${day}일 기록 초안 만들기`) fail(`사진에서 기록 읽기 must name the date for assistive tech (${empty.addImageAria})`);
      if (empty.addDetailAria !== `${month}월 ${day}일에 기록 추가`) fail(`+ 기록 must name the date for assistive tech (${empty.addDetailAria})`);
      if (editor.date !== value.emptyDate) fail(`+ 기록 must open the form on the tapped day ${value.emptyDate}, got ${editor.date || '(empty)'}`);
      if (editor.heading !== '기록 추가') fail(`+ 기록 opened "${editor.heading}" instead of 기록 추가`);
      if (!editor.question.includes('무엇을 남길까요?')) fail(`the form must ask one question first, got "${editor.question}"`);
      if (!editor.hasTitle || !editor.hasTime || !editor.hasMemo || !editor.hasSave) fail(`+ 기록 must open the full form — 제목·시간·메모·저장 (${JSON.stringify(editor)})`);
      if (!editor.focusOnTitle) fail('the form must open on its question');
      if (editor.dayDetailStillPresent) fail('the day detail must be replaced while the record editor is open');
      if (editor.modalDialogCount !== 1) fail(`the editor must be the only active modal dialog, got ${editor.modalDialogCount}`);
      if (!value.editorReturn.dayDetailRestored || value.editorReturn.selectedDate !== value.emptyDate) fail('cancel must return to the same selected-day detail');
      if (!value.editorSaveReturn.dayDetailRestored || value.editorSaveReturn.selectedDate !== value.emptyDate || !value.editorSaveReturn.savedTitleVisible) fail('save must return to the same selected-day detail with the new record visible');

      // ── day detail content ─────────────────────────────────────────────
      if (!/^\d+월 \d+일 [일월화수목금토]요일$/.test(empty.heading)) fail(`the detail heading must name the day, got (${empty.heading})`);
      if (!empty.emptySentence) fail('an empty day must say 이 날은 기록이 없어요.');
      if (busy.emptySentence) fail('a day with entries must not say it has none');
      if (busy.events !== 8) fail(`a day with entries must list them (got ${busy.events})`);
      if (busy.times.join(',') !== '01:00,02:00,03:00') fail(`a day's records run in time order, got ${busy.times.join(',')}`);

      // ── geometry ───────────────────────────────────────────────────────
      const expectedPresentation = value.desktop ? 'MODAL' : 'SHEET';
      const expectedPosition = value.desktop ? 'relative' : 'fixed';
      if (empty.presentation !== expectedPresentation) fail(`expected ${expectedPresentation}, got ${empty.presentation}`);
      if (empty.position !== expectedPosition) fail(`expected ${expectedPosition} detail, got ${empty.position}`);
      if (empty.selectedDate !== value.emptyDate) fail(`the detail shows ${empty.selectedDate}, not the tapped ${value.emptyDate}`);
      if (empty.rect.left < -1 || empty.rect.right > value.viewport.width + 1) fail('the detail overflows sideways');
      if (value.desktop) {
        if (empty.rect.width < 420 || empty.rect.width > 540) fail(`the desktop detail must be a readable centered popup, got ${empty.rect.width}px`);
      } else if (Math.abs(empty.rect.bottom-value.viewport.height)>2) {
        fail('the mobile detail must rest on the viewport bottom');
      }
    }
    console.log('CALENDAR DAY PANEL TWO BUTTONS PASS', JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme,
      onMount: v.onMountSettled.panelSelectedDate === v.onMountSettled.todayDate ? 'today' : v.onMountSettled.panelSelectedDate,
      buttons: v.empty.buttons.join('+'),
      inputsInPanel: v.empty.inputsInPanel,
      caretAfterTap: v.empty.caret.dateTrigger ? 'date' : v.empty.caret.tag,
      panel: `${v.empty.presentation}/${v.empty.position}/${v.empty.rect.width}px`,
    }))));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
