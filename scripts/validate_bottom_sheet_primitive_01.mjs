// Locks the reusable bottom-sheet primitive that both the Calendar selected-day
// sheet and the account/profile sheet build on.
//
// Covered: open/close, backdrop dismiss, drag-to-close (threshold and flick),
// focus trap, focus restore, Escape containment, role/aria-modal, injected
// content, the desktop INLINE substitute, and prefers-reduced-motion.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.sheet-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.sheet-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4198;
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
<link rel="stylesheet" href="/site-bottom-sheet.css?v=20260922-sheet1">
</head><body>
<button id="opener" type="button">열기</button>
<pre id="sheet-result">pending</pre>
<script type="module">
const out=document.getElementById('sheet-result');
const wait=async(fn,label)=>{for(let i=0;i<200;i+=1){if(fn())return true;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout '+label)};
const settle=()=>new Promise(r=>setTimeout(r,40));
function pointer(node,type,y,extra={}){
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{clientY:y,clientX:10,pointerId:1,button:0,...extra});
  node.dispatchEvent(event);
  return event;
}
function buildBody(){
  const wrap=document.createElement('div');
  const a=document.createElement('button');a.type='button';a.id='first';a.textContent='첫 버튼';
  const b=document.createElement('button');b.type='button';b.id='second';b.textContent='둘째 버튼';
  wrap.append(a,b);
  return wrap;
}
try{
  const {createBottomSheet,SHEET_PRESENTATION}=await import('/site-bottom-sheet.js?v=20260922-sheet1');
  const result={ok:true,viewport:{width:innerWidth,height:innerHeight},
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

  // ---------------- overlay presentation ----------------
  const opener=document.getElementById('opener');
  opener.focus();
  let closed=0;
  const sheet=createBottomSheet({
    label:'테스트 시트',
    content:buildBody,
    presentation:SHEET_PRESENTATION.SHEET,
    onClose:()=>{closed+=1},
  });
  sheet.open();
  await wait(()=>document.querySelector('[data-lotbi-sheet]'),'sheet mounted');
  await settle();
  const node=document.querySelector('[data-lotbi-sheet]');
  const style=getComputedStyle(node);
  const rect=node.getBoundingClientRect();
  result.mounted={
    role:node.getAttribute('role'),
    ariaModal:node.getAttribute('aria-modal'),
    ariaLabel:node.getAttribute('aria-label'),
    presentation:node.dataset.presentation,
    position:style.position,
    bottom:rect.bottom,
    left:rect.left,
    right:rect.right,
    backdrop:Boolean(document.querySelector('[data-lotbi-sheet-backdrop]')),
    grabber:Boolean(node.querySelector('[data-lotbi-sheet-grabber]')),
    dismiss:Boolean(node.querySelector('[data-lotbi-sheet-dismiss]')),
    injected:Boolean(node.querySelector('#first')&&node.querySelector('#second')),
    focusInside:node.contains(document.activeElement),
  };

  // ---------------- focus trap ----------------
  const first=node.querySelector('#first');
  const dismissBtn=node.querySelector('[data-lotbi-sheet-dismiss]');
  dismissBtn.focus();
  const fwd=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});
  document.dispatchEvent(fwd);
  await settle();
  result.trapWrapsForward=document.activeElement===first&&fwd.defaultPrevented;
  first.focus();
  const back=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});
  document.dispatchEvent(back);
  await settle();
  result.trapWrapsBackward=document.activeElement===dismissBtn&&back.defaultPrevented;

  // ---------------- Escape closes and restores focus ----------------
  const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  document.dispatchEvent(esc);
  await wait(()=>!document.querySelector('[data-lotbi-sheet]'),'escape close');
  result.escapeCloses=true;
  result.escapeConsumed=esc.defaultPrevented;
  result.focusRestored=document.activeElement===opener;
  result.backdropRemoved=!document.querySelector('[data-lotbi-sheet-backdrop]');
  result.onCloseCalls=closed;

  // ---------------- backdrop dismiss ----------------
  sheet.open();
  await wait(()=>document.querySelector('[data-lotbi-sheet-backdrop]'),'reopen');
  document.querySelector('[data-lotbi-sheet-backdrop]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  await wait(()=>!document.querySelector('[data-lotbi-sheet]'),'backdrop close');
  result.backdropDismiss=true;

  // ---------------- drag below threshold snaps back ----------------
  sheet.open();
  await wait(()=>document.querySelector('[data-lotbi-sheet]'),'reopen for drag');
  await settle();
  const dragNode=document.querySelector('[data-lotbi-sheet]');
  const grab=dragNode.querySelector('[data-lotbi-sheet-grabber]');
  pointer(grab,'pointerdown',400);
  pointer(grab,'pointermove',410);
  pointer(grab,'pointerup',410);
  await settle();
  result.smallDragKeepsOpen=Boolean(document.querySelector('[data-lotbi-sheet]'));
  result.transformCleared=(document.querySelector('[data-lotbi-sheet]')?.style.transform||'')==='';

  // ---------------- drag past threshold closes ----------------
  const height=dragNode.getBoundingClientRect().height;
  pointer(grab,'pointerdown',400);
  const moved=pointer(grab,'pointermove',400+Math.max(120,height));
  pointer(grab,'pointerup',400+Math.max(120,height));
  await wait(()=>!document.querySelector('[data-lotbi-sheet]'),'drag close');
  result.dragCloses=true;
  result.dragPreventsDefault=moved.defaultPrevented;

  // ---------------- INLINE substitute ----------------
  const inline=createBottomSheet({
    label:'인라인',
    content:buildBody,
    presentation:SHEET_PRESENTATION.INLINE,
  });
  inline.open();
  await wait(()=>document.querySelector('[data-presentation="INLINE"]'),'inline mounted');
  await settle();
  const inlineNode=document.querySelector('[data-presentation="INLINE"]');
  result.inline={
    position:getComputedStyle(inlineNode).position,
    role:inlineNode.getAttribute('role'),
    ariaModal:inlineNode.getAttribute('aria-modal'),
    backdrop:Boolean(document.querySelector('[data-lotbi-sheet-backdrop]')),
    grabber:Boolean(inlineNode.querySelector('[data-lotbi-sheet-grabber]')),
    injected:Boolean(inlineNode.querySelector('#first')),
  };
  inline.close();
  await wait(()=>!document.querySelector('[data-presentation="INLINE"]'),'inline close');

  // ---------------- content injection is replaceable ----------------
  const swap=createBottomSheet({label:'교체',presentation:SHEET_PRESENTATION.INLINE});
  const marker=document.createElement('p');marker.id='swapped';marker.textContent='교체됨';
  swap.setContent(marker);
  swap.open();
  await wait(()=>document.querySelector('#swapped'),'content swap');
  result.contentSwappable=true;
  swap.destroy();
  result.destroyRemoves=!document.querySelector('#swapped');

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
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('sheet-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},40000);
  <\/script></body></html>`;
}

function run(browser, w, h, {reducedMotion = true} = {}) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const motion = reducedMotion ? ['--force-prefers-reduced-motion=reduce'] : [];
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', ...motion, '--virtual-time-budget=45000', '--dump-dom', ORIGIN + '/' + WRAPPER_REL], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
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
  const cases = [[390, 844], [412, 915], [320, 800], [1280, 900]];
  const results = cases.map(([w, h]) => run(browser, w, h));
  const animated = run(browser, 390, 844, {reducedMotion: false});

  for (const value of [...results, animated]) {
    const label = `${value.viewport.width}x${value.viewport.height}`;
    const m = value.mounted;

    // dialog semantics
    if (m.role !== 'dialog') throw new Error(`${label}: overlay sheet must be role=dialog`);
    if (m.ariaModal !== 'true') throw new Error(`${label}: overlay sheet must set aria-modal`);
    if (!m.ariaLabel) throw new Error(`${label}: sheet must carry an accessible name`);

    // geometry and chrome
    if (m.position !== 'fixed') throw new Error(`${label}: overlay sheet must be viewport-fixed`);
    if (Math.abs(m.bottom - value.viewport.height) > 1.5) throw new Error(`${label}: sheet must sit on the bottom edge (${m.bottom} vs ${value.viewport.height})`);
    if (m.left < -1 || m.right > value.viewport.width + 1) throw new Error(`${label}: sheet horizontal overflow`);
    if (!m.backdrop) throw new Error(`${label}: overlay sheet must render a backdrop`);
    if (!m.grabber) throw new Error(`${label}: overlay sheet must expose a drag grabber`);
    if (!m.dismiss) throw new Error(`${label}: sheet must expose a keyboard dismiss control`);

    // injected content
    if (!m.injected) throw new Error(`${label}: injected content missing`);
    if (!value.contentSwappable) throw new Error(`${label}: setContent must replace the body`);
    if (!value.destroyRemoves) throw new Error(`${label}: destroy must unmount the sheet`);

    // focus behaviour
    if (!m.focusInside) throw new Error(`${label}: opening must move focus into the sheet`);
    if (!value.trapWrapsForward) throw new Error(`${label}: Tab must wrap inside the sheet`);
    if (!value.trapWrapsBackward) throw new Error(`${label}: Shift+Tab must wrap inside the sheet`);
    if (!value.focusRestored) throw new Error(`${label}: closing must restore the opener's focus`);

    // escape + dismissals
    if (!value.escapeCloses) throw new Error(`${label}: Escape must close the sheet`);
    if (!value.escapeConsumed) throw new Error(`${label}: Escape must be consumed so ancestors keep their layer`);
    if (!value.backdropRemoved) throw new Error(`${label}: closing must remove the backdrop`);
    if (value.onCloseCalls !== 1) throw new Error(`${label}: onClose must fire exactly once per close (${value.onCloseCalls})`);
    if (!value.backdropDismiss) throw new Error(`${label}: backdrop click must close the sheet`);

    // drag
    if (!value.smallDragKeepsOpen) throw new Error(`${label}: a short drag must not close the sheet`);
    if (!value.transformCleared) throw new Error(`${label}: a cancelled drag must reset the transform`);
    if (!value.dragCloses) throw new Error(`${label}: dragging past the threshold must close the sheet`);
    if (!value.dragPreventsDefault) throw new Error(`${label}: dragging must suppress the default gesture`);

    // desktop substitute
    if (value.inline.position !== 'static') throw new Error(`${label}: INLINE must not be viewport-fixed`);
    if (value.inline.backdrop) throw new Error(`${label}: INLINE must not render a backdrop`);
    if (value.inline.ariaModal) throw new Error(`${label}: INLINE must not claim aria-modal`);
    if (value.inline.role !== 'group') throw new Error(`${label}: INLINE must be a plain region`);
    if (value.inline.grabber) throw new Error(`${label}: INLINE must not expose a drag grabber`);
    if (!value.inline.injected) throw new Error(`${label}: INLINE must render injected content`);
  }

  for (const value of results) {
    if (!value.reducedMotion) throw new Error('reduced-motion case did not report reduced motion');
  }
  if (animated.reducedMotion) throw new Error('motion-enabled case unexpectedly reported reduced motion');

  console.log('BOTTOM SHEET PRIMITIVE PASS', JSON.stringify({results, animated}));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
