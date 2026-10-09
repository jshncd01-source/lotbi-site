// CONVERSATION-ACCOUNT-SYNC-01 — 대표(2026-10-09): 로그인 사용자의 대화
// 기록을 계정에 저장해서 휴대폰·PC 어느 기기에서든 이어 보게 한다.
//
// Drives the real index.html and its real login callback in headless Chrome.
// Each "device" is its own browser context (its own localStorage), and every
// device talks to one in-memory account store in this process, which follows
// the Core contract of /v2/conversation-history (append once per message id,
// never overwrite, owner-only, sync off refuses new writes).
//
// Checked, in order:
//   1. device upload "예": existing device conversations reach the account once
//   2. A → B: a conversation written on device A is listed and opens on B
//   3. merge: B continues it, A sees both devices' messages (nothing replaced)
//   4. offline → recovery: "동기화 대기", then the upload lands
//   5. shared device: after logout the guest sees none of it; another account
//      on the same browser sees only its own conversations
//   6. device upload "아니오": stays on that device only, never asked again
//   7. sync off: later conversations stay on the device; on again ≠ upload them
//   8. delete one / delete all reach the account and the other device
//   9. mobile 320/360/412 in dark and light: no overflow, readable contrast
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the conversation account sync validation.');
}

// ── the account store (Core contract, in miniature) ─────────────────────────
const accounts = new Map();
const account = user => {
  if (!accounts.has(user)) accounts.set(user, {syncEnabled: true, version: 0, threads: new Map()});
  return accounts.get(user);
};
const requestLog = [];
const iso = value => new Date(value).toISOString();
const threadView = thread => ({
  id: thread.id, title: thread.title, pinned: thread.pinned, pinned_at: thread.pinned_at,
  created_at: thread.created_at, last_message_at: thread.last_message_at, updated_at: thread.updated_at,
  message_count: thread.messages.length, last_seq: thread.next_seq - 1,
});
function appendInto(thread, messages) {
  let inserted = 0;
  for (const item of messages || []) {
    if (!/^[A-Za-z0-9_-]{1,96}$/.test(String(item.id || ''))) throw Object.assign(new Error('bad id'), {status: 422});
    if (thread.messages.some(message => message.id === item.id)) continue;
    const created = item.created_at ? Date.parse(item.created_at) : Date.now();
    if (created < Date.now() - 365 * 864e5) continue;
    thread.messages.push({id: item.id, role: item.role, text: item.text, meta: item.meta || {}, created_at: iso(created), seq: thread.next_seq});
    thread.next_seq += 1;
    if (Date.parse(thread.last_message_at) < created) thread.last_message_at = iso(created);
    inserted += 1;
  }
  thread.messages.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.seq - b.seq);
  if (inserted) thread.updated_at = iso(Date.now());
  return inserted;
}
function ensureThread(store, id, meta = {}) {
  let thread = store.threads.get(id);
  if (thread) return thread;
  const created = meta.created_at ? Date.parse(meta.created_at) : Date.now();
  thread = {id, title: meta.title || '새 대화', pinned: meta.pinned === true, pinned_at: meta.pinned ? meta.pinned_at || iso(Date.now()) : null,
    created_at: iso(created), last_message_at: iso(created), updated_at: iso(Date.now()), next_seq: 1, messages: []};
  store.threads.set(id, thread);
  return thread;
}
function seedAccountThread(user, id, title, texts) {
  const store = account(user);
  const thread = ensureThread(store, id, {title, created_at: iso(Date.now() - 3600e3)});
  appendInto(thread, texts.map((text, index) => ({id: `${id}-m${index}`, role: index % 2 ? 'assistant' : 'user', text, created_at: iso(Date.now() - 3600e3 + index * 1000)})));
}
function coreHistory(method, pathname, search, user, body) {
  const store = account(user);
  const disabled = () => ({status: 409, body: {detail: {code: 'CONVERSATION_HISTORY_SYNC_DISABLED', message: '대화 기록 계정 저장이 꺼져 있습니다.'}}});
  const route = pathname.replace(/^\/v2\/conversation-history/, '');
  if (route === '/settings' && method === 'GET') return {status: 200, body: {sync_enabled: store.syncEnabled, available: true, version: store.version, limits: {retention_days: 365}}};
  if (route === '/settings' && method === 'PUT') { store.syncEnabled = body.sync_enabled === true; store.version += 1; return {status: 200, body: {sync_enabled: store.syncEnabled, available: true, version: store.version}}; }
  if (route === '/threads' && method === 'GET') {
    const threads = [...store.threads.values()].sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at)).map(threadView);
    return {status: 200, body: {threads, next_cursor: null, total: threads.length}};
  }
  if (route === '/threads' && method === 'DELETE') {
    if (new URLSearchParams(search).get('confirm') !== 'ALL') return {status: 400, body: {detail: {code: 'CONVERSATION_HISTORY_CONFIRM_REQUIRED'}}};
    const deletedThreads = store.threads.size;
    store.threads.clear();
    return {status: 200, body: {deleted_threads: deletedThreads, deleted_messages: 0}};
  }
  if (route === '/import' && method === 'POST') {
    if (!store.syncEnabled) return disabled();
    let inserted = 0;
    for (const item of body.threads || []) inserted += appendInto(ensureThread(store, item.id, item), item.messages);
    return {status: 200, body: {threads: [], totals: {inserted}}};
  }
  const match = /^\/threads\/([A-Za-z0-9_-]{1,96})(\/messages)?$/.exec(route);
  if (!match) return {status: 404, body: {detail: {code: 'NOT_FOUND'}}};
  const [, id, messages] = match;
  if (messages && method === 'POST') {
    if (!store.syncEnabled) return disabled();
    const thread = ensureThread(store, id, body.thread || {});
    const inserted = appendInto(thread, body.messages);
    return {status: 200, body: {thread: threadView(thread), inserted}};
  }
  const thread = store.threads.get(id);
  if (method === 'DELETE') { const existed = store.threads.delete(id); return {status: 200, body: {deleted: existed ? 1 : 0}}; }
  if (!thread) return {status: 404, body: {detail: {code: 'CONVERSATION_HISTORY_NOT_FOUND'}}};
  if (method === 'GET') {
    const after = Number(new URLSearchParams(search).get('after_seq') || 0);
    return {status: 200, body: {thread: threadView(thread), messages: thread.messages.filter(message => message.seq > after)}};
  }
  if (method === 'PATCH') {
    if (!store.syncEnabled) return disabled();
    if (typeof body.title === 'string') thread.title = body.title;
    if (typeof body.pinned === 'boolean') { thread.pinned = body.pinned; thread.pinned_at = body.pinned ? body.pinned_at || iso(Date.now()) : null; }
    thread.updated_at = iso(Date.now());
    return {status: 200, body: {thread: threadView(thread)}};
  }
  return {status: 405, body: {}};
}

