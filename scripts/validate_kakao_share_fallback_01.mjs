// SITE-MESSAGE-SHARE-ACTIONS-02 — "카카오톡 공유하기" in both Core states.
//
// Not configured (navigation.kakao_navi_ready is not true, the key is missing,
// the SDK URL is not the allowlisted Kakao CDN, or the config cannot be read):
// the Kakao SDK is never requested, and the answer plus LOTBI link are copied.
// Configured: the allowlisted SDK is loaded once, initialised with Core's key,
// and the KakaoTalk text share opens. No Site change between the two states.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'site-kakao-share.js'), 'utf8');
const conversation = readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');

const CORE = 'https://core.invalid';
const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
const URL_TO_SHARE = 'https://lotbiai.com/';

// The module's only import is CORE_ORIGIN; replace it so the module runs in
// isolation, and give each scenario a fresh module instance.
const importLine = source.match(/^import \{CORE_ORIGIN\} from '\.\/site-core\.js\?v=[^']+';\r?\n/m)?.[0];
assert.ok(importLine, 'site-kakao-share.js must import only CORE_ORIGIN from site-core.js');
let instance = 0;
async function freshModule() {
  const body = source.replace(importLine, `const CORE_ORIGIN = ${JSON.stringify(CORE)};\n`)
    + `\n// instance ${++instance}\n`;
  return import(`data:text/javascript;base64,${Buffer.from(body).toString('base64')}`);
}

function environment({config, configStatus = 200, configThrows = false, sdkLoads = true}) {
  const calls = {fetch: [], scripts: [], init: [], send: [], copied: []};
  globalThis.fetch = async (url, options) => {
    calls.fetch.push({url, options});
    if (configThrows) throw new TypeError('network down');
    return {ok: configStatus >= 200 && configStatus < 300, json: async () => config};
  };
  const kakao = {
    initialized: false,
    init(key) { calls.init.push(key); this.initialized = true; },
    isInitialized() { return this.initialized; },
    Share: {sendDefault: async payload => { calls.send.push(payload); }},
  };
  delete globalThis.Kakao;
  globalThis.document = {
    head: {
      appendChild(script) {
        calls.scripts.push(script.src);
        queueMicrotask(() => {
          if (sdkLoads) { globalThis.Kakao = kakao; script.listeners.load?.(); }
          else script.listeners.error?.();
        });
      },
    },
    createElement(tag) {
      assert.equal(tag, 'script');
      return {
        listeners: {},
        addEventListener(type, listener) { this.listeners[type] = listener; },
      };
    },
  };
  const copyFallback = async text => { calls.copied.push(text); };
  return {calls, copyFallback};
}

const configured = {navigation: {kakao_navi_ready: true, kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: SDK}};
const notConfiguredStates = {
  'kakao_navi_ready false (Production today)': {config: {navigation: {kakao_navi_ready: false, kakao_javascript_key: null, kakao_javascript_sdk_url: null}}},
  'key without kakao_navi_ready': {config: {navigation: {kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: SDK}}},
  'SDK URL off the allowlist': {config: {navigation: {kakao_navi_ready: true, kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: 'https://evil.invalid/kakao.min.js'}}},
  'config request fails': {config: null, configStatus: 503},
  'config network error': {config: null, configThrows: true},
};

for (const [label, state] of Object.entries(notConfiguredStates)) {
  const {shareWithKakaoTalk} = await freshModule();
  const {calls, copyFallback} = environment(state);
  const result = await shareWithKakaoTalk({text: '  답변 본문  ', url: URL_TO_SHARE, copyFallback});
  assert.equal(result, 'copied', `${label}: falls back to copying`);
  assert.deepEqual(calls.copied, [`답변 본문\n\n${URL_TO_SHARE}`], `${label}: copies the answer and the link`);
  assert.deepEqual(calls.scripts, [], `${label}: never requests the Kakao SDK`);
  assert.deepEqual(calls.init, [], `${label}: never initialises Kakao`);
  assert.deepEqual(calls.send, [], `${label}: never opens a Kakao share`);
  assert.equal(calls.fetch[0].url, `${CORE}/app/config.json`);
  assert.equal(calls.fetch[0].options.credentials, 'omit');
}

