"use client";

import React from "react";
import {
  BarChart2,
  Users,
  HelpCircle,
  Download,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

export interface DashboardHeaderProps {
  isLive: boolean;
  dashboardMode: "PRODUKSI" | "KEHADIRAN";
  setDashboardMode: (mode: "PRODUKSI" | "KEHADIRAN") => void;
  setIsTourOpen: (open: boolean) => void;
  setIsMonthlyRekapModalOpen: (open: boolean) => void;
  handleManualRefresh: () => void;
  isRefreshing: boolean;
  handleResetFilters: () => void;
}

export default function DashboardHeader({
  isLive,
  dashboardMode,
  setDashboardMode,
  setIsTourOpen,
  setIsMonthlyRekapModalOpen,
  handleManualRefresh,
  isRefreshing,
  handleResetFilters,
}: DashboardHeaderProps) {
  return (
    <div
      data-tour="dashboard-header"
      className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs relative z-10 overflow-hidden"
    >
      {/* Decorative Top Accent */}
      <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-85" />

      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3.5">
        {/* Baris 1 (Mobile/Tablet) / Kiri (Desktop): Title + Live Badge + Mode Toggle (Mobile/Tablet) */}
        <div className="flex items-center justify-between gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none whitespace-nowrap">
              <span className="bg-gradient-to-r from-slate-900 via-[#004777] to-[#0070bc] bg-clip-text text-transparent">
                DASHBOARD
              </span>
            </h1>
            {isLive ? (
              <span
                title="Terhubung langsung ke Database"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200/80 text-[10px] font-black text-[#0070bc] uppercase tracking-wider shrink-0 cursor-help"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span
                title="Terputus dari Database (Demo)"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 cursor-help"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Offline
              </span>
            )}
          </div>

          {/* Dashboard Mode Toggle on Mobile & Tablet (< lg) */}
          <div className="lg:hidden flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setDashboardMode("PRODUKSI")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "PRODUKSI"
                  ? "bg-white text-[#0070bc] shadow-xs border border-slate-200/70"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Produksi
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode("KEHADIRAN")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "KEHADIRAN"
                  ? "bg-white text-emerald-600 shadow-xs border border-slate-200/70"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Hadir
            </button>
          </div>
        </div>

        {/* Baris 2 (Mobile/Tablet) / Kanan (Desktop): Unified Action Toolbar */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-wrap">
          {/* Primary Hero Action: Rekap Excel */}
          <button
            type="button"
            onClick={() => setIsMonthlyRekapModalOpen(true)}
            className="group/xl h-9 pl-1.5 pr-3.5 rounded-xl bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-[0.98] text-white text-xs font-extrabold shadow-sm shadow-[#0070bc]/20 hover:shadow-md hover:shadow-[#0070bc]/30 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            title="Download Rekap Laporan Bulanan"
          >
            <span className="w-6 h-6 rounded-lg bg-white/15 group-hover/xl:bg-white/25 flex items-center justify-center transition-colors shrink-0">
              <Download className="w-3.5 h-3.5 text-white" />
            </span>
            <span>Rekap Excel</span>
          </button>

          {/* Dashboard Mode Toggle (Desktop >= lg) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setDashboardMode("PRODUKSI")}
              className={`h-7 px-3 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "PRODUKSI"
                  ? "bg-white text-[#0070bc] shadow-xs border border-slate-200/70"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Produksi
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode("KEHADIRAN")}
              className={`h-7 px-3 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "KEHADIRAN"
                  ? "bg-white text-emerald-600 shadow-xs border border-slate-200/70"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Kehadiran
            </button>
          </div>

          {/* Secondary Utility Dock: Tutorial, Segarkan, Reset */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 ml-auto sm:ml-0 shrink-0">
            <button
              type="button"
              onClick={() => setIsTourOpen(true)}
              className="h-7 px-2.5 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0070bc] border border-slate-200/70 hover:border-sky-200 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
              <span>Tutorial</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-7 px-2.5 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0070bc] border border-slate-200/70 hover:border-sky-200 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap group disabled:opacity-50"
              title="Segarkan data dari server"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 group-hover:text-[#0070bc] transition-transform duration-500 shrink-0 ${
                  isRefreshing ? "animate-spin text-[#0070bc]" : "group-hover:rotate-180"
                }`}
              />
              <span>{isRefreshing ? "Memuat..." : "Segarkan"}</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="h-7 px-2.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/70 hover:border-rose-200 text-xs font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Reset Slicer"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
