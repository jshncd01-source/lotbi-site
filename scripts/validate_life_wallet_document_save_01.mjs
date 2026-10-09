// LIFE-WALLET-DOCUMENT-SAVE-01 — a scanned photo enters the save flow only as the corrected
// JPEG after 저장; cancel and 다시 선택 leave nothing storable and close the scanner's
// resources; nothing goes over the network. Runs in real time over the DevTools protocol
// (scripts/lib/headless-fixture-result.mjs): the earlier --dump-dom --virtual-time-budget
// run let the page's 9-second waits pass in virtual time while photo processing still ran on
// a slow Linux gate runner (SITE-T39b: "timeout cancel review states="). Waits allow 30 s
// of real time and report the last scanner state. Synthetic image only.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><main id="host"></main><pre id="result">pending</pre><script type="module">
const out=document.getElementById('result');const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));const wait=async(predicate,label)=>{const started=performance.now();const deadline=started+30000;while(performance.now()<deadline){const value=predicate();if(value)return value;await sleep(30)}const editors=[...document.querySelectorAll('.wallet-scan-editor')];throw new Error('timeout '+label+' after '+Math.round((performance.now()-started)/1000)+'s editors='+editors.length+' host='+document.getElementById('host').childElementCount+' states='+editors.map(node=>node.dataset.scanState+':'+node.textContent.slice(0,80)).join('|'))};
try{
 let networkCalls=0;const realFetch=globalThis.fetch;globalThis.fetch=(...args)=>{networkCalls+=1;return realFetch(...args)};const realSend=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(...args){networkCalls+=1;return realSend.apply(this,args)};const realBeacon=navigator.sendBeacon?.bind(navigator);if(realBeacon)navigator.sendBeacon=(...args)=>{networkCalls+=1;return realBeacon(...args)};
 let closed=0;const realClose=ImageBitmap.prototype.close;ImageBitmap.prototype.close=function(){closed+=1;return realClose.call(this)};
 const source=document.createElement('canvas');source.width=480;source.height=320;const c=source.getContext('2d');c.fillStyle='#18212d';c.fillRect(0,0,480,320);c.beginPath();c.moveTo(70,55);c.lineTo(420,40);c.lineTo(440,275);c.lineTo(50,285);c.closePath();c.fillStyle='#e9dcae';c.fill();c.lineWidth=8;c.strokeStyle='#fff';c.stroke();for(let row=0;row<5;row+=1)for(let glyph=0;glyph<18;glyph+=1){c.fillStyle='#2a2a2a';c.fillRect(125+glyph*13,98+row*30,8,10)};source.close=()=>{closed+=1};globalThis.createImageBitmap=async()=>source;const blob=await new Promise(resolve=>source.toBlob(resolve,'image/png'));
 const {createWalletPhotoPicker}=await import('/site-life-wallet.js?document-save-test=1');let ready=0;const errors=[];
 const make=()=>{const picker=createWalletPhotoPicker({onError:message=>errors.push(message),onReady:value=>{if(value)ready+=1}});document.getElementById('host').append(picker.element);return picker};
 const select=picker=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],'synthetic-wallet.png',{type:'image/png'}));picker.input.files=transfer.files;picker.input.dispatchEvent(new Event('change',{bubbles:true}))};
 const cancelled=make();select(cancelled);await wait(()=>cancelled.element.querySelector('[data-scan-state="review"]'),'cancel review');let blocked=false;try{await cancelled.readDataUrl()}catch{blocked=true}cancelled.element.querySelector('.wallet-scan-actions button').click();await sleep(50);const readyAfterCancel=ready;const scannerAfterCancel=Boolean(cancelled.element.querySelector('.wallet-scan-editor'));
 const replaced=make();select(replaced);const oldScanner=await wait(()=>replaced.element.querySelector('[data-scan-state="review"]'),'replace review');const retakeButton=[...replaced.element.querySelectorAll('.wallet-scan-actions button')].some(button=>button.textContent==='다시 선택');select(replaced);await wait(()=>!oldScanner.isConnected&&replaced.element.querySelector('[data-scan-state="review"]'),'replacement review');const readyAfterReplace=ready;const scannerAfterReplace=oldScanner.isConnected||replaced.element.querySelectorAll('.wallet-scan-editor').length!==1;replaced.destroy();
 const confirmed=make();select(confirmed);const scanner=await wait(()=>confirmed.element.querySelector('[data-scan-state="review"]'),'confirm review');scanner.querySelector('[data-wallet-scan-confirm]').click();await wait(()=>ready===1,'ready callback');const saved=await confirmed.readDataUrl();const preview=confirmed.element.querySelector('.wallet-photo-preview');const scannerAfterConfirm=Boolean(confirmed.element.querySelector('.wallet-scan-editor'));confirmed.destroy();
 out.textContent=JSON.stringify({ok:true,blocked,readyAfterCancel,scannerAfterCancel,retakeButton,readyAfterReplace,scannerAfterReplace,savedJpeg:saved.startsWith('data:image/jpeg;base64,'),previewJpeg:preview.src.startsWith('data:image/jpeg;base64,'),scannerAfterConfirm,networkCalls,closed,privacyText:document.body.textContent.includes('LOTBI 서버로 전송되지 않습니다.'),errors});
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

const result=await runFixturePage({root:ROOT,fixturePath:'/__life_wallet_document_save_01.html',fixtureHtml:fixture,viewport:{width:900,height:900},timeoutMs:180000,
  resultExpression:"(() => { const text = document.getElementById('result')?.textContent || ''; return text === 'pending' ? '' : text; })()"});
assert.equal(result.ok,true,result.error);
assert.equal(result.blocked,true,'readDataUrl must reject before scan confirmation');
assert.equal(result.readyAfterCancel,0,'cancel must not produce a storable image');
assert.equal(result.scannerAfterCancel,false,'cancel must remove scanner resources');
assert.equal(result.retakeButton,false,'the wallet scanner has no second 다시 선택 (the attach area changes the file)');
assert.equal(result.readyAfterReplace,0,'replace must not produce a storable image');
assert.equal(result.scannerAfterReplace,false,'replace must remove old scanner resources');
assert.equal(result.savedJpeg,true,'only corrected JPEG may enter save flow');
assert.equal(result.previewJpeg,true,'picker preview must use corrected JPEG');
assert.equal(result.scannerAfterConfirm,false,'confirmation must close scanner editor');
assert.equal(result.networkCalls,0,'document processing must make no network request');
assert.ok(result.closed>=3,`expected decoded image resources to close, got ${result.closed}`);
assert.equal(result.privacyText,true);
console.log('LIFE_WALLET_DOCUMENT_SAVE_01 PASS');
