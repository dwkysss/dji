"use client";

import React, { useEffect, useState } from "react";
import { 
  getAllPendingPayloads, 
  removePendingPayload, 
  updatePendingPayload,
  clearAllPendingPayloads,
  OfflinePayload 
} from "@/lib/offline-store";
import { createProductionReport } from "@/actions/employee-actions";
import { submitContinuousReport } from "@/actions/continuous-actions";
import { submitQCInspection } from "@/actions/qc-actions";
import { WifiOff, RefreshCw, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function OfflineSyncManager() {
  const { isLoggedIn } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOffline(!navigator.onLine);
    checkPendingQueue();

    const handleOnline = () => {
      setIsOffline(false);
      processQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set interval to periodically check queue if online
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        checkPendingQueue();
      }
    }, 15000); // 15 detik

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [isSyncing, isLoggedIn]);

  const checkPendingQueue = async () => {
    try {
      const items = await getAllPendingPayloads();
      setPendingCount(items.length);
      if (items.length > 0 && navigator.onLine && !isSyncing) {
        processQueue();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const processQueue = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const payloads = await getAllPendingPayloads();
      if (payloads.length === 0) {
        setPendingCount(0);
        setIsSyncing(false);
        return;
      }

      let successCount = 0;

      for (const item of payloads) {
        let result: any = { success: false, error: "" };
        
        try {
          if (item.type === "employee") {
            result = await createProductionReport(item.data);
          } else if (item.type === "continuous") {
            result = await submitContinuousReport(item.data);
          } else if (item.type === "qc") {
            result = await submitQCInspection(item.data);
          }

          const errStr = String(result?.error || "").toLowerCase();
          const isAlreadySaved = 
            errStr.includes("sudah ada") || 
            errStr.includes("already exists") || 
            errStr.includes("duplicate") || 
            errStr.includes("duplikat");

          if (result?.success || isAlreadySaved) {
            await removePendingPayload(item.id);
            successCount++;
          } else {
            // Jika gagal, catat retry count
            const currentRetries = (item.retryCount || 0) + 1;
            if (currentRetries >= 3) {
              console.warn(`[OfflineSync] Payload ${item.id} gagal setelah 3 percobaan (${result?.error}). Dihapus dari antrean lokal.`);
              await removePendingPayload(item.id);
            } else {
              await updatePendingPayload({
                ...item,
                retryCount: currentRetries,
              });
            }
          }
        } catch (err: any) {
          console.error("Gagal sync payload", item.id, err);
          const currentRetries = (item.retryCount || 0) + 1;
          if (currentRetries >= 3) {
            await removePendingPayload(item.id);
          } else {
            await updatePendingPayload({
              ...item,
              retryCount: currentRetries,
            });
          }
        }
      }

      const remaining = await getAllPendingPayloads();
      setPendingCount(remaining.length);

      if (successCount > 0) {
        setShowSuccessMsg(true);
        setTimeout(() => setShowSuccessMsg(false), 4000);
      }

    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await clearAllPendingPayloads();
      setPendingCount(0);
      setIsSyncing(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOffline && pendingCount === 0 && !isSyncing && !showSuccessMsg) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      {isOffline && (
        <div className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode</span>
          {pendingCount > 0 && (
            <span className="bg-white text-rose-600 px-2 rounded-full text-xs ml-1 font-bold">
              {pendingCount} Antrean
            </span>
          )}
        </div>
      )}

      {isSyncing && !isOffline && (
        <div className="flex items-center gap-2.5 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Menyinkronkan {pendingCount} data...</span>
          <button
            type="button"
            onClick={handleClearQueue}
            className="ml-1 p-1 hover:bg-amber-600 rounded-full transition-colors cursor-pointer"
            title="Tutup & bersihkan antrean tertahan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showSuccessMsg && !isSyncing && !isOffline && (
        <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Sinkronisasi Offline Selesai</span>
        </div>
      )}
    </div>
  );
}

