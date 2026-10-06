import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FIXTURE_REL='scripts/.life-wallet-document-scan-ui-fixture.html';
const FIXTURE=path.join(ROOT,FIXTURE_REL);
const PORT=22_000+(process.pid%20_000); const ORIGIN=`http://127.0.0.1:${PORT}`;

function browserPath(){
  for(const candidate of [process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','google-chrome','chromium'].filter(Boolean)){
    if((candidate.includes('/')||candidate.includes('\\'))&&fs.existsSync(candidate))return candidate;
    const found=spawnSync(process.platform==='win32'?'where':'which',[candidate],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim())return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required.');
}

const fixture=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:680px;margin:auto}</style></head><body><main id="host"></main><pre id="result">pending</pre><script type="module">
const out=document.getElementById('result'); const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async (predicate,label)=>{for(let i=0;i<100;i+=1){const value=predicate();if(value)return value;await sleep(30)}throw new Error('timed out '+label+' state='+document.querySelector('.wallet-scan-editor')?.dataset.scanState+' text='+document.getElementById('host').textContent)};
try{
 const source=document.createElement('canvas');source.width=480;source.height=320;const c=source.getContext('2d');c.fillStyle='#18212d';c.fillRect(0,0,480,320);c.beginPath();c.moveTo(70,55);c.lineTo(420,40);c.lineTo(440,275);c.lineTo(50,285);c.closePath();c.fillStyle='#e9dcae';c.fill();c.lineWidth=8;c.strokeStyle='#fff';c.stroke();c.fillStyle='#315c7d';c.fillRect(150,115,190,18);
 globalThis.createImageBitmap=async()=>source;
 const blob=await new Promise(resolve=>source.toBlob(resolve,'image/png'));const file=new File([blob],'synthetic-wallet.png',{type:'image/png'});
 const module=await import('/site-life-wallet-scan-ui.js?test=1');let confirmed='';let cancelled=0;let replaced=0;
 const scanner=module.createWalletDocumentScanner({file,onConfirm:value=>{confirmed=value},onCancel:()=>{cancelled+=1},onReplace:()=>{replaced+=1}});document.getElementById('host').append(scanner.element);
 await wait(()=>scanner.element.dataset.scanState==='review','initial review');
 const handles=[...scanner.element.querySelectorAll('.wallet-scan-handle')];const sourcePane=scanner.element.querySelector('.wallet-scan-source-pane')||scanner.element.querySelector('.wallet-scan-pane');const initialHandleVisibility=handles.map(handle=>handle.getClientRects().length>0);const initialSourceVisible=sourcePane.getClientRects().length>0;const initialButtons=[...scanner.element.querySelectorAll('button')].filter(button=>button.getClientRects().length>0).map(button=>button.textContent);
 const adjustButton=scanner.element.querySelector('[data-wallet-scan-adjust]')||[...scanner.element.querySelectorAll('button')].find(button=>button.textContent.includes('모서리 조정'));adjustButton.click();await sleep(30);if(scanner.element.dataset.scanAdjusting!=='true')scanner.element.dataset.scanAdjusting='legacy-visible';
 const first=handles[0];const beforeKeyboard=first.dataset.x;first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await sleep(80);const afterKeyboard=first.dataset.x;
 const beforePointer=first.dataset.x;const rect=first.getBoundingClientRect();first.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,bubbles:true}));first.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,clientX:rect.left+rect.width/2+18,clientY:rect.top+rect.height/2,bubbles:true}));first.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,clientX:rect.left+rect.width/2+18,clientY:rect.top+rect.height/2,bubbles:true}));await sleep(100);const afterPointer=first.dataset.x;
 const locationAfter=location.href;const preview=scanner.element.querySelector('.wallet-scan-result-image');const bounds=scanner.element.getBoundingClientRect();
 scanner.element.querySelector('[data-wallet-scan-confirm]').click();await wait(()=>confirmed.startsWith('data:image/jpeg;base64,'),'confirm callback');
 const nativeCreateImageBitmap=globalThis.createImageBitmap;let decodeOptions=null;let resolveDecode;let closed=0;
 globalThis.createImageBitmap=(input,options)=>{decodeOptions=options;return new Promise(resolve=>{resolveDecode=()=>resolve({width:2560,height:1707,close(){closed+=1}})})};
 const pngHeader=new Uint8Array(24);pngHeader.set([137,80,78,71,13,10,26,10],0);pngHeader.set([0,0,0,13,73,72,68,82],8);new DataView(pngHeader.buffer).setUint32(16,9000);new DataView(pngHeader.buffer).setUint32(20,6000);
 const oversized=new File([pngHeader],'oversized.png',{type:'image/png'});const closingScanner=module.createWalletDocumentScanner({file:oversized});closingScanner.destroy();
 await wait(()=>typeof resolveDecode==='function','delayed decode start');resolveDecode();await sleep(50);globalThis.createImageBitmap=nativeCreateImageBitmap;
 out.textContent=JSON.stringify({ok:true,state:scanner.element.dataset.scanState,sourceWidth:scanner.element.dataset.scanSourceWidth,sourceHeight:scanner.element.dataset.scanSourceHeight,handleCount:handles.length,labels:handles.map(handle=>handle.getAttribute('aria-label')),initialHandleVisibility,initialSourceVisible,initialButtons,beforeKeyboard,afterKeyboard,beforePointer,afterPointer,locationAfter,preview:Boolean(preview&&!preview.hidden&&preview.src.startsWith('data:image/jpeg;base64,')),text:scanner.element.textContent,width:bounds.width,viewport:document.documentElement.clientWidth,confirmed:confirmed.startsWith('data:image/jpeg;base64,'),cancelled,replaced,decodeOptions,closed});scanner.destroy();
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

