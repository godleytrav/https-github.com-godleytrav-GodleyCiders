const CACHE_NAME = 'godley-ciders-v1';
const ASSETS_TO_CACHE = [
  '/home',
  '/logo.svg',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Non-blocking caching for baseline offline support
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Offline shell caching skipped some items during active development:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first, with fallback to cache
self.addEventListener('fetch', (event) => {
  // Let browser handle non-GET, firestore or dev-socket requests normally
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('localhost') ||
    event.request.url.includes('google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If successful, open cache and clone-save page asset
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is down/unreachable
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Redirect sub-routes back to root element for correct SPA routing offline
          if (event.request.mode === 'navigate') {
            return caches.match('/home');
          }
        });
      })
  );
});
