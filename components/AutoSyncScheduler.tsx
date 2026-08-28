"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Zap, CheckCircle2 } from "lucide-react";

export default function AutoSyncScheduler() {
  const [notification, setNotification] = useState<{ message: string; time: string; count?: number } | null>(null);
  const [monthlyScheduleState, setMonthlyScheduleState] = useState<{ time: string; enabled: boolean; safeMode: boolean } | null>(null);
  const [potongScheduleState, setPotongScheduleState] = useState<{ time: string; enabled: boolean; safeMode: boolean } | null>(null);
  const [dailyScheduleState, setDailyScheduleState] = useState<{ time: string; enabled: boolean } | null>(null);
  const isSyncingRef = useRef(false);
  const lastSyncedKeyRef = useRef<string>("");

  // 1. Fetch schedule config on mount and every 30 seconds
  const fetchConfigs = async () => {
    try {
      // Monthly Machine Schedule
      const resMonthly = await fetch("/api/sync/schedule-info", { cache: "no-store" });
      if (resMonthly.ok) {
        const json = await resMonthly.json();
        if (json && json.success) {
          setMonthlyScheduleState({
            time: (json.time || "09:00").trim(),
            enabled: json.enabled !== false,
            safeMode: json.safeMode !== false,
          });
        }
      }

      // Potong Kain Schedule
      const resPotong = await fetch("/api/sync/potong-kain-schedule-info", { cache: "no-store" });
      if (resPotong.ok) {
        const json = await resPotong.json();
        if (json && json.success) {
          setPotongScheduleState({
            time: (json.time || "17:00").trim(),
            enabled: json.enabled !== false,
            safeMode: json.safeMode !== false,
          });
        }
      }

      // Daily Inspect & Mending Schedule
      const resDaily = await fetch("/api/sync/daily-inspect-mending-schedule-info", { cache: "no-store" });
      if (resDaily.ok) {
        const json = await resDaily.json();
        if (json && json.success) {
          setDailyScheduleState({
            time: (json.time || "17:30").trim(),
            enabled: json.enabled !== false,
          });
        }
      }
    } catch (e) {
      console.warn("[Auto-Sync Scheduler] Config fetch warning:", e);
    }
  };

  useEffect(() => {
    fetchConfigs();
    const configInterval = setInterval(fetchConfigs, 30000);
    return () => clearInterval(configInterval);
  }, []);

  // 2. Heartbeat check every 5 seconds
  useEffect(() => {
    const heartbeatInterval = setInterval(async () => {
      if (isSyncingRef.current) return;

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hours}:${minutes}`;
      const todayDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

      // Check Monthly Machine Schedule
      if (monthlyScheduleState?.enabled && monthlyScheduleState.time === currentTime) {
        const syncKeyMonthly = `monthly_${todayDate}_${currentTime}`;
        if (lastSyncedKeyRef.current !== syncKeyMonthly) {
          lastSyncedKeyRef.current = syncKeyMonthly;
          isSyncingRef.current = true;

          console.log(`[Auto-Sync Localhost] ⏰ [Laporan Bulanan] Waktu ${currentTime} WIB tercapai! Memulai sinkronisasi...`);
          try {
            const res = await fetch("/api/cron/sync-monthly-machine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            setNotification({
              message: data.message || `Laporan Bulanan Mesin berhasil disinkronkan (${currentTime} WIB).`,
              time: currentTime,
            });
            setTimeout(() => setNotification(null), 10000);
          } catch (err) {
            console.error("[Auto-Sync Monthly Error]:", err);
          } finally {
            isSyncingRef.current = false;
          }
          return;
        }
      }

      // Check Potong Kain Schedule
      if (potongScheduleState?.enabled && potongScheduleState.time === currentTime) {
        const syncKeyPotong = `potong_${todayDate}_${currentTime}`;
        if (lastSyncedKeyRef.current !== syncKeyPotong) {
          lastSyncedKeyRef.current = syncKeyPotong;
          isSyncingRef.current = true;

          console.log(`[Auto-Sync Localhost] ⏰ [Potong Kain] Waktu ${currentTime} WIB tercapai! Memulai sinkronisasi...`);
          try {
            const res = await fetch("/api/cron/sync-potong-kain", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            setNotification({
              message: data.message || `Laporan Potong Kain berhasil disinkronkan (${currentTime} WIB).`,
              time: currentTime,
            });
            setTimeout(() => setNotification(null), 10000);
          } catch (err) {
            console.error("[Auto-Sync Potong Kain Error]:", err);
          } finally {
            isSyncingRef.current = false;
          }
          return;
        }
      }

      // Check Daily Inspect & Mending Schedule
      if (dailyScheduleState?.enabled && dailyScheduleState.time === currentTime) {
        const syncKeyDaily = `daily_${todayDate}_${currentTime}`;
        if (lastSyncedKeyRef.current !== syncKeyDaily) {
          lastSyncedKeyRef.current = syncKeyDaily;
          isSyncingRef.current = true;

          console.log(`[Auto-Sync Localhost] ⏰ [Inspect & Mending] Waktu ${currentTime} WIB tercapai! Memulai sinkronisasi...`);
          try {
            const res = await fetch("/api/cron/sync-daily-inspect-mending", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            setNotification({
              message: data.message || `Laporan Harian Inspect & Mending berhasil disinkronkan (${currentTime} WIB).`,
              time: currentTime,
            });
            setTimeout(() => setNotification(null), 10000);
          } catch (err) {
            console.error("[Auto-Sync Daily Inspect Mending Error]:", err);
          } finally {
            isSyncingRef.current = false;
          }
          return;
        }
      }
    }, 5000);

    return () => clearInterval(heartbeatInterval);
  }, [monthlyScheduleState, potongScheduleState, dailyScheduleState]);

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
