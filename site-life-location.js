// LIFE-PUBLIC-DATA-01 — 생활 공공정보 조회("근처 동물병원", "지금 문 연 약국",
// "근처 응급실")에만 붙이는 대략적 위치 문맥.
//
// 두 번째 위치 시스템이 아니다. 좌표는 공통 위치 계층(site-current-location.js)
// 에서만 얻고, 정책도 그대로 따른다:
//   1) 위치 사용이 켜져 있고 권한이 허용(또는 사용자가 지금 이 요청으로 허용)이면 현재 위치
//   2) 거부·사용 불가·시간 초과면 사용자가 저장해 둔 지역(캘린더 날씨 지역)
//   3) 그것도 없으면 아무것도 보내지 않는다 — Core 가 지역을 되묻는다.
// 좌표는 소수 셋째 자리(약 100m)로 반올림해 이 한 번의 요청에만 싣는다. 이 모듈은
// 아무것도 저장하지 않는다.
import {resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-1e7c7296a20b';
import {isLocationUsageEnabled} from './site-location-preference.js?v=aset-1e7c7296a20b';
import {readCalendarManualWeatherRegion} from './site-calendar-weather-region.js?v=aset-1e7c7296a20b';

const LIFE_TARGET_RE = /(?:동물\s*병원|애견\s*병원|약국|병원|의원|응급실|응급\s*의료|소아\s*청소년과|소아과|내과|이비인후과|치과|피부과|정형외과|안과|산부인과|달빛\s*어린이)/u;
const LIFE_NEARBY_RE = /(?:근처|주변|부근|인근|가까운|가까이|내\s*위치|우리\s*동네|여기)/u;
const LIFE_TIME_RE = /(?:지금|현재|당장|문\s*(?:연|열린|여는)|야간|심야|밤|새벽|일요일|토요일|주말|공휴일|휴일|연휴|24\s*시|응급실)/u;
const LABEL_UNSAFE_RE = /[^0-9A-Za-z가-힣·.\- ]/gu;
// ONNURI-MERCHANT-01: an 온누리상품권 merchant question is answered nearest-first
// when no region is named, so it carries the same coarse location. "온누리약국"
// and similar shop names are not voucher questions.
const ONNURI_RE = /온누리(?!\s*(?:약국|교회|병원|의원|한의원|치과|안과|마트|아파트|빌딩|타워|센터|호텔))/u;
const ONNURI_CUE_RE = /(?:상품권|가맹|되는|돼|가능|사용|쓸\s*수|결제|받는|취급)/u;
const ONNURI_ANSWER_HEADER = '**온누리상품권 가맹점**';
const ONNURI_FOLLOW_UP_RE = /(?:가까운|가장|제일|근처|주변|길\s*찾기|길\s*안내|더\s*보여|\d+\s*곳|모바일|디지털|지류|카드|식당|카페|번째)/u;

export const LIFE_LOCATION_SOURCE = Object.freeze({
  CURRENT: 'BROWSER_CURRENT',
  SAVED_REGION: 'SAVED_REGION',
});

export function onnuriLocationIntent(text, recentContext = []) {
  const value = typeof text === 'string' ? text : '';
  if (!value) return false;
  if (ONNURI_RE.test(value) && ONNURI_CUE_RE.test(value)) return true;
  // A short follow-up right after an Onnuri answer ("가까운 2곳", "그중 가장 가까운 곳 길찾기").
  const last = Array.isArray(recentContext)
    ? [...recentContext].reverse().find(item => item && item.role === 'assistant')
    : null;
  return Boolean(last && typeof last.text === 'string' && last.text.startsWith(ONNURI_ANSWER_HEADER)
    && value.length <= 60 && ONNURI_FOLLOW_UP_RE.test(value));
}

export function lifeLocationIntent(text, recentContext = []) {
  const value = typeof text === 'string' ? text : '';
  if (!value) return false;
  if (onnuriLocationIntent(value, recentContext)) return true;
  if (!LIFE_TARGET_RE.test(value)) return false;
  return LIFE_NEARBY_RE.test(value) || LIFE_TIME_RE.test(value);
}

function round3(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function inKorea(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 31 && latitude <= 44.5 && longitude >= 122 && longitude <= 132.5;
}

export function savedRegionLabel(label) {
  const clean = String(label || '').replace(LABEL_UNSAFE_RE, ' ').replace(/\s+/gu, ' ').trim();
  if (clean.length <= 40) return clean;
  // Keep the most specific tail ("… 전주시 완산구"), cut at a word boundary.
  const words = clean.split(' ');
  while (words.length > 1 && words.join(' ').length > 40) words.shift();
  return words.join(' ').slice(0, 40).trim();
}

function timeout(ms) {
  return new Promise(resolve => { setTimeout(() => resolve(null), ms); });
}

export async function resolveLifeLocationContext(text, {
  resolveCurrent = resolveSharedBrowserCurrentLocation,
  readSavedRegion = readCalendarManualWeatherRegion,
  locationUsageEnabled = isLocationUsageEnabled,
  timeoutMs = 8_000,
  recentContext = [],
} = {}) {
  if (!lifeLocationIntent(text, recentContext)) return null;
  let usageEnabled = false;
  try { usageEnabled = locationUsageEnabled() === true; } catch { usageEnabled = false; }
  if (usageEnabled) {
    try {
      // The user just asked for something "nearby"/"now": that request is the
      // explicit action that may show the browser's permission prompt.
      const outcome = await Promise.race([resolveCurrent({allowPrompt: true}), timeout(timeoutMs)]);
      const location = outcome?.location;
      const latitude = Number(location?.latitude);
      const longitude = Number(location?.longitude);
      if (inKorea(latitude, longitude)) {
        return Object.freeze({
          latitude: round3(latitude),
          longitude: round3(longitude),
          source: LIFE_LOCATION_SOURCE.CURRENT,
        });
      }
    } catch {
      // Fall through to the saved region.
    }
  }
  let saved = null;
  try { saved = readSavedRegion(); } catch { saved = null; }
  const latitude = Number(saved?.latitude);
  const longitude = Number(saved?.longitude);
  const label = savedRegionLabel(saved?.label);
  if (!saved || !label || !inKorea(latitude, longitude)) return null;
  return Object.freeze({
    latitude: round3(latitude),
    longitude: round3(longitude),
    source: LIFE_LOCATION_SOURCE.SAVED_REGION,
    label,
  });
}
