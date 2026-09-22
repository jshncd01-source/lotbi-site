import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// TRUE ORBIT contract is validated against the latest merged Site main.

const navSource = await fs.readFile(new URL('../site-navigation.js', import.meta.url), 'utf8');
const coreSource = await fs.readFile(new URL('../site-core.js', import.meta.url), 'utf8');
const conversationSource = await fs.readFile(new URL('../site-conversation.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const conversationStyles = await fs.readFile(new URL('../site-conversation.css', import.meta.url), 'utf8');

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
const spoofedFoodLicenseResult = nav.normalizePlaceResult(spoofedFoodLicenseRaw, {capturedAt: 1000});
assert.equal(spoofedFoodLicenseResult.results[0].foodLicenseVerification, null);

const photoRaw = structuredClone(raw);
photoRaw.results[0].image_url = 'https://images.example.com/verified-place.jpg';
const photoResult = nav.normalizePlaceResult(photoRaw, {capturedAt: 1000});
assert.equal(photoResult.results[0].imageUrl, 'https://images.example.com/verified-place.jpg');

for (const unsafeImageUrl of [
  'http://images.example.com/place.jpg',
  'data:image/png;base64,AAAA',
  'javascript:alert(1)',
  'https://user:secret@images.example.com/place.jpg',
]) {
  const unsafePhotoRaw = structuredClone(raw);
  unsafePhotoRaw.results[0].image_url = unsafeImageUrl;
  const unsafePhotoResult = nav.normalizePlaceResult(unsafePhotoRaw, {capturedAt: 1000});
  assert.equal(unsafePhotoResult.results[0].imageUrl, '');
}

assert.match(navSource, /const NAVIGATION_TTL_MS = 60 \* 60 \* 1000;/u);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 59 * 60 * 1000), true);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 60 * 60 * 1000), true);
assert.equal(nav.isPlaceResultFresh(normalized, 1000 + 60 * 60 * 1000 + 1), false);

for (const count of [1, 2, 3, 5]) {
  const fixture = nav.normalizePlaceResult(rawWithCount(count), {capturedAt: 1000});
  assert.ok(fixture);
  assert.equal(fixture.results.length, count);
}

const verifiedPhoneRaw = structuredClone(raw);
verifiedPhoneRaw.results[0].phone = '063-123-4567';
verifiedPhoneRaw.results[0].phone_verified = true;
const verifiedPhoneResult = nav.normalizePlaceResult(verifiedPhoneRaw, {capturedAt: 1000});
assert.equal(verifiedPhoneResult.results[0].phoneVerified, true);
assert.equal(nav.buildVerifiedPhoneHref(verifiedPhoneResult.results[0]), 'tel:0631234567');

const missingPhoneResult = nav.normalizePlaceResult(raw, {capturedAt: 1000});
assert.equal(missingPhoneResult.results[0].phoneVerified, false);
assert.equal(nav.buildVerifiedPhoneHref(missingPhoneResult.results[0]), '');

const ambiguousPhoneRaw = structuredClone(verifiedPhoneRaw);
ambiguousPhoneRaw.results[0].phone_verified = false;
const ambiguousPhoneResult = nav.normalizePlaceResult(ambiguousPhoneRaw, {capturedAt: 1000});
assert.equal(ambiguousPhoneResult.results[0].phoneVerified, false);
assert.equal(nav.buildVerifiedPhoneHref(ambiguousPhoneResult.results[0]), '');

const malformedPhoneRaw = structuredClone(verifiedPhoneRaw);
malformedPhoneRaw.results[0].phone = '063-CALL-NOW';
const malformedPhoneResult = nav.normalizePlaceResult(malformedPhoneRaw, {capturedAt: 1000});
assert.equal(malformedPhoneResult.results[0].phoneVerified, false);
assert.equal(nav.buildVerifiedPhoneHref(malformedPhoneResult.results[0]), '');

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
assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fmap\.naver\.com%2Fp%2Fsearch%2F/u);
assert.doesNotMatch(intent, /play\.google\.com|itunes\.apple\.com|apps\.apple\.com/u);

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
assert.equal(desktopResult.mode, 'NAVER_WEB_SEARCH_NEW_TAB');
assert.equal(desktopResult.uri, desktop);
assert.equal(opened.length, 1);
assert.equal(opened[0].url, desktop);

