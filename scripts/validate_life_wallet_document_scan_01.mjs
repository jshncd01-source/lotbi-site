import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'scripts/.life-wallet-document-scan-fixture.html';
const FIXTURE = path.join(ROOT, FIXTURE_REL);
const PORT = 21_000 + (process.pid % 20_000);
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required for the Life Wallet scan validation.');
}

const fixture = `<!doctype html><html><body><pre id="result">pending</pre><script type="module">
const out = document.getElementById('result');
const point = (x, y) => ({x, y});
try {
  const scan = await import('/site-life-wallet-scan.js?test=1');
  const ordered = scan.orderDocumentCorners([point(440,275), point(70,55), point(50,285), point(420,40)]);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 320;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  context.fillStyle = '#18212d'; context.fillRect(0,0,480,320);
  context.beginPath(); context.moveTo(70,55); context.lineTo(420,40); context.lineTo(440,275); context.lineTo(50,285); context.closePath();
  context.fillStyle = '#e9dcae'; context.fill(); context.lineWidth = 8; context.strokeStyle = '#ffffff'; context.stroke();
  context.fillStyle = '#315c7d'; context.fillRect(150,115,190,18); context.fillRect(150,155,150,12); context.fillRect(150,185,210,12);
  const automatic = scan.detectDocumentCorners(context.getImageData(0,0,480,320));
  const corrected = await scan.rectifyDocument(canvas, automatic.corners, {enhance:false});
  const correctedImage = new Image(); correctedImage.src = corrected.dataUrl; await correctedImage.decode();
  const correctedCanvas = document.createElement('canvas'); correctedCanvas.width = corrected.width; correctedCanvas.height = corrected.height;
  const correctedContext = correctedCanvas.getContext('2d', {willReadFrequently:true}); correctedContext.drawImage(correctedImage,0,0);
  const correctedPixels = correctedContext.getImageData(0,0,corrected.width,corrected.height);
  const sample = (x,y) => Array.from(correctedPixels.data.slice((y*corrected.width+x)*4,(y*corrected.width+x)*4+3));

  const large = document.createElement('canvas'); large.width=2600; large.height=1600;
  const largeContext=large.getContext('2d'); largeContext.fillStyle='#d8c28b'; largeContext.fillRect(0,0,2600,1600);
  const largeResult=await scan.rectifyDocument(large,{topLeft:point(0,0),topRight:point(2599,0),bottomRight:point(2599,1599),bottomLeft:point(0,1599)},{enhance:false});
  const small = document.createElement('canvas'); small.width=160; small.height=100;
  const smallContext=small.getContext('2d'); smallContext.fillStyle='#d8c28b'; smallContext.fillRect(0,0,160,100);
  const smallResult=await scan.rectifyDocument(small,{topLeft:point(0,0),topRight:point(159,0),bottomRight:point(159,99),bottomLeft:point(0,99)},{enhance:false});

  const qualityCanvas=document.createElement('canvas'); qualityCanvas.width=240; qualityCanvas.height=140;
  const qualityContext=qualityCanvas.getContext('2d',{willReadFrequently:true}); qualityContext.fillStyle='#888'; qualityContext.fillRect(0,0,240,140); qualityContext.fillStyle='#fff'; qualityContext.fillRect(0,0,120,140);
  const quality=scan.assessDocumentQuality(qualityContext.getImageData(0,0,240,140),{corners:{topLeft:point(0,0),topRight:point(239,0),bottomRight:point(239,139),bottomLeft:point(0,139)}});

  const low = document.createElement('canvas'); low.width = 480; low.height = 320;
  const lowContext = low.getContext('2d', {willReadFrequently:true});
  lowContext.fillStyle = '#777'; lowContext.fillRect(0,0,480,320);
  for (let x=0; x<480; x+=16) { lowContext.fillStyle = x % 32 ? '#797979' : '#757575'; lowContext.fillRect(x,0,16,320); }
  const manual = scan.detectDocumentCorners(lowContext.getImageData(0,0,480,320));
  out.textContent = JSON.stringify({ok:true, ordered, automatic, manual, corrected:{...corrected,dataUrl:corrected.dataUrl.slice(0,32),corners:[sample(2,2),sample(corrected.width-3,2),sample(corrected.width-3,corrected.height-3),sample(2,corrected.height-3)],colorSample:sample(Math.round(corrected.width*.75),Math.round(corrected.height*.75))},largeResult:{width:largeResult.width,height:largeResult.height},smallResult:{width:smallResult.width,height:smallResult.height},quality});
} catch (error) { out.textContent = JSON.stringify({ok:false,error:String(error?.stack||error)}); }
</script></body></html>`;

