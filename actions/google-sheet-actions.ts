"use server";

import { createClient } from "@/lib/supabase/server";

export interface GoogleSheetConfigItem {
  id: string;
  report_name: string;
  spreadsheet_id?: string | null;
  web_app_url: string;
  description?: string | null;
  is_active: boolean;
  updated_at?: string;
}

// Mesin yang dikecualikan dari seluruh sinkronisasi Google Sheets (manual, auto-sync, maupun real-time)
const EXCLUDED_SHEET_SYNC_MACHINES = new Set(["R13", "R14"]);

function isExcludedSheetSyncMachine(mc?: string | null): boolean {
  if (!mc) return false;
  return EXCLUDED_SHEET_SYNC_MACHINES.has(String(mc).trim().toUpperCase());
}

function notifySchedulerCacheInvalidation() {
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).__dji_scheduler_cache_invalidate === "function") {
    try {
      (globalThis as any).__dji_scheduler_cache_invalidate();
    } catch {}
  }
}

/**
 * Mengambil seluruh konfigurasi integrasi Google Sheets dari database
 */
export async function getGoogleSheetConfigs(): Promise<{
  success: boolean;
  data?: GoogleSheetConfigItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error in getGoogleSheetConfigs:", error);
      return { success: false, error: error.message };
    }

    const list = (data || []) as GoogleSheetConfigItem[];

    // Pastikan entri konfigurasi Laporan Per Desain tersedia otomatis di halaman Admin > Integrasi Google Sheets
    if (!list.some((item) => item.id === "design_report")) {
      const defaultDesignConfig: GoogleSheetConfigItem = {
        id: "design_report",
        report_name: "Laporan Per Desain (Rekap Efisiensi per Mesin)",
        spreadsheet_id: "13sfmyL16FrzTGormUKUrykUv_OykXoQrT2Kikm_ieBg",
        web_app_url: "",
        description:
          "Sinkronisasi Laporan Per Desain ke tab masing-masing mesin (R1, R2, R11, R12, T2A, dll.) menggunakan blok bertanda per periode agar data historis manual tetap aman.",
        is_active: true,
      };
      const { error: seedErr } = await supabase
        .from("google_sheet_configs")
        .upsert(defaultDesignConfig, { onConflict: "id" });
      if (!seedErr) {
        list.push(defaultDesignConfig);
      }
    }

    // Pastikan entri konfigurasi Arsip Otomatis PDF ke Google Drive tersedia otomatis di halaman Admin > Integrasi Google Sheets
    if (!list.some((item) => item.id === "drive_pdf_archive")) {
      const defaultDrivePdfConfig: GoogleSheetConfigItem = {
        id: "drive_pdf_archive",
        report_name: "Arsip Otomatis PDF Riwayat Input (Google Drive)",
        spreadsheet_id: "",
        web_app_url: "",
        description:
          "Upload otomatis file PDF Laporan Hasil Produksi per potongan ke Google Drive (Folder: Tahun / Bulan / Mesin) saat Potong Kain maupun selesai QC/Mending. Isi kolom Spreadsheet ID dengan Folder ID Google Drive tujuan (opsional, kosongkan untuk folder otomatis 'Arsip Laporan Produksi DJI').",
        is_active: true,
      };
      const { error: seedDriveErr } = await supabase
        .from("google_sheet_configs")
        .upsert(defaultDrivePdfConfig, { onConflict: "id" });
      if (!seedDriveErr) {
        list.push(defaultDrivePdfConfig);
      }
    }

    return { success: true, data: list };
  } catch (err: any) {
    console.error("Error in getGoogleSheetConfigs:", err);
    return { success: false, error: err.message || "Gagal mengambil konfigurasi Google Sheets" };
  }
}

/**
 * Mengupdate URL Web App atau Spreadsheet ID untuk laporan tertentu
 */
export async function updateGoogleSheetConfig(
  id: string,
  payload: {
    web_app_url: string;
    spreadsheet_id?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("google_sheet_configs")
      .update({
        web_app_url: payload.web_app_url.trim(),
        spreadsheet_id: payload.spreadsheet_id ? payload.spreadsheet_id.trim() : null,
        is_active: payload.is_active !== undefined ? payload.is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating google_sheet_config:", error);
      return { success: false, error: error.message };
    }

    notifySchedulerCacheInvalidation();
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateGoogleSheetConfig:", err);
    return { success: false, error: err.message || "Gagal menyimpan konfigurasi" };
  }
}

/**
 * Mengambil URL Google Sheets Web App untuk jenis laporan tertentu
 * (Mencari di database, dengan fallback ke .env)
 */
export async function getGoogleSheetEndpoint(reportId: string): Promise<{
  url: string | null;
  spreadsheetId: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("google_sheet_configs")
      .select("web_app_url, spreadsheet_id, is_active")
      .eq("id", reportId)
      .single();

    if (data && data.is_active && data.web_app_url) {
      return {
        url: data.web_app_url,
        spreadsheetId: data.spreadsheet_id || null,
      };
    }

    // Jangan fallback ke URL sheet umum untuk Arsip PDF Google Drive
    if (reportId === "drive_pdf_archive") {
      return { url: null, spreadsheetId: null };
    }

    // Fallback ke .env
    const envUrl = process.env.NEXT_PUBLIC_REPORT_GOOGLE_SHEET_URL;
    return {
      url: envUrl || null,
      spreadsheetId: null,
    };
  } catch (err) {
    return { url: null, spreadsheetId: null };
  }
}

/**
 * Mengirim payload sinkronisasi ke Google Apps Script via backend (Server Action)
 * Ini mencegah error CORS browser dan menangani redirect Google secara otomatis.
 */
