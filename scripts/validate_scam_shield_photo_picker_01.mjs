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
    sent.push([...event.detail.formData.entries()].map(([key, value]) => (typeof value === 'string' ? [key, value] : [key, {name: value.name, type: value.type, size: value.size}])));
    event.detail.resolve({riskLevel: 'UNVERIFIED', headline: '확인 필요', doNow: ['공식 번호로 다시 확인하세요.'], doNot: ['주소를 열지 마세요.'], reasons: ['검증용 응답'], confirmedFacts: [], unverifiedItems: ['발신 기관'], incidentTriage: null, evidence: []});
  });
})();`;

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KAKAOTALK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: 'iPhone-Safari-375x812-light', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, theme: 'light'},
  {label: 'iPhone-KakaoTalk-390x844-light', width: 390, height: 844, mobile: true, userAgent: KAKAOTALK_UA, theme: 'light'},
  {label: 'iPhone-KakaoTalk-390x844-dark', width: 390, height: 844, mobile: true, userAgent: KAKAOTALK_UA, theme: 'dark'},
  {label: 'Android-412x915-dark', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, theme: 'dark'},
  {label: 'desktop-1280x900-light', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: 'light'},
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
    const panelState = kind => evaluate(`(() => {
      const panel = document.querySelector('[data-scam-input-panel="${kind}"]');
      const input = panel.querySelector('input[type=file]');
      const pick = panel.querySelector('.scam-file-pick');
      const dialog = document.querySelector('[data-scam-dialog]');
      const inner = dialog.querySelector('.scam-dialog-inner');
      const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, width: r.width, height: r.height}; };
      const pickRect = rect(pick);
      const hit = pickRect ? document.elementFromPoint(pickRect.left + pickRect.width / 2, pickRect.top + pickRect.height / 2) : null;
      return {
        visible: !panel.hidden && Boolean(panel.getClientRects().length),
        pickText: pick ? pick.textContent.trim() : '',
        pickFor: pick ? pick.htmlFor : '',
        pickRect, pickHit: Boolean(pick && hit && (hit === pick || pick.contains(hit))),
        inputRect: rect(input), inputOpacity: getComputedStyle(input).opacity, inputDisabled: input.disabled,
        focused: document.activeElement === input,
        dialogRect: rect(dialog),
        innerOverflow: inner.scrollWidth - inner.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        submit: dialog.querySelector('.scam-submit').textContent.trim(),
      };
    })()`);
    const previewState = () => evaluate(`(() => {
      const preview = document.querySelector('[data-scam-file-preview]');
      const image = document.querySelector('[data-scam-preview-image]');
      return {visible: !preview.hidden, prompt: document.querySelector('[data-scam-preview-prompt]').textContent, imageShown: !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0};
    })()`);

    // ── Method order: 사진·스크린샷 선택 first ──────────────────────────────
    await openScam();
    const methods = await evaluate(`[...document.querySelectorAll('[data-scam-methods] label')].map(label => {
      const r = label.getBoundingClientRect();
      return {value: label.querySelector('input').value, title: label.querySelector('strong').textContent.trim(), top: Math.round(r.top), left: Math.round(r.left)};
    })`);
    check('photo method first', methods[0]?.value === 'photo' && methods[0]?.title === '사진·스크린샷 선택', methods);
    check('camera method second', methods[1]?.value === 'camera' && methods[1]?.title === '카메라로 촬영', methods);
    const [first, second] = methods;
    check('photo card reads before camera card', first.top < second.top || (first.top === second.top && first.left < second.left), methods);
    await shot('methods');

    // ── Path 1: 사진·스크린샷 선택 ───────────────────────────────────────────
    await tap('[data-scam-methods] label:has(input[value="photo"])');
    const photo = await waitFor(async () => { const state = await panelState('photo'); return state.visible ? state : {ok: false, state}; }, 'photo panel');
    check('photo button is named', photo.pickText === '사진·스크린샷 선택' && photo.pickFor === 'scam-photo', photo);
    check('photo button is tappable', photo.pickHit && photo.pickRect.height >= 44, photo);
    check('photo native control visually hidden, enabled', photo.inputRect.width <= 1 && photo.inputOpacity === '0' && !photo.inputDisabled, photo);
    check('photo panel fits', photo.innerOverflow <= 0 && photo.pageOverflow <= 0 && photo.pickRect.left >= photo.dialogRect.left && photo.pickRect.right <= photo.dialogRect.right, photo);
    check('photo submit label', photo.submit === '이 사진 확인하기', photo);
    await shot('photo-panel');
    const photoChooser = await nextChooser(() => tap('[data-scam-file-pick="photo"]'), 'photo button');
    check('photo button opens the photo input', photoChooser.input.id === 'scam-photo', photoChooser);
    check('photo input never forces the camera', photoChooser.input.capture === null, photoChooser);
    check('photo input keeps formats', photoChooser.input.accept === 'image/jpeg,image/png,image/webp' && photoChooser.mode === 'selectSingle', photoChooser);
    await chooseFile(photoChooser, files.screenshot);
    const photoPreview = await waitFor(async () => { const state = await previewState(); return state.visible && state.imageShown ? state : {ok: false, state}; }, 'photo preview');
    check('screenshot previews by name', photoPreview.prompt.includes(path.basename(files.screenshot)), photoPreview);
    check('nothing sent before 확인하기 (photo)', (await sentCount()) === 0 && (await uploadsOnNetwork()) === 0, {});
    await shot('photo-preview');
    // 다시 고르기 reopens the same, capture-free input.
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

    // ── Path 2: 카메라로 촬영 ────────────────────────────────────────────────
    await openScam();
    await tap('[data-scam-methods] label:has(input[value="camera"])');
    const camera = await waitFor(async () => { const state = await panelState('camera'); return state.visible ? state : {ok: false, state}; }, 'camera panel');
    check('camera button is named', camera.pickText === '카메라로 촬영' && camera.pickFor === 'scam-camera', camera);
    check('camera button is tappable', camera.pickHit && camera.pickRect.height >= 44, camera);
    check('camera native control visually hidden, enabled', camera.inputRect.width <= 1 && camera.inputOpacity === '0' && !camera.inputDisabled, camera);
    check('camera panel fits', camera.innerOverflow <= 0 && camera.pageOverflow <= 0, camera);
    await shot('camera-panel');
    const cameraChooser = await nextChooser(() => tap('[data-scam-file-pick="camera"]'), 'camera button');
    check('camera button opens the camera input', cameraChooser.input.id === 'scam-camera', cameraChooser);
    check('only the camera input asks for the camera', cameraChooser.input.capture === 'environment', cameraChooser);
    check('camera input keeps formats', cameraChooser.input.accept === 'image/jpeg,image/png,image/webp', cameraChooser);
    await chooseFile(cameraChooser, files.photo);
    await waitFor(async () => { const state = await previewState(); return state.visible && state.imageShown ? state : {ok: false, state}; }, 'camera preview');
    check('nothing sent before 확인하기 (camera)', (await sentCount()) === 1 && (await uploadsOnNetwork()) === 0, {});
    // 이미 눌렀어요 answers ride along unchanged.
    await tap('[data-scam-clicked]');
    await waitFor(() => evaluate("!document.querySelector('[data-scam-incident]').hidden"), 'incident questions');
    await tap('[data-scam-dialog] .scam-submit');
    await waitFor(async () => (await sentCount()) === 2, 'camera analysis request');
    const cameraSent = await evaluate('window.__scamSent[1]');
    check('camera picture sent with incident answers', cameraSent.find(([key]) => key === 'file')?.[1]?.name === path.basename(files.photo)
      && cameraSent.some(([key]) => key === 'incident_level') && cameraSent.some(([key]) => key === 'device'), cameraSent);

    // ── 10MB limit and format guard, unchanged on the picture path ─────────
    await openScam();
    await tap('[data-scam-methods] label:has(input[value="photo"])');
    await waitFor(async () => (await panelState('photo')).visible, 'photo panel again');
    const big = await nextChooser(() => tap('[data-scam-file-pick="photo"]'), 'photo button (10MB)');
    await chooseFile(big, files.tooBig);
    await waitFor(async () => (await previewState()).visible, 'big file preview');
    await tap('[data-scam-dialog] .scam-submit');
    await waitFor(() => evaluate("document.querySelector('[data-scam-status]').textContent === '파일은 10MB 이하만 확인할 수 있어요.'"), '10MB message');
    check('over 10MB is not sent', (await sentCount()) === 2, {});

    // ── Preview layout: whole picture, centered, long names wrapped ────────
    // KakaoTalk saves pictures under long names (and URL-like ones); a name
    // with no break point used to widen the step past the dialog, whose body
    // clips horizontally, so the picture slid right and the buttons were cut.
    const layoutState = () => evaluate(`(() => {
      const dialog = document.querySelector('[data-scam-dialog]');
      const inner = dialog.querySelector('.scam-dialog-inner');
      const preview = dialog.querySelector('[data-scam-file-preview]');
      const image = dialog.querySelector('[data-scam-preview-image]');
      const prompt = dialog.querySelector('[data-scam-preview-prompt]');
      const buttons = [dialog.querySelector('[data-scam-reselect]'), dialog.querySelector('.scam-submit'), dialog.querySelector('[data-scam-method-back]'), dialog.querySelector('[data-scam-file-pick="photo"]')];
      const box = node => { const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
      const innerBox = box(inner);
      const previewBox = box(preview);
      const imageBox = box(image);
      const style = getComputedStyle(preview);
      const contentLeft = previewBox.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      const contentRight = previewBox.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      const lineHeight = parseFloat(getComputedStyle(prompt).lineHeight);
      const grid = [];
      const d = box(dialog);
      for (let i = 1; i <= 5; i += 1) for (let j = 1; j <= 5; j += 1) {
        const x = d.left + (d.width * i) / 6, y = Math.max(d.top, 0) + ((Math.min(d.bottom, innerHeight) - Math.max(d.top, 0)) * j) / 6;
        const hit = document.elementFromPoint(x, y);
        grid.push(Boolean(hit && dialog.contains(hit)));
      }
      return {
        innerOverflow: inner.scrollWidth - inner.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        dialogInViewport: d.left >= 0 && d.right <= innerWidth + 0.5,
        previewInside: previewBox.left >= innerBox.left - 0.5 && previewBox.right <= innerBox.right + 0.5,
        imageInside: imageBox.left >= contentLeft - 0.5 && imageBox.right <= contentRight + 0.5,
        imageCenterOffset: Math.abs((imageBox.left - contentLeft) - (contentRight - imageBox.right)),
        imageRatio: imageBox.width / imageBox.height,
        naturalRatio: image.naturalWidth / image.naturalHeight,
        imageHeight: imageBox.height,
        objectFit: getComputedStyle(image).objectFit,
        promptLines: Math.round(box(prompt).height / lineHeight),
        promptInside: box(prompt).right <= contentRight + 0.5,
        buttons: buttons.map(node => { const r = box(node); return {text: node.textContent.trim(), inside: r.left >= innerBox.left - 0.5 && r.right <= innerBox.right + 0.5, clipped: node.scrollWidth > node.clientWidth + 1}; }),
        covered: grid.filter(ok => !ok).length,
        innerScrollable: getComputedStyle(inner).overflowY,
      };
    })()`);
    for (const sample of files.layout) {
      await openScam();
      await tap('[data-scam-methods] label:has(input[value="photo"])');
      await waitFor(async () => (await panelState('photo')).visible, `photo panel (${sample.kind})`);
      const opened = await nextChooser(() => tap('[data-scam-file-pick="photo"]'), `photo button (${sample.kind})`);
      await chooseFile(opened, sample.file);
      await waitFor(async () => { const state = await previewState(); return state.visible && state.imageShown ? state : {ok: false, state}; }, `${sample.kind} preview`);
      await sleep(60);
      const layout = await layoutState();
      const where = `${sample.kind} ${path.basename(sample.file).slice(0, 24)}…`;
      await shot(`preview-${sample.kind}`);
      check(`${where}: no horizontal scroll`, layout.innerOverflow <= 0 && layout.pageOverflow <= 0 && layout.dialogInViewport, layout);
      check(`${where}: preview inside the dialog`, layout.previewInside && layout.promptInside, layout);
      check(`${where}: whole picture inside the preview`, layout.imageInside && layout.objectFit === 'contain', layout);
      check(`${where}: picture keeps its aspect ratio`, Math.abs(layout.imageRatio / layout.naturalRatio - 1) <= 0.02, layout);
      check(`${where}: picture centered`, layout.imageCenterOffset <= 1, layout);
      check(`${where}: picture height bounded`, layout.imageHeight <= 300.5, layout);
      check(`${where}: long name shortened to ≤3 lines`, layout.promptLines <= 3, layout);
      check(`${where}: buttons whole`, layout.buttons.every(item => item.inside && !item.clipped), layout.buttons);
      check(`${where}: nothing floats over the dialog`, layout.covered === 0, layout);
      check(`${where}: body still scrolls vertically`, layout.innerScrollable === 'auto', layout);
      // 다시 고르기 → the same long name again → 확인하기: the original file and
      // its full name go to the analysis unchanged.
      const again = await nextChooser(() => tap('[data-scam-reselect]'), `다시 고르기 (${sample.kind})`);
      check(`${where}: 다시 고르기 reopens the photo input`, again.input.id === 'scam-photo' && again.input.capture === null, again);
      await chooseFile(again, sample.file);
      await waitFor(async () => (await previewState()).imageShown, `${sample.kind} re-preview`);
      const before = await sentCount();
      await tap('[data-scam-dialog] .scam-submit');
      await waitFor(async () => (await sentCount()) === before + 1, `${sample.kind} analysis request`);
      const sentFile = (await evaluate('window.__scamSent.at(-1)')).find(([key]) => key === 'file')?.[1];
      check(`${where}: original file and name sent`, sentFile?.name === path.basename(sample.file) && sentFile?.size === fs.statSync(sample.file).size && sentFile?.type === 'image/png', sentFile);
    }

    // ── Out of scope, unchanged: 문서·PDF keeps its native control ─────────
    await openScam();
    await tap('[data-scam-methods] label:has(input[value="document"])');
    await waitFor(() => evaluate("!document.querySelector('[data-scam-input-panel=\"document\"]').hidden"), 'document panel');
    const documentChooser = await nextChooser(() => tap('#scam-document'), 'document input');
    check('document input unchanged', documentChooser.input.id === 'scam-document' && documentChooser.input.capture === null
      && documentChooser.input.accept === '.txt,text/plain,.html,.htm,text/html,application/pdf', documentChooser);

    // ── Keyboard (desktop): the focused hidden input opens with Space ──────
    if (!testCase.mobile) {
      await openScam();
      await tap('[data-scam-methods] label:has(input[value="photo"])');
      await waitFor(async () => (await panelState('photo')).focused, 'photo input focused after choosing the method');
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16});
      const ring = await evaluate("getComputedStyle(document.querySelector('[data-scam-file-pick=\"photo\"]')).outlineStyle");
      check('keyboard focus shows on the named button', ring === 'solid', {ring});
      const keyed = await nextChooser(async () => {
        await page('Input.dispatchKeyEvent', {type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' '});
        await page('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32});
      }, 'Space on the photo input');
      check('Space opens the photo input', keyed.input.id === 'scam-photo' && keyed.input.capture === null, keyed);
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
  };
  fs.writeFileSync(files.screenshot, png);
  fs.writeFileSync(files.photo, jpeg);
  fs.writeFileSync(files.tooBig, Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 + 1 - png.length)]));
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
