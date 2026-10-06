// Locks the Calendar month amount line (LIFE UX 01).
//
// A month's recorded amounts keep one clear total line at the top of Today,
// Week and Month, with the five user-facing categories visible immediately
// beneath it. The detailed
// currency/count view still opens from the total line.
//
// Covered contracts:
//   - the summary sits directly below the toolbar and before the view in
//     Today, Week and Month, so scrolling the schedule does not hide it first
//   - one line: label, total and chevron share a row; a real button with a
//     44px touch target; no category name and no ledger words on the line
//   - a month with no recorded amount draws no line at all (no 0원 ledger)
//   - pressing it opens the breakdown -- a sheet on a phone, a side panel on
//     a desk -- listing only the categories that hold an amount, in the fixed
//     order, with the total; Escape closes it and focus returns to the line
//   - loading, error and guest are distinguishable: loading draws nothing
//     (never another month's total), an error is a status line (401 offers
//     signing in again, 403 never does), a guest's total is computed in this
//     browser and never fetched from Core
//   - no amount is invented: an entry without an amount is not counted, and an
//     editor opened on one shows an empty box, never a placeholder 0, while
//     keeping (and saving) the category it was recorded with
//   - the month window is the calendar month, not the 42-cell grid
//   - currencies are never merged: KRW reads 원 without the letters KRW, any
//     other currency keeps its code
//   - the editor and the breakdown call every category the same thing
//   - a refused read or a broken guest store never takes the month down
//   - legible in Light and Dark; no horizontal overflow at any width
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
<link rel="stylesheet" href="/site-calendar.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-calendar-expense.css?v=${assetVersion}">
<link rel="stylesheet" href="/site-theme-tokens.css?v=20260923-darklogo1">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="expense-result">pending</pre>
<script type="module">
const out=document.getElementById('expense-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},45000);
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

// The fixture answers Core itself so the assertions measure rendering, not the
// network. Only the routes the month view touches are served.
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
    if(parsed.pathname==='/v2/life/holidays'){
      return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    }
    return json({items:[]});
  };
  impl.calls=calls;
  return impl;
}

const KRW_SUMMARY={currencies:[{currency:'KRW',categories:[
  {expense_category:'FOOD',amount_minor:40500,entry_count:2},
  {expense_category:'TRAVEL',amount_minor:180000,entry_count:1},
  {expense_category:'LIVING',amount_minor:94000,entry_count:1}],
  total_amount_minor:314500,entry_count:4}],entries_without_amount:2};

function line(root){return root.querySelector('[data-calendar-amount-summary]')}
const FORBIDDEN=['쓴 돈','지출','가계부','금액 없는 일정','건 제외'];
const forbiddenIn=text=>FORBIDDEN.filter(word=>String(text||'').includes(word));

// A guest repository the fixture controls directly, with the same surface the
// real localStorage one exposes to the manager. Writes are recorded.
function makeGuestRepo(events){
  const rows=events.map((e,i)=>({id:'guest_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000',
    title:'항목 '+i,local_datetime:null,all_day:true,
    entry:{amount_minor:null,currency:'KRW',expense_category:null,memo:null,place:null,merchant:null},
    ...e,entry:{amount_minor:null,currency:'KRW',expense_category:null,memo:null,place:null,merchant:null,...(e.entry||{})}}));
  const writes=[];
  return {list:()=>rows,create(...args){writes.push(['create',...args])},update(...args){writes.push(['update',...args])},remove(){},writes};
}

async function mountCase(manager,{sessionToken,fetchImpl,guestRepository}){
  document.querySelectorAll('.calendar-amount-backdrop,.calendar-editor-backdrop').forEach(node=>node.remove());
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken,timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    fetchImpl,guestRepository,
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  return root;
}

// Settled = the expense read went out and the Calendar is no longer busy.
async function settled(root,fetchImpl,label){
  await wait(()=>root.querySelector('.calendar-month-grid'),label+' month');
  if(fetchImpl)await wait(()=>fetchImpl.calls.some(value=>value.startsWith('/v2/life/expense-summary')),label+' expense read');
  await wait(()=>!root.hasAttribute('aria-busy'),label+' idle');
  await sleep(200);
}