export async function sendPayloadToGoogleSheet(
  reportId: string,
  payload: any
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  updatedCount?: number;
  skippedCount?: number;
}> {
  try {
    const endpoint = await getGoogleSheetEndpoint(reportId);
    const sheetUrl = endpoint.url;
    if (!sheetUrl) {
      return {
        success: false,
        error: "URL Google Sheets belum diatur di menu Admin > Integrasi Google Sheets atau di .env",
      };
    }

    if (endpoint.spreadsheetId && !payload.spreadsheetId) {
      payload.spreadsheetId = endpoint.spreadsheetId;
    }

    const res = await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store",
    });

    const text = await res.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(text);
    } catch (_) {
      // Extract specific error message from Google Apps Script error page if present
      const match = text.match(/max-width:600px">([\s\S]*?)<\/div>/i) || 
                    text.match(/class="errorMessage"[^>]*>([\s\S]*?)<\/div>/i) ||
                    text.match(/<title>(.*?)<\/title>/i);
      
      if (match && match[1] && !match[1].includes("Google Drive") && !match[1].includes("Accounts")) {
        return {
          success: false,
          error: "Google Sheets Script: " + match[1].trim(),
        };
      }

      if (text.includes("accounts.google.com") || text.includes("ServiceLogin")) {
        return {
          success: false,
          error: "Akses Google Apps Script ditolak. Pastikan saat Deploy Web App di Apps Script, pilihan 'Who has access' (Siapa yang memiliki akses) diatur ke 'Anyone' (Siapa saja).",
        };
      }
      return {
        success: false,
        error: "Respon dari Google Sheets: " + text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
      };
    }

    if (resJson && resJson.success === false) {
      return {
        success: false,
        error: resJson.error || resJson.message || "Gagal sinkronisasi data ke Google Sheets",
      };
    }

    return {
      success: true,
      message: resJson?.message || "Sukses sinkronisasi data ke Google Sheets!",
      updatedCount: resJson?.updatedCount,
      skippedCount: resJson?.skippedCount,
    };
  } catch (err: any) {
    console.error("Error sending payload to Google Sheets:", err);
    return {
      success: false,
      error: err.message || "Gagal terhubung ke Google Sheets API.",
    };
  }
}

/**
 * Mengambil pengaturan jadwal sinkronisasi otomatis harian (Cron 09:00 WIB)
 */
export async function getAutoSyncScheduleSettings(): Promise<{
  success: boolean;
  time: string;
  enabled: boolean;
  safeMode: boolean;
  machines?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("web_app_url, is_active, description")
      .eq("id", "auto_sync_schedule")
      .single();

    if (error || !data) {
      return {
        success: true,
        time: "09:00",
        enabled: true,
        safeMode: true,
        machines: undefined,
      };
    }

    let parsedMachines: string[] | undefined;
    if (data.description) {
      const match = data.description.match(/machines=([A-Za-z0-9_,]+)/);
      if (match && match[1]) {
        parsedMachines = match[1].split(",").map((m: string) => m.trim()).filter(Boolean);
      }
    }

    return {
      success: true,
      time: data.web_app_url || "09:00",
      enabled: data.is_active !== false,
      safeMode: !data.description?.includes("safeMode=false"),
      machines: parsedMachines,
    };
  } catch (err: any) {
    return {
      success: true,
      time: "09:00",
      enabled: true,
      safeMode: true,
    };
  }
}

/**
 * Menyimpan pengaturan jadwal sinkronisasi otomatis harian
 */
export async function updateAutoSyncScheduleSettings(payload: {
  time: string;
  enabled: boolean;
  safeMode: boolean;
  machines?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const machinesStr = payload.machines && payload.machines.length > 0 ? ` (machines=${payload.machines.join(",")})` : "";
    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: "auto_sync_schedule",
        report_name: "Jadwal Otomatis Harian (Cron)",
        web_app_url: payload.time.trim(),
        is_active: payload.enabled,
        description: `Waktu auto-sync harian: ${payload.time} WIB (safeMode=${payload.safeMode})${machinesStr}`,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }
    notifySchedulerCacheInvalidation();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menyimpan jadwal" };
  }
}

/**
* Sinkronisasi seluruh mesin aktif secara bersamaan
 * Mendukung filter tanggal tertentu (startDay s.d. endDay) dan mode aman
 */
