import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const navSource = await fs.readFile(new URL('../site-navigation.js', import.meta.url), 'utf8');
const conversationSource = await fs.readFile(new URL('../site-conversation.js', import.meta.url), 'utf8');
const assetVersion = JSON.parse(
  await fs.readFile(new URL('../site-asset-version.json', import.meta.url), 'utf8'),
).version;

const nav = await import('data:text/javascript;base64,' + Buffer.from(navSource).toString('base64'));

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
    source_url: 'https://band.us/example-not-place-authority',
  }],
};

function rawWithCount(count) {
  const fixture = structuredClone(raw);
  fixture.results = Array.from({length: count}, (_, index) => ({
    ...structuredClone(raw.results[0]),
    result_id: `place-${index + 1}`,
    place_id: `naver:${index + 1}`,
    name: `전주 실제 카페 ${index + 1}`,
    road_address: `전북 전주시 완산구 기린대로 ${index + 1}`,
    latitude: raw.results[0].latitude + (index * 0.001),
    longitude: raw.results[0].longitude + (index * 0.001),
  }));
  return fixture;
}

const normalized = nav.normalizePlaceResult(raw, {capturedAt: 1000});
assert.ok(normalized);
assert.equal(normalized.results.length, 1);
assert.equal(normalized.results[0].navigationCapable, true);
assert.equal(normalized.results[0].imageUrl, '');

// Internal MOIS evidence remains normalized for diagnostics/admin use.
const foodLicenseRaw = structuredClone(raw);
foodLicenseRaw.results[0].food_license_verification = {
  state: 'VERIFIED',
  source: 'MOIS_FOOD_LICENSE',
  ai_calls: 0,
  administrative_status: '영업/정상',
};
const foodLicenseResult = nav.normalizePlaceResult(foodLicenseRaw, {capturedAt: 1000});
assert.deepEqual(foodLicenseResult.results[0].foodLicenseVerification, {
  state: 'VERIFIED',
  source: 'MOIS_FOOD_LICENSE',
  administrativeStatus: '영업/정상',
});
const spoofedFoodLicenseRaw = structuredClone(foodLicenseRaw);
spoofedFoodLicenseRaw.results[0].food_license_verification.source = 'OTHER';
assert.equal(
  nav.normalizePlaceResult(spoofedFoodLicenseRaw, {capturedAt: 1000}).results[0].foodLicenseVerification,
  null,
);

// Only strict Google photo evidence may produce a consumer photo.
const photoRaw = structuredClone(raw);
photoRaw.results[0].image_url = 'https://lh3.googleusercontent.com/verified-place.jpg';
photoRaw.results[0].photo_evidence = {
  provider: 'GOOGLE_PLACES',
  provider_place_id: 'google-place-1',
  match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
  fetched_at: '2026-09-24T09:00:00Z',
  verification_state: 'VERIFIED',
  attributions: [],
};
const photoResult = nav.normalizePlaceResult(photoRaw, {capturedAt: 1000});
assert.equal(photoResult.results[0].imageUrl, photoRaw.results[0].image_url);
assert.equal(photoResult.results[0].photoEvidence.matchBasis, 'EXACT_NAME_AND_80M_COORDINATE');

for (const mutate of [
  value => { value.image_url = 'https://images.example.com/place.jpg'; },
  value => { value.image_url = 'https://lh3.googleusercontent.com/place.jpg?key=secret'; },
  value => { value.photo_evidence.match_basis = 'EXACT_NAME_AND_COORDINATES'; },
  value => { value.photo_evidence.verification_state = 'AMBIGUOUS'; },
]) {
  const unsafe = structuredClone(photoRaw);
  mutate(unsafe.results[0]);
  const parsed = nav.normalizePlaceResult(unsafe, {capturedAt: 1000});
  assert.equal(parsed.results[0].imageUrl, '');
  assert.equal(parsed.results[0].photoEvidence, null);
}

