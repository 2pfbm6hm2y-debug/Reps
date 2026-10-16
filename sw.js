/* Reps service worker: makes the app open offline. The sync script on Google is never cached. */
const APP_CACHE = 'reps-app-1.0.0';
const FONT_CACHE = 'reps-fonts-1';
const APP_FILES = ['./', './index.html', './app.js', './sync.gs', './manifest.webmanifest',
  './icons/plates-180.png', './icons/plates-192.png', './icons/plates-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    // cache: 'reload' skips the browser's HTTP cache so a new version never precaches old files.
    await app.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [APP_CACHE, FONT_CACHE];
    for (const k of await caches.keys()) if (k.startsWith('reps-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(APP_CACHE);
      try {
        // Always check with the server (cheap when unchanged) so updates show on the next open.
        const res = await fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const c = await caches.open(FONT_CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});
