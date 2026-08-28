import { NextResponse } from "next/server";
import { getDailyInspectMendingScheduleSettings } from "@/actions/google-sheet-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getDailyInspectMendingScheduleSettings();
    return NextResponse.json({
      success: true,
      time: settings.time,
      enabled: settings.enabled,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
