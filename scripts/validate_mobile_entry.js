'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const entry = require(path.join(ROOT, 'mobile-entry.js'));
const source = fs.readFileSync(path.join(ROOT, 'mobile-entry.js'), 'utf8');

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 16; SM-S938N) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
  samsungInternet: 'Mozilla/5.0 (Linux; Android 16; SM-S938N) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK 26.8.1',
  kakaoIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 26.8.1',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
  googlebotMobile: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Mobile Safari/537.36 Googlebot/2.1',
};

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

function chooser(method, pathname, userAgent, host = 'lotbiai.com') {
  return entry.shouldShowChooser({method, pathname, userAgent, host});
}

function run() {
  assert.equal(entry.isLotbiSiteHost('lotbiai.com'), true, 'public host must be accepted');
  assert.equal(entry.isLotbiSiteHost('account.lotbiai.com'), false, 'account host must stay outside chooser scope');
  assert.equal(entry.isLotbiSiteHost('evil.example'), false, 'foreign host must be rejected');

  assert.equal(entry.isMobileUserAgent(UA.androidChrome), true, 'Android Chrome must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.samsungInternet), true, 'Samsung Internet must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.iphoneSafari), true, 'iPhone Safari must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.kakaoAndroid), true, 'Kakao Android must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.kakaoIphone), true, 'Kakao iPhone must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.desktopChrome), false, 'desktop Chrome must bypass chooser');
  assert.equal(entry.isMobileUserAgent(UA.googlebotMobile), false, 'bots must bypass chooser');

  assert.equal(entry.detectMobilePlatform(UA.androidChrome), 'android');
  assert.equal(entry.detectMobilePlatform(UA.iphoneSafari), 'ios');
  assert.equal(entry.isKakaoInAppBrowser(UA.kakaoAndroid), true);
  assert.equal(entry.isKakaoInAppBrowser(UA.kakaoIphone), true);

  assert.equal(entry.LOTBI_AUTO_CHOOSER_ENABLED, false, 'normal mobile navigation must be Home-first');
  assert.equal(chooser('GET', '/', UA.androidChrome), false, 'Android root must open Home directly');
  assert.equal(chooser('GET', '/product/123', UA.androidChrome), false, 'Android subpath must open web directly');
  assert.equal(chooser('GET', '/', UA.iphoneSafari), false, 'iPhone root must open Home directly');
  assert.equal(chooser('GET', '/product/123', UA.iphoneSafari), false, 'iPhone subpath must open web directly');
  assert.equal(chooser('GET', '/', UA.samsungInternet), false, 'Samsung Internet must open Home directly');
  assert.equal(chooser('GET', '/', UA.kakaoAndroid), false, 'Kakao Android must open web directly');
  assert.equal(chooser('GET', '/', UA.kakaoIphone), false, 'Kakao iPhone must open web directly');
  assert.equal(chooser('GET', '/', UA.desktopChrome), false, 'desktop must bypass chooser');
  assert.equal(chooser('GET', '/', UA.androidChrome, 'account.lotbiai.com'), false, 'account host must bypass chooser');

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(chooser(method, '/', UA.androidChrome), false, `${method} must bypass chooser`);
  }

  for (const excluded of [
    '/assets/lotbi-main-logo.png',
    '/assets/lotbi-logo-header.png',
    '/home-chat.css',
    '/home-shell.js',
    '/font.woff2',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known',
    '/.well-known/assetlinks.json',
    '/.well-known/apple-app-site-association',
    '/api',
    '/api/health',
    '/app/open/',
    '/app/open/product/123',
  ]) {
    assert.equal(entry.isMobileEntryExcludedPath(excluded), true, `must bypass chooser: ${excluded}`);
    assert.equal(chooser('GET', excluded, UA.androidChrome), false, `chooser must not intercept: ${excluded}`);
  }

  const root = '/';
  assert.equal(entry.sanitizeLotbiTarget(root), root);
  assert.equal(entry.buildAppBridgeUrl(root, 'android'), 'https://lotbiai.com/app/open/');
  assert.equal(entry.buildAppBridgeUrl(root, 'ios'), 'https://lotbiai.com/app/open/');

  const original = '/product/123?ref=kakao&qty=2';
  assert.equal(entry.sanitizeLotbiTarget(original), original);
  assert.equal(
    entry.buildAppBridgeUrl(original, 'android'),
    'https://lotbiai.com/app/open/product/123?ref=kakao&qty=2',
  );
  assert.equal(
    entry.buildAppBridgeUrl(original, 'ios'),
    'https://lotbiai.com/app/open/product/123?ref=kakao&qty=2',
    'iOS must use the same chooser-first lotbiai.com /app/open contract',
  );
  assert.equal(entry.targetFromAppBridge('/app/open/product/123', '?ref=kakao&qty=2'), original);

  const encoded = '/product/%E3%85%87?next=a%2Fb%3Fc%3D1&note=hello%20world&encoded=%252F';
  assert.equal(entry.sanitizeLotbiTarget(encoded), encoded, 'raw encoded path/query must be preserved');
  assert.equal(
    entry.targetFromAppBridge('/app/open/product/%E3%85%87', '?next=a%2Fb%3Fc%3D1&note=hello%20world&encoded=%252F'),
    encoded,
  );

  for (const malicious of [
    '//evil.example/path?x=1',
    'https://evil.example/path',
    '/\\evil.example/path',
    '/%5cevil.example/path',
    '/product/%00bad',
    '/app/open/product/123',
  ]) {
    assert.equal(entry.sanitizeLotbiTarget(malicious), '/', `must reject malicious/recursive target: ${malicious}`);
  }

  const inertReturnUrl = '/product/123?returnUrl=https://evil.example';
  const inertBridge = entry.buildAppBridgeUrl(inertReturnUrl, 'android');
  assert.equal(inertBridge, 'https://lotbiai.com/app/open/product/123?returnUrl=https://evil.example');
  assert.equal(new URL(inertBridge).origin, 'https://lotbiai.com', 'returnUrl query must never change redirect origin');

  assert.equal(
    entry.targetWithBypass('/product/123?next=a%2Fb&note=hello%20world'),
    '/product/123?next=a%2Fb&note=hello%20world&__lotbi_web=1',
    'fallback marker must not rewrite existing encoded query',
  );
  assert.equal(
    entry.targetFromAppBridge('/app/open/app/open/product/123', ''),
    '/',
    'recursive /app/open fallback must collapse safely',
  );

  const now = 2_000_000;
  const fresh = memoryStorage({'lotbi:web-choice:v1': String(now - 1000)});
  const stale = memoryStorage({'lotbi:web-choice:v1': String(now - entry.WEB_CHOICE_TTL_MS - 1)});
  assert.equal(entry.hasFreshWebChoice(fresh, now), true, 'fresh web choice must suppress chooser');
  assert.equal(entry.hasFreshWebChoice(stale, now), false, 'expired web choice must not suppress chooser');

  assert.equal(entry.LOTBI_APP_LINK_READY, true, 'explicit /app/open bridge must remain enabled with a safe web fallback');
  assert.equal(entry.LOTBI_ANDROID_APP_LINK_READY, true, 'Android native takeover must be enabled only with the approved release association');
  assert.equal(entry.LOTBI_IOS_APP_LINK_READY, false, 'iOS native takeover must remain pending until Production AASA/device verification');
  assert.equal(entry.LOTBI_ANDROID_STORE_URL, null, 'must not invent Play Store listing');
  assert.equal(entry.LOTBI_IOS_STORE_URL, null, 'must not invent App Store listing');
  assert.equal(entry.OFFICIAL_LOGO_SRC, '/assets/lotbi-logo-header.png', 'chooser must use the authoritative LOTBI logo asset');
  assert.ok(source.includes('class="lotbi-entry-logo"'), 'chooser must render the official logo as an image');
  assert.ok(!source.includes('brand-text-logo'), 'text-only LOTBI logo must not return to the chooser');
  assert.ok(!source.includes('brand-o'), 'CSS-recolored O must not return to the chooser');
  assert.ok(!source.includes('lotbi-logo-official-color.jpg'), 'unversioned JPEG logo must not return to the chooser');
  assert.ok(!source.includes('lotbi-logo-official-d3b499fe546c.jpg'), 'white-background JPEG logo must not return to the chooser');
  assert.ok(!source.includes('lotbi-logo-official-color-d3b499fe546c.jpg'), 'old JPEG cache-bust logo must not return to the chooser');
  assert.ok(!source.includes('lotbi-logo-official-color-727a1940b747.png'), 'old PNG logo must not return to the chooser');
  assert.ok(source.includes('롯비를 어떻게 이용할까요?'));
  assert.ok(source.includes('LOTBI 앱에서 열기'));
  assert.ok(source.includes('웹으로 이용하기'));
  assert.ok(source.includes('data-lotbi-app-choice'), 'chooser app CTA must be an enabled navigation control');
  assert.ok(source.includes('LOTBI 앱을 열지 못했어요'), 'failed native takeover must render a safe web fallback');
  assert.ok(!source.includes('앱 연결 검증이 완료될 때까지 준비 중입니다.'), 'stale globally-disabled readiness notice must be removed');
  assert.ok(source.includes('앱이 열리지 않으면 외부 브라우저에서 열어 주세요.'));
  assert.ok(!source.includes('open.lotbiai.com'), 'bridge must not bypass the fixed lotbiai.com /app/open contract');
  assert.ok(!source.includes('atglife://product/'), 'must not introduce legacy scheme navigation');

  const androidAssociationPath = path.join(ROOT, '.well-known', 'assetlinks.json');
  assert.equal(fs.existsSync(androidAssociationPath), true, 'approved Android passkey association must remain published');
  const androidAssociations = JSON.parse(fs.readFileSync(androidAssociationPath, 'utf8'));
  assert.ok(Array.isArray(androidAssociations) && androidAssociations.length > 0, 'Android association file must contain approved entries');
  const productionAndroidAssociation = androidAssociations.find(item => item?.target?.package_name === 'com.lotbiai.app');
  assert.ok(productionAndroidAssociation, 'production LOTBI Android association missing');
  assert.deepEqual(
    productionAndroidAssociation.target.sha256_cert_fingerprints,
    ['56:E5:0D:D9:CD:25:BA:0C:47:80:65:64:2E:F6:B5:D2:55:90:19:9C:EC:02:BF:83:A0:62:37:19:18:F7:19:A2'],
    'approved LOTBI Android release fingerprint must remain unchanged',
  );
  assert.ok(
    productionAndroidAssociation.relation.includes('delegate_permission/common.get_login_creds'),
    'Android passkey credential-sharing relation must remain published',
  );
  assert.ok(
    productionAndroidAssociation.relation.includes('delegate_permission/common.handle_all_urls'),
    'Android App Link handling relation must be published for the production LOTBI package',
  );
  const testAuthAssociation = androidAssociations.find(item => item?.target?.package_name === 'com.lotbiai.testauth');
  assert.ok(testAuthAssociation, 'controlled test-auth association missing');
  assert.deepEqual(
    testAuthAssociation.relation,
    ['delegate_permission/common.get_login_creds'],
    'controlled test-auth package must remain credential-sharing only',
  );
  for (const item of androidAssociations) {
    assert.ok(Array.isArray(item?.relation), 'Android association relation must be explicit');
    assert.equal(item?.target?.namespace, 'android_app', 'Android association target namespace changed');
  }
  assert.equal(fs.existsSync(path.join(ROOT, '.well-known', 'apple-app-site-association')), false, 'must not guess Apple association identity');
  assert.equal(fs.existsSync(path.join(ROOT, 'apple-app-site-association')), false, 'must not publish guessed root AASA');

  for (const page of ['index.html', 'privacy.html', 'terms.html', 'account-deletion.html', 'contact.html', 'about.html', '404.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.includes('mobile-entry.css'), `${page} must load mobile chooser CSS`);
    assert.ok(html.includes('mobile-entry.js'), `${page} must load mobile chooser runtime`);
  }

  console.log('MOBILE HOME-FIRST VALIDATION PASS — automatic mobile chooser disabled; explicit same-origin /app/open bridge, Android release association, safe web fallback, platform boundaries and redirect protections preserved.');
}

run();
