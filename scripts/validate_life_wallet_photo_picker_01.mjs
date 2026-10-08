import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'scripts/.life-wallet-photo-picker-fixture.html';
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
  throw new Error('Chrome/Chromium is required for the Life Wallet photo picker validation.');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css">
<style>body{margin:0;padding:24px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:680px;margin:0 auto}</style>
</head><body><main id="host"></main><pre id="result">pending</pre>
<script type="module">
const out=document.getElementById('result');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(predicate,label)=>{for(let attempt=0;attempt<200;attempt+=1){const value=predicate();if(value)return value;await sleep(25)}throw new Error('timed out '+label+' scanner='+document.querySelector('.wallet-scan-editor')?.dataset.scanState+' disabled='+document.querySelector('[data-wallet-scan-confirm]')?.disabled)};
try{
  const {createWalletPhotoPicker}=await import('/site-life-wallet.js?photo-picker-test=1');
  const errors=[];
  let ready=false;
  const picker=createWalletPhotoPicker({onError:message=>errors.push(message),onReady:()=>{ready=true}});
  document.getElementById('host').append(picker.element);
  const input=picker.input;
  const trigger=picker.element.querySelector('.wallet-photo-action');
  const mark=picker.element.querySelector('.wallet-photo-mark');
  const preview=picker.element.querySelector('img');
  let inputClicks=0;
  input.addEventListener('click',()=>{inputClicks+=1});
  mark.click();
  const plusInputClicks=inputClicks;
  trigger.click();
  const allInputClicks=inputClicks;

  const invalidTransfer=new DataTransfer();
  invalidTransfer.items.add(new File([new Uint8Array([1,2,3])],'wrong.gif',{type:'image/gif'}));
  input.files=invalidTransfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(60);

  const source=document.createElement('canvas');source.width=480;source.height=320;const context=source.getContext('2d');context.fillStyle='#18212d';context.fillRect(0,0,480,320);context.beginPath();context.moveTo(70,55);context.lineTo(420,40);context.lineTo(440,275);context.lineTo(50,285);context.closePath();context.fillStyle='#e9dcae';context.fill();context.lineWidth=8;context.strokeStyle='#fff';context.stroke();for(let row=0;row<5;row+=1)for(let glyph=0;glyph<18;glyph+=1){context.fillStyle='#2a2a2a';context.fillRect(125+glyph*13,98+row*30,8,10)};
  const png=await new Promise(resolve=>source.toBlob(resolve,'image/png'));
  globalThis.createImageBitmap=async()=>source;
  const validTransfer=new DataTransfer();
  validTransfer.items.add(new File([png],'wallet-card.png',{type:'image/png'}));
  input.files=validTransfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  const confirm=await wait(()=>{const candidate=picker.element.querySelector('[data-wallet-scan-confirm]');return candidate&&!candidate.disabled&&picker.element.querySelector('[data-scan-state="review"]')?candidate:null},'enabled scan confirmation');
  // While the photo is being corrected the change button stays a small outlined button and
  // leaves room for the full hint text.
  const scanningAction=picker.element.querySelector('.wallet-photo-action');const scanningHint=picker.element.querySelector('.wallet-photo-copy small');
  const scanning={text:scanningAction.textContent,secondary:scanningAction.classList.contains('consumer-action-secondary'),actionWidth:scanningAction.getBoundingClientRect().width,actionHeight:scanningAction.getBoundingClientRect().height,hintClipped:scanningHint.scrollWidth>scanningHint.clientWidth+1,hintWidth:scanningHint.getBoundingClientRect().width};
  confirm.click();
  await wait(()=>ready,'photo ready callback');
  const selectedDataUrl=await picker.readDataUrl();
  const inputRect=input.getBoundingClientRect();
  const pickerRect=picker.element.getBoundingClientRect();
  out.textContent=JSON.stringify({
    ok:true,
    scanning,
    accept:input.accept,
    pdfAccept:picker.pdfInput.accept,
    capture:[input,picker.pdfInput].some(field=>field.hasAttribute('capture')),
    markTag:mark.tagName,
    plusInputClicks,
    allInputClicks,
    inputHidden:inputRect.width<=1&&inputRect.height<=1,
    initialError:errors.find(Boolean)||'',
    selectedDataUrl:selectedDataUrl.startsWith('data:image/jpeg;base64,'),
    previewVisible:!preview.hidden&&preview.src.startsWith('data:image/jpeg;base64,'),
    previewAlt:preview.alt,
    buttonText:trigger.textContent,
    fileName:picker.element.textContent.includes('wallet-card.png'),
    overflow:pickerRect.right>document.documentElement.clientWidth,
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
  if (start < 0 || end < 0) throw new Error('photo picker result missing');
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
    '--window-size=390,844', '--force-device-scale-factor=1', '--virtual-time-budget=8000',
    '--dump-dom', `${ORIGIN}/${FIXTURE_REL}`,
  ], {encoding: 'utf8', timeout: 40000, maxBuffer: 8 * 1024 * 1024});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const result = readResult(run.stdout);
  // One image type per picker: Android then offers camera and gallery only (no camcorder or
  // voice recorder); PDFs have their own picker.
  assert.equal(result.accept, 'image/*', 'the photo picker must accept still images only');
  assert.equal(result.pdfAccept, 'application/pdf', 'PDFs must use their own picker');
  assert.equal(result.capture, false, 'the pickers must not force the camera');
  assert.equal(result.scanning.text, '다시 선택');
  assert.equal(result.scanning.secondary, true, `the change button must be an outlined secondary button, not a large black one: ${JSON.stringify(result.scanning)}`);
  assert.ok(result.scanning.actionWidth <= 120 && result.scanning.actionHeight <= 40, `the change button must stay compact: ${JSON.stringify(result.scanning)}`);
  assert.equal(result.scanning.hintClipped, false, `the hint text must not be cut off: ${JSON.stringify(result.scanning)}`);
  assert.ok(result.scanning.hintWidth >= 140, `the hint text needs room beside the button: ${JSON.stringify(result.scanning)}`);
  assert.equal(result.markTag, 'BUTTON', 'the plus tile must expose its click behavior as a button');
  assert.equal(result.plusInputClicks, 1, 'clicking the plus tile must activate the real file input');
  assert.equal(result.allInputClicks, 2, 'both visible photo actions must activate the real file input');
  assert.equal(result.inputHidden, true, 'the native file input must not remain visibly laid out');
  assert.equal(result.initialError, '사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다.', 'unsupported files (such as GIF) must still be rejected');
  assert.equal(result.selectedDataUrl, true, 'the selected image must be available to the existing encrypted save flow');
  assert.equal(result.previewVisible, true, 'a selected image must show an immediate preview');
  assert.equal(result.previewAlt, '보정된 wallet-card.png 미리보기', 'the preview must identify the corrected image');
  assert.equal(result.buttonText, '사진 변경', 'the action must change after a photo is selected');
  assert.equal(result.fileName, true, 'the selected filename must be visible');
  assert.equal(result.overflow, false, 'the custom picker must fit a 390px mobile viewport');
  console.log('LIFE_WALLET_PHOTO_PICKER_01 PASS');
} finally {
  server.kill();
  fs.rmSync(FIXTURE, {force: true});
}
