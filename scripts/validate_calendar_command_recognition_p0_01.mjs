// CALENDAR-COMMAND-RECOGNITION-P0-01 — everyday Korean schedule sentences are
// calendar commands, recognised by the same rules Core parses.
//
// QA 02 A1: "내일 오후 3시 회의 일정 추가해줘" got "외부 캘린더에 직접 추가할 수는
// 없어요": isExplicitLifeCalendarCommand only knew "M월 D일 H시 …", so 13 of 15
// everyday sentences went to the AI conversation, and a "[QA 점검]" or "롯비야"
// in front stopped even those. A2: "다음 주 화요일 오후 3시 치과 일정 추가해줘"
// went to the place search for the same reason.
//
// Locked here:
//   - the shared sample list (scripts/fixtures/calendar_command_samples_p0_01
//     .json, identical to Core's tests/fixtures copy): every "accept" sentence is
//     a command, every "reject" one is not, every "reject_by_date" one is sent
//     (its grammar is fine; Core refuses the date)
//   - site-calendar.js has no regex lookbehind (older Safari would refuse the
//     whole module)
//   - the command preview accepts an all-day (DATE_ONLY) result and a repeat
//   - in the conversation, signed in: the QA sentences go to /v2/life/commands
//     with the text as typed, and a 422 CALENDAR_COMMAND_UNSUPPORTED is not an
//     error but goes on to /v2/conversation/messages
//   - signed out: an all-day command is saved to this browser's Calendar as an
//     all-day event, and a repeat is not saved but answered with "로그인"
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'validate_calendar_command_recognition_p0_01';
const SAMPLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/calendar_command_samples_p0_01.json'), 'utf8'));

// --- 1. the recogniser over the shared sample list --------------------------
const {isExplicitLifeCalendarCommand, previewLifeCalendarCommand} = await import('../site-calendar.js');
assert.ok(SAMPLES.accept.length >= 15, 'at least 15 everyday command forms');
for (const sample of SAMPLES.accept) assert.equal(isExplicitLifeCalendarCommand(sample.text), true, `must be a command: ${sample.text}`);
for (const text of SAMPLES.reject) assert.equal(isExplicitLifeCalendarCommand(text), false, `must not be a command: ${text}`);
for (const text of SAMPLES.reject_by_date) assert.equal(isExplicitLifeCalendarCommand(text), true, `grammar is a command (Core refuses the date): ${text}`);

