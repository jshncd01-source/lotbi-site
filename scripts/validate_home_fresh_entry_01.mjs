// SITE-HOME-FRESH-ENTRY-01
//
// 대표: "자동 로그인으로 들어가면 첫화면이 기존에 대화창으로 뜨는데 새창으로
// 뜨도록 해"
//
// 총괄방's suggested narrowing — apply it only on the auth-handoff return —
// does not work, and that is the first thing this gate pins. site-continuity.js
// keeps the site session in a module variable (siteSessionActive), so every
// load of / while signed in finds no live session, calls beginSiteHandoff(),
// and comes back through /auth/callback/. A mid-conversation refresh takes the
// same road as an auto-login arrival, so the handoff separates nothing.
//
// The tab does. sessionStorage survives a reload and survives the redirect out
// to Account and back (same top-level browsing context), but not a newly
// opened tab or a restarted browser — which is what "들어가면" means.
//
// The four acceptance criteria are all checked against the real runtime below:
//   (1) 자동 로그인 진입          → 빈 새 대화 화면
//   (2) 사이드바에 기존 대화 유지  → 눌러서 이어볼 수 있음
//   (3) 대화 도중 새로고침        → 보던 대화 유지
//   (4) 게스트 → 로그인           → 게스트 경로는 손대지 않음
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const storageModule = fs.readFileSync(path.join(ROOT, 'site-conversation-storage.js'), 'utf8');

