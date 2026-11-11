// Service worker (#266 push, #400 offline). Hand-written and unbundled: it must be served from the
// site root as /sw.js. Besides push and notification taps it keeps the app shell and the last-seen
// league data so the app opens offline (read only: writes are never cached or replayed).
//
// `/sw.js?nocache=1` (the e2e build) skips all caching, because a service worker's own fetches
// would bypass Playwright's `page.route` mocks.
const SHELL_CACHE = "ps-shell-v1";
// Keep in step with DATA_CACHE in src/utils/offlineCache.ts, which clears it on sign-out.
const DATA_CACHE = "ps-data-v1";
const SHELL_KEY = "/index.html";
const CACHING = !new URL(self.location.href).searchParams.has("nocache");

// Only what a member reads to see where their league stands. Chat, the feed, avatars, push and
// invites are never kept.
const CACHEABLE_API =
  /^\/api\/(leagues\/(user-leagues|\d+(\/seasons)?)|seasons\/\d+(\/(standings|teams|settings))?|teams\/\d+)$/;
const STATIC_PATH = /^\/(assets\/|icons\/|favicon\.svg$)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== SHELL_CACHE && n !== DATA_CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

const stamped = async (response) => {
  const headers = new Headers(response.headers);
  headers.set("X-Cached-At", String(Date.now()));
  return new Response(await response.blob(), { status: response.status, headers });
};

const networkFirstShell = async (request) => {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    // An invite page carries that league's name in its tags; only the plain shell is kept.
    const plain = !new URL(request.url).pathname.startsWith("/join/");
    if (response.ok && !response.redirected && plain) await cache.put(SHELL_KEY, response.clone());
    return response;
  } catch (error) {
    const shell = await cache.match(SHELL_KEY);
    if (shell) return shell;
    throw error;
  }
};

const cacheFirstStatic = async (request) => {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
};

const networkFirstData = async (request, event) => {
  const cache = await caches.open(DATA_CACHE);
  const key = new Request(request.url);
  try {
    const response = await fetch(request);
    if (response.ok)
      event.waitUntil(stamped(response.clone()).then((copy) => cache.put(key, copy)));
    return response;
  } catch (error) {
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!CACHING || request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
  } else if (sameOrigin && STATIC_PATH.test(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  } else if (CACHEABLE_API.test(url.pathname)) {
    event.respondWith(networkFirstData(request, event));
  }
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "PostSzn Fantasy", {
      body: message.body || "",
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open)
        return open.focus().then(() => ("navigate" in open ? open.navigate(target) : undefined));
      return self.clients.openWindow(target);
    }),
  );
});
