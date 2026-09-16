import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const entry = require('../mobile-entry.js');

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 16; SM-S938N) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1';
const KAKAO_ANDROID = ANDROID_CHROME + ' KAKAOTALK 26.7.0';
const KAKAO_IOS = IPHONE + ' KAKAOTALK 26.7.0';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';

function show(ua, pathname = '/', extra = {}) {
  return entry.shouldShowChooser({
    method: 'GET',
    host: 'lotbiai.com',
    pathname,
    userAgent: ua,
    hasWebBypass: false,
    ...extra,
  });
}

test('mobile chooser covers Android, Samsung Internet, iPhone and KakaoTalk UAs', () => {
  assert.equal(show(ANDROID_CHROME), true);
  assert.equal(show(ANDROID_CHROME, '/product/123'), true);
  assert.equal(show(SAMSUNG), true);
  assert.equal(show(IPHONE), true);
  assert.equal(show(IPHONE, '/product/123'), true);
  assert.equal(show(KAKAO_ANDROID), true);
  assert.equal(show(KAKAO_IOS), true);
  assert.equal(entry.isKakaoInAppBrowser(KAKAO_ANDROID), true);
  assert.equal(entry.isKakaoInAppBrowser(KAKAO_IOS), true);
});

test('desktop, bot, non-GET, wrong host and bypass do not show chooser', () => {
  assert.equal(show(DESKTOP), false);
  assert.equal(show('Googlebot-Mobile Android'), false);
  assert.equal(show(ANDROID_CHROME, '/', {method: 'POST'}), false);
  assert.equal(show(ANDROID_CHROME, '/', {method: 'PUT'}), false);
  assert.equal(show(ANDROID_CHROME, '/', {method: 'PATCH'}), false);
  assert.equal(show(ANDROID_CHROME, '/', {method: 'DELETE'}), false);
  assert.equal(show(ANDROID_CHROME, '/', {host: 'account.lotbiai.com'}), false);
  assert.equal(show(ANDROID_CHROME, '/', {hasWebBypass: true}), false);
});

test('static, machine-readable, association, API and bridge paths are excluded', () => {
  for (const path of [
    '/app.js', '/styles.css', '/image.png', '/font.woff2', '/favicon.ico', '/robots.txt', '/sitemap.xml',
    '/.well-known/assetlinks.json', '/.well-known/apple-app-site-association', '/api/health', '/app/open/', '/app/open/product/123'
  ]) {
    assert.equal(entry.isExcludedPath(path), true, path);
    assert.equal(show(ANDROID_CHROME, path), false, path);
  }
});

test('path and raw query encoding are preserved in app bridge', () => {
  assert.equal(entry.buildAppBridgePath('/'), '/app/open/');
  assert.equal(entry.buildAppBridgePath('/product/123'), '/app/open/product/123');
  assert.equal(
    entry.buildAppBridgePath('/product/123?ref=kakao&qty=2'),
    '/app/open/product/123?ref=kakao&qty=2'
  );
  assert.equal(
    entry.buildAppBridgePath('/product/%ED%95%9C%EA%B8%80?q=a%20b%2Bc&next=%2Ffoo%3Fx%3D1'),
    '/app/open/product/%ED%95%9C%EA%B8%80?q=a%20b%2Bc&next=%2Ffoo%3Fx%3D1'
  );
});

test('bridge fallback restores original target without recursion', () => {
  assert.equal(entry.targetFromAppBridge('/app/open/', ''), '/');
  assert.equal(entry.targetFromAppBridge('/app/open/product/123', '?ref=kakao&qty=2'), '/product/123?ref=kakao&qty=2');
  assert.equal(entry.targetFromAppBridge('/app/open/app/open/product/123', ''), '/');
  assert.equal(entry.targetFromAppBridge('/not-bridge/product/123', ''), '/');
});

test('web bypass is internal, short-lived and query-safe', () => {
  assert.equal(
    entry.withWebBypass('/product/123?ref=kakao&encoded=a%20b%2Bc'),
    '/product/123?ref=kakao&encoded=a%20b%2Bc&__lotbi_web=1'
  );
  assert.equal(entry.queryHasBypass('?ref=kakao&__lotbi_web=1'), true);
  assert.equal(entry.queryHasBypass('?ref=kakao'), false);
  assert.equal(entry.cleanWebBypass('/product/123?ref=kakao&__lotbi_web=1&encoded=a%20b%2Bc'), '/product/123?ref=kakao&encoded=a%20b%2Bc');
  assert.match(entry.webChoiceCookieString(), /^__Host-lotbi_web_choice=1;/);
  assert.match(entry.webChoiceCookieString(), /Path=\//);
  assert.match(entry.webChoiceCookieString(), /Max-Age=600/);
  assert.match(entry.webChoiceCookieString(), /Secure/);
  assert.match(entry.webChoiceCookieString(), /SameSite=Lax/);
  assert.doesNotMatch(entry.webChoiceCookieString(), /Domain=/i);
});

test('open redirect, backslash and null-byte forms are rejected', () => {
  for (const target of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%5cevil.example',
    '/product/%00bad',
    '/app/open/product/123'
  ]) {
    assert.equal(entry.sanitizeInternalTarget(target), '/', target);
  }
  assert.equal(entry.withWebBypass('https://evil.example'), '/?__lotbi_web=1');
  assert.equal(entry.buildAppBridgePath('//evil.example'), '/app/open/');
  assert.equal(entry.targetFromAppBridge('/app/open//evil.example', ''), '/');
});

test('platform detection and production activation remain fail-closed', () => {
  assert.equal(entry.detectMobilePlatform(ANDROID_CHROME), 'android');
  assert.equal(entry.detectMobilePlatform(IPHONE), 'ios');
  assert.equal(entry.detectMobilePlatform(DESKTOP), 'other');
  assert.equal(entry.APP_LINK_READY, false);
});
