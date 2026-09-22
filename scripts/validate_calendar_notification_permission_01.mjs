import assert from 'node:assert/strict';

const {
  BROWSER_NOTIFICATION_PERMISSION,
  getBrowserNotificationPermissionState,
  requestBrowserNotificationPermissionForFeature,
} = await import('../site-calendar-notifications.js?v=20260922-notificationperm1');

function notificationFixture(permission, requestPermission) {
  function FixtureNotification() {}
  FixtureNotification.permission = permission;
  if (requestPermission) FixtureNotification.requestPermission = requestPermission;
  return FixtureNotification;
}

{
  const api = notificationFixture('default', async () => 'granted');
  assert.equal(
    getBrowserNotificationPermissionState({NotificationCtor: api}),
    BROWSER_NOTIFICATION_PERMISSION.NOT_DETERMINED,
  );
  assert.equal(
    await requestBrowserNotificationPermissionForFeature({NotificationCtor: api}),
    BROWSER_NOTIFICATION_PERMISSION.GRANTED,
  );
}

{
  let calls = 0;
  const api = notificationFixture('denied', async () => {
    calls += 1;
    return 'granted';
  });
  assert.equal(
    await requestBrowserNotificationPermissionForFeature({NotificationCtor: api}),
    BROWSER_NOTIFICATION_PERMISSION.DENIED,
  );
  assert.equal(calls, 0, 'denied notification permission must not auto-reprompt');
}

{
  const api = notificationFixture('granted', async () => {
    throw new Error('must not request when already granted');
  });
  assert.equal(
    await requestBrowserNotificationPermissionForFeature({NotificationCtor: api}),
    BROWSER_NOTIFICATION_PERMISSION.GRANTED,
  );
}

assert.equal(
  getBrowserNotificationPermissionState({NotificationCtor: null}),
  BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE,
);

assert.equal(
  await requestBrowserNotificationPermissionForFeature({
    NotificationCtor: notificationFixture('default', async () => {
      throw new Error('browser failure');
    }),
  }),
  BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE,
);

console.log('LOTBI Calendar browser notification permission contract: PASS');
