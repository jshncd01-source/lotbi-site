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

// NEARBY-LOCATION-ALLOW-PROMPT-01 — a region the person picked on a PC
// (지역 고르기) is saved the way Calendar saves its own manual pick: the
// region (its list name and the list's own coordinates) and MANUAL as where
// it came from, so Calendar keeps it rather than replacing it with a current
// location, and every 지역정보 lookup uses it next time.
const ORIGIN_STORAGE_KEY = 'lotbi.calendar.weather-region-origin.v1';

export function readCalendarWeatherRegionOrigin(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(ORIGIN_STORAGE_KEY);
    return raw === 'MANUAL' || raw === 'CURRENT_LOCATION' ? raw : null;
  } catch {
    return null;
  }
}

export function saveChosenWeatherRegion(region, storage = globalThis.localStorage) {
  if (!writeCalendarManualWeatherRegion(region, storage)) return false;
  try {
    storage.setItem(ORIGIN_STORAGE_KEY, 'MANUAL');
  } catch {
    // The region itself is saved; Calendar then reads it as a manual one.
  }
  return true;
}

export function clearCalendarManualWeatherRegion(storage = globalThis.localStorage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Calendar remains usable if preference cleanup cannot be persisted.
  }
}
