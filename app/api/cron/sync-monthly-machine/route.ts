import { NextResponse, NextRequest } from "next/server";
import { syncAllMonthlyMachines, getAutoSyncScheduleSettings } from "@/actions/google-sheet-actions";

/**
 * CRON ENDPOINT: Otomatis Sinkronisasi Seluruh Mesin ke Google Sheets
 * ============================================================================================
 * Endpoint ini membaca jadwal dan status aktif dari konfigurasi database.
 * Dapat dipanggil oleh Vercel Cron, Google Apps Script Time Trigger, atau scheduler eksternal.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");
    const safeModeParam = searchParams.get("safeMode");
    const startDayParam = searchParams.get("startDay");
    const endDayParam = searchParams.get("endDay");
    const forceParam = searchParams.get("force");

    // 1. Ambil pengaturan dari Database
    const scheduleSettings = await getAutoSyncScheduleSettings();

    // Jika auto-sync dinonaktifkan dan bukan force run
    if (!scheduleSettings.enabled && forceParam !== "true") {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Auto-Sync harian dinonaktifkan di halaman Admin Integrasi Google Sheets.",
        timestamp: new Date().toISOString(),
      });
    }

    const month = monthParam ? parseInt(monthParam, 10) : undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const safeMode = safeModeParam !== null 
      ? safeModeParam !== "false" 
      : scheduleSettings.safeMode;
    const startDay = startDayParam ? parseInt(startDayParam, 10) : undefined;
    const endDay = endDayParam ? parseInt(endDayParam, 10) : undefined;

    const startTime = Date.now();
    const result = await syncAllMonthlyMachines({
      month,
      year,
      safeMode,
      startDay,
      endDay,
    });
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      durationMs,
      scheduleTime: scheduleSettings.time,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/cron/sync-monthly-machine:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error during auto-sync",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
