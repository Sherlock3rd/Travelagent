// The itinerary is cached after one complete online visit. Remote map tiles
// and externally hosted reference photos still need a connection.
const CACHE_NAME = 'travelagent-offline-__BUILD_REVISION__';
const APP_ASSETS = [
  './', './index.html', './styles.css', './published-trip.json',
  './app.js', './model.js', './initial-trip.js', './cloud-sync.js',
  './countries.js', './day-media.js', './guides.js', './journeys.js',
  './lightbox.js', './map.js', './map-style-zh.json',
  './vendor/leaflet/leaflet.css', './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/maplibre/maplibre-gl.css',
  './vendor/maplibre/maplibre-gl.mjs',
  './vendor/maplibre/maplibre-gl-shared.mjs',
  './vendor/maplibre/maplibre-gl-worker.mjs',
  './vendor/maplibre/leaflet-maplibre-gl.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(APP_ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('travelagent-offline-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const isPage = event.request.mode === 'navigate';
  const key = isPage ? new URL('./index.html', self.registration.scope) : new URL(url.pathname, url.origin);
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(key, response.clone());
      }
      return response;
    } catch {
      return await caches.match(key, { ignoreSearch: true }) || Response.error();
    }
  })());
});

