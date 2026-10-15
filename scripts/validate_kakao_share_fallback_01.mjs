// LOTBI-KAKAO-SHARE-REAL-SHARE-UX-FIX-01 — the legacy filename stays wired
// into required CI, but this validator now proves there is no copy fallback.
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
const importLine = source.match(/^import \{CORE_ORIGIN\} from '\.\/site-core\.js\?v=[^']+';\r?\n/m)?.[0];
assert.ok(importLine, 'site-kakao-share.js must import only CORE_ORIGIN from site-core.js');

let instance = 0;
async function freshModule() {
  const body = source.replace(importLine, `const CORE_ORIGIN = ${JSON.stringify(CORE)};\n`)
    + `\n// instance ${++instance}\n`;
  return import(`data:text/javascript;base64,${Buffer.from(body).toString('base64')}`);
}

function environment({config, configStatus = 200, configThrows = false, sdkLoads = true, sdkValid = true}) {
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
    Share: sdkValid ? {sendDefault: async payload => { calls.send.push(payload); }} : {},
  };
  delete globalThis.Kakao;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {clipboard: {writeText: async text => { calls.copied.push(text); }}},
  });
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
      return {listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; }};
    },
  };
  return calls;
}

const configured = {navigation: {kakao_share_ready: true, kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: SDK}};
const notConfiguredStates = {
  'Production contract has Navi false and no Share readiness': {config: {navigation: {kakao_navi_ready: false, kakao_javascript_key: null, kakao_javascript_sdk_url: null}}},
  'Navi ready must not authorize Share': {config: {navigation: {kakao_navi_ready: true, kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: SDK}}},
  'Share ready without key': {config: {navigation: {kakao_share_ready: true, kakao_javascript_sdk_url: SDK}}},
  'Share ready with off-allowlist SDK': {config: {navigation: {kakao_share_ready: true, kakao_javascript_key: 'test-js-key', kakao_javascript_sdk_url: 'https://evil.invalid/kakao.min.js'}}},
  'config request fails': {config: null, configStatus: 503},
  'config network error': {config: null, configThrows: true},
};

for (const [label, state] of Object.entries(notConfiguredStates)) {
  const {shareWithKakaoTalk, loadKakaoShareConfig} = await freshModule();
  const calls = environment(state);
  assert.equal(await loadKakaoShareConfig(), null, `${label}: Share readiness fails closed`);
  await assert.rejects(
    shareWithKakaoTalk({text: '답변 본문', url: URL_TO_SHARE}),
    /KAKAO_SHARE_NOT_CONFIGURED/,
    `${label}: direct invocation must fail rather than copy`,
  );
  assert.deepEqual(calls.copied, [], `${label}: clipboard write count must be zero`);
  assert.deepEqual(calls.scripts, [], `${label}: Kakao SDK must not load`);
  assert.deepEqual(calls.init, [], `${label}: Kakao must not initialize`);
  assert.deepEqual(calls.send, [], `${label}: Kakao Share must not be called`);
  assert.equal(calls.fetch[0].url, `${CORE}/app/config.json`);
  assert.equal(calls.fetch[0].options.credentials, 'omit');
}

{
  // A transient config failure is not cached; the next read can recover.
  const {loadKakaoShareConfig} = await freshModule();
  const first = environment({config: null, configThrows: true});
  assert.equal(await loadKakaoShareConfig(), null);
  assert.equal(first.fetch.length, 1);
  const second = environment({config: configured});
  assert.deepEqual(await loadKakaoShareConfig(), {sdkUrl: SDK, javascriptKey: 'test-js-key'});
  assert.equal(second.fetch.length, 1);
}

{
  // READY=true invokes the canonical Kakao helper once and never copies.
  const {shareWithKakaoTalk, loadKakaoShareConfig} = await freshModule();
  const calls = environment({config: configured});
  await loadKakaoShareConfig();
  assert.equal(await shareWithKakaoTalk({text: '답변 본문', url: URL_TO_SHARE}), 'shared');
  assert.deepEqual(calls.scripts, [SDK]);
  assert.deepEqual(calls.init, ['test-js-key']);
  assert.equal(calls.send.length, 1);
  assert.equal(calls.send[0].objectType, 'text');
  assert.equal(calls.send[0].text, '답변 본문');
  assert.deepEqual(calls.send[0].link, {mobileWebUrl: URL_TO_SHARE, webUrl: URL_TO_SHARE});
  assert.deepEqual(calls.copied, []);
}

