import assert from 'node:assert/strict';
import {
  buildKakaoNaviHandoffUrl,
  buildKakaoNaviSdkPayload,
  buildNaverMapsAndroidIntentUri,
  buildNaverMapsMobileUri,
  buildNaverMapsWebSearchUrl,
  buildTmapAndroidIntentUri,
  buildTmapMobileUri,
  isTmapHandoffAvailable,
  openKakaoNaviPlace,
  openNaverMapsPlace,
  openTmapPlace,
} from '../site-navigation.js';

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

const tmap = buildTmapMobileUri(PLACE);
assert.match(tmap, /goalx=126\.4567891/u);
assert.match(tmap, /goaly=35\.8012345/u);
assert.match(buildTmapAndroidIntentUri(PLACE), /package=com\.skt\.tmap\.ku/u);

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
assert.equal(desktopTmap.opened, false);
assert.equal(desktopTmap.mode, 'TMAP_MOBILE_ONLY');

console.log('Place Card navigation handoff contract: PASS');
