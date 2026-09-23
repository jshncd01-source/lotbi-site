// Screenshots the Calendar month view with the 기상청 attribution line, inside
// the real modal markup and stylesheets, at desktop and mobile sizes.
//
// Not a gate — a look. 공공누리 제1유형 obliges the credit to be there; the
// product obliges it not to outgrow the forecast it credits. Only a picture
// settles the second one, so this prints the credit's geometry next to the
// forecast icon's alongside each capture.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-weather-shot-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const PORT = 4204;
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

// The forecast Production actually returned for 전주 on this date: five days of
// 단기예보. Round numbers would hide how the line behaves with real values.
const ISSUED = '2026-09-22T23:00:00Z';
const WEATHER = [
  ['2026-09-22', 'CLEAR', '☀️'],
  ['2026-09-23', 'CLOUDY', '☁️'],
  ['2026-09-24', 'RAIN', '🌧️'],
  ['2026-09-25', 'SNOW', '❄️'],
  ['2026-09-26', 'CLOUDY', '☁️'],
].map(([date, weather_kind, weather_icon]) => ({
  date, weather_kind, weather_icon, source: 'KMA_SHORT', issued_at: ISSUED,
  temperature_c: null, min_temperature_c: null, max_temperature_c: null,
  precipitation_probability: null, freshness: 'CACHE_VALID',
}));

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- The same stylesheets index.html loads, in the same order. -->
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-hardening.css">
<link rel="stylesheet" href="/site-avatar.css">
<link rel="stylesheet" href="/site-sidebar-nav.css">
<link rel="stylesheet" href="/site-auth-continuity.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
<link rel="stylesheet" href="/site-calendar-weather.css">
<link rel="stylesheet" href="/footer-business-info.css">
<link rel="stylesheet" href="/mobile-entry.css">
<link rel="stylesheet" href="/home-bare-white.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-conversation.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated" style="margin:0">
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
const WEATHER=${JSON.stringify(WEATHER)};
const stub=url=>{
  const p=new URL(String(url),location.origin);
  if(p.pathname==='/v2/life/weather'||p.pathname==='/v2/life/weather/public')
    return json({provider_ready:true,items:WEATHER,ai_calls:0});
  if(p.pathname==='/v2/life/expense-summary')return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',
    timezone:'Asia/Seoul',start_date:p.searchParams.get('start'),end_date:p.searchParams.get('end'),
    coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',currencies:[],entries_without_amount:0,ai_calls:0,provider_api_calls:0});
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
  const manager=await import('/site-calendar-manager.js?v=20260923-regionlist2');
  const root=document.querySelector('.site-modal-content');
  manager.mountLifeCalendarManager({root,sessionToken:'tok_shot_fixture',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),fetchImpl:stub,
    weatherLocation:{latitude:35.8345,longitude:127.1057},
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}}});
  await wait(()=>root.querySelector('[data-calendar-weather-credit]'),'credit line');
  await new Promise(r=>setTimeout(r,120));
  const credit=root.querySelector('[data-calendar-weather-credit]');
  const box=credit.getBoundingClientRect();
  const icon=root.querySelector('.calendar-weather-icon');
  const iconBox=icon.getBoundingClientRect();
  const cell=root.querySelector('.calendar-date-cell').getBoundingClientRect();
  out.textContent=JSON.stringify({ok:true,
    viewport:{width:innerWidth,height:innerHeight},
    text:credit.textContent,
    creditTop:Math.round(box.top),creditBottom:Math.round(box.bottom),creditHeight:Math.round(box.height),
    creditFontSize:getComputedStyle(credit).fontSize,
    creditColor:getComputedStyle(credit).color,
    iconCount:root.querySelectorAll('.calendar-weather-icon').length,
    iconFontSize:getComputedStyle(icon).fontSize,
    iconHeight:Math.round(iconBox.height),
    cellHeight:Math.round(cell.height),
    monthBottom:Math.round(document.querySelector('.calendar-month-layout').getBoundingClientRect().bottom),
    belowMonthGrid:box.top>=document.querySelector('.calendar-month-grid').getBoundingClientRect().top,
    clippedByModal:(()=>{const c=document.querySelector('.site-modal-content').getBoundingClientRect();
      return box.bottom>c.bottom+1})(),
    visibleWithoutScrolling:box.bottom<=innerHeight&&box.top>=0,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    sheetRect:(()=>{const n=document.querySelector('.calendar-day-panel');if(!n)return null;const r=n.getBoundingClientRect();
      return {top:Math.round(r.top),bottom:Math.round(r.bottom),position:getComputedStyle(n).position}})(),
    occludedBySheet:(()=>{const n=document.querySelector('.calendar-day-panel');if(!n)return false;
      const r=n.getBoundingClientRect();return getComputedStyle(n).position==='fixed'&&r.top<box.bottom&&r.bottom>box.top})(),
    expenseRect:(()=>{const n=document.querySelector('.calendar-expense-summary');if(!n)return null;const r=n.getBoundingClientRect();
      return {top:Math.round(r.top),bottom:Math.round(r.bottom)}})(),
    viewportRect:(()=>{const r=document.querySelector('.calendar-viewport').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom)}})(),
    shellRect:(()=>{const r=document.querySelector('.calendar-product-shell').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom)}})(),
    topmostAtCredit:(()=>{const el=document.elementFromPoint(Math.min(box.right-4,innerWidth-4),Math.round((box.top+box.bottom)/2));
      return el?(el.className&&el.className.toString?el.className.toString():el.tagName):'none'})()});
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
const DEBUG_PORT = 9342;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Device metrics over --window-size: headless Chrome clamps the window to a
// minimum width, which silently turns a 390px capture into 500px.
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

  for (const [label, width, height, mobile] of [['desktop-1440x900', 1440, 900, false], ['mobile-390x844', 390, 844, true], ['mobile-360x780', 360, 780, true]]) {
    // SHOT_SCALE 로 확대 캡처. 14px 글리프는 1배 캡처에서 눈으로 판정할 수
    // 없어서, 모양을 볼 때만 올려 찍습니다.
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: Number(process.env.SHOT_SCALE) || 1, mobile});
    await send('Page.navigate', {url: ORIGIN + '/' + INNER_REL});
    await sleep(5000);
    const probe = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `document.getElementById('shot-result').textContent`,
    });
    console.log(label, probe.result.value);
    const shot = await send('Page.captureScreenshot', {format: 'png'});
    const file = path.join(OUT, `calendar-weather-credit-${label}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('  ->', file);
  }
  ws.close();
} finally {
  chrome.kill();
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
}
