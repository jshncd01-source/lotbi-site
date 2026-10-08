// LOTBI-CONSUMER-THEME-SYNC-01 — the one pre-paint theme bootstrap every
// consumer page on lotbiai.com carries.
//
// It has to be inline in each page: it must run before the first stylesheet
// paints, and these pages load no shared script early enough to do it. So the
// copies are kept identical here instead of by hand. Before this, the copies
// each read only this origin's localStorage, which is why a screen mode chosen
// in Account settings never reached the chat, the legal pages or the login
// hand-off pages.
//
//   node scripts/sync_theme_bootstrap.mjs --check   # CI: fails on any drift
//   node scripts/sync_theme_bootstrap.mjs --write   # rewrite every copy
//
// The block reads only: the shared lotbi_theme_preference_v1 cookie first, the
// old per-origin key when that cookie is absent. It never writes a cookie or
// storage, never touches the network, and a failure leaves the page rendering.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const THEME_BOOTSTRAP_MARKERS = Object.freeze([
  'SITE-THEME-BOOTSTRAP-FIRST-PAINT-01',
  'SITE-STATIC-PAGES-THEME-01',
  'LOTBI-CONSUMER-THEME-SYNC-01',
]);

// Every consumer page a reader can land on. The two that are not listed are a
// test harness page and the app-open return page, whose CSP admits no inline
// script at all.
export const THEME_BOOTSTRAP_PAGES = Object.freeze([
  'index.html',
  '404.html', 'about.html', 'account-deletion.html', 'contact.html', 'dispute.html',
  'exchange.html', 'feedback.html', 'privacy.html', 'refund.html', 'subscribe.html', 'terms.html',
  'auth/start/index.html', 'auth/callback/index.html', 'kakao-navi.html', 'map-handoff.html',
]);

export const THEME_BOOTSTRAP_SCRIPT = `  <script>
    // LOTBI-CONSUMER-THEME-SYNC-01 — the screen mode is the lotbi_theme_preference_v1
    // cookie shared with account.lotbiai.com; this origin's old key is read only
    // when that cookie is absent. Reads only. Re-applied when the tab comes back
    // and at the next 자동모드 boundary, so an open page never stays behind.
    (function () {
      var lotbiTimer;
      function lotbiApplyTheme() {
        var lotbiSavedTheme = null;
        try {
          var lotbiCookies = document.cookie ? document.cookie.split(';') : [];
          for (var lotbiIndex = 0; lotbiIndex < lotbiCookies.length; lotbiIndex += 1) {
            var lotbiCookie = lotbiCookies[lotbiIndex].replace(/^\\s+/, '');
            if (lotbiCookie.indexOf('lotbi_theme_preference_v1=') !== 0) continue;
            var lotbiShared = lotbiCookie.slice('lotbi_theme_preference_v1='.length);
            lotbiSavedTheme = lotbiSavedTheme === null || lotbiSavedTheme === lotbiShared ? lotbiShared : '';
          }
        } catch (error) {}
        if (lotbiSavedTheme !== 'light' && lotbiSavedTheme !== 'dark' && lotbiSavedTheme !== 'system' && lotbiSavedTheme !== 'auto') {
          try {
            lotbiSavedTheme = window.localStorage.getItem('lotbi.site.theme.bootstrap.v1');
          } catch (error) {
            lotbiSavedTheme = null;
          }
        }
        var lotbiPreference = lotbiSavedTheme;
        var lotbiHour = new Date().getHours();
        if (lotbiSavedTheme === 'auto') {
          // '자동모드' is resolved here, by this device's clock, rather than
          // stored resolved: a stored answer goes stale at 07:00 and 22:00.
          lotbiSavedTheme = (lotbiHour >= 22 || lotbiHour < 7) ? 'dark' : 'light';
        }
        if (lotbiSavedTheme === 'light' || lotbiSavedTheme === 'dark' || lotbiSavedTheme === 'system') {
          document.documentElement.dataset.siteThemeBootstrap = lotbiSavedTheme;
          document.documentElement.dataset.siteThemePreference = lotbiPreference;
        }
        clearTimeout(lotbiTimer);
        if (lotbiPreference === 'auto') {
          var lotbiNext = new Date();
          lotbiNext.setMinutes(0, 0, 0);
          lotbiNext.setHours(lotbiHour < 7 || lotbiHour >= 22 ? 7 : 22);
          if (lotbiNext.getTime() <= Date.now()) lotbiNext.setDate(lotbiNext.getDate() + 1);
          lotbiTimer = setTimeout(lotbiApplyTheme, lotbiNext.getTime() - Date.now());
        }
      }
      lotbiApplyTheme();
      window.addEventListener('pageshow', lotbiApplyTheme);
      window.addEventListener('focus', lotbiApplyTheme);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') lotbiApplyTheme();
      });
    })();
  </script>`;

