// Locks the Calendar ledger (LIFE UX 01, updated for the owner-approved
// calendar design 04 on 2026-10-14).
//
// The month's recorded amounts are one clear total -- the ledger card beside
// the calendar on a desk, the folded line at the bottom on a phone -- with the
// six fixed categories beneath it on the desk card. Planned (not yet paid)
// amounts are shown apart and never added to the total.
//
// Covered contracts:
//   - one total control: a real 44px+ button naming the period, the total and
//     that it opens; no category name on the phone line
//   - the desk card lists all six categories in the fixed order with their
//     own colour, legible (WCAG AA) in Light and Dark; planned money is a
//     separate "예정" line that says it is not in the total
//   - the period follows the view: Week, Month and 일정 read the civil month,
//     Year reads the civil year -- never the 42-cell grid; the signed-in read
//     asks Core for the planned amounts (include_planned=true)
//   - pressing the total opens the breakdown (a sheet on a phone, a centred
//     dialog on a desk) with 실제 / 예정 kept apart; Escape closes it and focus
//     returns to the total
//   - a month change never shows another month's total
//   - a month with no amount reads 0원 and keeps the six 0원 slots
//   - a refused read is a status line: 401 offers signing in again, 403 never
//     does, and the month grid stays standing
//   - a guest's total is computed in this browser and never fetched; planned
//     guest amounts stay out of it; the breakdown says where the records live
//   - no amount is invented: an entry without an amount is not counted, and
//     its editor shows an empty box and keeps (and saves) its category
//   - currencies are never merged: KRW reads 원, any other currency keeps its
//     code and is reported apart
//   - the editor and the breakdown call every category the same thing
//   - a broken guest store never takes the month down; no horizontal overflow
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-expense-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-expense-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4198;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const assetVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'site-asset-version.json'), 'utf8')).version;

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
<link rel="stylesheet" href="/styles.css?v=${assetVersion}">
<link rel="stylesheet" href="/home-chat.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-calendar.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-calendar-expense.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-calendar-weather.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-theme-tokens.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-conversation.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-consumer-design.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-consumer-layout.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-consumer-detail.css?v=${assetVersion}">
</head><body class="chat-home-page site-workspace-open" data-site-theme="light" style="margin:0">
<div class="consumer-workspace" data-workspace="calendar">
  <section class="site-modal site-calendar-modal site-calendar-chat-popup site-calendar-page" role="region">
    <div class="site-modal-content" id="calendar-root"></div>
  </section>
