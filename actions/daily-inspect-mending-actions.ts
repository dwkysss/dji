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
  durasi_inspect: string;
  // Data Mending
  tgl_mending: string;
  petugas_mending: string;
  start_mending: string;
  finish_mending: string;
  durasi_mending: string;
  // Data Final
  tgl_final: string;
  petugas_final: string;
  start_final: string;
  finish_final: string;
  durasi_final: string;
}

const calculateDurationStr = (
  start?: string | null,
  finish?: string | null,
  pauseSec: number = 0,
  elapsedSec?: number | null
): string => {
  if (!start && !finish && (elapsedSec === undefined || elapsedSec === null)) {
    return "-";
  }

  let totalSec = 0;

  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec > 0) {
    totalSec = elapsedSec;
  } else if (start && finish) {
    const parseSecs = (str: string) => {
      const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!match) return null;
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = match[3] ? parseInt(match[3], 10) : 0;
      return h * 3600 + m * 60 + s;
    };

    const sSecs = parseSecs(start);
    const fSecs = parseSecs(finish);
    if (sSecs !== null && fSecs !== null) {
      let diff = fSecs - sSecs;
      if (diff < 0) diff += 24 * 3600;
      totalSec = Math.max(0, diff - pauseSec);
    } else {
      return "-";
    }
  } else {
    return "-";
  }

  if (totalSec === 0) return "-";

  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}d` : `${mins} mnt`;
  }
  return `${secs} dtk`;
};

export interface GetDailyInspectMendingParams {
  dateFrom?: string;
  dateTo?: string;
  machine?: string;
  year?: string;
  search?: string;
  dateField?: "tgl_inspect" | "tgl_potong" | "tgl_mending" | "tgl_final";
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

    const targetDateField = params.dateField || "tgl_inspect";
    const hasDateFilter = !!(params.dateFrom || params.dateTo);

    let qcBatches: any[] = [];
    let mendingBatches: any[] = [];
    let finalBatches: any[] = [];

    // STRATEGI OPTIMASI: Push filter tanggal langsung ke level database
    if (hasDateFilter && targetDateField === "tgl_inspect") {
      let q = supabase
        .from("qc_inspection_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
          tanggal_inspeksi, start_inspect, finish_inspect,
          petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);
      if (params.machine && params.machine !== "ALL") q = q.eq("nomor_mc", params.machine);
      if (params.dateFrom) q = q.gte("tanggal_inspeksi", params.dateFrom);
      if (params.dateTo) q = q.lte("tanggal_inspeksi", params.dateTo);

      const { data, error } = await q;
      if (error) console.warn("QC batches error:", error.message);
      qcBatches = data || [];

      // Hanya ambil data mending dan final untuk potongan yang terinspeksi pada tanggal tersebut (paralel)
      const relevantPots = Array.from(new Set(qcBatches.map((b) => Number(b.potongan_ke)).filter(Boolean)));
      if (relevantPots.length > 0) {
        let mQ = supabase
          .from("mending_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id,
            tanggal_mending, start_mending, finish_mending, petugas_mending,
            total_panel, mending_grade_a, mending_grade_b, mending_grade_bs,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);
        let fQ = supabase
          .from("final_inspection_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id,
            tanggal_final, start_final, finish_final,
            petugas_final, petugas_final_2, petugas_final_3,
            total_panel, final_grade_a, final_grade_b, final_grade_bs, keterangan_final,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);

        if (params.machine && params.machine !== "ALL") {
          mQ = mQ.eq("nomor_mc", params.machine);
          fQ = fQ.eq("nomor_mc", params.machine);
        }

        const [mRes, fRes] = await Promise.all([mQ, fQ]);
        if (mRes.data) mendingBatches = mRes.data;
        if (fRes.data) finalBatches = fRes.data;
      }
    } else if (hasDateFilter && targetDateField === "tgl_mending") {
      let q = supabase
        .from("mending_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id,
          tanggal_mending, start_mending, finish_mending, petugas_mending,
          total_panel, mending_grade_a, mending_grade_b, mending_grade_bs,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);
      if (params.machine && params.machine !== "ALL") q = q.eq("nomor_mc", params.machine);
      if (params.dateFrom) q = q.gte("tanggal_mending", params.dateFrom);
      if (params.dateTo) q = q.lte("tanggal_mending", params.dateTo);

      const { data, error } = await q;
      if (error) console.warn("Mending batches error:", error.message);
      mendingBatches = data || [];

      const relevantPots = Array.from(new Set(mendingBatches.map((b) => Number(b.potongan_ke)).filter(Boolean)));
      if (relevantPots.length > 0) {
        let qcQ = supabase
          .from("qc_inspection_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
            tanggal_inspeksi, start_inspect, finish_inspect,
            petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);
        let fQ = supabase
          .from("final_inspection_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id,
            tanggal_final, start_final, finish_final,
            petugas_final, petugas_final_2, petugas_final_3,
            total_panel, final_grade_a, final_grade_b, final_grade_bs, keterangan_final,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);

        if (params.machine && params.machine !== "ALL") {
          qcQ = qcQ.eq("nomor_mc", params.machine);
          fQ = fQ.eq("nomor_mc", params.machine);
        }

        const [qcRes, fRes] = await Promise.all([qcQ, fQ]);
        if (qcRes.data) qcBatches = qcRes.data;
        if (fRes.data) finalBatches = fRes.data;
      }
    } else if (hasDateFilter && targetDateField === "tgl_final") {
      let q = supabase
        .from("final_inspection_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id,
          tanggal_final, start_final, finish_final,
          petugas_final, petugas_final_2, petugas_final_3,
          total_panel, final_grade_a, final_grade_b, final_grade_bs, keterangan_final,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);
      if (params.machine && params.machine !== "ALL") q = q.eq("nomor_mc", params.machine);
      if (params.dateFrom) q = q.gte("tanggal_final", params.dateFrom);
      if (params.dateTo) q = q.lte("tanggal_final", params.dateTo);

      const { data, error } = await q;
      if (error) console.warn("Final batches error:", error.message);
      finalBatches = data || [];

      const relevantPots = Array.from(new Set(finalBatches.map((b) => Number(b.potongan_ke)).filter(Boolean)));
      if (relevantPots.length > 0) {
        let qcQ = supabase
          .from("qc_inspection_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
            tanggal_inspeksi, start_inspect, finish_inspect,
            petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);
        let mQ = supabase
          .from("mending_batches")
          .select(`
            id, nomor_mc, potongan_ke, pcs_index, design_id,
            tanggal_mending, start_mending, finish_mending, petugas_mending,
            total_panel, mending_grade_a, mending_grade_b, mending_grade_bs,
            pause_seconds, elapsed_seconds
          `)
          .in("potongan_ke", relevantPots)
          .limit(50000);

        if (params.machine && params.machine !== "ALL") {
          qcQ = qcQ.eq("nomor_mc", params.machine);
          mQ = mQ.eq("nomor_mc", params.machine);
        }

        const [qcRes, mRes] = await Promise.all([qcQ, mQ]);
        if (qcRes.data) qcBatches = qcRes.data;
        if (mRes.data) mendingBatches = mRes.data;
      }
    } else {
      // "Semua" (No date filter) atau "tgl_potong" -> Eksekusi paralel semua query
      let qcQuery = supabase
        .from("qc_inspection_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id, berat_kain,
          tanggal_inspeksi, start_inspect, finish_inspect,
          petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);
      let mendingQuery = supabase
        .from("mending_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id,
          tanggal_mending, start_mending, finish_mending, petugas_mending,
          total_panel, mending_grade_a, mending_grade_b, mending_grade_bs,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);
      let finalQuery = supabase
        .from("final_inspection_batches")
        .select(`
          id, nomor_mc, potongan_ke, pcs_index, design_id,
          tanggal_final, start_final, finish_final,
          petugas_final, petugas_final_2, petugas_final_3,
          total_panel, final_grade_a, final_grade_b, final_grade_bs, keterangan_final,
          pause_seconds, elapsed_seconds
        `)
        .limit(50000);

      if (params.machine && params.machine !== "ALL") {
        qcQuery = qcQuery.eq("nomor_mc", params.machine);
        mendingQuery = mendingQuery.eq("nomor_mc", params.machine);
        finalQuery = finalQuery.eq("nomor_mc", params.machine);
      }

      const [qcRes, mRes, fRes] = await Promise.all([qcQuery, mendingQuery, finalQuery]);
      if (qcRes.data) qcBatches = qcRes.data;
      if (mRes.data) mendingBatches = mRes.data;
      if (fRes.data) finalBatches = fRes.data;
    }

    // 4. Bangun peta data per potongan unik: key = `${nomor_mc}_${potongan_ke}_${pcs_index}`
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
          durasi_inspect: "-",
          tgl_mending: "",
          petugas_mending: "",
          start_mending: "",
          finish_mending: "",
          durasi_mending: "-",
          tgl_final: "",
          petugas_final: "",
          start_final: "",
          finish_final: "",
          durasi_final: "-",
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
        row.durasi_inspect = calculateDurationStr(
          qb.start_inspect,
          qb.finish_inspect,
          qb.pause_seconds || 0,
          qb.elapsed_seconds
        );

        // Jika mesin Tricote (berawalan T), otomatis inspect & mending bersamaan jika mending belum ada
        if (row.nomor_mc.startsWith("T") && !row.tgl_mending) {
          row.tgl_mending = qb.tanggal_inspeksi || "";
          row.petugas_mending = qb.petugas_mending || inspectNames;
          row.start_mending = qb.start_inspect || "";
          row.finish_mending = qb.finish_inspect || "";
          row.durasi_mending = row.durasi_inspect;
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
        row.durasi_mending = calculateDurationStr(
          mb.start_mending,
          mb.finish_mending,
          mb.pause_seconds || 0,
          mb.elapsed_seconds
        );
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
        row.durasi_final = calculateDurationStr(
          fb.start_final,
          fb.finish_final,
          fb.pause_seconds || 0,
          fb.elapsed_seconds
        );
      });
    }

    // D. Ambil Data Potong Kain SPESIFIK untuk potongan yang sudah terdata di rowsMap
    // Menggunakan CHUNK_SIZE = 15 dan .limit(50000) agar tidak terpotong batasan default 1000 baris Supabase
    const neededPotongan = Array.from(
      new Set(Array.from(rowsMap.values()).map((r) => r.potongan_ke).filter(Boolean))
    );

    if (neededPotongan.length > 0) {
      const CHUNK_SIZE = 15;
      const chunks: number[][] = [];
      for (let i = 0; i < neededPotongan.length; i += CHUNK_SIZE) {
        chunks.push(neededPotongan.slice(i, i + CHUNK_SIZE));
      }

      const prodHeaderPromises = chunks.map((chunk) => {
        let q = supabase
          .from("production_headers")
          .select(`
            id, tgl, tanggal_potong, design_id, potongan_ke, panel_no, nomor_mc,
            meter_awal, meter_akhir,
            production_details (
              pcs_index, meter_kain, jml_hasil_produksi
            )
          `)
          .in("potongan_ke", chunk)
          .limit(50000);

        if (params.machine && params.machine !== "ALL") {
          q = q.eq("nomor_mc", params.machine);
        }
        return q;
      });

      const chunkResults = await Promise.all(prodHeaderPromises);
      const allProdHeaders: any[] = [];
      chunkResults.forEach((res) => {
        if (res.data) allProdHeaders.push(...res.data);
      });

      // Peta hitungan panel per key `${mc}_${pot}_${pcs}`
      const panelCountMap = new Map<string, number>();

      allProdHeaders.forEach((h: any) => {
        const mc = (h.nomor_mc || "").trim().toUpperCase();
        const pot = Number(h.potongan_ke || 0);
        if (!mc || !pot) return;

        const details = h.production_details || [];
        const isMeterHeader = mc.startsWith("T") || String(h.panel_no || "").toUpperCase() === "METERAN";

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
          if (!existingRow) return;

          // Isi tanggal potong (gunakan tanggal_potong, fallback ke tgl, bersihkan format ISO jika ada)
          const rawCutDate = h.tanggal_potong || h.tgl || "";
          const cutDate = rawCutDate.includes("T") ? rawCutDate.split("T")[0] : rawCutDate;
          if (cutDate && !existingRow.tgl_potong) {
            existingRow.tgl_potong = cutDate;
          }
          if (h.design_id && !existingRow.design_id) {
            existingRow.design_id = h.design_id;
          }
          existingRow.is_meter = isMeterHeader;

          if (isMeterHeader) {
            let totalMeter = 0;
            if (h.meter_akhir !== undefined && h.meter_awal !== undefined && h.meter_akhir !== null && h.meter_awal !== null) {
              totalMeter = Math.abs(Number(h.meter_akhir) - Number(h.meter_awal));
            } else {
              const pcsDetails = details.filter((d: any) => Number(d.pcs_index || 1) === pcsNum);
              pcsDetails.forEach((d: any) => {
                totalMeter += Number(d.meter_kain || d.jml_hasil_produksi || 0);
              });
            }
            if (totalMeter > 0) existingRow.qty_meter = totalMeter;
          } else {
            // Hitung akumulasi panel murni produksi (Sama seperti Laporan Bulanan: TIDAK menyertakan panel BS / BS AWAL / BS AKHIR)
            const pStr = String(h.panel_no || "").toUpperCase().trim();
            const pcsDetails = details.filter((d: any) => Number(d.pcs_index || 1) === pcsNum);
            const isBsPanel =
              pStr.includes("BS") ||
              pStr.includes("AWAL") ||
              pStr.includes("AKHIR") ||
              pStr === "BERHENTI" ||
              pStr === "ISTIRAHAT" ||
              pcsDetails.some((d: any) => Number(d.jml_hasil_produksi) === 0);

            if (!isBsPanel) {
              const currentCount = panelCountMap.get(key) || 0;
              panelCountMap.set(key, currentCount + 1);
            }
          }
        });
      });

      // Terapkan hasil hitungan panel murni produksi tanpa BS
      panelCountMap.forEach((count, key) => {
        const row = rowsMap.get(key);
        if (row && !row.is_meter) {
          row.qty_panel = count;
        }
      });
    }

    // 6. Filter & Sorting (Hanya yang minimal sudah di-inspek atau di-mending)
    let result = Array.from(rowsMap.values()).filter((r) => {
      const hasInspect = !!(r.tgl_inspect || r.petugas_inspect || r.start_inspect || r.finish_inspect);
      const hasMending = !!(r.tgl_mending || r.petugas_mending || r.start_mending || r.finish_mending);
      const hasFinal = !!(r.tgl_final || r.petugas_final || r.start_final || r.finish_final);
      return hasInspect || hasMending || hasFinal;
    });

    // Filter Tahun
    if (currentYear) {
      result = result.filter((r) => {
        const tgl = r[targetDateField] || r.tgl_inspect || r.tgl_mending || r.tgl_final || r.tgl_potong;
        if (!tgl) return true;
        return tgl.startsWith(currentYear);
      });
    }

    // Filter Tanggal Rentang (Date From & Date To) fleksibel sesuai targetDateField
    if (params.dateFrom) {
      result = result.filter((r) => {
        const tgl = r[targetDateField] || r.tgl_inspect || r.tgl_mending || r.tgl_final || r.tgl_potong;
        if (!tgl) return false;
        return tgl >= params.dateFrom!;
      });
    }
    if (params.dateTo) {
      result = result.filter((r) => {
        const tgl = r[targetDateField] || r.tgl_inspect || r.tgl_mending || r.tgl_final || r.tgl_potong;
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

    // Sorting Default: Urutkan kronologis ASC (Tanggal terlama di atas, Tanggal terbesar/terbaru di BAWAH)
    result.sort((a, b) => {
      const dateA = a.tgl_inspect || a.tgl_mending || a.tgl_final || a.tgl_potong || "";
      const dateB = b.tgl_inspect || b.tgl_mending || b.tgl_final || b.tgl_potong || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB); // Tanggal terlama di atas, tanggal terbesar di BAWAH (ASC)
      if (a.start_inspect && b.start_inspect && a.start_inspect !== b.start_inspect) {
        return a.start_inspect.localeCompare(b.start_inspect); // Jam pagi di atas, jam sore di bawah (ASC)
      }
      if (a.nomor_mc !== b.nomor_mc) return a.nomor_mc.localeCompare(b.nomor_mc);
      if (a.potongan_ke !== b.potongan_ke) return a.potongan_ke - b.potongan_ke;
      return a.pcs_index - b.pcs_index;
    });

    return { success: true, data: result };
  } catch (err: any) {
    console.error("Error getDailyInspectMendingReport:", err);
    return { success: false, data: [], error: err.message || "Gagal mengambil data laporan harian" };
  }
}
