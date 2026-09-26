import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {buildCalendarTemporal, createCalendarMutationController, normalizeCalendarClockInput} = await import('../site-calendar-manager.js');
const {createGuestCalendarRepository} = await import('../site-calendar-guest.js');
const day = '2026-09-24';
const zone = 'Asia/Seoul';

assert.equal(normalizeCalendarClockInput?.('1045'), '10:45', 'mobile numeric keyboard must admit arbitrary HHmm without a colon key');
assert.equal(normalizeCalendarClockInput?.('10:45'), '10:45');
assert.equal(normalizeCalendarClockInput?.(''), '');
assert.equal(normalizeCalendarClockInput?.('2460'), null);
assert.equal(normalizeCalendarClockInput?.('9:45'), null);

// A removed or regressed branch must break each assertion: the exact Core
// TIME_WINDOW/LOCAL_DATE_TIME shapes and the persisted Guest end are observable.
assert.deepEqual(buildCalendarTemporal({localDate: day, time: '09:00', endTime: '12:00', timezone: zone}), {
  kind: 'TIME_WINDOW', window_start: `${day}T09:00:00`, window_end: `${day}T12:00:00`, timezone_name: zone,
});
assert.deepEqual(buildCalendarTemporal({localDate: day, time: '09:00', timezone: zone}), {
  kind: 'LOCAL_DATE_TIME', local_datetime: `${day}T09:00:00`, timezone_name: zone,
});
assert.deepEqual(buildCalendarTemporal({localDate: day, time: '18:00', endDate: '2026-09-25', endTime: '09:00', timezone: zone}), {
  kind: 'TIME_WINDOW', window_start: `${day}T18:00:00`, window_end: '2026-09-25T09:00:00', timezone_name: zone,
}, 'editing a pre-existing multi-day time window must retain its end date');
assert.deepEqual(buildCalendarTemporal({localDate: day, time: '09:00', endTime: '12:00', allDay: true, timezone: zone}), {
  kind: 'DATE_ONLY', local_date: day,
});
assert.deepEqual(buildCalendarTemporal({localDate: day, endDate: '2026-09-25', allDay: true, timezone: zone}), {
  kind: 'DATE_RANGE', local_date: day, date_end: '2026-09-25', timezone_name: zone,
}, 'editing a pre-existing multi-day all-day entry must retain its end date');
for (const endTime of ['08:59', '09:00', '24:10', '9:00']) {
  assert.throws(() => buildCalendarTemporal({localDate: day, time: '09:00', endTime, timezone: zone}),
    /시간|종료/, `invalid end ${endTime} must be rejected`);
}
assert.throws(() => buildCalendarTemporal({localDate: day, endTime: '12:00', timezone: zone}), /시간|종료/);
assert.throws(() => buildCalendarTemporal({localDate: day, time: '18:00', endDate: '2026-09-23', endTime: '09:00', timezone: zone}), /종료/);
assert.throws(() => buildCalendarTemporal({localDate: day, endDate: '2026-09-23', allDay: true, timezone: zone}), /종료/);

const data = new Map();
const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
const guestRepository = createGuestCalendarRepository(storage, {uuid: () => '00000000-0000-4000-8000-000000000001'});
const guest = createCalendarMutationController({guestRepository, timezone: zone});
const created = await guest.create({title: '회의', localDate: day, time: '09:00', endTime: '12:00', place: '서울'});
assert.equal(created.local_datetime, `${day}T09:00:00`);
assert.equal(created.local_end_datetime, `${day}T12:00:00`);
assert.equal(guestRepository.list()[0].local_end_datetime, `${day}T12:00:00`);
assert.equal(guestRepository.list()[0].entry.place, '서울');
const updated = await guest.update(created, {title: '회의 수정', localDate: day, time: '12:00', endTime: '18:00', place: '부산'});
assert.equal(guestRepository.list()[0].local_end_datetime, `${day}T18:00:00`);
assert.equal(updated.entry.place, '부산');
const multiDay = await guest.update(updated, {title: '숙박', localDate: day, time: '18:00', endDate: '2026-09-25', endTime: '09:00'});
assert.equal(guestRepository.list()[0].local_end_datetime, '2026-09-25T09:00:00');
assert.equal(multiDay.local_end_datetime, '2026-09-25T09:00:00');
const allDayRange = await guest.update(multiDay, {title: '연휴', localDate: day, endDate: '2026-09-25', allDay: true});
assert.equal(allDayRange.local_end_date, '2026-09-25');
assert.equal(allDayRange.local_end_datetime, null);
assert.equal(guestRepository.list()[0].local_end_date, '2026-09-25');