</div>
<pre id="expense-result">pending</pre>
<script type="module">
const out=document.getElementById('expense-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},50000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await sleep(20)}throw new Error('timeout '+label)};
const waitForDomIdle=(node,quietMs=120)=>new Promise(resolve=>{
  let timer;
  const done=()=>{observer.disconnect();resolve()};
  const settle=()=>{clearTimeout(timer);timer=setTimeout(done,quietMs)};
  const observer=new MutationObserver(settle);
  observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true});
  settle();
});
const shown=node=>Boolean(node&&node.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');
const text=node=>(node?.textContent||'').replace(/\\s+/g,' ').trim();

// The fixture answers Core itself so the assertions measure rendering, not the
// network. Only the routes the Calendar touches are served.
function stubFetch({expense, expenseStatus=200, agendaItems=[]}){
  const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
  const calls=[];
  const impl=(url)=>{
    const parsed=new URL(String(url),location.origin);
    calls.push(parsed.pathname+parsed.search);
    if(parsed.pathname==='/v2/life/expense-summary'){
      if(expenseStatus!==200){
        return Promise.resolve(new Response(JSON.stringify({code:'NOPE'}),{status:expenseStatus,headers:{'Content-Type':'application/json'}}));
      }
      const start=parsed.searchParams.get('start');
      const body=typeof expense==='function'?expense(start):expense;
      return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        start_date:start,end_date:parsed.searchParams.get('end'),
        coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',ai_calls:0,provider_api_calls:0,...body});
    }
    if(parsed.pathname==='/v2/life/agenda'){
      return json({view:'AGENDA',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:agendaItems,ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/attention'){
      return json({view:'ATTENTION',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/unscheduled'){
      return json({view:'UNSCHEDULED',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/holidays'){
      return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    }
    return json({items:[]});
  };
  impl.calls=calls;
  return impl;
}

// Spent (PAID) money only in the totals; 28,000원 of 음식 is planned.
const KRW_SUMMARY={currencies:[{currency:'KRW',categories:[
  {expense_category:'FOOD',amount_minor:40500,entry_count:2,planned_amount_minor:28000,planned_entry_count:1},
  {expense_category:'TRAVEL',amount_minor:180000,entry_count:1,planned_amount_minor:0,planned_entry_count:0},
  {expense_category:'LIVING',amount_minor:94000,entry_count:1,planned_amount_minor:0,planned_entry_count:0}],
  total_amount_minor:314500,entry_count:4,planned_amount_minor:28000,planned_entry_count:1}],entries_without_amount:2};

const FORBIDDEN=['쓴 돈','가계부','금액 없는 일정','건 제외'];
const forbiddenIn=value=>FORBIDDEN.filter(word=>String(value||'').includes(word));
// The ledger the owner can see: the desk card, or the phone's bottom line.
const ledger=root=>[...root.querySelectorAll('.c4-ledger,.c4-dock')].find(shown)||null;
const totalControl=root=>ledger(root)?.querySelector('[data-calendar-amount-open]')||null;
const totalText=root=>text(ledger(root)?.querySelector('.c4-lc-num,.c4-dock-v'));
const captionText=root=>text(ledger(root)?.querySelector('.c4-lc-cap,.c4-dock-k'));

// A guest repository the fixture controls directly, with the same surface the
// real localStorage one exposes to the manager. Writes are recorded.
function makeGuestRepo(events){
  const rows=events.map((e,i)=>({id:'guest_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000',
    title:'항목 '+i,local_datetime:null,all_day:true,
    ...e,entry:{amount_minor:null,currency:'KRW',expense_category:null,expense_status:null,memo:null,place:null,merchant:null,...(e.entry||{})}}));
  const writes=[];
  return {list:()=>rows,create(...args){writes.push(['create',...args])},update(...args){writes.push(['update',...args])},remove(){},writes};
}

async function mountCase(manager,{sessionToken,fetchImpl,guestRepository}){
  document.querySelectorAll('.c4-dlg-backdrop,.calendar-editor-backdrop').forEach(node=>node.remove());
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken,timezone:'Asia/Seoul',
    initialView:'month',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    fetchImpl,guestRepository,
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  return root;
}

// Settled = the month is drawn, the expense read went out and nothing is busy.
async function settled(root,fetchImpl,label){
  await wait(()=>root.querySelector('.c4-mo-g'),label+' month');
  if(fetchImpl)await wait(()=>fetchImpl.calls.some(value=>value.startsWith('/v2/life/expense-summary')),label+' expense read');
  await wait(()=>!root.hasAttribute('aria-busy')||root.getAttribute('aria-busy')!=='true',label+' idle');
  await sleep(200);
}

const rgb=value=>(String(value).match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
const lum=c=>{const [r,g,b]=c.map(v=>{const x=v/255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4});
  return 0.2126*r+0.7152*g+0.0722*b};
const contrast=(a,b)=>{const l1=lum(a),l2=lum(b);return Number(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2))};
const paintedBg=node=>{for(let n=node;n;n=n.parentElement){
  const parts=(String(getComputedStyle(n).backgroundColor).match(/[0-9.]+/g)||[]).map(Number);
  if(parts.length>=3&&(parts.length<4||parts[3]>0))return parts.slice(0,3)}
  return document.body.dataset.siteTheme==='dark'?[18,18,18]:[255,255,255]};
const overflowX=root=>Math.max(document.documentElement.scrollWidth-document.documentElement.clientWidth,
  ...[root,root.querySelector('.c4-cols'),root.querySelector('.c4-dock-slot')].filter(Boolean).map(node=>node.scrollWidth-node.clientWidth));

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=${assetVersion}');
  const expense=await import('/site-calendar-expense.js?v=${assetVersion}');
  const desk=innerWidth>900;
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight},desk,
    expectedRows:expense.EXPENSE_CATEGORY_ORDER.map(category=>[category,expense.expenseCategoryLabel(category)]),
    choiceLabels:expense.EXPENSE_CATEGORY_CHOICES.map(([,label])=>label)};

  // --- populated month (signed in) -------------------------------------
  const populatedFetch=stubFetch({expense:KRW_SUMMARY});
  let root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:populatedFetch});
  await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','ready ledger');
  await waitForDomIdle(root);
  let control=totalControl(root);
  result.design=root.dataset.calendarDesign||'';
  result.ledgerKind=ledger(root)?.classList.contains('c4-ledger')?'card':ledger(root)?.classList.contains('c4-dock')?'dock':'none';
  result.visibleLedgers=[...root.querySelectorAll('.c4-ledger,.c4-dock')].filter(shown).length;
  result.controlTag=control?.tagName||'';
  result.controlType=control?.getAttribute('type')||'';
  result.controlHeight=Math.round(control?.getBoundingClientRect().height||0);
  result.caption=captionText(root);
  result.total=totalText(root);
  result.ariaLabel=control?.getAttribute('aria-label')||'';
  result.lineCategoryWords=desk?[]:['음식','여행','쇼핑','기타','미분류','생활비'].filter(word=>text(ledger(root)).includes(word));
  const categoryCells=()=>[...root.querySelectorAll('.c4-ledger .c4-lc-i')];
  result.categoryRows=desk?categoryCells().map(cell=>[cell.dataset.expenseCategory,text(cell.querySelector('.c4-lc-l')),text(cell.querySelector('.c4-lc-a'))]):[];
  result.planned=desk?text(root.querySelector('.c4-ledger .c4-lc-plan')):'';
  const readCategoryStyles=()=>categoryCells().map(cell=>{
    const label=cell.querySelector('.c4-lc-l');
    const dot=cell.querySelector('.c4-dot');
    return {category:cell.dataset.expenseCategory,dot:getComputedStyle(dot).backgroundColor,
      labelContrast:contrast(rgb(getComputedStyle(label).color),paintedBg(cell))};
  });
  const readContrast=()=>{
    const cap=ledger(root).querySelector('.c4-lc-cap,.c4-dock-k');
    const num=ledger(root).querySelector('.c4-lc-num,.c4-dock-v');
    return {caption:contrast(rgb(getComputedStyle(cap).color),paintedBg(cap)),total:contrast(rgb(getComputedStyle(num).color),paintedBg(num))};
  };
  result.categoryStylesLight=desk?readCategoryStyles():[];
  result.contrastLight=readContrast();
  document.body.dataset.siteTheme='dark';
  await sleep(30);
  result.categoryStylesDark=desk?readCategoryStyles():[];
  result.contrastDark=readContrast();
  document.body.dataset.siteTheme='light';
  result.forbidden=forbiddenIn(text(ledger(root)));
  result.overflow=overflowX(root);

  // --- the period follows the view ---------------------------------------
  result.modes=[];
  for(const [label,mode] of [['주','week'],['년','year'],['일정','agenda'],['월','month']]){
    const before=populatedFetch.calls.length;
    root.querySelector('[data-calendar-mode="'+mode+'"]').click();
    await wait(()=>root.dataset.calendarManagerView===mode,label+' view');
    try{await wait(()=>populatedFetch.calls.slice(before).some(value=>value.startsWith('/v2/life/expense-summary')),label+' expense read');}
    catch(error){throw new Error(error.message+' '+JSON.stringify({calls:populatedFetch.calls.slice(before),view:root.dataset.calendarManagerView,ledger:ledger(root)?.dataset.calendarAmountSummary,caption:captionText(root)}));}
    await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready',label+' ledger ready');
    await waitForDomIdle(root);
    result.modes.push({label,caption:captionText(root),
      calls:populatedFetch.calls.slice(before).filter(value=>value.startsWith('/v2/life/expense-summary'))});
  }
  result.firstCall=populatedFetch.calls.find(value=>value.startsWith('/v2/life/expense-summary'))||'';

  // --- the breakdown, on request ------------------------------------------
  control=totalControl(root);
  control.focus();
  control.click();
  await wait(()=>root.querySelector('.c4-ledger-dlg'),'breakdown');
  {
    const dialog=root.querySelector('.c4-ledger-dlg');
    await sleep(30);
    const box=dialog.getBoundingClientRect();
    result.detail={
      presentation:root.querySelector('.c4-ledger-backdrop')?.dataset.editorPresentation||'',
      heading:text(dialog.querySelector('#c4-ledger-heading')),
      total:text(dialog.querySelector('.c4-lsum .c4-lc-num')),
      tabs:[...dialog.querySelectorAll('[data-ledger-tab]')].map(tab=>[tab.dataset.ledgerTab,text(tab.querySelector('.c4-tab2-v'))]),
      rows:[...dialog.querySelectorAll('.c4-lsum .c4-lc-i')].map(cell=>[text(cell.querySelector('.c4-lc-l')),text(cell.querySelector('.c4-lc-a'))]),
      chips:[...dialog.querySelectorAll('[data-ledger-category]')].map(chip=>text(chip)),
      focusInside:dialog.contains(document.activeElement),
      fits:box.right<=innerWidth+1&&box.left>=-1,
      forbidden:forbiddenIn(text(dialog)),
    };
    dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await sleep(30);
    result.detail.closedByEscape=!root.querySelector('.c4-ledger-dlg');
    result.detail.focusBack=document.activeElement===totalControl(root);
  }

  // --- month change must never show another month's total --------------
  const OCT_SUMMARY={currencies:[{currency:'KRW',categories:[
    {expense_category:'FOOD',amount_minor:7000,entry_count:1}],
    total_amount_minor:7000,entry_count:1}],entries_without_amount:0};
  const monthlyFetch=stubFetch({expense:start=>start.startsWith('2026-10')?OCT_SUMMARY:KRW_SUMMARY});
  root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:monthlyFetch});
  await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','ready before month change');
  let staleSeen=false;
  const watchStale=()=>{
    const title=root.querySelector('.calendar-title-button')?.textContent||'';
    if(title.includes('10월')&&totalText(root).includes('314,500'))staleSeen=true;
  };
  const observer=new MutationObserver(watchStale);
  observer.observe(root,{subtree:true,childList:true,characterData:true});
  const nextMonth=[...root.querySelectorAll('.calendar-nav-button')].find(node=>node.getAttribute('aria-label')==='다음 달');
  nextMonth.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  watchStale();
  await wait(()=>totalText(root)==='7,000원','october total');
  observer.disconnect();
  result.staleSeen=staleSeen;
  result.octoberCaption=captionText(root);
  result.octoberAria=totalControl(root)?.getAttribute('aria-label')||'';

  // --- empty month: 0원, and the six fixed slots ---------------------------
  {
    const emptyFetch=stubFetch({expense:{currencies:[],entries_without_amount:3}});
    root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:emptyFetch});
    await settled(root,emptyFetch,'empty');
    await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','empty ready');
    result.emptyTotal=totalText(root);
    result.emptySlots=desk?categoryCells().map(cell=>[cell.dataset.expenseCategory,text(cell.querySelector('.c4-lc-a'))]):[];
    result.emptyPlanned=Boolean(root.querySelector('.c4-ledger .c4-lc-plan'));
    result.emptyForbidden=forbiddenIn(text(ledger(root)));
  }

  // --- Core refuses the read -------------------------------------------
  for(const status of [401,403]){
    root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:stubFetch({expense:null,expenseStatus:status})});
    await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='error','error ledger '+status);
    const line=ledger(root).querySelector('[role="status"]');
    result['error'+status]={
      text:text(line),
      hasStatus:Boolean(line)&&shown(line),
      totalButtonOffered:[...ledger(root).querySelectorAll('[data-calendar-amount-open]')].some(node=>shown(node)&&!node.disabled),
      ariaNamesFailure:desk?/불러오지 못했|다시 로그인/.test(ledger(root).querySelector('[data-calendar-amount-open]')?.getAttribute('aria-label')||''):true,
      monthStillRendered:Boolean(root.querySelector('.c4-mo-g')),
      rootVisible:root.hidden!==true&&root.childElementCount>0,
    };
  }

  // --- guest: totals from this browser, no Core call ---------------------
  //   음식 32,000 + 8,500 = 40,500 · 여행 208,320 · 기타 48,000 · 미분류 5,000
  //   = 301,820원. 음식 20,000 is planned (not in the total), one entry has no
  //   amount, and October's entry is another month.
  const guestFetch=stubFetch({expense:KRW_SUMMARY});
  const guestRepo=makeGuestRepo([
    {local_date:'2026-09-03',entry:{amount_minor:32000,currency:'KRW',expense_category:'FOOD'}},
    {local_date:'2026-09-11',entry:{amount_minor:8500,currency:'KRW',expense_category:'FOOD'}},
    {local_date:'2026-09-14',entry:{amount_minor:208320,currency:'KRW',expense_category:'TRAVEL'}},
    {local_date:'2026-09-20',entry:{amount_minor:48000,currency:'KRW',expense_category:'OTHER'}},
    {local_date:'2026-09-22',entry:{amount_minor:5000,currency:'KRW',expense_category:null}},
    {local_date:'2026-09-24',entry:{amount_minor:20000,currency:'KRW',expense_category:'FOOD',expense_status:'PLANNED'}},
    {local_date:'2026-09-25',entry:{amount_minor:null}},
    {local_date:'2026-10-02',entry:{amount_minor:999000,currency:'KRW',expense_category:'SHOPPING'}},
  ]);
  root=await mountCase(manager,{sessionToken:'',fetchImpl:guestFetch,guestRepository:guestRepo});
  await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','guest ready ledger');
  result.guestAskedCore=guestFetch.calls.some(value=>value.startsWith('/v2/life/expense-summary'));
  result.guestTotal=totalText(root);
  totalControl(root).click();
  await wait(()=>root.querySelector('.c4-ledger-dlg'),'guest breakdown');
  {
    const dialog=root.querySelector('.c4-ledger-dlg');
    result.guestTabs=[...dialog.querySelectorAll('[data-ledger-tab]')].map(tab=>[tab.dataset.ledgerTab,text(tab.querySelector('.c4-tab2-v'))]);
    result.guestRows=[...dialog.querySelectorAll('.c4-lsum .c4-lc-i')].map(cell=>[text(cell.querySelector('.c4-lc-l')),text(cell.querySelector('.c4-lc-a'))]);
    result.guestPaidItems=dialog.querySelectorAll('.c4-led-r').length;
    dialog.querySelector('[data-ledger-tab="planned"]').click();
    await sleep(20);
    result.guestPlannedItems=[...dialog.querySelectorAll('.c4-led-r .c4-led-a')].map(node=>text(node));
    result.guestStorage=text(dialog.querySelector('.c4-lc-local'));
    result.guestForbidden=forbiddenIn(text(dialog));
    // The breakdown and the editor call every category the same thing.
    result.labelParity=[...dialog.querySelectorAll('[data-ledger-category]')].filter(chip=>chip.dataset.ledgerCategory).every(chip=>result.choiceLabels.includes(text(chip)));
    dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>!root.querySelector('.c4-ledger-dlg'),'guest breakdown closed');
  }

  // --- an entry with no amount must not look like a saved 0 --------------
  {
    const blankRepo=makeGuestRepo([{local_date:'2026-09-14',title:'제주 숙소 알아보기',
      entry:{amount_minor:null,currency:'KRW',expense_category:'TRAVEL'}}]);
    root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),guestRepository:blankRepo});
    await settled(root,null,'blank');
    await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','blank ready');
    result.blankTotal=totalText(root);
    root.querySelector('.c4-mc[data-calendar-date-trigger="2026-09-14"]').click();
    const visibleRow=()=>[...root.querySelectorAll('.c4-daycard .c4-dc-ev,.c4-agenda .c4-dc-ev')].find(shown);
    await wait(visibleRow,'event row');
    visibleRow().click();
    await wait(()=>root.querySelector('.c4-detail [data-calendar-detail-edit]'),'detail');
    root.querySelector('.c4-detail [data-calendar-detail-edit]').click();
    await wait(()=>root.querySelector('.c4-editor .calendar-editor-amount'),'editor');
    const editor=root.querySelector('.c4-editor');
    const amountBox=editor.querySelector('.calendar-editor-amount');
    result.blankAmountValue=amountBox.value;
    result.blankAmountPlaceholder=amountBox.placeholder;
    result.blankAmountCategory=editor.querySelector('.calendar-editor-category')?.value||null;
    result.blankAmountChip=text(editor.querySelector('[data-editor-chip="amount"] .c4-opt-v'));
    result.blankStatus=editor.querySelector('.calendar-editor-expense-status [aria-pressed="true"]')?.dataset.expenseStatus??null;
    result.editorLabels=[...editor.querySelectorAll('[data-category]')].map(node=>text(node));
    editor.querySelector('form').requestSubmit();
    await wait(()=>blankRepo.writes.length>0,'blank save');
    const written=JSON.stringify(blankRepo.writes);
    result.blankSavedCategory=written.includes('"expense_category":"TRAVEL"');
    result.blankSavedNoAmount=written.includes('"amount_minor":null');
  }

  // --- two currencies: never merged, KRW without the letters KRW ----------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:makeGuestRepo([
      {local_date:'2026-09-05',entry:{amount_minor:50000,currency:'KRW',expense_category:'FOOD'}},
      {local_date:'2026-09-06',entry:{amount_minor:1200,currency:'USD',expense_category:'SHOPPING'}}])});
  await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','two-currency ledger');
  result.currencyTotal=totalText(root);
  result.currencyLedgerText=desk?text(root.querySelector('.c4-ledger')):'';
  totalControl(root).click();
  await wait(()=>root.querySelector('.c4-ledger-dlg'),'two-currency breakdown');
  result.currencyDialogText=text(root.querySelector('.c4-ledger-dlg .c4-lsum'));
  root.querySelector('.c4-ledger-dlg').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!root.querySelector('.c4-ledger-dlg'),'two-currency breakdown closed');

  // --- guest, empty month: a 0원 total, never a login prompt ----------------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),guestRepository:makeGuestRepo([])});
  await settled(root,null,'guest empty');
  await wait(()=>ledger(root)?.dataset.calendarAmountSummary==='ready','guest empty ready');
  result.guestEmptyTotal=totalText(root);
  result.guestEmptyLogin=text(ledger(root)).includes('로그인')||text(root.querySelector('.c4-mo')).includes('로그인');

  // --- guest, a repository that throws: the Calendar must outlive it ------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:{list(){throw new Error('storage is gone')},create(){},update(){},remove(){}}});
  await sleep(700);
  result.brokenRepoMonthStanding=Boolean(root.querySelector('.c4-mo-g'));
  result.brokenRepoLedgerState=ledger(root)?.dataset.calendarAmountSummary||'absent';

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{ledger:[...(r?.querySelectorAll('.c4-ledger,.c4-dock')||[])].map(n=>n.className+':'+n.dataset.calendarAmountSummary),stage},viewport:{width:innerWidth,height:innerHeight}})}
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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('expense-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},60000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=65000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 130000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.diag || {})}`);
  return v;
}

