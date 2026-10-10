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
import {LOTBI_BOX_UI_ENABLED} from './site-feature-flags.js?v=aset-0716333c2f93';

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

// LIFE-WALLET-SHARE-01: a share link opened from KakaoTalk, a messenger or a phone camera
// (#wallet-share=qr.<token> | #wallet-share=invite.<token>) is kept for this tab and the
// address becomes #wallet, so the wallet opens and — after any login round trip — picks it
// up (site-life-wallet-share.js). The token never stays in the address or history.
const WALLET_SHARE_INTENT_KEY = 'lotbi.wallet-share-intent';
const WALLET_SHARE_INTENT_RE = /^#wallet-share=(qr|invite)\.([A-Za-z0-9_-]{24,64})$/u;
const WALLET_SHARE_INTENT_TTL_MS = 30 * 60_000;

export function captureWalletShareIntent(locationRef = window.location, historyRef = window.history, storage = globalThis.sessionStorage) {
  const match = WALLET_SHARE_INTENT_RE.exec(locationRef.hash || '');
  if (!match) return false;
  try { storage?.setItem(WALLET_SHARE_INTENT_KEY, JSON.stringify({kind: match[1], token: match[2], at: Date.now()})); } catch {}
  historyRef.replaceState(historyRef.state, '', `${locationRef.pathname}${locationRef.search}${siteRouteHash('wallet')}`);
  return true;
}

export function takeWalletShareIntent(storage = globalThis.sessionStorage) {
  let intent = null;
  try {
    intent = JSON.parse(storage?.getItem(WALLET_SHARE_INTENT_KEY) || 'null');
    storage?.removeItem(WALLET_SHARE_INTENT_KEY);
  } catch {}
  if (!intent || !['qr', 'invite'].includes(intent.kind) || typeof intent.token !== 'string' || Date.now() - Number(intent.at) > WALLET_SHARE_INTENT_TTL_MS) return null;
  return {kind: intent.kind, token: intent.token};
}

export function hasWalletShareIntent(storage = globalThis.sessionStorage) {
  try { return Boolean(storage?.getItem(WALLET_SHARE_INTENT_KEY)); } catch { return false; }
}
