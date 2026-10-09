/**
 * Service worker de la plateforme CHG.
 * Stratégie : "app shell" (CSS/JS/icônes/pages) en cache-first avec mise à
 * jour en arrière-plan ; les appels à l'API (/api/*) passent toujours par
 * le réseau (les données doivent rester à jour), sans jamais être mis en
 * cache, afin d'éviter d'afficher des informations obsolètes ou de fuiter
 * des données entre deux comptes utilisateurs.
 */
const CACHE_NAME = "chg-shell-v1";

const APP_SHELL = [
  "/index.html",
  "/login.html",
  "/rejoindre.html",
  "/css/style.css",
  "/js/api.js",
  "/js/ui.js",
  "/js/nav.js",
  "/js/pwa.js",
  "/manifest.json",
  "/assets/logo-chg.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Les données de l'API ne sont jamais mises en cache : toujours le réseau.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