// The editor's category choices must read the shared list rather than spelling
// the labels again. It drifted once -- "기타 / 생활비" in the editor against
// "생활비" in the bar -- and a static check is what keeps a second copy away.
{
  const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
  if (!manager.includes('EXPENSE_CATEGORY_CHOICES')) {
    throw new Error('the entry editor must build its category choices from EXPENSE_CATEGORY_CHOICES');
  }
  for (const label of ['기타 / 생활비', "'음식'", "'여행'", "'쇼핑'", "'생활비'"]) {
    if (manager.includes(label)) {
      throw new Error(`site-calendar-manager.js must not spell a category label itself (${label}) — it reads them from site-calendar-expense.js`);
    }
  }
  if (/calendarExpenseSummaryNode\s*\(/.test(manager)) {
    throw new Error('the Calendar must not mount the six-slot expense strip; the ledger card owns the categories');
  }
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[360, 780], [390, 844], [768, 1024], [1280, 900]]) {
    const value = run(browser, w, h);
    const label = `${w}x${h}`;
    const fail = message => { throw new Error(`${label}: ${message}`); };
    const desk = value.desk;

    if (value.design !== 'c4') fail(`the workspace Calendar must be the approved design 04, got "${value.design}"`);
    if (value.ledgerKind !== (desk ? 'card' : 'dock') || value.visibleLedgers !== 1) {
      fail(`exactly one ledger must show -- the card on a desk, the bottom line on a phone; got ${value.ledgerKind} x${value.visibleLedgers}`);
    }

    // One total control.
    if (value.controlTag !== 'BUTTON' || value.controlType !== 'button') fail(`the total must be a real button, got ${value.controlTag}/${value.controlType}`);
    if (value.controlHeight < 44) fail(`the total control must keep a 44px+ touch target, got ${value.controlHeight}px`);
    if (value.caption !== '9월 지출') fail(`the total must name its month, got "${value.caption}"`);
    if (value.total !== '314,500원') fail(`the total must be the spent money Core returned (planned excluded), got "${value.total}"`);
    if (!value.ariaLabel.includes('9월') || !value.ariaLabel.includes('314,500원') || !/보기/.test(value.ariaLabel)) {
      fail(`the total's accessible name must say the period, the total and that it opens, got "${value.ariaLabel}"`);
    }
    if (value.lineCategoryWords.length) fail(`the phone line must not spell out categories, got ${value.lineCategoryWords.join(',')}`);
    if (desk) {
      const expected = value.expectedRows.map(([category, name]) => [category, name, {FOOD: '40,500원', TRAVEL: '180,000원', LIVING: '94,000원'}[category] || '0원']);
      if (JSON.stringify(value.categoryRows) !== JSON.stringify(expected)) fail(`the card must show all six categories in the fixed order, got ${JSON.stringify(value.categoryRows)}`);
      if (!value.planned.includes('28,000원') || !value.planned.includes('합계에 넣지 않음')) fail(`planned money must be a separate line that says it is not in the total, got "${value.planned}"`);
      for (const theme of ['Light', 'Dark']) {
        const styles = value['categoryStyles' + theme];
        if (new Set(styles.map(item => item.dot)).size !== styles.length) fail(`${theme} categories must each have their own colour, got ${JSON.stringify(styles)}`);
        if (styles.some(item => item.labelContrast < 4.5)) fail(`${theme} category labels must hold WCAG AA 4.5:1, got ${JSON.stringify(styles)}`);
      }
    }
    for (const theme of ['Light', 'Dark']) {
      const c = value['contrast' + theme];
      if (!(c.caption >= 4.5) || !(c.total >= 4.5)) fail(`${theme} total text must hold WCAG AA 4.5:1, got ${JSON.stringify(c)}`);
    }
    if (value.forbidden.length) fail(`ledger words must not appear, got ${value.forbidden.join(',')}`);
    if (value.overflow > 1) fail(`the ledger must not cause horizontal overflow (${value.overflow}px)`);

    // The period follows the view; the signed-in read asks for planned money.
    if (!value.firstCall.includes('start=2026-09-01') || !value.firstCall.includes('end=2026-09-30') || !value.firstCall.includes('include_planned=true')) {
      fail(`the month read must cover the civil month and ask for planned amounts, got "${value.firstCall}"`);
    }
    const byMode = Object.fromEntries(value.modes.map(mode => [mode.label, mode]));
    for (const [mode, caption, start, end] of [['주', '9월 지출', '2026-09-01', '2026-09-30'], ['년', '2026년 지출', '2026-01-01', '2026-12-31'], ['일정', '9월 지출', '2026-09-01', '2026-09-30'], ['월', '9월 지출', '2026-09-01', '2026-09-30']]) {
      const seen = byMode[mode];
      if (!seen || seen.caption !== caption) fail(`${mode} must show the ${caption} total, got ${JSON.stringify(seen)}`);
      if (!seen.calls.some(call => call.includes(`start=${start}`) && call.includes(`end=${end}`))) fail(`${mode} must read ${start}..${end}, got ${JSON.stringify(seen.calls)}`);
    }

    // The breakdown.
    const detail = value.detail;
    if (detail.presentation !== (desk ? 'CENTER' : 'SHEET')) fail(`the breakdown must open as ${desk ? 'a centred dialog' : 'a sheet'}, got "${detail.presentation}"`);
    if (detail.heading !== '2026년 9월 지출 내역') fail(`the breakdown must name its month, got "${detail.heading}"`);
    if (detail.total !== '314,500원') fail(`the breakdown total must be Core's spent total, got "${detail.total}"`);
    if (JSON.stringify(detail.tabs) !== JSON.stringify([['paid', '314,500원'], ['planned', '28,000원']])) fail(`실제 and 예정 must stay apart in the breakdown, got ${JSON.stringify(detail.tabs)}`);
    if (detail.rows.length !== 6) fail(`the breakdown must keep the six category amounts, got ${JSON.stringify(detail.rows)}`);
    if (detail.chips[0] !== '전체' || detail.chips.length !== 7) fail(`the breakdown filters by 전체 and the six categories, got ${JSON.stringify(detail.chips)}`);
    if (detail.forbidden.length) fail(`ledger words must not appear in the breakdown, got ${detail.forbidden.join(',')}`);
    if (!detail.focusInside) fail('opening the breakdown must move focus into it');
    if (!detail.fits) fail('the breakdown must fit the screen width');
    if (!detail.closedByEscape) fail('Escape must close the breakdown');
    if (!detail.focusBack) fail('closing the breakdown must return focus to the total');

    if (value.staleSeen) fail("the previous month's total must not survive a month change");
    if (value.octoberCaption !== '10월 지출' || !value.octoberAria.includes('10월')) fail(`the total must follow the displayed month, got "${value.octoberCaption}" / "${value.octoberAria}"`);

    if (value.emptyTotal !== '0원') fail(`a month with no recorded amount must read 0원, got "${value.emptyTotal}"`);
    if (desk && JSON.stringify(value.emptySlots) !== JSON.stringify(value.expectedRows.map(([category]) => [category, '0원']))) {
      fail(`a month with no recorded amount must keep the six 0원 slots, got ${JSON.stringify(value.emptySlots)}`);
    }
    if (value.emptyPlanned) fail('a month with no planned money must not show a 예정 line');
    if (value.emptyForbidden.length) fail(`an empty month must not report excluded entries, got ${value.emptyForbidden.join(',')}`);

    for (const status of [401, 403]) {
      const state = value['error' + status];
      if (!state.hasStatus) fail(`a ${status} must be announced as a visible status line`);
      if (state.totalButtonOffered) fail(`a ${status} must not leave a total button to press`);
      if (!state.ariaNamesFailure) fail(`a ${status} must not be named as still calculating`);
      if (!state.monthStillRendered) fail(`a ${status} on the expense read must leave the month grid standing`);
      if (!state.rootVisible) fail(`a ${status} on the expense read must not empty the Calendar root`);
    }
    if (!value.error401.text.includes('다시 로그인')) fail(`a 401 must offer signing in again, got "${value.error401.text}"`);
    if (value.error403.text.includes('로그인') || !value.error403.text.includes('불러오지 못했')) fail(`a 403 must not tell the user to sign in again, got "${value.error403.text}"`);

    if (value.guestAskedCore) fail('guest totals must be computed here, never fetched from Core');
    if (value.guestTotal !== '301,820원') fail(`signed-out total must be 301,820원 (planned, no-amount and October excluded), got ${value.guestTotal}`);
    if (JSON.stringify(value.guestTabs) !== JSON.stringify([['paid', '301,820원'], ['planned', '20,000원']])) fail(`signed-out 실제/예정 are wrong, got ${JSON.stringify(value.guestTabs)}`);
    const guestExpected = value.expectedRows.map(([, name]) => [name, ({'미분류': '5,000원', '음식': '40,500원', '여행': '208,320원', '기타': '48,000원'})[name] || '0원']);
    if (JSON.stringify(value.guestRows) !== JSON.stringify(guestExpected)) fail(`signed-out category amounts are wrong, got ${JSON.stringify(value.guestRows)}`);
    if (value.guestPaidItems !== 5) fail(`signed-out breakdown must list the five spent records, got ${value.guestPaidItems}`);
    if (JSON.stringify(value.guestPlannedItems) !== JSON.stringify(['20,000원'])) fail(`signed-out planned tab must list the planned record, got ${JSON.stringify(value.guestPlannedItems)}`);
    if (value.guestStorage !== '이 기기에 저장한 일정의 금액이에요.') fail(`the signed-out breakdown must say where the records live, got "${value.guestStorage}"`);
    if (value.guestForbidden.length) fail(`ledger words must not appear in the signed-out breakdown, got ${value.guestForbidden.join(',')}`);
    if (!value.labelParity) fail('the breakdown and the editor must call every category the same thing');

    if (value.blankTotal !== '0원') fail(`a month whose only entry has no amount must read 0원, got "${value.blankTotal}"`);
    if (value.blankAmountValue !== '') fail(`an entry with no amount must open with an empty box, got "${value.blankAmountValue}"`);
    if (/^\s*0\s*$/.test(value.blankAmountPlaceholder || '')) fail('the amount box must not show a placeholder 0');
    if (value.blankAmountCategory !== 'TRAVEL') fail(`the saved category must survive, got ${value.blankAmountCategory}`);
    if (value.blankAmountChip !== '여행') fail(`the 지출 연결 row must show the category the record holds, got "${value.blankAmountChip}"`);
    if (value.blankStatus !== '') fail(`an entry with no amount starts on 지출 없음, got ${JSON.stringify(value.blankStatus)}`);
    if (!value.blankSavedCategory || !value.blankSavedNoAmount) fail('saving without touching the amount must keep 여행 and invent no amount');
    if (JSON.stringify([...value.editorLabels].sort()) !== JSON.stringify([...value.choiceLabels].sort())) fail(`the editor must offer the shared six labels, got ${JSON.stringify(value.editorLabels)}`);

    if (value.currencyTotal !== '50,000원' || /\bKRW\b/.test(value.currencyTotal)) fail(`the won total must read 50,000원 and never merge USD, got "${value.currencyTotal}"`);
    if (!/USD/.test(value.currencyDialogText) || /\bKRW\b/.test(value.currencyDialogText)) fail(`the breakdown must report USD apart from the won total, got "${value.currencyDialogText}"`);
    if (desk && !/USD/.test(value.currencyLedgerText)) fail(`the desk card must report USD apart, got "${value.currencyLedgerText}"`);

    if (value.guestEmptyTotal !== '0원') fail(`a signed-out empty month must read 0원, got "${value.guestEmptyTotal}"`);
    if (value.guestEmptyLogin) fail('a signed-out empty month must not read as a login wall');

    if (!value.brokenRepoMonthStanding) fail('a guest repository that throws must leave the month grid standing');
    if (value.brokenRepoLedgerState === 'loading') fail('a guest repository that throws must not leave the total loading forever');
  }
  console.log('validate_calendar_expense_summary_01: PASS (design 04 ledger)');
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) {
    try { fs.unlinkSync(file); } catch {}
  }
}
