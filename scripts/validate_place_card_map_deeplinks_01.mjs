import assert from 'node:assert/strict';
import * as navigation from '../site-navigation.js';

const {
  buildGoogleMapsDirectionsUrl,
  buildKakaoMapsDirectionsUrl,
  buildKakaoNaviHandoffUrl,
  buildKakaoNaviSdkPayload,
  buildNaverMapsAndroidIntentUri,
  buildNaverMapsMobileUri,
  buildNaverMapsWebSearchUrl,
  buildTmapAndroidIntentUri,
  buildTmapMobileUri,
  isTmapHandoffAvailable,
  openGoogleMapsPlace,
  openKakaoNaviPlace,
  openNaverMapsPlace,
  openTmapPlace,
  openDefaultMapPlace,
} = navigation;

const ANDROID = 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140 Safari/537.36';
const PLACE = Object.freeze({
  name: '선유도 리조트',
  address: '전북특별자치도 군산시 옥도면 선유북길 30',
  latitude: 35.8012345,
  longitude: 126.4567891,
  navigationCapable: true,
});

assert.match(buildNaverMapsMobileUri(PLACE), /^nmap:\/\/navigation\?/u);
assert.match(buildNaverMapsAndroidIntentUri(PLACE), /package=com\.nhn\.android\.nmap/u);
assert.match(buildNaverMapsWebSearchUrl(PLACE), /^https:\/\/map\.naver\.com\/p\/search\//u);

assert.deepEqual(buildKakaoNaviSdkPayload(PLACE), {
  name: PLACE.name,
  x: PLACE.longitude,
  y: PLACE.latitude,
  coordType: 'wgs84',
});
const kakaoUrl = buildKakaoNaviHandoffUrl(PLACE);
assert.match(kakaoUrl, /^https:\/\/lotbiai\.com\/kakao-navi\.html\?/u);
assert.match(kakaoUrl, /coordType=wgs84/u);
assert.equal(typeof buildKakaoMapsDirectionsUrl, 'function');
assert.equal(
  buildKakaoMapsDirectionsUrl(PLACE),
  'https://map.kakao.com/link/to/%EC%84%A0%EC%9C%A0%EB%8F%84%20%EB%A6%AC%EC%A1%B0%ED%8A%B8,35.8012345,126.4567891',
);

const tmap = buildTmapMobileUri(PLACE);
assert.match(tmap, /goalx=126\.4567891/u);
assert.match(tmap, /goaly=35\.8012345/u);
assert.match(buildTmapAndroidIntentUri(PLACE), /package=com\.skt\.tmap\.ku/u);

const google = buildGoogleMapsDirectionsUrl(PLACE);
assert.match(google, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/u);
assert.match(google, /destination=35\.8012345%2C126\.4567891/u);
assert.doesNotMatch(google, /(?:key|api_key|client_id)=/iu);

assert.equal(isTmapHandoffAvailable({userAgent: ANDROID}), true);
assert.equal(isTmapHandoffAvailable({userAgent: IPHONE}), true);
assert.equal(isTmapHandoffAvailable({userAgent: DESKTOP}), false);

function fakeWindow() {
  const calls = [];
  const children = [];
  return {
    calls,
    children,
    location: {href: 'https://lotbiai.com/'},
    open(uri, target, features) {
      calls.push([uri, target, features]);
      const child = {opener: {}, location: {href: uri}};
      children.push(child);
      return child;
    },
  };
}

for (const [open, options, mode] of [
  [openNaverMapsPlace, {userAgent: ANDROID}, 'NAVER_NAVIGATION_INTENT_NEW_TAB'],
  [openNaverMapsPlace, {userAgent: IPHONE}, 'NAVER_NAVIGATION_URL_SCHEME_NEW_TAB'],
  [openNaverMapsPlace, {userAgent: DESKTOP}, 'NAVER_WEB_SEARCH_NEW_TAB'],
  [openKakaoNaviPlace, {}, 'KAKAO_NAVI_OFFICIAL_SDK_NEW_TAB'],
  [openTmapPlace, {userAgent: ANDROID}, 'TMAP_ROUTE_INTENT_NEW_TAB'],
  [openTmapPlace, {userAgent: IPHONE}, 'TMAP_ROUTE_URL_SCHEME_NEW_TAB'],
  [openGoogleMapsPlace, {}, 'GOOGLE_MAPS_NEW_TAB'],
]) {
  const windowRef = fakeWindow();
  const before = windowRef.location.href;
  const result = open(PLACE, {windowRef, ...options});
  assert.equal(result.opened, true);
  assert.equal(result.mode, mode);
  assert.equal(windowRef.location.href, before, `${mode} replaced the LOTBI tab`);
  assert.deepEqual(windowRef.calls[0].slice(1), ['_blank', 'noopener,noreferrer']);
  assert.equal(windowRef.children[0].opener, null);
}

const desktopTmap = openTmapPlace(PLACE, {windowRef: fakeWindow(), userAgent: DESKTOP});
assert.equal(desktopTmap.opened, true);
assert.equal(desktopTmap.mode, 'TMAP_DESKTOP_NAVER_WEB_FALLBACK');
assert.match(desktopTmap.uri, /^https:\/\/map\.naver\.com\/p\/search\//u);

assert.equal(typeof openDefaultMapPlace, 'function');
for (const [provider, expectedMode] of [
  ['NAVER_MAP', 'NAVER_NAVIGATION_INTENT_NEW_TAB'],
  ['KAKAO_NAVI', 'KAKAO_NAVI_OFFICIAL_SDK_NEW_TAB'],
  ['TMAP', 'TMAP_ROUTE_INTENT_NEW_TAB'],
  ['GOOGLE_MAPS', 'GOOGLE_MAPS_NEW_TAB'],
]) {
  const result = openDefaultMapPlace(provider, PLACE, {windowRef: fakeWindow(), userAgent: ANDROID});
  assert.equal(result.mode, expectedMode);
}

// Without a verified coordinate, every search-based fallback must still
// carry the destination's full address -- never a truncated leading
// fragment ("전북 군산시") that can resolve to the wrong place.
const NO_COORD_PLACE = Object.freeze({
  name: '선유도 리조트',
  address: '전북특별자치도 군산시 옥도면 선유북길 30',
  latitude: null,
  longitude: null,
  navigationCapable: false,
});
const FULL_ADDRESS_PATTERN = /선유도 리조트 전북특별자치도 군산시 옥도면 선유북길 30/u;
// URLSearchParams (used by the nmap://search branch) encodes spaces as "+",
// not "%20" -- normalize before matching.
const decodeQuery = uri => decodeURIComponent(uri).replace(/\+/gu, ' ');
assert.match(decodeQuery(buildNaverMapsWebSearchUrl(NO_COORD_PLACE)), FULL_ADDRESS_PATTERN);
assert.match(decodeQuery(buildNaverMapsMobileUri(NO_COORD_PLACE)), FULL_ADDRESS_PATTERN);
assert.match(decodeQuery(buildTmapMobileUri(NO_COORD_PLACE)), FULL_ADDRESS_PATTERN);

console.log('Place Card navigation handoff contract: PASS');
