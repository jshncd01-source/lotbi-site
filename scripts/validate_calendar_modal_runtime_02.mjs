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
  // CALENDAR-DESIGN-04: the workspace Calendar is the approved design 04. The
  // same promises as before are kept on its own markup: a bounded month cell,
  // a selected day that is part of the page, event detail → edit / delete with
  // a contained confirmation, Escape that closes only the top dialog, and the
  // four views with the undated list reachable.
  await wait(
    ()=>content?.querySelector('.c4-mc[data-calendar-date="'+fixtureDates[1]+'"]')?.querySelectorAll('.c4-mc-ev').length===1,
    'guest Calendar local-first render',
  );
  await wait(()=>content?.getAttribute('aria-busy')!=='true','guest Calendar holiday decoration complete');
  await wait(()=>modal.querySelector('.c4-mo-g')?.getBoundingClientRect().width>0,'month geometry');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','guest Calendar async decoration idle');
  // setTimeout rather than requestAnimationFrame: under --virtual-time-budget an
  // idle page may never produce another animation frame.
  await new Promise(resolve=>setTimeout(resolve,50));
  const shown=node=>Boolean(node&&node.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');
  const grid=modal.querySelector('.c4-mo-g');
  const today=modal.querySelector('.calendar-today-button');
  const agendaTab=[...modal.querySelectorAll('.calendar-mode-tab')].find(n=>n.textContent==='일정');
  const modeTabLabels=[...modal.querySelectorAll('.calendar-mode-tab')].map(n=>n.textContent);
  if(!grid||!today||!agendaTab)throw new Error('month chrome missing');
  if(modal.dataset.calendarDesign!=='c4')throw new Error('the workspace Calendar must be the approved design 04, got '+(modal.dataset.calendarDesign||'none'));
  if(modeTabLabels.join('/')!=='주/월/년/일정')throw new Error('mode tabs must be 주/월/년/일정, got '+modeTabLabels.join('/'));
  const modalRect=modal.getBoundingClientRect();
  const toolbar=modal.querySelector('.calendar-toolbar');
  const desktop=innerWidth>900;
  const cellNodes=[...grid.querySelectorAll('.c4-mc')];
  const cellHeights=cellNodes.map(node=>node.getBoundingClientRect().height);
  const rowHeightSpread=cellHeights.length?Math.max(...cellHeights)-Math.min(...cellHeights):0;
  const dayList=()=>[...modal.querySelectorAll('.c4-daycard,.c4-agenda')].find(shown)||null;
  const overlayOpen=()=>Boolean(document.querySelector('.c4-dlg-backdrop,.calendar-day-panel,[data-calendar-day-detail-backdrop],.calendar-day-sheet-backdrop'));
  const result={
    ok:true,
    viewport:{width:innerWidth,height:innerHeight},
    bound:true,
    guest:content.dataset.calendarAccess,
    modal:{width:modalRect.width,height:modalRect.height,noX:noX(modal)},
    content:{noX:noX(content)},
    grid:{cells:cellNodes.length,weekCount:Number(grid.dataset.weekCount||0),noX:noX(grid),rowHeightSpread},
    toolbar:{todayOneLine:oneLine(today),agendaOneLine:oneLine(agendaTab),modeTabLabels,scrollWidth:toolbar.scrollWidth,clientWidth:toolbar.clientWidth,noX:noX(toolbar)},
    mount:{
      listDate:dayList()?.dataset.selectedDate||'',
      todayDate:grid.querySelector('.c4-mc[data-today="true"]')?.dataset.calendarDate||'',
      selected:[...grid.querySelectorAll('.c4-mc[data-selected="true"]')].map(n=>n.dataset.calendarDate),
      overlay:overlayOpen(),
    },
    desktop
  };
  if(![28,35,42].includes(result.grid.cells))throw new Error('month grid week count invalid '+result.grid.cells);
  if(result.grid.weekCount!==result.grid.cells/7)throw new Error('week count metadata mismatch');
  if(result.grid.rowHeightSpread>2)throw new Error('month row heights diverged '+result.grid.rowHeightSpread);
  if(!result.toolbar.todayOneLine||!result.toolbar.agendaOneLine)throw new Error('toolbar label wrapped');
  if(!result.modal.noX||!result.content.noX||!result.grid.noX)throw new Error('horizontal overflow '+JSON.stringify({modal:[modal.scrollWidth,modal.clientWidth],content:[content.scrollWidth,content.clientWidth],grid:[grid.scrollWidth,grid.clientWidth],vw:innerWidth,wide:[...modal.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>modal.getBoundingClientRect().right+1).slice(0,6).map(n=>n.tagName+'.'+String(n.className).slice(0,60)+':'+Math.round(n.getBoundingClientRect().right))}));
  if(result.guest!=='guest')throw new Error('guest calendar contract');
  if(result.mount.overlay)throw new Error('the Calendar must open without a window over the month');
  if(result.mount.selected.join(',')!==result.mount.todayDate||result.mount.listDate!==result.mount.todayDate)throw new Error('the Calendar must open with today selected and listed, got '+result.mount.selected.join(',')+' / '+result.mount.listDate);

  // A month cell names at most three records, then "+N개 더" (wide) or the
  // same count as dots (phone). It never scrolls inside itself.
  const density=[];
  fixtureCounts.forEach((expected,index)=>{
    const cell=grid.querySelector('.c4-mc[data-calendar-date="'+fixtureDates[index]+'"]');
    if(!cell)throw new Error('fixture date missing '+fixtureDates[index]);
    const rows=[...cell.querySelectorAll('.c4-mc-ev')];
    const expectedRows=Math.min(expected,3);
    if(rows.length!==expectedRows)throw new Error('Month must mount at most three rows '+fixtureDates[index]+' '+rows.length+' expected '+expectedRows);
    const hiddenCount=Math.max(0,expected-rows.length);
    if(rows.length+hiddenCount!==expected)throw new Error('density count mismatch '+fixtureDates[index]);
    const more=cell.querySelector('.c4-mc-more');
    if(hiddenCount>0&&more?.textContent!=='+'+hiddenCount+'개 더')throw new Error('overflow copy mismatch '+fixtureDates[index]+' '+(more?.textContent||'(none)'));
    if(hiddenCount===0&&more)throw new Error('zero overflow must not render a "더" line '+fixtureDates[index]);
    const dots=cell.querySelector('.c4-mc-dots');
    const dotCount=dots?dots.querySelectorAll('i').length:0;
    if(dotCount!==expectedRows)throw new Error('dot count mismatch '+fixtureDates[index]+' '+dotCount+' expected '+expectedRows);
    if(Boolean(dots?.querySelector('b'))!==(hiddenCount>0))throw new Error('dot overflow mark mismatch '+fixtureDates[index]);
    const stack=cell.querySelector('.c4-mc-evs');
    if(['auto','scroll'].includes(getComputedStyle(stack).overflowY))throw new Error('cell inner scrollbar '+fixtureDates[index]);
    const cellRect=cell.getBoundingClientRect();
    let visible=0,overflowVisible=false;
    if(desktop){
      visible=rows.filter(shown).length;
      if(visible!==expectedRows)throw new Error('representative rows must actually be visible '+fixtureDates[index]+' '+visible+' expected '+expectedRows);
      overflowVisible=shown(more);
      if(hiddenCount>0&&!overflowVisible)throw new Error('overflow summary must actually be visible '+fixtureDates[index]);
      if(hiddenCount>0&&more.getBoundingClientRect().bottom>cellRect.bottom+1)throw new Error('overflow summary is cut off by the cell '+fixtureDates[index]);
      if(shown(dots))throw new Error('wide cells name records instead of dots '+fixtureDates[index]);
    }else{
      if(rows.some(shown))throw new Error('phone cells show dots, not record names '+fixtureDates[index]);
      if(expected>0&&!shown(dots))throw new Error('phone cells must show their record dots '+fixtureDates[index]);
    }
    density.push({date:fixtureDates[index],expected,visible,hiddenCount,overflowVisible,cellHeight:cellRect.height});
  });
  result.density=density;

  const openDayAndFirstRow=async date=>{
    click(grid.querySelector('.c4-mc[data-calendar-date="'+date+'"]'));
    await wait(()=>dayList()?.dataset.selectedDate===date,'day list follows '+date);
    await wait(()=>dayList()?.querySelector('.c4-dc-ev'),'day list row '+date);
    return dayList().querySelector('.c4-dc-ev');
  };

  if(desktop){
    if(modalRect.width<900)throw new Error('desktop calendar workspace too narrow '+modalRect.width);
    const side=modal.querySelector('.c4-side');
    if(!shown(side)||side.getBoundingClientRect().left<grid.getBoundingClientRect().right-1)throw new Error('desktop keeps the selected day and the ledger beside the month');

    const eventButton=await openDayAndFirstRow(fixtureDates[1]);
    if(!(eventButton instanceof HTMLButtonElement))throw new Error('event click target missing');
    eventButton.focus();
    click(eventButton);
    await wait(()=>document.querySelector('.c4-detail'),'event detail');
    const detail=document.querySelector('.c4-detail');
    if(detail.querySelector('#c4-detail-heading')?.textContent!=='치과')throw new Error('event click opened the wrong record');
    const deleteButton=detail.querySelector('[data-calendar-detail-delete]');
    const editButton=detail.querySelector('[data-calendar-detail-edit]');
    if(!(deleteButton instanceof HTMLButtonElement)||!(editButton instanceof HTMLButtonElement))throw new Error('event detail edit/delete controls missing');
    for(let i=0;i<5;i+=1)click(deleteButton);
    await wait(()=>document.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation dialog');
    if(document.querySelectorAll('.calendar-delete-confirm-dialog').length!==1)throw new Error('duplicate delete confirmation dialog');
    const deleteDialog=document.querySelector('.calendar-delete-confirm-dialog');
    if(deleteDialog.getAttribute('role')!=='dialog'||deleteDialog.getAttribute('aria-modal')!=='true')throw new Error('delete dialog semantics');
    if(deleteDialog.querySelector('h4')?.textContent!=='이 일정을 삭제하시겠습니까?')throw new Error('delete dialog title');
    if(deleteDialog.querySelector('p')?.textContent!=='삭제한 일정은 복구할 수 없습니다.')throw new Error('delete dialog description');
    const cancelDelete=deleteDialog.querySelector('.calendar-delete-confirm-cancel');
    if(!(cancelDelete instanceof HTMLButtonElement))throw new Error('delete cancel missing');
    await wait(()=>document.activeElement===cancelDelete,'safe delete focus');
    click(cancelDelete);
    await wait(()=>!document.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation cancel');
    if(!document.querySelector('.c4-detail'))throw new Error('delete cancel closed the detail');
    await wait(()=>document.activeElement===deleteButton,'delete focus restore');

    click(deleteButton);
    await wait(()=>document.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation reopen');
    document.querySelector('.calendar-delete-confirm-dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!document.querySelector('.calendar-delete-confirm-dialog'),'delete confirmation Escape');
    if(!document.querySelector('.c4-detail'))throw new Error('delete Escape closed the detail');
    if(!grid.isConnected&&!modal.querySelector('.c4-mo-g'))throw new Error('delete Escape rebuilt the Calendar');

    detail.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!document.querySelector('.c4-detail'),'event detail Escape close');
    if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('detail Escape closed the Calendar');
    await wait(()=>document.activeElement?.dataset.calendarEventId===eventButton.dataset.calendarEventId,'event focus restore');

    // 상세 → 수정: the editor opens on the record, and Escape closes only it.
    click([...dayList().querySelectorAll('.c4-dc-ev')][0]);
    await wait(()=>document.querySelector('.c4-detail [data-calendar-detail-edit]'),'event detail again');
    click(document.querySelector('.c4-detail [data-calendar-detail-edit]'));
    await wait(()=>document.querySelector('.c4-editor'),'event editor');
    const editor=document.querySelector('.c4-editor');
    if(editor.querySelector('#calendar-editor-heading')?.textContent!=='일정 수정')throw new Error('수정 opened the wrong surface');
    if(document.querySelector('.c4-detail'))throw new Error('the editor must replace the detail, not stack over it');
    const editorTitle=editor.querySelector('.calendar-editor-title');
    if(!(editorTitle instanceof HTMLInputElement)||editorTitle.value!=='치과')throw new Error('editor title not prefilled');
    editorTitle.focus();
    editorTitle.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!document.querySelector('.c4-editor'),'event editor Escape close');
    if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('editor Escape closed the Calendar');
    if(document.body.classList.contains('calendar-editor-open'))throw new Error('editor background lock leaked');
    result.eventSelection=true;
    result.editorEscapeContained=true;
    result.deleteConfirmation=true;
  }else{
    if(modalRect.width>innerWidth+1)throw new Error('responsive modal wider than viewport');
    if(!result.toolbar.noX)throw new Error('responsive toolbar must not rely on horizontal scrolling');
    // A tap on a date lists that day under the month; nothing slides over it.
    const mobileEventButton=await openDayAndFirstRow(fixtureDates[1]);
    if(overlayOpen())throw new Error('a tap on a date must not open a sheet over the month');
    const listRect=dayList().getBoundingClientRect();
    if(listRect.top<grid.getBoundingClientRect().bottom-1)throw new Error('the phone day list must sit under the month');
    if(listRect.left<-1||listRect.right>innerWidth+1)throw new Error('phone day list horizontal overflow');
    click(mobileEventButton);
    await wait(()=>document.querySelector('.c4-detail'),'mobile event detail');
    const detailBackdrop=document.querySelector('.c4-detail-backdrop');
    const detailRect=document.querySelector('.c4-detail').getBoundingClientRect();
    if(detailBackdrop.dataset.editorPresentation!=='SHEET')throw new Error('phone event detail must be a bottom sheet');
    if(detailRect.left<-1||detailRect.right>innerWidth+1||detailRect.top<-1)throw new Error('phone event detail escapes the viewport');
    if(Math.abs(detailRect.bottom-innerHeight)>2)throw new Error('phone event detail must rest on the bottom of the viewport ('+detailRect.bottom+' vs '+innerHeight+')');
    click(document.querySelector('.c4-detail [data-calendar-detail-edit]'));
    await wait(()=>document.querySelector('.c4-editor'),'mobile event editor');
    const mobileEditor=document.querySelector('.c4-editor');
    const mobileEditorBody=mobileEditor.querySelector('.calendar-editor-body');
    const topSave=mobileEditor.querySelector('[data-calendar-editor-save-top]');
    if(!(mobileEditorBody instanceof HTMLElement)||!(topSave instanceof HTMLButtonElement))throw new Error('mobile event editor shell missing');
    const mobileEditorRect=mobileEditor.getBoundingClientRect();
    if(mobileEditorRect.left<-1||mobileEditorRect.right>innerWidth+1)throw new Error('mobile editor horizontal overflow');
    if(mobileEditorRect.top<-1||mobileEditorRect.bottom>innerHeight+1)throw new Error('mobile editor escapes viewport');
    if(getComputedStyle(mobileEditorBody).overflowY!=='auto')throw new Error('mobile editor body must own vertical scroll');
    if(getComputedStyle(document.body).overflow!=='hidden')throw new Error('mobile editor must lock background scroll');
    if(Math.abs(mobileEditorRect.bottom-innerHeight)>2)throw new Error('touch editor sheet must rest on the bottom of the visual viewport ('+mobileEditorRect.bottom+' vs '+innerHeight+')');
    // Save stays in the header, so an open keyboard never hides it.
    const topSaveRect=topSave.getBoundingClientRect();
    if(!shown(topSave)||topSaveRect.top<mobileEditorRect.top-1||topSaveRect.bottom>mobileEditorBody.getBoundingClientRect().top+1)throw new Error('mobile editor save must sit in the header above the body');
    const moreChip=mobileEditor.querySelector('[data-editor-chip="more"]');
    const moreSection=mobileEditor.querySelector('[data-editor-section="more"]');
    if(!(moreChip instanceof HTMLButtonElement)||!(moreSection instanceof HTMLElement))throw new Error('mobile optional details chip missing');
    click(moreChip);
    await wait(()=>!moreSection.hidden,'mobile optional details open');
    const merchant=mobileEditor.querySelector('.calendar-editor-merchant');
    if(!(merchant instanceof HTMLInputElement))throw new Error('mobile lower field missing');
    merchant.focus();
    await new Promise(resolve=>setTimeout(resolve,40));
    const merchantRect=merchant.getBoundingClientRect();
    const mobileBodyRect=mobileEditorBody.getBoundingClientRect();
    if(merchantRect.top<mobileBodyRect.top-2||merchantRect.bottom>mobileBodyRect.bottom+2)throw new Error('mobile lower field focus did not scroll into the editor body');
    click(mobileEditor.querySelector('.c4-top-cancel')||mobileEditor.querySelector('.calendar-editor-close'));
    await wait(()=>!document.querySelector('.c4-editor'),'mobile editor close');
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
  // 날짜 미정 has its own chip, with its count, and its records open like any other.
  const undatedChip=modal.querySelector('[data-agenda-scope="unscheduled"]');
  if(!(undatedChip instanceof HTMLButtonElement)||!/날짜 미정\s*1/.test(undatedChip.textContent))throw new Error('Agenda 날짜 미정 chip must show its count, got '+(undatedChip?.textContent||'(none)'));
  click(undatedChip);
  await wait(()=>modal.querySelector('.calendar-unscheduled-group'),'Agenda unscheduled group');
  const unscheduledGroup=modal.querySelector('.calendar-unscheduled-group');
  if(!/^날짜 미정/.test(unscheduledGroup?.querySelector('.c4-lg-hd')?.textContent||''))throw new Error('unscheduled heading missing');
  const unscheduledEvent=[...unscheduledGroup.querySelectorAll('.c4-lr')].find(node=>node.textContent.includes('날짜 미정 할 일'));
  if(!(unscheduledEvent instanceof HTMLElement))throw new Error('unscheduled event missing');
  click(unscheduledEvent);
  await wait(()=>document.querySelector('.c4-detail [data-calendar-detail-edit]'),'unscheduled detail');
  click(document.querySelector('.c4-detail [data-calendar-detail-edit]'));
  await wait(()=>document.querySelector('.c4-editor'),'unscheduled editor');
  if(document.querySelector('.c4-editor .calendar-editor-date')?.value!=='')throw new Error('unscheduled editor invented a date');
  document.querySelector('.c4-editor .calendar-editor-title')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!document.querySelector('.c4-editor'),'unscheduled editor Escape close');
  result.unscheduledReachable=true;
  const upcomingRange=modal.querySelector('[data-agenda-scope="upcoming"]');
  if(!(upcomingRange instanceof HTMLButtonElement))throw new Error('Agenda upcoming control missing');
  click(upcomingRange);
  await wait(()=>modal.querySelector('[data-agenda-scope="upcoming"]')?.getAttribute('aria-pressed')==='true','Agenda upcoming range');
  result.agendaRanges=true;
  await mode('월');
  const title=modal.querySelector('.calendar-title-button').textContent;
  click(modal.querySelector('.calendar-nav-button'));
  await wait(()=>modal.querySelector('.calendar-title-button').textContent!==title,'previous');
  await waitCalendarIdle('previous');
  click(modal.querySelectorAll('.calendar-nav-button')[1]);
  await wait(()=>modal.querySelector('.calendar-title-button').textContent===title,'next');
  await waitCalendarIdle('next');
  const ordinary=[...modal.querySelectorAll('.c4-mc[data-current-month="true"]')].find(n=>n.dataset.selected!=='true');
  const selectedDate=ordinary?.dataset.calendarDate;
  click(ordinary);
  await wait(()=>modal.querySelector('.c4-mc[data-calendar-date="'+selectedDate+'"]')?.dataset.selected==='true','date selection');
  await wait(()=>dayList()?.dataset.selectedDate===selectedDate,'selected-day list follows');
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
  if(!document.querySelector('.site-modal.site-calendar-modal'))throw new Error('Settings Escape closed the Calendar');
  if(dayList()?.dataset.selectedDate!==selectedDate)throw new Error('Settings Escape lost the selected day');
  await wait(()=>document.activeElement===settingsButton,'Settings Escape focus restore');
  result.settingsModalContained=true;
  result.escapeContained=true;
  click(modal.querySelector('.calendar-today-button'));
  await wait(()=>content.dataset.calendarManagerView==='month','today');
  await waitCalendarIdle('today');
  await wait(()=>dayList()?.dataset.selectedDate===result.mount.todayDate,'today button selects today');
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
  if(String(draftRoot.querySelector('.calendar-editor-amount')?.value||'').replace(/,/g,'')!=='12000')throw new Error('draft amount not prefilled');
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
  const profile=fs.mkdtempSync(path.join(ROOT,'scripts/.calendar-runtime-profile-'));
  const r=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1600,1000','--force-device-scale-factor=1','--virtual-time-budget=22000','--dump-dom','--user-data-dir='+profile,ORIGIN+'/'+WRAPPER_REL+'?viewport='+w+'x'+h],{encoding:'utf8',timeout:50000,maxBuffer:12*1024*1024});
  try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
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
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
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