export async function syncAllMonthlyMachines(
  monthOrOptions?: number | {
    month?: number;
    year?: number;
    safeMode?: boolean;
    startDay?: number;
    endDay?: number;
    targetDays?: number[];
    machines?: string[];
  },
  year?: number,
  safeMode = true,
  startDay?: number,
  endDay?: number
): Promise<{
  success: boolean;
  message: string;
  results: Array<{
    machine: string;
    success: boolean;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }>;
}> {
  const { getMonthlyMachineReport } = await import("@/actions/report-actions");
  const { REGISTERED_MACHINES } = await import("@/lib/constants");

  let targetMonth: number;
  let targetYear: number;
  let targetSafeMode = safeMode;
  let targetStartDay = startDay;
  let targetEndDay = endDay;
  let targetDaysList: number[] | undefined;

  if (typeof monthOrOptions === "object" && monthOrOptions !== null) {
    targetMonth = monthOrOptions.month || new Date().getMonth() + 1;
    targetYear = monthOrOptions.year || new Date().getFullYear();
    targetSafeMode = monthOrOptions.safeMode !== undefined ? monthOrOptions.safeMode : true;
    targetStartDay = monthOrOptions.startDay;
    targetEndDay = monthOrOptions.endDay;
    targetDaysList = monthOrOptions.targetDays;
  } else {
    targetMonth = monthOrOptions || new Date().getMonth() + 1;
    targetYear = year || new Date().getFullYear();
  }

  const monthNames = [
    "", "Januari", "Februari", "Maret", "APRIL", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const targetSheetName = `${monthNames[targetMonth]} ${targetYear}`;

  const syncSingleMachine = async (mc: string) => {
    try {
      const rep = await getMonthlyMachineReport(targetMonth, targetYear, mc);
      if (!rep.success || !rep.data) {
        return {
          machine: mc,
          success: false,
          error: rep.error || "Gagal mengambil data laporan dari database",
        };
      }

      const structuredItems = rep.data.map((dayData: any) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData ? dayData.teamData["A"] : null },
          { teamName: "B", data: dayData.teamData ? dayData.teamData["B"] : null },
          { teamName: "C", data: dayData.teamData ? dayData.teamData["C"] : null },
        ];

        return {
          tanggal: dayData.tanggal,
          teams: teamsToRender.map((teamObj: any) => {
            const td = teamObj.data;
            if (!td) {
              return {
                team: teamObj.teamName,
                desain: "",
                keterangan: "",
                courses: "",
                rpm: "",
                eff_100: 0,
                operator_name: "",
                hasil_produksi: 0,
                jumlah_cacat: 0,
                kode_tindakan: {},
                downtime_detik: 0,
                downtime_formatted: "",
              };
            }

            let potongKainStr = "";
            if (td.potong_kain_list && td.potong_kain_list.length > 0) {
              potongKainStr = td.potong_kain_list
                .map((p: string) => `Potong Kain Ke-${String(p).replace(/^ke-?/i, "").trim()}`)
                .join(", ");
            }

            let khususStr = "";
            if (td.laporan_khusus_list && td.laporan_khusus_list.length > 0) {
              khususStr = td.laporan_khusus_list
                .map((item: any) => {
                  const timeRange =
                    item.waktu_mulai && item.waktu_selesai
                      ? ` (${item.waktu_mulai} - ${item.waktu_selesai})`
                      : item.waktu_mulai
                      ? ` (${item.waktu_mulai})`
                      : "";
                  return `[${item.kategori}] ${item.detail}${timeRange}`;
                })
                .join(" | ");
            }

            let ketString = "";
            if (td.keterangan_per_kategori && Object.keys(td.keterangan_per_kategori).length > 0) {
              ketString = Object.entries(td.keterangan_per_kategori)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([kat, details]) => {
                  const counts: Record<string, number> = {};
                  ((details as string[]) || []).forEach((d: string) => {
                    const key = (d || "").trim();
                    if (!key) return;
                    counts[key] = (counts[key] || 0) + 1;
                  });
                  const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                  return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
                }).join(" | ");
            }

            const fullKeterangan = [potongKainStr, khususStr, ketString].filter(Boolean).join(" | ");

            const formatSec = (totalSec: number) => {
              if (!totalSec || totalSec <= 0) return "";
              const hours = Math.floor(totalSec / 3600);
              const minutes = Math.floor((totalSec % 3600) / 60);
              const seconds = totalSec % 60;
              const pad = (n: number) => (n < 10 ? "0" : "") + n;
              return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            };

            return {
              team: teamObj.teamName,
              desain: td.desain || "",
              keterangan: fullKeterangan,
              courses: td.courses || "",
              rpm: td.rpm || "",
              eff_100: td.eff_100 || 0,
              operator_name: td.operator_name || "",
              hasil_produksi: td.hasil_produksi || 0,
              jumlah_cacat: td.jumlah_cacat || 0,
              kode_tindakan: td.kode_tindakan || {},
              downtime_detik: td.downtime_detik || 0,
              downtime_formatted: formatSec(td.downtime_detik || 0),
            };
          }),
        };
      });

      const syncRes = await sendPayloadToGoogleSheet("monthly_machine", {
        action: "sync_monthly_report",
        machine: mc,
        sheetName: targetSheetName,
        month: targetMonth,
        year: targetYear,
        isMeterMachine: rep.isMeterMachine,
        safeMode: targetSafeMode,
        startDay: targetStartDay,
        endDay: targetEndDay,
        targetDays: targetDaysList,
        items: structuredItems,
      });

      return {
        machine: mc,
        success: syncRes.success,
        updatedCount: syncRes.updatedCount,
        skippedCount: syncRes.skippedCount,
        error: syncRes.error,
      };
    } catch (err: any) {
      return {
        machine: mc,
        success: false,
        error: err.message || "Error saat memproses sinkronisasi",
      };
    }
  };

  const results: Array<{
    machine: string;
    success: boolean;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }> = [];

  const rawMachinesToSync = (typeof monthOrOptions === "object" && monthOrOptions?.machines && monthOrOptions.machines.length > 0)
    ? monthOrOptions.machines
    : REGISTERED_MACHINES;
  const machinesToSync = rawMachinesToSync.filter((mc) => !isExcludedSheetSyncMachine(mc));

  const chunkSize = 5;
  for (let i = 0; i < machinesToSync.length; i += chunkSize) {
    const chunk = machinesToSync.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map((mc) => syncSingleMachine(mc)));
    results.push(...chunkResults);
  }

  const successfulCount = results.filter(r => r.success).length;
  return {
    success: successfulCount > 0,
    message: `Selesai sinkronisasi: ${successfulCount} dari ${machinesToSync.length} mesin berhasil disinkronkan ke sheet '${targetSheetName}'.`,
    results,
  };
}

/**
 * Mengambil pengaturan jadwal sinkronisasi otomatis Laporan Potong Kain
 */
export async function getPotongKainScheduleSettings(): Promise<{
  success: boolean;
  time: string;
  enabled: boolean;
  safeMode: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("web_app_url, is_active, description")
      .eq("id", "schedule_potong_kain")
      .single();

    if (error || !data) {
      return {
        success: true,
        time: "17:00",
        enabled: true,
        safeMode: true,
      };
    }

    return {
      success: true,
      time: data.web_app_url || "17:00",
      enabled: data.is_active !== false,
      safeMode: !data.description?.includes("safeMode=false"),
    };
  } catch (err: any) {
    return {
      success: true,
      time: "17:00",
      enabled: true,
      safeMode: true,
    };
  }
}

/**
 * Menyimpan pengaturan jadwal sinkronisasi otomatis Laporan Potong Kain
 */
export async function updatePotongKainScheduleSettings(payload: {
  time: string;
  enabled: boolean;
  safeMode: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: "schedule_potong_kain",
        report_name: "Jadwal Auto-Sync Laporan Potong Kain",
        web_app_url: payload.time.trim(),
        is_active: payload.enabled,
        description: `Waktu auto-sync potong kain: ${payload.time} WIB (safeMode=${payload.safeMode})`,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }
    notifySchedulerCacheInvalidation();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menyimpan jadwal potong kain" };
  }
}

