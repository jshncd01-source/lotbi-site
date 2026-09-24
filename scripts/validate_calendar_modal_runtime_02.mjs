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
<!-- The product always loads this beside site-calendar.css; without it the
     totals bar renders unstyled and the month geometry is measured against a
     layout the product never shows. -->
<link rel="stylesheet" href="/site-calendar-expense.css">
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<140;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
const oneLine=node=>getComputedStyle(node).whiteSpace==='nowrap' && node.scrollHeight<=node.clientHeight+2;
const noX=node=>node.scrollWidth<=node.clientWidth+1;
try{
  localStorage.clear();
  // This fixture owns generic Calendar geometry/editor/navigation regression.
  // Korea holiday default-ON/rendering is independently covered by
  // validate_calendar_korea_holidays_01.mjs. Disable the decoration here so
  // asynchronous system-data refresh cannot make geometry evidence flaky.
  localStorage.setItem('lotbi.calendar.settings.v1',JSON.stringify({showKoreaHolidays:false}));
  const nativeFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(url,init)=>{
    const parsed=new URL(String(url),location.origin);
    if(parsed.pathname==='/v2/life/holidays'){
      const year=Number(parsed.searchParams.get('year')||new Date().getFullYear());
      return Promise.resolve(new Response(JSON.stringify({
        year,
        country:'KR',
        coverage_status:'VERIFIED',
        snapshot_version:'runtime-fixture-'+year,
        supported_years:[year],
        items:[],
        ai_calls:0,
        provider_api_calls:0
      }),{status:200,headers:{'Content-Type':'application/json'}}));
    }
    return nativeFetch(url,init);
  };
  const {createGuestCalendarRepository}=await import('/site-calendar-guest.js?v=20260921-convcal2');
  // This fixture measures how the month grid renders a crowded calendar, so it
  // seeds well past the shipped guest create quota on purpose. The quota is
  // covered by validate_guest_calendar_local_01.mjs; raising it here keeps that
  // product rule from silently becoming a layout assertion.
  const guestRepo=createGuestCalendarRepository(localStorage,{createQuota:200});
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
  await wait(
    ()=>content?.querySelector('[data-calendar-date="'+fixtureDates[1]+'"]')?.querySelectorAll('.calendar-event-chip').length===1,
    'guest Calendar local-first render',
  );
  await wait(
    ()=>content?.getAttribute('aria-busy')!=='true',
    'guest Calendar holiday decoration complete',
  );
  await wait(()=>{
    const candidate=modal.querySelector('.calendar-month-layout');
    const candidateCalendar=candidate?.children?.[0];
    return Boolean(
      candidate?.isConnected
      && candidateCalendar
      && candidate.getBoundingClientRect().width>0
      && candidateCalendar.getBoundingClientRect().width>0
    );
  },'month geometry');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','guest Calendar async decoration idle');
  // setTimeout rather than requestAnimationFrame: under --virtual-time-budget an
  // idle page may never produce another animation frame, and the double rAF then
  // never settles — the run ends as a mute "wrapper timeout" with no stage named.
  // validate_calendar_touch_monthnav_daysheet_01 already carries this fix.
  await new Promise(resolve=>setTimeout(resolve,50));
  const grid=modal.querySelector('.calendar-month-grid');
  const layout=modal.querySelector('.calendar-month-layout');
  const today=modal.querySelector('.calendar-today-button');
  // 확인 필요 탭은 없앴다. Week/Month/Year/Schedule의 네 역할을 검증한다.
  const agendaTab=[...modal.querySelectorAll('.calendar-mode-tab')].find(n=>n.textContent==='일정');
  const modeTabLabels=[...modal.querySelectorAll('.calendar-mode-tab')].map(n=>n.textContent);
  const calendar=layout?.children?.[0], detail=layout?.children?.[1];
  if(!grid||!layout||!today||!agendaTab||!calendar||!detail)throw new Error('month chrome missing');
  if(modeTabLabels.join('/')!=='주/월/년/일정')throw new Error('mode tabs must be 주/월/년/일정, got '+modeTabLabels.join('/'));
  const modalRect=modal.getBoundingClientRect(), contentRect=content.getBoundingClientRect(), layoutRect=layout.getBoundingClientRect();
  const gridRect=grid.getBoundingClientRect(), calRect=calendar.getBoundingClientRect(), detailRect=detail.getBoundingClientRect();
  const contentStyle=getComputedStyle(content);
  // No space under the month grid may be wasted. The expense totals bar owns a
  // row beneath the grid, so when it shows, the boundary is its top edge less
  // the shell's row gap — that gap is deliberate spacing, not slack.
  const expenseSlot=content.querySelector('.calendar-expense-slot:not([hidden])');
  const shellRowGap=expenseSlot
    ?(parseFloat(getComputedStyle(content.querySelector('.calendar-product-shell')).rowGap)||0)
    :0;
  const contentInnerBottom=expenseSlot
    ?expenseSlot.getBoundingClientRect().top-shellRowGap
    :contentRect.bottom-(parseFloat(contentStyle.paddingBottom)||0);
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
    toolbar:{todayOneLine:oneLine(today),agendaOneLine:oneLine(agendaTab),modeTabLabels,scrollWidth:toolbar.scrollWidth,clientWidth:toolbar.clientWidth,noX:noX(toolbar)},
    calendar:{width:calRect.width,layoutWidth:layoutRect.width,widthRatio:layoutRect.width>0?calRect.width/layoutRect.width:0},
    detail:{
      hidden:detail.hidden,
      position:getComputedStyle(detail).position,
      overflowY:getComputedStyle(detail).overflowY,
      scrollHeight:detail.scrollHeight,
      clientHeight:detail.clientHeight,
      top:detailRect.top,
      bottom:detailRect.bottom,
      left:detailRect.left,
      right:detailRect.right,
      presentation:detail.dataset.presentation||'',
      gridBottom:gridRect.bottom,
      backdrop:Boolean(layout.querySelector('[data-calendar-day-sheet-backdrop]')),
      viewportHeight:innerHeight,
      viewportWidth:innerWidth
    },
    desktop
  };
  if(![28,35,42].includes(result.grid.cells))throw new Error('month grid week count invalid '+result.grid.cells);
  if(result.grid.weekCount!==result.grid.cells/7)throw new Error('week count metadata mismatch');
  if(result.grid.rowHeightSpread>2)throw new Error('month row heights diverged '+result.grid.rowHeightSpread);
  if(!result.toolbar.todayOneLine||!result.toolbar.agendaOneLine)throw new Error('toolbar label wrapped');
  if(!result.modal.noX||!result.content.noX||!result.grid.noX)throw new Error('horizontal overflow');
  if(result.guest!=='guest')throw new Error('guest calendar contract');

  const density=[];
  fixtureCounts.forEach((expected,index)=>{
    const cell=grid.querySelector('[data-calendar-date="'+fixtureDates[index]+'"]');
    if(!cell)throw new Error('fixture date missing '+fixtureDates[index]);
    const rows=[...cell.querySelectorAll('.calendar-event-chip')];
    const expectedRows=Math.min(expected,2);
    if(rows.length!==expectedRows)throw new Error('Month must mount at most two rows '+fixtureDates[index]+' '+rows.length+' expected '+expectedRows);
    const countText=cell.querySelector('.calendar-mobile-event-count')?.textContent||'';
    const more=cell.querySelector('.calendar-event-overflow');
    const visible=rows.filter(row=>!row.hidden&&getComputedStyle(row).display!=='none').length;
    const overflowVisible=Boolean(more&&!more.hidden&&getComputedStyle(more).display!=='none');
    const hiddenCount=Math.max(0,expected-rows.length);
    const cellHeight=cell.getBoundingClientRect().height;
    if(desktop){
      if(visible!==expectedRows)throw new Error('representative rows must actually be visible '+fixtureDates[index]+' '+visible+' expected '+expectedRows);
      if(rows.length+hiddenCount!==expected)throw new Error('density count mismatch '+fixtureDates[index]+' mounted '+rows.length+' hidden '+hiddenCount+' expected '+expected);
      if(hiddenCount>0&&!overflowVisible)throw new Error('overflow summary must actually be visible '+fixtureDates[index]);
      if(hiddenCount>0&&more.textContent!=='+'+hiddenCount)throw new Error('overflow copy mismatch '+fixtureDates[index]);
      if(hiddenCount===0&&overflowVisible)throw new Error('zero overflow must stay hidden '+fixtureDates[index]);
      const stack=cell.querySelector('.calendar-event-stack');
      if(getComputedStyle(stack).overflowY==='auto'||getComputedStyle(stack).overflowY==='scroll')throw new Error('cell inner scrollbar '+fixtureDates[index]);
      if(rows.length>2)throw new Error('Month mounted unbounded event detail '+fixtureDates[index]);
    }else if(countText!==(expected?expected+'개':'')){
      throw new Error('mobile event count mismatch '+fixtureDates[index]+' '+countText+' expected '+expected);
    }
    density.push({date:fixtureDates[index],expected,visible,hiddenCount,overflowVisible,cellHeight});
  });
  result.density=density;

  if(desktop){
    if(modalRect.width<1050)throw new Error('desktop modal too narrow '+modalRect.width);
    if(modalRect.height<innerHeight-60)throw new Error('desktop modal too short '+modalRect.height);
    if(result.modal.overflowY!=='hidden')throw new Error('desktop modal must not scroll');
    if(result.content.overflowY!=='hidden')throw new Error('desktop month content must not scroll');
    if(result.calendar.widthRatio<0.97)throw new Error('desktop Month does not own available width '+result.calendar.widthRatio);
    if(!result.detail.hidden)throw new Error('desktop Calendar must start with an unobstructed Month');
    if(result.detail.presentation!=='SIDE')throw new Error('desktop selected-day detail contract must be SIDE');
    if(result.detail.position!=='sticky')throw new Error('desktop selected-day detail must remain a sticky side panel');
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
    const deleteButton=modal.querySelector('.calendar-editor-delete');
    if(!(editorTitle instanceof HTMLInputElement)||!(deleteButton instanceof HTMLButtonElement))throw new Error('event delete controls missing');
    editorTitle.value='임시 수정값 보존';
    for(let i=0;i<5;i+=1)click(deleteButton);
    await wait(()=>modal.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation dialog');
    if(modal.querySelectorAll('.calendar-delete-confirm-dialog').length!==1)throw new Error('duplicate delete confirmation dialog');
    const deleteDialog=modal.querySelector('.calendar-delete-confirm-dialog');
    if(deleteDialog.getAttribute('role')!=='dialog'||deleteDialog.getAttribute('aria-modal')!=='true')throw new Error('delete dialog semantics');
    if(deleteDialog.querySelector('h4')?.textContent!=='이 일정을 삭제하시겠습니까?')throw new Error('delete dialog title');
    if(deleteDialog.querySelector('#calendar-delete-confirm-description')?.textContent!=='삭제한 일정은 복구할 수 없습니다.')throw new Error('delete dialog description');
    const cancelDelete=deleteDialog.querySelector('.calendar-delete-confirm-cancel');
    if(!(cancelDelete instanceof HTMLButtonElement))throw new Error('delete cancel missing');
    await wait(()=>document.activeElement===cancelDelete,'safe delete focus');
    click(cancelDelete);
    await wait(()=>!modal.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation cancel');
    if(!modal.querySelector('.calendar-editor-dialog'))throw new Error('delete cancel closed editor');
    if(editorTitle.value!=='임시 수정값 보존')throw new Error('delete cancel lost editor draft');
    await wait(()=>document.activeElement===deleteButton,'delete focus restore');

    click(deleteButton);
    await wait(()=>modal.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation reopen');
    const reopenedDelete=modal.querySelector('.calendar-delete-confirm-dialog');
    reopenedDelete.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!modal.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation Escape');
    if(!modal.querySelector('.calendar-editor-dialog'))throw new Error('delete Escape closed editor');
    if(editorTitle.value!=='임시 수정값 보존')throw new Error('delete Escape lost editor draft');

    editorTitle.focus();
    editorTitle.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'event editor Escape close');
    if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('editor Escape closed the Calendar modal');
    await wait(()=>document.activeElement?.dataset.calendarEventId===eventButton.dataset.calendarEventId,'event focus restore');
    if(modal.querySelector('.calendar-delete-confirm-dialog'))throw new Error('delete state leaked after editor close');
    result.eventSelection=true;
    result.editorEscapeContained=true;
    result.deleteConfirmation=true;

  }else{
    if(modalRect.width>innerWidth+1)throw new Error('responsive modal wider than viewport');
    if(!result.toolbar.noX)throw new Error('responsive toolbar must not rely on horizontal scrolling');
    // The contract moved three times: the below-the-month flow panel became a
    // bottom sheet, the sheet became a panel anchored to the tapped date, and
    // now the panel waits to be asked. It used to be open the moment the
    // Calendar opened -- a window for a date nobody had pressed, which is what
    // 대표 reported. So the entry assertion is inverted rather than dropped:
    // showing it on entry again is the regression.
    if(!result.detail.hidden)throw new Error('touch Calendar must not show a selected-day surface before a date is pressed');
    // Everything below is about the panel a tap opens, so tap one first. Today
    // is the date the panel used to raise itself on, so the geometry measured
    // here is the same geometry this gate has always measured.
    const entryCell=grid.querySelector('.calendar-date-cell[data-selected="true"]')
      ||grid.querySelector('.calendar-date-cell[data-current-month="true"]');
    click(entryCell);
    await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'touch selected-day panel opens on a tap');
    {
      const opened=modal.querySelector('.calendar-day-panel');
      // The panel rises into place; geometry is only meaningful once it stops.
      let previous=null,stable=0;
      for(let i=0;i<120;i+=1){
        const current=opened.getBoundingClientRect().bottom;
        if(previous!==null&&Math.abs(current-previous)<0.5){stable+=1;if(stable>=3)break}else stable=0;
        previous=current;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      const openedRect=opened.getBoundingClientRect();
      result.detail={
        ...result.detail,
        hidden:opened.hidden,
        position:getComputedStyle(opened).position,
        overflowY:getComputedStyle(opened).overflowY,
        scrollHeight:opened.scrollHeight,
        clientHeight:opened.clientHeight,
        top:openedRect.top,
        bottom:openedRect.bottom,
        left:openedRect.left,
        right:openedRect.right,
        presentation:opened.dataset.presentation||'',
        backdrop:Boolean(layout.querySelector('[data-calendar-day-sheet-backdrop]')),
        // Opening a FLOW detail may scroll the Calendar content so its actions
        // are immediately reachable. Compare against the grid's position after
        // that scroll, not the DOMRect cached before the user tapped the date.
        gridBottom:grid.getBoundingClientRect().bottom,
      };
    }
    // Mobile detail is in normal flow below the month. It may require vertical
    // scrolling, but it must never cover or dismiss the grid.
    if(result.detail.hidden)throw new Error('a tap on a date must open the selected-day surface');
    if(result.detail.presentation!=='FLOW')throw new Error('touch selected-day surface must be the in-flow panel');
    if(result.detail.position!=='static')throw new Error('touch selected-day panel must stay in document flow');
    if(result.detail.backdrop)throw new Error('touch selected-day panel must not lay a dismiss layer over the month');
    if(result.detail.left<-1||result.detail.right>innerWidth+1)throw new Error('touch selected-day panel horizontal overflow');
    if(result.detail.top<result.detail.gridBottom-2)throw new Error('touch selected-day panel covers the month grid');

    const mobileEventCell=grid.querySelector('[data-calendar-date="'+fixtureDates[1]+'"]');
    const mobileEventButton=mobileEventCell?.querySelector('.calendar-event-chip');
    if(!(mobileEventButton instanceof HTMLButtonElement))throw new Error('mobile event editor target missing');
    click(mobileEventButton);
    await wait(()=>modal.querySelector('.calendar-editor-dialog'),'mobile event editor');
    const mobileEditor=modal.querySelector('.calendar-editor-dialog');
    const mobileEditorBody=modal.querySelector('.calendar-editor-body');
    const mobileEditorActions=modal.querySelector('.calendar-editor-actions');
    if(!(mobileEditor instanceof HTMLElement)||!(mobileEditorBody instanceof HTMLElement)||!(mobileEditorActions instanceof HTMLElement))throw new Error('mobile event editor shell missing');
    const mobileEditorRect=mobileEditor.getBoundingClientRect();
    const mobileBodyStyle=getComputedStyle(mobileEditorBody);
    const mobileActionsRect=mobileEditorActions.getBoundingClientRect();
    if(mobileEditorRect.left<-1||mobileEditorRect.right>innerWidth+1)throw new Error('mobile editor horizontal overflow');
    if(mobileEditorRect.top<-1||mobileEditorRect.bottom>innerHeight+1)throw new Error('mobile editor escapes viewport');
    if(mobileBodyStyle.overflowY!=='auto')throw new Error('mobile editor body must own vertical scroll');
    if(getComputedStyle(document.body).overflow!=='hidden')throw new Error('mobile editor must lock background scroll');
    if(mobileActionsRect.bottom>mobileEditorRect.bottom+1)throw new Error('mobile editor action footer unreachable');
    if(innerWidth<=520&&mobileEditorRect.height<innerHeight-2)throw new Error('phone editor must use the visual viewport');
    const detailsSummary=mobileEditor.querySelector('.calendar-editor-details > summary');
    const editorDetails=mobileEditor.querySelector('.calendar-editor-details');
    if(!(detailsSummary instanceof HTMLElement)||!(editorDetails instanceof HTMLDetailsElement))throw new Error('mobile optional details disclosure missing');
    click(detailsSummary);
    await wait(()=>editorDetails.open,'mobile optional details open');
    const merchant=modal.querySelector('.calendar-editor-merchant');
    if(!(merchant instanceof HTMLInputElement))throw new Error('mobile lower field missing');
    merchant.focus();
    await new Promise(resolve=>setTimeout(resolve,40));
    const merchantRect=merchant.getBoundingClientRect();
    const mobileBodyRect=mobileEditorBody.getBoundingClientRect();
    if(merchantRect.top<mobileBodyRect.top-2||merchantRect.bottom>mobileBodyRect.bottom+2)throw new Error('mobile lower field focus did not scroll into the editor body');
    if(mobileBodyRect.bottom>mobileActionsRect.top+2)throw new Error('mobile editor body overlaps fixed actions');
    const mobileClose=modal.querySelector('.calendar-editor-close');
    if(!(mobileClose instanceof HTMLButtonElement))throw new Error('mobile editor close control missing');
    click(mobileClose);
    await wait(()=>!modal.querySelector('.calendar-editor-dialog'),'mobile editor close');
    if(document.body.classList.contains('calendar-editor-open'))throw new Error('mobile editor background lock leaked');
    result.mobileEditor=true;
  }

  const waitCalendarIdle=label=>wait(()=>content.getAttribute('aria-busy')!=='true',label+' idle');
  const mode=async name=>{
    const button=[...modal.querySelectorAll('.calendar-mode-tab')].find(n=>n.textContent===name);
    click(button);
    await wait(()=>content.dataset.calendarManagerView===({주:'week',년:'year',일정:'agenda',월:'month'}[name]),name);
    await waitCalendarIdle(name);
  };
  await mode('주');
  await mode('년');
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
  await mode('월');
  const title=modal.querySelector('.calendar-title-button').textContent;
  click(modal.querySelector('.calendar-nav-button'));
  await wait(()=>modal.querySelector('.calendar-title-button').textContent!==title,'previous');
  await waitCalendarIdle('previous');
  click(modal.querySelectorAll('.calendar-nav-button')[1]);
  await wait(()=>modal.querySelector('.calendar-title-button').textContent===title,'next');
  await waitCalendarIdle('next');
  const ordinary=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
  const selectedDate=ordinary?.dataset.calendarDate;
  click(ordinary);
  await wait(()=>modal.querySelector('[data-calendar-date="'+selectedDate+'"]')?.dataset.selected==='true','date selection');
  await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'selected-day detail open');
  const settingsButton=modal.querySelector('.calendar-settings-button');
  if(!(settingsButton instanceof HTMLButtonElement))throw new Error('Settings opener missing');
  settingsButton.focus();
  click(settingsButton);
  await wait(()=>modal.querySelector('.calendar-settings-dialog'),'Settings dialog open');
  const settingsDialog=modal.querySelector('.calendar-settings-dialog');
  const settingsFocusable=()=>[...settingsDialog.querySelectorAll('button, input, select, summary')]
    .filter(control=>!control.disabled&&!control.hidden&&!control.closest('[hidden]'));
  const firstSettingsControl=settingsFocusable()[0];
  const lastSettingsControl=settingsFocusable().at(-1);
  lastSettingsControl.focus();
  lastSettingsControl.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  if(document.activeElement!==firstSettingsControl)throw new Error('Settings forward Tab escaped the dialog');
  firstSettingsControl.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  if(document.activeElement!==lastSettingsControl)throw new Error('Settings backward Tab escaped the dialog');
  lastSettingsControl.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!modal.querySelector('.calendar-settings-dialog'),'Settings Escape close');
  if(modal.querySelector('.calendar-day-panel')?.hidden)throw new Error('Settings Escape also closed the underlying day detail');
  await wait(()=>document.activeElement===settingsButton,'Settings Escape focus restore');
  result.settingsModalContained=true;
  const selectedTrigger=modal.querySelector('[data-calendar-date-trigger="'+selectedDate+'"]');
  selectedTrigger.focus();
  selectedTrigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.hidden===true,'selected-day Escape close');
  if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('day-detail Escape closed the Calendar modal');
  await wait(()=>document.activeElement?.dataset.calendarDateTrigger===selectedDate,'selected-day Escape focus restore');
  result.escapeContained=true;
  click(modal.querySelector('.calendar-today-button'));
  await wait(()=>content.dataset.calendarManagerView==='month','today');
  await waitCalendarIdle('today');
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

  const draftRoot=document.createElement('div');
  draftRoot.id='calendar-draft-root';
  document.body.appendChild(draftRoot);
  const draftManagerModule=await import('/site-calendar-manager.js?v=20260921-convcal2');
  const draftMount=await draftManagerModule.mountLifeCalendarManager({
    sessionToken:'',
    root:draftRoot,
    initialView:'agenda',
    timezone:'Asia/Seoul',
    guestRepository:createGuestCalendarRepository(localStorage,{createQuota:200}),
    initialDraft:{
      title:'보험 서류 확인',
      localDate:null,
      localTime:null,
      entry:{
        amountMinor:12000,
        currency:'KRW',
        expenseCategory:'LIVING',
        memo:'사진에서 확인한 메모',
        place:'전주',
        merchant:'예약처'
      }
    }
  });
  if(!draftMount)throw new Error('draft manager mount failed');
  await wait(()=>draftRoot.querySelector('.calendar-editor-dialog'),'draft editor');
  if(draftRoot.querySelector('.calendar-editor-dialog h3')?.textContent!=='일정 초안 확인')throw new Error('draft editor heading');
  if(draftRoot.querySelector('.calendar-editor-title')?.value!=='보험 서류 확인')throw new Error('draft title not prefilled');
  if(draftRoot.querySelector('.calendar-editor-date')?.value!=='')throw new Error('draft editor invented a date');
  if(draftRoot.querySelector('.calendar-editor-amount')?.value!=='12000')throw new Error('draft amount not prefilled');
  if(draftRoot.querySelector('.calendar-editor-memo')?.value!=='사진에서 확인한 메모')throw new Error('draft memo not prefilled');
  draftRoot.querySelector('.calendar-editor-title')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!draftRoot.querySelector('.calendar-editor-dialog'),'draft editor Escape close');
  result.calendarDraftEditable=true;
  draftRoot.remove();

  // Overlapping request generation is covered deterministically by
  // validate_calendar_real_ui_01.mjs. Keep this browser fixture focused on
  // geometry, editor containment, navigation, and real interaction surfaces.
  result.staleResponseGuard=true;

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
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},20000);
  <\/script></body></html>`;
}
function run(browser,w,h){
  fs.writeFileSync(WRAPPER,wrapperMarkup(w,h),'utf8');
  const r=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1600,1000','--force-device-scale-factor=1','--virtual-time-budget=22000','--dump-dom',ORIGIN+'/'+WRAPPER_REL],{encoding:'utf8',timeout:50000,maxBuffer:12*1024*1024});
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
  const mobiles=results.filter(value=>!value.desktop);
  if(!desktops.every(value=>value.controls&&value.dateSelection&&value.eventSelection&&value.editorEscapeContained&&value.deleteConfirmation&&value.agendaRanges&&value.unscheduledReachable))throw new Error('desktop controls/date/event/delete-confirm/Escape/Agenda/unscheduled selection');
  if(!mobiles.every(value=>value.mobileEditor))throw new Error('mobile editor viewport/scroll/background-lock contract');
  if(!results.every(value=>value.escapeContained&&value.calendarDraftEditable))throw new Error('Calendar detail Escape/draft editor containment');
  for(const value of results){
    if(!value.toolbar.todayOneLine||!value.toolbar.agendaOneLine||![28,35,42].includes(value.grid.cells))throw new Error('responsive Calendar contract');
    if(value.density.map(entry=>entry.expected).join(',')!=='0,1,2,3,5,8')throw new Error('fixture matrix incomplete');
  }
  console.log('CALENDAR MODAL RUNTIME PASS',JSON.stringify(results));
}finally{
  server.kill('SIGTERM');
  fs.rmSync(INNER,{force:true});
  fs.rmSync(WRAPPER,{force:true});
}
