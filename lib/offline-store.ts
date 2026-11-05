export interface OfflinePayload {
  id: string; // unik, misal Date.now() + random
  type: "employee" | "continuous" | "qc" | "status";
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

export async function addPendingPayload(type: "employee" | "continuous" | "qc" | "status", data: any): Promise<void> {
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
  const mergedMap = new Map<string, OfflinePayload>();

  // 1. Ambil dari IndexedDB
  try {
    const db = await openOfflineDB();
    const idbPayloads = await new Promise<OfflinePayload[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve(((event.target as IDBRequest).result as OfflinePayload[]) || []);
      };

      request.onerror = () => reject("Gagal memuat antrean offline.");
    });

    if (Array.isArray(idbPayloads)) {
      for (const p of idbPayloads) {
        if (p && p.id) mergedMap.set(p.id, p);
      }
    }
  } catch (err) {
    // IDB error fallback
  }

  // 2. Ambil dari localStorage antrean offline umum (dji_offline_queue)
  if (typeof window !== "undefined") {
    try {
      const rawQueue = localStorage.getItem("dji_offline_queue");
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id && !mergedMap.has(item.id)) {
              mergedMap.set(item.id, {
                id: item.id,
                type: (item.type || (item.inputType === "METER" ? "continuous" : "employee")) as any,
                timestamp: item.timestamp || new Date().toISOString(),
                data: item.data || item,
                retryCount: item.retryCount || 0,
              });
            }
          }
        }
      }
    } catch (e) {}

    // 3. Ambil dari localStorage antrean offline QC (dji_qc_offline_queue)
    try {
      const rawQc = localStorage.getItem("dji_qc_offline_queue");
      if (rawQc) {
        const parsedQc = JSON.parse(rawQc);
        if (Array.isArray(parsedQc)) {
          for (const item of parsedQc) {
            if (item && item.id && !mergedMap.has(item.id)) {
              mergedMap.set(item.id, {
                id: item.id,
                type: "qc",
                timestamp: item.timestamp || new Date().toISOString(),
                data: item.data || item,
                retryCount: item.retryCount || 0,
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  return Array.from(mergedMap.values());
}

export async function updatePendingPayload(payload: OfflinePayload): Promise<void> {
  // 1. Update di IndexedDB
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload);
      request.onsuccess = () => resolve();
      request.onerror = () => reject("Gagal mengupdate antrean offline.");
    });
  } catch (e) {}

  // 2. Update retryCount di localStorage dji_offline_queue
  if (typeof window !== "undefined") {
    try {
      const rawQueue = localStorage.getItem("dji_offline_queue");
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((it: any) =>
            it.id === payload.id ? { ...it, retryCount: payload.retryCount } : it
          );
          localStorage.setItem("dji_offline_queue", JSON.stringify(updated));
        }
      }
    } catch (e) {}

    // 3. Update retryCount di localStorage dji_qc_offline_queue
    try {
      const rawQc = localStorage.getItem("dji_qc_offline_queue");
      if (rawQc) {
        const parsedQc = JSON.parse(rawQc);
        if (Array.isArray(parsedQc)) {
          const updatedQc = parsedQc.map((it: any) =>
            it.id === payload.id ? { ...it, retryCount: payload.retryCount } : it
          );
          localStorage.setItem("dji_qc_offline_queue", JSON.stringify(updatedQc));
        }
      }
    } catch (e) {}
  }
}

export async function removePendingPayload(id: string): Promise<void> {
  // 1. Hapus dari IndexedDB
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Gagal menghapus antrean offline.");
    });
  } catch (e) {}

  // 2. Hapus dari localStorage dji_offline_queue
  if (typeof window !== "undefined") {
    try {
      const rawQueue = localStorage.getItem("dji_offline_queue");
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter((it: any) => it.id !== id);
          localStorage.setItem("dji_offline_queue", JSON.stringify(remaining));
        }
      }
    } catch (e) {}

    // 3. Hapus dari localStorage dji_qc_offline_queue
    try {
      const rawQc = localStorage.getItem("dji_qc_offline_queue");
      if (rawQc) {
        const parsedQc = JSON.parse(rawQc);
        if (Array.isArray(parsedQc)) {
          const remainingQc = parsedQc.filter((it: any) => it.id !== id);
          localStorage.setItem("dji_qc_offline_queue", JSON.stringify(remainingQc));
        }
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
  }
}

export async function clearAllPendingPayloads(): Promise<void> {
  // 1. Kosongkan IndexedDB
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Gagal mengosongkan antrean offline.");
    });
  } catch (e) {}

  // 2. Kosongkan localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("dji_offline_queue", JSON.stringify([]));
      localStorage.setItem("dji_qc_offline_queue", JSON.stringify([]));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
  }
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
