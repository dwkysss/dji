"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAvailableFinalInspectionFilters() {
  try {
    const supabase = await createClient();
    
    // Step 1: Get all items that have been mended (status_mending IS NOT NULL) and not yet final inspected (status_final_mending IS NULL)
    const { data: pendingFinal, error: err1 } = await supabase
      .from("production_details")
      .select(`
        pcs_index,
        production_headers!inner (
          nomor_mc,
          design_id,
          potongan_ke
        )
      `)
      .not("status_mending", "is", null)
      .is("status_final_mending", null)
      .neq("status_mending", "Dihapus")
      .eq("is_deleted", false);

    if (err1) {
      return { success: false, error: err1.message };
    }

    // Step 2: Get items still pending mending (to verify if full PCS is ready)
    const { data: pendingMending, error: err2 } = await supabase
      .from("production_details")
      .select(`
        pcs_index,
        kategori_masalah,
        is_deleted,
        production_headers!inner (
          nomor_mc,
          design_id,
          potongan_ke,
          panel_no
        )
      `)
      .is("status_mending", null)
      .eq("is_deleted", false);

    if (err2) return { success: false, error: err2.message };

    // Build set of PCS groups that still have un-mended items
    const pendingMendingGroups = new Set<string>();
    for (const row of pendingMending || []) {
      const h = (row as any).production_headers;
      if (h) {
        pendingMendingGroups.add(`${h.nomor_mc}__${h.potongan_ke}__${(row as any).pcs_index || 1}`);
      }
    }

    // Build final inspection filters: include batch if it has at least one PCS that is fully mended and pending final inspection
    const uniquePairs = new Map();
    for (const row of pendingFinal || []) {
      const h = (row as any).production_headers;
      if (h) {
        const pcsKey = `${h.nomor_mc}__${h.potongan_ke}__${(row as any).pcs_index || 1}`;
        const batchKey = `${h.nomor_mc}__${h.potongan_ke}`;
        
        if (!pendingMendingGroups.has(pcsKey)) {
          if (!uniquePairs.has(batchKey)) {
            uniquePairs.set(batchKey, { nomor_mc: h.nomor_mc, design_id: h.design_id, potongan_ke: h.potongan_ke });
          }
        }
      }
    }

    return { success: true, data: Array.from(uniquePairs.values()) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchPendingFinalInspectionBatches(params: {
  date?: string;
  nomor_mc?: string;
  potongan_ke?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const supabase = await createClient();
    const page = params.page || 1;
    const limit = params.limit || 15;

    // 1. Fetch completed final inspection batches
    const { data: doneFinal } = await supabase
      .from("final_inspection_batches")
      .select("nomor_mc, design_id, potongan_ke, pcs_index");

    const doneSet = new Set<string>();
    (doneFinal || []).forEach((f: any) => {
      doneSet.add(`${f.nomor_mc}_${f.design_id}_${f.potongan_ke}_${f.pcs_index || 1}`);
    });

    // 2. Query mending_batches
    let query = supabase
      .from("mending_batches")
      .select(`
        id,
        nomor_mc,
        design_id,
        potongan_ke,
        pcs_index,
        tanggal_mending,
        petugas_mending,
        start_mending,
        finish_mending,
        elapsed_seconds,
        pause_seconds,
        total_panel,
        mending_grade_a,
        mending_grade_b,
        mending_grade_bs,
        keterangan_mending,
        created_at
      `)
      .order("tanggal_mending", { ascending: false })
      .order("created_at", { ascending: false });

    if (params.date && params.date.trim() !== "") {
      query = query.eq("tanggal_mending", params.date.trim());
    }
    if (params.nomor_mc && params.nomor_mc.trim() !== "") {
      query = query.ilike("nomor_mc", `%${params.nomor_mc.trim()}%`);
    }
    if (params.potongan_ke && params.potongan_ke.trim() !== "") {
      const pNum = parseInt(params.potongan_ke.trim().replace(/\D/g, ""), 10);
      if (!isNaN(pNum)) {
        query = query.eq("potongan_ke", pNum);
      }
    }

    const { data: mendingList, error: mendingErr } = await query;
    if (mendingErr) {
      return { success: false, error: mendingErr.message };
    }

    // 3. Exclude batches already completed in final_inspection
    const pendingBatches = (mendingList || []).filter((mb: any) => {
      const key = `${mb.nomor_mc}_${mb.design_id}_${mb.potongan_ke}_${mb.pcs_index || 1}`;
      return !doneSet.has(key);
    });

    // Extract elapsedSec for duration formatting
    const formattedData = pendingBatches.map((batch: any) => {
      let elapsedSec = batch.elapsed_seconds;
      if (elapsedSec === undefined || elapsedSec === null) {
        const match = (batch.keterangan_mending || "").match(/\[ELAPSED:(\d+)\]/);
        if (match && match[1]) {
          elapsedSec = parseInt(match[1], 10);
        }
      }
      return {
        ...batch,
        elapsed_seconds: elapsedSec,
      };
    });

    const total = formattedData.length;
    const from = (page - 1) * limit;
    const paginatedData = formattedData.slice(from, from + limit);

    return {
      success: true,
      data: paginatedData,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingFinalInspectionDetailsByDate(tanggal: string) {
  try {
    const supabase = await createClient();
    
    // 1. Ambil batch final inspection yang sudah selesai
    const { data: doneFinal } = await supabase
      .from("final_inspection_batches")
      .select("nomor_mc, design_id, potongan_ke, pcs_index");

    const doneSet = new Set<string>();
    (doneFinal || []).forEach((f: any) => {
      doneSet.add(`${f.nomor_mc}_${f.design_id}_${f.potongan_ke}_${f.pcs_index || 1}`);
    });

    // 2. Query mending batches (riwayat mending yang sudah ada)
    let mendingQuery = supabase
      .from("mending_batches")
      .select(`
        id,
        nomor_mc,
        design_id,
        potongan_ke,
        pcs_index,
        tanggal_mending,
        petugas_mending,
        start_mending,
        finish_mending,
        total_panel,
        mending_grade_a,
        mending_grade_b,
        mending_grade_bs,
        keterangan_mending,
        items:mending_items!inner (
          id, hasil_mending,
          detail:production_details!inner (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, jml_hasil_produksi, kategori_masalah, detail_masalah, keterangan_cacat, indikator_stop, status_inspeksi, status_mending, status_final_mending, is_deleted,
            production_headers:production_headers!inner (
              id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, meter_awal, meter_akhir,
              operators(nama_operator), groups(nama_grup)
            )
          )
        )
      `)
      .order("tanggal_mending", { ascending: false });

    if (tanggal && tanggal !== "all" && tanggal.trim() !== "") {
      mendingQuery = mendingQuery.eq("tanggal_mending", tanggal.trim());
    }

    const { data: mendingBatches, error } = await mendingQuery;
    if (error) return { success: false, error: error.message };
    if (!mendingBatches || mendingBatches.length === 0) return { success: true, data: [], pendingCount: 0 };

    // 3. Filter batch yang belum selesai di Final Inspection
    const pendingBatches = mendingBatches.filter((b: any) => {
      const key = `${b.nomor_mc}_${b.design_id}_${b.potongan_ke}_${b.pcs_index || 1}`;
      return !doneSet.has(key);
    });

    // Flatten to list of details with mending info attached
    const flattenedDetails: any[] = [];
    pendingBatches.forEach((batch: any) => {
      (batch.items || []).forEach((it: any) => {
        if (it.detail) {
          flattenedDetails.push({
            ...it.detail,
            tanggal_mending: batch.tanggal_mending,
            petugas_mending: batch.petugas_mending,
            mending_grade: it.hasil_mending || it.detail.status_mending,
            mending_batch: {
              id: batch.id,
              tanggal_mending: batch.tanggal_mending,
              petugas_mending: batch.petugas_mending,
              mending_grade_a: batch.mending_grade_a,
              mending_grade_b: batch.mending_grade_b,
              mending_grade_bs: batch.mending_grade_bs,
              total_panel: batch.total_panel,
            }
          });
        }
      });
    });

    return {
      success: true,
      data: flattenedDetails,
      pendingCount: pendingBatches.length,
      batches: pendingBatches,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getFinalInspectionDetailsByGroup(nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("production_details")
      .select(`
        id, 
        pcs_index, 
        jml_hasil_produksi, 
        kategori_masalah, 
        detail_masalah, 
        keterangan_cacat, 
        keterangan_qc,
        meter_kain, 
        roll_no, 
        indikator_stop, 
        final_inspection_id, 
        status_inspeksi,
        status_mending,
        status_final_mending,
        is_deleted,
        header_id,
        production_defects(*),
        production_headers!inner (
          id, tanggal_jam, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)
        ),
        qc_inspection_items (
          qc_inspection_batches (berat_kain, inspeksi_ceklis, inspeksi_silang)
        ),
        mending_items (
          mending_batches (tanggal_mending, petugas_mending, start_mending, finish_mending, mending_grade_a, mending_grade_b, mending_grade_bs)
        )
      `)
      .eq("production_headers.nomor_mc", nomor_mc)
      .eq("production_headers.potongan_ke", potongan_ke);

    const isTricote = String(nomor_mc || "").trim().toUpperCase().startsWith("T");
    if (!isTricote && pcs_index) {
      query = query.eq("pcs_index", pcs_index);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: true, data: [] };
    }

    data.sort((a: any, b: any) => {
      const isMeterA = a.production_headers?.panel_no === "METERAN";
      const isMeterB = b.production_headers?.panel_no === "METERAN";
      if (isMeterA && isMeterB) {
        const mA = parseFloat(a.meter_kain || "0");
        const mB = parseFloat(b.meter_kain || "0");
        if (mA !== mB) return mA - mB;
        return (a.id || "").localeCompare(b.id || "");
      }
      const pNoA = a.production_headers?.panel_no;
      const pNoB = b.production_headers?.panel_no;
      return String(pNoA || "").localeCompare(String(pNoB || ""), undefined, { numeric: true });
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitFinalInspection(params: {
  details: { detailId: string; grade: string }[];
  petugas_final: string;
  petugas_final_2?: string;
  petugas_final_3?: string;
  tanggal_final: string;
  start_final: string;
  finish_final: string;
  final_grade_a: number;
  final_grade_b: number;
  final_grade_bs: number;
  berat_kain?: number;
  notes?: string;
  pause_seconds?: number;
  elapsed_seconds?: number;
}) {
  try {
    const supabase = await createClient();
    
    // 1. Bulk update status_final_mending in production_details
    for (const d of params.details) {
      if (d.grade === "Dihapus") {
        await supabase
          .from("production_details")
          .update({
            is_deleted: true,
            status_final_mending: "Dihapus"
          })
          .eq("id", d.detailId);
      } else {
        const { error: updateError } = await supabase
          .from("production_details")
          .update({ status_final_mending: d.grade })
          .eq("id", d.detailId);
          
        if (updateError) {
          console.error("Gagal update status_final_mending:", updateError);
        }
      }
    }

    // Ambil info header dari item pertama
    let headerInfo = { nomor_mc: "", design_id: "", potongan_ke: 0, pcs_index: 0 };
    if (params.details.length > 0) {
      const { data: firstDetail } = await supabase
        .from("production_details")
        .select(`
          pcs_index,
          production_headers!inner (nomor_mc, design_id, potongan_ke)
        `)
        .eq("id", params.details[0].detailId)
        .single();
        
      if (firstDetail) {
        headerInfo = {
          pcs_index: firstDetail.pcs_index || 0,
          nomor_mc: (firstDetail.production_headers as any)?.nomor_mc || "",
          design_id: (firstDetail.production_headers as any)?.design_id || "",
          potongan_ke: (firstDetail.production_headers as any)?.potongan_ke || 0
        };
      }
    }

    // 2. Insert ke tabel final_inspection_batches (Header)
    let ketFinal = params.notes || "";
    if (params.elapsed_seconds !== undefined && params.elapsed_seconds !== null) {
      ketFinal += ` [ELAPSED:${params.elapsed_seconds}]`;
    }
    if (params.pause_seconds !== undefined && params.pause_seconds !== null) {
      ketFinal += ` [PAUSE:${params.pause_seconds}]`;
    }

    const insertPayload: any = {
      tanggal_final: params.tanggal_final,
      petugas_final: params.petugas_final,
      petugas_final_2: params.petugas_final_2 || null,
      petugas_final_3: params.petugas_final_3 || null,
      start_final: params.start_final,
      finish_final: params.finish_final,
      keterangan_final: ketFinal.trim(),
      total_panel: params.details.filter(d => d.grade !== "Dihapus").length,
      nomor_mc: headerInfo.nomor_mc,
      design_id: headerInfo.design_id,
      potongan_ke: headerInfo.potongan_ke,
      pcs_index: headerInfo.pcs_index,
      final_grade_a: params.final_grade_a,
      final_grade_b: params.final_grade_b,
      final_grade_bs: params.final_grade_bs,
      berat_kain: params.berat_kain || 0,
      pause_seconds: params.pause_seconds || 0,
      elapsed_seconds: params.elapsed_seconds || 0,
    };

    const { data: batchData, error: batchError } = await supabase
      .from("final_inspection_batches")
      .insert(insertPayload)
      .select("id")
      .single();

    if (batchError || !batchData) {
      console.error("Gagal insert final_inspection_batches:", batchError);
      return { success: false, error: batchError?.message || "Gagal insert final_inspection_batches" };
    }

    const batchId = batchData.id;

    // 3. Insert ke tabel final_inspection_items (Detail)
    const itemInserts = params.details.map(d => ({
      batch_id: batchId,
      production_detail_id: d.detailId,
      hasil_final: d.grade
    }));

    const { error: itemsError } = await supabase
      .from("final_inspection_items")
      .insert(itemInserts);

    if (itemsError) {
      console.error("Gagal insert final_inspection_items:", itemsError);
      await supabase.from("final_inspection_batches").delete().eq("id", batchId);
      return { success: false, error: itemsError.message };
    }

    revalidatePath("/final-inspection");
    revalidatePath("/final-inspection/history");
    revalidatePath("/reports/mending-production");
    revalidatePath("/reports/mending-potong");
    revalidatePath("/reports/monthly-machine");

    return { success: true, batchId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchFinalInspectionHistory(
  filters: {
    date?: string;
    nomor_mc?: string;
    petugas_ids?: string[];
    design_id?: string;
    potongan_ke?: string;
    no_customer?: string;
    page?: number;
    limit?: number;
  }
) {
  try {
    const supabase = await createClient();
    const page = filters.page || 1;
    const limit = filters.limit || 15;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("final_inspection_batches")
      .select(`
        id,
        tanggal_final,
        start_final,
        finish_final,
        elapsed_seconds,
        pause_seconds,
        nomor_mc,
        design_id,
        potongan_ke,
        pcs_index,
        petugas_final,
        final_grade_a,
        final_grade_b,
        final_grade_bs,
        total_panel,
        keterangan_final,
        created_at
      `, { count: "exact" });

    if (filters.date) {
      query = query.eq("tanggal_final", filters.date);
    }
    if (filters.nomor_mc) {
      query = query.eq("nomor_mc", filters.nomor_mc);
    }
    if (filters.design_id) {
      query = query.ilike("design_id", `%${filters.design_id}%`);
    }
    if (filters.potongan_ke) {
      query = query.eq("potongan_ke", parseInt(filters.potongan_ke));
    }
    if (filters.petugas_ids && filters.petugas_ids.length > 0) {
      query = query.in("petugas_final", filters.petugas_ids);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getFinalInspectionBatchById(batchId: string | number) {
  try {
    const supabase = await createClient();
    const bId = typeof batchId === "string" ? parseInt(batchId) : batchId;

    const { data: batch, error: batchError } = await supabase
      .from("final_inspection_batches")
      .select("*")
      .eq("id", bId)
      .single();

    if (batchError) return { success: false, error: batchError.message };

    const { data: items, error: itemsError } = await supabase
      .from("final_inspection_items")
      .select(`
        id,
        hasil_final,
        production_detail_id,
        production_details (
          id,
          pcs_index,
          jml_hasil_produksi,
          kategori_masalah,
          detail_masalah,
          keterangan_cacat,
          keterangan_qc,
          meter_kain,
          roll_no,
          indikator_stop,
          status_inspeksi,
          status_mending,
          status_final_mending,
          is_deleted,
          production_defects (*),
          production_headers (
            id,
            panel_no,
            nomor_mc,
            tgl,
            tanggal_jam,
            tanggal_potong,
            pick,
            no_order_barang,
            design_id,
            potongan_ke,
            course,
            rpm,
            no_customer,
            jenis_benang_dasar,
            liner,
            heavy,
            shadow,
            pinggiran,
            status_matching,
            operator_backup,
            operators ( nama_operator ),
            groups ( nama_grup )
          )
        )
      `)
      .eq("batch_id", bId);

    if (itemsError) return { success: false, error: itemsError.message };

    return { success: true, batch, items: items || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateFinalInspectionDetailGrade(
  detailId: string,
  grade: string,
  notes?: string,
  batchId?: number
) {
  try {
    const supabase = await createClient();

    const { error: detailError } = await supabase
      .from("production_details")
      .update({ status_final_mending: grade })
      .eq("id", detailId);

    if (detailError) return { success: false, error: detailError.message };

    if (batchId) {
      await supabase
        .from("final_inspection_items")
        .update({ hasil_final: grade })
        .eq("batch_id", batchId)
        .eq("production_detail_id", detailId);
    }

    revalidatePath("/final-inspection");
    revalidatePath("/final-inspection/history");
    revalidatePath("/reports/mending-production");
    revalidatePath("/reports/mending-potong");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
