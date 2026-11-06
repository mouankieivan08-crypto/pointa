// Pointa — Service Worker : notifications, modèles de reconnaissance, pointage hors ligne
const MODEL_CACHE = "pointa-modeles-v1";
const APP_CACHE = "pointa-app-v1";
const KEEP = [MODEL_CACHE, APP_CACHE];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("pointa-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  ),
);

/**
 * Trois règles, et rien d'autre en cache :
 *  1. /models/*        → les modèles de reconnaissance (~7 Mo), téléchargés une seule fois.
 *  2. /_next/static/*  → le code de l'application (adresses uniques par version).
 *  3. /espace          → l'écran de pointage : on prend toujours la version du réseau,
 *                        et on garde la dernière pour pouvoir pointer sans connexion.
 * Tout le reste passe directement au réseau : les données doivent rester fraîches.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/models/")) return event.respondWith(cacheFirst(req, MODEL_CACHE));
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.json" || url.pathname === "/icon-512.png") {
    return event.respondWith(cacheFirst(req, APP_CACHE));
  }
  if (req.mode === "navigate" && url.pathname === "/espace") return event.respondWith(networkFirst(req, APP_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    // On ne garde que la page complète ; une redirection (session expirée) ne doit pas être figée.
    if (res.ok && !res.redirected) cache.put("/espace", res.clone());
    return res;
  } catch {
    const hit = await cache.match("/espace");
    if (hit) return hit;
    throw new Error("hors ligne");
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "Pointa";
  const options = {
    body: data.body || "",
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    vibrate: [80, 40, 80],
    data: { url: data.url || "/espace" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/espace";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
