import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const navSource = await fs.readFile(new URL('../site-navigation.js', import.meta.url), 'utf8');
const coreSource = await fs.readFile(new URL('../site-core.js', import.meta.url), 'utf8');
const conversationSource = await fs.readFile(new URL('../site-conversation.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(navSource).toString('base64');
const nav = await import(moduleUrl);

const raw = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0123456789abcdef0123',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '전주 카페',
  results: [{
    result_id: 'place-1',
    place_id: 'naver:1',
    name: '전주 실제 카페',
    category: '카페',
    road_address: '전북 전주시 완산구 기린대로 1',
    latitude: 35.8242,
    longitude: 127.148,
    coordinate_system: 'WGS84',
    coordinate_authority: 'NAVER_MAPS_GEOCODING',
    navigation_capability: true,
    source_url: 'https://map.naver.com/p/search/test',
  }],
};

const normalized = nav.normalizePlaceResult(raw, {capturedAt: 1000});
assert.ok(normalized);
assert.equal(normalized.results.length, 1);
assert.equal(normalized.results[0].navigationCapable, true);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 9 * 60 * 1000), true);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 11 * 60 * 1000), false);

const place = normalized.results[0];
const mobile = nav.buildNaverMapsMobileUri(place);
assert.match(mobile, /^nmap:\/\/navigation\?/u);
assert.match(mobile, /dlat=35\.8242000/u);
assert.match(mobile, /dlng=127\.1480000/u);
assert.match(mobile, /appname=https%3A%2F%2Flotbiai\.com/u);
assert.doesNotMatch(mobile, /atg\.life/u);

const intent = nav.buildNaverMapsAndroidIntentUri(place);
assert.match(intent, /^intent:\/\/navigation\?/u);
assert.match(intent, /package=com\.nhn\.android\.nmap/u);
assert.match(intent, /scheme=nmap/u);
assert.doesNotMatch(intent, /atg\.life/u);
assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom\.nhn\.android\.nmap/u);

assert.equal(nav.naverMapsPlaceActionLabel(place, {userAgent: 'Mozilla/5.0 (Linux; Android 16)'}), '길안내');
assert.equal(nav.naverMapsPlaceActionLabel(place, {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)'}), '길안내');
assert.equal(nav.naverMapsPlaceActionLabel(place, {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}), '네이버지도에서 보기');

const desktop = nav.buildNaverMapsWebSearchUrl(place);
assert.match(desktop, /^https:\/\/map\.naver\.com\/p\/search\//u);
const desktopDecoded = decodeURIComponent(desktop);
assert.match(desktopDecoded, /전주 실제 카페 전북 전주시/u);
assert.doesNotMatch(desktopDecoded, /완산구/u);
assert.doesNotMatch(desktopDecoded, /기린대로/u);

const opened = [];
const desktopWindow = {
  open(url, target, features) {
    opened.push({url, target, features});
    return {opener: 'set'};
  },
  location: {href: ''},
};
const desktopResult = nav.openNaverMapsPlace(place, {
  windowRef: desktopWindow,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
});
assert.equal(desktopResult.mode, 'NAVER_WEB_SEARCH');
assert.equal(desktopResult.uri, desktop);
assert.equal(opened.length, 1);
assert.equal(opened[0].url, desktop);
assert.notEqual(nav.naverMapsPlaceActionLabel(place, {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}), '길안내');

const thumbnail = nav.buildNaverStaticMapThumbnailUrl(place);
const thumbnailUrl = new URL(thumbnail);
assert.equal(thumbnailUrl.origin, 'https://api.lotbiai.com');
assert.equal(thumbnailUrl.pathname, '/v2/maps/static-place-thumbnail');
assert.equal(thumbnailUrl.searchParams.get('latitude'), '35.8242000');
assert.equal(thumbnailUrl.searchParams.get('longitude'), '127.1480000');
assert.doesNotMatch(thumbnail, /secret|api[-_]?key|x-ncp/iu);
assert.doesNotMatch(navSource, /maps\.apigw\.ntruss\.com/iu);
assert.doesNotMatch(navSource, /x-ncp-apigw-api-key/iu);

const noEvidence = structuredClone(raw);
delete noEvidence.results[0].coordinate_authority;
const fallback = nav.normalizePlaceResult(noEvidence, {capturedAt: 1000});
assert.equal(fallback.results[0].navigationCapable, false);
assert.match(nav.buildNaverMapsMobileUri(fallback.results[0]), /^nmap:\/\/search\?/u);
assert.equal(nav.buildNaverStaticMapThumbnailUrl(fallback.results[0]), '');

assert.match(coreSource, /placeResult: payload\.place_result/u);
assert.match(conversationSource, /navigate\.addEventListener\('click'/u);
assert.match(conversationSource, /openNaverMapsPlace\(place\)/u);
assert.match(conversationSource, /naverMapsPlaceActionLabel\(place\)/u);
assert.match(conversationSource, /detail\.textContent = '상세보기'/u);
assert.doesNotMatch(conversationSource, /detail\.textContent = '네이버에서 보기'/u);
assert.match(conversationSource, /buildNaverStaticMapThumbnailUrl\(place\)/u);
assert.match(conversationSource, /image\.loading = 'lazy'/u);
assert.match(conversationSource, /media\.textContent = 'NAVER 지도'/u);
assert.match(conversationSource, /로그인 없이 실제 장소 카드/u);
assert.doesNotMatch(conversationSource, /openNaverMapsPlace\([^)]*response\.placeResult/u);
assert.match(indexSource, /site-conversation\.js\?v=20260920-convcalentry1/u);

console.log('NAVER Maps place navigation + static thumbnail contract: PASS');
