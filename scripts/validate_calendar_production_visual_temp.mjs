import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

const OUTPUT = path.resolve('production-calendar-evidence');
const PORT = 9223;
const DEBUG = `http://127.0.0.1:${PORT}`;
const TARGET = 'https://lotbiai.com/?calendar-production-e2e=20260921-calgeom1';
const viewports = [[1280, 900], [1440, 900], [1440, 1200]];

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(fn, label, timeout = 20000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (error) {
      last = error;
    }
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${label}: ${String(last ?? '')}`);
}

async function waitForDebug() {
  return waitFor(async () => {
    const response = await fetch(`${DEBUG}/json/version`);
    return response.ok ? response.json() : null;
  }, 'Chrome DevTools endpoint');
}

async function connectCdp() {
  const created = await fetch(`${DEBUG}/json/new?${encodeURIComponent('about:blank')}`, {method: 'PUT'});
  if (!created.ok) throw new Error(`CDP target create failed: ${created.status}`);
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, {once: true});
    ws.addEventListener('error', reject, {once: true});
  });

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result || {});
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params?.exceptionDetails;
      exceptions.push(detail?.exception?.description || detail?.text || 'Runtime exception');
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, {resolve, reject, method});
    ws.send(JSON.stringify({id, method, params}));
  });

  const evaluate = async (expression, {awaitPromise = false} = {}) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed');
    }
    return result.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  return {ws, send, evaluate, exceptions};
}

const fixtureScript = `
(() => {
  localStorage.removeItem('lotbi.guest.calendar.v1');
  const date = '2026-09-15';
  const titles = ['치과', '고객 미팅', '미용실', '저녁 약속', '자동차 검사'];
  const events = titles.map((title, index) => {
    const hour = 9 + Math.floor(index / 2);
    const minute = index % 2 === 0 ? '00' : '30';
    const suffix = String(index + 1).padStart(12, '0');
    return {
      id: 'guest_00000000-0000-4000-8000-' + suffix,
      title,
      local_date: date,
      local_datetime: date + 'T' + String(hour).padStart(2, '0') + ':' + minute + ':00',
      all_day: false,
      created_at: '2026-09-21T00:00:00.000Z',
      updated_at: '2026-09-21T00:00:00.000Z'
    };
  });
  localStorage.setItem('lotbi.guest.calendar.v1', JSON.stringify({version: 1, events}));
  return events.length;
})()
`;

const geometryScript = `
(() => {
  const q = selector => document.querySelector(selector);
  const rect = node => {
    const value = node.getBoundingClientRect();
    return {left:value.left, top:value.top, right:value.right, bottom:value.bottom, width:value.width, height:value.height};
  };
  const noX = node => node.scrollWidth <= node.clientWidth + 1;
  const modal = q('.site-modal.site-calendar-modal');
  const content = modal?.querySelector('.site-modal-content');
  const shell = modal?.querySelector('.calendar-product-shell');
  const viewport = modal?.querySelector('.calendar-viewport');
  const grid = modal?.querySelector('.calendar-month-grid');
  const detail = modal?.querySelector('.calendar-day-panel');
  if (!modal || !content || !shell || !viewport || !grid || !detail) return {ok:false, reason:'calendar DOM missing'};
  const cells = [...grid.querySelectorAll('.calendar-date-cell')];
  const heights = cells.map(node => node.getBoundingClientRect().height);
  const target = grid.querySelector('[data-calendar-date="2026-09-15"]');
  const rows = target ? [...target.querySelectorAll('.calendar-event-chip')] : [];
  const more = target?.querySelector('.calendar-event-overflow');
  const visible = rows.filter(row => !row.hidden && getComputedStyle(row).display !== 'none').length;
  const hiddenCount = more && !more.hidden && getComputedStyle(more).display !== 'none' ? Number(more.dataset.hiddenCount || 0) : 0;
  const contentRect = content.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const contentStyle = getComputedStyle(content);
  const innerBottom = contentRect.bottom - (parseFloat(contentStyle.paddingBottom) || 0);
  return {
    ok:true,
    viewport:{width:innerWidth,height:innerHeight},
    modal:rect(modal),
    content:{...rect(content), clientHeight:content.clientHeight, scrollHeight:content.scrollHeight, overflowY:contentStyle.overflowY},
    shell:rect(shell),
    calendarViewport:rect(viewport),
    grid:{...rect(grid), weekCount:Number(grid.dataset.weekCount || 0), cells:cells.length},
    cellHeight:target?.getBoundingClientRect().height || 0,
    rowHeightSpread:heights.length ? Math.max(...heights) - Math.min(...heights) : 0,
    unusedBottom:Math.max(0, Math.round(innerBottom - gridRect.bottom)),
    fiveEvent:{rows:rows.length, visible, hiddenCount, overflowText:more && !more.hidden ? more.textContent : ''},
    horizontal:{modal:noX(modal),content:noX(content),grid:noX(grid)},
    scrolling:{
      modalOverflowY:getComputedStyle(modal).overflowY,
      modalOwnScroll:modal.scrollHeight > modal.clientHeight + 1,
      contentOwnScroll:content.scrollHeight > content.clientHeight + 1
    },
    detail:{hidden:detail.hidden, position:getComputedStyle(detail).position}
  };
})()
`;

async function main() {
  fs.mkdirSync(OUTPUT, {recursive: true});
  const browser = browserPath();
  const userData = `/tmp/lotbi-calendar-production-${process.pid}`;
  const chrome = spawn(browser, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  chrome.stderr.on('data', chunk => { stderr += String(chunk); });

  try {
    await waitForDebug();
    const cdp = await connectCdp();
    try {
      const results = [];
      for (const [width, height] of viewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width, height, deviceScaleFactor: 1, mobile: false,
          screenWidth: width, screenHeight: height,
        });
        await cdp.send('Page.navigate', {url: `${TARGET}&viewport=${width}x${height}&t=${Date.now()}`});
        await waitFor(async () => cdp.evaluate(`document.readyState === 'complete'`), `page load ${width}x${height}`);
        await waitFor(async () => cdp.evaluate(`Boolean(document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]'))`), 'Calendar sidebar control');
        await waitFor(async () => cdp.evaluate(`document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]')?.dataset.calendarEntryBound === 'true'`), 'Calendar binding', 25000);

        const seeded = await cdp.evaluate(fixtureScript);
        if (seeded !== 5) throw new Error(`fixture seed failed: ${seeded}`);
        const click = await cdp.evaluate(`(() => {
          const button = document.querySelector('.chat-sidebar-desktop [data-calendar-view="all"]');
          if (!button) return {ok:false};
          button.click();
          return {ok:true,bound:button.dataset.calendarEntryBound || ''};
        })()`);
        if (!click?.ok) throw new Error('Calendar click target missing');

        await waitFor(async () => cdp.evaluate(`Boolean(document.querySelector('.site-modal.site-calendar-modal .calendar-month-grid'))`), `Calendar modal ${width}x${height}`, 25000);
        await sleep(500);
        const geometry = await cdp.evaluate(geometryScript);
        if (!geometry?.ok) throw new Error(`geometry missing at ${width}x${height}: ${geometry?.reason || 'unknown'}`);

        const errors = [];
        if (geometry.viewport.width !== width || geometry.viewport.height !== height) errors.push('viewport mismatch');
        if (geometry.grid.weekCount !== 5 || geometry.grid.cells !== 35) errors.push('5-week geometry');
        if (geometry.rowHeightSpread > 2) errors.push(`row spread ${geometry.rowHeightSpread}`);
        if (geometry.unusedBottom > 4) errors.push(`unused bottom ${geometry.unusedBottom}px`);
        if (!geometry.horizontal.modal || !geometry.horizontal.content || !geometry.horizontal.grid) errors.push('horizontal overflow');
        if (geometry.scrolling.modalOverflowY !== 'hidden' || geometry.scrolling.modalOwnScroll || geometry.scrolling.contentOwnScroll) errors.push('desktop double scroll');
        if (!geometry.detail.hidden || geometry.detail.position !== 'fixed') errors.push('selected-day detail contract');
        if (geometry.fiveEvent.rows !== 5 || geometry.fiveEvent.visible + geometry.fiveEvent.hiddenCount !== 5) errors.push('5-event accounting');
        if (height >= 1200 && geometry.fiveEvent.visible !== 5) errors.push(`5-event visibility ${geometry.fiveEvent.visible}/5`);
        if (errors.length) throw new Error(`${width}x${height} Production RED: ${errors.join(', ')} :: ${JSON.stringify(geometry)}`);

        const shot = await cdp.send('Page.captureScreenshot', {format:'png', fromSurface:true, captureBeyondViewport:false});
        fs.writeFileSync(path.join(OUTPUT, `calendar-production-${width}x${height}.png`), Buffer.from(shot.data, 'base64'));
        results.push({width, height, click, geometry});
        await cdp.evaluate(`document.querySelector('.site-calendar-modal .site-modal-close')?.click()`);
        await sleep(150);
      }
      fs.writeFileSync(path.join(OUTPUT, 'calendar-production-geometry.json'), JSON.stringify({target:TARGET,results,exceptions:cdp.exceptions}, null, 2));
      console.log('CALENDAR PRODUCTION VISUAL GREEN', JSON.stringify(results));
    } finally {
      cdp.ws.close();
    }
  } finally {
    chrome.kill('SIGTERM');
    await sleep(300);
    fs.rmSync(userData, {recursive:true, force:true});
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
