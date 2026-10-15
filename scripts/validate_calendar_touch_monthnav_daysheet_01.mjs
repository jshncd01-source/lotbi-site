// Locks touch month navigation and the selected day on the page.
// Updated for the owner-approved calendar design 04 (2026-10-14).
//
// Covered contracts:
//   - horizontal swipe changes month (left -> next, right -> previous)
//   - vertical drag never changes month and never suppresses native scrolling
//   - a tap-sized movement stays a tap, so date cells still work
//   - a burst of swipes advances exactly one month (no skipping)
//   - desktop lists the picked day in the card beside the Month, no swipe
//   - touch lists the picked day under the Month with no sheet or overlay
//   - the day list is part of the page (no close control, no repeated add
//     actions); tapping another date retargets it and the one add action
//   - Escape inside the day list steps back to the selected date and leaves the
//     Calendar open (Site #129/#130)
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-touch-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-touch-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4197;
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
<link rel="stylesheet" href="/site-calendar.css?v=20260922-daysheet1">
<link rel="stylesheet" href="/site-calendar-expense.css">
<link rel="stylesheet" href="/site-calendar-weather.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-consumer-design.css">
<link rel="stylesheet" href="/site-consumer-layout.css">
<link rel="stylesheet" href="/site-consumer-detail.css">
</head><body class="chat-home-page" data-site-auth-state="unauthenticated">
<aside class="chat-sidebar chat-sidebar-desktop">
  <button type="button" data-calendar-view="all">캘린더</button>
  <button type="button" data-calendar-view="today">오늘</button>
  <button type="button" data-calendar-view="attention">확인 필요</button>
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
setTimeout(()=>{if(out.textContent==='pending'){const m=document.querySelector('.site-modal.site-calendar-modal');const c=m&&m.querySelector('.site-modal-content');out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage,diag:{modal:Boolean(m),view:c&&c.dataset.calendarManagerView,busy:c&&c.getAttribute('aria-busy'),grid:Boolean(m&&m.querySelector('.c4-mo-g')),status:(m&&m.querySelector('.life-calendar-error')||{}).textContent||''},viewport:{width:innerWidth,height:innerHeight}})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<200;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));

// Hand-rolled touch events: the swipe handler reads touches/changedTouches and
// cancelable only, so this exercises the real code path deterministically without
// depending on headless touch emulation.
function touchEvent(type,points,cancelable=true){
  const event=new Event(type,{bubbles:true,cancelable});
  const list=points.map((point,index)=>({identifier:index,clientX:point.x,clientY:point.y}));
  Object.defineProperty(event,'touches',{value:type==='touchend'||type==='touchcancel'?[]:list});
  Object.defineProperty(event,'changedTouches',{value:list});
  return event;
}
// Returns whether the move was treated as a horizontal gesture (defaultPrevented).
function drag(node,fromX,fromY,toX,toY,steps=6){
  node.dispatchEvent(touchEvent('touchstart',[{x:fromX,y:fromY}]));
  let prevented=false;
  for(let i=1;i<=steps;i+=1){
    const x=fromX+((toX-fromX)*i)/steps;
    const y=fromY+((toY-fromY)*i)/steps;
    const move=touchEvent('touchmove',[{x,y}]);
    node.dispatchEvent(move);
    if(move.defaultPrevented)prevented=true;
  }
  node.dispatchEvent(touchEvent('touchend',[{x:toX,y:toY}]));
  return prevented;
}

