// Service Worker Versiyonu
const CACHE_VERSION = 'v1';
const CACHE_NAME = `zencimafya-${CACHE_VERSION}`;

// Önbelleğe Alınacak Dosyalar
const CACHE_ASSETS = [
    '/',
    '/index.html',
    '/about.html',
    '/manifest.json',
    '/assets/css/main.css',
    '/assets/css/glitch.css',
    '/assets/css/crt.css',
    '/assets/js/main.js',
    '/assets/sounds/ambient.mp3',
    '/assets/sounds/glitch.mp3',
    '/assets/sounds/hover.mp3',
    '/assets/sounds/click.mp3',
    '/assets/sounds/drip.mp3',
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/home.png',
    '/assets/icons/about.png',
    '/assets/screenshots/screenshot1.png',
    '/assets/screenshots/screenshot2.png'
];

// Service Worker Kurulumu
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Önbellek açıldı');
                return cache.addAll(CACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Service Worker Aktivasyonu
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('Eski önbellek temizlendi:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Ağ İsteklerini Yakalama
self.addEventListener('fetch', (event) => {
    // Sadece GET isteklerini yakala
    if (event.request.method !== 'GET') return;

    // Ses dosyaları için özel strateji
    if (event.request.url.includes('/assets/sounds/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response('', {
                        status: 404,
                        statusText: 'Ses dosyası bulunamadı'
                    });
                })
        );
        return;
    }

    // Diğer istekler için önbellek stratejisi
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Önbellekte varsa, önbellekten döndür
                if (response) {
                    return response;
                }

                // Önbellekte yoksa, ağdan al ve önbelleğe ekle
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Geçersiz yanıtları önbelleğe alma
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Yanıtı klonla (stream olduğu için)
                        const responseToCache = networkResponse.clone();

                        // Önbelleğe ekle
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Ağ hatası durumunda özel sayfa göster
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                    });
            })
    );
});

// Arka Plan Senkronizasyonu
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

// Push Bildirimleri
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Detayları Gör',
                icon: '/assets/icons/checkmark.png'
            },
            {
                action: 'close',
                title: 'Kapat',
                icon: '/assets/icons/xmark.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Zencimafya', options)
    );
});

// Bildirim Tıklama
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Mesaj Senkronizasyonu
async function syncMessages() {
    try {
        const db = await openDB();
        const messages = await db.getAll('outbox');
        
        for (const message of messages) {
            try {
                await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                });
                
                await db.delete('outbox', message.id);
            } catch (error) {
                console.error('Mesaj gönderilemedi:', error);
            }
        }
    } catch (error) {
        console.error('Senkronizasyon hatası:', error);
    }
}

// IndexedDB Yardımcı Fonksiyonu
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('zencimafya-messages', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('outbox')) {
                db.createObjectStore('outbox', { keyPath: 'id' });
            }
        };
    });
} 