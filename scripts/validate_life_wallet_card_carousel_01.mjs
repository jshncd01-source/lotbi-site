import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css">
<style>body{margin:0;padding:16px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:0 auto}</style>
</head><body><main id="host"></main><pre id="result">pending</pre>
<script type="module">
const out=document.getElementById('result');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  const {createWalletCardCarousel}=await import('/site-life-wallet.js?card-carousel-test=1');
  const shaped=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,height);return canvas.toDataURL('image/png')};
  const idCard=shaped(1012,638);const page=shaped(734,1024);
  // Two ID cards then a tall page last (as on a real wallet): the strip must fit whichever one
  // is on screen, and the narrow last page must still come to the centre alone.
  const cards=[
    {id:'one',name:'신분·자격 자료',kind:'identity',frontDataUrl:idCard},
    {id:'two',name:'회원증',kind:'membership',frontDataUrl:idCard},
    {id:'three',name:'계약서',kind:'certificate',frontDataUrl:page},
  ];
  const opened=[];
  const carousel=createWalletCardCarousel({cards,onOpen:card=>opened.push(card.id)});
  document.getElementById('host').append(carousel);
  await Promise.all([...carousel.querySelectorAll('.wallet-card-image')].map(image=>image.decode().catch(()=>{})));
  await sleep(100);
  const viewport=carousel.querySelector('.wallet-card-viewport');
  const items=[...carousel.querySelectorAll('.wallet-card')];
  const dots=[...carousel.querySelectorAll('[data-wallet-carousel-dot]')];
  const position=()=>carousel.querySelector('.wallet-card-position')?.textContent;
  const onScreen=()=>{const frame=viewport.getBoundingClientRect();return items.filter(item=>{const rect=item.getBoundingClientRect();return rect.right>frame.left+1&&rect.left<frame.right-1}).length};
  const heightGap=()=>viewport.getBoundingClientRect().height-items.find(item=>item.getAttribute('aria-current')==='true').getBoundingClientRect().height;
  const firstVisible=onScreen();const firstGap=heightGap();
  // A mouse drag to the left moves to the next card and does not open the card it started on.
  const startRect=items[0].getBoundingClientRect();const startX=startRect.left+startRect.width/2;const startY=startRect.top+startRect.height/2;
  items[0].dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,pointerType:'mouse',button:0,clientX:startX,clientY:startY,bubbles:true}));
  for(const step of [10,60,140,220])window.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,pointerType:'mouse',buttons:1,clientX:startX-step,clientY:startY,bubbles:true}));
  const dragging=viewport.dataset.dragging==='true';
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'mouse',button:0,clientX:startX-220,clientY:startY,bubbles:true}));
  items[0].click();
  await sleep(500);
  const dragPosition=position();const draggedOpened=opened.join(',');const pageVisible=onScreen();const pageGap=heightGap();
  dots[2].click();
  await sleep(500);
  const dotPosition=position();const cardGap=heightGap();const lastVisible=onScreen();
  viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  await sleep(500);
  const keyboardPosition=position();
  items[1].click();
  const single=createWalletCardCarousel({cards:[cards[0]],onOpen:()=>{}});
  document.getElementById('host').append(single);
  const narrowHost=document.createElement('div');
  narrowHost.style.width='390px';
  narrowHost.style.maxWidth='100%';
  const narrow=createWalletCardCarousel({cards,onOpen:()=>{}});
  narrowHost.append(narrow);
  document.body.append(narrowHost);
  // Saved pages keep their own shape: a portrait page is not framed by empty bars and a
  // landscape card still fills the card frame.
  const portrait=createWalletCardCarousel({cards:[{id:'page',name:'계약서',kind:'certificate',frontDataUrl:shaped(734,1024)}],onOpen:()=>{}});
  const landscape=createWalletCardCarousel({cards:[{id:'card',name:'카드',kind:'identity',frontDataUrl:shaped(1012,638)}],onOpen:()=>{}});
  document.getElementById('host').append(portrait,landscape);
  await Promise.all([...document.querySelectorAll('.wallet-card-image')].map(image=>image.decode().catch(()=>{})));
  const fit=carouselElement=>{const card=carouselElement.querySelector('.wallet-card').getBoundingClientRect();const image=carouselElement.querySelector('.wallet-card-image').getBoundingClientRect();return {frameWidth:carouselElement.getBoundingClientRect().width,cardWidth:card.width,imageWidth:image.width,imageAspect:image.width/image.height}};
  const portraitFit=fit(portrait);const landscapeFit=fit(landscape);
  const firstRect=items[0].getBoundingClientRect();
  const firstImageRect=items[0].querySelector('.wallet-card-image').getBoundingClientRect();
  out.textContent=JSON.stringify({
    ok:true,
    count:items.length,
    imageOnly:items.every(item=>item.children.length===1&&item.firstElementChild?.tagName==='IMG'),
    duplicateCopy:carousel.querySelectorAll('.wallet-card-copy').length,
    visibleCategoryText:carousel.innerText.includes('신분·자격 자료'),
    arrowButtons:carousel.querySelectorAll('.wallet-card-arrow,[data-wallet-carousel-next],[data-wallet-carousel-previous]').length,
    dotCount:dots.length,
    firstVisible,lastVisible,firstGap,dragging,dragPosition,draggedOpened,pageVisible,pageGap,dotPosition,cardGap,keyboardPosition,
    opened:opened.join(','),
    swipeEnabled:getComputedStyle(viewport).scrollSnapType.includes('x')&&getComputedStyle(viewport).overflowX==='auto'&&getComputedStyle(items[0].parentElement).scrollSnapStop==='always'&&items[0].parentElement.classList.contains('wallet-card-slide'),
    compactCardFrame:firstRect.width<=480,
    completeDocumentEdges:getComputedStyle(items[0].querySelector('.wallet-card-image')).transform==='none'&&getComputedStyle(items[0].querySelector('.wallet-card-image')).objectFit==='contain'&&firstImageRect.width<=firstRect.width+1&&firstImageRect.height<=firstRect.height+1,
    singleControls:single.querySelectorAll('.wallet-card-dots,.wallet-card-position').length,
    overflow:narrow.getBoundingClientRect().right>narrowHost.getBoundingClientRect().right,
    portraitFit,
    landscapeFit,
  });
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

