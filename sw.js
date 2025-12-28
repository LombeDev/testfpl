/**
 * KOPALA FPL - Service Worker (v11)
 * Features: Stale-While-Revalidate + Push Notifications
 */

const CACHE_NAME = 'kopala-fpl-v11';
const DATA_CACHE_NAME = 'fpl-data-v3';

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

// 1. INSTALL & ACTIVATE (Standard PWA logic)
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

// 2. FETCH STRATEGY (Stale-While-Revalidate for FPL Data)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/fpl-api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                           cache.put(event.request, networkResponse.clone());
                           updateChannel.postMessage({ type: 'DATA_UPDATED' });
                        }
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((res) => {
            if (res) return res;
            if (url.pathname === '/') return caches.match('/index.html');
            return fetch(event.request);
        })
    );
});

// --- NEW: PUSH NOTIFICATION LISTENERS ---

// 3. PUSH EVENT: Receiver for the 2-hour deadline alert
self.addEventListener('push', (event) => {
    let data = { 
        title: 'FPL Deadline Alert', 
        body: '2 hours until the deadline! Check your team.' 
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        vibrate: [200, 100, 200, 100, 200], // Copperbelt heartbeat pattern
        data: { url: '/' }, // Root URL to open
        tag: 'fpl-deadline', // Replaces old notifications if multiple are sent
        requireInteraction: true // Keeps notification visible until clicked
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 4. NOTIFICATION CLICK: Action when user taps the notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Close the notification immediately

    // Focus existing window or open a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});