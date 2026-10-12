// SITE-PROFILE-COMPACT-POPOVER-01 — approved small profile popover contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');
const designCss = read('site-consumer-design.css');
const layoutCss = read('site-consumer-layout.css');
const workflow = read('.github/workflows/site-review.yml');

const start = conversation.indexOf('const openProfileMenu = trigger =>');
const end = conversation.indexOf('let responseGradeOpen', start);
assert.ok(start > 0 && end > start, 'profile popover source block');
const menu = conversation.slice(start, end);

assert.ok(menu.includes("[['프로필 관리', openProfile], ['설정', openSettings]]"), 'approved profile/settings actions and order');
assert.ok(menu.includes("logout.textContent = '로그아웃'"), 'logout action remains');
for (const removed of ['개인테마', '연결 서비스', '도움말', '계정 및 보안', '구독 및 결제', '알림 설정', '화면 설정', '지도 설정', '고객센터']) {
  assert.ok(!menu.includes(removed), `compact popover must omit ${removed}`);
}
assert.equal((menu.match(/setAttribute\('role', 'menuitem'\)/g) || []).length, 2, 'one action factory plus the explicit logout');
assert.ok(menu.includes("logout.setAttribute('role', 'menuitem')"), 'logout has menuitem semantics');

const summaryStart = conversation.indexOf('const profileSummary = () =>');
const summaryEnd = conversation.indexOf('const profileMenuIcon =', summaryStart);
const summary = conversation.slice(summaryStart, summaryEnd);
assert.ok(summary.includes("name.className = 'profile-popover-summary-name'"), 'summary keeps canonical name');
assert.ok(summary.includes("plan.className = 'profile-popover-summary-plan'; plan.textContent = profilePlanName()"), 'summary keeps canonical plan only');
assert.ok(!summary.includes('profile-popover-summary-handle') && !summary.includes('profile-popover-summary-email'), 'summary omits handle and email');
assert.ok(summary.includes("close.className = 'profile-popover-close'") && summary.includes("close.setAttribute('aria-label', '프로필 메뉴 닫기')"), 'summary has an accessible close control');

assert.match(css, /\.profile-popover \{[\s\S]*?width:\s*276px;[\s\S]*?min-height:\s*244px;[\s\S]*?border-radius:\s*16px;[\s\S]*?box-shadow:/, 'desktop size, rounding and shadow');
assert.match(css, /\.profile-popover-layer \{\s*background:\s*transparent;/, 'home stays undimmed');
assert.match(css, /\.profile-popover \.profile-menu-item \{[\s\S]*?min-height:\s*44px;/, 'every action reaches 44px');
assert.match(css, /\.profile-popover \.profile-popover-close \{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'close target reaches 44px');
assert.match(designCss, /body\.chat-home-page \.profile-popover \{[^}]*width:\s*min\(276px,[^}]*min-height:\s*244px;[^}]*overflow:\s*visible;/, 'full home cascade keeps the approved size without a scrollbar');
assert.match(layoutCss, /body\.chat-home-page \.profile-popover \.profile-popover-close \{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*font-size:\s*25px;/, 'full home cascade preserves the close target and glyph');
assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*?\.profile-popover \{\s*position:\s*absolute;\s*inset:\s*auto 10px 10px;\s*width:\s*auto;/, 'mobile popover stays inside the viewport');

assert.ok(conversation.includes("window.location.assign(ACCOUNT_MANAGE_URL + '#profile')"), 'profile management keeps the existing destination');
assert.ok(conversation.includes('const openSettings = () => { window.location.assign(ACCOUNT_MANAGE_URL); };'), 'settings keeps the full Account destination');
assert.ok(menu.includes('await logoutSiteSession(sessionToken)') && menu.includes('beginAccountLogoutHandoff()'), 'logout keeps revocation and handoff');
assert.ok(conversation.includes('queueMicrotask(() => { if (restoreTarget.isConnected) restoreTarget.focus(); })'), 'closing restores focus after the removed control settles');
assert.ok(conversation.includes("if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); goBack(); }"), 'Escape closes through the shared surface contract');
assert.ok(conversation.includes('const backdropDismiss = createBackdropDismissGuard(surface)'), 'outside click uses the guarded dismiss contract');
assert.ok(workflow.includes('node scripts/validate_profile_compact_popover_01.mjs'), 'new validator is registered in site-review');

console.log('SITE-PROFILE-COMPACT-POPOVER-01 PASS');
