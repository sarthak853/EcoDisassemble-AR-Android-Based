const CACHE = 'repairlens-v3';
const MODEL_CACHE = 'ecodisassemble-models-v3';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './models/yolov12n.onnx',
  './js/video-analyzer.js',
  './js/ml-engine.js',
  './js/safety-gate.js',
  './js/ar-viewer.js',
  './js/db-store.js',
  './js/api-sync.js',
  './privacy-policy.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(err => {
      console.warn('[ServiceWorker] Pre-cache partial skip:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(key => key !== CACHE && key !== MODEL_CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isModelAsset = url.pathname.endsWith('.onnx') || url.pathname.endsWith('.glb');
  const targetCache = isModelAsset ? MODEL_CACHE : CACHE;
  
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache successful basic or model responses (preventing opaque quota exhaustion)
        if (response.status === 200 && (response.type === 'basic' || isModelAsset)) {
          const copy = response.clone();
          caches.open(targetCache).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(err => {
        // Fallback to index.html ONLY for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw err;
      });
    })
  );
});
