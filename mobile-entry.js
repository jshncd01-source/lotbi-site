(function (global) {
  'use strict';

  const LOTBI_ORIGIN = 'https://lotbiai.com';
  const LOTBI_HOST = 'lotbiai.com';
  const APP_BRIDGE_PREFIX = '/app/open';
  const WEB_BYPASS_PARAM = '__lotbi_web';
  const WEB_CHOICE_KEY = 'lotbi:web-choice:v1';
  const WEB_CHOICE_TTL_MS = 10 * 60 * 1000;
  const OFFICIAL_LOGO_SRC = '/assets/lotbi-logo-header.png';

  // Production association is intentionally fail-closed until the real Google
  // Play app-signing certificate, Apple Team ID, association files, and
  // installed-device restoration are all verified.
  const LOTBI_APP_LINK_READY = false;
  const LOTBI_ANDROID_STORE_URL = null;
  const LOTBI_IOS_STORE_URL = null;

  const BOT_USER_AGENT = /bot|crawler|spider|slurp|bingpreview|googleother/i;
  const MOBILE_USER_AGENT = /android|iphone|ipad|ipod|mobile/i;
  const STATIC_EXTENSION = /\.(?:js|css|png|jpe?g|gif|svg|webp|avif|ico|map|txt|xml|json|webmanifest|woff2?|ttf|otf|pdf|csv)$/i;

  function isLotbiSiteHost(rawHost) {
    return String(rawHost || '').trim().toLowerCase() === LOTBI_HOST;
  }

  function detectMobilePlatform(userAgent) {
    const ua = userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || /macintosh.*mobile/i.test(ua)) return 'ios';
    return 'other';
  }

  function isMobileUserAgent(userAgent) {
    const ua = userAgent || '';
    return MOBILE_USER_AGENT.test(ua) && !BOT_USER_AGENT.test(ua);
  }

  function isKakaoInAppBrowser(userAgent) {
    return /kakaotalk/i.test(userAgent || '');
  }

  function isMobileEntryExcludedPath(pathname) {
    const path = pathname || '/';
    if (
      path === APP_BRIDGE_PREFIX ||
      path.startsWith(`${APP_BRIDGE_PREFIX}/`) ||
      path === '/auth' ||
      path.startsWith('/auth/') ||
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path === '/sitemap.xml' ||
      path === '/.well-known' ||
      path.startsWith('/.well-known/') ||
      path === '/api' ||
      path.startsWith('/api/') ||
      path.startsWith('/assets/') ||
      path.startsWith('/scripts/')
    ) {
      return true;
    }
    return STATIC_EXTENSION.test(path);
  }

  function decodedFormPart(raw) {
    try {
      return decodeURIComponent(String(raw || '').replace(/\+/g, ' '));
    } catch (_error) {
      return String(raw || '');
    }
  }

  function queryPairParts(pair) {
    const separator = pair.indexOf('=');
    if (separator < 0) return [pair, ''];
    return [pair.slice(0, separator), pair.slice(separator + 1)];
  }

  function stripInternalBypass(rawSearch) {
    if (!rawSearch || rawSearch === '?') return '';
    const kept = rawSearch.slice(1).split('&').filter(function (pair) {
      const parts = queryPairParts(pair);
      return decodedFormPart(parts[0]) !== WEB_BYPASS_PARAM;
    });
    return kept.length ? `?${kept.join('&')}` : '';
  }

  function hasWebBypass(rawSearch) {
    if (!rawSearch) return false;
    return rawSearch.slice(1).split('&').some(function (pair) {
      const parts = queryPairParts(pair);
      return decodedFormPart(parts[0]) === WEB_BYPASS_PARAM && decodedFormPart(parts[1]) === '1';
    });
  }

  function rawTargetParts(target) {
    const withoutHash = target.split('#', 1)[0];
    const queryIndex = withoutHash.indexOf('?');
    if (queryIndex < 0) return {pathname: withoutHash, search: ''};
    return {pathname: withoutHash.slice(0, queryIndex), search: withoutHash.slice(queryIndex)};
  }

  function sanitizeLotbiTarget(rawTarget) {
    if (!rawTarget || typeof rawTarget !== 'string') return '/';
    if (!rawTarget.startsWith('/') || rawTarget.startsWith('//')) return '/';
    if (rawTarget.includes('\\') || rawTarget.includes('\0') || /%5c|%00/i.test(rawTarget)) return '/';

    let url;
    try {
      url = new URL(rawTarget, LOTBI_ORIGIN);
    } catch (_error) {
      return '/';
    }

    if (url.origin !== LOTBI_ORIGIN) return '/';
    if (isMobileEntryExcludedPath(url.pathname)) return '/';

    const raw = rawTargetParts(rawTarget);
    return `${raw.pathname || '/'}${stripInternalBypass(raw.search)}`;
  }

  function buildAppBridgeUrl(target, _platform) {
    const safeTarget = sanitizeLotbiTarget(target);
    const raw = rawTargetParts(safeTarget);
    const bridgePath = `${APP_BRIDGE_PREFIX}${raw.pathname === '/' ? '/' : raw.pathname}${raw.search}`;
    return `${LOTBI_ORIGIN}${bridgePath}`;
  }

  function targetFromAppBridge(pathname, search) {
    const path = pathname || '/';
    if (path !== APP_BRIDGE_PREFIX && !path.startsWith(`${APP_BRIDGE_PREFIX}/`)) return '/';
    const suffix = path.slice(APP_BRIDGE_PREFIX.length);
    const restoredPath = suffix === '' || suffix === '/' ? '/' : suffix;
    return sanitizeLotbiTarget(`${restoredPath}${search || ''}`);
  }

  function safeSessionStorage(windowObject) {
    try {
      return windowObject.sessionStorage;
    } catch (_error) {
      return null;
    }
  }

  function recordWebChoice(storage, now) {
    if (!storage) return false;
    try {
      storage.setItem(WEB_CHOICE_KEY, String(now));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function hasFreshWebChoice(storage, now) {
    if (!storage) return false;
    try {
      const raw = storage.getItem(WEB_CHOICE_KEY);
      if (!raw) return false;
      const chosenAt = Number(raw);
      if (!Number.isFinite(chosenAt) || chosenAt > now || now - chosenAt > WEB_CHOICE_TTL_MS) {
        storage.removeItem(WEB_CHOICE_KEY);
        return false;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function targetWithBypass(target) {
    const safeTarget = sanitizeLotbiTarget(target);
    const raw = rawTargetParts(safeTarget);
    const separator = raw.search ? '&' : '?';
    return `${raw.pathname}${raw.search}${separator}${WEB_BYPASS_PARAM}=1`;
  }

  function consumeBypassParameter(windowObject, storage, now) {
    const rawSearch = windowObject.location.search || '';
    if (!hasWebBypass(rawSearch)) return false;
    recordWebChoice(storage, now);
    const clean = `${windowObject.location.pathname}${stripInternalBypass(rawSearch)}${windowObject.location.hash || ''}`;
    if (windowObject.history && typeof windowObject.history.replaceState === 'function') {
      windowObject.history.replaceState(null, '', clean);
    }
    return true;
  }

  function officialLogoMarkup() {
    return `<img class="lotbi-entry-logo" src="${OFFICIAL_LOGO_SRC}" alt="LOTBI" width="334" height="96" decoding="async">`;
  }

  function makeOverlay(documentObject) {
    const overlay = documentObject.createElement('div');
    overlay.className = 'lotbi-mobile-entry';
    overlay.setAttribute('data-lotbi-mobile-entry', '');
    return overlay;
  }

  function lockPage(documentObject) {
    documentObject.documentElement.classList.add('lotbi-mobile-entry-lock');
  }

  function unlockPage(documentObject) {
    documentObject.documentElement.classList.remove('lotbi-mobile-entry-lock');
  }

  function renderChooser(windowObject, target, platform, inKakao) {
    const documentObject = windowObject.document;
    if (documentObject.querySelector('[data-lotbi-mobile-entry]')) return;

    const overlay = makeOverlay(documentObject);
    const appControl = LOTBI_APP_LINK_READY
      ? `<a class="lotbi-entry-action lotbi-entry-action-primary" href="${buildAppBridgeUrl(target, platform)}" rel="external">LOTBI 앱에서 열기</a>`
      : '<button class="lotbi-entry-action lotbi-entry-action-primary" type="button" disabled aria-disabled="true">LOTBI 앱에서 열기</button><p class="lotbi-entry-status">앱 연결 검증이 완료될 때까지 준비 중입니다.</p>';

    overlay.innerHTML = `
      <section class="lotbi-entry-card" role="dialog" aria-modal="true" aria-labelledby="lotbi-entry-title">
        ${officialLogoMarkup()}
        <div class="lotbi-entry-copy">
          <p class="lotbi-entry-eyebrow">모바일 이용 안내</p>
          <h1 id="lotbi-entry-title">롯비를 어떻게 이용할까요?</h1>
          <p>처음 열었던 LOTBI 주소를 그대로 유지합니다.</p>
        </div>
        <div class="lotbi-entry-actions">
          ${appControl}
          <button class="lotbi-entry-action lotbi-entry-action-secondary" type="button" data-lotbi-web-choice>웹으로 이용하기</button>
        </div>
        ${inKakao ? '<p class="lotbi-entry-notice">앱이 열리지 않으면 외부 브라우저에서 열어 주세요. 카카오톡에서는 오른쪽 위 메뉴를 이용할 수 있습니다.</p>' : ''}
      </section>`;

    overlay.querySelector('[data-lotbi-web-choice]').addEventListener('click', function () {
      const storage = safeSessionStorage(windowObject);
      recordWebChoice(storage, Date.now());
      overlay.remove();
      unlockPage(documentObject);
    });

    documentObject.body.appendChild(overlay);
    lockPage(documentObject);
  }

  function renderBridgeFallback(windowObject, target) {
    const documentObject = windowObject.document;
    if (documentObject.querySelector('[data-lotbi-mobile-entry]')) return;

    const overlay = makeOverlay(documentObject);
    overlay.innerHTML = `
      <section class="lotbi-entry-card" role="dialog" aria-modal="true" aria-labelledby="lotbi-bridge-title">
        ${officialLogoMarkup()}
        <div class="lotbi-entry-copy">
          <p class="lotbi-entry-eyebrow">앱 연결</p>
          <h1 id="lotbi-bridge-title">LOTBI 앱 준비 중</h1>
          <p>이 기기에서 앱 연결을 완료하지 못했습니다. 원래 LOTBI 주소로 안전하게 돌아갈 수 있습니다.</p>
        </div>
        <div class="lotbi-entry-actions">
          <button class="lotbi-entry-action lotbi-entry-action-primary" type="button" disabled aria-disabled="true">LOTBI 앱에서 열기</button>
          <button class="lotbi-entry-action lotbi-entry-action-secondary" type="button" data-lotbi-bridge-web>웹으로 이용하기</button>
        </div>
      </section>`;

    overlay.querySelector('[data-lotbi-bridge-web]').addEventListener('click', function () {
      const storage = safeSessionStorage(windowObject);
      const stored = recordWebChoice(storage, Date.now());
      windowObject.location.replace(stored ? target : targetWithBypass(target));
    });

    documentObject.body.appendChild(overlay);
    lockPage(documentObject);
  }

  function shouldShowChooser(options) {
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET') return false;
    if (options.host && !isLotbiSiteHost(options.host)) return false;
    if (isMobileEntryExcludedPath(options.pathname || '/')) return false;
    return isMobileUserAgent(options.userAgent || '');
  }

  function init(windowObject) {
    if (!windowObject || !windowObject.document || !windowObject.location) return;
    if (!isLotbiSiteHost(windowObject.location.hostname)) return;

    const pathname = windowObject.location.pathname || '/';
    const search = windowObject.location.search || '';
    const storage = safeSessionStorage(windowObject);
    const now = Date.now();

    if (pathname === APP_BRIDGE_PREFIX || pathname.startsWith(`${APP_BRIDGE_PREFIX}/`)) {
      renderBridgeFallback(windowObject, targetFromAppBridge(pathname, search));
      return;
    }

    if (isMobileEntryExcludedPath(pathname)) return;
    if (consumeBypassParameter(windowObject, storage, now)) return;
    if (hasFreshWebChoice(storage, now)) return;

    const userAgent = windowObject.navigator ? windowObject.navigator.userAgent : '';
    if (!shouldShowChooser({method: 'GET', host: windowObject.location.hostname, pathname, userAgent})) return;

    const target = sanitizeLotbiTarget(`${pathname}${search}`);
    renderChooser(windowObject, target, detectMobilePlatform(userAgent), isKakaoInAppBrowser(userAgent));
  }

  const api = {
    LOTBI_ORIGIN,
    LOTBI_HOST,
    APP_BRIDGE_PREFIX,
    WEB_BYPASS_PARAM,
    WEB_CHOICE_TTL_MS,
    LOTBI_APP_LINK_READY,
    LOTBI_ANDROID_STORE_URL,
    LOTBI_IOS_STORE_URL,
    OFFICIAL_LOGO_SRC,
    isLotbiSiteHost,
    detectMobilePlatform,
    isMobileUserAgent,
    isKakaoInAppBrowser,
    isMobileEntryExcludedPath,
    sanitizeLotbiTarget,
    buildAppBridgeUrl,
    targetFromAppBridge,
    targetWithBypass,
    hasFreshWebChoice,
    shouldShowChooser,
    init,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LotbiMobileEntry = api;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { init(global); }, {once: true});
    } else {
      init(global);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
