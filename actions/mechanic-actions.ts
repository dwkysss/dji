"use server";

import { createClient } from "@/lib/supabase/server";
import { getShiftDate, parseAsWibDate, getJakartaDateTimeString } from "@/lib/shift-utils";

export async function submitMechanicDowntime(data: {
  nomorMc: string;
  operatorId: string;
  groupId: string;
  designId: string;
  tanggalProduksi: string;
  potonganKe: string;
  downtimeEvent: any;
  createdTime?: number | string;
  headerId?: string;
}) {
  try {
    const supabase = await createClient();

    // 1. Generate unique header ID or reuse provided headerId (for updating draft)
    const headerId = data.headerId || `mekanik-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const isExisting = Boolean(data.headerId);

    // 2. Prepare header data
    const operatorIdNum = data.operatorId && !isNaN(parseInt(data.operatorId)) ? parseInt(data.operatorId) : null;
    let groupIdNum: number | null = null;
    if (data.groupId) {
      const parsed = parseInt(data.groupId);
      if (!isNaN(parsed)) {
        groupIdNum = parsed;
      } else {
        const str = String(data.groupId).toUpperCase();
        if (str.includes("A")) groupIdNum = 1;
        else if (str.includes("B")) groupIdNum = 2;
        else if (str.includes("C")) groupIdNum = 3;
      }
    }
    const potonganKeNum = data.potonganKe && !isNaN(parseInt(data.potonganKe)) ? parseInt(data.potonganKe) : null;

    const eventDate = data.createdTime ? parseAsWibDate(data.createdTime) : new Date();
    const tanggalJam = getJakartaDateTimeString(eventDate);
    const tgl = data.tanggalProduksi || getShiftDate(eventDate);

    const dt = data.downtimeEvent;
    const durasiSec = (dt && dt.durasiDetik && !isNaN(parseInt(dt.durasiDetik))) ? parseInt(dt.durasiDetik) : 0;
    
    // We will inject a dummy production_headers just for this downtime
    const headerPayload = {
      id: headerId,
      tgl,
      tanggal_jam: tanggalJam,
      operator_id: operatorIdNum,
      group_id: groupIdNum,
      design_id: data.designId || null,
      nomor_mc: data.nomorMc || null,
      potongan_ke: potonganKeNum,
      panel_no: "Downtime Mekanik (Direct)", // Special marker for dummy header
      pcs: 0, // no pieces
      total_downtime_detik: durasiSec,
      downtime_events: JSON.stringify([dt])
    };

    if (isExisting) {
      const { error: updateError } = await supabase
        .from("production_headers")
        .update({
          total_downtime_detik: durasiSec,
          downtime_events: JSON.stringify([dt]),
          group_id: groupIdNum,
          operator_id: operatorIdNum,
        })
        .eq("id", headerId);

      if (updateError) {
        console.error("Error updating mechanic dummy header:", updateError);
        return { success: false, error: updateError.message };
      }

      // Hapus downtime_records lama sebelum mengisi yang baru
      await supabase.from("downtime_records").delete().eq("header_id", headerId);
    } else {
      const { error: headerError } = await supabase
        .from("production_headers")
        .insert(headerPayload);

      if (headerError) {
        console.error("Error inserting mechanic dummy header:", headerError);
        return { success: false, error: headerError.message };
      }
    }

    // 3. Prepare downtime_records data
    const downtimeRecordsData: any[] = [];
    if (dt.problems && Array.isArray(dt.problems)) {
      dt.problems.forEach((p: any) => {
        downtimeRecordsData.push({
          header_id: headerId,
          kategori: p.kategori || dt.kategori,
          detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
          durasi_detik: durasiSec,
          blok: p.blok || dt.blok || null,
          dikerjakan_oleh: dt.dikerjakanOleh || null
        });
      });
    } else if (dt.kategori) {
      downtimeRecordsData.push({
        header_id: headerId,
        kategori: dt.kategori,
        detail: dt.detail,
        durasi_detik: durasiSec,
        blok: dt.blok || null,
        dikerjakan_oleh: dt.dikerjakanOleh || null
      });
    }

    if (downtimeRecordsData.length > 0) {
      const { error: dtError } = await supabase
        .from("downtime_records")
        .insert(downtimeRecordsData);

      if (dtError) {
        console.error("Error inserting mechanic downtime_records:", dtError);
        return { success: false, error: dtError.message };
      }
    }

    return { success: true, headerId };
  } catch (error: any) {
    console.error("Exception in submitMechanicDowntime:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function cancelMechanicDowntime(headerId: string) {
  try {
    if (!headerId) return { success: false, error: "Header ID required" };
    const supabase = await createClient();
    await supabase.from("downtime_records").delete().eq("header_id", headerId);
    await supabase.from("production_headers").delete().eq("id", headerId);
    return { success: true };
  } catch (error: any) {
    console.error("Exception in cancelMechanicDowntime:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
