// LIFE-WALLET-AUTO-CROP-ONLY-01
// A privacy-free certificate in the right half of an open folder is cropped automatically.
// Wallet customers never receive corner or rotation controls; uncertain images stay blocked.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><main id="host"></main><script type="module">
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(predicate,label)=>{for(let i=0;i<1200;i+=1){const value=predicate();if(value)return value;await sleep(25)}throw new Error('timed out '+label)};
const documentPhoto=document.createElement('canvas');documentPhoto.width=1200;documentPhoto.height=900;const context=documentPhoto.getContext('2d');
context.fillStyle='#17191d';context.fillRect(0,0,1200,900);
context.fillStyle='#e7e5df';context.fillRect(10,12,550,876);
context.strokeStyle='rgba(120,120,120,.25)';context.lineWidth=1;for(let y=25;y<880;y+=13)for(let x=18;x<550;x+=17){context.beginPath();context.moveTo(x,y);context.lineTo(x+8,y+5);context.stroke()}
context.fillStyle='#202126';context.fillRect(560,0,52,900);
context.fillStyle='#f3f1e8';context.fillRect(612,8,588,884);
context.fillStyle='#202020';
for(let row=0;row<13;row+=1){let x=705;const y=150+row*48;for(let glyph=0;glyph<13-(row%4);glyph+=1){const width=[9,14,7,12,10][(row+glyph)%5];context.fillRect(x,y,width,12+(glyph%2)*2);x+=width+(glyph%4===3?17:9)}}
context.strokeStyle='#444';context.lineWidth=2;context.strokeRect(688,110,410,650);context.beginPath();context.moveTo(688,250);context.lineTo(1098,250);context.stroke();
context.fillStyle='rgba(155,40,55,.8)';context.fillRect(1010,700,62,62);
const blob=await new Promise(resolve=>documentPhoto.toBlob(resolve,'image/jpeg',.9));
const module=await import('/site-life-wallet-scan-ui.js?test=auto-crop-only-01');
const scanner=module.createWalletDocumentScanner({file:new File([blob],'synthetic-open-folder.jpg',{type:'image/jpeg'})});document.getElementById('host').replaceChildren(scanner.element);
await wait(()=>scanner.element.dataset.scanState==='review'||scanner.element.dataset.scanState==='error','automatic crop');
const image=scanner.element.querySelector('.wallet-scan-result-image');await image.decode();
const automatic={state:scanner.element.dataset.scanState,mode:scanner.element.dataset.scanMode,reason:scanner.element.dataset.scanReason,diagnostics:JSON.parse(scanner.element.dataset.scanDiagnostics||'{}'),aspect:image.naturalWidth/image.naturalHeight,confirm:!scanner.element.querySelector('[data-wallet-scan-confirm]').disabled,adjustHidden:scanner.element.querySelector('[data-wallet-scan-adjust]').getClientRects().length===0,rotateHidden:scanner.element.querySelector('[data-wallet-scan-rotate]').getClientRects().length===0,text:scanner.element.innerText};scanner.destroy();
const empty=document.createElement('canvas');empty.width=800;empty.height=1000;empty.getContext('2d').fillStyle='#777';empty.getContext('2d').fillRect(0,0,800,1000);const emptyBlob=await new Promise(resolve=>empty.toBlob(resolve,'image/jpeg',.9));
const uncertain=module.createWalletDocumentScanner({file:new File([emptyBlob],'uncertain.jpg',{type:'image/jpeg'})});document.getElementById('host').replaceChildren(uncertain.element);await wait(()=>uncertain.element.dataset.scanState==='review'||uncertain.element.dataset.scanState==='error','uncertain result');
const blocked={mode:uncertain.element.dataset.scanMode,confirm:!uncertain.element.querySelector('[data-wallet-scan-confirm]').disabled,adjustHidden:uncertain.element.querySelector('[data-wallet-scan-adjust]').getClientRects().length===0,rotateHidden:uncertain.element.querySelector('[data-wallet-scan-rotate]').getClientRects().length===0,text:uncertain.element.innerText};uncertain.destroy();
window.__result={ok:true,automatic,blocked};
</script></body></html>`;

const result=await runFixturePage({root:ROOT,fixturePath:'/__life_wallet_auto_crop_only_01.html',fixtureHtml:fixture,timeoutMs:180000,viewport:{width:900,height:900},resultExpression:'window.__result ? JSON.stringify(window.__result) : ""'});
assert.equal(result.ok,true,result.error);
assert.equal(result.automatic.state,'review',JSON.stringify(result.automatic));
assert.equal(result.automatic.mode,'automatic',JSON.stringify(result.automatic));
assert.equal(result.automatic.reason,'document-quadrilateral',JSON.stringify(result.automatic));
assert.equal(result.automatic.diagnostics.source,'frame-edge-page',JSON.stringify(result.automatic));
assert.ok(result.automatic.aspect>.55&&result.automatic.aspect<.85,`right page only: ${JSON.stringify(result.automatic)}`);
assert.equal(result.automatic.confirm,true,JSON.stringify(result.automatic));
assert.equal(result.automatic.adjustHidden,true,'corner adjustment must not be available to wallet customers');
assert.equal(result.automatic.rotateHidden,true,'manual rotation must not be available to wallet customers');
assert.ok(!result.automatic.text.includes('직접 조정'),'automatic review must not mention manual adjustment');
assert.equal(result.blocked.mode,'manual',JSON.stringify(result.blocked));
assert.equal(result.blocked.confirm,false,'uncertain photos must remain unsavable');
assert.equal(result.blocked.adjustHidden,true,'uncertain photos must not expose corner adjustment');
assert.equal(result.blocked.rotateHidden,true,'uncertain photos must not expose manual rotation');
assert.ok(!result.blocked.text.includes('직접 조정'),'failure copy must not mention manual adjustment');
console.log(`LIFE_WALLET_AUTO_CROP_ONLY_01 PASS — source=${result.automatic.diagnostics.source} aspect=${result.automatic.aspect.toFixed(3)} manual_controls=hidden`);