const calendarSource = fs.readFileSync(path.join(ROOT, 'site-calendar.js'), 'utf8');
assert.ok(!/\(\?<[=!]/.test(calendarSource), 'site-calendar.js must not use regex lookbehind (older Safari refuses the module)');

// --- 2. the preview contract: all-day and repeat ----------------------------
const previewBody = extra => ({
  title: '엄마 생신', temporal_semantics: 'USER_PLANNED_TIME', parser_type: 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1', ai_calls: 0, provider_api_calls: 0, ...extra,
});
const stub = body => async () => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
const previewArgs = {logicalRequestId: 'req.p001.preview01', text: '11월 3일 엄마 생신 등록해줘', timezone: 'Asia/Seoul', turnCreatedAt: '2026-10-12T09:00:00+09:00'};
const allDay = await previewLifeCalendarCommand(previewArgs, stub(previewBody({temporal: {kind: 'DATE_ONLY', local_date: '2026-11-03', timezone_name: 'Asia/Seoul'}})));
assert.equal(allDay.temporal.kind, 'DATE_ONLY');
assert.equal(allDay.temporal.local_date, '2026-11-03');
assert.equal(allDay.recurrence, null);
const weekly = await previewLifeCalendarCommand(previewArgs, stub(previewBody({
  title: '팀 회의', temporal: {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-12T10:00:00', timezone_name: 'Asia/Seoul'},
  recurrence: {frequency: 'WEEKLY', interval: 1, weekdays: [0], until: null},
})));
assert.equal(weekly.recurrence.frequency, 'WEEKLY');
await assert.rejects(
  previewLifeCalendarCommand(previewArgs, stub(previewBody({temporal: {kind: 'DATE_ONLY', local_date: 'not-a-date', timezone_name: 'Asia/Seoul'}}))),
  /미리보기 형식/,
  'a DATE_ONLY preview without a real date is refused',
);

// --- 3. the conversation, in a real browser ---------------------------------
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required');
}

const INNER = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-conversation.css"><link rel="stylesheet" href="/site-calendar.css">
</head><body class="chat-home-page">
<aside class="chat-sidebar chat-sidebar-desktop"><button type="button" data-calendar-view="all">캘린더</button></aside>
<template id="shell-markup"><main id="main-content" class="chat-home-shell" tabindex="0">
  <div data-home-avatar-anchor><div data-lotbi-avatar-container></div></div>
  <div id="conversation-thread" class="conversation-thread" hidden></div>
  <div class="chat-composer-stack">
    <div data-attachment-preview hidden></div>
    <textarea id="lotbi-prompt"></textarea>
    <div data-attachment-control>
      <button type="button" data-attachment-trigger aria-expanded="false">+</button>
      <div data-attachment-menu hidden>
        <button type="button" role="menuitem" data-attachment-action="camera">카메라</button>
        <button type="button" role="menuitem" data-attachment-action="photos">사진</button>
        <button type="button" role="menuitem" data-attachment-action="files">파일</button>
      </div>
      <input type="file" data-attachment-input="camera"><input type="file" data-attachment-input="photos"><input type="file" data-attachment-input="files">
    </div>
  </div>
  <div data-response-grade-control hidden inert>
    <button type="button" data-response-grade-trigger disabled><span data-response-grade-label>스탠다드</span></button>
    <div data-response-grade-menu hidden>
      <button type="button" data-response-grade="LIGHT" disabled></button>
      <button type="button" data-response-grade="STANDARD" disabled></button>
      <button type="button" data-response-grade="PREMIUM" disabled></button>
    </div>
  </div>
  <button class="send-button" type="button">전송</button>
  <button class="mic-button" type="button">마이크</button>
  <p id="chat-status"></p>
  <div id="chat-state-region" hidden></div>
</main></template>
<pre id="cmd-result" hidden>pending</pre>
<script type="module">
const out = document.getElementById('cmd-result');
const AUTH = new URLSearchParams(location.search).get('auth') === '1';
document.body.dataset.siteAuthState = AUTH ? 'authenticated' : 'guest';
let stage = 'init';
setTimeout(() => { if (out.textContent === 'pending') out.textContent = JSON.stringify({ok: false, error: 'watchdog at stage: ' + stage}); }, 50000);
const wait = async (fn, label) => { stage = label; for (let i = 0; i < 400; i += 1) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 20)); } throw new Error('timeout ' + label); };
const click = node => node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
const respond = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
const calls = [];
const temporal = (kind, value) => kind === 'DATE_ONLY'
  ? {kind, instant_utc: null, local_datetime: null, local_date: value, date_end: null, window_start: null, window_end: null, floating_time: null, timezone_name: 'Asia/Seoul', fold: null, window_start_fold: null, window_end_fold: null}
  : {kind, instant_utc: null, local_datetime: value, local_date: null, date_end: null, window_start: null, window_end: null, floating_time: null, timezone_name: 'Asia/Seoul', fold: null, window_start_fold: null, window_end_fold: null};
const unsupported = () => respond({detail: {code: 'CALENDAR_COMMAND_UNSUPPORTED', message: '명확한 날짜와 시간을 포함해 일정을 다시 말해 주세요.'}}, 422);

