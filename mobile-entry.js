(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LOTBIMobileEntry = Object.freeze(api);
    api.boot();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SITE_ORIGIN = 'https://lotbiai.com';
  const SITE_HOST = 'lotbiai.com';
  const APP_BRIDGE_PREFIX = '/app/open';
  const WEB_BYPASS_PARAM = '__lotbi_web';
  const WEB_BYPASS_COOKIE = '__Host-lotbi_web_choice';
  const WEB_BYPASS_MAX_AGE_SECONDS = 10 * 60;
  const APP_LINK_READY = false;

  const BOT_USER_AGENT = /bot|crawler|spider|slurp|bingpreview|googleother/i;
  const MOBILE_USER_AGENT = /android|iphone|ipad|ipod|mobile/i;
  const STATIC_EXTENSION = /\.(?:js|css|png|jpe?g|gif|svg|webp|avif|ico|map|txt|xml|json|webmanifest|woff2?|ttf|otf|eot|pdf)$/i;

  function normalizeHost(rawHost) {
    if (!rawHost) return '';
    const first = String(rawHost).split(',', 1)[0].trim().toLowerCase();
    if (first.startsWith('[')) {
      const end = first.indexOf(']');
      return end >= 0 ? first.slice(1, end) : first;
    }
    return first.split(':', 1)[0];
  }

  function isLotbiSiteHost(rawHost) {
    return normalizeHost(rawHost) === SITE_HOST;
  }

  function isMobileUserAgent(userAgent) {
    const ua = userAgent || '';
    return MOBILE_USER_AGENT.test(ua) && !BOT_USER_AGENT.test(ua);
  }

  function isKakaoInAppBrowser(userAgent) {
    return /kakaotalk/i.test(userAgent || '');
  }

  function detectMobilePlatform(userAgent) {
    const ua = userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || /macintosh.*mobile/i.test(ua)) return 'ios';
    return 'other';
  }

  function isExcludedPath(pathname) {
    const path = pathname || '/';
    if (
      path === APP_BRIDGE_PREFIX ||
      path.startsWith(APP_BRIDGE_PREFIX + '/') ||
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path === '/sitemap.xml' ||
      path.startsWith('/.well-known/') ||
      path.startsWith('/api/') ||
      path.startsWith('/_next/')
    ) {
      return true;
    }
    return STATIC_EXTENSION.test(path);
  }

  function splitTarget(rawTarget) {
    const hashIndex = rawTarget.indexOf('#');
    const withoutHash = hashIndex >= 0 ? rawTarget.slice(0, hashIndex) : rawTarget;
    const queryIndex = withoutHash.indexOf('?');
    if (queryIndex < 0) return { path: withoutHash, query: '' };
    return {
      path: withoutHash.slice(0, queryIndex),
      query: withoutHash.slice(queryIndex + 1),
    };
  }

  function decodedQueryKey(segment) {
    const eq = segment.indexOf('=');
    const rawKey = eq >= 0 ? segment.slice(0, eq) : segment;
    try {
      return decodeURIComponent(rawKey.replace(/\+/g, '%20'));
    } catch (_) {
      return rawKey;
    }
  }

  function queryHasBypass(search) {
    const raw = (search || '').replace(/^\?/, '');
    if (!raw) return false;
    return raw.split('&').some(function (segment) {
      if (!segment) return false;
      if (decodedQueryKey(segment) !== WEB_BYPASS_PARAM) return false;
      const eq = segment.indexOf('=');
      if (eq < 0) return true;
      let value = segment.slice(eq + 1);
      try {
        value = decodeURIComponent(value.replace(/\+/g, '%20'));
      } catch (_) {
        // Keep the raw value when malformed; it will not equal "1".
      }
      return value === '1';
    });
  }

  function stripBypassFromQuery(rawQuery) {
    if (!rawQuery) return '';
    return rawQuery
      .split('&')
      .filter(function (segment) {
        return segment && decodedQueryKey(segment) !== WEB_BYPASS_PARAM;
      })
      .join('&');
  }

  function sanitizeInternalTarget(rawTarget, origin) {
    const baseOrigin = origin || SITE_ORIGIN;
    if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/') || rawTarget.startsWith('//')) return '/';
    if (/\\|%5c|%00/i.test(rawTarget) || rawTarget.indexOf('\0') >= 0) return '/';

    const parts = splitTarget(rawTarget);
    let url;
    try {
      url = new URL(parts.path || '/', baseOrigin);
    } catch (_) {
      return '/';
    }

    if (url.origin !== baseOrigin) return '/';
    if (url.pathname === APP_BRIDGE_PREFIX || url.pathname.startsWith(APP_BRIDGE_PREFIX + '/')) return '/';
    if (isExcludedPath(url.pathname)) return '/';

    const query = stripBypassFromQuery(parts.query);
    return url.pathname + (query ? '?' + query : '');
  }

  function withWebBypass(target) {
    const safe = sanitizeInternalTarget(target);
    const parts = splitTarget(safe);
    const query = stripBypassFromQuery(parts.query);
    const suffix = WEB_BYPASS_PARAM + '=1';
    return parts.path + '?' + (query ? query + '&' : '') + suffix;
  }

  function cleanWebBypass(target) {
    return sanitizeInternalTarget(target);
  }

  function buildAppBridgePath(target) {
    const safe = sanitizeInternalTarget(target);
    const parts = splitTarget(safe);
    const path = parts.path === '/' ? '/' : parts.path;
    return APP_BRIDGE_PREFIX + path + (parts.query ? '?' + parts.query : '');
  }

  function targetFromAppBridge(pathname, search) {
    if (pathname !== APP_BRIDGE_PREFIX && !pathname.startsWith(APP_BRIDGE_PREFIX + '/')) return '/';
    const suffix = pathname.slice(APP_BRIDGE_PREFIX.length);
    const restoredPath = suffix === '' || suffix === '/' ? '/' : suffix;
    return sanitizeInternalTarget(restoredPath + (search || ''));
  }

  function shouldShowChooser(options) {
    const opts = options || {};
    if ((opts.method || 'GET').toUpperCase() !== 'GET') return false;
    if (!isLotbiSiteHost(opts.host)) return false;
    if (isExcludedPath(opts.pathname || '/')) return false;
    if (!isMobileUserAgent(opts.userAgent || '')) return false;
    if (opts.hasWebBypass) return false;
    return true;
  }

  function webChoiceCookieString() {
    return WEB_BYPASS_COOKIE + '=1; Path=/; Max-Age=' + WEB_BYPASS_MAX_AGE_SECONDS + '; Secure; SameSite=Lax';
  }

  function hasWebChoiceCookie(cookieString) {
    const raw = cookieString || '';
    return raw.split(';').some(function (item) {
      const pair = item.trim();
      return pair === WEB_BYPASS_COOKIE + '=1';
    });
  }

  function currentTarget(locationLike) {
    return sanitizeInternalTarget((locationLike.pathname || '/') + (locationLike.search || ''));
  }

  function injectStyles(doc) {
    if (doc.getElementById('lotbi-mobile-entry-style')) return;
    const style = doc.createElement('style');
    style.id = 'lotbi-mobile-entry-style';
    style.textContent = [
      'html.lotbi-mobile-entry-active,html.lotbi-mobile-entry-active body{overflow:hidden!important;}',
      'html.lotbi-mobile-entry-active body>*:not(#lotbi-mobile-entry-root){visibility:hidden!important;}',
      '#lotbi-mobile-entry-root{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(247,249,252,.98);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;box-sizing:border-box;}',
      '#lotbi-mobile-entry-root *{box-sizing:border-box;}',
      '.lotbi-entry-card{width:min(100%,420px);background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px 22px;box-shadow:0 20px 60px rgba(15,23,42,.14);text-align:center;}',
      '.lotbi-entry-brand{font-size:22px;font-weight:800;letter-spacing:.04em;margin-bottom:22px;}',
      '.lotbi-entry-brand-o{color:#ff6b35;}',
      '.lotbi-entry-card h1{margin:0 0 10px;font-size:24px;line-height:1.35;letter-spacing:-.02em;}',
      '.lotbi-entry-copy{margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.6;}',
      '.lotbi-entry-actions{display:grid;gap:10px;}',
      '.lotbi-entry-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border-radius:14px;border:1px solid #d1d5db;padding:0 18px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;}',
      '.lotbi-entry-button-primary{background:#111827;color:#fff;border-color:#111827;}',
      '.lotbi-entry-button-secondary{background:#fff;color:#111827;}',
      '.lotbi-entry-button:disabled{cursor:not-allowed;background:#f3f4f6;color:#9ca3af;border-color:#e5e7eb;}',
      '.lotbi-entry-note{margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.55;}',
      '.lotbi-entry-target{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.45;overflow-wrap:anywhere;text-align:left;}',
      '@media (prefers-reduced-motion:no-preference){.lotbi-entry-card{animation:lotbiEntryIn .18s ease-out;}@keyframes lotbiEntryIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function brandNode(doc) {
    const brand = doc.createElement('div');
    brand.className = 'lotbi-entry-brand';
    brand.setAttribute('aria-label', 'LOTBI');
    brand.append('L');
    const o = doc.createElement('span');
    o.className = 'lotbi-entry-brand-o';
    o.textContent = 'O';
    o.setAttribute('aria-hidden', 'true');
    brand.appendChild(o);
    brand.append('TBI');
    return brand;
  }

  function markBackgroundInert(doc, rootNode) {
    Array.prototype.forEach.call(doc.body.children, function (node) {
      if (node === rootNode) return;
      if (!node.hasAttribute('inert')) {
        node.setAttribute('data-lotbi-entry-inerted', '1');
        node.setAttribute('inert', '');
      }
    });
  }

  function restoreBackground(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-lotbi-entry-inerted="1"]'), function (node) {
      node.removeAttribute('inert');
      node.removeAttribute('data-lotbi-entry-inerted');
    });
  }

  function renderChooser(win, target, userAgent) {
    const doc = win.document;
    injectStyles(doc);
    const rootNode = doc.createElement('div');
    rootNode.id = 'lotbi-mobile-entry-root';
    rootNode.setAttribute('role', 'dialog');
    rootNode.setAttribute('aria-modal', 'true');
    rootNode.setAttribute('aria-labelledby', 'lotbi-entry-title');

    const card = doc.createElement('section');
    card.className = 'lotbi-entry-card';
    card.appendChild(brandNode(doc));

    const title = doc.createElement('h1');
    title.id = 'lotbi-entry-title';
    title.textContent = '롯비를 어떻게 이용할까요?';
    card.appendChild(title);

    const copy = doc.createElement('p');
    copy.className = 'lotbi-entry-copy';
    copy.textContent = '원래 요청한 페이지와 정보를 유지한 채 이용 방법을 선택할 수 있습니다.';
    card.appendChild(copy);

    const actions = doc.createElement('div');
    actions.className = 'lotbi-entry-actions';

    const appButton = doc.createElement('button');
    appButton.type = 'button';
    appButton.className = 'lotbi-entry-button lotbi-entry-button-primary';
    if (APP_LINK_READY) {
      appButton.textContent = 'LOTBI 앱에서 열기';
      appButton.addEventListener('click', function () {
        win.location.assign(buildAppBridgePath(target));
      });
    } else {
      appButton.textContent = 'LOTBI 앱 준비 중';
      appButton.disabled = true;
      appButton.setAttribute('aria-disabled', 'true');
    }
    actions.appendChild(appButton);

    const webButton = doc.createElement('button');
    webButton.type = 'button';
    webButton.className = 'lotbi-entry-button lotbi-entry-button-secondary';
    webButton.textContent = '웹으로 이용하기';
    webButton.addEventListener('click', function () {
      doc.cookie = webChoiceCookieString();
      restoreBackground(doc);
      doc.documentElement.classList.remove('lotbi-mobile-entry-active');
      rootNode.remove();
    });
    actions.appendChild(webButton);
    card.appendChild(actions);

    if (isKakaoInAppBrowser(userAgent)) {
      const note = doc.createElement('p');
      note.className = 'lotbi-entry-note';
      note.textContent = '앱이 열리지 않으면 외부 브라우저에서 열어 주세요.';
      card.appendChild(note);
    }

    rootNode.appendChild(card);
    doc.body.appendChild(rootNode);
    markBackgroundInert(doc, rootNode);
    doc.documentElement.classList.add('lotbi-mobile-entry-active');
    appButton.focus({ preventScroll: true });
  }

  function renderAppFallback(win, target, userAgent) {
    const doc = win.document;
    injectStyles(doc);
    doc.body.innerHTML = '';

    const rootNode = doc.createElement('div');
    rootNode.id = 'lotbi-mobile-entry-root';
    rootNode.setAttribute('role', 'main');

    const card = doc.createElement('section');
    card.className = 'lotbi-entry-card';
    card.appendChild(brandNode(doc));

    const title = doc.createElement('h1');
    title.id = 'lotbi-entry-title';
    title.textContent = 'LOTBI 앱으로 연결하지 못했어요';
    card.appendChild(title);

    const copy = doc.createElement('p');
    copy.className = 'lotbi-entry-copy';
    copy.textContent = '앱이 설치되어 있지 않거나 브라우저에서 앱 연결을 제한했을 수 있습니다.';
    card.appendChild(copy);

    const actions = doc.createElement('div');
    actions.className = 'lotbi-entry-actions';
    const webButton = doc.createElement('button');
    webButton.type = 'button';
    webButton.className = 'lotbi-entry-button lotbi-entry-button-secondary';
    webButton.textContent = '웹으로 이용하기';
    webButton.addEventListener('click', function () {
      doc.cookie = webChoiceCookieString();
      win.location.replace(withWebBypass(target));
    });
    actions.appendChild(webButton);
    card.appendChild(actions);

    if (isKakaoInAppBrowser(userAgent)) {
      const note = doc.createElement('p');
      note.className = 'lotbi-entry-note';
      note.textContent = '앱이 열리지 않으면 외부 브라우저에서 열어 주세요.';
      card.appendChild(note);
    }

    const targetLabel = doc.createElement('p');
    targetLabel.className = 'lotbi-entry-target';
    targetLabel.textContent = '계속할 웹 경로: ' + target;
    card.appendChild(targetLabel);

    rootNode.appendChild(card);
    doc.body.appendChild(rootNode);
    doc.documentElement.classList.add('lotbi-mobile-entry-active');
    webButton.focus({ preventScroll: true });
  }

  function afterBody(doc, callback) {
    if (doc.body) {
      callback();
      return;
    }
    doc.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  function boot(winArg) {
    const win = winArg || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.document || !win.location) return;
    const doc = win.document;
    const loc = win.location;
    const ua = (win.navigator && win.navigator.userAgent) || '';

    if (!isLotbiSiteHost(loc.host || loc.hostname)) return;

    if (loc.pathname === APP_BRIDGE_PREFIX || loc.pathname.startsWith(APP_BRIDGE_PREFIX + '/')) {
      injectStyles(doc);
      doc.documentElement.classList.add('lotbi-mobile-entry-active');
      const target = targetFromAppBridge(loc.pathname, loc.search);
      afterBody(doc, function () { renderAppFallback(win, target, ua); });
      return;
    }

    if (queryHasBypass(loc.search)) {
      const cleaned = cleanWebBypass((loc.pathname || '/') + (loc.search || ''));
      doc.cookie = webChoiceCookieString();
      if (win.history && typeof win.history.replaceState === 'function') {
        win.history.replaceState(null, '', cleaned);
      }
      return;
    }

    const hasBypass = hasWebChoiceCookie(doc.cookie);
    if (!shouldShowChooser({
      method: 'GET',
      host: loc.host || loc.hostname,
      pathname: loc.pathname,
      userAgent: ua,
      hasWebBypass: hasBypass,
    })) {
      return;
    }

    const target = currentTarget(loc);
    injectStyles(doc);
    doc.documentElement.classList.add('lotbi-mobile-entry-active');
    afterBody(doc, function () { renderChooser(win, target, ua); });
  }

  return {
    SITE_ORIGIN: SITE_ORIGIN,
    SITE_HOST: SITE_HOST,
    APP_BRIDGE_PREFIX: APP_BRIDGE_PREFIX,
    WEB_BYPASS_PARAM: WEB_BYPASS_PARAM,
    WEB_BYPASS_COOKIE: WEB_BYPASS_COOKIE,
    WEB_BYPASS_MAX_AGE_SECONDS: WEB_BYPASS_MAX_AGE_SECONDS,
    APP_LINK_READY: APP_LINK_READY,
    normalizeHost: normalizeHost,
    isLotbiSiteHost: isLotbiSiteHost,
    isMobileUserAgent: isMobileUserAgent,
    isKakaoInAppBrowser: isKakaoInAppBrowser,
    detectMobilePlatform: detectMobilePlatform,
    isExcludedPath: isExcludedPath,
    queryHasBypass: queryHasBypass,
    stripBypassFromQuery: stripBypassFromQuery,
    sanitizeInternalTarget: sanitizeInternalTarget,
    withWebBypass: withWebBypass,
    cleanWebBypass: cleanWebBypass,
    buildAppBridgePath: buildAppBridgePath,
    targetFromAppBridge: targetFromAppBridge,
    shouldShowChooser: shouldShowChooser,
    webChoiceCookieString: webChoiceCookieString,
    hasWebChoiceCookie: hasWebChoiceCookie,
    currentTarget: currentTarget,
    boot: boot,
  };
});
