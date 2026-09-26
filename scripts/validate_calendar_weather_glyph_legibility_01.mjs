// Locks the Calendar weather glyph: the real provider emoji (☀️/☁️/🌧️/❄️),
// rendered as text, in the date cell — and that it still knows its place.
//
// This used to be a hand-drawn inline SVG instead of the emoji, specifically
// to dodge each OS/browser drawing the same codepoint differently. That
// tradeoff was reverted on explicit product direction: show the same
// character Core sends as weather_icon, not a redrawn shape. The known
// cost — emoji can still render with different weight/color per platform —
// is accepted; this file no longer polices shape or colour, only that the
// right character reaches the right place with the right accessible name.
//
// Covered contracts:
//   - every kind renders <span class="calendar-weather-icon" data-weather-kind>
//     whose text is exactly WEATHER_ICONS[kind] — the same value the
//     transport contract already validates (normalizeCalendarWeatherResponse)
//   - desktop uses a clearly visible ~22px glyph; narrow mobile cells retain
//     a compact 15px glyph inside the upper-right weather summary
//   - the four kinds are told apart because they are four different
//     characters, and no two kinds ever render the same character
//   - the date cell does not grow to make room for it
//   - the glyph stays aria-hidden; the date button's aria-label keeps the
//     words; hovering the glyph itself still surfaces the label via title
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-weather-glyph-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-weather-glyph-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4205;
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
<link rel="stylesheet" href="/site-calendar.css?v=20260924-mapdeeplink1">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
<link rel="stylesheet" href="/site-calendar-weather.css?v=20260923-daysheet3">
<link rel="stylesheet" href="/site-theme-tokens.css?v=20260922-darkcontrast2">
</head><body style="margin:0">
<div id="calendar-root"></div>
<pre id="glyph-result">pending</pre>
<script type="module">
const out=document.getElementById('glyph-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},35000);
const wait=async(fn,label)=>{stage=label;for(let i=0;i<250;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};

const ISSUED='2026-09-22T23:00:00Z';
const ICONS={CLEAR:'\\u2600\\uFE0F',CLOUDY:'\\u2601\\uFE0F',RAIN:'\\uD83C\\uDF27\\uFE0F',SNOW:'\\u2744\\uFE0F'};
const KINDS=['CLEAR','CLOUDY','RAIN','SNOW'];
const WEATHER=KINDS.map((kind,index)=>({
  date:'2026-09-2'+(3+index),weather_kind:kind,weather_icon:ICONS[kind],
  source:'KMA_SHORT',issued_at:ISSUED,
  temperature_c:null,min_temperature_c:null,max_temperature_c:null,
  precipitation_probability:null,freshness:'CACHE_VALID',
}));

function stubFetch(weather){
  const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
  return url=>{
    const p=new URL(String(url),location.origin);
    if(p.pathname==='/v2/life/weather'||p.pathname==='/v2/life/weather/public')
      return json({provider_ready:true,items:weather,ai_calls:0});
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
}

async function mountCase(manager){
  const root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken:'tok_glyph_fixture',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    weatherLocation:{latitude:37.5665,longitude:126.978},
    fetchImpl:stubFetch(WEATHER),
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  return root;
}

function measure(root){
  const per={};
  for(const kind of KINDS){
    const glyph=root.querySelector('.calendar-weather-icon[data-weather-kind="'+kind+'"]');
    if(!glyph)throw new Error('missing glyph for '+kind);
    const cell=glyph.closest('.calendar-date-cell');
    const box=glyph.getBoundingClientRect();
    const style=getComputedStyle(glyph);
    per[kind]={
      tag:glyph.tagName.toLowerCase(),
      text:glyph.textContent,
      ariaHidden:glyph.getAttribute('aria-hidden'),
      titleText:glyph.title||glyph.getAttribute('title')||'',
      fontSize:Math.round(parseFloat(style.fontSize)*100)/100,
      width:Math.round(box.width*100)/100,
      height:Math.round(box.height*100)/100,
      cellHeight:Math.round(cell.getBoundingClientRect().height*100)/100,
      // 토요일 칸은 격자의 오른쪽 끝이고 .calendar-month-grid 는 overflow:hidden
      // 이다. 글리프가 칸을 넘으면 그 열에서만 잘려 보인다.
      clippedByCell:(()=>{const c=cell.getBoundingClientRect();
        return box.right>c.right+0.5||box.left<c.left-0.5||box.bottom>c.bottom+0.5||box.top<c.top-0.5})(),
      lastColumn:[...cell.parentElement.children].indexOf(cell)%7===6,
      ariaLabel:cell.querySelector('.calendar-date-trigger')?.getAttribute('aria-label')||'',
    };
  }
  return per;
}

try{
  localStorage.clear();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_ok,err)=>{if(typeof err==='function')err({code:1,message:'denied'})},
    watchPosition:()=>0,clearWatch:()=>{},
  }});
  const manager=await import('/site-calendar-manager.js?v=20260924-mapdeeplink1');
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight}};

  let root=await mountCase(manager);
  await wait(()=>root.querySelectorAll('.calendar-weather-icon').length>=4,'light glyphs');
  result.light=measure(root);

  document.body.dataset.siteTheme='dark';
  await new Promise(r=>setTimeout(r,120));
  result.dark=measure(root);
  delete document.body.dataset.siteTheme;
  await new Promise(r=>setTimeout(r,120));

  // 날씨가 없는 달의 셀 높이. 글리프가 격자를 키우면 안 된다.
  root=document.getElementById('calendar-root');
  root.replaceChildren();
  manager.mountLifeCalendarManager({
    root,sessionToken:'tok_glyph_fixture',timezone:'Asia/Seoul',
    now:()=>new Date('2026-09-22T03:00:00+09:00'),
    weatherLocation:{latitude:37.5665,longitude:126.978},
    fetchImpl:stubFetch([]),
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
  });
  await wait(()=>root.querySelector('.calendar-month-grid'),'weatherless month');
  await new Promise(r=>setTimeout(r,120));
  result.weatherlessCellHeight=Math.round(root.querySelector('.calendar-date-cell').getBoundingClientRect().height*100)/100;

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

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('glyph-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
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
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}`);
  return v;
}

const KINDS = ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'];
const LABELS = {CLEAR: '맑음', CLOUDY: '흐림', RAIN: '비', SNOW: '눈'};
const ICONS = {CLEAR: '☀️', CLOUDY: '☁️', RAIN: '🌧️', SNOW: '❄️'};

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[360, 780], [390, 844], [768, 1024], [1280, 900]]) {
    const value = run(browser, w, h);
    const label = `${w}x${h}`;

    for (const theme of ['light', 'dark']) {
      const per = value[theme];
      for (const kind of KINDS) {
        const glyph = per[kind];
        if (glyph.tag !== 'span') throw new Error(`${label}/${theme}: ${kind} must render as <span>, got <${glyph.tag}>`);
        if (glyph.text !== ICONS[kind]) throw new Error(`${label}/${theme}: ${kind} must show the provider emoji ${JSON.stringify(ICONS[kind])}, got ${JSON.stringify(glyph.text)}`);
        if (glyph.ariaHidden !== 'true') throw new Error(`${label}/${theme}: ${kind} glyph must stay aria-hidden — the date button already says the weather`);
        if (!glyph.ariaLabel.includes(`날씨 ${LABELS[kind]}`)) throw new Error(`${label}/${theme}: ${kind} lost its accessible name, got "${glyph.ariaLabel}"`);
        if (glyph.titleText !== LABELS[kind]) throw new Error(`${label}/${theme}: ${kind} lost its hover title, got "${glyph.titleText}"`);

        // 모바일은 오른쪽 위 요약 칸에 맞춘 15px, 데스크톱은 22px.
        const expectedSize = w <= 520 ? 15 : 22;
        if (Math.abs(glyph.fontSize - expectedSize) > 0.5) {
          throw new Error(`${label}/${theme}: ${kind} glyph must be ${expectedSize}px font-size, got ${glyph.fontSize}px`);
        }
        if (glyph.clippedByCell) throw new Error(`${label}/${theme}: ${kind} glyph is clipped by its date cell — the grid hides the overflow, so it loses part of the picture`);
      }

      // 네 종류가 서로 다른 문자여야 한다 — 실수로 같은 kind에 두 emoji가
      // 매핑되면 여기서 잡힌다. 마지막 열(토요일)은 격자의 잘리는 가장자리다.
      // 그 칸이 표본에 없으면 위 clippedByCell 검사는 아무것도 지키지 못한다.
      if (!KINDS.some(kind => per[kind].lastColumn)) throw new Error(`${label}/${theme}: the fixture must place one glyph in the grid's last column`);
      const texts = new Set(KINDS.map(kind => per[kind].text));
      if (texts.size !== 4) throw new Error(`${label}/${theme}: the four kinds must render four distinct characters, got ${texts.size}`);
    }

    // emoji는 자체 색을 가지므로 테마가 문자 자체를 바꿀 이유가 없다 — 라이트/
    // 다크에서 같은 문자를 보여줘야 정상이다.
    for (const kind of KINDS) {
      if (value.light[kind].text !== value.dark[kind].text) {
        throw new Error(`${label}: ${kind} shows a different character in dark (${value.dark[kind].text}) than light (${value.light[kind].text})`);
      }
    }

    // 글리프가 격자를 키우지 않는다.
    const withWeather = value.light.CLEAR.cellHeight;
    if (Math.abs(withWeather - value.weatherlessCellHeight) > 0.5) {
      throw new Error(`${label}: the glyph changed the date cell height (${value.weatherlessCellHeight}px -> ${withWeather}px)`);
    }
  }
  console.log('validate_calendar_weather_glyph_legibility_01: PASS');
} finally {
  server.kill();
  for (const file of [INNER, WRAPPER]) {
    try { fs.unlinkSync(file); } catch {}
  }
}
