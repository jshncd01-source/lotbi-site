import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOT_DIR || path.join(ROOT, 'docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/before');
const URL = 'https://lotbiai.com/#calendar';

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if ((name.includes('/') || name.includes('\\')) && fs.existsSync(name)) return name;
    const located = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {encoding: 'utf8'});
    if (located.status === 0 && located.stdout.trim()) return located.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required');
}

fs.mkdirSync(OUT, {recursive: true});
const debugPort = 9437;
const browser = spawn(browserPath(), [
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding',
  `--remote-debugging-port=${debugPort}`,'about:blank',
], {stdio: 'ignore'});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  let targets;
  for (let index = 0; index < 80; index += 1) {
    try {
      const listed = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      targets = listed.filter(target => target.type === 'page' && !String(target.url).startsWith('chrome-extension://'));
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  if (!targets?.length) throw new Error('no DevTools page target');
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result); pending.delete(message.id); } };
  await new Promise(resolve => { socket.onopen = resolve; });
  await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront');

  for (const [name,width,height,mobile,theme] of [
    ['pc-light',1280,900,false,'light'],['pc-dark',1280,900,false,'dark'],
    ['mobile-light',360,780,true,'light'],['mobile-dark',360,780,true,'dark'],
  ]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await send('Page.navigate',{url:'https://lotbiai.com/'}); await sleep(4500);
    await send('Runtime.evaluate',{expression:`localStorage.setItem('lotbi.site.theme.bootstrap.v1','${theme}');document.cookie='lotbi_theme_preference_v1=${theme}; Path=/; SameSite=Lax';location.href='${URL}'`});
    let ready = false;
    for (let index = 0; index < 160; index += 1) {
      await sleep(100);
      const probe = await send('Runtime.evaluate',{returnByValue:true,expression:"Boolean(document.querySelector('.site-calendar-modal,.consumer-workspace[data-workspace=calendar]'))"});
      if (probe.result.value) { ready = true; break; }
    }
    if (!ready) throw new Error(`${name}: production Calendar did not open`);
    await send('Runtime.evaluate',{expression:`document.body.dataset.siteTheme='${theme}';document.documentElement.dataset.siteThemeBootstrap='${theme}'`});
    await sleep(1800);
    const shot = await send('Page.captureScreenshot',{format:'png'});
    const target = path.join(OUT,`${name}.png`);
    fs.writeFileSync(target,Buffer.from(shot.data,'base64'));
    const state = await send('Runtime.evaluate',{returnByValue:true,expression:"JSON.stringify({href:location.href,theme:document.body.dataset.siteTheme||'',width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})"});
    console.log(name,state.result.value,'->',target);
  }
  socket.close();
} finally {
  browser.kill();
}
