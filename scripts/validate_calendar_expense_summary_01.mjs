// Locks the Calendar expense summary strip.
//
// Covered contracts:
//   - the strip renders under the month grid, as a sibling of the month layout
//     (the layout's first two children stay the month and the day surface)
//   - category rows carry Korean labels and the amounts Core returned
//   - the 합계 figure, with its currency mark, is the bottom-right of the strip
//   - each category name keeps its own fixed, legible colour in Light and Dark,
//     and the amounts stay neutral
//   - a month with no recorded amount still shows the strip, reading
//     "이번 달 기록 없음" — never a vanished table and never a stuck loader
//   - loading, empty, error and guest are four distinguishable states
//   - no amount is invented: entries without an amount are reported separately
//   - the month window is the calendar month, not the 42-cell grid
//   - no horizontal overflow at mobile and desktop widths
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
<link rel="stylesheet" href="/site-calendar.css?v=20260924-licensebadge1">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
<link rel="stylesheet" href="/site-theme-tokens.css?v=20260923-darklogo1">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="expense-result">pending</pre>
<script type="module">
const out=document.getElementById('expense-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};

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

function strip(root){return root.querySelector('.calendar-expense-summary')}

// A guest repository the fixture controls directly, with the same surface the
// real localStorage one exposes to the manager.
function makeGuestRepo(events){
  const rows=events.map((e,i)=>({id:'guest_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000',
    title:'항목 '+i,local_datetime:null,all_day:true,
    entry:{amount_minor:null,currency:'KRW',expense_category:null,memo:null,place:null,merchant:null},
    ...e,entry:{amount_minor:null,currency:'KRW',expense_category:null,memo:null,place:null,merchant:null,...(e.entry||{})}}));
  return {list:()=>rows,create(){},update(){},remove(){}};
}

async function mountCase(manager,{sessionToken,fetchImpl,guestRepository}){
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

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=20260924-licensebadge1');
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight}};

  // --- populated month -------------------------------------------------
  const populatedFetch=stubFetch({expense:KRW_SUMMARY});
  let root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:populatedFetch});
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','ready strip');
  const ready=strip(root);

  // The strip must not be inside the month layout: its first two children are a
  // runtime contract for the month grid and the selected-day surface.
  const layout=root.querySelector('.calendar-month-layout');
  result.stripOutsideLayout=Boolean(layout)&&!layout.contains(ready);
  result.layoutFirstIsMonth=Boolean(layout?.children[0]?.classList.contains('calendar-month'));
  result.layoutSecondIsDayPanel=Boolean(layout?.children[1]?.classList.contains('calendar-day-panel'));
  result.stripFollowsMonth=layout?.compareDocumentPosition(ready)===Node.DOCUMENT_POSITION_FOLLOWING;

  const rows=[...ready.querySelectorAll('.calendar-expense-item')].map(node=>({
    category:node.dataset.expenseCategory,
    label:node.querySelector('dt')?.textContent||'',
    amount:node.querySelector('dd')?.textContent||'',
  }));
  result.rows=rows;

  const totalRow=ready.querySelector('[data-expense-total]');
  const totalAmount=totalRow?.querySelector('.calendar-expense-total-amount');
  result.totalLabel=totalRow?.querySelector('.calendar-expense-total-label')?.textContent||'';
  result.totalText=totalAmount?.textContent||'';
  result.coverageNote=ready.querySelector('.calendar-expense-coverage')?.textContent||'';

  // One line: the bar's height must stay close to a single row of text.
  const line=ready.querySelector('.calendar-expense-line');
  const lineBox=line.getBoundingClientRect();
  const itemBox=ready.querySelector('.calendar-expense-item').getBoundingClientRect();
  result.lineHeight=Math.round(lineBox.height);
  result.itemHeight=Math.round(itemBox.height);
  result.lineCount=ready.querySelectorAll('.calendar-expense-line').length;
  // Every item shares the line's vertical band — nothing wrapped to a new row.
  result.itemsOnOneRow=[...ready.querySelectorAll('.calendar-expense-item')]
    .every(node=>Math.abs(node.getBoundingClientRect().top-itemBox.top)<2);
  // The total is outside the scrolling list, so it cannot scroll away.
  result.totalOutsideScroller=!ready.querySelector('.calendar-expense-items').contains(totalRow);
  // Where the bar sits relative to the viewport, before any scrolling.
  const barBox=ready.getBoundingClientRect();
  result.barBottom=Math.round(barBox.bottom);
  result.viewportHeight=Math.round(innerHeight);
  result.aboveTheFold=barBox.bottom<=innerHeight;

  // The total holds the right edge of the bar, past every category.
  const stripBox=ready.getBoundingClientRect();
  const totalBox=totalAmount.getBoundingClientRect();
  // Past the whole item list, not past a single item: on a narrow screen the
  // later categories are scrolled out of view to the right.
  const itemsBox=ready.querySelector('.calendar-expense-items').getBoundingClientRect();
  result.totalAfterItems=totalBox.left>=itemsBox.right-1;
  result.itemsScrollable=ready.querySelector('.calendar-expense-items').scrollWidth
    > ready.querySelector('.calendar-expense-items').clientWidth;
  result.totalRightAligned=(stripBox.right-totalBox.right)<=Math.max(24,stripBox.width*0.12);
  result.totalInsideBar=totalBox.bottom<=stripBox.bottom+1;

  // The window Core was asked for is the calendar month, not the grid range.
  result.expenseCalls=populatedFetch.calls.filter(value=>value.startsWith('/v2/life/expense-summary'));

  result.noHorizontalOverflow=document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;

  // --- month change must never show another month's total --------------
  const OCT_SUMMARY={currencies:[{currency:'KRW',categories:[
    {expense_category:'FOOD',amount_minor:7000,entry_count:1}],
    total_amount_minor:7000,entry_count:1}],entries_without_amount:0};
  const monthlyFetch=stubFetch({expense:start=>start.startsWith('2026-10')?OCT_SUMMARY:KRW_SUMMARY});
  root=await mountCase(manager,{sessionToken:'tok_expense_fixture',fetchImpl:monthlyFetch});
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','ready before month change');
  const nextMonth=[...root.querySelectorAll('.calendar-nav-button')].find(node=>node.getAttribute('aria-label')==='다음 달');
  nextMonth.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  // Sampled synchronously: the heading has already moved to October, so the
  // September total must be gone by this same frame.
  const switching=strip(root);
  result.switchHeading=switching?.getAttribute('aria-label')||'';
  result.switchState=switching?.dataset.calendarExpenseSummary||'';
  result.switchShowsOldTotal=(switching?.textContent||'').includes('314,500');
  await wait(()=>{
    const node=strip(root);
    return node?.dataset.calendarExpenseSummary==='ready'
      && (node.textContent||'').includes('7,000원');
  },'october total');
  const october=strip(root);
  result.octoberHeading=october.getAttribute('aria-label')||'';
  result.octoberTotal=october.querySelector('.calendar-expense-total-amount')?.textContent||'';

  // --- empty month -----------------------------------------------------
  root=await mountCase(manager,{sessionToken:'tok_expense_fixture',
    fetchImpl:stubFetch({expense:{currencies:[],entries_without_amount:0}})});
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','ready empty strip');
  const empty=strip(root);
  result.emptyPresent=Boolean(empty);
  result.emptyText=empty.querySelector('.calendar-expense-coverage')?.textContent||'';
  result.emptySlots=[...empty.querySelectorAll('.calendar-expense-item dd')].map(n=>n.textContent);
  result.emptyTotal=empty.querySelector('.calendar-expense-total-amount')?.textContent||'';

  // --- Core refuses the read (the 403 that caused the outage) ----------
  for(const status of [401,403]){
    root=await mountCase(manager,{sessionToken:'tok_expense_fixture',
      fetchImpl:stubFetch({expense:null,expenseStatus:status})});
    await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='error','error strip '+status);
    const failed=strip(root);
    result['error'+status]={
      present:Boolean(failed),
      text:failed.querySelector('.calendar-expense-notice')?.textContent||'',
      // The refusal must not have taken the Calendar with it.
      monthStillRendered:Boolean(root.querySelector('.calendar-month-grid')),
      rootVisible:root.hidden!==true&&root.childElementCount>0,
    };
  }
  // The editor's dropdown and the bar must call every category the same thing.
  {
    const expense=await import('/site-calendar-expense.js?v=20260923-daysheet3');
    const barLabels=[...ready.querySelectorAll('.calendar-expense-item dt')].map(n=>n.textContent);
    const choiceLabels=expense.EXPENSE_CATEGORY_CHOICES.map(([,text])=>text);
    result.labelParity={
      bar:barLabels,
      editor:choiceLabels,
      // The same six words in both places. The dropdown leads with 미분류 as
      // its empty "not chosen" option; the bar keeps 미분류 last. Order differs
      // on purpose, the vocabulary must not.
      matches:choiceLabels.length===barLabels.length
        && choiceLabels[0]==='미분류'
        && barLabels[barLabels.length-1]==='미분류'
        && barLabels.every(text=>choiceLabels.includes(text))
        && choiceLabels.every(text=>barLabels.includes(text)),
    };
  }

  result.errorPresent=result.error403.present;
  result.errorText=result.error403.text;

  // --- guest: totals from this browser, no Core call ---------------------
  // A signed-out owner already records amounts. The bar must add them up here
  // and look exactly like the signed-in bar — not a lesser version of it.
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
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','guest ready strip');
  const guest=strip(root);
  result.guestPresent=Boolean(guest);
  result.guestAskedCore=guestFetch.calls.length===0;
  result.guestRows=[...guest.querySelectorAll('.calendar-expense-item')].map(n=>({
    category:n.dataset.expenseCategory,label:n.querySelector('dt')?.textContent||'',amount:n.querySelector('dd')?.textContent||''}));
  result.guestTotal=guest.querySelector('.calendar-expense-total-amount')?.textContent||'';
  result.guestNote=guest.querySelector('.calendar-expense-coverage')?.textContent||'';
  // Legibility: the exclusion line must not be the faint grey it was.
  {
    const note=guest.querySelector('.calendar-expense-coverage');
    const amount=guest.querySelector('.calendar-expense-item dd');
    const rgb=value=>(String(value).match(/[0-9]+/g)||[]).slice(0,3).map(Number);
    const lum=c=>{const [r,g,b]=c.map(v=>{const x=v/255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4});
      return 0.2126*r+0.7152*g+0.0722*b};
    const contrast=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
    // The strip's own background can be transparent; the contrast that matters
    // is against whatever actually paints behind the text.
    const paintedBg=node=>{for(let n=node;n;n=n.parentElement){
      const c=getComputedStyle(n).backgroundColor;const parts=(String(c).match(/[0-9.]+/g)||[]).map(Number);
      if(parts.length>=3&&(parts.length<4||parts[3]>0))return parts.slice(0,3)}
      return [255,255,255]};
    const bg=paintedBg(note);
    result.noteColor=getComputedStyle(note).color;
    result.noteBg=bg;
    result.noteRgb=rgb(result.noteColor);
    const safe=v=>Number.isFinite(v)?Number(v.toFixed(2)):null;
    result.noteContrast=safe(contrast(rgb(result.noteColor),bg));
    result.amountContrast=safe(contrast(rgb(getComputedStyle(amount).color),bg));

    // Each category name carries its own fixed colour. Read in both themes,
    // because a colour that holds on white can vanish on the dark surface.
    const readCategories=()=>{
      const out={};
      for(const item of guest.querySelectorAll('.calendar-expense-item')){
        const dt=item.querySelector('dt');
        const color=getComputedStyle(dt).color;
        out[item.dataset.expenseCategory]={color,contrast:safe(contrast(rgb(color),paintedBg(dt)))};
      }
      return out;
    };
    const readAmountColors=()=>[...guest.querySelectorAll('.calendar-expense-item dd')]
      .map(node=>getComputedStyle(node).color);
    result.categoryColorsLight=readCategories();
    result.amountColorsLight=readAmountColors();
    document.body.dataset.siteTheme='dark';
    result.categoryColorsDark=readCategories();
    result.amountColorsDark=readAmountColors();
    delete document.body.dataset.siteTheme;
  }
  result.guestTotalOutsideScroller=(()=>{const items=guest.querySelector('.calendar-expense-items');
    const total=guest.querySelector('[data-expense-total]');return Boolean(items&&total&&!items.contains(total))})();
  result.guestOneLine=(()=>{const f=guest.querySelector('.calendar-expense-item').getBoundingClientRect();
    return ![...guest.querySelectorAll('.calendar-expense-item')].some(n=>Math.abs(n.getBoundingClientRect().top-f.top)>2)})();

  // --- an entry with no amount must not look like a saved 0 --------------
  // 대표 read a blank 여행 entry as "0원 저장됨" because the box carried a grey
  // placeholder 0. The bar counts that entry as excluded, not as zero spent,
  // so the two must not look alike.
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:makeGuestRepo([{local_date:'2026-09-14',
      entry:{amount_minor:null,currency:'KRW',expense_category:'TRAVEL'}}])});
  await wait(()=>root.querySelector('[data-calendar-date="2026-09-14"]'),'day cell');
  root.querySelector('[data-calendar-date="2026-09-14"]').click();
  await new Promise(r=>setTimeout(r,300));
  await wait(()=>root.querySelector('[data-calendar-event-id]'),'event button');
  root.querySelector('[data-calendar-event-id]').click();
  await wait(()=>document.querySelector('.calendar-editor-amount'),'editor');
  const editor=document.querySelector('.calendar-editor-dialog');
  const amountBox=document.querySelector('.calendar-editor-amount');
  result.blankAmountValue=amountBox?amountBox.value:null;
  result.blankAmountPlaceholder=amountBox?amountBox.placeholder:null;
  result.blankAmountCategory=editor.querySelector('.calendar-editor-category')?.value||null;
  document.querySelector('.calendar-editor-backdrop')?.remove();

  // --- two currencies: the KRW total must not print a bare W -------------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:makeGuestRepo([
      {local_date:'2026-09-05',entry:{amount_minor:50000,currency:'KRW',expense_category:'FOOD'}},
      {local_date:'2026-09-06',entry:{amount_minor:1200,currency:'USD',expense_category:'SHOPPING'}}])});
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','two-currency strip');
  result.currencyTotalLabels=[...strip(root).querySelectorAll('.calendar-expense-total-label')].map(n=>n.textContent);

  // --- guest, empty month: the empty state, never a login prompt ---------
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),guestRepository:makeGuestRepo([])});
  await wait(()=>strip(root)?.dataset.calendarExpenseSummary==='ready','guest empty strip');
  const guestEmpty=strip(root);
  result.guestEmptyNote=guestEmpty.querySelector('.calendar-expense-coverage')?.textContent||'';
  result.guestEmptyRows=[...guestEmpty.querySelectorAll('.calendar-expense-item')].map(n=>n.querySelector('dd')?.textContent||'');

  // --- guest, a repository that throws: the Calendar must outlive it ------
  // The Calendar went down once already over this bar. A totals bar that cannot
  // compute is a missing bar, never a broken month.
  root=await mountCase(manager,{sessionToken:'',fetchImpl:stubFetch({expense:KRW_SUMMARY}),
    guestRepository:{list(){throw new Error('storage is gone')},create(){},update(){},remove(){}}});
  await new Promise(r=>setTimeout(r,600));
  result.brokenRepoMonthStanding=Boolean(root.querySelector('.calendar-month'));
  result.brokenRepoStripState=strip(root)?.dataset.calendarExpenseSummary||'absent';

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{strip:r?.querySelector('.calendar-expense-summary')?.dataset.calendarExpenseSummary||null,status:r?.querySelector('.calendar-status')?.textContent||''},viewport:{width:innerWidth,height:innerHeight}})}
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

