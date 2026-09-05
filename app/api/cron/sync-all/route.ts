import { NextResponse, NextRequest } from "next/server";
import { 
  syncAllMonthlyMachines, 
  getAutoSyncScheduleSettings,
  syncAllPotongKainMachines,
  getPotongKainScheduleSettings,
  syncAllDailyInspectMending,
  getDailyInspectMendingScheduleSettings
} from "@/actions/google-sheet-actions";

/**
 * MASTER CRON ENDPOINT: Sinkronisasi Semua Laporan ke Google Sheets Sekaligus
 * ============================================================================================
 * Solusi optimal untuk akun Vercel Hobby (Free Tier) yang dibatasi maksimal 1 Cron Job per project.
 * Endpoint ini menjalankan 3 sinkronisasi utama secara berurutan:
 * 1. Rekap Efisiensi Bulanan Seluruh Mesin (monthly_machine)
 * 2. Laporan Potong Kain Seluruh Mesin (potong_kain)
 * 3. Laporan Harian Inspect & Mending Gabungan (daily_inspect_mending)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 menit timeout untuk Vercel Serverless

export async function GET(request: NextRequest) {
  return handleSyncAll(request);
}

export async function POST(request: NextRequest) {
  return handleSyncAll(request);
}

async function handleSyncAll(request: NextRequest) {
  const overallStartTime = Date.now();
  const { searchParams } = new URL(request.url);
  const forceParam = searchParams.get("force") === "true";
  const skipMonthly = searchParams.get("monthly") === "false";
  const skipPotong = searchParams.get("potong") === "false";
  const skipDaily = searchParams.get("daily") === "false";

  const executionResults: {
    monthlyMachine?: any;
    potongKain?: any;
    dailyInspectMending?: any;
  } = {};

  let hasError = false;

  // 1. SINKRONISASI LAPORAN EFISIENSI BULANAN PER MESIN
  if (!skipMonthly) {
    const monthlyStart = Date.now();
    try {
      const scheduleMonthly = await getAutoSyncScheduleSettings();
      if (!scheduleMonthly.enabled && !forceParam) {
        executionResults.monthlyMachine = {
          success: true,
          skipped: true,
          message: "Auto-sync Laporan Bulanan Mesin dinonaktifkan di pengaturan database.",
        };
      } else {
        const resMonthly = await syncAllMonthlyMachines({
          safeMode: scheduleMonthly.safeMode,
          machines: scheduleMonthly.machines,
        });
        executionResults.monthlyMachine = {
          ...resMonthly,
          durationMs: Date.now() - monthlyStart,
        };
        if (!resMonthly.success) hasError = true;
      }
    } catch (err: any) {
      hasError = true;
      executionResults.monthlyMachine = {
        success: false,
        error: err.message || "Gagal sinkronisasi laporan bulanan mesin",
        durationMs: Date.now() - monthlyStart,
      };
    }
  }

  // 2. SINKRONISASI LAPORAN POTONG KAIN
  if (!skipPotong) {
    const potongStart = Date.now();
    try {
      const schedulePotong = await getPotongKainScheduleSettings();
      if (!schedulePotong.enabled && !forceParam) {
        executionResults.potongKain = {
          success: true,
          skipped: true,
          message: "Auto-sync Laporan Potong Kain dinonaktifkan di pengaturan database.",
        };
      } else {
        const currentYear = new Date().getFullYear().toString();
        const resPotong = await syncAllPotongKainMachines(currentYear, schedulePotong.safeMode);
        executionResults.potongKain = {
          ...resPotong,
          durationMs: Date.now() - potongStart,
        };
        if (!resPotong.success) hasError = true;
      }
    } catch (err: any) {
      hasError = true;
      executionResults.potongKain = {
        success: false,
        error: err.message || "Gagal sinkronisasi laporan potong kain",
        durationMs: Date.now() - potongStart,
      };
    }
  }

  // 3. SINKRONISASI LAPORAN HARIAN INSPECT & MENDING GABUNGAN
  if (!skipDaily) {
    const dailyStart = Date.now();
    try {
      const scheduleDaily = await getDailyInspectMendingScheduleSettings();
      if (!scheduleDaily.enabled && !forceParam) {
        executionResults.dailyInspectMending = {
          success: true,
          skipped: true,
          message: "Auto-sync Laporan Harian Inspect & Mending dinonaktifkan di pengaturan database.",
        };
      } else {
        const resDaily = await syncAllDailyInspectMending();
        executionResults.dailyInspectMending = {
          ...resDaily,
          durationMs: Date.now() - dailyStart,
        };
        if (!resDaily.success) hasError = true;
      }
    } catch (err: any) {
      hasError = true;
      executionResults.dailyInspectMending = {
        success: false,
        error: err.message || "Gagal sinkronisasi laporan harian inspect & mending",
        durationMs: Date.now() - dailyStart,
      };
    }
  }

  const totalDurationMs = Date.now() - overallStartTime;

  return NextResponse.json(
    {
      success: !hasError,
      message: hasError 
        ? "Sinkronisasi selesai dengan beberapa peringatan/error."
        : "Seluruh sinkronisasi otomatis Google Sheets selesai dijalankan dengan sukses!",
      totalDurationMs,
      timestamp: new Date().toISOString(),
      results: executionResults,
    },
    { status: hasError ? 207 : 200 }
  );
}
