// CALENDAR-DAY-PANEL-TWO-BUTTONS-01
//
// 대표 지시 세 가지를 봉인한다.
//
//  1. 날짜 창에 "일정 제목" 입력칸과 [저장] 버튼이 없다. 커서도 들어가지 않는다.
//  2. 그 자리에는 버튼이 딱 둘이다 — [이미지로 등록] [직접 등록]. [직접 등록]은
//     그 날짜로 전체 입력 폼을 연다.
//  3. 캘린더를 열었을 뿐인데 날짜 창이 저절로 뜨지 않는다. 사용자가 날짜를 직접
//     누르기 전에는 어떤 날짜 창도 뜨지 않으며, 닫고 나갔다 다시 들어와도 같다.
//
// 세 번째가 이 파일이 생긴 이유다. 직전 판(PR #272)은 mount 시점의
// `detailOpen: usesFlowingDayDetail()` 때문에 폰에서 캘린더를 열자마자 아무도
// 누르지 않은 날짜의 창이 이미 떠 있었다. 여기서는 mount 직후를 실제로 재서
// `.calendar-day-panel[hidden]` 인지 확인한다.
//
// 함께 지키는 것: [접기] [닫기], "등록된 일정이 없어요.", 일정이 있는 날의 목록,
// 앵커된 팝오버 기하(달력이 가려지지 않고 다른 날짜가 계속 눌린다).
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