// The editor's dropdown must read the shared list rather than spelling the
// labels again. It drifted once — "기타 / 생활비" in the editor against "생활비"
// in the bar — and a static check is what keeps a second copy from appearing.
{
  const manager = fs.readFileSync('site-calendar-manager.js', 'utf8');
  if (!manager.includes('EXPENSE_CATEGORY_CHOICES')) {
    throw new Error('the entry editor must build its category dropdown from EXPENSE_CATEGORY_CHOICES');
  }
  for (const label of ['기타 / 생활비', "'음식'", "'여행'", "'쇼핑'", "'생활비'"]) {
    if (manager.includes(label)) {
      throw new Error(`site-calendar-manager.js must not spell a category label itself (${label}) — it reads them from site-calendar-expense.js`);
    }
  }
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[360, 780], [390, 844], [768, 1024], [1280, 900]]) {
    const value = run(browser, w, h);
    const label = `${w}x${h}`;

    if (!value.stripOutsideLayout) throw new Error(`${label}: expense strip must not live inside the month layout`);
    if (!value.layoutFirstIsMonth) throw new Error(`${label}: month layout child 0 must stay the month grid`);
    if (!value.layoutSecondIsDayPanel) throw new Error(`${label}: month layout child 1 must stay the selected-day surface`);
    if (!value.stripFollowsMonth) throw new Error(`${label}: expense strip must render below the month`);

    // Every category keeps its slot, in a fixed order, even at 0원.
    const categories = value.rows.map(row => row.category);
    if (categories.join(',') !== 'FOOD,TRAVEL,SHOPPING,LIVING,OTHER,UNCLASSIFIED') throw new Error(`${label}: all six categories must keep a fixed slot, 미분류 last, got ${categories.join(',')}`);
    const labels = value.rows.map(row => row.label);
    if (labels.join(',') !== '음식,여행,쇼핑,생활비,기타,미분류') throw new Error(`${label}: Korean category labels missing, got ${labels.join(',')}`);
    const amounts = value.rows.map(row => row.amount);
    if (amounts.join(',') !== '40,500원,180,000원,0원,94,000원,0원,0원') throw new Error(`${label}: amounts must come from Core with 0원 for the untouched ones, got ${amounts.join(' | ')}`);

    // It is one line, not a table.
    if (value.lineCount !== 1) throw new Error(`${label}: one currency must render one line, got ${value.lineCount}`);
    if (!value.itemsOnOneRow) throw new Error(`${label}: the categories must stay on one row, never wrap into a table`);
    // itemsOnOneRow already proves nothing wrapped; this keeps the bar from
    // growing tall some other way. A wrapped five-row table measured ~80px+.
    if (value.lineHeight > value.itemHeight * 2 || value.lineHeight > 48) throw new Error(`${label}: the bar must stay one line tall, got ${value.lineHeight}px for a ${value.itemHeight}px item`);
    if (!value.totalOutsideScroller) throw new Error(`${label}: the total must sit outside the scrolling item list so it cannot scroll away`);

    // "총" said nothing about money and named no currency on a single-currency
    // month, which is nearly every month.
    if (value.totalLabel !== '합계 ₩') throw new Error(`${label}: a KRW total must be labelled "합계 ₩", got "${value.totalLabel}"`);
    if (value.totalText !== '314,500원') throw new Error(`${label}: total must be the sum Core returned, got ${value.totalText}`);
    if (!value.totalAfterItems) throw new Error(`${label}: the total must sit past the categories, at the end of the line`);
    if (!value.totalRightAligned) throw new Error(`${label}: the total must hold the right edge of the bar`);
    if (!value.totalInsideBar) throw new Error(`${label}: the total must stay inside the bar`);

    if (!value.coverageNote.includes('2건')) throw new Error(`${label}: entries without an amount must be reported, got "${value.coverageNote}"`);
    if (!value.aboveTheFold) throw new Error(`${label}: the totals bar must be visible without scrolling — bar bottom ${value.barBottom}px vs viewport ${value.viewportHeight}px`);
    if (!value.noHorizontalOverflow) throw new Error(`${label}: expense strip must not cause horizontal overflow`);

    // The calendar month, not the 42-cell grid window.
    if (value.expenseCalls.length !== 1) throw new Error(`${label}: expected one expense read, got ${value.expenseCalls.length}`);
    const call = value.expenseCalls[0];
    if (!call.includes('start=2026-09-01') || !call.includes('end=2026-09-30')) {
      throw new Error(`${label}: expense window must be the calendar month, got ${call}`);
    }

    if (value.switchShowsOldTotal) throw new Error(`${label}: the previous month's total must not survive a month change`);
    if (!value.switchHeading.includes('10월')) throw new Error(`${label}: the bar's accessible name must follow the displayed month, got "${value.switchHeading}"`);
    if (value.switchState !== 'loading') throw new Error(`${label}: a month change must fall back to loading, got "${value.switchState}"`);
    if (!value.octoberHeading.includes('10월')) throw new Error(`${label}: October accessible name missing, got "${value.octoberHeading}"`);
    if (value.octoberTotal !== '7,000원') throw new Error(`${label}: October total must be October's, got ${value.octoberTotal}`);

    if (!value.labelParity.matches) {
      throw new Error(`${label}: editor and totals labels must match — bar ${value.labelParity.bar.join(',')} vs editor ${value.labelParity.editor.join(',')}`);
    }

    if (!value.emptyPresent) throw new Error(`${label}: an empty month must keep the bar`);
    if (!value.emptyText.includes('이번 달 기록 없음')) throw new Error(`${label}: empty month must say "이번 달 기록 없음", got "${value.emptyText}"`);
    // The slots stay put at 0원 so the row does not move between months.
    if (value.emptySlots.join(',') !== '0원,0원,0원,0원,0원,0원') throw new Error(`${label}: an empty month must keep six 0원 slots, got ${value.emptySlots.join(',')}`);
    if (value.emptyTotal !== '0원') throw new Error(`${label}: an empty month total must read 0원, got ${value.emptyTotal}`);

    for (const status of [401, 403]) {
      const state = value['error' + status];
      if (!state.present) throw new Error(`${label}: a ${status} must keep the strip visible`);
      // The regression this locks: a refused auxiliary read used to tear the
      // Calendar down and drop the user back on Home.
      if (!state.monthStillRendered) throw new Error(`${label}: a ${status} on the expense read must leave the month grid standing`);
      if (!state.rootVisible) throw new Error(`${label}: a ${status} on the expense read must not empty the Calendar root`);
      if (state.text === value.emptyText) throw new Error(`${label}: a ${status} must not read like an empty month`);
    }
    // 401 means the session really expired; 403 means the server refused the
    // route, which signing in again does not fix.
    if (!value.error401.text.includes('다시 로그인')) throw new Error(`${label}: a 401 must offer signing in again, got "${value.error401.text}"`);
    if (!value.error403.text.includes('불러오지 못했습니다')) throw new Error(`${label}: a 403 must not tell the user to sign in again, got "${value.error403.text}"`);

    if (!value.guestPresent) throw new Error(`${label}: guests must still see the strip`);
    if (!value.guestAskedCore) throw new Error(`${label}: guest totals must be computed here, never fetched from Core`);

    // The same bar, not a lesser one: same six slots, same labels, same order.
    const guestCategories = value.guestRows.map(row => row.category);
    if (guestCategories.join(',') !== 'FOOD,TRAVEL,SHOPPING,LIVING,OTHER,UNCLASSIFIED') {
      throw new Error(`${label}: the signed-out bar must keep all six slots in order, got ${guestCategories.join(',')}`);
    }
    if (value.guestRows.map(row => row.label).join(',') !== '음식,여행,쇼핑,생활비,기타,미분류') {
      throw new Error(`${label}: the signed-out bar must use the same labels, got ${value.guestRows.map(r => r.label).join(',')}`);
    }
    if (!value.guestTotalOutsideScroller) throw new Error(`${label}: the signed-out total must sit outside the scroller like the signed-in one`);
    if (!value.guestOneLine) throw new Error(`${label}: the signed-out bar must stay one line`);

    // The arithmetic, on entries this browser holds.
    //   음식 32,000 + 8,500 = 40,500 · 여행 208,320 · 기타 48,000
    //   미분류 5,000 (an amount with no category) · 금액 없음 1건 · 10월 것은 제외
    const guestAmounts = Object.fromEntries(value.guestRows.map(row => [row.category, row.amount]));
    const guestExpected = {
      FOOD: '40,500원', TRAVEL: '208,320원', SHOPPING: '0원',
      LIVING: '0원', OTHER: '48,000원', UNCLASSIFIED: '5,000원',
    };
    for (const [category, want] of Object.entries(guestExpected)) {
      if (guestAmounts[category] !== want) {
        throw new Error(`${label}: signed-out ${category} must total ${want}, got ${guestAmounts[category]}`);
      }
    }
    if (value.guestTotal !== '301,820원') throw new Error(`${label}: signed-out total must be 301,820원 (October's entry excluded), got ${value.guestTotal}`);
    if (!value.guestNote.includes('금액 없는 일정 1건 제외')) throw new Error(`${label}: an entry with no amount must be reported, not estimated, got "${value.guestNote}"`);

    // Honest about where the numbers live, and framed as what signing in adds.
    if (!value.guestNote.includes('이 브라우저에만 저장')) throw new Error(`${label}: the signed-out bar must say the numbers live only in this browser, got "${value.guestNote}"`);
    if (!value.guestNote.includes('로그인하면')) throw new Error(`${label}: the note must say what signing in would add, got "${value.guestNote}"`);
    if (/로그인해야|로그인하면 .*보여드려요/.test(value.guestNote)) throw new Error(`${label}: the note must not stand in place of the totals, got "${value.guestNote}"`);

    // An empty month reads as an empty month, not as a login wall.
    if (!value.guestEmptyNote.includes('이번 달 기록 없음')) throw new Error(`${label}: a signed-out empty month must read "이번 달 기록 없음", got "${value.guestEmptyNote}"`);
    if (value.guestEmptyRows.some(amount => amount !== '0원')) throw new Error(`${label}: a signed-out empty month must show six 0원, got ${value.guestEmptyRows.join(',')}`);

    // [E] An entry with no amount must not wear a 0 that looks saved.
    if (value.blankAmountValue !== '') throw new Error(`${label}: an entry with no amount must open with an empty box, got "${value.blankAmountValue}"`);
    if (/^\s*0\s*$/.test(value.blankAmountPlaceholder || '')) {
      throw new Error(`${label}: the amount box must not show a placeholder 0 — "금액 없음" and "0원" are different things in the totals bar`);
    }
    // The category saved with it is untouched, which is what ruled out a
    // per-category bug: 여행 was never lost, only its amount was never set.
    if (value.blankAmountCategory !== 'TRAVEL') throw new Error(`${label}: the saved category must survive, got ${value.blankAmountCategory}`);

    // [D] A KRW total must not print a bare uppercase W.
    if (value.currencyTotalLabels.some(text => /\bKRW\b/.test(text))) {
      throw new Error(`${label}: the KRW total must use ₩, not the letters KRW, got ${JSON.stringify(value.currencyTotalLabels)}`);
    }
    if (!value.currencyTotalLabels.some(text => text.includes('₩'))) {
      throw new Error(`${label}: a multi-currency month must mark the KRW total with ₩, got ${JSON.stringify(value.currencyTotalLabels)}`);
    }
    // …and a non-KRW row must keep its own code rather than borrowing ₩.
    if (!value.currencyTotalLabels.some(text => text.includes('USD'))) {
      throw new Error(`${label}: a USD total must stay USD, got ${JSON.stringify(value.currencyTotalLabels)}`);
    }

    // [C] The exclusion line is the one line saying the total is not everything.
    // It must be readable, not decoration.
    // [E] The category names are told apart by colour as well as by word.
    // Distinct per category, legible on the surface behind them, and the same
    // in Light and Dark for a given category's hue — never on the amounts.
    for (const theme of ['Light', 'Dark']) {
      const colors = value['categoryColors' + theme];
      for (const category of ['FOOD', 'TRAVEL', 'SHOPPING', 'LIVING', 'OTHER', 'UNCLASSIFIED']) {
        const row = colors?.[category];
        if (!row) throw new Error(`${label}: ${theme} is missing a colour for ${category}`);
        if (!(row.contrast >= 4.5)) {
          throw new Error(`${label}: ${theme} ${category} must hold WCAG AA 4.5:1, got ${row.contrast}:1 (${row.color})`);
        }
      }
      const distinct = new Set(Object.values(colors).map(row => row.color));
      if (distinct.size !== 6) {
        throw new Error(`${label}: ${theme} must give the six categories six different colours, got ${distinct.size}: ${JSON.stringify(colors)}`);
      }
      // A coloured amount would read as a status the bar never means.
      const amounts = new Set(value['amountColors' + theme]);
      if (amounts.size !== 1) {
        throw new Error(`${label}: ${theme} amounts must stay one neutral colour, got ${JSON.stringify([...amounts])}`);
      }
    }

    if (!(value.noteContrast >= 7)) throw new Error(`${label}: "금액 없는 일정 …" must be legible (WCAG AAA 7:1), got ${value.noteContrast}:1 — text ${JSON.stringify(value.noteRgb)} on ${JSON.stringify(value.noteBg)}`);

    // The Calendar went down over this bar once. It must not again — and the
    // bar itself must land somewhere defined rather than spinning forever, which
    // is what it does when the failure is left to escape.
    if (!value.brokenRepoMonthStanding) throw new Error(`${label}: a guest repository that throws must leave the month grid standing`);
    if (value.brokenRepoStripState === 'loading') throw new Error(`${label}: a guest repository that throws must not leave the totals bar loading forever`);
  }
  console.log('validate_calendar_expense_summary_01: PASS');
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) {
    try { fs.unlinkSync(file); } catch {}
  }
}
