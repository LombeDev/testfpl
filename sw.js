/**
 * KOPALA FPL - Service Worker (v9)
 * Strategy: Stale-While-Revalidate + Background Sync
 */

const CACHE_NAME = 'kopala-fpl-v9';
const DATA_CACHE_NAME = 'fpl-data-v1';

const ASSETS_TO_CACHE = [
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

// Broadcast Channel to talk to the App
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
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. DATA STRATEGY: Stale-While-Revalidate for FPL API
    if (url.hostname.includes('fantasy.premierleague.com')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        // Tell the app there is fresh data
                        updateChannel.postMessage({ type: 'DATA_UPDATED' });
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 2. SHELL STRATEGY: Cache-First for local files
    event.respondWith(
        caches.match(event.request).then((res) => {
            if (res) return res;
            if (url.pathname === '/') return caches.match('/index.html');
            return fetch(event.request);
        })
    );
});