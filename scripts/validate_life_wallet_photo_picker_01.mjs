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
try{
  const {createWalletPhotoPicker}=await import('/site-life-wallet.js?photo-picker-test=1');
  const errors=[];
  const picker=createWalletPhotoPicker({onError:message=>errors.push(message)});
  document.getElementById('host').append(picker.element);
  const input=picker.input;
  const trigger=picker.element.querySelector('button');
  const preview=picker.element.querySelector('img');
  let inputClicks=0;
  input.addEventListener('click',()=>{inputClicks+=1});
  trigger.click();

  const invalidTransfer=new DataTransfer();
  invalidTransfer.items.add(new File([new Uint8Array([1,2,3])],'wrong.gif',{type:'image/gif'}));
  input.files=invalidTransfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(60);

  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const validTransfer=new DataTransfer();
  validTransfer.items.add(new File([png],'wallet-card.png',{type:'image/png'}));
  input.files=validTransfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(80);
  const selectedDataUrl=await picker.readDataUrl();
  const inputRect=input.getBoundingClientRect();
  const pickerRect=picker.element.getBoundingClientRect();
  out.textContent=JSON.stringify({
    ok:true,
    accept:input.accept,
    inputClicks,
    inputHidden:inputRect.width<=1&&inputRect.height<=1,
    initialError:errors.find(Boolean)||'',
    selectedDataUrl:selectedDataUrl.startsWith('data:image/png;base64,'),
    previewVisible:!preview.hidden&&preview.src.startsWith('data:image/png;base64,'),
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
    '--window-size=390,844', '--force-device-scale-factor=1', '--virtual-time-budget=1500',
    '--dump-dom', `${ORIGIN}/${FIXTURE_REL}`,
  ], {encoding: 'utf8', timeout: 40000, maxBuffer: 8 * 1024 * 1024});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const result = readResult(run.stdout);
  assert.equal(result.accept, 'image/jpeg,image/png', 'the picker must limit selection to JPEG and PNG');
  assert.equal(result.inputClicks, 1, 'the visible photo button must activate the real file input');
  assert.equal(result.inputHidden, true, 'the native file input must not remain visibly laid out');
  assert.equal(result.initialError, 'JPEG 또는 PNG 이미지만 등록할 수 있습니다.', 'unsupported images must keep the existing validation');
  assert.equal(result.selectedDataUrl, true, 'the selected image must be available to the existing encrypted save flow');
  assert.equal(result.previewVisible, true, 'a selected image must show an immediate preview');
  assert.equal(result.previewAlt, 'wallet-card.png 미리보기', 'the preview must have a useful accessible name');
  assert.equal(result.buttonText, '사진 변경', 'the action must change after a photo is selected');
  assert.equal(result.fileName, true, 'the selected filename must be visible');
  assert.equal(result.overflow, false, 'the custom picker must fit a 390px mobile viewport');
  console.log('LIFE_WALLET_PHOTO_PICKER_01 PASS');
} finally {
  server.kill();
  fs.rmSync(FIXTURE, {force: true});
}
