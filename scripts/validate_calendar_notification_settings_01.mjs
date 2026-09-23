import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manager = readFileSync('site-calendar-manager.js', 'utf8');
const notifications = readFileSync('site-calendar-notifications.js', 'utf8');
const push = readFileSync('site-calendar-push.js', 'utf8');
const worker = readFileSync('lotbi-calendar-push-worker.js', 'utf8');
const css = readFileSync('site-calendar.css', 'utf8');
const ui = readFileSync('site-calendar-ui.js', 'utf8');
const conversation = readFileSync('site-conversation.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const callback = readFileSync('auth-callback.js', 'utf8');
const callbackHtml = readFileSync('auth/callback/index.html', 'utf8');

assert.match(manager, /site-calendar-notifications\.js\?v=20260922-notificationperm2/);
assert.match(manager, /site-calendar-push\.js\?v=20260922-notificationperm2/);
assert.match(manager, /notificationButton\.addEventListener\('click', async \(\) =>/);
assert.match(manager, /getCalendarPushConfig\(fetchImpl\)/);
assert.match(manager, /requestBrowserNotificationPermissionForFeature\(\)/);
assert.match(manager, /registerCalendarPushWorker\(\)/);
assert.match(manager, /registerCalendarPushSubscriptionWithCore/);

const clickHandler = manager.indexOf("notificationButton.addEventListener('click'");
const permissionCall = manager.lastIndexOf('requestBrowserNotificationPermissionForFeature()');
assert.ok(clickHandler >= 0 && permissionCall > clickHandler, 'notification permission request must stay inside explicit click handler');
assert.equal(
  manager.slice(0, clickHandler).includes('requestBrowserNotificationPermissionForFeature()'),
  false,
  'Calendar mount/settings render must never trigger notification permission',
);

const configCheck = manager.indexOf('getCalendarPushConfig(fetchImpl)', clickHandler);
assert.ok(configCheck > clickHandler && configCheck < permissionCall, 'Core push readiness must be checked before browser permission prompt');
assert.match(manager, /if \(!config\.ready \|\| !config\.dispatchReady\)/);
assert.match(manager, /버튼을 누를 때만 브라우저가 알림 권한을 요청합니다/);
assert.match(manager, /브라우저 사이트 설정에서 알림을 허용해 주세요/);

assert.match(notifications, /before !== BROWSER_NOTIFICATION_PERMISSION\.NOT_DETERMINED/);
assert.match(push, /\/app\/config\.json/);
assert.match(push, /\/v2\/push-subscriptions/);
assert.match(worker, /addEventListener\('push'/);
assert.match(worker, /addEventListener\('notificationclick'/);
assert.doesNotMatch(worker, /addEventListener\(['"]fetch['"]/, 'push-only worker must not intercept site fetch/cache traffic');

assert.match(css, /\.calendar-settings-action-row/);
assert.match(css, /\.calendar-settings-action-button/);
assert.match(ui, /site-calendar-manager\.js\?v=20260923-othercat1/);
assert.match(conversation, /site-calendar-ui\.js\?v=20260923-othercat1/);
assert.match(index, /site-conversation\.js\?v=20260923-othercat1/);
assert.match(callback, /site-conversation\.js\?v=20260923-othercat1/);
assert.match(callbackHtml, /auth-callback\.js\?v=20260923-othercat1/);

console.log('LOTBI Calendar notification Settings opt-in contract: PASS');