// ── static site + account store server ──────────────────────────────────────
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'};
function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/__core/')) {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        const user = String(req.headers['x-test-user'] || '');
        const pathname = url.pathname.slice('/__core'.length);
        requestLog.push({user, method: req.method, path: pathname + url.search});
        let result;
        try { result = coreHistory(req.method, pathname, url.search, user, raw ? JSON.parse(raw) : {}); } catch (error) { result = {status: error.status || 500, body: {detail: {code: 'TEST_ERROR', message: String(error.message)}}}; }
        res.writeHead(result.status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        res.end(JSON.stringify(result.body));
      });
      return;
    }
    if (url.pathname === '/__seed.html') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('<!doctype html><title>seed</title>');
      return;
    }
    const target = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404, {'Content-Type': 'text/plain'}); res.end('404'); return; }
      res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Fake Account status + Core for every document of a device. The account
// history routes go to this process's store; __syncOffline fails them like a
// lost connection while the conversation itself keeps answering.
const MOCK = `(() => {
  const read = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const user = () => read('__syncUser') || 'user-one';
  const install = () => read('__syncInstall') || 'install-a';
  const mode = () => read('__syncMode') || 'authenticated';
  let turn = 0;
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === 'https://account.lotbiai.com') {
      if (url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: mode() === 'authenticated'});
      return json({}, 404);
    }
    if (url.origin !== 'https://api.lotbiai.com') return nativeFetch(input, init);
    const headers = new Headers(init.headers || undefined);
    const auth = Boolean(headers.get('Authorization'));
    const expires = new Date(Date.now() + 3600e3).toISOString();
    if (url.pathname.startsWith('/v2/conversation-history')) {
      if (read('__syncOffline') === '1') throw new TypeError('Failed to fetch');
      if (!auth) return json({detail: {code: 'SESSION_REQUIRED'}}, 401);
      return nativeFetch(window.location.origin + '/__core' + url.pathname + url.search, {
        method: init.method || 'GET', headers: {'Content-Type': 'application/json', 'X-Test-User': user()}, body: init.body,
      });
    }
    if (url.pathname === '/v2/sessions/handoffs/redeem') return json({session_token: 's'.repeat(48), session_type: 'Bearer', assurance_level: 'FULL', audience: 'lotbiai.com', session_id: 'site-session-' + install(), installation_id: install(), expires_at: expires});
    if (url.pathname === '/v2/me') return auth ? json({user: {id: user(), name: '동기화 테스트', email: 'sync@example.test'}, session: {id: 'site-session-' + install(), assurance_level: 'FULL', expires_at: expires}, installation: {id: install()}}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/subscription') return auth ? json({plan: 'FREE', status: 'ACTIVE', entitled: true, free_units: 10, used_free_units: 0, remaining_free_units: 10}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
    if (url.pathname === '/v2/sessions/logout') return json({ok: true});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: expires});
    if (url.pathname === '/v2/conversation/messages' || url.pathname === '/v2/conversation/guest/messages') {
      turn += 1;
      let text = '';
      try { text = JSON.parse(String(init.body || '{}')).text || ''; } catch {}
      return json({contract_id: 'CORE-WEB-CHAT-01', schema_version: 1, status: 'ANSWERED', assistant_text: '답변: ' + text, response_mode: 'AI_GROUNDED_CURRENT_FACT', correlation_id: 'req_sync_' + Date.now() + '_' + turn,
        intent: {action: 'UNKNOWN'}, follow_up: {required: false, action: 'UNKNOWN', automatic_execution: false},
        safety: {execution_authority: false, external_side_effect: false, transaction_created: false, order_created: false, payment_attempted: false, reservation_created: false, merchant_execution_started: false},
        sources: [], retry_safe: true});
    }
    return auth ? json({items: []}) : json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
})();`;

