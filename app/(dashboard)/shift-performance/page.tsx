"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Award,
  TrendingUp,
  Calendar,
  Factory,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Printer,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Layers,
  PieChart,
  ShieldCheck,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  HelpCircle,
  Trophy,
  Medal,
  Star,
  Activity,
  Flame,
  Zap,
  Ruler,
  Grid,
  Info,
} from "lucide-react";
import * as xlsx from "xlsx";
import {
  getMonthlyShiftPerformance,
  ShiftPerformanceSummary,
  ShiftOperatorPerformance,
  ShiftMachinePerformance,
  ShiftCategoryProblem,
  ShiftDailyTrend,
} from "@/actions/shift-performance-actions";
import { getMachineStatuses } from "@/actions/dashboard-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const SHIFT_THEMES: Record<string, { bg: string; text: string; border: string; activeBg: string; gradient: string }> = {
  A: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    activeBg: "bg-[#0070bc] text-white shadow-sky-500/25",
    gradient: "from-[#0070bc] to-sky-600",
  },
  B: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    activeBg: "bg-amber-600 text-white shadow-amber-500/25",
    gradient: "from-amber-600 to-orange-500",
  },
  C: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    activeBg: "bg-purple-600 text-white shadow-purple-500/25",
    gradient: "from-purple-600 to-indigo-600",
  },
  ALL: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    activeBg: "bg-slate-800 text-white shadow-slate-900/20",
    gradient: "from-slate-800 to-slate-700",
  },
};

