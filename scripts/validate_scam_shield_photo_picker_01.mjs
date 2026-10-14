// SCAM-SHIELD-PHOTO-LIBRARY-PICKER-01 (SCAM-PHISHING-REDESIGN-02) — 사기·피싱 확인
// picture and file paths in a real browser, on the workspace page (#scam).
//
// iPhone (Safari and the KakaoTalk in-app browser) opens the camera straight
// away for an <input capture> and draws every file control as "파일 선택". On
// the page's 사진·파일 tab the first method is 사진·스크린샷 고르기 (image/*, no
// capture: photo library, screenshots, Android gallery, desktop files);
// 카메라로 찍기 is its own method and the only input with capture="environment"
// (shown on a phone, or on a desktop that has a camera); 문서·PDF 고르기 keeps
// the document types.
//
// Real Chrome through the DevTools protocol, file chooser intercepted: a real
// tap/click on each pick button must open the chooser for that path's own
// input; a chosen JPEG/PNG/WEBP shows name·type·size and an object-URL preview
// without any request; a chosen HTML/PDF/TXT shows name·type·size only and is
// never read, rendered, injected as markup or navigated to (the HTML carries a
// <script>, an <img onerror> and an <iframe srcdoc> that must not run); only
// 의심 신호 확인하기 hands the file to the analysis request (answered here, so
// nothing leaves the browser). Also: the 10MB limit with the real size, an
// unsupported type, 다시 고르기, the incident fields on a phone, a late response
// that must not overwrite the newer result, and the 인터넷 주소 tab.
// 360×800 iPhone Safari UA / Android UA, 390×844 KakaoTalk UA, 412×915 Android
// UA (touch) and 1280×900 desktop, light and dark. Viewport/UA emulation only —
// not an iPhone Safari / KakaoTalk / Android device run, and Chrome ignores
// capture on desktop. The camera rule's device list is answered here (no
// camera unless a step adds one), so the result does not depend on the machine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {browserPath, makeWorkDir, removeDir, startServer, openPage, BASE_MOCK, OPEN_PAGE, INPUT_READY, freshInput, THEMES, waitTheme, waitFor, sleep} from './scam_shield_page_harness.mjs';

const SHOTS = process.env.SCAM_PICKER_SHOTS || '';
const WS = '.consumer-workspace[data-workspace="scam"]';
const DOC_NOTE = '문서·HTML은 열거나 미리 보지 않고 이름·형식·크기만 보여 줘요.';
const UNSUPPORTED = '현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요.';
// 10MB + 1 byte: the size is rounded up, so it never reads as the limit itself.
const TOO_BIG = '파일은 10MB 이하만 확인할 수 있어요. 지금 고른 파일은 10.1MB예요.';
const URL_WARNING = 'http:// 또는 https://로 시작하는 전체 주소를 넣어 주세요.';
const ASK_PHOTO = '선택한 사진을 LOTBI가 확인할까요?';
const ASK_DOCUMENT = '선택한 문서를 LOTBI가 확인할까요?';
const INPUTS = {
  photo: {accept: 'image/*', capture: null, multiple: false},
  camera: {accept: 'image/jpeg,image/png,image/webp', capture: 'environment', multiple: false},
  document: {accept: '.txt,text/plain,.html,.htm,text/html,application/pdf', capture: null, multiple: false},
};
// Text that only exists inside the chosen documents: it must never reach the page.
const DOC_MARKERS = ['법원 안내처럼 보이는 최소 재현본', '등기 반송 확인 바랍니다', 'PDF 안쪽 글자'];

// Installed before any page script: Account/Core answered offline, the page's
// session question answered "signed in", the camera device list answered, every
// object URL and file read recorded, and the analysis request recorded and
// answered here so no picture or file leaves the browser.
const MOCK = `(() => {${BASE_MOCK}
  try { if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = async () => (window.__videoInputs ? [{kind: 'videoinput', deviceId: 'validator', groupId: 'validator', label: ''}] : []); } catch {}
  const nativeCreate = URL.createObjectURL.bind(URL);
  window.__objectUrls = [];
  URL.createObjectURL = object => { const url = nativeCreate(object); window.__objectUrls.push({name: (object && object.name) || '', type: (object && object.type) || '', url}); return url; };
  window.__fileReads = [];
  const record = (proto, names) => {
    for (const name of names) {
      const native = proto[name];
      if (typeof native !== 'function') continue;
      proto[name] = function (...args) {
        const target = args[0] instanceof Blob ? args[0] : this;
        if (target instanceof File) window.__fileReads.push({how: name, name: target.name});
        return native.apply(this, args);
      };
    }
  };
  record(Blob.prototype, ['text', 'arrayBuffer', 'stream', 'bytes']);
  record(FileReader.prototype, ['readAsText', 'readAsDataURL', 'readAsArrayBuffer', 'readAsBinaryString']);
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  const sent = window.__scamSent = [];
  window.__scamResolved = [];
  window.addEventListener('lotbi:scam-shield-request', event => {
    event.stopImmediatePropagation();
    const form = event.detail.formData;
    const entries = [...form.entries()];
    sent.push(entries.map(([key, value]) => (typeof value === 'string' ? [key, value] : [key, {name: value.name, type: value.type, size: value.size, file: value instanceof File}])));
    const text = String(form.get('text') || '');
    const slow = text.includes('느린 첫 검사');
    const fast = text.includes('빠른 두 번째 검사');
    const marker = text || String(form.get('url') || '') || (form.get('file') && form.get('file').name) || 'request';
    const level = Number(form.get('incident_level') || 0);
    const response = {
      riskLevel: fast ? 'CURRENTLY_NO_RISK_SIGNAL' : 'HIGH_RISK',
      headline: '이건 열지 마세요',
      summary: '응답 표식: ' + marker,
      doNow: ['공식 홈페이지에서 대표번호를 직접 찾아 다시 확인하세요.'],
      doNot: ['첨부파일과 외부 주소를 열지 마세요.'],
      reasons: ['공식 기관을 흉내 낸 화면에서 외부 코드 연결과 개인정보 입력 요구가 함께 발견됐어요.'],
      confirmedFacts: ['문서 안에 외부 스크립트 연결이 있어요.'],
      unverifiedItems: ['발신 기관과 사건번호는 확인되지 않았어요.'],
      incidentTriage: level ? {level, device: String(form.get('device') || ''), actions: ['의심 메시지와 파일을 다시 열지 마세요.', '다른 안전한 기기에서 비밀번호를 바꾸세요.']} : null,
      evidence: [{signal: 'external_script', title: '외부 코드 연결', technicalDetail: 'mega.ibsgame.example'}],
      officialSources: [], doubleCheck: null, policeStatistics: null,
    };
    const answer = () => { event.detail.resolve(response); window.__scamResolved.push(marker); };
    const delay = slow ? 1500 : (fast ? 30 : 0);
    if (delay) setTimeout(answer, delay); else answer();
  });
})();`;

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KAKAOTALK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const [LIGHT, DARK] = THEMES;
const CASES = [
  {label: 'mobile-360x800-light', width: 360, height: 800, mobile: true, userAgent: IPHONE_UA, theme: LIGHT, device: 'iPhone', race: true},
  {label: 'mobile-360x800-dark', width: 360, height: 800, mobile: true, userAgent: ANDROID_UA, theme: DARK, device: 'Galaxy'},
  {label: 'iPhone-KakaoTalk-390x844-light', width: 390, height: 844, mobile: true, userAgent: KAKAOTALK_UA, theme: LIGHT, device: 'iPhone'},
  {label: 'Android-412x915-dark', width: 412, height: 915, mobile: true, userAgent: ANDROID_UA, theme: DARK, device: 'Galaxy'},
  {label: 'desktop-1280x900-light', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: LIGHT, race: true},
  {label: 'desktop-1280x900-dark', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, theme: DARK},
];