const requests = [];
const response = {
  activity_id: 'activity_0123456789abcdef0123456789abcdef', occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef',
  activity_revision: 3, occurrence_revision: 4, title: '회의', activity_state: 'ACTIVE',
  temporal: {kind: 'TIME_WINDOW', window_start: `${day}T09:00:00`, window_end: `${day}T12:00:00`, timezone_name: zone},
  entry: {
    amount_minor: 12000, currency: 'KRW', expense_category: 'FOOD', memo: '메모', place: '서울', merchant: '가게',
    source_kind: null, source_ref: null, visit_scope: null, visit_date: null,
  },
  temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED', provider_verified: false, read_your_writes: true,
};
const fetchImpl = async (url, init) => {
  requests.push({url, method: init.method, body: JSON.parse(init.body)});
  return new Response(JSON.stringify(response), {status: init.method === 'POST' ? 201 : 200, headers: {'Content-Type': 'application/json'}});
};
const auth = createCalendarMutationController({sessionToken: 'token', timezone: zone, fetchImpl, requestId: () => 'calendar.compact.test.1'});
const details = {title: '회의', localDate: day, time: '09:00', endTime: '12:00', amountMinor: '12000', expenseCategory: 'FOOD', memo: '메모', place: '서울', merchant: '가게'};
await auth.create(details);
await auth.update(response, details);
for (const request of requests) {
  assert.deepEqual(request.body.temporal, response.temporal);
  assert.deepEqual(request.body.entry, response.entry);
  assert.equal(request.body.title, '회의');
}
assert.equal(requests[0].method, 'POST');
assert.equal(requests[1].method, 'PATCH');
assert.match(requests[1].url, /\/entry$/);
assert.equal(requests[1].body.expected_activity_revision, 3);
assert.equal(requests[1].body.expected_occurrence_revision, 4);

