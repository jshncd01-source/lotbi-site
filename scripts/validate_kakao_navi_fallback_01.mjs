import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18467;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean)) {
    if (fs.existsSync(name)) return name;
  }
  throw new Error('Chrome/Chromium is required');
}

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const probe = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/kakao-navi.html`], {timeout: 1000});
    if (probe.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

const fixtureDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.kakao-fallback-'));
const relative = `scripts/${path.basename(fixtureDir)}/wrapper.html`;
const wrapper = path.join(ROOT, relative);
const destination = '/kakao-navi.html?name=%EC%84%A0%EC%9C%A0%EB%8F%84%20%EB%A6%AC%EC%A1%B0%ED%8A%B8&x=126.4567891&y=35.8012345&coordType=wgs84';
const iosDestination = '/map-handoff.html?provider=TMAP&native=tmap%3A%2F%2Froute%3Fgoalname%3D%25EC%2584%25A0%25EC%259C%25A0%25EB%258F%2584&fallback=https%3A%2F%2Fmap.naver.com%2Fp%2Fsearch%2F%25EC%2584%25A0%25EC%259C%25A0%25EB%258F%2584';
fs.writeFileSync(wrapper, `<!doctype html><html><body><iframe id="frame" src="${destination}"></iframe><iframe id="ios" src="${iosDestination}"></iframe><pre id="result">pending</pre><script>
const frame=document.getElementById('frame'),ios=document.getElementById('ios'),out=document.getElementById('result');
let ready=0;const read=()=>{if(++ready<2)return;setTimeout(()=>{const doc=frame.contentDocument,kFallback=doc.getElementById('fallback'),iosDoc=ios.contentDocument,iFallback=iosDoc.getElementById('fallback'),launch=iosDoc.getElementById('launch');out.textContent=JSON.stringify({kakao:{hidden:kFallback?.hidden,href:kFallback?.href,text:kFallback?.textContent},ios:{fallbackHidden:iFallback?.hidden,fallbackHref:iFallback?.href,launchHidden:launch?.hidden,launchHref:launch?.href,launchText:launch?.textContent,status:iosDoc.getElementById('status')?.textContent}})},500)};
frame.addEventListener('load',read);ios.addEventListener('load',read);
setTimeout(()=>{if(out.textContent==='pending')out.textContent=JSON.stringify({error:'timeout'})},5000);
<\/script></body></html>`, 'utf8');

let server;
try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
  waitServer();
  const result = spawnSync(browserPath(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors',
    '--virtual-time-budget=7000', '--dump-dom', `${ORIGIN}/${relative}`,
  ], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  if (result.status !== 0) throw new Error(result.stderr);
  const match = result.stdout.match(/<pre id="result">([^<]+)<\/pre>/u);
  assert.ok(match, 'browser result missing');
  const reading = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
  assert.equal(reading.kakao.hidden, false);
  assert.equal(reading.kakao.text.trim(), '카카오맵 웹 길찾기');
  assert.equal(reading.kakao.href, 'https://map.kakao.com/link/to/%EC%84%A0%EC%9C%A0%EB%8F%84%20%EB%A6%AC%EC%A1%B0%ED%8A%B8,35.8012345,126.4567891');
  assert.equal(reading.ios.launchHidden, false);
  assert.match(reading.ios.launchHref, /^tmap:\/\//u);
  assert.equal(reading.ios.launchText.trim(), '티맵 앱 열기');
  assert.equal(reading.ios.fallbackHidden, false);
  assert.match(reading.ios.fallbackHref, /^https:\/\/map\.naver\.com\/p\/search\//u);
  assert.match(reading.ios.status, /앱이 열리지 않으면/u);
} finally {
  server?.kill();
  fs.rmSync(fixtureDir, {recursive: true, force: true});
}

console.log('Kakao/iOS map no-dead-end fallback contract: PASS');
