self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim().slice(0, 120)
    : 'LOTBI';
  const body = typeof payload.body === 'string'
    ? payload.body.trim().slice(0, 240)
    : '';
  const candidateUrl = typeof payload.url === 'string' ? payload.url : '/';
  let targetUrl = '/';
  try {
    const resolved = new URL(candidateUrl, self.location.origin);
    if (resolved.origin === self.location.origin) {
      targetUrl = resolved.pathname + resolved.search + resolved.hash;
    }
  } catch {
    targetUrl = '/';
  }

  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: {url: targetUrl},
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 120) : undefined,
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetPath = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const target = new URL(targetPath, self.location.origin).href;
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of windows) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      } catch {
        // Continue to a fresh same-origin window.
      }
    }
    await self.clients.openWindow(target);
  })());
});
