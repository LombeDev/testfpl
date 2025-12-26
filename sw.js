/**
 * KOPALA FPL - Service Worker
 */

const CACHE_NAME = 'kopala-fpl-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/script.js',
    '/manifest.json', // or site.webmanifest
    '/favicon-32x32.png'
];

// 1. MANDATORY: Install Event (Caches basic files)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. MANDATORY: Fetch Event (This makes the Install button appear!)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// 3. Notification Logic (Consolidated)
self.addEventListener('message', (event) => {
    if (event.data.type === 'SCHEDULE_DEADLINE') {
        const deadline = new Date(event.data.deadline).getTime();
        const notifyTime = deadline - (2 * 60 * 60 * 1000); // 2 hours before
        const delay = notifyTime - Date.now();

        if (delay > 0) {
            if (self.deadlineTimeout) clearTimeout(self.deadlineTimeout);

            self.deadlineTimeout = setTimeout(() => {
                self.registration.showNotification('KOPALA FPL', {
                    body: `GW ${event.data.gw} deadline is in 2 hours!`,
                    icon: '/favicon-32x32.png',
                    vibrate: [200, 100, 200],
                    tag: 'deadline-alert'
                });
            }, delay);
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
