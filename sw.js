// Service worker mínimo — necesario para que Chrome ofrezca "Instalar app".
// No cachea datos del sistema (los módulos siguen siempre online),
// solo permite que el navegador reconozca el sitio como instalable.
const CACHE_NAME = 'mayo-shell-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function () {
        // Si algún archivo no existe con ese nombre exacto, no rompemos la instalación.
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres
          .filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Estrategia "network first": siempre intenta traer la versión online
// (porque los KPIs y módulos cambian todo el tiempo) y solo usa el
// cache como respaldo si no hay conexión.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function (respuesta) {
        var copia = respuesta.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copia);
        });
        return respuesta;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});
