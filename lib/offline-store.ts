export interface OfflinePayload {
  id: string; // unik, misal Date.now() + random
  type: "employee" | "continuous" | "qc";
  timestamp: string;
  data: any; // payload form yang gagal terkirim
  retryCount?: number;
}

const DB_NAME = "dji_offline_db";
const STORE_NAME = "pending_queue";
const DB_VERSION = 1;

export async function openOfflineDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject("Hanya bisa dijalankan di client-side");
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject("Gagal membuka IndexedDB: " + (event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function addPendingPayload(type: "employee" | "continuous" | "qc", data: any): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const payload: OfflinePayload = {
      id: Date.now().toString() + "-" + Math.floor(Math.random() * 1000),
      type,
      timestamp: new Date().toISOString(),
      data,
      retryCount: 0,
    };

    const request = store.add(payload);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Gagal menyimpan ke antrean offline.");
  });
}

export async function getAllPendingPayloads(): Promise<OfflinePayload[]> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as OfflinePayload[]);
      };

      request.onerror = () => reject("Gagal memuat antrean offline.");
    });
  } catch (err) {
    // Return array kosong jika SSR atau tidak support
    return [];
  }
}

export async function updatePendingPayload(payload: OfflinePayload): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(payload);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Gagal mengupdate antrean offline.");
  });
}

export async function removePendingPayload(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Gagal menghapus antrean offline.");
  });
}

export async function clearAllPendingPayloads(): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Gagal mengosongkan antrean offline.");
  });
}