const blockedDesktopWindow = {
  open() { return null; },
  location: {href: ''},
};
const blockedDesktopResult = nav.openNaverMapsPlace(place, {
  windowRef: blockedDesktopWindow,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
});
assert.equal(blockedDesktopResult.mode, 'NAVER_WEB_SEARCH_SAME_TAB');
assert.equal(blockedDesktopWindow.location.href, desktop);

let iosFallback = null;
const iosWindow = {
  location: {href: ''},
  setTimeout(callback) { iosFallback = callback; return 1; },
  clearTimeout() {},
  addEventListener() {},
};
const iosDocument = {
  visibilityState: 'visible',
  addEventListener() {},
};
const iosResult = nav.openNaverMapsPlace(place, {
  windowRef: iosWindow,
  documentRef: iosDocument,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
});
assert.match(iosWindow.location.href, /^nmap:\/\/navigation\?/u);
assert.equal(iosResult.fallbackUri, desktop);
assert.equal(typeof iosFallback, 'function');
iosFallback();
assert.equal(iosWindow.location.href, desktop);

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

const placeRendererStart = conversationSource.indexOf("const createPlaceCardRail = placeValue => {");
const placeRendererEnd = conversationSource.indexOf("const normalizeConversationCalendarResult = value => {", placeRendererStart);
assert.ok(placeRendererStart >= 0 && placeRendererEnd > placeRendererStart);
const placeRendererSource = conversationSource.slice(placeRendererStart, placeRendererEnd);
assert.match(placeRendererSource, /행정 인허가 데이터상 확인/u);
assert.match(placeRendererSource, /공공 인허가 데이터에서 일치 기록 미확인/u);
assert.match(placeRendererSource, /행정 인허가 데이터 확인 불가/u);
assert.doesNotMatch(placeRendererSource, /정부 인증 맛집|현재 영업 중|안전한 식당|믿을 수 있는 식당/u);
assert.match(conversationSource, /food_license_verification/u);

const placePointerResolverStart = conversationSource.indexOf('function resolvePlaceOrbitPointerIndex(');
const placePointerResolverEnd = conversationSource.indexOf('\nfunction createMessage(', placePointerResolverStart);
assert.ok(
  placePointerResolverStart >= 0 && placePointerResolverEnd > placePointerResolverStart,
  'Place orbit pointer resolver must remain independently testable',
);
const placePointerResolverSource = conversationSource.slice(placePointerResolverStart, placePointerResolverEnd);
const placePointerResolverContext = {};
vm.runInNewContext(
  placePointerResolverSource + '\nthis.resolvePlaceOrbitPointerIndex = resolvePlaceOrbitPointerIndex;',
  placePointerResolverContext,
);
const resolvePlaceOrbitPointerIndex = placePointerResolverContext.resolvePlaceOrbitPointerIndex;
const centerRectFixture = {left: 100, right: 300, top: 50, bottom: 350};

assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: 1, activeIndex: 0, cardCount: 5, clientX: 180, clientY: 200, centerRect: centerRectFixture,
}), 1, 'RIGHT_FRONT DOM target must resolve exactly');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: 4, activeIndex: 0, cardCount: 5, clientX: 220, clientY: 200, centerRect: centerRectFixture,
}), 4, 'LEFT_FRONT DOM target must resolve exactly');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: 3, activeIndex: 0, cardCount: 5, clientX: 90, clientY: 200, centerRect: centerRectFixture,
}), 3, 'visible BACK DOM target must resolve exactly');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: 0, activeIndex: 0, cardCount: 5, clientX: 80, clientY: 200, centerRect: centerRectFixture,
}), 4, 'left visible side zone must resolve LEFT_FRONT even if the DOM target falls back to CENTER');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: null, activeIndex: 0, cardCount: 5, clientX: 320, clientY: 200, centerRect: centerRectFixture,
}), 1, 'right visible side zone must resolve RIGHT_FRONT when the DOM target falls back to the rail');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: 0, activeIndex: 0, cardCount: 5, clientX: 180, clientY: 200, centerRect: centerRectFixture,
}), 0, 'CENTER body tap must remain CENTER');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: null, activeIndex: 0, cardCount: 5, clientX: 80, clientY: 20, centerRect: centerRectFixture,
}), null, 'coordinate fallback must stay within the vertical card hit band');
assert.equal(resolvePlaceOrbitPointerIndex({
  targetIndex: null, activeIndex: 4, cardCount: 5, clientX: 320, clientY: 200, centerRect: centerRectFixture,
}), 0, 'right side coordinate fallback must wrap circularly');

const cardClickStart = placeRendererSource.indexOf("cards.forEach((card, index) => {");
const cardClickEnd = placeRendererSource.indexOf("rail.addEventListener('keydown'", cardClickStart);
const pointerDownStart = placeRendererSource.indexOf("rail.addEventListener('pointerdown'");
const pointerMoveStart = placeRendererSource.indexOf("rail.addEventListener('pointermove'", pointerDownStart);
const finishDragStart = placeRendererSource.indexOf("const finishDrag = (event, {cancelled = false} = {}) => {", pointerMoveStart);
const pointerUpStart = placeRendererSource.indexOf("rail.addEventListener('pointerup'", finishDragStart);
assert.ok(
  cardClickStart >= 0
    && cardClickEnd > cardClickStart
    && pointerDownStart >= 0
    && pointerMoveStart > pointerDownStart
    && finishDragStart > pointerMoveStart
    && pointerUpStart > finishDragStart,
  'Place orbit click/drag handler boundaries must remain discoverable',
);
const cardClickSource = placeRendererSource.slice(cardClickStart, cardClickEnd);
const pointerDownSource = placeRendererSource.slice(pointerDownStart, pointerMoveStart);
const pointerMoveSource = placeRendererSource.slice(pointerMoveStart, finishDragStart);
const finishDragSource = placeRendererSource.slice(finishDragStart, pointerUpStart);

assert.match(coreSource, /placeResult: payload\.place_result/u);
assert.match(conversationSource, /openNaverMapsPlace\(place\)/u);
assert.match(conversationSource, /buildNaverStaticMapThumbnailUrl\(place\)/u);
assert.match(conversationSource, /buildVerifiedPhoneHref\(place\)/u);
assert.match(conversationSource, /phone\.href = phoneHref/u);
assert.match(conversationSource, /CALL_HANDOFF_STARTED/u);
assert.match(conversationSource, /phone\.setAttribute\('aria-label', `\$\{place\.name\} 전화 걸기`\)/u);
assert.match(placeRendererSource, /document\.createElement\(phoneHref \? 'a' : 'button'\)/u);
assert.match(placeRendererSource, /phone\.dataset\.phoneState = phoneHref \? 'VERIFIED' : 'UNAVAILABLE'/u);
assert.match(placeRendererSource, /phone\.disabled = true/u);
assert.match(placeRendererSource, /phone\.setAttribute\('aria-label', `\$\{place\.name\} 전화번호 정보 없음`\)/u);
assert.match(placeRendererSource, /phoneLabel\.textContent = '전화'/u);

