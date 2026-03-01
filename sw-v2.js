/*************************************************
 * FOCUSWORK — Service Worker v5
 * Cache agressiu: primera càrrega normal,
 * totes les següents = 0 bytes de servidor
 *************************************************/

const CACHE_VERSION = 'focuswork-v5';
const BASE = '/FOCUSWORK';

// Tots els assets que cal fer cache
const CACHE_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  // CSS
  `${BASE}/styles.css`,
  `${BASE}/styles-client-view.css`,
  `${BASE}/styles-project-states-CORREGIT.css`,
  `${BASE}/buttons-premium.css`,
  `${BASE}/focuswork-modern.css`,
  // JS propis
  `${BASE}/i18n.js`,
  `${BASE}/supabase-config.js`,
  `${BASE}/supabase-db.js`,
  `${BASE}/supabase-auth.js`,
  `${BASE}/supabase-realtime.js`,
  `${BASE}/offline-mode.js`,
  `${BASE}/app-core.js`,
  `${BASE}/app-project-states-CORREGIT.js`,
  `${BASE}/app-ui.js`,
  `${BASE}/photos-storage.js`,
  `${BASE}/local-photos-mode.js`,
  `${BASE}/patch.js`,
  `${BASE}/estats-listeners-SENSE-PROMPT.js`,
  `${BASE}/botons-visibilitat.js`,
  `${BASE}/buttons-ripple.js`,
  `${BASE}/loadclient-photos-fix.js`,
  `${BASE}/facturacio.js`,
  `${BASE}/admin-panel.js`,
  // Icons
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
  `${BASE}/manifest.json`,
];

// Assets externs (Supabase CDN) — cache separat
const EXTERNAL_CACHE = 'focuswork-external-v5';
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

/* ── INSTALL: pre-cache tots els assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_VERSION).then(cache => {
        return cache.addAll(CACHE_ASSETS).catch(err => {
          console.warn('SW: alguns assets no s\'han pogut fer cache:', err);
        });
      }),
      caches.open(EXTERNAL_CACHE).then(cache => {
        return cache.addAll(EXTERNAL_ASSETS).catch(() => {});
      })
    ])
  );
  self.skipWaiting();
});

/* ── ACTIVATE: netejar caches antics ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== EXTERNAL_CACHE)
          .map(k => {
            console.log('SW: eliminant cache antic:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH: estratègia per tipus d'asset ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Supabase API → sempre xarxa (mai cache — dades en temps real)
  if (url.hostname.includes('supabase.co')) return;

  // 2. Cloudflare R2 fotos → Cache first, actualitzar en segon pla
  if (url.hostname.includes('r2.cloudflarestorage.com') ||
      url.hostname.includes('pub-')) {
    event.respondWith(_cacheFirstBackground(event.request, CACHE_VERSION));
    return;
  }

  // 3. CDN extern (Supabase JS) → Cache first
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(_cacheFirst(event.request, EXTERNAL_CACHE));
    return;
  }

  // 4. Assets propis → Cache first, xarxa com a fallback
  event.respondWith(_cacheFirst(event.request, CACHE_VERSION));
});

/* ── Estratègia: Cache first ── */
async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback per HTML
    if (request.destination === 'document') {
      const fallback = await caches.match(`${BASE}/index.html`);
      if (fallback) return fallback;
    }
    return new Response('Sense connexió', { status: 503 });
  }
}

/* ── Estratègia: Cache first + actualitzar en segon pla (fotos) ── */
async function _cacheFirstBackground(request, cacheName) {
  const cached = await caches.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      caches.open(cacheName).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || await networkFetch;
}

/* ── Missatge per forçar actualització del cache ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

console.log('✅ Service Worker v5 carregat');
