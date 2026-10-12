/**
 * Internal Background Scheduler untuk DJI Factory
 * ============================================================================================
 * Menjalankan sinkronisasi otomatis Google Sheets terjadwal langsung dari server Node.js (VPS),
 * sehingga berjalan 100% otomatis tanpa memerlukan browser dibuka atau konfigurasi crontab Linux manual.
 * Menggunakan zona waktu resmi pabrik: Asia/Jakarta (WIB).
 */

import {
  syncAllMonthlyMachines,
  getAutoSyncScheduleSettings,
  syncAllPotongKainMachines,
  getPotongKainScheduleSettings,
  syncAllDailyInspectMending,
  getDailyInspectMendingScheduleSettings,
} from "@/actions/google-sheet-actions";

declare global {
  // eslint-disable-next-line no-var
  var __dji_server_scheduler_started: boolean | undefined;
  // eslint-disable-next-line no-var
  var __dji_scheduler_cache_invalidate: (() => void) | undefined;
}

interface CachedItem<T> {
  data: T;
  cachedAt: number;
}

// In-Memory Cache dengan TTL 10 menit untuk memangkas >95% query berulang ke database
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedMonthly: CachedItem<Awaited<ReturnType<typeof getAutoSyncScheduleSettings>>> | null = null;
let cachedPotong: CachedItem<Awaited<ReturnType<typeof getPotongKainScheduleSettings>>> | null = null;
let cachedDaily: CachedItem<Awaited<ReturnType<typeof getDailyInspectMendingScheduleSettings>>> | null = null;

export function invalidateServerSchedulerCache() {
  cachedMonthly = null;
  cachedPotong = null;
  cachedDaily = null;
}

// Simpan fungsi invalidasi di globalThis agar bisa dipanggil saat form setting disimpan
globalThis.__dji_scheduler_cache_invalidate = invalidateServerSchedulerCache;

async function getCachedMonthlySettings() {
  const now = Date.now();
  if (!cachedMonthly || now - cachedMonthly.cachedAt > CACHE_TTL_MS) {
    const data = await getAutoSyncScheduleSettings();
    cachedMonthly = { data, cachedAt: now };
  }
  return cachedMonthly.data;
}

async function getCachedPotongSettings() {
  const now = Date.now();
  if (!cachedPotong || now - cachedPotong.cachedAt > CACHE_TTL_MS) {
    const data = await getPotongKainScheduleSettings();
    cachedPotong = { data, cachedAt: now };
  }
  return cachedPotong.data;
}

async function getCachedDailySettings() {
  const now = Date.now();
  if (!cachedDaily || now - cachedDaily.cachedAt > CACHE_TTL_MS) {
    const data = await getDailyInspectMendingScheduleSettings();
    cachedDaily = { data, cachedAt: now };
  }
  return cachedDaily.data;
}

const lastSyncedKeys = {
  monthly: "",
  potong: "",
  daily: "",
};

let isSyncing = false;

