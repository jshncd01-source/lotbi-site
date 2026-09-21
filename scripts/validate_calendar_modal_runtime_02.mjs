import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-runtime-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-runtime-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4191;
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
<link rel="stylesheet" href="/site-calendar.css?v=20260921-calgeom1">
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<140;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const oneLine=node=>getComputedStyle(node).whiteSpace==='nowrap' && node.scrollHeight<=node.clientHeight+2;
const noX=node=>node.scrollWidth<=node.clientWidth+1;
try{
  localStorage.clear();
  const {createGuestCalendarRepository}=await import('/site-calendar-guest.js?v=20260921-convcal2');
  const guestRepo=createGuestCalendarRepository(localStorage);
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const part=Object.fromEntries(parts.map(value=>[value.type,value.value]));
  const fixtureCounts=[0,1,2,3,5,8];
  const fixtureTitles=['치과','고객 미팅','미용실','저녁 약속','자동차 검사','긴 한글 제목 일정이 셀에서 안전하게 줄임표로 표시되는지 확인','English planning review','123 🚗'];
  const fixtureDates=fixtureCounts.map((_,index)=>part.year+'-'+part.month+'-'+String(10+index).padStart(2,'0'));
  fixtureCounts.forEach((count,dateIndex)=>{
    for(let eventIndex=0;eventIndex<count;eventIndex+=1){
      const hour=9+Math.floor(eventIndex/2);
      const minute=eventIndex%2===0?'00':'30';
      guestRepo.create({
        title:fixtureTitles[eventIndex%fixtureTitles.length],
        local_date:fixtureDates[dateIndex],
        local_datetime:fixtureDates[dateIndex]+'T'+String(hour).padStart(2,'0')+':'+minute+':00',
        all_day:false,
      });
    }
  });
  guestRepo.create({
    title:'날짜 미정 할 일',
    local_date:null,
    local_datetime:null,
    all_day:false,
  });
  const conversation=await import('/site-conversation.js?v=20260921-convcalentry2');
  if(!conversation.mountConversation())throw new Error('conversation mount');
  const entry=document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]');
  if(!(entry instanceof HTMLButtonElement))throw new Error('calendar entry missing');
  if(entry.dataset.calendarEntryBound!=='true')throw new Error('calendar entry not directly bound');
  click(entry);
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar modal');
  const modal=document.querySelector('.site-modal.site-calendar-modal');
  const content=modal.querySelector('.site-modal-content');
  await wait(()=>content?.dataset.calendarManagerView==='month','month view');
  const grid=modal.querySelector('.calendar-month-grid');
  const layout=modal.querySelector('.calendar-month-layout');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const today=modal.querySelector('.calendar-today-button');
  const attention=[...modal.querySelectorAll('.calendar-mode-tab')].find(n=>n.textContent==='확인 필요');
  const calendar=layout?.children?.[0], detail=layout?.children?.[1];
  if(!grid||!layout||!today||!attention||!calendar||!detail)throw new Error('month chrome missing');
  const modalRect=modal.getBoundingClientRect(), contentRect=content.getBoundingClientRect(), layoutRect=layout.getBoundingClientRect();
  const gridRect=grid.getBoundingClientRect(), calRect=calendar.getBoundingClientRect(), detailRect=detail.getBoundingClientRect();
  const contentStyle=getComputedStyle(content);
  const contentInnerBottom=contentRect.bottom-(parseFloat(contentStyle.paddingBottom)||0);
  const unusedBottom=Math.max(0,Math.round(contentInnerBottom-gridRect.bottom));
  const shell=modal.querySelector('.calendar-product-shell');
  const viewport=modal.querySelector('.calendar-viewport');
  const weekdays=modal.querySelector('.calendar-weekdays');
  const geometryDebug=Object.fromEntries([
    ['content',content],['shell',shell],['viewport',viewport],['layout',layout],
    ['calendar',calendar],['weekdays',weekdays],['grid',grid],
  ].map(([name,node])=>{
    const rect=node?.getBoundingClientRect();
    const style=node?getComputedStyle(node):null;
    return [name,{top:rect?.top||0,bottom:rect?.bottom||0,height:rect?.height||0,display:style?.display||'',cssHeight:style?.height||'',minHeight:style?.minHeight||'',flex:style?.flex||'',gridRows:style?.gridTemplateRows||''}];
  }));
  const toolbar=modal.querySelector('.calendar-toolbar');
  const desktop=innerWidth>900;
  const cellHeights=[...grid.querySelectorAll('.calendar-date-cell')].map(node=>node.getBoundingClientRect().height);
  const rowHeightSpread=cellHeights.length?Math.max(...cellHeights)-Math.min(...cellHeights):0;
  const result={
    ok:true,
    viewport:{width:innerWidth,height:innerHeight},
    bound:true,
    guest:content.dataset.calendarAccess,
    modal:{width:modalRect.width,height:modalRect.height,overflowY:getComputedStyle(modal).overflowY,noX:noX(modal)},
    content:{overflowY:getComputedStyle(content).overflowY,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,noX:noX(content),unusedBottom},
    grid:{
      cells:grid.querySelectorAll('.calendar-date-cell').length,
      weekCount:Number(grid.dataset.weekCount||0),
      noX:noX(grid),
      bottom:gridRect.bottom,
      contentBottom:contentRect.bottom,
      rowHeightSpread
    },
    toolbar:{todayOneLine:oneLine(today),attentionOneLine:oneLine(attention),scrollWidth:toolbar.scrollWidth,clientWidth:toolbar.clientWidth,noX:noX(toolbar)},
    calendar:{width:calRect.width,layoutWidth:layoutRect.width,widthRatio:layoutRect.width>0?calRect.width/layoutRect.width:0},
    detail:{
      hidden:detail.hidden,
      position:getComputedStyle(detail).position,
      overflowY:getComputedStyle(detail).overflowY,
      scrollHeight:detail.scrollHeight,
      clientHeight:detail.clientHeight,
      top:detailRect.top,
      gridBottom:gridRect.bottom
    },
    desktop
  };
  if(![28,35,42].includes(result.grid.cells))throw new Error('month grid week count invalid '+result.grid.cells);
  if(result.grid.weekCount!==result.grid.cells/7)throw new Error('week count metadata mismatch');
  if(result.grid.rowHeightSpread>2)throw new Error('month row heights diverged '+result.grid.rowHeightSpread);
  if(!result.toolbar.todayOneLine||!result.toolbar.attentionOneLine)throw new Error('toolbar label wrapped');
  if(!result.modal.noX||!result.content.noX||!result.grid.noX)throw new Error('horizontal overflow');
  if(result.guest!=='guest')throw new Error('guest calendar contract');

  const density=[];
  fixtureCounts.forEach((expected,index)=>{
    const cell=grid.querySelector('[data-calendar-date="'+fixtureDates[index]+'"]');
    if(!cell)throw new Error('fixture date missing '+fixtureDates[index]);
    const rows=[...cell.querySelectorAll('.calendar-event-chip')];
    if(rows.length!==expected)throw new Error('fixture row count '+fixtureDates[index]+' '+rows.length+' expected '+expected);
    const countText=cell.querySelector('.calendar-mobile-event-count')?.textContent||'';
    const more=cell.querySelector('.calendar-event-overflow');
    const visible=rows.filter(row=>!row.hidden&&getComputedStyle(row).display!=='none').length;
    const hiddenCount=more&&!more.hidden&&getComputedStyle(more).display!=='none'?Number(more.dataset.hiddenCount||0):0;
    const cellHeight=cell.getBoundingClientRect().height;
    if(desktop){
      if(visible+hiddenCount!==expected)throw new Error('density count mismatch '+fixtureDates[index]+' visible '+visible+' hidden '+hiddenCount+' expected '+expected);
      if(hiddenCount>0&&more.textContent!==hiddenCount+'개 더 보기')throw new Error('overflow copy mismatch '+fixtureDates[index]);
      const stack=cell.querySelector('.calendar-event-stack');
      if(getComputedStyle(stack).overflowY==='auto'||getComputedStyle(stack).overflowY==='scroll')throw new Error('cell inner scrollbar '+fixtureDates[index]);
      if(expected===5&&cellHeight>=130&&visible<3)throw new Error('130px density budget too sparse '+cellHeight+'px visible '+visible);
      if(expected===5&&cellHeight>=156&&visible<5)throw new Error('156px density budget should show all five '+cellHeight+'px visible '+visible);
    }else if(countText!==(expected?expected+'개':'')){
      throw new Error('mobile event count mismatch '+fixtureDates[index]+' '+countText+' expected '+expected);
    }
    density.push({date:fixtureDates[index],expected,visible,hiddenCount,cellHeight});
  });
  result.density=density;

  if(desktop){
    if(modalRect.width<1050)throw new Error('desktop modal too narrow '+modalRect.width);
    if(modalRect.height<innerHeight-60)throw new Error('desktop modal too short '+modalRect.height);
    if(result.modal.overflowY!=='hidden')throw new Error('desktop modal must not scroll');
    if(result.content.overflowY!=='hidden')throw new Error('desktop month content must not scroll');
    if(result.calendar.widthRatio<0.97)throw new Error('desktop Month does not own available width '+result.calendar.widthRatio);
    if(!result.detail.hidden)throw new Error('desktop Calendar must start with an unobstructed Month');
    if(result.detail.position!=='fixed')throw new Error('desktop selected-day detail must overlay the Month');
    if(gridRect.bottom>contentRect.bottom+2)throw new Error('desktop month rows not initially visible');
    if(result.content.unusedBottom>4)throw new Error('desktop month leaves unused lower space '+result.content.unusedBottom+'px '+JSON.stringify(geometryDebug));

    const eventCell=grid.querySelector('[data-calendar-date="'+fixtureDates[1]+'"]');
    const eventButton=eventCell?.querySelector('.calendar-event-chip');
    if(!(eventButton instanceof HTMLButtonElement))throw new Error('event click target missing');
    eventButton.focus();
    click(eventButton);
    await wait(()=>modal.querySelector('.calendar-editor-dialog'),'event editor');
    if(modal.querySelector('.calendar-editor-dialog h3')?.textContent!=='일정 수정')throw new Error('event click opened wrong surface');
    const editorTitle=modal.querySelector('.calendar-editor-title');
    editorTitle.focus();
    editorTitle.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'event editor Escape close');
    if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('editor Escape closed the Calendar modal');
    await wait(()=>document.activeElement?.dataset.calendarEventId===eventButton.dataset.calendarEventId,'event focus restore');
    result.eventSelection=true;
    result.editorEscapeContained=true;

  }else{
    if(modalRect.width>innerWidth+1)throw new Error('responsive modal wider than viewport');
    if(!result.toolbar.noX)throw new Error('responsive toolbar must not rely on horizontal scrolling');
    if(result.detail.hidden)throw new Error('touch Calendar must show the selected-day surface on entry');
    if(result.detail.position!=='static')throw new Error('touch selected-day surface must flow below Month');
    if(detailRect.top<gridRect.bottom-2)throw new Error('touch selected-day surface overlaps Month');
  }

  const mode=async name=>{const button=[...modal.querySelectorAll('.calendar-mode-tab')].find(n=>n.textContent===name);click(button);await wait(()=>content.dataset.calendarManagerView===({연도:'year',일정:'agenda','확인 필요':'attention',월:'month'}[name]),name)};
  await mode('연도');
  await mode('일정');
  await wait(()=>modal.querySelector('.calendar-unscheduled-group'),'Agenda unscheduled group');
  const unscheduledGroup=modal.querySelector('.calendar-unscheduled-group');
  if(unscheduledGroup?.querySelector('h3')?.textContent!=='날짜 미정')throw new Error('unscheduled heading missing');
  const unscheduledEvent=[...unscheduledGroup.querySelectorAll('.calendar-day-event')].find(node=>node.textContent.includes('날짜 미정 할 일'));
  if(!(unscheduledEvent instanceof HTMLElement))throw new Error('unscheduled event missing');
  click(unscheduledEvent);
  await wait(()=>modal.querySelector('.calendar-editor-dialog'),'unscheduled editor');
  if(modal.querySelector('.calendar-editor-date')?.value!=='')throw new Error('unscheduled editor invented a date');
  modal.querySelector('.calendar-editor-title')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'unscheduled editor Escape close');
  result.unscheduledReachable=true;
  const weekRange=modal.querySelector('[data-agenda-scope="week"]');
  if(!(weekRange instanceof HTMLButtonElement))throw new Error('Agenda this-week control missing');
  click(weekRange);
  await wait(()=>modal.querySelector('[data-agenda-scope="week"]')?.getAttribute('aria-pressed')==='true','Agenda week range');
  result.agendaRanges=true;
  await mode('확인 필요');
  await mode('월');
  const title=modal.querySelector('.calendar-title-button').textContent;
  click(modal.querySelector('.calendar-nav-button')); await wait(()=>modal.querySelector('.calendar-title-button').textContent!==title,'previous');
  click(modal.querySelectorAll('.calendar-nav-button')[1]); await wait(()=>modal.querySelector('.calendar-title-button').textContent===title,'next');
  const ordinary=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
  const selectedDate=ordinary?.dataset.calendarDate;
  click(ordinary);
  await wait(()=>modal.querySelector('[data-calendar-date="'+selectedDate+'"]')?.dataset.selected==='true','date selection');
  await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'selected-day detail open');
  const selectedTrigger=modal.querySelector('[data-calendar-date-trigger="'+selectedDate+'"]');
  selectedTrigger.focus();
  selectedTrigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.hidden===true,'selected-day Escape close');
  if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('day-detail Escape closed the Calendar modal');
  await wait(()=>document.activeElement?.dataset.calendarDateTrigger===selectedDate,'selected-day Escape focus restore');
  result.escapeContained=true;
  click(modal.querySelector('.calendar-today-button')); await wait(()=>content.dataset.calendarManagerView==='month','today');
  result.controls=true;result.dateSelection=true;

  click(modal.querySelector('.site-modal-close'));
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'calendar close before fallback');
  const replacement=entry.cloneNode(true);
  entry.replaceWith(replacement);
  if(replacement.dataset.calendarEntryBound!=='true')throw new Error('replacement must preserve stale bound marker');
  click(replacement);
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'delegated fallback calendar modal');
  result.replacedEntryFallback=true;

  window.dispatchEvent(new CustomEvent('lotbi:site-session-state',{detail:{authenticated:true,identityKey:'auth-A'}}));
  await wait(()=>!document.querySelector('.site-modal.site-calendar-modal'),'identity change closes Calendar');
  result.identitySurfaceClose=true;

  const raceRoot=document.createElement('div');
  raceRoot.id='calendar-race-root';
  document.body.appendChild(raceRoot);
  const pending=[];
  const raceFetch=url=>new Promise(resolve=>pending.push({url:String(url),resolve}));
  const attentionPayload=title=>({
    view:'ATTENTION',
    as_of:'2026-09-20T00:00:00Z',
    timezone:'Asia/Seoul',
    coverage:'PERSONAL_ACTIVITY_ONLY',
    items:[{
      projection_id:'projection_'+title.toLowerCase(),
      activity_id:'activity_0123456789abcdef0123456789abcdef',
      occurrence_id:'occurrence_0123456789abcdef0123456789abcdef',
      title,
      due_date:'2026-09-24',
      state:'UPCOMING',
      days_until_due:4,
      confirmation_level:'USER_ATTESTED',
      provider_verified:false,
      source_kind:'USER_INPUT',
      allowed_actions:['UPDATE','REMOVE']
    }],
    ai_calls:0,
    provider_api_calls:0
  });
  const responseFor=title=>new Response(JSON.stringify(attentionPayload(title)),{status:200,headers:{'Content-Type':'application/json'}});
  const managerModule=await import('/site-calendar-manager.js?v=20260921-convcal2');
  const raceMount=managerModule.mountLifeCalendarManager({
    sessionToken:'site-token',
    root:raceRoot,
    initialView:'attention',
    timezone:'Asia/Seoul',
    now:new Date('2026-09-20T00:00:00Z'),
    fetchImpl:raceFetch
  });
  await wait(()=>pending.length===1,'first delayed authenticated request');
  const raceNext=raceRoot.querySelectorAll('.calendar-nav-button')[1];
  if(!(raceNext instanceof HTMLButtonElement))throw new Error('race next control missing');
  click(raceNext);
  await wait(()=>pending.length===2,'second authenticated request');
  pending[1].resolve(responseFor('LATEST'));
  await wait(()=>raceRoot.textContent.includes('LATEST'),'latest authenticated response');
  pending[0].resolve(responseFor('STALE'));
  await raceMount;
  await sleep(80);
  if(raceRoot.textContent.includes('STALE')||!raceRoot.textContent.includes('LATEST'))throw new Error('stale authenticated response overwrote latest Calendar state');
  if(raceRoot.getAttribute('aria-busy')==='true')throw new Error('latest Calendar request left aria-busy set');
  result.staleResponseGuard=true;
  raceRoot.remove();

  out.textContent=JSON.stringify(result);
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),viewport:{width:innerWidth,height:innerHeight}})}
</script></body></html>`;

function waitServer(){
  for(let i=0;i<50;i+=1){
    const p=spawnSync('curl',['--fail','--silent',ORIGIN+'/'],{timeout:1000});
    if(p.status===0)return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  throw new Error('server start');
}
function wrapperMarkup(w,h){
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},9000);
  <\/script></body></html>`;
}
function run(browser,w,h){
  fs.writeFileSync(WRAPPER,wrapperMarkup(w,h),'utf8');
  const r=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1600,1000','--force-device-scale-factor=1','--virtual-time-budget=10000','--dump-dom',ORIGIN+'/'+WRAPPER_REL],{encoding:'utf8',timeout:35000,maxBuffer:12*1024*1024});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error('browser '+r.status+' '+r.stderr);
  const a='<pre id="result">',b='</pre>',i=r.stdout.indexOf(a),j=r.stdout.indexOf(b,i);
  if(i<0||j<0)throw new Error('result missing');
  const raw=r.stdout.slice(i+a.length,j).replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
  const v=JSON.parse(raw);
  if(!v.ok)throw new Error(v.error);
  if(v.viewport.width!==w||v.viewport.height!==h)throw new Error('viewport '+v.viewport.width+'x'+v.viewport.height+' expected '+w+'x'+h);
  return v;
}

