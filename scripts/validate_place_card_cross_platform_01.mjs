import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildGoogleMapsDirectionsUrl,
  buildKakaoNaviSdkPayload,
  normalizePlaceResult,
  openGoogleMapsPlace,
} from '../site-navigation.js';

const NAVER_PLACE = Object.freeze({
  resultId: 'place-1',
  name: '라마다 프라자 호텔 자은도',
  category: '숙박>호텔',
  address: '전라남도 신안군 자은면 자은서부1길 163-101',
  latitude: 34.885,
  longitude: 126.047,
  coordinateSystem: 'WGS84',
  coordinateAuthority: 'NAVER_MAPS_GEOCODING',
  navigationCapable: true,
});

const googleUrl = buildGoogleMapsDirectionsUrl(NAVER_PLACE);
assert.match(googleUrl, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/u);
assert.match(googleUrl, /destination=34\.8850000%2C126\.0470000/u);
assert.doesNotMatch(googleUrl, /(?:key|api_key|client_id)=/iu);

assert.deepEqual(buildKakaoNaviSdkPayload(NAVER_PLACE), {
  name: NAVER_PLACE.name,
  x: NAVER_PLACE.longitude,
  y: NAVER_PLACE.latitude,
  coordType: 'wgs84',
});

const opened = [];
const child = {opener: {}};
const result = openGoogleMapsPlace(NAVER_PLACE, {
  windowRef: {open: (...args) => { opened.push(args); return child; }},
});
assert.equal(result.mode, 'GOOGLE_MAPS_NEW_TAB');
assert.deepEqual(opened[0].slice(1), ['_blank', 'noopener,noreferrer']);
assert.equal(child.opener, null);

const validPhoto = normalizePlaceResult({
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0123456789abcdef0123',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '신안 호텔',
  results: [{
    result_id: 'place-1',
    name: NAVER_PLACE.name,
    road_address: NAVER_PLACE.address,
    latitude: NAVER_PLACE.latitude,
    longitude: NAVER_PLACE.longitude,
    coordinate_system: NAVER_PLACE.coordinateSystem,
    coordinate_authority: NAVER_PLACE.coordinateAuthority,
    navigation_capability: true,
    image_url: 'https://lh3.googleusercontent.com/synthetic',
    photo_evidence: {
      provider: 'GOOGLE_PLACES',
      provider_place_id: 'google-place',
      match_basis: 'EXACT_NAME_AND_ADDRESS',
      fetched_at: '2026-09-24T09:00:00Z',
      verification_state: 'VERIFIED',
      attributions: [],
    },
  }],
});
assert.equal(validPhoto.results[0].imageUrl, 'https://lh3.googleusercontent.com/synthetic');

const unsafePhoto = normalizePlaceResult({
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0123456789abcdef0123',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '신안 호텔',
  results: [{
    result_id: 'place-1',
    name: NAVER_PLACE.name,
    road_address: NAVER_PLACE.address,
    latitude: NAVER_PLACE.latitude,
    longitude: NAVER_PLACE.longitude,
    coordinate_system: NAVER_PLACE.coordinateSystem,
    coordinate_authority: NAVER_PLACE.coordinateAuthority,
    navigation_capability: true,
    image_url: 'https://evil.example.test/google-photo',
    photo_evidence: {provider: 'GOOGLE_PLACES'},
  }],
});
assert.equal(unsafePhoto.results[0].imageUrl, '');

const source = fs.readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');
const rendererStart = source.indexOf('const createPlaceCardRail = placeValue => {');
const rendererEnd = source.indexOf('const normalizeConversationCalendarResult = value => {', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
const renderer = source.slice(rendererStart, rendererEnd);

for (const forbidden of [
  '인허가 대조',
  '인허가 정보 불일치',
  '공공 인허가',
  '행정 인허가',
  'WGS84 확인',
  '사진 정보 없음',
  'navercorp.com/img',
]) {
  assert.doesNotMatch(renderer, new RegExp(forbidden, 'u'));
}
for (const label of ['전화', '네이버', '카카오', 'T맵', 'Google']) {
  assert.match(renderer, new RegExp(`addActionLabel\\\\([^,]+, '${label}'\\\\)`, 'u'));
}
assert.match(renderer, /dataset\.action = 'kakao-navi'/u);
assert.match(renderer, /dataset\.action = 'google-maps'/u);
assert.doesNotMatch(renderer, /globalThis\.location\.href/u);

console.log('Cross-platform Place Card product contract: PASS');
