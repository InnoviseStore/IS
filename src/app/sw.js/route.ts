import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

const swCode = `// Service Worker para Innovise Store PWA & Notificaciones Nativas
const CACHE_NAME = 'innovise-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manejo de clics en las notificaciones del sistema
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Manejo de eventos push si se reciben en segundo plano
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Innovise Store';
    const options = {
      body: data.body || 'Nueva notificación del sistema',
      icon: data.icon || '/logo.png',
      badge: '/favicon.ico',
      data: { url: data.url || '/admin' },
      vibrate: [200, 100, 200],
      tag: data.tag || 'innovise-notification',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[ServiceWorker] Push error:', err);
  }
});
`

export async function GET() {
  return new NextResponse(swCode, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  })
}