const NEW_PAGE_COMMENT = `  <!-- LOTBI-CONSUMER-THEME-SYNC-01 — the same read-only pre-paint theme
       bootstrap every consumer page carries, so this page paints in the
       reader's LOTBI screen mode instead of flashing white on the way through.
       scripts/sync_theme_bootstrap.mjs keeps every copy identical. -->
`;

function normalise(text) {
  return text.replaceAll('\r\n', '\n');
}

// Returns [start, end) of the plain <script> that follows the first marker in
// <head>, or null when the page carries no bootstrap yet.
export function locateThemeBootstrap(html) {
  const headEnd = html.indexOf('</head>');
  const markers = THEME_BOOTSTRAP_MARKERS.map(marker => html.indexOf(marker)).filter(at => at >= 0 && at < headEnd);
  if (markers.length) {
    const start = html.indexOf('  <script>', Math.min(...markers));
    if (start >= 0 && start < headEnd) return [start, html.indexOf('</script>', start) + '</script>'.length];
  }
  // A copy that was pasted without its comment (feedback.html) is still the
  // theme bootstrap: a plain <script> in <head> that reads the theme.
  for (let start = html.indexOf('  <script>'); start >= 0 && start < headEnd; start = html.indexOf('  <script>', start + 1)) {
    const end = html.indexOf('</script>', start) + '</script>'.length;
    const body = html.slice(start, end);
    if (body.includes('lotbi.site.theme.bootstrap.v1') || body.includes('lotbi_theme_preference_v1')) return [start, end];
  }
  return null;
}

export function expectedPage(html) {
  const located = locateThemeBootstrap(html);
  if (located) return html.slice(0, located[0]) + THEME_BOOTSTRAP_SCRIPT + html.slice(located[1]);
  // A page without one gets it as the first thing after <title>, above every
  // stylesheet and inline style, which is the only place it can beat first paint.
  const titleEnd = html.indexOf('</title>');
  if (titleEnd < 0) throw new Error('page has no <title> to anchor the theme bootstrap');
  const at = html.indexOf('\n', titleEnd) + 1;
  return `${html.slice(0, at)}${NEW_PAGE_COMMENT}${THEME_BOOTSTRAP_SCRIPT}\n${html.slice(at)}`;
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    console.error('usage: node scripts/sync_theme_bootstrap.mjs --check|--write');
    process.exit(2);
  }
  const drift = [];
  for (const page of THEME_BOOTSTRAP_PAGES) {
    const file = path.join(ROOT, page);
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const current = normalise(raw);
    const expected = expectedPage(current);
    if (current === expected) continue;
    drift.push(page);
    if (mode === '--write') fs.writeFileSync(file, crlf ? expected.replaceAll('\n', '\r\n') : expected, 'utf8');
  }
  if (mode === '--check' && drift.length) {
    console.error(`THEME-BOOTSTRAP drift in ${drift.join(', ')} — run: node scripts/sync_theme_bootstrap.mjs --write`);
    process.exit(1);
  }
  console.log(`THEME-BOOTSTRAP ${mode === '--write' ? `wrote ${drift.length}` : 'in sync'} — ${THEME_BOOTSTRAP_PAGES.length} pages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
