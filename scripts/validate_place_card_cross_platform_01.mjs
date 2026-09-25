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
      match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
      fetched_at: '2026-09-24T09:00:00Z',
      verification_state: 'VERIFIED',
      attributions: [],
    },
  }],
});
assert.equal(validPhoto.results[0].imageUrl, 'https://lh3.googleusercontent.com/synthetic');

const conversationSource = fs.readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');
const compactorStart = conversationSource.indexOf('const compactPlaceResultMeta = (value, capturedAt = Date.now()) => {');
const compactorEnd = conversationSource.indexOf('const normalizedPersistedPlaceResult = value => {', compactorStart);
assert.ok(compactorStart >= 0 && compactorEnd > compactorStart, 'place result compactor must exist');
const compactorDeclaration = conversationSource.slice(compactorStart, compactorEnd);
const compactorExpression = compactorDeclaration
  .slice(compactorDeclaration.indexOf('=') + 1)
  .trim()
  .replace(/;\s*$/u, '');
const compactPlaceResultMeta = Function(
  'normalizePlaceResult',
  `"use strict"; return (${compactorExpression});`,
)(normalizePlaceResult);
const compactedPhoto = compactPlaceResultMeta({
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_11111111111111111111',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '사진 있는 장소',
  results: [
    {
      result_id: 'place-1',
      place_id: 'naver:photo-one',
      name: '사진 장소 하나',
      road_address: '전북특별자치도 전주시 덕진구 테스트로 1',
      latitude: 35.8421,
      longitude: 127.1321,
      coordinate_system: 'WGS84',
      coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true,
      image_url: 'https://lh3.googleusercontent.com/place-one',
      photo_evidence: {
        provider: 'GOOGLE_PLACES',
        provider_place_id: 'google-place-one',
        match_basis: 'EXACT_NAME_AND_ADDRESS',
        fetched_at: '2026-09-25T07:00:00Z',
        verification_state: 'VERIFIED',
        attributions: [{display_name: 'Photographer One'}],
      },
    },
    {
      result_id: 'place-2',
      place_id: 'naver:photo-two',
      name: '사진 장소 둘',
      road_address: '전북특별자치도 전주시 완산구 테스트로 2',
      latitude: 35.8121,
      longitude: 127.1421,
      coordinate_system: 'WGS84',
      coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true,
      image_url: 'https://lh3.googleusercontent.com/place-two',
      photo_evidence: {
        provider: 'GOOGLE_PLACES',
        provider_place_id: 'google-place-two',
        match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
        fetched_at: '2026-09-25T07:01:00Z',
        verification_state: 'VERIFIED',
        attributions: [],
      },
    },
  ],
});
assert.ok(compactedPhoto, 'verified place result must compact');
assert.equal(compactedPhoto.results.length, 2);
assert.equal(compactedPhoto.results[0].photo_evidence?.provider, 'GOOGLE_PLACES');
assert.equal(compactedPhoto.results[0].photo_evidence?.verification_state, 'VERIFIED');
assert.equal(compactedPhoto.results[1].photo_evidence?.provider_place_id, 'google-place-two');
const roundTrippedPhoto = normalizePlaceResult(compactedPhoto, {capturedAt: compactedPhoto.captured_at});
assert.equal(roundTrippedPhoto.results[0].imageUrl, 'https://lh3.googleusercontent.com/place-one');
assert.equal(roundTrippedPhoto.results[1].imageUrl, 'https://lh3.googleusercontent.com/place-two');
assert.equal(roundTrippedPhoto.results[0].photoEvidence?.provider, 'GOOGLE_PLACES');
assert.equal(roundTrippedPhoto.results[1].photoEvidence?.verificationState, 'VERIFIED');

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

const source = conversationSource;
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
for (const iconName of ['phone', 'naver-map', 'kakao-map', 'tmap', 'google-maps']) {
  assert.match(renderer, new RegExp(`addActionIcon\\([^,]+, '${iconName}'\\)`, 'u'));
  assert.equal(fs.existsSync(new URL(`../assets/place-actions/${iconName}.png`, import.meta.url)), true);
}
assert.doesNotMatch(renderer, /lotbi-place-action-label/u);
assert.doesNotMatch(renderer, /addActionLabel/u);
assert.match(renderer, /dataset\.tmapState = isTmapHandoffAvailable\(\) \? 'MOBILE_APP' : 'INSTALL_GUIDE'/u);
assert.match(renderer, /dataset\.action = 'kakao-navi'/u);
assert.match(renderer, /dataset\.action = 'google-maps'/u);
assert.doesNotMatch(renderer, /globalThis\.location\.href/u);

console.log('Cross-platform Place Card product contract: PASS');
