// ===== Service Worker for BottleKeep PWA =====
const CACHE_NAME = 'bottlekeep-v7';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './firebase-sync.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// Install: cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first, but skip Firebase/Google API requests
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    // Don't cache Firebase, Google APIs, or auth requests
    if (url.includes('firebaseio.com') || url.includes('googleapis.com') ||
        url.includes('gstatic.com') || url.includes('firebaseapp.com') ||
        url.includes('firebase') || url.includes('identitytoolkit')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                if (response.ok && event.request.url.startsWith(self.location.origin)) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            if (event.request.destination === 'document') {
                return caches.match('./index.html');
            }
        })
    );
});
