"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helper untuk menghasilkan ID acak 8 karakter seperti di Excel
function generateExcelStyleId(): string {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface StatusMesinInput {
  nomorMc: string;
  pic: string;
  operatorId?: string;
  grupId?: string;
  pick?: string;
  course?: string;
  rpm?: string;
  designId?: string;
  status: string; // e.g. "TUNGGU ORDER"
  tanggalOff?: string;
  sampaiTanggalOff?: string;
  cakupan?: "FULL_DAY" | "SHIFT";
  idempotencyKey?: string;
}

export async function submitStatusMesin(inputData: StatusMesinInput) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const currentWibDateTime = formatter.format(now);
    const currentDate = currentWibDateTime.split(" ")[0];
    const currentTime = currentWibDateTime.split(" ")[1] || "08:00:00";

    const startDateStr = inputData.tanggalOff || currentDate;
    const dates: string[] = [startDateStr];

    if (inputData.sampaiTanggalOff && inputData.sampaiTanggalOff > startDateStr) {
      const cur = new Date(startDateStr);
      const end = new Date(inputData.sampaiTanggalOff);
      let count = 0;
      cur.setDate(cur.getDate() + 1);
      while (cur <= end && count < 31) {
        dates.push(cur.toISOString().split("T")[0]);
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    }

    const statusUpper = (inputData.status || "").trim().toUpperCase();
    let kategori = "G";
    if (statusUpper.includes("MAINTENANCE") || statusUpper.includes("SERVIS") || statusUpper.includes("OVERHAUL")) {
      kategori = "F";
    } else if (statusUpper.includes("RUSAK") || statusUpper.includes("ERROR") || statusUpper.includes("TROUBLE")) {
      kategori = "B";
    } else {
      kategori = "G";
    }

    const isFullDay = inputData.cakupan !== "SHIFT"; // Default to FULL_DAY (1 Hari Penuh)
    const headersToInsert: any[] = [];
    const detailsToInsert: any[] = [];

    const GROUPS_CONFIG = [
      { id: 1, name: "A", time: "08:00:00" },
      { id: 2, name: "B", time: "16:00:00" },
      { id: 3, name: "C", time: "23:30:00" },
    ];

    for (const d of dates) {
      if (isFullDay) {
        // Buat 3 catatan untuk setiap shift (A, B, C) pada tanggal tersebut
        for (const grp of GROUPS_CONFIG) {
          const headerId = generateExcelStyleId();
          headersToInsert.push({
            id: headerId,
            tgl: d,
            tanggal_jam: `${d} ${grp.time}`,
            nomor_mc: inputData.nomorMc,
            panel_no: "BERHENTI",
            pcs: null,
            pick: inputData.pick || null,
            course: inputData.course || null,
            rpm: inputData.rpm ? parseInt(inputData.rpm) : null,
            design_id: inputData.designId || null,
            total_downtime_detik: 0,
            idempotency_key: inputData.idempotencyKey ? `${inputData.idempotencyKey}-${d}-${grp.id}` : null,
            pic: inputData.pic || "-",
            operator_id: null,
            group_id: grp.id,
          });

          detailsToInsert.push({
            id: generateExcelStyleId() + "-1",
            header_id: headerId,
            pcs_index: null,
            jml_hasil_produksi: null,
            indikator_stop: true,
            kategori_masalah: kategori,
            detail_masalah: inputData.status,
          });
        }
      } else {
        // Hanya untuk 1 shift tertentu
        const headerId = generateExcelStyleId();
        const safeTime = (currentTime >= "07:10:00" && currentTime <= "23:59:59") ? currentTime : "08:00:00";
        headersToInsert.push({
          id: headerId,
          tgl: d,
          tanggal_jam: `${d} ${safeTime}`,
          nomor_mc: inputData.nomorMc,
          panel_no: "BERHENTI",
          pcs: null,
          pick: inputData.pick || null,
          course: inputData.course || null,
          rpm: inputData.rpm ? parseInt(inputData.rpm) : null,
          design_id: inputData.designId || null,
          total_downtime_detik: 0,
          idempotency_key: inputData.idempotencyKey ? `${inputData.idempotencyKey}-${d}` : null,
          pic: inputData.pic,
          operator_id: inputData.operatorId ? parseInt(inputData.operatorId) : null,
          group_id: inputData.grupId ? parseInt(inputData.grupId) : 1,
        });

        detailsToInsert.push({
          id: generateExcelStyleId() + "-1",
          header_id: headerId,
          pcs_index: null,
          jml_hasil_produksi: null,
          indikator_stop: true,
          kategori_masalah: kategori,
          detail_masalah: inputData.status,
        });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey && supabaseAnonKey !== "your_supabase_anon_key_here") {
      const supabase = await createClient();

      let createdByName = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const adminSupabase = await createAdminClient();
          const { data: profile } = await adminSupabase
            .from("user_profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          if (profile) {
            createdByName = profile.full_name;
          }
        }
      } catch (err) {
        console.error("Gagal mendapatkan PIC nama:", err);
      }

      if (createdByName) {
        headersToInsert.forEach((h) => {
          h.created_by_name = createdByName;
        });
      }

      const { error: insertHeaderError } = await supabase
        .from("production_headers")
        .insert(headersToInsert as any);

      if (insertHeaderError) {
        if (insertHeaderError.code === "23505" && inputData.idempotencyKey) {
          return { success: true };
        }
        throw new Error("Failed to insert status headers: " + insertHeaderError.message);
      }

      const { error: detailError } = await supabase
        .from("production_details")
        .insert(detailsToInsert as any);

      if (detailError) {
        throw new Error(`Gagal menyimpan detail status: ${detailError.message}`);
      }

      revalidatePath("/reports/monthly-machine");
      revalidatePath("/(employee)/history");
      return { success: true, count: headersToInsert.length, productionId: headersToInsert[0]?.id };
    }

    // Fallback trigger Google Sheets
    const sheetUrlMock = process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    if (sheetUrlMock && headersToInsert.length > 0) {
      const payloadMock = headersToInsert.map((h, i) => ({
        "ID Laporan": h.id,
        "Tanggal Produksi": h.tgl,
        "Tanggal & Jam": h.tanggal_jam,
        Mesin: h.nomor_mc,
        Operator: h.pic,
        Design: h.design_id,
        Pick: h.pick,
        Course: h.course,
        RPM: h.rpm,
        Panel: "BERHENTI",
        "Total Downtime (Detik)": 0,
        "PCS Ke": "",
        "Hasil PCS": "",
        "Mesin Stop?": "Ya",
        "Kategori Masalah": detailsToInsert[i]?.kategori_masalah || "",
        "Keterangan Cacat": detailsToInsert[i]?.detail_masalah || inputData.status,
      }));

      fetch(sheetUrlMock, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "insert", data: payloadMock }),
      }).catch((err) => console.error("Mock webhook error:", err));
    }

    return { success: true, count: headersToInsert.length, productionId: headersToInsert[0]?.id };
  } catch (error: any) {
    console.error("Submit Status Mesin Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Mengambil spesifikasi terakhir mesin (design, rpm, pick, course) sebelum atau pada tanggal yang ditentukan.
 */
export async function getLastMachineSpec(nomorMc: string, beforeDate?: string) {
  try {
    const supabase = await createClient();

    // 1. Coba cari data produksi normal (bukan status BERHENTI / Downtime Mekanik) yang memiliki spesifikasi lengkap
    let query = supabase
      .from("production_headers")
      .select("design_id, rpm, pick, course, tgl, tanggal_jam, panel_no")
      .eq("nomor_mc", nomorMc)
      .not("design_id", "is", null)
      .neq("design_id", "")
      .not("rpm", "is", null)
      .neq("panel_no", "Downtime Mekanik (Direct)")
      .neq("panel_no", "BERHENTI");

    if (beforeDate) {
      query = query.lte("tgl", beforeDate);
    }

    const { data, error } = await query
      .order("tgl", { ascending: false })
      .order("tanggal_jam", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching last machine spec (tier 1):", error);
    }

    let resultData: { designId: string; rpm: string; pick: string; course: string; sourceDate: string } | null = null;

    if (data && (data.design_id || data.rpm || data.pick || data.course)) {
      resultData = {
        designId: data.design_id || "",
        rpm: data.rpm ? String(data.rpm) : "",
        pick: data.pick || "",
        course: data.course || "",
        sourceDate: data.tgl || "",
      };
    }

    // 2. Fallback: jika tier 1 kosong, cari data produksi apa saja (bukan BERHENTI / Downtime)
    if (!resultData) {
      let fallbackQuery = supabase
        .from("production_headers")
        .select("design_id, rpm, pick, course, tgl, tanggal_jam, panel_no")
        .eq("nomor_mc", nomorMc)
        .not("design_id", "is", null)
        .neq("design_id", "")
        .neq("panel_no", "Downtime Mekanik (Direct)")
        .neq("panel_no", "BERHENTI");

      if (beforeDate) {
        fallbackQuery = fallbackQuery.lte("tgl", beforeDate);
      }

      const { data: fbData } = await fallbackQuery
        .order("tgl", { ascending: false })
        .order("tanggal_jam", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fbData && (fbData.design_id || fbData.rpm || fbData.pick || fbData.course)) {
        resultData = {
          designId: fbData.design_id || "",
          rpm: fbData.rpm ? String(fbData.rpm) : "",
          pick: fbData.pick || "",
          course: fbData.course || "",
          sourceDate: fbData.tgl || "",
        };
      }
    }

    // 3. Fallback terakhir: jika sebelum tanggal tersebut belum ada data, ambil data paling akhir secara global
    if (!resultData) {
      const { data: latestData } = await supabase
        .from("production_headers")
        .select("design_id, rpm, pick, course, tgl, tanggal_jam, panel_no")
        .eq("nomor_mc", nomorMc)
        .not("design_id", "is", null)
        .neq("design_id", "")
        .not("rpm", "is", null)
        .neq("panel_no", "Downtime Mekanik (Direct)")
        .neq("panel_no", "BERHENTI")
        .order("tgl", { ascending: false })
        .order("tanggal_jam", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestData && (latestData.design_id || latestData.rpm || latestData.pick || latestData.course)) {
        resultData = {
          designId: latestData.design_id || "",
          rpm: latestData.rpm ? String(latestData.rpm) : "",
          pick: latestData.pick || "",
          course: latestData.course || "",
          sourceDate: latestData.tgl || "",
        };
      }
    }

    if (!resultData) {
      return { success: false, error: "Belum ada data spesifikasi sebelumnya untuk mesin ini." };
    }

    // Jika ada field spesifikasi (rpm, pick, course) yang belum terisi lengkap dari row tersebut,
    // lengkapi otomatis dari data riwayat design yang sama
    if (resultData.designId && (!resultData.rpm || !resultData.pick || !resultData.course)) {
      const { data: comp } = await supabase
        .from("production_headers")
        .select("rpm, pick, course")
        .eq("design_id", resultData.designId)
        .not("rpm", "is", null)
        .order("tgl", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (comp) {
        if (!resultData.rpm && comp.rpm) resultData.rpm = String(comp.rpm);
        if (!resultData.pick && comp.pick) resultData.pick = comp.pick;
        if (!resultData.course && comp.course) resultData.course = comp.course;
      }
    }

    return {
      success: true,
      data: resultData,
    };
  } catch (err: any) {
    console.error("Error in getLastMachineSpec:", err);
    return { success: false, error: err.message };
  }
}
