"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Factory,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  AlertTriangle,
  Layers,
  Ruler,
  ChevronRight,
  Sparkles,
  Info,
  SlidersHorizontal,
  BarChart2,
  Table,
} from "lucide-react";
import * as xlsx from "xlsx";
import {
  getDualPeriodMachineReport,
  DualPeriodCrossMachineReport,
  CrossMachineReportSummary,
  MachineTeamMetric,
} from "@/actions/cross-machine-actions";
import MonthlyPerformanceCharts from "./components/MonthlyPerformanceCharts";

function filterSummaryByFabricType(
  summary: CrossMachineReportSummary,
  fabricType: "all" | "panel" | "meter"
): CrossMachineReportSummary {
  if (fabricType === "all") return summary;
  const filteredMachines = summary.machines.filter((m) =>
    fabricType === "meter" ? m.isMeterMachine : !m.isMeterMachine
  );
  const totalA = filteredMachines.reduce((acc, m) => acc + m.hasilProduksi.A, 0);
  const totalB = filteredMachines.reduce((acc, m) => acc + m.hasilProduksi.B, 0);
  const totalC = filteredMachines.reduce((acc, m) => acc + m.hasilProduksi.C, 0);
  const totalAll = totalA + totalB + totalC;
  const panelTotal = filteredMachines
    .filter((m) => !m.isMeterMachine)
    .reduce((acc, m) => acc + m.hasilProduksi.total, 0);
  const meterTotal = filteredMachines
    .filter((m) => m.isMeterMachine)
    .reduce((acc, m) => acc + m.hasilProduksi.total, 0);
  const count = filteredMachines.filter((m) => m.hasData).length || filteredMachines.length || 1;
  const avgEffA = filteredMachines.reduce((acc, m) => acc + m.effTeam.A, 0) / count;
  const avgEffB = filteredMachines.reduce((acc, m) => acc + m.effTeam.B, 0) / count;
  const avgEffC = filteredMachines.reduce((acc, m) => acc + m.effTeam.C, 0) / count;
  const avgEffTotal = (avgEffA + avgEffB + avgEffC) / 3;
  const avgCacatA = filteredMachines.reduce((acc, m) => acc + m.cacatPerTeam.A, 0) / count;
  const avgCacatB = filteredMachines.reduce((acc, m) => acc + m.cacatPerTeam.B, 0) / count;
  const avgCacatC = filteredMachines.reduce((acc, m) => acc + m.cacatPerTeam.C, 0) / count;
  const avgCacatTotal = (avgCacatA + avgCacatB + avgCacatC) / 3;

  return {
    ...summary,
    machines: filteredMachines,
    totalRow: {
      hasilProduksi: {
        A: totalA,
        B: totalB,
        C: totalC,
        total: totalAll,
        panelTotal,
        meterTotal,
      },
      effTeam: {
        A: avgEffA,
        B: avgEffB,
        C: avgEffC,
        avg: avgEffTotal,
      },
      cacatPerTeam: {
        A: avgCacatA,
        B: avgCacatB,
        C: avgCacatC,
        avg: avgCacatTotal,
      },
    },
  };
}

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

