"use server";

import { createClient } from "@/lib/supabase/server";

export async function getAvailableMendingFilters() {
  try {
    const supabase = await createClient();
    
    // Step 1: Get all items that haven't been mended yet (pending mending)
    const { data: pendingMending, error: err1 } = await supabase
      .from("production_details")
      .select(`
        pcs_index,
        production_headers!inner (
          nomor_mc,
          design_id,
          potongan_ke
        )
      `)
      .not("final_inspection_id", "is", null)
      .is("status_mending", null);

    if (err1) {
      if (err1.message.includes("status_mending")) {
        return { success: false, error: "Tabel belum memiliki kolom status_mending. Harap jalankan script SQL migrasi." };
      }
      return { success: false, error: err1.message };
    }

    // Step 2: Get all items still pending inspection (not yet inspected)
    const { data: pendingInspection, error: err2 } = await supabase
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
      .is("final_inspection_id", null)
      .eq("is_deleted", false);

    if (err2) return { success: false, error: err2.message };

    // Build set of PCS groups that still have uninspected items
    const pendingInspGroups = new Set<string>();
    for (const row of pendingInspection || []) {
      const h = (row as any).production_headers;
      if (h) {
        const isMeteran = h.panel_no === "METERAN";
        if (isMeteran) {
          // Untuk meteran, hanya dianggap pending inspeksi jika ada cacat/masalah
          const kat = (row as any).kategori_masalah;
          if (kat && kat.trim() !== "") {
            pendingInspGroups.add(`${h.nomor_mc}__${h.potongan_ke}__${(row as any).pcs_index || 1}`);
          }
        } else {
          pendingInspGroups.add(`${h.nomor_mc}__${h.potongan_ke}__${(row as any).pcs_index || 1}`);
        }
      }
    }

    // Build mending filters: include batch if it has at least one PCS that is FULLY inspected and pending mending
    const uniquePairs = new Map();
    for (const row of pendingMending || []) {
      const h = (row as any).production_headers;
      if (h) {
        const pcsKey = `${h.nomor_mc}__${h.potongan_ke}__${(row as any).pcs_index || 1}`;
        const batchKey = `${h.nomor_mc}__${h.potongan_ke}`;
        
        // If this specific PCS is fully inspected
        if (!pendingInspGroups.has(pcsKey)) {
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

export async function getPendingMendingDetailsByBatch(mesin: string, designId: string, potonganKe: string) {
  try {
    const supabase = await createClient();
    
    const { data: headers, error: headerError } = await supabase
      .from("production_headers")
      .select("id, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_jam, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)")
      .eq("nomor_mc", mesin)
      .eq("potongan_ke", parseInt(potonganKe));

    if (headerError) return { success: false, error: headerError.message };
    if (!headers || headers.length === 0) return { success: true, data: [] };

    const headerIds = headers.map((h: any) => h.id);

    // Get ALL items in this batch to determine which PCS are fully inspected
    const { data: allItems, error: allError } = await supabase
      .from("production_details")
      .select("id, pcs_index, final_inspection_id, status_mending, header_id, kategori_masalah, is_deleted")
      .in("header_id", headerIds);

    if (allError) return { success: false, error: allError.message };

    // Find PCS indexes that still have uninspected items (final_inspection_id IS NULL and not deleted)
    const pcsWithPendingInspection = new Set<number>();
    for (const item of (allItems || []) as any[]) {
      const h = headers.find((h: any) => h.id === item.header_id);
      const isMeteran = h && h.panel_no === "METERAN";
      
      if (item.final_inspection_id === null && !item.is_deleted) {
        if (isMeteran) {
          // Jika tipe meteran, hanya dianggap pending inspeksi jika baris tersebut memang memiliki cacat/masalah
          if (item.kategori_masalah && item.kategori_masalah.trim() !== "") {
            pcsWithPendingInspection.add(item.pcs_index);
          }
        } else {
          pcsWithPendingInspection.add(item.pcs_index);
        }
      }
    }

    // Get inspected & unmended items (or deleted items), but only from fully-inspected PCS indexes
    const { data: details, error: detailsError } = await supabase
      .from("production_details")
      .select("id, pcs_index, jml_hasil_produksi, kategori_masalah, detail_masalah, keterangan_cacat, meter_kain, roll_no, indikator_stop, final_inspection_id, header_id, is_deleted, status_inspeksi, status_mending, qc_inspection_items(qc_inspection_batches(berat_kain)), production_defects(*)")
      .in("header_id", headerIds);

    if (detailsError) return { success: false, error: detailsError.message };

    // Filter out items from PCS indexes that are not fully inspected yet (lewati pengecekan ini untuk tipe METERAN)
    const filteredDetails = (details || []).filter((d: any) => {
      const isInspectedOrDeleted = d.final_inspection_id !== null || d.is_deleted === true || d.status_inspeksi === "Dihapus";
      const isPendingMendingOrDeleted = d.status_mending === null || d.status_mending === "Dihapus" || d.is_deleted === true;
      if (!isInspectedOrDeleted || !isPendingMendingOrDeleted) return false;

      const h = headers.find((h: any) => h.id === d.header_id);
      if (h && h.panel_no === "METERAN") {
        return true; // Tipe meteran tidak diblokir oleh pengecekan indeks PCS
      }
      return !pcsWithPendingInspection.has(d.pcs_index);
    });

    const detailsWithHeader = filteredDetails.map((d: any) => {
      const h = headers.find((h: any) => h.id === d.header_id);
      return { ...d, production_headers: h };
    });

    // Untuk jenis METERAN, hanya baris detail yang memiliki cacat/masalah (kategori_masalah tidak kosong) yang perlu diproses mending.
    const finalFiltered = detailsWithHeader.filter((d: any) => {
      const h = d.production_headers;
      if (h && h.panel_no === "METERAN") {
        return d.kategori_masalah !== null && d.kategori_masalah !== undefined && d.kategori_masalah.trim() !== "";
      }
      return true;
    });

    return { success: true, data: finalFiltered };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitMending(params: {
  details: { detailId: string; grade: string }[];
  petugas_mending: string;
  tanggal_mending: string;
  start_mending: string;
  finish_mending: string;
  mending_grade_a: number;
  mending_grade_b: number;
  mending_grade_bs: number;
  notes?: string;
  berat_kain?: number;
  pause_seconds?: number;
  elapsed_seconds?: number;
}) {
  try {
    const supabase = await createClient();
    
    // Bulk update status_mending in production_details
    for (const d of params.details) {
      if (d.grade === "Dihapus") {
        await supabase
          .from("production_details")
          .update({
            is_deleted: true,
            status_mending: "Dihapus"
          })
          .eq("id", d.detailId);
      } else {
        const { error: updateError } = await supabase
          .from("production_details")
          .update({ status_mending: d.grade })
          .eq("id", d.detailId);
          
        if (updateError) {
          console.error("Gagal update status mending:", updateError);
        }
      }
    }

    // Update berat_kain in qc_inspection_batches if berat_kain is provided
    if (params.berat_kain !== undefined) {
      const detailIds = params.details.map(d => d.detailId);
      const { data: qcItems } = await supabase
        .from("qc_inspection_items")
        .select("batch_id")
        .in("production_detail_id", detailIds);
        
      if (qcItems && qcItems.length > 0) {
        const batchIds = Array.from(new Set(qcItems.map(i => i.batch_id)));
        const { error: qcUpdateError } = await supabase
          .from("qc_inspection_batches")
          .update({ berat_kain: params.berat_kain })
          .in("id", batchIds);
          
        if (qcUpdateError) {
          console.error("Gagal update berat_kain di qc_inspection_batches:", qcUpdateError);
        }
      }
    }

    // Ambil info header dari item pertama (semua item dalam 1 form submit mending punya header yang sama)
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

    // 1. Insert ke tabel mending_batches (Header)
    let ketMending = params.notes || "";
    if (params.elapsed_seconds !== undefined && params.elapsed_seconds !== null) {
      ketMending += ` [ELAPSED:${params.elapsed_seconds}]`;
    }
    if (params.pause_seconds !== undefined && params.pause_seconds !== null) {
      ketMending += ` [PAUSE:${params.pause_seconds}]`;
    }

    const insertPayload: any = {
      tanggal_mending: params.tanggal_mending,
      petugas_mending: params.petugas_mending,
      start_mending: params.start_mending,
      finish_mending: params.finish_mending,
      keterangan_mending: ketMending.trim(),
      total_panel: params.details.filter(d => d.grade !== "Dihapus").length,
      nomor_mc: headerInfo.nomor_mc,
      design_id: headerInfo.design_id,
      potongan_ke: headerInfo.potongan_ke,
      pcs_index: headerInfo.pcs_index,
      mending_grade_a: params.mending_grade_a,
      mending_grade_b: params.mending_grade_b,
      mending_grade_bs: params.mending_grade_bs,
    };
    if (params.pause_seconds !== undefined) insertPayload.pause_seconds = params.pause_seconds;
    if (params.elapsed_seconds !== undefined) insertPayload.elapsed_seconds = params.elapsed_seconds;

    let { data: batchData, error: batchError } = await supabase
      .from("mending_batches")
      .insert(insertPayload)
      .select("id")
      .single();

    if (batchError && (batchError.message?.includes("pause_seconds") || batchError.message?.includes("elapsed_seconds") || batchError.code === "PGRST204")) {
      delete insertPayload.pause_seconds;
      delete insertPayload.elapsed_seconds;
      const retry = await supabase
        .from("mending_batches")
        .insert(insertPayload)
        .select("id")
        .single();
      batchData = retry.data;
      batchError = retry.error;
    }

    if (batchError || !batchData) {
      console.error("Gagal insert mending_batches:", batchError);
      return { success: false, error: batchError?.message || "Gagal insert mending_batches" };
    }

    const batchId = batchData.id;

    // 2. Insert ke tabel mending_items (Detail)
    const itemInserts = params.details.map(d => ({
      batch_id: batchId,
      production_detail_id: d.detailId,
      hasil_mending: d.grade
    }));

    const { error: itemsError } = await supabase
      .from("mending_items")
      .insert(itemInserts);

    if (itemsError) {
      console.error("Gagal insert mending_items:", itemsError);
      // Fallback: hapus batch jika items gagal
      await supabase.from("mending_batches").delete().eq("id", batchId);
      return { success: false, error: itemsError.message };
    }

    // Webhook logic
    try {
      const detailIds = params.details.map(d => d.detailId);
      const { data: detailRecordsRaw } = await supabase
        .from("production_details")
        .select("id, header_id, pcs_index")
        .in("id", detailIds);
      
      const detailRecords = (detailRecordsRaw || []) as any[];

      const sheetUrl = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
      if (sheetUrl && detailRecords && detailRecords.length > 0) {
        const payloadData = params.details.map(d => {
          const dbRecord = detailRecords.find((r: any) => r.id === d.detailId);

          return {
            id_header: dbRecord?.header_id || "",
            pcs_index: dbRecord?.pcs_index || "",
            petugas_mending: params.petugas_mending,
            waktu_mending: `${params.start_mending} - ${params.finish_mending}`,
            hasil_mending: d.grade,
            keterangan_mending: params.notes || "",
            tanggal_mending: params.tanggal_mending,
            berat_kain: params.berat_kain || 0,
            berat_mending: params.berat_kain || 0,
          };
        });

        const payload = {
          action: "update_mending",
          data: payloadData
        };

        console.log("[Mending Sheet Sync] Sending payload:", JSON.stringify(payload));

        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          redirect: "follow"
        }).then(async (res) => {
          const text = await res.text();
          console.log("[Mending Sheet Sync] Response status:", res.status, "body:", text);
        }).catch(err => console.error("Gagal sinkron Mending ke Google Sheets:", err));
      }
    } catch (sheetErr) {
      console.error("Error preparing Google Sheets sync for mending:", sheetErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Server error submitting mending:", err);
    return { success: false, error: err.message };
  }
}

export async function getAvailableHistoryMendingDesignPotongan() {
  try {
    const supabase = await createClient();
    // Only get records that have been mended (status_mending is not null)
    const { data: details, error } = await supabase.from("production_details").select("header_id").not("status_mending", "is", null);
    if (error) return { success: false, error: error.message };
    if (!details || details.length === 0) return { success: true, data: [] };
    
    const headerIds = Array.from(new Set(details.map((d: any) => d.header_id)));
    
    const { data: headers, error: headersError } = await supabase.from("production_headers").select("id, design_id, potongan_ke").in("id", headerIds);
    if (headersError) return { success: false, error: headersError.message };
    
    return { success: true, data: headers };
  } catch (err: any) { 
    return { success: false, error: err.message }; 
  }
}

export async function getMendingHistoryByBatch(designId: string, potonganKe: string) {
  try {
    const supabase = await createClient();
    
    const { data: headers, error: hErr } = await supabase.from("production_headers").select("id").eq("design_id", designId).eq("potongan_ke", parseInt(potonganKe));
    if (hErr) return { success: false, error: hErr.message };
    if (!headers || headers.length === 0) return { success: true, data: [] };
    
    const headerIds = headers.map((h: any) => h.id);
    
    const { data: details, error: dErr } = await supabase.from("production_details").select("id").in("header_id", headerIds).not("status_mending", "is", null);
    if (dErr) return { success: false, error: dErr.message };
    if (!details || details.length === 0) return { success: true, data: [] };
    
    const detailIds = details.map((d: any) => d.id);
    
    const { data: mendingData, error: mendingErr } = await supabase.from("mending_inspections").select(`
      *,
      production_details (
        id, pcs_index, final_inspection_id, status_mending, header_id, roll_no, keterangan_qc,
        production_headers (id, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang)
      )
    `).in("production_detail_id", detailIds).order("created_at", { ascending: false });
    
    if (mendingErr) return { success: false, error: mendingErr.message };
    
    const formattedData = (mendingData || []).map((row: any) => ({ 
      ...row, 
      detail: row.production_details || {}, 
      header: row.production_details?.production_headers || {} 
    }));
    
    return { success: true, data: formattedData };
  } catch (err: any) { 
    return { success: false, error: err.message }; 
  }
}

export async function searchMendingHistory(filters: {
  date?: string;
  nomor_mc?: string;
  petugas_ids?: string[];
  design_id?: string;
  potongan_ke?: string;
  no_customer?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === "your_supabase_anon_key_here") {
      return { success: true, data: [] };
    }

    const supabase = await createClient();
    
    let query = supabase
      .from("mending_batches")
      .select(`
        *,
        items:mending_items!inner (
          id, hasil_mending,
          detail:production_details!inner (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi, status_inspeksi, status_mending, indikator_stop, is_deleted,
            header:production_headers!inner (id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, no_customer, course, rpm, status_matching, operator_backup, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, operators(nama_operator), groups(nama_grup))
          )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.date) {
      query = query.eq("tanggal_mending", filters.date);
    }
    
    if (filters.nomor_mc) {
      query = query.ilike("nomor_mc", `%${filters.nomor_mc}%`);
    }

    if (filters.design_id) {
      query = query.ilike("design_id", `%${filters.design_id}%`);
    }
    
    if (filters.potongan_ke) {
      query = query.eq("potongan_ke", parseInt(filters.potongan_ke));
    }
    
    if (filters.no_customer) {
      query = query.ilike("items.detail.header.no_order_barang", `%${filters.no_customer}%`);
    }
    
    if (filters.petugas_ids && filters.petugas_ids.length > 0) {
      const orConds = filters.petugas_ids.map(p => `petugas_mending.eq."${p}"`).join(",");
      query = query.or(orConds);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 15;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error searching Mending history:", error);
      return { success: false, error: error.message };
    }

    const formattedData = (data || []).map((batch: any) => {
      const firstItem = batch.items && batch.items.length > 0 ? batch.items[0] : null;
      const header = firstItem?.detail?.header || {};
      
      let maxMeterAkhir = 0;
      (batch.items || []).forEach((item: any) => {
        const m = Number(item.detail?.header?.meter_akhir) || 0;
        if (m > maxMeterAkhir) {
          maxMeterAkhir = m;
        }
      });
      
      const formattedItems = (batch.items || []).map((item: any) => ({
        id: item.id,
        hasil_mending: item.hasil_mending,
        detail: item.detail || {},
        header: item.detail?.header || {}
      }));

      let elapsedSec = batch.elapsed_seconds;
      if (elapsedSec === undefined || elapsedSec === null) {
        const match = (batch.keterangan_mending || "").match(/\[ELAPSED:(\d+)\]/);
        if (match && match[1]) {
          elapsedSec = parseInt(match[1], 10);
        }
      }

      let pauseSec = batch.pause_seconds || 0;
      if (!pauseSec) {
        const matchP = (batch.keterangan_mending || "").match(/\[PAUSE:(\d+)\]/);
        if (matchP && matchP[1]) {
          pauseSec = parseInt(matchP[1], 10);
        }
      }

      return {
        ...batch,
        elapsed_seconds: elapsedSec,
        pause_seconds: pauseSec,
        header: {
          ...header,
          meter_akhir: maxMeterAkhir || header.meter_akhir
        },
        detail: { pcs_index: batch.pcs_index },
        items: formattedItems
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return { 
      success: true, 
      data: formattedData,
      total: count || 0,
      page,
      totalPages 
    };
  } catch (err: any) {
    console.error("Server action error in searchMendingHistory:", err);
    return { success: false, error: err.message };
  }
}

export async function getMendingBatchById(id: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mending_batches")
      .select(`
        *,
        items:mending_items!inner (
          id, hasil_mending,
          detail:production_details!inner (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi, status_inspeksi, status_mending, is_deleted,
            header:production_headers!inner (id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, no_customer, course, rpm, status_matching, operator_backup, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, operators(nama_operator), groups(nama_grup))
          )
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error getMendingBatchById:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Data mending tidak ditemukan." };
    }

    const firstItem = data.items && data.items.length > 0 ? data.items[0] : null;
    const header = firstItem?.detail?.header || {};

    let maxMeterAkhir = 0;
    (data.items || []).forEach((item: any) => {
      const m = Number(item.detail?.header?.meter_akhir) || 0;
      if (m > maxMeterAkhir) {
        maxMeterAkhir = m;
      }
    });

    const formattedItems = (data.items || []).map((item: any) => ({
      id: item.id,
      hasil_mending: item.hasil_mending,
      detail: item.detail || {},
      header: item.detail?.header || {}
    }));

    let elapsedSec = data.elapsed_seconds;
    if (elapsedSec === undefined || elapsedSec === null) {
      const match = (data.keterangan_mending || "").match(/\[ELAPSED:(\d+)\]/);
      if (match && match[1]) {
        elapsedSec = parseInt(match[1], 10);
      }
    }

    let pauseSec = data.pause_seconds || 0;
    if (!pauseSec) {
      const matchP = (data.keterangan_mending || "").match(/\[PAUSE:(\d+)\]/);
      if (matchP && matchP[1]) {
        pauseSec = parseInt(matchP[1], 10);
      }
    }

    const formatted = {
      ...data,
      elapsed_seconds: elapsedSec,
      pause_seconds: pauseSec,
      header: {
        ...header,
        meter_akhir: maxMeterAkhir || header.meter_akhir
      },
      detail: { pcs_index: data.pcs_index },
      items: formattedItems
    };

    return { success: true, data: formatted };
  } catch (err: any) {
    console.error("Server action error in getMendingBatchById:", err);
    return { success: false, error: err.message };
  }
}

export async function getAllDetailsForPcs(nomor_mc: string, design_id: string, potongan_ke: number, pcs_index: number) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("production_details")
      .select(`
        id, 
        pcs_index, 
        jml_hasil_produksi, 
        kategori_masalah, 
        detail_masalah, 
        keterangan_cacat, 
        meter_kain, 
        roll_no, 
        indikator_stop, 
        final_inspection_id, 
        status_inspeksi,
        status_mending,
        is_deleted,
        header_id,
        production_headers!inner (
          id, tanggal_jam, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)
        )
      `)
      .eq("production_headers.nomor_mc", nomor_mc)
      .eq("production_headers.potongan_ke", potongan_ke)
      .eq("pcs_index", pcs_index);

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingMendingDetailsByDate(tanggal: string) {
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
        meter_kain, 
        roll_no, 
        indikator_stop, 
        final_inspection_id, 
        status_inspeksi,
        status_mending,
        is_deleted,
        header_id,
        production_headers!inner (
          id, tanggal_jam, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)
        ),
        qc_inspection_items (
          qc_inspection_batches (berat_kain, inspeksi_ceklis, inspeksi_silang)
        )
      `)
      .not("final_inspection_id", "is", null)
      .is("status_mending", null)
      .limit(5000);

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: true, data: [] };

    let filteredData = data;
    if (tanggal && tanggal !== "all") {
      const groupsOnDate = new Set(data.filter((d: any) => d.production_headers?.tgl === tanggal).map((d: any) => `${d.production_headers?.nomor_mc}_${d.production_headers?.design_id}_${d.production_headers?.potongan_ke}_${d.pcs_index}`));
      filteredData = data.filter((d: any) => groupsOnDate.has(`${d.production_headers?.nomor_mc}_${d.production_headers?.design_id}_${d.production_headers?.potongan_ke}_${d.pcs_index}`));
    }

    // Sort by mesin -> design -> potongan -> pcs
    filteredData.sort((a: any, b: any) => {
      const hA = a.production_headers;
      const hB = b.production_headers;
      if (hA.nomor_mc !== hB.nomor_mc) return String(hA.nomor_mc).localeCompare(String(hB.nomor_mc));
      if (hA.potongan_ke !== hB.potongan_ke) return (hA.potongan_ke || 0) - (hB.potongan_ke || 0);
      return (a.pcs_index || 0) - (b.pcs_index || 0);
    });

    return { success: true, data: filteredData, pendingCount: filteredData.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getMendingDetailsByGroup(nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("production_details")
      .select(`
        id, 
        pcs_index, 
        jml_hasil_produksi, 
        kategori_masalah, 
        detail_masalah, 
        keterangan_cacat, 
        meter_kain, 
        roll_no, 
        indikator_stop, 
        final_inspection_id, 
        status_inspeksi,
        status_mending,
        is_deleted,
        header_id,
        production_headers!inner (
          id, tanggal_jam, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)
        ),
        qc_inspection_items (
          qc_inspection_batches (berat_kain, inspeksi_ceklis, inspeksi_silang)
        )
      `)
      .eq("production_headers.nomor_mc", nomor_mc)
      .eq("production_headers.potongan_ke", potongan_ke)
      .eq("pcs_index", pcs_index);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: true, data: [] };
    }

    data.sort((a: any, b: any) => {
      const panelA = a.production_headers?.panel_no;
      const panelB = b.production_headers?.panel_no;

      if (panelA === "METERAN" && panelB === "METERAN") {
        const meterA = parseFloat(a.meter_kain ?? "");
        const meterB = parseFloat(b.meter_kain ?? "");
        return (isNaN(meterA) ? 0 : meterA) - (isNaN(meterB) ? 0 : meterB);
      }
      if (panelA === "METERAN") return 1;
      if (panelB === "METERAN") return -1;

      const numA = parseInt(panelA, 10);
      const numB = parseInt(panelB, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }

      return String(panelA || "").localeCompare(
        String(panelB || ""),
        undefined,
        { numeric: true },
      );
    });

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getMendingReportOptions() {
  try {
    const supabase = await createClient();
    const [mendingRes, headersRes] = await Promise.all([
      supabase.from("mending_batches").select("nomor_mc, potongan_ke, design_id"),
      supabase.from("production_headers").select("nomor_mc")
    ]);
      
    const mendingData = mendingRes.data || [];
    const headerData = headersRes.data || [];
    
    const registeredMachines = [
      "R1", "R2", "R3", "R6", "R11", "R12", "R16",
      "T1C", "T2A", "R1C", "R2C", "R3B", "R5B",
      "Warping D6", "Winding"
    ];

    const allMesins = [
      ...registeredMachines,
      ...mendingData.map((d: any) => d.nomor_mc),
      ...headerData.map((d: any) => d.nomor_mc)
    ].filter(Boolean);

    const mesins = Array.from(new Set(allMesins)).sort((a: any, b: any) => 
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    );
    const potongans = Array.from(new Set(mendingData.map((d: any) => d.potongan_ke).filter(Boolean)));
    const designs = Array.from(new Set(mendingData.map((d: any) => d.design_id).filter(Boolean)));
    
    return { success: true, data: { mesins, potongans, designs } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getMendingReportData(nomor_mc?: string, potongan_ke?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("mending_batches")
      .select(`
        *,
        items:mending_items!inner (
          id, hasil_mending,
          detail:production_details!inner (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, jml_hasil_produksi, kategori_masalah, detail_masalah, keterangan_cacat, indikator_stop,
            header:production_headers!inner (
              id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, meter_awal, meter_akhir,
              operators(nama_operator), groups(nama_grup)
            ),
            qc_items:qc_inspection_items (
              batch:qc_inspection_batches (berat_kain, start_inspect, finish_inspect, petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3, tanggal_inspeksi)
            )
          )
        )
      `);
      
    if (nomor_mc && nomor_mc.trim() !== "") {
      query = query.eq("nomor_mc", nomor_mc.trim());
    }
    if (potongan_ke && potongan_ke.trim() !== "") {
      const pNum = parseInt(potongan_ke.trim().replace(/\D/g, ""), 10);
      if (!isNaN(pNum)) {
        query = query.eq("potongan_ke", pNum);
      }
    }
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    // Also fetch qc_inspection_batches as a reliable fallback matching by mc, potongan, pcs
    let qcBatchQuery = supabase
      .from("qc_inspection_batches")
      .select("id, nomor_mc, potongan_ke, pcs_index, berat_kain, start_inspect, finish_inspect, petugas_inspeksi, petugas_inspeksi_2, petugas_inspeksi_3, tanggal_inspeksi");
    if (nomor_mc) qcBatchQuery = qcBatchQuery.eq("nomor_mc", nomor_mc);
    if (potongan_ke) qcBatchQuery = qcBatchQuery.eq("potongan_ke", parseInt(potongan_ke));
    const { data: allQcBatches } = await qcBatchQuery;
    
    const formattedData = (data || []).map((batch: any) => {
      const firstItem = batch.items && batch.items.length > 0 ? batch.items[0] : null;
      const header = firstItem?.detail?.header || {};
      
      const formattedItems = (batch.items || []).map((item: any) => ({
        id: item.id,
        hasil_mending: item.hasil_mending,
        detail: item.detail || {},
        header: item.detail?.header || {},
        qc_batch: item.detail?.qc_items?.[0]?.batch || {}
      }));

      // Find first item with a populated qc_batch
      let resolvedQcBatch: any = {};
      for (const fi of formattedItems) {
        const qb = fi.qc_batch;
        if (qb && (qb.berat_kain !== undefined || qb.petugas_inspeksi || qb.tanggal_inspeksi || qb.start_inspect)) {
          resolvedQcBatch = qb;
          break;
        }
      }

      // Direct fallback from qc_inspection_batches table
      if ((!resolvedQcBatch.petugas_inspeksi && !resolvedQcBatch.start_inspect && !resolvedQcBatch.berat_kain) && allQcBatches) {
        const match = allQcBatches.find((qb: any) => 
          String(qb.nomor_mc) === String(batch.nomor_mc) &&
          Number(qb.potongan_ke) === Number(batch.potongan_ke) &&
          Number(qb.pcs_index || 1) === Number(batch.pcs_index || 1)
        );
        if (match) {
          resolvedQcBatch = match;
        }
      }

      return {
        ...batch,
        header,
        detail: { pcs_index: batch.pcs_index },
        items: formattedItems,
        qc_batch: resolvedQcBatch
      };
    });

    return { success: true, data: formattedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}



export async function getMechanicDowntimesForReport(tanggal?: string, nomor_mc?: string) {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("downtime_records")
      .select(`
        id,
        kategori,
        detail,
        durasi_detik,
        dikerjakan_oleh,
        blok,
        header_id,
        production_headers!inner (
          id,
          tanggal_jam,
          panel_no,
          nomor_mc,
          potongan_ke,
          design_id,
          tgl,
          groups ( nama_grup )
        )
      `)
      .eq("production_headers.panel_no", "Downtime Mekanik (Direct)");

    if (nomor_mc) {
      query = query.eq("production_headers.nomor_mc", nomor_mc);
    }
    if (tanggal) {
      query = query.eq("production_headers.tgl", tanggal);
    }
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
