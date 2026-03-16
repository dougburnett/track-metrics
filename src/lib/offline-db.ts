// IndexedDB wrapper for offline-first caching and sync queue
// Zero dependencies — raw IndexedDB API

const DB_NAME = "track-metrics-offline";
const DB_VERSION = 1;

export interface SyncQueueEntry {
  id?: number;
  table: "results" | "attendance";
  operation: "INSERT" | "UPDATE" | "UPSERT" | "DELETE";
  payload: Record<string, unknown>;
  created_at: string;
  status: "pending" | "in_flight" | "done" | "failed";
  attempts: number;
  last_error?: string;
  temp_id?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Reference data stores
      if (!db.objectStoreNames.contains("athletes")) db.createObjectStore("athletes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("stations")) db.createObjectStore("stations", { keyPath: "id" });
      if (!db.objectStoreNames.contains("metrics")) db.createObjectStore("metrics", { keyPath: "id" });
      if (!db.objectStoreNames.contains("station_metrics")) db.createObjectStore("station_metrics", { keyPath: "id" });
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("units")) db.createObjectStore("units", { keyPath: "id" });

      // Results store with indexes
      if (!db.objectStoreNames.contains("results")) {
        const resultsStore = db.createObjectStore("results", { keyPath: "id" });
        resultsStore.createIndex("metric_id", "metric_id", { unique: false });
        resultsStore.createIndex("athlete_id", "athlete_id", { unique: false });
      }

      // Attendance store with indexes
      if (!db.objectStoreNames.contains("attendance")) {
        const attendanceStore = db.createObjectStore("attendance", { keyPath: "id" });
        attendanceStore.createIndex("date", "date", { unique: false });
        attendanceStore.createIndex("athlete_id", "athlete_id", { unique: false });
      }

      // Sync queue with auto-increment
      if (!db.objectStoreNames.contains("sync_queue")) {
        const syncStore = db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        syncStore.createIndex("status", "status", { unique: false });
      }

      // Meta store for timestamps (key-value)
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// --- Generic CRUD ---

export async function putItem(store: string, item: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putItems(store: string, items: Record<string, unknown>[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const item of items) os.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getItem<T = Record<string, unknown>>(store: string, key: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllItems<T = Record<string, unknown>>(store: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(store: string, key: string | number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(store: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Sync Queue API ---

export async function addToSyncQueue(entry: Omit<SyncQueueEntry, "id">): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const req = tx.objectStore("sync_queue").add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueEntry[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const index = tx.objectStore("sync_queue").index("status");
    const req = index.getAll("pending");
    req.onsuccess = () => resolve(req.result as SyncQueueEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function updateSyncItem(id: number, updates: Partial<SyncQueueEntry>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const os = tx.objectStore("sync_queue");
    const req = os.get(id);
    req.onsuccess = () => {
      if (req.result) {
        os.put({ ...req.result, ...updates });
      }
      tx.oncomplete = () => resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCompletedSyncItems(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const os = tx.objectStore("sync_queue");
    const index = os.index("status");
    const req = index.openCursor("done");
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const index = tx.objectStore("sync_queue").index("status");
    const req = index.count("pending");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Clear all data (for sign-out) ---

export async function clearAllStores(): Promise<void> {
  const stores = ["athletes", "stations", "metrics", "station_metrics", "categories", "units", "results", "attendance", "sync_queue", "meta"];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    for (const store of stores) tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
