// Locks the Calendar weather glyph: an inline SVG that can actually be read,
// and that still knows its place.
//
// Why it replaced the emoji: the same codepoint is drawn by each OS's own font,
// so ☁️ arrived pale and thin on one device and heavy on another. Four surfaces
// could not be made to show the same picture. That was the root cause of
// "날씨가 흐리게 보인다", not the pixel size.
//
// Covered contracts:
//   - every kind renders <svg class="calendar-weather-icon"> with its kind,
//     and the provider emoji never reaches the date cell as text
//   - the glyph is never larger than the date number it sits beside
//   - it is not smaller than 12px either — legibility has a floor
//   - the four kinds are visually distinct from one another, by shape AND colour
//   - the body colour clears 3:1 against the date cell it sits on
//     (WCAG 1.4.11 non-text contrast), in light AND dark
//   - dark theme really re-colours it rather than reusing the light values
//   - the date cell does not grow to make room for it
//   - the glyph stays aria-hidden; the date button's aria-label keeps the words
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
<link rel="stylesheet" href="/site-calendar.css?v=20260923-msgactions2">
<link rel="stylesheet" href="/site-calendar-expense.css?v=20260922-expense1">
<link rel="stylesheet" href="/site-calendar-weather.css?v=20260923-msgactions2">
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

