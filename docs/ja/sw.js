const CACHE_NAME="2025-02-24 00:00",urlsToCache=["/nocto-camera/","/nocto-camera/ja/","/nocto-camera/coi-serviceworker.js","/nocto-camera/index.js","/nocto-camera/img/before.webp","/nocto-camera/img/after.webp","/nocto-camera/img/29749307-64.webp","/nocto-camera/img/30061122-64.webp","/nocto-camera/img/29704256-64.webp","/nocto-camera/img/clahe-64.webp","/nocto-camera/img/loading.gif","/nocto-camera/camera.mp3","/nocto-camera/favicon/favicon.svg","https://cdn.jsdelivr.net/npm/wasm-feature-detect@1.8.0/dist/umd/index.min.js"];importScripts("https://cdn.jsdelivr.net/npm/wasm-feature-detect@1.8.0/dist/umd/index.min.js");async function getOpenCVPath(){const e=await wasmFeatureDetect.simd(),t=self.crossOriginIsolated&&await wasmFeatureDetect.threads();return e&&t?"/nocto-camera/opencv/threaded-simd/opencv_js.js":e?"/nocto-camera/opencv/simd/opencv_js.js":t?"/nocto-camera/opencv/threads/opencv_js.js":"/nocto-camera/opencv/wasm/opencv_js.js"}async function addOpenCVPaths(){const e=await getOpenCVPath();urlsToCache.push(e),urlsToCache.push(e.slice(0,-3)+".wasm")}addOpenCVPaths(),self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(e=>e.addAll(urlsToCache)))}),self.addEventListener("fetch",e=>{e.respondWith(caches.match(e.request).then(t=>t||fetch(e.request)))}),self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(e=>Promise.all(e.filter(e=>e!==CACHE_NAME).map(e=>caches.delete(e)))))})