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
  ChevronRight,
  Sparkles,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import * as xlsx from "xlsx";
import {
  getDualPeriodMachineReport,
  DualPeriodCrossMachineReport,
  CrossMachineReportSummary,
  MachineTeamMetric,
} from "@/actions/cross-machine-actions";

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
  const [viewMode, setViewMode] = useState<"dual" | "current" | "previous">("dual");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getDualPeriodMachineReport(selectedMonth, selectedYear);
      setReportData(data);
    } catch (err) {
      console.error("Gagal memuat data laporan matriks mesin:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Export to Excel
  const exportToExcel = () => {
    if (!reportData) return;

    const wb = xlsx.utils.book_new();

    const generateSheetData = (period: CrossMachineReportSummary, title: string) => {
      const wsData: any[][] = [];
      wsData.push([`LAPORAN PERFORMA MESIN PER TIM - ${title.toUpperCase()}`]);
      wsData.push([`Periode: ${period.monthName} ${period.year}`]);
      wsData.push([]);
      wsData.push([
        "Mesin",
        "Hasil Produksi", "", "",
        "Efisiensi Team", "", "",
        "Cacat/Team", "", ""
      ]);
      wsData.push([
        "",
        "A", "B", "C",
        "A", "B", "C",
        "A", "B", "C"
      ]);

      period.machines.forEach((m) => {
        wsData.push([
          m.machineId,
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

      return wsData;
    };

    // Sheet 1: Current Period
    const ws1Data = generateSheetData(reportData.currentPeriod, `Periode ${reportData.currentPeriod.monthName} ${reportData.currentPeriod.year}`);
    const ws1 = xlsx.utils.aoa_to_sheet(ws1Data);
    xlsx.utils.book_append_sheet(wb, ws1, `${reportData.currentPeriod.monthName} ${reportData.currentPeriod.year}`);

    // Sheet 2: Previous Period
    const ws2Data = generateSheetData(reportData.previousPeriod, `Periode ${reportData.previousPeriod.monthName} ${reportData.previousPeriod.year}`);
    const ws2 = xlsx.utils.aoa_to_sheet(ws2Data);
    xlsx.utils.book_append_sheet(wb, ws2, `${reportData.previousPeriod.monthName} ${reportData.previousPeriod.year}`);

    xlsx.writeFile(wb, `Laporan_Rekap_Mesin_${reportData.currentPeriod.monthName}_${reportData.currentPeriod.year}.xlsx`);
  };

  const renderTable = (period: CrossMachineReportSummary, isCurrent: boolean) => {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Table Header Banner */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
          isCurrent ? "bg-sky-50/80 border-sky-200" : "bg-slate-100/90 border-slate-200"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isCurrent ? "bg-sky-600" : "bg-slate-500"}`}></span>
            <h3 className="text-sm font-bold text-slate-800">
              Periode {period.monthName} {period.year}
            </h3>
            {isCurrent ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                Bulan Terpilih
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                Bulan Sebelumnya
              </span>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-600">
            Total Produksi: <span className="font-bold text-slate-900 font-mono">{period.totalRow.hasilProduksi.total.toLocaleString("id-ID")}</span>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              {/* Row 1 Header */}
              <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 text-center uppercase">
                <th rowSpan={2} className="border border-slate-300 p-2.5 w-16 bg-slate-100 text-slate-800 font-bold sticky left-0 z-10">
                  Mesin
                </th>
                <th colSpan={3} className="border border-slate-300 p-2 bg-slate-100 text-slate-800 font-bold">
                  Hasil Produksi
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
                    {/* Machine ID */}
                    <td className="border border-slate-300 p-2 font-bold text-slate-900 bg-slate-50 sticky left-0 z-10">
                      {m.machineId}
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
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-[1600px] mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1.5">
            <Link href="/shift-performance" className="hover:text-sky-600 transition-colors">Kepala Shift</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-800 font-bold">Rekap Mesin Bulanan</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Laporan Rekap Performa Mesin per Tim
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Matriks evaluasi hasil produksi, efisiensi tim, dan rasio cacat seluruh mesin dengan perbandingan periode sebelumnya.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Excel Export */}
          <button
            onClick={exportToExcel}
            disabled={isLoading || !reportData}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Comparison Summary Cards */}
      {reportData && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Total Volume Produksi */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Produksi Sebulan</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {reportData.currentPeriod.totalRow.hasilProduksi.total.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-slate-400">output</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold">
                {reportData.kpiComparison.productionGrowthPercent >= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{reportData.kpiComparison.productionGrowthPercent.toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {reportData.kpiComparison.productionGrowthPercent.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">vs {reportData.previousPeriod.monthName} ({reportData.previousPeriod.totalRow.hasilProduksi.total.toLocaleString("id-ID")})</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Factory className="w-6 h-6" />
            </div>
          </div>

          {/* 2. Rata-rata Efisiensi Team */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata Efisiensi Tim</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-800 font-mono">
                  {reportData.currentPeriod.totalRow.effTeam.avg.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold">
                {reportData.kpiComparison.effDeltaPercent >= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{reportData.kpiComparison.effDeltaPercent.toFixed(2)}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {reportData.kpiComparison.effDeltaPercent.toFixed(2)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">vs {reportData.previousPeriod.monthName} ({reportData.previousPeriod.totalRow.effTeam.avg.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* 3. Rata-rata Rasio Cacat Team */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata Rasio Cacat</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-800 font-mono">
                  {reportData.currentPeriod.totalRow.cacatPerTeam.avg.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold">
                {reportData.kpiComparison.defectDeltaPercent <= 0 ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {reportData.kpiComparison.defectDeltaPercent.toFixed(2)}% (Membaik)
                  </span>
                ) : (
                  <span className="flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{reportData.kpiComparison.defectDeltaPercent.toFixed(2)}%
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">vs {reportData.previousPeriod.monthName} ({reportData.previousPeriod.totalRow.cacatPerTeam.avg.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle Switcher */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500 ml-2" />
          <span className="text-xs font-bold text-slate-700">Tampilan Periode:</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("dual")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "dual" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Kedua Periode (Bulan Ini & Bulan Lalu)
          </button>
          <button
            onClick={() => setViewMode("current")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "current" ? "bg-white text-sky-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {reportData?.currentPeriod.monthName || "Bulan Terpilih"} Saja
          </button>
          <button
            onClick={() => setViewMode("previous")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === "previous" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {reportData?.previousPeriod.monthName || "Bulan Sebelumnya"} Saja
          </button>
        </div>
      </div>

      {/* Tables Display */}
      {isLoading ? (
        <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-bold text-slate-600">Menghitung dan memuat data lintas mesin...</p>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* TABEL 1: PERIODE BULAN TERPILIH */}
          {(viewMode === "dual" || viewMode === "current") && (
            renderTable(reportData.currentPeriod, true)
          )}

          {/* TABEL 2: PERIODE BULAN SEBELUMNYA */}
          {(viewMode === "dual" || viewMode === "previous") && (
            renderTable(reportData.previousPeriod, false)
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
