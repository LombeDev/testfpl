/**
 * KOPALA FPL - Service Worker (RE-ENGINEERED)
 */

const CACHE_NAME = 'kopala-fpl-v6';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html', // MUST be cached for the Install prompt to work
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
    '/android-chrome-512x512.png'
];

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
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. ALWAYS Network-Only for FPL API (Live Scores)
    if (url.hostname.includes('fantasy.premierleague.com')) {
        return; 
    }

    // 2. Cache-First for App Shell (HTML, CSS, JS)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});