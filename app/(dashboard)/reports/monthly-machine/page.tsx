"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { getMonthlyMachineReport, MonthlyMachineReportData } from "@/actions/report-actions";
import { getMachineStatuses } from "@/actions/dashboard-actions";
import { getGoogleSheetEndpoint, sendPayloadToGoogleSheet, syncAllMonthlyMachines, getAutoSyncScheduleSettings, updateAutoSyncScheduleSettings } from "@/actions/google-sheet-actions";
import { FileSpreadsheet, Loader2, Calendar, Monitor, AlertCircle, ArrowLeft, CloudUpload, X, Info, CheckCircle2, RotateCw, Zap, Check, Clock, Settings, ShieldCheck, BarChart3 } from "lucide-react";
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

// Reusable Info Formula Tooltip dengan React Portal (tidak akan pernah terpotong oleh overflow/tabel)
function FormulaTooltip({
  title,
  formula,
  example,
  className = "",
  dark = false,
  position,
}: {
  title: string;
  formula: string;
  example?: string;
  className?: string;
  dark?: boolean;
  position?: "top" | "bottom";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 224; // w-56
    const tooltipHeight = 110;

    // Tentukan penempatan atas atau bawah
    const spaceAbove = rect.top;
    const placeAbove =
      position === "top"
        ? true
        : position === "bottom"
        ? false
        : spaceAbove >= tooltipHeight + 15;

    const top = placeAbove ? rect.top - 8 : rect.bottom + 8;

    // Rata tengah terhadap ikon, dibatasi agar tidak keluar layar
    let left = rect.left + rect.width / 2;
    const minLeft = tooltipWidth / 2 + 12;
    const maxLeft = window.innerWidth - tooltipWidth / 2 - 12;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    setCoords({ top, left, placeAbove });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div
      className={`relative inline-flex items-center ml-1 ${className}`}
      onMouseEnter={() => {
        updatePosition();
        setIsOpen(true);
      }}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        updatePosition();
        setIsOpen(!isOpen);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        title="Klik/Arahkan untuk melihat penjelasan rumus"
        aria-label="Info Rumus"
        className={`p-0.5 rounded-full transition-colors cursor-pointer focus:outline-hidden ${
          dark
            ? "text-slate-400 hover:text-amber-300 hover:bg-slate-700/60"
            : "text-slate-400 hover:text-sky-600 hover:bg-sky-50"
        }`}
      >
        <Info className="w-3 h-3 shrink-0" />
      </button>

      {mounted &&
        isOpen &&
        coords &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
            className="z-[9999] w-56 p-2.5 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 text-left text-xs pointer-events-none animate-fadeIn"
          >
            {/* Judul */}
            <div className="font-bold text-amber-300 mb-1.5 text-[11px] uppercase tracking-wide leading-tight">
              {title}
            </div>

            {/* Rumus / Formula Box */}
            <div className="text-[11px] text-sky-200 font-mono bg-slate-800 px-2 py-1.5 rounded-md border border-slate-700 mb-1.5 whitespace-normal break-words font-semibold leading-snug">
              {formula}
            </div>

            {/* Keterangan Tambahan */}
            {example && (
              <div className="text-[10px] text-slate-300 leading-normal font-normal whitespace-normal">
                <span className="font-semibold text-slate-400">Ket: </span>
                {example}
              </div>
            )}

            {/* Panah Segitiga */}
            {coords.placeAbove ? (
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            ) : (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

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
  const [syncTargetMachines, setSyncTargetMachines] = useState<string[]>([]);

  // Auto-Sync Schedule Settings State (Langsung di Halaman Laporan)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleSafeMode, setScheduleSafeMode] = useState(true);
  const [scheduleMachines, setScheduleMachines] = useState<string[]>([]);
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
          if (res.machines && res.machines.length > 0) {
            setScheduleMachines(res.machines);
          }
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
        machines: scheduleMachines.length > 0 ? scheduleMachines : undefined,
      });

      if (res.success) {
        setIsScheduleModalOpen(false);
        setToast({
          type: "success",
          title: "Jadwal Auto-Sync Tersimpan",
          message: `Jadwal sinkronisasi otomatis harian (${scheduleMachines.length} mesin) berhasil disetel ke pukul ${scheduleTime} WIB!`,
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
        machines: syncTargetMachines.length > 0 ? syncTargetMachines : undefined,
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
      // --- REKAPITULASI TOTAL ROWS IN EXCEL ---
      const totalRow = [
        "TOTAL",
        "",
        "",
        "",
        "",
        summaryMetrics.totalEff100,
        "",
        "TOTAL",
        summaryMetrics.totalHasilProduksi,
        summaryMetrics.totalEfisiensi.toFixed(2) + "%",
        summaryMetrics.totalJumlahCacat,
        summaryMetrics.totalPersenCacat.toFixed(2) + "%",
        summaryMetrics.kodeTotals["A"] || 0,
        summaryMetrics.kodeTotals["B"] || 0,
        summaryMetrics.kodeTotals["C"] || 0,
        summaryMetrics.kodeTotals["D"] || 0,
        summaryMetrics.kodeTotals["E"] || 0,
        summaryMetrics.kodeTotals["F"] || 0,
        summaryMetrics.kodeTotals["G"] || 0,
        summaryMetrics.kodeTotals["H"] || 0,
        formatHHMMSS(summaryMetrics.totalDowntimeDetik),
        summaryMetrics.overallWaktuEfektif.toFixed(2) + "%"
      ];
      wsData.push(totalRow);

      const opportunityRow = [
        "Opportunity",
        "",
        "",
        "",
        "",
        "",
        "",
        "EFF %",
        "",
        summaryMetrics.totalEfisiensi.toFixed(2) + "%",
        "",
        summaryMetrics.totalPersenCacat.toFixed(2) + "%",
        summaryMetrics.kodePercentages["A"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["B"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["C"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["D"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["E"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["F"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["G"].toFixed(2) + "%",
        summaryMetrics.kodePercentages["H"].toFixed(2) + "%",
        summaryMetrics.downtimeRate.toFixed(2) + "%",
        ""
      ];
      wsData.push(opportunityRow);

      // Empty spacing rows
      wsData.push([]);
      wsData.push([]);

      // Section Header: SUMMARY PER SHIFT & PER TEAM
      wsData.push([
        "REKAPITULASI PER SHIFT", "", "", 
        "REKAPITULASI PER TEAM", "", "", "", 
        "MASALAH PRODUKSI (KODE TINDAKAN)", "", "", "", "", "", "", "", ""
      ]);
      wsData.push([
        "Shift", "HASIL PRODUKSI", "% Hasil",
        "Team", "HASIL PRODUKSI", "Eff Team", "Cacat/Team", "% Hasil",
        "Team", "A", "B", "C", "D", "E", "F", "G", "H", "TOTAL"
      ]);

      // Row 1: Shift 1, Team A, Masalah Team A
      const teamAProblemTotal = summaryMetrics.kodeTindakanList.reduce((acc: number, k: string) => acc + (summaryMetrics.masalahProduksiMatrix["A"][k] || 0), 0);
      wsData.push([
        "Shift 1", summaryMetrics.shiftBreakdown[0].hasilProduksi, summaryMetrics.shiftBreakdown[0].persenHasil.toFixed(2) + "%",
        "A", summaryMetrics.teamBreakdown["A"].hasilProduksi, summaryMetrics.teamBreakdown["A"].effTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["A"].cacatPerTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["A"].persenHasil.toFixed(2) + "%",
        "A", ...summaryMetrics.kodeTindakanList.map((k: string) => summaryMetrics.masalahProduksiMatrix["A"][k] || 0), teamAProblemTotal
      ]);

      // Row 2: Shift 2, Team B, Masalah Team B
      const teamBProblemTotal = summaryMetrics.kodeTindakanList.reduce((acc: number, k: string) => acc + (summaryMetrics.masalahProduksiMatrix["B"][k] || 0), 0);
      wsData.push([
        "Shift 2", summaryMetrics.shiftBreakdown[1].hasilProduksi, summaryMetrics.shiftBreakdown[1].persenHasil.toFixed(2) + "%",
        "B", summaryMetrics.teamBreakdown["B"].hasilProduksi, summaryMetrics.teamBreakdown["B"].effTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["B"].cacatPerTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["B"].persenHasil.toFixed(2) + "%",
        "B", ...summaryMetrics.kodeTindakanList.map((k: string) => summaryMetrics.masalahProduksiMatrix["B"][k] || 0), teamBProblemTotal
      ]);

      // Row 3: Shift 3, Team C, Masalah Team C
      const teamCProblemTotal = summaryMetrics.kodeTindakanList.reduce((acc: number, k: string) => acc + (summaryMetrics.masalahProduksiMatrix["C"][k] || 0), 0);
      wsData.push([
        "Shift 3", summaryMetrics.shiftBreakdown[2].hasilProduksi, summaryMetrics.shiftBreakdown[2].persenHasil.toFixed(2) + "%",
        "C", summaryMetrics.teamBreakdown["C"].hasilProduksi, summaryMetrics.teamBreakdown["C"].effTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["C"].cacatPerTeam.toFixed(2) + "%", summaryMetrics.teamBreakdown["C"].persenHasil.toFixed(2) + "%",
        "C", ...summaryMetrics.kodeTindakanList.map((k: string) => summaryMetrics.masalahProduksiMatrix["C"][k] || 0), teamCProblemTotal
      ]);

      // Row 4: TOTAL
      const totalAllProblems = summaryMetrics.kodeTindakanList.reduce((acc: number, k: string) => acc + (summaryMetrics.kodeTotals[k] || 0), 0);
      wsData.push([
        "TOTAL", summaryMetrics.totalHasilProduksi, "100.00%",
        "TOTAL", summaryMetrics.totalHasilProduksi, summaryMetrics.totalEfisiensi.toFixed(2) + "%", summaryMetrics.totalPersenCacat.toFixed(2) + "%", "100.00%",
        "TOTAL", ...summaryMetrics.kodeTindakanList.map((k: string) => summaryMetrics.kodeTotals[k] || 0), totalAllProblems
      ]);

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

  const summaryMetrics = useMemo(() => {
    let totalEff100 = 0;
    let totalHasilProduksi = 0;
    let totalJumlahCacat = 0;
    let totalDowntimeDetik = 0;

    const kodeTindakanList = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const kodeTotals: Record<string, number> = {};
    kodeTindakanList.forEach((k) => {
      kodeTotals[k] = 0;
    });

    const shiftBreakdown = [
      { shiftName: "Shift 1", shiftIndex: 0, hasilProduksi: 0, persenHasil: 0 },
      { shiftName: "Shift 2", shiftIndex: 1, hasilProduksi: 0, persenHasil: 0 },
      { shiftName: "Shift 3", shiftIndex: 2, hasilProduksi: 0, persenHasil: 0 },
    ];

    const teamBreakdown: Record<
      string,
      {
        hasilProduksi: number;
        targetEff100: number;
        jumlahCacat: number;
        effTeam: number;
        cacatPerTeam: number;
        persenHasil: number;
      }
    > = {
      A: { hasilProduksi: 0, targetEff100: 0, jumlahCacat: 0, effTeam: 0, cacatPerTeam: 0, persenHasil: 0 },
      B: { hasilProduksi: 0, targetEff100: 0, jumlahCacat: 0, effTeam: 0, cacatPerTeam: 0, persenHasil: 0 },
      C: { hasilProduksi: 0, targetEff100: 0, jumlahCacat: 0, effTeam: 0, cacatPerTeam: 0, persenHasil: 0 },
    };

    const masalahProduksiMatrix: Record<string, Record<string, number>> = {
      A: {},
      B: {},
      C: {},
    };
    ["A", "B", "C"].forEach((t) => {
      kodeTindakanList.forEach((k) => {
        masalahProduksiMatrix[t][k] = 0;
      });
    });

    // Hitung jumlah hari aktif produksi (hari yang memiliki data/operator)
    const activeDaysCount =
      reportData.filter((d) =>
        Object.values(d.teamData).some(
          (td) =>
            (td.hasil_produksi && td.hasil_produksi > 0) ||
            (td.eff_100 && td.eff_100 > 0) ||
            (td.operator_name && td.operator_name.trim() !== "")
        )
      ).length || reportData.length || 1;

    let sumAllShiftPercentages = 0;
    const teamShiftPercentages: Record<string, number> = { A: 0, B: 0, C: 0 };
    let sumAllShiftCacatPercentages = 0;
    const teamCacatPercentages: Record<string, number> = { A: 0, B: 0, C: 0 };

    reportData.forEach((dayData) => {
      const teamsToRender = dayData.orderedTeams || [
        { teamName: "A", data: dayData.teamData["A"] },
        { teamName: "B", data: dayData.teamData["B"] },
        { teamName: "C", data: dayData.teamData["C"] },
      ];

      teamsToRender.forEach((teamObj, sIdx) => {
        const teamName = teamObj.teamName;
        const td = teamObj.data;
        if (!td) return;

        const prod = Number(td.hasil_produksi) || 0;
        const eff100 = Number(td.eff_100) || 0;
        const cacat = Number(td.jumlah_cacat) || 0;
        const dt = Number(td.downtime_detik) || 0;

        // Persentase shift dari 100% (Kolom J di sheet)
        const shiftP100 = prod > 0 && eff100 > 0 ? (prod / eff100) * 100 : 0;
        sumAllShiftPercentages += shiftP100;
        if (teamShiftPercentages[teamName] !== undefined) {
          teamShiftPercentages[teamName] += shiftP100;
        }

        // Persentase cacat shift (Kolom L di sheet)
        const shiftPCacat = prod > 0 && cacat > 0 ? (cacat / prod) * 100 : 0;
        sumAllShiftCacatPercentages += shiftPCacat;
        if (teamCacatPercentages[teamName] !== undefined) {
          teamCacatPercentages[teamName] += shiftPCacat;
        }

        totalHasilProduksi += prod;
        totalEff100 += eff100;
        totalJumlahCacat += cacat;
        totalDowntimeDetik += dt;

        if (sIdx >= 0 && sIdx < 3) {
          shiftBreakdown[sIdx].hasilProduksi += prod;
        }

        if (teamBreakdown[teamName]) {
          teamBreakdown[teamName].hasilProduksi += prod;
          teamBreakdown[teamName].targetEff100 += eff100;
          teamBreakdown[teamName].jumlahCacat += cacat;
        }

        kodeTindakanList.forEach((k) => {
          const val = Number(td.kode_tindakan[k]) || 0;
          kodeTotals[k] += val;
          if (masalahProduksiMatrix[teamName]) {
            masalahProduksiMatrix[teamName][k] += val;
          }
        });
      });
    });

    // Sesuai rumus Google Sheet Cell J98: =SUM(J5:J97) / JUMLAH_HARI / 3
    const totalEfisiensi = activeDaysCount > 0 ? sumAllShiftPercentages / (activeDaysCount * 3) : 0;
    // Sesuai rumus Google Sheet Cell L98: =SUM(L5:L97) / JUMLAH_HARI / 3
    const totalPersenCacat = activeDaysCount > 0 ? sumAllShiftCacatPercentages / (activeDaysCount * 3) : 0;

    shiftBreakdown.forEach((s) => {
      s.persenHasil = totalHasilProduksi > 0 ? (s.hasilProduksi / totalHasilProduksi) * 100 : 0;
    });

    ["A", "B", "C"].forEach((t) => {
      const tb = teamBreakdown[t];
      // Sesuai rumus Google Sheet: =SUM(J_Tim) / JUMLAH_HARI
      tb.effTeam = activeDaysCount > 0 ? teamShiftPercentages[t] / activeDaysCount : 0;
      // Sesuai rumus Google Sheet: =SUM(L_Tim) / JUMLAH_HARI
      tb.cacatPerTeam = activeDaysCount > 0 ? teamCacatPercentages[t] / activeDaysCount : 0;
      tb.persenHasil = totalHasilProduksi > 0 ? (tb.hasilProduksi / totalHasilProduksi) * 100 : 0;
    });

    const totalMinutesInMonth = activeDaysCount * 24 * 60; // Jumlah Hari x 24 Jam x 60 Menit

    const kodePercentages: Record<string, number> = {};
    kodeTindakanList.forEach((k) => {
      // Sesuai rumus Google Sheet Cell M99: =M98 / (JUMLAH_HARI * 24 * 60)
      kodePercentages[k] = totalMinutesInMonth > 0 ? (kodeTotals[k] / totalMinutesInMonth) * 100 : 0;
    });

    const totalOperatingSeconds = activeDaysCount * 24 * 3600;
    const overallWaktuEfektif =
      totalOperatingSeconds > 0
        ? Math.max(0, ((totalOperatingSeconds - totalDowntimeDetik) / totalOperatingSeconds) * 100)
        : 0;

    // Sesuai rumus Google Sheet untuk Downtime / Total Menit
    const downtimeRate =
      totalMinutesInMonth > 0 ? ((totalDowntimeDetik / 60) / totalMinutesInMonth) * 100 : 0;

    return {
      activeDaysCount,
      totalEff100,
      totalHasilProduksi,
      totalJumlahCacat,
      totalDowntimeDetik,
      totalEfisiensi,
      totalPersenCacat,
      overallWaktuEfektif,
      downtimeRate,
      kodeTotals,
      kodePercentages,
      shiftBreakdown,
      teamBreakdown,
      masalahProduksiMatrix,
      kodeTindakanList,
    };
  }, [reportData]);


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
                setSyncTargetMachines(machines.length > 0 ? [...machines] : ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "T1C", "T2A"]);
                setIsSyncAllModalOpen(true);
              }}
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50 cursor-pointer"
              title="Sync Mesin Terpilih / Seluruh Mesin Sekaligus"
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
                  <th className="border border-slate-300 p-2 min-w-[60px]">
                    <div className="inline-flex items-center justify-center">
                      Eff 100%
                      <FormulaTooltip position="bottom" title="Target Kapasitas 100%" formula="(RPM x 480 menit) / Courses" example="Target kapasitas jika mesin beroperasi 100% tanpa henti selama 8 jam" />
                    </div>
                  </th>
                  <th className="border border-slate-300 p-2 min-w-[50px] bg-sky-50">Team</th>
                  <th className="border border-slate-300 p-2 min-w-[120px]">Nama Operator</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">
                    <div className="inline-flex items-center justify-center">
                      Hasil Produksi
                      <FormulaTooltip position="bottom" title="Hasil Produksi" formula="Panel murni yang dihasilkan (tidak termasuk panel BS)" />
                    </div>
                  </th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">
                    <div className="inline-flex items-center justify-center">
                      Persentase dari 100%
                      <FormulaTooltip position="bottom" title="Persentase dari 100%" formula="(Hasil Produksi / Eff 100%) x 100%" example="Contoh: (38 / 65) x 100% = 58.46%" />
                    </div>
                  </th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">Jumlah Cacat</th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">
                    <div className="inline-flex items-center justify-center">
                      Persentase Cacat
                      <FormulaTooltip position="bottom" title="Persentase Cacat" formula="(Jumlah Cacat / Hasil Produksi) x 100%" example="Contoh: (13 / 38) x 100% = 34.21%" />
                    </div>
                  </th>
                  <th colSpan={8} className="border border-slate-300 p-1 bg-amber-50">Kode Tindakan</th>
                  <th className="border border-slate-300 p-2 min-w-[100px]">Downtime (HH:MM:SS)</th>
                  <th className="border border-slate-300 p-2 min-w-[90px]">
                    <div className="inline-flex items-center justify-center">
                      Persentase Waktu Efektif
                      <FormulaTooltip position="bottom" title="Persentase Waktu Efektif" formula="((28.800s - Downtime) / 28.800s) x 100%" example="Persentase mesin aktif beroperasi selama 8 jam shift" />
                    </div>
                  </th>
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

              {/* TFOOT: BARIS REKAP TOTAL & OPPORTUNITY */}
              {reportData.length > 0 && !isLoading && (
                <tfoot className="font-black text-[11px] border-t-2 border-slate-400 shadow-md select-none">
                  {/* Baris 1: TOTAL */}
                  <tr className="bg-slate-800 text-white">
                    <td colSpan={3} className="border border-slate-700 p-2.5 text-center font-black sticky left-0 bg-slate-900 z-10 text-xs tracking-wider">
                      TOTAL
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center text-slate-400">-</td>
                    <td className="border border-slate-700 p-1.5 text-center text-slate-400">-</td>
                    <td className="border border-slate-700 p-1.5 text-center bg-slate-700/80 font-mono text-amber-300 font-black whitespace-nowrap">
                      <span>{summaryMetrics.totalEff100.toLocaleString("id-ID")}</span>
                      <FormulaTooltip dark title="Total Target Eff 100%" formula="SUM(Eff 100% Seluruh Shift)" example="Total akumulasi target kapasitas seluruh shift yang beroperasi" />
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center text-slate-400">-</td>
                    <td className="border border-slate-700 p-1.5 text-center text-slate-300 font-black tracking-wide">TOTAL</td>
                    <td className="border border-slate-700 p-1.5 text-center bg-sky-900/90 font-mono text-white text-xs font-black whitespace-nowrap">
                      <span>{summaryMetrics.totalHasilProduksi.toLocaleString("id-ID")}</span>
                      <FormulaTooltip dark title="Total Hasil Produksi" formula="SUM(Hasil Produksi Seluruh Shift)" example="Total seluruh hasil panel/meter bersih dalam sebulan" />
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center bg-amber-400 text-slate-950 font-black text-xs whitespace-nowrap">
                      <span>{summaryMetrics.totalEfisiensi.toFixed(2)}%</span>
                      <FormulaTooltip dark title="Total Efisiensi Mesin" formula="SUM(Persentase dari 100%) / (Jumlah Hari x 3 Shift)" example="Rata-rata persentase efisiensi shift selama hari kerja aktif" />
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center bg-rose-900/80 font-mono text-rose-200 font-black whitespace-nowrap">
                      <span>{summaryMetrics.totalJumlahCacat.toLocaleString("id-ID")}</span>
                      <FormulaTooltip dark title="Total Jumlah Cacat" formula="SUM(Jumlah Cacat Seluruh Shift)" example="Akumulasi seluruh temuan cacat produksi sebulan" />
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center text-rose-300 font-mono font-black whitespace-nowrap">
                      <span>{summaryMetrics.totalPersenCacat.toFixed(2)}%</span>
                      <FormulaTooltip dark title="Total Persentase Cacat" formula="SUM(Persentase Cacat) / (Jumlah Hari x 3 Shift)" example="Rata-rata persentase cacat shift selama hari kerja aktif" />
                    </td>
                    {summaryMetrics.kodeTindakanList.map((k: string) => (
                      <td key={k} className="border border-slate-700 p-1 text-center font-mono text-slate-200 bg-slate-800/90 whitespace-nowrap">
                        {summaryMetrics.kodeTotals[k] || 0}
                      </td>
                    ))}
                    <td className="border border-slate-700 p-1.5 text-center text-orange-300 font-mono whitespace-nowrap">
                      {formatHHMMSS(summaryMetrics.totalDowntimeDetik)}
                    </td>
                    <td className="border border-slate-700 p-1.5 text-center font-black text-emerald-300 whitespace-nowrap">
                      <span>{summaryMetrics.overallWaktuEfektif.toFixed(2)}%</span>
                      <FormulaTooltip dark title="Total Waktu Efektif" formula="((Total Waktu Operasi - Total Downtime) / Total Waktu Operasi) x 100%" example="Persentase efisiensi jam operasional mesin terhadap downtime sebulan" />
                    </td>
                  </tr>

                  {/* Baris 2: OPPORTUNITY & % MASALAH */}
                  <tr className="bg-amber-100 text-amber-950 font-black">
                    <td colSpan={3} className="border border-amber-300 p-2 text-center sticky left-0 bg-amber-200 z-10 text-xs uppercase tracking-wider text-amber-900">
                      Opportunity
                    </td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-300 p-1 text-center text-amber-800 text-[10px] font-black uppercase">EFF %</td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-400 p-1 text-center bg-amber-300 text-amber-950 font-black text-xs whitespace-nowrap">
                      <span>{summaryMetrics.totalEfisiensi.toFixed(2)}%</span>
                      <FormulaTooltip title="Opportunity Efisiensi (EFF %)" formula="SUM(Persentase dari 100%) / (Jumlah Hari x 3 Shift)" example="Peluang pencapaian kapasitas mesin yang terealisasi" />
                    </td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                    {summaryMetrics.kodeTindakanList.map((k: string) => (
                      <td key={k} className="border border-amber-300 p-1 text-center font-mono text-[10px] text-slate-800 whitespace-nowrap">
                        <span>{summaryMetrics.kodePercentages[k].toFixed(2)}%</span>
                        {summaryMetrics.kodeTotals[k] > 0 && (
                          <FormulaTooltip
                            title={`Opportunity Kode ${k}`}
                            formula={`Total Kode ${k} / (Jumlah Hari x 24 Jam x 60 Menit)`}
                            example={`Peluang kejadian masalah Kode ${k} per total menit sebulan`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="border border-amber-300 p-1 text-center text-[10px] text-amber-900 font-mono whitespace-nowrap">
                      <span>{summaryMetrics.downtimeRate.toFixed(2)}%</span>
                      <FormulaTooltip
                        title="Opportunity Downtime"
                        formula="Total Downtime Menit / (Jumlah Hari x 24 Jam x 60 Menit)"
                        example="Rasio durasi downtime terhadap total waktu operasional sebulan"
                      />
                    </td>
                    <td className="border border-amber-300 p-1 text-center text-slate-400">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 3 SUMMARY BREAKDOWN TABLES (PER SHIFT, PER TEAM, MASALAH PRODUKSI) */}
          {reportData.length > 0 && !isLoading && (
            <div className="p-6 bg-slate-50/70 border-t border-slate-200 space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                  <BarChart3 className="w-4 h-4 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                    Rekapitulasi & Analisis Performa Mesin ({selectedMachine})
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Statistik akumulasi produksi per shift, efisiensi tim, dan matriks sebaran masalah produksi.
                  </p>
                </div>
              </div>

              {/* BARIS 1: REKAP SHIFT & REKAP TEAM */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* 1. REKAPITULASI PER SHIFT */}
                <div className="md:col-span-5 lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
                  <div>
                    <div className="pb-2.5 mb-2.5 border-b border-slate-200">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Rekapitulasi per Shift
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                            <th className="border border-slate-300 p-2 text-left">Shift</th>
                            <th className="border border-slate-300 p-2 text-center">Hasil Produksi</th>
                            <th className="border border-slate-300 p-2 text-center">
                              <div className="inline-flex items-center justify-center">
                                % Hasil
                                <FormulaTooltip title="% Kontribusi Shift" formula="(Hasil Produksi Shift / Total Hasil Produksi) x 100%" example="Porsi kontribusi hasil shift tersebut terhadap total produksi sebulan" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                          {summaryMetrics.shiftBreakdown.map((s: any) => (
                            <tr key={s.shiftName} className="hover:bg-slate-50 transition-colors">
                              <td className="border border-slate-300 p-2 font-semibold text-slate-800">{s.shiftName}</td>
                              <td className="border border-slate-300 p-2 text-center font-mono text-slate-900 font-semibold">
                                {s.hasilProduksi.toLocaleString("id-ID")}
                              </td>
                              <td className="border border-slate-300 p-2 text-center font-mono text-slate-900 font-semibold whitespace-nowrap">
                                <span>{s.persenHasil.toFixed(2)}%</span>
                                <FormulaTooltip title={`Kontribusi ${s.shiftName}`} formula={`(${s.hasilProduksi} / ${summaryMetrics.totalHasilProduksi}) x 100% = ${s.persenHasil.toFixed(2)}%`} />
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-800 text-white font-bold">
                            <td className="border border-slate-700 p-2 font-bold">TOTAL</td>
                            <td className="border border-slate-700 p-2 text-center font-mono text-amber-300 font-bold">
                              {summaryMetrics.totalHasilProduksi.toLocaleString("id-ID")}
                            </td>
                            <td className="border border-slate-700 p-2 text-center font-mono font-bold">100.00%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. REKAPITULASI PER TEAM */}
                <div className="md:col-span-7 lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between">
                  <div>
                    <div className="pb-2.5 mb-2.5 border-b border-slate-200">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Rekapitulasi & Efisiensi per Team
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase text-center">
                            <th className="border border-slate-300 p-2 w-14">Team</th>
                            <th className="border border-slate-300 p-2">Hasil Prod</th>
                            <th className="border border-slate-300 p-2">
                              <div className="inline-flex items-center justify-center">
                                Eff Team
                                <FormulaTooltip title="Efisiensi per Team" formula="SUM(Persentase dari 100% Tim) / Jumlah Hari" example="Rata-rata persentase efisiensi shift yang dijalankan oleh tim tersebut" />
                              </div>
                            </th>
                            <th className="border border-slate-300 p-2">
                              <div className="inline-flex items-center justify-center">
                                Cacat/Team
                                <FormulaTooltip title="Persentase Cacat per Team" formula="SUM(Persentase Cacat Tim) / Jumlah Hari" example="Rata-rata persentase cacat shift yang dijalankan oleh tim tersebut" />
                              </div>
                            </th>
                            <th className="border border-slate-300 p-2">
                              <div className="inline-flex items-center justify-center">
                                % Hasil
                                <FormulaTooltip title="% Hasil Kontribusi Tim" formula="(Hasil Produksi Tim / Total Hasil Produksi) x 100%" example="Kontribusi volume produksi tim terhadap total keseluruhan" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium text-slate-900">
                          {(["A", "B", "C"] as const).map((t) => {
                            const tb = summaryMetrics.teamBreakdown[t];
                            return (
                              <tr key={t} className="hover:bg-slate-50 transition-colors">
                                <td className="border border-slate-300 p-2 text-center font-bold text-slate-900 bg-white">
                                  {t}
                                </td>
                                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-slate-900 bg-white">
                                  {tb.hasilProduksi.toLocaleString("id-ID")}
                                </td>
                                {/* Eff Team - biru kehijauan lembut */}
                                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-emerald-900 bg-emerald-50 whitespace-nowrap">
                                  <span>{tb.effTeam.toFixed(2)}%</span>
                                  <FormulaTooltip title={`Eff Team ${t}`} formula={`SUM(Persentase dari 100% Tim ${t}) / Jumlah Hari Aktif`} example={`Rata-rata efisiensi shift Team ${t}`} />
                                </td>
                                {/* Cacat/Team - merah sangat lembut */}
                                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-rose-800 bg-rose-50 whitespace-nowrap">
                                  <span>{tb.cacatPerTeam.toFixed(2)}%</span>
                                  <FormulaTooltip title={`Cacat Team ${t}`} formula={`SUM(Persentase Cacat Tim ${t}) / Jumlah Hari Aktif`} example={`Rata-rata persentase cacat shift Team ${t}`} />
                                </td>
                                {/* % Hasil - kuning amber lembut */}
                                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-amber-900 bg-amber-50 whitespace-nowrap">
                                  <span>{tb.persenHasil.toFixed(2)}%</span>
                                  <FormulaTooltip title={`Kontribusi Team ${t}`} formula={`(Hasil Produksi Tim ${t} / Total Hasil Produksi) x 100%`} example={`Porsi produksi Team ${t} terhadap total sebulan`} />
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-800 text-white font-bold text-center">
                            <td className="border border-slate-700 p-2 font-bold">TOTAL</td>
                            <td className="border border-slate-700 p-2 font-mono text-amber-300 font-bold">
                              {summaryMetrics.totalHasilProduksi.toLocaleString("id-ID")}
                            </td>
                            <td className="border border-slate-700 p-2 font-mono text-white font-bold whitespace-nowrap">
                              <span>{summaryMetrics.totalEfisiensi.toFixed(2)}%</span>
                              <FormulaTooltip dark title="Rata-rata Efisiensi Tim" formula="(Eff Tim A + Eff Tim B + Eff Tim C) / 3" example="Rata-rata efisiensi dari ketiga tim" />
                            </td>
                            <td className="border border-slate-700 p-2 font-mono text-white font-bold whitespace-nowrap">
                              <span>{summaryMetrics.totalPersenCacat.toFixed(2)}%</span>
                              <FormulaTooltip dark title="Total Rasio Cacat" formula="(Total Jumlah Cacat / Total Hasil Produksi) x 100%" example="Persentase total cacat terhadap total produksi" />
                            </td>
                            <td className="border border-slate-700 p-2 font-mono font-bold">100.00%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* BARIS 2: MATRIKS MASALAH PRODUKSI (FULL WIDTH) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 overflow-hidden">
                <div className="pb-2.5 mb-2.5 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Masalah Produksi (Kode Tindakan)
                  </h4>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase text-center">
                        <th className="border border-slate-300 p-2 w-16">Team</th>
                        {summaryMetrics.kodeTindakanList.map((k: string) => (
                          <th key={k} className="border border-slate-300 p-2 text-slate-700 font-bold">
                            Kode {k}
                          </th>
                        ))}
                        <th className="border border-slate-300 p-2 w-20 bg-slate-100 text-slate-800 font-bold">
                          <div className="inline-flex items-center justify-center">
                            TOTAL
                            <FormulaTooltip title="Total Masalah per Tim" formula="SUM(Kejadian Masalah Kode A s.d. H)" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {(["A", "B", "C"] as const).map((t) => {
                        const rowTotal = summaryMetrics.kodeTindakanList.reduce(
                          (acc: number, k: string) => acc + (summaryMetrics.masalahProduksiMatrix[t][k] || 0),
                          0
                        );
                        return (
                          <tr key={t} className="hover:bg-slate-50 text-center transition-colors">
                            <td className="border border-slate-300 p-2 font-bold text-slate-800 bg-slate-50">
                              {t}
                            </td>
                            {summaryMetrics.kodeTindakanList.map((k: string) => {
                              const val = summaryMetrics.masalahProduksiMatrix[t][k] || 0;
                              return (
                                <td
                                  key={k}
                                  className={`border border-slate-300 p-2 font-mono text-center ${
                                    val > 0 ? "font-bold text-amber-800 bg-amber-50" : "text-slate-300 font-normal"
                                  }`}
                                >
                                  {val > 0 ? val : "—"}
                                </td>
                              );
                            })}
                            <td className="border border-slate-300 p-2 font-mono font-bold text-slate-900 bg-slate-50">
                              {rowTotal}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-800 text-white font-bold text-center">
                        <td className="border border-slate-700 p-2 font-bold">TOTAL</td>
                        {summaryMetrics.kodeTindakanList.map((k: string) => (
                          <td key={k} className="border border-slate-700 p-2 font-mono text-amber-300 font-bold">
                            {summaryMetrics.kodeTotals[k] || 0}
                          </td>
                        ))}
                        <td className="border border-slate-700 p-2 font-mono text-amber-400 bg-slate-900 font-bold">
                          {summaryMetrics.kodeTindakanList.reduce(
                            (acc: number, k: string) => acc + (summaryMetrics.kodeTotals[k] || 0),
                            0
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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

              {/* Interactive Machine Selection Grid */}
              <div className="space-y-2.5 border border-slate-100 rounded-2xl p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-[#0070bc]" />
                    Pilih Mesin yang Disinkronkan
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSyncingAll}
                      onClick={() => setSyncTargetMachines([...machines])}
                      className="text-[10px] font-bold text-[#0070bc] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      disabled={isSyncingAll}
                      onClick={() => setSyncTargetMachines([])}
                      className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {machines.map((m) => {
                    const isSelected = syncTargetMachines.includes(m);
                    const mResult = syncAllResults?.find((r: any) => r.machine === m);
                    const isSuccess = mResult && mResult.success;
                    const isFailed = mResult && !mResult.success;
                    const isRunningThis = isSyncingAll && isSelected && !mResult;

                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isSyncingAll}
                        onClick={() => {
                          setSyncTargetMachines((prev) =>
                            isSelected ? prev.filter((item) => item !== m) : [...prev, m]
                          );
                        }}
                        className={`h-9 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-between gap-1 cursor-pointer relative border ${
                          isSuccess
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                            : isFailed
                            ? "bg-rose-100 border-rose-300 text-rose-800"
                            : isRunningThis
                            ? "bg-amber-100 border-amber-300 text-amber-800 animate-pulse"
                            : isSelected
                            ? "bg-[#0070bc] border-[#0070bc] text-white shadow-sm shadow-[#0070bc]/30"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <span>{m}</span>
                        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {isFailed && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        {isRunningThis && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />}
                        {!mResult && !isSyncingAll && isSelected && (
                          <Check className="w-3 h-3 text-white shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 font-bold">
                    {syncTargetMachines.length === 0
                      ? "⚠️ Pilih minimal 1 mesin untuk memulai sinkronisasi"
                      : `${syncTargetMachines.length} dari ${machines.length} mesin dipilih`}
                  </span>
                  {syncTargetMachines.length > 0 && (
                    <span className="text-[10px] font-black text-[#0070bc] max-w-[200px] truncate text-right">
                      {syncTargetMachines.join(", ")}
                    </span>
                  )}
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
                disabled={isSyncingAll || syncTargetMachines.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-amber-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyinkronkan {syncTargetMachines.length} Mesin...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Mulai Sync ({syncTargetMachines.length} Mesin)</span>
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

              {/* Machine Selection for Auto-Sync */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-[#0070bc]" />
                    Mesin yang Disinkronkan Otomatis
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduleMachines(machines.length > 0 ? [...machines] : ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "T1C", "T2A"])}
                      className="text-[10px] font-bold text-[#0070bc] hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setScheduleMachines([])}
                      className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(machines.length > 0 ? machines : ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "T1C", "T2A"]).map((mc) => {
                    const isSelected = scheduleMachines.includes(mc);
                    return (
                      <button
                        key={mc}
                        type="button"
                        onClick={() => {
                          setScheduleMachines((prev) =>
                            isSelected ? prev.filter((m) => m !== mc) : [...prev, mc]
                          );
                        }}
                        className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer relative border ${
                          isSelected
                            ? "bg-[#0070bc] border-[#0070bc] text-white shadow-sm shadow-[#0070bc]/30"
                            : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </span>
                        )}
                        {mc}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {scheduleMachines.length === 0
                    ? "⚠️ Tidak ada mesin dipilih — auto-sync tidak akan memproses mesin apapun"
                    : `${scheduleMachines.length} dari ${machines.length || 13} mesin akan otomatis disinkronkan`}
                </p>
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
