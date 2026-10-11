// SCAM-SHIELD-PHOTO-LIBRARY-PICKER-01 — 진위확인 picture paths in a real browser.
//
// iPhone (Safari and the KakaoTalk in-app browser) opens the camera straight
// away for an <input capture> and draws every file control as "파일 선택". The
// first method is now 사진·스크린샷 선택 (no capture: photo library, screenshots,
// Android gallery, desktop files); 카메라로 촬영 is its own method and the only
// input with capture="environment".
//
// Real Chrome through the DevTools protocol, file chooser intercepted: a real
// tap/click on each named button must open the chooser for that path's own
// input (capture only on the camera one), the chosen file previews without any
// request, and only 확인하기 hands it to the analysis request (answered here).
// 375×812 iPhone Safari UA, 390×844 KakaoTalk UA, 412×915 Android UA (touch)
// and 1280×900 desktop. Viewport/UA emulation only — not an iPhone Safari /
// KakaoTalk / Android device run, and Chrome ignores capture on desktop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SCAM_PICKER_SHOTS || '';

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium',
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
  throw new Error('Chrome/Chromium is required for the 진위확인 photo picker validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.stat(target,(error,stat)=>send(res,!error&&stat.isDirectory()?path.join(target,'index.html'):target));
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);
async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

// Installed before any page script: Account/Core answered offline, the
// dialog's session question answered "signed in", and the analysis request
// recorded and answered here so no picture leaves the browser.
const MOCK = `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const network = window.__scamNetwork = [];
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    network.push({url: url.origin + url.pathname, form: init.body instanceof FormData, blob: init.body instanceof Blob});
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  const sent = window.__scamSent = [];
  window.addEventListener('lotbi:scam-shield-request', event => {
    const entries = [...event.detail.formData.entries()];
    sent.push(entries.map(([key, value]) => (typeof value === 'string' ? [key, value] : [key, {name: value.name, type: value.type, size: value.size}])));
    const text = entries.find(([key]) => key === 'scamText')?.[1] || '';
    const response = {
      riskLevel: 'HIGH_RISK',
      headline: '이건 열지 마세요',
      doNow: ['공식 홈페이지에서 대표번호를 직접 찾아 다시 확인하세요.'],
      doNot: ['첨부파일과 외부 주소를 열지 마세요.'],
      reasons: ['공식 기관을 흉내 낸 화면에서 외부 코드 연결과 개인정보 입력 요구가 함께 발견됐어요.'],
      confirmedFacts: ['문서 안에 외부 스크립트 연결이 있어요.'],
      unverifiedItems: ['발신 기관과 사건번호는 확인되지 않았어요.'],
      incidentTriage: null,
      evidence: [{signal: 'external_script', title: '외부 코드 연결', technicalDetail: 'mega.ibsgame.example'}],
    };
    const delay = text.includes('느린 첫 검사') ? 500 : (text.includes('빠른 두 번째 검사') ? 30 : 0);
    if (delay) setTimeout(() => event.detail.resolve(response), delay);
    else event.detail.resolve(response);
  });
})();`;

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KAKAOTALK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'mobile-360x800-light', width: 360, height: 800, mobile: true, userAgent: IPHONE_UA, theme: 'light'},
  {label: 'mobile-360x800-dark', width: 360, height: 800, mobile: true, userAgent: ANDROID_UA, theme: 'dark'},
  {label: 'iPhone-KakaoTalk-390x844-light', width: 390, height: 844, mobile: true, userAgent: KAKAOTALK_UA, theme: 'light'},
  {label: 'Android-412x915-dark', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, theme: 'dark'},
  {label: 'desktop-1280x900-light', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: 'light'},
  {label: 'desktop-1280x900-dark', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: 'dark'},
];

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

