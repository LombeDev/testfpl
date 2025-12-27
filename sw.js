/**
 * KOPALA FPL - Service Worker
 */

const CACHE_NAME = 'kopala-fpl-v5';

// ONLY cache static "engine" files that don't change often.
// We are NOT caching any .html or API calls.
const ASSETS_TO_CACHE = [
    '/style.css',
    '/kopala.css',
    '/football.css',
    '/price.css',
    '/script.js',
    '/deadline.js',
    '/kopala.js',
    '/football.js',
    '/price.js',
    '/menu.js',
    '/manifest.json',
    '/favicon-32x32.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event - Clears old v2/v3/v4 caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Fetch Event - The Logic
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // STRATEGY: Network Only for FPL API and HTML pages
    // This ensures users never see old scores or deadlines.
    if (
        event.request.mode === 'navigate' || 
        url.hostname.includes('fantasy.premierleague.com') || 
        url.pathname.endsWith('.html')
    ) {
        return; // Bypass the cache entirely for these
    }

    // STRATEGY: Cache First for CSS/JS/Images
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// ... Notification Logic ...