/**
 * Helper terpusat untuk memformat 1 batch potong kain menjadi 1 baris payload Google Sheets
 */
function formatPotongKainBatchToSheetRow(batch: any) {
  const header = batch.header || {};
  const firstItem = batch.items?.[0] || {};
  const tanggalBeres = header.tanggal_potong || header.tgl || "";
  const obRaw = header.no_order_barang || "";
  const explicitJenisOb = String(batch.jenis_ob || header.jenis_ob || "").toUpperCase().trim();
  let obStm = "";
  let obDji = "";
  if (explicitJenisOb === "DJI") {
    obDji = obRaw;
  } else if (explicitJenisOb === "STM") {
    obStm = obRaw;
  } else if (obRaw.toUpperCase().includes("DJI") || obRaw.toUpperCase().includes("DEX")) {
    obDji = obRaw;
  } else {
    obStm = obRaw;
  }

  let panelCount = batch.total_panel || 0;
  if (batch.items && batch.items.length > 0) {
    let regPanels = 0;
    let totalBs = 0;
    batch.items.forEach((it: any) => {
      const pNo = String(it.detail?.header?.panel_no || it.header?.panel_no || "").trim().toUpperCase();
      if (pNo.includes("BS") || pNo.includes("AWAL") || pNo.includes("AKHIR") || it.detail?.jml_hasil_produksi === 0) {
        totalBs += 1;
      } else if (pNo !== "METERAN" && pNo !== "START" && pNo !== "FINISH") {
        regPanels += 1;
      }
    });
    if (regPanels > 0 || totalBs > 0) panelCount = regPanels + totalBs;
  }

  let qtyKg = firstItem.qc_batch?.berat_kain;
  if (!qtyKg && batch.items) {
    const it = batch.items.find((i: any) => i.qc_batch?.berat_kain);
    if (it) qtyKg = it.qc_batch?.berat_kain;
  }

  const groupNames = new Set<string>();
  if (header.groups?.nama_grup) groupNames.add(header.groups.nama_grup);
  batch.items?.forEach((i: any) => {
    if (i.detail?.header?.groups?.nama_grup) groupNames.add(i.detail.header.groups.nama_grup);
  });
  const shift = Array.from(groupNames).join(", ") || "-";

  // Ambil Jam Potong Kain: prioritas timestamp terbesar (panel terakhir / BS AKHIR) dalam zona waktu WIB
  let jam = "";
  let latestCutTs = 0;
  let latestCutDate: Date | null = null;
  const candidateDates: string[] = [];
  if (header.tanggal_potong && String(header.tanggal_potong).includes(":")) {
    candidateDates.push(String(header.tanggal_potong));
  }
  batch.items?.forEach((i: any) => {
    const tp = i.detail?.header?.tanggal_potong || i.header?.tanggal_potong;
    if (tp && String(tp).includes(":")) candidateDates.push(String(tp));
    const tj = i.detail?.header?.tanggal_jam || i.header?.tanggal_jam;
    if (tj) candidateDates.push(String(tj));
  });
  if (candidateDates.length === 0 && header.tanggal_jam) {
    candidateDates.push(String(header.tanggal_jam));
  }
  candidateDates.forEach((ds) => {
    try {
      const d = new Date(ds);
      const t = d.getTime();
      if (!isNaN(t) && t >= latestCutTs) {
        latestCutTs = t;
        latestCutDate = d;
      }
    } catch {}
  });
  if (latestCutDate) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(latestCutDate);
      const hh = parts.find((p) => p.type === "hour")?.value || "00";
      const mm = parts.find((p) => p.type === "minute")?.value || "00";
      jam = `${hh}:${mm}`;
    } catch {}
  }

  const rawKet = batch.keterangan_mending || batch.keterangan_final || "";
  const ket = rawKet.replace(/\[PAUSE:\d+\]/gi, "").replace(/\[ELAPSED:\d+\]/gi, "").trim();
  const potKe = String(batch.potongan_ke || "");
  const pcsIndex = String(batch.pcs_index || firstItem.detail?.pcs_index || "1");
  const batchKey = `${potKe}_${pcsIndex}`;

  return {
    batchId: batch.id,
    batchKey,
    tanggalBeres,
    obStm,
    obDji,
    design: header.design_id || "",
    lebar: header.lebar || "",
    rollPnl: panelCount,
    qtyKg: qtyKg || "",
    jam,
    shift,
    potonganKe: potKe,
    pcsKe: pcsIndex,
    grade: batch.final_grade_a > 0 ? "A" : (batch.final_grade_b > 0 ? "B" : "C"),
    tglMending: batch.tanggal_mending || batch.tanggal_final || "",
    tglPengiriman: "",
    customer: header.no_customer || "",
    ket: ket || "-",
  };
}

/**
 * Sinkronisasi data Potong Kain untuk 1 mesin tertentu ke Google Sheets
 */
