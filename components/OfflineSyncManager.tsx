"use client";

import React, { useEffect, useState } from "react";
import { 
  getAllPendingPayloads, 
  removePendingPayload, 
  updatePendingPayload, 
  clearAllPendingPayloads 
} from "@/lib/offline-store";
import { WifiOff, RefreshCw, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function OfflineSyncManager() {
  const { user, isLoggedIn } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = React.useRef(false);
  const syncStartTimeRef = React.useRef<number | null>(null);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
  const [lastSyncedCount, setLastSyncedCount] = useState(0);

  const refreshMobileBootstrapCache = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    try {
      const res = await fetch("/api/mobile/bootstrap", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.bootstrap) {
          localStorage.setItem("dji_mobile_bootstrap_cache", JSON.stringify(data.bootstrap));
        }
      }
    } catch (e) {
      console.warn("[OfflineSync] Gagal memperbarui cache bootstrap:", e);
    }
  };

  useEffect(() => {
    if (user) {
      refreshMobileBootstrapCache();
    }
  }, [user]);

  useEffect(() => {
    // 1. Pantau status jaringan online/offline browser
    const handleOnline = () => {
      setIsOffline(false);
      processQueue();
      refreshMobileBootstrapCache();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    setIsOffline(!navigator.onLine);
    checkPendingQueue();

    // AUTO-SYNC SEGERA saat mount jika online!
    if (typeof navigator !== "undefined" && navigator.onLine) {
      processQueue();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Piggyback sync: terpanggil ketika ada inputan berikutnya yang berhasil terkirim langsung (sinyal lancar)
    const handleTriggerSync = () => {
      if (!isSyncing && navigator.onLine) {
        processQueue();
      }
      refreshMobileBootstrapCache();
    };

    const handleQueueChanged = () => {
      checkPendingQueue();
      if (typeof navigator !== "undefined" && navigator.onLine && !isSyncing) {
        processQueue();
      }
    };

    window.addEventListener("dji_trigger_sync", handleTriggerSync);
    window.addEventListener("dji_offline_queue_changed", handleQueueChanged);

    // Pengecekan dan sinkronisasi berkala (tiap 20 detik)
    // Juga watchdog: force reset jika isSyncing macet > 25 detik
    const interval = setInterval(() => {
      if (isSyncingRef.current && syncStartTimeRef.current) {
        const elapsed = Date.now() - syncStartTimeRef.current;
        if (elapsed > 25000) {
          console.warn("[OfflineSync] Watchdog: sync macet > 25s, force reset.");
          isSyncingRef.current = false;
          syncStartTimeRef.current = null;
          setIsSyncing(false);
        }
      }
      if (navigator.onLine && !isSyncingRef.current) {
        processQueue();
      }
    }, 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("dji_trigger_sync", handleTriggerSync);
      window.removeEventListener("dji_offline_queue_changed", handleQueueChanged);
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  const checkPendingQueue = async () => {
    try {
      const items = await getAllPendingPayloads();
      setPendingCount(items.length);
    } catch (e) {
      console.error(e);
    }
  };

  const processQueue = async () => {
    if (isSyncingRef.current || isSyncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    try {
      const payloads = await getAllPendingPayloads();
      if (!payloads || payloads.length === 0) {
        setPendingCount(0);
        return;
      }

      isSyncingRef.current = true;
      syncStartTimeRef.current = Date.now();
      setIsSyncing(true);
      setPendingCount(payloads.length);

      // Deduplikasi payload sebelum dikirim untuk mencegah duplikat akibat lag
      const seenKeys = new Set<string>();
      const cleanPayloads: any[] = [];
      const redundantIds: string[] = [];

      for (const p of payloads) {
        const pData = p.data || {};
        const isBs = Boolean(pData.isPanelGagal || pData.isPanelBs || String(pData.panelNo || "").includes("BS"));
        const mc = String(pData.nomorMc || "").trim().toUpperCase();
        const pot = String(pData.potonganKe || "").trim();
        const pnl = String(pData.panelNo || "").trim();
        const op = String(pData.operatorId || "").trim();

        const queueKey = !isBs && pnl && pot && mc ? `${mc}_${pot}_${pnl}_${op}` : null;
        if (queueKey && seenKeys.has(queueKey)) {
          console.warn("[OfflineSync] Menghapus item duplikat dari antrean lokal:", queueKey);
          redundantIds.push(p.id);
          continue;
        }
        if (queueKey) seenKeys.add(queueKey);
        cleanPayloads.push(p);
      }

      for (const rId of redundantIds) {
        await removePendingPayload(rId).catch(() => {});
      }

      // Format payload untuk batch sync via standard HTTP API
      const itemsToSend = cleanPayloads.map((p) => ({
        id: p.id,
        type: p.type,
        timestamp: p.timestamp,
        data: p.data,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let res: Response;
      try {
        res = await fetch("/api/mobile/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsToSend }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.ok) {
        const result = await res.json();
        const succeededIds = new Set<string>(result.succeeded || []);

        for (const sId of succeededIds) {
          await removePendingPayload(sId);
        }

        const remaining = payloads.filter((p) => !succeededIds.has(p.id));
        setPendingCount(remaining.length);

        if (succeededIds.size > 0) {
          setLastSyncedCount(succeededIds.size);
          setShowSuccessMsg(true);
          setTimeout(() => setShowSuccessMsg(false), 5000);

          // Beritahu seluruh komponen dan drawer agar refresh tampilan data
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("dji_data_synced", {
                detail: { count: succeededIds.size, ids: Array.from(succeededIds) },
              })
            );
          }
        }

        // Catat retry count untuk payload yang tersisa
        for (const item of remaining) {
          const currentRetries = (item.retryCount || 0) + 1;
          if (currentRetries >= 3) {
            console.warn(`[OfflineSync] Payload ${item.id} gagal setelah 3 percobaan. Dihapus dari antrean lokal agar tidak macet.`);
            await removePendingPayload(item.id);
          } else {
            await updatePendingPayload({
              ...item,
              retryCount: currentRetries,
            });
          }
        }
      } else {
        console.error("[OfflineSync] Server sync mengembalikan HTTP error:", res.status);
        for (const p of payloads) {
          const retries = (p.retryCount || 0) + 1;
          if (retries >= 3) {
            await removePendingPayload(p.id);
          } else {
            await updatePendingPayload({ ...p, retryCount: retries });
          }
        }
      }
    } catch (err) {
      // Jaringan terputus / server unreachable - tunda secara senyap
      console.log("[OfflineSync] Sinkronisasi tertunda (server tidak terjangkau):", err);
    } finally {
      isSyncingRef.current = false;
      syncStartTimeRef.current = null;
      setIsSyncing(false);
    }
  };

  const handleClearQueue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Yakin ingin menghapus semua antrean data lokal yang belum terkirim?")) {
      try {
        await clearAllPendingPayloads();
        setPendingCount(0);
        isSyncingRef.current = false;
        setIsSyncing(false);
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!isOffline && pendingCount === 0 && !isSyncing && !showSuccessMsg) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2">
      {/* 0. Banner Peringatan Mode Offline */}
      {isOffline && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-rose-400/50 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span>Koneksi Terputus (Mode Offline)</span>
          </div>
          <a
            href="/offline.html"
            className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 no-underline cursor-pointer"
          >
            <span>Buka Form Offline &rarr;</span>
          </a>
        </div>
      )}

      {/* 1. Banner Proses Sinkronisasi Sedang Berlangsung */}
      {!isOffline && isSyncing && (
        <div className="flex items-center justify-between gap-2.5 bg-sky-950/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-sky-600/60 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            <span>Menyinkronkan data offline ke database...</span>
          </div>
          <button
            type="button"
            onClick={handleClearQueue}
            className="p-1 hover:bg-sky-900 text-sky-300 hover:text-rose-400 rounded-md transition-colors cursor-pointer"
            title="Bersihkan antrean lokal yang macet"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Banner Antrean Menunggu Sinkronisasi */}
      {!isOffline && !isSyncing && pendingCount > 0 && (
        <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs font-semibold">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>{pendingCount} Data Tersimpan di Perangkat</span>
          <button
            type="button"
            onClick={() => processQueue()}
            className="ml-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sinkronkan Sekarang</span>
          </button>
          <button
            type="button"
            onClick={handleClearQueue}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
            title="Hapus semua antrean offline"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Banner Berhasil Sinkronisasi */}
      {showSuccessMsg && (
        <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{lastSyncedCount > 0 ? `${lastSyncedCount} data offline berhasil disinkronkan ke server!` : "Data offline berhasil disinkronkan ke server!"}</span>
        </div>
      )}
    </div>
  );
}
