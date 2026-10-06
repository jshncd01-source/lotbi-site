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

  const low = document.createElement('canvas'); low.width = 480; low.height = 320;
  const lowContext = low.getContext('2d', {willReadFrequently:true});
  lowContext.fillStyle = '#777'; lowContext.fillRect(0,0,480,320);
  for (let x=0; x<480; x+=16) { lowContext.fillStyle = x % 32 ? '#797979' : '#757575'; lowContext.fillRect(x,0,16,320); }
  const manual = scan.detectDocumentCorners(lowContext.getImageData(0,0,480,320));
  out.textContent = JSON.stringify({ok:true, ordered, automatic, manual});
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
  console.log('LIFE_WALLET_DOCUMENT_SCAN_01 PASS');
} finally {
  server.kill();
  fs.rmSync(FIXTURE,{force:true});
}