export async function syncPotongKainToGoogleSheet(
  machine: string,
  year?: string,
  safeMode = true,
  month?: string,
  onlyUnsynced = true
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  appendedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
}> {
  try {
    if (isExcludedSheetSyncMachine(machine)) {
      return {
        success: true,
        message: `Mesin ${machine} dikecualikan dari sinkronisasi Google Sheets (dilewati).`,
        appendedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };
    }

    const { getMendingReportData } = await import("@/actions/mending-actions");
    const res = await getMendingReportData(machine);

    if (!res.success || !res.data) {
      return { success: false, error: res.error || "Gagal mengambil data potong kain dari database" };
    }

    const currentYear = year || new Date().getFullYear().toString();
    const filterPrefix = month || currentYear;

    const filteredData = res.data.filter((d: any) => {
      const tgl = d.header?.tanggal_potong || d.header?.tgl || d.tanggal_mending;
      if (!tgl) return false;
      return tgl.startsWith(filterPrefix);
    });

    if (filteredData.length === 0) {
      return { 
        success: false, 
        error: `Tidak ada data potong kain ditemukan untuk mesin ${machine} pada tahun ${currentYear}.` 
      };
    }

    // Format rows
    const rows = filteredData
      .map((batch: any) => formatPotongKainBatchToSheetRow(batch))
      .sort((a: any, b: any) => Number(a.potonganKe || 0) - Number(b.potonganKe || 0));

    // Filter jika hanya ingin data yang belum pernah di-sync
    let rowsToSync = rows;
    if (onlyUnsynced) {
      const statusRes = await getPotongKainSyncStatus(machine);
      const syncedSet = new Set(statusRes.syncedKeys || []);
      rowsToSync = rows.filter((r: any) => !syncedSet.has(r.batchKey));

      if (rowsToSync.length === 0) {
        return {
          success: true,
          message: `Semua data potong kain mesin ${machine} sudah berstatus tersinkron (${rows.length} data). Tidak ada data baru yang perlu dikirim.`,
          appendedCount: 0,
          updatedCount: 0,
          skippedCount: rows.length,
        };
      }
    }

    // Kirim payload ke Google Sheet potong_kain
    const syncRes = await sendPayloadToGoogleSheet("potong_kain", {
      action: "sync_potong_kain",
      machine,
      sheetName: machine,
      year: currentYear,
      period: filterPrefix,
      safeMode,
      rows: rowsToSync,
    });

    // Jika sukses, tandai baris yang dikirim sebagai tersinkron
    if (syncRes && syncRes.success) {
      const syncedKeysAdded = rowsToSync.map((r: any) => r.batchKey);
      await markPotongKainSynced(machine, syncedKeysAdded);
    }

    return syncRes;
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal sinkronisasi potong kain" };
  }
}

/**
 * Sinkronisasi data Potong Kain untuk seluruh 10 mesin secara berurutan (Bulan Ini)
 */
export async function syncAllPotongKainMachines(
  year?: string,
  safeMode = true,
  month?: string,
  onlyUnsynced = true
): Promise<{
  success: boolean;
  message: string;
  results: Array<{
    machine: string;
    success: boolean;
    appendedCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }>;
}> {
  const { REGISTERED_MACHINES } = await import("@/lib/constants");
  const eligibleMachines = REGISTERED_MACHINES.filter((mc) => !isExcludedSheetSyncMachine(mc));
  const results = [];

  for (const mc of eligibleMachines) {
    try {
      const res = await syncPotongKainToGoogleSheet(mc, year, safeMode, month, onlyUnsynced);
      results.push({
        machine: mc,
        success: res.success,
        appendedCount: res.appendedCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
        error: res.error,
      });
    } catch (err: any) {
      results.push({
        machine: mc,
        success: false,
        error: err.message || "Error saat sinkronisasi",
      });
    }
  }

  const successfulCount = results.filter(r => r.success).length;
  return {
    success: successfulCount > 0,
    message: `Selesai sinkronisasi: ${successfulCount} dari ${REGISTERED_MACHINES.length} mesin berhasil diproses.`,
    results,
  };
}

/**
 * Mengambil daftar kunci potongan yang sudah pernah disinkronkan untuk mesin tertentu
 */
export async function getPotongKainSyncStatus(machine: string): Promise<{
  success: boolean;
  syncedKeys: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("description")
      .eq("id", `sync_keys_potong_${machine}`)
      .single();

    if (error || !data || !data.description) {
      return { success: true, syncedKeys: [] };
    }

    try {
      const keys = JSON.parse(data.description);
      return { success: true, syncedKeys: Array.isArray(keys) ? keys : [] };
    } catch {
      return { success: true, syncedKeys: [] };
    }
  } catch (err: any) {
    return { success: false, syncedKeys: [], error: err.message };
  }
}

/**
 * Menandai daftar potongan sebagai sudah tersinkron
 */
export async function markPotongKainSynced(
  machine: string,
  newKeys: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newKeys || newKeys.length === 0) return { success: true };
    const supabase = await createClient();
    
    const currentRes = await getPotongKainSyncStatus(machine);
    const existingSet = new Set(currentRes.syncedKeys || []);
    newKeys.forEach((k) => existingSet.add(k));

    const updatedKeys = Array.from(existingSet);

    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: `sync_keys_potong_${machine}`,
        report_name: `Sync Keys Potong Kain - ${machine}`,
        web_app_url: machine,
        is_active: true,
        description: JSON.stringify(updatedKeys),
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Menghapus tanda sync (Unsync) untuk 1 potongan tertentu
 */
