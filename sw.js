/**
 * KOPALA FPL - Service Worker
 */

const CACHE_NAME = 'kopala-fpl-v2'; // Incremented version
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/deadline.js',
    '/kopala.html',
    '/kopala.css',
    '/kopala.js',
    '/football.html',
    '/football.css',
    '/football.js',
    '/price.html',
    '/price.css',
    '/price.js',
    '/menu.js',
    '/contact.html',
    '/manifest.json',
    '/favicon-32x32.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Install Event - Caching Assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Forces the waiting service worker to become active
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Fetch Event - Network First with Cache Fallback
// This strategy ensures users see live FPL data if online, but the app still loads offline.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// 4. Notification Logic
self.addEventListener('message', (event) => {
    if (event.data.type === 'WELCOME_MSG') {
        self.registration.showNotification('KOPALA FPL', {
            body: 'App installed successfully! Good luck this Gameweek.',
            icon: '/android-chrome-192x192.png',
            badge: '/favicon-32x32.png',
            tag: 'welcome-message'
        });
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
