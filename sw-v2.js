const CACHE_NAME = "focowork-cache-v4";
const BASE_PATH = "/FOCUSWORK";

const CORE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/styles.css`,
  `${BASE_PATH}/app-core.js`,
  `${BASE_PATH}/app-ui.js`,
  `${BASE_PATH}/storage.js`,
  `${BASE_PATH}/timeEngine.js`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icons/icon-192.png`,
  `${BASE_PATH}/icons/icon-512.png`,
  `${BASE_PATH}/icons/icon-512-maskable.png`
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match(`${BASE_PATH}/index.html`);
          }
        });
    })
  );
});