export async function unmarkPotongKainSynced(
  machine: string,
  keyToUnmark: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const currentRes = await getPotongKainSyncStatus(machine);
    const updatedKeys = (currentRes.syncedKeys || []).filter((k) => k !== keyToUnmark);

    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: `sync_keys_potong_${machine}`,
        report_name: `Sync Keys Potong Kain - ${machine}`,
        web_app_url: machine,
        is_active: true,
        description: JSON.stringify(updatedKeys),
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Reset seluruh status sync mesin (Semua potongan menjadi 'Belum Sync') - Khusus Trial
 */
export async function resetPotongKainSyncStatus(
  machine: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: `sync_keys_potong_${machine}`,
        report_name: `Sync Keys Potong Kain - ${machine}`,
        web_app_url: machine,
        is_active: true,
        description: "[]",
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Sinkronisasi data Laporan Harian Inspect & Mending ke Google Sheets
 * Tab target: HASIL INSPECT DAN MENDING HARIAN 2026 (seluruh mesin gabung)
 */
export async function syncDailyInspectMendingToGoogleSheet(
  rows: any[],
  sheetName: string = "HASIL INSPECT DAN MENDING HARIAN 2026"
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  appendedCount?: number;
  updatedCount?: number;
  total?: number;
}> {
  try {
    if (!rows || rows.length === 0) {
      return { success: false, error: "Tidak ada data baris yang dipilih untuk disinkronkan." };
    }

    const filteredRows = rows.filter((r: any) => !isExcludedSheetSyncMachine(r?.nomor_mc || r?.mesin));
    if (filteredRows.length === 0) {
      return {
        success: true,
        message: "Tidak ada baris yang disinkronkan (mesin R13 & R14 dikecualikan dari Google Sheets).",
        appendedCount: 0,
        updatedCount: 0,
        total: 0,
      };
    }

    const payload = {
      reportType: "daily_inspect_mending",
      sheetName,
      rows: filteredRows,
    };

    const res = await sendPayloadToGoogleSheet("daily_inspect_mending", payload);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal sinkronisasi ke Google Sheets" };
  }
}

/**
 * Mengambil pengaturan jadwal sinkronisasi otomatis Laporan Harian Inspect & Mending
 */
export async function getDailyInspectMendingScheduleSettings(): Promise<{
  success: boolean;
  time: string;
  enabled: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("web_app_url, is_active, description")
      .eq("id", "schedule_daily_inspect_mending")
      .single();

    if (error || !data) {
      return {
        success: true,
        time: "17:30",
        enabled: true,
      };
    }

    return {
      success: true,
      time: data.web_app_url || "17:30",
      enabled: data.is_active !== false,
    };
  } catch (err: any) {
    return {
      success: true,
      time: "17:30",
      enabled: true,
    };
  }
}

/**
 * Menyimpan pengaturan jadwal sinkronisasi otomatis Laporan Harian Inspect & Mending
 */
export async function updateDailyInspectMendingScheduleSettings(payload: {
  time: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: "schedule_daily_inspect_mending",
        report_name: "Jadwal Auto-Sync Laporan Harian Inspect & Mending",
        web_app_url: payload.time.trim(),
        is_active: payload.enabled,
        description: `Waktu auto-sync harian: ${payload.time} WIB`,
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    notifySchedulerCacheInvalidation();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menyimpan jadwal inspect & mending" };
  }
}

/**
 * Otomatis sinkronisasi seluruh data Harian Inspect & Mending (Bulan Berjalan) ke Google Sheets
 */
export async function syncAllDailyInspectMending(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  appendedCount?: number;
  updatedCount?: number;
  total?: number;
}> {
  try {
    const { getDailyInspectMendingReport } = await import("@/actions/daily-inspect-mending-actions");
    
    // Ambil data bulan ini untuk disinkronkan ke Google Sheet
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const reportRes = await getDailyInspectMendingReport({
      machine: "ALL",
      dateFrom: startOfMonth,
      dateTo: todayStr,
      dateField: "tgl_inspect",
    });

    if (!reportRes.success || !reportRes.data || reportRes.data.length === 0) {
      return {
        success: true,
        message: "Tidak ada data inspect & mending bulan ini yang perlu disinkronkan.",
        total: 0,
      };
    }

    const syncRes = await syncDailyInspectMendingToGoogleSheet(reportRes.data);
    return syncRes;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Gagal auto-sync laporan harian inspect & mending.",
    };
  }
}

// ============================================================================
// REAL-TIME EVENT-DRIVEN SINGLE-ROW SYNC (POTONG KAIN & HARIAN INSPECT/MENDING)
// ============================================================================

/**
 * Sinkronisasi real-time HANYA 1 baris potongan tertentu ke Laporan Potong Kain (Google Sheets).
 * Otomatis dilewati secara aman jika endpoint potong_kain nonaktif/belum diatur.
 */
export async function syncSinglePotongKainRowToGoogleSheet(params: {
  machine: string;
  potonganKe: number | string;
  pcsIndex?: number | string;
  safeMode?: boolean;
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    const mc = String(params.machine || "").trim().toUpperCase();
    const potStr = String(params.potonganKe || "").trim();
    if (!mc || !potStr || potStr === "0") {
      return { success: false, skipped: true };
    }

    const endpoint = await getGoogleSheetEndpoint("potong_kain");
    if (!endpoint.url) {
      return { success: false, skipped: true };
    }

    const { getMendingReportData } = await import("@/actions/mending-actions");
    const res = await getMendingReportData(mc, potStr);
    if (!res.success || !res.data || res.data.length === 0) {
      return { success: false, skipped: true };
    }

    const targetPcs = params.pcsIndex !== undefined && params.pcsIndex !== null && Number(params.pcsIndex) > 0
      ? String(params.pcsIndex)
      : null;

    let rowsToSync = res.data.map((batch: any) => formatPotongKainBatchToSheetRow(batch));
    if (targetPcs) {
      const exactPcsRows = rowsToSync.filter((r: any) => String(r.pcsKe) === targetPcs);
      if (exactPcsRows.length > 0) {
        rowsToSync = exactPcsRows;
      }
    }

    if (rowsToSync.length === 0) {
      return { success: false, skipped: true };
    }

    const firstDate = rowsToSync[0]?.tanggalBeres || rowsToSync[0]?.tglMending || "";
    const yearStr = firstDate.length >= 4 ? firstDate.slice(0, 4) : new Date().getFullYear().toString();

    const syncRes = await sendPayloadToGoogleSheet("potong_kain", {
      action: "sync_potong_kain",
      machine: mc,
      sheetName: mc,
      year: yearStr,
      period: yearStr,
      safeMode: params.safeMode !== false,
      rows: rowsToSync,
    });

    if (syncRes && syncRes.success) {
      const syncedKeysAdded = rowsToSync.map((r: any) => r.batchKey);
      await markPotongKainSynced(mc, syncedKeysAdded);
      console.log(`[Realtime Sync] Potong Kain ${mc} Pot.${potStr} berhasil disinkronkan (${rowsToSync.length} baris).`);
      return { success: true };
    }

    console.warn(`[Realtime Sync] Potong Kain ${mc} Pot.${potStr} gagal:`, syncRes?.error);
    return { success: false, error: syncRes?.error };
  } catch (err: any) {
    console.error("[Realtime Sync] Error syncSinglePotongKainRowToGoogleSheet:", err?.message || err);
    return { success: false, error: err?.message || "Gagal realtime sync potong kain" };
  }
}

/**
 * Sinkronisasi real-time HANYA 1 baris potongan tertentu ke Laporan Harian Inspect & Mending (Google Sheets).
 * Menggunakan Upsert di Google Apps Script sehingga aman saat QC -> Mending -> Final selesai bertahap.
 */
