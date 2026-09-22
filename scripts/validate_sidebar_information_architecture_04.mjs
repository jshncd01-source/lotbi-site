import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const sidebarCss = read('site-sidebar-nav.css');
const calendarCss = read('site-calendar.css');
const continuity = read('site-continuity.js');
const homeShell = read('home-shell.js');

function extractAside(pattern, label) {
  const match = index.match(pattern)?.[0] || '';
  assert.ok(match, `missing ${label} markup`);
  return match;
}

const desktop = extractAside(
  /<aside class="chat-sidebar chat-sidebar-desktop"[^>]*>[\s\S]*?<\/aside>/,
  'desktop sidebar',
);
const mobile = extractAside(
  /<aside(?=[^>]*\bid="mobile-nav-drawer")[^>]*>[\s\S]*?<\/aside>/,
  'mobile drawer',
);

for (const [label, block] of [['desktop', desktop], ['mobile', mobile]]) {
  for (const required of ['새 대화', '캘린더', '최근 대화']) {
    assert.ok(block.includes(required), `${label} sidebar missing ${required}`);
  }
  if (label === 'desktop') {
    for (const required of ['연결 서비스', '프로필', '설정', '도움말']) {
      assert.ok(block.includes(required), `${label} sidebar missing ${required}`);
    }
  } else {
    for (const moved of ['연결 서비스', '프로필', '설정', '도움말']) {
      assert.ok(!block.includes(moved), `mobile drawer must move ${moved} into the account menu`);
    }
  }

  for (const removed of ['오늘', '확인 필요', '내 작업', '라이브러리', '주문 내역', '예약 내역', '>내 계정<', '도움말 / 문의', '>전체 일정<', '>예정된 일정<', '>날짜별 보기<', '>어제<', '>최근 7일<', '>이전<']) {
    assert.ok(!block.includes(removed), `${label} sidebar must remove ${removed}`);
  }

  assert.ok(block.includes('data-sidebar-account'), `${label} sidebar missing account identity slot`);
  assert.ok(block.includes('data-auth-state="checking"'), `${label} account identity must initialize in neutral checking state`);
  assert.ok(block.includes('sidebar-account-placeholder'), `${label} must reserve account space without premature identity copy`);
  assert.ok(!block.includes('>로그인<') && !block.includes('LOTBI 계정 연결'), `${label} must not flash anonymous login copy before status resolves`);
  assert.ok(!block.includes('조승환') && !block.includes('@jshncd01'), `${label} sidebar must not hardcode user identity`);

  assert.ok(!block.includes('data-sidebar-destination="work"'), `${label} must not keep the disabled work placeholder in the primary navigation`);
  assert.ok(!block.includes('data-sidebar-destination="library"'), `${label} must not keep the disabled library placeholder in the primary navigation`);
  const primary = block.match(/<div class="sidebar-primary-nav">[\s\S]*?<\/div>/)?.[0] || '';
  assert.ok(primary.includes('data-new-conversation'), `${label} primary navigation must keep new conversation`);
  assert.ok(!primary.includes('connected-services'), `${label} connected services must not remain a primary action`);
  const secondary = block.match(/<div class="sidebar-secondary-nav[^"]*"[^>]*>[\s\S]*?<\/div>/)?.[0] || '';
  assert.ok(secondary, `${label} secondary navigation slot missing`);
  if (label === 'desktop') {
    assert.match(secondary, /<a[^>]*data-sidebar-destination="connected-services"[^>]*href="https:\/\/account\.lotbiai\.com\/connected-services"[^>]*>[\s\S]*?연결 서비스[\s\S]*?<\/a>/, 'desktop 연결 서비스 must keep the Account Web route');
  } else {
    assert.ok(!secondary.includes('connected-services') && !secondary.includes('data-global-nav-action'), 'mobile secondary slot must remain empty because account actions moved to the account menu');
  }
  const calendar = block.match(/<div class="sidebar-calendar-nav"[^>]*>[\s\S]*?(?=<section class="nav-section sidebar-history-section")/)?.[0] || '';
  assert.match(calendar, /<button[^>]*data-calendar-view="all"[^>]*>[\s\S]*?<span class="nav-item-label">캘린더<\/span>[\s\S]*?<\/button>/, `${label} Calendar root action missing`);
  assert.equal((calendar.match(/data-calendar-view="/g) || []).length, 1, `${label} must expose only the Calendar root action`);
  assert.ok(!calendar.includes('sidebar-calendar-subnav'), `${label} sidebar must not duplicate Calendar quick views`);
  for (const removedCalendarLabel of ['전체 일정', '예정된 일정', '날짜별 보기']) {
    assert.ok(!calendar.includes(`>${removedCalendarLabel}<`), `${label} Calendar navigation must hide ${removedCalendarLabel}`);
  }
  for (const internal of ['>Today<', '>Upcoming<', '>Needs Attention<']) {
    assert.ok(!calendar.includes(internal), `${label} leaked internal Calendar term: ${internal}`);
  }

  const primaryPos = block.indexOf('sidebar-primary-nav');
  const calendarPos = block.indexOf('sidebar-calendar-nav');
  const recentPos = block.indexOf('sidebar-history-section');
  const secondaryPos = block.indexOf('sidebar-secondary-nav');
  const accountPos = block.indexOf('sidebar-account-footer');
  assert.ok(
    primaryPos >= 0 && calendarPos > primaryPos && recentPos > calendarPos && secondaryPos > recentPos && accountPos > secondaryPos,
    `${label} order must be new chat → Calendar → recent conversations → account area`,
  );

  const recent = block.match(/<ul[^>]*class="nav-history-list"[^>]*data-recent-conversations[^>]*>[\s\S]*?<\/ul>/)?.[0] || '';
  assert.ok(recent, `${label} sidebar missing recent conversation list`);
  assert.equal((recent.match(/<li\b/g) || []).length, 0, `${label} recent list must not fabricate conversation titles or date buckets`);
}

assert.ok(index.includes('class="account-actions"'), 'mobile/topbar auth continuity DOM must remain present');
assert.ok(!mobile.includes('data-sidebar-destination="connected-services"'), 'mobile drawer must not duplicate connected services');
for (const action of ['profile', 'settings', 'help']) {
  assert.ok(!mobile.includes(`data-global-nav-action="${action}"`), `mobile drawer must not duplicate ${action}`);
}
assert.ok(index.includes('data-lotbi-avatar-stage'), 'sealed Avatar stage must remain present');
assert.ok(index.includes('data-lotbi-avatar-fallback'), 'sealed Avatar fallback must remain present');
assert.ok(sidebarCss.includes('@media (min-width: 901px)'));
assert.match(sidebarCss, /@media \(min-width: 901px\)[\s\S]*?\.account-actions\s*\{[\s\S]*?display:\s*none/, 'Desktop topbar account affordance must remain presentation-hidden');
assert.ok(sidebarCss.includes('.sidebar-history-scroll'));
assert.ok(sidebarCss.includes('overflow-y: auto'));
assert.ok(sidebarCss.includes('.sidebar-secondary-nav'));
assert.ok(calendarCss.includes('.sidebar-calendar-nav'));
assert.ok(sidebarCss.includes('.sidebar-account-footer'));
assert.ok(sidebarCss.includes('margin-top: auto'));
assert.ok(sidebarCss.includes('.sidebar-account-entry'));
assert.ok(sidebarCss.includes('text-overflow: ellipsis'));
assert.ok(sidebarCss.includes('white-space: nowrap'), 'recent conversation titles must stay on one line');
assert.ok(!sidebarCss.includes('-webkit-line-clamp: 2'), 'recent conversation titles must not use the old two-line clamp');
assert.ok(!sidebarCss.includes('animation: sidebar-account-pulse'), 'sidebar account placeholder must remain visually stable during auth hydration');

for (const required of [
  'function sidebarAccountSlots()',
  'function markCheckingSidebarAccountUi',
  'function markAuthenticatedSidebarAccountUi',
  'function markAnonymousSidebarAccountUi',
  "button.dataset.profileMenuTrigger = ''",
  "const LOGIN_URL = '/auth/start/'",
]) {
  assert.ok(continuity.includes(required), `missing sidebar auth continuity contract: ${required}`);
}

for (const forbidden of ['localStorage', 'document.cookie']) {
  assert.ok(!continuity.includes(forbidden), `sidebar identity must not add persistence: ${forbidden}`);
}

assert.ok(homeShell.includes('data-mobile-nav-open') || index.includes('data-mobile-nav-open'), 'mobile drawer trigger contract must remain');
assert.ok(!index.includes('data-conversation-title="'), 'static HTML must not fabricate recent conversation titles');

console.log('SITE-SIDEBAR-INFORMATION-ARCHITECTURE-04 CONTRACT PASS');