assert.match(conversationSource, /lotbi-place-orbit/u);
assert.match(conversationSource, /aria-roledescription', 'carousel'/u);
assert.match(conversationSource, /aria-roledescription', 'slide'/u);
assert.match(conversationSource, /const wrapIndex = index =>/u);
assert.match(placeRendererSource, /'CENTER'/u);
assert.match(placeRendererSource, /'LEFT_FRONT'/u);
assert.match(placeRendererSource, /'RIGHT_FRONT'/u);
assert.match(placeRendererSource, /'LEFT_BACK'/u);
assert.match(placeRendererSource, /'RIGHT_BACK'/u);
assert.match(placeRendererSource, /\(\(index % count\) \+ count\) % count/u);
assert.match(placeRendererSource, /card\.dataset\.orbitSlot = slot/u);
assert.match(placeRendererSource, /card\.setAttribute\('aria-current', current \? 'true' : 'false'\)/u);
assert.match(placeRendererSource, /event\.key === 'ArrowRight'/u);
assert.match(placeRendererSource, /event\.key === 'ArrowLeft'/u);
assert.match(placeRendererSource, /setActiveIndex\(activeIndex - 1\)/u);
assert.match(placeRendererSource, /setActiveIndex\(activeIndex \+ 1\)/u);
assert.match(placeRendererSource, /rail\.addEventListener\('wheel'/u);
assert.match(placeRendererSource, /rail\.addEventListener\('pointerdown'/u);
assert.match(placeRendererSource, /rail\.addEventListener\('pointermove'/u);
assert.match(placeRendererSource, /rail\.addEventListener\('pointerup', event => finishDrag\(event\)\)/u);
assert.match(placeRendererSource, /rail\.addEventListener\('pointercancel', event => finishDrag\(event, \{cancelled: true\}\)\)/u);

assert.match(
  pointerDownSource,
  /\(event\.pointerType === 'mouse' && event\.button !== 0\)/u,
  'Only non-primary mouse pointerdown may be rejected by button state',
);
assert.equal(
  (pointerDownSource.match(/event\.button/g) || []).length,
  1,
  'Touch/pen pointerdown must not gain a generic event.button gate',
);
assert.ok(
  pointerDownSource.indexOf("event.target?.closest?.('a, button')") <
    pointerDownSource.indexOf("rail.setPointerCapture(event.pointerId)"),
  'NAVER Map/phone actions must be excluded before Place Card pointer capture',
);
assert.match(pointerDownSource, /if \(typeof rail\.setPointerCapture === 'function'\) \{/u);
assert.match(pointerDownSource, /rail\.setPointerCapture\(event\.pointerId\)/u);
assert.match(pointerDownSource, /dragCaptured = true/u);
assert.doesNotMatch(pointerDownSource, /classList\.add\('is-dragging'\)/u, 'Clean tap capture must not enter drag visuals');
assert.match(pointerMoveSource, /if \(Math\.abs\(delta\) > 4 && !dragMoved\) \{/u);
assert.match(pointerMoveSource, /rail\.classList\.add\('is-dragging'\)/u);
assert.doesNotMatch(pointerMoveSource, /setPointerCapture/u, 'Pointer capture must already be held from pointerdown');
assert.doesNotMatch(pointerDownSource, /suppressClick/u);
assert.doesNotMatch(pointerMoveSource, /suppressClick/u);
assert.match(
  finishDragSource,
  /const selectedDifferentCard = !cancelled[\s\S]*pointerOriginIndex !== activeIndex;/u,
  'Clean side-card selection must be distinguished from a CENTER body tap',
);
assert.match(
  finishDragSource,
  /if \(!cancelled && \(dragMoved \|\| selectedDifferentCard\)\) \{\s*suppressClick = true;/u,
  'Synthetic click suppression must cover drags and the click immediately following side-card selection',
);
assert.equal(
  (finishDragSource.match(/suppressClick = true;/g) || []).length,
  1,
  'Place orbit must keep one bounded suppressClick activation',
);
assert.match(
  finishDragSource,
  /else if \(Number\.isInteger\(pointerOriginIndex\)\) \{\s*setActiveIndex\(pointerOriginIndex\);/u,
  'Sub-threshold tap/movement must select the exact origin card',
);
assert.match(cardClickSource, /if \(suppressClick \|\| event\.target\?\.closest\?\.\('a, button'\)\) return;/u);
assert.match(
  cardClickSource,
  /if \(index !== activeIndex\) \{\s*setActiveIndex\(index\);\s*return;\s*\}\s*openPlaceInNaverMap\(placeResult\.results\[index\]\);/u,
  'Side card body click must only select CENTER; already-active CENTER body click must open that place in NAVER Maps',
);
assert.match(placeRendererSource, /rail\.setPointerCapture\(event\.pointerId\)/u);
assert.match(placeRendererSource, /rail\.releasePointerCapture\?\.\(event\.pointerId\)/u);
assert.match(placeRendererSource, /Math\.abs\(delta\) >= 44/u);
assert.match(placeRendererSource, /setActiveIndex\(activeIndex \+ \(delta < 0 \? 1 : -1\)\)/u);
assert.match(pointerDownSource, /const centerRect = cards\[activeIndex\]\?\.getBoundingClientRect\?\.\(\) \|\| null/u);
assert.match(pointerDownSource, /pointerOriginIndex = resolvePlaceOrbitPointerIndex\(\{/u);
assert.match(pointerDownSource, /targetIndex: Number\.isInteger\(originIndex\) \? originIndex : null/u);
assert.match(pointerDownSource, /cardCount: cards\.length/u);
assert.match(pointerDownSource, /clientX: event\.clientX/u);
assert.match(pointerDownSource, /clientY: event\.clientY/u);
assert.match(placeRendererSource, /else if \(Number\.isInteger\(pointerOriginIndex\)\) \{\s*setActiveIndex\(pointerOriginIndex\);/u);
assert.match(placeRendererSource, /if \(cancelled\) \{\s*applyOrbitState\(\);/u);
assert.match(placeRendererSource, /suppressClick = true;\s*globalThis\.setTimeout\?\.\(\(\) => \{ suppressClick = false; \}, 0\)/u);
assert.match(placeRendererSource, /--lotbi-orbit-drag-x/u);
assert.match(placeRendererSource, /card\.querySelectorAll\('a, button'\)/u);
assert.doesNotMatch(placeRendererSource, /scrollLeft|scrollTo\(|nearestCardIndex|scroll-snap/u);

assert.match(placeRendererSource, /const openPlaceInNaverMap = place => \{/u);
assert.match(placeRendererSource, /const fallbackHref = buildNaverMapsWebSearchUrl\(place\)/u);
assert.match(placeRendererSource, /const opened = openNaverMapsPlace\(place\)/u);
assert.match(placeRendererSource, /globalThis\.location\.href = fallbackHref/u);
assert.match(
  placeRendererSource,
  /navigate\.addEventListener\('click', event => \{\s*event\.preventDefault\(\);\s*openPlaceInNaverMap\(place\);\s*\}\);/u,
  'NAVER Map button and CENTER card body must share one navigation helper',
);
assert.match(conversationSource, /navigate\.setAttribute\('aria-label', `\$\{place\.name\} 네이버지도에서 열기`\)/u);
assert.match(placeRendererSource, /const navigate = document\.createElement\('a'\)/u);
assert.match(placeRendererSource, /navigate\.href = buildNaverMapsWebSearchUrl\(place\)/u);
assert.match(placeRendererSource, /navigate\.target = '_blank'/u);
assert.match(placeRendererSource, /navigate\.rel = 'noopener noreferrer'/u);
assert.match(placeRendererSource, /event\.preventDefault\(\)/u);
assert.match(placeRendererSource, /mapLabel\.textContent = '네이버지도'/u);
assert.match(conversationSource, /navigate\.title = '네이버지도에서 열기'/u);
assert.match(conversationSource, /https:\/\/navercorp\.com\/img\/pc\/service-map-app-4\.jpg/u);
assert.match(conversationSource, /site-navigation\.js\?v=20260921-placecompactactions1/u);
assert.doesNotMatch(conversationSource, /naverMapsPlaceActionLabel\(place\)/u);
assert.doesNotMatch(placeRendererSource, /detail\.textContent = '상세보기'/u);
assert.doesNotMatch(placeRendererSource, /navigate\.disabled = !fresh/u);
assert.doesNotMatch(placeRendererSource, /NAVER Maps Geocoding · WGS84 확인|좌표 미확정 · 네이버지도 검색으로 연결|검색 결과 만료 · 다시 검색 필요/u);
assert.match(conversationSource, /결과가 오래됐어요\. 같은 장소를 다시 검색한 뒤 열어 주세요\./u);
assert.match(conversationSource, /source_url: place\.sourceUrl/u);
assert.match(conversationSource, /image_url: place\.imageUrl/u);

assert.match(placeRendererSource, /if \(place\.imageUrl\)/u);
assert.match(placeRendererSource, /image\.src = place\.imageUrl/u);
assert.match(placeRendererSource, /대표 사진/u);
assert.match(placeRendererSource, /media\.dataset\.mediaSource = 'VERIFIED_PLACE_PHOTO'/u);
assert.match(placeRendererSource, /media\.dataset\.mediaSource = 'NEUTRAL_PLACE_PLACEHOLDER'/u);
assert.match(placeRendererSource, /사진 정보 없음/u);
assert.match(placeRendererSource, /const staticMapUrl = buildNaverStaticMapThumbnailUrl\(place\)/u);
assert.match(placeRendererSource, /lotbi-place-location-support/u);
assert.ok(
  placeRendererSource.indexOf("if (place.imageUrl)") < placeRendererSource.indexOf("const staticMapUrl = buildNaverStaticMapThumbnailUrl(place)"),
  'Place photo/placeholder must be primary; static map must remain secondary location support',
);
assert.match(conversationSource, /for \(const \[placeIndex, place\] of placeResult\.results\.entries\(\)\)/u);
assert.match(conversationSource, /image\.loading = placeIndex === 0 \? 'eager' : 'lazy'/u);
assert.match(conversationSource, /typeof image\.decode === 'function'/u);
assert.match(conversationSource, /image\.classList\.add\('is-ready'\)/u);
assert.match(conversationSource, /site-conversation\.css\?v=20260921-placecompactactions1/u);
assert.match(conversationSource, /로그인 없이 실제 장소 카드/u);
assert.doesNotMatch(conversationSource, /openNaverMapsPlace\([^)]*response\.placeResult/u);

const pendingImageStyle = conversationStyles.match(/\.lotbi-rich-card-place-media \.lotbi-rich-card-image \{[^}]*\}/s)?.[0] || '';
assert.match(pendingImageStyle, /opacity:\s*0\s*;/u);
const readyImageStyle = conversationStyles.match(/\.lotbi-rich-card-place-media \.lotbi-rich-card-image\.is-ready \{[^}]*\}/s)?.[0] || '';
assert.match(readyImageStyle, /opacity:\s*1\s*;/u);

const orbitStyle = conversationStyles.match(/\.lotbi-place-orbit \{[^}]*\}/s)?.[0] || '';
assert.match(orbitStyle, /position:\s*relative/u);
assert.match(orbitStyle, /display:\s*block/u);
assert.match(orbitStyle, /height:\s*352px/u);
assert.match(orbitStyle, /overflow:\s*hidden/u);
assert.match(orbitStyle, /touch-action:\s*pan-y/u);
assert.doesNotMatch(orbitStyle, /overflow-x:\s*auto|scroll-snap-type|scrollbar-width/u);

const orbitCardStyle = conversationStyles.match(/\.lotbi-place-orbit-card \{[^}]*\}/s)?.[0] || '';
assert.match(orbitCardStyle, /position:\s*absolute/u);
assert.match(orbitCardStyle, /left:\s*50%/u);
assert.match(orbitCardStyle, /width:\s*min\(38%, 276px\)/u);
assert.match(orbitCardStyle, /min-width:\s*216px/u);
assert.match(orbitCardStyle, /pointer-events:\s*auto/u);
assert.match(orbitCardStyle, /transition:/u);

const placeMediaStyle = conversationStyles.match(/\.lotbi-rich-card-place-media \{[^}]*\}/s)?.[0] || '';
assert.match(placeMediaStyle, /aspect-ratio:\s*16 \/ 9/u);
assert.match(conversationStyles, /@media \(max-width: 760px\)[\s\S]*?\.lotbi-place-orbit \{[\s\S]*?height:\s*348px/u);
assert.match(conversationStyles, /@media \(max-width: 390px\)[\s\S]*?\.lotbi-place-orbit \{[\s\S]*?height:\s*342px/u);
assert.match(conversationStyles, /@media \(max-width: 360px\)[\s\S]*?\.lotbi-place-orbit \{[\s\S]*?height:\s*334px/u);
assert.match(conversationStyles, /\.lotbi-rich-card-icon-action\s*\{[^}]*min-width:\s*72px[^}]*height:\s*44px/su);
assert.match(conversationStyles, /\.lotbi-phone-action\[data-phone-state="UNAVAILABLE"\]\s*\{[^}]*opacity:/su);

for (const slot of ['CENTER', 'LEFT_FRONT', 'RIGHT_FRONT', 'LEFT_BACK', 'RIGHT_BACK']) {
  const slotStyle = conversationStyles.match(new RegExp('\\.lotbi-place-orbit-card\\[data-orbit-slot="' + slot + '"\\] \\{[^}]*\\}', 's'))?.[0] || '';
  assert.match(slotStyle, /transform:/u);
}
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="CENTER"\]\s*\{[^}]*z-index:\s*5[^}]*opacity:\s*1/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="LEFT_FRONT"\]\s*\{[^}]*scale\(\.84\)/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="RIGHT_FRONT"\]\s*\{[^}]*scale\(\.84\)/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="LEFT_BACK"\]\s*\{[^}]*scale\(\.68\)/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="RIGHT_BACK"\]\s*\{[^}]*scale\(\.68\)/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="LEFT_FRONT"\]\s*\{[^}]*z-index:\s*4/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="RIGHT_FRONT"\]\s*\{[^}]*z-index:\s*4/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="LEFT_BACK"\]\s*\{[^}]*z-index:\s*2/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-card\[data-orbit-slot="RIGHT_BACK"\]\s*\{[^}]*z-index:\s*2/su);
assert.doesNotMatch(
  conversationStyles,
  /\.lotbi-place-orbit[^,{]*::(?:before|after)\s*\{/su,
  'Orbit must not add a pseudo-element overlay across side-card hit areas',
);
assert.match(conversationStyles, /\.lotbi-place-orbit-control-prev\s*\{[^}]*left:\s*8px/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-control-next\s*\{[^}]*right:\s*8px/su);
assert.match(conversationStyles, /\.lotbi-place-orbit-control\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/su);
assert.match(conversationStyles, /\.lotbi-place-photo-placeholder\s*\{/u);
assert.match(conversationStyles, /\.lotbi-place-location-thumbnail\s*\{/u);
assert.match(conversationStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.lotbi-place-orbit-card[\s\S]*transition:\s*none/u);

assert.match(indexSource, /site-conversation\.js\?v=[A-Za-z0-9._-]+/u, 'Home conversation runtime must remain cache-busted');
assert.match(
  conversationSource,
  /\.\/site-navigation\.js\?v=20260921-placecompactactions1/u,
  'Home Place Card runtime must keep the compact-actions navigation module',
);

console.log('NAVER Place Card CENTER BODY -> NAVER MAP + side select + drag + fallback + phone fail-safe contract: PASS');
