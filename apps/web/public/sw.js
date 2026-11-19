/*
 * OpenMonetis service worker.
 *
 * Caches only the static shell (hashed build assets, fonts, icons and brand images) so the
 * installed app opens instantly and shows a branded screen without network. Pages and API
 * responses are never stored: they carry private financial data (`Cache-Control: private,
 * no-store`) and always go to the network.
 */
const SHELL_CACHE = "openmonetis-shell-v1";
const ASSET_CACHE = "openmonetis-assets-v1";
const STATIC_CACHE = "openmonetis-static-v1";
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE];
const OFFLINE_URL = "/offline.html";
const SHELL_FILES = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/images/openmonetis-mark.svg",
];
/** Hashed files never change; older builds are trimmed past this many entries. */
const MAX_ASSET_ENTRIES = 160;
const STATIC_PREFIXES = ["/images/", "/logos/", "/flags/", "/avatars/"];
const STATIC_FILES = new Set([
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/manifest.json",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("openmonetis-") && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

// A new version waits until the person accepts the update, so a form is never reloaded mid-edit.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (STATIC_FILES.has(url.pathname) || STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (API, server functions, auth) goes to the network untouched.
});

async function navigate(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
    void trimAssets(cache);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSET_ENTRIES;
  for (let index = 0; index < excess; index++) await cache.delete(keys[index]);
}
