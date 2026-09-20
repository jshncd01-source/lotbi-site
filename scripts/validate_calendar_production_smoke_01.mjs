import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PORT = 9333;
const PROD = 'https://lotbiai.com/?calendar-production-smoke=1';

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

async function fetchJson(url) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw new Error(url + ' -> HTTP ' + response.status);
  return response.json();
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetchJson('http://127.0.0.1:' + PORT + '/json/list');
      const page = targets.find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome CDP target did not become ready');
}

class Cdp {
  constructor(url) {
    if (typeof WebSocket !== 'function') throw new Error('Node WebSocket global is unavailable');
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.console = [];
    this.exceptions = [];
    this.networkFailures = [];
  }

  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket open timeout')), 5000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once: true});
      this.socket.addEventListener('error', event => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket error ' + String(event?.message || '')));
      }, {once: true});
    });
    this.socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)); } catch { return; }
      if (message.id && this.pending.has(message.id)) {
        const {resolve, reject, timer} = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message || 'CDP command failed'));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        this.console.push({
          type: message.params?.type,
          values: (message.params?.args || []).map(arg => arg.value ?? arg.description ?? '').slice(0, 6),
        });
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(message.params?.exceptionDetails || {});
      } else if (message.method === 'Network.loadingFailed') {
        this.networkFailures.push({
          requestId: message.params?.requestId,
          errorText: message.params?.errorText,
          type: message.params?.type,
          canceled: message.params?.canceled,
        });
      }
    });
  }

  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }, 10000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error('Runtime.evaluate failed: ' + JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  }

  close() {
    try { this.socket?.close(); } catch {}
  }
}

async function waitFor(check, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await check();
      if (last) return last;
    } catch (error) {
      last = String(error);
    }
    await sleep(100);
  }
  throw new Error('timeout ' + label + ' last=' + JSON.stringify(last));
}

const browser = browserPath();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-calendar-prod-'));
const chrome = spawn(browser, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--window-size=1440,900',
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  'about:blank',
], {stdio: ['ignore', 'pipe', 'pipe']});

let stderr = '';
chrome.stderr?.on('data', chunk => {
  stderr += String(chunk);
  if (stderr.length > 12000) stderr = stderr.slice(-12000);
});

