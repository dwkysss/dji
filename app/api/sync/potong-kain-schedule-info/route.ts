import { NextResponse } from "next/server";
import { getPotongKainScheduleSettings } from "@/actions/google-sheet-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getPotongKainScheduleSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch potong kain schedule settings" },
      { status: 500 }
    );
  }
}
