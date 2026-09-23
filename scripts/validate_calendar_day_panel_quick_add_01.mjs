// Locks what a tap on a date does: it opens a title box with the caret in it.
//
// The panel used to answer a tap with a notice and two buttons, welded to the
// bottom of the screen -- so writing "치과" took a second press and a second
// surface, and the panel read as a fixture rather than as that date's. Covered
// contracts, all measured in a real browser:
//   - tapping a date focuses a title input; no second press
//   - a title alone saves, and lands on the tapped day
//   - the panel is anchored to the tapped cell, not pinned to the viewport edge
//   - it never takes more than a bit over half of what is visible
//   - the month stays visible and every other date stays tappable
//   - 이미지로 등록 / 자세히 survive as secondary controls
//   - the title box holds 16px, the floor that stops iOS zooming on focus
//   - a folded Fold (344px) and dark mode behave the same
//   - desktop keeps its anchored popover
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-quickadd-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-quickadd-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4207;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'quickadd1';

// The panel may cover a couple of date rows. It may not cover the month.
const SHARE_MAX = 0.58;
// Below this the browser zooms the page on focus, on every iOS there is.
const TITLE_FONT_MIN = 16;

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
      return json({year,country:'KR',coverage_status:'VERIFIED',snapshot_version:'quickadd-'+year,supported_years:[year],items:[],ai_calls:0,provider_api_calls:0});
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
  // Seeded later, deliberately. Signed out, a browser gets three creates ever,
  // and the count is floored at however many entries are already held -- so a
  // calendar pre-filled with eight has no creates left, and the quick-add being
  // tested here would be refused for running out rather than for anything this
  // file is about. The empty calendar is tested first; the full day is seeded
  // straight into storage afterwards.
  const seedBusyDay=()=>{
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
  };

  const conversation=await import('/site-conversation.js?v=${V}');
  if(!conversation.mountConversation())throw new Error('conversation mount');
  if(forceDark)document.body.dataset.siteTheme='dark';
  click(document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]'));
  await wait(()=>document.querySelector('.site-modal.site-calendar-modal'),'calendar modal');
  const modal=document.querySelector('.site-modal.site-calendar-modal');
  const content=modal.querySelector('.site-modal-content');
  await wait(()=>content?.dataset.calendarManagerView==='month','month view');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','calendar idle');
  stage='layout settle';
  await new Promise(r=>setTimeout(r,80));
  await wait(()=>modal.querySelector('.calendar-month')?.getBoundingClientRect().width>0,'month geometry');

  const desktop=innerWidth>900;
  const result={ok:true,desktop,viewport:{width:innerWidth,height:innerHeight},
    theme:document.body.dataset.siteTheme||'light'};

  const cells=()=>[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')];
  const emptyCell=cells().find(node=>node.dataset.calendarDate!==busyDate&&node.dataset.selected!=='true');
  const emptyDate=emptyCell.dataset.calendarDate;
  result.emptyDate=emptyDate;
  result.busyDate=busyDate;

  // Mount must not grab the caret: opening the Calendar would raise a keyboard
  // nobody asked for.
  result.focusedOnMount=document.activeElement?.dataset?.calendarQuickAddTitle!==undefined
    &&document.activeElement?.hasAttribute?.('data-calendar-quick-add-title')===true;

  // --- a tap on an empty day -------------------------------------------
  click(emptyCell);
  await wait(()=>!modal.querySelector('.calendar-day-panel')?.hidden,'panel open');
  const panel=modal.querySelector('.calendar-day-panel');
  await settle(panel);
  await wait(()=>document.activeElement?.hasAttribute?.('data-calendar-quick-add-title'),'caret in the title box');
  const titleInput=panel.querySelector('[data-calendar-quick-add-title]');
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
  result.empty={
    presentation:panel.dataset.presentation,
    position:getComputedStyle(panel).position,
    rect:measure(panel),
    share:panelRect.height/innerHeight,
    titleFocused:document.activeElement===titleInput,
    titleFontSize:parseFloat(getComputedStyle(titleInput).fontSize),
    titleHittable:hit(titleInput),
    saveHittable:hit(panel.querySelector('[data-calendar-quick-add-save]')),
    addImage:Boolean(panel.querySelector('[data-calendar-add-image]')),
    addImageLabel:panel.querySelector('[data-calendar-add-image]')?.textContent?.trim()||'',
    addDetail:Boolean(panel.querySelector('[data-calendar-add]')),
    addDetailLabel:panel.querySelector('[data-calendar-add]')?.textContent?.trim()||'',
    emptySentence:panel.textContent.includes('등록된 일정이 없어요'),
    arrow:panel.dataset.arrow||'',
    // Anchored, not welded: the panel touches the tapped row rather than the
    // bottom edge of the screen.
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

  // --- a title alone saves, on the tapped day ---------------------------
  titleInput.value='치과 예약';
  titleInput.dispatchEvent(new Event('input',{bubbles:true}));
  panel.querySelector('[data-calendar-quick-add]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  try{
    await wait(()=>guestRepo.list().some(entry=>entry.title==='치과 예약'),'title-only save');
  }catch(saveTimeout){
    const said=modal.querySelector('[data-calendar-quick-add-message]')?.textContent||'';
    const box=modal.querySelector('[data-calendar-quick-add-title]');
    throw new Error('title-only save never stored. panel said: "'+said+'" | box value: "'+(box?.value||'')+'" | stored: '+guestRepo.list().length);
  }
  const saved=guestRepo.list().find(entry=>entry.title==='치과 예약');
  await wait(()=>content?.getAttribute('aria-busy')!=='true','settle after save');
  await new Promise(r=>setTimeout(r,120));
  const afterPanel=modal.querySelector('.calendar-day-panel');
  result.save={
    storedDate:saved?.local_date||'',
    storedOnTappedDay:saved?.local_date===emptyDate,
    allDay:saved?.all_day===true,
    listedInPanel:[...afterPanel.querySelectorAll('.calendar-day-event strong')].some(n=>n.textContent==='치과 예약'),
    boxCleared:(afterPanel.querySelector('[data-calendar-quick-add-title]')?.value||'')==='',
    caretKept:document.activeElement?.hasAttribute?.('data-calendar-quick-add-title')===true,
    panelStillOpen:afterPanel&&!afterPanel.hidden,
  };

  // --- an empty title is refused, and says so ---------------------------
  const emptySubmitBefore=guestRepo.list().length;
  afterPanel.querySelector('[data-calendar-quick-add]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,180));
  result.blankRefused={
    stored:guestRepo.list().length===emptySubmitBefore,
    said:Boolean(modal.querySelector('[data-calendar-quick-add-message]')?.textContent?.trim()),
  };

  // --- a day that already has entries -----------------------------------
  seedBusyDay();
  // The month has to be re-read for the seed to exist as far as the panel is
  // concerned; stepping a month and back is the cheapest honest way to do it.
  const navButtons=modal.querySelectorAll('.calendar-nav-button');
  click(navButtons[1]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','next month settle');
  click(navButtons[0]);
  await wait(()=>content?.getAttribute('aria-busy')!=='true','back to month');
  await new Promise(r=>setTimeout(r,120));
  await wait(()=>modal.querySelector('[data-calendar-date="'+busyDate+'"]'),'busy cell back');
  click(modal.querySelector('[data-calendar-date="'+busyDate+'"]'));
  await wait(()=>modal.querySelector('.calendar-day-panel')?.dataset.selectedDate===busyDate,'busy day open');
  const busyPanel=modal.querySelector('.calendar-day-panel');
  await settle(busyPanel);
  const busyBody=busyPanel.querySelector('.calendar-day-body');
  // Bounded, not open-ended: a box that is reachable is reachable within a few
  // frames of the panel settling, and one that never is still fails.
  for(let i=0;i<25;i+=1){
    if(hit(busyPanel.querySelector('[data-calendar-quick-add-title]')))break;
    await new Promise(r=>setTimeout(r,20));
  }
  const busyRect=busyPanel.getBoundingClientRect();
  const busyList=busyPanel.querySelector('.calendar-day-list');
  const busyQuick=busyPanel.querySelector('[data-calendar-quick-add]');
  result.busy={
    events:busyPanel.querySelectorAll('.calendar-day-event').length,
    share:busyRect.height/innerHeight,
    rect:measure(busyPanel),
    bodyScrolls:busyBody.scrollHeight-busyBody.clientHeight>4,
    // Entries first, the add line under them.
    listAboveQuickAdd:Boolean(busyList&&busyQuick&&busyList.compareDocumentPosition(busyQuick)&Node.DOCUMENT_POSITION_FOLLOWING),
    titleHittable:hit(busyPanel.querySelector('[data-calendar-quick-add-title]')),
    titleFocused:document.activeElement?.hasAttribute?.('data-calendar-quick-add-title')===true,
    // Kept so a failure names what was in the way instead of only that
    // something was. This check has been the flaky one.
    titleHitDiagnostic:(()=>{
      const node=busyPanel.querySelector('[data-calendar-quick-add-title]');
      if(!node)return {reason:'no title box'};
      const r=node.getBoundingClientRect();
      const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
      const found=document.elementFromPoint(x,y);
      return {
        point:{x,y},
        boxRect:{top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),width:Math.round(r.width)},
        panelRect:{top:Math.round(busyRect.top),bottom:Math.round(busyRect.bottom)},
        bodyScrollTop:Math.round(busyBody.scrollTop),
        bodyRect:(()=>{const b=busyBody.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom)}})(),
        viewport:{width:innerWidth,height:innerHeight},
        hitTag:found?found.tagName:'(none)',
        hitClass:found?String(found.className||''):'',
      };
    })(),
  };

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
  // 344 is a folded Fold; 1280 is the desk it has to keep working on.
  const cases = [[390, 844], [412, 915], [360, 780], [344, 800], [768, 900], [1280, 900]];
  for (const [w, h] of cases) report.push(run(browser, w, h));
  report.push(run(browser, 390, 844, {theme: 'dark'}));

  if (process.env.CALENDAR_QUICK_ADD_MEASURE_ONLY === '1') {
    console.log(JSON.stringify(report, null, 1));
  } else {
    for (const value of report) {
      const label = `${value.viewport.width}x${value.viewport.height}${value.theme === 'dark' ? ' dark' : ''}`;
      const empty = value.empty, save = value.save, busy = value.busy;

      if (value.focusedOnMount) throw new Error(`${label}: opening the Calendar must not put the caret in the title box`);

      // The whole point.
      if (!empty.titleFocused) throw new Error(`${label}: tapping a date must put the caret in the title box`);
      if (!empty.titleHittable) throw new Error(`${label}: the title box must be hit-testable`);
      if (!empty.saveHittable) throw new Error(`${label}: 저장 must be hit-testable`);
      if (!(empty.titleFontSize >= TITLE_FONT_MIN)) {
        throw new Error(`${label}: the title box is ${empty.titleFontSize}px; below ${TITLE_FONT_MIN}px iOS zooms the page on focus`);
      }
      if (!save.storedOnTappedDay) throw new Error(`${label}: a title alone must save on the tapped day (got ${save.storedDate})`);
      if (!save.allDay) throw new Error(`${label}: a title with no time must save as an all-day entry`);
      if (!save.listedInPanel) throw new Error(`${label}: the saved entry must appear in the panel`);
      if (!save.boxCleared) throw new Error(`${label}: the title box must clear after a save`);
      if (!save.caretKept) throw new Error(`${label}: the caret must stay in the box for the next entry`);
      if (!save.panelStillOpen) throw new Error(`${label}: saving must not close the day`);
      if (!value.blankRefused.stored) throw new Error(`${label}: an empty title must not create an entry`);
      if (!value.blankRefused.said) throw new Error(`${label}: an empty title must say why nothing happened`);

      // Secondary, but still there.
      if (!empty.addImage) throw new Error(`${label}: 이미지로 등록 must survive`);
      if (empty.addImageLabel !== '이미지로 등록') throw new Error(`${label}: image route relabelled (${empty.addImageLabel})`);
      if (!empty.addDetail) throw new Error(`${label}: the full form must stay one press away`);
      if (!empty.emptySentence) throw new Error(`${label}: an empty day must still say 등록된 일정이 없어요`);

      // Entries first on a day that has them, and a long list scrolls inside.
      if (busy.events !== 8) throw new Error(`${label}: busy fixture lost entries (${busy.events})`);
      if (!busy.listAboveQuickAdd) throw new Error(`${label}: the entry list must come before the add line`);
      if (!busy.titleHittable) throw new Error(`${label}: the title box must stay reachable on a full day ${JSON.stringify(busy.titleHitDiagnostic)}`);
      if (!busy.bodyScrolls) throw new Error(`${label}: a full day must scroll inside the panel, not grow it`);

      if (empty.presentation !== 'POPOVER') throw new Error(`${label}: the day panel must be the anchored popover (got ${empty.presentation})`);
      if (empty.rect.top < -1) throw new Error(`${label}: the panel escapes the top of the viewport`);
      if (empty.rect.left < -1 || empty.rect.right > value.viewport.width + 1) throw new Error(`${label}: the panel overflows sideways`);
      if (empty.share > SHARE_MAX) {
        throw new Error(`${label}: the panel covers ${(empty.share * 100).toFixed(1)}% of the viewport, limit ${(SHARE_MAX * 100).toFixed(0)}%`);
      }
      if (busy.share > SHARE_MAX) {
        throw new Error(`${label}: a full day's panel covers ${(busy.share * 100).toFixed(1)}%, limit ${(SHARE_MAX * 100).toFixed(0)}%`);
      }

      if (value.desktop) continue;

      // The two things the owner asked for by name: it belongs to the date it
      // was opened from, and it is not a fixture bolted to the bottom edge.
      if (empty.pinnedToViewportBottom) throw new Error(`${label}: the panel is still welded to the bottom of the screen`);
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
    console.log('CALENDAR DAY PANEL QUICK ADD PASS', JSON.stringify(report.map(v => ({
      size: `${v.viewport.width}x${v.viewport.height}`, theme: v.theme,
      panel: `${v.empty.rect.height}px`,
      sharePct: Number((v.empty.share * 100).toFixed(1)),
      busyPct: Number((v.busy.share * 100).toFixed(1)),
      titleFont: v.empty.titleFontSize,
      tappable: `${v.empty.tappableDates}/${v.empty.totalDates}`,
    }))));
  }
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
