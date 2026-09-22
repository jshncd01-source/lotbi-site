const STORAGE_KEY = 'lotbi.calendar.weather-region.v1';

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const midRegionCode = typeof value.midRegionCode === 'string' && value.midRegionCode.trim()
    ? value.midRegionCode.trim().toUpperCase()
    : null;
  if (
    !label
    || label.length > 80
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < 31
    || latitude > 44.5
    || longitude < 122
    || longitude > 132.5
    || (midRegionCode !== null && !/^[A-Z0-9]{1,16}$/.test(midRegionCode))
  ) return null;
  return Object.freeze({label, latitude, longitude, midRegionCode});
}

export function readCalendarManualWeatherRegion(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCalendarManualWeatherRegion(region, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalize(region);
  if (!normalized) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearCalendarManualWeatherRegion(storage = globalThis.localStorage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Calendar remains usable if preference cleanup cannot be persisted.
  }
}
