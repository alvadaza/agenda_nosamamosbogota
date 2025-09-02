const CACHE_NAME = "agenda-final-v1";
const urlsToCache = [
  "index.html",
  "admin.html",
  "user.html",
  "css/style.css", // Ajusta el nombre del CSS real
  "js/app.js", // Ajusta si tienes más archivos JS
  "assets/icon-192.png",
  "assets/icon-512.png",
];

// Instalación del service worker y cacheo de recursos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activación y limpieza de caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
});

// Intercepción de peticiones para servir desde cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
