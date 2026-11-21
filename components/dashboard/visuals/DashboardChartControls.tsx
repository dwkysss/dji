"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BarChart2,
  TrendingUp,
  Palette,
  Users,
  Layers,
  Cpu,
} from "lucide-react";

export interface DashboardChartControlsProps {
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  setQualityViewMode: (mode: "QC_GRADE" | "OPERATOR_STATUS") => void;
  chartGroupBy: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI";
  setChartGroupBy: (val: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI") => void;
  isSingleDay: boolean;
  chartType: "BAR" | "LINE";
  setChartType: (type: "BAR" | "LINE") => void;
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  setChartGradeFilter: (val: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED") => void;
  operatorStatusFilter: "ALL" | "CEKLIS" | "SILANG";
  setOperatorStatusFilter: (val: "ALL" | "CEKLIS" | "SILANG") => void;
}

export default function DashboardChartControls({
  qualityViewMode,
  setQualityViewMode,
  chartGroupBy,
  setChartGroupBy,
  isSingleDay,
  chartType,
  setChartType,
  chartGradeFilter,
  setChartGradeFilter,
  operatorStatusFilter,
  setOperatorStatusFilter,
}: DashboardChartControlsProps) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-3.5 mb-4">
      {/* Header: Title & Subtitle */}
      <div className="min-w-0">
        <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-800 tracking-tight leading-snug">
          Tren Hasil Produksi &amp; Analisis Kualitas
        </h3>
        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
          {qualityViewMode === "QC_GRADE"
            ? "Berdasarkan hasil grading inspeksi QC & mending"
            : "Berdasarkan status ceklis / silang dari input operator"}
        </p>
      </div>

      {/* Unified Compact 2-Row Control Toolbar below Title */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-1.5 flex flex-col gap-1.5">
        {/* Baris 1: Group By (kiri) + Chart Type Bar/Line (kanan) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
          <div className="overflow-x-auto no-scrollbar max-w-full min-w-0">
            <div className="inline-flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/80 shadow-2xs min-w-max">
              <button
                type="button"
                onClick={() => setChartGroupBy("HARI")}
                className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  chartGroupBy === "HARI"
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                }`}
              >
                <BarChart2 className="w-3 h-3 shrink-0" />
                <span>{isSingleDay ? "Shift" : "Tanggal"}</span>
              </button>
              <button
                type="button"
                onClick={() => setChartGroupBy("DESIGN")}
                className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  chartGroupBy === "DESIGN"
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                }`}
              >
                <Palette className="w-3 h-3 shrink-0" />
                <span>Design</span>
              </button>
              <button
                type="button"
                onClick={() => setChartGroupBy("PEGAWAI")}
                className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  chartGroupBy === "PEGAWAI"
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                }`}
              >
                <Users className="w-3 h-3 shrink-0" />
                <span>Pegawai</span>
              </button>
              <button
                type="button"
                onClick={() => setChartGroupBy("GROUP")}
                className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  chartGroupBy === "GROUP"
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                }`}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span>Group</span>
              </button>
              <button
                type="button"
                onClick={() => setChartGroupBy("MESIN")}
                className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  chartGroupBy === "MESIN"
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                }`}
              >
                <Cpu className="w-3 h-3 shrink-0" />
                <span>Mesin</span>
              </button>
            </div>
          </div>

          {/* Chart Type Toggle (Bar / Line) */}
          <div className="inline-flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/80 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setChartType("BAR")}
              className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                chartType === "BAR"
                  ? "bg-slate-800 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
              }`}
            >
              <BarChart2 className="w-3 h-3 shrink-0" />
              <span>Bar</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("LINE")}
              className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                chartType === "LINE"
                  ? "bg-slate-800 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
              }`}
            >
              <TrendingUp className="w-3 h-3 shrink-0" />
              <span>Line</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Mode Kualitas Grade QC / Input Operator (kiri) + Filter Status/Grade (kanan) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
          {/* Quality View Mode Switch */}
          <div className="inline-flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/80 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setQualityViewMode("QC_GRADE")}
              className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                qualityViewMode === "QC_GRADE"
                  ? "bg-[#0070bc] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
              }`}
            >
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span>Grade QC</span>
            </button>
            <button
              type="button"
              onClick={() => setQualityViewMode("OPERATOR_STATUS")}
              className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                qualityViewMode === "OPERATOR_STATUS"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Input Operator</span>
            </button>
          </div>

          {/* Slicer Toggles depending on qualityViewMode */}
          <div className="overflow-x-auto no-scrollbar max-w-full min-w-0">
            <div className="inline-flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/80 shadow-2xs min-w-max">
              {qualityViewMode === "QC_GRADE" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setChartGradeFilter("ALL")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      chartGradeFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGradeFilter("GRADE_A")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      chartGradeFilter === "GRADE_A"
                        ? "bg-sky-600 text-white shadow-2xs"
                        : "text-[#0070bc] hover:bg-sky-50"
                    }`}
                  >
                    Grade A
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGradeFilter("GRADE_B")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      chartGradeFilter === "GRADE_B"
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    Grade B
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGradeFilter("BS")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      chartGradeFilter === "BS"
                        ? "bg-rose-500 text-white shadow-2xs"
                        : "text-rose-700 hover:bg-rose-50"
                    }`}
                  >
                    BS
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGradeFilter("UNGRADED")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      chartGradeFilter === "UNGRADED"
                        ? "bg-slate-500 text-white shadow-2xs"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Ungraded
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOperatorStatusFilter("ALL")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      operatorStatusFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperatorStatusFilter("CEKLIS")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      operatorStatusFilter === "CEKLIS"
                        ? "bg-[#0070bc] text-white shadow-2xs"
                        : "text-[#0070bc] hover:bg-sky-50"
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Normal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperatorStatusFilter("SILANG")}
                    className={`px-2 py-1 rounded-md text-[9.5px] font-extrabold uppercase tracking-tight transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      operatorStatusFilter === "SILANG"
                        ? "bg-rose-500 text-white shadow-2xs"
                        : "text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Cacat</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
