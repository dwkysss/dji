"use server";

import { createClient } from "@/lib/supabase/server";

export interface DailyInspectMendingRow {
  id: string;
  nomor_mc: string;
  potongan_ke: number;
  pcs_index: number;
  // Data Potong Kain
  tgl_potong: string;
  design_id: string;
  is_meter: boolean;
  qty_panel: number | null;
  qty_meter: number | null;
  // Data Inspect (QC)
  tgl_inspect: string;
  petugas_inspect: string;
  start_inspect: string;
  finish_inspect: string;
  // Data Mending
  tgl_mending: string;
  petugas_mending: string;
  start_mending: string;
  finish_mending: string;
  // Data Final
  tgl_final: string;
  petugas_final: string;
  start_final: string;
  finish_final: string;
}

export interface GetDailyInspectMendingParams {
  dateFrom?: string;
  dateTo?: string;
  machine?: string;
  year?: string;
  search?: string;
}

/**
 * Mengambil data Laporan Harian Inspect & Mending
 * Menggabungkan production_headers, qc_inspection_batches, mending_batches, dan final_inspection_batches
 */
export async function getDailyInspectMendingReport(params: GetDailyInspectMendingParams = {}): Promise<{
  success: boolean;
  data: DailyInspectMendingRow[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const currentYear = params.year || new Date().getFullYear().toString();

    // 1. Ambil seluruh data dari qc_inspection_batches
    let qcQuery = supabase
      .from("qc_inspection_batches")
      .select(`
        id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
        tanggal_inspeksi, start_inspect, finish_inspect,
        petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3
      `);
    if (params.machine && params.machine !== "ALL") {
      qcQuery = qcQuery.eq("nomor_mc", params.machine);
    }
    const { data: qcBatches, error: qcErr } = await qcQuery;
    if (qcErr) console.warn("QC batches error:", qcErr.message);

    // 2. Ambil seluruh data dari mending_batches
    let mendingQuery = supabase
      .from("mending_batches")
      .select(`
        id, nomor_mc, potongan_ke, pcs_index, design_id,
        tanggal_mending, start_mending, finish_mending, petugas_mending,
        total_panel, mending_grade_a, mending_grade_b, mending_grade_bs
      `);
    if (params.machine && params.machine !== "ALL") {
      mendingQuery = mendingQuery.eq("nomor_mc", params.machine);
    }
    const { data: mendingBatches, error: mndErr } = await mendingQuery;
    if (mndErr) console.warn("Mending batches error:", mndErr.message);

    // 3. Ambil seluruh data dari final_inspection_batches
    let finalQuery = supabase
      .from("final_inspection_batches")
      .select(`
        id, nomor_mc, potongan_ke, pcs_index, design_id,
        tanggal_final, start_final, finish_final,
        petugas_final, petugas_final_2, petugas_final_3,
        total_panel, final_grade_a, final_grade_b, final_grade_bs, keterangan_final
      `);
    if (params.machine && params.machine !== "ALL") {
      finalQuery = finalQuery.eq("nomor_mc", params.machine);
    }
    const { data: finalBatches, error: finalErr } = await finalQuery;
    if (finalErr) console.warn("Final batches error:", finalErr.message);

    // 4. Ambil production_headers untuk info potong kain (tanggal, design, panel, meter)
    let prodQuery = supabase
      .from("production_headers")
      .select(`
        id, tgl, tanggal_potong, design_id, potongan_ke, panel_no, nomor_mc,
        meter_awal, meter_akhir, no_order_barang,
        production_details (
          id, pcs_index, meter_kain, jml_hasil_produksi, roll_no, keterangan_qc
        )
      `);
    if (params.machine && params.machine !== "ALL") {
      prodQuery = prodQuery.eq("nomor_mc", params.machine);
    }
    const { data: prodHeaders, error: prodErr } = await prodQuery;
    if (prodErr) console.warn("Prod headers error:", prodErr.message);

    // 5. Bangun peta data per potongan unik: key = `${nomor_mc}_${potongan_ke}_${pcs_index}`
    const rowsMap = new Map<string, DailyInspectMendingRow>();

    const getOrCreateRow = (mc: string, pot: number, pcs: number): DailyInspectMendingRow => {
      const key = `${mc.trim().toUpperCase()}_${pot}_${pcs}`;
      if (!rowsMap.has(key)) {
        const isTricote = mc.trim().toUpperCase().startsWith("T");
        rowsMap.set(key, {
          id: key,
          nomor_mc: mc.trim().toUpperCase(),
          potongan_ke: pot,
          pcs_index: pcs,
          tgl_potong: "",
          design_id: "",
          is_meter: isTricote,
          qty_panel: null,
          qty_meter: null,
          tgl_inspect: "",
          petugas_inspect: "",
          start_inspect: "",
          finish_inspect: "",
          tgl_mending: "",
          petugas_mending: "",
          start_mending: "",
          finish_mending: "",
          tgl_final: "",
          petugas_final: "",
          start_final: "",
          finish_final: "",
        });
      }
      return rowsMap.get(key)!;
    };

    // A. Masukkan Data dari QC Inspection Batches (HANYA YANG MINIMAL SUDAH DI-INSPEK)
    if (qcBatches) {
      qcBatches.forEach((qb: any) => {
        const mc = qb.nomor_mc || "";
        const pot = Number(qb.potongan_ke || 0);
        const pcs = Number(qb.pcs_index || 1);
        if (!mc || !pot) return;

        const row = getOrCreateRow(mc, pot, pcs);
        if (qb.design_id && !row.design_id) row.design_id = qb.design_id;

        row.tgl_inspect = qb.tanggal_inspeksi || "";
        const inspectNames = [qb.petugas_inspeksi, qb.petugas_inspeksi_2, qb.petugas_inspeksi_3]
          .filter(Boolean)
          .join(" & ");
        row.petugas_inspect = inspectNames;
        row.start_inspect = qb.start_inspect || "";
        row.finish_inspect = qb.finish_inspect || "";

        // Jika mesin Tricote (berawalan T), otomatis inspect & mending bersamaan jika mending belum ada
        if (row.nomor_mc.startsWith("T") && !row.tgl_mending) {
          row.tgl_mending = qb.tanggal_inspeksi || "";
          row.petugas_mending = qb.petugas_mending || inspectNames;
          row.start_mending = qb.start_inspect || "";
          row.finish_mending = qb.finish_inspect || "";
        }
      });
    }

    // B. Masukkan Data dari Mending Batches
    if (mendingBatches) {
      mendingBatches.forEach((mb: any) => {
        const mc = mb.nomor_mc || "";
        const pot = Number(mb.potongan_ke || 0);
        const pcs = Number(mb.pcs_index || 1);
        if (!mc || !pot) return;

        const row = getOrCreateRow(mc, pot, pcs);
        if (mb.design_id && !row.design_id) row.design_id = mb.design_id;

        row.tgl_mending = mb.tanggal_mending || row.tgl_mending || "";
        row.petugas_mending = mb.petugas_mending || row.petugas_mending || "";
        row.start_mending = mb.start_mending || row.start_mending || "";
        row.finish_mending = mb.finish_mending || row.finish_mending || "";

        if (mb.total_panel && !row.qty_panel && !row.is_meter) {
          row.qty_panel = mb.total_panel;
        }
      });
    }

    // C. Masukkan Data dari Final Inspection Batches
    if (finalBatches) {
      finalBatches.forEach((fb: any) => {
        const mc = fb.nomor_mc || "";
        const pot = Number(fb.potongan_ke || 0);
        const pcs = Number(fb.pcs_index || 1);
        if (!mc || !pot) return;

        const row = getOrCreateRow(mc, pot, pcs);
        if (fb.design_id && !row.design_id) row.design_id = fb.design_id;

        row.tgl_final = fb.tanggal_final || "";
        const finalNames = [fb.petugas_final, fb.petugas_final_2, fb.petugas_final_3]
          .filter(Boolean)
          .join(" & ");
        row.petugas_final = finalNames;
        row.start_final = fb.start_final || "";
        row.finish_final = fb.finish_final || "";

        if (fb.total_panel && !row.qty_panel && !row.is_meter) {
          row.qty_panel = fb.total_panel;
        }
      });
    }

    // D. Lengkapi Data Potong Kain (Tanggal Potong, Design, Qty Panel/Meter) HANYA untuk potongan yang sudah ada di rowsMap
    if (prodHeaders && rowsMap.size > 0) {
      prodHeaders.forEach((h: any) => {
        const mc = (h.nomor_mc || "").trim().toUpperCase();
        const pot = Number(h.potongan_ke || 0);
        if (!mc || !pot) return;

        const details = h.production_details || [];
        const isMeterHeader = mc.startsWith("T") || String(h.panel_no || "").toUpperCase() === "METERAN";

        // Cek semua pcs_index di header ini apakah ada di rowsMap
        const pcsSet = new Set<number>();
        details.forEach((d: any) => {
          if (d.pcs_index !== undefined && d.pcs_index !== null) {
            pcsSet.add(Number(d.pcs_index));
          }
        });
        if (pcsSet.size === 0) pcsSet.add(1);

        pcsSet.forEach((pcsNum) => {
          const key = `${mc}_${pot}_${pcsNum}`;
          const existingRow = rowsMap.get(key);
          if (!existingRow) {
            // Potongan ini BELUM di-inspek / mending / final, jangan masukkan ke laporan!
            return;
          }

          existingRow.tgl_potong = existingRow.tgl_potong || h.tanggal_potong || h.tgl || "";
          existingRow.design_id = existingRow.design_id || h.design_id || "";
          existingRow.is_meter = isMeterHeader;

          // Hitung QTY Meter atau QTY Panel
          const pcsDetails = details.filter((d: any) => Number(d.pcs_index || 1) === pcsNum);
          if (isMeterHeader) {
            let totalMeter = 0;
            if (h.meter_akhir !== undefined && h.meter_awal !== undefined && h.meter_akhir !== null && h.meter_awal !== null) {
              totalMeter = Math.abs(Number(h.meter_akhir) - Number(h.meter_awal));
            } else {
              pcsDetails.forEach((d: any) => {
                totalMeter += Number(d.meter_kain || d.jml_hasil_produksi || 0);
              });
            }
            if (totalMeter > 0) existingRow.qty_meter = totalMeter;
          } else {
            let pCount = pcsDetails.length;
            if (pCount > 0 && !existingRow.qty_panel) {
              existingRow.qty_panel = pCount;
            }
          }
        });
      });
    }

    // 6. Filter & Sorting (Hanya yang minimal sudah di-inspek atau di-mending)
    let result = Array.from(rowsMap.values()).filter((r) => {
      const hasInspect = !!(r.tgl_inspect || r.petugas_inspect || r.start_inspect || r.finish_inspect);
      const hasMending = !!(r.tgl_mending || r.petugas_mending || r.start_mending || r.finish_mending);
      const hasFinal = !!(r.tgl_final || r.petugas_final || r.start_final || r.finish_final);
      return hasInspect || hasMending || hasFinal;
    });

    // Filter Tahun (berdasarkan tgl_potong, tgl_inspect, atau tgl_mending)
    if (currentYear) {
      result = result.filter((r) => {
        const tgl = r.tgl_potong || r.tgl_inspect || r.tgl_mending || r.tgl_final;
        if (!tgl) return true;
        return tgl.startsWith(currentYear);
      });
    }

    // Filter Tanggal Rentang (Date From & Date To)
    if (params.dateFrom) {
      result = result.filter((r) => {
        const tgl = r.tgl_potong || r.tgl_inspect || r.tgl_mending || r.tgl_final;
        if (!tgl) return false;
        return tgl >= params.dateFrom!;
      });
    }
    if (params.dateTo) {
      result = result.filter((r) => {
        const tgl = r.tgl_potong || r.tgl_inspect || r.tgl_mending || r.tgl_final;
        if (!tgl) return false;
        return tgl <= params.dateTo!;
      });
    }

    // Filter Pencarian Teks (Search)
    if (params.search && params.search.trim() !== "") {
      const q = params.search.trim().toLowerCase();
      result = result.filter((r) => {
        return (
          r.nomor_mc.toLowerCase().includes(q) ||
          r.design_id.toLowerCase().includes(q) ||
          String(r.potongan_ke).includes(q) ||
          r.petugas_inspect.toLowerCase().includes(q) ||
          r.petugas_mending.toLowerCase().includes(q) ||
          r.petugas_final.toLowerCase().includes(q)
        );
      });
    }

    // Sorting: Urutkan berdasarkan Tanggal terbaru, Nomor Mesin, dan Nomor Potongan
    result.sort((a, b) => {
      const dateA = a.tgl_potong || a.tgl_inspect || a.tgl_mending || a.tgl_final || "";
      const dateB = b.tgl_potong || b.tgl_inspect || b.tgl_mending || b.tgl_final || "";
      if (dateA !== dateB) return dateB.localeCompare(dateA); // Terbaru di atas
      if (a.nomor_mc !== b.nomor_mc) return a.nomor_mc.localeCompare(b.nomor_mc);
      if (a.potongan_ke !== b.potongan_ke) return b.potongan_ke - a.potongan_ke;
      return a.pcs_index - b.pcs_index;
    });

    return { success: true, data: result };
  } catch (err: any) {
    console.error("Error getDailyInspectMendingReport:", err);
    return { success: false, data: [], error: err.message || "Gagal mengambil data laporan harian" };
  }
}
