/**
 * KOPALA FPL - Service Worker (v14)
 * Fixed: Robust Error Handling & Network Error Catching
 */

const CACHE_NAME = 'kopala-fpl-v14'; 
const DATA_CACHE_NAME = 'fpl-data-v4';

const STATIC_ASSETS = [
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/manifest.json'
];

const updateChannel = new BroadcastChannel('fpl-updates');

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // STRATEGY A: FPL API (Stale-While-Revalidate)
    if (url.pathname.startsWith('/fpl-api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    const networked = fetch(event.request).then((res) => {
                        if (res && res.ok) {
                            cache.put(event.request, res.clone());
                            updateChannel.postMessage({ type: 'DATA_UPDATED' });
                        }
                        return res;
                    }).catch(() => cached); // If network fails, return cached even if null
                    return cached || networked;
                });
            })
        );
        return;
    }

    // STRATEGY B: UI & LOGIC (Network-First)
    if (event.request.mode === 'navigate' || url.pathname.match(/\.(html|css|js)$/)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request)) 
        );
        return;
    }

    // STRATEGY C: ASSETS & OTHERS (Cache-First + Error Handling)
    event.respondWith(
        caches.match(event.request).then((res) => {
            return res || fetch(event.request).catch(() => {
                // Return a basic 404 response instead of crashing
                return new Response('Asset not found', { status: 404, statusText: 'Not Found' });
            });
        })
    );
});

// Listener for the "Refresh Now" button
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

self.addEventListener('push', (event) => {
    let data = { title: 'FPL Alert', body: 'Check your team!' };
    try {
        if (event.data) data = event.data.json();
    } catch (e) {
        data.body = event.data.text();
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/android-chrome-192x192.png',
            tag: 'fpl-deadline'
        })
    );
});
