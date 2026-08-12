"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { productionFormSchema, ProductionFormInput } from "@/lib/schemas";
import { crypto } from "next/dist/compiled/@edge-runtime/primitives/crypto";
import { revalidatePath } from "next/cache";

// Helper untuk menghasilkan ID acak 8 karakter seperti di Excel (misal: e78cbacd)
function generateExcelStyleId(): string {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

export async function createProductionReport(
  inputData: ProductionFormInput,
): Promise<{
  success: boolean;
  productionId?: string;
  error?: string;
}> {
  try {
    // 1. Validasi data input secara server-side menggunakan Zod
    const validated = productionFormSchema.parse(inputData);

    const now = new Date();

    // Dapatkan waktu di zona WIB (Asia/Jakarta)
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

    // Format timestamp lengkap ke YYYY-MM-DD HH:mm:ss
    const tanggalJam = formatter.format(now);

    // Format tanggal ke YYYY-MM-DD
    const tgl = tanggalJam.split(" ")[0];

    const operatorIdNum =
      validated.operatorId && !isNaN(parseInt(validated.operatorId))
        ? parseInt(validated.operatorId)
        : null;
    const groupIdNum = validated.groupId ? parseInt(validated.groupId) : null;
    const designIdNum = validated.designId
      ? parseInt(validated.designId)
      : null;

    const rpmNum = validated.rpm ? parseInt(validated.rpm) : null;
    const potonganKeNum = validated.potonganKe
      ? parseInt(validated.potonganKe)
      : null;
    const statusInspeksiBool = null;
    const photoUrls = {
      before: validated.fotoBefore || null,
      after: validated.fotoAfter || null,
    };

    // 1. Siapkan data untuk Tabel Header
    const headerId = generateExcelStyleId();
    const panelNoNum = validated.panelNo ? parseInt(validated.panelNo) : null;
    const pcsTarget = validated.pcsData.length;

    let totalDowntimeNum = validated.totalDowntime
      ? parseInt(validated.totalDowntime)
      : 0;
    if (validated.downtimeEvents && validated.downtimeEvents.length > 0) {
      totalDowntimeNum = validated.downtimeEvents.reduce(
        (acc, curr) => acc + (curr.durasiDetik || 0),
        0,
      );
    }

    const headerData = {
      id: headerId,
      tgl,
      tanggal_jam: tanggalJam,
      operator_id: operatorIdNum,
      group_id: parseInt(validated.groupId),
      design_id: validated.designId,
      nomor_mc: validated.nomorMc || null,
      status_matching: validated.statusMatching,
      course: validated.course || null,
      rpm: validated.rpm ? parseInt(validated.rpm) : null,
      potongan_ke: validated.potonganKe ? parseInt(validated.potonganKe) : null,
      panel_no: validated.panelNo
        ? validated.isPanelGagal
          ? `${validated.panelNo} (BS)`
          : validated.panelNo
        : null,
      pcs: pcsTarget,
      tanggal_potong: validated.tanggalPotong || null,
      pick: validated.pick || null,
      no_order_barang: validated.noOrderBarang || null,
      no_customer: validated.noCustomer || null,
      jenis_benang_dasar: validated.jenisBenangDasar || null,
      liner: validated.liner || null,
      heavy: validated.heavy || null,
      shadow: validated.shadow || null,
      pinggiran: validated.pinggiran || null,
      foto_before: photoUrls.before,
      foto_after: photoUrls.after,
      total_downtime_detik: totalDowntimeNum,
      idempotency_key: validated.idempotencyKey || null,
      created_by_name: validated.created_by_name || null,
      pic: validated.pic || null,
      downtime_events:
        validated.downtimeEvents && validated.downtimeEvents.length > 0
          ? JSON.stringify(validated.downtimeEvents)
          : null,
      operator_backup: validated.operatorBackup || null,
    };

    // 2. Siapkan Data Details & Defects
    const pcsDataToProcess = validated.pcsData;

    const downtimeRecordsData: any[] = [];
    if (validated.downtimeEvents && validated.downtimeEvents.length > 0) {
      validated.downtimeEvents.forEach((dt: any) => {
        if (dt.isSubmitted) return; // Abaikan karena sudah dikirim langsung via auto-submit mekanik
        
        if (dt.problems && Array.isArray(dt.problems)) {
          dt.problems.forEach((p: any) => {
            downtimeRecordsData.push({
              header_id: headerId,
              kategori: p.kategori || dt.kategori,
              detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
              durasi_detik: dt.durasiDetik || 0,
              blok: p.blok || dt.blok || null,
              dikerjakan_oleh: dt.dikerjakanOleh || null
            });
          });
        } else if (dt.kategori) {
          downtimeRecordsData.push({
            header_id: headerId,
            kategori: dt.kategori,
            detail: dt.detail,
            durasi_detik: dt.durasiDetik || 0,
            blok: dt.blok || null,
            dikerjakan_oleh: dt.dikerjakanOleh || null
          });
        }
      });
    }

    const productionDefectsData: any[] = [];

    const detailData = pcsDataToProcess.map((pcsItem, idx) => {
      const detailId = generateExcelStyleId() + "-" + idx;
      const isBsForce = validated.isPanelGagal || pcsItem.isBs;
      const jmlHasilNum = isBsForce ? 0 : (pcsItem.jmlHasilProduksi
        ? parseInt(pcsItem.jmlHasilProduksi)
        : null);
      const pcsIndexStr = pcsItem.pcsIndex || (idx + 1).toString();
      const pcsIndexNum = parseInt(pcsIndexStr);

      // Filter event khusus untuk PCS ini atau "Semua", DAN abaikan downtime Mekanik agar tidak masuk ke cacat Panel
      const matchedEvents = validated.downtimeEvents
        ? validated.downtimeEvents.filter(
          (e) =>
            (!e.dikerjakanOleh || !e.dikerjakanOleh.startsWith("Mekanik")) &&
            (!e.pcsKe ||
              e.pcsKe === "Semua" ||
              e.pcsKe
                .split(",")
                .map((x) => x.trim())
                .includes(pcsIndexStr)),
        )
        : [];

      let kategoriStr = null;
      let detailStr = null;
      let blokStr = null;
      let indikatorStop = false;

      if (matchedEvents.length > 0) {
        const allCats = new Set<string>();
        const allDetails = new Set<string>();
        const allBloks = new Set<string>();

        matchedEvents.forEach((e: any) => {
          if (e.problems && Array.isArray(e.problems)) {
            e.problems.forEach((p: any) => {
              if (p.kategori) allCats.add(p.kategori);
              if (p.blok) allBloks.add(`Blok ${p.blok}`);
              if (p.details && Array.isArray(p.details)) {
                p.details.forEach((d: string) => {
                  allDetails.add(d);
                  
                  const expanded = expandBlockNumbers(p.blok);
                  if (expanded.length > 0) {
                    expanded.forEach(b => {
                      productionDefectsData.push({
                        production_detail_id: detailId,
                        kategori: p.kategori,
                        detail: d,
                        meter: null,
                        blok: b
                      });
                    });
                  } else {
                    productionDefectsData.push({
                      production_detail_id: detailId,
                      kategori: p.kategori,
                      detail: d,
                      meter: null,
                      blok: p.blok || null
                    });
                  }
                });
              } else if (p.kategori) {
                const expanded = expandBlockNumbers(p.blok);
                if (expanded.length > 0) {
                  expanded.forEach(b => {
                    productionDefectsData.push({
                      production_detail_id: detailId,
                      kategori: p.kategori,
                      detail: null,
                      meter: null,
                      blok: b
                    });
                  });
                } else {
                  productionDefectsData.push({
                    production_detail_id: detailId,
                    kategori: p.kategori,
                    detail: null,
                    meter: null,
                    blok: p.blok || null
                  });
                }
              }
            });
          } else if (e.kategori) {
            allCats.add(e.kategori);
            if (e.detail) allDetails.add(e.detail);
            if (e.blok) allBloks.add(`Blok ${e.blok}`);

            const expanded = expandBlockNumbers(e.blok);
            if (expanded.length > 0) {
              expanded.forEach(b => {
                productionDefectsData.push({
                  production_detail_id: detailId,
                  kategori: e.kategori,
                  detail: e.detail || null,
                  meter: null,
                  blok: b
                });
              });
            } else {
              productionDefectsData.push({
                production_detail_id: detailId,
                kategori: e.kategori,
                detail: e.detail || null,
                meter: null,
                blok: e.blok || null
              });
            }
          }
        });

        kategoriStr = Array.from(allCats).join(", ");
        detailStr = Array.from(allDetails).join(", ");
        blokStr = Array.from(allBloks).join(", ");
        indikatorStop = true;
      }

      if (isBsForce) {
        kategoriStr = "X";
      }

      let keteranganStr: string | null = null;
      if (blokStr) {
        keteranganStr = blokStr;
      }
      if (validated.jenisLaporan === "Mulai Istirahat") {
        keteranganStr = keteranganStr ? keteranganStr + " [SEBELUM ISTIRAHAT]" : "[SEBELUM ISTIRAHAT]";
      }
      if (validated.jenisLaporan === "Selesai Istirahat" || validated.jenisLaporan?.startsWith("Istirahat")) {
        keteranganStr = keteranganStr ? keteranganStr + " [LAPORAN ISTIRAHAT]" : "[LAPORAN ISTIRAHAT]";
      }

      return {
        id: detailId,
        header_id: headerId,
        pcs_index: pcsIndexNum,
        jml_hasil_produksi: jmlHasilNum,
        indikator_stop: indikatorStop,
        kategori_masalah: kategoriStr,
        detail_masalah: detailStr,
        spesifik_masalah: null,
        keterangan_cacat: keteranganStr,
        meter_kain: pcsItem.meterKain || null,
      };
    });

    // 3. Coba simpan ke database Supabase jika terkonfigurasi
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      supabaseAnonKey &&
      supabaseAnonKey !== "your_supabase_anon_key_here"
    ) {
      try {
        const supabase = await createClient();

        // Ambil nama penanggung jawab berdasarkan akun login
        try {
          if (validated.created_by_name) {
            headerData.created_by_name = validated.created_by_name;
          } else {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              const adminSupabase = await createAdminClient();
              const { data: profile } = await adminSupabase
                .from("user_profiles")
                .select("full_name")
                .eq("id", user.id)
                .single();
              if (profile) {
                headerData.created_by_name = profile.full_name;
              }
            }
          }
        } catch (err) {
          console.error("Gagal mendapatkan PIC nama:", err);
        }

        const isCutOnlySubmit = !!validated.tanggalPotong && !validated.panelNo;

        if (isCutOnlySubmit) {
          if (!validated.nomorMc || !potonganKeNum) {
            return {
              success: false,
              error: "Mesin dan Potongan wajib diisi untuk potong kain.",
            };
          }

          const { data: previousHeaders, error: previousHeadersError } =
            await supabase
              .from("production_headers")
              .select("*, production_details(*)")
              .eq("nomor_mc", validated.nomorMc)
              .eq("potongan_ke", potonganKeNum);

          if (previousHeadersError) {
            throw new Error(
              "Gagal mencari data panel untuk potong kain: " +
              previousHeadersError.message,
            );
          }

          if (!previousHeaders || previousHeaders.length === 0) {
            return {
              success: false,
              error: `Belum ada data panel untuk Mesin ${validated.nomorMc} Potongan ${potonganKeNum}. Potong kain hanya bisa update data yang sudah ada.`,
            };
          }

          const { error: cutUpdateError } = await supabase
            .from("production_headers")
            .update({ tanggal_potong: validated.tanggalPotong })
            .eq("nomor_mc", validated.nomorMc)
            .eq("potongan_ke", potonganKeNum);

          if (cutUpdateError) {
            throw new Error(
              "Gagal menyimpan tanggal potong: " + cutUpdateError.message,
            );
          }

          const sheetUrl =
            process.env.GOOGLE_SHEET_URL ||
            process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
          if (sheetUrl) {
            type CutSheetHeader = {
              id?: string | null;
              production_details?: { pcs_index?: string | number | null }[];
            };
            const massPayload: {
              id_header: string;
              pcs_index: string | number;
              tanggal_potong: string;
            }[] = [];

            for (const h of previousHeaders as CutSheetHeader[]) {
              const details = h.production_details || [];
              for (const detail of details) {
                massPayload.push({
                  id_header: h.id || "",
                  pcs_index: detail.pcs_index || "",
                  tanggal_potong: validated.tanggalPotong || "",
                });
              }
            }

            if (massPayload.length > 0) {
              fetch(sheetUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update", data: massPayload }),
              }).catch((err) =>
                console.error(
                  "Gagal sinkron tanggal potong Google Sheets:",
                  err,
                ),
              );
            }
          }

          return { success: true };
        }

        // Cek duplikasi potongan_ke dan panel_no
        // Izinkan panel yang sama jika operator berbeda (kasus Mesin Masih Stop lintas shift)
        if (potonganKeNum && validated.panelNo) {
          const operatorIdNum =
            validated.operatorId && !isNaN(parseInt(validated.operatorId))
              ? parseInt(validated.operatorId)
              : null;
          let dupQuery = supabase
            .from("production_headers")
            .select("id")
            .eq("nomor_mc", validated.nomorMc)
            .eq("potongan_ke", potonganKeNum)
            .eq("panel_no", validated.panelNo)
            .limit(1);

          // Jika ada operator, cek apakah operator yang SAMA sudah submit panel ini
          if (operatorIdNum) {
            dupQuery = dupQuery.eq("operator_id", operatorIdNum);
          }

          const { data: existingPanel } = await dupQuery;

          if (existingPanel && existingPanel.length > 0) {
            return {
              success: false,
              error: `Potongan ke-${potonganKeNum} dengan Panel ${validated.panelNo} sudah ada untuk operator ini!`,
            };
          }
        }

        // A. Insert ke Tabel Header
        const { error: insertHeaderError } = await supabase
          .from("production_headers")
          .insert(headerData);

        if (insertHeaderError) {
          if (insertHeaderError.code === "23505") {
            console.warn(
              "Idempotency key duplicate detected. Returning success.",
            );
            return { success: true };
          }
          throw new Error(
            "Gagal menyimpan header: " + insertHeaderError.message,
          );
        }

        // B. Insert ke Tabel Detail
        const { error: detailError } = await supabase
          .from("production_details")
          .insert(detailData as any);

        if (detailError)
          throw new Error(`Gagal menyimpan detail PCS: ${detailError.message}`);

        // C. Insert ke Tabel production_defects
        if (productionDefectsData.length > 0) {
          const { error: defectError } = await supabase
            .from("production_defects")
            .insert(productionDefectsData);
          if (defectError) {
            console.error("Gagal menyimpan production_defects:", defectError);
          }
        }

        // D. Insert ke Tabel downtime_records
        if (downtimeRecordsData.length > 0) {
          const { error: downtimeError } = await supabase
            .from("downtime_records")
            .insert(downtimeRecordsData);
          if (downtimeError) {
            console.error("Gagal menyimpan downtime_records:", downtimeError);
          }
        }

        // Update tanggal_potong massal untuk potongan_ke yang sama
        if (validated.tanggalPotong && validated.nomorMc && potonganKeNum) {
          // Ambil ID laporan sebelumnya yang terkait
          const { data: previousHeaders } = await supabase
            .from("production_headers")
            .select("*, production_details(*)")
            .eq("nomor_mc", validated.nomorMc)
            .eq("potongan_ke", potonganKeNum)
            .neq("id", headerId);

          await supabase
            .from("production_headers")
            .update({ tanggal_potong: validated.tanggalPotong })
            .eq("nomor_mc", validated.nomorMc)
            .eq("potongan_ke", potonganKeNum);

          // Trigger sinkronisasi update ke Google Sheets untuk panel-panel sebelumnya
          const sheetUrl =
            process.env.GOOGLE_SHEET_URL ||
            process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
          if (sheetUrl && previousHeaders && previousHeaders.length > 0) {
            // Gabungkan semua payload menjadi satu array besar
            let massPayload: any[] = [];
            for (const h of previousHeaders as any[]) {
              const details = h.production_details || [];
              for (const detail of details) {
                massPayload.push({
                  id_header: h.id,
                  pcs_index: detail.pcs_index || "",
                  tanggal_potong: validated.tanggalPotong,
                });
              }
            }

            if (massPayload.length > 0) {
              fetch(sheetUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update", data: massPayload }),
              }).catch((err) =>
                console.error("Gagal sinkron massal Google Sheets:", err),
              );
            }
          }
        }

        // C. Google Sheets sync is now handled exclusively by the background auto-sync cron job
        // to ensure lightning fast UX and prevent duplicate data race conditions.

        return { success: true, productionId: headerId };
      } catch (dbErr: any) {
        console.error("Database error details:", dbErr);
        return {
          success: false,
          error: dbErr.message || "Gagal menyimpan laporan ke database.",
        };
      }
    }

    if (validated.tanggalPotong && !validated.panelNo) {
      console.log("Mock Mode: Berhasil mensimulasikan update potong kain", {
        tanggalPotong: validated.tanggalPotong,
        nomorMc: validated.nomorMc,
        potonganKe: validated.potonganKe,
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      return { success: true };
    }

    // 3. Fallback/Mock Mode jika database belum dikonfigurasi (Demo aman)
    console.log(
      "Mock Mode: Berhasil mensimulasikan penyimpanan produksi rajut",
      {
        headerId,
        tgl,
        tanggalJam,
        validated,
      },
    );

    // C. Trigger Sinkronisasi Google Sheets (secara asinkron) bahkan di Mock Mode
    const sheetUrlMock =
      process.env.GOOGLE_SHEET_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    if (sheetUrlMock) {
      const payloadMock = detailData.map((detail: any) => ({
        "ID Laporan": headerId,
        "Tanggal Produksi": tgl || "",
        "Tanggal & Jam": tanggalJam,
        "Tanggal Potong": validated.tanggalPotong || "",
        Mesin: validated.nomorMc || "",
        Pick: validated.pick || "",
        Course: validated.course || "",
        RPM: validated.rpm ?? "",
        Operator: validated.pic || validated.operatorId?.[0] || "",
        Grup: validated.grupName || validated.groupId || "",
        Design: validated.designName || validated.designId || "",
        Panel: validated.tanggalPotong ? "" : validated.panelNo || "",
        "Potongan Ke": validated.potonganKe ?? "",
        "No Order": validated.noOrderBarang || "",
        "No Customer": validated.noCustomer || "",
        "Total Downtime (Detik)": totalDowntimeNum ?? 0,
        "Meter Awal": "",
        "Meter Akhir": "",
        "Total Produksi Meter": "",
        "PCS Ke": detail.pcs_index || "",
        "Hasil PCS": detail.jml_hasil_produksi ?? 0,
        "Meter Kain": detail.meter_kain ?? "",
        "Roll No": detail.roll_no || "",
        "Mesin Stop?": detail.indikator_stop ? "Ya" : "Tidak",
        "Kategori Masalah": detail.kategori_masalah || "",
        "Spesifik Masalah": detail.spesifik_masalah || "",
        "Keterangan Cacat": detail.keterangan_cacat || detail.jenisLaporan || "",
      }));

      fetch(sheetUrlMock, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadMock),
      }).catch((err) => console.error("Gagal sinkron Google Sheets:", err));
    }

    // Delay simulasi jaringan
    await new Promise((resolve) => setTimeout(resolve, 800));

    revalidatePath("/(employee)/history");
    return { success: true, productionId: headerId };
  } catch (err: any) {
    console.error("Server action error:", err);
    return {
      success: false,
      error: err.message || "Terjadi kesalahan sistem saat memproses laporan.",
    };
  }
}

