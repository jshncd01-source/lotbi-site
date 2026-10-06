import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'scripts/.life-wallet-card-carousel-fixture.html';
const FIXTURE = path.join(ROOT, FIXTURE_REL);
const PORT = 20_000 + (process.pid % 20_000);
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const found = spawnSync(finder, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required for the Life Wallet carousel validation.');
}

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
  });
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const request = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (request.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('fixture server did not start');
}

function readResult(output) {
  const startTag = '<pre id="result">';
  const start = output.indexOf(startTag);
  const end = output.indexOf('</pre>', start);
  if (start < 0 || end < 0) throw new Error('card carousel result missing');
  const raw = output.slice(start + startTag.length, end)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const result = JSON.parse(raw);
  if (!result.ok) throw new Error(result.error);
  return result;
}

fs.writeFileSync(FIXTURE, fixture, 'utf8');
const python = process.platform === 'win32' ? 'python' : 'python3';
const server = spawn(python, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitForServer();
  const run = spawnSync(browserPath(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1200,844', '--force-device-scale-factor=1', '--virtual-time-budget=1500',
    '--dump-dom', `${ORIGIN}/${FIXTURE_REL}`,
  ], {encoding: 'utf8', timeout: 40000, maxBuffer: 8 * 1024 * 1024});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const result = readResult(run.stdout);
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
  console.log('LIFE_WALLET_CARD_CAROUSEL_01 PASS');
} finally {
  server.kill();
  fs.rmSync(FIXTURE, {force: true});
}
