'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const entry = require(path.join(ROOT, 'mobile-entry.js'));
const source = fs.readFileSync(path.join(ROOT, 'mobile-entry.js'), 'utf8');

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 16; SM-S938N) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
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

function run() {
  assert.equal(entry.isMobileUserAgent(UA.androidChrome), true, 'Android Chrome must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.iphoneSafari), true, 'iPhone Safari must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.kakaoAndroid), true, 'Kakao Android must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.kakaoIphone), true, 'Kakao iPhone must be mobile');
  assert.equal(entry.isMobileUserAgent(UA.desktopChrome), false, 'desktop Chrome must bypass chooser');
  assert.equal(entry.isMobileUserAgent(UA.googlebotMobile), false, 'bots must bypass chooser');

  assert.equal(entry.detectMobilePlatform(UA.androidChrome), 'android');
  assert.equal(entry.detectMobilePlatform(UA.iphoneSafari), 'ios');
  assert.equal(entry.isKakaoInAppBrowser(UA.kakaoAndroid), true);
  assert.equal(entry.isKakaoInAppBrowser(UA.kakaoIphone), true);

  assert.equal(entry.shouldShowChooser({method: 'GET', pathname: '/', userAgent: UA.androidChrome}), true);
  assert.equal(entry.shouldShowChooser({method: 'GET', pathname: '/product/123', userAgent: UA.iphoneSafari}), true);
  assert.equal(entry.shouldShowChooser({method: 'POST', pathname: '/', userAgent: UA.androidChrome}), false);
  assert.equal(entry.shouldShowChooser({method: 'GET', pathname: '/', userAgent: UA.desktopChrome}), false);

  for (const excluded of [
    '/assets/lotbi-main-logo.png',
    '/home-chat.css',
    '/home-shell.js',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known/assetlinks.json',
    '/.well-known/apple-app-site-association',
    '/app/open/',
    '/app/open/product/123',
  ]) {
    assert.equal(entry.isMobileEntryExcludedPath(excluded), true, `must bypass chooser: ${excluded}`);
  }

  const original = '/product/123?ref=kakao&qty=2';
  assert.equal(entry.sanitizeLotbiTarget(original), original);
  assert.equal(
    entry.buildAppBridgeUrl(original, 'android'),
    'https://lotbiai.com/app/open/product/123?ref=kakao&qty=2',
  );
  assert.equal(
    entry.buildAppBridgeUrl(original, 'ios'),
    'https://open.lotbiai.com/app/open/product/123?ref=kakao&qty=2',
  );
  assert.equal(entry.targetFromAppBridge('/app/open/product/123', '?ref=kakao&qty=2'), original);

  const encoded = '/product/%E3%85%87?next=a%2Fb%3Fc%3D1&note=hello%20world&encoded=%252F';
  assert.equal(entry.sanitizeLotbiTarget(encoded), encoded, 'raw encoded path/query must be preserved');
  assert.equal(
    entry.targetFromAppBridge('/app/open/product/%E3%85%87', '?next=a%2Fb%3Fc%3D1&note=hello%20world&encoded=%252F'),
    encoded,
  );

  assert.equal(entry.sanitizeLotbiTarget('//evil.example/path?x=1'), '/');
  assert.equal(entry.sanitizeLotbiTarget('https://evil.example/path'), '/');
  assert.equal(entry.sanitizeLotbiTarget('/\\evil.example/path'), '/');
  assert.equal(entry.sanitizeLotbiTarget('/assets/secret.json'), '/');

  assert.equal(
    entry.targetWithBypass('/product/123?next=a%2Fb&note=hello%20world'),
    '/product/123?next=a%2Fb&note=hello%20world&__lotbi_web=1',
    'fallback marker must not rewrite existing encoded query',
  );

  const now = 2_000_000;
  const fresh = memoryStorage({'lotbi:web-choice:v1': String(now - 1000)});
  const stale = memoryStorage({'lotbi:web-choice:v1': String(now - entry.WEB_CHOICE_TTL_MS - 1)});
  assert.equal(entry.hasFreshWebChoice(fresh, now), true, 'fresh web choice must suppress chooser');
  assert.equal(entry.hasFreshWebChoice(stale, now), false, 'expired web choice must not suppress chooser');

  assert.equal(entry.LOTBI_APP_LINK_READY, false, 'app CTA must remain fail-closed before production association E2E');
  assert.equal(entry.LOTBI_ANDROID_STORE_URL, null, 'must not invent Play Store listing');
  assert.equal(entry.LOTBI_IOS_STORE_URL, null, 'must not invent App Store listing');
  assert.ok(source.includes('롯비를 어떻게 이용할까요?'));
  assert.ok(source.includes('LOTBI 앱에서 열기'));
  assert.ok(source.includes('웹으로 이용하기'));
  assert.ok(source.includes('카카오톡 오른쪽 위 메뉴에서 외부 브라우저로 열어 주세요.'));
  assert.ok(!source.includes('atglife://product/'), 'must not introduce legacy scheme navigation');

  for (const page of ['index.html', 'privacy.html', 'terms.html', 'account-deletion.html', 'contact.html', 'about.html', '404.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.includes('mobile-entry.css'), `${page} must load mobile chooser CSS`);
    assert.ok(html.includes('mobile-entry.js'), `${page} must load mobile chooser runtime`);
  }

  console.log('MOBILE ENTRY VALIDATION PASS — mobile UAs, chooser-first exclusions, exact target preservation, fail-closed app CTA, loop bypass and open-redirect boundaries verified.');
}

run();
