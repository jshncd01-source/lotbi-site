// Screenshots the Calendar month view with the expense totals bar, inside the
// real modal markup and stylesheets, at desktop and mobile sizes.
//
// Not a gate — a look. It exists so the totals line can be judged as a picture
// before it ships, and so "is it visible without scrolling" is answered by a
// measurement rather than an opinion. It prints the bar's geometry alongside
// each capture.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-shot-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const PORT = 4199;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const OUT = process.env.SHOT_DIR || path.join(ROOT, '.calendar-shots');

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The example the 대표 sent: a NOL hotel booking, plus a few everyday entries,
// so the bar is judged with realistic numbers rather than round ones.
const SUMMARY = {
  currencies: [{
    currency: 'KRW',
    categories: [
      {expense_category: 'FOOD', amount_minor: 32000, entry_count: 2},
      {expense_category: 'TRAVEL', amount_minor: 208320, entry_count: 1},
      {expense_category: 'LIVING', amount_minor: 12500, entry_count: 1},
    ],
    total_amount_minor: 252820,
    entry_count: 4,
  }],
  entries_without_amount: 1,
};

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- The same stylesheets index.html loads, in the same order: the modal's width
     and the month grid's containment come from several of them, and leaving any
     out produces a layout the product never shows. -->
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-hardening.css">
<link rel="stylesheet" href="/site-avatar.css">
<link rel="stylesheet" href="/site-sidebar-nav.css">
<link rel="stylesheet" href="/site-auth-continuity.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
<link rel="stylesheet" href="/footer-business-info.css">
<link rel="stylesheet" href="/mobile-entry.css">
<link rel="stylesheet" href="/home-bare-white.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<!-- site-conversation.js injects this at runtime; the modal chrome lives here. -->
<link rel="stylesheet" href="/site-conversation.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated" style="margin:0" data-site-theme="THEME">
<div class="site-modal-backdrop">
  <div class="site-modal site-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="t">
    <header class="site-modal-header"><h2 id="t">캘린더</h2><button type="button" class="site-modal-close" aria-label="캘린더 닫기">×</button></header>
    <div class="site-modal-content" data-calendar-manager-view="month"></div>
  </div>