assert.match(navSource, /const NAVIGATION_TTL_MS = 60 \* 60 \* 1000;/u);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 60 * 60 * 1000), true);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 60 * 60 * 1000 + 1), false);
for (const count of [1, 2, 3, 5]) {
  assert.equal(nav.normalizePlaceResult(rawWithCount(count), {capturedAt: 1000}).results.length, count);
}

// Phone is exposed only when provider verification is explicit and the number is safe.
const verifiedPhoneRaw = structuredClone(raw);
verifiedPhoneRaw.results[0].phone = '063-123-4567';
verifiedPhoneRaw.results[0].phone_verified = true;
const verifiedPhone = nav.normalizePlaceResult(verifiedPhoneRaw, {capturedAt: 1000}).results[0];
assert.equal(verifiedPhone.phoneVerified, true);
assert.equal(nav.buildVerifiedPhoneHref(verifiedPhone), 'tel:0631234567');
const unverifiedPhoneRaw = structuredClone(verifiedPhoneRaw);
unverifiedPhoneRaw.results[0].phone_verified = false;
assert.equal(nav.normalizePlaceResult(unverifiedPhoneRaw, {capturedAt: 1000}).results[0].phoneVerified, false);
const malformedPhoneRaw = structuredClone(verifiedPhoneRaw);
malformedPhoneRaw.results[0].phone = '063-CALL-NOW';
assert.equal(nav.normalizePlaceResult(malformedPhoneRaw, {capturedAt: 1000}).results[0].phoneVerified, false);

const place = normalized.results[0];
const mobile = nav.buildNaverMapsMobileUri(place);
assert.match(mobile, /^nmap:\/\/navigation\?/u);
assert.match(mobile, /dlat=35\.8242000/u);
assert.match(mobile, /dlng=127\.1480000/u);
assert.match(mobile, /appname=https%3A%2F%2Flotbiai\.com/u);

const intent = nav.buildNaverMapsAndroidIntentUri(place);
assert.match(intent, /^intent:\/\/navigation\?/u);
assert.match(intent, /package=com\.nhn\.android\.nmap/u);
assert.match(intent, /scheme=nmap/u);
assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fmap\.naver\.com%2Fp%2Fsearch%2F/u);

const desktop = nav.buildNaverMapsWebSearchUrl(place);
assert.match(desktop, /^https:\/\/map\.naver\.com\/p\/search\//u);
assert.match(decodeURIComponent(desktop), /전주 실제 카페 전북 전주시/u);

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

for (const [userAgent, mode] of [
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'NAVER_WEB_SEARCH_NEW_TAB'],
  ['Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36', 'NAVER_NAVIGATION_INTENT_NEW_TAB'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'NAVER_NAVIGATION_URL_SCHEME_NEW_TAB'],
]) {
  const windowRef = fakeWindow();
  const before = windowRef.location.href;
  const result = nav.openNaverMapsPlace(place, {windowRef, userAgent});
  assert.equal(result.opened, true);
  assert.equal(result.mode, mode);
  assert.equal(windowRef.location.href, before);
  assert.deepEqual(windowRef.calls[0].slice(1), ['_blank', 'noopener,noreferrer']);
  assert.equal(windowRef.children[0].opener, null);
  assert.equal(result.fallbackUri, desktop);
}

const blockedWindow = {location: {href: 'https://lotbiai.com/'}, open() { return null; }};
const blocked = nav.openNaverMapsPlace(place, {
  windowRef: blockedWindow,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
});
assert.equal(blocked.opened, false);
assert.equal(blocked.mode, 'BLOCKED');
assert.equal(blockedWindow.location.href, 'https://lotbiai.com/');

// Coordinates without NAVER WGS84 authority never become navigation coordinates.
const noEvidence = structuredClone(raw);
delete noEvidence.results[0].coordinate_authority;
const fallback = nav.normalizePlaceResult(noEvidence, {capturedAt: 1000}).results[0];
assert.equal(fallback.navigationCapable, false);
assert.match(nav.buildNaverMapsMobileUri(fallback), /^nmap:\/\/search\?/u);