export default function MachineMatrixPerformancePage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [reportData, setReportData] = useState<DualPeriodCrossMachineReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"dual" | "current" | "previous">("dual");
  const [displayMode, setDisplayMode] = useState<"BOTH" | "CHARTS" | "TABLES">("BOTH");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedFabricType, setSelectedFabricType] = useState<"all" | "panel" | "meter">("all");

  const currentPeriod = useMemo(() => {
    if (!reportData) return null;
    return filterSummaryByFabricType(reportData.currentPeriod, selectedFabricType);
  }, [reportData, selectedFabricType]);

  const previousPeriod = useMemo(() => {
    if (!reportData) return null;
    return filterSummaryByFabricType(reportData.previousPeriod, selectedFabricType);
  }, [reportData, selectedFabricType]);

  const currentWeeklySummaries = useMemo(() => {
    if (!reportData?.currentWeeklySummaries) return [];
    return reportData.currentWeeklySummaries.map((w) => {
      const filtered = filterSummaryByFabricType(w, selectedFabricType);
      return {
        ...filtered,
        weekNumber: w.weekNumber,
        weekLabel: w.weekLabel,
        startDate: w.startDate,
        endDate: w.endDate,
      };
    });
  }, [reportData, selectedFabricType]);

  const prodGrowthPercent = useMemo(() => {
    if (!currentPeriod || !previousPeriod) return 0;
    const cur = currentPeriod.totalRow.hasilProduksi.total;
    const prev = previousPeriod.totalRow.hasilProduksi.total;
    return prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  }, [currentPeriod, previousPeriod]);

  const effDeltaPercent = useMemo(() => {
    if (!currentPeriod || !previousPeriod) return 0;
    return currentPeriod.totalRow.effTeam.avg - previousPeriod.totalRow.effTeam.avg;
  }, [currentPeriod, previousPeriod]);

  const defectDeltaPercent = useMemo(() => {
    if (!currentPeriod || !previousPeriod) return 0;
    return currentPeriod.totalRow.cacatPerTeam.avg - previousPeriod.totalRow.cacatPerTeam.avg;
  }, [currentPeriod, previousPeriod]);

  const fetchData = async (forceRefresh: boolean = false) => {
    const cacheKey = `dji_machine_matrix_cache_v2_${selectedMonth}_${selectedYear}`;

    // 1. If not forcing refresh, check cache first
    if (!forceRefresh && typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setReportData(parsed);
          setIsLoading(false);

          // Silent background re-fetch to keep data up to date
          setIsRefreshing(true);
          getDualPeriodMachineReport(selectedMonth, selectedYear)
            .then((freshData) => {
              if (freshData) {
                setReportData(freshData);
                sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
              }
            })
            .catch((e) => console.error("Silent background refresh error:", e))
            .finally(() => setIsRefreshing(false));
          return;
        }
      } catch (e) {
        console.warn("Failed reading machine matrix cache:", e);
      }
    }

    // 2. If no cache or forceRefresh is true, show loading and fetch
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await getDualPeriodMachineReport(selectedMonth, selectedYear);
      setReportData(data);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) { }
      }
    } catch (err) {
      console.error("Gagal memuat data laporan matriks mesin:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    setSelectedWeekIndex(0);
  }, [selectedMonth, selectedYear]);

  // Export to Excel
  const exportToExcel = () => {
    if (!reportData || !currentPeriod || !previousPeriod) return;

    const wb = xlsx.utils.book_new();

    const generateSheetData = (period: CrossMachineReportSummary, title: string) => {
      const wsData: any[][] = [];
      wsData.push([`LAPORAN PERFORMA MESIN PER TIM - ${title.toUpperCase()}`]);
      wsData.push([`Periode: ${period.monthName} ${period.year}`]);
      wsData.push([`Filter Kategori: ${selectedFabricType === "all" ? "Semua Mesin" : selectedFabricType === "panel" ? "Khusus Mesin Panel" : "Khusus Mesin Meteran"}`]);
      wsData.push([]);
      wsData.push([
        "Mesin",
        "Tipe",
        "Hasil Produksi", "", "",
        "Efisiensi Team", "", "",
        "Cacat/Team", "", ""
      ]);
      wsData.push([
        "",
        "",
        "A", "B", "C",
        "A", "B", "C",
        "A", "B", "C"
      ]);

      period.machines.forEach((m) => {
        wsData.push([
          m.machineId,
          m.isMeterMachine ? "METER" : "PANEL",
          m.hasilProduksi.A,
          m.hasilProduksi.B,
          m.hasilProduksi.C,
          m.effTeam.A.toFixed(2) + "%",
          m.effTeam.B.toFixed(2) + "%",
          m.effTeam.C.toFixed(2) + "%",
          m.cacatPerTeam.A.toFixed(2) + "%",
          m.cacatPerTeam.B.toFixed(2) + "%",
          m.cacatPerTeam.C.toFixed(2) + "%",
        ]);
      });

      // Total row
      wsData.push([
        "TOTAL / AVERAGE",
        "",
        period.totalRow.hasilProduksi.A,
        period.totalRow.hasilProduksi.B,
        period.totalRow.hasilProduksi.C,
        period.totalRow.effTeam.A.toFixed(2) + "%",
        period.totalRow.effTeam.B.toFixed(2) + "%",
        period.totalRow.effTeam.C.toFixed(2) + "%",
        period.totalRow.cacatPerTeam.A.toFixed(2) + "%",
        period.totalRow.cacatPerTeam.B.toFixed(2) + "%",
        period.totalRow.cacatPerTeam.C.toFixed(2) + "%",
      ]);

      wsData.push([]);
      wsData.push([
        "RINCIAN SATUAN:",
        `Total Panel: ${period.totalRow.hasilProduksi.panelTotal.toLocaleString("id-ID")} pcs`,
        `Total Meteran: ${period.totalRow.hasilProduksi.meterTotal.toLocaleString("id-ID")} m`,
      ]);

      return wsData;
    };

    // Sheet 1: Current Period
    const ws1Data = generateSheetData(currentPeriod, `Periode ${currentPeriod.monthName} ${currentPeriod.year}`);
    const ws1 = xlsx.utils.aoa_to_sheet(ws1Data);
    xlsx.utils.book_append_sheet(wb, ws1, `${currentPeriod.monthName} ${currentPeriod.year}`);

    // Sheet 2: Previous Period
    const ws2Data = generateSheetData(previousPeriod, `Periode ${previousPeriod.monthName} ${previousPeriod.year}`);
    const ws2 = xlsx.utils.aoa_to_sheet(ws2Data);
    xlsx.utils.book_append_sheet(wb, ws2, `${previousPeriod.monthName} ${previousPeriod.year}`);

    // Weekly Sheets
    if (currentWeeklySummaries && currentWeeklySummaries.length > 0) {
      currentWeeklySummaries.forEach((w) => {
        const wsData = generateSheetData(w, `Rekap ${w.weekLabel} ${w.monthName} ${w.year}`);
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, `Minggu ${w.weekNumber} (${w.startDate}-${w.endDate})`);
      });
    }

    xlsx.writeFile(wb, `Laporan_Rekap_Mesin_${currentPeriod.monthName}_${currentPeriod.year}.xlsx`);
  };

  const renderTable = (
    period: CrossMachineReportSummary,
    isCurrent: boolean,
    customTitle?: string,
    customBadge?: string,
    variant: "sky" | "slate" | "indigo" = isCurrent ? "sky" : "slate"
  ) => {
    const bannerBg =
      variant === "indigo"
        ? "bg-indigo-50/90 border-indigo-200"
        : isCurrent
        ? "bg-sky-50/80 border-sky-200"
        : "bg-slate-100/90 border-slate-200";

    const dotBg =
      variant === "indigo"
        ? "bg-indigo-600"
        : isCurrent
        ? "bg-sky-600"
        : "bg-slate-500";

    const badgeStyle =
      variant === "indigo"
        ? "bg-indigo-100 text-indigo-800 border-indigo-300"
        : isCurrent
        ? "bg-sky-100 text-sky-800 border-sky-300"
        : "bg-slate-200 text-slate-700 border-slate-300";

    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Table Header Banner */}
        <div className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${bannerBg}`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full ${dotBg}`}></span>
            <h3 className="text-sm font-bold text-slate-800">
              {customTitle || `Periode ${period.monthName} ${period.year}`}
            </h3>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badgeStyle}`}>
              {customBadge || (isCurrent ? "Bulan Terpilih" : "Bulan Sebelumnya")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 flex-wrap">
            <span>
              Total Produksi:{" "}
              <span className="font-bold text-slate-900 font-mono">
                {period.totalRow.hasilProduksi.total.toLocaleString("id-ID")}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 text-[11px] font-bold font-mono">
              Panel: {period.totalRow.hasilProduksi.panelTotal.toLocaleString("id-ID")} pcs
            </span>
            <span className="px-2 py-0.5 rounded bg-teal-100/80 text-teal-800 text-[11px] font-bold font-mono">
              Meteran: {period.totalRow.hasilProduksi.meterTotal.toLocaleString("id-ID")} m
            </span>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              {/* Row 1 Header */}
              <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 text-center uppercase">
                <th rowSpan={2} className="border border-slate-300 p-2.5 w-20 bg-slate-100 text-slate-800 font-bold sticky left-0 z-10">
                  Mesin
                </th>
                <th colSpan={3} className="border border-slate-300 p-2 bg-slate-100 text-slate-800 font-bold">
                  <div>Hasil Produksi</div>
                  <div className="text-[9px] font-medium text-slate-500 normal-case tracking-normal">
                    (Panel: pcs • Meteran: m)
                  </div>
                </th>
                <th colSpan={3} className="border border-slate-300 p-2 bg-emerald-50 text-emerald-900 font-bold">
                  Efisiensi Team
                </th>
                <th colSpan={3} className="border border-slate-300 p-2 bg-rose-50 text-rose-900 font-bold">
                  Cacat/Team
                </th>
              </tr>
              {/* Row 2 Sub-Header (A, B, C) */}
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-700 text-center">
                <th className="border border-slate-300 p-1.5 w-16 bg-slate-50">A</th>
                <th className="border border-slate-300 p-1.5 w-16 bg-slate-50">B</th>
                <th className="border border-slate-300 p-1.5 w-16 bg-slate-50">C</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-emerald-50/70 text-emerald-900">A</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-emerald-50/70 text-emerald-900">B</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-emerald-50/70 text-emerald-900">C</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-rose-50/70 text-rose-900">A</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-rose-50/70 text-rose-900">B</th>
                <th className="border border-slate-300 p-1.5 w-18 bg-rose-50/70 text-rose-900">C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {period.machines.map((m) => {
                const isNoData = !m.hasData;
                return (
                  <tr key={m.machineId} className="hover:bg-slate-50 text-center transition-colors">
                    {/* Machine ID + Type Badge */}
                    <td className="border border-slate-300 p-2 font-bold text-slate-900 bg-slate-50 sticky left-0 z-10 whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="text-xs font-black">{m.machineId}</span>
                        {m.isMeterMachine ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-teal-100 text-teal-800 border border-teal-200 leading-none">
                            METER
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-indigo-100 text-indigo-800 border border-indigo-200 leading-none">
                            PANEL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Hasil Produksi A, B, C */}
                    <td className="border border-slate-300 p-2 font-mono text-slate-900 bg-white">
                      {isNoData && m.hasilProduksi.A === 0 ? "—" : m.hasilProduksi.A.toLocaleString("id-ID")}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono text-slate-900 bg-white">
                      {isNoData && m.hasilProduksi.B === 0 ? "—" : m.hasilProduksi.B.toLocaleString("id-ID")}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono text-slate-900 bg-white">
                      {isNoData && m.hasilProduksi.C === 0 ? "—" : m.hasilProduksi.C.toLocaleString("id-ID")}
                    </td>

                    {/* Efisiensi Team A, B, C */}
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-emerald-900 bg-emerald-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.effTeam.A.toFixed(2)}%`}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-emerald-900 bg-emerald-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.effTeam.B.toFixed(2)}%`}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-emerald-900 bg-emerald-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.effTeam.C.toFixed(2)}%`}
                    </td>

                    {/* Cacat/Team A, B, C */}
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-rose-800 bg-rose-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.cacatPerTeam.A.toFixed(2)}%`}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-rose-800 bg-rose-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.cacatPerTeam.B.toFixed(2)}%`}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-rose-800 bg-rose-50/60 whitespace-nowrap">
                      {isNoData ? "—" : `${m.cacatPerTeam.C.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}

              {/* TOTAL / AVERAGE Footer Row */}
              <tr className="bg-slate-800 text-white font-bold text-center">
                <td className="border border-slate-700 p-2.5 font-bold text-[11px] uppercase tracking-wider sticky left-0 bg-slate-900 z-10">
                  TOTAL / AVERAGE
                </td>

                {/* Total Hasil Produksi */}
                <td className="border border-slate-700 p-2 font-mono text-amber-300 font-bold">
                  {period.totalRow.hasilProduksi.A.toLocaleString("id-ID")}
                </td>
                <td className="border border-slate-700 p-2 font-mono text-amber-300 font-bold">
                  {period.totalRow.hasilProduksi.B.toLocaleString("id-ID")}
                </td>
                <td className="border border-slate-700 p-2 font-mono text-amber-300 font-bold">
                  {period.totalRow.hasilProduksi.C.toLocaleString("id-ID")}
                </td>

                {/* Average Efisiensi Team */}
                <td className="border border-slate-700 p-2 font-mono text-emerald-300 font-bold whitespace-nowrap">
                  {period.totalRow.effTeam.A.toFixed(2)}%
                </td>
                <td className="border border-slate-700 p-2 font-mono text-emerald-300 font-bold whitespace-nowrap">
                  {period.totalRow.effTeam.B.toFixed(2)}%
                </td>
                <td className="border border-slate-700 p-2 font-mono text-emerald-300 font-bold whitespace-nowrap">
                  {period.totalRow.effTeam.C.toFixed(2)}%
                </td>

                {/* Average Cacat/Team */}
                <td className="border border-slate-700 p-2 font-mono text-rose-300 font-bold whitespace-nowrap">
                  {period.totalRow.cacatPerTeam.A.toFixed(2)}%
                </td>
                <td className="border border-slate-700 p-2 font-mono text-rose-300 font-bold whitespace-nowrap">
                  {period.totalRow.cacatPerTeam.B.toFixed(2)}%
                </td>
                <td className="border border-slate-700 p-2 font-mono text-rose-300 font-bold whitespace-nowrap">
                  {period.totalRow.cacatPerTeam.C.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table Bottom Rincian Box */}
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <span className="font-semibold text-slate-500">Rincian Akumulasi Satuan:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 font-bold text-indigo-900">
              <Layers className="w-3 h-3 text-indigo-600" />
              Total Panel: {period.totalRow.hasilProduksi.panelTotal.toLocaleString("id-ID")} pcs
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 font-bold text-teal-900">
              <Ruler className="w-3 h-3 text-teal-600" />
              Total Meteran: {period.totalRow.hasilProduksi.meterTotal.toLocaleString("id-ID")} m
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-[1600px] mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1.5">
            <Link href="/shift-performance" className="hover:text-sky-600 transition-colors">Kepala Shift</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-800 font-bold">Rekap Mesin Bulanan</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Laporan Rekap Performa Mesin per Tim
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Matriks evaluasi hasil produksi, efisiensi tim, dan rasio cacat seluruh mesin dengan perbandingan periode sebelumnya.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-start sm:justify-end gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={isLoading || isRefreshing}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Data Terbaru"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? "animate-spin text-sky-600" : ""}`} />
          </button>

          {/* Excel Export */}
          <button
            onClick={exportToExcel}
            disabled={isLoading || !reportData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Comparison Summary Cards */}
      {reportData && !isLoading && currentPeriod && previousPeriod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Total Volume Produksi */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {selectedFabricType === "panel"
                  ? "Total Produksi Mesin Panel"
                  : selectedFabricType === "meter"
                  ? "Total Produksi Mesin Meteran"
                  : "Total Produksi Sebulan"}
              </p>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {currentPeriod.totalRow.hasilProduksi.total.toLocaleString("id-ID")}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {selectedFabricType === "panel"
                    ? "pcs"
                    : selectedFabricType === "meter"
                    ? "meter"
                    : "output"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold flex-wrap">
                {prodGrowthPercent >= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{prodGrowthPercent.toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {prodGrowthPercent.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">
                  vs {previousPeriod.monthName} ({previousPeriod.totalRow.hasilProduksi.total.toLocaleString("id-ID")})
                </span>
              </div>
            </div>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                selectedFabricType === "meter"
                  ? "bg-teal-100 text-teal-700"
                  : selectedFabricType === "panel"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {selectedFabricType === "meter" ? (
                <Ruler className="w-6 h-6" />
              ) : selectedFabricType === "panel" ? (
                <Layers className="w-6 h-6" />
              ) : (
                <Factory className="w-6 h-6" />
              )}
            </div>
          </div>

          {/* 2. Rata-rata Efisiensi Team */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                Rata-rata Efisiensi Tim
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-800 font-mono">
                  {currentPeriod.totalRow.effTeam.avg.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold flex-wrap">
                {effDeltaPercent >= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{effDeltaPercent.toFixed(2)}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {effDeltaPercent.toFixed(2)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">
                  vs {previousPeriod.monthName} ({previousPeriod.totalRow.effTeam.avg.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* 3. Rata-rata Rasio Cacat Team */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                Rata-rata Rasio Cacat
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-800 font-mono">
                  {currentPeriod.totalRow.cacatPerTeam.avg.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold flex-wrap">
                {defectDeltaPercent <= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {defectDeltaPercent.toFixed(2)}% (Membaik)
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{defectDeltaPercent.toFixed(2)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">
                  vs {previousPeriod.monthName} ({previousPeriod.totalRow.cacatPerTeam.avg.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Filter & View Mode Controls Bar (Single Line) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
        {/* Left Side: Kategori Mesin Pills (Tanpa Angka) */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => setSelectedFabricType("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedFabricType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Semua Mesin
          </button>
          <button
            onClick={() => setSelectedFabricType("panel")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedFabricType === "panel"
                ? "bg-white text-indigo-900 shadow-xs"
                : "text-slate-500 hover:text-indigo-800"
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${selectedFabricType === "panel" ? "text-indigo-600" : "text-slate-400"}`} />
            <span>Khusus Panel</span>
          </button>
          <button
            onClick={() => setSelectedFabricType("meter")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              selectedFabricType === "meter"
                ? "bg-white text-teal-900 shadow-xs"
                : "text-slate-500 hover:text-teal-800"
            }`}
          >
            <Ruler className={`w-3.5 h-3.5 ${selectedFabricType === "meter" ? "text-teal-600" : "text-slate-400"}`} />
            <span>Khusus Meteran</span>
          </button>
        </div>

        {/* Right Side: Mode Tampilan & Periode Tabel */}
        <div className="inline-flex items-center gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl gap-0.5 shrink-0">
            <button
              onClick={() => setDisplayMode("BOTH")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                displayMode === "BOTH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Tampilkan Grafik dan Tabel"
            >
              <BarChart2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Grafik & Tabel</span>
            </button>
            <button
              onClick={() => setDisplayMode("CHARTS")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                displayMode === "CHARTS" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Hanya Tampilkan Grafik"
            >
              <BarChart2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Grafik</span>
            </button>
            <button
              onClick={() => setDisplayMode("TABLES")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                displayMode === "TABLES" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Hanya Tampilkan Tabel"
            >
              <Table className="w-3.5 h-3.5 text-slate-600" />
              <span>Tabel</span>
            </button>
          </div>

          {/* Period Switcher (only when tables are visible) */}
          {(displayMode === "BOTH" || displayMode === "TABLES") && (
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl gap-0.5 shrink-0">
              <button
                onClick={() => setViewMode("dual")}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === "dual" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Kedua Periode
              </button>
              <button
                onClick={() => setViewMode("current")}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === "current" ? "bg-white text-sky-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {currentPeriod?.monthName || "Bulan Terpilih"}
              </button>
              <button
                onClick={() => setViewMode("previous")}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === "previous" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {previousPeriod?.monthName || "Bulan Sebelumnya"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MONTHLY PERFORMANCE CHARTS (3 CHARTS: OUTPUT, EFF, DEFECT)
      ───────────────────────────────────────────────────────────── */}
      {currentPeriod && !isLoading && (displayMode === "BOTH" || displayMode === "CHARTS") && (
        <MonthlyPerformanceCharts period={currentPeriod} />
      )}

      {/* Tables Display */}
      {isLoading ? (
        <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-bold text-slate-600">Menghitung dan memuat data lintas mesin...</p>
        </div>
      ) : reportData && currentPeriod && previousPeriod ? (
        <div className="space-y-6">
          {/* TABEL 1: PERIODE BULAN TERPILIH */}
          {(displayMode === "BOTH" || displayMode === "TABLES") && (viewMode === "dual" || viewMode === "current") && (
            renderTable(currentPeriod, true)
          )}

          {/* TABEL 2: PERIODE BULAN SEBELUMNYA */}
          {(displayMode === "BOTH" || displayMode === "TABLES") && (viewMode === "dual" || viewMode === "previous") && (
            renderTable(previousPeriod, false)
          )}

          {/* ─────────────────────────────────────────────────────────────
              WEEKLY DRILL-DOWN BREAKDOWN SECTION
          ───────────────────────────────────────────────────────────── */}
          {currentWeeklySummaries && currentWeeklySummaries.length > 0 && (
            <div className="mt-12 pt-8 border-t-2 border-slate-200/90 space-y-6">
              {/* Section Header with Tabs */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    Rekap Performa Mesin per Minggu — {currentPeriod.monthName} {currentPeriod.year}
                  </h2>
                </div>

                {/* Week Pills Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl shrink-0 overflow-x-auto max-w-full custom-scrollbar">
                  {currentWeeklySummaries.map((w, idx) => (
                    <button
                      key={w.weekNumber}
                      onClick={() => setSelectedWeekIndex(idx)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        selectedWeekIndex === idx
                          ? "bg-indigo-700 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                      }`}
                    >
                      Minggu {w.weekNumber}{" "}
                      <span className="text-[10px] opacity-80 font-normal">
                        ({w.startDate}-{w.endDate})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Week Content */}
              {(() => {
                const activeWeek =
                  currentWeeklySummaries[selectedWeekIndex] ||
                  currentWeeklySummaries[0];
                if (!activeWeek) return null;

                return (
                  <div className="space-y-4">
                    {/* Active Week Mini Metric Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Output Card */}
                      <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-700 uppercase">
                            Output Minggu {activeWeek.weekNumber}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 bg-white rounded-lg text-indigo-800 shadow-2xs border border-indigo-200">
                            Tgl {activeWeek.startDate} - {activeWeek.endDate}
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 font-mono mt-1">
                          {activeWeek.totalRow.hasilProduksi.total.toLocaleString("id-ID")}{" "}
                          <span className="text-xs text-slate-400 font-sans">
                            {selectedFabricType === "panel"
                              ? "pcs"
                              : selectedFabricType === "meter"
                              ? "meter"
                              : "output"}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-indigo-100/80 text-[11px] font-bold">
                          {selectedFabricType === "all" ? (
                            <div className="flex items-center gap-2">
                              <span className="text-indigo-900 font-mono">
                                Pnl: {activeWeek.totalRow.hasilProduksi.panelTotal.toLocaleString("id-ID")} pcs
                              </span>
                              <span className="text-indigo-300">•</span>
                              <span className="text-teal-900 font-mono">
                                Mtr: {activeWeek.totalRow.hasilProduksi.meterTotal.toLocaleString("id-ID")} m
                              </span>
                            </div>
                          ) : selectedFabricType === "panel" ? (
                            <span className="text-indigo-900 font-mono">
                              Total: {activeWeek.totalRow.hasilProduksi.panelTotal.toLocaleString("id-ID")} pcs panel
                            </span>
                          ) : (
                            <span className="text-teal-900 font-mono">
                              Total: {activeWeek.totalRow.hasilProduksi.meterTotal.toLocaleString("id-ID")} m meteran
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Efisiensi Card */}
                      <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 uppercase">
                            Rata-rata Efisiensi
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 bg-white rounded-lg text-emerald-800 shadow-2xs border border-emerald-200">
                            Efisiensi Tim
                          </span>
                        </div>
                        <div className="text-xl font-black text-emerald-800 font-mono mt-1">
                          {activeWeek.totalRow.effTeam.avg.toFixed(2)}%
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-100/80 text-[11px] font-bold">
                          <span className="text-emerald-900 font-mono">
                            A: {activeWeek.totalRow.effTeam.A.toFixed(1)}%
                          </span>
                          <span className="text-emerald-300">•</span>
                          <span className="text-emerald-900 font-mono">
                            B: {activeWeek.totalRow.effTeam.B.toFixed(1)}%
                          </span>
                          <span className="text-emerald-300">•</span>
                          <span className="text-emerald-900 font-mono">
                            C: {activeWeek.totalRow.effTeam.C.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Rasio Cacat Card */}
                      <div className="bg-rose-50/70 border border-rose-100 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-700 uppercase">
                            Rata-rata Rasio Cacat
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 bg-white rounded-lg text-rose-800 shadow-2xs border border-rose-200">
                            Tingkat Cacat
                          </span>
                        </div>
                        <div className="text-xl font-black text-rose-800 font-mono mt-1">
                          {activeWeek.totalRow.cacatPerTeam.avg.toFixed(2)}%
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-100/80 text-[11px] font-bold">
                          <span className="text-rose-900 font-mono">
                            A: {activeWeek.totalRow.cacatPerTeam.A.toFixed(1)}%
                          </span>
                          <span className="text-rose-300">•</span>
                          <span className="text-rose-900 font-mono">
                            B: {activeWeek.totalRow.cacatPerTeam.B.toFixed(1)}%
                          </span>
                          <span className="text-rose-300">•</span>
                          <span className="text-rose-900 font-mono">
                            C: {activeWeek.totalRow.cacatPerTeam.C.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table for Active Week */}
                    {renderTable(
                      activeWeek,
                      true,
                      `Rekap ${activeWeek.weekLabel} — ${activeWeek.monthName} ${activeWeek.year}`,
                      `Minggu ${activeWeek.weekNumber}`,
                      "indigo"
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 font-semibold">
          Data tidak tersedia untuk periode yang dipilih.
        </div>
      )}
    </div>
  );
}
