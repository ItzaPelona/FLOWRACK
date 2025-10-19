/**
 * FlowRack Service Worker
 * Handles offline functionality, caching, and PWA features
 */

const CACHE_NAME = 'flowrack-v1.0.0';
const API_CACHE_NAME = 'flowrack-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/style.css',
    '/assets/js/app.js',
    '/assets/js/api.js',
    '/assets/js/utils.js',
    '/assets/js/auth.js',
    // Bootstrap CSS and JS from CDN (cached dynamically)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.socket.io/4.7.4/socket.io.min.js'
];

// API endpoints to cache
const CACHEABLE_API_ROUTES = [
    '/api/products',
    '/api/products/categories',
    '/api/auth/profile'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Handle different types of requests
    if (url.pathname.startsWith('/api/')) {
        // API requests - network first with cache fallback
        event.respondWith(handleApiRequest(request));
    } else if (request.destination === 'document') {
        // HTML documents - cache first
        event.respondWith(handleDocumentRequest(request));
    } else {
        // Static assets - cache first with network fallback
        event.respondWith(handleStaticRequest(request));
    }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
    const url = new URL(request.url);
    const isGetRequest = request.method === 'GET';
    const isCacheableRoute = CACHEABLE_API_ROUTES.some(route => 
        url.pathname.startsWith(route)
    );
    
    try {
        // Always try network first for API requests
        const networkResponse = await fetch(request.clone());
        
        // Cache successful GET requests for cacheable routes
        if (networkResponse.ok && isGetRequest && isCacheableRoute) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request.clone(), networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Network request failed, trying cache:', request.url);
        
        // If network fails and it's a GET request, try cache
        if (isGetRequest) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                console.log('Serving from cache:', request.url);
                return cachedResponse;
            }
        }
        
        // Return offline response for failed API requests
        return new Response(
            JSON.stringify({
                error: 'Offline - This action requires an internet connection',
                offline: true
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

// Handle document requests
async function handleDocumentRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fall back to index.html for SPA routing
        const indexResponse = await caches.match('/index.html');
        if (indexResponse) {
            return indexResponse;
        }
        
        // Final fallback
        return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Handle static asset requests
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Failed to fetch static asset:', request.url);
        
        // Return generic offline response for failed static requests
        if (request.destination === 'image') {
            // Return a simple SVG placeholder for images
            const svg = `
                <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#f8f9fa"/>
                    <text x="50%" y="50%" font-family="Arial" font-size="12" 
                          fill="#6c757d" text-anchor="middle" dy=".3em">Offline</text>
                </svg>
            `;
            return new Response(svg, {
                headers: {
                    'Content-Type': 'image/svg+xml'
                }
            });
        }
        
        return new Response('Resource unavailable offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync-requests') {
        event.waitUntil(syncOfflineRequests());
    }
});

// Sync offline requests when connection is restored
async function syncOfflineRequests() {
    try {
        // Get offline requests from IndexedDB
        const offlineRequests = await getOfflineRequests();
        
        for (const request of offlineRequests) {
            try {
                // Attempt to sync each offline request
                const response = await fetch(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body
                });
                
                if (response.ok) {
                    // Remove successfully synced request
                    await removeOfflineRequest(request.id);
                    
                    // Notify the main app about successful sync
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'SYNC_SUCCESS',
                                request: request
                            });
                        });
                    });
                }
            } catch (error) {
                console.error('Failed to sync request:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    const options = {
        body: 'You have new updates in FlowRack',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App',
                icon: '/assets/icons/action-explore.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/icons/action-close.png'
            }
        ]
    };
    
    if (event.data) {
        const payload = event.data.json();
        options.body = payload.body || options.body;
        options.title = payload.title || 'FlowRack';
    }
    
    event.waitUntil(
        self.registration.showNotification('FlowRack', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                // Check if app is already open
                const existingClient = clients.find(client => 
                    client.url.includes(self.location.origin)
                );
                
                if (existingClient) {
                    existingClient.focus();
                } else {
                    self.clients.openWindow('/');
                }
            })
        );
    }
});

// Handle messages from main app
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
    } else if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

// Utility functions for IndexedDB operations (simplified implementation)
async function getOfflineRequests() {
    // This would typically use IndexedDB to store offline requests
    // For now, return empty array
    return [];
}

async function removeOfflineRequest(requestId) {
    // Remove request from IndexedDB
    console.log('Removing offline request:', requestId);
}

console.log('FlowRack Service Worker loaded');