// Static-map thumbnail and credential-bearing map requests remain deleted.
assert.equal(typeof nav.buildNaverStaticMapThumbnailUrl, 'undefined');
assert.doesNotMatch(navSource, /buildNaverStaticMapThumbnailUrl|maps\.apigw\.ntruss\.com|x-ncp-apigw-api-key/iu);

const rendererStart = conversationSource.indexOf('const createPlaceCardRail = placeValue => {');
const rendererEnd = conversationSource.indexOf('const normalizeConversationCalendarResult = value => {', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
const renderer = conversationSource.slice(rendererStart, rendererEnd);

// Consumer card contract: no administrative diagnostics, phone appears only when verified,
// every map action remains visible as an icon, and handoffs leave the LOTBI tab intact.
for (const forbidden of [
  '인허가 대조', '인허가 정보 불일치', '공공 인허가', '행정 인허가',
  'WGS84 확인', 'NAVER Maps Geocoding · WGS84 확인', '사진 정보 없음',
]) {
  assert.doesNotMatch(renderer, new RegExp(forbidden, 'u'));
}
assert.match(renderer, /if \(phoneHref\) \{/u);
assert.doesNotMatch(renderer, /전화번호 정보 없음/u);
assert.match(renderer, /dataset\.tmapState = isTmapHandoffAvailable\(\) \? 'MOBILE_APP' : 'INSTALL_GUIDE'/u);
assert.doesNotMatch(renderer, /TMAP_MOBILE_ONLY/u);
assert.doesNotMatch(renderer, /globalThis\.location\.href/u);
assert.match(renderer, /navigate\.target = '_blank'/u);
assert.match(renderer, /navigate\.rel = 'noopener noreferrer'/u);
assert.match(renderer, /dataset\.action = 'kakao-navi'/u);
assert.doesNotMatch(renderer, /dataset\.action = 'google-maps'/u);
for (const iconName of ['phone', 'naver-map', 'kakao-map', 'tmap']) {
  assert.match(renderer, new RegExp(`addActionIcon\\([^,]+, '${iconName}'\\)`, 'u'));
}
assert.doesNotMatch(renderer, /addActionIcon\([^,]+, 'google-maps'\)/u);
assert.match(renderer, /lotbi-place-card-phone-actions/u);
assert.match(renderer, /lotbi-place-card-navigation-actions/u);
assert.doesNotMatch(renderer, /addActionLabel|lotbi-place-action-label/u);

// Carousel interaction and inactive-card accessibility remain part of the NAVER place surface.
assert.match(renderer, /aria-roledescription', 'carousel'/u);
assert.match(renderer, /aria-roledescription', 'slide'/u);
assert.match(renderer, /event\.key === 'ArrowRight'/u);
assert.match(renderer, /event\.key === 'ArrowLeft'/u);
assert.match(renderer, /rail\.addEventListener\('pointerdown'/u);
assert.match(renderer, /rail\.addEventListener\('pointermove'/u);
assert.match(renderer, /rail\.addEventListener\('pointerup'/u);
assert.match(renderer, /Math\.abs\(delta\) >= 44/u);
assert.match(renderer, /control\.tabIndex = current \? 0 : -1/u);
assert.match(renderer, /control\.setAttribute\('aria-disabled', current \? 'false' : 'true'\)/u);
assert.match(
  renderer,
  /if \(index !== activeIndex\) \{\s*setActiveIndex\(index\);\s*return;\s*\}\s*openPlaceInNaverMap\(placeResult\.results\[index\]\);/u,
);

// Current generated asset version must be the one the conversation runtime imports.
assert.ok(conversationSource.includes(`./site-navigation.js?v=${assetVersion}`));

console.log('NAVER Place Card identity + verified phone/photo + safe new-context navigation contract: PASS');
