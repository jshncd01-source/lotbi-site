// Locks the compact selected-day bottom sheet on touch widths.
//
// The sheet used to eat roughly half of a phone screen even on a day with no
// events, which hid the bottom rows of the month and made the next date
// untappable. Covered contracts:
//   - an empty day's sheet stays within a small share of the viewport
//   - the month reserves scroll room for the sheet, so every date row can be
//     brought into view and tapped while the sheet is open
//   - 이미지로 등록 / 직접 등록 stay on one row and stay hit-testable
//   - a busy day is capped and scrolls inside the sheet, never past the top
//   - desktop keeps the anchored popover at its original size
//   - dark mode measures the same as light
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-compact-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-compact-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4203;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'compact1';

// The empty-day sheet is the shape the report is about. It measured 151px and
// 17.9% of a 390x844 phone; one heading row plus one "nothing here, add
// something" row is 82px. These are the ceilings that keep it there.
const EMPTY_SHARE_MAX = 0.12;
const EMPTY_HEIGHT_MAX = 92;
const BUSY_SHARE_MAX = 0.44;

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
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage,viewport:{width:innerWidth,height:innerHeight}})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<200;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const settle=async node=>{
  let previous=null,stable=0;
  for(let i=0;i<120;i+=1){
    const current=node.getBoundingClientRect().height;
    if(previous!==null&&Math.abs(current-previous)<0.5){stable+=1;if(stable>=3)return}else stable=0;
    previous=current;
    await new Promise(r=>setTimeout(r,20));
  }
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
      return json({year,country:'KR',coverage_status:'VERIFIED',snapshot_version:'compact-'+year,supported_years:[year],items:[],ai_calls:0,provider_api_calls:0});
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
  for(let i=0;i<8;i+=1){
    guestRepo.create({title:'가득 찬 하루 일정 '+(i+1),local_date:busyDate,local_datetime:busyDate+'T0'+(i+1)+':00:00',all_day:false});
  }

  const conversation=await import('/site-conversation.js?v=${V}');
  if(!conversation.mountConversation())throw new Error('conversation mount');
  // After mount: the theme bootstrap stamps data-site-theme on the body itself,
  // so setting it earlier is simply overwritten.
  if(forceDark)document.body.dataset.siteTheme='dark';
  click(document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]'));
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar modal');
  const modal=document.querySelector('.site-modal.site-calendar-modal');
  const content=modal.querySelector('.site-modal-content');
  await wait(()=>content?.dataset.calendarManagerView==='month','month view');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','calendar idle');
  stage='layout settle';
  await new Promise(r=>setTimeout(r,60));
  await wait(()=>modal.querySelector('.calendar-month')?.getBoundingClientRect().width>0,'month geometry');

  const desktop=innerWidth>900;
  const result={ok:true,desktop,viewport:{width:innerWidth,height:innerHeight},
    theme:document.body.dataset.siteTheme||'light'};

  const cells=()=>[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')];
  const emptyCell=cells().find(node=>node.dataset.calendarDate!==busyDate&&node.dataset.selected!=='true');
  const emptyDate=emptyCell.dataset.calendarDate;

  // --- empty day ----------------------------------------------------------
  click(emptyCell);
  await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'empty sheet open');
  const panel=modal.querySelector('.calendar-day-panel');
  await settle(panel);
  const measure=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width}};
  result.empty={
    presentation:panel.dataset.presentation,
    rect:measure(panel),
    share:panel.getBoundingClientRect().height/innerHeight,
    addRowSingleLine:(()=>{
      const row=panel.querySelector('.calendar-add-actions');
      if(!row)return false;
      const buttons=[...row.querySelectorAll('.calendar-add-button')];
      if(buttons.length!==2)return false;
      return Math.abs(buttons[0].getBoundingClientRect().top-buttons[1].getBoundingClientRect().top)<2;
    })(),
    // Hit-testing is the whole point: a button that exists but sits under the
    // sheet's own padding or off-screen is not a button the owner can press.
    addHittable:(()=>{
      const ok=selector=>{
        const node=panel.querySelector(selector);
        if(!node)return false;
        const r=node.getBoundingClientRect();
        if(r.width<40||r.height<24)return false;
        const hit=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
        return Boolean(hit&&(hit===node||node.contains(hit)));
      };
      return ok('[data-calendar-add-image]')&&ok('[data-calendar-add]');
    })(),
    // One row: the "no entries" sentence sits beside the buttons, not above them.
    emptyRowSingleLine:(()=>{
      const message=panel.querySelector('.life-calendar-empty');
      const row=panel.querySelector('.calendar-add-actions');
      if(!message||!row)return false;
      if(panel.querySelector('.calendar-day-body')?.dataset.empty!=='true')return false;
      return Math.abs(message.getBoundingClientRect().top-row.getBoundingClientRect().top)<14;
    })(),
    // Boxes that exist and hit-test can still be too narrow for their own
    // labels: on the first deploy "이미지로 등록" spilled across "직접 등록".
    // Compare each label's ink to the box it was given, and check the two boxes
    // do not overlap.
    addLabelsFit:(()=>{
      const buttons=[...panel.querySelectorAll('.calendar-add-actions .calendar-add-button')];
      if(buttons.length!==2)return false;
      if(buttons.some(b=>b.scrollWidth-b.clientWidth>1))return false;
      const [a,b]=buttons.map(n=>n.getBoundingClientRect());
      return a.right<=b.left+0.5||b.right<=a.left+0.5;
    })(),
    addLabelWidths:[...panel.querySelectorAll('.calendar-add-actions .calendar-add-button')]
      .map(n=>({text:n.textContent.trim(),box:Math.round(n.clientWidth),ink:Math.round(n.scrollWidth)})),
    toggle:Boolean(panel.querySelector('.calendar-day-toggle')),
    close:Boolean(panel.querySelector('.calendar-day-close')),
    hasEmptyMessage:panel.textContent.includes('등록된 일정이 없어요'),
  };

  if(!desktop){
    // Every date row must be reachable while the sheet is open: the month is
    // allowed to require a scroll, but not to be permanently trapped under the
    // sheet, and no tap may be swallowed by the dismiss layer on the way.
    const scroller=content;
    // The reserve is written by syncMonthLayout, which renderMonth schedules on
    // an animation frame -- and a headless page under --virtual-time-budget can
    // go idle without ever producing one. The resize path runs the same sync
    // synchronously, so drive it rather than waiting for a frame that may not come.
    dispatchEvent(new Event('resize'));
    await new Promise(r=>setTimeout(r,60));
    const layout=modal.querySelector('.calendar-month-layout');
    const reachable=()=>new Set(cells().filter(node=>{
      const r=node.getBoundingClientRect();
      const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
      if(y<0||y>innerHeight)return false;
      const hit=document.elementFromPoint(x,y);
      return Boolean(hit&&node.contains(hit));
    }).map(node=>node.dataset.calendarDate));
    scroller.scrollTop=0;
    await new Promise(r=>setTimeout(r,60));
    const atTop=reachable();
    scroller.scrollTop=scroller.scrollHeight;
    await new Promise(r=>setTimeout(r,80));
    const atBottom=reachable();
    const sheetTop=panel.getBoundingClientRect().top;
    const lastRowBottom=Math.max(...cells().map(node=>node.getBoundingClientRect().bottom));
    result.empty.scrollReserve={
      dayDetail:layout?.dataset.dayDetail||'',
      reserve:layout?getComputedStyle(layout).paddingBottom:'',
      scrollTop:scroller.scrollTop,
      scrollable:scroller.scrollHeight-scroller.clientHeight,
      sheetTop,
      lastRowBottom,
      reachableAtTop:atTop.size,
      reachableAtBottom:atBottom.size,
      // Union across both scroll ends: a row that is under the sticky toolbar
      // at one offset is still reachable, it just needs the other.
      reachableAnywhere:new Set([...atTop,...atBottom]).size,
      totalCells:cells().length,
    };
    scroller.scrollTop=0;
    await new Promise(r=>setTimeout(r,60));
  }

  // --- busy day -----------------------------------------------------------
  click(modal.querySelector('[data-calendar-date="'+busyDate+'"]'));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===busyDate,'busy sheet open');
  const busyPanel=modal.querySelector('.calendar-day-panel');
  await settle(busyPanel);
  const busyBody=busyPanel.querySelector('.calendar-day-body');
  result.busy={
    rect:measure(busyPanel),
    share:busyPanel.getBoundingClientRect().height/innerHeight,
    eventCount:busyPanel.querySelectorAll('.calendar-day-event').length,
    bodyScrolls:busyBody.scrollHeight-busyBody.clientHeight>4,
    addHittable:(()=>{
      const node=busyPanel.querySelector('[data-calendar-add]');
      if(!node)return false;
      const r=node.getBoundingClientRect();
      const hit=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
      return Boolean(hit&&(hit===node||node.contains(hit)));
    })(),
  };

  result.emptyDate=emptyDate;
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
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h, {theme = 'light'} = {}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, theme), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=60000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
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

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const report = [];
try {
  waitServer();
  const cases = [[390, 844], [412, 915], [360, 780], [320, 800], [768, 900], [1280, 900]];
  for (const [w, h] of cases) report.push(run(browser, w, h));
  report.push(run(browser, 390, 844, {theme: 'dark'}));

  if (process.env.CALENDAR_DAY_SHEET_MEASURE_ONLY === '1') {
    console.log(JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme, desktop: v.desktop,
      presentation: v.empty.presentation,
      emptyHeight: Math.round(v.empty.rect.height), emptyShare: Number(v.empty.share.toFixed(4)),
      busyHeight: Math.round(v.busy.rect.height), busyShare: Number(v.busy.share.toFixed(4)),
      busyScrolls: v.busy.bodyScrolls, reserve: v.empty.scrollReserve,
      addRowSingleLine: v.empty.addRowSingleLine, addHittable: v.empty.addHittable,
      labels: v.empty.addLabelWidths, fits: v.empty.addLabelsFit, oneLine: v.empty.emptyRowSingleLine,
    })), null, 2));
  } else {
    for (const value of report) {
      const label = `${value.viewport.width}x${value.viewport.height}${value.theme === 'dark' ? ' dark' : ''}`;
      const empty = value.empty, busy = value.busy;
      if (!empty.hasEmptyMessage) throw new Error(`${label}: empty day must still say 등록된 일정이 없어요`);
      if (!empty.toggle || !empty.close) throw new Error(`${label}: 접기/닫기 controls must survive`);
      if (!empty.addRowSingleLine) throw new Error(`${label}: 이미지로 등록 / 직접 등록 must share one row`);
      if (!empty.addHittable) throw new Error(`${label}: both add buttons must stay hit-testable`);
      if (!empty.addLabelsFit) {
        throw new Error(`${label}: the add buttons are narrower than their labels or overlap each other ${JSON.stringify(empty.addLabelWidths)}`);
      }
      if (busy.eventCount !== 8) throw new Error(`${label}: busy fixture lost events (${busy.eventCount})`);

      if (value.desktop) {
        // Desktop is out of scope here and deliberately unchanged: it keeps the
        // anchored popover, at the size it always had.
        if (empty.presentation !== 'POPOVER') throw new Error(`${label}: desktop must keep the anchored popover`);
        if (Math.abs(empty.rect.height - 148) > 6) throw new Error(`${label}: desktop popover height moved (${Math.round(empty.rect.height)}px, expected ~148px)`);
        continue;
      }
      if (empty.presentation !== 'SHEET') throw new Error(`${label}: touch must keep the bottom sheet`);
      // Pinned, so a full list never buries them.
      if (!busy.addHittable) throw new Error(`${label}: 직접 등록 must stay reachable on a busy day`);
      if (empty.share > EMPTY_SHARE_MAX) {
        throw new Error(`${label}: empty-day sheet covers ${(empty.share * 100).toFixed(1)}% of the viewport, limit ${(EMPTY_SHARE_MAX * 100).toFixed(0)}%`);
      }
      if (empty.rect.height > EMPTY_HEIGHT_MAX) {
        throw new Error(`${label}: empty-day sheet is ${Math.round(empty.rect.height)}px tall, limit ${EMPTY_HEIGHT_MAX}px`);
      }
      if (!empty.emptyRowSingleLine) {
        throw new Error(`${label}: an empty day must put the message and both buttons on one row`);
      }
      if (busy.share > BUSY_SHARE_MAX) {
        throw new Error(`${label}: busy-day sheet covers ${(busy.share * 100).toFixed(1)}% of the viewport, limit ${(BUSY_SHARE_MAX * 100).toFixed(0)}%`);
      }
      if (!busy.bodyScrolls) throw new Error(`${label}: a busy day must scroll inside the sheet, not grow it`);
      if (busy.rect.top < -1) throw new Error(`${label}: sheet escapes the top of the viewport`);
      if (empty.rect.left < -1 || empty.rect.right > value.viewport.width + 1) throw new Error(`${label}: sheet horizontal overflow`);

      const reserve = empty.scrollReserve || {};
      if (reserve.dayDetail !== 'SHEET') throw new Error(`${label}: the month layout must advertise the sheet presentation`);
      if (!(parseFloat(reserve.reserve) > 0)) throw new Error(`${label}: the month must reserve scroll room for the sheet (got ${reserve.reserve})`);
      if (!(reserve.lastRowBottom <= reserve.sheetTop + 1)) {
        throw new Error(`${label}: the month cannot scroll clear of the sheet (last row bottom ${Math.round(reserve.lastRowBottom)} vs sheet top ${Math.round(reserve.sheetTop)})`);
      }
      // The regression this file was written for: the dismiss layer covered the
      // whole viewport, so with the sheet open NO date could be tapped at all.
      if (reserve.reachableAtTop < 5) {
        throw new Error(`${label}: only ${reserve.reachableAtTop} date cells are tappable while the sheet is open`);
      }
      if (reserve.reachableAnywhere !== reserve.totalCells) {
        throw new Error(`${label}: ${reserve.totalCells - reserve.reachableAnywhere} of ${reserve.totalCells} date cells stay unreachable with the sheet open`);
      }
    }
    console.log('CALENDAR DAY SHEET COMPACT PASS', JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme,
      emptyShare: Number((v.empty.share * 100).toFixed(1)),
      busyShare: Number((v.busy.share * 100).toFixed(1)),
    }))));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
