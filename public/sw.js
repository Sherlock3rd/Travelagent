// Build replaces these constants with a content version and complete local graph.
const VERSION = 'travel-dev-2';
const PRECACHE = ['./', 'index.html', 'trip.html', 'italy.html', 'styles.css', 'travel.css', 'home.js', 'italy.js', 'italy-data.js', 'offline.js', 'app.js', 'model.js', 'cloud-sync.js', 'initial-trip.js', 'map.js', 'countries.js', 'journeys.js', 'guides.js', 'day-media.js', 'lightbox.js', 'published-trip.json', 'map-style-zh.json', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png', 'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png', 'vendor/maplibre/maplibre-gl.mjs', 'vendor/maplibre/maplibre-gl-shared.mjs', 'vendor/maplibre/maplibre-gl-worker.mjs', 'vendor/maplibre/maplibre-gl.css', 'vendor/maplibre/leaflet-maplibre-gl.js'];
const CACHE = 'travelagent-shell-' + VERSION;
const base = new URL('./', self.location.href);
const urls = PRECACHE.map(path => new URL(path, base).href);
const allowed = new Set(urls.map(value => new URL(value).pathname));
self.addEventListener('install', event => {
  // addAll is atomic: failure leaves the currently active version untouched.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  // Retain earlier versions for already-open tabs and their versioned modules.
  // Never clear localStorage, user data, or caches belonging to another app.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type !== 'OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    try {
      const cache=await caches.open(CACHE);
      const complete=(await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean);
      event.ports[0]?.postMessage({ready:complete,version:VERSION,count:urls.length});
    } catch {event.ports[0]?.postMessage({ready:false});}
  })());
});
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  // Only our explicit local asset list. No API responses, private paths, POSTs,
  // remote map tiles, or third-party pages enter the shell cache.
  if(request.method!=='GET'||url.origin!==base.origin||!allowed.has(url.pathname))return;
  event.respondWith((async()=>{
    const current=await caches.open(CACHE);
    let cached=await current.match(request);
    if(!cached && url.searchParams.has('v')) {
      // A still-open older page must get its exact version, never mixed modules.
      const names=(await caches.keys()).filter(name=>name.startsWith('travelagent-shell-')&&name!==CACHE);
      for(const name of names){cached=await (await caches.open(name)).match(request);if(cached)break;}
    }
    if(!cached && !url.searchParams.has('v')) cached=await current.match(request,{ignoreSearch:true});
    if(cached)return cached;
    return fetch(request);
  })());
});
