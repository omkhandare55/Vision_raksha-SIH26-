// public/sw.js — RetinAI Service Worker
// Strategy: Cache-first for assets, Network-first for API, Offline queue for images
// Spec: TRD Section 7 (Offline-first PWA)

const CACHE_NAME     = "retinai-v4";
const OFFLINE_URL    = "/offline.html";

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
];

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Pre-caching app shell");
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log(`[SW] Deleting old cache: ${k}`);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ── Online/Offline client notification ───────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "PING") {
    event.source.postMessage({ type: "PONG", cacheVersion: CACHE_NAME });
  }
});

// ── Fetch: routing strategy ───────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass cache completely on localhost so UI changes reflect immediately
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Skip non-GET for API (handled by background sync below)
  if (request.method !== "GET" && url.pathname.startsWith("/api/")) {
    return;
  }

  // PDF and FHIR reports: always network-only (never cache large PDFs)
  if (url.pathname.includes("/report/")) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: "OFFLINE", message: "Report download requires an internet connection." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      ))
    );
    return;
  }

  // API calls: Network-first, fallback to cached
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: Cache-first, fallback to network
  event.respondWith(cacheFirst(request));
});

// ── Background Sync: offline analyse queue ────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "retinai-sync-queue") {
    event.waitUntil(flushQueue());
  }
});

// ── Strategies ────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    const cache    = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: "OFFLINE", message: "No network. Reconnect to sync." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request.clone());
    const cache    = await caches.open(CACHE_NAME);
    if (request.method === "GET") cache.put(request, response.clone());
    return response;
  } catch {
    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match(OFFLINE_URL) || new Response("Offline", { status: 503 });
    }
    return new Response("Offline", { status: 503 });
  }
}

// ── Flush offline queue when back online ──────────────────────
async function flushQueue() {
  // Read queued requests from IndexedDB (written by offlineQueue.js)
  const db = await openQueueDB();
  const tx = db.transaction("queue", "readwrite");
  const store = tx.objectStore("queue");
  const items = await getAllFromStore(store);

  console.log(`[SW] Flushing ${items.length} queued analyses`);

  for (const item of items) {
    try {
      // Reconstruct FormData from stored blob
      const form = new FormData();
      form.append("file", item.blob, item.filename);
      if (item.patient_id) form.append("patient_id", item.patient_id);

      const resp = await fetch("/api/analyse", { method: "POST", body: form });
      if (resp.ok) {
        // Remove from queue on success
        const delTx = db.transaction("queue", "readwrite");
        delTx.objectStore("queue").delete(item.id);
        await new Promise(r => delTx.addEventListener("complete", r));

        const resultData = await resp.json().catch(() => ({}));
        const clients = await self.clients.matchAll();
        clients.forEach(client => client.postMessage({
          type: "SYNC_COMPLETE",
          screening_id: resultData.screening_id,
          patient_name: item.patient_name,
        }));
      }
    } catch (err) {
      console.warn("[SW] Sync failed for item", item.id, err);
    }
  }
}

// ── IndexedDB helpers ─────────────────────────────────────────
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("retinai-queue", 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Push notifications (future) ───────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "RetinAI", body: "New update" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "retinai-notification",
    })
  );
});
