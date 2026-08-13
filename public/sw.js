const CACHE_NAME = 'hometube-shell-v2';
const BASE_PATH = new URL('./', self.registration.scope).pathname.replace(/\/$/, '');
const SHELL = [`${BASE_PATH}/`, `${BASE_PATH}/manifest.webmanifest`, `${BASE_PATH}/icon.svg`, `${BASE_PATH}/maskable-icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(`${BASE_PATH}/`)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
