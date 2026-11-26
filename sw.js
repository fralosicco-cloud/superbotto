const CACHE = 'superbotto-v4';
const ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ---------- Notifiche push ----------
self.addEventListener('push', (event) => {
  let dati = {};
  try { dati = event.data ? event.data.json() : {}; } catch (err) { dati = { testo: event.data && event.data.text() }; }
  const titolo = dati.titolo || 'SuperBotto 🍀';
  event.waitUntil(
    self.registration.showNotification(titolo, {
      body: dati.testo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: dati.tag || undefined,
      renotify: !!dati.tag,
      data: { pagina: dati.pagina || 'bacheca' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const pagina = (event.notification.data && event.notification.data.pagina) || 'bacheca';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      for (const c of finestre) {
        if (new URL(c.url).origin === self.location.origin) {
          c.postMessage({ tipo: 'apri-pagina', pagina });
          return c.focus();
        }
      }
      return self.clients.openWindow('/?pagina=' + encodeURIComponent(pagina));
    })
  );
});
