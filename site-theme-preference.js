// LOTBI-CONSUMER-THEME-SYNC-01 — 대표: "화면 모드는 Account 페이지 전용 설정이
// 아니다". The screen mode is one choice for every consumer page on lotbiai.com
// and account.lotbiai.com.
//
// Before this the two origins each kept their own copy — the Site in
// localStorage (lotbi.site.theme.bootstrap.v1), Account in a host-only
// __Host-lotbi_theme cookie plus its own localStorage for '자동모드' — and
// neither could read the other's, so a choice made in Account settings never
// reached the chat. Measured: Account dark, then "LOTBI로 돌아가기" painted the
// Site light on a light OS.
//
// The shared store is one cookie on the parent domain, the same pattern the
// location and default-map preferences already use. It is a display preference
// only: one of four fixed words, never an identifier, never combined with the
// session, and readable by the page (not HttpOnly) because the pre-paint
// bootstrap has to see it. The old per-origin stores are kept as read
// fallbacks for someone who has not been through the new code yet.
export const THEME_PREFERENCE_COOKIE = 'lotbi_theme_preference_v1';
// Set only when this origin imported its old stored value rather than the user
// choosing in this version. Account, which is where the screen mode is chosen,
// lets its own older explicit choice win over such an import.
export const THEME_IMPORT_COOKIE = 'lotbi_theme_preference_import_v1';
export const THEME_IMPORT_FROM_SITE = 'site';
export const THEME_PREFERENCES = Object.freeze(['light', 'dark', 'system', 'auto']);
export const THEME_PREFERENCE_EVENT = 'lotbi:theme-preference-change';
export const LEGACY_SITE_THEME_KEY = 'lotbi.site.theme.bootstrap.v1';

// '자동모드': 07:00 <= local time < 18:00 is light, everything else dark. The
// browser's clock, never a server's — someone at 23:00 sees dark wherever the
// page was rendered.
export const AUTO_THEME_LIGHT_HOUR = 7;
export const AUTO_THEME_DARK_HOUR = 18;

const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function isThemePreference(value) {
  return typeof value === 'string' && THEME_PREFERENCES.includes(value);
}

function cookieValues(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return [];
  return cookieHeader.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name}=`))
    .map(part => part.slice(name.length + 1));
}

// Exactly one known word, or nothing. Two copies that agree are one choice; two
// that disagree are ambiguous, and a display preference never takes a page down
// over that — the caller falls back instead.
export function readThemePreference(cookieHeader = '') {
  const values = cookieValues(cookieHeader, THEME_PREFERENCE_COOKIE);
  if (!values.length || values.some(value => value !== values[0])) return undefined;
  return isThemePreference(values[0]) ? values[0] : undefined;
}

export function readThemeImportMarker(cookieHeader = '') {
  return cookieValues(cookieHeader, THEME_IMPORT_COOKIE).includes(THEME_IMPORT_FROM_SITE)
    ? THEME_IMPORT_FROM_SITE
    : undefined;
}

export function resolveThemePreference(preference, now = new Date()) {
  if (preference === 'auto') {
    const hour = now.getHours();
    return hour >= AUTO_THEME_DARK_HOUR || hour < AUTO_THEME_LIGHT_HOUR ? 'dark' : 'light';
  }
  return preference === 'light' || preference === 'dark' ? preference : 'system';
}

// When the next '자동모드' switch is due, so a tab left open turns dark at 18:00
// instead of waiting for a reload. Always measured from the clock, so a machine
// that slept through a boundary corrects itself on the next tick.
export function millisecondsUntilNextThemeBoundary(now = new Date()) {
  const hour = now.getHours();
  const next = new Date(now.getTime());
  next.setMinutes(0, 0, 0);
  next.setHours(hour < AUTO_THEME_LIGHT_HOUR || hour >= AUTO_THEME_DARK_HOUR ? AUTO_THEME_LIGHT_HOUR : AUTO_THEME_DARK_HOUR);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Production shares the value across lotbiai.com and its subdomains; a local
// preview keeps it host-only. Any other origin is refused rather than guessed.
function cookieScope(hostname, protocol) {
  const production = hostname === 'lotbiai.com' || hostname === 'account.lotbiai.com';
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if ((!production && !local) || (production && protocol !== 'https:')) {
    throw new Error('Unsupported theme preference origin');
  }
  return production ? '; Domain=lotbiai.com; Secure' : '';
}

export function serializeThemePreference(preference, hostname, protocol) {
  if (!isThemePreference(preference)) throw new Error('Unsupported theme preference');
  return `${THEME_PREFERENCE_COOKIE}=${preference}; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${cookieScope(hostname, protocol)}`;
}

export function serializeThemeImportMarker(present, hostname, protocol) {
  const scope = cookieScope(hostname, protocol);
  return present
    ? `${THEME_IMPORT_COOKIE}=${THEME_IMPORT_FROM_SITE}; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${scope}`
    : `${THEME_IMPORT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${scope}`;
}

// One save path for every surface: write, then read back, so a blocked cookie is
// reported rather than silently leaving the two origins disagreeing.
export function writeThemePreference(documentRef, preference, {hostname, protocol, imported = false}) {
  documentRef.cookie = serializeThemePreference(preference, hostname, protocol);
  documentRef.cookie = serializeThemeImportMarker(imported, hostname, protocol);
  if (readThemePreference(documentRef.cookie) !== preference) throw new Error('Theme preference was not saved');
  return preference;
}
