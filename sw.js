// sw.js
// No caching — every request goes straight to the network.
// New deploys are picked up immediately.

const VERSION = 'BUILD_TIMESTAMP';

self.addEventListener('install', () => {
  // Activate immediately, don't wait for old SW to be released
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clear any old caches from previous versions
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
  // Always fetch from network, never from cache
  event.respondWith(fetch(event.request));
});
