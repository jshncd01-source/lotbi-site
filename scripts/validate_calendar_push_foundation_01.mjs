import assert from 'node:assert/strict';

globalThis.atob ??= value => Buffer.from(value, 'base64').toString('binary');
globalThis.btoa ??= value => Buffer.from(value, 'binary').toString('base64');

const {
  getCalendarPushConfig,
  registerCalendarPushWorker,
  subscribeCalendarPush,
  registerCalendarPushSubscriptionWithCore,
} = await import('../site-calendar-push.js?v=20260922-notificationperm1');

{
  const config = await getCalendarPushConfig(async (url, options) => {
    assert.match(String(url), /\/app\/config\.json$/);
    assert.equal(options.credentials, 'omit');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        web_push: {
          enabled: true,
          ready: true,
          dispatch_ready: true,
          vapid_public_key: 'AQID',
          user_visible_only: true,
        },
      }),
    };
  });
  assert.deepEqual(config, {
    enabled: true,
    ready: true,
    dispatchReady: true,
    vapidPublicKey: 'AQID',
  });
}

{
  let thrown = null;
  try {
    await getCalendarPushConfig(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        web_push: {
          enabled: true,
          ready: true,
          dispatch_ready: true,
          vapid_public_key: null,
          user_visible_only: true,
        },
      }),
    }));
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown?.code, 'SITE_PUSH_CONFIG_CONTRACT_INVALID');
}

{
  let registered = null;
  const registration = {pushManager: {}};
  const navigatorImpl = {
    serviceWorker: {
      register: async (url, options) => {
        registered = {url, options};
        return registration;
      },
    },
  };
  assert.equal(await registerCalendarPushWorker({navigatorImpl}), registration);
  assert.deepEqual(registered, {url: '/lotbi-calendar-push-worker.js', options: {scope: '/'}});
}

{
  const existing = {endpoint: 'https://push.example/existing'};
  let subscribeCalls = 0;
  const registration = {
    pushManager: {
      getSubscription: async () => existing,
      subscribe: async () => { subscribeCalls += 1; return {}; },
    },
  };
  assert.equal(await subscribeCalendarPush({registration, vapidPublicKey: 'AQID'}), existing);
  assert.equal(subscribeCalls, 0);
}

{
  let options = null;
  const created = {endpoint: 'https://push.example/new'};
  const registration = {
    pushManager: {
      getSubscription: async () => null,
      subscribe: async value => { options = value; return created; },
    },
  };
  assert.equal(await subscribeCalendarPush({registration, vapidPublicKey: 'AQID'}), created);
  assert.equal(options.userVisibleOnly, true);
  assert.deepEqual([...options.applicationServerKey], [1, 2, 3]);
}

{
  const key = bytes => Uint8Array.from(bytes).buffer;
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/lotbi-fixture',
    expirationTime: null,
    getKey: name => name === 'p256dh' ? key([4, 5, 6, 7, 8, 9, 10, 11]) : key([1, 2, 3, 4, 5, 6, 7, 8]),
  };
  let request = null;
  const result = await registerCalendarPushSubscriptionWithCore({
    sessionToken: 'session-fixture',
    subscription,
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {
        ok: true,
        status: 201,
        json: async () => ({
          status: 'PUSH_SUBSCRIPTION_ACTIVE',
          push_subscription: {push_subscription_id: 'push_fixture_01', status: 'ACTIVE'},
        }),
      };
    },
  });
  assert.equal(result.push_subscription_id, 'push_fixture_01');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer session-fixture');
  const body = JSON.parse(request.options.body);
  assert.equal(body.user_visible_only, true);
  assert.equal(body.expiration_at, null);
  assert.equal(body.endpoint, subscription.endpoint);
  assert.ok(body.p256dh);
  assert.ok(body.auth);
}

console.log('LOTBI Calendar Web Push foundation contract: PASS');
