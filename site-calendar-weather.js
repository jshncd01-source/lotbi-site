const WEATHER_ICONS = Object.freeze({
  CLEAR: '☀️',
  CLOUDY: '☁️',
  RAIN: '🌧️',
  SNOW: '❄️',
});

const WEATHER_LABELS = Object.freeze({
  CLEAR: '맑음',
  CLOUDY: '흐림',
  RAIN: '비',
  SNOW: '눈',
});

const FRESHNESS_VALUES = Object.freeze(['CACHE_VALID', 'LIVE', 'STALE']);

// Core sends the measurements as nullable fields. Absent is normal: a forecast
// date the provider did not cover, or an older Core that predates them. Only a
// value that is present and not a finite number is a contract violation.
function measurement(value) {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new TypeError('invalid Calendar weather measurement');
  return numeric;
}

function precipitation(value) {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
    throw new TypeError('invalid Calendar weather precipitation probability');
  }
  return numeric;
}

export function normalizeCalendarWeatherResponse(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.provider_ready !== 'boolean' || !Array.isArray(payload.items) || payload.ai_calls !== 0) {
    throw new TypeError('invalid Calendar weather response');
  }
  const items = [];
  for (const raw of payload.items) {
    if (!raw || typeof raw !== 'object') throw new TypeError('invalid Calendar weather item');
    const kind = String(raw.weather_kind || '');
    const icon = String(raw.weather_icon || '');
    const date = String(raw.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Object.hasOwn(WEATHER_ICONS, kind) || icon !== WEATHER_ICONS[kind]) {
      throw new TypeError('invalid Calendar weather item');
    }
    if (!['KMA_SHORT', 'KMA_MID'].includes(String(raw.source || '')) || !Number.isFinite(Date.parse(String(raw.issued_at || '')))) {
      throw new TypeError('invalid Calendar weather source metadata');
    }
    const temperature = measurement(raw.temperature_c);
    const minTemperature = measurement(raw.min_temperature_c);
    const maxTemperature = measurement(raw.max_temperature_c);
    const freshness = raw.freshness === undefined || raw.freshness === null
      ? 'CACHE_VALID'
      : String(raw.freshness);
    if (!FRESHNESS_VALUES.includes(freshness)) {
      throw new TypeError('invalid Calendar weather freshness');
    }
    items.push(Object.freeze({
      date,
      weatherKind: kind,
      weatherIcon: icon,
      source: String(raw.source),
      issuedAt: String(raw.issued_at),
      label: WEATHER_LABELS[kind],
      temperature,
      minTemperature,
      maxTemperature,
      precipitationProbability: precipitation(raw.precipitation_probability),
      freshness,
    }));
  }
  return Object.freeze({
    providerReady: payload.provider_ready,
    items: Object.freeze(items),
    aiCalls: 0,
  });
}

export function calendarWeatherByDate(items) {
  const out = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item.date !== 'string' || !WEATHER_ICONS[item.weatherKind]) continue;
    out.set(item.date, item);
  }
  return out;
}

// Presentation helper so every surface formats the same measurement the same
// way. Where the temperature is placed in the Calendar is the Calendar design
// owner's call; this only decides what the text says.
export function weatherTemperatureLabel(item) {
  if (!item || typeof item !== 'object') return '';
  const hasMin = Number.isFinite(item.minTemperature);
  const hasMax = Number.isFinite(item.maxTemperature);
  if (hasMin && hasMax) return `${Math.round(item.minTemperature)}° / ${Math.round(item.maxTemperature)}°`;
  if (hasMax) return `${Math.round(item.maxTemperature)}°`;
  if (hasMin) return `${Math.round(item.minTemperature)}°`;
  if (Number.isFinite(item.temperature)) return `${Math.round(item.temperature)}°`;
  return '';
}

// 강수확률. Core가 보내오는 값은 이미 계약으로 검증돼 있었지만(정규화 함수의
// precipitation()), 그 값을 화면에 쓰는 곳이 없어서 있는 데이터가 안 보이고
// 있었다("코어에 강수확률 넣었는데 왜 표시가 안 되나요?"). 0%는 "비 안 옴"
// 이지 "정보 없음"이 아니라서 굳이 보여줄 필요가 없다 — 흐림/맑음이 대부분인
// 날에 매 칸마다 "0%"가 뜨면 날씨보다 강수확률이 더 크게 읽힌다. 실제로
// 비/눈이 올 가능성이 있는 날만 표시한다.
export function weatherPrecipitationLabel(item) {
  const value = item?.precipitationProbability;
  if (!Number.isFinite(value) || value <= 0) return '';
  return `💧${value}%`;
}

