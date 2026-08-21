"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateOverallGradeData } from "@/lib/mending-grade-utils";

export async function getBatchesForBarcode(filters: {
  nomor_mc?: string;
  design_id?: string;
  potongan_ke?: string;
}) {
  try {
    const supabase = await createClient();

    // 1. Fetch mending batches with mending items & production details
    let mendingQuery = supabase
      .from("mending_batches")
      .select(`
        id, nomor_mc, design_id, potongan_ke, pcs_index, tanggal_mending, total_panel,
        mending_grade_a, mending_grade_b, mending_grade_bs,
        items:mending_items (
          id, hasil_mending,
          detail:production_details (
            id, pcs_index, final_inspection_id, keterangan_cacat, kategori_masalah, detail_masalah, jml_hasil_produksi,
            header:production_headers (
              id, panel_no, nomor_mc, design_id, potongan_ke, no_order_barang, no_customer, tgl, meter_awal, meter_akhir
            ),
            qc_items:qc_inspection_items (
              batch:qc_inspection_batches ( berat_kain )
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (filters.nomor_mc) mendingQuery = mendingQuery.eq("nomor_mc", filters.nomor_mc);
    if (filters.design_id) mendingQuery = mendingQuery.eq("design_id", filters.design_id);
    if (filters.potongan_ke) mendingQuery = mendingQuery.eq("potongan_ke", parseInt(filters.potongan_ke));

    const { data: mendingBatches, error: mendingErr } = await mendingQuery;
    if (mendingErr) {
      console.error("Error fetching mending batches:", mendingErr);
    }

    // 2. Fetch all QC inspection batches for weights
    let qcBatchQuery = supabase
      .from("qc_inspection_batches")
      .select("nomor_mc, potongan_ke, pcs_index, berat_kain");
    if (filters.nomor_mc) qcBatchQuery = qcBatchQuery.eq("nomor_mc", filters.nomor_mc);
    if (filters.potongan_ke) qcBatchQuery = qcBatchQuery.eq("potongan_ke", parseInt(filters.potongan_ke));
    const { data: qcBatches } = await qcBatchQuery;

    const formattedList: any[] = [];
    const processedKeys = new Set<string>();

    if (mendingBatches && mendingBatches.length > 0) {
      for (const batch of (mendingBatches as any[])) {
        const firstItem = batch.items && batch.items.length > 0 ? batch.items[0] : null;
        const firstDetail = Array.isArray(firstItem?.detail) ? firstItem?.detail[0] : firstItem?.detail;
        const header = Array.isArray(firstDetail?.header) ? firstDetail?.header[0] : firstDetail?.header || {};
        const isMeteran = header?.panel_no === "METERAN";
        const key = `${batch.nomor_mc}__${batch.potongan_ke}__${batch.pcs_index || 1}`;
        processedKeys.add(key);

        // Find weight from qc_items or qcBatches
        let berat = 0;
        for (const itm of (batch.items || [])) {
          const itmDetail = Array.isArray(itm.detail) ? itm.detail[0] : itm.detail;
          const qb = itmDetail?.qc_items?.[0]?.batch;
          if (qb && qb.berat_kain) {
            berat = Number(qb.berat_kain) || 0;
            break;
          }
        }
        if (!berat && qcBatches) {
          const match = qcBatches.find((q: any) =>
            String(q.nomor_mc) === String(batch.nomor_mc) &&
            Number(q.potongan_ke) === Number(batch.potongan_ke) &&
            Number(q.pcs_index) === Number(batch.pcs_index || 1)
          );
          if (match) berat = Number(match.berat_kain) || 0;
        }

        // Calculate Overall Grade
        const gradeResult = calculateOverallGradeData(
          (batch.items || []).map((i: any) => {
            const d = Array.isArray(i.detail) ? i.detail[0] : i.detail;
            return {
              ...i,
              panel_no: d?.keterangan_cacat || "",
              keterangan_cacat: d?.keterangan_cacat || "",
              kategori_masalah: d?.kategori_masalah || "",
              detail_masalah: d?.detail_masalah || "",
              hasil_mending: i.hasil_mending || "A",
              detail: d
            };
          }),
          isMeteran,
          Number(batch.mending_grade_a) || Number(header.meter_akhir) || undefined
        );

        const overallGrade = (gradeResult.overallGrade && gradeResult.overallGrade !== "-")
          ? gradeResult.overallGrade
          : "A";

        formattedList.push({
          id: batch.id,
          batch_id: batch.id,
          pcs_index: batch.pcs_index || 1,
          nomor_mc: batch.nomor_mc,
          design_id: batch.design_id || header.design_id || "-",
          potongan_ke: batch.potongan_ke,
          no_order_barang: header.no_order_barang || "-",
          no_customer: header.no_customer || "-",
          tgl: batch.tanggal_mending || header.tgl || "-",
          berat_kain: berat,
          jumlah_panel: isMeteran ? (batch.mending_grade_a || 1) : (batch.total_panel || batch.items?.length || 1),
          overall_grade: overallGrade,
          is_meteran: isMeteran,
        });
      }
    }

    // 3. Fallback: also check production headers for any completed mending not yet in mending_batches
    let fallbackQuery = supabase.from("production_headers").select(`
      id, nomor_mc, design_id, potongan_ke, no_order_barang, no_customer, tgl, panel_no, meter_akhir,
      production_details!inner (
        id, pcs_index, status_mending, keterangan_cacat, kategori_masalah, detail_masalah, final_inspection_id,
        qc_inspection_items ( qc_inspection_batches ( berat_kain ) ),
        mending_items!inner ( id, hasil_mending )
      )
    `);

    if (filters.nomor_mc) fallbackQuery = fallbackQuery.eq("nomor_mc", filters.nomor_mc);
    if (filters.design_id) fallbackQuery = fallbackQuery.eq("design_id", filters.design_id);
    if (filters.potongan_ke) fallbackQuery = fallbackQuery.eq("potongan_ke", parseInt(filters.potongan_ke));

    const { data: fallbackHeaders } = await fallbackQuery;

    if (fallbackHeaders && fallbackHeaders.length > 0) {
      // Group by mc, potongan, pcs
      const grouped = new Map<string, { header: any; details: any[] }>();
      (fallbackHeaders as any[]).forEach((h: any) => {
        (h.production_details || []).forEach((d: any) => {
          const pcs = d.pcs_index || 1;
          const key = `${h.nomor_mc}__${h.potongan_ke}__${pcs}`;
          if (processedKeys.has(key)) return; // already in mending_batches

          if (!grouped.has(key)) {
            grouped.set(key, { header: h, details: [] });
          }
          grouped.get(key)!.details.push(d);
        });
      });

      grouped.forEach(({ header, details }, key) => {
        const firstDetail = details[0];
        const isMeteran = header.panel_no === "METERAN";
        let berat = 0;
        for (const d of details) {
          if (d.qc_inspection_items?.[0]?.qc_inspection_batches?.berat_kain) {
            berat = Number(d.qc_inspection_items[0].qc_inspection_batches.berat_kain) || 0;
            break;
          }
        }
        if (!berat && qcBatches) {
          const [mc, pot, pcs] = key.split("__");
          const match = qcBatches.find((q: any) =>
            String(q.nomor_mc) === mc &&
            Number(q.potongan_ke) === Number(pot) &&
            Number(q.pcs_index) === Number(pcs)
          );
          if (match) berat = Number(match.berat_kain) || 0;
        }

        const gradeResult = calculateOverallGradeData(
          details.map((d: any) => ({
            ...d,
            panel_no: d.keterangan_cacat || "",
            hasil_mending: d.mending_items?.[0]?.hasil_mending || d.status_mending || "A",
            detail: d
          })),
          isMeteran,
          Number(header.meter_akhir) || undefined
        );

        const overallGrade = (gradeResult.overallGrade && gradeResult.overallGrade !== "-")
          ? gradeResult.overallGrade
          : "A";

        formattedList.push({
          id: firstDetail.id,
          batch_id: firstDetail.id,
          pcs_index: firstDetail.pcs_index || 1,
          nomor_mc: header.nomor_mc,
          design_id: header.design_id || "-",
          potongan_ke: header.potongan_ke,
          no_order_barang: header.no_order_barang || "-",
          no_customer: header.no_customer || "-",
          tgl: header.tgl || "-",
          berat_kain: berat,
          jumlah_panel: isMeteran ? (header.meter_akhir || 1) : details.length,
          overall_grade: overallGrade,
          is_meteran: isMeteran,
        });
      });
    }

    return { success: true, data: formattedList };
  } catch (err: any) {
    console.error("Error in getBatchesForBarcode:", err);
    return { success: false, error: err.message };
  }
}
