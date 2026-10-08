import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const ui = read('site-scam-shield.js');

assert.match(html, /LOTBI 진위확인/);
for (const label of ['사진·스크린샷 선택', '카메라로 촬영', '문서·PDF 선택하기', '문자 내용 붙여넣기', '인터넷 주소 확인하기']) assert.ok(html.includes(label));
assert.doesNotMatch(html, /data-scam-voice|data-scam-input-panel="voice"/);
assert.match(html, /<textarea id="scam-text"[^>]*maxlength="20000"/);
assert.match(html, /“롯비야, 이거 진짜야\?”/);
assert.equal((html.match(/<button\b[^>]*data-scam-open[^>]*aria-label="진위확인"/gu) || []).length, 2, 'desktop and mobile navigation must expose one compact Scam Shield entry each');
assert.doesNotMatch(html, /class="scam-shield-card"/, 'Scam Shield must not reintroduce a marketing section into White Home');
assert.match(html, /name="scamCamera"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*capture="environment"/);
assert.match(html, /name="scamPhoto"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
// SCAM-SHIELD-PHOTO-LIBRARY-PICKER-01 — iPhone (Safari and the KakaoTalk
// in-app browser) opens the camera straight away for a capture input and draws
// every file control as "파일 선택". 사진·스크린샷 선택 is the first method and
// never forces the camera; only 카메라로 촬영 does.
const scamDialog = html.slice(html.indexOf('<dialog class="scam-dialog"'), html.indexOf('</dialog>', html.indexOf('<dialog class="scam-dialog"')));
const scamInputTag = name => {
  const tag = scamDialog.match(new RegExp(`<input\\b[^>]*\\bname="${name}"[^>]*>`, 'u'));
  assert.ok(tag, `${name} input`);
  return tag[0];
};
const photoTag = scamInputTag('scamPhoto');
const cameraTag = scamInputTag('scamCamera');
assert.doesNotMatch(photoTag, /\bcapture\b/u, '사진·스크린샷 선택 must offer the photo library and screenshots, not force the camera');
assert.match(photoTag, /\bid="scam-photo"[^>]*\btype="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"/u);
assert.match(cameraTag, /\bid="scam-camera"[^>]*\btype="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*capture="environment"/u);
assert.doesNotMatch(scamInputTag('scamDocument'), /\bcapture\b/u);
assert.deepEqual(
  [...scamDialog.matchAll(/<input\b[^>]*\bcapture\b[^>]*>/gu)].map(match => match[0].match(/\bname="([^"]+)"/u)?.[1]),
  ['scamCamera'],
  'only the 카메라로 촬영 input may carry capture',
);
const scamMethods = [...scamDialog.matchAll(/<input type="radio" name="scam-input-kind" value="([a-z]+)" \/>[\s\S]*?<strong>([^<]+)<\/strong>/gu)].map(match => [match[1], match[2]]);
assert.deepEqual(scamMethods.map(([value]) => value), ['photo', 'camera', 'document', 'text', 'url'], '사진·스크린샷 선택 is the first, default method');
assert.equal(Object.fromEntries(scamMethods).photo, '사진·스크린샷 선택');
assert.equal(Object.fromEntries(scamMethods).camera, '카메라로 촬영');
// The visible control names the action (the native one reads "파일 선택").
assert.match(scamDialog, /<label class="scam-file-pick" for="scam-photo" data-scam-file-pick="photo">사진·스크린샷 선택<\/label>/u);
assert.match(scamDialog, /<label class="scam-file-pick" for="scam-camera" data-scam-file-pick="camera">카메라로 촬영<\/label>/u);
assert.match(photoTag, /class="scam-file-input"/u);
assert.match(cameraTag, /class="scam-file-input"/u);
const detailCss = read('site-consumer-detail.css');
assert.match(detailCss, /\.scam-input-panel input\.scam-file-input\[type=file\] \{[^}]*clip-path: inset\(50%\);[^}]*opacity: 0;/u, 'the native control stays focusable, only visually hidden');
assert.doesNotMatch(detailCss, /\.scam-file-input[^{]*\{[^}]*display:\s*none/u, 'display:none would drop the input from keyboard focus');
assert.match(detailCss, /\.scam-file-input:focus-visible \+ \.scam-file-pick \{ outline:/u, 'keyboard focus shows on the named button');
// Out of scope and unchanged: the conversation attachment camera keeps capture.
assert.match(html, /accept="image\/jpeg,image\/png" capture="environment" data-attachment-input="camera"/u);
assert.match(html, /name="scamDocument"[^>]*accept="\.txt,text\/plain,\.html,\.htm,text\/html,application\/pdf"/);
assert.match(html, /진위확인은 로그인 후 사용할 수 있어요/);
assert.match(html, /확인할 자료를 안전하게 보호하기 위해 로그인이 필요합니다/);
assert.match(html, /로그인하고 확인하기/);
assert.match(html, /PDF·TXT·HTML 파일을 선택할 수 있어요 · 최대 10MB/);
assert.match(html, /이미 눌렀거나 개인정보를 입력했어요/);
assert.match(core, /\/v2\/scam-shield\/cases/);
assert.match(core, /untrusted_file_execution !== false/);
assert.match(core, /public_file_upload_to_third_party !== false/);
assert.match(ui, /지금 정보만으로는 진짜라고 확인할 수 없어요/);
assert.doesNotMatch(ui, /안전합니다|안전해요/);
assert.match(conversation, /analyzeScamShield\(sessionToken, detail\.formData\)/);
assert.match(ui, /왜 그렇게 판단했나요\?/);
assert.match(ui, /아직 확인되지 않은 내용/);
assert.match(ui, /지금 하실 일/);
assert.match(ui, /하지 마세요/);
assert.match(ui, /선택한 사진/);
assert.doesNotMatch(ui, /getUserMedia|SpeechRecognition/, 'Scam Shield must not duplicate the voice engine');
assert.match(ui, /PLAN_USAGE_LIMIT_REACHED/);
assert.match(ui, /basicProtection/);
assert.match(core, /basic_protection/);
assert.match(core, /nextSafeAction/);
assert.match(conversation, /lotbi:scam-shield-session-request/);
assert.match(conversation, /lotbi:scam-shield-login-request/);
assert.match(ui, /lotbi\.scam-shield\.reopen\.v1/);
assert.match(ui, /typeof dialog\.showModal === 'function'/, 'native dialog support must remain the preferred path');
assert.match(ui, /dialog\.setAttribute\('open', ''\)/, 'browsers without the dialog API must still open Scam Shield');
assert.match(ui, /typeof dialog\.close === 'function'/, 'native dialog close must remain the preferred path');
assert.match(ui, /dialog\.removeAttribute\('open'\)/, 'fallback dialog must be closable without the dialog API');
assert.match(ui, /lotbi:home-shell-hydrated/, 'login callback hydration must rebind Scam Shield to the replaced home DOM');
assert.match(ui, /dataset\.scamBound/, 'hydration rebinding must remain idempotent');
assert.match(ui, /event\.key === 'Escape' && !event\.defaultPrevented && dialog\?\.hasAttribute\('open'\)/, 'Escape must explicitly close native and fallback dialogs without overriding consumed keys');
assert.match(ui, /dialog\.addEventListener\('close', restoreDialogFocus\)/, 'native close must restore focus to a visible trigger');
assert.match(ui, /\[data-mobile-nav-open\]/, 'a hidden mobile navigation trigger must fall back to the visible menu button');
// Exercise the real keyboard/focus functions without requests or user data.
let keydown;
let prevented = 0;
let nativeCloses = 0;
let restored = 0;
class Trigger {
  isConnected = true;
  hidden = false;
  closest() { return this.hidden ? {} : null; }
  getClientRects() { return [{}]; }
  focus() { restored++; }
}
const trigger = new Trigger();
const menu = {focus() { restored += 10; }};
const sandbox = vm.createContext({HTMLElement: Trigger, document: {
  addEventListener(name, fn) { if (name === 'keydown') keydown = fn; },
  querySelector(selector) { return selector === '[data-mobile-nav-open]' ? menu : null; },
  querySelectorAll() { return []; },
}, window: {addEventListener() {}}, trigger});
vm.runInContext(ui, sandbox);
sandbox.nativeDialog = {hasAttribute: () => true, close() { nativeCloses++; }};
vm.runInContext('dialog = nativeDialog; dialogTrigger = trigger;', sandbox);
keydown({key: 'Escape', defaultPrevented: true, preventDefault() { prevented++; }});
assert.equal(nativeCloses, 0, 'consumed Escape is not overridden');
keydown({key: 'Escape', defaultPrevented: false, preventDefault() { prevented++; }});
assert.equal(nativeCloses, 1);
assert.equal(prevented, 1);
vm.runInContext('restoreDialogFocus()', sandbox);
assert.equal(restored, 1);
trigger.hidden = true;
vm.runInContext('restoreDialogFocus()', sandbox);
assert.equal(restored, 11, 'hidden mobile trigger returns to the visible menu button');
const removed = [];
sandbox.fallbackDialog = {hasAttribute: () => true, removeAttribute(name) { removed.push(name); }};
vm.runInContext('dialog = fallbackDialog;', sandbox);
keydown({key: 'Escape', defaultPrevented: false, preventDefault() { prevented++; }});
assert.deepEqual(removed, ['open', 'aria-modal']);
// Each picture path submits through its own input — 사진·스크린샷 선택 → scamPhoto,
// 카메라로 촬영 → scamCamera — with the same type and 10MB rules, and nothing is
// sent before 확인하기 (the request event fires only from submitAnalysis).
const analysisRequests = [];
sandbox.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
sandbox.FormData = FormData;
sandbox.window.dispatchEvent = event => {
  if (event.type === 'lotbi:scam-shield-request') {
    analysisRequests.push([...event.detail.formData.entries()]);
    event.detail.reject(new Error('validator stops here'));
  }
  return true;
};
sandbox.photoInput = {files: []};
sandbox.cameraInput = {files: []};
sandbox.documentInput = {files: []};
sandbox.submitButton = {disabled: false};
sandbox.statusNode = {textContent: ''};
sandbox.clickedBox = {checked: false};
vm.runInContext(`
  form = {
    elements: {scamPhoto: photoInput, scamCamera: cameraInput, scamDocument: documentInput, scamText: {value: ''}, scamUrl: {value: ''}, incidentLevel: {value: '2'}, device: {value: 'iPhone'}},
    querySelector: selector => (selector === '[type="submit"]' ? submitButton : null),
  };
  status = statusNode; clicked = clickedBox; result = {hidden: true};
`, sandbox);
const maxBytes = vm.runInContext('maxFileBytes', sandbox);
assert.equal(maxBytes, 10 * 1024 * 1024);
const submitAs = async (kind, files) => {
  vm.runInContext(`activeKind = ${JSON.stringify(kind)};`, sandbox);
  sandbox[`${kind}Input`].files = files;
  const before = analysisRequests.length;
  await vm.runInContext('submitAnalysis({preventDefault() {}})', sandbox);
  assert.equal(sandbox.submitButton.disabled, false, `${kind}: submit button is released`);
  return analysisRequests.length > before ? analysisRequests.at(-1) : null;
};
for (const [kind, name, type] of [['photo', 'Screenshot 2026-10-08 at 09.12.33.PNG', 'image/png'], ['camera', 'image.jpg', 'image/jpeg']]) {
  vm.runInContext(`activeKind = ${JSON.stringify(kind)};`, sandbox);
  assert.equal(vm.runInContext('activeFileInput()', sandbox), sandbox[`${kind}Input`], `${kind} path reads its own input (다시 고르기 reopens the same one)`);
  const sent = await submitAs(kind, [new File([new Uint8Array(4096)], name, {type})]);
  assert.ok(sent, `${kind}: a supported picture is sent on 확인하기`);
  const file = sent.find(([key]) => key === 'file')?.[1];
  assert.equal(file?.name, name);
  assert.equal(file?.type, type);
  assert.equal(file?.size, 4096);
  assert.equal(await submitAs(kind, [new File([new Uint8Array(maxBytes + 1)], 'IMG_0002.JPEG', {type: 'image/jpeg'})]), null, `${kind}: over 10MB is not sent`);
  assert.equal(sandbox.statusNode.textContent, '파일은 10MB 이하만 확인할 수 있어요.');
  assert.ok(await submitAs(kind, [new File([new Uint8Array(maxBytes)], 'IMG_0003.webp', {type: 'image/webp'})]), `${kind}: exactly 10MB is sent`);
  assert.equal(await submitAs(kind, [new File([new Uint8Array(16)], 'motion.gif', {type: 'image/gif'})]), null, `${kind}: unsupported type is not sent`);
  assert.equal(sandbox.statusNode.textContent, '현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요.');
  assert.equal(await submitAs(kind, []), null, `${kind}: nothing chosen, nothing sent`);
  assert.equal(sandbox.statusNode.textContent, '확인할 내용을 먼저 넣어 주세요.');
}
sandbox.clickedBox.checked = true;
const withIncident = await submitAs('photo', [new File([new Uint8Array(32)], 'IMG_0004.jpg', {type: 'image/jpeg'})]);
assert.deepEqual(withIncident.filter(([key]) => key !== 'file'), [['incident_level', '2'], ['device', 'iPhone']], '이미 눌렀어요 answers ride along unchanged');
console.log('SITE-SCAM-SHIELD-MVP-01 PASS');
