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
    const numberOrNull = value => value === null || value === undefined ? null : Number(value);
    const temperature = numberOrNull(raw.temperature_c);
    const minimum = numberOrNull(raw.min_temperature_c);
    const maximum = numberOrNull(raw.max_temperature_c);
    const precipitation = numberOrNull(raw.precipitation_probability);
    const freshness = String(raw.freshness || '');
    if (
      [temperature, minimum, maximum].some(value => value !== null && !Number.isFinite(value))
      || (precipitation !== null && (!Number.isInteger(precipitation) || precipitation < 0 || precipitation > 100))
      || freshness !== 'CACHE_VALID'
    ) {
      throw new TypeError('invalid Calendar weather measurement metadata');
    }
    items.push(Object.freeze({
      date,
      weatherKind: kind,
      weatherIcon: icon,
      source: String(raw.source),
      issuedAt: String(raw.issued_at),
      temperature,
      minTemperature: minimum,
      maxTemperature: maximum,
      precipitationProbability: precipitation,
      freshness,
      label: WEATHER_LABELS[kind],
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


export function normalizeCalendarWeatherRegions(payload) {
  if (!payload || typeof payload !== 'object' || payload.ai_calls !== 0 || !Array.isArray(payload.items)) {
    throw new TypeError('invalid Calendar weather region response');
  }
  const seen = new Set();
  const items = payload.items.map(raw => {
    if (!raw || typeof raw !== 'object') throw new TypeError('invalid Calendar weather region');
    const code = String(raw.code || '').trim().toUpperCase();
    const label = String(raw.label || '').trim();
    if (!/^KR_[A-Z0-9_]{2,24}$/.test(code) || !label || label.length > 40 || seen.has(code)) {
      throw new TypeError('invalid Calendar weather region');
    }
    seen.add(code);
    return Object.freeze({code, label});
  });
  return Object.freeze({items: Object.freeze(items), aiCalls: 0});
}

export function weatherTemperatureLabel(item) {
  if (!item || typeof item !== 'object') return '';
  if (Number.isFinite(item.temperature)) return `${Math.round(item.temperature)}°`;
  if (Number.isFinite(item.maxTemperature) && Number.isFinite(item.minTemperature)) {
    return `${Math.round(item.maxTemperature)}° / ${Math.round(item.minTemperature)}°`;
  }
  if (Number.isFinite(item.maxTemperature)) return `${Math.round(item.maxTemperature)}°`;
  if (Number.isFinite(item.minTemperature)) return `${Math.round(item.minTemperature)}°`;
  return '';
}