try{
  localStorage.clear();
  // Korea holiday decoration is covered by validate_calendar_korea_holidays_01.mjs.
  // Disable it here so its asynchronous refresh cannot make gesture timing flaky.
  localStorage.setItem('lotbi.calendar.settings.v1',JSON.stringify({showKoreaHolidays:false}));
  // Hermetic by design: this fixture measures gesture and sheet behaviour only, so
  // every off-origin call is answered locally. Nothing here depends on the network,
  // which keeps the gesture timing deterministic.
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch=(url,init)=>{
    const parsed=new URL(String(url),location.origin);
    if(parsed.pathname==='/v2/life/holidays'){
      const year=Number(parsed.searchParams.get('year')||new Date().getFullYear());
      return json({year,country:'KR',coverage_status:'VERIFIED',
        snapshot_version:'touch-fixture-'+year,supported_years:[year],
        items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.origin!==location.origin)return json({items:[]});
    return nativeFetch(url,init);
  };
  // Geolocation never resolves in headless; answer immediately so the manager can
  // settle instead of staying aria-busy.
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const {createGuestCalendarRepository}=await import('/site-calendar-guest.js?v=20260922-daysheet1');
  const guestRepo=createGuestCalendarRepository(localStorage);
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const part=Object.fromEntries(parts.map(value=>[value.type,value.value]));
  const seededDate=part.year+'-'+part.month+'-12';
  guestRepo.create({title:'치과 예약',local_date:seededDate,local_datetime:seededDate+'T10:00:00',all_day:false});

  const conversation=await import('/site-conversation.js?v=20260922-daysheet1');
  if(!conversation.mountConversation())throw new Error('conversation mount');
  click(document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]'));
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar modal');
  const modal=document.querySelector('.site-modal.site-calendar-modal');
  const content=modal.querySelector('.site-modal-content');
  await wait(()=>content?.dataset.calendarManagerView==='month','month view');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','calendar idle');
  // setTimeout rather than requestAnimationFrame: under --virtual-time-budget an
  // idle page may never produce another animation frame.
  stage='layout settle';
  await new Promise(r=>setTimeout(r,50));
  await wait(()=>modal.querySelector('.c4-mo-g')?.getBoundingClientRect().width>0,'month geometry');

  // CALENDAR-DESIGN-04: the month opens with today selected and its day listed
  // beside it (desk) or under it (phone). No window ever covers the month.
  const shown=node=>Boolean(node&&node.getClientRects().length&&getComputedStyle(node).display!=='none');
  const dayList=()=>[...modal.querySelectorAll('.c4-daycard,.c4-agenda')].find(shown)||null;
  const overlayOpen=()=>Boolean(document.querySelector('.c4-dlg-backdrop,.calendar-day-panel,[data-calendar-day-detail-backdrop],.calendar-day-sheet-backdrop'));
  const titleOf=()=>modal.querySelector('.calendar-title-button')?.textContent||'';
  const monthNode=()=>modal.querySelector('.c4-mo-g');
  const visibleAdd=()=>[...modal.querySelectorAll('[data-calendar-add]')].filter(shown);
  const idle=async label=>{await wait(()=>content?.getAttribute('aria-busy')!=='true',label)};
  const desktop=innerWidth>900;
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight},desktop,
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

  const todayDate=modal.querySelector('.c4-mc[data-today="true"]')?.dataset.calendarDate||'';
  result.openState={
    design:modal.dataset.calendarDesign||'',
    overlay:overlayOpen(),
    listDate:dayList()?.dataset.selectedDate||'',
    todayDate,
  };
  const baseTitle=titleOf();
  const rect=monthNode().getBoundingClientRect();
  const midY=Math.round(rect.top+rect.height/2);
  const leftX=Math.round(rect.left+Math.min(40,rect.width*0.15));
  const rightX=Math.round(rect.right-Math.min(40,rect.width*0.15));

  // --- tap-sized movement must remain a tap -------------------------------
  const tinyPrevented=drag(monthNode(),rightX,midY,rightX-5,midY+3);
  await new Promise(r=>setTimeout(r,30));
  result.tapPreserved=titleOf()===baseTitle&&!tinyPrevented;

  // --- vertical drag must not navigate and must not block scrolling -------
  const verticalPrevented=drag(monthNode(),rightX,rect.top+20,rightX-8,rect.top+140);
  await new Promise(r=>setTimeout(r,30));
  result.verticalScrollSafe=titleOf()===baseTitle&&!verticalPrevented;

  if(desktop){
    // Desktop keeps swipe inert and lists the picked day in the side card.
    const swiped=drag(monthNode(),rightX,midY,leftX,midY);
    await new Promise(r=>setTimeout(r,30));
    result.desktopSwipeInert=titleOf()===baseTitle&&!swiped;

    const cell=[...modal.querySelectorAll('.c4-mc[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
    const cellDate=cell.dataset.calendarDate;
    click(cell);
    await wait(()=>dayList()?.dataset.selectedDate===cellDate,'desktop day card follows');
    const card=dayList();
    result.desktopDay={
      isSideCard:card.classList.contains('c4-daycard'),
      position:getComputedStyle(card).position,
      beside:card.getBoundingClientRect().left>=monthNode().getBoundingClientRect().right-1,
      overlay:overlayOpen(),
      close:Boolean(card.querySelector('.calendar-day-close')),
      actionsInCard:card.querySelectorAll('[data-calendar-add],[data-calendar-add-image]').length,
      addLabels:visibleAdd().map(n=>n.textContent.trim()),
      expectedAdd:(()=>{const [,m,d]=cellDate.split('-').map(Number);return m+'월 '+d+'일 일정 추가'})(),
    };
  }else{
    // --- swipe left -> next month ---------------------------------------
    const nextPrevented=drag(monthNode(),rightX,midY,leftX,midY);
    await wait(()=>titleOf()!==baseTitle,'swipe next');
    await idle('swipe next idle');
    const nextTitle=titleOf();
    result.swipeNext=nextTitle!==baseTitle&&nextPrevented;

    // --- swipe right -> previous month, back to where we started ---------
    drag(monthNode(),leftX,midY,rightX,midY);
    await wait(()=>titleOf()===baseTitle,'swipe previous');
    await idle('swipe previous idle');
    result.swipePrevious=titleOf()===baseTitle;

    // --- a burst of swipes advances exactly one month --------------------
    drag(monthNode(),rightX,midY,leftX,midY);
    drag(monthNode(),rightX,midY,leftX,midY);
    drag(monthNode(),rightX,midY,leftX,midY);
    await wait(()=>titleOf()!==baseTitle,'burst swipe');
    await idle('burst idle');
    result.burstTitle=titleOf();
    result.burstNoSkip=titleOf()===nextTitle;
    // return to the starting month
    drag(monthNode(),leftX,midY,rightX,midY);
    await wait(()=>titleOf()===baseTitle,'burst restore');
    await idle('burst restore idle');

    // --- buttons still work and share the swipe's path -------------------
    click(modal.querySelectorAll('.calendar-nav-button')[1]);
    await wait(()=>titleOf()===nextTitle,'next button');
    await idle('next button idle');
    click(modal.querySelectorAll('.calendar-nav-button')[0]);
    await wait(()=>titleOf()===baseTitle,'previous button');
    await idle('previous button idle');
    result.buttonsPreserved=true;

    // --- a date tap lists that day under the Month ------------------------
    const cell=[...modal.querySelectorAll('.c4-mc[data-current-month="true"]')].find(n=>n.dataset.selected!=='true'&&n.dataset.today!=='true');
    const cellDate=cell.dataset.calendarDate;
    click(cell);
    await wait(()=>modal.querySelector('.c4-mc[data-calendar-date="'+cellDate+'"]')?.dataset.selected==='true','date selection');
    await wait(()=>dayList()?.dataset.selectedDate===cellDate,'day list follows');
    stage='day list settle';
    await new Promise(r=>setTimeout(r,60));
    const list=dayList();
    const listRect=list.getBoundingClientRect();
    result.cellDate=cellDate;
    result.list={
      isUnderMonth:list.classList.contains('c4-agenda'),
      position:getComputedStyle(list).position,
      top:listRect.top,
      left:listRect.left,
      right:listRect.right,
      gridBottom:monthNode().getBoundingClientRect().bottom,
      overlay:overlayOpen(),
      heading:Boolean(list.querySelector('.calendar-day-heading')?.textContent?.trim()),
      listOrEmpty:Boolean(list.querySelector('.c4-dc-ev')||list.querySelector('.c4-empty-day')),
      close:Boolean(list.querySelector('.calendar-day-close')),
      actionsInList:list.querySelectorAll('[data-calendar-add],[data-calendar-add-image]').length,
      addLabels:visibleAdd().map(n=>n.textContent.trim()),
      expectedAdd:(()=>{const [,m,d]=cellDate.split('-').map(Number);return m+'월 '+d+'일 일정 추가'})(),
    };

    // --- another date retargets the list, and the add action follows -------
    const neighbourCell=[...modal.querySelectorAll('.c4-mc[data-current-month="true"]')]
      .find(node=>node.dataset.calendarDate!==cellDate&&node.dataset.today!=='true');
    const neighbourDate=neighbourCell?.dataset.calendarDate||'';
    click(neighbourCell);
    await wait(()=>dayList()?.dataset.selectedDate===neighbourDate,'list retarget');
    result.retarget={
      requested:neighbourDate,
      selected:dayList()?.dataset.selectedDate||'',
      addLabels:visibleAdd().map(n=>n.textContent.trim()),
      expectedAdd:(()=>{const [,m,d]=neighbourDate.split('-').map(Number);return m+'월 '+d+'일 일정 추가'})(),
    };

    // --- Escape inside the list steps back to the date; Calendar survives --
    click(modal.querySelector('.c4-mc[data-calendar-date="'+cellDate+'"]'));
    await wait(()=>dayList()?.dataset.selectedDate===cellDate,'list back on the first date');
    const heading=dayList().querySelector('.calendar-day-heading');
    heading.focus();
    heading.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>document.activeElement?.dataset.calendarDateTrigger===cellDate,'day list Escape focus restore');
    result.escapeKeepsCalendar=Boolean(document.querySelector('.site-modal.site-calendar-modal'));
    result.escapeKeepsSelection=dayList()?.dataset.selectedDate===cellDate;
    result.escapeFocusRestore=true;
  }

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

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h, {reducedMotion = true} = {}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const motionFlags = reducedMotion ? ['--force-prefers-reduced-motion=reduce'] : [];
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', ...motionFlags, '--virtual-time-budget=60000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}${v.diag ? ' ' + JSON.stringify(v.diag) : ''}`);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  // Geometry cases run with reduced motion forced so the sheet's resting position is
  // measured rather than a frame of its entry animation.
  const cases = [[1280, 900], [1440, 900], [768, 900], [340, 800], [390, 844], [412, 915], [320, 800]];
  const results = cases.map(([w, h]) => run(browser, w, h));
  // One motion-enabled pass proves the animated path still produces a working sheet.
  const animated = run(browser, 390, 844, {reducedMotion: false});

  for (const value of results) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    const open = value.openState || {};
    if (!value.tapPreserved) throw new Error(`${label}: tap-sized movement must not navigate months`);
    if (!value.verticalScrollSafe) throw new Error(`${label}: vertical drag must not navigate or block scrolling`);
    if (open.design !== 'c4') throw new Error(`${label}: the workspace Calendar must be the approved design 04`);
    if (open.overlay) throw new Error(`${label}: Month must open with no window over it`);
    if (!open.todayDate || open.listDate !== open.todayDate) throw new Error(`${label}: Month must open with today listed (${open.listDate} vs ${open.todayDate})`);
  }

  const desktops = results.filter(value => value.desktop);
  const mobiles = results.filter(value => !value.desktop);
  if (!desktops.length || !mobiles.length) throw new Error('both desktop and touch cases are required');

  for (const value of desktops) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    const d = value.desktopDay || {};
    if (!value.desktopSwipeInert) throw new Error(`${label}: desktop must not gain swipe month navigation`);
    if (!d.isSideCard || !d.beside) throw new Error(`${label}: desktop lists the picked day in the card beside the Month`);
    if (d.position === 'fixed' || d.position === 'absolute') throw new Error(`${label}: the day card is part of the page, got ${d.position}`);
    if (d.overlay) throw new Error(`${label}: picking a day must not open a window`);
    if (d.close) throw new Error(`${label}: the day card is part of the page and has no close control`);
    if (d.actionsInCard !== 0) throw new Error(`${label}: the day card must not repeat the add actions (got ${d.actionsInCard})`);
    if (d.addLabels.join('|') !== d.expectedAdd) throw new Error(`${label}: one visible add action naming the picked day, got [${d.addLabels.join('|')}]`);
  }

  for (const value of mobiles) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    if (!value.swipeNext) throw new Error(`${label}: left swipe must open the next month`);
    if (!value.swipePrevious) throw new Error(`${label}: right swipe must open the previous month`);
    if (!value.burstNoSkip) throw new Error(`${label}: rapid swipes skipped months (${value.burstTitle})`);
    if (!value.buttonsPreserved) throw new Error(`${label}: 이전/다음 buttons must keep working`);

    const list = value.list || {};
    if (!list.isUnderMonth) throw new Error(`${label}: touch lists the picked day under the Month`);
    if (list.position === 'fixed' || list.position === 'absolute') throw new Error(`${label}: the touch day list must flow with the page, got ${list.position}`);
    if (list.top < list.gridBottom - 1) throw new Error(`${label}: the touch day list must sit under the Month`);
    if (list.overlay) throw new Error(`${label}: picking a day must not open a sheet`);
    if (list.left < -1 || list.right > value.viewport.width + 1) throw new Error(`${label}: day list horizontal overflow`);
    if (!list.heading) throw new Error(`${label}: the day list must show the date heading`);
    if (!list.listOrEmpty) throw new Error(`${label}: the day list must show the entry list or the empty message`);
    if (list.close) throw new Error(`${label}: the day list is part of the page and has no close control`);
    if (list.actionsInList !== 0) throw new Error(`${label}: the day list must not repeat the add actions (got ${list.actionsInList})`);
    if (list.addLabels.join('|') !== list.expectedAdd) throw new Error(`${label}: one visible add action naming the picked day, got [${list.addLabels.join('|')}]`);

    // Another date is reachable while the list is shown, and taking it
    // retargets the list -- and the add action -- rather than closing it.
    if (value.retarget?.selected !== value.retarget?.requested) {
      throw new Error(`${label}: tapping another date must move the list to it (${JSON.stringify(value.retarget)})`);
    }
    if (value.retarget.addLabels.join('|') !== value.retarget.expectedAdd) throw new Error(`${label}: the add action must follow the picked day (${JSON.stringify(value.retarget)})`);
    if (!value.escapeKeepsCalendar) throw new Error(`${label}: Escape must leave the Calendar open`);
    if (!value.escapeKeepsSelection) throw new Error(`${label}: Escape must keep the picked day`);
    if (!value.escapeFocusRestore) throw new Error(`${label}: Escape must restore focus to the selected date`);
  }

  for (const value of results) {
    if (!value.reducedMotion) throw new Error(`${value.viewport.width}x${value.viewport.height}: reduced-motion case did not report reduced motion`);
  }
  if (animated.reducedMotion) throw new Error('motion-enabled case unexpectedly reported reduced motion');
  if (!animated.list?.isUnderMonth || animated.list.overlay) throw new Error('motion-enabled day list must still sit under the Month');
  if (!animated.swipeNext || !animated.swipePrevious || !animated.burstNoSkip) {
    throw new Error('motion-enabled swipe navigation regressed');
  }

  console.log('CALENDAR TOUCH MONTHNAV + DAY DETAIL PASS', JSON.stringify({results, animated}));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