// The panel may cover a couple of date rows. It may not cover the month.
const SHARE_MAX = 0.58;
const EXPECTED_BUTTONS = ['이미지로 등록', '직접 등록'];

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
// The one that actually caused the phantom panel. A mount that reads the
// viewport to decide whether the day panel is open is the defect itself.
if (/detailOpen:\s*usesFlowingDayDetail\(\)/.test(manager)) {
  throw new Error('the Calendar must not mount with the day panel already open — that is the window for a date nobody pressed');
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
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const settle=async node=>{
  let previous=null,stable=0;
  for(let i=0;i<120;i+=1){
    const r=node.getBoundingClientRect();
    const current=r.height+r.top;
    if(previous!==null&&Math.abs(current-previous)<0.5){stable+=1;if(stable>=3)return}else stable=0;
    previous=current;
    await new Promise(r=>setTimeout(r,20));
  }
};
// What the caret is sitting on, named rather than guessed. A text box anywhere
// is the thing 대표 asked to be gone; "nothing in particular" is the pass.
const caret=()=>{
  const node=document.activeElement;
  if(!node||node===document.body)return {tag:'(none)',cls:'',type:'',editable:false,insidePanel:false};
  return {
    tag:node.tagName,
    cls:String(node.className||''),
    type:String(node.getAttribute?.('type')||''),
    editable:node.tagName==='INPUT'||node.tagName==='TEXTAREA'||node.isContentEditable===true,
    insidePanel:Boolean(node.closest?.('.calendar-day-panel')),
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
  const guestRepo=createGuestCalendarRepository(localStorage,{createQuota:50,limit:100});
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const part=Object.fromEntries(parts.map(value=>[value.type,value.value]));
  const busyDate=part.year+'-'+part.month+'-12';

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
  // Everything a mount must NOT have put on screen, read straight off the DOM.
  const mountReading=modal=>{
    const panel=modal.querySelector('.calendar-day-panel');
    const box=panel&&panel.hidden!==true?panel.getBoundingClientRect():null;
    return {
      panelPresent:Boolean(panel),
      panelHidden:panel?panel.hidden===true:null,
      panelSelectedDate:panel?.dataset.selectedDate||'',
      panelRect:box?{top:Math.round(box.top),left:Math.round(box.left),width:Math.round(box.width),height:Math.round(box.height)}:null,
      selectedDates:[...modal.querySelectorAll('.calendar-date-cell[data-selected="true"]')].map(n=>n.dataset.calendarDate),
      todayDate:modal.querySelector('.calendar-date-cell[data-today="true"]')?.dataset.calendarDate||'',
      caret:caret(),
    };
  };

  let {modal,content}=await openCalendar();
  const desktop=innerWidth>900;
  const result={ok:true,desktop,viewport:{width:innerWidth,height:innerHeight},
    theme:document.body.dataset.siteTheme||'light'};

  // --- (1) opening the Calendar shows the Calendar ----------------------
  result.onMount=mountReading(modal);
  // Give a late render (weather, expense strip, holidays) a chance to raise it
  // behind our back before we call it closed.
  await new Promise(r=>setTimeout(r,400));
  result.onMountSettled=mountReading(modal);
  result.quickAddAnywhereOnMount=Boolean(
    modal.querySelector('[data-calendar-quick-add],[data-calendar-quick-add-title],[data-calendar-quick-add-save],.calendar-quick-add')
  );

  const cells=()=>[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')];
  const emptyCell=cells().find(node=>node.dataset.calendarDate!==busyDate&&node.dataset.selected!=='true');
  const emptyDate=emptyCell.dataset.calendarDate;
  result.emptyDate=emptyDate;
  result.busyDate=busyDate;

  // --- (2) a tap on an empty day ----------------------------------------
  click(emptyCell);
  await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'panel open');
  const panel=modal.querySelector('.calendar-day-panel');
  await settle(panel);
  // A focus that arrives a frame late is still a focus 대표 did not ask for.
  await new Promise(r=>setTimeout(r,250));
  const measure=node=>{const r=node.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),height:Math.round(r.height),width:Math.round(r.width)}};
  const hit=node=>{
    if(!node)return false;
    const r=node.getBoundingClientRect();
    if(r.width<24||r.height<20)return false;
    const found=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
    return Boolean(found&&(found===node||node.contains(found)));
  };
  const anchorRect=modal.querySelector('[data-calendar-date="'+emptyDate+'"]').getBoundingClientRect();
  const panelRect=panel.getBoundingClientRect();
  const addButtons=()=>[...panel.querySelectorAll('.calendar-add-actions button')];
  result.empty={
    presentation:panel.dataset.presentation,
    selectedDate:panel.dataset.selectedDate,
    rect:measure(panel),
    share:panelRect.height/innerHeight,
    caret:caret(),
    // Nothing to type into, and nothing to press [저장] on.
    inputsInPanel:panel.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
    quickAddForm:Boolean(panel.querySelector('[data-calendar-quick-add],.calendar-quick-add')),
    quickAddTitle:Boolean(panel.querySelector('[data-calendar-quick-add-title],.calendar-quick-add-title')),
    quickAddSave:Boolean(panel.querySelector('[data-calendar-quick-add-save],.calendar-quick-add-save')),
    buttons:addButtons().map(node=>node.textContent.trim()),
    buttonsHittable:addButtons().every(hit),
    addImageAria:panel.querySelector('[data-calendar-add-image]')?.getAttribute('aria-label')||'',
    addDetailAria:panel.querySelector('[data-calendar-add]')?.getAttribute('aria-label')||'',
    // 창 머리의 두 컨트롤은 그대로.
    toggleLabel:panel.querySelector('.calendar-day-toggle')?.textContent?.trim()||'',
    closeLabel:panel.querySelector('.calendar-day-close')?.textContent?.trim()||'',
    heading:panel.querySelector('.calendar-day-heading')?.textContent?.trim()||'',
    emptySentence:panel.textContent.includes('등록된 일정이 없어요'),
    arrow:panel.dataset.arrow||'',
    anchoredToCell:Math.min(Math.abs(panelRect.top-anchorRect.bottom),Math.abs(panelRect.bottom-anchorRect.top))<=24,
    pinnedToViewportBottom:Math.abs(panelRect.bottom-innerHeight)<2,
    monthVisible:(()=>{
      const month=modal.querySelector('.calendar-month').getBoundingClientRect();
      const covered=Math.max(0,Math.min(month.bottom,panelRect.bottom)-Math.max(month.top,panelRect.top));
      return {monthHeight:Math.round(month.height),coveredByPanel:Math.round(covered)};
    })(),
    tappableDates:cells().filter(node=>{
      const r=node.getBoundingClientRect();
      const y=Math.round(r.top+r.height/2);
      if(y<0||y>innerHeight)return false;
      const found=document.elementFromPoint(Math.round(r.left+r.width/2),y);
      return Boolean(found&&node.contains(found));
    }).length,
    totalDates:cells().length,
  };

  // --- (4) 직접 등록 opens the full form, on the day that was tapped -------
  click(panel.querySelector('[data-calendar-add]'));
  await wait(()=>modal.querySelector('.calendar-editor-dialog'),'full form open');
  const editor=modal.querySelector('.calendar-editor-dialog');
  await new Promise(r=>setTimeout(r,80));
  result.editor={
    heading:editor.querySelector('#calendar-editor-heading')?.textContent?.trim()||'',
    date:editor.querySelector('.calendar-editor-date')?.value||'',
    // 제목·시간·메모가 다 있는 그 폼.
    hasTitle:Boolean(editor.querySelector('.calendar-editor-title')),
    hasTime:Boolean(editor.querySelector('.calendar-editor-time')),
    hasMemo:Boolean(editor.querySelector('.calendar-editor-memo')),
    hasSave:Boolean(editor.querySelector('.calendar-editor-save')),
  };
  click(editor.querySelector('.calendar-editor-cancel'));
  await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'full form closed');
  await new Promise(r=>setTimeout(r,120));

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
  // Stepping months is not pressing a date either.
  result.afterMonthStep=mountReading(modal);
  await wait(()=>modal.querySelector('[data-calendar-date="'+busyDate+'"]'),'busy cell back');
  click(modal.querySelector('[data-calendar-date="'+busyDate+'"]'));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===busyDate,'busy day open');
  const busyPanel=modal.querySelector('.calendar-day-panel');
  await settle(busyPanel);
  const busyBody=busyPanel.querySelector('.calendar-day-body');
  const busyRect=busyPanel.getBoundingClientRect();
  result.busy={
    events:busyPanel.querySelectorAll('.calendar-day-event').length,
    titles:[...busyPanel.querySelectorAll('.calendar-day-event strong')].map(n=>n.textContent).slice(0,3),
    share:busyRect.height/innerHeight,
    rect:measure(busyPanel),
    bodyScrolls:busyBody.scrollHeight-busyBody.clientHeight>4,
    buttons:[...busyPanel.querySelectorAll('.calendar-add-actions button')].map(n=>n.textContent.trim()),
    buttonsHittable:[...busyPanel.querySelectorAll('.calendar-add-actions button')].every(hit),
    emptySentence:busyPanel.textContent.includes('등록된 일정이 없어요'),
    caret:caret(),
    inputsInPanel:busyPanel.querySelectorAll('input,textarea,select,[contenteditable="true"]').length,
  };

  // --- (5) 닫기, then leave the Calendar and come back -------------------
  click(busyPanel.querySelector('.calendar-day-close'));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.hidden===true,'닫기 dismiss');
  result.afterClose=mountReading(modal);

  click(modal.querySelector('.site-modal-close'));
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'calendar closed');
  await new Promise(r=>setTimeout(r,200));
  ({modal,content}=await openCalendar());
  result.reopen=mountReading(modal);
  await new Promise(r=>setTimeout(r,400));
  result.reopenSettled=mountReading(modal);
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

