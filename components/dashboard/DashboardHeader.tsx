"use client";

import React from "react";
import {
  BarChart2,
  Users,
  HelpCircle,
  Download,
  RefreshCw,
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
      className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative z-10"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 sm:gap-4">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-slate-900 via-[#004777] to-[#0070bc] bg-clip-text text-transparent drop-shadow-sm">
                DASHBOARD
              </span>
            </h1>
            {isLive ? (
              <span
                title="Indikator Biru: Terhubung ke Database"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-sky-100 shadow-[0_2px_10px_-3px_rgba(14,165,233,0.15)] cursor-help"
              >
                <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse" />
              </span>
            ) : (
              <span
                title="Indikator Abu: Terputus dari Database (Demo)"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm cursor-help"
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </span>
            )}
          </div>

          {/* Dashboard Mode Toggle on Mobile */}
          <div className="md:hidden flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setDashboardMode("PRODUKSI")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1 ${
                dashboardMode === "PRODUKSI"
                  ? "bg-white text-[#0070bc] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Produksi
            </button>
            <button
              onClick={() => setDashboardMode("KEHADIRAN")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1 ${
                dashboardMode === "KEHADIRAN"
                  ? "bg-white text-emerald-600 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-3 h-3" />
              Hadir
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar w-full md:w-auto pb-0.5 md:pb-0">
          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-extrabold text-[#0070bc] shadow-sm transition-all hover:bg-sky-100 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Tutorial
          </button>
          <button
            type="button"
            onClick={() => setIsMonthlyRekapModalOpen(true)}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-[#0070bc] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#005a96] cursor-pointer"
            title="Download Rekap Laporan Bulanan"
          >
            <Download className="w-3.5 h-3.5" />
            Rekap Excel
          </button>

          {/* Dashboard Mode Toggle (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner shrink-0">
            <button
              onClick={() => setDashboardMode("PRODUKSI")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "PRODUKSI"
                  ? "bg-white text-[#0070bc] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Produksi
            </button>
            <button
              onClick={() => setDashboardMode("KEHADIRAN")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                dashboardMode === "KEHADIRAN"
                  ? "bg-white text-emerald-600 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Kehadiran
            </button>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-[#0070bc] hover:border-sky-200 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 group disabled:opacity-50"
            title="Segarkan data dari server"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshing ? "animate-spin text-sky-600" : "group-hover:rotate-180"
              }`}
            />
            {isRefreshing ? "Memuat..." : "Segarkan"}
          </button>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-[#0070bc] hover:border-sky-200 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 group"
            title="Reset Slicer"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
