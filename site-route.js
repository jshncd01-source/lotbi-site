// SITE-REFRESH-ROUTE-RESTORE-01 — canonical in-page routes of lotbiai.com.
//
// The Site is one document (/). 캘린더 · Life Wallet · 진위확인 · 안심케어 ·
// 생활정보 open as surfaces over the conversation, and none of them used to
// touch the URL, so a reload — and the Account round trip every signed-in
// reload takes — always came back to the conversation home.
//
// The fragment now names the screen that is open: /#calendar, /#wallet, ...
// A fragment never reaches the server, so nginx/Render routing is unchanged,
// and it rides the existing Account handoff the same way #profile-photo does.
// Route names are the identifiers the page already uses (data-consumer-section,
// data-scam-open, data-festival-open and the 안심케어 pets tab).
//
// This table is the only list of routes: the parser, the URL builder, the
// login return allowlist (site-auth.js) and the conversation's openers
// (site-conversation.js) all read it.
import {LOTBI_BOX_UI_ENABLED} from './site-feature-flags.js?v=aset-8f81dc83c912';

export const SITE_ROUTES = Object.freeze([
  'calendar',
  'wallet',
  'scam',
  'care',
  'pets',
  'life',
  'festival',
  ...(LOTBI_BOX_UI_ENABLED ? ['lotbi-box'] : []),
]);

const ROUTE_SET = new Set(SITE_ROUTES);

// '' → the conversation home (no fragment). A route name → that screen.
// null → a fragment that is not a route (#profile-photo, #main-content, a typo);
// callers leave it alone and show the home, as before.
export function parseSiteRouteHash(hash) {
  const value = typeof hash === 'string' ? hash : '';
  if (value === '' || value === '#') return '';
  const name = value.startsWith('#') ? value.slice(1) : '';
  return ROUTE_SET.has(name) ? name : null;
}

export function isSiteRoute(name) {
  return typeof name === 'string' && ROUTE_SET.has(name);
}

export function siteRouteHash(name) {
  return isSiteRoute(name) ? `#${name}` : '';
}

// Same document path and query; only the fragment changes. One-time query
// intents (?conversation=, ?__lotbi_web=) are consumed by their owners before
// any route is written, so nothing here re-arms them.
export function siteRouteUrl(name, locationRef = window.location) {
  return `${locationRef.pathname}${locationRef.search}${siteRouteHash(name)}`;
}
