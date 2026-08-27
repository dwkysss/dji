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

    return { success: true, data: data as GoogleSheetConfigItem[] };
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
        error: resJson.error || "Gagal sinkronisasi data ke Google Sheets",
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
      };
    }

    return {
      success: true,
      time: data.web_app_url || "09:00",
      enabled: data.is_active !== false,
      safeMode: !data.description?.includes("safeMode=false"),
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("google_sheet_configs")
      .upsert({
        id: "auto_sync_schedule",
        report_name: "Jadwal Otomatis Harian (Cron)",
        web_app_url: payload.time.trim(),
        is_active: payload.enabled,
        description: `Waktu auto-sync harian: ${payload.time} WIB (safeMode=${payload.safeMode})`,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }
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

  const results: Array<{
    machine: string;
    success: boolean;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }> = [];

  for (const mc of REGISTERED_MACHINES) {
    try {
      const rep = await getMonthlyMachineReport(targetMonth, targetYear, mc);
      if (!rep.success || !rep.data) {
        results.push({
          machine: mc,
          success: false,
          error: rep.error || "Gagal mengambil data laporan dari database",
        });
        continue;
      }

      const structuredItems = rep.data.map((dayData: any) => {
        const teamsToRender = [
          { teamName: "A", data: dayData.teamData ? dayData.teamData["A"] : null },
          { teamName: "B", data: dayData.teamData ? dayData.teamData["B"] : null },
          { teamName: "C", data: dayData.teamData ? dayData.teamData["C"] : null },
        ];

        return {
          tanggal: dayData.tanggal,
          teams: teamsToRender.map((teamObj) => {
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
              keterangan: ketString,
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

      results.push({
        machine: mc,
        success: syncRes.success,
        updatedCount: syncRes.updatedCount,
        skippedCount: syncRes.skippedCount,
        error: syncRes.error,
      });
    } catch (err: any) {
      results.push({
        machine: mc,
        success: false,
        error: err.message || "Error saat memproses sinkronisasi",
      });
    }
  }

  const successfulCount = results.filter(r => r.success).length;
  return {
    success: successfulCount > 0,
    message: `Selesai sinkronisasi: ${successfulCount} dari ${REGISTERED_MACHINES.length} mesin berhasil disinkronkan ke sheet '${targetSheetName}'.`,
    results,
  };
}

