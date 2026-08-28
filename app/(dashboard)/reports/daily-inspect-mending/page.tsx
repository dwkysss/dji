"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Search,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Settings,
  Zap,
  Save,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getDailyInspectMendingReport,
  DailyInspectMendingRow,
} from "@/actions/daily-inspect-mending-actions";
import {
  syncDailyInspectMendingToGoogleSheet,
  getDailyInspectMendingScheduleSettings,
  updateDailyInspectMendingScheduleSettings,
  syncAllDailyInspectMending,
} from "@/actions/google-sheet-actions";

const MACHINES = [
  "ALL",
  "R1",
  "R2",
  "R1C",
  "R2C",
  "R3B",
  "R11",
  "R12",
  "R16",
  "T1C",
  "T2A",
];

export type DailySortField =
  | "tgl_inspect"
  | "tgl_potong"
  | "potongan_ke"
  | "tgl_mending"
  | "tgl_final";

export type DailySortDirection = "asc" | "desc";

export default function DailyInspectMendingPage() {
  const [data, setData] = useState<DailyInspectMendingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Google Sheet Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Auto-Sync Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("17:30");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isTestingSchedule, setIsTestingSchedule] = useState(false);

  // Quick Initial Dates (Default: Bulan Ini / THIS_MONTH agar enteng & cepat)
  const initialDates = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    return {
      from: formatDate(startOfMonth),
      to: formatDate(today),
    };
  }, []);

  // Filters (Default: Bulan Ini)
  const [selectedMachine, setSelectedMachine] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<string>("THIS_MONTH");
  const [dateFrom, setDateFrom] = useState<string>(initialDates.from);
  const [dateTo, setDateTo] = useState<string>(initialDates.to);

  // Pagination (Default: 50 baris per halaman agar render 60 FPS)
  const [pageSize, setPageSize] = useState<number | "ALL">(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Column Sorting (Default: tgl_inspect DESC)
  const [sortField, setSortField] = useState<DailySortField>("tgl_inspect");
  const [sortDirection, setSortDirection] = useState<DailySortDirection>("desc");

  // Basis Kolom Tanggal untuk Filter (AUTO: sinkron otomatis dengan sortField)
  const [customDateBasis, setCustomDateBasis] = useState<
    "AUTO" | "tgl_inspect" | "tgl_potong" | "tgl_mending" | "tgl_final"
  >("AUTO");

  const activeDateBasis = useMemo(() => {
    if (customDateBasis !== "AUTO") return customDateBasis;
    if (sortField === "tgl_potong") return "tgl_potong";
    if (sortField === "tgl_mending") return "tgl_mending";
    if (sortField === "tgl_final") return "tgl_final";
    return "tgl_inspect";
  }, [customDateBasis, sortField]);

  const handleSort = (field: DailySortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getDailyInspectMendingReport({
        machine: selectedMachine,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchQuery || undefined,
        dateField: activeDateBasis,
      });
      if (res.success) {
        setData(res.data);
      } else {
        console.error("Gagal memuat data:", res.error);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchSchedule();
  }, [selectedMachine, dateFrom, dateTo, activeDateBasis]);

  const fetchSchedule = async () => {
    try {
      const res = await getDailyInspectMendingScheduleSettings();
      if (res.success) {
        setScheduleTime(res.time);
        setScheduleEnabled(res.enabled);
      }
    } catch (_) {}
  };

  // Handler quick date preset
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "ALL") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "TODAY") {
      const tStr = formatDate(today);
      setDateFrom(tStr);
      setDateTo(tStr);
    } else if (preset === "YESTERDAY") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === "7DAYS") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setDateFrom(formatDate(past));
      setDateTo(formatDate(today));
    } else if (preset === "THIS_MONTH") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(formatDate(startOfMonth));
      setDateTo(formatDate(today));
    }
  };

  // Filtered by search client-side & sorted by active sort column
  const filteredData = useMemo(() => {
    let list = [...data];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.nomor_mc.toLowerCase().includes(q) ||
          r.design_id.toLowerCase().includes(q) ||
          String(r.potongan_ke).includes(q) ||
          r.petugas_inspect.toLowerCase().includes(q) ||
          r.petugas_mending.toLowerCase().includes(q) ||
          r.petugas_final.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: string | number = a[sortField] || "";
      let valB: string | number = b[sortField] || "";

      if (sortField === "potongan_ke") {
        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        if (numA !== numB) {
          return sortDirection === "asc" ? numA - numB : numB - numA;
        }
        return a.pcs_index - b.pcs_index;
      }

      // Date sorting
      const strA = String(valA);
      const strB = String(valB);
      if (!strA && strB) return 1; // kosong selalu di bawah
      if (strA && !strB) return -1;
      if (strA !== strB) {
        return sortDirection === "asc"
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      }

      // Tie breaker untuk tanggal sama: urutkan jam mulai atau potongan_ke
      if (a.start_inspect && b.start_inspect && a.start_inspect !== b.start_inspect) {
        return sortDirection === "asc"
          ? a.start_inspect.localeCompare(b.start_inspect)
          : b.start_inspect.localeCompare(a.start_inspect);
      }
      return b.potongan_ke - a.potongan_ke;
    });

    return list;
  }, [data, searchQuery, sortField, sortDirection]);

  // Reset ke halaman 1 saat filter atau pencarian berganti
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMachine, dateFrom, dateTo, sortField, sortDirection, activeDateBasis]);

  // Paginated Data untuk render DOM cepat tanpa lag
  const paginatedData = useMemo(() => {
    if (pageSize === "ALL") return filteredData;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === "ALL" || filteredData.length === 0) return 1;
    return Math.ceil(filteredData.length / pageSize);
  }, [filteredData, pageSize]);

  // Metrics summary
  const summary = useMemo(() => {
    let totalPanel = 0;
    let totalMeter = 0;
    let inspectedCount = 0;
    let mendedCount = 0;
    let finalCount = 0;

    filteredData.forEach((r) => {
      if (r.qty_panel) totalPanel += r.qty_panel;
      if (r.qty_meter) totalMeter += r.qty_meter;
      if (r.finish_inspect || r.tgl_inspect) inspectedCount++;
      if (r.finish_mending || r.tgl_mending) mendedCount++;
      if (r.finish_final || r.tgl_final) finalCount++;
    });

    return {
      totalRows: filteredData.length,
      totalPanel,
      totalMeter,
      inspectedCount,
      mendedCount,
      finalCount,
    };
  }, [filteredData]);

  // Export to Excel with grouped header layout
  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    // Build multi-tier header array
    const exportRows: any[] = [
      // Row 1: Title
      ["LAPORAN HARIAN HASIL INSPECT DAN MENDING 2026"],
      [
        `Mesin: ${selectedMachine === "ALL" ? "Semua Mesin" : selectedMachine} | Tanggal Export: ${new Date().toLocaleDateString("id-ID")}`,
      ],
      [], // Empty row
      // Row 4: Top Group Headers
      [
        "NO",
        "DATA POTONG KAIN",
        "",
        "",
        "",
        "",
        "",
        "",
        "DATA INSPEKSI (QC)",
        "",
        "",
        "",
        "",
        "DATA MENDING",
        "",
        "",
        "",
        "",
        "DATA FINAL INSPEK",
        "",
        "",
        "",
        "",
      ],
      // Row 5: Column Subheaders
      [
        "No",
        "Tgl Potong",
        "Design",
        "Mesin",
        "Potongan Ke",
        "PCS Ke",
        "Qty Panel",
        "Qty Meter",
        "Tgl Inspect",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
        "Durasi",
        "Tgl Mending",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
        "Durasi",
        "Tgl Final",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
        "Durasi",
      ],
    ];

    // Data rows
    filteredData.forEach((r, idx) => {
      exportRows.push([
        idx + 1,
        r.tgl_potong || "-",
        r.design_id || "-",
        r.nomor_mc,
        r.potongan_ke,
        r.pcs_index,
        r.qty_panel !== null ? r.qty_panel : "",
        r.qty_meter !== null ? r.qty_meter : "",
        r.tgl_inspect || "-",
        r.petugas_inspect || "-",
        r.start_inspect || "-",
        r.finish_inspect || "-",
        r.durasi_inspect || "-",
        r.tgl_mending || "-",
        r.petugas_mending || "-",
        r.start_mending || "-",
        r.finish_mending || "-",
        r.durasi_mending || "-",
        r.tgl_final || "-",
        r.petugas_final || "-",
        r.start_final || "-",
        r.finish_final || "-",
        r.durasi_final || "-",
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportRows);

    // Merge group header cells
    worksheet["!merges"] = [
      { s: { r: 3, c: 1 }, e: { r: 3, c: 7 } }, // DATA POTONG KAIN (7 kolom: 1-7)
      { s: { r: 3, c: 8 }, e: { r: 3, c: 12 } }, // DATA INSPEKSI (QC) (5 kolom: 8-12)
      { s: { r: 3, c: 13 }, e: { r: 3, c: 17 } }, // DATA MENDING (5 kolom: 13-17)
      { s: { r: 3, c: 18 }, e: { r: 3, c: 22 } }, // DATA FINAL INSPEK (5 kolom: 18-22)
    ];

    // Set column widths
    worksheet["!cols"] = [
      { wch: 5 }, // No
      { wch: 12 }, // Tgl Potong
      { wch: 15 }, // Design
      { wch: 8 }, // Mesin
      { wch: 10 }, // Pot. Ke
      { wch: 8 }, // PCS Ke
      { wch: 10 }, // Qty Panel
      { wch: 10 }, // Qty Meter
      { wch: 12 }, // Tgl Inspect
      { wch: 18 }, // Petugas Inspect
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
      { wch: 10 }, // Durasi Inspect
      { wch: 12 }, // Tgl Mending
      { wch: 18 }, // Petugas Mending
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
      { wch: 10 }, // Durasi Mending
      { wch: 12 }, // Tgl Final
      { wch: 18 }, // Petugas Final
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
      { wch: 10 }, // Durasi Final
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inspect & Mending Harian");
    XLSX.writeFile(
      workbook,
      `Laporan_Harian_Inspect_Mending_${selectedMachine}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const handleSyncGoogleSheet = async () => {
    if (filteredData.length === 0) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      // Selalu urutkan secara kronologis ASC (tanggal terlama di atas, tanggal terbesar di bawah)
      const sortedForSheet = [...filteredData].sort((a, b) => {
        const dateA = a.tgl_inspect || a.tgl_mending || a.tgl_final || a.tgl_potong || "";
        const dateB = b.tgl_inspect || b.tgl_mending || b.tgl_final || b.tgl_potong || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        if (a.start_inspect && b.start_inspect && a.start_inspect !== b.start_inspect) {
          return a.start_inspect.localeCompare(b.start_inspect);
        }
        if (a.nomor_mc !== b.nomor_mc) return a.nomor_mc.localeCompare(b.nomor_mc);
        if (a.potongan_ke !== b.potongan_ke) return a.potongan_ke - b.potongan_ke;
        return a.pcs_index - b.pcs_index;
      });

      const res = await syncDailyInspectMendingToGoogleSheet(sortedForSheet);
      if (res.success) {
        setSyncResult({
          type: "success",
          message: res.message || `${filteredData.length} baris data berhasil disinkronkan ke Google Sheet!`,
        });
      } else {
        setSyncResult({
          type: "error",
          message: res.error || "Gagal menyinkronkan data ke Google Sheet.",
        });
      }
    } catch (err: any) {
      setSyncResult({
        type: "error",
        message: err.message || "Terjadi kesalahan koneksi saat sinkronisasi.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      const res = await updateDailyInspectMendingScheduleSettings({
        time: scheduleTime,
        enabled: scheduleEnabled,
      });
      if (res.success) {
        setIsScheduleModalOpen(false);
        setSyncResult({
          type: "success",
          message: `Jadwal Auto-Sync harian berhasil disetel ke pukul ${scheduleTime} WIB!`,
        });
      } else {
        setSyncResult({
          type: "error",
          message: res.error || "Gagal menyimpan jadwal.",
        });
      }
    } catch (err: any) {
      setSyncResult({
        type: "error",
        message: err.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleTestSchedule = async () => {
    setIsTestingSchedule(true);
    try {
      const res = await syncAllDailyInspectMending();
      if (res.success) {
        setIsScheduleModalOpen(false);
        setSyncResult({
          type: "success",
          message: res.message || "Uji Auto-Sync berhasil! Data telah masuk ke Google Sheet.",
        });
      } else {
        setSyncResult({
          type: "error",
          message: res.error || "Uji Auto-Sync gagal.",
        });
      }
    } catch (err: any) {
      setSyncResult({
        type: "error",
        message: err.message || "Terjadi kesalahan saat pengujian.",
      });
    } finally {
      setIsTestingSchedule(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER CARD - Enterprise Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-[#003366] to-[#0070bc] p-6 md:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 w-48 h-48 rounded-full bg-sky-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-sky-200 text-xs font-bold tracking-wide">
              <span>JURNAL GABUNGAN HARIAN</span>
            </div>

            <div className="flex items-center flex-wrap gap-3">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-sky-400" />
                Laporan Harian Inspect & Mending
              </h1>

              {/* Inline Auto-Sync Pill */}
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer group shadow-2xs"
                title="Klik untuk mengatur jam sinkronisasi otomatis harian ke Google Sheet"
              >
                <span className="relative flex h-1.5 w-1.5">
                  {scheduleEnabled && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      scheduleEnabled ? "bg-emerald-400" : "bg-white/40"
                    }`}
                  ></span>
                </span>
                <span className="text-white/70">Auto-Sync</span>
                <span className="font-black font-mono text-white">{scheduleTime}</span>
                <span className="text-white/50 text-[10px]">WIB</span>
                <Settings className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
              </button>
            </div>

            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Rekapitulasi logbook harian menyeluruh dari potong kain, inspeksi (QC), mending, hingga final inspect & mending untuk seluruh mesin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading || isSyncing}
              className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white font-bold text-xs flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={handleSyncGoogleSheet}
              disabled={isSyncing || filteredData.length === 0}
              className="h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-teal-950/20 transition-all cursor-pointer disabled:opacity-50"
              title="Sinkronkan data yang tampil ke tab HASIL INSPECT DAN MENDING HARIAN 2026 di Google Sheet"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-teal-200" />
              )}
              <span>{isSyncing ? "Menyinkronkan..." : "Sinkron ke Sheet"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredData.length === 0 || isSyncing}
              className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SYNC NOTIFICATION BANNER */}
      {syncResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in duration-200 ${
            syncResult.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncResult.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="text-xs font-bold leading-relaxed">{syncResult.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setSyncResult(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Potongan
            </div>
            <div className="text-xl font-black text-slate-800 font-mono">
              {summary.totalRows}{" "}
              <span className="text-xs font-medium text-slate-500">Roll/Pcs</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Volume Produksi
            </div>
            <div className="text-lg font-black text-slate-800 font-mono flex items-center gap-2">
              <span>{summary.totalPanel} <span className="text-xs font-semibold text-slate-500">Pnl</span></span>
              <span className="text-slate-300">|</span>
              <span>{summary.totalMeter} <span className="text-xs font-semibold text-slate-500">Mtr</span></span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Inspeksi (QC)
            </div>
            <div className="text-xl font-black text-indigo-700 font-mono">
              {summary.inspectedCount}{" "}
              <span className="text-xs font-medium text-slate-500">
                / {summary.totalRows} Selesai
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mending & Final
            </div>
            <div className="text-xl font-black text-teal-700 font-mono">
              {summary.mendedCount}{" "}
              <span className="text-xs font-medium text-slate-500">
                Mnd · {summary.finalCount} Fnl
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        {/* Machine Pill Buttons */}
        <div>
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Pilih Mesin</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MACHINES.map((mc) => {
              const active = selectedMachine === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  onClick={() => setSelectedMachine(mc)}
                  className={`h-9 px-3.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    active
                      ? "bg-[#003366] text-white shadow-md shadow-blue-950/20 scale-102"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {mc === "ALL" ? "Semua Mesin" : mc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: "ALL", label: "Semua" },
                { id: "TODAY", label: "Hari Ini" },
                { id: "YESTERDAY", label: "Kemarin" },
                { id: "7DAYS", label: "7 Hari" },
                { id: "THIS_MONTH", label: "Bulan Ini" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === p.id
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Basis Tanggal Filter Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-900 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
              <span className="text-[11px] text-slate-500 font-semibold">Basis:</span>
              <select
                value={customDateBasis}
                onChange={(e) => setCustomDateBasis(e.target.value as any)}
                className="bg-transparent font-black text-[#0070bc] cursor-pointer outline-hidden text-xs pr-1"
                title="Pilih kolom tanggal yang dijadikan acuan filter rentang tanggal"
              >
                <option value="AUTO">
                  Otomatis ({activeDateBasis === "tgl_inspect" ? "Tgl Inspect" : activeDateBasis === "tgl_potong" ? "Tgl Potong" : activeDateBasis === "tgl_mending" ? "Tgl Mending" : "Tgl Final Inspek"})
                </option>
                <option value="tgl_inspect">Tgl Inspect (QC)</option>
                <option value="tgl_potong">Tgl Potong (Produksi)</option>
                <option value="tgl_mending">Tgl Mending</option>
                <option value="tgl_final">Tgl Final Inspek</option>
              </select>
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDatePreset("CUSTOM");
                  setDateFrom(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold text-xs">s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDatePreset("CUSTOM");
                  setDateTo(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Search Box & Sort Indicator */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Active Sort Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs">
              <span className="text-slate-400">Urut:</span>
              <span className="text-[#0070bc] font-black">
                {sortField === "tgl_inspect" && "Tgl Inspect"}
                {sortField === "tgl_potong" && "Tgl Potong"}
                {sortField === "potongan_ke" && "Potongan Ke"}
                {sortField === "tgl_mending" && "Tgl Mending"}
                {sortField === "tgl_final" && "Tgl Final Inspek"}
              </span>
              <span className="text-[11px] font-black text-slate-500">
                ({sortDirection === "desc" ? "Terbaru ⬇" : "Terlama ⬆"})
              </span>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari design, potongan, petugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
            <div className="text-sm font-black text-slate-700">
              Memuat Data Laporan Harian...
            </div>
            <div className="text-xs text-slate-400">
              Menggabungkan data potong, inspeksi, mending, dan final
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-base font-black text-slate-800">
              Tidak Ada Data Ditemukan
            </div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data yang sesuai dengan filter mesin ({selectedMachine}) atau rentang tanggal yang dipilih.
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1540px]">
              {/* TWO-TIER MULTI-LEVEL HEADER */}
              <thead>
                {/* TIER 1: GROUP HEADERS */}
                <tr className="text-white text-center font-black tracking-wider text-[11px] select-none">
                  <th className="bg-slate-900 border-r border-b border-slate-700 py-2.5 px-3 w-12" rowSpan={2}>
                    NO
                  </th>
                  <th
                    colSpan={7}
                    className="bg-[#003366] border-r border-b border-blue-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA POTONG KAIN
                  </th>
                  <th
                    colSpan={5}
                    className="bg-[#1e40af] border-r border-b border-indigo-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA INSPEKSI (QC)
                  </th>
                  <th
                    colSpan={5}
                    className="bg-[#0f766e] border-r border-b border-teal-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA MENDING
                  </th>
                  <th
                    colSpan={5}
                    className="bg-[#334155] border-b border-slate-700 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA FINAL INSPEK
                  </th>
                </tr>

                {/* TIER 2: COLUMN HEADERS */}
                <tr className="bg-slate-100 text-slate-700 font-black text-[10px] tracking-wider uppercase border-b-2 border-slate-300 select-none">
                  {/* Potong Kain Columns */}
                  <th
                    onClick={() => handleSort("tgl_potong")}
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200/90 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan Tgl Potong"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={sortField === "tgl_potong" ? "text-[#0070bc] font-black underline underline-offset-2" : ""}>
                        Tgl Potong
                      </span>
                      {sortField === "tgl_potong" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Design</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Mesin</th>
                  <th
                    onClick={() => handleSort("potongan_ke")}
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200/90 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan Nomor Potongan"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={sortField === "potongan_ke" ? "text-[#0070bc] font-black underline underline-offset-2" : ""}>
                        Pot. Ke
                      </span>
                      {sortField === "potongan_ke" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">PCS Ke</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Qty Pnl</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Qty Mtr</th>

                  {/* Inspect Columns */}
                  <th
                    onClick={() => handleSort("tgl_inspect")}
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200/90 transition-colors select-none group bg-blue-50/50"
                    title="Klik untuk mengurutkan berdasarkan Tgl Inspect"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={sortField === "tgl_inspect" ? "text-[#0070bc] font-black underline underline-offset-2" : ""}>
                        Tgl Inspect
                      </span>
                      {sortField === "tgl_inspect" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Selesai</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Durasi</th>

                  {/* Mending Columns */}
                  <th
                    onClick={() => handleSort("tgl_mending")}
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200/90 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan Tgl Mending"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={sortField === "tgl_mending" ? "text-[#0070bc] font-black underline underline-offset-2" : ""}>
                        Tgl Mending
                      </span>
                      {sortField === "tgl_mending" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Selesai</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Durasi</th>

                  {/* Final Columns */}
                  <th
                    onClick={() => handleSort("tgl_final")}
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200/90 transition-colors select-none group"
                    title="Klik untuk mengurutkan berdasarkan Tgl Final"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span className={sortField === "tgl_final" ? "text-[#0070bc] font-black underline underline-offset-2" : ""}>
                        Tgl Final
                      </span>
                      {sortField === "tgl_final" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Selesai</th>
                  <th className="py-2.5 px-3 text-center">Durasi</th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {paginatedData.map((row, idx) => {
                  const displayNo =
                    pageSize === "ALL"
                      ? idx + 1
                      : (currentPage - 1) * (pageSize as number) + idx + 1;
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-sky-50/70 transition-colors ${
                        isEven ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {/* No */}
                      <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                        {displayNo}
                      </td>

                      {/* DATA POTONG */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_potong || "-"}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {row.design_id || "-"}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-200">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-black font-mono text-[11px]">
                          {row.nomor_mc}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-[#0070bc] border-r border-slate-200">
                        {row.potongan_ke}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                        {row.pcs_index}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                        {row.qty_panel !== null ? row.qty_panel : "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 border-r-2 border-slate-400">
                        {row.qty_meter !== null ? `${row.qty_meter}` : "-"}
                      </td>

                      {/* DATA INSPECT */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-900 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.finish_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 text-center border-r-2 border-slate-400 whitespace-nowrap">
                        {row.durasi_inspect && row.durasi_inspect !== "-" ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 font-mono font-bold text-blue-700 text-[11px]">
                            {row.durasi_inspect}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* DATA MENDING */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_mending || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-teal-900 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_mending || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_mending || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.finish_mending || "-"}
                      </td>
                      <td className="py-3 px-3 text-center border-r-2 border-slate-400 whitespace-nowrap">
                        {row.durasi_mending && row.durasi_mending !== "-" ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200/80 font-mono font-bold text-teal-700 text-[11px]">
                            {row.durasi_mending}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* DATA FINAL */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_final || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_final || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_final || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.finish_final || "-"}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {row.durasi_final && row.durasi_final !== "-" ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-700 text-[11px]">
                            {row.durasi_final}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION & FOOTER CONTROL BAR */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
              <span>
                Menampilkan{" "}
                <strong className="text-slate-900 font-black font-mono">
                  {filteredData.length === 0
                    ? 0
                    : pageSize === "ALL"
                    ? 1
                    : (currentPage - 1) * (pageSize as number) + 1}
                </strong>{" "}
                -{" "}
                <strong className="text-slate-900 font-black font-mono">
                  {pageSize === "ALL"
                    ? filteredData.length
                    : Math.min(currentPage * (pageSize as number), filteredData.length)}
                </strong>{" "}
                dari{" "}
                <strong className="text-[#0070bc] font-black font-mono">
                  {filteredData.length}
                </strong>{" "}
                baris
              </span>

              <span className="text-slate-300">|</span>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-normal">Per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-800 text-xs outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="ALL">Semua</option>
                </select>
              </div>
            </div>

            {/* Pagination Buttons */}
            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <div className="px-3 text-xs font-bold text-slate-600 font-mono">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
      {/* ⏰ JADWAL AUTO-SYNC MODAL POPUP */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Jadwal Auto-Sync Harian
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Sinkronisasi Otomatis Seluruh Mesin (WIB)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingSchedule && setIsScheduleModalOpen(false)}
                disabled={isSavingSchedule}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">
                    Status Sinkronisasi Otomatis
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scheduleEnabled
                      ? "Otomatis berjalan setiap hari"
                      : "Auto-sync sedang dinonaktifkan"}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 relative"></div>
                </label>
              </div>

              {/* Time Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Waktu Eksekusi Harian (Format Jam WIB)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-12 px-4 rounded-2xl bg-white border-2 border-teal-200 text-sm font-black text-slate-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-hidden w-full transition-all shadow-2xs"
                />
              </div>

              {/* Target Sheet Info */}
              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-950 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-teal-800">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Target Tab Google Sheet:</span>
                </div>
                <div className="font-mono font-bold text-[11px] bg-white/80 px-2 py-1 rounded-lg border border-teal-200 text-teal-900 break-all">
                  HASIL INSPECT DAN MENDING HARIAN 2026
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestSchedule}
                disabled={isTestingSchedule || isSavingSchedule}
                className="h-11 px-4 rounded-2xl border-2 border-teal-300 hover:bg-teal-50 text-teal-900 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Uji coba jalankan auto-sync sekarang"
              >
                {isTestingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
                ) : (
                  <Zap className="w-4 h-4 text-teal-600" />
                )}
                <span>Uji Sekarang</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule || isTestingSchedule}
                className="flex-1 h-11 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