for (const failure of [
  {state: {config: configured, sdkLoads: false}, error: /KAKAO_SDK_LOAD_FAILED/},
  {state: {config: configured, sdkValid: false}, error: /KAKAO_SHARE_SDK_INVALID/},
]) {
  const {shareWithKakaoTalk} = await freshModule();
  const calls = environment(failure.state);
  await assert.rejects(shareWithKakaoTalk({text: '답변', url: URL_TO_SHARE}), failure.error);
  assert.deepEqual(calls.copied, [], 'SDK failure must never copy');
  assert.deepEqual(calls.send, [], 'SDK failure must never claim a share');
}

// LOTBI-KAKAO-SHARE-ACTUAL-01 — prepare runs when the share menu opens: it is
// true only when Share is configured and the SDK loaded and initialized, it
// never sends, and the share that follows reuses the loaded SDK.
for (const [label, state] of Object.entries(notConfiguredStates)) {
  const {prepareKakaoShare} = await freshModule();
  const calls = environment(state);
  assert.equal(await prepareKakaoShare(), false, `${label}: prepare fails closed`);
  assert.deepEqual(calls.scripts, [], `${label}: prepare must not load the SDK`);
  assert.deepEqual(calls.init, [], `${label}: prepare must not initialize Kakao`);
  assert.deepEqual(calls.send, [], `${label}: prepare must not share`);
}
for (const failure of [{config: configured, sdkLoads: false}, {config: configured, sdkValid: false}]) {
  const {prepareKakaoShare} = await freshModule();
  const calls = environment(failure);
  assert.equal(await prepareKakaoShare(), false, 'an SDK that does not load or lacks Share is not ready');
  assert.deepEqual(calls.send, []);
  assert.deepEqual(calls.copied, []);
}
{
  const {prepareKakaoShare, shareWithKakaoTalk} = await freshModule();
  const calls = environment({config: configured});
  assert.equal(await prepareKakaoShare(), true);
  assert.deepEqual(calls.scripts, [SDK], 'prepare loads the allowlisted SDK once');
  assert.deepEqual(calls.init, ['test-js-key'], "prepare initializes with Core's public key");
  assert.deepEqual(calls.send, [], 'prepare never shares by itself');
  const long = '가'.repeat(260);
  assert.equal(await shareWithKakaoTalk({text: long, url: URL_TO_SHARE}), 'shared');
  assert.deepEqual(calls.scripts, [SDK], 'the share reuses the prepared SDK');
  assert.deepEqual(calls.init, ['test-js-key'], 'no second initialization');
  assert.equal(calls.send.length, 1);
  assert.equal(calls.send[0].text.length, 200, 'Kakao text template carries at most 200 characters');
  assert.ok(calls.send[0].text.endsWith('…'), 'a shortened answer says it was shortened');
  assert.deepEqual(calls.send[0].link, {mobileWebUrl: URL_TO_SHARE, webUrl: URL_TO_SHARE}, 'only the public LOTBI address is linked');
  assert.deepEqual(calls.copied, []);
}

// Chat wiring and accessibility: only Link Copy is initially in the DOM; the
// Kakao menu item is attached after readiness=true, so false means it is absent
// from pointer, tab and ARIA trees. Copy remains explicit and independent.
assert.match(conversation, /return shareWithKakaoTalk\(options\);/);
assert.match(conversation, /return Boolean\(await module\.prepareKakaoShare\(\)\);/);
assert.match(conversation, /shareMenu\.append\(linkCopy\);/);
assert.match(conversation, /if \(ready\) \{\s*if \(!shareMenu\.contains\(kakao\)\) shareMenu\.prepend\(kakao\);\s*\} else \{\s*kakao\.remove\(\);/s);
assert.match(conversation, /writeMessageTextToClipboard\(MESSAGE_ACTION_SHARE_URL\)/);
assert.match(conversation, /writeMessageTextToClipboard\(value\)/);
assert.match(conversation, /카카오톡 공유를 열지 못했어요\. 링크 복사를 이용해 주세요\./);
assert.doesNotMatch(conversation, /카카오톡에 붙여넣어 공유해 주세요/);
assert.doesNotMatch(source, /copyFallback|KAKAO_SHARE_COPY_FAILED|return 'copied'/);

console.log('SITE-KAKAO-SHARE-REAL-ACTION-01 PASS');