// The page's own size wording (formatBytes in site-scam-shield.js).
const sizeLabel = bytes => (bytes >= 1024 * 1024 ? `${(Math.ceil((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);
const sizeOf = file => fs.statSync(file).size;

const CARD = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  const shown = node => Boolean(node && node.getClientRects().length && !node.closest('[hidden]'));
  const card = ws?.querySelector('[data-scam-file-card]');
  const img = card?.querySelector('[data-scam-preview]');
  const note = ws?.querySelector('[data-scam-doc-note]');
  const message = ws?.querySelector('[data-scam-field-message]');
  const submit = ws?.querySelector('[data-scam-submit]');
  const hint = ws?.querySelector('[data-scam-submit-hint]');
  return {
    phase: ws?.querySelector('.scam-page')?.dataset.scamPhase || '',
    card: Boolean(card), warn: Boolean(card?.classList.contains('is-warn')),
    name: card?.querySelector('[data-scam-file-name]')?.textContent || '',
    meta: card?.querySelector('.sp-fmeta')?.textContent || '',
    reselect: card?.querySelector('[data-scam-reselect]')?.textContent.trim() || '',
    preview: img ? {blob: img.src.startsWith('blob:'), loaded: img.complete && img.naturalWidth > 0, shown: shown(img), alt: img.alt} : null,
    docNote: shown(note) ? note.textContent.trim() : '',
    ask: ws?.querySelector('.sp-ask')?.textContent.trim() || '',
    message: shown(message) ? message.textContent.trim() : '',
    status: ws?.querySelector('[data-scam-status]')?.textContent || '',
    submit: Boolean(submit), submitDisabled: Boolean(submit?.disabled),
    hint: shown(hint) ? hint.textContent.trim() : '',
  };
})()`;

const LAYOUT = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  const page = ws.querySelector('.scam-page');
  const visible = selector => { const node = ws.querySelector(selector); return Boolean(node && node.getClientRects().length && getComputedStyle(node).display !== 'none' && !node.closest('[hidden]')); };
  const text = selector => ws.querySelector(selector)?.textContent.trim() || '';
  const card = ws.querySelector('[data-scam-file-card]');
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, width: r.width, height: r.height}; };
  return {
    docOverflow: document.documentElement.scrollWidth - innerWidth,
    wsOverflow: ws.scrollWidth - ws.clientWidth,
    page: box(page), ws: box(ws), innerWidth,
    photo: visible('[data-scam-pick="photo"]'), photoText: text('[data-scam-pick="photo"]'),
    document: visible('[data-scam-pick="document"]'), documentText: text('[data-scam-pick="document"]'),
    camera: visible('[data-scam-pick="camera"]'), cameraText: text('[data-scam-pick="camera"]'),
    card: box(card), name: box(card?.querySelector('[data-scam-file-name]')), thumb: box(card?.querySelector('[data-scam-preview]')),
  };
})()`;

const SAFETY = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  return {
    pwned: window.__scamPwned ?? null,
    frames: document.querySelectorAll('iframe, embed, object, frame').length,
    framesInPage: ws ? ws.querySelectorAll('iframe, embed, object, frame').length : -1,
    injected: document.querySelectorAll('[name="case-number"], script[src*="ibsgame"], img[src="x"], [onerror]').length,
    blobImages: ws ? [...ws.querySelectorAll('img')].filter(img => img.src.startsWith('blob:')).length : 0,
    objectUrls: window.__objectUrls.map(item => item.name),
    reads: window.__fileReads,
    href: location.href,
    text: ws ? ws.textContent : '',
  };
})()`;

