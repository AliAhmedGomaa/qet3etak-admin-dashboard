/**
 * Minimal push service worker for admin (no ngsw importScripts).
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_LOCAL') {
    event.waitUntil(
      self.registration.showNotification(data.title || 'قطع غيار', {
        body: data.body || '',
        tag: data.tag || `local-sw-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        data: data.data || { url: '/' },
        dir: 'rtl',
        lang: 'ar',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = {};
  try {
    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        data = { body: event.data.text() };
      }
    }
  } catch (err) {
    console.warn('[push-sw] parse failed', err);
  }

  console.log('[push-sw] push received', data);

  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
    }
  } catch {
    /* ignore */
  }

  const n =
    data && typeof data === 'object' && data.notification
      ? data.notification
      : data || {};
  const title = n.title || data.title || 'قطع غيار';
  const body =
    n.body ||
    data.body ||
    (event.data ? '' : 'إشعار من السيرفر — مسار الدفع يعمل');

  try {
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: n.tag || `qet3etak-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      data: n.data || { url: '/' },
      dir: 'rtl',
      lang: 'ar',
    });
    console.log('[push-sw] showNotification done', title);
  } catch (err) {
    console.error('[push-sw] showNotification FAILED', err);
    await self.registration.showNotification(title || 'قطع غيار', {
      body: String(body || 'إشعار جديد'),
      tag: `qet3etak-fallback-${Date.now()}`,
    });
  }
}

self.addEventListener('notificationclick', (event) => {
  const rawUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    '/';
  event.notification.close();
  const target = new URL(rawUrl, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