// Desktop and phone widths: one card at a time on both.
for (const viewport of [{width: 1200, height: 844}, {width: 390, height: 844, mobile: true}]) {
const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_card_carousel_01.html', fixtureHtml: fixture,
  viewport,
  resultExpression: "(() => { const text = document.getElementById('result')?.textContent || ''; return text === 'pending' ? '' : text; })()",
});
if (!result.ok) throw new Error(result.error);
{
  assert.equal(result.count, 3, 'every saved document must be available in the wallet carousel');
  assert.equal(result.imageOnly, true, 'saved wallet cards must render as image-only cards');
  assert.equal(result.duplicateCopy, 0, 'saved wallet cards must not retain the gallery-style copy block');
  assert.equal(result.visibleCategoryText, false, 'document categories must not appear below the wallet image');
  // One card at a time, moved by swipe/drag (dots and arrow keys for keyboard users), no arrow buttons.
  assert.equal(result.arrowButtons, 0, 'the wallet must move by swipe like a phone wallet, not by arrow buttons');
  assert.equal(result.dotCount, 3, 'a position dot per saved document');
  assert.equal(result.firstVisible, 1, 'exactly one wallet card must be on screen at a time');
  assert.equal(result.dragging, true, 'a mouse drag must move the strip');
  assert.equal(result.dragPosition, '2 / 3', 'dragging left must settle on the next card');
  assert.equal(result.draggedOpened, '', 'a drag must not open the card it started on');
  assert.equal(result.pageVisible, 1, 'exactly one wallet card must be on screen after a drag');
  assert.equal(result.dotPosition, '3 / 3', 'a position dot must move to its card');
  assert.equal(result.lastVisible, 1, 'the last card must also be shown alone (no part of the previous card beside it)');
  assert.equal(result.keyboardPosition, '2 / 3', 'the left arrow key must move to the previous card');
  // The strip fits the card on screen: a short ID card is not framed by a tall page's height.
  for (const [name, gap] of [['first card', result.firstGap], ['second card', result.pageGap], ['last tall page', result.cardGap]]) assert.ok(gap >= 0 && gap <= 20, `the wallet strip must fit the ${name} on screen, with room for its shadow (gap ${gap}px)`);
  assert.equal(result.opened, 'two', 'clicking the visible card must preserve the existing detail action');
  assert.equal(result.swipeEnabled, true, 'the wallet card viewport must snap one card per swipe');
  assert.equal(result.compactCardFrame, true, 'wallet cards must stay compact instead of expanding into an image viewer');
  assert.equal(result.completeDocumentEdges, true, 'corrected wallet images must show every document edge without a fixed zoom crop');
  assert.equal(result.singleControls, 0, 'a single wallet card must not show carousel controls or position');
  assert.equal(result.overflow, false, 'the wallet carousel must fit a 390px mobile viewport');
  assert.ok(result.portraitFit.cardWidth-result.portraitFit.imageWidth<=4&&Math.abs(result.portraitFit.imageAspect-734/1024)<.03, `a portrait page must not be framed by empty bars: ${JSON.stringify(result.portraitFit)}`);
  assert.ok(result.landscapeFit.cardWidth>=Math.min(400,result.landscapeFit.frameWidth-28)&&result.landscapeFit.cardWidth-result.landscapeFit.imageWidth<=4&&Math.abs(result.landscapeFit.imageAspect-1012/638)<.03, `a landscape card must fill its card frame: ${JSON.stringify(result.landscapeFit)}`);
}
}
console.log('LIFE_WALLET_CARD_CAROUSEL_01 PASS — desktop and 390px phone');