const FOLLOW = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  const shown = node => Boolean(node.getClientRects().length && !node.closest('[hidden]'));
  const devices = [...ws.querySelectorAll('[data-scam-step2] [data-scam-device]')];
  const stages = [...ws.querySelectorAll('[data-scam-step2] [data-scam-stage]')];
  if (!devices.length) return {ok: false};
  return {
    devices: devices.map(node => node.dataset.scamDevice), devicesShown: devices.every(shown),
    stages: stages.map(node => node.dataset.scamStage), stagesShown: stages.every(shown),
    checked: [...ws.querySelectorAll('[data-scam-step2] [aria-checked="true"]')].map(node => node.dataset.scamIncident || node.dataset.scamDevice || node.dataset.scamStage),
  };
})()`;

const RESULT = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  const result = ws?.querySelector('[data-scam-result]');
  return {
    pages: document.querySelectorAll(${JSON.stringify(WS)}).length,
    results: document.querySelectorAll('[data-scam-result]').length,
    phase: ws?.querySelector('.scam-page')?.dataset.scamPhase || '',
    level: result?.dataset.riskLevel || '',
    summary: result?.querySelector('[data-scam-summary]')?.textContent || '',
    incidentCard: Boolean(result?.querySelector('[data-scam-incident-card]')),
  };
})()`;

