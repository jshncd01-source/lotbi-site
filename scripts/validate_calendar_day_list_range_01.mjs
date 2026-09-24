// CALENDAR-DAY-LIST-RANGE-01 — a stay reads as a stay in the day list.
//
// 대표님이 확인하고 싶어 하신 것: 2026-09-12 를 누르면 하단에
//
//   라마다 프라자 호텔 자은도 숙박
//   09/12 15:00 → 09/13 11:00
//
// 이 그대로 보이는가. 체크인만 보이고 언제 나가는지 안 보이면 숙박 일정이 아니다.
//
// This is the far end of the image → Calendar path: Core reads a check-out off
// the confirmation, writes it as one TIME_WINDOW, projects both ends onto the
// agenda, and the day list has to actually say so. Every link before this one
// is tested elsewhere; this tests the one the owner looks at.
//
// It also pins the restraint: an ordinary appointment, which genuinely happens
// at one moment, must not grow an arrow and a second time.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-daylist-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-daylist-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4215;
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
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="daylist-result">pending</pre>
<script type="module">
const out=document.getElementById('daylist-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<300;i+=1){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const click=n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));

// Exactly what Core's agenda projection now returns for these three.
const item=(over={})=>({
  projection_id:'proj_'+Math.random().toString(36).slice(2,10),
  activity_id:'activity_'+'1'.repeat(32),
  occurrence_id:'occurrence_'+'2'.repeat(32),
  title:'제목',local_date:'2026-09-12',local_datetime:null,
  local_end_date:null,local_end_datetime:null,
  temporal_kind:'DATE_ONLY',temporal_semantics:'USER_PLANNED_TIME',busy:'UNKNOWN',
  confirmation_level:'USER_ATTESTED',activity_revision:1,occurrence_revision:1,
  entry:{},provider_verified:false,reminder_configured:false,
  source_kind:'USER_INPUT',allowed_actions:['UPDATE','REMOVE'],
  ...over,
});

const STAY=item({
  activity_id:'activity_'+'a'.repeat(32),occurrence_id:'occurrence_'+'a'.repeat(32),
  title:'라마다 프라자 호텔 자은도 숙박',
  local_date:'2026-09-12',local_datetime:'2026-09-12T15:00:00',
  local_end_date:'2026-09-13',local_end_datetime:'2026-09-13T11:00:00',
  temporal_kind:'TIME_WINDOW',entry:{place:'라마다 프라자 호텔 자은도'},
});
const APPOINTMENT=item({
  activity_id:'activity_'+'b'.repeat(32),occurrence_id:'occurrence_'+'b'.repeat(32),
  title:'전주 치과 정기검진',
  local_date:'2026-09-12',local_datetime:'2026-09-12T10:30:00',
  temporal_kind:'LOCAL_DATE_TIME',
});
const TRIP=item({
  activity_id:'activity_'+'c'.repeat(32),occurrence_id:'occurrence_'+'c'.repeat(32),
  title:'제주 여행',
  local_date:'2026-09-12',local_datetime:null,
  local_end_date:'2026-09-15',local_end_datetime:null,
  temporal_kind:'DATE_RANGE',
});

const ITEMS=[STAY,APPOINTMENT,TRIP];

const SEEN=[];
function stubFetch(){
  const calls=[];
  return (url,init={})=>{
    const parsed=new URL(String(url),location.origin);
    calls.push(parsed.pathname); SEEN.push(parsed.pathname+parsed.search);
    if(parsed.pathname==='/v2/life/holidays'){
      return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'daylist-2026',
        supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/agenda'||parsed.pathname==='/v2/life/today'||parsed.pathname==='/v2/life/upcoming'){
      const view=parsed.pathname.endsWith('today')?'TODAY':parsed.pathname.endsWith('upcoming')?'UPCOMING':'AGENDA';
      return json({view,as_of:'2026-09-12T00:00:00+09:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:ITEMS,ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/attention'){
      return json({view:'ATTENTION',as_of:'2026-09-12T00:00:00+09:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/unscheduled'){
      return json({view:'UNSCHEDULED',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/expense-summary'){
      return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-12T00:00:00+09:00',timezone:'Asia/Seoul',
        start_date:'2026-09-01',end_date:'2026-09-30',coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',
        currencies:[],entries_without_amount:0,ai_calls:0,provider_api_calls:0});
    }
    return json({items:[]});
  };
}

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js');
  const root=document.getElementById('calendar-root');
  manager.mountLifeCalendarManager({
    root,sessionToken:'tok_daylist_fixture',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-12T03:00:00+09:00'),
    fetchImpl:stubFetch(),
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });

  await wait(()=>root.querySelector('.calendar-month'),'month grid');
  await wait(()=>root.getAttribute('aria-busy')!=='true'&&!root.querySelector('[aria-busy="true"]'),'calendar idle');

  // Press the day the stay begins, the way the owner would.
  const trigger=await wait(()=>root.querySelector('[data-calendar-date-trigger="2026-09-12"]'),'the 12th');
  click(trigger);

  const panel=await wait(()=>{const n=root.querySelector('.calendar-day-panel');return n&&!n.hidden?n:null},'day panel');
  const list=await wait(()=>panel.querySelector('.calendar-day-list'),'day list: panel="'+panel.innerText.slice(0,200)+'" status="'+(root.querySelector('.calendar-status')?.textContent||'')+'" paths='+JSON.stringify(SEEN));
  await wait(()=>list.querySelectorAll('.calendar-day-event').length>=3,'three entries');

  const rows=[...list.querySelectorAll('.calendar-day-event')].map(li=>({
    time:li.querySelector('time')?.textContent||'',
    title:li.querySelector('strong')?.textContent||'',
    meta:li.querySelector('small')?.textContent||'',
    label:li.getAttribute('aria-label')||'',
  }));

  out.textContent=JSON.stringify({ok:true,rows});
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

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('daylist-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},50000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=55000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}`);
  return v;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const v = run(browser, w, h);
    const label = `${w}x${h}`;
    const find = title => v.rows.find(r => r.title === title);

    const stay = find('라마다 프라자 호텔 자은도 숙박');
    if (!stay) throw new Error(`${label}: the stay must be listed on the day it begins, got ${JSON.stringify(v.rows.map(r => r.title))}`);
    // The line 대표님 asked for.
    if (!stay.meta.includes('09/12 15:00 → 09/13 11:00')) {
      throw new Error(`${label}: the stay must say when it ends — expected "09/12 15:00 → 09/13 11:00", got "${stay.meta}"`);
    }
    // The time column still shows where it starts, as it always did.
    if (stay.time !== '15:00') throw new Error(`${label}: the stay must start at 15:00 in the time column, got "${stay.time}"`);
    // A screen reader hears the same thing a sighted owner reads.
    if (!stay.label.includes('09/12 15:00 → 09/13 11:00')) {
      throw new Error(`${label}: the accessible name must carry the span too, got "${stay.label}"`);
    }

    // Two dates and no clock: days, never invented hours.
    const trip = find('제주 여행');
    if (!trip) throw new Error(`${label}: the multi-day trip must be listed`);
    if (!trip.meta.includes('09/12 → 09/15')) {
      throw new Error(`${label}: a dateless range must show days — expected "09/12 → 09/15", got "${trip.meta}"`);
    }
    if (/\d{2}:\d{2}/.test(trip.meta)) throw new Error(`${label}: a trip with no stated clock time must not show one, got "${trip.meta}"`);

    // And the restraint: one moment stays one moment.
    const appointment = find('전주 치과 정기검진');
    if (!appointment) throw new Error(`${label}: the appointment must be listed`);
    if (appointment.meta.includes('→')) {
      throw new Error(`${label}: an ordinary appointment must not grow an ending, got "${appointment.meta}"`);
    }
    if (appointment.time !== '10:30') throw new Error(`${label}: the appointment must show 10:30, got "${appointment.time}"`);

    console.log(label, JSON.stringify(v.rows.map(r => `${r.time} | ${r.title} | ${r.meta}`)));
  }
  console.log('CALENDAR DAY LIST RANGE 01 PASS — a stay shows 09/12 15:00 → 09/13 11:00 in the day list and its accessible name, a dateless multi-day booking shows days without invented hours, and an ordinary appointment keeps its single time.');
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
