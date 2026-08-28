import { NextResponse } from "next/server";
import { 
  getDailyInspectMendingScheduleSettings, 
  syncAllDailyInspectMending 
} from "@/actions/google-sheet-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 menit timeout untuk Vercel / serverless

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  try {
    const schedule = await getDailyInspectMendingScheduleSettings();

    if (!schedule.enabled) {
      return NextResponse.json({
        success: false,
        message: "Auto-sync Laporan Harian Inspect & Mending sedang dinonaktifkan dalam konfigurasi.",
      });
    }

    const result = await syncAllDailyInspectMending();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      appendedCount: result.appendedCount,
      updatedCount: result.updatedCount,
      total: result.total,
    });
  } catch (err: any) {
    console.error("[Cron Sync Daily Inspect Mending Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Terjadi kesalahan internal saat auto-sync inspect & mending.",
      },
      { status: 500 }
    );
  }
}
