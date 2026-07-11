const CACHE = "dcr-static-v3";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "dcr-sync") event.waitUntil(flushQueue());
});

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dcr-offline", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("queue")) {
        request.result.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("queue", "readonly").objectStore("queue").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function replaceQueue(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readwrite");
    const store = transaction.objectStore("queue");
    store.clear();
    items.forEach((item) => store.add(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function enqueueItem(payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readwrite");
    transaction.objectStore("queue").add(payload);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function flushQueue() {
  let queue = await readQueue();
  while (queue.length > 0) {
    const item = queue[0];
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: item.body ? JSON.stringify(item.body) : undefined
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      queue = queue.slice(1);
      await replaceQueue(queue);
    } catch {
      break;
    }
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "dcr-queue-add") enqueueItem(event.data.payload);
  if (event.data?.type === "dcr-sync-now") flushQueue();
  if (event.data?.type === "dcr-clear-private-data") {
    event.waitUntil(replaceQueue([]));
  }
  if (event.data?.type === "dcr-queue-count") {
    readQueue().then((queue) => event.source?.postMessage({ type: "dcr-queue-count", count: queue.length }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Never persist authenticated pages, API responses, signed URLs or auth flows.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(staticStrategy(request));
  }
});

async function staticStrategy(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
