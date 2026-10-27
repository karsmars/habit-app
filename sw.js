const CACHE_NAME = "habit-app-shell-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/themes.css",
  "./js/app.js",
  "./js/state.js",
  "./js/dates.js",
  "./js/points.js",
  "./js/merge.js",
  "./js/storage-github.js",
  "./js/themes.js",
  "./js/theme-init.js",
  "./js/ui.js",
  "./js/ui-settings.js",
  "./js/ui-today.js",
  "./js/ui-shop.js",
  "./js/ui-progress.js",
  "./js/ui-calendar.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("habit-app-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
