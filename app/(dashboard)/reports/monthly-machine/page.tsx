"use client";

import { useState, useEffect, useRef } from "react";
import { getMonthlyMachineReport, MonthlyMachineReportData } from "@/actions/report-actions";
import { getMachineStatuses } from "@/actions/dashboard-actions";
import { getGoogleSheetEndpoint, sendPayloadToGoogleSheet, syncAllMonthlyMachines, getAutoSyncScheduleSettings, updateAutoSyncScheduleSettings } from "@/actions/google-sheet-actions";
import { FileSpreadsheet, Loader2, Calendar, Monitor, AlertCircle, ArrowLeft, CloudUpload, X, Info, CheckCircle2, RotateCw, Zap, Check, Clock, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

// Helper to format seconds as HH:MM:SS
const formatHHMMSS = (totalSec: number) => {
  if (!totalSec || totalSec <= 0) return "00:00:00";
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
};

interface ReportCacheEntry {
  data: MonthlyMachineReportData[];
  isMeterMachine: boolean;
  timestamp: number;
}

// Global in-memory cache surviving navigation within SPA
const reportMemoryCache = new Map<string, ReportCacheEntry>();
let machinesListMemoryCache: string[] | null = null;
const CACHE_KEY_PREFIX = "mm_report_cache_";

export default function MonthlyMachineReportPage() {
  const [machines, setMachines] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [reportData, setReportData] = useState<MonthlyMachineReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMeterMachine, setIsMeterMachine] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  const activeRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal State for Sync Confirmation (Single Machine)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncSafeMode, setSyncSafeMode] = useState(true);

  // Selective Date Scope Filter (All Month vs Specific Days)
  const [syncScope, setSyncScope] = useState<"all" | "range">("all");
  const [syncStartDay, setSyncStartDay] = useState(26);
  const [syncEndDay, setSyncEndDay] = useState(27);

  // Modal State for Sync All Machines (Jam 9 Pagi / On-Demand)
  const [isSyncAllModalOpen, setIsSyncAllModalOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllResults, setSyncAllResults] = useState<any[] | null>(null);

  // Auto-Sync Schedule Settings State (Langsung di Halaman Laporan)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleSafeMode, setScheduleSafeMode] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Modal State for Keterangan
  const [modalData, setModalData] = useState<{ isOpen: boolean; title: string; contentObj: Record<string, string[]> | null }>({
    isOpen: false,
    title: "",
    contentObj: null,
  });

  // Load schedule settings on mount
  useEffect(() => {
    getAutoSyncScheduleSettings()
      .then((res) => {
        if (res.success) {
          setScheduleTime(res.time);
          setScheduleEnabled(res.enabled);
          setScheduleSafeMode(res.safeMode);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveScheduleSetting = async () => {
    setIsSavingSchedule(true);
    try {
      const res = await updateAutoSyncScheduleSettings({
        time: scheduleTime,
        enabled: scheduleEnabled,
        safeMode: scheduleSafeMode,
      });

      if (res.success) {
        setIsScheduleModalOpen(false);
        setToast({
          type: "success",
          title: "Jadwal Auto-Sync Tersimpan",
          message: `Jadwal sinkronisasi otomatis harian berhasil disetel ke pukul ${scheduleTime} WIB!`,
        });
      } else {
        setToast({
          type: "error",
          title: "Gagal Menyimpan Jadwal",
          message: res.error || "Gagal menyimpan konfigurasi jadwal.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Gagal Menyimpan Jadwal",
        message: err.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  useEffect(() => {
    // 1. Check in-memory machines
    if (machinesListMemoryCache && machinesListMemoryCache.length > 0) {
      setMachines(machinesListMemoryCache);
      setSelectedMachine(prev => prev || machinesListMemoryCache![0]);
      return;
    }

    // 2. Check session storage
    try {
      const stored = sessionStorage.getItem("mm_machines_list");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          machinesListMemoryCache = parsed;
          setMachines(parsed);
          setSelectedMachine(prev => prev || parsed[0]);
        }
      }
    } catch (_) {}

    // 3. Fetch from server
    const fetchMachines = async () => {
      const res = await getMachineStatuses();
      const fallback = ["R1", "R2", "R1C", "R2C", "R3B", "R11", "R12", "R16", "T1C", "T2A"];
      if (res.success && res.data) {
        const orderMap = new Map(fallback.map((m, idx) => [m, idx]));
        const mcList = res.data.map((m: any) => m.mesin_id).sort((a: string, b: string) => {
          const idxA = orderMap.has(a) ? orderMap.get(a)! : 999;
          const idxB = orderMap.has(b) ? orderMap.get(b)! : 999;
          return idxA - idxB;
        });
        machinesListMemoryCache = mcList;
        try {
          sessionStorage.setItem("mm_machines_list", JSON.stringify(mcList));
        } catch (_) {}
        setMachines(mcList);
        setSelectedMachine(prev => prev || mcList[0]);
      } else {
        machinesListMemoryCache = fallback;
        setMachines(fallback);
        setSelectedMachine(prev => prev || "R1");
      }
    };
    fetchMachines();
  }, []);

  const loadReportData = async (forceFresh = false) => {
    if (!selectedMachine || !selectedMonth || !selectedYear) return;
    const cacheKey = `${selectedMachine}_${selectedMonth}_${selectedYear}`;
    activeRequestRef.current = cacheKey;

    let hasCachedData = false;

    // A. Check in-memory cache
    const memEntry = reportMemoryCache.get(cacheKey);
    if (memEntry && !forceFresh) {
      setReportData(memEntry.data);
      setIsMeterMachine(memEntry.isMeterMachine);
      hasCachedData = true;

      // If cache is fresh (< 2 minutes old), don't trigger background fetch unless forceFresh
      const isVeryFresh = Date.now() - memEntry.timestamp < 120000;
      if (isVeryFresh) {
        setIsLoading(false);
        setIsBackgroundUpdating(false);
        return;
      }
    }

    // B. Check sessionStorage cache
    if (!hasCachedData && !forceFresh) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.data)) {
            reportMemoryCache.set(cacheKey, parsed);
            setReportData(parsed.data);
            setIsMeterMachine(parsed.isMeterMachine || false);
            hasCachedData = true;
          }
        }
      } catch (_) {}
    }

    // C. Set loading indicators
    if (!hasCachedData) {
      setIsLoading(true);
    } else {
      setIsBackgroundUpdating(true);
    }

    setError(null);

    try {
      const res = await getMonthlyMachineReport(selectedMonth, selectedYear, selectedMachine);
      
      // Ensure response matches currently active request
      if (activeRequestRef.current !== cacheKey) return;

      if (res.success && res.data) {
        const entry: ReportCacheEntry = {
          data: res.data,
          isMeterMachine: res.isMeterMachine || false,
          timestamp: Date.now(),
        };
        reportMemoryCache.set(cacheKey, entry);
        try {
          sessionStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify(entry));
        } catch (_) {}

        setReportData(res.data);
        setIsMeterMachine(res.isMeterMachine || false);
      } else {
        if (!hasCachedData) {
          setError(res.error || "Gagal mengambil laporan.");
        }
      }
    } catch (err: any) {
      if (activeRequestRef.current === cacheKey && !hasCachedData) {
        setError(err.message);
      }
    } finally {
      if (activeRequestRef.current === cacheKey) {
        setIsLoading(false);
        setIsBackgroundUpdating(false);
      }
    }
  };

  useEffect(() => {
    if (selectedMachine && selectedMonth && selectedYear) {
      loadReportData(false);
    }
  }, [selectedMachine, selectedMonth, selectedYear]);


  const syncToGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      const endpoint = await getGoogleSheetEndpoint("monthly_machine");
      const sheetUrl = endpoint.url;
      if (!sheetUrl) {
        setToast({
          type: "error",
          title: "Konfigurasi URL Belum Ada",
          message: "URL Google Sheets belum diatur di menu Admin > Integrasi Google Sheets atau di .env",
        });
        return;
      }

      const wsData: any[][] = [];
      const headerRow1 = [
        "Tanggal", "Desain", "Keterangan", isMeterMachine ? "Pick" : "Courses", "RPM", "Eff 100%", 
        "Team", "Nama Operator", "Hasil Produksi", "Persentase dari 100%",
        "Jumlah Cacat", "Persentase Cacat", 
        "KODE TINDAKAN", "", "", "", "", "", "", "", 
        "Downtime (Detik)", "Persentase Waktu Efektif"
      ];
      const headerRow2 = [
        "", "", "", "", "", "", 
        "", "", "", "",
        "", "", 
        "A", "B", "C", "D", "E", "F", "G", "H",
        "", ""
      ];
      wsData.push(headerRow1);
      wsData.push(headerRow2);
      
      const shiftDurationSecs = 28800;
      
      reportData.forEach((dayData) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData["A"] },
          { teamName: "B", data: dayData.teamData["B"] },
          { teamName: "C", data: dayData.teamData["C"] },
        ];
        teamsToRender.forEach((teamObj, idx) => {
          const isFirst = idx === 0;
          const team = teamObj.teamName;
          const td = teamObj.data;
          
          const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
          const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
          const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";
          
          let ketString = "";
          if (td.keterangan_per_kategori) {
            ketString = Object.entries(td.keterangan_per_kategori)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kat, details]) => {
                const counts: Record<string, number> = {};
                (details as string[]).forEach((d) => {
                  const key = d?.trim() || "Detail umum";
                  counts[key] = (counts[key] || 0) + 1;
                });
                const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
              }).join(" | ");
          }

          wsData.push([
            isFirst ? dayData.tanggal : "",
            td.desain || "",
            ketString,
            td.courses || "",
            td.rpm || "",
            td.eff_100 || "",
            team,
            td.operator_name,
            td.hasil_produksi,
            p100,
            td.jumlah_cacat,
            pCacat,
            td.kode_tindakan["A"] || 0,
            td.kode_tindakan["B"] || 0,
            td.kode_tindakan["C"] || 0,
            td.kode_tindakan["D"] || 0,
            td.kode_tindakan["E"] || 0,
            td.kode_tindakan["F"] || 0,
            td.kode_tindakan["G"] || 0,
            td.kode_tindakan["H"] || 0,
            formatHHMMSS(td.downtime_detik),
            pEff
          ]);
        });
      });

      const monthNames = [
        "", "Januari", "Februari", "Maret", "APRIL", "Mei", "Juni", 
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const targetSheetName = `${monthNames[selectedMonth] || "Agustus"} ${selectedYear}`;

      const structuredItems = reportData.map((dayData) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData["A"] },
          { teamName: "B", data: dayData.teamData["B"] },
          { teamName: "C", data: dayData.teamData["C"] },
        ];

        return {
          tanggal: dayData.tanggal,
          teams: teamsToRender.map((teamObj) => {
            const td = teamObj.data;
            let ketString = "";
            if (td.keterangan_per_kategori) {
              ketString = Object.entries(td.keterangan_per_kategori)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([kat, details]) => {
                  const counts: Record<string, number> = {};
                  (details as string[]).forEach((d) => {
                    const key = d?.trim() || "Detail umum";
                    counts[key] = (counts[key] || 0) + 1;
                  });
                  const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                  return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
                }).join(" | ");
            }

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
              downtime_formatted: formatHHMMSS(td.downtime_detik || 0),
            };
          }),
        };
      });

      const syncResult = await sendPayloadToGoogleSheet("monthly_machine", {
        action: "sync_monthly_report", 
        machine: selectedMachine,
        sheetName: targetSheetName,
        month: selectedMonth,
        year: selectedYear,
        isMeterMachine: isMeterMachine,
        safeMode: syncSafeMode,
        startDay: syncScope === "range" ? syncStartDay : undefined,
        endDay: syncScope === "range" ? syncEndDay : undefined,
        items: structuredItems,
        data: wsData 
      });

      if (!syncResult.success) {
        throw new Error(syncResult.error || "Gagal sinkronisasi data ke Google Sheets.");
      }

      setIsSyncModalOpen(false);
      setToast({
        type: "success",
        title: "Sinkronisasi Selesai",
        message: syncResult.message || `Sukses sinkronisasi laporan ${selectedMachine} ke sheet ${targetSheetName}!`,
      });
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Sinkronisasi Gagal",
        message: err.message || "Terjadi kesalahan saat terhubung ke Google Sheets.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const executeSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncAllResults(null);
    try {
      const res = await syncAllMonthlyMachines({
        month: selectedMonth,
        year: selectedYear,
        safeMode: syncSafeMode,
        startDay: syncScope === "range" ? syncStartDay : undefined,
        endDay: syncScope === "range" ? syncEndDay : undefined,
      });
      setSyncAllResults(res.results);
      if (res.success) {
        setToast({
          type: "success",
          title: "Sync Seluruh Mesin Selesai",
          message: res.message,
        });
      } else {
        setToast({
          type: "error",
          title: "Sebagian Sync Gagal",
          message: res.message,
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Gagal Menjalankan Sinkronisasi",
        message: err.message || "Terjadi kesalahan saat memproses seluruh mesin.",
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const exportToExcel = () => {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];
      
      // Main Headers
      const headerRow1 = [
        "Tanggal", "Desain", "Keterangan", isMeterMachine ? "Pick" : "Courses", "RPM", "Eff 100%", 
        "Team", "Nama Operator", "Hasil Produksi", "Persentase dari 100%",
        "Jumlah Cacat", "Persentase Cacat", 
        "KODE TINDAKAN", "", "", "", "", "", "", "", 
        "Downtime (HH:MM:SS)", "Persentase Waktu Efektif"
      ];
      const headerRow2 = [
        "", "", "", "", "", "", 
        "", "", "", "",
        "", "", 
        "A", "B", "C", "D", "E", "F", "G", "H",
        "", ""
      ];
      wsData.push(headerRow1);
      wsData.push(headerRow2);
      
      const shiftDurationSecs = 28800;
      
      reportData.forEach((dayData) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData["A"] },
          { teamName: "B", data: dayData.teamData["B"] },
          { teamName: "C", data: dayData.teamData["C"] },
        ];
        teamsToRender.forEach((teamObj, idx) => {
          const isFirst = idx === 0;
          const team = teamObj.teamName;
          const td = teamObj.data;
          
          const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
          const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
          const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";
          
          let ketString = "";
          if (td.keterangan_per_kategori) {
            ketString = Object.entries(td.keterangan_per_kategori)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kat, details]) => {
                const counts: Record<string, number> = {};
                (details as string[]).forEach((d) => {
                  const key = d?.trim() || "Detail umum";
                  counts[key] = (counts[key] || 0) + 1;
                });
                const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
              }).join(" | ");
          }

          const row = [
            isFirst ? dayData.tanggal : "",
            td.desain || "",
            ketString,
            td.courses || "",
            td.rpm || "",
            td.eff_100 || "",
            team,
            td.operator_name,
            td.hasil_produksi,
            p100,
            td.jumlah_cacat,
            pCacat,
            td.kode_tindakan["A"] || 0,
            td.kode_tindakan["B"] || 0,
            td.kode_tindakan["C"] || 0,
            td.kode_tindakan["D"] || 0,
            td.kode_tindakan["E"] || 0,
            td.kode_tindakan["F"] || 0,
            td.kode_tindakan["G"] || 0,
            td.kode_tindakan["H"] || 0,
            formatHHMMSS(td.downtime_detik),
            pEff
          ];
          wsData.push(row);
        });
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      const colWidths = [
        { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
        { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;
      
      const merges = [];
      // Header merges
      merges.push({ s: { r: 0, c: 12 }, e: { r: 0, c: 19 } }); // KODE TINDAKAN span 8 cols
      for (let c = 0; c < 22; c++) {
        if (c < 12 || c > 19) {
          merges.push({ s: { r: 0, c: c }, e: { r: 1, c: c } }); // Vertical merge for others
        }
      }

      let startRow = 2; // Data starts at row index 2
      for (let i = 0; i < reportData.length; i++) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + 2, c: 0 } });
        startRow += 3;
      }
      ws['!merges'] = merges;
      
      XLSX.utils.book_append_sheet(wb, ws, selectedMachine);
      const fileName = `Laporan_Bulanan_${selectedMachine}_${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    });
  };


  const months = [
    { value: 1, label: "Januari" }, { value: 2, label: "Februari" }, { value: 3, label: "Maret" },
    { value: 4, label: "April" }, { value: 5, label: "Mei" }, { value: 6, label: "Juni" },
    { value: 7, label: "Juli" }, { value: 8, label: "Agustus" }, { value: 9, label: "September" },
    { value: 10, label: "Oktober" }, { value: 11, label: "November" }, { value: 12, label: "Desember" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const shiftDurationSecs = 28800; // 8 hours

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans pb-24">
      {/* Header */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Link href="/dashboard" className="hover:text-slate-800 transition-colors flex items-center gap-1 text-sm font-semibold">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Link>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              Laporan Bulanan Mesin
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Laporan rekapitulasi produksi dan cacat per bulan untuk masing-masing mesin.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Monitor className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer min-w-[80px]"
              >
                {machines.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <span className="text-slate-300 font-bold">/</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            <button 
              onClick={() => loadReportData(true)}
              disabled={isLoading}
              className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white p-2.5 rounded-xl shadow-md transition-all flex items-center justify-center min-w-[44px] cursor-pointer"
              title="Refresh / Muat Ulang Data Terbaru"
            >
              <RotateCw className={`w-5 h-5 ${isLoading || isBackgroundUpdating ? "animate-spin" : ""}`} />
            </button>

            {/* Quick Auto-Sync Schedule Badge & Trigger */}
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className={`p-2 px-3.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                scheduleEnabled 
                  ? "bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100" 
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              }`}
              title="Klik untuk mengatur jam sinkronisasi otomatis harian"
            >
              <div className="relative">
                <Clock className={`w-4 h-4 ${scheduleEnabled ? "text-amber-600" : "text-slate-400"}`} />
                {scheduleEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="hidden xl:inline">Auto-Sync:</span>
                <span className="font-black font-mono text-amber-950">{scheduleTime}</span>
                <span className="text-[10px] text-amber-700 font-semibold">WIB</span>
              </div>
              <Settings className="w-3.5 h-3.5 text-amber-700/60 ml-0.5" />
            </button>

            <button
              onClick={() => setIsSyncModalOpen(true)}
              disabled={isLoading || reportData.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50 cursor-pointer"
              title="Sync Mesin Ini ke Google Sheets"
            >
              <CloudUpload className="w-5 h-5" />
              <span className="hidden lg:inline">Sync ke Sheet</span>
            </button>
            <button
              onClick={() => {
                setSyncAllResults(null);
                setIsSyncAllModalOpen(true);
              }}
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50 cursor-pointer"
              title="Sync Seluruh 10 Mesin Sekaligus (Simulasi / Manual Jam 9 Pagi)"
            >
              <Zap className="w-5 h-5" />
              <span className="hidden md:inline">Sync Semua Mesin</span>
            </button>
            <button
              onClick={exportToExcel}
              disabled={isLoading || reportData.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
              title="Download Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 font-semibold animate-fadeIn">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden relative">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-[#e67e22]/20 to-orange-50 px-6 py-4 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="px-5 py-2 bg-[#e67e22] text-white font-black text-xl rounded-lg shadow-sm">
                {selectedMachine}
              </div>
              <div className="text-sm font-bold text-slate-600">
                01/{selectedMonth.toString().padStart(2, '0')}/{selectedYear} - {new Date(selectedYear, selectedMonth, 0).getDate()}/{selectedMonth.toString().padStart(2, '0')}/{selectedYear}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar relative min-h-[400px]">
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                  <p className="font-bold text-slate-500 text-sm animate-pulse">Menyusun Laporan...</p>
                </div>
              </div>
            )}
            
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black text-slate-700 uppercase tracking-widest text-center">
                  <th className="border border-slate-300 p-2 min-w-[40px] sticky left-0 bg-slate-100/90 z-20">Tanggal</th>
                  <th className="border border-slate-300 p-2 min-w-[100px]">Desain</th>
                  <th className="border border-slate-300 p-2 min-w-[120px]">Keterangan</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">{isMeterMachine ? "Pick" : "Courses"}</th>
                  <th className="border border-slate-300 p-2 min-w-[60px]">RPM</th>
                  <th className="border border-slate-300 p-2 min-w-[60px]">Eff 100%</th>
                  <th className="border border-slate-300 p-2 min-w-[50px] bg-sky-50">Team</th>
                  <th className="border border-slate-300 p-2 min-w-[120px]">Nama Operator</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">Hasil Produksi</th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">Persentase dari 100%</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">Jumlah Cacat</th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">Persentase Cacat</th>
                  <th colSpan={8} className="border border-slate-300 p-1 bg-amber-50">Kode Tindakan</th>
                  <th className="border border-slate-300 p-2 min-w-[100px]">Downtime (HH:MM:SS)</th>
                  <th className="border border-slate-300 p-2 min-w-[90px]">Persentase Waktu Efektif</th>
                </tr>
                <tr className="bg-slate-100/60 text-[10px] font-bold text-slate-600 text-center">
                  <th colSpan={12} className="border border-slate-300"></th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">A</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">B</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">C</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">D</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">E</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">F</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">G</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">H</th>
                  <th colSpan={2} className="border border-slate-300"></th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-semibold text-slate-700 bg-white">
                {reportData.map((dayData) => {
                  const teamsToRender = dayData.orderedTeams || [
                    { teamName: "A", data: dayData.teamData["A"] },
                    { teamName: "B", data: dayData.teamData["B"] },
                    { teamName: "C", data: dayData.teamData["C"] },
                  ];
                  return teamsToRender.map((teamObj, idx) => {
                    const isFirst = idx === 0;
                    const team = teamObj.teamName;
                    const td = teamObj.data;
                    
                    const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
                    const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
                    const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";

                    // The background color for Team cell in excel is often light orange for empty or plain.
                    // We'll alternate slightly for rows to look like the image.
                    const rowBgClass = team === "B" ? "bg-[#fdf9f4]" : (team === "C" ? "bg-[#faf5ec]" : "bg-white");
                    
                    let ketString = "";
                    if (td.keterangan_per_kategori) {
                      ketString = Object.entries(td.keterangan_per_kategori)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([kat, details]) => {
                          const counts: Record<string, number> = {};
                          (details as string[]).forEach((d) => {
                            const key = d?.trim() || "Detail umum";
                            counts[key] = (counts[key] || 0) + 1;
                          });
                          const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                          return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
                        }).join(" | ");
                    }

                    return (
                      <tr key={`${dayData.tanggal}-${team}`} className={`${rowBgClass} hover:bg-sky-50/50 transition-colors`}>
                        {isFirst && (
                          <td rowSpan={3} className="border border-slate-300 p-2 text-center sticky left-0 bg-slate-50 z-10">{dayData.tanggal}</td>
                        )}
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">{td.desain || ""}</td>
                        <td className="border border-slate-300 p-2 text-center text-slate-500 text-xs">
                          {Object.keys(td.keterangan_per_kategori || {}).length > 0 ? (
                            <button
                              onClick={() => setModalData({ isOpen: true, title: `Keterangan (Tgl ${dayData.tanggal} Tim ${team})`, contentObj: td.keterangan_per_kategori! })}
                              className="w-full text-left truncate max-w-[120px] hover:text-sky-600 transition-colors group relative flex items-center justify-between"
                            >
                              <span className="truncate">{ketString}</span>
                              <Info className="w-3 h-3 ml-1 shrink-0 opacity-50 group-hover:opacity-100" />
                            </button>
                          ) : ""}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.courses || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.rpm || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.eff_100 || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-black text-slate-500 bg-slate-50/50">{team}</td>
                        <td className="border border-slate-300 p-1.5 px-3 truncate max-w-[120px]">{td.operator_name}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-sky-50/30">{td.hasil_produksi}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-medium">{p100}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-rose-50/40 text-rose-700">{td.jumlah_cacat}</td>
                        <td className="border border-slate-300 p-1.5 text-center text-rose-600 font-medium">{pCacat}</td>
                        
                        {/* KODE TINDAKAN */}
                        {["A", "B", "C", "D", "E", "F", "G", "H"].map(k => (
                          <td key={k} className="border border-slate-300 p-1 text-center text-slate-500">
                            {td.kode_tindakan[k] || 0}
                          </td>
                        ))}
                        
                        <td className="border border-slate-300 p-1.5 text-center text-orange-600 bg-orange-50/30 font-bold whitespace-nowrap">{formatHHMMSS(td.downtime_detik)}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-bold text-emerald-600">{pEff}</td>
                      </tr>
                    );
                  });
                })}

                {reportData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={24} className="p-8 text-center text-slate-500 font-semibold">
                      Belum ada data untuk bulan dan mesin ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Keterangan */}
      {modalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="font-bold text-slate-800">{modalData.title}</h3>
              <button 
                onClick={() => setModalData({ ...modalData, isOpen: false })}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {modalData.contentObj && Object.entries(modalData.contentObj).length > 0 ? (
                <div className="flex flex-col gap-4">
                  {Object.entries(modalData.contentObj).sort(([a], [b]) => a.localeCompare(b)).map(([kat, details]) => (
                    <div key={kat} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="font-black text-slate-700 text-sm mb-2 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 w-6 h-6 flex items-center justify-center rounded-md font-bold">{kat}</span>
                        <span>Kategori {kat}</span>
                      </div>
                      {details.length > 0 ? (
                        <ul className="space-y-2">
                          {(() => {
                            const counts: Record<string, number> = {};
                            (details as string[]).forEach((d) => {
                              const key = d?.trim() || "Detail umum";
                              counts[key] = (counts[key] || 0) + 1;
                            });
                            return Object.entries(counts).map(([d, cnt], i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200/80 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span className="font-medium text-slate-800">{d}</span>
                                </div>
                                <span className={`font-extrabold px-2 py-0.5 rounded-md text-[11px] border shrink-0 ${cnt > 1 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {cnt}x kejadian
                                </span>
                              </li>
                            ));
                          })()}
                        </ul>
                      ) : (
                        <p className="text-slate-400 text-sm italic">Tidak ada detail spesifik.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-center py-4">Tidak ada keterangan.</p>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50 shrink-0">
              <button
                onClick={() => setModalData({ ...modalData, isOpen: false })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Sinkronisasi Google Sheets */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Sinkronkan ke Google Sheets
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Mesin {selectedMachine} • {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Target Sheet:</span>
                  <span className="font-black text-slate-800">{months.find(m => m.value === selectedMonth)?.label} {selectedYear}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Target Kolom Mesin:</span>
                  <span className="font-black text-slate-800">Mesin {selectedMachine}</span>
                </div>
              </div>

              {/* Date Scope Filter */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                  Cakupan Tanggal / Baris yang Disinkronkan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div 
                    onClick={() => setSyncScope("all")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      syncScope === "all" ? "bg-indigo-50 border-indigo-500 shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="syncScopeSingle"
                        checked={syncScope === "all"}
                        onChange={() => setSyncScope("all")}
                        className="text-indigo-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Semua Tanggal (1 s.d. 31)</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSyncScope("range")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      syncScope === "range" ? "bg-indigo-50 border-indigo-500 shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="syncScopeSingle"
                        checked={syncScope === "range"}
                        onChange={() => setSyncScope("range")}
                        className="text-indigo-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Pilih Tanggal Tertentu</span>
                    </div>
                  </div>
                </div>

                {syncScope === "range" && (
                  <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 flex items-center gap-3 animate-fadeIn">
                    <span className="text-xs font-bold text-indigo-900 shrink-0">Tanggal:</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={syncStartDay}
                        onChange={(e) => setSyncStartDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-9 px-2.5 text-center font-black text-xs rounded-xl bg-white border border-indigo-300 text-slate-800 focus:outline-indigo-600 shadow-2xs"
                      />
                      <span className="text-xs font-bold text-slate-400">s/d</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={syncEndDay}
                        onChange={(e) => setSyncEndDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-9 px-2.5 text-center font-black text-xs rounded-xl bg-white border border-indigo-300 text-slate-800 focus:outline-indigo-600 shadow-2xs"
                      />
                    </div>
                    <span className="text-[11px] text-indigo-700 font-semibold hidden sm:inline">
                      (Hanya baris tgl {syncStartDay} - {syncEndDay} yang diupdate)
                    </span>
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                  Pilih Mode Pengisian Data:
                </label>

                <div 
                  onClick={() => setSyncSafeMode(true)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    syncSafeMode ? "bg-emerald-50 border-emerald-500 shadow-xs" : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="syncMode"
                    checked={syncSafeMode}
                    onChange={() => setSyncSafeMode(true)}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      🛡️ Mode Aman (Hanya Isi yang Masih Kosong)
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                      Data manual yang sudah ada di sheet tidak akan ditimpa atau diubah sama sekali.
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => setSyncSafeMode(false)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    !syncSafeMode ? "bg-amber-50 border-amber-500 shadow-xs" : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="syncMode"
                    checked={!syncSafeMode}
                    onChange={() => setSyncSafeMode(false)}
                    className="mt-0.5 text-amber-600"
                  />
                  <div>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      🔄 Mode Perbarui Semua (Timpa dengan Data Web)
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                      Mengisi baris mesin ini dengan data produksi terbaru dari web.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={syncToGoogleSheets}
                disabled={isSyncing}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                Mulai Sinkronkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SYNC SELURUH MESIN (JAM 9 PAGI / ON-DEMAND) */}
      {isSyncAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 sm:p-7 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    Sinkronisasi Seluruh Mesin
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Otomatisasi Laporan {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSyncingAll && setIsSyncAllModalOpen(false)}
                disabled={isSyncingAll}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  Fitur ini akan menyinkronkan <strong>seluruh 10 mesin aktif</strong> (R1, R2, R1C, R2C, R3B, R11, R12, R16, T1C, T2A) ke Google Sheets secara berurutan. Ini adalah alur yang sama persis dengan yang berjalan pada <strong>Jadwal Otomatis Pukul 09:00 WIB</strong>.
                </div>
              </div>

              {/* Date Scope Filter */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                  Cakupan Tanggal / Baris:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div 
                    onClick={() => setSyncScope("all")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      syncScope === "all" ? "bg-amber-50 border-amber-500 shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="syncScopeAll"
                        checked={syncScope === "all"}
                        onChange={() => setSyncScope("all")}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Semua Tanggal (1 s.d. 31)</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSyncScope("range")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      syncScope === "range" ? "bg-amber-50 border-amber-500 shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="syncScopeAll"
                        checked={syncScope === "range"}
                        onChange={() => setSyncScope("range")}
                        className="text-amber-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Pilih Tanggal Tertentu</span>
                    </div>
                  </div>
                </div>

                {syncScope === "range" && (
                  <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 flex items-center gap-3 animate-fadeIn">
                    <span className="text-xs font-bold text-amber-900 shrink-0">Tanggal:</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={syncStartDay}
                        onChange={(e) => setSyncStartDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-9 px-2.5 text-center font-black text-xs rounded-xl bg-white border border-amber-300 text-slate-800 focus:outline-amber-600 shadow-2xs"
                      />
                      <span className="text-xs font-bold text-slate-400">s/d</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={syncEndDay}
                        onChange={(e) => setSyncEndDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 h-9 px-2.5 text-center font-black text-xs rounded-xl bg-white border border-amber-300 text-slate-800 focus:outline-amber-600 shadow-2xs"
                      />
                    </div>
                    <span className="text-[11px] text-amber-800 font-semibold hidden sm:inline">
                      (Hanya baris tgl {syncStartDay} - {syncEndDay} di 10 mesin yang diupdate)
                    </span>
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div 
                  onClick={() => setSyncSafeMode(true)}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1.5 ${
                    syncSafeMode 
                      ? "border-emerald-500 bg-emerald-50/50 shadow-sm" 
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      🛡️ Mode Aman (Default)
                    </span>
                    {syncSafeMode && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Hanya mengisi baris/shift yang masih kosong. Data manual Anda tidak akan ditimpa.
                  </p>
                </div>

                <div 
                  onClick={() => setSyncSafeMode(false)}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1.5 ${
                    !syncSafeMode 
                      ? "border-amber-500 bg-amber-50/50 shadow-sm" 
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      🔄 Perbarui Semua
                    </span>
                    {!syncSafeMode && <Check className="w-4 h-4 text-amber-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Menimpa dan memperbarui seluruh data 1 bulan penuh pada semua mesin dari web.
                  </p>
                </div>
              </div>

              {/* Real-time Checklist of 10 Machines */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center justify-between">
                  <span>Daftar 10 Mesin Target:</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-black">10 Mesin</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {machines.map((m) => {
                    const mResult = syncAllResults?.find((r: any) => r.machine === m);
                    const isSuccess = mResult && mResult.success;
                    const isFailed = mResult && !mResult.success;
                    return (
                      <div 
                        key={m}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all ${
                          isSuccess
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                            : isFailed
                            ? "bg-rose-100 border-rose-300 text-rose-800"
                            : isSyncingAll
                            ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{m}</span>
                        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isFailed && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                        {!mResult && isSyncingAll && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsSyncAllModalOpen(false)}
                disabled={isSyncingAll}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={executeSyncAll}
                disabled={isSyncingAll}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-amber-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyinkronkan 10 Mesin...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Mulai Sync Semua Mesin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN JADWAL AUTO-SYNC HARIAN */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-7 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    Jadwal Auto-Sync Laporan
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Otomatisasi Laporan Bulanan Mesin (WIB)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingSchedule && setIsScheduleModalOpen(false)}
                disabled={isSavingSchedule}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">
                    Status Sinkronisasi Otomatis
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scheduleEnabled ? "Otomatis berjalan setiap hari" : "Auto-sync sedang dinonaktifkan"}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 relative"></div>
                </label>
              </div>

              {/* Time Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Waktu Eksekusi Harian (Format Jam WIB)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-12 px-4 rounded-2xl bg-white border-2 border-amber-200 text-sm font-black text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full transition-all shadow-2xs"
                />
                
                {/* Auto Timezone Sync Info (WIB <-> Vercel UTC) */}
                {(() => {
                  const [hStr, mStr] = (scheduleTime || "07:10").split(":");
                  const h = parseInt(hStr || "7", 10);
                  const m = parseInt(mStr || "10", 10);
                  const utcH = ((h - 7 + 24) % 24).toString().padStart(2, "0");
                  const utcM = m.toString().padStart(2, "0");
                  return (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] font-semibold text-amber-900 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-700">Waktu WIB:</span>
                        <span className="font-black font-mono">{scheduleTime} WIB</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span>Vercel Cron (UTC):</span>
                        <span className="font-black font-mono text-slate-800">{utcH}:{utcM} UTC</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Mode Eksekusi Data
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleSafeMode(true)}
                    className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      scheduleSafeMode 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🛡️ Mode Aman
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleSafeMode(false)}
                    className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !scheduleSafeMode 
                        ? "border-amber-500 bg-amber-50 text-amber-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🔄 Timpa Semua
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={isSavingSchedule}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveScheduleSetting}
                disabled={isSavingSchedule}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-amber-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3.5 bg-slate-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-fadeIn max-w-md">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : toast.type === "error"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-white tracking-wide uppercase">
              {toast.title}
            </h4>
            <p className="text-xs font-medium text-slate-300 mt-0.5 leading-relaxed break-words">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
