export const BROWSER_NOTIFICATION_PERMISSION = Object.freeze({
  NOT_DETERMINED: 'NOT_DETERMINED',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
});

function notificationApi(value = globalThis.Notification) {
  return value && typeof value === 'function' ? value : null;
}

export function getBrowserNotificationPermissionState({
  NotificationCtor = globalThis.Notification,
} = {}) {
  const api = notificationApi(NotificationCtor);
  if (!api) return BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;
  if (api.permission === 'granted') return BROWSER_NOTIFICATION_PERMISSION.GRANTED;
  if (api.permission === 'denied') return BROWSER_NOTIFICATION_PERMISSION.DENIED;
  if (api.permission === 'default') return BROWSER_NOTIFICATION_PERMISSION.NOT_DETERMINED;
  return BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;
}

export async function requestBrowserNotificationPermissionForFeature({
  NotificationCtor = globalThis.Notification,
} = {}) {
  const api = notificationApi(NotificationCtor);
  if (!api) return BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;

  const before = getBrowserNotificationPermissionState({NotificationCtor: api});
  if (before !== BROWSER_NOTIFICATION_PERMISSION.NOT_DETERMINED) return before;
  if (typeof api.requestPermission !== 'function') {
    return BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;
  }

  try {
    const result = await api.requestPermission();
    if (result === 'granted') return BROWSER_NOTIFICATION_PERMISSION.GRANTED;
    if (result === 'denied') return BROWSER_NOTIFICATION_PERMISSION.DENIED;
    return BROWSER_NOTIFICATION_PERMISSION.NOT_DETERMINED;
  } catch {
    return BROWSER_NOTIFICATION_PERMISSION.UNAVAILABLE;
  }
}