// ── Source-level invariants ───────────────────────────────────────────────
// The marker lives in site-conversation-storage.js, with the other conversation
// keys. That is not a detour around validate_conversation_integration's ban on
// sessionStorage.setItem inside the conversation runtime — it is the module
// that owns conversation storage, and the assertions below pin the marker to a
// constant value under a namespace-derived key so it can never carry a bearer.
const helperStart = storageModule.indexOf('export function markConversationTabEntry(');
if (helperStart < 0) throw new Error('the per-tab entry marker helper is missing');
const helper = storageModule.slice(helperStart, storageModule.indexOf('\n}\n', helperStart));
for (const [label, needle] of [
  ['absent storage or namespace', 'if (!key || !sessionStorage) return true;'],
  ['throwing storage', '} catch {\n    return true;\n  }'],
]) {
  if (!helper.includes(needle)) throw new Error(`the entry marker must fail safe on ${label}`);
}
// The key comes only from the namespace, and the value is only ever '1'.
if (!helper.includes('`${STORAGE_PREFIX}.tab-entry.v1.${key}`')) throw new Error('the entry key must be derived from the namespace alone');
if (!helper.includes("sessionStorage.setItem(entryKey, '1')")) throw new Error("the entry marker must write the constant '1'");
if ((helper.match(/setItem\(/g) || []).length !== 1) throw new Error('the entry marker must write exactly once, and only that constant');
if (helper.includes('removeItem') || helper.includes('clear()')) throw new Error('the entry marker must never clear stored conversation keys');
// And the conversation runtime keeps its own hands off sessionStorage, which is
// the bearer guarantee validate_conversation_integration enforces.
if (conversation.includes('sessionStorage.setItem')) throw new Error('the conversation runtime must not write sessionStorage directly');

const switchStart = conversation.indexOf('const switchNamespace = nextNamespace => {');
const switchSource = conversation.slice(switchStart, conversation.indexOf('const canonicalProfileName', switchStart));
if (!switchSource.includes('markConversationTabEntry({namespace})')) throw new Error('switchNamespace must consult the per-tab marker');
// Narrowness, as 총괄방 asked: the anonymous namespace and a continuation that
// carries text to send both keep the behaviour they had.
if (!switchSource.includes('normalized !== anonymousConversationNamespace()')) throw new Error('the guest namespace must keep its old restore behaviour');
if (!switchSource.includes("!(autoSend && typeof initialText === 'string' && initialText.trim())")) throw new Error('an entry carrying text to send must stay a continuation');
// Selection only. A fresh entry may blank the selection and nothing else.
const freshBlock = switchSource.slice(switchSource.indexOf('const freshTabEntry'));
if (!freshBlock.includes('if (freshTabEntry) state.activeThreadId = null;')) throw new Error('a fresh entry must blank the selection');
if (/state\.threads\s*=/.test(freshBlock)) throw new Error('a fresh entry must never drop stored threads');

// Every importer of the storage module must move together, or the browser ends
// up holding two module instances and two views of the marker.
const storageQuery = conversation.match(/site-conversation-storage\.js\?v=([^']+)'/)?.[1] || '';
if (!storageQuery) throw new Error('the storage module import must stay cache-busted');
for (const name of ['site-continuity.js', 'auth-callback.js']) {
  const found = fs.readFileSync(path.join(ROOT, name), 'utf8').match(/site-conversation-storage\.js\?v=([^']+)'/)?.[1] || '';
  if (found !== storageQuery) throw new Error(`${name} imports the storage module as ${found}, not ${storageQuery}`);
}

const PORT = 4231;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const INNER_REL = 'scripts/.fresh-entry-inner.html';
const INNER = path.join(ROOT, INNER_REL);

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const SKELETON = '<aside class="chat-sidebar"><ul data-recent-conversations></ul><div class="sidebar-account-footer"><div class="sidebar-account-slot" data-sidebar-account></div></div></aside>'
  + '<main id="main-content" class="chat-home-shell" tabindex="0"><div data-home-avatar-anchor><div data-lotbi-avatar-container class="chat-character-wrap"><span class="chat-character-logo">LOTBI</span></div></div>'
  + '<div id="conversation-thread" class="conversation-thread" hidden></div><div class="chat-composer-stack"><div id="attachment-preview-strip" data-attachment-preview hidden></div>'
  + '<textarea id="lotbi-prompt" class="chat-input"></textarea><div data-attachment-control><button type="button" data-attachment-trigger aria-expanded="false">+</button>'
  + '<div data-attachment-menu hidden><button type="button" role="menuitem" data-attachment-action="camera">카메라</button><button type="button" role="menuitem" data-attachment-action="photos">사진</button><button type="button" role="menuitem" data-attachment-action="files">파일</button></div>'
  + '<input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files"></div></div>'
  + '<div data-response-grade-control><button type="button" data-response-grade-trigger><span data-response-grade-label>스탠다드</span></button><div data-response-grade-menu hidden>'
  + '<button type="button" data-response-grade="LIGHT"></button><button type="button" data-response-grade="STANDARD"></button><button type="button" data-response-grade="PREMIUM"></button></div></div>'
  + '<button class="send-button" type="button">전송</button><button class="mic-button" type="button">마이크</button><p id="chat-status"></p><div id="chat-state-region" hidden></div></main>';

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css"><link rel="stylesheet" href="/site-sidebar-nav.css"><link rel="stylesheet" href="/site-conversation.css"></head>
<body class="chat-home-page"><main id="root"></main><pre id="fresh-entry-result">pending</pre>
<script type="module">
const root=document.getElementById('root'),out=document.getElementById('fresh-entry-result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{for(let i=0;i<120;i+=1){if(fn())return;await sleep(20)}throw new Error('timeout '+label)};
const click=n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
window.fetch=async()=>new Response('{}',{status:503});
const NS='install-fresh-entry-test';
const threadsKey=ns=>'lotbi.site.ux.v1.threads.'+ns;
const tabKey=ns=>'lotbi.site.ux.v1.tab-entry.v1.'+ns;
const msg=(role,text)=>({role,text,meta:{}});
const seed=(ns,activeThreadId)=>localStorage.setItem(threadsKey(ns),JSON.stringify({threads:[
  {id:'t-new',title:'최근 대화',pinned:false,pinnedAt:0,stateVersion:0,createdAt:200,updatedAt:200,messages:[msg('user','안녕'),msg('assistant','반가워요')]},
  {id:'t-old',title:'지난 대화',pinned:false,pinnedAt:0,stateVersion:0,createdAt:100,updatedAt:100,messages:[msg('user','예전'),msg('assistant','네')]}],activeThreadId,draft:''}));
const active=()=>document.querySelector('[data-recent-conversations] [aria-current="true"]')?.dataset.threadId||null;
const listed=()=>[...document.querySelectorAll('[data-recent-conversations] li')].map(n=>n.dataset.threadId);
const open=()=>document.body.classList.contains('conversation-active');
const rendered=()=>document.querySelectorAll('#conversation-thread .chat-message-body').length;
try{
const storage=await import('/site-conversation-storage.js?v=20260923-freshentry1');
const conversation=await import('/site-conversation.js?v=20260923-freshentry1');
const mount=opts=>{root.innerHTML=\`${SKELETON}\`;document.body.classList.remove('conversation-active');
  if(!conversation.mountConversation(opts))throw new Error('mount failed');};
const report={};

// (1) 자동 로그인 진입 — a tab that has never been in this namespace.
sessionStorage.clear();localStorage.clear();seed(NS,'t-new');
document.body.dataset.siteAuthState='authenticated';
mount({identityKey:NS});
await wait(()=>listed().length===2,'fresh entry list');
report.freshEntry={active:active(),listed:listed(),open:open(),marker:sessionStorage.getItem(tabKey(NS))};

// (2) 사이드바의 기존 대화를 눌러 이어보기.
click(document.querySelector('[data-recent-conversations] [data-thread-id="t-old"].conversation-history-open'));
await wait(()=>open(),'reopen');
report.reopen={active:active(),open:open(),messages:rendered(),stored:JSON.parse(localStorage.getItem(threadsKey(NS))).threads.map(t=>t.id)};

// (3) 대화 도중 새로고침 — same tab, so the marker is still there.
mount({identityKey:NS});
await wait(()=>listed().length===2,'refresh list');
report.refresh={active:active(),open:open(),messages:rendered(),marker:sessionStorage.getItem(tabKey(NS))};

// (4-a) 게스트 경로는 그대로 — the anonymous namespace still restores on a
// first arrival, so nothing ⑱ GUEST-ACCESS owns changes shape.
sessionStorage.clear();
const guestNs=storage.ensureDurableAnonymousConversationNamespace();
seed(guestNs,'t-new');
document.body.dataset.siteAuthState='unauthenticated';
mount({});
await wait(()=>listed().length===2,'guest list');
report.guestFirstArrival={namespace:guestNs,active:active(),open:open(),listed:listed()};

// (4-b) 로그인하며 보낼 말을 들고 들어오는 것은 '도착'이 아니라 '이어쓰기'다.
sessionStorage.clear();seed(NS,'t-new');
document.body.dataset.siteAuthState='authenticated';
root.innerHTML=\`${SKELETON}\`;document.body.classList.remove('conversation-active');
conversation.mountConversation({identityKey:NS,initialText:'이어서 쓸 말',autoSend:true});
report.loginContinuation={active:active(),open:open()};

out.textContent=JSON.stringify({ok:true,report});
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 40; i += 1) {
    if (spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000}).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function run(browser) {
  const r = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1440,900', '--force-device-scale-factor=1', '--virtual-time-budget=9000', '--dump-dom',
    `${ORIGIN}/${INNER_REL}`], {encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="fresh-entry-result">';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf('</pre>', i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${v.error}\n${r.stderr}`);
  return v.report;
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const r = run(browser);
  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}: expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`);
    }
  };
  // (1) blank new conversation, and the threads are untouched behind it.
  eq(r.freshEntry.active, null, '자동 로그인 진입은 기존 대화를 열면 안 됩니다');
  eq(r.freshEntry.open, false, '자동 로그인 진입은 빈 새 대화 화면이어야 합니다');
  eq(r.freshEntry.listed, ['t-new', 't-old'], '진입해도 사이드바의 기존 대화는 그대로 남아야 합니다');
  eq(r.freshEntry.marker, '1', '진입이 이 탭에 기록되어야 다음 새로고침이 복원됩니다');
  // (2) and they reopen.
  eq(r.reopen.active, 't-old', '사이드바의 기존 대화를 눌러 이어볼 수 있어야 합니다');
  eq(r.reopen.open, true, '기존 대화를 누르면 대화 화면이 열려야 합니다');
  eq(r.reopen.messages, 2, '이어본 대화의 메시지가 그대로 보여야 합니다');
  eq(r.reopen.stored, ['t-new', 't-old'], '진입도 재개도 저장된 대화를 지워서는 안 됩니다');
  // (3) the same tab, reloaded, keeps what was open.
  eq(r.refresh.active, 't-old', '대화 도중 새로고침은 보던 대화를 유지해야 합니다');
  eq(r.refresh.open, true, '새로고침 후에도 대화 화면이 열려 있어야 합니다');
  eq(r.refresh.messages, 2, '새로고침 후에도 대화 내용이 그대로여야 합니다');
  // (4) the guest path and the login continuation keep their old behaviour.
  eq(r.guestFirstArrival.active, 't-new', '게스트 네임스페이스는 종전 복원 동작을 유지해야 합니다');
  eq(r.guestFirstArrival.open, true, '게스트 진입 동작은 이번 변경 대상이 아닙니다');
  eq(r.loginContinuation.active, 't-new', '보낼 말을 들고 로그인하는 것은 이어쓰기이지 새 진입이 아닙니다');
  eq(r.loginContinuation.open, true, '이어쓰기 진입은 보던 대화를 유지해야 합니다');
  console.log('SITE-HOME-FRESH-ENTRY-01', JSON.stringify(r));
  console.log('SITE-HOME-FRESH-ENTRY-01 OK — 진입은 새 대화, 새로고침은 보던 대화');
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
}