export async function uploadProductionPhoto(
  base64Data: string,
  fileName: string,
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Hapus base64 header (contoh: data:image/jpeg;base64,)
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Image, "base64");

    const filePath = `mesin/${fileName}`;

    const { data, error } = await supabase.storage
      .from("production-photos")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from("production-photos")
      .getPublicUrl(filePath);

    return { success: true, publicUrl: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error("Server photo upload failed:", err);
    return {
      success: false,
      error: err.message || "Gagal mengunggah foto ke server.",
    };
  }
}

export async function getLastPanelNoByPotongan(
  potonganKe: number,
  nomorMc: string,
): Promise<{ success: boolean; nextPanelNo?: number; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseAnonKey === "your_supabase_anon_key_here"
    ) {
      return { success: true, nextPanelNo: 1 };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("production_headers")
      .select("panel_no")
      .eq("potongan_ke", potonganKe)
      .eq("nomor_mc", nomorMc)
      .not("panel_no", "is", null)
      .not("panel_no", "eq", "METERAN")
      .not("panel_no", "like", "%GAGAL%")
      .not("panel_no", "like", "%BS%");

    if (error) {
      console.error("Error fetching panel_no:", error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      let maxPanelNo = 0;
      for (const row of data as any[]) {
        if (row.panel_no != null) {
          const pStr = String(row.panel_no).trim();
          if (pStr && !pStr.includes("BS") && !pStr.includes("GAGAL") && pStr !== "METERAN") {
            const lastNumberMatch = pStr.match(/\d+$/);
            if (lastNumberMatch) {
              const num = parseInt(lastNumberMatch[0], 10);
              if (num > maxPanelNo) maxPanelNo = num;
            } else {
              const num = parseInt(pStr, 10);
              if (!isNaN(num) && num > maxPanelNo) maxPanelNo = num;
            }
          }
        }
      }

      if (maxPanelNo > 0) {
        return { success: true, nextPanelNo: maxPanelNo + 1 };
      }
    }

    return { success: true, nextPanelNo: 1 };
  } catch (err: any) {
    console.error("Server action error in getLastPanelNoByPotongan:", err);
    return { success: false, error: err.message };
  }
}
export async function searchEmployeeHistory(filters: {
  date?: string;
  nomor_mc?: string;
  group_id?: string;
  operator_ids?: string[];
  design_id?: string;
  potongan_ke?: string;
  tanggal_potong?: string;
  no_customer?: string;
  page?: number;
  perPage?: number;
  sortBy?: "time" | "downtime" | null;
  sortDir?: "asc" | "desc" | null;
}): Promise<{
  success: boolean;
  data?: any[];
  total?: number;
  error?: string;
}> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseAnonKey === "your_supabase_anon_key_here"
    ) {
      // Mock data for demo
      return { success: true, data: [] };
    }

    const supabase = await createClient();
    let selectFields =
      "id, tgl, tanggal_jam, pic, potongan_ke, pcs, no_order_barang, no_customer, panel_no, nomor_mc, total_downtime_detik, operator_backup, operators(nama_operator), groups(nama_grup), design_id, production_details(id, pcs_index, kategori_masalah, detail_masalah, keterangan_cacat, jml_hasil_produksi, meter_kain, production_defects(*)), created_by_name, tanggal_potong, pick, course, rpm, status_matching, jenis_benang_dasar, liner, heavy, shadow, pinggiran, downtime_events, meter_awal, meter_akhir, downtime_records(*)";

    // Prepare base query with exact count
    let query = supabase
      .from("production_headers")
      .select(selectFields, { count: "exact" });

    // Sorting
    const sortField =
      filters.sortBy === "downtime" ? "total_downtime_detik" : "tanggal_jam";
    const ascending = filters.sortDir === "asc";

    // Apply default order if not provided
    if (filters.sortBy) {
      query = query.order(sortField, { ascending });
    } else {
      query = query.order("tanggal_jam", { ascending: false });
    }

    // Removed created_by_name restriction to allow searching all history

    if (filters.date) query = query.eq("tgl", filters.date);
    if (filters.nomor_mc)
      query = query.ilike("nomor_mc", `%${filters.nomor_mc}%`);
    if (filters.group_id)
      query = query.eq("group_id", parseInt(filters.group_id));

    if (filters.operator_ids && filters.operator_ids.length > 0) {
      // Fetch operator names first to search in 'pic'
      const { data: opData } = await supabase
        .from("operators")
        .select("id, nama_operator")
        .in(
          "id",
          filters.operator_ids.map((id) => parseInt(id)),
        );

      let orConditions: string[] = [];
      if (opData && opData.length > 0) {
        opData.forEach((op) => {
          orConditions.push(`operator_id.eq.${op.id}`);
          if (op.nama_operator) {
            orConditions.push(`pic.ilike.%${op.nama_operator}%`);
          }
        });
        query = query.or(orConditions.join(","));
      } else {
        query = query.in(
          "operator_id",
          filters.operator_ids.map((id) => parseInt(id)),
        );
      }
    }

    if (filters.design_id)
      query = query.ilike("design_id", `%${filters.design_id}%`);
    if (filters.potongan_ke)
      query = query.eq("potongan_ke", parseInt(filters.potongan_ke));
    if (filters.tanggal_potong)
      query = query.eq("tanggal_potong", filters.tanggal_potong);
    if (filters.no_customer)
      query = query.ilike("no_customer", `%${filters.no_customer}%`);

    // Removed pagination from DB query because we need to group by batch first
    // We will fetch a large limit of matched rows and group them in memory
    const { data, error } = await query.limit(5000);

    if (error) {
      console.error("Error fetching history:", error);
      return { success: false, error: error.message };
    }

    // Grouping by Batch (nomor_mc + potongan_ke)
    const batchesMap = new Map<string, any>();

    (data || []).forEach((row: any) => {
      const mcNorm = (row.nomor_mc || "").trim().toUpperCase();
      const potNorm = row.potongan_ke || "";
      const key = `${mcNorm}_${potNorm}`;

      if (!batchesMap.has(key)) {
        batchesMap.set(key, {
          batch_id: key,
          nomor_mc: row.nomor_mc,
          design_id: row.design_id,
          potongan_ke: row.potongan_ke,
          tgl: row.tgl,
          tanggal_potong: row.tanggal_potong,
          no_order_barang: row.no_order_barang,
          no_customer: row.no_customer,
          pick: row.pick,
          course: row.course,
          rpm: row.rpm,
          status_matching: row.status_matching,
          jenis_benang_dasar: row.jenis_benang_dasar,
          liner: row.liner,
          heavy: row.heavy,
          shadow: row.shadow,
          pinggiran: row.pinggiran,
          // Aggregates
          total_panels: 0,
          total_meter: 0,
          total_downtime_detik: 0,
          waktu_input_terakhir: row.tanggal_jam,
          operators: new Set(),
          panels: [], // to store individual panel info if needed
          is_meter: false
        });
      }

      const batch = batchesMap.get(key);
      
      const updateIfMissing = (field: string) => {
        if (row[field] && (!batch[field] || batch[field] === "-")) {
          batch[field] = row[field];
        }
      };

      updateIfMissing("design_id");
      updateIfMissing("no_order_barang");
      updateIfMissing("no_customer");
      if (row.tanggal_potong) {
        if (!batch.tanggal_potong || batch.tanggal_potong === "-" || String(row.tanggal_potong).localeCompare(String(batch.tanggal_potong)) > 0) {
          batch.tanggal_potong = row.tanggal_potong;
        }
      }
      updateIfMissing("pick");
      updateIfMissing("course");
      updateIfMissing("rpm");
      updateIfMissing("status_matching");
      updateIfMissing("jenis_benang_dasar");
      updateIfMissing("liner");
      updateIfMissing("heavy");
      updateIfMissing("shadow");
      updateIfMissing("pinggiran");

      let currentMaxPanel = 0;
      const pStr = String(row.panel_no || "");
      const isBsRow = pStr.includes("BS") || (row.production_details && row.production_details.some((d: any) => d.kategori_masalah === "X" || d.grade === "BS"));
      
      if (!isBsRow) {
        if (row.panel_no && !isNaN(parseInt(row.panel_no))) {
          currentMaxPanel = Math.max(currentMaxPanel, parseInt(row.panel_no));
        }
        if (row.production_details && Array.isArray(row.production_details)) {
          row.production_details.forEach((det: any) => {
            if (det.pcs_index && !isNaN(parseInt(det.pcs_index))) {
              currentMaxPanel = Math.max(currentMaxPanel, parseInt(det.pcs_index));
            }
          });
        }
        if (row.pcs && !isNaN(parseInt(row.pcs))) {
          currentMaxPanel = Math.max(currentMaxPanel, parseInt(row.pcs));
        }
      }
      batch.total_panels = Math.max(batch.total_panels, currentMaxPanel);
      batch.total_downtime_detik += row.total_downtime_detik || 0;
      if (row.panel_no === "METERAN") {
        batch.is_meter = true;
        const meterAkhir = parseFloat(row.meter_akhir);
        if (!isNaN(meterAkhir)) {
          batch.total_meter = Math.max(batch.total_meter, meterAkhir);
        }
      }

      const opName = row.created_by_name || row.pic || (row.operators ? row.operators.nama_operator : null);
      if (opName) batch.operators.add(opName);

      // update latest input time and date
      if (row.tanggal_jam >= batch.waktu_input_terakhir) {
        batch.waktu_input_terakhir = row.tanggal_jam;
        if (row.tgl) batch.tgl = row.tgl;
      }

      batch.panels.push(row);
    });

    let batches = Array.from(batchesMap.values()).map(b => ({
      ...b,
      operators_list: Array.from(b.operators).join(", ")
    }));

    // Re-apply sorting on the grouped batches
    const batchSortField = filters.sortBy === "downtime" ? "total_downtime_detik" : "waktu_input_terakhir";
    const batchAscending = filters.sortDir === "asc";

    batches.sort((a, b) => {
      let valA = a[batchSortField];
      let valB = b[batchSortField];

      if (typeof valA === "string" && typeof valB === "string") {
        return batchAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return batchAscending ? valA - valB : valB - valA;
      }
      return 0;
    });

    const totalBatches = batches.length;

    // Apply pagination on batches
    let page = filters.page || 1;
    let perPage = filters.perPage || 20;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const pagedBatches = batches.slice(start, end);

    return {
      success: true,
      data: pagedBatches,
      total: totalBatches,
    };
  } catch (err: any) {
    console.error("Server action error in searchEmployeeHistory:", err);
    return { success: false, error: err.message || "Gagal memuat riwayat." };
  }
}

