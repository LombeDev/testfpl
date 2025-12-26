const CACHE_NAME = 'kopala-fpl-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/kopala.html',
    '/kopala.css',
    '/kopala.js',
    '/style.css',
    '/script.js',
    '/deadline.js',
    '/site.webmanifest',
    '/favicon-32x32.png',
    '/favicon-16x16.png'
];

// 1. INSTALL: Pre-cache the 'App Shell'
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('🛡️ Vault: Pre-caching core assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. ACTIVATE: Clean up old versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🧹 Vault: Clearing old cache');
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// 3. FETCH: Serve from cache, then network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});