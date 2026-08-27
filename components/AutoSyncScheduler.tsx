"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Zap, CheckCircle2 } from "lucide-react";

export default function AutoSyncScheduler() {
  const [notification, setNotification] = useState<{ message: string; time: string; count?: number } | null>(null);
  const [scheduleState, setScheduleState] = useState<{ time: string; enabled: boolean; safeMode: boolean } | null>(null);
  const isSyncingRef = useRef(false);
  const lastSyncedKeyRef = useRef<string>("");

  // 1. Fetch schedule config on mount and every 30 seconds
  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/sync/schedule-info", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          setScheduleState({
            time: (json.time || "09:00").trim(),
            enabled: json.enabled !== false,
            safeMode: json.safeMode !== false,
          });
        }
      }
    } catch (e) {
      console.warn("[Auto-Sync Scheduler] Config fetch warning:", e);
    }
  };

  useEffect(() => {
    fetchConfig();
    const configInterval = setInterval(fetchConfig, 30000);
    return () => clearInterval(configInterval);
  }, []);

  // 2. Heartbeat check every 5 seconds
  useEffect(() => {
    const heartbeatInterval = setInterval(async () => {
      if (isSyncingRef.current || !scheduleState || !scheduleState.enabled || !scheduleState.time) {
        return;
      }

      // Get local time in HH:MM format
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hours}:${minutes}`;
      const todayDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

      const syncKey = `${todayDate}_${currentTime}`;

      // Check if current time matches scheduled time
      if (currentTime === scheduleState.time && lastSyncedKeyRef.current !== syncKey) {
        lastSyncedKeyRef.current = syncKey;
        isSyncingRef.current = true;

        console.log(`[Auto-Sync Localhost] ⏰ Waktu ${currentTime} WIB tercapai! Memulai sinkronisasi otomatis seluruh mesin ke Google Sheets...`);

        try {
          const res = await fetch("/api/cron/sync-monthly-machine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const data = await res.json();
          console.log("[Auto-Sync Localhost] ✅ Hasil Auto-Sync:", data);

          setNotification({
            message: data.message || `Sinkronisasi otomatis seluruh mesin berhasil pada pukul ${currentTime} WIB.`,
            time: currentTime,
          });

          setTimeout(() => setNotification(null), 10000);
        } catch (err: any) {
          console.error("[Auto-Sync Localhost Error]:", err);
        } finally {
          isSyncingRef.current = false;
        }
      }
    }, 5000);

    return () => clearInterval(heartbeatInterval);
  }, [scheduleState]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3.5 bg-slate-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-amber-500/50 backdrop-blur-md animate-bounce max-w-md">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
        <Zap className="w-5 h-5 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5" />
          <span>Auto-Sync Otomatis Berjalan ({notification.time} WIB)</span>
        </div>
        <p className="text-xs font-medium text-slate-200 mt-0.5 leading-relaxed break-words">
          {notification.message}
        </p>
      </div>
    </div>
  );
}
