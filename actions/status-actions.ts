"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getShiftDate, getShiftName, getJakartaDateTimeString, parseAsWibDate, getRemainingShiftSeconds } from "@/lib/shift-utils";

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
  potonganKe?: string | number;
  status: string; // e.g. "TUNGGU ORDER"
  kategoriMasalah?: string; // e.g. "A" s/d "G"
  tanggalOff?: string;
  sampaiTanggalOff?: string;
  cakupan?: "FULL_DAY" | "SHIFT";
  shiftSlot?: "SHIFT_1" | "SHIFT_2" | "SHIFT_3";
  idempotencyKey?: string;
  submittedAt?: string;
  durasiDetik?: number;
  jenisBenangDasar?: string;
  liner?: string;
  heavy?: string;
  shadow?: string;
  pinggiran?: string;
  noOrderBarang?: string;
  noCustomer?: string;
}

export async function submitStatusMesin(inputData: StatusMesinInput) {
  try {
    const now = inputData.submittedAt ? parseAsWibDate(inputData.submittedAt) : new Date();
    const currentWibDateTime = getJakartaDateTimeString(now);
    const currentDate = currentWibDateTime.split(" ")[0];
    const currentTime = currentWibDateTime.split(" ")[1] || "08:00:00";

    const operationalDate = getShiftDate(now);
    const startDateStr = inputData.tanggalOff || operationalDate;
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
    if (inputData.kategoriMasalah) {
      kategori = inputData.kategoriMasalah.trim().toUpperCase();
    } else if (statusUpper.includes("MAINTENANCE") || statusUpper.includes("SERVIS") || statusUpper.includes("OVERHAUL")) {
      kategori = "F";
    } else if (statusUpper.includes("RUSAK") || statusUpper.includes("ERROR") || statusUpper.includes("TROUBLE")) {
      kategori = "B";
    } else {
      kategori = "G";
    }

    const isFullDay = inputData.cakupan !== "SHIFT"; // Default to FULL_DAY (1 Hari Penuh)
    const headersToInsert: any[] = [];
    const detailsToInsert: any[] = [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey && supabaseAnonKey !== "your_supabase_anon_key_here");
    const supabase = hasSupabase ? await createClient() : null;

    let resolvedOperatorId: number | null = null;
    if (inputData.operatorId && !isNaN(parseInt(String(inputData.operatorId)))) {
      const parsed = parseInt(String(inputData.operatorId));
      if (!isNaN(parsed) && parsed > 0) {
        resolvedOperatorId = parsed;
      }
    }

    let resolvedPic = inputData.pic ? inputData.pic.trim() : "";

    if (supabase) {
      // 0. Anti-Double Submit: Cegah duplikasi jika laporan mesin mati identik dikirim dalam 30 detik terakhir
      if (inputData.nomorMc) {
        try {
          let dupQuery = supabase
            .from("production_headers")
            .select("id, tanggal_jam")
            .eq("nomor_mc", inputData.nomorMc)
            .eq("panel_no", "BERHENTI");

          if (inputData.potonganKe) {
            dupQuery = dupQuery.eq("potongan_ke", parseInt(String(inputData.potonganKe)));
          }

          const { data: recentDup } = await dupQuery
            .order("tanggal_jam", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (recentDup && recentDup.tanggal_jam) {
            const recentMs = parseAsWibDate(recentDup.tanggal_jam).getTime();
            const curMs = now.getTime();
            if (Math.abs(curMs - recentMs) < 30000) {
              console.warn("Mencegah duplikasi laporan mesin mati (dalam selisih 30 detik).");
              return { success: true, message: "Laporan sudah tersimpan (duplikat dicegah)." };
            }
          }
        } catch (e) {
          console.warn("Deduplication check failed:", e);
        }
      }

      // 1. If operator_id is missing but pic is provided, find in operators table
      if (!resolvedOperatorId && resolvedPic && resolvedPic !== "-" && resolvedPic.toUpperCase() !== "ADMIN") {
        try {
          const { data: opRow } = await supabase
            .from("operators")
            .select("id, nama_operator")
            .ilike("nama_operator", resolvedPic)
            .maybeSingle();
          if (opRow) {
            resolvedOperatorId = opRow.id;
            resolvedPic = opRow.nama_operator;
          }
        } catch (e) {
          console.warn("Operator lookup by name failed in submitStatusMesin:", e);
        }
      } else if (resolvedOperatorId && (!resolvedPic || resolvedPic === "-" || resolvedPic.toUpperCase() === "ADMIN")) {
        try {
          const { data: opRow } = await supabase
            .from("operators")
            .select("nama_operator")
            .eq("id", resolvedOperatorId)
            .maybeSingle();
          if (opRow?.nama_operator) {
            resolvedPic = opRow.nama_operator;
          }
        } catch (e) {
          console.warn("Operator lookup by id failed in submitStatusMesin:", e);
        }
      }
    }

    const GROUPS_CONFIG = [
      { id: 1, name: "A", time: "08:00:00" },
      { id: 2, name: "B", time: "16:00:00" },
      { id: 3, name: "C", time: "23:30:00" },
    ];

    let benangDasar = inputData.jenisBenangDasar || null;
    let liner = inputData.liner || null;
    let heavy = inputData.heavy || null;
    let shadow = inputData.shadow || null;
    let pinggiran = inputData.pinggiran || null;
    let noOrder = inputData.noOrderBarang || null;
    let noCustomer = inputData.noCustomer || null;

    // Jika parameter material benang atau order kosong, cari dari potongan yang sesuai atau potongan terakhir yang valid di mesin ini
    if (supabase && (!benangDasar || !liner || !heavy || !shadow || !pinggiran || !noOrder || !noCustomer)) {
      try {
        let refQuery = supabase
          .from("production_headers")
          .select("jenis_benang_dasar, liner, heavy, shadow, pinggiran, no_order_barang, no_customer")
          .eq("nomor_mc", inputData.nomorMc)
          .neq("panel_no", "BERHENTI");

        if (inputData.potonganKe && !isNaN(parseInt(String(inputData.potonganKe)))) {
          refQuery = refQuery.eq("potongan_ke", parseInt(String(inputData.potonganKe)));
        }

        let { data: refH } = await refQuery
          .order("tanggal_jam", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fallback ke riwayat mesin terakhir jika potongan tersebut belum memiliki data material
        if (!refH && inputData.potonganKe) {
          const { data: fallbackRefH } = await supabase
            .from("production_headers")
            .select("jenis_benang_dasar, liner, heavy, shadow, pinggiran, no_order_barang, no_customer")
            .eq("nomor_mc", inputData.nomorMc)
            .neq("panel_no", "BERHENTI")
            .order("tanggal_jam", { ascending: false })
            .limit(1)
            .maybeSingle();
          refH = fallbackRefH;
        }

        if (refH) {
          if (!benangDasar) benangDasar = refH.jenis_benang_dasar || null;
          if (!liner) liner = refH.liner || null;
          if (!heavy) heavy = refH.heavy || null;
          if (!shadow) shadow = refH.shadow || null;
          if (!pinggiran) pinggiran = refH.pinggiran || null;
          if (!noOrder) noOrder = refH.no_order_barang || null;
          if (!noCustomer) noCustomer = refH.no_customer || null;
        }
      } catch (e) {
        console.warn("Fallback query for machine stop spec failed:", e);
      }
    }

    for (const d of dates) {
      if (isFullDay) {
        // Buat 3 catatan untuk setiap shift (A, B, C) pada tanggal tersebut (8 jam = 28.800 detik per shift)
        const potonganKeNum = inputData.potonganKe ? parseInt(String(inputData.potonganKe)) : null;
        const durasiPerShift = 28800; // 8 Jam

        for (const grp of GROUPS_CONFIG) {
          const headerId = generateExcelStyleId();
          headersToInsert.push({
            id: headerId,
            tgl: d,
            tanggal_jam: `${d} ${grp.time}`,
            nomor_mc: inputData.nomorMc,
            potongan_ke: potonganKeNum,
            panel_no: "BERHENTI",
            pcs: null,
            pick: inputData.pick || null,
            course: inputData.course || null,
            rpm: inputData.rpm ? parseInt(inputData.rpm) : null,
            design_id: inputData.designId || null,
            total_downtime_detik: durasiPerShift,
            downtime_events: JSON.stringify([
              {
                kategori: kategori,
                detail: inputData.status,
                durasiDetik: durasiPerShift,
                dikerjakanOleh: resolvedPic || inputData.pic || null,
              },
            ]),
            idempotency_key: inputData.idempotencyKey ? `${inputData.idempotencyKey}-${d}-${grp.id}` : null,
            pic: resolvedPic || inputData.pic || "-",
            operator_id: resolvedOperatorId,
            group_id: grp.id,
            jenis_benang_dasar: benangDasar,
            liner: liner,
            heavy: heavy,
            shadow: shadow,
            pinggiran: pinggiran,
            no_order_barang: noOrder,
            no_customer: noCustomer,
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
        const isRealTime = !inputData.tanggalOff || inputData.tanggalOff === operationalDate;

        // Dapatkan shift aktif saat ini secara otomatis jika tidak dispesifikasikan
        const currentShiftName = getShiftName(now);
        const autoGroupId = currentShiftName === "Shift 2" ? 2 : (currentShiftName === "Shift 3" ? 3 : 1);
        const targetGroupId = inputData.grupId ? parseInt(String(inputData.grupId)) : autoGroupId;

        // Tentukan jam default & nama shift berdasarkan pilihan shiftSlot (Pagi / Siang / Malam)
        let selectedShiftName: "Shift 1" | "Shift 2" | "Shift 3" | null = null;
        let shiftDefaultTime = targetGroupId === 2 ? "16:00:00" : (targetGroupId === 3 ? "23:30:00" : "08:00:00");
        if (inputData.shiftSlot === "SHIFT_1") {
          selectedShiftName = "Shift 1";
          shiftDefaultTime = "08:00:00";
        } else if (inputData.shiftSlot === "SHIFT_2") {
          selectedShiftName = "Shift 2";
          shiftDefaultTime = "16:00:00";
        } else if (inputData.shiftSlot === "SHIFT_3") {
          selectedShiftName = "Shift 3";
          shiftDefaultTime = "23:30:00";
        }

        // Gunakan jam real-time HANYA jika tanggal adalah hari ini DAN shift yang dipilih sesuai shift aktif saat ini.
        // Jika backdate, future date, atau beda shift (misal lapor Shift Malam saat ini masih Pagi),
        // gunakan tanggal terpilih + jam representatif shift agar penempatan di Laporan Bulanan & Riwayat 100% akurat.
        const isDifferentDate = Boolean(inputData.sampaiTanggalOff) || (inputData.tanggalOff && inputData.tanggalOff !== operationalDate);
        const isSameLiveShift = !isDifferentDate && isRealTime && (!selectedShiftName || currentShiftName === selectedShiftName);
        const finalTanggalJam = isSameLiveShift ? currentWibDateTime : `${d} ${shiftDefaultTime}`;

        // Tentukan durasi downtime mesin mati
        let finalDurasiDetik = 28800; // Default 1 shift penuh (8 jam)
        if (inputData.durasiDetik && inputData.durasiDetik > 0) {
          finalDurasiDetik = inputData.durasiDetik;
        } else if (isSameLiveShift) {
          const remSec = getRemainingShiftSeconds(now);
          finalDurasiDetik = remSec > 0 ? remSec : 28800;
        }

        const potonganKeNum = inputData.potonganKe ? parseInt(String(inputData.potonganKe)) : null;
        headersToInsert.push({
          id: headerId,
          tgl: d,
          tanggal_jam: finalTanggalJam,
          nomor_mc: inputData.nomorMc,
          potongan_ke: potonganKeNum,
          panel_no: "BERHENTI",
          pcs: null,
          pick: inputData.pick || null,
          course: inputData.course || null,
          rpm: inputData.rpm ? parseInt(inputData.rpm) : null,
          design_id: inputData.designId || null,
          total_downtime_detik: finalDurasiDetik,
          downtime_events: JSON.stringify([
            {
              kategori: kategori,
              detail: inputData.status,
              durasiDetik: finalDurasiDetik,
              dikerjakanOleh: resolvedPic || inputData.pic || null,
            },
          ]),
          idempotency_key: inputData.idempotencyKey ? `${inputData.idempotencyKey}-${d}` : null,
          pic: resolvedPic || inputData.pic || "-",
          operator_id: resolvedOperatorId,
          group_id: targetGroupId,
          jenis_benang_dasar: benangDasar,
          liner: liner,
          heavy: heavy,
          shadow: shadow,
          pinggiran: pinggiran,
          no_order_barang: noOrder,
          no_customer: noCustomer,
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

    if (supabase) {

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

      // Simpan juga ke downtime_records agar sinkron dengan riwayat downtime mekanik & analitik
      try {
        const dtRecords = headersToInsert.map((h) => ({
          header_id: h.id,
          kategori: kategori,
          detail: inputData.status,
          durasi_detik: h.total_downtime_detik || 28800,
          dikerjakan_oleh: h.pic !== "-" ? h.pic : null,
        }));
        if (dtRecords.length > 0) {
          const { error: dtError } = await supabase.from("downtime_records").insert(dtRecords);
          if (dtError) {
            console.warn("Gagal menyimpan downtime_records status mesin:", dtError);
          }
        }
      } catch (errDt) {
        console.warn("Penyimpanan downtime_records dilewati:", errDt);
      }

      revalidatePath("/(dashboard)/reports/monthly-machine");
      revalidatePath("/(dashboard)/reports/mending-production");
      revalidatePath("/(dashboard)/reports/daily-inspect-mending");
      revalidatePath("/(dashboard)/shift-history");
      revalidatePath("/(dashboard)/shift-history/detail");
      revalidatePath("/(employee)/history");
      revalidatePath("/(employee)/history/detail");
      revalidatePath("/history");
      revalidatePath("/history/detail");
      revalidatePath("/reports/monthly-machine");
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
 * Mengambil spesifikasi terakhir mesin (potongan, design, rpm, pick, course, order, benang) sebelum atau pada tanggal yang ditentukan.
 */
export async function getLastMachineSpec(nomorMc: string, beforeDate?: string) {
  try {
    const supabase = await createClient();
    const specColumns =
      "potongan_ke, design_id, rpm, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, tgl, tanggal_jam, panel_no";

    const mapSpecRow = (row: any) => ({
      potonganKe: row.potongan_ke !== undefined && row.potongan_ke !== null ? String(row.potongan_ke) : "",
      designId: row.design_id || "",
      rpm: row.rpm ? String(row.rpm) : "",
      pick: row.pick || "",
      course: row.course || "",
      noOrderBarang: row.no_order_barang || "",
      noCustomer: row.no_customer || "",
      jenisBenangDasar: row.jenis_benang_dasar || "",
      liner: row.liner || "",
      heavy: row.heavy || "",
      shadow: row.shadow || "",
      pinggiran: row.pinggiran || "",
      sourceDate: row.tgl || "",
    });

    // 1. Coba cari data produksi normal (bukan status BERHENTI / Downtime Mekanik) yang memiliki spesifikasi lengkap
    let query = supabase
      .from("production_headers")
      .select(specColumns)
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

    let resultData: ReturnType<typeof mapSpecRow> | null = null;

    if (data && (data.design_id || data.rpm || data.pick || data.course)) {
      resultData = mapSpecRow(data);
    }

    // 2. Fallback: jika tier 1 kosong, cari data produksi apa saja (bukan BERHENTI / Downtime)
    if (!resultData) {
      let fallbackQuery = supabase
        .from("production_headers")
        .select(specColumns)
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
        resultData = mapSpecRow(fbData);
      }
    }

    // 3. Fallback terakhir: jika sebelum tanggal tersebut belum ada data, ambil data paling akhir secara global
    if (!resultData) {
      const { data: latestData } = await supabase
        .from("production_headers")
        .select(specColumns)
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
        resultData = mapSpecRow(latestData);
      }
    }

    if (!resultData) {
      return { success: false, error: "Belum ada data spesifikasi sebelumnya untuk mesin ini." };
    }

    // Jika ada field spesifikasi (rpm, pick, course, material) yang belum terisi lengkap dari row tersebut,
    // lengkapi otomatis dari data riwayat design yang sama
    if (
      resultData.designId &&
      (!resultData.rpm || !resultData.pick || !resultData.course || !resultData.jenisBenangDasar)
    ) {
      const { data: comp } = await supabase
        .from("production_headers")
        .select("rpm, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran")
        .eq("design_id", resultData.designId)
        .not("rpm", "is", null)
        .order("tgl", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (comp) {
        if (!resultData.rpm && comp.rpm) resultData.rpm = String(comp.rpm);
        if (!resultData.pick && comp.pick) resultData.pick = comp.pick;
        if (!resultData.course && comp.course) resultData.course = comp.course;
        if (!resultData.noOrderBarang && comp.no_order_barang) resultData.noOrderBarang = comp.no_order_barang;
        if (!resultData.noCustomer && comp.no_customer) resultData.noCustomer = comp.no_customer;
        if (!resultData.jenisBenangDasar && comp.jenis_benang_dasar) resultData.jenisBenangDasar = comp.jenis_benang_dasar;
        if (!resultData.liner && comp.liner) resultData.liner = comp.liner;
        if (!resultData.heavy && comp.heavy) resultData.heavy = comp.heavy;
        if (!resultData.shadow && comp.shadow) resultData.shadow = comp.shadow;
        if (!resultData.pinggiran && comp.pinggiran) resultData.pinggiran = comp.pinggiran;
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

/**
 * Memperbarui durasi downtime untuk laporan mesin mati / berhenti yang sudah tersimpan di database.
 */
export async function updateMachineStopDuration(input: {
  headerIds: string[];
  durasiDetik: number;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey && supabaseAnonKey !== "your_supabase_anon_key_here");
    if (!hasSupabase) return { success: false, error: "Database tidak aktif." };

    const supabase = await createClient();
    if (!supabase) return { success: false, error: "Gagal terhubung ke database." };

    const validHeaderIds = (input.headerIds || []).filter(Boolean);
    if (validHeaderIds.length === 0) {
      return { success: false, error: "ID laporan tidak ditemukan." };
    }

    const { error: headerErr } = await supabase
      .from("production_headers")
      .update({ total_downtime_detik: input.durasiDetik })
      .in("id", validHeaderIds);

    if (headerErr) {
      return { success: false, error: headerErr.message };
    }

    // Perbarui atau tambahkan catatan di downtime_records
    for (const hId of validHeaderIds) {
      try {
        const { data: existingRec } = await supabase
          .from("downtime_records")
          .select("id")
          .eq("header_id", hId)
          .limit(1)
          .maybeSingle();

        if (existingRec) {
          await supabase
            .from("downtime_records")
            .update({ durasi_detik: input.durasiDetik })
            .eq("id", existingRec.id);
        } else {
          const { data: hData } = await supabase
            .from("production_headers")
            .select("pic, production_details(kategori_masalah, detail_masalah)")
            .eq("id", hId)
            .maybeSingle();

          const pDet = hData?.production_details?.[0];
          await supabase.from("downtime_records").insert({
            header_id: hId,
            kategori: pDet?.kategori_masalah || "A",
            detail: pDet?.detail_masalah || "Mesin Berhenti",
            durasi_detik: input.durasiDetik,
            dikerjakan_oleh: hData?.pic !== "-" ? hData?.pic : null,
          });
        }
      } catch (e) {
        console.warn("Gagal memperbarui downtime_records untuk header", hId, e);
      }
    }

    revalidatePath("/(employee)/history");
    revalidatePath("/(employee)/history/detail");
    revalidatePath("/history");
    revalidatePath("/history/detail");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateMachineStopDuration:", err);
    return { success: false, error: err?.message || "Gagal memperbarui durasi mesin mati." };
  }
}

