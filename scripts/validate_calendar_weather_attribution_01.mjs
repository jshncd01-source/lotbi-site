// Locks the 기상청 attribution line on the Calendar month view.
//
// Why it exists: KMA short/mid forecasts are 공공저작물 opened under
// 공공누리 제1유형, whose single condition is 출처표시
// (https://www.kogl.or.kr/info/licenseType1.do). The forecast is already on
// screen in the date cells, so the credit is an obligation, not decoration.
//
// The opposite failure is just as real: a credit that outgrows the weather it
// credits. So this locks both directions.
//
// Covered contracts:
//   - the credit renders directly under the month grid, inside .calendar-month
//     (layout children 0/1 stay the month and the selected-day surface)
//   - it is not covered by the fixed day sheet that a phone opens by default
//   - it names 기상청 and 공공누리 제1유형
//   - it is one line, smaller than the date-cell text, and shorter than a cell
//   - no weather on screen -> no credit line at all
//   - short+mid mixed -> no single 발표 time is claimed for both
//   - a single forecast source -> 발표 time is shown, in the calendar timezone
//   - year/agenda views carry no credit
//   - a refused weather read leaves the month standing and drops the credit
//   - no horizontal overflow at phone and desktop widths
//   - the wording lives in site-calendar-weather.js, not spelled in the manager
//   - .calendar-month keeps its two explicit desktop rows (the credit uses an
//     implicit row so the Calendar redesign's declaration is untouched)
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-weather-credit-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-weather-credit-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4203;
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
<link rel="stylesheet" href="/site-calendar.css?v=20260923-sysdark1">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
<link rel="stylesheet" href="/site-calendar-weather.css?v=20260923-sysdark1">
<link rel="stylesheet" href="/site-theme-tokens.css?v=20260922-darkcontrast2">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="credit-result">pending</pre>
<script type="module">
const out=document.getElementById('credit-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};

const SHORT_ISSUED='2026-09-22T23:00:00Z';   // KST 08:00
const MID_ISSUED='2026-09-22T09:00:00Z';     // KST 18:00 전일

function day(date,kind,icon,source,issued,extra={}){
  return {date,weather_icon:icon,weather_kind:kind,source,issued_at:issued,
    temperature_c:null,min_temperature_c:null,max_temperature_c:null,
    precipitation_probability:null,freshness:'CACHE_VALID',...extra};
}
const SHORT_ONLY=[
  day('2026-09-22','CLEAR','☀️','KMA_SHORT',SHORT_ISSUED),
  day('2026-09-23','CLOUDY','☁️','KMA_SHORT',SHORT_ISSUED),
  day('2026-09-24','RAIN','🌧️','KMA_SHORT',SHORT_ISSUED),
];
const MIXED=[...SHORT_ONLY,
  day('2026-09-27','CLOUDY','☁️','KMA_MID',MID_ISSUED),
  day('2026-09-28','SNOW','❄️','KMA_MID',MID_ISSUED),
];

// The fixture answers Core itself so the assertions measure rendering, not the
// network. Only the routes the month view touches are served.
function stubFetch({weather=[],weatherStatus=200}){
  const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
  const calls=[];
  const impl=(url)=>{
    const parsed=new URL(String(url),location.origin);
    calls.push(parsed.pathname+parsed.search);
    if(parsed.pathname==='/v2/life/weather'||parsed.pathname==='/v2/life/weather/public'){
      if(weatherStatus!==200){
        return Promise.resolve(new Response(JSON.stringify({code:'NOPE'}),{status:weatherStatus,headers:{'Content-Type':'application/json'}}));
      }
      return json({provider_ready:true,items:weather,ai_calls:0});
    }
    if(parsed.pathname==='/v2/life/agenda'){
      return json({view:'AGENDA',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/attention'){
      return json({view:'ATTENTION',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/holidays'){
      return json({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'x',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    }
    if(parsed.pathname==='/v2/life/expense-summary'){
      return json({view:'EXPENSE_SUMMARY',as_of:'2026-09-22T00:00:00+00:00',timezone:'Asia/Seoul',
        start_date:parsed.searchParams.get('start'),end_date:parsed.searchParams.get('end'),
        coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',currencies:[],entries_without_amount:0,
        ai_calls:0,provider_api_calls:0});
    }
    return json({items:[]});
  };
  impl.calls=calls;
  return impl;
}

function credit(root){return root.querySelector('[data-calendar-weather-credit]')}

async function mountCase(manager,fetchImpl){
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken:'tok_weather_credit_fixture',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    weatherLocation:{latitude:37.5665,longitude:126.978},
    fetchImpl,settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  return root;
}

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=20260923-sysdark1');
  const weatherModule=await import('/site-calendar-weather.js?v=20260923-sysdark1');
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight}};

  // --- short forecast only ---------------------------------------------
  let root=await mountCase(manager,stubFetch({weather:SHORT_ONLY}));
  await wait(()=>credit(root),'short credit');
  let line=credit(root);
  const layout=root.querySelector('.calendar-month-layout');
  result.text=line.textContent;
  const monthSection=root.querySelector('.calendar-month');
  result.creditInsideMonth=monthSection.contains(line);
  result.layoutFirstIsMonth=layout.children[0]?.classList.contains('calendar-month');
  result.layoutSecondIsDayPanel=layout.children[1]?.classList.contains('calendar-day-panel');
  const grid=root.querySelector('.calendar-month-grid');
  // 데스크톱에서 그리드는 제 행 높이를 1px 테두리만큼 넘긴다. 그래서 "그리드
  // 아래"의 기준은 픽셀 동일이 아니라 '텍스트가 그리드 끝 뒤에서 시작하고
  // 그리드보다 아래에서 끝난다'로 잡는다.
  {
    const c=line.getBoundingClientRect(), g=grid.getBoundingClientRect();
    result.creditFollowsMonth=c.top>=g.bottom-4&&c.bottom>g.bottom;
  }

  const creditBox=line.getBoundingClientRect();
  const creditStyle=getComputedStyle(line);
  result.creditHeight=Math.round(creditBox.height);
  result.creditFontSize=parseFloat(creditStyle.fontSize);
  result.creditLineHeight=parseFloat(creditStyle.lineHeight);

  // The credit must stay visually subordinate to the forecast it credits.
  const cell=root.querySelector('.calendar-date-cell');
  const icon=root.querySelector('.calendar-weather-icon');
  result.iconPresent=Boolean(icon);
  result.iconFontSize=icon?parseFloat(getComputedStyle(icon).fontSize):0;
  result.cellHeight=Math.round(cell.getBoundingClientRect().height);

  result.noHorizontalOverflow=document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;

  // A phone opens the day sheet by default, fixed to the bottom of the screen.
  // A credit parked underneath it is a credit that is not on screen.
  const sheet=root.querySelector('.calendar-day-panel');
  const sheetBox=sheet&&!sheet.hidden?sheet.getBoundingClientRect():null;
  result.sheetFixedAndOpen=Boolean(sheetBox)&&getComputedStyle(sheet).position==='fixed'&&sheetBox.height>0;
  result.coveredBySheet=Boolean(result.sheetFixedAndOpen&&sheetBox.top<creditBox.bottom&&sheetBox.bottom>creditBox.top);
  const topmost=(r,fromRight)=>{
    const x=fromRight?Math.max(4,Math.min(r.right-6,innerWidth-4)):Math.max(4,Math.min(r.left+r.width/2,innerWidth-4));
    const el=document.elementFromPoint(x,Math.max(0,Math.min(Math.round((r.top+r.bottom)/2),innerHeight-1)));
    return el?String(el.className||el.tagName):'none';
  };
  result.topmostAtCredit=topmost(creditBox,true);
  // 출처는 날씨와 같은 가시성을 가져야 한다. 시트 백드롭은 날짜 칸까지 똑같이
  // 덮으므로, 기준은 "아무것도 안 덮는다"가 아니라 "날씨보다 더 덮이지 않는다"다.
  result.topmostAtIcon=topmost(icon.getBoundingClientRect(),false);
  result.creditOnScreen=creditBox.top>=0&&creditBox.bottom<=innerHeight;

  // --- short + mid mixed ------------------------------------------------
  root=await mountCase(manager,stubFetch({weather:MIXED}));
  await wait(()=>credit(root),'mixed credit');
  result.mixedText=credit(root).textContent;

  // --- no weather -------------------------------------------------------
  root=await mountCase(manager,stubFetch({weather:[]}));
  await wait(()=>root.querySelector('.calendar-month-grid'),'empty month');
  await new Promise(r=>setTimeout(r,120));
  result.emptyCredit=Boolean(credit(root));
  result.emptyMonthStanding=Boolean(root.querySelector('.calendar-month-grid'));

  // --- refused weather read --------------------------------------------
  root=await mountCase(manager,stubFetch({weather:SHORT_ONLY,weatherStatus:403}));
  await wait(()=>root.querySelector('.calendar-month-grid'),'refused month');
  await new Promise(r=>setTimeout(r,120));
  result.refusedCredit=Boolean(credit(root));
  result.refusedMonthStanding=Boolean(root.querySelector('.calendar-month-grid'));
  result.refusedRootVisible=root.children.length>0;

  // --- other views ------------------------------------------------------
  root=await mountCase(manager,stubFetch({weather:SHORT_ONLY}));
  await wait(()=>credit(root),'month before switch');
  root.querySelector('[data-calendar-mode="year"]').click();
  await wait(()=>root.dataset.calendarManagerView==='year','year view');
  await new Promise(r=>setTimeout(r,120));
  result.yearCredit=Boolean(credit(root));

  // --- the pure helper --------------------------------------------------
  result.helperEmpty=weatherModule.calendarWeatherAttribution([]);
  result.helperNonKma=weatherModule.calendarWeatherAttribution([{source:'OPENAI_GUESS',issuedAt:SHORT_ISSUED}]);
  result.helperSeoul=weatherModule.calendarWeatherAttribution(
    [{source:'KMA_SHORT',issuedAt:SHORT_ISSUED}],{timezone:'Asia/Seoul'}).issuedLabel;
  result.helperUtc=weatherModule.calendarWeatherAttribution(
    [{source:'KMA_SHORT',issuedAt:SHORT_ISSUED}],{timezone:'UTC'}).issuedLabel;

  out.textContent=JSON.stringify(result);
}catch(e){const r=document.getElementById('calendar-root');out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),diag:{credit:r?.querySelector('[data-calendar-weather-credit]')?.textContent||null,status:r?.querySelector('.calendar-status')?.textContent||''},viewport:{width:innerWidth,height:innerHeight}})}
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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('credit-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
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
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error} ${JSON.stringify(v.diag || {})}`);
  return v;
}

// Static contracts -------------------------------------------------------
{
  const manager = fs.readFileSync('site-calendar-manager.js', 'utf8');
  if (!manager.includes('calendarWeatherAttribution')) {
    throw new Error('the manager must build the credit from calendarWeatherAttribution');
  }
  // One place owns the wording. A second copy is how a credit drifts out of
  // agreement with the licence it is claiming.
  for (const literal of ["'기상청'", '"기상청"', "'공공누리 제1유형'", '"공공누리 제1유형"']) {
    if (manager.includes(literal)) {
      throw new Error(`site-calendar-manager.js must not spell the attribution itself (${literal}) — it comes from site-calendar-weather.js`);
    }
  }

  const weather = fs.readFileSync('site-calendar-weather.js', 'utf8');
  if (!weather.includes('kogl.or.kr/info/licenseType1.do')) {
    throw new Error('site-calendar-weather.js must cite the 공공누리 제1유형 source it is honouring');
  }

  // The credit gets an implicit fifth row. The Calendar redesign and the
  // expense bar both hold .calendar-product-shell's grid-template-rows, so it
  // must stay exactly as they left it.
  const calendarCss = fs.readFileSync('site-calendar.css', 'utf8');
  if (!calendarCss.includes('grid-template-rows: auto auto minmax(0, 1fr) auto;')) {
    throw new Error('.calendar-product-shell must keep its four explicit rows');
  }
  if (!calendarCss.includes('grid-template-rows: auto minmax(0, 1fr);')) {
    throw new Error('.calendar-month must keep its two explicit desktop rows — the weather credit uses an implicit row instead');
  }
  const creditCss = fs.readFileSync('site-calendar-weather.css', 'utf8');
  if (!/\.calendar-weather-credit\s*\{[^}]*grid-row:\s*3/.test(creditCss)) {
    throw new Error('the credit must place itself on row 3 rather than changing .calendar-month\'s template');
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

    // Placement.
    if (!value.creditInsideMonth) throw new Error(`${label}: the credit must sit inside .calendar-month, with the grid it credits`);
    if (!value.layoutFirstIsMonth) throw new Error(`${label}: month layout child 0 must stay the month grid`);
    if (!value.layoutSecondIsDayPanel) throw new Error(`${label}: month layout child 1 must stay the selected-day surface`);
    if (!value.creditFollowsMonth) throw new Error(`${label}: the credit must render below the month grid`);
    if (value.coveredBySheet) throw new Error(`${label}: the credit must not sit under the day sheet a phone opens by default — it would be an obligation that is not on screen`);
    if (!value.creditOnScreen) throw new Error(`${label}: the credit must be on screen without scrolling`);
    if (!value.topmostAtCredit.includes('calendar-weather-credit') && value.topmostAtCredit !== value.topmostAtIcon) {
      throw new Error(`${label}: the credit must be no more covered than the forecast it credits — credit sits under "${value.topmostAtCredit}" while the icon sits under "${value.topmostAtIcon}"`);
    }

    // 공공누리 제1유형 — the obligation itself.
    if (!value.text.includes('기상청')) throw new Error(`${label}: the credit must name 기상청, got "${value.text}"`);
    if (!value.text.includes('공공누리 제1유형')) throw new Error(`${label}: the credit must name the licence, got "${value.text}"`);

    // ...and the opposite failure: a credit bigger than the weather.
    if (!value.iconPresent) throw new Error(`${label}: the fixture must actually render weather for the credit to sit under`);
    if (value.creditFontSize > value.iconFontSize) throw new Error(`${label}: the credit must not be set larger than the forecast icon (${value.creditFontSize}px vs ${value.iconFontSize}px)`);
    if (value.creditHeight > value.creditLineHeight * 1.5) throw new Error(`${label}: the credit must stay one line, got ${value.creditHeight}px for a ${value.creditLineHeight}px line`);
    if (value.creditHeight >= value.cellHeight) throw new Error(`${label}: the credit must be shorter than a single date cell (${value.creditHeight}px vs ${value.cellHeight}px)`);
    if (!value.noHorizontalOverflow) throw new Error(`${label}: the credit must not cause horizontal overflow`);

    // 발표 시각: claimed only when it is true of everything on screen.
    if (!value.text.includes('08:00')) throw new Error(`${label}: a single-source month must show the 발표 time in the calendar timezone, got "${value.text}"`);
    if (value.mixedText.includes('발표')) throw new Error(`${label}: 단기와 중기가 섞이면 한쪽 발표 시각을 전체의 것으로 적으면 안 됩니다, got "${value.mixedText}"`);
    if (!value.mixedText.includes('기상청')) throw new Error(`${label}: a mixed month must still carry the credit, got "${value.mixedText}"`);

    // No weather -> no credit. The credit never outlives its subject.
    if (value.emptyCredit) throw new Error(`${label}: a month with no forecast must carry no credit line`);
    if (!value.emptyMonthStanding) throw new Error(`${label}: a month with no forecast must still render`);

    // 네가 실패해도 본체는 살아야 한다.
    if (value.refusedCredit) throw new Error(`${label}: a refused weather read must not leave a credit with nothing to credit`);
    if (!value.refusedMonthStanding) throw new Error(`${label}: a refused weather read must leave the month grid standing`);
    if (!value.refusedRootVisible) throw new Error(`${label}: a refused weather read must not empty the Calendar root`);

    if (value.yearCredit) throw new Error(`${label}: the year view shows no forecast, so it must carry no credit`);

    // The pure helper.
    if (value.helperEmpty !== null) throw new Error(`${label}: no items must yield no attribution`);
    if (value.helperNonKma !== null) throw new Error(`${label}: a non-KMA source must not be credited to 기상청`);
    if (value.helperSeoul !== '08:00') throw new Error(`${label}: KST 발표 time must read 08:00, got ${value.helperSeoul}`);
    if (value.helperUtc !== '23:00') throw new Error(`${label}: the 발표 time must follow the calendar timezone, got ${value.helperUtc} for UTC`);
  }
  console.log('validate_calendar_weather_attribution_01: PASS');
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) {
    try { fs.unlinkSync(file); } catch {}
  }
}