// "창이 없다"는 것은 패널 요소가 hidden 이고, 아무 좌표도 차지하지 않고, 커서가
// 그 안에 없다는 뜻이다. 셋을 모두 잰다.
//
// 날짜 칸의 data-selected 는 창이 아니라 키보드 로빙의 과녁이다 -- 방향키가
// 어디서 출발할지를 정하는 값이라 없앨 수 없다. 대신 그것이 '오늘'에 머무는지를
// 본다: 오늘이 아닌 날짜가 미리 선택돼 있으면 사용자가 가지 않은 곳에 데려다
// 놓은 것이고, 대표가 보낸 화면(오늘은 24일인데 7일이 선택돼 있던 것)이 그것이다.
function assertNoDayWindow(label, when, reading) {
  if (reading.panelHidden !== true) {
    throw new Error(`${label}: ${when} — a day window is on screen for ${reading.panelSelectedDate || '(no date)'} at ${JSON.stringify(reading.panelRect)}; nobody pressed a date`);
  }
  if (reading.panelRect) throw new Error(`${label}: ${when} — the day panel still occupies ${JSON.stringify(reading.panelRect)}`);
  if (reading.caret.insidePanel) throw new Error(`${label}: ${when} — the caret is inside the day panel (${reading.caret.tag}.${reading.caret.cls})`);
  if (reading.selectedDates.length > 1) {
    throw new Error(`${label}: ${when} — ${reading.selectedDates.length} date cells are marked selected at once (${reading.selectedDates.join(', ')})`);
  }
}

