import { NextResponse } from "next/server";
import { 
  getPotongKainScheduleSettings, 
  syncAllPotongKainMachines 
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
    const schedule = await getPotongKainScheduleSettings();

    if (!schedule.enabled) {
      return NextResponse.json({
        success: false,
        message: "Auto-sync Laporan Potong Kain sedang dinonaktifkan dalam konfigurasi.",
      });
    }

    const currentYear = new Date().getFullYear().toString();
    const result = await syncAllPotongKainMachines(currentYear, schedule.safeMode);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      results: result.results,
    });
  } catch (err: any) {
    console.error("[Cron Sync Potong Kain Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Terjadi kesalahan internal saat auto-sync potong kain.",
      },
      { status: 500 }
    );
  }
}
