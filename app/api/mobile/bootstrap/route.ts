import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { REGISTERED_MACHINES, DEFAULT_PROBLEM_DETAILS, PROBLEM_CATEGORIES } from "@/lib/constants";
import { getMachineConfigs } from "@/actions/machine-config-actions";
import { getOperatorsList } from "@/actions/operator-actions";
import { getShiftName, getShiftDate, getJakartaDateTimeString } from "@/lib/shift-utils";

export const dynamic = "force-dynamic";

const FALLBACK_DESIGNS = [
  { id: "1", name: "TCD 5826 XA" },
  { id: "2", name: "DL 5675 CO" },
  { id: "3", name: "DL 5167 CO" },
  { id: "4", name: "DL 5169 CO" },
  { id: "5", name: "DL 6460 CR" },
  { id: "6", name: "DL 5162 CO" },
  { id: "7", name: "DL 5168 CO" },
];

export async function GET(req: NextRequest) {
  try {
    const supabase = await createAdminClient();
    const now = new Date();
    const serverTimeWib = getJakartaDateTimeString(now);
    const activeShift = getShiftName(now); // e.g. "Shift 1"
    const shiftNumber = activeShift.replace("Shift ", ""); // "1", "2", "3"
    const activeDate = getShiftDate(now);

    // 1. Ambil config mesin (Panel vs Meteran & Default PCS)
    const configsRes = await getMachineConfigs();
    const configs = configsRes.success ? configsRes.data : [];
    const configMap = new Map(configs.map((c) => [c.nomor_mc.toUpperCase().trim(), c]));

    // 2. Ambil master operator & master design
    let operators: any[] = [];
    try {
      const opsRes = await getOperatorsList();
      if (opsRes.success && opsRes.data) {
        operators = opsRes.data.map((o) => ({
          id: String(o.id),
          name: o.nama_operator,
          shift: o.shift,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch operators for bootstrap:", e);
    }

    // 3. Ambil data status terakhir per mesin
    const machineSnapshots: Record<string, any> = {};

    await Promise.all(
      REGISTERED_MACHINES.map(async (nomorMc) => {
        const mcClean = nomorMc.trim();
        const mcUpper = mcClean.toUpperCase();
        const cfg = configMap.get(mcUpper);
        const inputType = cfg?.input_type || (["R11", "R12", "R16"].includes(mcUpper) ? "METER" : "PANEL");
        const defaultPcs = cfg?.default_pcs || 1;

        // Ambil baris header terbaru dari mesin ini (termasuk spesifikasi dan riwayat potongan)
        const { data: latestRows } = await supabase
          .from("production_headers")
          .select("potongan_ke, panel_no, is_bs, jenis_laporan, detail_masalah, design_id, meter_awal, meter_akhir, tanggal_jam, operator_id, group_id, status_matching, rpm, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, pcs")
          .eq("nomor_mc", mcClean)
          .not("design_id", "is", null)
          .neq("design_id", "")
          .neq("panel_no", "Downtime Mekanik (Direct)")
          .neq("panel_no", "BERHENTI")
          .order("tanggal_jam", { ascending: false })
          .limit(15);

        const latestRow = latestRows && latestRows.length > 0 ? latestRows[0] : null;
        const potonganKe = latestRow?.potongan_ke ? Number(latestRow.potongan_ke) : 1;
        const designId = latestRow?.design_id ? String(latestRow.design_id) : "1";

        const recentPlans: any[] = [];
        const seenPlans = new Set();
        if (latestRows) {
          for (const r of latestRows) {
            const key = `${r.potongan_ke}-${r.design_id}`;
            if (!seenPlans.has(key)) {
              seenPlans.add(key);
              recentPlans.push({
                id: key,
                potongan_ke: r.potongan_ke,
                design_id: r.design_id,
                no_order_barang: r.no_order_barang,
                rpm: r.rpm,
                pick: r.pick,
                course: r.course,
                no_customer: r.no_customer,
                jenis_benang_dasar: r.jenis_benang_dasar,
                liner: r.liner,
                heavy: r.heavy,
                shadow: r.shadow,
                pinggiran: r.pinggiran,
                status_matching: r.status_matching,
                pcs: r.pcs,
              });
            }
          }
        }

        let nextPanelNo = 1;
        let lastMeter = 0;
        let recentItems: any[] = [];

        if (inputType === "PANEL") {
          // Cari panel terakhir di potongan aktif ini
          const { data: cutPanels } = await supabase
            .from("production_headers")
            .select("panel_no, is_bs, jenis_laporan, detail_masalah, tanggal_jam, operator_id")
            .eq("nomor_mc", mcClean)
            .eq("potongan_ke", potonganKe)
            .not("panel_no", "is", null)
            .neq("panel_no", "METERAN")
            .neq("panel_no", "Downtime Mekanik (Direct)")
            .neq("panel_no", "BERHENTI")
            .order("tanggal_jam", { ascending: false })
            .limit(25);

          if (cutPanels && cutPanels.length > 0) {
            let maxPanel = 0;
            for (const p of cutPanels) {
              const pStr = String(p.panel_no || "").trim();
              if (pStr && !pStr.includes("BS") && !pStr.includes("GAGAL")) {
                const match = pStr.match(/\d+$/);
                const n = match ? parseInt(match[0], 10) : parseInt(pStr, 10);
                if (!isNaN(n) && n > maxPanel) maxPanel = n;
              }
            }
            nextPanelNo = maxPanel > 0 ? maxPanel + 1 : 1;
            recentItems = cutPanels.map((p) => ({
              panelNo: p.panel_no,
              isBs: Boolean(p.is_bs),
              jenisLaporan: p.jenis_laporan || (p.is_bs ? "BS" : "NORMAL"),
              detailMasalah: p.detail_masalah || null,
              tanggalJam: p.tanggal_jam,
            }));
          }
        } else {
          // Meteran (Continuous)
          const { data: meterRows } = await supabase
            .from("production_headers")
            .select("meter_awal, meter_akhir, detail_masalah, tanggal_jam, potongan_ke")
            .eq("nomor_mc", mcClean)
            .eq("potongan_ke", potonganKe)
            .not("meter_akhir", "is", null)
            .order("tanggal_jam", { ascending: false })
            .limit(20);

          if (meterRows && meterRows.length > 0) {
            const firstValid = meterRows.find((m) => m.meter_akhir && Number(m.meter_akhir) > 0);
            if (firstValid) {
              lastMeter = Number(firstValid.meter_akhir);
            }
            recentItems = meterRows.map((m) => ({
              meterAwal: m.meter_awal,
              meterAkhir: m.meter_akhir,
              detailMasalah: m.detail_masalah,
              tanggalJam: m.tanggal_jam,
            }));
          }
        }

        machineSnapshots[mcClean] = {
          nomorMc: mcClean,
          inputType,
          defaultPcs,
          potonganKe,
          designId,
          rpm: latestRow?.rpm ? String(latestRow.rpm) : "",
          pick: latestRow?.pick ? String(latestRow.pick) : "",
          course: latestRow?.course ? String(latestRow.course) : "",
          noOrderBarang: latestRow?.no_order_barang ? String(latestRow.no_order_barang) : "",
          noCustomer: latestRow?.no_customer ? String(latestRow.no_customer) : "",
          jenisBenangDasar: latestRow?.jenis_benang_dasar ? String(latestRow.jenis_benang_dasar) : "",
          liner: latestRow?.liner ? String(latestRow.liner) : "",
          heavy: latestRow?.heavy ? String(latestRow.heavy) : "",
          shadow: latestRow?.shadow ? String(latestRow.shadow) : "",
          pinggiran: latestRow?.pinggiran ? String(latestRow.pinggiran) : "",
          statusMatching: latestRow?.status_matching || "OK",
          nextPanelNo,
          lastMeter,
          recentItems,
          recentPlans,
        };
      })
    );

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      serverTimeWib,
      shiftInfo: {
        activeDate,
        activeShift,
        shiftNumber,
      },
      snapshots: machineSnapshots,
      machines: REGISTERED_MACHINES.map((mc) => machineSnapshots[mc] || {
        nomorMc: mc,
        inputType: ["R11", "R12", "R16"].includes(mc.toUpperCase()) ? "METER" : "PANEL",
        defaultPcs: 1,
        potonganKe: 1,
        designId: "1",
        nextPanelNo: 1,
        lastMeter: 0,
        recentItems: [],
      }),
      operators: operators.length > 0 ? operators : [
        { id: "1", name: "Rohmat", shift: "A" },
        { id: "2", name: "M.Alwi", shift: "A" },
        { id: "12", name: "Irfan", shift: "B" },
        { id: "23", name: "Tubagus", shift: "C" },
      ],
      designs: FALLBACK_DESIGNS,
      problemCategories: PROBLEM_CATEGORIES,
      problemDetails: DEFAULT_PROBLEM_DETAILS,
    });
  } catch (error: any) {
    console.error("Error in /api/mobile/bootstrap:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate bootstrap data" },
      { status: 500 }
    );
  }
}
