/*
 * Обработчики Web Push подключаются к Workbox SW через importScripts,
 * а в dev этот файл регистрируется как самостоятельный service worker.
 */

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'StayNest', body: '' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'StayNest';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url;
  const path =
    typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/';
  const resolved = new URL(path, self.location.origin);
  const target =
    resolved.origin === self.location.origin
      ? resolved.href
      : new URL('/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (existing) {
        await existing.focus();
        if (existing.navigate) await existing.navigate(target);
        return;
      }

      await self.clients.openWindow(target);
    })(),
  );
});