async function runCase(browser, origin, workDir, files, testCase) {
  const p = await openPage({browser, origin, workDir, viewport: testCase, theme: testCase.theme, mock: MOCK, interceptFiles: true});
  const checks = [];
  const check = (label, condition, detail) => {
    checks.push(label);
    assert.ok(condition, `${testCase.label}: ${label} — ${JSON.stringify(detail)}`);
  };
  const seen = {choosers: [], requests: [], navigations: [], windowOpens: []};
  const stopListening = p.cdp.on(message => {
    if (message.sessionId !== p.sessionId) return;
    if (message.method === 'Page.fileChooserOpened') seen.choosers.push(message.params);
    if (message.method === 'Network.requestWillBeSent') seen.requests.push(message.params.request.url);
    if (message.method === 'Page.frameNavigated') seen.navigations.push(message.params.frame.url);
    if (message.method === 'Page.windowOpen') seen.windowOpens.push(message.params.url);
  });
  try {
    await waitTheme(p.evaluate, testCase.theme.dark, testCase.theme.label);
    const shot = async name => { if (SHOTS) await p.screenshot(path.join(SHOTS, `${testCase.label}-${name}.png`)); };
    const nextChooser = async (selector, label) => {
      const before = seen.choosers.length;
      await p.tap(selector);
      await waitFor(async () => seen.choosers.length > before, `file chooser: ${label}`, 8000);
      const opened = seen.choosers.at(-1);
      const {object} = await p.page('DOM.resolveNode', {backendNodeId: opened.backendNodeId});
      const {result} = await p.page('Runtime.callFunctionOn', {
        objectId: object.objectId, returnByValue: true,
        functionDeclaration: `function () { return {kind: this.dataset.scamFile || '', type: this.type, capture: this.hasAttribute('capture') ? this.getAttribute('capture') : null, accept: this.getAttribute('accept'), multiple: this.multiple, inPage: Boolean(this.closest(${JSON.stringify(WS)}))}; }`,
      });
      return {mode: opened.mode, input: result.value};
    };
    const chooseFile = async (selector, label, file) => {
      const opened = await nextChooser(selector, label);
      const before = seen.choosers.at(-1);
      await p.page('DOM.setFileInputFiles', {files: [file], backendNodeId: before.backendNodeId});
      return opened;
    };
    const waitCard = (condition, label) => waitFor(async () => { const state = await p.evaluate(CARD); return condition(state) ? state : {ok: false, state}; }, label);
    const sentCount = () => p.evaluate('window.__scamSent.length');
    const lastSent = async () => Object.fromEntries(await p.evaluate('window.__scamSent.at(-1)'));
    const lastKeys = async () => (await p.evaluate('window.__scamSent.at(-1)')).map(([key]) => key).sort();
    const uploadsOnNetwork = () => p.evaluate('window.__scamNetwork.filter(item => item.form || item.blob || /scam-shield/.test(item.url)).length');
    const phase = () => p.evaluate(`document.querySelector(${JSON.stringify(WS)} + ' .scam-page')?.dataset.scamPhase || ''`);
    const typeInto = async (selector, text) => {
      await p.tap(selector);
      await p.evaluate(`(() => { const node = document.querySelector(${JSON.stringify(`${WS} ${selector}`)}); node.focus(); node.select(); return true; })()`);
      await p.page('Input.insertText', {text});
      await waitFor(() => p.evaluate(`document.querySelector(${JSON.stringify(`${WS} ${selector}`)})?.value === ${JSON.stringify(text)}`), `typed into ${selector}`);
    };
    const waitResult = (condition, label) => waitFor(async () => { const state = await p.evaluate(RESULT); return state.phase === 'result' && condition(state) ? state : {ok: false, state}; }, label);
    const fileTab = async () => {
      await p.tap('[data-scam-tab="file"]');
      await waitFor(() => p.evaluate(`Boolean(document.querySelector(${JSON.stringify(`${WS} [data-scam-panel="file"]`)}))`), 'file tab');
    };
    const tapDisabledSubmit = async () => {
      // A real tap on the switched-off button: nothing may be sent.
      await p.tap('[data-scam-submit]');
      await sleep(250);
    };

    // ── open the page: its own route, the three pick buttons ───────────────
    await p.evaluate(OPEN_PAGE);
    await waitFor(() => p.evaluate(INPUT_READY), 'scam page input');
    check('opens as the #scam workspace page, not a dialog', await p.evaluate(`location.hash === '#scam' && document.querySelectorAll(${JSON.stringify(WS)}).length === 1 && !document.querySelector('dialog.scam-dialog, [data-scam-dialog]')`), {});
    await fileTab();
    if (!testCase.mobile) {
      await sleep(300);   // the camera rule's device question settles
      const noCamera = await p.evaluate(LAYOUT);
      check('desktop without a camera: 카메라로 찍기 hidden', !noCamera.camera, noCamera);
      // The same desktop with a camera shows it: the rule runs, it is not a fixed hide.
      await p.evaluate('window.__videoInputs = true');
      await p.tap('[data-scam-tab="text"]');
      await fileTab();
      const withCamera = await waitFor(async () => { const state = await p.evaluate(LAYOUT); return state.camera ? state : {ok: false, state}; }, 'camera shown with a videoinput');
      check('desktop with a camera: 카메라로 찍기 shown', withCamera.cameraText.includes('카메라로 찍기'), withCamera);
      await p.evaluate('window.__videoInputs = false');
      await p.tap('[data-scam-tab="text"]');
      await fileTab();
      await sleep(300);
    }
    const initial = await p.evaluate(LAYOUT);
    check('independent page fits viewport', initial.docOverflow <= 0 && initial.wsOverflow <= 0 && initial.page.left >= -0.5 && initial.page.right <= testCase.width + 0.5, initial);
    check('photo and document actions visible', initial.photo && initial.photoText.includes('사진·스크린샷 고르기') && initial.document && initial.documentText.includes('문서·PDF 고르기'), initial);
    check('camera visibility follows device rule', initial.camera === testCase.mobile && (!testCase.mobile || initial.cameraText.includes('카메라로 찍기')), initial);
    const inputs = await p.evaluate(`Object.fromEntries([...document.querySelectorAll(${JSON.stringify(`${WS} input[type="file"]`)})].map(node => [node.dataset.scamFile, {accept: node.getAttribute('accept'), capture: node.hasAttribute('capture') ? node.getAttribute('capture') : null, multiple: node.multiple}]))`);
    check('three file inputs, each with its own formats', isDeepStrictEqual(inputs, INPUTS), inputs);
    await shot('start');

    // ── 사진·스크린샷: PNG → long-name pictures → WEBP → JPEG, then 확인 ──────
    const photoChooser = await chooseFile('[data-scam-pick="photo"]', 'photo button', files.screenshot);
    check('photo button opens the photo input', photoChooser.input.kind === 'photo' && photoChooser.input.type === 'file' && photoChooser.input.inPage, photoChooser);
    check('photo input never forces the camera', photoChooser.input.capture === null, photoChooser);
    check('photo input keeps formats', photoChooser.input.accept === 'image/*' && photoChooser.mode === 'selectSingle' && !photoChooser.input.multiple, photoChooser);
    const screenshot = await waitCard(state => state.name === path.basename(files.screenshot) && state.preview?.loaded, 'photo preview');
    check('screenshot shows name, type and size', screenshot.meta === `PNG 사진 · ${sizeLabel(sizeOf(files.screenshot))}`, screenshot);
    check('screenshot previews from an object URL', screenshot.preview.blob && screenshot.preview.shown && screenshot.ask === ASK_PHOTO && !screenshot.docNote && !screenshot.warn, screenshot);
    check('the preview is the chosen picture', (await p.evaluate('window.__objectUrls.at(-1)?.name')) === path.basename(files.screenshot), {});
    check('nothing sent before 의심 신호 확인하기 (photo)', (await sentCount()) === 0 && (await uploadsOnNetwork()) === 0 && !screenshot.submitDisabled && !screenshot.hint, screenshot);
    await shot('photo-preview');
    for (const sample of files.layout) {
      const chooser = await chooseFile('[data-scam-reselect]', `다시 고르기 (${sample.kind})`, sample.file);
      check(`다시 고르기 reopens the photo input (${sample.kind})`, chooser.input.kind === 'photo' && chooser.input.capture === null, chooser);
      await waitCard(state => state.name === path.basename(sample.file) && state.preview?.loaded, `${sample.kind} preview`);
      const fit = await p.evaluate(LAYOUT);
      check(`${sample.kind} picture with a long file name fits`, fit.docOverflow <= 0 && fit.wsOverflow <= 0 && fit.card.right <= fit.ws.right + 0.5
        && fit.name.right <= fit.card.right + 0.5 && fit.thumb.width <= 80 && fit.thumb.height <= 96, fit);
    }
    await shot('long-name');
    await chooseFile('[data-scam-reselect]', '다시 고르기 (WEBP)', files.webp);
    const webp = await waitCard(state => state.name === path.basename(files.webp) && state.preview?.loaded, 'WEBP preview');
    check('WEBP previews with name, type and size', webp.meta === `WEBP 사진 · ${sizeLabel(sizeOf(files.webp))}` && webp.preview.blob && !webp.docNote, webp);
    const reselect = await chooseFile('[data-scam-reselect]', '다시 고르기', files.photo);
    check('다시 고르기 reopens the photo input', reselect.input.kind === 'photo' && reselect.input.capture === null, reselect);
    const jpeg = await waitCard(state => state.name === path.basename(files.photo) && state.preview?.loaded, 'photo re-preview');
    check('JPEG previews with name, type and size', jpeg.meta === `JPG 사진 · ${sizeLabel(sizeOf(files.photo))}` && jpeg.preview.blob, jpeg);
    check('still nothing sent after 다시 고르기', (await sentCount()) === 0 && (await uploadsOnNetwork()) === 0, {});
    await p.tap('[data-scam-submit]');
    await waitFor(async () => (await sentCount()) === 1, 'photo analysis request');
    const photoSent = await lastSent();
    check('의심 신호 확인하기 sends the chosen picture (file key only)', isDeepStrictEqual(await lastKeys(), ['file']) && photoSent.file?.file === true
      && photoSent.file.name === path.basename(files.photo) && photoSent.file.type === 'image/jpeg' && photoSent.file.size === sizeOf(files.photo), photoSent);
    await waitResult(() => true, 'photo result');
    await shot('result');

    // ── 카메라로 찍기 on a phone, with the incident answers ─────────────────
    if (testCase.mobile) {
      await freshInput(p);
      await fileTab();
      const camera = await chooseFile('[data-scam-pick="camera"]', 'camera button', files.cameraPhoto);
      check('camera button opens camera input', camera.input.kind === 'camera' && camera.input.capture === 'environment' && camera.input.accept === INPUTS.camera.accept && camera.mode === 'selectSingle', camera);
      await waitCard(state => state.name === path.basename(files.cameraPhoto) && state.preview?.loaded, 'camera preview');
      check('nothing sent before 의심 신호 확인하기 (camera)', (await sentCount()) === 1 && (await uploadsOnNetwork()) === 0, {});
      await p.tap('[data-scam-incident="yes"]');
      const follow = await waitFor(() => p.evaluate(FOLLOW), 'incident questions');
      check('예 shows the device chips and stages 1–6', isDeepStrictEqual(follow.devices, ['Galaxy', 'iPhone', 'Windows', 'macOS']) && follow.devicesShown
        && isDeepStrictEqual(follow.stages, ['1', '2', '3', '4', '5', '6']) && follow.stagesShown, follow);
      await p.tap(`[data-scam-device="${testCase.device}"]`);
      await p.tap('[data-scam-stage="3"]');
      const again = await chooseFile('[data-scam-reselect]', '다시 고르기 (camera)', files.photo);
      check('다시 고르기 after the camera reopens the camera', again.input.kind === 'camera' && again.input.capture === 'environment', again);
      await waitCard(state => state.name === path.basename(files.photo) && state.preview?.loaded, 'camera re-preview');
      const answers = await p.evaluate(FOLLOW);
      check('incident answers kept after 다시 고르기', isDeepStrictEqual(answers.checked, ['yes', testCase.device, '3']), answers);
      await p.tap('[data-scam-submit]');
      await waitFor(async () => (await sentCount()) === 2, 'camera analysis request');
      const cameraSent = await lastSent();
      check('camera result includes incident context', isDeepStrictEqual(await lastKeys(), ['device', 'file', 'incident_level'])
        && cameraSent.incident_level === '3' && cameraSent.device === testCase.device && cameraSent.file?.name === path.basename(files.photo), cameraSent);
      const incidentResult = await waitResult(() => true, 'camera result');
      check('the incident comes first on the result', incidentResult.incidentCard, incidentResult);
    }

    // ── 10MB limit and format guard ────────────────────────────────────────
    await freshInput(p);
    check('다른 내용 확인하기 clears the old result', (await p.evaluate(RESULT)).results === 0, {});
    await fileTab();
    const sentBefore = await sentCount();
    await chooseFile('[data-scam-pick="photo"]', 'photo button (10MB)', files.tooBig);
    const tooBig = await waitCard(state => state.message.startsWith('파일은 10MB'), '10MB message');
    check('over 10MB: the 10MB message with the real size', tooBig.message === TOO_BIG && tooBig.status === TOO_BIG && tooBig.name === path.basename(files.tooBig), tooBig);
    check('over 10MB: no preview, submit off', tooBig.warn && !tooBig.preview && tooBig.submitDisabled && tooBig.hint === '다른 파일을 골라 주세요.' && tooBig.reselect === '다른 파일 고르기', tooBig);
    await tapDisabledSubmit();
    check('over 10MB is not sent and submit is disabled', (await sentCount()) === sentBefore && (await uploadsOnNetwork()) === 0, {});
    const atLimit = await chooseFile('[data-scam-reselect]', '다른 파일 고르기 (10MB)', files.atLimit);
    check('다른 파일 고르기 reopens the photo input', atLimit.input.kind === 'photo' && atLimit.input.capture === null, atLimit);
    const exactly = await waitCard(state => state.name === path.basename(files.atLimit), 'exactly 10MB');
    check('exactly 10MB is accepted', !exactly.warn && !exactly.message && !exactly.submitDisabled && exactly.meta === 'PNG 사진 · 10.0MB', exactly);
    await chooseFile('[data-scam-reselect]', '다시 고르기 (GIF)', files.gif);
    const gif = await waitCard(state => state.name === path.basename(files.gif), 'GIF card');
    check('unsupported picture type: message, no preview, not sendable', gif.message === UNSUPPORTED && gif.warn && !gif.preview && gif.submitDisabled && gif.reselect === '다른 파일 고르기', gif);
    await tapDisabledSubmit();
    check('unsupported file is not sent', (await sentCount()) === sentBefore && (await uploadsOnNetwork()) === 0, {});
    await shot('limit');

    // ── 지우기: back to all three pickers, so a photo can become a document ──
    await p.tap('[data-scam-remove]');
    const removed = await waitFor(async () => {
      const state = await p.evaluate(`(() => { const ws = document.querySelector(${JSON.stringify(WS)}); const shown = node => Boolean(node && node.getClientRects().length && !node.closest('[hidden]'));
        return {card: Boolean(ws.querySelector('[data-scam-file-card]')), photo: shown(ws.querySelector('[data-scam-pick="photo"]')), document: shown(ws.querySelector('[data-scam-pick="document"]')),
          submitDisabled: Boolean(ws.querySelector('[data-scam-submit]')?.disabled), status: ws.querySelector('[data-scam-status]')?.textContent || ''}; })()`);
      return !state.card ? state : {ok: false, state};
    }, '지우기');
    check('지우기: the card goes and both pickers come back, nothing sendable', removed.photo && removed.document && removed.submitDisabled && removed.status === '선택한 파일을 지웠어요. 다시 골라 주세요.', removed);
    check('지우기 sends nothing', (await sentCount()) === sentBefore && (await uploadsOnNetwork()) === 0, {});

    // ── A dropped file is taken like a picked one, never opened by the browser ──
    const DROP = (selector, name, type, body) => `(() => {
      const target = document.querySelector(${JSON.stringify(WS)} + ' ' + ${JSON.stringify(selector)});
      const data = new DataTransfer();
      data.items.add(new File([${JSON.stringify(body)}], ${JSON.stringify(name)}, {type: ${JSON.stringify(type)}}));
      const over = new DragEvent('dragover', {dataTransfer: data, bubbles: true, cancelable: true});
      target.dispatchEvent(over);
      const drop = new DragEvent('drop', {dataTransfer: data, bubbles: true, cancelable: true});
      target.dispatchEvent(drop);
      return {overPrevented: over.defaultPrevented, dropPrevented: drop.defaultPrevented};
    })()`;
    const outside = await p.evaluate(DROP('.site-modal-close', 'outside.html', 'text/html', '<script>window.__scamPwned="drop-outside"</script>'));
    await sleep(200);
    const afterOutside = await p.evaluate(CARD);
    check('a file dropped on the page header is not opened and not taken', outside.overPrevented && outside.dropPrevented && !afterOutside.card, {outside, afterOutside});
    const dropBaseline = await p.evaluate(SAFETY);
    const dropped = await p.evaluate(DROP('.sp-drop', 'dropped-notice.html', 'text/html', '<script>window.__scamPwned="drop"</script><img src=x onerror="window.__scamPwned=1">'));
    const droppedCard = await waitCard(state => state.name === 'dropped-notice.html', 'dropped HTML card');
    await sleep(400);
    const dropSafety = await p.evaluate(SAFETY);
    check('a file dropped on the box is taken like a picked document', dropped.overPrevented && dropped.dropPrevented && droppedCard.meta.startsWith('HTML 문서') && !droppedCard.preview && droppedCard.docNote === DOC_NOTE && !droppedCard.submitDisabled, {dropped, droppedCard});
    check('a dropped HTML file never runs and nothing is sent before 확인하기', dropSafety.pwned === null && dropSafety.injected === dropBaseline.injected && dropSafety.framesInPage === 0 && dropSafety.frames === dropBaseline.frames && (await sentCount()) === sentBefore && (await uploadsOnNetwork()) === 0, {dropSafety, dropBaseline});

    // ── 문서·PDF: leave, come back clean, then HTML · PDF · TXT ──────────────
    await p.evaluate("window.dispatchEvent(new CustomEvent('lotbi:scam-shield-close-request')), true");
    await waitFor(() => p.evaluate(`!document.querySelector(${JSON.stringify(WS)}) && location.hash !== '#scam' && !document.documentElement.dataset.siteRoutePending`), 'page closed');
    await p.evaluate(OPEN_PAGE);
    await waitFor(() => p.evaluate(INPUT_READY), 'page reopened');
    await fileTab();
    const clean = await p.evaluate(CARD);
    check('a reopened page keeps no chosen file', !clean.card && !clean.message, clean);
    const docChooser = await chooseFile('[data-scam-pick="document"]', 'document input', files.docx);
    check('document input unchanged', docChooser.input.kind === 'document' && docChooser.input.capture === null && docChooser.input.accept === INPUTS.document.accept && docChooser.mode === 'selectSingle', docChooser);
    const docx = await waitCard(state => state.name === path.basename(files.docx), 'DOCX card');
    check('unsupported document type: message, not sendable', docx.message === UNSUPPORTED && docx.warn && docx.submitDisabled, docx);
    const baseline = await p.evaluate(SAFETY);
    const navigationsBefore = seen.navigations.length;
    const reDocument = await chooseFile('[data-scam-reselect]', '다른 파일 고르기 (document)', files.html);
    check('다른 파일 고르기 after a document reopens the document input', reDocument.input.kind === 'document', reDocument);
    const html = await waitCard(state => state.name === path.basename(files.html) && !state.warn, 'HTML card');
    await sleep(400);   // a script, onerror or frame from the file would have run by now
    const htmlSafety = await p.evaluate(SAFETY);
    check('HTML document shows name, type and size only', html.meta === `HTML 문서 · ${sizeLabel(sizeOf(files.html))}` && !html.preview && html.docNote === DOC_NOTE && html.ask === ASK_DOCUMENT, html);
    check('HTML document is never rendered or injected', htmlSafety.pwned === null && htmlSafety.frames === baseline.frames && htmlSafety.framesInPage === 0
      && htmlSafety.injected === baseline.injected && htmlSafety.blobImages === 0 && !DOC_MARKERS.some(marker => htmlSafety.text.includes(marker)), htmlSafety);
    check('HTML document is never opened or read', !htmlSafety.objectUrls.includes(path.basename(files.html)) && htmlSafety.reads.length === 0, htmlSafety);
    check('HTML document is never navigated to', seen.navigations.length === navigationsBefore && seen.windowOpens.length === 0 && htmlSafety.href === baseline.href
      && !seen.requests.some(url => /ibsgame|court-esonsong/u.test(url) || new URL(url).pathname === '/x'), {navigations: seen.navigations.slice(navigationsBefore), opens: seen.windowOpens, href: htmlSafety.href});
    check('nothing sent before 의심 신호 확인하기 (document)', (await sentCount()) === sentBefore && (await uploadsOnNetwork()) === 0 && !html.submitDisabled, {});
    await shot('document');
    await p.tap('[data-scam-submit]');
    await waitFor(async () => (await sentCount()) === sentBefore + 1, 'document analysis request');
    const documentSent = await lastSent();
    check('sanitized HTML document reaches analysis only after submit', isDeepStrictEqual(await lastKeys(), ['file']) && documentSent.file?.name === path.basename(files.html) && documentSent.file.type === 'text/html', documentSent);
    await waitResult(() => true, 'document result');
    const resultSafety = await p.evaluate(SAFETY);
    check('HTML document still not run, read or opened after the result', resultSafety.pwned === null && resultSafety.injected === baseline.injected && resultSafety.reads.length === 0
      && seen.navigations.length === navigationsBefore && seen.windowOpens.length === 0, resultSafety);

    await freshInput(p);
    await fileTab();
    await chooseFile('[data-scam-pick="document"]', 'document input (PDF)', files.pdf);
    const pdf = await waitCard(state => state.name === path.basename(files.pdf) && !state.warn, 'PDF card');
    check('PDF shows name, type and size only', pdf.meta === `PDF 문서 · ${sizeLabel(sizeOf(files.pdf))}` && !pdf.preview && pdf.docNote === DOC_NOTE && pdf.ask === ASK_DOCUMENT, pdf);
    const txtChooser = await chooseFile('[data-scam-reselect]', '다시 고르기 (TXT)', files.txt);
    check('다시 고르기 after a PDF reopens the document input', txtChooser.input.kind === 'document', txtChooser);
    const txt = await waitCard(state => state.name === path.basename(files.txt) && !state.warn, 'TXT card');
    check('TXT shows name, type and size only', txt.meta === `TXT 문서 · ${sizeLabel(sizeOf(files.txt))}` && !txt.preview && txt.docNote === DOC_NOTE && txt.ask === ASK_DOCUMENT, txt);
    const docSafety = await p.evaluate(SAFETY);
    check('PDF and TXT are never opened, read, framed or shown', docSafety.framesInPage === 0 && docSafety.frames === baseline.frames && docSafety.blobImages === 0
      && !docSafety.objectUrls.some(name => name === path.basename(files.pdf) || name === path.basename(files.txt)) && docSafety.reads.length === 0
      && !DOC_MARKERS.some(marker => docSafety.text.includes(marker)) && seen.navigations.length === navigationsBefore && seen.windowOpens.length === 0, docSafety);
    check('nothing sent for PDF/TXT without 의심 신호 확인하기', (await sentCount()) === sentBefore + 1, {});

    // ── a late response never overwrites the newer result ─────────────────
    if (testCase.race) {
      // Same page: the second request goes through the page's own form while
      // the first is still pending (the old dialog allowed it; the page shows
      // its loading card, so this half is driven from script, as before).
      await p.tap('[data-scam-tab="text"]');
      await typeInto('#scam-text', '느린 첫 검사 (같은 화면)');
      await p.evaluate(`(() => { const ws = document.querySelector(${JSON.stringify(WS)}); window.__raceRefs = {text: ws.querySelector('#scam-text'), submit: ws.querySelector('[data-scam-submit]')}; return true; })()`);
      const beforeRace = await sentCount();
      await p.tap('[data-scam-submit]');
      await waitFor(async () => (await sentCount()) === beforeRace + 1 && (await phase()) === 'loading', 'slow text request');
      const slowSent = await lastSent();
      check('a text check sends the text only (no leftover file)', isDeepStrictEqual(await lastKeys(), ['text']) && slowSent.text === '느린 첫 검사 (같은 화면)', slowSent);
      await p.evaluate("(() => { const {text, submit} = window.__raceRefs; text.value = '빠른 두 번째 검사 (같은 화면)'; text.dispatchEvent(new Event('input', {bubbles: true})); submit.click(); return true; })()");
      await waitFor(async () => (await sentCount()) === beforeRace + 2, 'second text request');
      await waitResult(state => state.summary.includes('빠른 두 번째 검사 (같은 화면)'), 'latest result visible');
      check('the slow response was still pending when the newer result showed', !(await p.evaluate('window.__scamResolved')).includes('느린 첫 검사 (같은 화면)'), {});
      await waitFor(() => p.evaluate("window.__scamResolved.includes('느린 첫 검사 (같은 화면)')"), 'slow response answered');
      await sleep(150);
      const raced = await p.evaluate(RESULT);
      check('late previous response cannot overwrite the latest result', raced.level === 'CURRENTLY_NO_RISK_SIGNAL' && raced.summary.includes('빠른 두 번째 검사 (같은 화면)') && !raced.summary.includes('느린'), raced);

      // A person's path: send, leave with ← 대화로 돌아가기, come back, send again.
      await freshInput(p);
      await typeInto('#scam-text', '느린 첫 검사 (돌아가기 전)');
      const beforeLeave = await sentCount();
      await p.tap('[data-scam-submit]');
      await waitFor(async () => (await sentCount()) === beforeLeave + 1 && (await phase()) === 'loading', 'slow request before leaving');
      await p.tap('.site-modal-close.scam-back');
      await waitFor(() => p.evaluate(`!document.querySelector(${JSON.stringify(WS)}) && location.hash !== '#scam' && !document.documentElement.dataset.siteRoutePending`), 'left the page');
      await p.evaluate(OPEN_PAGE);
      await waitFor(() => p.evaluate(INPUT_READY), 'page reopened after leaving');
      await typeInto('#scam-text', '빠른 두 번째 검사 (돌아온 뒤)');
      await p.tap('[data-scam-submit]');
      await waitResult(state => state.summary.includes('빠른 두 번째 검사 (돌아온 뒤)'), 'result after coming back');
      check('the left page\'s request was still pending when the new result showed', !(await p.evaluate('window.__scamResolved')).includes('느린 첫 검사 (돌아가기 전)'), {});
      await waitFor(() => p.evaluate("window.__scamResolved.includes('느린 첫 검사 (돌아가기 전)')"), 'left request answered');
      await sleep(150);
      const returned = await p.evaluate(RESULT);
      check('a response for a page already left never shows on the reopened page', returned.pages === 1 && returned.results === 1 && returned.level === 'CURRENTLY_NO_RISK_SIGNAL'
        && returned.summary.includes('빠른 두 번째 검사 (돌아온 뒤)') && !returned.summary.includes('느린'), returned);
    }

    // ── 인터넷 주소 tab ────────────────────────────────────────────────────
    if ((await phase()) === 'result') await freshInput(p);
    await p.tap('[data-scam-tab="url"]');
    await typeInto('#scam-url', 'www.scourt.go.kr');
    const incomplete = await waitCard(state => Boolean(state.message), 'URL warning');
    check('incomplete address: warning and button off', incomplete.message === URL_WARNING && incomplete.submitDisabled && incomplete.hint === '주소 형식을 고치면 버튼이 켜져요.'
      && (await p.evaluate(`document.querySelector(${JSON.stringify(`${WS} #scam-url`)}).getAttribute('aria-invalid')`)) === 'true', incomplete);
    await shot('url-warning');
    const beforeUrl = await sentCount();
    await tapDisabledSubmit();
    check('an incomplete address is not sent', (await sentCount()) === beforeUrl, {});
    await typeInto('#scam-url', 'https://www.scourt.go.kr/');
    const complete = await waitCard(state => !state.message && !state.submitDisabled, 'valid URL');
    check('changing input enables a valid URL check', !complete.hint, complete);
    await p.tap('[data-scam-submit]');
    await waitFor(async () => (await sentCount()) === beforeUrl + 1, 'URL request');
    const urlSent = await lastSent();
    check('a URL check sends the url key only', isDeepStrictEqual(await lastKeys(), ['url']) && urlSent.url === 'https://www.scourt.go.kr/', urlSent);
    await waitResult(() => true, 'URL result');
    await p.tap('[data-scam-section="info"] .sp-sec-h');
    const info = await waitFor(async () => {
      const state = await p.evaluate(`(() => { const ws = document.querySelector(${JSON.stringify(WS)}); return {text: ws.querySelector('[data-scam-section="info"]')?.textContent || '', links: [...ws.querySelectorAll('a[href]')].map(a => a.href).filter(href => href.includes('scourt'))}; })()`);
      return state.text.includes('https://www.scourt.go.kr/') ? state : {ok: false, state};
    }, 'URL result details');
    check('the checked address is shown as text, never a link', info.text.includes('www.scourt.go.kr') && info.text.includes('링크로 만들지 않아요') && info.links.length === 0, info);
    check('no navigation or new window anywhere in the run', seen.navigations.length === navigationsBefore && seen.windowOpens.length === 0 && (await p.evaluate('window.__fileReads.length')) === 0, {navigations: seen.navigations.slice(navigationsBefore), opens: seen.windowOpens});
    console.log(`  ${testCase.label}: ${checks.length} checks PASS`);
    return checks.length;
  } finally {
    stopListening();
    await p.close();
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

const started = Date.now();
const browser = browserPath();
const workDir = makeWorkDir('scam-picker');
const srv = startServer();
let total = 0;
try {
  const origin = await srv.origin;
  // A real PNG (screenshot), JPEG (photo) and WEBP; a GIF (a picture type the
  // page does not take); files at and one byte over 10MB; HTML, PDF, TXT and
  // DOCX documents. The HTML carries markup that would run if it were ever
  // rendered or injected.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUiDrBgA0wYRUdtBIABbMBWhzDM6AAAAAASUVORK5CYII=', 'base64');
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDl6KKK+4PBP//Z', 'base64');
  const webp = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const files = {
    screenshot: path.join(workDir, 'Screenshot 2026-10-08 at 09.12.33.png'),
    photo: path.join(workDir, 'IMG_0001.jpg'),
    cameraPhoto: path.join(workDir, 'IMG_0004.jpg'),
    webp: path.join(workDir, 'IMG_0003.webp'),
    gif: path.join(workDir, 'animation.gif'),
    tooBig: path.join(workDir, 'IMG_0002.png'),
    atLimit: path.join(workDir, 'IMG_0006.png'),
    html: path.join(workDir, 'court-esonsong-sanitized.html'),
    pdf: path.join(workDir, 'notice.pdf'),
    txt: path.join(workDir, 'message.txt'),
    docx: path.join(workDir, 'contract.docx'),
  };
  fs.writeFileSync(files.screenshot, png);
  fs.writeFileSync(files.photo, jpeg);
  fs.writeFileSync(files.cameraPhoto, jpeg);
  fs.writeFileSync(files.webp, webp);
  fs.writeFileSync(files.gif, gif);
  fs.writeFileSync(files.tooBig, Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 + 1 - png.length)]));
  fs.writeFileSync(files.atLimit, Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)]));
  fs.writeFileSync(files.html, '<!doctype html><title>법원 안내처럼 보이는 최소 재현본</title><script src="https://mega.ibsgame.example/static/app.js"></script>'
    + '<script>window.__scamPwned = "script";</script><img src="x" onerror="window.__scamPwned = \'img\'">'
    + '<iframe srcdoc="<script>parent.__scamPwned = \'iframe\'</script>"></iframe><form><input name="case-number"><input name="phone"></form>');
  fs.writeFileSync(files.pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% PDF 안쪽 글자\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  fs.writeFileSync(files.txt, '[국제발신] 법원 등기 반송 확인 바랍니다 http://court-esonsong.example/track\n');
  fs.writeFileSync(files.docx, Buffer.from('504b0304', 'hex'));
  files.layout = [
    {kind: 'portrait', file: path.join(workDir, 'KakaoTalk_Photo_2026-10-08-09-12-33-001_0123456789abcdef0123456789abcdef.png'), size: [900, 1950], color: [210, 70, 60]},
    {kind: 'landscape', file: path.join(workDir, 'https___lotbi-example.test_files_download_very_long_path_segment_without_any_break_0123456789abcdef.png'), size: [1600, 720], color: [40, 140, 90]},
    {kind: 'square', file: path.join(workDir, 'IMG_0005.png'), size: [1080, 1080], color: [60, 90, 200]},
  ];
  for (const sample of files.layout) fs.writeFileSync(sample.file, solidPng(...sample.size, sample.color));
  for (const testCase of CASES) total += await runCase(browser, origin, workDir, files, testCase);
} finally {
  srv.stop();
  await removeDir(workDir);
}
console.log(`SCAM-SHIELD-PHOTO-LIBRARY-PICKER-01 PASS — ${total} checks in ${CASES.length} runs (${((Date.now() - started) / 1000).toFixed(1)}s), real Chrome taps on the #scam page, chooser intercepted; viewport/UA emulation, not an iPhone/KakaoTalk/Android device run`);
