export const CALENDAR_WEATHER_PREFERENCE_KEY = 'lotbi.calendar.weather.preference.v1';

const DEFAULT_PREFERENCE = Object.freeze({enabled: true, manualRegionCode: ''});

function normalizedPreference(value) {
  if (!value || typeof value !== 'object') return DEFAULT_PREFERENCE;
  const enabled = value.enabled !== false;
  const manualRegionCode = typeof value.manualRegionCode === 'string'
    ? value.manualRegionCode.trim().toUpperCase()
    : '';
  if (manualRegionCode && !/^KR_[A-Z0-9_]{2,24}$/.test(manualRegionCode)) {
    return Object.freeze({enabled, manualRegionCode: ''});
  }
  return Object.freeze({enabled, manualRegionCode});
}

export function readCalendarWeatherPreference(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(CALENDAR_WEATHER_PREFERENCE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== 1) return DEFAULT_PREFERENCE;
    return normalizedPreference(payload);
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function writeCalendarWeatherPreference(preference, storage = globalThis.localStorage) {
  const value = normalizedPreference(preference);
  try {
    storage?.setItem?.(CALENDAR_WEATHER_PREFERENCE_KEY, JSON.stringify({
      version: 1,
      enabled: value.enabled,
      manualRegionCode: value.manualRegionCode,
    }));
  } catch {
    // Preference persistence is fail-soft; Calendar remains usable.
  }
  return value;
}