// ── CDP ─────────────────────────────────────────────────────────────────────
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(async () => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
      return;
    }
    if (message.method) for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

// One device = one browser context: its own localStorage, cookies and tabs.
async function openDevice(cdp, origin, {label, width = 1280, height = 900, mobile = false, dark = false}) {
  const {browserContextId} = await cdp.send('Target.createBrowserContext', {disposeOnDetach: true});
  const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  const page = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(message => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
    const {requestId, request} = message.params;
    const url = new URL(request.url);
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/auth/site-handoff') {
      const location = `${origin}/auth/callback/?code=${'c'.repeat(48)}&state=${encodeURIComponent(url.searchParams.get('state'))}`;
      void page('Fetch.fulfillRequest', {requestId, responseCode: 302, responseHeaders: [{name: 'Location', value: location}], body: ''});
      return;
    }
    void page('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'text/html'}], body: Buffer.from('<!doctype html><title>account</title>').toString('base64')});
  });
  await page('Fetch.enable', {patterns: [{urlPattern: 'https://account.lotbiai.com/*', resourceType: 'Document', requestStage: 'Request'}]});
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
  await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
  if (mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: dark ? 'dark' : 'light'}]});
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
    return result.result.value;
  };
  const navigate = async url => {
    await page('Page.navigate', {url});
    await sleep(150);
  };
  const device = {
    label, page, evaluate,
    async seed(values, {theme} = {}) {
      await navigate(`${origin}/__seed.html`);
      await waitFor(() => evaluate('document.readyState === "complete"'), `${label} seed page`);
      await evaluate(`(() => {
        const values = ${JSON.stringify(values)};
        for (const [key, value] of Object.entries(values)) {
          if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        ${theme ? `document.cookie = 'lotbi_theme_preference_v1=${theme}; path=/';` : ''}
        return true;
      })()`);
    },
    async open() {
      await navigate(`${origin}/`);
      await waitFor(() => evaluate(`document.body?.dataset.conversationRestore === 'ready' && location.pathname === '/'`), `${label} home ready`, 30000);
    },
    async syncSettled(expected = ['synced']) {
      return waitFor(() => evaluate(`(${JSON.stringify(expected)}).includes(document.body?.dataset.conversationSync || '') || {ok: false, sync: document.body?.dataset.conversationSync}`), `${label} sync ${expected.join('/')}`, 30000);
    },
    async send(text) {
      const before = await evaluate(`document.querySelectorAll('#conversation-thread .chat-message, #conversation-thread [data-message-role]').length`);
      await evaluate(`(() => {
        const prompt = document.getElementById('lotbi-prompt');
        prompt.value = ${JSON.stringify(text)};
        prompt.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('.send-button').click();
        return true;
      })()`);
      await waitFor(() => evaluate(`document.getElementById('conversation-thread')?.textContent.includes(${JSON.stringify('답변: ' + text)})`), `${label} answer to ${text}`);
      return before;
    },
    threadText: () => evaluate(`document.getElementById('conversation-thread')?.textContent || ''`),
    recentTitles: () => evaluate(`[...document.querySelectorAll('.sidebar-history-section [data-recent-conversations] li, [data-pinned-conversations] li')].filter((node, index, all) => all.findIndex(other => other.dataset.threadId === node.dataset.threadId) === index).map(node => node.querySelector('[data-conversation-title]')?.textContent || '')`),
    async openThreadByTitle(title) {
      const id = await evaluate(`[...document.querySelectorAll('[data-recent-conversations] li, [data-pinned-conversations] li')].find(node => node.querySelector('[data-conversation-title]')?.textContent === ${JSON.stringify(title)})?.dataset.threadId || ''`);
      assert.ok(id, `${label}: no conversation titled ${title}`);
      await evaluate(`document.querySelector('.conversation-history-open[data-thread-id="${id}"]').click(), true`);
      return id;
    },
    async close() { await cdp.send('Target.disposeBrowserContext', {browserContextId}).catch(() => {}); },
  };
  return device;
}

