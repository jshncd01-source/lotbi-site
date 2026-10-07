// SITE-CHAT-ANSWER-RECOVERY-01 (2026-10-07) — an answer the reader left before
// it arrived comes back when they return, once, from the same request.
//
// Production: a long search or analysis finished on the server after the
// person closed the tab or locked the phone, and the conversation they came
// back to ended in their own question. Core had the answer stored on the
// logical request; nothing asked for it again.
//
// Measured in a real browser (DevTools protocol, real time) against the real
// index.html with a fake Core:
//   1. send, leave before the answer (navigate away), come back:
//      Core first says the same request is still running (409), then answers;
//      the answer appears exactly once, from the same Idempotency-Key, and the
//      pending record is cleared.
//   2. a terminal error while recovering is shown and the record is cleared.
//   3. /?conversation=<thread id> opens that stored conversation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
for (const needle of [
  "storageKey(namespace, 'pending-turns')",
  'rememberPendingTurn({threadId: activeConversationId, key: guestRequestId',
  'rememberPendingTurn({threadId: activeConversationId, key: authenticatedRequestId',
  'forgetPendingTurn(guestRequestId);',
  'forgetPendingTurn(authenticatedRequestId);',
  "void requestAssistant(turn.text, false, turn.key, turn.turnCreatedAt, {recovering: true});",
  "document.addEventListener('visibilitychange', () => {\n    if (document.visibilityState === 'visible') schedulePendingTurnResume();",
  "new URLSearchParams(window.location.search).get('conversation')",
]) assert.ok(conversation.includes(needle), `answer recovery contract missing: ${needle}`);
// The record holds a question and an opaque key only - no session, token or answer.
const rememberCalls = conversation.match(/rememberPendingTurn\(\{[^}]*\}\)/g) || [];
assert.equal(rememberCalls.length, 2, 'both conversation paths remember their pending turn');
for (const call of rememberCalls) {
  assert.ok(!/token|session|answer|recentContext/i.test(call.replace('threadId', '')), `pending record must not carry secrets or answers: ${call}`);
}