const rgb=value=>(String(value).match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
const lum=c=>{const [r,g,b]=c.map(v=>{const x=v/255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4});
  return 0.2126*r+0.7152*g+0.0722*b};
const contrast=(a,b)=>{const l1=lum(a),l2=lum(b);return Number(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2))};
// The line's own background is transparent; what matters is what paints behind it.
const paintedBg=node=>{for(let n=node;n;n=n.parentElement){
  const parts=(String(getComputedStyle(n).backgroundColor).match(/[0-9.]+/g)||[]).map(Number);
  if(parts.length>=3&&(parts.length<4||parts[3]>0))return parts.slice(0,3)}
  return document.body.dataset.siteTheme==='dark'?[18,18,18]:[255,255,255]};

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=${assetVersion}');
  const expense=await import('/site-calendar-expense.js?v=${assetVersion}');
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight}};

  // --- populated month -------------------------------------------------
  const populatedFetch=stubFetch({expense:KRW_SUMMARY});
  let root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:populatedFetch});
  await wait(()=>line(root)?.dataset.calendarAmountSummary==='ready','ready line');
  // The amount read can settle before the other initial Calendar reads. Wait
  // until their fixture-driven renders are quiet; otherwise a late render can
  // replace the focused amount line while focus return is being measured.
  await waitForDomIdle(root);
  let ready=line(root);

  const layout=root.querySelector('.calendar-month-layout');
  const shell=root.querySelector('.calendar-product-shell');
  const amountSlot=root.querySelector('.calendar-amount-slot');
  const toolbar=root.querySelector('.calendar-toolbar');
  const viewport=root.querySelector('.calendar-viewport');
  result.layoutFirstIsMonth=Boolean(layout?.children[0]?.classList.contains('calendar-month'));
  result.layoutHasNoAutomaticDayPanel=!layout?.querySelector('.calendar-day-panel');
  result.lineInsideTopSlot=Boolean(amountSlot?.contains(ready));
  result.summaryDirectlyBelowToolbar=Boolean(shell && toolbar && amountSlot && toolbar.nextElementSibling===amountSlot);
  result.summaryBeforeViewport=Boolean(amountSlot && viewport && (amountSlot.compareDocumentPosition(viewport)&Node.DOCUMENT_POSITION_FOLLOWING));

  result.summaryModes=[];
  for(const [label,selector,viewSelector] of [
    ['오늘','[data-calendar-mode="day"]','.calendar-day-view'],
    ['주','[data-calendar-mode="week"]','.calendar-week-agenda'],
    ['월','[data-calendar-mode="month"]','.calendar-month-layout'],
  ]){
    const control=[...root.querySelectorAll(selector)].find(node=>node.textContent.trim()===label)||root.querySelector(selector);
    control?.click();
    await wait(()=>root.querySelector(viewSelector),label+' view');
    await wait(()=>line(root)?.dataset.calendarAmountSummary==='ready',label+' top amount');
    const activeLine=line(root);
    result.summaryModes.push({
      label,
      view:Boolean(root.querySelector(viewSelector)),
      inTopSlot:Boolean(root.querySelector('.calendar-amount-slot')?.contains(activeLine)),
      topSlotBeforeView:Boolean(root.querySelector('.calendar-amount-slot')?.compareDocumentPosition(root.querySelector('.calendar-viewport'))&Node.DOCUMENT_POSITION_FOLLOWING),
    });
  }
  ready=line(root);

  result.lineTag=ready.tagName;
  result.lineType=ready.getAttribute('type');
  result.label=ready.querySelector('.calendar-amount-line-label')?.textContent||'';
  result.amount=ready.querySelector('.calendar-amount-line-amount')?.textContent||'';
  result.chevronHidden=ready.querySelector('.calendar-amount-line-chevron')?.getAttribute('aria-hidden');
  result.ariaLabel=ready.getAttribute('aria-label')||'';
  const box=ready.getBoundingClientRect();
  result.lineHeight=Math.round(box.height);
  const centre=node=>{const r=node.getBoundingClientRect();return r.top+r.height/2};
  result.oneRow=Math.abs(centre(ready.querySelector('.calendar-amount-line-label'))-centre(ready.querySelector('.calendar-amount-line-amount')))<3;
  result.lineCategoryWords=['음식','여행','쇼핑','생활비','기타','미분류'].filter(word=>ready.textContent.includes(word));
  const categoryList=root.querySelector('.calendar-amount-categories');
  result.categoryRows=[...(categoryList?.querySelectorAll('.calendar-amount-category')||[])].map(row=>[
    row.dataset.expenseCategory,
    row.querySelector('dt')?.textContent||'',
    row.querySelector('dd')?.textContent||'',
  ]);
  result.categoryColumns=categoryList ? getComputedStyle(categoryList).gridTemplateColumns.split(/\\s+/).filter(Boolean).length : 0;
  const readCategoryStyles=()=>[...(categoryList?.querySelectorAll('.calendar-amount-category')||[])].map(row=>{
    const itemStyle=getComputedStyle(row);
    const label=row.querySelector('dt');
    return {
      category:row.dataset.expenseCategory,
      border:[itemStyle.borderTopWidth,itemStyle.borderRightWidth,itemStyle.borderBottomWidth,itemStyle.borderLeftWidth],
      background:itemStyle.backgroundColor,
      labelColor:getComputedStyle(label).color,
      labelContrast:contrast(rgb(getComputedStyle(label).color),paintedBg(row)),
    };
  });
  result.categoryStylesLight=readCategoryStyles();
  result.forbidden=forbiddenIn(root.textContent);
  result.aboveTheFold=box.bottom<=innerHeight;
  result.barBottom=Math.round(box.bottom);
  result.expenseCalls=populatedFetch.calls.filter(value=>value.startsWith('/v2/life/expense-summary'));
  result.noHorizontalOverflow=document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;

  // Legibility in both themes.
  const readContrast=()=>({
    label:contrast(rgb(getComputedStyle(ready.querySelector('.calendar-amount-line-label')).color),paintedBg(ready)),
    amount:contrast(rgb(getComputedStyle(ready.querySelector('.calendar-amount-line-amount')).color),paintedBg(ready)),
  });
  result.contrastLight=readContrast();
  document.body.dataset.siteTheme='dark';
  result.contrastDark=readContrast();
  result.categoryStylesDark=readCategoryStyles();
  delete document.body.dataset.siteTheme;

  // --- the breakdown, on request ------------------------------------------
  ready.click();
  await wait(()=>root.querySelector('.calendar-amount-dialog'),'amount detail');
  const dialog=root.querySelector('.calendar-amount-dialog');
  await sleep(30);
  result.detail={
    presentation:root.querySelector('.calendar-amount-backdrop')?.dataset.editorPresentation||'',
    heading:dialog.querySelector('#calendar-amount-heading')?.textContent||'',
    total:dialog.querySelector('.calendar-amount-detail-total strong')?.textContent||'',
    rows:[...dialog.querySelectorAll('.calendar-amount-detail-row')].map(row=>[row.dataset.expenseCategory,row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']),
    scope:dialog.querySelector('.calendar-amount-detail-scope')?.textContent||'',
    focusInside:dialog.contains(document.activeElement),
    fits:dialog.getBoundingClientRect().right<=innerWidth+1&&dialog.getBoundingClientRect().left>=-1,
    forbidden:forbiddenIn(dialog.textContent),
  };
  dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await sleep(20);
  result.detail.closedByEscape=!root.querySelector('.calendar-amount-dialog');
  result.detail.focusBack=document.activeElement===line(root);

  // --- month change must never show another month's total --------------
  const OCT_SUMMARY={currencies:[{currency:'KRW',categories:[
    {expense_category:'FOOD',amount_minor:7000,entry_count:1}],
    total_amount_minor:7000,entry_count:1}],entries_without_amount:0};
  const monthlyFetch=stubFetch({expense:start=>start.startsWith('2026-10')?OCT_SUMMARY:KRW_SUMMARY});
  root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:monthlyFetch});
  await wait(()=>line(root)?.dataset.calendarAmountSummary==='ready','ready before month change');
  let staleSeen=false;
  const watchStale=()=>{
    const title=root.querySelector('.calendar-title-button')?.textContent||'';
    if(title.includes('10월')&&(line(root)?.textContent||'').includes('314,500'))staleSeen=true;
  };
  const observer=new MutationObserver(watchStale);
  observer.observe(root,{subtree:true,childList:true,characterData:true});
  const nextMonth=[...root.querySelectorAll('.calendar-nav-button')].find(node=>node.getAttribute('aria-label')==='다음 달');
  nextMonth.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  watchStale();
  await wait(()=>(line(root)?.textContent||'').includes('7,000원'),'october total');
  observer.disconnect();
  result.staleSeen=staleSeen;
  result.octoberLabel=line(root).querySelector('.calendar-amount-line-label')?.textContent||'';
  result.octoberAria=line(root).getAttribute('aria-label')||'';

  // --- empty month: no line at all ----------------------------------------
  {
    const emptyFetch=stubFetch({expense:{currencies:[],entries_without_amount:3}});
    root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:emptyFetch});
    await settled(root,emptyFetch,'empty');
    result.emptyLine=line(root)?.dataset.calendarAmountSummary||'absent';
    result.emptyZero=(root.querySelector('.calendar-month')?.textContent||'').includes('0원');
    result.emptyForbidden=forbiddenIn(root.textContent);
  }

  // --- Core refuses the read (the 403 that caused the outage) ----------
  for(const status of [401,403]){
    root=await mountCase(manager,{sessionToken:'tok_expense_fixture',
      fetchImpl:stubFetch({expense:null,expenseStatus:status})});
    await wait(()=>line(root)?.dataset.calendarAmountSummary==='error','error line '+status);
    const failed=line(root);
    result['error'+status]={
      text:failed.textContent||'',
      role:failed.getAttribute('role'),
      // The refusal must not have taken the Calendar with it.
      monthStillRendered:Boolean(root.querySelector('.calendar-month-grid')),
      rootVisible:root.hidden!==true&&root.childElementCount>0,
    };
  }

  // --- guest: totals from this browser, no Core call ---------------------
  const guestFetch=stubFetch({expense:KRW_SUMMARY});
  const guestRepo=makeGuestRepo([
    {local_date:'2026-09-03',entry:{amount_minor:32000,currency:'KRW',expense_category:'FOOD'}},
    {local_date:'2026-09-11',entry:{amount_minor:8500,currency:'KRW',expense_category:'FOOD'}},
    {local_date:'2026-09-14',entry:{amount_minor:208320,currency:'KRW',expense_category:'TRAVEL'}},
    {local_date:'2026-09-20',entry:{amount_minor:48000,currency:'KRW',expense_category:'OTHER'}},
    {local_date:'2026-09-22',entry:{amount_minor:5000,currency:'KRW',expense_category:null}},
    {local_date:'2026-09-25',entry:{amount_minor:null}},
    // Another month: it must not land in September's total.
    {local_date:'2026-10-02',entry:{amount_minor:999000,currency:'KRW',expense_category:'SHOPPING'}},
  ]);
  root=await mountCase(manager,{sessionToken:'',fetchImpl:guestFetch,guestRepository:guestRepo});
  await wait(()=>line(root)?.dataset.calendarAmountSummary==='ready','guest ready line');
  result.guestAskedCore=guestFetch.calls.length>0;
  result.guestAmount=line(root).querySelector('.calendar-amount-line-amount')?.textContent||'';
  line(root).click();
  await wait(()=>root.querySelector('.calendar-amount-dialog'),'guest detail');
  {
    const guestDialog=root.querySelector('.calendar-amount-dialog');
    result.guestRows=[...guestDialog.querySelectorAll('.calendar-amount-detail-row')].map(row=>[row.dataset.expenseCategory,row.querySelector('dd')?.textContent||'']);
    result.guestTotal=guestDialog.querySelector('.calendar-amount-detail-total strong')?.textContent||'';
    result.guestStorage=guestDialog.querySelector('.calendar-amount-detail-storage')?.textContent||'';
    result.guestForbidden=forbiddenIn(guestDialog.textContent);
    // The breakdown and the editor call every category the same thing.
    const choiceLabels=expense.EXPENSE_CATEGORY_CHOICES.map(([,text])=>text);
    result.labelParity=[...guestDialog.querySelectorAll('.calendar-amount-detail-row dt')].every(node=>choiceLabels.includes(node.textContent));
    guestDialog.querySelector('.calendar-amount-done').click();
  }

  // --- an entry with no amount must not look like a saved 0 --------------
  // 대표 read a blank 여행 entry as "0원 저장됨" because the box carried a grey
  // placeholder 0. An entry without an amount is not zero spent, and its 여행
  // must survive an edit that never touches the amount.
  {
    const blankRepo=makeGuestRepo([{local_date:'2026-09-14',title:'제주 숙소 알아보기',
      entry:{amount_minor:null,currency:'KRW',expense_category:'TRAVEL'}}]);
    root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),guestRepository:blankRepo});
    await settled(root,null,'blank');
    result.blankLine=line(root)?.dataset.calendarAmountSummary||'absent';
    root.querySelector('[data-calendar-date-trigger="2026-09-14"]').click();
    await wait(()=>root.querySelector('.calendar-day-panel [data-calendar-event-id]'),'event row');
    root.querySelector('.calendar-day-panel [data-calendar-event-id]').click();
    await wait(()=>document.querySelector('.calendar-editor-amount'),'editor');
    const editor=document.querySelector('.calendar-editor-dialog');
    const amountBox=editor.querySelector('.calendar-editor-amount');
    result.blankAmountValue=amountBox.value;
    result.blankAmountPlaceholder=amountBox.placeholder;
    result.blankAmountCategory=editor.querySelector('.calendar-editor-category')?.value||null;
    result.blankAmountChip=editor.querySelector('[data-editor-chip="amount"]')?.textContent||'';
    result.editorLabels=[...editor.querySelectorAll('[data-category]')].map(node=>node.textContent);
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
  await wait(()=>line(root)?.dataset.calendarAmountSummary==='ready','two-currency line');
  result.currencyLine=line(root).querySelector('.calendar-amount-line-amount')?.textContent||'';
  line(root).click();
  await wait(()=>root.querySelector('.calendar-amount-dialog'),'two-currency detail');
  result.currencyTotals=[...root.querySelectorAll('.calendar-amount-detail-currency')].map(group=>({
    currency:group.dataset.currency,
    label:group.querySelector('.calendar-amount-detail-total span')?.textContent||'',
    amount:group.querySelector('.calendar-amount-detail-total strong')?.textContent||'',
  }));
  root.querySelector('.calendar-amount-done').click();

  // --- guest, empty month: no line, never a login prompt ------------------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),guestRepository:makeGuestRepo([])});
  await settled(root,null,'guest empty');
  result.guestEmptyLine=line(root)?.dataset.calendarAmountSummary||'absent';
  result.guestEmptyLogin=(root.querySelector('.calendar-month')?.textContent||'').includes('로그인');

  // --- guest, a repository that throws: the Calendar must outlive it ------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:{list(){throw new Error('storage is gone')},create(){},update(){},remove(){}}});
  await sleep(600);
  result.brokenRepoMonthStanding=Boolean(root.querySelector('.calendar-month'));
  result.brokenRepoLineState=line(root)?.dataset.calendarAmountSummary||'absent';

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{line:r?.querySelector('[data-calendar-amount-summary]')?.dataset.calendarAmountSummary||null,status:r?.querySelector('.calendar-status')?.textContent||''},viewport:{width:innerWidth,height:innerHeight}})}
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
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=60000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.diag||{})}`);
  return v;
}

// The editor's category choices must read the shared list rather than spelling
// the labels again. It drifted once -- "기타 / 생활비" in the editor against
// "생활비" in the bar -- and a static check is what keeps a second copy away.
{
  const manager = fs.readFileSync('site-calendar-manager.js', 'utf8');
  if (!manager.includes('EXPENSE_CATEGORY_CHOICES')) {
    throw new Error('the entry editor must build its category choices from EXPENSE_CATEGORY_CHOICES');
  }
  for (const label of ['기타 / 생활비', "'음식'", "'여행'", "'쇼핑'", "'생활비'"]) {
    if (manager.includes(label)) {
      throw new Error(`site-calendar-manager.js must not spell a category label itself (${label}) — it reads them from site-calendar-expense.js`);
    }
  }
  // One line, not the six-slot strip.
  if (/calendarExpenseSummaryNode\s*\(/.test(manager)) {
    throw new Error('the Calendar must not mount the six-slot expense strip; the month shows one amount line');
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

    if (!value.layoutFirstIsMonth) fail('month layout child 0 must stay the month grid');
    if (!value.layoutHasNoAutomaticDayPanel) fail('Month must not mount a selected-day surface before a date press');
    if (!value.lineInsideTopSlot || !value.summaryDirectlyBelowToolbar || !value.summaryBeforeViewport) {
      fail('the amount summary must sit directly below the toolbar and before the calendar viewport');
    }
    if (value.summaryModes.length!==3 || value.summaryModes.some(mode=>!mode.view||!mode.inTopSlot||!mode.topSlotBeforeView)) {
      fail(`Today, Week and Month must all keep the amount summary above their content, got ${JSON.stringify(value.summaryModes)}`);
    }

    // One quiet line.
    if (value.lineTag !== 'BUTTON' || value.lineType !== 'button') fail(`the amount line must be a real button, got ${value.lineTag}/${value.lineType}`);
    if (value.label !== '9월 입력 금액 합계') fail(`the line must read "9월 입력 금액 합계", got "${value.label}"`);
    if (value.amount !== '314,500원') fail(`the line must carry the total Core returned, got "${value.amount}"`);
    if (value.chevronHidden !== 'true') fail('the chevron is decoration and must be hidden from assistive technology');
    if (!value.ariaLabel.includes('9월 입력 금액 합계') || !value.ariaLabel.includes('314,500원') || !value.ariaLabel.includes('자세히 보기')) {
      fail(`the line's accessible name must say what it is, the total and that it opens, got "${value.ariaLabel}"`);
    }
    if (!value.oneRow) fail('label and total must share one row');
    if (value.lineHeight < 44 || value.lineHeight > 64) fail(`the line must be one 44px+ touch row, got ${value.lineHeight}px`);
    if (value.lineCategoryWords.length) fail(`the line must not spell out categories, got ${value.lineCategoryWords.join(',')}`);
    if (JSON.stringify(value.categoryRows) !== JSON.stringify([
      ['FOOD', '음식', '40,500원'],
      ['TRAVEL', '여행', '180,000원'],
      ['SHOPPING', '쇼핑', '0원'],
      ['LIVING', '생활비', '94,000원'],
      ['OTHER', '기타', '0원'],
    ])) fail(`the month must show the five category amounts beneath the total, got ${JSON.stringify(value.categoryRows)}`);
    if (value.viewport.width <= 520 && value.categoryColumns !== 2) fail(`phone categories must use two columns, got ${value.categoryColumns}`);
    for (const theme of ['Light', 'Dark']) {
      const styles=value['categoryStyles'+theme];
      if (styles.some(item=>item.border.some(width=>width!=='0px'))) fail(`${theme} category labels must not have box borders, got ${JSON.stringify(styles)}`);
      if (styles.some(item=>item.background!=='rgba(0, 0, 0, 0)')) fail(`${theme} category labels must have no box background, got ${JSON.stringify(styles)}`);
      if (new Set(styles.map(item=>item.labelColor)).size!==styles.length) fail(`${theme} category titles must each have a distinct colour, got ${JSON.stringify(styles)}`);
      if (styles.some(item=>item.labelContrast<4.5)) fail(`${theme} category title colours must hold WCAG AA 4.5:1, got ${JSON.stringify(styles)}`);
    }
    if (value.forbidden.length) fail(`ledger words must not appear on the month, got ${value.forbidden.join(',')}`);
    if (!value.aboveTheFold) fail(`the amount line must be visible without scrolling — line bottom ${value.barBottom}px vs viewport ${value.viewport.height}px`);
    if (!value.noHorizontalOverflow) fail('the amount line must not cause horizontal overflow');
    for (const theme of ['Light', 'Dark']) {
      const c = value['contrast' + theme];
      if (!(c.label >= 4.5) || !(c.amount >= 4.5)) fail(`${theme} line text must hold WCAG AA 4.5:1, got ${JSON.stringify(c)}`);
    }

    // The calendar month, not the 42-cell grid window.
    if (value.expenseCalls.length !== 1) fail(`expected one expense read, got ${value.expenseCalls.length}`);
    if (!value.expenseCalls[0].includes('start=2026-09-01') || !value.expenseCalls[0].includes('end=2026-09-30')) {
      fail(`expense window must be the calendar month, got ${value.expenseCalls[0]}`);
    }

    // The breakdown.
    const detail = value.detail;
    const wantPresentation = value.viewport.width <= 900 ? 'SHEET' : 'SIDE';
    if (detail.presentation !== wantPresentation) fail(`the breakdown must open as ${wantPresentation}, got "${detail.presentation}"`);
    if (detail.heading !== '2026년 9월 입력 금액') fail(`the breakdown must name its month, got "${detail.heading}"`);
    if (detail.total !== '314,500원') fail(`the breakdown total must be Core's, got "${detail.total}"`);
    if (JSON.stringify(detail.rows) !== JSON.stringify([['FOOD', '음식', '40,500원 2건'], ['TRAVEL', '여행', '180,000원 1건'], ['LIVING', '생활비', '94,000원 1건']])) {
      fail(`the breakdown must list only the recorded categories in fixed order, got ${JSON.stringify(detail.rows)}`);
    }
    if (detail.scope !== '캘린더 기록에 입력한 금액을 더한 값이에요.') fail(`the breakdown must say what the number is, got "${detail.scope}"`);
    if (detail.forbidden.length) fail(`ledger words must not appear in the breakdown, got ${detail.forbidden.join(',')}`);
    if (!detail.focusInside) fail('opening the breakdown must move focus into it');
    if (!detail.fits) fail('the breakdown must fit the screen width');
    if (!detail.closedByEscape) fail('Escape must close the breakdown');
    if (!detail.focusBack) fail('closing the breakdown must return focus to the amount line');

    if (value.staleSeen) fail("the previous month's total must not survive a month change");
    if (value.octoberLabel !== '10월 입력 금액 합계' || !value.octoberAria.includes('10월')) {
      fail(`the line must follow the displayed month, got "${value.octoberLabel}" / "${value.octoberAria}"`);
    }

    if (value.emptyLine !== 'absent') fail(`a month with no recorded amount must draw no line, got "${value.emptyLine}"`);
    if (value.emptyZero) fail('a month with no recorded amount must not show a 0원 ledger');
    if (value.emptyForbidden.length) fail(`an empty month must not report excluded entries, got ${value.emptyForbidden.join(',')}`);

    for (const status of [401, 403]) {
      const state = value['error' + status];
      if (state.role !== 'status') fail(`a ${status} must be announced as a status line`);
      // The regression this locks: a refused auxiliary read used to tear the
      // Calendar down and drop the user back on Home.
      if (!state.monthStillRendered) fail(`a ${status} on the expense read must leave the month grid standing`);
      if (!state.rootVisible) fail(`a ${status} on the expense read must not empty the Calendar root`);
    }
    // 401 means the session really expired; 403 means the server refused the
    // route, which signing in again does not fix.
    if (!value.error401.text.includes('다시 로그인')) fail(`a 401 must offer signing in again, got "${value.error401.text}"`);
    if (value.error403.text.includes('로그인') || !value.error403.text.includes('불러오지 못했')) {
      fail(`a 403 must not tell the user to sign in again, got "${value.error403.text}"`);
    }

    // The arithmetic, on entries this browser holds.
    //   음식 32,000 + 8,500 = 40,500 · 여행 208,320 · 기타 48,000
    //   미분류 5,000 (an amount with no category) · 금액 없음 1건 · 10월 것은 제외
    if (value.guestAskedCore) fail('guest totals must be computed here, never fetched from Core');
    if (value.guestAmount !== '301,820원') fail(`signed-out total must be 301,820원 (October's entry excluded, no amount never estimated), got ${value.guestAmount}`);
    if (JSON.stringify(value.guestRows) !== JSON.stringify([['FOOD', '40,500원 2건'], ['TRAVEL', '208,320원 1건'], ['OTHER', '48,000원 1건'], ['UNCLASSIFIED', '5,000원 1건']])) {
      fail(`signed-out breakdown is wrong, got ${JSON.stringify(value.guestRows)}`);
    }
    if (value.guestTotal !== '301,820원') fail(`signed-out breakdown total must be 301,820원, got ${value.guestTotal}`);
    if (value.guestStorage !== '이 기기에 저장된 기록 기준이에요.') fail(`the signed-out breakdown must say where the records live, got "${value.guestStorage}"`);
    if (value.guestForbidden.length) fail(`ledger words must not appear in the signed-out breakdown, got ${value.guestForbidden.join(',')}`);
    if (!value.labelParity) fail('the breakdown and the editor must call every category the same thing');

    // An entry with no amount must not wear a 0 that looks saved.
    if (value.blankLine !== 'absent') fail(`a month whose only entry has no amount must draw no line, got "${value.blankLine}"`);
    if (value.blankAmountValue !== '') fail(`an entry with no amount must open with an empty box, got "${value.blankAmountValue}"`);
    if (/^\s*0\s*$/.test(value.blankAmountPlaceholder || '')) fail('the amount box must not show a placeholder 0');
    if (value.blankAmountCategory !== 'TRAVEL') fail(`the saved category must survive, got ${value.blankAmountCategory}`);
    if (value.blankAmountChip !== '여행') fail(`the amount chip must show the category the record holds, got "${value.blankAmountChip}"`);
    if (!value.blankSavedCategory || !value.blankSavedNoAmount) fail('saving without touching the amount must keep 여행 and invent no amount');
    const choiceLabels = ['음식', '여행', '쇼핑', '생활비', '기타', '미분류'];
    if (JSON.stringify([...value.editorLabels].sort()) !== JSON.stringify([...choiceLabels].sort())) {
      fail(`the editor must offer the shared six labels, got ${JSON.stringify(value.editorLabels)}`);
    }

    // Every total names its currency: KRW uses 원, others keep their code.
    if (/\bKRW\b/.test(value.currencyLine) || !value.currencyLine.includes('50,000원') || !value.currencyLine.includes('USD')) {
      fail(`two currencies must stay apart on the line, got "${value.currencyLine}"`);
    }
    if (JSON.stringify(value.currencyTotals) !== JSON.stringify([
      {currency: 'KRW', label: '합계', amount: '50,000원'},
      {currency: 'USD', label: '합계 (USD)', amount: '1,200 USD'},
    ])) fail(`each currency must keep its own total, got ${JSON.stringify(value.currencyTotals)}`);

    if (value.guestEmptyLine !== 'absent') fail(`a signed-out empty month must draw no line, got "${value.guestEmptyLine}"`);
    if (value.guestEmptyLogin) fail('a signed-out empty month must not read as a login wall');

    // The Calendar went down over this bar once. It must not again.
    if (!value.brokenRepoMonthStanding) fail('a guest repository that throws must leave the month grid standing');
    if (value.brokenRepoLineState === 'loading') fail('a guest repository that throws must not leave the amount line loading forever');
  }
  console.log('validate_calendar_expense_summary_01: PASS');
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) {
    try { fs.unlinkSync(file); } catch {}
  }
}
