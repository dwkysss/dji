import { NextRequest, NextResponse } from "next/server";
import { createProductionReport } from "@/actions/employee-actions";
import { submitContinuousReport } from "@/actions/continuous-actions";
import { submitQCInspection } from "@/actions/qc-actions";
import { submitStatusMesin } from "@/actions/status-actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No items to sync",
        succeeded: [],
        failed: [],
      });
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const item of items) {
      const itemId = item.id || String(Date.now());
      try {
        // Pertahankan submittedAt asli
        if (item.data && !item.data.submittedAt && item.timestamp) {
          item.data.submittedAt = item.timestamp;
        }

        let res: any = { success: false, error: "" };
        if (item.type === "employee") {
          res = await createProductionReport(item.data);
        } else if (item.type === "continuous") {
          res = await submitContinuousReport(item.data);
        } else if (item.type === "qc") {
          res = await submitQCInspection(item.data);
        } else if (item.type === "status") {
          res = await submitStatusMesin(item.data);
        } else {
          // Default ke employee form jika tipe tidak spesifik
          res = await createProductionReport(item.data);
        }

        const errStr = String(res?.error || "").toLowerCase();
        const isDuplicate =
          errStr.includes("sudah ada") ||
          errStr.includes("already exists") ||
          errStr.includes("duplicate") ||
          errStr.includes("duplikat");

        if (res?.success || isDuplicate) {
          succeeded.push(itemId);
        } else {
          failed.push({ id: itemId, error: res?.error || "Gagal menyimpan data" });
        }
      } catch (err: any) {
        failed.push({ id: itemId, error: err.message || "Exception processing payload" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: items.length,
      succeeded,
      failed,
    });
  } catch (error: any) {
    console.error("Error in /api/mobile/sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process mobile sync" },
      { status: 500 }
    );
  }
}
