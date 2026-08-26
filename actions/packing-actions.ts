"use server";

import { createClient } from "@/lib/supabase/server";

export interface PackingQueueItem {
  id: number; // final_inspection_batches ID
  nomor_mc: string;
  design_id: string;
  potongan_ke: number;
  pcs_index: number;
  tanggal_final: string;
  petugas_final: string;
  total_panel: number;
  final_grade_a: number;
  final_grade_b: number;
  final_grade_bs: number;
  berat_kain: number;
  is_meteran: boolean;
  keterangan_final?: string;
  created_at: string;
}

export interface PackingBatchRecord {
  id: string;
  session_id?: string | null;
  created_at: string;
  tanggal_packing: string;
  nomor_mc: string;
  design_id: string;
  potongan_ke: number;
  pcs_index: number;
  final_inspection_batch_id?: number | null;
  petugas_packing: string;
  petugas_packing_2?: string | null;
  start_packing: string;
  finish_packing: string;
  elapsed_seconds: number;
  pause_seconds: number;
  keterangan_packing?: string | null;
  status: string;
}

export interface SavePackingSessionPayload {
  selected_items: Array<{
    final_inspection_batch_id?: number | null;
    nomor_mc: string;
    design_id: string;
    potongan_ke: number;
    pcs_index?: number;
  }>;
  tanggal_packing?: string;
  petugas_packing: string;
  petugas_packing_2?: string;
  start_packing: string;
  finish_packing: string;
  elapsed_seconds: number;
  pause_seconds?: number;
  keterangan_packing?: string;
}

/**
 * Mengambil daftar potongan yang telah lulus Final Inspek Mending dan siap untuk di-packing
 */
