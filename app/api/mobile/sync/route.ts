import { NextRequest, NextResponse } from "next/server";
import { createProductionReport } from "@/actions/employee-actions";
import { submitContinuousReport } from "@/actions/continuous-actions";
import { submitQCInspection } from "@/actions/qc-actions";
import { submitStatusMesin } from "@/actions/status-actions";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No items to sync",
          succeeded: [],
          failed: [],
        },
        { headers: corsHeaders }
      );
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    const seenBatchKeys = new Set<string>();

    for (const item of items) {
      const itemId = item.id || String(Date.now());
      try {
        const payloadData = (item.data && typeof item.data === "object") ? { ...item.data } : { ...item };

        // 1. Pertahankan submittedAt asli
        if (!payloadData.submittedAt && item.timestamp) {
          payloadData.submittedAt = item.timestamp;
        }

        // 2. Normalisasi field identitas jika berada di root wrapper payload
        if (!payloadData.nomorMc && item.nomorMc) {
          payloadData.nomorMc = item.nomorMc;
        }
        if (!payloadData.potonganKe && item.potonganKe) {
          payloadData.potonganKe = String(item.potonganKe);
        }
        if (!payloadData.operatorId && item.operatorId) {
          payloadData.operatorId = String(item.operatorId);
        }
        if (!payloadData.groupId && item.groupId) {
          payloadData.groupId = String(item.groupId);
        }
        if (!payloadData.designId && item.designId) {
          payloadData.designId = String(item.designId);
        }
        if (!payloadData.statusMatching && item.statusMatching) {
          payloadData.statusMatching = item.statusMatching;
        } else if (!payloadData.statusMatching) {
          payloadData.statusMatching = "OK";
        }

        // 3. Normalisasi field operator backup (operatorBackup vs backupOperator)
        const backupVal = payloadData.operatorBackup || payloadData.backupOperator || item.operatorBackup || item.backupOperator || null;
        if (backupVal) {
          payloadData.operatorBackup = backupVal;
          payloadData.backupOperator = backupVal;
        }

        // 4. Deteksi tipe laporan & normalisasi panelNo
        const detectedType = item.type || (
          item.inputType === "METER" ||
          (payloadData.nomorMc && (["R11", "R12", "R13", "R16"].includes(String(payloadData.nomorMc).toUpperCase()) || String(payloadData.nomorMc).toUpperCase().startsWith("T")))
            ? "continuous"
            : "employee"
        );

        if (detectedType === "employee") {
          if (!payloadData.panelNo && item.panelNo) {
            payloadData.panelNo = String(item.panelNo);
          } else if (!payloadData.panelNo && !payloadData.tanggalPotong) {
            payloadData.panelNo = "1";
          }
        }

        // Deduplikasi item redundan di dalam batch sync yang sama untuk mencegah duplikasi panel
        if (detectedType === "employee" && !payloadData.isPanelGagal && !payloadData.tanggalPotong && payloadData.panelNo && payloadData.nomorMc && payloadData.potonganKe) {
          const batchKey = `${String(payloadData.nomorMc).toUpperCase()}_${payloadData.potonganKe}_${payloadData.panelNo}_${payloadData.operatorId || "all"}`;
          if (seenBatchKeys.has(batchKey)) {
            console.log(`[SYNC BATCH DEDUP] Skipping redundant item ${itemId} for panel ${batchKey}`);
            succeeded.push(itemId);
            continue;
          }
          seenBatchKeys.add(batchKey);
        }

        // 5. Normalisasi pcsKe jika dikirim sebagai array oleh antrean lokal
        if (Array.isArray(payloadData.downtimeEvents)) {
          payloadData.downtimeEvents = payloadData.downtimeEvents.map((evt: any) => {
            const normPcs = Array.isArray(evt.pcsKe)
              ? (evt.pcsKe.length === 0 ? "Semua" : evt.pcsKe.join(", "))
              : String(evt.pcsKe || "Semua");
            return {
              ...evt,
              durasiDetik: typeof evt.durasiDetik === "number" ? evt.durasiDetik : (typeof evt.duration === "number" ? evt.duration : (parseInt(evt.durasiDetik || evt.duration, 10) || 0)),
              pcsKe: normPcs,
              problems: Array.isArray(evt.problems)
                ? evt.problems.map((p: any) => ({
                    ...p,
                    pcsKe: Array.isArray(p.pcsKe)
                      ? (p.pcsKe.length === 0 ? "Semua" : p.pcsKe.join(", "))
                      : String(p.pcsKe || normPcs),
                  }))
                : evt.problems,
            };
          });
        }

        // 6. Pastikan pcsData minimal ada 1 record jika bukan potong kain
        if (!Array.isArray(payloadData.pcsData) || payloadData.pcsData.length === 0) {
          if (!payloadData.tanggalPotong) {
            payloadData.pcsData = [
              {
                pcsIndex: "1",
                jmlHasilProduksi: payloadData.isPanelGagal ? "0" : "1",
                meterKain: payloadData.meterAkhir ? String(payloadData.meterAkhir) : null,
                isBs: Boolean(payloadData.isPanelGagal),
              },
            ];
          }
        }

        let res: any = { success: false, error: "" };
        if (detectedType === "employee") {
          res = await createProductionReport(payloadData);
        } else if (detectedType === "continuous") {
          const mcUpper = String(payloadData.nomorMc || "").toUpperCase();
          const rawEnd = payloadData.meterAkhir !== null && payloadData.meterAkhir !== undefined ? String(payloadData.meterAkhir).trim() : "";
          if (mcUpper !== "T2A" && (rawEnd === "0" || rawEnd === "0m")) {
            payloadData.meterAkhir = null;
            payloadData.meterAwal = null;
            payloadData.hasilProduksiMeter = null;
            if (Array.isArray(payloadData.pcsData)) {
              payloadData.pcsData.forEach((p: any) => {
                p.meterKain = null;
              });
            }
          }
          res = await submitContinuousReport(payloadData);
        } else if (detectedType === "qc") {
          res = await submitQCInspection(payloadData);
        } else if (detectedType === "status") {
          res = await submitStatusMesin(payloadData);
        } else {
          res = await createProductionReport(payloadData);
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

    return NextResponse.json(
      {
        success: true,
        processed: items.length,
        succeeded,
        failed,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error in /api/mobile/sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process mobile sync" },
      { status: 500, headers: corsHeaders }
    );
  }
}