const browser=browserPath();
fs.writeFileSync(INNER,fixture,'utf8');
const server=spawn('python',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try{
  waitServer();
  const cases=[[1280,900],[1440,900],[1440,1200],[768,900],[340,800],[390,844],[412,915],[320,800]];
  const results=cases.map(([w,h])=>run(browser,w,h));
  const desktops=results.filter(value=>value.desktop);
  if(!desktops.every(value=>value.controls&&value.dateSelection&&value.eventSelection&&value.editorEscapeContained&&value.agendaRanges&&value.unscheduledReachable))throw new Error('desktop controls/date/event/Escape/Agenda/unscheduled selection');
  if(!results.every(value=>value.escapeContained))throw new Error('Calendar detail Escape containment');
  for(const value of results){
    if(!value.toolbar.todayOneLine||!value.toolbar.attentionOneLine||![28,35,42].includes(value.grid.cells))throw new Error('responsive Calendar contract');
    if(value.density.map(entry=>entry.expected).join(',')!=='0,1,2,3,5,8')throw new Error('fixture matrix incomplete');
  }
  console.log('CALENDAR MODAL RUNTIME PASS',JSON.stringify(results));
}finally{
  server.kill('SIGTERM');
  fs.rmSync(INNER,{force:true});
  fs.rmSync(WRAPPER,{force:true});
}
