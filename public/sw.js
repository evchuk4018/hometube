/* global self, caches, URL, fetch, Response */

const CACHE = "hometube-shell-v2";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const appPath = (pathname) => (BASE_PATH + pathname) || "/";
const SHELL = [appPath("/"), appPath("/channels"), appPath("/podcasts"), appPath("/manifest.webmanifest"), appPath("/icon.svg")];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("hometube-shell-") && key !== CACHE)
          .map((key) => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith(appPath("/api/"))) return;
  event.respondWith(
    fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
  );
});