export async function getAvailablePackingQueue(): Promise<{
  success: boolean;
  data?: PackingQueueItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Ambil semua data final_inspection_batches
    const { data: finalBatches, error: finalErr } = await supabase
      .from("final_inspection_batches")
      .select(`
        id,
        nomor_mc,
        design_id,
        potongan_ke,
        pcs_index,
        tanggal_final,
        petugas_final,
        total_panel,
        final_grade_a,
        final_grade_b,
        final_grade_bs,
        berat_kain,
        keterangan_final,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (finalErr) {
      console.error("Error fetching final_inspection_batches:", finalErr);
      return { success: false, error: finalErr.message };
    }

    if (!finalBatches || finalBatches.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Ambil data batch yang SUDAH selesai di-packing
    const { data: packedBatches, error: packedErr } = await supabase
      .from("packing_batches")
      .select("final_inspection_batch_id, nomor_mc, design_id, potongan_ke, pcs_index");

    if (packedErr) {
      console.error("Error fetching packing_batches:", packedErr);
      return { success: false, error: packedErr.message };
    }

    const packedFinalIds = new Set(
      (packedBatches || [])
        .map((p) => p.final_inspection_batch_id)
        .filter(Boolean)
    );

    const packedKeys = new Set(
      (packedBatches || []).map(
        (p) => `${p.nomor_mc}_${p.design_id}_${p.potongan_ke}_${p.pcs_index || 1}`
      )
    );

    // Filter yang belum pernah di-pack
    const pendingBatches = finalBatches.filter((b) => {
      if (b.id && packedFinalIds.has(b.id)) return false;
      const key = `${b.nomor_mc}_${b.design_id}_${b.potongan_ke}_${b.pcs_index || 1}`;
      if (packedKeys.has(key)) return false;
      return true;
    });

    if (pendingBatches.length === 0) {
      return { success: true, data: [] };
    }

    // 3. Ambil header info untuk menentukan jenis kain (Meteran / Panel)
    const nomorMcs = Array.from(new Set(pendingBatches.map((b) => b.nomor_mc)));
    const { data: headerRows } = await supabase
      .from("production_headers")
      .select("nomor_mc, design_id, potongan_ke, panel_no")
      .in("nomor_mc", nomorMcs);

    const meteranMap = new Map<string, boolean>();
    (headerRows || []).forEach((h) => {
      const key = `${h.nomor_mc}_${h.design_id}_${h.potongan_ke}`;
      if (h.panel_no === "METERAN") {
        meteranMap.set(key, true);
      }
    });

    const queue: PackingQueueItem[] = pendingBatches.map((b) => {
      const isMeteran =
        meteranMap.get(`${b.nomor_mc}_${b.design_id}_${b.potongan_ke}`) ||
        b.nomor_mc.startsWith("MC-") ||
        false;

      return {
        id: Number(b.id),
        nomor_mc: b.nomor_mc,
        design_id: b.design_id,
        potongan_ke: Number(b.potongan_ke),
        pcs_index: Number(b.pcs_index || 1),
        tanggal_final: b.tanggal_final || "",
        petugas_final: b.petugas_final || "-",
        total_panel: Number(b.total_panel || 0),
        final_grade_a: Number(b.final_grade_a || 0),
        final_grade_b: Number(b.final_grade_b || 0),
        final_grade_bs: Number(b.final_grade_bs || 0),
        berat_kain: Number(b.berat_kain || 0),
        is_meteran: isMeteran,
        keterangan_final: b.keterangan_final || "",
        created_at: b.created_at,
      };
    });

    return { success: true, data: queue };
  } catch (err: any) {
    console.error("Error in getAvailablePackingQueue:", err);
    return { success: false, error: err.message || "Gagal mengambil antrian packing" };
  }
}

/**
 * Menyimpan data SESI PACKING borongan/keseluruhan untuk beberapa potongan kain sekaligus
 */
export async function saveBatchPackingSession(
  payload: SavePackingSessionPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!payload.selected_items || payload.selected_items.length === 0) {
      return { success: false, error: "Pilih minimal satu potongan kain yang telah di-pack!" };
    }

    if (!payload.petugas_packing || !payload.petugas_packing.trim()) {
      return { success: false, error: "Pilih atau masukkan nama Petugas Packing Utama!" };
    }

    const supabase = await createClient();
    const sessionId = crypto.randomUUID();
    const todayStr = payload.tanggal_packing || new Date().toISOString().split("T")[0];

    const insertRows = payload.selected_items.map((item) => ({
      session_id: sessionId,
      final_inspection_batch_id: item.final_inspection_batch_id || null,
      nomor_mc: item.nomor_mc,
      design_id: item.design_id,
      potongan_ke: Number(item.potongan_ke),
      pcs_index: Number(item.pcs_index || 1),
      tanggal_packing: todayStr,
      petugas_packing: payload.petugas_packing.trim(),
      petugas_packing_2: payload.petugas_packing_2 ? payload.petugas_packing_2.trim() : null,
      start_packing: payload.start_packing,
      finish_packing: payload.finish_packing,
      elapsed_seconds: Number(payload.elapsed_seconds || 0),
      pause_seconds: Number(payload.pause_seconds || 0),
      keterangan_packing: payload.keterangan_packing ? payload.keterangan_packing.trim() : null,
      status: "COMPLETED",
    }));

    const { data, error } = await supabase
      .from("packing_batches")
      .insert(insertRows)
      .select();

    if (error) {
      console.error("Error inserting batch packing session:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Error in saveBatchPackingSession:", err);
    return { success: false, error: err.message || "Gagal menyimpan data sesi packing" };
  }
}

/**
 * Menyimpan data pengerjaan packing potongan tunggal (legacy support)
 */
export async function savePackingBatch(payload: {
  final_inspection_batch_id?: number | null;
  nomor_mc: string;
  design_id: string;
  potongan_ke: number;
  pcs_index?: number;
  tanggal_packing?: string;
  petugas_packing: string;
  petugas_packing_2?: string;
  start_packing: string;
  finish_packing: string;
  elapsed_seconds: number;
  pause_seconds?: number;
  keterangan_packing?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  return saveBatchPackingSession({
    selected_items: [
      {
        final_inspection_batch_id: payload.final_inspection_batch_id,
        nomor_mc: payload.nomor_mc,
        design_id: payload.design_id,
        potongan_ke: payload.potongan_ke,
        pcs_index: payload.pcs_index,
      },
    ],
    tanggal_packing: payload.tanggal_packing,
    petugas_packing: payload.petugas_packing,
    petugas_packing_2: payload.petugas_packing_2,
    start_packing: payload.start_packing,
    finish_packing: payload.finish_packing,
    elapsed_seconds: payload.elapsed_seconds,
    pause_seconds: payload.pause_seconds,
    keterangan_packing: payload.keterangan_packing,
  });
}

/**
 * Mengambil riwayat pengerjaan packing dengan filter
 */
export async function getPackingHistory(filters?: {
  tanggal?: string;
  nomor_mc?: string;
  potongan_ke?: string;
  petugas?: string;
}): Promise<{
  success: boolean;
  data?: PackingBatchRecord[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("packing_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.tanggal) {
      query = query.eq("tanggal_packing", filters.tanggal);
    }
    if (filters?.nomor_mc) {
      query = query.eq("nomor_mc", filters.nomor_mc);
    }
    if (filters?.potongan_ke) {
      query = query.eq("potongan_ke", Number(filters.potongan_ke));
    }
    if (filters?.petugas) {
      query = query.or(
        `petugas_packing.ilike.%${filters.petugas}%,petugas_packing_2.ilike.%${filters.petugas}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching packing_history:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PackingBatchRecord[] };
  } catch (err: any) {
    console.error("Error in getPackingHistory:", err);
    return { success: false, error: err.message || "Gagal mengambil riwayat packing" };
  }
}

/**
 * Menghapus data packing (membatalkan status pack)
 */
export async function deletePackingBatch(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("packing_batches")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting packing_batch:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in deletePackingBatch:", err);
    return { success: false, error: err.message || "Gagal menghapus data packing" };
  }
}
