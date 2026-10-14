// CALENDAR-DAY-PANEL-TWO-BUTTONS-01 — 소유자 확정 시안 04(2026-10-14) 기준으로 갱신.
//
// 선택한 날과 추가 버튼을 봉인한다. 실제 대화창(site-conversation.js)에서 캘린더
// 작업 공간을 열어 확인한다.
//
//  1. 선택한 날 목록에 "일정 제목" 입력칸과 [저장] 버튼이 없다. 날짜를 눌러도
//     커서가 들어가지 않는다(휴대폰 키보드가 뜨지 않는다).
//  2. 같은 역할 버튼은 한 화면에 하나 — 보이는 [M월 D일 일정 추가] 하나와
//     [사진으로 추가] 하나. 일정 추가는 고른 날짜로 입력 폼을 바로 연다(종류
//     고르기 단계 없음). 선택한 날 목록 안에 추가 버튼을 또 두지 않는다.
//  3. 선택한 날은 창이 아니라 화면의 일부다. 넓은 화면은 달력 오른쪽 카드,
//     휴대폰은 달력 아래 목록. 달력을 덮는 overlay·sheet·dialog가 없고, 열 때와
//     다시 들어올 때·달을 넘겼다 돌아올 때 선택은 오늘 하나뿐이다.
//  4. 취소·저장 뒤에는 같은 날로 돌아오고, 저장한 일정이 그 목록에 보인다.
//
// 함께 지키는 것: 날짜 heading, "일정이 없어요", 시간 순 일정 목록, 가로 넘침 없음.
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
// No "what kind of record?" chooser between + 일정 추가 and the editor.
for (const token of ['calendar-add-type', 'data-calendar-add-kind', '어떤 기록을']) {
  if (manager.includes(token)) throw new Error(`+ 일정 추가 must open the editor directly; found a type chooser token "${token}"`);
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
<link rel="stylesheet" href="/site-calendar-expense.css?v=${V}">
<link rel="stylesheet" href="/site-calendar-weather.css?v=${V}">
<link rel="stylesheet" href="/site-theme-tokens.css?v=${V}">
<link rel="stylesheet" href="/site-conversation.css?v=${V}">
<link rel="stylesheet" href="/site-consumer-design.css?v=${V}">
<link rel="stylesheet" href="/site-consumer-layout.css?v=${V}">
<link rel="stylesheet" href="/site-consumer-detail.css?v=${V}">
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
    insidePanel:Boolean(node.closest?.('.c4-daycard,.c4-agenda')),
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
    await wait(()=>modal.querySelector('.c4-mo-g')?.getBoundingClientRect().width>0,'month geometry');
    return {modal,content};
  };
  const measure=node=>{const r=node.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),height:Math.round(r.height),width:Math.round(r.width)}};
  const shown=node=>Boolean(node&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
  const visibleAll=(scope,selector)=>[...scope.querySelectorAll(selector)].filter(shown);
  // 선택한 날의 목록: 넓은 화면은 오른쪽 카드, 휴대폰은 달력 아래 목록. 보이는 것 하나만.
  const dayList=modal=>visibleAll(modal,'.c4-daycard,.c4-agenda')[0]||null;
  const overlayOpen=()=>Boolean(document.querySelector('.c4-dlg-backdrop,.calendar-day-sheet-backdrop,.calendar-day-backdrop,.calendar-day-detail-backdrop,[data-calendar-day-sheet],.calendar-day-panel'));
  // What the Calendar shows without anyone pressing a date.
  const reading=modal=>{
    const list=dayList(modal);
    return {
      design:modal.dataset.calendarDesign||'',
      listSelectedDate:list?.dataset.selectedDate||'',
      listPosition:list?getComputedStyle(list).position:'',
      listRect:list?measure(list):null,
      gridRect:modal.querySelector('.c4-mo-g')?measure(modal.querySelector('.c4-mo-g')):null,
      selectedDates:[...modal.querySelectorAll('.c4-mc[data-selected="true"]')].map(n=>n.dataset.calendarDate),
      todayDate:modal.querySelector('.c4-mc[data-today="true"]')?.dataset.calendarDate||'',
      overlay:overlayOpen(),
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
  const addButtons=modal=>visibleAll(modal,'[data-calendar-add]');
  const photoButtons=modal=>visibleAll(modal,'[data-calendar-add-image]');
  const actionsOf=modal=>{
    const all=[...addButtons(modal),...photoButtons(modal)];
    return {
      add:addButtons(modal).map(n=>n.textContent.trim()),
      addAria:addButtons(modal).map(n=>n.getAttribute('aria-label')||''),
      addDate:addButtons(modal).map(n=>n.dataset.calendarAddDate||''),
      photo:photoButtons(modal).map(n=>n.textContent.trim()),
      hittable:all.length>0&&all.every(hit),
      minHeight:Math.min(...all.map(n=>Math.round(n.getBoundingClientRect().height)),999),
    };
  };

  let {modal,content}=await openCalendar();
  const desktop=innerWidth>900;
  const result={ok:true,desktop,viewport:{width:innerWidth,height:innerHeight},
    theme:document.body.dataset.siteTheme||'light'};

  // --- (1) opening the Calendar: month with today selected, nothing covering it ---
  result.onMount=reading(modal);
  // Give a late render (weather, amount line, holidays) a chance to move it.
  await new Promise(r=>setTimeout(r,400));
  result.onMountSettled=reading(modal);
  result.quickAddAnywhereOnMount=Boolean(
    modal.querySelector('[data-calendar-quick-add],[data-calendar-quick-add-title],[data-calendar-quick-add-save],.calendar-quick-add')
  );
  result.mountActions=actionsOf(modal);

  const cells=()=>[...modal.querySelectorAll('.c4-mc[data-current-month="true"]')];
  const emptyCell=cells().find(node=>node.dataset.calendarDate!==busyDate&&node.dataset.today!=='true');
  const emptyDate=emptyCell.dataset.calendarDate;
  result.emptyDate=emptyDate;
  result.busyDate=busyDate;

  // --- (2) a tap on an empty day ----------------------------------------
  click(emptyCell);
  await wait(()=>dayList(modal)?.dataset.selectedDate===emptyDate,'day list follows the tap');
  await settle(()=>dayList(modal));
  // A focus that arrives a frame late is still a focus nobody asked for.
  await new Promise(r=>setTimeout(r,250));
  const list=dayList(modal);
  result.empty={
    position:getComputedStyle(list).position,
    selectedDate:list.dataset.selectedDate,
    rect:measure(list),
    // Read in the same frame as the list: tapping a date may scroll the page.
    gridRect:measure(modal.querySelector('.c4-mo-g')),
    caret:caret(),
    // Nothing to type into, and nothing to press [저장] on.
    inputsInList:list.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
    quickAddForm:Boolean(list.querySelector('[data-calendar-quick-add],.calendar-quick-add')),
    buttonsInList:list.querySelectorAll('button[data-calendar-add],button[data-calendar-add-image]').length,
    actions:actionsOf(modal),
    heading:list.querySelector('.calendar-day-heading')?.textContent?.trim()||'',
    emptySentence:/일정이 없어요/.test(list.textContent),
    overlay:overlayOpen(),
    selectedDates:[...modal.querySelectorAll('.c4-mc[data-selected="true"]')].map(n=>n.dataset.calendarDate),
  };

  // --- (4) 일정 추가 opens the form straight away on the tapped day ----------
  click(addButtons(modal)[0]);
  await wait(()=>document.querySelector('.c4-editor'),'form open');
  const editor=document.querySelector('.c4-editor');
  await new Promise(r=>setTimeout(r,80));
  result.editor={
    heading:editor.querySelector('#calendar-editor-heading')?.textContent?.trim()||'',
    date:editor.querySelector('.calendar-editor-date')?.value||'',
    hasTitle:Boolean(editor.querySelector('.calendar-editor-title')),
    hasTime:Boolean(editor.querySelector('.calendar-editor-time')),
    hasMemo:Boolean(editor.querySelector('.calendar-editor-memo')),
    hasSave:Boolean(editor.querySelector('.calendar-editor-save')),
    focusOnTitle:document.activeElement===editor.querySelector('.calendar-editor-title'),
    typeChooser:Boolean(document.querySelector('.calendar-add-type,[data-calendar-add-kind]')),
    modalDialogCount:document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
  };
  click(editor.querySelector('.calendar-editor-cancel'));
  await wait(()=>!document.querySelector('.c4-editor'),'form closed');
  await wait(()=>dayList(modal)?.dataset.selectedDate===emptyDate,'day list kept after cancel');
  await new Promise(r=>setTimeout(r,120));
  result.editorReturn={selectedDate:dayList(modal)?.dataset.selectedDate||''};

  click(addButtons(modal)[0]);
  await wait(()=>document.querySelector('.c4-editor'),'form reopened for save');
  const saveEditor=document.querySelector('.c4-editor');
  const saveTitle=saveEditor.querySelector('.calendar-editor-title');
  saveTitle.value='겹침 없는 일정';
  saveTitle.dispatchEvent(new Event('input',{bubbles:true}));
  click(saveEditor.querySelector('.calendar-editor-save'));
  await wait(()=>!document.querySelector('.c4-editor'),'saved form closed');
  await wait(()=>dayList(modal)?.dataset.selectedDate===emptyDate,'day list kept after save');
  await wait(()=>[...dayList(modal).querySelectorAll('.c4-dc-tt')].some(node=>node.textContent==='겹침 없는 일정'),'saved record visible in the day list');
  result.editorSaveReturn={
    selectedDate:dayList(modal)?.dataset.selectedDate||'',
    savedTitleVisible:[...dayList(modal).querySelectorAll('.c4-dc-tt')].some(node=>node.textContent==='겹침 없는 일정'),
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
  // The month has to be re-read for the seed to exist as far as the list is
  // concerned; stepping a month and back is the cheapest honest way to do it.
  const navButtons=modal.querySelectorAll('.calendar-nav-button');
  click(navButtons[1]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','next month settle');
  click(navButtons[0]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','back to month');
  await new Promise(r=>setTimeout(r,140));
  // Stepping back to this month lands on today, not on a date nobody pressed.
  result.afterMonthStep=reading(modal);
  await wait(()=>modal.querySelector('.c4-mc[data-calendar-date="'+busyDate+'"]'),'busy cell back');
  click(modal.querySelector('.c4-mc[data-calendar-date="'+busyDate+'"]'));
  await wait(()=>dayList(modal)?.dataset.selectedDate===busyDate,'busy day open');
  await settle(()=>dayList(modal));
  const busyList=dayList(modal);
  result.busy={
    events:busyList.querySelectorAll('.c4-dc-ev').length,
    titles:[...busyList.querySelectorAll('.c4-dc-tt')].map(n=>n.textContent).slice(0,3),
    times:[...busyList.querySelectorAll('.c4-dc-time')].map(n=>n.textContent).slice(0,3),
    actions:actionsOf(modal),
    emptySentence:/일정이 없어요/.test(busyList.textContent),
    caret:caret(),
    inputsInList:busyList.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
    overlay:overlayOpen(),
  };

  // --- (5) leave the Calendar and come back: today again -----------------
  click(modal.querySelector(':scope > .site-modal-header .site-modal-close'));
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

// CALENDAR-DESIGN-04: the approved workspace opens on the month with today
// selected, and the selected day's list is part of the page (right card on a
// desk, under the month on a phone) -- never a window over the month.
function assertMonthWithToday(label, when, r) {
  if (r.design !== 'c4') throw new Error(`${label}: ${when} — the workspace Calendar is not the approved design 04 (${r.design || 'none'})`);
  if (!r.todayDate) throw new Error(`${label}: ${when} — today is not on the month`);
  if (r.selectedDates.join(',') !== r.todayDate) throw new Error(`${label}: ${when} — selected dates are ${r.selectedDates.join(', ')}`);
  if (r.listSelectedDate !== r.todayDate) throw new Error(`${label}: ${when} — the day list shows ${r.listSelectedDate || '(nothing)'}, not today`);
  if (r.overlay) throw new Error(`${label}: ${when} — a sheet, dialog or backdrop covers the month`);
  if (r.caret.editable) throw new Error(`${label}: ${when} — the caret moved into an editor (${r.caret.tag}.${r.caret.cls})`);
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
      const addLabel = date => { const [, m, d] = date.split('-').map(Number); return `${m}월 ${d}일 일정 추가`; };
      const addAria = date => { const [, m, d] = date.split('-').map(Number); return `${m}월 ${d}일에 일정 추가`; };

      // ── 3. 캘린더를 열면 월과 선택된 오늘이 보이고, 아무것도 덮지 않는다 ─────
      assertMonthWithToday(label, 'on mount', value.onMount);
      assertMonthWithToday(label, 'a beat after mount', value.onMountSettled);
      assertMonthWithToday(label, 'after stepping a month and back', value.afterMonthStep);
      assertMonthWithToday(label, 'on re-entering the Calendar', value.reopen);
      assertMonthWithToday(label, 'a beat after re-entering', value.reopenSettled);
      if (value.quickAddAnywhereOnMount || value.quickAddAnywhereOnReopen) fail('a quick-add form is still rendered somewhere in the Calendar');

      // ── 2. 같은 역할 버튼은 한 화면에 하나 ───────────────────────────────
      const today = value.onMount.todayDate;
      for (const [when, actions, date] of [['on mount', value.mountActions, today], ['after tapping an empty day', empty.actions, value.emptyDate], ['on a full day', busy.actions, value.busyDate]]) {
        if (actions.add.join('|') !== addLabel(date)) fail(`${when}: exactly one visible add action reading "${addLabel(date)}" is expected, got [${actions.add.join('|')}]`);
        if (actions.addAria.join('|') !== addAria(date)) fail(`${when}: the add action must name the date for assistive tech, got [${actions.addAria.join('|')}]`);
        if (actions.addDate.join('|') !== date) fail(`${when}: the add action must target ${date}, got [${actions.addDate.join('|')}]`);
        if (actions.photo.join('|') !== '사진으로 추가') fail(`${when}: exactly one visible 사진으로 추가 is expected, got [${actions.photo.join('|')}]`);
        if (!actions.hittable) fail(`${when}: the add and photo actions must be hit-testable`);
        if (actions.minHeight < 44) fail(`${when}: the add and photo actions must be at least 44px tall, got ${actions.minHeight}px`);
      }
      if (empty.buttonsInList !== 0) fail(`the day list must not repeat the add actions, got ${empty.buttonsInList}`);

      // ── 1. 제목 입력칸도, [저장] 도, 커서도 없다 ───────────────────────
      if (empty.quickAddForm) fail('the quick-add form is still in the day list');
      if (empty.inputsInList !== 0) fail(`the day list still holds ${empty.inputsInList} input(s)`);
      if (busy.inputsInList !== 0) fail(`a day with entries still holds ${busy.inputsInList} input(s) in its list`);
      if (empty.caret.editable) fail(`tapping a date put the caret in ${empty.caret.tag}.${empty.caret.cls} — a phone raises its keyboard for that`);
      if (busy.caret.editable) fail(`a day with entries put the caret in ${busy.caret.tag}.${busy.caret.cls}`);
      if (empty.selectedDates.join(',') !== value.emptyDate) fail(`only the tapped date may be selected, got ${empty.selectedDates.join(', ')}`);
      if (empty.overlay || busy.overlay) fail('tapping a date must not open a window over the month');

      // ── 4. 일정 추가가 여는 것 ─────────────────────────────────────────
      if (editor.date !== value.emptyDate) fail(`일정 추가 must open the form on the tapped day ${value.emptyDate}, got ${editor.date || '(empty)'}`);
      if (editor.heading !== '일정 추가') fail(`일정 추가 opened "${editor.heading}" instead of 일정 추가`);
      if (editor.typeChooser) fail('일정 추가 must open the form directly, not a kind chooser');
      if (!editor.hasTitle || !editor.hasTime || !editor.hasMemo || !editor.hasSave) fail(`일정 추가 must open the full form — 제목·시간·메모·저장 (${JSON.stringify(editor)})`);
      if (!editor.focusOnTitle) fail('the form must open on its title');
      if (editor.modalDialogCount !== 1) fail(`the editor must be the only active modal dialog, got ${editor.modalDialogCount}`);
      if (value.editorReturn.selectedDate !== value.emptyDate) fail('cancel must return to the same selected day');
      if (value.editorSaveReturn.selectedDate !== value.emptyDate || !value.editorSaveReturn.savedTitleVisible) fail('save must return to the same selected day with the new record visible');

      // ── day list content ───────────────────────────────────────────────
      // LIFE UX 01 names the day in full on the desk card ("10월 5일 월요일", the
      // editor's words); the phone list under the month uses the short form.
      const headingPattern = value.desktop ? /^\d+월 \d+일 [일월화수목금토]요일$/ : /^\d+월 \d+일 \([일월화수목금토]\)$/;
      if (!headingPattern.test(empty.heading)) fail(`the day list heading must name the day, got (${empty.heading})`);
      if (!empty.emptySentence) fail('an empty day must say 일정이 없어요');
      if (busy.emptySentence) fail('a day with entries must not say it has none');
      if (busy.events !== 8) fail(`a day with entries must list them (got ${busy.events})`);
      if (busy.times.join(',') !== '오전 1:00,오전 2:00,오전 3:00') fail(`a day's records run in time order, got ${busy.times.join(',')}`);

      // ── geometry: part of the page, beside (desk) or under (phone) the month ──
      if (empty.position === 'fixed' || empty.position === 'absolute') fail(`the day list must flow with the page, got position ${empty.position}`);
      if (empty.rect.left < -1 || empty.rect.right > value.viewport.width + 1) fail('the day list overflows sideways');
      const grid = empty.gridRect;
      if (value.desktop) {
        if (empty.rect.left < grid.right - 1) fail(`on a desk the day card sits beside the month (card left ${empty.rect.left}, month right ${grid.right})`);
      } else if (empty.rect.top < grid.bottom - 1) fail(`on a phone the day list sits under the month (list top ${empty.rect.top}, month bottom ${grid.bottom})`);
    }
    console.log('CALENDAR DAY PANEL TWO BUTTONS PASS (design 04)', JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme,
      onMount: v.onMountSettled.listSelectedDate === v.onMountSettled.todayDate ? 'today' : v.onMountSettled.listSelectedDate,
      actions: [...v.empty.actions.add, ...v.empty.actions.photo].join('+'),
      inputsInList: v.empty.inputsInList,
      caretAfterTap: v.empty.caret.dateTrigger ? 'date' : v.empty.caret.tag,
      list: `${v.empty.position}/${v.empty.rect.width}px`,
    }))));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
