const CACHE_NAME = "deadlock-stats-static-v1";
const STATIC_TYPES = new Set(["style", "script", "font", "image"]);

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith("deadlock-stats-static-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || network;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("./index.html", response.clone()));
        return response;
      }).catch(async () => (await caches.match("./index.html")) || Response.error()),
    );
    return;
  }

  if (STATIC_TYPES.has(request.destination)) {
    const networkPreferred = request.destination === "script" || request.destination === "style";
    event.respondWith(networkPreferred ? networkFirst(request) : staleWhileRevalidate(request));
  }
});