export function initServerScheduler() {
  if (globalThis.__dji_server_scheduler_started) {
    return;
  }
  globalThis.__dji_server_scheduler_started = true;

  console.log(
    "[Server Scheduler] 🚀 Internal Background Scheduler aktif di VPS (Zona Waktu: Asia/Jakarta WIB, In-Memory Cache: 10 menit)."
  );

  // Jalankan pengecekan setiap 30 detik agar tidak pernah melewatkan jendela 1 menit jadwal
  const interval = setInterval(async () => {
    if (isSyncing) return;

    try {
      const now = new Date();
      // Format WIB (Asia/Jakarta)
      const currentTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const todayDate = now.toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });

      // 1. Sinkronisasi Laporan Bulanan Mesin (Default 09:00 WIB atau sesuai DB)
      try {
        const monthlySettings = await getCachedMonthlySettings();
        const targetMonthly = (monthlySettings.time || "09:00").trim();
        const monthlyKey = `monthly_${todayDate}_${targetMonthly}`;

        if (
          monthlySettings.enabled &&
          currentTime === targetMonthly &&
          lastSyncedKeys.monthly !== monthlyKey
        ) {
          lastSyncedKeys.monthly = monthlyKey;
          isSyncing = true;
          console.log(
            `[Server Scheduler] ⏰ [${currentTime} WIB] Menjalankan Sinkronisasi Laporan Bulanan Mesin ke Google Sheets...`
          );

          const res = await syncAllMonthlyMachines({
            safeMode: monthlySettings.safeMode,
            machines: monthlySettings.machines,
          });

          console.log(
            `[Server Scheduler] ✅ [Laporan Bulanan Mesin] Selesai: ${
              res.message || (res.success ? "Sukses" : "Gagal")
            }`
          );
          isSyncing = false;
        }
      } catch (errMonthly) {
        isSyncing = false;
        console.error(
          "[Server Scheduler] ❌ Gagal eksekusi sync bulanan mesin:",
          errMonthly
        );
      }

      // 2. Sinkronisasi Laporan Potong Kain (Default 17:00 WIB atau sesuai DB)
      try {
        const potongSettings = await getCachedPotongSettings();
        const targetPotong = (potongSettings.time || "17:00").trim();
        const potongKey = `potong_${todayDate}_${targetPotong}`;

        if (
          potongSettings.enabled &&
          currentTime === targetPotong &&
          lastSyncedKeys.potong !== potongKey
        ) {
          lastSyncedKeys.potong = potongKey;
          isSyncing = true;
          console.log(
            `[Server Scheduler] ⏰ [${currentTime} WIB] Menjalankan Sinkronisasi Laporan Potong Kain ke Google Sheets...`
          );

          const currentYear = new Date().getFullYear().toString();
          const res = await syncAllPotongKainMachines(
            currentYear,
            potongSettings.safeMode
          );

          console.log(
            `[Server Scheduler] ✅ [Laporan Potong Kain] Selesai: ${
              res.message || (res.success ? "Sukses" : "Gagal")
            }`
          );
          isSyncing = false;
        }
      } catch (errPotong) {
        isSyncing = false;
        console.error(
          "[Server Scheduler] ❌ Gagal eksekusi sync potong kain:",
          errPotong
        );
      }

      // 3. Sinkronisasi Laporan Harian Inspect & Mending (Default 17:30 WIB atau sesuai DB)
      try {
        const dailySettings = await getCachedDailySettings();
        const targetDaily = (dailySettings.time || "17:30").trim();
        const dailyKey = `daily_${todayDate}_${targetDaily}`;

        if (
          dailySettings.enabled &&
          currentTime === targetDaily &&
          lastSyncedKeys.daily !== dailyKey
        ) {
          lastSyncedKeys.daily = dailyKey;
          isSyncing = true;
          console.log(
            `[Server Scheduler] ⏰ [${currentTime} WIB] Menjalankan Sinkronisasi Laporan Harian Inspect & Mending ke Google Sheets...`
          );

          const res = await syncAllDailyInspectMending();

          console.log(
            `[Server Scheduler] ✅ [Inspect & Mending] Selesai: ${
              res.message || (res.success ? "Sukses" : "Gagal")
            }`
          );
          isSyncing = false;
        }
      } catch (errDaily) {
        isSyncing = false;
        console.error(
          "[Server Scheduler] ❌ Gagal eksekusi sync inspect & mending:",
          errDaily
        );
      }
    } catch (globalErr) {
      isSyncing = false;
      console.error(
        "[Server Scheduler] ❌ Error pada heartbeat interval scheduler:",
        globalErr
      );
    }
  }, 30_000);

  // Pastikan timer tidak menahan proses exit jika Node.js shutdown
  if (typeof interval.unref === "function") {
    interval.unref();
  }
}