export async function getEmployeeHistoryDetail(
  headerId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseAnonKey === "your_supabase_anon_key_here"
    ) {
      return { success: false, error: "Database not configured." };
    }

    const supabase = await createClient();

    // Fetch Header with relations
    const { data: header, error: headerError } = await supabase
      .from("production_headers")
      .select("*, operators(nama_operator), groups(nama_grup)")
      .eq("id", headerId)
      .single();

    if (headerError) return { success: false, error: headerError.message };

    // Fetch Details with defects
    const { data: details, error: detailsError } = await supabase
      .from("production_details")
      .select("*, production_defects(*)")
      .eq("header_id", headerId)
      .order("pcs_index", { ascending: true });

    if (detailsError) return { success: false, error: detailsError.message };

    // Fetch Downtime Records
    const { data: downtime_records, error: downtimeError } = await supabase
      .from("downtime_records")
      .select("*")
      .eq("header_id", headerId);

    if (downtimeError) return { success: false, error: downtimeError.message };

    return {
      success: true,
      data: {
        ...((header || {}) as Record<string, any>),
        downtime_records: downtime_records || [],
        details: details || [],
      },
    };
  } catch (err: any) {
    console.error("Server action error in getEmployeeHistoryDetail:", err);
    return {
      success: false,
      error: err.message || "Gagal memuat detail riwayat.",
    };
  }
}

