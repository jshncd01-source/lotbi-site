import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-month-geometry-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-month-geometry-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4193;
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
<link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-calendar.css?v=20260921-calgeom1">
<link rel="stylesheet" href="/site-conversation.css">
</head><body>
<pre id="geometry-result">pending</pre>
<script type="module">
const out=document.getElementById('geometry-result');
window.addEventListener('error',event=>{if(out.textContent==='pending')out.textContent=JSON.stringify({ok:false,error:'window '+event.message})});
window.addEventListener('unhandledrejection',event=>{if(out.textContent==='pending')out.textContent=JSON.stringify({ok:false,error:'rejection '+String(event.reason?.stack||event.reason)})});
const wait=async(fn,label)=>{for(let i=0;i<120;i+=1){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const noX=node=>node.scrollWidth<=node.clientWidth+1;
let createGuestCalendarRepository;
let mountLifeCalendarManager;

function makeModal(){
  const backdrop=document.createElement('div');
  backdrop.className='site-modal-backdrop';
  const modal=document.createElement('section');
  modal.className='site-modal site-calendar-modal';
  const header=document.createElement('header');
  header.className='site-modal-header';
  const heading=document.createElement('h2');
  heading.textContent='캘린더';
  const close=document.createElement('button');
  close.className='site-modal-close';
  close.type='button';
  close.textContent='×';
  header.append(heading,close);
  const description=document.createElement('p');
  description.className='site-modal-description';
  description.textContent='일정을 한눈에 확인하고 관리합니다.';
  const root=document.createElement('div');
  root.className='site-modal-content';
  modal.append(header,description,root);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return {backdrop,modal,root};
}

function addFive(repo,date){
  for(let i=0;i<5;i+=1){
    const hour=9+Math.floor(i/2);
    const minute=i%2===0?'00':'30';
    repo.create({
      title:['치과','고객 미팅','미용실','저녁 약속','자동차 검사'][i],
      local_date:date,
      local_datetime:date+'T'+String(hour).padStart(2,'0')+':'+minute+':00',
      all_day:false,
    });
  }
}

async function measure({nowIso,date,label,weeks}){
  const values=new Map();
  const storage={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
  };
  const repo=createGuestCalendarRepository(storage);
  addFive(repo,date);
  const {backdrop,modal,root}=makeModal();
  await mountLifeCalendarManager({
    root,
    initialView:'month',
    timezone:'Asia/Seoul',
    now:new Date(nowIso),
    guestRepository:repo,
  });
  await wait(()=>root.dataset.calendarManagerView==='month'&&root.querySelector('.calendar-month-grid'),'month '+label);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  const grid=root.querySelector('.calendar-month-grid');
  const cells=[...grid.querySelectorAll('.calendar-date-cell')];
  const target=root.querySelector('[data-calendar-date="'+date+'"]');
  const rows=[...target.querySelectorAll('.calendar-event-chip')];
  const more=target.querySelector('.calendar-event-overflow');
  const visible=rows.filter(row=>!row.hidden&&getComputedStyle(row).display!=='none').length;
  const hiddenCount=more&&!more.hidden&&getComputedStyle(more).display!=='none'?Number(more.dataset.hiddenCount||0):0;
  const heights=cells.map(node=>node.getBoundingClientRect().height);
  const spread=heights.length?Math.max(...heights)-Math.min(...heights):0;
  const cellHeight=target.getBoundingClientRect().height;
  const contentRect=root.getBoundingClientRect();
  const contentStyle=getComputedStyle(root);
  const gridRect=grid.getBoundingClientRect();
  const innerBottom=contentRect.bottom-(parseFloat(contentStyle.paddingBottom)||0);
  const unusedBottom=Math.max(0,Math.round(innerBottom-gridRect.bottom));
  const weekCount=Number(grid.dataset.weekCount||0);

  if(weekCount!==weeks)throw new Error(label+' week count '+weekCount+' expected '+weeks);
  if(cells.length!==weeks*7)throw new Error(label+' cell count '+cells.length);
  if(spread>2)throw new Error(label+' unequal row heights '+spread);
  if(unusedBottom>4)throw new Error(label+' unused lower space '+unusedBottom+'px');
  if(!noX(modal)||!noX(root)||!noX(grid))throw new Error(label+' horizontal overflow');
  if(getComputedStyle(modal).overflowY!=='hidden')throw new Error(label+' modal must not scroll');
  if(getComputedStyle(root).overflowY!=='hidden')throw new Error(label+' month content must not scroll');
  if(modal.scrollHeight>modal.clientHeight+1)throw new Error(label+' modal double scroll');
  if(rows.length!==5||visible+hiddenCount!==5)throw new Error(label+' five-event accounting '+visible+'+'+hiddenCount);
  if(cellHeight>=130&&visible<3)throw new Error(label+' five-event density too sparse '+cellHeight+'px visible '+visible);
  if(cellHeight>=156&&visible<5)throw new Error(label+' should show all five at '+cellHeight+'px, visible '+visible);

  const result={label,weeks,cellHeight,visible,hiddenCount,unusedBottom,gridHeight:gridRect.height,modalHeight:modal.getBoundingClientRect().height};
  backdrop.remove();
  return result;
}

try{
  ({createGuestCalendarRepository}=await import('/site-calendar-guest.js?v=20260921-convcal2'));
  ({mountLifeCalendarManager}=await import('/site-calendar-manager.js?v=20260921-convcal2'));
  const cases={
    feb:{nowIso:'2026-02-15T12:00:00+09:00',date:'2026-02-15',label:'2026-02 4-week',weeks:4},
    sep:{nowIso:'2026-09-15T12:00:00+09:00',date:'2026-09-15',label:'2026-09 5-week',weeks:5},
    may:{nowIso:'2026-05-15T12:00:00+09:00',date:'2026-05-15',label:'2026-05 6-week',weeks:6},
  };
  const key=new URLSearchParams(location.search).get('case')||'sep';
  if(!cases[key])throw new Error('unknown geometry case '+key);
  const result=await measure(cases[key]);
  out.textContent=JSON.stringify({ok:true,viewport:{width:innerWidth,height:innerHeight},result});
}catch(error){
  out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error),viewport:{width:innerWidth,height:innerHeight}});
}
<\/script></body></html>`;

function waitServer(){
  for(let i=0;i<50;i+=1){
    const probe=spawnSync('curl',['--fail','--silent',ORIGIN+'/'],{timeout:1000});
    if(probe.status===0)return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w,h){
  const frame=(id)=>'<iframe data-case="'+id+'" src="/'+INNER_REL+'?case='+id+'" width="'+w+'" height="'+h+'" style="display:block;border:0"></iframe>';
  return '<!doctype html><html><body style="margin:0">'+['feb','sep','may'].map(frame).join('')+'<pre id="result">pending</pre><script>'+
    'const out=document.getElementById("result"),frames=[...document.querySelectorAll("iframe[data-case]")];'+
    'const timer=setInterval(()=>{try{const texts=frames.map(frame=>frame.contentDocument?.getElementById("geometry-result")?.textContent||"pending");'+
    'if(texts.every(value=>value!=="pending")){const values=texts.map(JSON.parse);const failed=values.find(value=>!value.ok);'+
    'out.textContent=failed?JSON.stringify({ok:false,error:failed.error}):JSON.stringify({ok:true,viewport:{width:'+w+',height:'+h+'},results:values.map(value=>value.result)});clearInterval(timer)}}'+
    'catch(error){out.textContent=JSON.stringify({ok:false,error:String(error)});clearInterval(timer)}},25);'+
    'setTimeout(()=>{if(out.textContent==="pending"){out.textContent=JSON.stringify({ok:false,error:"wrapper timeout"});clearInterval(timer)}},9000);'+
    '<\\/script></body></html>';
}

function run(browser,w,h){
  fs.writeFileSync(WRAPPER,wrapperMarkup(w,h),'utf8');
  const proc=spawnSync(browser,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--window-size=1600,1000','--force-device-scale-factor=1','--virtual-time-budget=10000',
    '--dump-dom',ORIGIN+'/'+WRAPPER_REL
  ],{encoding:'utf8',timeout:35000,maxBuffer:12*1024*1024});
  if(proc.error)throw proc.error;
  if(proc.status!==0)throw new Error('browser '+proc.status+' '+proc.stderr);
  const a='<pre id="result">',b='</pre>',i=proc.stdout.indexOf(a),j=proc.stdout.indexOf(b,i);
  if(i<0||j<0)throw new Error('result missing');
  const raw=proc.stdout.slice(i+a.length,j).replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
  const value=JSON.parse(raw);
  if(!value.ok)throw new Error(w+'x'+h+' '+value.error);
  if(value.viewport.width!==w||value.viewport.height!==h)throw new Error('viewport '+value.viewport.width+'x'+value.viewport.height+' expected '+w+'x'+h);
  if(value.results.map(item=>item.weeks).join(',')!=='4,5,6')throw new Error('4/5/6-week matrix incomplete at '+w+'x'+h);
  return value;
}

const browser=browserPath();
fs.writeFileSync(INNER,fixture,'utf8');
const server=spawn('python',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try{
  waitServer();
  const results=[[1280,900],[1440,900],[1440,1200]].map(([w,h])=>run(browser,w,h));
  console.log('CALENDAR MONTH GEOMETRY PASS',JSON.stringify(results));
}finally{
  server.kill('SIGTERM');
  fs.rmSync(INNER,{force:true});
  fs.rmSync(WRAPPER,{force:true});
}
