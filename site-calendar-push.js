import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-0c0852554a5f';

function assertSessionToken(sessionToken) {
  const value = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!value) throw new SiteCoreError('알림을 연결하려면 로그인이 필요합니다.', {code: 'SITE_PUSH_SESSION_REQUIRED'});
  return value;
}

function applicationServerKey(value) {
  const normalized = typeof value === 'string' ? value.trim().replace(/-/g, '+').replace(/_/g, '/') : '';
  if (!normalized) throw new SiteCoreError('알림 서버 키가 준비되지 않았습니다.', {code: 'SITE_PUSH_VAPID_UNAVAILABLE'});
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  let raw;
  try {
    raw = atob(padded);
  } catch {
    throw new SiteCoreError('알림 서버 키가 올바르지 않습니다.', {code: 'SITE_PUSH_VAPID_INVALID'});
  }
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function keyToBase64Url(key) {
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function getCalendarPushConfig(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/app/config.json`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {'Accept': 'application/json'},
    });
  } catch {
    throw new SiteCoreError('LOTBI 알림 준비 상태를 확인하지 못했습니다.', {
      code: 'SITE_PUSH_CONFIG_NETWORK_ERROR',
      retryable: true,
    });
  }

  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    throw new SiteCoreError('LOTBI 알림 준비 상태를 확인하지 못했습니다.', {
      code: `HTTP_${response.status}`,
      status: response.status,
      retryable: response.status >= 500,
    });
  }
  const config = payload?.web_push;
  if (
    !config
    || typeof config !== 'object'
    || typeof config.enabled !== 'boolean'
    || typeof config.ready !== 'boolean'
    || typeof config.dispatch_ready !== 'boolean'
    || config.user_visible_only !== true
  ) {
    throw new SiteCoreError('LOTBI 알림 설정 응답이 올바르지 않습니다.', {
      code: 'SITE_PUSH_CONFIG_CONTRACT_INVALID',
    });
  }
  const vapidPublicKey = typeof config.vapid_public_key === 'string'
    ? config.vapid_public_key.trim()
    : '';
  if (config.ready && !vapidPublicKey) {
    throw new SiteCoreError('LOTBI 알림 서버 키가 올바르지 않습니다.', {
      code: 'SITE_PUSH_CONFIG_CONTRACT_INVALID',
    });
  }
  return Object.freeze({
    enabled: config.enabled,
    ready: config.ready,
    dispatchReady: config.dispatch_ready,
    vapidPublicKey,
  });
}

export async function registerCalendarPushWorker({
  navigatorImpl = globalThis.navigator,
  workerUrl = '/lotbi-calendar-push-worker.js?v=aset-0c0852554a5f',
} = {}) {
  const container = navigatorImpl?.serviceWorker;
  if (!container || typeof container.register !== 'function') {
    throw new SiteCoreError('이 브라우저에서는 알림 기능을 사용할 수 없습니다.', {code: 'SITE_PUSH_SERVICE_WORKER_UNAVAILABLE'});
  }
  try {
    return await container.register(workerUrl, {scope: '/'});
  } catch {
    throw new SiteCoreError('알림 기능을 준비하지 못했습니다.', {code: 'SITE_PUSH_SERVICE_WORKER_REGISTER_FAILED', retryable: true});
  }
}

export async function subscribeCalendarPush({
  registration,
  vapidPublicKey,
}) {
  if (!registration?.pushManager || typeof registration.pushManager.subscribe !== 'function') {
    throw new SiteCoreError('이 브라우저에서는 푸시 알림을 사용할 수 없습니다.', {code: 'SITE_PUSH_MANAGER_UNAVAILABLE'});
  }
  const existing = await registration.pushManager.getSubscription?.();
  if (existing) return existing;
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(vapidPublicKey),
    });
  } catch {
    throw new SiteCoreError('브라우저 알림 구독을 만들지 못했습니다.', {code: 'SITE_PUSH_SUBSCRIBE_FAILED', retryable: true});
  }
}

export async function registerCalendarPushSubscriptionWithCore({
  sessionToken,
  subscription,
  fetchImpl = globalThis.fetch,
}) {
  const token = assertSessionToken(sessionToken);
  if (typeof fetchImpl !== 'function') {
    throw new SiteCoreError('브라우저 네트워크 기능을 사용할 수 없습니다.', {code: 'FETCH_UNAVAILABLE'});
  }
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  const p256dh = keyToBase64Url(subscription?.getKey?.('p256dh'));
  const auth = keyToBase64Url(subscription?.getKey?.('auth'));
  if (!endpoint || !p256dh || !auth) {
    throw new SiteCoreError('브라우저 알림 구독 정보가 올바르지 않습니다.', {code: 'SITE_PUSH_SUBSCRIPTION_INVALID'});
  }
  const expirationTime = Number(subscription?.expirationTime);
  const expirationAt = Number.isFinite(expirationTime) && expirationTime > 0
    ? new Date(expirationTime).toISOString()
    : null;

  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}/v2/push-subscriptions`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        user_visible_only: true,
        expiration_at: expirationAt,
      }),
    });
  } catch {
    throw new SiteCoreError('LOTBI 알림 서버에 연결하지 못했습니다.', {
      code: 'SITE_PUSH_CORE_NETWORK_ERROR',
      retryable: true,
    });
  }

  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    throw new SiteCoreError(
      typeof detail.message === 'string' ? detail.message : 'LOTBI 알림 연결을 완료하지 못했습니다.',
      {
        code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
        status: response.status,
      },
    );
  }
  const row = payload?.push_subscription;
  if (payload?.status !== 'PUSH_SUBSCRIPTION_ACTIVE' || !row || typeof row !== 'object') {
    throw new SiteCoreError('LOTBI 알림 연결 응답이 올바르지 않습니다.', {code: 'SITE_PUSH_CORE_CONTRACT_INVALID'});
  }
  return Object.freeze({...row});
}