// The Auth Month save must wait for its fail-soft expense render before choosing
// the final focus target. Otherwise the delayed expense response detaches it.
const managerSource = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const refreshSource = managerSource.slice(managerSource.indexOf('async function refresh('), managerSource.indexOf('const focusCalendarContext'));
const savedSource = managerSource.slice(managerSource.indexOf('onSaved: async () => {'), managerSource.indexOf('onStale: refresh'));
const focusSource = managerSource.slice(managerSource.indexOf('const focusCalendarContext'), managerSource.indexOf('openEditor = (item, date'));
const editorSource = managerSource.slice(managerSource.indexOf('openEditor = (item, date'), managerSource.indexOf('settingsButton.addEventListener'));
const navigationSource = managerSource.slice(managerSource.indexOf('const actions = {'), managerSource.indexOf("root.addEventListener('keydown'"));
const expenseSource = managerSource.slice(managerSource.indexOf('async function refreshExpenseSummary()'), managerSource.indexOf('async function refresh({'));
const validatorSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
assert.doesNotMatch(validatorSource, /\bmanager\.mountLifeCalendarManager\(/,
  'Auth browser fixture must call its actual imported mount binding');
assert.match(refreshSource, /let expenseRefresh = null;[\s\S]*if \(state\.mode === 'month'\) expenseRefresh = refreshExpenseSummary\(\);[\s\S]*if \(settleExpense && authenticated && expenseRefresh\) await expenseRefresh;/,
  'Auth Month refresh must settle the final expense render when the caller requests final focus');
assert.match(savedSource, /await refresh\(\{settleExpense: authenticated && origin\.mode === 'month'\}\)/,
  'editor save must request the settled Month render before restoring focus');
assert.match(savedSource, /if \(sameCalendarContext\(origin\)\) focusCalendarContext\(origin, item, \(\) => sameCalendarContext\(origin\)\)/,
  'settled save may focus its original date only while that Calendar context remains current');
assert.match(editorSource, /generation: calendarContextGeneration,[\s\S]*calendarContextGeneration === context\.generation/,
  'settled save must distinguish navigation away and back from an unchanged Calendar context');
assert.match(navigationSource, /selectDate: async \(date, \{openDetail = false\} = \{\}\) => \{\s*markCalendarContextNavigation\(\);/,
  'date navigation must advance the Calendar context generation');
assert.match(focusSource, /queueMicrotask\(\(\) => \{\s*if \(!isCurrent\(\)\) return;/,
  'deferred final focus must recheck freshness after the save continuation');
// CALENDAR-SPEED-02: the same delayed-render focus restoration is now shared
// with the background weather/holiday render (renderPreservingFocus), so it
// lives once, above refreshExpenseSummary, rather than duplicated in it.
assert.match(expenseSource, /renderPreservingFocus\(\);/,
  'delayed expense rendering must reuse the shared focus-preserving render');
const renderPreservingFocusSource = managerSource.slice(
  managerSource.indexOf('function renderPreservingFocus()'),
  managerSource.indexOf('async function refreshWeatherOnly'),
);
assert.match(renderPreservingFocusSource, /document\.activeElement\?\.closest\?\.\('\.calendar-day-panel'\)[\s\S]*render\(\);[\s\S]*focusedDayDetail && state\.mode === 'month' && state\.detailOpen[\s\S]*querySelector\('\.calendar-day-close'\)[\s\S]*\.focus\(\)/,
  'shared focus-preserving render must reconnect focus to the active day detail');
assert.match(renderPreservingFocusSource, /root\.contains\(document\.activeElement\)/,
  'shared focus-preserving render must not adopt focus belonging to a different Calendar instance');

if (process.argv.includes('--contracts-only')) {
  console.log('LOTBI Calendar compact editor contracts: PASS (browser UI not run)');
  process.exit(0);
}
function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const located = spawnSync('which', [name], {encoding: 'utf8'});
    if (located.status === 0 && located.stdout.trim()) return located.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for compact editor browser behavior');
}
const browser = browserPath();
const fixturePath = path.join(ROOT, 'scripts/.calendar-compact-editor-inner.html');
const wrapperPath = path.join(ROOT, 'scripts/.calendar-compact-editor-wrapper.html');
const origin = 'http://127.0.0.1:4224';
const fixture = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-calendar.css"><div id="root"></div><pre id="result">pending</pre><script type="module">
const out=document.querySelector('#result');
const wait=async(fn)=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw new Error('timeout')};
const j=x=>Promise.resolve(new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}}));
try{
  localStorage.clear();
  const root=document.querySelector('#root');
  const {mountLifeCalendarManager}=await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({root,sessionToken:'',timezone:'Asia/Seoul',now:()=>new Date('2026-09-24T00:00:00Z'),
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
    locationProvider:null,locationPermissions:null,fetchImpl:()=>j({items:[]})});
  await wait(()=>root.querySelector('[data-calendar-date-trigger="2026-09-24"]'));
  root.querySelector('[data-calendar-date-trigger="2026-09-24"]').click();
  await wait(()=>root.querySelector('[data-calendar-add]'));
  const opener=root.querySelector('[data-calendar-add]');opener.focus();opener.click();
  await wait(()=>root.querySelector('.calendar-editor-dialog'));
  const dialog=root.querySelector('.calendar-editor-dialog');
  const get=name=>dialog.querySelector('.calendar-editor-'+name);
  const first={date:get('date').value,detailsHidden:!get('details').open,required:[...dialog.querySelectorAll('[required]')].map(n=>n.className),
    timeType:get('time').type, timeHidden:get('time-control').hidden, timeDisabled:get('time').disabled};
  dialog.querySelector('.calendar-editor-all-day input').click();
  const timed={timeHidden:get('time-control').hidden,timeDisabled:get('time').disabled};
  get('time-trigger').click();
  await wait(()=>get('time-sheet')&&!get('time-sheet').hidden);
  const sheetOpen={active:document.activeElement?.className,expanded:get('time-trigger').getAttribute('aria-expanded'),choices:[...get('time-sheet').querySelectorAll('[data-quick-time]')].map(n=>n.dataset.quickTime)};
  get('details').querySelector('summary').click();get('category-trigger').click();
  const timeToCategory={timeClosed:get('time-sheet').hidden,timeCollapsed:get('time-trigger').getAttribute('aria-expanded')==='false',categoryOpen:!get('category-sheet').hidden,categoryFocus:get('category-sheet').contains(document.activeElement)};
  get('time-trigger').click();
  const categoryToTime={categoryClosed:get('category-sheet').hidden,categoryCollapsed:get('category-trigger').getAttribute('aria-expanded')==='false',timeOpen:!get('time-sheet').hidden,timeFocus:document.activeElement===get('time')};
  get('time-sheet').querySelector('.calendar-editor-time-clear').click();
  get('category-trigger').click();get('details').querySelector('summary').focus();get('details').querySelector('summary').click();
  const summaryWasFocused=document.activeElement===get('details').querySelector('summary');
  const lastActionImmediately=get('cancel');lastActionImmediately.focus();lastActionImmediately.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  const immediateDialogTrap=document.activeElement===get('close');
  await wait(()=>get('category-sheet').hidden);
  const detailsCollapsed={categoryClosed:get('category-sheet').hidden,categoryCollapsed:get('category-trigger').getAttribute('aria-expanded')==='false',focus:summaryWasFocused};
  const lastDialogAction=get('cancel');lastDialogAction.focus();lastDialogAction.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  const dialogTrapAfterCollapse=document.activeElement===get('close');
  get('time-trigger').click();
  get('time-sheet').querySelector('[data-quick-time="09:00"]').click();
  get('time-sheet').querySelector('.calendar-editor-time-done').click();
  const quick={value:get('time').value,focus:document.activeElement===get('time-trigger')};
  get('time-trigger').click();get('time').value='25:71';get('time-sheet').querySelector('.calendar-editor-time-done').click();
  const invalid={open:!get('time-sheet').hidden,error:get('time').getAttribute('aria-invalid')};
  get('time').value='1045';get('time-sheet').querySelector('.calendar-editor-time-done').click();
  const numericClock={value:get('time').value,closed:get('time-sheet').hidden,focus:document.activeElement===get('time-trigger')};
  get('time-trigger').click();get('time-sheet').querySelector('.calendar-editor-time-clear').click();
  const cleared={value:get('time').value,closed:get('time-sheet').hidden};
  get('details').querySelector('summary').click();
  get('category-trigger').click();
  const categoryOpened={open:!get('category-sheet').hidden,expanded:get('category-trigger').getAttribute('aria-expanded'),options:[...get('category-sheet').querySelectorAll('[data-category]')].map(n=>n.dataset.category)};
  const categoryChoices=[...get('category-sheet').querySelectorAll('[data-category]')];
  categoryChoices.at(-1).focus();categoryChoices.at(-1).dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  const categoryTrapped=document.activeElement===categoryChoices[0];
  get('category-sheet').querySelector('[data-category="FOOD"]').click();
  const category={value:get('category').value,closed:get('category-sheet').hidden,focus:document.activeElement===get('category-trigger')};
  get('time-trigger').click();get('time-sheet').querySelector('[data-quick-time="12:00"]').click();get('time-sheet').querySelector('.calendar-editor-time-done').click();
  get('end-time-trigger').click();get('time-sheet').querySelector('[data-quick-time="09:00"]').click();get('time-sheet').querySelector('.calendar-editor-time-done').click();
  get('title').value='회의';dialog.querySelector('form').requestSubmit();
  await wait(()=>/종료/.test(get('error').textContent));
  const endRejected=/종료/.test(get('error').textContent)&&Boolean(root.querySelector('.calendar-editor-dialog'));
  get('end-time-trigger').click();get('time-sheet').querySelector('[data-quick-time="18:00"]').click();get('time-sheet').querySelector('.calendar-editor-time-done').click();
  const endAccepted=get('end-time').value==='18:00';
  // Trap and restore both directions in the top-level dialog.
  get('details').open=false;
  get('time-trigger').click();
  const focusables=[...get('time-sheet').querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(n=>!n.hidden);
  const last=focusables.at(-1);last.focus();last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  const trapped=get('time-sheet').contains(document.activeElement)&&document.activeElement!==last;
  dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  const restored=document.activeElement===get('time-trigger');
  let staleFocusDuringSave=false;
  const onFocusSave=event=>{if(event.target===opener)staleFocusDuringSave=true};
  root.addEventListener('focusin',onFocusSave);
  dialog.querySelector('form').requestSubmit();
  await wait(()=>!root.querySelector('.calendar-editor-dialog')&&!root.hasAttribute('aria-busy')&&document.activeElement===root.querySelector('[data-calendar-date-trigger="2026-09-24"]'));
  root.removeEventListener('focusin',onFocusSave);
  const newDate=root.querySelector('[data-calendar-date-trigger="2026-09-24"]');
  const afterSaveFocus={connected:document.activeElement.isConnected,selectedDate:document.activeElement===newDate,oldOpenerGone:!opener.isConnected,staleFocusDuringSave};
  const cancelOpener=root.querySelector('[data-calendar-add]');cancelOpener.focus();cancelOpener.click();
  await wait(()=>root.querySelector('.calendar-editor-dialog'));
  let staleFocusDuringCancel=false;
  const onFocusCancel=event=>{if(event.target===cancelOpener)staleFocusDuringCancel=true};
  root.addEventListener('focusin',onFocusCancel);
  root.querySelector('.calendar-editor-cancel').click();
  await wait(()=>!root.querySelector('.calendar-editor-dialog')&&document.activeElement===root.querySelector('[data-calendar-date-trigger="2026-09-24"]'));
  root.removeEventListener('focusin',onFocusCancel);
  const afterCancelFocus={connected:document.activeElement.isConnected,selectedDate:document.activeElement===root.querySelector('[data-calendar-date-trigger="2026-09-24"]'),staleFocusDuringCancel};

  // Auth Month: the schedule refresh lands first; expense completion renders
  // again later. Final focus must name the connected date after that render.
  const authRoot=document.createElement('div');document.body.appendChild(authRoot);
  let authSavedNotifications=0;
  window.addEventListener('lotbi:life-calendar-refresh',event=>{if(event.detail?.source===authRoot)authSavedNotifications++});
  let delayExpense=false,releaseExpense=null,expenseRequests=0;
  const authFetch=(url,init={})=>{
    const parsed=new URL(String(url),location.origin),route=parsed.pathname;
    if(route==='/v2/life/expense-summary'){
      expenseRequests+=1;
      const summary={view:'EXPENSE_SUMMARY',as_of:'2026-09-24T00:00:00Z',timezone:'Asia/Seoul',
        start_date:parsed.searchParams.get('start'),end_date:parsed.searchParams.get('end'),
        coverage:'RECORDED_CALENDAR_ENTRIES_ONLY',currencies:[],entries_without_amount:0,ai_calls:0,provider_api_calls:0};
      if(delayExpense)return new Promise(resolve=>{releaseExpense=()=>resolve(new Response(JSON.stringify({code:'FIXTURE_EXPENSE_UNAVAILABLE'}),
        {status:503,headers:{'Content-Type':'application/json'}}))});
      return j(summary);
    }
    if(route==='/v2/life/agenda')return j({view:'AGENDA',as_of:'2026-09-24T00:00:00Z',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(route==='/v2/life/attention')return j({view:'ATTENTION',as_of:'2026-09-24T00:00:00Z',timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
    if(route==='/v2/life/holidays')return j({year:2026,country:'KR',coverage_status:'VERIFIED',snapshot_version:'fixture',supported_years:[2026],items:[],ai_calls:0,provider_api_calls:0});
    if(route==='/v2/life/activities'&&init.method==='POST'){
      const body=JSON.parse(init.body);
      return Promise.resolve(new Response(JSON.stringify({activity_id:'activity_0123456789abcdef0123456789abcdef',occurrence_id:'occurrence_0123456789abcdef0123456789abcdef',
        activity_revision:1,occurrence_revision:1,title:body.title,activity_state:'ACTIVE',temporal:body.temporal,
        entry:body.entry||null,temporal_semantics:'USER_PLANNED_TIME',busy:'UNKNOWN',confirmation_level:'USER_ATTESTED',provider_verified:false,read_your_writes:true}),
        {status:201,headers:{'Content-Type':'application/json'}}));
    }
    return j({items:[]});
  };
  await mountLifeCalendarManager({root:authRoot,sessionToken:'site-token',timezone:'Asia/Seoul',now:()=>new Date('2026-09-24T00:00:00Z'),
    settingsStorage:{getItem:()=>JSON.stringify({showKoreaHolidays:false}),setItem(){}},
    locationProvider:null,locationPermissions:null,fetchImpl:authFetch});
  await wait(()=>authRoot.querySelector('[data-calendar-expense-summary="ready"]'));
  authRoot.querySelector('[data-calendar-date-trigger="2026-09-24"]').click();
  await wait(()=>authRoot.querySelector('[data-calendar-add]'));
  authRoot.querySelector('[data-calendar-add]').click();
  await wait(()=>authRoot.querySelector('.calendar-editor-dialog'));
  authRoot.querySelector('.calendar-editor-title').value='계약 검토';
  delayExpense=true;
  authRoot.querySelector('.calendar-editor-form').requestSubmit();
  await wait(()=>releaseExpense&&!authRoot.querySelector('.calendar-editor-dialog')&&authRoot.querySelector('.calendar-month-grid'));
  const authScheduleBeforeExpense=Boolean(authRoot.querySelector('.calendar-month-grid'));
  releaseExpense();
  await wait(()=>authRoot.querySelector('[data-calendar-expense-summary="error"]')&&
    document.activeElement===authRoot.querySelector('[data-calendar-date-trigger="2026-09-24"]')&&document.activeElement.isConnected);
  const authAfterExpenseFocus={expenseRequests,connected:document.activeElement.isConnected,
    selectedDate:document.activeElement===authRoot.querySelector('[data-calendar-date-trigger="2026-09-24"]'),
    schedulePresent:Boolean(authRoot.querySelector('.calendar-month-grid')),
    expenseFailed: Boolean(authRoot.querySelector('[data-calendar-expense-summary="error"]'))};
  // Save again, but this time navigate to a different date while the expense
  // response is held. Neither the old save continuation nor the expense render
  // may steal focus from that newer date.
  releaseExpense=null;
  authRoot.querySelector('[data-calendar-add]').click();
  await wait(()=>authRoot.querySelector('.calendar-editor-dialog'));
  authRoot.querySelector('.calendar-editor-title').value='일정 후 이동';
  authRoot.querySelector('.calendar-editor-form').requestSubmit();
  await wait(()=>releaseExpense&&!authRoot.querySelector('.calendar-editor-dialog')&&authRoot.querySelector('[data-calendar-date-trigger="2026-09-25"]'));
  authRoot.querySelector('[data-calendar-date-trigger="2026-09-25"]').click();
  await wait(()=>document.activeElement===authRoot.querySelector('.calendar-day-close')&&
    authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25');
  const navigationFocusBeforeExpense=document.activeElement;
  const savesBeforeRelease=authSavedNotifications;
  releaseExpense();
  await wait(()=>authSavedNotifications>savesBeforeRelease&&!navigationFocusBeforeExpense.isConnected&&
    document.activeElement===authRoot.querySelector('.calendar-day-close')&&document.activeElement.isConnected&&
    authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25');
  await new Promise(resolve=>setTimeout(resolve,0));
  const authNavigationDuringExpense={connected:document.activeElement.isConnected,
    dayDetailFocus:document.activeElement===authRoot.querySelector('.calendar-day-close'),
    selectedDate:authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25',
    schedulePresent:Boolean(authRoot.querySelector('.calendar-month-grid'))};
  // The same state values can reappear after real navigation. Save once more,
  // move away and back while expense waits, and ensure the stale continuation
  // does not replace the current day-detail focus with its old date target.
  releaseExpense=null;
  authRoot.querySelector('[data-calendar-add]').click();
  await wait(()=>authRoot.querySelector('.calendar-editor-dialog'));
  authRoot.querySelector('.calendar-editor-title').value='왕복 이동 중 저장';
  authRoot.querySelector('.calendar-editor-form').requestSubmit();
  await wait(()=>releaseExpense&&!authRoot.querySelector('.calendar-editor-dialog'));
  authRoot.querySelector('[data-calendar-date-trigger="2026-09-24"]').click();
  await wait(()=>document.activeElement===authRoot.querySelector('.calendar-day-close')&&
    authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-24');
  authRoot.querySelector('[data-calendar-date-trigger="2026-09-25"]').click();
  await wait(()=>document.activeElement===authRoot.querySelector('.calendar-day-close')&&
    authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25');
  const awayBackFocusBeforeExpense=document.activeElement;
  const savesBeforeAwayBackRelease=authSavedNotifications;
  releaseExpense();
  await wait(()=>authSavedNotifications>savesBeforeAwayBackRelease&&!awayBackFocusBeforeExpense.isConnected&&
    document.activeElement===authRoot.querySelector('.calendar-day-close')&&document.activeElement.isConnected&&
    authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25');
  await new Promise(resolve=>setTimeout(resolve,0));
  const authAwayAndBackDuringExpense={connected:document.activeElement.isConnected,
    dayDetailFocus:document.activeElement===authRoot.querySelector('.calendar-day-close'),
    selectedDate:authRoot.querySelector('.calendar-day-panel')?.dataset.selectedDate==='2026-09-25',
    dateTriggerUnfocused:document.activeElement!==authRoot.querySelector('[data-calendar-date-trigger="2026-09-25"]'),
    schedulePresent:Boolean(authRoot.querySelector('.calendar-month-grid'))};
  out.textContent=JSON.stringify({ok:true,first,timed,sheetOpen,timeToCategory,categoryToTime,detailsCollapsed,immediateDialogTrap,dialogTrapAfterCollapse,quick,invalid,numericClock,cleared,categoryOpened,category,categoryTrapped,endRejected,endAccepted,trapped,restored,afterSaveFocus,afterCancelFocus,authScheduleBeforeExpense,authAfterExpenseFocus,authNavigationDuringExpense,authAwayAndBackDuringExpense});
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e)})}
</script></html>`;
const wrapper = `<!doctype html><iframe src="/scripts/.calendar-compact-editor-inner.html" width="390" height="844"></iframe><pre id="result">pending</pre><script>const t=setInterval(()=>{const x=document.querySelector('iframe').contentDocument?.querySelector('#result');if(x&&x.textContent!=='pending'){document.querySelector('#result').textContent=x.textContent;clearInterval(t)}},20);setTimeout(()=>{if(document.querySelector('#result').textContent==='pending')document.querySelector('#result').textContent=JSON.stringify({ok:false,error:'timeout'})},35000)</script>`;
fs.writeFileSync(fixturePath, fixture);
fs.writeFileSync(wrapperPath, wrapper);
const server = spawn('python', ['-m', 'http.server', '4224', '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (spawnSync('curl', ['--silent', '--fail', origin + '/'], {timeout: 1000}).status === 0) {ready = true; break;}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  assert.ok(ready, 'fixture server started');
  const run = spawnSync(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--virtual-time-budget=45000', '--dump-dom', origin + '/scripts/.calendar-compact-editor-wrapper.html'], {encoding: 'utf8', timeout: 90000, maxBuffer: 10 * 1024 * 1024});
  assert.equal(run.status, 0, run.stderr?.slice(-1000));
  const raw = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/)?.[1]?.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  assert.ok(v.ok, v.error);
  assert.equal(v.first.date, day, 'selected date prefilled');
  assert.equal(v.first.detailsHidden, true, 'optional details start collapsed');
  assert.deepEqual(v.first.required, ['calendar-editor-title'], 'title alone is required');
  assert.equal(v.first.timeType, 'text', 'never open native clock');
  assert.equal(v.first.timeHidden, true, 'all-day hides clock');
  assert.equal(v.first.timeDisabled, true);
  assert.equal(v.timed.timeHidden, false);
  assert.equal(v.timed.timeDisabled, false);
  assert.deepEqual(v.sheetOpen.choices, ['09:00', '12:00', '18:00']);
  assert.equal(v.sheetOpen.expanded, 'true');
  assert.deepEqual(v.timeToCategory, {timeClosed:true,timeCollapsed:true,categoryOpen:true,categoryFocus:true});
  assert.deepEqual(v.categoryToTime, {categoryClosed:true,categoryCollapsed:true,timeOpen:true,timeFocus:true});
  assert.deepEqual(v.detailsCollapsed, {categoryClosed:true,categoryCollapsed:true,focus:true});
  assert.equal(v.immediateDialogTrap, true, 'hidden category cannot cancel the next Tab before toggle fires');
  assert.equal(v.dialogTrapAfterCollapse, true, 'collapsed sheet must not trap Tab');
  assert.equal(v.quick.value, '09:00');
  assert.equal(v.quick.focus, true);
  assert.deepEqual(v.invalid, {open: true, error: 'true'}, 'invalid typed HH:mm cannot commit');
  assert.deepEqual(v.numericClock, {value:'10:45',closed:true,focus:true});
  assert.deepEqual(v.cleared, {value: '', closed: true});
  assert.equal(v.categoryOpened.open, true);
  assert.equal(v.categoryOpened.expanded, 'true');
  assert.ok(v.categoryOpened.options.includes('FOOD'));
  assert.deepEqual(v.category, {value: 'FOOD', closed: true, focus: true});
  assert.equal(v.categoryTrapped, true);
  assert.equal(v.endRejected, true);
  assert.equal(v.endAccepted, true);
  assert.equal(v.trapped, true);
  assert.equal(v.restored, true);
  assert.deepEqual(v.afterSaveFocus, {connected:true,selectedDate:true,oldOpenerGone:true,staleFocusDuringSave:false});
  assert.deepEqual(v.afterCancelFocus, {connected:true,selectedDate:true,staleFocusDuringCancel:false});
  assert.equal(v.authScheduleBeforeExpense, true, 'schedule remains visible while the auxiliary expense request waits');
  assert.ok(v.authAfterExpenseFocus.expenseRequests >= 2, 'initial and post-save expense responses were both requested');
  assert.equal(v.authAfterExpenseFocus.connected, true);
  assert.equal(v.authAfterExpenseFocus.selectedDate, true, 'delayed expense render must not detach the final focus target');
  assert.equal(v.authAfterExpenseFocus.schedulePresent, true);
  assert.equal(v.authAfterExpenseFocus.expenseFailed, true, 'expense failure must not hide the authoritative schedule');
  assert.deepEqual(v.authNavigationDuringExpense, {connected:true,dayDetailFocus:true,selectedDate:true,schedulePresent:true},
    'navigation during delayed Auth expense must retain focus in the newly selected connected day detail');
  assert.deepEqual(v.authAwayAndBackDuringExpense, {connected:true,dayDetailFocus:true,selectedDate:true,dateTriggerUnfocused:true,schedulePresent:true},
    'navigation away and back during delayed Auth expense must not let the stale save continuation replace day-detail focus');
  console.log('LOTBI Calendar compact editor and contracts: PASS');
} finally {
  server.kill();
  fs.unlinkSync(fixturePath);
  fs.unlinkSync(wrapperPath);
}