function install() {
  const native = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (url, init = {}) => {
    const parsed = new URL(String(url), location.origin);
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}
    if (parsed.pathname.startsWith('/v2/') || parsed.origin !== location.origin) calls.push({path: parsed.pathname, method, text: body?.text || ''});
    if (parsed.pathname === '/v2/life/commands' && method === 'POST') {
      if (body.text.includes('10월 1일')) return unsupported();
      const dental = body.text.includes('치과');
      return respond({
        assistant_text: dental ? '10월 20일 오후 3시에 ‘치과’ 일정을 추가했어요.' : '10월 13일 오후 3시에 ‘회의’ 일정을 추가했어요.',
        parser_type: 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1', ai_calls: 0, provider_api_calls: 0, confirmation_level: 'USER_ATTESTED',
        activity: {
          activity_id: 'activity_' + (dental ? '5' : '3').repeat(32), occurrence_id: 'occurrence_' + (dental ? '6' : '4').repeat(32),
          title: dental ? '치과' : '회의', activity_state: 'ACTIVE', activity_revision: 1, occurrence_revision: 1, entry: {},
          temporal: temporal('LOCAL_DATE_TIME', dental ? '2026-10-20T15:00:00' : '2026-10-13T15:00:00'),
          temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, read_your_writes: true,
        },
      }, 201);
    }
    if (parsed.pathname === '/v2/life/commands/preview' && method === 'POST') {
      const base = {temporal_semantics: 'USER_PLANNED_TIME', parser_type: 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1', ai_calls: 0, provider_api_calls: 0};
      if (body.text.includes('매주')) return respond({...base, title: '팀 회의', temporal: temporal('LOCAL_DATE_TIME', '2026-10-12T10:00:00'), recurrence: {frequency: 'WEEKLY', interval: 1, weekdays: [0], until: null}});
      if (body.text.includes('10월 1일')) return unsupported();
      return respond({...base, title: '엄마 생신', temporal: temporal('DATE_ONLY', '2026-11-03'), recurrence: null});
    }
    if (parsed.pathname === '/v2/me') return respond({user: {id: 'usr_cmd_fixture', name: 'LOTBI 사용자', public_handle: 'lotbi'}, session: {id: 'ses_cmd_fixture', assurance_level: 'FULL', expires_at: '2027-01-01T00:00:00+00:00'}, installation: {id: 'inst_cmd_fixture'}});
    if (parsed.pathname === '/v2/subscription' || parsed.pathname === '/v2/subscriptions/current') return respond({tier: 'FREE', status: 'ACTIVE'});
    if (parsed.pathname === '/v2/life/holidays') return respond({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'cmd-2026', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    if (parsed.pathname.startsWith('/v2/life/')) return respond({view: 'AGENDA', as_of: new Date().toISOString(), timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    // Everything else (the conversation itself, a guest session) is outside this
    // test: refuse it, and only the fact that it was asked for is checked.
    if (parsed.pathname.startsWith('/v2/') || parsed.origin !== location.origin) return respond({detail: {code: 'TEST_STUB', message: 'stub'}}, 503);
    return native(url, init);
  };
}

const send = async (text, until, label) => {
  const box = document.getElementById('lotbi-prompt');
  const button = document.querySelector('.send-button');
  box.value = text;
  box.dispatchEvent(new Event('input', {bubbles: true}));
  await wait(() => !button.disabled, 'composer ready ' + label);
  click(button);
  await wait(until, label);
  await new Promise(r => setTimeout(r, 300));
};
const after = (index, predicate) => () => calls.slice(index).some(predicate);
const threadText = () => document.getElementById('conversation-thread')?.textContent || '';

try {
  localStorage.clear();
  install();
  const conversation = await import('/site-conversation.js');
  document.body.appendChild(document.getElementById('shell-markup').content.cloneNode(true));
  if (!conversation.mountConversation(AUTH ? {sessionToken: 'tok_cmd_fixture'} : {})) throw new Error('conversation mount');
  const result = {ok: true, auth: AUTH};
  if (AUTH) {
    await wait(() => calls.some(c => c.path === '/v2/me'), 'identity loaded');
    let mark = calls.length;
    await send('[QA 점검] 내일 오후 3시 회의 일정 추가해줘', after(mark, c => c.path === '/v2/life/commands'), 'A1 command');
    result.a1 = calls.slice(mark).map(c => c.path + ' ' + c.text);
    await wait(() => threadText().includes('‘회의’ 일정을 추가했어요'), 'A1 answer');
    mark = calls.length;
    await send('다음 주 화요일 오후 3시 치과 일정 추가해줘', after(mark, c => c.path === '/v2/life/commands'), 'A2 command');
    result.a2 = calls.slice(mark).map(c => c.path + ' ' + c.text);
    await wait(() => threadText().includes('‘치과’ 일정을 추가했어요'), 'A2 answer');
    mark = calls.length;
    await send('10월 1일 오후 3시 회의 추가해줘', after(mark, c => c.path === '/v2/conversation/messages'), 'refused falls through');
    result.refused = calls.slice(mark).map(c => c.path);
  } else {
    let mark = calls.length;
    await send('11월 3일 엄마 생신 등록해줘', after(mark, c => c.path === '/v2/life/commands/preview'), 'guest all-day');
    await wait(() => threadText().includes('‘엄마 생신’ 일정을 이 브라우저 캘린더에 등록했어요'), 'guest all-day answer');
    const stored = JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1') || 'null');
    result.guestEvents = (stored?.events || []).map(e => ({title: e.title, local_date: e.local_date, local_datetime: e.local_datetime, all_day: e.all_day}));
    mark = calls.length;
    await send('매주 월요일 오전 10시 팀 회의 등록해줘', after(mark, c => c.path === '/v2/life/commands/preview'), 'guest repeat');
    await wait(() => threadText().includes('반복 일정은 로그인한 뒤 등록할 수 있어요'), 'guest repeat answer');
    const after2 = JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1') || 'null');
    result.guestEventsAfterRepeat = (after2?.events || []).length;
    mark = calls.length;
    await send('10월 1일 오후 3시 회의 추가해줘', after(mark, c => c.path !== '/v2/life/commands/preview' && c.path.startsWith('/v2/') && !c.path.startsWith('/v2/life/')), 'guest refused falls through');
    result.guestRefused = calls.slice(mark).map(c => c.path);
  }
  result.errorBubbles = document.querySelectorAll('.conversation-error, [data-conversation-error]').length;
  out.textContent = JSON.stringify(result);
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e), calls: calls.map(c => c.method + ' ' + c.path)}); }
</script></body></html>`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
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
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.calendar-command-recognition-'));
const server = startServer();
let cdp = null;
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), INNER, 'utf8');
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  cdp = await openBrowser(browser, profile);
  const {targetInfos} = await cdp.send('Target.getTargets');
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: targetInfos.find(item => item.type === 'page').targetId, flatten: true});
  const page = (method, params) => cdp.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
    return result.result.value;
  };
  await page('Page.enable');
  await page('Runtime.enable');
  const values = {};
  for (const auth of ['1', '0']) {
    await page('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    await page('Page.navigate', {url: `http://127.0.0.1:${port}/scripts/${path.basename(dir)}/inner.html?auth=${auth}`});
    await sleep(300);
    const text = await waitFor(async () => {
      const value = await evaluate("document.getElementById('cmd-result')?.textContent || 'pending'").catch(() => 'pending');
      return value !== 'pending' ? value : null;
    }, `auth=${auth}: harness`, 70000);
    const value = JSON.parse(text);
    if (!value.ok) throw new Error(`auth=${auth}: ${value.error} ${JSON.stringify(value.calls || [])}`);
    values[auth] = value;
  }
  const signedIn = values['1'];
  assert.ok(signedIn.a1.includes('/v2/life/commands [QA 점검] 내일 오후 3시 회의 일정 추가해줘'), `A1 must go to the command route as typed, got ${JSON.stringify(signedIn.a1)}`);
  assert.ok(!signedIn.a1.some(c => c.startsWith('/v2/conversation/')), 'A1 must not reach the AI conversation');
  assert.ok(signedIn.a2.some(c => c.startsWith('/v2/life/commands ')) && !signedIn.a2.some(c => c.startsWith('/v2/conversation/') || c.includes('place')), `A2 (치과) must be a calendar command, got ${JSON.stringify(signedIn.a2)}`);
  assert.ok(signedIn.refused.indexOf('/v2/life/commands') >= 0 && signedIn.refused.indexOf('/v2/conversation/messages') > signedIn.refused.indexOf('/v2/life/commands'),
    `a refused command must go on to the conversation, got ${JSON.stringify(signedIn.refused)}`);
  const guest = values['0'];
  assert.deepEqual(guest.guestEvents, [{title: '엄마 생신', local_date: '2026-11-03', local_datetime: null, all_day: true}], `an all-day command is an all-day guest event, got ${JSON.stringify(guest.guestEvents)}`);
  assert.equal(guest.guestEventsAfterRepeat, 1, 'a repeat is not saved to the browser Calendar');
  assert.ok(guest.guestRefused.includes('/v2/life/commands/preview') && guest.guestRefused.some(c => !c.startsWith('/v2/life/')),
    `a refused guest command must go on to the conversation, got ${JSON.stringify(guest.guestRefused)}`);
  console.log(`${NAME}: PASS (${SAMPLES.accept.length} accepted, ${SAMPLES.reject.length} rejected, ${SAMPLES.reject_by_date.length} sent and refused by date; conversation signed in and out)`);
} finally {
  if (cdp) cdp.close();
  server.kill();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}
