import {CORE_ORIGIN} from './site-core.js?v=aset-e0fa689a8f1e';

const status = document.getElementById('status');
const launch = document.getElementById('launch');
const fallback = document.getElementById('fallback');

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

function kakaoMapsDirectionsUrl(destination) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(destination.name)},${destination.y},${destination.x}`;
}

async function prepare() {
  const destination = destinationFromLocation();
  if (!destination) throw new Error('DESTINATION_INVALID');
  fallback.href = kakaoMapsDirectionsUrl(destination);
  fallback.hidden = false;
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
  status.textContent = fallback.hidden
    ? '목적지를 확인하지 못했어요. LOTBI 장소검색으로 돌아가 주세요.'
    : '카카오내비를 바로 열지 못했어요. 아래 카카오맵 웹 길찾기로 계속할 수 있어요.';
});