let cdp;
try {
  const target = await waitForTarget();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.command('Page.enable');
  await cdp.command('Runtime.enable');
  await cdp.command('Network.enable');
  await cdp.command('Page.navigate', {url: PROD});

  await waitFor(() => cdp.evaluate("document.readyState === 'complete'"), 'document complete');
  await waitFor(
    () => cdp.evaluate("document.querySelector('.send-button')?.dataset.conversationMounted === 'true'"),
    'conversation mounted',
  );

  const before = await cdp.evaluate(`(() => {
    const entry = document.querySelector('.chat-sidebar-desktop button[data-calendar-view="all"]');
    return {
      href: location.href,
      entry: entry?.outerHTML || null,
      entryBound: entry?.dataset.calendarEntryBound || null,
      sendMounted: document.querySelector('.send-button')?.dataset.conversationMounted || null,
      siteAuth: document.body.dataset.siteAuthState || null,
    };
  })()`);

  if (!before.entry) throw new Error('Production Calendar entry missing: ' + JSON.stringify(before));
  if (before.entryBound !== 'true') {
    throw new Error('Production Calendar entry not directly bound: ' + JSON.stringify(before));
  }

  await cdp.evaluate(`document.querySelector('.chat-sidebar-desktop button[data-calendar-view="all"]').click(); true`);
  await waitFor(
    () => cdp.evaluate("Boolean(document.querySelector('.site-modal.site-calendar-modal'))"),
    'Calendar modal',
    7000,
  );

  const first = await cdp.evaluate(`(() => {
    const modal = document.querySelector('.site-modal.site-calendar-modal');
    const content = modal?.querySelector('.site-modal-content');
    return {
      href: location.href,
      title: modal?.querySelector('.site-modal-header h2')?.textContent?.trim() || null,
      view: content?.dataset.calendarManagerView || null,
      access: content?.dataset.calendarAccess || null,
      weekCount: Number(modal?.querySelector('.calendar-month-grid')?.dataset.weekCount || 0),
      cellCount: modal?.querySelectorAll('.calendar-date-cell').length || 0,
      tabs: [...(modal?.querySelectorAll('.calendar-mode-tab') || [])].map(node => node.textContent.trim()),
      close: Boolean(modal?.querySelector('.site-modal-close')),
    };
  })()`);

  if (first.title !== '\uce98\ub9b0\ub354') throw new Error('Calendar modal title mismatch: ' + JSON.stringify(first));
  if (first.view !== 'month') throw new Error('Calendar did not open in Month: ' + JSON.stringify(first));
  if (![4, 5, 6].includes(first.weekCount) || first.cellCount !== first.weekCount * 7) {
    throw new Error('Calendar Month geometry invalid: ' + JSON.stringify(first));
  }
  for (const label of ['\uc6d4', '\uc5f0\ub3c4', '\uc77c\uc815', '\ud655\uc778 \ud544\uc694']) {
    if (!first.tabs.includes(label)) throw new Error('Calendar mode tab missing ' + label + ': ' + JSON.stringify(first));
  }
  if (!first.close) throw new Error('Calendar close control missing: ' + JSON.stringify(first));
  if (!first.href.startsWith('https://lotbiai.com/')) {
    throw new Error('Calendar unexpectedly navigated away: ' + JSON.stringify(first));
  }

  await cdp.evaluate(`document.querySelector('.site-calendar-modal .site-modal-close').click(); true`);
  await waitFor(
    () => cdp.evaluate("!document.querySelector('.site-modal.site-calendar-modal')"),
    'Calendar close',
  );

  const replacement = await cdp.evaluate(`(() => {
    const entry = document.querySelector('.chat-sidebar-desktop button[data-calendar-view="all"]');
    const clone = entry.cloneNode(true);
    entry.replaceWith(clone);
    const staleBound = clone.dataset.calendarEntryBound || null;
    clone.click();
    return {staleBound};
  })()`);
  if (replacement.staleBound !== 'true') {
    throw new Error('Replacement did not preserve stale bound marker: ' + JSON.stringify(replacement));
  }

  await waitFor(
    () => cdp.evaluate("Boolean(document.querySelector('.site-modal.site-calendar-modal'))"),
    'Calendar delegated fallback',
    7000,
  );

  const fallback = await cdp.evaluate(`(() => {
    const modal = document.querySelector('.site-modal.site-calendar-modal');
    return {
      title: modal?.querySelector('.site-modal-header h2')?.textContent?.trim() || null,
      view: modal?.querySelector('.site-modal-content')?.dataset.calendarManagerView || null,
      href: location.href,
    };
  })()`);

  if (fallback.title !== '\uce98\ub9b0\ub354' || fallback.view !== 'month') {
    throw new Error('Delegated Calendar fallback failed: ' + JSON.stringify(fallback));
  }


  await cdp.evaluate("document.querySelector('.site-calendar-modal .site-modal-close').click(); true");
  await waitFor(
    () => cdp.evaluate("!document.querySelector('.site-modal.site-calendar-modal')"),
    'Calendar close after fallback',
  );

  await cdp.command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.command('Page.reload', {ignoreCache: true});
  await waitFor(() => cdp.evaluate("document.readyState === 'complete'"), 'desktop reload');
  await waitFor(
    () => cdp.evaluate("document.querySelector('.send-button')?.dataset.conversationMounted === 'true'"),
    'desktop conversation remount',
  );
  await cdp.evaluate("document.querySelector('.chat-sidebar-desktop button[data-calendar-view=\"all\"]').click(); true");
  await waitFor(
    () => cdp.evaluate("Boolean(document.querySelector('.site-modal.site-calendar-modal'))"),
    'desktop Calendar reopen',
    7000,
  );

  const keyboardStart = await cdp.evaluate("(() => { const buttons=[...document.querySelectorAll('.calendar-date-cell[data-current-month=\"true\"] .calendar-date-trigger')]; const target=buttons.find(button=>button.dataset.calendarDateTrigger!==document.querySelector('.calendar-date-cell[data-selected=\"true\"] .calendar-date-trigger')?.dataset.calendarDateTrigger) || buttons[0]; target.focus(); return {date:target.dataset.calendarDateTrigger,active:document.activeElement?.dataset.calendarDateTrigger||null}; })()");
  if (!keyboardStart.date || keyboardStart.active !== keyboardStart.date) {
    throw new Error('Calendar keyboard start focus failed: ' + JSON.stringify(keyboardStart));
  }
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight'});
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight'});
  const keyboardMoved = await waitFor(
    () => cdp.evaluate("(() => { const active=document.activeElement?.dataset.calendarDateTrigger||null; const selected=document.querySelector('.calendar-date-cell[data-selected=\"true\"]')?.dataset.calendarDate||null; return active && active===selected ? {active,selected} : null; })()"),
    'ArrowRight date focus',
  );
  if (keyboardMoved.active === keyboardStart.date) {
    throw new Error('ArrowRight did not move Calendar date focus: ' + JSON.stringify({keyboardStart, keyboardMoved}));
  }
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter'});
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter'});
  await waitFor(
    () => cdp.evaluate("Boolean(document.querySelector('.calendar-day-panel:not([hidden])'))"),
    'Enter selected-day detail',
  );
  const enterFocus = await waitFor(
    () => cdp.evaluate("document.activeElement?.dataset.calendarDateTrigger || null"),
    'Enter date focus restore',
  );
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape'});
  await cdp.command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape'});
  await waitFor(
    () => cdp.evaluate("document.querySelector('.calendar-day-panel')?.hidden === true"),
    'Escape selected-day detail',
  );
  const keyboardEscape = await waitFor(
    () => cdp.evaluate("(() => { const active=document.activeElement?.dataset.calendarDateTrigger||null; return active ? {active} : null; })()"),
    'Escape date focus restore',
  );
  keyboardEscape.enterFocus = enterFocus;

  const guestTitle = 'LOTBI Production E2E temporary';
  const guestDate = await cdp.evaluate("(() => { const cell=[...document.querySelectorAll('.calendar-date-cell[data-current-month=\"true\"]')].find(node=>node.dataset.calendarDate && !node.dataset.today); const trigger=cell?.querySelector('.calendar-date-trigger'); trigger?.click(); return cell?.dataset.calendarDate||null; })()");
  if (!guestDate) throw new Error('Guest CRUD target date missing');
  await waitFor(
    () => cdp.evaluate("Boolean(document.querySelector('.calendar-day-panel:not([hidden]) .calendar-day-add'))"),
    'Guest day add control',
  );
  await cdp.evaluate("document.querySelector('.calendar-day-panel:not([hidden]) .calendar-day-add').click(); true");
  await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.calendar-editor-dialog'))"), 'Guest add editor');
  await cdp.evaluate("(() => { const title=document.querySelector('.calendar-editor-title'); const date=document.querySelector('.calendar-editor-date'); const time=document.querySelector('.calendar-editor-time'); const allDay=document.querySelector('.calendar-editor-all-day input'); title.value='LOTBI Production E2E temporary'; title.dispatchEvent(new Event('input',{bubbles:true})); date.value=" + JSON.stringify("__GUEST_DATE__") + "; if(allDay?.checked){allDay.click();} time.value='15:30'; time.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.calendar-editor-save').click(); return true; })()".replace('"__GUEST_DATE__"', JSON.stringify(guestDate)));
  await waitFor(
    () => cdp.evaluate("Boolean([...document.querySelectorAll('.calendar-event-chip')].find(node=>node.textContent.includes('LOTBI Production E2E temporary')))"),
    'Guest event visible after save',
  );
  const guestStored = await cdp.evaluate("(() => { const raw=localStorage.getItem('lotbi.guest.calendar.v1'); const parsed=raw?JSON.parse(raw):null; const event=parsed?.events?.find(item=>item.title==='LOTBI Production E2E temporary'); return event ? {id:event.id,date:event.local_date,datetime:event.local_datetime} : null; })()");
  if (!guestStored || guestStored.date !== guestDate) {
    throw new Error('Guest event not stored locally: ' + JSON.stringify({guestDate, guestStored}));
  }
  await cdp.evaluate("([...document.querySelectorAll('.calendar-event-chip')].find(node=>node.textContent.includes('LOTBI Production E2E temporary'))).click(); true");
  await waitFor(() => cdp.evaluate("document.querySelector('.calendar-editor-dialog h3')?.textContent==='일정 수정'"), 'Guest edit editor');
  await cdp.evaluate("document.querySelector('.calendar-editor-cancel').click(); true");
  await waitFor(() => cdp.evaluate("!document.querySelector('.calendar-editor-dialog')"), 'Guest edit cancel');

  await cdp.evaluate("([...document.querySelectorAll('.calendar-event-chip')].find(node=>node.textContent.includes('LOTBI Production E2E temporary'))).click(); true");
  await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.calendar-editor-delete'))"), 'Guest delete control');
  await cdp.evaluate("document.querySelector('.calendar-editor-delete').click(); true");
  await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.calendar-editor-confirm-delete-button'))"), 'Guest delete confirmation');
  await cdp.evaluate("document.querySelector('.calendar-editor-confirm-delete-button').click(); true");
  await waitFor(
    () => cdp.evaluate("!localStorage.getItem('lotbi.guest.calendar.v1') || !JSON.parse(localStorage.getItem('lotbi.guest.calendar.v1')).events.some(item=>item.title==='LOTBI Production E2E temporary')"),
    'Guest event deleted',
  );
  const guestCrud = {date: guestDate, stored: guestStored, deleted: true};

  await cdp.evaluate("document.querySelector('.site-calendar-modal .site-modal-close').click(); true");
  await waitFor(() => cdp.evaluate("!document.querySelector('.site-modal.site-calendar-modal')"), 'desktop Calendar close after CRUD');

  const responsiveResults = [];
  for (const [width, height] of [[768, 900], [390, 844], [340, 800]]) {
    await cdp.command('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.command('Page.reload', {ignoreCache: true});
    await waitFor(() => cdp.evaluate("document.readyState === 'complete'"), width + ' document complete');
    await waitFor(
      () => cdp.evaluate("document.querySelector('.send-button')?.dataset.conversationMounted === 'true'"),
      width + ' conversation mounted',
    );
    await cdp.evaluate("document.querySelector('[data-mobile-nav-open]').click(); true");
    await waitFor(() => cdp.evaluate("document.body.classList.contains('nav-drawer-open')"), width + ' mobile drawer');
    await cdp.evaluate("document.querySelector('#mobile-nav-drawer button[data-calendar-view=\"all\"]').click(); true");
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.site-modal.site-calendar-modal'))"), width + ' Calendar modal', 7000);
    const geometry = await cdp.evaluate("(() => { const modal=document.querySelector('.site-modal.site-calendar-modal'); const content=modal?.querySelector('.site-modal-content'); const grid=modal?.querySelector('.calendar-month-grid'); const detail=modal?.querySelector('.calendar-day-panel'); const toolbar=modal?.querySelector('.calendar-toolbar'); const mr=modal?.getBoundingClientRect(); const gr=grid?.getBoundingClientRect(); const dr=detail?.getBoundingClientRect(); return {width:innerWidth,height:innerHeight,view:content?.dataset.calendarManagerView||null,access:content?.dataset.calendarAccess||null,weekCount:Number(grid?.dataset.weekCount||0),cellCount:grid?.querySelectorAll('.calendar-date-cell').length||0,modalWidth:mr?.width||0,modalNoX:modal?modal.scrollWidth<=modal.clientWidth+1:false,toolbarNoX:toolbar?toolbar.scrollWidth<=toolbar.clientWidth+1:false,detailHidden:detail?.hidden===true,detailPosition:detail?getComputedStyle(detail).position:null,detailTop:dr?.top||0,gridBottom:gr?.bottom||0,eventStackDisplay:getComputedStyle(modal.querySelector('.calendar-event-stack')).display}; })()");
    if (geometry.view !== 'month' || geometry.access !== 'guest') throw new Error(width + ' responsive Calendar state invalid: ' + JSON.stringify(geometry));
    if (![4,5,6].includes(geometry.weekCount) || geometry.cellCount !== geometry.weekCount * 7) throw new Error(width + ' responsive Month geometry invalid: ' + JSON.stringify(geometry));
    if (geometry.modalWidth > width + 1 || !geometry.modalNoX || !geometry.toolbarNoX) throw new Error(width + ' responsive horizontal overflow: ' + JSON.stringify(geometry));
    if (geometry.detailHidden || geometry.detailPosition !== 'static' || geometry.detailTop < geometry.gridBottom - 2) throw new Error(width + ' selected-day flow invalid: ' + JSON.stringify(geometry));
    if (geometry.eventStackDisplay !== 'none') throw new Error(width + ' Month event stack should collapse to overview: ' + JSON.stringify(geometry));
    responsiveResults.push(geometry);
    await cdp.evaluate("document.querySelector('.site-calendar-modal .site-modal-close').click(); true");
    await waitFor(() => cdp.evaluate("!document.querySelector('.site-modal.site-calendar-modal')"), width + ' Calendar close');
  }

  await cdp.command('Emulation.setDeviceMetricsOverride', {
    width: 720, height: 450, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.command('Page.reload', {ignoreCache: true});
  await waitFor(() => cdp.evaluate("document.readyState === 'complete'"), '200 percent equivalent reload');
  await waitFor(
    () => cdp.evaluate("document.querySelector('.send-button')?.dataset.conversationMounted === 'true'"),
    '200 percent equivalent mount',
  );
  await cdp.evaluate("document.querySelector('[data-mobile-nav-open]').click(); true");
  await waitFor(() => cdp.evaluate("document.body.classList.contains('nav-drawer-open')"), '200 percent equivalent drawer');
  await cdp.evaluate("document.querySelector('#mobile-nav-drawer button[data-calendar-view=\"all\"]').click(); true");
  await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.site-modal.site-calendar-modal'))"), '200 percent equivalent Calendar', 7000);
  const zoomEquivalent = await cdp.evaluate("(() => { const modal=document.querySelector('.site-modal.site-calendar-modal'); const grid=modal.querySelector('.calendar-month-grid'); const toolbar=modal.querySelector('.calendar-toolbar'); return {width:innerWidth,height:innerHeight,modalNoX:modal.scrollWidth<=modal.clientWidth+1,gridNoX:grid.scrollWidth<=grid.clientWidth+1,toolbarNoX:toolbar.scrollWidth<=toolbar.clientWidth+1,weekCount:Number(grid.dataset.weekCount||0),cellCount:grid.querySelectorAll('.calendar-date-cell').length}; })()");
  if (!zoomEquivalent.modalNoX || !zoomEquivalent.gridNoX || !zoomEquivalent.toolbarNoX) {
    throw new Error('200 percent zoom-equivalent horizontal overflow: ' + JSON.stringify(zoomEquivalent));
  }

  console.log('CALENDAR PRODUCTION SMOKE PASS', JSON.stringify({
    before, first, replacement, fallback,
    keyboard: {start: keyboardStart, moved: keyboardMoved, escape: keyboardEscape},
    guestCrud,
    responsive: responsiveResults,
    zoomEquivalent,
  }));
} catch (error) {
  const diagnostic = {
    error: String(error?.stack || error),
    console: cdp?.console?.slice(-20) || [],
    exceptions: cdp?.exceptions?.slice(-10) || [],
    networkFailures: cdp?.networkFailures?.slice(-20) || [],
    chromeStderr: stderr.slice(-6000),
  };
  console.error('CALENDAR PRODUCTION SMOKE FAIL', JSON.stringify(diagnostic));
  process.exitCode = 1;
} finally {
  cdp?.close();
  chrome.kill('SIGTERM');
  await sleep(200);
  fs.rmSync(profile, {recursive: true, force: true});
}
