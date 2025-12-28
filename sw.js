/**
 * KOPALA FPL - Service Worker (FINAL PRODUCTION v7)
 */

const CACHE_NAME = 'kopala-fpl-v7';

// 1. Expanded Assets: Including screenshots is vital for the "Install" prompt
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
    '/screenshot-mobile.jpg', // MUST match your manifest filename exactly
    '/screenshot-desktop.jpg' // MUST match your manifest filename exactly
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Kopala Cache: Opening and Storing Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
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

    // STRATEGY: Network-Only for FPL API (Live data must be fresh)
    if (url.hostname.includes('fantasy.premierleague.com')) {
        return; 
    }

    // STRATEGY: Cache-First for App Shell
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Handle root request (/) by serving index.html from cache
            if (!cachedResponse && url.pathname === '/') {
                return caches.match('/index.html');
            }
            
            return cachedResponse || fetch(event.request);
        })
    );
});