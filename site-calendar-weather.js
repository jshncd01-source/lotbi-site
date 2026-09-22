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
  if (Number.isFinite(item.temperature)) return `${Math.round(item.temperature)}°`;
  const hasMin = Number.isFinite(item.minTemperature);
  const hasMax = Number.isFinite(item.maxTemperature);
  if (hasMin && hasMax) return `${Math.round(item.minTemperature)}° / ${Math.round(item.maxTemperature)}°`;
  if (hasMax) return `${Math.round(item.maxTemperature)}°`;
  if (hasMin) return `${Math.round(item.minTemperature)}°`;
  return '';
}
