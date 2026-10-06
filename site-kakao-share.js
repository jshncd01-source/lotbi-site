import {CORE_ORIGIN} from './site-core.js?v=aset-fce93bf7bd86';

let sdkPromise;

function configuredSdk(navigation) {
  const sdkUrl = String(navigation?.kakao_javascript_sdk_url || '');
  const javascriptKey = String(navigation?.kakao_javascript_key || '');
  if (
    !javascriptKey
    || !/^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao(?:\.min)?\.js$/u.test(sdkUrl)
  ) throw new Error('KAKAO_SHARE_NOT_CONFIGURED');
  return {sdkUrl, javascriptKey};
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
    script.addEventListener('error', () => reject(new Error('KAKAO_SDK_LOAD_FAILED')), {once: true});
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function shareWithKakaoTalk({text, url}) {
  const response = await fetch(`${CORE_ORIGIN}/app/config.json`, {
    headers: {Accept: 'application/json'},
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('KAKAO_SHARE_CONFIG_UNAVAILABLE');
  const {sdkUrl, javascriptKey} = configuredSdk((await response.json())?.navigation);
  const Kakao = await loadSdk(sdkUrl);
  if (!Kakao?.Share?.sendDefault || typeof Kakao.init !== 'function') throw new Error('KAKAO_SHARE_SDK_INVALID');
  if (typeof Kakao.isInitialized !== 'function' || !Kakao.isInitialized()) Kakao.init(javascriptKey);
  await Kakao.Share.sendDefault({
    objectType: 'text',
    text: String(text || 'LOTBI에서 공유한 내용입니다.').slice(0, 200),
    link: {mobileWebUrl: url, webUrl: url},
    buttonTitle: 'LOTBI 열기',
  });
}