{
  // A failed copy is reported as such, never as a silent success.
  const {shareWithKakaoTalk} = await freshModule();
  const {calls} = environment(notConfiguredStates['kakao_navi_ready false (Production today)']);
  await assert.rejects(
    shareWithKakaoTalk({text: '답변', url: URL_TO_SHARE, copyFallback: async () => { throw new Error('denied'); }}),
    /KAKAO_SHARE_COPY_FAILED/,
  );
  assert.deepEqual(calls.scripts, []);
}

{
  // A failed config read is not remembered: the next tap asks Core again.
  const {shareWithKakaoTalk} = await freshModule();
  const first = environment({config: null, configThrows: true});
  assert.equal(await shareWithKakaoTalk({text: 'a', url: URL_TO_SHARE, copyFallback: first.copyFallback}), 'copied');
  const second = environment({config: configured});
  assert.equal(await shareWithKakaoTalk({text: 'a', url: URL_TO_SHARE, copyFallback: second.copyFallback}), 'shared');
  assert.equal(second.calls.fetch.length, 1);
}

{
  // Configured: the allowlisted SDK loads once, Kakao is initialised once, the
  // text share opens, and nothing is copied.
  const {shareWithKakaoTalk, loadKakaoShareConfig} = await freshModule();
  const {calls, copyFallback} = environment({config: configured});
  await loadKakaoShareConfig();
  const result = await shareWithKakaoTalk({text: '답변 본문', url: URL_TO_SHARE, copyFallback});
  assert.equal(result, 'shared');
  assert.deepEqual(calls.scripts, [SDK]);
  assert.deepEqual(calls.init, ['test-js-key']);
  assert.equal(calls.send.length, 1);
  assert.equal(calls.send[0].objectType, 'text');
  assert.equal(calls.send[0].text, '답변 본문');
  assert.deepEqual(calls.send[0].link, {mobileWebUrl: URL_TO_SHARE, webUrl: URL_TO_SHARE});
  assert.deepEqual(calls.copied, []);
  assert.equal(calls.fetch.length, 1, 'Core config is read once per page');
  assert.equal(await shareWithKakaoTalk({text: '두 번째', url: URL_TO_SHARE, copyFallback}), 'shared');
  assert.deepEqual(calls.scripts, [SDK], 'the SDK is requested once');
  assert.deepEqual(calls.init, ['test-js-key'], 'Kakao is initialised once');
  assert.equal(calls.fetch.length, 1);
}

{
  // Configured but the SDK fails to load: an error, not a false success.
  const {shareWithKakaoTalk} = await freshModule();
  const {calls, copyFallback} = environment({config: configured, sdkLoads: false});
  await assert.rejects(shareWithKakaoTalk({text: '답변', url: URL_TO_SHARE, copyFallback}), /KAKAO_SDK_LOAD_FAILED/);
  assert.deepEqual(calls.copied, []);
}

// The chat wiring: the copy fallback is the answer clipboard writer, the
// config is read when the menu opens (so the copy stays in the user gesture),
// and each outcome is announced in plain words.
assert.match(conversation, /shareWithKakaoTalk\(\{\.\.\.options, copyFallback: writeMessageTextToClipboard\}\)/);
assert.match(conversation, /const openShareMenu = \(\) => \{\s*\n\s*prepareKakaoShare\(\);/);
assert.match(conversation, /module\.loadKakaoShareConfig\(\)/);
assert.match(conversation, /if \(result === 'copied'\) \{\s*\n\s*report\('복사했어요\. 카카오톡에 붙여넣어 공유해 주세요\.'\);/);
assert.match(conversation, /report\('카카오톡 공유 화면을 열었습니다\.'\)/);
assert.match(conversation, /'복사하지 못했습니다\. 답변을 길게 눌러 직접 선택해 주세요\.'/);
assert.match(conversation, /'카카오톡 공유 화면을 열지 못했습니다\.'/);
assert.doesNotMatch(conversation, /카카오톡 공유 설정이 필요합니다/, 'an unconfigured share must not end in a dead-end error');

console.log('SITE-KAKAO-SHARE-FALLBACK-01 PASS');