export async function syncSingleDailyInspectMendingRowToGoogleSheet(params: {
  machine: string;
  potonganKe: number | string;
  pcsIndex?: number | string;
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    const mc = String(params.machine || "").trim().toUpperCase();
    const potNum = Number(params.potonganKe);
    if (!mc || !potNum || isNaN(potNum)) {
      return { success: false, skipped: true };
    }

    const endpoint = await getGoogleSheetEndpoint("daily_inspect_mending");
    if (!endpoint.url) {
      return { success: false, skipped: true };
    }

    const { getDailyInspectMendingReport } = await import("@/actions/daily-inspect-mending-actions");
    const reportRes = await getDailyInspectMendingReport({
      machine: mc,
      potonganKe: potNum,
    });

    if (!reportRes.success || !reportRes.data || reportRes.data.length === 0) {
      return { success: false, skipped: true };
    }

    const targetPcs = params.pcsIndex !== undefined && params.pcsIndex !== null && Number(params.pcsIndex) > 0
      ? Number(params.pcsIndex)
      : null;

    let matchingRows = reportRes.data.filter(
      (r) => r.nomor_mc.trim().toUpperCase() === mc && Number(r.potongan_ke) === potNum
    );
    if (targetPcs !== null) {
      const exactPcs = matchingRows.filter((r) => Number(r.pcs_index) === targetPcs);
      if (exactPcs.length > 0) {
        matchingRows = exactPcs;
      }
    }

    if (matchingRows.length === 0) {
      return { success: false, skipped: true };
    }

    const syncRes = await syncDailyInspectMendingToGoogleSheet(matchingRows);
    if (syncRes.success) {
      console.log(`[Realtime Sync] Harian Inspect/Mending ${mc} Pot.${potNum} berhasil disinkronkan (${matchingRows.length} baris).`);
      return { success: true };
    }

    console.warn(`[Realtime Sync] Harian Inspect/Mending ${mc} Pot.${potNum} gagal:`, syncRes.error);
    return { success: false, error: syncRes.error };
  } catch (err: any) {
    console.error("[Realtime Sync] Error syncSingleDailyInspectMendingRowToGoogleSheet:", err?.message || err);
    return { success: false, error: err?.message || "Gagal realtime sync harian inspect & mending" };
  }
}

/**
 * Dispatcher non-blocking (fire-and-forget) yang dipanggil setelah simpan QC / Mending / Final Inspection.
 * Berjalan di background agar proses simpan operator/petugas tetap instan & tidak pernah gagal jika Google Sheets lambat.
 */
export async function triggerRealtimeSyncAfterInspection(params: {
  stage: "qc" | "mending" | "final";
  machine: string;
  potonganKe: number | string;
  pcsIndex?: number | string;
  isTricote?: boolean;
}): Promise<void> {
  const mc = String(params.machine || "").trim().toUpperCase();
  const pot = params.potonganKe;
  if (!mc || !pot || Number(pot) <= 0 || isExcludedSheetSyncMachine(mc)) return;

  setImmediate(() => {
    (async () => {
      try {
        // 1. Laporan Harian Inspect & Mending: selalu kirim/update di setiap tahap (QC, Mending, Final)
        await syncSingleDailyInspectMendingRowToGoogleSheet({
          machine: mc,
          potonganKe: pot,
          pcsIndex: params.pcsIndex,
        });

        // 2. Laporan Potong Kain: kirim saat Mending selesai, Final selesai, atau QC selesai pada mesin Tricote (awalan T)
        if (params.stage === "mending" || params.stage === "final" || (params.stage === "qc" && params.isTricote)) {
          await syncSinglePotongKainRowToGoogleSheet({
            machine: mc,
            potonganKe: pot,
            pcsIndex: params.pcsIndex,
            safeMode: true,
          });
        }

        // 3. Auto-Archive PDF Laporan Hasil Produksi per potongan ke Google Drive di setiap tahap (QC, Mending, Final)
        const { triggerAutoArchivePdfToDrive } = await import("@/actions/drive-pdf-actions");
        await triggerAutoArchivePdfToDrive({
          nomorMc: mc,
          potonganKe: pot,
        });
      } catch (err: any) {
        console.error(`[Realtime Sync] Unhandled background error (${params.stage} ${mc} Pot.${pot}):`, err?.message || err);
      }
    })();
  });
}

// ============================================================================
// LAPORAN PER DESAIN (REKAP EFISIENSI PER MESIN) - GOOGLE SHEETS SYNC
// ============================================================================

const MONTH_NAMES_ID = [
  "",
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];

