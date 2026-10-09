// CALENDAR-RECURRING-01 (Site): repeat + reminder fields in the record editor,
// "이 날짜만 / 반복 전체" for edit and delete of a repeating record, the request
// bodies Core receives, and that one-time records and Guest mode are unchanged.
//
// Node half: the exact request bodies site-calendar.js builds.
// Browser half: the real editor against a fetch fake that answers like Core
// (agenda items already expanded per instance, as Core sends them).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {createLifeActivity, editLifeActivity, removeLifeActivity, calendarRecurrenceBody} = await import('../site-calendar.js');

// ---------------------------------------------------------------- node half
const sent = [];
const okResponse = body => new Response(JSON.stringify({
  activity_id: 'activity_0123456789abcdef0123456789abcdef', occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef',
  activity_revision: 2, occurrence_revision: 1, title: body.title || '기록', activity_state: 'ACTIVE',
  temporal: body.temporal || {kind: 'DATE_ONLY', local_date: '2026-10-06'}, entry: null,
  temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, read_your_writes: true,
}), {status: 200, headers: {'Content-Type': 'application/json'}});
const fakeFetch = async (url, init) => { const body = JSON.parse(init.body); sent.push({url: String(url), method: init.method, body}); return okResponse(body); };
const temporal = {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-06T19:00:00', timezone_name: 'Asia/Seoul'};
const activityId = 'activity_0123456789abcdef0123456789abcdef';

await createLifeActivity('token', {logicalRequestId: 'calendar.recurring.n1', title: '운동', temporal}, fakeFetch);
assert.deepEqual(Object.keys(sent.at(-1).body).sort(), ['busy', 'logical_request_id', 'temporal', 'temporal_semantics', 'title'],
  'a one-time create sends exactly what it always did');
await createLifeActivity('token', {
  logicalRequestId: 'calendar.recurring.n2', title: '운동', temporal,
  recurrence: {frequency: 'WEEKLY', interval: 2, weekdays: [4, 0, 2], until: '2026-12-31'}, reminderOffsets: [10],
}, fakeFetch);
assert.deepEqual(sent.at(-1).body.recurrence, {frequency: 'WEEKLY', interval: 2, weekdays: [0, 2, 4], until: '2026-12-31'});
assert.deepEqual(sent.at(-1).body.reminder_offsets_minutes, [10]);

const edit = {logicalRequestId: 'calendar.recurring.n3', expectedActivityRevision: 2, expectedOccurrenceRevision: 1, title: '운동', temporal};
await editLifeActivity('token', activityId, edit, fakeFetch);
for (const key of ['scope', 'occurrence_key', 'recurrence', 'reminder_offsets_minutes']) {
  assert.equal(key in sent.at(-1).body, false, `a plain edit does not send ${key}`);
}
await editLifeActivity('token', activityId, {...edit, scope: 'OCCURRENCE', occurrenceKey: '2026-10-13', recurrence: null, reminderOffsets: [5]}, fakeFetch);
assert.equal(sent.at(-1).body.scope, 'OCCURRENCE');
assert.equal(sent.at(-1).body.occurrence_key, '2026-10-13');
assert.equal('recurrence' in sent.at(-1).body || 'reminder_offsets_minutes' in sent.at(-1).body, false,
  'one date never carries the series rule or reminders');
await editLifeActivity('token', activityId, {...edit, scope: 'SERIES', recurrence: null, reminderOffsets: []}, fakeFetch);
assert.equal(sent.at(-1).body.scope, 'SERIES');
assert.equal(sent.at(-1).body.recurrence, null, 'null turns repetition off');
assert.deepEqual(sent.at(-1).body.reminder_offsets_minutes, []);

await removeLifeActivity('token', activityId, {logicalRequestId: 'calendar.recurring.n4', expectedRevision: 2}, fakeFetch);
assert.deepEqual(Object.keys(sent.at(-1).body).sort(), ['expected_revision', 'logical_request_id']);
await removeLifeActivity('token', activityId, {logicalRequestId: 'calendar.recurring.n5', expectedRevision: 2, scope: 'OCCURRENCE', occurrenceKey: '2026-10-20'}, fakeFetch);
assert.equal(sent.at(-1).body.occurrence_key, '2026-10-20');

assert.throws(() => calendarRecurrenceBody({frequency: 'DAILY', weekdays: [1]}), /반복/);
assert.throws(() => calendarRecurrenceBody({frequency: 'HOURLY'}), /반복/);
await assert.rejects(() => createLifeActivity('token', {logicalRequestId: 'calendar.recurring.n6', title: 'x', temporal, reminderOffsets: [15]}, fakeFetch), /알림/);
await assert.rejects(() => removeLifeActivity('token', activityId, {logicalRequestId: 'calendar.recurring.n7', expectedRevision: 2, scope: 'OCCURRENCE'}, fakeFetch), /반복/);

// ---------------------------------------------------------------- browser half
const INNER_REL = 'scripts/.calendar-recurring-events-inner.html';
const WRAPPER_REL = 'scripts/.calendar-recurring-events-wrapper.html';
const PORT = 4267;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
<div class="site-modal-content" id="guest-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 250; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
const click = node => node.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
try {
  localStorage.clear();
  const BlockedNotification = function Notification() {};
  BlockedNotification.permission = 'denied';
  BlockedNotification.requestPermission = async () => 'denied';
  Object.defineProperty(globalThis, 'Notification', {configurable: true, value: BlockedNotification});
  const ACTIVITY = 'activity_' + 'a'.repeat(32);
  const OCCURRENCE = 'occurrence_' + 'b'.repeat(32);
  const rule = {frequency: 'WEEKLY', interval: 1, weekdays: [], until: null};
  const instance = (date, n) => ({
    projection_id: 'p' + n, activity_id: ACTIVITY, occurrence_id: OCCURRENCE, title: '주간 회의',
    activity_revision: 3, occurrence_revision: 1, local_date: date, local_datetime: date + 'T10:00:00', temporal_kind: 'LOCAL_DATE_TIME',
    temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false,
    reminder_configured: false, source_kind: 'USER_INPUT', allowed_actions: ['UPDATE', 'REMOVE'],
    entry: {amount_minor: null, currency: 'KRW', expense_category: null, memo: null, place: null, merchant: null},
    recurrence: rule, occurrence_key: date, series_start: '2026-10-06', occurrence_modified: false, reminder_offsets_minutes: [10],
  });
  const ITEMS = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].map(instance);
  const requests = [];
  const j = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  const fetchImpl = (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method || 'GET';
    if (method !== 'GET') {
      const body = JSON.parse(init.body);
      requests.push({method, path: u.pathname, body});
      return j({activity_id: ACTIVITY, occurrence_id: OCCURRENCE, activity_revision: 4, occurrence_revision: 1, title: body.title || '주간 회의', activity_state: 'ACTIVE',
        temporal: body.temporal || {kind: 'LOCAL_DATE_TIME', local_datetime: '2026-10-06T10:00:00', timezone_name: 'Asia/Seoul'}, entry: null,
        temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, read_your_writes: true}, method === 'POST' ? 201 : 200);
    }
    if (u.pathname.endsWith('/agenda')) return j({view: 'AGENDA', as_of: '2026-10-08T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: ITEMS, ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.endsWith('/attention')) return j({view: 'ATTENTION', as_of: '2026-10-08T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.endsWith('/holidays')) return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('expense')) return j({view: 'EXPENSE_SUMMARY', as_of: '2026-10-08T00:00:00Z', timezone: 'Asia/Seoul', start_date: '2026-10-01', end_date: '2026-10-31', coverage: 'RECORDED_CALENDAR_ENTRIES_ONLY', currencies: [], entries_without_amount: 0, ai_calls: 0, provider_api_calls: 0});
    return j({items: []});
  };
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  const root = document.getElementById('cal-root');
  await mountLifeCalendarManager({root, sessionToken: 'site-token', timezone: 'Asia/Seoul', now: () => new Date('2026-10-08T01:00:00Z'),
    settingsStorage: {getItem: () => JSON.stringify({showKoreaHolidays: false}), setItem() {}}, locationProvider: null, locationPermissions: null, fetchImpl});
  await wait(() => root.querySelector('.calendar-month-grid .calendar-record-dot'), 'month dots');
  result.dotDates = [...root.querySelectorAll('.calendar-month-grid .calendar-date-cell')].filter(c => c.querySelector('.calendar-record-dot')).map(c => c.dataset.calendarDate);

  const openInstance = async date => {
    click(root.querySelector('[data-calendar-date-trigger="' + date + '"]'));
    await wait(() => root.querySelector('.calendar-day-panel[data-selected-date="' + date + '"] .calendar-life-row'), 'row ' + date);
    const row = root.querySelector('.calendar-day-panel .calendar-life-row');
    result.rowRepeat = row.querySelector('.calendar-life-repeat')?.textContent || '';
    result.rowAria = row.getAttribute('aria-label');
    click(row);
    await wait(() => root.querySelector('.calendar-editor-dialog'), 'editor');
    return root.querySelector('.calendar-editor-dialog');
  };
  const closeEditor = async () => { root.querySelector('.calendar-editor-close')?.click(); await wait(() => !root.querySelector('.calendar-editor-dialog'), 'editor closed'); };

  // 1. An instance opens with the series' repetition and reminder.
  let dialog = await openInstance('2026-10-13');
  result.chips = [...dialog.querySelectorAll('[data-editor-chip]')].map(c => c.dataset.editorChip);
  result.repeatValue = dialog.querySelector('.calendar-editor-repeat').value;
  result.reminderChip = dialog.querySelector('[data-editor-chip="reminder"]').textContent;
  result.reminderStatus = dialog.querySelector('.calendar-editor-reminder-status').dataset.reminderDelivery;
  result.reminderStatusText = dialog.querySelector('.calendar-editor-reminder-status').textContent;

  // 2. A plain change asks "이 날짜만 / 반복 전체"; 이 날짜만 sends one occurrence.
  const title = dialog.querySelector('.calendar-editor-title'); title.value = '주간 회의 (장소 변경)'; title.dispatchEvent(new Event('input', {bubbles: true}));
  dialog.querySelector('.calendar-editor-form').requestSubmit();
  await wait(() => root.querySelector('.calendar-scope-confirm-dialog'), 'scope dialog');
  result.scopeButtons = [...root.querySelectorAll('.calendar-scope-confirm-dialog button')].map(b => b.textContent);
  result.editorInertWhileAsking = dialog.inert;
  click(root.querySelector('.calendar-scope-confirm-occurrence'));
  await wait(() => requests.length === 1, 'occurrence edit request');
  result.occurrenceEdit = requests[0];
  await wait(() => !root.querySelector('.calendar-editor-dialog'), 'saved');

  // 3. Changing the repetition applies to the whole series, without asking.
  dialog = await openInstance('2026-10-27');
  const repeat = dialog.querySelector('.calendar-editor-repeat'); repeat.value = 'BIWEEKLY'; repeat.dispatchEvent(new Event('change', {bubbles: true}));
  dialog.querySelector('.calendar-editor-form').requestSubmit();
  await wait(() => requests.length === 2, 'series edit request');
  result.seriesAsked = Boolean(root.querySelector('.calendar-scope-confirm-dialog'));
  result.seriesEdit = requests[1];
  await wait(() => !root.querySelector('.calendar-editor-dialog'), 'saved 2');

  // 4. Delete offers 이 날짜만 삭제 next to 반복 전체 삭제.
  dialog = await openInstance('2026-10-20');
  click(dialog.querySelector('.calendar-editor-delete'));
  await wait(() => root.querySelector('.calendar-delete-confirm-dialog'), 'delete dialog');
  result.deleteTitle = root.querySelector('#calendar-delete-confirm-title').textContent;
  result.deleteButtons = [...root.querySelectorAll('.calendar-delete-confirm-dialog button')].map(b => b.textContent);
  click(root.querySelector('.calendar-delete-confirm-occurrence'));
  await wait(() => requests.length === 3, 'occurrence delete request');
  result.occurrenceDelete = requests[2];
  await wait(() => !root.querySelector('.calendar-editor-dialog'), 'deleted');

  // 5. A new record: custom weekdays + until + reminder.
  click(root.querySelector('[data-calendar-date-trigger="2026-10-12"]'));
  await wait(() => root.querySelector('[data-calendar-add]'), 'add button');
  click(root.querySelector('[data-calendar-add]'));
  await wait(() => root.querySelector('.calendar-editor-dialog'), 'new editor');
  dialog = root.querySelector('.calendar-editor-dialog');
  result.newSectionsHidden = [...dialog.querySelectorAll('[data-editor-section]')].every(s => s.hidden);
  const newTitle = dialog.querySelector('.calendar-editor-title'); newTitle.value = '필라테스'; newTitle.dispatchEvent(new Event('input', {bubbles: true}));
  click(dialog.querySelector('[data-editor-chip="repeat"]'));
  const custom = dialog.querySelector('.calendar-editor-repeat'); custom.value = 'CUSTOM'; custom.dispatchEvent(new Event('change', {bubbles: true}));
  result.customDefault = [...dialog.querySelectorAll('.calendar-editor-weekday[aria-pressed="true"]')].map(b => b.textContent);
  for (const label of ['수', '금']) click([...dialog.querySelectorAll('.calendar-editor-weekday')].find(b => b.textContent === label));
  const endMode = dialog.querySelector('.calendar-editor-repeat-end-mode'); endMode.value = 'UNTIL'; endMode.dispatchEvent(new Event('change', {bubbles: true}));
  const until = dialog.querySelector('.calendar-editor-repeat-until'); until.value = '2026-11-30'; until.dispatchEvent(new Event('change', {bubbles: true}));
  click(dialog.querySelector('[data-editor-chip="reminder"]'));
  const reminder = dialog.querySelector('.calendar-editor-reminder'); reminder.value = '1440'; reminder.dispatchEvent(new Event('change', {bubbles: true}));
  result.allDayHintShown = !dialog.querySelector('.calendar-editor-reminder-all-day').hidden;
  result.minControlHeight = Math.min(...[...dialog.querySelectorAll('.calendar-editor-repeat, .calendar-editor-reminder, .calendar-editor-weekday, .calendar-editor-repeat-interval, .calendar-editor-repeat-end-mode, .calendar-editor-repeat-until')]
    .filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect().height));
  // An amount cannot ride on a repeating record (expense repetition is separate).
  click(dialog.querySelector('[data-editor-chip="amount"]'));
  const amount = dialog.querySelector('.calendar-editor-amount'); amount.value = '12000'; amount.dispatchEvent(new Event('input', {bubbles: true}));
  dialog.querySelector('.calendar-editor-form').requestSubmit();
  await sleep(120);
  result.amountError = dialog.querySelector('.calendar-editor-error').textContent;
  result.requestsAfterAmount = requests.length;
  amount.value = ''; amount.dispatchEvent(new Event('input', {bubbles: true}));
  dialog.querySelector('.calendar-editor-form').requestSubmit();
  await wait(() => requests.length === 4, 'create request');
  result.create = requests[3];
  await wait(() => !root.querySelector('.calendar-editor-dialog'), 'created');

  // 5b. 반복 전체 삭제 names its scope: Core refuses a scope-less remove of a
  // repeating record (409 RECURRENCE_SCOPE_REQUIRED, protecting the released App).
  dialog = await openInstance('2026-10-27');
  click(dialog.querySelector('.calendar-editor-delete'));
  await wait(() => root.querySelector('.calendar-delete-confirm-dialog'), 'series delete dialog');
  click(root.querySelector('.calendar-delete-confirm-submit'));
  await wait(() => requests.length === 5, 'series delete request');
  result.seriesDelete = requests[4];
  await wait(() => !root.querySelector('.calendar-editor-dialog'), 'series deleted');

  // 6. Guest mode: no repetition or reminder chips (those need the account).
  const guestRoot = document.getElementById('guest-root');
  root.replaceChildren();
  await mountLifeCalendarManager({root: guestRoot, sessionToken: '', timezone: 'Asia/Seoul', now: () => new Date('2026-10-08T01:00:00Z'),
    settingsStorage: {getItem: () => JSON.stringify({showKoreaHolidays: false}), setItem() {}}, locationProvider: null, locationPermissions: null, fetchImpl});
  await wait(() => guestRoot.querySelector('.calendar-month-grid'), 'guest grid');
  click(guestRoot.querySelector('[data-calendar-date-trigger="2026-10-12"]'));
  await wait(() => guestRoot.querySelector('[data-calendar-add]'), 'guest add');
  click(guestRoot.querySelector('[data-calendar-add]'));
  await wait(() => guestRoot.querySelector('.calendar-editor-dialog'), 'guest editor');
  result.guestChips = [...guestRoot.querySelectorAll('[data-editor-chip]')].map(c => c.dataset.editorChip);
  out.textContent = JSON.stringify(result);
} catch (error) {
  out.textContent = JSON.stringify({ok: false, error: String(error?.stack || error), viewport: {width: innerWidth, height: innerHeight}});
}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(path.join(ROOT, WRAPPER_REL), wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=58000', '--dump-dom', `${ORIGIN}/${WRAPPER_REL}`,
  ], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="result">';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf('</pre>', i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const v = JSON.parse(r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}`);
  return v;
}

