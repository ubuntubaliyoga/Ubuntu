// sw.js
// Minimal service worker — forces reload on new deploy.

const VERSION = 'BUILD_TIMESTAMP';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => clients.claim()).then(() =>
      clients.matchAll({ type: 'window' }).then(all =>
        all.forEach(c => c.navigate(c.url))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
