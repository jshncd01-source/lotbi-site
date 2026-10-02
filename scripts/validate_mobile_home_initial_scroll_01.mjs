import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'scripts/.mobile-home-initial-scroll-inner.html';
const FIXTURE = path.join(ROOT, FIXTURE_REL);

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for mobile Home scroll validation.');
}

const skeleton = `
  <aside class="chat-sidebar">
    <button type="button" data-new-conversation>새 대화</button>
    <ul data-recent-conversations></ul>
    <div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div>
  </aside>
  <main id="main-content" class="chat-home-shell" tabindex="0" style="display:block;height:844px;max-height:844px;overflow-y:auto">
    <section class="chat-hero">
      <div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div>
      <div id="conversation-thread" class="conversation-thread" hidden></div>
      <div class="chat-composer-stack">
        <div id="attachment-preview-strip" data-attachment-preview hidden></div>
        <textarea id="lotbi-prompt" class="chat-input"></textarea>
        <div data-attachment-control>
          <button type="button" data-attachment-trigger aria-expanded="false">+</button>
          <div data-attachment-menu hidden>
            <button type="button" role="menuitem" data-attachment-action="camera">카메라</button>
            <button type="button" role="menuitem" data-attachment-action="photos">사진</button>
            <button type="button" role="menuitem" data-attachment-action="files">파일</button>
          </div>
          <input type="file" data-attachment-input="camera">
          <input type="file" data-attachment-input="photos">
          <input type="file" data-attachment-input="files">
        </div>
      </div>
      <div data-response-grade-control>
        <button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button>
        <div data-response-grade-menu hidden>
          <button type="button" data-response-grade="LIGHT"></button>
          <button type="button" data-response-grade="STANDARD"></button>
          <button type="button" data-response-grade="PREMIUM"></button>
        </div>
      </div>
      <button class="send-button" type="button">전송</button>
      <button class="mic-button" type="button">마이크</button>
      <p id="chat-status"></p>
      <div id="chat-state-region" hidden></div>
    </section>
    <section style="height:1800px">이전 섹션</section>
  </main>`;

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden}
.chat-home-shell{height:844px;overflow-y:auto}
.chat-hero{min-height:844px}
</style></head><body class="chat-home-page"><div id="root"></div>
<pre id="mobile-home-scroll-result">pending</pre>
<script type="module">
const root=document.getElementById('root');
const out=document.getElementById('mobile-home-scroll-result');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  localStorage.clear(); sessionStorage.clear(); root.innerHTML=\`${skeleton}\`;
  const {mountConversation}=await import('/site-conversation.js?v=mobile-home-scroll-test');
  if(!mountConversation({})) throw new Error('conversation mount failed');
  const main=document.getElementById('main-content');
  await sleep(200);
  main.scrollTop=900;
  const before=main.scrollTop;
  window.dispatchEvent(new Event('pageshow'));
  await sleep(50);
  out.textContent=JSON.stringify({ok:true,before,after:main.scrollTop,scrollHeight:main.scrollHeight,clientHeight:main.clientHeight,conversationActive:document.body.classList.contains('conversation-active')});
} catch(error) {
  out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)});
}
</script></body></html>`;

function decodeHtml(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => {
      clearTimeout(timer);
      resolve(Number.parseInt(String(chunk).trim(), 10));
    });
  });
}

fs.writeFileSync(FIXTURE, fixture, 'utf8');
const server = startServer();
try {
  const port = await serverPort(server);
  const browser = browserPath();
  const run = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=500,944', '--force-device-scale-factor=1', '--virtual-time-budget=4000', '--dump-dom',
    `http://127.0.0.1:${port}/${FIXTURE_REL}`,
  ], {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`browser failed (${run.status}): ${run.stderr}`);
  const match = run.stdout.match(/<pre id="mobile-home-scroll-result">([^<]+)<\/pre>/);
  if (!match) throw new Error('mobile Home scroll result missing');
  const result = JSON.parse(decodeHtml(match[1]));
  if (!result.ok) throw new Error(result.error);
  console.log('MOBILE_HOME_INITIAL_SCROLL_390x844 PROBE', JSON.stringify(result));
  assert.ok(result.before > 0, 'fixture must begin below the hero');
  assert.equal(result.conversationActive, false, 'new conversation must show blank Home');
  assert.equal(result.after, 0, 'blank Home must return its scroll container to the header and hero');
  console.log('MOBILE_HOME_INITIAL_SCROLL_390x844=PASS', JSON.stringify(result));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(FIXTURE, {force: true});
}
