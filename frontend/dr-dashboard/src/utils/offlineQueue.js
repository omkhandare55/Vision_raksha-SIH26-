// src/utils/offlineQueue.js
// PWA-003 — IndexedDB offline image queue
// Stores images when offline → SW flushes on reconnect
// Spec: TRD Section 7

const DB_NAME    = "retinai-queue";
const DB_VERSION = 1;
const STORE      = "queue";

// ── DB init ───────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Enqueue image for offline analysis ───────────────────────
export async function enqueueImage({ file, patientId = null, patientName = "Unknown" }) {
  const db    = await openDB();
  const blob  = file instanceof Blob ? file : new Blob([file]);
  const entry = {
    blob,
    filename:     file.name || "capture.jpg",
    patient_id:   patientId,
    patient_name: patientName,
    queued_at:    new Date().toISOString(),
    status:       "pending",
  };

  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = (e) => {
      console.log("[OfflineQueue] Enqueued image id:", e.target.result);
      resolve(e.target.result);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Get all pending items ─────────────────────────────────────
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Trigger background sync when back online ──────────────────
export async function triggerSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("retinai-sync-queue");
      console.log("[OfflineQueue] Background sync registered");
    } catch (err) {
      console.warn("[OfflineQueue] Background sync not supported:", err);
      // Fallback: manual flush
      manualFlush();
    }
  }
}

// ── Manual flush (fallback for browsers without BackgroundSync) ─
async function manualFlush() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const items = await new Promise((res, rej) => {
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });

  console.log(`[OfflineQueue] Manual flush: ${items.length} items`);

  for (const item of items) {
    try {
      const form = new FormData();
      form.append("file", item.blob, item.filename);
      if (item.patient_id) form.append("patient_id", item.patient_id);

      const resp = await fetch("/api/analyse", { method: "POST", body: form });
      if (resp.ok) {
        const delTx = db.transaction(STORE, "readwrite");
        delTx.objectStore(STORE).delete(item.id);
        console.log("[OfflineQueue] Synced item", item.id);
      }
    } catch (err) {
      console.warn("[OfflineQueue] Failed to sync item", item.id, err);
    }
  }
}

// ── Register online listener once ────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[OfflineQueue] Back online — triggering sync");
    triggerSync();
  });
}