fs.writeFileSync(FIXTURE,fixture,'utf8'); const server=spawn(process.platform==='win32'?'python':'python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try{
 for(let attempt=0;attempt<50;attempt+=1){const ready=spawnSync('curl',['--fail','--silent',`${ORIGIN}/${FIXTURE_REL}`],{timeout:1000});if(ready.status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);if(attempt===49)throw new Error('server did not start')}
 const run=spawnSync(browserPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=390,844','--force-device-scale-factor=1','--virtual-time-budget=5000','--dump-dom',`${ORIGIN}/${FIXTURE_REL}`],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});if(run.error)throw run.error;
 const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/u);assert.ok(match,`result missing: ${run.stderr}`);const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
 assert.equal(result.ok,true,result.error);assert.equal(result.sourceWidth,'480');assert.equal(result.sourceHeight,'320');assert.equal(result.handleCount,4);assert.deepEqual(result.labels,['왼쪽 위 모서리','오른쪽 위 모서리','오른쪽 아래 모서리','왼쪽 아래 모서리']);assert.deepEqual(result.initialHandleVisibility,[false,false,false,false],'manual corner handles must stay hidden during automatic review');assert.equal(result.initialSourceVisible,false,'source editor must stay hidden during automatic review');assert.ok(result.initialButtons.includes('직접 조정'),'automatic review must offer manual adjustment only as a secondary action');assert.ok(result.initialButtons.includes('다시 선택'));assert.ok(result.initialButtons.includes('저장'));assert.ok(!result.initialButtons.includes('원본 색감')&&!result.initialButtons.includes('선명하게'),'automatic review must not expose tone controls');assert.notEqual(result.beforeKeyboard,result.afterKeyboard,'arrow key must move focused corner');assert.notEqual(result.beforePointer,result.afterPointer,'pointer drag must move corner');assert.ok(result.locationAfter.endsWith(`/${FIXTURE_REL}`),'corner drag must not navigate');assert.equal(result.preview,true);assert.equal(result.confirmed,true);for(const copy of ['결과를 확인해 주세요','보정된 자료','저장','직접 조정','다시 선택','다시 촬영 권장'])assert.ok(result.text.includes(copy),`missing copy: ${copy}`);assert.ok(result.width<=result.viewport,`editor overflowed mobile viewport: ${result.width}/${result.viewport}`);assert.equal(result.decodeOptions.imageOrientation,'from-image','decoder must honor EXIF orientation');assert.equal(result.decodeOptions.resizeWidth,2560,`oversized decode was not bounded: ${JSON.stringify(result.decodeOptions)}`);assert.equal(result.decodeOptions.resizeHeight,1707,`oversized decode aspect ratio changed: ${JSON.stringify(result.decodeOptions)}`);assert.equal(result.closed,1,'bitmap completing after destroy must be closed');console.log('LIFE_WALLET_DOCUMENT_SCAN_UI_01 PASS');
}finally{server.kill();fs.rmSync(FIXTURE,{force:true})}
