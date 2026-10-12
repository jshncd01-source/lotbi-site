import {CORE_ORIGIN} from './site-core.js?v=aset-adfbcd3370ef';

const SAFE_SHARE_URL = 'https://lotbiai.com/';
let sdkPromise;

export function safeShareSummary(value, {maxLength = 180} = {}) {
  const text = String(value || '')
    .replace(/https?:\/\/\S+/giu, '')
    .replace(/(?:access_token|refresh_token|session|authorization|code)\s*[=:]\s*\S+/giu, '[보안 정보 제외]')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!text) return 'LOTBI에서 확인한 내용입니다.';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function loadScript(src, documentRef) {
  return new Promise((resolve, reject) => {
    const existing = documentRef.querySelector('script[data-lotbi-kakao-sdk="true"]');
    if (existing?.dataset.loaded === 'true') { resolve(); return; }
    if (existing) {
      existing.addEventListener('load', resolve, {once: true});
      existing.addEventListener('error', () => reject(new Error('KAKAO_SDK_LOAD_FAILED')), {once: true});
      return;
    }
    const script = documentRef.createElement('script');
    script.src = src;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.dataset.lotbiKakaoSdk = 'true';
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, {once: true});
    script.addEventListener('error', () => reject(new Error('KAKAO_SDK_LOAD_FAILED')), {once: true});
    documentRef.head.appendChild(script);
  });
}

async function kakaoSdk({fetchRef = fetch, documentRef = document, globalRef = globalThis} = {}) {
  if (globalRef.Kakao?.Share?.sendDefault) return globalRef.Kakao;
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const response = await fetchRef(`${CORE_ORIGIN}/app/config.json`, {
        headers: {Accept: 'application/json'},
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('KAKAO_CONFIG_UNAVAILABLE');
      const config = await response.json();
      const navigation = config?.navigation;
      const sdkUrl = String(navigation?.kakao_javascript_sdk_url || '');
      const javascriptKey = String(navigation?.kakao_javascript_key || '');
      if (
        navigation?.kakao_navi_ready !== true
        || !javascriptKey
        || !/^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao(?:\.min)?\.js$/u.test(sdkUrl)
      ) throw new Error('KAKAO_SHARE_NOT_CONFIGURED');
      await loadScript(sdkUrl, documentRef);
      const Kakao = globalRef.Kakao;
      if (!Kakao?.Share?.sendDefault || typeof Kakao.init !== 'function') throw new Error('KAKAO_SHARE_SDK_INVALID');
      if (typeof Kakao.isInitialized !== 'function' || !Kakao.isInitialized()) Kakao.init(javascriptKey);
      return Kakao;
    })().catch(error => { sdkPromise = undefined; throw error; });
  }
  return sdkPromise;
}

export async function shareToKakao(text, dependencies = {}) {
  const Kakao = await kakaoSdk(dependencies);
  Kakao.Share.sendDefault({
    objectType: 'text',
    text: safeShareSummary(text),
    link: {mobileWebUrl: SAFE_SHARE_URL, webUrl: SAFE_SHARE_URL},
    buttonTitle: 'LOTBI에서 보기',
  });
  return 'kakao';
}

export {SAFE_SHARE_URL};