function buildDesignReportPeriodMeta(year: string, months: string[]) {
  const numericMonths = months
    .map((m) => parseInt(m, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 12)
    .sort((a, b) => a - b);

  if (numericMonths.length === 0 || numericMonths.length === 12) {
    return {
      periodKey: `${year}-ALL`,
      periodLabel: `TAHUN ${year}`,
    };
  }
  if (numericMonths.length === 1) {
    const m = numericMonths[0];
    return {
      periodKey: `${year}-${String(m).padStart(2, "0")}`,
      periodLabel: `${MONTH_NAMES_ID[m]} ${year}`,
    };
  }
  const keyPart = numericMonths.map((m) => String(m).padStart(2, "0")).join(",");
  const labelPart = numericMonths.map((m) => MONTH_NAMES_ID[m]).join(" - ");
  return {
    periodKey: `${year}-${keyPart}`,
    periodLabel: `${labelPart} ${year}`,
  };
}

/**
 * Sinkronisasi Laporan Per Desain untuk 1 mesin ke tab mesin terkait di Google Sheets
 * Menggunakan strategi blok bertanda [SYNC:YYYY-MM] agar data historis manual tetap aman.
 */
export async function syncDesignReportToGoogleSheet(params: {
  machine: string;
  year: string;
  months: string[];
  designFilter?: string;
  includeCrossMonth?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  designCount?: number;
  rowCount?: number;
}> {
  try {
    const { getDesignReportData } = await import("@/actions/design-report-actions");
    const mc = params.machine.trim().toUpperCase();
    if (isExcludedSheetSyncMachine(mc)) {
      return {
        success: true,
        message: `Mesin ${mc} dikecualikan dari sinkronisasi Google Sheets (dilewati).`,
        designCount: 0,
        rowCount: 0,
      };
    }
    const res = await getDesignReportData(
      mc,
      params.year,
      params.months,
      params.designFilter || "ALL",
      params.includeCrossMonth !== false
    );

    if (!res.success) {
      return { success: false, error: res.error || `Gagal mengambil data Laporan Per Desain mesin ${mc}` };
    }

    const groups = res.data || [];
    if (groups.length === 0) {
      return {
        success: true,
        message: `Mesin ${mc}: tidak ada data potongan pada periode ini (dilewati).`,
        designCount: 0,
        rowCount: 0,
      };
    }

    const { periodKey, periodLabel } = buildDesignReportPeriodMeta(params.year, params.months);
    const totalRows = groups.reduce((acc, g) => acc + g.rows.length, 0);

    const payload = {
      action: "sync_design_report",
      machine: mc,
      year: params.year,
      months: params.months,
      periodKey,
      periodLabel,
      isMeteran: !!res.isMeteran,
      isMultiPcs: !!res.isMultiPcs,
      groups,
      grandSummary: res.grandSummary || null,
      syncedAt: new Date().toISOString(),
    };

    const sendRes = await sendPayloadToGoogleSheet("design_report", payload);
    if (!sendRes.success) {
      return { success: false, error: sendRes.error || `Gagal mengirim data mesin ${mc} ke Google Sheets.` };
    }

    return {
      success: true,
      message: sendRes.message || `Mesin ${mc} berhasil disinkronkan (${groups.length} desain, ${totalRows} baris).`,
      designCount: groups.length,
      rowCount: totalRows,
    };
  } catch (err: any) {
    console.error("Error in syncDesignReportToGoogleSheet:", err);
    return {
      success: false,
      error: err.message || "Terjadi kesalahan saat sinkronisasi Laporan Per Desain.",
    };
  }
}

/**
 * Sinkronisasi Laporan Per Desain untuk SELURUH mesin terdaftar secara berurutan
 */
export async function syncAllDesignReportMachines(
  year?: string,
  months?: string[],
  includeCrossMonth: boolean = true
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  syncedMachines?: string[];
  skippedMachines?: string[];
  failedMachines?: { machine: string; error: string }[];
}> {
  try {
    const { REGISTERED_MACHINES } = await import("@/lib/constants");
    const now = new Date();
    const targetYear = year || now.getFullYear().toString();
    const targetMonths = months && months.length > 0 ? months : [(now.getMonth() + 1).toString()];

    // Pastikan URL Web App sudah dikonfigurasi sebelum memulai loop semua mesin
    const endpoint = await getGoogleSheetEndpoint("design_report");
    if (!endpoint.url) {
      return {
        success: false,
        error:
          "URL Web App untuk 'Laporan Per Desain' belum diatur di menu Admin > Integrasi Google Sheets.",
      };
    }

    const syncedMachines: string[] = [];
    const skippedMachines: string[] = [];
    const failedMachines: { machine: string; error: string }[] = [];

    for (const mc of REGISTERED_MACHINES.filter((m) => !isExcludedSheetSyncMachine(m))) {
      const res = await syncDesignReportToGoogleSheet({
        machine: mc,
        year: targetYear,
        months: targetMonths,
        includeCrossMonth,
      });

      if (!res.success) {
        failedMachines.push({ machine: mc, error: res.error || "Unknown error" });
      } else if ((res.designCount || 0) === 0) {
        skippedMachines.push(mc);
      } else {
        syncedMachines.push(mc);
      }
    }

    if (failedMachines.length > 0 && syncedMachines.length === 0) {
      return {
        success: false,
        error: `Gagal sinkronisasi semua mesin. Contoh error (${failedMachines[0].machine}): ${failedMachines[0].error}`,
        syncedMachines,
        skippedMachines,
        failedMachines,
      };
    }

    const msgParts: string[] = [];
    if (syncedMachines.length > 0) msgParts.push(`${syncedMachines.length} mesin tersinkron (${syncedMachines.join(", ")})`);
    if (skippedMachines.length > 0) msgParts.push(`${skippedMachines.length} mesin kosong dilewati`);
    if (failedMachines.length > 0) msgParts.push(`${failedMachines.length} gagal (${failedMachines.map((f) => f.machine).join(", ")})`);

    return {
      success: failedMachines.length === 0,
      message: msgParts.join(" · "),
      error: failedMachines.length > 0 ? failedMachines.map((f) => `${f.machine}: ${f.error}`).join("; ") : undefined,
      syncedMachines,
      skippedMachines,
      failedMachines,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Gagal sinkronisasi Laporan Per Desain semua mesin.",
    };
  }
}

/**
 * Mengambil pengaturan jadwal auto-sync Laporan Per Desain
 */
export async function getDesignReportScheduleSettings(): Promise<{
  success: boolean;
  time: string;
  enabled: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_sheet_configs")
      .select("web_app_url, is_active")
      .eq("id", "schedule_design_report")
      .single();

    if (error || !data) {
      return {
        success: true,
        time: "18:00",
        enabled: true,
      };
    }

    return {
      success: true,
      time: data.web_app_url || "18:00",
      enabled: data.is_active !== false,
    };
  } catch {
    return {
      success: true,
      time: "18:00",
      enabled: true,
    };
  }
}

/**
 * Menyimpan pengaturan jadwal auto-sync Laporan Per Desain
 */
export async function updateDesignReportScheduleSettings(payload: {
  time: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("google_sheet_configs").upsert({
      id: "schedule_design_report",
      report_name: "Jadwal Auto-Sync Laporan Per Desain",
      web_app_url: payload.time.trim(),
      is_active: payload.enabled,
      description: `Waktu auto-sync harian Laporan Per Desain: ${payload.time} WIB`,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    notifySchedulerCacheInvalidation();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menyimpan jadwal Laporan Per Desain" };
  }
}




