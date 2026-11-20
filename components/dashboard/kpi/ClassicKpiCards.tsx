"use client";

import React from "react";
import {
  TrendingUp,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Gauge,
  Boxes,
  ShieldAlert,
} from "lucide-react";
import { formatDuration } from "./kpiUtils";

export interface ClassicKpiCardsProps {
  isRefreshing: boolean;
  isLoadingInitial: boolean;
  transactionsCount: number;
  cachedKpiSummary: any;
  stats: {
    totalProduksi: number;
    totalProduksiMeter: number;
    persentaseCacatPanel: number;
    persentaseCacatMeteran: number;
    countMasalahPanel: number;
    countMasalahMeteran: number;
    totalPanelValid: number;
    efisiensi: number;
    totalDowntimeDetik: number;
    countMasalah: number;
  };
  activeFilter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI";
  setActiveFilter: (filter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI") => void;
  metricMode: "PCS" | "METER";
  setMetricMode: (mode: "PCS" | "METER") => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEndMetric: (e: React.TouchEvent) => void;
}

export default function ClassicKpiCards({
  isRefreshing,
  isLoadingInitial,
  transactionsCount,
  cachedKpiSummary,
  stats,
  activeFilter,
  setActiveFilter,
  metricMode,
  setMetricMode,
  handleTouchStart,
  handleTouchEndMetric,
}: ClassicKpiCardsProps) {
  return (
    <>
      {/* Card 1: Hasil Produksi (Slider Slicer) */}
      <div
        className={`relative overflow-hidden rounded-2xl h-full min-h-[8rem] sm:min-h-[9.25rem] group transition-all duration-300 flex flex-col border ${
          activeFilter === "ALL"
            ? "bg-[#064e7b] border-sky-300 shadow-[0_14px_32px_rgba(3,74,118,0.28)] scale-[1.02] sm:scale-[1.03] text-white"
            : "bg-[#0877b9] border-sky-400/50 shadow-[0_8px_20px_rgba(3,105,161,0.20)] hover:-translate-y-0.5 text-white"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEndMetric}
      >
        <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-sky-300/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />
        {isRefreshing && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-cardShimmer" />
          </div>
        )}
        <div
          className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
          }}
        >
          <div
            onClick={() => {
              setActiveFilter("ALL");
              setMetricMode("PCS");
            }}
            className="w-1/2 cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10 gap-1">
              <span className="text-sky-100 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                Total Produksi
              </span>
              <span className="w-7 h-7 rounded-xl bg-white/15 ring-1 ring-white/15 flex items-center justify-center text-white shrink-0">
                {isRefreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Boxes className="w-3.5 h-3.5" />}
              </span>
            </div>
            <div className="mt-1 sm:mt-2 relative z-10">
              <div className="text-xl sm:text-3xl font-black tracking-tight flex items-baseline gap-1">
                {isLoadingInitial && transactionsCount === 0 && !cachedKpiSummary ? (
                  <span className="inline-block w-16 h-7 bg-white/20 animate-pulse rounded my-1" />
                ) : (
                  stats.totalProduksi.toLocaleString()
                )}
                <span className="text-xs sm:text-sm font-semibold opacity-80">
                  Panel
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-sky-200 font-semibold truncate">
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Panel</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              setActiveFilter("ALL");
              setMetricMode("METER");
            }}
            className="w-1/2 cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10 gap-1">
              <span className="text-sky-100 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                Total Produksi
              </span>
              <span className="w-7 h-7 rounded-xl bg-white/15 ring-1 ring-white/15 flex items-center justify-center text-white shrink-0">
                {isRefreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              </span>
            </div>
            <div className="mt-1 sm:mt-2 relative z-10">
              <div className="text-xl sm:text-3xl font-black tracking-tight flex items-baseline gap-1">
                {stats.totalProduksiMeter.toLocaleString()}
                <span className="text-xs sm:text-sm font-semibold opacity-80">
                  Meter
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-sky-200 font-semibold truncate">
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Gulungan</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMetricMode("PCS")}
            className="p-2 sm:p-3 -m-2 sm:-m-3 cursor-pointer"
            title="Geser ke PCS"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "PCS" ? "w-3.5 sm:w-4 bg-white" : "w-1.5 bg-sky-350"
              }`}
            />
          </button>
          <button
            onClick={() => setMetricMode("METER")}
            className="p-2 sm:p-3 -m-2 sm:-m-3 cursor-pointer ml-2 sm:ml-3"
            title="Geser ke METER"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "METER" ? "w-3.5 sm:w-4 bg-white" : "w-1.5 bg-sky-350"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Card 2: Cacat Panel / Cacat Meter */}
      <div
        className={`relative overflow-hidden rounded-2xl h-full min-h-[8rem] sm:min-h-[9.25rem] group border transition-all duration-300 flex flex-col ${
          activeFilter === "LOLOS"
            ? "bg-amber-50/70 border-amber-400 text-slate-800 shadow-[0_12px_28px_rgba(245,158,11,0.16)] scale-[1.02] sm:scale-[1.03] ring-2 ring-amber-400/70"
            : "bg-white border-slate-200 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEndMetric}
      >
        {isRefreshing && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-sky-400/15 to-transparent animate-cardShimmer" />
          </div>
        )}
        <div
          className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
          }}
        >
          <div
            onClick={() => {
              setActiveFilter("LOLOS");
              setMetricMode("PCS");
            }}
            className="w-1/2 cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10 gap-1">
              <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                Cacat Panel
              </span>
              <span
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
                  activeFilter === "LOLOS"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin text-amber-700" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              </span>
            </div>
            <div className="mt-1 sm:mt-2 relative z-10">
              <div className="text-xl sm:text-3xl font-black tracking-tight text-slate-800">
                {stats.persentaseCacatPanel.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-amber-700 font-bold truncate">
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">
                  {stats.countMasalahPanel} cacat / {stats.totalPanelValid} panel
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              setActiveFilter("LOLOS");
              setMetricMode("METER");
            }}
            className="w-1/2 cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10 gap-1">
              <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                Cacat Meter
              </span>
              <span
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
                  activeFilter === "LOLOS"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin text-amber-700" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              </span>
            </div>
            <div className="mt-1 sm:mt-2 relative z-10">
              <div className="text-xl sm:text-3xl font-black tracking-tight text-slate-800">
                {stats.persentaseCacatMeteran.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-amber-700 font-bold truncate">
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">{stats.countMasalahMeteran} titik</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setMetricMode("PCS");
              if (activeFilter === "LOLOS") setActiveFilter("LOLOS");
            }}
            className="p-2 sm:p-3 -m-2 sm:-m-3 cursor-pointer"
            title="Geser ke QC Panel"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "PCS"
                  ? activeFilter === "LOLOS"
                    ? "w-3.5 sm:w-4 bg-amber-500"
                    : "w-3.5 sm:w-4 bg-slate-800"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          </button>
          <button
            onClick={() => {
              setMetricMode("METER");
              if (activeFilter === "LOLOS") setActiveFilter("LOLOS");
            }}
            className="p-2 sm:p-3 -m-2 sm:-m-3 cursor-pointer ml-2 sm:ml-3"
            title="Geser ke QC Meter"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "METER"
                  ? activeFilter === "LOLOS"
                    ? "w-3.5 sm:w-4 bg-amber-500"
                    : "w-3.5 sm:w-4 bg-slate-800"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Card 3: Efisiensi Kerja & Downtime */}
      <div
        onClick={() => setActiveFilter("EFISIENSI")}
        className={`relative overflow-hidden rounded-2xl h-full min-h-[8rem] sm:min-h-[9.25rem] border cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between transition-all duration-300 ${
          activeFilter === "EFISIENSI"
            ? "bg-emerald-50/40 shadow-[0_8px_30px_rgba(16,185,129,0.12)] text-slate-800 scale-[1.02] sm:scale-[1.03]"
            : "bg-white border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md text-slate-800"
        }`}
      >
        {activeFilter === "EFISIENSI" && (
          <div className="absolute inset-0 ring-2 ring-emerald-500 rounded-2xl pointer-events-none" />
        )}
        {isRefreshing && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent animate-cardShimmer" />
          </div>
        )}
        <div className="flex justify-between items-start relative z-10 gap-1">
          <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
            Efisiensi Kerja
          </span>
          <span
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
              activeFilter === "EFISIENSI"
                ? "bg-emerald-100 text-emerald-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" /> : <Gauge className="w-3.5 h-3.5" />}
          </span>
        </div>
        <div className="mt-1 sm:mt-2 relative z-10">
          <div className="text-xl sm:text-3xl font-black tracking-tight text-slate-800">
            {stats.efisiensi.toFixed(1)}%
          </div>
          <div
            className={`flex items-center gap-1.5 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-extrabold truncate ${
              stats.totalDowntimeDetik > 0 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {stats.totalDowntimeDetik > 0 ? (
              <>
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">
                  DT: {formatDuration(stats.totalDowntimeDetik)}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Downtime: 0s</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card 4: Masalah Produksi */}
      <div
        onClick={() => {
          setActiveFilter("PROBLEMS");
          setMetricMode("PCS");
        }}
        className={`relative overflow-hidden rounded-2xl h-full min-h-[8rem] sm:min-h-[9.25rem] border cursor-pointer p-3.5 sm:p-5 flex flex-col justify-between transition-all duration-300 ${
          activeFilter === "PROBLEMS"
            ? "bg-red-50/40 shadow-[0_8px_30px_rgba(239,68,68,0.12)] text-slate-800 scale-[1.02] sm:scale-[1.03]"
            : "bg-white border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md text-slate-800"
        }`}
      >
        {activeFilter === "PROBLEMS" && (
          <div className="absolute inset-0 ring-2 ring-red-500 rounded-2xl pointer-events-none" />
        )}
        {isRefreshing && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-red-400/15 to-transparent animate-cardShimmer" />
          </div>
        )}
        <div className="flex justify-between items-start relative z-10 gap-1">
          <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider line-clamp-1">
            Masalah
          </span>
          <span
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
              activeFilter === "PROBLEMS"
                ? "bg-red-100 text-red-600 animate-pulse"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isRefreshing ? (
              <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin text-red-600" />
            ) : (
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
          </span>
        </div>
        <div className="mt-1 sm:mt-2 relative z-10">
          <div className="text-xl sm:text-3xl font-black tracking-tight text-slate-800 flex items-baseline gap-1">
            {stats.countMasalah} <span className="text-xs sm:text-base font-bold">Masalah</span>
          </div>
          <div
            className={`flex items-center gap-1.5 mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-extrabold truncate ${
              stats.countMasalah > 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {stats.countMasalah > 0 ? (
              <>
                <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Perlu Periksa</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Kondisi Normal</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
