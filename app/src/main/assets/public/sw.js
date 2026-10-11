const CACHE_NAME = 'ecodisassemble-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './privacy-policy.html',
    './css/styles.css',
    './js/app.js',
    './js/video-analyzer.js',
    './js/ml-engine.js',
    './js/safety-gate.js',
    './js/ar-viewer.js',
    './js/db-store.js',
    './js/api-sync.js',
    'https://aframe.io/releases/1.4.2/aframe.min.js',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // Cache hit - return response
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});
