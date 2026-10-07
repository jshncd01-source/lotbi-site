import {CORE_ORIGIN} from './site-core.js?v=aset-bb709c0dc32e';

// LOTBI-KAKAO-SHARE-REAL-SHARE-UX-FIX-01 — Kakao Navi readiness does not
// authorize Kakao Share. The Share action is available only when Core's
// explicit Share readiness flag, public JavaScript key and allowlisted SDK URL
// are all present. Missing or unreadable config fails closed without copying.
const KAKAO_SDK_URL_RE = /^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao(?:\.min)?\.js$/u;

let sdkPromise;
let configPromise;

function configuredSdk(navigation) {
  const sdkUrl = String(navigation?.kakao_javascript_sdk_url || '');
  const javascriptKey = String(navigation?.kakao_javascript_key || '');
  if (navigation?.kakao_share_ready !== true || !javascriptKey || !KAKAO_SDK_URL_RE.test(sdkUrl)) return null;
  return {sdkUrl, javascriptKey};
}

// Read once per page. A failed read is not remembered, so opening the menu
// again can recover after a temporary config failure.
export function loadKakaoShareConfig() {
  if (!configPromise) {
    configPromise = fetch(`${CORE_ORIGIN}/app/config.json`, {
      headers: {Accept: 'application/json'},
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
      .then(response => {
        if (!response.ok) throw new Error('KAKAO_SHARE_CONFIG_UNAVAILABLE');
        return response.json();
      })
      .then(body => configuredSdk(body?.navigation))
      .catch(() => {
        configPromise = undefined;
        return null;
      });
  }
  return configPromise;
}

function loadSdk(src) {
  if (globalThis.Kakao) return Promise.resolve(globalThis.Kakao);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.addEventListener('load', () => resolve(globalThis.Kakao), {once: true});
    script.addEventListener('error', () => {
      sdkPromise = undefined;
      reject(new Error('KAKAO_SDK_LOAD_FAILED'));
    }, {once: true});
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// Resolves 'shared' only after the KakaoTalk share helper has been invoked.
// Callers own their explicit Link Copy action; this helper never writes to the
// clipboard as a fallback.
export async function shareWithKakaoTalk({text, url}) {
  const config = await loadKakaoShareConfig();
  if (!config) throw new Error('KAKAO_SHARE_NOT_CONFIGURED');
  const Kakao = await loadSdk(config.sdkUrl);
  if (!Kakao?.Share?.sendDefault || typeof Kakao.init !== 'function') throw new Error('KAKAO_SHARE_SDK_INVALID');
  if (typeof Kakao.isInitialized !== 'function' || !Kakao.isInitialized()) Kakao.init(config.javascriptKey);
  await Kakao.Share.sendDefault({
    objectType: 'text',
    text: String(text || 'LOTBI에서 공유한 내용입니다.').slice(0, 200),
    link: {mobileWebUrl: url, webUrl: url},
    buttonTitle: 'LOTBI 열기',
  });
  return 'shared';
}
