/**
 * KOPALA FPL - Service Worker (v15)
 * Fixed: Relative paths for PWA Installability
 */

const CACHE_NAME = 'kopala-fpl-v15'; 
const DATA_CACHE_NAME = 'fpl-data-v5';

// REMOVED leading slashes for better compatibility
const STATIC_ASSETS = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'manifest.json',
    'favicon-32x32.png'
];

const updateChannel = new BroadcastChannel('fpl-updates');

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Using a loop to addAll ensures one failure doesn't kill the whole cache
            return Promise.allSettled(
                STATIC_ASSETS.map(asset => cache.add(asset))
            );
        })
    );
});