</div>
<pre id="shot-result" style="position:fixed;left:-9999px">pending</pre>
<script type="module">
const out=document.getElementById('shot-result');
const wait=async(fn,label)=>{for(let i=0;i<300;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
const SUMMARY=${JSON.stringify(SUMMARY)};
const stub=url=>{
  const p=new URL(String(url),location.origin);
  if(p.pathname==='/v2/life/expense-summary')return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',
    timezone:'Asia/Seoul',start_date:p.searchParams.get('start'),end_date:p.searchParams.get('end'),
    coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',ai_calls:0,provider_api_calls:0,...SUMMARY});
  if(p.pathname==='/v2/life/agenda')return json({view:'AGENDA',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
    coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
  if(p.pathname==='/v2/life/attention')return json({view:'ATTENTION',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
    coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
  if(p.pathname==='/v2/life/holidays')return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
  return json({items:[]});
};
try{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_o,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{}}});
  const manager=await import('/site-calendar-manager.js?v=20260924-imagethumb1');
  const root=document.querySelector('.site-modal-content');
  // Signed OUT on purpose: this is the picture the 대표 asked for — a guest who
  // recorded a few amounts, and the totals bar adding them up with no account.
  const guestRows=[
    {local_date:'2026-09-03',entry:{amount_minor:32000,currency:'KRW',expense_category:'FOOD'}},
    {local_date:'2026-09-14',entry:{amount_minor:208320,currency:'KRW',expense_category:'TRAVEL'}},
    {local_date:'2026-09-18',entry:{amount_minor:12500,currency:'KRW',expense_category:'LIVING'}},
    {local_date:'2026-09-20',entry:{amount_minor:48000,currency:'KRW',expense_category:'OTHER'}},
    {local_date:'2026-09-22',entry:{amount_minor:null}},
  ].map((e,i)=>({id:'guest_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000',
    title:'기록 '+i,local_datetime:null,all_day:true,...e,
    entry:{amount_minor:null,currency:'KRW',expense_category:null,memo:null,place:null,merchant:null,...(e.entry||{})}}));
  manager.mountLifeCalendarManager({root,sessionToken:'',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),fetchImpl:stub,
    guestRepository:{list:()=>guestRows,create(){},update(){},remove(){}},
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}}});
  await wait(()=>root.querySelector('.calendar-expense-summary')?.dataset.calendarExpenseSummary==='ready','ready bar');
  await new Promise(r=>setTimeout(r,120));
  // On a phone the selected-day sheet sits over the bottom of the modal. The
  // capture collapses it when asked, so the bar can be judged on its own.
  if(new URL(location.href).searchParams.get('collapse')==='1'){
    const collapse=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()==='접기');
    globalThis.__collapseFound=Boolean(collapse);
    if(collapse){collapse.click();await new Promise(r=>setTimeout(r,500))}
    const close=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()==='닫기');
    globalThis.__closeFound=Boolean(close);
    if(close){close.click();await new Promise(r=>setTimeout(r,500))}
  }
  const bar=root.querySelector('.calendar-expense-summary');
  const box=bar.getBoundingClientRect();
  const line=bar.querySelector('.calendar-expense-line').getBoundingClientRect();
  out.textContent=JSON.stringify({ok:true,
    viewport:{width:innerWidth,height:innerHeight},
    barTop:Math.round(box.top),barBottom:Math.round(box.bottom),barHeight:Math.round(box.height),
    lineHeight:Math.round(line.height),
    itemHeight:Math.round(bar.querySelector('.calendar-expense-item').getBoundingClientRect().height),
    itemsWrapped:(()=>{const f=bar.querySelector('.calendar-expense-item').getBoundingClientRect();
      return [...bar.querySelectorAll('.calendar-expense-item')].some(n=>Math.abs(n.getBoundingClientRect().top-f.top)>2)})(),
    monthBottom:Math.round(document.querySelector('.calendar-month-layout').getBoundingClientRect().bottom),
    clippedByModal:(()=>{const c=document.querySelector('.site-modal-content').getBoundingClientRect();
      return bar.getBoundingClientRect().bottom>c.bottom+1})(),
    visibleWithoutScrolling:box.bottom<=innerHeight&&box.top>=0,
    // What the eye actually sees at the bar's own centre.
    topElementAtBar:(()=>{const n=document.elementFromPoint(Math.round(box.left+box.width/2),Math.round(box.top+box.height/2));
      return n?(n.className&&typeof n.className==='string'?n.className:n.tagName):'none'})(),
    barCovered:(()=>{const n=document.elementFromPoint(Math.round(box.left+box.width/2),Math.round(box.top+box.height/2));
      return !(n&&bar.contains(n))})(),
    collapseFound:globalThis.__collapseFound===true,closeFound:globalThis.__closeFound===true,
    dayPanelHidden:document.querySelector('.calendar-day-panel')?.hidden===true,
    total:bar.querySelector('.calendar-expense-total-amount')?.textContent||'',
    items:[...bar.querySelectorAll('.calendar-expense-item')].map(n=>n.querySelector('dt').textContent+' '+n.querySelector('dd').textContent),
    note:bar.querySelector('.calendar-expense-coverage')?.textContent||'',
    noteColor:(()=>{const n=bar.querySelector('.calendar-expense-coverage');return n?getComputedStyle(n).color:''})(),
    noteContrast:(()=>{const n=bar.querySelector('.calendar-expense-coverage');if(!n)return null;
      const rgb=v=>(String(v).match(/[0-9.]+/g)||[]).map(Number).slice(0,3);
      const paint=x=>{for(let e=x;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;
        const q=(String(c).match(/[0-9.]+/g)||[]).map(Number);if(q.length>=3&&(q.length<4||q[3]>0))return q.slice(0,3)}return [255,255,255]};
      const lum=c=>{const [r,g,b]=c.map(v=>{const x=v/255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4});
        return 0.2126*r+0.7152*g+0.0722*b};
      const a=lum(rgb(getComputedStyle(n).color)),b=lum(paint(n));
      return Number(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2))})()});
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

const browser = browserPath();
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
const DEBUG_PORT = 9341;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Device metrics over --window-size: headless Chrome clamps the window to a
// minimum width, which silently turned a 390px capture into 500px.
const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${DEBUG_PORT}`, '--force-prefers-reduced-motion=reduce', '--hide-scrollbars',
  'about:blank'], {stdio: 'ignore'});

try {
  waitServer();
  let targets = null;
  for (let i = 0; i < 60; i += 1) {
    try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  if (!targets?.length) throw new Error('no devtools target');
  const ws = new globalThis.WebSocket(targets[0].webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise(resolve => {
    const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({id: n, method, params}));
  });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');

  for (const [label, width, height, mobile, theme] of [
    ['light-desktop-1440x900', 1440, 900, false, 'light'],
    ['light-mobile-390x844', 390, 844, true, 'light'],
    ['dark-desktop-1440x900', 1440, 900, false, 'dark'],
    ['dark-mobile-390x844', 390, 844, true, 'dark'],
  ]) {
    fs.writeFileSync(INNER, fixture.replaceAll('THEME', theme), 'utf8');
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
    await send('Page.navigate', {url: ORIGIN + '/' + INNER_REL + (mobile ? '?collapse=1' : '')});
    await sleep(5000);
    const probe = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `document.getElementById('shot-result').textContent`,
    });
    console.log(label, probe.result.value);
    const shot = await send('Page.captureScreenshot', {format: 'png'});
    const file = path.join(OUT, `calendar-expense-${label}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('  ->', file);
  }
  ws.close();
} finally {
  chrome.kill();
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
}
