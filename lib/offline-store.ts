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

    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
      }
      resolve();
    };
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

    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
      }
      resolve();
    };
    request.onerror = () => reject("Gagal mengupdate antrean offline.");
  });
}

export async function removePendingPayload(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
      }
      resolve();
    };
    request.onerror = () => reject("Gagal menghapus antrean offline.");
  });
}

export async function clearAllPendingPayloads(): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
      }
      resolve();
    };
    request.onerror = () => reject("Gagal mengosongkan antrean offline.");
  });
}

/**
 * Memicu sinkronisasi antrean offline seketika (piggyback sync).
 * Dipanggil saat inputan live berikutnya berhasil terkirim (sinyal terbukti lancar).
 */
export function triggerPiggybackSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dji_trigger_sync"));
  }
}

/**
 * Memperbarui snapshot lokal mesin di localStorage (dji_mobile_bootstrap)
 * agar mode offline langsung mengetahui nomor potongan & panel terakhir.
 */
export function updateLocalMachineSnapshot(
  nomorMc: string,
  updates: {
    potonganKe?: number;
    nextPanelNo?: number;
    lastMeter?: number;
    designId?: string;
    newPanelItem?: any;
  }
) {
  if (typeof window === "undefined" || !nomorMc) return;
  try {
    const raw = localStorage.getItem("dji_mobile_bootstrap");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.machines)) return;

    const mcUpper = nomorMc.toUpperCase().trim();
    const target = data.machines.find(
      (m: any) => m.nomorMc?.toUpperCase().trim() === mcUpper
    );
    if (target) {
      if (updates.potonganKe !== undefined) target.potonganKe = updates.potonganKe;
      if (updates.nextPanelNo !== undefined) target.nextPanelNo = updates.nextPanelNo;
      if (updates.lastMeter !== undefined) target.lastMeter = updates.lastMeter;
      if (updates.designId !== undefined) target.designId = updates.designId;
      if (updates.newPanelItem) {
        if (!Array.isArray(target.recentItems)) target.recentItems = [];
        target.recentItems.unshift(updates.newPanelItem);
        if (target.recentItems.length > 30) target.recentItems.pop();
      }
      localStorage.setItem("dji_mobile_bootstrap", JSON.stringify(data));
      window.dispatchEvent(new CustomEvent("dji_bootstrap_updated", { detail: data }));
    }
  } catch (e) {
    console.warn("Failed to update local machine snapshot:", e);
  }
}
