"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function searchPendingQCHeaders(designId: string, potonganKe: string) {
  try {
    const supabase = await createClient();

    // We want to find production_headers matching designId and potonganKe
    // that have pending details.
    const { data, error } = await supabase
      .from("production_headers")
      .select(`
        id,
        panel_no,
        nomor_mc,
        pic,
        tanggal_jam,
        operators ( nama_operator )
      `)
      .eq("design_id", designId)
      .eq("potongan_ke", parseInt(potonganKe));

    if (error) {
      return { success: false, error: error.message };
    }

    // Since we can't easily filter by "has pending details" in a single query without RPC or complex joins,
    // we fetch headers, then check their details.
    if (!data || data.length === 0) {
      return { success: true, data: [] };
    }

    const headerIds = data.map((h: any) => h.id);

    const { data: detailsData, error: detailsError } = await supabase
      .from("production_details")
      .select("header_id")
      .in("header_id", headerIds)
      .is("status_inspeksi", null);

    if (detailsError) {
      return { success: false, error: detailsError.message };
    }

    // Filter headers that actually have pending details
    const headersWithPending = new Set(detailsData?.map((d: any) => d.header_id));
    const pendingHeaders = data.filter((h: any) => headersWithPending.has(h.id));

    return { success: true, data: pendingHeaders };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingQCDetails(headerId: string) {
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
        keterangan_qc,
        production_defects(*)
      `)
      .eq("header_id", headerId)
      .is("status_inspeksi", null)
      .order("pcs_index", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitQCInspection(params: {
  details: { detailId: string; finalInspectionId: number }[];
  petugas_inspeksi: string;
  petugas_inspeksi_2?: string;
  petugas_inspeksi_3?: string;
  tanggal_inspeksi: string;
  start_inspect: string;
  finish_inspect: string;
  berat_kain?: number | null;
  prod_ceklis: number;
  prod_silang: number;
  qc_ceklis: number;
  qc_silang: number;
  notes?: string;
  tanggal_potong?: string;
  pause_seconds?: number;
  elapsed_seconds?: number;
}) {
  try {
    const supabase = await createClient();

    // 1. Dapatkan informasi mesin, dll dari production_details
    const detailIds = params.details.map(d => d.detailId);
    const { data: detailsInfo } = await supabase
      .from("production_details")
      .select("pcs_index, production_headers(nomor_mc, design_id, potongan_ke)")
      .in("id", detailIds)
      .limit(1)
      .single();

    let nomor_mc = null, design_id = null, potongan_ke = null, pcs_index = null;
    if (detailsInfo) {
      pcs_index = detailsInfo.pcs_index;
      if (detailsInfo.production_headers) {
        nomor_mc = (detailsInfo.production_headers as any).nomor_mc;
        design_id = (detailsInfo.production_headers as any).design_id;
        potongan_ke = (detailsInfo.production_headers as any).potongan_ke;
      }
    }

    // 2. Insert ke qc_inspection_batches
    const insertPayload: any = {
      tanggal_inspeksi: params.tanggal_inspeksi,
      start_inspect: params.start_inspect,
      finish_inspect: params.finish_inspect,
      petugas_inspeksi: params.petugas_inspeksi,
      petugas_inspeksi_2: params.petugas_inspeksi_2 || null,
      petugas_inspeksi_3: params.petugas_inspeksi_3 || null,
      nomor_mc,
      design_id,
      potongan_ke,
      pcs_index,
      berat_kain: params.berat_kain,
      inspeksi_ceklis: params.qc_ceklis,
      inspeksi_silang: params.qc_silang,
    };
    if (params.pause_seconds !== undefined) insertPayload.pause_seconds = params.pause_seconds;
    if (params.elapsed_seconds !== undefined) insertPayload.elapsed_seconds = params.elapsed_seconds;

    let { data: batchData, error: batchError } = await supabase
      .from("qc_inspection_batches")
      .insert(insertPayload)
      .select("id")
      .single();

    if (batchError && (batchError.message?.includes("pause_seconds") || batchError.message?.includes("elapsed_seconds") || batchError.code === "PGRST204")) {
      delete insertPayload.pause_seconds;
      delete insertPayload.elapsed_seconds;
      const retry = await supabase
        .from("qc_inspection_batches")
        .insert(insertPayload)
        .select("id")
        .single();
      batchData = retry.data;
      batchError = retry.error;
    }

    if (batchError || !batchData) {
      throw new Error("Gagal menyimpan data induk batch inspeksi: " + (batchError?.message || "Unknown error"));
    }

    // 3. Insert ke qc_inspection_items
    const qcItemsData = params.details.map(d => ({
      batch_id: batchData.id,
      production_detail_id: d.detailId,
      final_inspection_id: d.finalInspectionId
    }));

    const { error: insertError } = await supabase
      .from("qc_inspection_items")
      .insert(qcItemsData);

    if (insertError) {
      throw new Error("Gagal menyimpan data rincian inspeksi: " + insertError.message);
    }

      // Bulk update final_inspection_id in production_details
      // Supabase JS doesn't have a direct bulk update via array easily,
      // so we iterate (it's safe enough for a few dozen rows)
      for (const d of params.details) {
        if (d.finalInspectionId === 0 || d.finalInspectionId === null) {
          await supabase
            .from("production_details")
            .update({
              is_deleted: true,
              status_inspeksi: "Dihapus",
              keterangan_qc: params.notes || null
            })
            .eq("id", d.detailId);
        } else {
          let statusInspeksi = "Ceklis";
          if (d.finalInspectionId === 3) statusInspeksi = "Silang";
          if (d.finalInspectionId === 4) statusInspeksi = "BS";
          
          const { error: updateError } = await supabase
            .from("production_details")
            .update({
              final_inspection_id: d.finalInspectionId,
              status_inspeksi: statusInspeksi,
              keterangan_qc: params.notes || null
            })
            .eq("id", d.detailId);

          if (updateError) {
            throw new Error("Gagal mengupdate status detail: " + updateError.message);
          }
        }
      }

      // 4. Khusus Mesin Tricote / Awalan "T": Auto-Mending & Langsung Masuk Laporan Produksi
      const isTricoteMachine = String(nomor_mc || "").trim().toUpperCase().startsWith("T");
      if (isTricoteMachine) {
        try {
          let countA = 0;
          let countB = 0;
          let countBS = 0;
          const mendingItemsPayload: any[] = [];

          for (const d of params.details) {
            let mendingGrade = "A";
            if (d.finalInspectionId === 0 || d.finalInspectionId === null) {
              mendingGrade = "Dihapus";
            } else if (d.finalInspectionId === 4) {
              mendingGrade = "BS";
              countBS += 1;
            } else if (d.finalInspectionId === 3) {
              mendingGrade = "B";
              countB += 1;
            } else {
              mendingGrade = "A";
              countA += 1;
            }

            await supabase
              .from("production_details")
              .update({ status_mending: mendingGrade })
              .eq("id", d.detailId);

            mendingItemsPayload.push({
              production_detail_id: d.detailId,
              hasil_mending: mendingGrade,
            });
          }

          let ketMending = params.notes ? `${params.notes} (Auto-Mending Tricote)` : "Otomatis Selesai (Mesin Tricote / Awalan T)";
          if (params.elapsed_seconds !== undefined && params.elapsed_seconds !== null) {
            ketMending += ` [ELAPSED:${params.elapsed_seconds}]`;
          }
          if (params.pause_seconds !== undefined && params.pause_seconds !== null) {
            ketMending += ` [PAUSE:${params.pause_seconds}]`;
          }

          const mendingInsertPayload: any = {
            tanggal_mending: params.tanggal_inspeksi,
            petugas_mending: params.petugas_inspeksi,
            start_mending: params.start_inspect,
            finish_mending: params.finish_inspect,
            keterangan_mending: ketMending.trim(),
            total_panel: params.details.filter(d => d.finalInspectionId !== 0).length,
            nomor_mc,
            design_id,
            potongan_ke,
            pcs_index,
            mending_grade_a: countA,
            mending_grade_b: countB,
            mending_grade_bs: countBS,
          };
          if (params.pause_seconds !== undefined) mendingInsertPayload.pause_seconds = params.pause_seconds;
          if (params.elapsed_seconds !== undefined) mendingInsertPayload.elapsed_seconds = params.elapsed_seconds;

          let { data: mBatchData, error: mBatchError } = await supabase
            .from("mending_batches")
            .insert(mendingInsertPayload)
            .select("id")
            .single();

          if (mBatchError && (mBatchError.message?.includes("pause_seconds") || mBatchError.message?.includes("elapsed_seconds") || mBatchError.code === "PGRST204")) {
            delete mendingInsertPayload.pause_seconds;
            delete mendingInsertPayload.elapsed_seconds;
            const retry = await supabase
              .from("mending_batches")
              .insert(mendingInsertPayload)
              .select("id")
              .single();
            mBatchData = retry.data;
            mBatchError = retry.error;
          }

          if (!mBatchError && mBatchData) {
            const mItemsToInsert = mendingItemsPayload.map(item => ({
              batch_id: mBatchData.id,
              production_detail_id: item.production_detail_id,
              hasil_mending: item.hasil_mending,
            }));

            await supabase.from("mending_items").insert(mItemsToInsert);
          }
        } catch (autoMendingErr) {
          console.error("Gagal menjalankan auto-mending untuk mesin Tricote:", autoMendingErr);
        }
      }

      // Sync to Google Sheets
      try {
        const detailIds = params.details.map(d => d.detailId);
        const { data: detailRecordsRaw } = await supabase
          .from("production_details")
          .select("id, header_id, pcs_index")
          .in("id", detailIds);

        const detailRecords = (detailRecordsRaw || []) as any[];

        // Update tanggal_potong on production_headers
        if (params.tanggal_potong) {
          const uniqueHeaderIds = Array.from(new Set(detailRecords.map(r => r.header_id))).filter(Boolean);
          if (uniqueHeaderIds.length > 0) {
            const { error: updateHeaderError } = await supabase
              .from("production_headers")
              .update({ tanggal_potong: params.tanggal_potong })
              .in("id", uniqueHeaderIds);

            if (updateHeaderError) {
              console.error("Gagal update tanggal potong:", updateHeaderError);
            }
          }
        }

        const sheetUrl = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
        if (sheetUrl && detailRecords && detailRecords.length > 0) {
          const payloadData = params.details.map(d => {
            const dbRecord = detailRecords.find((r: any) => r.id === d.detailId);
            let gradeStr = "";
            if (d.finalInspectionId === 1) gradeStr = "Ceklis";
            else if (d.finalInspectionId === 2 || d.finalInspectionId === 3) gradeStr = "Silang";
            else if (d.finalInspectionId === 4) gradeStr = "BS";

            return {
            id_header: dbRecord?.header_id || "",
            pcs_index: dbRecord?.pcs_index || "",
            petugas_qc1: params.petugas_inspeksi || "",
            petugas_qc2: params.petugas_inspeksi_2 || "",
            petugas_qc3: params.petugas_inspeksi_3 || "",
            tanggal_qc: params.tanggal_inspeksi || "",
            waktu_qc: `${params.start_inspect || ""} - ${params.finish_inspect || ""}`,
            hasil_qc: gradeStr,
            berat_kain: params.berat_kain,
            keterangan_qc: params.notes || "",
            prod_ceklis: params.prod_ceklis,
            prod_silang: params.prod_silang,
            qc_ceklis: params.qc_ceklis,
            qc_silang: params.qc_silang,
            tanggal_potong: params.tanggal_potong || "",
          };
        });

        const payload = {
          action: "update_qc",
          data: payloadData
        };

        console.log("[QC Sheet Sync] Sending payload:", JSON.stringify(payload));

        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          redirect: "follow"
        }).then(async (res) => {
          const text = await res.text();
          console.log("[QC Sheet Sync] Response status:", res.status, "body:", text);
        }).catch(err => console.error("[QC Sheet Sync] Fetch error:", err));
      }
    } catch (sheetErr) {
      console.error("Error preparing Google Sheets sync:", sheetErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Server error submitting QC inspection:", err);
    return { success: false, error: err.message };
  }
}

export async function getAvailableQCFilters() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("production_details").select(`
      header_id,
      production_headers!inner (
        nomor_mc,
        design_id,
        potongan_ke,
        tgl
      )
    `).is("status_inspeksi", null);

    if (error) return { success: false, error: error.message };

    const uniquePairs = new Map();
    for (const row of data || []) {
      const h = (row as any).production_headers;
      if (h) {
        const key = `${h.tgl}__${h.nomor_mc}__${h.design_id}__${h.potongan_ke}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { tgl: h.tgl, nomor_mc: h.nomor_mc, design_id: h.design_id, potongan_ke: h.potongan_ke });
        }
      }
    }

    return { success: true, data: Array.from(uniquePairs.values()) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingQCDetailsByBatch(mesin: string, designId: string, potonganKe: string, tanggal?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("production_headers")
      .select("id, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_jam, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup), production_details(id, pcs_index, meter_kain, detail_masalah)")
      .eq("nomor_mc", mesin)
      .eq("potongan_ke", parseInt(potonganKe));

    if (tanggal) {
      query = query.eq("tgl", tanggal);
    }

    const { data: headers, error: headerError } = await query;

    if (headerError) return { success: false, error: headerError.message };
    if (!headers || headers.length === 0) return { success: true, data: [] };

    const headerIds = headers.map((h: any) => h.id);

    const { data: details, error: detailsError } = await supabase
      .from("production_details")
      .select("id, pcs_index, jml_hasil_produksi, kategori_masalah, detail_masalah, keterangan_cacat, keterangan_qc, meter_kain, roll_no, indikator_stop, final_inspection_id, header_id, is_deleted, status_inspeksi, status_mending, production_defects(*)")
      .in("header_id", headerIds);

    if (detailsError) return { success: false, error: detailsError.message };

    const detailIds = (details || []).map((d: any) => d.id);
    const submittedIds = new Set<string>();
    if (detailIds.length > 0) {
      const { data: submittedItems } = await supabase
        .from("qc_inspection_items")
        .select("production_detail_id")
        .in("production_detail_id", detailIds);
      if (submittedItems && submittedItems.length > 0) {
        submittedItems.forEach((it: any) => submittedIds.add(it.production_detail_id));
      }
    }

    // Filter out details that have actually been submitted in qc_inspection_items
    const pendingDetails = (details || []).filter((d: any) => !submittedIds.has(d.id));

    // Auto-heal any details that had final_inspection_id set prematurely during draft edit
    const falselyCompleted = pendingDetails.filter((d: any) => d.final_inspection_id !== null);
    if (falselyCompleted.length > 0) {
      const falselyIds = falselyCompleted.map((d: any) => d.id);
      await supabase
        .from("production_details")
        .update({ final_inspection_id: null })
        .in("id", falselyIds);
    }

    const detailsWithHeader = pendingDetails.map((d: any) => {
      const h = headers.find((h: any) => h.id === d.header_id);
      return { ...d, final_inspection_id: null, production_headers: h };
    });

    const filteredDetails = detailsWithHeader;

    return { success: true, data: filteredDetails };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAllPendingQCDetails(
  tanggalOrFilters?: string | { tanggal?: string; mesin?: string; potongan?: string | number },
  mesinParam?: string,
  potonganParam?: string | number
) {
  try {
    const supabase = await createClient();

    let tanggal: string | undefined = undefined;
    let mesin: string | undefined = undefined;
    let potongan: string | number | undefined = undefined;

    if (typeof tanggalOrFilters === "object" && tanggalOrFilters !== null) {
      tanggal = tanggalOrFilters.tanggal;
      mesin = tanggalOrFilters.mesin;
      potongan = tanggalOrFilters.potongan;
    } else {
      tanggal = tanggalOrFilters;
      mesin = mesinParam;
      potongan = potonganParam;
    }

    let query = supabase
      .from("production_headers")
      .select("id, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, groups(nama_grup), operators(nama_operator), tanggal_jam")
      .order("tgl", { ascending: false });

    if (tanggal) {
      query = query.eq("tgl", tanggal);
    }
    if (mesin) {
      query = query.eq("nomor_mc", mesin);
    }
    if (potongan) {
      const parsedPotongan = typeof potongan === "number" ? potongan : parseInt(String(potongan), 10);
      if (!isNaN(parsedPotongan)) {
        query = query.eq("potongan_ke", parsedPotongan);
      }
    }

    // Only limit when no search filters are provided at all
    if (!tanggal && !mesin && !potongan) {
      query = query.limit(300);
    }

    const { data: headers, error: headerError } = await query;

    if (headerError) return { success: false, error: headerError.message };
    if (!headers || headers.length === 0) return { success: true, data: [] };

    const headerIds = headers.map((h: any) => h.id);

    const { data: details, error: detailsError } = await supabase
      .from("production_details")
      .select("id, pcs_index, jml_hasil_produksi, kategori_masalah, detail_masalah, keterangan_cacat, keterangan_qc, meter_kain, roll_no, indikator_stop, final_inspection_id, header_id")
      .in("header_id", headerIds);

    if (detailsError) return { success: false, error: detailsError.message };

    const detailIds = (details || []).map((d: any) => d.id);
    const submittedIds = new Set<string>();
    if (detailIds.length > 0) {
      const { data: submittedItems } = await supabase
        .from("qc_inspection_items")
        .select("production_detail_id")
        .in("production_detail_id", detailIds);
      if (submittedItems && submittedItems.length > 0) {
        submittedItems.forEach((it: any) => submittedIds.add(it.production_detail_id));
      }
    }

    const pendingDetails = (details || []).filter((d: any) => !submittedIds.has(d.id));

    const detailsWithHeader = pendingDetails.map((d: any) => {
      const h = headers.find((h: any) => h.id === d.header_id);
      return { ...d, production_headers: h };
    });

    const filteredDetails = detailsWithHeader;

    return { success: true, data: filteredDetails };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getQCHistory() {

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("qc_inspection_batches")
      .select(`
        *,
        qc_inspection_items (
          production_details (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, jml_hasil_produksi, status_inspeksi, status_mending, is_deleted,
            production_headers (
              id, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, status_matching
            )
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return { success: false, error: error.message };
    }

    const formattedData = (data || []).map((row: any) => {
      // Just extract the first item's details since they belong to the same batch headers essentially
      const firstItem = row.qc_inspection_items && row.qc_inspection_items.length > 0 ? row.qc_inspection_items[0] : null;
      const detail = firstItem?.production_details || {};
      const header = detail.production_headers || {};
      return {
        ...row,
        detail,
        header
      };
    });

    return { success: true, data: formattedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAvailableHistoryQCDesignPotongan() {
  try {
    const supabase = await createClient();
    const { data: details, error } = await supabase.from("production_details").select("header_id").not("final_inspection_id", "is", null);
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

export async function getQCHistoryByBatch(designId: string, potonganKe: string) {
  try {
    const supabase = await createClient();

    const { data: headers, error: hErr } = await supabase.from("production_headers").select("id").eq("design_id", designId).eq("potongan_ke", parseInt(potonganKe));
    if (hErr) return { success: false, error: hErr.message };
    if (!headers || headers.length === 0) return { success: true, data: [] };

    const headerIds = headers.map((h: any) => h.id);

    const { data: details, error: dErr } = await supabase.from("production_details").select("id").in("header_id", headerIds).not("final_inspection_id", "is", null);
    if (dErr) return { success: false, error: dErr.message };
    if (!details || details.length === 0) return { success: true, data: [] };

    const detailIds = details.map((d: any) => d.id);

    const { data: qcData, error: qcErr } = await supabase.from("qc_inspection_batches").select(`
      *,
      qc_inspection_items!inner (
        production_detail_id,
        production_details (
          id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, jml_hasil_produksi, status_inspeksi, status_mending, is_deleted, 
          production_headers (id, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, status_matching)
        )
      )
    `).in("qc_inspection_items.production_detail_id", detailIds).order("created_at", { ascending: false });

    if (qcErr) return { success: false, error: qcErr.message };

    const formattedData = (qcData || []).map((row: any) => {
      const firstItem = row.qc_inspection_items && row.qc_inspection_items.length > 0 ? row.qc_inspection_items[0] : null;
      return {
        ...row,
        detail: firstItem?.production_details || {},
        header: firstItem?.production_details?.production_headers || {}
      };
    });

    return { success: true, data: formattedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchQCHistory(
  filters: {
    date?: string;
    nomor_mc?: string;
    petugas_ids?: string[];
    design_id?: string;
    potongan_ke?: string;
    no_customer?: string;
  },
  includeDetails: boolean = false
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === "your_supabase_anon_key_here") {
      return { success: true, data: [] };
    }

    const supabase = await createClient();

    if (!includeDetails) {
      // Lightweight Query: Only fetch batch summary fields without massive nested details & defect joins
      let query = supabase
        .from("qc_inspection_batches")
        .select(`
          id,
          tanggal_inspeksi,
          start_inspect,
          finish_inspect,
          elapsed_seconds,
          pause_seconds,
          nomor_mc,
          design_id,
          potongan_ke,
          pcs_index,
          petugas_inspeksi,
          petugas_inspeksi_2,
          petugas_inspeksi_3,
          inspeksi_ceklis,
          inspeksi_silang,
          berat_kain,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters.date) {
        query = query.eq("tanggal_inspeksi", filters.date);
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

      if (filters.petugas_ids && filters.petugas_ids.length > 0) {
        const orConds = filters.petugas_ids.map(p => `petugas_inspeksi.eq."${p}",petugas_inspeksi_2.eq."${p}"`).join(",");
        query = query.or(orConds);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error searching QC history (lightweight):", error);
        return { success: false, error: error.message };
      }

      const formattedData = (data || []).map((batch: any) => ({
        ...batch,
        header: {
          nomor_mc: batch.nomor_mc,
          design_id: batch.design_id,
          potongan_ke: batch.potongan_ke,
        },
        detail: { pcs_index: batch.pcs_index },
        items: []
      }));

      return { success: true, data: formattedData };
    }

    // Full query with items & details
    let query = supabase
      .from("qc_inspection_batches")
      .select(`
        *,
        items:qc_inspection_items!inner (
          id, final_inspection_id,
          detail:production_details!inner (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi, status_inspeksi, status_mending, indikator_stop, is_deleted,
            header:production_headers!inner (id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, no_customer, course, rpm, status_matching, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, operator_backup, operators(nama_operator), groups(nama_grup))
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (filters.date) {
      query = query.eq("tanggal_inspeksi", filters.date);
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
      const orConds = filters.petugas_ids.map(p => `petugas_inspeksi.eq."${p}",petugas_inspeksi_2.eq."${p}"`).join(",");
      query = query.or(orConds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error searching QC history:", error);
      return { success: false, error: error.message };
    }

    // Format data to match the UI expectations
    const formattedData = (data || []).map((batch: any) => {
      const firstItem = batch.items && batch.items.length > 0 ? batch.items[0] : null;
      const header = firstItem?.detail?.header || {};

      const formattedItems = (batch.items || []).map((item: any) => ({
        id: item.id,
        final_inspection_id: item.final_inspection_id,
        detail: item.detail || {},
        header: item.detail?.header || {}
      }));

      return {
        ...batch,
        header,
        detail: { pcs_index: batch.pcs_index },
        items: formattedItems
      };
    });

    return { success: true, data: formattedData };
  } catch (err: any) {
    console.error("Server action error in searchQCHistory:", err);
    return { success: false, error: err.message };
  }
}

export async function addQCDefectDetail(params: {
  headerId: string;
  meterKain: string;
  rollNo?: string;
  kategoriMasalah: string[];
  detailMasalah?: string;
  keteranganCacat?: string;
  pcsIndex?: number;
  finalInspectionId?: number;
}) {
  try {
    const supabase = await createAdminClient();

    // Generate a unique detail id
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randId = "";
    for (let i = 0; i < 8; i++) {
      randId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const detailId = randId.toLowerCase();

    // Map kategoriMasalah array to comma-separated string
    const kategoriStr = params.kategoriMasalah && params.kategoriMasalah.length > 0
      ? params.kategoriMasalah.join(', ')
      : null;

    let statusInspeksi: string | null = null;
    if (params.finalInspectionId === 3) statusInspeksi = "Silang";
    else if (params.finalInspectionId === 4) statusInspeksi = "BS";
    else if (params.finalInspectionId === 1 || params.finalInspectionId === 2) statusInspeksi = "Ceklis";

    const parsedMeter = parseFloat(params.meterKain);
    if (isNaN(parsedMeter) || parsedMeter < 0) {
      return { success: false, error: "Posisi Meter Kain tidak boleh kurang dari 0." };
    }

    const { data, error } = await supabase
      .from("production_details")
      .insert({
        id: detailId,
        header_id: params.headerId,
        pcs_index: params.pcsIndex || 1,
        meter_kain: parsedMeter,
        roll_no: params.rollNo || null,
        kategori_masalah: kategoriStr,
        detail_masalah: params.detailMasalah || null,
        keterangan_cacat: params.keteranganCacat ? `${params.keteranganCacat} [TAMBAHAN QC]` : "[TAMBAHAN QC]",
        indikator_stop: true,
        final_inspection_id: params.finalInspectionId ?? null,
        status_inspeksi: statusInspeksi,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Sync new defect finding to Google Sheets
    try {
      const sheetUrl = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
      if (sheetUrl) {
        // Fetch header info for the payload
        const { data: headerData } = await supabase
          .from("production_headers")
          .select("*, groups(nama_grup)")
          .eq("id", params.headerId)
          .single();

        if (headerData) {
          const payload = [{
            "ID Laporan": detailId,
            "Tanggal Produksi": headerData.tgl || "",
            "Tanggal & Jam": headerData.tanggal_jam || new Date().toISOString(),
            "Tanggal Potong": headerData.tanggal_potong || "",
            "Mesin": headerData.nomor_mc || "",
            "Pick": headerData.pick || "",
            "Course": headerData.course || "",
            "RPM": headerData.rpm || "",
            "Operator": headerData.pic || headerData.created_by_name || "",
            "Grup": headerData.groups?.nama_grup || headerData.group_id || "",
            "Design": headerData.design_id || "",
            "Panel": headerData.panel_no || "METERAN",
            "Potongan Ke": headerData.potongan_ke || "",
            "No Order": headerData.no_order_barang || "",
            "No Customer": headerData.no_customer || "",
            "Total Downtime (Detik)": headerData.total_downtime_menit || 0,
            "Meter Awal": headerData.meter_awal || "",
            "Meter Akhir": headerData.meter_akhir || "",
            "Total Produksi Meter": headerData.hasil_produksi_meter || "",
            "PCS Ke": params.pcsIndex || 1,
            "Hasil PCS": 0,
            "Meter Kain": params.meterKain || "",
            "Roll No": params.rollNo || "",
            "Mesin Stop?": "Ya",
            "Kategori Masalah": kategoriStr || "",
            "Detail Masalah": params.detailMasalah || "",
            "Keterangan Cacat": params.keteranganCacat ? `[QC INSPEKSI] ${params.keteranganCacat}` : "[QC INSPEKSI]",
            "Penanggung Jawab": headerData.created_by_name || ""
          }];

          console.log("[QC Defect Sync] Sending payload:", JSON.stringify(payload));

          fetch(sheetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "insert_production", data: payload }),
            redirect: "follow"
          }).then(async (res) => {
            console.log("[QC Defect Sync] Sheet response status:", res.status);
          }).catch(err => console.error("[QC Defect Sync] Fetch error:", err));
        }
      }
    } catch (sheetErr) {
      console.error("Error syncing new QC defect to sheet:", sheetErr);
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingQCDetailsByDate(tanggal: string) {
  try {
    const supabase = await createClient();

    // We fetch details that have final_inspection_id IS NULL
    // and join with headers where tgl equals the given date
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
        header_id,
        production_defects(*),
        production_headers!inner (
          id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, no_customer, course, rpm, status_matching, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, operator_backup, operators(nama_operator), groups(nama_grup)
        )
      `)
      .is("final_inspection_id", null);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: [], pendingCount: 0 };
    }

    let filteredData = data;
    if (tanggal && tanggal !== "all") {
      const groupsOnDate = new Set(data.filter((d: any) => d.production_headers?.tgl === tanggal).map((d: any) => `${d.production_headers?.nomor_mc}_${d.production_headers?.potongan_ke}_${d.pcs_index || 1}`));
      filteredData = data.filter((d: any) => groupsOnDate.has(`${d.production_headers?.nomor_mc}_${d.production_headers?.potongan_ke}_${d.pcs_index || 1}`));
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

export async function deleteProductionDetailRow(detailId: string, mode: "shift" | "keep_slot" = "shift") {
  try {
    const supabase = await createAdminClient();

    if (mode === "keep_slot") {
      // Opsi 2: Tandai data rincian sebagai dihapus (slot & nomor panel tetap tidak bergeser)
      await supabase
        .from("production_defects")
        .delete()
        .eq("production_detail_id", detailId);

      const { error: updateErr } = await supabase
        .from("production_details")
        .update({
          is_deleted: true,
          status_inspeksi: "Dihapus",
          status_mending: "Dihapus",
          jml_hasil_produksi: 0,
          keterangan_cacat: "[DIHAPUS]",
          detail_masalah: "PANEL DIHAPUS",
          kategori_masalah: null,
          spesifik_masalah: null,
          final_inspection_id: null,
        })
        .eq("id", detailId);

      if (updateErr) {
        return { success: false, error: "Gagal menandai detail dihapus: " + updateErr.message };
      }

      return { success: true };
    }

    // 1. Fetch the detail to get its header_id, pcs_index, and jml_hasil_produksi
    const { data: detail, error: detailErr } = await supabase
      .from("production_details")
      .select("header_id, pcs_index, jml_hasil_produksi")
      .eq("id", detailId)
      .single();

    if (detailErr) {
      return { success: false, error: "Gagal menemukan detail: " + detailErr.message };
    }

    const headerId = detail?.header_id;
    const pcsIndex = detail?.pcs_index;
    const isBsPanel = detail?.jml_hasil_produksi === 0;

    // 2. We will delete all details associated with this header, then the header itself
    // But first, let's get the header info to know which batch and panel to shift
    let headerWasDeleted = false;
    let deletedPanelNoStr = null;
    let batchInfo = null;

    if (headerId) {
      const { data: headerInfo } = await supabase
        .from("production_headers")
        .select("panel_no, nomor_mc, design_id, potongan_ke")
        .eq("id", headerId)
        .single();

      if (headerInfo) {
        deletedPanelNoStr = headerInfo.panel_no;
        batchInfo = {
          nomor_mc: headerInfo.nomor_mc,
          design_id: headerInfo.design_id,
          potongan_ke: headerInfo.potongan_ke,
        };
      }

      // 2. Delete ONLY the specific detail row
      // We must delete production_defects first to prevent foreign key violation
      await supabase
        .from("production_defects")
        .delete()
        .eq("production_detail_id", detailId);

      const { error: delErr } = await supabase
        .from("production_details")
        .delete()
        .eq("id", detailId);

      if (delErr) {
        return { success: false, error: delErr.message };
      }

      // Check if there are any remaining details for this header
      const { count } = await supabase
        .from("production_details")
        .select("id", { count: "exact", head: true })
        .eq("header_id", headerId);

      if (count === 0) {
        // Delete the header since no details remain
        const { error: hdrDelErr } = await supabase
          .from("production_headers")
          .delete()
          .eq("id", headerId);

        if (!hdrDelErr) {
          headerWasDeleted = true;
        }
      }
    } else {
      // If no header_id (unlikely), just delete the detail
      await supabase
        .from("production_defects")
        .delete()
        .eq("production_detail_id", detailId);

      const { error: delErr } = await supabase
        .from("production_details")
        .delete()
        .eq("id", detailId);

      if (delErr) {
        return { success: false, error: delErr.message };
      }
    }

    let hasRemainingDetailsForCurrentPcs = false;
    if (headerId && pcsIndex !== undefined) {
      const { count: remainingCount } = await supabase
        .from("production_details")
        .select("id", { count: "exact", head: true })
        .eq("header_id", headerId)
        .eq("pcs_index", pcsIndex);
      hasRemainingDetailsForCurrentPcs = (remainingCount || 0) > 0;
    }

    // 3. Shift subsequent panels down by 1 to fill the void for current PCS
    // Tapi JANGAN geser jika yang dihapus adalah panel BS (karena BS tidak menggeser antrean saat ditambahkan)
    if (!isBsPanel && !hasRemainingDetailsForCurrentPcs && deletedPanelNoStr && deletedPanelNoStr !== "METERAN" && batchInfo && pcsIndex !== undefined) {
      const deletedPanelNo = parseInt(deletedPanelNoStr);
      if (!isNaN(deletedPanelNo)) {
        const { data: allHeaders } = await supabase
          .from("production_headers")
          .select("*, production_details(pcs_index)")
          .eq("nomor_mc", batchInfo.nomor_mc)
          .eq("design_id", batchInfo.design_id)
          .eq("potongan_ke", batchInfo.potongan_ke)
          .neq("panel_no", "METERAN")
          .order("panel_no", { ascending: true });

        const panelHeaders = (allHeaders || []).filter((h: any) => {
          const p = parseInt(h.panel_no);
          return !isNaN(p);
        });

        if (panelHeaders.length > 0) {
          const toShift = panelHeaders
            .filter((h: any) => parseInt(h.panel_no) > deletedPanelNo)
            .sort((a: any, b: any) => parseInt(a.panel_no) - parseInt(b.panel_no)); // Ascending to safely shift down

          for (const h of toShift) {
            // Cek apakah header ini dipakai oleh PCS lain
            const { data: detailsForH } = await supabase
              .from("production_details")
              .select("id, pcs_index")
              .eq("header_id", h.id);

            const otherPcsDetails = (detailsForH || []).filter(d => String(d.pcs_index) !== String(pcsIndex));
            const currentPcsDetail = (detailsForH || []).find(d => String(d.pcs_index) === String(pcsIndex));

            if (!currentPcsDetail) continue;

            if (otherPcsDetails.length > 0) {
              // Header ini di-share dengan PCS lain. Kita tidak boleh menggeser header aslinya.
              // Buat kloningan header khusus untuk PCS ini dengan panel_no - 1.
              const clonedHeaderId = genId();
              const clonedHeaderPayload = { ...h };
              delete clonedHeaderPayload.production_details;
              delete clonedHeaderPayload.idempotency_key;
              clonedHeaderPayload.id = clonedHeaderId;
              clonedHeaderPayload.panel_no = String(parseInt(h.panel_no) - 1);

              const { error: cloneErr } = await supabase.from("production_headers").insert(clonedHeaderPayload);
              if (cloneErr) {
                return { success: false, error: `Gagal kloning header ${h.panel_no}: ${cloneErr.message}` };
              }

              // Update detail PCS ini agar menunjuk ke header yang baru dikloning
              await supabase.from("production_details").update({ header_id: clonedHeaderId }).eq("id", currentPcsDetail.id);
            } else {
              // Header ini hanya dipakai oleh PCS ini, aman untuk digeser
              const { error: shiftErr } = await supabase
                .from("production_headers")
                .update({ panel_no: String(parseInt(h.panel_no) - 1) })
                .eq("id", h.id);

              if (shiftErr) {
                return { success: false, error: `Gagal menggeser panel ${h.panel_no}: ${shiftErr.message}` };
              }
            }
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Helper to generate 8-char random id
function genId(): string {
  const chars = "abcdef0123456789";
  let r = "";
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

export async function insertMissingPanel(params: {
  /** Sample header id to copy metadata from */
  refHeaderId: string;
  /** Insert at this panel number; all panels >= insertAt get shifted +1 */
  insertAt?: number;
  /** If true, just append after the last panel */
  appendToEnd?: boolean;
  /** Index of PCS to insert the detail for */
  pcsIndex?: number;
  /** Kategori cacat (optional) */
  kategoriMasalah?: string[];
  /** Detail masalah (optional) */
  detailMasalah?: string;
  /** Keterangan cacat tambahan (optional) */
  keteranganCacat?: string;
  /** Jika true, ini adalah panel reject/BS sehingga panel lain tidak tergeser */
  isBs?: boolean;
  /** Direct final_inspection_id if inserting directly into mending/inspected batch */
  finalInspectionId?: number;
}) {
  try {
    const supabase = await createAdminClient();

    // 1. Fetch the reference header to copy its metadata
    const { data: refHeader, error: refErr } = await supabase
      .from("production_headers")
      .select("*")
      .eq("id", params.refHeaderId)
      .single();

    if (refErr || !refHeader) {
      return { success: false, error: "Gagal mengambil data header referensi: " + (refErr?.message || "tidak ditemukan") };
    }

    const { nomor_mc, design_id, potongan_ke, tgl } = refHeader as any;

    if (!nomor_mc || !design_id || !potongan_ke) {
      return { success: false, error: "Data header referensi tidak lengkap (mesin/desain/potongan)." };
    }

    // 2. Fetch all panel headers in this batch
    const { data: allHeaders, error: allErr } = await supabase
      .from("production_headers")
      .select("*, production_details(pcs_index)")
      .eq("nomor_mc", nomor_mc)
      .eq("design_id", design_id)
      .eq("potongan_ke", potongan_ke)
      .neq("panel_no", "METERAN")
      .order("panel_no", { ascending: true });

    if (allErr) {
      return { success: false, error: "Gagal mengambil data panel: " + allErr.message };
    }

    const panelHeaders = (allHeaders || []).filter((h: any) => {
      const p = parseInt(h.panel_no);
      return !isNaN(p);
    });

    // Determine the max panel for the CURRENT PCS
    const headersForCurrentPcs = panelHeaders.filter(h => 
      h.production_details && h.production_details.some((d: any) => String(d.pcs_index) === String(params.pcsIndex))
    );
    const maxPanelCurrentPcs = headersForCurrentPcs.reduce((max: number, h: any) => {
      const p = parseInt(h.panel_no);
      return p > max ? p : max;
    }, 0);

    // 3. Determine the target panel number
    let newPanelNo: number;
    if (params.appendToEnd) {
      newPanelNo = maxPanelCurrentPcs + 1;
    } else if (params.insertAt !== undefined) {
      newPanelNo = params.insertAt;
    } else {
      return { success: false, error: "Harus menyebutkan insertAt atau appendToEnd." };
    }

    // Cek apakah header sudah ada di posisi target
    const existingHeadersAtPos = panelHeaders.filter(h => parseInt(h.panel_no) === newPanelNo);
    // Cari header di posisi target yang sudah dipakai oleh PCS ini
    const existingHeaderLinkedToCurrentPcs = existingHeadersAtPos.find(h => 
      h.production_details?.some((d: any) => String(d.pcs_index) === String(params.pcsIndex))
    );

    let targetHeaderId;
    let needsShift = false;
    let needsNewHeader = false;

    if (existingHeaderLinkedToCurrentPcs) {
      if (params.isBs) {
        // Jika BS, jangan geser panel lain dan jangan buat header baru (gunakan header yang sudah ada di nomor panel tersebut sehingga nomor panel tsb memiliki 2 data)
        needsShift = false;
        needsNewHeader = false;
        targetHeaderId = existingHeaderLinkedToCurrentPcs.id;
      } else {
        // Jika bukan BS, kita harus geser panel >= newPanelNo dan buat header baru untuk panel yang disisipkan
        needsShift = true;
        needsNewHeader = true;
      }
    } else {
      needsShift = false;
      if (existingHeadersAtPos.length > 0) {
        needsNewHeader = false;
        targetHeaderId = existingHeadersAtPos[0].id;
      } else {
        needsNewHeader = true;
      }
    }

    console.log("INSERT PANEL:", {
      newPanelNo,
      existingHeadersFound: existingHeadersAtPos.length > 0,
      existingHeaderLinkedToCurrentPcs: !!existingHeaderLinkedToCurrentPcs,
      isBs: params.isBs,
      needsShift,
      needsNewHeader,
    });

    if (needsShift) {
      // 4. Shift all panels >= newPanelNo by +1, from highest to lowest to avoid unique constraint clashes
      const toShift = panelHeaders
        .filter((h: any) => parseInt(h.panel_no) >= newPanelNo)
        .sort((a: any, b: any) => parseInt(b.panel_no) - parseInt(a.panel_no));

      for (const h of toShift) {
        // Cek apakah header ini dipakai oleh PCS lain
        const { data: detailsForH } = await supabase
          .from("production_details")
          .select("id, pcs_index")
          .eq("header_id", (h as any).id);

        const otherPcsDetails = (detailsForH || []).filter(d => String(d.pcs_index) !== String(params.pcsIndex));
        const currentPcsDetail = (detailsForH || []).find(d => String(d.pcs_index) === String(params.pcsIndex));

        if (!currentPcsDetail) continue;

        if (otherPcsDetails.length > 0) {
          // Header ini di-share dengan PCS lain. Kita tidak boleh menggeser header aslinya.
          // Buat kloningan header khusus untuk PCS ini.
          const clonedHeaderId = genId();
          const clonedHeaderPayload = { ...h };
          delete clonedHeaderPayload.production_details; // Hapus relasi jika ada
          delete clonedHeaderPayload.idempotency_key; // Hapus agar tidak duplikat
          clonedHeaderPayload.id = clonedHeaderId;
          clonedHeaderPayload.panel_no = String(parseInt(h.panel_no) + 1);

          const { error: cloneErr } = await supabase.from("production_headers").insert(clonedHeaderPayload);
          if (cloneErr) {
            return { success: false, error: `Gagal kloning header ${(h as any).panel_no}: ${cloneErr.message}` };
          }
          
          // Update detail PCS ini agar menunjuk ke header yang baru dikloning
          await supabase.from("production_details").update({ header_id: clonedHeaderId }).eq("id", currentPcsDetail.id);
        } else {
          // Header ini hanya dipakai oleh PCS ini, aman untuk digeser
          const { error: shiftErr } = await supabase
            .from("production_headers")
            .update({ panel_no: String(parseInt((h as any).panel_no) + 1) })
            .eq("id", (h as any).id);

          if (shiftErr) {
            return { success: false, error: `Gagal menggeser panel ${(h as any).panel_no}: ${shiftErr.message}` };
          }
        }
      }
    }

    // 5. Get current datetime in WIB
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const tanggalJam = fmt.format(now);

    // Find the most appropriate header to copy metadata from
    let sourceHeader = refHeader;
    if (panelHeaders && panelHeaders.length > 0) {
      if (params.appendToEnd) {
        const maxPanelHeader = panelHeaders.reduce((prev: any, current: any) => {
          return (parseInt(prev.panel_no) > parseInt(current.panel_no)) ? prev : current;
        });
        if (maxPanelHeader) sourceHeader = maxPanelHeader;
      } else {
        const currentAtPos = panelHeaders.find((h: any) => parseInt(h.panel_no) === newPanelNo);
        if (currentAtPos) {
          sourceHeader = currentAtPos;
        } else {
          const prevPanel = panelHeaders.find((h: any) => parseInt(h.panel_no) === newPanelNo - 1);
          if (prevPanel) sourceHeader = prevPanel;
        }
      }
    }

    // 6. Create new header (copy metadata from sourceHeader) if needed
    if (needsNewHeader) {
      const newHeaderId = genId();
      const resolvedTgl = (sourceHeader as any).tgl || tanggalJam.split(" ")[0];
      const resolvedTanggalJam = (sourceHeader as any).tanggal_jam || (resolvedTgl ? `${resolvedTgl} ${tanggalJam.split(" ")[1] || "12:00:00"}` : tanggalJam);

      const newHeaderPayload: any = {
        id: newHeaderId,
        tgl: resolvedTgl,
        tanggal_jam: resolvedTanggalJam,
        nomor_mc: (sourceHeader as any).nomor_mc,
        design_id: (sourceHeader as any).design_id,
        potongan_ke: (sourceHeader as any).potongan_ke,
        panel_no: String(newPanelNo),
        operator_id: (sourceHeader as any).operator_id || null,
        group_id: (sourceHeader as any).group_id || null,
        course: (sourceHeader as any).course || null,
        rpm: (sourceHeader as any).rpm || null,
        pick: (sourceHeader as any).pick || null,
        pic: (sourceHeader as any).pic || null,
        no_order_barang: (sourceHeader as any).no_order_barang || null,
        no_customer: (sourceHeader as any).no_customer || null,
        jenis_benang_dasar: (sourceHeader as any).jenis_benang_dasar || null,
        liner: (sourceHeader as any).liner || null,
        heavy: (sourceHeader as any).heavy || null,
        shadow: (sourceHeader as any).shadow || null,
        pinggiran: (sourceHeader as any).pinggiran || null,
        created_by_name: (sourceHeader as any).created_by_name || null,
        pcs: (sourceHeader as any).pcs || 1,
      };

      const { error: insertHeaderErr } = await supabase
        .from("production_headers")
        .insert(newHeaderPayload);

      if (insertHeaderErr) {
        return { success: false, error: "Gagal membuat header panel baru: " + insertHeaderErr.message };
      }
      
      targetHeaderId = newHeaderId;
    }

    // 7. Create production_detail(s)
    // Only create for current PCS as requested
    const newDetailId = genId() + "-0";
    const finalInspectionId = params.finalInspectionId !== undefined ? params.finalInspectionId : null;

    let statusInspeksi: string | null = null;
    if (finalInspectionId === 3) statusInspeksi = "Silang";
    else if (finalInspectionId === 4) statusInspeksi = "BS";
    else if (finalInspectionId === 1 || finalInspectionId === 2) statusInspeksi = "Ceklis";
    else if (params.isBs) statusInspeksi = "BS";

    const { error: insertDetailErr } = await supabase
      .from("production_details")
      .insert({
        id: newDetailId,
        header_id: targetHeaderId,
        pcs_index: params.pcsIndex || 1,
        jml_hasil_produksi: params.isBs ? 0 : 1,
        indikator_stop: false,
        kategori_masalah: params.kategoriMasalah && params.kategoriMasalah.length > 0 ? params.kategoriMasalah.join(", ") : null,
        detail_masalah: params.detailMasalah || null,
        keterangan_cacat: params.keteranganCacat ? `${params.keteranganCacat} [TAMBAHAN QC]` : "[TAMBAHAN QC]",
        meter_kain: null,
        roll_no: null,
        final_inspection_id: finalInspectionId,
        status_inspeksi: statusInspeksi,
      });

    if (insertDetailErr) {
      return { success: false, error: "Gagal membuat detail panel baru: " + insertDetailErr.message };
    }

    return { success: true, newPanelNo, newHeaderId: targetHeaderId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getQCDetailsByGroup(nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) {
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
        header_id,
        production_headers!inner (
          id, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, design_id, potongan_ke, meter_awal, meter_akhir, course, rpm, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, status_matching, operator_backup, operators(nama_operator), groups(nama_grup)
        )
      `)
      .is("final_inspection_id", null)
      .eq("production_headers.nomor_mc", nomor_mc)
      .eq("production_headers.potongan_ke", potongan_ke)
      .eq("pcs_index", pcs_index);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: true, data: [] };
    }

    // Sort by panel_no (numeric string) or METERAN
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

export async function getQCHistoryDetailById(batchId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("qc_inspection_batches")
      .select(`
        *,
        items:qc_inspection_items (
          id, final_inspection_id,
          detail:production_details (
            id, pcs_index, final_inspection_id, header_id, roll_no, meter_kain, keterangan_qc, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi, status_inspeksi, status_mending, indikator_stop, is_deleted,
            header:production_headers (id, tanggal_jam, design_id, potongan_ke, panel_no, nomor_mc, pic:created_by_name, tgl, tanggal_potong, pick, no_order_barang, no_customer, course, rpm, status_matching, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, operator_backup, operators(nama_operator), groups(nama_grup))
          )
        )
      `)
      .eq("id", batchId)
      .single();

    if (error) {
      console.error("Error fetching QC batch by ID:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Data batch tidak ditemukan." };
    }

    // Format the batch to match the expected format
    const firstItem = data.items && data.items.length > 0 ? data.items[0] : null;
    const header = firstItem?.detail?.header || {};

    const formattedItems = (data.items || []).map((item: any) => ({
      id: item.id,
      final_inspection_id: item.final_inspection_id,
      detail: item.detail || {},
      header: item.detail?.header || {}
    }));

    const formattedData = {
      ...data,
      header,
      detail: { pcs_index: data.pcs_index },
      items: formattedItems
    };

    return { success: true, data: formattedData };
  } catch (err: any) {
    console.error("Server action error in getQCHistoryDetailById:", err);
    return { success: false, error: err.message };
  }
}

function expandBlockNumbers(blokInput?: string | null): string[] {
  if (!blokInput || typeof blokInput !== "string") return [];
  const parts = blokInput.split(",").map(p => p.trim()).filter(Boolean);
  const blocks: string[] = [];

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 100) {
        for (let b = start; b <= end; b++) {
          blocks.push(String(b));
        }
        continue;
      }
    }
    const numMatch = part.match(/\d+/);
    if (numMatch) {
      blocks.push(numMatch[0]);
    } else if (part) {
      blocks.push(part);
    }
  }

  return Array.from(new Set(blocks));
}

export async function updateQCDetailDefectsAndNotes(params: {
  detailId: string;
  kategoriMasalah?: string[];
  detailMasalah?: string;
  keteranganCacat?: string;
  keteranganQc?: string;
  isBs?: boolean;
  finalInspectionId?: number;
  defects?: { kategori: string; detail?: string; blok?: string; meter?: number }[];
}) {
  try {
    const supabase = await createAdminClient();

    // 1. Fetch current detail
    const { data: currentDetail, error: fetchErr } = await supabase
      .from("production_details")
      .select("*, production_headers(*)")
      .eq("id", params.detailId)
      .single();

    if (fetchErr || !currentDetail) {
      return { success: false, error: "Data detail tidak ditemukan: " + (fetchErr?.message || "") };
    }

    const hasDefects = (params.kategoriMasalah && params.kategoriMasalah.length > 0) || (params.detailMasalah && params.detailMasalah.trim() !== "");
    const isBs = !!params.isBs || params.finalInspectionId === 4;
    const isCurrentlyPending = currentDetail.final_inspection_id === null;

    let statusInspeksi = currentDetail.status_inspeksi;
    if (!isCurrentlyPending && params.finalInspectionId !== undefined) {
      if (params.finalInspectionId === 1 || params.finalInspectionId === 2) statusInspeksi = "Ceklis";
      else if (params.finalInspectionId === 3) statusInspeksi = "Silang";
      else if (params.finalInspectionId === 4) statusInspeksi = "BS";
      else if (params.finalInspectionId === 0) statusInspeksi = "Dihapus";
    } else if (isCurrentlyPending) {
      if (isBs) statusInspeksi = "BS";
      else statusInspeksi = null;
    }

    const kategoriStr = params.kategoriMasalah && params.kategoriMasalah.length > 0
      ? params.kategoriMasalah.join(", ")
      : (isBs ? "X" : null);

    let ketCacat = params.keteranganCacat ? params.keteranganCacat.trim() : "";
    if (hasDefects || ketCacat) {
      if (!ketCacat.includes("[TAMBAHAN QC]")) {
        ketCacat = ketCacat ? `${ketCacat} [TAMBAHAN QC]` : "[TAMBAHAN QC]";
      }
    } else {
      ketCacat = "";
    }

    // 2. Update production_details
    const updatePayload: any = {
      kategori_masalah: kategoriStr,
      detail_masalah: params.detailMasalah || null,
      keterangan_cacat: ketCacat || null,
      keterangan_qc: params.keteranganQc ? params.keteranganQc.trim() : null,
      jml_hasil_produksi: isBs ? 0 : 1,
      status_inspeksi: statusInspeksi,
    };

    if (!isCurrentlyPending && params.finalInspectionId !== undefined) {
      updatePayload.final_inspection_id = params.finalInspectionId;
    }

    const { error: updateErr } = await supabase
      .from("production_details")
      .update(updatePayload)
      .eq("id", params.detailId);

    if (updateErr) {
      return { success: false, error: "Gagal memperbarui detail: " + updateErr.message };
    }

    // 3. Update production_defects
    await supabase
      .from("production_defects")
      .delete()
      .eq("production_detail_id", params.detailId);

    if (params.defects && params.defects.length > 0) {
      const defectRows: any[] = [];
      params.defects.forEach((d) => {
        const expandedBloks = expandBlockNumbers(d.blok);
        if (expandedBloks.length > 0) {
          expandedBloks.forEach((b) => {
            defectRows.push({
              production_detail_id: params.detailId,
              kategori: d.kategori,
              detail: d.detail || null,
              meter: d.meter || null,
              blok: b,
            });
          });
        } else {
          defectRows.push({
            production_detail_id: params.detailId,
            kategori: d.kategori,
            detail: d.detail || null,
            meter: d.meter || null,
            blok: d.blok || null,
          });
        }
      });

      if (defectRows.length > 0) {
        const { error: defectInsertErr } = await supabase
          .from("production_defects")
          .insert(defectRows);

        if (defectInsertErr) {
          console.error("Warning: Gagal menyimpan data production_defects:", defectInsertErr);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function swapOrMoveQCDefects(params: {
  sourceDetailId: string;
  targetDetailId: string;
  mode: "move" | "swap";
}) {
  try {
    const supabase = await createAdminClient();

    // 1. Fetch both source and target details
    const { data: sourceDetail, error: sourceErr } = await supabase
      .from("production_details")
      .select("*, production_headers(*)")
      .eq("id", params.sourceDetailId)
      .single();

    if (sourceErr || !sourceDetail) {
      return { success: false, error: "Data panel asal tidak ditemukan: " + (sourceErr?.message || "") };
    }

    const { data: targetDetail, error: targetErr } = await supabase
      .from("production_details")
      .select("*, production_headers(*)")
      .eq("id", params.targetDetailId)
      .single();

    if (targetErr || !targetDetail) {
      return { success: false, error: "Data panel tujuan tidak ditemukan: " + (targetErr?.message || "") };
    }

    // 2. Fetch existing production_defects for both
    const { data: sourceDefects } = await supabase
      .from("production_defects")
      .select("*")
      .eq("production_detail_id", params.sourceDetailId);

    const { data: targetDefects } = await supabase
      .from("production_defects")
      .select("*")
      .eq("production_detail_id", params.targetDetailId);

    if (params.mode === "swap") {
      // SWAP MODE
      // Update source with target's defect data
      await supabase.from("production_details").update({
        kategori_masalah: targetDetail.kategori_masalah,
        detail_masalah: targetDetail.detail_masalah,
        keterangan_cacat: targetDetail.keterangan_cacat,
        keterangan_qc: targetDetail.keterangan_qc,
        jml_hasil_produksi: targetDetail.jml_hasil_produksi,
        status_inspeksi: targetDetail.status_inspeksi,
      }).eq("id", params.sourceDetailId);

      // Update target with source's defect data
      await supabase.from("production_details").update({
        kategori_masalah: sourceDetail.kategori_masalah,
        detail_masalah: sourceDetail.detail_masalah,
        keterangan_cacat: sourceDetail.keterangan_cacat,
        keterangan_qc: sourceDetail.keterangan_qc,
        jml_hasil_produksi: sourceDetail.jml_hasil_produksi,
        status_inspeksi: sourceDetail.status_inspeksi,
      }).eq("id", params.targetDetailId);

      // Reassign production_defects
      await supabase.from("production_defects").delete().in("production_detail_id", [params.sourceDetailId, params.targetDetailId]);

      const newSourceDefectRows = (targetDefects || []).map((d: any) => ({
        production_detail_id: params.sourceDetailId,
        kategori: d.kategori,
        detail: d.detail,
        meter: d.meter,
        blok: d.blok,
      }));

      const newTargetDefectRows = (sourceDefects || []).map((d: any) => ({
        production_detail_id: params.targetDetailId,
        kategori: d.kategori,
        detail: d.detail,
        meter: d.meter,
        blok: d.blok,
      }));

      const allDefectRows = [...newSourceDefectRows, ...newTargetDefectRows];
      if (allDefectRows.length > 0) {
        await supabase.from("production_defects").insert(allDefectRows);
      }
    } else {
      // MOVE MODE (Pindahkan semua cacat dari source ke target, source jadi bersih)
      // Update target with source's defect data
      await supabase.from("production_details").update({
        kategori_masalah: sourceDetail.kategori_masalah,
        detail_masalah: sourceDetail.detail_masalah,
        keterangan_cacat: sourceDetail.keterangan_cacat,
        keterangan_qc: sourceDetail.keterangan_qc,
        jml_hasil_produksi: sourceDetail.jml_hasil_produksi,
        status_inspeksi: sourceDetail.status_inspeksi,
      }).eq("id", params.targetDetailId);

      // Clean up source
      await supabase.from("production_details").update({
        kategori_masalah: null,
        detail_masalah: null,
        keterangan_cacat: null,
        keterangan_qc: null,
        jml_hasil_produksi: 1,
        status_inspeksi: null,
      }).eq("id", params.sourceDetailId);

      // Reassign production_defects
      await supabase.from("production_defects").delete().in("production_detail_id", [params.sourceDetailId, params.targetDetailId]);

      const newTargetDefectRows = (sourceDefects || []).map((d: any) => ({
        production_detail_id: params.targetDetailId,
        kategori: d.kategori,
        detail: d.detail,
        meter: d.meter,
        blok: d.blok,
      }));

      if (newTargetDefectRows.length > 0) {
        await supabase.from("production_defects").insert(newTargetDefectRows);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface BulkQCDetailParams {
  detailIds: string[];
  kategoriMasalah?: string[];
  detailMasalah?: string;
  keteranganCacat?: string;
  keteranganQc?: string;
  finalInspectionId?: number;
  defects?: { kategori: string; detail?: string; blok?: string; meter?: string }[];
  isBs?: boolean;
}

export async function bulkUpdateQCDetails(params: BulkQCDetailParams) {
  try {
    const supabase = await createClient();
    if (!params.detailIds || params.detailIds.length === 0) {
      return { success: false, error: "Tidak ada panel yang dipilih." };
    }

    const isBs = !!params.isBs || params.finalInspectionId === 4;
    const hasNewDefects = (params.defects && params.defects.length > 0) || (params.kategoriMasalah && params.kategoriMasalah.length > 0);

    // 1. Fetch current data of all target details to preserve existing operator defects
    const { data: currentDetails, error: fetchErr } = await supabase
      .from("production_details")
      .select("id, kategori_masalah, detail_masalah, keterangan_cacat, keterangan_qc, jml_hasil_produksi, production_defects(*)")
      .in("id", params.detailIds);

    if (fetchErr || !currentDetails) {
      return { success: false, error: "Gagal mengambil data panel: " + (fetchErr?.message || "") };
    }

    const newDefectRowsToInsert: any[] = [];

    // Process each detail individually to preserve / merge with existing data
    for (const detail of currentDetails) {
      const existingCats = detail.kategori_masalah
        ? (Array.isArray(detail.kategori_masalah) ? detail.kategori_masalah : String(detail.kategori_masalah).split(",").map((s: string) => s.trim()).filter(Boolean))
        : [];

      const existingDetails = detail.detail_masalah
        ? String(detail.detail_masalah).split(/[,|]/).map((s: string) => s.trim()).filter(Boolean)
        : [];

      let mergedCats = [...existingCats];
      let mergedDetails = [...existingDetails];
      let mergedKetCacat = detail.keterangan_cacat || "";

      if (hasNewDefects) {
        // Merge categories
        if (params.kategoriMasalah) {
          params.kategoriMasalah.forEach((cat) => {
            if (!mergedCats.includes(cat)) mergedCats.push(cat);
          });
        }

        // Merge details
        if (params.detailMasalah) {
          const newDets = String(params.detailMasalah).split(/[,|]/).map((s: string) => s.trim()).filter(Boolean);
          newDets.forEach((d) => {
            const tagged = d.includes("[QC]") ? d : `[QC] ${d}`;
            if (!mergedDetails.includes(tagged)) mergedDetails.push(tagged);
          });
        }

        // Merge keterangan cacat
        if (params.keteranganCacat) {
          const newKet = params.keteranganCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
          if (newKet && !mergedKetCacat.includes(newKet)) {
            mergedKetCacat = mergedKetCacat ? `${mergedKetCacat}, ${newKet}` : newKet;
          }
        }

        // Prepare new defect rows to insert for this detail with [QC] tag
        if (params.defects && params.defects.length > 0) {
          params.defects.forEach((d) => {
            const rawDetail = d.detail ? (d.detail.includes("[QC]") ? d.detail : `[QC] ${d.detail}`) : "[QC]";
            const expandedBloks = expandBlockNumbers(d.blok);
            if (expandedBloks.length > 0) {
              expandedBloks.forEach((b) => {
                newDefectRowsToInsert.push({
                  production_detail_id: detail.id,
                  kategori: d.kategori,
                  detail: rawDetail,
                  meter: d.meter || null,
                  blok: b,
                });
              });
            } else {
              newDefectRowsToInsert.push({
                production_detail_id: detail.id,
                kategori: d.kategori,
                detail: rawDetail,
                meter: d.meter || null,
                blok: d.blok || null,
              });
            }
          });
        }
      }

      // Update keterangan_qc
      let nextKetQc = detail.keterangan_qc;
      if (params.keteranganQc !== undefined) {
        nextKetQc = params.keteranganQc ? params.keteranganQc.trim() : null;
      }

      const updatePayload: any = {
        keterangan_qc: nextKetQc,
      };

      if (hasNewDefects) {
        updatePayload.kategori_masalah = mergedCats.length > 0 ? mergedCats.join(", ") : (isBs ? "X" : null);
        updatePayload.detail_masalah = mergedDetails.length > 0 ? mergedDetails.join(", ") : null;
        updatePayload.keterangan_cacat = mergedKetCacat || null;
      }

      if (isBs) {
        updatePayload.jml_hasil_produksi = 0;
      }

      await supabase
        .from("production_details")
        .update(updatePayload)
        .eq("id", detail.id);
    }

    // Insert any new defects without wiping existing ones
    if (newDefectRowsToInsert.length > 0) {
      await supabase
        .from("production_defects")
        .insert(newDefectRowsToInsert);
    }

    return {
      success: true,
      updatedData: {
        defects: params.defects || []
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}