export default function ShiftPerformancePage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedShift, setSelectedShift] = useState<string>("A"); // "A" | "B" | "C" | "all"
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [selectedFabricType, setSelectedFabricType] = useState<"all" | "panel" | "meter">("all");
  
  const [activeTab, setActiveTab] = useState<"overview" | "operators" | "problems" | "machines">("overview");
  const [chartFocus, setChartFocus] = useState<"output_defect" | "downtime">("output_defect");
  const [operatorSearchQuery, setOperatorSearchQuery] = useState<string>("");
  const [hoveredTrend, setHoveredTrend] = useState<ShiftDailyTrend | null>(null);

  const [machinesList, setMachinesList] = useState<string[]>(REGISTERED_MACHINES);
  const [data, setData] = useState<ShiftPerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch machine list on mount
  useEffect(() => {
    getMachineStatuses().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        const list = Array.from(new Set(res.data.map((m) => m.mesin_id))).sort();
        setMachinesList(list);
      }
    });
  }, []);

  // Fetch performance data whenever filters change
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getMonthlyShiftPerformance(
        selectedMonth,
        selectedYear,
        selectedShift,
        selectedMachine !== "all" ? selectedMachine : undefined,
        selectedFabricType
      );

      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMsg(res.error || "Gagal memuat data kinerja shift.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, selectedShift, selectedMachine, selectedFabricType]);

  // Filtered operators for search
  const filteredOperators = useMemo(() => {
    if (!data?.operators) return [];
    if (!operatorSearchQuery.trim()) return data.operators;
    const q = operatorSearchQuery.toLowerCase().trim();
    return data.operators.filter(
      (op) =>
        op.operatorName.toLowerCase().includes(q) ||
        op.machinesOperated.some((m) => m.toLowerCase().includes(q))
    );
  }, [data?.operators, operatorSearchQuery]);

  // Max daily output for chart scaling
  const maxDailyOutput = useMemo(() => {
    if (!data?.dailyTrends) return 100;
    const max = Math.max(...data.dailyTrends.map((d) => d.output), 0);
    return max > 0 ? max : 100;
  }, [data?.dailyTrends]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (!data) return;

    // Sheet 1: Ringkasan Shift
    const summarySheetData = [
      ["LAPORAN KINERJA BULANAN KEPALA SHIFT"],
      [`Periode: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`],
      [`Shift / Grup: ${selectedShift === "all" ? "Semua Shift (A, B, C)" : `Shift ${selectedShift}`}`],
      [`Jenis Kain: ${selectedFabricType === "all" ? "Semua Jenis (Panel & Meteran)" : selectedFabricType === "panel" ? "Khusus Kain Panel" : "Khusus Kain Meteran"}`],
      [`Mesin: ${selectedMachine === "all" ? "Semua Mesin" : selectedMachine}`],
      [],
      ["METRIK KUNCI", "NILAI", "SATUAN"],
      ["Total Panel Produksi (Panel Normal)", data.totalPanel, "Panel"],
      ["Total Meteran Produksi", data.totalMeter, "Meter"],
      ["Total Temuan Cacat", data.totalDefects, "Titik / Meter"],
      ["Tingkat Cacat Panel", `${data.defectRatePanel}%`, "%"],
      ["Tingkat Cacat Meteran", `${data.defectRateMeter}%`, "%"],
      ["Pencapaian Grade A (Quality Score)", `${data.qualityScore}%`, "%"],
      ["Grade A Panel", data.gradeA_Panel, "Panel"],
      ["Grade B Panel", data.gradeB_Panel, "Panel"],
      ["Grade BS Panel", data.gradeBS_Panel, "Panel"],
      ["Grade A Meteran", data.gradeA_Meter, "Roll / Meter"],
      ["Grade B Meteran", data.gradeB_Meter, "Roll / Meter"],
      ["Grade BS Meteran", data.gradeBS_Meter, "Roll / Meter"],
      ["Total Downtime Mesin", `${data.totalDowntimeHours} Jam (${data.totalDowntimeMinutes} Menit)`, "Jam / Menit"],
      ["Rata-rata Output per Hari Kerja", data.avgDailyOutput, "Output / Hari"],
      ["Rata-rata Downtime per Hari Kerja", `${data.avgDailyDowntimeMinutes} Menit`, "Menit / Hari"],
      ["Jumlah Operator Aktif", data.totalOperators, "Orang"],
      ["Hari Operasi Aktif", data.activeDays, "Hari"],
      ["Top Performer Operator", data.topOperator || "-", ""],
      ["Kendala Masalah Terbanyak", data.topIssueCategory || "-", ""],
    ];

    // Sheet 2: Kinerja Operator
    const operatorSheetData = [
      ["PERINGKAT & KINERJA OPERATOR SHIFT"],
      ["Rank", "Nama Operator", "Shift", "Mesin Dioperasikan", "Output Panel", "Output Meter", "Cacat Panel", "Cacat Meter", "Defect Rate (%)", "Grade A", "Grade B", "Grade BS", "Quality Score (%)", "Kontribusi (%)", "Rating Kinerja"],
      ...data.operators.map((op, idx) => [
        idx + 1,
        op.operatorName,
        op.shiftGroup,
        op.machinesOperated.join(", ") || "-",
        op.panelCount,
        op.meterCount,
        op.totalDefectsPanel,
        op.totalDefectsMeter,
        `${op.defectRate}%`,
        op.gradeA,
        op.gradeB,
        op.gradeBS,
        `${op.qualityScore}%`,
        `${op.contributionPercent}%`,
        op.performanceRating,
      ]),
    ];

    // Sheet 3: Tren Harian
    const dailySheetData = [
      ["TREN PRODUKSI & DOWNTIME HARIAN"],
      ["Tanggal", "Hari Ke-", "Panel", "Meter", "Total Cacat Panel", "Total Cacat Meter", "Downtime (Menit)", "Operator Aktif", "Mesin Aktif"],
      ...data.dailyTrends.map((d) => [
        d.date,
        d.day,
        d.panelCount,
        d.meterCount,
        d.defectsPanel,
        d.defectsMeter,
        d.downtimeMinutes,
        d.activeOperators,
        d.activeMachines.join(", ") || "-",
      ]),
    ];

    // Sheet 4: Kendala & Downtime
    const problemSheetData = [
      ["ANALISIS KENDALA & KATEGORI MASALAH"],
      ["Kategori Masalah", "Jumlah Kejadian", "Downtime (Menit)", "Persentase (%)", "Masalah Spesifik Terbanyak"],
      ...data.problemCategories.map((c) => [
        c.name,
        c.count,
        c.downtimeMinutes,
        `${c.percentage}%`,
        c.topIssues.map((ti) => `${ti.issue} (${ti.count}x)`).join(", ") || "-",
      ]),
    ];

    const wb = xlsx.utils.book_new();
    const wsSummary = xlsx.utils.aoa_to_sheet(summarySheetData);
    const wsOperators = xlsx.utils.aoa_to_sheet(operatorSheetData);
    const wsDaily = xlsx.utils.aoa_to_sheet(dailySheetData);
    const wsProblems = xlsx.utils.aoa_to_sheet(problemSheetData);

    xlsx.utils.book_append_sheet(wb, wsSummary, "Ringkasan Kinerja");
    xlsx.utils.book_append_sheet(wb, wsOperators, "Kinerja Operator");
    xlsx.utils.book_append_sheet(wb, wsDaily, "Tren Harian");
    xlsx.utils.book_append_sheet(wb, wsProblems, "Analisis Kendala");

    const fileName = `Laporan_Kinerja_Shift_${selectedShift}_${selectedFabricType.toUpperCase()}_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.xlsx`;
    xlsx.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  const currentShiftTheme = SHIFT_THEMES[selectedShift.toUpperCase()] || SHIFT_THEMES.A;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 sm:pb-24 animate-fadeIn space-y-4 sm:space-y-6">
      {/* Top Header Card */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] p-4 sm:p-6 lg:p-7 border border-[#e9ecef] shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200/80 shadow-xs shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            </div>
            <span>Kinerja Tim Produksi</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 max-w-2xl leading-relaxed">
            Evaluasi output produksi, kualitas grade, rasio cacat, dan performa tim secara terpisah antara kain Panel dan Meteran.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="grid grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto shrink-0">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl lg:rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? "animate-spin text-[#0070bc]" : "text-slate-500"}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isLoading || !data}
            className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl lg:rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={isLoading || !data}
            className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl lg:rounded-full bg-[#0070bc] hover:bg-[#005a96] text-white font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar & Switchers */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4">
        {/* Row 1: Team Selector & Period/Machine */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Users className="w-4 h-4 text-slate-400" /> Tim:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-1.5 sm:gap-2 flex-1 lg:flex-none">
              {[
                { id: "A", label: "Tim A" },
                { id: "B", label: "Tim B" },
                { id: "C", label: "Tim C" },
                { id: "all", label: "Semua Tim" },
              ].map((s) => {
                const isSelected = selectedShift === s.id;
                const theme = SHIFT_THEMES[s.id.toUpperCase()] || SHIFT_THEMES.A;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShift(s.id)}
                    className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-98 whitespace-nowrap ${
                      isSelected
                        ? `${theme.activeBg} shadow-md`
                        : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected
                          ? "bg-white animate-pulse"
                          : s.id === "A"
                          ? "bg-sky-500"
                          : s.id === "B"
                          ? "bg-amber-500"
                          : s.id === "C"
                          ? "bg-purple-500"
                          : "bg-slate-400"
                      }`}
                    />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period & Machine Selectors */}
          <div className="grid grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
            {/* Bulan Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 h-9 sm:h-10 min-w-0">
              <Calendar className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer truncate"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahun Selector */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 h-9 sm:h-10 min-w-0">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer"
              >
                {[currentDate.getFullYear() + 1, currentDate.getFullYear(), currentDate.getFullYear() - 1, currentDate.getFullYear() - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Mesin Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 h-9 sm:h-10 min-w-0">
              <Factory className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 shrink-0" />
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer truncate"
              >
                <option value="all">Semua Mesin</option>
                {machinesList.map((mc) => (
                  <option key={mc} value={mc}>
                    Mesin {mc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Jenis Kain Switcher (Panel vs Meteran vs Semua) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Layers className="w-4 h-4 text-slate-400" /> Jenis Kain:
            </span>
            <div className="grid grid-cols-3 lg:flex items-center gap-1.5 sm:gap-2 flex-1 lg:flex-none">
              <button
                onClick={() => setSelectedFabricType("all")}
                className={`h-8 sm:h-9 px-2 sm:px-3.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  selectedFabricType === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <Grid className="w-3.5 h-3.5 shrink-0" />
                <span>Semua Jenis</span>
              </button>
              <button
                onClick={() => setSelectedFabricType("panel")}
                className={`h-8 sm:h-9 px-2 sm:px-3.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  selectedFabricType === "panel"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200"
                }`}
              >
                <Layers className={`w-3.5 h-3.5 shrink-0 ${selectedFabricType === "panel" ? "text-white" : "text-indigo-500"}`} />
                <span>Khusus Panel</span>
              </button>
              <button
                onClick={() => setSelectedFabricType("meter")}
                className={`h-8 sm:h-9 px-2 sm:px-3.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  selectedFabricType === "meter"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
                }`}
              >
                <Ruler className={`w-3.5 h-3.5 shrink-0 ${selectedFabricType === "meter" ? "text-white" : "text-teal-500"}`} />
                <span>Khusus Meteran</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-end lg:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Mode:</span>
            <span className="text-slate-700 uppercase">
              {selectedFabricType === "all" ? "Gabungan Panel & Meter" : selectedFabricType === "panel" ? "Satuan Panel (Pcs)" : "Satuan Meter (m)"}
            </span>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center min-h-[400px] shadow-xs text-center">
          <Loader2 className="w-12 h-12 text-[#0070bc] animate-spin mb-4" />
          <h3 className="text-base font-extrabold text-slate-800">Menghitung Data Kinerja Shift...</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Mengagregasikan data produksi {selectedFabricType === "panel" ? "kain panel" : selectedFabricType === "meter" ? "kain meteran" : "panel & meteran"} periode {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
          </p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center text-rose-700 shadow-xs">
          <AlertTriangle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
          <h3 className="text-base font-bold">Gagal Memuat Kinerja Shift</h3>
          <p className="text-xs mt-1 text-rose-600">{errorMsg}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Hero Banner with Shift Status */}
          <div
            className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 bg-gradient-to-r ${currentShiftTheme.gradient} text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6`}
          >
            {/* Background Decorative Pattern */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
            <div className="absolute right-20 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-1.5 sm:space-y-2">
              <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight">
                {selectedShift === "all" ? "Rekap Kinerja Seluruh Tim" : `Hasil Kinerja Tim ${selectedShift}`}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 font-medium max-w-xl">
                Periode <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong> • {data.activeDays} hari operasi • {data.totalOperators} operator bertugas
                {selectedMachine !== "all" ? ` • Mesin ${selectedMachine}` : ""}
                {selectedFabricType !== "all" ? ` • ${selectedFabricType === "panel" ? "Kain Panel" : "Kain Meteran"}` : ""}
              </p>
            </div>
          </div>

          {/* KPI Summary Cards - Segregated by Panel & Meteran */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedFabricType === "all" ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-3 sm:gap-4`}>
            {/* Card 1: Produksi Kain Panel */}
            {(selectedFabricType === "all" || selectedFabricType === "panel") && (
              <div className="bg-white rounded-2xl border border-indigo-100 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-full pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" /> Produksi Panel
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      Panel Normal
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {data.totalPanel.toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-bold text-slate-400 uppercase">Panel</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 mt-1">
                    <span className="text-rose-600 font-extrabold">{data.totalDefectsPanel} Cacat</span>
                  </div>
                </div>
                <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Defect Rate Panel</span>
                  <span className={`font-black ${data.defectRatePanel <= 5 ? "text-emerald-600" : "text-rose-600"}`}>
                    {data.defectRatePanel}%
                  </span>
                </div>
              </div>
            )}

            {/* Card 2: Produksi Kain Meteran */}
            {(selectedFabricType === "all" || selectedFabricType === "meter") && (
              <div className="bg-white rounded-2xl border border-teal-100 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50/50 rounded-bl-full pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-teal-700 tracking-wider flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-teal-500" /> Produksi Meteran
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                      Meter Kain
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {data.totalMeter.toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-bold text-slate-400 uppercase">Meter</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 mt-1">
                    <span className="text-rose-600 font-extrabold">{data.totalDefectsMeter}m Cacat</span>
                  </div>
                </div>
                <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Defect Rate Meteran</span>
                  <span className={`font-black ${data.defectRateMeter <= 5 ? "text-emerald-600" : "text-rose-600"}`}>
                    {data.defectRateMeter}%
                  </span>
                </div>
              </div>
            )}

            {/* Card 3: Total Downtime */}
            <div
              className={`bg-white rounded-2xl border border-amber-100 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                selectedFabricType === "all" ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Total Downtime
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                    Stop Mesin
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight">
                  {data.totalDowntimeHours}{" "}
                  <span className="text-xs font-bold text-slate-400 uppercase">Jam</span>
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1">
                  {data.totalDowntimeMinutes} menit terhenti
                </div>
              </div>
              <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Rata-rata/hari</span>
                <span className="font-bold text-amber-700">{data.avgDailyDowntimeMinutes} mnt/hari</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Views */}
          <div className="grid grid-cols-2 lg:flex items-center gap-1.5 lg:gap-2 lg:border-b border-slate-200 pb-px">
            {[
              { id: "overview", label: "Tren & Grafik Harian", icon: BarChart3 },
              { id: "operators", label: `Kinerja Operator (${data.operators.length})`, icon: Trophy },
              { id: "problems", label: "Analisis Kendala & Downtime", icon: Wrench },
              { id: "machines", label: `Performa Mesin (${data.machines.length})`, icon: Factory },
            ].map((tab) => {
              const Icon = tab.icon;
              const isCurrent = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 rounded-xl lg:rounded-none lg:rounded-t-xl border lg:border-0 lg:border-b-2 ${
                    isCurrent
                      ? "border-[#0070bc] text-[#0070bc] bg-sky-50/70 lg:bg-sky-50/50 shadow-2xs lg:shadow-none"
                      : "border-slate-200/80 lg:border-transparent bg-white lg:bg-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? "text-[#0070bc]" : "text-slate-400"}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW & DAILY TREND CHART */}
          {activeTab === "overview" && (
            <div className="space-y-4 sm:space-y-6">
              {/* Daily Composed Chart Card (Opsi 1: Output & Cacat | Downtime) */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#0070bc] shrink-0" />
                      <span>Grafik Produksi Harian Shift (Tanggal 1 - {data.dailyTrends.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {chartFocus === "output_defect"
                        ? "Batang menunjukkan volume output harian (sumbu kiri), garis merah menunjukkan tren temuan cacat (sumbu kanan)."
                        : "Batang oranye menunjukkan total durasi downtime per hari dalam satuan menit."}
                    </p>
                  </div>

                  {/* Focus Switcher: Output & Cacat | Downtime */}
                  <div className="inline-flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 self-start lg:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setChartFocus("output_defect")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        chartFocus === "output_defect"
                          ? "bg-[#0070bc] text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                      <span>Output &amp; Cacat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartFocus("downtime")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        chartFocus === "downtime"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Downtime (Menit)</span>
                    </button>
                  </div>
                </div>

                {/* Honest & Accurate Legend Strip */}
                <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] font-bold text-slate-600">
                  <div className="flex items-center gap-4 flex-wrap">
                    {chartFocus === "output_defect" ? (
                      <>
                        {(selectedFabricType === "all" || selectedFabricType === "panel") && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-[#0070bc]" />
                            <span>Output Panel (Pcs)</span>
                          </div>
                        )}
                        {(selectedFabricType === "all" || selectedFabricType === "meter") && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-teal-500" />
                            <span>Output Meteran (m)</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-0.5 bg-rose-500 rounded-full relative inline-flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-rose-500 border border-white" />
                          </span>
                          <span className="text-rose-600">Temuan Cacat (Sumbu Kanan)</span>
                        </div>
                        {data.avgDailyOutput > 0 && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="w-4 border-t-2 border-dashed border-sky-400" />
                            <span>Rata-rata: {data.avgDailyOutput.toLocaleString("id-ID")}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-amber-500" />
                          <span>Downtime Harian (Menit)</span>
                        </div>
                        {data.avgDailyDowntimeMinutes > 0 && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="w-4 border-t-2 border-dashed border-amber-400" />
                            <span>Rata-rata: {data.avgDailyDowntimeMinutes} mnt/hari</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Live Day Inspector Strip on Hover / Click - Clean Light Theme */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#0070bc] flex items-center justify-center font-black text-base shrink-0 border border-sky-200/60 shadow-xs">
                      <Calendar className="w-5 h-5 text-[#0070bc]" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                        {hoveredTrend ? (
                          <>
                            <span>Tanggal {hoveredTrend.day} {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              hoveredTrend.output > 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              {hoveredTrend.output > 0 ? "Hari Beroperasi" : "Tidak Ada Produksi"}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-700">Arahkan kursor atau sentuh grafik untuk rincian harian</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {hoveredTrend
                          ? `${hoveredTrend.activeOperators} operator bertugas • Mesin: ${hoveredTrend.activeMachines.join(", ") || "-"}`
                          : `Total ${data.dailyTrends.filter((d) => d.output > 0).length} hari kerja aktif tercatat di periode ini`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                    {hoveredTrend ? (
                      <>
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5">
                          <span className="text-slate-400 text-[10px] uppercase font-extrabold">Output:</span>
                          <span className="text-slate-900 font-black">
                            {hoveredTrend.panelCount > 0 && `${hoveredTrend.panelCount.toLocaleString("id-ID")} Panel`}
                            {hoveredTrend.panelCount > 0 && hoveredTrend.meterCount > 0 && " • "}
                            {hoveredTrend.meterCount > 0 && `${hoveredTrend.meterCount.toLocaleString("id-ID")}m`}
                            {!hoveredTrend.panelCount && !hoveredTrend.meterCount && "-"}
                          </span>
                        </div>
                        <div className="bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 shadow-2xs flex items-center gap-1.5">
                          <span className="text-rose-500 text-[10px] uppercase font-extrabold">Cacat:</span>
                          <span className="text-rose-700 font-black">{hoveredTrend.defects} temuan</span>
                        </div>
                        <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-1.5">
                          <span className="text-amber-600 text-[10px] uppercase font-extrabold">Downtime:</span>
                          <span className="text-amber-800 font-black">{hoveredTrend.downtimeMinutes} mnt</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-[11px] font-medium hidden lg:flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hover / tap tanggal pada grafik untuk melihat detail</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pure SVG Composed Chart (Zero external chart dependency, crisp dual Y-axis) */}
                {(() => {
                  const trends = data.dailyTrends;
                  const count = Math.max(trends.length, 1);
                  const chartW = Math.max(720, count * 28);
                  const chartH = 260;
                  const padL = 46;
                  const padR = chartFocus === "output_defect" ? 42 : 18;
                  const padT = 18;
                  const padB = 28;
                  const plotW = chartW - padL - padR;
                  const plotH = chartH - padT - padB;
                  const stepX = plotW / count;

                  const niceMax = (raw: number) => {
                    if (raw <= 0) return 10;
                    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
                    const norm = raw / mag;
                    const nice = norm <= 1.2 ? 1.2 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
                    return Math.ceil(nice * mag);
                  };

                  const rawMaxOutput = Math.max(
                    ...trends.map((d) =>
                      selectedFabricType === "panel"
                        ? d.panelCount
                        : selectedFabricType === "meter"
                        ? d.meterCount
                        : Math.max(d.panelCount, d.meterCount)
                    ),
                    0
                  );
                  const rawMaxDefect = Math.max(...trends.map((d) => d.defects), 0);
                  const rawMaxDowntime = Math.max(...trends.map((d) => d.downtimeMinutes), 0);

                  const leftMax = niceMax(chartFocus === "output_defect" ? rawMaxOutput : rawMaxDowntime);
                  const rightMax = niceMax(rawMaxDefect);
                  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

                  const yLeft = (val: number) => padT + plotH - (leftMax > 0 ? (val / leftMax) * plotH : 0);
                  const yRight = (val: number) => padT + plotH - (rightMax > 0 ? (val / rightMax) * plotH : 0);

                  const defectPoints = trends
                    .map((d, idx) => `${(padL + idx * stepX + stepX / 2).toFixed(1)},${yRight(d.defects).toFixed(1)}`)
                    .join(" ");

                  const avgVal = chartFocus === "output_defect" ? data.avgDailyOutput : data.avgDailyDowntimeMinutes;
                  const avgY = avgVal > 0 && avgVal <= leftMax ? yLeft(avgVal) : null;

                  return (
                    <div className="w-full overflow-x-auto no-scrollbar pt-1">
                      <div style={{ minWidth: `${chartW}px` }}>
                        <svg
                          viewBox={`0 0 ${chartW} ${chartH}`}
                          className="w-full h-[260px] sm:h-[290px] select-none overflow-visible"
                          onMouseLeave={() => setHoveredTrend(null)}
                        >
                          {/* Horizontal Gridlines & Y-Axis Labels */}
                          {gridTicks.map((ratio) => {
                            const y = padT + plotH - ratio * plotH;
                            const leftTick = Math.round(leftMax * ratio);
                            const rightTick = Math.round(rightMax * ratio);
                            return (
                              <g key={ratio}>
                                <line
                                  x1={padL}
                                  y1={y}
                                  x2={chartW - padR}
                                  y2={y}
                                  stroke={ratio === 0 ? "#cbd5e1" : "#e2e8f0"}
                                  strokeDasharray={ratio === 0 ? undefined : "3 3"}
                                  strokeWidth={1}
                                />
                                <text
                                  x={padL - 8}
                                  y={y + 3.5}
                                  textAnchor="end"
                                  className="fill-slate-500 text-[10px] font-semibold"
                                >
                                  {chartFocus === "downtime" ? `${leftTick}m` : leftTick}
                                </text>
                                {chartFocus === "output_defect" && (
                                  <text
                                    x={chartW - padR + 8}
                                    y={y + 3.5}
                                    textAnchor="start"
                                    className="fill-rose-500 text-[10px] font-bold"
                                  >
                                    {rightTick}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          {/* Dashed Average Reference Line */}
                          {avgY !== null && (
                            <g>
                              <line
                                x1={padL}
                                y1={avgY}
                                x2={chartW - padR}
                                y2={avgY}
                                stroke={chartFocus === "output_defect" ? "#38bdf8" : "#f59e0b"}
                                strokeDasharray="5 4"
                                strokeWidth={1.5}
                              />
                              <text
                                x={chartW - padR - 4}
                                y={avgY - 5}
                                textAnchor="end"
                                className={
                                  chartFocus === "output_defect"
                                    ? "fill-sky-600 text-[9.5px] font-bold"
                                    : "fill-amber-600 text-[9.5px] font-bold"
                                }
                              >
                                Rata-rata: {chartFocus === "downtime" ? `${avgVal} mnt` : avgVal.toLocaleString("id-ID")}
                              </text>
                            </g>
                          )}

                          {/* Bars & Interactive Hit Columns */}
                          {trends.map((d, idx) => {
                            const colX = padL + idx * stepX;
                            const centerX = colX + stepX / 2;
                            const isHovered = hoveredTrend?.day === d.day;

                            return (
                              <g
                                key={d.day}
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredTrend(d)}
                                onClick={() => setHoveredTrend(d)}
                              >
                                {/* Hover Highlight Column */}
                                <rect
                                  x={colX + 1}
                                  y={padT}
                                  width={Math.max(stepX - 2, 4)}
                                  height={plotH}
                                  rx={6}
                                  fill={
                                    isHovered
                                      ? chartFocus === "output_defect"
                                        ? "rgba(0, 112, 188, 0.08)"
                                        : "rgba(245, 158, 11, 0.10)"
                                      : "transparent"
                                  }
                                />

                                {chartFocus === "output_defect" ? (
                                  selectedFabricType === "all" ? (
                                    <>
                                      {/* Panel Bar (Blue) */}
                                      {d.panelCount > 0 && (
                                        <rect
                                          x={centerX - 9}
                                          y={yLeft(d.panelCount)}
                                          width={8}
                                          height={Math.max(padT + plotH - yLeft(d.panelCount), 2)}
                                          rx={3}
                                          fill="#0070bc"
                                          opacity={isHovered ? 1 : 0.88}
                                        />
                                      )}
                                      {/* Meter Bar (Teal) */}
                                      {d.meterCount > 0 && (
                                        <rect
                                          x={centerX + 1}
                                          y={yLeft(d.meterCount)}
                                          width={8}
                                          height={Math.max(padT + plotH - yLeft(d.meterCount), 2)}
                                          rx={3}
                                          fill="#14b8a6"
                                          opacity={isHovered ? 1 : 0.88}
                                        />
                                      )}
                                    </>
                                  ) : (
                                    (() => {
                                      const val = selectedFabricType === "panel" ? d.panelCount : d.meterCount;
                                      if (val <= 0) return null;
                                      const barW = Math.min(16, Math.max(stepX * 0.55, 8));
                                      return (
                                        <rect
                                          x={centerX - barW / 2}
                                          y={yLeft(val)}
                                          width={barW}
                                          height={Math.max(padT + plotH - yLeft(val), 2)}
                                          rx={4}
                                          fill={selectedFabricType === "panel" ? "#0070bc" : "#14b8a6"}
                                          opacity={isHovered ? 1 : 0.9}
                                        />
                                      );
                                    })()
                                  )
                                ) : (
                                  d.downtimeMinutes > 0 && (
                                    <rect
                                      x={centerX - Math.min(16, Math.max(stepX * 0.55, 8)) / 2}
                                      y={yLeft(d.downtimeMinutes)}
                                      width={Math.min(16, Math.max(stepX * 0.55, 8))}
                                      height={Math.max(padT + plotH - yLeft(d.downtimeMinutes), 2)}
                                      rx={4}
                                      fill="#f59e0b"
                                      opacity={isHovered ? 1 : 0.9}
                                    />
                                  )
                                )}

                                {/* X-Axis Day Label */}
                                <text
                                  x={centerX}
                                  y={chartH - 8}
                                  textAnchor="middle"
                                  className={`text-[10px] font-bold ${
                                    isHovered ? "fill-[#0070bc]" : "fill-slate-500"
                                  }`}
                                >
                                  {d.day}
                                </text>
                              </g>
                            );
                          })}

                          {/* Defect Trend Line + Dots Overlay (Output & Cacat mode) */}
                          {chartFocus === "output_defect" && rawMaxDefect > 0 && (
                            <g className="pointer-events-none">
                              <polyline
                                fill="none"
                                stroke="#e11d48"
                                strokeWidth={2.25}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                points={defectPoints}
                              />
                              {trends.map((d, idx) => {
                                if (d.defects <= 0 && hoveredTrend?.day !== d.day) return null;
                                const cx = padL + idx * stepX + stepX / 2;
                                const cy = yRight(d.defects);
                                const isHovered = hoveredTrend?.day === d.day;
                                return (
                                  <circle
                                    key={`dot-${d.day}`}
                                    cx={cx}
                                    cy={cy}
                                    r={isHovered ? 4.5 : 3}
                                    fill="#e11d48"
                                    stroke="#ffffff"
                                    strokeWidth={1.5}
                                  />
                                );
                              })}
                            </g>
                          )}
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Daily Table Details */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 bg-slate-50/50">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                    Rincian Tabel Harian Shift ({selectedFabricType === "all" ? "Panel & Meteran" : selectedFabricType === "panel" ? "Khusus Panel" : "Khusus Meteran"})
                  </h4>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                    Total {data.dailyTrends.filter((d) => d.output > 0).length} hari kerja tercatat
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider z-10 whitespace-nowrap">
                      <tr>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4 text-right">Panel (Pcs)</th>
                        <th className="py-3 px-4 text-right">Meteran (m)</th>
                        <th className="py-3 px-4 text-right">Cacat Panel</th>
                        <th className="py-3 px-4 text-right">Cacat Meter</th>
                        <th className="py-3 px-4 text-right">Downtime</th>
                        <th className="py-3 px-4 text-center">Operator Aktif</th>
                        <th className="py-3 px-4">Mesin Berjalan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.dailyTrends
                        .filter((d) => d.output > 0 || d.defects > 0 || d.downtimeMinutes > 0)
                        .map((trend) => (
                          <tr key={trend.day} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              {trend.date} (Tgl {trend.day})
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-indigo-600">
                              {trend.panelCount > 0 ? `${trend.panelCount}` : "-"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-teal-600">
                              {trend.meterCount > 0 ? `${trend.meterCount}m` : "-"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                              {trend.defectsPanel > 0 ? `${trend.defectsPanel}` : "-"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                              {trend.defectsMeter > 0 ? `${trend.defectsMeter}m` : "-"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                              {trend.downtimeMinutes > 0 ? `${trend.downtimeMinutes} mnt` : "-"}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-slate-700">
                              {trend.activeOperators} org
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium text-[11px]">
                              {trend.activeMachines.join(", ") || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATOR LEADERBOARD & BREAKDOWN */}
          {activeTab === "operators" && (
            <div className="space-y-4 sm:space-y-6">
              {/* Podium for Top 3 Performers */}
              {data.operators.length >= 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                  {/* 2nd Place */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col items-center text-center order-2 md:order-1 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 font-black text-xl flex items-center justify-center mb-3 shadow-xs">
                      <Medal className="w-6 h-6 text-slate-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Juara 2 Shift</span>
                    <h4 className="text-base font-black text-slate-900 mt-1">{data.operators[1].operatorName}</h4>
                    <div className="text-xl font-black text-[#0070bc] mt-2">
                      {data.operators[1].panelCount > 0 && `${data.operators[1].panelCount} Panel `}
                      {data.operators[1].meterCount > 0 && `${data.operators[1].meterCount}m`}
                    </div>
                    <div className="text-xs font-bold text-rose-600 mt-0.5">
                      {data.operators[1].totalDefects} Cacat ({data.operators[1].defectRate}%)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">Mesin: {data.operators[1].machinesOperated.join(", ") || "-"}</div>
                  </div>

                  {/* 1st Place Champion */}
                  <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-2xl sm:rounded-3xl border-2 border-amber-400 p-5 sm:p-6 shadow-md flex flex-col items-center text-center order-1 md:order-2 relative overflow-hidden">
                    <div className="absolute top-3 right-3">
                      <CrownBadge />
                    </div>
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-amber-400 text-white font-black text-3xl flex items-center justify-center mb-3 shadow-lg shadow-amber-500/30 animate-bounce">
                      <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider">Top Performer Shift</span>
                    <h4 className="text-lg font-black text-slate-900 mt-1">{data.operators[0].operatorName}</h4>
                    <div className="text-2xl font-black text-amber-600 mt-2">
                      {data.operators[0].panelCount > 0 && `${data.operators[0].panelCount} Panel `}
                      {data.operators[0].meterCount > 0 && `${data.operators[0].meterCount}m`}
                    </div>
                    <div className="text-xs font-bold text-rose-600 mt-0.5">
                      {data.operators[0].totalDefects} Cacat ({data.operators[0].defectRate}%)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2 font-medium">Mesin: {data.operators[0].machinesOperated.join(", ") || "-"}</div>
                  </div>

                  {/* 3rd Place */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col items-center text-center order-3 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center mb-3 shadow-xs">
                      <Medal className="w-6 h-6 text-amber-700" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Juara 3 Shift</span>
                    <h4 className="text-base font-black text-slate-900 mt-1">{data.operators[2].operatorName}</h4>
                    <div className="text-xl font-black text-[#0070bc] mt-2">
                      {data.operators[2].panelCount > 0 && `${data.operators[2].panelCount} Panel `}
                      {data.operators[2].meterCount > 0 && `${data.operators[2].meterCount}m`}
                    </div>
                    <div className="text-xs font-bold text-rose-600 mt-0.5">
                      {data.operators[2].totalDefects} Cacat ({data.operators[2].defectRate}%)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">Mesin: {data.operators[2].machinesOperated.join(", ") || "-"}</div>
                  </div>
                </div>
              )}

              {/* Operators Table Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs space-y-4 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      Daftar Anggota & Kinerja Operator
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Rincian terpisah antara output Panel dan Meteran beserta rasio cacat dan mutunya.
                    </p>
                  </div>
                  {/* Search bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama operator..."
                      value={operatorSearchQuery}
                      onChange={(e) => setOperatorSearchQuery(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-[#0070bc]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="py-3 px-4 text-center">Rank</th>
                        <th className="py-3 px-4">Nama Operator</th>
                        <th className="py-3 px-4">Mesin</th>
                        <th className="py-3 px-4 text-right">Panel (Pcs)</th>
                        <th className="py-3 px-4 text-right">Meteran (m)</th>
                        <th className="py-3 px-4 text-right">Cacat (Panel/m)</th>
                        <th className="py-3 px-4 text-center">Grade (A / B / BS)</th>
                        <th className="py-3 px-4 text-right">Quality Score</th>
                        <th className="py-3 px-4 text-right">Kontribusi</th>
                        <th className="py-3 px-4 text-center">Status Kinerja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOperators.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                            Tidak ada data operator yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredOperators.map((op, idx) => (
                          <tr key={op.operatorName} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                                idx === 0 ? "bg-amber-100 text-amber-800 border border-amber-300" :
                                idx === 1 ? "bg-slate-100 text-slate-700 border border-slate-300" :
                                idx === 2 ? "bg-orange-100 text-orange-800 border border-orange-300" :
                                "text-slate-400 font-bold"
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-slate-900">{op.operatorName}</div>
                              <span className="text-[10px] text-slate-400 font-medium">Shift {op.shiftGroup}</span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">
                              {op.machinesOperated.join(", ") || "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-indigo-700 text-sm">
                              {op.panelCount > 0 ? op.panelCount.toLocaleString("id-ID") : "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-teal-700 text-sm">
                              {op.meterCount > 0 ? `${op.meterCount.toLocaleString("id-ID")}m` : "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">
                              {op.totalDefects} ({op.defectRate}%)
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 font-bold text-[11px]">
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{op.gradeA} A</span>
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{op.gradeB} B</span>
                                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">{op.gradeBS} BS</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-800">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                  op.qualityScore >= 90
                                    ? "bg-emerald-100 text-emerald-800"
                                    : op.qualityScore >= 75
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {op.qualityScore}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-600">
                              {op.contributionPercent}%
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  op.performanceRating === "Top Performer"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : op.performanceRating === "Needs Attention"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-blue-100 text-blue-800 border border-blue-200"
                                }`}
                              >
                                {op.performanceRating === "Top Performer" && <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />}
                                {op.performanceRating}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROBLEM CATEGORIES & DOWNTIME ROOT CAUSE */}
          {activeTab === "problems" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-600" />
                    Klasifikasi Kendala & Pareto Masalah Shift
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Gunakan rincian ini untuk materi *daily shift briefing* atau koordinasi perbaikan dengan tim mekanik & elektrik.
                  </p>
                </div>

                {/* Category Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {data.problemCategories.map((cat) => (
                    <div
                      key={cat.category}
                      className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="px-2 py-0.5 rounded-md font-black text-xs text-white shadow-2xs"
                            style={{ backgroundColor: cat.color }}
                          >
                            Kode {cat.category}
                          </span>
                          <span className="text-xs font-black text-slate-700">{cat.percentage}% dari total</span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{cat.name}</h4>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-1">
                          <span className="text-rose-600">{cat.count} kejadian</span>
                          <span>•</span>
                          <span className="text-amber-700">{cat.downtimeMinutes} menit stop</span>
                        </div>

                        {/* Top specific issues */}
                        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            Temuan Terbanyak:
                          </span>
                          {cat.topIssues.length === 0 ? (
                            <span className="text-xs text-slate-400 italic font-medium">Tidak ada kejadian</span>
                          ) : (
                            cat.topIssues.map((ti, i) => (
                              <div key={i} className="flex items-center justify-between text-xs font-medium text-slate-700">
                                <span className="truncate pr-2">• {ti.issue}</span>
                                <span className="font-bold text-slate-900 shrink-0 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                                  {ti.count}x
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 pt-2">
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: cat.color,
                              width: `${Math.min(100, cat.percentage)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MACHINE PERFORMANCE IN THIS SHIFT */}
          {activeTab === "machines" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs p-4 sm:p-5 space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Factory className="w-5 h-5 text-indigo-600" />
                    Produktivitas & Kinerja Tiap Mesin pada Shift Ini
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Evaluasi performa mesin dengan pembedaan jelas antara tipe mesin Panel dan tipe mesin Meteran.
                  </p>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="py-3 px-4">Nomor Mesin</th>
                        <th className="py-3 px-4">Tipe Mesin</th>
                        <th className="py-3 px-4 text-right">Panel (Pcs)</th>
                        <th className="py-3 px-4 text-right">Meteran (m)</th>
                        <th className="py-3 px-4 text-right">Total Cacat</th>
                        <th className="py-3 px-4 text-right">Defect Rate</th>
                        <th className="py-3 px-4">Operator Bertugas</th>
                        <th className="py-3 px-4">Desain yang Jalan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.machines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                            Belum ada catatan mesin pada filter ini.
                          </td>
                        </tr>
                      ) : (
                        data.machines.map((mc) => (
                          <tr key={mc.machineId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-black text-xs">
                                Mesin {mc.machineId}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  mc.machineType === "METERAN"
                                    ? "bg-teal-50 text-teal-800 border border-teal-200"
                                    : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                }`}
                              >
                                {mc.machineType === "METERAN" ? "METERAN" : "PANEL"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-indigo-700 text-sm">
                              {mc.panelCount > 0 ? mc.panelCount.toLocaleString("id-ID") : "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-teal-700 text-sm">
                              {mc.meterCount > 0 ? `${mc.meterCount.toLocaleString("id-ID")}m` : "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">
                              {mc.totalDefects}
                            </td>
                            <td className="py-3 px-4 text-right font-black">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  mc.defectRate <= 5
                                    ? "bg-emerald-100 text-emerald-800"
                                    : mc.defectRate <= 15
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {mc.defectRate}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-medium">
                              {mc.operators.join(", ") || "-"}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-medium text-[11px]">
                              {mc.designs.join(", ") || "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CrownBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] uppercase tracking-wider shadow-sm">
      <Zap className="w-3 h-3 fill-amber-950" />
      CHAMPION
    </span>
  );
}
