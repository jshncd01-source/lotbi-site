import {CORE_ORIGIN} from './site-core.js?v=aset-986b22d69170';

// SITE-MESSAGE-SHARE-ACTIONS-02 — "카카오톡 공유하기".
// Core decides whether KakaoTalk sharing is configured (the same
// navigation.kakao_navi_ready / JavaScript key Kakao Navi uses). Until it is,
// the Kakao SDK is never requested: the answer and the LOTBI link are copied
// so the user can paste them into KakaoTalk. The page load after Core turns
// it on shares through KakaoTalk with no Site change.
const KAKAO_SDK_URL_RE = /^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao(?:\.min)?\.js$/u;

let sdkPromise;
let configPromise;

function configuredSdk(navigation) {
  const sdkUrl = String(navigation?.kakao_javascript_sdk_url || '');
  const javascriptKey = String(navigation?.kakao_javascript_key || '');
  if (navigation?.kakao_navi_ready !== true || !javascriptKey || !KAKAO_SDK_URL_RE.test(sdkUrl)) return null;
  return {sdkUrl, javascriptKey};
}

// Read once per page. A failed read is not remembered, so the next tap asks
// Core again; that tap still falls back to copying rather than failing.
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

// Resolves 'shared' when the KakaoTalk share screen opened, or 'copied' when
// sharing is not configured and the text plus link went to the clipboard.
export async function shareWithKakaoTalk({text, url, copyFallback}) {
  const config = await loadKakaoShareConfig();
  if (!config) {
    if (typeof copyFallback !== 'function') throw new Error('KAKAO_SHARE_NOT_CONFIGURED');
    const body = String(text || '').trim();
    try {
      await copyFallback(body ? `${body}\n\n${url}` : String(url));
    } catch {
      throw new Error('KAKAO_SHARE_COPY_FAILED');
    }
    return 'copied';
  }
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
