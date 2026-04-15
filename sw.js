// sw.js
// Minimal service worker — shows update button when new version is deployed.

const VERSION = 'BUILD_TIMESTAMP';

self.addEventListener('install', () => {
  // Don't skip waiting — let the app decide when to update
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