export async function updateProductionReport(
  headerId: string,
  data: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      "UPDATE PRODUCTION REPORT DATA:",
      JSON.stringify(data, null, 2),
    );
    const supabase = await createClient();

    // Parse values
    const rpmNum = data.rpm ? parseInt(data.rpm) : null;
    const potonganKeNum = data.potonganKe ? parseInt(data.potonganKe) : null;
    let totalDowntimeNum = 0;
    if (data.downtimeEvents && data.downtimeEvents.length > 0) {
      totalDowntimeNum = data.downtimeEvents.reduce(
        (acc: number, curr: any) => acc + (curr.durasiDetik || 0),
        0,
      );
    } else if (data.totalDowntime && parseInt(data.totalDowntime) > 0) {
      totalDowntimeNum = parseInt(data.totalDowntime);
    }

    // Cek duplikasi potongan_ke dan panel_no
    // Izinkan panel yang sama jika operator berbeda (kasus Mesin Masih Stop lintas shift)
    if (potonganKeNum && data.panelNo) {
      const operatorIdNum =
        data.operatorId && !isNaN(parseInt(data.operatorId))
          ? parseInt(data.operatorId)
          : null;
      let dupQuery = supabase
        .from("production_headers")
        .select("id")
        .eq("nomor_mc", data.nomorMc)
        .eq("potongan_ke", potonganKeNum)
        .eq("panel_no", data.panelNo)
        .neq("id", headerId)
        .limit(1);

      if (operatorIdNum) {
        dupQuery = dupQuery.eq("operator_id", operatorIdNum);
      }

      const { data: existingPanel } = await dupQuery;

      if (existingPanel && existingPanel.length > 0) {
        return {
          success: false,
          error: `Potongan ke-${potonganKeNum} dengan Panel ${data.panelNo} sudah ada untuk operator ini!`,
        };
      }
    }

    // 1. Update Header
    const { error: headerError } = await supabase
      .from("production_headers")
      .update({
        operator_id:
          data.operatorId &&
            !isNaN(parseInt(data.operatorId))
            ? parseInt(data.operatorId)
            : null,
        group_id: data.groupId,
        design_id: data.designId,
        nomor_mc: data.nomorMc || null,
        course: data.course || null,
        rpm: rpmNum,
        potongan_ke: potonganKeNum,
        panel_no: data.panelNo || "1",
        pcs: data.pcsData?.length || 0,
        tanggal_potong: data.tanggalPotong || null,
        pick: data.pick || null,
        pic: data.pic || null,
        created_by_name: data.created_by_name || null,
        no_order_barang: data.noOrderBarang || null,
        no_customer: data.noCustomer || null,
        jenis_benang_dasar: data.jenisBenangDasar || null,
        liner: data.liner || null,
        heavy: data.heavy || null,
        shadow: data.shadow || null,
        pinggiran: data.pinggiran || null,
        total_downtime_detik: totalDowntimeNum,
        downtime_events:
          data.downtimeEvents && data.downtimeEvents.length > 0
            ? JSON.stringify(data.downtimeEvents)
            : null,
        operator_backup: data.operatorBackup || null,
      })
      .eq("id", headerId);

    if (headerError) throw new Error(headerError.message);

    // 2. Fetch old details to preserve downstream data (inspeksi, mending, etc)
    const { data: oldDetails } = await supabase
      .from("production_details")
      .select("*")
      .eq("header_id", headerId);

    if (oldDetails && oldDetails.length > 0) {
      const oldDetailIds = oldDetails.map(d => d.id);
      // Hapus data cacat (defects) yang berelasi dengan details ini terlebih dahulu
      // untuk mencegah error foreign key violation
      await supabase
        .from("production_defects")
        .delete()
        .in("production_detail_id", oldDetailIds);
    }

    // 3. Delete old details
    const { error: delError } = await supabase
      .from("production_details")
      .delete()
      .eq("header_id", headerId);

    if (delError) throw new Error(delError.message);

    // Delete old downtime records
    await supabase.from("downtime_records").delete().eq("header_id", headerId);

    const downtimeRecordsData: any[] = [];
    if (data.downtimeEvents && data.downtimeEvents.length > 0) {
      data.downtimeEvents.forEach((dt: any) => {
        if (dt.problems && Array.isArray(dt.problems)) {
          dt.problems.forEach((p: any) => {
            downtimeRecordsData.push({
              header_id: headerId,
              kategori: p.kategori || dt.kategori,
              detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
              durasi_detik: dt.durasiDetik || 0,
              blok: p.blok || dt.blok || null
            });
          });
        } else if (dt.kategori) {
          downtimeRecordsData.push({
            header_id: headerId,
            kategori: dt.kategori,
            detail: dt.detail,
            durasi_detik: dt.durasiDetik || 0,
            blok: dt.blok || null
          });
        }
      });
    }

    const productionDefectsData: any[] = [];

    // 4. Insert new details
    if (data.pcsData && data.pcsData.length > 0) {
      const detailData = data.pcsData.map((pcsItem: any, idx: number) => {
        const detailId = generateExcelStyleId() + "-" + idx;
        const jmlHasilNum = pcsItem.jmlHasilProduksi
          ? parseInt(pcsItem.jmlHasilProduksi)
          : null;
        const pcsIndexNum = pcsItem.pcsIndex
          ? parseInt(pcsItem.pcsIndex)
          : null;

        const oldDetail = oldDetails?.find((d: any) => d.pcs_index === pcsIndexNum) || {};

        // Filter event khusus untuk PCS ini atau "Semua"
        const matchedEvents = data.downtimeEvents
          ? data.downtimeEvents.filter(
            (e: any) =>
              !e.pcsKe ||
              e.pcsKe === "Semua" ||
              e.pcsKe
                .split(",")
                .map((x: string) => x.trim())
                .includes((idx + 1).toString()),
          )
          : [];

        let kategoriStr = null;
        let detailStr = null;
        let blokStr = null;
        let indikatorStop = false;

        if (matchedEvents.length > 0) {
          const allCats = new Set<string>();
          const allDetails = new Set<string>();
          const allBloks = new Set<string>();

          matchedEvents.forEach((e: any) => {
            if (e.problems && Array.isArray(e.problems)) {
              e.problems.forEach((p: any) => {
                if (p.kategori) allCats.add(p.kategori);
                if (p.blok) allBloks.add(`Blok ${p.blok}`);
                let meterForThisPcs = "";
                if (p.meter) {
                  if (data.pcsData.length === 1) {
                    meterForThisPcs = p.meter;
                  } else {
                    const match = p.meter.match(new RegExp(`PCS ${idx + 1}:\\s*([^,]+)`));
                    if (match) meterForThisPcs = match[1].trim();
                  }
                }

                if (p.details && Array.isArray(p.details)) {
                  p.details.forEach((d: string) => {
                    let detailText = d;
                    if (meterForThisPcs) {
                      detailText += ` (Titik: ${meterForThisPcs}m)`;
                    }
                    allDetails.add(detailText);

                    productionDefectsData.push({
                      production_detail_id: oldDetail.id || detailId,
                      kategori: p.kategori,
                      detail: d,
                      meter: meterForThisPcs || null,
                      blok: p.blok || null
                    });
                  });
                } else if (p.kategori) {
                  productionDefectsData.push({
                    production_detail_id: oldDetail.id || detailId,
                    kategori: p.kategori,
                    detail: null,
                    meter: meterForThisPcs || null,
                    blok: p.blok || null
                  });
                }
              });
            } else if (e.kategori) {
              allCats.add(e.kategori);
              if (e.detail) allDetails.add(e.detail);
              if (e.blok) allBloks.add(`Blok ${e.blok}`);

              productionDefectsData.push({
                production_detail_id: oldDetail.id || detailId,
                kategori: e.kategori,
                detail: e.detail || null,
                meter: e.meter || null,
                blok: e.blok || null
              });
            }
          });

          kategoriStr = Array.from(allCats).join(", ");
          detailStr = Array.from(allDetails).join(", ");
          blokStr = Array.from(allBloks).join(", ");
          indikatorStop = true;
        }

        let keteranganStr: string | null = null;
        if (blokStr) {
          keteranganStr = blokStr;
        }

        let fallbackKeterangan = oldDetail.keterangan_cacat !== undefined ? oldDetail.keterangan_cacat : null;

        if (data.jenisLaporan !== undefined) {
          if (fallbackKeterangan) {
            fallbackKeterangan = fallbackKeterangan.replace(/\[?(LAPORAN|SEBELUM)?\s*ISTIRAHAT\]?/gi, "").trim();
            if (fallbackKeterangan === "") fallbackKeterangan = null;
          }
          if (data.jenisLaporan === "Mulai Istirahat") {
            keteranganStr = keteranganStr ? keteranganStr + " [SEBELUM ISTIRAHAT]" : "[SEBELUM ISTIRAHAT]";
          } else if (data.jenisLaporan === "Selesai Istirahat" || data.jenisLaporan?.startsWith("Istirahat")) {
            keteranganStr = keteranganStr ? keteranganStr + " [LAPORAN ISTIRAHAT]" : "[LAPORAN ISTIRAHAT]";
          }

          if (keteranganStr === null && fallbackKeterangan === null) {
            keteranganStr = ""; // Force clear if there's no defect and no fallback (like START/FINISH)
          }
        } else {
          // Pertahankan [LAPORAN ISTIRAHAT] atau [SEBELUM ISTIRAHAT] jika sebelumnya ada
          if (fallbackKeterangan) {
            if (fallbackKeterangan.includes("[LAPORAN ISTIRAHAT]")) {
              keteranganStr = keteranganStr ? keteranganStr + " [LAPORAN ISTIRAHAT]" : "[LAPORAN ISTIRAHAT]";
            } else if (fallbackKeterangan.includes("[SEBELUM ISTIRAHAT]")) {
              keteranganStr = keteranganStr ? keteranganStr + " [SEBELUM ISTIRAHAT]" : "[SEBELUM ISTIRAHAT]";
            }
          }
        }

        return {
          ...oldDetail,
          id: oldDetail.id || detailId,
          header_id: headerId,
          pcs_index: pcsIndexNum,
          jml_hasil_produksi: jmlHasilNum,
          indikator_stop: indikatorStop,
          kategori_masalah: kategoriStr,
          detail_masalah: detailStr,
          keterangan_cacat: keteranganStr !== null ? keteranganStr : (oldDetail.keterangan_cacat !== undefined ? oldDetail.keterangan_cacat : null),
          meter_kain: pcsItem.meterKain || oldDetail.meter_kain || null,
          roll_no: pcsItem.rollNo || oldDetail.roll_no || null,
        };
      });

      const { error: insertError } = await supabase
        .from("production_details")
        .insert(detailData);

      if (insertError) throw new Error(insertError.message);

      // C. Insert ke Tabel production_defects
      if (productionDefectsData.length > 0) {
        const { error: defectError } = await supabase
          .from("production_defects")
          .insert(productionDefectsData);
        if (defectError) {
          console.error("Gagal menyimpan production_defects:", defectError);
        }
      }

      // D. Insert ke Tabel downtime_records
      if (downtimeRecordsData.length > 0) {
        const { error: downtimeError } = await supabase
          .from("downtime_records")
          .insert(downtimeRecordsData);
        if (downtimeError) {
          console.error("Gagal menyimpan downtime_records:", downtimeError);
        }
      }

      // Update tanggal_potong massal untuk potongan_ke yang sama
      if (data.tanggalPotong && data.nomorMc && potonganKeNum) {
        // Ambil ID laporan sebelumnya yang terkait
        const { data: previousHeaders } = await supabase
          .from("production_headers")
          .select("*, production_details(*)")
          .eq("nomor_mc", data.nomorMc)
          .eq("potongan_ke", potonganKeNum)
          .neq("id", headerId);

        await supabase
          .from("production_headers")
          .update({ tanggal_potong: data.tanggalPotong })
          .eq("nomor_mc", data.nomorMc)
          .eq("potongan_ke", potonganKeNum);

        // Trigger sinkronisasi update ke Google Sheets untuk panel-panel sebelumnya
        const sheetUrl =
          process.env.GOOGLE_SHEET_URL ||
          process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
        if (sheetUrl && previousHeaders && previousHeaders.length > 0) {
          let massPayload: any[] = [];
          for (const h of previousHeaders as any[]) {
            const details = h.production_details || [];
            for (const detail of details) {
              massPayload.push({
                id_header: h.id,
                pcs_index: detail.pcs_index || "",
                tanggal_potong: data.tanggalPotong,
              });
            }
          }

          if (massPayload.length > 0) {
            fetch(sheetUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "update", data: massPayload }),
            }).catch((err) =>
              console.error("Gagal sinkron massal Google Sheets:", err),
            );
          }
        }
      }

      const sheetUrl =
        process.env.GOOGLE_SHEET_URL ||
        process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
      if (sheetUrl) {
        const payload = detailData.map((detail: any) => ({
          id_header: headerId,
          tanggal_jam:
            data.tanggalJam ||
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Asia/Jakarta",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(new Date()),
          mesin: data.nomorMc || "",
          pick: data.pick || "",
          course: data.course || "",
          rpm: data.rpm ?? "",
          operator: data.pic || data.operatorId?.[0] || "",
          grup: data.grupName || data.groupId || "",
          design: data.designName || data.designId || "",
          status_matching: data.statusMatching || "",
          panel: data.panelNo || "",
          potongan_ke: data.potonganKe ?? "",
          no_order: data.noOrderBarang || "",
          no_customer: data.noCustomer || "",
          total_downtime: data.totalDowntime ?? 0,
          pcs_index: detail.pcs_index || "",
          jml_hasil: detail.jml_hasil_produksi ?? 0,
          meter_kain: detail.meter_kain ?? "",
          roll_no: detail.roll_no || "",
          indikator_stop: detail.indikator_stop ? "Ya" : "Tidak",
          kategori_masalah: detail.kategori_masalah || "",
          detail_masalah: detail.detail_masalah || "",
          keterangan_cacat: detail.keterangan_cacat || "",
          meter_awal: "",
          meter_akhir: "",
          total_produksi_meter: "",
          tanggal_potong: data.tanggalPotong || "",
        }));

        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id_header: headerId,
            data: payload,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              const client = await createClient();
              await client
                .from("production_headers")
                .update({ is_synced_to_sheet: true })
                .eq("id", headerId);
            }
          })
          .catch((err) => console.error("Gagal sinkron Google Sheets:", err));
      }
    }

    revalidatePath("/(employee)/history");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating report:", err);
    return {
      success: false,
      error: err.message || "Gagal memperbarui data laporan.",
    };
  }
}
