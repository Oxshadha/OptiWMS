// Bump to invalidate old caches when changing offline navigation behavior.
const CACHE_VERSION = "optiwms-worker-shell-v2";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "/manifest.json",
  "/favicon.ico",
  "/worker",
  "/worker/login",
];
const CRITICAL_WORKER_ROUTES = [
  "/worker/tasks",
  "/worker/picking",
  "/worker/putaway",
  "/worker/cycle-count",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  const isWorkerRoute =
    request.mode === "navigate" && url.pathname.startsWith("/worker");
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.ico";

  if (!isWorkerRoute && !isStaticAsset) {
    return;
  }

  if (isWorkerRoute) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          void caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Offline fallback: do NOT show login for arbitrary worker routes.
          // Returning the login page here looks like an auth failure when the tab reloads offline.
          const homeFallback = await caches.match("/worker");
          if (homeFallback) {
            return homeFallback;
          }

          // If the user is explicitly navigating to login, it's safe to return it offline.
          if (url.pathname === "/worker/login") {
            const loginFallback = await caches.match("/worker/login");
            if (loginFallback) {
              return loginFallback;
            }
          }

          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        const responseClone = response.clone();
        void caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_WORKER_ROUTES") {
    return;
  }

  const requestedRoutes = Array.isArray(event.data.routes)
    ? event.data.routes
    : [];

  const routesToWarm = requestedRoutes.filter((route) =>
    CRITICAL_WORKER_ROUTES.includes(route)
  );

  if (routesToWarm.length === 0) {
    return;
  }

  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      await Promise.all(
        routesToWarm.map(async (route) => {
          try {
            const response = await fetch(route, { credentials: "same-origin" });
            if (response && response.ok) {
              await cache.put(route, response.clone());
            }
          } catch (error) {
            // Ignore warm failures; the route can still be cached on normal navigation.
          }
        })
      );
    })
  );
});
