// EditPro AI Studio service worker: makes the app installable and usable offline.
// Strategy: pages are network-first (so updates arrive), other same-origin files are
// cache-first. User media never passes through here; it lives in IndexedDB.
const CACHE = 'editpro-v10';

// On install, save the page AND the app files it uses, so the app opens offline from the first visit.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      const shell = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
      try {
        const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
        for (const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)) shell.push(m[1]);
      } catch {
        /* offline during install: cache what we can */
      }
      await Promise.all(shell.map((u) => c.add(u).catch(() => {})));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
