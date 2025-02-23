const CACHE_NAME = "2025-02-24 00:00";
const urlsToCache = [
  "/nocto-camera/",
  "/nocto-camera/en/",
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
});
