"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { calculateOverallGradeData } from "@/lib/mending-grade-utils";

export type TrackingStage = "PLANNED" | "IN_PRODUCTION" | "INSPECTED" | "COMPLETED";

export interface PcsTrackingInfo {
  pcs_index: number;
  stage: TrackingStage;
  jumlah_aktual: number | null;
  satuan: "Panel" | "Meter";
  berat_kain: number | null;
  overall_grade: string | null;
  tanggal_produksi: string | null;
  tanggal_qc: string | null;
  tanggal_mending: string | null;
  petugas_qc: string | null;
  mending_grade_a: number | null;
  mending_grade_b: number | null;
  mending_grade_bs: number | null;
  total_detail_produksi: number;
}

export interface PotonganTrackingResult {
  found: boolean;
  nomor_mc: string;
  potongan_ke: number;
  is_meteran: boolean;
  design_id: string;
  no_customer: string;
  no_order_barang: string;
  pcs_count: number;
  target_produksi: number | null;
  satuan: "Panel" | "Meter";
  pick: string | null;
  course: string | null;
  rpm: string | null;
  jenis_benang_dasar: string | null;
  plan_created_at: string | null;
  pcs_list: PcsTrackingInfo[];
  last_updated_at: string;
}

export async function getPotonganTrackingData(
  rawNomorMc: string,
  potonganKe: number
): Promise<{ success: boolean; data?: PotonganTrackingResult; error?: string }> {
  try {
    const nomorMc = decodeURIComponent(rawNomorMc).trim().toUpperCase();
    if (!nomorMc || !Number.isFinite(potonganKe) || potonganKe <= 0) {
      return { success: false, error: "Parameter mesin atau potongan tidak valid." };
    }

    const supabase = await createAdminClient();

    const [planRes, machineCfgRes, maxPanelRes, headersRes, qcRes, mendingRes] = await Promise.all([
      supabase
        .from("production_plans")
        .select("*")
        .ilike("nomor_mc", nomorMc)
        .eq("potongan_ke", potonganKe)
        .maybeSingle(),
      supabase
        .from("machine_configs")
        .select("nomor_mc, default_pcs, input_type")
        .ilike("nomor_mc", nomorMc)
        .maybeSingle(),
      supabase
        .from("max_panel_configs")
        .select("max_panel")
        .ilike("nomor_mc", nomorMc)
        .eq("potongan_ke", potonganKe)
        .maybeSingle(),
      supabase
        .from("production_headers")
        .select(`
          id, nomor_mc, potongan_ke, design_id, no_customer, no_order_barang,
          tgl, panel_no, meter_awal, meter_akhir, pick, course, rpm, jenis_benang_dasar, created_at,
          production_details (
            id, pcs_index, keterangan_cacat, kategori_masalah, detail_masalah,
            jml_hasil_produksi, status_inspeksi, status_mending, is_deleted
          )
        `)
        .ilike("nomor_mc", nomorMc)
        .eq("potongan_ke", potonganKe)
        .order("tgl", { ascending: false }),
      supabase
        .from("qc_inspection_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
          tanggal_inspeksi, petugas_inspeksi, created_at
        `)
        .ilike("nomor_mc", nomorMc)
        .eq("potongan_ke", potonganKe)
        .order("created_at", { ascending: false }),
      supabase
        .from("mending_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id, tanggal_mending,
          total_panel, mending_grade_a, mending_grade_b, mending_grade_bs, created_at,
          items:mending_items (
            id, hasil_mending,
            detail:production_details (
              id, pcs_index, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi,
              header:production_headers ( panel_no, meter_akhir )
            )
          )
        `)
        .ilike("nomor_mc", nomorMc)
        .eq("potongan_ke", potonganKe)
        .order("created_at", { ascending: false }),
    ]);

    const plan = planRes.data || null;
    const machineCfg = machineCfgRes.data || null;
    const maxPanelCfg = maxPanelRes.data || null;
    const headers: any[] = headersRes.data || [];
    const qcBatches: any[] = qcRes.data || [];
    const mendingBatches: any[] = mendingRes.data || [];

    const hasAnyData =
      Boolean(plan) || headers.length > 0 || qcBatches.length > 0 || mendingBatches.length > 0;

    if (!hasAnyData) {
      return {
        success: true,
        data: {
          found: false,
          nomor_mc: nomorMc,
          potongan_ke: potonganKe,
          is_meteran: false,
          design_id: "-",
          no_customer: "-",
          no_order_barang: "-",
          pcs_count: 1,
          target_produksi: null,
          satuan: "Panel",
          pick: null,
          course: null,
          rpm: null,
          jenis_benang_dasar: null,
          plan_created_at: null,
          pcs_list: [],
          last_updated_at: new Date().toISOString(),
        },
      };
    }

    const firstHeader = headers[0] || null;

    const isMeteran =
      machineCfg?.input_type === "METER" ||
      firstHeader?.panel_no === "METERAN" ||
      nomorMc.startsWith("R11") ||
      nomorMc.startsWith("R12") ||
      nomorMc.startsWith("R16") ||
      nomorMc.startsWith("T");

    const satuan: "Panel" | "Meter" = isMeteran ? "Meter" : "Panel";

    // Determine PCS count from plan, machine config, or actual data
    const discoveredPcsIndices = new Set<number>();
    headers.forEach((h) => {
      (h.production_details || []).forEach((d: any) => {
        if (!d.is_deleted) discoveredPcsIndices.add(Number(d.pcs_index) || 1);
      });
    });
    qcBatches.forEach((q) => discoveredPcsIndices.add(Number(q.pcs_index) || 1));
    mendingBatches.forEach((m) => discoveredPcsIndices.add(Number(m.pcs_index) || 1));

    const maxDiscoveredPcs = discoveredPcsIndices.size > 0 ? Math.max(...Array.from(discoveredPcsIndices)) : 1;
    const pcsCount = Math.max(
      Number(plan?.pcs_count) || 1,
      Number(machineCfg?.default_pcs) || 1,
      maxDiscoveredPcs
    );

    const targetProduksi = isMeteran
      ? (Number(plan?.target_meter) || null)
      : (Number(maxPanelCfg?.max_panel) || Number(plan?.max_panel) || Number(plan?.target_panel) || null);

    // Build per-PCS tracking info
    const pcsList: PcsTrackingInfo[] = [];

    for (let pcsIdx = 1; pcsIdx <= pcsCount; pcsIdx++) {
      // 1. Production details for this PCS
      const pcsDetails: any[] = [];
      let latestProdDate: string | null = null;
      let maxMeterAkhir = 0;

      headers.forEach((h) => {
        const activeDetails = (h.production_details || []).filter(
          (d: any) => !d.is_deleted && (Number(d.pcs_index) || 1) === pcsIdx
        );
        if (activeDetails.length > 0) {
          pcsDetails.push(...activeDetails);
          if (h.tgl && (!latestProdDate || h.tgl > latestProdDate)) {
            latestProdDate = h.tgl;
          }
          if (isMeteran && Number(h.meter_akhir) > maxMeterAkhir) {
            maxMeterAkhir = Number(h.meter_akhir);
          }
        }
      });

      // Fallback for meteran where production_headers exists without pcs_index match
      if (pcsDetails.length === 0 && isMeteran && pcsIdx === 1 && headers.length > 0) {
        headers.forEach((h) => {
          if (h.tgl && (!latestProdDate || h.tgl > latestProdDate)) {
            latestProdDate = h.tgl;
          }
          if (Number(h.meter_akhir) > maxMeterAkhir) {
            maxMeterAkhir = Number(h.meter_akhir);
          }
        });
      }

      // 2. QC batch for this PCS
      const qcBatch = qcBatches.find((q) => (Number(q.pcs_index) || 1) === pcsIdx) || null;

      // 3. Mending batch for this PCS
      const mendingBatch = mendingBatches.find((m) => (Number(m.pcs_index) || 1) === pcsIdx) || null;

      // Determine stage
      let stage: TrackingStage = "PLANNED";
      if (mendingBatch) {
        stage = "COMPLETED";
      } else if (qcBatch) {
        stage = "INSPECTED";
      } else if (pcsDetails.length > 0 || (isMeteran && maxMeterAkhir > 0)) {
        stage = "IN_PRODUCTION";
      }

      // Calculate actual quantity (Jumlah)
      let jumlahAktual: number | null = null;
      if (mendingBatch) {
        if (isMeteran) {
          jumlahAktual = Number(mendingBatch.mending_grade_a) || maxMeterAkhir || null;
        } else {
          jumlahAktual = Number(mendingBatch.total_panel) || mendingBatch.items?.length || pcsDetails.length || null;
        }
      } else if (stage === "INSPECTED" || stage === "IN_PRODUCTION") {
        if (isMeteran) {
          jumlahAktual = maxMeterAkhir > 0 ? maxMeterAkhir : null;
        } else {
          jumlahAktual = pcsDetails.length > 0 ? pcsDetails.length : null;
        }
      }

      // Calculate Overall Grade if mending completed
      let overallGrade: string | null = null;
      if (mendingBatch) {
        const gradeResult = calculateOverallGradeData(
          (mendingBatch.items || []).map((i: any) => {
            const d = Array.isArray(i.detail) ? i.detail[0] : i.detail;
            return {
              ...i,
              panel_no: d?.keterangan_cacat || "",
              keterangan_cacat: d?.keterangan_cacat || "",
              kategori_masalah: d?.kategori_masalah || "",
              detail_masalah: d?.detail_masalah || "",
              hasil_mending: i.hasil_mending || "A",
              detail: d,
            };
          }),
          isMeteran,
          Number(mendingBatch.mending_grade_a) || maxMeterAkhir || undefined
        );
        overallGrade =
          gradeResult.overallGrade && gradeResult.overallGrade !== "-"
            ? gradeResult.overallGrade
            : "A";
      }

      pcsList.push({
        pcs_index: pcsIdx,
        stage,
        jumlah_aktual: jumlahAktual,
        satuan,
        berat_kain: qcBatch?.berat_kain ? Number(qcBatch.berat_kain) : null,
        overall_grade: overallGrade,
        tanggal_produksi: latestProdDate,
        tanggal_qc: qcBatch?.tanggal_inspeksi || null,
        tanggal_mending: mendingBatch?.tanggal_mending || null,
        petugas_qc: qcBatch?.petugas_inspeksi || null,
        mending_grade_a: mendingBatch ? Number(mendingBatch.mending_grade_a) || 0 : null,
        mending_grade_b: mendingBatch ? Number(mendingBatch.mending_grade_b) || 0 : null,
        mending_grade_bs: mendingBatch ? Number(mendingBatch.mending_grade_bs) || 0 : null,
        total_detail_produksi: pcsDetails.length,
      });
    }

    return {
      success: true,
      data: {
        found: true,
        nomor_mc: nomorMc,
        potongan_ke: potonganKe,
        is_meteran: isMeteran,
        design_id: firstHeader?.design_id || plan?.design_id || "-",
        no_customer: firstHeader?.no_customer || plan?.no_customer || "-",
        no_order_barang: firstHeader?.no_order_barang || plan?.no_order_barang || "-",
        pcs_count: pcsCount,
        target_produksi: targetProduksi,
        satuan,
        pick: firstHeader?.pick || plan?.pick || null,
        course: firstHeader?.course || plan?.course || null,
        rpm: firstHeader?.rpm || plan?.rpm || null,
        jenis_benang_dasar: firstHeader?.jenis_benang_dasar || plan?.jenis_benang_dasar || null,
        plan_created_at: plan?.created_at || null,
        pcs_list: pcsList,
        last_updated_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    console.error("Error in getPotonganTrackingData:", err);
    return { success: false, error: err?.message || "Gagal memuat data tracking potongan." };
  }
}