// ── Browser ─────────────────────────────────────────────────────────────
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
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the answer recovery validation.');
}

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('rc-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
const params = new URLSearchParams(location.search);
const PHASE = params.get('phase') || 'send';
const log = JSON.parse(sessionStorage.getItem('rc-log') || '[]');
const remember = entry => { log.push(entry); sessionStorage.setItem('rc-log', JSON.stringify(log)); };
try {
  if (PHASE === 'send' || PHASE === 'send-fail' || PHASE === 'deeplink-setup') { localStorage.clear(); sessionStorage.removeItem('rc-log'); log.length = 0; }
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
  const answer = (text, key) => json({
    contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',assistant_text:text,
    response_mode:'PLACE_PROVIDER_READONLY',correlation_id:'req_rc_'+key.slice(-6),
    intent:{action:'UNKNOWN'},follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
    safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
    retry_safe:true,
  });
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const key = new Headers(init.headers).get('Idempotency-Key');
      const text = JSON.parse(init.body).text;
      remember({phase: PHASE, key, text});
      if (PHASE === 'send') return new Promise(() => {});           // the reader leaves first
      if (PHASE === 'resume') {
        const seen = log.filter(item => item.phase === 'resume' && item.key === key).length;
        if (seen === 1) return json({detail:{code:'GUEST_AI_REQUEST_IN_PROGRESS',message:'같은 메시지를 아직 처리하고 있어요.',retryable:true}}, 409);
        return answer('전주 효자동에서 확인한 내과 1곳이에요.', key);
      }
      if (PHASE === 'send-fail') return new Promise(() => {});
      if (PHASE === 'resume-fail') return json({detail:{code:'GUEST_AI_OUTCOME_UNCERTAIN',message:'이번 답변을 끝맺지 못했어요.',retryable:false}}, 409);
      return answer('답변이에요.', key);
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=answer-recovery');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, tries = 400) => {
    for (let i = 0; i < tries; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const prompt = document.getElementById('lotbi-prompt');
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const pending = () => Object.entries(localStorage).filter(([k]) => k.includes('.pending-turns.')).map(([, v]) => JSON.parse(v));
  const send = text => {
    prompt.value = text;
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.send-button').dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
  };
  if (PHASE === 'send' || PHASE === 'send-fail') {
    send('전주 효자동 내과 찾아줘');
    await wait(() => pending().length === 1, 'pending recorded');
    out.textContent = JSON.stringify({ok:true, phase:PHASE, pending: pending(), requests: log});
  } else if (PHASE === 'resume' || PHASE === 'resume-fail') {
    if (PHASE === 'resume') {
      await wait(() => assistants().length >= 1, 'recovered answer', 600);
      await sleep(3200);
    } else {
      await wait(() => document.querySelector('.chat-message-error'), 'recovery error', 600);
      await sleep(400);
    }
    const thread = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('.threads.'))[1]);
    const messages = thread.threads[0].messages;
    out.textContent = JSON.stringify({
      ok:true, phase:PHASE,
      assistants: assistants().map(n => n.querySelector('.chat-message-body')?.textContent || ''),
      loading: document.querySelectorAll('.chat-message-loading').length,
      errors: document.querySelectorAll('.chat-message-error').length,
      stored: messages.map(m => m.role + ':' + m.text),
      pending: pending(),
      requests: log,
    });
  } else if (PHASE === 'deeplink-setup') {
    send('첫 번째 대화');
    await wait(() => assistants().length === 1, 'first answer');
    document.querySelector('[data-new-conversation]')?.click();
    await sleep(200);
    send('두 번째 대화');
    await wait(() => assistants().length === 1 && document.body.textContent.includes('두 번째 대화'), 'second answer');
    await sleep(300);
    const threads = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('.threads.'))[1]).threads;
    out.textContent = JSON.stringify({ok:true, phase:PHASE, threads: threads.map(t => ({id: t.id, title: t.title}))});
  } else if (PHASE === 'deeplink') {
    await wait(() => document.body.dataset.conversationRestore === 'ready', 'restore');
    await sleep(300);
    out.textContent = JSON.stringify({
      ok:true, phase:PHASE,
      users: [...document.querySelectorAll('.chat-message-user .chat-message-body')].map(n => n.textContent),
      search: location.search,
    });
  }
} catch (e) { fail(e); }
</script><pre id="rc-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
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
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const targets = await waitFor(async () => {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
    return list.find(item => item.type === 'page') ? list : null;
  }, 'page target');
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url});
  const text = await waitFor(async () => {
    const result = await devtools.send('Runtime.evaluate', {
      expression: "document.getElementById('rc-result')?.textContent || 'pending'",
      returnByValue: true,
    }).catch(() => null);
    const value = result?.result?.value;
    return value && value !== 'pending' ? value : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.chat-answer-recovery-'));
const server = startServer();
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  const devtools = await openDevtools(browser, fs.mkdtempSync(path.join(dir, 'profile-')));
  try {
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});

    // 1. Leave before the answer, come back: answered once from the same key.
    const sent = await runPhase(devtools, `${origin}/${innerRel}?phase=send`, 'send');
    assert.equal(sent.pending.length, 1, 'the unanswered turn is remembered');
    const [pendingTurns] = sent.pending;
    const [turn] = Object.values(pendingTurns);
    assert.equal(turn.scope, 'GUEST');
    assert.equal(turn.text, '전주 효자동 내과 찾아줘');
    assert.match(turn.key, /^guest-ai-/);
    const resumed = await runPhase(devtools, `${origin}/${innerRel}?phase=resume`, 'resume');
    console.log('CHAT_ANSWER_RECOVERY resume', JSON.stringify(resumed));
    assert.deepEqual(resumed.assistants, ['전주 효자동에서 확인한 내과 1곳이에요.'], 'the answer appears exactly once');
    assert.equal(resumed.loading, 0, 'no thinking bubble is left behind');
    assert.equal(resumed.errors, 0, 'a request still running is waited for, not reported as an error');
    assert.deepEqual(resumed.stored, ['user:전주 효자동 내과 찾아줘', 'assistant:전주 효자동에서 확인한 내과 1곳이에요.']);
    assert.deepEqual(resumed.pending, [], 'the pending record is cleared once the answer is shown');
    const keys = new Set(resumed.requests.map(item => item.key));
    assert.equal(keys.size, 1, 'every attempt reuses the original Idempotency-Key');
    assert.equal(resumed.requests.filter(item => item.phase === 'resume').length, 2, 'one in-progress reply, then the answer');

    // 2. A terminal error while recovering is shown, and the record cleared.
    await runPhase(devtools, `${origin}/${innerRel}?phase=send-fail`, 'send-fail');
    const failed = await runPhase(devtools, `${origin}/${innerRel}?phase=resume-fail`, 'resume-fail');
    console.log('CHAT_ANSWER_RECOVERY resume-fail', JSON.stringify(failed));
    assert.equal(failed.errors, 1, 'the failure is shown with its retry');
    assert.deepEqual(failed.pending, [], 'a terminal failure does not keep retrying');

    // 3. /?conversation=<id> opens that stored conversation.
    const setup = await runPhase(devtools, `${origin}/${innerRel}?phase=deeplink-setup`, 'deeplink-setup');
    assert.equal(setup.threads.length, 2, 'two stored conversations');
    const older = setup.threads.find(item => item.title.includes('첫 번째'));
    assert.ok(older, 'first conversation stored');
    const opened = await runPhase(devtools, `${origin}/${innerRel}?phase=deeplink&conversation=${older.id}`, 'deeplink');
    console.log('CHAT_ANSWER_RECOVERY deeplink', JSON.stringify(opened));
    assert.deepEqual(opened.users, ['첫 번째 대화'], 'the linked conversation is the one shown');
    assert.ok(!opened.search.includes('conversation='), 'the parameter is removed once used');
  } finally {
    devtools.close();
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

console.log('SITE-CHAT-ANSWER-RECOVERY-01 OK — an answer the reader left before arriving is recovered once from the same request; /?conversation= opens that conversation');
