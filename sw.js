/**
 * KOPALA FPL - Service Worker (v13)
 * Strategy: Network-First for UI (Freshness), Stale-While-Revalidate for API (Speed)
 */

const CACHE_NAME = 'kopala-fpl-v13'; // Bumped version
const DATA_CACHE_NAME = 'fpl-data-v4';

// Assets that ALMOST NEVER change (Images/Icons)
const STATIC_ASSETS = [
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/manifest.json'
];

const updateChannel = new BroadcastChannel('fpl-updates');

// 1. INSTALL: Immediate takeover
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// 2. ACTIVATE: Purge all old versions of the app logic
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log('SW: Purging old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH: The Logic Center
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // STRATEGY A: FPL API (Stale-While-Revalidate)
    // Speed is king for data. Show old data, update in background.
    if (url.pathname.startsWith('/fpl-api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    const networked = fetch(event.request).then((res) => {
                        if (res.ok) {
                            cache.put(event.request, res.clone());
                            updateChannel.postMessage({ type: 'DATA_UPDATED' });
                        }
                        return res;
                    });
                    return cached || networked;
                });
            })
        );
        return;
    }

    // STRATEGY B: UI & LOGIC (Network-First)
    // For HTML, CSS, JS: ALWAYS check Netlify first. 
    // This fixes your "non-updating elements" bug.
    if (
        event.request.mode === 'navigate' || 
        url.pathname.match(/\.(html|css|js)$/)
    ) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Update the cache with the fresh version for offline use
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Offline fallback
        );
        return;
    }

    // STRATEGY C: ASSETS (Cache-First)
    // For icons and manifest files.
    event.respondWith(
        caches.match(event.request).then((res) => res || fetch(event.request))
    );
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', (event) => {
    let data = event.data ? event.data.json() : { title: 'FPL Alert', body: 'Check your team!' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/android-chrome-192x192.png',
            tag: 'fpl-deadline'
        })
    );
});
