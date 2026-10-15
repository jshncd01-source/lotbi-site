const title = document.getElementById('title');
const status = document.getElementById('status');
const launch = document.getElementById('launch');
const fallback = document.getElementById('fallback');

function readHandoff(locationRef = globalThis.location) {
  const params = new URLSearchParams(locationRef.search);
  const provider = params.get('provider');
  const native = params.get('native') || '';
  const fallbackUrl = new URL(params.get('fallback') || '/', locationRef.origin);
  const expectedScheme = provider === 'NAVER_MAP' ? 'nmap://' : provider === 'TMAP' ? 'tmap://' : '';
  if (!expectedScheme || !native.startsWith(expectedScheme)) throw new Error('NATIVE_URI_INVALID');
  if (fallbackUrl.protocol !== 'https:' || fallbackUrl.hostname !== 'map.naver.com') throw new Error('FALLBACK_URI_INVALID');
  return Object.freeze({provider, native, fallbackUrl: fallbackUrl.href});
}

try {
  const handoff = readHandoff();
  const providerName = handoff.provider === 'NAVER_MAP' ? '네이버지도' : '티맵';
  title.textContent = `${providerName}로 연결할게요`;
  status.textContent = '앱이 열리지 않으면 아래 웹 지도에서 같은 장소를 계속 확인할 수 있어요.';
  launch.textContent = `${providerName} 앱 열기`;
  launch.href = handoff.native;
  launch.hidden = false;
  fallback.href = handoff.fallbackUrl;
  fallback.hidden = false;
} catch {
  status.textContent = '연결 주소를 확인하지 못했어요. LOTBI 장소검색으로 돌아가 주세요.';
}
