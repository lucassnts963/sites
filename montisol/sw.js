/* Service worker do RDO de campo: rede primeiro, cache como reserva (funciona sem sinal na planta).
   Sempre busca a versão nova quando há internet; sem internet usa a última que o aparelho já abriu. */
const CACHE = 'montisol-rdo-v2';
const BASE = ['./', './index.html', './rdo/', './rdo/index.html', './rdo/assets/app.css', './rdo/assets/app.js', './rdo/manifest.webmanifest', './rdo/icone.svg',
  './dados/trocadores.json', './dados/efetivo.exemplo.json', './desenhos/catalogo.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(BASE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(r, copia)); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || Response.error()))
  );
});
