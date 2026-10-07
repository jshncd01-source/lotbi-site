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
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const cards=[
    {id:'one',name:'신분·자격 자료',kind:'identity',frontDataUrl:png},
    {id:'two',name:'회원증',kind:'membership',frontDataUrl:png},
    {id:'three',name:'증명서',kind:'certificate',frontDataUrl:png},
  ];
  const opened=[];
  const carousel=createWalletCardCarousel({cards,onOpen:card=>opened.push(card.id)});
  document.getElementById('host').append(carousel);
  const viewport=carousel.querySelector('.wallet-card-viewport');
  const items=[...carousel.querySelectorAll('.wallet-card')];
  const next=carousel.querySelector('[data-wallet-carousel-next]');
  const previous=carousel.querySelector('[data-wallet-carousel-previous]');
  next.click();
  await sleep(350);
  const nextPosition=carousel.querySelector('.wallet-card-position')?.textContent;
  viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await sleep(350);
  const keyboardPosition=carousel.querySelector('.wallet-card-position')?.textContent;
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
  const shaped=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,height);return canvas.toDataURL('image/png')};
  const portrait=createWalletCardCarousel({cards:[{id:'page',name:'계약서',kind:'certificate',frontDataUrl:shaped(734,1024)}],onOpen:()=>{}});
  const landscape=createWalletCardCarousel({cards:[{id:'card',name:'카드',kind:'identity',frontDataUrl:shaped(1012,638)}],onOpen:()=>{}});
  document.getElementById('host').append(portrait,landscape);
  await Promise.all([...document.querySelectorAll('.wallet-card-image')].map(image=>image.decode().catch(()=>{})));
  const fit=carouselElement=>{const card=carouselElement.querySelector('.wallet-card').getBoundingClientRect();const image=carouselElement.querySelector('.wallet-card-image').getBoundingClientRect();return {cardWidth:card.width,imageWidth:image.width,imageAspect:image.width/image.height}};
  const portraitFit=fit(portrait);const landscapeFit=fit(landscape);
  const carouselRect=carousel.getBoundingClientRect();
  const firstRect=items[0].getBoundingClientRect();
  const firstImageRect=items[0].querySelector('.wallet-card-image').getBoundingClientRect();
  const viewportRect=viewport.getBoundingClientRect();
  out.textContent=JSON.stringify({
    ok:true,
    count:items.length,
    imageOnly:items.every(item=>item.children.length===1&&item.firstElementChild?.tagName==='IMG'),
    duplicateCopy:carousel.querySelectorAll('.wallet-card-copy').length,
    visibleCategoryText:carousel.innerText.includes('신분·자격 자료'),
    nextPosition,
    keyboardPosition,
    previousEnabled:!previous.disabled,
    opened:opened.join(','),
    swipeEnabled:getComputedStyle(viewport).scrollSnapType.includes('x')&&getComputedStyle(viewport).overflowX==='auto',
    nextCardPeek:firstRect.width<carouselRect.width,
    compactCardFrame:firstRect.width<=480,
    completeDocumentEdges:getComputedStyle(items[0].querySelector('.wallet-card-image')).transform==='none'&&getComputedStyle(items[0].querySelector('.wallet-card-image')).objectFit==='contain'&&firstImageRect.width<=firstRect.width+1&&firstImageRect.height<=firstRect.height+1,
    compactTrackPadding:(viewportRect.height-firstRect.height)<=12,
    singleControls:single.querySelectorAll('.wallet-card-navigation,.wallet-card-position').length,
    overflow:narrow.getBoundingClientRect().right>narrowHost.getBoundingClientRect().right,
    portraitFit,
    landscapeFit,
  });
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_card_carousel_01.html', fixtureHtml: fixture,
  viewport: {width: 1200, height: 844},
  resultExpression: "(() => { const text = document.getElementById('result')?.textContent || ''; return text === 'pending' ? '' : text; })()",
});
if (!result.ok) throw new Error(result.error);
{
  assert.equal(result.count, 3, 'every saved document must be available in the wallet carousel');
  assert.equal(result.imageOnly, true, 'saved wallet cards must render as image-only cards');
  assert.equal(result.duplicateCopy, 0, 'saved wallet cards must not retain the gallery-style copy block');
  assert.equal(result.visibleCategoryText, false, 'document categories must not appear below the wallet image');
  assert.equal(result.nextPosition, '2 / 3', 'the next control must advance the current wallet card');
  assert.equal(result.keyboardPosition, '3 / 3', 'the right arrow key must advance the current wallet card');
  assert.equal(result.previousEnabled, true, 'the previous control must become available after advancing');
  assert.equal(result.opened, 'two', 'clicking the visible card must preserve the existing detail action');
  assert.equal(result.swipeEnabled, true, 'the wallet card viewport must support horizontal scroll snapping');
  assert.equal(result.nextCardPeek, true, 'multiple cards must leave a visible next-card cue');
  assert.equal(result.compactCardFrame, true, 'wallet cards must stay compact instead of expanding into an image viewer');
  assert.equal(result.completeDocumentEdges, true, 'corrected wallet images must show every document edge without a fixed zoom crop');
  assert.equal(result.compactTrackPadding, true, 'the wallet slider must not add large vertical whitespace around cards');
  assert.equal(result.singleControls, 0, 'a single wallet card must not show carousel controls or position');
  assert.equal(result.overflow, false, 'the wallet carousel must fit a 390px mobile viewport');
  assert.ok(result.portraitFit.cardWidth-result.portraitFit.imageWidth<=4&&Math.abs(result.portraitFit.imageAspect-734/1024)<.03, `a portrait page must not be framed by empty bars: ${JSON.stringify(result.portraitFit)}`);
  assert.ok(result.landscapeFit.cardWidth>=400&&result.landscapeFit.cardWidth-result.landscapeFit.imageWidth<=4&&Math.abs(result.landscapeFit.imageAspect-1012/638)<.03, `a landscape card must fill its card frame: ${JSON.stringify(result.landscapeFit)}`);
  console.log('LIFE_WALLET_CARD_CAROUSEL_01 PASS');
}
