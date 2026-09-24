// Locks touch month navigation and the selected-day in-flow detail.
//
// Covered contracts:
//   - horizontal swipe changes month (left -> next, right -> previous)
//   - vertical drag never changes month and never suppresses native scrolling
//   - a tap-sized movement stays a tap, so date cells and event chips still work
//   - a burst of swipes advances exactly one month (no skipping)
//   - the touch selected-day surface stays below the Month with no overlay
//   - Escape closes the detail but leaves the Calendar modal open (Site #129/#130)
//   - desktop keeps the sticky side detail and gains no swipe behaviour
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
setTimeout(()=>{if(out.textContent==='pending'){const m=document.querySelector('.site-modal.site-calendar-modal');const c=m&&m.querySelector('.site-modal-content');out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage,diag:{modal:Boolean(m),view:c&&c.dataset.calendarManagerView,busy:c&&c.getAttribute('aria-busy'),grid:Boolean(m&&m.querySelector('.calendar-month-grid')),status:(m&&m.querySelector('.life-calendar-error')||{}).textContent||''},viewport:{width:innerWidth,height:innerHeight}})}},35000);
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
  await wait(()=>modal.querySelector('.calendar-month')?.getBoundingClientRect().width>0,'month geometry');

  // validate_calendar_modal_runtime_02 reads layout.children[0] as the month and
  // layout.children[1] as the selected-day surface. Lock that ordering here so the
  // sheet backdrop can never be inserted ahead of them.
  const layoutNode=()=>modal.querySelector('.calendar-month-layout');
  const childOrderOk=()=>{
    const layout=layoutNode();
    if(!layout)return false;
    return layout.children[0]?.classList.contains('calendar-month')
      && layout.children[1]?.classList.contains('calendar-day-panel');
  };
  const titleOf=()=>modal.querySelector('.calendar-title-button')?.textContent||'';
  const monthNode=()=>modal.querySelector('.calendar-month');
  const idle=async label=>{await wait(()=>content?.getAttribute('aria-busy')!=='true',label)};
  const desktop=innerWidth>900;
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight},desktop,
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

  result.childOrder=childOrderOk();
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
    // Desktop keeps the sticky side detail and must gain no swipe behaviour.
    const swiped=drag(monthNode(),rightX,midY,leftX,midY);
    await new Promise(r=>setTimeout(r,30));
    result.desktopSwipeInert=titleOf()===baseTitle&&!swiped;

    const cell=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
    click(cell);
    await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'desktop detail open');
    const panel=modal.querySelector('.calendar-day-panel');
    result.desktopPresentation=panel.dataset.presentation;
    result.desktopPosition=getComputedStyle(panel).position;
    result.desktopBackdrop=Boolean(modal.querySelector('[data-calendar-day-sheet-backdrop]'));
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

    // --- date tap opens the in-flow detail below the Month ----------------
    const cell=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
    const cellDate=cell.dataset.calendarDate;
    click(cell);
    await wait(()=>modal.querySelector('[data-calendar-date="'+cellDate+'"]')?.dataset.selected==='true','date selection');
    await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'day detail open');
    const sheet=modal.querySelector('.calendar-day-panel');
    // The sheet rises from below the fold, so geometry is only meaningful once the
    // entry animation has settled.
    stage='sheet animation settle';
    let previousBottom=null,stableTicks=0;
    for(let i=0;i<120;i+=1){
      const current=sheet.getBoundingClientRect().bottom;
      if(previousBottom!==null&&Math.abs(current-previousBottom)<0.5){
        stableTicks+=1;
        if(stableTicks>=3)break;
      }else stableTicks=0;
      previousBottom=current;
      await new Promise(r=>setTimeout(r,20));
    }
    const sheetRect=sheet.getBoundingClientRect();
    const sheetStyle=getComputedStyle(sheet);
    result.sheet={
      presentation:sheet.dataset.presentation,
      position:sheetStyle.position,
      top:sheetRect.top,
      bottom:sheetRect.bottom,
      left:sheetRect.left,
      right:sheetRect.right,
      gridBottom:modal.querySelector('.calendar-month-grid').getBoundingClientRect().bottom,
      backdrop:Boolean(modal.querySelector('[data-calendar-day-sheet-backdrop]')),
      bottomOffset:getComputedStyle(sheet).bottom,
      viewportBound:sheet.dataset.visualViewportBound||'',
      reducedMotion:sheet.dataset.reducedMotion||'',
      heading:Boolean(sheet.querySelector('.calendar-day-heading')?.textContent?.trim()),
      addButton:Boolean(sheet.querySelector('[data-calendar-add]')),
      addLabel:sheet.querySelector('[data-calendar-add]')?.textContent||'',
      addAria:sheet.querySelector('[data-calendar-add]')?.getAttribute('aria-label')||'',
      addImageButton:Boolean(sheet.querySelector('[data-calendar-add-image]')),
      addImageLabel:sheet.querySelector('[data-calendar-add-image]')?.textContent||'',
      addImageAria:sheet.querySelector('[data-calendar-add-image]')?.getAttribute('aria-label')||'',
      listOrEmpty:Boolean(sheet.querySelector('.calendar-day-event')||sheet.querySelector('.calendar-empty')||sheet.textContent.includes('등록된 일정이 없어요')),
      close:Boolean(sheet.querySelector('.calendar-day-close')),
    };

    // --- 닫기 dismisses --------------------------------------------------
    // The in-flow detail has no dismiss backdrop, so a tap on another date is
    // handled by that date rather than swallowed by a full-screen layer.
    click(sheet.querySelector('.calendar-day-close'));
    await wait(()=>modal.querySelector('.calendar-day-panel')?.hidden===true,'close button dismiss');
    result.closeDismiss=Boolean(document.querySelector('.site-modal.site-calendar-modal'));

    // --- another date retargets the panel instead of closing it ----------
    click(modal.querySelector('[data-calendar-date="'+cellDate+'"]'));
    await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'panel reopen');
    const neighbourCell=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')]
      .find(node=>node.dataset.calendarDate!==cellDate);
    const neighbourDate=neighbourCell?.dataset.calendarDate||'';
    click(neighbourCell);
    await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===neighbourDate,'panel retarget');
    result.retarget={
      requested:neighbourDate,
      selected:modal.querySelector('.calendar-day-panel')?.dataset.selectedDate||'',
      stillOpen:!modal.querySelector('.calendar-day-panel')?.hidden,
    };

    // --- Escape closes the panel, Calendar survives (Site #129/#130) ------
    click(modal.querySelector('[data-calendar-date="'+cellDate+'"]'));
    await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===cellDate,'panel back on the first date');
    const trigger=modal.querySelector('[data-calendar-date-trigger="'+cellDate+'"]');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>modal.querySelector('.calendar-day-panel')?.hidden===true,'day detail Escape close');
    result.escapeKeepsCalendar=Boolean(document.querySelector('.site-modal.site-calendar-modal'));
    result.escapeBackdropCleared=!modal.querySelector('[data-calendar-day-sheet-backdrop]');
    await wait(()=>document.activeElement?.dataset.calendarDateTrigger===cellDate,'day detail Escape focus restore');
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
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
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
    if (!value.tapPreserved) throw new Error(`${label}: tap-sized movement must not navigate months`);
    if (!value.verticalScrollSafe) throw new Error(`${label}: vertical drag must not navigate or block scrolling`);
    if (!value.childOrder) throw new Error(`${label}: month layout child order changed (children[0]=.calendar-month, children[1]=.calendar-day-panel)`);
  }

  const desktops = results.filter(value => value.desktop);
  const mobiles = results.filter(value => !value.desktop);
  if (!desktops.length || !mobiles.length) throw new Error('both desktop and touch cases are required');

  for (const value of desktops) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    if (!value.desktopSwipeInert) throw new Error(`${label}: desktop must not gain swipe month navigation`);
    if (value.desktopPresentation !== 'SIDE') throw new Error(`${label}: desktop must keep the side detail`);
    if (value.desktopPosition !== 'sticky') throw new Error(`${label}: desktop detail must remain sticky`);
    if (value.desktopBackdrop) throw new Error(`${label}: desktop must not render a dismiss backdrop`);
  }

  for (const value of mobiles) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    if (!value.swipeNext) throw new Error(`${label}: left swipe must open the next month`);
    if (!value.swipePrevious) throw new Error(`${label}: right swipe must open the previous month`);
    if (!value.burstNoSkip) throw new Error(`${label}: rapid swipes skipped months (${value.burstTitle})`);
    if (!value.buttonsPreserved) throw new Error(`${label}: 이전/다음 buttons must keep working`);

    const sheet = value.sheet || {};
    if (sheet.presentation !== 'FLOW') throw new Error(`${label}: touch day detail must stay in flow (got ${sheet.presentation})`);
    if (sheet.position !== 'static') throw new Error(`${label}: the day panel must stay in document flow`);
    if (sheet.backdrop) throw new Error(`${label}: the in-flow panel must not lay a dismiss layer over the month`);
    if (sheet.top < sheet.gridBottom - 2) throw new Error(`${label}: the day panel covers the Month grid`);
    if (sheet.left < -1 || sheet.right > value.viewport.width + 1) throw new Error(`${label}: day panel horizontal overflow`);
    if (!sheet.heading) throw new Error(`${label}: the day panel must show the date heading`);
    if (!sheet.listOrEmpty) throw new Error(`${label}: the day panel must show the entry list or the empty message`);
    if (!sheet.addButton) throw new Error(`${label}: the full form must stay one press away`);
    if (!sheet.addImageButton) throw new Error(`${label}: the day panel must offer the image route too`);
    // The visible words no longer repeat the date — it is already in the
    // heading, the toolbar and the highlighted cell — but the accessible name
    // still says which day is being added to. The panel offers these two and
    // nothing else: no title box, no [저장].
    if (sheet.addLabel.trim() !== '+ 일정 추가') throw new Error(`${label}: full-form button label changed (${sheet.addLabel})`);
    if (sheet.addImageLabel.trim() !== '사진에서 일정 추가') throw new Error(`${label}: image add button label changed (${sheet.addImageLabel})`);
    if (!/\d+월 \d+일 일정을 직접 입력해서 등록/.test(sheet.addAria)) throw new Error(`${label}: full-form button must name the date for assistive tech (${sheet.addAria})`);
    if (!/\d+월 \d+일에 이미지로 일정 등록/.test(sheet.addImageAria)) throw new Error(`${label}: image add button must name the date for assistive tech (${sheet.addImageAria})`);
    if (!sheet.close) throw new Error(`${label}: the day panel must keep its close control`);

    if (!value.closeDismiss) throw new Error(`${label}: 닫기 must dismiss the day without closing the Calendar modal`);
    // The point of dropping the backdrop: another date is reachable while the
    // panel is open, and taking it retargets the panel rather than closing it.
    if (value.retarget?.selected !== value.retarget?.requested) {
      throw new Error(`${label}: tapping another date must move the panel to it (${JSON.stringify(value.retarget)})`);
    }
    if (!value.retarget?.stillOpen) throw new Error(`${label}: tapping another date must leave the panel open`);
    if (!value.escapeKeepsCalendar) throw new Error(`${label}: Escape must leave the Calendar modal open`);
    if (!value.escapeBackdropCleared) throw new Error(`${label}: Escape must leave no dismiss layer behind`);
    if (!value.escapeFocusRestore) throw new Error(`${label}: Escape must restore focus to the selected date`);
  }

  for (const value of results) {
    if (!value.reducedMotion) throw new Error(`${value.viewport.width}x${value.viewport.height}: reduced-motion case did not report reduced motion`);
    if (value.sheet && value.sheet.reducedMotion !== 'true') throw new Error(`${value.viewport.width}x${value.viewport.height}: sheet must record prefers-reduced-motion`);
  }
  if (animated.reducedMotion) throw new Error('motion-enabled case unexpectedly reported reduced motion');
  if (animated.sheet.reducedMotion !== 'false') throw new Error('motion-enabled sheet must record prefers-reduced-motion=false');
  if (animated.sheet.presentation !== 'FLOW' || animated.sheet.position !== 'static' || animated.sheet.backdrop) {
    throw new Error('motion-enabled day panel must still render in flow with no dismiss layer');
  }
  if (!animated.swipeNext || !animated.swipePrevious || !animated.burstNoSkip) {
    throw new Error('motion-enabled swipe navigation regressed');
  }

  console.log('CALENDAR TOUCH MONTHNAV + DAY DETAIL PASS', JSON.stringify({results, animated}));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
