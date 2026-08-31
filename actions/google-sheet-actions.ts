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

  const machinesToSync = (typeof monthOrOptions === "object" && monthOrOptions?.machines && monthOrOptions.machines.length > 0)
    ? monthOrOptions.machines
    : REGISTERED_MACHINES;

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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menyimpan jadwal potong kain" };
  }
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
    const rows = filteredData.map((batch: any) => {
      const header = batch.header || {};
      const firstItem = batch.items?.[0] || {};
      const tanggalBeres = header.tanggal_potong || header.tgl || "";
      const obRaw = header.no_order_barang || "";
      let obStm = "";
      let obDji = "";
      if (obRaw.toUpperCase().includes("DJI") || obRaw.toUpperCase().includes("DEX")) {
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

      let jam = "";
      if (header.tanggal_jam) {
        try {
          const d = new Date(header.tanggal_jam);
          if (!isNaN(d.getTime())) {
            jam = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          }
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
    }).sort((a: any, b: any) => Number(a.potonganKe || 0) - Number(b.potonganKe || 0));

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
  const results = [];

  for (const mc of REGISTERED_MACHINES) {
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

    const payload = {
      reportType: "daily_inspect_mending",
      sheetName,
      rows,
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