function rgb(value){
  const m=/rgba?\\(([^)]+)\\)/.exec(String(value||''));
  if(!m)return null;
  const parts=m[1].split(',').map(v=>parseFloat(v.trim()));
  if(parts.length<3||parts.some(v=>!Number.isFinite(v)))return null;
  return {r:parts[0],g:parts[1],b:parts[2],a:parts.length>3?parts[3]:1};
}
function luminance({r,g,b}){
  const channel=v=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4)};
  return 0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
}
function contrast(a,b){
  if(!a||!b)return 0;
  const l1=luminance(a),l2=luminance(b);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
}
function backdrop(node){
  let el=node;
  while(el&&el!==document.documentElement){
    const value=rgb(getComputedStyle(el).backgroundColor);
    if(value&&value.a>0)return value;
    el=el.parentElement;
  }
  return {r:255,g:255,b:255,a:1};
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
    const svg=root.querySelector('.calendar-weather-icon[data-weather-kind="'+kind+'"]');
    if(!svg)throw new Error('missing glyph for '+kind);
    const cell=svg.closest('.calendar-date-cell');
    const number=cell.querySelector('.calendar-date-number');
    const box=svg.getBoundingClientRect();
    const numberBox=number.getBoundingClientRect();
    const body=svg.querySelector('[data-weather-part="body"]');
    const accent=svg.querySelector('[data-weather-part="ray"],[data-weather-part="rain"],[data-weather-part="snow"]');
    const bodyFill=rgb(getComputedStyle(body).fill);
    const accentStyle=accent?getComputedStyle(accent):null;
    const accentColor=accent?(rgb(accentStyle.stroke)||rgb(accentStyle.fill)):null;
    const behind=backdrop(cell);
    per[kind]={
      tag:svg.tagName.toLowerCase(),
      ariaHidden:svg.getAttribute('aria-hidden'),
      titleText:svg.querySelector('title')?.textContent||'',
      shapeCount:svg.querySelectorAll('circle,rect,path').length,
      shapeSignature:[...svg.querySelectorAll('circle,rect,path')]
        .map(n=>n.tagName.toLowerCase()+':'+(n.getAttribute('d')||n.getAttribute('cx')||n.getAttribute('x')||'')).join('|'),
      width:Math.round(box.width*100)/100,
      height:Math.round(box.height*100)/100,
      numberHeight:Math.round(numberBox.height*100)/100,
      numberWidth:Math.round(numberBox.width*100)/100,
      cellHeight:Math.round(cell.getBoundingClientRect().height*100)/100,
      bodyFill:bodyFill?[bodyFill.r,bodyFill.g,bodyFill.b].join(','):null,
      accentColor:accentColor?[accentColor.r,accentColor.g,accentColor.b].join(','):null,
      bodyContrast:Math.round(contrast(bodyFill,behind)*100)/100,
      accentContrast:accentColor?Math.round(contrast(accentColor,behind)*100)/100:null,
      // 토요일 칸은 격자의 오른쪽 끝이고 .calendar-month-grid 는 overflow:hidden
      // 이다. 글리프가 칸을 넘으면 그 열에서만 잘려 보인다.
      clippedByCell:(()=>{const c=cell.getBoundingClientRect();
        return box.right>c.right+0.5||box.left<c.left-0.5||box.bottom>c.bottom+0.5||box.top<c.top-0.5})(),
      lastColumn:[...cell.parentElement.children].indexOf(cell)%7===6,
      ariaLabel:cell.querySelector('.calendar-date-trigger')?.getAttribute('aria-label')||'',
      emojiInHeader:/[\\u2600\\u2601\\u2744]|\\uD83C\\uDF27/.test(cell.querySelector('.calendar-date-header').textContent||''),
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
  const manager=await import('/site-calendar-manager.js?v=20260923-msgactions2');
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
        if (glyph.tag !== 'svg') throw new Error(`${label}/${theme}: ${kind} must be an inline SVG, got <${glyph.tag}>`);
        if (glyph.emojiInHeader) throw new Error(`${label}/${theme}: ${kind} date cell still carries the provider emoji as text`);
        if (glyph.ariaHidden !== 'true') throw new Error(`${label}/${theme}: ${kind} glyph must stay aria-hidden — the date button already says the weather`);
        if (!glyph.ariaLabel.includes(`날씨 ${LABELS[kind]}`)) throw new Error(`${label}/${theme}: ${kind} lost its accessible name, got "${glyph.ariaLabel}"`);
        if (glyph.titleText !== LABELS[kind]) throw new Error(`${label}/${theme}: ${kind} lost its hover title, got "${glyph.titleText}"`);

        // 날씨는 보조 정보다. 날짜보다 커지면 안 된다.
        if (glyph.height > glyph.numberHeight + 0.5) throw new Error(`${label}/${theme}: ${kind} glyph (${glyph.height}px) must not be taller than the date number (${glyph.numberHeight}px)`);
        // 그렇다고 안 보일 만큼 작아도 안 된다.
        if (glyph.height < 12) throw new Error(`${label}/${theme}: ${kind} glyph is ${glyph.height}px — below the legibility floor`);

        // WCAG 1.4.11 non-text contrast.
        if (glyph.clippedByCell) throw new Error(`${label}/${theme}: ${kind} glyph is clipped by its date cell — the grid hides the overflow, so it loses part of the picture`);
        if (glyph.bodyContrast < 3) throw new Error(`${label}/${theme}: ${kind} body colour is ${glyph.bodyContrast}:1 against the date cell — under 3:1`);
        if (glyph.accentContrast !== null && glyph.accentContrast < 3) throw new Error(`${label}/${theme}: ${kind} accent colour is ${glyph.accentContrast}:1 — under 3:1`);
      }

      // 네 종류가 서로 구별돼야 한다. 색만으로는 부족하고 모양이 달라야 한다.
      // 마지막 열(토요일)은 격자의 잘리는 가장자리다. 그 칸이 표본에 없으면
      // 위 clippedByCell 검사는 아무것도 지키지 못한다.
      if (!KINDS.some(kind => per[kind].lastColumn)) throw new Error(`${label}/${theme}: the fixture must place one glyph in the grid's last column`);
      const shapes = new Set(KINDS.map(kind => per[kind].shapeSignature));
      if (shapes.size !== 4) throw new Error(`${label}/${theme}: the four kinds must be told apart by shape, got ${shapes.size} distinct outlines`);
      const paints = new Set(KINDS.map(kind => `${per[kind].bodyFill}/${per[kind].accentColor}`));
      if (paints.size !== 4) throw new Error(`${label}/${theme}: the four kinds must be told apart by colour too, got ${paints.size} distinct palettes`);
    }

    // 다크 테마가 실제로 다시 칠하는지. 라이트 값을 그대로 쓰면 실패다.
    for (const kind of KINDS) {
      if (value.light[kind].bodyFill === value.dark[kind].bodyFill) {
        throw new Error(`${label}: ${kind} uses the same body colour in dark as in light (${value.light[kind].bodyFill}) — the dark override is not reaching it`);
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
