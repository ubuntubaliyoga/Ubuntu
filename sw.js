// sw.js
// Minimal service worker — no offline caching.
// Only purpose: detect when a new version is deployed and reload the app.

const VERSION = 'BUILD_TIMESTAMP';

self.addEventListener('install', () => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Take control of all open tabs immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // Let all requests pass through normally — no caching
  event.respondWith(fetch(event.request));
});
