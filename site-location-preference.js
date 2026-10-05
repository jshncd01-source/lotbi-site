// A shared display/usage preference, never a credential or a stored position.
// Account and Site share only this on/off value; browser permission stays per origin.
export const LOCATION_USAGE_COOKIE = 'lotbi_location_usage_v1';
export const LOCATION_USAGE_EVENT = 'lotbi:location-usage-change';

export function readLocationUsagePreference(cookieHeader = '') {
  const matches = cookieHeader.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${LOCATION_USAGE_COOKIE}=`));
  // Preserve the existing permission-first behavior until a choice is made.
  if (!matches.length) return true;
  return matches.length === 1 && matches[0] === `${LOCATION_USAGE_COOKIE}=on`;
}

export function isLocationUsageEnabled() {
  try { return readLocationUsagePreference(globalThis.document?.cookie ?? ''); }
  catch { return false; }
}

export function serializeLocationUsagePreference(enabled, hostname, protocol) {
  const production = hostname === 'lotbiai.com' || hostname === 'account.lotbiai.com';
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if ((!production && !local) || (production && protocol !== 'https:')) throw new Error('Unsupported preference origin');
  return `${LOCATION_USAGE_COOKIE}=${enabled ? 'on' : 'off'}; Path=/; SameSite=Lax; Max-Age=31536000${production ? '; Domain=lotbiai.com; Secure' : ''}`;
}

export function setLocationUsageEnabled(enabled) {
  const value = Boolean(enabled);
  document.cookie = serializeLocationUsagePreference(value, location.hostname, location.protocol);
  const saved = document.cookie.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${LOCATION_USAGE_COOKIE}=`));
  if (saved.length !== 1 || saved[0] !== `${LOCATION_USAGE_COOKIE}=${value ? 'on' : 'off'}`) {
    throw new Error('Location preference could not be saved');
  }
  window.dispatchEvent(new CustomEvent(LOCATION_USAGE_EVENT, {detail: {enabled: value}}));
}
