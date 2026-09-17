import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const desktopAside = index.match(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/)?.[0] || '';
const mobileAside = index.match(/<aside(?=[\s\S]*?id="mobile-nav-drawer")[^>]*>[\s\S]*?<\/aside>/)?.[0] || '';

assert.ok(desktopAside.startsWith('<aside class="chat-sidebar chat-sidebar-desktop"'), 'desktop sidebar extraction failed');
assert.ok(mobileAside.includes('id="mobile-nav-drawer"'), 'mobile drawer extraction failed');
assert.ok(!mobileAside.includes('chat-sidebar-desktop'), 'mobile drawer fixture must not include the desktop sidebar');
assert.ok(!mobileAside.includes('id="main-content"'), 'mobile drawer fixture must not include main content');
assert.equal((mobileAside.match(/data-recent-conversations/g) || []).length, 1, 'mobile drawer fixture must contain exactly one recent list');

console.log('SITE-SIDEBAR-INFORMATION-ARCHITECTURE-04 EXTRACTION PASS');
