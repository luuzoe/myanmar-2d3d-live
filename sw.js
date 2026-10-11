// mm-2d3d-live service worker: offline shell, network-first for data JSONs
const CACHE = 'mm2d3d-v1';
self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const isData = /\/data\/(2d|3d)\.json$/.test(url.pathname);
  if (isData) {
    // network-first: results must be fresh
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // cache-first with runtime caching for the app shell
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
  }
});