fs.writeFileSync(FIXTURE, fixture, 'utf8');
const python = process.platform === 'win32' ? 'python' : 'python3';
const server = spawn(python, ['-m','http.server',String(PORT),'--bind','127.0.0.1'], {cwd:ROOT,stdio:'ignore'});
try {
  for (let attempt=0; attempt<50; attempt+=1) {
    const ready=spawnSync('curl',['--fail','--silent',`${ORIGIN}/${FIXTURE_REL}`],{timeout:1000});
    if (ready.status===0) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
    if (attempt===49) throw new Error('fixture server did not start');
  }
  const run = spawnSync(browserPath(), ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=2000','--dump-dom',`${ORIGIN}/${FIXTURE_REL}`], {encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  if (run.error) throw run.error;
  const match = run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/u);
  assert.ok(match, `scan result missing: ${run.stderr}`);
  const result = JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.ordered, {topLeft:{x:70,y:55},topRight:{x:420,y:40},bottomRight:{x:440,y:275},bottomLeft:{x:50,y:285}});
  assert.equal(result.automatic.mode, 'automatic');
  assert.ok(result.automatic.confidence >= 0.75, `automatic confidence ${result.automatic.confidence}`);
  const expected = [{x:70,y:55},{x:420,y:40},{x:440,y:275},{x:50,y:285}];
  const actual = [result.automatic.corners.topLeft,result.automatic.corners.topRight,result.automatic.corners.bottomRight,result.automatic.corners.bottomLeft];
  actual.forEach((corner,index) => assert.ok(Math.hypot(corner.x-expected[index].x,corner.y-expected[index].y)<=12, `corner ${index} is too far: ${JSON.stringify(corner)}`));
  assert.equal(result.manual.mode, 'manual', `low-contrast pattern was misclassified: ${JSON.stringify(result.manual)}`);
  for (const corner of Object.values(result.manual.corners)) {
    assert.ok(corner.x > 0 && corner.x < 480 && corner.y > 0 && corner.y < 320, `manual corner outside source: ${JSON.stringify(corner)}`);
  }
  assert.ok(result.corrected.dataUrl.startsWith('data:image/jpeg;base64,'), 'corrected output must be a JPEG data URL');
  assert.ok(Math.abs(result.corrected.width/result.corrected.height-1.584)<0.08, `corrected ratio ${result.corrected.width/result.corrected.height}`);
  assert.ok(Math.max(result.corrected.width,result.corrected.height)<=480, 'a small source must not be enlarged');
  for (const rgb of result.corrected.corners) assert.ok(rgb.reduce((sum,value)=>sum+value,0)>250, `background remained in corrected corner: ${rgb}`);
  assert.ok(Math.abs(result.corrected.colorSample[0]-233)<30 && Math.abs(result.corrected.colorSample[1]-220)<30, `enhance:false changed document colors: ${result.corrected.colorSample}`);
  assert.equal(result.corrected.enhanced,false);
  assert.ok(Math.max(result.largeResult.width,result.largeResult.height)<=2048, `large result exceeded cap: ${JSON.stringify(result.largeResult)}`);
  assert.ok(result.smallResult.width<=160 && result.smallResult.height<=100, `small result was enlarged: ${JSON.stringify(result.smallResult)}`);
  for (const warning of ['blur','glare','low-resolution','edge-clipped']) assert.ok(result.quality.includes(warning), `missing quality warning ${warning}: ${result.quality}`);
  console.log('LIFE_WALLET_DOCUMENT_SCAN_01 PASS');
} finally {
  server.kill();
  fs.rmSync(FIXTURE,{force:true});
}
