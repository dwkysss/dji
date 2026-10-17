"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BarChart2,
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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-4 sm:mb-6">
      <div>
        <h3 className="text-base font-extrabold text-slate-800">
          Tren Hasil Produksi & Analisis Kualitas
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          {/* Quality View Mode Switch */}
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setQualityViewMode("QC_GRADE")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                qualityViewMode === "QC_GRADE"
                  ? "bg-white text-[#0070bc] shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Grade QC
            </button>
            <button
              onClick={() => setQualityViewMode("OPERATOR_STATUS")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                qualityViewMode === "OPERATOR_STATUS"
                  ? "bg-white text-emerald-600 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Input Operator
            </button>
          </div>
        </div>
      </div>

      {/* Chart Control Toggles */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2.5 w-full sm:w-auto">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full w-full sm:w-auto pb-0.5 sm:pb-0">
          {/* Chart View Toggles */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setChartGroupBy("HARI")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                chartGroupBy === "HARI"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BarChart2 className="w-3 h-3" /> {isSingleDay ? "Shift" : "Tanggal"}
            </button>
            <button
              onClick={() => setChartGroupBy("DESIGN")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                chartGroupBy === "DESIGN"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Palette className="w-3 h-3" /> Design
            </button>
            <button
              onClick={() => setChartGroupBy("PEGAWAI")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                chartGroupBy === "PEGAWAI"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="w-3 h-3" /> Pegawai
            </button>
            <button
              onClick={() => setChartGroupBy("GROUP")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                chartGroupBy === "GROUP"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-3 h-3" /> Group
            </button>
            <button
              onClick={() => setChartGroupBy("MESIN")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                chartGroupBy === "MESIN"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Cpu className="w-3 h-3" /> Mesin
            </button>
          </div>

          {/* Chart Type Toggles */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setChartType("BAR")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                chartType === "BAR"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType("LINE")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                chartType === "LINE"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Line
            </button>
          </div>
        </div>

        {/* Slicer Toggles depending on qualityViewMode */}
        <div className="overflow-x-auto no-scrollbar max-w-full w-full sm:w-auto pb-0.5 sm:pb-0">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
            {qualityViewMode === "QC_GRADE" ? (
              <>
                <button
                  onClick={() => setChartGradeFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    chartGradeFilter === "ALL"
                      ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setChartGradeFilter("GRADE_A")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    chartGradeFilter === "GRADE_A"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-[#0070bc] hover:bg-sky-50"
                  }`}
                >
                  Grade A
                </button>
                <button
                  onClick={() => setChartGradeFilter("GRADE_B")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    chartGradeFilter === "GRADE_B"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  Grade B
                </button>
                <button
                  onClick={() => setChartGradeFilter("BS")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    chartGradeFilter === "BS"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  BS
                </button>
                <button
                  onClick={() => setChartGradeFilter("UNGRADED")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    chartGradeFilter === "UNGRADED"
                      ? "bg-slate-500 text-white shadow-xs"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Ungraded
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setOperatorStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shrink-0 ${
                    operatorStatusFilter === "ALL"
                      ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setOperatorStatusFilter("CEKLIS")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    operatorStatusFilter === "CEKLIS"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-[#0070bc] hover:bg-sky-50"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" /> Normal
                </button>
                <button
                  onClick={() => setOperatorStatusFilter("SILANG")}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    operatorStatusFilter === "SILANG"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  <XCircle className="w-3 h-3" /> Cacat
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
