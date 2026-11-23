/* Nabat service worker: the app works offline after the first visit.
   App files: cache-first (a new build = a new cache name, so updates are clean).
   design.json: network-first (panel changes reach users), with the cached copy as fallback.
   Recitation audio & Amiri Quran font: cached the first time they're used. */
const BUILD = '202611240301';
const APP = 'nabat-app-' + BUILD, RUNTIME = 'nabat-runtime-v1';
const SHELL = ['./', 'index.html', 'app.css?v=' + BUILD, 'app.js?v=' + BUILD, 'fsrs.js?v=' + BUILD,
  'data/quran.js?v=' + BUILD, 'data/revayat.js?v=' + BUILD, 'a1/art.js?v=' + BUILD, 'a2/art.js?v=' + BUILD,
  'fonts.css?v=' + BUILD, 'design.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('nabat-app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && url.pathname.includes('/panel/')) return;                 // the design panel is never cached
  if (sameOrigin && url.pathname.endsWith('design.json')) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req)));
    return;
  }
  const runtime = /everyayah\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host) || (sameOrigin && url.pathname.includes('/fonts/'));
  e.respondWith(caches.match(req, { ignoreSearch: false }).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && (runtime || sameOrigin)) {
      const copy = r.clone(); caches.open(runtime ? RUNTIME : APP).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => sameOrigin && req.mode === 'navigate' ? caches.match('index.html') : undefined)));
});
