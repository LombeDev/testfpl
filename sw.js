/**
 * KOPALA FPL - Service Worker (v10)
 */

const CACHE_NAME = 'kopala-fpl-v10';
const DATA_CACHE_NAME = 'fpl-data-v2';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/kopala.css',
    '/football.css',
    '/price.css',
    '/deadline.js',
    '/kopala.js',
    '/football.js',
    '/price.js',
    '/menu.js',
    '/manifest.json',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/screenshot-mobile.jpg',
    '/screenshot-desktop.jpg'
];

const updateChannel = new BroadcastChannel('fpl-updates');

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) return caches.delete(key);
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. DATA STRATEGY: Stale-While-Revalidate for your Netlify Proxy
    if (url.pathname.startsWith('/fpl-api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // Success? Update the cache.
                        if (networkResponse.ok) {
                           cache.put(event.request, networkResponse.clone());
                           updateChannel.postMessage({ type: 'DATA_UPDATED' });
                        }
                        return networkResponse;
                    });
                    // Serve cached data immediately, update in background
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 2. SHELL STRATEGY: Cache-First
    event.respondWith(
        caches.match(event.request).then((res) => {
            if (res) return res;
            if (url.pathname === '/') return caches.match('/index.html');
            return fetch(event.request);
        })
    );
});