// 기상청 예보는 공공누리 제1유형으로 개방된 공공저작물이고, 제1유형의 유일한
// 이용조건이 출처표시다. 공공누리는 출처표시를 "유형마크를 붙이는 것"이 아니라
// 제공 기관과 출처를 적는 것으로 정의하고, 기관명만 적는 간략 표기도 인정한다.
// 근거: https://www.kogl.or.kr/info/licenseType1.do
//
// 단기(KMA_SHORT)와 중기(KMA_MID)를 나눠 적지 않는다. 두 예보의 저작권자는 모두
// 기상청이라 한 줄로 이미 의무를 충족하고, 나누면 표기가 날씨 자체보다 커진다.
const ATTRIBUTION_SOURCES = Object.freeze(['KMA_SHORT', 'KMA_MID']);
export const WEATHER_PROVIDER_NAME = '기상청';
export const WEATHER_LICENSE_NAME = '공공누리 제1유형';

function issuedTimeLabel(issuedAt, timezone) {
  const at = new Date(String(issuedAt));
  if (!Number.isFinite(at.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(at);
  } catch {
    return '';
  }
}

export function calendarWeatherAttribution(items, {timezone = 'Asia/Seoul'} = {}) {
  const sourced = (Array.isArray(items) ? items : []).filter(
    item => item && ATTRIBUTION_SOURCES.includes(String(item.source || '')),
  );
  // 화면에 기상청 데이터가 한 칸도 없으면 출처도 없다. 본체 없이 표기만
  // 남아 있는 상태를 만들지 않는다.
  if (!sourced.length) return null;
  // 단기와 중기는 발표 시각이 서로 다르다. 섞여 있을 때 한쪽 시각을 전체의
  // 것처럼 적으면 틀린 말이 되므로, 전부 같을 때만 발표 시각을 붙인다.
  const issued = new Set(sourced.map(item => String(item.issuedAt || '')));
  const issuedLabel = issued.size === 1 ? issuedTimeLabel([...issued][0], timezone) : '';
  return Object.freeze({
    provider: WEATHER_PROVIDER_NAME,
    license: WEATHER_LICENSE_NAME,
    issuedLabel,
    // 대표님 지시로 화면 문구에서 라이선스 유형명을 뺐다 — 공공누리 제1유형의
    // 이용조건은 "출처표시"이고, 공공누리 스스로 기관명만 적는 간략 표기도
    // 인정하므로(위 주석의 근거 링크) 기관명만 남겨도 의무는 그대로 충족된다.
    text: issuedLabel
      ? `날씨 출처: ${WEATHER_PROVIDER_NAME} · ${issuedLabel} 발표`
      : `날씨 출처: ${WEATHER_PROVIDER_NAME}`,
  });
}

// 날씨 글리프. 대표님 지시로 커스텀 SVG를 버리고 Core가 보내는 weather_icon과
// 같은 실제 이모지(☀️/☁️/🌧️/❄️)를 그대로 쓴다. WEATHER_ICONS가 이미 전송
// 계약으로 검증된 값이므로 화면에도 같은 문자를 그대로 쓰면 그리는 코드와
// 검증하는 계약이 어긋날 일이 없다.
export function calendarWeatherIconNode(kind, doc = globalThis.document) {
  const glyph = WEATHER_ICONS[String(kind || '')];
  if (!glyph || !doc) return null;
  const span = doc.createElement('span');
  // 접근성 경로는 날짜 버튼의 aria-label(buildCalendarAriaLabel)이 이미 날씨를
  // 읽는다. 글리프가 한 번 더 읽히면 같은 말이 두 번 나온다.
  span.setAttribute('aria-hidden', 'true');
  span.className = 'calendar-weather-icon';
  span.dataset.weatherKind = String(kind);
  span.textContent = glyph;
  return span;
}
