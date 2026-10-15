import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-approved-fullpage-shot.html';
const INNER = path.join(ROOT, INNER_REL);
const PORT = 4236;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = process.env.SHOT_DIR || path.join(ROOT, 'docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/after');

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if ((name.includes('/') || name.includes('\\')) && fs.existsSync(name)) return name;
    const located = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {encoding: 'utf8'});
    if (located.status === 0 && located.stdout.trim()) return located.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-hardening.css">
<link rel="stylesheet" href="/site-sidebar-nav.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
<link rel="stylesheet" href="/site-calendar-weather.css">
<link rel="stylesheet" href="/site-bottom-sheet.css">
<link rel="stylesheet" href="/mobile-entry.css">
<link rel="stylesheet" href="/home-bare-white.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-consumer-design.css">
<link rel="stylesheet" href="/site-consumer-layout.css">
<style>
  .evidence-sidebar{position:fixed;inset:0 auto 0 0;width:220px;box-sizing:border-box;padding:28px 18px;border-right:1px solid var(--lotbi-border-default);background:var(--lotbi-surface-primary);z-index:2}
  .evidence-logo{margin:0 0 30px;color:#087cf1;font-size:27px;font-weight:900;letter-spacing:-1px}.evidence-nav{display:grid;gap:8px}.evidence-nav span{padding:12px 14px;border-radius:10px;color:var(--lotbi-text-secondary);font-weight:650}.evidence-nav .active{background:var(--lotbi-surface-hover);color:var(--lotbi-text-primary)}
  #shot-result{position:fixed;left:-9999px}
  @media(max-width:900px){.evidence-sidebar{display:none}}
</style></head>
<body class="chat-home-page site-workspace-open" data-site-auth-state="guest">
<aside class="evidence-sidebar" aria-hidden="true"><div class="evidence-logo">LOTBI</div><div class="evidence-nav"><span>홈</span><span>대화</span><span class="active">캘린더</span><span>생활정보</span><span>가족 지킴이</span></div></aside>
<div class="site-modal-backdrop consumer-workspace" data-workspace="calendar" data-site-route="calendar">
  <section class="site-modal site-calendar-modal site-calendar-chat-popup site-calendar-page" role="region" aria-labelledby="calendar-title">
    <header class="site-modal-header"><button type="button" class="site-modal-close" aria-label="대화로 돌아가기">←</button><h2 id="calendar-title">캘린더</h2></header>
    <p class="site-modal-description">내 일정과 생활 기록을 관리합니다.</p>
    <div class="site-modal-content" id="calendar-root"></div>
  </section>
</div>
<pre id="shot-result">pending</pre>
<script type="module">
const result=document.getElementById('shot-result');
const params=new URLSearchParams(location.search);const view=params.get('view')||'month';const empty=params.get('empty')==='1';
setTimeout(()=>{if(result.textContent==='pending')result.textContent=JSON.stringify({ok:false,error:'fixture watchdog timeout'})},30000);
document.body.dataset.siteTheme=params.get('theme')||'light';document.documentElement.dataset.siteThemeBootstrap=document.body.dataset.siteTheme;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<300;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
const weather=[
  ['2026-10-11','CLOUDY','☁️',15,23,21],['2026-10-12','CLEAR','☀️',16,24,22],['2026-10-13','CLOUDY','☁️',15,22,19],
  ['2026-10-14','CLEAR','☀️',14,23,20],['2026-10-15','RAIN','🌧️',13,20,17],['2026-10-16','CLOUDY','☁️',13,21,18],
  ['2026-10-17','CLEAR','☀️',14,22,19],['2026-10-18','CLEAR','☀️',12,21,18],['2026-10-19','CLOUDY','☁️',12,20,17],
  ['2026-10-20','CLEAR','☀️',11,20,16],['2026-10-21','CLEAR','☀️',11,19,16],['2026-10-22','CLOUDY','☁️',10,19,15],
  ['2026-10-23','RAIN','🌧️',10,18,14],['2026-10-24','CLEAR','☀️',9,18,14],['2026-10-25','CLEAR','☀️',9,17,13],
].map(([date,weather_kind,weather_icon,min_temperature_c,max_temperature_c,temperature_c])=>({date,weather_kind,weather_icon,min_temperature_c,max_temperature_c,temperature_c,source:'KMA_SHORT',issued_at:'2026-10-11T00:00:00Z',freshness:'CACHE_VALID'}));
const holidays=[{date:'2026-10-03',name:'개천절',holiday_type:'NATIONAL_HOLIDAY',is_substitute:false},{date:'2026-10-05',name:'대체공휴일',holiday_type:'SUBSTITUTE_HOLIDAY',is_substitute:true},{date:'2026-10-09',name:'한글날',holiday_type:'NATIONAL_HOLIDAY',is_substitute:false}];
const fetchImpl=url=>{const u=new URL(String(url),location.origin);
  if(u.pathname==='/v2/life/weather/public'){const start=u.searchParams.get('start'),end=u.searchParams.get('end');return json({provider_ready:true,items:weather.filter(x=>x.date>=start&&x.date<=end),ai_calls:0})}
  if(u.pathname==='/v2/life/holidays'){const year=Number(u.searchParams.get('year')||2026);return json({year,country:'KR',coverage_status:'VERIFIED',snapshot_version:'evidence-'+year,supported_years:[year],items:year===2026?holidays:[],ai_calls:0,provider_api_calls:0})}
  return json({items:[]});
};
const rows=[];const add=(n,date,time,title,category,amount)=>rows.push({id:'guest_'+String(n).padStart(8,'0')+'-0000-4000-8000-000000000000',title,local_date:date,local_datetime:time?date+'T'+time+':00':null,all_day:!time,source_kind:'USER_INPUT',allowed_actions:['UPDATE','REMOVE'],entry:{amount_minor:amount,currency:'KRW',expense_category:category,memo:null,place:null,merchant:null}});
if(!empty){
  add(1,'2026-10-11','09:00','아침 식사','FOOD',18000);add(2,'2026-10-11','11:00','생활용품 쇼핑','SHOPPING',42000);add(3,'2026-10-11','13:00','가족 점심','FOOD',32000);
  add(4,'2026-10-11','15:00','카페 약속','FOOD',12000);add(5,'2026-10-11','17:00','마트 장보기','LIVING',56000);add(6,'2026-10-11','19:00','저녁 식사','FOOD',48000);
  add(7,'2026-10-04','12:00','식비 정산','FOOD',200000);add(8,'2026-10-08','10:00','주말 여행','TRAVEL',80000);add(9,'2026-10-18','14:00','계절 쇼핑','SHOPPING',70000);add(10,'2026-10-22','09:00','공과금','LIVING',40000);add(11,'2026-10-27','18:00','기타 생활 기록','OTHER',30000);
}
const repo={list:()=>rows,create:value=>value,update:(_id,value)=>value,remove:()=>true};
try{
  localStorage.clear();localStorage.setItem('lotbi.calendar.settings.v1',JSON.stringify({showKoreaHolidays:true,showGridLines:true,showLunarDates:true,showPrecipitation:true,weekStart:0}));
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_ok,fail)=>fail?.({code:1,message:'denied'}),watchPosition:()=>0,clearWatch:()=>{}}});
  const {mountLifeCalendarManager}=await import('/site-calendar-manager.js');
  const root=document.getElementById('calendar-root');
  mountLifeCalendarManager({root,sessionToken:'',timezone:'Asia/Seoul',now:()=>new Date('2026-10-11T12:00:00+09:00'),fetchImpl,guestRepository:repo,weatherLocation:{label:'서울',latitude:37.5665,longitude:126.978},settingsStorage:localStorage});
  await wait(()=>root.querySelector('.calendar-month-grid'),'month');await wait(()=>root.getAttribute('aria-busy')!=='true','idle');await sleep(250);
  if(view==='detail'){root.querySelector('[data-calendar-date-trigger="2026-10-11"]')?.click();await wait(()=>root.querySelector('.calendar-day-panel:not([hidden])'),'detail')}
  if(view==='week'){root.querySelector('[data-calendar-mode="week"]')?.click();await wait(()=>root.dataset.calendarManagerView==='week','week');await wait(()=>root.querySelectorAll('[data-calendar-fixed-expense="week"] .calendar-amount-category').length===6,'week expense')}
  if(view==='year'){root.querySelector('[data-calendar-mode="year"]')?.click();await wait(()=>root.dataset.calendarManagerView==='year','year');await wait(()=>root.getAttribute('aria-busy')!=='true','year idle')}
  if(view==='add'){document.querySelector('.calendar-primary-add-button')?.click();await wait(()=>root.querySelector('.calendar-editor-dialog'),'editor')}
  if(view==='totals'){document.querySelector('.consumer-workspace').scrollTop=10000;await sleep(100)}
  await sleep(400);const fixedExpense=root.querySelector('[data-calendar-fixed-expense="week"]');const fixedExpenseBox=fixedExpense?.getBoundingClientRect();result.textContent=JSON.stringify({ok:true,view,empty,theme:document.body.dataset.siteTheme,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,weekExpense:view==='week'?{visible:Boolean(fixedExpense),position:fixedExpense?getComputedStyle(fixedExpense.closest('.calendar-amount-slot')).position:'',inside:Boolean(fixedExpenseBox&&fixedExpenseBox.top>=0&&fixedExpenseBox.bottom<=innerHeight+1),categories:fixedExpense?.querySelectorAll('.calendar-amount-category').length||0}:null});
}catch(error){result.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

function waitServer() {
  for (let index = 0; index < 60; index += 1) {
    const request = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (request.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('fixture server did not start');
}

fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const browser = browserPath();
const debugPort = 9436;
const chrome = spawn(browser, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',`--remote-debugging-port=${debugPort}`,'--force-prefers-reduced-motion=reduce','about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  waitServer();
  let targets;
  for (let index = 0; index < 60; index += 1) {
    try {
      const listed = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      targets = listed.filter(target => target.type === 'page' && !String(target.url).startsWith('chrome-extension://'));
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  if (!targets?.length) throw new Error('no DevTools target');
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result); pending.delete(message.id); } };
  await new Promise(resolve => { socket.onopen = resolve; });
  await send('Page.enable'); await send('Runtime.enable');
  const cases = [
    ['pc-light-month',1280,900,false,'light','month',false],['pc-light-week',1280,900,false,'light','week',false],['pc-light-detail',1280,900,false,'light','detail',false],['pc-light-year',1280,900,false,'light','year',false],['pc-light-add',1280,900,false,'light','add',false],['pc-light-totals',1280,900,false,'light','totals',false],
    ['pc-dark-month',1280,900,false,'dark','month',false],['pc-dark-week',1280,900,false,'dark','week',false],['pc-dark-empty',1280,900,false,'dark','month',true],['pc-dark-empty-detail',1280,900,false,'dark','detail',true],
    ['mobile-light-month',360,780,true,'light','month',false],['mobile-light-week',360,780,true,'light','week',false],['mobile-light-detail',360,780,true,'light','detail',false],['mobile-light-year',360,780,true,'light','year',false],['mobile-light-add',360,780,true,'light','add',false],['mobile-light-totals',360,780,true,'light','totals',false],
    ['mobile-dark-month',360,780,true,'dark','month',false],['mobile-dark-week',360,780,true,'dark','week',false],['mobile-dark-empty',360,780,true,'dark','month',true],['mobile-dark-empty-detail',360,780,true,'dark','detail',true],
  ];
  for (const [name,width,height,mobile,theme,view,empty] of cases) {
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await send('Page.navigate',{url:`${ORIGIN}/${INNER_REL}?theme=${theme}&view=${view}&empty=${empty?'1':'0'}`});
    let value='pending';
    for (let index=0;index<400&&value==='pending';index+=1){await sleep(100);const probe=await send('Runtime.evaluate',{returnByValue:true,expression:"document.getElementById('shot-result')?.textContent||'pending'"});value=probe.result.value}
    if(value==='pending'){
      const debug=await send('Runtime.evaluate',{returnByValue:true,expression:"JSON.stringify({href:location.href,ready:document.readyState,result:document.getElementById('shot-result')?.textContent,body:document.body?.className})"});
      throw new Error(`${name}: fixture stayed pending ${debug.result.value}`);
    }
    const parsed=JSON.parse(value);if(!parsed.ok)throw new Error(`${name}: ${parsed.error}`);if(parsed.overflow>1)throw new Error(`${name}: horizontal overflow ${parsed.overflow}`);if(view==='week'&&(!parsed.weekExpense?.visible||parsed.weekExpense.position!=='fixed'||!parsed.weekExpense.inside||parsed.weekExpense.categories!==6))throw new Error(`${name}: fixed expense summary ${JSON.stringify(parsed.weekExpense)}`);
    const shot=await send('Page.captureScreenshot',{format:'png'});const target=path.join(OUT,`${name}.png`);fs.writeFileSync(target,Buffer.from(shot.data,'base64'));console.log(name,JSON.stringify(parsed),'->',target);
  }
  socket.close();
} finally {
  chrome.kill();server.kill();if(process.env.KEEP_FIXTURE!=='1')try{fs.unlinkSync(INNER)}catch{}
}