async function runCase(browser, origin, workDir, files, testCase) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  const checks = [];
  const check = (label, condition, detail) => {
    checks.push(label);
    assert.ok(condition, `${testCase.label}: ${label} — ${JSON.stringify(detail)}`);
  };
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const choosers = [];
    cdp.on(message => {
      if (message.sessionId === sessionId && message.method === 'Page.fileChooserOpened') choosers.push(message.params);
    });
    await page('Page.enable');
    await page('Runtime.enable');
    await page('DOM.enable');
    await page('Network.enable');
    await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: testCase.theme, url: origin});
    await page('Page.setInterceptFileChooserDialog', {enabled: true});
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});

    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
      return result.result.value;
    };
    const shot = async name => {
      if (!SHOTS) return;
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(SHOTS, {recursive: true});
      fs.writeFileSync(path.join(SHOTS, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    const loaded = new Promise(resolve => {
      const stop = cdp.on(message => {
        if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); }
      });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    await page('Page.navigate', {url: `${origin}/`});
    await loaded;
    await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), 'conversation ready');
    await waitFor(() => evaluate(`document.body.dataset.siteTheme === ${JSON.stringify(testCase.theme)}`), `${testCase.theme} theme`);

    const tap = async selector => {
      const box = await waitFor(() => evaluate(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(node => node.getClientRects().length && !node.closest('[inert], [hidden]'));
        const node = nodes[0]; if (!node) return null;
        node.scrollIntoView({block: 'center', inline: 'center'});
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
      })()`), `tap target ${selector}`);
      if (testCase.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x, y: box.y}]});
        await sleep(30);
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: box.x, y: box.y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(30);
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    const nextChooser = async (action, label) => {
      const before = choosers.length;
      await action();
      await waitFor(async () => choosers.length > before, `file chooser: ${label}`, 8000);
      const opened = choosers.at(-1);
      const {object} = await page('DOM.resolveNode', {backendNodeId: opened.backendNodeId});
      const {result} = await page('Runtime.callFunctionOn', {
        objectId: object.objectId, returnByValue: true,
        functionDeclaration: 'function () { return {id: this.id, capture: this.hasAttribute("capture") ? this.getAttribute("capture") : null, accept: this.accept, multiple: this.multiple}; }',
      });
      return {...opened, input: result.value};
    };
    const chooseFile = (opened, file) => page('DOM.setFileInputFiles', {files: [file], backendNodeId: opened.backendNodeId});
    const sentCount = () => evaluate('window.__scamSent.length');
    const uploadsOnNetwork = () => evaluate('window.__scamNetwork.filter(item => item.form || item.blob || /scam-shield/.test(item.url)).length');
    const openScam = async () => {
      await evaluate("window.dispatchEvent(new CustomEvent('lotbi:scam-shield-close-request')), window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')), true");
      await waitFor(() => evaluate("(() => { const d = document.querySelector('[data-scam-dialog]'); return Boolean(d?.open && !document.querySelector('[data-scam-workspace]').hidden && !document.querySelector('[data-scam-methods]').hidden); })()"), 'scam workspace');
    };
    const previewState = () => evaluate(`(() => {
      const preview = document.querySelector('[data-scam-file-preview]');
      const image = document.querySelector('[data-scam-preview-image]');
      return {visible: !preview.hidden, prompt: document.querySelector('[data-scam-preview-prompt]').textContent, imageShown: !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0};
    })()`);
    const layout = () => evaluate(`(() => {
      const page = document.querySelector('[data-scam-dialog]');
      const body = page.querySelector('.scam-page-body');
      const buttons = [...page.querySelectorAll('.scam-upload-actions > button:not([hidden])')];
      const box = node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
      const pageBox = box(page);
      return {
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        bodyOverflow: body.scrollWidth - body.clientWidth,
        pageBox,
        buttons: buttons.map(node => ({text:node.textContent.trim(), ...box(node)})),
        cameraVisible: !page.querySelector('[data-scam-camera-action]').hidden,
      };
    })()`);

    await openScam();
    const initial = await layout();
    check('independent page fits viewport', initial.pageOverflow <= 0 && initial.bodyOverflow <= 0 && initial.pageBox.left >= 0 && initial.pageBox.right <= testCase.width + 0.5, initial);
    check('photo and document actions visible', initial.buttons.some(item => item.text.includes('사진·스크린샷 올리기')) && initial.buttons.some(item => item.text.includes('문서·PDF 올리기')), initial);
    check('camera visibility follows device rule', initial.cameraVisible === testCase.mobile, initial);
    await shot('start');

    const photoChooser = await nextChooser(() => tap('[data-scam-method-select="photo"]'), 'photo button');
    check('photo button opens the photo input', photoChooser.input.id === 'scam-photo', photoChooser);
    check('photo input never forces the camera', photoChooser.input.capture === null, photoChooser);
    check('photo input keeps formats', photoChooser.input.accept === 'image/*' && photoChooser.mode === 'selectSingle', photoChooser);
    await chooseFile(photoChooser, files.screenshot);
    const photoPreview = await waitFor(async () => { const state = await previewState(); return state.visible && state.imageShown ? state : {ok: false, state}; }, 'photo preview');
    check('screenshot previews by name', photoPreview.prompt.includes(path.basename(files.screenshot)), photoPreview);
    check('nothing sent before 확인하기 (photo)', (await sentCount()) === 0 && (await uploadsOnNetwork()) === 0, {});
    await shot('photo-preview');
    const reselect = await nextChooser(() => tap('[data-scam-reselect]'), '다시 고르기');
    check('다시 고르기 reopens the photo input', reselect.input.id === 'scam-photo' && reselect.input.capture === null, reselect);
    await chooseFile(reselect, files.photo);
    await waitFor(async () => { const state = await previewState(); return state.prompt.includes(path.basename(files.photo)) && state.imageShown ? state : {ok: false, state}; }, 'photo re-preview');
    check('still nothing sent after 다시 고르기', (await sentCount()) === 0, {});
    await tap('[data-scam-dialog] .scam-submit');
    await waitFor(async () => (await sentCount()) === 1, 'photo analysis request');
    const photoSent = await evaluate('window.__scamSent[0]');
    const photoFile = photoSent.find(([key]) => key === 'file')?.[1];
    check('확인하기 sends the chosen picture', photoFile?.name === path.basename(files.photo) && photoFile?.type === 'image/jpeg' && photoFile?.size === fs.statSync(files.photo).size, photoSent);
    await waitFor(() => evaluate("!document.querySelector('[data-scam-result]').hidden"), 'photo result');
    await shot('result');

    if (testCase.mobile) {
      await openScam();
      const cameraChooser = await nextChooser(() => tap('[data-scam-method-select="camera"]'), 'camera button');
      check('camera button opens camera input', cameraChooser.input.id === 'scam-camera' && cameraChooser.input.capture === 'environment', cameraChooser);
      await chooseFile(cameraChooser, files.photo);
      await waitFor(async () => (await previewState()).visible, 'camera preview');
      check('nothing sent before 확인하기 (camera)', (await sentCount()) === 1 && (await uploadsOnNetwork()) === 0, {});
      await tap('[data-scam-clicked]');
      await waitFor(() => evaluate("!document.querySelector('[data-scam-incident]').hidden"), 'incident questions');
      await tap('[data-scam-dialog] .scam-submit');
      await waitFor(async () => (await sentCount()) === 2, 'camera analysis request');
      const cameraSent = await evaluate('window.__scamSent.at(-1)');
      check('camera result includes incident context', cameraSent.some(([key]) => key === 'incident_level') && cameraSent.some(([key]) => key === 'device'), cameraSent);
    }

    // ── 10MB limit and format guard, unchanged on the picture path ─────────
    await openScam();
    const big = await nextChooser(() => tap('[data-scam-method-select="photo"]'), 'photo button (10MB)');
    await chooseFile(big, files.tooBig);
    await waitFor(() => evaluate("document.querySelector('[data-scam-status]').textContent === '파일은 10MB 이하만 확인할 수 있어요.'"), '10MB message');
    const sentBeforeBig = await sentCount();
    check('over 10MB is not sent and submit is disabled', sentBeforeBig === (testCase.mobile ? 2 : 1) && await evaluate("document.querySelector('.scam-submit').disabled"), {sentBeforeBig});

    await openScam();
    const documentChooser = await nextChooser(() => tap('[data-scam-method-select="document"]'), 'document input');
    check('document input unchanged', documentChooser.input.id === 'scam-document' && documentChooser.input.capture === null
      && documentChooser.input.accept === '.txt,text/plain,.html,.htm,text/html,application/pdf', documentChooser);
    const sentBeforeDocument = await sentCount();
    await chooseFile(documentChooser, files.document);
    await waitFor(async () => (await previewState()).visible, 'document preview');
    await tap('[data-scam-dialog] .scam-submit');
    await waitFor(async () => (await sentCount()) === sentBeforeDocument + 1, 'document analysis request');
    await waitFor(() => evaluate("!document.querySelector('[data-scam-result]').hidden"), 'document result');
    check('sanitized HTML document reaches analysis only after submit', (await evaluate('window.__scamSent.at(-1)')).some(([key, value]) => key === 'file' && value.name === 'court-esonsong-sanitized.html'), {});

    if (testCase.label === 'mobile-360x800-light') {
      await openScam();
      await evaluate(`(() => { const input = document.querySelector('#scam-text'); input.value = '느린 첫 검사'; input.dispatchEvent(new Event('input', {bubbles:true})); return !document.querySelector('.scam-submit').disabled; })()`);
      const beforeRace = await sentCount();
      await tap('[data-scam-dialog] .scam-submit');
      await waitFor(async () => (await sentCount()) === beforeRace + 1, 'slow text request');
      await evaluate(`(() => { const input = document.querySelector('#scam-text'); input.value = '빠른 두 번째 검사'; input.dispatchEvent(new Event('input', {bubbles:true})); document.querySelector('.scam-submit').click(); return true; })()`);
      await waitFor(async () => (await sentCount()) === beforeRace + 2, 'second text request');
      await waitFor(() => evaluate("!document.querySelector('[data-scam-result]').hidden && document.querySelector('.scam-result-meta').textContent.includes('빠른 두 번째 검사')"), 'latest result visible');
      await sleep(650);
      check('late previous response cannot overwrite the latest result', await evaluate("document.querySelector('.scam-result-meta').textContent.includes('빠른 두 번째 검사')"), {});

      await evaluate(`(() => { const tab = document.querySelector('input[name="scam-input-kind"][value="url"]'); tab.click(); const input = document.querySelector('#scam-url'); input.value = 'https://www.scourt.go.kr/'; input.dispatchEvent(new Event('input', {bubbles:true})); return {oldHidden: document.querySelector('[data-scam-result]').hidden, enabled: !document.querySelector('.scam-submit').disabled}; })()`);
      const switched = await evaluate(`({oldHidden: document.querySelector('[data-scam-result]').hidden, enabled: !document.querySelector('.scam-submit').disabled})`);
      check('changing input hides the old result and enables a valid URL check', switched.oldHidden && switched.enabled, switched);
      await tap('[data-scam-dialog] .scam-submit');
      await waitFor(() => evaluate("!document.querySelector('[data-scam-result]').hidden && document.querySelector('.scam-result-meta').textContent.includes('www.scourt.go.kr')"), 'URL result');
    }
    console.log(`  ${testCase.label}: ${checks.length} checks PASS`);
  } finally {
    cdp.close();
    await sleep(300);
    try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
  }
}

// Solid-color PNGs of any size (portrait, landscape, square) without a library.
function solidPng(width, height, [r, g, b]) {
  const table = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.alloc(1 + width * 3); for (let x = 0; x < width; x += 1) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({length: height}, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-scam-picker-'));
const server = startServer();
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  // A real PNG (screenshot) and JPEG (photo); a file one byte over 10MB.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUiDrBgA0wYRUdtBIABbMBWhzDM6AAAAAASUVORK5CYII=', 'base64');
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDl6KKK+4PBP//Z', 'base64');
  const files = {
    screenshot: path.join(workDir, 'Screenshot 2026-10-08 at 09.12.33.png'),
    photo: path.join(workDir, 'IMG_0001.jpg'),
    tooBig: path.join(workDir, 'IMG_0002.png'),
    document: path.join(workDir, 'court-esonsong-sanitized.html'),
  };
  fs.writeFileSync(files.screenshot, png);
  fs.writeFileSync(files.photo, jpeg);
  fs.writeFileSync(files.tooBig, Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 + 1 - png.length)]));
  fs.writeFileSync(files.document, '<!doctype html><title>법원 안내처럼 보이는 최소 재현본</title><script src="https://mega.ibsgame.example/static/app.js"></script><form><input name="case-number"><input name="phone"></form>');
  files.layout = [
    {kind: 'portrait', file: path.join(workDir, 'KakaoTalk_Photo_2026-10-08-09-12-33-001_0123456789abcdef0123456789abcdef.png'), size: [900, 1950], color: [210, 70, 60]},
    {kind: 'landscape', file: path.join(workDir, 'https___lotbi-example.test_files_download_very_long_path_segment_without_any_break_0123456789abcdef.png'), size: [1600, 720], color: [40, 140, 90]},
    {kind: 'square', file: path.join(workDir, 'IMG_0005.png'), size: [1080, 1080], color: [60, 90, 200]},
  ];
  for (const sample of files.layout) fs.writeFileSync(sample.file, solidPng(...sample.size, sample.color));
  for (const testCase of CASES) await runCase(browser, origin, workDir, files, testCase);
} finally {
  server.kill('SIGTERM');
  try { fs.rmSync(workDir, {recursive: true, force: true}); } catch {}
}
console.log('SCAM-SHIELD-PHOTO-LIBRARY-PICKER-01 PASS — real Chrome taps, chooser intercepted; viewport/UA emulation, not an iPhone/KakaoTalk/Android device run');
