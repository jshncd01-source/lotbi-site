import {CORE_ORIGIN} from './site-core.js?v=aset-22e94d056369';

const status = document.getElementById('status');
const launch = document.getElementById('launch');

function destinationFromLocation(locationRef = globalThis.location) {
  const params = new URLSearchParams(locationRef.search);
  const name = String(params.get('name') || '').trim().slice(0, 120);
  const x = Number(params.get('x'));
  const y = Number(params.get('y'));
  if (
    !name
    || !Number.isFinite(x) || x < 122.37 || x > 132
    || !Number.isFinite(y) || y < 31.43 || y > 44.35
    || params.get('coordType') !== 'wgs84'
  ) return null;
  return Object.freeze({name, x, y, coordType: 'wgs84'});
}

function loadScript(src, documentRef = document) {
  return new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = src;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.addEventListener('load', resolve, {once: true});
    script.addEventListener('error', () => reject(new Error('KAKAO_SDK_LOAD_FAILED')), {once: true});
    documentRef.head.appendChild(script);
  });
}

async function prepare() {
  const destination = destinationFromLocation();
  if (!destination) throw new Error('DESTINATION_INVALID');
  const response = await fetch(`${CORE_ORIGIN}/app/config.json`, {
    headers: {Accept: 'application/json'},
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('CONFIG_UNAVAILABLE');
  const config = await response.json();
  const navigation = config?.navigation;
  const sdkUrl = String(navigation?.kakao_javascript_sdk_url || '');
  const javascriptKey = String(navigation?.kakao_javascript_key || '');
  if (
    navigation?.kakao_navi_ready !== true
    || !javascriptKey
    || !/^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao(?:\.min)?\.js$/u.test(sdkUrl)
  ) throw new Error('KAKAO_NAVI_NOT_CONFIGURED');

  await loadScript(sdkUrl);
  const Kakao = globalThis.Kakao;
  if (!Kakao?.Navi?.start || typeof Kakao.init !== 'function') throw new Error('KAKAO_SDK_INVALID');
  if (typeof Kakao.isInitialized !== 'function' || !Kakao.isInitialized()) Kakao.init(javascriptKey);

  launch.hidden = false;
  launch.addEventListener('click', () => {
    status.textContent = '카카오내비 앱을 여는 중이에요.';
    Kakao.Navi.start(destination);
  });
  status.textContent = `${destination.name} 길안내를 준비했어요.`;
}

prepare().catch(() => {
  launch.hidden = true;
  status.textContent = '지금은 카카오내비 연결을 준비하지 못했어요. LOTBI로 돌아가 다시 시도해 주세요.';
});
