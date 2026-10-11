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
import {LOTBI_BOX_UI_ENABLED, TRAFFIC_CCTV_UI_ENABLED} from './site-feature-flags.js?v=aset-dfcf8fc51f25';

export const SITE_ROUTES = Object.freeze([
  'calendar',
  'wallet',
  'scam',
  'care',
  'pets',
  'life',
  // REGIONAL-INFO-BACK-NAVIGATION-01: the screens inside 지역정보 — 병원·응급실,
  // 지역뉴스, 지역생활정보, 내 아이 학교·유치원 (back → life) and, signed out,
  // its 학교·유치원 찾기 (back → life-my-child) — so back steps one screen at a
  // time and a reload reopens the same one (LIFE_VIEW_PARENT,
  // site-consumer-sections.js).
  'life-medical',
  'life-news',
  'life-local',
  'life-my-child',
  'life-education',
  // TRAFFIC-CCTV P0: 지역정보 → 실시간 도로 CCTV (back → life); no route while
  // the switch is off, so #traffic-cctv is not a screen at all.
  ...(TRAFFIC_CCTV_UI_ENABLED ? ['traffic-cctv'] : []),
  'festival',
  // 지역정보 → 온누리상품권·지역화폐 (back → life). It used to share 'life', so
  // the system back from it left 지역정보 for the home.
  'onnuri',
  // REAL-ESTATE-REGION-FAVORITES-P0: 지역정보 → 부동산 실거래가 (back → life) and
  // one apartment's contracts inside it (back → real-estate).
  'real-estate',
  'real-estate-apartment',
  // EV-CHARGER-NEARBY-LIST-P0: 지역정보 → 전기차 충전소 (back → life).
  'ev-chargers',
  // SUBWAY-LIFE-INFO-P0: 지역정보 → 지하철 정보 (back → life) → one station
  // (back → subway). The station a 'subway-station' entry shows lives in that
  // history entry's state, so reload and back/forward reopen the same one.
  'subway',
  'subway-station',
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

// FAMILY-LOCATION-01: a 가족 위치 invitation (#family-invite=<token>) works the same way: kept for
// this tab only (30 minutes), the address becomes #care, and the 가족 위치 tab — shown only when
// Core's switch is on — picks it up after any login round trip (site-family-location-ui.js).
const FAMILY_INVITE_INTENT_KEY = 'lotbi.family-invite-intent';
const FAMILY_INVITE_INTENT_RE = /^#family-invite=([A-Za-z0-9_-]{24,64})$/u;
const FAMILY_INVITE_INTENT_TTL_MS = 30 * 60_000;

export function captureFamilyInviteIntent(locationRef = window.location, historyRef = window.history, storage = globalThis.sessionStorage) {
  const match = FAMILY_INVITE_INTENT_RE.exec(locationRef.hash || '');
  if (!match) return false;
  try { storage?.setItem(FAMILY_INVITE_INTENT_KEY, JSON.stringify({token: match[1], at: Date.now()})); } catch {}
  historyRef.replaceState(historyRef.state, '', `${locationRef.pathname}${locationRef.search}${siteRouteHash('care')}`);
  return true;
}

export function takeFamilyInviteIntent(storage = globalThis.sessionStorage) {
  let intent = null;
  try {
    intent = JSON.parse(storage?.getItem(FAMILY_INVITE_INTENT_KEY) || 'null');
    storage?.removeItem(FAMILY_INVITE_INTENT_KEY);
  } catch {}
  if (!intent || typeof intent.token !== 'string' || !/^[A-Za-z0-9_-]{24,64}$/u.test(intent.token)
    || Date.now() - Number(intent.at) > FAMILY_INVITE_INTENT_TTL_MS) return null;
  return {token: intent.token};
}

export function hasFamilyInviteIntent(storage = globalThis.sessionStorage) {
  try { return Boolean(storage?.getItem(FAMILY_INVITE_INTENT_KEY)); } catch { return false; }
}
