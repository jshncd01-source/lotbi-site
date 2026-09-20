import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';

const PORT = 9223;
const TARGET = 'https://lotbiai.com/?calendar_prod_e2e=20260921';
const PROFILE = `/tmp/lotbi-calendar-prod-e2e-${process.pid}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${url}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError || new Error('Timed out waiting for ' + url);
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', () => reject(new Error('CDP websocket connection failed')), {once: true});
  });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];

  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
      else waiter.resolve(message.result || {});
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params?.exceptionDetails;
      consoleErrors.push(detail?.exception?.description || detail?.text || 'Runtime.exceptionThrown');
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params?.entry;
      if (entry?.level === 'error') consoleErrors.push(entry.text || 'Log error');
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, {resolve, reject});
    socket.send(JSON.stringify({id: requestId, method, params}));
  });

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
    }
    return result.result?.value;
  };

  return {socket, send, evaluate, consoleErrors};
}

async function waitFor(evaluate, expression, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error('timeout ' + label);
}

const browser = browserPath();
const chrome = spawn(browser, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1440,900',
  '--force-device-scale-factor=1',
  'about:blank',
], {stdio: 'ignore'});

let cdp;
try {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const targets = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  if (!page) throw new Error('CDP page target missing');

  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', {url: TARGET});

  await waitFor(
    cdp.evaluate,
    `document.readyState === 'complete' && document.querySelector('.send-button')?.dataset.conversationMounted === 'true'`,
    'conversation mount',
    20000,
  );

  const boot = await cdp.evaluate(`(() => {
    const entry = document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]');
    if (!(entry instanceof HTMLButtonElement)) return {ok:false};
    const rect = entry.getBoundingClientRect();
    return {
      ok:true,
      text:entry.textContent.trim(),
      bound:entry.dataset.calendarEntryBound || '',
      width:rect.width,
      height:rect.height,
      display:getComputedStyle(entry).display,
      mounted:document.querySelector('.send-button')?.dataset.conversationMounted || ''
    };
  })()`);
  if (!boot?.ok) throw new Error('Production Desktop Calendar entry missing');
  if (boot.mounted !== 'true') throw new Error('Production conversation runtime not mounted');
  if (boot.bound !== 'true') throw new Error('Production Calendar entry not directly bound');
  if (boot.width <= 0 || boot.height <= 0 || boot.display === 'none') throw new Error('Production Calendar entry not visible');

  await cdp.evaluate(`document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]').click()`);
  await waitFor(
    cdp.evaluate,
    `Boolean(document.querySelector('.site-modal.site-calendar-modal'))`,
    'Production Calendar modal',
    10000,
  );
  await waitFor(
    cdp.evaluate,
    `document.querySelector('.site-modal.site-calendar-modal .site-modal-content')?.dataset.calendarManagerView === 'month'`,
    'Production Calendar month view',
    10000,
  );

  const snapshot = await cdp.evaluate(`(() => {
    const modal = document.querySelector('.site-modal.site-calendar-modal');
    const content = modal?.querySelector('.site-modal-content');
    const grid = modal?.querySelector('.calendar-month-grid');
    const layout = modal?.querySelector('.calendar-month-layout');
    const today = modal?.querySelector('.calendar-today-button');
    const attention = [...(modal?.querySelectorAll('.calendar-mode-tab') || [])].find(node => node.textContent.trim() === '확인 필요');
    const toolbar = modal?.querySelector('.calendar-toolbar');
    const oneLine = node => Boolean(node) && getComputedStyle(node).whiteSpace === 'nowrap' && node.scrollHeight <= node.clientHeight + 2;
    const noX = node => Boolean(node) && node.scrollWidth <= node.clientWidth + 1;
    const rect = node => node ? node.getBoundingClientRect() : {width:0,height:0,top:0,bottom:0};
    const modalRect = rect(modal), gridRect = rect(grid), contentRect = rect(content);
    return {
      access: content?.dataset.calendarAccess || '',
      mode: content?.dataset.calendarManagerView || '',
      cells: grid?.querySelectorAll('.calendar-date-cell').length || 0,
      weekCount: Number(grid?.dataset.weekCount || 0),
      modal: {
        width: modalRect.width,
        height: modalRect.height,
        overflowY: modal ? getComputedStyle(modal).overflowY : '',
        noX: noX(modal)
      },
      content: {
        overflowY: content ? getComputedStyle(content).overflowY : '',
        noX: noX(content),
        scrollHeight: content?.scrollHeight || 0,
        clientHeight: content?.clientHeight || 0
      },
      grid: {
        noX: noX(grid),
        bottom: gridRect.bottom,
        contentBottom: contentRect.bottom
      },
      toolbar: {
        todayOneLine: oneLine(today),
        attentionOneLine: oneLine(attention),
        noX: noX(toolbar),
        text: toolbar?.innerText || ''
      },
      layout: {
        width: rect(layout).width,
        firstWidth: rect(layout?.children?.[0]).width,
        secondHidden: Boolean(layout?.children?.[1]?.hidden)
      }
    };
  })()`);

  if (snapshot.access !== 'guest') throw new Error('Production Guest Calendar access contract failed');
  if (snapshot.mode !== 'month') throw new Error('Production Calendar did not enter month view');
  if (![28, 35, 42].includes(snapshot.cells)) throw new Error('Production month grid cell count invalid: ' + snapshot.cells);
  if (snapshot.weekCount !== snapshot.cells / 7) throw new Error('Production Calendar weekCount mismatch');
  if (snapshot.modal.width < 1050) throw new Error('Production Calendar modal too narrow: ' + snapshot.modal.width);
  if (snapshot.modal.height < 820) throw new Error('Production Calendar modal too short: ' + snapshot.modal.height);
  if (snapshot.modal.overflowY !== 'hidden') throw new Error('Production Calendar modal shell scrolls');
  if (snapshot.content.overflowY !== 'hidden') throw new Error('Production month content scrolls');
  if (!snapshot.modal.noX || !snapshot.content.noX || !snapshot.grid.noX) throw new Error('Production Calendar horizontal overflow');
  if (!snapshot.toolbar.todayOneLine || !snapshot.toolbar.attentionOneLine) throw new Error('Production Calendar toolbar wrapping');
  if (snapshot.grid.bottom > snapshot.grid.contentBottom + 2) throw new Error('Production Calendar month grid not initially visible');

  const modeMap = {연도:'year', 일정:'agenda', '확인 필요':'attention', 월:'month'};
  for (const [label, mode] of Object.entries(modeMap)) {
    const clicked = await cdp.evaluate(`(() => {
      const modal=document.querySelector('.site-modal.site-calendar-modal');
      const button=[...modal.querySelectorAll('.calendar-mode-tab')].find(node=>node.textContent.trim()===${JSON.stringify(label)});
      if(!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error('Production Calendar control missing: ' + label);
    await waitFor(
      cdp.evaluate,
      `document.querySelector('.site-modal.site-calendar-modal .site-modal-content')?.dataset.calendarManagerView === ${JSON.stringify(mode)}`,
      'Production Calendar mode ' + label,
      10000,
    );
  }

  const titleBefore = await cdp.evaluate(`document.querySelector('.site-modal.site-calendar-modal .calendar-title-button')?.textContent || ''`);
  await cdp.evaluate(`document.querySelector('.site-modal.site-calendar-modal .calendar-nav-button')?.click()`);
  await waitFor(
    cdp.evaluate,
    `document.querySelector('.site-modal.site-calendar-modal .calendar-title-button')?.textContent !== ${JSON.stringify(titleBefore)}`,
    'Production Calendar previous',
    10000,
  );
  await cdp.evaluate(`document.querySelectorAll('.site-modal.site-calendar-modal .calendar-nav-button')[1]?.click()`);
  await waitFor(
    cdp.evaluate,
    `document.querySelector('.site-modal.site-calendar-modal .calendar-title-button')?.textContent === ${JSON.stringify(titleBefore)}`,
    'Production Calendar next',
    10000,
  );

  const dateSelected = await cdp.evaluate(`(() => {
    const modal=document.querySelector('.site-modal.site-calendar-modal');
    const cell=[...modal.querySelectorAll('.calendar-date-cell[data-current-month="true"]')].find(node=>node.dataset.selected!=='true');
    const trigger=cell?.querySelector('[data-calendar-date-trigger]');
    if(!(trigger instanceof HTMLButtonElement)) return '';
    const date=cell.dataset.calendarDate || trigger.dataset.calendarDateTrigger || '';
    trigger.click();
    return date;
  })()`);
  if (!dateSelected) throw new Error('Production Calendar date selection target missing');
  await waitFor(
    cdp.evaluate,
    `document.querySelector('.site-modal.site-calendar-modal [data-calendar-date="${dateSelected}"]')?.dataset.selected === 'true'`,
    'Production Calendar date selection',
    10000,
  );

  await cdp.evaluate(`document.querySelector('.site-modal.site-calendar-modal .calendar-today-button')?.click()`);
  await waitFor(
    cdp.evaluate,
    `document.querySelector('.site-modal.site-calendar-modal .site-modal-content')?.dataset.calendarManagerView === 'month'`,
    'Production Calendar today',
    10000,
  );

  if (cdp.consoleErrors.length) throw new Error('Production browser console errors: ' + cdp.consoleErrors.join(' | '));

  console.log('CALENDAR PRODUCTION E2E PASS', JSON.stringify({
    target: TARGET,
    boot,
    snapshot,
    controls: ['연도', '일정', '확인 필요', '월', '이전', '다음', '날짜 선택', '오늘'],
    consoleErrors: cdp.consoleErrors,
  }));
} finally {
  try { cdp?.socket?.close(); } catch {}
  chrome.kill('SIGTERM');
  try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch {}
}