// On a fresh entry the roving target must be today and nothing else.
function assertRovingTargetIsToday(label, when, reading) {
  if (!reading.todayDate) return;
  const stray = reading.selectedDates.filter(date => date !== reading.todayDate);
  if (stray.length) {
    throw new Error(`${label}: ${when} — ${stray.join(', ')} is pre-selected while today is ${reading.todayDate}; nobody pressed it`);
  }
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
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
      const empty = value.empty, busy = value.busy, editor = value.editor;

      // ── 3. 캘린더를 열면 달력만 보인다 ─────────────────────────────────
      assertNoDayWindow(label, 'on mount', value.onMount);
      assertNoDayWindow(label, 'a beat after mount', value.onMountSettled);
      assertRovingTargetIsToday(label, 'on mount', value.onMountSettled);
      assertNoDayWindow(label, 'after stepping a month and back', value.afterMonthStep);
      assertNoDayWindow(label, 'after 닫기', value.afterClose);
      assertNoDayWindow(label, 'on re-entering the Calendar', value.reopen);
      assertNoDayWindow(label, 'a beat after re-entering', value.reopenSettled);
      assertRovingTargetIsToday(label, 'on re-entering the Calendar', value.reopenSettled);
      if (value.quickAddAnywhereOnMount || value.quickAddAnywhereOnReopen) {
        throw new Error(`${label}: a quick-add form is still rendered somewhere in the Calendar`);
      }

      // ── 1. 제목 입력칸도, [저장] 도, 커서도 없다 ───────────────────────
      if (empty.quickAddForm) throw new Error(`${label}: the quick-add form is still in the day panel`);
      if (empty.quickAddTitle) throw new Error(`${label}: the 일정 제목 box is still in the day panel`);
      if (empty.quickAddSave) throw new Error(`${label}: the [저장] button is still in the day panel`);
      if (empty.inputsInPanel !== 0) {
        throw new Error(`${label}: the day panel still holds ${empty.inputsInPanel} input(s); it is meant to hold two buttons`);
      }
      if (busy.inputsInPanel !== 0) {
        throw new Error(`${label}: a day with entries still holds ${busy.inputsInPanel} input(s) in its panel`);
      }
      if (empty.caret.editable) {
        throw new Error(`${label}: tapping a date put the caret in ${empty.caret.tag}.${empty.caret.cls} — a phone raises its keyboard for that`);
      }
      if (empty.caret.insidePanel) {
        throw new Error(`${label}: tapping a date moved the caret into the panel (${empty.caret.tag}.${empty.caret.cls})`);
      }
      if (busy.caret.editable) throw new Error(`${label}: a day with entries put the caret in ${busy.caret.tag}.${busy.caret.cls}`);

      // ── 2. 버튼 둘, 그리고 [직접 등록] 이 여는 것 ──────────────────────
      if (empty.buttons.join('|') !== EXPECTED_BUTTONS.join('|')) {
        throw new Error(`${label}: the day panel must offer exactly ${EXPECTED_BUTTONS.join(' then ')}, got [${empty.buttons.join('|')}]`);
      }
      if (busy.buttons.join('|') !== EXPECTED_BUTTONS.join('|')) {
        throw new Error(`${label}: a day with entries must offer the same two buttons, got [${busy.buttons.join('|')}]`);
      }
      if (!empty.buttonsHittable) throw new Error(`${label}: both buttons must be hit-testable on an empty day`);
      if (!busy.buttonsHittable) throw new Error(`${label}: both buttons must stay reachable on a full day`);
      if (!/\d+월 \d+일에 이미지로 일정 등록/.test(empty.addImageAria)) {
        throw new Error(`${label}: 이미지로 등록 must name the date for assistive tech (${empty.addImageAria})`);
      }
      if (!/\d+월 \d+일 일정을 직접 입력해서 등록/.test(empty.addDetailAria)) {
        throw new Error(`${label}: 직접 등록 must name the date for assistive tech (${empty.addDetailAria})`);
      }
      if (editor.date !== value.emptyDate) {
        throw new Error(`${label}: 직접 등록 must open the full form on the tapped day ${value.emptyDate}, got ${editor.date || '(empty)'}`);
      }
      if (editor.heading !== '일정 등록') throw new Error(`${label}: 직접 등록 opened "${editor.heading}" instead of the 일정 등록 form`);
      if (!editor.hasTitle || !editor.hasTime || !editor.hasMemo || !editor.hasSave) {
        throw new Error(`${label}: 직접 등록 must open the full form — 제목·시간·메모·저장 (${JSON.stringify(editor)})`);
      }

      // ── 건드리지 말라고 한 것들 ────────────────────────────────────────
      if (empty.toggleLabel !== '접기') throw new Error(`${label}: [접기] changed (${empty.toggleLabel})`);
      if (empty.closeLabel !== '닫기') throw new Error(`${label}: [닫기] changed (${empty.closeLabel})`);
      if (!/^\d{4}년 \d+월 \d+일 .요일$/.test(empty.heading)) throw new Error(`${label}: the panel heading changed (${empty.heading})`);
      if (!empty.emptySentence) throw new Error(`${label}: an empty day must still say 등록된 일정이 없어요`);
      if (busy.emptySentence) throw new Error(`${label}: a day with entries must not say 등록된 일정이 없어요`);
      if (busy.events !== 8) throw new Error(`${label}: a day with entries must list them (got ${busy.events})`);
      if (!busy.bodyScrolls) throw new Error(`${label}: a full day must scroll inside the panel, not grow it`);

      // ── 기하: 앵커된 팝오버가 달력을 덮지 않는다 ───────────────────────
      if (empty.presentation !== 'POPOVER') throw new Error(`${label}: the day panel must be the anchored popover (got ${empty.presentation})`);
      if (empty.selectedDate !== value.emptyDate) throw new Error(`${label}: the panel opened on ${empty.selectedDate}, not the tapped ${value.emptyDate}`);
      if (empty.rect.top < -1) throw new Error(`${label}: the panel escapes the top of the viewport`);
      if (empty.rect.left < -1 || empty.rect.right > value.viewport.width + 1) throw new Error(`${label}: the panel overflows sideways`);
      if (empty.share > SHARE_MAX) {
        throw new Error(`${label}: the panel covers ${(empty.share * 100).toFixed(1)}% of the viewport, limit ${(SHARE_MAX * 100).toFixed(0)}%`);
      }
      if (busy.share > SHARE_MAX) {
        throw new Error(`${label}: a full day's panel covers ${(busy.share * 100).toFixed(1)}%, limit ${(SHARE_MAX * 100).toFixed(0)}%`);
      }

      if (value.desktop) continue;

      if (empty.pinnedToViewportBottom) throw new Error(`${label}: the panel is welded to the bottom of the screen`);
      if (!empty.anchoredToCell) throw new Error(`${label}: the panel must sit against the tapped date's row`);
      if (!empty.arrow) throw new Error(`${label}: the panel must point at the date it belongs to`);
      if (empty.tappableDates < 5) {
        throw new Error(`${label}: only ${empty.tappableDates} of ${empty.totalDates} dates are tappable with the panel open`);
      }
      const {monthHeight, coveredByPanel} = empty.monthVisible;
      if (coveredByPanel > monthHeight * 0.5) {
        throw new Error(`${label}: the panel covers ${coveredByPanel}px of the ${monthHeight}px month, more than half of it`);
      }
    }
    console.log('CALENDAR DAY PANEL TWO BUTTONS PASS', JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme,
      onMountPanel: v.onMountSettled.panelHidden === true ? 'hidden' : 'OPEN',
      reopenPanel: v.reopenSettled.panelHidden === true ? 'hidden' : 'OPEN',
      buttons: v.empty.buttons.join('+'),
      inputsInPanel: v.empty.inputsInPanel,
      caretAfterTap: v.empty.caret.tag,
      panel: `${v.empty.rect.height}px`,
      sharePct: Number((v.empty.share * 100).toFixed(1)),
      tappable: `${v.empty.tappableDates}/${v.empty.totalDates}`,
    }))));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
