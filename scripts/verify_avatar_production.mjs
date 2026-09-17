import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const TARGET = 'https://lotbiai.com/?avatar-production-verify=e4314a2e';
const OUT = path.resolve('avatar-production-evidence');
fs.mkdirSync(OUT, {recursive: true});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function chromePath() {
  for (const p of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium not found');
}

async function waitForFile(file) {
  for (let i = 0; i < 150; i += 1) {
    if (fs.existsSync(file)) return;
    await delay(100);
  }
  throw new Error('DevToolsActivePort timeout');
}

async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, {once: true});
    ws.addEventListener('error', reject, {once: true});
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      events.push(message);
      return;
    }
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, {resolve, reject});
    ws.send(JSON.stringify({id: messageId, method, params}));
  });
  return {ws, send, events};
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluation failed');
  return result.result.value;
}

const SNAPSHOT = `(() => {
  const api = window.__lotbiSiteAvatar;
  const state = api?.snapshot?.() || null;
  const wrap = document.querySelector('.chat-character-wrap');
  const stage = document.querySelector('[data-lotbi-avatar-stage]');
  const composer = document.querySelector('.chat-composer');
  const sidebar = document.querySelector('.chat-sidebar');
  const rect = el => el ? ({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}) : null;
  return {
    state,
    ready: wrap?.classList.contains('avatar-3d-ready') || false,
    fallback: wrap?.classList.contains('avatar-3d-fallback') || false,
    canvasCount: stage?.querySelectorAll('canvas').length || 0,
    viewport: {width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    stage: rect(stage),
    composer: rect(composer),
    sidebar: rect(sidebar),
    overflowX: Math.max(document.documentElement.scrollWidth-innerWidth,document.body.scrollWidth-innerWidth)
  };
})()`;

async function verify(label, width, height, mobile) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `lotbi-${label}-`));
  const chrome = spawn(chromePath(), [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ], {stdio:['ignore','ignore','pipe']});
  let stderr = '';
  chrome.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const activePort = path.join(profile, 'DevToolsActivePort');
    await waitForFile(activePort);
    const [port] = fs.readFileSync(activePort, 'utf8').trim().split('\n');
    const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(TARGET)}`, {method:'PUT'}).then(r => r.json());
    const {ws, send, events} = await cdp(target.webSocketDebuggerUrl);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height});
    await send('Page.navigate', {url:TARGET});

    let initial;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await delay(250);
      initial = await evaluate(send, SNAPSHOT);
      if (initial?.ready && initial.canvasCount === 1) break;
    }
    if (!initial?.ready || initial.canvasCount !== 1) throw new Error(`${label}: not ready ${JSON.stringify(initial)}`);
    if (initial.viewport.width !== width || initial.viewport.height !== height) throw new Error(`${label}: viewport ${JSON.stringify(initial.viewport)}`);
    await delay(3000);
    const finalTPlus3 = await evaluate(send, SNAPSHOT);
    if (!finalTPlus3.ready || finalTPlus3.fallback || finalTPlus3.canvasCount !== 1 || finalTPlus3.overflowX > 0) {
      throw new Error(`${label}: unstable ${JSON.stringify(finalTPlus3)}`);
    }
    const screenshot = await send('Page.captureScreenshot', {format:'png',fromSurface:true,captureBeyondViewport:false});
    fs.writeFileSync(path.join(OUT,`${label}-${width}x${height}-tplus3.png`), Buffer.from(screenshot.data,'base64'));
    const browserErrors = events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
    const report = {label,target,capturedAt:new Date().toISOString(),initial,finalTPlus3,browserErrors,chromeStderr:stderr};
    fs.writeFileSync(path.join(OUT,`${label}.json`), JSON.stringify(report,null,2));
    ws.close();
    return report;
  } finally {
    chrome.kill('SIGTERM');
    await delay(250);
    fs.rmSync(profile,{recursive:true,force:true});
  }
}

const results = [
  await verify('desktop-1440',1440,900,false),
  await verify('desktop-1366',1366,768,false),
  await verify('mobile-390',390,844,true)
];
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,2));
console.log('SITE-WEB-3D-AVATAR BROWSER ERROR DETAILS', JSON.stringify(results.map(r => ({label:r.label,browserErrors:r.browserErrors}))));
console.log('SITE-WEB-3D-AVATAR PRODUCTION BROWSER PASS', JSON.stringify(results.map(r => ({
  label:r.label,viewport:r.initial.viewport,loadMs:r.finalTPlus3.state.loadMs,
  canvasCount:r.finalTPlus3.canvasCount,overflowX:r.finalTPlus3.overflowX,errors:r.browserErrors.length
}))));
