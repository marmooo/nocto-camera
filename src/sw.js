const cacheName = "2026-05-24 00:00";
const urlsToCache = [
  "/nocto-camera/coi-serviceworker.js",
  "/nocto-camera/index.js",
  "/nocto-camera/img/before.webp",
  "/nocto-camera/img/after.webp",
  "/nocto-camera/img/29749307-64.webp",
  "/nocto-camera/img/30061122-64.webp",
  "/nocto-camera/img/29704256-64.webp",
  "/nocto-camera/img/clahe-64.webp",
  "/nocto-camera/img/loading.gif",
  "/nocto-camera/camera.mp3",
  "/nocto-camera/favicon/favicon.svg",
  "https://cdn.jsdelivr.net/npm/wasm-feature-detect@1.8.0/dist/umd/index.min.js",
];

importScripts(
  "https://cdn.jsdelivr.net/npm/wasm-feature-detect@1.8.0/dist/umd/index.min.js",
);

async function getOpenCVPath() {
  const simdSupport = await wasmFeatureDetect.simd();
  const threadsSupport = self.crossOriginIsolated &&
    await wasmFeatureDetect.threads();
  if (simdSupport && threadsSupport) {
    return "/nocto-camera/opencv/threaded-simd/opencv_js.js";
  } else if (simdSupport) {
    return "/nocto-camera/opencv/simd/opencv_js.js";
  } else if (threadsSupport) {
    return "/nocto-camera/opencv/threads/opencv_js.js";
  } else {
    return "/nocto-camera/opencv/wasm/opencv_js.js";
  }
}

async function addOpenCVPaths() {
  const opencvPath = await getOpenCVPath();
  urlsToCache.push(opencvPath);
  urlsToCache.push(opencvPath.slice(0, -3) + ".wasm");
}

addOpenCVPaths();

async function preCache() {
  const cache = await caches.open(cacheName);
  await Promise.all(
    urlsToCache.map((url) =>
      cache.add(url).catch((err) => console.warn("Failed to cache", url, err))
    ),
  );
  self.skipWaiting();
}

async function handleFetch(event) {
  const cached = await caches.match(event.request);
  return cached || fetch(event.request);
}

async function cleanOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((name) => name !== cacheName ? caches.delete(name) : null),
  );
  self.clients.claim();
}

self.addEventListener("install", (event) => {
  event.waitUntil(preCache());
});
self.addEventListener("fetch", (event) => {
  event.respondWith(handleFetch(event));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(cleanOldCaches());
});
