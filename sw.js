const CACHE_NAME = 'sazon-gloria-cache-v1';

// FUNDAMENTO: Esta lista AHORA SÍ coincide con su estructura de archivos (image_9f809c.png)
// Esto solucionará el error 'cache.addAll'
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/politica-privacidad.html',
    '/terminos-condiciones.html',
    '/assets/css/style.css',
    '/assets/js/app.js',
    '/assets/images/favicon.png',
    '/assets/images/hero-bg.jpg',
    '/assets/images/logo_v1.0-LSDG.png',
    '/assets/images/logo.png'
];

// 1. Evento de Instalación
self.addEventListener('install', event => {
    console.log('SW: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Abriendo caché y guardando archivos');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                return self.skipWaiting();
            })
            .catch(err => {
                // Este error ya no debería aparecer si todos los archivos de la lista existen
                console.error('SW: Fallo al cachear archivos durante la instalación', err);
            })
    );
});

// 2. Evento de Activación: Limpia cachés antiguas
self.addEventListener('activate', event => {
    console.log('SW: Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// 3. Evento Fetch: Responde desde caché o red
self.addEventListener('fetch', event => {
    // Ignorar peticiones de Firebase (siempre deben ir a la red)
    if (event.request.url.includes('firebase') || event.request.url.includes('firestore')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Desde caché
                }
                return fetch(event.request); // Desde red
            })
    );
});