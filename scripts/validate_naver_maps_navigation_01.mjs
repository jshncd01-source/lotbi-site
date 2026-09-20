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

const mobile = nav.buildNaverMapsMobileUri(normalized.results[0]);
assert.match(mobile, /^nmap:\/\/navigation\?/u);
assert.match(mobile, /dlat=35\.8242000/u);
assert.match(mobile, /dlng=127\.1480000/u);
assert.match(mobile, /appname=https%3A%2F%2Flotbiai\.com/u);
assert.doesNotMatch(mobile, /atg\.life/u);

const intent = nav.buildNaverMapsAndroidIntentUri(normalized.results[0]);
assert.match(intent, /^intent:\/\/navigation\?/u);
assert.match(intent, /package=com\.nhn\.android\.nmap/u);
assert.match(intent, /scheme=nmap/u);
assert.doesNotMatch(intent, /atg\.life/u);
assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom\.nhn\.android\.nmap/u);

const desktop = nav.buildNaverMapsWebSearchUrl(normalized.results[0]);
assert.match(desktop, /^https:\/\/map\.naver\.com\/p\/search\//u);

const noEvidence = structuredClone(raw);
delete noEvidence.results[0].coordinate_authority;
const fallback = nav.normalizePlaceResult(noEvidence, {capturedAt: 1000});
assert.equal(fallback.results[0].navigationCapable, false);
assert.match(nav.buildNaverMapsMobileUri(fallback.results[0]), /^nmap:\/\/search\?/u);

assert.match(coreSource, /placeResult: payload\.place_result/u);
assert.match(conversationSource, /navigate\.addEventListener\('click'/u);
assert.match(conversationSource, /openNaverMapsPlace\(place\)/u);
assert.match(conversationSource, /로그인 없이 실제 장소 카드/u);
assert.doesNotMatch(conversationSource, /openNaverMapsPlace\([^)]*response\.placeResult/u);
assert.match(indexSource, /site-conversation\.js\?v=20260920-convcalentry1/u);

console.log('NAVER Maps place navigation contract: PASS');