const NOW = Date.now();
const legacyThreads = (prefix, count, ageMs = 2 * 864e5) => ({
  threads: Array.from({length: count}, (_, index) => ({
    id: `thread-${prefix}-legacy-${index}`,
    title: `${prefix} 기기 대화 ${index + 1}`,
    pinned: false, pinnedAt: 0, stateVersion: 0,
    createdAt: NOW - ageMs + index * 1000, updatedAt: NOW - ageMs + index * 1000 + 500,
    messages: [
      {role: 'user', text: `${prefix} 예전 질문 ${index + 1}`, createdAt: NOW - ageMs + index * 1000, meta: {}},
      {role: 'assistant', text: `${prefix} 예전 답변 ${index + 1}`, createdAt: NOW - ageMs + index * 1000 + 500, meta: {status: 'ANSWERED'}},
    ],
  })),
  activeThreadId: null,
  draft: '',
});
const serverTexts = user => [...account(user).threads.values()].flatMap(thread => thread.messages.map(message => message.text));
const serverTitles = user => [...account(user).threads.values()].map(thread => thread.title);

// ── contrast helpers (WCAG relative luminance) ──────────────────────────────
const CONTRAST_PROBE = `(() => {
  const parse = value => { const m = String(value).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(x => Number.parseFloat(x)); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const background = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c && c.a > 0.5) return c; } return {r: 255, g: 255, b: 255, a: 1}; };
  window.__contrast = node => { const fg = parse(getComputedStyle(node).color); const bg = background(node); const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  return true;
})()`;

