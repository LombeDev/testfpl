/**
 * KOPALA FPL - Service Worker (v12)
 * Optimized: Network-First for UI/Logic, Stale-While-Revalidate for API
 */

const CACHE_NAME = 'kopala-fpl-v12';
const DATA_CACHE_NAME = 'fpl-data-v4';

// Only cache essential, rarely changing static assets
const ASSETS_TO_CACHE = [
    '/manifest.json',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/screenshot-mobile.jpg',
    '/screenshot-desktop.jpg'
];

const updateChannel = new BroadcastChannel('fpl-updates');

// 1. INSTALL
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// 2. ACTIVATE
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

// 3. FETCH STRATEGY
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // STRATEGY A: FPL API DATA (Stale-While-Revalidate)
    // We want speed, but we update the cache in the background.
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

    // STRATEGY B: UI & LOGIC (Network-First)
    // HTML, JS, and CSS files should always try to load fresh to ensure AI logic is current.
    if (
        event.request.mode === 'navigate' || 
        url.pathname.endsWith('.html') || 
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.css')
    ) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // STRATEGY C: ASSETS (Cache-First)
    event.respondWith(
        caches.match(event.request).then((res) => {
            return res || fetch(event.request);
        })
    );
});

// --- PUSH NOTIFICATION LISTENERS ---

self.addEventListener('push', (event) => {
    let data = { 
        title: 'FPL Deadline Alert', 
        body: '2 hours until the deadline! Check your aggressive AI picks.' 
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
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/' },
        tag: 'fpl-deadline',
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
