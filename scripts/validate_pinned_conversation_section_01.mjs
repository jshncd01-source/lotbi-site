// SITE-PINNED-CONVERSATION-SECTION-01
//
// A pinned conversation is a separate navigation group, not merely the first
// row in Recent conversations. This drives the real conversation runtime so a
// regression that sends pinned rows back into Recent fails at the user-facing
// DOM boundary.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4237;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const INNER_REL = 'scripts/.pinned-conversation-section-inner.html';
const INNER = path.join(ROOT, INNER_REL);

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error('Chrome/Chromium is required');
}

const SKELETON = `
  <aside class="chat-sidebar">
    <section data-pinned-conversations-section hidden>
      <h2>고정</h2>
      <ul data-pinned-conversations aria-label="고정 대화 목록"></ul>
    </section>
    <section>
      <h2>최근 대화</h2>
      <ul data-recent-conversations aria-label="최근 대화 목록"></ul>
    </section>
    <div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div>
  </aside>
  <main id="main-content" class="chat-home-shell" tabindex="0">
    <div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div>
    <div id="conversation-thread" class="conversation-thread" hidden></div>
    <div class="chat-composer-stack">
      <div id="attachment-preview-strip" data-attachment-preview hidden></div>
      <textarea id="lotbi-prompt" class="chat-input"></textarea>
      <div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button>
        <div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div>
        <input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files">
      </div>
    </div>
    <div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden><button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div>
    <button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div>
  </main>`;

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body class="chat-home-page">
<div id="root"></div><pre id="result">pending</pre>
<script type="module">
const root=document.getElementById('root'),out=document.getElementById('result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<120;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
window.fetch=async()=>new Response('{}',{status:503});
const NS='pinned-conversation-section-test';
const key='lotbi.site.ux.v1.threads.'+NS;
const message=text=>({role:'user',text,meta:{}});
localStorage.clear();sessionStorage.clear();
localStorage.setItem(key,JSON.stringify({threads:[
  {id:'t-pin',title:'고정할 대화',pinned:true,pinnedAt:300,stateVersion:0,createdAt:300,updatedAt:300,messages:[message('고정')]},
  {id:'t-new',title:'새 최근 대화',pinned:false,pinnedAt:0,stateVersion:0,createdAt:200,updatedAt:200,messages:[message('새 대화')]},
  {id:'t-old',title:'이전 최근 대화',pinned:false,pinnedAt:0,stateVersion:0,createdAt:100,updatedAt:100,messages:[message('이전 대화')]}
],activeThreadId:null,draft:''}));
const ids=selector=>[...document.querySelectorAll(selector+' li')].map(node=>node.dataset.threadId);
const snapshot=()=>({
  pinned:ids('[data-pinned-conversations]'),
  recent:ids('[data-recent-conversations]'),
  pinnedHidden:document.querySelector('[data-pinned-conversations-section]').hidden,
  headings:[...document.querySelectorAll('aside h2')].map(node=>node.textContent.trim()),
});
try{
  document.body.dataset.siteAuthState='authenticated';
  const conversation=await import('/site-conversation.js?v=pinned-section-test');
  root.innerHTML=\`${SKELETON}\`;
  if(!conversation.mountConversation({identityKey:NS}))throw new Error('mount failed');
  await wait(()=>document.querySelectorAll('.conversation-history-item').length===3,'initial rows');
  const initial=snapshot();
  let afterPin=null,afterUnpin=null;
  if(initial.pinned.length===1&&initial.recent.length===2&&!initial.pinnedHidden){
    click(document.querySelector('[data-recent-conversations] [data-thread-id="t-new"] [data-conversation-action="pin"]'));
    await wait(()=>ids('[data-pinned-conversations]').length===2,'pin move');
    afterPin=snapshot();

    click(document.querySelector('[data-pinned-conversations] [data-thread-id="t-pin"] [data-conversation-action="pin"]'));
    await wait(()=>ids('[data-recent-conversations]').includes('t-pin'),'unpin move');
    afterUnpin=snapshot();
  }
  out.textContent=JSON.stringify({ok:true,initial,afterPin,afterUnpin});
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error?.stack||error)})}
</script></body></html>`;

function pythonCommand() {
  for (const candidate of ['python3', 'python']) {
    const found = spawnSync(candidate, ['--version'], {encoding: 'utf8'});
    if (found.status === 0) return candidate;
  }
  throw new Error('Python is required for the local static server');
}

function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (response.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('local server did not start');
}

function run(browser) {
  const result = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1280,800', '--virtual-time-budget=8000', '--dump-dom', `${ORIGIN}/${INNER_REL}`,
  ], {encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`browser exited ${result.status}: ${result.stderr}`);
  const marker = '<pre id="result">';
  const start = result.stdout.indexOf(marker);
  const end = result.stdout.indexOf('</pre>', start);
  if (start < 0 || end < 0) throw new Error('browser result missing');
  const raw = result.stdout.slice(start + marker.length, end)
    .replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const value = JSON.parse(raw);
  if (!value.ok) throw new Error(value.error);
  return value;
}

const equal = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`);
  }
};

fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn(pythonCommand(), ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitForServer();
  const result = run(browserPath());
  equal(result.initial.headings, ['고정', '최근 대화'], '고정 구역은 최근 대화 위에 있어야 합니다');
  equal(result.initial.pinned, ['t-pin'], '고정 대화는 고정 구역에만 보여야 합니다');
  equal(result.initial.recent, ['t-new', 't-old'], '최근 대화에는 고정되지 않은 대화만 보여야 합니다');
  equal(result.initial.pinnedHidden, false, '고정 대화가 있으면 고정 구역을 보여야 합니다');
  equal(result.afterPin.pinned, ['t-new', 't-pin'], '새로 고정한 대화는 즉시 고정 구역으로 이동해야 합니다');
  equal(result.afterPin.recent, ['t-old'], '새로 고정한 대화는 최근 대화에서 빠져야 합니다');
  equal(result.afterUnpin.pinned, ['t-new'], '고정 해제한 대화는 고정 구역에서 빠져야 합니다');
  equal(result.afterUnpin.recent, ['t-pin', 't-old'], '고정 해제한 대화는 최신순 최근 대화로 돌아가야 합니다');
  console.log('SITE-PINNED-CONVERSATION-SECTION-01 PASS', JSON.stringify(result));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
}
