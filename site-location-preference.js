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
