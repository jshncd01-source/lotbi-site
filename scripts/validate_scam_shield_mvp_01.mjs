import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const ui = read('site-scam-shield.js');

assert.match(html, /LOTBI 진위확인/);
for (const label of ['받은 문자 화면 찍기', '휴대폰 사진에서 고르기', '문서·PDF 선택하기', '문자 내용 붙여넣기', '인터넷 주소 확인하기', '말로 물어보기']) assert.ok(html.includes(label));
assert.match(html, /<textarea id="scam-text"[^>]*maxlength="20000"/);
assert.match(html, /“롯비야, 이거 진짜야\?”/);
assert.equal((html.match(/<button\b[^>]*data-scam-open[^>]*aria-label="진위확인"/gu) || []).length, 2, 'desktop and mobile navigation must expose one compact Scam Shield entry each');
assert.doesNotMatch(html, /class="scam-shield-card"/, 'Scam Shield must not reintroduce a marketing section into White Home');
assert.match(html, /name="scamCamera"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*capture="environment"/);
assert.match(html, /name="scamPhoto"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(html, /name="scamDocument"[^>]*accept="\.txt,text\/plain,\.html,\.htm,text\/html,application\/pdf"/);
assert.match(html, /이미 눌렀거나 개인정보를 입력했어요/);
assert.match(core, /\/v2\/scam-shield\/cases/);
assert.match(core, /untrusted_file_execution !== false/);
assert.match(core, /public_file_upload_to_third_party !== false/);
assert.match(ui, /확인이 더 필요해요/);
assert.doesNotMatch(ui, /안전합니다|안전해요/);
assert.match(conversation, /analyzeScamShield\(sessionToken, detail\.formData\)/);
assert.match(ui, /왜 그렇게 보나요\?/);
assert.match(ui, /아직 확인 안 된 내용/);
assert.match(ui, /지금 하실 일/);
assert.match(ui, /하지 마세요/);
assert.match(ui, /이 사진을 LOTBI가 확인할까요\?/);
assert.match(ui, /\.mic-button:not\(\[disabled\]\)/, 'voice method must hand off to the existing main-chat microphone');
assert.doesNotMatch(ui, /getUserMedia|SpeechRecognition/, 'Scam Shield must not duplicate the voice engine');
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
console.log('SITE-SCAM-SHIELD-MVP-01 PASS');