function check(v) {
  const tag = `${v.viewport.width}x${v.viewport.height}`;
  assert.deepEqual(v.dotDates, ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'], `${tag} every instance shows`);
  assert.equal(v.rowRepeat, '매주', `${tag} the day row says it repeats`);
  assert.match(v.rowAria, /반복 매주/);
  assert.deepEqual(v.chips, ['time', 'repeat', 'reminder', 'amount', 'place', 'memo', 'end', 'more']);
  assert.equal(v.repeatValue, 'WEEKLY');
  assert.equal(v.reminderChip, '알림 10분 전');
  assert.equal(v.reminderStatus, 'DENIED', 'blocked browser notifications are explained');
  assert.match(v.reminderStatusText, /브라우저 사이트 설정에서 알림을 허용해 주세요/);
  assert.deepEqual(v.scopeButtons, ['취소', '이 날짜만', '반복 전체']);
  assert.equal(v.editorInertWhileAsking, true);
  assert.equal(v.occurrenceEdit.method, 'PATCH');
  assert.equal(v.occurrenceEdit.body.scope, 'OCCURRENCE');
  assert.equal(v.occurrenceEdit.body.occurrence_key, '2026-10-13');
  assert.equal(v.occurrenceEdit.body.temporal.local_datetime, '2026-10-13T10:00:00');
  assert.equal('recurrence' in v.occurrenceEdit.body, false);
  assert.equal(v.seriesAsked, false, 'a rule change needs no question');
  assert.equal(v.seriesEdit.body.scope, 'SERIES');
  assert.deepEqual(v.seriesEdit.body.recurrence, {frequency: 'WEEKLY', interval: 2, weekdays: [], until: null});
  assert.deepEqual(v.seriesEdit.body.reminder_offsets_minutes, [10]);
  assert.equal(v.seriesEdit.body.temporal.local_datetime, '2026-10-06T10:00:00', 'the series keeps its first date');
  assert.equal(v.deleteTitle, '반복 기록을 삭제하시겠습니까?');
  assert.deepEqual(v.deleteButtons, ['취소', '이 날짜만 삭제', '반복 전체 삭제']);
  assert.deepEqual(v.occurrenceDelete.body.scope, 'OCCURRENCE');
  assert.deepEqual(v.occurrenceDelete.body.occurrence_key, '2026-10-20');
  assert.match(v.seriesDelete.path, /\/remove$/);
  assert.equal(v.seriesDelete.body.scope, 'SERIES', '반복 전체 삭제는 범위를 밝힌다');
  assert.equal('occurrence_key' in v.seriesDelete.body, false);
  assert.equal(v.newSectionsHidden, true, 'a blank record opens with every section closed');
  assert.deepEqual(v.customDefault, ['월'], 'custom starts on the chosen date\'s weekday');
  assert.equal(v.allDayHintShown, true);
  assert.ok(v.minControlHeight >= 44, `${tag} repeat/reminder controls are 44px targets, got ${v.minControlHeight}`);
  assert.match(v.amountError, /반복 기록에는 금액을 함께 저장할 수 없어요/);
  assert.equal(v.requestsAfterAmount, 3, 'nothing is sent while the amount conflicts');
  assert.equal(v.create.method, 'POST');
  assert.deepEqual(v.create.body.recurrence, {frequency: 'WEEKLY', interval: 1, weekdays: [0, 2, 4], until: '2026-11-30'});
  assert.deepEqual(v.create.body.reminder_offsets_minutes, [1440]);
  assert.deepEqual(v.guestChips, ['time', 'amount', 'place', 'memo', 'end', 'more'], 'Guest editor is unchanged');
}

const browser = browserPath();
fs.writeFileSync(path.join(ROOT, INNER_REL), fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  for (const [w, h] of [[390, 844], [1280, 900]]) check(run(browser, w, h));
  console.log('CALENDAR RECURRING EVENTS 01 PASS');
} finally {
  server.kill('SIGTERM');
  try { fs.rmSync(path.join(ROOT, INNER_REL), {force: true}); } catch {}
  try { fs.rmSync(path.join(ROOT, WRAPPER_REL), {force: true}); } catch {}
}
