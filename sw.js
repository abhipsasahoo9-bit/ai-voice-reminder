const CACHE_NAME = "lifeos-reminder-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon.svg",
  "./src/main.js",
  "./src/styles.css",
  "./src/modules/calendar.js",
  "./src/modules/exporter.js",
  "./src/modules/nlp.js",
  "./src/modules/notifications.js",
  "./src/modules/storage.js",
  "./src/modules/sync.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./index.html?focus=today"));
});
