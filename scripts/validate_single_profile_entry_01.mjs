// SITE-NAV-SINGLE-PROFILE-ENTRY-01
//
// The same four items used to sit in the desktop sidebar's secondary menu AND
// in the account menu, and a third 프로필 entry point sat in the Header. The
// account menu was always a superset, so the duplicates were removed and the
// sidebar/drawer account row is now the only profile entry point.
//
// This gate locks that shape:
//   1. the sidebar secondary menu cannot come back (markup or CSS),
//   2. the authenticated Header renders no profile control,
//   3. the anonymous Header keeps 로그인/회원가입 (the signup conversion path),
//   4. all six account-menu items survive, 로그아웃 included, and
//   5. the account row stays reachable on desktop and in the mobile drawer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const continuity = read('site-continuity.js');
const conversation = read('site-conversation.js');
const sidebarCss = read('site-sidebar-nav.css');

// ── 1. The sidebar secondary menu is gone and stays gone ──────────────────
for (const [label, source] of [['index.html', html], ['site-sidebar-nav.css', sidebarCss]]) {
  assert.ok(
    !source.includes('sidebar-secondary-nav'),
    `${label} must not reintroduce the sidebar secondary menu`,
  );
}

// Its four items must not reappear as sidebar nav entries by any other name.
assert.ok(
  !html.includes('data-global-nav-action'),
  'index.html must not carry sidebar buttons that duplicate the account menu',
);
assert.ok(
  !html.includes('data-sidebar-destination="connected-services"'),
  'index.html must not carry a sidebar 연결 서비스 link beside the account menu',
);

// The delegated handler stays: removing markup must not remove behaviour that
// another surface (or a native webview) may still route through it.
assert.ok(
  conversation.includes("const action = globalNavAction.dataset.globalNavAction;")
  && conversation.includes("if (action === 'profile') openProfile();")
  && conversation.includes("else if (action === 'settings' || action === 'theme') openThemeChooser();")
  && conversation.includes("else if (action === 'help') openHelp();"),
  'the data-global-nav-action handler must survive the markup removal',
);

// ── 2. The authenticated Header renders no profile control ────────────────
const authenticatedFn = continuity.slice(
  continuity.indexOf('export function markAuthenticatedAccountUi'),
  continuity.indexOf('export function markAnonymousAccountUi'),
);
assert.ok(authenticatedFn.length > 0, 'markAuthenticatedAccountUi must exist');
assert.ok(
  !authenticatedFn.includes('profileMenuTrigger'),
  'the authenticated Header must not mount a second [data-profile-menu-trigger]',
);
assert.ok(
  !authenticatedFn.includes("'프로필'"),
  'the authenticated Header must not render a 프로필 button',
);
assert.ok(
  authenticatedFn.includes('actions.replaceChildren();'),
  'the authenticated Header must clear its reserved slot',
);
// The auth bookkeeping other code reads must not regress with the button.
assert.ok(
  authenticatedFn.includes('setAuthState(actions, AUTH_STATE_AUTHENTICATED, false)')
  && authenticatedFn.includes("actions.dataset.siteAuthenticated = 'true'")
  && authenticatedFn.includes('markAuthenticatedSidebarAccountUi()'),
  'authenticated Header state bookkeeping must survive the button removal',
);
// The emptied slot must not hold its reserved width open.
assert.ok(
  /\.account-actions\[data-auth-state="authenticated"\]\s*\{[^}]*min-width:\s*0/.test(sidebarCss),
  'the emptied authenticated Header slot must collapse its reserved width',
);

// ── 3. The anonymous Header keeps the signup conversion path ──────────────
const anonymousFn = continuity.slice(continuity.indexOf('export function markAnonymousAccountUi'));
assert.ok(
  anonymousFn.includes("login.textContent = '로그인'") && anonymousFn.includes("signup.textContent = '회원가입'"),
  'the anonymous Header must keep 로그인 and 회원가입',
);

// ── 4. All six account-menu items survive ─────────────────────────────────
const menu = conversation.slice(
  conversation.indexOf('const openProfileMenu = trigger =>'),
  conversation.indexOf('const openProfileMenu = trigger =>') + 4000,
);
// Match where each label is actually bound to a menu item, not merely where the
// word appears: 로그아웃 also shows up in the in-flight label and in an error
// string, so a bare substring check would not notice the item disappearing.
const boundItems = [
  ["menuAction('프로필 수정', openProfile)", '프로필 수정'],
  ["menuAction('테마 선택', openThemeChooser)", '테마 선택'],
  ["menuLink('설정', 'https://account.lotbiai.com')", '설정'],
  ["menuLink('연결 서비스', 'https://account.lotbiai.com/connected-services')", '연결 서비스'],
  ["menuAction('도움말', openHelp)", '도움말'],
  ["logout.textContent = '로그아웃'", '로그아웃'],
];
for (const [binding, item] of boundItems) {
  assert.ok(menu.includes(binding), `the account menu must still offer ${item}`);
}
// SITE-PROFILE-MENU-ORDER-01 — the order 대표 asked for, read off the bindings
// themselves so a reshuffle cannot pass unnoticed.
const ORDER = ['프로필 수정', '테마 선택', '연결 서비스', '도움말', '설정', '로그아웃'];
const positions = boundItems.map(([binding, item]) => [item, menu.indexOf(binding)]);
const measured = positions.slice().sort((a, b) => a[1] - b[1]).map(([item]) => item);
assert.deepEqual(measured, ORDER, `account menu order: expected ${ORDER.join(' → ')}, measured ${measured.join(' → ')}`);
// Both account-page items leave the site, and both are links, so a reader can
// see which items stay inside the product before clicking.
assert.ok(
  menu.includes("menuLink('연결 서비스', 'https://account.lotbiai.com/connected-services')")
  && menu.includes("menuLink('설정', 'https://account.lotbiai.com')"),
  'the two account-page items must stay links to the external account surface',
);
// 로그아웃 is the one item with no other route out of the product.
assert.ok(
  menu.includes('logout.disabled = !sessionToken')
  && menu.includes("logout.title = 'Site child session 연결 후 사용할 수 있습니다.'"),
  '로그아웃 must keep its session gating and its explanatory title',
);
assert.ok(
  menu.includes('await logoutSiteSession(sessionToken)') && menu.includes('beginAccountLogoutHandoff()'),
  '로그아웃 must still run the real logout handoff',
);
assert.ok(
  menu.includes("menu.setAttribute('role', 'menu')") && menu.includes("setAttribute('role', 'menuitem')"),
  'the account menu must keep its menu/menuitem semantics',
);

// ── 5. The account row is the surviving entry point, on both surfaces ─────
const slots = html.match(/data-sidebar-account/g) ?? [];
assert.equal(slots.length, 2, 'the account row must exist in the desktop sidebar and the mobile drawer');
assert.ok(
  html.includes('<aside class="chat-sidebar chat-sidebar-desktop"')
  && html.includes('id="mobile-nav-drawer"'),
  'both account-row hosts must be present',
);
assert.ok(
  conversation.includes("button.dataset.profileMenuTrigger = ''")
  && conversation.includes("button.setAttribute('aria-haspopup', 'menu')")
  && conversation.includes("button.setAttribute('aria-expanded', 'false')"),
  'the account row must stay the [data-profile-menu-trigger] with intact ARIA',
);

console.log('SITE-NAV-SINGLE-PROFILE-ENTRY-01 OK — one profile entry point, six items intact');
