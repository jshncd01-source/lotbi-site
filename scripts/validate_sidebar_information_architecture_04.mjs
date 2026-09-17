import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const sidebarCss = read('site-sidebar-nav.css');
const continuity = read('site-continuity.js');
const homeShell = read('home-shell.js');

const extract = (startPattern, endPattern) => {
  const start = index.search(startPattern);
  assert.notEqual(start, -1, `missing block start: ${startPattern}`);
  const tail = index.slice(start);
  const end = tail.search(endPattern);
  assert.notEqual(end, -1, `missing block end: ${endPattern}`);
  return tail.slice(0, end + tail.match(endPattern)[0].length);
};

const desktop = extract(/<aside class="chat-sidebar chat-sidebar-desktop"/, /<\/aside>/);
const mobile = extract(/<aside\s+[\s\S]*?id="mobile-nav-drawer"/, /<\/aside>/);

for (const [label, block] of [['desktop', desktop], ['mobile', mobile]]) {
  for (const required of ['+ 새 대화', '내 작업', '라이브러리', '연결 서비스', '최근 대화']) {
    assert.ok(block.includes(required), `${label} sidebar missing ${required}`);
  }

  for (const removed of ['주문 내역', '예약 내역', '>내 계정<', '>설정<', '도움말 / 문의', '>오늘<', '>어제<', '>최근 7일<', '>이전<']) {
    assert.ok(!block.includes(removed), `${label} sidebar must remove ${removed}`);
  }

  assert.ok(block.includes('data-sidebar-account'), `${label} sidebar missing account identity slot`);
  assert.ok(block.includes('data-auth-state="checking"'), `${label} account identity must initialize neutral`);
  assert.ok(!block.includes('조승환') && !block.includes('@jshncd01'), `${label} sidebar must not hardcode user identity`);

  assert.match(block, /<button[^>]*data-sidebar-destination="work"[^>]*disabled[^>]*>[\s\S]*?내 작업[\s\S]*?<\/button>/, `${label} 내 작업 must remain fail-closed until an authoritative task route exists`);
  assert.match(block, /<button[^>]*data-sidebar-destination="library"[^>]*disabled[^>]*>[\s\S]*?라이브러리[\s\S]*?<\/button>/, `${label} 라이브러리 must remain fail-closed until an authoritative library route exists`);
  assert.match(block, /<a[^>]*data-sidebar-destination="connected-services"[^>]*href="https:\/\/account\.lotbiai\.com\/external-identities"[^>]*>[\s\S]*?연결 서비스[\s\S]*?<\/a>/, `${label} 연결 서비스 must use the existing Account Web external-identities route`);

  const recent = block.match(/<ul[^>]*class="nav-history-list"[^>]*data-recent-conversations[^>]*>[\s\S]*?<\/ul>/)?.[0] || '';
  assert.ok(recent, `${label} sidebar missing recent conversation list`);
  assert.equal((recent.match(/<li\b/g) || []).length, 0, `${label} recent list must not fabricate conversation titles or date buckets`);
}

assert.ok(index.includes('class="account-actions"'), 'mobile/topbar auth continuity DOM must remain present');
assert.ok(sidebarCss.includes('@media (min-width: 901px)'));
assert.match(sidebarCss, /@media \(min-width: 901px\)[\s\S]*?\.account-actions\s*\{[\s\S]*?display:\s*none/, 'Desktop topbar account affordance must remain presentation-hidden');
assert.ok(sidebarCss.includes('.sidebar-history-scroll'));
assert.ok(sidebarCss.includes('overflow-y: auto'));
assert.ok(sidebarCss.includes('.sidebar-account-footer'));
assert.ok(sidebarCss.includes('margin-top: auto'));
assert.ok(sidebarCss.includes('.sidebar-account-entry'));
assert.ok(sidebarCss.includes('text-overflow: ellipsis'));

for (const required of [
  'function sidebarAccountSlots()',
  'function markCheckingSidebarAccountUi',
  'function markAuthenticatedSidebarAccountUi',
  'function markAnonymousSidebarAccountUi',
  "const ACCOUNT_URL = 'https://account.lotbiai.com/account'",
  "const LOGIN_URL = '/auth/start/'",
]) {
  assert.ok(continuity.includes(required), `missing sidebar auth continuity contract: ${required}`);
}

for (const forbidden of ['localStorage', 'document.cookie']) {
  assert.ok(!continuity.includes(forbidden), `sidebar identity must not add persistence: ${forbidden}`);
}

assert.ok(homeShell.includes("data-mobile-nav-open") || index.includes('data-mobile-nav-open'), 'mobile drawer trigger contract must remain');
assert.ok(!index.includes('data-conversation-title="'), 'static HTML must not fabricate recent conversation titles');

console.log('SITE-SIDEBAR-INFORMATION-ARCHITECTURE-04 CONTRACT PASS');