async function main() {
  const browser = browserPath();
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-conversation-sync-'));
  const cdp = await openBrowser(browser, path.join(workDir, 'profile'));
  const passed = [];
  const step = label => { passed.push(label); console.log(`PASS ${label}`); };
  const U1 = 'user-one';
  const U2 = 'user-two';
  try {
    // 1 ── device A has two conversations from before; first login asks once.
    const a = await openDevice(cdp, origin, {label: 'device-A-desktop'});
    await a.seed({__syncUser: U1, __syncInstall: 'install-a', __syncMode: 'authenticated', 'lotbi.site.ux.v1.threads.install-a': legacyThreads('A', 2)});
    await a.open();
    const question = await waitFor(() => a.evaluate(`(() => { const panel = document.querySelector('[data-conversation-sync-upload]'); return panel ? {text: panel.textContent} : null; })()`), 'A upload question');
    assert.ok(question.text.includes('이 기기의 대화 2개를 계정에 올릴까요?'), question.text);
    await a.evaluate(`document.querySelector('[data-conversation-sync-upload-answer="yes"]').click(), true`);
    await waitFor(async () => account(U1).threads.size === 2 && serverTexts(U1).length === 4, 'A legacy upload reached the account');
    await a.syncSettled();
    assert.deepEqual(serverTitles(U1).sort(), ['A 기기 대화 1', 'A 기기 대화 2']);
    step('device upload 예: 2 conversations, 4 messages, once');

    await a.send('A에서 보낸 첫 질문');
    await waitFor(async () => serverTexts(U1).includes('답변: A에서 보낸 첫 질문'), 'A new conversation uploaded');
    await a.syncSettled();
    const aThreadTitle = [...account(U1).threads.values()].find(thread => thread.messages.some(m => m.text === 'A에서 보낸 첫 질문')).title;

    // 2 ── device B (phone) logs in: the account conversations are listed.
    const b = await openDevice(cdp, origin, {label: 'device-B-360', width: 360, height: 780, mobile: true});
    await b.seed({__syncUser: U1, __syncInstall: 'install-b', __syncMode: 'authenticated'});
    await b.open();
    await b.syncSettled();
    assert.equal(await b.evaluate(`Boolean(document.querySelector('[data-conversation-sync-upload]'))`), false, 'nothing to upload on B: no question');
    const bTitles = await b.recentTitles();
    for (const title of [aThreadTitle, 'A 기기 대화 1', 'A 기기 대화 2']) assert.ok(bTitles.includes(title), `B lists ${title}: ${bTitles}`);
    await b.openThreadByTitle(aThreadTitle);
    await waitFor(async () => (await b.threadText()).includes('답변: A에서 보낸 첫 질문'), 'B opens the A conversation');
    step('A → B: conversation written on A is listed and opens on B');

    // 3 ── B continues it; A sees both devices' messages, in order.
    await b.send('B에서 이어서 질문');
    await waitFor(async () => serverTexts(U1).includes('답변: B에서 이어서 질문'), 'B continuation uploaded');
    const shared = [...account(U1).threads.values()].find(thread => thread.title === aThreadTitle);
    assert.deepEqual(shared.messages.map(m => m.text), ['A에서 보낸 첫 질문', '답변: A에서 보낸 첫 질문', 'B에서 이어서 질문', '답변: B에서 이어서 질문']);
    await a.open();
    await a.syncSettled();
    await a.openThreadByTitle(aThreadTitle);
    await waitFor(async () => (await a.threadText()).includes('답변: B에서 이어서 질문'), 'A merged B messages');
    const aText = await a.threadText();
    assert.ok(aText.indexOf('A에서 보낸 첫 질문') < aText.indexOf('B에서 이어서 질문'), 'merge keeps the order');
    step('merge: both devices keep every message, nothing overwritten');

    // 4 ── offline: the device copy keeps working, "동기화 대기", then recovery.
    await a.evaluate(`localStorage.setItem('__syncOffline', '1'), true`);
    await a.send('A 오프라인 질문');
    await waitFor(() => a.evaluate(`document.body.dataset.conversationSync === 'pending' && [...document.querySelectorAll('[data-conversation-sync-status]')].some(node => !node.hidden && node.textContent === '동기화 대기')`), 'A shows 동기화 대기');
    assert.ok(!serverTexts(U1).includes('A 오프라인 질문'), 'nothing uploaded while offline');
    assert.ok((await a.threadText()).includes('답변: A 오프라인 질문'), 'device copy keeps the turn');
    await a.evaluate(`localStorage.removeItem('__syncOffline'), window.dispatchEvent(new Event('online')), true`);
    await waitFor(async () => serverTexts(U1).includes('답변: A 오프라인 질문'), 'A offline turn uploaded after reconnect');
    await a.syncSettled();
    assert.equal(await a.evaluate(`[...document.querySelectorAll('[data-conversation-sync-status]')].every(node => node.hidden)`), true, 'mark gone once synced');
    step('offline → recovery: 동기화 대기 shown, then uploaded');

    // 5 ── shared device: logout, guest sees nothing; another account sees only its own.
    seedAccountThread(U2, 'thread-u2-own', 'U2 계정 대화', ['U2 질문', 'U2 답변']);
    const u1Titles = await a.recentTitles();
    assert.ok(u1Titles.length >= 3, `A has U1 conversations: ${u1Titles}`);
    await a.evaluate(`document.querySelector('[data-sidebar-account] [data-profile-menu-trigger], [data-profile-menu-trigger]').click(), true`);
    await waitFor(() => a.evaluate(`Boolean([...document.querySelectorAll('button')].find(node => node.textContent.trim() === '로그아웃' && !node.disabled))`), 'logout item');
    await a.evaluate(`[...document.querySelectorAll('button')].find(node => node.textContent.trim() === '로그아웃').click(), true`);
    await sleep(800);
    await a.seed({__syncMode: 'anonymous'});
    await a.open();
    const guestTitles = await a.recentTitles();
    assert.deepEqual(guestTitles.filter(title => u1Titles.includes(title)), [], `guest sees none of U1: ${guestTitles}`);
    assert.equal(await a.evaluate(`document.querySelectorAll('[data-conversation-sync-settings]').length`), 0, 'no account controls for a guest');
    await a.seed({__syncUser: U2, __syncInstall: 'install-a-u2', __syncMode: 'authenticated'});
    await a.open();
    await a.syncSettled();
    const u2Titles = await a.recentTitles();
    assert.deepEqual(u2Titles, ['U2 계정 대화'], `U2 sees only its own: ${u2Titles}`);
    assert.equal(await a.evaluate(`Boolean(document.querySelector('[data-conversation-sync-upload]'))`), false, 'U2 is never asked about U1 conversations');
    assert.ok(!serverTexts(U2).some(text => text.includes('A ')), 'U1 text never reached U2');
    await a.seed({__syncUser: U1, __syncInstall: 'install-a', __syncMode: 'authenticated'});
    await a.open();
    await a.syncSettled();
    assert.ok((await a.recentTitles()).includes(aThreadTitle), 'U1 back on its own device copy');
    step('shared device: guest and another account see none of it');

    // 6 ── device C answers 아니오: stays on C only, never asked again.
    const c = await openDevice(cdp, origin, {label: 'device-C-desktop'});
    await c.seed({__syncUser: U1, __syncInstall: 'install-c', __syncMode: 'authenticated', 'lotbi.site.ux.v1.threads.install-c': legacyThreads('C', 1)});
    const countBefore = account(U1).threads.size;
    await c.open();
    const cQuestion = (await waitFor(() => c.evaluate(`(() => { const text = document.querySelector('[data-conversation-sync-upload]')?.textContent; return text ? {text} : null; })()`), 'C upload question')).text;
    assert.ok(cQuestion.includes('이 기기의 대화 1개를 계정에 올릴까요?'), cQuestion);
    await c.evaluate(`document.querySelector('[data-conversation-sync-upload-answer="no"]').click(), true`);
    await c.syncSettled();
    await sleep(600);
    assert.equal(account(U1).threads.size, countBefore, 'nothing uploaded on 아니오');
    assert.ok(!serverTitles(U1).includes('C 기기 대화 1'));
    assert.ok((await c.recentTitles()).includes('C 기기 대화 1'), 'kept on device C');
    await c.open();
    await c.syncSettled();
    await sleep(1500);
    assert.equal(await c.evaluate(`Boolean(document.querySelector('[data-conversation-sync-upload]'))`), false, 'asked only once');
    step('device upload 아니오: kept on that device, asked once');

    // 7 ── sync off on B (phone): later conversations stay on the device.
    await b.open();
    await b.syncSettled();
    await b.evaluate(`document.querySelector('[data-mobile-nav-open]').click(), true`);
    await sleep(300);
    const drawerHeading = await b.evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-conversation-sync-settings]')].find(node => node.getClientRects().length && node.getBoundingClientRect().width > 0);
      const rect = button?.getBoundingClientRect();
      return rect ? {right: rect.right, width: rect.width, height: rect.height, vw: innerWidth} : null;
    })()`);
    assert.ok(drawerHeading && drawerHeading.right <= drawerHeading.vw && drawerHeading.width >= 32 && drawerHeading.height >= 32, JSON.stringify(drawerHeading));
    await b.evaluate(`[...document.querySelectorAll('[data-conversation-sync-settings]')].find(node => node.getClientRects().length).click(), true`);
    await waitFor(() => b.evaluate(`Boolean(document.querySelector('[data-conversation-sync-settings-panel] [data-conversation-sync-toggle]'))`), 'B settings open');
    assert.equal(await b.evaluate(`document.querySelector('[data-conversation-sync-toggle]').checked`), true, 'on by default');
    await b.evaluate(`document.querySelector('[data-conversation-sync-toggle]').click(), true`);
    await waitFor(async () => account(U1).syncEnabled === false, 'sync off reached the account');
    await waitFor(() => b.evaluate(`document.body.dataset.conversationSync === 'off'`), 'B status off');
    await b.evaluate(`document.querySelector('[data-conversation-sync-settings-panel] .site-modal-close').click(), true`);
    await b.evaluate(`document.querySelector('[data-new-conversation]').click(), true`);
    await b.send('B 동기화 끈 뒤 질문');
    await sleep(1200);
    assert.ok(!serverTexts(U1).includes('B 동기화 끈 뒤 질문'), 'sync off: stays on the device');
    assert.equal(await b.evaluate(`[...document.querySelectorAll('[data-conversation-sync-status]')].some(node => !node.hidden && node.textContent === '이 기기에만 저장')`), true);
    // On again: the conversation written while off is not uploaded after all.
    await b.evaluate(`[...document.querySelectorAll('[data-conversation-sync-settings]')].find(node => node.getClientRects().length).click(), true`);
    await waitFor(() => b.evaluate(`Boolean(document.querySelector('[data-conversation-sync-toggle]'))`), 'B settings reopen');
    await b.evaluate(`document.querySelector('[data-conversation-sync-toggle]').click(), true`);
    await waitFor(async () => account(U1).syncEnabled === true, 'sync on again');
    await b.syncSettled();
    await sleep(1200);
    assert.ok(!serverTexts(U1).includes('B 동기화 끈 뒤 질문'), 'what was written while off stays on the device');
    await b.evaluate(`document.querySelector('[data-conversation-sync-settings-panel] .site-modal-close')?.click(), true`);
    step('sync off: later conversations stay on the device');

    // 8 ── delete one (account + other device), then delete all.
    await a.open();
    await a.syncSettled();
    const deleteId = await a.evaluate(`[...document.querySelectorAll('.sidebar-history-section [data-recent-conversations] li')].find(node => node.querySelector('[data-conversation-title]')?.textContent === 'A 기기 대화 1')?.dataset.threadId`);
    await a.evaluate(`document.querySelector('.sidebar-history-section li[data-thread-id="${deleteId}"] [data-conversation-action="delete"]').click(), true`);
    const deleteCopy = (await waitFor(() => a.evaluate(`(() => { const text = document.querySelector('.site-modal-description')?.textContent; return text ? {text} : null; })()`), 'delete dialog')).text;
    assert.ok(deleteCopy.includes('이 기기와 계정에서 삭제합니다'), deleteCopy);
    await a.evaluate(`document.querySelector('.site-modal .conversation-delete-confirm').click(), true`);
    await waitFor(async () => !account(U1).threads.has(deleteId), 'delete reached the account');
    await b.open();
    await b.syncSettled();
    assert.ok(!(await b.recentTitles()).includes('A 기기 대화 1'), 'deleted on the other device too');
    step('delete one: account and the other device');

    await a.evaluate(`document.querySelector('.sidebar-history-section [data-conversation-sync-settings]').click(), true`);
    await waitFor(() => a.evaluate(`Boolean(document.querySelector('[data-conversation-sync-delete-all]'))`), 'A settings open');
    await a.evaluate(`document.querySelector('[data-conversation-sync-delete-all]').click(), true`);
    await waitFor(() => a.evaluate(`Boolean(document.querySelector('[data-conversation-sync-delete-all-confirm-button]'))`), 'delete-all confirm');
    await a.evaluate(`document.querySelector('[data-conversation-sync-delete-all-confirm-button]').click(), true`);
    await waitFor(async () => account(U1).threads.size === 0, 'delete all reached the account');
    assert.deepEqual(await a.recentTitles(), [], 'device list cleared');
    assert.ok(account(U2).threads.size === 1, 'another account untouched');
    step('delete all: account and device emptied, other account untouched');
    await Promise.all([a.close(), b.close(), c.close()]);

    // 9 ── phone widths, dark and light: the mark, the button and the dialogs fit and read.
    seedAccountThread(U1, 'thread-layout', '레이아웃 확인 대화', ['질문', '답변']);
    for (const [width, dark] of [[320, true], [360, true], [412, true], [360, false]]) {
      const label = `phone-${width}-${dark ? 'dark' : 'light'}`;
      const phone = await openDevice(cdp, origin, {label, width, height: 780, mobile: true, dark});
      await phone.seed({__syncUser: U1, __syncInstall: `install-${label}`, __syncMode: 'authenticated', __syncOffline: '1',
        [`lotbi.site.ux.v1.threads.install-${label}`]: legacyThreads('P', 1)}, {theme: dark ? 'dark' : 'light'});
      await phone.open();
      await phone.evaluate(CONTRAST_PROBE);
      await phone.syncSettled(['pending']);
      assert.equal(await phone.evaluate(`document.body.dataset.siteTheme`), dark ? 'dark' : 'light', `${label} theme`);
      await phone.evaluate(`document.querySelector('[data-mobile-nav-open]').click(), true`);
      await sleep(300);
      const heading = await phone.evaluate(`(() => {
        const mark = [...document.querySelectorAll('[data-conversation-sync-status]')].find(node => node.getClientRects().length);
        const button = [...document.querySelectorAll('[data-conversation-sync-settings]')].find(node => node.getClientRects().length);
        const h2 = mark.closest('h2');
        const m = mark.getBoundingClientRect(), b = button.getBoundingClientRect(), h = h2.getBoundingClientRect();
        return {text: mark.textContent, markContrast: window.__contrast(mark), iconContrast: window.__contrast(button),
          inside: m.left >= 0 && b.right <= innerWidth && b.right <= h.right + 8 && m.right <= b.left + 1,
          oneLine: Math.abs(m.top - b.top) < 24 && h.height < 48, button: {w: b.width, h: b.height},
          overflow: document.documentElement.scrollWidth > innerWidth + 1};
      })()`);
      assert.equal(heading.text, '동기화 대기', `${label} mark`);
      assert.ok(heading.inside && heading.oneLine && !heading.overflow, `${label} heading layout ${JSON.stringify(heading)}`);
      assert.ok(heading.markContrast >= 4.5, `${label} mark contrast ${heading.markContrast}`);
      assert.ok(heading.iconContrast >= 3, `${label} settings icon contrast ${heading.iconContrast}`);
      assert.ok(heading.button.w >= 32 && heading.button.h >= 32, `${label} tap target`);
      await phone.evaluate(`[...document.querySelectorAll('[data-conversation-sync-settings]')].find(node => node.getClientRects().length).click(), true`);
      await waitFor(() => phone.evaluate(`Boolean(document.querySelector('[data-conversation-sync-settings-panel]'))`), `${label} settings`);
      const dialog = await phone.evaluate(`(() => {
        const panel = document.querySelector('[data-conversation-sync-settings-panel]');
        const toggle = panel.querySelector('[data-conversation-sync-toggle]');
        const label = panel.querySelector('.conversation-sync-toggle-row strong');
        const state = panel.querySelector('[data-conversation-sync-state-line]');
        const remove = panel.querySelector('[data-conversation-sync-delete-all]');
        const p = panel.getBoundingClientRect(), r = remove.getBoundingClientRect();
        return {fits: p.left >= -1 && p.right <= innerWidth + 1 && r.right <= p.right + 1, panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
          labelContrast: window.__contrast(label), stateContrast: window.__contrast(state), removeContrast: window.__contrast(remove),
          toggle: toggle.getBoundingClientRect().width, state: state.textContent};
      })()`);
      assert.ok(dialog.fits && !dialog.panelOverflow, `${label} dialog layout ${JSON.stringify(dialog)}`);
      assert.ok(dialog.labelContrast >= 4.5 && dialog.stateContrast >= 4.5 && dialog.removeContrast >= 4.5, `${label} dialog contrast ${JSON.stringify(dialog)}`);
      assert.ok(dialog.state.includes('동기화 대기'), `${label} state line ${dialog.state}`);
      await phone.evaluate(`document.querySelector('[data-conversation-sync-settings-panel] .site-modal-close').click(), true`);
      // Back online: the one-time question, sized for the phone.
      await phone.evaluate(`localStorage.removeItem('__syncOffline'), true`);
      await phone.open();
      const ask = await waitFor(() => phone.evaluate(`(() => {
        const panel = document.querySelector('[data-conversation-sync-upload]');
        if (!panel) return null;
        const buttons = [...panel.querySelectorAll('[data-conversation-sync-upload-answer]')].map(node => node.getBoundingClientRect());
        const p = panel.getBoundingClientRect();
        return {fits: buttons.every(r => r.left >= p.left - 1 && r.right <= p.right + 1 && r.height >= 40), inView: p.right <= innerWidth + 1 && p.left >= -1,
          contrast: window.__contrast ? window.__contrast(panel.querySelector('.conversation-sync-upload-copy')) : 21};
      })()`), `${label} upload question`);
      assert.ok(ask.fits && ask.inView, `${label} upload question layout ${JSON.stringify(ask)}`);
      await phone.evaluate(`document.querySelector('[data-conversation-sync-upload-answer="no"]').click(), true`);
      await phone.close();
      step(`${label}: mark, settings and question fit and read`);
    }

    // The account routes stay outside the answer counters ("/v2/conversation/").
    assert.ok(requestLog.length > 0 && requestLog.every(entry => entry.path.startsWith('/v2/conversation-history/')));
    console.log(`CONVERSATION-ACCOUNT-SYNC-01 PASS (${passed.length} checks)`);
  } finally {
    cdp.close();
    server.close();
    await sleep(300);
    try { fs.rmSync(workDir, {recursive: true, force: true}); } catch { /* Windows may still hold the profile */ }
  }
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
