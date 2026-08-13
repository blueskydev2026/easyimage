const CACHE = "flow-gallery-v5";
const MANIFEST_PATH = new URL("./manifest.json", self.registration.scope).pathname;
const MANIFEST = {
  name: "גלריה זורמת",
  short_name: "גלריה",
  description: "ניהול וצפייה נוחה בתמונות מהמחשב",
  id: ".",
  start_url: ".",
  scope: ".",
  display: "standalone",
  dir: "rtl",
  lang: "he",
  background_color: "#111827",
  theme_color: "#0f172a",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  file_handlers: [{
    action: ".",
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"] },
  }],
  launch_handler: { client_mode: "focus-existing" },
};
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname === MANIFEST_PATH) {
    event.respondWith(new Response(JSON.stringify(MANIFEST), {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }),
    ),
  );
});
